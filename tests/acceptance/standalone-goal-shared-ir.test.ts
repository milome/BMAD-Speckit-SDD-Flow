import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

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
  'const hash=(digit)=>`sha256:${digit.repeat(64)}`;',
  'const prepareStandaloneGoalJudgeInvocation=async()=>({',
  "configPath:'test',judgeRuntime:{},providerRef:'test-goal-judge',",
  "provider:{transport:'openai-compatible',apiStyle:'responses',model:'test-model',requestPolicy:{}},",
  "providerRegistryHash:hash('7'),credentialProviderRef:'test-goal-judge',credentialRevision:1,",
  'invoke:async({request})=>({',
  "schemaVersion:'requirements-contract-normalized-judge-response/v1',",
  "providerRef:'test-goal-judge',transport:'openai-compatible',configuredModel:'test-model',returnedModel:'test-model',",
  "decision:'pass',findings:[],challengeRequests:[],evidenceRefs:request.requiredCoverageRefs,",
  "providerRequestId:'request-1',requestHash:hash('8'),responseHash:hash('9'),",
  '}),});',
  'Promise.resolve(goalContractCommand({prepareStandaloneGoalJudgeInvocation}, process.argv.slice(2)))',
  '.then((code)=>{process.exitCode=code;})',
  '.catch((error)=>{console.error(error);process.exitCode=2;});',
].join('');

function bytesHash(filePath: string): string {
  return `sha256:${createHash('sha256').update(readFileSync(filePath)).digest('hex')}`;
}

describe('standalone Goal shared execution IR', () => {
  it('preserves the Markdown surface while publishing the common Task 7A handoff after one Judge', () => {
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
          '## Implementation Task Breakdown',
          '',
          '- MUST implement export without overwriting source.',
          '- MUST NOT mutate `.git/**`.',
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
      const executionIr = JSON.parse(readFileSync(result.goalExecutionIrRef.path, 'utf8'));
      const active = JSON.parse(readFileSync(result.activeAuthorityRef.path, 'utf8'));

      expect(existsSync(out)).toBe(true);
      const legacyProjection = readFileSync(out, 'utf8');
      expect(legacyProjection).toContain(
        'standalone Markdown contract is a GoalExecutionIR projection'
      );
      expect(legacyProjection).not.toContain(
        'standalone Markdown contract is the frozen execution authority'
      );
      expect(result.goalJudgeDispatchCount).toBe(1);
      expect(existsSync(result.providerSelectionRef.path)).toBe(true);
      expect(existsSync(result.authoringJudgeRequestRef.path)).toBe(true);
      expect(existsSync(result.authoringJudgeResponseRef.path)).toBe(true);
      expect(existsSync(result.authoringJudgeAggregateRef.path)).toBe(true);
      expect(existsSync(result.standaloneAuthoringEffectivePassRef.path)).toBe(true);
      expect(semanticIr.schemaVersion).toBe('StandaloneGoalSemanticIR/v1');
      expect(executionIr.schemaVersion).toBe('GoalExecutionIR/v1');
      expect(executionIr.profile).toBe('standalone');
      expect(active).toMatchObject({
        schemaVersion: 'GoalContractActiveAuthority/v1',
        profile: 'standalone',
        goalExecutionIRHash: executionIr.goalExecutionIRHash,
      });
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
