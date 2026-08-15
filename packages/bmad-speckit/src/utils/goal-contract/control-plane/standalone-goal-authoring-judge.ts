import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  prepareRequirementsContractJudgeInvocation,
  type PreparedRequirementsContractJudgeInvocation,
} from '../../../main-agent/source-authority/scripts/requirements-contract-judge-invocation';
import {
  createRequirementsContractJudgeSelectionReceipt,
  resolveRequirementsContractJudgeAdapterRef,
} from '../../../main-agent/source-authority/scripts/requirements-contract-judge-selection';
import {
  canonicalJson,
  sha256,
} from '../../../main-agent/source-authority/scripts/requirements-contract-governed-write';
import {
  sha256Stable,
  stableStringify,
} from '../../../main-agent/source-authority/scripts/requirements-contract-semantic-resolver';
import { assertRequirementsContractSchema } from '../../../main-agent/source-authority/scripts/requirements-contract-semantic-ir-schema';
import { validateGoalContractSchema } from './schema-registry';
import type { StandaloneGoalSemanticIr } from './standalone-goal-semantic-ir';

type JsonObject = Record<string, unknown>;

export interface StandaloneGoalAuthoringJudgeDependencies {
  prepareInvocation?: typeof prepareRequirementsContractJudgeInvocation;
}

const SYSTEM_PROMPT = [
  'You are the sole standalone Goal authoring Judge with role goal_full.',
  'Review the complete frozen StandaloneGoalSemanticIR candidate for semantic and technical authoring closure.',
  'Return only the requested structured JSON.',
  'A pass requires no findings, no challenge requests, and evidenceRefs exactly equal requiredCoverageRefs.',
  'Do not modify files, derive a successor candidate, or perform execution-final review.',
].join(' ');

const STRUCTURED_OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['decision', 'findings', 'challengeRequests', 'evidenceRefs'],
  properties: {
    decision: { type: 'string', enum: ['pass', 'block', 'inconclusive'] },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['findingId', 'category', 'message', 'evidenceRefs'],
        properties: {
          findingId: { type: 'string', minLength: 1 },
          category: { type: 'string', minLength: 1 },
          message: { type: 'string', minLength: 1 },
          evidenceRefs: {
            type: 'array',
            items: { type: 'string', minLength: 1 },
          },
        },
      },
    },
    challengeRequests: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['code', 'request'],
        properties: {
          code: { type: 'string', minLength: 1 },
          request: { type: 'string', minLength: 1 },
        },
      },
    },
    evidenceRefs: {
      type: 'array',
      items: { type: 'string', minLength: 1 },
    },
  },
} as const;

function object(value: unknown, code: string): JsonObject {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(code);
  return value as JsonObject;
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
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.length > 0)
    : [];
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function sortedUnique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right));
}

function canonicalBytes(value: unknown): Buffer {
  return Buffer.from(`${stableStringify(value)}\n`, 'utf8');
}

function publishImmutable(targetPath: string, value: unknown): boolean {
  const bytes = canonicalBytes(value);
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  try {
    fs.writeFileSync(targetPath, bytes, { flag: 'wx' });
    if (!fs.readFileSync(targetPath).equals(bytes)) {
      throw new Error('standalone_goal_authoring_judge_readback_failed');
    }
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    if (!fs.readFileSync(targetPath).equals(bytes)) {
      throw new Error('standalone_goal_authoring_judge_artifact_conflict');
    }
    return false;
  }
}

function readJson(targetPath: string, code: string): JsonObject {
  try {
    return object(JSON.parse(fs.readFileSync(targetPath, 'utf8')), code);
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error(code);
    throw error;
  }
}

function requiredCoverageRefs(candidate: StandaloneGoalSemanticIr): string[] {
  const payload = object(candidate.semanticPayload, 'standalone_goal_semantic_payload_invalid');
  const architecture = object(payload.architecture, 'standalone_goal_architecture_invalid');
  return sortedUnique([
    ...objects(payload.obligations).map((row) => text(row.obligationId)),
    ...objects(payload.atoms).map((row) => text(row.id)),
    ...objects(payload.logicalSpecSpans).map((row) => text(row.specSpanId)),
    ...objects(payload.executionConstraints).map((row) => text(row.constraintId)),
    ...objects(architecture.architectureDecisions).map((row) => text(row.decisionId)),
  ]);
}

function validateRequest(value: JsonObject): JsonObject {
  validateGoalContractSchema('standalone-goal-authoring-judge-request.schema.json', value);
  const unsigned = { ...value };
  delete unsigned.judgeRequestHash;
  if (value.judgeRequestHash !== sha256Stable(unsigned)) {
    throw new Error('standalone_goal_authoring_judge_request_hash_mismatch');
  }
  return value;
}

