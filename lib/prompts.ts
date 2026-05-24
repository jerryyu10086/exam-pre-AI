export function buildMapSlidesPrompt(fileText: string): string {
  return `你是一个专业的备考助手。你的任务是将课件内容转化为一份详细的学习文档，让学生不需要看原始课件就能完整理解这门课。

【语言要求】：所有输出字段（concept、knowledge、explanation）必须使用中文，无论课件原文是中文还是英文。
- 专业术语写法：中文名称后紧跟英文原文括号，如"常应变三角形（CST, Constant Strain Triangle）"、"有限元分析（FEA）"
- 数学符号、变量名保持英文，如 $E$、$\sigma$、$\varepsilon$
- 禁止直接复制粘贴英文课件原文作为知识点内容，必须翻译为中文

提取要求：
- 覆盖课件中出现的所有知识点，不做筛选和遗漏
- 重要性不在此阶段判断，由后续步骤决定
- 所有数学公式使用 $（行内）或 $$（独立行）标注，不使用其他括号形式

每个知识点分两部分输出：
- A部分（knowledge、source）：完整还原知识点的内容，供系统后续整合使用
- B部分（explanation）：让学生读完后能用自己的话解释这个概念，而不只是背出定义，内容形式由学科性质自行决定

字段说明：
- id：kp_0、kp_1、kp_2 依次递增，用于跨步骤稳定引用，不得重复
- concept：知识点的规范名称（中文，专业术语附英文）
- knowledge：【A部分】完整还原该知识点的核心内容，包含定义、原理、关键结论、重要公式、需精确记忆的数值等（必须用中文）
- source：【A部分】在课件中的位置，如"第3章 细胞膜结构，第5页"，要求具体到页，不能只写章节
- explanation：【B部分】帮助学生真正理解该知识点，不是重复 knowledge 的内容（必须用中文）

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

  return `你是备考策略专家。以下是该考试所有材料的完整摘要（课件 + 真题，均未经重要性过滤）。
${userContextSection}
━━ 档位判断标准 ━━

- 必学：高概率直接被考，不知道会直接失分。判断依据：真题中明确出现过，或考纲/用户明确标注。
- 补充：能让答案更完整、更有深度，没有不一定丢分。判断依据：真题间接涉及，或课件多次强调但未见于真题。
- 拓展：背景知识或理论延伸，极少单独成题。判断依据：课件提及但真题从未考过，了解即可。

档位判断优先级：真题出现频率 > 用户补充信息 > 课件强调程度

嵌套约束：必学⊂补充⊂拓展，每档只写该档新增的内容，不重复前一档已有的内容。

示例（正确做法）：
  必学：{ "id": "kp_1", "tier": "必学", "concept": "ATP合成", "knowledge": "细胞通过氧化磷酸化在线粒体内膜合成ATP" }
  补充：{ "id": "kp_2", "tier": "补充", "concept": "ATP合酶结构", "knowledge": "由F0和F1亚基组成，质子驱动旋转催化ADP磷酸化" }  ← 不重复"氧化磷酸化"
  拓展：{ "id": "kp_3", "tier": "拓展", "concept": "化学渗透假说", "knowledge": "Mitchell提出质子梯度驱动ATP合成的历史背景" }  ← 不重复前两档

示例（错误做法，避免）：
  补充：{ "id": "kp_2", "tier": "补充", "concept": "ATP合酶结构", "knowledge": "细胞通过氧化磷酸化合成ATP，ATP合酶由F0和F1亚基组成…" }  ← 重复了必学内容

━━ 真题信号强度说明 ━━

- 有答案真题（含 answer_framework 字段）：最强信号，涉及的知识点直接列为必学候选。
- 无答案真题（含 examination_angle 字段）：中等信号，参考考察方向但置信度低，需结合课件强调程度综合判断。
- 无任何真题：跳过下方第一步，依据课件内部的覆盖深度、知识点间的关联性及用户补充信息判断档位；此时档位标准调整为：
  - 必学：课件明确反复强调，是其他知识点的基础概念
  - 补充：课件正常介绍但非核心
  - 拓展：课件一带而过，或属于背景/历史脉络

━━ 推理步骤（先输出分析过程，再输出JSON）━━

推理过程用自然语言，不要使用代码块；最终JSON单独放在一个\`\`\`json 代码块中。

第一步：列出所有真题摘要（material_type="exam"）中明确考过的主题，每条注明信号强度（有答案/无答案）。若无真题，写"无真题，跳过"。
第二步：逐份课件（material_type="slides"）检查，标出哪些知识点与第一步主题直接对应（必学候选），哪些间接相关（补充候选），哪些未被真题覆盖（拓展候选）。
第三步：结合用户补充信息调整档位，并按综合重要性对所有课件排序（order 从 1 开始，1 = 最重要）。
第四步：将结果输出为下方格式的JSON，放在\`\`\`json 代码块中。

━━ 最终JSON格式 ━━

仅包含课件条目（不输出真题条目）：

[
  {
    "file_name": "（与输入中的 file_name 完全一致）",
    "display_name": "简洁的展示名（如：第三章 细胞膜结构）",
    "order": 1,
    "importance": "高频",
    "knowledge_points": [
      { "id": "kp_0", "tier": "必学" },
      { "id": "kp_1", "tier": "补充" },
      { "id": "kp_2", "tier": "拓展" }
    ]
  }
]

注意：knowledge_points 只输出 id 和 tier，不要复制 knowledge/concept/source 等字段内容（系统将自动从原始数据补全）。
importance 取值只能是：高频 / 中频 / 低频

━━ 材料摘要 ━━

${allMapsJson}`;
}
