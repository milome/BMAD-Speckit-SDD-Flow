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
      fs.mkdirSync(path.join(tempRoot, '_bmad-output', 'runtime', 'context'), { recursive: true });
      const ctxPath = projectContextPath(tempRoot);
      writeRuntimeContext(tempRoot, defaultRuntimeContextFile({ flow: 'story', stage: 'specify' }));
      mergeLanguagePolicyIntoProjectContext(tempRoot, { resolvedMode: 'en' });
      const raw = JSON.parse(fs.readFileSync(ctxPath, 'utf8'));
      expect(raw.languagePolicy?.resolvedMode).toBe('en');
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