function validateSelection(value: JsonObject): JsonObject {
  assertRequirementsContractSchema(
    'requirements-contract-judge-selection-receipt.schema.json',
    value
  );
  const unsigned = { ...value };
  delete unsigned.providerSelectionHash;
  if (
    value.schemaVersion !== 'requirements-contract-judge-selection-receipt/v1' ||
    value.decision !== 'selected' ||
    value.providerSelectionHash !== sha256(`providerSelectionHash/v1\n${canonicalJson(unsigned)}`)
  ) {
    throw new Error('standalone_goal_authoring_judge_selection_invalid');
  }
  return value;
}

function validateResponse(value: JsonObject): JsonObject {
  validateGoalContractSchema('standalone-goal-authoring-judge-response.schema.json', value);
  return value;
}

function validateProviderLineage(selection: JsonObject, response: JsonObject): void {
  if (
    text(response.providerRef) !== text(selection.providerRef) ||
    text(response.transport) !== text(selection.transport) ||
    (response.configuredModel ?? null) !== (selection.model ?? null)
  ) {
    throw new Error('standalone_goal_authoring_judge_provider_lineage_mismatch');
  }
}

function createAggregate(input: {
  candidateHash: string;
  request: JsonObject;
  selection: JsonObject;
  response: JsonObject;
}): JsonObject {
  validateProviderLineage(input.selection, input.response);
  const required = strings(input.request.requiredCoverageRefs);
  const covered = sortedUnique(strings(input.response.evidenceRefs));
  const missing = required.filter((reference) => !covered.includes(reference));
  const unexpected = covered.filter((reference) => !required.includes(reference));
  const findings = objects(input.response.findings);
  const challenges = objects(input.response.challengeRequests);
  const issueCodes = sortedUnique([
    ...(input.response.decision !== 'pass' ? ['standalone_goal_authoring_judge_blocked'] : []),
    ...(findings.length > 0 ? ['standalone_goal_authoring_judge_findings_present'] : []),
    ...(challenges.length > 0 ? ['standalone_goal_authoring_judge_challenge_pending'] : []),
    ...(missing.length > 0 || unexpected.length > 0
      ? ['standalone_goal_authoring_judge_coverage_incomplete']
      : []),
  ]);
  const payload = {
    schemaVersion: 'StandaloneGoalAuthoringJudgeAggregate/v1',
    standaloneGoalSemanticIRHash: input.candidateHash,
    judgeRequestHash: input.request.judgeRequestHash,
    providerSelectionHash: input.selection.providerSelectionHash,
    normalizedResponseHash: sha256Stable(input.response),
    decision: issueCodes.length === 0 ? 'pass' : 'block',
    findingIds: sortedUnique(findings.map((finding) => text(finding.findingId))),
    requiredCoverageRefs: required,
    coveredRefs: covered,
    missingCoverageRefs: sortedUnique([...missing, ...unexpected]),
    issueCodes,
  };
  const aggregate = {
    ...payload,
    authoringJudgeAggregateHash: sha256Stable(payload),
  };
  validateGoalContractSchema('standalone-goal-authoring-judge-aggregate.schema.json', aggregate);
  return aggregate;
}

function validateAggregate(value: JsonObject, candidateHash: string): JsonObject {
  validateGoalContractSchema('standalone-goal-authoring-judge-aggregate.schema.json', value);
  const unsigned = { ...value };
  delete unsigned.authoringJudgeAggregateHash;
  if (
    value.standaloneGoalSemanticIRHash !== candidateHash ||
    value.authoringJudgeAggregateHash !== sha256Stable(unsigned)
  ) {
    throw new Error('standalone_goal_authoring_judge_aggregate_hash_mismatch');
  }
  return value;
}

function createEffectivePass(candidateHash: string, aggregate: JsonObject): JsonObject {
  const payload = {
    schemaVersion: 'StandaloneGoalAuthoringEffectivePass/v1',
    standaloneGoalSemanticIRHash: candidateHash,
    authoringJudgeAggregateHash: aggregate.authoringJudgeAggregateHash,
    decision: 'pass',
  };
  const effectivePass = {
    ...payload,
    authoringEffectivePassHash: sha256Stable(payload),
  };
  validateGoalContractSchema('standalone-goal-authoring-effective-pass.schema.json', effectivePass);
  return effectivePass;
}

