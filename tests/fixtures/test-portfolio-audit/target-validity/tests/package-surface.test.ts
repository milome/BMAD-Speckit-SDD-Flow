import { readdirSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');

readdirSync(path.join(ROOT, 'src', 'package-surface'));
