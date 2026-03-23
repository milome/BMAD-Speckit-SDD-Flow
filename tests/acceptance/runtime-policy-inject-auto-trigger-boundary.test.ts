import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = process.cwd();

describe('runtime-policy inject auto-trigger boundary', () => {
  it('quietly skips outside BMAD instead of fabricating business runtime state', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'hook-boundary-'));
    try {
      const script = path.join(repoRoot, '_bmad/claude/hooks/runtime-policy-inject.js');
      const r = spawnSync(process.execPath, [script, '--cursor-host'], {
        cwd: tempRoot,
        input: JSON.stringify({ cwd: tempRoot }),
        encoding: 'utf8',
        env: {
          ...process.env,
          BMAD_HOOK_HOST: 'cursor',
          CURSOR_PROJECT_ROOT: tempRoot,
          CLAUDE_PROJECT_DIR: tempRoot,
          BMAD_RUNTIME_FLOW: '',
          BMAD_RUNTIME_STAGE: '',
        },
      });

      expect(r.status).toBe(0);
      expect((r.stderr || '').trim()).toBe('');
      const out = JSON.parse(r.stdout || '{}');
      expect(out.systemMessage || '').toBe('');
      expect(fs.existsSync(path.join(tempRoot, '_bmad-output', 'runtime', 'registry.json'))).toBe(
        false
      );
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});
