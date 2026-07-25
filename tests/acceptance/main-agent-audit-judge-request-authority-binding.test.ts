import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveAuditJudgeRequestAuthorityBinding } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-orchestration';
import {
  extractRequirementsContractImplementationConfirmation,
  sourceDocumentHashFor,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-implementation-confirmation-codec';

function normalizeForHash(value: unknown): unknown {
  if (typeof value === 'string') {
    return value.replace(/\r\n?/gu, '\n').normalize('NFC');
  }
  if (Array.isArray(value)) return value.map(normalizeForHash);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, normalizeForHash(child)])
  );
}

function canonicalObjectHash(value: unknown): string {
  return `sha256:${createHash('sha256')
    .update(JSON.stringify(normalizeForHash(value)), 'utf8')
    .digest('hex')}`;
}

function rawFileHash(content: string): string {
  return `sha256:${createHash('sha256').update(content, 'utf8').digest('hex')}`;
}

function materializeHashBoundModelPacket() {
  const root = mkdtempSync(path.join(os.tmpdir(), 'audit-judge-authority-binding-'));
  const sourceDocument = path.join('docs', 'requirements', `${randomUUID()}.md`);
  const sourcePath = path.join(root, sourceDocument);
  const sourceBehavior = `Observable behavior ${randomUUID()}`;
  const confirmationRequirementId = `MUST-${randomUUID()}`;
  const sourceContent = [
    `# ${randomUUID()}`,
    '',
    sourceBehavior,
    '',
    'implementationConfirmation:',
    '  status: draft',
    '  requirements:',
    `    - id: ${confirmationRequirementId}`,
    `      text: ${JSON.stringify(sourceBehavior)}`,
    '',
  ].join('\n');
  const extracted = extractRequirementsContractImplementationConfirmation(sourceContent);
  const sourceDocumentHash = sourceDocumentHashFor(
    sourceContent,
    extracted.blockText,
    extracted.value
  );
  mkdirSync(path.dirname(sourcePath), { recursive: true });
  writeFileSync(sourcePath, sourceContent, 'utf8');
  const identities = {
    must: [`MUST-${randomUUID()}`, `MUST-${randomUUID()}`],
    trace: `TRACE-${randomUUID()}`,
    evidence: `EVD-${randomUUID()}`,
    target: `TARGET-${randomUUID()}`,
  };
  const packet = {
    schemaVersion: 'req-trace-ai-tdd-model-packet/v1',
    sourceDocument,
    sourceDocumentHash,
    requirements: {
      must: identities.must.map((id, index) => ({
        id,
        text: `Observable behavior ${index + 1} ${randomUUID()}`,
      })),
    },
    traceSlices: [{ traceId: identities.trace }],
    contractExecutionManifest: {
      evidence: [{ id: identities.evidence }],
      targetModificationPaths: [
        {
          id: identities.target,
          path: `src/${randomUUID()}.ts`,
        },
      ],
    },
  };
  const relativePath = path.join('runtime', 'model_packet.json');
  const absolutePath = path.join(root, relativePath);
  mkdirSync(path.dirname(absolutePath), { recursive: true });
  const content = `${JSON.stringify(packet, null, 2)}\n`;
  writeFileSync(absolutePath, content, 'utf8');

  const projectionGroups = [
    'contractExecutionManifest.evidence',
    'contractExecutionManifest.targetModificationPaths',
    'requirements.must',
    'traceSlices',
  ];
  const projectionRefs = [
    identities.evidence,
    `contractExecutionManifest.evidence:${identities.evidence}`,
    identities.target,
    `contractExecutionManifest.targetModificationPaths:${identities.target}`,
    ...identities.must.flatMap((mustRef) => [
      mustRef,
      `requirements.must:${mustRef}`,
    ]),
    identities.trace,
    `traceSlices:${identities.trace}`,
  ].sort();

  return {
    root,
    relativePath,
    sourceDocument: sourceDocument.replace(/\\/gu, '/'),
    sourceContent,
    sourceBehavior,
    sourceDocumentHash,
    sourceBytesHash: rawFileHash(sourceContent),
    identities,
    sourceRequirementTexts: packet.requirements.must.map((row) => row.text),
    modelPacketHash: rawFileHash(content),
    projectionGroups,
    projectionRefs,
    projectionSetHash: canonicalObjectHash(projectionRefs),
  };
}

