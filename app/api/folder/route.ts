import { NextRequest, NextResponse } from "next/server";
import { createServiceClient, getUserFromRequest } from "@/lib/supabase";
import { isDemoRequest, DEMO_403 } from "@/lib/demo";

export async function GET(request: NextRequest) {
  const supabase = createServiceClient();

  if (isDemoRequest(request)) {
    const { data, error } = await supabase
      .from("folders")
      .select("id, name, created_at")
      .is("user_id", null)
      .order("created_at", { ascending: true });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data ?? []);
  }

  const user = await getUserFromRequest();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("folders")
    .select("id, name, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function DELETE(request: NextRequest) {
  if (isDemoRequest(request)) return NextResponse.json(DEMO_403, { status: 403 });
  try {
    const user = await getUserFromRequest();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { ids, delete_exams } = await request.json();
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "ids required" }, { status: 400 });
    }
    const supabase = createServiceClient();
    // 只操作属于当前用户的文件夹
    if (delete_exams) {
      await supabase.from("exams").delete().in("folder_id", ids).eq("user_id", user.id);
    } else {
      await supabase.from("exams").update({ folder_id: null }).in("folder_id", ids).eq("user_id", user.id);
    }
    const { error } = await supabase.from("folders").delete().in("id", ids).eq("user_id", user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  if (isDemoRequest(request)) return NextResponse.json(DEMO_403, { status: 403 });
  try {
    const user = await getUserFromRequest();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id, name } = await request.json();
    if (!id || !name?.trim()) {
      return NextResponse.json({ error: "id and name required" }, { status: 400 });
    }
    const supabase = createServiceClient();
    const { error } = await supabase
      .from("folders")
      .update({ name: name.trim() })
      .eq("id", id)
      .eq("user_id", user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (isDemoRequest(request)) return NextResponse.json(DEMO_403, { status: 403 });
  try {
    const user = await getUserFromRequest();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { name } = await request.json();
    if (!name?.trim()) {
      return NextResponse.json({ error: "Name required" }, { status: 400 });
    }
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("folders")
      .insert({ name: name.trim(), user_id: user.id })
      .select("id, name")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
