import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type {
  RequirementContractBoundary,
  RequirementContractCommandInput,
  RequirementContractCompilerInput,
  RequirementContractModel,
  RequirementContractRequirement,
  RequirementContractTargetInput,
} from './requirements-contract-model';
import {
  validateRequirementsContractCp02AtomicClosure,
  type RequirementsContractAtomicMust,
} from './requirements-contract-cp00-cp04';
import { sha256Stable } from './requirements-contract-semantic-resolver';
import {
  validateRequirementsTechnicalPlanningCapabilityResult,
  type RequirementsTechnicalPlanningCapabilityResult,
} from './requirements-contract-technical-planning-capability';

type CompilerIssue = RequirementContractModel['invariantClosure']['issues'][number];

export interface RequirementContractCompilerInputAuthority {
  source: 'canonical_semantic_ir';
  semanticModelHash: string;
  semanticConservationManifestHash: string;
  sourceAuthorityHash: string;
  sourceRootSetHash: string;
  compilerInputHash: string;
}

export interface RequirementsContractCp02CompilerInput {
  authoringRequestId: string;
  authoringAttemptId: string;
  atoms: RequirementsContractAtomicMust[];
  decisions: Array<{
    decisionId: string;
    affectedAtomIds: string[];
    authorityPremiseHashes: string[];
  }>;
  technicalPlanning: RequirementsTechnicalPlanningCapabilityResult;
}

export interface RequirementsContractCp02CompilerResult {
  schemaVersion: 'requirements-contract-cp02-candidate/v1';
  authoringRequestId: string;
  authoringAttemptId: string;
  status: 'closed' | 'blocked' | 'technical_planning_pending';
  issueCodes: string[];
  atoms: RequirementsContractAtomicMust[];
  decisions: RequirementsContractCp02CompilerInput['decisions'];
  technicalPlanningTriggerIdentity: string;
  executionRegistryHash: string | null;
  candidateHash: string;
}

function canonicalCp02Atoms(atoms: RequirementsContractAtomicMust[]): RequirementsContractAtomicMust[] {
  return atoms
    .map((atom) => ({
      ...atom,
      dependencies: [...atom.dependencies].sort(),
      originBindings: [...atom.originBindings].sort(
        (left, right) => left.sourceRootId.localeCompare(right.sourceRootId) ||
          left.sourceSpanRef.localeCompare(right.sourceSpanRef)
      ),
      authorityRefs: [...atom.authorityRefs].sort(),
      spanRefs: [...atom.spanRefs].sort(),
      executionConstraintRefs: [...atom.executionConstraintRefs].sort(),
    }))
    .sort((left, right) => left.atomId.localeCompare(right.atomId));
}

function canonicalCp02Decisions(
  decisions: RequirementsContractCp02CompilerInput['decisions']
): RequirementsContractCp02CompilerInput['decisions'] {
  return decisions
    .map((decision) => ({
      ...decision,
      affectedAtomIds: [...decision.affectedAtomIds].sort(),
      authorityPremiseHashes: [...decision.authorityPremiseHashes].sort(),
    }))
    .sort((left, right) => left.decisionId.localeCompare(right.decisionId));
}

export function compileRequirementsContractCp02Candidate(
  input: RequirementsContractCp02CompilerInput
): RequirementsContractCp02CompilerResult {
  if (
    !validateRequirementsTechnicalPlanningCapabilityResult(input.technicalPlanning) ||
    input.technicalPlanning.checkpointId !== 'cp02' ||
    input.technicalPlanning.authoringRequestId !== input.authoringRequestId ||
    input.technicalPlanning.authoringAttemptId !== input.authoringAttemptId
  ) {
    throw new Error('requirements_cp02_technical_planning_binding_invalid');
  }
  const atoms = canonicalCp02Atoms(input.atoms);
  const decisions = canonicalCp02Decisions(input.decisions);
  const executionRegistry = input.technicalPlanning.executionRegistry;
  const closure = executionRegistry
    ? validateRequirementsContractCp02AtomicClosure({ atoms, decisions, executionRegistry })
    : { decision: 'block' as const, issueCodes: ['requirements_technical_planning_pending'] };
  const status = input.technicalPlanning.status === 'technical_planning_pending'
    ? 'technical_planning_pending' as const
    : closure.decision === 'pass'
      ? 'closed' as const
      : 'blocked' as const;
  const payload = {
    schemaVersion: 'requirements-contract-cp02-candidate/v1' as const,
    authoringRequestId: input.authoringRequestId,
    authoringAttemptId: input.authoringAttemptId,
    status,
    issueCodes: closure.issueCodes,
    atoms,
    decisions,
    technicalPlanningTriggerIdentity: input.technicalPlanning.triggerIdentity,
    executionRegistryHash: executionRegistry?.registryHash ?? null,
  };
  return {
    ...payload,
    candidateHash: sha256Stable({
      domain: 'requirements-contract-cp02-candidate/v1',
      payload,
    }),
  };
}

