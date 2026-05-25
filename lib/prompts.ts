export function buildMapSlidesPrompt(fileText: string): string {
  return `你是备考课件结构化提取器。严格按下方 JSON 输出，禁止任何 JSON 以外的文字。

【两阶段思考】（内部完成，不输出）
1. 先通读课件，识别其逻辑章节结构（按"标题层级 / 主题切换 / 页码段落"判断），形成 2-6 个章节，每章节赋编号 1、2、3...；若有明显的子主题再细分为 1.1、1.2。
2. 然后在每个章节内逐个抽取知识点，归档到对应章节编号下。

【知识点粒度判定】
一个完整知识点 = 具备独立 concept 名称 + 可单独成为简答题考点 的内容单元。
- 合并：同一概念的"定义 + 公式 + 性质"作为一个知识点
- 拆分：互为并列的子概念（如"傅里叶变换的 4 个性质"，每个性质有独立公式与应用）拆为多个
- 排除：纯过渡句、目录页、致谢、参考文献、纯封面

【输出顺序约束】
- id 从 kp_0 开始全文线性递增，唯一不重复
- 同一 section_number 下的所有知识点 id 必须连续，跨 section 时才进入下一段 id
- 这样按 id 升序排列即等于"章节顺序 + 章节内自然顺序"

【提取要求】
- 覆盖课件中出现的所有知识点，不做筛选和遗漏
- 重要性不在此阶段判断，由后续步骤决定

【字段说明】
- id：kp_0、kp_1 依次递增，不得重复
- section_number：所属章节编号，如 "1" 或 "2.1"
- section_name：章节名称（5-15 字，概括该章节主题）
- concept：知识点规范名称
- knowledge：【A 部分 — 用户直接阅读学习】
    用"教科书段落"风格成段写作，不堆砌定义短句。
    要素：背景一句话 → 核心定义 → 关键公式 / 数值（用 $...$）→ 适用条件。
    禁止"它是…""指的是…"这种纯字典式开头。
    目标：用户读完这段就能掌握该知识点的硬核内容。
- source：concept 所在的具体页码，体现为"第X页"；若该知识点在多个页面出现，列出所有页码，如"第3页、第5页"。
- explanation：【B 部分 — 帮助理解】
    与 knowledge 严格互补，不重复 A 已写过的定义与公式。
    目的是帮助学生真正理解，而非死记硬背。可以包含但不限于：概念内涵、与其他知识点的关系、常见误区、形象比喻、应用示例等，要求深入浅出，通俗易懂。

【语言要求】
- 课件主体为中文时：所有字段纯中文，禁止附加英文括号（数学符号/变量名除外，如 $E$、$\\sigma$）
- 课件主体为英文时：concept 格式为"中文名（English Name）"；knowledge/explanation 中重点术语首次出现时附英文括号，已在 concept 标注过的不重复
- 数学公式使用 $（行内）或 $$（独立行），不使用其他形式

{
  "knowledge_points": [
    {
      "id": "kp_0",
      "section_number": "1",
      "section_name": "",
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

// V1 未使用：真题 MAP 短路（plan/map/route.ts 收到 exam 直接返回 null），REDUCE 也不消费真题。
// 保留函数体作为 V2 接入真题信号时的备用模板。
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

// V1 未使用：同上，V2 备用模板。
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

export function buildReducePrompt(slidesMapsJson: string, userContext?: string): string {
  const userContextSection = userContext?.trim()
    ? `\n用户补充信息（作为档位判断与章节重要性的重要参考）：\n${userContext.trim()}\n`
    : "";

  return `你是备考策略专家。基于以下课件结构化摘要，为用户生成一份完整的复习框架：包含每个章节的脉络概括、每个知识点的档位归档，以及整门学科的主线脉络。
${userContextSection}
━━ 推理步骤（按顺序内部完成，最终只输出 JSON）━━

【第1步：跨课件关联分析】
扫描所有课件知识点，识别：
- 反复出现的核心概念（在多份课件出现的术语）
- 跨章节依赖关系（某知识点是其他知识点的前置基础）
- 课件强调程度的信号（页面占比、反复回顾、明确"重点"标注）

【第2步：章节框架构建】
对每份课件，按 section_number 聚合知识点，提炼出 chapter_summary 一句话脉络。
chapter_summary 不是把知识点名拼起来，而是回答"本章解决什么问题、引入了什么核心工具/概念、最终能让学生掌握什么能力"。
同时挑出本章 1-5 个最关键的知识点 id 放入 key_focus（必学中的最核心者）。

【第3步：知识点归档】
对每个知识点判定档位：
- 必学：是其他知识点的前置基础 / 课件反复强调（页面占比高、多次回顾）/ 用户上下文指明
- 补充：丰富答案深度但非基础
- 拓展：背景知识、历史脉络、一带而过
嵌套约束：必学⊂补充⊂拓展。
tier_rationale 为可选字段：若有清晰的"为什么必学/补充"证据可填一句话（如"第5章推导的基础概念，多次复现"），无强证据可省略，禁止编造理由。

【第4步：学科主线提炼】
在 __overall_framework__ 中回答三个问题：
- subject_thread：这门课的核心研究对象是什么（一句话主线）
- chapter_relations：章节之间的逻辑关系（哪些是基础、哪些是分支、哪些是综合应用）
- recommended_order：推荐学习顺序（file_name 数组，依赖在前、应用在后）

━━ 输出格式（仅输出 JSON，放在 \`\`\`json 代码块中）━━

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
