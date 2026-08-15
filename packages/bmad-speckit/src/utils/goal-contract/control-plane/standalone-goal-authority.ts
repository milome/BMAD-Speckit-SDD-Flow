import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  sha256Stable,
  sha256Text,
  stableStringify,
} from '../../../main-agent/source-authority/scripts/requirements-contract-semantic-resolver';
import { probeGoalContractRenderability } from './goal-contract-renderability-probe';
import { validateGoalContractSchema } from './schema-registry';
import {
  runStandaloneGoalAuthoringJudge,
  type StandaloneGoalAuthoringJudgeDependencies,
} from './standalone-goal-authoring-judge';
import { compileStandaloneGoalExecution } from './standalone-goal-semantic-ir';

type JsonObject = Record<string, unknown>;

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
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.length > 0)
    : [];
}

function sortedUnique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right));
}

function canonicalBytes(value: unknown): Buffer {
  return Buffer.from(`${stableStringify(value)}\n`, 'utf8');
}

function publishImmutable(targetPath: string, bytes: Buffer): boolean {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  try {
    fs.writeFileSync(targetPath, bytes, { flag: 'wx' });
    if (!fs.readFileSync(targetPath).equals(bytes)) {
      throw new Error('standalone_goal_immutable_artifact_readback_failed');
    }
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    if (!fs.readFileSync(targetPath).equals(bytes)) {
      throw new Error('standalone_goal_immutable_artifact_conflict');
    }
    return false;
  }
}

function publishActiveAuthority(targetPath: string, value: JsonObject): boolean {
  const bytes = canonicalBytes(value);
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  if (fs.existsSync(targetPath)) {
    if (!fs.readFileSync(targetPath).equals(bytes)) {
      throw new Error('standalone_goal_active_authority_conflict');
    }
    return false;
  }
  const temporaryPath = `${targetPath}.candidate-${process.pid}`;
  publishImmutable(temporaryPath, bytes);
  try {
    fs.renameSync(temporaryPath, targetPath);
  } catch (error) {
    if (fs.existsSync(targetPath) && fs.readFileSync(targetPath).equals(bytes)) {
      fs.rmSync(temporaryPath, { force: true });
      return false;
    }
    throw error;
  }
  if (!fs.readFileSync(targetPath).equals(bytes)) {
    throw new Error('standalone_goal_active_authority_readback_failed');
  }
  return true;
}

function commandInvocation(value: string): string {
  return value
    .split(/\r?\n/gu)
    .filter((line) => !/^\s*(?:```|~~~)/u.test(line))
    .join('\n')
    .replace(/^\s*(?:[-*]\s+)?(?:Run\s+)?/iu, '')
    .trim();
}

function logicalPaths(rows: JsonObject[]): string[] {
  return sortedUnique(
    rows
      .flatMap((row) => [...text(row.exactText).matchAll(/`([^`]+)`/gu)].map((match) => match[1]))
      .filter((value) => /(?:^|\/)[^/]+\.[A-Za-z0-9]+$/u.test(value.replace(/\\/gu, '/')))
      .map((value) => value.replace(/\\/gu, '/'))
  );
}

function renderParentGoal(ir: JsonObject): string {
  return [
    '# Goal Execution Contract',
    '',
    `Goal Execution IR: ${text(ir.goalExecutionIRHash)}`,
    'Profile: standalone',
    '',
    '## Obligations',
    '',
    ...objects(ir.obligations).map(
      (row) => `- ${text(row.kind)} ${text(row.obligationId)}: ${text(row.text)}`
    ),
    '',
    '## Atomic Tasks',
    '',
    ...objects(ir.atomicTasks).map(
      (row) =>
        `- ${text(row.taskId)}: ${text(row.title)} (${String(row.expectedEffortMinutes)}m expected, ${String(row.upperBoundEffortMinutes)}m max)`
    ),
    '',
  ].join('\n');
}