function hasSourceBinding(row: RequirementContractRequirement): boolean {
  return Boolean(
    row.authorityState ||
    row.provenance ||
    (row.sourcePath && row.sourceSpan && row.sourceRequirementId)
  );
}

function preserveRequirementAuthority(
  row: RequirementContractRequirement
): RequirementContractRequirement {
  if (row.authorityState || row.provenance || !hasSourceBinding(row)) return { ...row };
  return {
    ...row,
    authorityState: 'source_grounded',
    provenance: {
      sourceRequirementId: row.sourceRequirementId,
      sourcePath: row.sourcePath,
      sourceSpan: row.sourceSpan,
      ...(row.sourceDocumentHash
        ? {
            sourceDocumentHash: row.sourceDocumentHash,
            sourceHash: row.sourceDocumentHash,
          }
        : {}),
      ...(row.headingPath ? { headingPath: row.headingPath } : {}),
      compiler: 'requirements-contract-compiler',
    },
  };
}

function preserveBoundaryAuthority(row: RequirementContractBoundary): RequirementContractBoundary {
  return { ...row };
}

function validateRequirementRefs(
  refs: unknown,
  knownRequirementIds: Set<string>,
  issueCode: string,
  issues: CompilerIssue[]
): refs is string[] {
  if (
    !Array.isArray(refs) ||
    refs.length === 0 ||
    refs.some((ref) => typeof ref !== 'string' || ref.trim().length === 0) ||
    new Set(refs).size !== refs.length ||
    refs.some((ref) => !knownRequirementIds.has(ref))
  ) {
    issues.push({
      code: issueCode,
      message: 'Binding must reference a non-empty unique set of known requirements.',
    });
    return false;
  }
  return true;
}

function compileCommands(
  input: RequirementContractCompilerInput['requiredCommands'],
  knownRequirementIds: Set<string>,
  issues: CompilerIssue[]
): RequirementContractModel['requiredCommands'] {
  if (!input || input.length === 0) {
    issues.push({
      code: 'missing_validation_authority',
      message: 'No source-authorized validation command binding was provided.',
    });
    return [];
  }

  const commands: RequirementContractModel['requiredCommands'] = [];
  for (const candidate of input) {
    if (typeof candidate === 'string') {
      issues.push({
        code:
          knownRequirementIds.size > 1
            ? 'ambiguous_validation_authority'
            : 'unscoped_validation_authority',
        message: 'Legacy command text has no explicit requirement binding.',
      });
      continue;
    }
    const command = candidate as Partial<RequirementContractCommandInput>;
    if (
      typeof command.id !== 'string' ||
      command.id.trim().length === 0 ||
      typeof command.command !== 'string' ||
      command.command.trim().length === 0 ||
      !Array.isArray(command.requirementRefs)
    ) {
      issues.push({
        code: 'invalid_validation_authority',
        message: 'Validation binding must provide an id, command, and requirementRefs array.',
      });
      continue;
    }
    if (
      !validateRequirementRefs(
        command.requirementRefs,
        knownRequirementIds,
        'invalid_validation_authority',
        issues
      )
    ) {
      continue;
    }
    commands.push({
      id: command.id,
      command: command.command,
      covers: [...command.requirementRefs],
    });
  }
  return commands;
}

function compileTargets(
  input: RequirementContractCompilerInput['targetPaths'],
  knownRequirementIds: Set<string>,
  issues: CompilerIssue[]
): RequirementContractModel['targetModificationPaths'] {
  if (!input || input.length === 0) {
    issues.push({
      code: 'missing_target_authority',
      message: 'No source-authorized target binding was provided.',
    });
    return [];
  }

  const targets: RequirementContractModel['targetModificationPaths'] = [];
  for (const candidate of input) {
    if (typeof candidate === 'string') {
      issues.push({
        code:
          knownRequirementIds.size > 1 ? 'ambiguous_target_authority' : 'unscoped_target_authority',
        message: 'Legacy target path has no explicit requirement binding.',
      });
      continue;
    }
    const target = candidate as Partial<RequirementContractTargetInput>;
    if (
      typeof target.id !== 'string' ||
      target.id.trim().length === 0 ||
      typeof target.path !== 'string' ||
      target.path.trim().length === 0 ||
      !Array.isArray(target.requirementRefs)
    ) {
      issues.push({
        code: 'invalid_target_authority',
        message: 'Target binding must provide an id, path, and requirementRefs array.',
      });
      continue;
    }
    if (
      !validateRequirementRefs(
        target.requirementRefs,
        knownRequirementIds,
        'invalid_target_authority',
        issues
      )
    ) {
      continue;
    }
    targets.push({
      id: target.id,
      path: target.path,
      requirementRefs: [...target.requirementRefs],
    });
  }
  return targets;
}

