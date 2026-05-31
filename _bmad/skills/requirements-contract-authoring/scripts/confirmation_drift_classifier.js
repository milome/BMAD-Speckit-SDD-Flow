const SEMANTIC_RECONFIRMATION_REQUIRED = 'semantic_reconfirmation_required';
const PROJECTION_REFRESH_REQUIRED = 'projection_refresh_required';
const STALE_BOOKKEEPING_REPAIR_REQUIRED = 'stale_bookkeeping_repair_required';
const CONFIRMED_CURRENT = 'confirmed_current';

function normalizeText(value) {
  return String(value ?? '').trim();
}

function asRecord(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function latestConfirmationEvent(record) {
  return asArray(asRecord(record).confirmationHistory)
    .filter((item) => item && typeof item === 'object' && item.eventType === 'confirmation_recorded')
    .at(-1) ?? null;
}

function latestProjectionEvent(record) {
  return asArray(asRecord(record).confirmationProjectionHistory)
    .filter(
      (item) =>
        item &&
        typeof item === 'object' &&
        item.eventType === 'confirmation_projection_refreshed'
    )
    .at(-1) ?? null;
}

function latestProjectionHash(record, latestEvent) {
  const recordObject = asRecord(record);
  const projectionEvent = latestProjectionEvent(recordObject);
  return (
    normalizeText(recordObject.latestConfirmationProjectionHash) ||
    normalizeText(projectionEvent?.newProjectionHash) ||
    normalizeText(recordObject.confirmationPageHash) ||
    normalizeText(latestEvent?.confirmationPageHash) ||
    ''
  );
}

function sourceProjectionHash(confirmation) {
  return normalizeText(asRecord(asRecord(confirmation).confirmationRender).htmlHash);
}

function currentProjectionHash(renderReport, confirmation) {
  return normalizeText(asRecord(renderReport).confirmationPageHash) || sourceProjectionHash(confirmation);
}

function semanticBaseline(record, confirmation) {
  const latestEvent = latestConfirmationEvent(record);
  const request = asRecord(asRecord(confirmation).reconfirmationRequest);
  return {
    latestEvent,
    sourceDocumentHash:
      normalizeText(latestEvent?.sourceDocumentHash) ||
      normalizeText(asRecord(record).sourceDocumentHash) ||
      normalizeText(request.previousSourceDocumentHash) ||
      normalizeText(asRecord(confirmation).sourceDocumentHash),
    implementationConfirmationHash:
      normalizeText(latestEvent?.implementationConfirmationHash) ||
      normalizeText(asRecord(record).implementationConfirmationHash) ||
      normalizeText(request.previousImplementationConfirmationHash) ||
      normalizeText(asRecord(confirmation).implementationConfirmationHash),
  };
}

function classifyConfirmationDrift(input) {
  const confirmation = asRecord(input?.confirmation);
  const record = asRecord(input?.requirementRecord);
  const renderReport = asRecord(input?.renderReport);
  const currentHashes = asRecord(input?.currentHashes);
  const currentSourceHash = normalizeText(currentHashes.sourceDocumentHash);
  const currentImplementationHash = normalizeText(currentHashes.implementationConfirmationHash);
  const baseline = semanticBaseline(record, confirmation);
  const projectionHash = latestProjectionHash(record, baseline.latestEvent) || sourceProjectionHash(confirmation);
  const currentPageHash = currentProjectionHash(renderReport, confirmation);
  const evidenceRefs = [];
  const blockingReasons = [];
  const repairableReasons = [];

  const hasSemanticBaseline =
    Boolean(baseline.sourceDocumentHash) && Boolean(baseline.implementationConfirmationHash);
  const sourceHashChanged =
    hasSemanticBaseline &&
    Boolean(currentSourceHash) &&
    baseline.sourceDocumentHash !== currentSourceHash;
  const implementationHashChanged =
    hasSemanticBaseline &&
    Boolean(currentImplementationHash) &&
    baseline.implementationConfirmationHash !== currentImplementationHash;

  evidenceRefs.push({
    kind: 'semantic_hash_comparison',
    currentSourceDocumentHash: currentSourceHash || null,
    latestConfirmedSourceDocumentHash: baseline.sourceDocumentHash || null,
    currentImplementationConfirmationHash: currentImplementationHash || null,
    latestConfirmedImplementationConfirmationHash:
      baseline.implementationConfirmationHash || null,
  });

  if (sourceHashChanged || implementationHashChanged) {
    if (sourceHashChanged) blockingReasons.push('source_semantic_hash_changed');
    if (implementationHashChanged) {
      blockingReasons.push('implementation_confirmation_semantic_hash_changed');
    }
    return {
      kind: SEMANTIC_RECONFIRMATION_REQUIRED,
      requiresUserReconfirmation: true,
      requiresProjectionRefresh: false,
      requiresBookkeepingRepair: false,
      userFacingReason: blockingReasons.join(', '),
      currentSemanticHashes: {
        sourceDocumentHash: currentSourceHash || null,
        implementationConfirmationHash: currentImplementationHash || null,
      },
      latestConfirmedSemanticHashes: {
        sourceDocumentHash: baseline.sourceDocumentHash || null,
        implementationConfirmationHash: baseline.implementationConfirmationHash || null,
      },
      sourceBookkeepingState: {
        status: normalizeText(confirmation.status) || null,
        sourceDocumentHash: normalizeText(confirmation.sourceDocumentHash) || null,
        implementationConfirmationHash: normalizeText(confirmation.implementationConfirmationHash) || null,
        reconfirmationRequestRequired:
          asRecord(confirmation.reconfirmationRequest).required === true,
        confirmationRenderHash: sourceProjectionHash(confirmation) || null,
      },
      sourceChanged: sourceHashChanged,
      implementationChanged: implementationHashChanged,
      currentSourceDocumentHash: currentSourceHash || null,
      currentImplementationConfirmationHash: currentImplementationHash || null,
      latestConfirmedSourceDocumentHash: baseline.sourceDocumentHash || null,
      latestConfirmedImplementationConfirmationHash:
        baseline.implementationConfirmationHash || null,
      latestConfirmationPageHash: normalizeText(baseline.latestEvent?.confirmationPageHash) || null,
      latestProjectionHash: projectionHash || null,
      currentProjectionHash: currentPageHash || null,
      blockingReasons,
      repairableReasons,
      evidenceRefs,
    };
  }

  const request = asRecord(confirmation.reconfirmationRequest);
  const render = asRecord(confirmation.confirmationRender);
  const sourceStatus = normalizeText(confirmation.status);
  const sourceHashBookkeeping = normalizeText(confirmation.sourceDocumentHash);
  const implementationHashBookkeeping = normalizeText(confirmation.implementationConfirmationHash);

  if (hasSemanticBaseline && sourceStatus === 'reconfirm_required') {
    repairableReasons.push('source_status_reconfirm_required_but_semantic_hashes_match');
  }
  if (hasSemanticBaseline && request.required === true) {
    repairableReasons.push('reconfirmation_request_present_but_semantic_hashes_match');
  }
  if (
    hasSemanticBaseline &&
    sourceHashBookkeeping &&
    currentSourceHash &&
    sourceHashBookkeeping !== currentSourceHash
  ) {
    repairableReasons.push('source_document_hash_bookkeeping_stale');
  }
  if (
    hasSemanticBaseline &&
    implementationHashBookkeeping &&
    currentImplementationHash &&
    implementationHashBookkeeping !== currentImplementationHash
  ) {
    repairableReasons.push('implementation_confirmation_hash_bookkeeping_stale');
  }

  const renderReportPath = normalizeText(renderReport.reportPath) || normalizeText(renderReport.outPath);
  if (
    hasSemanticBaseline &&
    projectionHash &&
    normalizeText(render.htmlHash) &&
    normalizeText(render.htmlHash) !== projectionHash &&
    (!currentPageHash || currentPageHash === projectionHash)
  ) {
    repairableReasons.push('confirmation_render_html_hash_bookkeeping_stale');
  }
  if (
    hasSemanticBaseline &&
    renderReportPath &&
    normalizeText(render.reportPath) &&
    normalizeText(render.reportPath).replace(/\\/g, '/') !== renderReportPath.replace(/\\/g, '/')
  ) {
    repairableReasons.push('confirmation_render_report_path_bookkeeping_stale');
  }
  if (
    hasSemanticBaseline &&
    normalizeText(renderReport.confirmInstruction) &&
    normalizeText(render.confirmationPhrase) &&
    normalizeText(render.confirmationPhrase) !== normalizeText(renderReport.confirmInstruction)
  ) {
    repairableReasons.push('confirmation_render_phrase_bookkeeping_stale');
  }

  evidenceRefs.push({
    kind: 'projection_hash_comparison',
    latestProjectionHash: projectionHash || null,
    currentProjectionHash: currentPageHash || null,
    sourceConfirmationRenderHash: sourceProjectionHash(confirmation) || null,
  });

  if (hasSemanticBaseline && projectionHash && currentPageHash && projectionHash !== currentPageHash) {
    return {
      kind: PROJECTION_REFRESH_REQUIRED,
      requiresUserReconfirmation: false,
      requiresProjectionRefresh: true,
      requiresBookkeepingRepair: false,
      userFacingReason: 'confirmation_projection_hash_changed',
      currentSemanticHashes: {
        sourceDocumentHash: currentSourceHash || null,
        implementationConfirmationHash: currentImplementationHash || null,
      },
      latestConfirmedSemanticHashes: {
        sourceDocumentHash: baseline.sourceDocumentHash || null,
        implementationConfirmationHash: baseline.implementationConfirmationHash || null,
      },
      sourceBookkeepingState: {
        status: sourceStatus || null,
        sourceDocumentHash: sourceHashBookkeeping || null,
        implementationConfirmationHash: implementationHashBookkeeping || null,
        reconfirmationRequestRequired: request.required === true,
        confirmationRenderHash: sourceProjectionHash(confirmation) || null,
      },
      sourceChanged: false,
      implementationChanged: false,
      currentSourceDocumentHash: currentSourceHash || null,
      currentImplementationConfirmationHash: currentImplementationHash || null,
      latestConfirmedSourceDocumentHash: baseline.sourceDocumentHash || null,
      latestConfirmedImplementationConfirmationHash:
        baseline.implementationConfirmationHash || null,
      latestConfirmationPageHash: normalizeText(baseline.latestEvent?.confirmationPageHash) || null,
      latestProjectionHash: projectionHash || null,
      currentProjectionHash: currentPageHash || null,
      blockingReasons,
      repairableReasons: ['confirmation_projection_hash_changed'],
      evidenceRefs,
    };
  }

  if (repairableReasons.length > 0) {
    return {
      kind: STALE_BOOKKEEPING_REPAIR_REQUIRED,
      requiresUserReconfirmation: false,
      requiresProjectionRefresh: false,
      requiresBookkeepingRepair: true,
      userFacingReason: repairableReasons.join(', '),
      currentSemanticHashes: {
        sourceDocumentHash: currentSourceHash || null,
        implementationConfirmationHash: currentImplementationHash || null,
      },
      latestConfirmedSemanticHashes: {
        sourceDocumentHash: baseline.sourceDocumentHash || null,
        implementationConfirmationHash: baseline.implementationConfirmationHash || null,
      },
      sourceBookkeepingState: {
        status: sourceStatus || null,
        sourceDocumentHash: sourceHashBookkeeping || null,
        implementationConfirmationHash: implementationHashBookkeeping || null,
        reconfirmationRequestRequired: request.required === true,
        confirmationRenderHash: sourceProjectionHash(confirmation) || null,
      },
      sourceChanged: false,
      implementationChanged: false,
      currentSourceDocumentHash: currentSourceHash || null,
      currentImplementationConfirmationHash: currentImplementationHash || null,
      latestConfirmedSourceDocumentHash: baseline.sourceDocumentHash || null,
      latestConfirmedImplementationConfirmationHash:
        baseline.implementationConfirmationHash || null,
      latestConfirmationPageHash: normalizeText(baseline.latestEvent?.confirmationPageHash) || null,
      latestProjectionHash: projectionHash || null,
      currentProjectionHash: currentPageHash || null,
      blockingReasons,
      repairableReasons,
      evidenceRefs,
    };
  }

  return {
    kind: CONFIRMED_CURRENT,
    requiresUserReconfirmation: false,
    requiresProjectionRefresh: false,
    requiresBookkeepingRepair: false,
    userFacingReason: 'confirmed_current',
    currentSemanticHashes: {
      sourceDocumentHash: currentSourceHash || null,
      implementationConfirmationHash: currentImplementationHash || null,
    },
    latestConfirmedSemanticHashes: {
      sourceDocumentHash: baseline.sourceDocumentHash || null,
      implementationConfirmationHash: baseline.implementationConfirmationHash || null,
    },
    sourceBookkeepingState: {
      status: sourceStatus || null,
      sourceDocumentHash: sourceHashBookkeeping || null,
      implementationConfirmationHash: implementationHashBookkeeping || null,
      reconfirmationRequestRequired: request.required === true,
      confirmationRenderHash: sourceProjectionHash(confirmation) || null,
    },
    sourceChanged: false,
    implementationChanged: false,
    currentSourceDocumentHash: currentSourceHash || null,
    currentImplementationConfirmationHash: currentImplementationHash || null,
    latestConfirmedSourceDocumentHash: baseline.sourceDocumentHash || null,
    latestConfirmedImplementationConfirmationHash:
      baseline.implementationConfirmationHash || null,
    latestConfirmationPageHash: normalizeText(baseline.latestEvent?.confirmationPageHash) || null,
    latestProjectionHash: projectionHash || null,
    currentProjectionHash: currentPageHash || null,
    blockingReasons,
    repairableReasons,
    evidenceRefs,
  };
}

module.exports = {
  CONFIRMED_CURRENT,
  PROJECTION_REFRESH_REQUIRED,
  SEMANTIC_RECONFIRMATION_REQUIRED,
  STALE_BOOKKEEPING_REPAIR_REQUIRED,
  classifyConfirmationDrift,
  latestConfirmationEvent,
  latestProjectionEvent,
  latestProjectionHash,
};
