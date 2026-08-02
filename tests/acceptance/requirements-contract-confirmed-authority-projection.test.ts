import { readFileSync } from 'node:fs';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import { describe, expect, it } from 'vitest';
import {
  compileRequirementsContractConfirmedAuthorityProjection,
  validateRequirementsContractConfirmedAuthorityProjection,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-confirmed-authority-projection';
import { compileRequirementsEffectivePassReceipt } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-requirements-effective-pass-gate';
import { sha256Stable } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-semantic-resolver';

const hash = (character: string) => `sha256:${character.repeat(64)}`;

function effectivePassReceipt() {
  const coverageUnitRefs = ['coverage/dimension', 'coverage/must', 'coverage/projection'];
  return compileRequirementsEffectivePassReceipt({
    request: {
      actorClass: 'requirements_critical_auditor_judge',
      judgeRole: 'requirements_critical_auditor',
      requestHash: hash('1'),
      attemptKeyHash: hash('2'),
      scopeManifestHash: hash('3'),
      promptTemplateHash: hash('4'),
      assessmentSchemaHash: hash('5'),
      providerAuthority: {
        providerRef: 'provider/requirements',
        providerRegistryHash: hash('6'),
        providerConfigurationHash: hash('7'),
        credentialRevision: 1,
      },
    },
    assessment: {
      schemaVersion: 'critical-auditor-judge-assessment/v1',
      actorClass: 'requirements_critical_auditor_judge',
      judgeRole: 'requirements_critical_auditor',
      verdict: 'no_new_valid_gap',
      validatedGaps: [],
    },
    frozenScope: { coverageUnitRefs },
    coverage: {
      observedCoverageUnitRefs: [...coverageUnitRefs],
      unassessedScopeRefs: [],
      blockingConditionRefs: [],
    },
    evidence: {
      evidenceManifestHash: hash('8'),
      providerInvocationReceiptHash: hash('9'),
      missingEvidenceRefs: [],
    },
    priorFindings: {
      ledgerEntryHash: hash('a'),
      requiredPriorFindingRefs: ['finding/1'],
      currentDispositionRefs: ['finding/1'],
      unresolvedPriorFindingRefs: [],
    },
    veto: {
      requirementsVetoRefs: ['veto/scope'],
      passedVetoRefs: ['veto/scope'],
    },
    currentAuthority: {
      attemptKeyHash: hash('2'),
      scopeManifestHash: hash('3'),
      evidenceManifestHash: hash('8'),
      providerInvocationReceiptHash: hash('9'),
      promptTemplateHash: hash('4'),
      assessmentSchemaHash: hash('5'),
      providerConfigurationHash: hash('7'),
    },
    identity: {
      replayDetected: false,
      duplicateIdentityDetected: false,
    },
  });
}

function projectionInput() {
  const receipt = effectivePassReceipt();
  const sourceSnapshotHash = hash('b');
  const implementationConfirmationSemanticHash = hash('c');
  const frozenConfirmationIrHash = sha256Stable({
    recordId: 'REQ-CONFIRMED-AUTHORITY',
    sourceSnapshotHash,
    implementationConfirmationSemanticHash,
  });
  const eventPayload = {
    eventType: 'confirmation_recorded',
    recordId: 'REQ-CONFIRMED-AUTHORITY',
    requirementSetId: 'REQ-CONFIRMED-AUTHORITY',
    sourceDocumentHash: sourceSnapshotHash,
    implementationConfirmationHash: implementationConfirmationSemanticHash,
    frozenConfirmationIrRef: {
      path: '_bmad-output/runtime/requirement-records/REQ-CONFIRMED-AUTHORITY/authority/requirement-confirmation-ir.json',
      semanticHash: frozenConfirmationIrHash,
      contentHash: hash('d'),
    },
    confirmedAuthorityIdentity: {
      schemaVersion: 'requirements-confirmed-authority-identity/v1',
      frozenConfirmationIrRef: {
        path: '_bmad-output/runtime/requirement-records/REQ-CONFIRMED-AUTHORITY/authority/requirement-confirmation-ir.json',
        semanticHash: frozenConfirmationIrHash,
        contentHash: hash('d'),
      },
    },
    requirementsEffectivePassReceiptRef: {
      path: '_bmad-output/runtime/requirement-records/REQ-CONFIRMED-AUTHORITY/judge/requirements_critical_auditor/requirements-effective-pass.receipt.json',
      schemaVersion: 'requirements-effective-pass-receipt/v1',
      receiptHash: receipt.receiptHash,
    },
  };
  const event = {
    eventSchemaVersion: 'control-event-envelope/v1',
    payloadSchemaVersion: 'confirmation_recorded/v1',
    eventType: 'confirmation_recorded',
    eventId: 'confirmation_recorded:2026-07-19T00:00:00.000Z:REQ-CONFIRMED-AUTHORITY',
    writerId: 'requirements-confirmation-ingest',
    writerRegistryHash: hash('e'),
    writerHash: hash('f'),
    recordId: 'REQ-CONFIRMED-AUTHORITY',
    requirementSetId: 'REQ-CONFIRMED-AUTHORITY',
    recordedAt: '2026-07-19T00:00:00.000Z',
    previousEventHash: hash('0'),
    beforeRecordHash: hash('1'),
    afterRecordHash: hash('2'),
    payloadHash: sha256Stable(eventPayload),
    payload: eventPayload,
  };
  const eventHash = sha256Stable(event);
  const committedEvent = { ...event, eventHash };
  const record = {
    schemaVersion: 'requirement-record/v1',
    recordId: 'REQ-CONFIRMED-AUTHORITY',
    requirementSetId: 'REQ-CONFIRMED-AUTHORITY',
    status: 'user_confirmed',
    sourcePath: 'docs/requirements/example.md',
    sourceDocumentHash: sourceSnapshotHash,
    implementationConfirmationHash: implementationConfirmationSemanticHash,
    confirmationHistory: [eventPayload],
    lastAppliedEventHash: eventHash,
    eventChainHead: eventHash,
  };
  const controlReceipt = {
    receiptType: 'control_event_committed',
    transactionId: 'CTRL-1234567890abcdef12345678',
    eventId: committedEvent.eventId,
    eventHash,
    eventType: 'confirmation_recorded',
    writerId: 'requirements-confirmation-ingest',
    writerRegistryHash: event.writerRegistryHash,
    writerHash: event.writerHash,
    recordId: event.recordId,
    requirementSetId: event.requirementSetId,
    eventLogPath:
      '_bmad-output/runtime/requirement-records/REQ-CONFIRMED-AUTHORITY/events/control-events.jsonl',
    beforeRecordHash: event.beforeRecordHash,
    afterRecordHash: event.afterRecordHash,
    artifactIndexPaths: [
      '_bmad-output/runtime/requirement-records/REQ-CONFIRMED-AUTHORITY/artifact-index.jsonl',
    ],
    artifactPaths: [
      '_bmad-output/runtime/requirement-records/REQ-CONFIRMED-AUTHORITY/authority/requirement-confirmation-ir.json',
    ],
    schemaGate: { ok: true, errorCount: 0 },
    committedAt: event.recordedAt,
  };
  return {
    record,
    confirmationEvent: committedEvent,
    controlReceipt,
    requirementsEffectivePassReceipt: receipt,
    currentAuthority: {
      requirementRecordId: record.recordId,
      sourceSnapshotHash,
      implementationConfirmationSemanticHash,
      controlledConfirmationEventHash: eventHash,
      confirmedAuthorityIdentity: eventPayload.frozenConfirmationIrRef,
      requirementsEffectivePassReceiptHash: receipt.receiptHash,
      writerId: 'requirements-confirmation-ingest',
    },
  };
}

describe('requirements contract confirmed authority projection', () => {
  it('projects the six-field Requirements confirmation authority tuple from committed control evidence', () => {
    const input = projectionInput();
    const first = compileRequirementsContractConfirmedAuthorityProjection(input);
    const second = compileRequirementsContractConfirmedAuthorityProjection({
      ...input,
      currentAuthority: { ...input.currentAuthority },
    });

    expect(second).toEqual(first);
    expect(first).toMatchObject({
      schemaVersion: 'requirements-contract-confirmed-authority-projection/v1',
      requirementRecordId: input.record.recordId,
      sourceSnapshotHash: input.currentAuthority.sourceSnapshotHash,
      implementationConfirmationSemanticHash:
        input.currentAuthority.implementationConfirmationSemanticHash,
      controlledConfirmationEventHash: input.currentAuthority.controlledConfirmationEventHash,
      RequirementsEffectivePassReceiptRef: {
        receiptHash: input.requirementsEffectivePassReceipt.receiptHash,
      },
    });
    expect(first.confirmedAuthorityIdentity).toMatchObject(
      input.confirmationEvent.payload.frozenConfirmationIrRef
    );
    expect(
      validateRequirementsContractConfirmedAuthorityProjection(first, input.currentAuthority)
    ).toBe(first);
  });

  it.each([
    ['record-mismatch', 'confirmed_authority_record_mismatch'],
    ['source-mismatch', 'confirmed_authority_source_stale'],
    ['confirmation-mismatch', 'confirmed_authority_implementation_confirmation_stale'],
    ['copied-event', 'confirmed_authority_event_copied_or_replayed'],
    ['uncontrolled-writer', 'confirmed_authority_uncontrolled_writer'],
    ['stale-effective-pass', 'confirmed_authority_effective_pass_stale'],
    ['tampered-effective-pass', 'requirements_effective_pass_receipt_hash_mismatch'],
  ])('fails closed for %s', (kind, code) => {
    const input = projectionInput();
    if (kind === 'record-mismatch') input.record.recordId = 'REQ-OTHER';
    if (kind === 'source-mismatch') input.record.sourceDocumentHash = hash('0');
    if (kind === 'confirmation-mismatch') input.record.implementationConfirmationHash = hash('0');
    if (kind === 'copied-event') input.controlReceipt.eventHash = hash('0');
    if (kind === 'uncontrolled-writer') input.confirmationEvent.writerId = 'uncontrolled-writer';
    if (kind === 'stale-effective-pass') {
      input.currentAuthority.requirementsEffectivePassReceiptHash = hash('0');
    }
    if (kind === 'tampered-effective-pass') {
      input.requirementsEffectivePassReceipt.requestHash = hash('0');
    }

    expect(() => compileRequirementsContractConfirmedAuthorityProjection(input)).toThrow(code);
  });

  it('validates schema and rejects projection hash tampering', () => {
    const input = projectionInput();
    const projection = compileRequirementsContractConfirmedAuthorityProjection(input);
    const schema = JSON.parse(
      readFileSync(
        path.resolve(
          'packages/bmad-speckit/src/main-agent/source-authority/schemas/requirements-contract-confirmed-authority-projection.schema.json'
        ),
        'utf8'
      )
    );

    expect(new Ajv2020({ strict: false }).compile(schema)(projection)).toBe(true);
    expect(() =>
      validateRequirementsContractConfirmedAuthorityProjection(
        {
          ...projection,
          sourceSnapshotHash: hash('0'),
        },
        input.currentAuthority
      )
    ).toThrow('confirmed_authority_tuple_hash_mismatch');
  });
});
