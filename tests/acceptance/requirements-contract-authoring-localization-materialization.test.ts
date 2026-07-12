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
    '## Negative Requirements And Not Done Conditions',
    '',
    '| ID | Not-done condition | Negative assertion | Blocks completion when | Failure refs | Evidence refs |',
    '| --- | --- | --- | --- | --- | --- |',
    '| NEG-001 | Processing unavailable, malformed, or stale trigger input does not count as completion. | Invalid trigger input must be rejected before processing. | Invalid data reaches processing or downstream publication. | FAIL-001 FAIL-002 FAIL-003 | ACC-001 ACC-002 ACC-003 CMD-001 CMD-002 CMD-003 |',
    '',
    '## Failure Matrix',
    '',
    '| ID | Failure condition | Required system behavior | Negative requirement refs | Evidence |',
    '| --- | --- | --- | --- | --- |',
    '| FAIL-001 | GDS trigger routing is unavailable. | Reject the trigger before downstream dispatch and preserve the prior safe state. | NEG-001 | ACC-001 E2E-003 |',
    '| FAIL-002 | HKFE symbol or exchange semantics are invalid. | Reject the malformed event without mutating the accepted symbol state. | NEG-001 | ACC-002 E2E-003 |',
    '| FAIL-003 | Trigger data is stale. | Fail closed before processing or downstream publication. | NEG-001 | ACC-003 E2E-003 |',
    '',
    '## Acceptance Evidence',
    '',
    '| ID | Evidence target | Covers | Required evidence | Oracle | Assertion source | Responsibility mapping |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    '| ACC-001 | GDS trigger routing | MUST-FR-001 | python -m pytest tests/trader/test_gateway_profile_registry.py | GDS trigger ticks route through DataService. | CMD-001 TRACE-001 | PATH-001 owns implementation and remediation. |',
    '| ACC-002 | HKFE semantics | MUST-FR-002 | python -m pytest tests/trader/test_gateway_profile_registry.py | HKFE symbol and exchange semantics remain unchanged. | CMD-002 TRACE-002 | PATH-001 owns implementation and remediation. |',
    '| ACC-003 | Stale trigger rejection | MUST-NFR-001 | python -m pytest tests/trader/test_gateway_profile_registry.py | Stale trigger data is rejected before processing. | CMD-003 TRACE-003 | PATH-001 owns implementation and remediation. |',
    '',
    '## Test And Verification Paths',
    '',
    '| ID | Type | Covers | Command or evidence path | Completion rule | Per-MUST oracle | Assertion source | Responsibility mapping | Target files |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    '| CMD-001 | delivery-evidence | MUST-FR-001 | python -m pytest tests/trader/test_gateway_profile_registry.py | Exit code 0. | GDS trigger ticks route through DataService. | ACC-001 TRACE-001 | PATH-001 owns remediation. | tests/trader/test_gateway_profile_registry.py src/dataservice/gds_trigger.py |',
    '| CMD-002 | delivery-evidence | MUST-FR-002 | python -m pytest tests/trader/test_gateway_profile_registry.py | Exit code 0. | HKFE symbol and exchange semantics remain unchanged. | ACC-002 TRACE-002 | PATH-001 owns remediation. | tests/trader/test_gateway_profile_registry.py src/dataservice/gds_trigger.py |',
    '| CMD-003 | delivery-evidence | MUST-NFR-001 | python -m pytest tests/trader/test_gateway_profile_registry.py | Exit code 0. | Stale trigger data is rejected before processing. | ACC-003 TRACE-003 | PATH-001 owns remediation. | tests/trader/test_gateway_profile_registry.py src/dataservice/gds_trigger.py |',
    '| CMD-999 | contract-validation | source structure only; no MUST coverage | python -m pytest -q tests/trader/test_gateway_profile_registry.py | Source structure passes. | This command validates source structure only. | TRACE-001 TRACE-002 TRACE-003 TRACE-004 | Requirements owner owns remediation. | tests/trader/test_gateway_profile_registry.py |',
    '| E2E-003 | e2e | MUST-NFR-001 NEG-001 | python -m pytest tests/trader/test_gateway_profile_registry.py | Exit code 0. | Stale trigger data is rejected before processing. | ACC-003 CMD-003 TRACE-003 TRACE-004 | PATH-001 owns remediation. | tests/trader/test_gateway_profile_registry.py src/dataservice/gds_trigger.py |',
    '',
    '## Trace Matrix Source',
    '',
    '| ID | Covers | Evidence refs | Acceptance refs | Contract validation command refs | Delivery evidence command refs | View refs | Artifact refs | Boundary refs | Per-MUST oracle | Per-MUST closure assertion | Responsibility mapping |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    '| TRACE-001 | MUST-FR-001 | ACC-001 | ACC-001 | CMD-999 | CMD-001 | none | PATH-001 | none | GDS trigger ticks route through DataService. | MUST-FR-001 closes through ACC-001 and CMD-001. | PATH-001 owns implementation and remediation. |',
    '| TRACE-002 | MUST-FR-002 | ACC-002 | ACC-002 | CMD-999 | CMD-002 | none | PATH-001 | none | HKFE symbol and exchange semantics remain unchanged. | MUST-FR-002 closes through ACC-002 and CMD-002. | PATH-001 owns implementation and remediation. |',
    '| TRACE-003 | MUST-NFR-001 | ACC-003 | ACC-003 E2E-003 | CMD-999 | CMD-003 | none | PATH-001 | none | Stale trigger data is rejected before processing. | MUST-NFR-001 closes through ACC-003 and CMD-003. | PATH-001 owns implementation and remediation. |',
    '| TRACE-004 | NEG-001 | ACC-003 | ACC-003 E2E-003 | CMD-999 | CMD-003 | none | PATH-001 | none | Stale trigger data is rejected before processing. | NEG-001 closes through ACC-003, E2E-003, and CMD-003. | PATH-001 owns implementation and remediation. |',
    '',
    '## Implementation Path Map',
    '',
    '| ID | Repository path | Ownership | Required change | Requirement refs | Per-MUST oracle | Assertion source | Responsibility mapping |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
    '| PATH-001 | `src/dataservice/gds_trigger.py` | DataService owner | Implement GDS trigger routing and guards. | MUST-FR-001 MUST-FR-002 MUST-NFR-001 | Preserve routing, HKFE semantics, and stale-data rejection. | ACC-001 ACC-002 ACC-003 CMD-001 CMD-002 CMD-003 TRACE-001 TRACE-002 TRACE-003 | DataService owner owns implementation, rollback, and remediation. |',
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

