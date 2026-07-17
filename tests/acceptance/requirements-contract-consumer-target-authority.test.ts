import { describe, expect, it } from 'vitest';
import {
  artifacts,
  createMinimalConsumerRequirementDescriptor,
  createTempRoot,
  expectSourceHashUnchanged,
  issueCodes,
  readJson,
  removeTempRoot,
  runAuthoring,
  sha256File,
  writeMinimalConsumerRequirement,
  writeText,
} from './helpers/requirements-contract-authoring-fixture';

interface TargetAuthorityArtifact {
  decision: string;
  accepted: Array<{
    path: string;
    source: string;
    sourceSpan: { startLine: number; endLine: number } | null;
  }>;
  rejected: unknown[];
}

interface DraftConfirmationArtifact {
  implementationConfirmation: {
    targetModificationPaths: Array<{ path: string }>;
  };
}

describe('requirements contract consumer target authority', () => {
  it('uses explicit consumer target paths and never falls back to BMAD governance paths', () => {
    const root = createTempRoot('requirements-contract-explicit-targets-');
    try {
      const descriptors = [
        createMinimalConsumerRequirementDescriptor('consumer-target-authority-explicit-primary'),
        createMinimalConsumerRequirementDescriptor('consumer-target-authority-explicit-secondary'),
        createMinimalConsumerRequirementDescriptor('consumer-target-authority-explicit-tertiary'),
      ];
      const materialized = writeMinimalConsumerRequirement(
        root,
        'docs/requirements/explicit-targets.md',
        descriptors[0]
      );
      const targetPaths = descriptors.map((descriptor) => descriptor.target.path);
      for (const descriptor of descriptors.slice(1)) {
        writeText(root, descriptor.target.path, 'export {};\n');
      }

      runAuthoring(root, materialized.sourcePath, 'REQ-EXPLICIT-TARGETS', {
        ...materialized.authoringOptions,
        targetPath: targetPaths,
      });
      const paths = artifacts(root, 'REQ-EXPLICIT-TARGETS', 'REQ-EXPLICIT-TARGETS-SET');
      const targetReport = readJson<TargetAuthorityArtifact>(paths.targetAuthorityReport);
      const draft = readJson<DraftConfirmationArtifact>(
        paths.draftImplementationConfirmation
      ).implementationConfirmation;
      const acceptedTargetPaths = targetReport.accepted.map((row: any) => row.path);
      const projectedPaths = draft.targetModificationPaths.map((row: any) => row.path);

      expect(acceptedTargetPaths).toEqual(expect.arrayContaining(targetPaths));
      expect(projectedPaths.some((item: string) => item.includes('scripts/main-agent'))).toBe(
        false
      );
      expect(
        projectedPaths.some((item: string) => item.includes('tests/acceptance/main-agent'))
      ).toBe(false);
    } finally {
      removeTempRoot(root);
    }
  });

  it('derives target authority from source-declared consumer paths', () => {
    const root = createTempRoot('requirements-contract-source-targets-');
    try {
      const descriptor = createMinimalConsumerRequirementDescriptor(
        'consumer-target-authority-source-declared'
      );
      const materialized = writeMinimalConsumerRequirement(
        root,
        'docs/requirements/source-targets.md',
        descriptor
      );
      const { targetPath: sourceDeclaredTargetPath, ...authoringOptions } =
        materialized.authoringOptions;

      expect(sourceDeclaredTargetPath).toBe(descriptor.target.path);
      const result = runAuthoring(
        root,
        materialized.sourcePath,
        'REQ-SOURCE-TARGETS',
        authoringOptions
      );
      const paths = artifacts(root, 'REQ-SOURCE-TARGETS', 'REQ-SOURCE-TARGETS-SET');
      const targetReport = readJson<TargetAuthorityArtifact>(paths.targetAuthorityReport);
      const accepted = targetReport.accepted.map((row: any) => ({
        path: row.path,
        source: row.source,
        sourceSpan: row.sourceSpan,
      }));

      expect(issueCodes(result)).toContain('critical_auditor_provider_mode_required');
      expect(accepted).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: descriptor.target.path,
            source: 'source_document',
            sourceSpan: expect.objectContaining({ startLine: expect.any(Number) }),
          }),
        ])
      );
    } finally {
      removeTempRoot(root);
    }
  });

  it('fails closed before source mutation when target authority is missing', () => {
    const root = createTempRoot('requirements-contract-missing-targets-');
    try {
      const descriptor = createMinimalConsumerRequirementDescriptor(
        'consumer-target-authority-missing'
      );
      descriptor.target.path = 'target-authority-not-declared';
      const materialized = writeMinimalConsumerRequirement(
        root,
        'docs/requirements/no-target.md',
        descriptor
      );
      const { targetPath: omittedTargetPath, ...authoringOptions } = materialized.authoringOptions;
      const beforeHash = sha256File(materialized.sourcePath);

      const result = runAuthoring(
        root,
        materialized.sourcePath,
        'REQ-MISSING-TARGETS',
        authoringOptions
      );
      const paths = artifacts(root, 'REQ-MISSING-TARGETS', 'REQ-MISSING-TARGETS-SET');
      const targetReport = readJson<TargetAuthorityArtifact>(paths.targetAuthorityReport);
      const decision = readJson(paths.sourceMutationDecision);

      expect(omittedTargetPath).toBe(descriptor.target.path);
      expect(issueCodes(result)).toContain('target_authority_missing');
      expect(targetReport.decision).toBe('block');
      expect(decision.finalDecision).toBe('block_source_materialization');
      expect(decision.sourceMutationPerformed).toBe(false);
      expectSourceHashUnchanged(materialized.sourcePath, beforeHash);
    } finally {
      removeTempRoot(root);
    }
  });

  it('rejects an explicit relative target path without replacing valid source authority', () => {
    const root = createTempRoot('requirements-contract-outside-targets-');
    try {
      const descriptor = createMinimalConsumerRequirementDescriptor(
        'consumer-target-authority-outside-root'
      );
      const materialized = writeMinimalConsumerRequirement(
        root,
        'docs/requirements/outside-targets.md',
        descriptor
      );
      const beforeHash = sha256File(materialized.sourcePath);

      const result = runAuthoring(root, materialized.sourcePath, 'REQ-OUTSIDE-TARGETS', {
        ...materialized.authoringOptions,
        targetPath: '../outside_project.py',
      });
      const paths = artifacts(root, 'REQ-OUTSIDE-TARGETS', 'REQ-OUTSIDE-TARGETS-SET');
      const targetReport = readJson<TargetAuthorityArtifact>(paths.targetAuthorityReport);
      const decision = readJson(paths.sourceMutationDecision);

      expect(issueCodes(result)).not.toContain('target_authority_missing');
      expect(targetReport.decision).toBe('pass');
      expect(JSON.stringify(targetReport.rejected)).toContain('target_path_outside_project_root');
      expect(targetReport.accepted.map((row: any) => row.path)).not.toContain(
        '../outside_project.py'
      );
      expect(decision.finalDecision).toBe('block_source_materialization');
      expectSourceHashUnchanged(materialized.sourcePath, beforeHash);
    } finally {
      removeTempRoot(root);
    }
  });

  it('blocks consumer product projection to BMAD main-agent governance surfaces', () => {
    const root = createTempRoot('requirements-contract-domain-mismatch-');
    try {
      const descriptor = createMinimalConsumerRequirementDescriptor(
        'consumer-target-authority-domain-mismatch'
      );
      descriptor.target.path =
        'packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-orchestration.ts';
      const materialized = writeMinimalConsumerRequirement(
        root,
        'docs/requirements/domain-mismatch.md',
        descriptor
      );
      const {
        targetPath: sourceDeclaredTargetPath,
        requiredCommand: sourceDeclaredRequiredCommand,
        ...authoringOptions
      } = materialized.authoringOptions;
      const beforeHash = sha256File(materialized.sourcePath);

      const result = runAuthoring(
        root,
        materialized.sourcePath,
        'REQ-DOMAIN-MISMATCH',
        authoringOptions
      );
      const paths = artifacts(root, 'REQ-DOMAIN-MISMATCH', 'REQ-DOMAIN-MISMATCH-SET');
      const sanity = readJson(paths.projectionDomainSanityReport);
      const decision = readJson(paths.sourceMutationDecision);

      expect(sourceDeclaredTargetPath).toBe(descriptor.target.path);
      expect(sourceDeclaredRequiredCommand).toBe(descriptor.verification.requiredCommand);
      expect(issueCodes(result)).toContain('projection_domain_mismatch');
      expect(sanity.decision).toBe('block');
      expect(sanity.offendingTargets).toContain(descriptor.target.path);
      expect(decision.finalDecision).toBe('block_source_materialization');
      expectSourceHashUnchanged(materialized.sourcePath, beforeHash);
    } finally {
      removeTempRoot(root);
    }
  });
});
