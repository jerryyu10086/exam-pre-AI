"use client";
import { Suspense, useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { useRouter, useSearchParams } from "next/navigation";

function CallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState("验证中...");

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    let done = false;

    async function finish(session: boolean) {
      if (done) return;
      done = true;
      if (session) {
        setStatus("登录成功，跳转中...");
        router.replace("/home");
      } else {
        setStatus("验证失败，请重新登录");
        setTimeout(() => router.replace("/login"), 1500);
      }
    }

    // 监听 auth 状态变化（适配 implicit flow 和 PKCE 两种模式）
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) {
        finish(true);
      }
    });

    // PKCE flow：URL 里有 code 参数
    const code = searchParams.get("code");
    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
        if (error) {
          console.error("exchangeCodeForSession error:", error);
          finish(false);
        }
        // 成功后 onAuthStateChange 会触发 SIGNED_IN
      });
    }

    // 兜底：3秒后若还没完成，检查一次 session
    const timer = setTimeout(async () => {
      const { data: { session } } = await supabase.auth.getSession();
      finish(!!session);
    }, 3000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timer);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <p className="text-muted text-sm">{status}</p>;
}

export default function AuthCallbackPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3">
      <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      <Suspense fallback={<p className="text-muted text-sm">加载中...</p>}>
        <CallbackHandler />
      </Suspense>
    </div>
  );
}
