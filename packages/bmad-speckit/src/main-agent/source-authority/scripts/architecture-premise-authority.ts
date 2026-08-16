import * as fs from 'node:fs';
import * as path from 'node:path';
import { TextDecoder } from 'node:util';
import Ajv2020 from 'ajv/dist/2020.js';
import { canonicalRequirementsJson } from './requirements-contract-hash-domains';
import { sha256Stable } from './requirements-contract-semantic-resolver';
import type { RequirementsExecutionConstraint } from './requirements-contract-semantic-ir';
import type { RequirementsSourceArtifactBinding } from './requirements-contract-source-binding-capsule';

type ImpactStatus = 'applicable' | 'not_applicable';
export interface ArchitectureImpactRule {
  impactId: string;
  whenConstraintKinds?: string[];
  whenConstraintIds?: string[];
}
export interface ArchitectureTriggerRule {
  triggerId: string;
  whenConstraintKinds?: string[];
  whenConstraintIds?: string[];
}
export interface ResolvedArchitectureImpactRule {
  impactId: string;
  status: ImpactStatus;
  predicateSignature: string;
  matchedConstraintIds: string[];
}
export interface ResolvedArchitectureTriggerRule {
  triggerId: string;
  triggered: boolean;
  predicateSignature: string;
  matchedConstraintIds: string[];
}
export interface RepositoryArchitectureAuthority {
  schemaVersion: 'ArchitecturePremiseAuthority/v1';
  authorityKind: 'repository';
  authorityRole: 'repository_authority';
  authorityId: string;
  allowedTargetPaths: string[];
  consumerImpactRules: ArchitectureImpactRule[];
  triggerRules: ArchitectureTriggerRule[];
}
export interface PolicyArchitectureAuthority {
  schemaVersion: 'ArchitecturePremiseAuthority/v1';
  authorityKind: 'policy';
  authorityRole: 'policy_authority';
  authorityId: string;
  forbiddenScope: { paths: string[] };
  ownershipRules: Array<{ targetPath: string; owner: string }>;
  isolationSelection: string;
  governanceImpactRules: ArchitectureImpactRule[];
  triggerRules: ArchitectureTriggerRule[];
}
type Authority = RepositoryArchitectureAuthority | PolicyArchitectureAuthority;
type AuthorityKind = Authority['authorityKind'];
type AuthorityRole = Authority['authorityRole'];
type AuthorityArtifact = { artifact: RequirementsSourceArtifactBinding; authority: Authority };
export interface ResolvedArchitecturePremiseAuthorities {
  repository: Omit<RepositoryArchitectureAuthority, 'consumerImpactRules' | 'triggerRules'> & {
    consumerImpactRules: ResolvedArchitectureImpactRule[];
    triggerRules: ResolvedArchitectureTriggerRule[];
  };
  policy: Omit<PolicyArchitectureAuthority, 'governanceImpactRules' | 'triggerRules'> & {
    governanceImpactRules: ResolvedArchitectureImpactRule[];
    triggerRules: ResolvedArchitectureTriggerRule[];
  };
  repositoryArtifacts: RequirementsSourceArtifactBinding[];
  policyArtifacts: RequirementsSourceArtifactBinding[];
}

const SCHEMA_FILE = 'main-agent-architecture-premise-authority.schema.json';
const FIELD_ISSUES = {
  repository: {
    allowedTargetPaths: 'target_authority',
    consumerImpactRules: 'consumer_impact',
    triggerRules: 'trigger_rules',
  },
  policy: {
    forbiddenScope: 'forbidden_scope',
    ownershipRules: 'ownership',
    isolationSelection: 'isolation',
    governanceImpactRules: 'governance_impact',
    triggerRules: 'trigger_rules',
  },
} as const;
let validateAuthority: ((value: unknown) => boolean) | undefined;

export class ArchitecturePremiseAuthorityBlock extends Error {
  constructor(readonly issueCode: string) {
    super(issueCode);
  }
}

