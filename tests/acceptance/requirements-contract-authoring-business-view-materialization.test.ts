import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  artifacts,
  cleanCriticalAuditorRound,
  createTempRoot,
  readImplementationConfirmation,
  removeTempRoot,
  runIntakeAuthoring,
  writeText,
} from './helpers/requirements-contract-authoring-fixture';

function businessViewSource(): string {
  return [
    '# Source PRD',
    '',
    '目标文件：`src/dataservice/gds_trigger.py`',
    '',
    '## Product Context',
    '',
    'DataService consumes GDS trigger ticks while preserving HKFE market identity and rejecting unsafe input.',
    '',
    '## Success Criteria',
    '',
    '- Valid ticks route exactly once with symbol and exchange identity preserved.',
    '- Stale or malformed ticks fail closed without partial effects.',
    '',
    '## In Scope',
    '',
    '- GDS trigger routing, HKFE identity preservation, and stale-data rejection.',
    '',
    '## User Journeys',
    '',
    '1. A valid GDS trigger tick enters DataService and is routed exactly once.',
    '2. A stale or malformed tick is rejected before routing or state mutation.',
    '',
    '## Functional Requirements',
    '',
    '| FR ID | Requirement | Source rationale | Acceptance link | Per-MUST oracle | Assertion source | Responsibility mapping |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    '| FR-001 | System MUST route GDS trigger ticks through DataService. | DataService is the source-authorized routing boundary. | ACC-001 CMD-001 TRACE-001 | Every valid GDS trigger tick is routed through DataService exactly once. | ACC-001 CMD-001 TRACE-001 | PATH-001 owns implementation and remediation. |',
    '| FR-002 | System MUST preserve HKFE symbol and exchange semantics. | Market identity must survive routing unchanged. | ACC-002 CMD-002 TRACE-002 | Routed ticks retain their HKFE symbol and exchange identity without rewriting. | ACC-002 CMD-002 TRACE-002 | PATH-002 owns implementation and remediation. |',
    '',
    '## Non-Functional Requirements',
    '',
    '| NFR ID | Category | Requirement | Threshold and evidence | Per-MUST oracle | Assertion source | Responsibility mapping |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    '| NFR-001 | Data integrity | Trigger stream processing MUST fail closed on stale data. | ACC-003, CMD-003, and TRACE-003 prove rejection before side effects. | Stale or malformed ticks are rejected without partial routing or stream-state mutation. | ACC-003 CMD-003 TRACE-003 | PATH-003 owns implementation and remediation. |',
    '',
    '## Negative Requirements And Not Done Conditions',
    '',
    '| ID | Not-done condition | Negative assertion | Blocks completion when | Failure refs | Evidence refs |',
    '| --- | --- | --- | --- | --- | --- |',
    '| NEG-001 | Partial routing or identity rewriting cannot count as successful trigger processing. | Rejected ticks must not mutate stream state or emit a downstream route. | A stale or malformed tick is partially routed, rewrites identity, or changes stream state. | FAIL-001 | ACC-004 CMD-004 |',
    '',
    '## Architecture Decision Records',
    '',
    '- ADR-001: DataService remains the sole trigger-routing boundary.',
    '- ADR-002: Validation precedes all routing and stream-state mutation.',
    '',
    '## Failure Matrix',
    '',
    '| ID | Failure condition | Required system behavior | Negative requirement refs | Evidence | Requirement refs |',
    '| --- | --- | --- | --- | --- | --- |',
    '| FAIL-001 | A GDS trigger tick is stale, malformed, or cannot preserve its HKFE symbol and exchange identity. | Reject the tick without partial routing, preserve the last valid stream state, and expose a recoverable data-quality failure. | NEG-001 | ACC-001 ACC-002 ACC-003 ACC-004 E2E-001 | MUST-FR-001 MUST-FR-002 MUST-NFR-001 |',
    '',
    '## Acceptance Evidence',
    '',
    '| ID | Evidence target | Covers | Required evidence | Oracle | Assertion source | Responsibility mapping |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    '| ACC-001 | DataService trigger routing | MUST-FR-001 | python -m pytest tests/trader/test_gateway_profile_registry.py | Every valid GDS trigger tick is routed through DataService exactly once. | CMD-001 TRACE-001 | PATH-001 owns routing. |',
    '| ACC-002 | HKFE identity preservation | MUST-FR-002 | python -m pytest tests/trader/test_gateway_profile_registry.py | Routed ticks retain their HKFE symbol and exchange identity without rewriting. | CMD-002 TRACE-002 | PATH-002 owns identity preservation. |',
    '| ACC-003 | Stale-data rejection | MUST-NFR-001 | python -m pytest tests/trader/test_gateway_profile_registry.py | Stale or malformed ticks are rejected without partial routing or stream-state mutation. | CMD-003 TRACE-003 | PATH-003 owns fail-closed behavior. |',
    '| ACC-004 | No partial routing | NEG-001 | python -m pytest tests/trader/test_gateway_profile_registry.py | Rejected ticks emit no downstream route and leave stream state and identity unchanged. | CMD-004 TRACE-004 | PATH-003 owns rollback. |',
    '',
    '## Test And Verification Paths',
    '',
    '| ID | Type | Covers | Command or evidence path | Completion rule | Per-MUST oracle | Assertion source | Responsibility mapping | Target files |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    '| CMD-001 | delivery-evidence | MUST-FR-001 | python -m pytest tests/trader/test_gateway_profile_registry.py | Exit code 0. | Valid trigger ticks enter DataService exactly once. | ACC-001 E2E-001 TRACE-001 | PATH-001 owns remediation. | tests/trader/test_gateway_profile_registry.py src/dataservice/gds_trigger.py |',
    '| CMD-002 | delivery-evidence | MUST-FR-002 | python -m pytest tests/trader/test_gateway_profile_registry.py | Exit code 0. | HKFE symbol and exchange identity remain unchanged end to end. | ACC-002 E2E-001 TRACE-002 | PATH-002 owns remediation. | tests/trader/test_gateway_profile_registry.py src/dataservice/gds_trigger.py |',
    '| CMD-003 | delivery-evidence | MUST-NFR-001 | python -m pytest tests/trader/test_gateway_profile_registry.py | Exit code 0. | Stale data is rejected before any route or state mutation. | ACC-003 E2E-001 TRACE-003 | PATH-003 owns remediation. | tests/trader/test_gateway_profile_registry.py src/dataservice/gds_trigger.py |',
    '| CMD-004 | delivery-evidence | NEG-001 | python -m pytest tests/trader/test_gateway_profile_registry.py | Exit code 0. | Rejected ticks produce no partial route or stream-state mutation. | ACC-004 E2E-001 TRACE-004 | PATH-003 owns rollback. | tests/trader/test_gateway_profile_registry.py src/dataservice/gds_trigger.py |',
    '| E2E-001 | e2e | MUST-FR-001 MUST-FR-002 MUST-NFR-001 NEG-001 | python -m pytest tests/trader/test_gateway_profile_registry.py | Exit code 0. | Valid ticks route with identity preserved; stale ticks fail closed without partial effects. | ACC-001 ACC-002 ACC-003 ACC-004 CMD-001 CMD-002 CMD-003 CMD-004 TRACE-001 TRACE-002 TRACE-003 TRACE-004 | PATH-001 PATH-002 PATH-003 own remediation. | tests/trader/test_gateway_profile_registry.py src/dataservice/gds_trigger.py |',
    '',
    '## Trace Matrix Source',
    '',
    '| ID | Covers | Evidence refs | Acceptance refs | Contract validation command refs | Delivery evidence command refs | View refs | Artifact refs | Boundary refs | Per-MUST oracle | Per-MUST closure assertion | Responsibility mapping |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    '| TRACE-001 | MUST-FR-001 | ACC-001 | ACC-001 E2E-001 | CMD-001 | CMD-001 | none | PATH-001 | none | Valid trigger ticks enter DataService exactly once. | MUST-FR-001 closes through ACC-001 and TRACE-001. | PATH-001 owns remediation. |',
    '| TRACE-002 | MUST-FR-002 | ACC-002 | ACC-002 E2E-001 | CMD-002 | CMD-002 | none | PATH-002 | none | HKFE identity remains unchanged through routing. | MUST-FR-002 closes through ACC-002 and TRACE-002. | PATH-002 owns remediation. |',
    '| TRACE-003 | MUST-NFR-001 | ACC-003 | ACC-003 E2E-001 | CMD-003 | CMD-003 | none | PATH-003 | none | Stale data is rejected before route or state mutation. | MUST-NFR-001 closes through ACC-003 and TRACE-003. | PATH-003 owns remediation. |',
    '| TRACE-004 | NEG-001 | ACC-004 | ACC-004 E2E-001 | CMD-004 | CMD-004 | none | PATH-003 | none | Rejected ticks produce no downstream route or stream-state mutation. | NEG-001 closes through ACC-004 and TRACE-004. | PATH-003 owns rollback. |',
    '',
    '## Implementation Path Map',
    '',
    '| ID | Repository path | Ownership | Required change | Requirement refs | Per-MUST oracle | Assertion source | Responsibility mapping |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
    '| PATH-001 | `src/dataservice/gds_trigger.py` | Routing owner | Route valid GDS trigger ticks through DataService exactly once. | MUST-FR-001 | ACC-001 passes. | ACC-001 CMD-001 TRACE-001 | Routing owner owns implementation and rollback. |',
    '| PATH-002 | `src/dataservice/gds_trigger.py` | Identity owner | Preserve HKFE symbol and exchange identity through routing. | MUST-FR-002 | ACC-002 passes. | ACC-002 CMD-002 TRACE-002 | Identity owner owns implementation and rollback. |',
    '| PATH-003 | `src/dataservice/gds_trigger.py` | Data-quality owner | Reject stale or malformed ticks before route or state mutation. | MUST-NFR-001 NEG-001 | ACC-003 and ACC-004 pass without partial effects. | ACC-003 ACC-004 CMD-003 CMD-004 TRACE-003 TRACE-004 | Data-quality owner owns implementation and rollback. |',
    '',
    '## Source Current State',
    '',
    '| ID | Current behavior | Current path | Limitation | Evidence |',
    '| --- | --- | --- | --- | --- |',
    '| CUR-001 | Trigger routing lacks confirmed identity and stale-data guarantees. | src/dataservice/gds_trigger.py | Routing can proceed without complete validation evidence. | ACC-001 ACC-002 ACC-003 |',
    '',
    '## Source Target State',
    '',
    '| ID | Target behavior | Target path | Acceptance state | Evidence |',
    '| --- | --- | --- | --- | --- |',
    '| TGT-001 | DataService routes valid ticks exactly once and rejects stale or malformed ticks before side effects. | src/dataservice/gds_trigger.py | ACC-001, ACC-002, ACC-003, and ACC-004 pass. | CMD-001 CMD-002 CMD-003 CMD-004 |',
    '',
    '## Current Target Map',
    '',
    '| ID | Current refs | Target refs | Transition | Invariant | Requirement refs | Per-MUST oracle | Assertion source | Responsibility mapping |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    '| CTM-001 | CUR-001 | TGT-001 | validate then route | Rejected ticks never mutate stream state or emit a route. | MUST-FR-001 MUST-FR-002 MUST-NFR-001 NEG-001 | Valid ticks route once with identity preserved; invalid ticks fail closed. | ACC-001 ACC-002 ACC-003 ACC-004 CMD-001 CMD-002 CMD-003 CMD-004 TRACE-001 TRACE-002 TRACE-003 TRACE-004 | PATH-001 PATH-002 PATH-003 own remediation. |',
    '',
    '## Human-Readable ID-Bound Views',
    '',
    '- Happy-path sequence view: SEQ-BUSINESS-001 describes valid trigger processing order.',
    '- Failure-path sequence view: SEQ-BUSINESS-FAIL-001 describes rejected trigger processing.',
    '- State and flow view: FLOW-BUSINESS-001 describes routing and fail-closed branches.',
    '- Edge-case view: EDGEVIEW-BUSINESS-001 describes stale and malformed input behavior.',
    '- Business and governance boundary view: BOUND-001 and BOUND-002 describe DataService and validation boundaries.',
    '- Artifact automation plan: PATH-001, PATH-002, and PATH-003 own generated evidence.',
    '- Current-vs-target map: CTM-001 binds CUR-001 to TGT-001.',
    '- aiTddContractExecutionManifestProjection binds commands, traces, and target paths.',
    '',
    '## Out Of Scope',
    '',
    '| ID | Forbidden scope | Boundary assertion | Evidence |',
    '| --- | --- | --- | --- |',
    '| OUT-001 | Manual live trading execution. | No live orders are sent. | ACC-004 |',
    '| OUT-002 | Broker credential storage. | No credential persistence is introduced. | ACC-004 |',
  ].join('\n');
}

