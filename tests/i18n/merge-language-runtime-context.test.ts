import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  defaultRuntimeContextFile,
  ensureProjectRuntimeContext,
  mergeLanguagePolicyIntoProjectContext,
  projectContextPath,
  writeRuntimeContext,
} from '../../scripts/runtime-context';

describe('mergeLanguagePolicyIntoProjectContext', () => {
  it('merges languagePolicy when project context file exists', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ctx-lang-'));
    try {
      fs.cpSync(path.join(process.cwd(), '_bmad'), path.join(tempRoot, '_bmad'), { recursive: true });
      fs.mkdirSync(path.join(tempRoot, '.cursor', 'agents'), { recursive: true });
      fs.copyFileSync(
        path.join(tempRoot, '_bmad', 'cursor', 'agents', 'party-mode-facilitator.md'),
        path.join(tempRoot, '.cursor', 'agents', 'party-mode-facilitator.md')
      );
      fs.mkdirSync(path.join(tempRoot, '_bmad-output', 'runtime', 'context'), { recursive: true });
      const ctxPath = projectContextPath(tempRoot);
      writeRuntimeContext(tempRoot, defaultRuntimeContextFile({ flow: 'story', stage: 'specify' }));
      const result = mergeLanguagePolicyIntoProjectContext(tempRoot, { resolvedMode: 'en' });
      expect(result).toMatchObject({
        status: 'updated',
        contextPath: ctxPath,
      });
      const raw = JSON.parse(fs.readFileSync(ctxPath, 'utf8'));
      expect(raw.languagePolicy?.resolvedMode).toBe('en');
      const runtime = fs.readFileSync(
        path.join(tempRoot, '.cursor', 'agents', 'party-mode-facilitator.md'),
        'utf8'
      );
      expect(runtime).toContain('RUNTIME-MATERIALIZED facilitator resolvedMode=en');
      expect(runtime).toContain('_bmad/core/skills/bmad-party-mode/workflow.en.md');
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('no-op when project context file is missing', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ctx-lang-miss-'));
    try {
      const result = mergeLanguagePolicyIntoProjectContext(tempRoot, { resolvedMode: 'zh' });
      expect(result).toMatchObject({
        status: 'skipped',
        reason: 'project_context_missing',
        contextPath: projectContextPath(tempRoot),
      });
      expect(fs.existsSync(projectContextPath(tempRoot))).toBe(false);
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('restores the default facilitator runtime when project context is rewritten without languagePolicy', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ctx-lang-base-'));
    try {
      fs.cpSync(path.join(process.cwd(), '_bmad'), path.join(tempRoot, '_bmad'), { recursive: true });
      fs.mkdirSync(path.join(tempRoot, '.cursor', 'agents'), { recursive: true });
      fs.copyFileSync(
        path.join(tempRoot, '_bmad', 'cursor', 'agents', 'party-mode-facilitator.md'),
        path.join(tempRoot, '.cursor', 'agents', 'party-mode-facilitator.md')
      );
      ensureProjectRuntimeContext(tempRoot, {
        flow: 'story',
        stage: 'specify',
        languagePolicy: { resolvedMode: 'en' },
      });

      const runtimePath = path.join(tempRoot, '.cursor', 'agents', 'party-mode-facilitator.md');
      expect(fs.readFileSync(runtimePath, 'utf8')).toContain('resolvedMode=en');

      ensureProjectRuntimeContext(tempRoot, {
        flow: 'story',
        stage: 'specify',
      });

      const runtime = fs.readFileSync(runtimePath, 'utf8');
      expect(runtime).toContain('resolvedMode=base');
      expect(runtime).toContain('fallbackReason=language_policy_missing');
      const runtimeWithoutHeader = runtime.replace(
        /<!-- RUNTIME-MATERIALIZED facilitator[\s\S]*? -->\r?\n?/u,
        ''
      );
      const canonicalBase = fs.readFileSync(
        path.join(tempRoot, '_bmad', 'cursor', 'agents', 'party-mode-facilitator.md'),
        'utf8'
      );
      expect(runtimeWithoutHeader).toBe(canonicalBase);
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});
