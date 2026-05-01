import OpenAI from "openai";
import { EMBEDDING_MODEL, EMBEDDING_DIMENSIONS } from "./config";

const openai = new OpenAI(); // 读取 OPENAI_API_KEY

const BATCH_SIZE = 100;

export async function embedBatch(texts: string[]): Promise<number[][]> {
  const results: number[][] = [];
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: batch,
      dimensions: EMBEDDING_DIMENSIONS,
    });
    results.push(...response.data.map((d) => d.embedding));
  }
  return results;
}
