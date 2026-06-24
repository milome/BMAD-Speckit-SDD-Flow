import { describe, expect, it } from 'vitest';
import {
  artifacts,
  createTempRoot,
  expectSourceHashUnchanged,
  issueCodes,
  readJson,
  removeTempRoot,
  runAuthoring,
  sha256File,
  writeConsumerRequirement,
  writeText,
} from './helpers/requirements-contract-authoring-fixture';

describe('requirements contract consumer target authority', () => {
  it('uses explicit consumer target paths and never falls back to BMAD governance paths', () => {
    const root = createTempRoot('requirements-contract-explicit-targets-');
    try {
      const source = writeConsumerRequirement(root);

      runAuthoring(root, source, 'REQ-EXPLICIT-TARGETS', {
        targetPath: [
          'vnpy/chart/multi_timeframe_widget.py',
          'vnpy/chart/multi_timeframe_settings_dialog.py',
          'vnpy/trader/ui/widget.py',
        ],
        requiredCommand: 'pytest tests/test_multi_timeframe_settings.py',
      });
      const paths = artifacts(root, 'REQ-EXPLICIT-TARGETS', 'REQ-EXPLICIT-TARGETS-SET');
      const targetReport = readJson(paths.targetAuthorityReport);
      const draft = readJson(paths.draftImplementationConfirmation).implementationConfirmation;
      const targetPaths = targetReport.accepted.map((row: any) => row.path);
      const projectedPaths = draft.targetModificationPaths.map((row: any) => row.path);

      expect(targetPaths).toEqual(
        expect.arrayContaining([
          'vnpy/chart/multi_timeframe_widget.py',
          'vnpy/chart/multi_timeframe_settings_dialog.py',
          'vnpy/trader/ui/widget.py',
        ])
      );
      expect(projectedPaths.some((item: string) => item.includes('scripts/main-agent'))).toBe(false);
      expect(projectedPaths.some((item: string) => item.includes('tests/acceptance/main-agent'))).toBe(
        false
      );
    } finally {
      removeTempRoot(root);
    }
  });

  it('derives target authority from source-declared consumer paths', () => {
    const root = createTempRoot('requirements-contract-source-targets-');
    try {
      const source = writeConsumerRequirement(root);

      const result = runAuthoring(root, source, 'REQ-SOURCE-TARGETS', {
        requiredCommand: 'pytest tests/test_multi_timeframe_settings.py',
      });
      const paths = artifacts(root, 'REQ-SOURCE-TARGETS', 'REQ-SOURCE-TARGETS-SET');
      const targetReport = readJson(paths.targetAuthorityReport);
      const accepted = targetReport.accepted.map((row: any) => ({
        path: row.path,
        source: row.source,
        sourceSpan: row.sourceSpan,
      }));

      expect(issueCodes(result)).toContain('critical_auditor_provider_mode_required');
      expect(accepted).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: 'vnpy/chart/multi_timeframe_settings_dialog.py',
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
      const source = writeText(
        root,
        'docs/requirements/no-target.md',
        [
          '# Consumer Product Requirement',
          '',
          '## 默认显示',
          '',
          '主图摘要必须展示所有启用周期。',
          '',
        ].join('\n')
      );
      const beforeHash = sha256File(source);

      const result = runAuthoring(root, source, 'REQ-MISSING-TARGETS', {
        requiredCommand: 'pytest tests/test_multi_timeframe_settings.py',
      });
      const paths = artifacts(root, 'REQ-MISSING-TARGETS', 'REQ-MISSING-TARGETS-SET');
      const targetReport = readJson(paths.targetAuthorityReport);
      const decision = readJson(paths.sourceMutationDecision);

      expect(issueCodes(result)).toContain('target_authority_missing');
      expect(targetReport.decision).toBe('block');
      expect(decision.finalDecision).toBe('block_source_materialization');
      expect(decision.sourceMutationPerformed).toBe(false);
      expectSourceHashUnchanged(source, beforeHash);
    } finally {
      removeTempRoot(root);
    }
  });

  it('rejects explicit relative target paths that escape the project root', () => {
    const root = createTempRoot('requirements-contract-outside-targets-');
    try {
      const source = writeConsumerRequirement(root);
      const beforeHash = sha256File(source);

      const result = runAuthoring(root, source, 'REQ-OUTSIDE-TARGETS', {
        targetPath: '../outside_project.py',
        requiredCommand: 'pytest ../outside_project.py',
      });
      const paths = artifacts(root, 'REQ-OUTSIDE-TARGETS', 'REQ-OUTSIDE-TARGETS-SET');
      const targetReport = readJson(paths.targetAuthorityReport);
      const decision = readJson(paths.sourceMutationDecision);

      expect(issueCodes(result)).toContain('target_authority_missing');
      expect(JSON.stringify(targetReport.rejected)).toContain('target_path_outside_project_root');
      expect(decision.finalDecision).toBe('block_source_materialization');
      expectSourceHashUnchanged(source, beforeHash);
    } finally {
      removeTempRoot(root);
    }
  });

  it('blocks consumer product projection to BMAD main-agent governance surfaces', () => {
    const root = createTempRoot('requirements-contract-domain-mismatch-');
    try {
      const source = writeText(
        root,
        'docs/requirements/domain-mismatch.md',
        [
          '# Multi Timeframe Consumer UX',
          '',
          '## 目标文件',
          '',
          '`scripts/main-agent-orchestration.ts`',
          '',
          '## 验收标准',
          '',
          '主图摘要必须展示所有启用周期。',
          '',
        ].join('\n')
      );
      const beforeHash = sha256File(source);

      const result = runAuthoring(root, source, 'REQ-DOMAIN-MISMATCH', {
        requiredCommand: 'npx vitest run tests/acceptance/main-agent-pre-confirmation-drilldown-lane.test.ts',
      });
      const paths = artifacts(root, 'REQ-DOMAIN-MISMATCH', 'REQ-DOMAIN-MISMATCH-SET');
      const sanity = readJson(paths.projectionDomainSanityReport);
      const decision = readJson(paths.sourceMutationDecision);

      expect(issueCodes(result)).toContain('projection_domain_mismatch');
      expect(sanity.decision).toBe('block');
      expect(sanity.offendingTargets).toContain('scripts/main-agent-orchestration.ts');
      expect(decision.finalDecision).toBe('block_source_materialization');
      expectSourceHashUnchanged(source, beforeHash);
    } finally {
      removeTempRoot(root);
    }
  });
});
