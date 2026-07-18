import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { REQUIREMENTS_CONTRACT_SOURCE_PRD_RULES } from '../rules/requirements-contract-source-prd-rules';
import {
  sha256,
  writeGovernedText,
} from './requirements-contract-governed-write';

type ArtifactRole = 'product_prd' | 'requirement_source_prd';
type RendererId = 'registered_product_prd_renderer' | 'canonical_source_prd_renderer';

export interface RegisteredPrdRender {
  schemaVersion: 'requirements-contract-registered-prd-render/v1';
  artifactRole: ArtifactRole;
  rendererId: RendererId;
  requirementSetId: string | null;
  content: string;
  renderedContentHash: string;
}

interface RenderSection {
  heading: string;
  body: string;
}

interface ProofRef {
  path: string;
  hash: string;
}

const registeredRenders = new WeakSet<object>();
const HASH_PATTERN = /^sha256:[a-f0-9]{64}$/u;
const CANONICAL_SOURCE_TEMPLATE_PATH = path.resolve(
  __dirname,
  '..',
  'templates',
  'requirements-contract-source-prd-template.md'
);
const SOURCE_AUTHORITY_SECTIONS = new Set([
  'Product Context',
  'Success Criteria',
  'In Scope',
  'Out Of Scope',
  'User Journeys',
  'Functional Requirements',
  'Non-Functional Requirements',
  'Negative Requirements And Not Done Conditions',
  'Architecture Decision Records',
  'Failure Matrix',
  'Acceptance Evidence',
  'Test And Verification Paths',
  'Trace Matrix Source',
  'Implementation Path Map',
  'Source Current State',
  'Source Target State',
  'Current Target Map',
  'Human-Readable ID-Bound Views',
]);

function nonEmpty(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label} must be non-empty`);
  return normalized;
}

function sectionsMarkdown(sections: RenderSection[]): string {
  if (sections.length === 0) throw new Error('PRD renderer requires at least one section');
  return sections
    .map((section) => `## ${nonEmpty(section.heading, 'section heading')}\n\n${nonEmpty(section.body, 'section body')}`)
    .join('\n\n');
}

function sealRender(input: Omit<RegisteredPrdRender, 'schemaVersion' | 'renderedContentHash'>): RegisteredPrdRender {
  const rendered: RegisteredPrdRender = Object.freeze({
    schemaVersion: 'requirements-contract-registered-prd-render/v1',
    ...input,
    renderedContentHash: sha256(input.content),
  });
  registeredRenders.add(rendered);
  return rendered;
}

function validProofRef(value: ProofRef, label: string): ProofRef {
  if (!HASH_PATTERN.test(value.hash)) throw new Error(`${label} hash must be SHA256`);
  return { path: nonEmpty(value.path, `${label} path`), hash: value.hash };
}

function sourceSections(markdown: string): Map<string, string> {
  const lines = markdown.replace(/\r\n/gu, '\n').split('\n');
  const sections = new Map<string, string>();
  let currentHeading = '';
  let currentLines: string[] = [];
  const flush = () => {
    if (currentHeading) sections.set(currentHeading, currentLines.join('\n').trim());
  };
  for (const line of lines) {
    const match = /^##\s+(.+?)\s*$/u.exec(line);
    if (match) {
      flush();
      currentHeading = match[1];
      currentLines = [];
      continue;
    }
    if (currentHeading) currentLines.push(line);
  }
  flush();
  return sections;
}

function splitImplementationConfirmation(sourceText: string): {
  sourceBody: string;
  implementationConfirmation: string;
} {
  const lines = sourceText.replace(/\r\n/gu, '\n').split('\n');
  const start = lines.findIndex((line) => /^implementationConfirmation:\s*$/u.test(line));
  if (start < 0) {
    throw new Error('Canonical Source PRD renderer requires implementationConfirmation');
  }
  return {
    sourceBody: lines.slice(0, start).join('\n'),
    implementationConfirmation: nonEmpty(
      lines.slice(start).join('\n'),
      'implementationConfirmation'
    ),
  };
}

function canonicalTemplateSections(): Map<string, string> {
  return sourceSections(readFileSync(CANONICAL_SOURCE_TEMPLATE_PATH, 'utf8'));
}

