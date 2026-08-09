import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { createRequire } from 'node:module';

export interface CampaignRuntimeFileRef {
  path: string;
  hash: string;
}

export interface CampaignRuntimeDependencyRef {
  moduleRef: CampaignRuntimeFileRef;
  exportName: string;
}

export interface CampaignRuntimeBinding {
  schemaVersion: 'main-agent-campaign-runtime-binding/v1';
  pointerRef: { path: string };
  packetRef: { path: string };
  certificationRef: CampaignRuntimeFileRef;
  packageRequestRef: CampaignRuntimeFileRef;
  partitionManifestRef: CampaignRuntimeFileRef;
  children: Array<{
    partitionId: string;
    path: string;
    hash: string;
  }>;
  runtimeDependencies: Record<
    'compileExecutionPackage' |
      'auditExecutionPackage' |
      'auditCompletedChild' |
      'auditCompletedCampaign',
    CampaignRuntimeDependencyRef
  >;
}

export interface CampaignRuntimeBindingRef extends CampaignRuntimeFileRef {
  readbackHash: string;
  readbackVerified: true;
}

export interface CampaignRuntimeDependencies {
  compileExecutionPackage: (input: Record<string, unknown>) => unknown;
  auditExecutionPackage: (input: Record<string, unknown>) => unknown;
  auditCompletedChild: (input: Record<string, unknown>) => unknown;
  auditCompletedCampaign: (input: Record<string, unknown>) => unknown;
}

export interface ResolvedCampaignRuntimeBinding {
  binding: CampaignRuntimeBinding;
  bindingRef: CampaignRuntimeBindingRef;
  certification: Record<string, unknown>;
  packageRequest: Record<string, unknown>;
  partitionManifest: Record<string, unknown>;
  dependencies: CampaignRuntimeDependencies;
}

type JsonRecord = Record<string, unknown>;

const DEPENDENCY_NAMES = [
  'compileExecutionPackage',
  'auditExecutionPackage',
  'auditCompletedChild',
  'auditCompletedCampaign',
] as const;

function isRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function sha256Bytes(value: Buffer): string {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (!isRecord(value)) return JSON.stringify(value) ?? 'null';
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`)
    .join(',')}}`;
}

function hashJson(value: unknown): string {
  return sha256Bytes(Buffer.from(stableJson(value), 'utf8'));
}

function normalized(filePath: string): string {
  const resolved = path.resolve(filePath);
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

function samePath(left: unknown, right: string): boolean {
  return typeof left === 'string' && normalized(left) === normalized(right);
}

function requireSha(value: unknown, label: string): string {
  if (typeof value !== 'string' || !/^sha256:[a-f0-9]{64}$/u.test(value)) {
    throw new Error(`campaign_runtime_binding_hash_invalid:${label}`);
  }
  return value;
}

function readStable(filePath: string, label: string): { path: string; hash: string; value: Buffer } {
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
    throw new Error(`campaign_runtime_binding_file_missing:${label}`);
  }
  const first = fs.readFileSync(resolved);
  const second = fs.readFileSync(resolved);
  if (!first.equals(second)) {
    throw new Error(`campaign_runtime_binding_file_changed:${label}`);
  }
  return { path: resolved, hash: sha256Bytes(first), value: first };
}

function readJson(filePath: string, label: string): JsonRecord {
  const file = readStable(filePath, label);
  try {
    const value = JSON.parse(file.value.toString('utf8')) as unknown;
    if (!isRecord(value)) throw new Error(label);
    return value;
  } catch {
    throw new Error(`campaign_runtime_binding_json_invalid:${label}`);
  }
}

function verifyRef(ref: unknown, label: string): { path: string; hash: string; value: Buffer } {
  if (!isRecord(ref) || typeof ref.path !== 'string') {
    throw new Error(`campaign_runtime_binding_ref_missing:${label}`);
  }
  const file = readStable(ref.path, label);
  if (file.hash !== requireSha(ref.hash, label)) {
    throw new Error(`campaign_runtime_binding_ref_hash_mismatch:${label}`);
  }
  return file;
}