export function isCanonicalArchitecturePath(value: string): boolean {
  if (
    !value ||
    value.trim() !== value ||
    value.includes('\\') ||
    value.includes('\0') ||
    path.posix.isAbsolute(value) ||
    path.win32.isAbsolute(value) ||
    /^[A-Za-z]:/u.test(value)
  ) {
    return false;
  }
  return value.split('/').every((segment) => segment && segment !== '.' && segment !== '..');
}

function containsArchitectureGlobSyntax(value: string): boolean {
  return ['*', '?', '[', ']', '{', '}'].some((token) => value.includes(token));
}

export function isConcreteArchitectureTargetPath(value: string): boolean {
  return isCanonicalArchitecturePath(value) && !containsArchitectureGlobSyntax(value);
}

export function isCanonicalArchitectureForbiddenPath(value: string): boolean {
  if (!isCanonicalArchitecturePath(value)) return false;
  if (!containsArchitectureGlobSyntax(value)) return true;
  if (!value.endsWith('/**')) return false;
  return isConcreteArchitectureTargetPath(value.slice(0, -3));
}

function validator() {
  if (!validateAuthority) {
    const schemaPath = path.resolve(__dirname, '..', 'schemas', SCHEMA_FILE);
    const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8')) as object;
    validateAuthority = new Ajv2020({ allErrors: true, strict: false }).compile(schema);
  }
  return validateAuthority;
}

function confinedAuthorityFile(projectRoot: string, immutableBlobRef: string): string {
  const normalized = immutableBlobRef.replace(/\\/gu, '/');
  const segments = normalized.split('/');
  if (
    !normalized ||
    path.posix.isAbsolute(normalized) ||
    path.win32.isAbsolute(immutableBlobRef) ||
    segments.some((segment) => !segment || segment === '.' || segment === '..')
  ) {
    throw new Error('architecture_confirmation_authority_blob_path_invalid');
  }
  const root = path.resolve(projectRoot);
  let current = root;
  for (const [index, segment] of segments.entries()) {
    current = path.join(current, segment);
    const entry = fs.lstatSync(current);
    if (entry.isSymbolicLink())
      throw new Error('architecture_confirmation_authority_symlink_invalid');
    if (index === segments.length - 1 ? !entry.isFile() : !entry.isDirectory()) {
      throw new Error('architecture_confirmation_authority_file_type_invalid');
    }
  }
  const realRoot = fs.realpathSync(root);
  const realFile = fs.realpathSync(current);
  if (!realFile.startsWith(`${realRoot}${path.sep}`)) {
    throw new Error('architecture_confirmation_authority_blob_path_invalid');
  }
  return realFile;
}

function missingFieldIssue(value: Record<string, unknown>, kind: AuthorityKind): string | null {
  for (const [field, issue] of Object.entries(FIELD_ISSUES[kind])) {
    if (!Object.prototype.hasOwnProperty.call(value, field))
      return `architecture_successor_required:${issue}`;
  }
  for (const [field, issue] of Object.entries(FIELD_ISSUES[kind])) {
    if (Array.isArray(value[field]) && value[field].length === 0) {
      return `architecture_successor_required:${issue}`;
    }
  }
  if (
    kind === 'policy' &&
    value.forbiddenScope &&
    typeof value.forbiddenScope === 'object' &&
    !Array.isArray(value.forbiddenScope) &&
    Array.isArray((value.forbiddenScope as Record<string, unknown>).paths) &&
    ((value.forbiddenScope as Record<string, unknown>).paths as unknown[]).length === 0
  ) {
    return 'architecture_successor_required:forbidden_scope';
  }
  return null;
}

