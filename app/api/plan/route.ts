import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { callDeepSeek, extractJSON } from "@/lib/deepseek";
import { buildReducePrompt } from "@/lib/prompts";

export const maxDuration = 55;

type MapEntry = {
  file_name: string;
  material_type: string;
  data: Record<string, unknown>;
};

// POST /api/plan — 读取 maps_cache 直接跑 REDUCE，生成复习计划
// MAP 阶段已由前端逐文件调用 /api/plan/map 完成
export async function POST(request: NextRequest) {
  try {
    const { exam_id, user_context } = await request.json();
    if (!exam_id) {
      return NextResponse.json({ error: "缺少 exam_id" }, { status: 400 });
    }

    const supabase = createServiceClient();

    const { data: cached, error: cacheErr } = await supabase
      .from("plans")
      .select("maps_cache")
      .eq("exam_id", exam_id)
      .single();

    if (cacheErr && cacheErr.code !== "PGRST116") {
      return NextResponse.json({ error: cacheErr.message }, { status: 500 });
    }

    // 过滤掉已从知识库删除的文件，只保留当前 chunks 中存在的条目
    const { data: currentChunks } = await supabase
      .from("chunks")
      .select("file_name")
      .eq("exam_id", exam_id)
      .neq("material_type", "textbook");

    const currentFileNames = new Set(
      (currentChunks ?? []).map((c: { file_name: string }) => c.file_name)
    );

    const mapResults = (Array.isArray(cached?.maps_cache) ? cached.maps_cache : [])
      .filter((e: MapEntry) => currentFileNames.has(e.file_name)) as MapEntry[];

    if (mapResults.length === 0) {
      return NextResponse.json({ error: "没有可分析的课件或真题，请先上传并存入知识库" }, { status: 400 });
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
    const planDataRaw = extractJSON(reduceRaw);
    if (!Array.isArray(planDataRaw) || planDataRaw.length === 0) {
      console.error("REDUCE 结果不是数组，原始内容片段：", reduceRaw.slice(0, 500));
      return NextResponse.json({ error: "分析结果解析失败，请重试" }, { status: 500 });
    }
    const planData = planDataRaw as Record<string, unknown>[];

    // REDUCE 完成后按 id 将 B部分（explanation）从 maps_cache 补回
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
      .upsert({ exam_id, data: mergedPlanData, maps_cache: mapResults }, { onConflict: "exam_id" });

    if (upsertError) {
      return NextResponse.json({ error: upsertError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, plan: mergedPlanData });
  } catch (err) {
    console.error("Plan generation error:", err);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("plans")
    .select(includeCache ? "data, maps_cache" : "data")
    .eq("exam_id", examId)
    .single() as { data: { data?: unknown; maps_cache?: unknown } | null; error: { code: string; message: string } | null };
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
