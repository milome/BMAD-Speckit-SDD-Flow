import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import {
  validateRequirementContractModelV2,
  type RequirementContractModelV2Issue,
} from './requirements-contract-model';
import {
  evaluateRequirementsContractLintProfile,
  type RequirementsContractLintProfile,
  type RequirementsContractLintProfileResult,
} from '../rules/requirements-contract-lint-profile-registry';
import type {
  RequirementsConfirmationRenderInput,
} from './requirements-contract-confirmation-render-input';
import { sha256Stable } from './requirements-contract-semantic-resolver';

export type RequirementsContractValidationMode =
  | 'draft'
  | 'confirmation-ready'
  | 'execution'
  | 'closeout';

export type RequirementsContractValidationIssueCode =
  | RequirementContractModelV2Issue['code']
  | 'blocking_unresolved_decision';

export type SourcePrdLintTransition =
  | 'confirmation-ready'
  | 'architecture-confirmation'
  | 'implementation-readiness'
  | 'packet-dispatch'
  | 'execution-closure'
  | 'audit-review'
  | 'delivery-confirmation'
  | 'closeout';

export type SourcePrdLintTransitionIssueCode =
  | 'source_prd_lint_report_missing'
  | 'source_prd_lint_report_invalid'
  | 'source_prd_lint_report_stale'
  | 'source_prd_lint_non_pass';

export interface SourcePrdLintTransitionResult {
  transition: SourcePrdLintTransition;
  decision: 'pass' | 'block';
  issueCodes: SourcePrdLintTransitionIssueCode[];
}

export interface SourcePrdLintFileTransitionResult extends SourcePrdLintTransitionResult {
  lintReportPath: string;
  currentSourcePath: string;
}

interface SourcePrdLintReport {
  schemaVersion: 'requirements-contract-source-prd-instance-lint-report/v1';
  sourcePath: string;
  sourceHash: string;
  sourcePrdDraftReady: boolean;
  status: 'source_prd_draft_ready' | 'source_prd_draft_blocked';
  blockedReason: string | null;
  ok: boolean;
  counts: Record<string, unknown>;
  issues: Array<Record<string, unknown>>;
}

export interface RequirementsContractValidationIssue {
  code: RequirementsContractValidationIssueCode;
  path: string;
  message: string;
}

export interface RequirementsContractValidationResult {
  ok: boolean;
  decision: 'pass' | 'block';
  mode: RequirementsContractValidationMode;
  issues: RequirementsContractValidationIssue[];
  metrics: {
    structuralIssueCount: number;
    blockingUnresolvedCount: number;
  };
}

