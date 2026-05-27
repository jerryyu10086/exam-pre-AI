"use client";
import { useEffect, useState } from "react";

// 非流式回答时的等待气泡：单一文案 + 三点跳动 + 已等待秒数
export default function ChatThinking() {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const start = Date.now();
    const id = setInterval(() => {
      setSeconds(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex justify-start">
      <div className="bg-background border border-white/5 rounded-lg px-3 py-2 flex items-center gap-2">
        <span className="text-muted text-sm">正在检索知识库并生成回答</span>
        <span className="inline-flex items-center gap-1">
          <span className="thinking-dot" />
          <span className="thinking-dot" />
          <span className="thinking-dot" />
        </span>
        <span className="text-muted text-xs">已等待 {seconds} 秒</span>
      </div>
    </div>
  );
}
