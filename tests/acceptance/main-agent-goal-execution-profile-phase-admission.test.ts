import { spawnSync } from 'node:child_process';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { produceImplementationReadiness } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-implementation-readiness-v2';
import { compileRequirementsBackedGoal } from '../../packages/bmad-speckit/src/utils/goal-contract/control-plane/goal-requirements-adapter';
import {
  materializeImplementationReadinessFixture,
  type ImplementationReadinessFixture,
} from '../helpers/implementation-readiness-fixture';

const ROOT = process.cwd();
const TSX = path.join(ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs');
const ACTIVATION_MODULE = path.join(
  ROOT,
  'packages',
  'bmad-speckit',
  'src',
  'utils',
  'goal-contract',
  'control-plane',
  'frozen-goal-activation.ts'
);
const GOAL_COMMAND = path.join(
  ROOT,
  'packages',
  'bmad-speckit',
  'src',
  'commands',
  'goal-contract.ts'
);
const ADMISSION_RUNNER = [
  'const runtime = require(process.argv[1]);',
  'const input = JSON.parse(Buffer.from(process.argv[3], "base64").toString("utf8"));',
  'try {',
  '  const result = runtime[process.argv[2]](input);',
  '  process.stdout.write(JSON.stringify({ ok: true, result }));',
  '} catch (error) {',
  '  process.stdout.write(JSON.stringify({ ok: false, issueCode: error.failureClass || error.message, issueField: error.field || null, issueCodes: error.issueCodes || [] }));',
  '  process.exitCode = 1;',
  '}',
].join('\n');
const STANDALONE_RUNNER = [
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

function callAdmission(input: unknown) {
  const completed = spawnSync(
    process.execPath,
    [
      TSX,
      '-e',
      ADMISSION_RUNNER,
      ACTIVATION_MODULE,
      'validateGoalExecutionAdmission',
      Buffer.from(JSON.stringify(input), 'utf8').toString('base64'),
    ],
    { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }
  );
  return {
    ...completed,
    output: JSON.parse(completed.stdout) as
      | { ok: true; result: Record<string, unknown> }
      | { ok: false; issueCode: string; issueField: string | null; issueCodes: string[] },
  };
}

function materializeRequirementsAuthority() {
  const fixture = materializeImplementationReadinessFixture();
  produceImplementationReadiness({ projectRoot: fixture.root, requestId: fixture.requestId });
  const generated = compileRequirementsBackedGoal({
    projectRoot: fixture.root,
    requirementRecordPath: fixture.runtimeRecordPath,
    outRoot: path.join(fixture.root, 'goal-run'),
  });
  return { fixture, generated };
}

function semanticAuthorityPath(fixture: ImplementationReadinessFixture): string {
  const authoringRecord = JSON.parse(readFileSync(fixture.recordPath, 'utf8'));
  return path.join(
    fixture.recordRoot,
    ...String(authoringRecord.activeAuthority.activeSemanticIrPath).split('/')
  );
}

function materializeStandaloneAuthority() {
  const fixture = materializeImplementationReadinessFixture();
  const source = path.join(fixture.root, 'standalone-goal.md');
  const out = path.join(fixture.root, 'standalone-goal-execution-plan.md');
  writeFileSync(
    source,
    [
      '# Standalone Goal',
      '',
      '## File Map',
      '',
      '- Modify `src/refund-worker.cjs`.',
      '',
      '## Implementation Task Breakdown',
      '',
      '- MUST implement the standalone refund worker.',
      '- MUST NOT mutate `.git/**`.',
      '',
      '## Required Test Commands',
      '',
      '```powershell',
      'node --test tests/refund-worker.test.cjs',
      '```',
      '',
      '## Completion Evidence Packet',
      '',
      '- Preserve RED/GREEN output for the declared command.',
      '',
    ].join('\n'),
    'utf8'
  );
  const completed = spawnSync(
    process.execPath,
    [
      TSX,
      '-e',
      STANDALONE_RUNNER,
      GOAL_COMMAND,
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
  if (completed.status !== 0) {
    fixture.cleanup();
    throw new Error(completed.stderr || completed.stdout);
  }
  return { fixture, generated: JSON.parse(completed.stdout) as Record<string, any> };
}

describe('main-agent Goal execution profile-phase admission', () => {
  it('admits the requirements-backed activation phases with current lineage', () => {
    const { fixture, generated } = materializeRequirementsAuthority();
    try {
      for (const request of [
        {
          profile: 'requirements_backed',
          phase: 'activation_prepare',
          projectRoot: fixture.root,
          goalAuthorityPath: generated.activeAuthorityRef.path,
        },
        {
          profile: 'requirements_backed',
          phase: 'activation_commit',
          projectRoot: fixture.root,
          goalAuthorityPath: generated.activeAuthorityRef.path,
          expectedGoalExecutionIRHash: generated.goalExecutionIRHash,
        },
      ]) {
        const admitted = callAdmission(request);
        expect(admitted.status, admitted.stderr || admitted.stdout).toBe(0);
        expect(admitted.output).toMatchObject({ ok: true, result: { phase: request.phase } });
      }
    } finally {
      fixture.cleanup();
    }
  });

  it('admits standalone activation without Requirements lineage', () => {
    const { fixture, generated } = materializeStandaloneAuthority();
    try {
      const admitted = callAdmission({
        profile: 'standalone',
        phase: 'activation_prepare',
        projectRoot: fixture.root,
        goalAuthorityPath: generated.activeAuthorityRef.path,
      });
      expect(admitted.status, admitted.stderr || admitted.stdout).toBe(0);
      expect(admitted.output).toMatchObject({
        ok: true,
        result: { phase: 'activation_prepare', requirementsReadiness: null },
      });
    } finally {
      fixture.cleanup();
    }
  });

  it('rejects an unknown execution phase before resolving authority', () => {
    const { fixture, generated } = materializeRequirementsAuthority();
    try {
      const blocked = callAdmission({
        profile: 'requirements_backed',
        phase: 'unknown_phase',
        projectRoot: fixture.root,
        goalAuthorityPath: generated.activeAuthorityRef.path,
      });
      expect(blocked.status).toBe(1);
      expect(blocked.output).toMatchObject({
        ok: false,
        issueCode: 'activation_request_invalid',
      });
    } finally {
      fixture.cleanup();
    }
  });

  it('rejects a caller profile that does not match the frozen authority', () => {
    const { fixture, generated } = materializeRequirementsAuthority();
    try {
      const blocked = callAdmission({
        profile: 'standalone',
        phase: 'activation_prepare',
        projectRoot: fixture.root,
        goalAuthorityPath: generated.activeAuthorityRef.path,
      });
      expect(blocked.status).toBe(1);
      expect(blocked.output).toMatchObject({
        ok: false,
        issueCode: 'goal_execution_authority_invalid',
      });
    } finally {
      fixture.cleanup();
    }
  });

  it.each([
    [
      'requirements',
      'requirements_successor_required:semantic_authority',
      (fixture: ImplementationReadinessFixture) => {
        const semanticPath = semanticAuthorityPath(fixture);
        const semanticIr = JSON.parse(readFileSync(semanticPath, 'utf8'));
        semanticIr.semanticPayload.semantics.requirements[0].text = 'Changed after Goal freeze.';
        writeFileSync(semanticPath, `${JSON.stringify(semanticIr, null, 2)}\n`, 'utf8');
      },
    ],
    [
      'architecture',
      'architecture_successor_required:architecture_confirmation',
      (fixture: ImplementationReadinessFixture) =>
        rmSync(fixture.architectureEventPath, { force: true }),
    ],
    [
      'readiness',
      'readiness_recheck_required:scoped_input_digest',
      (fixture: ImplementationReadinessFixture) =>
        writeFileSync(fixture.targetPath, "module.exports = { refundStatus: () => 'changed' };\n"),
    ],
  ] as const)('preserves the exact %s successor route', (_name, issueCode, mutate) => {
    const { fixture, generated } = materializeRequirementsAuthority();
    try {
      mutate(fixture);
      const blocked = callAdmission({
        profile: 'requirements_backed',
        phase: 'activation_prepare',
        projectRoot: fixture.root,
        goalAuthorityPath: generated.activeAuthorityRef.path,
      });
      expect(blocked.status).toBe(1);
      expect(blocked.output).toMatchObject({ ok: false, issueCode });
    } finally {
      fixture.cleanup();
    }
  });
});
