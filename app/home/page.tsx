"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";

type Folder = { id: string; name: string };
type Exam = { id: string; name: string; folder_id: string | null };

const UNGROUPED = "__ungrouped__";

export default function Home() {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);

  // ── 创建文件夹 ──────────────────────────────────────────
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [folderName, setFolderName] = useState("");
  const folderInputRef = useRef<HTMLInputElement>(null);

  // ── 文件夹编辑模式 ──────────────────────────────────────
  const [folderEditMode, setFolderEditMode] = useState(false);
  const [selectedFolders, setSelectedFolders] = useState<Set<string>>(new Set());
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const renameInputRef = useRef<HTMLInputElement>(null);

  // 删除文件夹弹窗
  const [folderDeleteModal, setFolderDeleteModal] = useState<Folder[] | null>(null);
  const [deleteExamsChoice, setDeleteExamsChoice] = useState(false);
  const [deletingFolders, setDeletingFolders] = useState(false);

  // ── 创建学科 ────────────────────────────────────────────
  const [creatingExam, setCreatingExam] = useState(false);
  const [examName, setExamName] = useState("");
  const examInputRef = useRef<HTMLInputElement>(null);

  // ── 学科编辑模式 ────────────────────────────────────────
  const [editMode, setEditMode] = useState(false);
  const [selectedExams, setSelectedExams] = useState<Set<string>>(new Set());
  const [batchMoveFolder, setBatchMoveFolder] = useState("");
  const [confirmDeleteExams, setConfirmDeleteExams] = useState<string[] | null>(null);
  const [deleting, setDeleting] = useState(false);

  // 学科行内重命名
  const [renamingExamId, setRenamingExamId] = useState<string | null>(null);
  const [renameExamValue, setRenameExamValue] = useState("");
  const renameExamInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // 先读缓存立即渲染，消除空白闪烁
    try {
      const cached = sessionStorage.getItem("p1_cache");
      if (cached) {
        const { folders: f, exams: e } = JSON.parse(cached);
        if (Array.isArray(f)) setFolders(f);
        if (Array.isArray(e)) setExams(e);
      }
    } catch {}

    // 后台拉最新数据
    Promise.all([
      fetch("/api/folder").then((r) => r.json()),
      fetch("/api/exam").then((r) => r.json()),
    ]).then(([f, e]) => {
      const folders = Array.isArray(f) ? f : [];
      const exams = Array.isArray(e) ? e : [];
      setFolders(folders);
      setExams(exams);
      try {
        sessionStorage.setItem("p1_cache", JSON.stringify({ folders, exams }));
      } catch {}
    });
  }, []);

  useEffect(() => { if (creatingFolder) folderInputRef.current?.focus(); }, [creatingFolder]);
  useEffect(() => { if (creatingExam) examInputRef.current?.focus(); }, [creatingExam]);
  useEffect(() => { if (renamingId) renameInputRef.current?.focus(); }, [renamingId]);
  useEffect(() => { if (renamingExamId) renameExamInputRef.current?.focus(); }, [renamingExamId]);

  // ── filteredExams ────────────────────────────────────────
  const filteredExams =
    activeFolderId === null ? exams
    : activeFolderId === UNGROUPED ? exams.filter((e) => e.folder_id === null)
    : exams.filter((e) => e.folder_id === activeFolderId);

  const mainTitle =
    activeFolderId === null ? "全部"
    : activeFolderId === UNGROUPED ? "未分组"
    : (folders.find((f) => f.id === activeFolderId)?.name ?? "学科");

  // ── 文件夹操作 ───────────────────────────────────────────
  async function handleCreateFolder() {
    const name = folderName.trim();
    if (!name) { setCreatingFolder(false); return; }
    const res = await fetch("/api/folder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const data = await res.json();
    if (data.id) { setFolders((prev) => [...prev, data]); setActiveFolderId(data.id); }
    setFolderName("");
    setCreatingFolder(false);
  }

  function toggleFolderEditMode() {
    setFolderEditMode((prev) => !prev);
    setSelectedFolders(new Set());
    setRenamingId(null);
  }

  function toggleSelectFolder(id: string) {
    setSelectedFolders((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function startRename(folder: Folder) {
    setRenamingId(folder.id);
    setRenameValue(folder.name);
  }

  async function commitRename() {
    if (!renamingId || !renameValue.trim()) { setRenamingId(null); return; }
    await fetch("/api/folder", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: renamingId, name: renameValue.trim() }),
    });
    setFolders((prev) => prev.map((f) => f.id === renamingId ? { ...f, name: renameValue.trim() } : f));
    setRenamingId(null);
  }

  async function handleDeleteFolders() {
    if (!folderDeleteModal) return;
    setDeletingFolders(true);
    const ids = folderDeleteModal.map((f) => f.id);
    await fetch("/api/folder", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids, delete_exams: deleteExamsChoice }),
    });
    setFolders((prev) => prev.filter((f) => !ids.includes(f.id)));
    if (deleteExamsChoice) {
      setExams((prev) => prev.filter((e) => !ids.includes(e.folder_id ?? "")));
    } else {
      setExams((prev) => prev.map((e) => ids.includes(e.folder_id ?? "") ? { ...e, folder_id: null } : e));
    }
    if (ids.includes(activeFolderId ?? "")) setActiveFolderId(null);
    setSelectedFolders(new Set());
    setDeletingFolders(false);
    setFolderDeleteModal(null);
    setDeleteExamsChoice(false);
  }

  // ── 学科操作 ─────────────────────────────────────────────
  async function handleCreateExam() {
    const name = examName.trim();
    if (!name) { setCreatingExam(false); return; }
    const fid = activeFolderId === UNGROUPED ? null : activeFolderId;
    const res = await fetch("/api/exam", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, folder_id: fid }),
    });
    const data = await res.json();
    if (data.id) setExams((prev) => [{ id: data.id, name, folder_id: fid }, ...prev]);
    setExamName("");
    setCreatingExam(false);
  }

  function toggleEditMode() {
    setEditMode((prev) => !prev);
    setSelectedExams(new Set());
    setRenamingExamId(null);
  }

  function toggleSelectExam(id: string) {
    setSelectedExams((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function handleBatchMove(folderId: string | null) {
    const ids = Array.from(selectedExams);
    await Promise.all(ids.map((id) =>
      fetch("/api/exam", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, folder_id: folderId }),
      })
    ));
    setExams((prev) => prev.map((e) => selectedExams.has(e.id) ? { ...e, folder_id: folderId } : e));
    setSelectedExams(new Set());
  }

  function handleBatchMoveChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const value = e.target.value;
    if (!value) return;
    setBatchMoveFolder("");
    handleBatchMove(value === "__none__" ? null : value);
  }

  async function handleDeleteExams() {
    if (!confirmDeleteExams) return;
    setDeleting(true);
    await fetch("/api/exam", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: confirmDeleteExams }),
    });
    const deletedSet = new Set(confirmDeleteExams);
    setExams((prev) => prev.filter((e) => !deletedSet.has(e.id)));
    setSelectedExams(new Set());
    setDeleting(false);
    setConfirmDeleteExams(null);
  }

  function startRenameExam(exam: Exam) {
    setRenamingExamId(exam.id);
    setRenameExamValue(exam.name);
  }

  async function commitRenameExam() {
    if (!renamingExamId || !renameExamValue.trim()) { setRenamingExamId(null); return; }
    const trimmed = renameExamValue.trim();
    await fetch("/api/exam", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: renamingExamId, name: trimmed }),
    });
    setExams((prev) => prev.map((e) => e.id === renamingExamId ? { ...e, name: trimmed } : e));
    setRenamingExamId(null);
  }

  // ── render ───────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row">

      {/* Mobile: top tab strip */}
      <nav className="md:hidden border-b border-white/10">
        <div className="flex overflow-x-auto gap-1.5 px-3 py-2">
          {!folderEditMode ? (
            <>
              <button
                onClick={() => setActiveFolderId(null)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors ${
                  activeFolderId === null
                    ? "bg-accent/20 text-accent"
                    : "text-primary/70 hover:text-primary hover:bg-card"
                }`}
              >
                全部
              </button>
              <button
                onClick={() => setActiveFolderId(UNGROUPED)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors ${
                  activeFolderId === UNGROUPED
                    ? "bg-accent/20 text-accent"
                    : "text-primary/70 hover:text-primary hover:bg-card"
                }`}
              >
                未分组
              </button>
              {folders.map((folder) => (
                <button
                  key={folder.id}
                  onClick={() => setActiveFolderId(folder.id)}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors ${
                    activeFolderId === folder.id
                      ? "bg-accent/20 text-accent"
                      : "text-primary/70 hover:text-primary hover:bg-card"
                  }`}
                >
                  {folder.name}
                </button>
              ))}
            </>
          ) : (
            <>
              {folders.map((folder) => (
                <button
                  key={folder.id}
                  onClick={() => toggleSelectFolder(folder.id)}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors border ${
                    selectedFolders.has(folder.id)
                      ? "bg-accent/20 text-accent border-accent/40"
                      : "text-primary/70 border-white/10 hover:bg-card hover:text-primary"
                  }`}
                >
                  {folder.name}
                </button>
              ))}
            </>
          )}
        </div>
        <div className="flex items-center gap-2 px-3 pb-2">
          {folderEditMode ? (
            <>
              {selectedFolders.size > 0 && (
                <button
                  onClick={() => setFolderDeleteModal(folders.filter((f) => selectedFolders.has(f.id)))}
                  className="text-sm text-tier-must border border-tier-must/30 rounded-md px-3 py-1.5 hover:bg-tier-must/10 transition-colors"
                >
                  删除({selectedFolders.size})
                </button>
              )}
              <button
                onClick={toggleFolderEditMode}
                className="ml-auto text-sm text-primary/70 hover:text-primary border border-white/10 rounded-md px-3 py-1.5 hover:bg-card transition-colors"
              >
                完成
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setCreatingFolder(true)}
                className="text-sm text-primary/70 hover:text-primary border border-white/10 rounded-md px-3 py-1.5 hover:bg-card transition-colors"
              >
                + 新建文件夹
              </button>
              {folders.length > 0 && (
                <button
                  onClick={toggleFolderEditMode}
                  className="text-sm text-primary/70 hover:text-primary border border-white/10 rounded-md px-3 py-1.5 hover:bg-card transition-colors"
                >
                  编辑
                </button>
              )}
            </>
          )}
        </div>
      </nav>

      {/* 左侧文件夹栏 */}
      <aside className="w-44 shrink-0 hidden md:flex flex-col border-r border-white/10 p-3">
        <p className="text-primary text-sm font-semibold px-2 mb-2 mt-1">文件夹列表</p>
        <hr className="border-white/10 mb-2" />

        <div className="flex-1 flex flex-col gap-0.5 overflow-y-auto">
          {/* 全部 */}
          <button
            onClick={() => !folderEditMode && setActiveFolderId(null)}
            className={`text-left px-2 py-1.5 rounded-md text-sm transition-colors ${
              activeFolderId === null && !folderEditMode
                ? "bg-accent/20 text-accent"
                : "text-primary/70 hover:text-primary hover:bg-card"
            }`}
          >
            全部
          </button>

          {/* 未分组 */}
          <button
            onClick={() => !folderEditMode && setActiveFolderId(UNGROUPED)}
            className={`text-left px-2 py-1.5 rounded-md text-sm transition-colors ${
              activeFolderId === UNGROUPED && !folderEditMode
                ? "bg-accent/20 text-accent"
                : "text-primary/70 hover:text-primary hover:bg-card"
            }`}
          >
            未分组
          </button>

          {/* 用户文件夹 */}
          {folders.map((folder) =>
            folderEditMode ? (
              <div
                key={folder.id}
                className={`flex items-center gap-1.5 rounded-md px-2 py-1.5 transition-colors ${
                  selectedFolders.has(folder.id) ? "bg-accent/10" : "hover:bg-card"
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedFolders.has(folder.id)}
                  onChange={() => toggleSelectFolder(folder.id)}
                  className="accent-accent w-3.5 h-3.5 shrink-0 cursor-pointer"
                />
                {renamingId === folder.id ? (
                  <input
                    ref={renameInputRef}
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitRename();
                      if (e.key === "Escape") setRenamingId(null);
                    }}
                    onBlur={commitRename}
                    className="flex-1 min-w-0 bg-background rounded px-1.5 py-0 text-primary text-sm outline-none ring-1 ring-accent/50"
                  />
                ) : (
                  <span
                    className="flex-1 min-w-0 text-primary text-sm truncate cursor-default"
                    onDoubleClick={() => startRename(folder)}
                    title="双击改名"
                  >
                    {folder.name}
                  </span>
                )}
                <button
                  onClick={() => startRename(folder)}
                  className="shrink-0 text-muted hover:text-accent text-xs transition-colors"
                  title="改名"
                >
                  ✎
                </button>
              </div>
            ) : (
              <button
                key={folder.id}
                onClick={() => setActiveFolderId(folder.id)}
                className={`text-left px-2 py-1.5 rounded-md text-sm transition-colors truncate ${
                  activeFolderId === folder.id
                    ? "bg-accent/20 text-accent"
                    : "text-primary/70 hover:text-primary hover:bg-card"
                }`}
              >
                {folder.name}
              </button>
            )
          )}
        </div>

        {/* 底部操作区 */}
        <div className="mt-2 flex flex-col gap-1 border-t border-white/10 pt-2">
          {folderEditMode ? (
            <div className="flex items-center gap-1">
              {selectedFolders.size > 0 && (
                <button
                  onClick={() => setFolderDeleteModal(folders.filter((f) => selectedFolders.has(f.id)))}
                  className="flex-1 text-center px-2 py-1.5 text-sm text-tier-must hover:bg-tier-must/10 rounded-md transition-colors"
                >
                  删除({selectedFolders.size})
                </button>
              )}
              <button
                onClick={toggleFolderEditMode}
                className="flex-1 text-center px-2 py-1.5 text-primary/70 hover:text-primary text-sm hover:bg-card rounded-md transition-colors"
              >
                完成
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCreatingFolder(true)}
                className="flex-1 text-center px-2 py-1.5 text-primary/70 hover:text-primary text-sm hover:bg-card rounded-md transition-colors"
              >
                + 新建
              </button>
              {folders.length > 0 && (
                <button
                  onClick={toggleFolderEditMode}
                  className="flex-1 text-center px-2 py-1.5 text-primary/70 hover:text-primary text-sm hover:bg-card rounded-md transition-colors"
                >
                  编辑
                </button>
              )}
            </div>
          )}
        </div>
      </aside>

      {/* 右侧主区域 */}
      <main className="flex-1 p-4 md:p-6">
        <div className="flex items-center justify-between flex-wrap gap-x-4 gap-y-2 mb-4 md:mb-6">
          <h1 className="text-primary font-semibold text-base">{mainTitle}</h1>
          <div className="flex items-center gap-2">
            {editMode && selectedExams.size > 0 && (
              <>
                <div className="relative">
                  <select
                    value={batchMoveFolder}
                    onChange={handleBatchMoveChange}
                    className="appearance-none text-sm text-muted bg-card border border-white/10 rounded-md pl-3 pr-7 py-1.5 outline-none hover:border-white/20 transition-colors cursor-pointer"
                  >
                    <option value="" disabled>移动至...</option>
                    <option value="__none__">未分组</option>
                    {folders.map((f) => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </select>
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-muted text-xs">▾</div>
                </div>
                <button
                  onClick={() => setConfirmDeleteExams(Array.from(selectedExams))}
                  className="text-sm text-tier-must border border-tier-must/30 rounded-md px-3 py-1.5 hover:bg-tier-must/10 transition-colors"
                >
                  删除所选（{selectedExams.size}）
                </button>
              </>
            )}
            {filteredExams.length > 0 && (
              <button
                onClick={toggleEditMode}
                className="text-sm text-primary/70 border border-white/10 rounded-md px-3 py-1.5 hover:text-primary hover:border-white/20 transition-colors"
              >
                {editMode ? "完成" : "编辑"}
              </button>
            )}
            {!editMode && (
              <button
                onClick={() => setCreatingExam(true)}
                className="bg-accent hover:bg-accent-hover text-primary rounded-md px-3 py-1.5 text-sm font-medium transition-colors"
              >
                + 创建学科
              </button>
            )}
          </div>
        </div>

        {filteredExams.length === 0 ? (
          <p className="text-muted text-sm">暂无学科，点击右上角创建</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-6">
            {filteredExams.map((exam) =>
              editMode ? (
                <div
                  key={exam.id}
                  className={`bg-card border rounded-lg p-4 transition-colors ${
                    selectedExams.has(exam.id) ? "border-accent" : "border-white/5"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedExams.has(exam.id)}
                      onChange={() => toggleSelectExam(exam.id)}
                      className="accent-accent w-4 h-4 shrink-0 cursor-pointer"
                    />
                    {renamingExamId === exam.id ? (
                      <input
                        ref={renameExamInputRef}
                        value={renameExamValue}
                        onChange={(e) => setRenameExamValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") commitRenameExam();
                          if (e.key === "Escape") setRenamingExamId(null);
                        }}
                        onBlur={commitRenameExam}
                        className="flex-1 min-w-0 bg-background rounded px-1.5 py-0 text-primary text-sm outline-none ring-1 ring-accent/50"
                      />
                    ) : (
                      <p className="flex-1 min-w-0 text-primary text-sm font-medium truncate">{exam.name}</p>
                    )}
                    <button
                      onClick={() => startRenameExam(exam)}
                      className="shrink-0 text-muted hover:text-accent text-sm transition-colors"
                      title="改名"
                    >
                      ✎
                    </button>
                  </div>
                </div>
              ) : (
                <Link key={exam.id} href={`/exam/${exam.id}`}>
                  <div className="bg-card border border-white/5 rounded-lg p-4 hover:bg-card-hover transition-colors cursor-pointer">
                    <p className="text-primary text-sm font-medium truncate">{exam.name}</p>
                  </div>
                </Link>
              )
            )}
          </div>
        )}
      </main>

      {/* ── 弹窗区 ── */}

      {/* 创建文件夹 */}
      {creatingFolder && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-card border border-white/5 rounded-lg p-6 w-full max-w-sm mx-4">
            <p className="text-primary font-medium text-sm mb-4">新建文件夹</p>
            <input
              ref={folderInputRef}
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreateFolder();
                if (e.key === "Escape") { setCreatingFolder(false); setFolderName(""); }
              }}
              placeholder="文件夹名称（如：大一上）"
              className="w-full bg-background border border-white/10 rounded-md px-3 py-2 text-primary text-sm placeholder:text-muted outline-none focus:border-accent/50 transition-colors mb-4"
            />
            <div className="flex gap-3">
              <button
                onClick={() => { setCreatingFolder(false); setFolderName(""); }}
                className="flex-1 bg-card border border-white/5 text-primary rounded-md py-2 text-sm hover:bg-card-hover transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleCreateFolder}
                disabled={!folderName.trim()}
                className="flex-1 bg-accent hover:bg-accent-hover disabled:opacity-50 text-primary rounded-md py-2 text-sm font-medium transition-colors"
              >
                创建
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 创建学科 */}
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

      {/* 删除学科确认 */}
      {confirmDeleteExams && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-card border border-white/5 rounded-lg p-6 max-w-sm w-full mx-4">
            <p className="text-primary text-sm font-medium mb-2">确认删除？</p>
            <p className="text-muted text-xs mb-6">
              将删除 {confirmDeleteExams.length} 个学科及其全部材料、复习计划和对话记录，此操作不可撤销。
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDeleteExams(null)}
                className="flex-1 bg-card border border-white/5 text-primary rounded-md py-2 text-sm hover:bg-card-hover transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleDeleteExams}
                disabled={deleting}
                className="flex-1 bg-tier-must text-primary rounded-md py-2 text-sm disabled:opacity-50 hover:opacity-90 transition-opacity"
              >
                {deleting ? "删除中..." : "确认删除"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 删除文件夹确认 */}
      {folderDeleteModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-card border border-white/5 rounded-lg p-6 max-w-sm w-full mx-4">
            <p className="text-primary text-sm font-medium mb-1">
              删除 {folderDeleteModal.length} 个文件夹？
            </p>
            <p className="text-muted text-xs mb-4">
              {folderDeleteModal.map((f) => f.name).join("、")}
            </p>
            <p className="text-primary text-xs mb-3">文件夹内的学科如何处理？</p>
            <div className="flex flex-col gap-2 mb-5">
              {[
                { value: false, label: "移至「未分组」（保留学科）" },
                { value: true, label: "一并删除学科" },
              ].map((opt) => (
                <label key={String(opt.value)} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="deleteExamsChoice"
                    checked={deleteExamsChoice === opt.value}
                    onChange={() => setDeleteExamsChoice(opt.value)}
                    className="accent-accent w-4 h-4"
                  />
                  <span className={`text-sm ${opt.value ? "text-tier-must" : "text-primary"}`}>
                    {opt.label}
                  </span>
                </label>
              ))}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => { setFolderDeleteModal(null); setDeleteExamsChoice(false); }}
                className="flex-1 bg-card border border-white/5 text-primary rounded-md py-2 text-sm hover:bg-card-hover transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleDeleteFolders}
                disabled={deletingFolders}
                className="flex-1 bg-tier-must text-primary rounded-md py-2 text-sm disabled:opacity-50 hover:opacity-90 transition-opacity"
              >
                {deletingFolders ? "删除中..." : "确认删除"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
