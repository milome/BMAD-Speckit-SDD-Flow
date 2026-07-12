import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import yaml from 'js-yaml';
import { runMainAgentPreConfirmationDrilldown } from '../../../packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-orchestration';

type JsonObject = Record<string, unknown>;

interface CriticalAuditorFixtureInput {
  roundIndex: number;
  gateDryRun: {
    hash: string;
    reconciliation: { issueCount: number };
    reportPath: string;
    actionableBlockingIssues?: Array<{ code?: string }>;
  };
  packetProjectionSummary: {
    projectionGroups: string[];
    projectionRefs: string[];
  };
}

export function createTempRoot(prefix: string): string {
  return mkdtempSync(path.join(os.tmpdir(), prefix));
}

export function removeTempRoot(root: string): void {
  rmSync(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
}

export function writeText(root: string, relativePath: string, text: string): string {
  const target = path.join(root, relativePath);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, text, 'utf8');
  return target;
}

export function sha256Text(value: string): string {
  return `sha256:${createHash('sha256').update(value, 'utf8').digest('hex')}`;
}

export function sha256File(filePath: string): string {
  return sha256Text(readFileSync(filePath, 'utf8'));
}

export function artifacts(root: string, recordId: string, requirementSetId = recordId) {
  const authoring = path.join(
    root,
    '_bmad-output',
    'runtime',
    'requirement-records',
    recordId,
    'authoring'
  );
  const confirmation = path.join(
    root,
    '_bmad-output',
    'runtime',
    'requirement-records',
    recordId,
    'confirmation'
  );
  return {
    authoring,
    confirmation,
    controlledMustCandidates: path.join(authoring, 'controlled-must-candidates.json'),
    requirementCoverageLedger: path.join(authoring, 'requirement-coverage-ledger.json'),
    targetAuthorityReport: path.join(authoring, 'target-authority-report.json'),
    validationAuthorityReport: path.join(authoring, 'validation-authority-report.json'),
    projectionDomainSanityReport: path.join(authoring, 'projection-domain-sanity-report.json'),
    sourceMutationDecision: path.join(authoring, 'source-mutation-decision.json'),
    authoringTransaction: path.join(authoring, 'authoring-transaction.json'),
    draftSourcePreview: path.join(authoring, 'draft-source-preview.md'),
    promotionReceipt: path.join(authoring, 'promotion-receipt.json'),
    draftImplementationConfirmation: path.join(authoring, 'draft-implementation-confirmation.json'),
    encodingReport: path.join(authoring, 'encoding-report.json'),
    receipt1: path.join(authoring, 'critical-auditor-receipt-round-1.json'),
    receipt2: path.join(authoring, 'critical-auditor-receipt-round-2.json'),
    receipt3: path.join(authoring, 'critical-auditor-receipt-round-3.json'),
    scaleRoutingDecision: path.join(authoring, 'scale-routing-decision.json'),
    checkpointPersistenceEvidence: path.join(authoring, 'checkpoint-persistence-evidence.json'),
    checkpointReceiptPaths: Array.from({ length: 9 }, (_item, index) =>
      path.join(authoring, `checkpoint-receipt-cp-${String(index).padStart(2, '0')}.json`)
    ),
    progress: path.join(authoring, 'semantic-checkpoint-progress.json'),
    reconciliationReport: path.join(authoring, 'must_packet_source_reconciliation_report.json'),
    preRenderMustGate: path.join(authoring, 'pre-render-must-decomposition-gate-report.json'),
    preRenderGlobalConsistency: path.join(authoring, 'pre-render-global-consistency-report.json'),
    sourceMaterializationReceipt: path.join(
      root,
      '_bmad-output',
      'runtime',
      'requirement-records',
      requirementSetId,
      'authoring',
      'source-materialization-receipt.json'
    ),
    html: path.join(confirmation, 'confirmation.html'),
  };
}

export function readJson<T = JsonObject>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, 'utf8')) as T;
}

export function stagingTransactionDir(root: string, recordId: string): string {
  const stagingRoot = path.join(
    root,
    '_bmad-output',
    'runtime',
    'requirement-records',
    recordId,
    'authoring',
    'staging'
  );
  const entries = existsSync(stagingRoot)
    ? readdirSync(stagingRoot, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => path.join(stagingRoot, entry.name))
        .sort((left, right) => statSync(right).mtimeMs - statSync(left).mtimeMs)
    : [];
  if (entries.length === 0) {
    throw new Error(`expected at least one staging transaction under ${stagingRoot}, found 0`);
  }
  return entries[0];
}

