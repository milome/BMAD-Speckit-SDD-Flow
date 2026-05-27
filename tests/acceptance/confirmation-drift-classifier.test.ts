import { describe, expect, it } from 'vitest';

const {
  classifyConfirmationDrift,
} = require('../../_bmad/skills/requirements-contract-authoring/scripts/confirmation_drift_classifier.js');

const SOURCE_HASH = 'sha256:1111111111111111111111111111111111111111111111111111111111111111';
const CONFIRMATION_HASH =
  'sha256:2222222222222222222222222222222222222222222222222222222222222222';
const OLD_PAGE_HASH = 'sha256:3333333333333333333333333333333333333333333333333333333333333333';
const NEW_PAGE_HASH = 'sha256:4444444444444444444444444444444444444444444444444444444444444444';

function record(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    status: 'user_confirmed',
    sourceDocumentHash: SOURCE_HASH,
    implementationConfirmationHash: CONFIRMATION_HASH,
    confirmationPageHash: OLD_PAGE_HASH,
    latestConfirmationProjectionHash: OLD_PAGE_HASH,
    confirmationHistory: [
      {
        eventType: 'confirmation_recorded',
        sourceDocumentHash: SOURCE_HASH,
        implementationConfirmationHash: CONFIRMATION_HASH,
        confirmationPageHash: OLD_PAGE_HASH,
      },
    ],
    ...overrides,
  };
}

function confirmation(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    status: 'user_confirmed',
    sourceDocumentHash: SOURCE_HASH,
    implementationConfirmationHash: CONFIRMATION_HASH,
    confirmationRender: {
      htmlHash: OLD_PAGE_HASH,
      reportPath: 'confirmation-render-report.json',
      confirmationPhrase: 'confirm',
    },
    ...overrides,
  };
}

function classify(input: {
  confirmation?: Record<string, unknown>;
  requirementRecord?: Record<string, unknown>;
  renderReport?: Record<string, unknown>;
  currentHashes?: Record<string, unknown>;
} = {}) {
  return classifyConfirmationDrift({
    confirmation: input.confirmation ?? confirmation(),
    requirementRecord: input.requirementRecord ?? record(),
    renderReport:
      input.renderReport ?? {
        confirmationPageHash: OLD_PAGE_HASH,
        reportPath: 'confirmation-render-report.json',
        confirmInstruction: 'confirm',
      },
    currentHashes:
      input.currentHashes ?? {
        sourceDocumentHash: SOURCE_HASH,
        implementationConfirmationHash: CONFIRMATION_HASH,
      },
  });
}

