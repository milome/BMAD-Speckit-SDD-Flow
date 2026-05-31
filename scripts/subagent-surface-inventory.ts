/* eslint-disable no-console */
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import yaml from 'js-yaml';

type JsonObject = Record<string, unknown>;
type CoverageStatus = 'covered' | 'excluded' | 'blocked';
type Decision = 'pass' | 'blocked';

interface ParsedArgs {
  source?: string;
  requirementRecord?: string;
  out?: string;
  generatedAt?: string;
  generatedBy?: string;
  json?: boolean;
  help?: boolean;
}

interface RegistrySurface {
  surfaceId: string;
  path: string;
  surfaceType: string;
  classification: string;
  canAffectControlFlow: boolean;
  requiredEnvelope: boolean;
  currentAttemptRevalidationRequired: boolean;
  linkedRequirements: string[];
}

interface InventoryRow {
  surfacePath: string;
  matchPattern: string;
  matchedTextHash: string;
  surfaceKind: string;
  classification: string;
  registrySurfaceId: string;
  coverageStatus: CoverageStatus;
  explicitExclusionReason: string;
  exclusionReasonCode: string;
  canAffectControlFlow: boolean;
  requiredEnvelope: boolean;
  currentAttemptRevalidationRequired: boolean;
  ownerSubsystem: string;
  linkedRequirementIds: string[];
  linkedEvidenceIds: string[];
  scannerConfigHash: string;
  sourceDocumentHash: string;
  implementationConfirmationHash: string;
  architectureConfirmationHash: string;
}

const TARGET_PATHS = [
  'scripts/orchestration-dispatch-contract.ts',
  'scripts/main-agent-orchestration.ts',
  'scripts/main-agent-codex-worker-adapter.ts',
  'scripts/governance-remediation-runner.ts',
  'scripts/governance-packet-dispatch-worker.ts',
  'scripts/governance-host-dispatch-adapter.ts',
  'scripts/parallel-mission-control.ts',
  'scripts/run-auditor-host.ts',
  'scripts/reviewer-registry.ts',
  'scripts/facilitator-registry.ts',
  'scripts/bmad-runtime-worker.ts',
  'scripts/real-development-tick-worker.js',
  'scripts/main-agent-host-matrix-pr-orchestrator.ts',
  'scripts/main-agent-dual-host-pr-orchestrator.ts',
  'scripts/e2e-host-matrix-journey-runner.ts',
  'scripts/e2e-dual-host-journey-runner.ts',
  'scripts/party-mode-runtime.ts',
  'scripts/facilitator-runtime-definition.ts',
  'scripts/i18n/materialize-facilitator-definition.ts',
  'scripts/i18n/sync-party-mode-mirrors.ts',
  'packages/bmad-speckit/src/constants/ai-registry-builtin.js',
  'packages/bmad-speckit/src/services/sync-service.js',
  'packages/bmad-speckit/src/services/ai-registry.js',
  'packages/bmad-speckit/src/commands/init.js',
  'packages/bmad-speckit/src/commands/check.js',
  'specs/epic-12-speckit-ai-skill-publish',
  'docs',
  'tests',
  '_bmad/claude/hooks',
  '_bmad/cursor/hooks',
  '_bmad/runtime/hooks',
  '_bmad/claude/agents',
  '_bmad/cursor/agents',
  '_bmad/codex/agents',
  '_bmad/claude/skills/bmad-standalone-tasks',
  '_bmad/cursor/skills/bmad-standalone-tasks',
  '_bmad/codex/skills/bmad-standalone-tasks',
  '_bmad/claude/skills/bmad-story-assistant',
  '_bmad/cursor/skills/bmad-story-assistant',
  '_bmad/codex/skills/bmad-story-assistant',
  '_bmad/claude/skills/bmad-bug-assistant',
  '_bmad/cursor/skills/bmad-bug-assistant',
  '_bmad/claude/skills/speckit-workflow',
  '_bmad/cursor/skills/speckit-workflow',
  '_bmad/codex/skills/speckit-workflow',
  '_bmad/skills/requirements-contract-authoring/agents',
  '_bmad/skills/npm-public-release/agents',
  '_bmad/bmm/workflows/1-analysis/bmad-product-brief-preview/agents',
  '_bmad/skills/bmad-distillator/agents',
  '_bmad/core/skills/bmad-distillator/agents',
  '_bmad/claude/skills/bmad-party-mode',
  '_bmad/cursor/skills/bmad-party-mode',
  '_bmad/codex/skills/bmad-party-mode',
  '_bmad/claude/skills/using-git-worktrees',
  '_bmad/cursor/skills/using-git-worktrees',
  '_bmad/codex/skills/using-git-worktrees',
  '_bmad/speckit/scripts/powershell/setup_worktree.ps1',
  '_bmad/speckit/scripts/shell/setup_worktree.sh',
];

