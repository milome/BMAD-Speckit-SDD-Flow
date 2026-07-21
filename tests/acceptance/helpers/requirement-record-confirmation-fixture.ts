type RecordedConfirmationHistoryInput = {
  recordId: string;
  requirementSetId?: string;
  sourcePath: string;
  sourceDocumentHash: string;
  implementationConfirmationHash: string;
  confirmationPageHash?: string;
  confirmedAt?: string;
  confirmedBy?: string;
  confirmationText?: string;
  renderReportPath?: string;
  htmlPath?: string;
};

const DEFAULT_CONFIRMATION_PAGE_HASH =
  'sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc';

// Use only for fixtures whose setup already represents completed user confirmation.
export function createRecordedConfirmationHistory(
  input: RecordedConfirmationHistoryInput
): Array<Record<string, unknown>> {
  const requirementSetId = input.requirementSetId ?? input.recordId;
  const confirmationPageHash =
    input.confirmationPageHash ?? DEFAULT_CONFIRMATION_PAGE_HASH;
  const confirmationText =
    input.confirmationText ??
    [
      '确认以上范围进入下一阶段',
      `sourceDocumentHash=${input.sourceDocumentHash}`,
      `implementationConfirmationHash=${input.implementationConfirmationHash}`,
      `confirmationPageHash=${confirmationPageHash}`,
    ].join('\n');

  return [
    {
      eventType: 'confirmation_recorded',
      recordId: input.recordId,
      requirementSetId,
      confirmedAt: input.confirmedAt ?? '2026-07-19T00:00:00.000Z',
      confirmedBy: input.confirmedBy ?? 'acceptance-fixture-user',
      sourcePath: input.sourcePath,
      sourceDocumentHash: input.sourceDocumentHash,
      sourceDocumentHashScope: 'semantic_source_excluding_confirmation_bookkeeping',
      implementationConfirmationHash: input.implementationConfirmationHash,
      implementationConfirmationHashScope:
        'semantic_implementation_confirmation_excluding_bookkeeping',
      confirmationPageHash,
      confirmationText,
      renderReportPath:
        input.renderReportPath ??
        `_bmad-output/runtime/requirement-records/${input.recordId}/confirmation/confirmation-render-report.json`,
      htmlPath:
        input.htmlPath ??
        `_bmad-output/runtime/requirement-records/${input.recordId}/confirmation/confirmation.html`,
    },
  ];
}