function verifyPathRef(ref: unknown, expectedPath: string, label: string): void {
  if (!isRecord(ref) || !samePath(ref.path, expectedPath)) {
    throw new Error(`campaign_runtime_binding_path_mismatch:${label}`);
  }
}

function manifestChildPath(
  packageRequest: JsonRecord,
  manifestChild: JsonRecord
): string | null {
  if (typeof manifestChild.childContractPath !== 'string') return null;
  if (path.isAbsolute(manifestChild.childContractPath)) {
    return path.resolve(manifestChild.childContractPath);
  }
  return typeof packageRequest.repositoryRoot === 'string'
    ? path.resolve(packageRequest.repositoryRoot, manifestChild.childContractPath)
    : null;
}

function verifyCertification(
  certification: JsonRecord,
  input: {
    packetPath: string;
    modelPacketHash: string;
    transactionManifestHash: string;
    packageRequest: CampaignRuntimeFileRef;
    partitionManifest: CampaignRuntimeFileRef;
  }
): void {
  if (
    certification.schemaVersion !== 'main-agent-goal-source-authority-certification/v1' ||
    certification.authorityProfile !== 'main_agent_compiled' ||
    certification.decision !== 'PASS'
  ) {
    throw new Error('campaign_runtime_certification_invalid');
  }
  verifyPathRef(certification.packetRef, input.packetPath, 'certification.packetRef');
  const modelPacketBinding = certification.modelPacketBinding;
  if (
    !isRecord(modelPacketBinding) ||
    modelPacketBinding.modelPacketHash !== input.modelPacketHash ||
    certification.transactionManifestHash !== input.transactionManifestHash
  ) {
    throw new Error('campaign_runtime_certification_binding_mismatch');
  }
  const packageRef = certification.packageRequestRef as JsonRecord;
  const partitionRef = certification.partitionManifestRef as JsonRecord;
  if (
    !isRecord(packageRef) ||
    !samePath(packageRef.path, input.packageRequest.path) ||
    packageRef.hash !== input.packageRequest.hash ||
    !isRecord(partitionRef) ||
    !samePath(partitionRef.path, input.partitionManifest.path) ||
    partitionRef.hash !== input.partitionManifest.hash
  ) {
    throw new Error('campaign_runtime_certification_source_mismatch');
  }
  const declaredHash = certification.certificationHash;
  if (typeof declaredHash === 'string') {
    const core = { ...certification };
    delete core.certificationHash;
    delete core.certifiedAt;
    if (declaredHash !== hashJson(core)) {
      throw new Error('campaign_runtime_certification_hash_mismatch');
    }
  }
}

function loadDependency(
  ref: CampaignRuntimeDependencyRef | undefined,
  label: string
): (...args: unknown[]) => unknown {
  if (!ref) throw new Error(`campaign_runtime_binding_ref_missing:${label}`);
  const moduleFile = verifyRef(ref?.moduleRef, `${label}.moduleRef`);
  if (typeof ref.exportName !== 'string' || ref.exportName.length === 0) {
    throw new Error(`campaign_runtime_binding_export_missing:${label}`);
  }
  try {
    const loaded = createRequire(moduleFile.path)(moduleFile.path) as JsonRecord;
    const exported = loaded[ref.exportName];
    if (typeof exported !== 'function') {
      throw new Error(`campaign_runtime_binding_export_missing:${label}`);
    }
    return exported as (...args: unknown[]) => unknown;
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('campaign_runtime_')) throw error;
    throw new Error(`campaign_runtime_binding_module_load_failed:${label}`);
  }
}

