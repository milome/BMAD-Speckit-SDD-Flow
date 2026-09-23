import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  auditProviderRunHash,
  type AuditProviderEvidence,
  type AuditProviderExpectation,
  validateAuditProviderEvidence,
} from './requirements-contract-judge-provider-independence';
import { prepareRequirementsContractJudgeInvocation } from './requirements-contract-judge-invocation';
import { loadRequirementsContractJudgePromptAsset } from './requirements-contract-judge-prompt-loader';
import { sha256Stable } from './requirements-contract-semantic-resolver';

type JsonRecord = Record<string, unknown>;

export interface AuditReviewScoringAssessment {
  overallGrade: 'A' | 'B' | 'C' | 'D';
  dimensionContractId: string;
  dimensionMode: string;
  expectedDimensions: string[];
  dimensionScores: Array<{ dimension: string; score: number; rationale: string }>;
  phaseScore: number;
  vetoTriggered: boolean;
  effectiveVerdict: 'approved' | 'required_fixes' | 'blocked' | 'blocked_pending_rereadiness';
  structuredDriftSignals: Array<{ signal: string; triggered: boolean; evidence: string }>;
  evidenceRefs: string[];
  rationale: string;
}

export type AuditTriadJudgeVerdict =
  | 'no_new_valid_gap'
  | 'no_new_confirmation_blocking_gap'
  | 'new_valid_gap'
  | 'insufficient_audit'
  | 'blocked';

export interface AuditTriadJudgeInvocationResult extends JsonRecord {
  verdict: AuditTriadJudgeVerdict;
  independentProviderEvidence: AuditProviderEvidence;
  checkedProjectionQualityRuleCodes: string[];
  validatedGaps: JsonRecord[];
  rejectedGapCandidates: JsonRecord[];
  auditReviewScoring: AuditReviewScoringAssessment;
  providerInvocationReceiptRef: {
    path: string;
    contentHash: string;
    receiptHash: string;
  };
  judgeAdapterHostExecution: JsonRecord;
}

function record(value: unknown, code: string): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(code);
  return value as JsonRecord;
}

function text(value: unknown, code?: string): string {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized && code) throw new Error(code);
  return normalized;
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => text(item)).filter(Boolean) : [];
}

