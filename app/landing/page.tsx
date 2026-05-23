import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background overflow-x-hidden">

      {/* ── Nav ──────────────────────────────────────────────── */}
      <nav className="flex items-center px-8 py-4 border-b border-white/5">
        <span className="text-accent font-semibold text-base tracking-tight">
          度月如日—备考AI
        </span>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="relative flex flex-col items-center justify-center text-center min-h-screen px-6">
        {/* 紫色光晕 */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[320px] bg-accent/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative mb-4 text-7xl font-bold text-accent tracking-tight">
          度月如日
        </div>

        {/* 主标题 tagline */}
        <h1 className="relative text-2xl font-semibold text-primary mb-8">
          没听课？照样拿高分！
        </h1>

        {/* 副标题 */}
        <p className="relative text-muted text-base max-w-md mb-10 leading-relaxed">
          课件一次全读，难点随时提问
          <br />
          AI 永远满血，框架自由调整
        </p>

        {/* 主 CTA */}
        <Link
          href="/home"
          className="relative bg-accent hover:bg-accent-hover text-primary rounded-md px-8 py-3 text-base font-semibold transition-colors"
        >
          上传课件，开始备考 →
        </Link>

        <p className="relative mt-10 text-muted text-xs opacity-40">↓ 了解更多</p>
      </section>

      {/* ── Features ─────────────────────────────────────────── */}
      <section className="px-8 py-20 max-w-5xl mx-auto">
        <h2 className="text-center text-primary text-xl font-bold mb-2">
          专为临时抱佛脚设计
        </h2>
        <p className="text-center text-muted text-base mb-10">
          不是通用聊天 AI，是备考场景的完整解决方案
        </p>

        <div className="grid grid-cols-2 gap-4">

          {/* 卡片 1：课件全读 */}
          <div className="bg-card border border-white/5 rounded-lg p-5 flex flex-col gap-4">
            <div className="text-2xl">📚</div>
            <div>
              <h3 className="text-primary font-semibold text-base mb-2">
                课件全读，整体把握
              </h3>
              <p className="text-muted text-sm leading-relaxed">
                传统 AI 上下文有限，课件一多就读不完。本产品对每份文件单独分析后统一整合，一次上传所有材料，全部读完再给出方案
              </p>
            </div>
            <div className="mt-auto pt-3 border-t border-white/5 flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted">传统AI对话</span>
                <span className="text-tier-must">文件数量限制，无法整体分析</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted">本产品</span>
                <span className="text-tier-expand">全部文件，整体分析</span>
              </div>
            </div>
          </div>

          {/* 卡片 2：章节独立 */}
          <div className="bg-card border border-white/5 rounded-lg p-5 flex flex-col gap-4">
            <div className="text-2xl">💬</div>
            <div>
              <h3 className="text-primary font-semibold text-base mb-2">
                每章独立，AI 永远满血
              </h3>
              <p className="text-muted text-sm leading-relaxed">
                每个章节对话窗口独立，上下文从不积累，AI 智商永远在线。结合精准检索，回答有据可查
              </p>
            </div>
            <div className="mt-auto bg-background rounded-md p-3 flex flex-col gap-2">
              <div className="self-end bg-accent/20 rounded-md px-3 py-1.5 text-accent text-xs max-w-[85%] text-left">
                流动镶嵌模型是什么？
              </div>
              <p className="text-muted text-sm leading-relaxed">
                细胞膜由磷脂双分子层构成…
                <span className="text-accent/70 ml-1">来源：第3讲 第5页</span>
              </p>
            </div>
          </div>

          {/* 卡片 3：三档优先级 */}
          <div className="bg-card border border-white/5 rounded-lg p-5 flex flex-col gap-4">
            <div className="text-2xl">📊</div>
            <div>
              <h3 className="text-primary font-semibold text-base mb-2">
                展示三档优先级，自由调整学习内容
              </h3>
              <p className="text-muted text-sm leading-relaxed">
                自动生成红 / 黄 / 绿三档优先级框架。时间多就往下学，时间少就只看红档，决策权始终在你
              </p>
            </div>
            <div className="mt-auto bg-background rounded-md p-3 flex flex-col gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-0.5 h-4 rounded-full bg-tier-must shrink-0" />
                <span className="text-tier-must text-xs font-medium w-10 shrink-0">必学</span>
                <span className="text-muted text-xs">硬核重点，不学不行</span>
              </div>
              <div className="flex items-center gap-2.5">
                <div className="w-0.5 h-4 rounded-full bg-tier-supplement shrink-0" />
                <span className="text-tier-supplement text-xs font-medium w-10 shrink-0">补充</span>
                <span className="text-muted text-xs">锦上添花，加深理解</span>
              </div>
              <div className="flex items-center gap-2.5">
                <div className="w-0.5 h-4 rounded-full bg-tier-expand shrink-0" />
                <span className="text-tier-expand text-xs font-medium w-10 shrink-0">拓展</span>
                <span className="text-muted text-xs">随缘看看，不用死磕</span>
              </div>
            </div>
          </div>

          {/* 卡片 4：随时重新规划 */}
          <div className="bg-card border border-white/5 rounded-lg p-5 flex flex-col gap-4">
            <div className="text-2xl">🔄</div>
            <div>
              <h3 className="text-primary font-semibold text-base mb-2">
                随时重新规划，只调整框架
              </h3>
              <p className="text-muted text-sm leading-relaxed">
                考情变了、老师划了重点？一键重新生成复习框架，但章节内容无需重新生成——知识是什么就是什么，框架可以随时调整
              </p>
            </div>
            <div className="mt-auto pt-3 border-t border-white/5 flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted">章节分析</span>
                <span className="text-tier-expand">永久缓存，不重复消耗</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted">复习框架</span>
                <span className="text-accent">随时一键重新生成</span>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────── */}
      <section className="py-24 border-t border-white/5">
        <div className="max-w-4xl mx-auto px-8">
          <h2 className="text-center text-primary text-2xl font-bold mb-16">
            三步开始备考
          </h2>
          <div className="flex justify-center gap-36">
            {[
              {
                step: "1",
                title: "上传材料",
                desc: "课件 / 真题 / 课本，多文件批量上传",
              },
              {
                step: "2",
                title: "获得复习方案",
                desc: "三档优先级自动生成，无需手写提示词",
              },
              {
                step: "3",
                title: "随时深入提问",
                desc: "章节问答 · 全局问答，精准检索有据可查",
              },
            ].map((item) => (
              <div key={item.step} className="flex flex-col items-center text-center w-52">
                <div className="w-16 h-16 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center mb-5 shrink-0">
                  <span className="text-accent font-bold text-2xl">{item.step}</span>
                </div>
                <h3 className="text-primary font-semibold text-lg mb-3 whitespace-nowrap">
                  {item.title}
                </h3>
                <p className="text-muted text-base leading-relaxed whitespace-nowrap">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

    </div>
  );
}