export function inspectCampaignRuntimeCertification(input: {
  pointerPath: string;
  pointer: JsonRecord;
  modelPacketHash: string;
  transactionManifestHash: string;
  packetPath?: string;
}): {
  status: 'pass' | 'blocked' | 'preview';
  certificationHash: string | null;
  reasons: string[];
} {
  const pointerRef = input.pointer.campaignRuntimeBindingRef;
  if (!pointerRef) {
    return { status: 'preview', certificationHash: null, reasons: [] };
  }
  try {
    if (
      !isRecord(pointerRef) ||
      pointerRef.readbackVerified !== true ||
      pointerRef.readbackHash !== pointerRef.hash
    ) {
      throw new Error('campaign_runtime_binding_pointer_ref_invalid');
    }
    const bindingFile = verifyRef(pointerRef, 'campaignRuntimeBindingRef');
    const binding = readJson(bindingFile.path, 'binding') as CampaignRuntimeBinding;
    if (binding.schemaVersion !== 'main-agent-campaign-runtime-binding/v1') {
      throw new Error('campaign_runtime_binding_schema_invalid');
    }
    verifyPathRef(binding.pointerRef, input.pointerPath, 'binding.pointerRef');
    if (input.packetPath) {
      verifyPathRef(binding.packetRef, input.packetPath, 'binding.packetRef');
    }
    const packageFile = verifyRef(binding.packageRequestRef, 'packageRequestRef');
    const partitionFile = verifyRef(binding.partitionManifestRef, 'partitionManifestRef');
    const certificationFile = verifyRef(binding.certificationRef, 'certificationRef');
    const certification = readJson(certificationFile.path, 'certification');
    const certifiedPacketPath = isRecord(certification.packetRef)
      ? certification.packetRef.path
      : undefined;
    verifyCertification(certification, {
      packetPath: input.packetPath ?? String(certifiedPacketPath ?? binding.packetRef.path),
      modelPacketHash: input.modelPacketHash,
      transactionManifestHash: input.transactionManifestHash,
      packageRequest: { path: packageFile.path, hash: packageFile.hash },
      partitionManifest: { path: partitionFile.path, hash: partitionFile.hash },
    });
    for (const name of DEPENDENCY_NAMES) {
      const dependency = binding.runtimeDependencies?.[name];
      if (!dependency || typeof dependency.exportName !== 'string') {
        throw new Error(`campaign_runtime_binding_export_missing:${name}`);
      }
      verifyRef(dependency.moduleRef, `runtimeDependencies.${name}.moduleRef`);
    }
    return {
      status: 'pass',
      certificationHash: certificationFile.hash,
      reasons: [],
    };
  } catch (error) {
    return {
      status: 'blocked',
      certificationHash: null,
      reasons: [error instanceof Error ? error.message : 'campaign_runtime_certification_invalid'],
    };
  }
}

