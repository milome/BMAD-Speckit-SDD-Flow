const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const WAVE_ID = 'main-agent-source-authority-wave-2';
const OUT_DIR = path.join(ROOT, '.tmp', WAVE_ID);
const LOG_DIR = path.join(OUT_DIR, 'command-logs');
const EVIDENCE_PATH = path.join(
  ROOT,
  'repo-governance',
  'script-migrations',
  WAVE_ID,
  'evidence.json'
);

function sha256(value) {
  return `sha256:${crypto.createHash('sha256').update(value || '', 'utf8').digest('hex')}`;
}

function localIsoWithOffset(date = new Date()) {
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const absolute = Math.abs(offsetMinutes);
  const pad = (value) => String(value).padStart(2, '0');
  return [
    date.getFullYear(),
    '-',
    pad(date.getMonth() + 1),
    '-',
    pad(date.getDate()),
    'T',
    pad(date.getHours()),
    ':',
    pad(date.getMinutes()),
    ':',
    pad(date.getSeconds()),
    sign,
    pad(Math.floor(absolute / 60)),
    ':',
    pad(absolute % 60),
  ].join('');
}

function runPwsh(id, label, script) {
  const result = spawnSync('pwsh.exe', ['-NoLogo', '-NoProfile', '-Command', script], {
    cwd: ROOT,
    encoding: 'utf8',
    shell: false,
    maxBuffer: 128 * 1024 * 1024,
  });
  const stdout = String(result.stdout || '');
  const stderr = String(result.stderr || result.error?.message || '');
  const exitCode = result.status == null ? 1 : result.status;
  const baseName = id.toLowerCase();
  fs.writeFileSync(path.join(LOG_DIR, `${baseName}.stdout.log`), stdout, 'utf8');
  fs.writeFileSync(path.join(LOG_DIR, `${baseName}.stderr.log`), stderr, 'utf8');
  process.stdout.write(`${id} exitCode=${exitCode}\n`);
  if (exitCode !== 0) {
    process.stdout.write(`--- ${id} stdout tail ---\n${stdout.slice(-4000)}\n`);
    process.stdout.write(`--- ${id} stderr tail ---\n${stderr.slice(-4000)}\n`);
  }
  return {
    command: `${id} ${label}`,
    exitCode,
    stdoutHash: sha256(stdout),
    stderrHash: sha256(stderr),
    stdoutLog: path.relative(ROOT, path.join(LOG_DIR, `${baseName}.stdout.log`)).replace(/\\/g, '/'),
    stderrLog: path.relative(ROOT, path.join(LOG_DIR, `${baseName}.stderr.log`)).replace(/\\/g, '/'),
  };
}

function listInstallEvidence() {
  const dir = path.join(OUT_DIR, 'install-matrix');
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .map((name) => path.relative(ROOT, path.join(dir, name)).replace(/\\/g, '/'));
}

fs.mkdirSync(LOG_DIR, { recursive: true });
fs.mkdirSync(path.dirname(EVIDENCE_PATH), { recursive: true });

