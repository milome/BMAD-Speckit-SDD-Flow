import { mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { it } from 'vitest';

it('uses a shared fixed temporary path', () => {
  mkdirSync(join(tmpdir(), 'test-portfolio-audit-shared'), { recursive: true });
});
