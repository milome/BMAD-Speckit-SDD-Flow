import * as fs from 'node:fs';
import * as path from 'node:path';
import { execSync } from 'node:child_process';
import { computeStringHash, getGitHeadHashFull } from './hash';

export interface PersistedPatchSnapshot {
  patch_ref: string;
  patch_snapshot_path: string;
}

function sanitizePathSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, '_');
}

export function resolvePatchSnapshotDir(dataPath: string): string {
  return path.join(dataPath, '_patch-snapshots');
}

export function persistPatchSnapshot(input: {
  cwd?: string;
  dataPath: string;
  runId: string;
  stage: string;
  baseCommitHash?: string;
}): PersistedPatchSnapshot | null {
  if (!input.baseCommitHash) {
    return null;
  }

  const cwd = input.cwd ?? process.cwd();
  const headHash = getGitHeadHashFull(cwd);
  if (!headHash) {
    return null;
  }

  try {
    execSync(`git rev-parse --verify ${input.baseCommitHash}`, {
      cwd,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch {
    return null;
  }

  let diff = '';
  const diffCommands = [
    `git diff ${input.baseCommitHash} ${headHash}`,
    `git show --format= --patch ${headHash}`,
    `git show -m --format= --patch ${headHash}`,
    `git diff-tree --no-commit-id --patch -m -r ${headHash}`,
  ];
  for (const command of diffCommands) {
    try {
      diff = execSync(command, {
        cwd,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } catch {
      diff = '';
    }
    if (diff.trim() !== '') {
      break;
    }
  }
  if (diff.trim() === '') {
    return null;
  }

  const patchRef = `sha256:${computeStringHash(diff)}`;
  const patchDir = resolvePatchSnapshotDir(input.dataPath);
  fs.mkdirSync(patchDir, { recursive: true });

  const fileName = `${sanitizePathSegment(input.runId)}-${sanitizePathSegment(input.stage)}-${patchRef.slice(7, 19)}.patch`;
  const patchPath = path.join(patchDir, fileName);
  fs.writeFileSync(patchPath, diff, 'utf-8');

  return {
    patch_ref: patchRef,
    patch_snapshot_path: patchPath,
  };
}

export function readPatchSnapshot(snapshotPath: string, cwd?: string): string | null {
  const resolved = path.isAbsolute(snapshotPath)
    ? snapshotPath
    : path.resolve(cwd ?? process.cwd(), snapshotPath);

  if (!fs.existsSync(resolved)) {
    return null;
  }

  try {
    return fs.readFileSync(resolved, 'utf-8');
  } catch {
    return null;
  }
}
