import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  canonicalJson,
  sha256,
  slash,
  writeGovernedJson,
} from './requirements-contract-governed-write';

export type RequirementsContractJsonRecord = Record<string, unknown>;

const HASH_PATTERN = /^sha256:[a-f0-9]{64}$/u;

function record(value: unknown, code: string): RequirementsContractJsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(code);
  }
  return value as RequirementsContractJsonRecord;
}

function text(value: unknown, code: string): string {
  if (typeof value !== 'string' || value.length === 0) throw new Error(code);
  return value;
}

function hashText(value: unknown, code: string): string {
  const normalized = text(value, code);
  if (!HASH_PATTERN.test(normalized)) throw new Error(code);
  return normalized;
}

function stringArray(value: unknown, code: string): string[] {
  if (!Array.isArray(value)) throw new Error(code);
  const result = value.map((entry) => text(entry, code));
  if (new Set(result).size !== result.length) throw new Error(code);
  return result;
}

function sourceHash(root: string, relativePath: string): string {
  const resolved = path.resolve(root, relativePath);
  const relative = path.relative(root, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('requirements_contract_requirements_scope_path_escape');
  }
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
    throw new Error('requirements_contract_requirements_scope_source_missing');
  }
  return sha256(fs.readFileSync(resolved));
}

function idsFromRows(value: unknown, field: string, idKey: string): string[] {
  if (!Array.isArray(value))
    throw new Error(`requirements_contract_requirements_scope_invalid:${field}`);
  return value.map((entry) =>
    text(
      record(entry, `requirements_contract_requirements_scope_invalid:${field}`)[idKey],
      `requirements_contract_requirements_scope_invalid:${field}`
    )
  );
}

function projectionRefs(authority: RequirementsContractJsonRecord): string[] {
  const requirements = record(
    authority.requirements,
    'requirements_contract_requirements_scope_invalid:requirements'
  );
  const manifest = record(
    authority.contractExecutionManifest,
    'requirements_contract_requirements_scope_invalid:contractExecutionManifest'
  );
  const mustRefs = idsFromRows(requirements.must, 'requirements.must', 'id');
  const traceRefs = idsFromRows(authority.traceSlices, 'traceSlices', 'traceId');
  const evidenceRefs = idsFromRows(manifest.evidence, 'contractExecutionManifest.evidence', 'id');
  const targetRefs = idsFromRows(
    manifest.targetModificationPaths,
    'contractExecutionManifest.targetModificationPaths',
    'id'
  );
  return [
    ...evidenceRefs,
    ...mustRefs,
    ...targetRefs,
    ...traceRefs,
    ...evidenceRefs.map((id) => `contractExecutionManifest.evidence:${id}`),
    ...targetRefs.map((id) => `contractExecutionManifest.targetModificationPaths:${id}`),
    ...mustRefs.map((id) => `requirements.must:${id}`),
    ...traceRefs.map((id) => `traceSlices:${id}`),
  ].sort();
}

export interface RequirementsContractRequirementsScope {
  schemaVersion: 'requirements-contract-requirements-scope/v1';
  role: 'requirements';
  sourceDocument: string;
  sourceBytesHash: string;
  sourceDocumentHash: string;
  semanticModelHash: string;
  projectionSetHash: string;
  promptRef: RequirementsContractJsonRecord;
  schemaRef: RequirementsContractJsonRecord;
  policyRef: RequirementsContractJsonRecord;
  ledgerRef: RequirementsContractJsonRecord;
  auditUnitSetRef: RequirementsContractJsonRecord;
  vetoRef: RequirementsContractJsonRecord;
  mustRefs: string[];
  sourceRequirementTexts: string[];
  projectionRefs: string[];
  packetProjectionSummary: {
    mustPacketCount: number;
    projectionGroups: string[];
    projectionRefs: string[];
  };
  scopeHash: string;
  requestHash: string;
  decision: 'pass';
}

