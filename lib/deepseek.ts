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

// 修复 JSON 字符串中非法的反斜杠转义（如 LaTeX \alpha \sum 等）
function fixEscapes(s: string): string {
  return s.replace(/\\(?!["\\/bfnrtu])/g, "\\\\");
}

// 多策略尝试解析，失败返回 null
function tryParse(s: string): unknown | null {
  const cleaned = s.trim();
  // 策略1：修复非法转义
  try { return JSON.parse(fixEscapes(cleaned)); } catch {}
  // 策略2：去掉控制字符再修复转义
  try { return JSON.parse(fixEscapes(cleaned.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ""))); } catch {}
  return null;
}

// 从 DeepSeek 输出中提取 JSON：优先取最后一个代码块（兼容 CoT 推理前缀），兜底直接解析
export function extractJSON(text: string): unknown {
  const matches = [...text.matchAll(/```(?:json)?\s*([\s\S]*?)```/g)];
  if (matches.length > 0) {
    const r = tryParse(matches[matches.length - 1][1]);
    if (r !== null) return r;
  }
  // 兜底：从最后一个 [ 开始找 JSON 数组
  const lastBracket = text.lastIndexOf("[");
  if (lastBracket !== -1) {
    const r = tryParse(text.slice(lastBracket));
    if (r !== null) return r;
  }
  const r = tryParse(text);
  if (r !== null) return r;
  // 最终兜底：返回空对象，不抛错，保证批次继续
  console.error("extractJSON: 所有解析策略失败，返回空对象。原始内容片段：", text.slice(0, 200));
  return {};
}
