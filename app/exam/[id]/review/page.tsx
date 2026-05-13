"use client";
import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
import Link from "next/link";
import ChapterCard, { type KnowledgePoint } from "@/components/chapter-card";

type Chapter = {
  chapter_name: string;
  chapter_order: number;
  importance: "高频" | "中频" | "低频";
  knowledge_points: KnowledgePoint[];
};

const TIER_LEGEND = [
  { label: "必学", desc: "硬核重点，不学不行", colorVar: "var(--color-tier-must)" },
  { label: "补充", desc: "锦上添花，加深理解", colorVar: "var(--color-tier-supplement)" },
  { label: "拓展", desc: "随缘看看，不用死磕", colorVar: "var(--color-tier-expand)" },
] as const;

export default function ReviewPage() {
  const params = useParams<{ id: string }>();
  const [chapters, setChapters] = useState<Chapter[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/plan?exam_id=${params.id}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          const sorted = [...data].sort(
            (a: Chapter, b: Chapter) => a.chapter_order - b.chapter_order
          );
          setChapters(sorted);
        } else {
          setError('暂无复习计划，请先在「准备分析」页触发解析');
        }
      })
      .catch(() => setError("加载失败，请刷新重试"));
  }, [params.id]);

  // 统计各重要性档位章节数
  const stats = chapters
    ? {
        total: chapters.length,
        高频: chapters.filter((c) => c.importance === "高频").length,
        中频: chapters.filter((c) => c.importance === "中频").length,
        低频: chapters.filter((c) => c.importance === "低频").length,
      }
    : null;

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-2xl mx-auto">

        {/* 顶部栏 */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Link
              href={`/exam/${params.id}`}
              className="text-muted hover:text-primary text-sm transition-colors"
            >
              ← 返回
            </Link>
            <span className="text-muted text-sm">/</span>
            <h1 className="text-primary font-semibold text-base">复习总览</h1>
          </div>
          <Link
            href={`/exam/${params.id}/global-qa`}
            className="text-sm text-muted border border-white/5 rounded-md px-3 py-1.5 hover:text-primary hover:border-white/10 transition-colors"
          >
            💬 全局问答
          </Link>
        </div>

        {/* 档位图例 */}
        <div className="flex flex-col gap-1.5 mb-5">
          {TIER_LEGEND.map(({ label, desc, colorVar }) => (
            <div key={label} className="flex items-center gap-2">
              <div
                className="w-1 h-4 rounded-full shrink-0"
                style={{ backgroundColor: colorVar }}
              />
              <span className="text-muted text-sm">
                <span className="text-primary font-medium">{label}</span>
                {" — "}
                {desc}
              </span>
            </div>
          ))}
        </div>

        {/* 统计行 */}
        {stats && (
          <p className="text-muted text-sm mb-5">
            📊 共 {stats.total} 章，高频 {stats.高频} 章 / 中频 {stats.中频} 章 / 低频 {stats.低频} 章
          </p>
        )}

        {/* 错误提示 */}
        {error && (
          <p className="text-tier-must text-sm mb-4">{error}</p>
        )}

        {/* Loading */}
        {!chapters && !error && (
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-card border border-white/5 rounded-lg p-4 h-28 animate-pulse"
              />
            ))}
          </div>
        )}

        {/* 章节卡片列表 */}
        {chapters && (
          <div className="flex flex-col gap-3">
            {chapters.map((chapter) => (
              <ChapterCard
                key={chapter.chapter_order}
                examId={params.id}
                chapterOrder={chapter.chapter_order}
                chapterName={chapter.chapter_name}
                importance={chapter.importance}
                knowledgePoints={chapter.knowledge_points}
              />
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
