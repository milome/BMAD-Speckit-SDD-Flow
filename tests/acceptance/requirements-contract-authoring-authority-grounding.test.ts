import { describe, expect, it } from 'vitest';
import { compileRequirementContractModel } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-compiler';
import {
  artifacts,
  createTempRoot,
  issueCodes,
  readJson,
  removeTempRoot,
  runAuthoring,
  writeText,
} from './helpers/requirements-contract-authoring-fixture';

function sourceAuthorityProjectionFixture(): string {
  const negativeRows = Array.from({ length: 15 }, (_item, index) => {
    const ordinal = String(index + 1).padStart(3, '0');
    const closureOrdinal = String(index + 84).padStart(3, '0');
    return `| NEG-${ordinal} | Shortcut ${ordinal} does not count as completion. | Shortcut ${ordinal} must remain forbidden. | The negative assertion is not proven. | FAIL-001 | ACC-${closureOrdinal} CMD-${closureOrdinal} |`;
  });
  const negativeAcceptanceRows = Array.from({ length: 15 }, (_item, index) => {
    const ordinal = String(index + 1).padStart(3, '0');
    const closureOrdinal = String(index + 84).padStart(3, '0');
    return `| ACC-${closureOrdinal} | NEG-${ordinal} independent acceptance | NEG-${ordinal} | artifact tests/acceptance/negative-${ordinal}.test.ts | Shortcut ${ordinal} must remain forbidden. | CMD-${closureOrdinal} TRACE-${closureOrdinal}; tests/acceptance/negative-${ordinal}.test.ts | PATH-${closureOrdinal} owns remediation. |`;
  });
  const negativeTraceRows = Array.from({ length: 15 }, (_item, index) => {
    const ordinal = String(index + 1).padStart(3, '0');
    const closureOrdinal = String(index + 84).padStart(3, '0');
    return `| TRACE-${closureOrdinal} | NEG-${ordinal} | ACC-${closureOrdinal} | ACC-${closureOrdinal} E2E-001 | CMD-${closureOrdinal} | PATH-${closureOrdinal} |`;
  });
  const negativeIds = Array.from(
    { length: 15 },
    (_item, index) => `NEG-${String(index + 1).padStart(3, '0')}`
  );

  return [
    '# Source Authority Projection',
    '',
    '## Functional Requirements',
    '',
    '| ID | Requirement | Source rationale | Acceptance link |',
    '| --- | --- | --- | --- |',
    '| FR-001 | The widget must preserve source-authorized behavior. | Prevent compiler drift. | ACC-001 E2E-001 |',
    '',
    '## Out Of Scope',
    '',
    '| ID | Forbidden scope | Boundary assertion | Evidence |',
    '| --- | --- | --- | --- |',
    '| OUT-001 | Rewriting unrelated engines is out of scope. | Keep unrelated engines unchanged. | ACC-001 |',
    '| OUT-002 | Publishing packages is out of scope. | Keep release operations disabled. | ACC-001 |',
    '',
    '## Negative Requirements And Not Done Conditions',
    '',
    '| ID | Not-done condition | Negative assertion | Blocks completion when | Failure refs | Evidence refs |',
    '| --- | --- | --- | --- | --- | --- |',
    ...negativeRows,
    '',
    '## Acceptance Evidence',
    '',
    '| ID | Evidence target | Covers | Required evidence | Oracle | Assertion source | Responsibility mapping |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    '| ACC-001 | Widget acceptance | FR-001 | npm run authoring:lint; artifact tests/acceptance/widget-authoring.test.ts | The widget behavior is independently proven. | CMD-001 TRACE-001; tests/acceptance/widget-authoring.test.ts | PATH-001 owns remediation. |',
    ...negativeAcceptanceRows,
    '',
    '## Test And Verification Paths',
    '',
    '| ID | Type | Covers | Command or evidence path | Completion rule | Per-MUST oracle | Assertion source | Responsibility mapping | Target files |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    `| E2E-001 | e2e | MUST-FR-001 ${negativeIds.join(' ')} | npm run authoring:lint | Exit code 0. | Widget behavior remains source-authorized. | ACC-001 CMD-001 TRACE-001 | PATH-001 owns remediation. | tests/acceptance/widget-authoring.test.ts src/widget.ts |`,
    '| CMD-001 | contract-validation | FR-001 | npm run authoring:lint | Exit code 0. | Lint rejects compiler drift. | ACC-001 E2E-001 TRACE-001 | PATH-001 owns remediation. | tests/acceptance/widget-authoring.test.ts src/widget.ts |',
    '',
    '## Trace Matrix Source',
    '',
    '| ID | Requirement | Acceptance | E2E coverage | Delivery evidence | Target path |',
    '| --- | --- | --- | --- | --- | --- |',
    ...negativeTraceRows,
    '',
    '## Implementation Path Map',
    '',
    '| ID | Repository path | Ownership | Required change | Requirement refs | Per-MUST oracle | Assertion source | Responsibility mapping |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
    '| PATH-001 | `src/widget.ts` | widget owner | Preserve source-authorized behavior. | FR-001 | ACC-001 passes. | ACC-001 E2E-001 CMD-001 TRACE-001 | tests/acceptance/widget-authoring.test.ts owns evidence. |',
    '',
  ].join('\n');
}

