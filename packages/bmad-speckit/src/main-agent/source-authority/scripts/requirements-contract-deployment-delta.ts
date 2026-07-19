import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020';
import {
  type RequirementsContractDeploymentConnection,
  type RequirementsContractDeploymentModel,
  type RequirementsContractDeploymentNode,
  validateRequirementsContractDeploymentModel,
} from './requirements-contract-deployment-model';
import { sha256Stable } from './requirements-contract-semantic-resolver';

export interface RequirementsContractDeploymentNodeDelta {
  nodeId: string;
  changeType: 'added' | 'removed' | 'modified';
  beforeHash: string | null;
  afterHash: string | null;
  proofRefs: string[];
}

export interface RequirementsContractDeploymentConnectionDelta {
  connectionId: string;
  changeType: 'added' | 'removed' | 'modified';
  beforeHash: string | null;
  afterHash: string | null;
  proofRefs: string[];
}

export interface RequirementsContractDeploymentDelta {
  schemaVersion: 'requirements-contract-deployment-delta/v1';
  requirementSetId: string;
  baselineModelId: string;
  baselineModelHash: string;
  targetModelId: string;
  targetModelHash: string;
  applicability: 'required' | 'not_applicable';
  diagramRequired: boolean;
  nodeDeltas: RequirementsContractDeploymentNodeDelta[];
  connectionDeltas: RequirementsContractDeploymentConnectionDelta[];
  proofRefs: string[];
  deltaHash: string;
}

export interface RequirementsContractDeploymentDeltaValidationResult {
  ok: boolean;
  issues: Array<{
    code:
      | 'schema_validation_failed'
      | 'deployment_delta_hash_mismatch'
      | 'deployment_delta_applicability_mismatch';
    path: string;
    message: string;
  }>;
}

function schemaPath(): string {
  const fileName = 'requirements-contract-deployment-delta.schema.json';
  const candidates = [
    path.resolve(
      process.cwd(),
      'packages',
      'bmad-speckit',
      'src',
      'main-agent',
      'source-authority',
      'schemas',
      fileName
    ),
    path.resolve(__dirname, '..', 'schemas', fileName),
  ];
  return candidates.find((candidate) => existsSync(candidate)) ?? candidates[0];
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort();
}

function proofRefs(
  before: { proofRefs: string[] } | undefined,
  after: { proofRefs: string[] } | undefined
): string[] {
  return uniqueSorted([...(before?.proofRefs ?? []), ...(after?.proofRefs ?? [])]);
}

function deltas<T extends { id: string; proofRefs: string[] }>(
  beforeRows: T[],
  afterRows: T[]
): Array<{
  id: string;
  changeType: 'added' | 'removed' | 'modified';
  beforeHash: string | null;
  afterHash: string | null;
  proofRefs: string[];
}> {
  const before = new Map(beforeRows.map((row) => [row.id, row]));
  const after = new Map(afterRows.map((row) => [row.id, row]));
  return [...new Set([...before.keys(), ...after.keys()])]
    .sort()
    .flatMap((id) => {
      const beforeRow = before.get(id);
      const afterRow = after.get(id);
      if (!beforeRow && afterRow) {
        return [
          {
            id,
            changeType: 'added' as const,
            beforeHash: null,
            afterHash: sha256Stable(afterRow),
            proofRefs: proofRefs(undefined, afterRow),
          },
        ];
      }
      if (beforeRow && !afterRow) {
        return [
          {
            id,
            changeType: 'removed' as const,
            beforeHash: sha256Stable(beforeRow),
            afterHash: null,
            proofRefs: proofRefs(beforeRow, undefined),
          },
        ];
      }
      if (beforeRow && afterRow) {
        const beforeHash = sha256Stable(beforeRow);
        const afterHash = sha256Stable(afterRow);
        if (beforeHash !== afterHash) {
          return [
            {
              id,
              changeType: 'modified' as const,
              beforeHash,
              afterHash,
              proofRefs: proofRefs(beforeRow, afterRow),
            },
          ];
        }
      }
      return [];
    });
}

