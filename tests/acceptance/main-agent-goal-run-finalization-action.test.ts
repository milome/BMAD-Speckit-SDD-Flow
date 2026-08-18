import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const TSX = path.join(ROOT, 'node_modules/tsx/dist/cli.mjs');
const RUNTIME = path.join(ROOT, 'packages/bmad-speckit/src/main-agent/runtime.ts');
const ACTION = path.join(ROOT, 'packages/bmad-speckit/src/main-agent/actions/finalize-goal-run.ts');
const RESULT_SCHEMA = path.join(
  ROOT,
  'packages/bmad-speckit/src/main-agent/source-authority/schemas/main-agent-goal-finalization-result.schema.json'
);
const HASH = `sha256:${'a'.repeat(64)}`;
const CAMPAIGN_CLOSURE_REF = 'goal-run/goal/runtime/campaign-closure.json';
const RESULT_KEYS = [
  'schemaVersion',
  'status',
  'issueCode',
  'campaignClosureRef',
  'candidateRef',
  'acceptedResultRef',
  'aggregateRef',
  'effectivePassRef',
  'deliveryGateReceiptRef',
  'closeoutRequestRef',
  'pageRef',
];
const FINALIZER_MODULE_TOKEN = 'main-agent-goal-run-finalizer';
const FINALIZATION_RUNNER = `
const fs=require('node:fs'),Module=require('node:module'),originalLoad=Module._load;
Module._load=function(request,parent,isMain){
  if(String(request).includes('${FINALIZER_MODULE_TOKEN}')) return {
    finalizeCommittedGoalRun(input,dependencies){
      fs.writeFileSync(process.env.FINALIZER_CAPTURE,JSON.stringify({
        input,
        dependencyKeys:Object.keys(dependencies||{}).sort()
      }),'utf8');
      if(process.env.FINALIZER_ERROR) throw new Error(process.env.FINALIZER_ERROR);
      return JSON.parse(process.env.FINALIZER_RESULT);
    }
  };
  return originalLoad.call(this,request,parent,isMain);
};
const {mainAgentRuntimeCommand}=require(process.argv[1]);
Promise.resolve(mainAgentRuntimeCommand(process.argv.slice(2)))
  .then(code=>{process.exitCode=code;})
  .catch(error=>{console.error(error);process.exitCode=2;});
`;

type JsonRecord = Record<string, unknown>;

function artifactRef(role: string) {
  return {
    path: `goal-run/goal/finalization/${role}.json`,
    hash: HASH,
  };
}

function finalizationResult(status: 'awaiting_user_acceptance' | 'finalization_reused') {
  return {
    schemaVersion: 'main-agent-goal-finalization-result/v1',
    status,
    issueCode: null,
    campaignClosureRef: artifactRef('campaign-closure'),
    candidateRef: artifactRef('execution-final-candidate'),
    acceptedResultRef: artifactRef('accepted-result'),
    aggregateRef: artifactRef('execution-final-aggregate'),
    effectivePassRef: artifactRef('execution-effective-pass'),
    deliveryGateReceiptRef: artifactRef('delivery-gate-receipt'),
    closeoutRequestRef: artifactRef('closeout-request'),
    pageRef: artifactRef('goal-page'),
  };
}

function blockedResult(issueCode: string) {
  return {
    schemaVersion: 'main-agent-goal-finalization-result/v1',
    status: 'blocked',
    issueCode,
    ...Object.fromEntries(RESULT_KEYS.slice(3).map((key) => [key, null])),
  };
}

function writeCampaignFixture(targetPath: string) {
  mkdirSync(path.dirname(targetPath), { recursive: true });
  writeFileSync(
    targetPath,
    `${JSON.stringify({ schemaVersion: 'goal-contract-campaign-closure-receipt/v1' })}\n`,
    'utf8'
  );
}

function parseExactJson(completed: ReturnType<typeof spawnSync>): JsonRecord {
  const stdout = String(completed.stdout ?? '');
  const parsed = JSON.parse(stdout) as JsonRecord;
  expect(stdout).toBe(`${JSON.stringify(parsed, null, 2)}\n`);
  expect(Object.keys(parsed)).toEqual(RESULT_KEYS);
  return parsed;
}

function expectBlocked(completed: ReturnType<typeof spawnSync>, expectedExitCode: 1 | 2) {
  expect(completed.status, String(completed.stderr || completed.stdout)).toBe(expectedExitCode);
  expect(completed.stderr).toBe('');
  const parsed = parseExactJson(completed);
  expect(parsed.issueCode).toEqual(
    expect.stringMatching(/^[a-z][a-z0-9_]*(?::[A-Za-z0-9._-]+)?$/u)
  );
  expect(parsed).toEqual(blockedResult(String(parsed.issueCode)));
  return parsed;
}

