"use client";
import { useParams } from "next/navigation";
import { useRef } from "react";
import { useFileUpload } from "@/hooks/useFileUpload";

const LABELS: Record<string, string> = {
  slides: "课件",
  exam: "真题",
  textbook: "课本",
};

const ACCEPTED: Record<string, string> = {
  slides: ".pdf,.md,.py,.ipynb",
  exam: ".pdf,.docx,.md,.py,.ipynb",
  textbook: ".pdf",
};

const FORMAT_HINT: Record<string, string> = {
  slides: "PDF / MD / PY / IPYNB",
  exam: "PDF / Word(.docx) / MD / PY / IPYNB",
  textbook: "PDF",
};

export default function UploadPage() {
  const params = useParams<{ id: string; type: string }>();
  const inputRef = useRef<HTMLInputElement>(null);
  const { files, status, message, addFiles, removeFile, saveToKnowledgeBase } =
    useFileUpload(params.id, params.type);

  const label = LABELS[params.type] ?? params.type;
  const accepted = ACCEPTED[params.type] ?? ".pdf";
  const formatHint = FORMAT_HINT[params.type] ?? "PDF";

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files?.length) {
      addFiles(Array.from(e.target.files));
      e.target.value = "";
    }
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-lg font-semibold text-primary mb-1">{label}</h1>
        <p className="text-muted text-sm mb-6">
          上传材料越接近实际考试，分析结果越准确
        </p>

        {/* 上传区 */}
        <div
          className="border-2 border-dashed border-white/10 rounded-lg p-10 text-center mb-4 cursor-pointer hover:border-accent/40 transition-colors bg-card"
          onClick={() => inputRef.current?.click()}
        >
          <p className="text-primary text-sm">点击选择文件</p>
          <p className="text-muted text-xs mt-1">支持 {formatHint}</p>
          <p className="text-muted text-xs mt-1">
            如需上传 PPT 或图片，请先另存为 PDF
          </p>
        </div>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={accepted}
          onChange={handleChange}
          className="hidden"
        />

        {/* 文件卡片 */}
        {files.length > 0 && (
          <div className="flex flex-col gap-3 mb-6">
            {files.map((file, i) => (
              <div
                key={i}
                className="flex items-center bg-card border border-white/5 rounded-lg p-4"
              >
                <span className="text-primary text-sm truncate flex-1">
                  {file.name}
                </span>
                <span className="text-muted text-xs mx-3 shrink-0">
                  {(file.size / 1024).toFixed(0)} KB
                </span>
                <button
                  onClick={() => removeFile(i)}
                  className="text-muted hover:text-primary text-xs shrink-0"
                >
                  移除
                </button>
              </div>
            ))}
          </div>
        )}

        {/* 状态提示 */}
        {message && (
          <p
            className={`text-sm mb-4 ${
              status === "error"
                ? "text-tier-must"
                : status === "success"
                  ? "text-tier-expand"
                  : "text-muted"
            }`}
          >
            {message}
          </p>
        )}

        {/* 提交按钮 */}
        <button
          onClick={saveToKnowledgeBase}
          disabled={files.length === 0 || status === "uploading"}
          className="w-full bg-accent hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-primary rounded-md py-2 text-sm font-medium transition-colors"
        >
          {status === "uploading" ? "处理中..." : "存入知识库"}
        </button>
      </div>
    </div>
  );
}
