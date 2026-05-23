"use client";
import { useState, useCallback, useEffect, useRef } from "react";

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
  const [sending, setSending] = useState(false);

  // 只在首次加载时自动打开最近的对话，后续刷新列表不再重置
  const initialLoadDone = useRef(false);

  const loadConversations = useCallback(async () => {
    const res = await fetch(
      `/api/chat?exam_id=${examId}&chapter_order=${chapterOrder}`
    );
    if (!res.ok) return;
    const data: Conversation[] = await res.json();
    setConversations(data);

    // 首次加载：自动打开最近一条对话（如有），之后不再自动切换
    if (!initialLoadDone.current) {
      initialLoadDone.current = true;
      if (data.length > 0) {
        const latest = data[0];
        setActiveConvId(latest.id);
        const msgRes = await fetch(`/api/chat?conversation_id=${latest.id}`);
        if (msgRes.ok) setMessages(await msgRes.json());
      }
    }
  }, [examId, chapterOrder]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // 切换到某个已有对话
  const openConversation = useCallback(async (convId: string) => {
    setActiveConvId(convId);
    const res = await fetch(`/api/chat?conversation_id=${convId}`);
    if (res.ok) setMessages(await res.json());
  }, []);

  // 重置为空白状态（下一次发送会自动新建对话）
  const resetConversation = useCallback(() => {
    setActiveConvId(null);
    setMessages([]);
  }, []);

  // 返回 true=成功，false=失败（调用方负责还原 input）
  const sendMessage = useCallback(async (text: string): Promise<boolean> => {
    if (!text.trim() || sending) return false;

    setSending(true);
    const optimisticMsg: Message = {
      id: `tmp-${Date.now()}`,
      role: "user",
      content: text,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticMsg]);

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

      if (data.is_new) {
        setActiveConvId(data.conversation_id);
      }

      setMessages((prev) => [...prev, {
        id: `reply-${Date.now()}`,
        role: "assistant",
        content: data.reply,
        created_at: new Date().toISOString(),
      }]);

      await loadConversations();
      return true;
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m.id !== optimisticMsg.id));
      console.error("sendMessage error:", err);
      return false;
    } finally {
      setSending(false);
    }
  }, [sending, examId, chapterOrder, activeConvId, loadConversations]);

  const deleteConversations = useCallback(
    async (ids: string[]) => {
      const res = await fetch("/api/chat", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversation_ids: ids }),
      });
      if (!res.ok) return;

      if (activeConvId && ids.includes(activeConvId)) {
        setActiveConvId(null);
        setMessages([]);
      }
      await loadConversations();
    },
    [activeConvId, loadConversations]
  );

  const renameConversation = useCallback(
    async (convId: string, title: string) => {
      await fetch("/api/chat", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversation_id: convId, title }),
      });
      await loadConversations();
    },
    [loadConversations]
  );

  return {
    conversations,
    activeConvId,
    messages,
    sending,
    openConversation,
    resetConversation,
    sendMessage,
    deleteConversations,
    renameConversation,
    loadConversations,
  };
}
