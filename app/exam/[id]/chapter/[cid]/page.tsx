"use client";
import { useParams } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import TierContent, { type KnowledgePoint } from "@/components/tier-content";
import { useChat } from "@/hooks/useChat";

type Chapter = {
  chapter_name: string;
  chapter_order: number;
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
  const [chapter, setChapter] = useState<Chapter | null>(null);
  const [loadError, setLoadError] = useState("");

  // ── 渲染控制 ──────────────────────────────────────────────
  const [viewMode, setViewMode] = useState<ViewMode>("sequential");
  const [collapsedSet, setCollapsedSet] = useState<Set<number>>(new Set());

  // ── 对话区 ────────────────────────────────────────────────
  const {
    conversations, activeConvId, messages, input, setInput, sending,
    openConversation, sendMessage, deleteConversations,
  } = useChat(params.id, chapterOrder);
  const [confirmDelete, setConfirmDelete] = useState<string[] | null>(null);
  const [deletingConv, setDeletingConv] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 加载章节数据
  useEffect(() => {
    fetch(`/api/plan?exam_id=${params.id}`)
      .then((r) => r.json())
      .then((data) => {
        if (!Array.isArray(data)) {
          setLoadError("暂无复习计划，请先触发解析");
          return;
        }
        const found = data.find((c: Chapter) => c.chapter_order === chapterOrder);
        if (!found) setLoadError(`未找到第 ${chapterOrder} 章数据`);
        else setChapter(found);
      })
      .catch(() => setLoadError("加载失败，请刷新重试"));
  }, [params.id, chapterOrder]);

  // 新消息时滚到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── 折叠控制 ──────────────────────────────────────────────
  function toggleCollapse(index: number) {
    setCollapsedSet((prev) => {
      const next = new Set(prev);
      next.has(index) ? next.delete(index) : next.add(index);
      return next;
    });
  }

  function collapseAll() {
    if (!chapter) return;
    setCollapsedSet(new Set(chapter.knowledge_points.map((_, i) => i)));
  }

  function expandAll() {
    setCollapsedSet(new Set());
  }

  // ── 分层视图：按 tier 分组 ──────────────────────────────
  function getPointsByTier(tier: string) {
    return (chapter?.knowledge_points ?? [])
      .map((kp, i) => ({ kp, originalIndex: i }))
      .filter(({ kp }) => kp.tier === tier);
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

  // ── render ────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-2xl mx-auto">

        {/* 标题 */}
        {chapter && (
          <h1 className="text-lg font-semibold text-primary mb-4">
            {chapter.chapter_name}
          </h1>
        )}

        {/* 图例 + 控制栏 */}
        <div className="flex flex-col gap-3 mb-5">
          {/* 档位图例 */}
          <div className="flex flex-col gap-1">
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
          <div className="flex items-center gap-2 flex-wrap">
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
        </div>

        {/* 错误提示 */}
        {loadError && <p className="text-tier-must text-sm mb-4">{loadError}</p>}

        {/* ── 知识点列表 ── */}
        {chapter && (
          <div className="flex flex-col gap-3 mb-10">
            {viewMode === "sequential" ? (
              chapter.knowledge_points.map((kp, i) => (
                <TierContent
                  key={i}
                  point={kp}
                  index={i + 1}
                  collapsed={collapsedSet.has(i)}
                  onToggle={() => toggleCollapse(i)}
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
                      {pts.map(({ kp, originalIndex }) => (
                        <TierContent
                          key={originalIndex}
                          point={kp}
                          index={originalIndex + 1}
                          collapsed={collapsedSet.has(originalIndex)}
                          onToggle={() => toggleCollapse(originalIndex)}
                        />
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ── 对话区 ── */}
        <div className="border-t border-white/5 pt-6">
          <h2 className="text-base font-medium text-primary mb-4">💬 章节对话</h2>

          {/* 对话卡片列表 */}
          <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
            {conversations.map((conv) => (
              // 外层用 div 避免 button 嵌套 button（HTML 规范不允许）
              <div
                key={conv.id}
                className={`shrink-0 w-40 bg-card border rounded-lg p-3 transition-colors cursor-pointer ${
                  activeConvId === conv.id
                    ? "border-accent"
                    : "border-white/5 hover:border-white/15"
                }`}
              >
                <div onClick={() => openConversation(conv.id)} className="text-left">
                  <p className="text-primary text-xs font-medium truncate mb-1">
                    {conv.title}
                  </p>
                  <p className="text-muted text-xs truncate">{conv.last_message}</p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setConfirmDelete([conv.id]);
                  }}
                  className="text-muted text-xs mt-2 hover:text-tier-must transition-colors"
                >
                  删除
                </button>
              </div>
            ))}

            {/* 新建对话按钮 */}
            <button
              onClick={() => openConversation("")}
              className="shrink-0 w-32 bg-card border border-white/5 hover:border-white/15 rounded-lg p-3 flex items-center justify-center text-muted hover:text-primary transition-colors text-sm"
            >
              + 新建对话
            </button>
          </div>

          {/* 消息列表（有活跃对话时显示） */}
          {(activeConvId !== null) && (
            <div className="bg-card border border-white/5 rounded-lg flex flex-col">
              <div className="flex-1 p-4 space-y-3 max-h-80 overflow-y-auto">
                {messages.length === 0 && (
                  <p className="text-muted text-sm text-center py-4">
                    在下方输入问题，开始对话
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
                      <p className="whitespace-pre-wrap">{msg.content}</p>
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
              <div className="border-t border-white/5 p-3 flex gap-2">
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
          )}
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
