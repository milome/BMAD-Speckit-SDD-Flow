import Ajv2020 from 'ajv/dist/2020.js';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { prepareCampaign } from '../helpers/goal-subcontract-campaign-fixture';
import {
  cleanupFixtures,
  directoryDigest,
  git,
  hashFile,
  runScript,
  SKILL_ROOT,
} from '../helpers/goal-subcontract-execution-package-fixture';

afterEach(cleanupFixtures);

function audit(
  packageRoot: string,
  artifactsPath: string,
  out: string,
  expectedPackageManifestHash: string
) {
  return runScript('audit-completed-campaign.js', [
    '--package',
    packageRoot,
    '--expected-package-manifest-hash',
    expectedPackageManifestHash,
    '--artifacts',
    artifactsPath,
    '--out',
    out,
    '--json',
  ]);
}

function readArtifacts(artifactsPath: string) {
  return JSON.parse(fs.readFileSync(artifactsPath, 'utf8'));
}

function writeArtifacts(artifactsPath: string, artifacts: unknown): void {
  fs.writeFileSync(artifactsPath, `${JSON.stringify(artifacts, null, 2)}\n`, 'utf8');
}

type CampaignFixtureOptions = NonNullable<Parameters<typeof prepareCampaign>[0]>;

function expectAuditResultFailure(
  result: ReturnType<typeof audit>,
  expectedFailureClass: string
): void {
  expect(result.status).not.toBe(0);
  expect(JSON.parse(result.stdout).failureClass).toBe(expectedFailureClass);
}

function expectAuditFailure(
  options: CampaignFixtureOptions,
  expectedFailureClass: string
): ReturnType<typeof prepareCampaign> {
  const fixture = prepareCampaign(options);
  const result = audit(
    fixture.packageA,
    fixture.artifactsPath,
    fixture.finalOut,
    fixture.packageManifestHash
  );
  expectAuditResultFailure(result, expectedFailureClass);
  return fixture;
}

function auditWithManifest(manifest: object) {
  const executionAuditPath = path.join(SKILL_ROOT, 'scripts', 'audit-execution-package.js');
  const campaignAuditPath = path.join(SKILL_ROOT, 'scripts', 'audit-completed-campaign.js');
  const harness = `
    const executionAuditPath = process.argv[1];
    const campaignAuditPath = process.argv[2];
    const executionAudit = require(executionAuditPath);
    executionAudit.auditExecutionPackage = () => JSON.parse(process.argv[3]);
    delete require.cache[require.resolve(campaignAuditPath)];
    const { auditCompletedCampaign } = require(campaignAuditPath);
    try {
      auditCompletedCampaign({
        packageRoot: 'unused',
        expectedPackageManifestHash: 'sha256:${'a'.repeat(64)}',
        artifactsPath: 'unused',
        outputRoot: 'unused',
      });
      process.stdout.write(JSON.stringify({ ok: true }));
    } catch (error) {
      process.stdout.write(JSON.stringify({
        ok: false,
        failureClass: error.failureClass || 'completed_campaign_audit_failed',
      }));
      process.exitCode = 1;
    }
  `;
  return spawnSync(
    process.execPath,
    ['-e', harness, executionAuditPath, campaignAuditPath, JSON.stringify(manifest)],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
      windowsHide: true,
    }
  );
}

