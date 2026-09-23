import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import * as intakeModule from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-file-intake-receipt';
import {
  readRequirementsContentObject,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-content-store';
import { sha256Stable } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-semantic-resolver';
import { resolveProductionSourceContent } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-production-source-view';

const temporaryRoots: string[] = [];

function recordRoot(): string {
  const root = mkdtempSync(path.join(os.tmpdir(), 'requirements-file-intake-range-'));
  temporaryRoots.push(root);
  return root;
}

describe('requirements contract file intake ranges', () => {
  afterEach(() => {
    for (const root of temporaryRoots.splice(0)) {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('stores one source blob and one range per dynamic material root', () => {
    const createReceipt = Reflect.get(
      intakeModule,
      'createRequirementsContractFileIntakeReceiptV2'
    ) as ((input: Record<string, unknown>) => Record<string, unknown>) | undefined;
    expect(createReceipt).toBeTypeOf('function');
    if (!createReceipt) return;

    const root = recordRoot();
    const sourceContent = '# 标题\r\n第一条 😀\r\n忽略 A\r\n忽略 B\r\n第二条';
    const receipt = createReceipt({
      recordRoot: root,
      requirementSetId: 'REQ-RANGE',
      entrySource: 'source_prd_draft',
      requestedArtifactRole: 'requirement_source_prd',
      sourcePath: 'docs/requirements/range.md',
      sourceContent,
      materialRoots: [
        { sourceRootId: 'ROOT-001', startLine: 2, endLine: 2 },
        { sourceRootId: 'ROOT-002', startLine: 5, endLine: 5 },
      ],
      capturedAt: '2026-09-20T00:00:00.000Z',
    }) as {
      sourcePath: string;
      sourceBlobRef: Parameters<typeof readRequirementsContentObject>[0]['ref'];
      materialExcerpts: Array<{
        sourceRootId: string;
        range: {
          startUtf8Byte: number;
          endUtf8ByteExclusive: number;
          contentHash: string;
        };
      }>;
    };
    const bytes = readRequirementsContentObject({ recordRoot: root, ref: receipt.sourceBlobRef });

    expect(receipt.materialExcerpts).toHaveLength(2);
    expect(receipt.materialExcerpts.map((excerpt) =>
      bytes.subarray(excerpt.range.startUtf8Byte, excerpt.range.endUtf8ByteExclusive).toString('utf8')
    )).toEqual(['第一条 😀\r\n', '第二条']);

    const serialized = JSON.stringify(receipt);
    expect(serialized.match(/"sourcePath"/gu)).toHaveLength(1);
    expect(serialized).not.toContain('"content":');
    expect(serialized).not.toContain(sourceContent);
    expect(intakeModule.validateRequirementsContractFileIntakeReceipt(receipt)).toBe(true);
  });

  it('validates v2 ranges against the stored source blob', () => {
    const createReceipt = Reflect.get(
      intakeModule,
      'createRequirementsContractFileIntakeReceiptV2'
    ) as ((input: Record<string, unknown>) => Record<string, unknown>) | undefined;
    expect(createReceipt).toBeTypeOf('function');
    if (!createReceipt) return;
    const root = recordRoot();
    const receipt = createReceipt({
      recordRoot: root,
      requirementSetId: 'REQ-RANGE-TAMPER',
      entrySource: 'source_prd_draft',
      requestedArtifactRole: 'requirement_source_prd',
      sourcePath: 'docs/requirements/range.md',
      sourceContent: '甲\n乙',
      materialRoots: [{ sourceRootId: 'ROOT-001', startLine: 1, endLine: 1 }],
      capturedAt: '2026-09-20T00:00:00.000Z',
    });
    const tampered = structuredClone(receipt) as Record<string, any>;
    tampered.materialExcerpts[0].range.contentHash = `sha256:${'0'.repeat(64)}`;
    const { receiptHash: _ignored, ...payload } = tampered;
    tampered.receiptHash = sha256Stable(payload);
    expect(intakeModule.validateRequirementsContractFileIntakeReceipt(tampered, { recordRoot: root }))
      .toBe(false);
  });

  it('resolves only the declared source range from a shared blob', () => {
    const createReceipt = Reflect.get(
      intakeModule,
      'createRequirementsContractFileIntakeReceiptV2'
    ) as ((input: Record<string, unknown>) => Record<string, unknown>) | undefined;
    expect(createReceipt).toBeTypeOf('function');
    if (!createReceipt) return;
    const root = recordRoot();
    const receipt = createReceipt({
      recordRoot: root,
      requirementSetId: 'REQ-RANGE-VIEW',
      entrySource: 'source_prd_draft',
      requestedArtifactRole: 'requirement_source_prd',
      sourcePath: 'docs/requirements/range.md',
      sourceContent: 'prefix\n目标 😀\nsuffix',
      materialRoots: [{ sourceRootId: 'ROOT-001', startLine: 2, endLine: 2 }],
      capturedAt: '2026-09-20T00:00:00.000Z',
    });
    const excerpt = receipt.materialExcerpts[0];
    expect(resolveProductionSourceContent({
      value: { sourceBlobRef: receipt.sourceBlobRef, sourceRange: excerpt.range },
      recordRoot: root,
    })).toBe('目标 😀\n');
  });
});
