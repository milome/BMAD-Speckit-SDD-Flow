import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { OrchestrationFlow } from './orchestration-dispatch-contract';

export interface SddArtifactManifestArtifact {
  path: string;
  artifactClass: string;
  contentHash: string;
  boundIds: string[];
  producerPacketId: string;
  authoritativeFor: 'review_evidence';
}

export interface SddArtifactManifest {
  schemaVersion: 'sdd-artifact-manifest/v1';
  recordId: string;
  flow: OrchestrationFlow;
  packetId: string;
  runtimeTraceExecutionDir: string;
  workProductRoot: {
    implementationArtifactsRoot: string;
    specsRoot: string;
  };
  artifactRootPolicy: {
    governedNonStoryRoot: string;
    looseLegacyOrphanPolicy: 'compatibility_only_block_closeout_until_rehomed_or_excluded';
  };
  artifacts: SddArtifactManifestArtifact[];
  controls: {
    artifactIndexedIsCommandProof: false;
    closeoutReadinessPreviewRequiredCommandsAuthority: 'non_authoritative_preview_only';
  };
  manifestHash?: string;
}

export interface SddArtifactManifestValidation {
  ok: boolean;
  blockingReasons: string[];
  manifestHash: string;
}

const SHA256_PATTERN = /^sha256:[a-f0-9]{64}$/u;

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  const objectValue = value as Record<string, unknown>;
  return `{${Object.keys(objectValue)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(objectValue[key])}`)
    .join(',')}}`;
}

function sha256Stable(value: unknown): string {
  return `sha256:${crypto.createHash('sha256').update(stableStringify(value), 'utf8').digest('hex')}`;
}

function sha256File(filePath: string): string {
  return `sha256:${crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex')}`;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizePathForManifest(value: string): string {
  return value.replace(/\\/gu, '/').replace(/^\/+/u, '');
}

function isStoryFlow(flow: OrchestrationFlow): boolean {
  return flow === 'story';
}

export function governedNonStorySddRoot(input: {
  recordId: string;
  flow: OrchestrationFlow;
  packetId: string;
}): string {
  return `_orphan/${input.recordId}/${input.flow}/${input.packetId}`;
}

export function defaultSddArtifactManifestPath(input: {
  runtimeTraceExecutionDir: string;
}): string {
  return path.join(input.runtimeTraceExecutionDir, 'sdd-artifact-manifest.json');
}

export function createSddArtifactManifest(input: {
  recordId: string;
  flow: OrchestrationFlow;
  packetId: string;
  runtimeTraceExecutionDir: string;
  artifacts?: SddArtifactManifestArtifact[];
}): SddArtifactManifest {
  const manifest: SddArtifactManifest = {
    schemaVersion: 'sdd-artifact-manifest/v1',
    recordId: input.recordId,
    flow: input.flow,
    packetId: input.packetId,
    runtimeTraceExecutionDir: normalizePathForManifest(input.runtimeTraceExecutionDir),
    workProductRoot: {
      implementationArtifactsRoot: normalizePathForManifest(
        `_bmad-output/implementation-artifacts/${governedNonStorySddRoot(input)}`
      ),
      specsRoot: normalizePathForManifest(`specs/${governedNonStorySddRoot(input)}`),
    },
    artifactRootPolicy: {
      governedNonStoryRoot: governedNonStorySddRoot(input),
      looseLegacyOrphanPolicy: 'compatibility_only_block_closeout_until_rehomed_or_excluded',
    },
    artifacts: input.artifacts ?? [],
    controls: {
      artifactIndexedIsCommandProof: false,
      closeoutReadinessPreviewRequiredCommandsAuthority: 'non_authoritative_preview_only',
    },
  };
  return {
    ...manifest,
    manifestHash: sha256Stable({ ...manifest, manifestHash: undefined }),
  };
}

export function artifactRefFromFile(input: {
  projectRoot: string;
  artifactPath: string;
  artifactClass: string;
  boundIds: string[];
  producerPacketId: string;
}): SddArtifactManifestArtifact {
  const absolute = path.isAbsolute(input.artifactPath)
    ? input.artifactPath
    : path.join(input.projectRoot, input.artifactPath);
  return {
    path: normalizePathForManifest(input.artifactPath),
    artifactClass: input.artifactClass,
    contentHash: fs.existsSync(absolute)
      ? sha256File(absolute)
      : sha256Stable({ missingArtifactPath: normalizePathForManifest(input.artifactPath) }),
    boundIds: input.boundIds,
    producerPacketId: input.producerPacketId,
    authoritativeFor: 'review_evidence',
  };
}

function artifactUnderWorkProductPlane(artifactPath: string): boolean {
  const normalized = normalizePathForManifest(artifactPath);
  return (
    normalized.startsWith('_bmad-output/implementation-artifacts/') ||
    normalized.startsWith('specs/')
  );
}

function isLooseLegacyOrphan(artifactPath: string, governedRoot: string): boolean {
  const normalized = normalizePathForManifest(artifactPath);
  const governedRootWithOrphan = governedRoot.startsWith('_orphan/')
    ? governedRoot
    : `_orphan/${governedRoot}`;
  if (!normalized.includes('/_orphan/') && !normalized.startsWith('_orphan/')) return false;
  return (
    !normalized.includes(`/${governedRootWithOrphan}/`) &&
    !normalized.startsWith(`${governedRootWithOrphan}/`)
  );
}

