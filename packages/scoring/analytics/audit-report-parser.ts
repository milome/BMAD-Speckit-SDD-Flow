/**
 * 审计报告解析器：解析批判审计员结论、GAP 列表、修改建议，供 SFT 提取器使用。
 */
export interface AuditReportSections {
  criticConclusion: string;
  gaps: string[];
  suggestions: string[];
  requiredFixes: string[];
}

const CRITIC_HEADING_RE = /##\s*(?:\d+\.\s*)?(?:批判审计员结论|Critical Auditor Conclusion)\s*\n([\s\S]*?)(?=##\s|$)/i;
const ROUND_CONCLUSION_RE =
  /\*\*(?:本轮结论|Round conclusion)\*\*[：:]\s*([^\n]+(?:\n(?!\*\*)[^\n]*)*)/i;
const NO_GAP_RE = /(?:本轮无新\s*gap|no new gaps?)/i;
const GAP_ITEM_SPLIT_RE = /[；;]\s*|\d+\)\s*|①\s*|②\s*|③\s*|④\s*|⑤\s*/;
const SUGGESTIONS_HEADING_RE =
  /##\s*(?:修改建议|Suggestions|Modification suggestions)\s*\n([\s\S]*?)(?=##\s|$)/i;
const SUGGESTIONS_BOLD_RE =
  /\*\*(?:修改建议|Suggestions)\*\*[：:]\s*([^\n]+(?:\n(?!\*\*)[^\n]*)*)/i;
const SUGGESTIONS_TABLE_RE =
  /\|\s*Gap\s*\|\s*(?:修改建议|Suggestion|Recommendation)\s*\|[\s\S]*?\n\|[-:\s|]+\|\s*\n([\s\S]*?)(?=\n\n|##\s|$)/i;
const REQUIRED_FIX_SECTION_RE =
  /##\s*(?:§\d+\s*)?(?:发现的问题\s*\(Required Fixes\)|Required Fixes|发现的问题)\s*\n([\s\S]*?)(?=##\s|$)/i;
const REQUIRED_FIX_HEADING_RE =
  /###\s+(?:Gap[^\n]*)\n[\s\S]*?\*\*建议\*\*[：:]\s*([^\n]+(?:\n(?!\*\*|###|##)[^\n]*)*)/g;
const TASK_ROW_RE = /^\|\s*(T\d+(?:\.\d+)?)\s*\|\s*([^|]+)\|\s*([^|]+)\|\s*([^|]+)\|/;
const STORY_COMPLETE_RE = /(?:审计结论|批判审计员结论)[\s\S]*?(?:建议主 Agent 将本 Story 标记为完成|完全覆盖、验证通过|本轮无新 gap)/i;

/**
 * 解析审计报告中的批判审计员结论、GAP 列表、修改建议。
 * @param {string} content - 审计报告 markdown 全文
 * @returns {AuditReportSections} 结构化 sections（criticConclusion, gaps, suggestions）
 */
export function extractAuditReportSections(content: string): AuditReportSections {
  const criticConclusion = parseCriticConclusion(content);
  const gaps = parseGaps(content);
  const suggestions = parseSuggestions(content);
  const requiredFixes = parseRequiredFixes(content);
  return { criticConclusion, gaps, suggestions, requiredFixes };
}

function parseCriticConclusion(content: string): string {
  const m = content.match(CRITIC_HEADING_RE);
  if (!m) return '';
  return (m[1] ?? '').trim();
}

function parseGaps(content: string): string[] {
  const roundMatch = content.match(ROUND_CONCLUSION_RE);
  if (!roundMatch) return [];
  const conclusion = (roundMatch[1] ?? '').trim();
  if (NO_GAP_RE.test(conclusion)) return [];

  const match = conclusion.match(/(?:具体项|Items)[：:]\s*([^\n]+)/);
  if (!match) return [];
  const block = (match[1] ?? '').trim();
  return parseGapBlock(block);
}

function parseGapBlock(block: string): string[] {
  const trimmed = block.trim();
  if (!trimmed) return [];
  const parts = trimmed.split(GAP_ITEM_SPLIT_RE).map((s) => s.trim()).filter(Boolean);
  return parts;
}

function parseSuggestions(content: string): string[] {
  const result: string[] = [];

  const headingMatch = content.match(SUGGESTIONS_HEADING_RE);
  if (headingMatch) {
    const text = (headingMatch[1] ?? '').trim();
    const lines = text.split(/\n/).map((l) => l.trim()).filter(Boolean);
    for (const line of lines) {
      const m = line.match(/^\d+\)\s*(.+)$/);
      if (m) result.push(m[1].trim());
      else if (line.length > 0) result.push(line);
    }
  }

  const boldMatch = content.match(SUGGESTIONS_BOLD_RE);
  if (boldMatch) {
    const text = (boldMatch[1] ?? '').trim();
    const parts = text.split(/\d+\)\s*/).map((s) => s.trim()).filter(Boolean);
    for (const p of parts) {
      if (p.length > 0) result.push(p);
    }
  }

  const tableMatch = content.match(SUGGESTIONS_TABLE_RE);
  if (tableMatch) {
    const rows = (tableMatch[1] ?? '').split('\n').filter((r) => r.includes('|'));
    for (const row of rows) {
      const cells = row.split('|').map((c) => c.trim()).filter(Boolean);
      if (cells.length >= 2) result.push(cells[1]);
    }
  }

  return [...new Set(result)];
}

