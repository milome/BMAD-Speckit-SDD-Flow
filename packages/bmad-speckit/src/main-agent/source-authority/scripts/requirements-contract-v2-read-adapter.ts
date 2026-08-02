import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020';

export interface RequirementsContractV2ReadInput {
  projectRoot: string;
  bundleManifestPath: string;
  expectedRequirementSetId: string;
  expectedSemanticModelHash: string;
  expectedTraceGraphHash: string;
}

export interface RequirementsContractV2ReadIssue {
  code:
    | 'bundle_manifest_missing'
    | 'bundle_manifest_invalid'
    | 'bundle_identity_mismatch'
    | 'bundle_member_path_escape'
    | 'bundle_member_missing'
    | 'bundle_member_hash_mismatch'
    | 'bundle_member_json_invalid'
    | 'semantic_model_hash_mismatch'
    | 'trace_graph_hash_mismatch';
  path: string;
  message: string;
}

export interface RequirementsContractV2ReadResult {
  ok: boolean;
  decision: 'pass' | 'block';
  issues: RequirementsContractV2ReadIssue[];
  manifest: Record<string, unknown> | null;
  logicalModel: Record<string, unknown> | null;
  traceGraph: Record<string, unknown> | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function parseJson(filePath: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(readFileSync(filePath, 'utf8'));
  if (!isRecord(parsed)) throw new Error('JSON root must be an object');
  return parsed;
}

function sha256File(filePath: string): string {
  return `sha256:${createHash('sha256').update(readFileSync(filePath)).digest('hex')}`;
}

function resolvesInside(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function manifestValidator() {
  const schemaPath = path.resolve(
    __dirname,
    '../schemas/requirements-contract-runtime-bundle-manifest.schema.json'
  );
  const schema = JSON.parse(readFileSync(schemaPath, 'utf8')) as object;
  return new Ajv2020({ allErrors: true, strict: false }).compile(schema);
}

export function readRequirementsContractV2Bundle(
  input: RequirementsContractV2ReadInput
): RequirementsContractV2ReadResult {
  const issues: RequirementsContractV2ReadIssue[] = [];
  const projectRoot = path.resolve(input.projectRoot);
  const manifestPath = path.resolve(input.bundleManifestPath);
  if (!resolvesInside(projectRoot, manifestPath) || !existsSync(manifestPath)) {
    issues.push({
      code: 'bundle_manifest_missing',
      path: manifestPath,
      message: 'bundle manifest is missing or outside the project root',
    });
    return { ok: false, decision: 'block', issues, manifest: null, logicalModel: null, traceGraph: null };
  }

  let manifest: Record<string, unknown>;
  try {
    manifest = parseJson(manifestPath);
  } catch (error) {
    issues.push({
      code: 'bundle_manifest_invalid',
      path: manifestPath,
      message: error instanceof Error ? error.message : String(error),
    });
    return { ok: false, decision: 'block', issues, manifest: null, logicalModel: null, traceGraph: null };
  }

  const validateManifest = manifestValidator();
  if (!validateManifest(manifest)) {
    issues.push({
      code: 'bundle_manifest_invalid',
      path: manifestPath,
      message: JSON.stringify(validateManifest.errors ?? []),
    });
  }
  if (
    manifest.requirementSetId !== input.expectedRequirementSetId ||
    manifest.semanticModelHash !== input.expectedSemanticModelHash ||
    manifest.traceGraphHash !== input.expectedTraceGraphHash
  ) {
    issues.push({
      code: 'bundle_identity_mismatch',
      path: manifestPath,
      message: 'bundle manifest identity or expected hashes do not match the requested contract',
    });
  }

  let logicalModel: Record<string, unknown> | null = null;
  let traceGraph: Record<string, unknown> | null = null;
  const members = Array.isArray(manifest.members) ? manifest.members : [];
  for (const member of members) {
    if (!isRecord(member) || typeof member.path !== 'string') continue;
    const memberPath = path.resolve(projectRoot, member.path);
    if (!resolvesInside(projectRoot, memberPath)) {
      issues.push({
        code: 'bundle_member_path_escape',
        path: member.path,
        message: 'bundle member resolves outside the project root',
      });
      continue;
    }
    if (!existsSync(memberPath)) {
      issues.push({
        code: 'bundle_member_missing',
        path: member.path,
        message: 'manifest-declared bundle member is missing',
      });
      continue;
    }
    if (typeof member.hash !== 'string' || sha256File(memberPath) !== member.hash) {
      issues.push({
        code: 'bundle_member_hash_mismatch',
        path: member.path,
        message: 'bundle member bytes do not match the manifest hash',
      });
      continue;
    }
    try {
      const value = parseJson(memberPath);
      if (member.role === 'semantic_ir') logicalModel = value;
      if (member.role === 'trace_graph') traceGraph = value;
    } catch (error) {
      issues.push({
        code: 'bundle_member_json_invalid',
        path: member.path,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  if (logicalModel?.semanticModelHash !== input.expectedSemanticModelHash) {
    issues.push({
      code: 'semantic_model_hash_mismatch',
      path: manifestPath,
      message: 'semantic IR hash does not match the requested semantic model hash',
    });
  }
  if (traceGraph?.traceGraphHash !== input.expectedTraceGraphHash) {
    issues.push({
      code: 'trace_graph_hash_mismatch',
      path: manifestPath,
      message: 'Trace Graph hash does not match the requested Trace Graph hash',
    });
  }

  return {
    ok: issues.length === 0,
    decision: issues.length === 0 ? 'pass' : 'block',
    issues,
    manifest,
    logicalModel,
    traceGraph,
  };
}
