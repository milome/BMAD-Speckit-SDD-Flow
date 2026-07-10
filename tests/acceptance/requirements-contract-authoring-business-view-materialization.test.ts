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

      const confirmation = readImplementationConfirmation(targetSource);
      const paths = artifacts(root, recordId, `${recordId}-SET`);
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
  });

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
      const generated = readFileSync(targetSource, 'utf8');
      expect(generated).toContain('implementationConfirmation');
      expect(generated).toContain('SEQ-BUSINESS-001');
      expect(generated).not.toContain('stale target content');

      const paths = artifacts(root, recordId, `${recordId}-SET`);
      const decision = JSON.parse(
        readFileSync(paths.sourceMutationDecision, 'utf8')
      ) as Record<string, unknown>;
      expect(decision.sourceMutationAllowed).toBe(true);
      expect(decision.sourceMutationPerformed).toBe(true);
      expect(decision.sourceDocumentExistedBefore).toBe(true);
      expect(decision.sourceDocumentHashBefore).not.toBe('absent');
    } finally {
      removeTempRoot(root);
    }
  });
});