export function resolveCampaignRuntimeBinding(input: {
  pointerPath: string;
  pointerHash: string;
  packetPath: string;
  packetHash: string;
  pointer: JsonRecord;
  packet: JsonRecord;
}): ResolvedCampaignRuntimeBinding {
  const pointerRef = input.pointer.campaignRuntimeBindingRef;
  const packetRef = input.packet.campaignRuntimeBindingRef;
  if (!isRecord(pointerRef) || !isRecord(packetRef)) {
    throw new Error('campaign_runtime_binding_missing');
  }
  if (
    stableJson(pointerRef) !== stableJson(packetRef) ||
    !samePath(pointerRef.path, packetRef.path) ||
    pointerRef.hash !== packetRef.hash
  ) {
    throw new Error('campaign_runtime_binding_pointer_packet_mismatch');
  }
  const bindingFile = verifyRef(pointerRef, 'campaignRuntimeBindingRef');
  const binding = readJson(bindingFile.path, 'binding') as CampaignRuntimeBinding;
  if (binding.schemaVersion !== 'main-agent-campaign-runtime-binding/v1') {
    throw new Error('campaign_runtime_binding_schema_invalid');
  }
  verifyPathRef(binding.pointerRef, input.pointerPath, 'binding.pointerRef');
  verifyPathRef(binding.packetRef, input.packetPath, 'binding.packetRef');
  const packageFile = verifyRef(binding.packageRequestRef, 'packageRequestRef');
  const partitionFile = verifyRef(binding.partitionManifestRef, 'partitionManifestRef');
  const certificationFile = verifyRef(binding.certificationRef, 'certificationRef');
  const packageRequest = readJson(packageFile.path, 'packageRequest');
  const partitionManifest = readJson(partitionFile.path, 'partitionManifest');
  const certification = readJson(certificationFile.path, 'certification');
  if (
    packageRequest.schemaVersion !== 'goal-subcontract-execution-package-request/v1' ||
    !isRecord(packageRequest.partitionManifest) ||
    !samePath(packageRequest.partitionManifest.path, partitionFile.path) ||
    packageRequest.partitionManifest.hash !== partitionFile.hash ||
    !Array.isArray(packageRequest.children) ||
    partitionManifest.schemaVersion !== 'goal-contract-partition-manifest/v1' ||
    !Array.isArray(partitionManifest.partitions)
  ) {
    throw new Error('campaign_runtime_binding_package_partition_mismatch');
  }
  if (!Array.isArray(binding.children) || binding.children.length === 0) {
    throw new Error('campaign_runtime_binding_children_missing');
  }
  if (
    binding.children.length !== packageRequest.children.length ||
    binding.children.length !== partitionManifest.partitions.length
  ) {
    throw new Error('campaign_runtime_binding_child_set_mismatch');
  }
  for (const [index, child] of binding.children.entries()) {
    if (!isRecord(child) || typeof child.partitionId !== 'string') {
      throw new Error('campaign_runtime_binding_children_invalid');
    }
    const childFile = verifyRef(child, `children[${index}]`);
    if (childFile.hash !== child.hash) {
      throw new Error(`campaign_runtime_binding_ref_hash_mismatch:children[${index}]`);
    }
    const requestChild = packageRequest.children[index];
    const manifestChild = partitionManifest.partitions[index];
    if (
      !isRecord(requestChild) ||
      !isRecord(manifestChild) ||
      requestChild.partitionId !== child.partitionId ||
      !samePath(requestChild.path, childFile.path) ||
      requestChild.hash !== child.hash ||
      manifestChild.partitionId !== child.partitionId ||
      manifestChild.childContractHash !== child.hash ||
      !samePath(manifestChildPath(packageRequest, manifestChild), childFile.path)
    ) {
      throw new Error(`campaign_runtime_binding_child_membership_mismatch:${index}`);
    }
  }
  verifyCertification(certification, {
    packetPath: input.packetPath,
    modelPacketHash: String((input.pointer.modelPacketRef as JsonRecord | undefined)?.hash ?? ''),
    transactionManifestHash: String(
      (input.pointer.transactionManifestRef as JsonRecord | undefined)?.hash ?? ''
    ),
    packageRequest: { path: packageFile.path, hash: packageFile.hash },
    partitionManifest: { path: partitionFile.path, hash: partitionFile.hash },
  });
  const loaded = Object.fromEntries(
    DEPENDENCY_NAMES.map((name) => [
      name,
      loadDependency(binding.runtimeDependencies?.[name], `runtimeDependencies.${name}`),
    ])
  ) as Record<(typeof DEPENDENCY_NAMES)[number], (...args: unknown[]) => unknown>;
  return {
    binding,
    bindingRef: {
      path: bindingFile.path,
      hash: bindingFile.hash,
      readbackHash: bindingFile.hash,
      readbackVerified: true,
    },
    certification,
    packageRequest,
    partitionManifest,
    dependencies: loaded as CampaignRuntimeDependencies,
  };
}

export function campaignRuntimeBindingHash(value: CampaignRuntimeBinding): string {
  return hashJson(value);
}
