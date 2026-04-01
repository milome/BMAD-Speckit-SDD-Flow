import { computeStringHash } from '../utils/hash';
import type { CanonicalMessage, CanonicalTool } from './types';
import {
  extractGapsAssistantTargets,
  extractImplementAssistantTargets,
  extractAuditReportSections,
  extractPlanAssistantTargets,
  extractSpecCoverageAssistantTargets,
  extractSpecAssistantTargets,
  extractStoryAssistantTargets,
  extractTasksAssistantTargets,
} from './audit-report-parser';

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

export function extractAssistantTarget(sourceContent: string): string | null {
  const sections = extractBugfixSections(sourceContent);
  if (sections?.s4) {
    return sections.s4;
  }

  const auditSections = extractAuditReportSections(sourceContent);
  const stageAware = /AUDIT_implement|AUDIT Implement|实施后审计|Stage 4|执行阶段审计报告/i.test(sourceContent)
    ? extractImplementAssistantTargets(sourceContent)
    : sourceContent.includes('# Tasks ') || sourceContent.includes('## Tasks / Subtasks') || /-\s*\[(?: |x)\]\s+\*\*T\d+/m.test(sourceContent) || /^##\s+Phase\s+\d+/m.test(sourceContent)
    ? extractTasksAssistantTargets(sourceContent)
    : sourceContent.includes('AUDIT_GAPS') || sourceContent.includes('IMPLEMENTATION_GAPS 审计报告')
      ? extractGapsAssistantTargets(sourceContent)
    : sourceContent.includes('_vs_Story') || sourceContent.includes('覆盖性审计报告') || sourceContent.includes('覆盖度审计报告')
      ? extractSpecCoverageAssistantTargets(sourceContent)
    : sourceContent.includes('AUDIT_spec') || sourceContent.includes('Spec (Round') || sourceContent.includes('spec-E')
      ? extractSpecAssistantTargets(sourceContent)
    : sourceContent.includes('AUDIT_plan') || sourceContent.includes('plan-E')
      ? extractPlanAssistantTargets(sourceContent)
      : sourceContent.includes('AUDIT_tasks') || sourceContent.includes('tasks-E')
        ? extractTasksAssistantTargets(sourceContent)
        : sourceContent.includes('AUDIT_Story') || sourceContent.includes('Story ') || sourceContent.includes('story-')
          ? extractStoryAssistantTargets(sourceContent)
          : [...auditSections.requiredFixes, ...auditSections.suggestions, auditSections.criticConclusion, auditSections.gaps.join('\n')];

  const fallback = stageAware
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
    .map((message) => {
      const parts = [
        typeof message.content === 'string'
          ? message.content
          : message.content.map((part) => part.text).join('\n'),
      ];
      if (message.name) {
        parts.push(message.name);
      }
      if (message.tool_call_id) {
        parts.push(message.tool_call_id);
      }
      if (message.tool_calls && message.tool_calls.length > 0) {
        parts.push(JSON.stringify(message.tool_calls));
      }
      return parts.filter(Boolean).join('\n');
    })
    .join('\n');
  return Math.max(1, Math.ceil(content.length / 4));
}

export function estimateCanonicalTokenCount(
  messages: CanonicalMessage[],
  tools?: CanonicalTool[]
): number {
  const toolsPayload = tools && tools.length > 0 ? JSON.stringify(tools) : '';
  const combined = `${messages
    .map((message) =>
      typeof message.content === 'string'
        ? message.content
        : message.content.map((part) => part.text).join('\n')
    )
    .join('\n')}\n${messages
    .flatMap((message) => message.tool_calls ?? [])
    .map((toolCall) => JSON.stringify(toolCall))
    .join('\n')}\n${toolsPayload}`.trim();
  return Math.max(1, Math.ceil(combined.length / 4));
}

export function buildCanonicalSampleId(input: {
  runId: string;
  stage: string;
  sourcePath: string | null;
  baseCommitHash: string | null;
  instruction: string;
  input?: string;
  chunkKey?: string | null;
  traceRef?: string | null;
  output: string;
}): string {
  const stable = [
    input.runId,
    input.stage,
    input.sourcePath ?? 'no-source',
    input.baseCommitHash ?? 'no-base',
    input.instruction,
    input.input ?? '',
    input.chunkKey ?? '',
    input.traceRef ?? '',
    input.output,
  ].join('::');
  return `sample-${computeStringHash(stable).slice(0, 16)}`;
}
