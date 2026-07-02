import { memo, Children } from "react";
import type { ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { preprocessMath } from "@/lib/math";

// 检测 AI 引用格式「（N. 概念名）」，渲染为 chip
// 整数序号 + 概念名（概念名首字符不能是数字，防止误匹配章节号如 1.3）
const KP_REF_RE = /[（(](\d+)[.．]\s*([^\d）)\s][^）)]{0,39})[）)]/g;
function processKpRefs(node: ReactNode, idx: number): ReactNode {
  if (typeof node !== "string") return node;
  KP_REF_RE.lastIndex = 0;
  if (!KP_REF_RE.test(node)) return node;
  KP_REF_RE.lastIndex = 0;
  const parts: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = KP_REF_RE.exec(node)) !== null) {
    if (m.index > last) parts.push(node.slice(last, m.index));
    parts.push(
      <span
        key={`kp-${idx}-${m.index}`}
        className="inline-flex items-center bg-background border border-accent/40 text-accent text-xs px-2 py-0.5 rounded-md mx-0.5 whitespace-nowrap align-middle"
      >
        {m[1]}. {m[2]}
      </span>
    );
    last = m.index + m[0].length;
  }
  if (last < node.length) parts.push(node.slice(last));
  return parts;
}

// 助手消息 Markdown 渲染，memo 在 content 上：
// 父组件因 viewMode / collapsedSet 等无关状态重渲染时，content 不变则整体 bail-out，
// 不再重新解析 markdown / 重渲染 KaTeX（常驻挂载的对话抽屉不再拖累 Page 6 按钮切换）。
const ChatMarkdown = memo(function ChatMarkdown({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[rehypeKatex]}
      components={{
        p: ({ children }) => (
          <p className="mb-2 last:mb-0 leading-relaxed">
            {Children.map(children, (child, i) => processKpRefs(child, i))}
          </p>
        ),
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
      {preprocessMath(content)}
    </ReactMarkdown>
  );
});

export default ChatMarkdown;
