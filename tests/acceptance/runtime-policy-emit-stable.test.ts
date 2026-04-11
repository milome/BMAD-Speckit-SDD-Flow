import { execFileSync, spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveBmadHelpRuntimePolicy } from '../../scripts/bmad-config';
import { readRuntimeContext } from '../../scripts/runtime-context';
import { stableStringifyPolicy } from '../../scripts/stable-runtime-policy-json';
import { mainEmitRuntimePolicy } from '../../scripts/emit-runtime-policy';
import {
  linkRepoNodeModulesIntoProject,
  linkRepoScriptsIntoProject,
  writeMinimalRegistryAndProjectContext,
} from '../helpers/runtime-registry-fixture';

const repoRoot = process.cwd();

describe('emit-runtime-policy vs bmad-help runtime policy facade (stable JSON)', () => {
  let runtimeEmitBuilt = false;

  function ensureRuntimeEmitBuilt(): void {
    if (runtimeEmitBuilt) {
      return;
    }
    execFileSync(process.execPath, ['packages/runtime-emit/build.js'], {
      cwd: repoRoot,
      stdio: 'pipe',
    });
    runtimeEmitBuilt = true;
  }

  it('stdout matches stableStringify(resolveBmadHelpRuntimePolicy) for registry-backed flow/stage', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-emit-stable-'));
    fs.cpSync(path.join(repoRoot, '_bmad'), path.join(root, '_bmad'), { recursive: true });
    writeMinimalRegistryAndProjectContext(root, { flow: 'story', stage: 'specify' });

    const chunks: string[] = [];
    const origWrite = process.stdout.write.bind(process.stdout);
    process.stdout.write = (msg: string | Uint8Array) => {
      chunks.push(typeof msg === 'string' ? msg : Buffer.from(msg).toString('utf8'));
      return true;
    };
    const prev = process.cwd();
    try {
      process.chdir(root);
      const expected = stableStringifyPolicy(
        resolveBmadHelpRuntimePolicy({
          projectRoot: root,
          flow: 'story',
          stage: 'specify',
          runtimeContext: readRuntimeContext(root),
        })
      );
      const code = mainEmitRuntimePolicy(['--cwd', root]);
      expect(code).toBe(0);
      const out = chunks.join('');
      expect(out).toBe(expected);
    } finally {
      process.stdout.write = origWrite;
      try {
        process.chdir(prev);
      } catch {
        /* ignore */
      }
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('emit-runtime-policy-cli.js resolves identity from registry-backed context only', async () => {
    ensureRuntimeEmitBuilt();
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-emit-cli-id-'));
    fs.cpSync(path.join(repoRoot, '_bmad'), path.join(root, '_bmad'), { recursive: true });
    linkRepoNodeModulesIntoProject(root);
    linkRepoScriptsIntoProject(root);
    writeMinimalRegistryAndProjectContext(root, {
      flow: 'story',
      stage: 'implement',
      epicId: 'epic-14',
      storyId: '14.1',
      runId: 'run-emit-stable',
    });

    const cli = path.join(repoRoot, '_bmad/claude/hooks/emit-runtime-policy-cli.cjs');
    const r = spawnSync(process.execPath, [cli], {
      cwd: repoRoot,
      encoding: 'utf8',
      timeout: 60000, // Increase timeout for Windows
      env: {
        ...process.env,
        CLAUDE_PROJECT_DIR: root,
        CURSOR_PROJECT_ROOT: root,
      },
    });
    expect(r.status).toBe(0);
    const policy = JSON.parse((r.stdout || '').trim());
    expect(policy.flow).toBe('story');
    expect(policy.stage).toBe('implement');
    expect(policy.identity.storyId).toBe('14.1');
    expect(policy.identity.runId).toBe('run-emit-stable');
    expect(policy.helpRouting.recommendedFlow).toBe('story');
    expect(policy.helpRouting.recommendationLabel).toBe('blocked');
    fs.rmSync(root, { recursive: true, force: true });
  }, 60000);

  it('emit fails loud when registry-backed context is absent', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-rp-no-reg-'));
    fs.cpSync(path.join(repoRoot, '_bmad'), path.join(root, '_bmad'), { recursive: true });
    const chunks: string[] = [];
    const errors: string[] = [];
    const origWrite = process.stdout.write.bind(process.stdout);
    const origError = console.error;
    process.stdout.write = (msg: string | Uint8Array) => {
      chunks.push(typeof msg === 'string' ? msg : Buffer.from(msg).toString('utf8'));
      return true;
    };
    console.error = (...args: unknown[]) => {
      errors.push(args.map((arg) => String(arg)).join(' '));
    };
    try {
      const code = mainEmitRuntimePolicy(['--cwd', root]);
      expect(code).toBe(1);
    } finally {
      process.stdout.write = origWrite;
      console.error = origError;
      fs.rmSync(root, { recursive: true, force: true });
    }
    expect(chunks.join('')).toBe('');
    expect(errors.join('\n')).toMatch(/emit-runtime-policy:/);
  }, 20_000);

  it('emit fails loud when flow/stage are invalid in project context (readRuntimeContext)', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-rp-sp-'));
    fs.cpSync(path.join(repoRoot, '_bmad'), path.join(root, '_bmad'), { recursive: true });
    writeMinimalRegistryAndProjectContext(root, { flow: 'story', stage: 'specify' });
    const ctxPath = path.join(root, '_bmad-output', 'runtime', 'context', 'project.json');
    const raw = JSON.parse(fs.readFileSync(ctxPath, 'utf8'));
    delete raw.flow;
    delete raw.stage;
    raw.updatedAt = new Date().toISOString();
    fs.writeFileSync(ctxPath, JSON.stringify(raw, null, 2));

    const chunks: string[] = [];
    const errors: string[] = [];
    const origWrite = process.stdout.write.bind(process.stdout);
    const origError = console.error;
    process.stdout.write = (msg: string | Uint8Array) => {
      chunks.push(typeof msg === 'string' ? msg : Buffer.from(msg).toString('utf8'));
      return true;
    };
    console.error = (...args: unknown[]) => {
      errors.push(args.map((arg) => String(arg)).join(' '));
    };
    try {
      const code = mainEmitRuntimePolicy(['--cwd', root]);
      expect(code).toBe(1);
    } finally {
      process.stdout.write = origWrite;
      console.error = origError;
      fs.rmSync(root, { recursive: true, force: true });
    }
    expect(chunks.join('')).toBe('');
    const errText = errors.join('\n');
    expect(errText).toContain('emit-runtime-policy:');
    expect(errText).toMatch(/runtime-context\.(flow|stage) invalid or missing/);
  }, 20_000);
});
