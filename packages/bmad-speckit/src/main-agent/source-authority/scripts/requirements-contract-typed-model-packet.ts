import type { RequirementsTypedSourceAuthority } from './requirements-contract-typed-source-semantics.ts';

type JsonObject = Record<string, unknown>;
const object = (value: unknown): value is JsonObject => !!value && typeof value === 'object' && !Array.isArray(value);
const rows = (value: unknown): JsonObject[] => Array.isArray(value) ? value.filter(object) : [];
const refs = (value: unknown): string[] => Array.isArray(value) ? value.filter((ref): ref is string => typeof ref === 'string') : [];
const equal = (left: unknown, right: unknown) => stableStringify(left) === stableStringify(right);

function typedPacketRuntime() {
  if (__filename.endsWith('.ts')) require('tsx/cjs');
  const semantics = require(__filename.endsWith('.ts')
    ? './requirements-contract-typed-source-semantics.ts'
    : './requirements-contract-typed-source-semantics') as {
    assertTypedConfirmationProjection: (projection: JsonObject) => void;
    createTypedSourceCoverage: (authority: RequirementsTypedSourceAuthority) => unknown;
  };
  const resolver = require(__filename.endsWith('.ts')
    ? './requirements-contract-semantic-resolver.ts'
    : './requirements-contract-semantic-resolver') as {
    stableStringify: (value: unknown) => string;
  };
  const projection = require(__filename.endsWith('.ts')
    ? './requirements-contract-typed-packet-projection.ts'
    : './requirements-contract-typed-packet-projection') as {
    typedModelPacketProjectionRefs: () => JsonObject;
  };
  return { ...semantics, ...resolver, ...projection };
}

function stableStringify(value: unknown): string {
  return typedPacketRuntime().stableStringify(value);
}

function validateTraceProjection(packet: JsonObject, manifest: JsonObject | undefined): string[] {
  const traces = rows(manifest?.traceRows);
  const slices = rows(packet.traceSlices);
  const tasks = rows(packet.atomicImplementationTaskList);
  const requirements = object(packet.requirements) ? packet.requirements : {};
  const coveredIds = new Set([...rows(requirements.must), ...rows(requirements.notDone)].map((row) => row.id));
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const traceById = new Map(traces.map((trace) => [trace.id, trace]));
  const issues: string[] = [];
  if (!Array.isArray(manifest?.traceRows) || !equal(packet.traceOrder, traces.map((row) => row.id)) ||
    traceById.size !== traces.length || traces.some((trace) => typeof trace.id !== 'string')) {
    issues.push('typed_packet_trace_order_invalid');
  }
  const preservedRefs = ['covers', 'taskRefs', 'evidenceRefs', 'acceptanceRefs', 'boundaryViewRefs',
    'failurePathRefs', 'edgeCaseRefs', 'artifactRefs', 'targetModificationPaths', 'currentTargetMapRefs',
    'canonicalSurfaceRefs', 'legacyDenialRefs', 'expectedRedProofs', 'allowedRuntimeWrites', 'forbiddenProofTypes'];
  if (slices.length !== traces.length || slices.some((slice, index) => {
    const trace = traces[index];
    return slice.traceId !== trace.id || preservedRefs.some((key) => !equal(refs(slice[key]), refs(trace[key]))) ||
      ['status', 'greenExitCriteria', 'refactorGuards'].some((key) => trace[key] !== undefined && !equal(slice[key] ?? '', trace[key]));
  })) issues.push('typed_packet_trace_slice_invalid');
  if (traces.some((trace) => refs(trace.covers).some((id) => !coveredIds.has(id)) ||
    refs(trace.taskRefs).some((id) => !taskById.has(id) || !refs(taskById.get(id)?.traceRefs).includes(String(trace.id)))) ||
    tasks.some((task) => refs(task.traceRefs).some((id) => {
      const trace = traceById.get(id);
      return !trace || !refs(trace.taskRefs).includes(String(task.id)) ||
        refs(task.requirementRefs).some((ref) => !refs(trace.covers).includes(ref));
    }))) issues.push('typed_packet_trace_relation_invalid');
  return issues;
}

