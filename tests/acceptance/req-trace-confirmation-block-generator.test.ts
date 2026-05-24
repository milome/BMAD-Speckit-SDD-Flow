import { execFileSync } from 'node:child_process';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import yaml from 'js-yaml';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const SCRIPT = path.join(
  ROOT,
  '_bmad',
  'skills',
  'req-trace-matrix-prompt-generator',
  'scripts',
  'generate_prompt.py'
);
const NODE_SCRIPT = path.join(
  ROOT,
  '_bmad',
  'skills',
  'req-trace-matrix-prompt-generator',
  'scripts',
  'generate_prompt.js'
);

let tempDir: string;

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'req-trace-confirmation-'));
});

afterEach(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
});

function writeSource(body: string): string {
  const file = path.join(tempDir, 'source.md');
  fs.writeFileSync(file, body, 'utf8');
  return file;
}

const BOOKKEEPING_FIELDS = new Set([
  'status',
  'confirmedAt',
  'confirmedBy',
  'sourceDocumentHash',
  'implementationConfirmationHash',
  'reconfirmationRequest',
  'confirmationRender',
]);

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  return `{${Object.keys(value)
    .sort()
    .map((key) => {
      const record = value as Record<string, unknown>;
      return `${JSON.stringify(key)}:${stableStringify(record[key])}`;
    })
    .join(',')}}`;
}

function sha256(content: string): string {
  return `sha256:${crypto.createHash('sha256').update(content, 'utf8').digest('hex')}`;
}

function semanticConfirmationForHash(confirmation: Record<string, unknown>): Record<string, unknown> {
  const semantic: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(confirmation)) {
    if (!BOOKKEEPING_FIELDS.has(key)) semantic[key] = value;
  }
  return semantic;
}

function extractConfirmation(sourceText: string): {
  blockText: string;
  confirmation: Record<string, unknown>;
} {
  const lines = sourceText.replace(/\r\n/g, '\n').split('\n');
  const start = lines.findIndex((line) => /^implementationConfirmation:\s*$/.test(line));
  if (start < 0) throw new Error('missing implementationConfirmation');
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.trim() === '') continue;
    if (/^\S/.test(line)) {
      end = i;
      break;
    }
  }
  const blockText = lines.slice(start, end).join('\n');
  const parsed = yaml.load(blockText) as { implementationConfirmation?: Record<string, unknown> };
  if (!parsed?.implementationConfirmation) throw new Error('invalid implementationConfirmation');
  return { blockText, confirmation: parsed.implementationConfirmation };
}

function currentHashes(sourcePath: string): {
  sourceDocumentHash: string;
  implementationConfirmationHash: string;
} {
  const sourceText = fs.readFileSync(sourcePath, 'utf8');
  const { blockText, confirmation } = extractConfirmation(sourceText);
  const semantic = semanticConfirmationForHash(confirmation);
  const normalizedBlock = `implementationConfirmation:${stableStringify(semantic)}`;
  return {
    sourceDocumentHash: sha256(sourceText.replace(blockText, normalizedBlock)),
    implementationConfirmationHash: sha256(stableStringify(semantic)),
  };
}

function writeRequirementRecord(
  sourcePath: string,
  overrides: Partial<{
    sourceDocumentHash: string;
    implementationConfirmationHash: string;
  }> = {}
): string {
  const recordPath = path.join(tempDir, 'requirement-record.json');
  const hashes = { ...currentHashes(sourcePath), ...overrides };
  fs.writeFileSync(
    recordPath,
    `${JSON.stringify(
      {
        recordId: 'REQ-TRACE-001',
        status: 'user_confirmed',
        ...hashes,
        confirmationHistory: [
          {
            eventType: 'confirmation_recorded',
            confirmedAt: '2026-05-10T00:00:00.000Z',
            confirmedBy: 'test-user',
            sourcePath,
            ...hashes,
            confirmationPageHash:
              'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
          },
        ],
      },
      null,
      2
    )}\n`,
    'utf8'
  );
  return recordPath;
}

