import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { callDeepSeek, extractJSON } from "@/lib/deepseek";
import { buildReducePrompt } from "@/lib/prompts";
import { DEEPSEEK_REDUCE_MODEL } from "@/lib/config";

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

    // V1：只保留当前课件 chunks 中存在的条目（真题不参与 REDUCE，旧版残留的真题 MAP 缓存一并过滤）
    const { data: currentChunks } = await supabase
      .from("chunks")
      .select("file_name")
      .eq("exam_id", exam_id)
      .eq("material_type", "slides");

    const currentFileNames = new Set(
      (currentChunks ?? []).map((c: { file_name: string }) => c.file_name)
    );

    const mapResults = (Array.isArray(cached?.maps_cache) ? cached.maps_cache : [])
      .filter((e: MapEntry) =>
        e.material_type === "slides" && currentFileNames.has(e.file_name)
      ) as MapEntry[];

    if (mapResults.length === 0) {
      return NextResponse.json({ error: "没有可分析的课件，请至少上传一份课件" }, { status: 400 });
    }

    // 送 REDUCE 前剥掉 B部分（explanation），只发 A部分给 REDUCE（mapResults 已保证全是 slides）
    const reduceInput = mapResults.map((entry) => {
      const data = entry.data as Record<string, unknown>;
      const kps = ((data.knowledge_points ?? []) as Record<string, unknown>[]).map(
        ({ explanation: _e, ...rest }) => rest
      );
      return { ...entry, data: { ...data, knowledge_points: kps } };
    });

    // 诊断：MAP 输入到 REDUCE 的每个文件的知识点数
    for (const e of reduceInput) {
      const kpCount = ((e.data as Record<string, unknown>).knowledge_points as unknown[] | undefined)?.length ?? 0;
      console.log(`[REDUCE 输入] ${e.file_name} → ${kpCount} 个 MAP 知识点`);
    }

    const reduceRaw = await callDeepSeek(
      [{ role: "user", content: buildReducePrompt(JSON.stringify(reduceInput, null, 2), user_context) }],
      { model: DEEPSEEK_REDUCE_MODEL, thinking: true },
    );
    console.log(`[REDUCE 输出] raw=${reduceRaw.length}字符 ${reduceRaw.trim().endsWith("`") || reduceRaw.trim().endsWith("]") ? "完整" : "可能截断"}`);
    const planDataRaw = extractJSON(reduceRaw);
    if (!Array.isArray(planDataRaw) || planDataRaw.length === 0) {
      console.error("REDUCE 结果不是数组，末尾500字符：", reduceRaw.slice(-500));
      return NextResponse.json({ error: "分析结果解析失败，请重试" }, { status: 500 });
    }

    // REDUCE 末尾会带 __overall_framework__ 元素（无 file_name），先分离出来留作 plan 末尾
    const isFrameworkEntry = (e: Record<string, unknown>): boolean =>
      "__overall_framework__" in e && !("file_name" in e);
    const planDataArr = planDataRaw as Record<string, unknown>[];
    const fileEntriesRaw = planDataArr.filter((e) => !isFrameworkEntry(e));
    const frameworkEntries = planDataArr.filter(isFrameworkEntry);

    // 诊断：REDUCE 输出每个 file 的 tier 分配数（与上面 MAP 输入对比可判断是否漏 kp）
    for (const fe of fileEntriesRaw) {
      const kpCount = (fe.knowledge_points as unknown[] | undefined)?.length ?? 0;
      console.log(`[REDUCE 输出] ${fe.file_name} → 分配 ${kpCount} 个知识点档位`);
    }

    // REDUCE 只输出 tier+tier_rationale（id 级），在此合并回 MAP 完整知识点内容（concept/knowledge/source/section_*）
    const coveredFiles = new Set(fileEntriesRaw.map((e) => e.file_name as string));
    const planData = fileEntriesRaw.map((fileEntry) => {
      const mapEntry = reduceInput.find(
        (e) => e.file_name === (fileEntry.file_name as string) && e.material_type === "slides"
      );
      if (!mapEntry) return fileEntry;

      const fullKps = ((mapEntry.data as Record<string, unknown>).knowledge_points ?? []) as Record<string, unknown>[];
      const tierMap = new Map<string, { tier: string; tier_rationale?: string }>();
      for (const kp of ((fileEntry.knowledge_points ?? []) as Record<string, unknown>[])) {
        if (kp.id) {
          tierMap.set(kp.id as string, {
            tier: (kp.tier as string) ?? "拓展",
            tier_rationale: kp.tier_rationale as string | undefined,
          });
        }
      }

      const mergedKps = fullKps.map((kp) => {
        const info = tierMap.get(kp.id as string);
        return {
          ...kp,
          tier: info?.tier ?? "拓展",
          ...(info?.tier_rationale ? { tier_rationale: info.tier_rationale } : {}),
        };
      });

      // 新字段兜底：REDUCE 偶尔会漏 chapter_summary / key_focus，给空值默认值
      return {
        ...fileEntry,
        chapter_summary: (fileEntry.chapter_summary as string) ?? "",
        key_focus: Array.isArray(fileEntry.key_focus) ? fileEntry.key_focus : [],
        knowledge_points: mergedKps,
      };
    });

    // Phase 2 被截断时部分文件缺失 → 用全拓展/低频作为兜底补全，确保所有课件都出现在结果里
    const missingEntries = reduceInput
      .filter((e) => e.material_type === "slides" && !coveredFiles.has(e.file_name))
      .map((e, idx) => {
        const fullKps = ((e.data as Record<string, unknown>).knowledge_points ?? []) as Record<string, unknown>[];
        return {
          file_name: e.file_name,
          display_name: (e.data as Record<string, unknown>).display_name ?? e.file_name.replace(/\.[^.]+$/, ""),
          order: planData.length + idx + 1,
          chapter_summary: "",
          key_focus: [] as string[],
          knowledge_points: fullKps.map((kp) => ({ ...kp, tier: "拓展" })),
        };
      });
    if (missingEntries.length > 0) {
      console.warn(`REDUCE截断兜底：补全 ${missingEntries.length} 个缺失文件（全拓展/低频）`);
    }
    // 最终顺序：文件条目 + 兜底条目 + framework 末尾元素（数组末尾特殊条目，UI 渲染时 filter）
    const allPlanData = [...planData, ...missingEntries, ...frameworkEntries];

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

    const mergedPlanData = allPlanData.map((fileEntry) => {
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
    // slides 条目必须有非空 knowledge_points 才算有效缓存；空的条目重新 MAP
    // V1 升级：旧版 MAP 输出缺 section_number 字段，视为过期强制重 MAP
    const cacheFileNames = Array.isArray(cache)
      ? (cache as { file_name: string; material_type: string; data?: Record<string, unknown> }[])
          .filter((e) => {
            if (e.material_type !== "slides") return true;
            const kps = (e.data?.knowledge_points as Record<string, unknown>[] | undefined) ?? [];
            if (kps.length === 0) return false;
            // 任一知识点缺 section_number 即视为旧版缓存
            return kps.every((kp) => typeof kp.section_number === "string" && kp.section_number.length > 0);
          })
          .map((e) => e.file_name)
      : [];
    return NextResponse.json({ plan: data?.data ?? null, cache_file_names: cacheFileNames });
  }
  return NextResponse.json(data?.data ?? null);
}
