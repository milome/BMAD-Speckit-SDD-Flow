import Ajv2020 from 'ajv/dist/2020.js';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
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

const require = createRequire(import.meta.url);
const {
  auditCompletedCampaign,
  auditCompletedChild,
  prepareCompletedCampaignAuditContext,
} = require('../../_bmad/skills/goal-subcontract-execution-package-generator/scripts/audit-completed-campaign.js');
const buildExecutionPackageModule = require('../../_bmad/skills/goal-subcontract-execution-package-generator/scripts/build-execution-package.js');

afterEach(cleanupFixtures);

function audit(
  packageRoot: string,
  artifactsPath: string,
  out: string,
  expectedPackageManifestHash: string,
  repairTrust?: {
    repairAuthorityHash: string;
    repairAuthorityPath: string;
    finalValidationHash: string;
  }
) {
  const args = [
    '--package',
    packageRoot,
    '--expected-package-manifest-hash',
    expectedPackageManifestHash,
    '--artifacts',
    artifactsPath,
    '--out',
    out,
    '--json',
  ];
  if (repairTrust) {
    args.push(
      '--expected-repair-authority-artifact-hash',
      repairTrust.repairAuthorityHash,
      '--expected-repair-authority-path',
      repairTrust.repairAuthorityPath,
      '--expected-final-validation-artifact-hash',
      repairTrust.finalValidationHash,
      '--expected-final-validation-command-ids',
      'CMD-MA-GS-T09-05,CMD-MA-GS-T09-08'
    );
  }
  return runScript('audit-completed-campaign.js', args);
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

function signedReceipt(core: Record<string, unknown>) {
  return {
    ...core,
    receiptHash: buildExecutionPackageModule.sha256(
      JSON.stringify(JSON.parse(buildExecutionPackageModule.stableJson(core)))
    ),
  };
}

function writeBoundJson(root: string, relativePath: string, value: unknown) {
  const filePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  writeArtifacts(filePath, value);
  return { path: relativePath, hash: hashFile(filePath) };
}

function prepareRepairAuditScenario() {
  const fixture = prepareCampaign({ canonicalPartitionIds: true });
  const artifacts = readArtifacts(fixture.artifactsPath);
  const packageManifest = readArtifacts(path.join(fixture.packageA, 'package-manifest.json'));
  const preservedResult = artifacts.childResults[0];
  const repairedResult = artifacts.childResults[1];
  const repairedChild = fixture.children[1];

  git(fixture.root, ['reset', '--hard', preservedResult.commit.hash]);
  git(fixture.root, [
    'commit',
    '--quiet',
    '--allow-empty',
    '-m',
    'chore(goal-campaign): authorize bounded repair replay',
  ]);
  const amendmentCommitHash = git(fixture.root, ['rev-parse', 'HEAD']);
  fs.appendFileSync(
    path.join(fixture.root, repairedChild.ownedPath),
    `export const repaired = '${repairedChild.partitionId}';\n`,
    'utf8'
  );
  git(fixture.root, ['add', '--', repairedChild.ownedPath]);
  git(fixture.root, [
    'commit',
    '--quiet',
    '-m',
    repairedResult.commit.subject,
    '-m',
    [
      'Functional-Outcome: 刷新凭据轮换后立即撤销旧刷新令牌',
      'Affected-Scope: authentication refresh flow',
      `Child-Contract: ${repairedChild.partitionId}`,
      `Contract-Hash: ${repairedChild.hash}`,
      `Evidence: ${repairedResult.evidence.path}#${repairedResult.evidence.hash}`,
      `Validation: CMD-${repairedChild.partitionId}`,
    ].join('\n'),
  ]);
  const repairedCommitHash = git(fixture.root, ['rev-parse', 'HEAD']);
  repairedResult.commit = {
    hash: repairedCommitHash,
    parentHash: amendmentCommitHash,
    treeHash: git(fixture.root, ['rev-parse', `${repairedCommitHash}^{tree}`]),
    subject: repairedResult.commit.subject,
    changedPaths: [repairedChild.ownedPath],
  };

  git(fixture.root, ['reset', '--hard', amendmentCommitHash]);
  fs.appendFileSync(
    path.join(fixture.root, repairedChild.ownedPath),
    `export const repaired = '${repairedChild.partitionId}';\n`,
    'utf8'
  );
  git(fixture.root, ['add', '--', repairedChild.ownedPath]);
  git(fixture.root, [
    'commit',
    '--quiet',
    '-m',
    'fix(auth): integrate repaired child output into validated head',
  ]);
  const finalHead = git(fixture.root, ['rev-parse', 'HEAD']);
  const baseAttemptId = 'attempt-campaign-audit-001';
  const repairAttemptId = 'repair-attempt-campaign-audit-001';
  const preservedClosure = signedReceipt({
    schemaVersion: 'goal-contract-subcontract-closure-receipt/v1',
    attemptId: baseAttemptId,
    partitionId: preservedResult.partitionId,
    childContractHash: fixture.children[0].hash,
    predecessorClosureReceiptHashes: [],
    decision: 'pass',
  });
  const repairedClosure = signedReceipt({
    schemaVersion: 'goal-contract-subcontract-closure-receipt/v1',
    attemptId: repairAttemptId,
    partitionId: repairedResult.partitionId,
    childContractHash: repairedChild.hash,
    predecessorClosureReceiptHashes: [preservedClosure.receiptHash],
    decision: 'pass',
  });
  const effectiveClosureReceipts = [
    writeBoundJson(
      fixture.root,
      'campaign-evidence/control-plane/base/AUTH-01.receipt.json',
      preservedClosure
    ),
    writeBoundJson(
      fixture.root,
      'campaign-evidence/control-plane/repair/AUTH-02.receipt.json',
      repairedClosure
    ),
  ];
  const campaignActivationHash = `sha256:${'a'.repeat(64)}`;
  const repairAuthorization = {
    authorizerIdentity: 'main-agent:controlled-repair',
    authorizationKind: 'main_agent_controlled_dispatch',
    authorizationSourceHash: `sha256:${'b'.repeat(64)}`,
    authorizationStatementHash: `sha256:${'c'.repeat(64)}`,
  };
  const repairAuthority = signedReceipt({
    schemaVersion: 'goal-contract-campaign-repair-authority-receipt/v1',
    campaignId: `goal-campaign-${campaignActivationHash.slice(7)}`,
    campaignActivationHash,
    baseActivationReceiptHash: `sha256:${'d'.repeat(64)}`,
    baseAttemptId,
    repairAttemptId,
    basePartitionManifestDocumentHash: packageManifest.partitionManifest.hash,
    partitionManifestHash: packageManifest.partitionManifest.partitionManifestHash,
    partitionPlanHash: `sha256:${'e'.repeat(64)}`,
    partitionSetHash: `sha256:${'f'.repeat(64)}`,
    sourceCompositionPolicyHash: `sha256:${'1'.repeat(64)}`,
    sourceAuthorityBundleHash: `sha256:${'2'.repeat(64)}`,
    baselineAuthority: { sourceCompositionMode: 'single_source' },
    currentAuthority: { sourceCompositionMode: 'single_source' },
    changedPaths: [repairedChild.ownedPath],
    campaignWide: false,
    changedAuthorityFields: [],
    invalidationDecision: 'selective_invalidation',
    preservedPartitionIds: [preservedResult.partitionId],
    invalidatedPartitionIds: [repairedResult.partitionId],
    baseChildReleaseBindings: fixture.children.map((child, index) => ({
      ordinal: index + 1,
      partitionId: child.partitionId,
      childReleaseReceiptHash: `sha256:${String(index + 3).repeat(64)}`,
    })),
    preservedClosureBindings: [
      {
        ordinal: 1,
        partitionId: preservedResult.partitionId,
        closureReceiptHash: preservedClosure.receiptHash,
      },
    ],
    invalidatedLeaseBindings: [
      {
        ordinal: 2,
        partitionId: repairedResult.partitionId,
        leaseReceiptHash: `sha256:${'6'.repeat(64)}`,
      },
    ],
    invalidatedClosureBindings: [
      {
        ordinal: 2,
        partitionId: repairedResult.partitionId,
        closureReceiptHash: repairedClosure.receiptHash,
        subcontractEvidenceHash: repairedResult.evidence.hash,
      },
    ],
    governedPathAdditions: [],
    repairAuthorization,
    repairAuthorizationHash: buildExecutionPackageModule.sha256(
      JSON.stringify(JSON.parse(buildExecutionPackageModule.stableJson(repairAuthorization)))
    ),
    authorizationCount: 1,
    modelInvocationCount: 0,
    createdAt: '2026-08-07T00:00:00.000Z',
    decision: 'pass',
  });
  const repairAuthorityBinding = writeBoundJson(
    fixture.root,
    `campaign-evidence/control-plane/campaigns/${repairAuthority.campaignId}/repair/authority.receipt.json`,
    repairAuthority
  );
  const chainAnchor = signedReceipt({
    schemaVersion: 'goal-subcontract-repair-chain-anchor/v1',
    repairAttemptId,
    amendmentCommitHash,
    parentCommitHash: preservedResult.commit.hash,
    treeHash: git(fixture.root, ['rev-parse', `${amendmentCommitHash}^{tree}`]),
    subject: git(fixture.root, ['show', '-s', '--format=%s', amendmentCommitHash]),
    repairAuthorityReceiptHash: repairAuthority.receiptHash,
    decision: 'pass',
  });
  const chainAnchorBinding = writeBoundJson(
    fixture.root,
    'campaign-evidence/repair-chain-anchor.receipt.json',
    chainAnchor
  );
  const repairClosureSetHash = buildExecutionPackageModule.sha256(
    buildExecutionPackageModule.stableJson([
      {
        partitionId: preservedResult.partitionId,
        attemptId: baseAttemptId,
        path: effectiveClosureReceipts[0].path,
        closureReceiptHash: preservedClosure.receiptHash,
        artifactHash: effectiveClosureReceipts[0].hash,
      },
      {
        partitionId: repairedResult.partitionId,
        attemptId: repairAttemptId,
        path: effectiveClosureReceipts[1].path,
        closureReceiptHash: repairedClosure.receiptHash,
        artifactHash: effectiveClosureReceipts[1].hash,
      },
    ])
  );
  const ownedPathBindings = fixture.children
    .map((child) => ({
      path: child.ownedPath,
      blobHash: git(fixture.root, ['rev-parse', `${finalHead}:${child.ownedPath}`]),
    }))
    .sort((left, right) => left.path.localeCompare(right.path));
  const ownedPathSetHash = buildExecutionPackageModule.sha256(
    buildExecutionPackageModule.stableJson(ownedPathBindings)
  );
  const postChildCommitHashes = [finalHead];
  const postChildCommitSetHash = buildExecutionPackageModule.sha256(
    buildExecutionPackageModule.stableJson(postChildCommitHashes)
  );
  const validationCommands = [
    {
      id: 'CMD-MA-GS-T09-05',
      schemaVersion: 'ma-gs-t09-05-attempt/v1',
    },
    {
      id: 'CMD-MA-GS-T09-08',
      schemaVersion: 'ma-gs-t09-08-attempt/v1',
    },
  ];
  const validationEvidence = validationCommands.map(({ id, schemaVersion }) =>
    writeBoundJson(fixture.root, `campaign-evidence/final-validation-${id.toLowerCase()}.json`, {
      schemaVersion,
      taskId: 'MA-GS-T09',
      commandId: id,
      boundHead: finalHead,
      decision: 'pass',
    })
  );
  const finalValidationBinding = writeBoundJson(
    fixture.root,
    'campaign-evidence/final-validation.receipt.json',
    signedReceipt({
      schemaVersion: 'goal-subcontract-repair-final-validation/v1',
      repairAttemptId,
      repairAuthorityReceiptHash: repairAuthority.receiptHash,
      repairClosureSetHash,
      boundHead: finalHead,
      boundTree: git(fixture.root, ['rev-parse', `${finalHead}^{tree}`]),
      unreachableChildCommitHashes: [repairedCommitHash],
      parentDiscontinuities: [],
      ownedPathBindings,
      ownedPathSetHash,
      postChildCommitHashes,
      postChildCommitSetHash,
      validationResults: [
        {
          id: validationCommands[0].id,
          evidenceSchemaVersion: validationCommands[0].schemaVersion,
          status: 'pass',
          evidence: validationEvidence[0],
        },
        {
          id: validationCommands[1].id,
          evidenceSchemaVersion: validationCommands[1].schemaVersion,
          status: 'pass',
          evidence: validationEvidence[1],
        },
      ],
      repositoryState: { head: finalHead, stagedCount: 0 },
      decision: 'pass',
    })
  );
  artifacts.repairProvenance = {
    repairAuthority: repairAuthorityBinding,
    chainAnchor: chainAnchorBinding,
    effectiveClosureReceipts,
    finalValidation: finalValidationBinding,
  };
  writeArtifacts(fixture.artifactsPath, artifacts);
  return {
    fixture,
    artifacts,
    baseAttemptId,
    repairAttemptId,
    repairAuthority,
    repairAuthorityBinding,
    effectiveClosureReceipts,
    finalValidationBinding,
    finalHead,
    repairedCommitHash,
  };
}

describe('goal subcontract completed campaign audit', () => {
  it('rejects an empty manifest child set before auditing repository state', () => {
    expectAuditResultFailure(auditWithManifest({ children: [] }), 'child_result_set_incomplete');
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

  it('does not expose scope fuse calculations from the package compiler', () => {
    expect(buildExecutionPackageModule).not.toHaveProperty('computeScopeBudget');
    expect(buildExecutionPackageModule).not.toHaveProperty('evaluateScopeBudgetCounts');
    expect(buildExecutionPackageModule).not.toHaveProperty('exportedNames');
  });

  it('audits one completed child through the same hash-bound seam used by aggregate audit', () => {
    const fixture = prepareCampaign();
    const artifacts = readArtifacts(fixture.artifactsPath);
    const context = prepareCompletedCampaignAuditContext(
      fixture.packageA,
      fixture.packageManifestHash
    );
    const result = auditCompletedChild({
      context,
      childIndex: 0,
      result: artifacts.childResults[0],
      expectedParent: context.manifest.repositoryBaseline.headCommit,
      priorCommitHashes: [],
    });

    expect(result.auditReceipt).toMatchObject({
      schemaVersion: 'goal-subcontract-completed-child-audit/v1',
      packageManifestHash: fixture.packageManifestHash,
      partitionId: 'AUTH-01',
      childContractHash: fixture.children[0].hash,
      childIndex: 0,
      commitHash: artifacts.childResults[0].commit.hash,
      decision: 'pass',
    });
    expect(result.auditReceipt.receiptHash).toMatch(/^sha256:[a-f0-9]{64}$/u);
  });

  it('rejects the legacy contractHash and status closure shape at the child audit seam', () => {
    const fixture = prepareCampaign();
    const artifacts = readArtifacts(fixture.artifactsPath);
    const context = prepareCompletedCampaignAuditContext(
      fixture.packageA,
      fixture.packageManifestHash
    );
    const closurePath = path.join(fixture.root, artifacts.childResults[0].closure.path);
    writeArtifacts(closurePath, {
      partitionId: 'AUTH-01',
      contractHash: fixture.children[0].hash,
      status: 'closed',
    });
    artifacts.childResults[0].closure.hash = hashFile(closurePath);

    expect(() =>
      auditCompletedChild({
        context,
        childIndex: 0,
        result: artifacts.childResults[0],
        expectedParent: context.manifest.repositoryBaseline.headCommit,
        priorCommitHashes: [],
      })
    ).toThrow(
      expect.objectContaining({
        failureClass: 'child_closure_schema_invalid',
      })
    );
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

  it('audits a repaired suffix from an authorized repair chain anchor', () => {
    const {
      fixture,
      repairAttemptId,
      repairAuthority,
      repairAuthorityBinding,
      finalValidationBinding,
      finalHead,
      repairedCommitHash,
    } = prepareRepairAuditScenario();

    expect(git(fixture.root, ['branch', '--contains', repairedCommitHash])).toBe('');
    expect(git(fixture.root, ['rev-parse', 'HEAD'])).toBe(finalHead);

    const result = audit(
      fixture.packageA,
      fixture.artifactsPath,
      fixture.finalOut,
      fixture.packageManifestHash,
      {
        repairAuthorityHash: repairAuthorityBinding.hash,
        repairAuthorityPath: repairAuthorityBinding.path,
        finalValidationHash: finalValidationBinding.hash,
      }
    );

    expect(result.status, result.stderr || result.stdout).toBe(0);
    const report = readArtifacts(path.join(fixture.finalOut, 'task-report.json'));
    const finalValidation = readArtifacts(path.join(fixture.root, finalValidationBinding.path));
    expect(report).toMatchObject({
      repairAttemptId,
      repairAuthorityReceiptHash: repairAuthority.receiptHash,
      repairAuthorityArtifactHash: repairAuthorityBinding.hash,
      finalValidationHead: finalHead,
      finalValidationReceiptHash: finalValidation.receiptHash,
      finalValidationArtifactHash: finalValidationBinding.hash,
      aggregateAuditDecision: 'pass',
    });
    expect(report.repairClosureSetHash).toMatch(/^sha256:[a-f0-9]{64}$/u);
  });

  it('rejects a repaired closure set with a stale predecessor receipt hash', () => {
    const {
      fixture,
      artifacts,
      effectiveClosureReceipts,
      repairAuthorityBinding,
      finalValidationBinding,
    } = prepareRepairAuditScenario();
    const repairedClosurePath = path.join(fixture.root, effectiveClosureReceipts[1].path);
    const repairedClosure = readArtifacts(repairedClosurePath);
    const staleClosure = signedReceipt({
      ...Object.fromEntries(
        Object.entries(repairedClosure).filter(([key]) => key !== 'receiptHash')
      ),
      predecessorClosureReceiptHashes: [`sha256:${'f'.repeat(64)}`],
    });
    writeArtifacts(repairedClosurePath, staleClosure);
    artifacts.repairProvenance.effectiveClosureReceipts[1].hash = hashFile(repairedClosurePath);
    writeArtifacts(fixture.artifactsPath, artifacts);

    const result = audit(
      fixture.packageA,
      fixture.artifactsPath,
      fixture.finalOut,
      fixture.packageManifestHash,
      {
        repairAuthorityHash: repairAuthorityBinding.hash,
        repairAuthorityPath: repairAuthorityBinding.path,
        finalValidationHash: finalValidationBinding.hash,
      }
    );

    expect(result.status).toBe(1);
    expect(JSON.parse(result.stdout).failureClass).toBe(
      'campaign_repair_predecessor_closure_stale'
    );
  });

  it('rejects repair provenance when final validation does not bind current HEAD', () => {
    const { fixture, artifacts, repairAuthorityBinding, finalValidationBinding } =
      prepareRepairAuditScenario();
    git(fixture.root, [
      'commit',
      '--quiet',
      '--allow-empty',
      '-m',
      'chore(goal-campaign): advance beyond validated head',
    ]);
    artifacts.repairProvenance.finalValidation = finalValidationBinding;
    writeArtifacts(fixture.artifactsPath, artifacts);

    const result = audit(
      fixture.packageA,
      fixture.artifactsPath,
      fixture.finalOut,
      fixture.packageManifestHash,
      {
        repairAuthorityHash: repairAuthorityBinding.hash,
        repairAuthorityPath: repairAuthorityBinding.path,
        finalValidationHash: finalValidationBinding.hash,
      }
    );

    expect(result.status).toBe(1);
    expect(JSON.parse(result.stdout).failureClass).toBe('campaign_repair_final_validation_stale');
  });

  it('rejects repair artifacts without external trust-root hashes', () => {
    const { fixture } = prepareRepairAuditScenario();

    const result = audit(
      fixture.packageA,
      fixture.artifactsPath,
      fixture.finalOut,
      fixture.packageManifestHash
    );

    expect(result.status).toBe(1);
    expect(JSON.parse(result.stdout).failureClass).toBe('campaign_repair_trust_binding_missing');
  });

  it('rejects repair artifacts that do not match the external trust-root hashes', () => {
    const { fixture, repairAuthorityBinding } = prepareRepairAuditScenario();

    const result = audit(
      fixture.packageA,
      fixture.artifactsPath,
      fixture.finalOut,
      fixture.packageManifestHash,
      {
        repairAuthorityHash: repairAuthorityBinding.hash,
        repairAuthorityPath: repairAuthorityBinding.path,
        finalValidationHash: `sha256:${'f'.repeat(64)}`,
      }
    );

    expect(result.status).toBe(1);
    expect(JSON.parse(result.stdout).failureClass).toBe('campaign_repair_trust_binding_mismatch');
  });

  it('rejects a repair authority outside its canonical campaign path', () => {
    const { fixture, artifacts, repairAuthority, finalValidationBinding } =
      prepareRepairAuditScenario();
    const noncanonicalBinding = writeBoundJson(
      fixture.root,
      'campaign-evidence/noncanonical-repair-authority.receipt.json',
      repairAuthority
    );
    artifacts.repairProvenance.repairAuthority = noncanonicalBinding;
    writeArtifacts(fixture.artifactsPath, artifacts);

    const result = audit(
      fixture.packageA,
      fixture.artifactsPath,
      fixture.finalOut,
      fixture.packageManifestHash,
      {
        repairAuthorityHash: noncanonicalBinding.hash,
        repairAuthorityPath: noncanonicalBinding.path,
        finalValidationHash: finalValidationBinding.hash,
      }
    );

    expect(result.status).toBe(1);
    expect(JSON.parse(result.stdout).failureClass).toBe('campaign_repair_authority_path_invalid');
  });

  it('rejects repair authority that does not satisfy the canonical schema', () => {
    const { fixture, artifacts, repairAuthority, repairAuthorityBinding, finalValidationBinding } =
      prepareRepairAuditScenario();
    const authorityPath = path.join(fixture.root, repairAuthorityBinding.path);
    const invalidAuthority = signedReceipt(
      Object.fromEntries(
        Object.entries(repairAuthority).filter(
          ([key]) => key !== 'campaignActivationHash' && key !== 'receiptHash'
        )
      )
    );
    writeArtifacts(authorityPath, invalidAuthority);
    artifacts.repairProvenance.repairAuthority.hash = hashFile(authorityPath);
    writeArtifacts(fixture.artifactsPath, artifacts);

    const result = audit(
      fixture.packageA,
      fixture.artifactsPath,
      fixture.finalOut,
      fixture.packageManifestHash,
      {
        repairAuthorityHash: hashFile(authorityPath),
        repairAuthorityPath: repairAuthorityBinding.path,
        finalValidationHash: finalValidationBinding.hash,
      }
    );

    expect(result.status).toBe(1);
    expect(JSON.parse(result.stdout).failureClass).toBe('campaign_repair_authority_invalid');
  });

  it('rejects reused evidence across final validation commands', () => {
    const { fixture, artifacts, repairAuthorityBinding, finalValidationBinding } =
      prepareRepairAuditScenario();
    const finalValidationPath = path.join(fixture.root, finalValidationBinding.path);
    const finalValidation = readArtifacts(finalValidationPath);
    finalValidation.validationResults[1].evidence = finalValidation.validationResults[0].evidence;
    const reboundFinalValidation = signedReceipt(
      Object.fromEntries(Object.entries(finalValidation).filter(([key]) => key !== 'receiptHash'))
    );
    writeArtifacts(finalValidationPath, reboundFinalValidation);
    artifacts.repairProvenance.finalValidation.hash = hashFile(finalValidationPath);
    writeArtifacts(fixture.artifactsPath, artifacts);

    const result = audit(
      fixture.packageA,
      fixture.artifactsPath,
      fixture.finalOut,
      fixture.packageManifestHash,
      {
        repairAuthorityHash: repairAuthorityBinding.hash,
        repairAuthorityPath: repairAuthorityBinding.path,
        finalValidationHash: hashFile(finalValidationPath),
      }
    );

    expect(result.status).toBe(1);
    expect(JSON.parse(result.stdout).failureClass).toBe('campaign_repair_final_validation_invalid');
  });

  it('rejects owned-path drift introduced immediately before publication', () => {
    const { fixture, repairAuthorityBinding, finalValidationBinding } =
      prepareRepairAuditScenario();

    expect(() =>
      auditCompletedCampaign({
        packageRoot: fixture.packageA,
        expectedPackageManifestHash: fixture.packageManifestHash,
        artifactsPath: fixture.artifactsPath,
        outputRoot: fixture.finalOut,
        expectedRepairAuthorityArtifactHash: repairAuthorityBinding.hash,
        expectedRepairAuthorityPath: repairAuthorityBinding.path,
        expectedFinalValidationArtifactHash: finalValidationBinding.hash,
        expectedValidationCommandIds: ['CMD-MA-GS-T09-05', 'CMD-MA-GS-T09-08'],
        beforePublish: () => {
          fs.appendFileSync(
            path.join(fixture.root, fixture.children[0].ownedPath),
            '\n// concurrent owned-path drift\n',
            'utf8'
          );
        },
      })
    ).toThrow(
      expect.objectContaining({
        failureClass: 'campaign_repair_repository_state_changed',
      })
    );
  });

  it('rejects externally bound final validation with a stale self-hash', () => {
    const { fixture, artifacts, repairAuthorityBinding, finalValidationBinding } =
      prepareRepairAuditScenario();
    const finalValidationPath = path.join(fixture.root, finalValidationBinding.path);
    const finalValidation = readArtifacts(finalValidationPath);
    finalValidation.boundTree = 'f'.repeat(40);
    writeArtifacts(finalValidationPath, finalValidation);
    artifacts.repairProvenance.finalValidation.hash = hashFile(finalValidationPath);
    writeArtifacts(fixture.artifactsPath, artifacts);

    const result = audit(
      fixture.packageA,
      fixture.artifactsPath,
      fixture.finalOut,
      fixture.packageManifestHash,
      {
        repairAuthorityHash: repairAuthorityBinding.hash,
        repairAuthorityPath: repairAuthorityBinding.path,
        finalValidationHash: hashFile(finalValidationPath),
      }
    );

    expect(result.status).toBe(1);
    expect(JSON.parse(result.stdout).failureClass).toBe(
      'campaign_repair_final_validation_self_hash_mismatch'
    );
  });

  it('rejects final validation evidence bound to a stale HEAD', () => {
    const { fixture, artifacts, repairAuthorityBinding, finalValidationBinding } =
      prepareRepairAuditScenario();
    const finalValidationPath = path.join(fixture.root, finalValidationBinding.path);
    const finalValidation = readArtifacts(finalValidationPath);
    const evidenceBinding = finalValidation.validationResults[0].evidence;
    const evidencePath = path.join(fixture.root, evidenceBinding.path);
    const evidence = readArtifacts(evidencePath);
    writeArtifacts(evidencePath, { ...evidence, boundHead: 'f'.repeat(40) });
    finalValidation.validationResults[0].evidence.hash = hashFile(evidencePath);
    const reboundFinalValidation = signedReceipt(
      Object.fromEntries(Object.entries(finalValidation).filter(([key]) => key !== 'receiptHash'))
    );
    writeArtifacts(finalValidationPath, reboundFinalValidation);
    artifacts.repairProvenance.finalValidation.hash = hashFile(finalValidationPath);
    writeArtifacts(fixture.artifactsPath, artifacts);

    const result = audit(
      fixture.packageA,
      fixture.artifactsPath,
      fixture.finalOut,
      fixture.packageManifestHash,
      {
        repairAuthorityHash: repairAuthorityBinding.hash,
        repairAuthorityPath: repairAuthorityBinding.path,
        finalValidationHash: hashFile(finalValidationPath),
      }
    );

    expect(result.status).toBe(1);
    expect(JSON.parse(result.stdout).failureClass).toBe('campaign_repair_final_validation_stale');
  });

  it('rejects final validation with stale audited owned-path blobs', () => {
    const { fixture, artifacts, repairAuthorityBinding, finalValidationBinding } =
      prepareRepairAuditScenario();
    const finalValidationPath = path.join(fixture.root, finalValidationBinding.path);
    const finalValidation = readArtifacts(finalValidationPath);
    const staleOwnedPathBindings = finalValidation.ownedPathBindings.map(
      (binding: { path: string; blobHash: string }, index: number) =>
        index === 1 ? { ...binding, blobHash: 'f'.repeat(40) } : binding
    );
    const staleFinalValidation = signedReceipt({
      ...Object.fromEntries(
        Object.entries(finalValidation).filter(([key]) => key !== 'receiptHash')
      ),
      ownedPathBindings: staleOwnedPathBindings,
      ownedPathSetHash: buildExecutionPackageModule.sha256(
        buildExecutionPackageModule.stableJson(staleOwnedPathBindings)
      ),
    });
    writeArtifacts(finalValidationPath, staleFinalValidation);
    artifacts.repairProvenance.finalValidation.hash = hashFile(finalValidationPath);
    writeArtifacts(fixture.artifactsPath, artifacts);

    const result = audit(
      fixture.packageA,
      fixture.artifactsPath,
      fixture.finalOut,
      fixture.packageManifestHash,
      {
        repairAuthorityHash: repairAuthorityBinding.hash,
        repairAuthorityPath: repairAuthorityBinding.path,
        finalValidationHash: hashFile(finalValidationPath),
      }
    );

    expect(result.status).toBe(1);
    expect(JSON.parse(result.stdout).failureClass).toBe('campaign_repair_final_validation_stale');
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

    expect(result.status).not.toBe(0);
    expect(JSON.parse(result.stdout).failureClass).toBe('expected_package_manifest_hash_missing');
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

  it('rejects lifecycle-only commit subjects', () => {
    const fixture = prepareCampaign({ invalidSubject: true });
    const result = audit(
      fixture.packageA,
      fixture.artifactsPath,
      fixture.finalOut,
      fixture.packageManifestHash
    );

    expect(result.status).not.toBe(0);
    expect(JSON.parse(result.stdout).failureClass).toBe('commit_subject_not_functional');
    expect(fs.existsSync(path.join(fixture.finalOut, 'task-report.json'))).toBe(false);
  });

  it('rejects opaque or title-only subjects and lifecycle-only functional outcomes', () => {
    const opaque = prepareCampaign({ opaqueSubject: true });
    const opaqueResult = audit(
      opaque.packageA,
      opaque.artifactsPath,
      opaque.finalOut,
      opaque.packageManifestHash
    );
    expect(JSON.parse(opaqueResult.stdout).failureClass).toBe('commit_subject_not_functional');

    const titleOnly = prepareCampaign({ titleOnlySubject: true });
    const titleOnlyResult = audit(
      titleOnly.packageA,
      titleOnly.artifactsPath,
      titleOnly.finalOut,
      titleOnly.packageManifestHash
    );
    expect(JSON.parse(titleOnlyResult.stdout).failureClass).toBe('commit_subject_not_functional');

    const invalidOutcome = prepareCampaign({ invalidFunctionalOutcome: true });
    const invalidOutcomeResult = audit(
      invalidOutcome.packageA,
      invalidOutcome.artifactsPath,
      invalidOutcome.finalOut,
      invalidOutcome.packageManifestHash
    );
    expect(JSON.parse(invalidOutcomeResult.stdout).failureClass).toBe(
      'commit_functional_outcome_not_specific'
    );

    const englishSubject = prepareCampaign({ englishLifecycleSubject: true });
    const englishSubjectResult = audit(
      englishSubject.packageA,
      englishSubject.artifactsPath,
      englishSubject.finalOut,
      englishSubject.packageManifestHash
    );
    expect(JSON.parse(englishSubjectResult.stdout).failureClass).toBe(
      'commit_subject_not_functional'
    );

    const englishOutcome = prepareCampaign({ englishLifecycleOutcome: true });
    const englishOutcomeResult = audit(
      englishOutcome.packageA,
      englishOutcome.artifactsPath,
      englishOutcome.finalOut,
      englishOutcome.packageManifestHash
    );
    expect(JSON.parse(englishOutcomeResult.stdout).failureClass).toBe(
      'commit_functional_outcome_not_specific'
    );

    const idImplementationSubject = prepareCampaign({
      idImplementationSubject: true,
    });
    const idImplementationSubjectResult = audit(
      idImplementationSubject.packageA,
      idImplementationSubject.artifactsPath,
      idImplementationSubject.finalOut,
      idImplementationSubject.packageManifestHash
    );
    expect(JSON.parse(idImplementationSubjectResult.stdout).failureClass).toBe(
      'commit_subject_not_functional'
    );

    const idImplementationOutcome = prepareCampaign({
      idImplementationOutcome: true,
    });
    const idImplementationOutcomeResult = audit(
      idImplementationOutcome.packageA,
      idImplementationOutcome.artifactsPath,
      idImplementationOutcome.finalOut,
      idImplementationOutcome.packageManifestHash
    );
    expect(JSON.parse(idImplementationOutcomeResult.stdout).failureClass).toBe(
      'commit_functional_outcome_not_specific'
    );
  }, 30_000);

  it('requires a unique terminal Git trailer block', () => {
    const narrative = prepareCampaign({ narrativeFunctionalOutcome: true });
    const narrativeResult = audit(
      narrative.packageA,
      narrative.artifactsPath,
      narrative.finalOut,
      narrative.packageManifestHash
    );
    expect(JSON.parse(narrativeResult.stdout).failureClass).toBe('commit_trailers_incomplete');

    const duplicate = prepareCampaign({ duplicateFunctionalOutcome: true });
    const duplicateResult = audit(
      duplicate.packageA,
      duplicate.artifactsPath,
      duplicate.finalOut,
      duplicate.packageManifestHash
    );
    expect(JSON.parse(duplicateResult.stdout).failureClass).toBe('commit_trailers_ambiguous');

    const narrativeDuplicate = prepareCampaign({
      narrativeDuplicateFunctionalOutcome: true,
    });
    const narrativeDuplicateResult = audit(
      narrativeDuplicate.packageA,
      narrativeDuplicate.artifactsPath,
      narrativeDuplicate.finalOut,
      narrativeDuplicate.packageManifestHash
    );
    expect(JSON.parse(narrativeDuplicateResult.stdout).failureClass).toBe(
      'commit_trailers_ambiguous'
    );

    const blankScope = prepareCampaign({ blankAffectedScope: true });
    const blankScopeResult = audit(
      blankScope.packageA,
      blankScope.artifactsPath,
      blankScope.finalOut,
      blankScope.packageManifestHash
    );
    expect(JSON.parse(blankScopeResult.stdout).failureClass).toBe('commit_trailers_incomplete');

    const extraValidation = prepareCampaign({ extraValidationTrailer: true });
    const extraValidationResult = audit(
      extraValidation.packageA,
      extraValidation.artifactsPath,
      extraValidation.finalOut,
      extraValidation.packageManifestHash
    );
    expect(JSON.parse(extraValidationResult.stdout).failureClass).toBe('commit_trailers_mismatch');

    const caseVariantDuplicate = prepareCampaign({
      caseVariantDuplicateFunctionalOutcome: true,
    });
    const caseVariantDuplicateResult = audit(
      caseVariantDuplicate.packageA,
      caseVariantDuplicate.artifactsPath,
      caseVariantDuplicate.finalOut,
      caseVariantDuplicate.packageManifestHash
    );
    expect(JSON.parse(caseVariantDuplicateResult.stdout).failureClass).toBe(
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
    expect(JSON.parse(invalidEvidenceResult.stdout).failureClass).toBe(
      'child_evidence_schema_invalid'
    );

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
    expect(JSON.parse(invalidClosureResult.stdout).failureClass).toBe(
      'child_closure_schema_invalid'
    );
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
    expect(staleResult.status).not.toBe(0);
    expect(JSON.parse(staleResult.stdout).failureClass).toBe('child_evidence_hash_mismatch');

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
    expect(unreachableResult.status).not.toBe(0);
    expect(JSON.parse(unreachableResult.stdout).failureClass).toBe('child_commit_not_reachable');
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
    expect(JSON.parse(missingClosureResult.stdout).failureClass).toBe(
      'child_closure_hash_mismatch'
    );

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
    expect(JSON.parse(missingValidationResult.stdout).failureClass).toBe(
      'child_validation_incomplete'
    );

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
    expect(JSON.parse(missingCommitResult.stdout).failureClass).toBe('child_commit_set_invalid');
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
    expect(JSON.parse(parentResult.stdout).failureClass).toBe('child_commit_binding_mismatch');

    const mergeCommit = prepareCampaign({ mergeCommit: true });
    const mergeCommitResult = audit(
      mergeCommit.packageA,
      mergeCommit.artifactsPath,
      mergeCommit.finalOut,
      mergeCommit.packageManifestHash
    );
    expect(JSON.parse(mergeCommitResult.stdout).failureClass).toBe('child_commit_parent_mismatch');

    const scopeEscape = prepareCampaign({ scopeEscape: true });
    const scopeResult = audit(
      scopeEscape.packageA,
      scopeEscape.artifactsPath,
      scopeEscape.finalOut,
      scopeEscape.packageManifestHash
    );
    expect(JSON.parse(scopeResult.stdout).failureClass).toBe('child_commit_scope_escape');

    const renameScopeEscape = prepareCampaign({ renameScopeEscape: true });
    const renameScopeResult = audit(
      renameScopeEscape.packageA,
      renameScopeEscape.artifactsPath,
      renameScopeEscape.finalOut,
      renameScopeEscape.packageManifestHash
    );
    expect(JSON.parse(renameScopeResult.stdout).failureClass).toBe('child_commit_scope_escape');

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
    expect(JSON.parse(aggregateResult.stdout).failureClass).toBe(
      'collection_verification_incomplete'
    );
    expect(fs.existsSync(path.join(aggregateFailure.finalOut, 'task-report.json'))).toBe(false);
  });

  it('rejects post-closure drift on child-owned paths and allows unrelated commits', () => {
    for (const fixture of [
      prepareCampaign({ postChildOwnedCommit: true }),
      prepareCampaign({ stagedOwnedDrift: true }),
      prepareCampaign({ worktreeOwnedDrift: true }),
    ]) {
      const result = audit(
        fixture.packageA,
        fixture.artifactsPath,
        fixture.finalOut,
        fixture.packageManifestHash
      );
      expect(JSON.parse(result.stdout).failureClass).toBe('child_owned_path_drift');
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

    expect(result.status).not.toBe(0);
    expect(JSON.parse(result.stdout).failureClass).toBe('package_output_conflict');
    expect(fs.existsSync(path.join(fixture.finalOut, 'task-report.json'))).toBe(false);
    expect(fs.existsSync(path.join(fixture.finalOut, 'campaign-audit-report.json'))).toBe(false);
  });
});
