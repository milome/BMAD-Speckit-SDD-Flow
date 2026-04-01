import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('runtime hooks and worker', () => {
  it('hooks directory has required files', () => {
    const sessionStart = readFileSync('.claude/hooks/session-start.js', 'utf8');
    const postToolUse = readFileSync('.claude/hooks/post-tool-use.js', 'utf8');
    const stop = readFileSync('.claude/hooks/stop.js', 'utf8');
    const worker = readFileSync('scripts/bmad-runtime-worker.ts', 'utf8');

    expect(sessionStart).toContain('checkpoint');
    expect(postToolUse).toContain('event');
    expect(stop).toContain('checkpoint');
    expect(stop).toContain('runBmadRuntimeWorker');
    expect(worker).toContain('pending');
    expect(worker).toContain('processing');
    expect(worker).toContain('done');
    expect(worker).toContain('failed');
  });
});
