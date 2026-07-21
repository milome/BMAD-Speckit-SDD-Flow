import { createHash, randomUUID } from 'node:crypto';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import * as productionBypassMaterializer from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-production-bypass-evidence-materializer';
import { evaluateProductionBypassClosure } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-production-bypass-verifier';

const { materializeRequirementsContractProductionBypassEvidence } = productionBypassMaterializer;

const SOURCE_METRICS = {
  'checkpoint-semantic-validation-receipts.json': {
    checkpointReceiptWithoutSemanticValidatorCount: 0,
    checkpointSemanticValidatorCoverage: 1,
  },
  'checkpoint-progress-consistency-report.json': {
    blockedCheckpointMarkedCompletedCount: 0,
  },
  'source-prd-lint-state-transition-report.json': {
    sourcePrdLintBypassProgressionCount: 0,
  },
  'runtime-status-authority-report.json': {
    explicitSixModelStatusPassAuthorityCount: 0,
    architectureHashOnlyPassCount: 0,
  },
  'command-execution-receipt-bundle.json': {
    taskReportCommandSuccessSynthesisCount: 0,
    taskReportRequirementClosureCount: 0,
    commandIdSubstringCoverageCount: 0,
    commandReceiptCoverage: 1,
  },
  'evidence-artifact-readback-report.json': {
    missingArtifactAcceptedCount: 0,
    artifactCurrentAttemptMismatchCount: 0,
    artifactReadbackCoverage: 1,
  },
  'critical-auditor-independence-report.json': {
    syntheticCriticalAuditorNoGapCount: 0,
    criticalAuditorProviderIdentityMismatchCount: 0,
    criticalAuditorProjectionCoverage: 1,
  },
} as const;

const AGGREGATE_FILES = [
  ...Object.keys(SOURCE_METRICS),
  'current-dispatch-pointer-receipt.json',
] as const;
const REPORT_FILE = 'production-bypass-evidence-materializer-report.json';

type Fixture = ReturnType<typeof writeProductionEvidence>;

