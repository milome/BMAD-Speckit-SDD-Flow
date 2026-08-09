import { readFileSync } from 'node:fs';
import path from 'node:path';
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

type ProjectKind = 'consumer_product' | 'governance_framework' | 'hybrid';

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

function declareProjectProfile(input: {
  root: string;
  sourcePath: string;
  projectKind: ProjectKind;
  authoritySeed: string;
  owningSystem: string;
}): { authorityPath: string } {
  const authorityFileName = `${input.authoritySeed.replace(/[^a-z0-9-]+/giu, '-')}.json`;
  const authorityRef = path.posix.join('authority', authorityFileName);
  const authorityPath = writeText(
    input.root,
    authorityRef,
    `${JSON.stringify(
      {
        schemaVersion: 'registered-architecture-record/v1',
        projectKind: input.projectKind,
        owningSystem: input.owningSystem,
      },
      null,
      2
    )}\n`
  );
  const diagramPolicyPath = writeText(
    input.root,
    path.posix.join('authority', `${authorityFileName}.diagram-policy.json`),
    `${JSON.stringify({ sequenceFirst: true, projectKind: input.projectKind })}\n`
  );
  const sourceRelativePath = path.relative(input.root, input.sourcePath);
  const sourceText = readFileSync(input.sourcePath, 'utf8');
  writeText(
    input.root,
    sourceRelativePath,
    [
      'projectProfile:',
      '  schemaVersion: requirements-contract-project-profile/v1',
      `  projectKind: ${input.projectKind}`,
      `  owningSystem: ${input.owningSystem}`,
      `  governanceFramework: ${input.authoritySeed}`,
      '  classificationAuthority:',
      '    kind: registered_architecture_record',
      `    ref: ${authorityRef}`,
      `    hash: ${sha256File(authorityPath)}`,
      `  diagramPolicyRegistryHash: ${sha256File(diagramPolicyPath)}`,
      '',
      sourceText,
    ].join('\n')
  );
  return { authorityPath };
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
  }, 60_000);

  it(
    'derives target authority from source-declared consumer paths',
    { timeout: 60_000 },
    () => {
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
    }
  );

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
      declareProjectProfile({
        root,
        sourcePath: materialized.sourcePath,
        projectKind: 'consumer_product',
        authoritySeed: descriptor.refs.pathId,
        owningSystem: descriptor.target.owner,
      });
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

  it('uses a valid governance profile instead of consumer keywords for projection authority', () => {
    const root = createTempRoot('requirements-contract-governance-profile-');
    try {
      const descriptor = createMinimalConsumerRequirementDescriptor(
        'consumer-target-authority-governance-profile'
      );
      descriptor.target.path =
        'packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-orchestration.ts';
      const materialized = writeMinimalConsumerRequirement(
        root,
        'docs/requirements/governance-profile.md',
        descriptor
      );
      declareProjectProfile({
        root,
        sourcePath: materialized.sourcePath,
        projectKind: 'governance_framework',
        authoritySeed: descriptor.refs.pathId,
        owningSystem: descriptor.target.owner,
      });
      const { targetPath: sourceDeclaredTargetPath, ...authoringOptions } =
        materialized.authoringOptions;

      const result = runAuthoring(
        root,
        materialized.sourcePath,
        'REQ-GOVERNANCE-PROFILE',
        authoringOptions
      );
      const sanity = readJson(artifacts(root, 'REQ-GOVERNANCE-PROFILE').projectionDomainSanityReport);

      expect(sourceDeclaredTargetPath).toBe(descriptor.target.path);
      expect(issueCodes(result)).not.toContain('projection_domain_mismatch');
      expect(sanity).toMatchObject({
        decision: 'pass',
        projectProfileDeclared: true,
        projectKind: 'governance_framework',
      });
    } finally {
      removeTempRoot(root);
    }
  });

  it('fails closed when the declared classification authority bytes no longer match its hash', () => {
    const root = createTempRoot('requirements-contract-project-profile-tamper-');
    try {
      const descriptor = createMinimalConsumerRequirementDescriptor(
        'consumer-target-authority-profile-tamper'
      );
      descriptor.target.path =
        'packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-orchestration.ts';
      const materialized = writeMinimalConsumerRequirement(
        root,
        'docs/requirements/project-profile-tamper.md',
        descriptor
      );
      const { authorityPath } = declareProjectProfile({
        root,
        sourcePath: materialized.sourcePath,
        projectKind: 'governance_framework',
        authoritySeed: descriptor.refs.pathId,
        owningSystem: descriptor.target.owner,
      });
      writeText(
        root,
        path.relative(root, authorityPath),
        `${JSON.stringify({ tampered: true, authoritySeed: descriptor.refs.pathId })}\n`
      );
      const { targetPath: sourceDeclaredTargetPath, ...authoringOptions } =
        materialized.authoringOptions;
      const beforeHash = sha256File(materialized.sourcePath);

      const result = runAuthoring(
        root,
        materialized.sourcePath,
        'REQ-PROJECT-PROFILE-TAMPER',
        authoringOptions
      );
      const paths = artifacts(root, 'REQ-PROJECT-PROFILE-TAMPER');
      const sanity = readJson(paths.projectionDomainSanityReport);

      expect(sourceDeclaredTargetPath).toBe(descriptor.target.path);
      expect(issueCodes(result)).toContain('project_profile_authority_hash_mismatch');
      expect(sanity.decision).toBe('block');
      expectSourceHashUnchanged(materialized.sourcePath, beforeHash);
    } finally {
      removeTempRoot(root);
    }
  });
});
