import fs from 'node:fs';
import path from 'node:path';
import {
  atomicNoClobberPublish,
} from './requirements-contract-atomic-no-clobber-publisher';
import {
  validateRequirementsContractBuildManifest,
  type RequirementsContractBuildManifest,
} from './requirements-contract-authoring-manifest';
import { validateRequirementsContractSemanticIr } from './requirements-contract-semantic-ir';
import { validateRequirementsContractSourceBindingCapsule } from './requirements-contract-source-binding-capsule';

export const REQUIREMENTS_AUTHORITY_PUBLICATION_COMMITTER_OWNER =
  'requirements-contract-authority-publication-committer.ts';

export interface RequirementsActiveAuthorityTuple {
  activeSemanticRevisionId: string;
  activeSemanticIrPath: string;
  activeScopeSemanticHash: string;
  activeBindingRevisionId: string;
  activeSourceBindingPath: string;
  activeSourceBindingHash: string;
  activeAuthoringAttemptId: string;
  activeBuildManifestPath: string;
  activeBuildManifestHash: string;
}

export type RequirementsAuthorityCommitRoute =
  | 'initial'
  | 'semantic_repair'
  | 'projection_repair'
  | 'binding_refresh';

const SHA256 = /^sha256:[a-f0-9]{64}$/u;
const TUPLE_KEYS: Array<keyof RequirementsActiveAuthorityTuple> = [
  'activeSemanticRevisionId', 'activeSemanticIrPath', 'activeScopeSemanticHash',
  'activeBindingRevisionId', 'activeSourceBindingPath', 'activeSourceBindingHash',
  'activeAuthoringAttemptId', 'activeBuildManifestPath', 'activeBuildManifestHash',
];
const SEMANTIC_FIELDS: Array<keyof RequirementsActiveAuthorityTuple> = [
  'activeSemanticRevisionId', 'activeSemanticIrPath', 'activeScopeSemanticHash',
];
const BINDING_FIELDS: Array<keyof RequirementsActiveAuthorityTuple> = [
  'activeBindingRevisionId', 'activeSourceBindingPath', 'activeSourceBindingHash',
];
const BUILD_FIELDS: Array<keyof RequirementsActiveAuthorityTuple> = [
  'activeAuthoringAttemptId', 'activeBuildManifestPath', 'activeBuildManifestHash',
];

export function validateRequirementsActiveAuthorityTuple(value: unknown) {
  const issueCodes: string[] = [];
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { decision: 'block' as const, issueCodes: ['requirements_active_authority_tuple_invalid'] };
  }
  const tuple = value as RequirementsActiveAuthorityTuple & Record<string, unknown>;
  if (
    Object.keys(tuple).length !== TUPLE_KEYS.length ||
    Object.keys(tuple).some((key) => !TUPLE_KEYS.includes(key as keyof RequirementsActiveAuthorityTuple))
  ) issueCodes.push('requirements_active_authority_tuple_field_set_invalid');
  if (!SHA256.test(String(tuple.activeScopeSemanticHash)) ||
      !SHA256.test(String(tuple.activeSourceBindingHash)) ||
      !SHA256.test(String(tuple.activeBuildManifestHash))) {
    issueCodes.push('requirements_active_authority_tuple_hash_invalid');
  }
  if (tuple.activeSemanticIrPath !== `authoring/semantic-revisions/${tuple.activeSemanticRevisionId}/semantic-ir.json`) {
    issueCodes.push('requirements_active_semantic_path_identity_mismatch');
  }
  if (tuple.activeSourceBindingPath !== `authoring/source-bindings/${tuple.activeBindingRevisionId}/source-binding.json`) {
    issueCodes.push('requirements_active_binding_path_identity_mismatch');
  }
  if (tuple.activeBuildManifestPath !== `authoring/staging/${tuple.activeAuthoringAttemptId}/contract-build-manifest.json`) {
    issueCodes.push('requirements_active_build_path_identity_mismatch');
  }
  return { decision: issueCodes.length ? 'block' as const : 'pass' as const, issueCodes: [...new Set(issueCodes)].sort() };
}

function assertSameFields(
  current: RequirementsActiveAuthorityTuple,
  next: RequirementsActiveAuthorityTuple,
  fields: Array<keyof RequirementsActiveAuthorityTuple>,
  code: string
): void {
  if (fields.some((field) => current[field] !== next[field])) throw new Error(code);
}

function assertChangedFields(
  current: RequirementsActiveAuthorityTuple,
  next: RequirementsActiveAuthorityTuple,
  fields: Array<keyof RequirementsActiveAuthorityTuple>,
  code: string
): void {
  if (fields.some((field) => current[field] === next[field])) throw new Error(code);
}

export function assertRequirementsAuthorityRouteTransition(input: {
  route: RequirementsAuthorityCommitRoute;
  current: RequirementsActiveAuthorityTuple | null;
  next: RequirementsActiveAuthorityTuple;
}): void {
  const validation = validateRequirementsActiveAuthorityTuple(input.next);
  if (validation.decision === 'block') throw new Error(validation.issueCodes[0]);
  if (input.route === 'initial') {
    if (input.current !== null) throw new Error('requirements_authority_initial_requires_empty_current');
    return;
  }
  if (!input.current) throw new Error('requirements_authority_current_required');
  const currentValidation = validateRequirementsActiveAuthorityTuple(input.current);
  if (currentValidation.decision === 'block') throw new Error(currentValidation.issueCodes[0]);
  if (input.route === 'semantic_repair') {
    assertChangedFields(input.current, input.next, TUPLE_KEYS, 'requirements_semantic_repair_requires_full_replacement');
  }
  if (input.route === 'projection_repair') {
    assertSameFields(input.current, input.next, [...SEMANTIC_FIELDS, ...BINDING_FIELDS], 'requirements_projection_repair_authority_mutation_forbidden');
    assertChangedFields(input.current, input.next, BUILD_FIELDS, 'requirements_projection_repair_requires_build_replacement');
  }
  if (input.route === 'binding_refresh') {
    assertSameFields(input.current, input.next, [...SEMANTIC_FIELDS, ...BUILD_FIELDS], 'requirements_binding_refresh_authority_mutation_forbidden');
    assertChangedFields(input.current, input.next, BINDING_FIELDS, 'requirements_binding_refresh_requires_binding_replacement');
  }
}

