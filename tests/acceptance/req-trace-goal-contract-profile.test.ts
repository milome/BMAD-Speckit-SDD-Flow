import { execFileSync } from 'node:child_process';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const SCRIPT = path.join(
  ROOT,
  '_bmad',
  'skills',
  'req-trace-matrix-prompt-generator',
  'scripts',
  'generate_prompt.js'
);
const SOURCE = path.join(
  ROOT,
  'docs',
  'requirements',
  '2026-05-25-ai-tdd-manifest-closeout-runner.md'
);
const RECORD = path.join(
  ROOT,
  '_bmad-output',
  'runtime',
  'requirement-records',
  'REQ-AI-TDD-MANIFEST-CLOSEOUT-RUNNER',
  'requirement-record.json'
);
const PROFILE = path.join(ROOT, '_bmad', 'shared', 'goal-contract', 'goal-contract-profile.json');

let tempDir: string;
let originalProfile: string;

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'req-trace-goal-profile-'));
  originalProfile = fs.readFileSync(PROFILE, 'utf8');
});

afterEach(() => {
  fs.writeFileSync(PROFILE, originalProfile, 'utf8');
  fs.rmSync(tempDir, { recursive: true, force: true });
});

function runNativeGoal(): { status: number; stdout: string; stderr: string; outDir: string } {
  const outDir = path.join(tempDir, 'out');
  try {
    const stdout = execFileSync(
      process.execPath,
      [
        SCRIPT,
        '--source-document',
        SOURCE,
        '--requirement-record',
        RECORD,
        '--out-dir',
        outDir,
        '--execution-host',
        'codex',
        '--goal-command-available',
        'true',
        '--json',
      ],
      { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
    );
    return { status: 0, stdout, stderr: '', outDir };
  } catch (error: any) {
    return {
      status: error.status ?? 1,
      stdout: String(error.stdout ?? ''),
      stderr: String(error.stderr ?? ''),
      outDir,
    };
  }
}

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

function profileHashFor(profile: Record<string, any>): string {
  return sha256(stableStringify({ ...profile, profileHash: null }));
}

function writeProfile(mutator: (profile: Record<string, any>) => Record<string, any>) {
  const profile = JSON.parse(originalProfile);
  const next = mutator(profile);
  if (next.__preserveProfileHash !== true) next.profileHash = profileHashFor(next);
  delete next.__preserveProfileHash;
  fs.writeFileSync(PROFILE, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
}

describe('req-trace shared goal contract profile integration', () => {
  it('records shared template/profile/renderer audit in native /goal mode', () => {
    const result = runNativeGoal();

    expect(result.status).toBe(0);
    const receipt = JSON.parse(
      fs.readFileSync(path.join(result.outDir, 'audit_receipt.json'), 'utf8')
    );
    const goalDocument = fs.readFileSync(path.join(result.outDir, 'goal_execution.md'), 'utf8');
    expect(receipt.goalContractTemplate).toMatchObject({
      templatePath: '_bmad/shared/goal-contract/goal-execution-contract-template.md',
      profileVersion: '1.1.0',
      rendererVersion: 'req-trace-goal-contract-renderer/v1',
      compatibilityDecision: 'pass',
      requiredSlotsPassed: true,
      missingRequiredSlots: [],
      requiredSectionsPassed: true,
      missingRequiredSections: [],
      invariantFragmentsPassed: true,
      missingInvariantFragments: [],
    });
    expect(receipt.goalContractTemplate.templateHash).toMatch(/^sha256:/);
    expect(receipt.goalContractTemplate.profileHash).toMatch(/^sha256:/);
    expect(goalDocument).toContain('goalContractProfileVersion: 1.1.0');
    expect(goalDocument).toContain('goalContractProfileHash:');
    expect(goalDocument).toContain('model_packet.json is the machine-readable execution authority');
    expect(goalDocument).toContain('goal_execution.md is not execution authority');
  });

  it('blocks when the shared profile is missing', () => {
    fs.renameSync(PROFILE, `${PROFILE}.bak-test`);
    try {
      const result = runNativeGoal();
      expect(result.status).toBe(3);
      const receipt = JSON.parse(
        fs.readFileSync(path.join(result.outDir, 'audit_receipt.json'), 'utf8')
      );
      expect(receipt.blockingReasons).toContain('GOAL_CONTRACT_PROFILE_MISSING');
      expect(fs.existsSync(path.join(result.outDir, 'goal_execution.md'))).toBe(false);
    } finally {
      fs.renameSync(`${PROFILE}.bak-test`, PROFILE);
    }
  });

  it('blocks profile hash mismatches', () => {
    writeProfile((profile) => ({
      ...profile,
      profileHash: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      __preserveProfileHash: true,
    }));
    const result = runNativeGoal();

    expect(result.status).toBe(3);
    const receipt = JSON.parse(
      fs.readFileSync(path.join(result.outDir, 'audit_receipt.json'), 'utf8')
    );
    expect(receipt.blockingReasons).toContain('GOAL_CONTRACT_PROFILE_HASH_MISMATCH');
    expect(fs.existsSync(path.join(result.outDir, 'goal_execution.md'))).toBe(false);
  });

  it('blocks unsupported profile major versions', () => {
    writeProfile((profile) => ({
      ...profile,
      profileVersion: '2.0.0',
      compatibility: { ...profile.compatibility, supportedMajorVersions: [1] },
    }));
    const result = runNativeGoal();

    expect(result.status).toBe(3);
    const receipt = JSON.parse(
      fs.readFileSync(path.join(result.outDir, 'audit_receipt.json'), 'utf8')
    );
    expect(receipt.blockingReasons).toContain('GOAL_CONTRACT_PROFILE_UNSUPPORTED');
    expect(fs.existsSync(path.join(result.outDir, 'goal_execution.md'))).toBe(false);
  });

  it('blocks new required slots until req-trace supplies a handler', () => {
    writeProfile((profile) => ({
      ...profile,
      requiredSlots: [...profile.requiredSlots, 'futureRequiredSlot'],
    }));
    const result = runNativeGoal();

    expect(result.status).toBe(3);
    const receipt = JSON.parse(
      fs.readFileSync(path.join(result.outDir, 'audit_receipt.json'), 'utf8')
    );
    expect(receipt.blockingReasons).toContain('GOAL_CONTRACT_INCOMPLETE');
    expect(fs.existsSync(path.join(result.outDir, 'goal_execution.md'))).toBe(false);
  });

  it('allows optional slots without a req-trace handler', () => {
    writeProfile((profile) => ({
      ...profile,
      optionalSlots: ['futureOptionalSlot'],
    }));
    const result = runNativeGoal();

    expect(result.status).toBe(0);
    const receipt = JSON.parse(
      fs.readFileSync(path.join(result.outDir, 'audit_receipt.json'), 'utf8')
    );
    expect(receipt.goalContractTemplate.compatibilityDecision).toBe('pass');
    expect(receipt.goalContractTemplate.requiredSlotsPassed).toBe(true);
  });

  it('blocks missing invariant fragments', () => {
    writeProfile((profile) => ({
      ...profile,
      invariantFragments: [
        ...profile.invariantFragments,
        'future invariant that req-trace cannot render yet',
      ],
    }));
    const result = runNativeGoal();

    expect(result.status).toBe(3);
    const receipt = JSON.parse(
      fs.readFileSync(path.join(result.outDir, 'audit_receipt.json'), 'utf8')
    );
    expect(receipt.blockingReasons).toContain('GOAL_CONTRACT_INCOMPLETE');
    expect(fs.existsSync(path.join(result.outDir, 'goal_execution.md'))).toBe(false);
  });
});
