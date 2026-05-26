"use client";
import { useParams } from "next/navigation";
import Link from "next/link";
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
  const [hasPlan, setHasPlan] = useState(false);

  const {
    pendingFiles, status, message, addFiles, removeFile, togglePendingHasAnswers, saveToKnowledgeBase,
    uploadedFiles, editMode, selected, deleting,
    uploadProgress,
    loadUploadedFiles, toggleSelect, toggleSelectAll, toggleEditMode, deleteFiles,
  } = useFileUpload(params.id, params.type);

  const isExam = params.type === "exam";

  useEffect(() => {
    loadUploadedFiles();
    fetch(`/api/plan?exam_id=${params.id}`)
      .then((r) => r.json())
      .then((d) => setHasPlan(Array.isArray(d) && d.length > 0));
  }, [loadUploadedFiles, params.id]);

  // 文件全部删完后自动退出编辑模式
  useEffect(() => {
    if (uploadedFiles.length === 0 && editMode) {
      toggleEditMode();
    }
  }, [uploadedFiles.length, editMode, toggleEditMode]);

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
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-3xl mx-auto">

        {/* 顶部导航 */}
        <div className="flex items-center gap-2 mb-6">
          <Link href="/home" className="text-muted hover:text-primary text-sm transition-colors shrink-0">首页</Link>
          <span className="text-muted text-sm">/</span>
          <Link href={`/exam/${params.id}`} className="text-muted hover:text-primary text-sm transition-colors shrink-0">返回</Link>
          <span className="text-muted text-sm">/</span>
          <h1 className="text-primary font-semibold text-base">{label}</h1>
        </div>
        <p className="text-muted text-sm mb-6">
          上传材料越接近实际考试，分析结果越准确
        </p>

        {/* 已在知识库的文件 */}
        {uploadedFiles.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-muted text-xs">已在知识库</p>
              <div className="flex items-center gap-2">
                {editMode && (
                  <button
                    onClick={toggleSelectAll}
                    className="text-sm text-primary/70 border border-white/10 rounded-md px-3 py-1.5 hover:text-primary hover:border-white/20 transition-colors"
                  >
                    {selected.size === uploadedFiles.length ? "取消全选" : "全选"}
                  </button>
                )}
                <button
                  onClick={toggleEditMode}
                  className="text-sm text-primary/70 border border-white/10 rounded-md px-3 py-1.5 hover:text-primary hover:border-white/20 transition-colors"
                >
                  {editMode ? "完成" : "编辑"}
                </button>
              </div>
            </div>
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

                  {isExam && file.has_answers !== null && (
                    <span
                      className={`text-xs px-2 py-0.5 rounded mx-3 shrink-0 ${
                        file.has_answers
                          ? "bg-tier-expand/20 text-tier-expand"
                          : "bg-tier-supplement/20 text-tier-supplement"
                      }`}
                    >
                      {file.has_answers ? "有答案" : "无答案"}
                    </span>
                  )}

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

            {/* 真题提示 */}
            {isExam && pendingFiles.length > 0 && (
              <div className="border-l-4 border-accent bg-accent/10 rounded-r-md px-4 py-3 mb-4">
                <p className="text-primary text-sm font-medium mb-0.5">记得标记每份文件是否附带答案</p>
                <p className="text-muted text-xs leading-relaxed">
                  点击文件右侧的绿色/黄色标签即可切换——AI 会据此选择不同的分析策略
                </p>
              </div>
            )}

            {/* 待上传文件卡片 */}
            {pendingFiles.length > 0 && (
              <div className="flex flex-col gap-3 mb-6">
                {pendingFiles.map((pending, i) => (
                  <div
                    key={i}
                    className="flex items-center bg-card border border-white/5 rounded-lg p-4"
                  >
                    <span className="text-primary text-sm truncate flex-1">
                      {pending.file.name}
                    </span>
                    <span className="text-muted text-xs mx-3 shrink-0">
                      {(pending.file.size / 1024).toFixed(0)} KB
                    </span>
                    {isExam && (
                      <button
                        onClick={() => togglePendingHasAnswers(i)}
                        className={`text-xs px-2 py-0.5 rounded mx-2 shrink-0 transition-colors ${
                          pending.hasAnswers
                            ? "bg-tier-expand/20 text-tier-expand hover:bg-tier-expand/30"
                            : "bg-tier-supplement/20 text-tier-supplement hover:bg-tier-supplement/30"
                        }`}
                      >
                        {pending.hasAnswers ? "有答案" : "无答案"}
                      </button>
                    )}
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

            {/* 上传进度 */}
            {uploadProgress && (
              <div className="mb-4">
                <p className="text-muted text-sm mb-2">
                  第 {uploadProgress.current}/{uploadProgress.total} 个文件存入中...
                </p>
                <div className="w-full bg-card rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-accent h-1.5 rounded-full transition-all duration-300"
                    style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
                  />
                </div>
              </div>
            )}

            {/* 状态提示 */}
            {message && !uploadProgress && (
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
              disabled={pendingFiles.length === 0 || status === "uploading"}
              className="w-full bg-accent hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-primary rounded-md py-2 text-sm font-medium transition-colors"
            >
              {status === "uploading" ? "存入中..." : "存入知识库"}
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
