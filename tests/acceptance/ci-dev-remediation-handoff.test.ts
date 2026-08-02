import { execFileSync } from 'node:child_process';
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  canonicalJsonBytes,
  sha256Bytes,
} from '../../tools/test-portfolio-audit/canonical.cjs';

const require = createRequire(import.meta.url);
const {
  buildDevRemediationHandoff,
  validateProductFailureRecordsWrapper,
} = require('../../tools/ci/generate-six-model-coverage-gap-report.cjs');
const producerPath = resolve('tools/ci/build-product-failure-records.cjs');
const commitSha = 'a'.repeat(40);
const catalogSha256 = `sha256:${'b'.repeat(64)}`;

function writeJson(filePath: string, value: unknown) {
  mkdirSync(resolve(filePath, '..'), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function writeCanonical(filePath: string, value: unknown) {
  mkdirSync(resolve(filePath, '..'), { recursive: true });
  writeFileSync(filePath, canonicalJsonBytes(value));
}

function productFailureRecord(overrides: Record<string, unknown> = {}) {
  return {
    itemKind: 'product_failure',
    obligationId: null,
    modelRefs: ['execution_closure'],
    transitionRefs: ['state_entry'],
    capabilityRefs: ['six-model-state-machine'],
    traceRefs: ['execution_closure/state_entry'],
    testIdentity: 'root-vitest#tests/product-compatibility.test.ts',
    testPath: 'tests/product-compatibility.test.ts',
    testCaseName: 'product compatibility rejects stale evidence',
    targetRefs: ['packages/bmad-speckit/src/main-agent/runtime.ts'],
    exactCommand: 'npm exec --offline -- vitest run --reporter=json',
    exitCode: 1,
    failureFingerprint: `sha256:${'c'.repeat(64)}`,
    failureSummary: 'Error: stale evidence was accepted',
    changedProductPaths: ['packages/bmad-speckit/src/main-agent/runtime.ts'],
    suspectedProductOwner: 'packages/bmad-speckit',
    selectionRemainsRequired: true,
    blocksPortfolioCorrectness: false,
    ...overrides,
  };
}

function productFailureWrapper(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 'product-failure-records/v1',
    commitSha,
    catalogSha256,
    testReportSha256: `sha256:${'d'.repeat(64)}`,
    runReceiptSha256: `sha256:${'e'.repeat(64)}`,
    selectionArtifacts: [
      {
        path: '.artifacts/test-portfolio/profiles/pr-fast/test-selection.json',
        sha256: `sha256:${'f'.repeat(64)}`,
      },
    ],
    records: [productFailureRecord()],
    summary: {
      recordCount: 1,
      requiredSelectionCount: 1,
      selectionArtifactCount: 1,
      selectedFailureCount: 1,
      portfolioBlockingCount: 0,
    },
    ...overrides,
  };
}

describe('CI dev remediation handoff', () => {
  it('produces a canonical product-failure-records wrapper bound to all source evidence', () => {
    const repoRoot = mkdtempSync(join(tmpdir(), 'product-failure-records-'));
    const artifactRoot = join(repoRoot, '.artifacts/test-portfolio');
    const commitSha = 'a'.repeat(40);
    const catalogPath = join(artifactRoot, 'test-catalog.json');
    const reportPath = join(artifactRoot, 'vitest-report.json');
    const receiptPath = join(artifactRoot, 'run-receipt.json');
    const selectionPaths = [
      join(artifactRoot, 'profiles/pr-fast/test-selection.json'),
      join(artifactRoot, 'profiles/release-verify/test-selection.json'),
    ];
    const outputPath = join(artifactRoot, 'product-failure-records.json');
    const catalog = {
      schemaVersion: 'test-catalog/v1',
      repository: { commit: commitSha, dirty: false },
      tests: [
        {
          identityKey: 'root-vitest#tests/product-compatibility.test.ts',
          executableIdentity: 'vitest::tests/product-compatibility.test.ts',
          testPath: 'tests/product-compatibility.test.ts',
          behaviorEvidence: {},
          behaviorOracleAuthority: {},
          classifications: {},
          capabilityRefs: ['six-model-state-machine'],
          traceRefs: ['execution_closure/state_entry'],
          targetRefs: ['packages/bmad-speckit/src/main-agent/runtime.ts'],
        },
      ],
    };
    const testReport = {
      testResults: [
        {
          name: 'D:/repo/tests/product-compatibility.test.ts',
          assertionResults: [
            {
              status: 'failed',
              fullName: 'product compatibility rejects stale evidence',
              failureMessages: ['Error: stale evidence was accepted'],
            },
          ],
        },
      ],
    };
    const runReceipt = {
      commitSha,
      exactCommand: 'npm exec --offline -- vitest run --reporter=json',
      exitCode: 1,
      changedProductPaths: ['packages/bmad-speckit/src/main-agent/runtime.ts'],
    };

    try {
      writeCanonical(catalogPath, catalog);
      writeJson(reportPath, testReport);
      writeJson(receiptPath, runReceipt);
      writeCanonical(
        selectionPaths[0],
        {
          schemaVersion: 'test-selection/v1',
          selected: [{ identityKey: catalog.tests[0].identityKey }],
        }
      );
      writeCanonical(
        selectionPaths[1],
        {
          schemaVersion: 'test-selection/v1',
          selected: [{ identityKey: 'root-vitest#tests/other.test.ts' }],
        }
      );

      execFileSync(
        process.execPath,
        [
          producerPath,
          '--test-report',
          reportPath,
          '--catalog',
          catalogPath,
          '--run-receipt',
          receiptPath,
          '--selection',
          selectionPaths[0],
          '--selection',
          selectionPaths[1],
          '--output',
          outputPath,
        ],
        { cwd: repoRoot, stdio: 'pipe' }
      );

      const outputBytes = readFileSync(outputPath);
      const wrapper = JSON.parse(outputBytes.toString('utf8'));
      expect(outputBytes).toEqual(canonicalJsonBytes(wrapper));
      expect(wrapper).toMatchObject({
        schemaVersion: 'product-failure-records/v1',
        commitSha,
        catalogSha256: sha256Bytes(readFileSync(catalogPath)),
        testReportSha256: sha256Bytes(readFileSync(reportPath)),
        runReceiptSha256: sha256Bytes(readFileSync(receiptPath)),
        selectionArtifacts: selectionPaths.map((selectionPath) => ({
          path: selectionPath.replace(`${repoRoot}\\`, '').replace(/\\/gu, '/'),
          sha256: sha256Bytes(readFileSync(selectionPath)),
        })),
        summary: {
          recordCount: 1,
          requiredSelectionCount: 2,
          selectionArtifactCount: 2,
          selectedFailureCount: 1,
          portfolioBlockingCount: 0,
        },
      });
      expect(wrapper.records).toEqual([
        expect.objectContaining({
          itemKind: 'product_failure',
          selectionRemainsRequired: true,
          blocksPortfolioCorrectness: false,
        }),
      ]);
    } finally {
      rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it('rejects legacy arrays and stale product-failure evidence', () => {
    const validate = (wrapper: unknown) =>
      validateProductFailureRecordsWrapper({
        wrapper,
        catalog: { repository: { commit: commitSha } },
        catalogSha256,
      });

    expect(() => validate([productFailureRecord()])).toThrowError(
      'SIX_MODEL_COVERAGE_FAILURE_RECORDS_WRAPPER_INVALID'
    );
    expect(() =>
      validate(productFailureWrapper({ commitSha: '9'.repeat(40) }))
    ).toThrowError('SIX_MODEL_COVERAGE_FAILURE_RECORDS_COMMIT_MISMATCH');
    expect(() =>
      validate(productFailureWrapper({ catalogSha256: `sha256:${'9'.repeat(64)}` }))
    ).toThrowError('SIX_MODEL_COVERAGE_FAILURE_RECORDS_CATALOG_HASH_MISMATCH');
  });

  it('keeps product compatibility failures non-blocking in the dev remediation handoff', () => {
    const records = validateProductFailureRecordsWrapper({
      wrapper: productFailureWrapper(),
      catalog: { repository: { commit: commitSha } },
      catalogSha256,
    });
    const handoff = buildDevRemediationHandoff({
      coverageReport: { obligations: [] },
      failureRecords: records,
    });

    expect(handoff.items).toEqual([
      expect.objectContaining({
        itemKind: 'product_failure',
        blocksPortfolioCorrectness: false,
      }),
    ]);
    expect(() =>
      validateProductFailureRecordsWrapper({
        wrapper: productFailureWrapper({
          records: [productFailureRecord({ blocksPortfolioCorrectness: true })],
          summary: {
            ...productFailureWrapper().summary,
            portfolioBlockingCount: 1,
          },
        }),
        catalog: { repository: { commit: commitSha } },
        catalogSha256,
      })
    ).toThrowError('SIX_MODEL_COVERAGE_FAILURE_RECORD_INVALID');
  });
});
