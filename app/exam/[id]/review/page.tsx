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
};

const TIER_LEGEND = [
  { label: "必学", desc: "硬核重点，不学不行", colorVar: "var(--color-tier-must)" },
  { label: "补充", desc: "锦上添花，加深理解", colorVar: "var(--color-tier-supplement)" },
  { label: "拓展", desc: "随缘看看，不用死磕", colorVar: "var(--color-tier-expand)" },
] as const;

export default function ReviewPage() {
  const params = useParams<{ id: string }>();
  const [files, setFiles] = useState<FileEntry[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const cacheKey = `p5_${params.id}`;
    try {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        const data = JSON.parse(cached);
        if (Array.isArray(data)) setFiles(data);
      }
    } catch {}

    fetch(`/api/plan?exam_id=${params.id}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          // 优先按 display_name 里的章节号（第N章）排序，无章节号则按 order 兜底
          const chapterNum = (f: FileEntry) => {
            const m = f.display_name.match(/第\s*(\d+)\s*章/);
            return m ? parseInt(m[1], 10) : f.order + 10000;
          };
          const sorted = [...data].sort((a: FileEntry, b: FileEntry) => chapterNum(a) - chapterNum(b));
          setFiles(sorted);
          try { sessionStorage.setItem(cacheKey, JSON.stringify(sorted)); } catch {}
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
              />
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
