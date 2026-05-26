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
  const [loadingMessages, setLoadingMessages] = useState(false);

  const initialLoadDone = useRef(false);
  const msgCache = useRef<Map<string, Message[]>>(new Map());
  const abortRef = useRef<AbortController | null>(null);

  const loadConversations = useCallback(async () => {
    const res = await fetch(
      `/api/chat?exam_id=${examId}&chapter_order=${chapterOrder}`
    );
    if (!res.ok) return;
    const data: Conversation[] = await res.json();
    setConversations(data);

    if (!initialLoadDone.current) {
      initialLoadDone.current = true;
      if (data.length > 0) {
        const latest = data[0];
        setActiveConvId(latest.id);
        setLoadingMessages(true);
        const msgRes = await fetch(`/api/chat?conversation_id=${latest.id}`);
        if (msgRes.ok) {
          const msgs: Message[] = await msgRes.json();
          msgCache.current.set(latest.id, msgs);
          setMessages(msgs);
        }
        setLoadingMessages(false);
      }
    }
  }, [examId, chapterOrder]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // 有缓存立即显示；无缓存显示 spinner 直到 fetch 完成
  const openConversation = useCallback(async (convId: string) => {
    setActiveConvId(convId);
    const cached = msgCache.current.get(convId);
    if (cached) {
      setMessages(cached);
      setLoadingMessages(false);
    } else {
      setMessages([]);
      setLoadingMessages(true);
    }
    const res = await fetch(`/api/chat?conversation_id=${convId}`);
    if (res.ok) {
      const msgs: Message[] = await res.json();
      msgCache.current.set(convId, msgs);
      setMessages(msgs);
    }
    setLoadingMessages(false);
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

    const controller = new AbortController();
    abortRef.current = controller;

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
        signal: controller.signal,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "发送失败");

      const convId: string = data.is_new ? data.conversation_id : (activeConvId ?? data.conversation_id);
      if (data.is_new) setActiveConvId(convId);

      const replyMsg: Message = {
        id: `reply-${Date.now()}`,
        role: "assistant",
        content: data.reply,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => {
        const next = [...prev, replyMsg];
        msgCache.current.set(convId, next);
        return next;
      });

      await loadConversations();
      return true;
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m.id !== optimisticMsg.id));
      if ((err as { name?: string })?.name !== "AbortError") {
        console.error("sendMessage error:", err);
      }
      return false;
    } finally {
      abortRef.current = null;
      setSending(false);
    }
  }, [sending, examId, chapterOrder, activeConvId, loadConversations]);

  const stopSending = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const deleteConversations = useCallback(
    async (ids: string[]) => {
      const res = await fetch("/api/chat", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversation_ids: ids }),
      });
      if (!res.ok) return;

      ids.forEach((id) => msgCache.current.delete(id));
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
    loadingMessages,
    openConversation,
    resetConversation,
    sendMessage,
    stopSending,
    deleteConversations,
    renameConversation,
    loadConversations,
  };
}
