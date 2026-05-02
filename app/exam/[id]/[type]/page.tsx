"use client";
import { useParams } from "next/navigation";
import { useRef, useEffect, useState } from "react";
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
  const [confirmDelete, setConfirmDelete] = useState<string[] | null>(null);

  const {
    files, status, message, addFiles, removeFile, saveToKnowledgeBase,
    uploadedFiles, editMode, selected, deleting,
    loadUploadedFiles, toggleSelect, toggleEditMode, deleteFiles,
  } = useFileUpload(params.id, params.type);

  useEffect(() => {
    loadUploadedFiles();
  }, [loadUploadedFiles]);

  const label = LABELS[params.type] ?? params.type;
  const accepted = ACCEPTED[params.type] ?? ".pdf";
  const formatHint = FORMAT_HINT[params.type] ?? "PDF";

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files?.length) {
      addFiles(Array.from(e.target.files));
      e.target.value = "";
    }
  }

  async function handleConfirmDelete() {
    if (!confirmDelete) return;
    await deleteFiles(confirmDelete);
    setConfirmDelete(null);
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-2xl mx-auto">

        {/* 标题栏 */}
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-lg font-semibold text-primary">{label}</h1>
          {uploadedFiles.length > 0 && (
            <button
              onClick={toggleEditMode}
              className="text-sm text-muted hover:text-primary transition-colors"
            >
              {editMode ? "完成" : "编辑"}
            </button>
          )}
        </div>
        <p className="text-muted text-sm mb-6">
          上传材料越接近实际考试，分析结果越准确
        </p>

        {/* 已在知识库的文件 */}
        {uploadedFiles.length > 0 && (
          <div className="mb-6">
            <p className="text-muted text-xs mb-2">已在知识库</p>
            <div className="flex flex-col gap-2">
              {uploadedFiles.map((file) => (
                <div
                  key={file.name}
                  className="flex items-center bg-card border border-white/5 rounded-lg p-4"
                >
                  {editMode && (
                    <input
                      type="checkbox"
                      checked={selected.has(file.name)}
                      onChange={() => toggleSelect(file.name)}
                      className="mr-3 accent-accent w-4 h-4 shrink-0 cursor-pointer"
                    />
                  )}
                  <span className="text-primary text-sm truncate flex-1">
                    {file.name}
                  </span>
                  <span className="text-muted text-xs mx-3 shrink-0">
                    {file.chunks} 块
                  </span>
                  {editMode && (
                    <button
                      onClick={() => setConfirmDelete([file.name])}
                      className="text-tier-must text-xs hover:opacity-70 shrink-0 transition-opacity"
                    >
                      删除
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* 批量删除按钮 */}
            {editMode && selected.size > 0 && (
              <button
                onClick={() => setConfirmDelete(Array.from(selected))}
                disabled={deleting}
                className="mt-3 w-full border border-tier-must text-tier-must rounded-md py-2 text-sm hover:bg-tier-must/10 transition-colors disabled:opacity-50"
              >
                批量删除（{selected.size} 个文件）
              </button>
            )}
          </div>
        )}

        {/* 上传区（编辑模式隐藏） */}
        {!editMode && (
          <>
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

            {/* 待上传文件卡片 */}
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

            {/* 存入按钮 */}
            <button
              onClick={saveToKnowledgeBase}
              disabled={files.length === 0 || status === "uploading"}
              className="w-full bg-accent hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-primary rounded-md py-2 text-sm font-medium transition-colors"
            >
              {status === "uploading" ? "处理中..." : "存入知识库"}
            </button>
          </>
        )}
      </div>

      {/* 删除确认弹窗 */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-card border border-white/5 rounded-lg p-6 max-w-sm w-full mx-4">
            <p className="text-primary text-sm font-medium mb-2">确认删除？</p>
            <p className="text-muted text-xs mb-6">
              将删除 {confirmDelete.length} 个文件的全部知识库内容，此操作不可撤销。
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 bg-card border border-white/5 text-primary rounded-md py-2 text-sm hover:bg-card-hover transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={deleting}
                className="flex-1 bg-tier-must text-primary rounded-md py-2 text-sm disabled:opacity-50 hover:opacity-90 transition-opacity"
              >
                {deleting ? "删除中..." : "确认删除"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
