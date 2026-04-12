import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  defaultRuntimeContextFile,
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
      mergeLanguagePolicyIntoProjectContext(tempRoot, { resolvedMode: 'en' });
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
      mergeLanguagePolicyIntoProjectContext(tempRoot, { resolvedMode: 'zh' });
      expect(fs.existsSync(projectContextPath(tempRoot))).toBe(false);
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});