const rows = [
  runPwsh(
    'CMD-03',
    'pwsh.exe -NoLogo -NoProfile -Command "& { npm run test --prefix packages/bmad-speckit -- main-agent-dist-runtime-facade.test.js main-agent-dist-no-root-ts-dispatch.test.js main-agent-compiled-fallback-boundary.test.js main-agent-build-dist.test.js }"',
    '& { npm run test --prefix packages/bmad-speckit -- main-agent-dist-runtime-facade.test.js main-agent-dist-no-root-ts-dispatch.test.js main-agent-compiled-fallback-boundary.test.js main-agent-build-dist.test.js }'
  ),
  runPwsh(
    'CMD-04',
    'pwsh.exe -NoLogo -NoProfile -Command "& { npm run build:main-agent-dist --prefix packages/bmad-speckit }"',
    '& { npm run build:main-agent-dist --prefix packages/bmad-speckit }'
  ),
  runPwsh(
    'CMD-05',
    'pwsh.exe -NoLogo -NoProfile -File .tmp/main-agent-source-authority-wave-2/cmd05-static-covered-dispatch-guard.ps1',
    String.raw`& { pwsh.exe -NoLogo -NoProfile -File '.tmp/main-agent-source-authority-wave-2/cmd05-static-covered-dispatch-guard.ps1'; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE } }`
  ),
  runPwsh(
    'CMD-06',
    'pwsh.exe -NoLogo -NoProfile -Command "& { npx vitest run tests/acceptance/main-agent-dist-consumer-runtime.test.ts }"',
    '& { npx vitest run tests/acceptance/main-agent-dist-consumer-runtime.test.ts }'
  ),
  runPwsh(
    'CMD-07',
    String.raw`pwsh.exe -NoLogo -NoProfile -Command "& { npm run build:main-agent-dist --prefix packages/bmad-speckit; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; New-Item -ItemType Directory -Force '.tmp/main-agent-source-authority-wave-2' | Out-Null; npm pack --pack-destination .tmp/main-agent-source-authority-wave-2; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; npx vitest run tests/acceptance/main-agent-dist-consumer-runtime.test.ts; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE } }"`,
    String.raw`& { npm run build:main-agent-dist --prefix packages/bmad-speckit; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; New-Item -ItemType Directory -Force '.tmp/main-agent-source-authority-wave-2' | Out-Null; npm pack --pack-destination .tmp/main-agent-source-authority-wave-2; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; npx vitest run tests/acceptance/main-agent-dist-consumer-runtime.test.ts; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE } }`
  ),
  runPwsh(
    'CMD-08',
    'pwsh.exe -NoLogo -NoProfile -Command "& { npm run test --prefix packages/bmad-speckit }"',
    '& { npm run test --prefix packages/bmad-speckit }'
  ),
  runPwsh(
    'CMD-09',
    'pwsh.exe -NoLogo -NoProfile -Command "& { node tools/script-migration/validate-registry.cjs; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; npx vitest run tests/acceptance/script-migration-registry-contract.test.ts; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE } }"',
    '& { node tools/script-migration/validate-registry.cjs; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; npx vitest run tests/acceptance/script-migration-registry-contract.test.ts; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE } }'
  ),
  runPwsh(
    'CMD-10',
    'pwsh.exe -NoLogo -NoProfile -Command "& { skill sync static check }"',
    String.raw`& { $a = Get-Content -Raw '_bmad/skills/main-agent-runtime-migration/SKILL.md'; $b = Get-Content -Raw '.codex/skills/main-agent-runtime-migration/SKILL.md'; if ($a -ne $b) { Write-Error 'skill projection mismatch'; exit 1 }; if (-not $a.Contains('root scripts/* deletion requires explicit per-script approval')) { Write-Error 'missing deletion approval warning'; exit 1 }; if (-not $a.Contains('script-migration-registry')) { Write-Error 'missing registry requirement'; exit 1 }; if (-not $a.Contains('install-matrix')) { Write-Error 'missing install matrix requirement'; exit 1 } }`
  ),
];

const targetPaths = [
  'packages/bmad-speckit/src/main-agent/index.js',
  'packages/bmad-speckit/src/main-agent/runtime.js',
  'packages/bmad-speckit/src/main-agent/actions/inspect.js',
  'packages/bmad-speckit/src/main-agent/actions/confirm-scope.js',
  'packages/bmad-speckit/src/main-agent/actions/dispatch-plan.js',
  'packages/bmad-speckit/src/main-agent/actions/run-loop.js',
  'packages/bmad-speckit/dist/main-agent/index.js',
  'packages/bmad-speckit/dist/main-agent/runtime.js',
  'packages/bmad-speckit/dist/main-agent/actions/inspect.js',
  'packages/bmad-speckit/dist/main-agent/actions/confirm-scope.js',
  'packages/bmad-speckit/dist/main-agent/actions/dispatch-plan.js',
  'packages/bmad-speckit/dist/main-agent/actions/run-loop.js',
];

const evidence = {
  waveId: WAVE_ID,
  validatedAt: localIsoWithOffset(),
  entries: [
    {
      entryId: 'main-agent-orchestration',
      originalPath: 'scripts/main-agent-orchestration.ts',
      targetPaths,
      commands: rows,
      installMatrixEvidence: listInstallEvidence(),
      result: rows.every((row) => row.exitCode === 0) ? 'passed' : 'failed',
    },
  ],
};

fs.writeFileSync(EVIDENCE_PATH, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
process.stdout.write(`wrote ${path.relative(ROOT, EVIDENCE_PATH).replace(/\\/g, '/')}\n`);
if (!rows.every((row) => row.exitCode === 0)) process.exit(1);
