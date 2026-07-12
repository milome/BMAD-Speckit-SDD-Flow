import { describe, expect, it } from 'vitest';
import { compileRequirementContractModel } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-compiler';
import {
  artifacts,
  createTempRoot,
  issueCodes,
  readJson,
  removeTempRoot,
  runAuthoring,
  stagingMustDecompositionPacket,
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
  const negativeCommandRows = Array.from({ length: 15 }, (_item, index) => {
    const ordinal = String(index + 1).padStart(3, '0');
    const closureOrdinal = String(index + 84).padStart(3, '0');
    return `| CMD-${closureOrdinal} | delivery-evidence | NEG-${ordinal} | python -m pytest -q "tests/acceptance/negative-${ordinal}.test.ts" | Exit code 0. | Shortcut ${ordinal} must remain forbidden. | ACC-${closureOrdinal} TRACE-${closureOrdinal} | PATH-${closureOrdinal} owns remediation. | tests/acceptance/negative-${ordinal}.test.ts src/widget.ts |`;
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
    ...negativeCommandRows,
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

function perMustProductProjectionFixture(): string {
  return [
    '# Per-MUST Product Projection',
    '',
    '## Out Of Scope',
    '',
    '| ID | Forbidden scope | Boundary assertion | Evidence |',
    '| --- | --- | --- | --- |',
    '| OUT-001 | Replacing unrelated engines is out of scope. | Keep unrelated engines unchanged. | ACC-001 ACC-002 |',
    '',
    '## User Journeys',
    '',
    '| ID | Actor | Trigger | Required flow | Completion state |',
    '| --- | --- | --- | --- | --- |',
    '| UJ-001 | Trader | Connects a widget session. | Given a configured widget, when the trader connects, then the widget loads the persisted profile. | Widget session is live with the selected profile. |',
    '| UJ-002 | Operator | Refreshes widget state. | Given a stale widget cache, when the operator refreshes, then the cache revision advances without blocking the session. | Widget cache is current and the session remains live. |',
    '',
    '## Functional Requirements',
    '',
    '| ID | Requirement | Source rationale | Acceptance link | Per-MUST oracle | Assertion source | Responsibility mapping |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    '| FR-001 | The widget must load the selected persisted profile. | Product session behavior. | ACC-001 E2E-001 | Given a configured profile, when the widget connects, then the selected profile is loaded. | ACC-001 CMD-001 TRACE-001; tests/widget/test_profile.py | PATH-001 owns implementation and rollback. |',
    '| FR-002 | The widget must refresh stale cache state without blocking the live session. | Product refresh behavior. | ACC-002 E2E-002 | Given stale cache state, when refresh runs, then the revision advances and the live session remains responsive. | ACC-002 CMD-002 TRACE-002; tests/widget/test_refresh.py | PATH-002 owns implementation and rollback. |',
    '| FR-003 | The widget must expose a diagnostics label. | Product diagnostics behavior. | none | The diagnostics label is visible when diagnostics are enabled. | none | Diagnostics ownership is undecided. |',
    '',
    '## Failure Matrix',
    '',
    '| ID | Failure condition | Required system behavior | Negative requirement refs | Evidence |',
    '| --- | --- | --- | --- | --- |',
    '| FAIL-001 | Selected profile is missing or disabled. | Connection rejects before opening the widget session and preserves the prior safe state. | none | ACC-001 |',
    '| FAIL-002 | Cache refresh times out. | Refresh reports cache_refresh_timeout while the existing live session remains responsive. | none | none |',
    '',
    '## Acceptance Evidence',
    '',
    '| ID | Evidence target | Covers | Required evidence | Oracle | Assertion source | Responsibility mapping |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    '| ACC-001 | Profile load acceptance | MUST-FR-001 | python -m pytest -q "tests/widget/test_profile.py" | Given a configured profile, when the widget connects, then the selected profile is loaded. | CMD-001 TRACE-001; tests/widget/test_profile.py | PATH-001 owns remediation. |',
    '| ACC-002 | Cache refresh acceptance | MUST-FR-002 | python -m pytest -q "tests/widget/test_refresh.py" | Given stale cache state, when refresh runs, then the revision advances and the live session remains responsive. | CMD-002 TRACE-002; tests/widget/test_refresh.py | PATH-002 owns remediation. |',
    '',
    '## Test And Verification Paths',
    '',
    '| ID | Type | Covers | Command or evidence path | Completion rule | Per-MUST oracle | Assertion source | Responsibility mapping | Target files |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    '| E2E-001 | e2e | MUST-FR-001 | python -m pytest -q "tests/widget/test_profile.py" | Exit code 0. | Given a configured profile, when the widget connects, then the selected profile is loaded. | ACC-001 CMD-001 TRACE-001 | PATH-001 owns remediation. | tests/widget/test_profile.py src/widget/profile.py |',
    '| E2E-002 | e2e | MUST-FR-002 | python -m pytest -q "tests/widget/test_refresh.py" | Exit code 0. | Given stale cache state, when refresh runs, then the revision advances and the live session remains responsive. | ACC-002 CMD-002 TRACE-002 | PATH-002 owns remediation. | tests/widget/test_refresh.py src/widget/refresh.py |',
    '| CMD-001 | delivery-evidence | MUST-FR-001 | python -m pytest -q "tests/widget/test_profile.py" | Exit code 0. | Given a configured profile, when the widget connects, then the selected profile is loaded. | ACC-001 TRACE-001 | PATH-001 owns remediation. | tests/widget/test_profile.py src/widget/profile.py |',
    '| CMD-002 | delivery-evidence | MUST-FR-002 | python -m pytest -q "tests/widget/test_refresh.py" | Exit code 0. | Given stale cache state, when refresh runs, then the revision advances and the live session remains responsive. | ACC-002 TRACE-002 | PATH-002 owns remediation. | tests/widget/test_refresh.py src/widget/refresh.py |',
    '| CMD-999 | contract-validation | source structure only; no MUST coverage | node scripts/lint-source.js --source docs/requirements/widget.md | Source structure passes. | This command validates source structure only. | TRACE-001 TRACE-002 | Requirements owner owns remediation. | docs/requirements/widget.md |',
    '',
    '## Trace Matrix Source',
    '',
    '| ID | Covers | Evidence refs | Acceptance refs | Contract validation command refs | Delivery evidence command refs | View refs | Artifact refs | Boundary refs | Per-MUST oracle | Per-MUST closure assertion | Responsibility mapping |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    '| TRACE-001 | MUST-FR-001 | ACC-001 | ACC-001 E2E-001 | CMD-999 | CMD-001 | UJ-001 | PATH-001 | OUT-001 | Given a configured profile, when the widget connects, then the selected profile is loaded. | MUST-FR-001 closes only through ACC-001 and CMD-001. | PATH-001 owns implementation and rollback. |',
    '| TRACE-002 | MUST-FR-002 | ACC-002 | ACC-002 E2E-002 | CMD-999 | CMD-002 | UJ-002 | PATH-002 | none | Given stale cache state, when refresh runs, then the revision advances and the live session remains responsive. | MUST-FR-002 closes only through ACC-002 and CMD-002. | PATH-002 owns implementation and rollback. |',
    '',
    '## Implementation Path Map',
    '',
    '| ID | Repository path | Ownership | Required change | Requirement refs | Per-MUST oracle | Assertion source | Responsibility mapping |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
    '| PATH-001 | `src/widget/profile.py` | Profile owner | Implement profile loading. | FR-001 | Given a configured profile, when the widget connects, then the selected profile is loaded. | ACC-001 CMD-001 TRACE-001 | Profile owner owns implementation, rollback and remediation. |',
    '| PATH-002 | `src/widget/refresh.py` | Refresh owner | Implement non-blocking cache refresh. | FR-002 | Given stale cache state, when refresh runs, then the revision advances and the live session remains responsive. | ACC-002 CMD-002 TRACE-002 | Refresh owner owns implementation, rollback and remediation. |',
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

      expect(issueCodes(result)).toContain('business_failure_paths_source_authority_required');
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
        artifacts(root, 'REQ-NEGATIVE-CLOSURE-AUTHORITY', 'REQ-NEGATIVE-CLOSURE-AUTHORITY-SET')
          .draftImplementationConfirmation
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
      const requiredCommandIds = new Set(
        (confirmation.requiredCommands as Array<Record<string, unknown>>).map((row) =>
          String(row.id)
        )
      );
      const negativeCommandRefs = negativeTraceRows.flatMap(
        (row) => row.deliveryEvidenceCommandRefs as string[]
      );

      expect(negativeTraceRows.map((row) => row.id)).toEqual(expectedTraceIds);
      expect(negativeAcceptanceRows.map((row) => row.id)).toEqual(expectedAcceptanceIds);
      expect(tasks).toHaveLength(1);
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
      expect(negativeAcceptanceRows[0]?.file).toBe('tests/acceptance/negative-001.test.ts');
      expect(negativeAcceptanceRows[14]?.file).toBe('tests/acceptance/negative-015.test.ts');
      expect(ownerTask?.traceRows).toEqual(expect.arrayContaining(expectedTraceIds));
      expect(ownerTask?.acceptanceRefs).toEqual(expect.arrayContaining(expectedAcceptanceIds));
      expect(taskToTrace[ownerTaskId]).toEqual(expect.arrayContaining(expectedTraceIds));
      expect(taskToAcceptance[ownerTaskId]).toEqual(expect.arrayContaining(expectedAcceptanceIds));
      expect(notDoneRows.map((row) => row.coveredByTraceRows)).toEqual(
        expectedTraceIds.map((traceId) => [traceId])
      );
      expect(mustTrace?.covers).toEqual(['MUST-FR-001']);
      expect(negativeCommandRefs).not.toHaveLength(0);
      expect(negativeCommandRefs.every((commandRef) => requiredCommandIds.has(commandRef))).toBe(
        true
      );
    } finally {
      removeTempRoot(root);
    }
  });

  it('preserves source-authored target paths owned only by negative requirements', () => {
    const root = createTempRoot('requirements-contract-negative-target-authority-');
    try {
      const fixture = sourceAuthorityProjectionFixture()
        .replace(
          '| FR-001 | The widget must preserve source-authorized behavior. | Prevent compiler drift. | ACC-001 E2E-001 |',
          [
            '| FR-001 | The widget must preserve source-authorized behavior. | Prevent compiler drift. | ACC-001 E2E-001 |',
            '| FR-002 | The widget must expose an independently verifiable diagnostics state. | Keep positive requirements independently projected. | ACC-002 E2E-001 |',
          ].join('\n')
        )
        .replace(
          '| CMD-084 | delivery-evidence | NEG-001 | python -m pytest -q "tests/acceptance/negative-001.test.ts" | Exit code 0. | Shortcut 001 must remain forbidden. | ACC-084 TRACE-084 | PATH-084 owns remediation. | tests/acceptance/negative-001.test.ts src/widget.ts |',
          '| CMD-084 | delivery-evidence | NEG-001 | python -m pytest -q "tests/acceptance/negative-001.test.ts" | Exit code 0. | Shortcut 001 must remain forbidden. | ACC-084 TRACE-084 | PATH-084 owns remediation. | tests/acceptance/negative-001.test.ts src/negative-registry.ts |'
        )
        .replace(
          '| PATH-001 | `src/widget.ts` | widget owner | Preserve source-authorized behavior. | FR-001 | ACC-001 passes. | ACC-001 E2E-001 CMD-001 TRACE-001 | tests/acceptance/widget-authoring.test.ts owns evidence. |',
          [
            '| PATH-001 | `src/widget.ts` | widget owner | Preserve source-authorized behavior. | FR-001 | ACC-001 passes. | ACC-001 E2E-001 CMD-001 TRACE-001 | tests/acceptance/widget-authoring.test.ts owns evidence. |',
            '| PATH-084 | `src/negative-registry.ts` | widget owner | Prevent the forbidden negative fallback. | NEG-001 | Shortcut 001 must remain forbidden. | ACC-084 CMD-084 TRACE-084 | tests/acceptance/negative-001.test.ts owns evidence. |',
          ].join('\n')
        );
      const source = writeText(
        root,
        'docs/requirements/negative-target-authority.md',
        fixture
      );

      runAuthoring(root, source, 'REQ-NEGATIVE-TARGET-AUTHORITY');
      const paths = artifacts(
        root,
        'REQ-NEGATIVE-TARGET-AUTHORITY',
        'REQ-NEGATIVE-TARGET-AUTHORITY-SET'
      );
      const confirmation = readJson<{ implementationConfirmation: Record<string, any> }>(
        paths.draftImplementationConfirmation
      ).implementationConfirmation;
      const target = confirmation.targetModificationPaths.find(
        (row: any) => row.path === 'src/negative-registry.ts'
      );
      const command = confirmation.requiredCommands.find((row: any) => row.id === 'CMD-084');

      expect(command.targetFiles).toContain('src/negative-registry.ts');
      expect(target).toMatchObject({
        sourcePathId: 'PATH-084',
        coverageRole: 'modify',
      });
      expect(
        confirmation.atomicImplementationTaskList.flatMap((row: any) => row.targetFiles)
      ).toContain('src/negative-registry.ts');
    } finally {
      removeTempRoot(root);
    }
  });

  it('projects product-specific tasks, commands, paths, oracles, journeys, and current-target rows per MUST', () => {
    const root = createTempRoot('requirements-contract-per-must-product-projection-');
    try {
      const source = writeText(
        root,
        'docs/requirements/per-must-product-projection.md',
        perMustProductProjectionFixture()
      );

      runAuthoring(root, source, 'REQ-PER-MUST-PRODUCT-PROJECTION');
      const paths = artifacts(
        root,
        'REQ-PER-MUST-PRODUCT-PROJECTION',
        'REQ-PER-MUST-PRODUCT-PROJECTION-SET'
      );
      const confirmation = readJson<{ implementationConfirmation: Record<string, any> }>(
        paths.draftImplementationConfirmation
      ).implementationConfirmation;
      const packet = stagingMustDecompositionPacket(
        root,
        'REQ-PER-MUST-PRODUCT-PROJECTION'
      ) as Record<string, any>;
      const trace1 = confirmation.traceRows.find((row: any) => row.id === 'TRACE-001');
      const trace2 = confirmation.traceRows.find((row: any) => row.id === 'TRACE-002');
      const targetRowsById = new Map(
        confirmation.targetModificationPaths.map((row: any) => [row.id, row])
      );
      const target1 = confirmation.targetModificationPaths.find(
        (row: any) => row.path === 'src/widget/profile.py'
      );
      const target2 = confirmation.targetModificationPaths.find(
        (row: any) => row.path === 'src/widget/refresh.py'
      );
      const validationSourceTarget = confirmation.targetModificationPaths.find(
        (row: any) => row.path === 'docs/requirements/widget.md'
      );
      const validationScriptTarget = confirmation.targetModificationPaths.find(
        (row: any) => row.path === 'scripts/lint-source.js'
      );
      const acceptance1 = confirmation.acceptanceTests.find((row: any) => row.id === 'ACC-001');
      const acceptance2 = confirmation.acceptanceTests.find((row: any) => row.id === 'ACC-002');
      const packet1 = packet.mustPackets.find((row: any) => row.mustRef === 'MUST-FR-001');
      const packet2 = packet.mustPackets.find((row: any) => row.mustRef === 'MUST-FR-002');
      const packet3 = packet.mustPackets.find((row: any) => row.mustRef === 'MUST-FR-003');
      const tasks3 = confirmation.atomicImplementationTaskList.filter(
        (row: any) => row.derivedFromMustRef === 'MUST-FR-003'
      );
      const productTasks = confirmation.atomicImplementationTaskList.filter((row: any) =>
        ['MUST-FR-001', 'MUST-FR-002'].includes(row.derivedFromMustRef)
      );
      const failure2 = confirmation.failurePaths.find((row: any) => row.id === 'FAIL-002');
      const businessSequences = confirmation.sequenceViews.filter(
        (row: any) => row.scope === 'business'
      );
      const journey1 = businessSequences.find((row: any) => row.sourceJourneyRef === 'UJ-001');
      const journey2 = businessSequences.find((row: any) => row.sourceJourneyRef === 'UJ-002');
      const serialized = JSON.stringify(confirmation);

      expect(trace1.deliveryEvidenceCommandRefs).toEqual(['CMD-001']);
      expect(trace1.contractValidationCommandRefs).toEqual(['CMD-999']);
      expect(trace2.deliveryEvidenceCommandRefs).toEqual(['CMD-002']);
      expect(trace2.contractValidationCommandRefs).toEqual(['CMD-999']);
      expect(target1.requirementRefs).toEqual(['MUST-FR-001']);
      expect(target2.requirementRefs).toEqual(['MUST-FR-002']);
      expect(validationSourceTarget?.coverageRole).toBe('validation_only');
      expect(validationScriptTarget?.coverageRole).toBe('validation_only');
      expect(acceptance1.oracle).toContain('selected profile is loaded');
      expect(acceptance2.oracle).toContain('live session remains responsive');
      expect(
        productTasks.every((row: any) => !/semantic kernel|confirmation HTML/iu.test(row.text))
      ).toBe(true);
      expect(
        productTasks.some((row: any) => row.targetFiles.includes('src/widget/profile.py'))
      ).toBe(true);
      expect(
        productTasks.some((row: any) => row.targetFiles.includes('src/widget/refresh.py'))
      ).toBe(true);
      expect(packet1.mustCommandProjection.map((row: any) => row.id)).toContain('CMD-001');
      expect(packet1.mustCommandProjection.map((row: any) => row.id)).not.toContain('CMD-002');
      expect(packet2.mustCommandProjection.map((row: any) => row.id)).toContain('CMD-002');
      expect(packet2.mustCommandProjection.map((row: any) => row.id)).not.toContain('CMD-001');
      expect(packet3.mustCommandProjection).toEqual([]);
      expect(packet3.mustTargetPathProjection).toEqual([]);
      expect(tasks3).toHaveLength(1);
      expect(tasks3.every((row: any) => row.targetFiles.length === 0)).toBe(true);
      expect(packet1.atomicityCompleteness.expectedTaskCount).toBe(packet1.mustAtomicTasks.length);
      expect(packet1.atomicityCompleteness.expectedTaskCount).toBe(1);
      expect(packet1.questionCoverage.questions).toEqual(
        expect.arrayContaining([
          expect.stringContaining('independently confirmable behavior'),
          expect.stringContaining('overlap'),
        ])
      );
      expect(
        packet1.authorClaims.every(
          (claim: any) => claim.criticDisposition === 'pending_critical_auditor_response'
        )
      ).toBe(true);
      expect(
        packet.authorClaims.every(
          (claim: any) => claim.criticDisposition === 'pending_critical_auditor_response'
        )
      ).toBe(true);
      expect(trace1.targetModificationPathRefs).toContain(target1.id);
      expect(trace2.targetModificationPathRefs).toContain(target2.id);
      expect(
        [...trace1.targetModificationPathRefs, ...trace2.targetModificationPathRefs].every(
          (targetId: string) => targetRowsById.get(targetId)?.coverageRole !== 'generated_output'
        )
      ).toBe(true);
      expect(packet1.questionCoverage.questions.length).toBeGreaterThan(0);
      expect(packet2.questionCoverage.questions.length).toBeGreaterThan(0);
      expect(
        confirmation.currentTargetMap.diffRows.some(
          (row: any) =>
            row.requirementRefs?.length === 1 &&
            row.requirementRefs[0] === 'MUST-FR-001' &&
            String(row.targetState).includes('selected persisted profile')
        )
      ).toBe(true);
      expect(
        confirmation.currentTargetMap.diffRows.some(
          (row: any) =>
            row.requirementRefs?.length === 1 &&
            row.requirementRefs[0] === 'MUST-FR-002' &&
            String(row.targetState).includes('refresh stale cache state')
        )
      ).toBe(true);
      expect(businessSequences.some((row: any) => row.sourceJourneyRef === 'UJ-001')).toBe(true);
      expect(businessSequences.some((row: any) => row.sourceJourneyRef === 'UJ-002')).toBe(true);
      expect(journey1.covers).toEqual(['MUST-FR-001']);
      expect(journey1.traceRows).toEqual(['TRACE-001']);
      expect(journey1.evidenceRefs).toEqual(['EVD-001']);
      expect(journey1.acceptanceRefs).toEqual(['ACC-001', 'E2E-001']);
      expect(journey1.mermaid).toContain('[MUST-FR-001]');
      expect(journey2.covers).toEqual(['MUST-FR-002']);
      expect(journey2.traceRows).toEqual(['TRACE-002']);
      expect(journey2.evidenceRefs).toEqual(['EVD-002']);
      expect(journey2.acceptanceRefs).toEqual(['ACC-002', 'E2E-002']);
      expect(journey2.mermaid).toContain('[MUST-FR-002]');
      expect(trace1.sequenceViewRefs).toContain('SEQ-UJ-001');
      expect(trace1.sequenceViewRefs).not.toContain('SEQ-UJ-002');
      expect(trace2.sequenceViewRefs).toContain('SEQ-UJ-002');
      expect(trace2.sequenceViewRefs).not.toContain('SEQ-UJ-001');
      expect(
        confirmation.currentTargetMap.canonicalArtifacts.map((row: any) => row.targetPathOrField)
      ).not.toEqual(
        expect.arrayContaining([
          'docs/requirements/widget.md',
          'scripts/lint-source.js',
          'tests/widget/test_profile.py',
          'tests/widget/test_refresh.py',
        ])
      );
      expect(failure2.ownerMustRefs).toContain('MUST-FR-002');
      expect(
        confirmation.must.find((row: any) => row.id === 'MUST-FR-002').coveredByFailurePath
      ).toContain('FAIL-002');
      expect(serialized).not.toContain('"derivedFromMustRef":"MUST-001"');
    } finally {
      removeTempRoot(root);
    }
  });

  it('resolves source-declared directory command targets to authorized projected files', () => {
    const root = createTempRoot('requirements-contract-directory-command-targets-');
    try {
      const fixture = perMustProductProjectionFixture().replace(
        '| CMD-999 | contract-validation | source structure only; no MUST coverage | node scripts/lint-source.js --source docs/requirements/widget.md | Source structure passes. | This command validates source structure only. | TRACE-001 TRACE-002 | Requirements owner owns remediation. | docs/requirements/widget.md |',
        "| CMD-999 | contract-validation | source structure only; no MUST coverage | rg -n -e 'profile' -e 'refresh' -- src/widget | Source structure passes. | This command validates source structure only. | TRACE-001 TRACE-002 | Requirements owner owns remediation. | src/widget/ |"
      );
      const source = writeText(root, 'docs/requirements/directory-command-targets.md', fixture);

      runAuthoring(root, source, 'REQ-DIRECTORY-COMMAND-TARGETS');
      const paths = artifacts(
        root,
        'REQ-DIRECTORY-COMMAND-TARGETS',
        'REQ-DIRECTORY-COMMAND-TARGETS-SET'
      );
      const confirmation = readJson<{ implementationConfirmation: Record<string, any> }>(
        paths.draftImplementationConfirmation
      ).implementationConfirmation;
      const command = confirmation.requiredCommands.find((row: any) => row.id === 'CMD-999');

      expect(command.targetFiles).toEqual(
        expect.arrayContaining(['src/widget/profile.py', 'src/widget/refresh.py'])
      );
      expect(command.targetFiles).not.toContain('src/widget');
    } finally {
      removeTempRoot(root);
    }
  });

  it('fails closed instead of synthesizing business failure paths when the source has no Failure Matrix', () => {
    const root = createTempRoot('requirements-contract-missing-business-failure-paths-');
    try {
      const source = writeText(
        root,
        'docs/requirements/missing-business-failure-paths.md',
        [
          '# Missing Business Failure Paths',
          '',
          '## Functional Requirements',
          '',
          '| ID | Requirement | Acceptance link |',
          '| --- | --- | --- |',
          '| FR-001 | The widget must load a persisted profile. | ACC-001 |',
          '',
          '## Acceptance Evidence',
          '',
          '| ID | Evidence target | Covers | Required evidence | Oracle | Assertion source | Responsibility mapping |',
          '| --- | --- | --- | --- | --- | --- | --- |',
          '| ACC-001 | Profile load acceptance | MUST-FR-001 | python -m pytest tests/widget/test_profile.py | The persisted profile is loaded. | CMD-001 TRACE-001 | PATH-001 owns remediation. |',
          '',
          '## Test And Verification Paths',
          '',
          '| ID | Type | Covers | Command or evidence path | Completion rule | Per-MUST oracle | Assertion source | Responsibility mapping | Target files |',
          '| --- | --- | --- | --- | --- | --- | --- | --- | --- |',
          '| CMD-001 | delivery-evidence | MUST-FR-001 | python -m pytest tests/widget/test_profile.py | Exit code 0. | The persisted profile is loaded. | ACC-001 TRACE-001 | PATH-001 owns remediation. | tests/widget/test_profile.py src/widget/profile.py |',
          '',
          '## Trace Matrix Source',
          '',
          '| ID | Covers | Evidence refs | Acceptance refs | Contract validation command refs | Delivery evidence command refs | View refs | Artifact refs | Boundary refs | Per-MUST oracle | Per-MUST closure assertion | Responsibility mapping |',
          '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
          '| TRACE-001 | MUST-FR-001 | ACC-001 | ACC-001 | none | CMD-001 | none | PATH-001 | none | The persisted profile is loaded. | MUST-FR-001 closes through ACC-001 and CMD-001. | PATH-001 owns remediation. |',
          '',
          '## Implementation Path Map',
          '',
          '| ID | Repository path | Ownership | Required change | Requirement refs | Per-MUST oracle | Assertion source | Responsibility mapping |',
          '| --- | --- | --- | --- | --- | --- | --- | --- |',
          '| PATH-001 | `src/widget/profile.py` | Profile owner | Implement profile loading. | MUST-FR-001 | The persisted profile is loaded. | ACC-001 CMD-001 TRACE-001 | Profile owner owns remediation. |',
          '',
        ].join('\n')
      );

      const result = runAuthoring(root, source, 'REQ-MISSING-BUSINESS-FAILURE-PATHS');
      const paths = artifacts(
        root,
        'REQ-MISSING-BUSINESS-FAILURE-PATHS',
        'REQ-MISSING-BUSINESS-FAILURE-PATHS-SET'
      );
      const confirmation = readJson<{ implementationConfirmation: Record<string, any> }>(
        paths.draftImplementationConfirmation
      ).implementationConfirmation;

      expect(issueCodes(result)).toContain('business_failure_paths_source_authority_required');
      expect(confirmation.failurePaths).toEqual([]);
      expect(JSON.stringify(confirmation)).not.toMatch(/"id":"FAIL-\d{3}"/u);
    } finally {
      removeTempRoot(root);
    }
  });

  it('fails closed when a source User Journey has no MUST-owning trace mapping', () => {
    const root = createTempRoot('requirements-contract-unbound-user-journey-');
    try {
      const fixture = perMustProductProjectionFixture();
      const source = writeText(
        root,
        'docs/requirements/unbound-user-journey.md',
        fixture.replace(
          '| UJ-002 | Operator | Refreshes widget state. | Given a stale widget cache, when the operator refreshes, then the cache revision advances without blocking the session. | Widget cache is current and the session remains live. |',
          [
            '| UJ-002 | Operator | Refreshes widget state. | Given a stale widget cache, when the operator refreshes, then the cache revision advances without blocking the session. | Widget cache is current and the session remains live. |',
            '| UJ-003 | Auditor | Opens an unmapped diagnostics view. | The diagnostics view opens. | Diagnostics are visible. |',
          ].join('\n')
        )
      );

      const result = runAuthoring(root, source, 'REQ-UNBOUND-USER-JOURNEY');

      expect(issueCodes(result)).toContain('business_user_journey_owner_requirement_missing');
    } finally {
      removeTempRoot(root);
    }
  });
});
