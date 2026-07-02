import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

// 不需要登录就能访问的路径
const PUBLIC_PATHS = ["/", "/landing", "/login", "/auth"];

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  let user = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch {
    // 网络异常时放行，让页面自行处理 auth 状态
  }

  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));

  const isDemoMode = request.cookies.get("demo_mode")?.value === "1";

  if (!user && !isPublic && !isDemoMode) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // 已登录时访问 /login 直接跳回首页
  if (user && pathname === "/login") {
    return NextResponse.redirect(new URL("/home", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