function records(value: unknown): JsonRecord[] {
  return Array.isArray(value)
    ? value.filter((item): item is JsonRecord => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
    : [];
}

function resolveWithin(root: string, value: string, code: string): string {
  const resolved = path.resolve(root, value);
  const relative = path.relative(root, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error(code);
  return resolved;
}

function relativeSlash(root: string, target: string): string {
  return path.relative(root, target).replace(/\\/gu, '/');
}

function sha256File(filePath: string): string {
  return `sha256:${createHash('sha256').update(fs.readFileSync(filePath)).digest('hex')}`;
}

function writeJson(filePath: string, value: JsonRecord): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const content = `${JSON.stringify(value, null, 2)}\n`;
  const temporaryPath = `${filePath}.${process.pid}.tmp`;
  fs.writeFileSync(temporaryPath, content, 'utf8');
  fs.renameSync(temporaryPath, filePath);
}

function expectationFromRequest(request: JsonRecord): AuditProviderExpectation {
  const binding = record(
    request.independentProviderBinding,
    'audit_triad_judge_provider_binding_missing'
  );
  return {
    providerId: text(binding.providerId, 'audit_triad_judge_provider_id_missing'),
    model: binding.model === null ? null : text(binding.model, 'audit_triad_judge_model_missing'),
    transport: text(binding.transport, 'audit_triad_judge_transport_missing'),
    adapterRef: text(binding.adapterRef, 'audit_triad_judge_adapter_ref_missing'),
    apiStyle: text(binding.apiStyle, 'audit_triad_judge_api_style_missing'),
    configuredBaseUrlHash: text(
      binding.configuredBaseUrlHash,
      'audit_triad_judge_base_url_hash_missing'
    ),
    independenceClass: text(
      binding.independenceClass,
      'audit_triad_judge_independence_class_missing'
    ),
    providerRegistryHash: text(
      binding.providerRegistryHash,
      'audit_triad_judge_registry_hash_missing'
    ),
    providerConfigurationHash: text(
      binding.providerConfigurationHash,
      'audit_triad_judge_provider_configuration_hash_missing'
    ),
    transactionId: text(request.transactionId) || undefined,
    auditAttemptId: text(request.auditAttemptId) || undefined,
    requestHash: text(request.requestHash, 'audit_triad_judge_request_hash_missing'),
    sourceDocumentHash: text(
      request.sourceDocumentHash,
      'audit_triad_judge_source_hash_missing'
    ),
    semanticModelHash: text(
      request.semanticModelHash,
      'audit_triad_judge_semantic_model_hash_missing'
    ),
    projectionSetHash: text(
      request.projectionSetHash,
      'audit_triad_judge_projection_set_hash_missing'
    ),
  };
}

function scoringAssessment(request: JsonRecord, response: JsonRecord): AuditReviewScoringAssessment {
  const contract = record(
    request.auditReviewScoringContract,
    'audit_triad_judge_scoring_contract_missing'
  );
  const approved = response.decision === 'pass';
  const phaseScore = approved ? 100 : 0;
  const evidenceRefs = strings(response.evidenceRefs);
  if (evidenceRefs.length === 0) {
    evidenceRefs.push(`provider-response:${text(response.responseHash, 'audit_triad_judge_response_hash_missing')}`);
  }
  return {
    overallGrade: approved ? 'A' : 'D',
    dimensionContractId: text(
      contract.dimensionContractId,
      'audit_triad_judge_dimension_contract_missing'
    ),
    dimensionMode: text(contract.dimensionMode, 'audit_triad_judge_dimension_mode_missing'),
    expectedDimensions: strings(contract.expectedDimensions),
    dimensionScores: strings(contract.expectedDimensions).map((dimension) => ({
      dimension,
      score: phaseScore,
      rationale: `Independent Audit Provider Judge decision: ${String(response.decision)}`,
    })),
    phaseScore,
    vetoTriggered: !approved,
    effectiveVerdict: approved ? 'approved' : response.decision === 'block' ? 'required_fixes' : 'blocked',
    structuredDriftSignals: strings(contract.structuredDriftSignalIds).map((signal) => ({
      signal,
      triggered: false,
      evidence: `Audit Provider Judge response ${text(response.responseHash)}`,
    })),
    evidenceRefs,
    rationale: `Independent Audit Provider Judge decision: ${String(response.decision)}`,
  };
}

function verdictFor(response: JsonRecord): AuditTriadJudgeVerdict {
  if (response.decision === 'pass') return 'no_new_valid_gap';
  if (response.decision === 'block') return 'new_valid_gap';
  return 'insufficient_audit';
}

function gapRecords(value: unknown): JsonRecord[] {
  return records(value).map((finding, index) => ({
    ...finding,
    gapId:
      text(finding.findingId) ||
      text(finding.gapId) ||
      `audit-provider-gap-${String(index + 1).padStart(3, '0')}`,
  }));
}

export async function invokeAuditTriadJudge(input: {
  projectRoot: string;
  requestPath: string;
  outputDir: string;
  roundIndex: number;
}): Promise<AuditTriadJudgeInvocationResult> {
  const root = path.resolve(input.projectRoot);
  const requestPath = resolveWithin(root, input.requestPath, 'audit_triad_judge_request_path_escape');
  const outputDir = resolveWithin(root, input.outputDir, 'audit_triad_judge_output_path_escape');
  const request = record(
    JSON.parse(fs.readFileSync(requestPath, 'utf8')),
    'audit_triad_judge_request_invalid'
  );
  if (request.schemaVersion !== 'audit-triad-judge-request/v1') {
    throw new Error('audit_triad_judge_request_schema_invalid');
  }
  const expected = expectationFromRequest(request);
  const prepared = await prepareRequirementsContractJudgeInvocation({
    projectRoot: root,
    config: '_bmad/_config/governance-remediation.yaml',
  });
  if (prepared.providerRef !== expected.providerId) {
    throw new Error('audit_triad_judge_provider_selection_mismatch');
  }
  const prompt = loadRequirementsContractJudgePromptAsset({
    packageRoot: root,
    judgeRole: 'requirements_judge',
  });
  const response = await prepared.invoke({
    systemPrompt: `${prompt.systemPrompt}\n\nEvaluate the supplied audit-triad Judge request and return the configured structured response.`,
    request,
    executionContext: {
      projectRoot: root,
      requestPath,
      outputDir,
      roundIndex: input.roundIndex,
      command: 'audit-triad Judge invocation',
    },
    structuredOutputSchema: prompt.structuredOutputSchema,
  });
  if (text(response.requestHash) !== expected.requestHash) {
    throw new Error('audit_triad_judge_response_request_hash_mismatch');
  }
  const transportEvidence = record(
    response.transportEvidence,
    'audit_triad_judge_transport_evidence_missing'
  );
  const evidenceWithoutRunHash: Omit<AuditProviderEvidence, 'runHash'> = {
    ...expected,
    requestedModel: expected.model,
    model: text(response.returnedModel, 'audit_triad_judge_returned_model_missing'),
    providerRunId: text(response.providerRequestId, 'audit_triad_judge_provider_run_id_missing'),
    responseHash: text(response.responseHash, 'audit_triad_judge_response_hash_missing'),
  };
  const independentProviderEvidence: AuditProviderEvidence = {
    ...evidenceWithoutRunHash,
    runHash: auditProviderRunHash(evidenceWithoutRunHash),
  };
  const providerValidation = validateAuditProviderEvidence({
    expected,
    evidence: independentProviderEvidence,
  });
  if (!providerValidation.ok) {
    throw new Error(providerValidation.issueCodes[0] ?? 'audit_triad_judge_provider_evidence_invalid');
  }

  const providerResultPath = path.join(outputDir, 'audit-provider-judge-result.json');
  writeJson(providerResultPath, {
    schemaVersion: 'audit-provider-judge-result/v1',
    response,
  });
  const receiptWithoutHash = {
    schemaVersion: 'audit-provider-judge-invocation-receipt/v1',
    roundIndex: input.roundIndex,
    ...independentProviderEvidence,
    sourceBytesHash: text(request.sourceBytesHash, 'audit_triad_judge_source_bytes_hash_missing'),
    resultPath: relativeSlash(root, providerResultPath),
    resultContentHash: sha256File(providerResultPath),
    transportEvidence,
    transportEvidenceHash: sha256Stable(transportEvidence),
  };
  const receipt = {
    ...receiptWithoutHash,
    receiptHash: sha256Stable(receiptWithoutHash),
  };
  const receiptPath = path.join(outputDir, 'audit-provider-judge-invocation-receipt.json');
  writeJson(receiptPath, receipt);
  const receiptRef = {
    path: relativeSlash(root, receiptPath),
    contentHash: sha256File(receiptPath),
    receiptHash: receipt.receiptHash,
  };
  const stateWithoutHash = {
    status: 'committed',
    receiptHash: receipt.receiptHash,
    receiptContentHash: receiptRef.contentHash,
    resultContentHash: sha256File(providerResultPath),
  };
  const state = { ...stateWithoutHash, stateHash: sha256Stable(stateWithoutHash) };
  const statePath = path.join(outputDir, 'audit-provider-judge-invocation-state.json');
  writeJson(statePath, state);
  const commitWithoutHash = {
    receiptHash: receipt.receiptHash,
    receiptContentHash: receiptRef.contentHash,
    stateContentHash: sha256File(statePath),
    resultContentHash: sha256File(providerResultPath),
  };
  writeJson(path.join(outputDir, 'audit-provider-judge-invocation-commit.json'), {
    ...commitWithoutHash,
    commitHash: sha256Stable(commitWithoutHash),
  });

  return {
    verdict: verdictFor(response),
    requestHash: expected.requestHash,
    sourceHash: text(request.sourceHash),
    sourceDocumentHash: expected.sourceDocumentHash,
    sourceBytesHash: text(request.sourceBytesHash),
    semanticModelHash: expected.semanticModelHash,
    implementationConfirmationHash: text(request.implementationConfirmationHash),
    packetHash: text(request.packetHash),
    projectionSetHash: expected.projectionSetHash,
    independentProviderEvidence,
    validatedGaps: gapRecords(response.findings),
    rejectedGapCandidates: records(response.challengeRequests),
    checkedProjectionQualityRuleCodes: strings(
      record(request.projectionQualityGate, 'audit_triad_judge_quality_gate_missing').requiredRuleCodes
    ),
    auditReviewScoring: scoringAssessment(request, response),
    providerInvocationReceiptRef: receiptRef,
    judgeAdapterHostExecution: {
      adapterKind: 'audit_provider_judge_invocation',
      commandHash: sha256Stable({ adapterRef: expected.adapterRef, roundIndex: input.roundIndex }),
      exitCode: 0,
      stdoutPath: text(transportEvidence.stdoutPath),
      stdoutHash: text(transportEvidence.stdoutHash),
      stderrPath: text(transportEvidence.stderrPath),
      stderrHash: text(transportEvidence.stderrHash),
    },
  };
}

function parseArgs(argv: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index]?.replace(/^--/u, '');
    const value = argv[index + 1];
    if (!key || !value) throw new Error('audit_triad_judge_cli_argument_invalid');
    result[key] = value;
  }
  return result;
}

export async function mainAuditTriadJudgeInvocation(argv: string[]): Promise<number> {
  try {
    const args = parseArgs(argv);
    const result = await invokeAuditTriadJudge({
      projectRoot: text(args['project-root'], 'audit_triad_judge_project_root_missing'),
      requestPath: text(args.request, 'audit_triad_judge_request_path_missing'),
      outputDir: text(args['output-dir'], 'audit_triad_judge_output_dir_missing'),
      roundIndex: Number(args.round),
    });
    process.stdout.write(`${JSON.stringify(result)}\n`);
    return 0;
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    return 1;
  }
}

if (require.main === module && /audit-triad-judge-invocation(?:\.[cm]?js|\.ts)?$/iu.test(process.argv[1] ?? '')) {
  mainAuditTriadJudgeInvocation(process.argv.slice(2)).then((code) => process.exit(code));
}
