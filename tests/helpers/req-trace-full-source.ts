import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { materializeAiTddManifestCloseoutRunnerFixture } from './requirement-fixture-runtime';
import { extractRequirementsContractImplementationConfirmation, implementationConfirmationHashFor,
  sourceDocumentHashFor } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-implementation-confirmation-codec';

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
  projection: JsonObject,
  independentExpected: JsonObject
) {
  const fixture = materializeAiTddManifestCloseoutRunnerFixture({ root: path.join(root, 'test-only-consumer') });
  const originalSource = fs.readFileSync(fixture.sourcePath, 'utf8');
  const fencedYaml = /```yaml\r?\n([\s\S]*?)\r?\n```/u.exec(originalSource)?.[1];
  assert.ok(fencedYaml, 'The isolated legacy test template must contain its known YAML block');
  const original = (yaml.load(fencedYaml) as { implementationConfirmation: Record<string, unknown> }).implementationConfirmation;
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
  const confirmation = { ...original, ...projection, traceRows: boundTraces, acceptanceTests, e2eSuites,
    notDone, failurePaths, edgeCases, mustNot: [], confirmedBy: 'fixture',
    evidenceClass: 'test-only-complete-source-confirmation-replay-not-human-approval' };
  delete (confirmation as Record<string, unknown>).atomicImplementationTaskList;
  delete (confirmation as Record<string, unknown>).mustToAtomicTaskMap;
  delete (confirmation as Record<string, unknown>).atomicTaskToTraceMap;
  if (!(projection as Record<string, unknown>).closeoutReadinessPreview) {
    delete (confirmation as Record<string, unknown>).closeoutReadinessPreview;
  }
  const source = '# Test-Only Complete Real-Source Req-Trace Fixture\n\n' +
    'This isolated automatic-test confirmation record is not human confirmation or governed acceptance evidence.\n\n' +
    yaml.dump({ implementationConfirmation: confirmation }, { lineWidth: -1, noRefs: true });
  const sourceBytes = Buffer.byteLength(source, 'utf8');
  assert.ok(sourceBytes < 8 * 1024 * 1024, 'Test-only confirmation must stay inside the approved fixture I/O envelope');
  const parsed = extractRequirementsContractImplementationConfirmation(source);
  const hashes = { sourceDocumentHash: sourceDocumentHashFor(source, parsed.blockText, parsed.value),
    implementationConfirmationHash: implementationConfirmationHashFor(parsed.value) };
  const record = JSON.parse(fs.readFileSync(fixture.recordPath, 'utf8'));
  Object.assign(record, hashes);
  record.confirmationHistory = record.confirmationHistory.map((event: Record<string, unknown>) => ({
    ...event, ...hashes, confirmedBy: 'fixture', confirmationText: 'TEST-ONLY complete-source synthetic confirmation; not human evidence.',
  }));
  fs.writeFileSync(fixture.sourcePath, source, 'utf8');
  fs.writeFileSync(fixture.recordPath, `${JSON.stringify(record)}\n`, 'utf8');
  return { fixture: { ...fixture, ...hashes }, confirmed: parsed.value, sourceBytes };
}

export function stripOracleLocations(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripOracleLocations);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).filter(([key, child]) =>
    !['source', 'sourceLine', 'lineStart', 'lineEnd', 'byteStart', 'byteEnd'].includes(key) &&
    !(['start', 'end'].includes(key) && typeof child === 'number')).map(([key, child]) => [key, stripOracleLocations(child)]));
}
