import {
  validateRequirementsContractBuildManifestV2,
  type RequirementsContractBuildManifestV2,
} from './requirements-contract-authoring-manifest';

export const REQUIREMENTS_AUTHORITY_PUBLICATION_COMMITTER_OWNER =
  'requirements-contract-authority-publication-committer.ts';

export interface RequirementsActiveAuthorityTupleV3 {
  activeSemanticRevisionId: string;
  activeScopeSemanticHash: string;
  activeBindingRevisionId: string;
  activeSourceBindingHash: string;
  activeBuildHash: string;
  activeBuildManifestPath: string;
  previousBuildHash: string | null;
  previousBuildManifestPath: string | null;
}

export type RequirementsAuthorityCommitRoute =
  | 'initial'
  | 'semantic_repair'
  | 'projection_repair'
  | 'binding_refresh';

const SHA256 = /^sha256:[a-f0-9]{64}$/u;
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]*$/u;
const TUPLE_KEYS = [
  'activeSemanticRevisionId',
  'activeScopeSemanticHash',
  'activeBindingRevisionId',
  'activeSourceBindingHash',
  'activeBuildHash',
  'activeBuildManifestPath',
  'previousBuildHash',
  'previousBuildManifestPath',
] as const satisfies readonly (keyof RequirementsActiveAuthorityTupleV3)[];

export function validateRequirementsActiveAuthorityTuple(value: unknown) {
  const issueCodes: string[] = [];
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {
      decision: 'block' as const,
      issueCodes: ['requirements_active_authority_tuple_invalid'],
    };
  }
  const tuple = value as RequirementsActiveAuthorityTupleV3 & Record<string, unknown>;
  if (
    Object.keys(tuple).length !== TUPLE_KEYS.length ||
    Object.keys(tuple).some(
      (key) => !TUPLE_KEYS.includes(key as keyof RequirementsActiveAuthorityTupleV3)
    )
  ) {
    issueCodes.push('requirements_active_authority_tuple_field_set_invalid');
  }
  if (
    !SAFE_ID.test(String(tuple.activeSemanticRevisionId)) ||
    !SAFE_ID.test(String(tuple.activeBindingRevisionId)) ||
    !SHA256.test(String(tuple.activeScopeSemanticHash)) ||
    !SHA256.test(String(tuple.activeSourceBindingHash)) ||
    !SHA256.test(String(tuple.activeBuildHash)) ||
    (tuple.previousBuildHash !== null && !SHA256.test(String(tuple.previousBuildHash)))
  ) {
    issueCodes.push('requirements_active_authority_tuple_hash_invalid');
  }
  const activeHex = String(tuple.activeBuildHash).slice('sha256:'.length);
  if (tuple.activeBuildManifestPath !== 'authoring/builds/' + activeHex + '/manifest.json') {
    issueCodes.push('requirements_active_build_path_identity_mismatch');
  }
  if (
    (tuple.previousBuildHash === null) !== (tuple.previousBuildManifestPath === null) ||
    (tuple.previousBuildHash !== null &&
      tuple.previousBuildManifestPath !==
        'authoring/builds/' +
          String(tuple.previousBuildHash).slice('sha256:'.length) +
          '/manifest.json')
  ) {
    issueCodes.push('requirements_previous_build_path_identity_mismatch');
  }
  return {
    decision: issueCodes.length ? ('block' as const) : ('pass' as const),
    issueCodes: [...new Set(issueCodes)].sort(),
  };
}

function changed(
  current: RequirementsActiveAuthorityTupleV3,
  next: RequirementsActiveAuthorityTupleV3,
  fields: Array<keyof RequirementsActiveAuthorityTupleV3>
): boolean {
  return fields.some((field) => current[field] !== next[field]);
}

export function assertRequirementsAuthorityRouteTransition(input: {
  route: RequirementsAuthorityCommitRoute;
  current: RequirementsActiveAuthorityTupleV3 | null;
  next: RequirementsActiveAuthorityTupleV3;
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
  if (
    input.next.previousBuildHash !== input.current.activeBuildHash ||
    input.next.previousBuildManifestPath !== input.current.activeBuildManifestPath
  ) {
    throw new Error('requirements_authority_predecessor_mismatch');
  }
  const semanticChanged = changed(input.current, input.next, [
    'activeSemanticRevisionId',
    'activeScopeSemanticHash',
  ]);
  const bindingChanged = changed(input.current, input.next, [
    'activeBindingRevisionId',
    'activeSourceBindingHash',
  ]);
  const buildChanged = changed(input.current, input.next, [
    'activeBuildHash',
    'activeBuildManifestPath',
  ]);
  if (input.route === 'semantic_repair' && (!semanticChanged || !buildChanged)) {
    throw new Error('requirements_semantic_repair_requires_semantic_successor');
  }
  if (input.route === 'projection_repair' && (semanticChanged || bindingChanged || !buildChanged)) {
    throw new Error('requirements_projection_repair_authority_mutation_invalid');
  }
  if (input.route === 'binding_refresh' && (semanticChanged || !bindingChanged || !buildChanged)) {
    throw new Error('requirements_binding_refresh_authority_mutation_invalid');
  }
}

export function commitRequirementsContractAuthorityPublication(input: {
  route: RequirementsAuthorityCommitRoute;
  current: RequirementsActiveAuthorityTupleV3 | null;
  next: RequirementsActiveAuthorityTupleV3;
  buildManifest: RequirementsContractBuildManifestV2;
  compareAndSwapAuthorityTuple: (
    current: RequirementsActiveAuthorityTupleV3 | null,
    next: RequirementsActiveAuthorityTupleV3
  ) => boolean;
}) {
  assertRequirementsAuthorityRouteTransition(input);
  if (!validateRequirementsContractBuildManifestV2(input.buildManifest)) {
    throw new Error('requirements_authority_build_manifest_invalid');
  }
  if (
    input.next.activeBuildHash !== input.buildManifest.buildHash ||
    input.next.activeBuildManifestPath !==
      'authoring/builds/' +
        input.buildManifest.buildHash.slice('sha256:'.length) +
        '/manifest.json' ||
    input.next.activeScopeSemanticHash !== input.buildManifest.scopeSemanticHash ||
    input.next.activeSourceBindingHash !== input.buildManifest.sourceBindingHash
  ) {
    throw new Error('requirements_authority_build_manifest_identity_mismatch');
  }
  if (!input.compareAndSwapAuthorityTuple(input.current, input.next)) {
    throw new Error('requirements_authority_cas_mismatch');
  }
  return { activeAuthority: input.next };
}
