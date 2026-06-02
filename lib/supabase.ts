import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// 浏览器端客户端（用于登录页等客户端组件）
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// 服务端专用客户端（绕过 RLS，仅在 API routes 中配合 getUserFromRequest 使用）
export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// API route 中创建带 cookie 的 auth 客户端，用于读取当前登录用户
export async function createAuthClient() {
  const cookieStore = await cookies();
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() { return cookieStore.getAll(); },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // API route 中 set cookie 失败时忽略（只读 cookieStore）
        }
      },
    },
  });
}

// 从请求中获取当前登录用户，未登录返回 null
export async function getUserFromRequest(_req?: NextRequest) {
  const client = await createAuthClient();
  const { data: { user } } = await client.auth.getUser();
  return user;
}
