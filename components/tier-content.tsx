import { memo, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { preprocessMath } from "@/lib/math";

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
  section_number?: string;  // 所属章节编号，如 "1" 或 "2.1"
  section_name?: string;    // 章节名称
  tier_rationale?: string;  // REDUCE 给出的档位判断理由，可选
};

type TierContentProps = {
  point: KnowledgePoint;
  index: number;
  collapsed: boolean;
  onToggle: (id: string) => void;
  onAsk?: (concept: string) => void;
  isKeyFocus?: boolean;
};

const TierContent = memo(function TierContent({ point, index, collapsed, onToggle, onAsk, isKeyFocus }: TierContentProps) {
  const color = TIER_COLOR[point.tier] ?? TIER_COLOR["必学"];

  // 缓存渲染好的 Markdown 元素：内容不变则复用同一元素引用，
  // 重渲染（折叠/视图切换/prop 变化）时 React 直接 bail-out，不再重新解析 KaTeX。
  const knowledgeNode = useMemo(() => (
    <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
      {preprocessMath(point.knowledge)}
    </ReactMarkdown>
  ), [point.knowledge]);

  const explanationNode = useMemo(() => (
    point.explanation ? (
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
        {preprocessMath(point.explanation)}
      </ReactMarkdown>
    ) : null
  ), [point.explanation]);

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
            {isKeyFocus && (
              <span className="ml-1 text-accent text-xs leading-none">★</span>
            )}
          </span>
          <button
            onClick={() => onToggle(point.id)}
            className="text-muted text-xs shrink-0 hover:text-primary transition-colors pt-0.5"
          >
            {collapsed ? "▼ 展开" : "▲ 收起"}
          </button>
        </div>

        {/* 展开内容：常驻挂载，折叠时仅用 hidden 隐藏 → 折叠/展开为纯 CSS 开关，
            不卸载重挂、不重解析公式 */}
        {/* 折叠时不渲染展开内容（含公式）→ 默认折叠时页面几乎不含 KaTeX DOM，快 */}
        {!collapsed && (
          <div className="mt-2 space-y-2">
            <div className="text-muted text-sm leading-relaxed prose prose-invert prose-sm max-w-none">
              {knowledgeNode}
            </div>

            {explanationNode && (
              <div className="text-muted text-sm leading-relaxed border-l-2 border-white/10 pl-3 prose prose-invert prose-sm max-w-none">
                {explanationNode}
              </div>
            )}

            {point.source && (
              <p className="text-muted text-xs">📍 {point.source}</p>
            )}
            {point.tier_rationale && (
              <p className="text-muted text-xs">📌 {point.tier_rationale}</p>
            )}
            {onAsk && (
              <button
                onClick={() => onAsk(point.concept)}
                className="text-accent hover:text-accent-hover text-xs transition-colors mt-1"
              >
                问 AI →
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

export default TierContent;
