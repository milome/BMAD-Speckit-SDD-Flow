import { existsSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  artifacts,
  cleanCriticalAuditorRound,
  createTempRoot,
  readJson,
  removeTempRoot,
  runIntakeAuthoring,
  writeText,
} from './helpers/requirements-contract-authoring-fixture';
import type { RequirementContractModel } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-model';
import {
  compileRequirementContractModel,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-compiler';
import {
  closeRequirementContractInvariants,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-invariant-closure';

function compilerSource(): string {
  return [
    '# Compiler Closure PRD',
    '',
    '目标文件：`src/compiler_target.py`',
    '',
    '## Functional Requirements',
    '',
    '| FR ID | Requirement |',
    '| --- | --- |',
    '| FR-001 | System MUST compile source-bound requirements into a closed model. |',
    '| FR-002 | System MUST preserve trace, acceptance, evidence, and view closure. |',
    '',
    '## Out Of Scope',
    '',
    '- User confirmation is out of scope for authoring.',
  ].join('\n');
}

function sourceBoundIncompleteModel(label: string): RequirementContractModel {
  const normalized = label.toUpperCase();
  const sourcePath = `docs/requirements/${label}.md`;
  const must = {
    id: `REQUIREMENT-${normalized}-PRIMARY`,
    text: `${label} primary behavior is required.`,
    sourceRequirementId: `SOURCE-${normalized}-PRIMARY`,
    sourcePath,
    sourceSpan: { startLine: 7, endLine: 7 },
  };
  const negative = {
    id: `REQUIREMENT-${normalized}-NEGATIVE`,
    text: `${label} forbidden behavior must remain absent.`,
    sourceRequirementId: `SOURCE-${normalized}-NEGATIVE`,
    sourcePath,
    sourceSpan: { startLine: 8, endLine: 8 },
  };
  const boundary = {
    id: `BOUNDARY-${normalized}`,
    text: `${label} unrelated behavior is out of scope.`,
    authorityState: 'source_boundary' as const,
    provenance: {
      sourceRequirementId: `SOURCE-${normalized}-BOUNDARY`,
      sourcePath,
      sourceSpan: { startLine: 9, endLine: 9 },
    },
  };
  return compileRequirementContractModel({
    recordId: `MODEL-${normalized}`,
    requirementSetId: `MODEL-${normalized}-SET`,
    must: [must],
    notDone: [negative],
    outOfScope: [boundary],
    requiredCommands: [
      {
        id: `VALIDATION-${normalized}`,
        command: `npx vitest run tests/${label}.test.ts`,
        requirementRefs: [must.id],
      },
    ],
    targetPaths: [
      {
        id: `MODIFICATION-${normalized}`,
        path: `src/${label}.ts`,
        requirementRefs: [must.id],
      },
    ],
  });
}

describe('requirements contract authoring compiler invariant closure', () => {
  it('treats the model as projection authority without materializing missing views', () => {
    const model = sourceBoundIncompleteModel('projection-authority');
    const closed = closeRequirementContractInvariants(model);

    expect(closed.businessViews).toEqual(model.businessViews);
    expect(closed.traceRows).toEqual(model.traceRows);
    expect(closed.invariantClosure.terminalState).toBe('blocked');
    expect(closed.invariantClosure.issues.map((issue) => issue.code)).toContain(
      'missing_business_view_projection'
    );
    expect(closed.invariantClosure.rendererBlockerPolicy).toBe(
      'renderer_blocker_release_failure'
    );
  });

  it('keeps checkpoint-produced projection obligations out of the pre-checkpoint closure profile', () => {
    const model = sourceBoundIncompleteModel('pre-checkpoint-profile');
    const preCheckpoint = closeRequirementContractInvariants(model, {
      profile: 'pre_checkpoint',
    });
    const full = closeRequirementContractInvariants(model);

    expect(preCheckpoint.invariantClosure.terminalState).toBe('confirmable');
    expect(preCheckpoint.invariantClosure.issues).toEqual([]);
    expect(full.invariantClosure.terminalState).toBe('blocked');
    expect(full.invariantClosure.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        'missing_evidence_coverage',
        'missing_acceptance_coverage',
        'missing_trace_coverage',
        'missing_business_view_projection',
      ])
    );
  });

  it('computes before and after measures from the actual unchanged model', () => {
    const model = sourceBoundIncompleteModel('closure-measure');
    const closed = closeRequirementContractInvariants(model);

    expect(closed.invariantClosure.measureBefore).toMatchObject({
      unresolvedInvariantCount: expect.any(Number),
      orphanReferenceCount: expect.any(Number),
      missingProjectionCount: expect.any(Number),
      localizationParityCount: expect.any(Number),
      schemaValidationCount: expect.any(Number),
    });
    expect(closed.invariantClosure.measureAfter).toEqual(
      closed.invariantClosure.measureBefore
    );
    expect(closed.invariantClosure.measureAfter?.unresolvedInvariantCount).toBeGreaterThan(0);
    expect(closed.invariantClosure.measureAfter?.missingProjectionCount).toBeGreaterThan(0);
  });

  it('records only executed validation passes without changing semantic fields', () => {
    const model = sourceBoundIncompleteModel('pass-receipts');
    const closed: RequirementContractModel = closeRequirementContractInvariants(model);
    const receipts = closed.invariantClosure.roundReceipts ?? [];

    expect(closed.invariantClosure.remainingIssueCount).toBe(
      closed.invariantClosure.issues.length
    );
    expect(closed.invariantClosure.appliedPasses).toEqual(
      receipts.map((receipt) => receipt.passId)
    );
    expect(closed.invariantClosure.appliedPasses).not.toContain('closeMustCoverage');
    expect(closed.invariantClosure.appliedPasses).not.toContain('closeNegCoverage');
    expect(receipts.every((receipt) => receipt.outputs.changedFields.length === 0)).toBe(true);
    expect(closed.evidence).toEqual(model.evidence);
    expect(closed.acceptanceCriteria).toEqual(model.acceptanceCriteria);
    expect(closed.targetModificationPaths).toEqual(model.targetModificationPaths);
  });

  it('writes a blocking measured report when source semantics are incomplete', () => {
    const root = createTempRoot('bmad-compiler-closure-');
    try {
      const intakeSource = writeText(root, 'source.md', compilerSource());
      const targetSource = path.join(root, 'generated.md');
      const recordId = 'REQ-TEST-COMPILER-CLOSURE';
      const result = runIntakeAuthoring(root, intakeSource, targetSource, recordId, {
        targetPath: 'tests/trader/test_gateway_profile_registry.py',
        requiredCommand: 'python -m pytest tests/trader/test_gateway_profile_registry.py',
        confirmationLanguage: 'en-US',
        sessionId: 'session-compiler-closure',
        sessionTurnId: 'turn-compiler-closure',
        sessionMessageId: 'message-compiler-closure',
        sessionActorIdentityClass: 'requesting_user',
        sessionBranch: 'test-compiler-closure',
        sessionCapturedAt: '2026-07-14T00:00:00.000Z',
        criticalAuditorRound: cleanCriticalAuditorRound,
      });

      const paths = artifacts(root, recordId, `${recordId}-SET`);
      const modelPath = path.join(paths.authoring, 'requirement-contract-model.json');
      const reportPath = path.join(paths.authoring, 'compiler-closure-report.json');
      expect(existsSync(paths.invocationAuthorityReceipt)).toBe(true);
      expect(readJson<Record<string, unknown>>(paths.invocationAuthorityReceipt)).toMatchObject({
        schemaVersion: 'requirements-contract-invocation-authority-receipt/v1',
        requirementSetId: `${recordId}-SET`,
        recordId,
        entrySource: 'session_requirements',
      });
      expect(existsSync(modelPath)).toBe(true);
      expect(existsSync(reportPath)).toBe(true);
      expect(readJson<Record<string, unknown>>(reportPath)).toMatchObject({
        terminalState: 'blocked',
        rendererBlockerPolicy: 'renderer_blocker_release_failure',
      });
      expect(
        Number(readJson<Record<string, unknown>>(reportPath).remainingIssueCount)
      ).toBeGreaterThan(0);
      expect(result.blockingIssues.map((issue) => issue.code)).toContain(
        'renderer_blocker_release_failure'
      );
    } finally {
      removeTempRoot(root);
    }
  });
});
