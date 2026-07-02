/**
 * 能力①演示：所有课件一次全读
 * 展示一批被读取的材料（课件 + 真题），传达"逐份读完、掌握整体"。
 */

const FILES = [
  { name: "第01讲 绪论.pdf", type: "课件" },
  { name: "第02讲 静电场.pdf", type: "课件" },
  { name: "第03讲 电场强度.pdf", type: "课件" },
  { name: "第04讲 高斯定理.pdf", type: "课件" },
  { name: "第05讲 电势.pdf", type: "课件" },
  { name: "第06讲 稳恒磁场.pdf", type: "课件" },
  { name: "第07讲 电磁感应.pdf", type: "课件" },
  { name: "期中真题_2023.pdf", type: "真题" },
];

export default function DemoFiles() {
  return (
    <div className="glass u-lift rounded-2xl p-5 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <span className="text-primary text-sm font-medium">本次分析材料</span>
        <span className="text-accent text-xs">13 份 · 全部读取 ✓</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {FILES.map((f) => (
          <div
            key={f.name}
            className="flex items-center gap-2.5 bg-background/40 border border-white/5 rounded-lg px-3 py-2"
          >
            <span className="text-base shrink-0">📄</span>
            <span className="text-primary text-xs truncate flex-1">{f.name}</span>
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 ${
                f.type === "真题"
                  ? "text-tier-supplement bg-tier-supplement/10"
                  : "text-muted bg-white/5"
              }`}
            >
              {f.type}
            </span>
            <span className="text-tier-expand text-xs shrink-0">✓</span>
          </div>
        ))}
        <div className="flex items-center justify-center bg-background/20 border border-dashed border-white/10 rounded-lg px-3 py-2 text-muted text-xs">
          + 还有 5 份…
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-white/5 flex items-center gap-2 text-xs">
        <span className="text-muted">逐份独立解读后统一整合</span>
        <span className="text-accent">→ 掌握考试整体情况</span>
      </div>
    </div>
  );
}
