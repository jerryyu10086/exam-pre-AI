import Link from "next/link";

// CSS 变量映射，不 hardcode 颜色值
const TIER_COLOR_VAR: Record<string, string> = {
  "必学": "var(--color-tier-must)",
  "补充": "var(--color-tier-supplement)",
  "拓展": "var(--color-tier-expand)",
};

export type KnowledgePoint = {
  tier: "必学" | "补充" | "拓展";
  concept: string;
};

type ChapterCardProps = {
  examId: string;
  order: number;
  displayName: string;
  knowledgePoints: KnowledgePoint[];
  chapterSummary?: string;
  keyFocusCount?: number;
  keyFocusConcepts?: Set<string>;
};

export default function ChapterCard({
  examId,
  order,
  displayName,
  knowledgePoints,
  chapterSummary,
  keyFocusCount,
  keyFocusConcepts,
}: ChapterCardProps) {

  // 按档位分组，只保留 concept（过滤 undefined/空值，防止旧数据或合并失败时渲染空白）
  const byTier: Record<string, string[]> = { "必学": [], "补充": [], "拓展": [] };
  for (const kp of knowledgePoints) {
    if (byTier[kp.tier] && kp.concept) byTier[kp.tier].push(kp.concept);
  }

  return (
    <div className="bg-card border border-white/5 rounded-lg p-4">
      <div className="flex items-start justify-between gap-2 mb-3">
        <h2 className="text-base font-medium text-primary">{displayName}</h2>
      </div>

      {chapterSummary && (
        <p className="text-muted text-sm leading-relaxed line-clamp-2 mb-3">{chapterSummary}</p>
      )}

      <div className="flex flex-col gap-2 mb-3">
        {(["必学", "补充", "拓展"] as const).map((tier) => {
          const names = byTier[tier];
          if (names.length === 0) return null;
          return (
            <div key={tier} className="flex items-start gap-2">
              <div
                className="w-1 shrink-0 rounded-full mt-1"
                style={{
                  backgroundColor: TIER_COLOR_VAR[tier],
                  alignSelf: "stretch",
                  minHeight: "1rem",
                }}
              />
              <p className="text-muted text-sm leading-relaxed flex-1">
                {names.map((name, i) => (
                  <span key={i}>
                    {i > 0 && " / "}
                    {name}
                    {keyFocusConcepts?.has(name) && (
                      <span className="ml-1 inline-block align-middle bg-accent/15 text-accent text-xs px-1.5 py-0.5 rounded leading-none">
                        重点
                      </span>
                    )}
                  </span>
                ))}
              </p>
              {tier === "必学" && (keyFocusCount ?? 0) > 0 && (
                <span className="text-accent text-xs shrink-0 mt-1">（{keyFocusCount}个重点）</span>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex justify-end">
        <Link
          href={`/exam/${examId}/chapter/${order}`}
          className="text-accent hover:text-accent-hover text-sm transition-colors"
        >
          深入 →
        </Link>
      </div>
    </div>
  );
}