function renderedSourceMetadata(input: {
  recordId: string;
  requirementSetId: string;
  entrySource: string;
  semanticModelHash: string;
  sourceAuthorityHash: string;
  proofRefs: {
    intakeReceipt: ProofRef;
    intentLineageLedger: ProofRef;
    semanticConservationManifest: ProofRef;
  };
}): string {
  return [
    '```yaml',
    'sourceDocument:',
    `  id: ${input.recordId}`,
    `  requirementSetId: ${input.requirementSetId}`,
    '  status: draft',
    '  authoritativeImplementationSource: true',
    '  sourceKind: requirements_contract_source_prd',
    'classification:',
    '  domain: requirements_contract',
    '  projectType: canonical_source_prd',
    `  projectSubtype: ${input.entrySource}`,
    'authoring:',
    `  mode: ${input.entrySource}`,
    '  implementationConfirmationStatus: draft',
    '  implementationReadiness: false',
    '  userConfirmed: false',
    `semanticModelHash: ${input.semanticModelHash}`,
    `sourceAuthorityHash: ${input.sourceAuthorityHash}`,
    'upstreamProofs:',
    `  intakeReceipt: ${input.proofRefs.intakeReceipt.path} ${input.proofRefs.intakeReceipt.hash}`,
    `  intentLineageLedger: ${input.proofRefs.intentLineageLedger.path} ${input.proofRefs.intentLineageLedger.hash}`,
    `  semanticConservationManifest: ${input.proofRefs.semanticConservationManifest.path} ${input.proofRefs.semanticConservationManifest.hash}`,
    '```',
  ].join('\n');
}

function renderedValidationProvenance(input: {
  proofRefs: {
    intakeReceipt: ProofRef;
    intentLineageLedger: ProofRef;
    semanticConservationManifest: ProofRef;
  };
}): string {
  return [
    'The canonical renderer consumed these upstream proof artifacts:',
    '',
    `- Intake Receipt: \`${input.proofRefs.intakeReceipt.path}\` ${input.proofRefs.intakeReceipt.hash}`,
    `- Intent Lineage Ledger: \`${input.proofRefs.intentLineageLedger.path}\` ${input.proofRefs.intentLineageLedger.hash}`,
    `- Semantic Conservation Manifest: \`${input.proofRefs.semanticConservationManifest.path}\` ${input.proofRefs.semanticConservationManifest.hash}`,
  ].join('\n');
}

export function renderProductPrd(input: {
  title: string;
  sections: RenderSection[];
}): RegisteredPrdRender {
  const content = `# ${nonEmpty(input.title, 'title')}\n\n${sectionsMarkdown(input.sections)}\n`;
  if (/implementationConfirmation/iu.test(content)) {
    throw new Error('Product PRD renderer forbids implementationConfirmation');
  }
  return sealRender({
    artifactRole: 'product_prd',
    rendererId: 'registered_product_prd_renderer',
    requirementSetId: null,
    content,
  });
}