export function roundArtifact(
  root: string,
  recordId: string,
  kind: 'request' | 'response' | 'receipt',
  roundIndex = 1
): string {
  const base = stagingTransactionDir(root, recordId);
  const file =
    kind === 'request'
      ? `critical-auditor-round-request-${roundIndex}.json`
      : kind === 'response'
        ? `critical-auditor-round-response-${roundIndex}.json`
        : `critical-auditor-receipt-round-${roundIndex}.json`;
  return path.join(base, file);
}

export function sourcePromotionDecisionPath(root: string, recordId: string): string {
  return path.join(stagingTransactionDir(root, recordId), 'source-promotion-decision.json');
}

export function writeCheckpointPersistenceEvidence(root: string, recordId: string): string {
  const paths = artifacts(root, recordId, `${recordId}-SET`);
  const route = readJson<Record<string, unknown>>(paths.scaleRoutingDecision);
  const progress = readJson<Record<string, unknown>>(paths.progress);
  const checkpointIds = Array.isArray(progress.checkpoints)
    ? (progress.checkpoints as Array<Record<string, unknown>>)
        .filter((checkpoint) => checkpoint.status === 'passed')
        .map((checkpoint) => String(checkpoint.id))
    : [];
  const evidence = {
    ok: true,
    status: 'satisfied',
    routeDecisionPath: paths.scaleRoutingDecision,
    routeDecisionHash: route.routeDecisionHash,
    checkpointPersistenceSatisfiedCandidate: true,
    checkpointPersistenceRef: {
      routeDecisionHash: route.routeDecisionHash,
      progressPath: paths.progress,
      progressHash: sha256File(paths.progress),
      completedCheckpointIds: checkpointIds,
      preRenderMustDecompositionGateHash: sha256File(paths.preRenderMustGate),
      preRenderGlobalConsistencyHash: sha256File(paths.preRenderGlobalConsistency),
      packetSourceReconciliationHash: sha256File(paths.reconciliationReport),
    },
    progressHash: sha256File(paths.progress),
    preRenderMustDecompositionGateHash: sha256File(paths.preRenderMustGate),
    preRenderGlobalConsistencyHash: sha256File(paths.preRenderGlobalConsistency),
    packetSourceReconciliationHash: sha256File(paths.reconciliationReport),
  };
  const evidencePath = path.join(
    root,
    '_bmad-output',
    'runtime',
    'requirement-records',
    recordId,
    'authoring',
    'checkpoint-persistence-evidence.external.json'
  );
  writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
  return evidencePath;
}

export function stagingMustDecompositionPacket(
  root: string,
  recordId: string
): Record<string, unknown> {
  const packetFile = path.join(
    stagingTransactionDir(root, recordId),
    'must_decomposition_packet.json'
  );
  const parsed = readJson<{ must_decomposition_packet?: Record<string, unknown> }>(packetFile);
  if (!parsed.must_decomposition_packet) {
    throw new Error(`must_decomposition_packet missing from ${packetFile}`);
  }
  return parsed.must_decomposition_packet;
}

export function firstProjectionRef(packet: Record<string, unknown>): string {
  const packets = Array.isArray(packet.mustPackets) ? packet.mustPackets : [];
  for (const mustPacket of packets) {
    if (!mustPacket || typeof mustPacket !== 'object' || Array.isArray(mustPacket)) {
      continue;
    }
    for (const value of Object.values(mustPacket as Record<string, unknown>)) {
      if (!Array.isArray(value)) {
        continue;
      }
      for (const row of value) {
        if (row && typeof row === 'object' && !Array.isArray(row)) {
          const id = String((row as Record<string, unknown>).id ?? '').trim();
          if (id) {
            return id;
          }
        }
      }
    }
  }
  throw new Error('projection ref not found in packet');
}

