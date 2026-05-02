import {
  SLIDES_MIN_CHUNK_CHARS,
  TEXTBOOK_CHUNK_SIZE,
  TEXTBOOK_CHUNK_OVERLAP,
} from "./config";

// pdf-parse v1 是 CJS 函数导出
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require("pdf-parse") as (
  buffer: Buffer,
  options?: Record<string, unknown>
) => Promise<{ text: string; numpages: number }>;

// 按页返回文本（用于课件）
export async function parsePdfPages(buffer: Buffer): Promise<string[]> {
  const pages: string[] = [];
  await pdfParse(buffer, {
    pagerender(pageData: any) {
      return pageData.getTextContent().then((tc: any) => {
        const text = tc.items
          .map((item: any) => item.str)
          .join(" ")
          .trim();
        pages.push(text);
        return text;
      });
    },
  });
  return pages;
}

// 返回整份 PDF 纯文本（用于真题/课本）
export async function parsePdf(buffer: Buffer): Promise<string> {
  const data = await pdfParse(buffer);
  return data.text;
}

// 课件：一页一 chunk，字数不足时合并相邻页
export function chunkSlides(pages: string[]): string[] {
  const chunks: string[] = [];
  let i = 0;
  while (i < pages.length) {
    let chunk = pages[i];
    while (chunk.length < SLIDES_MIN_CHUNK_CHARS && i + 1 < pages.length) {
      i++;
      chunk += " " + pages[i];
    }
    const trimmed = chunk.trim();
    if (trimmed) chunks.push(trimmed);
    i++;
  }
  return chunks;
}

// 真题：按题号分割
export function chunkExam(text: string): string[] {
  const parts = text
    .split(
      /(?=(?:第\s*\d+\s*题|Q\s*\d+\b|[一二三四五六七八九十]+\s*[、.．]|\d+\s*[.．、]))/
    )
    .map((p) => p.trim())
    .filter((p) => p.length > 10);
  return parts.length > 1 ? parts : [text.trim()];
}

// 课本：固定长度分块，段落边界截断，含重叠
export function chunkTextbook(text: string): string[] {
  const chunks: string[] = [];
  const overlap = Math.floor(TEXTBOOK_CHUNK_SIZE * TEXTBOOK_CHUNK_OVERLAP);
  let i = 0;
  while (i < text.length) {
    let end = Math.min(i + TEXTBOOK_CHUNK_SIZE, text.length);
    if (end < text.length) {
      const boundary = text.lastIndexOf("\n", end);
      if (boundary > i + TEXTBOOK_CHUNK_SIZE / 2) end = boundary;
    }
    const chunk = text.slice(i, end).trim();
    if (chunk) chunks.push(chunk);
    i = end - overlap;
    if (i >= end) i = end;
  }
  return chunks;
}
