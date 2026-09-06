import { createHash } from 'node:crypto';
import type { ProductionSemanticSourceRootCandidate } from './requirements-contract-production-semantic-pipeline';
import { sha256Stable } from './requirements-contract-semantic-resolver';
import { decodeGoalSemanticDictionary } from '../../../utils/goal-contract/control-plane/goal-semantic-dictionary';
import { TYPED_SOURCE_GRAPH_VERSION, type RequirementsTypedSourceGraph, type RequirementsTypedSourceBinding,
  type RequirementsTypedSourceRelation, validateTypedSourceGraph } from './requirements-contract-typed-source-semantics';

export const SOURCE_BUNDLE_VERSION = 'requirements-contract-authority-bundle/v2' as const;
export const SOURCE_NODE_VERSION = 'requirements-contract-source-node/v2' as const;
export interface RequirementsSourceArtifact {
  artifactId: string;
  path: string;
  bytes: number;
  sha256: string;
}
export interface RequirementsSourceBundleResult {
  candidates: ProductionSemanticSourceRootCandidate[];
  graph: RequirementsTypedSourceGraph;
  artifact: RequirementsSourceArtifact;
  relationBindings: Array<{ relationId: string; sourceLine: number }>;
  contextBindings: Record<string, unknown>[];
}
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
function fail(code: string): never { throw new Error(`requirements_source_bundle_${code}`); }
const digest = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');

export function parseRequirementsSourceBundle(input: {
  document: Record<string, unknown>;
  bundlePath: string;
  readArtifact: (relativePath: string) => Buffer;
}): RequirementsSourceBundleResult {
  let document = input.document;
  if (document.payloadDictionary !== undefined) {
    if (Object.keys(document).some((key) => !['schemaVersion', 'sourceArtifact', 'payloadDictionary', 'evidenceClass'].includes(key))) {
      fail('dictionary_envelope_field_unknown');
    }
    const payload = decodeGoalSemanticDictionary(document.payloadDictionary);
    if (!object(payload) || 'schemaVersion' in payload || 'sourceArtifact' in payload) fail('dictionary_payload_invalid');
    document = { ...payload, schemaVersion: document.schemaVersion, sourceArtifact: document.sourceArtifact };
  }
  if (document.schemaVersion !== SOURCE_BUNDLE_VERSION || !Array.isArray(document.sourceRoots) ||
    !Array.isArray(document.sourceRelations) || !object(document.sourceArtifact)) fail('schema_invalid');
  const artifact = document.sourceArtifact as unknown as RequirementsSourceArtifact;
  if (typeof artifact.artifactId !== 'string' || !artifact.artifactId || typeof artifact.path !== 'string' ||
    !Number.isSafeInteger(artifact.bytes) || artifact.bytes <= 0 || !/^[a-f0-9]{64}$/u.test(artifact.sha256)) {
    fail('artifact_schema_invalid');
  }
  const raw = input.readArtifact(artifact.path);
  if (raw.length !== artifact.bytes || digest(raw) !== artifact.sha256) fail('artifact_hash_mismatch');
  const sourceContent = new TextDecoder('utf-8', { fatal: true }).decode(raw);
  const graph: RequirementsTypedSourceGraph = { schemaVersion: TYPED_SOURCE_GRAPH_VERSION,
    sourceNodes: [], sourceRelations: [], sourceBlocks: [], commandDeclarations: [], workDeclarations: [],
    scenarioDeclarations: [], fixDeclarations: [], sections: [] };
  const candidates: ProductionSemanticSourceRootCandidate[] = [];
  for (const value of document.sourceRoots) {
    if (!object(value) || value.rootClass !== 'typed_source_node' || value.bodySchemaVersion !== SOURCE_NODE_VERSION ||
      value.proposedAuthorityClass !== 'source_authority' || typeof value.sourceRootId !== 'string' ||
      !object(value.semanticBody) || value.semanticBody.schemaVersion !== SOURCE_NODE_VERSION || !object(value.sourceBinding)) {
      fail('child_schema_invalid');
    }
    const binding = value.sourceBinding as unknown as RequirementsTypedSourceBinding;
    if (binding.sourceArtifactRef !== artifact.artifactId || !Number.isSafeInteger(binding.byteStart) ||
      !Number.isSafeInteger(binding.byteEnd) || binding.byteStart < 0 || binding.byteEnd <= binding.byteStart || binding.byteEnd > raw.length) {
      fail('child_span_invalid');
    }
    const excerpt = new TextDecoder('utf-8', { fatal: true }).decode(raw.subarray(binding.byteStart, binding.byteEnd));
    if (excerpt !== value.semanticBody.text) fail('child_exact_text_mismatch');
    if (typeof binding.textSha256 === 'string' && binding.textSha256 !== digest(Buffer.from(excerpt))) fail('child_text_hash_mismatch');
    const before = new TextDecoder('utf-8', { fatal: true }).decode(raw.subarray(0, binding.byteStart));
    const startLine = before.split(/\r\n?|\n/gu).length;
    const endLine = startLine + excerpt.split(/\r\n?|\n/gu).length - 1;
    const semanticBody = { ...value.semanticBody, declaredIds: value.semanticBody.declaredIds ?? [] };
    graph.sourceNodes.push({ ...semanticBody, sourceRootId: value.sourceRootId } as RequirementsTypedSourceGraph['sourceNodes'][number]);
    candidates.push({ sourceRootId: value.sourceRootId, rootClass: 'typed_source_node', nodeType: 'requirement',
      bodySchemaVersion: SOURCE_NODE_VERSION, proposedAuthorityClass: 'source_authority', semanticBody,
      sourcePath: artifact.path, sourceContent, sourceSpan: { startLine, endLine }, sourceBinding: { ...binding },
      sourceArtifact: { ...artifact }, bundlePath: input.bundlePath } as ProductionSemanticSourceRootCandidate);
  }
  const relationBindings: RequirementsSourceBundleResult['relationBindings'] = [];
  for (const [index, value] of document.sourceRelations.entries()) {
    if (!object(value)) fail('relation_invalid');
    const { sourceLine, ...semantic } = value;
    const relationId = typeof value.relationId === 'string' ? value.relationId
      : `REL-${sha256Stable({ relation: semantic, occurrence: index }).slice(7, 31)}`;
    graph.sourceRelations.push({ ...semantic, relationId } as RequirementsTypedSourceRelation);
    if (sourceLine !== undefined) {
      if (!Number.isSafeInteger(sourceLine) || Number(sourceLine) <= 0) fail('relation_span_invalid');
      relationBindings.push({ relationId, sourceLine: Number(sourceLine) });
    }
  }
  for (const field of ['sourceBlocks', 'commandDeclarations', 'workDeclarations', 'scenarioDeclarations', 'fixDeclarations', 'sections'] as const) {
    const collection = document[field] ?? [];
    if (!Array.isArray(collection)) fail('context_collection_invalid');
    graph[field] = collection;
  }
  validateTypedSourceGraph(graph);
  const contextBindings = document.sourceContextBindings ?? [];
  if (!Array.isArray(contextBindings) || !contextBindings.every(object)) fail('context_bindings_invalid');
  const contextRefs = new Set<string>();
  const lineCount = sourceContent.split(/\r\n?|\n/gu).length;
  for (const binding of contextBindings) {
    if (typeof binding.fieldRef !== 'string' || contextRefs.has(binding.fieldRef)) fail('context_binding_identity_invalid');
    contextRefs.add(binding.fieldRef);
    const parts = binding.fieldRef.split('/');
    if (parts.shift() !== '' || parts.length < 3) fail('context_binding_path_invalid');
    let parent: unknown = graph;
    for (const part of parts.slice(0, -1)) {
      if (!parent || typeof parent !== 'object' || !Object.prototype.hasOwnProperty.call(parent, part)) fail('context_binding_path_unknown');
      parent = (parent as Record<string, unknown>)[part];
    }
    const key = parts.at(-1)!;
    if (!object(parent) || Object.prototype.hasOwnProperty.call(parent, key)) fail('context_binding_semantic_collision');
    if (!['source', 'sourceLine', 'lineStart', 'lineEnd', 'start', 'end', 'byteStart', 'byteEnd'].includes(key)) fail('context_binding_field_invalid');
    if (key === 'source') {
      if (!object(binding.value) || !Number.isSafeInteger(binding.value.byteStart) || !Number.isSafeInteger(binding.value.byteEnd) ||
        Number(binding.value.byteStart) < 0 || Number(binding.value.byteEnd) > raw.length || Number(binding.value.byteEnd) <= Number(binding.value.byteStart) ||
        raw.subarray(Number(binding.value.byteStart), Number(binding.value.byteEnd)).toString('utf8') !== parent.text) fail('context_binding_exact_text_mismatch');
    } else if (!Number.isSafeInteger(binding.value) || Number(binding.value) < (key.startsWith('byte') ? 0 : 1) ||
      Number(binding.value) > (key.startsWith('byte') ? raw.length : lineCount)) fail('context_binding_location_invalid');
  }
  return { candidates, graph, artifact, relationBindings, contextBindings };
}

