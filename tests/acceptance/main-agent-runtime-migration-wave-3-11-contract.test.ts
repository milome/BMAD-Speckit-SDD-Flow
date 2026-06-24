import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const VALIDATOR_PATH = path.join(
  ROOT,
  'tools',
  'script-migration',
  'validate-main-agent-runtime-migration-wave-3-11.cjs'
);
const WRITER_PATH = path.join(
  ROOT,
  'tools',
  'script-migration',
  'write-main-agent-wave-3-11-evidence.cjs'
);
const EVIDENCE_UTILS_PATH = path.join(
  ROOT,
  'tools',
  'script-migration',
  'main-agent-wave-3-11-evidence-utils.cjs'
);
const INSTALL_MATRIX_RUNNER_PATH = path.join(
  ROOT,
  'tools',
  'script-migration',
  'run-main-agent-wave-3-11-install-matrix.cjs'
);
const CONTRACT_PATH = path.join(
  ROOT,
  'docs',
  'plans',
  '2026-06-05-main-agent-runtime-migration-wave-3-11-goal-execution-plan.md'
);
const WAVE_DIR = path.join(
  ROOT,
  'repo-governance',
  'script-migrations',
  'main-agent-runtime-migration-wave-3.11'
);

function runValidator(args: string[]) {
  return spawnSync(process.execPath, [VALIDATOR_PATH, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    shell: process.platform === 'win32',
    maxBuffer: 120 * 1024 * 1024,
  });
}