function invalidFieldIssue(value: Record<string, unknown>, kind: AuthorityKind): string | null {
  if (kind === 'repository') {
    const allowedTargetPaths = value.allowedTargetPaths;
    if (
      Array.isArray(allowedTargetPaths) &&
      allowedTargetPaths.some(
        (item) => typeof item === 'string' && !isConcreteArchitectureTargetPath(item)
      )
    ) {
      return 'architecture_successor_required:target_authority';
    }
    return null;
  }

  const forbiddenScope = value.forbiddenScope;
  if (forbiddenScope && typeof forbiddenScope === 'object' && !Array.isArray(forbiddenScope)) {
    const paths = (forbiddenScope as Record<string, unknown>).paths;
    if (
      Array.isArray(paths) &&
      paths.some((item) => typeof item === 'string' && !isCanonicalArchitectureForbiddenPath(item))
    ) {
      return 'architecture_successor_required:forbidden_scope';
    }
  }
  if (
    Array.isArray(value.ownershipRules) &&
    value.ownershipRules.some((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return false;
      const rule = item as Record<string, unknown>;
      return (
        (typeof rule.targetPath === 'string' && !isCanonicalArchitecturePath(rule.targetPath)) ||
        (typeof rule.owner === 'string' && !rule.owner.trim())
      );
    })
  ) {
    return 'architecture_successor_required:ownership';
  }
  if (typeof value.isolationSelection === 'string' && !value.isolationSelection.trim()) {
    return 'architecture_successor_required:isolation';
  }
  return null;
}

function readAuthority(
  projectRoot: string,
  artifact: RequirementsSourceArtifactBinding,
  kind: AuthorityKind
): AuthorityArtifact {
  if (artifact.mediaType !== 'application/json') {
    throw new Error('architecture_confirmation_authority_media_type_invalid');
  }
  const bytes = fs.readFileSync(confinedAuthorityFile(projectRoot, artifact.immutableBlobRef));
  let exactText: string;
  try {
    exactText = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new Error('architecture_confirmation_authority_utf8_invalid');
  }
  if (
    sha256Stable({ domain: 'requirements-source-snapshot/v1', content: exactText }) !==
    artifact.sourceSnapshotHash
  ) {
    throw new Error('architecture_confirmation_authority_snapshot_hash_mismatch');
  }
  const value = JSON.parse(exactText) as unknown;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('architecture_confirmation_authority_schema_invalid');
  }
  const sourceDocument = value as Record<string, unknown>;
  if (
    sourceDocument.schemaVersion !== 'requirements-contract-authority-source/v1' ||
    typeof sourceDocument.sourceRootId !== 'string' ||
    !sourceDocument.sourceRootId.trim() ||
    !sourceDocument.semanticBody ||
    typeof sourceDocument.semanticBody !== 'object' ||
    Array.isArray(sourceDocument.semanticBody)
  ) {
    throw new Error('architecture_confirmation_authority_schema_invalid');
  }
  const record = sourceDocument.semanticBody as Record<string, unknown>;
  const expectedRole: AuthorityRole =
    kind === 'repository' ? 'repository_authority' : 'policy_authority';
  if (
    record.authorityKind !== kind ||
    record.authorityRole !== expectedRole ||
    artifact.role !== expectedRole
  ) {
    throw new Error('architecture_confirmation_authority_role_mismatch');
  }
  const issueCode = missingFieldIssue(record, kind);
  if (issueCode) throw new ArchitecturePremiseAuthorityBlock(issueCode);
  const invalidIssueCode = invalidFieldIssue(record, kind);
  if (invalidIssueCode) throw new ArchitecturePremiseAuthorityBlock(invalidIssueCode);
  if (!validator()(record)) throw new Error('architecture_confirmation_authority_schema_invalid');
  if (
    record.authorityId !== artifact.sourceArtifactId ||
    sourceDocument.sourceRootId !== artifact.sourceArtifactId
  ) {
    throw new Error('architecture_confirmation_authority_identity_mismatch');
  }
  return { artifact, authority: record as unknown as Authority };
}

