import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  artifacts,
  cleanCriticalAuditorRound,
  createMinimalConsumerRequirementDescriptor,
  createSourceAuthorityProjectionDescriptor,
  createTempRoot,
  expectSourceHashUnchanged,
  issueCodes,
  readImplementationConfirmation,
  readJson,
  removeTempRoot,
  runAuthoring,
  sha256File,
  writeMinimalConsumerRequirement,
  writeSourceAuthorityProjection,
} from './helpers/requirements-contract-authoring-fixture';

interface DraftConfirmationArtifact {
  implementationConfirmation: {
    preConfirmationDrilldown: {
      criticalAuditor: {
        consecutiveNoNewGapRounds: number;
        convergenceVerdict: string;
      };
    };
  };
}

describe('requirements contract source mutation gate', () => {
  it('writes only diagnostic artifacts and leaves source unchanged when Critical Auditor provider is missing', () => {
    const root = createTempRoot('requirements-contract-missing-auditor-');
    try {
      const descriptor = createMinimalConsumerRequirementDescriptor(
        'source-mutation-missing-auditor'
      );
      const materialized = writeMinimalConsumerRequirement(
        root,
        'docs/requirements/missing-auditor.md',
        descriptor
      );
      const beforeHash = sha256File(materialized.sourcePath);

      const result = runAuthoring(
        root,
        materialized.sourcePath,
        'REQ-MISSING-AUDITOR',
        materialized.authoringOptions
      );
      const paths = artifacts(root, 'REQ-MISSING-AUDITOR', 'REQ-MISSING-AUDITOR-SET');
      const decision = readJson(paths.sourceMutationDecision);
      const draft = readJson<DraftConfirmationArtifact>(
        paths.draftImplementationConfirmation
      ).implementationConfirmation;

      expect(issueCodes(result)).toContain('critical_auditor_provider_mode_required');
      expect(decision.finalDecision).toBe('block_source_materialization');
      expect(decision.auditEvidenceDecision).toBe('block');
      expect(decision.sourceMutationPerformed).toBe(false);
      expect(draft.preConfirmationDrilldown.criticalAuditor.consecutiveNoNewGapRounds).toBe(0);
      expect(draft.preConfirmationDrilldown.criticalAuditor.convergenceVerdict).toBe(
        'audit_not_run'
      );
      expect(JSON.stringify(draft)).not.toContain('bounded_no_new_gap');
      expect(existsSync(paths.receipt1)).toBe(false);
      expectSourceHashUnchanged(materialized.sourcePath, beforeHash);
    } finally {
      removeTempRoot(root);
    }
  });

  it('automatically persists checkpoint evidence before guarded source promotion', () => {
    const root = createTempRoot('requirements-contract-checkpoint-mutation-');
    try {
      const descriptor = createSourceAuthorityProjectionDescriptor(
        'source-mutation-checkpoint-required',
        { negativeCount: 1, sourcePath: 'docs/requirements/checkpoint-required.md' }
      );
      const materialized = writeSourceAuthorityProjection(root, descriptor);
      const { confirmationLanguage: omittedLanguage, ...authoringOptions } =
        materialized.authoringOptions;
      const beforeHash = sha256File(materialized.sourcePath);

      const result = runAuthoring(root, materialized.sourcePath, 'REQ-CHECKPOINT-MUTATION', {
        ...authoringOptions,
        criticalAuditorRound: cleanCriticalAuditorRound,
      });
      const paths = artifacts(root, 'REQ-CHECKPOINT-MUTATION', 'REQ-CHECKPOINT-MUTATION-SET');
      const decision = readJson(paths.sourceMutationDecision);
      const route = readJson(paths.scaleRoutingDecision);
      const checkpointEvidence = readJson(paths.checkpointPersistenceEvidence);
      const promotionReceipt = readJson(paths.promotionReceipt);

      expect(omittedLanguage).toBe(descriptor.language);
      expect(issueCodes(result)).toContain('language_required_before_render');
      expect(issueCodes(result)).not.toContain('checkpoint_required_before_source_materialization');
      expect(route.decision).toBe('single_pass_final_allowed');
      expect(route.checkpointPersistenceSatisfied).toBe(true);
      expect(checkpointEvidence.checkpointPersistenceSatisfiedCandidate).toBe(true);
      expect(decision.finalDecision).toBe('allow_source_materialization');
      expect(decision.sourceMutationPerformed).toBe(false);
      expect(promotionReceipt).toMatchObject({
        ok: true,
        promotionStage: 'authoring-draft',
        safePromotionAsDraft: true,
      });
      expect(existsSync(paths.sourceMaterializationReceipt)).toBe(false);
      expect(sha256File(materialized.sourcePath)).not.toBe(beforeHash);
    } finally {
      removeTempRoot(root);
    }
  }, 60_000);

  it('leaves source unchanged for coverage, target, validation, and domain mismatch gates', () => {
    const cases = [
      {
        name: 'coverage-gap',
        recordId: 'REQ-MUTATION-COVERAGE',
        setup: (root: string) => {
          const descriptor = createMinimalConsumerRequirementDescriptor(
            'source-mutation-coverage-gap'
          );
          const materialized = writeMinimalConsumerRequirement(
            root,
            'docs/requirements/coverage-gap.md',
            descriptor
          );
          writeFileSync(
            materialized.sourcePath,
            [
              readFileSync(materialized.sourcePath, 'utf8').trimEnd(),
              '',
              '## Unmapped Requirement',
              '',
              '| Scenario | Decision | Behavior |',
              '| --- | --- | --- |',
              '| Additional behavior | TBD | ? |',
              '',
            ].join('\n'),
            'utf8'
          );
          return {
            source: materialized.sourcePath,
            options: materialized.authoringOptions,
          };
        },
        expectedIssue: 'source_requirement_coverage_gap',
      },
      {
        name: 'missing-target',
        recordId: 'REQ-MUTATION-TARGET',
        setup: (root: string) => {
          const descriptor = createMinimalConsumerRequirementDescriptor(
            'source-mutation-missing-target'
          );
          descriptor.target.path = 'target-authority-not-declared';
          const materialized = writeMinimalConsumerRequirement(
            root,
            'docs/requirements/missing-target.md',
            descriptor
          );
          const { targetPath: omittedTargetPath, ...options } = materialized.authoringOptions;
          expect(omittedTargetPath).toBe(descriptor.target.path);
          return { source: materialized.sourcePath, options };
        },
        expectedIssue: 'target_authority_missing',
      },
      {
        name: 'missing-validation',
        recordId: 'REQ-MUTATION-VALIDATION',
        setup: (root: string) => {
          const descriptor = createMinimalConsumerRequirementDescriptor(
            'source-mutation-missing-validation'
          );
          descriptor.verification.requiredCommand = 'validation-authority-not-declared';
          const materialized = writeMinimalConsumerRequirement(
            root,
            'docs/requirements/missing-validation.md',
            descriptor
          );
          const { requiredCommand: omittedRequiredCommand, ...options } =
            materialized.authoringOptions;
          expect(omittedRequiredCommand).toBe(descriptor.verification.requiredCommand);
          return { source: materialized.sourcePath, options };
        },
        expectedIssue: 'validation_authority_missing',
      },
      {
        name: 'domain-mismatch',
        recordId: 'REQ-MUTATION-DOMAIN',
        setup: (root: string) => {
          const descriptor = createMinimalConsumerRequirementDescriptor(
            'source-mutation-domain-mismatch'
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
            ...options
          } = materialized.authoringOptions;
          expect(sourceDeclaredTargetPath).toBe(descriptor.target.path);
          expect(sourceDeclaredRequiredCommand).toBe(descriptor.verification.requiredCommand);
          return { source: materialized.sourcePath, options };
        },
        expectedIssue: 'projection_domain_mismatch',
      },
    ];

    for (const item of cases) {
      const root = createTempRoot(`requirements-contract-${item.name}-`);
      try {
        const { source, options } = item.setup(root);
        const beforeHash = sha256File(source);

        const result = runAuthoring(root, source, item.recordId, options);
        const paths = artifacts(root, item.recordId, `${item.recordId}-SET`);
        const decision = readJson(paths.sourceMutationDecision);

        expect(issueCodes(result), item.name).toContain(item.expectedIssue);
        expect(decision.finalDecision, item.name).toBe('block_source_materialization');
        expect(decision.sourceMutationPerformed, item.name).toBe(false);
        expectSourceHashUnchanged(source, beforeHash);
      } finally {
        removeTempRoot(root);
      }
    }
  });

  it('never materializes user_confirmed from author-confirmation-ready-source', () => {
    const root = createTempRoot('requirements-contract-draft-only-');
    try {
      const descriptor = createMinimalConsumerRequirementDescriptor('source-mutation-draft-only');
      const materialized = writeMinimalConsumerRequirement(
        root,
        'docs/requirements/draft-only.md',
        descriptor
      );

      const result = runAuthoring(root, materialized.sourcePath, 'REQ-DRAFT-ONLY', {
        ...materialized.authoringOptions,
        criticalAuditorRound: cleanCriticalAuditorRound,
      });
      const paths = artifacts(root, 'REQ-DRAFT-ONLY', 'REQ-DRAFT-ONLY-SET');
      const sourceText = readFileSync(materialized.sourcePath, 'utf8');

      if (result.substate === 'user_confirmable') {
        const confirmation = readImplementationConfirmation(materialized.sourcePath);
        expect(confirmation.status).toBe('draft');
        expect(confirmation.status).not.toBe('user_confirmed');
      } else {
        expect(sourceText).not.toContain('status: user_confirmed');
      }
      expect(readJson(paths.sourceMutationDecision).userConfirmationDecision).toBe(
        'draft_only_user_confirmation_not_allowed'
      );
    } finally {
      removeTempRoot(root);
    }
  }, 60_000);

  it('blocks an inline user_confirmed promotion attempt before source mutation', () => {
    const root = createTempRoot('requirements-contract-user-confirmed-promotion-');
    try {
      const descriptor = createMinimalConsumerRequirementDescriptor(
        'source-mutation-user-confirmed-promotion'
      );
      const materialized = writeMinimalConsumerRequirement(
        root,
        'docs/requirements/user-confirmed-promotion.md',
        descriptor
      );
      writeFileSync(
        materialized.sourcePath,
        [
          readFileSync(materialized.sourcePath, 'utf8').trimEnd(),
          '',
          'implementationConfirmation:',
          '  status: user_confirmed',
          `  recordId: REQ-USER-CONFIRMED-PROMOTION`,
          `  requirementSetId: REQ-USER-CONFIRMED-PROMOTION-SET`,
          '  must:',
          `    - id: ${descriptor.refs.mustRequirementId}`,
          `      text: ${descriptor.semantics.requirement}`,
          '  openQuestions: []',
          '',
        ].join('\n'),
        'utf8'
      );
      const beforeHash = sha256File(materialized.sourcePath);

      const result = runAuthoring(
        root,
        materialized.sourcePath,
        'REQ-USER-CONFIRMED-PROMOTION',
        materialized.authoringOptions
      );
      const paths = artifacts(
        root,
        'REQ-USER-CONFIRMED-PROMOTION',
        'REQ-USER-CONFIRMED-PROMOTION-SET'
      );
      const decision = readJson(paths.sourceMutationDecision);

      expect(issueCodes(result)).toContain('user_confirmation_missing');
      expect(decision.blockedIssueCodes).toContain('user_confirmation_missing');
      expect(decision.userConfirmationDecision).toBe('block_user_confirmation_missing');
      expect(decision.finalDecision).toBe('block_source_materialization');
      expect(decision.sourceMutationPerformed).toBe(false);
      expectSourceHashUnchanged(materialized.sourcePath, beforeHash);
    } finally {
      removeTempRoot(root);
    }
  });
});
