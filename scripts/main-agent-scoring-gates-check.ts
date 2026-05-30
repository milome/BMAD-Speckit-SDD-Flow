/* eslint-disable no-console */
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { resolveScoringPolicy } from '../packages/scoring/policy';

type JsonObject = Record<string, unknown>;
type ScoringGateDecision = 'pass' | 'blocked';

interface ParsedArgs {
  requirementRecord?: string;
  reportPath?: string;
  evaluatedAt?: string;
  evaluatedBy?: string;
  json?: boolean;
  help?: boolean;
}

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

function readJson(file: string): JsonObject {
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`JSON object expected: ${file}`);
  }
  return parsed as JsonObject;
}

function normalizePathForRecord(value: string): string {
  return value.replace(/\\/gu, '/');
}

function sha256File(file: string): string {
  return `sha256:${crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}`;
}

function resolveProjectPath(root: string, value: string): string {
  return path.isAbsolute(value) ? value : path.resolve(root, value);
}

function nested(obj: JsonObject | null | undefined, key: string): JsonObject | null {
  const value = obj?.[key];
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonObject) : null;
}

function readRuntimePolicySnapshot(root: string, record: JsonObject): JsonObject | null {
  const ref = nested(record, 'runtimePolicySnapshotRef');
  const snapshotPath = text(ref?.path);
  if (!snapshotPath) return null;
  const absolute = resolveProjectPath(root, snapshotPath);
  if (!fs.existsSync(absolute)) return null;
  const expectedHash = text(ref?.contentHash ?? ref?.hash);
  if (expectedHash && sha256File(absolute) !== expectedHash) return null;
  return readJson(absolute);
}

function scoringRequiredFromSnapshot(snapshot: JsonObject | null): boolean | null {
  if (!snapshot) return null;
  const policy = nested(snapshot, 'policy');
  const scoring = nested(policy, 'scoring');
  if (scoring?.required === true) return true;
  if (scoring?.required === false) return false;
  if (policy?.scoringRequired === true || snapshot.scoringRequired === true) return true;
  if (policy?.scoringRequired === false || snapshot.scoringRequired === false) return false;
  if (policy?.scoringEnabled === true || snapshot.scoringEnabled === true) return true;
  if (policy?.scoringEnabled === false || snapshot.scoringEnabled === false) return false;
  if (nested(policy, 'control')?.scoringEnabled === true) return true;
  if (nested(policy, 'control')?.scoringEnabled === false) return false;
  return null;
}

function resolvedScoringPolicyFromSnapshot(snapshot: JsonObject | null): JsonObject | null {
  const resolved = nested(snapshot, 'resolvedScoringPolicy');
  if (!resolved) return null;
  if (text(resolved.schemaVersion) !== 'resolved-scoring-policy/v1') return null;
  if (!/^sha256:[a-f0-9]{64}$/u.test(text(resolved.scoringPolicyHash))) return null;
  return resolved;
}

function latestGate(record: JsonObject, gate: string): JsonObject | null {
  return (
    objects(record.gateChecks)
      .filter((check) => text(check.gate) === gate)
      .at(-1) ?? null
  );
}

function gateId(gate: JsonObject | null): string {
  return text(gate?.checkId) || text(gate?.gate);
}

function scoreArtifacts(record: JsonObject): JsonObject[] {
  const isScoreArtifact = (artifact: JsonObject): boolean => {
    const artifactType = text(artifact.artifactType);
    const artifactPath = normalizePathForRecord(text(artifact.path));
    return (
      ['score', 'score_record', 'score_report', 'scoring_gate_report'].includes(artifactType) ||
      artifactPath.includes('/scoring/') ||
      artifactPath.includes('/score-')
    );
  };
  return [...objects(record.artifactIndex), ...objects(record.extensionRefs)].filter(
    isScoreArtifact
  );
}

function readScoreArtifact(root: string, artifact: JsonObject): JsonObject | null {
  const artifactPath = text(artifact.path);
  if (!artifactPath) return null;
  const absolute = resolveProjectPath(root, artifactPath);
  if (!fs.existsSync(absolute)) return null;
  const expectedHash = text(artifact.contentHash ?? artifact.hash);
  if (expectedHash && sha256File(absolute) !== expectedHash) return null;
  try {
    return readJson(absolute);
  } catch {
    return null;
  }
}

