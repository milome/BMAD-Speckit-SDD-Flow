import * as path from 'node:path';
import type {
  RalphTrackingPaths,
  ResolveRalphTrackingPathsInput,
} from './types';

function resolveRoot(projectRoot?: string): string {
  return path.resolve(projectRoot ?? process.cwd());
}

function resolveFromRoot(root: string, value?: string): string | undefined {
  if (!value) {
    return undefined;
  }
  return path.isAbsolute(value) ? path.resolve(value) : path.resolve(root, value);
}

function deriveStem(filePath?: string): string | undefined {
  if (!filePath) {
    return undefined;
  }
  return path.basename(filePath, path.extname(filePath));
}

export function resolveRalphTrackingPaths(
  input: ResolveRalphTrackingPathsInput
): RalphTrackingPaths {
  const root = resolveRoot(input.projectRoot);
  const referenceDocumentPath = resolveFromRoot(root, input.referenceDocumentPath);
  const tasksPath = resolveFromRoot(root, input.tasksPath);
  const preferredBaseDir = resolveFromRoot(root, input.preferredBaseDir);

  const baseDir = referenceDocumentPath
    ? path.dirname(referenceDocumentPath)
    : tasksPath
      ? path.dirname(tasksPath)
      : preferredBaseDir
        ? preferredBaseDir
        : root;

  const stem = deriveStem(referenceDocumentPath) ?? deriveStem(tasksPath);

  return {
    baseDir,
    ...(stem ? { stem } : {}),
    prdPath: path.join(baseDir, stem ? `prd.${stem}.json` : 'prd.json'),
    progressPath: path.join(baseDir, stem ? `progress.${stem}.txt` : 'progress.txt'),
  };
}
