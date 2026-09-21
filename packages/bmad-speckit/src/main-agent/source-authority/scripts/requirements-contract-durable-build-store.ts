import { existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, renameSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { writeJsonAtomic } from './requirement-record-control-store';
import {
  validateRequirementsContractBuildManifestV2,
  type RequirementsContractBuildManifestV2,
} from './requirements-contract-authoring-manifest';
import { verifyRequirementsContentRef } from './requirements-contract-content-store';
import { acquireRequirementsFileLock, releaseRequirementsFileLock } from './requirements-contract-file-lock';
import { canonicalRequirementsJson, requirementsContractDomainHash } from './requirements-contract-hash-domains';
import {
  validateRequirementsActiveAuthorityTuple,
  type RequirementsActiveAuthorityTupleV2,
} from './requirements-contract-authority-publication-committer';
import { resolveRequirementsAuthoringArtifact } from './requirements-contract-artifact-resolver';

const SHA256 = /^sha256:[a-f0-9]{64}$/u;
const SAFE_OPERATION_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u;

function assertSafeRecordPath(recordRoot: string, relativePath: string, code: string): string {
  const realRoot = realpathSync.native(path.resolve(recordRoot));
  const target = path.resolve(realRoot, ...relativePath.split('/'));
  const relative = path.relative(realRoot, target);
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error(code);
  let cursor = realRoot;
  for (const segment of relative.split(path.sep)) {
    if (!segment) continue;
    cursor = path.join(cursor, segment);
    if (!existsSync(cursor)) continue;
    const stat = lstatSync(cursor);
    if (stat.isSymbolicLink()) throw new Error(code);
    const realCursor = realpathSync.native(cursor);
    const realRelative = path.relative(realRoot, realCursor);
    if (realRelative.startsWith('..') || path.isAbsolute(realRelative)) throw new Error(code);
  }
  return target;
}

export function deriveRequirementsContractActiveAuthority(input: {
  manifest: RequirementsContractBuildManifestV2;
  semanticRevisionId: string;
  bindingRevisionId: string;
  authoringAttemptId?: string;
  currentAuthority?: RequirementsActiveAuthorityTupleV2 | null;
}): RequirementsActiveAuthorityTupleV2 {
  if (input.currentAuthority?.activeBuildHash === input.manifest.buildHash) {
    return input.currentAuthority;
  }
  const semanticEntry = input.manifest.artifactEntries.find((entry) => entry.role === 'semantic_ir');
  const bindingEntry = input.manifest.artifactEntries.find((entry) => entry.role === 'source_binding');
  return {
    activeSemanticRevisionId: input.semanticRevisionId,
    activeScopeSemanticHash: input.manifest.scopeSemanticHash,
    activeBindingRevisionId: input.bindingRevisionId,
    activeSourceBindingHash: input.manifest.sourceBindingHash,
    activeBuildHash: input.manifest.buildHash,
    activeBuildManifestPath:
      `authoring/builds/${input.manifest.buildHash.slice('sha256:'.length)}/manifest.json`,
    previousBuildHash: input.currentAuthority?.activeBuildHash ?? null,
    previousBuildManifestPath: input.currentAuthority?.activeBuildManifestPath ?? null,
    ...(semanticEntry ? { activeSemanticIrPath: semanticEntry.contentRef.recordRelativePath } : {}),
    ...(bindingEntry ? { activeSourceBindingPath: bindingEntry.contentRef.recordRelativePath } : {}),
    ...(input.authoringAttemptId ? { activeAuthoringAttemptId: input.authoringAttemptId } : {}),
    activeBuildManifestHash: input.manifest.buildHash,
  };
}

export function publishRequirementsContractDurableBuild(input: {
  recordRoot: string;
  operationId: string;
  manifest: RequirementsContractBuildManifestV2;
  nextAuthority: RequirementsActiveAuthorityTupleV2;
  currentAuthority?: RequirementsActiveAuthorityTupleV2 | Record<string, unknown> | null;
  compareAndSwapAuthorityTuple?: (
    current: RequirementsActiveAuthorityTupleV2 | Record<string, unknown> | null,
    next: RequirementsActiveAuthorityTupleV2
  ) => boolean;
  expectedActiveAuthorityHash: string;
  failurePoint?: 'before_build_rename' | 'after_build_rename_before_authority_cas' | 'after_authority_cas';
}): { buildHash: string; manifestPath: string; reused: boolean } {
  if (!SAFE_OPERATION_ID.test(input.operationId)) throw new Error('requirements_durable_build_operation_id_invalid');
  if (!validateRequirementsContractBuildManifestV2(input.manifest)) {
    throw new Error('requirements_durable_build_manifest_invalid');
  }
  if (!SHA256.test(input.expectedActiveAuthorityHash)) {
    throw new Error('requirements_durable_build_authority_hash_invalid');
  }
  const authorityValidation = validateRequirementsActiveAuthorityTuple(input.nextAuthority);
  if (authorityValidation.decision === 'block') throw new Error(authorityValidation.issueCodes[0]);
  const buildHash = input.manifest.buildHash;
  const relativeManifestPath = `authoring/builds/${buildHash.slice('sha256:'.length)}/manifest.json`;
  const manifestPath = assertSafeRecordPath(input.recordRoot, relativeManifestPath, 'requirements_durable_build_path_invalid');
  if (
    input.nextAuthority.activeBuildHash !== buildHash ||
    input.nextAuthority.activeBuildManifestPath !== relativeManifestPath ||
    input.nextAuthority.activeScopeSemanticHash !== input.manifest.scopeSemanticHash ||
    input.nextAuthority.activeSourceBindingHash !== input.manifest.sourceBindingHash
  ) throw new Error('requirements_durable_build_authority_manifest_mismatch');
  const buildDir = path.dirname(manifestPath);
  const hadDurableBuild = existsSync(manifestPath);
  if (hadDurableBuild) {
    const existing = JSON.parse(readFileSync(manifestPath, 'utf8')) as RequirementsContractBuildManifestV2;
    if (
      existing.buildHash !== buildHash ||
      !validateRequirementsContractBuildManifestV2(existing) ||
      canonicalRequirementsJson(existing) !== canonicalRequirementsJson(input.manifest)
    ) throw new Error('requirements_durable_build_hash_mismatch');
    for (const entry of existing.artifactEntries) {
      verifyRequirementsContentRef({ recordRoot: input.recordRoot, ref: entry.contentRef });
    }
  } else if (existsSync(buildDir)) {
    throw new Error('requirements_durable_build_partial_exists');
  }
  const stagingDir = path.join(input.recordRoot, 'authoring', '.staging', input.operationId);
  assertSafeRecordPath(input.recordRoot, `authoring/.staging/${input.operationId}`, 'requirements_durable_build_path_invalid');
  mkdirSync(stagingDir, { recursive: true });
  const stagedManifest = path.join(stagingDir, 'manifest.json');
  writeJsonAtomic(stagedManifest, input.manifest);
  const stagedReadback = JSON.parse(readFileSync(stagedManifest, 'utf8')) as RequirementsContractBuildManifestV2;
  if (canonicalRequirementsJson(stagedReadback) !== canonicalRequirementsJson(input.manifest)) {
    throw new Error('requirements_durable_build_staged_readback_mismatch');
  }
  for (const entry of input.manifest.artifactEntries) {
    verifyRequirementsContentRef({ recordRoot: input.recordRoot, ref: entry.contentRef });
    resolveRequirementsAuthoringArtifact({ recordRoot: input.recordRoot, entry });
  }
  if (input.failurePoint === 'before_build_rename') throw new Error('requirements_durable_build_injected_failure');
  mkdirSync(path.dirname(buildDir), { recursive: true });
  if (!existsSync(buildDir)) renameSync(stagingDir, buildDir);
  else if (!existsSync(manifestPath)) throw new Error('requirements_durable_build_partial_exists');
  if (input.failurePoint === 'after_build_rename_before_authority_cas') {
    throw new Error('requirements_durable_build_injected_failure');
  }
  const authorityPath = input.compareAndSwapAuthorityTuple
    ? path.join(input.recordRoot, 'record', 'requirement-record.json')
    : path.join(input.recordRoot, 'authoring', 'active-authority.json');
  const lockPath = input.compareAndSwapAuthorityTuple
    ? `${authorityPath}.authority.lock`
    : `${authorityPath}.lock`;
  const lock = acquireRequirementsFileLock({ lockPath, busyCode: 'requirements_durable_build_authority_busy' });
  try {
    mkdirSync(path.dirname(authorityPath), { recursive: true });
    const current = input.compareAndSwapAuthorityTuple
      ? ''
      : existsSync(authorityPath) ? readFileSync(authorityPath, 'utf8') : '';
    const currentHash = input.compareAndSwapAuthorityTuple
      ? (input.currentAuthority
          ? requirementsContractDomainHash('requirements-active-authority-cas/v1', input.currentAuthority)
          : `sha256:${'0'.repeat(64)}`)
      : current ? `sha256:${createHash('sha256').update(current, 'utf8').digest('hex')}` : `sha256:${'0'.repeat(64)}`;
    const currentAuthority = input.compareAndSwapAuthorityTuple
      ? input.currentAuthority ?? null
      : current ? JSON.parse(current) as Record<string, unknown> : null;
    if (currentAuthority?.activeBuildHash) {
      const currentValidation = validateRequirementsActiveAuthorityTuple(currentAuthority);
      if (currentValidation.decision === 'block') throw new Error(currentValidation.issueCodes[0]);
    }
    if ((!currentAuthority || !currentAuthority.activeBuildHash) &&
        (input.nextAuthority.previousBuildHash !== null || input.nextAuthority.previousBuildManifestPath !== null)) {
      throw new Error('requirements_durable_build_predecessor_invalid');
    }
    if (currentAuthority?.activeBuildHash && currentAuthority.activeBuildHash !== buildHash &&
        (input.nextAuthority.previousBuildHash !== currentAuthority.activeBuildHash ||
         input.nextAuthority.previousBuildManifestPath !== currentAuthority.activeBuildManifestPath)) {
      throw new Error('requirements_durable_build_predecessor_invalid');
    }
    if (currentAuthority?.activeBuildHash === buildHash &&
        canonicalRequirementsJson(currentAuthority) !== canonicalRequirementsJson(input.nextAuthority)) {
      throw new Error('requirements_durable_build_authority_path_mismatch');
    }
    if (currentHash !== input.expectedActiveAuthorityHash && currentAuthority?.activeBuildHash !== buildHash) {
      throw new Error('requirements_durable_build_authority_cas_mismatch');
    }
    if (currentAuthority?.activeBuildHash !== buildHash) {
      if (input.compareAndSwapAuthorityTuple) {
        if (!input.compareAndSwapAuthorityTuple(input.currentAuthority ?? null, input.nextAuthority)) {
          throw new Error('requirements_durable_build_authority_cas_mismatch');
        }
      } else {
        writeJsonAtomic(authorityPath, input.nextAuthority);
      }
    }
  } finally {
    releaseRequirementsFileLock(lock);
  }
  if (input.failurePoint === 'after_authority_cas') throw new Error('requirements_durable_build_injected_failure');
  rmSync(stagingDir, { recursive: true, force: true });
  return { buildHash, manifestPath: relativeManifestPath, reused: hadDurableBuild };
}
