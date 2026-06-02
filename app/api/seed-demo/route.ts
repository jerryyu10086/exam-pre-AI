import { NextResponse } from "next/server";
import { createServiceClient, getUserFromRequest } from "@/lib/supabase";
import { DEMO_TEMPLATE_EXAM_ID, DEMO_EXAM_NAME } from "@/lib/demo-seed";

export async function POST() {
  try {
    const user = await getUserFromRequest();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const supabase = createServiceClient();

    // 该用户已有 demo 学科则跳过
    const { data: existing } = await supabase
      .from("exams")
      .select("id")
      .eq("user_id", user.id)
      .eq("is_demo", true)
      .maybeSingle();

    if (existing) return NextResponse.json({ skipped: true });

    // 从模板 exam 读取 plans.data
    const { data: templatePlan } = await supabase
      .from("plans")
      .select("data")
      .eq("exam_id", DEMO_TEMPLATE_EXAM_ID)
      .maybeSingle();

    if (!templatePlan?.data) return NextResponse.json({ skipped: true });

    // 创建 demo 学科
    const { data: exam, error: examError } = await supabase
      .from("exams")
      .insert({ name: DEMO_EXAM_NAME, user_id: user.id, is_demo: true })
      .select("id")
      .single();

    if (examError || !exam) {
      return NextResponse.json({ error: examError?.message }, { status: 500 });
    }

    // 写入复习计划（直接复用模板数据）
    const { error: planError } = await supabase
      .from("plans")
      .insert({ exam_id: exam.id, data: templatePlan.data });

    if (planError) {
      await supabase.from("exams").delete().eq("id", exam.id);
      return NextResponse.json({ error: planError.message }, { status: 500 });
    }

    return NextResponse.json({ created: true });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
