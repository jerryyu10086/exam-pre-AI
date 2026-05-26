"use client";
import { useState, useCallback, useRef } from "react";

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
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null);
  const abortRef = useRef<AbortController | null>(null);

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

    const controller = new AbortController();
    abortRef.current = controller;

    setStatus("uploading");
    setMessage("");
    setUploadProgress({ current: 0, total: pendingFiles.length });

    try {
      let totalChunks = 0;
      let idx = 0;
      for (const { file, hasAnswers } of pendingFiles) {
        if (controller.signal.aborted) return;
        setUploadProgress({ current: idx + 1, total: pendingFiles.length });
        const form = new FormData();
        form.append("file", file);
        form.append("exam_id", examId);
        form.append("material_type", materialType);
        if (materialType === "exam") {
          form.append("has_answers", String(hasAnswers));
        }

        const res = await fetch("/api/upload", { method: "POST", body: form, signal: controller.signal });
        const data = await res.json();

        if (!res.ok) {
          setStatus("error");
          setMessage(data.error ?? "上传失败");
          setUploadProgress(null);
          return;
        }
        totalChunks += data.chunks as number;
        idx++;
      }

      setUploadProgress(null);
      setStatus("success");
      setMessage("已存入知识库");
      setPendingFiles([]);
      await loadUploadedFiles();
      if (materialType !== "textbook") {
        try { sessionStorage.removeItem(`p2_${examId}`); } catch {}
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      setStatus("error");
      setMessage("上传失败，请重试");
      setUploadProgress(null);
    }
  }

  function cancelUpload() {
    abortRef.current?.abort();
    setStatus("idle");
    setMessage("");
    setUploadProgress(null);
  }

  function toggleSelect(name: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selected.size === uploadedFiles.length && uploadedFiles.length > 0) {
      setSelected(new Set());
    } else {
      setSelected(new Set(uploadedFiles.map((f) => f.name)));
    }
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
      // 知识库变更后让 Page 2 重新计算 isStale
      if (materialType !== "textbook") {
        try { sessionStorage.removeItem(`p2_${examId}`); } catch {}
      }
    }
    setDeleting(false);
  }

  return {
    pendingFiles, status, message, addFiles, removeFile, togglePendingHasAnswers, saveToKnowledgeBase, cancelUpload,
    uploadedFiles, editMode, selected, deleting,
    uploadProgress,
    loadUploadedFiles, toggleSelect, toggleSelectAll, toggleEditMode, deleteFiles,
  };
}
