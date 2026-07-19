import { existsSync, mkdirSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { REQUIREMENTS_CONTRACT_SOURCE_PRD_RULES } from '../rules/requirements-contract-source-prd-rules';
import { sha256, writeGovernedText } from './requirements-contract-governed-write';
import { extractRequirementsContractImplementationConfirmation } from './requirements-contract-implementation-confirmation-codec';

type ArtifactRole = 'product_prd' | 'requirement_source_prd';
type RendererId = 'registered_product_prd_renderer' | 'canonical_source_prd_renderer';

export interface RegisteredPrdRender {
  schemaVersion: 'requirements-contract-registered-prd-render/v1';
  artifactRole: ArtifactRole;
  rendererId: RendererId;
  requirementSetId: string | null;
  content: string;
  renderedContentHash: string;
  outputPolicyBinding?: RequirementsContractPrdOutputPolicyBinding;
}

interface RenderSection {
  heading: string;
  body: string;
}

interface ProofRef {
  path: string;
  hash: string;
}

export interface RequirementsContractPrdOutputPolicy {
  shadowOutputEnabled: boolean;
  v1OutputEnabled: boolean;
  productionReadModelVersion: 'v1' | 'v2';
}

export interface RequirementsContractPrdOutputPolicyBinding {
  registryPath: string;
  registryExists: boolean;
  registryHash: string | null;
  outputPolicy: RequirementsContractPrdOutputPolicy | null;
}

const registeredRenders = new WeakSet<object>();
const HASH_PATTERN = /^sha256:[a-f0-9]{64}$/u;
const PRODUCT_PRD_FORBIDDEN_CONTENT = [
  { label: 'implementationConfirmation', pattern: /implementationConfirmation/iu },
  { label: 'Compact Trace', pattern: /compact\s+trace/iu },
  { label: 'Evidence', pattern: /\bevidence\b/iu },
  { label: 'Acceptance matrix', pattern: /acceptance\s+matrix/iu },
  { label: 'Target map', pattern: /target\s+map/iu },
  { label: 'Bundle', pattern: /\bbundle\b/iu },
  { label: 'confirmation-ready', pattern: /confirmation[-\s]ready/iu },
  { label: 'Source PRD authority', pattern: /source\s+prd\s+authority/iu },
] as const;
const CANONICAL_SOURCE_TEMPLATE_PATH = path.resolve(
  __dirname,
  '..',
  'templates',
  'requirements-contract-source-prd-template.md'
);
const CONSUMER_REGISTRY_RELATIVE_PATH =
  '_bmad/shared/requirements-contract/requirements-contract-consumer-registry.json';
const PRODUCTION_OUTPUT_POLICY_LOCK_RELATIVE_PATH =
  '_bmad/shared/requirements-contract/.requirements-contract-consumer-registry.activation.lock';
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
    .map(
      (section) =>
        `## ${nonEmpty(section.heading, 'section heading')}\n\n${nonEmpty(section.body, 'section body')}`
    )
    .join('\n\n');
}

