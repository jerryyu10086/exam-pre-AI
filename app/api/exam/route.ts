import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  try {
    const { name, folder_id } = await request.json();
    if (!name?.trim()) {
      return NextResponse.json({ error: "Name required" }, { status: 400 });
    }
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("exams")
      .insert({ name: name.trim(), folder_id: folder_id ?? null })
      .select("id")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const folderId = searchParams.get("folder_id");

  const supabase = createServiceClient();
  let query = supabase
    .from("exams")
    .select("id, name, folder_id, created_at")
    .order("created_at", { ascending: false });

  if (folderId) query = query.eq("folder_id", folderId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function DELETE(request: NextRequest) {
  try {
    const { ids } = await request.json();
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "ids required" }, { status: 400 });
    }
    const supabase = createServiceClient();
    const { error } = await supabase.from("exams").delete().in("id", ids);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PATCH /api/exam  —  更新 exam 配置（exam_types / has_answers / name / folder_id）
export async function PATCH(request: NextRequest) {
  try {
    const { id, exam_types, has_answers, name, folder_id } = await request.json();
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    const supabase = createServiceClient();
    const updates: Record<string, unknown> = {};
    if (exam_types !== undefined) updates.exam_types = exam_types;
    if (has_answers !== undefined) updates.has_answers = has_answers;
    if (name !== undefined) updates.name = name.trim();
    if (folder_id !== undefined) updates.folder_id = folder_id; // 支持 null（移出文件夹）

    const { error } = await supabase.from("exams").update(updates).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
