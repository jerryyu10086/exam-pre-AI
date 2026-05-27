"use client";
import { useEffect, useImperativeHandle, useRef, useState, forwardRef } from "react";

const INPUT_MIN_H = 52;
const INPUT_MAX_H = 200;

export type ChatInputHandle = { setValue: (v: string) => void };

type Props = {
  onSend: (text: string) => Promise<boolean>;
  onStop: () => void;
  sending: boolean;
  placeholder?: string;
};

// 章节对话/全局对话共用的输入框
// - textarea 随内容增长，封顶后内部 chat-scrollbar 滚动
// - 右下角圆形按钮：空闲→↑发送、sending→■停止
const ChatInput = forwardRef<ChatInputHandle, Props>(function ChatInput(
  { onSend, onStop, sending, placeholder = "输入问题，Enter 发送，Shift+Enter 换行" },
  ref,
) {
  const [input, setInput] = useState("");
  const taRef = useRef<HTMLTextAreaElement>(null);

  useImperativeHandle(ref, () => ({
    setValue: (v) => {
      setInput(v);
      requestAnimationFrame(() => taRef.current?.focus());
    },
  }));

  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    const next = Math.min(Math.max(ta.scrollHeight, INPUT_MIN_H), INPUT_MAX_H);
    ta.style.height = `${next}px`;
  }, [input]);

  async function handleSend() {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    const ok = await onSend(text);
    if (!ok) setInput(text);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const hasText = input.trim().length > 0;
  const showStop = sending;
  const btnActive = showStop || hasText;

  return (
    <div className="border-t border-white/5 p-3 shrink-0">
      <div className="relative bg-background border border-white/5 rounded-2xl px-4 py-3 focus-within:border-accent/50 transition-colors">
        <textarea
          ref={taRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={1}
          style={{ minHeight: INPUT_MIN_H, maxHeight: INPUT_MAX_H }}
          className="chat-scrollbar w-full bg-transparent text-primary text-sm placeholder:text-muted outline-none resize-none pr-10 leading-relaxed"
        />
        <button
          onClick={showStop ? onStop : handleSend}
          disabled={!btnActive}
          aria-label={showStop ? "停止" : "发送"}
          className={`absolute right-2 bottom-2 w-8 h-8 flex items-center justify-center rounded-full transition-colors ${
            btnActive
              ? "bg-accent hover:bg-accent-hover text-primary cursor-pointer"
              : "bg-card-hover text-muted cursor-not-allowed"
          }`}
        >
          {showStop ? (
            <span className="block w-2.5 h-2.5 bg-primary rounded-[2px]" />
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="19" x2="12" y2="5" />
              <polyline points="5 12 12 5 19 12" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
});

export default ChatInput;
