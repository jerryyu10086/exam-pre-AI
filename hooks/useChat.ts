"use client";
import { useState, useCallback, useEffect } from "react";

export type Conversation = {
  id: string;
  title: string;
  created_at: string;
  last_message: string;
};

export type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
};

export function useChat(examId: string, chapterOrder: number) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  const loadConversations = useCallback(async () => {
    const res = await fetch(
      `/api/chat?exam_id=${examId}&chapter_order=${chapterOrder}`
    );
    if (res.ok) setConversations(await res.json());
  }, [examId, chapterOrder]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  const openConversation = useCallback(async (convId: string) => {
    setActiveConvId(convId);
    const res = await fetch(`/api/chat?conversation_id=${convId}`);
    if (res.ok) setMessages(await res.json());
  }, []);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || sending) return;

    setSending(true);
    // 乐观更新：立即显示用户消息
    const optimisticMsg: Message = {
      id: `tmp-${Date.now()}`,
      role: "user",
      content: text,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticMsg]);
    setInput("");

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          exam_id: examId,
          chapter_order: chapterOrder,
          conversation_id: activeConvId,
          message: text,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "发送失败");

      // 如果是新对话，更新 activeConvId 并刷新对话列表
      if (data.is_new) {
        setActiveConvId(data.conversation_id);
        await loadConversations();
      }

      // 追加 AI 回复
      const replyMsg: Message = {
        id: `reply-${Date.now()}`,
        role: "assistant",
        content: data.reply,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, replyMsg]);

      // 刷新对话卡片的 last_message 预览
      await loadConversations();
    } catch (err) {
      // 发送失败：撤销乐观更新
      setMessages((prev) => prev.filter((m) => m.id !== optimisticMsg.id));
      setInput(text);
      console.error("sendMessage error:", err);
    } finally {
      setSending(false);
    }
  }, [input, sending, examId, chapterOrder, activeConvId, loadConversations]);

  const deleteConversations = useCallback(
    async (ids: string[]) => {
      const res = await fetch("/api/chat", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversation_ids: ids }),
      });
      if (!res.ok) return;

      // 若删除的包含当前活跃对话，重置
      if (activeConvId && ids.includes(activeConvId)) {
        setActiveConvId(null);
        setMessages([]);
      }
      await loadConversations();
    },
    [activeConvId, loadConversations]
  );

  const renameConversation = useCallback(async (convId: string, title: string) => {
    await fetch("/api/chat", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversation_id: convId, title }),
    });
    await loadConversations();
  }, [loadConversations]);

  return {
    conversations,
    activeConvId,
    messages,
    input,
    setInput,
    sending,
    openConversation,
    sendMessage,
    deleteConversations,
    renameConversation,
    loadConversations,
  };
}
