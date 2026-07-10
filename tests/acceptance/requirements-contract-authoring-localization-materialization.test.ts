import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  artifacts,
  cleanCriticalAuditorRound,
  createTempRoot,
  issueCodes,
  readImplementationConfirmation,
  readJson,
  removeTempRoot,
  runAuthoring,
  runIntakeAuthoring,
  writeText,
} from './helpers/requirements-contract-authoring-fixture';

function englishLocalizationSource(): string {
  return [
    '# English Localization PRD',
    '',
    'Target file: `src/dataservice/gds_trigger.py`',
    '',
    '## Functional Requirements',
    '',
    '| FR ID | Requirement |',
    '| --- | --- |',
    '| FR-001 | System MUST route GDS trigger ticks through DataService. |',
    '| FR-002 | System MUST preserve HKFE symbol and exchange semantics. |',
    '',
    '## Non-Functional Requirements',
    '',
    '| NFR ID | Quality attribute |',
    '| --- | --- |',
    '| NFR-001 | Trigger stream processing MUST fail closed on stale data. |',
    '',
    '## Out Of Scope',
    '',
    '- Manual live trading execution is out of scope.',
    '- Broker credential storage is out of scope.',
  ].join('\n');
}

function hasCjk(value: unknown): boolean {
  return /[\u3400-\u9fff]/u.test(String(value ?? ''));
}

