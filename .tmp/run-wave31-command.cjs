const { spawnSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');
const receiptDir = path.join(repoRoot, '.tmp', 'main-agent-runtime-migration-wave-3.1', 'command-receipts');

function sha256(text) {
  return `sha256:${createHash('sha256').update(text, 'utf8').digest('hex')}`;
}

function runPwsh(script) {
  const result = spawnSync('pwsh.exe', ['-NoLogo', '-NoProfile', '-Command', `& { ${script} }`], {
    cwd: repoRoot,
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 64,
  });
  return {
    exitCode: result.status ?? 1,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
  };
}

const commands = {
  'CMD-01': {
    command: 'pwsh.exe -NoLogo -NoProfile -Command "& { git status --short --branch }"',
    script: 'git status --short --branch',
  },
  'CMD-02': {
    command: 'pwsh.exe -NoLogo -NoProfile -Command "& { node _bmad/skills/encoding-integrity-guardian/scripts/check-encoding-integrity.js }"',
    script: 'node _bmad/skills/encoding-integrity-guardian/scripts/check-encoding-integrity.js',
  },
  'CMD-03': {
    command: 'pwsh.exe -NoLogo -NoProfile -Command "& { <candidate set check> }"',
    script: String.raw`$ErrorActionPreference = 'Stop'; $priorityPath = 'repo-governance/script-migrations/main-agent-runtime-closure-wave-3/priority-matrix.md'; $expectedHash = '8499ef2f50f850a690d0aae3cf5191f661cf719b3517f4e87e3037602fc18a82'; $bytes = [System.IO.File]::ReadAllBytes((Resolve-Path $priorityPath)); $sha = [System.Security.Cryptography.SHA256]::Create(); $actualHash = (($sha.ComputeHash($bytes) | ForEach-Object { $_.ToString('x2') }) -join ''); if ($actualHash -ne $expectedHash) { Write-Error ('sourcePlanHash mismatch: ' + $actualHash); exit 1 }; $expected = @{'scripts/main-agent-release-gate.ts'='package_runtime_module'; 'scripts/main-agent-quality-gate.ts'='package_runtime_module'; 'scripts/main-agent-delivery-truth-gate.ts'='package_runtime_module'; 'scripts/run-auditor-host.ts'='runtime_emit_cjs'; 'scripts/write-runtime-context.cjs'='durable_helper_copy'; 'scripts/eval-questions-cli.ts'='public_cli_de_surface'; 'scripts/main-agent-bmad-help-five-layer-matrix.ts'='public_cli_de_surface'; 'scripts/main-agent-host-matrix-pr-orchestrator.ts'='public_cli_de_surface'; 'scripts/bmads-auto-cli.ts'='public_cli_de_surface'}; $j = Get-Content -Raw 'repo-governance/script-migrations/main-agent-runtime-closure-wave-3/closure-inventory.json' | ConvertFrom-Json; $c = @($j.nextWaveCandidates); $c | Select-Object scriptPath,migrationStrategy,deletionAllowed | ConvertTo-Json -Depth 4; if ($c.Count -ne 9) { exit 1 }; foreach ($row in $c) { if (-not $expected.ContainsKey($row.scriptPath)) { Write-Error ('unexpected candidate: ' + $row.scriptPath); exit 1 }; if ($expected[$row.scriptPath] -ne $row.migrationStrategy) { Write-Error ('strategy mismatch: ' + $row.scriptPath); exit 1 }; if ($row.deletionAllowed -ne $false) { Write-Error ('deletion allowed: ' + $row.scriptPath); exit 1 } }; Write-Output ('sourcePlanHash=sha256:' + $actualHash); exit 0`,
  },
  'CMD-04': {
    command: 'pwsh.exe -NoLogo -NoProfile -Command "& { npm run test --prefix packages/bmad-speckit; exit `$LASTEXITCODE }"',
    script: 'npm run test --prefix packages/bmad-speckit; exit $LASTEXITCODE',
  },
  'CMD-05': {
    command: 'pwsh.exe -NoLogo -NoProfile -Command "& { npm run build:main-agent-dist --prefix packages/bmad-speckit; exit `$LASTEXITCODE }"',
    script: 'npm run build:main-agent-dist --prefix packages/bmad-speckit; exit $LASTEXITCODE',
  },
  'CMD-06': {
    command: 'pwsh.exe -NoLogo -NoProfile -Command "& { `$pkg = Get-Content -Raw \'packages/bmad-speckit/package.json\' | ConvertFrom-Json; `$pkg.files | ConvertTo-Json -Depth 4; if (@(`$pkg.files) -notcontains \'dist/\') { exit 1 }; exit 0 }"',
    script: "$pkg = Get-Content -Raw 'packages/bmad-speckit/package.json' | ConvertFrom-Json; $pkg.files | ConvertTo-Json -Depth 4; if (@($pkg.files) -notcontains 'dist/') { exit 1 }; exit 0",
  },
  'CMD-07': {
    command: 'pwsh.exe -NoLogo -NoProfile -Command "& { rg <Wave 3.1 public runRepoScript seed scan>; exit }"',
    script: String.raw`rg -n -e 'runRepoScript\(''main-agent-release-gate\.ts''' -e 'runRepoScript\(''main-agent-quality-gate\.ts''' -e 'runRepoScript\(''main-agent-delivery-truth-gate\.ts''' -e 'runRepoScript\(''run-auditor-host\.ts''' -e 'runRepoScript\(''write-runtime-context\.cjs''' -e 'runRepoScript\(''eval-questions-cli\.ts''' -e 'runRepoScript\(''main-agent-bmad-help-five-layer-matrix\.ts''' -e 'runRepoScript\(''main-agent-host-matrix-pr-orchestrator\.ts''' -e 'runRepoScript\(''bmads-auto-cli\.ts''' -e 'ensure-governance-user-story-mapping-fixture\.js' -- 'packages/bmad-speckit/bin/bmad-speckit.js'; if ($LASTEXITCODE -eq 0) { exit 1 }; if ($LASTEXITCODE -eq 1) { exit 0 }; exit $LASTEXITCODE`,
  },
  'CMD-08': {
    command: 'pwsh.exe -NoLogo -NoProfile -Command "& { <static no root TypeScript dispatch guard> }"',
    script: String.raw`$paths = @('packages/bmad-speckit/src/main-agent/index.js', 'packages/bmad-speckit/src/main-agent/runtime.js', 'packages/bmad-speckit/src/main-agent/actions/release-gate.js', 'packages/bmad-speckit/src/main-agent/actions/quality-gate.js', 'packages/bmad-speckit/src/main-agent/actions/delivery-truth-gate.js', 'packages/bmad-speckit/src/main-agent/auditor-host/run-auditor-host.cjs', 'packages/bmad-speckit/src/main-agent/helpers/write-runtime-context.cjs', 'packages/bmad-speckit/dist/main-agent/index.js', 'packages/bmad-speckit/dist/main-agent/runtime.js', 'packages/bmad-speckit/dist/main-agent/actions/release-gate.js', 'packages/bmad-speckit/dist/main-agent/actions/quality-gate.js', 'packages/bmad-speckit/dist/main-agent/actions/delivery-truth-gate.js', 'packages/bmad-speckit/dist/main-agent/auditor-host/run-auditor-host.cjs', 'packages/bmad-speckit/dist/main-agent/helpers/write-runtime-context.cjs'); foreach ($path in $paths) { if (-not (Test-Path $path)) { Write-Error ('missing static guard path: ' + $path); exit 1 } }; rg -n -e 'scripts[\\/]main-agent-release-gate\.ts' -e 'scripts[\\/]main-agent-quality-gate\.ts' -e 'scripts[\\/]main-agent-delivery-truth-gate\.ts' -e 'scripts[\\/]run-auditor-host\.ts' -e 'scripts[\\/]write-runtime-context\.cjs' -e 'scripts[\\/]eval-questions-cli\.ts' -e 'scripts[\\/]main-agent-bmad-help-five-layer-matrix\.ts' -e 'scripts[\\/]main-agent-host-matrix-pr-orchestrator\.ts' -e 'scripts[\\/]bmads-auto-cli\.ts' -e 'ensure-governance-user-story-mapping-fixture\.js' -e 'runRepoScript\(' -e '\btsx\b' -e '\bts-node\b' -- $paths; if ($LASTEXITCODE -eq 0) { exit 1 }; if ($LASTEXITCODE -eq 1) { exit 0 }; exit $LASTEXITCODE`,
  },
  'CMD-09': {
    command: 'pwsh.exe -NoLogo -NoProfile -Command "& { node tools/script-migration/validate-registry.cjs; exit `$LASTEXITCODE }"',
    script: 'node tools/script-migration/validate-registry.cjs; exit $LASTEXITCODE',
  },
  'CMD-10': {
    command: 'pwsh.exe -NoLogo -NoProfile -Command "& { node tools/script-migration/validate-main-agent-runtime-migration-wave-3-1.cjs; exit `$LASTEXITCODE }"',
    script: 'node tools/script-migration/validate-main-agent-runtime-migration-wave-3-1.cjs; exit $LASTEXITCODE',
  },
  'CMD-11': {
    command: 'pwsh.exe -NoLogo -NoProfile -Command "& { <CLI smoke probes> }"',
    script: String.raw`$ErrorActionPreference = 'Stop'; $bin = 'packages/bmad-speckit/bin/bmad-speckit.js'; foreach ($cmd in @('main-agent:release-gate', 'main-agent:quality-gate', 'main-agent:delivery-truth-gate')) { $out = & node $bin $cmd '--json'; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; $json = ($out -join [Environment]::NewLine) | ConvertFrom-Json; if (-not $json.schemaVersion -or -not $json.action) { Write-Error ('missing JSON envelope for ' + $cmd); exit 1 } }; foreach ($cmd in @('run-auditor-host', 'write-runtime-context')) { $help = (& node $bin $cmd '--help') -join [Environment]::NewLine; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; if ($help -match 'scripts[\\/]') { Write-Error ('help leaks root script path for ' + $cmd); exit 1 } }; $rootHelp = (& node $bin '--help') -join [Environment]::NewLine; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; foreach ($cmd in @('eval-questions', 'main-agent:bmad-help-five-layer-matrix', 'main-agent:host-matrix-pr-orchestrate', 'bmads-auto')) { if ($rootHelp -notmatch [regex]::Escape($cmd)) { Write-Error ('root help missing alias ' + $cmd); exit 1 }; $help = (& node $bin $cmd '--help') -join [Environment]::NewLine; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; if ($help -notmatch 'deprecated') { Write-Error ('alias help missing deprecated marker for ' + $cmd); exit 1 }; if ($help -match 'scripts[\\/]') { Write-Error ('alias help leaks root script path for ' + $cmd); exit 1 }; $out = & node $bin $cmd '--json'; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; $json = ($out -join [Environment]::NewLine) | ConvertFrom-Json; if ($json.status -ne 'deprecated') { Write-Error ('alias JSON status is not deprecated for ' + $cmd); exit 1 } }; exit 0`,
  },
  'CMD-12': {
    command: 'pwsh.exe -NoLogo -NoProfile -Command "& { node tools/script-migration/run-main-agent-wave-3-1-install-matrix.cjs; exit `$LASTEXITCODE }"',
    script: 'node tools/script-migration/run-main-agent-wave-3-1-install-matrix.cjs; exit $LASTEXITCODE',
  },
  'CMD-13': {
    command: 'pwsh.exe -NoLogo -NoProfile -Command "& { npx vitest run tests/acceptance/main-agent-runtime-migration-wave-3-1-contract.test.ts; exit `$LASTEXITCODE }"',
    script: 'npx vitest run tests/acceptance/main-agent-runtime-migration-wave-3-1-contract.test.ts; exit $LASTEXITCODE',
  },
  'CMD-14': {
    command: 'pwsh.exe -NoLogo -NoProfile -Command "& { <no root script deletion check> }"',
    script: String.raw`$required = @('scripts/main-agent-release-gate.ts', 'scripts/main-agent-quality-gate.ts', 'scripts/main-agent-delivery-truth-gate.ts', 'scripts/run-auditor-host.ts', 'scripts/write-runtime-context.cjs', 'scripts/eval-questions-cli.ts', 'scripts/main-agent-bmad-help-five-layer-matrix.ts', 'scripts/main-agent-host-matrix-pr-orchestrator.ts', 'scripts/bmads-auto-cli.ts'); foreach ($path in $required) { if (-not (Test-Path $path)) { Write-Error ('missing original root script: ' + $path); exit 1 } }; $status = git status --short -- scripts; $status; if ($status | Select-String -Pattern '^( D|D |R )\s+scripts[\\/]') { exit 1 }; exit 0`,
  },
  'CMD-15': {
    command: 'pwsh.exe -NoLogo -NoProfile -Command "& { node _bmad/skills/encoding-integrity-guardian/scripts/check-encoding-integrity.js; exit `$LASTEXITCODE }"',
    script: 'node _bmad/skills/encoding-integrity-guardian/scripts/check-encoding-integrity.js; exit $LASTEXITCODE',
  },
  'CMD-16': {
    command: 'pwsh.exe -NoLogo -NoProfile -Command "& { git status --short }"',
    script: 'git status --short',
  },
};

function writeReceipt(id, command, result) {
  fs.mkdirSync(receiptDir, { recursive: true });
  const receipt = {
    id,
    command,
    executedAt: new Date().toISOString(),
    exitCode: result.exitCode,
    stdoutHash: sha256(result.stdout),
    stderrHash: sha256(result.stderr),
    stdout: result.stdout,
    stderr: result.stderr,
  };
  fs.writeFileSync(path.join(receiptDir, `${id}.json`), `${JSON.stringify(receipt, null, 2)}\n`, 'utf8');
  return receipt;
}

const ids = process.argv.slice(2);
const selected = ids.length ? ids : Object.keys(commands);
let failed = false;

for (const id of selected) {
  const item = commands[id];
  if (!item) {
    console.error(`Unknown command id: ${id}`);
    process.exitCode = 1;
    failed = true;
    continue;
  }
  console.log(`\n>>> ${id}`);
  const result = runPwsh(item.script);
  const receipt = writeReceipt(id, item.command, result);
  process.stdout.write(result.stdout);
  process.stderr.write(result.stderr);
  console.log(`<<< ${id} exitCode=${receipt.exitCode} stdoutHash=${receipt.stdoutHash} stderrHash=${receipt.stderrHash}`);
  if (receipt.exitCode !== 0) {
    failed = true;
  }
}

if (failed) {
  process.exitCode = 1;
}
