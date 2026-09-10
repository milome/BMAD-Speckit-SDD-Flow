import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import path from 'node:path';
import { createRequirementsContractBuildManifest,
  createRequirementsContractCheckpointManifest } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-authoring-manifest';
import { confirmRequirementsContractIrScope,
  renderAndPromoteRequirementsContractConfirmation } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-confirmation-acceptance';
import { resolveConfirmedRequirementsAuthority } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-confirmed-authority-adapter';
import { prepareRequirementsContractCp05Cp08Projection,
  REQUIREMENTS_CONTRACT_PROJECTION_CHECKPOINT_PROFILES } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-cp05-cp08';
import { extractRequirementsContractImplementationConfirmation,
  serializeRequirementsContractImplementationConfirmation } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-implementation-confirmation-codec';
import { compileRequirementsEffectivePassReceiptV2 } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-requirements-effective-pass-gate';
import { sha256Stable,
  sha256Text } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-semantic-resolver';
import { compileRequirementsTypedSourceCandidate } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-typed-source-compiler';
import type { scanRequirementsContractConsumerAuthority } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-consumer-authority-scanner';

type JsonObject = Record<string, unknown>;
const objects = (value: unknown): JsonObject[] => Array.isArray(value) ? value.filter((entry): entry is JsonObject => !!entry && typeof entry === 'object' && !Array.isArray(entry)) : [];
const refs = (value: unknown): string[] => Array.isArray(value)
  ? value.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0) : [];
const sourceText = (value: unknown, fallback: string): string => {
  const text = objects(value).map((entry) => String(entry.text ?? '').trim()).filter(Boolean).join('\n');
  assert.ok(text, fallback);
  return text;
};
const sourcePointer = (work: JsonObject, field: string, fallback: string): string => {
  sourceText(work[field], fallback);
  const blockIds = objects(work[field]).map((entry) => String(entry.blockId)).filter(Boolean);
  assert.ok(blockIds.length > 0, fallback);
  return `typedSourceAuthority.workDeclarations.${work.id}.${field}:${blockIds.join(',')}`;
};

