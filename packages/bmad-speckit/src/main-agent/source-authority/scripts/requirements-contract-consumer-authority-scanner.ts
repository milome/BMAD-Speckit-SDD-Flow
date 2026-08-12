import fs from 'node:fs';
import path from 'node:path';
import type { ProductionSemanticSourceRootCandidate } from './requirements-contract-production-semantic-pipeline';
import {
  REQUIREMENTS_CONTRACT_SOURCE_ROOT_CLASS_REGISTRY,
} from './requirements-contract-source-root-class-registry';
import { sha256Stable, sha256Text } from './requirements-contract-semantic-resolver';

export interface RequirementsContractConsumerAuthoritySourceEntry {
  path: string;
  rootClass: string;
  proposedAuthorityClass: string;
  bodySchemaVersion: string;
}

export interface RequirementsContractConsumerAuthorityScanInput {
  cwd: string;
  intakeSource: string;
  authoritySources: RequirementsContractConsumerAuthoritySourceEntry[];
  maxSourceBytes?: number;
  maxSourceCount?: number;
}

export function readRequirementsContractDeclaredAuthoritySources(
  intakeSource: string
): RequirementsContractConsumerAuthoritySourceEntry[] {
  const source = fs.readFileSync(intakeSource, 'utf8');
  if (path.extname(intakeSource).toLowerCase() === '.json') {
    const parsed = JSON.parse(source) as { authoritySources?: unknown };
    if (!Array.isArray(parsed.authoritySources)) {
      throw new Error('requirements_authority_sources_declaration_missing');
    }
    return parsed.authoritySources as RequirementsContractConsumerAuthoritySourceEntry[];
  }
  const lines = source.replace(/\r\n?/gu, '\n').split('\n');
  const start = lines.findIndex((line) => /^authoritySources:\s*$/u.test(line.trim()));
  if (start < 0) throw new Error('requirements_authority_sources_declaration_missing');
  const entries: RequirementsContractConsumerAuthoritySourceEntry[] = [];
  let current: Partial<RequirementsContractConsumerAuthoritySourceEntry> | null = null;
  for (const line of lines.slice(start + 1)) {
    if (/^---\s*$/u.test(line.trim())) break;
    const item = line.match(/^\s*-\s+path:\s*(.+?)\s*$/u);
    if (item) {
      if (current) entries.push(current as RequirementsContractConsumerAuthoritySourceEntry);
      current = { path: item[1].replace(/^['"]|['"]$/gu, '') };
      continue;
    }
    const field = line.match(
      /^\s+(rootClass|proposedAuthorityClass|bodySchemaVersion):\s*(.+?)\s*$/u
    );
    if (field && current) {
      current[field[1] as keyof RequirementsContractConsumerAuthoritySourceEntry] =
        field[2].replace(/^['"]|['"]$/gu, '');
      continue;
    }
    if (line.trim() && !/^\s/u.test(line)) break;
  }
  if (current) entries.push(current as RequirementsContractConsumerAuthoritySourceEntry);
  if (
    entries.length === 0 ||
    entries.some((entry) =>
      !entry.path || !entry.rootClass || !entry.proposedAuthorityClass || !entry.bodySchemaVersion
    )
  ) {
    throw new Error('requirements_authority_sources_declaration_invalid');
  }
  return entries;
}

const FORBIDDEN_SEGMENTS = new Set(['.git', 'node_modules', '_bmad-output']);
const ALLOWED_EXTENSIONS = new Set(['.json']);

function normalizedRelativePath(cwd: string, candidatePath: string): string {
  if (!candidatePath?.trim() || path.isAbsolute(candidatePath)) {
    throw new Error('requirements_authority_path_escape');
  }
  const normalized = candidatePath.replace(/\\/gu, '/');
  const segments = normalized.split('/').filter(Boolean);
  if (segments.some((segment) => segment === '..')) {
    throw new Error('requirements_authority_path_escape');
  }
  if (segments.some((segment) => FORBIDDEN_SEGMENTS.has(segment))) {
    throw new Error('requirements_authority_forbidden_root');
  }
  const absolute = path.resolve(cwd, normalized);
  const relative = path.relative(cwd, absolute).replace(/\\/gu, '/');
  if (!relative || relative.startsWith('../') || path.isAbsolute(relative)) {
    throw new Error('requirements_authority_path_escape');
  }
  return relative;
}

function validatedFile(cwd: string, relativePath: string, maxSourceBytes: number): {
  absolutePath: string;
  content: string;
} {
  const absolutePath = path.resolve(cwd, relativePath);
  if (!fs.existsSync(absolutePath)) throw new Error('requirements_authority_source_missing');
  const lstat = fs.lstatSync(absolutePath);
  if (lstat.isSymbolicLink()) throw new Error('requirements_authority_symlink_forbidden');
  if (!lstat.isFile()) throw new Error('requirements_authority_source_not_file');
  if (!ALLOWED_EXTENSIONS.has(path.extname(absolutePath).toLowerCase())) {
    throw new Error('requirements_authority_extension_unknown');
  }
  if (lstat.size > maxSourceBytes) throw new Error('requirements_authority_source_bytes_exceeded');
  const realRoot = fs.realpathSync(cwd);
  const realFile = fs.realpathSync(absolutePath);
  const realRelative = path.relative(realRoot, realFile).replace(/\\/gu, '/');
  if (realRelative.startsWith('../') || path.isAbsolute(realRelative)) {
    throw new Error('requirements_authority_path_escape');
  }
  return { absolutePath, content: fs.readFileSync(absolutePath, 'utf8') };
}

export function scanRequirementsContractConsumerAuthority(
  input: RequirementsContractConsumerAuthorityScanInput
) {
  const cwd = path.resolve(input.cwd);
  const intakeSource = path.resolve(input.intakeSource);
  const intakeRelative = path.relative(cwd, intakeSource).replace(/\\/gu, '/');
  if (intakeRelative.startsWith('../') || path.isAbsolute(intakeRelative)) {
    throw new Error('requirements_authority_intake_path_escape');
  }
  const intakeStat = fs.lstatSync(intakeSource);
  if (!intakeStat.isFile() || intakeStat.isSymbolicLink()) {
    throw new Error('requirements_authority_intake_invalid');
  }
  const maxSourceCount = input.maxSourceCount ?? 128;
  const maxSourceBytes = input.maxSourceBytes ?? 1024 * 1024;
  if (!Array.isArray(input.authoritySources) || input.authoritySources.length > maxSourceCount) {
    throw new Error('requirements_authority_source_count_exceeded');
  }
  const registryByRootClass = new Map(
    REQUIREMENTS_CONTRACT_SOURCE_ROOT_CLASS_REGISTRY.map((entry) => [entry.rootClass, entry])
  );
  const declaredEntries = input.authoritySources.map((entry) => ({
    path: normalizedRelativePath(cwd, entry.path),
    rootClass: entry.rootClass,
    proposedAuthorityClass: entry.proposedAuthorityClass,
    bodySchemaVersion: entry.bodySchemaVersion,
  })).sort((left, right) => left.path.localeCompare(right.path));
  if (new Set(declaredEntries.map((entry) => entry.path)).size !== declaredEntries.length) {
    throw new Error('requirements_authority_source_duplicate');
  }
  const sourceRootCandidates: ProductionSemanticSourceRootCandidate[] = [];
  for (const entry of declaredEntries) {
    const definition = registryByRootClass.get(entry.rootClass);
    if (!definition || definition.bodySchemaVersion !== entry.bodySchemaVersion) {
      throw new Error('requirements_authority_schema_unknown');
    }
    if (!entry.proposedAuthorityClass?.trim()) {
      throw new Error('requirements_authority_class_invalid');
    }
    const source = validatedFile(cwd, entry.path, maxSourceBytes);
    let document: Record<string, unknown>;
    try {
      document = JSON.parse(source.content) as Record<string, unknown>;
    } catch {
      throw new Error('requirements_authority_source_json_invalid');
    }
    if (
      document.schemaVersion !== 'requirements-contract-authority-source/v1' ||
      typeof document.sourceRootId !== 'string' ||
      !document.sourceRootId.trim() ||
      !document.semanticBody ||
      typeof document.semanticBody !== 'object' ||
      Array.isArray(document.semanticBody)
    ) {
      throw new Error('requirements_authority_source_schema_invalid');
    }
    const lineCount = source.content.split(/\r\n?|\n/gu).length;
    sourceRootCandidates.push({
      sourceRootId: document.sourceRootId,
      rootClass: entry.rootClass,
      nodeType: definition.nodeType,
      bodySchemaVersion: entry.bodySchemaVersion,
      semanticBody: document.semanticBody as Record<string, unknown>,
      sourcePath: entry.path,
      sourceContent: source.content,
      sourceSpan: { startLine: 1, endLine: lineCount },
      proposedAuthorityClass: entry.proposedAuthorityClass,
      ...(Array.isArray(document.relatedRequirementRefs)
        ? { relatedRequirementRefs: document.relatedRequirementRefs.map(String).sort() }
        : {}),
    });
  }
  const sourceRootIds = sourceRootCandidates.map((candidate) => candidate.sourceRootId);
  const duplicates = [...new Set(sourceRootIds.filter(
    (sourceRootId, index) => sourceRootIds.indexOf(sourceRootId) !== index
  ))].sort();
  const conflicts = duplicates.map((sourceRootId) => ({
      conflictId: sha256Stable({ domain: 'requirements-authority-conflict/v1', sourceRootId }),
    sourceRootId,
    issueCode: 'requirements_authority_source_root_conflict' as const,
  }));
  const entries = declaredEntries.map((entry, index) => ({
    ...entry,
    bodyHash: sha256Stable(sourceRootCandidates[index].semanticBody),
  }));
  const sourceListPayload = {
    schemaVersion: 'requirements-contract-consumer-authority-source-list/v1' as const,
    intakeSource: intakeRelative,
    intakeSourceHash: sha256Text(fs.readFileSync(intakeSource, 'utf8')),
    entries,
  };
  return {
    sourceList: {
      ...sourceListPayload,
      sourceListHash: sha256Stable(sourceListPayload),
    },
    sourceRootCandidates,
    facts: sourceRootCandidates.map((candidate) => ({
      factId: candidate.sourceRootId,
      rootClass: candidate.rootClass,
      bodyHash: sha256Stable(candidate.semanticBody),
      sourcePath: candidate.sourcePath,
    })),
    conflicts,
    decisionGraph: {
      schemaVersion: 'requirements-contract-authority-decision-graph/v1' as const,
      unresolvedDecisionIds: conflicts.map((conflict) => conflict.conflictId),
    },
  };
}
