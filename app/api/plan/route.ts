import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { callDeepSeek, extractJSON } from "@/lib/deepseek";
import {
  buildMapSlidesPrompt,
  buildMapExamWithAnswersPrompt,
  buildMapExamNoAnswersPrompt,
  buildReducePrompt,
} from "@/lib/prompts";

export const maxDuration = 60;

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

// POST /api/plan — MAP（首次）或跳过MAP（重新解析）+ REDUCE
export async function POST(request: NextRequest) {
  try {
    const { exam_id, user_context, reanalysis } = await request.json();
    if (!exam_id) {
      return NextResponse.json({ error: "缺少 exam_id" }, { status: 400 });
    }

    const supabase = createServiceClient();
    let mapResults: MapEntry[];

    if (reanalysis) {
      const { data: cached } = await supabase
        .from("plans")
        .select("maps_cache")
        .eq("exam_id", exam_id)
        .single();

      const raw = cached?.maps_cache;
      if (Array.isArray(raw) && raw.length > 0) {
        mapResults = raw as MapEntry[];
      } else {
        mapResults = await runMap(supabase, exam_id);
      }
    } else {
      mapResults = await runMap(supabase, exam_id);
    }

    if (mapResults.length === 0) {
      return NextResponse.json(
        { error: "没有可分析的课件或真题，请先上传并存入知识库" },
        { status: 400 }
      );
    }

    const reducePrompt = buildReducePrompt(JSON.stringify(mapResults, null, 2), user_context);
    const reduceRaw = await callDeepSeek([{ role: "user", content: reducePrompt }]);
    const planData = extractJSON(reduceRaw);

    const { error: upsertError } = await supabase
      .from("plans")
      .upsert(
        { exam_id, data: planData, maps_cache: mapResults },
        { onConflict: "exam_id" }
      );

    if (upsertError) {
      return NextResponse.json({ error: upsertError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, plan: planData });
  } catch (err) {
    console.error("Plan generation error:", err);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

async function runMap(
  supabase: ReturnType<typeof createServiceClient>,
  exam_id: string
): Promise<MapEntry[]> {
  const { data: chunks, error } = await supabase
    .from("chunks")
    .select("file_name, material_type, content, chunk_index, has_answers")
    .eq("exam_id", exam_id)
    .order("chunk_index", { ascending: true });

  if (error || !chunks || chunks.length === 0) return [];

  const fileMap = new Map<
    string,
    { material_type: string; has_answers: boolean | null; rows: ChunkRow[] }
  >();
  for (const row of chunks as ChunkRow[]) {
    if (!fileMap.has(row.file_name)) {
      fileMap.set(row.file_name, {
        material_type: row.material_type,
        has_answers: row.has_answers ?? null,
        rows: [],
      });
    }
    fileMap.get(row.file_name)!.rows.push(row);
  }

  const mapResults: MapEntry[] = [];
  for (const [fileName, { material_type, has_answers, rows }] of fileMap.entries()) {
    if (material_type === "textbook") continue;

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

    try {
      const raw = await callDeepSeek([{ role: "user", content: prompt }]);
      const mapJson = extractJSON(raw) as Record<string, unknown>;
      mapResults.push({ file_name: fileName, material_type, data: mapJson });
    } catch (err) {
      console.error(`MAP failed for ${fileName}:`, err);
    }
  }

  return mapResults;
}

// PATCH /api/plan — 直接写入 plan 数据（取消时恢复旧数据）
export async function PATCH(request: NextRequest) {
  try {
    const { exam_id, data } = await request.json();
    if (!exam_id || !data) {
      return NextResponse.json({ error: "缺少 exam_id 或 data" }, { status: 400 });
    }
    const supabase = createServiceClient();
    const { error } = await supabase
      .from("plans")
      .upsert({ exam_id, data }, { onConflict: "exam_id" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Plan restore error:", err);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

// DELETE /api/plan?exam_id=xxx
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const examId = searchParams.get("exam_id");
  if (!examId) return NextResponse.json({ error: "缺少 exam_id" }, { status: 400 });
  const supabase = createServiceClient();
  const { error } = await supabase.from("plans").delete().eq("exam_id", examId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

// GET /api/plan?exam_id=xxx
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const examId = searchParams.get("exam_id");
  if (!examId) return NextResponse.json({ error: "缺少 exam_id" }, { status: 400 });
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("plans")
    .select("data")
    .eq("exam_id", examId)
    .single();
  if (error && error.code !== "PGRST116") {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data?.data ?? null);
}
