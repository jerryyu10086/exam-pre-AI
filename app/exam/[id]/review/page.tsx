"use client";
import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
import Link from "next/link";
import ChapterCard, { type KnowledgePoint } from "@/components/chapter-card";

type FileEntry = {
  file_name: string;
  display_name: string;
  order: number;
  knowledge_points: KnowledgePoint[];
  chapter_summary?: string;
  key_focus?: string[];
};

type OverallFramework = {
  subject_thread?: string;
  chapter_relations?: string;
  recommended_order?: string[];
};

type FrameworkEntry = { __overall_framework__: OverallFramework };

function isFrameworkEntry(e: unknown): e is FrameworkEntry {
  return (
    typeof e === "object" &&
    e !== null &&
    "__overall_framework__" in e &&
    !("file_name" in (e as Record<string, unknown>))
  );
}

const CN: Record<string, number> = { 一:1,二:2,三:3,四:4,五:5,六:6,七:7,八:8,九:9 };
function parseCNNum(s: string): number {
  if (!s) return 0;
  // 十, 十一…十九
  if (s[0] === "十") return 10 + (CN[s[1]] ?? 0);
  // 二十, 三十…, 二十一…
  if (s[1] === "十") return (CN[s[0]] ?? 0) * 10 + (CN[s[2]] ?? 0);
  return CN[s[0]] ?? 0;
}
function chapterNum(f: { display_name: string; order: number }): number {
  // 先尝试阿拉伯数字
  const arabic = f.display_name.match(/第\s*(\d+)\s*章/);
  if (arabic) return parseInt(arabic[1], 10);
  // 再尝试中文数字
  const chinese = f.display_name.match(/第\s*([一二三四五六七八九十百]+)\s*章/);
  if (chinese) return parseCNNum(chinese[1]);
  return f.order + 10000;
}

const TIER_LEGEND = [
  { label: "必学", desc: "硬核重点，不学不行", colorVar: "var(--color-tier-must)" },
  { label: "补充", desc: "锦上添花，加深理解", colorVar: "var(--color-tier-supplement)" },
  { label: "拓展", desc: "随缘看看，不用死磕", colorVar: "var(--color-tier-expand)" },
] as const;

export default function ReviewPage() {
  const params = useParams<{ id: string }>();
  const [files, setFiles] = useState<FileEntry[] | null>(null);
  const [framework, setFramework] = useState<OverallFramework | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const cacheKey = `p5_${params.id}`;
    try {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        const data = JSON.parse(cached);
        if (Array.isArray(data)) {
          // 旧缓存仅含 files；新缓存末尾可能带 __overall_framework__ 条目
          const fw = data.find(isFrameworkEntry)?.__overall_framework__ ?? null;
          const chapters = data.filter((e: unknown): e is FileEntry => !isFrameworkEntry(e));
          setFiles(chapters);
          setFramework(fw);
        }
      }
    } catch {}

    fetch(`/api/plan?exam_id=${params.id}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          const fw = data.find(isFrameworkEntry)?.__overall_framework__ ?? null;
          const chapters = data
            .filter((e: unknown): e is FileEntry => !isFrameworkEntry(e))
            .sort((a: FileEntry, b: FileEntry) => chapterNum(a) - chapterNum(b));
          setFiles(chapters);
          setFramework(fw);
          try { sessionStorage.setItem(cacheKey, JSON.stringify(data)); } catch {}
        } else {
          setError("暂无复习计划，请先在「准备分析」页触发解析");
        }
      })
      .catch(() => setError("加载失败，请刷新重试"));
  }, [params.id]);

  const totalCount = files ? files.length : null;

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-3xl mx-auto">

        {/* 顶部导航 */}
        <div className="flex items-center gap-2 mb-6">
          <Link href="/home" className="text-muted hover:text-primary text-sm transition-colors shrink-0">首页</Link>
          <span className="text-muted text-sm">/</span>
          <Link href={`/exam/${params.id}`} className="text-muted hover:text-primary text-sm transition-colors shrink-0">返回</Link>
          <span className="text-muted text-sm">/</span>
          <h1 className="text-primary font-semibold text-base">复习总览</h1>
        </div>

        {/* 档位图例 */}
        <div className="flex flex-col gap-1.5 mb-5">
          {TIER_LEGEND.map(({ label, desc, colorVar }) => (
            <div key={label} className="flex items-center gap-2">
              <div className="w-1 h-4 rounded-full shrink-0" style={{ backgroundColor: colorVar }} />
              <span className="text-muted text-sm">
                <span className="text-primary font-medium">{label}</span>
                {" — "}
                {desc}
              </span>
            </div>
          ))}
        </div>

        {/* 学科总览（V1 新增）— accent 边框突出 */}
        {framework && (framework.subject_thread || framework.chapter_relations) && (
          <div className="bg-card border border-accent/30 rounded-lg p-4 mb-5">
            <p className="text-primary text-sm font-medium mb-2">📚 学科总览</p>
            {framework.subject_thread && (
              <p className="text-muted text-sm leading-relaxed mb-1.5">
                <span className="text-primary">主线 · </span>{framework.subject_thread}
              </p>
            )}
            {framework.chapter_relations && (
              <p className="text-muted text-sm leading-relaxed">
                <span className="text-primary">章节关系 · </span>{framework.chapter_relations}
              </p>
            )}
          </div>
        )}

        {/* 统计行 + 全局问答入口 */}
        <div className="flex items-center justify-between mb-5">
          {totalCount !== null ? (
            <p className="text-muted text-sm">📊 共 {totalCount} 份课件</p>
          ) : (
            <span />
          )}
          <Link
            href={`/exam/${params.id}/global-qa`}
            className="text-sm text-muted border border-white/5 rounded-md px-3 py-1 hover:text-primary hover:border-white/10 transition-colors shrink-0"
          >
            💬 全局问答
          </Link>
        </div>

        {error && <p className="text-tier-must text-sm mb-4">{error}</p>}

        {/* Loading */}
        {!files && !error && (
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-card border border-white/5 rounded-lg p-4 h-28 animate-pulse" />
            ))}
          </div>
        )}

        {/* 课件卡片列表 */}
        {files && (
          <div className="flex flex-col gap-3">
            {files.map((f) => (
              <ChapterCard
                key={f.order}
                examId={params.id}
                order={f.order}
                displayName={f.display_name}
                knowledgePoints={f.knowledge_points}
                chapterSummary={f.chapter_summary}
                keyFocusCount={f.key_focus?.length}
              />
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
