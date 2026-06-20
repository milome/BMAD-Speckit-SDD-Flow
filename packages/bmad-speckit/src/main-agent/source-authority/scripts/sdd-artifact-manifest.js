"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.governedNonStorySddRoot = governedNonStorySddRoot;
exports.defaultSddArtifactManifestPath = defaultSddArtifactManifestPath;
exports.createSddArtifactManifest = createSddArtifactManifest;
exports.artifactRefFromFile = artifactRefFromFile;
exports.validateSddArtifactManifest = validateSddArtifactManifest;
exports.writeSddArtifactManifest = writeSddArtifactManifest;
const crypto = __importStar(require("node:crypto"));
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const SHA256_PATTERN = /^sha256:[a-f0-9]{64}$/u;
function stableStringify(value) {
    if (value === null || typeof value !== 'object')
        return JSON.stringify(value);
    if (Array.isArray(value))
        return `[${value.map((item) => stableStringify(item)).join(',')}]`;
    const objectValue = value;
    return `{${Object.keys(objectValue)
        .sort()
        .map((key) => `${JSON.stringify(key)}:${stableStringify(objectValue[key])}`)
        .join(',')}}`;
}
function sha256Stable(value) {
    return `sha256:${crypto.createHash('sha256').update(stableStringify(value), 'utf8').digest('hex')}`;
}
function sha256File(filePath) {
    return `sha256:${crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex')}`;
}
function text(value) {
    return typeof value === 'string' ? value.trim() : '';
}
function normalizePathForManifest(value) {
    return value.replace(/\\/gu, '/').replace(/^\/+/u, '');
}
function isStoryFlow(flow) {
    return flow === 'story';
}
function governedNonStorySddRoot(input) {
    return `_orphan/${input.recordId}/${input.flow}/${input.packetId}`;
}
function defaultSddArtifactManifestPath(input) {
    return path.join(input.runtimeTraceExecutionDir, 'sdd-artifact-manifest.json');
}
function createSddArtifactManifest(input) {
    const manifest = {
        schemaVersion: 'sdd-artifact-manifest/v1',
        recordId: input.recordId,
        flow: input.flow,
        packetId: input.packetId,
        runtimeTraceExecutionDir: normalizePathForManifest(input.runtimeTraceExecutionDir),
        workProductRoot: {
            implementationArtifactsRoot: normalizePathForManifest(`_bmad-output/implementation-artifacts/${governedNonStorySddRoot(input)}`),
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
function artifactRefFromFile(input) {
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
function artifactUnderWorkProductPlane(artifactPath) {
    const normalized = normalizePathForManifest(artifactPath);
    return (normalized.startsWith('_bmad-output/implementation-artifacts/') ||
        normalized.startsWith('specs/'));
}
function isLooseLegacyOrphan(artifactPath, governedRoot) {
    const normalized = normalizePathForManifest(artifactPath);
    const governedRootWithOrphan = governedRoot.startsWith('_orphan/')
        ? governedRoot
        : `_orphan/${governedRoot}`;
    if (!normalized.includes('/_orphan/') && !normalized.startsWith('_orphan/'))
        return false;
    return (!normalized.includes(`/${governedRootWithOrphan}/`) &&
        !normalized.startsWith(`${governedRootWithOrphan}/`));
}
function hasGovernedNonStoryRoot(artifactPath, governedRoot) {
    const normalized = normalizePathForManifest(artifactPath);
    return (normalized.startsWith(`_bmad-output/implementation-artifacts/${governedRoot}/`) ||
        normalized.startsWith(`specs/${governedRoot}/`));
}
function validateSddArtifactManifest(input) {
    const manifest = input.manifest;
    const blockingReasons = [];
    if (manifest.schemaVersion !== 'sdd-artifact-manifest/v1')
        blockingReasons.push('schema_version_invalid');
    for (const field of ['recordId', 'flow', 'packetId', 'runtimeTraceExecutionDir']) {
        if (!text(manifest[field]))
            blockingReasons.push(`${field}_missing`);
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
    if (manifest.controls?.closeoutReadinessPreviewRequiredCommandsAuthority !==
        'non_authoritative_preview_only') {
        blockingReasons.push('closeout_readiness_preview_authority_invalid');
    }
    const indexed = new Set();
    const governedRoot = manifest.artifactRootPolicy?.governedNonStoryRoot ?? '';
    for (const [index, artifact] of (manifest.artifacts ?? []).entries()) {
        const prefix = `artifacts[${index}]`;
        const artifactPath = normalizePathForManifest(artifact.path);
        if (!artifactPath)
            blockingReasons.push(`${prefix}.path_missing`);
        if (!text(artifact.artifactClass))
            blockingReasons.push(`${prefix}.artifact_class_missing`);
        if (!SHA256_PATTERN.test(text(artifact.contentHash)))
            blockingReasons.push(`${prefix}.content_hash_invalid`);
        if (!Array.isArray(artifact.boundIds) ||
            artifact.boundIds.map(text).filter(Boolean).length === 0) {
            blockingReasons.push(`${prefix}.bound_ids_missing`);
        }
        if (!text(artifact.producerPacketId))
            blockingReasons.push(`${prefix}.producer_packet_id_missing`);
        if (artifact.authoritativeFor !== 'review_evidence') {
            blockingReasons.push(`${prefix}.authoritative_for_not_review_evidence`);
        }
        if (!isStoryFlow(manifest.flow) &&
            artifactUnderWorkProductPlane(artifactPath) &&
            !hasGovernedNonStoryRoot(artifactPath, governedRoot)) {
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
function writeSddArtifactManifest(filePath, manifest) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
}
