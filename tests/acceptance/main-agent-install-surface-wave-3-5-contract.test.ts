import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const VALIDATOR_PATH = path.join(
  ROOT,
  'tools',
  'script-migration',
  'validate-main-agent-install-surface-wave-3-5.cjs'
);
const WAVE_DIR = path.join(
  ROOT,
  'repo-governance',
  'script-migrations',
  'main-agent-runtime-migration-wave-3.5'
);

const REQUIRED_ARTIFACTS = [
  'registry-invocation-contract.json',
  'skill-helper-hardening.json',
  'skill-sync-parity.json',
  'evidence.json',
  'summary.md',
];

const REQUIRED_HELPERS = [
  '_bmad/skills/req-trace-matrix-prompt-generator/scripts/generate_prompt.js',
  '_bmad/skills/req-trace-matrix-prompt-generator/scripts/load-js-yaml.js',
  '_bmad/skills/goal-execution-contract-generator/scripts/check-docs-review-dependency.js',
];

function runNode(args: string[], cwd: string) {
  return spawnSync(process.execPath, args, {
    cwd,
    encoding: 'utf8',
    shell: process.platform === 'win32',
    maxBuffer: 20 * 1024 * 1024,
  });
}

function hasValidFrontmatter(filePath: string) {
  const text = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/u, '');
  const lines = text.split(/\r?\n/u);
  if (lines[0] !== '---') return false;
  const endIndex = lines.findIndex((line, index) => index > 0 && line.trim() === '---');
  if (endIndex < 0) return false;
  const frontmatter = lines.slice(1, endIndex).join('\n');
  return /^name:\s*.+$/mu.test(frontmatter) && /^description:\s*.+$/mu.test(frontmatter);
}

function listSkillFiles(rootDir: string): string[] {
  if (!fs.existsSync(rootDir)) return [];
  const files: string[] = [];
  for (const entry of fs.readdirSync(rootDir, { withFileTypes: true })) {
    const full = path.join(rootDir, entry.name);
    if (entry.isDirectory()) files.push(...listSkillFiles(full));
    if (entry.isFile() && entry.name === 'SKILL.md') files.push(full);
  }
  return files;
}

describe('main-agent install surface wave 3.5 contract', () => {
  it('creates required Wave 3.5 governance artifacts', () => {
    expect(fs.existsSync(VALIDATOR_PATH)).toBe(true);
    for (const artifact of REQUIRED_ARTIFACTS) {
      expect(fs.existsSync(path.join(WAVE_DIR, artifact)), artifact).toBe(true);
    }
  });

  it('runs the Wave 3.5 install-surface validator successfully', () => {
    const result = runNode([VALIDATOR_PATH], ROOT);
    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    expect(result.stdout).toContain('"status": "passed"');
  });

  it('runs hardened helper routes from a type: module consumer working directory', () => {
    const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-wave35-type-module-'));
    try {
      fs.writeFileSync(path.join(fixture, 'package.json'), '{"type":"module"}\n', 'utf8');
      for (const helper of REQUIRED_HELPERS) {
        const helperPath = path.join(ROOT, helper);
        const result = runNode([helperPath], fixture);
        const combined = `${result.stdout}\n${result.stderr}`;
        expect(combined).not.toMatch(/ERR_REQUIRE_ESM|ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING/u);
      }
    } finally {
      fs.rmSync(fixture, { recursive: true, force: true });
    }
  });

  it('has frontmatter-first generated skill surfaces for Codex, Claude, and Cursor', () => {
    for (const surface of ['.codex/skills', '.claude/skills', '.cursor/skills']) {
      const skillFiles = listSkillFiles(path.join(ROOT, surface));
      expect(skillFiles.length, surface).toBeGreaterThan(0);
      const invalid = skillFiles.filter((file) => !hasValidFrontmatter(file));
      expect(invalid, invalid.join('\n')).toEqual([]);
    }
  });
});