describe('main-agent runtime migration wave 3.11 contract', () => {
  it('creates required Wave 3.11 deterministic validation entry points', () => {
    expect(fs.existsSync(VALIDATOR_PATH)).toBe(true);
    expect(
      fs.existsSync(path.join(ROOT, 'tools', 'script-migration', 'run-main-agent-wave-3-11-install-matrix.cjs'))
    ).toBe(true);
    expect(fs.existsSync(path.join(WAVE_DIR, 'source-inventory.json'))).toBe(true);
    expect(fs.existsSync(path.join(WAVE_DIR, 'preflight.json'))).toBe(true);
  });

  it('runs the selected Wave 3.11 validator mode successfully', () => {
    const mode = process.env.MAIN_AGENT_WAVE_3_11_VALIDATOR_MODE || 'pre-evidence';
    const modes: Record<string, string[]> = {
      'pre-evidence': ['--pre-evidence'],
      'evidence-running': ['--evidence-running'],
      'final-closeout': ['--final-acceptance'],
    };
    expect(Object.keys(modes)).toContain(mode);
    const args = modes[mode];
    const result = runValidator(args);
    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    expect(result.stdout).toContain('"status": "passed"');
  });

  it('enforces the two-attempt stop policy in writer and validator code', () => {
    const writer = fs.readFileSync(WRITER_PATH, 'utf8');
    const validator = fs.readFileSync(VALIDATOR_PATH, 'utf8');
    const evidenceUtils = fs.readFileSync(EVIDENCE_UTILS_PATH, 'utf8');
    const installMatrixRunner = fs.readFileSync(INSTALL_MATRIX_RUNNER_PATH, 'utf8');

    expect(writer).toContain('MAX_REQUIRED_COMMAND_ATTEMPTS');
    expect(writer).toContain('required_command_failed:${commandId}');
    expect(writer).toContain('function assertCanRunRequiredCommand');
    expect(writer).toContain('required_command_pending_repair:${earlierFailed.commandId}');
    expect(writer).toContain('evidence_append_command_row_auto_blocked');
    expect(writer).toContain("failureEvidence.status === 'blocked' ? 'blocked' : 'failed'");
    expect(writer).toContain('blockedReason: failureEvidence.blockedReason || null');
    expect(writer).not.toContain('--mark-required-command-blocked');
    expect(writer).toContain('startRepairRound');
    expect(writer).toContain('evidence-history/${roundId}.evidence.json');
    expect(writer).toContain('--refresh-repair-archive-receipt');
    expect(writer).toContain('evidence_blocked_round_archive_receipt_refresh');
    expect(validator).toContain('MAX_REQUIRED_COMMAND_ATTEMPTS');
    expect(validator).toContain('has more than MAX_REQUIRED_COMMAND_ATTEMPTS attempts');
    expect(validator).toContain('appears after failed required command');
    expect(validator).toContain('function validateRepairRoundArchive');
    expect(validator).toContain('previousEvidenceArchivePath');
    expect(validator).toContain('repair archive.evidence.status');
    expect(validator).toContain('dynamicTargets.add(normalizeEvidencePath(evidence.previousEvidenceArchivePath))');
    expect(validator).toContain('may only be present before retry when the latest attempt is failed and repairable');
    expect(evidenceUtils).toContain('evidence-history/');
    expect(evidenceUtils).toContain("'archivedAt'");
    expect(evidenceUtils).toContain("'repairRoundId'");
    expect(evidenceUtils).toContain("'blockedReason'");
    expect(evidenceUtils).toContain("'blockedCommandId'");
    expect(evidenceUtils).toContain("'evidence'");
    expect(installMatrixRunner).toContain('function installedScoringRootFor');
    expect(installMatrixRunner).toContain("path.join(packageRoot, 'node_modules', '@bmad-speckit', 'scoring')");
    expect(installMatrixRunner).toContain('installed scoring proof resolved to repo source');
    expect(installMatrixRunner).toContain('createRequire(path.join(${JSON.stringify(options.packageRoot)},');

    const runStart = writer.indexOf('function runEvidenceCommand');
    expect(runStart).toBeGreaterThanOrEqual(0);
    const runEnd = writer.indexOf('\nfunction ', runStart + 1);
    const runBody = writer.slice(runStart, runEnd === -1 ? undefined : runEnd);
    expect(runBody.indexOf('assertCanRunRequiredCommand')).toBeGreaterThanOrEqual(0);
    expect(runBody.indexOf('assertCanRunRequiredCommand')).toBeLessThan(runBody.indexOf('spawnSync'));
  });

  it('blocks final closeout artifact generation until ACC001-ACC012 and MAN001-MAN003 are passed', () => {
    const writer = fs.readFileSync(WRITER_PATH, 'utf8');

    expect(writer).toContain('function assertReadyForFinalCloseout');
    for (const functionName of [
      'writeSummary',
      'markAwaitingFinalValidator',
      'writeUnsealedFinalPacket',
      'sealFinalPacket',
    ]) {
      const start = writer.indexOf(`function ${functionName}`);
      expect(start, `${functionName} must exist`).toBeGreaterThanOrEqual(0);
      const nextFunction = writer.indexOf('\nfunction ', start + 1);
      const body = writer.slice(start, nextFunction === -1 ? undefined : nextFunction);
      expect(body, `${functionName} must assert final readiness`).toContain('assertReadyForFinalCloseout');
    }
  });

  it('documents repair-run boundaries, writer-only commands, final validator failure mutations, and G013 N/A', () => {
    const contract = fs.readFileSync(CONTRACT_PATH, 'utf8');

    expect(contract).toContain('G013: not applicable');
    expect(contract).toContain('writer-internal command specs');
    expect(contract).toContain('cmd-test-install-surface-regressions');
    expect(contract).toContain('packages/bmad-speckit/src/commands/check.ts');
    expect(contract).toContain('packages/bmad-speckit/src/services/sync-service.ts');
    expect(contract).toContain('--start-repair-round <roundId>');
    expect(contract).toContain('evidence-history/**');
    expect(contract).toContain('evidence-history/*.evidence.json');
    expect(contract).toContain('automatically set active `evidence.json` to `status: blocked`');
    expect(contract).toContain('When active `evidence.json.previousEvidenceArchivePath` exists');
    expect(contract).toContain('required_command_failed:<commandId>');
    expect(contract).toContain('sealed_final_command_failed:cmd-validate-wave-3-11-final');
    expect(contract).toContain('allowed post-validator mutation');
    expect(contract).toContain('Expected evidence-row command text');
    expect(contract).toContain('Executor-visible invocation: `node tools/script-migration/write-main-agent-wave-3-11-evidence.cjs --append-final-validator-row`');
    expect(contract).toContain('the writer wrapper is the only allowed executor command');
  });
});