export function combineRequirementsSourceContextBindings(bundles: RequirementsSourceBundleResult[]): Record<string, unknown>[] {
  const offsets = new Map<string, number>();
  const result: Record<string, unknown>[] = [];
  for (const bundle of bundles) {
    for (const binding of bundle.contextBindings) {
      const parts = String(binding.fieldRef).split('/');
      parts[2] = String(Number(parts[2]) + (offsets.get(parts[1]) ?? 0));
      result.push({ ...binding, fieldRef: parts.join('/'), sourceArtifactRef: bundle.artifact.artifactId });
    }
    for (const [field, values] of Object.entries(bundle.graph)) {
      if (Array.isArray(values)) offsets.set(field, (offsets.get(field) ?? 0) + values.length);
    }
  }
  return result;
}

export function combineRequirementsSourceBundleGraphs(bundles: RequirementsSourceBundleResult[]): RequirementsTypedSourceGraph {
  const graph: RequirementsTypedSourceGraph = { schemaVersion: TYPED_SOURCE_GRAPH_VERSION,
    sourceNodes: [], sourceRelations: [], sourceBlocks: [], commandDeclarations: [], workDeclarations: [],
    scenarioDeclarations: [], fixDeclarations: [], sections: [] };
  for (const field of ['sourceNodes', 'sourceRelations', 'sourceBlocks', 'commandDeclarations', 'workDeclarations',
    'scenarioDeclarations', 'fixDeclarations', 'sections'] as const) {
    (graph[field] as unknown[]).push(...bundles.flatMap((bundle) => bundle.graph[field] as unknown[]));
  }
  validateTypedSourceGraph(graph);
  return graph;
}
