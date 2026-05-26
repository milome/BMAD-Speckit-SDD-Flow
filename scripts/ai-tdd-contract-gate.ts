/* eslint-disable no-console */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  deriveTargetArtifactChecklist,
  evaluateCanonicalEventRegistryGate,
  evaluateCanonicalSchemaReducerGate,
  evaluateCloseoutTargetControlFlowGate,
  evaluateExternalBoundaryGate,
  evaluateRequiredCommandFileExistence,
  evaluateReverseAuditReadinessGate,
  evaluateTargetArtifactRealization,
  implementationConfirmationHash,
  readImplementationConfirmation,
  type JsonObject,
} from './target-artifact-realization-gate';
import { evaluateStrictCloseoutProof } from './strict-closeout-proof-gate';

type AiTddMode = 'pre-implementation' | 'pre-rerun' | 'iteration' | 'closeout';
type Decision = 'pass' | 'blocked';
type MatrixState =
  | 'expected_red'
  | 'unexpected_green'
  | 'invalid_red'
  | 'green'
  | 'partial_green'
  | 'missing_plan'
  | 'missing_test'
  | 'missing_artifact'
  | 'stale'
  | 'blocked'
  | 'not_applicable';

interface ParsedArgs {
  source?: string;
  requirementRecord?: string;
  mode?: AiTddMode;
  attemptId?: string;
  reportPath?: string;
  evaluatedAt?: string;
  evaluatedBy?: string;
  executeRedProof?: boolean;
  redProofCommandTimeoutMs?: string;
  json?: boolean;
  help?: boolean;
}

interface RequirementRow {
  id: string;
  kind: 'MUST' | 'NEG' | 'OUT';
  text: string;
  evidenceRefs: string[];
  traceRefs: string[];
}

interface AcceptanceRow {
  id: string;
  kind: string;
  files: string[];
  commandRefs: string[];
  covers: string[];
  failurePathRefs: string[];
  edgeCaseRefs: string[];
  traceRefs: string[];
  evidenceRefs: string[];
  negativeControlRefs: string[];
  expectedPreImplementationState: MatrixState | null;
  oracle: string;
  explicit: boolean;
  mockOnly: boolean;
  sourceSection: string;
}

interface MatrixRow {
  id: string;
  category: string;
  refs: string[];
  expectedPreImplementationState: MatrixState | 'not_applicable';
  currentState: MatrixState;
  oracle: string;
  commandRefs: string[];
  artifactRefs: string[];
  attemptBinding: 'current' | 'stale' | 'missing' | 'not_applicable';
  decision: Decision;
  blockingReasons: string[];
}

interface RedProofRow {
  acceptanceId: string;
  commandId: string;
  state: MatrixState;
  oracle: string;
  failureClass: string;
  proofSource: string;
}

const AI_TDD_COMMAND_IDS = new Set([
  'CMD-AI-TDD-CONTRACT-GATE',
  'CMD-AI-TDD-CONTRACT-CLOSEOUT-GATE',
]);
const BUILTIN_NEGATIVE_CONTROL_IDS = [
  'NEGCTRL-MOCK-ONLY',
  'NEGCTRL-EXITCODE-ONLY',
  'NEGCTRL-SELF-CERTIFICATION',
];
const INVALID_RED_FAILURE_CLASSES = new Set([
  'missing_test_file',
  'runner_crash',
  'syntax_error',
  'environment_error',
  'unbound_oracle',
]);

