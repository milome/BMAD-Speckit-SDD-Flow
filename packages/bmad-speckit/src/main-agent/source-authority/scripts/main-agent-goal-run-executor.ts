import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  acquireGoalExecutionRunLease,
  prepareGoalExecutionAttempt,
  readGoalExecutionAttemptPointer,
  releaseGoalExecutionRunLease,
  remediateGoalExecutionAttempt,
  transitionGoalExecutionAttempt,
  type GoalExecutionAttemptAuthority,
  type GoalExecutionAttemptPointer,
  type GoalExecutionClosureRef,
  type GoalExecutionRunLease,
} from './main-agent-goal-execution-attempt';
import { executeGoalRunMutation } from './main-agent-goal-run-mutation-executor';
import { parseReadinessCommandInvocation } from './main-agent-implementation-readiness-v2';
import {
  publishGoalExecutionAuthorityClosure,
  publishGoalExecutionCampaignClosure,
  publishGoalExecutionObservedEvidence,
  publishGoalExecutionProjections,
} from './subcontract-evidence';
import {
  hashControlPlaneValue,
  stableControlPlaneStringify,
} from '../../../utils/goal-contract/control-plane/canonical-hash';
import { validateGoalExecutionAdmission } from '../../../utils/goal-contract/control-plane/frozen-goal-activation';
import { validateGoalContractSchema } from '../../../utils/goal-contract/control-plane/schema-registry';

type JsonRecord = Record<string, unknown>;

function authorityFileId(authorityId: string): string {
  return authorityId.replace(/[^A-Za-z0-9._-]/gu, '_');
}

function projectRef(projectRoot: string, targetPath: string): string {
  const relative = path
    .relative(path.resolve(projectRoot), path.resolve(targetPath))
    .replace(/\\/gu, '/');
  if (!relative || relative === '..' || relative.startsWith('../') || path.isAbsolute(relative)) {
    throw new Error('goal_execution_artifact_path_invalid');
  }
  return relative;
}

function pointerResult(projectRoot: string, outRoot: string, pointer: GoalExecutionAttemptPointer) {
  return Object.freeze({
    artifactRef: projectRef(
      projectRoot,
      path.join(outRoot, 'goal', 'runtime', 'current-execution-attempt.json')
    ),
    artifactHash: pointer.attemptPointerHash,
    pointerVersion: pointer.pointerVersion,
    phase: pointer.phase,
  });
}

function closureResultRefs(
  projectRoot: string,
  outRoot: string,
  closureRefs: GoalExecutionClosureRef[]
) {
  return closureRefs.map((closureRef) => ({
    role: 'authority_closure',
    artifactRef: projectRef(projectRoot, path.join(outRoot, ...closureRef.path.split('/'))),
    artifactHash: closureRef.hash,
  }));
}

function readClosure(outRoot: string, closureRef: GoalExecutionClosureRef): JsonRecord {
  return JSON.parse(
    fs.readFileSync(path.join(outRoot, ...closureRef.path.split('/')), 'utf8')
  ) as JsonRecord;
}

function canonicalBytes(value: unknown): Buffer {
  return Buffer.from(`${stableControlPlaneStringify(value)}\n`, 'utf8');
}

function stateHash(targetPath: string): { exists: boolean; hash: string } {
  if (!fs.existsSync(targetPath)) {
    return {
      exists: false,
      hash: `sha256:${createHash('sha256').update(Buffer.alloc(0)).digest('hex')}`,
    };
  }
  const stat = fs.lstatSync(targetPath);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('goal_execution_evidence_invalid');
  return {
    exists: true,
    hash: `sha256:${createHash('sha256').update(fs.readFileSync(targetPath)).digest('hex')}`,
  };
}

function confinedProjectArtifact(projectRoot: string, artifactRef: unknown): string {
  if (typeof artifactRef !== 'string' || artifactRef.includes('\\')) {
    throw new Error('goal_execution_evidence_invalid');
  }
  const root = path.resolve(projectRoot);
  const target = path.resolve(root, ...artifactRef.split('/'));
  const relative = path.relative(root, target);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('goal_execution_evidence_invalid');
  }
  return target;
}

