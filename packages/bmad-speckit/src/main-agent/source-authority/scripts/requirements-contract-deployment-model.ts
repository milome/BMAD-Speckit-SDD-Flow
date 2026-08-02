import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020';
import { sha256Stable } from './requirements-contract-semantic-resolver';

export type RequirementsContractDeploymentAuthorityKind =
  | 'infrastructure_manifest'
  | 'runtime_manifest'
  | 'deployment_workflow'
  | 'architecture_record'
  | 'decision_receipt';

export type RequirementsContractDeploymentNodeKind =
  | 'runtime_service'
  | 'runtime_process'
  | 'data_store'
  | 'message_broker'
  | 'external_dependency'
  | 'runtime_configuration';

export type RequirementsContractDeploymentConnectionKind =
  | 'request'
  | 'event'
  | 'data_access'
  | 'network'
  | 'configuration'
  | 'dependency';

export interface RequirementsContractDeploymentNode {
  id: string;
  kind: RequirementsContractDeploymentNodeKind;
  name: string;
  configurationHash: string;
  proofRefs: string[];
}

export interface RequirementsContractDeploymentConnection {
  id: string;
  from: string;
  to: string;
  kind: RequirementsContractDeploymentConnectionKind;
  configurationHash: string;
  proofRefs: string[];
}

export interface RequirementsContractDeploymentModelInput {
  modelId: string;
  authority: {
    kind: RequirementsContractDeploymentAuthorityKind;
    ref: string;
    hash: string;
  };
  nodes: RequirementsContractDeploymentNode[];
  connections: RequirementsContractDeploymentConnection[];
}

export interface RequirementsContractDeploymentModel
  extends RequirementsContractDeploymentModelInput {
  schemaVersion: 'requirements-contract-deployment-model/v1';
  modelHash: string;
}

export interface RequirementsContractDeploymentModelIssue {
  code:
    | 'schema_validation_failed'
    | 'deployment_path_node_forbidden'
    | 'duplicate_deployment_node_id'
    | 'duplicate_deployment_connection_id'
    | 'unknown_deployment_node_ref'
    | 'deployment_model_hash_mismatch';
  path: string;
  message: string;
}

export interface RequirementsContractDeploymentModelValidationResult {
  ok: boolean;
  issues: RequirementsContractDeploymentModelIssue[];
}

function schemaPath(): string {
  const fileName = 'requirements-contract-deployment-model.schema.json';
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

function schemaIssues(candidate: unknown): RequirementsContractDeploymentModelIssue[] {
  const schema = JSON.parse(readFileSync(schemaPath(), 'utf8')) as object;
  const validate = new Ajv2020({ allErrors: true, strict: false }).compile(schema);
  if (validate(candidate)) return [];
  return (validate.errors ?? []).map((error) => ({
    code: 'schema_validation_failed' as const,
    path: error.instancePath || '/',
    message: error.message ?? 'schema validation failed',
  }));
}

function deploymentPathLike(value: string): boolean {
  const normalized = value.trim();
  return (
    /^[A-Za-z]:[\\/]/u.test(normalized) ||
    normalized.includes('/') ||
    normalized.includes('\\') ||
    /\.(?:md|markdown|json|ya?ml|toml|ts|tsx|js|jsx|mjs|cjs)$/iu.test(normalized)
  );
}

function addIssue(
  issues: RequirementsContractDeploymentModelIssue[],
  issue: RequirementsContractDeploymentModelIssue
): void {
  if (issues.some((candidate) => candidate.code === issue.code && candidate.path === issue.path)) {
    return;
  }
  issues.push(issue);
}

export function validateRequirementsContractDeploymentModel(
  candidate: unknown
): RequirementsContractDeploymentModelValidationResult {
  const issues = schemaIssues(candidate);
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    return { ok: false, issues };
  }
  const model = candidate as RequirementsContractDeploymentModel;
  const nodeIds = new Set<string>();
  for (const [index, node] of (Array.isArray(model.nodes) ? model.nodes : []).entries()) {
    if (deploymentPathLike(String(node.name ?? ''))) {
      addIssue(issues, {
        code: 'deployment_path_node_forbidden',
        path: `/nodes/${index}/name`,
        message: `deployment node cannot be a repository path: ${String(node.name)}`,
      });
    }
    if (nodeIds.has(node.id)) {
      addIssue(issues, {
        code: 'duplicate_deployment_node_id',
        path: `/nodes/${index}/id`,
        message: `duplicate deployment node id: ${node.id}`,
      });
    }
    nodeIds.add(node.id);
  }
  const connectionIds = new Set<string>();
  for (const [index, connection] of (
    Array.isArray(model.connections) ? model.connections : []
  ).entries()) {
    if (connectionIds.has(connection.id)) {
      addIssue(issues, {
        code: 'duplicate_deployment_connection_id',
        path: `/connections/${index}/id`,
        message: `duplicate deployment connection id: ${connection.id}`,
      });
    }
    connectionIds.add(connection.id);
    for (const field of ['from', 'to'] as const) {
      if (!nodeIds.has(connection[field])) {
        addIssue(issues, {
          code: 'unknown_deployment_node_ref',
          path: `/connections/${index}/${field}`,
          message: `unknown deployment node ref: ${connection[field]}`,
        });
      }
    }
  }
  if (typeof model.modelHash === 'string') {
    const { modelHash, ...preimage } = model;
    if (modelHash !== sha256Stable(preimage)) {
      addIssue(issues, {
        code: 'deployment_model_hash_mismatch',
        path: '/modelHash',
        message: 'deployment model hash does not match canonical content',
      });
    }
  }
  return { ok: issues.length === 0, issues };
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort();
}

export function createRequirementsContractDeploymentModel(
  input: RequirementsContractDeploymentModelInput
): RequirementsContractDeploymentModel {
  const preimage = {
    schemaVersion: 'requirements-contract-deployment-model/v1' as const,
    modelId: input.modelId,
    authority: structuredClone(input.authority),
    nodes: structuredClone(input.nodes)
      .map((node) => ({ ...node, proofRefs: uniqueSorted(node.proofRefs) }))
      .sort((left, right) => left.id.localeCompare(right.id)),
    connections: structuredClone(input.connections)
      .map((connection) => ({
        ...connection,
        proofRefs: uniqueSorted(connection.proofRefs),
      }))
      .sort((left, right) => left.id.localeCompare(right.id)),
  };
  const model: RequirementsContractDeploymentModel = {
    ...preimage,
    modelHash: sha256Stable(preimage),
  };
  const validation = validateRequirementsContractDeploymentModel(model);
  const pathIssue = validation.issues.find(
    (issue) => issue.code === 'deployment_path_node_forbidden'
  );
  if (pathIssue) throw new Error(pathIssue.code);
  if (!validation.ok) {
    throw new Error(
      `deployment_model_invalid:${validation.issues.map((issue) => issue.code).join(',')}`
    );
  }
  return model;
}