export function compileRequirementContractModel(
  input: RequirementContractCompilerInput
): RequirementContractModel {
  const issues: CompilerIssue[] = [];
  const must = input.must.map(preserveRequirementAuthority);
  const notDone = (input.notDone ?? []).map(preserveRequirementAuthority);
  const outOfScope = (input.outOfScope ?? []).map(preserveBoundaryAuthority);
  const knownRequirementIds = new Set(must.map((row) => row.id));

  if (notDone.length === 0) {
    issues.push({
      code: 'missing_negative_requirement_authority',
      message: 'No source-authorized negative requirement was provided.',
    });
  }
  if (outOfScope.length === 0) {
    issues.push({
      code: 'missing_out_of_scope_authority',
      message: 'No source-authorized out-of-scope boundary was provided.',
    });
  }
  must.forEach((row) => {
    if (!hasSourceBinding(row)) {
      issues.push({
        code: 'missing_requirement_source_authority',
        message: `Requirement ${row.id || '<missing-id>'} has no source or decision authority.`,
      });
    }
  });
  notDone.forEach((row) => {
    if (!hasSourceBinding(row)) {
      issues.push({
        code: 'missing_negative_source_authority',
        message: `Negative requirement ${row.id || '<missing-id>'} has no source or decision authority.`,
      });
    }
  });
  outOfScope.forEach((row) => {
    if (!row.authorityState && !row.provenance) {
      issues.push({
        code: 'missing_boundary_source_authority',
        message: `Boundary ${row.id || '<missing-id>'} has no source or decision authority.`,
      });
    }
  });

  const requiredCommands = compileCommands(input.requiredCommands, knownRequirementIds, issues);
  const targetModificationPaths = compileTargets(input.targetPaths, knownRequirementIds, issues);

  return {
    schemaVersion: 'requirement-contract-model/v1',
    recordId: input.recordId,
    requirementSetId: input.requirementSetId,
    must,
    notDone,
    outOfScope,
    evidence: [],
    acceptanceCriteria: [],
    requiredCommands,
    traceRows: [],
    businessViews: [],
    sequenceViews: [],
    flowViews: [],
    edgeCaseViews: [],
    boundaryViews: [],
    targetModificationPaths,
    applicability: {},
    invariantClosure: {
      appliedPasses: [],
      remainingIssueCount: issues.length,
      rendererBlockerPolicy: 'renderer_blocker_release_failure',
      issues,
    },
  };
}

export function writeRequirementContractModelArtifacts(input: {
  authoringDir: string;
  model: RequirementContractModel;
  canonicalInputAuthority?: RequirementContractCompilerInputAuthority;
}): { modelPath: string; reportPath: string } {
  fs.mkdirSync(input.authoringDir, { recursive: true });
  const modelPath = path.join(input.authoringDir, 'requirement-contract-model.json');
  const reportPath = path.join(input.authoringDir, 'compiler-closure-report.json');
  const modelBytes = `${JSON.stringify(input.model, null, 2)}\n`;
  const requirementContractModelHash = `sha256:${createHash('sha256')
    .update(modelBytes, 'utf8')
    .digest('hex')}`;
  fs.writeFileSync(modelPath, modelBytes, 'utf8');
  fs.writeFileSync(
    reportPath,
    `${JSON.stringify(
      {
        schemaVersion: 'requirement-contract-compiler-closure-report/v1',
        recordId: input.model.recordId,
        requirementSetId: input.model.requirementSetId,
        requirementContractModelHash,
        appliedPasses: input.model.invariantClosure.appliedPasses,
        remainingIssueCount: input.model.invariantClosure.remainingIssueCount,
        rendererBlockerPolicy: input.model.invariantClosure.rendererBlockerPolicy,
        terminalState: input.model.invariantClosure.terminalState,
        renderer_blocker_release_failure: true,
        measureBefore: input.model.invariantClosure.measureBefore,
        measureAfter: input.model.invariantClosure.measureAfter,
        passRegistry: input.model.invariantClosure.passRegistry,
        roundReceipts: input.model.invariantClosure.roundReceipts,
        issues: input.model.invariantClosure.issues,
        ...(input.canonicalInputAuthority
          ? { canonicalInputAuthority: input.canonicalInputAuthority }
          : {}),
      },
      null,
      2
    )}\n`,
    'utf8'
  );
  return { modelPath, reportPath };
}
