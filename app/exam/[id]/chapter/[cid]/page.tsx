"use client";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useState, useEffect, useRef } from "react";
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
  importance: string;
  knowledge_points: KnowledgePoint[];
};

const TIER_LEGEND = [
  { label: "必学", desc: "硬核重点，不学不行", colorVar: "var(--color-tier-must)" },
  { label: "补充", desc: "锦上添花，加深理解", colorVar: "var(--color-tier-supplement)" },
  { label: "拓展", desc: "随缘看看，不用死磕", colorVar: "var(--color-tier-expand)" },
] as const;

type ViewMode = "sequential" | "tiered";

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
  const {
    conversations, activeConvId, messages, input, setInput, sending,
    openConversation, resetConversation, sendMessage, deleteConversations, renameConversation,
  } = useChat(params.id, chapterOrder);
  const [confirmDelete, setConfirmDelete] = useState<string[] | null>(null);
  const [deletingConv, setDeletingConv] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

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

  // 新消息时滚到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── 折叠控制 ──────────────────────────────────────────────
  function toggleCollapse(id: string) {
    setCollapsedSet((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function collapseAll() {
    if (!chapter) return;
    setCollapsedSet(new Set(chapter.knowledge_points.map((kp) => kp.id)));
  }

  function expandAll() {
    setCollapsedSet(new Set());
  }

  // 顺序查看：按 kp_N 的 N 升序排列，还原 MAP 阶段（即 PDF）原始顺序
  function getSortedByOriginalOrder() {
    return [...(chapter?.knowledge_points ?? [])].sort((a, b) => {
      const ai = parseInt(a.id.replace("kp_", ""), 10);
      const bi = parseInt(b.id.replace("kp_", ""), 10);
      return ai - bi;
    });
  }

  // ── 分层视图：按 tier 分组 ──────────────────────────────
  function getPointsByTier(tier: string) {
    return (chapter?.knowledge_points ?? []).filter((kp) => kp.tier === tier);
  }

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

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function handleAsk(concept: string) {
    resetConversation();
    setDrawerOpen(true);
    setInput(`关于「${concept}」，`);
  }

  // ── render ────────────────────────────────────────────────
  return (
    <div className={`min-h-screen bg-background pl-6 pt-6 pb-6 transition-all duration-300 ${drawerOpen ? "pr-[440px]" : "pr-6"}`}>
      <div className="max-w-2xl mx-auto">

        {/* 顶部导航 */}
        <div className="flex items-center gap-2 mb-6">
          <Link href="/" className="text-muted hover:text-primary text-sm transition-colors shrink-0">首页</Link>
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
              getSortedByOriginalOrder().map((kp, i) => (
                <TierContent
                  key={kp.id}
                  point={kp}
                  index={i + 1}
                  collapsed={collapsedSet.has(kp.id)}
                  onToggle={() => toggleCollapse(kp.id)}
                  onAsk={handleAsk}
                />
              ))
            ) : (
              (["必学", "补充", "拓展"] as const).map((tier) => {
                const pts = getPointsByTier(tier);
                if (pts.length === 0) return null;
                const colorVar = TIER_LEGEND.find((t) => t.label === tier)!.colorVar;
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
                      {pts.map((kp) => (
                        <TierContent
                          key={kp.id}
                          point={kp}
                          index={parseInt(kp.id.replace("kp_", ""), 10) + 1}
                          collapsed={collapsedSet.has(kp.id)}
                          onToggle={() => toggleCollapse(kp.id)}
                          onAsk={handleAsk}
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
        className={`fixed top-1/2 -translate-y-1/2 bg-accent hover:bg-accent-hover text-primary text-xs font-medium px-2 py-4 rounded-l-lg z-40 shadow-lg transition-all duration-300 ${
          drawerOpen ? "right-[440px]" : "right-0"
        }`}
      >
        {drawerOpen ? "收起" : "💬 对话"}
      </button>

      {/* ── 右侧对话抽屉 ── */}
      <div
        className={`fixed top-0 right-0 h-full w-[440px] bg-card border-l border-white/5 z-30 flex flex-col transition-transform duration-300 ${
          drawerOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* 抽屉顶栏 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 shrink-0">
          <h2 className="text-sm font-medium text-primary">💬 章节对话</h2>
          <p className="text-muted text-xs">基于本章课件随时提问，无需重新上传</p>
        </div>

        {/* 对话卡片列表 */}
        <div className="chat-scrollbar flex gap-2 overflow-x-auto px-4 py-3 border-b border-white/5 shrink-0">
          <button
            onClick={resetConversation}
            className="shrink-0 w-24 bg-background border border-white/5 hover:border-white/15 rounded-lg p-2.5 flex items-center justify-center text-muted hover:text-primary transition-colors text-xs"
          >
            + 新建
          </button>
          {conversations.map((conv) => (
            <div
              key={conv.id}
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
                <div onClick={() => openConversation(conv.id)}>
                  <p className="text-primary text-xs font-medium truncate mb-1">{conv.title}</p>
                </div>
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
        <div className="chat-scrollbar flex-1 overflow-y-auto p-4 space-y-3" style={{ scrollbarGutter: "stable" }}>
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
                      p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
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
                <p className="text-muted text-sm">思考中...</p>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* 输入区 */}
        <div className="border-t border-white/5 p-3 flex gap-2 shrink-0">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入问题，Enter 发送，Shift+Enter 换行"
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
