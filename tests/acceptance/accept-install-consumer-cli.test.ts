/**
 * Acceptance: Install to temp consumer ->run CLI (check, version).
 * Covers setup.ps1, setup.sh, npm install, init-to-root flows.
 * Runs in CI (ubuntu-latest).
 */
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { execSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';

const PKG_ROOT = join(import.meta.dirname, '..', '..');
const WAVE_ID = 'main-agent-migration-wave-1';
const WAVE_DIR = join(PKG_ROOT, '.tmp', WAVE_ID);
const INSTALL_MATRIX_DIR = join(WAVE_DIR, 'install-matrix');

function cleanupTempDir(target: string): void {
  rmSync(target, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}

function run(cmd: string, cwd: string, env?: NodeJS.ProcessEnv): string {
  return execSync(cmd, { cwd, encoding: 'utf8', env: { ...process.env, ...env } });
}

function runRepoCli(args: string, cwd: string, env?: NodeJS.ProcessEnv): string {
  const cli = `"${process.execPath}" "${join(PKG_ROOT, 'scripts', 'bmad-speckit-cli.js')}" ${args}`;
  return run(cli, cwd, env);
}

function sha256(value: string): string {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

function ensureRuntimeProbe(target: string): { probePath: string; logPath: string } {
  const probePath = join(target, 'runtime-dispatch-probe.cjs');
  const logPath = join(target, 'runtime-dispatch-probe.ndjson');
  writeFileSync(
    probePath,
    [
      "const fs = require('node:fs');",
      "const childProcess = require('node:child_process');",
      "const logPath = process.env.BMAD_RUNTIME_PROBE_LOG;",
      "const ROOT_SCRIPT_RE = /(^|[\\\\/])scripts[\\\\/]main-agent-orchestration\\.ts\\b/i;",
      "const TSX_RE = /(^|[\\\\/])tsx(?:\\.cmd)?$|\\btsx\\b/i;",
      "const TS_NODE_RE = /(^|[\\\\/])ts-node(?:\\.cmd)?$|\\bts-node\\b/i;",
      'function stringify(value) {',
      '  try { return JSON.stringify(value); } catch { return String(value); }',
      '}',
      'function flags(args) {',
      '  const text = Array.isArray(args) ? args.map(stringify).join(" ") : stringify(args);',
      '  return {',
      '    usedRootScript: ROOT_SCRIPT_RE.test(text),',
      '    usedTsx: TSX_RE.test(text),',
      '    usedTsNode: TS_NODE_RE.test(text),',
      '    text,',
      '  };',
      '}',
      'function record(kind, args) {',
      '  if (!logPath) return;',
      '  const result = flags(args);',
      '  if (!result.usedRootScript && !result.usedTsx && !result.usedTsNode) return;',
      '  fs.appendFileSync(logPath, JSON.stringify({ kind, cwd: process.cwd(), ...result }) + "\\n", "utf8");',
      '}',
      'record("process.argv", process.argv);',
      'for (const name of ["spawn", "spawnSync", "exec", "execSync", "execFile", "execFileSync"]) {',
      '  const original = childProcess[name];',
      '  if (typeof original !== "function") continue;',
      '  childProcess[name] = function patchedChildProcess(...args) {',
      '    record(`child_process.${name}`, args);',
      '    return original.apply(this, args);',
      '  };',
      '}',
      '',
    ].join('\n'),
    'utf8'
  );
  return { probePath, logPath };
}

function readProbeFlags(logPath: string): {
  usedRootScript: boolean;
  usedTsx: boolean;
  usedTsNode: boolean;
  probeHits: unknown[];
} {
  if (!existsSync(logPath)) {
    return { usedRootScript: false, usedTsx: false, usedTsNode: false, probeHits: [] };
  }
  const probeHits = readFileSync(logPath, 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  return {
    usedRootScript: probeHits.some((hit: any) => hit.usedRootScript),
    usedTsx: probeHits.some((hit: any) => hit.usedTsx),
    usedTsNode: probeHits.some((hit: any) => hit.usedTsNode),
    probeHits,
  };
}

function writeInstallEvidence(row: {
  installMode: string;
  commandId: string;
  command: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  usedRootScript: boolean;
  usedTsx: boolean;
  usedTsNode: boolean;
  packagePath: string;
  probeHits: unknown[];
}): void {
  mkdirSync(INSTALL_MATRIX_DIR, { recursive: true });
  const filePath = join(INSTALL_MATRIX_DIR, `${row.installMode}-${row.commandId}.json`);
  const evidence = {
    installMode: row.installMode,
    command: row.command,
    exitCode: row.exitCode,
    stdoutHash: sha256(row.stdout),
    stderrHash: sha256(row.stderr),
    usedRootScript: row.usedRootScript,
    usedTsx: row.usedTsx,
    usedTsNode: row.usedTsNode,
    packagePath: row.packagePath,
    probeHits: row.probeHits,
  };
  writeFileSync(filePath, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
}

function runObservedCommand(
  installMode: string,
  commandId: string,
  command: string,
  target: string,
  packagePath: string
): string {
  const { probePath, logPath } = ensureRuntimeProbe(target);
  rmSync(logPath, { force: true });
  const env = {
    ...process.env,
    BMAD_RUNTIME_PROBE_LOG: logPath,
    NODE_OPTIONS: `${process.env.NODE_OPTIONS ? `${process.env.NODE_OPTIONS} ` : ''}--require=${probePath}`,
    BMAD_SKIP_CONSUMER_MCP_INSTALL: '1',
  };
  const result = spawnSync(command, {
    cwd: target,
    encoding: 'utf8',
    env,
    shell: true,
    maxBuffer: 20 * 1024 * 1024,
  });
  const stdout = String(result.stdout || '');
  const stderr = String(result.stderr || '');
  const flags = readProbeFlags(logPath);
  writeInstallEvidence({
    installMode,
    commandId,
    command,
    exitCode: result.status ?? 1,
    stdout,
    stderr,
    packagePath,
    ...flags,
  });

  expect(result.status, `${command}\nSTDOUT:\n${stdout}\nSTDERR:\n${stderr}`).toBe(0);
  expect(flags.usedRootScript, `${command} executed scripts/main-agent-orchestration.ts`).toBe(
    false
  );
  expect(flags.usedTsx, `${command} executed tsx`).toBe(false);
  expect(flags.usedTsNode, `${command} executed ts-node`).toBe(false);
  return stdout;
}

function resolveInstalledPackagePath(target: string): string {
  const candidates = [
    join(target, 'node_modules', 'bmad-speckit-sdd-flow', 'node_modules', 'bmad-speckit'),
    join(target, 'node_modules', 'bmad-speckit'),
    join(target, 'node_modules', 'bmad-speckit-sdd-flow'),
  ];
  return candidates.find((candidate) => existsSync(candidate)) || 'unresolved';
}

function latestOrCreateWaveTarball(): string {
  mkdirSync(WAVE_DIR, { recursive: true });
  const tarballs = readdirSync(WAVE_DIR)
    .filter((name) => name.endsWith('.tgz'))
    .map((name) => join(WAVE_DIR, name))
    .sort((left, right) => basename(right).localeCompare(basename(left)));
  if (tarballs[0]) return tarballs[0];
  run(`npm pack --pack-destination "${WAVE_DIR}"`, PKG_ROOT);
  const created = readdirSync(WAVE_DIR)
    .filter((name) => name.endsWith('.tgz'))
    .map((name) => join(WAVE_DIR, name))
    .sort((left, right) => basename(right).localeCompare(basename(left)));
  if (!created[0]) throw new Error('npm pack did not produce a wave tarball');
  return created[0];
}

const WAVE_RUNTIME_COMMANDS = [
  { id: 'bmads', args: 'bmads --budget compact' },
  { id: 'bmad-help', args: 'bmad-help --budget compact' },
  { id: 'main-agent-inspect', args: 'main-agent inspect --json' },
];

describe('install to consumer ->CLI acceptance', () => {
  it('init-to-root deploy ->bmad-speckit check passes', () => {
    const target = mkdtempSync(join(tmpdir(), 'accept-consumer-init-'));
    try {
      run(`node scripts/init-to-root.js --full "${target}"`, PKG_ROOT);
      expect(existsSync(join(target, 'package.json'))).toBe(false);
      expect(existsSync(join(target, '_bmad'))).toBe(true);
      expect(existsSync(join(target, 'specs'))).toBe(true);
      expect(existsSync(join(target, '.cursor', 'hooks', 'emit-runtime-policy.cjs'))).toBe(true);
      expect(existsSync(join(target, '.cursor', 'i18n'))).toBe(true);
      expect(existsSync(join(target, '.cursor', 'commands', 'bmad-speckit.md'))).toBe(true);
      expect(existsSync(join(target, '.cursor', 'commands', 'bmads.md'))).toBe(true);
      expect(existsSync(join(target, '.cursor', 'skills', 'bmad-speckit', 'SKILL.md'))).toBe(true);
      expect(existsSync(join(target, '.cursor', 'skills', 'bmads', 'SKILL.md'))).toBe(true);
      expect(
        existsSync(join(target, '.cursor', 'skills', 'encoding-integrity-guardian', 'SKILL.md'))
      ).toBe(true);
      expect(
        existsSync(join(target, '.cursor', 'rules', 'bmad-bug-auto-party-mode-rule.mdc'))
      ).toBe(true);
      expect(existsSync(join(target, '.cursor', 'rules', 'bmad-bug-auto-party-mode.mdc'))).toBe(
        false
      );
      expect(existsSync(join(target, '.mcp.json'))).toBe(false);
      expect(existsSync(join(target, '.runtime-mcp'))).toBe(false);
      expect(
        existsSync(join(target, '_bmad-output', 'config', 'bmad-speckit-install-manifest.json'))
      ).toBe(true);
      expect(
        existsSync(join(target, '_bmad-output', 'runtime', 'requirement-records', 'index.json'))
      ).toBe(false);
      expect(
        existsSync(
          join(target, '_bmad-output', 'runtime', 'requirement-records', 'REQ-story_story_create')
        )
      ).toBe(false);
      expect(
        existsSync(
          join(target, '_bmad-output', 'runtime', 'requirement-records', 'REQ-story-story_create')
        )
      ).toBe(false);

      const out = runRepoCli('check', target);
      expect(out).toMatch(/Check OK|OK/i);
    } finally {
      cleanupTempDir(target);
    }
  }, 90_000);

  it('init-to-root deploy ->bmad-speckit version runs', () => {
    const target = mkdtempSync(join(tmpdir(), 'accept-consumer-ver-'));
    try {
      run(`node scripts/init-to-root.js --full "${target}"`, PKG_ROOT);
      const out = runRepoCli('version', target);
      expect(out).toMatch(/\d+\.\d+\.\d+/);
    } finally {
      cleanupTempDir(target);
    }
  }, 90_000);

  it('npm install ->postinstall deploys ->bmad-speckit check passes', () => {
    const target = mkdtempSync(join(tmpdir(), 'accept-consumer-npm-'));
    try {
      writeFileSync(
        join(target, 'package.json'),
        JSON.stringify({ name: 'consumer-app', version: '1.0.0', private: true }),
        'utf8'
      );
      const pkgPath = join(PKG_ROOT).replace(/\\/g, '/');
      run(`npm install --save-dev "file:${pkgPath}"`, target);
      expect(existsSync(join(target, '_bmad'))).toBe(true);
      expect(existsSync(join(target, '.cursor'))).toBe(true);
      expect(existsSync(join(target, '.cursor', 'skills', 'npm-public-release', 'SKILL.md'))).toBe(
        true
      );
      expect(existsSync(join(target, '.cursor', 'commands', 'bmad-speckit.md'))).toBe(true);
      expect(existsSync(join(target, '.cursor', 'commands', 'bmads.md'))).toBe(true);
      expect(existsSync(join(target, '.cursor', 'skills', 'bmad-speckit', 'SKILL.md'))).toBe(true);
      expect(existsSync(join(target, '.cursor', 'skills', 'bmads', 'SKILL.md'))).toBe(true);
      expect(existsSync(join(target, '.cursor', 'hooks', 'emit-runtime-policy.cjs'))).toBe(true);
      expect(
        existsSync(join(target, '.cursor', 'hooks', 'runtime-dashboard-session-start.cjs'))
      ).toBe(true);
      expect(existsSync(join(target, '.cursor', 'i18n'))).toBe(true);
      expect(
        existsSync(join(target, '.cursor', 'rules', 'bmad-bug-auto-party-mode-rule.mdc'))
      ).toBe(true);
      expect(existsSync(join(target, '.cursor', 'rules', 'bmad-bug-auto-party-mode.mdc'))).toBe(
        false
      );
      expect(existsSync(join(target, '.mcp.json'))).toBe(false);
      expect(existsSync(join(target, '.runtime-mcp'))).toBe(false);
      expect(existsSync(join(target, 'scripts', 'emit-runtime-policy.cjs'))).toBe(false);
      expect(existsSync(join(target, 'scripts', 'start-runtime-dashboard-server.cjs'))).toBe(false);
      expect(existsSync(join(target, 'scripts'))).toBe(false);
      expect(existsSync(join(target, '_bmad', 'skills', 'large-document-writer', 'SKILL.md'))).toBe(
        true
      );
      expect(
        existsSync(join(target, '_bmad', 'skills', 'large-document-writer', 'agents', 'openai.yaml'))
      ).toBe(true);
      expect(
        existsSync(join(target, '_bmad-output', 'config', 'bmad-speckit-install-manifest.json'))
      ).toBe(true);
      expect(
        existsSync(join(target, '_bmad-output', 'runtime', 'requirement-records', 'index.json'))
      ).toBe(false);
      expect(
        existsSync(
          join(target, '_bmad-output', 'runtime', 'requirement-records', 'REQ-story_story_create')
        )
      ).toBe(false);
      expect(
        existsSync(
          join(target, '_bmad-output', 'runtime', 'requirement-records', 'REQ-story-story_create')
        )
      ).toBe(false);

      const out = run('npx bmad-speckit check', target);
      expect(out).toMatch(/Check OK|OK/i);
      expect(run('npx bmad-speckit large-doc --help', target)).toContain('large-doc');
      expect(existsSync(join(target, 'scripts'))).toBe(false);

      const promoteScript = join(
        target,
        '.cursor',
        'skills',
        'requirements-contract-authoring',
        'scripts',
        'promote-draft-large-doc.js'
      );
      expect(existsSync(promoteScript)).toBe(true);
      const draftPath = join(target, 'draft-requirements.md');
      const targetPath = join(target, 'requirements.md');
      writeFileSync(
        draftPath,
        [
          '# Draft',
          '',
          'implementationConfirmation:',
          '  status: draft',
          '  must:',
          '    - id: MUST-001',
          '      text: "The consumer install can run the skill-local promotion preflight."',
          '',
        ].join('\n'),
        'utf8'
      );
      const promotion = JSON.parse(
        run(
          `"${process.execPath}" "${promoteScript}" --draft "${draftPath}" --target "${targetPath}" --preflight-only --json`,
          target
        )
      );
      expect(promotion.ok).toBe(true);
      expect(existsSync(join(target, 'scripts'))).toBe(false);
    } finally {
      cleanupTempDir(target);
    }
  }, 60_000);

  it('npm install consumer can re-run installed deploy entrypoint to heal .specify mirror drift', () => {
    const target = mkdtempSync(join(tmpdir(), 'accept-consumer-mirror-heal-'));
    try {
      writeFileSync(
        join(target, 'package.json'),
        JSON.stringify({ name: 'consumer-app', version: '1.0.0', private: true }),
        'utf8'
      );

      const pkgPath = join(PKG_ROOT).replace(/\\/g, '/');
      run(`npm install --save-dev "file:${pkgPath}"`, target);

      const canonicalTemplate = join(target, '_bmad', 'speckit', 'templates', 'tasks-template.md');
      const mirroredTemplate = join(target, '.specify', 'templates', 'tasks-template.md');
      const canonicalScript = join(
        target,
        '_bmad',
        'speckit',
        'scripts',
        'powershell',
        'check-sprint-ready.ps1'
      );
      const mirroredScript = join(target, '.specify', 'scripts', 'check-sprint-ready.ps1');

      expect(existsSync(mirroredTemplate)).toBe(true);
      expect(existsSync(mirroredScript)).toBe(true);

      writeFileSync(mirroredTemplate, '# stale mirror\n', 'utf8');
      rmSync(mirroredScript, { force: true });

      expect(readFileSync(mirroredTemplate, 'utf8')).not.toBe(
        readFileSync(canonicalTemplate, 'utf8')
      );
      expect(existsSync(mirroredScript)).toBe(false);

      run('npx bmad-speckit-init --agent claude-code', target);

      expect(readFileSync(mirroredTemplate, 'utf8')).toBe(readFileSync(canonicalTemplate, 'utf8'));
      expect(readFileSync(mirroredScript, 'utf8')).toBe(readFileSync(canonicalScript, 'utf8'));
    } finally {
      cleanupTempDir(target);
    }
  }, 180_000);

  it('npm install consumer can deploy Claude top-level speckit aliases via installed init entrypoint', () => {
    const target = mkdtempSync(join(tmpdir(), 'accept-consumer-claude-aliases-'));
    try {
      writeFileSync(
        join(target, 'package.json'),
        JSON.stringify({ name: 'consumer-app', version: '1.0.0', private: true }),
        'utf8'
      );

      const pkgPath = join(PKG_ROOT).replace(/\\/g, '/');
      run(`npm install --save-dev "file:${pkgPath}"`, target);
      run('npx bmad-speckit-init --agent claude-code', target);

      expect(existsSync(join(target, '.claude', 'hooks', 'session-start.cjs'))).toBe(true);
      expect(existsSync(join(target, '.claude', 'hooks', 'party-mode-turn-lock.cjs'))).toBe(true);
      expect(existsSync(join(target, '.claude', 'commands', 'bmad-speckit.md'))).toBe(true);
      expect(existsSync(join(target, '.claude', 'commands', 'bmads.md'))).toBe(true);
      expect(existsSync(join(target, '.claude', 'skills', 'bmad-speckit', 'SKILL.md'))).toBe(true);
      expect(existsSync(join(target, '.claude', 'skills', 'bmads', 'SKILL.md'))).toBe(true);
      expect(
        existsSync(join(target, '.claude', 'skills', 'encoding-integrity-guardian', 'SKILL.md'))
      ).toBe(true);
      expect(
        existsSync(join(target, '_bmad', 'runtime', 'hooks', 'runtime-dashboard-auto-start.cjs'))
      ).toBe(true);

      const aliases = [
        'speckit-specify.md',
        'speckit-plan.md',
        'speckit-gaps.md',
        'speckit-tasks.md',
      ];

      for (const alias of aliases) {
        const canonical = join(target, '_bmad', 'claude', 'agents', alias);
        const runtime = join(target, '.claude', 'agents', alias);

        expect(existsSync(canonical)).toBe(true);
        expect(existsSync(runtime)).toBe(true);
        expect(readFileSync(runtime, 'utf8')).toBe(readFileSync(canonical, 'utf8'));
      }

      expect(existsSync(join(target, '.claude', 'rules', 'bmad-bug-auto-party-mode-rule.md'))).toBe(
        true
      );
      expect(existsSync(join(target, '.claude', 'rules', 'bmad-bug-auto-party-mode.md'))).toBe(
        false
      );
    } finally {
      cleanupTempDir(target);
    }
  }, 90_000);

  it('npm install consumer deploys Claude facilitator agent mention contract via installed init entrypoint', () => {
    const target = mkdtempSync(join(tmpdir(), 'accept-consumer-claude-facilitator-'));
    try {
      writeFileSync(
        join(target, 'package.json'),
        JSON.stringify({ name: 'consumer-app', version: '1.0.0', private: true }),
        'utf8'
      );

      const pkgPath = join(PKG_ROOT).replace(/\\/g, '/');
      run(`npm install --save-dev "file:${pkgPath}"`, target);
      run('npx bmad-speckit-init --agent claude-code', target);

      const canonical = join(target, '_bmad', 'claude', 'agents', 'party-mode-facilitator.md');
      const runtime = join(target, '.claude', 'agents', 'party-mode-facilitator.md');

      expect(existsSync(canonical)).toBe(true);
      expect(existsSync(runtime)).toBe(true);
      expect(existsSync(join(target, '.claude', 'skills', 'npm-public-release', 'SKILL.md'))).toBe(
        true
      );
      expect(readFileSync(runtime, 'utf8')).toBe(readFileSync(canonical, 'utf8'));
      expect(readFileSync(runtime, 'utf8')).toContain('name: party-mode-facilitator');
    } finally {
      cleanupTempDir(target);
    }
  }, 90_000);

  it('npm install consumer preserves prior managed surface when adding a second agent init pass', () => {
    const target = mkdtempSync(join(tmpdir(), 'accept-consumer-manifest-merge-'));
    try {
      writeFileSync(
        join(target, 'package.json'),
        JSON.stringify({ name: 'consumer-app', version: '1.0.0', private: true }),
        'utf8'
      );

      const pkgPath = join(PKG_ROOT).replace(/\\/g, '/');
      run(`npm install --save-dev "file:${pkgPath}"`, target);

      const manifestPath = join(
        target,
        '_bmad-output',
        'config',
        'bmad-speckit-install-manifest.json'
      );
      const before = JSON.parse(readFileSync(manifestPath, 'utf8'));
      expect(before.installed_tools).toContain('cursor');
      expect(
        before.managed_surface.some((entry: { path: string }) => entry.path.startsWith('.cursor/'))
      ).toBe(true);

      run('npx bmad-speckit-init --agent claude-code', target);

      const after = JSON.parse(readFileSync(manifestPath, 'utf8'));
      expect(after.installed_tools).toContain('cursor');
      expect(after.installed_tools).toContain('claude-code');
      expect(
        after.managed_surface.some((entry: { path: string }) => entry.path.startsWith('.cursor/'))
      ).toBe(true);
      expect(
        after.managed_surface.some((entry: { path: string }) => entry.path.startsWith('.claude/'))
      ).toBe(true);
    } finally {
      cleanupTempDir(target);
    }
  }, 90_000);

  it('consumer install can initialize the Codex no-hooks branch', () => {
    const target = mkdtempSync(join(tmpdir(), 'accept-consumer-codex-'));
    try {
      writeFileSync(
        join(target, 'package.json'),
        JSON.stringify({ name: 'consumer-codex-app', version: '1.0.0', private: true }),
        'utf8'
      );

      const pkgPath = join(PKG_ROOT).replace(/\\/g, '/');
      run(`npm install --save-dev "file:${pkgPath}"`, target);
      run('npx bmad-speckit-init --agent codex', target);

      expect(existsSync(join(target, '.codex', 'commands', 'bmad-help.md'))).toBe(true);
      expect(existsSync(join(target, '.codex', 'commands', 'bmad-speckit.md'))).toBe(true);
      expect(existsSync(join(target, '.codex', 'commands', 'bmads.md'))).toBe(true);
      expect(existsSync(join(target, '.codex', 'skills', 'bmad-help', 'SKILL.md'))).toBe(true);
      expect(existsSync(join(target, '.codex', 'skills', 'bmad-speckit', 'SKILL.md'))).toBe(true);
      expect(existsSync(join(target, '.codex', 'skills', 'bmads', 'SKILL.md'))).toBe(true);
      expect(
        existsSync(join(target, '.codex', 'skills', 'encoding-integrity-guardian', 'SKILL.md'))
      ).toBe(true);
      expect(
        existsSync(
          join(
            target,
            '.codex',
            'skills',
            'encoding-integrity-guardian',
            'scripts',
            'check-encoding-integrity.js'
          )
        )
      ).toBe(true);
      expect(existsSync(join(target, '.codex', 'skills', 'speckit-workflow', 'SKILL.md'))).toBe(
        true
      );
      expect(
        readFileSync(
          join(target, '.codex', 'skills', 'speckit-workflow', 'SKILL.md'),
          'utf8'
        ).startsWith('---')
      ).toBe(true);
      expect(existsSync(join(target, '.codex', 'skills', 'bmad-story-assistant', 'SKILL.md'))).toBe(
        true
      );
      expect(
        existsSync(join(target, '.codex', 'skills', 'bmad-standalone-tasks', 'SKILL.md'))
      ).toBe(true);
      expect(
        existsSync(join(target, '.codex', 'skills', 'bmad-standalone-tasks-doc-review', 'SKILL.md'))
      ).toBe(true);
      expect(existsSync(join(target, '.codex', 'skills', 'bmad-rca-helper', 'SKILL.md'))).toBe(
        true
      );
      expect(
        existsSync(join(target, '.codex', 'skills', 'bmad-code-reviewer-lifecycle', 'SKILL.md'))
      ).toBe(true);
      expect(existsSync(join(target, '.codex', 'protocols', 'audit-result-schema.md'))).toBe(true);
      expect(existsSync(join(target, '.codex', 'protocols', 'handoff-schema.md'))).toBe(true);
      expect(existsSync(join(target, '.codex', 'protocols', 'commit-protocol.md'))).toBe(true);
      expect(existsSync(join(target, '.codex', 'README.md'))).toBe(true);
      expect(existsSync(join(target, '.codex', 'hooks'))).toBe(false);
      const config = JSON.parse(
        readFileSync(join(target, '_bmad-output', 'config', 'bmad-speckit.json'), 'utf8')
      );
      expect(config.selectedAI).toBe('codex');

      const manifest = JSON.parse(
        readFileSync(
          join(target, '_bmad-output', 'config', 'bmad-speckit-install-manifest.json'),
          'utf8'
        )
      );
      expect(manifest.installed_tools).toContain('codex');
      expect(
        manifest.managed_surface.some((entry: { path: string }) => entry.path.startsWith('.codex/'))
      ).toBe(true);
      expect(
        manifest.managed_surface.some((entry: { path: string }) =>
          entry.path.startsWith('.codex/protocols')
        )
      ).toBe(true);

      const ok = run('npx bmad-speckit check', target);
      expect(ok).toMatch(/Check OK|OK/i);

      rmSync(join(target, '.codex', 'skills'), { recursive: true, force: true });
      expect(() => run('npx bmad-speckit check', target)).toThrow(/\.codex\/skills/);
      run('npx bmad-speckit-init --agent codex', target);
      rmSync(join(target, '.codex', 'commands', 'bmad-speckit.md'), { force: true });
      expect(() => run('npx bmad-speckit check', target)).toThrow(/bmad-speckit\.md/);
      run('npx bmad-speckit-init --agent codex', target);
      rmSync(join(target, '.codex', 'protocols', 'audit-result-schema.md'), { force: true });
      expect(() => run('npx bmad-speckit check', target)).toThrow(/audit-result-schema\.md/);
      run('npx bmad-speckit-init --agent codex', target);
      rmSync(join(target, '.codex', 'skills', 'speckit-workflow'), {
        recursive: true,
        force: true,
      });
      expect(() => run('npx bmad-speckit check', target)).toThrow(/speckit-workflow/);
      run('npx bmad-speckit-init --agent codex', target);
      writeFileSync(
        join(target, '.codex', 'skills', 'speckit-workflow', 'SKILL.md'),
        '<!-- BLOCK_LABEL_POLICY=B -->\n---\nname: speckit-workflow\n---\n',
        'utf8'
      );
      expect(() => run('npx bmad-speckit check', target)).toThrow(/YAML frontmatter/);
    } finally {
      cleanupTempDir(target);
    }
  }, 180_000);

  it('consumer install syncs runtime dashboard auto-start skeleton for Cursor hooks', () => {
    const target = mkdtempSync(join(tmpdir(), 'accept-consumer-dashboard-host-'));
    try {
      writeFileSync(
        join(target, 'package.json'),
        JSON.stringify({ name: 'consumer-app', version: '1.0.0', private: true }),
        'utf8'
      );

      const pkgPath = join(PKG_ROOT).replace(/\\/g, '/');
      run(`npm install --save-dev "file:${pkgPath}"`, target);

      const hooksJson = readFileSync(join(target, '.cursor', 'hooks.json'), 'utf8');
      expect(hooksJson).toContain('runtime-dashboard-session-start.cjs');

      const hookScript = readFileSync(
        join(target, '.cursor', 'hooks', 'runtime-dashboard-session-start.cjs'),
        'utf8'
      );
      expect(hookScript).toContain('autoStartRuntimeDashboard');

      const sharedHelper = readFileSync(
        join(target, '_bmad', 'runtime', 'hooks', 'runtime-dashboard-auto-start.cjs'),
        'utf8'
      );
      expect(sharedHelper).toContain('ensureRuntimeDashboardServer');
    } finally {
      cleanupTempDir(target);
    }
  }, 90_000);

  it('consumer install can opt into runtime MCP layout explicitly', () => {
    const target = mkdtempSync(join(tmpdir(), 'accept-consumer-with-mcp-'));
    try {
      run(`node scripts/init-to-root.js --full --with-mcp "${target}"`, PKG_ROOT);

      expect(existsSync(join(target, '.mcp.json'))).toBe(true);
      expect(existsSync(join(target, '.runtime-mcp', 'server', 'dist', 'index.cjs'))).toBe(true);
    } finally {
      cleanupTempDir(target);
    }
  }, 90_000);

  it('main-agent-migration-wave-1 install matrix uses package runtime without TypeScript dispatch', () => {
    mkdirSync(INSTALL_MATRIX_DIR, { recursive: true });
    const tarball = latestOrCreateWaveTarball();
    const packageSpec = tarball.replace(/\\/g, '/');

    const saveDev = mkdtempSync(join(tmpdir(), 'wave1-save-dev-'));
    try {
      writeFileSync(
        join(saveDev, 'package.json'),
        JSON.stringify({ name: 'wave1-save-dev', version: '1.0.0', private: true }),
        'utf8'
      );
      run(`npm install --save-dev "${tarball}"`, saveDev, {
        BMAD_SKIP_CONSUMER_MCP_INSTALL: '1',
      });
      const packagePath = resolveInstalledPackagePath(saveDev);
      expect(packagePath).not.toBe('unresolved');
      for (const row of WAVE_RUNTIME_COMMANDS) {
        runObservedCommand(
          'save-dev',
          row.id,
          `npx --no-install bmad-speckit ${row.args}`,
          saveDev,
          packagePath
        );
      }
    } finally {
      cleanupTempDir(saveDev);
    }

    const npxConsumer = mkdtempSync(join(tmpdir(), 'wave1-npx-package-'));
    try {
      writeFileSync(
        join(npxConsumer, 'package.json'),
        JSON.stringify({ name: 'wave1-npx-package', version: '1.0.0', private: true }),
        'utf8'
      );
      for (const row of WAVE_RUNTIME_COMMANDS) {
        runObservedCommand(
          'npx-package',
          row.id,
          `npx --yes --package "${packageSpec}" bmad-speckit ${row.args}`,
          npxConsumer,
          packageSpec
        );
      }
    } finally {
      cleanupTempDir(npxConsumer);
    }

    const tgzConsumer = mkdtempSync(join(tmpdir(), 'wave1-tgz-'));
    try {
      writeFileSync(
        join(tgzConsumer, 'package.json'),
        JSON.stringify({ name: 'wave1-tgz', version: '1.0.0', private: true }),
        'utf8'
      );
      run(`npm install --save-dev "${tarball}"`, tgzConsumer, {
        BMAD_SKIP_CONSUMER_MCP_INSTALL: '1',
      });
      const packagePath = resolveInstalledPackagePath(tgzConsumer);
      expect(packagePath).not.toBe('unresolved');
      for (const row of WAVE_RUNTIME_COMMANDS) {
        runObservedCommand(
          'tgz',
          row.id,
          `npx --no-install bmad-speckit ${row.args}`,
          tgzConsumer,
          packagePath
        );
      }
    } finally {
      cleanupTempDir(tgzConsumer);
    }
  }, 600_000);
});
