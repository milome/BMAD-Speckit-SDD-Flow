import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveGoalExecutionAuthority } from '../../packages/bmad-speckit/src/utils/goal-contract/control-plane/goal-execution-authority';

const ROOT = process.cwd();
const TSX = path.join(ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs');
const SOURCE_COMMAND = path.join(
  ROOT,
  'packages',
  'bmad-speckit',
  'src',
  'commands',
  'goal-contract.ts'
);
const RUNNER = [
  'const { goalContractCommand } = require(process.argv[1]);',
  'Promise.resolve(goalContractCommand({}, process.argv.slice(2)))',
  '.then((code)=>{process.exitCode=code;})',
  '.catch((error)=>{console.error(error);process.exitCode=2;});',
].join('');

function bytesHash(filePath: string): string {
  return `sha256:${createHash('sha256').update(readFileSync(filePath)).digest('hex')}`;
}

describe('standalone Goal shared execution IR', () => {
  it('preserves the Markdown surface while publishing shared IR after the internal semantic gate', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'standalone-goal-ir-'));
    try {
      const source = path.join(root, 'source-plan.md');
      const out = path.join(root, 'goal-execution-plan.md');
      writeFileSync(
        source,
        [
          '# Standalone Goal',
          '',
          '## File Map',
          '',
          '- Modify `src/export.ts`.',
          '',
          '## Acceptance',
          '### AC-01: Export preserves its input',
          '- PASS: exported values equal the input and the input remains unchanged.',
          '- Evidence: `reports/export-result.json`.',
          '',
          '## Implementation Task Breakdown',
          '',
          '### WORK-01: Implement export',
          '- Owned Production Paths: `src/export.ts`.',
          '- Acceptance: AC-01.',
          '- Steps: implement export without overwriting the input.',
          '- Red command: `npm test -- export`.',
          '- Green command: `npm test -- export`.',
          '- Evidence: `reports/export-result.json`.',
          '- PASS: exported values equal the input and the input remains unchanged.',
          '- Forbidden paths: `.git/**`.',
          '',
          '## Required Test Commands',
          '',
          '```powershell',
          'npm test -- export',
          '```',
          '',
          '## Completion Evidence Packet',
          '',
          '- Preserve RED/GREEN output for the export command.',
          '',
        ].join('\n'),
        'utf8'
      );
      const command = spawnSync(
        process.execPath,
        [
          TSX,
          '-e',
          RUNNER,
          SOURCE_COMMAND,
          'generate',
          '--entry',
          'standalone_goal_contract',
          '--source',
          source,
          '--out',
          out,
          '--json',
        ],
        { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }
      );

      expect(command.status, command.stderr || command.stdout).toBe(0);
      const result = JSON.parse(command.stdout);
      const semanticIr = JSON.parse(readFileSync(result.standaloneGoalSemanticIrRef.path, 'utf8'));
      const executionIr = resolveGoalExecutionAuthority(JSON.parse(readFileSync(result.goalExecutionIrRef.path, 'utf8')));
      const active = JSON.parse(readFileSync(result.activeAuthorityRef.path, 'utf8'));

      expect(existsSync(out)).toBe(true);
      const legacyProjection = readFileSync(out, 'utf8');
      expect(legacyProjection).toContain(
        'standalone Markdown contract is a GoalExecutionIR projection'
      );
      expect(legacyProjection).not.toContain(
        'standalone Markdown contract is the frozen execution authority'
      );
      expect(result.goalJudgeDispatchCount).toBe(0);
      expect(result).not.toHaveProperty('providerSelectionRef');
      expect(result).not.toHaveProperty('authoringJudgeRequestRef');
      expect(result).not.toHaveProperty('authoringJudgeResponseRef');
      expect(result).not.toHaveProperty('authoringJudgeAggregateRef');
      expect(existsSync(result.internalSemanticGateRef.path)).toBe(true);
      expect(semanticIr.schemaVersion).toBe('StandaloneGoalSemanticIR/v2');
      expect(executionIr.schemaVersion).toBe('GoalExecutionIR/v3');
      expect(executionIr.profile).toBe('standalone');
      expect(active).toMatchObject({
        schemaVersion: 'GoalContractActiveAuthority/v1',
        profile: 'standalone',
        goalExecutionIRHash: executionIr.goalExecutionIRHash,
        standaloneInternalSemanticGateRef: expect.any(Object),
      });
      expect(active).not.toHaveProperty('standaloneAuthoringEffectivePassRef');
      expect(executionIr.standaloneLineage.internalSemanticGateHash)
        .toBe(active.standaloneInternalSemanticGateRef.hash);
      expect(executionIr.technicalAuthority.internalSemanticGateHash)
        .toBe(active.standaloneInternalSemanticGateRef.hash);
      expect(result.renderabilityReportRef.bytesHash).toBe(
        bytesHash(result.renderabilityReportRef.path)
      );
      expect(active.parentProjectionRef.bytesHash).toBe(
        bytesHash(path.join(result.goalRunRoot, active.parentProjectionRef.path))
      );

      const replay = spawnSync(
        process.execPath,
        [
          TSX,
          '-e',
          RUNNER,
          SOURCE_COMMAND,
          'generate',
          '--entry',
          'standalone_goal_contract',
          '--source',
          source,
          '--out',
          out,
          '--json',
        ],
        { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }
      );
      expect(replay.status, replay.stderr || replay.stdout).toBe(0);
      expect(JSON.parse(replay.stdout)).toMatchObject({
        goalJudgeDispatchCount: 0,
        publicationStatus: 'reused',
        writeCount: 0,
      });
    } finally {
      rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 20 });
    }
  });
});
