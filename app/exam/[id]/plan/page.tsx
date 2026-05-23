"use client";
import { useParams, useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";

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

const CONTEXT_FIELDS = [
  {
    key: "chapters" as const,
    label: "重点章节",
    placeholder: "如：第3、5章重点考，其余了解即可",
  },
  {
    key: "weights" as const,
    label: "题型与分值",
    placeholder: "如：计算题约70分，名词解释30分",
  },
  {
    key: "other" as const,
    label: "其他提示",
    placeholder: "如：老师说必考流动镶嵌模型，学长建议背公式",
  },
];

type ContextFields = { chapters: string; weights: string; other: string };

function buildUserContext(ctx: ContextFields): string {
  return CONTEXT_FIELDS
    .map(({ key, label }) => ctx[key].trim() ? `${label}：${ctx[key].trim()}` : "")
    .filter(Boolean)
    .join("\n");
}

export default function PlanPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const [summary, setSummary] = useState<FileSummary | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const previousPlanRef = useRef<unknown>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [ctx, setCtx] = useState<ContextFields>({ chapters: "", weights: "", other: "" });

  const isReanalysis = previousPlanRef.current !== null;

  useEffect(() => {
    fetchFileSummary(params.id).then(setSummary);

    fetch(`/api/plan?exam_id=${params.id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d && typeof d === "object") {
          previousPlanRef.current = d;
        }
      });
  }, [params.id]);

  const canStart = summary ? summary.slides > 0 || summary.exam > 0 : false;

  function setField(key: keyof ContextFields, value: string) {
    setCtx((prev) => ({ ...prev, [key]: value }));
  }

  async function handleConfirmAndStart() {
    setShowModal(false);
    setStatus("loading");
    setErrorMsg("");

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          exam_id: params.id,
          user_context: buildUserContext(ctx),
          reanalysis: isReanalysis,
        }),
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
      await fetch("/api/plan", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ exam_id: params.id, data: previousPlanRef.current }),
      });
    } else {
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
          <p className="text-muted text-xs mb-4">重新解析将跳过已缓存的文件分析，仅重新生成复习计划</p>
        )}
        {status === "loading" && (
          <p className="text-muted text-sm mb-4">AI 正在分析材料，请耐心等待...</p>
        )}
        {errorMsg && (
          <p className="text-tier-must text-sm mb-4">{errorMsg}</p>
        )}

        <div className="flex gap-3">
          <button
            onClick={handleCancel}
            className="flex-1 bg-card border border-white/5 hover:bg-card-hover text-primary rounded-md py-2 text-sm transition-colors"
          >
            取消
          </button>
          <button
            onClick={() => setShowModal(true)}
            disabled={!canStart || status === "loading"}
            className="flex-1 bg-accent hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-primary rounded-md py-2 text-sm font-medium transition-colors"
          >
            {status === "loading" ? "分析中..." : isReanalysis ? "重新解析" : "开始解析"}
          </button>
        </div>
      </div>

      {/* 解析前问询弹窗 */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-card border border-white/5 rounded-lg p-6 w-full max-w-sm mx-4">
            <p className="text-primary font-semibold text-base mb-1">补充信息</p>
            <p className="text-muted text-xs mb-5">选填，AI 会据此调整知识点优先级；不确定可以不写</p>

            <div className="flex flex-col gap-4">
              {CONTEXT_FIELDS.map(({ key, label, placeholder }) => (
                <div key={key}>
                  <label className="text-primary text-sm font-medium block mb-1.5">{label}</label>
                  <textarea
                    value={ctx[key]}
                    onChange={(e) => setField(key, e.target.value)}
                    placeholder={placeholder}
                    rows={2}
                    className="w-full bg-background border border-white/10 rounded-md px-3 py-2 text-sm text-primary placeholder:text-muted/50 resize-none focus:outline-none focus:border-accent/50"
                  />
                </div>
              ))}
            </div>

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
