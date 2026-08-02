const assert = require('node:assert');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { describe, it } = require('node:test');

const PACKAGE_ROOT = path.resolve(__dirname, '..');
const BIN = path.join(PACKAGE_ROOT, 'bin', 'bmad-speckit.js');
const SOURCE_COMMAND = path.join(
  PACKAGE_ROOT,
  'src',
  'commands',
  'goal-contract.ts'
);
const DIST_COMMAND = path.join(
  PACKAGE_ROOT,
  'dist',
  'commands',
  'goal-contract.js'
);
const POWERSHELL_EXECUTABLE =
  process.platform === 'win32' ? 'pwsh.exe' : 'pwsh';
const COMMAND_RUNNER = [
  'const { goalContractCommand } = require(process.argv[1]);',
  'Promise.resolve(goalContractCommand({}, process.argv.slice(2)))',
  '.then((code)=>{process.exitCode=code;})',
  '.catch((error)=>{console.error(error);process.exitCode=1;});',
].join('');
const sha256 = (bytes) =>
  `sha256:${createHash('sha256').update(bytes).digest('hex')}`;

function fixture() {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), 'release-gate-exit-code-')
  );
  const source = path.join(root, 'source.md');
  const goal = path.join(root, 'goal.md');
  const coverage = path.join(root, 'coverage.json');
  const generation = path.join(root, 'generation.json');
  fs.writeFileSync(source, '# Source\n', 'utf8');
  fs.writeFileSync(goal, '# Goal\n', 'utf8');
  const sourcePlanHash = sha256(fs.readFileSync(source));
  const goalContractHash = sha256(fs.readFileSync(goal));
  fs.writeFileSync(
    coverage,
    `${JSON.stringify(
      {
        sourcePlanHash,
        goalContractHash,
        unmappedSourceObligations: [],
        orphanGeneratedRefs: [],
        blockingReasons: [],
        decision: 'pass',
      },
      null,
      2
    )}\n`,
    'utf8'
  );
  fs.writeFileSync(
    generation,
    `${JSON.stringify(
      {
        ok: true,
        sourcePlanHash,
        goalContractHash,
        unmappedSourceObligations: 0,
        coverageReceiptPath: coverage,
      },
      null,
      2
    )}\n`,
    'utf8'
  );
  return { root, source, goal, coverage, generation };
}

function releaseArgs(current, { blocked = false, json = true } = {}) {
  const args = [
    'release-gate',
    '--source',
    blocked ? path.join(current.root, 'missing-source.md') : current.source,
    '--goal',
    blocked ? path.join(current.root, 'missing-goal.md') : current.goal,
    '--coverage',
    current.coverage,
    '--generation',
    current.generation,
  ];
  if (json) args.push('--json');
  return args;
}

function runCommand(commandPath, args) {
  return spawnSync(
    process.execPath,
    ['-e', COMMAND_RUNNER, commandPath, ...args],
    {
      cwd: PACKAGE_ROOT,
      encoding: 'utf8',
      maxBuffer: 4 * 1024 * 1024,
    }
  );
}

function runRepositoryBin(args) {
  return spawnSync(
    process.execPath,
    [BIN, 'goal-contract', ...args],
    {
      cwd: PACKAGE_ROOT,
      encoding: 'utf8',
      maxBuffer: 4 * 1024 * 1024,
    }
  );
}

function quotePowerShell(value) {
  return `'${String(value).replace(/'/gu, "''")}'`;
}

function runPowerShellWrapper(args, propagate) {
  const invocation = [
    '&',
    quotePowerShell(process.execPath),
    quotePowerShell(BIN),
    quotePowerShell('goal-contract'),
    ...args.map(quotePowerShell),
  ].join(' ');
  const command = propagate
    ? `& { ${invocation}; $nativeStatus = $LASTEXITCODE; exit $nativeStatus }`
    : `& { ${invocation} }`;
  return spawnSync(
    POWERSHELL_EXECUTABLE,
    ['-NoLogo', '-NoProfile', '-Command', command],
    {
      cwd: PACKAGE_ROOT,
      encoding: 'utf8',
      maxBuffer: 4 * 1024 * 1024,
    }
  );
}

function jsonOutput(result) {
  return JSON.parse(result.stdout);
}

describe('goal-contract release-gate exit-code parity', () => {
  it('returns zero only for ok:true and decision:pass', () => {
    const current = fixture();
    for (const result of [
      runCommand(SOURCE_COMMAND, releaseArgs(current)),
      runCommand(DIST_COMMAND, releaseArgs(current)),
      runRepositoryBin(releaseArgs(current)),
    ]) {
      assert.equal(result.status, 0, result.stderr || result.stdout);
      assert.equal(jsonOutput(result).ok, true);
      assert.equal(jsonOutput(result).decision, 'pass');
    }
  });

  it('returns one for blocked JSON and text output on every native surface', () => {
    const current = fixture();
    for (const commandPath of [SOURCE_COMMAND, DIST_COMMAND]) {
      const result = runCommand(
        commandPath,
        releaseArgs(current, { blocked: true })
      );
      assert.equal(result.status, 1, result.stderr || result.stdout);
      assert.equal(jsonOutput(result).ok, false);
      assert.equal(jsonOutput(result).decision, 'blocked');
    }
    const repositoryJson = runRepositoryBin(
      releaseArgs(current, { blocked: true })
    );
    assert.equal(
      repositoryJson.status,
      1,
      repositoryJson.stderr || repositoryJson.stdout
    );
    assert.equal(jsonOutput(repositoryJson).ok, false);
    assert.equal(jsonOutput(repositoryJson).decision, 'blocked');

    const repositoryText = runRepositoryBin(
      releaseArgs(current, { blocked: true, json: false })
    );
    assert.equal(
      repositoryText.status,
      1,
      repositoryText.stderr || repositoryText.stdout
    );
    assert.match(repositoryText.stdout, /^BLOCKED:/u);
  });

  it('proves PowerShell wrappers must explicitly propagate native status', () => {
    const current = fixture();
    const args = releaseArgs(current, { blocked: true });
    const omitted = runPowerShellWrapper(args, false);
    const explicit = runPowerShellWrapper(args, true);

    assert.equal(jsonOutput(omitted).decision, 'blocked');
    assert.equal(omitted.status, 0);
    assert.equal(jsonOutput(explicit).decision, 'blocked');
    assert.equal(explicit.status, 1);
  });
});