function parseArgs(argv: string[]): ParsedArgs {
  const out: ParsedArgs = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help' || arg === '-h') out.help = true;
    else if (arg === '--json') out.json = true;
    else if (arg === '--execute-red-proof') out.executeRedProof = true;
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

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function normalizePath(value: string): string {
  return value.replace(/\\/gu, '/');
}

function readJson(file: string): JsonObject {
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
    throw new Error(`JSON object expected: ${file}`);
  return parsed as JsonObject;
}

function commandId(row: JsonObject): string {
  return text(row.id) || text(row.commandId);
}

function commandRefs(row: JsonObject): string[] {
  return unique([
    ...strings(row.commandRefs),
    ...strings(row.requiredCommandRefs),
    ...strings(row.requiredCommandIds),
    ...strings(row.contractValidationCommandRefs),
    ...strings(row.deliveryEvidenceCommandRefs),
  ]);
}

function idRefs(row: JsonObject, keys: string[]): string[] {
  return unique(keys.flatMap((key) => strings(row[key])));
}

function isFailurePathId(value: string): boolean {
  return /^FAIL-\d+/u.test(value);
}

function isEdgeCaseId(value: string): boolean {
  return /^EDGE-\d+/u.test(value);
}

function requirementCoverageRefs(values: string[]): string[] {
  return values.filter((value) => !isFailurePathId(value) && !isEdgeCaseId(value));
}

function resolveSkillDir(skillName: string): string {
  const root = process.cwd();
  const home = process.env.USERPROFILE || process.env.HOME || '';
  const packageRoot = path.resolve(__dirname, '..');
  const candidates = [
    path.join(root, '.codex', 'skills', skillName),
    path.join(root, '_bmad', 'skills', skillName),
    path.join(root, '.agents', 'skills', skillName),
    path.join(packageRoot, '.codex', 'skills', skillName),
    path.join(packageRoot, '_bmad', 'skills', skillName),
    ...(home ? [path.join(home, '.codex', 'skills', skillName), path.join(home, '.agents', 'skills', skillName)] : []),
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

let activeSourceRoot = process.cwd();

function withActiveSourceRoot<T>(sourcePath: string, fn: () => T): T {
  const previous = activeSourceRoot;
  activeSourceRoot = path.dirname(path.resolve(sourcePath));
  try {
    return fn();
  } finally {
    activeSourceRoot = previous;
  }
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

function resolvedFileExistence(ref: string): { absolutePath: string; exists: boolean; parentEntries: string[] } {
  const resolved = resolveLogicalSkillRef(resolveSkillPlaceholders(ref));
  const absolute = path.isAbsolute(resolved) ? resolved : path.resolve(activeSourceRoot, resolved);
  try {
    if (fs.statSync(absolute).isFile()) return { absolutePath: absolute, exists: true, parentEntries: [] };
  } catch {
    // Fall through to directory-entry matching below.
  }
  const parent = path.dirname(absolute);
  if (!fs.existsSync(parent)) return { absolutePath: absolute, exists: false, parentEntries: [] };
  const parentEntries = fs.readdirSync(parent);
  const normalizeName = (value: string) => value.normalize('NFC').trim();
  const targetName = normalizeName(path.basename(absolute));
  return {
    absolutePath: absolute,
    exists: parentEntries.some((entry) => normalizeName(entry) === targetName),
    parentEntries,
  };
}

function fileExists(ref: string): boolean {
  return resolvedFileExistence(ref).exists;
}

function normalizePreState(value: unknown): MatrixState | null {
  const raw = text(value).toLowerCase();
  if (!raw) return null;
  if (['expected_red', 'red', 'valid_red', 'old_red'].includes(raw)) return 'expected_red';
  if (['unexpected_green', 'green', 'old_green'].includes(raw)) return 'unexpected_green';
  if (['invalid_red', 'runner_crash', 'missing_file', 'syntax_error'].includes(raw))
    return 'invalid_red';
  return null;
}

function currentAttempt(record: JsonObject, explicit?: string): string {
  if (explicit) return explicit;
  const closeout = nested(record.closeout);
  const commands = objects(nested(record.deliveryEvidence).requiredCommands);
  const lastCommandAttempt = commands
    .map((command) => text(nested(command.lastRunRef).closeoutAttemptId) || text(command.closeoutAttemptId))
    .find(Boolean);
  return text(closeout.currentAttemptId) || lastCommandAttempt || 'ai-tdd-attempt';
}

function requirementRows(confirmation: JsonObject): RequirementRow[] {
  const must = objects(confirmation.must).map((row) => ({
    id: text(row.id),
    kind: 'MUST' as const,
    text: text(row.text),
    evidenceRefs: idRefs(row, ['evidenceRefs', 'linkedEvidenceIds']),
    traceRefs: idRefs(row, ['coveredByTraceRows', 'traceRows', 'traceRefs']),
  }));
  const neg = objects(confirmation.notDone).map((row) => ({
    id: text(row.id),
    kind: 'NEG' as const,
    text: text(row.text),
    evidenceRefs: idRefs(row, ['evidenceRefs', 'linkedEvidenceIds']),
    traceRefs: idRefs(row, ['coveredByTraceRows', 'traceRows', 'traceRefs']),
  }));
  const out = objects(confirmation.mustNot).map((row) => ({
    id: text(row.id),
    kind: 'OUT' as const,
    text: text(row.text),
    evidenceRefs: idRefs(row, ['evidenceRefs', 'linkedEvidenceIds']),
    traceRefs: idRefs(row, ['boundaryRefs', 'boundaryViewRefs', 'traceRows', 'traceRefs']),
  }));
  return [...must, ...neg, ...out].filter((row) => row.id);
}

function traceCommandIndex(confirmation: JsonObject): Map<string, JsonObject[]> {
  const index = new Map<string, JsonObject[]>();
  for (const trace of objects(confirmation.traceRows)) {
    for (const ref of commandRefs(trace)) {
      const current = index.get(ref) ?? [];
      current.push(trace);
      index.set(ref, current);
    }
  }
  return index;
}

function explicitAcceptanceRows(confirmation: JsonObject): AcceptanceRow[] {
  const sections = [
    ['acceptanceTests', 'acceptance'],
    ['acceptanceTestSuites', 'acceptance'],
    ['e2eSuites', 'e2e'],
    ['e2eTests', 'e2e'],
    ['integrationTests', 'integration'],
    ['contractTests', 'contract'],
  ] as const;
  return sections.flatMap(([section, kind]) =>
    objects(confirmation[section]).map((row, index) => {
      const files = unique([
        text(row.file),
        text(row.path),
        text(row.testFile),
        text(row.testPath),
        ...strings(row.files),
        ...strings(row.testFiles),
        ...extractCommandFileRefs(text(row.command)),
      ]);
      return {
        id: text(row.id) || text(row.testId) || `${kind === 'e2e' ? 'E2E' : 'ACC'}-${section}-${index + 1}`,
        kind,
        sourceSection: section,
        files,
        commandRefs: commandRefs(row),
        covers: requirementCoverageRefs(
          idRefs(row, ['covers', 'requirementRefs', 'linkedRequirementIds', 'mustRefs', 'negRefs'])
        ),
        failurePathRefs: unique([
          ...idRefs(row, ['failurePathRefs', 'linkedFailurePathIds']),
          ...idRefs(row, ['covers', 'requirementRefs', 'linkedRequirementIds']).filter(isFailurePathId),
        ]),
        edgeCaseRefs: unique([
          ...idRefs(row, ['edgeCaseRefs', 'linkedEdgeCaseIds']),
          ...idRefs(row, ['covers', 'requirementRefs', 'linkedRequirementIds']).filter(isEdgeCaseId),
        ]),
        traceRefs: idRefs(row, ['traceRows', 'traceRefs']),
        evidenceRefs: idRefs(row, ['evidenceRefs', 'linkedEvidenceIds']),
        negativeControlRefs: idRefs(row, ['negativeControlRefs', 'negativeControls', 'linkedNegIds']),
        expectedPreImplementationState: normalizePreState(
          row.expectedPreImplementationState ??
            row.preImplementationState ??
            row.oldImplementationState ??
            row.tddRedState
        ),
        oracle: text(row.oracle) || text(row.expectedBehavior) || text(row.assertion),
        explicit: true,
        mockOnly: row.mockOnly === true || text(row.proofType).toLowerCase() === 'mock-only',
      };
    })
  );
}

function derivedAcceptanceRows(confirmation: JsonObject): AcceptanceRow[] {
  const traceByCommand = traceCommandIndex(confirmation);
  return objects(confirmation.requiredCommands).flatMap((command, index) => {
    const id = commandId(command);
    const files = extractCommandFileRefs(text(command.command)).filter((file) =>
      /\.(?:test|spec)\.(?:ts|tsx|js|jsx|mjs|cjs)$/iu.test(file)
    );
    if (files.length === 0) return [];
    const linkedTraces = traceByCommand.get(id) ?? [];
    const covers = unique([
      ...idRefs(command, ['covers', 'requirementRefs', 'linkedRequirementIds']),
      ...linkedTraces.flatMap((trace) => strings(trace.covers)),
    ]);
    return [
      {
        id: `ACC-FROM-${id || `CMD-${index + 1}`}`,
        kind: 'derived_required_command_test',
        sourceSection: 'requiredCommands',
        files,
        commandRefs: id ? [id] : [],
        covers: requirementCoverageRefs(covers),
        failurePathRefs: unique(covers.filter(isFailurePathId)),
        edgeCaseRefs: unique(covers.filter(isEdgeCaseId)),
        traceRefs: unique([
          ...idRefs(command, ['traceRows', 'traceRefs']),
          ...linkedTraces.map((trace) => text(trace.id)),
        ]),
        evidenceRefs: unique([
          ...idRefs(command, ['evidenceRefs', 'linkedEvidenceIds']),
          ...linkedTraces.flatMap((trace) => strings(trace.evidenceRefs)),
        ]),
        negativeControlRefs: idRefs(command, ['negativeControlRefs', 'linkedNegIds']),
        expectedPreImplementationState: normalizePreState(
          command.expectedPreImplementationState ??
            command.preImplementationState ??
            command.oldImplementationState
        ),
        oracle: text(command.oracle) || text(command.expectedOutcome) || text(command.description),
        explicit: false,
        mockOnly: command.mockOnly === true || text(command.proofType).toLowerCase() === 'mock-only',
      },
    ];
  });
}

function acceptanceRows(confirmation: JsonObject): AcceptanceRow[] {
  const byId = new Map<string, AcceptanceRow>();
  const explicit = explicitAcceptanceRows(confirmation);
  const explicitCommandRefs = new Set(explicit.flatMap((row) => row.commandRefs));
  const explicitFiles = new Set(explicit.flatMap((row) => row.files.map(normalizePath)));
  const derived = derivedAcceptanceRows(confirmation).filter(
    (row) =>
      !row.commandRefs.some((ref) => explicitCommandRefs.has(ref)) &&
      !row.files.some((file) => explicitFiles.has(normalizePath(file)))
  );
  for (const row of [...explicit, ...derived]) {
    byId.set(row.id, row);
  }
  return [...byId.values()];
}

function redProofRows(input: { confirmation: JsonObject; record: JsonObject }): RedProofRow[] {
  const rawRows: JsonObject[] = [
    ...objects(nested(input.record.aiTddContractGate).preImplementationRedProofs).map((row) => ({
      ...row,
      proofSource: 'record.aiTddContractGate.preImplementationRedProofs',
    })),
    ...objects(input.record.preImplementationRedProofs).map((row) => ({
      ...row,
      proofSource: 'record.preImplementationRedProofs',
    })),
    ...objects(input.record.contractChecks)
      .filter((row) => text(row.contract) === 'ai_tdd_pre_implementation_red_proof')
      .map((row) => ({
        acceptanceId: text(row.acceptanceId) || text(row.targetId),
        commandId: text(row.commandId),
        state:
          text(row.decision) === 'pass'
            ? 'expected_red'
            : text(row.decision) === 'blocked'
              ? 'invalid_red'
              : text(row.decision) === 'fail'
                ? 'unexpected_green'
                : text(row.state),
        oracle: text(row.oracle) || text(row.message),
        failureClass: text(row.failureClass),
        proofSource: 'record.contractChecks',
      })),
  ];
  return rawRows
    .map((row: JsonObject) => {
      const state = normalizePreState(row.state) ?? normalizePreState(row.expectedPreImplementationState);
      return {
        acceptanceId: text(row.acceptanceId) || text(row.id) || text(row.testId),
        commandId: text(row.commandId),
        state: state ?? 'missing_plan',
        oracle: text(row.oracle),
        failureClass: text(row.failureClass),
        proofSource: text(row.proofSource),
      };
    })
    .filter((row) => row.acceptanceId);
}

function targetModificationPaths(confirmation: JsonObject): JsonObject[] {
  const directRows = [
    ...strings(confirmation.targetModificationPaths).map((value, index) => ({
      id: `TARGET-MOD-${index + 1}`,
      path: value,
      sourceSection: 'targetModificationPaths',
    })),
    ...strings(confirmation.targetPaths).map((value, index) => ({
      id: `TARGET-PATH-${index + 1}`,
      path: value,
      sourceSection: 'targetPaths',
    })),
    ...objects(confirmation.targetModificationPaths).map((row, index) => ({
      id: text(row.id) || `TARGET-MOD-${index + 1}`,
      path: text(row.path) || text(row.targetPath) || text(row.targetPathOrField),
      traceRefs: idRefs(row, ['traceRows', 'traceRefs']),
      evidenceRefs: idRefs(row, ['evidenceRefs']),
      sourceSection: 'targetModificationPaths',
    })),
  ];
  const taskRows = objects(confirmation.implementationTasks).flatMap((task, taskIndex) =>
    strings(task.targetPaths).map((value, pathIndex) => ({
      id: text(task.id) || `TASK-${taskIndex + 1}-TARGET-${pathIndex + 1}`,
      path: value,
      traceRefs: idRefs(task, ['traceRows', 'traceRefs']),
      evidenceRefs: idRefs(task, ['evidenceRefs']),
      sourceSection: 'implementationTasks.targetPaths',
    }))
  );
  return [...directRows, ...taskRows]
    .map((row) => ({
      ...row,
      path: normalizePath(text(row.path)),
      traceRefs: strings((row as JsonObject).traceRefs),
      evidenceRefs: strings((row as JsonObject).evidenceRefs),
    }));
}

function targetModificationPathCoverage(input: {
  targetModificationPaths: JsonObject[];
  traceRows: JsonObject[];
  evidenceRows: JsonObject[];
}): JsonObject {
  const traceIds = idSet(input.traceRows);
  const evidenceIds = idSet(input.evidenceRows);
  const rows = input.targetModificationPaths.map((row, index) => {
    const id = text(row.id) || text(row.path) || `TARGET-MOD-${index + 1}`;
    const traceRefs = strings(row.traceRefs);
    const evidenceRefs = strings(row.evidenceRefs);
    const missing: JsonObject[] = [];
    if (!text(row.path)) {
      missing.push(issue('targetModificationPaths', 'target_modification_path_missing', id));
    }
    if (traceRefs.length === 0) {
      missing.push(issue('targetModificationPaths', 'target_modification_trace_refs_missing', id));
    }
    if (evidenceRefs.length === 0) {
      missing.push(issue('targetModificationPaths', 'target_modification_evidence_refs_missing', id));
    }
    for (const ref of traceRefs) {
      if (!traceIds.has(ref)) missing.push(issue('targetModificationPaths', 'trace_ref_missing', id, { ref }));
    }
    for (const ref of evidenceRefs) {
      if (!evidenceIds.has(ref)) {
        missing.push(issue('targetModificationPaths', 'evidence_ref_missing', id, { ref }));
      }
    }
    return {
      id,
      path: text(row.path),
      traceRefs,
      evidenceRefs,
      sourceSection: text(row.sourceSection),
      missing,
      ready: missing.length === 0,
      decision: missing.length === 0 ? 'pass' : 'blocked',
      blockingReasons: unique(missing.map((item) => text(item.code))),
    };
  });
  const missing = [
    ...(rows.length === 0
      ? [issue('targetModificationPaths', 'target_modification_paths_missing', 'targetModificationPaths')]
      : []),
    ...rows.flatMap((row) => objects(row.missing)),
  ];
  return {
    rows,
    missing,
    ready: missing.length === 0,
    decision: missing.length === 0 ? 'pass' : 'blocked',
    blockingReasons: unique(missing.map((row) => text(row.code))),
  };
}

function negativeControls(confirmation: JsonObject): JsonObject[] {
  const controls = [
    ...objects(confirmation.notDone).map((row) => ({
      id: text(row.id),
      source: 'notDone',
      oracle: text(row.oracle) || text(row.whyItBlocksCompletion) || strings(row.requiredAssertions).join('; '),
      linkedIds: [text(row.id), ...idRefs(row, ['evidenceRefs', 'coveredByTraceRows'])].filter(Boolean),
    })),
    ...objects(confirmation.failurePaths).map((row) => ({
      id: text(row.id),
      source: 'failurePaths',
      oracle:
        text(row.expectedBehavior) ||
        text(row.forbiddenBehavior) ||
        strings(row.requiredAssertions).join('; '),
      linkedIds: idRefs(row, ['linkedNegIds', 'linkedEvidenceIds']),
    })),
    ...objects(confirmation.edgeCases).map((row) => ({
      id: text(row.id),
      source: 'edgeCases',
      oracle: text(row.expectedBehavior) || text(row.forbiddenBehavior),
      linkedIds: idRefs(row, ['linkedFailurePathIds', 'linkedEvidenceIds']),
    })),
    ...objects(nested(confirmation.currentTargetMap).existingArtifacts)
      .filter((row) => ['legacy_only', 'not_completion_proof'].includes(text(row.completionProofPolicy)))
      .map((row) => ({
        id: text(row.id) || text(row.currentPath),
        source: 'legacy_policy',
        oracle: `Must not use ${text(row.currentPath)} as completion proof`,
        linkedIds: idRefs(row, ['traceRows', 'evidenceRefs', 'linkedRequirementIds']),
      })),
    ...BUILTIN_NEGATIVE_CONTROL_IDS.map((id) => ({
      id,
      source: 'builtin',
      oracle:
        id === 'NEGCTRL-MOCK-ONLY'
          ? 'mock-only proof is not closeout proof'
          : id === 'NEGCTRL-EXITCODE-ONLY'
            ? 'exitCode-only proof is not closeout proof'
            : 'runtime closure packet self-certification is not closeout proof',
      linkedIds: [],
    })),
  ];
  return controls.filter((row) => text(row.id));
}

function viewCoverageIndex(confirmation: JsonObject): Map<string, string[]> {
  const index = new Map<string, string[]>();
  const views = [
    ...objects(confirmation.sequenceViews),
    ...objects(confirmation.flowViews),
    ...objects(confirmation.edgeCaseViews),
    ...objects(confirmation.boundaryViews),
  ];
  for (const view of views) {
    const viewId = text(view.id);
    for (const ref of idRefs(view, ['covers', 'cases'])) {
      index.set(ref, unique([...(index.get(ref) ?? []), viewId].filter(Boolean)));
    }
  }
  return index;
}

function traceRefsFor(
  traceRows: JsonObject[],
  requirementRefs: string[],
  evidenceRefs: string[],
  explicitRefs: string[]
): string[] {
  return unique([
    ...explicitRefs,
    ...traceRows
      .filter(
        (trace) =>
          strings(trace.covers).some((ref) => requirementRefs.includes(ref)) ||
          strings(trace.evidenceRefs).some((ref) => evidenceRefs.includes(ref))
      )
      .map((trace) => text(trace.id)),
  ]);
}

function acceptanceRefsFor(
  acceptance: AcceptanceRow[],
  key: 'failurePathRefs' | 'edgeCaseRefs',
  id: string
): { acceptanceRefs: string[]; e2eRefs: string[] } {
  const covering = acceptance.filter((row) => row.explicit !== false && row[key].includes(id));
  return {
    acceptanceRefs: covering
      .filter((row) => !(row.kind === 'e2e' || row.id.startsWith('E2E-')))
      .map((row) => row.id),
    e2eRefs: covering.filter((row) => row.kind === 'e2e' || row.id.startsWith('E2E-')).map((row) => row.id),
  };
}

function errorCaseCoverage(confirmation: JsonObject, acceptance: AcceptanceRow[]): JsonObject {
  const traceRows = objects(confirmation.traceRows);
  const failureRows = objects(confirmation.failurePaths);
  const edgeRows = objects(confirmation.edgeCases);
  const views = viewCoverageIndex(confirmation);
  const failureNegRefs = new Map(
    failureRows.map((row) => [text(row.id), idRefs(row, ['linkedNegIds', 'negRefs'])])
  );

  const failurePaths = failureRows
    .map((row) => {
      const id = text(row.id);
      const linkedNegIds = idRefs(row, ['linkedNegIds', 'negRefs']);
      const linkedEvidenceIds = idRefs(row, ['linkedEvidenceIds', 'evidenceRefs']);
      const traceRefs = traceRefsFor(
        traceRows,
        linkedNegIds,
        linkedEvidenceIds,
        idRefs(row, ['traceRows', 'traceRefs'])
      );
      const viewRefs = unique([...idRefs(row, ['viewRefs', 'sequenceViewRefs', 'boundaryViewRefs']), ...(views.get(id) ?? [])]);
      const { acceptanceRefs, e2eRefs } = acceptanceRefsFor(acceptance, 'failurePathRefs', id);
      const missing = [
        ...(linkedNegIds.length > 0 ? [] : ['failure_path_neg_refs_missing']),
        ...(linkedEvidenceIds.length > 0 ? [] : ['failure_path_evidence_refs_missing']),
        ...(traceRefs.length > 0 ? [] : ['failure_path_trace_coverage_missing']),
        ...(acceptanceRefs.length + e2eRefs.length > 0 ? [] : ['failure_path_acceptance_coverage_missing']),
        ...(viewRefs.length > 0 ? [] : ['failure_path_view_coverage_missing']),
      ];
      return {
        id,
        linkedNegIds,
        linkedEvidenceIds,
        traceRefs,
        viewRefs,
        acceptanceRefs,
        e2eRefs,
        missing,
        covered: missing.length === 0,
      };
    })
    .filter((row) => text(row.id));

  const edgeCases = edgeRows
    .map((row) => {
      const id = text(row.id);
      const linkedFailurePathIds = idRefs(row, ['linkedFailurePathIds', 'failurePathRefs']);
      const directNegIds = idRefs(row, ['linkedNegIds', 'negRefs']);
      const linkedNegIds = unique([
        ...directNegIds,
        ...linkedFailurePathIds.flatMap((failureId) => failureNegRefs.get(failureId) ?? []),
      ]);
      const linkedEvidenceIds = idRefs(row, ['linkedEvidenceIds', 'evidenceRefs']);
      const traceRefs = traceRefsFor(
        traceRows,
        linkedNegIds,
        linkedEvidenceIds,
        idRefs(row, ['traceRows', 'traceRefs'])
      );
      const viewRefs = unique([...idRefs(row, ['viewRefs', 'sequenceViewRefs', 'boundaryViewRefs']), ...(views.get(id) ?? [])]);
      const { acceptanceRefs, e2eRefs } = acceptanceRefsFor(acceptance, 'edgeCaseRefs', id);
      const missing = [
        ...(linkedFailurePathIds.length + linkedNegIds.length > 0 ? [] : ['edge_case_failure_or_neg_missing']),
        ...(linkedEvidenceIds.length > 0 ? [] : ['edge_case_evidence_refs_missing']),
        ...(traceRefs.length > 0 ? [] : ['edge_case_trace_coverage_missing']),
        ...(acceptanceRefs.length + e2eRefs.length > 0 ? [] : ['edge_case_acceptance_coverage_missing']),
        ...(viewRefs.length > 0 ? [] : ['edge_case_view_coverage_missing']),
      ];
      return {
        id,
        linkedFailurePathIds,
        linkedNegIds,
        linkedEvidenceIds,
        traceRefs,
        viewRefs,
        acceptanceRefs,
        e2eRefs,
        missing,
        covered: missing.length === 0,
      };
    })
    .filter((row) => text(row.id));

  const missing = [...failurePaths, ...edgeCases].flatMap((row) =>
    strings(row.missing).map((code) => ({
      id: text(row.id),
      code,
      category: isFailurePathId(text(row.id)) ? 'FAIL' : 'EDGE',
    }))
  );
  return {
    decision: missing.length === 0 ? 'pass' : 'blocked',
    ready: missing.length === 0,
    failurePaths,
    edgeCases,
    missing,
    summary: {
      failurePathCount: failurePaths.length,
      edgeCaseCount: edgeCases.length,
      coveredFailurePathCount: failurePaths.filter((row) => row.covered === true).length,
      coveredEdgeCaseCount: edgeCases.filter((row) => row.covered === true).length,
      missingCount: missing.length,
    },
  };
}

function commandTargetCollection(confirmation: JsonObject): JsonObject {
  const traceRows = objects(confirmation.traceRows);
  const rows = objects(confirmation.requiredCommands).map((row) => {
    const id = commandId(row);
    const traceRefs = idRefs(row, ['traceRows', 'traceRefs']);
    const evidenceRefs = idRefs(row, ['evidenceRefs', 'linkedEvidenceIds']);
    const files = extractCommandFileRefs(text(row.command));
    const linkedTraceRows = traceRows.filter((trace) => commandRefs(trace).includes(id));
    const collectedTraceRefs = unique([...traceRefs, ...linkedTraceRows.map((trace) => text(trace.id))]);
    const collectedEvidenceRefs = unique([
      ...evidenceRefs,
      ...linkedTraceRows.flatMap((trace) => strings(trace.evidenceRefs)),
    ]);
    const missing = [
      ...(files.length > 0 ? [] : ['command_target_files_missing']),
      ...(collectedTraceRefs.length > 0 ? [] : ['command_target_trace_refs_missing']),
      ...(collectedEvidenceRefs.length > 0 ? [] : ['command_target_evidence_refs_missing']),
    ];
    return {
      id,
      command: text(row.command),
      files: files.map(normalizePath),
      traceRefs: collectedTraceRefs,
      evidenceRefs: collectedEvidenceRefs,
      missing,
      ready: missing.length === 0,
    };
  }).filter((row) => row.id);
  const missing = rows.flatMap((row) =>
    strings(row.missing).map((code) => ({ id: text(row.id), code, category: 'CMD_TARGET' }))
  );
  return {
    decision: rows.length > 0 && missing.length === 0 ? 'pass' : 'blocked',
    ready: rows.length > 0 && missing.length === 0,
    rows,
    missing: rows.length === 0 ? [{ id: 'requiredCommands', code: 'command_target_collection_missing', category: 'CMD_TARGET' }] : missing,
    summary: {
      commandCount: rows.length,
      coveredCommandCount: rows.filter((row) => row.ready === true).length,
      missingCount: rows.length === 0 ? 1 : missing.length,
    },
  };
}

function traceClosureAssertions(confirmation: JsonObject): JsonObject {
  const rows = objects(confirmation.traceRows).map((row) => {
    const id = text(row.id);
    const covers = strings(row.covers);
    const evidenceRefs = strings(row.evidenceRefs);
    const commandRefsForRow = commandRefs(row);
    const acceptanceRefs = strings(row.acceptanceRefs);
    const artifactRefs = strings(row.artifactRefs);
    const missing = [
      ...(covers.length > 0 ? [] : ['trace_closure_requirement_refs_missing']),
      ...(evidenceRefs.length > 0 ? [] : ['trace_closure_evidence_refs_missing']),
      ...(commandRefsForRow.length > 0 ? [] : ['trace_closure_command_refs_missing']),
      ...(acceptanceRefs.length > 0 ? [] : ['trace_closure_acceptance_refs_missing']),
      ...(artifactRefs.length > 0 ? [] : ['trace_closure_artifact_refs_missing']),
    ];
    return {
      id,
      covers,
      evidenceRefs,
      commandRefs: commandRefsForRow,
      acceptanceRefs,
      artifactRefs,
      closureAssertion: text(row.closureAssertion) || text(row.oracle) || 'target-state closure requires current command, evidence, acceptance, and artifact binding',
      missing,
      ready: missing.length === 0,
    };
  }).filter((row) => row.id);
  const missing = rows.flatMap((row) =>
    strings(row.missing).map((code) => ({ id: text(row.id), code, category: 'TRACE_CLOSURE' }))
  );
  return {
    decision: rows.length > 0 && missing.length === 0 ? 'pass' : 'blocked',
    ready: rows.length > 0 && missing.length === 0,
    rows,
    missing: rows.length === 0 ? [{ id: 'traceRows', code: 'trace_closure_assertions_missing', category: 'TRACE_CLOSURE' }] : missing,
    summary: {
      traceCount: rows.length,
      closedByPlanCount: rows.filter((row) => row.ready === true).length,
      missingCount: rows.length === 0 ? 1 : missing.length,
    },
  };
}

function canonicalSurfaceReconciliation(confirmation: JsonObject, targetArtifacts: JsonObject[]): JsonObject {
  const currentTargetMap = nested(confirmation.currentTargetMap);
  const rows = targetArtifacts
    .filter((row) => text(row.kind) !== 'legacy_policy')
    .map((row) => {
      const id = text(row.id);
      const traceRefs = strings(row.traceRefs);
      const evidenceRefs = strings(row.evidenceRefs);
      const missing = [
        ...(text(row.pathOrField) ? [] : ['canonical_surface_path_or_field_missing']),
        ...(traceRefs.length > 0 ? [] : ['canonical_surface_trace_refs_missing']),
        ...(evidenceRefs.length > 0 ? [] : ['canonical_surface_evidence_refs_missing']),
      ];
      return {
        id,
        kind: text(row.kind),
        sourceSection: text(row.sourceSection),
        pathOrField: text(row.pathOrField),
        traceRefs,
        evidenceRefs,
        missing,
        ready: missing.length === 0,
      };
    });
  const missing = rows.flatMap((row) =>
    strings(row.missing).map((code) => ({ id: text(row.id), code, category: 'CANONICAL_SURFACE' }))
  );
  return {
    decision: rows.length > 0 && missing.length === 0 ? 'pass' : 'blocked',
    ready: rows.length > 0 && missing.length === 0,
    applies: nested(confirmation.applicability).currentTargetMap ? nested(nested(confirmation.applicability).currentTargetMap).applies === true : Object.keys(currentTargetMap).length > 0,
    rows,
    missing: rows.length === 0 ? [{ id: 'currentTargetMap', code: 'canonical_surface_reconciliation_missing', category: 'CANONICAL_SURFACE' }] : missing,
    summary: {
      canonicalSurfaceCount: rows.length,
      reconciledByPlanCount: rows.filter((row) => row.ready === true).length,
      missingCount: rows.length === 0 ? 1 : missing.length,
    },
  };
}

function currentTargetMapSection(confirmation: JsonObject): JsonObject {
  const map = nested(confirmation.currentTargetMap);
  const requiredGroups = [
    ['currentSummary', objects(map.currentSummary)],
    ['targetSummary', objects(map.targetSummary)],
    ['diffRows', objects(map.diffRows)],
    ['process', objects(map.process)],
    ['artifactPaths', objects(map.artifactPaths)],
    ['canonicalArtifacts', objects(map.canonicalArtifacts)],
    ['existingArtifacts', objects(map.existingArtifacts)],
  ] as const;
  const missing: JsonObject[] = [];
  for (const [groupName, rows] of requiredGroups) {
    if (rows.length === 0) {
      missing.push({ id: groupName, code: 'current_target_map_group_missing', category: 'CURRENT_TARGET_MAP' });
    }
  }
  if (text(map.schemaVersion) !== 'current-target-map/v1') {
    missing.push({ id: 'schemaVersion', code: 'current_target_map_schema_version_missing_or_invalid', category: 'CURRENT_TARGET_MAP' });
  }
  if (text(map.displayProfile) !== 'closed_loop_current_target_map') {
    missing.push({ id: 'displayProfile', code: 'current_target_map_display_profile_missing_or_invalid', category: 'CURRENT_TARGET_MAP' });
  }
  const rows = requiredGroups.map(([groupName, groupRows]) => ({
    id: groupName,
    count: groupRows.length,
    ready: groupRows.length > 0,
  }));
  return {
    decision: missing.length === 0 ? 'pass' : 'blocked',
    ready: missing.length === 0,
    schemaVersion: text(map.schemaVersion),
    displayProfile: text(map.displayProfile),
    rows,
    missing,
    summary: {
      currentSummaryCount: objects(map.currentSummary).length,
      targetSummaryCount: objects(map.targetSummary).length,
      diffRowCount: objects(map.diffRows).length,
      processCount: objects(map.process).length,
      artifactPathCount: objects(map.artifactPaths).length,
      canonicalArtifactCount: objects(map.canonicalArtifacts).length,
      legacySurfaceCount: objects(map.existingArtifacts).length,
      missingCount: missing.length,
    },
  };
}

function legacyDenial(confirmation: JsonObject, targetArtifacts: JsonObject[], controls: JsonObject[]): JsonObject {
  const legacyRows = [
    ...targetArtifacts.filter((row) => text(row.kind) === 'legacy_policy'),
    ...controls.filter((row) => text(row.source) === 'legacy_policy'),
  ];
  const rows = legacyRows.map((row) => {
    const id = text(row.id);
    const traceRefs = strings(row.traceRefs);
    const evidenceRefs = strings(row.evidenceRefs);
    const linkedIds = strings(row.linkedIds);
    const oracle = text(row.oracle) || `Must not use ${text(row.pathOrField)} as completion proof`;
    const missing = [
      ...(oracle ? [] : ['legacy_denial_oracle_missing']),
      ...(traceRefs.length + evidenceRefs.length + linkedIds.length > 0 ? [] : ['legacy_denial_refs_missing']),
    ];
    return {
      id,
      pathOrField: text(row.pathOrField),
      completionProofPolicy: text(row.completionProofPolicy) || 'legacy_only',
      oracle,
      traceRefs,
      evidenceRefs,
      linkedIds,
      missing,
      ready: missing.length === 0,
    };
  }).filter((row) => row.id || row.pathOrField);
  const missing = rows.flatMap((row) =>
    strings(row.missing).map((code) => ({ id: text(row.id) || text(row.pathOrField), code, category: 'LEGACY_DENIAL' }))
  );
  return {
    decision: rows.length > 0 && missing.length === 0 ? 'pass' : 'blocked',
    ready: rows.length > 0 && missing.length === 0,
    rows,
    missing: rows.length === 0 ? [{ id: 'currentTargetMap.existingArtifacts', code: 'legacy_denial_missing', category: 'LEGACY_DENIAL' }] : missing,
    summary: {
      legacyDenialCount: rows.length,
      coveredLegacyDenialCount: rows.filter((row) => row.ready === true).length,
      missingCount: rows.length === 0 ? 1 : missing.length,
    },
  };
}

function closeoutProof(confirmation: JsonObject, targetArtifacts: JsonObject[]): JsonObject {
  const preview = nested(confirmation.closeoutReadinessPreview);
  const requiredCommands = strings(preview.requiredCommands);
  const policies = [
    text(preview.orphanPolicy),
    text(preview.currentAttemptPolicy),
    text(preview.recordClosedPolicy),
  ].filter(Boolean);
  const targetRefs = targetArtifacts
    .filter((row) => text(row.kind) !== 'legacy_policy')
    .map((row) => text(row.id) || text(row.pathOrField))
    .filter(Boolean);
  const missing = [
    ...(requiredCommands.length > 0 ? [] : ['closeout_proof_required_commands_missing']),
    ...(policies.length > 0 ? [] : ['closeout_proof_policies_missing']),
    ...(targetRefs.length > 0 ? [] : ['closeout_proof_target_refs_missing']),
  ];
  return {
    decision: missing.length === 0 ? 'pass' : 'blocked',
    ready: missing.length === 0,
    requiredCommands,
    policies,
    targetRefs,
    missing: missing.map((code) => ({ id: 'closeoutReadinessPreview', code, category: 'CLOSEOUT_PROOF' })),
    summary: {
      requiredCommandCount: requiredCommands.length,
      policyCount: policies.length,
      targetRefCount: targetRefs.length,
      missingCount: missing.length,
    },
  };
}

function evidenceTrustStates(confirmation: JsonObject): JsonObject {
  const evidenceRows = objects(confirmation.evidence);
  const rows = evidenceRows.map((row) => {
    const id = text(row.id);
    const requiredCommandRefs = idRefs(row, ['requiredCommandRefs', 'commandRefs']);
    const artifactRefs = idRefs(row, ['artifactRefs']);
    const missing = [
      ...(text(row.oracle) ? [] : ['evidence_trust_oracle_missing']),
      ...(requiredCommandRefs.length > 0 ? [] : ['evidence_trust_command_refs_missing']),
      ...(artifactRefs.length > 0 ? [] : ['evidence_trust_artifact_refs_missing']),
    ];
    return {
      id,
      initialState: 'planned',
      allowedStates: ['planned', 'observed', 'assertion_validated', 'delivery_verified'],
      closeoutConsumableState: 'delivery_verified',
      requiredCommandRefs,
      artifactRefs,
      oracle: text(row.oracle),
      missing,
      ready: missing.length === 0,
    };
  }).filter((row) => row.id);
  const missing = rows.flatMap((row) =>
    strings(row.missing).map((code) => ({ id: text(row.id), code, category: 'EVIDENCE_TRUST' }))
  );
  return {
    decision: rows.length > 0 && missing.length === 0 ? 'pass' : 'blocked',
    ready: rows.length > 0 && missing.length === 0,
    rows,
    missing: rows.length === 0 ? [{ id: 'evidence', code: 'evidence_trust_states_missing', category: 'EVIDENCE_TRUST' }] : missing,
    summary: {
      evidenceCount: rows.length,
      trustedByPlanCount: rows.filter((row) => row.ready === true).length,
      missingCount: rows.length === 0 ? 1 : missing.length,
    },
  };
}

function buildManifest(input: {
  sourcePath: string;
  confirmation: JsonObject;
  record: JsonObject;
  recordPath: string;
  attemptId: string;
}): JsonObject {
  const acceptance = acceptanceRows(input.confirmation);
  const redProofs = redProofRows({ confirmation: input.confirmation, record: input.record });
  const targetArtifacts = deriveTargetArtifactChecklist(input.confirmation);
  const controls = negativeControls(input.confirmation);
  const errorCoverage = errorCaseCoverage(input.confirmation, acceptance);
  const commandTargets = commandTargetCollection(input.confirmation);
  const traceClosures = traceClosureAssertions(input.confirmation);
  const currentTargetMapManifest = currentTargetMapSection(input.confirmation);
  const canonicalSurfaces = canonicalSurfaceReconciliation(input.confirmation, targetArtifacts as unknown as JsonObject[]);
  const legacyControls = legacyDenial(input.confirmation, targetArtifacts as unknown as JsonObject[], controls);
  const closeoutProofPlan = closeoutProof(input.confirmation, targetArtifacts as unknown as JsonObject[]);
  const evidenceTrust = evidenceTrustStates(input.confirmation);
  const targetModificationRows = targetModificationPaths(input.confirmation);
  const targetModificationCoverage = targetModificationPathCoverage({
    targetModificationPaths: targetModificationRows,
    traceRows: objects(input.confirmation.traceRows),
    evidenceRows: objects(input.confirmation.evidence),
  });
  return {
    sourcePath: normalizePath(path.resolve(input.sourcePath)),
    recordPath: normalizePath(path.resolve(input.recordPath)),
    currentAttemptId: input.attemptId,
    implementationConfirmationHash: implementationConfirmationHash(input.confirmation),
    requirements: requirementRows(input.confirmation),
    evidence: objects(input.confirmation.evidence).map((row) => ({
      id: text(row.id),
      text: text(row.text),
      gate: text(row.gate),
      oracle: text(row.oracle),
      requiredCommandRefs: idRefs(row, ['requiredCommandRefs', 'commandRefs']),
      artifactRefs: idRefs(row, ['artifactRefs']),
    })),
    traceRows: objects(input.confirmation.traceRows).map((row) => ({
      id: text(row.id),
      covers: strings(row.covers),
      evidenceRefs: strings(row.evidenceRefs),
      commandRefs: commandRefs(row),
      artifactRefs: strings(row.artifactRefs),
      acceptanceRefs: strings(row.acceptanceRefs),
      status: text(row.status),
    })),
    requiredCommands: objects(input.confirmation.requiredCommands).map((row) => ({
      id: commandId(row),
      command: text(row.command),
      role: text(row.role) || text(row.commandRole) || text(row.gate),
      expectedMode: text(row.expectedMode) || text(row.expectedExitCodeAfterImplementation),
      files: extractCommandFileRefs(text(row.command)),
      traceRefs: idRefs(row, ['traceRows', 'traceRefs']),
      evidenceRefs: idRefs(row, ['evidenceRefs']),
    })),
    acceptanceTests: acceptance.filter((row) => row.kind !== 'e2e'),
    e2eSuites: acceptance.filter((row) => row.kind === 'e2e'),
    acceptanceSuites: acceptance,
    preImplementationRedProofs: redProofs,
    targetArtifacts,
    targetModificationPaths: targetModificationRows,
    negativeControls: controls,
    errorCaseCoverage: errorCoverage,
    commandTargetCollection: commandTargets,
    traceClosureAssertions: traceClosures,
    currentTargetMap: currentTargetMapManifest,
    targetModificationPathCoverage: targetModificationCoverage,
    canonicalSurfaceReconciliation: canonicalSurfaces,
    legacyDenial: legacyControls,
    closeoutProof: closeoutProofPlan,
    evidenceTrustStates: evidenceTrust,
    closeoutGates: {
      decision:
        [
          commandTargets,
          traceClosures,
          currentTargetMapManifest,
          targetModificationCoverage,
          canonicalSurfaces,
          legacyControls,
          closeoutProofPlan,
          evidenceTrust,
        ].every((section) => section.ready === true)
          ? 'pass'
          : 'blocked',
      requiredManifestSections: [
        'commandTargetCollection',
        'traceClosureAssertions',
        'currentTargetMap',
        'targetModificationPathCoverage',
        'canonicalSurfaceReconciliation',
        'legacyDenial',
        'closeoutProof',
        'evidenceTrustStates',
      ],
    },
  };
}

function missingTestPlan(manifest: JsonObject): JsonObject {
  const requirements = (objects(manifest.requirements) as unknown as RequirementRow[]).filter((row) =>
    ['MUST', 'NEG'].includes(row.kind)
  );
  const acceptance = acceptanceFromManifest(manifest);
  const covered = new Set(acceptance.flatMap((row) => row.covers));
  const missingCoverage = requirements
    .filter((row) => !covered.has(row.id))
    .map((row) => ({ id: row.id, kind: row.kind, reason: 'acceptance_or_e2e_coverage_missing' }));
  const missingFiles = acceptance.flatMap((row) =>
    row.files
      .filter((file) => !fileExists(file))
      .map((file) => ({ id: row.id, file: normalizePath(file), reason: 'acceptance_test_file_missing' }))
  );
  return {
    decision: missingCoverage.length === 0 && missingFiles.length === 0 ? 'pass' : 'blocked',
    missingCoverage,
    missingFiles,
  };
}

function negativeControlPlan(manifest: JsonObject): JsonObject {
  const controls = objects(manifest.negativeControls);
  const withoutOracle = controls
    .filter((row) => !text(row.oracle))
    .map((row) => ({ id: text(row.id), reason: 'negative_control_oracle_missing' }));
  return {
    decision: controls.length > 0 && withoutOracle.length === 0 ? 'pass' : 'blocked',
    controls,
    withoutOracle,
  };
}

function targetArtifactPlan(manifest: JsonObject): JsonObject {
  const targets = objects(manifest.targetArtifacts);
  return {
    decision: targets.length > 0 ? 'pass' : 'blocked',
    targets,
    missingPlan:
      targets.length === 0 ? [{ reason: 'target_artifact_plan_empty' }] : [],
  };
}

function issue(category: string, code: string, id: string, details: JsonObject = {}): JsonObject {
  return { category, code, id, ...details };
}

function idSet(rows: JsonObject[]): Set<string> {
  return new Set(rows.map((row) => text(row.id)).filter(Boolean));
}

function contractCompletenessReport(manifest: JsonObject): JsonObject {
  const requirements = objects(manifest.requirements);
  const must = requirements.filter((row) => text(row.kind) === 'MUST');
  const neg = requirements.filter((row) => text(row.kind) === 'NEG');
  const out = requirements.filter((row) => text(row.kind) === 'OUT');
  const evidence = objects(manifest.evidence);
  const traceRows = objects(manifest.traceRows);
  const commands = objects(manifest.requiredCommands);
  const acceptance = objects(manifest.acceptanceSuites);
  const explicitAcceptance = acceptance.filter((row) => row.explicit !== false);
  const e2e = explicitAcceptance.filter((row) => text(row.kind) === 'e2e' || text(row.id).startsWith('E2E-'));
  const acc = explicitAcceptance.filter(
    (row) => !(text(row.kind) === 'e2e' || text(row.id).startsWith('E2E-'))
  );
  const artifacts = objects(manifest.targetArtifacts);
  const proofArtifacts = artifacts.filter((row) => text(row.kind) !== 'legacy_policy');
  const targetModifications = objects(manifest.targetModificationPaths);
  const errorCoverage = nested(manifest.errorCaseCoverage);
  const manifestSections = [
    ['commandTargetCollection', nested(manifest.commandTargetCollection)],
    ['traceClosureAssertions', nested(manifest.traceClosureAssertions)],
    ['currentTargetMap', nested(manifest.currentTargetMap)],
    ['targetModificationPathCoverage', nested(manifest.targetModificationPathCoverage)],
    ['canonicalSurfaceReconciliation', nested(manifest.canonicalSurfaceReconciliation)],
    ['legacyDenial', nested(manifest.legacyDenial)],
    ['closeoutProof', nested(manifest.closeoutProof)],
    ['evidenceTrustStates', nested(manifest.evidenceTrustStates)],
  ] as const;

  const requirementIds = idSet(requirements);
  const mustNegIds = new Set([...must, ...neg].map((row) => text(row.id)).filter(Boolean));
  const evidenceIds = idSet(evidence);
  const traceIds = idSet(traceRows);
  const commandIds = idSet(commands);
  const acceptanceIds = idSet(acceptance);
  const artifactIds = new Set(
    proofArtifacts
      .flatMap((row) => [text(row.id), text(row.pathOrField)])
      .filter(Boolean)
  );
  const artifactReferenced = (artifact: JsonObject): boolean => {
    const aliases = [text(artifact.id), text(artifact.pathOrField)].filter(Boolean);
    return aliases.some(
      (id) =>
        evidence.some((evd) => strings(evd.artifactRefs).includes(id)) ||
        traceRows.some((trace) => strings(trace.artifactRefs).includes(id))
    );
  };
  const issues: JsonObject[] = [];

  if (must.length === 0) issues.push(issue('MUST', 'must_missing', 'MUST-*'));
  if (neg.length === 0) issues.push(issue('NEG', 'neg_missing', 'NEG-*'));
  if (evidence.length === 0) issues.push(issue('EVD', 'evidence_missing', 'EVD-*'));
  if (traceRows.length === 0) issues.push(issue('TRACE', 'trace_rows_missing', 'TRACE-*'));
  if (commands.length === 0) issues.push(issue('CMD', 'required_commands_missing', 'CMD-*'));
  if (acc.length === 0) issues.push(issue('ACC', 'acceptance_tests_missing', 'ACC-*'));
  if (e2e.length === 0) issues.push(issue('E2E', 'e2e_suites_missing', 'E2E-*'));
  if (proofArtifacts.length === 0) issues.push(issue('ART', 'target_artifacts_missing', 'ART-*'));
  for (const row of objects(errorCoverage.missing)) {
    const category = text(row.category) || (isFailurePathId(text(row.id)) ? 'FAIL' : 'EDGE');
    issues.push(issue(category, text(row.code) || 'error_case_coverage_missing', text(row.id)));
  }
  for (const [sectionName, section] of manifestSections) {
    if (section.ready !== true) {
      const missing = objects(section.missing);
      if (missing.length === 0) {
        issues.push(issue(sectionName, `${sectionName}_blocked`, sectionName));
      }
      for (const row of missing) {
        issues.push({
          ...row,
          category: text(row.category) || sectionName,
          code: text(row.code) || `${sectionName}_blocked`,
          id: text(row.id) || sectionName,
        });
      }
    }
  }

  for (const row of requirements) {
    const id = text(row.id) || '<missing-requirement-id>';
    if (!text(row.id)) issues.push(issue(text(row.kind) || 'REQ', 'requirement_id_missing', id));
    if (!text(row.text)) issues.push(issue(text(row.kind) || 'REQ', 'requirement_text_missing', id));
    if (['MUST', 'NEG'].includes(text(row.kind)) && strings(row.evidenceRefs).length === 0) {
      issues.push(issue(text(row.kind), 'requirement_evidence_refs_missing', id));
    }
    if (['MUST', 'NEG'].includes(text(row.kind)) && strings(row.traceRefs).length === 0) {
      issues.push(issue(text(row.kind), 'requirement_trace_refs_missing', id));
    }
    for (const ref of strings(row.evidenceRefs)) {
      if (!evidenceIds.has(ref)) issues.push(issue(text(row.kind) || 'REQ', 'evidence_ref_missing', id, { ref }));
    }
    for (const ref of strings(row.traceRefs)) {
      if (!traceIds.has(ref)) issues.push(issue(text(row.kind) || 'REQ', 'trace_ref_missing', id, { ref }));
    }
  }

  for (const row of evidence) {
    const id = text(row.id) || '<missing-evidence-id>';
    if (!text(row.id)) issues.push(issue('EVD', 'evidence_id_missing', id));
    if (!text(row.oracle)) issues.push(issue('EVD', 'evidence_oracle_missing', id));
    const refs = [...strings(row.requiredCommandRefs), ...strings(row.artifactRefs)];
    if (refs.length === 0) issues.push(issue('EVD', 'evidence_refs_missing', id));
    for (const ref of strings(row.requiredCommandRefs)) {
      if (!commandIds.has(ref)) issues.push(issue('EVD', 'command_ref_missing', id, { ref }));
    }
    for (const ref of strings(row.artifactRefs)) {
      if (!artifactIds.has(ref)) issues.push(issue('EVD', 'artifact_ref_missing', id, { ref }));
    }
  }

  for (const row of traceRows) {
    const id = text(row.id) || '<missing-trace-id>';
    if (!text(row.id)) issues.push(issue('TRACE', 'trace_id_missing', id));
    for (const ref of strings(row.covers)) {
      if (!requirementIds.has(ref)) issues.push(issue('TRACE', 'requirement_ref_missing', id, { ref }));
    }
    for (const ref of strings(row.evidenceRefs)) {
      if (!evidenceIds.has(ref)) issues.push(issue('TRACE', 'evidence_ref_missing', id, { ref }));
    }
    for (const ref of strings(row.commandRefs)) {
      if (!commandIds.has(ref)) issues.push(issue('TRACE', 'command_ref_missing', id, { ref }));
    }
    for (const ref of strings(row.acceptanceRefs)) {
      if (!acceptanceIds.has(ref)) issues.push(issue('TRACE', 'acceptance_ref_missing', id, { ref }));
    }
    for (const ref of strings(row.artifactRefs)) {
      if (!artifactIds.has(ref)) issues.push(issue('TRACE', 'artifact_ref_missing', id, { ref }));
    }
    const linkedSlices = [
      strings(row.covers).length,
      strings(row.evidenceRefs).length,
      strings(row.commandRefs).length,
      strings(row.acceptanceRefs).length,
      strings(row.artifactRefs).length,
    ];
    if (linkedSlices.some((count) => count === 0)) {
      issues.push(issue('TRACE', 'trace_binding_incomplete', id));
    }
  }

  for (const row of commands) {
    const id = text(row.id) || '<missing-command-id>';
    if (!text(row.id)) issues.push(issue('CMD', 'command_id_missing', id));
    if (!text(row.command)) issues.push(issue('CMD', 'command_text_missing', id));
    const refs = [...strings(row.traceRefs), ...strings(row.evidenceRefs)];
    if (refs.length === 0) issues.push(issue('CMD', 'command_trace_or_evidence_refs_missing', id));
    for (const ref of strings(row.traceRefs)) {
      if (!traceIds.has(ref)) issues.push(issue('CMD', 'trace_ref_missing', id, { ref }));
    }
    for (const ref of strings(row.evidenceRefs)) {
      if (!evidenceIds.has(ref)) issues.push(issue('CMD', 'evidence_ref_missing', id, { ref }));
    }
  }

  for (const row of acceptance) {
    const id = text(row.id) || '<missing-acceptance-id>';
    const category = text(row.kind) === 'e2e' || id.startsWith('E2E-') ? 'E2E' : 'ACC';
    if (!text(row.id)) issues.push(issue(category, 'acceptance_id_missing', id));
    if (strings(row.files).length === 0) issues.push(issue(category, 'acceptance_test_file_ref_missing', id));
    if (!text(row.oracle)) issues.push(issue(category, 'acceptance_oracle_missing', id));
    for (const ref of strings(row.covers)) {
      if (!mustNegIds.has(ref)) issues.push(issue(category, 'requirement_ref_missing', id, { ref }));
    }
    for (const ref of strings(row.traceRefs)) {
      if (!traceIds.has(ref)) issues.push(issue(category, 'trace_ref_missing', id, { ref }));
    }
    for (const ref of strings(row.evidenceRefs)) {
      if (!evidenceIds.has(ref)) issues.push(issue(category, 'evidence_ref_missing', id, { ref }));
    }
    for (const ref of strings(row.commandRefs)) {
      if (!commandIds.has(ref)) issues.push(issue(category, 'command_ref_missing', id, { ref }));
    }
  }

  const coveredRequirements = new Set(explicitAcceptance.flatMap((row) => strings(row.covers)));
  for (const row of [...must, ...neg]) {
    const id = text(row.id);
    if (id && !coveredRequirements.has(id)) {
      issues.push(issue(text(row.kind), 'acceptance_or_e2e_coverage_missing', id));
    }
  }
  const e2eCovered = new Set(e2e.flatMap((row) => strings(row.covers)));
  for (const row of neg) {
    const id = text(row.id);
    if (id && !e2eCovered.has(id)) issues.push(issue('E2E', 'neg_e2e_coverage_missing', id));
  }

  for (const row of proofArtifacts) {
    const id = text(row.id) || '<missing-artifact-id>';
    if (!text(row.id)) issues.push(issue('ART', 'artifact_id_missing', id));
    if (!text(row.pathOrField)) issues.push(issue('ART', 'artifact_path_or_field_missing', id));
    const refs = [...strings(row.traceRefs), ...strings(row.evidenceRefs)];
    if (refs.length === 0) issues.push(issue('ART', 'artifact_trace_or_evidence_refs_missing', id));
    for (const ref of strings(row.traceRefs)) {
      if (!traceIds.has(ref)) issues.push(issue('ART', 'trace_ref_missing', id, { ref }));
    }
    for (const ref of strings(row.evidenceRefs)) {
      if (!evidenceIds.has(ref)) issues.push(issue('ART', 'evidence_ref_missing', id, { ref }));
    }
  }

  for (const row of evidence) {
    const id = text(row.id);
    if (id && !requirements.some((req) => strings(req.evidenceRefs).includes(id)) && !traceRows.some((trace) => strings(trace.evidenceRefs).includes(id))) {
      issues.push(issue('EVD', 'orphan_evidence', id));
    }
  }
  for (const row of commands) {
    const id = text(row.id);
    if (id && !acceptance.some((acc) => strings(acc.commandRefs).includes(id)) && !traceRows.some((trace) => strings(trace.commandRefs).includes(id))) {
      issues.push(issue('CMD', 'orphan_command', id));
    }
  }
  for (const row of proofArtifacts) {
    const id = text(row.id);
    if (id && !artifactReferenced(row)) {
      issues.push(issue('ART', 'orphan_artifact', id));
    }
  }

  const blockingReasons = unique(issues.map((row) => text(row.code)));
  return {
    ready: issues.length === 0,
    decision: issues.length === 0 ? 'pass' : 'blocked',
    blockingReasons,
    issueCount: issues.length,
    issues,
    categoryCounts: {
      MUST: must.length,
      NEG: neg.length,
      OUT: out.length,
      EVD: evidence.length,
      TRACE: traceRows.length,
      CMD: commands.length,
      ACC: acc.length,
      E2E: e2e.length,
      ART: proofArtifacts.length,
      targetModificationPaths: targetModifications.length,
      errorCaseCoverage: objects(errorCoverage.failurePaths).length + objects(errorCoverage.edgeCases).length,
      commandTargetCollection: objects(nested(manifest.commandTargetCollection).rows).length,
      traceClosureAssertions: objects(nested(manifest.traceClosureAssertions).rows).length,
      currentTargetMap: objects(nested(manifest.currentTargetMap).rows).length,
      targetModificationPathCoverage: objects(nested(manifest.targetModificationPathCoverage).rows).length,
      canonicalSurfaceReconciliation: objects(nested(manifest.canonicalSurfaceReconciliation).rows).length,
      legacyDenial: objects(nested(manifest.legacyDenial).rows).length,
      closeoutProof: strings(nested(manifest.closeoutProof).requiredCommands).length,
      evidenceTrustStates: objects(nested(manifest.evidenceTrustStates).rows).length,
    },
  };
}

function commandRunsForAttempt(record: JsonObject, attemptId: string): JsonObject[] {
  return objects(record.executionIterations).flatMap((iteration) =>
    objects(iteration.commandRunRefs)
      .filter((run) => text(run.closeoutAttemptId) === attemptId)
      .map((run) => ({ ...run, executionIterationId: text(iteration.executionIterationId) }))
  );
}

function commandEvidence(record: JsonObject, commandIdValue: string, attemptId: string): JsonObject {
  const runs = commandRunsForAttempt(record, attemptId);
  const run = runs.find((item) => text(item.commandId) === commandIdValue);
  const deliveryCommand = objects(nested(record.deliveryEvidence).requiredCommands).find(
    (item) => text(item.commandId) === commandIdValue || text(item.id) === commandIdValue
  );
  const artifactRefs = [
    ...objects(deliveryCommand?.artifactRefs),
    ...objects(deliveryCommand?.extensionRefs),
  ];
  if (!run) {
    const staleRun = objects(record.executionIterations)
      .flatMap((iteration) => objects(iteration.commandRunRefs))
      .find((item) => text(item.commandId) === commandIdValue);
    return { state: staleRun ? 'stale' : 'blocked', reason: staleRun ? 'stale_attempt' : 'current_attempt_command_missing' };
  }
  if (run.exitCode !== 0) return { state: 'blocked', reason: 'current_attempt_command_failed' };
  if (artifactRefs.length === 0)
    return { state: 'blocked', reason: 'exitCode_only_proof' };
  return { state: 'green', reason: 'current_attempt_command_with_evidence' };
}

function acceptanceFromManifest(manifest: JsonObject): AcceptanceRow[] {
  const explicit = objects(manifest.acceptanceSuites);
  if (explicit.length > 0) return explicit as unknown as AcceptanceRow[];
  return [
    ...(objects(manifest.acceptanceTests) as unknown as AcceptanceRow[]),
    ...(objects(manifest.e2eSuites) as unknown as AcceptanceRow[]),
  ];
}

function commandById(manifest: JsonObject): Map<string, JsonObject> {
  return new Map(objects(manifest.requiredCommands).map((row) => [text(row.id), row]));
}

function preProofFor(row: AcceptanceRow, manifest: JsonObject): RedProofRow | undefined {
  return (objects(manifest.preImplementationRedProofs) as unknown as RedProofRow[]).find(
    (proof) => proof.acceptanceId === row.id || row.commandRefs.includes(proof.commandId)
  );
}

function invalidRedOutput(output: string): boolean {
  return /(?:ENOENT|no such file|cannot find module|syntaxerror|timed out|command not found|not recognized)/iu.test(
    output
  );
}

function executePreImplementationRedProof(
  row: AcceptanceRow,
  manifest: JsonObject,
  timeoutMs: number
): RedProofRow | undefined {
  const commands = commandById(manifest);
  const command = row.commandRefs.map((ref) => commands.get(ref)).find(Boolean);
  const commandText = text(command?.command);
  if (!commandText) return undefined;
  const result = spawnSync(commandText, {
    cwd: process.cwd(),
    shell: true,
    encoding: 'utf8',
    timeout: timeoutMs,
    windowsHide: true,
  });
  const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
  const commandIdValue = text(command?.id) || row.commandRefs[0] || '';
  if (result.error || result.status === null || invalidRedOutput(output)) {
    return {
      acceptanceId: row.id,
      commandId: commandIdValue,
      state: 'invalid_red',
      oracle: row.oracle,
      failureClass: result.error ? 'runner_crash' : 'environment_error',
      proofSource: 'execute_red_proof',
    };
  }
  return {
    acceptanceId: row.id,
    commandId: commandIdValue,
    state: result.status === 0 ? 'unexpected_green' : 'expected_red',
    oracle: row.oracle,
    failureClass: result.status === 0 ? 'unexpected_pass' : 'oracle_failure',
    proofSource: 'execute_red_proof',
  };
}

function preImplementationState(
  row: AcceptanceRow,
  manifest: JsonObject,
  options: { executeRedProof?: boolean; redProofCommandTimeoutMs?: number } = {}
): MatrixRow {
  const missingFiles = row.files.filter((file) => !fileExists(file));
  const controlledProof =
    preProofFor(row, manifest) ??
    (options.executeRedProof
      ? executePreImplementationRedProof(row, manifest, options.redProofCommandTimeoutMs ?? 120000)
      : undefined);
  const proofState =
    controlledProof?.failureClass && INVALID_RED_FAILURE_CLASSES.has(controlledProof.failureClass)
      ? 'invalid_red'
      : controlledProof?.state;
  const state =
    missingFiles.length > 0
      ? 'missing_test'
      : proofState ?? 'missing_plan';
  const reasons =
    state === 'expected_red'
      ? controlledProof && !controlledProof.oracle
        ? ['pre_implementation_red_oracle_missing']
        : []
      : state === 'unexpected_green'
        ? ['unexpected_green']
        : state === 'invalid_red'
          ? ['invalid_red']
          : state === 'missing_test'
            ? ['acceptance_test_file_missing']
            : ['pre_implementation_red_proof_missing'];
  return matrixRow({
    id: row.id,
    category: row.id.startsWith('E2E-') || row.kind === 'e2e' ? 'E2E' : 'ACC',
    expectedPreImplementationState: row.expectedPreImplementationState ?? 'expected_red',
    currentState: state,
    oracle: controlledProof?.oracle || row.oracle,
    commandRefs: row.commandRefs,
    refs: [
      ...row.covers,
      ...row.traceRefs,
      ...row.evidenceRefs,
      controlledProof?.proofSource ? `proof:${controlledProof.proofSource}` : '',
    ],
    blockingReasons: reasons,
  });
}

function matrixRow(input: {
  id: string;
  category: string;
  refs?: string[];
  expectedPreImplementationState?: MatrixState | 'not_applicable';
  currentState: MatrixState;
  oracle?: string;
  commandRefs?: string[];
  artifactRefs?: string[];
  attemptBinding?: 'current' | 'stale' | 'missing' | 'not_applicable';
  blockingReasons?: string[];
}): MatrixRow {
  const blockingReasons = unique(input.blockingReasons ?? []);
  return {
    id: input.id,
    category: input.category,
    refs: unique(input.refs ?? []),
    expectedPreImplementationState: input.expectedPreImplementationState ?? 'not_applicable',
    currentState: input.currentState,
    oracle: input.oracle ?? '',
    commandRefs: unique(input.commandRefs ?? []),
    artifactRefs: unique(input.artifactRefs ?? []),
    attemptBinding: input.attemptBinding ?? 'not_applicable',
    decision: blockingReasons.length === 0 ? 'pass' : 'blocked',
    blockingReasons,
  };
}

function modeMatrix(input: {
  mode: AiTddMode;
  manifest: JsonObject;
  record: JsonObject;
  attemptId: string;
  subReports: JsonObject[];
  executeRedProof?: boolean;
  redProofCommandTimeoutMs?: number;
}): MatrixRow[] {
  const acceptance = acceptanceFromManifest(input.manifest);
  const preOptions = {
    executeRedProof: input.executeRedProof,
    redProofCommandTimeoutMs: input.redProofCommandTimeoutMs,
  };
  const acceptanceRows =
    input.mode === 'pre-implementation'
      ? acceptance.map((row) => preImplementationState(row, input.manifest, preOptions))
      : acceptance.map((row) => acceptanceRuntimeMatrix(row, input.record, input.attemptId, input.mode));
  const commandRows = requiredCommandMatrixRows(input.manifest, input.record, input.attemptId, input.mode);
  const artifactRows = artifactMatrixRows(input.manifest, input.subReports, input.mode);
  const traceRows = traceMatrixRows(input.manifest, acceptanceRows, commandRows, artifactRows, input.mode);
  const evidenceRows = evidenceMatrixRows(input.manifest, acceptanceRows, commandRows, artifactRows, input.mode);
  const requirementRowsAll = requirementMatrixRows(input.manifest, acceptanceRows, input.mode);
  const gateRows = input.subReports.map((report) =>
    matrixRow({
      id: text(report.reportType) || 'sub-gate',
      category: 'GATE',
      currentState: text(report.decision) === 'pass' ? 'green' : 'blocked',
      blockingReasons: strings(report.blockingReasons),
    })
  );
  if (input.mode === 'pre-implementation') {
    return [...requirementRowsAll, ...evidenceRows, ...traceRows, ...commandRows, ...acceptanceRows, ...artifactRows];
  }
  if (input.mode === 'pre-rerun') {
    return [...requirementRowsAll, ...evidenceRows, ...traceRows, ...commandRows, ...acceptanceRows, ...artifactRows, ...gateRows];
  }
  return [...requirementRowsAll, ...evidenceRows, ...traceRows, ...commandRows, ...acceptanceRows, ...artifactRows, ...gateRows];
}

function requirementMatrixRows(
  manifest: JsonObject,
  acceptanceRows: MatrixRow[],
  mode: AiTddMode
): MatrixRow[] {
  return (objects(manifest.requirements) as unknown as RequirementRow[])
    .map((req) => {
      if (req.kind === 'OUT') {
        return matrixRow({
          id: req.id,
          category: req.kind,
          refs: [...req.evidenceRefs, ...req.traceRefs],
          currentState: 'not_applicable',
          oracle: 'scope boundary tracked outside executable acceptance coverage',
        });
      }
      const covering = acceptanceRows.filter((row) => row.refs.includes(req.id));
      if (covering.length === 0) {
        return matrixRow({
          id: req.id,
          category: req.kind,
          refs: [...req.evidenceRefs, ...req.traceRefs],
          currentState: 'missing_plan',
          blockingReasons: ['acceptance_or_e2e_coverage_missing'],
        });
      }
      if (mode === 'pre-implementation') {
        const states = covering.map((row) => row.currentState);
        const bad = states.find((state) => state !== 'expected_red');
        return matrixRow({
          id: req.id,
          category: req.kind,
          refs: covering.map((row) => row.id),
          currentState: bad ?? 'expected_red',
          blockingReasons: bad ? [`requirement_pre_implementation_${bad}`] : [],
        });
      }
      return matrixRow({
        id: req.id,
        category: req.kind,
        refs: covering.map((row) => row.id),
        currentState:
          mode === 'iteration'
            ? covering.some((row) => ['green', 'partial_green'].includes(row.currentState))
              ? 'partial_green'
              : 'blocked'
            : covering.every((row) => row.currentState === 'green')
              ? 'green'
              : 'blocked',
        attemptBinding:
          covering.every((row) => row.attemptBinding === 'current')
            ? 'current'
            : covering.some((row) => row.attemptBinding === 'stale')
              ? 'stale'
              : 'missing',
        blockingReasons:
          mode === 'iteration'
            ? []
            : covering.every((row) => row.currentState === 'green')
              ? []
              : ['requirement_closeout_requires_acceptance_runtime_green'],
      });
    });
}

function acceptanceRuntimeMatrix(
  row: AcceptanceRow,
  record: JsonObject,
  attemptId: string,
  mode: AiTddMode
): MatrixRow {
  if (row.mockOnly) {
    return matrixRow({
      id: row.id,
      category: row.id.startsWith('E2E-') || row.kind === 'e2e' ? 'E2E' : 'ACC',
      refs: row.covers,
      currentState: 'blocked',
      commandRefs: row.commandRefs,
      blockingReasons: ['mock_only_proof_invalid'],
    });
  }
  const missingFiles = row.files.filter((file) => !fileExists(file));
  if (missingFiles.length > 0) {
    return matrixRow({
      id: row.id,
      category: row.id.startsWith('E2E-') || row.kind === 'e2e' ? 'E2E' : 'ACC',
      refs: row.covers,
      currentState: 'missing_test',
      commandRefs: row.commandRefs,
      attemptBinding: 'missing',
      blockingReasons: ['acceptance_test_file_missing'],
    });
  }
  const proofs = row.commandRefs.map((ref) => commandEvidence(record, ref, attemptId));
  const bad = proofs.find((proof) => text(proof.state) !== 'green');
  const state = bad ? (text(bad.state) as MatrixState) : mode === 'iteration' ? 'partial_green' : 'green';
  return matrixRow({
    id: row.id,
    category: row.id.startsWith('E2E-') || row.kind === 'e2e' ? 'E2E' : 'ACC',
    refs: row.covers,
    currentState: state,
    commandRefs: row.commandRefs,
    attemptBinding: bad ? (text(bad.state) === 'stale' ? 'stale' : 'missing') : 'current',
    blockingReasons: bad ? [text(bad.reason)] : [],
  });
}

function requiredCommandMatrixRows(
  manifest: JsonObject,
  record: JsonObject,
  attemptId: string,
  mode: AiTddMode
): MatrixRow[] {
  return objects(manifest.requiredCommands).map((command) => {
    const id = text(command.id) || '<missing-command-id>';
    const missingFiles = strings(command.files).filter((file) => !fileExists(file));
    if (missingFiles.length > 0) {
      return matrixRow({
        id,
        category: 'CMD',
        refs: [...strings(command.traceRefs), ...strings(command.evidenceRefs), ...missingFiles],
        currentState: 'missing_test',
        commandRefs: [id],
        attemptBinding: 'missing',
        blockingReasons: missingFiles.map((file) => `required_command_file_missing:${file}`),
      });
    }
    if (mode === 'pre-implementation') {
      return matrixRow({
        id,
        category: 'CMD',
        refs: [...strings(command.traceRefs), ...strings(command.evidenceRefs)],
        currentState: 'not_applicable',
        commandRefs: [id],
      });
    }
    const proof = commandEvidence(record, id, attemptId);
    const state = text(proof.state) as MatrixState;
    return matrixRow({
      id,
      category: 'CMD',
      refs: [...strings(command.traceRefs), ...strings(command.evidenceRefs)],
      currentState: state === 'green' && mode === 'iteration' ? 'partial_green' : state,
      commandRefs: [id],
      attemptBinding:
        state === 'green' ? 'current' : state === 'stale' ? 'stale' : 'missing',
      blockingReasons: state === 'green' ? [] : [text(proof.reason)],
    });
  });
}

function artifactIssueIndex(subReports: JsonObject[]): Map<string, string[]> {
  const targetReport = subReports.find((report) => text(report.reportType) === 'target_artifact_realization_report');
  const out = new Map<string, string[]>();
  for (const issueRow of objects(targetReport?.issues)) {
    const code = text(issueRow.code);
    for (const ref of strings(issueRow.refs)) {
      out.set(ref, unique([...(out.get(ref) ?? []), code]));
    }
  }
  return out;
}

function artifactMatrixRows(
  manifest: JsonObject,
  subReports: JsonObject[],
  mode: AiTddMode
): MatrixRow[] {
  const issueByRef = artifactIssueIndex(subReports);
  return objects(manifest.targetArtifacts).map((artifact) => {
    const id = text(artifact.id) || text(artifact.pathOrField) || '<missing-artifact-id>';
    const issues = issueByRef.get(id) ?? [];
    if (mode === 'pre-implementation') {
      return matrixRow({
        id,
        category: 'ART',
        refs: [...strings(artifact.traceRefs), ...strings(artifact.evidenceRefs)],
        currentState: text(artifact.pathOrField) ? 'not_applicable' : 'missing_plan',
        artifactRefs: [text(artifact.pathOrField)],
        blockingReasons: text(artifact.pathOrField) ? [] : ['target_artifact_plan_empty'],
      });
    }
    return matrixRow({
      id,
      category: 'ART',
      refs: [...strings(artifact.traceRefs), ...strings(artifact.evidenceRefs)],
      currentState: issues.length === 0 ? (mode === 'iteration' ? 'partial_green' : 'green') : 'missing_artifact',
      artifactRefs: [text(artifact.pathOrField)],
      attemptBinding: issues.includes('target_artifact_attempt_binding_missing') ? 'missing' : issues.length ? 'missing' : 'current',
      blockingReasons: issues,
    });
  });
}

function traceMatrixRows(
  manifest: JsonObject,
  acceptanceRows: MatrixRow[],
  commandRows: MatrixRow[],
  artifactRows: MatrixRow[],
  mode: AiTddMode
): MatrixRow[] {
  return objects(manifest.traceRows).map((trace) => {
    const id = text(trace.id) || '<missing-trace-id>';
    const linked = [
      ...acceptanceRows.filter((row) => strings(trace.acceptanceRefs).includes(row.id)),
      ...acceptanceRows.filter((row) => row.refs.includes(id)),
      ...commandRows.filter((row) => strings(trace.commandRefs).includes(row.id)),
      ...artifactRows.filter((row) => strings(trace.artifactRefs).includes(row.id) || row.refs.includes(id)),
    ];
    const blockers = unique(linked.flatMap((row) => row.blockingReasons));
    const allGreen = linked.length > 0 && linked.every((row) => row.currentState === 'green');
    const hasPartial = linked.some((row) => ['green', 'partial_green', 'expected_red'].includes(row.currentState));
    return matrixRow({
      id,
      category: 'TRACE',
      refs: [
        ...strings(trace.covers),
        ...strings(trace.evidenceRefs),
        ...strings(trace.commandRefs),
        ...strings(trace.acceptanceRefs),
        ...strings(trace.artifactRefs),
      ],
      currentState:
        mode === 'pre-implementation'
          ? hasPartial
            ? 'expected_red'
            : 'missing_plan'
          : mode === 'iteration'
            ? hasPartial
              ? 'partial_green'
              : 'blocked'
            : allGreen
              ? 'green'
              : 'blocked',
      attemptBinding:
        linked.length && linked.every((row) => row.attemptBinding === 'current') ? 'current' : 'missing',
      blockingReasons:
        mode === 'pre-implementation'
          ? hasPartial
            ? []
            : ['trace_acceptance_binding_missing']
          : blockers.length
            ? blockers
            : allGreen || mode === 'iteration'
              ? []
              : ['trace_closeout_requires_linked_rows_green'],
    });
  });
}

function evidenceMatrixRows(
  manifest: JsonObject,
  acceptanceRows: MatrixRow[],
  commandRows: MatrixRow[],
  artifactRows: MatrixRow[],
  mode: AiTddMode
): MatrixRow[] {
  return objects(manifest.evidence).map((evidence) => {
    const id = text(evidence.id) || '<missing-evidence-id>';
    const linked = [
      ...acceptanceRows.filter((row) => row.refs.includes(id)),
      ...commandRows.filter((row) => strings(evidence.requiredCommandRefs).includes(row.id) || row.refs.includes(id)),
      ...artifactRows.filter((row) => strings(evidence.artifactRefs).includes(row.id) || row.refs.includes(id)),
    ];
    const blockers = unique(linked.flatMap((row) => row.blockingReasons));
    const allGreen = linked.length > 0 && linked.every((row) => row.currentState === 'green');
    const hasPartial = linked.some((row) => ['green', 'partial_green', 'expected_red'].includes(row.currentState));
    return matrixRow({
      id,
      category: 'EVD',
      refs: [...strings(evidence.requiredCommandRefs), ...strings(evidence.artifactRefs)],
      currentState:
        mode === 'pre-implementation'
          ? text(evidence.oracle)
            ? 'not_applicable'
            : 'missing_plan'
          : mode === 'iteration'
            ? hasPartial
              ? 'partial_green'
              : 'blocked'
            : allGreen
              ? 'green'
              : 'blocked',
      oracle: text(evidence.oracle),
      commandRefs: strings(evidence.requiredCommandRefs),
      artifactRefs: strings(evidence.artifactRefs),
      attemptBinding:
        linked.length && linked.every((row) => row.attemptBinding === 'current') ? 'current' : 'missing',
      blockingReasons:
        mode === 'pre-implementation'
          ? text(evidence.oracle)
            ? []
            : ['evidence_oracle_missing']
          : blockers.length
            ? blockers
            : allGreen || mode === 'iteration'
              ? []
              : ['evidence_closeout_requires_linked_rows_green'],
    });
  });
}

function subReportsFor(input: {
  mode: AiTddMode;
  sourcePath: string;
  record: JsonObject;
  recordPath: string;
  attemptId: string;
  evaluatedAt: string;
  evaluatedBy: string;
}): JsonObject[] {
  if (input.mode === 'pre-implementation') return [];
  const common = [
    evaluateRequiredCommandFileExistence(input),
    evaluateTargetArtifactRealization(input),
    evaluateCanonicalSchemaReducerGate(input),
    evaluateCanonicalEventRegistryGate(input),
    evaluateReverseAuditReadinessGate(input),
    evaluateCloseoutTargetControlFlowGate(input),
    evaluateExternalBoundaryGate(input),
  ];
  if (input.mode !== 'closeout') return common;
  return [
    ...common,
    evaluateStrictCloseoutProof({
      record: input.record,
      recordPath: input.recordPath,
      attemptId: input.attemptId,
      evaluatedAt: input.evaluatedAt,
      evaluatedBy: input.evaluatedBy,
      sourcePath: input.sourcePath,
    }),
  ];
}

function closeoutReadinessReport(input: {
  mode: AiTddMode;
  matrix: MatrixRow[];
  subReports: JsonObject[];
  missingPlan: JsonObject;
  negativePlan: JsonObject;
  targetPlan: JsonObject;
  contractCompleteness: JsonObject;
}): JsonObject {
  const blockers = [
    ...strings(input.contractCompleteness.blockingReasons),
    ...input.matrix.flatMap((row) => row.blockingReasons),
    ...input.subReports.flatMap((report) => strings(report.blockingReasons)),
    ...(text(input.missingPlan.decision) === 'pass' ? [] : ['missing_test_plan_blocked']),
    ...(text(input.negativePlan.decision) === 'pass' ? [] : ['negative_control_plan_blocked']),
    ...(text(input.targetPlan.decision) === 'pass' ? [] : ['target_artifact_plan_blocked']),
  ];
  const modeAllowsPartial = input.mode === 'iteration';
  if (input.mode === 'pre-implementation') {
    return {
      ready: false,
      mode: input.mode,
      partialOnly: false,
      notReadyReason: 'implementation_not_started',
      blockingReasons: unique(['implementation_not_started', ...blockers]),
      invalidProofTypes: ['legacy_proof', 'exitCode_only', 'mock_only', 'self_certification', 'stale_evidence'],
    };
  }
  return {
    ready: blockers.length === 0 && !modeAllowsPartial,
    mode: input.mode,
    partialOnly: modeAllowsPartial,
    blockingReasons: unique(blockers),
    invalidProofTypes: ['legacy_proof', 'exitCode_only', 'mock_only', 'self_certification', 'stale_evidence'],
  };
}

function preImplementationReadinessReport(input: {
  mode: AiTddMode;
  sourceConfirmed: boolean;
  matrix: MatrixRow[];
  missingPlan: JsonObject;
  negativePlan: JsonObject;
  targetPlan: JsonObject;
  contractCompleteness: JsonObject;
}): JsonObject {
  if (input.mode !== 'pre-implementation') {
    return {
      ready: false,
      mode: input.mode,
      applicable: false,
      requiredProofPolicy: 'controlled_red_proof_or_execute_red_proof_only',
      blockingReasons: ['pre_implementation_readiness_not_applicable_for_mode'],
    };
  }
  const acceptanceRows = input.matrix.filter((row) => row.category === 'ACC' || row.category === 'E2E');
  const validExpectedRed =
    acceptanceRows.length > 0 && acceptanceRows.every((row) => row.currentState === 'expected_red');
  const matrixBlockingRows = input.matrix.filter((row) => row.blockingReasons.length > 0);
  const blockers = unique([
    ...(input.sourceConfirmed ? [] : ['source_implementation_confirmation_not_user_confirmed']),
    ...(input.contractCompleteness.ready === true ? [] : ['contract_completeness_report_blocked']),
    ...strings(input.contractCompleteness.blockingReasons),
    ...(text(input.missingPlan.decision) === 'pass' ? [] : ['missing_test_plan_blocked']),
    ...(text(input.negativePlan.decision) === 'pass' ? [] : ['negative_control_plan_blocked']),
    ...(text(input.targetPlan.decision) === 'pass' ? [] : ['target_artifact_plan_blocked']),
    ...(validExpectedRed ? [] : ['pre_implementation_valid_expected_red_missing']),
    ...matrixBlockingRows.flatMap((row) => row.blockingReasons),
  ]);
  return {
    ready: blockers.length === 0,
    mode: input.mode,
    applicable: true,
    contractComplete:
      input.sourceConfirmed &&
      input.contractCompleteness.ready === true &&
      text(input.missingPlan.decision) === 'pass' &&
      text(input.negativePlan.decision) === 'pass' &&
      text(input.targetPlan.decision) === 'pass',
    validExpectedRed,
    closeoutReady: false,
    requiredProofPolicy: 'controlled_red_proof_or_execute_red_proof_only',
    acceptanceEvidenceRows: acceptanceRows.length,
    blockingReasons: blockers,
  };
}

export function evaluateAiTddContractGate(input: {
  sourcePath: string;
  record: JsonObject;
  recordPath: string;
  mode: AiTddMode;
  attemptId?: string;
  evaluatedAt?: string;
  evaluatedBy?: string;
  executeRedProof?: boolean;
  redProofCommandTimeoutMs?: number;
}): JsonObject {
  return withActiveSourceRoot(input.sourcePath, () => {
    const evaluatedAt = input.evaluatedAt ?? new Date().toISOString();
    const evaluatedBy = input.evaluatedBy ?? 'agent';
    const attemptId = currentAttempt(input.record, input.attemptId);
    const source = readImplementationConfirmation(input.sourcePath);
    const manifest = buildManifest({
      sourcePath: source.sourcePath,
      confirmation: source.confirmation,
      record: input.record,
      recordPath: input.recordPath,
      attemptId,
    });
    const missingPlan = missingTestPlan(manifest);
    const acceptancePlan = {
      decision: text(missingPlan.decision),
      tests: manifest.acceptanceTests,
      e2eSuites: manifest.e2eSuites,
    };
    const targetPlan = targetArtifactPlan(manifest);
    const negativePlan = negativeControlPlan(manifest);
    const contractCompleteness = contractCompletenessReport(manifest);
    const subReports = subReportsFor({
      mode: input.mode,
      sourcePath: source.sourcePath,
      record: input.record,
      recordPath: input.recordPath,
      attemptId,
      evaluatedAt,
      evaluatedBy,
    });
    const matrix = modeMatrix({
      mode: input.mode,
      manifest,
      record: input.record,
      attemptId,
      subReports,
      executeRedProof: input.executeRedProof,
      redProofCommandTimeoutMs: input.redProofCommandTimeoutMs,
    });
    const baseBlockers = [
      ...(text(source.confirmation.status) === 'user_confirmed'
        ? []
        : ['source_implementation_confirmation_not_user_confirmed']),
      ...(text(missingPlan.decision) === 'pass' ? [] : ['missing_test_plan_blocked']),
      ...(text(negativePlan.decision) === 'pass' ? [] : ['negative_control_plan_blocked']),
      ...(text(targetPlan.decision) === 'pass' ? [] : ['target_artifact_plan_blocked']),
    ];
    const matrixBlockers = matrix.flatMap((row) => row.blockingReasons);
    const subReportBlockers = subReports.flatMap((report) =>
      text(report.decision) === 'pass'
        ? []
        : [text(report.reportType) || 'sub_gate_failed', ...strings(report.blockingReasons)]
    );
    const closeout = closeoutReadinessReport({
      mode: input.mode,
      matrix,
      subReports,
      missingPlan,
      negativePlan,
      targetPlan,
      contractCompleteness,
    });
    const preImplementationReadiness = preImplementationReadinessReport({
      mode: input.mode,
      sourceConfirmed: text(source.confirmation.status) === 'user_confirmed',
      matrix,
      missingPlan,
      negativePlan,
      targetPlan,
      contractCompleteness,
    });
    const closeoutBlockers = input.mode === 'closeout' ? strings(closeout.blockingReasons) : [];
    const preImplementationBlockers =
      input.mode === 'pre-implementation' ? strings(preImplementationReadiness.blockingReasons) : [];
    const contractCompletenessBlockers =
      contractCompleteness.ready === true
        ? []
        : ['contract_completeness_report_blocked', ...strings(contractCompleteness.blockingReasons)];
    const blockers = unique([
      ...baseBlockers,
      ...contractCompletenessBlockers,
      ...matrixBlockers,
      ...subReportBlockers,
      ...closeoutBlockers,
      ...preImplementationBlockers,
    ]);
    return {
    reportType: 'ai_tdd_contract_gate_report',
    generatedAt: evaluatedAt,
    generatedBy: evaluatedBy,
    mode: input.mode,
    sourcePath: normalizePath(source.sourcePath),
    recordPath: normalizePath(path.resolve(input.recordPath)),
    currentAttemptId: attemptId,
    decision: blockers.length === 0 ? 'pass' : 'blocked',
    blockingReasons: blockers,
    contractExecutionManifest: manifest,
    redGreenMatrix: matrix,
    missingTestPlan: missingPlan,
    acceptanceE2eTestPlan: acceptancePlan,
    contractCompletenessReport: contractCompleteness,
    targetArtifactPlan: targetPlan,
    negativeControlPlan: negativePlan,
    preImplementationReadinessReport: preImplementationReadiness,
    closeoutReadinessReport: closeout,
    subReports,
    mutationPolicy: {
      writesPass: false,
      closesTrace: false,
      writesRecordClosed: false,
      modifiesSourceTraceRows: false,
    },
    };
  });
}

export function mainAiTddContractGate(argv: string[]): number {
  const args = parseArgs(argv);
  if (args.help) {
    console.log(
      'Usage: ai-tdd-contract-gate --source <requirement.md> --requirement-record <json> --mode <pre-implementation|pre-rerun|iteration|closeout> [--attempt-id <id>] [--report-path <json>] [--json]'
    );
    return 0;
  }
  if (!args.source || !args.requirementRecord || !args.mode)
    throw new Error('missing required args: source, requirementRecord, mode');
  const recordPath = path.resolve(args.requirementRecord);
  const reportPath = path.resolve(
    args.reportPath ??
      path.join(path.dirname(recordPath), `ai-tdd-contract-gate-${args.mode}-report.json`)
  );
  const report = evaluateAiTddContractGate({
    sourcePath: args.source,
    record: readJson(recordPath),
    recordPath,
    mode: args.mode,
    attemptId: args.attemptId,
    evaluatedAt: args.evaluatedAt,
    evaluatedBy: args.evaluatedBy,
    executeRedProof: args.executeRedProof,
    redProofCommandTimeoutMs: args.redProofCommandTimeoutMs
      ? Number(args.redProofCommandTimeoutMs)
      : undefined,
  });
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  const output = {
    ok: true,
    reportPath: normalizePath(reportPath),
    decision: report.decision,
    blockingReasons: report.blockingReasons,
    contractComplete: nested(report.contractCompletenessReport).ready === true,
    preImplementationReady: nested(report.preImplementationReadinessReport).ready === true,
    closeoutReady: nested(report.closeoutReadinessReport).ready === true,
  };
  process.stdout.write(
    args.json ? `${JSON.stringify(output, null, 2)}\n` : `ai_tdd_contract_gate=${report.decision}\n`
  );
  return text(report.decision) === 'pass' ? 0 : 1;
}

export function aiTddContractGateRequired(record: JsonObject, sourcePath?: string): boolean {
  if (text(nested(record.aiTddContractGate).enforcementMode) === 'skipped_by_policy') return false;
  if (nested(record.aiTddContractGate).required === true) return true;
  if (nested(record.closeout).aiTddContractGateRequired === true) return true;
  if (text(record.status) === 'user_confirmed' && (text(sourcePath) || text(record.sourcePath))) return true;
  return objects(nested(record.deliveryEvidence).requiredCommands).some((command) =>
    AI_TDD_COMMAND_IDS.has(text(command.commandId) || text(command.id))
  );
}

if (require.main === module) {
  try {
    process.exitCode = mainAiTddContractGate(process.argv.slice(2));
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
