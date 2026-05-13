import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { callDeepSeek, extractJSON } from "@/lib/deepseek";
import {
  buildMapSlidesPrompt,
  buildMapExamWithAnswersPrompt,
  buildMapExamNoAnswersPrompt,
  buildReducePrompt,
} from "@/lib/prompts";

// 长时间运行 - 本地开发无限制；Vercel 需升级 Pro 或做流式化
export const maxDuration = 60;

type ChunkRow = {
  file_name: string;
  material_type: string;
  content: string;
  chunk_index: number;
};

// POST /api/plan  —  触发 MAP + REDUCE，存入 plans 表
export async function POST(request: NextRequest) {
  try {
    const { exam_id, exam_has_answers } = await request.json();
    if (!exam_id) {
      return NextResponse.json({ error: "缺少 exam_id" }, { status: 400 });
    }

    const supabase = createServiceClient();

    // 1. 读取该考试所有 chunks
    const { data: chunks, error: chunksError } = await supabase
      .from("chunks")
      .select("file_name, material_type, content, chunk_index")
      .eq("exam_id", exam_id)
      .order("chunk_index", { ascending: true });

    if (chunksError) {
      return NextResponse.json({ error: chunksError.message }, { status: 500 });
    }

    if (!chunks || chunks.length === 0) {
      return NextResponse.json({ error: "该考试暂无已上传材料" }, { status: 400 });
    }

    // 2. 按 file_name 分组，重建各文件完整文本
    const fileMap = new Map<
      string,
      { material_type: string; rows: ChunkRow[] }
    >();
    for (const row of chunks as ChunkRow[]) {
      if (!fileMap.has(row.file_name)) {
        fileMap.set(row.file_name, { material_type: row.material_type, rows: [] });
      }
      fileMap.get(row.file_name)!.rows.push(row);
    }

    // 3. 对每份课件/真题跑 MAP
    const mapResults: unknown[] = [];
    for (const [fileName, { material_type, rows }] of fileMap.entries()) {
      if (material_type === "textbook") continue; // 课本只做 Embedding，不 MAP

      const fullText = rows
        .sort((a, b) => a.chunk_index - b.chunk_index)
        .map((r) => r.content)
        .join("\n");

      let prompt: string;
      if (material_type === "slides") {
        prompt = buildMapSlidesPrompt(fullText);
      } else {
        prompt = exam_has_answers
          ? buildMapExamWithAnswersPrompt(fullText)
          : buildMapExamNoAnswersPrompt(fullText);
      }

      try {
        const raw = await callDeepSeek([{ role: "user", content: prompt }]);
        const mapJson = extractJSON(raw);
        mapResults.push({ file_name: fileName, material_type, data: mapJson });
      } catch (err) {
        console.error(`MAP failed for ${fileName}:`, err);
        // 单文件失败不中断整体流程
      }
    }

    if (mapResults.length === 0) {
      return NextResponse.json(
        { error: "没有可分析的课件或真题，请先上传并存入知识库" },
        { status: 400 }
      );
    }

    // 4. REDUCE：综合所有 MAP 输出，生成分层复习计划
    const reducePrompt = buildReducePrompt(JSON.stringify(mapResults, null, 2));
    const reduceRaw = await callDeepSeek([{ role: "user", content: reducePrompt }]);
    const planData = extractJSON(reduceRaw);

    // 5. Upsert 到 plans 表（重新解析时覆盖旧结果）
    const { error: upsertError } = await supabase
      .from("plans")
      .upsert({ exam_id, data: planData }, { onConflict: "exam_id" });

    if (upsertError) {
      return NextResponse.json({ error: upsertError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, plan: planData });
  } catch (err) {
    console.error("Plan generation error:", err);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

// PATCH /api/plan  —  直接写入 plan 数据，不跑 AI（用于取消时恢复旧数据）
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
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Plan restore error:", err);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

// DELETE /api/plan?exam_id=xxx  —  删除已生成的复习计划（用户取消解析时调用）
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const examId = searchParams.get("exam_id");
  if (!examId) {
    return NextResponse.json({ error: "缺少 exam_id" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { error } = await supabase
    .from("plans")
    .delete()
    .eq("exam_id", examId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

// GET /api/plan?exam_id=xxx  —  读取已生成的复习计划
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const examId = searchParams.get("exam_id");
  if (!examId) {
    return NextResponse.json({ error: "缺少 exam_id" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("plans")
    .select("data")
    .eq("exam_id", examId)
    .single();

  if (error && error.code !== "PGRST116") {
    // PGRST116 = no rows found，正常情况
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data?.data ?? null);
}
