import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildCanonicalPreCheckpointCompilerInput } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-canonical-compiler-input';
import {
  artifacts,
  cleanCriticalAuditorRound,
  createSourceAuthorityProjectionDescriptor,
  createTempRoot,
  issueCodes,
  readJson,
  removeTempRoot,
  renderSourceAuthorityProjection,
  runAuthoring,
  stagingMustDecompositionPacket,
  writeSourceAuthorityProjection,
  writeText,
  type SourceAuthorityProjectionDescriptor,
} from './helpers/requirements-contract-authoring-fixture';

type Row = Record<string, any>;

const CORR_131_ASSERTION_ID = 'corr_131_source_requirement_alias_not_preserved';
const CORR_131_LEDGER_RELATIVE_PATH =
  'docs/plans/.2026-07-11-loop-engineering-evidence-closure-remediation-amend10-audit-disposition.md';
const CORR_131_CONTRACT_RELATIVE_PATH =
  'docs/plans/2026-07-16-loop-engineering-evidence-closure-remediation-amend12-goal-execution-plan.md';
const require = createRequire(import.meta.url);

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(',')}}`;
}

function sha256Stable(value: unknown): string {
  return `sha256:${createHash('sha256').update(stableStringify(value), 'utf8').digest('hex')}`;
}

function sha256Bytes(value: Buffer | string): string {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

function writeUtf8(root: string, relativePath: string, content: string): string {
  const outputPath = path.join(root, relativePath);
  mkdirSync(path.dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, content, { encoding: 'utf8', flag: 'wx' });
  return outputPath;
}

function corr131LedgerPreimage(): string {
  const header =
    '# CORR-131 test ledger\n\n| ID | Issue | Root cause | Remediation | Verification |\n|---|---|---|---|---|\n';
  const rows = Array.from({ length: 186 }, (_, index) => {
    const id = String(index + 1).padStart(3, '0');
    return `| CORR-${id} | BASE-${id} | BASE-${id} | BASE-${id} | BASE-${id} |`;
  });
  return `${header}${rows.join('\n')}\n`;
}

function corr131OpenRow(): string {
  return [
    '| CORR-187',
    'CORR-131 OPEN (qualified_red): target predicate failed',
    'CORR-131 OPEN (qualified_red): root cause pending',
    'CORR-131 OPEN (qualified_red): productionEditAuthorized false',
    'CORR-131 OPEN (qualified_red): Qualified RED receipt recorded |',
  ].join(' | ');
}

function runCorr131LedgerOpenFixture(): {
  root: string;
  ledgerPath: string;
  row: string;
  receiptDir: string;
  preparationManifestPath: string;
  preparationResult: ReturnType<typeof spawnSync>;
  result: ReturnType<typeof spawnSync>;
} {
  const root = mkdtempSync(path.join(os.tmpdir(), 'corr-131-ledger-open-'));
  const contractBytes = 'AMEND-11 test contract\n';
  const contractHash = sha256Bytes(contractBytes);
  writeUtf8(root, CORR_131_CONTRACT_RELATIVE_PATH, contractBytes);
  const ledgerPreimage = corr131LedgerPreimage();
  const ledgerPath = writeUtf8(root, CORR_131_LEDGER_RELATIVE_PATH, ledgerPreimage);
  const transactionId = 'TX-CORR-131-TEST';
  const implementationAttemptId = 'IMP-CORR-131-TEST';
  const attemptContextRelativePath =
    `docs/plans/evidence/loop-engineering-remediation/attempts/${transactionId}/` +
    `${implementationAttemptId}/pre-edit-attempt-context-receipt.json`;
  writeUtf8(
    root,
    attemptContextRelativePath,
    `${JSON.stringify(
      {
        schemaVersion: 'corr-131-attempt-context/v1',
        transactionId,
        implementationAttemptId,
        architectureAuditAttemptId: 'AUDIT-CORR-131-TEST',
        contractPath: CORR_131_CONTRACT_RELATIVE_PATH,
        contractHash,
      },
      null,
      2
    )}\n`
  );
  const row = `${corr131OpenRow()}\n`;
  const rowRelativePath =
    `docs/plans/evidence/loop-engineering-remediation/corr-131/${transactionId}/` +
    `${implementationAttemptId}/ledger/rows/CORR-187.md`;
  const receiptDir =
    `docs/plans/evidence/loop-engineering-remediation/corr-131/${transactionId}/` +
    `${implementationAttemptId}/ledger/receipts`;
  const lifecycleContextRelativePath =
    `docs/plans/evidence/loop-engineering-remediation/corr-131/${transactionId}/` +
    `${implementationAttemptId}/ledger/contexts/open.json`;
  writeUtf8(
    root,
    lifecycleContextRelativePath,
    `${JSON.stringify(
      {
        schemaVersion: 'corr-131-ledger-lifecycle-context/v1',
        contractPath: CORR_131_CONTRACT_RELATIVE_PATH,
        contractHash,
        transactionId,
        implementationAttemptId,
        phase: 'open',
        lifecycleId: 'CORR-187',
        status: 'OPEN (qualified_red)',
        ledgerPath: CORR_131_LEDGER_RELATIVE_PATH,
        expectedPreimageHash: sha256Bytes(ledgerPreimage),
        expectedMaximumId: 186,
        expectedPredecessorLifecycleId: 'none',
        row,
      },
      null,
      2
    )}\n`
  );
  const helperPath = path.resolve(
    process.cwd(),
    'tests/acceptance/helpers/run-requirements-contract-corr-131-qualified-red.cjs'
  );
  const preparationResult = spawnSync(
    process.execPath,
    [
      helperPath,
      '--prepare-ledger-lifecycle',
      'open',
      '--contract',
      CORR_131_CONTRACT_RELATIVE_PATH,
      '--contract-hash',
      contractHash,
      '--attempt-context',
      attemptContextRelativePath,
      '--ledger',
      CORR_131_LEDGER_RELATIVE_PATH,
      '--lifecycle-context',
      lifecycleContextRelativePath,
      '--receipt-dir',
      receiptDir,
      '--json',
    ],
    {
      cwd: root,
      encoding: 'utf8',
      env: {
        SystemRoot: process.env.SystemRoot,
        WINDIR: process.env.WINDIR,
        TEMP: process.env.TEMP,
        TMP: process.env.TMP,
        USERPROFILE: process.env.USERPROFILE,
        LOCALAPPDATA: process.env.LOCALAPPDATA,
        APPDATA: process.env.APPDATA,
        ComSpec: process.env.ComSpec,
        PATH: process.env.PATH,
        NO_COLOR: '1',
        FORCE_COLOR: '0',
      },
      windowsHide: true,
    }
  );
  const result =
    preparationResult.status === 0
      ? spawnSync(
          process.execPath,
          [
            helperPath,
      '--ledger-lifecycle',
      'open',
      '--contract',
      CORR_131_CONTRACT_RELATIVE_PATH,
      '--contract-hash',
      contractHash,
      '--attempt-context',
      attemptContextRelativePath,
      '--ledger',
      CORR_131_LEDGER_RELATIVE_PATH,
      '--expected-preimage-hash',
      sha256Bytes(ledgerPreimage),
      '--expected-max-id',
      '186',
      '--expected-predecessor-lifecycle-id',
      'none',
      '--lifecycle-id',
      'CORR-187',
      '--row-file',
      rowRelativePath,
      '--row-hash',
      sha256Bytes(row),
      '--receipt-dir',
      receiptDir,
      '--json',
          ],
          {
            cwd: root,
            encoding: 'utf8',
            env: {
              SystemRoot: process.env.SystemRoot,
              WINDIR: process.env.WINDIR,
              TEMP: process.env.TEMP,
              TMP: process.env.TMP,
              USERPROFILE: process.env.USERPROFILE,
              LOCALAPPDATA: process.env.LOCALAPPDATA,
              APPDATA: process.env.APPDATA,
              ComSpec: process.env.ComSpec,
              PATH: process.env.PATH,
              NO_COLOR: '1',
              FORCE_COLOR: '0',
            },
            windowsHide: true,
          }
        )
      : preparationResult;
  return {
    root,
    ledgerPath,
    row,
    receiptDir: path.join(root, receiptDir),
    preparationManifestPath: path.join(
      root,
      receiptDir,
      'open.preparation.manifest.json'
    ),
    preparationResult,
    result,
  };
}

function corr131CanonicalCompilerInput() {
  const sourceRootId = 'MUST-CORR-131';
  const nestedSourceRequirementId = 'FR-CORR-131-NESTED';
  const topLevelSourceRequirementId = 'FR-CORR-131-TOP';
  const semanticBody = {
    id: sourceRootId,
    kind: 'functional',
    text: 'Preserve the Source-authorized requirement identity.',
    sourceRequirementId: topLevelSourceRequirementId,
    source: {
      sourceRequirementId: nestedSourceRequirementId,
      headingPath: ['Requirements', 'CORR-131'],
    },
  };
  const bodyHash = sha256Stable(semanticBody);
  const semanticModelHash = sha256Stable({ sourceRootId, bodyHash });
  const sourceAuthorityHash = sha256Stable({ sourceRootId, nestedSourceRequirementId });
  const sourceRoot = {
    sourceRootId,
    rootClass: 'functional_requirement',
    nodeType: 'requirement',
    bodySchemaVersion: 'requirement-contract-requirement/v2',
    semanticBody,
    sourcePath: 'requirements/corr-131-source.md',
    sourceContent: '# CORR-131\n',
    sourceSpan: { startLine: 1, endLine: 1 },
    authorityClass: 'source_authorized',
  };
  return {
    expectedSourceRequirementId: nestedSourceRequirementId,
    input: {
      semanticIr: {
        schemaVersion: 'requirement-contract-model/v2',
        activationState: 'inactive_shadow_only',
        recordId: 'CORR-131-RECORD',
        requirementSetId: 'CORR-131-SET',
        sourceAuthorityHash,
        semanticModelHash,
        edgeTypeRegistryHash: sha256Stable([]),
        authority: 'none',
        semanticBodies: { [bodyHash]: semanticBody },
        nodes: {
          [sourceRootId]: {
            nodeType: 'requirement',
            bodySchemaVersion: 'requirement-contract-requirement/v2',
            bodyHash,
            applicability: { state: 'applicable', proofBindings: [] },
            proofBindings: [],
          },
        },
        edges: {},
      } as any,
      semanticConservationManifest: {
        semanticModelHash,
        manifestHash: sha256Stable({ semanticModelHash, sourceAuthorityHash }),
        sourceRoots: [
          {
            sourceRootId,
            payloadHash: bodyHash,
            authorityClass: sourceRoot.authorityClass,
          },
        ],
        semanticNodes: [],
        rootToNodeMappings: [],
        nodeToAuthorityMappings: [],
        hashChain: {
          semanticModelHash,
          sourceAuthorityHash,
        },
      } as any,
      sourceRoots: [sourceRoot] as any,
    },
  };
}

function publishCorr131AssertionEvent(actual: string, expected: string): void {
  const outputPath = process.env.CORR_131_ASSERTION_EVENT_PATH;
  if (!outputPath) return;
  const testPath = fileURLToPath(import.meta.url);
  const lines = readFileSync(testPath, 'utf8').split(/\r?\n/u);
  const markerIndex = lines.findIndex((line) => line.includes('CORR_131_TARGET_ASSERTION'));
  const assertionIndex = lines.findIndex(
    (line, index) => index > markerIndex && line.includes('expect(actual')
  );
  if (markerIndex < 0 || assertionIndex < 0) {
    throw new Error('CORR-131 target assertion site is missing');
  }
  writeFileSync(
    outputPath,
    `${JSON.stringify(
      {
        schemaVersion: 'corr-131-qualified-red-assertion-event/v1',
        assertionId: CORR_131_ASSERTION_ID,
        testFile: path.relative(process.cwd(), testPath).replaceAll('\\', '/'),
        assertionSite: {
          line: assertionIndex + 1,
          column: lines[assertionIndex].indexOf('expect') + 1,
        },
        expected,
        actual,
        createdAt: new Date().toISOString(),
      },
      null,
      2
    )}\n`,
    { encoding: 'utf8', flag: 'wx' }
  );
}

function rows(value: unknown): Row[] {
  return Array.isArray(value) ? (value as Row[]) : [];
}

function ids(value: unknown): string[] {
  return rows(value).map((row) => String(row.id));
}

function removeSourceAuthority(source: string, authorityId: string): string {
  const escapedId = authorityId.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
  const authorityRef = new RegExp(`\\b${escapedId}\\b`, 'gu');
  return source
    .split(/\r?\n/u)
    .filter((line) => !line.startsWith(`| ${authorityId} |`))
    .map((line) => line.replace(authorityRef, 'none'))
    .join('\n');
}

function mismatchFailureOwner(
  source: string,
  descriptor: SourceAuthorityProjectionDescriptor,
  mismatchedMustRef: string
): string {
  return source
    .split(/\r?\n/u)
    .map((line) => {
      if (!line.startsWith(`| ${descriptor.failure.id} |`)) return line;
      const cells = line
        .split('|')
        .slice(1, -1)
        .map((cell) => cell.trim());
      cells[3] = 'none';
      cells[4] = 'none';
      cells[5] = mismatchedMustRef;
      return `| ${cells.join(' | ')} |`;
    })
    .join('\n');
}

function removeFailureOwnerAuthority(
  source: string,
  descriptor: SourceAuthorityProjectionDescriptor
): string {
  return source
    .split(/\r?\n/u)
    .map((line) => {
      if (!line.startsWith(`| ${descriptor.failure.id} |`)) return line;
      const cells = line
        .split('|')
        .slice(1, -1)
        .map((cell) => cell.trim());
      cells[3] = 'none';
      cells[4] = 'none';
      cells[5] = 'none';
      return `| ${cells.join(' | ')} |`;
    })
    .join('\n');
}

function expectNoEmptyProjectionIds(root: string, recordId: string): void {
  let packet: Row;
  try {
    packet = stagingMustDecompositionPacket(root, recordId) as Row;
  } catch {
    return;
  }
  for (const mustPacket of rows(packet.mustPackets)) {
    for (const group of [
      mustPacket.mustTraceProjection,
      mustPacket.mustAcceptanceProjection,
      mustPacket.mustFailureEdgeProjection,
    ]) {
      expect(ids(group).every(Boolean)).toBe(true);
    }
  }
}

function expectDeterministicSemanticGapBlock(
  result: ReturnType<typeof runAuthoring>,
  root: string,
  recordId: string
): void {
  expect(result.substate).toBe('blocked_by_semantic_gap');
  expect(result.confirmability).toBe('blocked');
  expect(() => stagingMustDecompositionPacket(root, recordId)).toThrow();
  const output = artifacts(root, recordId, `${recordId}-SET`);
  expect(existsSync(output.promotionReceipt)).toBe(false);
  expect(existsSync(output.html)).toBe(false);
}

describe('CORR-131 source-authorized packet projection', () => {
  it('uses the first normalized TEST-01 assertion stack frame instead of JSON location', () => {
    const helper = require('./helpers/run-requirements-contract-corr-131-qualified-red.cjs') as {
      validateCorr131VitestFailure?: (input: Record<string, unknown>) => Record<string, unknown>;
    };
    expect(typeof helper.validateCorr131VitestFailure).toBe('function');

    const testPath =
      'tests/acceptance/requirements-contract-corr-131-source-authorized-packet-projection.test.ts';
    const testFullName =
      'CORR-131 source-authorized packet projection corr_131_source_requirement_alias_not_preserved';
    const failureMessage = [
      `AssertionError: ${CORR_131_ASSERTION_ID}: expected 'FR-CORR-131-TOP' to be 'FR-CORR-131-NESTED' // Object.is equality`,
      '    at file:///D:/Dev/BMAD-Speckit-SDD-Flow/node_modules/@vitest/runner/dist/index.js:145:11',
      `    at D:/Dev/BMAD-Speckit-SDD-Flow/${testPath}:195:69`,
    ].join('\n');
    const result = helper.validateCorr131VitestFailure?.({
      repositoryRoot: 'D:/Dev/BMAD-Speckit-SDD-Flow',
      testPath,
      assertionId: CORR_131_ASSERTION_ID,
      assertionEvent: {
        testFullName,
        expected: 'FR-CORR-131-NESTED',
        actual: 'FR-CORR-131-TOP',
        assertionSite: {
          normalizedFailureFrame: `${testPath}:195:69`,
        },
      },
      vitestResult: {
        testResults: [
          {
            assertionResults: [
              {
                status: 'failed',
                fullName: testFullName,
                location: null,
                failureMessages: [failureMessage],
              },
            ],
          },
        ],
      },
    });

    expect(result).toEqual({
      actual: 'FR-CORR-131-TOP',
      expected: 'FR-CORR-131-NESTED',
      normalizedFailureFrame: `${testPath}:195:69`,
    });
  });

  it('uses one r+ ledger transaction and publishes all four lifecycle receipts', () => {
    const fixture = runCorr131LedgerOpenFixture();
    try {
      expect(
        fixture.preparationResult.status,
        fixture.preparationResult.stderr || fixture.preparationResult.stdout
      ).toBe(0);
      expect(existsSync(fixture.preparationManifestPath)).toBe(true);
      expect(fixture.result.status, fixture.result.stderr || fixture.result.stdout).toBe(0);
      const postimage = readFileSync(fixture.ledgerPath, 'utf8');
      expect(postimage).toBe(`${corr131LedgerPreimage()}${fixture.row}`);
      expect(
        existsSync(
          `${path.join(
            fixture.root,
            CORR_131_LEDGER_RELATIVE_PATH
          )}.lock`
        )
      ).toBe(false);
      expect(
        [
          'CORR-187.lock.receipt.json',
          'CORR-187.append.receipt.json',
          'CORR-187.readback.receipt.json',
          'CORR-187.lock-release.receipt.json',
        ].every((name) => existsSync(path.join(fixture.receiptDir, name)))
      ).toBe(true);
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it(CORR_131_ASSERTION_ID, () => {
    const fixture = corr131CanonicalCompilerInput();
    const result = buildCanonicalPreCheckpointCompilerInput(fixture.input);
    const actual = result.compilerInput.must[0]?.sourceRequirementId ?? '';
    publishCorr131AssertionEvent(actual, fixture.expectedSourceRequirementId);
    // CORR_131_TARGET_ASSERTION
    expect(actual, CORR_131_ASSERTION_ID).toBe(fixture.expectedSourceRequirementId);
  });

  it('projects each seed descriptor Source identity through the real pre-confirmation path', () => {
    const observed: string[][] = [];
    for (const [index, seed] of ['corr-131-primary', 'corr-131-alternate'].entries()) {
      const root = createTempRoot(`corr-131-source-authority-${index}-`);
      const recordId = `CORR-131-SOURCE-${index + 1}`;
      try {
        const descriptor = createSourceAuthorityProjectionDescriptor(seed, { negativeCount: 1 });
        const { sourcePath, authoringOptions } = writeSourceAuthorityProjection(root, descriptor);
        runAuthoring(root, sourcePath, recordId, authoringOptions);
        const packet = stagingMustDecompositionPacket(root, recordId) as Row;
        const mustPacket = rows(packet.mustPackets).find(
          (row) => row.mustRef === descriptor.requirement.mustId
        );
        const negative = descriptor.negatives[0]!;

        expect(ids(mustPacket?.mustTraceProjection)).toEqual([
          descriptor.primary.traceId,
          negative.traceId,
        ]);
        expect(ids(mustPacket?.mustAcceptanceProjection)).toEqual([
          descriptor.primary.acceptanceId,
          negative.acceptanceId,
          descriptor.primary.endToEndId,
        ]);
        expect(ids(mustPacket?.mustFailureEdgeProjection)).toEqual([
          descriptor.failure.id,
          'EDGE-001',
        ]);
        expect(
          rows(mustPacket?.mustTraceProjection).find(
            (row) => row.id === descriptor.primary.traceId
          )?.materializedTo
        ).toEqual([`implementationConfirmation.traceRows[${descriptor.primary.traceId}]`]);
        expect(
          rows(mustPacket?.mustAcceptanceProjection).find(
            (row) => row.id === descriptor.primary.acceptanceId
          )?.materializedTo
        ).toEqual([
          `implementationConfirmation.acceptanceTests[${descriptor.primary.acceptanceId}]`,
        ]);
        expect(
          rows(mustPacket?.mustAcceptanceProjection).find(
            (row) => row.id === descriptor.primary.endToEndId
          )?.materializedTo
        ).toEqual([`implementationConfirmation.e2eSuites[${descriptor.primary.endToEndId}]`]);
        expect(
          rows(mustPacket?.mustFailureEdgeProjection).find(
            (row) => row.id === descriptor.failure.id
          )?.materializedTo
        ).toEqual([`implementationConfirmation.failurePaths[${descriptor.failure.id}]`]);
        expect(JSON.stringify(packet)).not.toMatch(/(?:TRACE|ACC|E2E|FAIL)-001/u);
        observed.push([
          descriptor.primary.traceId,
          descriptor.primary.acceptanceId,
          descriptor.primary.endToEndId,
          descriptor.failure.id,
        ]);
      } finally {
        removeTempRoot(root);
      }
    }
    expect(observed[0]).not.toEqual(observed[1]);
  });

  it.each([
    ['Trace', (descriptor: SourceAuthorityProjectionDescriptor) => descriptor.primary.traceId],
    [
      'Acceptance',
      (descriptor: SourceAuthorityProjectionDescriptor) => descriptor.primary.acceptanceId,
    ],
    ['E2E', (descriptor: SourceAuthorityProjectionDescriptor) => descriptor.primary.endToEndId],
  ])('fails closed when primary %s Source authority is missing', (_label, authorityIdFor) => {
    const root = createTempRoot('corr-131-missing-source-authority-');
    const recordId = `CORR-131-MISSING-${String(_label).toUpperCase()}`;
    try {
      const descriptor = createSourceAuthorityProjectionDescriptor(recordId, { negativeCount: 1 });
      const materialized = writeSourceAuthorityProjection(root, descriptor);
      const source = removeSourceAuthority(
        renderSourceAuthorityProjection(descriptor),
        authorityIdFor(descriptor)
      );
      writeText(root, descriptor.sourcePath, source);

      const result = runAuthoring(root, materialized.sourcePath, recordId, {
        ...materialized.authoringOptions,
        criticalAuditorRound: cleanCriticalAuditorRound,
      });

      expect(issueCodes(result)).toContain('source_projection_authority_missing');
      expectNoEmptyProjectionIds(root, recordId);
      expectDeterministicSemanticGapBlock(result, root, recordId);
    } finally {
      removeTempRoot(root);
    }
  });

  it('fails closed when a Source Failure row has no explicit owner authority', () => {
    const root = createTempRoot('corr-131-failure-owner-missing-');
    const recordId = 'CORR-131-FAILURE-OWNER-MISSING';
    try {
      const descriptor = createSourceAuthorityProjectionDescriptor(recordId, { negativeCount: 1 });
      const materialized = writeSourceAuthorityProjection(root, descriptor);
      writeText(
        root,
        descriptor.sourcePath,
        removeFailureOwnerAuthority(renderSourceAuthorityProjection(descriptor), descriptor)
      );

      const result = runAuthoring(root, materialized.sourcePath, recordId, {
        ...materialized.authoringOptions,
        criticalAuditorRound: cleanCriticalAuditorRound,
      });

      expect(issueCodes(result)).toContain('business_failure_path_owner_requirement_missing');
      expectDeterministicSemanticGapBlock(result, root, recordId);
    } finally {
      removeTempRoot(root);
    }
  });

  it('fails closed when a Source Failure row names a non-owner MUST', () => {
    const root = createTempRoot('corr-131-failure-owner-mismatch-');
    const recordId = 'CORR-131-FAILURE-OWNER';
    try {
      const descriptor = createSourceAuthorityProjectionDescriptor(recordId, { negativeCount: 1 });
      const other = createSourceAuthorityProjectionDescriptor(`${recordId}-OTHER`, {
        negativeCount: 1,
      });
      const materialized = writeSourceAuthorityProjection(root, descriptor);
      const source = mismatchFailureOwner(
        renderSourceAuthorityProjection(descriptor),
        descriptor,
        other.requirement.mustId
      );
      writeText(root, descriptor.sourcePath, source);

      const result = runAuthoring(root, materialized.sourcePath, recordId, {
        ...materialized.authoringOptions,
        criticalAuditorRound: cleanCriticalAuditorRound,
      });

      expect(issueCodes(result)).toContain('business_failure_path_owner_requirement_missing');
      expectNoEmptyProjectionIds(root, recordId);
      expectDeterministicSemanticGapBlock(result, root, recordId);
    } finally {
      removeTempRoot(root);
    }
  });
});