function sealRender(
  input: Omit<RegisteredPrdRender, 'schemaVersion' | 'renderedContentHash'>
): RegisteredPrdRender {
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

function enforcePostCutoverOutputPolicy(input: {
  outputPolicy?: RequirementsContractPrdOutputPolicy;
  implementationConfirmation: string;
}): void {
  if (input.outputPolicy?.productionReadModelVersion !== 'v2') return;
  if (
    input.outputPolicy.shadowOutputEnabled !== false ||
    input.outputPolicy.v1OutputEnabled !== false
  ) {
    throw new Error('V2 activation requires Shadow and V1 output to be disabled');
  }
  const confirmation = extractRequirementsContractImplementationConfirmation(
    input.implementationConfirmation
  ).value as unknown as Record<string, unknown>;
  if (Object.prototype.hasOwnProperty.call(confirmation, 'currentTargetMap')) {
    throw new Error('V2 activation forbids currentTargetMap Source PRD output');
  }
  if (confirmation.contractSchemaVersion === 1) {
    throw new Error('V2 activation forbids V1 contract schema Source PRD output');
  }
}

function readProductionOutputPolicyBinding(
  projectRoot: string
): RequirementsContractPrdOutputPolicyBinding {
  const registryPath = path.resolve(projectRoot, CONSUMER_REGISTRY_RELATIVE_PATH);
  if (!existsSync(registryPath)) {
    return {
      registryPath: CONSUMER_REGISTRY_RELATIVE_PATH,
      registryExists: false,
      registryHash: null,
      outputPolicy: null,
    };
  }
  const registryBytes = readFileSync(registryPath);
  const parsed: unknown = JSON.parse(registryBytes.toString('utf8'));
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Consumer Registry root must be an object');
  }
  const registry = parsed as Record<string, unknown>;
  const selector =
    registry.activation &&
    typeof registry.activation === 'object' &&
    !Array.isArray(registry.activation)
      ? (registry.activation as Record<string, unknown>)
      : registry;
  const selectorKeys = [
    'shadowOutputEnabled',
    'v1OutputEnabled',
    'productionReadModelVersion',
  ] as const;
  const activationAuthorityPresent =
    'activation' in registry ||
    'activationReceiptId' in registry ||
    'activationReceiptId' in selector ||
    selectorKeys.some((key) => key in selector);
  if (!activationAuthorityPresent) {
    return {
      registryPath: CONSUMER_REGISTRY_RELATIVE_PATH,
      registryExists: true,
      registryHash: sha256(registryBytes),
      outputPolicy: null,
    };
  }
  if (
    ![
      'requirements-contract-consumer-registry/v1',
      'requirements-contract-consumer-registry/v2',
    ].includes(String(registry.schemaVersion)) ||
    typeof selector.shadowOutputEnabled !== 'boolean' ||
    typeof selector.v1OutputEnabled !== 'boolean' ||
    !['v1', 'v2'].includes(String(selector.productionReadModelVersion))
  ) {
    throw new Error('Consumer Registry production output selector is invalid');
  }
  return {
    registryPath: CONSUMER_REGISTRY_RELATIVE_PATH,
    registryExists: true,
    registryHash: sha256(registryBytes),
    outputPolicy: {
      shadowOutputEnabled: selector.shadowOutputEnabled,
      v1OutputEnabled: selector.v1OutputEnabled,
      productionReadModelVersion: selector.productionReadModelVersion as 'v1' | 'v2',
    },
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
  const forbiddenContent = PRODUCT_PRD_FORBIDDEN_CONTENT.find(({ pattern }) =>
    pattern.test(content)
  );
  if (forbiddenContent) {
    throw new Error(`Product PRD renderer forbids ${forbiddenContent.label}`);
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
  outputPolicy?: RequirementsContractPrdOutputPolicy;
  outputPolicyBinding?: RequirementsContractPrdOutputPolicyBinding;
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
  enforcePostCutoverOutputPolicy({
    outputPolicy: input.outputPolicy,
    implementationConfirmation: splitSource.implementationConfirmation,
  });
  const authoredSections = sourceSections(splitSource.sourceBody);
  for (const section of SOURCE_AUTHORITY_SECTIONS) {
    if (!authoredSections.get(section)?.trim()) {
      throw new Error(
        `Canonical Source PRD renderer requires source-authorized section: ${section}`
      );
    }
  }
  const templateSections = canonicalTemplateSections();
  const orderedHeadings = [
    ...REQUIREMENTS_CONTRACT_SOURCE_PRD_RULES.requiredHeadings
      .slice(1)
      .map((heading) => heading.replace(/^##\s+/u, '')),
  ];
  const createdDate = nonEmpty(input.createdAt, 'createdAt').slice(0, 10);
  const staticSections = new Map<string, string>([
    [
      'Source Metadata',
      renderedSourceMetadata({
        recordId,
        requirementSetId,
        entrySource: input.entrySource,
        semanticModelHash: input.semanticModelHash,
        sourceAuthorityHash: input.sourceAuthorityHash,
        proofRefs,
      }),
    ],
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
    ...(input.outputPolicyBinding ? { outputPolicyBinding: input.outputPolicyBinding } : {}),
  });
}

export function renderProductionCanonicalRequirementSourcePrd(
  input: Omit<Parameters<typeof renderCanonicalRequirementSourcePrd>[0], 'outputPolicy'> & {
    projectRoot: string;
  }
): RegisteredPrdRender {
  const { projectRoot, ...renderInput } = input;
  const outputPolicyBinding = readProductionOutputPolicyBinding(projectRoot);
  return renderCanonicalRequirementSourcePrd({
    ...renderInput,
    outputPolicy: outputPolicyBinding.outputPolicy ?? undefined,
    outputPolicyBinding,
  });
}

export function assertProductionPrdOutputPolicyCurrent(input: {
  projectRoot: string;
  rendered: RegisteredPrdRender;
  candidateContent?: string;
}): void {
  const expected = input.rendered.outputPolicyBinding;
  if (!expected) {
    throw new Error('Production PRD render is missing its output policy binding');
  }
  const current = readProductionOutputPolicyBinding(input.projectRoot);
  if (
    current.registryExists !== expected.registryExists ||
    current.registryHash !== expected.registryHash
  ) {
    throw new Error('Production output selector changed after rendering');
  }
  if (input.candidateContent && expected.outputPolicy) {
    enforcePostCutoverOutputPolicy({
      outputPolicy: expected.outputPolicy,
      implementationConfirmation: splitImplementationConfirmation(input.candidateContent)
        .implementationConfirmation,
    });
  }
}

export function acquireProductionOutputPolicyLock(projectRoot: string): () => void {
  const lockPath = path.resolve(projectRoot, PRODUCTION_OUTPUT_POLICY_LOCK_RELATIVE_PATH);
  mkdirSync(path.dirname(lockPath), { recursive: true });
  try {
    mkdirSync(lockPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
      throw new Error('Production output policy lock is already held');
    }
    throw error;
  }
  return () => rmSync(lockPath, { recursive: true, force: false });
}

export function withProductionOutputPolicyLock<T>(projectRoot: string, action: () => T): T {
  const release = acquireProductionOutputPolicyLock(projectRoot);
  try {
    return action();
  } finally {
    release();
  }
}

export function writeRegisteredPrdRender(input: {
  rendered: RegisteredPrdRender;
  targetPath: string;
  projectRoot?: string;
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
  const policyBound = Boolean(input.rendered.outputPolicyBinding);
  if (policyBound && !input.projectRoot) {
    throw new Error('Policy-bound registered renderer output requires projectRoot');
  }
  const write = () => {
    const targetExisted = existsSync(targetPath);
    const previousTarget = targetExisted ? readFileSync(targetPath) : null;
    const receiptPath = `${targetPath}.safe-write-receipt.json`;
    const receiptExisted = existsSync(receiptPath);
    const previousReceipt = receiptExisted ? readFileSync(receiptPath) : null;
    try {
      const result = writeGovernedText(targetPath, input.rendered.content);
      if (policyBound) {
        assertProductionPrdOutputPolicyCurrent({
          projectRoot: input.projectRoot as string,
          rendered: input.rendered,
          candidateContent: readFileSync(targetPath, 'utf8'),
        });
        if (sha256(readFileSync(targetPath)) !== input.rendered.renderedContentHash) {
          throw new Error('Safe Writer readback hash does not match registered renderer output');
        }
      }
      return result;
    } catch (error) {
      if (targetExisted) {
        writeFileSync(targetPath, previousTarget as Buffer);
      } else if (existsSync(targetPath)) {
        unlinkSync(targetPath);
      }
      if (receiptExisted) {
        writeFileSync(receiptPath, previousReceipt as Buffer);
      } else if (existsSync(receiptPath)) {
        unlinkSync(receiptPath);
      }
      throw error;
    }
  };
  if (!policyBound) {
    mkdirSync(path.dirname(targetPath), { recursive: true });
    return write();
  }
  const release = acquireProductionOutputPolicyLock(input.projectRoot as string);
  try {
    assertProductionPrdOutputPolicyCurrent({
      projectRoot: input.projectRoot as string,
      rendered: input.rendered,
      candidateContent: input.rendered.content,
    });
    mkdirSync(path.dirname(targetPath), { recursive: true });
    return write();
  } finally {
    release();
  }
}
