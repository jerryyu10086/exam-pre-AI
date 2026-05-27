"use client";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useState, useEffect, useRef, Children } from "react";
import type { ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { preprocessMath } from "@/lib/math";

// 全局问答 kp 引用 chip：`（章号.编号. 概念名）`，例如「（1.5. 库仑定律）」
const KP_REF_RE = /[（(](\d+)[.．](\d+)[.．]\s*([^）)]{1,40})[）)]/g;
function processKpRefs(node: ReactNode, idx: number): ReactNode {
  if (typeof node !== "string") return node;
  KP_REF_RE.lastIndex = 0;
  if (!KP_REF_RE.test(node)) return node;
  KP_REF_RE.lastIndex = 0;
  const parts: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = KP_REF_RE.exec(node)) !== null) {
    if (m.index > last) parts.push(node.slice(last, m.index));
    parts.push(
      <span
        key={`kp-${idx}-${m.index}`}
        className="inline-flex items-center bg-background border border-accent/40 text-accent text-xs px-2 py-0.5 rounded-md mx-0.5 whitespace-nowrap align-middle"
      >
        {m[0]}
      </span>
    );
    last = m.index + m[0].length;
  }
  if (last < node.length) parts.push(node.slice(last));
  return parts;
}

type Message = { id: string; role: "user" | "assistant"; content: string };
type Conversation = { id: string; title: string; last_message: string };