function closureConsumerStateCurrent(input: {
  projectRoot: string;
  outRoot: string;
  closureRef: GoalExecutionClosureRef;
  authority: JsonRecord;
}): boolean {
  const closure = readClosure(input.outRoot, input.closureRef);
  const evidenceRef = closure.evidenceRef as JsonRecord;
  const evidencePath = confinedProjectArtifact(input.projectRoot, evidenceRef?.path);
  const evidence = JSON.parse(fs.readFileSync(evidencePath, 'utf8')) as JsonRecord;
  validateGoalContractSchema('goal-execution-observed-evidence.schema.json', evidence);
  const evidencePayload = { ...evidence };
  delete evidencePayload.evidenceHash;
  if (
    evidence.evidenceHash !== evidenceRef?.hash ||
    hashControlPlaneValue(evidencePayload) !== evidence.evidenceHash ||
    !fs.readFileSync(evidencePath).equals(canonicalBytes(evidence)) ||
    evidence.executionAuthorityId !== input.authority.executionAuthorityId ||
    evidence.executionAuthorityHash !== input.authority.executionAuthorityHash ||
    evidence.executionPackageHash !== input.authority.executionPackageHash ||
    stableControlPlaneStringify(evidence.ownedPaths) !==
      stableControlPlaneStringify(input.authority.ownedPaths) ||
    stableControlPlaneStringify(evidence.forbiddenPaths) !==
      stableControlPlaneStringify(input.authority.forbiddenPaths)
  ) {
    throw new Error('goal_execution_evidence_invalid');
  }
  const expectedCommands = (input.authority.commands as JsonRecord[]).map((command) => ({
    commandId: String(command.commandId),
    normalizedInvocation: String(command.invocation).trim(),
  }));
  const observedCommands = (evidence.commandObservations as JsonRecord[]).map((command) => ({
    commandId: String(command.commandId),
    normalizedInvocation: String(command.normalizedInvocation),
  }));
  if (
    stableControlPlaneStringify(expectedCommands) !== stableControlPlaneStringify(observedCommands)
  ) {
    return false;
  }
  const ownedPathStates = evidence.ownedPathStates as JsonRecord[];
  const expectedOwnedPaths = [...(input.authority.ownedPaths as string[])].sort();
  const observedOwnedPaths = ownedPathStates.map((entry) => String(entry.path)).sort();
  if (
    new Set(observedOwnedPaths).size !== observedOwnedPaths.length ||
    stableControlPlaneStringify(expectedOwnedPaths) !==
      stableControlPlaneStringify(observedOwnedPaths)
  ) {
    return false;
  }
  return ownedPathStates.every((ownedPathState) => {
    const targetPath = confinedProjectArtifact(input.projectRoot, ownedPathState.path);
    const current = stateHash(targetPath);
    return current.exists === ownedPathState.exists && current.hash === ownedPathState.hash;
  });
}

function resultBase(committed: JsonRecord, pointer: GoalExecutionAttemptPointer) {
  const projectRoot = String(committed.projectRoot);
  const outRoot = String(committed.outRoot);
  const activeRunPointer = committed.activeRunPointer as JsonRecord;
  const activationRecord = committed.activationRecord as JsonRecord;
  return {
    schemaVersion: 'main-agent-goal-run-result/v1',
    profile: committed.profile,
    activeRunPointer: {
      artifactRef: projectRef(projectRoot, String(committed.activeRunPointerPath)),
      artifactHash: activeRunPointer.activeRunPointerHash,
    },
    activationRecord: {
      artifactRef: projectRef(
        projectRoot,
        path.join(outRoot, ...String(activeRunPointer.activationRecordRef).split('/'))
      ),
      artifactHash: activationRecord.activationRecordHash,
    },
    attemptPointer: pointerResult(projectRoot, outRoot, pointer),
    validClosures: closureResultRefs(projectRoot, outRoot, pointer.validClosureRefs),
  };
}