function hasGovernedNonStoryRoot(artifactPath: string, governedRoot: string): boolean {
  const normalized = normalizePathForManifest(artifactPath);
  return (
    normalized.startsWith(`_bmad-output/implementation-artifacts/${governedRoot}/`) ||
    normalized.startsWith(`specs/${governedRoot}/`)
  );
}

export function validateSddArtifactManifest(input: {
  manifest: SddArtifactManifest;
  projectRoot?: string;
  declaredArtifactPaths?: string[];
  requiredCommandProofArtifactPaths?: string[];
  closeoutReadinessPreviewCommandRefsUsedAsAuthority?: boolean;
}): SddArtifactManifestValidation {
  const manifest = input.manifest;
  const blockingReasons: string[] = [];
  if (manifest.schemaVersion !== 'sdd-artifact-manifest/v1')
    blockingReasons.push('schema_version_invalid');
  for (const field of ['recordId', 'flow', 'packetId', 'runtimeTraceExecutionDir'] as const) {
    if (!text(manifest[field])) blockingReasons.push(`${field}_missing`);
  }
  if (!text(manifest.workProductRoot?.implementationArtifactsRoot)) {
    blockingReasons.push('work_product_root_implementation_artifacts_missing');
  }
  if (!text(manifest.workProductRoot?.specsRoot))
    blockingReasons.push('work_product_root_specs_missing');
  if (!text(manifest.artifactRootPolicy?.governedNonStoryRoot)) {
    blockingReasons.push('artifact_root_policy_governed_non_story_root_missing');
  }
  if (manifest.controls?.artifactIndexedIsCommandProof !== false) {
    blockingReasons.push('artifact_indexed_must_not_be_command_proof');
  }
  if (
    manifest.controls?.closeoutReadinessPreviewRequiredCommandsAuthority !==
    'non_authoritative_preview_only'
  ) {
    blockingReasons.push('closeout_readiness_preview_authority_invalid');
  }

  const indexed = new Set<string>();
  const governedRoot = manifest.artifactRootPolicy?.governedNonStoryRoot ?? '';
  for (const [index, artifact] of (manifest.artifacts ?? []).entries()) {
    const prefix = `artifacts[${index}]`;
    const artifactPath = normalizePathForManifest(artifact.path);
    if (!artifactPath) blockingReasons.push(`${prefix}.path_missing`);
    if (!text(artifact.artifactClass)) blockingReasons.push(`${prefix}.artifact_class_missing`);
    if (!SHA256_PATTERN.test(text(artifact.contentHash)))
      blockingReasons.push(`${prefix}.content_hash_invalid`);
    if (
      !Array.isArray(artifact.boundIds) ||
      artifact.boundIds.map(text).filter(Boolean).length === 0
    ) {
      blockingReasons.push(`${prefix}.bound_ids_missing`);
    }
    if (!text(artifact.producerPacketId))
      blockingReasons.push(`${prefix}.producer_packet_id_missing`);
    if (artifact.authoritativeFor !== 'review_evidence') {
      blockingReasons.push(`${prefix}.authoritative_for_not_review_evidence`);
    }
    if (
      !isStoryFlow(manifest.flow) &&
      artifactUnderWorkProductPlane(artifactPath) &&
      !hasGovernedNonStoryRoot(artifactPath, governedRoot)
    ) {
      blockingReasons.push(`${prefix}.non_story_artifact_not_governed_orphan_root:${artifactPath}`);
    }
    if (isLooseLegacyOrphan(artifactPath, governedRoot)) {
      blockingReasons.push(`${prefix}.loose_legacy_orphan_blocks_closeout:${artifactPath}`);
    }
    if (input.projectRoot && artifactPath) {
      const absolute = path.join(input.projectRoot, artifactPath);
      if (fs.existsSync(absolute) && sha256File(absolute) !== artifact.contentHash) {
        blockingReasons.push(`${prefix}.content_hash_mismatch:${artifactPath}`);
      }
    }
    indexed.add(artifactPath);
  }

  for (const declared of input.declaredArtifactPaths ?? []) {
    const normalized = normalizePathForManifest(declared);
    if (artifactUnderWorkProductPlane(normalized) && !indexed.has(normalized)) {
      blockingReasons.push(`declared_artifact_not_indexed:${normalized}`);
    }
  }
  for (const commandProofArtifact of input.requiredCommandProofArtifactPaths ?? []) {
    const normalized = normalizePathForManifest(commandProofArtifact);
    if (indexed.has(normalized)) {
      blockingReasons.push(`artifact_index_only_cannot_satisfy_required_command:${normalized}`);
    }
  }
  if (input.closeoutReadinessPreviewCommandRefsUsedAsAuthority) {
    blockingReasons.push('closeout_readiness_preview_required_commands_not_runner_authority');
  }

  const manifestHash = sha256Stable({ ...manifest, manifestHash: undefined });
  if (manifest.manifestHash && manifest.manifestHash !== manifestHash) {
    blockingReasons.push('manifest_hash_mismatch');
  }
  return {
    ok: blockingReasons.length === 0,
    blockingReasons,
    manifestHash,
  };
}

export function writeSddArtifactManifest(filePath: string, manifest: SddArtifactManifest): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
}
