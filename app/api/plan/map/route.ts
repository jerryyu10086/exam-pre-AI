import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { callDeepSeek, extractJSON } from "@/lib/deepseek";
import {
  buildMapSlidesPrompt,
  buildMapExamWithAnswersPrompt,
  buildMapExamNoAnswersPrompt,
} from "@/lib/prompts";

export const maxDuration = 55;

type ChunkRow = {
  file_name: string;
  material_type: string;
  content: string;
  chunk_index: number;
  has_answers: boolean | null;
};

type MapEntry = {
  file_name: string;
  material_type: string;
  data: Record<string, unknown>;
};

// POST /api/plan/map — 对单个文件跑 MAP，结果合并写入 plans.maps_cache
export async function POST(request: NextRequest) {
  try {
    const { exam_id, file_name } = await request.json();
    if (!exam_id || !file_name) {
      return NextResponse.json({ error: "缺少 exam_id 或 file_name" }, { status: 400 });
    }

    const supabase = createServiceClient();

    const { data: chunks, error } = await supabase
      .from("chunks")
      .select("file_name, material_type, content, chunk_index, has_answers")
      .eq("exam_id", exam_id)
      .eq("file_name", file_name)
      .order("chunk_index", { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!chunks || chunks.length === 0) {
      return NextResponse.json({ error: "未找到该文件内容" }, { status: 404 });
    }

    const rows = chunks as ChunkRow[];
    const { material_type, has_answers } = rows[0];

    if (material_type === "textbook") {
      return NextResponse.json({ success: true });
    }

    const fullText = rows
      .sort((a, b) => a.chunk_index - b.chunk_index)
      .map((r) => r.content)
      .join("\n");

    let prompt: string;
    if (material_type === "slides") {
      prompt = buildMapSlidesPrompt(fullText);
    } else {
      prompt = has_answers !== false
        ? buildMapExamWithAnswersPrompt(fullText)
        : buildMapExamNoAnswersPrompt(fullText);
    }

    const raw = await callDeepSeek([{ role: "user", content: prompt }]);
    const mapJson = extractJSON(raw) as Record<string, unknown>;
    const newEntry: MapEntry = { file_name, material_type, data: mapJson };

    // 读取已有 cache，将本文件结果合并写回
    const { data: existing } = await supabase
      .from("plans")
      .select("maps_cache")
      .eq("exam_id", exam_id)
      .single();

    const existingCache = (Array.isArray(existing?.maps_cache) ? existing.maps_cache : []) as MapEntry[];
    const merged = [
      ...existingCache.filter((e) => e.file_name !== file_name),
      newEntry,
    ];

    const { error: upsertErr } = await supabase
      .from("plans")
      .upsert({ exam_id, maps_cache: merged }, { onConflict: "exam_id" });

    if (upsertErr) return NextResponse.json({ error: upsertErr.message }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("MAP error:", err);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}