describe('main-agent finalize-goal-run action', () => {
  let fixtureRoot: string;
  let consumerRoot: string;
  let campaignClosurePath: string;
  let captureIndex = 0;

  beforeAll(() => {
    fixtureRoot = mkdtempSync(path.join(os.tmpdir(), 'main-agent-goal-finalization-action-'));
    consumerRoot = path.join(fixtureRoot, 'consumer');
    campaignClosurePath = path.join(consumerRoot, ...CAMPAIGN_CLOSURE_REF.split('/'));
    writeCampaignFixture(campaignClosurePath);
    const outsidePath = path.join(fixtureRoot, 'outside', 'campaign-closure.json');
    writeCampaignFixture(outsidePath);
  });

  afterAll(() => rmSync(fixtureRoot, { recursive: true, force: true }));

  function invoke(
    args: string[] = [],
    options: { result?: JsonRecord; error?: string } = {}
  ): { completed: ReturnType<typeof spawnSync>; capturePath: string } {
    captureIndex += 1;
    const capturePath = path.join(fixtureRoot, `finalizer-capture-${captureIndex}.json`);
    const completed = spawnSync(
      process.execPath,
      [
        TSX,
        '-e',
        FINALIZATION_RUNNER,
        RUNTIME,
        'finalize-goal-run',
        '--cwd',
        consumerRoot,
        '--campaign-closure',
        CAMPAIGN_CLOSURE_REF,
        '--json',
        ...args,
      ],
      {
        cwd: consumerRoot,
        encoding: 'utf8',
        env: {
          ...process.env,
          FINALIZER_CAPTURE: capturePath,
          FINALIZER_RESULT: JSON.stringify(
            options.result ?? finalizationResult('awaiting_user_acceptance')
          ),
          FINALIZER_ERROR: options.error ?? '',
        },
      }
    );
    return { completed, capturePath };
  }

  it('ships the closed finalization result schema', () => {
    expect(existsSync(RESULT_SCHEMA)).toBe(true);
    if (!existsSync(RESULT_SCHEMA)) return;
    const schema = JSON.parse(readFileSync(RESULT_SCHEMA, 'utf8')) as Record<string, any>;
    expect(schema).toMatchObject({
      title: 'Main Agent Goal Finalization Result',
      type: 'object',
      additionalProperties: false,
      required: RESULT_KEYS,
    });
  });

  it('exports the action seam without collection errors', async () => {
    expect(existsSync(ACTION)).toBe(true);
    const actionModule = (await import(pathToFileURL(ACTION).href)) as Record<string, unknown>;
    expect(typeof actionModule.runFinalizeGoalRunAction).toBe('function');
  });

  it.each(['awaiting_user_acceptance', 'finalization_reused'] as const)(
    'delegates confined runtime input and maps %s to exit 0',
    (status) => {
      const expected = finalizationResult(status);
      const { completed, capturePath } = invoke([], { result: expected });

      expect(completed.status, String(completed.stderr || completed.stdout)).toBe(0);
      expect(completed.stderr).toBe('');
      expect(parseExactJson(completed)).toEqual(expected);
      expect(JSON.parse(readFileSync(capturePath, 'utf8'))).toEqual({
        input: {
          projectRoot: consumerRoot,
          campaignClosurePath: CAMPAIGN_CLOSURE_REF,
        },
        dependencyKeys: ['invokeFinalJudge', 'invokeReviewer', 'resolveProviderRef'],
      });
    }
  );

  it('maps a domain block to exact JSON and exit 1', () => {
    const expected = blockedResult('execution_final_judge_findings_present');
    const { completed, capturePath } = invoke([], { result: expected });

    expect(expectBlocked(completed, 1)).toEqual(expected);
    expect(existsSync(capturePath)).toBe(true);
  });

  it('maps an integrity failure to exact JSON and exit 2', () => {
    const { completed, capturePath } = invoke([], {
      error: 'goal_finalization_integrity_invalid',
    });

    expect(expectBlocked(completed, 2)).toEqual(
      blockedResult('goal_finalization_integrity_invalid')
    );
    expect(existsSync(capturePath)).toBe(true);
  });

  it.each(['absolute-in-root', 'absolute-outside', 'traversal-outside'])(
    'rejects %s campaign path before delegation',
    (pathKind) => {
      const campaignRef =
        pathKind === 'absolute-in-root'
          ? campaignClosurePath
          : pathKind === 'absolute-outside'
            ? path.join(fixtureRoot, 'outside', 'campaign-closure.json')
            : '../outside/campaign-closure.json';
      const { completed, capturePath } = invoke(['--campaign-closure', campaignRef]);

      expectBlocked(completed, 2);
      expect(existsSync(capturePath)).toBe(false);
    }
  );

  it.each([
    '--candidate',
    '--accepted-result',
    '--final-judge',
    '--effective-pass',
    '--delivery-gate-receipt',
    '--producer',
  ])('rejects caller-derived producer injection through %s', (flag) => {
    const { completed, capturePath } = invoke([flag, 'caller-owned.json']);

    expectBlocked(completed, 2);
    expect(existsSync(capturePath)).toBe(false);
  });
});
