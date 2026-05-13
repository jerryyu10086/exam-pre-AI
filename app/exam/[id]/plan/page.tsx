"use client";
import { useParams, useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";

type FileSummary = { slides: number; exam: number; textbook: number };

const EXAM_TYPE_OPTIONS = [
  "选择 / 判断 / 填空",
  "名词解释 / 简答",
  "论述 / 大题",
  "计算题",
  "不知道（AI根据课件内容自行推断）",
];

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

  // 旧 plan 数据缓存，取消时用于恢复
  const previousPlanRef = useRef<unknown>(null);
  const abortRef = useRef<AbortController | null>(null);

  // 弹窗状态
  const [showModal, setShowModal] = useState(false);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [hasAnswers, setHasAnswers] = useState(true);

  const isReanalysis = previousPlanRef.current !== null;

  useEffect(() => {
    fetchFileSummary(params.id).then(setSummary);

    // 加载时缓存已有 plan（若有）
    fetch(`/api/plan?exam_id=${params.id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d && typeof d === "object") {
          previousPlanRef.current = d;
        }
      });
  }, [params.id]);

  const canStart = summary ? summary.slides > 0 || summary.exam > 0 : false;

  function toggleType(t: string) {
    setSelectedTypes((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]
    );
  }

  async function handleConfirmAndStart() {
    setShowModal(false);
    setStatus("loading");
    setErrorMsg("");

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      await fetch("/api/exam", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: params.id,
          ...(summary?.slides && summary.slides > 0 ? { exam_types: selectedTypes } : {}),
          ...(summary?.exam && summary.exam > 0 ? { has_answers: hasAnswers } : {}),
        }),
        signal: controller.signal,
      });

      const res = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ exam_id: params.id, exam_has_answers: hasAnswers }),
        signal: controller.signal,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "生成失败");
      router.push(`/exam/${params.id}/review`);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      setErrorMsg(err instanceof Error ? err.message : "生成失败，请重试");
      setStatus("error");
    }
  }

  async function handleCancel() {
    abortRef.current?.abort();

    if (previousPlanRef.current !== null) {
      // 有旧数据 → 恢复，不删除
      await fetch("/api/plan", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ exam_id: params.id, data: previousPlanRef.current }),
      });
    } else {
      // 首次解析 → 删除未完成的 plan
      await fetch(`/api/plan?exam_id=${params.id}`, { method: "DELETE" });
    }

    router.push(`/exam/${params.id}`);
  }

  return (
    <div className="min-h-screen bg-background flex items-start justify-center pt-40 p-6">
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

        {isReanalysis && status === "idle" && (
          <p className="text-muted text-xs mb-4">将覆盖已有复习档案，取消可保留旧版本</p>
        )}
        {status === "loading" && (
          <p className="text-muted text-sm mb-4">AI 正在分析材料，请耐心等待...</p>
        )}
        {errorMsg && (
          <p className="text-tier-must text-sm mb-4">{errorMsg}</p>
        )}

        <div className="flex gap-3">
          <button
            onClick={() => setShowModal(true)}
            disabled={!canStart || status === "loading"}
            className="flex-1 bg-accent hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-primary rounded-md py-2 text-sm font-medium transition-colors"
          >
            {status === "loading" ? "分析中..." : isReanalysis ? "重新解析" : "开始解析"}
          </button>
          <button
            onClick={handleCancel}
            className="flex-1 bg-card border border-white/5 hover:bg-card-hover text-primary rounded-md py-2 text-sm transition-colors"
          >
            取消
          </button>
        </div>
      </div>

      {/* 解析前问询弹窗 */}
      {showModal && summary && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-card border border-white/5 rounded-lg p-6 w-full max-w-sm mx-4">

            {summary.slides > 0 && (
              <div className={summary.exam > 0 ? "mb-6" : ""}>
                <p className="text-primary font-medium text-sm mb-3">
                  主要考试题型？（可多选）
                </p>
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
              </div>
            )}

            {summary.slides > 0 && summary.exam > 0 && (
              <div className="border-t border-white/5 mb-6" />
            )}

            {summary.exam > 0 && (
              <div>
                <p className="text-primary font-medium text-sm mb-3">
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
              </div>
            )}

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 bg-card border border-white/5 text-primary rounded-md py-2 text-sm hover:bg-card-hover transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleConfirmAndStart}
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
