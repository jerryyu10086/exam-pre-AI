// 模型
export const CLAUDE_MODEL = "claude-sonnet-4-6";
export const EMBEDDING_MODEL = "text-embedding-3-small";
export const EMBEDDING_DIMENSIONS = 1536;

// RAG
export const TOP_K = 10;
export const SIMILARITY_THRESHOLD = 0.7;

// 全局问答 Agent 路由
export const GLOBAL_QA_TOP_CHAPTERS = 3;
export const ROUTE_CONFIDENCE_THRESHOLD = 0.6;

// Chunking
export const SLIDES_MIN_CHUNK_CHARS = 80;
export const TEXTBOOK_CHUNK_SIZE = 900;
export const TEXTBOOK_CHUNK_OVERLAP = 0.2;
