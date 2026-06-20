import path from 'node:path';

export function resolveRuntimeScoringDataPath(input: {
  root: string;
  dataPath?: string | null;
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
}): string {
  const root = path.resolve(input.root);
  const explicit = input.dataPath?.trim();
  const envPath = (input.env ?? process.env).SCORING_DATA_PATH?.trim();
  const selected = explicit || envPath || path.join('_bmad-output', 'scoring');
  return path.isAbsolute(selected) ? selected : path.resolve(root, selected);
}
