import type {
  RequirementContractCompilerInput,
  RequirementContractModelV2,
} from './requirements-contract-model';
import type { ProductionSemanticSourceRoot } from './requirements-contract-production-semantic-pipeline';
import type { RequirementsContractSemanticConservationManifest } from './requirements-contract-semantic-conservation-manifest';
import { sha256Stable, sha256Text } from './requirements-contract-semantic-resolver';
import type { RequirementsContractSemanticIr } from './requirements-contract-semantic-ir';
import type { RequirementsContractSourceBindingCapsule } from './requirements-contract-source-binding-capsule';
import {
  requirementsContractDomainHash,
} from './requirements-contract-hash-domains';

export interface CanonicalCompilerInputAuthority {
  source: 'canonical_semantic_ir';
  semanticModelHash: string;
  semanticConservationManifestHash: string;
  sourceAuthorityHash: string;
  sourceRootSetHash: string;
  compilerInputHash: string;
}

export interface CanonicalPreCheckpointCompilerInput {
  compilerInput: RequirementContractCompilerInput;
  authority: CanonicalCompilerInputAuthority;
}

export interface CanonicalFrozenRequirementsCompilerInput {
  semantic: {
    source: 'requirements-contract-semantic-ir/v1';
    semanticRevisionId: string;
    scopeSemanticHash: string;
    payload: RequirementsContractSemanticIr['semanticPayload'];
  };
  binding: {
    source: 'requirements-contract-source-binding/v1';
    bindingRevisionId: string;
    sourceBindingHash: string;
    semanticRevisionId: string;
  };
  compilerInputHash: string;
}

export function buildCanonicalFrozenRequirementsCompilerInput(input: {
  semanticIr: RequirementsContractSemanticIr;
  sourceBinding: RequirementsContractSourceBindingCapsule;
}): CanonicalFrozenRequirementsCompilerInput {
  if (
    input.sourceBinding.semanticRevisionId !== input.semanticIr.semanticRevisionId ||
    input.sourceBinding.scopeSemanticHash !== input.semanticIr.scopeSemanticHash
  ) {
    throw new Error('canonical_frozen_compiler_input_binding_incompatible');
  }
  const payload = {
    semantic: {
      source: 'requirements-contract-semantic-ir/v1' as const,
      semanticRevisionId: input.semanticIr.semanticRevisionId,
      scopeSemanticHash: input.semanticIr.scopeSemanticHash,
      payload: input.semanticIr.semanticPayload,
    },
    binding: {
      source: 'requirements-contract-source-binding/v1' as const,
      bindingRevisionId: input.sourceBinding.bindingRevisionId,
      sourceBindingHash: input.sourceBinding.sourceBindingHash,
      semanticRevisionId: input.sourceBinding.semanticRevisionId,
    },
  };
  return {
    ...payload,
    compilerInputHash: requirementsContractDomainHash(
      'requirements-contract-canonical-frozen-compiler-input/v1', payload
    ),
  };
}

export interface CanonicalMustRequirementProjection {
  id: string;
  text: string;
  textZh?: string;
  source: 'canonical_semantic_ir';
  sourceLine: number | null;
  sourcePath?: string;
  sourceDocumentHash?: string;
  sourceSpan?: { startLine: number; endLine: number };
  headingPath?: string[];
  sourceRequirementId?: string;
}