function resolveConfinedRecordPath(recordRootPath: string, recordRelativePath: string): string {
  const root = path.resolve(recordRootPath);
  const target = path.resolve(root, ...recordRelativePath.split('/'));
  if (target === root || !target.startsWith(`${root}${path.sep}`)) {
    throw new Error('requirements_authority_record_path_escape');
  }
  return target;
}

function readJsonArtifact(absolutePath: string, code: string): unknown {
  try {
    return JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
  } catch {
    throw new Error(code);
  }
}

export function commitRequirementsContractAuthorityPublication(input: {
  route: RequirementsAuthorityCommitRoute;
  current: RequirementsActiveAuthorityTuple | null;
  next: RequirementsActiveAuthorityTuple;
  recordRootPath: string;
  buildManifestTargetPath: string;
  buildManifest: RequirementsContractBuildManifest;
  compareAndSwapAuthorityTuple: (
    current: RequirementsActiveAuthorityTuple | null,
    next: RequirementsActiveAuthorityTuple
  ) => boolean;
}) {
  assertRequirementsAuthorityRouteTransition(input);
  const manifestValidation = validateRequirementsContractBuildManifest(input.buildManifest);
  if (manifestValidation.decision === 'block') throw new Error(manifestValidation.issueCodes[0]);
  const expectedBuildManifestTargetPath = resolveConfinedRecordPath(
    input.recordRootPath,
    input.next.activeBuildManifestPath
  );
  if (path.resolve(input.buildManifestTargetPath) !== expectedBuildManifestTargetPath) {
    throw new Error('requirements_authority_build_manifest_target_mismatch');
  }
  const manifestBindingAuthority = input.route === 'binding_refresh'
    ? input.current
    : input.next;
  if (
    input.buildManifest.authoringAttemptId !== input.next.activeAuthoringAttemptId ||
    input.buildManifest.buildManifestHash !== input.next.activeBuildManifestHash ||
    input.buildManifest.semanticAuthorityRef.semanticRevisionId !== input.next.activeSemanticRevisionId ||
    input.buildManifest.semanticAuthorityRef.path !== input.next.activeSemanticIrPath ||
    input.buildManifest.semanticAuthorityRef.hash !== input.next.activeScopeSemanticHash ||
    !manifestBindingAuthority ||
    input.buildManifest.bindingAuthorityRef.bindingRevisionId !== manifestBindingAuthority.activeBindingRevisionId ||
    input.buildManifest.bindingAuthorityRef.path !== manifestBindingAuthority.activeSourceBindingPath ||
    input.buildManifest.bindingAuthorityRef.hash !== manifestBindingAuthority.activeSourceBindingHash
  ) throw new Error('requirements_authority_build_manifest_identity_mismatch');
  const semantic = readJsonArtifact(
    resolveConfinedRecordPath(input.recordRootPath, input.next.activeSemanticIrPath),
    'requirements_authority_semantic_readback_invalid'
  );
  const semanticValidation = validateRequirementsContractSemanticIr(semantic);
  if (semanticValidation.decision === 'block') throw new Error(semanticValidation.issueCodes[0]);
  const semanticRecord = semantic as Record<string, unknown>;
  if (
    semanticRecord.semanticRevisionId !== input.next.activeSemanticRevisionId ||
    semanticRecord.scopeSemanticHash !== input.next.activeScopeSemanticHash
  ) throw new Error('requirements_authority_semantic_readback_mismatch');
  const binding = readJsonArtifact(
    resolveConfinedRecordPath(input.recordRootPath, input.next.activeSourceBindingPath),
    'requirements_authority_binding_readback_invalid'
  );
  const bindingValidation = validateRequirementsContractSourceBindingCapsule(binding);
  if (bindingValidation.decision === 'block') throw new Error(bindingValidation.issueCodes[0]);
  const bindingRecord = binding as Record<string, unknown>;
  if (
    bindingRecord.bindingRevisionId !== input.next.activeBindingRevisionId ||
    bindingRecord.sourceBindingHash !== input.next.activeSourceBindingHash ||
    bindingRecord.semanticRevisionId !== input.next.activeSemanticRevisionId ||
    bindingRecord.scopeSemanticHash !== input.next.activeScopeSemanticHash
  ) throw new Error('requirements_authority_binding_readback_mismatch');
  const publication = atomicNoClobberPublish({
    targetPath: expectedBuildManifestTargetPath,
    value: input.buildManifest,
    role: 'contract_build_manifest',
    mediaType: 'application/json',
    validateReadback(value) {
      const validation = validateRequirementsContractBuildManifest(value);
      if (validation.decision === 'block') throw new Error(validation.issueCodes[0]);
    },
  });
  if (!input.compareAndSwapAuthorityTuple(input.current, input.next)) {
    throw new Error('requirements_active_authority_tuple_cas_conflict');
  }
  return { publication, activeAuthority: input.next };
}