describe('requirements contract authoring authority grounding', () => {
  it('grounds compiler semantic rows with authority state and provenance', () => {
    const model = compileRequirementContractModel({
      recordId: 'REQ-AUTHORITY-GROUNDING',
      requirementSetId: 'REQ-AUTHORITY-GROUNDING-SET',
      must: [
        {
          id: 'MUST-FR-001',
          text: 'Widget summary must stay synchronized.',
          sourceRequirementId: 'FR-001',
          sourcePath: 'docs/requirements/widget.md',
          sourceSpan: { startLine: 7, endLine: 7 },
        },
      ],
      outOfScope: [{ id: 'OUT-001', text: 'Do not rewrite unrelated engines.' }],
      requiredCommands: ['pytest tests/test_widget.py'],
      targetPaths: ['src/widget.py'],
    });

    expect(model.must[0]).toMatchObject({
      authorityState: 'source_grounded',
      provenance: {
        sourceRequirementId: 'FR-001',
        sourcePath: 'docs/requirements/widget.md',
        sourceSpan: { startLine: 7, endLine: 7 },
        compiler: 'requirements-contract-compiler',
      },
    });
    expect(model.outOfScope[0]).toMatchObject({
      authorityState: 'source_boundary',
      provenance: expect.objectContaining({ compiler: 'requirements-contract-compiler' }),
    });
  });

  it('persists source authority spans, hashes, and source requirement IDs through authoring artifacts', () => {
    const root = createTempRoot('requirements-contract-authority-grounding-');
    try {
      const source = writeText(
        root,
        'docs/requirements/authority-grounding.md',
        [
          '# Authority Grounding Requirement',
          '',
          '目标文件：`src/widget.py`',
          '',
          '## Functional Requirements',
          '',
          '| FR ID | Requirement |',
          '|---|---|',
          '| FR-001 | Widget summary must stay synchronized with selected settings. |',
          '',
          '## Validation',
          '',
          'pytest tests/test_widget.py',
          '',
        ].join('\n')
      );

      const result = runAuthoring(root, source, 'REQ-AUTHORITY-GROUNDING');
      const paths = artifacts(root, 'REQ-AUTHORITY-GROUNDING', 'REQ-AUTHORITY-GROUNDING-SET');
      const candidates = readJson(paths.controlledMustCandidates);
      const target = readJson(paths.targetAuthorityReport);
      const validation = readJson(paths.validationAuthorityReport);
      const candidate = candidates.candidates.find(
        (row: Record<string, unknown>) => row.sourceRequirementId === 'FR-001'
      );

      expect(issueCodes(result)).toContain('critical_auditor_provider_mode_required');
      expect(candidate).toMatchObject({
        sourceRequirementId: 'FR-001',
        projectedMustId: 'MUST-FR-001',
        sourcePath: 'docs/requirements/authority-grounding.md',
        sourceSpan: { startLine: 9, endLine: 9 },
        sourceDocumentHash: expect.stringMatching(/^sha256:/),
      });
      expect(target.accepted[0]).toMatchObject({
        source: 'source_document',
        sourceSpan: expect.objectContaining({ startLine: expect.any(Number) }),
      });
      expect(validation.accepted[0]).toMatchObject({
        source: 'source_document',
        sourceSpan: expect.objectContaining({ startLine: 13 }),
      });
    } finally {
      removeTempRoot(root);
    }
  });

  it('keeps source NEG rows independent from source OUT rows', () => {
    const root = createTempRoot('requirements-contract-neg-out-authority-');
    try {
      const source = writeText(
        root,
        'docs/requirements/source-authority-projection.md',
        sourceAuthorityProjectionFixture()
      );

      runAuthoring(root, source, 'REQ-NEG-OUT-AUTHORITY');
      const confirmation = readJson<{ implementationConfirmation: Record<string, unknown> }>(
        artifacts(root, 'REQ-NEG-OUT-AUTHORITY', 'REQ-NEG-OUT-AUTHORITY-SET')
          .draftImplementationConfirmation
      ).implementationConfirmation;
      const outIds = (confirmation.outOfScope as Array<Record<string, unknown>>).map(
        (row) => row.id
      );
      const negIds = (confirmation.notDone as Array<Record<string, unknown>>).map((row) => row.id);
      const firstOut = (confirmation.outOfScope as Array<Record<string, unknown>>)[0];
      const firstNeg = (confirmation.notDone as Array<Record<string, unknown>>)[0];

      expect(outIds).toEqual(['OUT-001', 'OUT-002']);
      expect(firstOut).toMatchObject({
        id: 'OUT-001',
        text: 'Rewriting unrelated engines is out of scope.',
        scopeBoundary: 'Keep unrelated engines unchanged.',
      });
      expect(negIds).toEqual(
        Array.from({ length: 15 }, (_item, index) => `NEG-${String(index + 1).padStart(3, '0')}`)
      );
      expect(firstNeg).toMatchObject({
        id: 'NEG-001',
        text: 'Shortcut 001 does not count as completion.',
        negativeAssertion: 'Shortcut 001 must remain forbidden.',
        whyItBlocksCompletion: 'The negative assertion is not proven.',
        sourceFailureRefs: ['FAIL-001'],
        sourceAcceptanceRefs: ['ACC-084'],
        sourceCommandRefs: ['CMD-084'],
      });
    } finally {
      removeTempRoot(root);
    }
  });

  it('resolves ACC and E2E files from source ACC CMD and PATH authority tables', () => {
    const root = createTempRoot('requirements-contract-acceptance-file-authority-');
    try {
      const source = writeText(
        root,
        'docs/requirements/source-authority-projection.md',
        sourceAuthorityProjectionFixture()
      );

      runAuthoring(root, source, 'REQ-ACCEPTANCE-FILE-AUTHORITY');
      const confirmation = readJson<{ implementationConfirmation: Record<string, unknown> }>(
        artifacts(root, 'REQ-ACCEPTANCE-FILE-AUTHORITY', 'REQ-ACCEPTANCE-FILE-AUTHORITY-SET')
          .draftImplementationConfirmation
      ).implementationConfirmation;
      const acceptance = (confirmation.acceptanceTests as Array<Record<string, unknown>>)[0];
      const e2e = (confirmation.e2eSuites as Array<Record<string, unknown>>)[0];

      expect(acceptance.file).toBe('tests/acceptance/widget-authoring.test.ts');
      expect(e2e.file).toBe('tests/acceptance/widget-authoring.test.ts');
      expect(acceptance.file).not.toBe('source_authorized_validation_command');
      expect(e2e.file).not.toBe('source_authorized_validation_command');
    } finally {
      removeTempRoot(root);
    }
  });

  it('materializes source NEG rows as independent closures without inventing tasks', () => {
    const root = createTempRoot('requirements-contract-negative-closure-authority-');
    try {
      const source = writeText(
        root,
        'docs/requirements/source-authority-projection.md',
        sourceAuthorityProjectionFixture()
      );

      runAuthoring(root, source, 'REQ-NEGATIVE-CLOSURE-AUTHORITY');
      const confirmation = readJson<{ implementationConfirmation: Record<string, unknown> }>(
        artifacts(
          root,
          'REQ-NEGATIVE-CLOSURE-AUTHORITY',
          'REQ-NEGATIVE-CLOSURE-AUTHORITY-SET'
        ).draftImplementationConfirmation
      ).implementationConfirmation;
      const traceRows = confirmation.traceRows as Array<Record<string, unknown>>;
      const acceptanceTests = confirmation.acceptanceTests as Array<Record<string, unknown>>;
      const tasks = confirmation.atomicImplementationTaskList as Array<Record<string, unknown>>;
      const taskIds = new Set(tasks.map((row) => row.id));
      const expectedTraceIds = Array.from(
        { length: 15 },
        (_item, index) => `TRACE-${String(index + 84).padStart(3, '0')}`
      );
      const expectedAcceptanceIds = Array.from(
        { length: 15 },
        (_item, index) => `ACC-${String(index + 84).padStart(3, '0')}`
      );
      const negativeTraceRows = traceRows.filter((row) =>
        expectedTraceIds.includes(String(row.id))
      );
      const negativeAcceptanceRows = acceptanceTests.filter((row) =>
        expectedAcceptanceIds.includes(String(row.id))
      );
      const ownerTaskId = String((negativeTraceRows[0]?.taskRefs as string[])?.[0] ?? '');
      const ownerTask = tasks.find((row) => row.id === ownerTaskId);
      const taskToTrace = confirmation.atomicTaskToTraceMap as Record<string, string[]>;
      const taskToAcceptance = confirmation.atomicTaskToAcceptanceMap as Record<string, string[]>;
      const notDoneRows = confirmation.notDone as Array<Record<string, unknown>>;
      const mustTrace = traceRows.find((row) => row.id === 'TRACE-001');

      expect(negativeTraceRows.map((row) => row.id)).toEqual(expectedTraceIds);
      expect(negativeAcceptanceRows.map((row) => row.id)).toEqual(expectedAcceptanceIds);
      expect(tasks).toHaveLength(2);
      expect(ownerTaskId).not.toBe('');
      expect(taskIds.has(ownerTaskId)).toBe(true);
      expect(negativeTraceRows.every((row) => (row.taskRefs as string[]).length === 1)).toBe(true);
      expect(
        negativeTraceRows.every((row, index) =>
          (row.covers as string[]).includes(`NEG-${String(index + 1).padStart(3, '0')}`)
        )
      ).toBe(true);
      expect(
        negativeTraceRows.every((row) => (row.acceptanceRefs as string[]).includes('E2E-001'))
      ).toBe(true);
      expect(
        negativeAcceptanceRows.every(
          (row, index) =>
            (row.covers as string[])[0] === `NEG-${String(index + 1).padStart(3, '0')}` &&
            (row.traceRows as string[])[0] === expectedTraceIds[index]
        )
      ).toBe(true);
      expect(negativeAcceptanceRows[0]?.file).toBe(
        'tests/acceptance/negative-001.test.ts'
      );
      expect(negativeAcceptanceRows[14]?.file).toBe(
        'tests/acceptance/negative-015.test.ts'
      );
      expect(ownerTask?.traceRows).toEqual(expect.arrayContaining(expectedTraceIds));
      expect(ownerTask?.acceptanceRefs).toEqual(expect.arrayContaining(expectedAcceptanceIds));
      expect(taskToTrace[ownerTaskId]).toEqual(expect.arrayContaining(expectedTraceIds));
      expect(taskToAcceptance[ownerTaskId]).toEqual(
        expect.arrayContaining(expectedAcceptanceIds)
      );
      expect(
        notDoneRows.map((row) => row.coveredByTraceRows)
      ).toEqual(expectedTraceIds.map((traceId) => [traceId]));
      expect(mustTrace?.covers).toEqual(['MUST-FR-001']);
    } finally {
      removeTempRoot(root);
    }
  });
});
