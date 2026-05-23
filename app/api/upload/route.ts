import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { parsePdf, parsePdfPages, chunkSlides, chunkExam, chunkTextbook } from "@/lib/pdf";
import { parseDocx } from "@/lib/docx";
import { parseIpynb } from "@/lib/ipynb";
import { embedBatch } from "@/lib/embeddings";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const examId = formData.get("exam_id") as string | null;
    const materialType = formData.get("material_type") as string | null;

    if (!file || !examId || !materialType) {
      return NextResponse.json({ error: "缺少必要字段" }, { status: 400 });
    }

    const hasAnswersRaw = formData.get("has_answers") as string | null;
    const hasAnswers = hasAnswersRaw !== null ? hasAnswersRaw === "true" : null;

    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";

    let chunks: string[] = [];

    if (ext === "pdf") {
      if (materialType === "slides") {
        chunks = chunkSlides(await parsePdfPages(buffer));
      } else if (materialType === "exam") {
        chunks = chunkExam(await parsePdf(buffer));
      } else {
        chunks = chunkTextbook(await parsePdf(buffer));
      }
    } else if (ext === "docx") {
      const text = await parseDocx(buffer);
      chunks = materialType === "exam" ? chunkExam(text) : [text];
    } else if (ext === "ipynb") {
      chunks = [parseIpynb(buffer.toString("utf-8"))];
    } else if (ext === "md" || ext === "py") {
      const text = buffer.toString("utf-8");
      chunks = materialType === "textbook" ? chunkTextbook(text) : [text];
    } else {
      return NextResponse.json(
        { error: "不支持的文件格式。支持 PDF / MD / PY / IPYNB / Word(.docx)" },
        { status: 400 }
      );
    }

    chunks = chunks.filter((c) => c.trim().length > 0);
    if (chunks.length === 0) {
      return NextResponse.json({ error: "文件内容为空" }, { status: 400 });
    }

    const embeddings = await embedBatch(chunks);

    const supabase = createServiceClient();
    const { error } = await supabase.from("chunks").insert(
      chunks.map((content, i) => ({
        exam_id: examId,
        file_name: file.name,
        material_type: materialType,
        content,
        embedding: embeddings[i],
        chunk_index: i,
        has_answers: hasAnswers,
      }))
    );

    if (error) {
      console.error("Supabase insert error:", error);
      return NextResponse.json({ error: "存储失败" }, { status: 500 });
    }

    return NextResponse.json({ success: true, chunks: chunks.length });
  } catch (err) {
    console.error("Upload error:", err);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

// 列出已上传文件（按 file_name 聚合）
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const examId = searchParams.get("exam_id");
  const materialType = searchParams.get("material_type");

  if (!examId || !materialType) {
    return NextResponse.json({ error: "缺少参数" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("chunks")
    .select("file_name, chunk_index, has_answers")
    .eq("exam_id", examId)
    .eq("material_type", materialType);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const fileMap = new Map<string, { chunks: number; has_answers: boolean | null }>();
  for (const row of data ?? []) {
    if (!fileMap.has(row.file_name)) {
      fileMap.set(row.file_name, { chunks: 0, has_answers: row.has_answers ?? null });
    }
    fileMap.get(row.file_name)!.chunks += 1;
  }

  return NextResponse.json(
    Array.from(fileMap.entries()).map(([name, { chunks, has_answers }]) => ({ name, chunks, has_answers }))
  );
}

// 删除指定文件的所有 chunks
export async function DELETE(request: NextRequest) {
  try {
    const { exam_id, material_type, file_names } = await request.json();

    if (!exam_id || !material_type || !Array.isArray(file_names) || file_names.length === 0) {
      return NextResponse.json({ error: "缺少参数" }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { error } = await supabase
      .from("chunks")
      .delete()
      .eq("exam_id", exam_id)
      .eq("material_type", material_type)
      .in("file_name", file_names);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // maps_cache 保留不动：Page 2 通过对比 maps_cache 与当前 chunks 检测过期状态
    // re-analysis 时会按当前 chunks 过滤掉已删文件并写入干净的 maps_cache

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Delete error:", err);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}
