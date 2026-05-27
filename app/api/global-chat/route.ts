import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { callDeepSeek } from "@/lib/deepseek";
import { embedBatch } from "@/lib/embeddings";
import {
  GLOBAL_QA_TOP_CHAPTERS,
  ROUTE_CONFIDENCE_THRESHOLD,
  TOP_K,
} from "@/lib/config";

export const maxDuration = 55;

type KnowledgePoint = {
  id: string;
  tier: string;
  concept: string;
  knowledge?: string;
  source?: string;
  explanation?: string;
  section_number?: string;
  section_name?: string;
  tier_rationale?: string;
};

type Chapter = {
  file_name: string;
  display_name: string;
  order: number;
  knowledge_points: KnowledgePoint[];
  chapter_summary?: string;
  key_focus?: string[];
};

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

// GET /api/global-chat?exam_id=xxx  → 列出全局对话
// GET /api/global-chat?conversation_id=yyy → 获取消息列表
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const conversationId = searchParams.get("conversation_id");
  const examId = searchParams.get("exam_id");
  const supabase = createServiceClient();

  if (conversationId) {
    const { data, error } = await supabase
      .from("messages")
      .select("id, role, content, created_at")
      .eq("conversation_id", conversationId)
      .neq("role", "system")
      .order("created_at", { ascending: true });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data ?? []);
  }

  if (examId) {
    const { data: convs, error } = await supabase
      .from("conversations")
      .select("id, title, created_at")
      .eq("exam_id", examId)
      .eq("type", "global")
      .order("created_at", { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const result = await Promise.all(
      (convs ?? []).map(async (conv) => {
        const { data: lastMsg } = await supabase
          .from("messages")
          .select("content")
          .eq("conversation_id", conv.id)
          .neq("role", "system")
          .order("created_at", { ascending: false })
          .limit(1)
          .single();
        return { ...conv, last_message: lastMsg?.content?.slice(0, 60) ?? "" };
      })
    );
    return NextResponse.json(result);
  }

  return NextResponse.json({ error: "缺少参数" }, { status: 400 });
}

// POST /api/global-chat  → Agent 路由 + 发送消息
export async function POST(request: NextRequest) {
  try {
    const { exam_id, conversation_id, message } = await request.json();
    if (!exam_id || !message?.trim()) {
      return NextResponse.json({ error: "缺少必要字段" }, { status: 400 });
    }

    const supabase = createServiceClient();

    // 1. 读取复习计划（所有章节）
    const { data: planRow, error: planErr } = await supabase
      .from("plans")
      .select("data")
      .eq("exam_id", exam_id)
      .single();

    if (planErr || !planRow) {
      return NextResponse.json(
        { error: "暂无复习计划，请先完成解析" },
        { status: 400 }
      );
    }

    // V1：plans.data 末尾的 __overall_framework__ 是元数据条目，不参与章节路由
    const chapters: Chapter[] = (Array.isArray(planRow.data) ? planRow.data : [])
      .filter((e: Record<string, unknown>) => "file_name" in e && Array.isArray(e.knowledge_points));
    if (chapters.length === 0) {
      return NextResponse.json({ error: "复习计划为空" }, { status: 400 });
    }

    // 2. Agent 路由：embedding 问题 + 各章摘要，取 top-3
    const chapterSummaries = chapters.map(
      (ch) =>
        `${ch.display_name}：${ch.knowledge_points.map((kp) => kp.concept).join("、")}`
    );

    const allEmbeddings = await embedBatch([message.trim(), ...chapterSummaries]);
    const questionEmbedding = allEmbeddings[0];
    const chapterEmbeddings = allEmbeddings.slice(1);

    const scored = chapters.map((ch, i) => ({
      ch,
      score: cosineSimilarity(questionEmbedding, chapterEmbeddings[i]),
    }));
    scored.sort((a, b) => b.score - a.score);

    const aboveThreshold = scored.filter((x) => x.score >= ROUTE_CONFIDENCE_THRESHOLD);
    const isFallback = aboveThreshold.length === 0;
    const selected = (isFallback ? scored : aboveThreshold).slice(0, GLOBAL_QA_TOP_CHAPTERS);

    const loadedChapterNames = selected.map((x) => x.ch.display_name);
    const selectedFileNames = selected.map((x) => x.ch.file_name).filter(Boolean);

    // 3. RAG：只搜命中章节对应文件的 chunks（复用已有 questionEmbedding）
    const { data: chunks } = await supabase.rpc("match_chunks", {
      query_embedding: questionEmbedding,
      match_exam_id: exam_id,
      match_file_names: selectedFileNames.length > 0 ? selectedFileNames : null,
      match_count: TOP_K,
    });

    const retrievedContext = ((chunks as { content: string; file_name: string }[]) ?? [])
      .map((c) => `[来源: ${c.file_name}]\n${c.content}`)
      .join("\n\n---\n\n");

    // 4. 构建 system prompt
    const contextText = selected
      .map(
        (x) =>
          `## ${x.ch.display_name}\n${JSON.stringify(
            x.ch.knowledge_points,
            null,
            2
          )}`
      )
      .join("\n\n");

    // 各章节 kp 序号对照表（每章独立 1-based，按 kp_id 数字升序）
    const kpTablesBlock = selected
      .map((x) => {
        const sorted = [...x.ch.knowledge_points].sort((a, b) => {
          const ai = parseInt(String(a.id ?? "").replace("kp_", ""), 10);
          const bi = parseInt(String(b.id ?? "").replace("kp_", ""), 10);
          return ai - bi;
        });
        const lines = sorted.map((kp, i) => `${i + 1}. ${kp.concept}`).join("\n");
        return `【${x.ch.display_name}】知识点序号列表：\n${lines}`;
      })
      .join("\n\n");

    const systemPrompt = `你是备考问答助手，基于以下章节内容回答跨章节问题。

已加载章节：${loadedChapterNames.join("、")}

${kpTablesBlock}

规则：
1. 优先基于以下章节内容回答，引用时注明章节来源
2. 若问题超出已加载章节范围，建议"在对应章节详情页的章节对话中提问"
3. 不要凭空发挥超出课件范围的内容
4. 所有数学公式使用 $（行内）或 $$（独立行）标注，不使用其他括号形式；**公式内所有 LaTeX 命令都必须以反斜杠开头**，常见命令如 \\times、\\cdot、\\pm、\\frac{a}{b}、\\sqrt{x}、\\sum、\\int、\\text{C}、\\alpha、\\beta、\\theta、\\lambda、\\sigma、\\ldots、\\cdots、\\leq、\\geq、\\neq、\\approx、\\in 等；**严禁任何裸写形式**（如写 pm 1、ldots、times、cdot、frac、sqrt、text 都是错的，必须写成 \\pm 1、\\ldots、\\times、\\cdot、\\frac、\\sqrt、\\text）；即使 PDF 原文用 × ± · … 等符号，输出时也要转写为对应 LaTeX 命令
5. 引用知识点时，注明章节并使用格式「（整数序号. 概念名）」，序号取对应章节列表中的整数，概念名写在括号内，如「在第10章（3. 库仑定律）」；不要使用 kp_N 格式；不要使用小节号（如 1.3、3.1）作为序号

章节知识库（MAP 结构化内容）：
${contextText}

检索到的相关原文：
${retrievedContext || "（未检索到相关内容）"}`;

    // 5. 获取或新建对话
    let convId: string = conversation_id ?? "";
    let isNew = false;

    if (!convId) {
      const { data: newConv, error: convErr } = await supabase
        .from("conversations")
        .insert({
          exam_id,
          type: "global",
          title: message.trim().slice(0, 50),
        })
        .select("id")
        .single();

      if (convErr) return NextResponse.json({ error: convErr.message }, { status: 500 });
      convId = newConv.id;
      isNew = true;
    }

    // 6. 保存用户消息
    await supabase.from("messages").insert({
      conversation_id: convId,
      role: "user",
      content: message.trim(),
    });

    // 7. 加载历史消息
    const { data: history } = await supabase
      .from("messages")
      .select("role, content")
      .eq("conversation_id", convId)
      .neq("role", "system")
      .order("created_at", { ascending: true });

    const llmMessages = [
      { role: "system" as const, content: systemPrompt },
      ...((history ?? []) as { role: string; content: string }[]).map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    ];

    // 8. 调用 DeepSeek
    const reply = await callDeepSeek(llmMessages);

    // 9. 保存 assistant 消息
    await supabase.from("messages").insert({
      conversation_id: convId,
      role: "assistant",
      content: reply,
    });

    return NextResponse.json({
      conversation_id: convId,
      is_new: isNew,
      title: isNew ? message.trim().slice(0, 50) : undefined,
      reply,
      loaded_chapters: loadedChapterNames,
      is_fallback: isFallback,
    });
  } catch (err) {
    console.error("Global chat error:", err);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

// DELETE /api/global-chat  → 删除对话
export async function DELETE(request: NextRequest) {
  try {
    const { conversation_ids } = await request.json();
    if (!Array.isArray(conversation_ids) || conversation_ids.length === 0) {
      return NextResponse.json({ error: "缺少 conversation_ids" }, { status: 400 });
    }
    const supabase = createServiceClient();
    const { error } = await supabase
      .from("conversations")
      .delete()
      .in("id", conversation_ids);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

// PATCH /api/global-chat  → 重命名对话
export async function PATCH(request: NextRequest) {
  try {
    const { conversation_id, title } = await request.json();
    if (!conversation_id || !title?.trim()) {
      return NextResponse.json({ error: "缺少参数" }, { status: 400 });
    }
    const supabase = createServiceClient();
    const { error } = await supabase
      .from("conversations")
      .update({ title: title.trim() })
      .eq("id", conversation_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}
