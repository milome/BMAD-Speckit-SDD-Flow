import { execSync } from 'node:child_process';
import path from 'node:path';

const PACKAGE_ROOT = path.resolve(import.meta.dirname, '..');

execSync('npx target-validity-cli inspect', { cwd: PACKAGE_ROOT });
