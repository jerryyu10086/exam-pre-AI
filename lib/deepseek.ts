import { DEEPSEEK_MODEL } from "./config";

const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";

type Message = { role: "system" | "user" | "assistant"; content: string };

export async function callDeepSeek(messages: Message[]): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error("DEEPSEEK_API_KEY 未配置");

  const response = await fetch(DEEPSEEK_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: DEEPSEEK_MODEL,
      messages,
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`DeepSeek API 错误: ${response.status} ${text}`);
  }

  const data = await response.json();
  return data.choices[0].message.content as string;
}

// 从 DeepSeek 输出中提取 JSON：优先取最后一个代码块（兼容 CoT 推理前缀），兜底直接解析
export function extractJSON(text: string): unknown {
  const matches = [...text.matchAll(/```(?:json)?\s*([\s\S]*?)```/g)];
  if (matches.length > 0) {
    return JSON.parse(matches[matches.length - 1][1].trim());
  }
  // 兜底：从最后一个 [ 开始找 JSON 数组
  const lastBracket = text.lastIndexOf("[");
  if (lastBracket !== -1) {
    return JSON.parse(text.slice(lastBracket).trim());
  }
  return JSON.parse(text.trim());
}
