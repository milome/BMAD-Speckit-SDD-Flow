import { describe, expect, it } from 'vitest';
import {
  createRequirementsContractLintReport,
  validateRequirementsContractLintReport,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-lint-report';

const hash = (digit: string) => `sha256:${digit.repeat(64)}`;

const stagedIdentityCases = [
  {
    lintStage: 'intake',
    profileId: 'requirements-intake/v1',
    inputIdentity: {
      authoringRequestId: 'REQUEST-1',
      sourceSnapshotSetHash: hash('1'),
      sourceAuthorityManifestHash: hash('2'),
      scopeSemanticHash: null,
      sourceBindingHash: null,
    },
  },
  {
    lintStage: 'cp00',
    profileId: 'requirements-semantic/v1',
    inputIdentity: {
      authoringRequestId: 'REQUEST-1',
      authoringAttemptId: 'ATTEMPT-1',
      semanticKernelHash: hash('1'),
      decisionGraphHash: hash('2'),
      scopeSemanticHash: null,
      sourceBindingHash: null,
    },
  },
  ...(['cp01', 'cp02', 'cp03'] as const).map((lintStage) => ({
    lintStage,
    profileId: 'requirements-semantic/v1',
    inputIdentity: {
      authoringRequestId: 'REQUEST-1',
      authoringAttemptId: 'ATTEMPT-1',
      attemptManifestHash: hash('1'),
      scopeSemanticHash: null,
      sourceBindingHash: null,
    },
  })),
  ...(['cp04'] as const).map((lintStage) => ({
    lintStage,
    profileId: 'requirements-semantic/v1',
    inputIdentity: {
      authoringRequestId: 'REQUEST-1',
      authoringAttemptId: 'ATTEMPT-1',
      attemptManifestHash: hash('1'),
      scopeSemanticHash: hash('2'),
      sourceBindingHash: hash('3'),
    },
  })),
  ...(['cp05', 'cp06', 'cp07', 'cp08'] as const).map((lintStage) => ({
    lintStage,
    profileId: 'requirements-projection/v1',
    inputIdentity: {
      authoringRequestId: 'REQUEST-1',
      authoringAttemptId: 'ATTEMPT-1',
      attemptManifestHash: hash('1'),
      scopeSemanticHash: hash('2'),
      sourceBindingHash: hash('3'),
    },
  })),
  {
    lintStage: 'publication_ready',
    profileId: 'requirements-publication-ready/v1',
    inputIdentity: {
      authoringRequestId: 'REQUEST-1',
      authoringAttemptId: 'ATTEMPT-1',
      attemptManifestHash: hash('1'),
      scopeSemanticHash: hash('2'),
      sourceBindingHash: hash('3'),
      auditPacketHash: hash('4'),
      renderabilityProbeHash: hash('5'),
    },
  },
  {
    lintStage: 'dispatch_ready',
    profileId: 'requirements-dispatch-ready/v1',
    inputIdentity: {
      authoringRequestId: 'REQUEST-1',
      activeAuthorityHash: hash('1'),
      buildManifestHash: hash('2'),
      providerSelectionHash: hash('3'),
      judgeRequestHash: hash('4'),
      scopeSemanticHash: hash('5'),
      sourceBindingHash: hash('6'),
    },
  },
  {
    lintStage: 'final_render',
    profileId: 'requirements-final-render/v1',
    inputIdentity: {
      authoringRequestId: 'REQUEST-1',
      activeAuthorityHash: hash('1'),
      buildManifestHash: hash('2'),
      effectivePassHash: hash('3'),
      renderProjectionHash: hash('4'),
      scopeSemanticHash: hash('5'),
      sourceBindingHash: hash('6'),
    },
  },
] as const;

describe('requirements contract staged lint report', () => {
  it('allows null frozen identities at intake and computes a canonical self hash', () => {
    const report = createRequirementsContractLintReport({
      lintStage: 'intake', profileId: 'requirements-intake/v1', inputAuthorityRefs: [],
      inputIdentity: { authoringRequestId: 'REQUEST-1', sourceSnapshotSetHash: hash('1'), sourceAuthorityManifestHash: hash('2'), scopeSemanticHash: null, sourceBindingHash: null },
      ruleSetHash: hash('3'), validatorIdentity: 'requirements-validator', validatorVersion: 'v1', validatorHash: hash('4'),
      checkedArtifactIds: ['SOURCE-1'], checkedRequirementIds: [], issueCodes: [], earliestAffectedStage: 'intake', latestValidPredecessorCheckpoint: null, decision: 'pass',
    });
    expect(validateRequirementsContractLintReport(report)).toEqual({ decision: 'pass', issueCodes: [] });
    expect(report.reportHash).toMatch(/^sha256:/u);
    expect(report).not.toHaveProperty('semanticAuthority');
  });

  it('rejects impossible stage/identity combinations and unknown fields', () => {
    const report = createRequirementsContractLintReport({
      lintStage: 'cp04', profileId: 'requirements-semantic/v1', inputAuthorityRefs: [],
      inputIdentity: { authoringRequestId: 'REQUEST-1', authoringAttemptId: 'ATTEMPT-1', attemptManifestHash: hash('1'), scopeSemanticHash: hash('2'), sourceBindingHash: hash('3') },
      ruleSetHash: hash('4'), validatorIdentity: 'requirements-validator', validatorVersion: 'v1', validatorHash: hash('5'),
      checkedArtifactIds: ['SEM-1'], checkedRequirementIds: ['MUST-1'], issueCodes: [], earliestAffectedStage: 'cp04', latestValidPredecessorCheckpoint: 'cp03', decision: 'pass',
    });
    expect(validateRequirementsContractLintReport({ ...report, unknown: true }).decision).toBe('block');
    expect(validateRequirementsContractLintReport({ ...report, inputIdentity: { ...report.inputIdentity, scopeSemanticHash: null } }).issueCodes).toContain('lint_report_stage_identity_invalid');
  });

  it('constructs every legal stage identity without borrowing later-stage fields', () => {
    for (const candidate of stagedIdentityCases) {
      const report = createRequirementsContractLintReport({
        ...candidate,
        inputAuthorityRefs: [],
        ruleSetHash: hash('7'),
        validatorIdentity: 'requirements-validator',
        validatorVersion: 'v1',
        validatorHash: hash('8'),
        checkedArtifactIds: [],
        checkedRequirementIds: [],
        issueCodes: [],
        earliestAffectedStage: candidate.lintStage,
        latestValidPredecessorCheckpoint: null,
        decision: 'pass',
      });
      expect(validateRequirementsContractLintReport(report), candidate.lintStage).toEqual({
        decision: 'pass',
        issueCodes: [],
      });
    }
  });

  it('rejects dispatch and final-render identities that borrow each other\'s authority', () => {
    for (const candidate of stagedIdentityCases.filter(({ lintStage }) =>
      lintStage === 'dispatch_ready' || lintStage === 'final_render'
    )) {
      const borrowedField = candidate.lintStage === 'dispatch_ready'
        ? { effectivePassHash: hash('9') }
        : { providerSelectionHash: hash('9') };
      expect(() => createRequirementsContractLintReport({
        ...candidate,
        inputIdentity: { ...candidate.inputIdentity, ...borrowedField },
        inputAuthorityRefs: [],
        ruleSetHash: hash('7'),
        validatorIdentity: 'requirements-validator',
        validatorVersion: 'v1',
        validatorHash: hash('8'),
        checkedArtifactIds: [],
        checkedRequirementIds: [],
        issueCodes: [],
        earliestAffectedStage: candidate.lintStage,
        latestValidPredecessorCheckpoint: null,
        decision: 'pass',
      })).toThrow('lint_report_stage_identity_unknown_field');
    }
  });
});