export function renderCanonicalRequirementSourcePrd(input: {
  recordId: string;
  requirementSetId: string;
  title: string;
  entrySource: 'bmad_prd' | 'session_requirements' | 'source_prd_draft';
  createdAt: string;
  semanticModelHash: string;
  sourceAuthorityHash: string;
  proofRefs: {
    intakeReceipt: ProofRef;
    intentLineageLedger: ProofRef;
    semanticConservationManifest: ProofRef;
  };
  sourceText: string;
}): RegisteredPrdRender {
  if (!HASH_PATTERN.test(input.semanticModelHash)) {
    throw new Error('Canonical Source PRD semanticModelHash must be SHA256');
  }
  if (!HASH_PATTERN.test(input.sourceAuthorityHash)) {
    throw new Error('Canonical Source PRD sourceAuthorityHash must be SHA256');
  }
  const recordId = nonEmpty(input.recordId, 'recordId');
  const requirementSetId = nonEmpty(input.requirementSetId, 'requirementSetId');
  const intake = validProofRef(input.proofRefs.intakeReceipt, 'intake receipt');
  const lineage = validProofRef(input.proofRefs.intentLineageLedger, 'intent lineage ledger');
  const conservation = validProofRef(
    input.proofRefs.semanticConservationManifest,
    'semantic conservation manifest'
  );
  const proofRefs = {
    intakeReceipt: intake,
    intentLineageLedger: lineage,
    semanticConservationManifest: conservation,
  };
  const splitSource = splitImplementationConfirmation(input.sourceText);
  const authoredSections = sourceSections(splitSource.sourceBody);
  for (const section of SOURCE_AUTHORITY_SECTIONS) {
    if (!authoredSections.get(section)?.trim()) {
      throw new Error(`Canonical Source PRD renderer requires source-authorized section: ${section}`);
    }
  }
  const templateSections = canonicalTemplateSections();
  const orderedHeadings = [
    ...REQUIREMENTS_CONTRACT_SOURCE_PRD_RULES.requiredHeadings.slice(1).map((heading) =>
      heading.replace(/^##\s+/u, '')
    ),
  ];
  const createdDate = nonEmpty(input.createdAt, 'createdAt').slice(0, 10);
  const staticSections = new Map<string, string>([
    ['Source Metadata', renderedSourceMetadata({
      recordId,
      requirementSetId,
      entrySource: input.entrySource,
      semanticModelHash: input.semanticModelHash,
      sourceAuthorityHash: input.sourceAuthorityHash,
      proofRefs,
    })],
    [
      'Revision History',
      [
        '| Date | Change | Author | Notes |',
        '| --- | --- | --- | --- |',
        `| ${createdDate} | Canonical Source PRD rendered from immutable intake. | canonical_source_prd_renderer | Requirement-bearing rows remain source-authorized. |`,
      ].join('\n'),
    ],
    ['Validation Provenance', renderedValidationProvenance({ proofRefs })],
    ['Audit Findings', 'No renderer-authored requirement semantics or acceptance decisions.'],
    ['Comments', 'Renderer output is a deterministic projection of source-authorized sections.'],
    ['Change Log', `Canonical rendering completed for ${requirementSetId}.`],
  ]);
  const renderedSections = orderedHeadings.map((heading) => {
    if (SOURCE_AUTHORITY_SECTIONS.has(heading)) {
      return `## ${heading}\n\n${nonEmpty(authoredSections.get(heading) ?? '', heading)}`;
    }
    const body = staticSections.get(heading) ?? templateSections.get(heading);
    return `## ${heading}\n\n${nonEmpty(body ?? '', heading)}`;
  });
  const knownHeadings = new Set(orderedHeadings);
  const extensionSections = [...authoredSections.entries()]
    .filter(([heading, body]) => !knownHeadings.has(heading) && body.trim())
    .map(([heading, body]) => `## ${heading}\n\n${body.trim()}`);
  const content = [
    '---',
    `id: ${recordId}`,
    `title: ${JSON.stringify(nonEmpty(input.title, 'title'))}`,
    'status: draft',
    'authoritativeImplementationSource: true',
    'sourceKind: requirements_contract_source_prd',
    'classification:',
    '  domain: requirements_contract',
    '  projectType: canonical_source_prd',
    `  projectSubtype: ${input.entrySource}`,
    'authoring:',
    `  mode: ${input.entrySource}`,
    '  implementationConfirmationStatus: draft',
    '  implementationReadiness: false',
    '  userConfirmed: false',
    `requirementSetId: ${requirementSetId}`,
    `semanticModelHash: ${input.semanticModelHash}`,
    `sourceAuthorityHash: ${input.sourceAuthorityHash}`,
    '---',
    '',
    '# Requirements Contract Source PRD Template',
    '',
    renderedSections.join('\n\n'),
    ...(extensionSections.length > 0 ? ['', extensionSections.join('\n\n')] : []),
    '',
    splitSource.implementationConfirmation,
    '',
  ].join('\n');
  return sealRender({
    artifactRole: 'requirement_source_prd',
    rendererId: 'canonical_source_prd_renderer',
    requirementSetId,
    content,
  });
}

export function writeRegisteredPrdRender(input: {
  rendered: RegisteredPrdRender;
  targetPath: string;
}) {
  if (!registeredRenders.has(input.rendered)) {
    throw new Error('Safe Writer requires registered renderer output');
  }
  const expectedRenderer =
    input.rendered.artifactRole === 'product_prd'
      ? 'registered_product_prd_renderer'
      : 'canonical_source_prd_renderer';
  if (
    input.rendered.rendererId !== expectedRenderer ||
    input.rendered.renderedContentHash !== sha256(input.rendered.content)
  ) {
    throw new Error('Safe Writer rejected mismatched registered renderer output');
  }
  const targetPath = path.resolve(nonEmpty(input.targetPath, 'targetPath'));
  mkdirSync(path.dirname(targetPath), { recursive: true });
  return writeGovernedText(targetPath, input.rendered.content);
}