function parseRequiredFixes(content: string): string[] {
  const section = content.match(REQUIRED_FIX_SECTION_RE)?.[1] ?? content;
  const fixes: string[] = [];

  const suggestionLineMatches = [...section.matchAll(/\*\*建议\*\*[：:]\s*([^\n]+)/g)];
  for (const match of suggestionLineMatches) {
    const suggestion = (match[1] ?? '').trim();
    if (suggestion) {
      fixes.push(suggestion);
    }
  }

  for (const match of section.matchAll(REQUIRED_FIX_HEADING_RE)) {
    const suggestion = (match[1] ?? '').trim();
    if (suggestion) {
      fixes.push(suggestion);
    }
  }

  return [...new Set(fixes)];
}

export function extractSpecAssistantTargets(content: string): string[] {
  const sections = extractAuditReportSections(content);
  const directSuggestions = [...content.matchAll(/\*\*建议\*\*[：:]\s*([^\n]+)/g)]
    .map((match) => (match[1] ?? '').trim())
    .filter(Boolean);
  return [...new Set([...sections.requiredFixes, ...sections.suggestions, ...sections.gaps, ...directSuggestions].filter(Boolean))];
}

export function extractPlanAssistantTargets(content: string): string[] {
  const sections = extractAuditReportSections(content);
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^\d+\./.test(line) || /^-\s+/.test(line));

  const planCoverageRows = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith('|') && (line.includes('⚠️') || line.includes('❌') || line.includes('建议') || line.includes('未覆盖') || line.includes('缺失')))
    .flatMap((row) => row.replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.trim()))
    .filter((cell) => cell.includes('未覆盖') || cell.includes('缺失') || cell.includes('建议') || cell.includes('模糊') || cell.includes('fallback'));

  const recommendationBlocks = [...content.matchAll(/###\s+(未通过项与修改建议|可补充项|模糊表述与术语歧义)[\s\S]*?(?=###\s+|##\s+|$)/g)]
    .flatMap((match) =>
      (match[0] ?? '')
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => /^\d+\.\s+/.test(line) || /^-\s+/.test(line))
        .map((line) => line.replace(/^\d+\.\s+/, '').replace(/^-\s+/, '').trim())
    )
    .filter(Boolean);

  return [...new Set([...sections.requiredFixes, ...sections.suggestions, ...lines, ...planCoverageRows, ...recommendationBlocks].filter(Boolean))];
}

