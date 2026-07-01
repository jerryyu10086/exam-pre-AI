import { NextRequest, NextResponse } from "next/server";
import { createServiceClient, getUserFromRequest } from "@/lib/supabase";
import { isDemoRequest, DEMO_403 } from "@/lib/demo";

type MaterialCounts = { slides: number; exam: number; textbook: number };

// 给每个学科挂上按 material_type 去重后的文件数（课件/真题/课本）
async function withCounts<T extends { id: string }>(
  supabase: ReturnType<typeof createServiceClient>,
  exams: T[]
): Promise<(T & { counts: MaterialCounts })[]> {
  if (exams.length === 0) return [];
  const ids = exams.map((e) => e.id);
  const { data: chunks } = await supabase
    .from("chunks")
    .select("exam_id, file_name, material_type")
    .in("exam_id", ids);

  const counts: Record<string, MaterialCounts> = {};
  for (const id of ids) counts[id] = { slides: 0, exam: 0, textbook: 0 };

  const seen = new Set<string>(); // 同一学科同一类型内文件名去重
  for (const c of chunks ?? []) {
    const bucket = counts[c.exam_id as string];
    const mt = c.material_type as keyof MaterialCounts;
    if (!bucket || !c.file_name || !(mt in bucket)) continue;
    const key = `${c.exam_id}::${mt}::${c.file_name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    bucket[mt]++;
  }

  return exams.map((e) => ({ ...e, counts: counts[e.id] }));
}

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
    return NextResponse.json(await withCounts(supabase, data ?? []));
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
  return NextResponse.json(await withCounts(supabase, data ?? []));
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
