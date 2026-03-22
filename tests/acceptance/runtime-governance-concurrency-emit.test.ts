import { describe, expect, it, vi } from 'vitest';
import { mainEmitRuntimePolicy } from '../../scripts/emit-runtime-policy';

describe('runtime-governance concurrency emit', () => {
  it('fails loud with an explicit story-scoped context error when implement mode lacks explicit context file', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    delete process.env.BMAD_RUNTIME_CONTEXT_FILE;

    const code = mainEmitRuntimePolicy([
      '--flow',
      'story',
      '--stage',
      'implement',
      '--cwd',
      process.cwd(),
    ]);

    expect(code).toBe(1);
    expect(errorSpy).toHaveBeenCalledWith(
      'emit-runtime-policy: story/implement requires explicit runtime context in story-scoped mode.'
    );

    errorSpy.mockRestore();
  });
});