describe('goal subcontract completed campaign audit', () => {
  it('rejects an empty manifest child set before auditing repository state', () => {
    expectAuditResultFailure(auditWithManifest({ children: [] }), 'child_result_set_incomplete');
  });

  it('emits done with an absent RequirementRecord and does not mutate Git', () => {
    const fixture = prepareCampaign();
    const headBefore = git(fixture.root, ['rev-parse', 'HEAD']);
    const result = audit(
      fixture.packageA,
      fixture.artifactsPath,
      fixture.finalOut,
      fixture.packageManifestHash
    );
    const repeatedOut = `${fixture.finalOut}-repeat`;
    const repeated = audit(
      fixture.packageA,
      fixture.artifactsPath,
      repeatedOut,
      fixture.packageManifestHash
    );

    expect(result.status, result.stderr || result.stdout).toBe(0);
    expect(repeated.status, repeated.stderr || repeated.stdout).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      ok: true,
      status: 'done',
      packageManifestHash: fixture.packageManifestHash,
    });
    expect(directoryDigest(repeatedOut)).toBe(directoryDigest(fixture.finalOut));
    expect(git(fixture.root, ['rev-parse', 'HEAD'])).toBe(headBefore);
    const manifest = readArtifacts(path.join(fixture.packageA, 'package-manifest.json'));
    const report = JSON.parse(
      fs.readFileSync(path.join(fixture.finalOut, 'task-report.json'), 'utf8')
    );
    const handoff = readArtifacts(path.join(fixture.finalOut, 'main-agent-handoff.json'));
    const campaignReport = readArtifacts(path.join(fixture.finalOut, 'campaign-audit-report.json'));
    const artifacts = readArtifacts(fixture.artifactsPath);
    const expectedChildSummaries = [
      {
        partitionId: 'AUTH-01',
        displayTitle: 'Refresh expired access tokens',
        functionalOutcome: '访问令牌过期时自动签发新的访问令牌和刷新令牌',
        status: 'closed',
        commitSubject: 'feat(auth): 支持访问令牌过期后自动签发新令牌',
        commitHash: artifacts.childResults[0].commit.hash,
        evidenceHash: artifacts.childResults[0].evidence.hash,
        closureHash: artifacts.childResults[0].closure.hash,
        validationCommandIds: ['CMD-AUTH-01'],
      },
      {
        partitionId: 'AUTH-02',
        displayTitle: 'Revoke rotated refresh tokens',
        functionalOutcome: '刷新凭据轮换后立即撤销旧刷新令牌',
        status: 'closed',
        commitSubject: 'fix(auth): 轮换刷新凭据后立即撤销旧令牌',
        commitHash: artifacts.childResults[1].commit.hash,
        evidenceHash: artifacts.childResults[1].evidence.hash,
        closureHash: artifacts.childResults[1].closure.hash,
        validationCommandIds: ['CMD-AUTH-02'],
      },
    ];
    expect(campaignReport.schemaVersion).toBe('goal-subcontract-campaign-audit-report/v2');
    expect(report.schemaVersion).toBe('goal-subcontract-campaign-task-report/v2');
    expect(handoff.schemaVersion).toBe('goal-subcontract-main-agent-handoff/v2');
    expect(report.status).toBe('done');
    expect(report.aggregateAuditDecision).toBe('pass');
    expect(campaignReport.childSummaries).toEqual(expectedChildSummaries);
    expect(report.childSummaries).toEqual(expectedChildSummaries);
    expect(handoff.childSummaries).toEqual(expectedChildSummaries);
    expect(report.requirementRecordBinding).toEqual({
      status: 'absent',
      downstreamAction: 'main_agent_resolve_requirement_record',
    });
    expect(report.requirementRecordBinding).not.toHaveProperty('recordId');
    expect(handoff).toMatchObject({
      goalContractHash: manifest.goalContract.hash,
      partitionManifestHash: manifest.partitionManifest.hash,
      aggregateAuditDecision: 'pass',
    });
  });

  it('emits done while preserving a supplied RequirementRecord binding', () => {
    const fixture = prepareCampaign({
      requirementRecordBinding: {
        status: 'present',
        recordId: 'RR-42',
        requirementSetId: 'REQ-42',
        recordPathHash: `sha256:${'a'.repeat(64)}`,
      },
    });
    const result = audit(
      fixture.packageA,
      fixture.artifactsPath,
      fixture.finalOut,
      fixture.packageManifestHash
    );

    expect(result.status, result.stderr || result.stdout).toBe(0);
    const report = JSON.parse(
      fs.readFileSync(path.join(fixture.finalOut, 'task-report.json'), 'utf8')
    );
    expect(report.status).toBe('done');
    expect(report.requirementRecordBinding.recordId).toBe('RR-42');
  });

  it('requires an external trusted package-manifest hash for completed-campaign audit', () => {
    const fixture = prepareCampaign();
    const result = runScript('audit-completed-campaign.js', [
      '--package',
      fixture.packageA,
      '--artifacts',
      fixture.artifactsPath,
      '--out',
      fixture.finalOut,
      '--json',
    ]);

    expectAuditResultFailure(result, 'expected_package_manifest_hash_missing');
  });

  it('emits TaskReports that satisfy present and absent binding schema branches', () => {
    const ajv = new Ajv2020({ allErrors: true, strict: false });
    const schema = JSON.parse(
      fs.readFileSync(
        path.join(SKILL_ROOT, 'schemas/campaign-task-report-binding.schema.json'),
        'utf8'
      )
    );
    const validate = ajv.compile(schema);

    const absent = prepareCampaign();
    expect(
      audit(absent.packageA, absent.artifactsPath, absent.finalOut, absent.packageManifestHash)
        .status
    ).toBe(0);
    const absentReport = readArtifacts(path.join(absent.finalOut, 'task-report.json'));
    expect(validate(absentReport), JSON.stringify(validate.errors)).toBe(true);

    const present = prepareCampaign({
      requirementRecordBinding: {
        status: 'present',
        recordId: 'RR-42',
        requirementSetId: 'REQ-42',
        recordPathHash: `sha256:${'a'.repeat(64)}`,
      },
    });
    expect(
      audit(present.packageA, present.artifactsPath, present.finalOut, present.packageManifestHash)
        .status
    ).toBe(0);
    const presentReport = readArtifacts(path.join(present.finalOut, 'task-report.json'));
    expect(validate(presentReport), JSON.stringify(validate.errors)).toBe(true);

    const fabricatedAbsent = {
      ...absentReport,
      requirementRecordBinding: {
        ...absentReport.requirementRecordBinding,
        recordId: 'RR-FABRICATED',
      },
    };
    expect(validate(fabricatedAbsent)).toBe(false);
  });

  it('accepts functional commit subjects containing oauth-2 and utf-8 tokens', () => {
    const fixture = prepareCampaign({ technicalTokenSubject: true });
    const result = audit(
      fixture.packageA,
      fixture.artifactsPath,
      fixture.finalOut,
      fixture.packageManifestHash
    );

    expect(result.status, result.stderr || result.stdout).toBe(0);
  });

  it('rejects commit subjects containing another declared partition ID', () => {
    expectAuditFailure({ crossPartitionSubject: true }, 'commit_subject_not_functional');
  });

  it('rejects lifecycle-only commit subjects', () => {
    const fixture = expectAuditFailure({ invalidSubject: true }, 'commit_subject_not_functional');
    expect(fs.existsSync(path.join(fixture.finalOut, 'task-report.json'))).toBe(false);
  });

  it('rejects opaque or title-only subjects and lifecycle-only functional outcomes', () => {
    expectAuditFailure({ opaqueSubject: true }, 'commit_subject_not_functional');
    expectAuditFailure({ titleOnlySubject: true }, 'commit_subject_not_functional');
    expectAuditFailure(
      { invalidFunctionalOutcome: true },
      'commit_functional_outcome_not_specific'
    );
    expectAuditFailure({ englishLifecycleSubject: true }, 'commit_subject_not_functional');
    expectAuditFailure({ englishLifecycleOutcome: true }, 'commit_functional_outcome_not_specific');
    expectAuditFailure({ idImplementationSubject: true }, 'commit_subject_not_functional');
    expectAuditFailure({ idImplementationOutcome: true }, 'commit_functional_outcome_not_specific');
  });

  it('requires a unique terminal Git trailer block', () => {
    expectAuditFailure({ narrativeFunctionalOutcome: true }, 'commit_trailers_incomplete');
    expectAuditFailure({ duplicateFunctionalOutcome: true }, 'commit_trailers_ambiguous');
    expectAuditFailure({ narrativeDuplicateFunctionalOutcome: true }, 'commit_trailers_ambiguous');
    expectAuditFailure({ blankAffectedScope: true }, 'commit_trailers_incomplete');
    expectAuditFailure({ extraValidationTrailer: true }, 'commit_trailers_mismatch');
    expectAuditFailure(
      { caseVariantDuplicateFunctionalOutcome: true },
      'commit_trailers_ambiguous'
    );
  });

  it('validates evidence and closure JSON against their bound schemas', () => {
    const invalidEvidence = prepareCampaign();
    const invalidEvidenceArtifacts = readArtifacts(invalidEvidence.artifactsPath);
    const evidencePath = path.join(
      invalidEvidence.root,
      invalidEvidenceArtifacts.childResults[0].evidence.path
    );
    writeArtifacts(evidencePath, {});
    const invalidEvidenceHash = hashFile(evidencePath);
    invalidEvidenceArtifacts.childResults[0].evidence.hash = invalidEvidenceHash;
    invalidEvidenceArtifacts.childResults[0].validationResults[0].evidence.hash =
      invalidEvidenceHash;
    writeArtifacts(invalidEvidence.artifactsPath, invalidEvidenceArtifacts);
    const invalidEvidenceResult = audit(
      invalidEvidence.packageA,
      invalidEvidence.artifactsPath,
      invalidEvidence.finalOut,
      invalidEvidence.packageManifestHash
    );
    expectAuditResultFailure(invalidEvidenceResult, 'child_evidence_schema_invalid');

    const invalidClosure = prepareCampaign();
    const invalidClosureArtifacts = readArtifacts(invalidClosure.artifactsPath);
    const closurePath = path.join(
      invalidClosure.root,
      invalidClosureArtifacts.childResults[0].closure.path
    );
    writeArtifacts(closurePath, {});
    invalidClosureArtifacts.childResults[0].closure.hash = hashFile(closurePath);
    writeArtifacts(invalidClosure.artifactsPath, invalidClosureArtifacts);
    const invalidClosureResult = audit(
      invalidClosure.packageA,
      invalidClosure.artifactsPath,
      invalidClosure.finalOut,
      invalidClosure.packageManifestHash
    );
    expectAuditResultFailure(invalidClosureResult, 'child_closure_schema_invalid');
  });

  it('rejects stale evidence and unreachable commits', () => {
    const stale = prepareCampaign();
    fs.appendFileSync(
      path.join(stale.root, 'campaign-evidence/AUTH-02-evidence.json'),
      '\nstale\n',
      'utf8'
    );
    const staleResult = audit(
      stale.packageA,
      stale.artifactsPath,
      stale.finalOut,
      stale.packageManifestHash
    );
    expectAuditResultFailure(staleResult, 'child_evidence_hash_mismatch');

    const unreachable = prepareCampaign();
    const artifacts = JSON.parse(fs.readFileSync(unreachable.artifactsPath, 'utf8'));
    artifacts.childResults[1].commit.hash = 'f'.repeat(40);
    fs.writeFileSync(unreachable.artifactsPath, `${JSON.stringify(artifacts, null, 2)}\n`, 'utf8');
    const unreachableResult = audit(
      unreachable.packageA,
      unreachable.artifactsPath,
      unreachable.finalOut,
      unreachable.packageManifestHash
    );
    expectAuditResultFailure(unreachableResult, 'child_commit_not_reachable');
  });

  it('rejects incomplete child closure, validation, and commit proof', () => {
    const missingClosure = prepareCampaign();
    const missingClosureArtifacts = readArtifacts(missingClosure.artifactsPath);
    delete missingClosureArtifacts.childResults[0].closure;
    writeArtifacts(missingClosure.artifactsPath, missingClosureArtifacts);
    const missingClosureResult = audit(
      missingClosure.packageA,
      missingClosure.artifactsPath,
      missingClosure.finalOut,
      missingClosure.packageManifestHash
    );
    expectAuditResultFailure(missingClosureResult, 'child_closure_hash_mismatch');

    const missingValidation = prepareCampaign();
    const missingValidationArtifacts = readArtifacts(missingValidation.artifactsPath);
    missingValidationArtifacts.childResults[0].validationResults = [];
    writeArtifacts(missingValidation.artifactsPath, missingValidationArtifacts);
    const missingValidationResult = audit(
      missingValidation.packageA,
      missingValidation.artifactsPath,
      missingValidation.finalOut,
      missingValidation.packageManifestHash
    );
    expectAuditResultFailure(missingValidationResult, 'child_validation_incomplete');

    const missingCommitProof = prepareCampaign();
    const missingCommitArtifacts = readArtifacts(missingCommitProof.artifactsPath);
    delete missingCommitArtifacts.childResults[0].commit.changedPaths;
    writeArtifacts(missingCommitProof.artifactsPath, missingCommitArtifacts);
    const missingCommitResult = audit(
      missingCommitProof.packageA,
      missingCommitProof.artifactsPath,
      missingCommitProof.finalOut,
      missingCommitProof.packageManifestHash
    );
    expectAuditResultFailure(missingCommitResult, 'child_commit_set_invalid');
  });

  it('rejects parent mismatch, changed-path scope escape, and aggregate failure', () => {
    const parentMismatch = prepareCampaign();
    const parentArtifacts = readArtifacts(parentMismatch.artifactsPath);
    parentArtifacts.childResults[0].commit.parentHash = 'f'.repeat(40);
    writeArtifacts(parentMismatch.artifactsPath, parentArtifacts);
    const parentResult = audit(
      parentMismatch.packageA,
      parentMismatch.artifactsPath,
      parentMismatch.finalOut,
      parentMismatch.packageManifestHash
    );
    expectAuditResultFailure(parentResult, 'child_commit_binding_mismatch');
    expectAuditFailure({ mergeCommit: true }, 'child_commit_parent_mismatch');
    expectAuditFailure({ scopeEscape: true }, 'child_commit_scope_escape');
    expectAuditFailure({ renameScopeEscape: true }, 'child_commit_scope_escape');

    const aggregateFailure = prepareCampaign();
    const aggregateArtifacts = readArtifacts(aggregateFailure.artifactsPath);
    aggregateArtifacts.collectionVerificationResults[0].status = 'fail';
    writeArtifacts(aggregateFailure.artifactsPath, aggregateArtifacts);
    const aggregateResult = audit(
      aggregateFailure.packageA,
      aggregateFailure.artifactsPath,
      aggregateFailure.finalOut,
      aggregateFailure.packageManifestHash
    );
    expectAuditResultFailure(aggregateResult, 'collection_verification_incomplete');
    expect(fs.existsSync(path.join(aggregateFailure.finalOut, 'task-report.json'))).toBe(false);
  });

  it('rejects post-closure drift on child-owned paths and allows unrelated commits', () => {
    for (const options of [
      { postChildOwnedCommit: true },
      { stagedOwnedDrift: true },
      { worktreeOwnedDrift: true },
    ] satisfies CampaignFixtureOptions[]) {
      expectAuditFailure(options, 'child_owned_path_drift');
    }

    const unrelated = prepareCampaign({ postUnrelatedCommit: true });
    const unrelatedResult = audit(
      unrelated.packageA,
      unrelated.artifactsPath,
      unrelated.finalOut,
      unrelated.packageManifestHash
    );
    expect(unrelatedResult.status, unrelatedResult.stderr || unrelatedResult.stdout).toBe(0);
  });

  it('does not expose done outputs when final publication conflicts', () => {
    const fixture = prepareCampaign();
    fs.mkdirSync(fixture.finalOut, { recursive: true });
    fs.writeFileSync(
      path.join(fixture.finalOut, 'main-agent-handoff.json'),
      '{"conflict":true}\n',
      'utf8'
    );

    const result = audit(
      fixture.packageA,
      fixture.artifactsPath,
      fixture.finalOut,
      fixture.packageManifestHash
    );

    expectAuditResultFailure(result, 'package_output_conflict');
    expect(fs.existsSync(path.join(fixture.finalOut, 'task-report.json'))).toBe(false);
    expect(fs.existsSync(path.join(fixture.finalOut, 'campaign-audit-report.json'))).toBe(false);
  });
});
