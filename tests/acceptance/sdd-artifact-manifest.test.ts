import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  artifactRefFromFile,
  createSddArtifactManifest,
  governedNonStorySddRoot,
  validateSddArtifactManifest,
} from '../../scripts/sdd-artifact-manifest';

describe('SDD artifact manifest contract', () => {
  it('requires manifest identity, review authority, hashes, bound ids, and packet producer', () => {
    const manifest = createSddArtifactManifest({
      recordId: 'REQ-SDD',
      flow: 'standalone_tasks',
      packetId: 'implement-001',
      runtimeTraceExecutionDir:
        '_bmad-output/runtime/requirement-records/REQ-SDD/trace-execution/implement-001',
      artifacts: [
        {
          path: '_bmad-output/implementation-artifacts/_orphan/REQ-SDD/standalone_tasks/implement-001/progress.md',
          artifactClass: 'progress_log',
          contentHash: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          boundIds: ['TRACE-001', 'MUST-001'],
          producerPacketId: 'implement-001',
          authoritativeFor: 'review_evidence',
        },
      ],
    });

    const validation = validateSddArtifactManifest({ manifest });
    expect(validation.ok).toBe(true);
    expect(manifest.workProductRoot.implementationArtifactsRoot).toBe(
      '_bmad-output/implementation-artifacts/_orphan/REQ-SDD/standalone_tasks/implement-001'
    );
    expect(manifest.controls).toMatchObject({
      artifactIndexedIsCommandProof: false,
      closeoutReadinessPreviewRequiredCommandsAuthority: 'non_authoritative_preview_only',
    });
  });

  it('blocks unindexed implementation-artifacts and specs declarations', () => {
    const manifest = createSddArtifactManifest({
      recordId: 'REQ-SDD',
      flow: 'standalone_tasks',
      packetId: 'implement-001',
      runtimeTraceExecutionDir:
        '_bmad-output/runtime/requirement-records/REQ-SDD/trace-execution/implement-001',
      artifacts: [],
    });

    const validation = validateSddArtifactManifest({
      manifest,
      declaredArtifactPaths: [
        '_bmad-output/implementation-artifacts/_orphan/REQ-SDD/standalone_tasks/implement-001/progress.md',
        'specs/_orphan/REQ-SDD/standalone_tasks/implement-001/tasks.md',
      ],
    });
    expect(validation.ok).toBe(false);
    expect(validation.blockingReasons).toEqual(
      expect.arrayContaining([
        'declared_artifact_not_indexed:_bmad-output/implementation-artifacts/_orphan/REQ-SDD/standalone_tasks/implement-001/progress.md',
        'declared_artifact_not_indexed:specs/_orphan/REQ-SDD/standalone_tasks/implement-001/tasks.md',
      ])
    );
  });

  it('blocks loose legacy orphan artifacts until re-homed or excluded', () => {
    const manifest = createSddArtifactManifest({
      recordId: 'REQ-SDD',
      flow: 'bugfix',
      packetId: 'implement-001',
      runtimeTraceExecutionDir:
        '_bmad-output/runtime/requirement-records/REQ-SDD/trace-execution/implement-001',
      artifacts: [
        {
          path: '_bmad-output/implementation-artifacts/_orphan/progress.md',
          artifactClass: 'progress_log',
          contentHash: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          boundIds: ['TRACE-001'],
          producerPacketId: 'implement-001',
          authoritativeFor: 'review_evidence',
        },
      ],
    });

    const validation = validateSddArtifactManifest({ manifest });
    expect(validation.ok).toBe(false);
    expect(validation.blockingReasons.join('\n')).toContain('loose_legacy_orphan_blocks_closeout');
    expect(validation.blockingReasons.join('\n')).toContain('non_story_artifact_not_governed_orphan_root');
  });

  it('keeps artifact indexing separate from command proof and preview command authority', () => {
    const manifest = createSddArtifactManifest({
      recordId: 'REQ-SDD',
      flow: 'standalone_tasks',
      packetId: 'implement-001',
      runtimeTraceExecutionDir:
        '_bmad-output/runtime/requirement-records/REQ-SDD/trace-execution/implement-001',
      artifacts: [
        {
          path: '_bmad-output/implementation-artifacts/_orphan/REQ-SDD/standalone_tasks/implement-001/progress.md',
          artifactClass: 'progress_log',
          contentHash: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          boundIds: ['TRACE-001'],
          producerPacketId: 'implement-001',
          authoritativeFor: 'review_evidence',
        },
      ],
    });

    const validation = validateSddArtifactManifest({
      manifest,
      requiredCommandProofArtifactPaths: [
        '_bmad-output/implementation-artifacts/_orphan/REQ-SDD/standalone_tasks/implement-001/progress.md',
      ],
      closeoutReadinessPreviewCommandRefsUsedAsAuthority: true,
    });
    expect(validation.ok).toBe(false);
    expect(validation.blockingReasons).toEqual(
      expect.arrayContaining([
        'artifact_index_only_cannot_satisfy_required_command:_bmad-output/implementation-artifacts/_orphan/REQ-SDD/standalone_tasks/implement-001/progress.md',
        'closeout_readiness_preview_required_commands_not_runner_authority',
      ])
    );
  });

  it('computes file artifact hashes and governed non-story root deterministically', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'sdd-manifest-'));
    try {
      const governedRoot = governedNonStorySddRoot({
        recordId: 'REQ-SDD',
        flow: 'standalone_tasks',
        packetId: 'implement-001',
      });
      const artifactPath = `_bmad-output/implementation-artifacts/${governedRoot}/progress.md`;
      mkdirSync(path.dirname(path.join(root, artifactPath)), { recursive: true });
      writeFileSync(path.join(root, artifactPath), 'progress\n', 'utf8');
      const artifact = artifactRefFromFile({
        projectRoot: root,
        artifactPath,
        artifactClass: 'progress_log',
        boundIds: ['TRACE-001'],
        producerPacketId: 'implement-001',
      });
      const manifest = createSddArtifactManifest({
        recordId: 'REQ-SDD',
        flow: 'standalone_tasks',
        packetId: 'implement-001',
        runtimeTraceExecutionDir:
          '_bmad-output/runtime/requirement-records/REQ-SDD/trace-execution/implement-001',
        artifacts: [artifact],
      });

      const validation = validateSddArtifactManifest({ manifest, projectRoot: root });
      expect(validation.ok).toBe(true);
      expect(artifact.contentHash).toMatch(/^sha256:[a-f0-9]{64}$/u);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
