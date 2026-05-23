"use client";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useState, useEffect } from "react";

type FileCounts = { slides: number; exam: number; textbook: number };

const MATERIAL_META = [
  { type: "slides", label: "课件", hint: "PDF / MD / PY / IPYNB" },
  { type: "exam",   label: "真题", hint: "PDF / Word / MD / PY / IPYNB" },
  { type: "textbook", label: "课本", hint: "PDF" },
] as const;

type MaterialType = "slides" | "exam" | "textbook";

export default function ExamDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const [examName, setExamName] = useState("");
  const [counts, setCounts] = useState<FileCounts>({ slides: 0, exam: 0, textbook: 0 });
  const [hasPlan, setHasPlan] = useState(false);

  useEffect(() => {
    const cacheKey = `p2_${params.id}`;
    try {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        const { name, counts: c, hasPlan: h } = JSON.parse(cached);
        if (name) setExamName(name);
        if (c) setCounts(c);
        if (typeof h === "boolean") setHasPlan(h);
      }
    } catch {}

    const types: MaterialType[] = ["slides", "exam", "textbook"];
    Promise.all([
      fetch("/api/exam").then((r) => r.json()),
      Promise.all(
        types.map((t) =>
          fetch(`/api/upload?exam_id=${params.id}&material_type=${t}`)
            .then((r) => r.json())
            .then((d) => ({ type: t, count: Array.isArray(d) ? d.length : 0 }))
        )
      ),
      fetch(`/api/plan?exam_id=${params.id}`).then((r) => r.json()),
    ]).then(([examList, countResults, planData]) => {
      const found = (examList as { id: string; name: string }[]).find((e) => e.id === params.id);
      const name = found?.name ?? "";
      if (name) setExamName(name);
      const c = { slides: 0, exam: 0, textbook: 0 };
      (countResults as { type: MaterialType; count: number }[]).forEach(({ type, count }) => { c[type] = count; });
      setCounts(c);
      const h = Array.isArray(planData) && planData.length > 0;
      setHasPlan(h);
      try { sessionStorage.setItem(cacheKey, JSON.stringify({ name, counts: c, hasPlan: h })); } catch {}
    });
  }, [params.id]);

  const canAnalyze = counts.slides > 0 || counts.exam > 0;

  function handleMaterialClick(type: MaterialType) {
    router.push(`/exam/${params.id}/${type}`);
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-3xl mx-auto">

        <div className="flex items-center gap-2 mb-6">
          <Link href="/" className="text-muted hover:text-primary text-sm transition-colors shrink-0">首页</Link>
          <span className="text-muted text-sm">/</span>
          <Link href="/" className="text-muted hover:text-primary text-sm transition-colors shrink-0">返回</Link>
          <span className="text-muted text-sm">/</span>
          <h1 className="text-primary font-semibold text-base truncate">
            {examName || "加载中..."}
          </h1>
        </div>

        <p className="text-muted text-sm mb-6">上传材料越接近实际考试，分析结果越准确</p>

        <div className="flex flex-col gap-3 mb-8">
          {MATERIAL_META.map(({ type, label, hint }) => (
            <button
              key={type}
              onClick={() => handleMaterialClick(type)}
              className="bg-card border border-white/5 rounded-lg p-4 text-left hover:bg-card-hover transition-colors"
            >
              <div className="flex items-center justify-between">
                <p className="text-primary font-medium text-sm">{label}</p>
                <div className="text-right shrink-0 ml-4">
                  <p className="text-primary text-sm font-medium">{counts[type]} 份</p>
                  <p className="text-muted text-xs">{hint}</p>
                </div>
              </div>
            </button>
          ))}
        </div>

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
            解析文件 →
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
    </div>
  );
}
