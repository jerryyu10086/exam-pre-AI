import Link from "next/link";
import SpotlightCard from "@/components/spotlight-card";
import Reveal from "@/components/landing/reveal";
import ScrollTop from "@/components/landing/scroll-top";
import DemoFiles from "@/components/landing/demo-files";
import DemoFramework from "@/components/landing/demo-framework";
import DemoTiers from "@/components/landing/demo-tiers";
import DemoChat from "@/components/landing/demo-chat";

/**
 * 落地页完整视图（单一来源）
 * `/`（app/page.tsx）与 `/landing`（app/landing/page.tsx）都渲染本组件。
 * 结构：Hero → 四大能力（左文右演示，show 为主）→ 技术管线 → 三步 → CTA。
 */
export default function LandingView() {
  return (
    <div className="relative min-h-screen overflow-x-hidden">

      {/* 返回落地页时强制回顶（覆盖浏览器滚动恢复）*/}
      <ScrollTop />

      {/* ── 宇宙感落地背景：真实照片打底（度月如日 · 左月右日 · 空旷平原）──
       * 换图：覆盖 public/hero-cosmos.jpg 即可；样式见 globals.css .cosmos-* */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-screen overflow-hidden">
        <div className="cosmos-photo" />
        <div className="cosmos-vignette" />
        <div className="cosmos-grade" />
        <div className="grain" />
      </div>

      <div className="relative">

        {/* ── Nav ─────────────────────────────────────────────── */}
        <nav className="absolute top-0 inset-x-0 z-30 flex items-center px-4 sm:px-8 py-4">
          <span
            className="text-primary font-semibold text-base tracking-tight"
            style={{ textShadow: "0 1px 10px rgba(0,0,0,0.55)" }}
          >
            度月如日
            <span className="text-white/70 font-normal">
              <span className="mx-1.5">—</span>备考AI
            </span>
          </span>
        </nav>

        {/* ── Hero ────────────────────────────────────────────── */}
        <section className="relative flex flex-col items-center justify-center text-center min-h-[calc(100vh-60px)] px-6">
          <div className="relative mb-6 text-5xl sm:text-7xl md:text-8xl font-bold tracking-tight text-gradient rise-in leading-[1.05]">
            度月如日
          </div>
          <h1
            className="relative text-2xl sm:text-3xl font-semibold text-primary mb-6 rise-in"
            style={{ animationDelay: "0.08s" }}
          >
            没听课？照样拿高分！
          </h1>
          <p
            className="relative text-white/70 text-base sm:text-lg max-w-md mb-10 leading-relaxed rise-in"
            style={{ animationDelay: "0.16s", textShadow: "0 2px 14px rgba(0,0,0,0.6)" }}
          >
            上传考试相关材料，一键生成复习总纲
          </p>
          <Link
            href="/home"
            className="btn-glow relative text-white rounded-xl px-8 py-3.5 text-base font-semibold rise-in"
            style={{ animationDelay: "0.24s" }}
          >
            上传课件，开始备考 →
          </Link>
          {/* 占位：等高于原「了解更多」(mt-24 + text-sm 行高)，让中间块居中还原到移动前 */}
          <div aria-hidden className="mt-24 h-5" />
          <div className="absolute bottom-8 inset-x-0 flex justify-center">
            <a
              href="#capabilities"
              className="text-white/70 text-sm hover:text-white transition-colors rise-in"
              style={{ animationDelay: "0.32s", textShadow: "0 2px 12px rgba(0,0,0,0.6)" }}
            >
              ↓ 了解更多
            </a>
          </div>
        </section>

        {/* ── 四大能力（左文右演示，交错布局）─────────────────── */}
        <section
          id="capabilities"
          className="relative scroll-mt-[-4rem] px-4 sm:px-8 pt-28 sm:pt-44 pb-8 sm:pb-12 max-w-6xl mx-auto flex flex-col gap-28 sm:gap-40"
        >
          <CapabilityBlock
            index={1}
            tag="全面解读"
            title="所有课件，一次全读"
            hook="逐一解读每个文件，掌握考试整体情况"
          >
            <DemoFiles />
          </CapabilityBlock>

          <CapabilityBlock
            index={2}
            reverse
            tag="系统分析"
            title="综合分析，生成考纲"
            hook="基于提供的所有信息，给出最优的复习方案"
          >
            <DemoFramework />
          </CapabilityBlock>

          <CapabilityBlock
            index={3}
            tag="分档学习"
            title="内容分档，灵活调整"
            hook="覆盖所有知识点，根据时间和预期，自动选档学习"
          >
            <DemoTiers />
          </CapabilityBlock>

          <CapabilityBlock
            index={4}
            reverse
            tag="深入提问"
            title="边学边问，加强理解"
            hook="任何问题随时提问，支持无限新开窗口，响应迅速，互不干扰"
          >
            <DemoChat />
          </CapabilityBlock>
        </section>

        {/* ── 技术管线 MAP → REDUCE → RAG ─────────────────────── */}
        <section className="relative px-4 sm:px-8 py-20 sm:py-28 max-w-5xl mx-auto">
          <p className="text-center text-accent text-base font-semibold mb-4">
            技术设计
          </p>
          <h2 className="text-center text-primary text-3xl sm:text-4xl font-bold tracking-tight mb-12">
            MAP / REDUCE / RAG
          </h2>

          <div className="flex flex-col md:flex-row items-stretch justify-center gap-4 md:gap-3">
            {[
              {
                tag: "MAP",
                icon: "🗂️",
                title: "逐份提取要点",
                desc: "每份课件独立并行，穷举全部知识点",
              },
              {
                tag: "REDUCE",
                icon: "🎯",
                title: "全局分析归档",
                desc: "以全局视角分析，生成分档复习计划",
              },
              {
                tag: "RAG",
                icon: "🔍",
                title: "精准检索问答",
                desc: "精准定位召回，轻量准确应对回答",
              },
            ].map((stage, i) => (
              <div
                key={stage.tag}
                className="flex flex-col md:flex-row items-center md:items-stretch gap-4 md:gap-3 md:flex-1"
              >
                <SpotlightCard className="glass u-lift rounded-2xl p-5 w-full md:h-full">
                  <div className="flex items-center gap-3">
                    <div className="icon-pop w-11 h-11 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center text-2xl">
                      {stage.icon}
                    </div>
                    <span className="text-accent text-xs font-bold tracking-widest">{stage.tag}</span>
                  </div>
                  <h3 className="text-primary font-semibold text-lg">{stage.title}</h3>
                  <p className="text-muted text-sm leading-relaxed">{stage.desc}</p>
                </SpotlightCard>
                {i < 2 && (
                  <span className="text-accent/50 text-2xl shrink-0 self-center rotate-90 md:rotate-0">→</span>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* ── 三步开始备考 ────────────────────────────────────── */}
        <section className="relative py-16 sm:py-28 border-t border-white/5">
          <div className="max-w-4xl mx-auto px-4 sm:px-8">
            <h2 className="text-center text-primary text-2xl sm:text-3xl font-bold mb-12 sm:mb-16 tracking-tight">
              三步开始备考
            </h2>
            <div className="flex flex-col sm:flex-row sm:justify-center items-center gap-12 sm:gap-24 md:gap-36">
              {[
                { step: "1", title: "上传材料", desc: "课件 / 真题 / 课本，多文件批量上传" },
                { step: "2", title: "获得复习方案", desc: "三档优先级自动生成，无需手写提示词" },
                { step: "3", title: "随时深入提问", desc: "章节问答 · 全局问答，精准检索有据可查" },
              ].map((item) => (
                <div key={item.step} className="group flex flex-col items-center text-center w-52 cursor-default">
                  <div className="relative w-16 h-16 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center mb-6 shrink-0 transition-all duration-300 group-hover:-translate-y-1.5 group-hover:border-accent/50 group-hover:bg-accent/15 shadow-[0_16px_40px_-16px_var(--color-accent)] group-hover:shadow-[0_24px_50px_-16px_var(--color-accent)]">
                    <span className="text-gradient font-bold text-3xl transition-transform duration-300 group-hover:scale-110">{item.step}</span>
                  </div>
                  <h3 className="text-primary font-semibold text-lg mb-3 whitespace-nowrap">{item.title}</h3>
                  <p className="text-muted text-base leading-relaxed whitespace-nowrap">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── 收尾 CTA（仅按钮）───────────────────────────────── */}
        <section className="relative px-6 pt-12 sm:pt-16 pb-24 sm:pb-32 flex justify-center">
          <Link
            href="/home"
            className="btn-glow relative inline-block text-white rounded-xl px-10 py-4 text-lg font-semibold"
          >
            免费开始 →
          </Link>
        </section>

      </div>
    </div>
  );
}

/* ── 能力块布局：左文右演示，reverse 时左右互换（仅桌面）──────────
 * 加序号提升编排的设计感；整块 Reveal 滚动入场；演示卡 u-lift 悬浮反馈。 */
function CapabilityBlock({
  index,
  tag,
  title,
  hook,
  reverse = false,
  children,
}: {
  index: number;
  tag: string;
  title: string;
  hook: string;
  reverse?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Reveal>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-14 items-center">
        <div className={`relative ${reverse ? "lg:order-2" : ""}`}>
          {/* 跟随文字（0X 序号/紫色标签）的极淡柔光 */}
          <div className="cosmos-text-glow pointer-events-none absolute" aria-hidden />
          <div className="relative">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-gradient text-3xl font-bold tabular-nums">
                0{index}
              </span>
              <span className="text-accent text-base font-semibold">{tag}</span>
            </div>
            <h3 className="text-primary text-2xl sm:text-3xl font-bold tracking-tight mb-3">{title}</h3>
            <p className="text-muted text-base leading-relaxed">{hook}</p>
          </div>
        </div>
        <div className={reverse ? "lg:order-1" : ""}>{children}</div>
      </div>
    </Reveal>
  );
}
