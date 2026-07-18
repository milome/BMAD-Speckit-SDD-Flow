import { mkdirSync } from 'node:fs';
import path from 'node:path';
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
  requirementSetId: string;
  title: string;
  semanticModelHash: string;
  sourceAuthorityHash: string;
  proofRefs: {
    intakeReceipt: ProofRef;
    intentLineageLedger: ProofRef;
    semanticConservationManifest: ProofRef;
  };
  sections: RenderSection[];
  implementationConfirmation: {
    compactTraceMarkdown: string;
  };
}): RegisteredPrdRender {
  if (!HASH_PATTERN.test(input.semanticModelHash) || !HASH_PATTERN.test(input.sourceAuthorityHash)) {
    throw new Error('Canonical Source PRD hashes must be SHA256');
  }
  const requirementSetId = nonEmpty(input.requirementSetId, 'requirementSetId');
  const intake = validProofRef(input.proofRefs.intakeReceipt, 'intake receipt');
  const lineage = validProofRef(input.proofRefs.intentLineageLedger, 'intent lineage ledger');
  const conservation = validProofRef(
    input.proofRefs.semanticConservationManifest,
    'semantic conservation manifest'
  );
  const compactTrace = nonEmpty(
    input.implementationConfirmation.compactTraceMarkdown,
    'compact trace markdown'
  );
  const content = [
    '---',
    `requirementSetId: ${requirementSetId}`,
    `semanticModelHash: ${input.semanticModelHash}`,
    `sourceAuthorityHash: ${input.sourceAuthorityHash}`,
    '---',
    '',
    `# ${nonEmpty(input.title, 'title')}`,
    '',
    sectionsMarkdown(input.sections),
    '',
    '## implementationConfirmation',
    '',
    `- intakeReceipt: ${intake.path} ${intake.hash}`,
    `- intentLineageLedger: ${lineage.path} ${lineage.hash}`,
    `- semanticConservationManifest: ${conservation.path} ${conservation.hash}`,
    '',
    compactTrace,
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