function validateCompactProjectionRefs(packet: JsonObject, manifest: JsonObject | undefined): string[] {
  if (packet.projectionRefs === undefined) {
    if (packet.schemaVersion !== 'req-trace-ai-tdd-model-packet/v2') return [];
    const keys = ['requiredCommands', 'errorCaseCoverage', 'acceptanceTests', 'e2eSuites'] as const;
    const topLevelPresent = keys.every((key) => packet[key] !== undefined);
    const manifestPresent = keys.every((key) => manifest?.[key] !== undefined);
    // A v2 packet without refs is the full internal form and must carry every
    // projection at the top level. A published/compact form must declare refs.
    return topLevelPresent && (!manifestPresent || keys.every((key) => equal(packet[key], manifest?.[key])))
      ? []
      : ['typed_packet_projection_refs_missing'];
  }
  const expected = typedPacketRuntime().typedModelPacketProjectionRefs();
  if (!equal(packet.projectionRefs, expected) || !Array.isArray(manifest?.requiredCommands) ||
    !object(manifest?.errorCaseCoverage) || !Array.isArray(manifest?.acceptanceTests) ||
    !Array.isArray(manifest?.e2eSuites)) return ['typed_packet_projection_ref_invalid'];
  const conflicts = (['requiredCommands', 'errorCaseCoverage', 'acceptanceTests', 'e2eSuites'] as const)
    .filter((key) => packet[key] !== undefined && !equal(packet[key], manifest?.[key]));
  return conflicts.length > 0 ? ['typed_packet_projection_conflict'] : [];
}

function resolvePacketCoverage(authority: JsonObject, value: unknown): JsonObject {
  const expected = typedPacketRuntime().createTypedSourceCoverage(
    authority as unknown as RequirementsTypedSourceAuthority
  ) as JsonObject;
  if (equal(value, expected)) return expected;
  if (!object(value) || value.schemaVersion !== 'requirements-contract-typed-source-coverage-ref/v2' ||
    value.graphHash !== authority.graphHash || value.coverageHash !== expected.coverageHash ||
    Object.keys(value).some((key) => !['schemaVersion', 'graphHash', 'coverageHash'].includes(key))) {
    throw new Error('typed_packet_coverage_ref_invalid');
  }
  return expected;
}

function matchesConfirmedProjection(packet: JsonObject, confirmation: JsonObject, manifest: JsonObject | undefined,
  resolvedCoverage: JsonObject | undefined): boolean {
  const requirements = object(packet.requirements) ? packet.requirements : {};
  const traces = rows(manifest?.traceRows);
  const confirmedTraces = rows(confirmation.traceRows);
  const preservedTraces = traces.length === confirmedTraces.length && traces.every((trace, index) =>
    Object.entries(confirmedTraces[index]).every(([key, value]) => equal(trace[key], value)));
  return equal(packet.typedSourceAuthority, confirmation.typedSourceAuthority) &&
    equal(resolvedCoverage, confirmation.typedCoverage) &&
    equal(rows(packet.atomicImplementationTaskList), rows(confirmation.implementationTasks)) &&
    preservedTraces &&
    equal(rows(packet.boundaryViews), rows(confirmation.boundaryViews)) &&
    ['must', 'notDone', 'mustNot', 'evidence'].every((key) => equal(rows(requirements[key]), rows(confirmation[key])));
}

