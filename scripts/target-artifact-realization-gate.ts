/* eslint-disable no-console */
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';
import yaml from 'js-yaml';
import { canonicalizeRequirementRecord } from './requirement-record-control-store';

type Decision = 'pass' | 'blocked';
type TargetKind = 'file_artifact' | 'record_field' | 'event_journal' | 'legacy_policy';
export type JsonObject = Record<string, unknown>;

interface ParsedArgs {
  source?: string;
  requirementRecord?: string;
  attemptId?: string;
  reportPath?: string;
  evaluatedAt?: string;
  evaluatedBy?: string;
  json?: boolean;
  help?: boolean;
}

interface TargetItem {
  id: string;
  aliases?: string[];
  requirementRefs?: string[];
  contractBound?: boolean;
  kind: TargetKind;
  sourceSection: string;
  pathOrField: string;
  expectedSourceOfTruthRole?: string;
  expectedProducer?: string;
  traceRefs: string[];
  evidenceRefs: string[];
  completionProofPolicy?: string;
}

interface GateIssue {
  code: string;
  message: string;
  refs: string[];
}

const SHA256_RE = /^sha256:[a-f0-9]{64}$/u;
const RECORD_PREFIX = 'RequirementRecord.';
const LEGACY_POLICIES = new Set(['legacy_only', 'not_completion_proof']);
const REQUIRED_PROOF_POLICIES = new Set(['required_current_proof']);
const CONFIRMATION_BOOKKEEPING_FIELDS = new Set([
  'status',
  'confirmedAt',
  'confirmedBy',
  'sourceDocumentHash',
  'implementationConfirmationHash',
  'reconfirmationRequest',
  'confirmationRender',
]);

function resolveSkillDir(skillName: string): string {
  const root = process.cwd();
  const home = process.env.USERPROFILE || process.env.HOME || '';
  const packageRoot = path.resolve(__dirname, '..');
  const candidates = [
    path.join(root, '.codex', 'skills', skillName),
    path.join(root, '.cursor', 'skills', skillName),
    path.join(root, '.claude', 'skills', skillName),
    path.join(root, '_bmad', 'skills', skillName),
    path.join(root, '.agents', 'skills', skillName),
    path.join(packageRoot, '.codex', 'skills', skillName),
    path.join(packageRoot, '.cursor', 'skills', skillName),
    path.join(packageRoot, '.claude', 'skills', skillName),
    path.join(packageRoot, '_bmad', 'skills', skillName),
    ...(home
      ? [
          path.join(home, '.codex', 'skills', skillName),
          path.join(home, '.cursor', 'skills', skillName),
          path.join(home, '.claude', 'skills', skillName),
          path.join(home, '.agents', 'skills', skillName),
        ]
      : []),
  ];
  return candidates.find((candidate) => fs.existsSync(path.join(candidate, 'SKILL.md'))) ?? candidates[0];
}

function resolveSkillPlaceholders(value: string): string {
  return value
    .split('<skill-dir>')
    .join(normalizePath(resolveSkillDir('requirements-contract-authoring')))
    .split('<encoding-integrity-guardian-dir>')
    .join(normalizePath(resolveSkillDir('encoding-integrity-guardian')));
}

function resolveLogicalSkillRef(value: string): string {
  const match = /^skill:\/\/([^/]+)\/(.+)$/u.exec(value);
  if (!match) return value;
  return path.join(resolveSkillDir(match[1]), match[2]);
}