describe('requirements contract authoring localization materialization', () => {
  it.each(['zh-CN', 'bilingual'] as const)(
    'materializes %s confirmation text before rendering English source input',
    (language) => {
      const root = createTempRoot('bmad-localization-materialization-');
      try {
        const intakeSource = writeText(root, 'source.md', englishLocalizationSource());
        writeText(
          root,
          'tests/trader/test_gateway_profile_registry.py',
          'def test_gateway_profile_registry_contract_placeholder():\n    assert True\n'
        );
        const targetSource = path.join(root, 'generated.md');
        const recordId = `REQ-TEST-LOCALIZATION-${language
          .toUpperCase()
          .replace(/[^A-Z0-9]+/gu, '-')}`;

        const result = runIntakeAuthoring(root, intakeSource, targetSource, recordId, {
          targetPath: 'tests/trader/test_gateway_profile_registry.py',
          requiredCommand: 'python -m pytest tests/trader/test_gateway_profile_registry.py',
          confirmationLanguage: language,
          criticalAuditorRound: cleanCriticalAuditorRound,
        });

        expect(
          result.ok,
          JSON.stringify(
            {
              substate: result.substate,
              blockingIssues: result.blockingIssues,
            },
            null,
            2
          )
        ).toBe(true);
        expect(result.substate).toBe('user_confirmable');
        expect(issueCodes(result)).not.toContain('confirmation_language_content_english_only');
        expect(issueCodes(result)).not.toContain('renderer_blocker_release_failure');

        const confirmation = readImplementationConfirmation(targetSource);
        const firstMust = (confirmation.must as Array<Record<string, unknown>>)[0];
        const firstNotDone = (confirmation.notDone as Array<Record<string, unknown>>)[0];
        const firstEvidence = (confirmation.evidence as Array<Record<string, unknown>>)[0];
        const firstFailure = (confirmation.failurePaths as Array<Record<string, unknown>>)[0];
        const firstEdgeCase = (confirmation.edgeCases as Array<Record<string, unknown>>)[0];
        const firstTrace = (confirmation.traceRows as Array<Record<string, unknown>>)[0];

        expect(firstMust.id).toBe('MUST-FR-001');
        expect(hasCjk(firstMust.textZh)).toBe(true);
        expect(hasCjk(firstNotDone.textZh)).toBe(true);
        expect(hasCjk(firstNotDone.whyItBlocksCompletionZh)).toBe(true);
        expect(hasCjk(firstEvidence.textZh)).toBe(true);
        expect(hasCjk(firstEvidence.oracleZh)).toBe(true);
        expect(hasCjk(firstFailure.titleZh)).toBe(true);
        expect(hasCjk(firstFailure.triggerZh)).toBe(true);
        expect(hasCjk(firstFailure.expectedBehaviorZh)).toBe(true);
        expect(hasCjk(firstFailure.forbiddenBehaviorZh)).toBe(true);
        expect(hasCjk(firstEdgeCase.conditionZh)).toBe(true);
        expect(hasCjk(firstEdgeCase.expectedBehaviorZh)).toBe(true);
        expect(hasCjk(firstEdgeCase.forbiddenBehaviorZh)).toBe(true);
        expect(hasCjk(firstTrace.closureAssertionZh)).toBe(true);
        expect(hasCjk(firstTrace.targetStateAssertionZh)).toBe(true);
        expect(hasCjk(firstTrace.acceptanceSummaryZh)).toBe(true);

        for (const row of confirmation.mustNot as Array<Record<string, unknown>>) {
          expect(hasCjk(row.textZh)).toBe(true);
          expect(hasCjk(row.scopeBoundaryZh)).toBe(true);
        }

        const paths = artifacts(root, recordId, `${recordId}-SET`);
        const localizationReceiptPath = path.join(
          paths.authoring,
          'localization-materialization-receipt.json'
        );
        expect(result.artifacts.localizationMaterializationReceipt).toBe(
          path.relative(root, localizationReceiptPath).replace(/\\/gu, '/')
        );
        expect(existsSync(localizationReceiptPath)).toBe(true);
        const localizationReceipt = readJson<Record<string, unknown>>(localizationReceiptPath);
        expect(localizationReceipt).toMatchObject({
          schemaVersion: 'requirements-contract-localization-materialization/v1',
          confirmationLanguage: language,
          deterministic: true,
          rendererReadOnly: true,
          oldHashBoundReceiptReused: false,
        });
        const renderReport = readJson<Record<string, unknown>>(
          path.join(paths.confirmation, 'confirmation-render-report.json')
        );
        const blockingCodes = (
          (renderReport.blockingIssues as Array<Record<string, unknown>>) ?? []
        ).map((issue) => issue.code);
        expect(renderReport.confirmability).toBe('confirmable');
        expect(blockingCodes).not.toContain('confirmation_language_content_english_only');
      } finally {
        removeTempRoot(root);
      }
    }
  );

  it('repairs a stale English direct textZh projection before renderer validation', () => {
    const root = createTempRoot('bmad-localization-stale-direct-');
    try {
      const intakeSource = writeText(root, 'source.md', englishLocalizationSource());
      writeText(
        root,
        'tests/trader/test_gateway_profile_registry.py',
        'def test_gateway_profile_registry_contract_placeholder():\n    assert True\n'
      );
      const targetSource = path.join(root, 'generated.md');
      const recordId = 'REQ-TEST-LOCALIZATION-STALE-DIRECT';
      const options = {
        targetPath: 'tests/trader/test_gateway_profile_registry.py',
        requiredCommand: 'python -m pytest tests/trader/test_gateway_profile_registry.py',
        confirmationLanguage: 'zh-CN',
        criticalAuditorRound: cleanCriticalAuditorRound,
      };

      const initial = runIntakeAuthoring(root, intakeSource, targetSource, recordId, options);
      expect(initial.ok).toBe(true);

      const generated = readFileSync(targetSource, 'utf8');
      const stale = generated.replace(
        /(- id: MUST-FR-001[\s\S]*?\n\s+textZh:)[^\n]*/u,
        '$1 English-only stale projection.'
      );
      expect(stale).not.toBe(generated);
      writeFileSync(targetSource, stale, 'utf8');

      const repaired = runAuthoring(root, targetSource, `${recordId}-REPAIR`, options);
      expect(
        repaired.ok,
        JSON.stringify(
          {
            substate: repaired.substate,
            blockingIssues: repaired.blockingIssues,
          },
          null,
          2
        )
      ).toBe(true);
      expect(issueCodes(repaired)).not.toContain('confirmation_language_content_english_only');

      const repairedConfirmation = readImplementationConfirmation(targetSource);
      const repairedMust = (repairedConfirmation.must as Array<Record<string, unknown>>)[0];
      expect(repairedMust.id).toBe('MUST-FR-001');
      expect(hasCjk(repairedMust.textZh)).toBe(true);

      const repairedPaths = artifacts(root, `${recordId}-REPAIR`, `${recordId}-REPAIR-SET`);
      const repairReceipt = readJson<Record<string, unknown>>(
        path.join(repairedPaths.authoring, 'localization-materialization-receipt.json')
      );
      expect(repairReceipt.fieldRepairedCount).toBeGreaterThan(0);
      expect(repairReceipt.fieldsRepaired).toContain('MUST-FR-001.textZh');
    } finally {
      removeTempRoot(root);
    }
  });
});