export interface RequirementsContractLifecycleValidationReport
  extends RequirementsContractValidationResult {
  schemaVersion: 'requirements-contract-lifecycle-validation-report/v1';
  requirementSetId: string;
  semanticModelHash: string;
  facade: {
    id: string;
    hash: string;
  };
  reportHash: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isSha256(value: unknown): value is string {
  return typeof value === 'string' && /^sha256:[0-9a-f]{64}$/u.test(value);
}

function normalizeAuthorityPath(value: string): string {
  return path.resolve(value).replace(/\\/gu, '/');
}

function isSourcePrdLintReport(value: unknown): value is SourcePrdLintReport {
  if (!isRecord(value)) return false;
  const counts = value.counts;
  const issues = value.issues;
  if (!isRecord(counts) || !Array.isArray(issues)) return false;
  const requiredCounts = [
    'requirementRows',
    'traceRows',
    'negativeRows',
    'pathRows',
    'currentTargetRows',
  ];
  return (
    value.schemaVersion === 'requirements-contract-source-prd-instance-lint-report/v1' &&
    typeof value.sourcePath === 'string' &&
    value.sourcePath.length > 0 &&
    isSha256(value.sourceHash) &&
    typeof value.sourcePrdDraftReady === 'boolean' &&
    ['source_prd_draft_ready', 'source_prd_draft_blocked'].includes(String(value.status)) &&
    (value.blockedReason === null || typeof value.blockedReason === 'string') &&
    typeof value.ok === 'boolean' &&
    requiredCounts.every((key) => Number.isSafeInteger(counts[key])) &&
    issues.every(
      (issue) => isRecord(issue) && typeof issue.code === 'string' && issue.code.length > 0
    )
  );
}

export function validateSourcePrdLintTransition(input: {
  transition: SourcePrdLintTransition;
  lintReport: unknown;
  currentSourceRef: { path: string; hash: string };
}): SourcePrdLintTransitionResult {
  const issueCodes: SourcePrdLintTransitionIssueCode[] = [];
  if (input.lintReport === null || input.lintReport === undefined) {
    issueCodes.push('source_prd_lint_report_missing');
  } else if (!isSourcePrdLintReport(input.lintReport)) {
    issueCodes.push('source_prd_lint_report_invalid');
  } else {
    if (
      normalizeAuthorityPath(String(input.lintReport.sourcePath)) !==
        normalizeAuthorityPath(input.currentSourceRef.path) ||
      input.lintReport.sourceHash !== input.currentSourceRef.hash
    ) {
      issueCodes.push('source_prd_lint_report_stale');
    }
    if (
      input.lintReport.ok !== true ||
      input.lintReport.sourcePrdDraftReady !== true ||
      input.lintReport.status !== 'source_prd_draft_ready' ||
      input.lintReport.blockedReason !== null ||
      input.lintReport.issues.length !== 0
    ) {
      issueCodes.push('source_prd_lint_non_pass');
    }
  }
  return {
    transition: input.transition,
    decision: issueCodes.length === 0 ? 'pass' : 'block',
    issueCodes,
  };
}

export function validateSourcePrdLintTransitionFromFiles(input: {
  transition: SourcePrdLintTransition;
  requirementRecordPath: string;
  currentSourcePath: string;
}): SourcePrdLintFileTransitionResult {
  const lintReportPath = path.join(
    path.dirname(path.resolve(input.requirementRecordPath)),
    'authoring',
    'source-prd-instance-lint-report.json'
  );
  let lintReport: unknown = null;
  if (existsSync(lintReportPath)) {
    try {
      lintReport = JSON.parse(readFileSync(lintReportPath, 'utf8')) as unknown;
    } catch {
      lintReport = {};
    }
  }
  const currentSourcePath = path.resolve(input.currentSourcePath || '__missing_source_prd__');
  const currentSourceHash = existsSync(currentSourcePath)
    ? `sha256:${createHash('sha256').update(readFileSync(currentSourcePath)).digest('hex')}`
    : `sha256:${'0'.repeat(64)}`;
  return {
    ...validateSourcePrdLintTransition({
      transition: input.transition,
      lintReport,
      currentSourceRef: {
        path: currentSourcePath,
        hash: currentSourceHash,
      },
    }),
    lintReportPath,
    currentSourcePath,
  };
}

function blockingUnresolvedIssues(candidate: unknown): RequirementsContractValidationIssue[] {
  if (!isRecord(candidate) || !isRecord(candidate.semanticBodies)) return [];
  const issues: RequirementsContractValidationIssue[] = [];
  for (const [bodyHash, body] of Object.entries(candidate.semanticBodies)) {
    if (!isRecord(body) || !Array.isArray(body.unresolved)) continue;
    body.unresolved.forEach((unresolved, index) => {
      if (!isRecord(unresolved) || unresolved.blocking !== true) return;
      issues.push({
        code: 'blocking_unresolved_decision',
        path: `/semanticBodies/${bodyHash}/unresolved/${index}`,
        message:
          typeof unresolved.question === 'string'
            ? unresolved.question
            : 'blocking unresolved decision remains',
      });
    });
  }
  return issues;
}

export function validateRequirementsContractDocument(
  candidate: unknown,
  mode: RequirementsContractValidationMode
): RequirementsContractValidationResult {
  const structural = validateRequirementContractModelV2(candidate);
  const structuralIssues = structural.issues.map((issue) => ({
    code: issue.code,
    path: issue.path,
    message: issue.message,
  }));
  const unresolvedIssues = blockingUnresolvedIssues(candidate);
  const issues =
    mode === 'draft' ? structuralIssues : [...structuralIssues, ...unresolvedIssues];

  return {
    ok: issues.length === 0,
    decision: issues.length === 0 ? 'pass' : 'block',
    mode,
    issues,
    metrics: {
      structuralIssueCount: structuralIssues.length,
      blockingUnresolvedCount: unresolvedIssues.length,
    },
  };
}

export function validateRequirementsContractRenderInput(
  input: RequirementsConfirmationRenderInput,
  profile: RequirementsContractLintProfile
): RequirementsContractLintProfileResult {
  return evaluateRequirementsContractLintProfile(input, profile);
}

export function createRequirementsContractLifecycleValidationReport(input: {
  candidate: unknown;
  mode: RequirementsContractValidationMode;
  requirementSetId: string;
  semanticModelHash: string;
  facade: {
    id: string;
    hash: string;
  };
}): RequirementsContractLifecycleValidationReport {
  const validation = validateRequirementsContractDocument(input.candidate, input.mode);
  const preimage = {
    schemaVersion: 'requirements-contract-lifecycle-validation-report/v1' as const,
    requirementSetId: input.requirementSetId,
    semanticModelHash: input.semanticModelHash,
    facade: input.facade,
    ...validation,
  };
  return {
    ...preimage,
    reportHash: sha256Stable(preimage),
  };
}

export function validateRequirementsContractLifecycleValidationReport(
  value: unknown
): value is RequirementsContractLifecycleValidationReport {
  if (!isRecord(value)) return false;
  const { reportHash, ...preimage } = value;
  const facade = isRecord(value.facade) ? value.facade : null;
  const metrics = isRecord(value.metrics) ? value.metrics : null;
  return (
    value.schemaVersion === 'requirements-contract-lifecycle-validation-report/v1' &&
    typeof value.requirementSetId === 'string' &&
    value.requirementSetId.length > 0 &&
    typeof value.semanticModelHash === 'string' &&
    /^sha256:[0-9a-f]{64}$/u.test(value.semanticModelHash) &&
    facade !== null &&
    typeof facade.id === 'string' &&
    facade.id.length > 0 &&
    typeof facade.hash === 'string' &&
    /^sha256:[0-9a-f]{64}$/u.test(facade.hash) &&
    ['draft', 'confirmation-ready', 'execution', 'closeout'].includes(String(value.mode)) &&
    ['pass', 'block'].includes(String(value.decision)) &&
    typeof value.ok === 'boolean' &&
    Array.isArray(value.issues) &&
    metrics !== null &&
    Number.isSafeInteger(metrics.structuralIssueCount) &&
    Number.isSafeInteger(metrics.blockingUnresolvedCount) &&
    typeof reportHash === 'string' &&
    reportHash === sha256Stable(preimage) &&
    value.ok === (value.decision === 'pass') &&
    value.ok === (value.issues.length === 0)
  );
}
