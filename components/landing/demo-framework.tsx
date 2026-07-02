/**
 * 能力②演示：综合分析，生成考纲（复习框架总览）
 * 只展示"框架长什么样"——学科主线 + 章节脉络结构，不展开分档细节。
 */

const CHAPTERS = [
  {
    name: "第10章 静电场",
    summary: "引入电荷守恒律与电场概念，建立后续电势、电容的分析基础。",
  },
  {
    name: "第11章 高斯定理",
    summary: "由电场线与通量推导高斯定理，用于高对称场的快速求解。",
  },
  {
    name: "第12章 稳恒磁场",
    summary: "从运动电荷切入磁场，讲解毕奥-萨伐尔定律与安培环路定理。",
  },
];

export default function DemoFramework() {
  return (
    <div className="glass u-lift rounded-2xl p-5 sm:p-6 flex flex-col gap-4">
      {/* 学科总览 */}
      <div className="rounded-xl border border-accent/30 bg-accent/5 p-4">
        <p className="text-accent text-xs font-semibold mb-2">📚 学科总览</p>
        <p className="text-muted text-sm leading-relaxed mb-1.5">
          <span className="text-primary">主线 · </span>
          以电磁相互作用为主线，从静电场逐步过渡到稳恒磁场与电磁感应。
        </p>
        <p className="text-muted text-sm leading-relaxed">
          <span className="text-primary">章节关系 · </span>
          第10–11章构建静电场基础，第12章切入磁场，第13章综合电磁感应。
        </p>
      </div>

      <p className="text-muted text-xs">📊 共 13 份材料，梳理为 8 个章节</p>

      {/* 章节卡 */}
      <div className="flex flex-col gap-2">
        {CHAPTERS.map((c) => (
          <div key={c.name} className="bg-background/40 border border-white/5 rounded-xl p-3">
            <h4 className="text-primary font-medium text-sm mb-1">{c.name}</h4>
            <p className="text-muted text-xs leading-relaxed line-clamp-2">{c.summary}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
