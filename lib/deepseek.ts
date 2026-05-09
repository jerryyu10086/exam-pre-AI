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

// DeepSeek 有时在 JSON 外包一层 markdown 代码块，这里统一处理
export function extractJSON(text: string): unknown {
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonStr = match ? match[1] : text;
  return JSON.parse(jsonStr.trim());
}
