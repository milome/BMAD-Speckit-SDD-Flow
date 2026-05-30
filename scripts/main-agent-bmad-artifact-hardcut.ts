/* eslint-disable no-console */
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as yaml from 'js-yaml';

type JsonObject = Record<string, unknown>;
type Decision = 'pass' | 'blocked';

interface ParsedArgs {
  projectRoot?: string;
  requirementRecord?: string;
  out?: string;
  generatedAt?: string;
  generatedBy?: string;
  json?: boolean;
  help?: boolean;
}

interface Check {
  id: string;
  decision: Decision;
  summary: string;
  details?: JsonObject;
}

const LEGACY_RUNTIME_PREFIXES = [
  '_bmad-output/runtime/bmad-help-five-layer/',
  '_bmad-output/runtime/context/',
  '_bmad-output/runtime/gates/',
  '_bmad-output/runtime/governance/',
];

const AUTHORING_OUTPUT_PREFIXES = [
  '_bmad-output/planning-artifacts/',
  '_bmad-output/implementation-artifacts/',
];

const REQUIREMENT_RUNTIME_PREFIX = '_bmad-output/runtime/requirement-records/';
const DOCS_REFERENCE_PREFIX = 'docs/reference/';
const ARCHIVED_STATUSES = new Set(['archived', 'legacy_diagnostic', 'superseded', 'deleted']);
const DOCS_REFERENCE_ALLOWED_ROLES = new Set([
  'schema',
  'contract_definition',
  'reference',
  'validation_input',
]);

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

function arrayOfObjects(value: unknown): JsonObject[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is JsonObject =>
          Boolean(item) && typeof item === 'object' && !Array.isArray(item)
      )
    : [];
}

function normalizePathForRecord(value: string): string {
  return value.replace(/\\/gu, '/').replace(/^\.\//u, '');
}

function sha256File(file: string): string {
  return `sha256:${crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}`;
}

function readJson(file: string): JsonObject {
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`JSON object expected: ${file}`);
  }
  return parsed as JsonObject;
}

function writeJson(file: string, value: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function relativeToRoot(projectRoot: string, file: string): string {
  return normalizePathForRecord(path.relative(projectRoot, file));
}

function resolveFirstExisting(projectRoot: string, candidates: string[]): string | null {
  for (const candidate of candidates) {
    const absolute = path.join(projectRoot, candidate);
    if (fs.existsSync(absolute)) return absolute;
  }
  return null;
}

function parseCsvRows(content: string): JsonObject[] {
  const lines = content.split(/\r?\n/u).filter((line) => line.trim());
  if (lines.length === 0) return [];
  const headers = splitCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const cells = splitCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? '']));
  });
}

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
      continue;
    }
    if (char === '"') {
      quoted = !quoted;
      continue;
    }
    if (char === ',' && !quoted) {
      cells.push(current);
      current = '';
      continue;
    }
    current += char;
  }
  cells.push(current);
  return cells.map((cell) => cell.trim());
}

function checkBmadCatalog(projectRoot: string): Check {
  const catalogPath = path.join(projectRoot, '_bmad', '_config', 'bmad-help.csv');
  if (!fs.existsSync(catalogPath)) {
    return { id: 'bmad-catalog-loaded', decision: 'blocked', summary: 'BMAD catalog missing' };
  }
  const rows = parseCsvRows(fs.readFileSync(catalogPath, 'utf8'));
  const requiredAuthoring = {
    prd: ['prd'],
    architecture: ['architecture', 'arch'],
    epics: ['epics', 'epic'],
    story: ['story'],
  };
  const foundOutputs = new Set<keyof typeof requiredAuthoring>();
  for (const row of rows) {
    const searchable = [
      row.outputs,
      row.name,
      row.command,
      row['workflow-file'],
      row.description,
      row['output-location'],
    ]
      .map(text)
      .join(' ')
      .toLowerCase();
    for (const [key, tokens] of Object.entries(requiredAuthoring) as Array<
      [keyof typeof requiredAuthoring, string[]]
    >) {
      if (
        tokens.some((token) => new RegExp(`(^|[^a-z])${token}([^a-z]|$)`, 'u').test(searchable))
      ) {
        foundOutputs.add(key);
      }
    }
  }
  const missing = Object.keys(requiredAuthoring).filter(
    (item) => !foundOutputs.has(item as keyof typeof requiredAuthoring)
  );
  return {
    id: 'bmad-catalog-loaded',
    decision: missing.length === 0 ? 'pass' : 'blocked',
    summary:
      missing.length === 0
        ? 'BMAD catalog preserves native authoring outputs'
        : 'BMAD catalog misses native authoring outputs',
    details: {
      path: relativeToRoot(projectRoot, catalogPath),
      rowCount: rows.length,
      requiredAuthoring,
      foundOutputs: [...foundOutputs],
      missingOutputs: missing,
    },
  };
}