export function validateTypedModelPacket(
  packet: JsonObject, receipt?: JsonObject, confirmation?: JsonObject
): string[] {
  const manifest = object(packet.contractExecutionManifest) ? packet.contractExecutionManifest : undefined;
  const authority = object(packet.typedSourceAuthority) ? packet.typedSourceAuthority : undefined;
  const coverage = object(packet.typedCoverage) ? packet.typedCoverage : undefined;
  const requirements = object(packet.requirements) ? packet.requirements : undefined;
  const hasTyped = packet.typedSourceAuthority !== undefined || packet.typedCoverage !== undefined ||
    packet.schemaVersion === 'req-trace-ai-tdd-model-packet/v2' || confirmation?.typedSourceAuthority !== undefined ||
    confirmation?.typedCoverage !== undefined || manifest?.typedSourceAuthorityRef !== undefined ||
    manifest?.typedCoverageRef !== undefined || manifest?.schemaVersion === 'contract-execution-manifest/v2' ||
    receipt?.schemaVersion === 'req-trace-ai-tdd-compiler-audit-receipt/v2' ||
    receipt?.typedSourceAuthorityHash !== undefined || receipt?.typedCoverageHash !== undefined;
  if (!hasTyped) return [];
  const issues: string[] = [];
  if (packet.schemaVersion !== 'req-trace-ai-tdd-model-packet/v2') issues.push('typed_packet_version_invalid');
  let resolvedCoverage: JsonObject | undefined;
  try {
    if (!authority) throw new Error('typed_packet_authority_missing');
    resolvedCoverage = resolvePacketCoverage(authority, coverage);
    typedPacketRuntime().assertTypedConfirmationProjection({ typedSourceAuthority: packet.typedSourceAuthority,
      typedCoverage: resolvedCoverage, must: requirements?.must,
      implementationTasks: packet.atomicImplementationTaskList });
  } catch {
    issues.push('typed_packet_authority_invalid');
  }
  if (confirmation && !matchesConfirmedProjection(packet, confirmation, manifest, resolvedCoverage)) {
    issues.push('typed_packet_confirmed_source_mismatch');
  }
  if (!object(authority) || !object(coverage) || !object(resolvedCoverage) || !object(manifest) ||
    manifest.schemaVersion !== 'contract-execution-manifest/v2' ||
    stableStringify(manifest.typedSourceAuthorityRef) !== stableStringify({
      schemaVersion: authority?.schemaVersion, graphHash: authority?.graphHash,
      authorityPath: 'model_packet.json#/typedSourceAuthority',
    }) || stableStringify(manifest.typedCoverageRef) !== stableStringify({
      schemaVersion: resolvedCoverage?.schemaVersion, coverageHash: resolvedCoverage?.coverageHash,
      authorityPath: 'model_packet.json#/typedCoverage',
    }) || manifest.typedSourceAuthority !== undefined || manifest.typedCoverage !== undefined) {
    issues.push('typed_packet_manifest_binding_invalid');
  }
  if (receipt && (receipt.schemaVersion !== 'req-trace-ai-tdd-compiler-audit-receipt/v2' ||
    receipt.typedSourceAuthorityHash !== authority?.graphHash || receipt.typedCoverageHash !== resolvedCoverage?.coverageHash)) {
    issues.push('typed_packet_receipt_binding_invalid');
  }
  issues.push(...validateTraceProjection(packet, manifest));
  issues.push(...validateCompactProjectionRefs(packet, manifest));
  return issues;
}

/** Strict publication oracle: validates the compact v2 projection after rendering and budgeting.
 * @param {JsonObject} packet Model packet to validate.
 * @param {JsonObject} [receipt] Optional compiler audit receipt bound to the packet.
 * @param {JsonObject} [confirmation] Optional confirmed projection to compare with the packet.
 * @returns {string[]} Deduplicated validation issue codes.
 */
export function validateTypedModelPacketPublication(
  packet: JsonObject, receipt?: JsonObject, confirmation?: JsonObject
): string[] {
  const issues = validateTypedModelPacket(packet, receipt, confirmation);
  if (packet.schemaVersion === 'req-trace-ai-tdd-model-packet/v2' && packet.projectionRefs === undefined) {
    issues.push('typed_packet_publication_projection_refs_missing');
  }
  return [...new Set(issues)];
}
