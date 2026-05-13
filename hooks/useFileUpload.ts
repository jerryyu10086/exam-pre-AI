"use client";
import { useState, useCallback } from "react";

type UploadStatus = "idle" | "uploading" | "success" | "error";

export interface PendingFile {
  file: File;
  hasAnswers: boolean;
}

export interface UploadedFile {
  name: string;
  chunks: number;
  has_answers: boolean | null;
}

export function useFileUpload(examId: string, materialType: string) {
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
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
    setPendingFiles((prev) => [
      ...prev,
      ...incoming.map((file) => ({ file, hasAnswers: true })),
    ]);
  }

  function removeFile(index: number) {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
  }

  function togglePendingHasAnswers(index: number) {
    setPendingFiles((prev) =>
      prev.map((p, i) => (i === index ? { ...p, hasAnswers: !p.hasAnswers } : p))
    );
  }

  async function saveToKnowledgeBase() {
    if (pendingFiles.length === 0) return;
    setStatus("uploading");
    setMessage("");

    let totalChunks = 0;
    for (const { file, hasAnswers } of pendingFiles) {
      const form = new FormData();
      form.append("file", file);
      form.append("exam_id", examId);
      form.append("material_type", materialType);
      if (materialType === "exam") {
        form.append("has_answers", String(hasAnswers));
      }

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
    setMessage("已存入知识库");
    setPendingFiles([]);
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
    pendingFiles, status, message, addFiles, removeFile, togglePendingHasAnswers, saveToKnowledgeBase,
    uploadedFiles, editMode, selected, deleting,
    loadUploadedFiles, toggleSelect, toggleEditMode, deleteFiles,
  };
}
