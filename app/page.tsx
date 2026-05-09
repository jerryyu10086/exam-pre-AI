"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";

type Folder = { id: string; name: string };
type Exam = { id: string; name: string; folder_id: string | null };

export default function Home() {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);

  // 创建文件夹
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [folderName, setFolderName] = useState("");
  const folderInputRef = useRef<HTMLInputElement>(null);

  // 创建学科 modal
  const [creatingExam, setCreatingExam] = useState(false);
  const [examName, setExamName] = useState("");
  const examInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/folder").then((r) => r.json()).then((d) => setFolders(Array.isArray(d) ? d : []));
    fetch("/api/exam").then((r) => r.json()).then((d) => setExams(Array.isArray(d) ? d : []));
  }, []);

  useEffect(() => {
    if (creatingFolder) folderInputRef.current?.focus();
  }, [creatingFolder]);

  useEffect(() => {
    if (creatingExam) examInputRef.current?.focus();
  }, [creatingExam]);

  const filteredExams =
    activeFolderId === null
      ? exams
      : exams.filter((e) => e.folder_id === activeFolderId);

  async function handleCreateFolder() {
    const name = folderName.trim();
    if (!name) { setCreatingFolder(false); return; }
    const res = await fetch("/api/folder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const data = await res.json();
    if (data.id) {
      setFolders((prev) => [...prev, data]);
      setActiveFolderId(data.id);
    }
    setFolderName("");
    setCreatingFolder(false);
  }

  async function handleCreateExam() {
    const name = examName.trim();
    if (!name) { setCreatingExam(false); return; }
    const res = await fetch("/api/exam", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, folder_id: activeFolderId }),
    });
    const data = await res.json();
    if (data.id) {
      setExams((prev) => [{ id: data.id, name, folder_id: activeFolderId }, ...prev]);
    }
    setExamName("");
    setCreatingExam(false);
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* 左侧文件夹栏 */}
      <aside className="w-44 shrink-0 flex flex-col border-r border-white/10 p-3">
        <p className="text-primary font-semibold text-sm px-2 mb-4 mt-1">期末备考</p>

        <div className="flex-1 flex flex-col gap-0.5">
          {/* 全部 */}
          <button
            onClick={() => setActiveFolderId(null)}
            className={`text-left px-2 py-1.5 rounded-md text-sm transition-colors ${
              activeFolderId === null
                ? "bg-accent/20 text-accent"
                : "text-muted hover:text-primary hover:bg-card"
            }`}
          >
            全部
          </button>

          {/* 文件夹列表 */}
          {folders.map((folder) => (
            <button
              key={folder.id}
              onClick={() => setActiveFolderId(folder.id)}
              className={`text-left px-2 py-1.5 rounded-md text-sm transition-colors truncate ${
                activeFolderId === folder.id
                  ? "bg-accent/20 text-accent"
                  : "text-muted hover:text-primary hover:bg-card"
              }`}
            >
              {folder.name}
            </button>
          ))}
        </div>

        {/* 创建文件夹 */}
        {creatingFolder ? (
          <input
            ref={folderInputRef}
            value={folderName}
            onChange={(e) => setFolderName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreateFolder();
              if (e.key === "Escape") { setCreatingFolder(false); setFolderName(""); }
            }}
            onBlur={handleCreateFolder}
            placeholder="文件夹名称"
            className="bg-card border border-white/10 rounded-md px-2 py-1.5 text-primary text-xs placeholder:text-muted outline-none focus:border-accent/50 transition-colors"
          />
        ) : (
          <button
            onClick={() => setCreatingFolder(true)}
            className="text-left px-2 py-1.5 text-muted hover:text-primary text-xs transition-colors"
          >
            + 创建文件夹
          </button>
        )}
      </aside>

      {/* 右侧主区域 */}
      <main className="flex-1 p-6">
        {/* 顶部栏 */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-primary font-semibold text-base">
            {activeFolderId === null
              ? "全部学科"
              : (folders.find((f) => f.id === activeFolderId)?.name ?? "学科")}
          </h1>
          <button
            onClick={() => setCreatingExam(true)}
            className="bg-accent hover:bg-accent-hover text-primary rounded-md px-3 py-1.5 text-sm font-medium transition-colors"
          >
            + 创建学科
          </button>
        </div>

        {/* 学科卡片网格 */}
        {filteredExams.length === 0 ? (
          <p className="text-muted text-sm">暂无学科，点击右上角创建</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {filteredExams.map((exam) => (
              <Link key={exam.id} href={`/exam/${exam.id}`}>
                <div className="bg-card border border-white/5 rounded-lg p-4 hover:bg-card-hover transition-colors cursor-pointer">
                  <p className="text-primary text-sm font-medium truncate">{exam.name}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>

      {/* 创建学科 Modal */}
      {creatingExam && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-card border border-white/5 rounded-lg p-6 w-full max-w-sm mx-4">
            <p className="text-primary font-medium text-sm mb-4">新建学科</p>
            <input
              ref={examInputRef}
              value={examName}
              onChange={(e) => setExamName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreateExam();
                if (e.key === "Escape") { setCreatingExam(false); setExamName(""); }
              }}
              placeholder="学科名称（如：细胞生物学）"
              className="w-full bg-background border border-white/10 rounded-md px-3 py-2 text-primary text-sm placeholder:text-muted outline-none focus:border-accent/50 transition-colors mb-4"
            />
            <div className="flex gap-3">
              <button
                onClick={() => { setCreatingExam(false); setExamName(""); }}
                className="flex-1 bg-card border border-white/5 text-primary rounded-md py-2 text-sm hover:bg-card-hover transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleCreateExam}
                disabled={!examName.trim()}
                className="flex-1 bg-accent hover:bg-accent-hover disabled:opacity-50 text-primary rounded-md py-2 text-sm font-medium transition-colors"
              >
                创建
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
