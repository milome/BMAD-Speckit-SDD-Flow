import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  artifacts,
  cleanCriticalAuditorRound,
  createTempRoot,
  expectSourceHashUnchanged,
  issueCodes,
  readImplementationConfirmation,
  readJson,
  removeTempRoot,
  runAuthoring,
  sha256File,
  writeConsumerRequirement,
  writeText,
} from './helpers/requirements-contract-authoring-fixture';

function largeCheckpointRequirement(root: string): string {
  const rows = Array.from({ length: 80 }, (_unused, index) => {
    const n = String(index + 1).padStart(2, '0');
    return `- 默认显示场景 ${n} 必须保持主图摘要和设置面板同步。`;
  });
  return writeText(
    root,
    'docs/requirements/checkpoint-required.md',
    [
      '# Multi Timeframe Checkpoint Required',
      '',
      '目标文件：`vnpy/chart/multi_timeframe_widget.py`',
      '',
      '## 验收标准',
      '',
      ...rows,
      '',
      'pytest tests/test_multi_timeframe_settings.py 必须覆盖设置持久化。',
      '',
    ].join('\n')
  );
}

describe('requirements contract source mutation gate', () => {
  it('writes only diagnostic artifacts and leaves source unchanged when Critical Auditor provider is missing', () => {
    const root = createTempRoot('requirements-contract-missing-auditor-');
    try {
      const source = writeConsumerRequirement(root);
      const beforeHash = sha256File(source);

      const result = runAuthoring(root, source, 'REQ-MISSING-AUDITOR', {
        targetPath: 'vnpy/chart/multi_timeframe_widget.py',
        requiredCommand: 'pytest tests/test_multi_timeframe_settings.py',
      });
      const paths = artifacts(root, 'REQ-MISSING-AUDITOR', 'REQ-MISSING-AUDITOR-SET');
      const decision = readJson(paths.sourceMutationDecision);
      const draft = readJson(paths.draftImplementationConfirmation).implementationConfirmation;

      expect(issueCodes(result)).toContain('critical_auditor_provider_mode_required');
      expect(decision.finalDecision).toBe('block_source_materialization');
      expect(decision.auditEvidenceDecision).toBe('block');
      expect(decision.sourceMutationPerformed).toBe(false);
      expect(draft.preConfirmationDrilldown.criticalAuditor.consecutiveNoNewGapRounds).toBe(0);
      expect(draft.preConfirmationDrilldown.criticalAuditor.convergenceVerdict).toBe('audit_not_run');
      expect(JSON.stringify(draft)).not.toContain('bounded_no_new_gap');
      expect(existsSync(paths.receipt1)).toBe(false);
      expectSourceHashUnchanged(source, beforeHash);
    } finally {
      removeTempRoot(root);
    }
  });

  it('automatically persists checkpoint evidence before guarded source promotion', () => {
    const root = createTempRoot('requirements-contract-checkpoint-mutation-');
    try {
      const source = largeCheckpointRequirement(root);
      const beforeHash = sha256File(source);

      const result = runAuthoring(root, source, 'REQ-CHECKPOINT-MUTATION', {
        targetPath: 'vnpy/chart/multi_timeframe_widget.py',
        requiredCommand: 'pytest tests/test_multi_timeframe_settings.py',
        criticalAuditorRound: cleanCriticalAuditorRound,
      });
      const paths = artifacts(root, 'REQ-CHECKPOINT-MUTATION', 'REQ-CHECKPOINT-MUTATION-SET');
      const decision = readJson(paths.sourceMutationDecision);
      const route = readJson(paths.scaleRoutingDecision);
      const checkpointEvidence = readJson(paths.checkpointPersistenceEvidence);
      const promotionReceipt = readJson(paths.promotionReceipt);

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
      expect(sha256File(source)).not.toBe(beforeHash);
    } finally {
      removeTempRoot(root);
    }
  });

  it('leaves source unchanged for coverage, target, validation, and domain mismatch gates', () => {
    const cases = [
      {
        name: 'coverage-gap',
        recordId: 'REQ-MUTATION-COVERAGE',
        source: (root: string) =>
          writeText(
            root,
            'docs/requirements/coverage-gap.md',
            [
              '# Product UX Requirement',
              '',
              '目标文件：`vnpy/chart/multi_timeframe_widget.py`',
              '',
              '## 验收标准',
              '',
              '| 场景 | 行为 |',
              '|---|---|',
              '| 默认显示 | TBD |',
              '',
            ].join('\n')
          ),
        options: {
          targetPath: 'vnpy/chart/multi_timeframe_widget.py',
          requiredCommand: 'pytest tests/test_multi_timeframe_settings.py',
        },
        expectedIssue: 'source_requirement_coverage_gap',
      },
      {
        name: 'missing-target',
        recordId: 'REQ-MUTATION-TARGET',
        source: (root: string) =>
          writeText(
            root,
            'docs/requirements/missing-target.md',
            '# Consumer UX\n\n## 验收标准\n\n主图摘要必须展示所有启用周期。\n'
          ),
        options: { requiredCommand: 'pytest tests/test_multi_timeframe_settings.py' },
        expectedIssue: 'target_authority_missing',
      },
      {
        name: 'missing-validation',
        recordId: 'REQ-MUTATION-VALIDATION',
        source: (root: string) =>
          writeText(
            root,
            'docs/requirements/missing-validation.md',
            '# Consumer UX\n\n目标文件：`vnpy/chart/multi_timeframe_widget.py`\n\n## 验收标准\n\n主图摘要必须展示所有启用周期。\n'
          ),
        options: {},
        expectedIssue: 'validation_authority_missing',
      },
      {
        name: 'domain-mismatch',
        recordId: 'REQ-MUTATION-DOMAIN',
        source: (root: string) =>
          writeText(
            root,
            'docs/requirements/domain-mismatch.md',
            '# Multi Timeframe Consumer UX\n\n目标文件：`scripts/main-agent-orchestration.ts`\n\n## 验收标准\n\n主图摘要必须展示所有启用周期。\n'
          ),
        options: {
          requiredCommand:
            'npx vitest run tests/acceptance/main-agent-pre-confirmation-drilldown-lane.test.ts',
        },
        expectedIssue: 'projection_domain_mismatch',
      },
    ];

    for (const item of cases) {
      const root = createTempRoot(`requirements-contract-${item.name}-`);
      try {
        const source = item.source(root);
        const beforeHash = sha256File(source);

        const result = runAuthoring(root, source, item.recordId, item.options);
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
      const source = writeConsumerRequirement(root);

      const result = runAuthoring(root, source, 'REQ-DRAFT-ONLY', {
        targetPath: 'vnpy/chart/multi_timeframe_widget.py',
        requiredCommand: 'pytest tests/test_multi_timeframe_settings.py',
        confirmationLanguage: 'zh-CN',
        criticalAuditorRound: cleanCriticalAuditorRound,
      });
      const paths = artifacts(root, 'REQ-DRAFT-ONLY', 'REQ-DRAFT-ONLY-SET');
      const sourceText = readFileSync(source, 'utf8');

      if (result.substate === 'user_confirmable') {
        const confirmation = readImplementationConfirmation(source);
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
  });

  it('blocks an inline user_confirmed promotion attempt before source mutation', () => {
    const root = createTempRoot('requirements-contract-user-confirmed-promotion-');
    try {
      const source = writeText(
        root,
        'docs/requirements/user-confirmed-promotion.md',
        [
          '# Consumer UX',
          '',
          '目标文件：`vnpy/chart/multi_timeframe_widget.py`',
          '',
          '## 验收标准',
          '',
          '主图摘要必须展示所有启用周期。',
          '',
          'pytest tests/test_multi_timeframe_settings.py 必须覆盖设置持久化。',
          '',
          'implementationConfirmation:',
          '  status: user_confirmed',
          '  must:',
          '    - id: MUST-001',
          '      text: 主图摘要必须展示所有启用周期。',
          '  openQuestions: []',
          '',
        ].join('\n')
      );
      const beforeHash = sha256File(source);

      const result = runAuthoring(root, source, 'REQ-USER-CONFIRMED-PROMOTION', {
        targetPath: 'vnpy/chart/multi_timeframe_widget.py',
        requiredCommand: 'pytest tests/test_multi_timeframe_settings.py',
      });
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
      expectSourceHashUnchanged(source, beforeHash);
    } finally {
      removeTempRoot(root);
    }
  });
});
