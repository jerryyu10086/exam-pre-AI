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

// POST /api/plan/map — 对单个文件跑 MAP，只返回结果，不写库
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
      return NextResponse.json({ success: true, result: null });
    }

    // V1：真题不参与 REDUCE，跳过 LLM 调用；UI 仍可上传/删除/切换 has_answers
    if (material_type === "exam") {
      return NextResponse.json({ success: true, result: null });
    }

    // 新上传课件的 chunk content 已带 [第X页] marker（chunkSlides 注入）
    // 旧数据没有 marker → fallback 用 chunk_index+1 兜底（合并页时可能偏移，建议用户重新上传以获得准确页码）
    const fullText = rows
      .sort((a, b) => a.chunk_index - b.chunk_index)
      .map((r) => {
        const content = r.content;
        if (/^\[第[\d、\-]+页\]/.test(content.trim())) return content;
        return `[第${r.chunk_index + 1}页]\n${content}`;
      })
      .join("\n\n");

    let prompt: string;
    if (material_type === "slides") {
      prompt = buildMapSlidesPrompt(fullText);
    } else {
      // V1 流程下走不到此分支（textbook/exam 已短路），保留兜底
      prompt = has_answers !== false
        ? buildMapExamWithAnswersPrompt(fullText)
        : buildMapExamNoAnswersPrompt(fullText);
    }

    const raw = await callDeepSeek([{ role: "user", content: prompt }], { json_mode: true });
    const mapJson = extractJSON(raw) as Record<string, unknown>;
    const kpCount = (mapJson.knowledge_points as unknown[] | undefined)?.length ?? 0;
    console.log(`[MAP ${file_name}] 输入${fullText.length}字符 → 输出${raw.length}字符 ${raw.trim().endsWith("}") ? "完整" : "可能截断"} → 提取${kpCount}个知识点`);
    const result: MapEntry = { file_name, material_type, data: mapJson };

    return NextResponse.json({ success: true, result });
  } catch (err) {
    console.error("MAP error:", err);
    const msg = err instanceof Error ? err.message : "服务器错误";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// PATCH /api/plan/map — 将一批 MAP 结果原子写入 maps_cache
export async function PATCH(request: NextRequest) {
  try {
    const { exam_id, entries } = await request.json() as {
      exam_id: string;
      entries: MapEntry[];
    };
    if (!exam_id || !Array.isArray(entries) || entries.length === 0) {
      return NextResponse.json({ error: "缺少 exam_id 或 entries" }, { status: 400 });
    }

    const supabase = createServiceClient();

    const { data: existing } = await supabase
      .from("plans")
      .select("maps_cache")
      .eq("exam_id", exam_id)
      .single();

    const existingCache = (Array.isArray(existing?.maps_cache) ? existing.maps_cache : []) as MapEntry[];
    const newNames = new Set(entries.map((e) => e.file_name));
    const merged = [
      ...existingCache.filter((e) => !newNames.has(e.file_name)),
      ...entries,
    ];

    const { data: updated, error: updateErr } = await supabase
      .from("plans")
      .update({ maps_cache: merged })
      .eq("exam_id", exam_id)
      .select("id");

    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

    if (!updated || updated.length === 0) {
      const { error: insertErr } = await supabase
        .from("plans")
        .insert({ exam_id, maps_cache: merged, data: [] });
      if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("MAP PATCH error:", err);
    const msg = err instanceof Error ? err.message : "服务器错误";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