const MATCH_PATTERNS = [
  'spawn_agent',
  'mcp_task',
  'Agent tool',
  'Task tool',
  'Codex worker adapter',
  'runAuditorHost',
  'SubagentStart',
  'SubagentStop',
  'UTILIZE SUBPROCESSES AND SUBAGENTS',
  'subagent',
  'subprocess',
  'parallel processing',
  'delegated execution',
  'worker adapter',
  'external host dispatch',
];

const ALLOWED_EXCLUSION_CODES = new Set([
  'non_control_doc_sample',
  'legacy_reference_only',
  'test_fixture_only',
  'comment_without_execution_semantics',
  'upstream_authoring_only_before_confirmation',
]);

const SCANNER_CONFIG = {
  schemaVersion: 'subagent-surface-inventory-scanner/v1',
  targetPaths: TARGET_PATHS,
  matchPatterns: MATCH_PATTERNS,
  allowedExclusionReasonCodes: [...ALLOWED_EXCLUSION_CODES],
  authoritativeRegistryField: 'implementationConfirmation.subagentExecutionSurfaceRegistry',
};

function parseArgs(argv: string[]): ParsedArgs {
  const out: ParsedArgs = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help' || arg === '-h') out.help = true;
    else if (arg === '--json') out.json = true;
    else if (arg.startsWith('--')) {
      const key = arg.slice(2).replace(/-([a-z])/gu, (_, letter: string) => letter.toUpperCase());
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) throw new Error(`Missing value for ${arg}`);
      (out as Record<string, string | boolean | undefined>)[key] = value;
      index += 1;
    } else {
      throw new Error(`Unexpected positional argument: ${arg}`);
    }
  }
  return out;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function objects(value: unknown): JsonObject[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is JsonObject =>
          Boolean(item) && typeof item === 'object' && !Array.isArray(item)
      )
    : [];
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.map(text).filter(Boolean) : [];
}

function nested(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonObject) : {};
}

