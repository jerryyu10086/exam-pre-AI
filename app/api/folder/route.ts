import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

export async function GET() {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("folders")
    .select("id, name, created_at")
    .order("created_at", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function DELETE(request: NextRequest) {
  try {
    const { ids, delete_exams } = await request.json();
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "ids required" }, { status: 400 });
    }
    const supabase = createServiceClient();
    if (delete_exams) {
      await supabase.from("exams").delete().in("folder_id", ids);
    } else {
      await supabase.from("exams").update({ folder_id: null }).in("folder_id", ids);
    }
    const { error } = await supabase.from("folders").delete().in("id", ids);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { id, name } = await request.json();
    if (!id || !name?.trim()) {
      return NextResponse.json({ error: "id and name required" }, { status: 400 });
    }
    const supabase = createServiceClient();
    const { error } = await supabase
      .from("folders")
      .update({ name: name.trim() })
      .eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { name } = await request.json();
    if (!name?.trim()) {
      return NextResponse.json({ error: "Name required" }, { status: 400 });
    }
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("folders")
      .insert({ name: name.trim() })
      .select("id, name")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
