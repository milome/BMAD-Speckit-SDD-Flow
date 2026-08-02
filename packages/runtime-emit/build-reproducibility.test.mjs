import assert from 'node:assert';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { it } from 'vitest';

const PACKAGE_ROOT = path.dirname(fileURLToPath(import.meta.url));
const BUILD_SCRIPT = path.join(PACKAGE_ROOT, 'build.js');
const BUILD_MANIFEST = path.join(PACKAGE_ROOT, 'dist', 'build-manifest.json');

it('runtime emit build manifest is byte-reproducible for unchanged source', () => {
  execFileSync(process.execPath, [BUILD_SCRIPT], {
    cwd: PACKAGE_ROOT,
    encoding: 'utf8',
  });
  const first = fs.readFileSync(BUILD_MANIFEST);

  execFileSync(process.execPath, [BUILD_SCRIPT], {
    cwd: PACKAGE_ROOT,
    encoding: 'utf8',
  });
  const second = fs.readFileSync(BUILD_MANIFEST);

  assert.deepEqual(second, first);
});
