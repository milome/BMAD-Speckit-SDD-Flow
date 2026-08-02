import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { it } from 'vitest';

it('writes repository-global output', () => {
  writeFileSync(join(process.cwd(), 'dist', 'audit-result.json'), '{}');
});