function sha256(value: Buffer | string): string {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

function writeJson(target: string, value: unknown): string {
  mkdirSync(path.dirname(target), { recursive: true });
  const bytes = `${JSON.stringify(value, null, 2)}\n`;
  writeFileSync(target, bytes, 'utf8');
  return sha256(bytes);
}

function readJson(target: string): Record<string, any> {
  return JSON.parse(readFileSync(target, 'utf8')) as Record<string, any>;
}

function writeProductionEvidence(
  root = mkdtempSync(path.join(tmpdir(), 'production-materializer-'))
) {
  const transactionId = `TX-${randomUUID()}`;
  const implementationAttemptId = `IMPL-ATTEMPT-${randomUUID()}`;
  const contractHash = sha256('contract');
  const sourceHash = sha256('source');
  const semanticModelHash = sha256('semantic-model');
  const evidenceRoot = path.join(root, 'materialized-evidence');
  const sourceRoot = path.join(root, 'production-evidence');
  const requirementRecordPath = path.join(root, 'authority', 'requirement-record.json');
  const attemptContextPath = path.join(root, 'authority', 'attempt-context.json');
  const pointerReceiptPath = path.join(root, 'authority', 'current-dispatch-pointer.json');
  const implementationEvidencePath = path.join(root, 'authority', 'implementation-evidence.json');
  const identity = {
    transactionId,
    implementationAttemptId,
    contractHash,
    sourceHash,
    semanticModelHash,
  };

  const requirementRecordHash = writeJson(requirementRecordPath, {
    schemaVersion: 'requirement-record/v1',
    transactionId,
    currentAttemptId: implementationAttemptId,
    contractHash,
    sourceHash,
    semanticModelHash,
  });
  const attemptContextHash = writeJson(attemptContextPath, {
    schemaVersion: 'goal-controlled-attempt-context/v1',
    ...identity,
    sourceHashBindings: { sourceDocumentHash: sourceHash },
    semanticModelHashBindings: { semanticModelHash },
    decision: 'non_pass_bootstrap_context',
  });
  const pointerReceiptHash = writeJson(pointerReceiptPath, {
    schemaVersion: 'requirements-contract-current-dispatch-pointer/v1',
    producer: 'requirements-contract-current-dispatch-pointer',
    action: 'requirements-contract-prompt-transaction-publish',
    ...identity,
    sourceDocumentHash: sourceHash,
    requirementRecordRef: { path: requirementRecordPath, hash: requirementRecordHash },
    attemptContextRef: { path: attemptContextPath, hash: attemptContextHash },
    selectionMetrics: {
      directoryScanCount: 0,
      newestFileSelectionCount: 0,
      historicalFallbackCount: 0,
      missingBindingCount: 0,
      replayRejectedCount: 0,
      casMismatchCount: 0,
      currentDispatchPointerCoverage: 1,
    },
    decision: 'PASS',
  });

  const sourcePaths: Record<string, string> = {};
  const aggregateSources = Object.entries(SOURCE_METRICS).map(([aggregateFile, metrics], index) => {
    const sourcePath = path.join(sourceRoot, `${index + 1}-${aggregateFile}`);
    const producer = `production-producer-${index + 1}`;
    const action = `produce-${aggregateFile.replace(/\.json$/u, '')}`;
    const sourceDocument = {
      schemaVersion: 'requirements-contract-production-bypass-source-evidence/v1',
      producer,
      action,
      ...identity,
      ...metrics,
      decision: 'PASS',
    };
    const hash = writeJson(sourcePath, sourceDocument);
    sourcePaths[aggregateFile] = sourcePath;
    return {
      aggregateFile,
      path: sourcePath,
      hash,
      readbackHash: hash,
      readbackVerified: true,
      producer,
      action,
      ...identity,
      decision: 'PASS',
    };
  });
  writeJson(implementationEvidencePath, {
    schemaVersion: 'requirements-contract-production-bypass-evidence-source-index/v1',
    producer: 'controlled-implementation-evidence-producer',
    action: 'index-production-bypass-evidence',
    ...identity,
    requirementRecordRef: {
      path: requirementRecordPath,
      hash: requirementRecordHash,
      readbackHash: requirementRecordHash,
      readbackVerified: true,
    },
    attemptContextRef: {
      path: attemptContextPath,
      hash: attemptContextHash,
      readbackHash: attemptContextHash,
      readbackVerified: true,
    },
    pointerReceiptRef: {
      path: pointerReceiptPath,
      hash: pointerReceiptHash,
      readbackHash: pointerReceiptHash,
      readbackVerified: true,
    },
    aggregateSources,
    decision: 'PASS',
  });

  return {
    root,
    evidenceRoot,
    sourcePaths,
    requirementRecordPath,
    attemptContextPath,
    pointerReceiptPath,
    implementationEvidencePath,
    input: {
      requirementRecordPath,
      transactionId,
      implementationAttemptId,
      attemptContextPath,
      pointerReceiptPath,
      implementationEvidencePath,
      evidenceRoot,
      contractHash,
      sourceHash,
      semanticModelHash,
    },
  };
}

function expectBlockedWithoutAggregates(fixture: Fixture, issueCode: string): void {
  const report = materializeRequirementsContractProductionBypassEvidence(fixture.input);
  expect(report.decision).toBe('BLOCK');
  expect(report.issues).toEqual(
    expect.arrayContaining([expect.objectContaining({ code: issueCode })])
  );
  const persisted = readJson(path.join(fixture.evidenceRoot, REPORT_FILE));
  expect(persisted.decision).toBe('BLOCK');
  for (const aggregateFile of AGGREGATE_FILES) {
    expect(existsSync(path.join(fixture.evidenceRoot, aggregateFile))).toBe(false);
  }
}

describe('requirements contract production bypass evidence materializer', () => {
  it('exposes a package-runtime command that returns the materialization decision', () => {
    const fixture = writeProductionEvidence();
    try {
      const command = (productionBypassMaterializer as Record<string, unknown>)
        .requirementsContractProductionBypassEvidenceMaterializeCommand;
      expect(command).toBeTypeOf('function');
      if (typeof command !== 'function') return;

      expect(command({ ...fixture.input, json: false })).toBe(0);
      expect(readJson(path.join(fixture.evidenceRoot, REPORT_FILE))).toMatchObject({
        decision: 'PASS',
        issueCount: 0,
      });
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it('materializes eight verifier-compatible aggregates and a PASS report', () => {
    const fixture = writeProductionEvidence();
    try {
      const report = materializeRequirementsContractProductionBypassEvidence(fixture.input);
      expect(report).toMatchObject({
        schemaVersion: 'requirements-contract-production-bypass-evidence-materializer-report/v1',
        decision: 'PASS',
        issueCount: 0,
      });
      expect(report.aggregateRefs).toHaveLength(8);
      for (const aggregateFile of AGGREGATE_FILES) {
        const aggregate = readJson(path.join(fixture.evidenceRoot, aggregateFile));
        expect(aggregate).toMatchObject({
          producer: 'requirements-contract-production-bypass-evidence-materializer',
          action: 'requirements-contract-production-bypass-evidence-materialize',
          implementationAttemptId: fixture.input.implementationAttemptId,
          decision: 'PASS',
        });
        expect(aggregate.sourceEvidenceRef).toMatchObject({
          readbackVerified: true,
          implementationAttemptId: fixture.input.implementationAttemptId,
          decision: 'PASS',
        });
      }
      expect(readJson(path.join(fixture.evidenceRoot, REPORT_FILE)).decision).toBe('PASS');
      writeJson(
        path.join(
          fixture.root,
          '_bmad/shared/requirements-contract/requirements-contract-package-runtime-action-binding-manifest.json'
        ),
        {
          packageRuntimeRoutingOnlyActionCount: 0,
          installedPackageActionBehaviorMismatchCount: 0,
          packageActionSemanticBindingCoverage: 1,
          decision: 'PASS',
        }
      );
      writeJson(path.join(fixture.evidenceRoot, 'G05-trace-graph.json'), {
        currentAttemptClosureWithoutIndependentOracleCount: 0,
        independentOracleClosureCount: 1,
        decision: 'PASS',
      });
      expect(
        evaluateProductionBypassClosure({
          cwd: fixture.root,
          evidenceRoot: fixture.evidenceRoot,
        })
      ).toMatchObject({
        correctnessDecision: 'PASS',
        productionBypassClosureIssueCount: 0,
      });
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it('reads current dispatch metrics from pointer selectionMetrics', () => {
    const fixture = writeProductionEvidence();
    try {
      const pointer = readJson(fixture.pointerReceiptPath);
      pointer.selectionMetrics.historicalFallbackCount = 4;
      pointer.selectionMetrics.missingBindingCount = 2;
      pointer.selectionMetrics.currentDispatchPointerCoverage = 0.75;
      writeJson(fixture.pointerReceiptPath, pointer);
      const implementationEvidence = readJson(fixture.implementationEvidencePath);
      const pointerHash = sha256(readFileSync(fixture.pointerReceiptPath));
      implementationEvidence.pointerReceiptRef.hash = pointerHash;
      implementationEvidence.pointerReceiptRef.readbackHash = pointerHash;
      writeJson(fixture.implementationEvidencePath, implementationEvidence);

      materializeRequirementsContractProductionBypassEvidence(fixture.input);
      expect(
        readJson(path.join(fixture.evidenceRoot, 'current-dispatch-pointer-receipt.json'))
      ).toMatchObject({
        historicalPacketSelectionCount: 4,
        packetWithoutTransactionBindingCount: 2,
        currentDispatchPointerCoverage: 0.75,
      });
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it('BLOCKS when the requirement record is missing', () => {
    const fixture = writeProductionEvidence();
    try {
      rmSync(fixture.requirementRecordPath);
      expectBlockedWithoutAggregates(
        fixture,
        'production_bypass_materializer_requirement_record_missing'
      );
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it('BLOCKS a stale implementation attempt', () => {
    const fixture = writeProductionEvidence();
    try {
      const record = readJson(fixture.requirementRecordPath);
      record.currentAttemptId = `IMPL-ATTEMPT-STALE-${randomUUID()}`;
      writeJson(fixture.requirementRecordPath, record);
      expectBlockedWithoutAggregates(fixture, 'production_bypass_materializer_stale_attempt');
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it('BLOCKS fixture substitution even when hashes and readback match', () => {
    const fixture = writeProductionEvidence();
    try {
      const implementationEvidence = readJson(fixture.implementationEvidencePath);
      const source = implementationEvidence.aggregateSources[0];
      const fixturePath = path.join(fixture.root, 'fixtures', path.basename(source.path));
      mkdirSync(path.dirname(fixturePath), { recursive: true });
      copyFileSync(source.path, fixturePath);
      source.path = fixturePath;
      source.hash = sha256(readFileSync(fixturePath));
      source.readbackHash = source.hash;
      writeJson(fixture.implementationEvidencePath, implementationEvidence);
      expectBlockedWithoutAggregates(
        fixture,
        'production_bypass_materializer_fixture_path_forbidden'
      );
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it('BLOCKS when an aggregate source is missing', () => {
    const fixture = writeProductionEvidence();
    try {
      rmSync(Object.values(fixture.sourcePaths)[0]);
      expectBlockedWithoutAggregates(fixture, 'production_bypass_materializer_aggregate_missing');
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it.each([
    ['hash', 'production_bypass_materializer_aggregate_hash_mismatch'],
    ['readbackHash', 'production_bypass_materializer_aggregate_readback_mismatch'],
  ] as const)('BLOCKS aggregate %s substitution', (field, issueCode) => {
    const fixture = writeProductionEvidence();
    try {
      const implementationEvidence = readJson(fixture.implementationEvidencePath);
      implementationEvidence.aggregateSources[0][field] = sha256(`wrong-${field}`);
      writeJson(fixture.implementationEvidencePath, implementationEvidence);
      expectBlockedWithoutAggregates(fixture, issueCode);
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });
});
