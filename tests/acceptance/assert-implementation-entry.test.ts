import * as fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { mainAssertImplementationEntry } from '../../scripts/assert-implementation-entry';
import { writeMinimalRegistryAndProjectContext } from '../helpers/runtime-registry-fixture';

const repoRoot = process.cwd();

describe('assert-implementation-entry', () => {
  it('returns non-zero when the current implementation-entry gate is blocked', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-assert-impl-entry-'));
    fs.cpSync(path.join(repoRoot, '_bmad'), path.join(root, '_bmad'), { recursive: true });
    writeMinimalRegistryAndProjectContext(root, {
      flow: 'story',
      stage: 'implement',
      epicId: 'epic-14',
      storyId: '14.1',
      runId: 'run-14-1',
    });

    const stdoutChunks: string[] = [];
    const originalWrite = process.stdout.write.bind(process.stdout);
    (process.stdout as { write: typeof process.stdout.write }).write = (
      chunk: string | Uint8Array
    ) => {
      stdoutChunks.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8'));
      return true;
    };

    try {
      const code = mainAssertImplementationEntry(['--cwd', root]);
      expect(code).toBe(2);
      const gate = JSON.parse(stdoutChunks.join(''));
      expect(gate.decision).toBe('block');
      expect(gate.gateName).toBe('implementation-readiness');
    } finally {
      (process.stdout as { write: typeof process.stdout.write }).write = originalWrite;
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
