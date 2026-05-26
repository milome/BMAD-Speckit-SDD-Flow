import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { mainStrictCommandResolutionPreflight } from '../../scripts/strict-command-resolution-preflight';

const SOURCE_HASH = 'sha256:1111111111111111111111111111111111111111111111111111111111111111';
const IMPLEMENTATION_HASH = 'sha256:2222222222222222222222222222222222222222222222222222222222222222';

function writeJson(filePath: string, value: unknown): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function writeSource(root: string, overrides = ''): string {
  const sourcePath = path.join(root, 'docs', 'design', 'source.md');
  mkdirSync(path.dirname(sourcePath), { recursive: true });
  writeFileSync(
    sourcePath,
    `# Source

implementationConfirmation:
  status: user_confirmed
  recordId: REQ-CMD-PREFLIGHT
  requirementSetId: REQ-CMD-PREFLIGHT
  sourceDocumentHash: ${SOURCE_HASH}
  implementationConfirmationHash: ${IMPLEMENTATION_HASH}
  requiredCommands:
    - id: CMD-OK
      commandId: CMD-OK
      kind: delivery_evidence
      command: npx vitest run tests/acceptance/example.test.ts
      packageScripts: []
      entrypoints:
        - scripts/example.ts
      testGlobs:
        - tests/acceptance/example.test.ts
      mustResolve:
        packageScriptsExist: false
        entrypointsExist: true
        testFilesExist: true
    ${overrides}
  traceRows:
    - id: TRACE-001
      covers: ["MUST-001"]
      evidenceRefs: ["EVD-001"]
      contractValidationCommandRefs: []
      deliveryEvidenceCommandRefs: ["CMD-OK"]
      status: PENDING
`,
    'utf8'
  );
  return sourcePath;
}

function writeRecord(root: string, sourcePath: string): string {
  const recordPath = path.join(
    root,
    '_bmad-output',
    'runtime',
    'requirement-records',
    'REQ-CMD-PREFLIGHT',
    'requirement-record.json'
  );
  writeJson(recordPath, {
    recordId: 'REQ-CMD-PREFLIGHT',
    requirementSetId: 'REQ-CMD-PREFLIGHT',
    sourcePath,
    status: 'user_confirmed',
    sourceDocumentHash: SOURCE_HASH,
    implementationConfirmationHash: IMPLEMENTATION_HASH,
    confirmationHistory: [
      {
        eventType: 'confirmation_recorded',
        recordId: 'REQ-CMD-PREFLIGHT',
        requirementSetId: 'REQ-CMD-PREFLIGHT',
        confirmedAt: '2026-05-22T00:00:00.000Z',
        confirmedBy: 'test',
        sourcePath,
        sourceDocumentHash: SOURCE_HASH,
        implementationConfirmationHash: IMPLEMENTATION_HASH,
        confirmationPageHash: SOURCE_HASH,
        confirmationText: 'confirmed',
        renderReportPath:
          '_bmad-output/runtime/requirement-records/REQ-CMD-PREFLIGHT/confirmation/confirmation-render-report.json',
        htmlPath:
          '_bmad-output/runtime/requirement-records/REQ-CMD-PREFLIGHT/confirmation/confirmation.html',
      },
    ],
  });
  return recordPath;
}

