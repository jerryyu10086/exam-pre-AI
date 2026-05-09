"use client";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useState, useEffect } from "react";

type FileCounts = { slides: number; exam: number; textbook: number };

const EXAM_TYPE_OPTIONS = [
  "选择 / 判断 / 填空",
  "名词解释 / 简答",
  "论述 / 大题",
  "计算题",
  "不知道（AI根据课件内容自行推断）",
];

const MATERIAL_META = [
  {
    type: "slides",
    label: "课件",
    hint: "PDF / MD / PY / IPYNB",
    desc: "MAP + Embedding，提取考点结构",
  },
  {
    type: "exam",
    label: "真题",
    hint: "PDF / Word / MD / PY / IPYNB",
    desc: "MAP + Embedding，权重最高",
  },
  {
    type: "textbook",
    label: "课本",
    hint: "PDF",
    desc: "仅 Embedding，辅助检索参考",
  },
] as const;

type MaterialType = "slides" | "exam" | "textbook";
type Modal = { type: "slides" } | { type: "exam" } | null;

export default function ExamDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const [examName, setExamName] = useState("");
  const [counts, setCounts] = useState<FileCounts>({ slides: 0, exam: 0, textbook: 0 });
  const [hasPlan, setHasPlan] = useState(false);
  const [modal, setModal] = useState<Modal>(null);

  // 课件 modal 状态
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  // 真题 modal 状态
  const [hasAnswers, setHasAnswers] = useState(true);

  useEffect(() => {
    // 获取考试名称
    fetch(`/api/exam`)
      .then((r) => r.json())
      .then((list: { id: string; name: string }[]) => {
        const found = list.find((e) => e.id === params.id);
        if (found) setExamName(found.name);
      });

    // 获取各类材料数量
    const types: MaterialType[] = ["slides", "exam", "textbook"];
    Promise.all(
      types.map((t) =>
        fetch(`/api/upload?exam_id=${params.id}&material_type=${t}`)
          .then((r) => r.json())
          .then((d) => ({ type: t, count: Array.isArray(d) ? d.length : 0 }))
      )
    ).then((results) => {
      const c = { slides: 0, exam: 0, textbook: 0 };
      results.forEach(({ type, count }) => { c[type] = count; });
      setCounts(c);
    });

    // 检查复习计划是否存在
    fetch(`/api/plan?exam_id=${params.id}`)
      .then((r) => r.json())
      .then((d) => setHasPlan(Array.isArray(d) && d.length > 0));
  }, [params.id]);

  const canAnalyze = counts.slides > 0 || counts.exam > 0;

  function handleMaterialClick(type: MaterialType) {
    if (type === "textbook") {
      router.push(`/exam/${params.id}/textbook`);
      return;
    }
    setModal(type === "slides" ? { type: "slides" } : { type: "exam" });
  }

  async function handleSlidesConfirm() {
    await fetch("/api/exam", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: params.id, exam_types: selectedTypes }),
    });
    setModal(null);
    router.push(`/exam/${params.id}/slides`);
  }

  async function handleExamConfirm() {
    await fetch("/api/exam", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: params.id, has_answers: hasAnswers }),
    });
    setModal(null);
    router.push(`/exam/${params.id}/exam`);
  }

  function toggleType(t: string) {
    setSelectedTypes((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-2xl mx-auto">

        {/* 顶部导航 */}
        <div className="flex items-center gap-2 mb-6">
          <Link href="/" className="text-muted hover:text-primary text-sm transition-colors">
            ← 返回
          </Link>
          <span className="text-muted text-sm">/</span>
          <h1 className="text-primary font-semibold text-base">
            {examName || "加载中..."}
          </h1>
        </div>

        {/* 静态提示 */}
        <p className="text-muted text-sm mb-6">上传材料越接近实际考试，分析结果越准确</p>

        {/* 三类材料入口 */}
        <div className="flex flex-col gap-3 mb-8">
          {MATERIAL_META.map(({ type, label, hint, desc }) => (
            <button
              key={type}
              onClick={() => handleMaterialClick(type)}
              className="bg-card border border-white/5 rounded-lg p-4 text-left hover:bg-card-hover transition-colors"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-primary font-medium text-sm mb-0.5">{label}</p>
                  <p className="text-muted text-xs">{desc}</p>
                </div>
                <div className="text-right shrink-0 ml-4">
                  <p className="text-primary text-sm font-medium">{counts[type]} 份</p>
                  <p className="text-muted text-xs">{hint}</p>
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* 操作按钮区 */}
        <div className="flex flex-col gap-3">
          <Link
            href={canAnalyze ? `/exam/${params.id}/plan` : "#"}
            onClick={(e) => { if (!canAnalyze) e.preventDefault(); }}
            className={`block w-full text-center rounded-md py-2 text-sm font-medium transition-colors ${
              canAnalyze
                ? "bg-accent hover:bg-accent-hover text-primary"
                : "bg-card border border-white/5 text-muted opacity-50 cursor-not-allowed"
            }`}
          >
            开始解析
          </Link>

          {hasPlan && (
            <Link
              href={`/exam/${params.id}/review`}
              className="block w-full text-center bg-card border border-white/5 hover:bg-card-hover text-primary rounded-md py-2 text-sm transition-colors"
            >
              复习档案 →
            </Link>
          )}
        </div>
      </div>

      {/* 课件 问询弹窗 */}
      {modal?.type === "slides" && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-card border border-white/5 rounded-lg p-6 w-full max-w-sm mx-4">
            <p className="text-primary font-medium text-sm mb-4">主要考试题型？（可多选）</p>
            <div className="flex flex-col gap-2">
              {EXAM_TYPE_OPTIONS.map((opt) => (
                <label key={opt} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedTypes.includes(opt)}
                    onChange={() => toggleType(opt)}
                    className="accent-accent w-4 h-4"
                  />
                  <span className="text-primary text-sm">{opt}</span>
                </label>
              ))}
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setModal(null)}
                className="flex-1 bg-card border border-white/5 text-primary rounded-md py-2 text-sm hover:bg-card-hover transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSlidesConfirm}
                className="flex-1 bg-accent hover:bg-accent-hover text-primary rounded-md py-2 text-sm font-medium transition-colors"
              >
                确认
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 真题 问询弹窗 */}
      {modal?.type === "exam" && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-card border border-white/5 rounded-lg p-6 w-full max-w-sm mx-4">
            <p className="text-primary font-medium text-sm mb-4">
              这些题目是否附带答案或解析？
            </p>
            <div className="flex flex-col gap-2">
              {[
                { label: "有答案 / 有解析", value: true },
                { label: "没有答案", value: false },
              ].map((opt) => (
                <label key={String(opt.value)} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="hasAnswers"
                    checked={hasAnswers === opt.value}
                    onChange={() => setHasAnswers(opt.value)}
                    className="accent-accent w-4 h-4"
                  />
                  <span className="text-primary text-sm">{opt.label}</span>
                </label>
              ))}
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setModal(null)}
                className="flex-1 bg-card border border-white/5 text-primary rounded-md py-2 text-sm hover:bg-card-hover transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleExamConfirm}
                className="flex-1 bg-accent hover:bg-accent-hover text-primary rounded-md py-2 text-sm font-medium transition-colors"
              >
                确认
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
