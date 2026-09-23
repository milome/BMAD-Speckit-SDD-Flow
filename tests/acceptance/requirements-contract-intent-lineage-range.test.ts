import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createRequirementsContractFileIntakeReceipt } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-file-intake-receipt';
import * as intakeModule from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-file-intake-receipt';
import * as lineageModule from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-intent-lineage';
import {
  buildUtf8LineIndex,
  lineRangeToByteRange,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-utf8-source-index';

type Range = {
  startUtf8Byte: number;
  endUtf8ByteExclusive: number;
  startLine: number;
  endLine: number;
};

type ExcludedRange = Range & {
  exclusionRuleRef: string;
  reasonCode: string;
};

const temporaryRoots: string[] = [];

function recordRoot(): string {
  const root = mkdtempSync(path.join(os.tmpdir(), 'requirements-lineage-range-'));
  temporaryRoots.push(root);
  return root;
}

function requiredFunction<T>(module: object, name: string): T {
  const candidate = Reflect.get(module, name) as T | undefined;
  expect(candidate, `${name} must be exported`).toBeTypeOf('function');
  if (!candidate) throw new Error(`${name} is unavailable`);
  return candidate;
}

function source(lines: number): string {
  return Array.from({ length: lines }, (_value, index) =>
    `line-${String(index + 1).padStart(5, '0')}${index + 1 === lines ? '' : '\n'}`
  ).join('');
}

function excludedLineRanges(sourceBytes: Buffer, reasonCode = 'non_semantic'): ExcludedRange[] {
  const index = buildUtf8LineIndex(sourceBytes);
  return index.lineStartOffsets.map((_offset, lineIndex) => ({
    ...lineRangeToByteRange(index, lineIndex + 1, lineIndex + 1),
    startLine: lineIndex + 1,
    endLine: lineIndex + 1,
    exclusionRuleRef: 'fixture/excluded/v1',
    reasonCode,
  }));
}

function createV2Receipt(input: {
  root: string;
  sourceText: string;
  materialRoots: Array<{ sourceRootId: string; startLine: number; endLine: number }>;
}): Record<string, unknown> {
  const create = requiredFunction<(value: Record<string, unknown>) => Record<string, unknown>>(
    intakeModule,
    'createRequirementsContractFileIntakeReceiptV2'
  );
  return create({
    recordRoot: input.root,
    requirementSetId: 'REQ-LINEAGE-RANGE',
    entrySource: 'source_prd_draft',
    requestedArtifactRole: 'requirement_source_prd',
    sourcePath: 'docs/requirements/lineage-range.md',
    sourceContent: input.sourceText,
    materialRoots: input.materialRoots,
    capturedAt: '2026-09-20T00:00:00.000Z',
  });
}

function createV2Ledger(input: {
  receipt: Record<string, unknown>;
  sourceBytes: Buffer;
  materialRoots: Record<string, unknown>[];
  excludedRanges: ExcludedRange[];
}): Record<string, unknown> {
  const create = requiredFunction<(value: Record<string, unknown>) => Record<string, unknown>>(
    lineageModule,
    'createRequirementsContractIntentLineageLedgerV2'
  );
  return create(input);
}

describe('requirements contract intent lineage ranges', () => {
  afterEach(() => {
    for (const root of temporaryRoots.splice(0)) rmSync(root, { recursive: true, force: true });
  });

  it('coalesces ten thousand adjacent excluded lines into one range', () => {
    const sourceBytes = Buffer.from(source(10_000), 'utf8');
    const receipt = createV2Receipt({ root: recordRoot(), sourceText: sourceBytes.toString('utf8'), materialRoots: [] });
    const ledger = createV2Ledger({
      receipt,
      sourceBytes,
      materialRoots: [],
      excludedRanges: excludedLineRanges(sourceBytes),
    }) as { materialRoots: unknown[]; excludedRanges: ExcludedRange[] };

    expect(ledger.materialRoots).toHaveLength(0);
    expect(ledger.excludedRanges).toEqual([{
      startUtf8Byte: 0,
      endUtf8ByteExclusive: sourceBytes.length,
      startLine: 1,
      endLine: 10_000,
      exclusionRuleRef: 'fixture/excluded/v1',
      reasonCode: 'non_semantic',
    }]);
  });

  it.each([1, 109, 129, 1_000])('keeps R=%i roots without per-line classifications', (rootCount) => {
    const sourceText = source(rootCount + 1);
    const sourceBytes = Buffer.from(sourceText, 'utf8');
    const index = buildUtf8LineIndex(sourceBytes);
    const declaredRoots = Array.from({ length: rootCount }, (_value, rootIndex) => ({
      sourceRootId: `ROOT-${rootIndex + 1}`,
      startLine: rootIndex + 1,
      endLine: rootIndex + 1,
    }));
    const receipt = createV2Receipt({ root: recordRoot(), sourceText, materialRoots: declaredRoots });
    const materialRoots = declaredRoots.map((root) => ({
      sourceRootId: root.sourceRootId,
      disposition: 'source_root',
      sourceRange: {
        ...lineRangeToByteRange(index, root.startLine, root.endLine),
        startLine: root.startLine,
        endLine: root.endLine,
      },
      semanticNodeRefs: [`MUST-${root.sourceRootId}`],
    }));
    const excludedRanges = excludedLineRanges(sourceBytes).slice(rootCount);
    const ledger = createV2Ledger({ receipt, sourceBytes, materialRoots, excludedRanges }) as {
      materialRoots: unknown[];
    };

    expect(ledger.materialRoots).toHaveLength(rootCount);
    expect(JSON.stringify(ledger)).not.toMatch(/classifications|classificationHash|decisionHash/u);
  });

  it('coalesces only adjacent exclusions with the same rule and reason', () => {
    const coalesce = requiredFunction<(ranges: ExcludedRange[]) => ExcludedRange[]>(
      lineageModule,
      'coalesceIntentLineageRanges'
    );
    const bytes = Buffer.from('a\nb\nc\nd', 'utf8');
    const ranges = excludedLineRanges(bytes);
    ranges[1] = { ...ranges[1], reasonCode: 'metadata' };
    ranges[2] = { ...ranges[2], reasonCode: 'metadata' };

    expect(coalesce(ranges)).toHaveLength(3);
  });

  it('validates coverage unions, gaps, overlap, offsets and UTF-8 boundaries', () => {
    const validate = requiredFunction<(input: Record<string, unknown>) => void>(
      lineageModule,
      'validateIntentLineageCoverage'
    );
    const bytes = Buffer.from('甲\n乙\n丙', 'utf8');
    const index = buildUtf8LineIndex(bytes);
    const first = { ...lineRangeToByteRange(index, 1, 1), startLine: 1, endLine: 1 };
    const firstTwo = { ...lineRangeToByteRange(index, 1, 2), startLine: 1, endLine: 2 };
    const second = { ...lineRangeToByteRange(index, 2, 2), startLine: 2, endLine: 2 };
    const excluded = [{
      ...lineRangeToByteRange(index, 3, 3),
      startLine: 3,
      endLine: 3,
      exclusionRuleRef: 'fixture/excluded/v1',
      reasonCode: 'non_semantic',
    }];

    expect(() => validate({ sourceBytes: bytes, materialRanges: [firstTwo, second], excludedRanges: excluded })).not.toThrow();
    expect(() => validate({ sourceBytes: bytes, materialRanges: [firstTwo], excludedRanges: [{ ...excluded[0], ...lineRangeToByteRange(index, 2, 3), startLine: 2 }] })).toThrow(/overlap|coverage/u);
    expect(() => validate({ sourceBytes: bytes, materialRanges: [first], excludedRanges: excluded })).toThrow(/gap|coverage/u);
    expect(() => validate({ sourceBytes: bytes, materialRanges: [{ ...firstTwo, endUtf8ByteExclusive: bytes.length + 1 }], excludedRanges: [] })).toThrow(/range|offset|coverage/u);
    expect(() => validate({ sourceBytes: bytes, materialRanges: [{ ...firstTwo, startUtf8Byte: 1 }], excludedRanges: excluded })).toThrow(/UTF-8|utf8|range/u);
  });

  it('migrates only verified v1 ledgers without carrying per-row hashes', () => {
    const receipt = createRequirementsContractFileIntakeReceipt({
      requirementSetId: 'REQ-LINEAGE-MIGRATION',
      entrySource: 'source_prd_draft',
      requestedArtifactRole: 'requirement_source_prd',
      sourcePath: 'docs/requirements/legacy.md',
      sourceContent: 'material\nignored',
      capturedAt: '2026-09-20T00:00:00.000Z',
    });
    const legacy = lineageModule.createRequirementsContractIntentLineageLedger({
      intakeReceiptPath: 'authoring/intake/intake-receipt.json',
      intakeReceipt: receipt,
      classifications: [
        { spanId: receipt.excerpts[0].excerptId, disposition: 'source_root', classificationRule: 'fixture/root/v1', sourceRootRefs: ['ROOT-1'] },
        { spanId: receipt.excerpts[1].excerptId, disposition: 'excluded', classificationRule: 'fixture/excluded/v1', exclusionRuleRef: 'fixture/excluded/v1', exclusionReason: 'non_semantic', decisionHash: `sha256:${'a'.repeat(64)}` },
      ],
    });
    const migrate = requiredFunction<(input: Record<string, unknown>) => Record<string, unknown>>(
      lineageModule,
      'migrateIntentLineageV1ToV2'
    );
    const migrated = migrate({ recordRoot: recordRoot(), intakeReceipt: receipt, ledger: legacy });
    const serialized = JSON.stringify(migrated);

    expect(migrated.schemaVersion).toBe('requirements-contract-intent-lineage-ledger/v2');
    expect(serialized).not.toMatch(/classificationHash|classificationSetHash|decisionHash/u);
    expect(() => migrate({ recordRoot: recordRoot(), intakeReceipt: receipt, ledger: { ...legacy, ledgerHash: `sha256:${'0'.repeat(64)}` } })).toThrow(/verified|valid|ledger/u);
  });

  it('fails closed when one legacy root spans non-contiguous excerpts', () => {
    const receipt = createRequirementsContractFileIntakeReceipt({
      requirementSetId: 'REQ-LINEAGE-NONCONTIGUOUS',
      entrySource: 'source_prd_draft',
      requestedArtifactRole: 'requirement_source_prd',
      sourcePath: 'docs/requirements/noncontiguous.md',
      sourceContent: 'material-a\nignored\nmaterial-b',
      capturedAt: '2026-09-20T00:00:00.000Z',
    });
    const legacy = lineageModule.createRequirementsContractIntentLineageLedger({
      intakeReceiptPath: 'authoring/intake/intake-receipt.json',
      intakeReceipt: receipt,
      classifications: [
        { spanId: receipt.excerpts[0].excerptId, disposition: 'source_root', classificationRule: 'fixture/root/v1', sourceRootRefs: ['ROOT-1'] },
        { spanId: receipt.excerpts[1].excerptId, disposition: 'excluded', classificationRule: 'fixture/excluded/v1', exclusionRuleRef: 'fixture/excluded/v1', exclusionReason: 'non_semantic', decisionHash: `sha256:${'a'.repeat(64)}` },
        { spanId: receipt.excerpts[2].excerptId, disposition: 'source_root', classificationRule: 'fixture/root/v1', sourceRootRefs: ['ROOT-1'] },
      ],
    });
    const migrate = requiredFunction<(input: Record<string, unknown>) => Record<string, unknown>>(
      lineageModule,
      'migrateIntentLineageV1ToV2'
    );

    expect(() => migrate({ recordRoot: recordRoot(), intakeReceipt: receipt, ledger: legacy }))
      .toThrow('requirements_intent_lineage_v1_migration_noncontiguous_root');
  });

  it('keeps control metadata within the O(R + X) serialized budget', () => {
    const rootCount = 109;
    const sourceText = source(24_551);
    const sourceBytes = Buffer.from(sourceText, 'utf8');
    const index = buildUtf8LineIndex(sourceBytes);
    const declaredRoots = Array.from({ length: rootCount }, (_value, rootIndex) => ({ sourceRootId: `ROOT-${rootIndex + 1}`, startLine: rootIndex + 1, endLine: rootIndex + 1 }));
    const receipt = createV2Receipt({ root: recordRoot(), sourceText, materialRoots: declaredRoots });
    const materialRoots = declaredRoots.map((root) => ({ sourceRootId: root.sourceRootId, disposition: 'source_root', sourceRange: { ...lineRangeToByteRange(index, root.startLine, root.endLine), startLine: root.startLine, endLine: root.endLine }, semanticNodeRefs: [`MUST-${root.sourceRootId}`] }));
    const excludedRanges = excludedLineRanges(sourceBytes).slice(rootCount);
    const ledger = createV2Ledger({ receipt, sourceBytes, materialRoots, excludedRanges }) as { excludedRanges: unknown[] };
    const controlBytes = Buffer.byteLength(JSON.stringify(receipt) + JSON.stringify(ledger));

    expect(controlBytes).toBeLessThanOrEqual(65_536 + rootCount * 1_024 + ledger.excludedRanges.length * 512);
  });
});
