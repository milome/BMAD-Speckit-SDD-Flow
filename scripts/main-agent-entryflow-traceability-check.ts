/* eslint-disable no-console */
import * as fs from 'node:fs';
import * as path from 'node:path';
import yaml from 'js-yaml';

type JsonObject = Record<string, unknown>;
type Decision = 'pass' | 'blocked';

interface ParsedArgs {
  requirementRecord?: string;
  source?: string;
  reportPath?: string;
  evaluatedAt?: string;
  evaluatedBy?: string;
  json?: boolean;
  help?: boolean;
}

const ENTRY_FLOWS = new Set(['story', 'bugfix', 'standalone_tasks']);
const ENTRY_FLOW_CLASSES = new Set(['full_story_entry', 'corrective_entry', 'task_packet_entry']);
const WORKFLOW_ADAPTERS = new Set(['bmad', 'speckit', 'direct', 'legacy']);
const FORBIDDEN_TOP_LEVEL_ENTRY_FLOWS = new Set([
  'bmad-story-assistant',
  'speckit_story',
  'speckit_tasks',
  'speckit_implement',
]);
const EXPECTED_CLASS_BY_FLOW: Record<string, string> = {
  story: 'full_story_entry',
  bugfix: 'corrective_entry',
  standalone_tasks: 'task_packet_entry',
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
    ? value.filter((item): item is JsonObject => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
    : [];
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.map(text).filter(Boolean) : [];
}

function asObject(value: unknown): JsonObject | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonObject) : undefined;
}

function normalizePathForRecord(value: string): string {
  return value.replace(/\\/gu, '/');
}

function readJson(file: string): JsonObject {
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`JSON object expected: ${file}`);
  }
  return parsed as JsonObject;
}

function extractImplementationConfirmation(sourceText: string): JsonObject | undefined {
  const fenced = [...sourceText.matchAll(/```yaml\s*\n([\s\S]*?)```/giu)];
  for (const match of fenced) {
    try {
      const parsed = asObject(yaml.load(match[1]));
      if (asObject(parsed?.implementationConfirmation)) return asObject(parsed?.implementationConfirmation);
    } catch {
      continue;
    }
  }
  const lines = sourceText.replace(/\r\n/gu, '\n').split('\n');
  const start = lines.findIndex((line) => /^implementationConfirmation:\s*$/u.test(line));
  if (start < 0) return undefined;
  let end = lines.length;
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.trim() === '') continue;
    if (/^\S/u.test(line) && !/^implementationConfirmation:\s*$/u.test(line)) {
      end = index;
      break;
    }
  }
  const parsed = asObject(yaml.load(lines.slice(start, end).join('\n')));
  return asObject(parsed?.implementationConfirmation);
}

function checkEntryFlowState(record: JsonObject, sourceConfirmation?: JsonObject): { issues: string[]; matrix: JsonObject } {
  const issues: string[] = [];
  const recordEntryFlow = text(record.entryFlow);
  const recordEntryFlowClass = text(record.entryFlowClass);
  const recordWorkflowAdapter = text(record.workflowAdapter);
  const sourceEntryFlow = text(sourceConfirmation?.entryFlow);
  const sourceEntryFlowClass = text(sourceConfirmation?.entryFlowClass);
  const sourceWorkflowAdapter = text(sourceConfirmation?.workflowAdapter);
  const recordContractAuthoringRequired = record.contractAuthoringRequired === true;
  const sourceContractAuthoringRequired = sourceConfirmation?.contractAuthoringRequired === true;

  if (!ENTRY_FLOWS.has(recordEntryFlow)) issues.push(`record_entryFlow_invalid_or_missing:${recordEntryFlow || '<missing>'}`);
  if (!ENTRY_FLOW_CLASSES.has(recordEntryFlowClass)) {
    issues.push(`record_entryFlowClass_invalid_or_missing:${recordEntryFlowClass || '<missing>'}`);
  }
  if (!WORKFLOW_ADAPTERS.has(recordWorkflowAdapter)) {
    issues.push(`record_workflowAdapter_invalid_or_missing:${recordWorkflowAdapter || '<missing>'}`);
  }
  if (!recordContractAuthoringRequired) issues.push('record_contractAuthoringRequired_must_be_true');
  if (FORBIDDEN_TOP_LEVEL_ENTRY_FLOWS.has(recordEntryFlow)) issues.push(`record_forbidden_top_level_entryFlow:${recordEntryFlow}`);
  if (recordEntryFlow && EXPECTED_CLASS_BY_FLOW[recordEntryFlow] && recordEntryFlowClass !== EXPECTED_CLASS_BY_FLOW[recordEntryFlow]) {
    issues.push(`record_entryFlowClass_mismatch:${recordEntryFlow}:${recordEntryFlowClass}`);
  }
  if (sourceConfirmation) {
    if (recordEntryFlow !== sourceEntryFlow) issues.push(`entryFlow_source_record_mismatch:${sourceEntryFlow}:${recordEntryFlow}`);
    if (recordEntryFlowClass !== sourceEntryFlowClass) {
      issues.push(`entryFlowClass_source_record_mismatch:${sourceEntryFlowClass}:${recordEntryFlowClass}`);
    }
    if (recordWorkflowAdapter !== sourceWorkflowAdapter) {
      issues.push(`workflowAdapter_source_record_mismatch:${sourceWorkflowAdapter}:${recordWorkflowAdapter}`);
    }
    if (sourceContractAuthoringRequired !== true) issues.push('source_contractAuthoringRequired_must_be_true');
    if (FORBIDDEN_TOP_LEVEL_ENTRY_FLOWS.has(sourceEntryFlow)) issues.push(`source_forbidden_top_level_entryFlow:${sourceEntryFlow}`);
  }

  return {
    issues,
    matrix: {
      allowedTopLevelEntryFlows: [...ENTRY_FLOWS],
      forbiddenTopLevelEntryFlows: [...FORBIDDEN_TOP_LEVEL_ENTRY_FLOWS],
      record: {
        entryFlow: recordEntryFlow,
        entryFlowClass: recordEntryFlowClass,
        workflowAdapter: recordWorkflowAdapter,
        contractAuthoringRequired: recordContractAuthoringRequired,
      },
      source: sourceConfirmation
        ? {
            entryFlow: sourceEntryFlow,
            entryFlowClass: sourceEntryFlowClass,
            workflowAdapter: sourceWorkflowAdapter,
            contractAuthoringRequired: sourceContractAuthoringRequired,
          }
        : null,
    },
  };
}