function requirementsCampaignBinding(input: {
  projectRoot: string;
  requirementsReadiness: JsonRecord | null;
  closureRecords: JsonRecord[];
}) {
  if (!input.requirementsReadiness) {
    return {
      readinessCandidateRef: null,
      normalizedReadinessCommands: null,
      readinessRedOutcomes: null,
    };
  }
  const normalizedReadinessCommands = input.requirementsReadiness
    .normalizedCommands as JsonRecord[];
  const readinessRedOutcomes = input.requirementsReadiness.redOutcomes as JsonRecord[];
  const expectedCommands = normalizedReadinessCommands
    .map((command) => String(command.normalizedInvocation))
    .sort();
  const observedCommands = [
    ...new Set(
      input.closureRecords.flatMap((closure) => {
        const evidenceRef = closure.evidenceRef as JsonRecord;
        const evidencePath = confinedProjectArtifact(input.projectRoot, evidenceRef.path);
        const evidence = JSON.parse(fs.readFileSync(evidencePath, 'utf8')) as JsonRecord;
        validateGoalContractSchema('goal-execution-observed-evidence.schema.json', evidence);
        return (evidence.commandObservations as JsonRecord[]).map(
          (command) =>
            parseReadinessCommandInvocation(String(command.normalizedInvocation))
              .normalizedInvocation
        );
      })
    ),
  ].sort();
  if (
    stableControlPlaneStringify(expectedCommands) !== stableControlPlaneStringify(observedCommands)
  ) {
    throw new Error('readiness_recheck_required:command_identity');
  }
  return {
    readinessCandidateRef: input.requirementsReadiness.candidateRef,
    normalizedReadinessCommands,
    readinessRedOutcomes,
  };
}

function publishCampaign(input: { committed: JsonRecord; pointer: GoalExecutionAttemptPointer }) {
  const projectRoot = String(input.committed.projectRoot);
  const outRoot = String(input.committed.outRoot);
  const runRoot = String(input.committed.runRoot);
  const attemptRoot = path.join(runRoot, 'execution', input.pointer.executionAttemptId);
  const closureRecords = input.pointer.validClosureRefs.map((closureRef) =>
    readClosure(outRoot, closureRef)
  );
  const requirementsReadiness = input.committed.requirementsReadiness as JsonRecord | null;
  const activeRunPointer = input.committed.activeRunPointer as JsonRecord;
  const activationRecord = input.committed.activationRecord as JsonRecord;
  const readinessBinding = requirementsCampaignBinding({
    projectRoot,
    requirementsReadiness,
    closureRecords,
  });
  const campaign = publishGoalExecutionCampaignClosure({
    projectRoot,
    outRoot,
    attemptRoot,
    payload: {
      schemaVersion: 'goal-contract-campaign-closure-receipt/v1',
      profile: input.committed.profile,
      goalId: input.committed.goalId,
      goalExecutionIRHash: input.committed.goalExecutionIRHash,
      candidateRunId: (input.committed.candidateRun as JsonRecord).candidateRunId,
      activeRunPointerHash: activeRunPointer.activeRunPointerHash,
      activationRecordHash: activationRecord.activationRecordHash,
      executionMode: input.committed.executionMode,
      readinessScopedInputDigest: requirementsReadiness?.readinessScopedInputDigest ?? null,
      ...readinessBinding,
      orderedClosureRefs: input.pointer.validClosureRefs.map((closureRef) => ({
        executionAuthorityId: closureRef.executionAuthorityId,
        path: projectRef(projectRoot, path.join(outRoot, ...closureRef.path.split('/'))),
        hash: closureRef.hash,
      })),
      orderedEvidenceRefs: closureRecords.map((closure) => closure.evidenceRef),
      reviewerInvocationCount: 0,
      auditorInvocationCount: 0,
      judgeSemanticAttemptCount: 0,
      decision: 'pass',
    },
  });
  const evidenceRecords = closureRecords.map((closure) => {
    const evidenceRef = closure.evidenceRef as JsonRecord;
    return JSON.parse(
      fs.readFileSync(confinedProjectArtifact(projectRoot, evidenceRef.path), 'utf8')
    ) as JsonRecord;
  });
  const projections = publishGoalExecutionProjections({
    projectRoot,
    outRoot,
    attemptRoot,
    campaignClosureRef: campaign.projectRelativePath,
    campaignClosureHash: campaign.hash,
    packageManifestHash: String((input.committed.candidateRun as JsonRecord).candidateRunHash),
    goalId: String(input.committed.goalId),
    candidateRunId: String((input.committed.candidateRun as JsonRecord).candidateRunId),
    filesChanged: [
      ...new Set(
        closureRecords.flatMap((closure) =>
          Array.isArray(closure.changedPaths) ? closure.changedPaths.map(String) : []
        )
      ),
    ].sort(),
    validationsRun: [
      ...new Set(
        evidenceRecords.flatMap((evidence) =>
          (evidence.commandObservations as JsonRecord[]).map((command) =>
            String(command.normalizedInvocation)
          )
        )
      ),
    ].sort(),
    evidence: closureRecords.map((closure) => String((closure.evidenceRef as JsonRecord).path)),
    closedAuthorities: input.pointer.validClosureRefs.map((closureRef) => ({
      executionAuthorityId: closureRef.executionAuthorityId,
      closureHash: closureRef.hash,
    })),
  });
  return { campaign, projections };
}