export default function GlobalQAPage() {
  const params = useParams<{ id: string }>();

  const [examName, setExamName] = useState("");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loadedChapters, setLoadedChapters] = useState<string[]>([]);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [loadingMessages, setLoadingMessages] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const msgCache = useRef<Map<string, Message[]>>(new Map());

  useEffect(() => {
    const cacheKey = `gqa_${params.id}`;
    try {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        const { name, convs } = JSON.parse(cached);
        if (name) setExamName(name);
        if (Array.isArray(convs)) setConversations(convs);
      }
    } catch {}

    fetch("/api/exam")
      .then((r) => r.json())
      .then((list: { id: string; name: string }[]) => {
        const found = list.find((e) => e.id === params.id);
        if (found) setExamName(found.name);
      });
    loadConversations();
  }, [params.id]);

  // 1. 切换对话时 instant 跳底
  useEffect(() => {
    const el = messagesContainerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [activeConvId]);

  // 2. 无缓存时 fetch 完成后 instant 跳底
  useEffect(() => {
    if (!loadingMessages) {
      const el = messagesContainerRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    }
  }, [loadingMessages]);

  // 3. 同一对话内追加新消息平滑滚动
  const prevMessagesRef = useRef<Message[]>([]);
  useEffect(() => {
    const prev = prevMessagesRef.current;
    const curr = messages;
    prevMessagesRef.current = curr;
    const isAppend = curr.length > prev.length && prev.length > 0 && curr[0]?.id === prev[0]?.id;
    if (isAppend) messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function loadConversations() {
    const res = await fetch(`/api/global-chat?exam_id=${params.id}`);
    const data = await res.json();
    if (Array.isArray(data)) {
      setConversations(data);
      try {
        const name = examName;
        sessionStorage.setItem(`gqa_${params.id}`, JSON.stringify({ name, convs: data }));
      } catch {}
      // 自动打开最近一条对话
      if (data.length > 0 && !activeConvId) {
        openConversation(data[0].id);
      }
    }
  }

  async function openConversation(id: string) {
    setActiveConvId(id);
    setLoadedChapters([]);
    const cached = msgCache.current.get(id);
    if (cached) {
      setMessages(cached);
      setLoadingMessages(false);
    } else {
      setMessages([]);
      setLoadingMessages(true);
    }
    const res = await fetch(`/api/global-chat?conversation_id=${id}`);
    const data = await res.json();
    if (Array.isArray(data)) {
      msgCache.current.set(id, data);
      setMessages(data);
    }
    setLoadingMessages(false);
  }

  function resetConversation() {
    setActiveConvId(null);
    setMessages([]);
    setLoadedChapters([]);
  }

  async function sendMessage() {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    setInput("");

    const tempId = `tmp-${Date.now()}`;
    setMessages((prev) => [...prev, { id: tempId, role: "user", content: text }]);

    try {
      const res = await fetch("/api/global-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          exam_id: params.id,
          conversation_id: activeConvId,
          message: text,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      if (data.is_new) {
        setActiveConvId(data.conversation_id);
        setConversations((prev) => [
          { id: data.conversation_id, title: data.title, last_message: text.slice(0, 60) },
          ...prev,
        ]);
      }

      setLoadedChapters(data.loaded_chapters ?? []);

      const convId: string = data.is_new ? data.conversation_id : (activeConvId ?? data.conversation_id);
      setMessages((prev) => {
        const next = [
          ...prev.filter((m) => m.id !== tempId),
          { id: `u-${Date.now()}`, role: "user" as const, content: text },
          { id: `a-${Date.now()}`, role: "assistant" as const, content: data.reply },
        ];
        msgCache.current.set(convId, next);
        return next;
      });
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setInput(text);
    } finally {
      setSending(false);
    }
  }

  function startRename(conv: Conversation) {
    setRenamingId(conv.id);
    setRenameValue(conv.title);
  }

  async function commitRename(convId: string) {
    const trimmed = renameValue.trim();
    if (trimmed) {
      await fetch("/api/global-chat", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversation_id: convId, title: trimmed }),
      });
      setConversations((prev) =>
        prev.map((c) => (c.id === convId ? { ...c, title: trimmed } : c))
      );
    }
    setRenamingId(null);
  }

  function handleRenameKeyDown(e: React.KeyboardEvent<HTMLInputElement>, convId: string) {
    if (e.key === "Enter") { e.preventDefault(); commitRename(convId); }
    if (e.key === "Escape") setRenamingId(null);
  }

  async function handleDeleteConv(id: string) {
    await fetch("/api/global-chat", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversation_ids: [id] }),
    });
    msgCache.current.delete(id);
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (activeConvId === id) resetConversation();
    setConfirmDelete(null);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-3xl mx-auto">

        {/* 顶部 */}
        <div className="flex items-center gap-2 mb-6">
          <Link href="/home" className="text-muted hover:text-primary text-sm transition-colors shrink-0">首页</Link>
          <span className="text-muted text-sm">/</span>
          <Link href={`/exam/${params.id}/review`} className="text-muted hover:text-primary text-sm transition-colors shrink-0">返回</Link>
          <span className="text-muted text-sm">/</span>
          <h1 className="text-primary font-semibold text-base">
            {examName ? `${examName} · 全局问答` : "全局问答"}
          </h1>
        </div>

        <p className="text-muted text-sm mb-6">
          跨章节整合提问，AI 自动定位相关章节作为上下文
        </p>

        {/* 对话卡片列表 */}
        <div className="chat-scrollbar flex gap-2 overflow-x-auto pb-2 mb-4">
          <button
            onClick={resetConversation}
            className="shrink-0 w-28 bg-card border border-white/5 hover:border-white/15 rounded-lg p-3 flex items-center justify-center text-muted hover:text-primary transition-colors text-sm"
          >
            + 新建
          </button>
          {conversations.map((conv) => (
            <div
              key={conv.id}
              onClick={() => renamingId !== conv.id && openConversation(conv.id)}
              className={`shrink-0 w-40 bg-card border rounded-lg p-3 transition-colors cursor-pointer ${
                activeConvId === conv.id
                  ? "border-accent"
                  : "border-white/5 hover:border-white/15"
              }`}
            >
              {renamingId === conv.id ? (
                <input
                  autoFocus
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={() => commitRename(conv.id)}
                  onKeyDown={(e) => handleRenameKeyDown(e, conv.id)}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full bg-background border border-accent/50 rounded px-1.5 py-0.5 text-primary text-xs outline-none mb-1"
                />
              ) : (
                <p className="text-primary text-xs font-medium truncate mb-1">
                  {conv.title}
                </p>
              )}
              <div className="flex gap-2 mt-2">
                <button
                  onClick={(e) => { e.stopPropagation(); startRename(conv); }}
                  className="text-muted text-xs hover:text-primary transition-colors"
                >
                  改名
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setConfirmDelete(conv.id); }}
                  className="text-muted text-xs hover:text-tier-must transition-colors"
                >
                  删除
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* 已加载章节提示 */}
        {loadedChapters.length > 0 && (
          <p className="text-muted text-xs mb-3">
            已加载章节：<span className="text-accent">{loadedChapters.join("、")}</span>
          </p>
        )}

        {/* 消息区 + 输入框 */}
        <div className="bg-card border border-white/5 rounded-lg flex flex-col">
          <div ref={messagesContainerRef} className="chat-scrollbar flex-1 p-4 space-y-3 max-h-96 overflow-y-auto" style={{ scrollbarGutter: "stable" }}>
            {loadingMessages ? (
              <div className="flex items-center justify-center py-16">
                <div className="w-5 h-5 border-2 border-white/10 border-t-accent rounded-full animate-spin" />
              </div>
            ) : (
            <>
            {messages.length === 0 && (
              <p className="text-muted text-sm text-center py-6">
                {conversations.length === 0
                  ? "输入问题，开始跨章节问答"
                  : "输入问题继续对话，或点「+ 新建对话」开新上下文"}
              </p>
            )}
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                    msg.role === "user"
                      ? "bg-accent text-primary"
                      : "bg-background text-primary border border-white/5"
                  }`}
                >
                  {msg.role === "user" ? (
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  ) : (
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm, remarkMath]}
                      rehypePlugins={[rehypeKatex]}
                      components={{
                        p: ({ children }) => (
                          <p className="mb-2 last:mb-0 leading-relaxed">
                            {Children.map(children, (child, i) => processKpRefs(child, i))}
                          </p>
                        ),
                        strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                        em: ({ children }) => <em className="italic">{children}</em>,
                        ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-0.5">{children}</ul>,
                        ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-0.5">{children}</ol>,
                        li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                        code: ({ children }) => <code className="bg-white/10 rounded px-1 text-xs font-mono">{children}</code>,
                        pre: ({ children }) => <pre className="bg-white/10 rounded p-2 text-xs font-mono mb-2 overflow-x-auto whitespace-pre">{children}</pre>,
                        h3: ({ children }) => <h3 className="font-semibold mb-1 mt-2">{children}</h3>,
                      }}
                    >
                      {preprocessMath(msg.content)}
                    </ReactMarkdown>
                  )}
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex justify-start">
                <div className="bg-background border border-white/5 rounded-lg px-3 py-2">
                  <p className="text-muted text-sm">正在检索知识库并生成回答...</p>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
            </>
            )}
          </div>

          <div className="border-t border-white/5 p-3 flex gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="输入跨章节问题，Enter 发送，Shift+Enter 换行"
              rows={2}
              className="flex-1 bg-background border border-white/5 rounded-md px-3 py-2 text-primary text-sm placeholder:text-muted outline-none focus:border-accent/50 transition-colors resize-none"
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || sending}
              className="self-end bg-accent hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-primary rounded-md px-4 py-2 text-sm font-medium transition-colors"
            >
              发送
            </button>
          </div>
        </div>
      </div>

      {/* 删除确认弹窗 */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-card border border-white/5 rounded-lg p-6 max-w-sm w-full mx-4">
            <p className="text-primary text-sm font-medium mb-2">确认删除对话？</p>
            <p className="text-muted text-xs mb-6">此操作不可撤销。</p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 bg-card border border-white/5 text-primary rounded-md py-2 text-sm hover:bg-card-hover transition-colors"
              >
                取消
              </button>
              <button
                onClick={() => handleDeleteConv(confirmDelete)}
                className="flex-1 bg-tier-must text-primary rounded-md py-2 text-sm hover:opacity-90 transition-opacity"
              >
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