function nonEmptyString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Canonical compiler input requires ${field}`);
  }
  return value.trim();
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function canonicalBody(
  semanticIr: RequirementContractModelV2,
  root: ProductionSemanticSourceRoot
): Record<string, unknown> {
  const node = semanticIr.nodes[root.sourceRootId];
  if (!node) {
    throw new Error(`Canonical compiler input missing Semantic IR node ${root.sourceRootId}`);
  }
  const rootPayloadHash = sha256Stable(root.semanticBody);
  if (node.bodyHash !== rootPayloadHash) {
    throw new Error(`Canonical compiler input payload mismatch for ${root.sourceRootId}`);
  }
  const body = semanticIr.semanticBodies[node.bodyHash];
  if (!body || sha256Stable(body) !== node.bodyHash) {
    throw new Error(`Canonical compiler input missing semantic body for ${root.sourceRootId}`);
  }
  if (nonEmptyString(body.id, `${root.sourceRootId}.id`) !== root.sourceRootId) {
    throw new Error(`Canonical compiler input identity mismatch for ${root.sourceRootId}`);
  }
  return body;
}

function sourceProvenance(root: ProductionSemanticSourceRoot, sourceRequirementId: string) {
  const sourceHash = sha256Text(root.sourceContent);
  return {
    sourceRequirementId,
    sourcePath: root.sourcePath,
    sourceSpan: root.sourceSpan,
    sourceDocumentHash: sourceHash,
    sourceHash,
    authorityClass: root.authorityClass,
    compiler: 'requirements-contract-canonical-compiler-input',
  };
}

type CanonicalCompilerRole =
  | 'must'
  | 'negative_requirement'
  | 'out_of_scope_boundary'
  | 'validation_obligation'
  | 'target_ownership'
  | 'other';

function canonicalCompilerRole(
  semanticIr: RequirementContractModelV2,
  sourceRootId: string
): CanonicalCompilerRole {
  const node = semanticIr.nodes[sourceRootId];
  if (!node) throw new Error(`Canonical compiler input missing Semantic IR node ${sourceRootId}`);
  if (node.bodySchemaVersion === 'requirement-contract-requirement/v2') {
    if (node.nodeType !== 'requirement') {
      throw new Error(
        `Canonical compiler input node type mismatch for ${sourceRootId}:${node.bodySchemaVersion}`
      );
    }
    const body = semanticIr.semanticBodies[node.bodyHash];
    const kind = optionalString(body?.kind);
    if (kind === 'functional' || kind === 'nonfunctional') return 'must';
    if (kind === 'negative') return 'negative_requirement';
    if (kind === 'out_of_scope') return 'out_of_scope_boundary';
    throw new Error(`Canonical compiler input requirement kind is invalid for ${sourceRootId}`);
  }
  const expectedNodeTypeByBodySchema = new Map<
    string,
    {
      role: Exclude<CanonicalCompilerRole, 'other'>;
      nodeType: RequirementContractModelV2['nodes'][string]['nodeType'];
    }
  >([
    ['requirements-contract-must-root/v1', { role: 'must', nodeType: 'requirement' }],
    [
      'requirements-contract-negative-root/v1',
      { role: 'negative_requirement', nodeType: 'requirement' },
    ],
    [
      'requirements-contract-boundary-root/v1',
      { role: 'out_of_scope_boundary', nodeType: 'requirement' },
    ],
    [
      'requirements-contract-validation-root/v1',
      { role: 'validation_obligation', nodeType: 'oracle' },
    ],
    ['requirements-contract-target-root/v1', { role: 'target_ownership', nodeType: 'target' }],
  ]);
  const expected = expectedNodeTypeByBodySchema.get(node.bodySchemaVersion);
  if (!expected) return 'other';
  if (node.nodeType !== expected.nodeType) {
    throw new Error(
      `Canonical compiler input node type mismatch for ${sourceRootId}:${node.bodySchemaVersion}`
    );
  }
  return expected.role;
}

function requirementRefs(
  semanticIr: RequirementContractModelV2,
  sourceRootId: string,
  edgeType: 'implemented_in' | 'verified_by',
  knownMustRefs: ReadonlySet<string>
): string[] {
  return [
    ...new Set(
      Object.values(semanticIr.edges)
        .filter(
          (edge) =>
            edge.edgeType === edgeType &&
            edge.toRef === sourceRootId &&
            knownMustRefs.has(edge.fromRef)
        )
        .map((edge) => edge.fromRef)
    ),
  ].sort();
}

export function buildCanonicalPreCheckpointCompilerInput(input: {
  semanticIr: RequirementContractModelV2;
  semanticConservationManifest: RequirementsContractSemanticConservationManifest;
  sourceRoots: ProductionSemanticSourceRoot[];
}): CanonicalPreCheckpointCompilerInput {
  if (
    input.semanticConservationManifest.semanticModelHash !== input.semanticIr.semanticModelHash ||
    input.semanticConservationManifest.hashChain.semanticModelHash !==
      input.semanticIr.semanticModelHash
  ) {
    throw new Error('Canonical compiler input Semantic IR hash is not conserved');
  }
  if (
    input.semanticConservationManifest.hashChain.sourceAuthorityHash !==
    input.semanticIr.sourceAuthorityHash
  ) {
    throw new Error('Canonical compiler input source authority hash is not conserved');
  }
  if (input.semanticConservationManifest.sourceRoots.length !== input.sourceRoots.length) {
    throw new Error('Canonical compiler input Source Root inventory is incomplete');
  }

  const rootsById = new Map<string, ProductionSemanticSourceRoot>();
  for (const root of input.sourceRoots) {
    if (rootsById.has(root.sourceRootId)) {
      throw new Error(`Canonical compiler input duplicate Source Root ${root.sourceRootId}`);
    }
    rootsById.set(root.sourceRootId, root);
  }
  for (const manifestRoot of input.semanticConservationManifest.sourceRoots) {
    const root = rootsById.get(manifestRoot.sourceRootId);
    if (
      !root ||
      manifestRoot.payloadHash !== sha256Stable(root.semanticBody) ||
      manifestRoot.authorityClass !== root.authorityClass
    ) {
      throw new Error(
        `Canonical compiler input Source Root manifest mismatch for ${manifestRoot.sourceRootId}`
      );
    }
  }

  const canonicalRoots = input.semanticConservationManifest.sourceRoots.map((manifestRoot) => {
    const root = rootsById.get(manifestRoot.sourceRootId);
    if (!root) {
      throw new Error(`Canonical compiler input missing Source Root ${manifestRoot.sourceRootId}`);
    }
    return {
      root,
      role: canonicalCompilerRole(input.semanticIr, manifestRoot.sourceRootId),
    };
  });

  const must = canonicalRoots
    .filter(({ role }) => role === 'must')
    .map((root) => {
      const body = canonicalBody(input.semanticIr, root.root);
      const source =
        body.source && typeof body.source === 'object' && !Array.isArray(body.source)
          ? (body.source as Record<string, unknown>)
          : {};
      const sourceRequirementId =
        optionalString(source.sourceRequirementId) ??
        optionalString(body.sourceRequirementId) ??
        root.root.sourceRootId;
      return {
        id: root.root.sourceRootId,
        text: nonEmptyString(body.text, `${root.root.sourceRootId}.text`),
        ...(optionalString(body.textZh) ? { textZh: optionalString(body.textZh) } : {}),
        sourceRequirementId,
        sourcePath: root.root.sourcePath,
        sourceSpan: root.root.sourceSpan,
        sourceDocumentHash: sha256Text(root.root.sourceContent),
        headingPath: Array.isArray(source.headingPath) ? source.headingPath.map(String) : [],
      };
    });
  const knownMustRefs = new Set(must.map((requirement) => requirement.id));

  const notDone = canonicalRoots
    .filter(({ role }) => role === 'negative_requirement')
    .map((root) => {
      const body = canonicalBody(input.semanticIr, root.root);
      const provenance = sourceProvenance(root.root, root.root.sourceRootId);
      return {
        id: root.root.sourceRootId,
        text: nonEmptyString(body.text, `${root.root.sourceRootId}.text`),
        sourceRequirementId: root.root.sourceRootId,
        sourcePath: root.root.sourcePath,
        sourceSpan: root.root.sourceSpan,
        authorityState: 'source_grounded',
        provenance,
      };
    });

  const outOfScope = canonicalRoots
    .filter(({ role }) => role === 'out_of_scope_boundary')
    .map((root) => {
      const body = canonicalBody(input.semanticIr, root.root);
      return {
        id: root.root.sourceRootId,
        text: nonEmptyString(body.text, `${root.root.sourceRootId}.text`),
        authorityState: 'source_grounded',
        provenance: sourceProvenance(root.root, root.root.sourceRootId),
      };
    });

  const requiredCommands = canonicalRoots
    .filter(({ role }) => role === 'validation_obligation')
    .flatMap((root) => {
      const body = canonicalBody(input.semanticIr, root.root);
      const refs = requirementRefs(
        input.semanticIr,
        root.root.sourceRootId,
        'verified_by',
        knownMustRefs
      );
      return refs.length === 0
        ? []
        : [
            {
              id: root.root.sourceRootId,
              command: nonEmptyString(body.command, `${root.root.sourceRootId}.command`),
              requirementRefs: refs,
            },
          ];
    });

  const targetPaths = canonicalRoots
    .filter(({ role }) => role === 'target_ownership')
    .flatMap((root) => {
      const body = canonicalBody(input.semanticIr, root.root);
      const refs = requirementRefs(
        input.semanticIr,
        root.root.sourceRootId,
        'implemented_in',
        knownMustRefs
      );
      return refs.length === 0
        ? []
        : [
            {
              id: root.root.sourceRootId,
              path: nonEmptyString(body.path, `${root.root.sourceRootId}.path`),
              requirementRefs: refs,
            },
          ];
    });

  const compilerInput: RequirementContractCompilerInput = {
    recordId: input.semanticIr.recordId,
    requirementSetId: input.semanticIr.requirementSetId,
    must,
    notDone,
    outOfScope,
    requiredCommands,
    targetPaths,
  };
  const sourceRootSetHash = sha256Stable({
    sourceRoots: input.semanticConservationManifest.sourceRoots,
    semanticNodes: input.semanticConservationManifest.semanticNodes,
    rootToNodeMappings: input.semanticConservationManifest.rootToNodeMappings,
    nodeToAuthorityMappings: input.semanticConservationManifest.nodeToAuthorityMappings,
    nodes: Object.entries(input.semanticIr.nodes)
      .map(([nodeId, node]) => ({ nodeId, ...node }))
      .sort((left, right) => left.nodeId.localeCompare(right.nodeId)),
    edges: Object.entries(input.semanticIr.edges)
      .map(([edgeId, edge]) => ({ edgeId, ...edge }))
      .sort((left, right) => left.edgeId.localeCompare(right.edgeId)),
  });
  return {
    compilerInput,
    authority: {
      source: 'canonical_semantic_ir',
      semanticModelHash: input.semanticIr.semanticModelHash,
      semanticConservationManifestHash: input.semanticConservationManifest.manifestHash,
      sourceAuthorityHash: input.semanticConservationManifest.hashChain.sourceAuthorityHash,
      sourceRootSetHash,
      compilerInputHash: sha256Stable(compilerInput),
    },
  };
}

export function buildCanonicalMustRequirementProjection(
  input: CanonicalPreCheckpointCompilerInput
): CanonicalMustRequirementProjection[] {
  return input.compilerInput.must.map((requirement) => ({
    id: requirement.id,
    text: requirement.text,
    ...(requirement.textZh ? { textZh: requirement.textZh } : {}),
    source: 'canonical_semantic_ir',
    sourceLine: requirement.sourceSpan?.startLine ?? null,
    ...(requirement.sourcePath ? { sourcePath: requirement.sourcePath } : {}),
    ...(requirement.sourceDocumentHash
      ? { sourceDocumentHash: requirement.sourceDocumentHash }
      : {}),
    ...(requirement.sourceSpan ? { sourceSpan: requirement.sourceSpan } : {}),
    ...(requirement.headingPath ? { headingPath: requirement.headingPath } : {}),
    ...(requirement.sourceRequirementId
      ? { sourceRequirementId: requirement.sourceRequirementId }
      : {}),
  }));
}
