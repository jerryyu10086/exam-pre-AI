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

      const existingCache = (Array.isArray(cached?.maps_cache) ? cached.maps_cache : []) as MapEntry[];

      // 获取当前知识库中存在的非课本文件
      const { data: currentChunks } = await supabase
        .from("chunks")
        .select("file_name")
        .eq("exam_id", exam_id)
        .neq("material_type", "textbook");

      const currentFileNames = new Set(
        (currentChunks ?? []).map((c: { file_name: string }) => c.file_name)
      );

      // 过滤掉已删除文件的缓存条目
      const filteredCache = existingCache.filter((e) => currentFileNames.has(e.file_name));
      const cachedNames = new Set(filteredCache.map((e) => e.file_name));

      // 找出新增文件（在 chunks 但不在过滤后的缓存里）
      const newFileNames = [...currentFileNames].filter((f) => !cachedNames.has(f));

      if (newFileNames.length > 0) {
        const newMapRun = await runMap(supabase, exam_id, newFileNames);
        if (newMapRun.dbError) return NextResponse.json({ error: `数据库查询失败：${newMapRun.dbError}` }, { status: 500 });
        if (newMapRun.failedFiles.length > 0) console.warn(`新文件 MAP 部分失败: ${newMapRun.failedFiles.join("、")}`);
        mapResults = [...filteredCache, ...newMapRun.results];
      } else {
        mapResults = filteredCache;
      }

      // 兜底：缓存为空时全量跑
      if (mapResults.length === 0) {
        const mapRun = await runMap(supabase, exam_id);
        if (mapRun.dbError) return NextResponse.json({ error: `数据库查询失败：${mapRun.dbError}` }, { status: 500 });
        if (mapRun.noChunks) return NextResponse.json({ error: "没有可分析的课件或真题，请先上传并存入知识库" }, { status: 400 });
        if (mapRun.results.length === 0) return NextResponse.json({ error: `AI分析失败（${mapRun.failedFiles.join("、")}），请检查 API Key 或稍后重试` }, { status: 500 });
        mapResults = mapRun.results;
      }
    } else {
      const mapRun = await runMap(supabase, exam_id);
      if (mapRun.dbError) return NextResponse.json({ error: `数据库查询失败：${mapRun.dbError}` }, { status: 500 });
      if (mapRun.noChunks) return NextResponse.json({ error: "没有可分析的课件或真题，请先上传并存入知识库" }, { status: 400 });
      if (mapRun.results.length === 0) return NextResponse.json({ error: `AI分析失败（${mapRun.failedFiles.join("、")}），请检查 API Key 或稍后重试` }, { status: 500 });
      mapResults = mapRun.results;
    }

    // 送 REDUCE 前剥掉 B部分（explanation），只发 A部分给 REDUCE
    const reduceInput = mapResults.map((entry) => {
      if (entry.material_type !== "slides") return entry;
      const data = entry.data as Record<string, unknown>;
      const kps = ((data.knowledge_points ?? []) as Record<string, unknown>[]).map(
        ({ explanation: _e, ...rest }) => rest
      );
      return { ...entry, data: { ...data, knowledge_points: kps } };
    });

    const reducePrompt = buildReducePrompt(JSON.stringify(reduceInput, null, 2), user_context);
    const reduceRaw = await callDeepSeek([{ role: "user", content: reducePrompt }]);
    const planData = extractJSON(reduceRaw) as Record<string, unknown>[];

    // REDUCE 返回后按 id 将 B部分（explanation）从 maps_cache 补回
    const explanationLookup = new Map<string, Map<string, string>>();
    for (const entry of mapResults) {
      if (entry.material_type !== "slides") continue;
      const kps = ((entry.data as Record<string, unknown>).knowledge_points ?? []) as Record<string, unknown>[];
      const fileMap = new Map<string, string>();
      for (const kp of kps) {
        if (kp.id && kp.explanation) fileMap.set(kp.id as string, kp.explanation as string);
      }
      explanationLookup.set(entry.file_name, fileMap);
    }

    const mergedPlanData = planData.map((fileEntry) => {
      const fileMap = explanationLookup.get(fileEntry.file_name as string);
      if (!fileMap) return fileEntry;
      const kps = ((fileEntry.knowledge_points ?? []) as Record<string, unknown>[]).map((kp) => ({
        ...kp,
        explanation: fileMap.get(kp.id as string) ?? "",
      }));
      return { ...fileEntry, knowledge_points: kps };
    });

    const { error: upsertError } = await supabase
      .from("plans")
      .upsert(
        { exam_id, data: mergedPlanData, maps_cache: mapResults },
        { onConflict: "exam_id" }
      );

    if (upsertError) {
      return NextResponse.json({ error: upsertError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, plan: mergedPlanData });
  } catch (err) {
    console.error("Plan generation error:", err);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

type RunMapResult = {
  results: MapEntry[];
  noChunks: boolean;
  dbError: string | null;
  failedFiles: string[];
};

async function runMap(
  supabase: ReturnType<typeof createServiceClient>,
  exam_id: string,
  fileNamesFilter?: string[]
): Promise<RunMapResult> {
  let query = supabase
    .from("chunks")
    .select("file_name, material_type, content, chunk_index, has_answers")
    .eq("exam_id", exam_id)
    .order("chunk_index", { ascending: true });

  if (fileNamesFilter && fileNamesFilter.length > 0) {
    query = query.in("file_name", fileNamesFilter);
  }

  const { data: chunks, error } = await query;

  if (error) {
    console.error("runMap DB error:", error);
    return { results: [], noChunks: false, dbError: error.message, failedFiles: [] };
  }
  if (!chunks || chunks.length === 0) {
    return { results: [], noChunks: true, dbError: null, failedFiles: [] };
  }

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

  const results: MapEntry[] = [];
  const failedFiles: string[] = [];

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
      results.push({ file_name: fileName, material_type, data: mapJson });
    } catch (err) {
      console.error(`MAP failed for ${fileName}:`, err);
      failedFiles.push(fileName);
    }
  }

  return { results, noChunks: false, dbError: null, failedFiles };
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
// GET /api/plan?exam_id=xxx&include_cache=true → { plan: [...] | null, cache_file_names: string[] }
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const examId = searchParams.get("exam_id");
  if (!examId) return NextResponse.json({ error: "缺少 exam_id" }, { status: 400 });
  const supabase = createServiceClient();
  const includeCache = searchParams.get("include_cache") === "true";
  const { data, error } = await supabase
    .from("plans")
    .select(includeCache ? "data, maps_cache" : "data")
    .eq("exam_id", examId)
    .single();
  if (error && error.code !== "PGRST116") {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (includeCache) {
    const cache = data?.maps_cache;
    const cacheFileNames = Array.isArray(cache)
      ? (cache as { file_name: string }[]).map((e) => e.file_name)
      : [];
    return NextResponse.json({ plan: data?.data ?? null, cache_file_names: cacheFileNames });
  }
  return NextResponse.json(data?.data ?? null);
}
