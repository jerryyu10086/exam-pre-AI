"use client";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useState, useEffect, useRef, useCallback, useMemo, forwardRef, useImperativeHandle, Children } from "react";
import type { ReactNode } from "react";
import TierContent, { type KnowledgePoint } from "@/components/tier-content";
import { useChat } from "@/hooks/useChat";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { preprocessMath } from "@/lib/math";

type FileEntry = {
  file_name: string;
  display_name: string;
  order: number;
  knowledge_points: KnowledgePoint[];
  chapter_summary?: string;   // REDUCE 生成的章节脉络一句话
  key_focus?: string[];       // 本章最重要的知识点 id 列表
};

const TIER_LEGEND = [
  { label: "必学", desc: "硬核重点，不学不行", colorVar: "var(--color-tier-must)" },
  { label: "补充", desc: "锦上添花，加深理解", colorVar: "var(--color-tier-supplement)" },
  { label: "拓展", desc: "随缘看看，不用死磕", colorVar: "var(--color-tier-expand)" },
] as const;

type ViewMode = "sequential" | "tiered";

// 检测 AI 引用格式「（N. 概念名）」，渲染为 chip
const KP_REF_RE = /[（(](\d+)[.．]\s*([^）)]{1,40})[）)]/g;
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

const CN_NUMS = ["", "一", "二", "三", "四", "五", "六", "七", "八", "九", "十",
  "十一", "十二", "十三", "十四", "十五", "十六", "十七", "十八", "十九", "二十"];
function toChineseNum(s: string): string {
  const n = parseInt(s, 10);
  if (!isNaN(n) && n >= 1 && n <= 20 && String(n) === s) return CN_NUMS[n];
  return s;
}

// auto-grow 高度上下限（px）
const INPUT_MIN_H = 52;
const INPUT_MAX_H = 200;

// 独立组件持有 input state，打字不触发外层重渲染
const ChatInput = forwardRef<
  { setValue: (v: string) => void },
  {
    onSend: (text: string) => Promise<boolean>;
    onStop: () => void;
    sending: boolean;
  }
