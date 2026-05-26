"use client";
import { useParams, useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";

type FileSummary = { slides: number; exam: number; textbook: number };
type FileItem = { name: string };

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

// V1：只对课件跑 MAP，真题在 UI 完整保留但不参与 REDUCE，因此 MAP 进度条只算课件
async function fetchSlidesFileNames(examId: string): Promise<FileItem[]> {
  const res = await fetch(`/api/upload?exam_id=${examId}&material_type=slides`);
  return res.ok ? await res.json() : [];
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

type Progress = {
  phase: "mapping" | "reducing";
  current: number;
  total: number;
  batchSize: number;
};

export default function PlanPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const [summary, setSummary] = useState<FileSummary | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [isReanalysis, setIsReanalysis] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [progress, setProgress] = useState<Progress | null>(null);

  const previousPlanRef = useRef<unknown>(null);
  const abortRef = useRef<AbortController | null>(null);
  const phaseRef = useRef<"idle" | "mapping" | "reducing">("idle");

  const [showModal, setShowModal] = useState(false);
  const [ctx, setCtx] = useState<ContextFields>({ chapters: "", weights: "", other: "" });

  useEffect(() => {
    fetchFileSummary(params.id).then(setSummary);

    fetch(`/api/plan?exam_id=${params.id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d && typeof d === "object") {
          previousPlanRef.current = d;
          setIsReanalysis(true);
        }
      });
  }, [params.id]);

  useEffect(() => {
    if (status !== "loading") {
      setElapsed(0);
      return;
    }
    const timer = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [status]);

  const canStart = summary ? summary.slides > 0 || summary.exam > 0 : false;

  function setField(key: keyof ContextFields, value: string) {
    setCtx((prev) => ({ ...prev, [key]: value }));
  }

  async function handleConfirmAndStart() {
    setShowModal(false);
    setStatus("loading");
    setErrorMsg("");
    setProgress(null);
    phaseRef.current = "mapping";

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      // 1. 获取所有课件文件名（真题 V1 不进 MAP，不计入进度）
      const allFiles = await fetchSlidesFileNames(params.id);

      // 2. 获取已缓存的文件名
      const cacheRes = await fetch(`/api/plan?exam_id=${params.id}&include_cache=true`);
      const cacheData = cacheRes.ok ? await cacheRes.json() : { cache_file_names: [] };
      const cachedNames = new Set<string>(cacheData.cache_file_names ?? []);

      // 3. 只 MAP 未缓存的文件（首次解析=全部，重新解析=仅新增）
      const filesToMap = allFiles.filter((f) => !cachedNames.has(f.name));

      // 4. 批并行 MAP：每批最多 3 个并行，批结束后统一写库
      const BATCH_SIZE = 100;
      let completed = 0;
      const total = filesToMap.length;

      for (let i = 0; i < total; i += BATCH_SIZE) {
        if (controller.signal.aborted) return;
        const batch = filesToMap.slice(i, i + BATCH_SIZE);

        setProgress({ phase: "mapping", current: completed + batch.length, total, batchSize: batch.length });

        type MapEntry = { file_name: string; material_type: string; data: Record<string, unknown> };
        const batchResults = await Promise.all(
          batch.map(async (file) => {
            const res = await fetch("/api/plan/map", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ exam_id: params.id, file_name: file.name }),
              signal: controller.signal,
            });
            let data: { success?: boolean; result?: MapEntry | null; error?: string } | null = null;
            try { data = await res.json(); } catch { throw new Error("服务器响应超时，请重试"); }
            if (!res.ok) throw new Error((data?.error) ?? "文件分析失败");
            return data?.result ?? null;
          })
        );

        // 过滤掉 textbook（result 为 null）后批量写库
        const entriesToSave = batchResults.filter((r): r is MapEntry => r !== null);
        if (entriesToSave.length > 0) {
          const patchRes = await fetch("/api/plan/map", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ exam_id: params.id, entries: entriesToSave }),
            signal: controller.signal,
          });
          let patchData: { error?: string } | null = null;
          try { patchData = await patchRes.json(); } catch { throw new Error("保存分析结果超时，请重试"); }
          if (!patchRes.ok) throw new Error((patchData?.error) ?? "保存分析结果失败");
        }

        completed += batch.length;
        setProgress({ phase: "mapping", current: completed, total, batchSize: batch.length });
      }

      // 5. REDUCE
      if (controller.signal.aborted) return;
      phaseRef.current = "reducing";
      setProgress({ phase: "reducing", current: 0, total: 0, batchSize: 0 });

      const res = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ exam_id: params.id, user_context: buildUserContext(ctx) }),
        signal: controller.signal,
      });
      let data: Record<string, unknown> | null = null;
      try { data = await res.json(); } catch { throw new Error("服务器响应超时，请重试"); }
      if (!res.ok) throw new Error((data?.error as string) ?? "生成失败");

      // 解析成功后清除 Page 2 缓存的 isStale
      try {
        const cacheKey = `p2_${params.id}`;
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
          sessionStorage.setItem(cacheKey, JSON.stringify({ ...JSON.parse(cached), isStale: false }));
        }
      } catch {}

      phaseRef.current = "idle";
      router.push(`/exam/${params.id}/review`);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      setErrorMsg(err instanceof Error ? err.message : "生成失败，请重试");
      setStatus("error");
      setProgress(null);
      phaseRef.current = "idle";
    }
  }

  async function handleCancel() {
    abortRef.current?.abort();
    const cancelledPhase = phaseRef.current;
    phaseRef.current = "idle";

    if (previousPlanRef.current !== null) {
      // 重新解析：恢复旧 plans.data，maps_cache 保留新增缓存
      await fetch("/api/plan", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ exam_id: params.id, data: previousPlanRef.current }),
      });
    } else if (cancelledPhase !== "reducing") {
      // 首次解析 MAP 阶段取消：删除整行（maps_cache 尚未完整）
      await fetch(`/api/plan?exam_id=${params.id}`, { method: "DELETE" });
    }
    // 首次解析 REDUCE 阶段取消：仅 abort，maps_cache 已完整写入，plans.data 未写入，保留现状

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
              <p className="text-muted text-xs mt-3">分析需要一定时间，可在后台等候完成</p>
            </>
          )}
        </div>

        {isReanalysis && status === "idle" && (
          <p className="text-muted text-xs mb-4">重新解析将跳过已缓存的文件分析，仅对新增文件重新分析</p>
        )}

        {status === "loading" && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-muted text-sm">
                {progress === null
                  ? "正在准备..."
                  : progress.phase === "mapping"
                  ? `${progress.batchSize} 个文件并行分析中...`
                  : "正在生成复习计划..."}
              </p>
              <p className="text-muted/50 text-xs">已等待 {elapsed} 秒</p>
            </div>
            {progress?.phase === "mapping" && progress.total > 0 && (
              <div className="w-full bg-background rounded-full h-1 border border-white/5">
                <div
                  className="bg-accent h-1 rounded-full transition-all duration-500"
                  style={{ width: `${Math.round(progress.current / progress.total * 100)}%` }}
                />
              </div>
            )}
          </div>
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
