"use client";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useState, useEffect, useRef, useCallback, useMemo, startTransition } from "react";
import TierContent, { type KnowledgePoint } from "@/components/tier-content";
import ChatInput, { type ChatInputHandle } from "@/components/chat-input";
import ChatThinking from "@/components/chat-thinking";
import ChatMarkdown from "@/components/chat-markdown";
import { useChat } from "@/hooks/useChat";
import { isDemoModeBrowser } from "@/lib/demo";

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

export default function ChapterPage() {
  const params = useParams<{ id: string; cid: string }>();
  const chapterOrder = parseInt(params.cid);

  // ── 章节数据 ──────────────────────────────────────────────
  const [isDemo, setIsDemo] = useState(false);
  useEffect(() => { setIsDemo(isDemoModeBrowser()); }, []);
  const [chapter, setChapter] = useState<FileEntry | null>(null);
  const [loadError, setLoadError] = useState("");

  // ── 渲染控制 ──────────────────────────────────────────────
  const [viewMode, setViewMode] = useState<ViewMode>("sequential");
  const [collapsedSet, setCollapsedSet] = useState<Set<string>>(new Set());

  // ── 对话抽屉 ──────────────────────────────────────────────
  const [drawerOpen, setDrawerOpen] = useState(false);
  const chatInputRef = useRef<ChatInputHandle>(null);
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

  // 默认全部折叠：仅在章节首次加载时初始化一次（点开某条才渲染该条公式，
  // 默认页面几乎不含 KaTeX DOM，彻底消除大 DOM 的布局/重绘卡顿）
  const collapseInitRef = useRef(false);
  useEffect(() => {
    if (chapter && !collapseInitRef.current) {
      collapseInitRef.current = true;
      setCollapsedSet(new Set(chapter.knowledge_points.map((kp) => kp.id)));
    }
  }, [chapter]);

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

  // 抽屉打开时锁 body scroll，防止背景双层滚动
  // 高度由 className 的 top-0 + bottom-0 自动撑满（iOS Safari fixed 元素按
  // visualViewport 定位，键盘弹起时 bottom 跟随，无需 JS 干预）
  useEffect(() => {
    if (!drawerOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [drawerOpen]);

  // ── 折叠控制 ──────────────────────────────────────────────
  const toggleCollapse = useCallback((id: string) => {
    setCollapsedSet((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  // 全部展开/折叠会一次性挂载/卸载所有公式 DOM，属重活。
  // 用 startTransition 标记为非紧急更新：按钮点击立即响应，重渲染在后台进行，不阻塞主线程。
  function collapseAll() {
    if (!chapter) return;
    const ids = chapter.knowledge_points.map((kp) => kp.id);
    startTransition(() => setCollapsedSet(new Set(ids)));
  }

  function expandAll() {
    startTransition(() => setCollapsedSet(new Set()));
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

  // 两种视图拍平成单层列表：小节/档位标题与知识点作为同级兄弟节点渲染。
  // 关键——知识点用 kp.id 作 key 且始终处于同一层级，切换视图时两种排布共享相同的
  // key 集合，React 直接「移动」已有 TierContent 实例而非卸载重建，
  // useMemo 缓存的 KaTeX 元素得以保留（已展开的知识点切换视图不再重新解析公式）。
  type FlatItem =
    | { kind: "header"; key: string; label: string; colorVar?: string }
    | { kind: "point"; kp: KnowledgePoint; index: number };
  const flatItems = useMemo<FlatItem[]>(() => {
    if (!chapter) return [];
    const items: FlatItem[] = [];
    if (viewMode === "sequential") {
      for (const g of sequentialGroups.groups) {
        if (g.section_number) {
          items.push({
            kind: "header",
            key: `sec-${g.key}`,
            label: `${g.section_number}${g.section_name ? `、${g.section_name}` : ""}`,
          });
        }
        for (const kp of g.points) {
          items.push({ kind: "point", kp, index: sequentialGroups.indexMap.get(kp.id) ?? 0 });
        }
      }
    } else {
      for (const { tier, points, colorVar } of tieredGroups) {
        if (points.length === 0) continue;
        items.push({ kind: "header", key: `tier-${tier}`, label: tier, colorVar });
        for (const kp of points) {
          items.push({ kind: "point", kp, index: parseInt(kp.id.replace("kp_", ""), 10) + 1 });
        }
      }
    }
    return items;
  }, [chapter, viewMode, sequentialGroups, tieredGroups]);

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
    <div className="min-h-screen p-4 md:p-6">
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
          <div className="glass rounded-xl p-4 mb-5">
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

        {/* ── 知识点列表 ──
            单视图条件渲染：一次只渲染当前视图。默认全部折叠 → 页面几乎不含公式 DOM，
            切换「顺序/分层」只是重排标题行、点开某条才渲染该条公式，彻底消除卡顿。 */}
        {chapter && (
          <div className="flex flex-col gap-3 mb-8">
            {flatItems.map((item, i) =>
              item.kind === "header" ? (
                // 小节标题（顺序视图）/ 档位标题（分层视图）——档位用彩色文字，无色条，
                // 与顺序视图小标题字号一致（text-base）；非首行加 mt-2 分隔上一组
                <div key={item.key} className={i === 0 ? "" : "mt-2"}>
                  <span
                    className={`text-base font-medium ${item.colorVar ? "" : "text-muted"}`}
                    style={item.colorVar ? { color: item.colorVar } : undefined}
                  >
                    {item.label}
                  </span>
                </div>
              ) : (
                <TierContent
                  key={item.kp.id}
                  point={item.kp}
                  index={item.index}
                  collapsed={collapsedSet.has(item.kp.id)}
                  onToggle={toggleCollapse}
                  onAsk={handleAsk}
                  isKeyFocus={chapter.key_focus?.includes(item.kp.id)}
                />
              )
            )}
          </div>
        )}
      </div>

      {/* ── 对话抽屉切换按钮（右侧固定 tab） ── */}
      <button
        onClick={() => setDrawerOpen((v) => !v)}
        style={{ writingMode: "vertical-rl", textOrientation: "mixed" }}
        className={`fixed top-1/2 right-0 bg-accent hover:bg-accent-hover text-primary text-xs font-medium px-3 py-3 rounded-l-lg z-40 shadow-lg transition-transform duration-300 ${
          drawerOpen ? "md:-translate-x-[560px] -translate-y-1/2 max-md:opacity-0 max-md:pointer-events-none" : "-translate-y-1/2"
        }`}
      >
        {drawerOpen ? "收起" : "对话"}
      </button>

      {/* ── 右侧对话抽屉（手机端全屏次级页面 + 桌面端右侧抽屉） ── */}
      <div
        className={`fixed top-0 right-0 bottom-0 w-full md:w-[560px] bg-card border-l border-white/5 z-50 md:z-30 flex flex-col transition-transform duration-300 will-change-transform ${
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
            onClick={isDemo ? undefined : () => { resetConversation(); chatInputRef.current?.setValue(""); }}
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
                  onClick={isDemo ? undefined : (e) => { e.stopPropagation(); startRename(conv); }}
                  className="text-muted text-xs hover:text-primary transition-colors"
                >
                  改名
                </button>
                <button
                  onClick={isDemo ? undefined : (e) => { e.stopPropagation(); setConfirmDelete([conv.id]); }}
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
                  <ChatMarkdown content={msg.content} />
                )}
              </div>
            </div>
          ))}
          {sending && <ChatThinking />}
          <div ref={messagesEndRef} />
          </>
          )}
        </div>

        {/* 输入区 */}
        {isDemo ? (
          <div className="border-t border-white/5 p-3 flex items-center justify-between gap-3">
            <p className="text-muted text-xs">演示模式 · 注册后解锁对话功能</p>
            <a href="/login" className="shrink-0 text-xs btn-glow text-primary rounded-md px-3 py-1.5 transition-colors">立即注册</a>
          </div>
        ) : (
          <ChatInput ref={chatInputRef} onSend={sendMessage} onStop={stopSending} sending={sending} />
        )}
      </div>

      {/* 删除确认弹窗 */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="glass rounded-xl p-6 max-w-sm w-full mx-4">
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
