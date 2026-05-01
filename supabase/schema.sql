-- 在 Supabase SQL Editor 中执行此文件
-- https://supabase.com/dashboard → 项目 → SQL Editor

-- 开启向量扩展
create extension if not exists vector;

-- 考试项目表
create table exams (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  created_at timestamp with time zone default now()
);

-- 课件内容块表（课件/真题/课本 chunks 统一存这里）
create table chunks (
  id uuid default gen_random_uuid() primary key,
  exam_id uuid references exams(id) on delete cascade,
  file_name text,
  material_type text,  -- 'slides' | 'exam' | 'textbook'
  content text,
  embedding vector(1536),
  chunk_index int,
  created_at timestamp with time zone default now()
);

-- MAP 结构化数据表
create table maps (
  id uuid default gen_random_uuid() primary key,
  exam_id uuid references exams(id) on delete cascade,
  chapter_name text,
  chapter_order int,
  importance text,  -- REDUCE 阶段填充：'高频' | '中频' | '低频'
  content jsonb,    -- 结构化 MAP JSON
  created_at timestamp with time zone default now()
);

-- 对话表
create table conversations (
  id uuid default gen_random_uuid() primary key,
  exam_id uuid references exams(id) on delete cascade,
  type text,           -- 'chapter' | 'global'
  chapter_id uuid references maps(id),  -- type='chapter' 时填
  title text,          -- 默认用第一句问题，可重命名
  created_at timestamp with time zone default now()
);

-- 消息表
create table messages (
  id uuid default gen_random_uuid() primary key,
  conversation_id uuid references conversations(id) on delete cascade,
  role text,           -- 'user' | 'assistant' | 'system'
  content text,
  selected_for_memory boolean default false,  -- 用户手动勾选
  created_at timestamp with time zone default now()
);

-- 向量相似度搜索函数
create or replace function match_chunks(
  query_embedding vector(1536),
  match_exam_id uuid,
  match_material_type text default null,
  match_count int default 10
)
returns table(id uuid, content text, file_name text, similarity float)
language sql stable
as $$
  select id, content, file_name,
    1 - (embedding <=> query_embedding) as similarity
  from chunks
  where exam_id = match_exam_id
    and (match_material_type is null or material_type = match_material_type)
    and 1 - (embedding <=> query_embedding) >= 0.7
  order by embedding <=> query_embedding
  limit match_count;
$$;
