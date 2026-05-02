"use client";
import { useState, useCallback } from "react";

type UploadStatus = "idle" | "uploading" | "success" | "error";

export interface UploadedFile {
  name: string;
  chunks: number;
}

export function useFileUpload(examId: string, materialType: string) {
  const [files, setFiles] = useState<File[]>([]);
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [message, setMessage] = useState("");

  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [editMode, setEditMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  const loadUploadedFiles = useCallback(async () => {
    const res = await fetch(
      `/api/upload?exam_id=${examId}&material_type=${materialType}`
    );
    if (res.ok) setUploadedFiles(await res.json());
  }, [examId, materialType]);

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
    setFiles([]);
    await loadUploadedFiles();
  }

  function toggleSelect(name: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  }

  function toggleEditMode() {
    setEditMode((prev) => !prev);
    setSelected(new Set());
  }

  async function deleteFiles(fileNames: string[]) {
    setDeleting(true);
    const res = await fetch("/api/upload", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        exam_id: examId,
        material_type: materialType,
        file_names: fileNames,
      }),
    });
    if (res.ok) {
      await loadUploadedFiles();
      setSelected(new Set());
    }
    setDeleting(false);
  }

  return {
    files, status, message, addFiles, removeFile, saveToKnowledgeBase,
    uploadedFiles, editMode, selected, deleting,
    loadUploadedFiles, toggleSelect, toggleEditMode, deleteFiles,
  };
}
