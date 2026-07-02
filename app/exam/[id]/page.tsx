"use client";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useState, useEffect } from "react";
import { isDemoModeBrowser } from "@/lib/demo";

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

  const [isDemo, setIsDemo] = useState(false);
  useEffect(() => { setIsDemo(isDemoModeBrowser()); }, []);
  const [examName, setExamName] = useState("");
  const [counts, setCounts] = useState<FileCounts>({ slides: 0, exam: 0, textbook: 0 });
  const [hasPlan, setHasPlan] = useState(false);
  const [isStale, setIsStale] = useState(false);

  useEffect(() => {
    const cacheKey = `p2_${params.id}`;
    try {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        const { name, counts: c, hasPlan: h, isStale: s } = JSON.parse(cached);
        if (name) setExamName(name);
        if (c) setCounts(c);
        if (typeof h === "boolean") setHasPlan(h);
        if (typeof s === "boolean") setIsStale(s);
      }
    } catch {}

    const types: MaterialType[] = ["slides", "exam", "textbook"];
    Promise.all([
      fetch("/api/exam").then((r) => r.json()),
      Promise.all(
        types.map((t) =>
          fetch(`/api/upload?exam_id=${params.id}&material_type=${t}`)
            .then((r) => r.json())
            .then((d) => ({ type: t, files: Array.isArray(d) ? (d as { name: string }[]) : [] }))
        )
      ),
      // 合并为单次请求，同时返回 plan 数据和 cache 文件名
      fetch(`/api/plan?exam_id=${params.id}&include_cache=true`).then((r) => r.json()),
    ]).then(([examList, fileResults, planResult]) => {
      const found = (examList as { id: string; name: string }[]).find((e) => e.id === params.id);
      const name = found?.name ?? "";
      if (name) setExamName(name);
      const c = { slides: 0, exam: 0, textbook: 0 };
      const currentFileNames = new Set<string>();
      (fileResults as { type: MaterialType; files: { name: string }[] }[]).forEach(({ type, files }) => {
        c[type] = files.length;
        if (type !== "textbook") files.forEach((f) => currentFileNames.add(f.name));
      });
      setCounts(c);
      const planData = planResult?.plan ?? null;
      const h = Array.isArray(planData) && planData.length > 0;
      setHasPlan(h);

      // 检测 maps_cache 与当前知识库是否一致
      const cacheFileNames: string[] = planResult?.cache_file_names ?? [];
      let stale = false;
      if (h && cacheFileNames.length > 0) {
        const cacheSet = new Set(cacheFileNames);
        stale =
          [...currentFileNames].some((f) => !cacheSet.has(f)) ||
          [...cacheSet].some((f) => !currentFileNames.has(f));
      }
      setIsStale(stale);

      try { sessionStorage.setItem(cacheKey, JSON.stringify({ name, counts: c, hasPlan: h, isStale: stale })); } catch {}
    });
  }, [params.id]);

  const canAnalyze = counts.slides > 0 || counts.exam > 0;

  function handleMaterialClick(type: MaterialType) {
    router.push(`/exam/${params.id}/${type}`);
  }

  return (
    <div className="min-h-screen p-4 md:p-6">
      <div className="max-w-3xl mx-auto">

        <div className="flex items-center gap-2 mb-6">
          <Link href="/home" className="text-muted hover:text-primary text-sm transition-colors shrink-0">首页</Link>
          <span className="text-muted text-sm">/</span>
          <Link href="/home" className="text-muted hover:text-primary text-sm transition-colors shrink-0">返回</Link>
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
              className="glass rounded-xl p-4 text-left hover:bg-card-hover transition-colors"
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
            href={canAnalyze && !isDemo ? `/exam/${params.id}/plan` : "#"}
            onClick={(e) => { if (!canAnalyze || isDemo) e.preventDefault(); }}
            className={`block w-full text-center rounded-md py-2 text-sm font-medium transition-colors ${
              canAnalyze && !isDemo
                ? "btn-glow text-primary"
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

          {isStale && (
            <div className="flex items-center gap-2 bg-tier-supplement/10 border border-tier-supplement/30 rounded-lg px-4 py-3">
              <span className="text-tier-supplement text-sm shrink-0">⚠</span>
              <p className="text-tier-supplement text-xs">
                知识库已更新，当前复习计划可能与材料不符，建议重新解析
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