function transition(input: {
  outRoot: string;
  pointer: GoalExecutionAttemptPointer;
  phase: 'executing' | 'closure_pending' | 'blocked' | 'closed';
  nextExecutionAuthorityId: string | null;
  validClosureRefs: GoalExecutionClosureRef[];
  blockedIssueCode?: string | null;
}): GoalExecutionAttemptPointer {
  return transitionGoalExecutionAttempt({
    outRoot: input.outRoot,
    expectedPointerHash: input.pointer.attemptPointerHash,
    expectedPointerVersion: input.pointer.pointerVersion,
    phase: input.phase,
    nextExecutionAuthorityId: input.nextExecutionAuthorityId,
    validClosureRefs: input.validClosureRefs,
    blockedIssueCode: input.blockedIssueCode ?? null,
  }).pointer;
}

function currentIssueCode(error: unknown): string {
  const issue = error instanceof Error ? error.message : String(error);
  return /^(?:requirements_successor_required|architecture_successor_required|readiness_recheck_required):[a-z0-9_]+$/u.test(
    issue
  ) || /^goal_execution_[a-z0-9_]+(?::[A-Za-z0-9._-]+)?$/u.test(issue)
    ? issue
    : 'goal_execution_internal_error';
}

function admitCommittedGoalRun(projectRoot: string, activeRunPointerPath: string): JsonRecord {
  return validateGoalExecutionAdmission({
    phase: 'execution_start_or_resume',
    projectRoot,
    goalAuthorityPath: path.join(
      path.dirname(path.dirname(activeRunPointerPath)),
      'active-authority.json'
    ),
    activeRunPointerPath,
  }) as unknown as JsonRecord;
}

function assertSameCommittedAdmission(before: JsonRecord, after: JsonRecord): void {
  const identity = (value: JsonRecord) => ({
    profile: value.profile,
    goalId: value.goalId,
    goalExecutionIRHash: value.goalExecutionIRHash,
    activeRunPointerHash: (value.activeRunPointer as JsonRecord).activeRunPointerHash,
    activationRecordHash: (value.activationRecord as JsonRecord).activationRecordHash,
    candidateRunHash: (value.candidateRun as JsonRecord).candidateRunHash,
    orderedExecutionAuthorityIds: value.orderedExecutionAuthorityIds,
    executionAuthorities: value.executionAuthorities,
  });
  if (
    stableControlPlaneStringify(identity(before)) !== stableControlPlaneStringify(identity(after))
  ) {
    throw new Error('goal_execution_admission_changed');
  }
}

