/* eslint-disable no-console */
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  sha256Object,
  validateSubagentEvidenceEnvelope,
  type SubagentEvidenceEnvelopeValidation,
} from './subagent-evidence-envelope';

type JsonObject = Record<string, unknown>;

const SCHEMA_VERSION = 'subagent-current-attempt-revalidation/v1';

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

function readJson(file: string): JsonObject {
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error(`JSON object expected: ${file}`);
  return parsed as JsonObject;
}

function sha256File(file: string): string {
  return `sha256:${crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}`;
}

function normalizePath(value: string): string {
  return value.replace(/\\/gu, '/');
}

function absoluteArtifactPath(projectRoot: string, artifactPath: string): string {
  return path.isAbsolute(artifactPath) ? artifactPath : path.resolve(projectRoot, artifactPath);
}

function currentAttemptId(record: JsonObject): string {
  const closeout = record.closeout && typeof record.closeout === 'object' && !Array.isArray(record.closeout)
    ? (record.closeout as JsonObject)
    : {};
  return text(closeout.currentAttemptId);
}

function currentArchitectureHash(record: JsonObject): string {
  const state = record.architectureConfirmationState && typeof record.architectureConfirmationState === 'object' && !Array.isArray(record.architectureConfirmationState)
    ? (record.architectureConfirmationState as JsonObject)
    : {};
  return text(state.currentArchitectureConfirmationHash);
}

function artifactIssues(projectRoot: string, artifact: JsonObject, index: number): string[] {
  const issues: string[] = [];
  const prefix = `artifact_${index}`;
  const artifactPath = text(artifact.path);
  const hash = text(artifact.hash ?? artifact.contentHash);
  if (text(artifact.sourceOfTruthRole) !== 'evidence') issues.push(`${prefix}_source_of_truth_role_not_evidence`);
  if (!artifactPath) issues.push(`${prefix}_path_missing`);
  if (!hash) issues.push(`${prefix}_hash_missing`);
  if (strings(artifact.relatedRequirementIds).length === 0) issues.push(`${prefix}_related_requirement_ids_missing`);
  const absolute = artifactPath ? absoluteArtifactPath(projectRoot, artifactPath) : '';
  if (absolute && fs.existsSync(absolute) && hash && sha256File(absolute) !== hash) {
    issues.push(`${prefix}_hash_mismatch:${normalizePath(artifactPath)}`);
  }
  return issues;
}

function workspaceIssues(projectRoot: string, envelope: JsonObject): string[] {
  const workspaceRef =
    envelope.workspaceRef && typeof envelope.workspaceRef === 'object' && !Array.isArray(envelope.workspaceRef)
      ? (envelope.workspaceRef as JsonObject)
      : {};
  const kind = text(workspaceRef.kind);
  const workspacePath = text(workspaceRef.path);
  const issues: string[] = [];
  if (kind !== 'main_workspace') issues.push(`subagent_revalidation_workspace_not_main:${kind || '<missing>'}`);
  if (!workspacePath) {
    issues.push('subagent_revalidation_workspace_path_missing');
  } else if (path.resolve(workspacePath) !== path.resolve(projectRoot)) {
    issues.push('subagent_revalidation_workspace_path_mismatch');
  }
  if (!text(workspaceRef.commitBefore) || !text(workspaceRef.commitAfter)) {
    issues.push('subagent_revalidation_workspace_commit_ref_missing');
  }
  return issues;
}

function currentAttemptEnvelopeIssues(validation: SubagentEvidenceEnvelopeValidation): string[] {
  return validation.mismatches.filter((issue) => {
    if (/^subagent_envelope_artifact_ref_\d+_hash_mismatch:/u.test(issue)) return false;
    if (issue === 'subagent_envelope_source_document_hash_mismatch') return false;
    if (issue === 'subagent_envelope_implementation_confirmation_hash_mismatch') return false;
    if (issue === 'subagent_envelope_architecture_confirmation_hash_mismatch') return false;
    if (issue === 'subagent_envelope_status_accepted_with_validation_errors') return false;
    return true;
  });
}

