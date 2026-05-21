export interface AIRegistryEntry {
  id: string;
  configTemplate?: Record<string, unknown>;
}

export function load(opts?: { cwd?: string }): AIRegistryEntry[];
export function getById(id: string, opts?: { cwd?: string }): AIRegistryEntry | null;
export function listIds(opts?: { cwd?: string }): string[];
export function getGlobalRegistryPath(): string;
export function getProjectRegistryPath(cwd?: string): string;
export function parseRegistryFile(content: string, filePath?: string): AIRegistryEntry[];
export function deepMergeConfigTemplate(
  base?: Record<string, unknown> | null,
  overlay?: Record<string, unknown> | null
): Record<string, unknown>;
export function mergeByPriority(
  builtin: AIRegistryEntry[],
  global: AIRegistryEntry[],
  project: AIRegistryEntry[]
): AIRegistryEntry[];

declare const AIRegistry: {
  load: typeof load;
  getById: typeof getById;
  listIds: typeof listIds;
  getGlobalRegistryPath: typeof getGlobalRegistryPath;
  getProjectRegistryPath: typeof getProjectRegistryPath;
  parseRegistryFile: typeof parseRegistryFile;
  deepMergeConfigTemplate: typeof deepMergeConfigTemplate;
  mergeByPriority: typeof mergeByPriority;
};

export default AIRegistry;