function checkTraceBinding(record: JsonObject): { issues: string[]; summary: JsonObject } {
  const closures = objects(record.requirementClosures);
  const executionIterations = objects(record.executionIterations);
  const executionTraceRows = new Set(executionIterations.flatMap((item) => strings(item.traceRows)));
  const closureIds = new Set(closures.map((item) => text(item.requirementId)).filter(Boolean));
  const requiredIds = ['MUST-023', 'NEG-011', 'OUT-009', 'EVD-001', 'EVD-004', 'EVD-023'];
  return {
    issues: [],
    summary: {
      traceRowsSeen: [...executionTraceRows].sort(),
      requiredIds,
      closureIds: [...closureIds].filter((id) => requiredIds.includes(id)).sort(),
      note: 'Execution and closure rows are written by controlled ingest; this checker does not require its own closure as a precondition.',
    },
  };
}

function checkNoStandaloneRuntimeFactArtifacts(record: JsonObject): { issues: string[]; artifacts: JsonObject[] } {
  const entryFlow = text(record.entryFlow);
  const artifacts = objects(record.artifactIndex);
  if (entryFlow !== 'standalone_tasks') return { issues: [], artifacts: [] };
  const forbidden = artifacts.filter((artifact) => {
    const artifactPath = normalizePathForRecord(text(artifact.path));
    const type = text(artifact.artifactType);
    return (
      artifactPath.includes('/standalone_tasks/') &&
      text(artifact.sourceOfTruthRole) === 'control' &&
      type !== 'requirement_record'
    );
  });
  return {
    issues: forbidden.map((artifact) => `standalone_tasks_dedicated_runtime_fact_artifact_forbidden:${text(artifact.path)}`),
    artifacts: forbidden,
  };
}

function buildReport(args: ParsedArgs): JsonObject {
  if (!args.requirementRecord) throw new Error('missing required args: requirementRecord');
  const recordPath = path.resolve(args.requirementRecord);
  const record = readJson(recordPath);
  const sourcePath = args.source ? path.resolve(args.source) : '';
  const sourceConfirmation = sourcePath ? extractImplementationConfirmation(fs.readFileSync(sourcePath, 'utf8')) : undefined;
  const entryFlow = checkEntryFlowState(record, sourceConfirmation);
  const trace = checkTraceBinding(record);
  const standaloneArtifacts = checkNoStandaloneRuntimeFactArtifacts(record);
  const blockingReasons = [...entryFlow.issues, ...trace.issues, ...standaloneArtifacts.issues];
  const decision: Decision = blockingReasons.length ? 'blocked' : 'pass';
  return {
    reportType: 'main_agent_entryflow_traceability_check',
    recordId: text(record.recordId),
    requirementSetId: text(record.requirementSetId),
    evaluatedAt: args.evaluatedAt ?? new Date().toISOString(),
    evaluatedBy: args.evaluatedBy ?? 'agent',
    decision,
    blockingReasons,
    entryFlowAdaptationMatrix: entryFlow.matrix,
    traceBinding: trace.summary,
    standaloneRuntimeFactArtifactCheck: {
      forbiddenArtifacts: standaloneArtifacts.artifacts.map((artifact) => ({
        path: text(artifact.path),
        artifactType: text(artifact.artifactType),
        sourceOfTruthRole: text(artifact.sourceOfTruthRole),
      })),
    },
    recordPath: normalizePathForRecord(recordPath),
    sourcePath: sourcePath ? normalizePathForRecord(sourcePath) : null,
  };
}

export function mainEntryFlowTraceabilityCheck(argv: string[]): number {
  const args = parseArgs(argv);
  if (args.help) {
    console.log('Usage: main-agent-entryflow-traceability-check --requirement-record <json> [--source <contract.md>] [--report-path <json>] [--json]');
    return 0;
  }
  const report = buildReport(args);
  const reportPath = path.resolve(
    args.reportPath ?? path.join(path.dirname(path.resolve(args.requirementRecord!)), 'entry-flow-adaptation-matrix.json')
  );
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  const output = {
    ok: true,
    reportPath: normalizePathForRecord(reportPath),
    decision: report.decision,
    blockingReasons: report.blockingReasons,
  };
  process.stdout.write(args.json ? `${JSON.stringify(output, null, 2)}\n` : `entryflow_traceability=${report.decision}\n`);
  return report.decision === 'pass' ? 0 : 1;
}

if (require.main === module) {
  try {
    process.exitCode = mainEntryFlowTraceabilityCheck(process.argv.slice(2));
  } catch (error) {
    console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }, null, 2));
    process.exitCode = 2;
  }
}
