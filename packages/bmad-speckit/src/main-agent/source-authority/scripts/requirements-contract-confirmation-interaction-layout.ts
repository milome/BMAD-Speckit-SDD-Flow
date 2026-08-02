type ProjectKind = 'consumer_product' | 'governance_framework' | 'hybrid';

interface ConfirmationInteractionLayoutInput {
  projectKind: ProjectKind;
  businessBehaviorDeltaMarkdown: string;
  primarySequenceMarkdown: string;
  failureSequenceMarkdown?: string;
  stateLifecycleMarkdown?: string;
  implementationImpactMapMarkdown: string;
  deploymentDeltaMarkdown?: string;
  compactTraceMarkdown: string;
  frameworkAssuranceMarkdown: string;
  diagramReports?: Array<{
    diagramId: string;
    scope: 'product' | 'governance';
    fontSizePx: number;
    participantGapPx: number;
    messageRowHeightPx: number;
    scale: number;
  }>;
}

function nonEmpty(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label} must be non-empty`);
  return normalized;
}

export function renderRequirementsContractConfirmationInteractionLayout(
  input: ConfirmationInteractionLayoutInput
) {
  const diagramReports = input.diagramReports ?? [];
  const consumerGovernanceDiagramCount =
    input.projectKind === 'consumer_product'
      ? diagramReports.filter((diagram) => diagram.scope === 'governance').length
      : 0;
  if (
    input.projectKind === 'consumer_product' &&
    (consumerGovernanceDiagramCount > 0 ||
      /```mermaid[\s\S]*\bgovernance\b/iu.test(input.frameworkAssuranceMarkdown))
  ) {
    throw new Error('consumer confirmation forbids framework governance diagrams');
  }
  const duplicateDiagramRenderCount =
    diagramReports.length - new Set(diagramReports.map((diagram) => diagram.diagramId)).size;
  const diagramReadabilityViolationCount = diagramReports.filter(
    (diagram) =>
      diagram.fontSizePx < 14 ||
      diagram.participantGapPx < 24 ||
      diagram.messageRowHeightPx < 28 ||
      diagram.scale !== 1
  ).length;
  const sections = [
    ['Business Behavior Delta', input.businessBehaviorDeltaMarkdown],
    ['Primary Sequence', input.primarySequenceMarkdown],
    ['Failure And Compensation Sequence', input.failureSequenceMarkdown],
    ['State Lifecycle', input.stateLifecycleMarkdown],
    ['Implementation Impact Map', input.implementationImpactMapMarkdown],
    ['Deployment Delta', input.deploymentDeltaMarkdown],
    ['Compact Trace Matrix', input.compactTraceMarkdown],
  ].filter((section): section is [string, string] => Boolean(section[1]?.trim()));
  const frameworkAssurance = nonEmpty(
    input.frameworkAssuranceMarkdown,
    'frameworkAssuranceMarkdown'
  );
  const sectionOrder = [...sections.map(([heading]) => heading), 'Framework Assurance'];
  const content = [
    ...sections.flatMap(([heading, body]) => [
      `## ${heading}`,
      '',
      nonEmpty(body, heading),
      '',
    ]),
    '<details>',
    '<summary>Framework Assurance</summary>',
    '',
    frameworkAssurance,
    '',
    '</details>',
    '',
  ].join('\n');
  return {
    schemaVersion: 'requirements-contract-confirmation-interaction-layout/v1',
    projectKind: input.projectKind,
    sectionOrder,
    content,
    consumerGovernanceDiagramCount,
    duplicateDiagramRenderCount,
    diagramReadabilityViolationCount,
  };
}
