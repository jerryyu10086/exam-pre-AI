"use client";
import { useState } from "react";

type UploadStatus = "idle" | "uploading" | "success" | "error";

export function useFileUpload(examId: string, materialType: string) {
  const [files, setFiles] = useState<File[]>([]);
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [message, setMessage] = useState("");

  function addFiles(incoming: File[]) {
    setFiles((prev) => [...prev, ...incoming]);
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function saveToKnowledgeBase() {
    if (files.length === 0) return;
    setStatus("uploading");
    setMessage("");

    let totalChunks = 0;
    for (const file of files) {
      const form = new FormData();
      form.append("file", file);
      form.append("exam_id", examId);
      form.append("material_type", materialType);

      const res = await fetch("/api/upload", { method: "POST", body: form });
      const data = await res.json();

      if (!res.ok) {
        setStatus("error");
        setMessage(data.error ?? "上传失败");
        return;
      }
      totalChunks += data.chunks as number;
    }

    setStatus("success");
    setMessage(`已存入知识库，共 ${totalChunks} 个内容块`);
  }

  return { files, status, message, addFiles, removeFile, saveToKnowledgeBase };
}
