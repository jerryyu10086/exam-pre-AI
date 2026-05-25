import { DEEPSEEK_MODEL } from "./config";

const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";

type Message = { role: "system" | "user" | "assistant"; content: string };

export async function callDeepSeek(
  messages: Message[],
  options?: { max_tokens?: number; model?: string; thinking?: boolean; json_mode?: boolean },
  _retries = 2
): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error("DEEPSEEK_API_KEY 未配置");

  const attempt = async (): Promise<string> => {
    const body: Record<string, unknown> = {
      model: options?.model ?? DEEPSEEK_MODEL,
      messages,
      ...(options?.max_tokens ? { max_tokens: options.max_tokens } : {}),
    };
    if (options?.thinking) {
      body.thinking = { type: "enabled" };
    } else {
      body.temperature = 0.3;
    }
    if (options?.json_mode) {
      body.response_format = { type: "json_object" };
    }

    const response = await fetch(DEEPSEEK_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`DeepSeek API 错误: ${response.status} ${text}`);
    }

    const data = await response.json();
    if (data.choices[0].finish_reason === "length") {
      console.warn("DeepSeek 输出被截断（finish_reason=length），输出 token 已达上限");
    }
    return data.choices[0].message.content as string;
  };

  let lastErr: unknown;
  for (let i = 0; i <= _retries; i++) {
    try {
      return await attempt();
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      const causeMsg = err instanceof Error && err.cause instanceof Error ? err.cause.message : "";
      const combined = msg + " " + causeMsg;
      const isRetryable = combined.includes("ECONNRESET") || combined.includes("fetch failed") || combined.includes("ETIMEDOUT") || combined.includes("terminated");
      if (!isRetryable || i === _retries) break;
      console.warn(`DeepSeek 请求失败，第 ${i + 1} 次重试... (${msg})`);
      await new Promise((r) => setTimeout(r, 3000 * (i + 1)));
    }
  }
  throw lastErr;
}

// 修复 JSON 字符串中非法的反斜杠转义（如 LaTeX \alpha \sum 等）。
// 用逐字符扫描而非正则 lookahead，避免破坏合法 \\x 序列：
// 旧版正则 /\\(?!["\\/bfnrtu])/g 在 `\\lambda` 上会错误加倍第二个 `\`
// （位置 0 的 `\` 后面是 `\` 被跳过，位置 1 的 `\` 后面是 `l` 被加倍 → `\\\la` 非法）
function fixEscapes(s: string): string {
  let result = "";
  let i = 0;
  while (i < s.length) {
    if (s[i] === "\\" && i + 1 < s.length) {
      const next = s[i + 1];
      if (next === '"' || next === "\\" || next === "/" || next === "b" || next === "f" || next === "n" || next === "r" || next === "t" || next === "u") {
        // 合法 JSON 转义 → 原样保留这两个字符
        result += s[i] + next;
        i += 2;
      } else {
        // 非法转义如 \sigma → 加倍为 \\sigma
        result += "\\\\" + next;
        i += 2;
      }
    } else {
      result += s[i];
      i++;
    }
  }
  return result;
}

// 多策略尝试解析，失败返回 null
function tryParse(s: string): unknown | null {
  const cleaned = s.trim();
  // 策略1：直接 parse（LLM 输出已是合法 JSON 时必须先试，避免被 fixEscapes 误伤）
  try { return JSON.parse(cleaned); } catch {}
  // 策略2：修复非法转义后再 parse（LLM 偷懒只写一个 \ 时）
  try { return JSON.parse(fixEscapes(cleaned)); } catch {}
  // 策略3：去掉控制字符再修复转义
  try { return JSON.parse(fixEscapes(cleaned.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ""))); } catch {}
  return null;
}

// 截断 JSON 修复：逐字符提取完整的 {...} 对象，用于 MAP/REDUCE 输出被截断时的兜底
export function extractCompleteObjects(text: string): unknown[] {
  const results: unknown[] = [];
  let attempts = 0;
  let failures = 0;
  let i = 0;
  while (i < text.length) {
    if (text[i] !== "{") { i++; continue; }
    const start = i;
    let depth = 0, inStr = false, esc = false;
    let closedAt = -1;
    // 内层用 j，避免破坏外层 i 的恢复能力
    for (let j = i; j < text.length; j++) {
      const c = text[j];
      if (esc) { esc = false; continue; }
      if (c === "\\") { esc = true; continue; }
      if (c === '"') { inStr = !inStr; continue; }
      if (inStr) continue;
      if (c === "{") depth++;
      else if (c === "}") {
        if (--depth === 0) { closedAt = j; break; }
      }
    }
    if (closedAt === -1) {
      // 未闭合 → 极可能是某个字符串里有未转义的 "，导致 inStr 状态错乱吞掉了所有 }
      // 跳到下一个 { 重试（而不是整体 break，避免丢失后面所有对象）
      i = start + 1;
      continue;
    }
    attempts++;
    const parsed = tryParse(text.slice(start, closedAt + 1));
    if (parsed !== null) {
      results.push(parsed);
      i = closedAt + 1; // 成功，跳过整个对象
    } else {
      failures++;
      i = start + 1; // 单对象 parse 失败，从下一个 { 重试
    }
  }
  if (failures > 0 || attempts > results.length) {
    console.warn(`extractCompleteObjects: ${attempts} 个候选对象，${results.length} 成功，${failures} 解析失败`);
  }
  return results;
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
  // 截断修复兜底（REDUCE Phase 2）：Phase 2 JSON 数组被截断时，提取所有完整的文件条目对象
  const firstBracket = text.indexOf("[");
  if (firstBracket !== -1) {
    const objs = extractCompleteObjects(text.slice(firstBracket));
    const fileEntries = objs.filter(
      (o) => typeof o === "object" && o !== null && "file_name" in (o as object)
    );
    if (fileEntries.length > 0) {
      console.warn(`extractJSON: REDUCE截断修复，恢复 ${fileEntries.length} 个文件条目`);
      return fileEntries;
    }
  }
  // 截断修复兜底（MAP）：提取所有完整 {...} 对象，重建 knowledge_points 结构
  const kpStart = text.indexOf('"knowledge_points"');
  if (kpStart !== -1) {
    const objs = extractCompleteObjects(text.slice(kpStart));
    const kps = objs.filter((o) => typeof o === "object" && o !== null && "id" in (o as object));
    if (kps.length > 0) {
      console.warn(`extractJSON: 截断修复，成功提取 ${kps.length} 个知识点`);
      return { knowledge_points: kps };
    }
  }
  console.error("extractJSON: 所有解析策略失败，返回空对象。原始内容片段：", text.slice(0, 200));
  return {};
}