function writeLocalizationResponse(
  root: string,
  requestPath: string,
  relativePath = 'localization-response.json'
): string {
  const request = readJson<{
    requestHash: string;
    sourceDocumentHash: string;
    confirmationLanguage: string;
    entries: Array<{
      key: string;
      rowId: string;
      field: string;
      sourceTextHash: string;
    }>;
  }>(requestPath);
  return writeText(
    root,
    relativePath,
    `${JSON.stringify(
      {
        schemaVersion: 'requirements-contract-localization-response/v1',
        requestHash: request.requestHash,
        sourceDocumentHash: request.sourceDocumentHash,
        confirmationLanguage: request.confirmationLanguage,
        providerMode: 'main_session_authoring_agent',
        semanticEquivalenceAttested: true,
        translations: request.entries.map((entry) => ({
          key: entry.key,
          sourceTextHash: entry.sourceTextHash,
          translatedText: `${entry.rowId} 的${entry.field}中文语义译文`,
        })),
      },
      null,
      2
    )}\n`
  );
}

describe('requirements contract authoring localization materialization', () => {
  it.each(['zh-CN', 'bilingual'] as const)(
    'requires genuine %s authoring-agent translations before rendering English source input',
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

        const options = {
          targetPath: 'tests/trader/test_gateway_profile_registry.py',
          requiredCommand: 'python -m pytest tests/trader/test_gateway_profile_registry.py',
          confirmationLanguage: language,
          criticalAuditorRound: cleanCriticalAuditorRound,
        };
        const blocked = runIntakeAuthoring(root, intakeSource, targetSource, recordId, options);
        const paths = artifacts(root, recordId, `${recordId}-SET`);
        const localizationRequestPath = path.join(paths.authoring, 'localization-request.json');

        expect(blocked.ok).toBe(false);
        expect(blocked.substate).toBe('localization_translation_required');
        expect(blocked.blockingStage).toBe('authoring_localization_provider_required');
        expect(issueCodes(blocked)).toContain('confirmation_localization_translation_required');
        expect(existsSync(localizationRequestPath)).toBe(true);
        const localizationRequest = readJson<{
          entries: Array<{ key: string }>;
        }>(localizationRequestPath);
        expect(localizationRequest.entries.map((entry) => entry.key)).toContain(
          'notDone.NEG-001.text'
        );

        const localizationResponsePath = writeLocalizationResponse(
          root,
          localizationRequestPath,
          `localization-response-${language}.json`
        );
        const result = runIntakeAuthoring(root, intakeSource, targetSource, recordId, {
          ...options,
          localizationResponseFile: localizationResponsePath,
        });

        expect(result.ok, JSON.stringify(result.blockingIssues, null, 2)).toBe(true);
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
        expect(firstMust.textZh).not.toContain('请按源文档确认以下内容');
        expect(firstMust.textZh).not.toBe(firstMust.text);
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

  it('repairs a stale synthetic-prefix textZh projection before renderer validation', () => {
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

      const blocked = runIntakeAuthoring(root, intakeSource, targetSource, recordId, options);
      expect(blocked.substate).toBe('localization_translation_required');
      const paths = artifacts(root, recordId, `${recordId}-SET`);
      const localizationResponsePath = writeLocalizationResponse(
        root,
        path.join(paths.authoring, 'localization-request.json')
      );
      const initial = runIntakeAuthoring(root, intakeSource, targetSource, recordId, {
        ...options,
        localizationResponseFile: localizationResponsePath,
      });
      expect(initial.ok).toBe(true);

      const generated = readFileSync(targetSource, 'utf8');
      const stale = generated.replace(
        /(- id: MUST-FR-001[\s\S]*?\n\s+textZh:)[^\n]*/u,
        '$1 MUST-FR-001 确认文本：请按源文档确认以下内容：Synthetic stale projection.'
      );
      expect(stale).not.toBe(generated);
      writeFileSync(targetSource, stale, 'utf8');

      const repairBlocked = runAuthoring(root, targetSource, `${recordId}-REPAIR`, options);
      expect(repairBlocked.substate).toBe('localization_translation_required');
      const repairPaths = artifacts(root, `${recordId}-REPAIR`, `${recordId}-REPAIR-SET`);
      const repairResponsePath = writeLocalizationResponse(
        root,
        path.join(repairPaths.authoring, 'localization-request.json'),
        'repair-localization-response.json'
      );
      const repaired = runAuthoring(root, targetSource, `${recordId}-REPAIR`, {
        ...options,
        localizationResponseFile: repairResponsePath,
      });
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
      expect(repairedMust.textZh).not.toContain('请按源文档确认以下内容');

      const repairReceipt = readJson<Record<string, unknown>>(
        path.join(repairPaths.authoring, 'localization-materialization-receipt.json')
      );
      expect(repairReceipt.fieldRepairedCount).toBeGreaterThan(0);
      expect(repairReceipt.fieldsRepaired).toContain('MUST-FR-001.textZh');
    } finally {
      removeTempRoot(root);
    }
  });
});
