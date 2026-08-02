import { execFileSync } from 'node:child_process';
import path from 'node:path';

const PACKAGE_ROOT = path.join(process.cwd(), 'packages', 'local');

execFileSync(process.execPath, ['build.js'], { cwd: PACKAGE_ROOT });
