export interface ConsumerConfirmationOraclePolicy {
  projectKind: 'consumer_product' | 'governance_framework' | 'hybrid';
  requiredSectionRoles: readonly string[];
  minFontPx: number;
  minParticipantGapPx: number;
  minMessageRowHeightPx: number;
  requiredScale: number;
}

export interface ConsumerConfirmationDiagramMeasurement {
  diagramId: string;
  fontPx: number;
  participantGapPx: number;
  messageRowHeightPx: number;
  scale: number;
}

export interface ConsumerConfirmationOracleInput {
  html: string;
  summary: unknown;
  report: unknown;
  measurements: ConsumerConfirmationDiagramMeasurement[];
  policy: ConsumerConfirmationOraclePolicy;
}

export interface ConsumerConfirmationOracleCheck {
  id: string;
  status: 'pass' | 'block' | 'unverifiable';
  selectorOrPath: string;
  evidence: string[];
  diagramId?: string;
}

export interface ConsumerConfirmationOracleResult {
  schemaVersion: 'consumer-confirmation-independent-oracle/v1';
  decision: 'pass' | 'block' | 'unverifiable';
  counts: {
    duplicateDiagramRenderCount: number;
    diagramReadabilityViolationCount: number;
    consumerGovernanceDiagramCount: number;
    forbiddenArrowMetadataCount: number;
    missingChildExpansionCount: number;
    sectionOrderMismatchCount: number;
  };
  checks: ConsumerConfirmationOracleCheck[];
}

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function attributeValue(tag: string, name: string): string | null {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
  const match = tag.match(new RegExp(`\\b${escapedName}=(["'])(.*?)\\1`, 'iu'));
  return match?.[2] ?? null;
}

function sectionTags(html: string): string[] {
  return Array.from(html.matchAll(/<section\b[^>]*>/giu), (match) => match[0]);
}

function observedSectionRoles(html: string): string[] {
  return sectionTags(html)
    .map((tag) => attributeValue(tag, 'data-confirmation-role'))
    .filter((role): role is string => Boolean(role));
}

function diagramRenderIds(html: string): string[] {
  return Array.from(html.matchAll(/<[^>]*\bdata-mermaid-render\b[^>]*>/giu), (match) =>
    attributeValue(match[0], 'data-diagram-id')
  ).filter((id): id is string => Boolean(id));
}

function diagramScopes(html: string): Array<{ diagramId: string; scope: string | null }> {
  return Array.from(
    html.matchAll(/<article\b[^>]*\bdata-diagram-card\b[^>]*>[\s\S]*?<\/article>/giu),
    (match) => {
      const article = match[0];
      const openingTag = article.match(/^<article\b[^>]*>/iu)?.[0] ?? '';
      const renderTag = article.match(/<[^>]*\bdata-mermaid-render\b[^>]*>/iu)?.[0] ?? '';
      return {
        diagramId: attributeValue(renderTag, 'data-diagram-id') ?? '',
        scope: attributeValue(openingTag, 'data-diagram-scope'),
      };
    }
  ).filter((row) => Boolean(row.diagramId));
}

