import { EMBEDDING_MODEL } from "./config";

const ZHIPU_API_KEY = process.env.ZHIPU_API_KEY;
const ZHIPU_EMBEDDING_URL = "https://open.bigmodel.cn/api/paas/v4/embeddings";

const BATCH_SIZE = 100;

export async function embedBatch(texts: string[]): Promise<number[][]> {
  if (!ZHIPU_API_KEY) {
    throw new Error("ZHIPU_API_KEY 未配置");
  }

  const results: number[][] = [];
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);

    const response = await fetch(ZHIPU_EMBEDDING_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${ZHIPU_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        input: batch,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`智谱 Embedding API 错误: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    results.push(...data.data.map((d: any) => d.embedding));
  }
  return results;
}
