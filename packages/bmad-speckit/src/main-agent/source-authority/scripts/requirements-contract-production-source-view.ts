import {
  readRequirementsContentObject,
  type RequirementsContentRef,
} from './requirements-contract-content-store';
import { sha256Text } from './requirements-contract-semantic-resolver';
import { sliceAndHashSourceRange } from './requirements-contract-utf8-source-index';

export interface ProductionSourceRange {
  startUtf8Byte: number;
  endUtf8ByteExclusive: number;
  startLine: number;
  endLine: number;
  contentHash: string;
}

export interface ProductionSourceArtifactBinding {
  sourceArtifactRef: string;
  byteStart: number;
  byteEnd: number;
  [key: string]: unknown;
}

export interface ProductionSourceArtifactDescriptor {
  artifactId: string;
  path: string;
  bytes: number;
  sha256: string;
}

export interface ProductionSourceBackedValue {
  sourceContent?: string;
  sourceBlobRef?: RequirementsContentRef;
  sourceRange?: ProductionSourceRange;
  sourceBinding?: ProductionSourceArtifactBinding;
  sourceArtifact?: ProductionSourceArtifactDescriptor;
  bundlePath?: string;
}

export interface ProductionSourceArtifactView {
  artifact: ProductionSourceArtifactDescriptor;
  bytes: Buffer;
}

export function productionSourceDocumentHash(value: ProductionSourceBackedValue): string {
  if (value.sourceBlobRef) return value.sourceBlobRef.contentHash;
  if (value.sourceArtifact) return `sha256:${value.sourceArtifact.sha256}`;
  if (typeof value.sourceContent === 'string') return sha256Text(value.sourceContent);
  throw new Error('requirements_production_source_backing_missing');
}

export function compactProductionSourceBacking(
  value: ProductionSourceBackedValue
): ProductionSourceBackedValue {
  if (value.sourceBlobRef && value.sourceRange) {
    return { sourceBlobRef: value.sourceBlobRef, sourceRange: value.sourceRange };
  }
  if (value.sourceArtifact && value.sourceBinding) {
    return {
      sourceArtifact: value.sourceArtifact,
      sourceBinding: value.sourceBinding,
      ...(value.bundlePath ? { bundlePath: value.bundlePath } : {}),
    };
  }
  if (typeof value.sourceContent === 'string') return { sourceContent: value.sourceContent };
  throw new Error('requirements_production_source_backing_missing');
}

export function resolveProductionSourceContent(input: {
  value: ProductionSourceBackedValue;
  recordRoot?: string;
  artifactViews?: readonly ProductionSourceArtifactView[];
  byteCache?: Map<string, Buffer>;
}): string {
  if (input.value.sourceBlobRef) {
    if (!input.recordRoot || !input.value.sourceRange) {
      throw new Error('requirements_production_source_blob_context_missing');
    }
    const key = input.value.sourceBlobRef.contentHash;
    let bytes = input.byteCache?.get(key);
    if (!bytes) {
      bytes = readRequirementsContentObject({
        recordRoot: input.recordRoot,
        ref: input.value.sourceBlobRef,
      });
      input.byteCache?.set(key, bytes);
    }
    if (sliceAndHashSourceRange(bytes, input.value.sourceRange) !== input.value.sourceRange.contentHash) {
      throw new Error('requirements_production_source_range_hash_mismatch');
    }
    const rangeBytes = bytes.subarray(
      input.value.sourceRange.startUtf8Byte,
      input.value.sourceRange.endUtf8ByteExclusive
    );
    return new TextDecoder('utf-8', { fatal: true }).decode(rangeBytes);
  }
  if (input.value.sourceArtifact && input.value.sourceBinding) {
    const view = input.artifactViews?.find(
      (candidate) => candidate.artifact.artifactId === input.value.sourceArtifact!.artifactId
    );
    if (
      !view ||
      view.artifact.sha256 !== input.value.sourceArtifact.sha256 ||
      sha256Text(view.bytes.toString('utf8')) !== `sha256:${view.artifact.sha256}`
    ) {
      throw new Error('requirements_production_source_artifact_view_missing');
    }
    return new TextDecoder('utf-8', { fatal: true }).decode(view.bytes);
  }
  if (typeof input.value.sourceContent === 'string') return input.value.sourceContent;
  throw new Error('requirements_production_source_backing_missing');
}

export function resolveProductionSourceDocument(input: {
  value: ProductionSourceBackedValue;
  recordRoot?: string;
  artifactViews?: readonly ProductionSourceArtifactView[];
  byteCache?: Map<string, Buffer>;
}): string {
  if (input.value.sourceBlobRef) {
    if (!input.recordRoot) throw new Error('requirements_production_source_blob_context_missing');
    const key = input.value.sourceBlobRef.contentHash;
    let bytes = input.byteCache?.get(key);
    if (!bytes) {
      bytes = readRequirementsContentObject({ recordRoot: input.recordRoot, ref: input.value.sourceBlobRef });
      input.byteCache?.set(key, bytes);
    }
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  }
  return resolveProductionSourceContent(input);
}
