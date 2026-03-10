/**
 * T2: 审计报告解析器
 * 解析批判审计员结论、GAP 列表、修改建议，供 SFT 提取器使用
 */
export interface AuditReportSections {
  criticConclusion: string;
  gaps: string[];
  suggestions: string[];
}

const CRITIC_HEADING_RE = /##\s*(?:\d+\.\s*)?批判审计员结论\s*\n([\s\S]*?)(?=##\s|$)/i;
const ROUND_CONCLUSION_RE = /\*\*本轮结论\*\*[：:]\s*([^\n]+(?:\n(?!\*\*)[^\n]*)*)/;
const NO_GAP_RE = /本轮无新\s*gap/i;
const GAP_ITEM_SPLIT_RE = /[；;]\s*|\d+\)\s*|①\s*|②\s*|③\s*|④\s*|⑤\s*/;
const SUGGESTIONS_HEADING_RE = /##\s*修改建议\s*\n([\s\S]*?)(?=##\s|$)/i;
const SUGGESTIONS_BOLD_RE = /\*\*修改建议\*\*[：:]\s*([^\n]+(?:\n(?!\*\*)[^\n]*)*)/i;
const SUGGESTIONS_TABLE_RE = /\|\s*Gap\s*\|\s*修改建议\s*\|[\s\S]*?\n\|[-:\s|]+\|\s*\n([\s\S]*?)(?=\n\n|##\s|$)/i;

/**
 * 解析审计报告中的批判审计员结论、GAP 列表、修改建议
 */
export function extractAuditReportSections(content: string): AuditReportSections {
  const criticConclusion = parseCriticConclusion(content);
  const gaps = parseGaps(content);
  const suggestions = parseSuggestions(content);
  return { criticConclusion, gaps, suggestions };
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

  const match = conclusion.match(/具体项[：:]\s*([\s\S]+)/);
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