export function materializeFullSourceReqTraceFixture(
  root: string,
  scanned: ReturnType<typeof scanRequirementsContractConsumerAuthority>,
  projection: JsonObject,
  independentExpected: JsonObject
) {
  const works = objects(independentExpected.sections).flatMap((section) => objects(section.works));
  const projectedTraces = objects(projection.traceRows);
  const traceByWork = new Map(projectedTraces.flatMap((trace) => refs(trace.covers).map((id) => [id, trace] as const)));
  assert.equal(works.length, projectedTraces.length, 'Every independent WORK must have one projected trace');
  const requiredCommands = objects(projection.requiredCommands);
  const requiredCommandIds = new Set(requiredCommands.map((row) => String(row.id)));
  const boundTraces = works.map((work) => {
    const trace = traceByWork.get(String(work.id));
    assert.ok(trace, `Independent WORK ${work.id} must bind to a projected trace`);
    return { ...trace, covers: [String(work.id), `NEG-${work.id}`],
      acceptanceRefs: [`ACC-${work.id}`], failurePathRefs: [`FAIL-${work.id}`], edgeCaseRefs: [`EDGE-${work.id}`] };
  });
  const acceptanceTests = works.map((work) => {
    const trace = traceByWork.get(String(work.id))!;
    const commandRefs = [...new Set([...refs(trace.contractValidationCommandRefs), ...refs(trace.deliveryEvidenceCommandRefs)])];
    assert.ok(commandRefs.length > 0 && commandRefs.every((id) => requiredCommandIds.has(id)),
      `Independent WORK ${work.id} must retain a required validation command`);
    const testFile = refs(work.testPaths)[0];
    assert.ok(testFile, `Independent WORK ${work.id} must retain a source-declared test path`);
    return { id: `ACC-${work.id}`, file: testFile, commandRefs, covers: [String(work.id), `NEG-${work.id}`],
      failurePathRefs: [`FAIL-${work.id}`], edgeCaseRefs: [`EDGE-${work.id}`], traceRows: [String(trace.id)],
      evidenceRefs: refs(trace.evidenceRefs), expectedPreImplementationState: 'expected_red',
      redProofPlan: sourcePointer(work, 'red', `Independent WORK ${work.id} must retain a RED proof plan`),
      oracle: sourcePointer(work, 'pass', `Independent WORK ${work.id} must retain a PASS oracle`) };
  });
  const notDone = works.map((work) => ({ id: `NEG-${work.id}`,
    text: sourcePointer(work, 'failOrBlocked', `Independent WORK ${work.id} must retain a failure oracle`),
    evidenceRefs: refs(traceByWork.get(String(work.id))!.evidenceRefs),
    whyItBlocksCompletion: `Resolve NEG-${work.id} through its typed source pointer before completion.`,
    negativeAssertionRequired: true, coveredByFailurePath: [`FAIL-${work.id}`] }));
  const failurePaths = works.map((work) => ({ id: `FAIL-${work.id}`, linkedNegIds: [`NEG-${work.id}`],
    linkedEvidenceIds: refs(traceByWork.get(String(work.id))!.evidenceRefs),
    expectedBehavior: sourcePointer(work, 'failOrBlocked', `Independent WORK ${work.id} must retain a failure path`) }));
  const edgeCases = works.map((work) => ({ id: `EDGE-${work.id}`, linkedFailurePathIds: [`FAIL-${work.id}`],
    linkedEvidenceIds: refs(traceByWork.get(String(work.id))!.evidenceRefs),
    expectedBehavior: sourcePointer(work, work.stop?.length ? 'stop' : 'failOrBlocked',
      `Independent WORK ${work.id} must retain a stop or edge condition`) }));
  const aggregate = works.find((work) => work.id === 'WORK-16');
  assert.ok(aggregate, 'Independent expected manifest must retain WORK-16 final aggregate validation');
  const aggregateTrace = traceByWork.get('WORK-16')!;
  const aggregateCommands = [...new Set([...refs(aggregateTrace.contractValidationCommandRefs),
    ...refs(aggregateTrace.deliveryEvidenceCommandRefs)])];
  const e2eSuites = [{ id: 'E2E-WORK-16-FINAL', file: refs(aggregate.testPaths)[0], commandRefs: aggregateCommands,
    covers: works.flatMap((work) => [String(work.id), `NEG-${work.id}`]),
    failurePathRefs: works.map((work) => `FAIL-${work.id}`), edgeCaseRefs: works.map((work) => `EDGE-${work.id}`),
    traceRows: boundTraces.map((trace) => String(trace.id)),
    evidenceRefs: [...new Set(boundTraces.flatMap((trace) => refs(trace.evidenceRefs)))],
    expectedPreImplementationState: 'expected_red',
    redProofPlan: sourcePointer(aggregate, 'red', 'WORK-16 must retain the final RED proof plan'),
    oracle: sourcePointer(aggregate, 'pass', 'WORK-16 must retain the final PASS oracle') }];
  const confirmation = { ...projection, traceRows: boundTraces, acceptanceTests, e2eSuites,
    notDone, failurePaths, edgeCases, mustNot: [], confirmedBy: 'fixture',
    evidenceClass: 'test-only-complete-source-confirmation-replay-not-human-approval' };
  delete (confirmation as Record<string, unknown>).atomicImplementationTaskList;
  delete (confirmation as Record<string, unknown>).mustToAtomicTaskMap;
  delete (confirmation as Record<string, unknown>).atomicTaskToTraceMap;
  if (!(projection as Record<string, unknown>).closeoutReadinessPreview) {
    delete (confirmation as Record<string, unknown>).closeoutReadinessPreview;
  }
  const projectRoot = path.join(root, 'test-only-consumer');
  const graphHash = String(scanned.typedSourceAuthority?.graphHash ?? '');
  assert.match(graphHash, /^sha256:[a-f0-9]{64}$/u);
  const requestId = `REQ-TRACE-FULL-${graphHash.slice(7, 23).toUpperCase()}`;
  const attemptId = `ATTEMPT-${requestId}`;
  const recordRoot = path.join(projectRoot, '_bmad-output', 'runtime', 'requirement-records', requestId);
  const compiled = compileRequirementsTypedSourceCandidate({
    scan: scanned,
    authoringRequestId: requestId,
    authoringAttemptId: attemptId,
    confirmationSemantics: confirmation,
  });
  const writeJson = (relativePath: string, value: unknown) => {
    const target = path.join(recordRoot, ...relativePath.split('/'));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  };
  const semanticPath = `authoring/semantic-revisions/${compiled.semanticIr.semanticRevisionId}/semantic-ir.json`;
  const bindingPath = `authoring/source-bindings/${compiled.sourceBinding.bindingRevisionId}/source-binding.json`;
  const resolvedEvidencePath = `authoring/source-bindings/${compiled.sourceBinding.bindingRevisionId}/resolved-evidence-index.json`;
  writeJson(semanticPath, compiled.semanticIrAuthority);
  writeJson(bindingPath, compiled.sourceBinding);
  writeJson(resolvedEvidencePath, compiled.resolvedEvidenceIndex);

  const prepared = prepareRequirementsContractCp05Cp08Projection({
    semanticIr: compiled.semanticIr,
    resolvedEvidenceIndex: compiled.resolvedEvidenceIndex,
  });
  const cp05ProjectionPath = `authoring/staging/${attemptId}/cp05/confirmation-projection.json`;
  const cp05MarkdownPath = `authoring/staging/${attemptId}/cp05/final-source.md`;
  const cp06ExecutionPath = `authoring/staging/${attemptId}/cp06/execution-manifest.json`;
  writeJson(cp05ProjectionPath, prepared.cp05Projection);
  const cp05MarkdownTarget = path.join(recordRoot, ...cp05MarkdownPath.split('/'));
  fs.mkdirSync(path.dirname(cp05MarkdownTarget), { recursive: true });
  fs.writeFileSync(cp05MarkdownTarget, prepared.markdown, 'utf8');
  writeJson(cp06ExecutionPath, prepared.cp06Execution.executionManifest);

  const inputManifestHash = sha256Stable({ testOnly: true, requestId, graphHash });
  const coreProfiles = [
    'requirements-contract-cp00-cp04-compiler/v1',
    'requirements-contract-cp00-cp04-compiler/v1',
    'requirements-contract-cp00-cp04-compiler/v1',
    'requirements-contract-cp00-cp04-compiler/v1',
    'requirements-contract-cp02-compiler/v1',
  ];
  let previousRef: { checkpointId: string; checkpointOrdinal: number; path: string; hash: string } | null = null;
  for (let ordinal = 0; ordinal <= 8; ordinal += 1) {
    const checkpointId = `cp${String(ordinal).padStart(2, '0')}`;
    const artifactEntries = ordinal === 5 ? [
      { role: 'confirmation_projection', schemaVersion: String(prepared.cp05Projection.schemaVersion),
        artifactId: 'confirmation-projection', recordRelativePath: cp05ProjectionPath,
        artifactHash: sha256Stable(prepared.cp05Projection) },
      { role: 'final_markdown', schemaVersion: 'text/markdown', artifactId: 'final-markdown',
        recordRelativePath: cp05MarkdownPath, artifactHash: sha256Text(prepared.markdown) },
    ] : ordinal === 6 ? [
      { role: 'execution_manifest', schemaVersion: String(prepared.cp06Execution.executionManifest.schemaVersion),
        artifactId: 'execution-manifest', recordRelativePath: cp06ExecutionPath,
        artifactHash: sha256Stable(prepared.cp06Execution.executionManifest) },
    ] : [];
    const compilerIdentity = ordinal < 5 ? coreProfiles[ordinal] :
      REQUIREMENTS_CONTRACT_PROJECTION_CHECKPOINT_PROFILES[checkpointId as 'cp05'].profileId;
    const manifest = createRequirementsContractCheckpointManifest({
      authoringRequestId: requestId,
      authoringAttemptId: attemptId,
      checkpointId,
      checkpointOrdinal: ordinal,
      stage: checkpointId,
      status: 'passed',
      inputManifestHash,
      previousCheckpointManifestRef: previousRef,
      latestValidPredecessorCheckpoint: previousRef?.checkpointId ?? null,
      compilerIdentity,
      artifactEntries,
      decisionReceiptRefs: [],
      baseAuthorityRef: null,
    } as Parameters<typeof createRequirementsContractCheckpointManifest>[0]);
    const manifestPath = `authoring/staging/${attemptId}/manifests/${ordinal}-${checkpointId}.json`;
    writeJson(manifestPath, manifest);
    previousRef = { checkpointId, checkpointOrdinal: ordinal, path: manifestPath,
      hash: manifest.checkpointManifestHash };
  }
  assert.ok(previousRef);
  const auditPacketPath = `authoring/staging/${attemptId}/judge-audit-packet.json`;
  writeJson(auditPacketPath, prepared.auditPacket);
  const buildManifest = createRequirementsContractBuildManifest({
    authoringRequestId: requestId,
    authoringAttemptId: attemptId,
    inputManifestHash,
    terminalCheckpointManifestRef: previousRef,
    semanticAuthorityRef: { semanticRevisionId: compiled.semanticIr.semanticRevisionId,
      path: semanticPath, hash: compiled.semanticIr.scopeSemanticHash },
    bindingAuthorityRef: { bindingRevisionId: compiled.sourceBinding.bindingRevisionId,
      path: bindingPath, hash: compiled.sourceBinding.sourceBindingHash },
    artifactEntries: [],
    decisionReceiptRefs: [],
    auditPacketRef: { artifactId: 'judge-audit-packet', path: auditPacketPath,
      hash: sha256Stable(prepared.auditPacket) },
    projectionReportRefs: [],
  });
  const buildPath = `authoring/staging/${attemptId}/contract-build-manifest.json`;
  writeJson(buildPath, buildManifest);
  const activeAuthority = {
    activeSemanticRevisionId: compiled.semanticIr.semanticRevisionId,
    activeSemanticIrPath: semanticPath,
    activeScopeSemanticHash: compiled.semanticIr.scopeSemanticHash,
    activeBindingRevisionId: compiled.sourceBinding.bindingRevisionId,
    activeSourceBindingPath: bindingPath,
    activeSourceBindingHash: compiled.sourceBinding.sourceBindingHash,
    activeAuthoringAttemptId: attemptId,
    activeBuildManifestPath: buildPath,
    activeBuildManifestHash: buildManifest.buildManifestHash,
  };
  const evidenceHash = (role: string) => sha256Stable({ testOnly: true, role, requestId });
  const effectivePass = compileRequirementsEffectivePassReceiptV2({
    activeAuthority,
    aggregate: { schemaVersion: 'requirements-contract-requirements-audit-aggregate/v2',
      semanticRevisionId: compiled.semanticIr.semanticRevisionId,
      scopeSemanticHash: compiled.semanticIr.scopeSemanticHash,
      sourceBindingHash: compiled.sourceBinding.sourceBindingHash,
      buildManifestHash: buildManifest.buildManifestHash,
      providerSelectionHash: evidenceHash('provider-selection'), judgeRequestHash: evidenceHash('judge-request'),
      judgeResponseHash: evidenceHash('judge-response'), requirementsAuditAggregateHash: evidenceHash('aggregate'),
      validatedDimensionIds: ['authority'], reviewedArtifactRefs: ['judge-audit-packet'],
      reviewedMustRefs: (confirmation.must as Array<{ id: string }>).map((row) => row.id),
      findings: [], issueCodes: [], decision: 'pass' },
  });
  writeJson('quality/requirements-effective-pass-receipt.json', effectivePass);
  const recordPath = path.join(recordRoot, 'record', 'requirement-record.json');
  writeJson('record/requirement-record.json', { schemaVersion: 'requirements-contract-record/v1',
    recordId: requestId, lifecycle: 'audit_pending', confirmedScopeSemanticHash: null, activeAuthority });
  writeJson(`authoring/staging/${attemptId}/authoring-context.json`, {
    schemaVersion: 'requirements-authoring-continuation-context/v1', authoringRequestId: requestId,
    authoringAttemptId: attemptId, confirmationLanguage: 'en-US', intakeSource: 'test-only-full-source',
    targetSource: 'docs/test-only-full-source-confirmed.md', authoritySourceListHash: inputManifestHash,
  });
  const rendered = renderAndPromoteRequirementsContractConfirmation({ projectRoot, requestId });
  confirmRequirementsContractIrScope({ projectRoot, requestId,
    exactConfirmationText: rendered.confirmation.exactConfirmationText });
  const sourcePath = path.join(projectRoot, ...rendered.confirmation.markdownPath.split('/'));
  const source = fs.readFileSync(sourcePath, 'utf8');
  const authority = resolveConfirmedRequirementsAuthority({ projectRoot, requirementRecordPath: recordPath });
  const parsed = extractRequirementsContractImplementationConfirmation(
    serializeRequirementsContractImplementationConfirmation(authority.implementationConfirmation)
  );
  const sourceBytes = Buffer.byteLength(source, 'utf8');
  assert.ok(sourceBytes < 8 * 1024 * 1024, 'Test-only confirmation must stay inside the approved fixture I/O envelope');
  return { fixture: { root: projectRoot, fixtureId: requestId, sourcePath,
    sourceDocumentHash: authority.lineage.finalMarkdownHash,
    implementationConfirmationHash: authority.lineage.implementationConfirmationHash,
    recordPath, recordId: requestId, requirementSetId: requestId },
  confirmed: parsed.value, sourceBytes };
}

export function stripOracleLocations(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripOracleLocations);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).filter(([key, child]) =>
    !['source', 'sourceLine', 'lineStart', 'lineEnd', 'byteStart', 'byteEnd'].includes(key) &&
    !(['start', 'end'].includes(key) && typeof child === 'number')).map(([key, child]) => [key, stripOracleLocations(child)]));
}
