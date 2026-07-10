import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  buildCoverageReceipt,
  buildScenarioCases,
  evaluateScenarioCase,
  loadScenarioCorpus,
  writeScenarioCoverageReceipt,
} from './helpers/requirements-contract-autonomous-compiler-fixture';
import {
  createTempRoot,
  removeTempRoot,
} from './helpers/requirements-contract-authoring-fixture';

describe('requirements contract authoring scenario corpus', () => {
  it('covers every declared pair and required high-risk combination', () => {
    const corpus = loadScenarioCorpus();
    const cases = buildScenarioCases(corpus);
    const receipt = buildCoverageReceipt(corpus, cases);
    const root = createTempRoot('requirements-contract-scenario-corpus-');
    try {
      const receiptPath = writeScenarioCoverageReceipt(root, receipt);
      const written = JSON.parse(readFileSync(receiptPath, 'utf8'));

      expect(existsSync(receiptPath)).toBe(true);
      expect(Object.keys(written.dimensions)).toEqual([
        'inputKind',
        'sourceShape',
        'languageMode',
        'targetAuthorityState',
        'validationAuthorityState',
        'rendererOracleOutcome',
        'environmentState',
        'promotionTargetState',
        'staleProjectionState',
        'mermaidAssetState',
        'criticalAuditorProviderState',
        'issueCodeClass',
      ]);
      expect(written.uncoveredPairs).toEqual([]);
      expect(written.highRiskCombinations.map((item: { id: string }) => item.id)).toEqual([
        'HR-001-session-prompt-zh-cn',
        'HR-002-existing-target-stale-projection',
        'HR-003-authority-conflict-strict-render-pass',
        'HR-004-missing-mermaid-packaged-install',
        'HR-005-provider-unavailable-critical-auditor-required',
        'HR-006-unknown-issue-zero-model-invariants',
      ]);
      expect(written.terminalClassCounts.confirmable).toBeGreaterThan(0);
      expect(written.nonConfirmableCaseCount).toBeGreaterThan(0);
    } finally {
      removeTempRoot(root);
    }
  });

  it('classifies confirmable and non-confirmable scenarios with direct evidence', () => {
    const cases = buildScenarioCases(loadScenarioCorpus());
    const evaluations = cases.map(evaluateScenarioCase);
    const confirmable = evaluations.filter((item) => item.terminalClass === 'confirmable');
    const blocked = evaluations.filter((item) => item.terminalClass !== 'confirmable');

    expect(confirmable.length).toBeGreaterThan(0);
    expect(blocked.length).toBeGreaterThan(0);
    expect(confirmable.every((item) => item.consumerRepairScriptCreated === false)).toBe(true);
    expect(confirmable.every((item) => item.promotionAttempted === true)).toBe(true);
    expect(blocked.every((item) => item.promotionAttempted === false)).toBe(true);
    expect(blocked.every((item) => item.sourceMutationPerformed === false)).toBe(true);
    expect(blocked.every((item) => item.structuredEvidence.sourceHash.startsWith('sha256:'))).toBe(true);
    expect([...new Set(blocked.map((item) => item.terminalClass))]).toEqual(
      expect.arrayContaining([
        'authority_gap_required_input',
        'environment_required',
        'upstream_runtime_defect',
        'repair_registry_unclassified_issue_code',
        'renderer_oracle_escape_upstream_runtime_defect',
        'source_hash_reconciliation_failed',
      ])
    );
  });
});