export function buildValidResponseFromRequest(
  request: Record<string, unknown>,
  packet: Record<string, unknown>
): Record<string, unknown> {
  const gateDryRun = request.gateDryRun as Record<string, unknown>;
  const actionableBlockingIssues = Array.isArray(gateDryRun.actionableBlockingIssues)
    ? (gateDryRun.actionableBlockingIssues as Array<Record<string, unknown>>)
    : [];
  const reviewedMustRefs = Array.isArray(request.mustRefs) ? (request.mustRefs as string[]) : [];
  const projectionSummary = request.packetProjectionSummary as Record<string, unknown> | undefined;
  const projectionRefs = Array.isArray(projectionSummary?.projectionRefs)
    ? (projectionSummary.projectionRefs as string[])
    : [];
  const projectionQualityGate = request.projectionQualityGate as
    | Record<string, unknown>
    | undefined;
  const checkedProjectionQualityRuleCodes = Array.isArray(projectionQualityGate?.requiredRuleCodes)
    ? (projectionQualityGate.requiredRuleCodes as string[])
    : [];
  return {
    schemaVersion: 'critical-auditor-round-response/v1',
    verdict: 'no_new_valid_gap',
    roundIndex: request.roundIndex,
    transactionId: request.transactionId,
    namespaceVersion: request.namespaceVersion,
    requestHash: request.requestHash,
    sourceHash: request.sourceHash,
    sourceDocumentHash: request.sourceDocumentHash,
    implementationConfirmationHash: request.implementationConfirmationHash,
    packetHash: request.packetHash,
    gateDryRunHash: gateDryRun.gateDryRunHash ?? gateDryRun.hash,
    reconciliationIssueCount: (gateDryRun.reconciliation as Record<string, unknown>).issueCount,
    checkedProjectionGroups: request.packetProjectionSummary
      ? (request.packetProjectionSummary as Record<string, unknown>).projectionGroups
      : [
          'semantic_kernel',
          'must_decomposition_packet',
          'source_materialization_receipt',
          'packet_source_reconciliation',
          'pre_render_must_decomposition_gate',
        ],
    checkedProjectionQualityRuleCodes,
    reviewedMustRefs,
    reviewedProjectionRefs: [projectionRefs[0] ?? firstProjectionRef(packet)],
    priorFindingsDisposition: [
      {
        findingRef: 'ROUND-1-BASELINE',
        disposition: 'new',
        evidenceRefs: [String(gateDryRun.reportPath ?? 'gate-dry-run')],
      },
    ],
    rejectedGapCandidates: [{ id: 'REJ-1', reason: 'no new valid gap detected' }],
    falsePositiveProofs: actionableBlockingIssues.map((issue) => ({
      blockerCode: String(issue.code ?? ''),
      proofType: 'current_source_packet_hash_match',
      evidenceRefs: [String(gateDryRun.reportPath ?? 'gate-dry-run')],
    })),
    rationale: 'No new valid gap detected in the current staging transaction.',
  };
}

export function readImplementationConfirmation(filePath: string): JsonObject {
  const text = readFileSync(filePath, 'utf8');
  const match = text.match(/^implementationConfirmation:\n[\s\S]*$/m);
  if (!match) {
    throw new Error(`implementationConfirmation block not found: ${filePath}`);
  }
  const parsed = yaml.load(match[0]) as { implementationConfirmation?: JsonObject } | null;
  if (!parsed?.implementationConfirmation) {
    throw new Error(`implementationConfirmation block is invalid: ${filePath}`);
  }
  return parsed.implementationConfirmation;
}

export function cleanCriticalAuditorRound(input: CriticalAuditorFixtureInput) {
  const { roundIndex, gateDryRun, packetProjectionSummary } = input;
  return {
    verdict: 'no_new_valid_gap' as const,
    gateDryRunHash: gateDryRun.hash,
    reconciliationIssueCount: gateDryRun.reconciliation.issueCount,
    checkedProjectionGroups: packetProjectionSummary.projectionGroups,
    checkedProjectionQualityRuleCodes: [
      'projection_per_must_acceptance_not_independent',
      'projection_shared_evidence_without_per_must_oracle',
      'required_command_all_cover_all_without_per_must_assertions',
      'target_modification_path_all_cover_all',
      'current_target_map_not_product_specific',
      'business_visual_generic_or_compressed',
    ],
    reviewedProjectionRefs: packetProjectionSummary.projectionRefs.slice(0, 1),
    priorFindingsDisposition: [
      {
        findingRef: `ROUND-${roundIndex}-BASELINE`,
        disposition: roundIndex === 1 ? 'new' : 'unchanged',
        evidenceRefs: [gateDryRun.reportPath],
      },
    ],
    rejectedGapCandidates: [{ id: `REJ-${roundIndex}`, reason: 'no new valid gap detected' }],
    falsePositiveProofs: (gateDryRun.actionableBlockingIssues ?? []).map((issue) => ({
      blockerCode: String(issue.code ?? ''),
      proofType: 'current_source_packet_hash_match',
      evidenceRefs: [gateDryRun.reportPath],
    })),
    rationale: `Round ${roundIndex} found no new valid gap.`,
  };
}

