/* eslint-disable no-console */
import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as yaml from 'js-yaml';
import {
  extractRequirementsContractImplementationConfirmation,
  implementationConfirmationHashFor,
  sourceDocumentHashFor,
  type ImplementationConfirmation,
} from './requirements-contract-implementation-confirmation-codec';
import {
  appendControlEventAndReplay,
  readJson,
  receiptPathForEvent,
  sha256Json,
  sha256Text,
  writeJsonAtomic,
  type ControlCommitResult,
  type ControlStoreCommitDeps,
} from './requirement-record-control-store';
import type { JsonObject } from './requirement-record-live-schema-gate';
import {
  projectControlledIngestWriterRegistry,
  type ControlledIngestWriterRegistrySnapshot,
} from './requirements-contract-controlled-ingest-writer-registry';
import {
  validateRequirementsEffectivePassReceipt,
  type RequirementsEffectivePassReceipt,
} from './requirements-contract-requirements-effective-pass-gate';
import { artifactBytesHash, canonicalRequirementsJson } from './requirements-contract-hash-domains';
import { atomicNoClobberPublish } from './requirements-contract-atomic-no-clobber-publisher';
import { validateRequirementsContractBuildManifest } from './requirements-contract-authoring-manifest';
import { validateRequirementsActiveAuthorityTuple } from './requirements-contract-authority-publication-committer';
import { validateRequirementsContractSemanticIr } from './requirements-contract-semantic-ir';
import { validateRequirementsContractSourceBindingCapsule } from './requirements-contract-source-binding-capsule';
import { resolveEvidenceClaimAuthority } from './requirements-contract-span-registry';
import { sha256Stable } from './requirements-contract-semantic-resolver';
import { createRequirementsContractSourceBindingRefreshReceipt } from './requirements-contract-source-binding-refresh';

const CONFIRMATION_WRITER_ID = 'requirements-confirmation-ingest';
const SAFE_REQUEST_ID = /^[A-Za-z0-9][A-Za-z0-9._-]*$/u;
const MODELS = [
  'requirement_confirmation',
  'architecture_confirmation',
  'implementation_readiness',
  'execution_closure',
  'audit_review',
  'delivery_confirmation',
] as const;

type ConfirmationArgs = Record<string, string | undefined>;

export interface RequirementsContractConfirmationAcceptanceResult {
  ok: boolean;
  action: 'confirm-scope';
  exitCode: number;
  authority: 'main-agent-controlled-confirmation';
  requirementRecordPath: string;
  renderReportPath: string;
  eventLogPath?: string;
  receiptPath?: string;
  artifactIndexPaths?: string[];
  artifactPaths?: string[];
  sourceUpdated?: boolean;
  event?: JsonObject;
  mismatches?: string[];
  error?: string;
}

interface ConfirmationInput {
  root: string;
  args: ConfirmationArgs;
  controlStoreDeps?: ControlStoreCommitDeps;
}

type RequirementsFinalRenderInput = {
  requestId: string;
  confirmationLanguage: string;
  semanticIr: JsonObject;
  resolvedEvidenceIndex: JsonObject;
  effectivePass: JsonObject;
  bindingRefresh?: {
    auditedSourceBindingHash: string;
    currentSourceBindingHash: string;
  };
};

type RequirementsFinalPages = {
  markdown: string;
  html: string;
  exactConfirmationText: string;
};

function records(value: unknown): JsonObject[] {
  return Array.isArray(value)
    ? value.filter(
        (entry): entry is JsonObject =>
          Boolean(entry) && typeof entry === 'object' && !Array.isArray(entry)
      )
    : [];
}

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string')
    : [];
}

