import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { mainEmitRuntimePolicy } from '../../scripts/emit-runtime-policy';
import { writeMinimalRegistryAndProjectContext } from '../helpers/runtime-registry-fixture';

const repoRoot = process.cwd();

describe('runtime-governance concurrency emit', () => {
  it('fails loud when story/implement lacks storyId and runId in registry-backed context', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-concurrency-emit-'));
    fs.cpSync(path.join(repoRoot, '_bmad'), path.join(root, '_bmad'), { recursive: true });
    writeMinimalRegistryAndProjectContext(root, { flow: 'story', stage: 'implement' });

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const code = mainEmitRuntimePolicy(['--cwd', root]);

    expect(code).toBe(1);
    expect(errorSpy).toHaveBeenCalledWith(
      'emit-runtime-policy: story/implement requires storyId or runId in runtime context (registry-backed).'
    );

    errorSpy.mockRestore();
    fs.rmSync(root, { recursive: true, force: true });
  });
});