describe('Audit Review Judge request authority binding', () => {
  it('derives MUST and projection authority from the current hash-bound model packet', () => {
    const fixture = materializeHashBoundModelPacket();
    try {
      expect(
        resolveAuditJudgeRequestAuthorityBinding({
          projectRoot: fixture.root,
          modelPacketPath: fixture.relativePath,
          modelPacketHash: fixture.modelPacketHash,
          sourceDocumentHash: fixture.sourceDocumentHash,
          projectionSetHash: fixture.projectionSetHash,
        })
      ).toEqual({
        sourceDocument: fixture.sourceDocument,
        sourceBytesHash: fixture.sourceBytesHash,
        mustRefs: fixture.identities.must,
        sourceRequirementTexts: fixture.sourceRequirementTexts,
        packetProjectionSummary: {
          mustPacketCount: fixture.identities.must.length,
          projectionGroups: fixture.projectionGroups,
          projectionRefs: fixture.projectionRefs,
        },
      });
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it('rejects a plan projection-set hash that is not derived from the bound packet', () => {
    const fixture = materializeHashBoundModelPacket();
    try {
      expect(() =>
        resolveAuditJudgeRequestAuthorityBinding({
          projectRoot: fixture.root,
          modelPacketPath: fixture.relativePath,
          modelPacketHash: fixture.modelPacketHash,
          sourceDocumentHash: fixture.sourceDocumentHash,
          projectionSetHash: canonicalObjectHash([randomUUID()]),
        })
      ).toThrow('audit_judge_projection_set_hash_mismatch');
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it('rejects source semantics that do not match the bound sourceDocumentHash', () => {
    const fixture = materializeHashBoundModelPacket();
    try {
      writeFileSync(
        path.join(fixture.root, fixture.sourceDocument),
        fixture.sourceContent.replace(fixture.sourceBehavior, `Observable behavior ${randomUUID()}`),
        'utf8'
      );
      expect(() =>
        resolveAuditJudgeRequestAuthorityBinding({
          projectRoot: fixture.root,
          modelPacketPath: fixture.relativePath,
          modelPacketHash: fixture.modelPacketHash,
          sourceDocumentHash: fixture.sourceDocumentHash,
          projectionSetHash: fixture.projectionSetHash,
        })
      ).toThrow('audit_judge_source_document_hash_mismatch');
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it('derives current source bytes after a bookkeeping-only change preserves semantic identity', () => {
    const fixture = materializeHashBoundModelPacket();
    try {
      const changedSource = fixture.sourceContent.replace('status: draft', 'status: confirmed');
      const changedExtraction =
        extractRequirementsContractImplementationConfirmation(changedSource);
      expect(
        sourceDocumentHashFor(
          changedSource,
          changedExtraction.blockText,
          changedExtraction.value
        )
      ).toBe(fixture.sourceDocumentHash);
      writeFileSync(
        path.join(fixture.root, fixture.sourceDocument),
        changedSource,
        'utf8'
      );

      expect(
        resolveAuditJudgeRequestAuthorityBinding({
          projectRoot: fixture.root,
          modelPacketPath: fixture.relativePath,
          modelPacketHash: fixture.modelPacketHash,
          sourceDocumentHash: fixture.sourceDocumentHash,
          projectionSetHash: fixture.projectionSetHash,
        })
      ).toMatchObject({
        sourceDocument: fixture.sourceDocument,
        sourceBytesHash: rawFileHash(changedSource),
      });
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });
});