describe('strict command resolution preflight', () => {
  it('passes when every command ref resolves to real entrypoints and non-empty globs', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'strict-command-pass-'));
    const previousCwd = process.cwd();
    try {
      mkdirSync(path.join(root, 'scripts'), { recursive: true });
      mkdirSync(path.join(root, 'tests', 'acceptance'), { recursive: true });
      writeFileSync(path.join(root, 'scripts', 'example.ts'), 'export {};\n', 'utf8');
      writeFileSync(path.join(root, 'tests', 'acceptance', 'example.test.ts'), 'export {};\n', 'utf8');
      writeJson(path.join(root, 'package.json'), { scripts: {} });
      const sourcePath = writeSource(root);
      const recordPath = writeRecord(root, sourcePath);
      process.chdir(root);
      const code = mainStrictCommandResolutionPreflight([
        '--requirement-record',
        recordPath,
        '--evaluated-at',
        '2026-05-22T00:00:01.000Z',
        '--json',
      ]);
      expect(code).toBe(0);
      const record = JSON.parse(readFileSync(recordPath, 'utf8'));
      expect(record.gateChecks.at(-1)).toMatchObject({
        gate: 'Strict Command Resolution Preflight',
        decision: 'pass',
      });
      expect(record.lastEventType).toBe('strict_command_resolution_preflight_recorded');
    } finally {
      process.chdir(previousCwd);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('resolves portable skill-dir command placeholders in consumer installs', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'strict-command-skill-dir-'));
    const previousCwd = process.cwd();
    try {
      const skillDir = path.join(root, '.codex', 'skills', 'requirements-contract-authoring');
      mkdirSync(path.join(root, 'scripts'), { recursive: true });
      mkdirSync(path.join(root, 'tests', 'acceptance'), { recursive: true });
      writeFileSync(path.join(root, 'scripts', 'example.ts'), 'export {};\n', 'utf8');
      writeFileSync(path.join(root, 'tests', 'acceptance', 'example.test.ts'), 'export {};\n', 'utf8');
      mkdirSync(path.join(skillDir, 'scripts'), { recursive: true });
      writeFileSync(path.join(skillDir, 'SKILL.md'), '---\nname: requirements-contract-authoring\n---\n', 'utf8');
      writeFileSync(path.join(skillDir, 'scripts', 'render-requirements-confirmation-html.ts'), 'export {};\n', 'utf8');
      writeJson(path.join(root, 'package.json'), { scripts: {} });
      const sourcePath = writeSource(
        root,
        `
    - id: CMD-SKILL
      commandId: CMD-SKILL
      kind: contract_validation
      command: node <skill-dir>/scripts/render-requirements-confirmation-html.ts --source <source-document.md>
      packageScripts: []
      entrypoints:
        - <skill-dir>/scripts/render-requirements-confirmation-html.ts
      testGlobs: []
      mustResolve:
        packageScriptsExist: false
        entrypointsExist: true
        testFilesExist: false
`
      );
      const recordPath = writeRecord(root, sourcePath);
      process.chdir(root);
      const code = mainStrictCommandResolutionPreflight([
        '--requirement-record',
        recordPath,
        '--evaluated-at',
        '2026-05-22T00:00:02.000Z',
        '--json',
      ]);
      expect(code).toBe(0);
      const record = JSON.parse(readFileSync(recordPath, 'utf8'));
      const commands = record.gateChecks.at(-1).checks.find((check: any) => check.id === 'command-resolution:CMD-SKILL');
      expect(commands).toMatchObject({ passed: true, issues: [] });
    } finally {
      process.chdir(previousCwd);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails closed for missing entrypoints and empty test globs', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'strict-command-block-'));
    const previousCwd = process.cwd();
    try {
      writeJson(path.join(root, 'package.json'), { scripts: {} });
      const sourcePath = writeSource(root);
      const recordPath = writeRecord(root, sourcePath);
      process.chdir(root);
      const code = mainStrictCommandResolutionPreflight([
        '--requirement-record',
        recordPath,
        '--evaluated-at',
        '2026-05-22T00:00:01.000Z',
        '--json',
      ]);
      expect(code).toBe(1);
      const record = JSON.parse(readFileSync(recordPath, 'utf8'));
      expect(record.gateChecks.at(-1).blockingReasons).toEqual(
        expect.arrayContaining([
          'command_unresolved:CMD-OK:entrypoint_missing:scripts/example.ts',
          'command_unresolved:CMD-OK:test_glob_empty:tests/acceptance/example.test.ts',
        ])
      );
    } finally {
      process.chdir(previousCwd);
      rmSync(root, { recursive: true, force: true });
    }
  });
});
