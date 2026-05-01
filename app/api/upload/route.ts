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
