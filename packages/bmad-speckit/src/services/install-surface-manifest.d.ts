export const KNOWN_AGENT_IDS: readonly string[];
export const AGENT_ID_ALIASES: Readonly<Record<string, string>>;
export const ACCEPTED_CONSUMER_MAIN_AGENT_HOOK_FILES: readonly string[];
export const LEGACY_CONSUMER_HOOK_PATTERNS: readonly RegExp[];

export function normalizeAgentId(agentId?: string | null): string | null;
export function normalizeAgentList(agentValue?: string | string[] | null): string[];
export function getInstallManifestPath(projectRoot: string): string;
export function getUninstallReportPath(projectRoot: string): string;
export function getInstallStateRoot(projectRoot: string, installSessionId: string): string;
export function getInstallStateSnapshotRootRel(installSessionId: string): string;
export function readInstallManifest(projectRoot: string): Record<string, unknown> | null;
export function writeInstallManifest(projectRoot: string, payload: Record<string, unknown>): void;
export function removeInstallManifest(projectRoot: string): void;
export function writeUninstallReport(projectRoot: string, payload: Record<string, unknown>): void;
export function makeInstallSessionId(): string;
export function hashPath(targetPath: string): string;
export function copyRecursive(src: string, dest: string): void;
export function createInstallStateTracker(...args: unknown[]): Record<string, unknown>;
export function collectManagedSurfaceSpecs(...args: unknown[]): Array<Record<string, unknown>>;
export function collectManagedGlobalSkillSpecs(...args: unknown[]): Array<Record<string, unknown>>;
export function createSkipEntry(
  pathValue: string,
  classification: string,
  skipReason: string,
  recommendedManualAction?: string
): Record<string, string>;
export function isAcceptedConsumerMainAgentHookFile(fileName: string): boolean;
export function isUnexpectedLegacyConsumerHookFile(fileName: string): boolean;
export function listUnexpectedLegacyConsumerHookFiles(hookDir: string): string[];
export function removeUnexpectedLegacyConsumerHookFiles(hookDir: string): string[];
