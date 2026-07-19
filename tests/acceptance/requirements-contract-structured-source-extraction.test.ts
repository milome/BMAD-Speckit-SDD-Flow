import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  artifacts,
  createTempRoot,
  issueCodes,
  readJson,
  removeTempRoot,
  runAuthoring,
  sha256File,
  writeText,
} from './helpers/requirements-contract-authoring-fixture';

describe('requirements contract structured source extraction', () => {
  it('maps modal paragraphs, Chinese requirements, tables, bullets, non-goals, and numeric constraints', () => {
    const root = createTempRoot('requirements-contract-structured-extraction-');
    try {
      const source = writeText(
        root,
        'docs/requirements/structured-source.md',
        [
          '# Product UX Requirement',
          '',
          '目标文件：`src/product_widget.py`',
          '',
          '## Requirements',
          '',
          'The widget must preserve preview state until the user clicks OK.',
          '批量操作必须支持同时启用多个周期。',
          '',
          '## 默认显示',
          '',
          '| 项目 | 默认 | 行为 |',
          '|---|---|---|',
          '| 主图摘要 | 开启 | 主图摘要展示所有启用周期和指标。 |',
          '| 设置面板 | 开启 | 设置面板默认显示可编辑周期列表。 |',
          '',
          '## 验收标准',
          '',
          '- OK 按钮持久化设置并刷新图表。',
          '- 1366x768 分辨率下必须可用，不遮挡 OK 和取消按钮。',
          '',
          '```text',
          'This fenced block must not become a requirement candidate.',
          '```',
          '',
          '## 非目标',
          '',
          '本需求不重写交易引擎。',
          '',
        ].join('\n')
      );

      const result = runAuthoring(root, source, 'REQ-STRUCTURED-SOURCE', {
        targetPath: 'src/product_widget.py',
        requiredCommand: 'pytest src/product_widget.py',
      });
      expect(issueCodes(result), JSON.stringify(result.blockingIssues ?? [])).toContain(
        'source_projection_authority_missing'
      );

      const paths = artifacts(root, 'REQ-STRUCTURED-SOURCE', 'REQ-STRUCTURED-SOURCE-SET');
      const candidates = readJson(paths.controlledMustCandidates);
      const draft = readJson(paths.draftImplementationConfirmation);
      const ledger = readJson(paths.requirementCoverageLedger);
      const candidateText = JSON.stringify(candidates.candidates);
      const ledgerText = JSON.stringify(ledger.entries);
      const mustIds = draft.mustRequirements.map((requirement: Record<string, unknown>) =>
        String(requirement.id)
      );

      expect(candidates.acceptedCandidateCount).toBeGreaterThanOrEqual(6);
      expect(mustIds).toHaveLength(candidates.acceptedCandidateCount);
      expect(new Set(mustIds).size).toBe(mustIds.length);
      expect(mustIds.every((id: string) => /^MUST-FR-\d{3}$/u.test(id))).toBe(true);
      expect(candidateText).toContain('preserve preview state');
      expect(candidateText).toContain('批量操作必须支持');
      expect(candidateText).toContain('主图摘要展示');
      expect(candidateText).toContain('设置面板默认显示');
      expect(candidateText).toContain('OK 按钮持久化');
      expect(candidateText).toContain('1366x768');
      expect(candidateText).not.toContain('fenced block must not');
      expect(ledger.mappedNonGoalCount).toBeGreaterThanOrEqual(1);
      expect(ledgerText).toContain('本需求不重写交易引擎');
      expect(ledger.blockingIssues).toEqual([]);
    } finally {
      removeTempRoot(root);
    }
  });

  it('excludes existing inline implementationConfirmation from plain-source extraction', () => {
    const root = createTempRoot('requirements-contract-inline-exclusion-');
    try {
      const source = writeText(
        root,
        'docs/requirements/inline-existing.md',
        [
          '# Existing Inline Confirmation',
          '',
          '目标文件：`src/existing_widget.py`',
          '',
          '## Requirements',
          '',
          'The visible source must stay the only extracted product requirement.',
          '',
          'implementationConfirmation:',
          '  contractSchemaVersion: 1',
          '  status: draft',
          '  must:',
          '    - id: MUST-INLINE-001',
          '      text: "Inline block must not be re-extracted as plain source."',
          '',
        ].join('\n')
      );

      runAuthoring(root, source, 'REQ-INLINE-EXCLUSION', {
        targetPath: 'src/existing_widget.py',
        requiredCommand: 'pytest src/existing_widget.py',
      });
      const paths = artifacts(root, 'REQ-INLINE-EXCLUSION', 'REQ-INLINE-EXCLUSION-SET');
      const ledger = readJson(paths.requirementCoverageLedger);
      const ledgerText = JSON.stringify(ledger.entries);

      expect(ledgerText).toContain('visible source must stay');
      expect(ledgerText).not.toContain('Inline block must not be re-extracted');
      expect(readFileSync(source, 'utf8')).toContain('implementationConfirmation:');
    } finally {
      removeTempRoot(root);
    }
  });

  it('fails closed when a requirement table contains unresolved placeholders that cannot be mapped safely', () => {
    const root = createTempRoot('requirements-contract-unmapped-table-');
    try {
      const source = writeText(
        root,
        'docs/requirements/unmapped-table.md',
        [
          '# Product UX Requirement',
          '',
          '目标文件：`src/product_widget.py`',
          '',
          '## 验收标准',
          '',
          '| 场景 | 依赖决策 | 行为 |',
          '|---|---|---|',
          '| 默认显示 | TBD | ? |',
          '',
        ].join('\n')
      );
      const beforeHash = sha256File(source);

      const result = runAuthoring(root, source, 'REQ-UNMAPPED-TABLE', {
        targetPath: 'src/product_widget.py',
        requiredCommand: 'pytest src/product_widget.py',
      });
      const paths = artifacts(root, 'REQ-UNMAPPED-TABLE', 'REQ-UNMAPPED-TABLE-SET');
      const ledger = readJson(paths.requirementCoverageLedger);
      const decision = readJson(paths.sourceMutationDecision);

      expect(issueCodes(result)).toContain('source_requirement_coverage_gap');
      expect(ledger.blockingIssues).toContain('source_requirement_coverage_gap');
      expect(ledger.blockedUnmappedRequirementCount).toBeGreaterThan(0);
      expect(decision.finalDecision).toBe('block_source_materialization');
      expect(decision.sourceMutationPerformed).toBe(false);
      expect(sha256File(source)).toBe(beforeHash);
    } finally {
      removeTempRoot(root);
    }
  });
});
