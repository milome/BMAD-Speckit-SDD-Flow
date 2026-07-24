import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const {
  buildProbeCommand,
  captureProbeSnapshot,
  compareSnapshots,
  createProductionObservationAdapters,
  runProbeQueue,
  runProbeTest,
  selectProbeCandidates,
  validateProbeSandbox,
} = require('../../tools/test-portfolio-audit/probe.cjs');

const PROBE_FIXTURE = join(process.cwd(), 'tests/fixtures/test-portfolio-audit/probe');
const temporaryRoots: string[] = [];

type ProbeCandidate = {
  testPath: string;
  runnerId: string;
  criticality: string;
  parallelSafety: string;
  durationMs?: number;
  configPath?: string;
};

type ProbeSnapshot = {
  repository: string[];
  environmentHash: string;
  tempEntries: string[];
  processes: string[];
  listeningPorts: string[];
  coverage: {
    repository: boolean;
    environment: boolean;
    temp: boolean;
    processes: boolean;
    ports: boolean;
  };
};

function candidate(testPath: string, overrides: Partial<ProbeCandidate> = {}): ProbeCandidate {
  return {
    testPath,
    runnerId: 'root-vitest',
    criticality: 'standard',
    parallelSafety: 'safe_candidate',
    ...overrides,
  };
}

function snapshot(overrides: Partial<ProbeSnapshot> = {}): ProbeSnapshot {
  return {
    repository: [],
    environmentHash: 'sha256:environment',
    tempEntries: [],
    processes: [],
    listeningPorts: [],
    coverage: {
      repository: true,
      environment: true,
      temp: true,
      processes: true,
      ports: true,
      ...overrides.coverage,
    },
    ...overrides,
  };
}

function monotonicClock(values: number[]): () => number {
  let index = 0;
  return () => values[Math.min(index++, values.length - 1)];
}

function createTemporaryRoot(prefix: string): string {
  const root = mkdtempSync(join(tmpdir(), prefix));
  temporaryRoots.push(root);
  return root;
}

function writeTemporaryFile(root: string, relativePath: string, source: string): string {
  const filePath = join(root, relativePath);
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, source, 'utf8');
  return filePath;
}

