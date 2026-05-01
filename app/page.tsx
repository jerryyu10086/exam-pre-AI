"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleCreate() {
    if (!name.trim() || loading) return;
    setLoading(true);
    const res = await fetch("/api/exam", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    });
    const data = await res.json();
    if (data.id) router.push(`/exam/${data.id}/slides`);
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="w-full max-w-sm px-4">
        <h1 className="text-2xl font-semibold text-primary mb-2 text-center">
          期末备考AI助手
        </h1>
        <p className="text-muted text-sm text-center mb-8">
          新建考试，开始上传课件
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            placeholder="考试名称（如：细胞生物学）"
            className="flex-1 bg-card border border-white/5 rounded-md px-3 py-2 text-primary text-sm placeholder:text-muted outline-none focus:border-accent/50 transition-colors"
          />
          <button
            onClick={handleCreate}
            disabled={!name.trim() || loading}
            className="bg-accent hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-primary rounded-md px-4 py-2 text-sm font-medium transition-colors"
          >
            {loading ? "..." : "新建"}
          </button>
        </div>
      </div>
    </div>
  );
}
