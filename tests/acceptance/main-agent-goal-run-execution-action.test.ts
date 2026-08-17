import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { produceImplementationReadiness } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-implementation-readiness-v2';
import {
  hashControlPlaneValue,
  stableControlPlaneStringify,
} from '../../packages/bmad-speckit/src/utils/goal-contract/control-plane/canonical-hash';
import { materializeImplementationReadinessFixture } from '../helpers/implementation-readiness-fixture';

const ROOT = process.cwd();
const TSX = path.join(ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs');
const RUNTIME = path.join(ROOT, 'packages', 'bmad-speckit', 'src', 'main-agent', 'runtime.ts');
const GOAL_COMMAND = path.join(
  ROOT,
  'packages',
  'bmad-speckit',
  'src',
  'commands',
  'goal-contract.ts'
);
const RUNTIME_RUNNER = [
  'const { mainAgentRuntimeCommand } = require(process.argv[1]);',
  'Promise.resolve(mainAgentRuntimeCommand(process.argv.slice(2)))',
  '.then((code)=>{process.exitCode=code;})',
  '.catch((error)=>{console.error(error);process.exitCode=2;});',
].join('');
const GOAL_RUNNER = [
  'const { goalContractCommand } = require(process.argv[1]);',
  'Promise.resolve(goalContractCommand({}, process.argv.slice(2)))',
  '.then((code)=>{process.exitCode=code;})',
  '.catch((error)=>{console.error(error);process.exitCode=2;});',
].join('');

function activateFixture(
  root: string,
  requirementRecordPath: string,
  options: { adapterSource?: string } = {}
) {
  const outRoot = path.join(root, 'goal-run');
  const generated = spawnSync(
    process.execPath,
    [
      TSX,
      '-e',
      GOAL_RUNNER,
      GOAL_COMMAND,
      'generate',
      '--entry',
      'requirements_backed_goal',
      '--requirements-record',
      requirementRecordPath,
      '--out',
      outRoot,
      '--json',
    ],
    { cwd: root, encoding: 'utf8' }
  );
  if (generated.status !== 0) throw new Error(generated.stderr || generated.stdout);
  const adapterRoot = path.join(outRoot, 'goal', 'execution-adapter');
  const executableBytes = Buffer.from(
    options.adapterSource ??
      [
        "const fs = require('node:fs');",
        "const path = require('node:path');",
        "let input = '';",
        "process.stdin.setEncoding('utf8');",
        "process.stdin.on('data', (chunk) => (input += chunk));",
        "process.stdin.on('end', () => {",
        '  const request = JSON.parse(input);',
        '  const ownedPath = request.ownedPaths[0];',
        "  fs.writeFileSync(path.join(request.projectRoot, ...ownedPath.split('/')), \"module.exports = { refundStatus: () => 'accepted' };\\n\", 'utf8');",
        "  process.stdout.write(JSON.stringify({ schemaVersion: 'GoalRunMutationResult/v1', exitCode: 0, changedPaths: [ownedPath] }));",
        '});',
        '',
      ].join('\n'),
    'utf8'
  );
  const executableHash = `sha256:${createHash('sha256').update(executableBytes).digest('hex')}`;
  const authorityPayload = {
    schemaVersion: 'GoalRunExecutionAdapterAuthority/v1',
    adapterId: 'fixture-refund-worker',
    protocol: 'GoalRunMutationProtocol/v1',
    executableRef: { path: 'executor.cjs', hash: executableHash },
    args: [],
    timeoutMs: 30_000,
  };
  const authority = {
    ...authorityPayload,
    adapterAuthorityHash: hashControlPlaneValue(authorityPayload),
  };
  mkdirSync(adapterRoot, { recursive: true });
  writeFileSync(path.join(adapterRoot, 'executor.cjs'), executableBytes);
  writeFileSync(
    path.join(adapterRoot, 'authority.json'),
    `${stableControlPlaneStringify(authority)}\n`,
    'utf8'
  );
  const activated = spawnSync(
    process.execPath,
    [
      TSX,
      '-e',
      GOAL_RUNNER,
      GOAL_COMMAND,
      'activate',
      '--cwd',
      root,
      '--goal-authority',
      path.join(outRoot, 'goal', 'active-authority.json'),
      '--json',
    ],
    { cwd: root, encoding: 'utf8' }
  );
  if (activated.status !== 0) throw new Error(activated.stderr || activated.stdout);
  for (const args of [
    ['init'],
    ['config', 'user.name', 'Goal Execution Fixture'],
    ['config', 'user.email', 'goal-execution-fixture@example.invalid'],
    ['config', 'core.longpaths', 'true'],
    ['add', '--all'],
    ['commit', '-m', 'test: freeze execution baseline'],
  ]) {
    const git = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
    if (git.status !== 0) throw new Error(git.stderr || git.stdout);
  }
  const pointer = JSON.parse(activated.stdout).artifacts.find(
    (artifact: { role: string }) => artifact.role === 'active_run_pointer'
  );
  if (!pointer) throw new Error('active run pointer missing');
  return {
    activeRun: path.relative(root, pointer.artifactRef).replaceAll('\\', '/'),
    activation: JSON.parse(activated.stdout),
  };
}

function readJsonArtifact(root: string, artifactRef: string) {
  return JSON.parse(readFileSync(path.resolve(root, artifactRef), 'utf8'));
}

function parseSpawnJson(
  label: string,
  completed: ReturnType<typeof spawnSync>
): Record<string, any> {
  const stdout = String(completed.stdout ?? '');
  const stderr = String(completed.stderr ?? '');
  const diagnostics = JSON.stringify({
    label,
    status: completed.status,
    signal: completed.signal,
    error: completed.error
      ? {
          name: completed.error.name,
          message: completed.error.message,
          code: (completed.error as NodeJS.ErrnoException).code ?? null,
        }
      : null,
    stdout: stdout.slice(-4_000),
    stderr: stderr.slice(-4_000),
  });
  if (completed.error || completed.status !== 0 || completed.signal || !stdout.trim()) {
    throw new Error(`goal_run_child_process_failed:${diagnostics}`);
  }
  try {
    return JSON.parse(stdout) as Record<string, any>;
  } catch (error) {
    throw new Error(
      `goal_run_child_process_invalid_json:${diagnostics}`,
      error instanceof Error ? { cause: error } : undefined
    );
  }
}

function listRelativeFiles(root: string, current = root): string[] {
  if (!existsSync(current)) return [];
  const files: string[] = [];
  for (const entry of readdirSync(current, { withFileTypes: true })) {
    const absolute = path.join(current, entry.name);
    if (entry.isDirectory()) files.push(...listRelativeFiles(root, absolute));
    else files.push(path.relative(root, absolute).replaceAll('\\', '/'));
  }
  return files.sort();
}

describe('main-agent execute-goal-run production action', () => {
  let fixture: ReturnType<typeof materializeImplementationReadinessFixture>;
  let completed: ReturnType<typeof spawnSync>;
  let reused: ReturnType<typeof spawnSync>;
  let result: Record<string, any>;
  let reusedResult: Record<string, any>;
  let activation: Record<string, any>;
  let activeRun: string;

  beforeAll(() => {
    fixture = materializeImplementationReadinessFixture();
    produceImplementationReadiness({ projectRoot: fixture.root, requestId: fixture.requestId });
    const activated = activateFixture(fixture.root, fixture.runtimeRecordPath);
    activation = activated.activation;
    activeRun = activated.activeRun;
    completed = spawnSync(
      process.execPath,
      [
        TSX,
        '-e',
        RUNTIME_RUNNER,
        RUNTIME,
        'execute-goal-run',
        '--cwd',
        fixture.root,
        '--active-run',
        activated.activeRun,
        '--json',
      ],
      { cwd: fixture.root, encoding: 'utf8' }
    );
    result = parseSpawnJson('initial-execution', completed);
    reused = spawnSync(
      process.execPath,
      [
        TSX,
        '-e',
        RUNTIME_RUNNER,
        RUNTIME,
        'execute-goal-run',
        '--cwd',
        fixture.root,
        '--active-run',
        activated.activeRun,
        '--json',
      ],
      { cwd: fixture.root, encoding: 'utf8' }
    );
    reusedResult = parseSpawnJson('evidence-reuse', reused);
  }, 120_000);

  afterAll(() => fixture?.cleanup());

  it('freezes one canonical execution adapter authority into hard-cut package v2', () => {
    const packageRef = activation.artifacts.find(
      (artifact: { role: string }) => artifact.role === 'direct_execution_package'
    );
    expect(packageRef).toMatchObject({ artifactRef: expect.any(String) });
    const directPackage = readJsonArtifact(fixture.root, packageRef.artifactRef);
    expect(directPackage).toMatchObject({
      schemaVersion: 'GoalContractDirectExecutionPackage/v2',
      executionAdapterRef: {
        path: expect.any(String),
        hash: expect.stringMatching(/^sha256:[a-f0-9]{64}$/u),
      },
    });
    const runRoot = path.dirname(path.dirname(path.resolve(fixture.root, packageRef.artifactRef)));
    const adapterPath = path.resolve(runRoot, directPackage.executionAdapterRef.path);
    const adapter = JSON.parse(readFileSync(adapterPath, 'utf8'));
    expect(adapter).toMatchObject({
      schemaVersion: 'GoalRunExecutionAdapterAuthority/v1',
      protocol: 'GoalRunMutationProtocol/v1',
      executableRef: {
        path: 'executor.cjs',
        hash: expect.stringMatching(/^sha256:[a-f0-9]{64}$/u),
      },
      args: [],
      timeoutMs: 30_000,
      adapterAuthorityHash: directPackage.executionAdapterRef.hash,
    });
    const executablePath = path.resolve(path.dirname(adapterPath), adapter.executableRef.path);
    expect(existsSync(executablePath)).toBe(true);
    expect(
      `sha256:${createHash('sha256').update(readFileSync(executablePath)).digest('hex')}`
    ).toBe(adapter.executableRef.hash);
  });

  it('executes the committed workload and real validation command without producer injection', () => {
    expect(completed.status, completed.stderr || completed.stdout).toBe(0);
    expect(completed.stderr).toBe('');
    expect(result).toMatchObject({
      schemaVersion: 'main-agent-goal-run-result/v1',
      profile: 'requirements_backed',
      status: 'closed',
      issueCode: null,
    });
    expect(readFileSync(fixture.targetPath, 'utf8')).toContain("refundStatus: () => 'accepted'");
  });

  it('publishes immutable observed evidence from real consumer state', () => {
    expect(result.campaignClosure).toMatchObject({
      artifactRef: expect.any(String),
      artifactHash: expect.stringMatching(/^sha256:[a-f0-9]{64}$/u),
    });
    const campaign = readJsonArtifact(fixture.root, result.campaignClosure.artifactRef);
    expect(campaign.orderedEvidenceRefs).toHaveLength(1);
    const evidence = readJsonArtifact(fixture.root, campaign.orderedEvidenceRefs[0].path);
    expect(evidence).toMatchObject({
      schemaVersion: 'GoalExecutionObservedEvidence/v1',
      profile: 'requirements_backed',
      observedFiles: [
        {
          path: 'src/refund-worker.cjs',
          beforeHash: expect.stringMatching(/^sha256:[a-f0-9]{64}$/u),
          afterHash: expect.stringMatching(/^sha256:[a-f0-9]{64}$/u),
          existsAfter: true,
        },
      ],
      ownedPathStates: [
        {
          path: 'src/refund-worker.cjs',
          hash: expect.stringMatching(/^sha256:[a-f0-9]{64}$/u),
          exists: true,
        },
      ],
      commandObservations: [
        {
          normalizedInvocation: 'node --test tests/refund-worker.test.cjs',
          exitCode: 0,
          decision: 'green',
        },
      ],
      reviewerInvocationCount: 0,
      auditorInvocationCount: 0,
      judgeSemanticAttemptCount: 0,
    });
  });

  it('publishes one immutable direct authority closure before closing the attempt', () => {
    expect(result.validClosures).toHaveLength(1);
    const closure = readJsonArtifact(fixture.root, result.validClosures[0].artifactRef);
    expect(closure).toMatchObject({
      schemaVersion: 'GoalExecutionAuthorityClosure/v1',
      profile: 'requirements_backed',
      changedPaths: ['src/refund-worker.cjs'],
      commitProof: { kind: 'not_applicable' },
      reviewerInvocationCount: 0,
      auditorInvocationCount: 0,
      judgeSemanticAttemptCount: 0,
      decision: 'pass',
    });
    expect(result.attemptPointer).toMatchObject({
      phase: 'closed',
      pointerVersion: expect.any(Number),
    });
  });

  it('publishes one typed campaign aggregate bound to evidence and closure lineage', () => {
    const campaign = readJsonArtifact(fixture.root, result.campaignClosure.artifactRef);
    expect(campaign).toMatchObject({
      schemaVersion: 'goal-contract-campaign-closure-receipt/v1',
      profile: 'requirements_backed',
      executionMode: 'direct_goal',
      readinessCandidateRef: {
        path: expect.any(String),
        hash: expect.stringMatching(/^sha256:[a-f0-9]{64}$/u),
      },
      normalizedReadinessCommands: [
        {
          normalizedCommandHash: expect.stringMatching(/^sha256:[a-f0-9]{64}$/u),
          normalizedInvocation: 'node\0--test\0tests/refund-worker.test.cjs',
          commandIds: ['CMD-readiness-refund'],
          expectedTestIds: ['CMD-readiness-refund'],
        },
      ],
      readinessRedOutcomes: [
        {
          normalizedCommandHash: expect.stringMatching(/^sha256:[a-f0-9]{64}$/u),
          commandIds: ['CMD-readiness-refund'],
          status: 'expected_red_observed',
        },
      ],
      orderedClosureRefs: [
        {
          executionAuthorityId: expect.any(String),
          path: result.validClosures[0].artifactRef,
          hash: result.validClosures[0].artifactHash,
        },
      ],
      orderedEvidenceRefs: [
        {
          path: expect.any(String),
          hash: expect.stringMatching(/^sha256:[a-f0-9]{64}$/u),
        },
      ],
      reviewerInvocationCount: 0,
      auditorInvocationCount: 0,
      judgeSemanticAttemptCount: 0,
      decision: 'pass',
    });
  });

  it('renders TaskReport.done projections and stops before Task 7C authorities', () => {
    expect(result.projections.map((entry: { role: string }) => entry.role)).toEqual([
      'campaign_report',
      'final_execution_projection',
      'task_report',
      'main_agent_handoff',
    ]);
    for (const artifact of [
      ...result.validClosures,
      result.campaignClosure,
      ...result.projections,
    ]) {
      expect(existsSync(path.resolve(fixture.root, artifact.artifactRef))).toBe(true);
    }
    const taskReportRef = result.projections.find(
      (entry: { role: string }) => entry.role === 'task_report'
    );
    const taskReport = readJsonArtifact(fixture.root, taskReportRef.artifactRef);
    expect(taskReport).toMatchObject({
      packetId: expect.any(String),
      status: 'done',
      filesChanged: ['src/refund-worker.cjs'],
      validationsRun: ['node --test tests/refund-worker.test.cjs'],
      evidence: [expect.any(String)],
      downstreamContext: expect.arrayContaining([
        `campaignClosureHash=${result.campaignClosure.artifactHash}`,
        'state=pre-final-review',
      ]),
    });
    const handoffRef = result.projections.find(
      (entry: { role: string }) => entry.role === 'main_agent_handoff'
    );
    expect(readJsonArtifact(fixture.root, handoffRef.artifactRef)).toMatchObject({
      state: 'pre-final-review',
      campaignClosureHash: result.campaignClosure.artifactHash,
      taskReportRef: {
        path: taskReportRef.artifactRef,
        hash: taskReportRef.artifactHash,
      },
    });
    const files = listRelativeFiles(path.join(fixture.root, 'goal-run'));
    expect(
      files.filter((file) => /execution-final|effective-pass|delivery-confirmation/iu.test(file))
    ).toEqual([]);
    expect(
      files
        .filter((file) => file.endsWith('.json'))
        .some((file) =>
          readFileSync(path.join(fixture.root, 'goal-run', file), 'utf8').includes('record_closed')
        )
    ).toBe(false);
  });

  it('reuses the closed execution from current consumer state without rerunning the adapter', () => {
    expect(reused.status, reused.stderr || reused.stdout).toBe(0);
    expect(reused.stderr).toBe('');
    expect(reusedResult).toMatchObject({
      schemaVersion: 'main-agent-goal-run-result/v1',
      status: 'execution_reused',
      issueCode: null,
      attemptPointer: {
        artifactHash: result.attemptPointer.artifactHash,
        pointerVersion: result.attemptPointer.pointerVersion,
        phase: 'closed',
      },
      campaignClosure: result.campaignClosure,
    });
  });

  it('recovers published evidence after a crash before closure without rerunning execution', () => {
    const recoveryFixture = materializeImplementationReadinessFixture();
    try {
      produceImplementationReadiness({
        projectRoot: recoveryFixture.root,
        requestId: recoveryFixture.requestId,
      });
      const activated = activateFixture(recoveryFixture.root, recoveryFixture.runtimeRecordPath);
      const execute = () =>
        spawnSync(
          process.execPath,
          [
            TSX,
            '-e',
            RUNTIME_RUNNER,
            RUNTIME,
            'execute-goal-run',
            '--cwd',
            recoveryFixture.root,
            '--active-run',
            activated.activeRun,
            '--json',
          ],
          { cwd: recoveryFixture.root, encoding: 'utf8' }
        );
      const first = execute();
      expect(first.status, first.stderr || first.stdout).toBe(0);
      const firstResult = JSON.parse(first.stdout);
      const campaign = readJsonArtifact(
        recoveryFixture.root,
        firstResult.campaignClosure.artifactRef
      );
      const evidenceRef = campaign.orderedEvidenceRefs[0];
      const evidencePath = path.resolve(recoveryFixture.root, evidenceRef.path);
      const evidenceBytes = readFileSync(evidencePath);
      const pointerPath = path.resolve(
        recoveryFixture.root,
        firstResult.attemptPointer.artifactRef
      );
      const closedPointer = JSON.parse(readFileSync(pointerPath, 'utf8'));
      for (const artifactRef of [
        firstResult.validClosures[0].artifactRef,
        firstResult.campaignClosure.artifactRef,
        ...firstResult.projections.map((entry: { artifactRef: string }) => entry.artifactRef),
      ]) {
        rmSync(path.resolve(recoveryFixture.root, artifactRef), { force: true });
      }
      const { attemptPointerHash: _closedHash, ...closedPayload } = closedPointer;
      const crashPayload = {
        ...closedPayload,
        pointerVersion: closedPointer.pointerVersion + 1,
        phase: 'executing',
        nextExecutionAuthorityId: closedPointer.orderedExecutionAuthorityIds[0],
        validClosureRefs: [],
        blockedIssueCode: null,
      };
      writeFileSync(
        pointerPath,
        `${stableControlPlaneStringify({
          ...crashPayload,
          attemptPointerHash: hashControlPlaneValue(crashPayload),
        })}\n`,
        'utf8'
      );

      const recovered = execute();
      expect(recovered.status, recovered.stderr || recovered.stdout).toBe(0);
      expect(JSON.parse(recovered.stdout)).toMatchObject({
        status: 'closed',
        issueCode: null,
        attemptPointer: { phase: 'closed' },
      });
      expect(readFileSync(evidencePath)).toEqual(evidenceBytes);
    } finally {
      recoveryFixture.cleanup();
    }
  });

  it('remediates a changed owned path from the requested authority boundary', () => {
    const originalClosure = readJsonArtifact(fixture.root, result.validClosures[0].artifactRef);
    writeFileSync(
      fixture.targetPath,
      "module.exports = { refundStatus: () => 'rejected' };\n",
      'utf8'
    );
    const remediated = spawnSync(
      process.execPath,
      [
        TSX,
        '-e',
        RUNTIME_RUNNER,
        RUNTIME,
        'execute-goal-run',
        '--cwd',
        fixture.root,
        '--active-run',
        activeRun,
        '--remediate-from',
        originalClosure.executionAuthorityId,
        '--json',
      ],
      { cwd: fixture.root, encoding: 'utf8' }
    );
    expect(remediated.status, remediated.stderr || remediated.stdout).toBe(0);
    const remediatedResult = JSON.parse(remediated.stdout);
    expect(remediatedResult).toMatchObject({
      status: 'closed',
      issueCode: null,
      attemptPointer: { phase: 'closed' },
    });
    expect(remediatedResult.attemptPointer.pointerVersion).toBeGreaterThan(
      result.attemptPointer.pointerVersion
    );
    expect(readFileSync(fixture.targetPath, 'utf8')).toContain("refundStatus: () => 'accepted'");
    expect(readJsonArtifact(fixture.root, result.validClosures[0].artifactRef)).toEqual(
      originalClosure
    );
  });

  it('automatically remediates a stale closed authority on ordinary resume', () => {
    const originalClosure = readJsonArtifact(fixture.root, result.validClosures[0].artifactRef);
    const previousPointerVersion = result.attemptPointer.pointerVersion;
    writeFileSync(
      fixture.targetPath,
      "module.exports = { refundStatus: () => 'rejected' };\n",
      'utf8'
    );
    const resumed = spawnSync(
      process.execPath,
      [
        TSX,
        '-e',
        RUNTIME_RUNNER,
        RUNTIME,
        'execute-goal-run',
        '--cwd',
        fixture.root,
        '--active-run',
        activeRun,
        '--json',
      ],
      { cwd: fixture.root, encoding: 'utf8' }
    );
    expect(resumed.status, resumed.stderr || resumed.stdout).toBe(0);
    const resumedResult = JSON.parse(resumed.stdout);
    expect(resumedResult).toMatchObject({ status: 'closed', issueCode: null });
    expect(resumedResult.attemptPointer.pointerVersion).toBeGreaterThan(previousPointerVersion);
    expect(readFileSync(fixture.targetPath, 'utf8')).toContain("refundStatus: () => 'accepted'");
    expect(readJsonArtifact(fixture.root, result.validClosures[0].artifactRef)).toEqual(
      originalClosure
    );
  });

  it('returns committed lineage refs when execution enters blocked', () => {
    const blockedFixture = materializeImplementationReadinessFixture();
    produceImplementationReadiness({
      projectRoot: blockedFixture.root,
      requestId: blockedFixture.requestId,
    });
    const blockedActivation = activateFixture(
      blockedFixture.root,
      blockedFixture.runtimeRecordPath,
      {
        adapterSource: [
          'process.stdin.resume();',
          "process.stdin.on('data', () => {});",
          "process.stdin.on('end', () => { process.exitCode = 7; });",
          '',
        ].join('\n'),
      }
    );
    const blocked = spawnSync(
      process.execPath,
      [
        TSX,
        '-e',
        RUNTIME_RUNNER,
        RUNTIME,
        'execute-goal-run',
        '--cwd',
        blockedFixture.root,
        '--active-run',
        blockedActivation.activeRun,
        '--json',
      ],
      { cwd: blockedFixture.root, encoding: 'utf8' }
    );
    expect(blocked.status).toBe(1);
    const blockedResult = JSON.parse(blocked.stdout);
    expect(blockedResult).toMatchObject({
      schemaVersion: 'main-agent-goal-run-result/v1',
      status: 'blocked',
      issueCode: 'goal_execution_adapter_failed',
      activeRunPointer: { artifactRef: expect.any(String), artifactHash: expect.any(String) },
      activationRecord: { artifactRef: expect.any(String), artifactHash: expect.any(String) },
      attemptPointer: { artifactRef: expect.any(String), phase: 'blocked' },
      validClosures: [],
      campaignClosure: null,
      projections: [],
    });
    blockedFixture.cleanup();
  });

  it('reuses a closed execution whose complete owned state includes a deleted target', () => {
    const deletionFixture = materializeImplementationReadinessFixture({
      targetPaths: ['src/refund-worker.cjs', 'src/obsolete-worker.cjs'],
      additionalFiles: {
        'src/obsolete-worker.cjs': 'module.exports = { obsolete: true };\n',
      },
    });
    try {
      produceImplementationReadiness({
        projectRoot: deletionFixture.root,
        requestId: deletionFixture.requestId,
      });
      const activated = activateFixture(deletionFixture.root, deletionFixture.runtimeRecordPath, {
        adapterSource: [
          "const fs = require('node:fs');",
          "const path = require('node:path');",
          "let input = '';",
          "process.stdin.on('data', (chunk) => (input += chunk));",
          "process.stdin.on('end', () => {",
          '  const request = JSON.parse(input);',
          "  const refundPath = request.ownedPaths.find((entry) => entry.includes('refund-worker'));",
          "  const obsoletePath = request.ownedPaths.find((entry) => entry.includes('obsolete-worker'));",
          "  fs.writeFileSync(path.join(request.projectRoot, ...refundPath.split('/')), \"module.exports = { refundStatus: () => 'accepted' };\\n\");",
          "  fs.rmSync(path.join(request.projectRoot, ...obsoletePath.split('/')));",
          "  process.stdout.write(JSON.stringify({ schemaVersion: 'GoalRunMutationResult/v1', exitCode: 0, changedPaths: [...request.ownedPaths].sort() }));",
          '});',
          '',
        ].join('\n'),
      });
      const execute = () =>
        spawnSync(
          process.execPath,
          [
            TSX,
            '-e',
            RUNTIME_RUNNER,
            RUNTIME,
            'execute-goal-run',
            '--cwd',
            deletionFixture.root,
            '--active-run',
            activated.activeRun,
            '--json',
          ],
          { cwd: deletionFixture.root, encoding: 'utf8' }
        );
      const closed = execute();
      expect(closed.status, closed.stderr || closed.stdout).toBe(0);
      const closedResult = JSON.parse(closed.stdout);
      const campaign = readJsonArtifact(
        deletionFixture.root,
        closedResult.campaignClosure.artifactRef
      );
      const evidence = readJsonArtifact(deletionFixture.root, campaign.orderedEvidenceRefs[0].path);
      expect(evidence.ownedPathStates).toContainEqual({
        path: 'src/obsolete-worker.cjs',
        hash: expect.stringMatching(/^sha256:[a-f0-9]{64}$/u),
        exists: false,
      });
      const reusedDeletion = execute();
      expect(reusedDeletion.status, reusedDeletion.stderr || reusedDeletion.stdout).toBe(0);
      expect(JSON.parse(reusedDeletion.stdout)).toMatchObject({
        status: 'execution_reused',
        issueCode: null,
      });
    } finally {
      deletionFixture.cleanup();
    }
  });

  it('rejects a remediation boundary outside the committed authority set', () => {
    const invalid = spawnSync(
      process.execPath,
      [
        TSX,
        '-e',
        RUNTIME_RUNNER,
        RUNTIME,
        'execute-goal-run',
        '--cwd',
        fixture.root,
        '--active-run',
        activeRun,
        '--remediate-from',
        'CHILD-NOT-COMMITTED',
        '--json',
      ],
      { cwd: fixture.root, encoding: 'utf8' }
    );
    expect(invalid.status).toBe(1);
    expect(JSON.parse(invalid.stdout)).toMatchObject({
      status: 'blocked',
      issueCode: 'goal_execution_remediation_boundary_invalid',
      activeRunPointer: { artifactRef: expect.any(String), artifactHash: expect.any(String) },
      activationRecord: { artifactRef: expect.any(String), artifactHash: expect.any(String) },
      attemptPointer: { artifactRef: expect.any(String), phase: 'closed' },
      validClosures: [{ role: 'authority_closure' }],
      campaignClosure: null,
      projections: [],
    });
  });
});
