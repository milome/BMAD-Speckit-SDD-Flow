import { execFileSync } from 'node:child_process';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
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
const VERIFY_GOAL_PROFILE = path.join(
  ROOT,
  '_bmad',
  'shared',
  'goal-contract',
  'scripts',
  'verify-goal-contract-profile.js'
);
const SKILL_MD = path.join(
  ROOT,
  '_bmad',
  'skills',
  'req-trace-matrix-prompt-generator',
  'SKILL.md'
);

let tempDir: string;
let canonicalProfile: string;
let tempProfile: string;
let fixture: ReturnType<typeof materializeAiTddManifestCloseoutRunnerFixture>;

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'req-trace-goal-profile-'));
  fixture = materializeAiTddManifestCloseoutRunnerFixture({
    root: path.join(tempDir, 'workspace'),
  });
  canonicalProfile = fs.readFileSync(CANONICAL_PROFILE, 'utf8');
  tempProfile = path.join(tempDir, 'goal-contract-profile.json');
  fs.writeFileSync(tempProfile, canonicalProfile, 'utf8');
});

afterEach(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
});

function runNativeGoal(
  input: {
    taskReportPath?: string | null;
    entry?: string | null;
    extraArgs?: string[];
    suffix?: string;
  } = {}
): { status: number; stdout: string; stderr: string; outDir: string; taskReportPath: string | null } {
  const outDir = path.join(tempDir, input.suffix ?? 'out');
  const taskReportPath =
    input.taskReportPath === null
      ? null
      : input.taskReportPath ?? path.join(tempDir, 'task-report.json');
  const taskReportArgs = taskReportPath ? ['--task-report-path', taskReportPath] : [];
  const entryArgs =
    input.entry === null
      ? []
      : ['--entry', input.entry ?? 'req_trace_direct'];
  try {
    const stdout = execFileSync(
      process.execPath,
      [
        SCRIPT,
        ...entryArgs,
        '--source-document',
        fixture.sourcePath,
        '--requirement-record',
        fixture.recordPath,
        '--out-dir',
        outDir,
        '--execution-host',
        'codex',
        '--goal-command-available',
        'true',
        '--goal-contract-profile',
        tempProfile,
        ...taskReportArgs,
        ...(input.extraArgs ?? []),
        '--json',
      ],
      { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
    );
    return { status: 0, stdout, stderr: '', outDir, taskReportPath };
  } catch (error: any) {
    return {
      status: error.status ?? 1,
      stdout: String(error.stdout ?? ''),
      stderr: String(error.stderr ?? ''),
      outDir,
      taskReportPath,
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

function normalizeGeneratedPath(filePath: string): string {
  return path.resolve(filePath).replace(/\\/g, '/');
}

function profileHashFor(profile: Record<string, any>): string {
  return sha256(stableStringify({ ...profile, profileHash: null }));
}

function writeProfile(mutator: (profile: Record<string, any>) => Record<string, any>) {
  const profile = JSON.parse(canonicalProfile);
  const next = mutator(profile);
  if (next.__preserveProfileHash !== true) next.profileHash = profileHashFor(next);
  delete next.__preserveProfileHash;
  fs.writeFileSync(tempProfile, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
}

describe('req-trace shared goal contract profile integration', () => {
  it('requires an explicit direct entry before compiling artifacts', () => {
    const result = runNativeGoal({ entry: null, suffix: 'missing-entry' });

    expect(result.status).not.toBe(0);
    expect(result.stdout).toContain('ENTRY_REQUIRED');
    expect(fs.existsSync(path.join(result.outDir, 'model_packet.json'))).toBe(false);
    expect(fs.existsSync(path.join(result.outDir, 'human_prompt.txt'))).toBe(false);
    expect(fs.existsSync(path.join(result.outDir, 'audit_receipt.json'))).toBe(false);
    expect(fs.existsSync(path.join(result.outDir, 'goal_execution.md'))).toBe(false);
  });

  it('binds the direct entry, compiler identity, and profile artifact roles', () => {
    const result = runNativeGoal({ suffix: 'entry-metadata' });

    expect(result.status).toBe(0);
    const packet = JSON.parse(
      fs.readFileSync(path.join(result.outDir, 'model_packet.json'), 'utf8')
    );
    const receipt = JSON.parse(
      fs.readFileSync(path.join(result.outDir, 'audit_receipt.json'), 'utf8')
    );
    const profile = JSON.parse(canonicalProfile);
    const directProfile = profile.entryProfiles.req_trace_direct;

    expect(packet.entryScenario).toBe('req_trace_direct');
    expect(packet.finalArtifactAuthority).toBe(directProfile.finalArtifactAuthority);
    expect(receipt.entryScenario).toBe('req_trace_direct');
    expect(receipt.entryExplicit).toBe(true);
    expect(receipt.compilerIdentity.path).toMatch(/generate_prompt\.js$/u);
    expect(receipt.compilerIdentity.hash).toMatch(/^sha256:[0-9a-f]{64}$/u);
    expect(receipt.artifactRoles).toEqual(directProfile.artifactRoles);
    expect(receipt.entryCompatibility).toEqual({
      compilerRoute: directProfile.compilerRoute,
      dualViewPolicy: directProfile.dualViewPolicy,
      profileHash: profile.profileHash,
      profileVersion: profile.profileVersion,
      sourceAuthority: directProfile.sourceAuthority,
    });
  });

  it('rejects wrong entry routes and dual-view semantic payloads', () => {
    const wrongEntry = runNativeGoal({
      entry: 'standalone_goal_contract',
      suffix: 'wrong-entry',
    });
    const dualView = runNativeGoal({
      suffix: 'dual-view',
      extraArgs: ['--dual-view-payload', path.join(tempDir, 'dual-view.json')],
    });

    expect(wrongEntry.status).not.toBe(0);
    expect(wrongEntry.stdout).toContain('ENTRY_ROUTE_MISMATCH');
    expect(fs.existsSync(path.join(wrongEntry.outDir, 'model_packet.json'))).toBe(false);
    expect(dualView.status).not.toBe(0);
    expect(dualView.stdout).toContain('ENTRY_AUTHORITY_VIOLATION');
    expect(fs.existsSync(path.join(dualView.outDir, 'model_packet.json'))).toBe(false);
  });

  it('native goal generation fails when task report path is missing', () => {
    const result = runNativeGoal({ taskReportPath: null });

    expect(result.status).not.toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).toContain('TASK_REPORT_PATH_REQUIRED');
    expect(fs.existsSync(path.join(result.outDir, 'goal_execution.md'))).toBe(false);
  });

  it('generated goal execution document contains exact TaskReport path', () => {
    const result = runNativeGoal();

    expect(result.status).toBe(0);
    const goalDocument = fs.readFileSync(path.join(result.outDir, 'goal_execution.md'), 'utf8');
    expect(goalDocument).toContain(`TaskReport path: ${normalizeGeneratedPath(result.taskReportPath!)}`);
    expect(goalDocument).not.toContain('TaskReport path: (not provided)');
  });

  it('audit receipt goalCommand taskReportPath matches packet compiledPromptRef taskReportPath', () => {
    const result = runNativeGoal();

    expect(result.status).toBe(0);
    const receipt = JSON.parse(
      fs.readFileSync(path.join(result.outDir, 'audit_receipt.json'), 'utf8')
    );
    const modelPacket = JSON.parse(
      fs.readFileSync(path.join(result.outDir, 'model_packet.json'), 'utf8')
    );
    const taskReportPath = normalizeGeneratedPath(result.taskReportPath!);
    expect(receipt.goalCommand).toMatchObject({
      mode: 'native_goal_document_ref',
      taskReportPath,
      packetId: modelPacket.packetId,
      recordId: modelPacket.recordId,
    });
    expect(receipt.mainAgentHandoff).toMatchObject({
      taskReportPath,
      returnAction: 'import-native-goal-task-report',
    });
  });

  it('audit receipt goal execution path and hash are non-null', () => {
    const result = runNativeGoal();

    expect(result.status).toBe(0);
    const receipt = JSON.parse(
      fs.readFileSync(path.join(result.outDir, 'audit_receipt.json'), 'utf8')
    );
    expect(receipt.goalExecutionPath).toBe(
      normalizeGeneratedPath(path.join(result.outDir, 'goal_execution.md'))
    );
    expect(receipt.goalExecutionHash).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(receipt.mainAgentHandoff.goalExecutionPath).toBe(receipt.goalExecutionPath);
    expect(receipt.mainAgentHandoff.goalExecutionHash).toBe(receipt.goalExecutionHash);
  });

  it('skill contract makes TaskReport the mandatory native goal return artifact', () => {
    const skill = fs.readFileSync(SKILL_MD, 'utf8');

    expect(skill).toContain(
      '`--task-report-path <path>` is mandatory when `--goal-command-available true` and `--out-dir` are used'
    );
    expect(skill).toContain('BLOCK: TASK_REPORT_PATH_REQUIRED');
    expect(skill).toContain('Native /goal TaskReport Handoff');
    expect(skill).toContain('The TaskReport at `--task-report-path` is the only result artifact');
    expect(skill).toContain(
      'bmad-speckit main-agent-orchestration --action import-native-goal-task-report --taskReportPath <packet compiledPromptRef.taskReportPath>'
    );
    expect(skill).toContain(
      '`goal_execution.md`, `audit_receipt.json`, stdout, exit code, chat summary, and `/goal` completion are not execution closure PASS evidence'
    );
    expect(skill).toContain('Never render a missing-value TaskReport path placeholder');
    expect(skill).not.toContain('TaskReport path: (not provided)');
  });

  it('records shared template/profile/renderer audit in native /goal mode', () => {
    const result = runNativeGoal();
    const profileVersion = JSON.parse(canonicalProfile).profileVersion;

    expect(result.status).toBe(0);
    const receipt = JSON.parse(
      fs.readFileSync(path.join(result.outDir, 'audit_receipt.json'), 'utf8')
    );
    const goalDocument = fs.readFileSync(path.join(result.outDir, 'goal_execution.md'), 'utf8');
    expect(receipt.goalContractTemplate).toMatchObject({
      templatePath: '_bmad/shared/goal-contract/goal-execution-contract-template.md',
      profileVersion,
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
    expect(goalDocument).toContain(`goalContractProfileVersion: ${profileVersion}`);
    expect(goalDocument).toContain('goalContractProfileHash:');
    expect(goalDocument).toContain('model_packet.json is the machine-readable execution authority');
    expect(goalDocument).toContain('goal_execution.md is not execution authority');
  });

  it('records artifact hashes from final bytes after safe writer integration', () => {
    const result = runNativeGoal();
    expect(result.status).toBe(0);
    const receipt = JSON.parse(
      fs.readFileSync(path.join(result.outDir, 'audit_receipt.json'), 'utf8')
    );
    expect(receipt.outputHashes.modelPacketHash).toBe(
      sha256(fs.readFileSync(path.join(result.outDir, 'model_packet.json'), 'utf8'))
    );
    expect(receipt.outputHashes.humanPromptHash).toBe(
      sha256(fs.readFileSync(path.join(result.outDir, 'human_prompt.txt'), 'utf8'))
    );
    expect(receipt.outputHashes.goalDocumentHash).toBe(
      sha256(fs.readFileSync(path.join(result.outDir, 'goal_execution.md'), 'utf8'))
    );
  });

  it('verifies both _bmad and .codex goal contract reference projections', () => {
    const stdout = execFileSync(process.execPath, [VERIFY_GOAL_PROFILE], {
      cwd: ROOT,
      encoding: 'utf8',
    });
    const result = JSON.parse(stdout);
    expect(result.ok).toBe(true);
    expect(result.issues).toEqual([]);
    expect(result.checkedReferences).toEqual(
      expect.arrayContaining([
        '_bmad/skills/goal-execution-contract-generator/references/goal-execution-contract-template.md',
        '_bmad/skills/goal-execution-contract-generator/references/goal-contract-profile.json',
        '.codex/skills/goal-execution-contract-generator/references/goal-execution-contract-template.md',
        '.codex/skills/goal-execution-contract-generator/references/goal-contract-profile.json',
      ])
    );
  });

  it('blocks when the shared profile is missing', () => {
    fs.rmSync(tempProfile, { force: true });
    const result = runNativeGoal();
    expect(result.status).toBe(3);
    const receipt = JSON.parse(
      fs.readFileSync(path.join(result.outDir, 'audit_receipt.json'), 'utf8')
    );
    expect(receipt.blockingReasons).toContain('GOAL_CONTRACT_PROFILE_MISSING');
    expect(fs.existsSync(path.join(result.outDir, 'goal_execution.md'))).toBe(false);
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
      profileVersion: '2.0.1',
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
