import { existsSync } from 'node:fs';
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
  writeMinimalConsumerRequirement,
  writeText,
} from './helpers/requirements-contract-authoring-fixture';

describe('requirements contract existing source promotion', () => {
  it('keeps existing source unchanged until auditor convergence and authoring-draft promotion', () => {
    const root = createTempRoot('requirements-contract-existing-source-');
    try {
      const source = writeMinimalConsumerRequirement(root, 'docs/plans/existing-source.md');
      const beforeHash = sha256File(source);

      const blocked = runAuthoring(root, source, 'REQ-EXISTING-SOURCE', {
        targetPath: 'vnpy/chart/multi_timeframe_widget.py',
        requiredCommand: 'pytest tests/test_multi_timeframe_settings.py',
      });
      const paths = artifacts(root, 'REQ-EXISTING-SOURCE', 'REQ-EXISTING-SOURCE-SET');

      expect(issueCodes(blocked)).toContain('critical_auditor_provider_mode_required');
      expect(existsSync(paths.draftSourcePreview)).toBe(true);
      expect(existsSync(paths.promotionReceipt)).toBe(false);
      expectSourceHashUnchanged(source, beforeHash);
      expect(readJson<Record<string, unknown>>(paths.authoringTransaction).substate).toBe(
        'critical_auditor_round_required'
      );

      const promoted = runAuthoring(root, source, 'REQ-EXISTING-SOURCE', {
        targetPath: 'vnpy/chart/multi_timeframe_widget.py',
        requiredCommand: 'pytest tests/test_multi_timeframe_settings.py',
        criticalAuditorRound: cleanCriticalAuditorRound,
      });
      const receipt = readJson<Record<string, unknown>>(paths.promotionReceipt);
      const ledger = readJson<Record<string, unknown>>(paths.authoringTransaction);

      expect(existsSync(paths.promotionReceipt)).toBe(true);
      expect(receipt.promotionStage).toBe('authoring-draft');
      expect(receipt.targetHash).toBe(sha256File(source));
      expect(promoted.receiptHash).toBe(sha256File(paths.promotionReceipt));
      expect(readImplementationConfirmation(source).preConfirmationDrilldown).toBeTruthy();
      expect(ledger).toMatchObject({
        schemaVersion: 'requirements-authoring-transaction/v1',
        lane: 'author-confirmation-ready-source',
        entryMode: 'existing_source',
        substate: 'promoted_not_confirmation_ready',
      });
    } finally {
      removeTempRoot(root);
    }
  });

  it('promotes an existing source that already has a stale implementationConfirmation block', () => {
    const root = createTempRoot('requirements-contract-existing-source-stale-block-');
    try {
      const source = writeText(
        root,
        'docs/plans/existing-source-with-stale-block.md',
        [
          '# Existing Source With Stale Contract',
          '',
          '目标文件：`vnpy/chart/multi_timeframe_widget.py`',
          '',
          '## Functional Requirements',
          '',
          '| FR ID | Requirement |',
          '| --- | --- |',
          '| FR-001 | 主图摘要必须展示所有启用周期。 |',
          '',
          '## Negative Requirements And Not Done Conditions',
          '',
          '| ID | Not-done condition | Negative assertion | Blocks completion when | Failure refs | Evidence refs |',
          '| --- | --- | --- | --- | --- | --- |',
          '| NEG-001 | 配置无效时输出不完整摘要不能算成功。 | 配置失败必须保留最近一次有效摘要且不得显示保存成功。 | 配置失败后摘要被部分覆盖或错误显示成功。 | FAIL-001 | ACC-002 CMD-002 |',
          '',
          '## Failure Matrix',
          '',
          '| ID | Failure condition | Required system behavior | Negative requirement refs | Evidence | Requirement refs |',
          '| --- | --- | --- | --- | --- | --- |',
          '| FAIL-001 | 启用周期配置缺失、无效或无法加载。 | 保留最近一次有效摘要，显示可恢复的配置错误，并禁止输出不完整摘要。 | NEG-001 | ACC-001 ACC-002 E2E-001 | MUST-FR-001 |',
          '',
          '## Acceptance Evidence',
          '',
          '| ID | Evidence target | Covers | Required evidence | Oracle | Assertion source | Responsibility mapping |',
          '| --- | --- | --- | --- | --- | --- | --- |',
          '| ACC-001 | 主图摘要显示 | MUST-FR-001 | pytest tests/test_multi_timeframe_settings.py | 主图摘要展示全部启用周期；配置无效时保持最近一次有效摘要。 | CMD-001 TRACE-001 | PATH-001 owns remediation. |',
          '| ACC-002 | 配置失败回滚 | NEG-001 | pytest tests/test_multi_timeframe_settings.py | 配置失败后摘要和持久化状态保持最近一次有效值且不显示成功。 | CMD-002 TRACE-002 | PATH-001 owns rollback. |',
          '',
          '## Test And Verification Paths',
          '',
          '| ID | Type | Covers | Command or evidence path | Completion rule | Per-MUST oracle | Assertion source | Responsibility mapping | Target files |',
          '| --- | --- | --- | --- | --- | --- | --- | --- | --- |',
          '| CMD-001 | delivery-evidence | MUST-FR-001 | pytest tests/test_multi_timeframe_settings.py | Exit code 0. | 摘要完整显示启用周期，配置无效时不输出不完整摘要。 | ACC-001 E2E-001 TRACE-001 | PATH-001 owns remediation. | tests/test_multi_timeframe_settings.py vnpy/chart/multi_timeframe_widget.py |',
          '| CMD-002 | delivery-evidence | NEG-001 | pytest tests/test_multi_timeframe_settings.py | Exit code 0. | 配置失败后不部分更新摘要或错误显示成功。 | ACC-002 E2E-001 TRACE-002 | PATH-001 owns rollback. | tests/test_multi_timeframe_settings.py vnpy/chart/multi_timeframe_widget.py |',
          '| E2E-001 | e2e | MUST-FR-001 NEG-001 | pytest tests/test_multi_timeframe_settings.py | Exit code 0. | 用户看到完整摘要或明确的可恢复配置错误，失败时无部分更新。 | ACC-001 ACC-002 CMD-001 CMD-002 TRACE-001 TRACE-002 | PATH-001 owns remediation. | tests/test_multi_timeframe_settings.py vnpy/chart/multi_timeframe_widget.py |',
          '',
          '## Trace Matrix Source',
          '',
          '| ID | Covers | Evidence refs | Acceptance refs | Contract validation command refs | Delivery evidence command refs | View refs | Artifact refs | Boundary refs | Per-MUST oracle | Per-MUST closure assertion | Responsibility mapping |',
          '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
          '| TRACE-001 | MUST-FR-001 | ACC-001 | ACC-001 E2E-001 | CMD-001 | CMD-001 | none | PATH-001 | none | 主图摘要展示全部启用周期，配置无效时保持最近一次有效摘要。 | MUST-FR-001 closes through ACC-001 and TRACE-001. | PATH-001 owns remediation. |',
          '| TRACE-002 | NEG-001 | ACC-002 | ACC-002 E2E-001 | CMD-002 | CMD-002 | none | PATH-001 | none | 配置失败后不部分更新摘要或错误显示成功。 | NEG-001 closes through ACC-002 and TRACE-002. | PATH-001 owns rollback. |',
          '',
          '## Implementation Path Map',
          '',
          '| ID | Repository path | Ownership | Required change | Requirement refs | Per-MUST oracle | Assertion source | Responsibility mapping |',
          '| --- | --- | --- | --- | --- | --- | --- | --- |',
          '| PATH-001 | `vnpy/chart/multi_timeframe_widget.py` | Widget owner | 展示全部启用周期并在配置无效时保留最近一次有效摘要。 | MUST-FR-001 NEG-001 | ACC-001 and ACC-002 pass independently. | ACC-001 ACC-002 CMD-001 CMD-002 TRACE-001 TRACE-002 | Widget owner owns implementation and rollback. |',
          '',
          '## 验收标准',
          '',
          '- 主图摘要必须展示所有启用周期。',
          '- pytest tests/test_multi_timeframe_settings.py 必须覆盖主图摘要显示。',
          '',
          'implementationConfirmation:',
          '  status: draft',
          '  recordId: REQ-STALE',
          '  requirementSetId: REQ-STALE-SET',
          '  must:',
          '    - id: MUST-STALE-001',
          '      text: 旧契约行应被新 authoring 事务替换。',
          '',
        ].join('\n')
      );
      const beforeRawHash = sha256File(source);

      const promoted = runAuthoring(root, source, 'REQ-EXISTING-SOURCE-STALE', {
        targetPath: 'vnpy/chart/multi_timeframe_widget.py',
        requiredCommand: 'pytest tests/test_multi_timeframe_settings.py',
        criticalAuditorRound: cleanCriticalAuditorRound,
      });
      const paths = artifacts(root, 'REQ-EXISTING-SOURCE-STALE', 'REQ-EXISTING-SOURCE-STALE-SET');
      const receipt = readJson<Record<string, unknown>>(paths.promotionReceipt);
      const decision = readJson<Record<string, unknown>>(paths.sourceMutationDecision);
      const confirmation = readImplementationConfirmation(source);

      expect(existsSync(paths.promotionReceipt)).toBe(true);
      expect(promoted.receiptHash).toBe(sha256File(paths.promotionReceipt));
      expect(receipt.targetHash).toBe(sha256File(source));
      expect(decision.sourceDocumentHashBefore).toBe(beforeRawHash);
      expect(decision.targetRawHashBefore).toBe(beforeRawHash);
      expect(decision.semanticSourceHashBefore).toMatch(/^sha256:[a-f0-9]{64}$/u);
      expect(decision.semanticSourceHashBefore).not.toBe(beforeRawHash);
      expect(confirmation.recordId).toBe('REQ-EXISTING-SOURCE-STALE');
    } finally {
      removeTempRoot(root);
    }
  });
});