function hasFreshMainWorkspaceCommandEvidence(
  record: JsonObject,
  envelope: JsonObject,
  projectRoot: string,
  attemptId: string,
  commandRuns: JsonObject[]
): boolean {
  if (!attemptId || commandRuns.length === 0) return false;
  const traceRows = strings(envelope.traceRows);
  const coveredRequirementIds = strings(envelope.coveredRequirementIds);
  const commandArtifacts = commandRuns.flatMap((run) => objects(run.artifactRefs));
  const commandRequirements = new Set(commandArtifacts.flatMap((artifact) => strings(artifact.relatedRequirementIds)));
  const commandsOk =
    commandRuns.length > 0 &&
    commandRuns.every(
      (run) =>
        text(run.closeoutAttemptId) === attemptId &&
        run.exitCode === 0 &&
        objects(run.artifactRefs).length > 0
    );
  const artifactsOk =
    commandArtifacts.length > 0 &&
    commandArtifacts.every((artifact, index) => artifactIssues(projectRoot, artifact, index).length === 0);
  const traceBound = traceRows.length > 0 && traceRows.some((id) => commandRequirements.has(id));
  return (
    commandsOk &&
    artifactsOk &&
    traceBound &&
    coveredRequirementIds.length > 0 &&
    text(record.sourceDocumentHash) !== '' &&
    currentArchitectureHash(record) !== ''
  );
}

export function evaluateSubagentCurrentAttemptRevalidation(input: {
  envelope: JsonObject;
  record: JsonObject;
  projectRoot: string;
  currentCloseoutAttemptId?: string;
  currentAttemptCommandRuns?: JsonObject[];
  generatedAt?: string;
}): JsonObject {
  const attemptId = text(input.currentCloseoutAttemptId) || currentAttemptId(input.record);
  const validation: SubagentEvidenceEnvelopeValidation = validateSubagentEvidenceEnvelope(input.envelope, {
    record: input.record,
    projectRoot: input.projectRoot,
    indexedArtifactRefs: objects(input.envelope.artifactRefs),
  });
  const mismatches = currentAttemptEnvelopeIssues(validation);
  if (!attemptId) mismatches.push('subagent_revalidation_current_attempt_missing');
  mismatches.push(...workspaceIssues(input.projectRoot, input.envelope));
  const currentAttemptCommandRuns =
    input.currentAttemptCommandRuns && input.currentAttemptCommandRuns.length > 0
      ? input.currentAttemptCommandRuns
      : objects(input.envelope.commandRuns);
  const freshMainWorkspaceEvidence = hasFreshMainWorkspaceCommandEvidence(
    input.record,
    input.envelope,
    input.projectRoot,
    attemptId,
    currentAttemptCommandRuns
  );
  if (!freshMainWorkspaceEvidence) {
    if (text(input.envelope.sourceDocumentHash) !== text(input.record.sourceDocumentHash)) {
      mismatches.push('subagent_revalidation_source_hash_mismatch');
    }
    if (text(input.envelope.implementationConfirmationHash) !== text(input.record.implementationConfirmationHash)) {
      mismatches.push('subagent_revalidation_implementation_hash_mismatch');
    }
    if (text(input.envelope.architectureConfirmationHash) !== currentArchitectureHash(input.record)) {
      mismatches.push('subagent_revalidation_architecture_hash_mismatch');
    }
  }
  for (const [index, commandRun] of currentAttemptCommandRuns.entries()) {
    if (text(commandRun.closeoutAttemptId) !== attemptId) {
      mismatches.push(`subagent_revalidation_command_attempt_mismatch:${text(commandRun.commandId) || index}`);
    }
    if (commandRun.exitCode !== 0) mismatches.push(`subagent_revalidation_command_failed:${text(commandRun.commandId) || index}`);
    if (objects(commandRun.artifactRefs).length === 0) {
      mismatches.push(`subagent_revalidation_command_artifact_refs_missing:${text(commandRun.commandId) || index}`);
    }
  }
  for (const [runIndex, commandRun] of currentAttemptCommandRuns.entries()) {
    objects(commandRun.artifactRefs).forEach((artifact, artifactIndex) =>
      mismatches.push(...artifactIssues(input.projectRoot, artifact, runIndex + artifactIndex))
    );
  }
  const uniqueMismatches = [...new Set(mismatches)];
  const decision = text(input.envelope.status) === 'accepted' && uniqueMismatches.length === 0 ? 'pass' : 'blocked';
  const envelopeHash = validation.envelopeHash ?? sha256Object(input.envelope);
  const currentAttemptArtifactRefs = [
    ...objects(input.envelope.artifactRefs),
    ...currentAttemptCommandRuns.flatMap((run) => objects(run.artifactRefs)),
  ];
  return {
    reportType: 'subagent_current_attempt_revalidation_report',
    schemaVersion: SCHEMA_VERSION,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    decision,
    currentCloseoutAttemptId: attemptId,
    parentCloseoutAttemptId: text(input.envelope.parentCloseoutAttemptId),
    envelopeHash,
    recordId: text(input.record.recordId),
    requirementSetId: text(input.record.requirementSetId),
    traceRows: strings(input.envelope.traceRows),
    coveredRequirementIds: strings(input.envelope.coveredRequirementIds),
    commandRuns: currentAttemptCommandRuns.map((run) => ({
      commandId: text(run.commandId),
      closeoutAttemptId: text(run.closeoutAttemptId),
      exitCode: run.exitCode,
      artifactRefCount: objects(run.artifactRefs).length,
    })),
    sourceRefs: validation.sourceRefs,
    artifactRefs: currentAttemptArtifactRefs,
    mismatches: uniqueMismatches,
    failureRecords:
      decision === 'pass'
        ? []
        : [
            {
              eventType: 'failure_recorded',
              failureId: `failure:subagent-revalidation:${text(input.envelope.subtaskId) || envelopeHash}`,
              type: 'subagent_revalidation_failed',
              status: 'open',
              closeoutAttemptId: attemptId,
              blockingReasons: uniqueMismatches,
              sourceRefs: [{ sourceType: 'execution_iteration', id: text(input.envelope.subtaskId) || envelopeHash }],
            },
          ],
    rerunLoops:
      decision === 'pass'
        ? []
        : [
            {
              rerunLoopId: `rerun:subagent-revalidation:${text(input.envelope.subtaskId) || envelopeHash}`,
              status: 'open',
              sourceRefs: [{ sourceType: 'execution_iteration', id: text(input.envelope.subtaskId) || envelopeHash }],
              blockerRefs: [{ sourceType: 'failure_record', id: `failure:subagent-revalidation:${text(input.envelope.subtaskId) || envelopeHash}` }],
            },
          ],
    controlWrite: 'forbidden_use_controlled_ingest',
  };
}