function checkBmadWorkflow(projectRoot: string): Check {
  const workflowPath = resolveFirstExisting(projectRoot, [
    '_bmad/core/skills/bmad-help/workflow.md',
    '_bmad/skills/bmad-help/workflow.md',
  ]);
  if (!workflowPath) {
    return {
      id: 'bmad-native-workflow-preserved',
      decision: 'blocked',
      summary: 'bmad-help workflow missing',
    };
  }
  const content = fs.readFileSync(workflowPath, 'utf8');
  const requiredTokens = [
    'ROUTING RULES',
    'Artifacts reveal completion',
    'OFFICIAL EXECUTION PATHS',
    '_bmad/_config/bmad-help.csv',
  ];
  const missing = requiredTokens.filter((token) => !content.includes(token));
  return {
    id: 'bmad-native-workflow-preserved',
    decision: missing.length === 0 ? 'pass' : 'blocked',
    summary:
      missing.length === 0
        ? 'BMAD native routing workflow is preserved'
        : 'BMAD native routing workflow lost required semantics',
    details: {
      path: relativeToRoot(projectRoot, workflowPath),
      requiredTokens,
      missingTokens: missing,
    },
  };
}

function checkBmadAuthoringPaths(projectRoot: string): Check {
  const configPath = path.join(projectRoot, '_bmad', 'bmm', 'config.yaml');
  if (!fs.existsSync(configPath)) {
    return {
      id: 'bmad-authoring-paths-preserved',
      decision: 'blocked',
      summary: 'BMM config missing',
    };
  }
  const config = yaml.load(fs.readFileSync(configPath, 'utf8')) as JsonObject;
  const planning = text(config.planning_artifacts);
  const implementation = text(config.implementation_artifacts);
  const missing: string[] = [];
  if (!planning.includes('_bmad-output/planning-artifacts')) missing.push('planning_artifacts');
  if (!implementation.includes('_bmad-output/implementation-artifacts'))
    missing.push('implementation_artifacts');
  return {
    id: 'bmad-authoring-paths-preserved',
    decision: missing.length === 0 ? 'pass' : 'blocked',
    summary:
      missing.length === 0
        ? 'BMAD planning and implementation artifact roots are preserved'
        : 'BMAD authoring output roots changed',
    details: {
      path: relativeToRoot(projectRoot, configPath),
      planning_artifacts: planning,
      implementation_artifacts: implementation,
      missing,
    },
  };
}

function checkFiveLayerMapping(projectRoot: string): Check {
  const mappingPath = path.join(projectRoot, '_bmad', '_config', 'stage-mapping.yaml');
  if (!fs.existsSync(mappingPath)) {
    return {
      id: 'bmad-five-layer-mapping-defined',
      decision: 'blocked',
      summary: 'stage mapping missing',
    };
  }
  const mapping = yaml.load(fs.readFileSync(mappingPath, 'utf8')) as JsonObject;
  const layerToStages = mapping.layer_to_stages as JsonObject | undefined;
  const requiredLayers = ['layer_1', 'layer_2', 'layer_3', 'layer_4', 'layer_5'];
  const missing = requiredLayers.filter((layer) => !layerToStages?.[layer]);
  return {
    id: 'bmad-five-layer-mapping-defined',
    decision: missing.length === 0 ? 'pass' : 'blocked',
    summary:
      missing.length === 0
        ? 'BMAD five-layer mapping remains available'
        : 'BMAD five-layer mapping is incomplete',
    details: {
      path: relativeToRoot(projectRoot, mappingPath),
      requiredLayers,
      missingLayers: missing,
    },
  };
}

