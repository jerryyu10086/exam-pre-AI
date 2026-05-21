import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

// 档位颜色使用 CSS 变量，不 hardcode
const TIER_COLOR: Record<string, string> = {
  "必学": "var(--color-tier-must)",
  "补充": "var(--color-tier-supplement)",
  "拓展": "var(--color-tier-expand)",
};

export type KnowledgePoint = {
  id: string;
  tier: "必学" | "补充" | "拓展";
  concept: string;
  knowledge: string;
  source?: string;
  explanation?: string;  // B部分，帮助理解
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
            {point.concept}
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
          <div className="mt-2 space-y-2">
            <div className="text-muted text-sm leading-relaxed prose prose-invert prose-sm max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
                {point.knowledge}
              </ReactMarkdown>
            </div>

            {point.explanation && (
              <div className="text-muted text-sm leading-relaxed border-l-2 border-white/10 pl-3 prose prose-invert prose-sm max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
                  {point.explanation}
                </ReactMarkdown>
              </div>
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
