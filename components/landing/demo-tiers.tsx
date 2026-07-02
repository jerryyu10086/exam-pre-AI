"use client";

import { useState } from "react";

/**
 * 能力③演示：内容分档 + 顺序/分层查看切换（复刻 Page 6 核心体验）
 * 顺序查看：按小节分组，保留 PDF 原始顺序；分层查看：按必学→补充→拓展集中。
 *
 * 防位移：两个视图高度不同，切换会引起卡片高度变化、顶动下方内容。
 * 解法——网格堆叠：把两种视图都渲染一遍（隐藏份撑出"两者最大高度"），
 * 可见视图叠在同一格，卡片高度恒等于最高视图，切换零位移，无需魔法数字。
 */

type Tier = "必学" | "补充" | "拓展";
type KP = { n: number; name: string; tier: Tier; section: string; star?: boolean };

const KPS: KP[] = [
  { n: 1, name: "电荷量子化", tier: "补充", section: "电荷与库仑定律" },
  { n: 2, name: "电荷守恒定律", tier: "补充", section: "电荷与库仑定律" },
  { n: 3, name: "库仑定律", tier: "必学", section: "电荷与库仑定律", star: true },
  { n: 4, name: "静电力的叠加原理", tier: "必学", section: "电荷与库仑定律" },
  { n: 5, name: "库仑力与万有引力的比较", tier: "拓展", section: "电荷与库仑定律" },
  { n: 6, name: "电场的概念", tier: "必学", section: "电场与电场强度", star: true },
  { n: 7, name: "电场强度定义", tier: "必学", section: "电场与电场强度", star: true },
  { n: 8, name: "点电荷的电场强度", tier: "必学", section: "电场与电场强度", star: true },
  { n: 9, name: "场强叠加原理", tier: "必学", section: "电场与电场强度", star: true },
];

const TIER_BAR: Record<Tier, string> = {
  必学: "bg-tier-must",
  补充: "bg-tier-supplement",
  拓展: "bg-tier-expand",
};
const TIER_TEXT: Record<Tier, string> = {
  必学: "text-tier-must",
  补充: "text-tier-supplement",
  拓展: "text-tier-expand",
};

function Row({ kp }: { kp: KP }) {
  return (
    <div className="flex items-center gap-3 py-1.5">
      <span className={`w-0.5 h-5 rounded-full shrink-0 ${TIER_BAR[kp.tier]}`} />
      <span className="text-muted text-xs w-4 shrink-0 text-right">{kp.n}.</span>
      <span className="text-primary text-sm">{kp.name}</span>
      {kp.star && <span className="text-accent text-xs">★</span>}
    </div>
  );
}

/* 顺序查看：按小节分组 */
function OrderList() {
  const sections = ["电荷与库仑定律", "电场与电场强度"];
  return (
    <>
      {sections.map((sec, i) => (
        <div key={sec} className="mb-2">
          <p className="text-muted text-sm font-medium mb-1">
            {i + 1}、{sec}
          </p>
          {KPS.filter((k) => k.section === sec).map((kp) => (
            <Row key={kp.n} kp={kp} />
          ))}
        </div>
      ))}
    </>
  );
}

/* 分层查看：按档位分组 */
function LayerList() {
  const tiers: Tier[] = ["必学", "补充", "拓展"];
  return (
    <>
      {tiers.map((tier) => {
        const items = KPS.filter((k) => k.tier === tier);
        if (items.length === 0) return null;
        return (
          <div key={tier} className="mb-2">
            <p className={`text-sm font-medium mb-1 ${TIER_TEXT[tier]}`}>{tier}</p>
            {items.map((kp) => (
              <Row key={kp.n} kp={kp} />
            ))}
          </div>
        );
      })}
    </>
  );
}

export default function DemoTiers() {
  const [view, setView] = useState<"order" | "layer">("order");

  return (
    <div className="glass u-lift rounded-2xl p-5 sm:p-6">
      {/* 图例 */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] mb-4">
        <Legend tier="必学" desc="不学不行" />
        <Legend tier="补充" desc="加深理解" />
        <Legend tier="拓展" desc="随缘看看" />
      </div>

      {/* 视图切换（复刻 Page 6 顺序/分层查看）*/}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setView("order")}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all duration-200 ${
            view === "order"
              ? "bg-accent border-accent text-white"
              : "bg-card/50 border-white/5 text-muted hover:text-primary"
          }`}
        >
          顺序查看
        </button>
        <button
          onClick={() => setView("layer")}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all duration-200 ${
            view === "layer"
              ? "bg-accent border-accent text-white"
              : "bg-card/50 border-white/5 text-muted hover:text-primary"
          }`}
        >
          分层查看
        </button>
      </div>

      {/* 网格堆叠：隐藏份撑高度，可见份叠同格 → 切换零位移 */}
      <div className="grid">
        <div aria-hidden className="invisible [grid-area:1/1]">
          <OrderList />
        </div>
        <div aria-hidden className="invisible [grid-area:1/1]">
          <LayerList />
        </div>
        <div key={view} className="[grid-area:1/1] rise-in">
          {view === "order" ? <OrderList /> : <LayerList />}
        </div>
      </div>
    </div>
  );
}

function Legend({ tier, desc }: { tier: Tier; desc: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`w-0.5 h-3.5 rounded-full ${TIER_BAR[tier]}`} />
      <span className={`${TIER_TEXT[tier]} font-medium`}>{tier}</span>
      <span className="text-muted">— {desc}</span>
    </span>
  );
}
