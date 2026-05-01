export default function Home() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-primary mb-2">
          期末备考AI助手
        </h1>
        <p className="text-muted text-sm">MVP Task 1 — 项目初始化完成</p>
        <div className="mt-6 flex gap-3 justify-center">
          <span className="px-3 py-1 rounded-md bg-tier-must text-primary text-xs">必学</span>
          <span className="px-3 py-1 rounded-md bg-tier-supplement text-primary text-xs">补充</span>
          <span className="px-3 py-1 rounded-md bg-tier-expand text-primary text-xs">拓展</span>
          <span className="px-3 py-1 rounded-md bg-accent text-primary text-xs">accent</span>
        </div>
      </div>
    </div>
  );
}
