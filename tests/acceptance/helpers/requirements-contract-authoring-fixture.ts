import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import yaml from 'js-yaml';
import { runMainAgentPreConfirmationDrilldown } from '../../../scripts/main-agent-orchestration';

type JsonObject = Record<string, unknown>;

interface CriticalAuditorFixtureInput {
  roundIndex: number;
  gateDryRun: {
    hash: string;
    reconciliation: { issueCount: number };
    reportPath: string;
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
    draftSourcePreview: path.join(authoring, 'draft-source-preview.md'),
    draftImplementationConfirmation: path.join(authoring, 'draft-implementation-confirmation.json'),
    receipt1: path.join(authoring, 'critical-auditor-receipt-round-1.json'),
    receipt2: path.join(authoring, 'critical-auditor-receipt-round-2.json'),
    receipt3: path.join(authoring, 'critical-auditor-receipt-round-3.json'),
    scaleRoutingDecision: path.join(authoring, 'scale-routing-decision.json'),
    checkpointPersistenceEvidence: path.join(authoring, 'checkpoint-persistence-evidence.json'),
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
    reviewedProjectionRefs: packetProjectionSummary.projectionRefs.slice(0, 1),
    priorFindingsDisposition: [
      {
        findingRef: `ROUND-${roundIndex}-BASELINE`,
        disposition: roundIndex === 1 ? 'new' : 'unchanged',
        evidenceRefs: [gateDryRun.reportPath],
      },
    ],
    rejectedGapCandidates: [{ id: `REJ-${roundIndex}`, reason: 'no new valid gap detected' }],
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

export function issueCodes(result: { blockingIssues?: Array<{ code: string }> }): string[] {
  return (result.blockingIssues ?? []).map((issue) => issue.code);
}

export function writeConsumerRequirement(root: string, relativePath = 'docs/requirements/multi-timeframe.md') {
  return writeText(
    root,
    relativePath,
    [
      '# Multi Timeframe Display Settings',
      '',
      '目标文件：`vnpy/chart/multi_timeframe_widget.py`, `vnpy/chart/multi_timeframe_settings_dialog.py`, `vnpy/trader/ui/widget.py`',
      '',
      '## 默认显示',
      '',
      '| 项目 | 默认 | 行为 |',
      '|---|---|---|',
      '| 主图摘要 | 开启 | 主图摘要展示所有启用周期和指标。 |',
      '| 设置面板 | 开启 | 设置面板默认显示可编辑周期列表。 |',
      '',
      '## 设置面板',
      '',
      '- 支持批量操作启用和禁用多个周期。',
      '- 实时预览在用户修改设置时立即更新主图摘要。',
      '- 取消时回滚所有预览变更。',
      '- OK 按钮持久化设置并刷新图表。',
      '',
      '## 验收标准',
      '',
      '- 1366x768 分辨率下必须可用，不遮挡 OK 和取消按钮。',
      '- pytest tests/test_multi_timeframe_settings.py 必须覆盖设置持久化。',
      '',
      '```text',
      'This fenced block must not become a requirement candidate.',
      '```',
      '',
      '## 非目标',
      '',
      '本需求不重写交易引擎。',
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