function resolveKind(
  projectRoot: string,
  artifacts: RequirementsSourceArtifactBinding[],
  kind: AuthorityKind
): AuthorityArtifact[] {
  const role = kind === 'repository' ? 'repository_authority' : 'policy_authority';
  const resolved = artifacts
    .filter((item) => item.role === role)
    .sort(
      (left, right) =>
        left.orderedPosition - right.orderedPosition ||
        left.sourceArtifactId.localeCompare(right.sourceArtifactId)
    )
    .map((artifact) => readAuthority(projectRoot, artifact, kind));
  if (resolved.length === 0)
    throw new ArchitecturePremiseAuthorityBlock(`architecture_successor_required:${kind}_premise`);
  const content = resolved.map(({ authority }) => canonicalAuthorityRules(authority));
  if (new Set(content).size !== 1)
    throw new ArchitecturePremiseAuthorityBlock(`architecture_successor_required:${kind}_premise`);
  return resolved;
}

function sortedUnique(values: readonly string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function canonicalPredicate(rule: {
  whenConstraintKinds?: string[];
  whenConstraintIds?: string[];
}): string {
  return canonicalRequirementsJson({
    whenConstraintKinds: sortedUnique(rule.whenConstraintKinds ?? []),
    whenConstraintIds: sortedUnique(rule.whenConstraintIds ?? []),
  });
}

function canonicalAuthorityRules(authority: Authority): string {
  const normalizeImpactRule = (rule: ArchitectureImpactRule) => ({
    ...rule,
    whenConstraintKinds: sortedUnique(rule.whenConstraintKinds ?? []),
    whenConstraintIds: sortedUnique(rule.whenConstraintIds ?? []),
  });
  const normalizeTriggerRule = (rule: ArchitectureTriggerRule) => ({
    ...rule,
    whenConstraintKinds: sortedUnique(rule.whenConstraintKinds ?? []),
    whenConstraintIds: sortedUnique(rule.whenConstraintIds ?? []),
  });
  if (authority.authorityKind === 'repository') {
    return canonicalRequirementsJson({
      allowedTargetPaths: sortedUnique(authority.allowedTargetPaths),
      consumerImpactRules: authority.consumerImpactRules
        .map(normalizeImpactRule)
        .sort((left, right) =>
          `${left.impactId}:${canonicalPredicate(left)}`.localeCompare(
            `${right.impactId}:${canonicalPredicate(right)}`
          )
        ),
      triggerRules: authority.triggerRules
        .map(normalizeTriggerRule)
        .sort((left, right) =>
          `${left.triggerId}:${canonicalPredicate(left)}`.localeCompare(
            `${right.triggerId}:${canonicalPredicate(right)}`
          )
        ),
    });
  }
  return canonicalRequirementsJson({
    forbiddenScope: { paths: sortedUnique(authority.forbiddenScope.paths) },
    ownershipRules: [...authority.ownershipRules].sort((left, right) =>
      `${left.targetPath}:${left.owner}`.localeCompare(`${right.targetPath}:${right.owner}`)
    ),
    isolationSelection: authority.isolationSelection,
    governanceImpactRules: authority.governanceImpactRules
      .map(normalizeImpactRule)
      .sort((left, right) =>
        `${left.impactId}:${canonicalPredicate(left)}`.localeCompare(
          `${right.impactId}:${canonicalPredicate(right)}`
        )
      ),
    triggerRules: authority.triggerRules
      .map(normalizeTriggerRule)
      .sort((left, right) =>
        `${left.triggerId}:${canonicalPredicate(left)}`.localeCompare(
          `${right.triggerId}:${canonicalPredicate(right)}`
        )
      ),
  });
}

function resolveRulePredicate(
  rule: { whenConstraintKinds?: string[]; whenConstraintIds?: string[] },
  constraints: RequirementsExecutionConstraint[],
  fieldIssue: string
): { matchedConstraintIds: string[]; predicateSignature: string } {
  const kinds = sortedUnique(rule.whenConstraintKinds ?? []);
  const ids = sortedUnique(rule.whenConstraintIds ?? []);
  const constraintById = new Map(
    constraints.map((constraint) => [constraint.constraintId, constraint])
  );
  if (
    ids.some((id) => {
      const constraint = constraintById.get(id);
      return !constraint || (kinds.length > 0 && !kinds.includes(constraint.kind));
    })
  ) {
    throw new ArchitecturePremiseAuthorityBlock(fieldIssue);
  }
  const matchedConstraintIds = constraints
    .filter(
      (constraint) =>
        (kinds.length === 0 || kinds.includes(constraint.kind)) &&
        (ids.length === 0 || ids.includes(constraint.constraintId))
    )
    .map((constraint) => constraint.constraintId)
    .sort((left, right) => left.localeCompare(right));
  return { matchedConstraintIds, predicateSignature: canonicalPredicate(rule) };
}

function assertConsistentRules<
  T extends { whenConstraintKinds?: string[]; whenConstraintIds?: string[] },
>(rules: T[], idOf: (rule: T) => string, fieldIssue: string): void {
  const byId = new Map<string, string>();
  for (const rule of rules) {
    const canonical = canonicalPredicate(rule);
    const id = idOf(rule);
    const previous = byId.get(id);
    if (previous && previous !== canonical) throw new ArchitecturePremiseAuthorityBlock(fieldIssue);
    byId.set(id, canonical);
  }
}

function resolveImpactRules(
  rules: ArchitectureImpactRule[],
  constraints: RequirementsExecutionConstraint[],
  fieldIssue: string
) {
  assertConsistentRules(rules, (rule) => rule.impactId, fieldIssue);
  return rules.map((rule): ResolvedArchitectureImpactRule => {
    const predicate = resolveRulePredicate(rule, constraints, fieldIssue);
    return {
      impactId: rule.impactId,
      status:
        predicate.matchedConstraintIds.length > 0 ||
        ((rule.whenConstraintKinds?.length ?? 0) === 0 &&
          (rule.whenConstraintIds?.length ?? 0) === 0)
          ? 'applicable'
          : 'not_applicable',
      ...predicate,
    };
  });
}

function resolveTriggerRules(
  rules: ArchitectureTriggerRule[],
  constraints: RequirementsExecutionConstraint[]
) {
  assertConsistentRules(
    rules,
    (rule) => rule.triggerId,
    'architecture_successor_required:trigger_rules'
  );
  return rules.map((rule): ResolvedArchitectureTriggerRule => {
    const predicate = resolveRulePredicate(
      rule,
      constraints,
      'architecture_successor_required:trigger_rules'
    );
    return {
      triggerId: rule.triggerId,
      triggered:
        predicate.matchedConstraintIds.length > 0 ||
        ((rule.whenConstraintKinds?.length ?? 0) === 0 &&
          (rule.whenConstraintIds?.length ?? 0) === 0),
      ...predicate,
    };
  });
}

export function resolveArchitecturePremiseAuthorities(input: {
  projectRoot: string;
  sourceArtifacts: RequirementsSourceArtifactBinding[];
  constraints: RequirementsExecutionConstraint[];
}): ResolvedArchitecturePremiseAuthorities {
  const repositories = resolveKind(input.projectRoot, input.sourceArtifacts, 'repository');
  const policies = resolveKind(input.projectRoot, input.sourceArtifacts, 'policy');
  const repository = repositories[0].authority as RepositoryArchitectureAuthority;
  const policy = policies[0].authority as PolicyArchitectureAuthority;
  assertConsistentRules(
    [...repository.triggerRules, ...policy.triggerRules],
    (rule) => rule.triggerId,
    'architecture_successor_required:trigger_rules'
  );
  return {
    repository: {
      ...repository,
      consumerImpactRules: resolveImpactRules(
        repository.consumerImpactRules,
        input.constraints,
        'architecture_successor_required:consumer_impact'
      ),
      triggerRules: resolveTriggerRules(repository.triggerRules, input.constraints),
    },
    policy: {
      ...policy,
      governanceImpactRules: resolveImpactRules(
        policy.governanceImpactRules,
        input.constraints,
        'architecture_successor_required:governance_impact'
      ),
      triggerRules: resolveTriggerRules(policy.triggerRules, input.constraints),
    },
    repositoryArtifacts: repositories.map((item) => item.artifact),
    policyArtifacts: policies.map((item) => item.artifact),
  };
}