describe('confirmation drift classifier', () => {
  it('returns confirmed_current when semantic hashes and projection bookkeeping match', () => {
    expect(classify()).toMatchObject({
      kind: 'confirmed_current',
      requiresUserReconfirmation: false,
      requiresProjectionRefresh: false,
      requiresBookkeepingRepair: false,
      sourceChanged: false,
      implementationChanged: false,
      repairableReasons: [],
      currentSemanticHashes: {
        sourceDocumentHash: SOURCE_HASH,
        implementationConfirmationHash: CONFIRMATION_HASH,
      },
    });
  });

  it('returns semantic_reconfirmation_required only for semantic source hash drift', () => {
    expect(
      classify({
        currentHashes: {
          sourceDocumentHash:
            'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          implementationConfirmationHash: CONFIRMATION_HASH,
        },
      })
    ).toMatchObject({
      kind: 'semantic_reconfirmation_required',
      requiresUserReconfirmation: true,
      sourceChanged: true,
      implementationChanged: false,
      blockingReasons: ['source_semantic_hash_changed'],
    });
  });

  it('returns projection_refresh_required for page-hash-only drift', () => {
    expect(
      classify({
        renderReport: {
          confirmationPageHash: NEW_PAGE_HASH,
          reportPath: 'confirmation-render-report.json',
          confirmInstruction: 'confirm',
        },
      })
    ).toMatchObject({
      kind: 'projection_refresh_required',
      requiresUserReconfirmation: false,
      requiresProjectionRefresh: true,
      sourceChanged: false,
      implementationChanged: false,
      repairableReasons: ['confirmation_projection_hash_changed'],
    });
  });

  it('returns stale_bookkeeping_repair_required when source status claims reconfirmation but semantic hashes match', () => {
    expect(
      classify({
        confirmation: confirmation({
          status: 'reconfirm_required',
          reconfirmationRequest: {
            required: true,
            reason: 'source_and_implementation_confirmation_hash_changed',
          },
        }),
      })
    ).toMatchObject({
      kind: 'stale_bookkeeping_repair_required',
      requiresUserReconfirmation: false,
      requiresBookkeepingRepair: true,
      sourceChanged: false,
      implementationChanged: false,
      repairableReasons: expect.arrayContaining([
        'source_status_reconfirm_required_but_semantic_hashes_match',
        'reconfirmation_request_present_but_semantic_hashes_match',
      ]),
    });
  });

  it('treats confirmationRender changes as non-semantic bookkeeping repair, not semantic reconfirmation', () => {
    expect(
      classify({
        confirmation: confirmation({
          confirmationRender: {
            htmlHash: OLD_PAGE_HASH,
            reportPath: 'stale-confirmation-render-report.json',
            confirmationPhrase: 'stale confirm phrase',
          },
        }),
        renderReport: {
          confirmationPageHash: OLD_PAGE_HASH,
          reportPath: 'confirmation-render-report.json',
          confirmInstruction: 'confirm',
        },
      })
    ).toMatchObject({
      kind: 'stale_bookkeeping_repair_required',
      requiresUserReconfirmation: false,
      sourceChanged: false,
      implementationChanged: false,
      currentSemanticHashes: {
        sourceDocumentHash: SOURCE_HASH,
        implementationConfirmationHash: CONFIRMATION_HASH,
      },
      latestConfirmedSemanticHashes: {
        sourceDocumentHash: SOURCE_HASH,
        implementationConfirmationHash: CONFIRMATION_HASH,
      },
      repairableReasons: expect.arrayContaining([
        'confirmation_render_report_path_bookkeeping_stale',
        'confirmation_render_phrase_bookkeeping_stale',
      ]),
    });
  });

  it('treats reconfirmationRequest changes as non-semantic bookkeeping repair when controlled hashes match', () => {
    expect(
      classify({
        confirmation: confirmation({
          reconfirmationRequest: {
            required: true,
            reasonCode: 'source_hash_changed',
            userFacingSummary: 'stale request that contradicts controlled semantic hashes',
          },
        }),
      })
    ).toMatchObject({
      kind: 'stale_bookkeeping_repair_required',
      requiresUserReconfirmation: false,
      sourceChanged: false,
      implementationChanged: false,
      currentSemanticHashes: {
        sourceDocumentHash: SOURCE_HASH,
        implementationConfirmationHash: CONFIRMATION_HASH,
      },
      latestConfirmedSemanticHashes: {
        sourceDocumentHash: SOURCE_HASH,
        implementationConfirmationHash: CONFIRMATION_HASH,
      },
      repairableReasons: expect.arrayContaining([
        'reconfirmation_request_present_but_semantic_hashes_match',
      ]),
    });
  });

  it('uses managed reconfirmation previous hashes as semantic baseline when no record is available', () => {
    expect(
      classifyConfirmationDrift({
        confirmation: confirmation({
          status: 'reconfirm_required',
          sourceDocumentHash: 'sha256:old-source',
          implementationConfirmationHash: 'sha256:old-confirmation',
          reconfirmationRequest: {
            required: true,
            previousSourceDocumentHash: 'sha256:old-source',
            previousImplementationConfirmationHash: 'sha256:old-confirmation',
          },
        }),
        requirementRecord: {},
        currentHashes: {
          sourceDocumentHash: SOURCE_HASH,
          implementationConfirmationHash: CONFIRMATION_HASH,
        },
      })
    ).toMatchObject({
      kind: 'semantic_reconfirmation_required',
      latestConfirmedSemanticHashes: {
        sourceDocumentHash: 'sha256:old-source',
        implementationConfirmationHash: 'sha256:old-confirmation',
      },
    });
  });
});