function htmlEscape(value: unknown): string {
  return String(value ?? '')
    .replace(/&/gu, '&amp;')
    .replace(/</gu, '&lt;')
    .replace(/>/gu, '&gt;')
    .replace(/"/gu, '&quot;')
    .replace(/'/gu, '&#39;');
}

function displayValue(value: unknown): string {
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

type FinalRequirementRow = JsonObject & {
  id: string;
  text: string;
  oracle: string;
  requirementKind: 'functional' | 'nonfunctional' | 'negative';
  polarity: 'positive' | 'negative';
};

function finalRequirementRows(
  semanticIr: RequirementsFinalRenderInput['semanticIr']
): FinalRequirementRow[] {
  const semantics = object(object(semanticIr.semanticPayload).semantics);
  const rows = records(semantics.requirements).map((row) => {
    const id = String(row.id ?? '').trim();
    const text = String(row.text ?? '').trim();
    const requirementKind = String(row.requirementKind ?? '').trim();
    const polarity = String(row.polarity ?? '').trim();
    const negativeAssertion = String(row.negativeAssertion ?? '').trim();
    const blockingCondition = String(row.blockingCondition ?? '').trim();
    const oracle = String(
      row.oracle ?? row.negativeAssertion ?? row.blockingCondition ?? ''
    ).trim();
    if (
      !id ||
      !text ||
      !oracle ||
      !['functional', 'nonfunctional', 'negative'].includes(requirementKind) ||
      !['positive', 'negative'].includes(polarity) ||
      (requirementKind === 'negative' && polarity !== 'negative') ||
      (requirementKind !== 'negative' && polarity !== 'positive') ||
      (requirementKind === 'negative' && (!negativeAssertion || !blockingCondition))
    ) {
      throw new Error(
        `requirements_final_render_requirement_classification_invalid:${id || '<missing>'}`
      );
    }
    return {
      ...row,
      id,
      text,
      oracle,
      requirementKind: requirementKind as FinalRequirementRow['requirementKind'],
      polarity: polarity as FinalRequirementRow['polarity'],
      ...(requirementKind === 'negative' ? { negativeAssertion, blockingCondition } : {}),
    };
  });
  const ids = new Set<string>();
  for (const row of rows) {
    if (ids.has(row.id))
      throw new Error(`requirements_final_render_requirement_identity_duplicate:${row.id}`);
    ids.add(row.id);
  }
  if (rows.length === 0) throw new Error('requirements_final_render_requirement_rows_missing');
  return rows;
}

function requirementsConfirmationText(input: RequirementsFinalRenderInput): string {
  const phrase =
    input.confirmationLanguage === 'zh-CN'
      ? '确认以上需求范围进入下一阶段'
      : 'Confirm the Requirements scope above for the next stage';
  return [
    phrase,
    `requestId=${input.requestId}`,
    `semanticRevisionId=${input.semanticIr.semanticRevisionId}`,
    `scopeSemanticHash=${input.semanticIr.scopeSemanticHash}`,
    `bindingRevisionId=${input.resolvedEvidenceIndex.bindingRevisionId}`,
    `requirementsEffectivePassHash=${input.effectivePass.requirementsEffectivePassHash}`,
  ].join('\n');
}

export function projectRequirementsContractFinalPages(
  input: RequirementsFinalRenderInput
): RequirementsFinalPages {
  const semantics = object(input.semanticIr.semanticPayload).semantics as Record<string, unknown>;
  const requirements = finalRequirementRows(input.semanticIr);
  const atoms = records(object(semantics).atoms);
  const decisions = records(object(semantics).decisions);
  const claims = records(object(input.semanticIr.semanticPayload).evidenceClaims);
  const exactConfirmationText = requirementsConfirmationText(input);
  const markdown = [
    '# Requirements Contract',
    '',
    `Request: \`${input.requestId}\``,
    `Semantic revision: \`${input.semanticIr.semanticRevisionId}\``,
    `Binding revision: \`${input.resolvedEvidenceIndex.bindingRevisionId}\``,
    '',
    '## Requirements',
    '',
    ...requirements.flatMap((requirement) => [
      `### ${requirement.id}`,
      '',
      String(requirement.text),
      '',
      requirement.requirementKind === 'negative'
        ? `Negative assertion: ${requirement.oracle}`
        : `Acceptance oracle: ${requirement.oracle}`,
      `Requirement kind: ${requirement.requirementKind}`,
      `Polarity: ${requirement.polarity}`,
      ...(requirement.requirementKind === 'negative'
        ? [`Blocks completion when: ${String(requirement.blockingCondition ?? requirement.oracle)}`]
        : []),
      '',
      ...atoms
        .filter((atom) => atom.requirementRef === requirement.id)
        .map((atom) => `- ${atom.id}: ${atom.action} | ${atom.oracle}`),
      '',
    ]),
    '## Confirmed Decisions',
    '',
    ...(decisions.length > 0
      ? decisions.flatMap((decision) => [
          `### ${decision.questionId}`,
          '',
          String(decision.question),
          '',
          `Fields: ${strings(decision.affectedFieldIds).join(', ')}`,
          `Answer: ${displayValue(decision.answerValue)}`,
          `Decision receipt: ${decision.decisionReceiptRef}`,
          '',
        ])
      : ['No user decisions were required.', '']),
    '## Authority Citations',
    '',
    ...claims.map(
      (claim) =>
        `- ${claim.evidenceClaimId}: ${claim.authorityClass}` +
        (Array.isArray(claim.decisionReceiptRefs) && claim.decisionReceiptRefs.length > 0
          ? ` (${claim.decisionReceiptRefs.join(', ')})`
          : '')
    ),
    '',
    '## Confirmation',
    '',
    '```text',
    exactConfirmationText,
    '```',
    '',
  ].join('\n');
  const html = [
    '<!doctype html>',
    `<html lang="${htmlEscape(input.confirmationLanguage)}">`,
    '<head><meta charset="utf-8"><title>Requirements Contract</title></head>',
    '<body>',
    `<main data-request-id="${htmlEscape(input.requestId)}" data-semantic-revision-id="${htmlEscape(input.semanticIr.semanticRevisionId)}">`,
    '<h1>Requirements Contract</h1>',
    '<section id="requirements"><h2>Requirements</h2>',
    ...requirements.map(
      (requirement) =>
        `<article data-requirement-id="${htmlEscape(requirement.id)}" data-requirement-kind="${htmlEscape(requirement.requirementKind)}" data-requirement-polarity="${htmlEscape(requirement.polarity)}"><h3>${htmlEscape(requirement.id)}</h3><p data-requirement-classification><strong>Requirement kind:</strong> ${htmlEscape(requirement.requirementKind)} <strong>Polarity:</strong> ${htmlEscape(requirement.polarity)}</p><p data-requirement-text>${htmlEscape(requirement.text)}</p><p data-requirement-oracle${requirement.requirementKind === 'negative' ? ' data-negative-assertion' : ''}><strong>${requirement.requirementKind === 'negative' ? 'Negative assertion' : 'Acceptance oracle'}:</strong> ${htmlEscape(requirement.oracle)}</p>${requirement.requirementKind === 'negative' ? `<p data-blocking-condition><strong>Blocks completion when:</strong> ${htmlEscape(requirement.blockingCondition ?? requirement.oracle)}</p>` : ''}</article>`
    ),
    '</section>',
    '<section id="confirmed-decisions"><h2>Confirmed Decisions</h2>',
    ...decisions.map(
      (decision) =>
        `<article data-decision-receipt="${htmlEscape(decision.decisionReceiptRef)}"><h3>${htmlEscape(decision.questionId)}</h3><p>${htmlEscape(decision.question)}</p><p>${htmlEscape(strings(decision.affectedFieldIds).join(', '))}</p><pre>${htmlEscape(displayValue(decision.answerValue))}</pre></article>`
    ),
    '</section>',
    '<section id="authority-citations"><h2>Authority Citations</h2><ul>',
    ...claims.map(
      (claim) =>
        `<li data-evidence-claim="${htmlEscape(claim.evidenceClaimId)}">${htmlEscape(claim.evidenceClaimId)}: ${htmlEscape(claim.authorityClass)}</li>`
    ),
    '</ul></section>',
    `<section id="confirmation"><h2>Confirmation</h2><pre>${htmlEscape(exactConfirmationText)}</pre></section>`,
    '</main>',
    '</body></html>',
    '',
  ].join('\n');
  return { markdown, html, exactConfirmationText };
}

export function validateRequirementsContractFinalRenderProjection(
  input: RequirementsFinalRenderInput & { pages: RequirementsFinalPages }
) {
  const issueCodes: string[] = [];
  const semanticValidation = validateRequirementsContractSemanticIr(input.semanticIr);
  issueCodes.push(
    ...semanticValidation.issueCodes.map((code) => `requirements_final_render_${code}`)
  );
  const passBindingCurrent =
    input.effectivePass.sourceBindingHash === input.resolvedEvidenceIndex.sourceBindingHash;
  const passBindingRefreshValid = Boolean(
    input.bindingRefresh &&
    input.effectivePass.sourceBindingHash === input.bindingRefresh.auditedSourceBindingHash &&
    input.resolvedEvidenceIndex.sourceBindingHash === input.bindingRefresh.currentSourceBindingHash
  );
  if (
    input.effectivePass.decision !== 'pass' ||
    input.effectivePass.semanticRevisionId !== input.semanticIr.semanticRevisionId ||
    input.effectivePass.scopeSemanticHash !== input.semanticIr.scopeSemanticHash ||
    (!passBindingCurrent && !passBindingRefreshValid)
  ) {
    issueCodes.push('requirements_final_render_effective_pass_stale');
  }
  if (input.resolvedEvidenceIndex.semanticRevisionId !== input.semanticIr.semanticRevisionId) {
    issueCodes.push('requirements_final_render_resolved_evidence_stale');
  }
  const resolutionByClaim = new Map(
    records(input.resolvedEvidenceIndex.resolutions).map((resolution) => [
      resolution.evidenceClaimId,
      resolution,
    ])
  );
  for (const claim of records(object(input.semanticIr.semanticPayload).evidenceClaims)) {
    const resolution = resolutionByClaim.get(claim.evidenceClaimId);
    if (!resolution || resolution.authorityClass !== claim.authorityClass) {
      issueCodes.push('requirements_final_render_authority_resolution_missing');
      continue;
    }
    const authority = resolveEvidenceClaimAuthority(resolution as never);
    issueCodes.push(...authority.issueCodes.map((code) => `requirements_final_render_${code}`));
  }
  const semantics = object(input.semanticIr.semanticPayload).semantics as Record<string, unknown>;
  let requirements: FinalRequirementRow[] = [];
  try {
    requirements = finalRequirementRows(input.semanticIr);
  } catch (error) {
    issueCodes.push(
      error instanceof Error ? error.message : 'requirements_final_render_requirement_rows_invalid'
    );
  }
  const expectedRequirementIds = new Set(requirements.map((requirement) => requirement.id));
  const renderedRequirementIds = [
    ...input.pages.html.matchAll(/data-requirement-id="([^"]+)"/gu),
  ].map((match) => match[1]);
  if (
    renderedRequirementIds.length !== expectedRequirementIds.size ||
    new Set(renderedRequirementIds).size !== renderedRequirementIds.length ||
    renderedRequirementIds.some((id) => !expectedRequirementIds.has(id))
  ) {
    issueCodes.push('requirements_final_render_requirement_identity_coverage_gap');
  }
  for (const requirement of requirements) {
    for (const value of [
      requirement.id,
      requirement.text,
      requirement.oracle,
      requirement.requirementKind,
      requirement.polarity,
      ...(requirement.requirementKind === 'negative'
        ? [requirement.blockingCondition ?? requirement.oracle]
        : []),
    ]) {
      if (
        !input.pages.markdown.includes(String(value)) ||
        !input.pages.html.includes(htmlEscape(value))
      ) {
        issueCodes.push('requirements_final_render_requirement_projection_gap');
      }
    }
    const cardPrefix =
      `<article data-requirement-id="${htmlEscape(requirement.id)}" ` +
      `data-requirement-kind="${htmlEscape(requirement.requirementKind)}" ` +
      `data-requirement-polarity="${htmlEscape(requirement.polarity)}"`;
    if (!input.pages.html.includes(cardPrefix)) {
      issueCodes.push('requirements_final_render_requirement_classification_gap');
    }
  }
  for (const decision of records(object(semantics).decisions)) {
    const requiredValues = [
      decision.questionId,
      decision.question,
      decision.decisionReceiptRef,
      ...strings(decision.affectedFieldIds),
      displayValue(decision.answerValue),
    ];
    if (
      requiredValues.some(
        (value) =>
          !input.pages.markdown.includes(String(value)) ||
          !input.pages.html.includes(htmlEscape(value))
      )
    ) {
      issueCodes.push('requirements_final_render_decision_projection_gap');
    }
  }
  const expected = projectRequirementsContractFinalPages(input);
  if (
    input.pages.markdown !== expected.markdown ||
    input.pages.html !== expected.html ||
    input.pages.exactConfirmationText !== expected.exactConfirmationText
  ) {
    issueCodes.push('requirements_final_render_projection_drift');
  }
  return {
    decision: issueCodes.length > 0 ? ('block' as const) : ('pass' as const),
    issueCodes: [...new Set(issueCodes)].sort(),
  };
}

function replaceBytesAtomic(targetPath: string, bytes: string): string {
  const resolved = path.resolve(targetPath);
  const directory = path.dirname(resolved);
  fs.mkdirSync(directory, { recursive: true });
  const temporary = path.join(
    directory,
    `.${path.basename(resolved)}.binding-refresh.${process.pid}.${randomUUID()}.tmp`
  );
  let descriptor: number | null = null;
  try {
    descriptor = fs.openSync(temporary, 'wx', 0o600);
    fs.writeFileSync(descriptor, bytes, 'utf8');
    fs.fsyncSync(descriptor);
    fs.closeSync(descriptor);
    descriptor = null;
    if (fs.readFileSync(temporary, 'utf8') !== bytes) {
      throw new Error('requirements_binding_refresh_temp_readback_mismatch');
    }
    fs.renameSync(temporary, resolved);
    const readback = fs.readFileSync(resolved, 'utf8');
    if (readback !== bytes) throw new Error('requirements_binding_refresh_page_readback_mismatch');
    return readback;
  } finally {
    if (descriptor !== null) fs.closeSync(descriptor);
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
  }
}

function validateRefreshReceiptHash(receipt: JsonObject): void {
  const { receiptHash, ...payload } = receipt;
  if (
    receipt.schemaVersion !== 'requirements-source-binding-refresh-receipt/v2' ||
    receiptHash !==
      sha256Stable({ domain: 'requirements-source-binding-refresh-receipt/v2', payload })
  ) {
    throw new Error('requirements_binding_refresh_receipt_invalid');
  }
}

function confirmationTextFromMarkdown(markdown: string): string {
  const marker = '## Confirmation\n\n```text\n';
  const start = markdown.indexOf(marker);
  if (start < 0) throw new Error('requirements_confirmation_page_text_missing');
  const bodyStart = start + marker.length;
  const end = markdown.indexOf('\n```', bodyStart);
  if (end < 0) throw new Error('requirements_confirmation_page_text_missing');
  return markdown.slice(bodyStart, end);
}

export function stageRequirementsContractConfirmationBindingRefresh(input: {
  projectRoot: string;
  requestId: string;
  bindingRevisionId: string;
}) {
  const root = path.resolve(input.projectRoot);
  const recordRoot = path.join(
    root,
    '_bmad-output',
    'runtime',
    'requirement-records',
    input.requestId
  );
  const recordPath = path.join(recordRoot, 'record', 'requirement-record.json');
  const record = readJson(recordPath);
  const activeAuthority = object(record.activeAuthority);
  const tupleValidation = validateRequirementsActiveAuthorityTuple(activeAuthority);
  if (tupleValidation.decision === 'block') throw new Error(tupleValidation.issueCodes[0]);
  const semanticIr = readJson(
    confinedRecordArtifact(recordRoot, text(activeAuthority.activeSemanticIrPath))
  );
  const sourceBinding = readJson(
    path.join(
      recordRoot,
      'authoring',
      'source-bindings',
      input.bindingRevisionId,
      'source-binding.json'
    )
  );
  const resolvedEvidenceIndex = readJson(
    path.join(
      recordRoot,
      'authoring',
      'source-bindings',
      input.bindingRevisionId,
      'resolved-evidence-index.json'
    )
  );
  const effectivePass = readJson(
    path.join(recordRoot, 'quality', 'requirements-effective-pass-receipt.json')
  );
  validateEffectivePassV2(effectivePass);
  const promotionPath = path.join(
    recordRoot,
    'confirmation',
    'confirmation-promotion-receipt.json'
  );
  const promotion = readJson(promotionPath);
  if (
    promotion.requestId !== input.requestId ||
    promotion.semanticRevisionId !== activeAuthority.activeSemanticRevisionId ||
    promotion.scopeSemanticHash !== activeAuthority.activeScopeSemanticHash ||
    promotion.buildManifestHash !== activeAuthority.activeBuildManifestHash ||
    promotion.requirementsEffectivePassHash !== effectivePass.requirementsEffectivePassHash ||
    promotion.sourceBindingHash !== effectivePass.sourceBindingHash ||
    sourceBinding.semanticRevisionId !== semanticIr.semanticRevisionId ||
    sourceBinding.scopeSemanticHash !== semanticIr.scopeSemanticHash
  ) {
    throw new Error('requirements_binding_refresh_promotion_stale');
  }
  const context = readJson(
    path.join(
      recordRoot,
      'authoring',
      'staging',
      text(activeAuthority.activeAuthoringAttemptId),
      'authoring-context.json'
    )
  );
  const renderInput: RequirementsFinalRenderInput = {
    requestId: input.requestId,
    confirmationLanguage: text(context.confirmationLanguage) || 'en-US',
    semanticIr,
    resolvedEvidenceIndex,
    effectivePass,
    bindingRefresh: {
      auditedSourceBindingHash: promotion.sourceBindingHash,
      currentSourceBindingHash: sourceBinding.sourceBindingHash,
    },
  };
  const pages = projectRequirementsContractFinalPages(renderInput);
  const lint = validateRequirementsContractFinalRenderProjection({ ...renderInput, pages });
  if (lint.decision === 'block') throw new Error(lint.issueCodes[0]);
  const stagingRoot = path.join(
    recordRoot,
    'confirmation',
    'staging',
    'binding-refresh',
    sourceBinding.bindingRevisionId
  );
  const stagedMarkdown = atomicNoClobberPublish({
    targetPath: path.join(stagingRoot, 'requirements.md'),
    bytes: pages.markdown,
    role: 'final_markdown',
    mediaType: 'text/markdown',
  });
  const stagedHtml = atomicNoClobberPublish({
    targetPath: path.join(stagingRoot, 'requirements.html'),
    bytes: pages.html,
    role: 'confirmation_html',
    mediaType: 'text/html',
  });
  return {
    bindingRevisionId: sourceBinding.bindingRevisionId,
    sourceBindingHash: sourceBinding.sourceBindingHash,
    exactConfirmationText: pages.exactConfirmationText,
    stagingRoot,
    stagedMarkdown,
    stagedHtml,
  };
}

export function refreshRequirementsContractConfirmationBinding(input: {
  projectRoot: string;
  requestId: string;
}) {
  const root = path.resolve(input.projectRoot);
  const recordRoot = path.join(
    root,
    '_bmad-output',
    'runtime',
    'requirement-records',
    input.requestId
  );
  const recordPath = path.join(recordRoot, 'record', 'requirement-record.json');
  const record = readJson(recordPath);
  const activeAuthority = object(record.activeAuthority);
  const tupleValidation = validateRequirementsActiveAuthorityTuple(activeAuthority);
  if (tupleValidation.decision === 'block') throw new Error(tupleValidation.issueCodes[0]);
  const semanticIr = readJson(
    confinedRecordArtifact(recordRoot, text(activeAuthority.activeSemanticIrPath))
  );
  const sourceBinding = readJson(
    confinedRecordArtifact(recordRoot, text(activeAuthority.activeSourceBindingPath))
  );
  const parentBindingRevisionId = text(sourceBinding.parentBindingRevisionId);
  if (!parentBindingRevisionId) throw new Error('requirements_binding_refresh_parent_missing');
  const parentBinding = readJson(
    path.join(
      recordRoot,
      'authoring',
      'source-bindings',
      parentBindingRevisionId,
      'source-binding.json'
    )
  );
  const effectivePass = readJson(
    path.join(recordRoot, 'quality', 'requirements-effective-pass-receipt.json')
  );
  validateEffectivePassV2(effectivePass);
  const promotionPath = path.join(
    recordRoot,
    'confirmation',
    'confirmation-promotion-receipt.json'
  );
  const promotion = readJson(promotionPath);
  const promotionArtifactBytesHash = artifactBytesHash({
    role: 'promotion_receipt',
    mediaType: 'application/json',
    bytes: fs.readFileSync(promotionPath),
  });
  if (
    promotion.requestId !== input.requestId ||
    promotion.semanticRevisionId !== activeAuthority.activeSemanticRevisionId ||
    promotion.scopeSemanticHash !== activeAuthority.activeScopeSemanticHash ||
    promotion.buildManifestHash !== activeAuthority.activeBuildManifestHash ||
    promotion.requirementsEffectivePassHash !== effectivePass.requirementsEffectivePassHash ||
    promotion.sourceBindingHash !== effectivePass.sourceBindingHash ||
    sourceBinding.semanticRevisionId !== semanticIr.semanticRevisionId ||
    sourceBinding.scopeSemanticHash !== semanticIr.scopeSemanticHash
  ) {
    throw new Error('requirements_binding_refresh_promotion_stale');
  }
  const stagingRoot = path.join(
    recordRoot,
    'confirmation',
    'staging',
    'binding-refresh',
    sourceBinding.bindingRevisionId
  );
  const stagedMarkdownPath = path.join(stagingRoot, 'requirements.md');
  const stagedHtmlPath = path.join(stagingRoot, 'requirements.html');
  if (!fs.existsSync(stagedMarkdownPath) || !fs.existsSync(stagedHtmlPath)) {
    throw new Error('requirements_binding_refresh_staged_pages_missing');
  }
  const stagedMarkdown = fs.readFileSync(stagedMarkdownPath, 'utf8');
  const stagedHtml = fs.readFileSync(stagedHtmlPath, 'utf8');
  const markdownArtifact = records(promotion.artifacts).find(
    (artifact) => artifact.role === 'final_markdown'
  );
  const htmlArtifact = records(promotion.artifacts).find(
    (artifact) => artifact.role === 'confirmation_html'
  );
  if (!markdownArtifact || !htmlArtifact) {
    throw new Error('requirements_binding_refresh_promotion_artifacts_missing');
  }
  const targetMarkdownPath = resolvePath(root, text(markdownArtifact.targetPath));
  const targetHtmlPath = resolvePath(root, text(htmlArtifact.targetPath));
  const markdownReadback = replaceBytesAtomic(targetMarkdownPath, stagedMarkdown);
  const htmlReadback = replaceBytesAtomic(targetHtmlPath, stagedHtml);
  const markdownArtifactBytesHash = artifactBytesHash({
    role: 'final_markdown',
    mediaType: 'text/markdown',
    bytes: markdownReadback,
  });
  const htmlArtifactBytesHash = artifactBytesHash({
    role: 'confirmation_html',
    mediaType: 'text/html',
    bytes: htmlReadback,
  });
  if (markdownReadback !== stagedMarkdown || htmlReadback !== stagedHtml) {
    throw new Error('requirements_binding_refresh_page_promotion_mismatch');
  }
  const refreshReceipt = createRequirementsContractSourceBindingRefreshReceipt({
    semanticRevisionId: semanticIr.semanticRevisionId,
    scopeSemanticHash: semanticIr.scopeSemanticHash,
    fromBindingRevisionId: parentBinding.bindingRevisionId,
    toBindingRevisionId: sourceBinding.bindingRevisionId,
    fromSourceBindingHash: parentBinding.sourceBindingHash,
    toSourceBindingHash: sourceBinding.sourceBindingHash,
    fromSnapshotSetHash: sha256Stable(parentBinding.sourceArtifacts),
    toSnapshotSetHash: sha256Stable(sourceBinding.sourceArtifacts),
    fromSourceSpanRegistryHash: parentBinding.sourceSpanRegistryHash,
    toSourceSpanRegistryHash: sourceBinding.sourceSpanRegistryHash,
    evidenceClaimRegistryHash: sourceBinding.evidenceClaimBindingRegistryHash,
    pageEvidence: {
      confirmationPromotionReceiptRef: {
        path: 'confirmation/confirmation-promotion-receipt.json',
        hash: promotionArtifactBytesHash,
      },
      pageArtifactBytesHash: markdownArtifactBytesHash,
      htmlPageArtifactBytesHash: htmlArtifactBytesHash,
    },
  });
  const refreshReceiptPath = path.join(
    recordRoot,
    'authoring',
    'source-bindings',
    sourceBinding.bindingRevisionId,
    'source-binding-refresh-receipt.json'
  );
  const receiptPublication = atomicNoClobberPublish({
    targetPath: refreshReceiptPath,
    value: refreshReceipt,
    role: 'source-binding-refresh-receipt',
    mediaType: 'application/json',
  });
  const nextRecord = {
    ...record,
    lifecycle: record.lifecycle === 'user_confirmed' ? 'user_confirmed' : 'user_confirmable',
    currentPromotionEvidence: {
      path: path.relative(recordRoot, refreshReceiptPath).replace(/\\/gu, '/'),
      artifactBytesHash: receiptPublication.artifactBytesHash,
    },
  };
  if (canonicalRequirementsJson(nextRecord) !== canonicalRequirementsJson(record)) {
    writeJsonAtomic(recordPath, nextRecord);
  }
  return {
    status: nextRecord.lifecycle,
    unresolvedDecisionCount: 0,
    confirmation: {
      exactConfirmationText: confirmationTextFromMarkdown(stagedMarkdown),
      markdownPath: path.relative(root, targetMarkdownPath).replace(/\\/gu, '/'),
      htmlPath: path.relative(root, targetHtmlPath).replace(/\\/gu, '/'),
      markdownArtifactBytesHash,
      htmlArtifactBytesHash,
      promotionReceiptPath: path.relative(recordRoot, refreshReceiptPath).replace(/\\/gu, '/'),
      promotionArtifactBytesHash: receiptPublication.artifactBytesHash,
    },
  };
}

function confinedRecordArtifact(recordRoot: string, recordRelativePath: string): string {
  const resolved = path.resolve(recordRoot, ...recordRelativePath.split('/'));
  const relative = path.relative(recordRoot, resolved);
  if (!recordRelativePath || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('requirements_confirmation_artifact_path_escape');
  }
  return resolved;
}

function validateEffectivePassV2(value: JsonObject): void {
  const { requirementsEffectivePassHash, ...payload } = value;
  if (
    value.schemaVersion !== 'requirements-effective-pass-receipt/v2' ||
    value.decision !== 'pass' ||
    requirementsEffectivePassHash !==
      sha256Stable({ domain: 'requirements-effective-pass-receipt/v2', payload })
  ) {
    throw new Error('requirements_final_render_effective_pass_invalid');
  }
}

export function renderAndPromoteRequirementsContractConfirmation(input: {
  projectRoot: string;
  requestId: string;
}) {
  const root = path.resolve(input.projectRoot);
  const recordRoot = path.join(
    root,
    '_bmad-output',
    'runtime',
    'requirement-records',
    input.requestId
  );
  const requirementRecordPath = path.join(recordRoot, 'record', 'requirement-record.json');
  const requirementRecord = readJson(requirementRecordPath);
  const activeAuthority = object(requirementRecord.activeAuthority);
  const tupleValidation = validateRequirementsActiveAuthorityTuple(activeAuthority);
  if (tupleValidation.decision === 'block') throw new Error(tupleValidation.issueCodes[0]);
  const buildManifest = readJson(
    confinedRecordArtifact(recordRoot, text(activeAuthority.activeBuildManifestPath))
  );
  const buildValidation = validateRequirementsContractBuildManifest(buildManifest);
  if (buildValidation.decision === 'block') throw new Error(buildValidation.issueCodes[0]);
  if (buildManifest.buildManifestHash !== activeAuthority.activeBuildManifestHash) {
    throw new Error('requirements_final_render_build_manifest_stale');
  }
  const semanticIr = readJson(
    confinedRecordArtifact(recordRoot, text(activeAuthority.activeSemanticIrPath))
  );
  const sourceBinding = readJson(
    confinedRecordArtifact(recordRoot, text(activeAuthority.activeSourceBindingPath))
  );
  const bindingValidation = validateRequirementsContractSourceBindingCapsule(sourceBinding);
  if (bindingValidation.decision === 'block') throw new Error(bindingValidation.issueCodes[0]);
  if (
    semanticIr.semanticRevisionId !== activeAuthority.activeSemanticRevisionId ||
    semanticIr.scopeSemanticHash !== activeAuthority.activeScopeSemanticHash ||
    sourceBinding.bindingRevisionId !== activeAuthority.activeBindingRevisionId ||
    sourceBinding.sourceBindingHash !== activeAuthority.activeSourceBindingHash
  ) {
    throw new Error('requirements_final_render_active_authority_stale');
  }
  const resolvedEvidenceIndex = readJson(
    path.join(
      recordRoot,
      'authoring',
      'source-bindings',
      text(activeAuthority.activeBindingRevisionId),
      'resolved-evidence-index.json'
    )
  );
  const effectivePass = readJson(
    path.join(recordRoot, 'quality', 'requirements-effective-pass-receipt.json')
  );
  validateEffectivePassV2(effectivePass);
  if (effectivePass.buildManifestHash !== buildManifest.buildManifestHash) {
    throw new Error('requirements_final_render_effective_pass_stale');
  }
  const context = readJson(
    path.join(
      recordRoot,
      'authoring',
      'staging',
      text(activeAuthority.activeAuthoringAttemptId),
      'authoring-context.json'
    )
  );
  const renderInput: RequirementsFinalRenderInput = {
    requestId: input.requestId,
    confirmationLanguage: text(context.confirmationLanguage) || 'en-US',
    semanticIr,
    resolvedEvidenceIndex,
    effectivePass,
  };
  const pages = projectRequirementsContractFinalPages(renderInput);
  const lint = validateRequirementsContractFinalRenderProjection({ ...renderInput, pages });
  if (lint.decision === 'block') throw new Error(lint.issueCodes[0]);
  const stagingRoot = path.join(recordRoot, 'confirmation', 'staging');
  const stagedMarkdownPath = path.join(stagingRoot, 'requirements.md');
  const stagedHtmlPath = path.join(stagingRoot, 'requirements.html');
  const stagedMarkdown = atomicNoClobberPublish({
    targetPath: stagedMarkdownPath,
    bytes: pages.markdown,
    role: 'final_markdown',
    mediaType: 'text/markdown',
  });
  const stagedHtml = atomicNoClobberPublish({
    targetPath: stagedHtmlPath,
    bytes: pages.html,
    role: 'confirmation_html',
    mediaType: 'text/html',
  });
  const report = {
    schemaVersion: 'requirements-contract-confirmation-render-report/v1',
    requestId: input.requestId,
    semanticRevisionId: semanticIr.semanticRevisionId,
    scopeSemanticHash: semanticIr.scopeSemanticHash,
    bindingRevisionId: sourceBinding.bindingRevisionId,
    sourceBindingHash: sourceBinding.sourceBindingHash,
    buildManifestHash: buildManifest.buildManifestHash,
    requirementsEffectivePassHash: effectivePass.requirementsEffectivePassHash,
    decision: 'pass',
    issueCodes: [],
    exactConfirmationText: pages.exactConfirmationText,
    artifacts: [
      {
        role: 'final_markdown',
        mediaType: 'text/markdown',
        stagingPath: path.relative(recordRoot, stagedMarkdownPath).replace(/\\/gu, '/'),
        artifactBytesHash: stagedMarkdown.artifactBytesHash,
        byteLength: stagedMarkdown.byteLength,
      },
      {
        role: 'confirmation_html',
        mediaType: 'text/html',
        stagingPath: path.relative(recordRoot, stagedHtmlPath).replace(/\\/gu, '/'),
        artifactBytesHash: stagedHtml.artifactBytesHash,
        byteLength: stagedHtml.byteLength,
      },
    ],
  };
  const reportPath = path.join(recordRoot, 'confirmation', 'confirmation-render-report.json');
  const reportPublication = atomicNoClobberPublish({
    targetPath: reportPath,
    value: report,
    role: 'confirmation_render_report',
    mediaType: 'application/json',
  });
  const targetMarkdownPath = resolvePath(root, text(context.targetSource));
  const relativeTarget = path.relative(root, targetMarkdownPath);
  if (relativeTarget.startsWith('..') || path.isAbsolute(relativeTarget)) {
    throw new Error('requirements_final_render_target_path_escape');
  }
  const targetHtmlPath = targetMarkdownPath.replace(/\.[^.]+$/u, '') + '.html';
  const markdownPromotion = atomicNoClobberPublish({
    targetPath: targetMarkdownPath,
    bytes: pages.markdown,
    role: 'final_markdown',
    mediaType: 'text/markdown',
  });
  const htmlPromotion = atomicNoClobberPublish({
    targetPath: targetHtmlPath,
    bytes: pages.html,
    role: 'confirmation_html',
    mediaType: 'text/html',
  });
  const promotionReceipt = {
    schemaVersion: 'requirements-contract-confirmation-promotion-receipt/v1',
    requestId: input.requestId,
    semanticRevisionId: semanticIr.semanticRevisionId,
    scopeSemanticHash: semanticIr.scopeSemanticHash,
    bindingRevisionId: sourceBinding.bindingRevisionId,
    sourceBindingHash: sourceBinding.sourceBindingHash,
    buildManifestHash: buildManifest.buildManifestHash,
    requirementsEffectivePassHash: effectivePass.requirementsEffectivePassHash,
    renderReportRef: {
      path: path.relative(recordRoot, reportPath).replace(/\\/gu, '/'),
      artifactBytesHash: reportPublication.artifactBytesHash,
    },
    exactConfirmationText: pages.exactConfirmationText,
    artifacts: [
      {
        role: 'final_markdown',
        targetPath: path.relative(root, targetMarkdownPath).replace(/\\/gu, '/'),
        artifactBytesHash: markdownPromotion.artifactBytesHash,
      },
      {
        role: 'confirmation_html',
        targetPath: path.relative(root, targetHtmlPath).replace(/\\/gu, '/'),
        artifactBytesHash: htmlPromotion.artifactBytesHash,
      },
    ],
  };
  const promotionReceiptPath = path.join(
    recordRoot,
    'confirmation',
    'confirmation-promotion-receipt.json'
  );
  const promotionPublication = atomicNoClobberPublish({
    targetPath: promotionReceiptPath,
    value: promotionReceipt,
    role: 'promotion_receipt',
    mediaType: 'application/json',
  });
  const nextRecord = {
    ...requirementRecord,
    lifecycle: 'user_confirmable',
    currentPromotionEvidence: {
      path: 'confirmation/confirmation-promotion-receipt.json',
      artifactBytesHash: promotionPublication.artifactBytesHash,
    },
  };
  if (canonicalRequirementsJson(nextRecord) !== canonicalRequirementsJson(requirementRecord)) {
    writeJsonAtomic(requirementRecordPath, nextRecord);
  }
  return {
    status: 'user_confirmable' as const,
    unresolvedDecisionCount: 0,
    confirmation: {
      exactConfirmationText: pages.exactConfirmationText,
      markdownPath: path.relative(root, targetMarkdownPath).replace(/\\/gu, '/'),
      htmlPath: path.relative(root, targetHtmlPath).replace(/\\/gu, '/'),
      markdownArtifactBytesHash: markdownPromotion.artifactBytesHash,
      htmlArtifactBytesHash: htmlPromotion.artifactBytesHash,
      promotionReceiptPath: 'confirmation/confirmation-promotion-receipt.json',
      promotionArtifactBytesHash: promotionPublication.artifactBytesHash,
    },
  };
}

export function confirmRequirementsContractIrScope(input: {
  projectRoot: string;
  requestId: string;
  exactConfirmationText: string;
}) {
  if (!SAFE_REQUEST_ID.test(input.requestId)) {
    throw new Error('requirements_confirmation_request_id_invalid');
  }
  const recordRoot = path.join(
    path.resolve(input.projectRoot),
    '_bmad-output',
    'runtime',
    'requirement-records',
    input.requestId
  );
  const recordPath = path.join(recordRoot, 'record', 'requirement-record.json');
  const record = readJson(recordPath);
  if (record.lifecycle !== 'user_confirmable' && record.lifecycle !== 'user_confirmed') {
    throw new Error('requirements_confirmation_not_confirmable');
  }
  const activeAuthority = object(record.activeAuthority);
  const tupleValidation = validateRequirementsActiveAuthorityTuple(activeAuthority);
  if (tupleValidation.decision === 'block') {
    throw new Error('requirements_confirmation_promotion_stale');
  }
  const effectivePassPath = path.join(
    recordRoot,
    'quality',
    'requirements-effective-pass-receipt.json'
  );
  if (!fs.existsSync(effectivePassPath)) {
    throw new Error('requirements_confirmation_effective_pass_missing');
  }
  let effectivePass: JsonObject;
  try {
    effectivePass = readJson(effectivePassPath);
    validateEffectivePassV2(effectivePass);
  } catch {
    throw new Error('requirements_confirmation_effective_pass_invalid');
  }
  if (
    effectivePass.semanticRevisionId !== activeAuthority.activeSemanticRevisionId ||
    effectivePass.scopeSemanticHash !== activeAuthority.activeScopeSemanticHash ||
    effectivePass.buildManifestHash !== activeAuthority.activeBuildManifestHash
  ) {
    throw new Error('requirements_confirmation_effective_pass_invalid');
  }
  const originalPromotionPath = path.join(
    recordRoot,
    'confirmation',
    'confirmation-promotion-receipt.json'
  );
  const originalPromotion = readJson(originalPromotionPath);
  const currentPromotionEvidence = object(record.currentPromotionEvidence);
  if (!text(currentPromotionEvidence.path) || !text(currentPromotionEvidence.artifactBytesHash)) {
    throw new Error('requirements_confirmation_promotion_evidence_missing');
  }
  if (
    text(currentPromotionEvidence.path) === 'confirmation/confirmation-promotion-receipt.json' &&
    (originalPromotion.bindingRevisionId !== activeAuthority.activeBindingRevisionId ||
      originalPromotion.sourceBindingHash !== activeAuthority.activeSourceBindingHash)
  ) {
    throw new Error('citation_binding_stale');
  }
  const currentPromotionPath = confinedRecordArtifact(
    recordRoot,
    text(currentPromotionEvidence.path)
  );
  const currentPromotion = readJson(currentPromotionPath);
  const currentPromotionHash = artifactBytesHash({
    role:
      currentPromotion.schemaVersion === 'requirements-source-binding-refresh-receipt/v2'
        ? 'source-binding-refresh-receipt'
        : 'promotion_receipt',
    mediaType: 'application/json',
    bytes: fs.readFileSync(currentPromotionPath),
  });
  if (
    text(currentPromotionEvidence.artifactBytesHash) &&
    currentPromotionHash !== currentPromotionEvidence.artifactBytesHash
  ) {
    throw new Error('requirements_confirmation_promotion_evidence_stale');
  }
  const refreshReceipt =
    currentPromotion.schemaVersion === 'requirements-source-binding-refresh-receipt/v2'
      ? currentPromotion
      : null;
  if (refreshReceipt) validateRefreshReceiptHash(refreshReceipt);
  const promotion = refreshReceipt ? originalPromotion : currentPromotion;
  const markdownArtifact = records(promotion.artifacts).find(
    (artifact) => artifact.role === 'final_markdown'
  );
  const htmlArtifact = records(promotion.artifacts).find(
    (artifact) => artifact.role === 'confirmation_html'
  );
  if (!markdownArtifact || !htmlArtifact) throw new Error('requirements_confirmation_page_missing');
  const pageArtifacts = [
    {
      artifact: markdownArtifact,
      role: 'final_markdown',
      mediaType: 'text/markdown',
      expectedHash: refreshReceipt
        ? refreshReceipt.pageArtifactBytesHash
        : markdownArtifact.artifactBytesHash,
    },
    {
      artifact: htmlArtifact,
      role: 'confirmation_html',
      mediaType: 'text/html',
      expectedHash: refreshReceipt
        ? refreshReceipt.htmlPageArtifactBytesHash
        : htmlArtifact.artifactBytesHash,
    },
  ];
  const pageReadbacks = pageArtifacts.map((page) => {
    const targetPath = resolvePath(input.projectRoot, text(page.artifact.targetPath));
    const relative = path.relative(path.resolve(input.projectRoot), targetPath);
    if (relative.startsWith('..') || path.isAbsolute(relative) || !fs.existsSync(targetPath)) {
      throw new Error('requirements_confirmation_page_missing');
    }
    const bytes = fs.readFileSync(targetPath);
    if (
      artifactBytesHash({ role: page.role, mediaType: page.mediaType, bytes }) !== page.expectedHash
    ) {
      throw new Error('requirements_confirmation_page_stale');
    }
    return bytes;
  });
  const currentMarkdown = pageReadbacks[0].toString('utf8');
  if (!currentMarkdown) {
    throw new Error('requirements_confirmation_page_stale');
  }
  if (input.exactConfirmationText !== confirmationTextFromMarkdown(currentMarkdown)) {
    throw new Error('requirements_confirmation_exact_text_mismatch');
  }
  const promotionCurrent =
    promotion.requestId !== input.requestId ||
    promotion.semanticRevisionId !== activeAuthority.activeSemanticRevisionId ||
    promotion.scopeSemanticHash !== activeAuthority.activeScopeSemanticHash ||
    (!refreshReceipt &&
      (promotion.bindingRevisionId !== activeAuthority.activeBindingRevisionId ||
        promotion.sourceBindingHash !== activeAuthority.activeSourceBindingHash));
  const refreshCurrent = Boolean(
    refreshReceipt &&
    refreshReceipt.semanticRevisionId === activeAuthority.activeSemanticRevisionId &&
    refreshReceipt.scopeSemanticHash === activeAuthority.activeScopeSemanticHash &&
    refreshReceipt.toBindingRevisionId === activeAuthority.activeBindingRevisionId &&
    refreshReceipt.toSourceBindingHash === activeAuthority.activeSourceBindingHash &&
    refreshReceipt.confirmationPromotionReceiptRef?.path ===
      'confirmation/confirmation-promotion-receipt.json' &&
    refreshReceipt.confirmationPromotionReceiptRef?.hash ===
      artifactBytesHash({
        role: 'promotion_receipt',
        mediaType: 'application/json',
        bytes: fs.readFileSync(originalPromotionPath),
      }) &&
    refreshReceipt.fromBindingRevisionId === originalPromotion.bindingRevisionId &&
    refreshReceipt.fromSourceBindingHash === originalPromotion.sourceBindingHash &&
    effectivePass.sourceBindingHash === originalPromotion.sourceBindingHash &&
    refreshReceipt.citationProjectionRefreshDisposition === 'passed' &&
    refreshReceipt.pageReadbackDisposition === 'passed' &&
    refreshReceipt.pagePromotionDisposition === 'promoted'
  );
  if (promotionCurrent || (refreshReceipt && !refreshCurrent)) {
    throw new Error('requirements_confirmation_promotion_stale');
  }
  if (
    promotion.requirementsEffectivePassHash !== effectivePass.requirementsEffectivePassHash ||
    (!refreshReceipt && effectivePass.sourceBindingHash !== activeAuthority.activeSourceBindingHash)
  ) {
    throw new Error('requirements_confirmation_effective_pass_invalid');
  }
  if (record.lifecycle === 'user_confirmed') {
    const eventRef = object(record.confirmationEventRef);
    if (
      record.confirmedScopeSemanticHash !== activeAuthority.activeScopeSemanticHash ||
      !text(eventRef.path) ||
      !text(eventRef.artifactBytesHash)
    ) {
      throw new Error('requirements_confirmation_promotion_stale');
    }
    const existingEventPath = confinedRecordArtifact(recordRoot, text(eventRef.path));
    if (!fs.existsSync(existingEventPath)) {
      throw new Error('requirements_confirmation_promotion_stale');
    }
    const existingEventBytes = fs.readFileSync(existingEventPath);
    const existingEventHash = artifactBytesHash({
      role: 'requirements_confirmation_event',
      mediaType: 'application/json',
      bytes: existingEventBytes,
    });
    const existingEvent = JSON.parse(existingEventBytes.toString('utf8')) as JsonObject;
    if (
      existingEventHash !== eventRef.artifactBytesHash ||
      existingEvent.requestId !== input.requestId ||
      existingEvent.semanticRevisionId !== activeAuthority.activeSemanticRevisionId ||
      existingEvent.scopeSemanticHash !== activeAuthority.activeScopeSemanticHash
    ) {
      throw new Error('requirements_confirmation_promotion_stale');
    }
    return {
      ok: true,
      action: 'confirm-scope' as const,
      status: 'confirmation_reused' as const,
      exitCode: 0,
      authority: 'main-agent-controlled-requirements-confirmation' as const,
      requestId: input.requestId,
      semanticRevisionId: activeAuthority.activeSemanticRevisionId,
      confirmationEventId: existingEventHash,
      eventPath: path.relative(input.projectRoot, existingEventPath).replace(/\\/gu, '/'),
    };
  }
  const event = {
    schemaVersion: 'requirements-contract-confirmation-event/v1',
    requestId: input.requestId,
    semanticRevisionId: activeAuthority.activeSemanticRevisionId,
    scopeSemanticHash: activeAuthority.activeScopeSemanticHash,
    bindingRevisionId: activeAuthority.activeBindingRevisionId,
    requirementsEffectivePassRef: {
      path: 'quality/requirements-effective-pass-receipt.json',
      hash: promotion.requirementsEffectivePassHash,
    },
    promotionEvidenceRef: {
      path: path.relative(recordRoot, currentPromotionPath).replace(/\\/gu, '/'),
      artifactBytesHash: currentPromotionHash,
    },
    exactConfirmationText: input.exactConfirmationText,
  };
  const eventPath = path.join(recordRoot, 'confirmation', 'confirmation-event.json');
  const eventPublication = atomicNoClobberPublish({
    targetPath: eventPath,
    value: event,
    role: 'requirements_confirmation_event',
    mediaType: 'application/json',
  });
  const nextRecord = {
    ...record,
    lifecycle: 'user_confirmed',
    confirmedScopeSemanticHash: activeAuthority.activeScopeSemanticHash,
    confirmationEventRef: {
      path: 'confirmation/confirmation-event.json',
      artifactBytesHash: eventPublication.artifactBytesHash,
    },
  };
  if (canonicalRequirementsJson(nextRecord) !== canonicalRequirementsJson(record)) {
    writeJsonAtomic(recordPath, nextRecord);
  }
  return {
    ok: true,
    action: 'confirm-scope' as const,
    status: record.lifecycle === 'user_confirmed' ? 'confirmation_reused' : 'user_confirmed',
    exitCode: 0,
    authority: 'main-agent-controlled-requirements-confirmation' as const,
    requestId: input.requestId,
    semanticRevisionId: activeAuthority.activeSemanticRevisionId,
    confirmationEventId: eventPublication.artifactBytesHash,
    eventPath: path.relative(input.projectRoot, eventPath).replace(/\\/gu, '/'),
  };
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function object(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonObject) : {};
}

function objects(value: unknown): JsonObject[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is JsonObject =>
          Boolean(item) && typeof item === 'object' && !Array.isArray(item)
      )
    : [];
}

function normalizePath(value: string): string {
  return value.replace(/\\/gu, '/');
}

function resolvePath(root: string, value: string): string {
  return path.isAbsolute(value) ? value : path.resolve(root, value);
}

function readConfirmationText(root: string, args: ConfirmationArgs): string {
  if (text(args.confirmationTextFile)) {
    return fs.readFileSync(resolvePath(root, text(args.confirmationTextFile)), 'utf8');
  }
  return text(args.confirmationText);
}

function parseConfirmationHashes(confirmationText: string): JsonObject {
  if (!confirmationText.includes('确认以上范围进入下一阶段')) {
    throw new Error('confirmation_text_missing_exact_acceptance_phrase');
  }
  const result: JsonObject = {};
  for (const key of [
    'sourceDocumentHash',
    'implementationConfirmationHash',
    'confirmationPageHash',
  ]) {
    const match = confirmationText.match(new RegExp(`${key}=(sha256:[a-f0-9]{64})`, 'iu'));
    if (!match) throw new Error(`confirmation_text_missing_${key}`);
    result[key] = match[1];
  }
  const requestId = confirmationText.match(/requestId=([A-Za-z0-9._:-]+)/iu);
  if (requestId) result.requestId = requestId[1];
  return result;
}

function effectivePassReceiptRef(
  root: string,
  args: ConfirmationArgs,
  confirmation: ImplementationConfirmation
):
  | {
      ref: JsonObject;
      receipt: RequirementsEffectivePassReceipt;
    }
  | {
      mismatches: string[];
      error?: string;
    } {
  const receiptArg = text(args.requirementsEffectivePassReceipt);
  if (!receiptArg) return { mismatches: ['requirements_effective_pass_receipt_missing'] };
  const receiptPath = resolvePath(root, receiptArg);
  let receipt: RequirementsEffectivePassReceipt;
  try {
    receipt = validateRequirementsEffectivePassReceipt(readJson(receiptPath));
  } catch (error) {
    return {
      mismatches: ['requirements_effective_pass_receipt_invalid'],
      error: error instanceof Error ? error.message : String(error),
    };
  }
  const drilldown = object(confirmation.preConfirmationDrilldown);
  const criticalAuditor = object(drilldown.criticalAuditor);
  const latestReceiptHash = text(criticalAuditor.latestReceiptHash);
  if (!latestReceiptHash) {
    return { mismatches: ['requirements_effective_pass_receipt_missing'] };
  }
  if (latestReceiptHash !== receipt.receiptHash) {
    return { mismatches: ['requirements_effective_pass_receipt_stale'] };
  }
  return {
    receipt,
    ref: {
      path: normalizePath(receiptPath),
      schemaVersion: receipt.schemaVersion,
      receiptHash: receipt.receiptHash,
      actorClass: receipt.actorClass,
      judgeRole: receipt.judgeRole,
      decision: receipt.decision,
    },
  };
}

function reportArtifactPath(root: string, reportPath: string, value: unknown): string {
  const candidate =
    typeof value === 'string'
      ? value
      : value && typeof value === 'object' && !Array.isArray(value)
        ? text((value as JsonObject).path)
        : '';
  if (!candidate) return '';
  return path.isAbsolute(candidate) ? candidate : path.resolve(path.dirname(reportPath), candidate);
}

function buildGlobalContractTraceabilityPolicy(
  confirmation: ImplementationConfirmation
): JsonObject {
  const taskRegistryPolicy = object(confirmation.taskRegistryPolicy);
  return {
    schemaVersion: 'global-contract-traceability-policy/v1',
    appliesToEntryFlows: ['bugfix', 'standalone_tasks', 'story'],
    contractAuthoringRequired: true,
    taskBindingRequired: true,
    taskBindingDimensions: ['MUST', 'NEG', 'OUT', 'EVD', 'TRACE'],
    missingBindingBehavior: 'fail_closed',
    sourceDocumentHashRequired: true,
    implementationConfirmationHashRequired: true,
    reconfirmOnTraceSemanticChange: true,
    allowUnboundImplementationTask: false,
    taskRegistryField: text(taskRegistryPolicy.canonicalTaskRegistryField) || 'implementationTasks',
    traceTaskRefsMustResolveTo:
      text(taskRegistryPolicy.traceTaskRefsMustResolveTo) || 'implementationTasks[].id',
    readinessFailureWhenUnresolved: taskRegistryPolicy.readinessFailureWhenUnresolved !== false,
    closeoutFailureWhenUnresolved: taskRegistryPolicy.closeoutFailureWhenUnresolved !== false,
  };
}

function buildTraceStatusPolicy(): JsonObject {
  return {
    schemaVersion: 'trace-status-policy/v1',
    allowedStatuses: [
      'PENDING',
      'PASS',
      'FAIL',
      'BLOCKED',
      'LINKED_DOWNSTREAM',
      'USER_APPROVED_DEFERRED',
      'USER_APPROVED_OUT_OF_SCOPE',
    ],
    terminalFullCloseoutStatuses: ['PASS', 'FAIL', 'BLOCKED'],
    linkedDownstreamRequiredFields: [
      'downstreamRecordId',
      'downstreamStoryRef',
      'downstreamSourceDocumentPath',
      'downstreamSourceDocumentHash',
      'downstreamScopeSummary',
      'downstreamRequirementIds',
      'downstreamAuditEvidenceRefs',
    ],
    userApprovedDeferredRequiredFields: [
      'userApprovalRef',
      'approvedAt',
      'approvedBy',
      'impactSummary',
      'followUpRecordId',
      'followUpDueCondition',
    ],
    userApprovedOutOfScopeRequiredFields: [
      'userApprovalRef',
      'approvedAt',
      'approvedBy',
      'impactSummary',
      'confirmationDeltaRef',
    ],
    bareDeferredForbidden: true,
    bareOutOfScopeForbidden: true,
    fullCloseoutForUserScopedStatusesForbidden: true,
  };
}

function modelResult(
  recordId: string,
  requirementSetId: string,
  sourceDocumentHash: string,
  implementationConfirmationHash: string,
  confirmationPageHash: string,
  model: (typeof MODELS)[number],
  status: 'pass' | 'not_established',
  recordedAt: string,
  recordedBy: string,
  renderReportPath: string,
  htmlPath: string
): JsonObject {
  return {
    payloadKind: 'model_result',
    model,
    recordId,
    requirementSetId,
    sourceDocumentHash,
    implementationConfirmationHash,
    status,
    resultRecordedAt: recordedAt,
    resultRecordedBy: recordedBy,
    blockingReasons: status === 'pass' ? [] : [`${model}_not_established`],
    sourceRefs: [
      {
        sourceType: status === 'pass' ? 'confirmation_event' : 'six_model_initialization',
        id: status === 'pass' ? 'confirmation_recorded' : `${model}:not_established`,
      },
    ],
    currentHashes: {
      sourceDocumentHash,
      implementationConfirmationHash,
      confirmationPageHash,
    },
    ...(model === 'requirement_confirmation'
      ? {
          renderReportPath,
          htmlPath,
        }
      : {}),
  };
}

function initialDraftRecord(input: {
  recordId: string;
  requirementSetId: string;
  sourcePath: string;
  sourceDocumentHash: string;
  implementationConfirmationHash: string;
  confirmation: ImplementationConfirmation;
  writerRegistry: ControlledIngestWriterRegistrySnapshot;
  recordedAt: string;
}): JsonObject {
  const entryFlow = text(input.confirmation.entryFlow);
  const entryFlowClass = text(input.confirmation.entryFlowClass);
  const workflowAdapter = text(input.confirmation.workflowAdapter);
  return {
    schemaVersion: 'requirement-record/v1',
    recordId: input.recordId,
    requirementSetId: input.requirementSetId,
    sourcePath: normalizePath(input.sourcePath),
    status: 'draft',
    sourceDocumentHash: input.sourceDocumentHash,
    implementationConfirmationHash: input.implementationConfirmationHash,
    confirmationHistory: [],
    controlledIngestWriterRegistryRequired: true,
    controlledIngestWriterRegistry: input.writerRegistry.controlledIngestWriterRegistry,
    controlledIngestWriterRegistryHash: input.writerRegistry.controlledIngestWriterRegistryHash,
    ...(entryFlow ? { entryFlow } : {}),
    ...(entryFlowClass ? { entryFlowClass } : {}),
    ...(workflowAdapter ? { workflowAdapter } : {}),
    ...(input.confirmation.contractAuthoringRequired === true
      ? { contractAuthoringRequired: true }
      : {}),
    updatedAt: input.recordedAt,
  };
}

function prepareDraftRecord(input: {
  recordPath: string;
  draft: JsonObject;
  sourceDocumentHash: string;
  implementationConfirmationHash: string;
}): { record: JsonObject; bootstrap: boolean } {
  if (!fs.existsSync(input.recordPath)) {
    return { record: input.draft, bootstrap: true };
  }
  const existing = readJson(input.recordPath);
  const history = objects(existing.confirmationHistory);
  const status = text(existing.status);
  if (status === 'draft' && history.length === 0) {
    if (text(existing.recordId) && text(existing.recordId) !== text(input.draft.recordId)) {
      throw new Error('confirmation_record_id_mismatch');
    }
    if (
      text(existing.requirementSetId) &&
      text(existing.requirementSetId) !== text(input.draft.requirementSetId)
    ) {
      throw new Error('confirmation_requirement_set_id_mismatch');
    }
    if (
      text(existing.sourceDocumentHash) &&
      text(existing.sourceDocumentHash) !== input.sourceDocumentHash
    ) {
      throw new Error('confirmation_existing_source_hash_mismatch');
    }
    if (
      text(existing.implementationConfirmationHash) &&
      text(existing.implementationConfirmationHash) !== input.implementationConfirmationHash
    ) {
      throw new Error('confirmation_existing_implementation_hash_mismatch');
    }
    const merged = {
      ...input.draft,
      ...existing,
      controlledIngestWriterRegistryRequired: true,
      controlledIngestWriterRegistry: input.draft.controlledIngestWriterRegistry,
      controlledIngestWriterRegistryHash: input.draft.controlledIngestWriterRegistryHash,
      sourceDocumentHash: input.sourceDocumentHash,
      implementationConfirmationHash: input.implementationConfirmationHash,
    };
    return { record: merged, bootstrap: true };
  }
  return { record: existing, bootstrap: false };
}

function buildUpdatedSourceDocument(input: {
  sourceText: string;
  extracted: ReturnType<typeof extractRequirementsContractImplementationConfirmation>;
  sourceDocumentHash: string;
  implementationConfirmationHash: string;
  confirmationPageHash: string;
  reportPath: string;
  htmlPath: string;
  confirmationText: string;
  confirmedAt: string;
  confirmedBy: string;
}): string {
  const nextConfirmation: ImplementationConfirmation = {
    ...input.extracted.value,
    status: 'user_confirmed',
    confirmedAt: input.confirmedAt,
    confirmedBy: input.confirmedBy,
    sourceDocumentHash: input.sourceDocumentHash,
    implementationConfirmationHash: input.implementationConfirmationHash,
    reconfirmationRequest: null,
    confirmationRender: {
      ...object(input.extracted.value.confirmationRender),
      htmlPath: normalizePath(input.htmlPath),
      reportPath: normalizePath(input.reportPath),
      htmlHash: input.confirmationPageHash,
      confirmationPhrase: input.confirmationText,
    },
  };
  const replacement = yaml
    .dump(
      { implementationConfirmation: nextConfirmation },
      { lineWidth: 120, noRefs: true, sortKeys: false }
    )
    .trimEnd()
    .split('\n');
  const trailingBlankLines = input.extracted.blockText.match(/\n+$/u)?.[0].length ?? 0;
  for (let index = 0; index < trailingBlankLines; index += 1) replacement.push('');
  const lines = input.sourceText.replace(/\r\n/g, '\n').split('\n');
  const nextSource = lines
    .slice(0, input.extracted.startLine - 1)
    .concat(replacement, lines.slice(input.extracted.endLine))
    .join('\n');
  return nextSource;
}

function failure(
  input: {
    recordPath: string;
    reportPath: string;
  },
  mismatches: string[],
  error?: string
): RequirementsContractConfirmationAcceptanceResult {
  return {
    ok: false,
    action: 'confirm-scope',
    exitCode: 3,
    authority: 'main-agent-controlled-confirmation',
    requirementRecordPath: normalizePath(input.recordPath),
    renderReportPath: normalizePath(input.reportPath),
    mismatches,
    ...(error ? { error } : {}),
  };
}

export function runRequirementsContractConfirmationAcceptance(
  input: ConfirmationInput
): RequirementsContractConfirmationAcceptanceResult {
  const root = path.resolve(input.root);
  const args = input.args;
  const sourceArg = text(args.source);
  if (!sourceArg) throw new Error('confirm-scope requires --source <source-document.md>');
  const sourcePath = resolvePath(root, sourceArg);
  const sourceText = fs.readFileSync(sourcePath, 'utf8');
  const extracted = extractRequirementsContractImplementationConfirmation(sourceText);
  const confirmation = extracted.value;
  const reportArg = text(args.renderReport);
  if (!reportArg) {
    throw new Error('confirm-scope requires --render-report <confirmation-render-report.json>');
  }
  const renderReportPath = resolvePath(root, reportArg);
  const report = readJson(renderReportPath);
  const confirmationText = readConfirmationText(root, args);
  if (!confirmationText) {
    throw new Error(
      'confirm-scope requires --confirmation-text <exact chat confirmation> or --confirmation-text-file <file>'
    );
  }

  const sourceDocumentHash = sourceDocumentHashFor(sourceText, extracted.blockText, confirmation);
  const implementationConfirmationHash = implementationConfirmationHashFor(confirmation);
  const recordId = text(args.recordId) || text(report.recordId) || text(confirmation.recordId);
  if (!recordId) throw new Error('confirm-scope requires recordId');
  const requirementSetId =
    text(args.requirementSetId) ||
    text(report.requirementSetId) ||
    text(confirmation.requirementSetId) ||
    recordId;
  const runtimeRoot = resolvePath(
    root,
    text(args.runtimeRoot) || '_bmad-output/runtime/requirement-records'
  );
  const recordPath = resolvePath(
    root,
    text(args.requirementRecord) || path.join(runtimeRoot, recordId, 'requirement-record.json')
  );
  const htmlPath = reportArtifactPath(root, renderReportPath, report.artifactRef ?? report.outPath);
  const provided = parseConfirmationHashes(confirmationText);
  const mismatches: string[] = [];
  if (
    (text(args.recordId) && text(args.recordId) !== text(report.recordId)) ||
    (text(args.recordId) && text(args.recordId) !== text(confirmation.recordId)) ||
    (text(report.recordId) &&
      text(confirmation.recordId) &&
      text(report.recordId) !== text(confirmation.recordId)) ||
    (text(args.requirementSetId) &&
      text(args.requirementSetId) !== text(report.requirementSetId)) ||
    (text(args.requirementSetId) &&
      text(args.requirementSetId) !== text(confirmation.requirementSetId)) ||
    (text(report.requirementSetId) &&
      text(confirmation.requirementSetId) &&
      text(report.requirementSetId) !== text(confirmation.requirementSetId))
  ) {
    mismatches.push('confirmation_record_identity_mismatch');
  }
  if (report.confirmability !== 'confirmable') {
    mismatches.push('render_report_not_confirmable');
  }
  if (objects(report.blockingIssues).length > 0) {
    mismatches.push('render_report_blocking_issues_present');
  }
  if (text(report.sourceDocumentHash) !== sourceDocumentHash) {
    mismatches.push('render_report_source_hash_mismatch');
  }
  if (text(report.implementationConfirmationHash) !== implementationConfirmationHash) {
    mismatches.push('render_report_implementation_confirmation_hash_mismatch');
  }
  if (provided.sourceDocumentHash !== sourceDocumentHash) {
    mismatches.push('confirmation_text_source_hash_mismatch');
  }
  if (provided.implementationConfirmationHash !== implementationConfirmationHash) {
    mismatches.push('confirmation_text_implementation_hash_mismatch');
  }
  const confirmationPageHash = text(provided.confirmationPageHash);
  if (confirmationPageHash !== text(report.confirmationPageHash)) {
    mismatches.push('confirmation_page_hash_mismatch');
  }
  if (htmlPath && fs.existsSync(htmlPath)) {
    const actualHtmlFileHash = sha256Text(fs.readFileSync(htmlPath, 'utf8'));
    if (text(report.actualHtmlFileHash) && text(report.actualHtmlFileHash) !== actualHtmlFileHash) {
      mismatches.push('render_report_actual_html_hash_mismatch');
    }
  } else {
    mismatches.push('confirmation_html_artifact_missing');
  }
  if (args.updateSource === 'false') mismatches.push('atomic_source_update_required');
  const effectivePass = effectivePassReceiptRef(root, args, confirmation);
  if ('mismatches' in effectivePass) {
    mismatches.push(...effectivePass.mismatches);
  }
  if (mismatches.length > 0) {
    return failure(
      { recordPath, reportPath: renderReportPath },
      mismatches,
      'mismatches' in effectivePass ? effectivePass.error : undefined
    );
  }

  const confirmedAt = text(args.confirmedAt) || new Date().toISOString();
  const confirmedBy = text(args.confirmedBy) || 'main-agent-orchestration';
  const updatedSourceText = buildUpdatedSourceDocument({
    sourceText,
    extracted,
    sourceDocumentHash,
    implementationConfirmationHash,
    confirmationPageHash,
    reportPath: renderReportPath,
    htmlPath,
    confirmationText,
    confirmedAt,
    confirmedBy,
  });
  const htmlText = fs.readFileSync(htmlPath, 'utf8');
  const renderReportText = fs.readFileSync(renderReportPath, 'utf8');
  let writerRegistry: ControlledIngestWriterRegistrySnapshot;
  try {
    writerRegistry = projectControlledIngestWriterRegistry(
      confirmation,
      sourceDocumentHash,
      implementationConfirmationHash
    );
  } catch (error) {
    return failure(
      { recordPath, reportPath: renderReportPath },
      ['controlled_ingest_writer_invalid'],
      error instanceof Error ? error.message : String(error)
    );
  }
  const draft = initialDraftRecord({
    recordId,
    requirementSetId,
    sourcePath,
    sourceDocumentHash,
    implementationConfirmationHash,
    confirmation,
    writerRegistry,
    recordedAt: confirmedAt,
  });
  const prepared = prepareDraftRecord({
    recordPath,
    draft,
    sourceDocumentHash,
    implementationConfirmationHash,
  });
  const localArtifactIndexPath = path.join(path.dirname(recordPath), 'artifact-index.jsonl');
  const globalArtifactIndexPath = path.join(
    path.dirname(path.dirname(recordPath)),
    'artifact-index.jsonl'
  );
  const eventId = `confirmation_recorded:${confirmedAt}:${recordId}`;
  const eventPath = receiptPathForEvent(recordPath, eventId);
  const frozenIrPath = path.join(
    path.dirname(recordPath),
    'authority',
    'requirement-confirmation-ir.json'
  );
  const frozenIr: JsonObject = {
    schemaVersion: 'requirements-contract-confirmation-ir/v1',
    recordId,
    requirementSetId,
    sourcePath: normalizePath(sourcePath),
    sourceDocumentHash,
    implementationConfirmationHash,
    confirmationPageHash,
    renderReportPath: normalizePath(renderReportPath),
    htmlPath: normalizePath(htmlPath),
    implementationConfirmation: confirmation,
    controlledIngestWriterRegistryHash: writerRegistry.controlledIngestWriterRegistryHash,
    frozenAt: confirmedAt,
  };
  const frozenIrText = `${JSON.stringify(frozenIr, null, 2)}\n`;
  const frozenIrHash = sha256Json(frozenIr);
  const frozenIrContentHash = sha256Text(frozenIrText);
  const frozenConfirmation = object(
    frozenIr.implementationConfirmation
  ) as ImplementationConfirmation;
  const confirmedAuthorityIdentity: JsonObject = {
    schemaVersion: 'requirements-confirmed-authority-identity/v1',
    frozenConfirmationIrRef: {
      path: normalizePath(frozenIrPath),
      semanticHash: frozenIrHash,
      contentHash: frozenIrContentHash,
    },
  };
  if (!('ref' in effectivePass)) {
    throw new Error(effectivePass.error ?? 'requirements_effective_pass_receipt_missing');
  }
  const requirementsEffectivePassReceiptRef = effectivePass.ref;
  const confirmationAuthorityTupleInput: JsonObject = {
    schemaVersion: 'requirements-confirmation-authority-tuple-input/v1',
    requirementRecordId: recordId,
    sourceSnapshotHash: sourceDocumentHash,
    implementationConfirmationSemanticHash: implementationConfirmationHash,
    confirmedAuthorityIdentity,
    RequirementsEffectivePassReceiptRef: requirementsEffectivePassReceiptRef,
  };
  const authorityArtifactBindings = [
    {
      role: 'source_document',
      path: normalizePath(sourcePath),
      contentHash: sha256Text(updatedSourceText),
    },
    {
      role: 'confirmation_html',
      path: normalizePath(htmlPath),
      contentHash: sha256Text(htmlText),
    },
    {
      role: 'confirmation_render_report',
      path: normalizePath(renderReportPath),
      contentHash: sha256Text(renderReportText),
    },
  ];
  const eventPayload: JsonObject = {
    eventType: 'confirmation_recorded',
    eventId,
    recordId,
    requirementSetId,
    confirmedAt,
    confirmedBy,
    sourcePath: normalizePath(sourcePath),
    sourceDocumentHash,
    sourceDocumentHashScope:
      text(report.sourceDocumentHashScope) || 'semantic_source_excluding_confirmation_bookkeeping',
    implementationConfirmationHash,
    implementationConfirmationHashScope:
      text(report.implementationConfirmationHashScope) ||
      'semantic_implementation_confirmation_excluding_bookkeeping',
    confirmationPageHash,
    confirmationText,
    renderReportPath: normalizePath(renderReportPath),
    htmlPath: normalizePath(htmlPath),
    frozenConfirmationIrRef: {
      path: normalizePath(frozenIrPath),
      semanticHash: frozenIrHash,
      contentHash: frozenIrContentHash,
    },
    confirmedAuthorityIdentity,
    requirementsEffectivePassReceiptRef,
    confirmationAuthorityTupleInput,
    authorityArtifactBindings,
    entryFlow: text(confirmation.entryFlow) || 'standalone_tasks',
    ...(text(confirmation.entryFlowClass)
      ? { entryFlowClass: text(confirmation.entryFlowClass) }
      : {}),
    ...(text(confirmation.workflowAdapter)
      ? { workflowAdapter: text(confirmation.workflowAdapter) }
      : {}),
    ...(confirmation.contractAuthoringRequired === true ? { contractAuthoringRequired: true } : {}),
    globalContractTraceabilityPolicy: buildGlobalContractTraceabilityPolicy(confirmation),
    traceStatusPolicy: buildTraceStatusPolicy(),
    writerId: CONFIRMATION_WRITER_ID,
    writerRegistryHash: writerRegistry.controlledIngestWriterRegistryHash,
    writerHash: writerRegistry.confirmationWriter.writerHash,
    ...(text(provided.requestId) ? { requestId: text(provided.requestId) } : {}),
  };
  const artifactEntries: JsonObject[] = [
    {
      artifactType: 'requirement_record',
      sourceOfTruthRole: 'control',
      recordId,
      requirementSetId,
      path: normalizePath(recordPath),
      eventType: 'confirmation_recorded',
      contentHash: confirmationPageHash,
      receiptPath: normalizePath(eventPath),
    },
    {
      artifactType: 'requirement_confirmation_ir',
      sourceOfTruthRole: 'frozen_authoritative_ir',
      recordId,
      requirementSetId,
      path: normalizePath(frozenIrPath),
      semanticHash: frozenIrHash,
      contentHash: frozenIrContentHash,
      receiptPath: normalizePath(eventPath),
    },
    {
      artifactType: 'requirements_effective_pass_receipt',
      sourceOfTruthRole: 'evidence',
      recordId,
      requirementSetId,
      path: text(requirementsEffectivePassReceiptRef.path),
      contentHash: text(requirementsEffectivePassReceiptRef.receiptHash),
      receiptPath: normalizePath(eventPath),
    },
    ...authorityArtifactBindings.map((binding) => ({
      artifactType: binding.role,
      sourceOfTruthRole: 'acceptance_transaction_input',
      recordId,
      requirementSetId,
      path: binding.path,
      contentHash: binding.contentHash,
      receiptPath: normalizePath(eventPath),
    })),
  ];
  let commit: ControlCommitResult;
  try {
    commit = appendControlEventAndReplay(
      {
        recordPath,
        writerId: CONFIRMATION_WRITER_ID,
        eventType: 'confirmation_recorded',
        eventId,
        payload: eventPayload,
        recordedAt: confirmedAt,
        payloadSchemaVersion: 'confirmation_recorded/v1',
        bootstrapConfirmation: prepared.bootstrap,
        bootstrapRecord: prepared.record,
        artifactIndexUpdates: [
          { path: localArtifactIndexPath, entries: artifactEntries },
          {
            path: globalArtifactIndexPath,
            entries: artifactEntries.map((entry) => ({ ...entry, indexScope: 'global' })),
          },
        ],
        artifactWrites: [
          {
            path: sourcePath,
            content: updatedSourceText,
            contentHash: sha256Text(updatedSourceText),
            expectedBeforeHash: sha256Text(sourceText),
          },
          {
            path: htmlPath,
            content: htmlText,
            contentHash: sha256Text(htmlText),
            expectedBeforeHash: sha256Text(htmlText),
          },
          {
            path: renderReportPath,
            content: renderReportText,
            contentHash: sha256Text(renderReportText),
            expectedBeforeHash: sha256Text(renderReportText),
          },
          {
            path: frozenIrPath,
            content: frozenIrText,
            contentHash: frozenIrContentHash,
          },
        ],
        reduce: (record, payload) => {
          const sixModelResults: JsonObject = {};
          for (const model of MODELS) {
            sixModelResults[model] = modelResult(
              recordId,
              requirementSetId,
              sourceDocumentHash,
              implementationConfirmationHash,
              confirmationPageHash,
              model,
              model === 'requirement_confirmation' ? 'pass' : 'not_established',
              confirmedAt,
              confirmedBy,
              renderReportPath,
              htmlPath
            );
          }
          const historyEvent: JsonObject = {
            eventType: 'confirmation_recorded',
            recordId,
            requirementSetId,
            confirmedAt,
            confirmedBy,
            sourcePath: normalizePath(sourcePath),
            sourceDocumentHash,
            sourceDocumentHashScope:
              text(payload.sourceDocumentHashScope) ||
              'semantic_source_excluding_confirmation_bookkeeping',
            implementationConfirmationHash,
            implementationConfirmationHashScope:
              text(payload.implementationConfirmationHashScope) ||
              'semantic_implementation_confirmation_excluding_bookkeeping',
            confirmationPageHash,
            confirmationText,
            renderReportPath: normalizePath(renderReportPath),
            htmlPath: normalizePath(htmlPath),
            entryFlow: text(frozenConfirmation.entryFlow) || 'standalone_tasks',
            ...(text(frozenConfirmation.entryFlowClass)
              ? { entryFlowClass: text(frozenConfirmation.entryFlowClass) }
              : {}),
            ...(text(frozenConfirmation.workflowAdapter)
              ? { workflowAdapter: text(frozenConfirmation.workflowAdapter) }
              : {}),
            ...(frozenConfirmation.contractAuthoringRequired === true
              ? { contractAuthoringRequired: true }
              : {}),
            globalContractTraceabilityPolicy:
              buildGlobalContractTraceabilityPolicy(frozenConfirmation),
            traceStatusPolicy: buildTraceStatusPolicy(),
          };
          const history = [...objects(record.confirmationHistory), historyEvent];
          return {
            ...record,
            status: 'user_confirmed',
            recordId,
            requirementSetId,
            sourcePath: normalizePath(sourcePath),
            sourceDocumentHash,
            implementationConfirmationHash,
            confirmationPageHash,
            latestConfirmationProjectionHash: confirmationPageHash,
            confirmationHistory: history,
            sixModelResults,
            flow: text(frozenConfirmation.entryFlow) || text(record.flow) || 'standalone_tasks',
            stage: 'requirement_confirmation',
            currentStage: 'requirement_confirmation',
            currentMentalModel: 'requirement_confirmation',
            entryFlow:
              text(frozenConfirmation.entryFlow) || text(record.entryFlow) || 'standalone_tasks',
            ...(text(frozenConfirmation.entryFlowClass)
              ? { entryFlowClass: text(frozenConfirmation.entryFlowClass) }
              : {}),
            ...(text(frozenConfirmation.workflowAdapter)
              ? { workflowAdapter: text(frozenConfirmation.workflowAdapter) }
              : {}),
            ...(frozenConfirmation.contractAuthoringRequired === true
              ? { contractAuthoringRequired: true }
              : {}),
            globalContractTraceabilityPolicy:
              buildGlobalContractTraceabilityPolicy(frozenConfirmation),
            traceStatusPolicy: buildTraceStatusPolicy(),
            lastEventType: 'confirmation_recorded',
            updatedAt: confirmedAt,
          };
        },
      },
      input.controlStoreDeps
    );
  } catch (error) {
    return failure(
      { recordPath, reportPath: renderReportPath },
      ['control_store_commit_failed'],
      error instanceof Error ? error.message : String(error)
    );
  }

  const committedRecord = readJson(recordPath);
  return {
    ok: true,
    action: 'confirm-scope',
    exitCode: 0,
    authority: 'main-agent-controlled-confirmation',
    requirementRecordPath: normalizePath(recordPath),
    renderReportPath: normalizePath(renderReportPath),
    eventLogPath: normalizePath(commit.eventLogPath),
    receiptPath: normalizePath(commit.receiptPath),
    artifactIndexPaths: commit.artifactIndexPaths.map(normalizePath),
    artifactPaths: commit.artifactPaths.map(normalizePath),
    sourceUpdated: true,
    event: {
      ...eventPayload,
      afterRecordHash: text(committedRecord.recordHash),
      eventHash: commit.event.eventHash,
    },
  };
}

export function mainRequirementsContractConfirmationAcceptance(argv: string[]): number {
  const args: ConfirmationArgs = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--json') continue;
    if (!token.startsWith('--')) throw new Error(`Unexpected positional argument: ${token}`);
    const key = token.slice(2).replace(/-([a-z])/gu, (_, letter: string) => letter.toUpperCase());
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`Missing value for ${token}`);
    args[key] = value;
    index += 1;
  }
  const result = runRequirementsContractConfirmationAcceptance({
    root: text(args.cwd) || process.cwd(),
    args,
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  return result.ok ? 0 : result.exitCode;
}

if (
  require.main === module &&
  /(^|[\\/])requirements-contract-confirmation-acceptance\.[cm]?js$/u.test(process.argv[1] ?? '')
) {
  try {
    process.exitCode = mainRequirementsContractConfirmationAcceptance(process.argv.slice(2));
  } catch (error) {
    console.error(
      JSON.stringify(
        { ok: false, error: error instanceof Error ? error.message : String(error) },
        null,
        2
      )
    );
    process.exitCode = 2;
  }
}