export function runAuthoring(
  root: string,
  source: string,
  recordId: string,
  options: Record<string, unknown> = {}
) {
  return runMainAgentPreConfirmationDrilldown(root, {
    source,
    recordId,
    requirementSetId: `${recordId}-SET`,
    ...options,
  });
}

export function writeTestLocalizationResponse(
  root: string,
  recordId: string,
  relativePath = 'localization-response.test.json'
): string {
  const requestPath = path.join(
    root,
    '_bmad-output',
    'runtime',
    'requirement-records',
    recordId,
    'authoring',
    'localization-request.json'
  );
  const request = readJson<{
    requestHash: string;
    sourceDocumentHash: string;
    confirmationLanguage: string;
    entries: Array<{
      key: string;
      rowId: string;
      field: string;
      sourceTextHash: string;
    }>;
  }>(requestPath);
  return writeText(
    root,
    relativePath,
    `${JSON.stringify(
      {
        schemaVersion: 'requirements-contract-localization-response/v1',
        requestHash: request.requestHash,
        sourceDocumentHash: request.sourceDocumentHash,
        confirmationLanguage: request.confirmationLanguage,
        providerMode: 'main_session_authoring_agent',
        semanticEquivalenceAttested: true,
        translations: request.entries.map((entry) => ({
          key: entry.key,
          sourceTextHash: entry.sourceTextHash,
          translatedText: `${entry.rowId} 的${entry.field}中文语义译文`,
        })),
      },
      null,
      2
    )}\n`
  );
}

export function runAuthoringWithTestLocalization(
  root: string,
  source: string,
  recordId: string,
  options: Record<string, unknown> = {}
) {
  const first = runAuthoring(root, source, recordId, options);
  if (first.substate !== 'localization_translation_required') {
    return first;
  }
  return runAuthoring(root, source, recordId, {
    ...options,
    localizationResponseFile: writeTestLocalizationResponse(root, recordId),
  });
}

export function runIntakeAuthoring(
  root: string,
  intakeSource: string,
  targetSource: string,
  recordId: string,
  options: Record<string, unknown> = {}
) {
  return runMainAgentPreConfirmationDrilldown(root, {
    intakeSource,
    targetSource,
    recordId,
    requirementSetId: `${recordId}-SET`,
    ...options,
  });
}

export function issueCodes(result: { blockingIssues?: Array<{ code: string }> }): string[] {
  return (result.blockingIssues ?? []).map((issue) => issue.code);
}

