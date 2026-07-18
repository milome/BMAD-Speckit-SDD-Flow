import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import yaml from 'js-yaml';
import { afterEach, describe, expect, it } from 'vitest';
import { resolveCloseoutSourceAuthority } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-delivery-closeout-gate';
import { implementationConfirmationHash } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/target-artifact-realization-gate';

type JsonObject = Record<string, unknown>;

const roots: string[] = [];
const confirmationBookkeepingFields = new Set([
  'status',
  'confirmedAt',
  'confirmedBy',
  'sourceDocumentHash',
  'implementationConfirmationHash',
  'reconfirmationRequest',
  'confirmationRender',
]);

function sha256Text(value: string): string {
  return `sha256:${createHash('sha256').update(value, 'utf8').digest('hex')}`;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  return `{${Object.keys(value as JsonObject)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify((value as JsonObject)[key])}`)
    .join(',')}}`;
}

function sourceHashes(sourceText: string): {
  sourceDocumentHash: string;
  implementationConfirmationHash: string;
} {
  const lines = sourceText.replace(/\r\n/gu, '\n').split('\n');
  const start = lines.findIndex((line) => /^implementationConfirmation:\s*$/u.test(line));
  const blockText = lines.slice(start).join('\n');
  const parsed = yaml.load(blockText) as { implementationConfirmation: JsonObject };
  const semanticConfirmation = Object.fromEntries(
    Object.entries(parsed.implementationConfirmation).filter(
      ([key]) => !confirmationBookkeepingFields.has(key)
    )
  );
  return {
    sourceDocumentHash: sha256Text(
      sourceText.replace(
        blockText,
        `implementationConfirmation:${stableStringify(semanticConfirmation)}`
      )
    ),
    implementationConfirmationHash: implementationConfirmationHash(
      parsed.implementationConfirmation
    ),
  };
}

function createAuthorityFixture(
  mutate: (record: JsonObject, sourcePath: string) => void = () => undefined
): {
  root: string;
  record: JsonObject;
  recordPath: string;
  sourcePath: string;
  syntheticSourcePath: string;
} {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'closeout-source-authority-'));
  roots.push(root);
  const recordId = `REQ-${randomUUID()}`;
  const recordRoot = path.join(
    root,
    '_bmad-output',
    'runtime',
    'requirement-records',
    recordId
  );
  const recordPath = path.join(recordRoot, 'requirement-record.json');
  const sourcePath = path.join(root, 'docs', 'requirements', `${recordId}.md`);
  const sourceText = [
    '# Closeout authority fixture',
    '',
    'implementationConfirmation:',
    '  status: user_confirmed',
    '  must: []',
    '  notDone: []',
    '  mustNot: []',
    '  evidence: []',
    '  traceRows: []',
    '  requiredCommands: []',
    '  artifactAutomationPlan: []',
    '  targetModificationPaths: []',
    '',
  ].join('\n');
  fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
  fs.writeFileSync(sourcePath, sourceText, 'utf8');
  const hashes = {
    ...sourceHashes(sourceText),
    semanticModelHash: sha256Text(`${randomUUID()}:semantic-model`),
  };
  const sourceAmendmentHashes = [sha256Text(`${randomUUID()}:source-amendment`)];
  const record: JsonObject = {
    recordId,
    requirementSetId: recordId,
    sourcePath,
    sourceDocumentHash: hashes.sourceDocumentHash,
    implementationConfirmationHash: hashes.implementationConfirmationHash,
    semanticModelHash: hashes.semanticModelHash,
    sourceAmendmentHashes,
    confirmationHistory: [{
      eventType: 'confirmation_recorded',
      recordId,
      requirementSetId: recordId,
      sourcePath,
      sourceDocumentHash: hashes.sourceDocumentHash,
      implementationConfirmationHash: hashes.implementationConfirmationHash,
      confirmedAt: new Date().toISOString(),
      confirmedBy: `fixture-${randomUUID()}`,
    }],
  };
  mutate(record, sourcePath);
  fs.mkdirSync(recordRoot, { recursive: true });
  fs.writeFileSync(recordPath, `${JSON.stringify(record, null, 2)}\n`, 'utf8');
  return {
    root,
    record,
    recordPath,
    sourcePath,
    syntheticSourcePath: path.join(
      recordRoot,
      'confirmation',
      'closeout-confirmation-source.md'
    ),
  };
}

function runCloseout(input: ReturnType<typeof createAuthorityFixture>) {
  return resolveCloseoutSourceAuthority({
    record: input.record,
    recordPath: input.recordPath,
    sourcePath:
      typeof input.record.sourcePath === 'string' ? input.record.sourcePath : undefined,
  });
}

afterEach(() => {
  while (roots.length > 0) {
    fs.rmSync(roots.pop()!, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
});

describe('main-agent closeout source authority', () => {
  it.each([
    ['source path', (record: JsonObject) => delete record.sourcePath],
    ['original source hash', (record: JsonObject) => delete record.sourceDocumentHash],
    ['source amendment hash', (record: JsonObject) => delete record.sourceAmendmentHashes],
    ['semantic model hash', (record: JsonObject) => delete record.semanticModelHash],
    [
      'confirmation hash',
      (record: JsonObject) => {
        record.implementationConfirmationHash = sha256Text(randomUUID());
      },
    ],
  ])('blocks when %s is unresolved', (_label, mutate) => {
    const fixture = createAuthorityFixture((record) => mutate(record));
    const authority = runCloseout(fixture);

    expect(authority.passed).toBe(false);
    expect(authority.blockingReasons).toContain('closeout_source_unresolved');
    expect(fs.existsSync(fixture.syntheticSourcePath)).toBe(false);
  });

  it('accepts a real confirmed source with matching authority hashes', () => {
    const fixture = createAuthorityFixture();
    const authority = runCloseout(fixture);

    expect(authority.passed).toBe(true);
    expect(authority.blockingReasons).toEqual([]);
  });

  it('contains no synthetic closeout writer or caller-cwd renderer binding', () => {
    const source = fs.readFileSync(
      path.join(
        process.cwd(),
        'packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-delivery-closeout-gate.ts'
      ),
      'utf8'
    );

    const forbidden = [
      'MUST-CLOSEOUT',
      'EVD-CLOSEOUT',
      'CMD-CLOSEOUT',
      'closeout evidence command',
      'writeSyntheticCloseoutSource',
    ];
    expect(forbidden.filter((literal) => source.includes(literal))).toEqual([]);
    const renderBody = source.slice(
      source.indexOf('function renderCloseoutConfirmation'),
      source.indexOf('function resolveArtifactPath')
    );
    expect(renderBody.includes('process.cwd()')).toBe(false);
  });
});
