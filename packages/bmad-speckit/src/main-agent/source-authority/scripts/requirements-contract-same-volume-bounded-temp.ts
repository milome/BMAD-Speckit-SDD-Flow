import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import path from 'node:path';

export interface SameVolumeBoundedTempDirectoryInput {
  anchorDirectory: string;
  prefix: string;
  projectedRelativePaths?: string[];
}

const WINDOWS_LEGACY_PATH_LIMIT = 260;
const MKDTEMP_SUFFIX = 'XXXXXX';

function normalizedVolumeRoot(candidatePath: string): string {
  const root = path.parse(path.resolve(candidatePath)).root;
  return process.platform === 'win32' ? root.toLowerCase() : root;
}

function validatePrefix(prefix: string): string {
  const normalized = prefix.trim();
  if (
    !normalized ||
    normalized === '.' ||
    normalized === '..' ||
    path.basename(normalized) !== normalized
  ) {
    throw new Error('same_volume_bounded_temp_prefix_invalid');
  }
  return normalized;
}

function normalizeProjectedRelativePaths(values: string[]): string[] {
  return values.map((value) => {
    const normalized = path.normalize(value);
    if (
      !normalized ||
      normalized === '.' ||
      path.isAbsolute(normalized) ||
      normalized === '..' ||
      normalized.startsWith(`..${path.sep}`)
    ) {
      throw new Error('same_volume_bounded_temp_projected_path_invalid');
    }
    return normalized;
  });
}

function longestProjectedPathLength(
  parentDirectory: string,
  prefix: string,
  projectedRelativePaths: string[]
): number {
  const temporaryRootTemplate = path.join(parentDirectory, `${prefix}${MKDTEMP_SUFFIX}`);
  return Math.max(
    temporaryRootTemplate.length,
    ...projectedRelativePaths.map(
      (relativePath) => path.join(temporaryRootTemplate, relativePath).length
    )
  );
}

function resolveSameVolumeBoundedParent(input: {
  anchorDirectory: string;
  prefix: string;
  projectedRelativePaths: string[];
}): string {
  const anchorDirectory = path.resolve(input.anchorDirectory);
  const anchorVolume = normalizedVolumeRoot(anchorDirectory);
  if (process.platform !== 'win32') {
    return path.join(anchorDirectory, '.s');
  }

  const volumeRoot = path.parse(anchorDirectory).root;
  let candidateAncestor = anchorDirectory;
  for (;;) {
    const candidateParent = path.join(candidateAncestor, '.s');
    if (
      normalizedVolumeRoot(candidateParent) === anchorVolume &&
      longestProjectedPathLength(
        candidateParent,
        input.prefix,
        input.projectedRelativePaths
      ) < WINDOWS_LEGACY_PATH_LIMIT
    ) {
      return candidateParent;
    }
    if (candidateAncestor === volumeRoot) break;
    candidateAncestor = path.dirname(candidateAncestor);
  }
  throw new Error('same_volume_bounded_temp_parent_unavailable');
}

export function createSameVolumeBoundedTempDirectory(
  input: SameVolumeBoundedTempDirectoryInput
): string {
  const anchorDirectory = path.resolve(input.anchorDirectory);
  const prefix = validatePrefix(input.prefix);
  const projectedRelativePaths = normalizeProjectedRelativePaths(
    input.projectedRelativePaths ?? []
  );
  const parentDirectory = resolveSameVolumeBoundedParent({
    anchorDirectory,
    prefix,
    projectedRelativePaths,
  });
  if (normalizedVolumeRoot(parentDirectory) !== normalizedVolumeRoot(anchorDirectory)) {
    throw new Error('same_volume_bounded_temp_volume_mismatch');
  }

  mkdirSync(parentDirectory, { recursive: true });
  const temporaryRoot = mkdtempSync(path.join(parentDirectory, prefix));
  try {
    if (
      normalizedVolumeRoot(temporaryRoot) !== normalizedVolumeRoot(anchorDirectory) ||
      (process.platform === 'win32' &&
        longestProjectedPathLength(
          path.dirname(temporaryRoot),
          path.basename(temporaryRoot).slice(0, -MKDTEMP_SUFFIX.length),
          projectedRelativePaths
        ) >= WINDOWS_LEGACY_PATH_LIMIT)
    ) {
      throw new Error('same_volume_bounded_temp_allocation_invalid');
    }
    return temporaryRoot;
  } catch (error) {
    rmSync(temporaryRoot, { recursive: true, force: true });
    throw error;
  }
}