export function validateRequirementsContractDeploymentDelta(
  candidate: unknown
): RequirementsContractDeploymentDeltaValidationResult {
  const schema = JSON.parse(readFileSync(schemaPath(), 'utf8')) as object;
  const validate = new Ajv2020({ allErrors: true, strict: false }).compile(schema);
  const issues: RequirementsContractDeploymentDeltaValidationResult['issues'] = [];
  if (!validate(candidate)) {
    issues.push(
      ...(validate.errors ?? []).map((error) => ({
        code: 'schema_validation_failed' as const,
        path: error.instancePath || '/',
        message: error.message ?? 'schema validation failed',
      }))
    );
  }
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    return { ok: false, issues };
  }
  const value = candidate as RequirementsContractDeploymentDelta;
  const changeCount =
    (Array.isArray(value.nodeDeltas) ? value.nodeDeltas.length : 0) +
    (Array.isArray(value.connectionDeltas) ? value.connectionDeltas.length : 0);
  const shouldRequire = changeCount > 0;
  if (
    value.diagramRequired !== shouldRequire ||
    value.applicability !== (shouldRequire ? 'required' : 'not_applicable')
  ) {
    issues.push({
      code: 'deployment_delta_applicability_mismatch',
      path: '/applicability',
      message: 'deployment applicability must be derived from runtime deployment changes',
    });
  }
  if (typeof value.deltaHash === 'string') {
    const { deltaHash, ...preimage } = value;
    if (deltaHash !== sha256Stable(preimage)) {
      issues.push({
        code: 'deployment_delta_hash_mismatch',
        path: '/deltaHash',
        message: 'deployment delta hash does not match canonical content',
      });
    }
  }
  return { ok: issues.length === 0, issues };
}

export function computeRequirementsContractDeploymentDelta(input: {
  requirementSetId: string;
  baseline: RequirementsContractDeploymentModel;
  target: RequirementsContractDeploymentModel;
  requirementProofRefs: string[];
}): RequirementsContractDeploymentDelta {
  if (!validateRequirementsContractDeploymentModel(input.baseline).ok) {
    throw new Error('deployment_baseline_invalid');
  }
  if (!validateRequirementsContractDeploymentModel(input.target).ok) {
    throw new Error('deployment_target_invalid');
  }
  if (!input.requirementSetId.trim()) throw new Error('deployment_requirement_set_id_required');
  const requirementProofRefs = uniqueSorted(input.requirementProofRefs);
  if (requirementProofRefs.length === 0) {
    throw new Error('deployment_requirement_proof_required');
  }

  const nodeDeltas = deltas<RequirementsContractDeploymentNode>(
    input.baseline.nodes,
    input.target.nodes
  ).map(({ id, ...delta }) => ({ nodeId: id, ...delta }));
  const connectionDeltas = deltas<RequirementsContractDeploymentConnection>(
    input.baseline.connections,
    input.target.connections
  ).map(({ id, ...delta }) => ({ connectionId: id, ...delta }));
  const diagramRequired = nodeDeltas.length + connectionDeltas.length > 0;
  const preimage = {
    schemaVersion: 'requirements-contract-deployment-delta/v1' as const,
    requirementSetId: input.requirementSetId,
    baselineModelId: input.baseline.modelId,
    baselineModelHash: input.baseline.modelHash,
    targetModelId: input.target.modelId,
    targetModelHash: input.target.modelHash,
    applicability: diagramRequired ? ('required' as const) : ('not_applicable' as const),
    diagramRequired,
    nodeDeltas,
    connectionDeltas,
    proofRefs: uniqueSorted([
      input.baseline.authority.ref,
      input.target.authority.ref,
      ...requirementProofRefs,
    ]),
  };
  const result: RequirementsContractDeploymentDelta = {
    ...preimage,
    deltaHash: sha256Stable(preimage),
  };
  const validation = validateRequirementsContractDeploymentDelta(result);
  if (!validation.ok) {
    throw new Error(
      `deployment_delta_invalid:${validation.issues.map((issue) => issue.code).join(',')}`
    );
  }
  return result;
}