export function writeConsumerRequirement(
  root: string,
  relativePath = 'docs/requirements/multi-timeframe.md'
) {
  return writeText(
    root,
    relativePath,
    [
      '# Multi Timeframe Display Settings',
      '',
      '目标文件：`vnpy/chart/multi_timeframe_widget.py`, `vnpy/chart/multi_timeframe_settings_dialog.py`, `vnpy/trader/ui/widget.py`',
      '',
      '## Functional Requirements',
      '',
      '| ID | Requirement | Acceptance link |',
      '| --- | --- | --- |',
      '| FR-001 | 主图摘要必须展示所有启用周期和指标。 | ACC-001 |',
      '| FR-002 | 设置面板必须显示可编辑周期列表并实时预览修改。 | ACC-002 |',
      '| FR-003 | 取消操作必须回滚全部预览变更。 | ACC-003 |',
      '| FR-004 | OK 操作必须持久化设置并刷新图表。 | ACC-004 |',
      '',
      '## Negative Requirements And Not Done Conditions',
      '',
      '| ID | Not-done condition | Negative assertion | Blocks completion when | Failure refs | Evidence refs |',
      '| --- | --- | --- | --- | --- | --- |',
      '| NEG-001 | 仅更新确认页或内存预览不能算完成。 | 持久化失败时必须保留先前设置且不得宣称保存成功。 | 失败后状态被部分写入或错误显示成功。 | FAIL-001 | ACC-003 ACC-004 CMD-001 |',
      '',
      '## Failure Matrix',
      '',
      '| ID | Failure condition | Required system behavior | Negative requirement refs | Evidence | Requirement refs |',
      '| --- | --- | --- | --- | --- | --- |',
      '| FAIL-001 | 设置校验、持久化或刷新失败。 | 阻止提交，保留最近一次有效设置，并向用户显示可恢复错误。 | NEG-001 | ACC-001 ACC-002 ACC-003 ACC-004 E2E-001 | MUST-FR-001 MUST-FR-002 MUST-FR-003 MUST-FR-004 |',
      '',
      '## Acceptance Evidence',
      '',
      '| ID | Evidence target | Covers | Required evidence | Oracle | Assertion source | Responsibility mapping |',
      '| --- | --- | --- | --- | --- | --- | --- |',
      '| ACC-001 | 摘要显示 | MUST-FR-001 | pytest tests/test_multi_timeframe_settings.py | 所有启用周期和指标都出现在摘要中。 | CMD-001 TRACE-001 | PATH-001 owns implementation and remediation. |',
      '| ACC-002 | 设置预览 | MUST-FR-002 | pytest tests/test_multi_timeframe_settings.py | 编辑周期后预览立即反映新配置。 | CMD-001 TRACE-002 | PATH-002 owns implementation and remediation. |',
      '| ACC-003 | 取消回滚 | MUST-FR-003 NEG-001 | pytest tests/test_multi_timeframe_settings.py | 取消后恢复修改前设置且无持久化副作用。 | CMD-001 TRACE-003 TRACE-005 | PATH-002 owns implementation and remediation. |',
      '| ACC-004 | 保存刷新 | MUST-FR-004 NEG-001 | pytest tests/test_multi_timeframe_settings.py | 保存成功后设置持久化且图表刷新一次。 | CMD-001 TRACE-004 TRACE-005 | PATH-003 owns implementation and remediation. |',
      '',
      '## Test And Verification Paths',
      '',
      '| ID | Type | Covers | Command or evidence path | Completion rule | Per-MUST oracle | Assertion source | Responsibility mapping | Target files |',
      '| --- | --- | --- | --- | --- | --- | --- | --- | --- |',
      '| CMD-001 | delivery-evidence | MUST-FR-001 MUST-FR-002 MUST-FR-003 MUST-FR-004 NEG-001 | pytest tests/test_multi_timeframe_settings.py | Exit code 0. | 每个 MUST 使用对应 ACC/TRACE oracle 独立闭环。 | ACC-001 ACC-002 ACC-003 ACC-004 E2E-001 TRACE-001 TRACE-002 TRACE-003 TRACE-004 TRACE-005 | PATH-001 PATH-002 PATH-003 own remediation. | tests/test_multi_timeframe_settings.py vnpy/chart/multi_timeframe_widget.py vnpy/chart/multi_timeframe_settings_dialog.py vnpy/trader/ui/widget.py |',
      '| E2E-001 | e2e | MUST-FR-001 MUST-FR-002 MUST-FR-003 MUST-FR-004 NEG-001 | pytest tests/test_multi_timeframe_settings.py | Exit code 0. | 用户完成预览、取消、保存和刷新闭环。 | ACC-001 ACC-002 ACC-003 ACC-004 CMD-001 TRACE-001 TRACE-002 TRACE-003 TRACE-004 TRACE-005 | PATH-001 PATH-002 PATH-003 own remediation. | tests/test_multi_timeframe_settings.py vnpy/chart/multi_timeframe_widget.py vnpy/chart/multi_timeframe_settings_dialog.py vnpy/trader/ui/widget.py |',
      '',
      '## Trace Matrix Source',
      '',
      '| ID | Covers | Evidence refs | Acceptance refs | Contract validation command refs | Delivery evidence command refs | View refs | Artifact refs | Boundary refs | Per-MUST oracle | Per-MUST closure assertion | Responsibility mapping |',
      '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
      '| TRACE-001 | MUST-FR-001 | ACC-001 | ACC-001 E2E-001 | CMD-001 | CMD-001 | none | PATH-001 | OUT-001 | 所有启用周期和指标都出现在摘要中。 | MUST-FR-001 closes through ACC-001 and TRACE-001. | PATH-001 owns remediation. |',
      '| TRACE-002 | MUST-FR-002 | ACC-002 | ACC-002 E2E-001 | CMD-001 | CMD-001 | none | PATH-002 | none | 编辑周期后预览立即反映新配置。 | MUST-FR-002 closes through ACC-002 and TRACE-002. | PATH-002 owns remediation. |',
      '| TRACE-003 | MUST-FR-003 | ACC-003 | ACC-003 E2E-001 | CMD-001 | CMD-001 | none | PATH-002 | none | 取消后恢复修改前设置且无持久化副作用。 | MUST-FR-003 closes through ACC-003 and TRACE-003. | PATH-002 owns remediation. |',
      '| TRACE-004 | MUST-FR-004 | ACC-004 | ACC-004 E2E-001 | CMD-001 | CMD-001 | none | PATH-003 | none | 保存成功后设置持久化且图表刷新一次。 | MUST-FR-004 closes through ACC-004 and TRACE-004. | PATH-003 owns remediation. |',
      '| TRACE-005 | NEG-001 | ACC-003 ACC-004 | ACC-003 ACC-004 E2E-001 | CMD-001 | CMD-001 | none | PATH-002 PATH-003 | none | 失败时保留先前设置且不显示保存成功。 | NEG-001 closes through negative controls in ACC-003 and ACC-004. | PATH-002 PATH-003 own remediation. |',
      '',
      '## Implementation Path Map',
      '',
      '| ID | Repository path | Ownership | Required change | Requirement refs | Per-MUST oracle | Assertion source | Responsibility mapping |',
      '| --- | --- | --- | --- | --- | --- | --- | --- |',
      '| PATH-001 | `vnpy/chart/multi_timeframe_widget.py` | Widget owner | Render enabled periods and refresh the chart. | MUST-FR-001 MUST-FR-004 | ACC-001 and ACC-004 pass. | ACC-001 ACC-004 CMD-001 TRACE-001 TRACE-004 | Widget owner owns implementation and rollback. |',
      '| PATH-002 | `vnpy/chart/multi_timeframe_settings_dialog.py` | Dialog owner | Implement preview, cancel, validation, and rollback. | MUST-FR-002 MUST-FR-003 NEG-001 | ACC-002 and ACC-003 pass. | ACC-002 ACC-003 CMD-001 TRACE-002 TRACE-003 TRACE-005 | Dialog owner owns implementation and rollback. |',
      '| PATH-003 | `vnpy/trader/ui/widget.py` | UI owner | Persist accepted settings and trigger one refresh. | MUST-FR-004 NEG-001 | ACC-004 passes without partial writes. | ACC-004 CMD-001 TRACE-004 TRACE-005 | UI owner owns implementation and rollback. |',
      '',
      '## Out Of Scope',
      '',
      '| ID | Forbidden scope | Boundary assertion | Evidence |',
      '| --- | --- | --- | --- |',
      '| OUT-001 | 本需求不重写交易引擎。 | 保持交易引擎不变。 | ACC-001 |',
      '',
    ].join('\n')
  );
}

