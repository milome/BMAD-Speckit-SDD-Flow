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
  runAuthoringWithTestLocalization,
  sha256File,
  writeConsumerRequirement,
  writeText,
} from './helpers/requirements-contract-authoring-fixture';

function largeCheckpointRequirement(root: string): string {
  const ordinals = Array.from({ length: 80 }, (_unused, index) =>
    String(index + 1).padStart(3, '0')
  );
  const mustRefs = ordinals.map((ordinal) => `MUST-FR-${ordinal}`);
  const requirementRows = ordinals.map(
    (ordinal) =>
      `| FR-${ordinal} | 默认显示场景 ${ordinal} 必须保持主图摘要和设置面板同步。 | ACC-${ordinal} |`
  );
  const acceptanceRows = ordinals.map(
    (ordinal) =>
      `| ACC-${ordinal} | 场景 ${ordinal} 同步验收 | MUST-FR-${ordinal} | pytest tests/test_multi_timeframe_settings.py | 场景 ${ordinal} 的主图摘要和设置面板保持同步。 | CMD-001 TRACE-${ordinal} | PATH-001 owns remediation. |`
  );
  const traceRows = ordinals.map(
    (ordinal) =>
      `| TRACE-${ordinal} | MUST-FR-${ordinal} | ACC-${ordinal} | ACC-${ordinal} E2E-001 | CMD-001 | CMD-001 | none | PATH-001 | none | 场景 ${ordinal} 的主图摘要和设置面板保持同步。 | MUST-FR-${ordinal} closes through ACC-${ordinal} and TRACE-${ordinal}. | PATH-001 owns remediation. |`
  );
  return writeText(
    root,
    'docs/requirements/checkpoint-required.md',
    [
      '# Multi Timeframe Checkpoint Required',
      '',
      '目标文件：`vnpy/chart/multi_timeframe_widget.py`',
      '',
      '## Functional Requirements',
      '',
      '| ID | Requirement | Acceptance link |',
      '| --- | --- | --- |',
      ...requirementRows,
      '',
      '## Negative Requirements And Not Done Conditions',
      '',
      '| ID | Not-done condition | Negative assertion | Blocks completion when | Failure refs | Evidence refs |',
      '| --- | --- | --- | --- | --- | --- |',
      '| NEG-001 | 任一场景只更新一侧不能算完成。 | 每个场景的主图摘要和设置面板必须同时保持同步。 | 任一场景出现部分更新。 | FAIL-001 | ACC-001 CMD-001 |',
      '',
      '## Failure Matrix',
      '',
      '| ID | Failure condition | Required system behavior | Negative requirement refs | Evidence | Requirement refs |',
      '| --- | --- | --- | --- | --- | --- |',
      `| FAIL-001 | 任一默认显示场景的摘要或设置面板更新失败。 | 阻止部分提交，保留最近一次完整同步状态，并标记具体失败场景。 | NEG-001 | ACC-001 E2E-001 | ${mustRefs.join(' ')} |`,
      '',
      '## Acceptance Evidence',
      '',
      '| ID | Evidence target | Covers | Required evidence | Oracle | Assertion source | Responsibility mapping |',
      '| --- | --- | --- | --- | --- | --- | --- |',
      ...acceptanceRows,
      '',
      '## Test And Verification Paths',
      '',
      '| ID | Type | Covers | Command or evidence path | Completion rule | Per-MUST oracle | Assertion source | Responsibility mapping | Target files |',
      '| --- | --- | --- | --- | --- | --- | --- | --- | --- |',
      `| CMD-001 | delivery-evidence | ${mustRefs.join(' ')} NEG-001 | pytest tests/test_multi_timeframe_settings.py | Exit code 0. | 每个 MUST 通过对应 ACC/TRACE 独立证明同步行为。 | ${ordinals.map((ordinal) => `ACC-${ordinal} TRACE-${ordinal}`).join(' ')} TRACE-081 E2E-001 | PATH-001 owns remediation. | tests/test_multi_timeframe_settings.py vnpy/chart/multi_timeframe_widget.py |`,
      `| E2E-001 | e2e | ${mustRefs.join(' ')} NEG-001 | pytest tests/test_multi_timeframe_settings.py | Exit code 0. | 所有 80 个场景完成同步或整体保持先前安全状态。 | CMD-001 TRACE-081 | PATH-001 owns remediation. | tests/test_multi_timeframe_settings.py vnpy/chart/multi_timeframe_widget.py |`,
      '',
      '## Trace Matrix Source',
      '',
      '| ID | Covers | Evidence refs | Acceptance refs | Contract validation command refs | Delivery evidence command refs | View refs | Artifact refs | Boundary refs | Per-MUST oracle | Per-MUST closure assertion | Responsibility mapping |',
      '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
      ...traceRows,
      '| TRACE-081 | NEG-001 | ACC-001 | ACC-001 E2E-001 | CMD-001 | CMD-001 | none | PATH-001 | none | 任一场景部分更新时整体保持先前完整同步状态。 | NEG-001 closes through the E2E negative control. | PATH-001 owns remediation. |',
      '',
      '## Implementation Path Map',
      '',
      '| ID | Repository path | Ownership | Required change | Requirement refs | Per-MUST oracle | Assertion source | Responsibility mapping |',
      '| --- | --- | --- | --- | --- | --- | --- | --- |',
      `| PATH-001 | \`vnpy/chart/multi_timeframe_widget.py\` | Widget owner | Implement atomic synchronization for all default display scenarios. | ${mustRefs.join(' ')} NEG-001 | 每个 MUST 的对应 ACC/TRACE 独立通过。 | CMD-001 E2E-001 | Widget owner owns rollback and remediation. |`,
      '',
      '## Out Of Scope',
      '',
      '| ID | Forbidden scope | Boundary assertion | Evidence |',
      '| --- | --- | --- | --- |',
      '| OUT-001 | 不修改交易执行逻辑。 | 保持交易执行逻辑不变。 | ACC-001 |',
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
      expect(draft.preConfirmationDrilldown.criticalAuditor.convergenceVerdict).toBe(
        'audit_not_run'
      );
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
            '# Multi Timeframe Consumer UX\n\n目标文件：`packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-orchestration.ts`\n\n## 验收标准\n\n主图摘要必须展示所有启用周期。\n'
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

      const result = runAuthoringWithTestLocalization(root, source, 'REQ-DRAFT-ONLY', {
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