function parseArgs(argv: string[]): Record<string, string | boolean | undefined> {
  const out: Record<string, string | boolean | undefined> = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--json') out.json = true;
    else if (arg === '--help' || arg === '-h') out.help = true;
    else if (arg.startsWith('--')) {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) throw new Error(`Missing value for ${arg}`);
      out[arg.slice(2).replace(/-([a-z])/gu, (_, letter: string) => letter.toUpperCase())] = value;
      index += 1;
    } else {
      throw new Error(`Unexpected positional argument: ${arg}`);
    }
  }
  return out;
}

export function runSubagentCurrentAttemptRevalidation(argv: string[]): number {
  const args = parseArgs(argv);
  if (args.help) {
    console.log('Usage: subagent-current-attempt-revalidation --envelope <json> --requirement-record <json> --report-out <json> [--current-closeout-attempt-id <id>] [--current-command-evidence <json>] [--project-root <dir>] [--json]');
    return 0;
  }
  const envelopePath = text(args.envelope);
  const recordPath = text(args.requirementRecord);
  const reportOut = text(args.reportOut);
  const currentCloseoutAttemptId = text(args.currentCloseoutAttemptId);
  const currentCommandEvidencePath = text(args.currentCommandEvidence);
  if (!envelopePath || !recordPath || !reportOut) throw new Error('missing required args: envelope, requirement-record, report-out');
  const projectRoot = path.resolve(text(args.projectRoot) || process.cwd());
  const currentCommandEvidence = currentCommandEvidencePath ? readJson(path.resolve(currentCommandEvidencePath)) : {};
  const report = evaluateSubagentCurrentAttemptRevalidation({
    envelope: readJson(path.resolve(envelopePath)),
    record: readJson(path.resolve(recordPath)),
    projectRoot,
    currentCloseoutAttemptId,
    currentAttemptCommandRuns: objects(currentCommandEvidence.commandRuns),
  });
  fs.mkdirSync(path.dirname(path.resolve(reportOut)), { recursive: true });
  fs.writeFileSync(path.resolve(reportOut), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  process.stdout.write(args.json ? `${JSON.stringify(report, null, 2)}\n` : `subagent_current_attempt_revalidation=${report.decision}\n`);
  return report.decision === 'pass' ? 0 : 3;
}

if (require.main === module && /(^|[\\/])subagent-current-attempt-revalidation(\.[cm]?js|\.ts)?$/iu.test(process.argv[1] ?? '')) {
  try {
    process.exitCode = runSubagentCurrentAttemptRevalidation(process.argv.slice(2));
  } catch (error) {
    console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }, null, 2));
    process.exitCode = 2;
  }
}
