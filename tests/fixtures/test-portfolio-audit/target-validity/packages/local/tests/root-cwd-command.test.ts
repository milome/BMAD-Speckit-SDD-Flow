import { execSync } from 'node:child_process';
import path from 'node:path';

const SCRIPT_PATH = path.join(process.cwd(), 'src', 'root-command.ts');

execSync(`npx ts-node "${SCRIPT_PATH}"`, { cwd: process.cwd() });
