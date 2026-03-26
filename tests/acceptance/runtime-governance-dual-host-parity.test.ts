import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { mainEmitRuntimePolicy } from '../../scripts/emit-runtime-policy';
import { resolveRuntimePolicy } from '../../scripts/runtime-governance';
import { stableStringifyPolicy } from '../../scripts/stable-runtime-policy-json';
import { writeMinimalRegistryAndProjectContext } from '../helpers/runtime-registry-fixture';

const repoRoot = process.cwd();

describe('runtime-governance dual-host parity', () => {
  it('emits identical canonical policy payload for repeated emit on same registry-backed context', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-dual-parity-'));
    fs.cpSync(path.join(repoRoot, '_bmad'), path.join(root, '_bmad'), { recursive: true });
    writeMinimalRegistryAndProjectContext(root, {
      flow: 'story',
      stage: 'implement',
      storyId: '14.1',
      storySlug: 'runtimegovanceValidator',
      runId: 'parity-run-001',
      artifactRoot:
        '_bmad-output/implementation-artifacts/epic-14-runtimegovanceValidator/story-14-1-runtimegovanceValidator',
    });

    const first = mainEmitRuntimePolicy(['--cwd', root]);
    const second = mainEmitRuntimePolicy(['--cwd', root]);
    const policy = resolveRuntimePolicy({
      flow: 'story',
      stage: 'implement',
      storyId: '14.1',
      storySlug: 'runtimegovanceValidator',
      runId: 'parity-run-001',
      artifactRoot:
        '_bmad-output/implementation-artifacts/epic-14-runtimegovanceValidator/story-14-1-runtimegovanceValidator',
    });
    const expected = stableStringifyPolicy(policy);

    try {
      expect(first).toBe(0);
      expect(second).toBe(0);
      expect(policy.identity.storyId).toBe('14.1');
      expect(policy.identity.runId).toBe('parity-run-001');
      expect(expected).toContain('"triggerStage":"speckit_5_2"');
      expect(expected).toContain('"identity":{');
      expect(expected).toContain('"storyId":"14.1"');
      expect(expected).toContain('"runId":"parity-run-001"');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