>(function ChatInput({ onSend, onStop, sending }, ref) {
  const [input, setInput] = useState("");
  const taRef = useRef<HTMLTextAreaElement>(null);

  useImperativeHandle(ref, () => ({
    setValue: (v) => {
      setInput(v);
      // 让 useEffect 在下个 tick 重算高度
      requestAnimationFrame(() => taRef.current?.focus());
    },
  }));

  // textarea auto-resize：随内容增长，达到上限后内部滚动
  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    const next = Math.min(Math.max(ta.scrollHeight, INPUT_MIN_H), INPUT_MAX_H);
    ta.style.height = `${next}px`;
  }, [input]);

  async function handleSend() {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    const ok = await onSend(text);
    if (!ok) setInput(text);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  }

  const hasText = input.trim().length > 0;
  const showStop = sending;
  // 按钮启用条件：sending 时永远可点（停止）；否则需要有文字
  const btnActive = showStop || hasText;

  return (
    <div className="border-t border-white/5 p-3 shrink-0">
      <div className="relative bg-background border border-white/5 rounded-2xl px-4 py-3 focus-within:border-accent/50 transition-colors">
        <textarea
          ref={taRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="输入问题，Enter 发送，Shift+Enter 换行"
          rows={1}
          style={{ minHeight: INPUT_MIN_H, maxHeight: INPUT_MAX_H }}
          className="chat-scrollbar w-full bg-transparent text-primary text-sm placeholder:text-muted outline-none resize-none pr-10 leading-relaxed"
        />
        <button
          onClick={showStop ? onStop : handleSend}
          disabled={!btnActive}
          aria-label={showStop ? "停止" : "发送"}
          className={`absolute right-2 bottom-2 w-8 h-8 flex items-center justify-center rounded-full transition-colors ${
            btnActive
              ? "bg-accent hover:bg-accent-hover text-primary cursor-pointer"
              : "bg-card-hover text-muted cursor-not-allowed"
          }`}
        >
          {showStop ? (
            // 方块：停止
            <span className="block w-2.5 h-2.5 bg-primary rounded-[2px]" />
          ) : (
            // 箭头：发送
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="19" x2="12" y2="5" />
              <polyline points="5 12 12 5 19 12" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
});

export default function ChapterPage() {
  const params = useParams<{ id: string; cid: string }>();
  const chapterOrder = parseInt(params.cid);

  // ── 章节数据 ──────────────────────────────────────────────
  const [chapter, setChapter] = useState<FileEntry | null>(null);
  const [loadError, setLoadError] = useState("");

  // ── 渲染控制 ──────────────────────────────────────────────
  const [viewMode, setViewMode] = useState<ViewMode>("sequential");
  const [collapsedSet, setCollapsedSet] = useState<Set<string>>(new Set());

  // ── 对话抽屉 ──────────────────────────────────────────────
  const [drawerOpen, setDrawerOpen] = useState(false);
  const chatInputRef = useRef<{ setValue: (v: string) => void }>(null);
  const {
    conversations, activeConvId, messages, sending, loadingMessages,
    openConversation, resetConversation, sendMessage, stopSending, deleteConversations, renameConversation,
  } = useChat(params.id, chapterOrder);
  const [confirmDelete, setConfirmDelete] = useState<string[] | null>(null);
  const [deletingConv, setDeletingConv] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // 加载章节数据
  useEffect(() => {
    const cacheKey = `p6_${params.id}_${chapterOrder}`;
    try {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) setChapter(JSON.parse(cached));
    } catch {}

    fetch(`/api/plan?exam_id=${params.id}`)
      .then((r) => r.json())
      .then((data) => {
        if (!Array.isArray(data)) {
          setLoadError("暂无复习计划，请先触发解析");
          return;
        }
        const found = data.find((f: FileEntry) => f.order === chapterOrder);
        if (!found) setLoadError(`未找到第 ${chapterOrder} 份课件数据`);
        else {
          setChapter(found);
          try { sessionStorage.setItem(cacheKey, JSON.stringify(found)); } catch {}
        }
      })
      .catch(() => setLoadError("加载失败，请刷新重试"));
  }, [params.id, chapterOrder]);

  // 1. 切换对话时 instant 跳底（有缓存立即生效）
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

  // 3. 同一对话内追加新消息时平滑滚动（仅当消息是追加而非替换）
  const prevMessagesRef = useRef<typeof messages>([]);
  useEffect(() => {
    const prev = prevMessagesRef.current;
    const curr = messages;
    prevMessagesRef.current = curr;
    const isAppend = curr.length > prev.length && prev.length > 0 && curr[0]?.id === prev[0]?.id;
    if (isAppend) messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── 折叠控制 ──────────────────────────────────────────────
  const toggleCollapse = useCallback((id: string) => {
    setCollapsedSet((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  function collapseAll() {
    if (!chapter) return;
    setCollapsedSet(new Set(chapter.knowledge_points.map((kp) => kp.id)));
  }

  function expandAll() {
    setCollapsedSet(new Set());
  }

  // 按 id 升序后按 section_number 全局合并分组（用 Map 避免非连续同名 section 产生重复 key）
  const sequentialGroups = useMemo(() => {
    const sorted = [...(chapter?.knowledge_points ?? [])].sort((a, b) => {
      const ai = parseInt((a.id ?? "kp_0").replace("kp_", ""), 10);
      const bi = parseInt((b.id ?? "kp_0").replace("kp_", ""), 10);
      return ai - bi;
    });
    const indexMap = new Map<string, number>(sorted.map((kp, i) => [kp.id, i + 1]));
    type Group = { key: string; section_number: string; section_name: string; points: KnowledgePoint[] };
    const groupMap = new Map<string, Group>();
    const groupOrder: string[] = [];
    let nosecCount = 0;
    for (const kp of sorted) {
      const sn = kp.section_number ?? "";
      // 无 section_number 的知识点各自独立成组，不合并
      const key = sn ? sn : `__nosec_${nosecCount++}`;
      if (sn && groupMap.has(key)) {
        groupMap.get(key)!.points.push(kp);
      } else {
        const g: Group = { key, section_number: sn, section_name: kp.section_name ?? "", points: [kp] };
        groupMap.set(key, g);
        groupOrder.push(key);
      }
    }
    return { groups: groupOrder.map((k) => groupMap.get(k)!), indexMap };
  }, [chapter?.knowledge_points]);

  const tieredGroups = useMemo(() =>
    (["必学", "补充", "拓展"] as const).map((tier) => ({
      tier,
      points: (chapter?.knowledge_points ?? []).filter((kp) => kp.tier === tier),
      colorVar: TIER_LEGEND.find((t) => t.label === tier)!.colorVar,
    })),
    [chapter?.knowledge_points]
  );

  // ── 对话改名 ─────────────────────────────────────────────
  function startRename(conv: { id: string; title: string }) {
    setRenamingId(conv.id);
    setRenameValue(conv.title);
  }

  async function commitRename(convId: string) {
    const trimmed = renameValue.trim();
    if (trimmed) await renameConversation(convId, trimmed);
    setRenamingId(null);
  }

  function handleRenameKeyDown(e: React.KeyboardEvent<HTMLInputElement>, convId: string) {
    if (e.key === "Enter") { e.preventDefault(); commitRename(convId); }
    if (e.key === "Escape") setRenamingId(null);
  }

  // ── 对话区辅助 ────────────────────────────────────────────
  async function handleConfirmDelete() {
    if (!confirmDelete) return;
    setDeletingConv(true);
    await deleteConversations(confirmDelete);
    setDeletingConv(false);
    setConfirmDelete(null);
  }

  const handleAsk = useCallback((concept: string) => {
    resetConversation();
    setDrawerOpen(true);
    chatInputRef.current?.setValue(`关于「${concept}」，`);
  }, [resetConversation]);

  // ── render ────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-3xl mx-auto">

        {/* 顶部导航 */}
        <div className="flex items-center gap-2 mb-6">
          <Link href="/home" className="text-muted hover:text-primary text-sm transition-colors shrink-0">首页</Link>
          <span className="text-muted text-sm">/</span>
          <Link href={`/exam/${params.id}/review`} className="text-muted hover:text-primary text-sm transition-colors shrink-0">返回</Link>
          <span className="text-muted text-sm">/</span>
          <h1 className="text-primary font-semibold text-base truncate min-h-[1.5rem]">
            {chapter?.display_name}
          </h1>
        </div>

        {/* 档位图例 — 与 Page 5 完全对齐：gap-1.5 mb-5 */}
        <div className="flex flex-col gap-1.5 mb-5">
          {TIER_LEGEND.map(({ label, desc, colorVar }) => (
            <div key={label} className="flex items-center gap-2">
              <div
                className="w-1 h-4 rounded-full shrink-0"
                style={{ backgroundColor: colorVar }}
              />
              <span className="text-muted text-sm">
                <span className="text-primary font-medium">{label}</span>
                {" — "}{desc}
              </span>
            </div>
          ))}
        </div>

        {/* 章节脉络摘要（REDUCE 生成，可选） */}
        {chapter?.chapter_summary && (
          <div className="bg-card border border-accent/30 rounded-lg p-4 mb-5">
            <p className="text-muted text-sm leading-relaxed">{chapter.chapter_summary}</p>
          </div>
        )}

        {/* 视图切换 + 折叠控制 */}
        <div className="flex items-center gap-2 flex-wrap mb-5">
          <button
            onClick={() => setViewMode("sequential")}
            className={`text-xs px-3 py-1 rounded-md border transition-colors ${
              viewMode === "sequential"
                ? "bg-accent text-primary border-accent"
                : "bg-card border-white/10 text-muted hover:text-primary"
            }`}
          >
            顺序查看
          </button>
          <button
            onClick={() => setViewMode("tiered")}
            className={`text-xs px-3 py-1 rounded-md border transition-colors ${
              viewMode === "tiered"
                ? "bg-accent text-primary border-accent"
                : "bg-card border-white/10 text-muted hover:text-primary"
            }`}
          >
            分层查看
          </button>
          <div className="flex-1" />
          <button
            onClick={expandAll}
            className="text-xs px-3 py-1 rounded-md border bg-card border-white/10 text-muted hover:text-primary transition-colors"
          >
            全部展开
          </button>
          <button
            onClick={collapseAll}
            className="text-xs px-3 py-1 rounded-md border bg-card border-white/10 text-muted hover:text-primary transition-colors"
          >
            全部折叠
          </button>
        </div>

        {/* 错误提示 */}
        {loadError && <p className="text-tier-must text-sm mb-4">{loadError}</p>}

        {/* ── 知识点列表 ── */}
        {chapter && (
          <div className="flex flex-col gap-3 mb-8">
            {viewMode === "sequential" ? (
              sequentialGroups.groups.map((g) => (
                <div key={g.key}>
                  {g.section_number && (
                    <div className="text-muted text-base font-medium mb-2">
                      {toChineseNum(g.section_number)}{g.section_name ? `、${g.section_name}` : ""}
                    </div>
                  )}
                  <div className="flex flex-col gap-3">
                    {g.points.map((kp) => (
                      <TierContent
                        key={kp.id}
                        point={kp}
                        index={sequentialGroups.indexMap.get(kp.id) ?? 0}
                        collapsed={collapsedSet.has(kp.id)}
                        onToggle={toggleCollapse}
                        onAsk={handleAsk}
                        isKeyFocus={chapter.key_focus?.includes(kp.id)}
                      />
                    ))}
                  </div>
                </div>
              ))
            ) : (
              tieredGroups.map(({ tier, points, colorVar }) => {
                if (points.length === 0) return null;
                return (
                  <div key={tier}>
                    <div className="flex items-center gap-2 mb-2">
                      <div
                        className="w-1 h-4 rounded-full shrink-0"
                        style={{ backgroundColor: colorVar }}
                      />
                      <span className="text-primary text-sm font-medium">{tier}</span>
                    </div>
                    <div className="flex flex-col gap-3 pl-3">
                      {points.map((kp) => (
                        <TierContent
                          key={kp.id}
                          point={kp}
                          index={parseInt(kp.id.replace("kp_", ""), 10) + 1}
                          collapsed={collapsedSet.has(kp.id)}
                          onToggle={toggleCollapse}
                          onAsk={handleAsk}
                          isKeyFocus={chapter.key_focus?.includes(kp.id)}
                        />
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* ── 对话抽屉切换按钮（右侧固定 tab） ── */}
      <button
        onClick={() => setDrawerOpen((v) => !v)}
        style={{ writingMode: "vertical-rl", textOrientation: "mixed" }}
        className={`fixed top-1/2 right-0 bg-accent hover:bg-accent-hover text-primary text-xs font-medium px-2 py-4 rounded-l-lg z-40 shadow-lg transition-transform duration-300 ${
          drawerOpen ? "md:-translate-x-[560px] -translate-y-1/2 max-md:opacity-0 max-md:pointer-events-none" : "-translate-y-1/2"
        }`}
      >
        {drawerOpen ? "收起" : "💬 对话"}
      </button>

      {/* ── 右侧对话抽屉 ── */}
      <div
        className={`fixed top-0 right-0 h-full w-full md:w-[560px] bg-card border-l border-white/5 z-30 flex flex-col transition-transform duration-300 will-change-transform ${
          drawerOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* 抽屉顶栏 */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5 shrink-0">
          <button
            onClick={() => setDrawerOpen(false)}
            className="md:hidden shrink-0 text-muted hover:text-primary text-base leading-none transition-colors"
          >
            ←
          </button>
          <h2 className="text-sm font-medium text-primary">💬 章节对话</h2>
          <p className="hidden sm:block text-muted text-xs ml-auto">基于本章课件随时提问，无需重新上传</p>
        </div>

        {/* 对话卡片列表 */}
        <div className="chat-scrollbar flex gap-2 overflow-x-auto px-4 py-3 border-b border-white/5 shrink-0">
          <button
            onClick={() => { resetConversation(); chatInputRef.current?.setValue(""); }}
            className="shrink-0 w-24 bg-background border border-white/5 hover:border-white/15 rounded-lg p-2.5 flex items-center justify-center text-muted hover:text-primary transition-colors text-xs"
          >
            + 新建
          </button>
          {conversations.map((conv) => (
            <div
              key={conv.id}
              onClick={() => renamingId !== conv.id && openConversation(conv.id)}
              className={`shrink-0 w-36 bg-background border rounded-lg p-2.5 transition-colors cursor-pointer ${
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
                  className="w-full bg-card border border-accent/50 rounded px-1.5 py-0.5 text-primary text-xs outline-none mb-1"
                />
              ) : (
                <p className="text-primary text-xs font-medium truncate mb-1">{conv.title}</p>
              )}
              <div className="flex gap-2 mt-1.5">
                <button
                  onClick={(e) => { e.stopPropagation(); startRename(conv); }}
                  className="text-muted text-xs hover:text-primary transition-colors"
                >
                  改名
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setConfirmDelete([conv.id]); }}
                  className="text-muted text-xs hover:text-tier-must transition-colors"
                >
                  删除
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* 消息区 */}
        <div ref={messagesContainerRef} className="chat-scrollbar flex-1 overflow-y-auto p-4 space-y-3" style={{ scrollbarGutter: "stable" }}>
          {loadingMessages ? (
            <div className="flex items-center justify-center h-full py-16">
              <div className="w-5 h-5 border-2 border-white/10 border-t-accent rounded-full animate-spin" />
            </div>
          ) : (
          <>
          {messages.length === 0 && (
            <p className="text-muted text-sm text-center py-8">
              {conversations.length === 0
                ? "基于本章课件，随时提问——AI 已读完全文"
                : "输入问题继续对话，或点「+ 新建」开新上下文"}
            </p>
          )}
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
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

        {/* 输入区 */}
        <ChatInput ref={chatInputRef} onSend={sendMessage} onStop={stopSending} sending={sending} />
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
                onClick={handleConfirmDelete}
                disabled={deletingConv}
                className="flex-1 bg-tier-must text-primary rounded-md py-2 text-sm disabled:opacity-50 hover:opacity-90 transition-opacity"
              >
                {deletingConv ? "删除中..." : "确认删除"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