function run(
  args: string[],
  options: { env?: NodeJS.ProcessEnv } = {}
): { stdout: string; status: number } {
  try {
    const stdout = execFileSync('python', [SCRIPT, ...args], {
      cwd: ROOT,
      encoding: 'utf8',
      env: options.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { stdout, status: 0 };
  } catch (error: any) {
    return { stdout: String(error.stdout ?? ''), status: error.status ?? 1 };
  }
}

function runNodePrompt(args: string[]): { stdout: string; status: number } {
  try {
    const stdout = execFileSync(process.execPath, [NODE_SCRIPT, ...args], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { stdout, status: 0 };
  } catch (error: any) {
    return { stdout: String(error.stdout ?? ''), status: error.status ?? 1 };
  }
}

function validSource(overrides = ''): string {
  return `# Source

implementationConfirmation:
  status: user_confirmed
  confirmedAt: "2026-05-10"
  confirmedBy: "user"
  sourceDocumentHash: "hash"
  must:
    - id: MUST-001
      text: "Valid upload persists a file."
      evidenceRefs: ["EVD-001"]
  notDone:
    - id: NEG-001
      text: "Empty file must not display success."
      evidenceRefs: ["EVD-002"]
  mustNot:
    - id: OUT-001
      text: "Batch upload is out of scope."
  evidence:
    - id: EVD-001
      text: "Run upload acceptance."
      gate: "npm run test:e2e -- upload"
      oracle: "file exists"
    - id: EVD-002
      text: "Run invalid upload acceptance."
      gate: "npm run test:e2e -- upload-invalid"
      oracle: "no file exists"
  openQuestions: []
  traceRows:
    - id: TRACE-001
      covers: ["MUST-001", "NEG-001"]
      taskRefs: []
      evidenceRefs: ["EVD-001", "EVD-002"]
      contractValidationCommandRefs: ["CMD-CONTRACT-001"]
      deliveryEvidenceCommandRefs: ["CMD-DELIVERY-001", "CMD-DELIVERY-002"]
      boundaryViewRefs: ["BOUNDARY-001"]
      status: PENDING
  boundaryViews:
    - id: BOUNDARY-001
      title: "Upload scope boundary"
      covers: ["OUT-001"]
  requiredCommands:
    - id: CMD-CONTRACT-001
      command: "node _bmad/skills/requirements-contract-authoring/scripts/render-requirements-confirmation-html.ts --source source.md"
      purpose: "Validate the confirmation source."
    - id: CMD-DELIVERY-001
      command: "npm run test:e2e -- upload"
      purpose: "Produce positive-path delivery evidence."
    - id: CMD-DELIVERY-002
      command: "npm run test:e2e -- upload-invalid"
      purpose: "Produce negative-path delivery evidence."
  suggestedCommands:
    - id: CMD-SUGGESTED-001
      command: "npm run lint"
      purpose: "Optional quality signal; not acceptance evidence."
  closeoutReadinessPreview:
    requiredCommands: ["CMD-CONTRACT-001", "CMD-DELIVERY-001", "CMD-DELIVERY-002"]
${overrides}`;
}

describe('req trace generator confirmation block gate', () => {
  it('generates a prompt only from a confirmed source document', () => {
    const source = writeSource(validSource());
    const record = writeRequirementRecord(source);
    const result = run(['--source-document', source, '--requirement-record', record]);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('$executing-plans $verification-before-completion');
    expect(result.stdout).toContain('#implementationConfirmation');
    expect(result.stdout).toContain('TRACE-001');
    expect(result.stdout).toContain('Trace order:');
    expect(result.stdout).toContain('执行切片:');
    expect(result.stdout).toContain('contract gates: CMD-CONTRACT-001');
    expect(result.stdout).toContain('delivery gates: CMD-DELIVERY-001, CMD-DELIVERY-002');
    expect(result.stdout).toContain('Required commands:');
    expect(result.stdout).toContain('CMD-CONTRACT-001:');
    expect(result.stdout).toContain('node _bmad/skills/requirements-contract-authoring/scripts/render-requirements-confirmation-html.ts --source source.md');
    expect(result.stdout).toContain('Suggested smoke only, not acceptance by itself:');
    expect(result.stdout).toContain('npm run lint');
    expect(result.stdout).toContain('PASS requires evidence for covered must, notDone, and evidence IDs');
    expect(result.stdout).not.toContain('MISSING_INPUT: final gate commands');
    expect(result.stdout).not.toContain('$requirements-contract-authoring');
  });

  it('keeps the legacy Python entrypoint working without PyYAML by delegating to Node js-yaml', () => {
    const source = writeSource(validSource());
    const record = writeRequirementRecord(source);
    const noYamlPath = path.join(tempDir, 'no-pyyaml');
    fs.mkdirSync(noYamlPath, { recursive: true });
    fs.writeFileSync(
      path.join(noYamlPath, 'yaml.py'),
      'raise ImportError("forced no PyYAML for shim compatibility test")\n',
      'utf8'
    );
    const result = run(['--source-document', source, '--requirement-record', record], {
      env: {
        ...process.env,
        PYTHONPATH: noYamlPath,
      },
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('$executing-plans $verification-before-completion');
    expect(result.stdout).toContain('TRACE-001');
  });

  it('supports the Node js-yaml entrypoint directly', () => {
    const source = writeSource(validSource());
    const record = writeRequirementRecord(source);
    const result = runNodePrompt(['--source-document', source, '--requirement-record', record]);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('$executing-plans $verification-before-completion');
    expect(result.stdout).toContain('TRACE-001');
  });

  it('keeps Python shim output byte-equivalent to the Node prompt generator', () => {
    const source = writeSource(validSource());
    const record = writeRequirementRecord(source);
    const args = ['--source-document', source, '--requirement-record', record];
    const pythonResult = run(args);
    const nodeResult = runNodePrompt(args);

    expect(pythonResult.status).toBe(0);
    expect(nodeResult.status).toBe(0);
    expect(pythonResult.stdout).toBe(nodeResult.stdout);
  });

  it('blocks trace command refs that are not declared as required commands', () => {
    const source = writeSource(
      validSource().replace(
        '  requiredCommands:',
        '  requiredCommands:\n    - id: CMD-OTHER\n      command: "npm run other"\n      purpose: "Wrong command."\n  unusedCommands:'
      )
    );
    const record = writeRequirementRecord(source);
    const result = runNodePrompt(['--source-document', source, '--requirement-record', record]);

    expect(result.status).toBe(3);
    expect(result.stdout).toContain('BLOCK: COMMAND_REFERENCE_INVALID');
    expect(result.stdout).toContain('TRACE-001.contractValidationCommandRefs:CMD-CONTRACT-001');
  });

  it('blocks referenced required commands without runnable command text', () => {
    const source = writeSource(validSource().replace('      command: "npm run test:e2e -- upload"', '      command: ""'));
    const record = writeRequirementRecord(source);
    const result = runNodePrompt(['--source-document', source, '--requirement-record', record]);

    expect(result.status).toBe(3);
    expect(result.stdout).toContain('BLOCK: COMMAND_DEFINITION_INVALID');
    expect(result.stdout).toContain('CMD-DELIVERY-001.command');
  });

  it('blocks duplicate required command IDs before prompt generation', () => {
    const source = writeSource(
      validSource().replace(
        '    - id: CMD-DELIVERY-002\n      command: "npm run test:e2e -- upload-invalid"',
        '    - id: CMD-DELIVERY-001\n      command: "npm run test:e2e -- upload-invalid"'
      )
    );
    const record = writeRequirementRecord(source);
    const result = runNodePrompt(['--source-document', source, '--requirement-record', record]);

    expect(result.status).toBe(3);
    expect(result.stdout).toContain('BLOCK: COMMAND_DEFINITION_INVALID');
    expect(result.stdout).toContain('IDs must be unique: CMD-DELIVERY-001');
  });

  it('blocks confirmed source documents without any final gate commands', () => {
    const source = writeSource(
      validSource()
        .replace('      contractValidationCommandRefs: ["CMD-CONTRACT-001"]\n', '')
        .replace('      deliveryEvidenceCommandRefs: ["CMD-DELIVERY-001", "CMD-DELIVERY-002"]\n', '')
        .replace(/ {2}requiredCommands:[\s\S]* {2}closeoutReadinessPreview:\n {4}requiredCommands: \["CMD-CONTRACT-001", "CMD-DELIVERY-001", "CMD-DELIVERY-002"\]\n/u, '')
        .replace('      gate: "npm run test:e2e -- upload"', '      gate: "Implementation Readiness Gate"')
        .replace('      gate: "npm run test:e2e -- upload-invalid"', '      gate: "Manual Review Gate"')
    );
    const record = writeRequirementRecord(source);
    const result = runNodePrompt(['--source-document', source, '--requirement-record', record]);

    expect(result.status).toBe(3);
    expect(result.stdout).toContain('BLOCK: FINAL_GATES_REQUIRED');
  });

  it('blocks confirmed source documents without a requirement record', () => {
    const source = writeSource(validSource());
    const result = run(['--source-document', source]);

    expect(result.status).toBe(3);
    expect(result.stdout).toContain('BLOCK: CONFIRMATION_RECORD_REQUIRED');
  });

  it('blocks when latest confirmation history hashes do not match the current source', () => {
    const source = writeSource(validSource());
    const record = writeRequirementRecord(source, {
      sourceDocumentHash: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    });
    const result = run(['--source-document', source, '--requirement-record', record]);

    expect(result.status).toBe(3);
    expect(result.stdout).toContain('BLOCK: CONFIRMATION_RECORD_HASH_MISMATCH');
    expect(result.stdout).toContain('sourceDocumentHash');
  });

  it('blocks draft confirmation blocks', () => {
    const source = writeSource(validSource().replace('status: user_confirmed', 'status: draft'));
    const result = run(['--source-document', source]);

    expect(result.status).toBe(3);
    expect(result.stdout).toContain('BLOCK: CONFIRMATION_REQUIRED');
  });

  it('blocks missing confirmation blocks', () => {
    const source = writeSource('# Source without confirmation\n');
    const result = run(['--source-document', source]);

    expect(result.status).toBe(3);
    expect(result.stdout).toContain('BLOCK: SOURCE_DOCUMENT_REQUIRED');
  });

  it('blocks blocking open questions', () => {
    const source = writeSource(
      validSource().replace(
        'openQuestions: []',
        `openQuestions:
    - id: Q-001
      text: "Who owns rollback?"
      blocksImplementation: true`
      )
    );
    const result = run(['--source-document', source]);

    expect(result.status).toBe(3);
    expect(result.stdout).toContain('BLOCK: BLOCKING_QUESTIONS');
  });

  it('blocks invalid trace references', () => {
    const source = writeSource(validSource().replace('MUST-001", "NEG-001', 'MUST-001", "NEG-999'));
    const result = run(['--source-document', source]);

    expect(result.status).toBe(3);
    expect(result.stdout).toContain('BLOCK: TRACE_REFERENCE_INVALID');
  });

  it('blocks conversation-style source-file input', () => {
    const source = writeSource(validSource());
    const result = run(['--source-file', source]);

    expect(result.status).toBe(3);
    expect(result.stdout).toContain('BLOCK: SESSION_INPUT_NEEDS_SOURCE_DOCUMENT');
  });
});