function scoreArtifactIssues(
  root: string,
  record: JsonObject,
  resolvedPolicy: JsonObject
): string[] {
  const issues: string[] = [];
  const requiredKinds = Array.isArray(resolvedPolicy.requiredScoreArtifactKinds)
    ? resolvedPolicy.requiredScoreArtifactKinds.map(text).filter(Boolean)
    : [];
  const artifacts = scoreArtifacts(record);
  if (artifacts.length === 0) {
    issues.push('score_artifact_ref_missing');
    return issues;
  }
  if (requiredKinds.length > 0) {
    for (const kind of requiredKinds) {
      if (!artifacts.some((artifact) => text(artifact.artifactType) === kind)) {
        issues.push(`required_score_artifact_kind_missing:${kind}`);
      }
    }
  }
  const controlArtifact = artifacts.find(
    (artifact) => text(artifact.sourceOfTruthRole) === 'control'
  );
  if (controlArtifact) issues.push('score_artifact_must_not_be_control');
  const evidenceArtifact = artifacts
    .filter((artifact) => ['evidence', 'read_model'].includes(text(artifact.sourceOfTruthRole)))
    .reverse()
    .find((artifact) =>
      ['score', 'score_record', 'score_report'].includes(text(artifact.artifactType))
    );
  if (!evidenceArtifact) issues.push('score_artifact_evidence_or_read_model_missing');
  const scoreRecord = evidenceArtifact ? readScoreArtifact(root, evidenceArtifact) : null;
  if (!scoreRecord) {
    issues.push('score_artifact_unreadable_or_hash_mismatch');
    return issues;
  }
  if (text(scoreRecord.scoreWriteResult) !== 'ok') issues.push('score_write_result_not_ok');
  const scoringPolicyHash = text(scoreRecord.scoringPolicyHash ?? scoreRecord.policyHash);
  if (!/^sha256:[a-f0-9]{64}$/u.test(scoringPolicyHash)) issues.push('score_policy_hash_missing');
  if (scoringPolicyHash && scoringPolicyHash !== text(resolvedPolicy.scoringPolicyHash)) {
    issues.push('score_policy_hash_mismatch');
  }
  const display = nested(scoreRecord, 'display');
  if (display && display.visible !== true) issues.push('score_display_not_visible');
  const evaluation = nested(scoreRecord, 'evaluation');
  if (evaluation) {
    if (text(evaluation.decision) !== 'pass') issues.push('score_record_evaluation_not_pass');
    if (evaluation.thresholdPassed === false) issues.push('score_threshold_failed');
    if (Array.isArray(evaluation.dimensionVetoes) && evaluation.dimensionVetoes.length > 0) {
      issues.push('score_dimension_veto_present');
    }
  }
  return issues;
}

function hasFailure(record: JsonObject, type: string, sourceId: string): boolean {
  return objects(record.failureRecords).some((failure) => {
    if (text(failure.type) !== type) return false;
    if (!['open', 'in_progress', 'blocked'].includes(text(failure.status))) return false;
    return objects(failure.sourceRefs).some(
      (ref) => text(ref.id) === sourceId || text(ref.sourceType) === 'gate_check'
    );
  });
}

function hasRerunForGate(record: JsonObject, sourceId: string): boolean {
  return objects(record.rerunLoops).some(
    (loop) =>
      ['open', 'in_progress', 'no_progress', 'blocked'].includes(text(loop.status)) &&
      [...objects(loop.sourceRefs), ...objects(loop.blockerRefs)].some(
        (ref) => text(ref.id) === sourceId || text(ref.sourceType) === 'gate_check'
      )
  );
}

function openScoreFailures(record: JsonObject): JsonObject[] {
  return objects(record.failureRecords).filter(
    (failure) =>
      ['score_write_failed', 'score_threshold_or_dimension_failed'].includes(text(failure.type)) &&
      ['open', 'in_progress', 'blocked'].includes(text(failure.status))
  );
}

