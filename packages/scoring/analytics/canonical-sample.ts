import { computeStringHash } from '../utils/hash';
import type { CanonicalMessage } from './types';
import { extractAuditReportSections } from './audit-report-parser';

export const HARD_REJECTION_REASONS = [
  'prov_missing_hash',
  'prov_missing_source_artifact',
  'score_below_floor',
  'veto_triggered',
  'missing_messages',
  'missing_assistant_target',
  'redaction_blocked',
  'secret_detected_unresolved',
  'pii_detected_unresolved',
  'tool_schema_missing',
  'tool_call_mismatch',
  'license_risk',
  'token_over_limit',
  'split_leakage_group',
] as const;

export const SOFT_REJECTION_REASONS = [
  'prov_unstable_diff',
  'too_many_iterations',
  'near_duplicate',
  'unsafe_command',
  'target_incompatible_openai_chat',
  'target_incompatible_hf_conversational',
  'target_incompatible_hf_tool_calling',
  'legacy_instruction_io_only',
  'missing_code_pair',
] as const;

const SECTION_1_RE = /## §1[^\n]*\n([\s\S]*?)(?=## §|$)/;
const SECTION_4_RE = /## §4[^\n]*\n([\s\S]*?)(?=## §|$)/;

export function extractBugfixSections(content: string): { s1: string; s4: string } | null {
  const m1 = content.match(SECTION_1_RE);
  const m4 = content.match(SECTION_4_RE);
  if (!m1 || !m4) return null;
  const s1 = (m1[1] ?? '').trim();
  const s4 = (m4[1] ?? '').trim();
  if (!s1 || !s4) return null;
  return { s1, s4 };
}

export function parseDiffToInputOutput(diff: string): { input: string; output: string } {
  const inputLines: string[] = [];
  const outputLines: string[] = [];
  for (const line of diff.split('\n')) {
    if (line.startsWith('-') && !line.startsWith('---')) {
      inputLines.push(line.slice(1));
    } else if (line.startsWith('+') && !line.startsWith('+++')) {
      outputLines.push(line.slice(1));
    }
  }
  return {
    input: inputLines.join('\n').trim(),
    output: outputLines.join('\n').trim(),
  };
}

export function extractInstruction(sourceContent: string): string | null {
  const sections = extractBugfixSections(sourceContent);
  if (sections) {
    return [sections.s1, sections.s4].join('\n\n').trim();
  }

  const auditSections = extractAuditReportSections(sourceContent);
  const fallback = [
    auditSections.criticConclusion,
    auditSections.gaps.join('\n'),
    auditSections.suggestions.join('\n'),
  ]
    .filter(Boolean)
    .join('\n\n')
    .trim();
  return fallback.length > 0 ? fallback : null;
}

export function buildCanonicalMessages(
  instruction: string,
  input: string,
  output: string
): CanonicalMessage[] {
  const userContent = [instruction.trim(), input.trim() ? `Current implementation:\n${input.trim()}` : '']
    .filter(Boolean)
    .join('\n\n');

  return [
    { role: 'system', content: 'You are a senior coding agent.' },
    {
      role: 'user',
      content: userContent,
      metadata: {
        legacy_instruction: instruction,
        legacy_input: input,
      },
    },
    {
      role: 'assistant',
      content: output,
      metadata: {
        legacy_output: output,
      },
    },
  ];
}

export function estimateTokenCount(messages: CanonicalMessage[]): number {
  const content = messages
    .map((message) =>
      typeof message.content === 'string'
        ? message.content
        : message.content.map((part) => part.text).join('\n')
    )
    .join('\n');
  return Math.max(1, Math.ceil(content.length / 4));
}

export function buildCanonicalSampleId(input: {
  runId: string;
  stage: string;
  sourcePath: string | null;
  baseCommitHash: string | null;
  instruction: string;
  output: string;
}): string {
  const stable = [
    input.runId,
    input.stage,
    input.sourcePath ?? 'no-source',
    input.baseCommitHash ?? 'no-base',
    input.instruction,
    input.output,
  ].join('::');
  return `sample-${computeStringHash(stable).slice(0, 16)}`;
}