export function writeMinimalConsumerRequirement(
  root: string,
  relativePath = 'docs/requirements/minimal-consumer.md'
) {
  return writeText(
    root,
    relativePath,
    [
      '# Minimal Consumer Requirement',
      '',
      '目标文件：`vnpy/chart/multi_timeframe_widget.py`',
      '',
      '## Functional Requirements',
      '',
      '| ID | Requirement | Acceptance link |',
      '| --- | --- | --- |',
      '| FR-001 | 主图摘要必须展示所有启用周期。 | ACC-001 |',
      '',
      '## Negative Requirements And Not Done Conditions',
      '',
      '| ID | Not-done condition | Negative assertion | Blocks completion when | Failure refs | Evidence refs |',
      '| --- | --- | --- | --- | --- | --- |',
      '| NEG-001 | 仅生成确认页不能算完成功能。 | 摘要缺少任一启用周期时不得宣称完成。 | 摘要显示不完整。 | FAIL-001 | ACC-001 CMD-001 |',
      '',
      '## Failure Matrix',
      '',
      '| ID | Failure condition | Required system behavior | Negative requirement refs | Evidence | Requirement refs |',
      '| --- | --- | --- | --- | --- | --- |',
      '| FAIL-001 | 启用周期配置缺失或无效。 | 保留最近一次有效摘要并显示配置错误，不输出不完整摘要。 | NEG-001 | ACC-001 E2E-001 | MUST-FR-001 |',
      '',
      '## Acceptance Evidence',
      '',
      '| ID | Evidence target | Covers | Required evidence | Oracle | Assertion source | Responsibility mapping |',
      '| --- | --- | --- | --- | --- | --- | --- |',
      '| ACC-001 | 主图摘要显示 | MUST-FR-001 NEG-001 | pytest tests/test_multi_timeframe_settings.py | 主图摘要展示全部启用周期，配置无效时保持先前有效摘要。 | CMD-001 TRACE-001 TRACE-002 | PATH-001 owns remediation. |',
      '',
      '## Test And Verification Paths',
      '',
      '| ID | Type | Covers | Command or evidence path | Completion rule | Per-MUST oracle | Assertion source | Responsibility mapping | Target files |',
      '| --- | --- | --- | --- | --- | --- | --- | --- | --- |',
      '| CMD-001 | delivery-evidence | MUST-FR-001 NEG-001 | pytest tests/test_multi_timeframe_settings.py | Exit code 0. | 主图摘要展示全部启用周期，失败时保持安全状态。 | ACC-001 E2E-001 TRACE-001 TRACE-002 | PATH-001 owns remediation. | tests/test_multi_timeframe_settings.py vnpy/chart/multi_timeframe_widget.py |',
      '| E2E-001 | e2e | MUST-FR-001 NEG-001 | pytest tests/test_multi_timeframe_settings.py | Exit code 0. | 用户看到完整摘要或明确配置错误。 | ACC-001 CMD-001 TRACE-001 TRACE-002 | PATH-001 owns remediation. | tests/test_multi_timeframe_settings.py vnpy/chart/multi_timeframe_widget.py |',
      '',
      '## Trace Matrix Source',
      '',
      '| ID | Covers | Evidence refs | Acceptance refs | Contract validation command refs | Delivery evidence command refs | View refs | Artifact refs | Boundary refs | Per-MUST oracle | Per-MUST closure assertion | Responsibility mapping |',
      '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
      '| TRACE-001 | MUST-FR-001 | ACC-001 | ACC-001 E2E-001 | CMD-001 | CMD-001 | none | PATH-001 | none | 主图摘要展示全部启用周期。 | MUST-FR-001 closes through ACC-001 and TRACE-001. | PATH-001 owns remediation. |',
      '| TRACE-002 | NEG-001 | ACC-001 | ACC-001 E2E-001 | CMD-001 | CMD-001 | none | PATH-001 | none | 配置无效时保持先前有效摘要且不宣称成功。 | NEG-001 closes through ACC-001 negative control. | PATH-001 owns remediation. |',
      '',
      '## Implementation Path Map',
      '',
      '| ID | Repository path | Ownership | Required change | Requirement refs | Per-MUST oracle | Assertion source | Responsibility mapping |',
      '| --- | --- | --- | --- | --- | --- | --- | --- |',
      '| PATH-001 | `vnpy/chart/multi_timeframe_widget.py` | Widget owner | Render enabled periods and preserve the last valid summary on invalid input. | MUST-FR-001 NEG-001 | ACC-001 passes. | ACC-001 CMD-001 TRACE-001 TRACE-002 | Widget owner owns implementation and rollback. |',
      '',
      '## Out Of Scope',
      '',
      '| ID | Forbidden scope | Boundary assertion | Evidence |',
      '| --- | --- | --- | --- |',
      '| OUT-001 | 不修改交易执行逻辑。 | 保持交易执行逻辑不变。 | ACC-001 |',
      '',
    ].join('\n')
  );
}

export function expectSourceHashUnchanged(source: string, beforeHash: string): void {
  if (!existsSync(source)) {
    throw new Error(`source disappeared: ${source}`);
  }
  const afterHash = sha256File(source);
  if (afterHash !== beforeHash) {
    throw new Error(`source hash changed: before=${beforeHash} after=${afterHash}`);
  }
}