function collectRecordArtifacts(record: JsonObject): JsonObject[] {
  const direct = [...arrayOfObjects(record.artifactIndex), ...arrayOfObjects(record.extensionRefs)];
  const deliveryEvidence = record.deliveryEvidence as JsonObject | undefined;
  const commandArtifacts = arrayOfObjects(deliveryEvidence?.requiredCommands).flatMap((command) =>
    arrayOfObjects(command.artifactRefs)
  );
  return [...direct, ...commandArtifacts];
}

function checkArtifactBoundary(record: JsonObject | null): Check {
  if (!record) {
    return {
      id: 'artifact-boundary-hardcut',
      decision: 'pass',
      summary:
        'No requirement record supplied; artifact boundary check limited to static BMAD config',
      details: { recordSupplied: false },
    };
  }

  const legacyViolations: JsonObject[] = [];
  const docsReferenceViolations: JsonObject[] = [];
  const requirementScopedArtifacts: JsonObject[] = [];
  const authoringArtifacts: JsonObject[] = [];

  for (const artifact of collectRecordArtifacts(record)) {
    const artifactPath = normalizePathForRecord(text(artifact.path));
    const role = text(artifact.sourceOfTruthRole);
    const status = text(artifact.status);
    if (!artifactPath) continue;
    if (artifactPath.startsWith(REQUIREMENT_RUNTIME_PREFIX)) {
      requirementScopedArtifacts.push({ path: artifactPath, role, status });
    }
    if (AUTHORING_OUTPUT_PREFIXES.some((prefix) => artifactPath.startsWith(prefix))) {
      authoringArtifacts.push({ path: artifactPath, role, status });
    }
    if (
      LEGACY_RUNTIME_PREFIXES.some((prefix) => artifactPath.startsWith(prefix)) &&
      !ARCHIVED_STATUSES.has(status)
    ) {
      legacyViolations.push({ path: artifactPath, role, status });
    }
    if (artifactPath.startsWith(DOCS_REFERENCE_PREFIX) && !DOCS_REFERENCE_ALLOWED_ROLES.has(role)) {
      docsReferenceViolations.push({ path: artifactPath, role, status });
    }
  }

  const blockingIssues = [
    ...legacyViolations.map((item) => `legacy_runtime_artifact_still_active:${item.path}`),
    ...docsReferenceViolations.map(
      (item) => `docs_reference_cannot_be_completion_evidence:${item.path}`
    ),
  ];

  return {
    id: 'artifact-boundary-hardcut',
    decision: blockingIssues.length === 0 ? 'pass' : 'blocked',
    summary:
      blockingIssues.length === 0
        ? 'No active control/evidence artifact uses legacy runtime or docs/reference completion paths'
        : 'Artifact boundary hardcut violations found',
    details: {
      blockingIssues,
      legacyRuntimePrefixes: LEGACY_RUNTIME_PREFIXES,
      requirementRuntimePrefix: REQUIREMENT_RUNTIME_PREFIX,
      authoringOutputPrefixes: AUTHORING_OUTPUT_PREFIXES,
      docsReferenceAllowedRoles: [...DOCS_REFERENCE_ALLOWED_ROLES],
      requirementScopedArtifactCount: requirementScopedArtifacts.length,
      authoringArtifactCount: authoringArtifacts.length,
      legacyViolations,
      docsReferenceViolations,
    },
  };
}

function buildHardcutMatrix(): JsonObject[] {
  return [
    {
      pathPattern: '_bmad-output/planning-artifacts/**',
      targetRole: 'bmad_native_authoring_artifact',
      targetState: 'preserved',
      canAffectControlFlow: false,
      rationale:
        'BMAD Product Brief, PRD, Architecture, and Epics authoring outputs remain native BMAD workflow artifacts.',
    },
    {
      pathPattern: '_bmad-output/implementation-artifacts/**',
      targetRole: 'bmad_native_implementation_artifact',
      targetState: 'preserved',
      canAffectControlFlow: false,
      rationale:
        'BMAD story/task/audit documents remain native workflow artifacts and are indexed as evidence when used by requirement records.',
    },
    {
      pathPattern: '_bmad-output/runtime/requirement-records/<requirement-set-id>/**',
      targetRole: 'requirement_scoped_runtime_artifact',
      targetState: 'required_for_new_control_projection_and_evidence',
      canAffectControlFlow: true,
      rationale:
        'New controlled runtime state, projections, recovery, and evidence must be requirement-scoped.',
    },
    {
      pathPattern: 'docs/reference/**',
      targetRole: 'schema_or_contract_definition_only',
      targetState: 'not_completion_evidence',
      canAffectControlFlow: false,
      rationale:
        'Reference schemas define or validate contracts; they do not prove runtime completion.',
    },
    ...LEGACY_RUNTIME_PREFIXES.map((prefix) => ({
      pathPattern: `${prefix}**`,
      targetRole: 'legacy_diagnostic_only',
      targetState: 'forbidden_for_new_outputs',
      canAffectControlFlow: false,
      rationale:
        'Useful producer capability must write directly to requirement-scoped paths; old runtime roots cannot be new control or pass evidence outputs.',
    })),
  ];
}

