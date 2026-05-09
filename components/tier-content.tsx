// 档位颜色使用 CSS 变量，不 hardcode
const TIER_COLOR: Record<string, string> = {
  "必学": "var(--color-tier-must)",
  "补充": "var(--color-tier-supplement)",
  "拓展": "var(--color-tier-expand)",
};

export type KnowledgePoint = {
  tier: "必学" | "补充" | "拓展";
  name: string;
  explanation: string;
  examples?: string[];
  source?: string;
};

type TierContentProps = {
  point: KnowledgePoint;
  index: number;
  collapsed: boolean;
  onToggle: () => void;
};

export default function TierContent({ point, index, collapsed, onToggle }: TierContentProps) {
  const color = TIER_COLOR[point.tier] ?? TIER_COLOR["必学"];

  return (
    <div className="flex gap-3">
      {/* 左侧色条 */}
      <div
        className="w-1 shrink-0 rounded-full"
        style={{ backgroundColor: color, alignSelf: "stretch", minHeight: "1.5rem" }}
      />

      <div className="flex-1 py-1.5">
        {/* 标题行 */}
        <div className="flex items-start justify-between gap-2">
          <span className="text-primary text-sm font-medium leading-snug">
            <span className="text-muted mr-1.5">{index}.</span>
            {point.name}
          </span>
          <button
            onClick={onToggle}
            className="text-muted text-xs shrink-0 hover:text-primary transition-colors pt-0.5"
          >
            {collapsed ? "▼ 展开" : "▲ 收起"}
          </button>
        </div>

        {/* 展开内容 */}
        {!collapsed && (
          <div className="mt-2 space-y-1.5">
            <p className="text-muted text-sm leading-relaxed">{point.explanation}</p>

            {point.examples && point.examples.length > 0 && (
              <ul className="text-muted text-sm list-disc list-inside space-y-0.5">
                {point.examples.map((ex, i) => (
                  <li key={i}>{ex}</li>
                ))}
              </ul>
            )}

            {point.source && (
              <p className="text-muted text-xs">📍 {point.source}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
