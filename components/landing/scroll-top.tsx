"use client";

import { useEffect } from "react";

/**
 * 落地页返回即回顶。
 * 默认浏览器/Next 会在后退时恢复上次滚动位置（点底部 CTA 进入 /home 再返回会停在底部）。
 * 这里在挂载与 bfcache 恢复时强制滚到顶部，覆盖默认恢复行为。
 */
export default function ScrollTop() {
  useEffect(() => {
    const toTop = () => window.scrollTo(0, 0);

    // 立即 + 连续两帧，盖过浏览器/Next 在渲染后执行的滚动恢复
    toTop();
    requestAnimationFrame(() => {
      toTop();
      requestAnimationFrame(toTop);
    });

    // bfcache 返回（persisted）时也回顶
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) toTop();
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);

  return null;
}
