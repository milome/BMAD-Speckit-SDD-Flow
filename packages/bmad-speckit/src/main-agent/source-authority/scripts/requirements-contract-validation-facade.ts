import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import {
  validateRequirementContractModelV2,
  type RequirementContractModelV2Issue,
} from './requirements-contract-model';
import {
  type RequirementsContractDiagramApplicability,
  type RequirementsContractProjectProfile,
  validateDiagramApplicability,
  validateRequirementsContractProjectProfile,
} from './requirements-contract-project-profile';
import {
  type RequirementsContractDiagramSet,
  type RequirementsContractSequenceContract,
  validateDiagramSet,
  validateSequenceContract,
} from './requirements-contract-sequence-model';
import { requirementsContractDiagramProjectionHash } from './requirements-contract-diagram-set-planner';
import {
  type RequirementsContractDeploymentModel,
  validateRequirementsContractDeploymentModel,
} from './requirements-contract-deployment-model';
import {
  type RequirementsContractDeploymentDelta,
  validateRequirementsContractDeploymentDelta,
} from './requirements-contract-deployment-delta';
import {
  evaluateRequirementsContractLintProfile,
  type RequirementsContractLintProfile,
  type RequirementsContractLintProfileResult,
} from '../rules/requirements-contract-lint-profile-registry';
import type {
  RequirementsConfirmationRenderInput,
} from './requirements-contract-confirmation-render-input';
import { sha256Stable } from './requirements-contract-semantic-resolver';
import {
  createRequirementsContractLintReport,
  validateRequirementsContractLintReport,
  type RequirementsContractLintReport,
} from './requirements-contract-lint-report';

export const REQUIREMENTS_CONTRACT_VALIDATION_FACADE_ID =
  'requirements-contract-validation-facade/v3';

export {
  createRequirementsContractLintReport,
  validateRequirementsContractLintReport,
};
export type { RequirementsContractLintReport };

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

export interface RequirementsContractInteractionValidationIssue {
  code: string;
  path: string;
  message: string;
}