export function executeCommittedGoalRun(input: {
  projectRoot: string;
  activeRunPointerPath: string;
  remediateFrom?: string | null;
}) {
  const projectRoot = path.resolve(input.projectRoot);
  const activeRunPointerPath = path.resolve(projectRoot, input.activeRunPointerPath);
  const admitted = admitCommittedGoalRun(projectRoot, activeRunPointerPath);
  const outRoot = String(admitted.outRoot);
  const activeRunPointer = admitted.activeRunPointer as JsonRecord;
  const activationRecord = admitted.activationRecord as JsonRecord;
  const executionAuthorities = admitted.executionAuthorities as JsonRecord[];
  let executionLease: GoalExecutionRunLease | null = null;
  let pointer: GoalExecutionAttemptPointer | null = null;
  try {
    executionLease = acquireGoalExecutionRunLease(outRoot);
    const prepared = prepareGoalExecutionAttempt({
      outRoot,
      projectRoot,
      activeRunPointerHash: String(activeRunPointer.activeRunPointerHash),
      activationRecordHash: String(activationRecord.activationRecordHash),
      orderedExecutionAuthorityIds: admitted.orderedExecutionAuthorityIds as string[],
      executionAuthorities: executionAuthorities as GoalExecutionAttemptAuthority[],
    });
    pointer = prepared.pointer;
    if (
      input.remediateFrom &&
      !pointer.orderedExecutionAuthorityIds.includes(input.remediateFrom)
    ) {
      throw new Error('goal_execution_remediation_boundary_invalid');
    }
    const authorityById = new Map(
      executionAuthorities.map((authority) => [String(authority.executionAuthorityId), authority])
    );
    const remediationRoots = new Set<string>();
    if (input.remediateFrom) remediationRoots.add(input.remediateFrom);
    if (pointer.validClosureRefs.length > 0) {
      for (const closureRef of pointer.validClosureRefs) {
        const authority = authorityById.get(closureRef.executionAuthorityId);
        if (!authority) throw new Error('goal_execution_authority_missing');
        if (
          !closureConsumerStateCurrent({
            projectRoot,
            outRoot,
            closureRef,
            authority,
          })
        ) {
          remediationRoots.add(closureRef.executionAuthorityId);
        }
      }
    }
    if (remediationRoots.size > 0) {
      pointer = remediateGoalExecutionAttempt({
        outRoot,
        projectRoot,
        activeRunPointerHash: String(activeRunPointer.activeRunPointerHash),
        activationRecordHash: String(activationRecord.activationRecordHash),
        orderedExecutionAuthorityIds: admitted.orderedExecutionAuthorityIds as string[],
        executionAuthorities: executionAuthorities as GoalExecutionAttemptAuthority[],
        remediateFrom: [...remediationRoots],
      }).pointer;
    }
    if (pointer.phase === 'closed') {
      const published = publishCampaign({ committed: admitted, pointer });
      return Object.freeze({
        ...resultBase(admitted, pointer),
        status: 'execution_reused',
        issueCode: null,
        campaignClosure: {
          artifactRef: published.campaign.projectRelativePath,
          artifactHash: published.campaign.hash,
        },
        projections: published.projections,
      });
    }
    try {
      if (pointer.phase === 'prepared' || pointer.phase === 'blocked') {
        pointer = transition({
          outRoot,
          pointer,
          phase: pointer.nextExecutionAuthorityId ? 'executing' : 'closure_pending',
          nextExecutionAuthorityId: pointer.nextExecutionAuthorityId,
          validClosureRefs: pointer.validClosureRefs,
        });
      }
      while (pointer.phase === 'executing' && pointer.nextExecutionAuthorityId) {
        const authority = authorityById.get(pointer.nextExecutionAuthorityId);
        if (!authority) throw new Error('goal_execution_authority_missing');
        const mutation = executeGoalRunMutation({
          projectRoot,
          candidateRunId: String((admitted.candidateRun as JsonRecord).candidateRunId),
          executionAuthority: authority,
          adapter: admitted.executionAdapter as never,
        });
        assertSameCommittedAdmission(
          admitted,
          admitCommittedGoalRun(projectRoot, activeRunPointerPath)
        );
        const attemptRoot = path.join(
          String(admitted.runRoot),
          'execution',
          pointer.executionAttemptId
        );
        const fileId = authorityFileId(String(authority.executionAuthorityId));
        const requirementsReadiness = admitted.requirementsReadiness as JsonRecord | null;
        const evidence = publishGoalExecutionObservedEvidence({
          projectRoot,
          outRoot,
          attemptRoot,
          authorityFileId: fileId,
          payload: {
            schemaVersion: 'GoalExecutionObservedEvidence/v1',
            profile: admitted.profile,
            candidateRunId: (admitted.candidateRun as JsonRecord).candidateRunId,
            activeRunPointerHash: activeRunPointer.activeRunPointerHash,
            activationRecordHash: activationRecord.activationRecordHash,
            executionAuthorityId: authority.executionAuthorityId,
            executionAuthorityHash: authority.executionAuthorityHash,
            executionPackageHash: authority.executionPackageHash,
            readinessScopedInputDigest: requirementsReadiness?.readinessScopedInputDigest ?? null,
            ownedPaths: authority.ownedPaths,
            forbiddenPaths: authority.forbiddenPaths,
            observedFiles: mutation.observedFiles,
            ownedPathStates: mutation.ownedPathStates,
            commandObservations: mutation.commandObservations,
            reviewerInvocationCount: 0,
            auditorInvocationCount: 0,
            judgeSemanticAttemptCount: 0,
          },
        });
        const dependencyIds = authority.dependencyExecutionAuthorityIds as string[];
        const dependencyClosureRefs = dependencyIds.map((dependencyId) => {
          const closureRef = pointer.validClosureRefs.find(
            (candidate) => candidate.executionAuthorityId === dependencyId
          );
          if (!closureRef) throw new Error('goal_execution_dependency_closure_missing');
          return closureRef;
        });
        const closure = publishGoalExecutionAuthorityClosure({
          projectRoot,
          outRoot,
          attemptRoot,
          authorityFileId: fileId,
          payload: {
            schemaVersion: 'GoalExecutionAuthorityClosure/v1',
            profile: admitted.profile,
            candidateRunId: (admitted.candidateRun as JsonRecord).candidateRunId,
            activeRunPointerHash: activeRunPointer.activeRunPointerHash,
            activationRecordHash: activationRecord.activationRecordHash,
            executionAuthorityId: authority.executionAuthorityId,
            executionAuthorityHash: authority.executionAuthorityHash,
            executionPackageHash: authority.executionPackageHash,
            evidenceRef: { path: evidence.projectRelativePath, hash: evidence.hash },
            dependencyClosureRefs,
            changedPaths: mutation.changedPaths,
            commitProof: mutation.commitProof,
            reviewerInvocationCount: 0,
            auditorInvocationCount: 0,
            judgeSemanticAttemptCount: 0,
            decision: 'pass',
          },
        });
        const validClosureRefs = [
          ...pointer.validClosureRefs,
          {
            executionAuthorityId: String(authority.executionAuthorityId),
            path: closure.outRootRelativePath,
            hash: closure.hash,
          },
        ].sort(
          (left, right) =>
            pointer.orderedExecutionAuthorityIds.indexOf(left.executionAuthorityId) -
            pointer.orderedExecutionAuthorityIds.indexOf(right.executionAuthorityId)
        );
        const nextExecutionAuthorityId =
          pointer.orderedExecutionAuthorityIds.find(
            (authorityId) =>
              !validClosureRefs.some(
                (closureRef) => closureRef.executionAuthorityId === authorityId
              )
          ) ?? null;
        pointer = transition({
          outRoot,
          pointer,
          phase: nextExecutionAuthorityId ? 'executing' : 'closure_pending',
          nextExecutionAuthorityId,
          validClosureRefs,
        });
      }
      if (pointer.phase !== 'closure_pending') {
        throw new Error('goal_execution_attempt_progress_invalid');
      }
      const published = publishCampaign({ committed: admitted, pointer });
      pointer = transition({
        outRoot,
        pointer,
        phase: 'closed',
        nextExecutionAuthorityId: null,
        validClosureRefs: pointer.validClosureRefs,
      });
      return Object.freeze({
        ...resultBase(admitted, pointer),
        status: 'closed',
        issueCode: null,
        campaignClosure: {
          artifactRef: published.campaign.projectRelativePath,
          artifactHash: published.campaign.hash,
        },
        projections: published.projections,
      });
    } catch (error) {
      const issueCode = currentIssueCode(error);
      const current = readGoalExecutionAttemptPointer({ outRoot });
      const conflict = [
        'goal_execution_attempt_cas_conflict',
        'goal_execution_attempt_in_progress',
      ].includes(issueCode);
      if (
        current &&
        pointer &&
        !conflict &&
        current.attemptPointerHash === pointer.attemptPointerHash &&
        current.phase !== 'closed' &&
        current.phase !== 'blocked'
      ) {
        pointer = transition({
          outRoot,
          pointer: current,
          phase: 'blocked',
          nextExecutionAuthorityId: current.nextExecutionAuthorityId,
          validClosureRefs: current.validClosureRefs,
          blockedIssueCode: issueCode,
        });
      } else if (current) {
        pointer = current;
      }
      throw Object.assign(new Error(issueCode), { committed: admitted, attemptPointer: pointer });
    }
  } catch (error) {
    if ((error as { committed?: unknown }).committed) throw error;
    const issueCode = currentIssueCode(error);
    const current = readGoalExecutionAttemptPointer({ outRoot }) ?? pointer;
    throw Object.assign(new Error(issueCode), {
      committed: admitted,
      ...(current ? { attemptPointer: current } : {}),
    });
  } finally {
    if (executionLease) releaseGoalExecutionRunLease(executionLease);
  }
}