function parseArgs(argv: string[]): ParsedArgs {
  const out: ParsedArgs = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help' || arg === '-h') out.help = true;
    else if (arg === '--json') out.json = true;
    else if (arg.startsWith('--')) {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) throw new Error(`Missing value for ${arg}`);
      (out as Record<string, string | boolean | undefined>)[
        arg.slice(2).replace(/-([a-z])/gu, (_, letter: string) => letter.toUpperCase())
      ] = value;
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

function issue(code: string, message: string, refs: string[] = []): GateIssue {
  return { code, message, refs };
}

function normalizePath(value: string): string {
  return value.replace(/\\/gu, '/');
}

function repoPath(value: string): string {
  return normalizePath(path.isAbsolute(value) ? value : path.resolve(value));
}

function sha256Bytes(value: Buffer | string): string {
  return `sha256:${crypto.createHash('sha256').update(value).digest('hex')}`;
}

function sha256File(file: string): string {
  return sha256Bytes(fs.readFileSync(file));
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (!value || typeof value !== 'object') return JSON.stringify(value);
  const entries = Object.entries(value as JsonObject)
    .filter(([, item]) => item !== undefined)
    .sort(([left], [right]) => left.localeCompare(right));
  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(',')}}`;
}

function readJson(file: string): JsonObject {
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
    throw new Error(`JSON object expected: ${file}`);
  return parsed as JsonObject;
}

function readJsonl(file: string): JsonObject[] {
  if (!fs.existsSync(file)) return [];
  const content = fs.readFileSync(file, 'utf8').trim();
  return content ? content.split(/\r?\n/u).map((line) => JSON.parse(line) as JsonObject) : [];
}

function asObject(value: unknown): JsonObject | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonObject)
    : undefined;
}

export function extractImplementationConfirmation(sourceText: string): {
  confirmation: JsonObject;
  blockText: string;
} {
  const fenced = [...sourceText.matchAll(/```yaml\s*\n([\s\S]*?)```/giu)];
  for (const match of fenced) {
    const parsed = asObject(yaml.load(match[1]));
    const confirmation = asObject(parsed?.implementationConfirmation);
    if (confirmation) return { confirmation, blockText: match[1] };
  }

  const lines = sourceText.replace(/\r\n/gu, '\n').split('\n');
  const start = lines.findIndex((line) => /^implementationConfirmation:\s*$/u.test(line));
  if (start < 0) throw new Error('missing implementationConfirmation block');
  let end = lines.length;
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.trim() === '') continue;
    if (/^\S/u.test(line) && !/^implementationConfirmation:\s*$/u.test(line)) {
      end = index;
      break;
    }
  }
  const blockText = lines.slice(start, end).join('\n');
  const parsed = asObject(yaml.load(blockText));
  const confirmation = asObject(parsed?.implementationConfirmation);
  if (!confirmation) throw new Error('implementationConfirmation block is not valid YAML');
  return { confirmation, blockText };
}

export function readImplementationConfirmation(sourcePath: string): {
  confirmation: JsonObject;
  blockText: string;
  sourceText: string;
  sourcePath: string;
} {
  const absolute = path.resolve(sourcePath);
  const sourceText = fs.readFileSync(absolute, 'utf8');
  const extracted = extractImplementationConfirmation(sourceText);
  return { ...extracted, sourceText, sourcePath: absolute };
}

export function implementationConfirmationHash(confirmation: JsonObject): string {
  return sha256Bytes(stableStringify(semanticConfirmationForHash(confirmation)));
}

function semanticConfirmationForHash(confirmation: JsonObject): JsonObject {
  const semantic: JsonObject = {};
  for (const [key, value] of Object.entries(confirmation)) {
    if (!CONFIRMATION_BOOKKEEPING_FIELDS.has(key)) semantic[key] = value;
  }
  return semantic;
}

function fieldValue(root: JsonObject, fieldPath: string): unknown {
  const parts = fieldPath.split('.').filter(Boolean);
  let current: unknown = root;
  for (const part of parts) {
    if (!current || typeof current !== 'object' || Array.isArray(current)) return undefined;
    current = (current as JsonObject)[part];
  }
  return current;
}

function hasValue(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0;
  if (value && typeof value === 'object') return Object.keys(value as JsonObject).length > 0;
  return text(value).length > 0 || typeof value === 'boolean' || typeof value === 'number';
}

function isPathLike(value: string): boolean {
  return /[\\/]/u.test(value) || /\.[a-z0-9]{1,8}$/iu.test(value);
}

function replaceKnownPlaceholders(value: string, record: JsonObject, attemptId: string): string {
  return value
    .replace(/<requirement-set-id>/gu, text(record.requirementSetId) || text(record.recordId))
    .replace(/<record-id>/gu, text(record.recordId))
    .replace(/<closeout-attempt-id>/gu, attemptId)
    .replace(/<attempt-id>/gu, attemptId);
}

function templateToRegExp(value: string, record: JsonObject, attemptId: string): RegExp {
  const replaced = replaceKnownPlaceholders(normalizePath(value), record, attemptId);
  const escaped = replaced.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&').replace(/<[^>]+>/gu, '[^/]+');
  return new RegExp(`(^|/)${escaped}$`, 'u');
}

function resolveDeclaredPath(
  value: string,
  record: JsonObject,
  attemptId: string
): { displayPath: string; absolutePath?: string; pattern?: RegExp } {
  const replaced = replaceKnownPlaceholders(value, record, attemptId);
  if (/<[^>]+>/u.test(replaced)) {
    return {
      displayPath: normalizePath(replaced),
      pattern: templateToRegExp(value, record, attemptId),
    };
  }
  return {
    displayPath: normalizePath(replaced),
    absolutePath: path.isAbsolute(replaced) ? replaced : path.resolve(replaced),
  };
}

function collectLinkedIds(row: JsonObject): { traceRefs: string[]; evidenceRefs: string[]; requirementRefs: string[] } {
  const raw = [
    ...strings(row.traceRows),
    ...strings(row.traceRefs),
    ...strings(row.evidenceRefs),
    ...strings(row.linkedRequirementIds),
    ...strings(row.linkedRequirements),
    ...strings(row.linkedEvidenceIds),
    ...strings(row.relatedRequirementIds),
    text(row.derivedFromMustRef),
    ...strings(row.linkedIds),
  ];
  return {
    traceRefs: [...new Set(raw.filter((id) => /^TRACE-/u.test(id)))],
    evidenceRefs: [...new Set(raw.filter((id) => /^EVD-/u.test(id)))],
    requirementRefs: [...new Set(raw.filter((id) => /^(?:MUST|NEG|OUT)-/u.test(id)))],
  };
}

function pushTarget(targets: TargetItem[], item: TargetItem): void {
  item.aliases = [...new Set([item.id, item.pathOrField, ...(item.aliases ?? [])].filter(Boolean))];
  const key = `${item.kind}:${item.pathOrField}:${item.completionProofPolicy ?? ''}`;
  const existing = targets.find(
    (target) =>
      `${target.kind}:${target.pathOrField}:${target.completionProofPolicy ?? ''}` === key
  );
  if (!existing) {
    targets.push(item);
    return;
  }
  existing.aliases = [...new Set([...(existing.aliases ?? []), ...(item.aliases ?? [])].filter(Boolean))];
  existing.id = existing.id || item.id;
  existing.traceRefs = [...new Set([...existing.traceRefs, ...item.traceRefs])];
  existing.evidenceRefs = [...new Set([...existing.evidenceRefs, ...item.evidenceRefs])];
  existing.requirementRefs = [...new Set([...(existing.requirementRefs ?? []), ...(item.requirementRefs ?? [])])];
  existing.contractBound = existing.contractBound === true || item.contractBound === true;
  existing.expectedProducer = existing.expectedProducer || item.expectedProducer;
  existing.expectedSourceOfTruthRole =
    existing.expectedSourceOfTruthRole || item.expectedSourceOfTruthRole;
}

function contractBound(row: JsonObject, sourceSection: string): boolean {
  return (
    sourceSection.startsWith('currentTargetMap.') ||
    Boolean(text(row.projectionStatus)) ||
    Boolean(text(row.derivedFromMustRef)) ||
    strings(row.linkedRequirements).length > 0 ||
    strings(row.linkedRequirementIds).length > 0 ||
    strings(row.relatedRequirementIds).length > 0
  );
}

function requirementLinkResolver(
  confirmation: JsonObject
): (links: { traceRefs: string[]; evidenceRefs: string[]; requirementRefs: string[] }) => {
  traceRefs: string[];
  evidenceRefs: string[];
  requirementRefs: string[];
} {
  const traceRefsByRequirement = new Map<string, string[]>();
  const evidenceRefsByRequirement = new Map<string, string[]>();
  const traceRefsByEvidence = new Map<string, string[]>();
  const add = (map: Map<string, string[]>, key: string, values: string[]): void => {
    if (!key || values.length === 0) return;
    map.set(key, [...new Set([...(map.get(key) ?? []), ...values])]);
  };
  for (const row of [...objects(confirmation.must), ...objects(confirmation.notDone), ...objects(confirmation.mustNot)]) {
    const id = text(row.id);
    add(traceRefsByRequirement, id, [
      ...strings(row.coveredByTraceRows),
      ...strings(row.traceRows),
      ...strings(row.traceRefs),
    ]);
    add(evidenceRefsByRequirement, id, [...strings(row.evidenceRefs), ...strings(row.linkedEvidenceIds)]);
  }
  for (const trace of objects(confirmation.traceRows)) {
    const traceId = text(trace.id);
    if (!traceId) continue;
    for (const requirementId of strings(trace.covers)) {
      add(traceRefsByRequirement, requirementId, [traceId]);
      add(evidenceRefsByRequirement, requirementId, strings(trace.evidenceRefs));
    }
    for (const evidenceId of strings(trace.evidenceRefs)) {
      add(traceRefsByEvidence, evidenceId, [traceId]);
    }
  }
  for (const command of objects(confirmation.requiredCommands)) {
    const commandTraceRefs = strings(command.traceRows).concat(strings(command.traceRefs));
    for (const evidenceId of strings(command.evidenceRefs)) {
      add(traceRefsByEvidence, evidenceId, commandTraceRefs);
    }
  }
  for (const evidence of objects(confirmation.evidence)) {
    const evidenceId = text(evidence.id);
    const requirementRefs = [
      ...strings(evidence.linkedRequirementIds),
      ...strings(evidence.linkedRequirements),
      text(evidence.derivedFromMustRef),
    ].filter((id) => /^(?:MUST|NEG|OUT)-/u.test(id));
    add(traceRefsByEvidence, evidenceId, requirementRefs.flatMap((id) => traceRefsByRequirement.get(id) ?? []));
  }
  return (links) => {
    const derivedTraceRefs = links.requirementRefs.flatMap((id) => traceRefsByRequirement.get(id) ?? []);
    const evidenceTraceRefs = links.evidenceRefs.flatMap((id) => traceRefsByEvidence.get(id) ?? []);
    const derivedEvidenceRefs = links.requirementRefs.flatMap((id) => evidenceRefsByRequirement.get(id) ?? []);
    return {
      traceRefs: [...new Set([...links.traceRefs, ...derivedTraceRefs, ...evidenceTraceRefs])],
      evidenceRefs: [...new Set([...links.evidenceRefs, ...derivedEvidenceRefs])],
      requirementRefs: links.requirementRefs,
    };
  };
}

function artifactPlanRowDefinesTargetSurface(row: JsonObject): boolean {
  const role = text(row.sourceOfTruthRole);
  const artifactType = text(row.artifactType);
  return (
    role === 'implementation' ||
    role === 'control' ||
    role === 'projection' ||
    role === 'generator_self_audit' ||
    role === 'self_audit_receipt' ||
    role === 'compatibility_launcher' ||
    role === 'acceptance_oracle' ||
    role === 'evidence' ||
    role === 'current_attempt_command_evidence' ||
    role === 'failure_evidence_not_completion_proof' ||
    role === 'controlled_ingest_input' ||
    role === 'post_closeout_review_evidence' ||
    role === 'manifest_gate_oracle' ||
    role === 'contract_manifest_standard' ||
    role === 'execution_authority' ||
    row.canAffectControlFlow === true ||
    /^(?:code|script|hook|test|config|schema|control_record|execution_packet|prompt_projection|generator_receipt|gate|report|test_report|quality_report|render_report|evidence_bundle|failed_evidence_packet|implementation_evidence_packet|html_projection)$/iu.test(artifactType)
  );
}

export function deriveTargetArtifactChecklist(confirmation: JsonObject): TargetItem[] {
  const targets: TargetItem[] = [];
  const resolveLinks = requirementLinkResolver(confirmation);

  for (const row of objects(confirmation.artifactAutomationPlan)) {
    if (!artifactPlanRowDefinesTargetSurface(row)) continue;
    const sourceSection = 'artifactAutomationPlan';
    const id = text(row.id) || text(row.artifactId) || `artifactAutomationPlan:${targets.length + 1}`;
    const links = resolveLinks(collectLinkedIds(row));
    const rowPath = text(row.path);
    if (rowPath) {
      pushTarget(targets, {
        id,
        kind: rowPath.endsWith('control-events.jsonl') ? 'event_journal' : 'file_artifact',
        sourceSection,
        pathOrField: rowPath,
        expectedProducer: text(row.producer),
        expectedSourceOfTruthRole: text(row.sourceOfTruthRole),
        traceRefs: links.traceRefs,
        evidenceRefs: links.evidenceRefs,
        requirementRefs: links.requirementRefs,
        contractBound: contractBound(row, sourceSection),
      });
    }
    if (text(row.artifactType) === 'control_record') {
      const outputSourceSection = 'artifactAutomationPlan.outputArtifacts';
      for (const output of strings(row.outputArtifacts)) {
        if (output && !isPathLike(output)) {
          pushTarget(targets, {
            id: `${id}:${output}`,
            kind: 'record_field',
            sourceSection: outputSourceSection,
            pathOrField: output.startsWith(RECORD_PREFIX) ? output : `${RECORD_PREFIX}${output}`,
            traceRefs: links.traceRefs,
            evidenceRefs: links.evidenceRefs,
            requirementRefs: links.requirementRefs,
            contractBound: contractBound(row, outputSourceSection),
          });
        }
      }
    }
  }

  const currentTargetMap = nested(confirmation.currentTargetMap);
  for (const row of objects(currentTargetMap.canonicalArtifacts)) {
    const sourceSection = 'currentTargetMap.canonicalArtifacts';
    const id =
      text(row.id) || text(row.targetPathOrField) || `canonicalArtifacts:${targets.length + 1}`;
    const pathOrField = text(row.targetPathOrField);
    if (!pathOrField) continue;
    const links = resolveLinks(collectLinkedIds(row));
    pushTarget(targets, {
      id,
      kind: pathOrField.startsWith(RECORD_PREFIX)
        ? 'record_field'
        : pathOrField.endsWith('control-events.jsonl')
          ? 'event_journal'
          : 'file_artifact',
      sourceSection,
      pathOrField,
      traceRefs: links.traceRefs,
      evidenceRefs: links.evidenceRefs,
      requirementRefs: links.requirementRefs,
      contractBound: contractBound(row, sourceSection),
    });
  }

  for (const row of [
    ...objects(currentTargetMap.pathRegistry),
    ...objects(currentTargetMap.artifactPaths),
  ]) {
    const declaredPath = text(row.fixedPath) || text(row.path);
    if (!declaredPath) continue;
    const sourceSection = text(row.fixedPath)
      ? 'currentTargetMap.pathRegistry'
      : 'currentTargetMap.artifactPaths';
    const links = resolveLinks(collectLinkedIds(row));
    pushTarget(targets, {
      id: text(row.id) || text(row.category) || declaredPath,
      kind: declaredPath.endsWith('control-events.jsonl') ? 'event_journal' : 'file_artifact',
      sourceSection,
      pathOrField: declaredPath,
      expectedSourceOfTruthRole: text(row.sourceOfTruthRole) || text(row.targetRole),
      traceRefs: links.traceRefs,
      evidenceRefs: links.evidenceRefs,
      requirementRefs: links.requirementRefs,
      contractBound: contractBound(row, sourceSection),
    });
  }

  for (const row of objects(currentTargetMap.existingArtifacts)) {
    const sourceSection = 'currentTargetMap.existingArtifacts';
    const currentPath = text(row.currentPath);
    if (!currentPath) continue;
    const policy = text(row.completionProofPolicy);
    const links = resolveLinks(collectLinkedIds(row));
    if (LEGACY_POLICIES.has(policy)) {
      pushTarget(targets, {
        id: text(row.id) || currentPath,
        kind: 'legacy_policy',
        sourceSection,
        pathOrField: currentPath,
        completionProofPolicy: policy,
        traceRefs: links.traceRefs,
        evidenceRefs: links.evidenceRefs,
        requirementRefs: links.requirementRefs,
        contractBound: contractBound(row, sourceSection),
      });
    } else if (REQUIRED_PROOF_POLICIES.has(policy) && isPathLike(currentPath)) {
      pushTarget(targets, {
        id: text(row.id) || currentPath,
        kind: 'file_artifact',
        sourceSection,
        pathOrField: currentPath,
        completionProofPolicy: policy,
        traceRefs: links.traceRefs,
        evidenceRefs: links.evidenceRefs,
        requirementRefs: links.requirementRefs,
        contractBound: contractBound(row, sourceSection),
      });
    }
  }

  return targets;
}

function eventLogPath(recordPath: string, record: JsonObject): string {
  const fromStore = text(nested(record.controlStore).eventLogPath);
  if (!fromStore) return path.join(path.dirname(recordPath), 'events', 'control-events.jsonl');
  return path.isAbsolute(fromStore) ? fromStore : path.resolve(fromStore);
}

function commandRunsForAttempt(record: JsonObject, attemptId: string): JsonObject[] {
  return objects(record.executionIterations).flatMap((iteration) =>
    objects(iteration.commandRunRefs)
      .filter((run) => text(run.closeoutAttemptId) === attemptId)
      .map((run) => ({ ...run, executionIterationId: text(iteration.executionIterationId) }))
  );
}

function artifactPathMatches(
  item: JsonObject,
  declared: { displayPath: string; absolutePath?: string; pattern?: RegExp }
): boolean {
  const artifactPath = normalizePath(text(item.path));
  if (!artifactPath) return false;
  if (declared.pattern) return declared.pattern.test(artifactPath);
  const wanted = normalizePath(declared.absolutePath ?? declared.displayPath);
  return (
    artifactPath === wanted ||
    repoPath(artifactPath) === repoPath(wanted) ||
    normalizePath(path.resolve(artifactPath)) === repoPath(wanted)
  );
}

function artifactIndexEntry(
  record: JsonObject,
  declared: { displayPath: string; absolutePath?: string; pattern?: RegExp }
): JsonObject | undefined {
  return objects(record.artifactIndex).find((item) => artifactPathMatches(item, declared));
}

function artifactBoundToAttempt(
  record: JsonObject,
  entry: JsonObject | undefined,
  attemptId: string,
  events: JsonObject[]
): boolean {
  if (!entry) return false;
  const artifactPath = normalizePath(text(entry.path));
  const artifactHash = text(entry.contentHash ?? entry.hash);
  if (
    text(entry.closeoutAttemptId) === attemptId ||
    text(nested(entry.lastRunRef).closeoutAttemptId) === attemptId
  )
    return true;
  const commandRefs = commandRunsForAttempt(record, attemptId);
  if (
    commandRefs.some(
      (run) => text(run.artifactPath) === artifactPath || text(run.artifactHash) === artifactHash
    )
  )
    return true;
  for (const command of objects(nested(record.deliveryEvidence).requiredCommands)) {
    const selected =
      text(command.closeoutAttemptId) === attemptId ||
      text(nested(command.lastRunRef).closeoutAttemptId) === attemptId ||
      objects(command.commandRunRefs).some((run) => text(run.closeoutAttemptId) === attemptId);
    if (!selected) continue;
    const refs = [...objects(command.artifactRefs), ...objects(command.extensionRefs)];
    if (
      refs.some(
        (ref) =>
          normalizePath(text(ref.path)) === artifactPath ||
          text(ref.contentHash ?? ref.hash) === artifactHash
      )
    )
      return true;
  }
  return events.some((event) => {
    const packet = nested(nested(event.payload).packet);
    const eventAttempt = text(packet.closeoutAttemptId) || text(nested(event.payload).attemptId);
    if (eventAttempt !== attemptId) return false;
    const refs = [
      ...objects(packet.artifactRefs),
      ...objects(packet.extensionRefs),
      ...objects(nested(event.payload).artifactRefs),
    ];
    return refs.some(
      (ref) =>
        normalizePath(text(ref.path)) === artifactPath ||
        text(ref.contentHash ?? ref.hash) === artifactHash
    );
  });
}

function artifactLinksPresent(entry: JsonObject | undefined, target: TargetItem): string[] {
  if (!entry) return [];
  const linked = [
    ...strings(entry.relatedRequirementIds),
    ...strings(entry.traceRows),
    ...strings(entry.evidenceRefs),
    ...strings(entry.linkedEvidenceIds),
    ...strings(entry.linkedRequirementIds),
  ];
  const issues: string[] = [];
  if (target.traceRefs.length > 0 && !target.traceRefs.some((id) => linked.includes(id)))
    issues.push('target_artifact_trace_binding_missing');
  if (target.evidenceRefs.length > 0 && !target.evidenceRefs.some((id) => linked.includes(id)))
    issues.push('target_artifact_evidence_binding_missing');
  return issues;
}

function validateFileTarget(input: {
  target: TargetItem;
  record: JsonObject;
  recordPath: string;
  attemptId: string;
  events: JsonObject[];
}): GateIssue[] {
  const issues: GateIssue[] = [];
  const declared = resolveDeclaredPath(input.target.pathOrField, input.record, input.attemptId);
  const concreteFile = declared.absolutePath;
  const exists = concreteFile ? fs.existsSync(concreteFile) : false;
  const entry = artifactIndexEntry(input.record, declared);
  if (!exists && !entry) {
    issues.push(
      issue(
        'target_artifact_missing',
        `${input.target.pathOrField} does not exist and has no artifactIndex match`,
        [input.target.id]
      )
    );
  }
  if (!entry) {
    issues.push(
      issue(
        'target_artifact_index_missing',
        `${input.target.pathOrField} missing from artifactIndex`,
        [input.target.id]
      )
    );
    return issues;
  }
  const hash = text(entry.contentHash ?? entry.hash);
  if (!hash)
    issues.push(
      issue(
        'target_artifact_hash_missing',
        `${input.target.pathOrField} artifactIndex hash missing`,
        [input.target.id]
      )
    );
  else if (!SHA256_RE.test(hash))
    issues.push(
      issue(
        'target_artifact_hash_invalid',
        `${input.target.pathOrField} artifactIndex hash is not sha256`,
        [input.target.id]
      )
    );
  else if (concreteFile && exists && sha256File(concreteFile) !== hash) {
    issues.push(
      issue(
        'target_artifact_hash_mismatch',
        `${input.target.pathOrField} hash does not match file content`,
        [input.target.id]
      )
    );
  }
  if (!text(entry.producer))
    issues.push(
      issue(
        'target_artifact_producer_missing',
        `${input.target.pathOrField} artifactIndex producer missing`,
        [input.target.id]
      )
    );
  if (!text(entry.sourceOfTruthRole)) {
    issues.push(
      issue(
        'target_artifact_source_of_truth_role_missing',
        `${input.target.pathOrField} artifactIndex sourceOfTruthRole missing`,
        [input.target.id]
      )
    );
  } else if (
    input.target.expectedSourceOfTruthRole &&
    text(entry.sourceOfTruthRole) !== input.target.expectedSourceOfTruthRole
  ) {
    issues.push(
      issue(
        'target_artifact_source_of_truth_role_mismatch',
        `${input.target.pathOrField} sourceOfTruthRole ${text(entry.sourceOfTruthRole)} does not match ${input.target.expectedSourceOfTruthRole}`,
        [input.target.id]
      )
    );
  }
  issues.push(
    ...artifactLinksPresent(entry, input.target).map((code) =>
      issue(code, `${input.target.pathOrField} missing declared TRACE/EVD binding`, [
        input.target.id,
      ])
    )
  );
  if (!artifactBoundToAttempt(input.record, entry, input.attemptId, input.events)) {
    issues.push(
      issue(
        'target_artifact_attempt_binding_missing',
        `${input.target.pathOrField} not bound to current attempt ${input.attemptId}`,
        [input.target.id]
      )
    );
  }
  return issues;
}

function recordFieldBoundToAttempt(
  record: JsonObject,
  target: TargetItem,
  attemptId: string,
  events: JsonObject[]
): boolean {
  if (target.traceRefs.length === 0 && target.evidenceRefs.length === 0) return true;
  const expected = new Set([...target.traceRefs, ...target.evidenceRefs]);
  for (const iteration of objects(record.executionIterations)) {
    const runs = objects(iteration.commandRunRefs);
    if (!runs.some((run) => text(run.closeoutAttemptId) === attemptId)) continue;
    const ids = [
      ...strings(iteration.traceRows),
      ...strings(iteration.evidenceRefs),
      ...strings(iteration.coveredRequirementIds),
    ];
    if (ids.some((id) => expected.has(id))) return true;
  }
  return events.some((event) => {
    const packet = nested(nested(event.payload).packet);
    const eventAttempt = text(packet.closeoutAttemptId) || text(nested(event.payload).attemptId);
    if (eventAttempt !== attemptId) return false;
    const ids = [
      ...strings(packet.traceRows),
      ...strings(packet.evidenceRefs),
      ...strings(packet.relatedRequirementIds),
      ...strings(nested(event.payload).traceRows),
      ...strings(nested(event.payload).evidenceRefs),
    ];
    return ids.some((id) => expected.has(id));
  });
}

function validateRecordFieldTarget(
  target: TargetItem,
  record: JsonObject,
  attemptId: string,
  events: JsonObject[]
): GateIssue[] {
  const fieldPath = target.pathOrField.startsWith(RECORD_PREFIX)
    ? target.pathOrField.slice(RECORD_PREFIX.length)
    : target.pathOrField;
  const issues: GateIssue[] = [];
  if (!hasValue(fieldValue(record, fieldPath))) {
    issues.push(
      issue(
        'target_record_field_missing',
        `${target.pathOrField} missing or empty in requirement record`,
        [target.id]
      )
    );
  }
  if (!recordFieldBoundToAttempt(record, target, attemptId, events)) {
    issues.push(
      issue(
        'target_record_field_attempt_binding_missing',
        `${target.pathOrField} lacks current-attempt TRACE/EVD binding`,
        [target.id]
      )
    );
  }
  return issues;
}

function legacyUsedAsCompletionProof(
  record: JsonObject,
  token: string,
  events: JsonObject[]
): boolean {
  const haystack = [
    text(record.lastEventType),
    ...events.map((event) => text(event.eventType)),
    ...objects(record.requirementClosures).flatMap((closure) => [
      text(closure.status) === 'pass' ? JSON.stringify(closure) : '',
    ]),
    ...objects(nested(record.deliveryEvidence).requiredCommands).map((command) =>
      JSON.stringify(command)
    ),
  ].join('\n');
  return haystack.includes(token);
}

function validateLegacyPolicyTarget(
  target: TargetItem,
  record: JsonObject,
  events: JsonObject[]
): GateIssue[] {
  if (
    target.completionProofPolicy &&
    LEGACY_POLICIES.has(target.completionProofPolicy) &&
    legacyUsedAsCompletionProof(record, target.pathOrField, events)
  ) {
    return [
      issue(
        'legacy_artifact_used_as_completion_proof',
        `${target.pathOrField} is declared ${target.completionProofPolicy} but appears in completion proof surfaces`,
        [target.id]
      ),
    ];
  }
  return [];
}

export function evaluateTargetArtifactRealization(input: {
  sourcePath: string;
  record: JsonObject;
  recordPath: string;
  attemptId: string;
  evaluatedAt?: string;
  evaluatedBy?: string;
}): JsonObject {
  const source = readImplementationConfirmation(input.sourcePath);
  const confirmation = source.confirmation;
  const eventPath = eventLogPath(input.recordPath, input.record);
  const events = readJsonl(eventPath);
  const targets = deriveTargetArtifactChecklist(confirmation);
  const issues: GateIssue[] = [];
  if (text(confirmation.status) !== 'user_confirmed') {
    issues.push(
      issue(
        'source_implementation_confirmation_not_user_confirmed',
        `implementationConfirmation.status=${text(confirmation.status) || '<missing>'}`,
        ['implementationConfirmation.status']
      )
    );
  }
  const expectedHash = text(input.record.implementationConfirmationHash);
  const actualHash = implementationConfirmationHash(confirmation);
  if (expectedHash && expectedHash !== actualHash) {
    issues.push(
      issue(
        'implementation_confirmation_hash_mismatch',
        `record hash ${expectedHash} does not match source ${actualHash}`,
        ['implementationConfirmationHash']
      )
    );
  }
  for (const target of targets) {
    if (target.kind === 'record_field')
      issues.push(...validateRecordFieldTarget(target, input.record, input.attemptId, events));
    else if (target.kind === 'legacy_policy')
      issues.push(...validateLegacyPolicyTarget(target, input.record, events));
    else
      issues.push(
        ...validateFileTarget({
          target,
          record: input.record,
          recordPath: input.recordPath,
          attemptId: input.attemptId,
          events,
        })
      );
  }
  const blockingReasons = [...new Set(issues.map((item) => item.code))];
  return {
    reportType: 'target_artifact_realization_report',
    generatedAt: input.evaluatedAt ?? new Date().toISOString(),
    generatedBy: input.evaluatedBy ?? 'agent',
    sourcePath: normalizePath(source.sourcePath),
    currentAttemptId: input.attemptId,
    decision: blockingReasons.length === 0 ? 'pass' : 'blocked',
    blockingReasons,
    implementationConfirmationHash: actualHash,
    targetCount: targets.length,
    targets,
    issues,
  };
}

function extractCommandFileRefs(command: string): string[] {
  const refs = new Set<string>();
  const normalized = resolveSkillPlaceholders(command).replace(/\r?\n/gu, ' ');
  const matches = normalized.matchAll(
    /(?<![A-Za-z0-9_@.-])((?:[A-Za-z]:)?[./\\A-Za-z0-9_-][A-Za-z0-9_./\\-]*\.(?:test|spec)\.(?:tsx|ts|jsx|js|mjs|cjs)|[./\\A-Za-z0-9_-][A-Za-z0-9_./\\-]*\.(?:tsx|ts|jsx|json|mjs|cjs|js|ya?ml|md))(?=$|[^A-Za-z0-9_.-])/giu
  );
  for (const match of matches) {
    const ref = match[1];
    if (/[\\/]/u.test(ref) || /\.(?:test|spec)\./iu.test(ref)) refs.add(ref);
  }
  return [...refs];
}

function commandFileExists(ref: string): { absolutePath: string; exists: boolean } {
  const resolved = resolveLogicalSkillRef(resolveSkillPlaceholders(ref));
  const absolute = path.isAbsolute(resolved) ? resolved : path.resolve(resolved);
  return { absolutePath: absolute, exists: fs.existsSync(absolute) };
}

export function evaluateRequiredCommandFileExistence(input: {
  sourcePath: string;
  evaluatedAt?: string;
  evaluatedBy?: string;
}): JsonObject {
  const { confirmation, sourcePath } = readImplementationConfirmation(input.sourcePath);
  const issues: GateIssue[] = [];
  const checkedFiles: JsonObject[] = [];
  for (const command of objects(confirmation.requiredCommands)) {
    const commandId = text(command.id) || text(command.commandId) || '<missing-command-id>';
    for (const ref of extractCommandFileRefs(text(command.command))) {
      const { absolutePath, exists } = commandFileExists(ref);
      checkedFiles.push({
        commandId,
        path: normalizePath(ref),
        absolutePath: normalizePath(absolutePath),
        exists,
      });
      if (!exists)
        issues.push(
          issue('required_command_file_missing', `${commandId} references missing file ${ref}`, [
            commandId,
            ref,
          ])
        );
    }
  }
  const blockingReasons = [...new Set(issues.map((item) => item.code))];
  return {
    reportType: 'required_command_file_existence_report',
    generatedAt: input.evaluatedAt ?? new Date().toISOString(),
    generatedBy: input.evaluatedBy ?? 'agent',
    sourcePath: normalizePath(sourcePath),
    decision: blockingReasons.length === 0 ? 'pass' : 'blocked',
    blockingReasons,
    checkedFiles,
    issues,
  };
}

function declaredRecordFields(confirmation: JsonObject): string[] {
  const fields = new Set<string>();
  for (const target of deriveTargetArtifactChecklist(confirmation)) {
    if (target.kind === 'record_field') {
      fields.add(
        target.pathOrField.startsWith(RECORD_PREFIX)
          ? target.pathOrField.slice(RECORD_PREFIX.length).split('.')[0]
          : target.pathOrField.split('.')[0]
      );
    }
  }
  for (const eventType of objects(confirmation.governanceEventTypeRegistry)) {
    for (const field of strings(eventType.writesControlFields)) fields.add(field.split('.')[0]);
  }
  return [...fields].filter(Boolean).sort();
}

export function evaluateCanonicalSchemaReducerGate(input: {
  sourcePath: string;
  record?: JsonObject;
  evaluatedAt?: string;
  evaluatedBy?: string;
}): JsonObject {
  const { confirmation, sourcePath } = readImplementationConfirmation(input.sourcePath);
  const fields = declaredRecordFields(confirmation);
  const schemaPath = path.resolve('_bmad/_schemas/requirement-record.schema.json');
  const reducerPath = path.resolve('scripts/requirement-record-control-store.ts');
  const schemaText = fs.existsSync(schemaPath) ? fs.readFileSync(schemaPath, 'utf8') : '';
  const reducerText = fs.existsSync(reducerPath) ? fs.readFileSync(reducerPath, 'utf8') : '';
  const issues: GateIssue[] = [];
  for (const field of fields) {
    if (!schemaText.includes(`"${field}"`))
      issues.push(
        issue('canonical_schema_field_missing', `${field} missing from requirement-record schema`, [
          field,
          normalizePath(schemaPath),
        ])
      );
    if (!reducerText.includes(`'${field}'`) && !reducerText.includes(`"${field}"`)) {
      issues.push(
        issue(
          'canonical_reducer_field_missing',
          `${field} missing from control-store reducer allowlist`,
          [field, normalizePath(reducerPath)]
        )
      );
    }
  }
  if (input.record && fields.length > 0) {
    const sentinel = Object.fromEntries(fields.map((field) => [field, [{ sentinel: field }]]));
    const reduced = canonicalizeRequirementRecord({
      ...input.record,
      recordId: text(input.record.recordId) || 'REQ-FIXTURE',
      ...sentinel,
    });
    for (const field of fields) {
      if (!hasValue(reduced[field]))
        issues.push(
          issue(
            'canonical_reducer_replay_field_dropped',
            `${field} was dropped by canonical reducer replay`,
            [field]
          )
        );
    }
  }
  const blockingReasons = [...new Set(issues.map((item) => item.code))];
  return {
    reportType: 'canonical_schema_reducer_report',
    generatedAt: input.evaluatedAt ?? new Date().toISOString(),
    generatedBy: input.evaluatedBy ?? 'agent',
    sourcePath: normalizePath(sourcePath),
    decision: blockingReasons.length === 0 ? 'pass' : 'blocked',
    blockingReasons,
    declaredRecordFields: fields,
    issues,
  };
}

export function evaluateCanonicalEventRegistryGate(input: {
  sourcePath: string;
  recordPath?: string;
  evaluatedAt?: string;
  evaluatedBy?: string;
}): JsonObject {
  const { confirmation, sourcePath } = readImplementationConfirmation(input.sourcePath);
  const issues: GateIssue[] = [];
  const eventRows = objects(confirmation.governanceEventTypeRegistry);
  for (const row of eventRows) {
    const eventType = text(row.eventType);
    if (!eventType) {
      issues.push(
        issue('canonical_event_type_missing', 'governanceEventTypeRegistry row missing eventType')
      );
      continue;
    }
    if (!text(row.payloadKind))
      issues.push(
        issue('canonical_event_payload_kind_missing', `${eventType} missing payloadKind`, [
          eventType,
        ])
      );
    const contract = nested(row.payloadContract);
    if (Object.keys(contract).length === 0)
      issues.push(
        issue('canonical_event_payload_contract_missing', `${eventType} missing payloadContract`, [
          eventType,
        ])
      );
    if (!text(contract.allowedControlWriteMode)) {
      issues.push(
        issue(
          'canonical_event_write_mode_missing',
          `${eventType} missing payloadContract.allowedControlWriteMode`,
          [eventType]
        )
      );
    }
    if (
      strings(row.writesControlFields).length > 0 &&
      strings(row.allowedWriterRefs).length === 0
    ) {
      issues.push(
        issue(
          'canonical_event_writer_refs_missing',
          `${eventType} writes control fields but has no allowedWriterRefs`,
          [eventType]
        )
      );
    }
  }
  const writers = objects(confirmation.controlledIngestWriterRegistry);
  const coveredEvents = new Set(writers.flatMap((writer) => strings(writer.allowedEventTypes)));
  for (const row of eventRows) {
    const eventType = text(row.eventType);
    if (eventType && strings(row.writesControlFields).length > 0 && !coveredEvents.has(eventType)) {
      issues.push(
        issue(
          'canonical_event_writer_registry_missing',
          `${eventType} not covered by controlledIngestWriterRegistry`,
          [eventType]
        )
      );
    }
  }
  const blockingReasons = [...new Set(issues.map((item) => item.code))];
  return {
    reportType: 'canonical_event_registry_report',
    generatedAt: input.evaluatedAt ?? new Date().toISOString(),
    generatedBy: input.evaluatedBy ?? 'agent',
    sourcePath: normalizePath(sourcePath),
    decision: blockingReasons.length === 0 ? 'pass' : 'blocked',
    blockingReasons,
    checkedEvents: eventRows.length,
    issues,
  };
}

export function evaluateReverseAuditReadinessGate(input: {
  sourcePath: string;
  evaluatedAt?: string;
  evaluatedBy?: string;
}): JsonObject {
  const script = path.resolve(
    '_bmad/skills/requirements-contract-authoring/scripts/reverse_audit_contract.js'
  );
  const result = spawnSync(
    process.execPath,
    [script, path.resolve(input.sourcePath), '--mode', 'readiness', '--json'],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
      maxBuffer: 20 * 1024 * 1024,
    }
  );
  const issues: GateIssue[] = [];
  let auditReport: JsonObject = {};
  try {
    auditReport = JSON.parse(result.stdout || '{}') as JsonObject;
  } catch {
    issues.push(
      issue('reverse_audit_json_parse_failed', 'reverse audit did not emit parseable JSON')
    );
  }
  const rendererReadiness = nested(nested(auditReport.rendererAuthority).deliveryReadiness);
  const directReadiness = nested(auditReport.deliveryReadiness);
  const readiness = rendererReadiness.ready ?? directReadiness.ready;
  if (result.status !== 0)
    issues.push(
      issue('reverse_audit_exit_nonzero', `reverse audit exitCode=${result.status ?? '<null>'}`)
    );
  if (readiness !== true)
    issues.push(
      issue(
        'reverse_audit_delivery_readiness_not_ready',
        'deliveryReadiness.ready is not true in readiness mode',
        ['deliveryReadiness.ready']
      )
    );
  const blockingReasons = [...new Set(issues.map((item) => item.code))];
  return {
    reportType: 'reverse_audit_readiness_report',
    generatedAt: input.evaluatedAt ?? new Date().toISOString(),
    generatedBy: input.evaluatedBy ?? 'agent',
    sourcePath: normalizePath(path.resolve(input.sourcePath)),
    decision: blockingReasons.length === 0 ? 'pass' : 'blocked',
    blockingReasons,
    exitCode: result.status,
    auditVerdict: text(auditReport.verdict),
    deliveryReadiness:
      Object.keys(rendererReadiness).length > 0
        ? rendererReadiness
        : Object.keys(directReadiness).length > 0
          ? directReadiness
          : null,
    issues,
  };
}

export function evaluateCloseoutTargetControlFlowGate(input: {
  sourcePath: string;
  evaluatedAt?: string;
  evaluatedBy?: string;
}): JsonObject {
  const { confirmation, sourcePath } = readImplementationConfirmation(input.sourcePath);
  const currentTargetMap = nested(confirmation.currentTargetMap);
  const legacyTokens = objects(currentTargetMap.existingArtifacts)
    .filter((row) => LEGACY_POLICIES.has(text(row.completionProofPolicy)))
    .map((row) => text(row.currentPath))
    .filter((value) => value && !isPathLike(value));
  const closeoutScripts = objects(currentTargetMap.scriptConvergence)
    .map((row) => text(row.scriptOrConfigPath))
    .filter((value) => value && /closeout|delivery/iu.test(value));
  const issues: GateIssue[] = [];
  for (const scriptPath of closeoutScripts) {
    const absolute = path.resolve(scriptPath);
    if (!fs.existsSync(absolute)) {
      issues.push(
        issue('closeout_control_flow_script_missing', `${scriptPath} missing`, [scriptPath])
      );
      continue;
    }
    const source = fs.readFileSync(absolute, 'utf8');
    for (const token of legacyTokens) {
      if (source.includes(token)) {
        issues.push(
          issue(
            'closeout_target_control_flow_uses_legacy_completion_path',
            `${scriptPath} still references legacy completion token ${token}`,
            [scriptPath, token]
          )
        );
      }
    }
  }
  const blockingReasons = [...new Set(issues.map((item) => item.code))];
  return {
    reportType: 'closeout_target_control_flow_report',
    generatedAt: input.evaluatedAt ?? new Date().toISOString(),
    generatedBy: input.evaluatedBy ?? 'agent',
    sourcePath: normalizePath(sourcePath),
    decision: blockingReasons.length === 0 ? 'pass' : 'blocked',
    blockingReasons,
    checkedScripts: closeoutScripts,
    legacyTokens,
    issues,
  };
}

export function evaluateExternalBoundaryGate(input: {
  sourcePath: string;
  evaluatedAt?: string;
  evaluatedBy?: string;
}): JsonObject {
  const { confirmation, sourcePath } = readImplementationConfirmation(input.sourcePath);
  const registries = [
    ...objects(confirmation.artifactAutomationPlan),
    ...objects(confirmation.scriptsAndHooksRegistry),
    ...objects(nested(confirmation.currentTargetMap).scriptConvergence),
  ];
  const externalRows = registries.filter((row) => {
    const searchable = JSON.stringify(row).toLowerCase();
    return (
      searchable.includes('external') ||
      searchable.includes('board') ||
      searchable.includes('kanban') ||
      searchable.includes('github') ||
      searchable.includes('gitlab')
    );
  });
  const issues: GateIssue[] = [];
  for (const row of externalRows) {
    if (row.canAffectControlFlow === true) {
      issues.push(
        issue(
          'external_boundary_can_affect_control_flow',
          `${text(row.id) || text(row.path) || '<external-row>'} canAffectControlFlow=true`,
          [text(row.id) || text(row.path)]
        )
      );
    }
    const role =
      `${text(row.controlOrEvidenceRole)} ${text(row.sourceOfTruthRole)} ${text(row.controlPlaneRole)}`.toLowerCase();
    if (
      role.includes('control') &&
      !role.includes('projection') &&
      !role.includes('evidence') &&
      !role.includes('validation')
    ) {
      issues.push(
        issue(
          'external_boundary_control_authority_leak',
          `${text(row.id) || text(row.path) || '<external-row>'} appears to grant control authority`,
          [text(row.id) || text(row.path)]
        )
      );
    }
  }
  const blockingReasons = [...new Set(issues.map((item) => item.code))];
  return {
    reportType: 'external_boundary_report',
    generatedAt: input.evaluatedAt ?? new Date().toISOString(),
    generatedBy: input.evaluatedBy ?? 'agent',
    sourcePath: normalizePath(sourcePath),
    decision: blockingReasons.length === 0 ? 'pass' : 'blocked',
    blockingReasons,
    checkedRows: externalRows.length,
    issues,
  };
}

export function mainTargetArtifactRealizationGate(argv: string[]): number {
  const args = parseArgs(argv);
  if (args.help) {
    console.log(
      'Usage: target-artifact-realization-gate --source <requirement.md> --requirement-record <json> --attempt-id <id> [--report-path <json>] [--json]'
    );
    return 0;
  }
  if (!args.source || !args.requirementRecord || !args.attemptId)
    throw new Error('missing required args: source, requirementRecord, attemptId');
  const recordPath = path.resolve(args.requirementRecord);
  const reportPath = path.resolve(
    args.reportPath ??
      path.join(path.dirname(recordPath), 'target-artifact-realization-report.json')
  );
  const report = evaluateTargetArtifactRealization({
    sourcePath: args.source,
    record: readJson(recordPath),
    recordPath,
    attemptId: args.attemptId,
    evaluatedAt: args.evaluatedAt,
    evaluatedBy: args.evaluatedBy,
  });
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  const output = {
    ok: true,
    reportPath: normalizePath(reportPath),
    decision: report.decision,
    blockingReasons: report.blockingReasons,
  };
  process.stdout.write(
    args.json
      ? `${JSON.stringify(output, null, 2)}\n`
      : `target_artifact_realization=${report.decision}\n`
  );
  return text(report.decision) === 'pass' ? 0 : 1;
}

if (require.main === module) {
  try {
    process.exitCode = mainTargetArtifactRealizationGate(process.argv.slice(2));
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