describe('requirements contract authoring business view materialization', () => {
  it('materializes business and boundary views referenced by trace rows from FR ID and NFR ID tables', () => {
    const root = createTempRoot('bmad-business-view-');
    try {
      const intakeSource = writeText(root, 'source.md', businessViewSource());
      const targetSource = `${root}/generated.md`;
      const recordId = 'REQ-TEST-BUSINESS-VIEWS';

      const result = runIntakeAuthoring(root, intakeSource, targetSource, recordId, {
        targetPath: 'tests/trader/test_gateway_profile_registry.py',
        requiredCommand: 'python -m pytest tests/trader/test_gateway_profile_registry.py',
        confirmationLanguage: 'en-US',
        criticalAuditorRound: cleanCriticalAuditorRound,
      });

      expect(result.blockingIssues.map((issue) => issue.code)).not.toContain(
        'controlled_must_candidates_missing'
      );
      expect(result.blockingIssues.map((issue) => issue.code)).not.toContain(
        'line_based_must_id_forbidden'
      );
      const paths = artifacts(root, recordId, `${recordId}-SET`);
      const sourcePrdLintReport = JSON.parse(
        readFileSync(`${paths.authoring}/source-prd-instance-lint-report.json`, 'utf8')
      );
      expect(
        result.ok,
        JSON.stringify({ blockingIssues: result.blockingIssues, sourcePrdLintReport }, null, 2)
      ).toBe(true);

      const confirmation = readImplementationConfirmation(targetSource);
      const draft = JSON.stringify(confirmation);
      expect(draft).toContain('FR-001');
      expect(draft).toContain('FR-002');
      expect(draft).toContain('NFR-001');
      expect(draft).toContain('SEQ-BUSINESS-001');
      expect(draft).toContain('FLOW-BUSINESS-001');
      expect(draft).toContain('EDGEVIEW-BUSINESS-001');
      expect(draft).toContain('BOUND-001');
      expect(draft).toContain('BOUND-002');
      expect(draft).not.toContain('"businessViews":[]');
      expect(paths.authoring).toContain(recordId);

      const traceRows = confirmation.traceRows as Array<Record<string, unknown>>;
      const sequenceViewIds = new Set(
        (confirmation.sequenceViews as Array<Record<string, unknown>>).map((row) => row.id)
      );
      const flowViewIds = new Set(
        (confirmation.flowViews as Array<Record<string, unknown>>).map((row) => row.id)
      );
      const edgeCaseViewIds = new Set(
        (confirmation.edgeCaseViews as Array<Record<string, unknown>>).map((row) => row.id)
      );
      const boundaryViewIds = new Set(
        (confirmation.boundaryViews as Array<Record<string, unknown>>).map((row) => row.id)
      );

      for (const trace of traceRows) {
        for (const id of (trace.sequenceViewRefs as string[]) ?? []) {
          expect(sequenceViewIds.has(id), `${trace.id} sequence ref ${id}`).toBe(true);
        }
        for (const id of (trace.flowViewRefs as string[]) ?? []) {
          expect(flowViewIds.has(id), `${trace.id} flow ref ${id}`).toBe(true);
        }
        for (const id of (trace.edgeCaseViewRefs as string[]) ?? []) {
          expect(edgeCaseViewIds.has(id), `${trace.id} edge ref ${id}`).toBe(true);
        }
        for (const id of (trace.boundaryViewRefs as string[]) ?? []) {
          expect(boundaryViewIds.has(id), `${trace.id} boundary ref ${id}`).toBe(true);
        }
      }
    } finally {
      removeTempRoot(root);
    }
  }, 90_000);

  it('replaces an existing intake target through controlled promotion', () => {
    const root = createTempRoot('bmad-business-view-existing-target-');
    try {
      const intakeSource = writeText(root, 'source.md', businessViewSource());
      const targetSource = writeText(
        root,
        'generated.md',
        '# Existing Generated Source\n\nstale target content\n'
      );
      const recordId = 'REQ-TEST-BUSINESS-VIEWS-EXISTING-TARGET';

      const result = runIntakeAuthoring(root, intakeSource, targetSource, recordId, {
        targetPath: 'tests/trader/test_gateway_profile_registry.py',
        requiredCommand: 'python -m pytest tests/trader/test_gateway_profile_registry.py',
        confirmationLanguage: 'en-US',
        criticalAuditorRound: cleanCriticalAuditorRound,
      });

      expect(result.blockingIssues.map((issue) => issue.code)).not.toContain(
        'target_created_before_promotion'
      );
      expect(result.ok, JSON.stringify(result.blockingIssues, null, 2)).toBe(true);
      const generated = readFileSync(targetSource, 'utf8');
      expect(generated).toContain('implementationConfirmation');
      expect(generated).toContain('SEQ-BUSINESS-001');
      expect(generated).not.toContain('stale target content');

      const paths = artifacts(root, recordId, `${recordId}-SET`);
      const decision = JSON.parse(readFileSync(paths.sourceMutationDecision, 'utf8')) as Record<
        string,
        unknown
      >;
      expect(decision.sourceMutationAllowed).toBe(true);
      expect(decision.sourceMutationPerformed).toBe(true);
      expect(decision.sourceDocumentExistedBefore).toBe(true);
      expect(decision.sourceDocumentHashBefore).not.toBe('absent');
    } finally {
      removeTempRoot(root);
    }
  }, 90_000);
});
