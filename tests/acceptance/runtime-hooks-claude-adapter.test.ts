import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

describe('runtime hooks claude adapter', () => {
  it('keeps Claude adapter thin and delegates to shared core', () => {
    const file = path.join(process.cwd(), '_bmad', 'claude', 'hooks', 'runtime-policy-inject.js');
    const source = readFileSync(file, 'utf8');

    expect(source).toContain("../../runtime/hooks/runtime-policy-inject-core");
    expect(source).not.toContain('spawnSync');
    expect(source).not.toContain('runEmit(');
    expect(source).not.toContain('buildRuntimeErrorMessage');
  });
});