export function extractTasksAssistantTargets(content: string): string[] {
  const lines = content.split(/\r?\n/);
  const tasks: string[] = [];

  for (const line of lines) {
    const rowMatch = line.match(TASK_ROW_RE);
    if (rowMatch) {
      tasks.push(`${rowMatch[1]} ${rowMatch[2].trim()}`);
      continue;
    }

    const checkboxMatch = line.match(/^-\s*\[(?: |x)\]\s*\*\*(T\d+(?:\.\d+)?)\*\*[:：]?\s*(.+)$/i);
    if (checkboxMatch) {
      tasks.push(`${checkboxMatch[1]} ${checkboxMatch[2].trim()}`);
    }
  }

  const sections = extractAuditReportSections(content);
  const storyCheckboxes = lines
    .map((line) => line.trim())
    .filter((line) => /^-\s*\[(?: |x)\]\s+/.test(line) || /^\*\s+/.test(line))
    .map((line) => line.replace(/^-\s*\[(?: |x)\]\s+/, '').replace(/^\*\s+/, '').trim())
    .filter(Boolean);

  const taskHeadings = lines
    .map((line) => line.trim())
    .filter((line) => /^##+\s+(?:T\d|Tasks|Acceptance Criteria|本 Story 范围|需求追溯)/i.test(line))
    .map((line) => line.replace(/^##+\s+/, '').trim());

  const taskBodyLines = lines
    .map((line) => line.trim())
    .filter((line) => /^-\s*\[(?: |x)\]\s*T\d+(?:\.\d+)?/.test(line) || /^-\s*\[(?: |x)\]\s+.+internalYes/.test(line))
    .map((line) => line.replace(/^-\s*\[(?: |x)\]\s+/, '').trim());

  const phaseTaskHeadings = lines
    .map((line) => line.trim())
    .filter((line) => /^##\s+Phase\s+\d+/i.test(line) || /^###\s+T\d+/.test(line))
    .map((line) => line.replace(/^##+\s+/, '').trim());

  const quotedModifyLines = lines
    .map((line) => line.trim())
    .filter((line) => line.startsWith('- **修改**：') || line.startsWith('- **内容**：') || line.startsWith('- **验收**：'))
    .map((line) => line.replace(/^-\s*\*\*(修改|内容|验收)\*\*[：:]/, '').trim());

  return [...new Set([...tasks, ...storyCheckboxes, ...taskHeadings, ...taskBodyLines, ...phaseTaskHeadings, ...quotedModifyLines, ...sections.requiredFixes, ...sections.suggestions].filter(Boolean))];
}

export function extractStoryAssistantTargets(content: string): string[] {
  const sections = extractAuditReportSections(content);
  const conclusions = sections.criticConclusion ? [sections.criticConclusion] : [];
  if (STORY_COMPLETE_RE.test(content)) {
    conclusions.push('将本 Story 标记为完成，并进入后续收尾或 Epic 集成。');
  }

  return [...new Set([...sections.requiredFixes, ...sections.suggestions, ...conclusions].filter(Boolean))];
}

export function extractSpecCoverageAssistantTargets(content: string): string[] {
  const lines = content.split(/\r?\n/).map((line) => line.trim());
  const coverageRows = lines
    .filter((line) => line.startsWith('|') && (line.includes('❌') || line.includes('⚠️') || line.includes('建议')))
    .map((line) => line.replace(/^\|/, '').replace(/\|$/, '').trim())
    .filter(Boolean);

  const coverageCells = coverageRows
    .flatMap((row) => row.split('|').map((cell) => cell.trim()))
    .filter((cell) => cell.includes('未覆盖') || cell.includes('模糊') || cell.includes('fallback') || cell.includes('建议'));

  const issueBullets = lines
    .filter((line) => /^\d+\.\s+\*\*/.test(line) || /^-\s+/.test(line))
    .map((line) => line.replace(/^\d+\.\s+/, '').replace(/^-\s+/, '').trim())
    .filter((line) => line.includes('缺失') || line.includes('模糊') || line.includes('建议') || line.includes('未覆盖'));

  const sectionBullets = [...content.matchAll(/###\s+(未通过项与修改建议|可补充项|模糊表述与术语歧义)[\s\S]*?(?=###\s+|##\s+|$)/g)]
    .flatMap((match) =>
      (match[0] ?? '')
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => /^\d+\.\s+/.test(line) || /^-\s+/.test(line) || line.startsWith('|'))
        .map((line) => line.replace(/^\d+\.\s+/, '').replace(/^-\s+/, '').replace(/^\|/, '').replace(/\|$/, '').trim())
    )
    .filter(Boolean);

  const coverageConclusionLines = lines
    .filter((line) => line.includes('未完全通过') || line.includes('未达到') || line.includes('建议后续动作') || line.includes('覆盖度小结'));

  return [...new Set([...coverageRows, ...coverageCells, ...issueBullets, ...sectionBullets, ...coverageConclusionLines].filter(Boolean))];
}

export function extractGapsAssistantTargets(content: string): string[] {
  const sections = extractAuditReportSections(content);
  const gapLines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^\*\*已修改内容\*\*/.test(line) || /^\d+\.\s+\*\*GAP-/.test(line));

  const modifiedItems = [...content.matchAll(/^\d+\.\s+\*\*GAP-[^*]+\*\*[:：]\s*(.+)$/gm)]
    .map((match) => (match[1] ?? '').trim())
    .filter(Boolean);

  const completionHints = /完全覆盖、验证通过|可进入 tasks 阶段/i.test(content)
    ? ['IMPLEMENTATION_GAPS 已完成补齐，可进入 tasks 阶段。']
    : [];

  return [
    ...new Set([...modifiedItems, ...gapLines, ...sections.requiredFixes, ...sections.suggestions, ...completionHints].filter(Boolean)),
  ];
}

export function extractImplementAssistantTargets(content: string): string[] {
  const sections = extractAuditReportSections(content);
  const taskRows = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith('| T') || line.includes('验收命令') || line.includes('建议主 Agent'));

  const executionLines = [...content.matchAll(/^\|\s*(T\d[^|]*)\|\s*([^|]+)\|\s*([^|]+)\|?$/gm)]
    .map((match) => `${(match[1] ?? '').trim()} ${(match[2] ?? '').trim()}`.trim())
    .filter(Boolean);

  const completionHints = /建议主 Agent 将本 Story 标记为完成/i.test(content)
    ? ['将本 Story 标记为完成，并进入后续收尾或 Epic 集成。']
    : [];

  const acceptanceRows = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith('|') && (line.includes('验收命令') || line.includes('执行结果') || line.includes('需求 | 实现 | 测试/验收') || line.includes('AC-') || line.includes('accept:') || line.includes('PASS')))
    .map((line) => line.replace(/^\|/, '').replace(/\|$/, '').trim())
    .filter(Boolean);

  const acceptanceCells = acceptanceRows
    .flatMap((row) => row.split('|').map((cell) => cell.trim()))
    .filter((cell) => cell.includes('AC-') || cell.includes('accept:') || cell.includes('PASS') || cell.includes('parse-and-write'));

  const sectionHeadings = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^###\s+/.test(line))
    .map((line) => line.replace(/^###\s+/, '').trim())
    .filter((line) => line.includes('任务') || line.includes('生产代码') || line.includes('验收') || line.includes('批判审计员'));

  const implementPriorityBlocks = [...content.matchAll(/##\s+(审计结论|批判审计员结论|strict 3 轮收敛记录)[\s\S]*?(?=##\s+|$)/g)]
    .flatMap((match) =>
      (match[0] ?? '')
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0 && !line.startsWith('## '))
    )
    .filter((line) =>
      line.includes('完全覆盖') ||
      line.includes('验证通过') ||
      line.includes('建议主 Agent') ||
      line.includes('strict 收敛') ||
      line.includes('第 1 轮') ||
      line.includes('第 2 轮') ||
      line.includes('第 3 轮')
    );

  const scopeAndRequirementRows = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith('|') && (line.includes('Story 需求') || line.includes('需求 | 实现 | 测试/验收') || line.includes('本 Story 范围') || line.includes('验收标准')))
    .flatMap((row) => row.replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.trim()))
    .filter((cell) => cell.includes('parseAndWriteScore') || cell.includes('除零') || cell.includes('覆盖') || cell.includes('验收'));

  const scopeTableCells = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith('|') && (line.includes('add 函数') || line.includes('subtract 函数') || line.includes('multiply 函数') || line.includes('divide 函数') || line.includes('parseAndWriteScore')))
    .flatMap((row) => row.replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.trim()))
    .filter(Boolean);

  const auditSummaryLines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) =>
      line.includes('复核结论') ||
      line.includes('TDD 完整性') ||
      line.includes('关键路径与孤岛') ||
      line.includes('完全覆盖、验证通过') ||
      line.includes('[TDD-RED]') ||
      line.includes('RED/GREEN/REFACTOR') ||
      line.includes('US-002') ||
      line.includes('US-003') ||
      line.includes('US-004') ||
      line.includes('US-005') ||
      line.includes('US-006')
    );

  const emphasizedSummaryLines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith('- **') || line.startsWith('**结论**'))
    .filter((line) => line.includes('TDD 完整性') || line.includes('完全覆盖、验证通过') || line.includes('关键路径与孤岛'));

  return [
    ...new Set([...executionLines, ...taskRows, ...acceptanceRows, ...acceptanceCells, ...sectionHeadings, ...implementPriorityBlocks, ...scopeAndRequirementRows, ...scopeTableCells, ...auditSummaryLines, ...emphasizedSummaryLines, ...sections.suggestions, ...sections.requiredFixes, ...completionHints].filter(Boolean)),
  ];
}
