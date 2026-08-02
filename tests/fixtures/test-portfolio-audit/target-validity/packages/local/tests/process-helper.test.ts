import { spawnSync } from 'node:child_process';
import path from 'node:path';

const PACKAGE_ROOT = path.resolve(import.meta.dirname, '..');

function run(command: string, args: string[], cwd: string): void {
  spawnSync(command, args, { cwd });
}

run(process.execPath, ['helper-build.js'], PACKAGE_ROOT);
