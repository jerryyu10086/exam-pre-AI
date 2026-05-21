// 将各种数学公式格式统一转换为 remark-math 支持的 $...$ 格式
export function preprocessMath(text: string): string {
  if (!text) return text;
  return (
    text
      // \(...\) → $...$
      .replace(/\\\(([\s\S]*?)\\\)/g, (_, m) => `$${m}$`)
      // \[...\] → $$...$$
      .replace(/\\\[([\s\S]*?)\\\]/g, (_, m) => `$$${m}$$`)
      // （ \latex... ） → $\latex...$（中文括号包裹的 LaTeX，兼容旧数据）
      .replace(/（\s*((?:\\[a-zA-Z])[^（）]*)\s*）/g, (_, m) => `$${m.trim()}$`)
  );
}