function buildReport(input: {
  projectRoot: string;
  requirementRecordPath: string | null;
  generatedAt: string;
  generatedBy: string;
}): JsonObject {
  const record = input.requirementRecordPath ? readJson(input.requirementRecordPath) : null;
  const checks = [
    checkBmadCatalog(input.projectRoot),
    checkBmadWorkflow(input.projectRoot),
    checkBmadAuthoringPaths(input.projectRoot),
    checkFiveLayerMapping(input.projectRoot),
    checkArtifactBoundary(record),
  ];
  const blockingIssues = checks
    .filter((check) => check.decision === 'blocked')
    .flatMap((check) => {
      const detailIssues = Array.isArray(check.details?.blockingIssues)
        ? (check.details.blockingIssues as string[])
        : [];
      return detailIssues.length > 0 ? detailIssues : [check.id];
    });
  const decision: Decision = blockingIssues.length === 0 ? 'pass' : 'blocked';
  return {
    reportType: 'bmad_artifact_hardcut_report',
    generatedAt: input.generatedAt,
    generatedBy: input.generatedBy,
    decision,
    blockingIssues,
    recordId: text(record?.recordId) || null,
    requirementSetId: text(record?.requirementSetId) || null,
    sourceDocumentHash: text(record?.sourceDocumentHash) || null,
    implementationConfirmationHash: text(record?.implementationConfirmationHash) || null,
    architectureConfirmationHash:
      text(
        (record?.architectureConfirmationState as JsonObject | undefined)
          ?.currentArchitectureConfirmationHash
      ) || null,
    inputs: {
      projectRoot: normalizePathForRecord(input.projectRoot),
      requirementRecordPath: input.requirementRecordPath
        ? normalizePathForRecord(input.requirementRecordPath)
        : null,
    },
    hardcutMatrix: buildHardcutMatrix(),
    checks,
  };
}

function defaultOutPath(projectRoot: string, requirementRecordPath: string | null): string {
  if (requirementRecordPath) {
    return path.join(
      path.dirname(requirementRecordPath),
      'evidence',
      'TRACE-011',
      'bmad-artifact-hardcut-report.json'
    );
  }
  return path.join(
    projectRoot,
    '_bmad-output',
    'runtime',
    'requirement-records',
    'artifact-hardcut-report.json'
  );
}

export function mainBmadArtifactHardcut(argv: string[]): number {
  const args = parseArgs(argv);
  if (args.help) {
    console.log(
      'Usage: main-agent-bmad-artifact-hardcut --requirement-record <json> [--out <json>] [--json]'
    );
    return 0;
  }
  const projectRoot = path.resolve(args.projectRoot ?? process.cwd());
  const requirementRecordPath = args.requirementRecord
    ? path.resolve(args.requirementRecord)
    : null;
  const generatedAt = args.generatedAt ?? new Date().toISOString();
  const generatedBy = args.generatedBy ?? 'agent';
  const report = buildReport({ projectRoot, requirementRecordPath, generatedAt, generatedBy });
  const outPath = path.resolve(args.out ?? defaultOutPath(projectRoot, requirementRecordPath));
  writeJson(outPath, report);
  const output = {
    ok: true,
    decision: report.decision,
    reportPath: normalizePathForRecord(outPath),
    reportHash: sha256File(outPath),
    blockingIssues: report.blockingIssues,
  };
  process.stdout.write(
    args.json
      ? `${JSON.stringify(output, null, 2)}\n`
      : `bmad_artifact_hardcut=${report.decision}\n`
  );
  return report.decision === 'pass' ? 0 : 1;
}

if (require.main === module) {
  try {
    process.exitCode = mainBmadArtifactHardcut(process.argv.slice(2));
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