export interface RequirementsContractInteractionValidationResult {
  ok: boolean;
  decision: 'pass' | 'block';
  issues: RequirementsContractInteractionValidationIssue[];
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

function addInteractionIssue(
  issues: RequirementsContractInteractionValidationIssue[],
  issue: RequirementsContractInteractionValidationIssue
): void {
  if (issues.some((candidate) => candidate.code === issue.code && candidate.path === issue.path)) {
    return;
  }
  issues.push(issue);
}

function addInteractionIssues(
  target: RequirementsContractInteractionValidationIssue[],
  prefix: string,
  source: Array<{ code: string; path: string; message: string }>
): void {
  for (const issue of source) {
    addInteractionIssue(target, {
      ...issue,
      path: `${prefix}${issue.path === '/' ? '' : issue.path}`,
    });
  }
}

export function validateRequirementsContractInteractionArtifacts(input: {
  projectProfile: RequirementsContractProjectProfile;
  projectProfileHash: string;
  diagramApplicability: RequirementsContractDiagramApplicability;
  sequenceContract: RequirementsContractSequenceContract;
  diagramSets: RequirementsContractDiagramSet[];
  deploymentBaseline?: RequirementsContractDeploymentModel;
  deploymentDelta?: RequirementsContractDeploymentDelta;
}): RequirementsContractInteractionValidationResult {
  const issues: RequirementsContractInteractionValidationIssue[] = [];
  addInteractionIssues(
    issues,
    '/projectProfile',
    validateRequirementsContractProjectProfile(input.projectProfile).issues
  );
  const expectedProjectProfileHash = sha256Stable(input.projectProfile);
  if (input.projectProfileHash !== expectedProjectProfileHash) {
    addInteractionIssue(issues, {
      code: 'project_profile_hash_mismatch',
      path: '/projectProfileHash',
      message: 'project profile hash does not match canonical profile content',
    });
  }
  if (input.diagramApplicability.projectProfileHash !== input.projectProfileHash) {
    addInteractionIssue(issues, {
      code: 'diagram_applicability_project_profile_hash_mismatch',
      path: '/diagramApplicability/projectProfileHash',
      message: 'diagram applicability is not bound to the current project profile',
    });
  }
  addInteractionIssues(
    issues,
    '/diagramApplicability',
    validateDiagramApplicability(input.diagramApplicability, input.projectProfile).issues
  );
  if (
    input.sequenceContract.projectProfileHash !== input.projectProfileHash ||
    input.sequenceContract.projectKind !== input.projectProfile.projectKind
  ) {
    addInteractionIssue(issues, {
      code: 'sequence_project_profile_mismatch',
      path: '/sequenceContract/projectProfileHash',
      message: 'sequence contract is not bound to the current project profile',
    });
  }
  addInteractionIssues(
    issues,
    '/sequenceContract',
    validateSequenceContract(input.sequenceContract).issues
  );

  const scenarioIds = new Set(
    input.sequenceContract.sequenceScenarios.map((scenario) => scenario.id)
  );
  const messageRefs = new Set(
    input.sequenceContract.sequenceScenarios.flatMap((scenario) =>
      scenario.steps.map((step) => `${scenario.id}#${step.id}`)
    )
  );
  input.diagramSets.forEach((diagramSet, setIndex) => {
    const setPath = `/diagramSets/${setIndex}`;
    addInteractionIssues(issues, setPath, validateDiagramSet(diagramSet).issues);
    if (diagramSet.sequenceContractHash !== input.sequenceContract.sequenceContractHash) {
      addInteractionIssue(issues, {
        code: 'diagram_sequence_contract_hash_mismatch',
        path: `${setPath}/sequenceContractHash`,
        message: 'diagram set is not bound to the current sequence contract',
      });
    }

    const diagramByRef = new Map(
      diagramSet.diagrams.map((diagram) => [diagram.diagramRef, diagram])
    );
    const diagramChildRefs = new Set(
      diagramSet.diagrams.flatMap((diagram) => diagram.blockingChildRefs)
    );
    const setChildRefs = new Set(diagramSet.blockingChildRefs);
    if (
      diagramChildRefs.size !== setChildRefs.size ||
      [...diagramChildRefs].some((ref) => !setChildRefs.has(ref))
    ) {
      addInteractionIssue(issues, {
        code: 'diagram_blocking_child_closure_mismatch',
        path: `${setPath}/blockingChildRefs`,
        message: 'diagram-level and set-level blocking child refs differ',
      });
    }

    diagramSet.diagrams.forEach((diagram, diagramIndex) => {
      const diagramPath = `${setPath}/diagrams/${diagramIndex}`;
      if (!scenarioIds.has(diagram.scenarioRef)) {
        addInteractionIssue(issues, {
          code: 'unknown_diagram_scenario_ref',
          path: `${diagramPath}/scenarioRef`,
          message: `unknown diagram scenario ref: ${diagram.scenarioRef}`,
        });
      }
      diagram.messageRefs.forEach((messageRef, messageIndex) => {
        if (!messageRefs.has(messageRef)) {
          addInteractionIssue(issues, {
            code: 'unknown_diagram_message_ref',
            path: `${diagramPath}/messageRefs/${messageIndex}`,
            message: `unknown diagram message ref: ${messageRef}`,
          });
        }
      });
      const { projectionHash, ...projection } = diagram;
      const expectedProjectionHash = requirementsContractDiagramProjectionHash({
        sequenceContractHash: diagramSet.sequenceContractHash,
        diagram: projection,
      });
      if (projectionHash !== expectedProjectionHash) {
        addInteractionIssue(issues, {
          code: 'diagram_projection_hash_mismatch',
          path: `${diagramPath}/projectionHash`,
          message: `diagram projection hash mismatch: ${diagram.diagramRef}`,
        });
      }
    });

    const expandedChildren = new Set<string>();
    diagramSet.transitionEdges.forEach((transition, transitionIndex) => {
      const transitionPath = `${setPath}/transitionEdges/${transitionIndex}`;
      if (!messageRefs.has(transition.messageRef)) {
        addInteractionIssue(issues, {
          code: 'unknown_diagram_transition_message_ref',
          path: `${transitionPath}/messageRef`,
          message: `unknown diagram transition message ref: ${transition.messageRef}`,
        });
      }
      const child = diagramByRef.get(transition.expandsTo);
      if (child) {
        expandedChildren.add(transition.expandsTo);
        if (!child.messageRefs.includes(transition.messageRef)) {
          addInteractionIssue(issues, {
            code: 'diagram_transition_child_message_mismatch',
            path: transitionPath,
            message: `transition message is not rendered by child: ${transition.expandsTo}`,
          });
        }
      }
    });
    for (const childRef of setChildRefs) {
      if (!expandedChildren.has(childRef)) {
        addInteractionIssue(issues, {
          code: 'diagram_blocking_child_transition_missing',
          path: `${setPath}/blockingChildRefs`,
          message: `blocking child has no transition: ${childRef}`,
        });
      }
    }

    const expectedProjectionHashes = diagramSet.diagrams
      .map((diagram) => diagram.projectionHash)
      .sort();
    const declaredProjectionHashes = [...diagramSet.projectionHashes].sort();
    if (
      expectedProjectionHashes.length !== declaredProjectionHashes.length ||
      expectedProjectionHashes.some(
        (projectionHash, index) => projectionHash !== declaredProjectionHashes[index]
      )
    ) {
      addInteractionIssue(issues, {
        code: 'diagram_projection_hash_set_mismatch',
        path: `${setPath}/projectionHashes`,
        message: 'diagram projection hash inventory differs from diagram members',
      });
    }
  });

  if (input.deploymentBaseline) {
    addInteractionIssues(
      issues,
      '/deploymentBaseline',
      validateRequirementsContractDeploymentModel(input.deploymentBaseline).issues
    );
  }
  if (input.deploymentDelta) {
    addInteractionIssues(
      issues,
      '/deploymentDelta',
      validateRequirementsContractDeploymentDelta(input.deploymentDelta).issues
    );
    if (
      input.deploymentBaseline &&
      input.deploymentDelta.baselineModelHash !== input.deploymentBaseline.modelHash
    ) {
      addInteractionIssue(issues, {
        code: 'deployment_delta_baseline_hash_mismatch',
        path: '/deploymentDelta/baselineModelHash',
        message: 'deployment delta is not bound to the supplied baseline',
      });
    }
  }

  return {
    ok: issues.length === 0,
    decision: issues.length === 0 ? 'pass' : 'block',
    issues,
  };
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
