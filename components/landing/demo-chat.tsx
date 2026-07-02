"use client";

import { useState } from "react";

/**
 * 能力④演示：章节问答 + 多窗口独立
 * 顶部对话 tab 可切换（体现"每章无限新开窗口、互不干扰"），下方展示带
 * 知识点引用 chip + 来源页码的 RAG 回答。
 */

type Msg = { role: "user" | "ai"; text: React.ReactNode; source?: string };
type Convo = { title: string; msgs: Msg[] };

const CONVOS: Convo[] = [
  {
    title: "库仑定律与叠加",
    msgs: [
      { role: "user", text: "库仑定律和电场叠加原理有什么关系？" },
      {
        role: "ai",
        text: (
          <>
            库仑定律给出两个点电荷间的作用力
            <Ref>1. 库仑定律</Ref>
            ；空间中存在多个电荷时，某点合场强等于各电荷单独场强的矢量和，即
            <Ref>2. 电场叠加原理</Ref>。
          </>
        ),
        source: "第3讲 第5页",
      },
    ],
  },
  {
    title: "电偶极子",
    msgs: [
      { role: "user", text: "电偶极子在远处的电场怎么估算？" },
      {
        role: "ai",
        text: (
          <>
            远场处电偶极子场强随距离三次方衰减（∝ 1/r³），方向由偶极矩
            <Ref>5. 电偶极子</Ref>
            决定，比单点电荷衰减更快。
          </>
        ),
        source: "第4讲 第2页",
      },
    ],
  },
];

export default function DemoChat() {
  const [active, setActive] = useState(0);
  const convo = CONVOS[active];

  return (
    <div className="glass u-lift rounded-2xl p-5 sm:p-6">
      {/* 对话 tab 条：体现无限新开窗口、互不干扰 */}
      <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1">
        <span className="shrink-0 text-xs text-accent border border-accent/40 rounded-lg px-2.5 py-1.5">
          + 新建
        </span>
        {CONVOS.map((c, i) => (
          <button
            key={c.title}
            onClick={() => setActive(i)}
            className={`shrink-0 text-xs rounded-lg px-2.5 py-1.5 transition-all duration-200 ${
              i === active
                ? "bg-accent/15 border border-accent/40 text-accent"
                : "bg-card/50 border border-white/5 text-muted hover:text-primary"
            }`}
          >
            {c.title}
          </button>
        ))}
      </div>

      {/* 消息区（切换淡入）*/}
      <div key={active} className="rise-in flex flex-col gap-3 min-h-[180px]">
        {convo.msgs.map((m, i) =>
          m.role === "user" ? (
            <div
              key={i}
              className="self-end bg-accent/20 rounded-2xl rounded-br-md px-4 py-2.5 text-accent text-sm max-w-[80%]"
            >
              {m.text}
            </div>
          ) : (
            <div
              key={i}
              className="self-start bg-background/40 border border-white/5 rounded-2xl rounded-bl-md px-4 py-3 text-sm text-muted leading-relaxed max-w-[92%]"
            >
              {m.text}
              {m.source && (
                <span className="block mt-2 text-accent/70 text-xs">📍 来源：{m.source}</span>
              )}
            </div>
          )
        )}
      </div>

      {/* 输入框 */}
      <div className="flex items-center gap-2 mt-3 bg-background/50 border border-white/5 rounded-xl px-3 py-2">
        <span className="text-muted text-sm flex-1">基于本章课件随时提问…</span>
        <span className="w-7 h-7 rounded-full bg-accent flex items-center justify-center text-white text-xs">
          ↑
        </span>
      </div>
    </div>
  );
}

function Ref({ children }: { children: React.ReactNode }) {
  return (
    <span className="mx-1 inline-flex items-center px-1.5 py-0.5 rounded-md border border-accent/40 text-accent text-xs align-middle">
      {children}
    </span>
  );
}