function validateEffectivePass(
  value: JsonObject,
  candidateHash: string,
  aggregate: JsonObject
): JsonObject {
  validateGoalContractSchema('standalone-goal-authoring-effective-pass.schema.json', value);
  const unsigned = { ...value };
  delete unsigned.authoringEffectivePassHash;
  if (
    value.standaloneGoalSemanticIRHash !== candidateHash ||
    value.authoringJudgeAggregateHash !== aggregate.authoringJudgeAggregateHash ||
    value.authoringEffectivePassHash !== sha256Stable(unsigned)
  ) {
    throw new Error('standalone_goal_authoring_effective_pass_hash_mismatch');
  }
  return value;
}

function terminalBlock(aggregate: JsonObject, goalJudgeDispatchCount: 0 | 1): never {
  throw Object.assign(new Error('standalone_goal_successor_required:authoring_judge'), {
    failureClass: 'standalone_goal_successor_required:authoring_judge',
    goalJudgeDispatchCount,
    issueCodes: aggregate.issueCodes,
    findingIds: aggregate.findingIds,
  });
}

function result(input: {
  aggregate: JsonObject;
  effectivePass: JsonObject;
  goalJudgeDispatchCount: 0 | 1;
  writeCount: number;
  paths: Record<string, string>;
}) {
  return Object.freeze({
    aggregate: Object.freeze(input.aggregate),
    authoringEffectivePass: Object.freeze(input.effectivePass),
    goalJudgeDispatchCount: input.goalJudgeDispatchCount,
    publicationStatus: input.writeCount === 0 ? 'reused' : 'published',
    writeCount: input.writeCount,
    refs: Object.freeze({
      providerSelectionRef: {
        path: input.paths.selectionPath,
        hash: input.aggregate.providerSelectionHash,
      },
      requestRef: { path: input.paths.requestPath, hash: input.aggregate.judgeRequestHash },
      responseRef: { path: input.paths.responsePath, hash: input.aggregate.normalizedResponseHash },
      aggregateRef: {
        path: input.paths.aggregatePath,
        hash: input.aggregate.authoringJudgeAggregateHash,
      },
      effectivePassRef: {
        path: input.paths.passPath,
        hash: input.effectivePass.authoringEffectivePassHash,
      },
    }),
  });
}

