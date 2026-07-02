"use client";

import { useRef, type ReactNode, type CSSProperties } from "react";

/**
 * 光标跟随聚光卡（framer 风格互动感）
 * 鼠标在卡内移动时，一束柔光跟随光标位置，配合上浮 + 边框提亮，
 * 制造"模块随手感响应"的高级层次感。纯 CSS 变量驱动，不触发 React 重渲染。
 *
 * 复用：给任意卡片外壳套用即可，className 里继续带 .glass .u-lift 等质感类。
 * 记得在需要图标/内容联动的场景加 `group`（本组件默认已加）。
 */
export default function SpotlightCard({
  className = "",
  children,
  style,
}: {
  className?: string;
  children: ReactNode;
  style?: CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);

  function handleMove(e: React.MouseEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    // 直接写 CSS 变量，绕开 React state，指针移动零重渲染
    el.style.setProperty("--mx", `${e.clientX - rect.left}px`);
    el.style.setProperty("--my", `${e.clientY - rect.top}px`);
  }

  return (
    <div
      ref={ref}
      onMouseMove={handleMove}
      style={style}
      className={`spotlight-card group ${className}`}
    >
      {/* 跟随光标的柔光层（hover 时淡入） */}
      <div className="spotlight-glow" aria-hidden="true" />
      {/* 内容需要在光层之上 */}
      <div className="relative z-[1] flex flex-col gap-4 h-full">{children}</div>
    </div>
  );
}
