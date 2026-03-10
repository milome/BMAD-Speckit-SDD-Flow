/**
 * 评测题目 Agent 作答：调用 LLM 根据题目内容生成审计报告格式的回答
 * 流程：先由 Agent 生成回答 → 再对回答调用 parseAndWriteScore
 */
const EVAL_AGENT_SYSTEM_PROMPT = `你是一位资深工程师，负责回答评测题目。请根据题目中的「背景」「任务」「验收标准」作答，并以审计报告格式输出。

你的回答必须包含以下可解析块，否则 parseAndWriteScore 无法解析：

1. **总体评级**：独立一行，格式为 \`总体评级: A\` 或 \`总体评级: B\` 或 \`总体评级: C\` 或 \`总体评级: D\`（仅限 A/B/C/D，禁止 A-、C+ 等）

2. **维度评分**：四行，每行格式为 \`- 维度名: XX/100\`，维度名必须为：需求完整性、可测试性、一致性、可追溯性。示例：
\`\`\`
维度评分:
- 需求完整性: 85/100
- 可测试性: 90/100
- 一致性: 80/100
- 可追溯性: 95/100
\`\`\`

3. **批判审计员结论**（强制必须）：段落标题 \`## 批判审计员结论\`，包含已检查维度、每维度结论、本轮结论。

4. **问题清单**（若有）：格式 \`1. [严重程度:高|中|低] 描述\`

请先给出完整作答内容（根因分析、改进方案、可验证性等），再在结尾输出上述可解析块。仅输出报告正文，不要输出其他说明。`;

export interface GenerateEvalAnswerOptions {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  timeoutMs?: number;
}

export class EvalAgentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EvalAgentError';
  }
}

/**
 * 调用 LLM 根据题目内容生成审计报告格式的回答
 */
export async function generateEvalAnswer(
  questionContent: string,
  options?: GenerateEvalAnswerOptions
): Promise<string> {
  const apiKey = options?.apiKey ?? process.env.SCORING_LLM_API_KEY;
  if (!apiKey) {
    throw new EvalAgentError('SCORING_LLM_API_KEY 未设置，无法调用 Agent 作答');
  }

  const baseUrl = (options?.baseUrl ?? process.env.SCORING_LLM_BASE_URL ?? 'https://api.openai.com/v1').replace(
    /\/$/,
    ''
  );
  const model = options?.model ?? process.env.SCORING_LLM_MODEL ?? 'gpt-4o-mini';
  const timeoutMs = options?.timeoutMs ?? (parseInt(String(process.env.SCORING_LLM_TIMEOUT_MS ?? 60000), 10) || 60000);

  const url = `${baseUrl}/chat/completions`;
  const body = {
    model,
    messages: [
      { role: 'system', content: EVAL_AGENT_SYSTEM_PROMPT },
      { role: 'user', content: `请根据以下评测题目作答：\n\n${questionContent}` },
    ],
    temperature: 0.3,
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!res.ok) {
    throw new EvalAgentError(`LLM API 错误: ${res.status} ${res.statusText}`);
  }

  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = data?.choices?.[0]?.message?.content ?? '';
  if (!content.trim()) {
    throw new EvalAgentError('LLM 返回空内容');
  }

  return content.trim();
}
