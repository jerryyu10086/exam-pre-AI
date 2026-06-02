import { NextRequest, NextResponse } from "next/server";
import { createServiceClient, getUserFromRequest } from "@/lib/supabase";
import { isDemoRequest, DEMO_403 } from "@/lib/demo";

export async function POST(request: NextRequest) {
  if (isDemoRequest(request)) return NextResponse.json(DEMO_403, { status: 403 });
  try {
    const user = await getUserFromRequest();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { name, folder_id } = await request.json();
    if (!name?.trim()) {
      return NextResponse.json({ error: "Name required" }, { status: 400 });
    }
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("exams")
      .insert({ name: name.trim(), folder_id: folder_id ?? null, user_id: user.id })
      .select("id")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const supabase = createServiceClient();

  // 演示模式：返回无主（user_id IS NULL）的学科
  if (isDemoRequest(request)) {
    const { data, error } = await supabase
      .from("exams")
      .select("id, name, folder_id, created_at")
      .is("user_id", null)
      .order("created_at", { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data ?? []);
  }

  const user = await getUserFromRequest();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const folderId = searchParams.get("folder_id");

  let query = supabase
    .from("exams")
    .select("id, name, folder_id, is_demo, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (folderId) query = query.eq("folder_id", folderId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function DELETE(request: NextRequest) {
  if (isDemoRequest(request)) return NextResponse.json(DEMO_403, { status: 403 });
  try {
    const user = await getUserFromRequest();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { ids } = await request.json();
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "ids required" }, { status: 400 });
    }
    const supabase = createServiceClient();
    const { error } = await supabase
      .from("exams")
      .delete()
      .in("id", ids)
      .eq("user_id", user.id);
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

    const { id, exam_types, has_answers, name, folder_id } = await request.json();
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    const supabase = createServiceClient();
    const updates: Record<string, unknown> = {};
    if (exam_types !== undefined) updates.exam_types = exam_types;
    if (has_answers !== undefined) updates.has_answers = has_answers;
    if (name !== undefined) updates.name = name.trim();
    if (folder_id !== undefined) updates.folder_id = folder_id;

    const { error } = await supabase
      .from("exams")
      .update(updates)
      .eq("id", id)
      .eq("user_id", user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
