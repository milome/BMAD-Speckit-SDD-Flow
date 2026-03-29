import { existsSync } from 'node:fs';
import * as path from 'node:path';
import { execSync } from 'node:child_process';

function hasScoringDist(root: string): boolean {
  const requiredOutputs = [
    path.join(root, 'packages', 'scoring', 'dist', 'dashboard', 'index.js'),
    path.join(root, 'packages', 'scoring', 'dist', 'analytics', 'index.js'),
  ];

  return requiredOutputs.every((file) => existsSync(file));
}

export function ensureScoringBuild(root: string): void {
  if (hasScoringDist(root)) {
    return;
  }

  execSync('npm run build:scoring', {
    cwd: root,
    stdio: 'ignore',
  });
}
