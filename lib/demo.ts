import { NextRequest } from "next/server";

export const DEMO_COOKIE = "demo_mode";

// 服务端（API route / middleware）
export function isDemoRequest(request: NextRequest): boolean {
  return request.cookies.get(DEMO_COOKIE)?.value === "1";
}

// 客户端（页面组件）
export function isDemoModeBrowser(): boolean {
  if (typeof window === "undefined") return false;
  return document.cookie.includes(`${DEMO_COOKIE}=1`);
}

export const DEMO_403 = { error: "demo_mode", message: "演示模式不支持此操作，请注册登录后使用" };
