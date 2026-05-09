export function buildMapSlidesPrompt(fileText: string): string {
  return `你是考试内容分析专家。请分析以下课件内容，提取核心知识点和考点。

请严格按以下JSON格式输出，不要添加任何其他内容：
{
  "chapter_name": "章节名称",
  "core_concepts": [
    {
      "name": "概念名",
      "explanation": "详细解释",
      "examples": ["示例（如有）"],
      "source": "来源位置"
    }
  ],
  "exam_focus": [
    { "name": "考点名", "question_type": "名词解释/简答/计算/论述" }
  ],
  "common_confusions": ["易混淆点描述"],
  "memory_anchors": ["关键数字/公式/人名"]
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

export function buildReducePrompt(allMapsJson: string): string {
  return `你是备考策略专家。以下是该考试所有课件和真题的结构化摘要。

请按以下步骤分析，输出结构化复习计划：

Step 1：梳理所有课件覆盖的完整知识图谱
Step 2：对照真题，评估知识点实际被考概率，注明覆盖置信度
Step 3：按章节自然顺序（第一章→第二章→...）组织，每章评估重要性
        重要性档位：高频 / 中频 / 低频
        ⚠ 重要性是标签，不影响章节排序
Step 4：每章内部按知识点在课件中的原始顺序输出，每条标注档位（必学/补充/拓展）
        嵌套约束：必学⊂补充⊂拓展，每档只写新增内容，不重复前一档
Step 5：严格按以下JSON格式输出，不要添加任何其他内容：

[
  {
    "chapter_name": "第一章 细胞概述",
    "chapter_order": 1,
    "importance": "高频",
    "knowledge_points": [
      { "tier": "必学", "name": "要点名", "explanation": "详细解释", "examples": ["示例"], "source": "第X讲第X页" },
      { "tier": "补充", "name": "要点名", "explanation": "详细解释", "examples": ["示例"], "source": "第X讲第X页" },
      { "tier": "拓展", "name": "要点名", "explanation": "详细解释", "examples": ["示例"], "source": "第X讲第X页" }
    ]
  }
]

材料摘要：
${allMapsJson}`;
}