function decodeHtmlText(value: string): string {
  return value
    .replace(/&gt;/giu, '>')
    .replace(/&lt;/giu, '<')
    .replace(/&amp;/giu, '&')
    .replace(/&quot;/giu, '"')
    .replace(/&#39;/giu, "'");
}

function mermaidSources(html: string): string[] {
  return Array.from(
    html.matchAll(/<pre\b[^>]*\bdata-mermaid-source\b[^>]*>([\s\S]*?)<\/pre>/giu),
    (match) => decodeHtmlText(match[1] ?? '')
  );
}

function sequenceArrowLabels(sources: string[]): string[] {
  return sources.flatMap((source) =>
    Array.from(
      source.matchAll(
        /^\s*[A-Za-z0-9_.-]+\s*(?:--?|==?)>>?\s*[A-Za-z0-9_.-]+\s*:\s*(.+)$/gmu
      ),
      (match) => (match[1] ?? '').trim()
    )
  );
}

function messageIds(labels: string[]): string[] {
  return labels
    .map((label) => label.match(/^(MSG-[A-Z0-9-]+)\b/u)?.[1] ?? '')
    .filter(Boolean);
}

function externalMessageTraceIds(html: string): string[] {
  return Array.from(html.matchAll(/\bdata-message-trace-id=(["'])(.*?)\1/giu), (match) =>
    String(match[2] ?? '').trim()
  ).filter(Boolean);
}

function childFlowEvidence(report: unknown, html: string): {
  status: 'pass' | 'block' | 'unverifiable';
  missingCount: number;
  evidence: string[];
} {
  const reportRecord = recordValue(report);
  const applicability = String(reportRecord.childFlowApplicability ?? '');
  if (applicability === 'not_applicable') {
    return { status: 'pass', missingCount: 0, evidence: ['childFlowApplicability=not_applicable'] };
  }
  const expectedRefs = stringArray(reportRecord.blockingChildRefs);
  if (expectedRefs.length === 0) {
    return {
      status: 'unverifiable',
      missingCount: 0,
      evidence: ['report.blockingChildRefs and childFlowApplicability are absent'],
    };
  }
  const observedRefs = new Set(
    Array.from(
      html.matchAll(/\bdata-blocking-child-ref=(["'])(.*?)\1/giu),
      (match) => match[2] ?? ''
    )
  );
  const missing = expectedRefs.filter((ref) => !observedRefs.has(ref));
  return {
    status: missing.length > 0 ? 'block' : 'pass',
    missingCount: missing.length,
    evidence: missing.length > 0 ? missing : expectedRefs,
  };
}

export function evaluateConsumerConfirmationProjection(
  input: ConsumerConfirmationOracleInput
): ConsumerConfirmationOracleResult {
  const checks: ConsumerConfirmationOracleCheck[] = [];
  const sectionRoles = observedSectionRoles(input.html);
  const sectionOrderMismatchCount =
    JSON.stringify(sectionRoles) === JSON.stringify(input.policy.requiredSectionRoles) ? 0 : 1;
  checks.push({
    id: 'section-order',
    status: sectionOrderMismatchCount === 0 ? 'pass' : 'block',
    selectorOrPath: 'section[data-confirmation-role]',
    evidence: sectionRoles,
  });

  const renderIds = diagramRenderIds(input.html);
  const renderCounts = new Map<string, number>();
  for (const id of renderIds) {
    renderCounts.set(id, (renderCounts.get(id) ?? 0) + 1);
  }
  const duplicateDiagramRenderCount = [...renderCounts.values()].reduce(
    (count, occurrences) => count + Math.max(0, occurrences - 1),
    0
  );
  checks.push({
    id: 'diagram-uniqueness',
    status: duplicateDiagramRenderCount === 0 ? 'pass' : 'block',
    selectorOrPath: '[data-mermaid-render][data-diagram-id]',
    evidence: [...renderCounts.entries()].map(([id, count]) => `${id}:${count}`),
  });

  const measurementsById = new Map(
    input.measurements.map((measurement) => [measurement.diagramId, measurement])
  );
  const missingMeasurements = renderIds.filter((id) => !measurementsById.has(id));
  const readabilityViolations = [...new Set(renderIds)].filter((id) => {
    const measurement = measurementsById.get(id);
    return (
      Boolean(measurement) &&
      (measurement!.fontPx < input.policy.minFontPx ||
        measurement!.participantGapPx < input.policy.minParticipantGapPx ||
        measurement!.messageRowHeightPx < input.policy.minMessageRowHeightPx ||
        measurement!.scale < input.policy.requiredScale)
    );
  });
  const diagramReadabilityViolationCount = readabilityViolations.length;
  checks.push({
    id: 'diagram-readability',
    status:
      diagramReadabilityViolationCount > 0
        ? 'block'
        : missingMeasurements.length > 0
          ? 'unverifiable'
          : 'pass',
    selectorOrPath: 'external measurements by data-diagram-id',
    evidence:
      readabilityViolations.length > 0
        ? readabilityViolations
        : missingMeasurements.length > 0
          ? missingMeasurements
          : input.measurements.map((measurement) => measurement.diagramId),
  });

  const scopedDiagrams = diagramScopes(input.html);
  const missingScopes = scopedDiagrams.filter((row) => !row.scope);
  const consumerGovernanceDiagramCount =
    input.policy.projectKind === 'consumer_product'
      ? scopedDiagrams.filter((row) => row.scope === 'governance').length
      : 0;
  checks.push({
    id: 'consumer-diagram-scope',
    status:
      consumerGovernanceDiagramCount > 0
        ? 'block'
        : missingScopes.length > 0
          ? 'unverifiable'
          : 'pass',
    selectorOrPath: '[data-diagram-card][data-diagram-scope]',
    evidence:
      consumerGovernanceDiagramCount > 0
        ? scopedDiagrams
            .filter((row) => row.scope === 'governance')
            .map((row) => row.diagramId)
        : missingScopes.map((row) => row.diagramId),
  });

  const arrowLabels = sequenceArrowLabels(mermaidSources(input.html));
  const forbiddenAuthorityPattern =
    /\b(?:MUST-(?:FR|NFR)-\d+|FR-\d+|NFR-\d+|S\d{1,3}|AC-\d+|ACC-\d+|TR-\d+|TRACE-\d+|EVD-\d+|CMD-\d+)\b/iu;
  const authorityBearingLabels = arrowLabels.filter((label) =>
    forbiddenAuthorityPattern.test(label)
  );
  const invalidMessageLabels = arrowLabels.filter(
    (label) => !/^MSG-[A-Z0-9-]+\b/u.test(label)
  );
  const forbiddenArrowMetadataCount = authorityBearingLabels.length;
  checks.push({
    id: 'message-label-contract',
    status:
      authorityBearingLabels.length > 0 || invalidMessageLabels.length > 0 ? 'block' : 'pass',
    selectorOrPath: '[data-mermaid-source] sequence arrow labels',
    evidence: [...new Set([...authorityBearingLabels, ...invalidMessageLabels])],
  });

  const expectedMessageIds = messageIds(arrowLabels);
  const tracedMessageIds = new Set(externalMessageTraceIds(input.html));
  const missingExternalTraceIds = expectedMessageIds.filter((id) => !tracedMessageIds.has(id));
  checks.push({
    id: 'external-message-trace',
    status: missingExternalTraceIds.length > 0 ? 'block' : 'pass',
    selectorOrPath: '[data-message-trace-id]',
    evidence: missingExternalTraceIds.length > 0 ? missingExternalTraceIds : expectedMessageIds,
  });

  const childFlow = childFlowEvidence(input.report, input.html);
  checks.push({
    id: 'child-flow-expansion',
    status: childFlow.status,
    selectorOrPath: 'report.blockingChildRefs -> [data-blocking-child-ref]',
    evidence: childFlow.evidence,
  });

  const frameworkTag = sectionTags(input.html).find(
    (tag) => attributeValue(tag, 'data-confirmation-role') === 'framework-assurance'
  );
  const frameworkCollapsed = attributeValue(frameworkTag ?? '', 'data-collapsed');
  checks.push({
    id: 'framework-assurance-collapsed',
    status: frameworkCollapsed === 'true' ? 'pass' : 'block',
    selectorOrPath:
      'section[data-confirmation-role="framework-assurance"][data-collapsed="true"]',
    evidence: [frameworkCollapsed ?? '<missing>'],
  });

  const reportOrder = stringArray(recordValue(input.report).renderedSectionOrder);
  const summaryOrder = stringArray(recordValue(input.summary).renderedSectionOrder);
  checks.push({
    id: 'report-summary-order-parity',
    status: JSON.stringify(reportOrder) === JSON.stringify(summaryOrder) ? 'pass' : 'block',
    selectorOrPath: 'report.renderedSectionOrder == summary.renderedSectionOrder',
    evidence: [`report=${reportOrder.join(',')}`, `summary=${summaryOrder.join(',')}`],
  });

  const decision = checks.some((check) => check.status === 'block')
    ? 'block'
    : checks.some((check) => check.status === 'unverifiable')
      ? 'unverifiable'
      : 'pass';
  return {
    schemaVersion: 'consumer-confirmation-independent-oracle/v1',
    decision,
    counts: {
      duplicateDiagramRenderCount,
      diagramReadabilityViolationCount,
      consumerGovernanceDiagramCount,
      forbiddenArrowMetadataCount,
      missingChildExpansionCount: childFlow.missingCount,
      sectionOrderMismatchCount,
    },
    checks,
  };
}
