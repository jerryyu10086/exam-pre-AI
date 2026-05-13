export function buildMapSlidesPrompt(fileText: string): string {
  return `你是考试内容分析专家。请分析以下课件内容，完整提取其中出现的所有知识点，不要遗漏、不要以"重要性"为由过滤任何内容——重要性由后续步骤判断。

请严格按以下JSON格式输出，不要添加任何其他内容：
{
  "chapter_name": "章节名称",
  "knowledge_points": [
    {
      "name": "知识点名称",
      "explanation": "尽量详细的解释，包含定义、原理、推导过程等",
      "examples": ["示例、公式、数字、人名等具体内容（如有）"],
      "source": "来源位置（第几页/第几节）"
    }
  ],
  "common_confusions": ["易混淆点或易错点描述"],
  "memory_anchors": ["需要精确记忆的数字/公式/人名/定义"]
}

课件内容：
${fileText}`;
}

export function buildMapExamWithAnswersPrompt(fileText: string): string {
  return `你是考试内容分析专家。请分析以下真题（含答案），提取题型规律和标准答题框架。

请严格按以下JSON格式输出，不要添加任何其他内容：
{
  "chapter_name": "真题集名称（如：2023年期末真题）",
  "exam_patterns": [
    {
      "type": "题型（名词解释/简答/计算/论述）",
      "question_sample": "题目示例",
      "answer_framework": "标准答题框架",
      "source": "题目位置"
    }
  ],
  "coverage_topics": ["涵盖主题列表"],
  "confidence_note": "覆盖情况说明"
}

真题内容：
${fileText}`;
}

export function buildMapExamNoAnswersPrompt(fileText: string): string {
  return `你是考试内容分析专家。请分析以下真题（无答案），分析题型和考察角度。

请严格按以下JSON格式输出，不要添加任何其他内容：
{
  "chapter_name": "真题集名称（如：2022年期末真题）",
  "exam_patterns": [
    {
      "type": "题型",
      "question_sample": "题目示例",
      "examination_angle": "考察角度分析",
      "source": "题目位置"
    }
  ],
  "coverage_topics": ["涵盖主题列表"],
  "confidence_note": "无答案，仅题型分析，置信度中等"
}

真题内容：
${fileText}`;
}

export function buildReducePrompt(allMapsJson: string, userContext?: string): string {
  const userContextSection = userContext?.trim()
    ? `\n用户补充信息（作为优先级判断的重要参考）：\n${userContext.trim()}\n`
    : "";

  return `你是备考策略专家。以下是该考试所有材料的完整摘要（课件 + 真题，均未经重要性过滤）。
${userContextSection}
请完成以下任务：
1. 参考真题摘要（material_type="exam"）判断各课件知识点的实际被考频率
2. 为每份课件（material_type="slides"）的每个知识点标注档位（必学/补充/拓展）
3. 按重要性从高到低为所有课件排序（order 从 1 开始）

档位判断优先级：真题出现频率 > 用户补充信息 > 课件强调程度
嵌套约束：必学⊂补充⊂拓展，每档只写新增内容，不重复前一档

仅输出课件条目（不输出真题条目），严格按以下JSON格式输出，不要添加任何其他内容：

[
  {
    "file_name": "（与输入中的 file_name 完全一致）",
    "display_name": "简洁的展示名（如：第三章 细胞膜结构）",
    "order": 1,
    "importance": "高频",
    "knowledge_points": [
      { "tier": "必学", "name": "知识点名", "explanation": "详细解释", "examples": ["示例"], "source": "来源位置" }
    ],
    "common_confusions": ["从该课件MAP原样传递"],
    "memory_anchors": ["从该课件MAP原样传递"]
  }
]

材料摘要：
${allMapsJson}`;
}
