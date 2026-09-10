import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { materializeAiTddManifestCloseoutRunnerFixture } from '../helpers/requirement-fixture-runtime';

const ROOT = process.cwd();
const SCRIPT = path.join(
  ROOT,
  '_bmad',
  'skills',
  'req-trace-matrix-prompt-generator',
  'scripts',
  'generate_prompt.js'
);
const CANONICAL_PROFILE = path.join(
  ROOT,
  '_bmad',
  'shared',
  'goal-contract',
  'goal-contract-profile.json'
);
const DIRECT_ENTRY_ARGS = ['--entry', 'req_trace_direct'] as const;
let tempDir: string;
let fixture: ReturnType<typeof materializeAiTddManifestCloseoutRunnerFixture>;

vi.setConfig({ testTimeout: 120_000 });

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'req-trace-fragments-'));
  fixture = materializeAiTddManifestCloseoutRunnerFixture({
    root: path.join(tempDir, 'workspace'),
  });
}, 30_000);

afterEach(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
}, 30_000);

describe('req trace human prompt required fragment audit', () => {
  it('records required fragment audit evidence and keeps human prompt projection-only', () => {
    const outDir = path.join(tempDir, 'fragments');
    execFileSync(
      process.execPath,
      [
        SCRIPT,
        ...DIRECT_ENTRY_ARGS,
        '--source-document',
        fixture.sourcePath,
        '--requirement-record',
        fixture.recordPath,
        '--out-dir',
        outDir,
        '--execution-host',
        'cursor-ide',
        '--prompt-language',
        'auto',
        '--human-prompt-profile',
        'full',
        '--json',
      ],
      { cwd: fixture.root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
    );

    const prompt = fs.readFileSync(path.join(outDir, 'human_prompt.txt'), 'utf8');
    const receipt = JSON.parse(fs.readFileSync(path.join(outDir, 'audit_receipt.json'), 'utf8'));
    const packet = JSON.parse(fs.readFileSync(path.join(outDir, 'model_packet.json'), 'utf8'));

    expect(packet.authorityPolicy).toMatchObject({
      primaryAuthority: 'model_packet.json',
      humanPromptRole: 'projection_only',
    });
    expect(receipt.humanPromptRequiredFragmentsPassed).toBe(true);
    expect(receipt.humanPromptMissingRequiredFragments).toEqual([]);
    for (const fragment of receipt.humanPromptRequiredFragments) {
      expect(prompt, `missing prompt fragment: ${fragment}`).toContain(fragment);
    }
    expect(receipt.humanPromptRequiredFragments).toEqual(
      expect.arrayContaining([
        '$executing-plans $verification-before-completion',
        'model_packet.json is the machine-readable execution authority',
        'confirmed source traceRows are contract projection only',
        'Runtime closure authority is the requirement-record/control store',
        'Required commands:',
        'PASS requires evidence for covered must, notDone, and evidence IDs',
        'MISSING_EVIDENCE',
        'reconfirm_required',
        'Completion Evidence Packet',
      ])
    );
  });

  it('blocks the receipt when a rendered human prompt misses a required fragment', () => {
    const patchedScriptDir = path.join(tempDir, 'patched-scripts');
    fs.mkdirSync(patchedScriptDir, { recursive: true });
    const patchedScript = path.join(patchedScriptDir, 'generate_prompt.js');
    fs.copyFileSync(
      path.join(
        ROOT,
        '_bmad',
        'skills',
        'req-trace-matrix-prompt-generator',
        'scripts',
        'load-js-yaml.js'
      ),
      path.join(patchedScriptDir, 'load-js-yaml.js')
    );
    fs.copyFileSync(
      path.join(
        ROOT,
        '_bmad',
        'skills',
        'req-trace-matrix-prompt-generator',
        'scripts',
        'resolve-bmad-runtime.js'
      ),
      path.join(patchedScriptDir, 'resolve-bmad-runtime.js')
    );
    fs.copyFileSync(
      path.join(
        ROOT,
        '_bmad',
        'skills',
        'req-trace-matrix-prompt-generator',
        'scripts',
        'publish-artifact-set.js'
      ),
      path.join(patchedScriptDir, 'publish-artifact-set.js')
    );
    const sharedManifestDir = path.join(
      fixture.root,
      '_bmad',
      'shared',
      'contract-execution-manifest'
    );
    fs.mkdirSync(sharedManifestDir, { recursive: true });
    for (const name of [
      'build-contract-execution-manifest.js',
      'hash-contract-execution-manifest.js',
      'normalize-contract-execution-manifest.js',
    ]) {
      fs.copyFileSync(
        path.join(ROOT, '_bmad', 'shared', 'contract-execution-manifest', name),
        path.join(sharedManifestDir, name)
      );
    }
    fs.copyFileSync(
      path.join(
        ROOT,
        '_bmad',
        'skills',
        'requirements-contract-authoring',
        'scripts',
        'confirmation_drift_classifier.js'
      ),
      path.join(patchedScriptDir, 'confirmation_drift_classifier.js')
    );
    fs.writeFileSync(
      patchedScript,
      fs
        .readFileSync(SCRIPT, 'utf8')
        .replace(
          '../../requirements-contract-authoring/scripts/confirmation_drift_classifier',
          './confirmation_drift_classifier'
        )
        .replace(
          'model_packet.json is the machine-readable execution authority.',
          'model packet json is the machine readable execution authority.'
        ),
      'utf8'
    );
    const outDir = path.join(tempDir, 'blocked-fragments');
    let stdout = '';
    let stderr = '';
    let status = 0;
    try {
      stdout = execFileSync(
        process.execPath,
        [
          patchedScript,
          ...DIRECT_ENTRY_ARGS,
          '--goal-contract-profile',
          CANONICAL_PROFILE,
          '--source-document',
          fixture.sourcePath,
          '--requirement-record',
          fixture.recordPath,
          '--out-dir',
          outDir,
          '--execution-host',
          'cursor-ide',
          '--prompt-language',
          'auto',
          '--human-prompt-profile',
          'full',
          '--json',
        ],
        { cwd: fixture.root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
          env: { ...process.env, BMAD_SPECKIT_PACKAGE_ROOT: path.join(ROOT, 'packages', 'bmad-speckit') } }
      );
    } catch (error: any) {
      stdout = String(error.stdout ?? '');
      stderr = String(error.stderr ?? '');
      status = error.status ?? 1;
    }

    expect(status, stderr).toBe(3);
    expect(JSON.parse(stdout)).toMatchObject({
      decision: 'blocked',
      blockingReasons: expect.arrayContaining([
        'HUMAN_PROMPT_REQUIRED_FRAGMENT_MISSING:model_packet.json is the machine-readable execution authority',
      ]),
    });
    const receipt = JSON.parse(fs.readFileSync(path.join(outDir, 'audit_receipt.json'), 'utf8'));
    expect(receipt.decision).toBe('blocked');
    expect(receipt.blockingReasons).toContain(
      'HUMAN_PROMPT_REQUIRED_FRAGMENT_MISSING:model_packet.json is the machine-readable execution authority'
    );
  });
});