function normalizePathForRecord(value: string): string {
  return value.replace(/\\/gu, '/');
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  const record = value as JsonObject;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(',')}}`;
}

function sha256Text(value: string): string {
  return `sha256:${crypto.createHash('sha256').update(value, 'utf8').digest('hex')}`;
}

function sha256File(file: string): string {
  return `sha256:${crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}`;
}

function isSha256(value: string): boolean {
  return /^sha256:[a-f0-9]{64}$/u.test(value);
}

function writeJson(file: string, value: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function defaultInventoryOutputPath(recordPath: string): string {
  return path.join(
    path.dirname(path.resolve(recordPath)),
    'subagents',
    'subagent-surface-inventory.json'
  );
}

function readJson(file: string): JsonObject {
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`JSON object expected: ${file}`);
  }
  return parsed as JsonObject;
}

function extractImplementationConfirmation(sourceText: string): JsonObject {
  const lines = sourceText.replace(/\r\n/gu, '\n').split('\n');
  const start = lines.findIndex((line) => /^implementationConfirmation:\s*$/u.test(line));
  if (start < 0) throw new Error('implementationConfirmation block missing');
  let end = lines.length;
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.trim() === '') continue;
    if (/^\S/u.test(line) && !/^implementationConfirmation:\s*$/u.test(line)) {
      end = index;
      break;
    }
  }
  const parsed = nested(yaml.load(lines.slice(start, end).join('\n')));
  const confirmation = nested(parsed.implementationConfirmation);
  if (Object.keys(confirmation).length === 0)
    throw new Error('implementationConfirmation block invalid');
  return confirmation;
}

function registryFromSource(sourcePath: string): {
  confirmation: JsonObject;
  registry: RegistrySurface[];
} {
  const confirmation = extractImplementationConfirmation(fs.readFileSync(sourcePath, 'utf8'));
  const governance = nested(confirmation.subagentExecutionGovernance);
  const registrySource = objects(confirmation.subagentExecutionSurfaceRegistry).length
    ? confirmation.subagentExecutionSurfaceRegistry
    : governance.subagentExecutionSurfaceRegistry;
  const registry = objects(registrySource).map((row) => ({
    surfaceId: text(row.surfaceId),
    path: text(row.path),
    surfaceType: text(row.surfaceType),
    classification: text(row.classification),
    canAffectControlFlow: row.canAffectControlFlow === true,
    requiredEnvelope: row.requiredEnvelope === true,
    currentAttemptRevalidationRequired: row.currentAttemptRevalidationRequired === true,
    linkedRequirements: strings(row.linkedRequirements),
  }));
  return { confirmation, registry };
}

function currentArchitectureHash(record: JsonObject): string {
  return text(nested(record.architectureConfirmationState).currentArchitectureConfirmationHash);
}

function scannerPolicy(confirmation: JsonObject): JsonObject {
  return nested(nested(confirmation.subagentExecutionGovernance).subagentSurfaceInventoryPolicy);
}

function expectedScannerConfigHash(confirmation: JsonObject): string {
  const policy = scannerPolicy(confirmation);
  return sha256Text(
    stableStringify({
      ...SCANNER_CONFIG,
      matchClasses: strings(policy.matchClasses),
      requiredInventoryRowFields: strings(policy.requiredInventoryRowFields),
      failClosedWhen: strings(policy.failClosedWhen),
    })
  );
}

function globToRegex(pattern: string): RegExp {
  const normalized = normalizePathForRecord(pattern);
  let out = '';
  for (let index = 0; index < normalized.length; index += 1) {
    const char = normalized[index];
    const next = normalized[index + 1];
    const afterNext = normalized[index + 2];
    if (char === '*' && next === '*' && afterNext === '/') {
      out += '(?:.*/)?';
      index += 2;
    } else if (char === '*' && next === '*') {
      out += '.*';
      index += 1;
    } else if (char === '*') {
      out += '[^/]*';
    } else if (/[.+^${}()|[\]\\]/u.test(char)) {
      out += `\\${char}`;
    } else {
      out += char;
    }
  }
  return new RegExp(`^${out}(?:/.*)?$`, 'u');
}

function splitRegistryPaths(registryPath: string): string[] {
  return registryPath
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function fileExistsForRegistryPath(root: string, registryPath: string): boolean {
  const parts = splitRegistryPaths(registryPath);
  if (parts.length === 0) return false;
  return parts.some((part) => {
    if (part.includes('*')) return discoverFiles(root, [part]).length > 0;
    return fs.existsSync(path.resolve(root, part));
  });
}

function registryIssues(root: string, registry: RegistrySurface[]): string[] {
  const issues: string[] = [];
  if (registry.length === 0) issues.push('subagentExecutionSurfaceRegistry_missing');
  const ids = new Set<string>();
  for (const surface of registry) {
    if (!surface.surfaceId) issues.push('registry_surface_id_missing');
    if (ids.has(surface.surfaceId))
      issues.push(`registry_surface_id_duplicate:${surface.surfaceId}`);
    ids.add(surface.surfaceId);
    if (!surface.path)
      issues.push(`registry_surface_path_missing:${surface.surfaceId || '<missing>'}`);
    if (!surface.surfaceType) issues.push(`registry_surface_type_missing:${surface.surfaceId}`);
    if (!surface.classification)
      issues.push(`registry_classification_missing:${surface.surfaceId}`);
    if (surface.canAffectControlFlow && !surface.requiredEnvelope) {
      issues.push(`registry_control_flow_without_envelope:${surface.surfaceId}`);
    }
    if (surface.canAffectControlFlow && !surface.currentAttemptRevalidationRequired) {
      issues.push(
        `registry_control_flow_without_current_attempt_revalidation:${surface.surfaceId}`
      );
    }
    if (surface.linkedRequirements.length === 0)
      issues.push(`registry_linked_requirements_missing:${surface.surfaceId}`);
    if (surface.path && !fileExistsForRegistryPath(root, surface.path)) {
      issues.push(`registry_path_unresolved:${surface.surfaceId}`);
    }
  }
  return issues;
}

function walkFiles(root: string, relativePath: string): string[] {
  const absolute = path.resolve(root, relativePath);
  if (!fs.existsSync(absolute)) return [];
  const stat = fs.statSync(absolute);
  if (stat.isFile()) return [normalizePathForRecord(path.relative(root, absolute))];
  if (!stat.isDirectory()) return [];
  const out: string[] = [];
  for (const entry of fs.readdirSync(absolute, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    out.push(...walkFiles(root, path.join(relativePath, entry.name)));
  }
  return out;
}

function discoverFiles(root: string, includePaths: string[] = TARGET_PATHS): string[] {
  const directPaths = includePaths.filter((item) => !item.includes('*'));
  const globPatterns = includePaths.filter((item) => item.includes('*')).map(globToRegex);
  const direct = directPaths.flatMap((item) => walkFiles(root, item));
  const globRoots = [
    ...new Set(
      includePaths
        .filter((item) => item.includes('*'))
        .map((item) => item.split('*')[0].replace(/[/\\]$/u, ''))
    ),
  ];
  const globFiles = globRoots
    .flatMap((item) => walkFiles(root, item || '.'))
    .filter((item) => globPatterns.some((regex) => regex.test(item)));
  return [...new Set([...direct, ...globFiles])].sort();
}

function patternRegex(pattern: string): RegExp {
  return new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'iu');
}

function findMatches(filePath: string, content: string): Array<{ pattern: string; line: string }> {
  const rows: Array<{ pattern: string; line: string }> = [];
  const lines = content.split(/\r?\n/u);
  for (const pattern of MATCH_PATTERNS) {
    const regex = patternRegex(pattern);
    const line = lines.find((item) => regex.test(item));
    if (line) rows.push({ pattern, line: line.trim().slice(0, 500) || pattern });
  }
  return rows.map((row) => ({ ...row, pattern: canonicalPatternForPath(filePath, row.pattern) }));
}

function canonicalPatternForPath(filePath: string, pattern: string): string {
  if (filePath.includes('main-agent-codex-worker-adapter.ts')) return 'Codex worker adapter';
  if (filePath.includes('run-auditor-host.ts')) return 'runAuditorHost';
  if (filePath.includes('parallel')) return 'parallel processing';
  if (filePath.includes('governance-host-dispatch-adapter.ts')) return 'external host dispatch';
  return pattern;
}

function registryForPath(filePath: string, registry: RegistrySurface[]): RegistrySurface | null {
  const normalized = normalizePathForRecord(filePath);
  if (normalized.startsWith('_bmad/codex/skills/bmad-story-assistant/')) {
    const storyAndBugSurface = registry.find(
      (surface) => surface.surfaceId === 'story_and_bug_assistant_party_mode'
    );
    if (storyAndBugSurface) return storyAndBugSurface;
  }
  for (const surface of registry) {
    const parts = splitRegistryPaths(surface.path);
    if (
      parts.some((part) => {
        const normalizedPart = normalizePathForRecord(part);
        if (normalizedPart.includes('*')) return globToRegex(normalizedPart).test(normalized);
        return (
          normalized === normalizedPart ||
          normalized.startsWith(`${normalizedPart.replace(/\/$/u, '')}/`)
        );
      })
    ) {
      return surface;
    }
  }
  return null;
}

function exclusionForPath(filePath: string): { code: string; reason: string } | null {
  const normalized = normalizePathForRecord(filePath);
  if (
    /(^|\/)(README|messages\.(en|zh))\.(md|json)$/iu.test(normalized) ||
    normalized.endsWith('/governance-runner-summary-presenter.cjs') ||
    normalized.endsWith('/post-tool-use-core.cjs') ||
    normalized.endsWith('/runtime-policy-inject-core.cjs')
  ) {
    return {
      code: 'comment_without_execution_semantics',
      reason:
        'localized message, README, or generic hook text mentions a subagent token but does not define a subagent execution surface',
    };
  }
  if (normalized.startsWith('tests/')) {
    return {
      code: 'test_fixture_only',
      reason: 'test fixture models subagent behavior but is not an execution authority',
    };
  }
  if (
    normalized.startsWith('docs/fixes/') ||
    normalized.startsWith('docs/sample/') ||
    normalized.startsWith('docs/design/2026-')
  ) {
    return {
      code: 'legacy_reference_only',
      reason: 'legacy or design reference only; not an active execution surface',
    };
  }
  if (normalized.startsWith('docs/') || normalized.startsWith('specs/')) {
    return {
      code: 'non_control_doc_sample',
      reason: 'documentation or specification sample; cannot drive control decisions',
    };
  }
  return null;
}

function surfaceKindForPath(filePath: string, matchPattern: string): string {
  const normalized = normalizePathForRecord(filePath);
  if (normalized.includes('/hooks/')) return 'hooks_and_hook_summaries';
  if (normalized.includes('/agents/')) return 'agent_prompt_publication_surfaces';
  if (normalized.includes('/skills/')) return 'skill_and_workflow_markdown_subagent_mentions';
  if (normalized.startsWith('packages/bmad-speckit/src'))
    return 'package_ai_registry_subagent_support';
  if (normalized.startsWith('docs/') || normalized.startsWith('specs/'))
    return 'docs_samples_and_legacy_references';
  if (normalized.startsWith('tests/')) return 'tests_and_fixtures_that_model_subagent_behavior';
  if (normalized.includes('worktree') || matchPattern.includes('parallel'))
    return 'worktree_and_parallel_execution_surfaces';
  if (normalized.includes('governance') || normalized.includes('host'))
    return 'host_worker_adapters';
  return 'code_dispatch_scripts';
}

function linkedEvidenceIds(surface: RegistrySurface | null, excluded: boolean): string[] {
  if (surface || excluded) return ['EVD-044'];
  return [];
}

function buildRows(input: {
  root: string;
  registry: RegistrySurface[];
  scannerConfigHash: string;
  sourceDocumentHash: string;
  implementationConfirmationHash: string;
  architectureConfirmationHash: string;
  includePaths?: string[];
}): InventoryRow[] {
  const rows: InventoryRow[] = [];
  for (const filePath of discoverFiles(input.root, input.includePaths ?? TARGET_PATHS)) {
    let content = '';
    try {
      content = fs.readFileSync(path.resolve(input.root, filePath), 'utf8');
    } catch {
      continue;
    }
    const matches = findMatches(filePath, content);
    if (matches.length === 0) continue;
    const surface = registryForPath(filePath, input.registry);
    const exclusion = surface ? null : exclusionForPath(filePath);
    const first = matches[0];
    const covered = Boolean(surface);
    const excluded = !covered && Boolean(exclusion);
    rows.push({
      surfacePath: filePath,
      matchPattern: first.pattern,
      matchedTextHash: sha256Text(first.line),
      surfaceKind: surface?.surfaceType || surfaceKindForPath(filePath, first.pattern),
      classification: surface?.classification || (excluded ? 'non_control_doc_sample' : 'unknown'),
      registrySurfaceId: surface?.surfaceId ?? '',
      coverageStatus: covered ? 'covered' : excluded ? 'excluded' : 'blocked',
      explicitExclusionReason: exclusion?.reason ?? '',
      exclusionReasonCode: exclusion?.code ?? '',
      canAffectControlFlow: surface?.canAffectControlFlow ?? false,
      requiredEnvelope: surface?.requiredEnvelope ?? false,
      currentAttemptRevalidationRequired: surface?.currentAttemptRevalidationRequired ?? false,
      ownerSubsystem: 'subagent_execution_governance',
      linkedRequirementIds: surface?.linkedRequirements ?? ['MUST-045', 'OUT-028'],
      linkedEvidenceIds: linkedEvidenceIds(surface, excluded),
      scannerConfigHash: input.scannerConfigHash,
      sourceDocumentHash: input.sourceDocumentHash,
      implementationConfirmationHash: input.implementationConfirmationHash,
      architectureConfirmationHash: input.architectureConfirmationHash,
    });
  }
  return rows;
}

function validateRow(
  row: InventoryRow,
  registryIds: Set<string>,
  scannerConfigHash: string
): string[] {
  const issues: string[] = [];
  for (const field of [
    'surfacePath',
    'matchPattern',
    'matchedTextHash',
    'surfaceKind',
    'classification',
    'coverageStatus',
    'ownerSubsystem',
    'scannerConfigHash',
    'sourceDocumentHash',
    'implementationConfirmationHash',
    'architectureConfirmationHash',
  ] as const) {
    if (!text(row[field])) issues.push(`row_field_missing:${row.surfacePath}:${field}`);
  }
  if (!['covered', 'excluded', 'blocked'].includes(row.coverageStatus)) {
    issues.push(`coverage_status_invalid:${row.surfacePath}`);
  }
  if (row.coverageStatus === 'covered') {
    if (!row.registrySurfaceId)
      issues.push(`covered_registry_surface_id_missing:${row.surfacePath}`);
    if (row.registrySurfaceId && !registryIds.has(row.registrySurfaceId)) {
      issues.push(
        `covered_registry_surface_id_unknown:${row.surfacePath}:${row.registrySurfaceId}`
      );
    }
  }
  if (row.coverageStatus === 'excluded') {
    if (!row.explicitExclusionReason) issues.push(`excluded_reason_missing:${row.surfacePath}`);
    if (!ALLOWED_EXCLUSION_CODES.has(row.exclusionReasonCode)) {
      issues.push(
        `excluded_reason_code_invalid:${row.surfacePath}:${row.exclusionReasonCode || '<missing>'}`
      );
    }
  }
  if (row.coverageStatus === 'blocked') issues.push(`inventory_row_blocked:${row.surfacePath}`);
  if (row.canAffectControlFlow && !row.requiredEnvelope) {
    issues.push(`control_flow_without_required_envelope:${row.surfacePath}`);
  }
  if (row.scannerConfigHash !== scannerConfigHash)
    issues.push(`scanner_config_hash_stale:${row.surfacePath}`);
  if (row.coverageStatus === 'covered' && row.linkedRequirementIds.length === 0) {
    issues.push(`linked_requirement_ids_missing:${row.surfacePath}`);
  }
  if (row.linkedEvidenceIds.length === 0)
    issues.push(`linked_evidence_ids_missing:${row.surfacePath}`);
  if (!isSha256(row.matchedTextHash)) issues.push(`matched_text_hash_invalid:${row.surfacePath}`);
  return issues;
}

function validateInventory(input: {
  rows: InventoryRow[];
  registry: RegistrySurface[];
  scannerConfigHash: string;
  registryHash: string;
  sourceDocumentHash: string;
  implementationConfirmationHash: string;
  architectureConfirmationHash: string;
}): string[] {
  const issues: string[] = [];
  const registryIds = new Set(input.registry.map((surface) => surface.surfaceId));
  if (!isSha256(input.scannerConfigHash)) issues.push('scannerConfigHash_missing_or_invalid');
  if (!isSha256(input.registryHash)) issues.push('registryHash_missing_or_invalid');
  if (input.rows.length === 0) issues.push('inventory_rows_missing');
  const counts = input.rows.reduce(
    (acc, row) => {
      acc[row.coverageStatus] += 1;
      return acc;
    },
    { covered: 0, excluded: 0, blocked: 0 } as Record<CoverageStatus, number>
  );
  if (counts.covered + counts.excluded + counts.blocked !== input.rows.length) {
    issues.push('inventory_coverage_counts_mismatch');
  }
  for (const row of input.rows) {
    issues.push(...validateRow(row, registryIds, input.scannerConfigHash));
    if (row.sourceDocumentHash !== input.sourceDocumentHash)
      issues.push(`row_source_hash_mismatch:${row.surfacePath}`);
    if (row.implementationConfirmationHash !== input.implementationConfirmationHash) {
      issues.push(`row_implementation_hash_mismatch:${row.surfacePath}`);
    }
    if (row.architectureConfirmationHash !== input.architectureConfirmationHash) {
      issues.push(`row_architecture_hash_mismatch:${row.surfacePath}`);
    }
  }
  return [...new Set(issues)];
}

function evaluate(input: {
  sourcePath: string;
  recordPath: string;
  outputPath: string;
  generatedAt: string;
  generatedBy: string;
  includePaths?: string[];
}): { decision: Decision; report: JsonObject; inventoryHash: string } {
  const root = process.cwd();
  const record = readJson(input.recordPath);
  const { confirmation, registry } = registryFromSource(input.sourcePath);
  const architectureConfirmationHash = currentArchitectureHash(record);
  const scannerConfigHash = expectedScannerConfigHash(confirmation);
  const registryHash = sha256Text(stableStringify(registry));
  const rows = buildRows({
    root,
    registry,
    scannerConfigHash,
    sourceDocumentHash: text(record.sourceDocumentHash),
    implementationConfirmationHash: text(record.implementationConfirmationHash),
    architectureConfirmationHash,
    includePaths: input.includePaths,
  });
  const blockingIssues = [
    ...registryIssues(root, registry),
    ...validateInventory({
      rows,
      registry,
      scannerConfigHash,
      registryHash,
      sourceDocumentHash: text(record.sourceDocumentHash),
      implementationConfirmationHash: text(record.implementationConfirmationHash),
      architectureConfirmationHash,
    }),
  ];
  const inventory = {
    reportType: 'subagent_surface_inventory',
    schemaVersion: 'subagent-surface-inventory/v1',
    generatedAt: input.generatedAt,
    generatedBy: input.generatedBy,
    recordId: text(record.recordId),
    requirementSetId: text(record.requirementSetId),
    sourceDocumentHash: text(record.sourceDocumentHash),
    implementationConfirmationHash: text(record.implementationConfirmationHash),
    architectureConfirmationHash,
    scannerConfigHash,
    registryHash,
    authority: 'source_document_implementationConfirmation_subagentExecutionSurfaceRegistry',
    controlDecisionAuthority: 'controlled_ingest_contractChecks_only',
    directArtifactJsonControlForbidden: true,
    allowedExclusionReasonCodes: [...ALLOWED_EXCLUSION_CODES],
    scannerConfig: SCANNER_CONFIG,
    registry,
    rows,
    counts: {
      registrySurfaces: registry.length,
      rows: rows.length,
      covered: rows.filter((row) => row.coverageStatus === 'covered').length,
      excluded: rows.filter((row) => row.coverageStatus === 'excluded').length,
      blocked: rows.filter((row) => row.coverageStatus === 'blocked').length,
    },
    blockingIssues: [...new Set(blockingIssues)],
  };
  const inventoryHash = sha256Text(stableStringify(inventory));
  const report = {
    ...inventory,
    inventoryHash,
    decision: blockingIssues.length === 0 ? 'pass' : 'blocked',
  };
  writeJson(input.outputPath, report);
  return {
    decision: report.decision as Decision,
    report,
    inventoryHash: sha256File(input.outputPath),
  };
}

export function runSubagentSurfaceInventory(argv: string[]): number {
  const args = parseArgs(argv);
  if (args.help) {
    console.log(
      'Usage: subagent-surface-inventory --source <md> --requirement-record <json> [--out <json>] [--json]'
    );
    return 0;
  }
  if (!args.source || !args.requirementRecord) {
    throw new Error('subagent-surface-inventory requires --source and --requirement-record');
  }
  const sourcePath = path.resolve(args.source);
  const recordPath = path.resolve(args.requirementRecord);
  const outputPath = path.resolve(args.out ?? defaultInventoryOutputPath(recordPath));
  const generatedAt = args.generatedAt ?? new Date().toISOString();
  const generatedBy = args.generatedBy ?? 'subagent-surface-inventory';
  const result = evaluate({ sourcePath, recordPath, outputPath, generatedAt, generatedBy });
  const output = {
    ok: true,
    reportPath: normalizePathForRecord(outputPath),
    reportHash: result.inventoryHash,
    decision: result.decision,
    registrySurfaces: Number(result.report.counts && nested(result.report.counts).registrySurfaces),
    rows: Number(result.report.counts && nested(result.report.counts).rows),
    blockingIssues: strings(result.report.blockingIssues),
    controlWrite: 'forbidden_use_controlled_ingest',
  };
  process.stdout.write(
    args.json
      ? `${JSON.stringify(output, null, 2)}\n`
      : `subagent_surface_inventory=${result.decision}\n`
  );
  return result.decision === 'pass' ? 0 : 1;
}

export const subagentSurfaceInventoryInternals = {
  buildRows,
  expectedScannerConfigHash,
  registryFromSource,
  validateInventory,
};

if (require.main === module) {
  try {
    process.exitCode = runSubagentSurfaceInventory(process.argv.slice(2));
  } catch (error) {
    console.error(
      JSON.stringify(
        { ok: false, error: error instanceof Error ? error.message : String(error) },
        null,
        2
      )
    );
    process.exitCode = 2;
  }
}