function runGit(cwd: string, args: string[]): string {
  const result = spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
    windowsHide: true,
  });
  if (result.error || result.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed: ${result.stderr || result.error?.message}`);
  }
  return result.stdout;
}

function createExternalProbeSandbox(): { root: string; commit: string } {
  const root = createTemporaryRoot('test-portfolio-probe-sandbox-');
  mkdirSync(join(root, 'tests'), { recursive: true });
  copyFileSync(
    join(PROBE_FIXTURE, '.test-portfolio-probe-sandbox.json'),
    join(root, '.test-portfolio-probe-sandbox.json')
  );
  copyFileSync(join(PROBE_FIXTURE, 'tests/clean.test.ts'), join(root, 'tests/clean.test.ts'));
  copyFileSync(
    join(PROBE_FIXTURE, 'tests/mutates-repo.test.ts'),
    join(root, 'tests/mutates-repo.test.ts')
  );
  writeTemporaryFile(
    root,
    'vitest.config.ts',
    [
      'export default {',
      '  test: {',
      '    globals: true,',
      "    include: ['tests/**/*.test.ts'],",
      '  },',
      '};',
      '',
    ].join('\n')
  );
  runGit(root, ['init', '--quiet']);
  runGit(root, ['config', 'user.email', 'probe@example.invalid']);
  runGit(root, ['config', 'user.name', 'Probe Fixture']);
  runGit(root, ['add', '.']);
  runGit(root, ['commit', '--quiet', '-m', 'fixture']);
  return { root, commit: runGit(root, ['rev-parse', 'HEAD']).trim() };
}

function stableObservationAdapters() {
  return {
    repository({ sandboxRoot }: { sandboxRoot: string }) {
      return runGit(sandboxRoot, ['status', '--porcelain=v1', '--untracked-files=all'])
        .split(/\r?\n/)
        .filter(Boolean);
    },
    tempEntries() {
      return [];
    },
    processes() {
      return [];
    },
    listeningPorts() {
      return [];
    },
  };
}

function expectedEnvironmentHash(environment: Record<string, string>): string {
  const sorted = Object.fromEntries(
    Object.entries(environment).sort(([left], [right]) => left.localeCompare(right, 'en'))
  );
  return `sha256:${createHash('sha256')
    .update(Buffer.from(`${JSON.stringify(sorted)}\n`, 'utf8'))
    .digest('hex')}`;
}

afterEach(() => {
  while (temporaryRoots.length > 0) {
    rmSync(temporaryRoots.pop()!, { recursive: true, force: true });
  }
});

describe('test portfolio runtime probe sandbox validation', () => {
  it('rejects a missing sandbox without inspecting the source repository', () => {
    expect(() =>
      validateProbeSandbox({
        repoRoot: process.cwd(),
        expectedCommit: 'abc',
      })
    ).toThrow('PROBE_DISABLED_NO_SANDBOX');
  });

  it('rejects the source repository as a probe sandbox', () => {
    expect(() =>
      validateProbeSandbox({
        repoRoot: process.cwd(),
        sandboxRoot: process.cwd(),
        expectedCommit: 'abc',
      })
    ).toThrow('PROBE_SANDBOX_EQUALS_SOURCE');
  });

  it('rejects a sandbox nested inside the source repository', () => {
    const source = createTemporaryRoot('test-portfolio-probe-source-');
    const sandbox = join(source, 'nested-sandbox');
    mkdirSync(sandbox);

    expect(() =>
      validateProbeSandbox({
        repoRoot: source,
        sandboxRoot: sandbox,
        expectedCommit: 'abc',
      })
    ).toThrow('PROBE_SANDBOX_INSIDE_SOURCE');
  });

  it('rejects an invalid marker before invoking git', () => {
    const source = createTemporaryRoot('test-portfolio-probe-source-');
    const sandbox = createTemporaryRoot('test-portfolio-probe-invalid-marker-');
    writeTemporaryFile(
      sandbox,
      '.test-portfolio-probe-sandbox.json',
      JSON.stringify({
        schemaVersion: 'test-portfolio-probe-sandbox/v1',
        disposable: false,
      })
    );
    let gitCalled = false;

    expect(() =>
      validateProbeSandbox({
        repoRoot: source,
        sandboxRoot: sandbox,
        expectedCommit: 'abc',
        git() {
          gitCalled = true;
          return { stdout: 'abc\n' };
        },
      })
    ).toThrow('PROBE_SANDBOX_MARKER_INVALID');
    expect(gitCalled).toBe(false);
  });

  it('rejects a sandbox whose HEAD does not match the expected commit', () => {
    const source = createTemporaryRoot('test-portfolio-probe-source-');
    const sandbox = createTemporaryRoot('test-portfolio-probe-wrong-commit-');
    copyFileSync(
      join(PROBE_FIXTURE, '.test-portfolio-probe-sandbox.json'),
      join(sandbox, '.test-portfolio-probe-sandbox.json')
    );

    expect(() =>
      validateProbeSandbox({
        repoRoot: source,
        sandboxRoot: sandbox,
        expectedCommit: 'expected',
        git() {
          return { stdout: 'actual\n' };
        },
      })
    ).toThrow('PROBE_SANDBOX_COMMIT_MISMATCH');
  });

  it('accepts an exact disposable marker and only reads git HEAD', () => {
    const source = createTemporaryRoot('test-portfolio-probe-source-');
    const sandbox = createTemporaryRoot('test-portfolio-probe-valid-');
    const markerPath = join(sandbox, '.test-portfolio-probe-sandbox.json');
    const sentinelPath = writeTemporaryFile(sandbox, 'sentinel.txt', 'preserve me\n');
    copyFileSync(join(PROBE_FIXTURE, '.test-portfolio-probe-sandbox.json'), markerPath);
    const gitCalls: Array<{ cwd: string; args: string[] }> = [];

    const result = validateProbeSandbox({
      repoRoot: source,
      sandboxRoot: sandbox,
      expectedCommit: 'expected',
      git(cwd: string, args: string[]) {
        gitCalls.push({ cwd, args });
        return { stdout: 'expected\n' };
      },
    });

    expect(result).toMatchObject({ commit: 'expected' });
    expect(gitCalls).toEqual([{ cwd: sandbox, args: ['rev-parse', 'HEAD'] }]);
    expect(JSON.parse(readFileSync(markerPath, 'utf8'))).toEqual({
      schemaVersion: 'test-portfolio-probe-sandbox/v1',
      disposable: true,
    });
    expect(readFileSync(sentinelPath, 'utf8')).toBe('preserve me\n');
  });
});

describe('test portfolio runtime probe selection', () => {
  it('ranks critical safe candidates first and uses lexical order for critical ties', () => {
    const selected = selectProbeCandidates(
      [
        candidate('tests/z-standard.test.ts', { durationMs: 50_000 }),
        candidate('tests/z-critical.test.ts', {
          criticality: 'critical',
          durationMs: 10,
        }),
        candidate('tests/a-critical.test.ts', {
          criticality: 'critical',
          durationMs: 10,
        }),
        candidate('tests/unknown.test.ts', { parallelSafety: 'unknown', durationMs: 90_000 }),
      ],
      2
    );

    expect(selected.map((row: ProbeCandidate) => row.testPath)).toEqual([
      'tests/a-critical.test.ts',
      'tests/z-critical.test.ts',
    ]);
  });

  it('sorts equal-rank candidates by duration then path and bounds the limit', () => {
    const rows = [
      candidate('tests/unsafe.test.ts', { parallelSafety: 'unsafe', durationMs: 999_999 }),
      candidate('tests/b-safe.test.ts', { durationMs: 300 }),
      candidate('tests/a-safe.test.ts', { durationMs: 300 }),
      candidate('tests/c-safe.test.ts', { durationMs: 100 }),
      candidate('tests/unknown.test.ts', { parallelSafety: 'unknown', durationMs: 500 }),
      candidate('tests/other.test.ts', { parallelSafety: 'not_applicable', durationMs: 600 }),
    ];
    const originalPaths = rows.map((row) => row.testPath);

    expect(selectProbeCandidates(rows, 4.8).map((row: ProbeCandidate) => row.testPath)).toEqual([
      'tests/a-safe.test.ts',
      'tests/b-safe.test.ts',
      'tests/c-safe.test.ts',
      'tests/unknown.test.ts',
    ]);
    expect(selectProbeCandidates(rows, -1)).toEqual([]);
    expect(rows.map((row) => row.testPath)).toEqual(originalPaths);
  });
});

describe('test portfolio runtime probe observations', () => {
  it('captures the complete observation contract with a sorted child environment hash', () => {
    const captured = captureProbeSnapshot({
      sandboxRoot: 'D:/sandbox',
      tempRoot: 'D:/probe-temp',
      childEnv: { ZETA: '2', ALPHA: '1', OMITTED: undefined },
      adapters: {
        repository: () => ['?? z.txt', ' M a.txt'],
        tempEntries: () => ['z.tmp:2:20', 'a.tmp:1:10'],
        processes: () => ['20:1:z', '10:1:a'],
        listeningPorts: () => ['tcp:127.0.0.1:9000:20', 'tcp:127.0.0.1:8000:10'],
      },
    });

    expect(captured).toEqual({
      repository: [' M a.txt', '?? z.txt'],
      environmentHash: expectedEnvironmentHash({ ALPHA: '1', ZETA: '2' }),
      tempEntries: ['a.tmp:1:10', 'z.tmp:2:20'],
      processes: ['10:1:a', '20:1:z'],
      listeningPorts: ['tcp:127.0.0.1:8000:10', 'tcp:127.0.0.1:9000:20'],
      coverage: {
        repository: true,
        environment: true,
        temp: true,
        processes: true,
        ports: true,
      },
    });
  });

  it('marks a missing required adapter as incomplete instead of omitting the dimension', () => {
    const captured = captureProbeSnapshot({
      sandboxRoot: 'D:/sandbox',
      tempRoot: 'D:/probe-temp',
      childEnv: {},
      adapters: {
        repository: () => [],
        tempEntries: () => [],
        listeningPorts: () => [],
      },
    });

    expect(captured.processes).toEqual([]);
    expect(captured.coverage).toEqual({
      repository: true,
      environment: true,
      temp: true,
      processes: false,
      ports: true,
    });
  });

  it('uses git, ps, and ss with netstat fallback on POSIX', () => {
    const calls: Array<{ command: string; args: string[]; cwd?: string }> = [];
    const tempRoot = createTemporaryRoot('test-portfolio-probe-temp-');
    writeTemporaryFile(tempRoot, 'nested/file.txt', 'abc');
    const adapters = createProductionObservationAdapters({
      platform: 'linux',
      spawn(command: string, args: string[], options: { cwd?: string }) {
        calls.push({ command, args, cwd: options.cwd });
        if (command === 'git') return { status: 0, stdout: ' M tracked.txt\n', stderr: '' };
        if (command === 'ps') {
          return { status: 0, stdout: ' 10 1 node worker.js\n', stderr: '' };
        }
        if (command === 'ss') return { status: 1, stdout: '', stderr: 'unavailable' };
        if (command === 'netstat') {
          return {
            status: 0,
            stdout: 'tcp 0 0 127.0.0.1:8123 0.0.0.0:* LISTEN 10/node\n',
            stderr: '',
          };
        }
        throw new Error(`unexpected command ${command}`);
      },
    });

    expect(adapters.repository({ sandboxRoot: '/sandbox' })).toEqual([' M tracked.txt']);
    expect(adapters.processes()).toEqual(['10:1:node worker.js']);
    expect(adapters.listeningPorts()).toEqual(['tcp:127.0.0.1:8123:10']);
    expect(adapters.tempEntries({ tempRoot })[0]).toMatch(/^nested\/file\.txt:3:\d+$/);
    expect(calls).toEqual([
      {
        command: 'git',
        args: ['status', '--porcelain=v1', '--untracked-files=all'],
        cwd: '/sandbox',
      },
      {
        command: 'ps',
        args: ['-eo', 'pid=,ppid=,command='],
        cwd: undefined,
      },
      {
        command: 'ss',
        args: ['-ltnp'],
        cwd: undefined,
      },
      {
        command: 'netstat',
        args: ['-anp'],
        cwd: undefined,
      },
    ]);
  });

  it('uses PowerShell CIM process and TCP connection adapters on Windows', () => {
    const calls: Array<{ command: string; args: string[] }> = [];
    const adapters = createProductionObservationAdapters({
      platform: 'win32',
      spawn(command: string, args: string[]) {
        calls.push({ command, args });
        const script = args.at(-1) || '';
        if (script.includes('Get-CimInstance')) {
          return { status: 0, stdout: '10:1:node worker.js\n', stderr: '' };
        }
        if (script.includes('Get-NetTCPConnection')) {
          return { status: 0, stdout: 'tcp:127.0.0.1:8123:10\n', stderr: '' };
        }
        throw new Error(`unexpected PowerShell command ${script}`);
      },
    });

    expect(adapters.processes()).toEqual(['10:1:node worker.js']);
    expect(adapters.listeningPorts()).toEqual(['tcp:127.0.0.1:8123:10']);
    expect(calls).toHaveLength(2);
    expect(calls.every((call) => call.command === 'pwsh.exe')).toBe(true);
    expect(calls[0].args.slice(0, 3)).toEqual(['-NoLogo', '-NoProfile', '-Command']);
    expect(calls[0].args[3]).toBe(
      'Get-CimInstance Win32_Process | Sort-Object ProcessId | ForEach-Object { "$($_.ProcessId):$($_.ParentProcessId):$($_.CommandLine)" }'
    );
    expect(calls[1].args[3]).toBe(
      'Get-NetTCPConnection -State Listen | Sort-Object LocalAddress,LocalPort,OwningProcess | ForEach-Object { "tcp:$($_.LocalAddress):$($_.LocalPort):$($_.OwningProcess)" }'
    );
  });
});

describe('test portfolio runtime probe child runner', () => {
  it('builds supported runner commands and locates the official Vitest 4 CLI', () => {
    const packageRoot = dirname(require.resolve('vitest/package.json'));
    const vitestPackage = require('vitest/package.json');
    const expectedCli = join(packageRoot, String(vitestPackage.bin.vitest).replace(/^\.\//, ''));

    expect(
      buildProbeCommand({
        sandboxRoot: 'D:/sandbox',
        candidate: candidate('tests/clean.test.ts'),
      })
    ).toEqual({
      command: process.execPath,
      args: [
        expectedCli,
        'run',
        '--no-cache',
        '--config',
        join('D:/sandbox', 'vitest.config.ts'),
        'tests/clean.test.ts',
      ],
    });
    expect(
      buildProbeCommand({
        sandboxRoot: 'D:/sandbox',
        candidate: candidate('packages/bmad-speckit/tests/clean.test.js', {
          runnerId: 'bmad-speckit-node-test',
        }),
      })
    ).toEqual({
      command: process.execPath,
      args: [
        join('D:/sandbox', 'packages/bmad-speckit/scripts/run-node-tests.cjs'),
        'packages/bmad-speckit/tests/clean.test.js',
      ],
    });
  });

  it('spawns only the owned child with sandbox cwd, owned temp, and a bounded timeout', () => {
    const calls: Array<{
      command: string;
      args: string[];
      options: Record<string, unknown>;
    }> = [];
    const result = runProbeTest({
      sandboxRoot: 'D:/sandbox',
      tempRoot: 'D:/owned-temp',
      childEnv: { KEEP: 'yes' },
      candidate: candidate('tests/clean.test.ts'),
      timeoutMs: 1234,
      spawn(command: string, args: string[], options: Record<string, unknown>) {
        calls.push({ command, args, options });
        return { status: 0, stdout: 'ok', stderr: '' };
      },
    });

    expect(result).toMatchObject({ status: 0, timedOut: false });
    expect(calls).toHaveLength(1);
    expect(calls[0].command).toBe(process.execPath);
    expect(calls[0].options).toMatchObject({
      cwd: 'D:/sandbox',
      encoding: 'utf8',
      timeout: 1234,
      windowsHide: true,
    });
    expect(calls[0].options.env).toMatchObject({
      KEEP: 'yes',
      TMP: 'D:/owned-temp',
      TEMP: 'D:/owned-temp',
      TMPDIR: 'D:/owned-temp',
    });
  });
});

describe('test portfolio runtime probe snapshot comparison', () => {
  it.each([
    [
      'repository mutation',
      snapshot(),
      snapshot({ repository: ['?? generated/output.json'] }),
      'PROBE_REPOSITORY_MUTATION',
    ],
    [
      'temporary state leak',
      snapshot(),
      snapshot({ tempEntries: ['leak.tmp:1:1'] }),
      'PROBE_TEMP_STATE_LEAK',
    ],
    [
      'process leak',
      snapshot(),
      snapshot({ processes: ['42:1:node worker.js'] }),
      'PROBE_PROCESS_LEAK',
    ],
    [
      'port leak',
      snapshot(),
      snapshot({ listeningPorts: ['tcp:127.0.0.1:8123:42'] }),
      'PROBE_PORT_LEAK',
    ],
  ])('classifies %s as unsafe with high confidence', (_name, before, after, issueCode) => {
    expect(compareSnapshots(before, after)).toEqual({
      value: 'unsafe',
      confidence: 'high',
      issueCodes: [issueCode],
    });
  });

  it('returns unknown with low confidence when any required observation is incomplete', () => {
    const result = compareSnapshots(
      snapshot(),
      snapshot({
        repository: ['?? mutation.txt'],
        coverage: { processes: false },
      })
    );

    expect(result).toEqual({
      value: 'unknown',
      confidence: 'low',
      issueCodes: ['PROBE_OBSERVATION_INCOMPLETE', 'PROBE_REPOSITORY_MUTATION'],
    });
  });

  it('keeps a clean observation as safe_candidate with medium confidence only', () => {
    expect(compareSnapshots(snapshot(), snapshot())).toEqual({
      value: 'safe_candidate',
      confidence: 'medium',
      issueCodes: [],
    });
  });
});

describe('test portfolio runtime probe queue', () => {
  it('detects a real sandbox repository mutation without touching the source workspace', async () => {
    const sandbox = createExternalProbeSandbox();
    const sourceMutation = join(process.cwd(), 'probe-mutation.txt');
    expect(existsSync(sourceMutation)).toBe(false);

    const result = await runProbeQueue({
      repoRoot: process.cwd(),
      sandboxRoot: sandbox.root,
      expectedCommit: sandbox.commit,
      candidates: [
        candidate('tests/mutates-repo.test.ts', {
          criticality: 'critical',
          durationMs: 100,
        }),
      ],
      limit: 1,
      budgetMs: 30_000,
      perTestTimeoutMs: 20_000,
      captureSnapshot(input: Record<string, unknown>) {
        return captureProbeSnapshot({
          ...input,
          adapters: stableObservationAdapters(),
        });
      },
    });

    expect(result.results[0]).toMatchObject({
      testPath: 'tests/mutates-repo.test.ts',
      value: 'unsafe',
      confidence: 'high',
      issueCodes: ['PROBE_REPOSITORY_MUTATION'],
    });
    expect(result).toMatchObject({
      requested: 1,
      selected: 1,
      completed: 1,
      failed: 0,
      timedOut: 0,
      unprobed: 0,
      issueCodes: [],
    });
    expect(existsSync(join(sandbox.root, 'probe-mutation.txt'))).toBe(true);
    expect(existsSync(sourceMutation)).toBe(false);
  }, 30_000);

  it('does not upgrade a real clean sandbox run beyond safe_candidate medium', async () => {
    const sandbox = createExternalProbeSandbox();
    const result = await runProbeQueue({
      repoRoot: process.cwd(),
      sandboxRoot: sandbox.root,
      expectedCommit: sandbox.commit,
      candidates: [candidate('tests/clean.test.ts', { durationMs: 100 })],
      limit: 1,
      budgetMs: 30_000,
      perTestTimeoutMs: 20_000,
      captureSnapshot(input: Record<string, unknown>) {
        return captureProbeSnapshot({
          ...input,
          adapters: stableObservationAdapters(),
        });
      },
    });

    expect(result.results[0]).toMatchObject({
      value: 'safe_candidate',
      confidence: 'medium',
      issueCodes: [],
    });
  }, 30_000);

  it('records a timed-out child as unknown and preserves timeout counts', async () => {
    const result = await runProbeQueue({
      repoRoot: 'D:/source',
      sandboxRoot: 'D:/sandbox',
      expectedCommit: 'abc',
      candidates: [candidate('tests/timeout.test.ts')],
      limit: 1,
      budgetMs: 1000,
      now: monotonicClock([0, 10]),
      validateSandbox: () => ({ source: 'D:/source', sandbox: 'D:/sandbox', commit: 'abc' }),
      captureSnapshot: () => snapshot(),
      runTest: () => ({ status: null, timedOut: true, stdout: '', stderr: '' }),
    });

    expect(result.results[0]).toMatchObject({
      value: 'unknown',
      confidence: 'low',
      issueCodes: ['PROBE_TEST_TIMEOUT'],
    });
    expect(result).toMatchObject({
      requested: 1,
      selected: 1,
      completed: 0,
      failed: 0,
      timedOut: 1,
      unprobed: 0,
    });
  });

  it('records a failed child as unknown and preserves failed counts', async () => {
    const result = await runProbeQueue({
      repoRoot: 'D:/source',
      sandboxRoot: 'D:/sandbox',
      expectedCommit: 'abc',
      candidates: [candidate('tests/fails.test.ts')],
      limit: 1,
      budgetMs: 1000,
      now: monotonicClock([0, 10]),
      validateSandbox: () => ({ source: 'D:/source', sandbox: 'D:/sandbox', commit: 'abc' }),
      captureSnapshot: () => snapshot(),
      runTest: () => ({ status: 1, timedOut: false, stdout: '', stderr: 'failed' }),
    });

    expect(result.results[0]).toMatchObject({
      value: 'unknown',
      confidence: 'low',
      issueCodes: ['PROBE_TEST_FAILED'],
    });
    expect(result).toMatchObject({
      requested: 1,
      selected: 1,
      completed: 0,
      failed: 1,
      timedOut: 0,
      unprobed: 0,
    });
  });

  it('stops at the total budget and reports remaining requested probes as unprobed', async () => {
    let runCount = 0;
    const result = await runProbeQueue({
      repoRoot: 'D:/source',
      sandboxRoot: 'D:/sandbox',
      expectedCommit: 'abc',
      candidates: [
        candidate('tests/a.test.ts', { durationMs: 200 }),
        candidate('tests/b.test.ts', { durationMs: 100 }),
      ],
      limit: 2,
      budgetMs: 50,
      now: monotonicClock([0, 0, 100]),
      validateSandbox: () => ({ source: 'D:/source', sandbox: 'D:/sandbox', commit: 'abc' }),
      captureSnapshot: () => snapshot(),
      runTest: () => {
        runCount += 1;
        return { status: 0, timedOut: false, stdout: '', stderr: '' };
      },
    });

    expect(runCount).toBe(1);
    expect(result).toMatchObject({
      requested: 2,
      selected: 2,
      completed: 1,
      failed: 0,
      timedOut: 0,
      unprobed: 1,
      issueCodes: ['PROBE_BUDGET_EXHAUSTED'],
    });
  });

  it('downgrades a successful child when a required observation adapter is missing', async () => {
    const incomplete = snapshot({ coverage: { processes: false } });
    const result = await runProbeQueue({
      repoRoot: 'D:/source',
      sandboxRoot: 'D:/sandbox',
      expectedCommit: 'abc',
      candidates: [candidate('tests/incomplete.test.ts')],
      limit: 1,
      budgetMs: 1000,
      now: monotonicClock([0, 10]),
      validateSandbox: () => ({ source: 'D:/source', sandbox: 'D:/sandbox', commit: 'abc' }),
      captureSnapshot: () => incomplete,
      runTest: () => ({ status: 0, timedOut: false, stdout: '', stderr: '' }),
    });

    expect(result.results[0]).toMatchObject({
      value: 'unknown',
      confidence: 'low',
      issueCodes: ['PROBE_OBSERVATION_INCOMPLETE'],
    });
    expect(result.completed).toBe(1);
  });

  it('rejects a non-owned temp root without deleting the supplied directory', async () => {
    const unownedTempRoot = createTemporaryRoot('test-portfolio-unowned-temp-');
    const sentinel = writeTemporaryFile(unownedTempRoot, 'sentinel.txt', 'preserve me\n');

    await expect(
      runProbeQueue({
        repoRoot: 'D:/source',
        sandboxRoot: 'D:/sandbox',
        expectedCommit: 'abc',
        candidates: [candidate('tests/not-run.test.ts')],
        limit: 1,
        budgetMs: 1000,
        now: monotonicClock([0, 10]),
        validateSandbox: () => ({
          source: 'D:/source',
          sandbox: 'D:/sandbox',
          commit: 'abc',
        }),
        createTempRoot: () => unownedTempRoot,
        captureSnapshot: () => snapshot(),
        runTest: () => ({ status: 0, timedOut: false, stdout: '', stderr: '' }),
      })
    ).rejects.toThrow('PROBE_TEMP_ROOT_NOT_OWNED');
    expect(readFileSync(sentinel, 'utf8')).toBe('preserve me\n');
  });

  it('keeps limit zero composable without validating or executing a sandbox', async () => {
    let called = false;
    const result = await runProbeQueue({
      repoRoot: process.cwd(),
      candidates: [candidate('tests/not-run.test.ts')],
      limit: 0,
      budgetMs: 1000,
      validateSandbox: () => {
        called = true;
        throw new Error('must not validate');
      },
      runTest: () => {
        called = true;
        throw new Error('must not run');
      },
    });

    expect(called).toBe(false);
    expect(result).toEqual({
      requested: 1,
      selected: 0,
      completed: 0,
      failed: 0,
      timedOut: 0,
      unprobed: 1,
      issueCodes: [],
      results: [],
    });
  });

  it('disables a positive probe limit without a sandbox and selects nothing', async () => {
    const result = await runProbeQueue({
      repoRoot: process.cwd(),
      candidates: [candidate('tests/not-run.test.ts')],
      limit: 1,
      budgetMs: 1000,
    });

    expect(result).toEqual({
      requested: 1,
      selected: 0,
      completed: 0,
      failed: 0,
      timedOut: 0,
      unprobed: 1,
      issueCodes: ['PROBE_DISABLED_NO_SANDBOX'],
      results: [],
    });
  });
});
