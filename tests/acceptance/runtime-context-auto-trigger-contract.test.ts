import { describe, expect, it } from 'vitest';
import * as runtimeContext from '../../scripts/runtime-context';
import * as runtimeRegistry from '../../scripts/runtime-context-registry';

describe('runtime-context auto trigger contract', () => {
  it('exposes unified auto-trigger helpers for sourceMode detection and project/story/run bootstrapping', () => {
    expect(typeof (runtimeContext as any).detectRuntimeSourceMode).toBe('function');
    expect(typeof (runtimeContext as any).ensureProjectRuntimeContext).toBe('function');
    expect(typeof (runtimeContext as any).ensureStoryRuntimeContext).toBe('function');
    expect(typeof (runtimeContext as any).ensureRunRuntimeContext).toBe('function');

    expect(typeof (runtimeRegistry as any).writeRuntimeContextRegistry).toBe('function');
    expect(typeof (runtimeRegistry as any).resolveActiveScope).toBe('function');
  });
});
