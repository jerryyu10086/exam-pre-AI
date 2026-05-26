import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { callDeepSeek } from "@/lib/deepseek";
import { embedBatch } from "@/lib/embeddings";
import { TOP_K } from "@/lib/config";

export const maxDuration = 55;

// GET /api/chat?exam_id=xxx&chapter_order=1  → 列出该章节的对话
// GET /api/chat?conversation_id=yyy          → 获取对话消息列表
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const conversationId = searchParams.get("conversation_id");
  const examId = searchParams.get("exam_id");
  const chapterOrderStr = searchParams.get("chapter_order");

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

  if (examId && chapterOrderStr !== null) {
    const { data, error } = await supabase
      .from("conversations")
      .select("id, title, created_at")
      .eq("exam_id", examId)
      .eq("chapter_order", parseInt(chapterOrderStr))
      .eq("type", "chapter")
      .order("created_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // 为每个对话附上最后一条消息预览
    const result = await Promise.all(
      (data ?? []).map(async (conv) => {
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

// POST /api/chat  → 发送消息（新对话时自动创建）
export async function POST(request: NextRequest) {
  try {
    const { exam_id, chapter_order, conversation_id, message } = await request.json();

    if (!exam_id || chapter_order === undefined || !message?.trim()) {
      return NextResponse.json({ error: "缺少必要字段" }, { status: 400 });
    }

    const supabase = createServiceClient();

    // 1. 获取或新建对话
    let convId: string = conversation_id ?? "";
    let isNew = false;

    if (!convId) {
      const { data: newConv, error: convErr } = await supabase
        .from("conversations")
        .insert({
          exam_id,
          chapter_order,
          type: "chapter",
          title: message.trim().slice(0, 50),
        })
        .select("id")
        .single();

      if (convErr) return NextResponse.json({ error: convErr.message }, { status: 500 });
      convId = newConv.id;
      isNew = true;
    }

    // 2. 保存用户消息
    await supabase.from("messages").insert({
      conversation_id: convId,
      role: "user",
      content: message.trim(),
    });

    // 3. 从 plans.data 直接按 order 取该课件的完整 MAP 数据作为 system context
    const { data: planRow } = await supabase
      .from("plans")
      .select("data")
      .eq("exam_id", exam_id)
      .single();

    const files = Array.isArray(planRow?.data) ? planRow.data : [];
    const fileEntry = files.find(
      (f: { order: number; file_name: string }) => f.order === chapter_order
    ) ?? null;

    // 4. RAG：向量化查询 → 只检索本章对应文件的 chunks
    const [queryEmbedding] = await embedBatch([message]);
    const { data: chunks } = await supabase.rpc("match_chunks", {
      query_embedding: queryEmbedding,
      match_exam_id: exam_id,
      match_file_names: fileEntry?.file_name ? [fileEntry.file_name] : null,
      match_count: TOP_K,
    });

    const retrievedContext = ((chunks as { content: string; file_name: string }[]) ?? [])
      .map((c) => `[来源: ${c.file_name}]\n${c.content}`)
      .join("\n\n---\n\n");

    // 章节脉络上下文：REDUCE 输出的 chapter_summary 与 key_focus 概念名
    const fileEntryRec = fileEntry as Record<string, unknown> | null;
    const chapterSummary = (fileEntryRec?.chapter_summary as string | undefined) ?? "";
    const keyFocusIds = (fileEntryRec?.key_focus as string[] | undefined) ?? [];
    const kpsArr = (fileEntryRec?.knowledge_points as Record<string, unknown>[] | undefined) ?? [];
    const keyFocusNames = keyFocusIds
      .map((id) => kpsArr.find((kp) => kp.id === id)?.concept as string | undefined)
      .filter((n): n is string => typeof n === "string" && n.length > 0);
    const chapterCtxBlock =
      chapterSummary || keyFocusNames.length > 0
        ? `\n本章脉络：${chapterSummary || "（未生成）"}${
            keyFocusNames.length > 0 ? `\n本章重点：${keyFocusNames.join("、")}` : ""
          }\n`
        : "";

    // 知识点序号对照表（按 kp_N 数字升序排列，给 AI 用于引用）
    const sortedKps = [...kpsArr].sort((a, b) => {
      const ai = parseInt(String(a.id ?? "").replace("kp_", ""), 10);
      const bi = parseInt(String(b.id ?? "").replace("kp_", ""), 10);
      return ai - bi;
    });
    const kpTableLines = sortedKps
      .map((kp, i) => `${i + 1}. ${kp.concept as string}`)
      .join("\n");
    const kpTableBlock = sortedKps.length > 0
      ? `\n知识点序号列表（引用时请使用此序号）：\n${kpTableLines}\n`
      : "";

    const systemPrompt = `你是课件答疑助手，基于以下检索内容和课件知识库回答问题。
${chapterCtxBlock}${kpTableBlock}
规则：
1. 检索内容不足时，明确告知"该问题在课件中只有部分覆盖"
2. 引用时标注来源文件名或章节位置
3. 涉及本章未提及内容时，提示"建议查看其他课件"
4. 优先基于检索内容回答，避免凭空发挥
5. 所有数学公式使用 $（行内）或 $$（独立行）标注，不使用其他括号形式
6. 引用知识点时，使用格式「（序号. 概念名）」，例如「（3. 库仑定律）」，不要使用 kp_N 格式

课件知识库（完整原始内容，含所有知识点、易混淆点、记忆锚点）：
${JSON.stringify(fileEntry ?? {}, null, 2)}

检索到的相关内容：
${retrievedContext || "（未检索到相关内容）"}`;

    // 5. 加载历史消息（不含 system）
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

    // 6. 调用 DeepSeek
    const reply = await callDeepSeek(llmMessages);

    // 7. 保存 assistant 消息
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
    });
  } catch (err) {
    console.error("Chat error:", err);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

// DELETE /api/chat  → 删除对话（消息 cascade 删除）
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
  } catch (err) {
    console.error("Delete chat error:", err);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

// PATCH /api/chat  → 重命名对话
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
  } catch (err) {
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}