export async function runStandaloneGoalAuthoringJudge(
  input: {
    projectRoot: string;
    authorityRoot: string;
    standaloneGoalSemanticIr: StandaloneGoalSemanticIr;
  },
  dependencies: StandaloneGoalAuthoringJudgeDependencies = {}
) {
  validateGoalContractSchema(
    'standalone-goal-semantic-ir.schema.json',
    input.standaloneGoalSemanticIr
  );
  const candidateHash = input.standaloneGoalSemanticIr.standaloneGoalSemanticIRHash;
  const candidateRoot = path.join(
    path.resolve(input.authorityRoot),
    'goal',
    'standalone-semantic',
    candidateHash.slice('sha256:'.length)
  );
  const paths = {
    semanticPath: path.join(candidateRoot, 'standalone-goal-semantic-ir.json'),
    selectionPath: path.join(candidateRoot, 'authoring-judge', 'provider-selection.json'),
    requestPath: path.join(candidateRoot, 'authoring-judge', 'request.json'),
    responsePath: path.join(candidateRoot, 'authoring-judge', 'response.json'),
    aggregatePath: path.join(candidateRoot, 'authoring-judge', 'aggregate.json'),
    passPath: path.join(candidateRoot, 'authoring-judge', 'authoring-effective-pass.json'),
    transportRoot: path.join(candidateRoot, 'authoring-judge', 'transport'),
  };
  let writeCount = publishImmutable(paths.semanticPath, input.standaloneGoalSemanticIr) ? 1 : 0;

  if (fs.existsSync(paths.aggregatePath)) {
    const request = validateRequest(
      readJson(paths.requestPath, 'standalone_goal_authoring_judge_request_invalid')
    );
    const selection = validateSelection(
      readJson(paths.selectionPath, 'standalone_goal_authoring_judge_selection_invalid')
    );
    const response = validateResponse(
      readJson(paths.responsePath, 'standalone_goal_authoring_judge_response_invalid')
    );
    validateProviderLineage(selection, response);
    const aggregate = validateAggregate(
      readJson(paths.aggregatePath, 'standalone_goal_authoring_judge_aggregate_invalid'),
      candidateHash
    );
    if (
      aggregate.judgeRequestHash !== request.judgeRequestHash ||
      aggregate.providerSelectionHash !== selection.providerSelectionHash ||
      aggregate.normalizedResponseHash !== sha256Stable(response)
    ) {
      throw new Error('standalone_goal_authoring_judge_lineage_mismatch');
    }
    if (aggregate.decision !== 'pass') terminalBlock(aggregate, 0);
    let effectivePass: JsonObject;
    if (fs.existsSync(paths.passPath)) {
      effectivePass = validateEffectivePass(
        readJson(paths.passPath, 'standalone_goal_authoring_effective_pass_missing'),
        candidateHash,
        aggregate
      );
    } else {
      effectivePass = createEffectivePass(candidateHash, aggregate);
      if (publishImmutable(paths.passPath, effectivePass)) writeCount += 1;
    }
    return result({ aggregate, effectivePass, goalJudgeDispatchCount: 0, writeCount, paths });
  }

  if (fs.existsSync(paths.responsePath)) {
    const request = validateRequest(
      readJson(paths.requestPath, 'standalone_goal_authoring_judge_request_invalid')
    );
    const selection = validateSelection(
      readJson(paths.selectionPath, 'standalone_goal_authoring_judge_selection_invalid')
    );
    const response = validateResponse(
      readJson(paths.responsePath, 'standalone_goal_authoring_judge_response_invalid')
    );
    const aggregate = createAggregate({ candidateHash, request, selection, response });
    if (publishImmutable(paths.aggregatePath, aggregate)) writeCount += 1;
    if (aggregate.decision !== 'pass') terminalBlock(aggregate, 0);
    const effectivePass = createEffectivePass(candidateHash, aggregate);
    if (publishImmutable(paths.passPath, effectivePass)) writeCount += 1;
    return result({ aggregate, effectivePass, goalJudgeDispatchCount: 0, writeCount, paths });
  }

  if (fs.existsSync(paths.requestPath)) {
    throw Object.assign(new Error('standalone_goal_authoring_judge_dispatch_ambiguous'), {
      failureClass: 'standalone_goal_authoring_judge_dispatch_ambiguous',
      goalJudgeDispatchCount: 0,
    });
  }

  const prepare = dependencies.prepareInvocation ?? prepareRequirementsContractJudgeInvocation;
  const prepared: PreparedRequirementsContractJudgeInvocation = await prepare({
    projectRoot: path.resolve(input.projectRoot),
    config: '_bmad/_config/governance-remediation.yaml',
  });
  const selection = createRequirementsContractJudgeSelectionReceipt({
    providerRef: prepared.providerRef,
    provider: prepared.provider,
    adapterRef: resolveRequirementsContractJudgeAdapterRef(prepared.provider),
    providerRegistryHash: prepared.providerRegistryHash,
  });
  if (publishImmutable(paths.selectionPath, selection)) writeCount += 1;
  const requestPayload = {
    schemaVersion: 'StandaloneGoalAuthoringJudgeRequest/v1',
    role: 'goal_full',
    candidateHash,
    candidate: input.standaloneGoalSemanticIr,
    requiredCoverageRefs: requiredCoverageRefs(input.standaloneGoalSemanticIr),
    responseSchemaVersion: 'StandaloneGoalAuthoringJudgeResponse/v1',
  };
  const request = validateRequest({
    ...requestPayload,
    judgeRequestHash: sha256Stable(requestPayload),
  });
  if (!publishImmutable(paths.requestPath, request)) {
    throw Object.assign(new Error('standalone_goal_authoring_judge_dispatch_ambiguous'), {
      failureClass: 'standalone_goal_authoring_judge_dispatch_ambiguous',
      goalJudgeDispatchCount: 0,
    });
  }
  writeCount += 1;

  const projectRoot = path.resolve(input.projectRoot);
  const response = validateResponse(
    await prepared.invoke({
      systemPrompt: SYSTEM_PROMPT,
      request,
      executionContext: {
        projectRoot,
        requestPath: path.relative(projectRoot, paths.requestPath).replace(/\\/gu, '/'),
        outputDir: path.relative(projectRoot, paths.transportRoot).replace(/\\/gu, '/'),
      },
      structuredOutputSchema: STRUCTURED_OUTPUT_SCHEMA,
    })
  );
  if (publishImmutable(paths.responsePath, response)) writeCount += 1;
  const aggregate = createAggregate({ candidateHash, request, selection, response });
  if (publishImmutable(paths.aggregatePath, aggregate)) writeCount += 1;
  if (aggregate.decision !== 'pass') terminalBlock(aggregate, 1);
  const effectivePass = createEffectivePass(candidateHash, aggregate);
  if (publishImmutable(paths.passPath, effectivePass)) writeCount += 1;
  return result({ aggregate, effectivePass, goalJudgeDispatchCount: 1, writeCount, paths });
}
