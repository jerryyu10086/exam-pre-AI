"use client";
import { useEffect } from "react";

/**
 * 全局 KaTeX 复制修复：
 * 浏览器复制含 KaTeX 公式的段落时，公式内部嵌套的 inline-block 元素（vlist 等）
 * 会被识别为换行边界，导致粘贴结果中每个公式前后断行。
 * 这里拦截 copy 事件，把选区内的 .katex 节点替换为其 innerText（自然渲染顺序的
 * 纯文本，如「F̂₂₁ = q₁q₂/(4πε₀r²)」），再写入剪贴板。
 *
 * 安全保障：仅当选区实际包含 .katex 节点时才介入；纯文字段落保持浏览器默认行为，
 * 富文本格式（粗体/斜体/列表/链接）零影响。
 */
export default function KatexCopyFix() {
  useEffect(() => {
    function handleCopy(e: ClipboardEvent) {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return;

      const range = selection.getRangeAt(0);

      // 先用一次性 fragment 检测：选区中是否含 .katex 节点；不含则放任默认行为
      const probe = range.cloneContents();
      const hasKatex =
        probe.querySelector?.(".katex") != null ||
        // 选区起点/终点在 .katex 内部时，cloneContents 可能不包含其根元素
        (range.startContainer as Element)?.closest?.(".katex") != null ||
        (range.endContainer as Element)?.closest?.(".katex") != null;
      if (!hasKatex) return;

      // 介入：先删掉 mathml 层（含 <annotation> LaTeX 源码），detached fragment
      // 的 innerText 会 fallback 到 textContent 并包含 display:none 内容，必须手动移除
      const fragment = range.cloneContents();
      fragment.querySelectorAll(".katex-mathml").forEach((n) => n.remove());
      // 再把每个 .katex 节点替换为其纯文本（此时只剩 html 渲染层的 unicode 字符）
      fragment.querySelectorAll(".katex").forEach((node) => {
        const text = node.textContent || "";
        node.parentNode?.replaceChild(document.createTextNode(text), node);
      });

      // 用临时容器拿到处理后的可见文本
      const container = document.createElement("div");
      container.appendChild(fragment);
      const cleanText = container.innerText;

      if (!e.clipboardData) return;
      e.clipboardData.setData("text/plain", cleanText);
      e.preventDefault();
    }

    document.addEventListener("copy", handleCopy);
    return () => document.removeEventListener("copy", handleCopy);
  }, []);

  return null;
}