function evaluateScoringGates(
  root: string,
  record: JsonObject
): { decision: ScoringGateDecision; blockingReasons: string[]; checks: JsonObject[] } {
  const checks: JsonObject[] = [];
  const blockingReasons: string[] = [];
  if (Object.prototype.hasOwnProperty.call(record, 'score')) {
    blockingReasons.push('root_score_control_field_forbidden');
  }
  const snapshot = readRuntimePolicySnapshot(root, record);
  const scoringRequired = scoringRequiredFromSnapshot(snapshot);
  checks.push({
    id: 'runtime-policy-scoring-required-resolved',
    passed: scoringRequired !== null,
    scoringRequired,
  });
  if (scoringRequired === null) blockingReasons.push('runtime_policy_scoring_required_unresolved');
  let resolvedPolicy: JsonObject | null = null;
  try {
    resolvedPolicy = resolveScoringPolicy({ root }) as unknown as JsonObject;
  } catch (error) {
    blockingReasons.push(
      `resolved_scoring_policy_unavailable:${error instanceof Error ? error.message : String(error)}`
    );
  }
  const snapshotResolvedPolicy = resolvedScoringPolicyFromSnapshot(snapshot);
  checks.push({
    id: 'resolved-scoring-policy-present',
    passed: Boolean(resolvedPolicy && snapshotResolvedPolicy),
    scoringPolicyHash: text(resolvedPolicy?.scoringPolicyHash),
    snapshotScoringPolicyHash: text(snapshotResolvedPolicy?.scoringPolicyHash),
  });
  if (!snapshotResolvedPolicy)
    blockingReasons.push('runtime_snapshot_resolved_scoring_policy_missing');
  if (
    resolvedPolicy &&
    snapshotResolvedPolicy &&
    text(resolvedPolicy.scoringPolicyHash) !== text(snapshotResolvedPolicy.scoringPolicyHash)
  ) {
    blockingReasons.push('runtime_snapshot_resolved_scoring_policy_hash_mismatch');
  }

  const materialization = latestGate(record, 'score_materialization');
  const evaluation = latestGate(record, 'score_evaluation');
  const materializationDecision = text(materialization?.decision);
  const evaluationDecision = text(evaluation?.decision);

  if (scoringRequired === false) {
    const skipped =
      materialization && ['not_applicable', 'skipped_by_policy'].includes(materializationDecision);
    checks.push({
      id: 'score-materialization-explicitly-skipped-by-policy',
      passed: Boolean(skipped),
      decision: materializationDecision,
    });
    if (!skipped) blockingReasons.push('score_materialization_policy_skip_gate_missing');
    return {
      decision: blockingReasons.length === 0 ? 'pass' : 'blocked',
      blockingReasons: [...new Set(blockingReasons)],
      checks,
    };
  }

  const materializationPass = materializationDecision === 'pass';
  checks.push({
    id: 'score-materialization-gate-pass',
    passed: materializationPass,
    decision: materializationDecision || '<missing>',
  });
  if (!materialization) blockingReasons.push('score_materialization_gate_missing');
  if (materialization && ['fail', 'blocked'].includes(materializationDecision)) {
    const sourceId = gateId(materialization);
    if (!hasFailure(record, 'score_write_failed', sourceId))
      blockingReasons.push('score_write_failed_failure_record_missing');
    blockingReasons.push('score_materialization_gate_failed');
  }

  if (materializationPass) {
    if (resolvedPolicy) {
      blockingReasons.push(...scoreArtifactIssues(root, record, resolvedPolicy));
    }
  }

  const evaluationPass = evaluationDecision === 'pass';
  checks.push({
    id: 'score-evaluation-gate-pass',
    passed: evaluationPass,
    decision: evaluationDecision || '<missing>',
  });
  if (!evaluation) blockingReasons.push('score_evaluation_gate_missing');
  if (evaluation && ['fail', 'blocked'].includes(evaluationDecision)) {
    const sourceId = gateId(evaluation);
    if (!hasFailure(record, 'score_threshold_or_dimension_failed', sourceId)) {
      blockingReasons.push('score_threshold_or_dimension_failed_failure_record_missing');
    }
    if (!hasRerunForGate(record, sourceId))
      blockingReasons.push('score_evaluation_rerun_loop_missing');
    blockingReasons.push('score_evaluation_gate_failed');
  }

  const openFailures = openScoreFailures(record);
  checks.push({
    id: 'score-failures-resolved-before-closeout',
    passed: openFailures.length === 0,
    openCount: openFailures.length,
  });
  if (openFailures.length > 0) blockingReasons.push('open_score_failure_record_exists');

  return {
    decision: blockingReasons.length === 0 ? 'pass' : 'blocked',
    blockingReasons: [...new Set(blockingReasons)],
    checks,
  };
}

export function mainScoringGatesCheck(argv: string[]): number {
  const args = parseArgs(argv);
  if (args.help) {
    console.log(
      'Usage: main-agent-scoring-gates-check --requirement-record <json> [--report-path <json>] [--json]'
    );
    return 0;
  }
  if (!args.requirementRecord) throw new Error('missing required args: requirementRecord');
  const recordPath = path.resolve(args.requirementRecord);
  const root = process.cwd();
  const record = readJson(recordPath);
  const evaluatedAt = args.evaluatedAt ?? new Date().toISOString();
  const reportPath = path.resolve(
    args.reportPath ?? path.join(path.dirname(recordPath), 'scoring-gates-report.json')
  );
  const evaluation = evaluateScoringGates(root, record);
  const report = {
    reportType: 'scoring_gates_report',
    generatedAt: evaluatedAt,
    evaluatedBy: args.evaluatedBy ?? 'agent',
    recordId: text(record.recordId),
    requirementSetId: text(record.requirementSetId),
    decision: evaluation.decision,
    blockingReasons: evaluation.blockingReasons,
    checks: evaluation.checks,
  };
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  const output = {
    ok: true,
    reportPath: normalizePathForRecord(reportPath),
    decision: evaluation.decision,
    blockingReasons: evaluation.blockingReasons,
  };
  process.stdout.write(
    args.json ? `${JSON.stringify(output, null, 2)}\n` : `scoring_gates=${evaluation.decision}\n`
  );
  return evaluation.decision === 'pass' ? 0 : 1;
}

if (require.main === module) {
  try {
    process.exitCode = mainScoringGatesCheck(process.argv.slice(2));
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
