"use client";
import { useParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";

type FileSummary = { slides: number; exam: number; textbook: number };

async function fetchFileSummary(examId: string): Promise<FileSummary> {
  const types = ["slides", "exam", "textbook"] as const;
  const counts: FileSummary = { slides: 0, exam: 0, textbook: 0 };
  await Promise.all(
    types.map(async (type) => {
      const res = await fetch(`/api/upload?exam_id=${examId}&material_type=${type}`);
      if (!res.ok) return;
      const data = await res.json();
      counts[type] = Array.isArray(data) ? data.length : 0;
    })
  );
  return counts;
}

export default function PlanPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [summary, setSummary] = useState<FileSummary | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    fetchFileSummary(params.id).then(setSummary);
  }, [params.id]);

  const canStart = summary ? summary.slides > 0 || summary.exam > 0 : false;

  async function handleStart() {
    setStatus("loading");
    setErrorMsg("");
    try {
      const res = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ exam_id: params.id, exam_has_answers: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "生成失败");
      router.push(`/exam/${params.id}/review`);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "生成失败，请重试");
      setStatus("error");
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <h1 className="text-lg font-semibold text-primary mb-6">准备分析</h1>

        <div className="bg-card border border-white/5 rounded-lg p-4 mb-6">
          {summary === null ? (
            <p className="text-muted text-sm">加载中...</p>
          ) : (
            <>
              {summary.slides > 0 && (
                <p className="text-primary text-sm mb-1">{summary.slides} 份课件</p>
              )}
              {summary.exam > 0 && (
                <p className="text-primary text-sm mb-1">{summary.exam} 份真题</p>
              )}
              {summary.textbook > 0 && (
                <p className="text-primary text-sm mb-1">{summary.textbook} 份课本</p>
              )}
              {summary.slides === 0 && summary.exam === 0 && summary.textbook === 0 && (
                <p className="text-muted text-sm">暂无已上传材料</p>
              )}
              <p className="text-muted text-xs mt-3">预计耗时：约2分钟</p>
            </>
          )}
        </div>

        {status === "loading" && (
          <p className="text-muted text-sm mb-4">AI 正在分析材料，请耐心等待...</p>
        )}
        {errorMsg && (
          <p className="text-tier-must text-sm mb-4">{errorMsg}</p>
        )}

        <button
          onClick={handleStart}
          disabled={!canStart || status === "loading"}
          className="w-full bg-accent hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-primary rounded-md py-2 text-sm font-medium transition-colors"
        >
          {status === "loading" ? "分析中..." : "开始解析"}
        </button>
      </div>
    </div>
  );
}