export function compileRequirementsContractRequirementsScope(input: {
  projectRoot: string;
  authority: RequirementsContractJsonRecord;
  outputPath?: string;
}): RequirementsContractRequirementsScope {
  const root = path.resolve(input.projectRoot);
  const authority = record(input.authority, 'requirements_contract_requirements_scope_invalid');
  const requirements = record(
    authority.requirements,
    'requirements_contract_requirements_scope_invalid:requirements'
  );
  const mustRows = Array.isArray(requirements.must)
    ? requirements.must.map((entry) =>
        record(entry, 'requirements_contract_requirements_scope_invalid:requirements.must')
      )
    : [];
  if (mustRows.length === 0) {
    throw new Error('requirements_contract_requirements_scope_invalid:requirements.must');
  }
  const sourceDocument = text(
    authority.sourceDocument,
    'requirements_contract_requirements_scope_invalid:sourceDocument'
  ).replace(/\\/gu, '/');
  const scopeWithoutHashes = {
    schemaVersion: 'requirements-contract-requirements-scope/v1' as const,
    role: 'requirements' as const,
    sourceDocument,
    sourceBytesHash: sourceHash(root, sourceDocument),
    sourceDocumentHash: hashText(
      authority.sourceDocumentHash,
      'requirements_contract_requirements_scope_invalid:sourceDocumentHash'
    ),
    semanticModelHash: hashText(
      authority.semanticModelHash,
      'requirements_contract_requirements_scope_invalid:semanticModelHash'
    ),
    projectionSetHash: hashText(
      authority.projectionSetHash,
      'requirements_contract_requirements_scope_invalid:projectionSetHash'
    ),
    promptRef: record(
      authority.promptRef,
      'requirements_contract_requirements_scope_invalid:promptRef'
    ),
    schemaRef: record(
      authority.schemaRef,
      'requirements_contract_requirements_scope_invalid:schemaRef'
    ),
    policyRef: record(
      authority.policyRef,
      'requirements_contract_requirements_scope_invalid:policyRef'
    ),
    ledgerRef: record(
      authority.ledgerRef,
      'requirements_contract_requirements_scope_invalid:ledgerRef'
    ),
    auditUnitSetRef: record(
      authority.auditUnitSetRef,
      'requirements_contract_requirements_scope_invalid:auditUnitSetRef'
    ),
    vetoRef: record(authority.vetoRef, 'requirements_contract_requirements_scope_invalid:vetoRef'),
    mustRefs: mustRows.map((row) =>
      text(row.id, 'requirements_contract_requirements_scope_invalid:requirements.must.id')
    ),
    sourceRequirementTexts: mustRows.map((row) =>
      text(row.text, 'requirements_contract_requirements_scope_invalid:requirements.must.text')
    ),
    projectionRefs: projectionRefs(authority),
    packetProjectionSummary: {
      mustPacketCount: mustRows.length,
      projectionGroups: [
        'contractExecutionManifest.evidence',
        'contractExecutionManifest.targetModificationPaths',
        'requirements.must',
        'traceSlices',
      ],
      projectionRefs: projectionRefs(authority),
    },
    decision: 'pass' as const,
  };
  const scopeHash = sha256(canonicalJson(scopeWithoutHashes));
  const requestHash = sha256(
    canonicalJson({
      role: scopeWithoutHashes.role,
      sourceDocument,
      sourceDocumentHash: scopeWithoutHashes.sourceDocumentHash,
      semanticModelHash: scopeWithoutHashes.semanticModelHash,
      projectionSetHash: scopeWithoutHashes.projectionSetHash,
      mustRefs: scopeWithoutHashes.mustRefs,
      projectionRefs: scopeWithoutHashes.projectionRefs,
      scopeHash,
    })
  );
  const scope: RequirementsContractRequirementsScope = {
    ...scopeWithoutHashes,
    scopeHash,
    requestHash,
  };
  if (input.outputPath) {
    writeGovernedJson(path.resolve(root, input.outputPath), scope);
  }
  return scope;
}

export function requirementsContractRequirementsScopeRef(
  root: string,
  outputPath: string,
  scope: RequirementsContractRequirementsScope
) {
  const target = path.resolve(root, outputPath);
  return {
    path: slash(path.relative(root, target)),
    hash: sha256(canonicalJson(scope)),
  };
}

export function requireRequirementsContractRequirementsScopeHashFields(
  value: RequirementsContractJsonRecord
): string[] {
  return stringArray(
    [
      value.sourceDocumentHash,
      value.semanticModelHash,
      value.projectionSetHash,
      value.scopeHash,
      value.requestHash,
    ],
    'requirements_contract_requirements_scope_hash_fields_invalid'
  );
}