export async function publishStandaloneGoalAuthority(
  input: {
    source: JsonObject;
    canonicalIntentBundle: JsonObject;
    goalContractPath: string;
    projectRoot?: string;
  },
  dependencies: StandaloneGoalAuthoringJudgeDependencies = {}
) {
  const rawRows = objects(input.source.sourceObligations);
  const rawById = new Map(rawRows.map((row) => [text(row.id), row]));
  const rawByCoordinate = new Map<string, JsonObject[]>();
  for (const row of rawRows) {
    const coordinate = `${String(row.startByte)}:${String(row.endByteExclusive)}`;
    rawByCoordinate.set(coordinate, [...(rawByCoordinate.get(coordinate) ?? []), row]);
  }
  const canonicalSpanById = new Map(
    objects(
      (input.canonicalIntentBundle.specSpanRegistry as JsonObject | undefined)?.specSpans
    ).map((span) => [text(span.specSpanId), span])
  );
  const canonicalRecords = objects(input.canonicalIntentBundle.canonicalIntentIR).filter(
    (row) => text(row.ownership) === 'owned_obligation'
  );
  const semanticRows = canonicalRecords.map((canonical) => {
    const declaredSourceId = text(canonical.declaredSourceId);
    const spanMatches = strings(canonical.specSpanRefs).flatMap((specSpanRef) => {
      const span = canonicalSpanById.get(specSpanRef);
      if (!span) return [];
      return (
        rawByCoordinate.get(`${String(span.startByte)}:${String(span.endByteExclusive)}`) ?? []
      );
    });
    const uniqueSpanMatches = [...new Map(spanMatches.map((row) => [text(row.id), row])).values()];
    const row = declaredSourceId
      ? rawById.get(declaredSourceId)
      : uniqueSpanMatches.length === 1
        ? uniqueSpanMatches[0]
        : undefined;
    if (!row) throw new Error('standalone_goal_successor_required:canonical_source_mapping');
    const sourceId = text(row.id);
    return {
      id: sourceId,
      classification: text(canonical.classification) || 'positive',
      exactText: text(row.exactText) || text(row.text),
      requiredOutcome: text(canonical.requiredOutcome) || text(row.exactText) || text(row.text),
      specSpanRefs: sortedUnique(strings(canonical.specSpanRefs)),
    };
  });
  const targetPaths = logicalPaths(rawRows);
  if (targetPaths.length === 0) {
    throw new Error('standalone_goal_successor_required:logical_target_paths');
  }
  const commandRows = rawRows.filter((row) =>
    ['command_block', 'verification_command'].includes(text(row.kind))
  );
  const commandRecords = commandRows
    .map((row, index) => ({
      commandId: strings(row.commandRefs)[0] || `CMD-standalone-${index + 1}`,
      invocation: commandInvocation(text(row.exactText) || text(row.text)),
    }))
    .filter((row) => row.invocation);
  if (commandRecords.length === 0) {
    throw new Error('standalone_goal_successor_required:commands');
  }
  const logicalSpecSpans = semanticRows.flatMap((row) =>
    row.specSpanRefs.map((specSpanId) => ({
      specSpanId,
      boundObligationIds: [row.id],
      evidenceClaimRefs: [],
    }))
  );
  const authorityRoot = path.resolve(`${input.goalContractPath}.authority`);
  const compiled = await compileStandaloneGoalExecution(
    {
      sourcePlanHash: text(input.source.sourcePlanHash),
      sourceSnapshotHash: text(input.source.sourceSnapshotHash),
      sourceObligations: semanticRows,
      logicalSpecSpans,
      technicalSnapshot: {
        targetPaths,
        commandRecords,
        artifactRecords: targetPaths.map((logicalPath, index) => ({
          artifactId: `ART-standalone-${index + 1}`,
          logicalPath,
        })),
        evidenceRecords: commandRecords.map((command, index) => ({
          evidenceContractId: `EVDREQ-standalone-${index + 1}`,
          requirement: `Observed RED/GREEN evidence for ${command.commandId}`,
        })),
        forbiddenPaths: ['.git/**'],
        isolationMode: 'consumer_worktree',
      },
    },
    {
      authoringJudge: async (request) =>
        runStandaloneGoalAuthoringJudge(
          {
            projectRoot: input.projectRoot ?? process.cwd(),
            authorityRoot,
            standaloneGoalSemanticIr: request.candidate,
          },
          dependencies
        ),
    }
  );
  const hashId = compiled.goalExecutionIr.goalExecutionIRHash.slice('sha256:'.length);
  const semanticPath = path.join(
    authorityRoot,
    'goal',
    'standalone-semantic',
    compiled.standaloneGoalSemanticIr.standaloneGoalSemanticIRHash.slice(7),
    'standalone-goal-semantic-ir.json'
  );
  const passPath = path.join(
    authorityRoot,
    'goal',
    'standalone-semantic',
    compiled.standaloneGoalSemanticIr.standaloneGoalSemanticIRHash.slice(7),
    'authoring-judge',
    'authoring-effective-pass.json'
  );
  const irPath = path.join(authorityRoot, 'goal', 'ir', hashId, 'goal-execution-ir.json');
  const closurePath = path.join(
    authorityRoot,
    'goal',
    'closures',
    hashId,
    'goal-execution-closure.json'
  );
  const projectionPath = path.join(
    authorityRoot,
    'goal',
    'projections',
    hashId,
    'goal-execution-contract.md'
  );
  const renderabilityPath = path.join(
    authorityRoot,
    'goal',
    'projections',
    hashId,
    'renderability-report.json'
  );
  const sourceBindingPayload = {
    schemaVersion: 'GoalSourceBinding/v1',
    profile: 'standalone',
    goalExecutionIRHash: compiled.goalExecutionIr.goalExecutionIRHash,
    sourcePlanHash: text(input.source.sourcePlanHash),
    sourceSnapshotHash: text(input.source.sourceSnapshotHash),
  };
  const sourceBinding = {
    ...sourceBindingPayload,
    goalSourceBindingHash: sha256Stable(sourceBindingPayload),
  };
  const bindingPath = path.join(
    authorityRoot,
    'goal',
    'bindings',
    sourceBinding.goalSourceBindingHash.slice(7),
    'goal-source-binding.json'
  );
  const evidencePayload = {
    schemaVersion: 'GoalContractResolvedEvidenceIndex/v1',
    profile: 'standalone',
    goalExecutionIRHash: compiled.goalExecutionIr.goalExecutionIRHash,
    goalSourceBindingHash: sourceBinding.goalSourceBindingHash,
    resolutions: compiled.goalExecutionIr.obligations.map((obligation) => ({
      goalObligationId: obligation.obligationId,
      logicalSpecSpanRefs: obligation.sourceRefs.filter(
        (ref) => ref.startsWith('spec-span-') || ref.startsWith('SPAN-')
      ),
      evidenceClaimRefs: obligation.evidenceClaimRefs,
    })),
  };
  const evidenceIndex = {
    ...evidencePayload,
    resolvedEvidenceIndexHash: sha256Stable(evidencePayload),
  };
  validateGoalContractSchema('goal-source-binding.schema.json', sourceBinding);
  validateGoalContractSchema('goal-contract-resolved-evidence-index.schema.json', evidenceIndex);
  const evidencePath = path.join(
    authorityRoot,
    'goal',
    'bindings',
    sourceBinding.goalSourceBindingHash.slice(7),
    'resolved-evidence-index.json'
  );
  const parentProjection = renderParentGoal(compiled.goalExecutionIr);
  const renderability = probeGoalContractRenderability({
    goalExecutionIr: compiled.goalExecutionIr,
    markdown: parentProjection,
  });
  if (renderability.decision !== 'pass') throw new Error(renderability.issueCodes[0]);
  const renderabilityBytes = canonicalBytes(renderability);
  const activePath = path.join(authorityRoot, 'goal', 'active-authority.json');
  const refs = {
    standaloneSemanticIrRef: {
      path: path.relative(authorityRoot, semanticPath).replace(/\\/gu, '/'),
      hash: compiled.standaloneGoalSemanticIr.standaloneGoalSemanticIRHash,
    },
    standaloneAuthoringEffectivePassRef: {
      path: path.relative(authorityRoot, passPath).replace(/\\/gu, '/'),
      hash: compiled.authoringEffectivePass.authoringEffectivePassHash,
    },
    goalExecutionIrRef: {
      path: path.relative(authorityRoot, irPath).replace(/\\/gu, '/'),
      hash: compiled.goalExecutionIr.goalExecutionIRHash,
    },
    sourceBindingRef: {
      path: path.relative(authorityRoot, bindingPath).replace(/\\/gu, '/'),
      hash: sourceBinding.goalSourceBindingHash,
    },
    resolvedEvidenceIndexRef: {
      path: path.relative(authorityRoot, evidencePath).replace(/\\/gu, '/'),
      hash: evidenceIndex.resolvedEvidenceIndexHash,
    },
    closureRef: {
      path: path.relative(authorityRoot, closurePath).replace(/\\/gu, '/'),
      hash: compiled.closure.goalExecutionClosureHash,
    },
    parentProjectionRef: {
      path: path.relative(authorityRoot, projectionPath).replace(/\\/gu, '/'),
      bytesHash: sha256Text(parentProjection),
    },
    renderabilityReportRef: {
      path: path.relative(authorityRoot, renderabilityPath).replace(/\\/gu, '/'),
      bytesHash: sha256Text(renderabilityBytes.toString('utf8')),
    },
  };
  const activePayload = {
    schemaVersion: 'GoalContractActiveAuthority/v1',
    profile: 'standalone',
    goalId: compiled.goalExecutionIr.goalId,
    goalExecutionIRHash: compiled.goalExecutionIr.goalExecutionIRHash,
    ...refs,
  };
  const active = { ...activePayload, activeAuthorityHash: sha256Stable(activePayload) };
  validateGoalContractSchema('goal-contract-active-authority.schema.json', active);
  const artifacts: Array<[string, Buffer]> = [
    [irPath, canonicalBytes(compiled.goalExecutionIr)],
    [closurePath, canonicalBytes(compiled.closure)],
    [bindingPath, canonicalBytes(sourceBinding)],
    [evidencePath, canonicalBytes(evidenceIndex)],
    [projectionPath, Buffer.from(parentProjection, 'utf8')],
    [renderabilityPath, renderabilityBytes],
  ];
  let writeCount = compiled.authoringJudge.writeCount ?? 0;
  for (const [artifactPath, bytes] of artifacts) {
    if (publishImmutable(artifactPath, bytes)) writeCount += 1;
  }
  if (publishActiveAuthority(activePath, active)) writeCount += 1;
  return Object.freeze({
    goalRunRoot: authorityRoot,
    goalJudgeDispatchCount: compiled.goalJudgeDispatchCount,
    publicationStatus: writeCount === 0 ? 'reused' : 'published',
    writeCount,
    goalExecutionIRHash: compiled.goalExecutionIr.goalExecutionIRHash,
    providerSelectionRef: compiled.authoringJudge.refs?.providerSelectionRef,
    authoringJudgeRequestRef: compiled.authoringJudge.refs?.requestRef,
    authoringJudgeResponseRef: compiled.authoringJudge.refs?.responseRef,
    authoringJudgeAggregateRef: compiled.authoringJudge.refs?.aggregateRef,
    standaloneGoalSemanticIrRef: { path: semanticPath, hash: refs.standaloneSemanticIrRef.hash },
    standaloneAuthoringEffectivePassRef: {
      path: passPath,
      hash: refs.standaloneAuthoringEffectivePassRef.hash,
    },
    goalExecutionIrRef: { path: irPath, hash: refs.goalExecutionIrRef.hash },
    sourceBindingRef: { path: bindingPath, hash: refs.sourceBindingRef.hash },
    resolvedEvidenceIndexRef: { path: evidencePath, hash: refs.resolvedEvidenceIndexRef.hash },
    closureRef: { path: closurePath, hash: refs.closureRef.hash },
    renderabilityReportRef: {
      path: renderabilityPath,
      bytesHash: refs.renderabilityReportRef.bytesHash,
    },
    activeAuthorityRef: { path: activePath, hash: active.activeAuthorityHash },
  });
}
