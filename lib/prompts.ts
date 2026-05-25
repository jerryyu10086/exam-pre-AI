export function buildMapSlidesPrompt(fileText: string): string {
  return `你是备考知识点提取器。严格按照下方JSON格式输出，禁止输出任何前言、解释、总结或JSON以外的内容。

【语言要求】
- 课件为中文时：所有字段纯中文，禁止附加英文括号（数学符号/变量名除外，如 $E$、$\sigma$）
- 课件为英文时：concept 格式为"中文名（English Name）"；knowledge/explanation 中专业术语首次出现时附英文括号，已在 concept 标注过的不重复
- 禁止直接复制英文原文，必须翻译为中文
- 数学公式使用 $（行内）或 $$（独立行），不使用其他形式

【提取要求】
- 覆盖课件中出现的所有知识点，不做筛选和遗漏
- 重要性不在此阶段判断，由后续步骤决定

【字段说明】
- id：kp_0、kp_1 依次递增，不得重复
- concept：知识点规范名称
- knowledge：【A部分】完整还原定义、原理、关键结论、重要公式、需精确记忆的数值
- source：具体页码，如"第5页"
- explanation：【B部分】帮助学生真正理解，不重复 knowledge 内容

\`\`\`json
{
  "knowledge_points": [
    {
      "id": "kp_0",
      "concept": "",
      "knowledge": "",
      "source": "",
      "explanation": ""
    }
  ]
}
\`\`\`

课件内容：
${fileText}`;
}

export function buildMapExamWithAnswersPrompt(fileText: string): string {
  return `你是考试内容分析专家。请分析以下真题（含答案），提取题型规律和标准答题框架。

请严格按以下JSON格式输出，不要添加任何其他内容：
{
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
  "exam_patterns": [
    {
      "type": "题型",
      "question_sample": "题目示例",
      "examination_angle": "考察角度分析",
      "source": "题目位置"
    }
  ],
  "coverage_topics": ["涵盖主题列表"],
  "confidence_note": "根据题目数量和覆盖范围，说明本份真题在无答案情况下的参考价值与局限"
}

真题内容：
${fileText}`;
}

export function buildReducePrompt(allMapsJson: string, userContext?: string): string {
  const userContextSection = userContext?.trim()
    ? `\n用户补充信息（作为优先级判断的重要参考）：\n${userContext.trim()}\n`
    : "";

  return `你是备考策略专家。以下是该考试所有材料的完整摘要（课件 + 真题，均未经重要性过滤）。请分析后输出每份课件的知识点档位与排序。
${userContextSection}
━━ 档位判断标准 ━━

- 必学：高概率直接被考，不知道会直接失分。判断依据：真题中明确出现过，或考纲/用户明确标注。
- 补充：能让答案更完整、更有深度，没有不一定丢分。判断依据：真题间接涉及，或课件多次强调但未见于真题。
- 拓展：背景知识或理论延伸，极少单独成题。判断依据：课件提及但真题从未考过，了解即可。

档位判断优先级：真题出现频率 > 用户补充信息 > 课件强调程度

嵌套约束：必学⊂补充⊂拓展，每档只写该档新增的内容，不重复前一档已有的内容。

━━ 真题信号强度说明 ━━

- 有答案真题（含 answer_framework 字段）：最强信号，涉及的知识点直接列为必学候选。
- 无答案真题（含 examination_angle 字段）：中等信号，参考考察方向但置信度低，需结合课件强调程度综合判断。
- 无任何真题：依据课件内部的覆盖深度、知识点间的关联性及用户补充信息判断档位；此时档位标准调整为：
  - 必学：课件明确反复强调，是其他知识点的基础概念
  - 补充：课件正常介绍但非核心
  - 拓展：课件一带而过，或属于背景/历史脉络

━━ 输出要求 ━━

直接输出 JSON，放在 \`\`\`json 代码块中，要求：
- 只输出课件条目（不输出真题条目）
- knowledge_points 每条只含 id 和 tier 两个字段，禁止输出 knowledge/concept/source 等其他内容
- order 从 1 开始，1 = 最重要，按综合重要性排序
- file_name 与输入中完全一致

\`\`\`json
[
  {
    "file_name": "lecture_03.pdf",
    "display_name": "第三章 细胞膜结构",
    "order": 1,
    "knowledge_points": [
      { "id": "kp_0", "tier": "必学" },
      { "id": "kp_1", "tier": "补充" },
      { "id": "kp_2", "tier": "拓展" }
    ]
  }
]
\`\`\`

━━ 材料摘要 ━━

${allMapsJson}`;
}
