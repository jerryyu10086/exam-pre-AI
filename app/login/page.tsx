"use client";
import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";
import { DEMO_COOKIE } from "@/lib/demo";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function sendOtp() {
    setError("");
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: true },
    });
    setLoading(false);
    if (error) {
      setError(error.message.includes("invalid") ? "请输入正确格式的邮箱" : error.message);
      return;
    }
    setStep("code");
  }

  function enterDemo() {
    document.cookie = `${DEMO_COOKIE}=1; path=/; max-age=86400`;
    window.location.href = "/home";
  }

  async function verifyCode() {
    setError("");
    setLoading(true);
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: code.trim(),
      type: "email",
    });
    setLoading(false);
    if (error) { setError("验证码错误或已过期，请重试"); return; }
    router.replace("/home");
  }

  return (
    <div className="isolate relative min-h-screen flex flex-col items-center justify-center px-4 pb-32 overflow-hidden">
      {/* 宇宙图背景，与首页统一（垫在最底层） */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="cosmos-photo" />
        <div className="cosmos-vignette" />
        <div className="cosmos-grade" />
        <div className="grain" />
      </div>

      <div className="relative mb-8 text-center rise-in">
        <div className="text-gradient font-bold text-3xl tracking-tight mb-1">度月如日</div>
        <p className="text-muted text-sm">备考AI · 登录 / 注册</p>
      </div>

      <div className="glass rounded-2xl p-6 w-full max-w-sm relative rise-in" style={{ animationDelay: "0.08s" }}>
        {step === "email" ? (
          <>
            <p className="text-primary text-sm font-medium mb-4">输入邮箱，获取验证码</p>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") sendOtp(); }}
              placeholder="your@email.com"
              autoFocus
              className="w-full bg-background border border-white/10 rounded-md px-3 py-2 text-primary text-sm placeholder:text-muted focus:placeholder-transparent outline-none focus:border-accent/50 transition-colors mb-3"
            />
            {error && <p className="text-tier-must text-xs mb-3">{error}</p>}
            <button
              onClick={sendOtp}
              disabled={loading || !email.trim()}
              className="btn-glow w-full disabled:opacity-50 disabled:pointer-events-none text-white rounded-lg py-2.5 text-sm font-semibold"
            >
              {loading ? "发送中..." : "发送验证码"}
            </button>
          </>
        ) : (
          <>
            <p className="text-primary text-sm font-medium mb-1">输入验证码</p>
            <p className="text-muted text-xs mb-4">已发送至 {email}</p>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 8))}
              onKeyDown={(e) => { if (e.key === "Enter") verifyCode(); }}
              placeholder="验证码"
              autoFocus
              className="w-full bg-background border border-white/10 rounded-md px-3 py-2 text-primary text-sm placeholder:text-muted focus:placeholder-transparent outline-none focus:border-accent/50 transition-colors mb-3 tracking-widest text-center"
            />
            {error && <p className="text-tier-must text-xs mb-3">{error}</p>}
            <button
              onClick={verifyCode}
              disabled={loading || code.trim().length < 1}
              className="btn-glow w-full disabled:opacity-50 disabled:pointer-events-none text-white rounded-lg py-2.5 text-sm font-semibold mb-2"
            >
              {loading ? "验证中..." : "登录"}
            </button>
            <button
              onClick={() => { setStep("email"); setCode(""); setError(""); }}
              className="w-full text-muted text-xs hover:text-primary transition-colors py-1"
            >
              重新输入邮箱
            </button>
          </>
        )}
      </div>

      <button
        onClick={enterDemo}
        className="relative mt-4 text-white/70 text-xs hover:text-white transition-colors underline underline-offset-2"
        style={{ textShadow: "0 2px 12px rgba(0,0,0,0.6)" }}
      >
        无需注册，直接体验演示
      </button>

      <p
        className="relative mt-4 text-white/70 text-xs"
        style={{ textShadow: "0 2px 12px rgba(0,0,0,0.6)" }}
      >
        输入邮箱即视为同意服务条款 · 首次登录自动注册
      </p>
    </div>
  );
}
