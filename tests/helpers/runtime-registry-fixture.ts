/**
 * Test helpers: minimal registry + project context so `emit-runtime-policy` needs no env vars.
 */
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

const REPO_ROOT = process.cwd();

/**
 * Junction (Windows) / dir symlink: full `scripts/` tree (legacy dev path for ts-node CLIs).
 * Runtime inject 主路径使用 `@bmad-speckit/runtime-emit/dist/resolve-for-session.cjs`，验收测试默认不再依赖此项。
 */
export function linkRepoScriptsIntoProject(projectRoot: string): void {
  const src = path.join(REPO_ROOT, 'scripts');
  const dest = path.join(projectRoot, 'scripts');
  if (fs.existsSync(dest)) {
    fs.rmSync(dest, { recursive: true, force: true });
  }
  if (process.platform === 'win32') {
    fs.symlinkSync(src, dest, 'junction');
  } else {
    fs.symlinkSync(src, dest, 'dir');
  }
}

export function linkRepoBmadRuntimeHooksIntoClaudeProject(projectRoot: string): void {
  const src = path.join(REPO_ROOT, '_bmad', 'runtime', 'hooks');
  const dest = path.join(projectRoot, '.claude', 'hooks');
  fs.mkdirSync(dest, { recursive: true });
  for (const name of fs.readdirSync(src)) {
    const s = path.join(src, name);
    const d = path.join(dest, name);
    if (fs.statSync(s).isDirectory()) {
      continue;
    }
    fs.copyFileSync(s, d);
  }
}

export function linkRepoTsconfigIntoProject(projectRoot: string): void {
  for (const fileName of ['tsconfig.json', 'tsconfig.node.json']) {
    const src = path.join(REPO_ROOT, fileName);
    const dest = path.join(projectRoot, fileName);
    if (!fs.existsSync(src)) {
      continue;
    }
    if (fs.existsSync(dest)) {
      fs.rmSync(dest, { force: true });
    }
    fs.copyFileSync(src, dest);
  }
}

export function linkRepoNodeModulesIntoProject(projectRoot: string): void {
  const src = path.join(REPO_ROOT, 'node_modules');
  const dest = path.join(projectRoot, 'node_modules');
  if (fs.existsSync(dest)) {
    return;
  }
  if (process.platform === 'win32') {
    fs.symlinkSync(src, dest, 'junction');
  } else {
    fs.symlinkSync(src, dest, 'dir');
  }
}
import { defaultRuntimeContextFile, writeRuntimeContext } from '../../scripts/runtime-context';
import {
  defaultRuntimeContextRegistry,
  writeRuntimeContextRegistry,
  type RuntimeContextRegistry,
  type ReviewerLatestCloseoutRecord,
} from '../../scripts/runtime-context-registry';
import type { RuntimeFlowId } from '../../scripts/runtime-governance';
import type { StageName } from '../../scripts/bmad-config';
import type { ImplementationEntryGate } from '../../scripts/runtime-governance';

export interface MinimalRegistryOpts {
  flow?: RuntimeFlowId;
  stage?: StageName;
  templateId?: string;
  epicId?: string;
  storyId?: string;
  storySlug?: string;
  runId?: string;
  artifactRoot?: string;
  artifactPath?: string;
  sourceMode?: 'full_bmad' | 'seeded_solutioning' | 'standalone_story';
  implementationEntryGate?: ImplementationEntryGate;
  latestReviewerCloseout?: ReviewerLatestCloseoutRecord;
  preserveMissingRunId?: boolean;
  confirmedSource?: boolean;
  currentMentalModel?: string;
  sixModelResults?: Record<string, unknown>;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  return `{${Object.keys(value)
    .sort()
    .map(
      (key) =>
        `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`
    )
    .join(',')}}`;
}

function sha256Text(value: string): string {
  return `sha256:${createHash('sha256').update(value, 'utf8').digest('hex')}`;
}

function sha256File(filePath: string): string {
  return `sha256:${createHash('sha256').update(fs.readFileSync(filePath)).digest('hex')}`;
}

function extractImplementationConfirmationBlock(sourceText: string): string {
  const lines = sourceText.replace(/\r\n/gu, '\n').split('\n');
  const start = lines.findIndex((line) => /^implementationConfirmation:\s*$/u.test(line));
  if (start < 0) throw new Error('Fixture source is missing implementationConfirmation block');

  let end = lines.length;
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.trim() === '') continue;
    if (/^\S/u.test(line)) {
      end = index;
      break;
    }
  }
  return lines.slice(start, end).join('\n');
}

export function buildSixModelResultsForImplementationReady(): Record<string, unknown> {
  return {
    requirement_confirmation: {
      model: 'requirement_confirmation',
      status: 'pass',
      blockingReasons: [],
    },
    architecture_confirmation: {
      model: 'architecture_confirmation',
      status: 'pass',
      blockingReasons: [],
    },
    implementation_readiness: {
      model: 'implementation_readiness',
      status: 'pass',
      blockingReasons: [],
    },
    execution_closure: {
      model: 'execution_closure',
      status: 'not_established',
      blockingReasons: ['execution_closure_not_established'],
    },
    audit_review: {
      model: 'audit_review',
      status: 'not_established',
      blockingReasons: ['audit_review_not_established'],
    },
    delivery_confirmation: {
      model: 'delivery_confirmation',
      status: 'not_established',
      blockingReasons: ['delivery_confirmation_not_established'],
    },
  };
}

export function buildSixModelResultsForAuditReady(): Record<string, unknown> {
  return {
    ...buildSixModelResultsForImplementationReady(),
    execution_closure: {
      model: 'execution_closure',
      status: 'pass',
      blockingReasons: [],
    },
    audit_review: {
      model: 'audit_review',
      status: 'pass',
      blockingReasons: [],
    },
  };
}

function buildConfirmedSourceFixture(input: {
  root: string;
  recordRoot: string;
  recordId: string;
  requirementSetId: string;
  flow: RuntimeFlowId;
  stage: string;
  sourcePathValue: string;
}): {
  sourceDocumentHash: string;
  implementationConfirmationHash: string;
  confirmationPageHash: string;
  confirmationHistory: Record<string, unknown>[];
} {
  const sourcePath = path.resolve(input.root, input.sourcePathValue);
  const semanticConfirmation = {
    recordId: input.recordId,
    requirementSetId: input.requirementSetId,
    flow: input.flow,
    stage: input.stage,
    must: [{ id: 'MUST-001', statement: 'Exercise the main-agent dispatch path.' }],
    evidence: [{ id: 'EVD-001', gate: 'npm test' }],
    traceRows: [{ id: 'TRACE-001', covers: ['MUST-001'], evidenceRefs: ['EVD-001'] }],
    requiredCommands: [{ id: 'CMD-001', command: 'npm test', traceRows: ['TRACE-001'] }],
    closeoutReadinessPreview: { requiredCommands: ['CMD-001'] },
  };
  const implementationBlock = [
    'implementationConfirmation:',
    '  status: user_confirmed',
    `  recordId: ${input.recordId}`,
    `  requirementSetId: ${input.requirementSetId}`,
    `  flow: ${input.flow}`,
    `  stage: ${input.stage}`,
    '  must:',
    '    - id: MUST-001',
    '      statement: Exercise the main-agent dispatch path.',
    '  evidence:',
    '    - id: EVD-001',
    '      gate: npm test',
    '  traceRows:',
    '    - id: TRACE-001',
    '      covers: [MUST-001]',
    '      evidenceRefs: [EVD-001]',
    '  requiredCommands:',
    '    - id: CMD-001',
    '      command: npm test',
    '      traceRows: [TRACE-001]',
    '  closeoutReadinessPreview:',
    '    requiredCommands: [CMD-001]',
  ].join('\n');
  const sourceText = [
    `# ${input.recordId}`,
    '',
    'Fixture source for main-agent execution path acceptance tests.',
    '',
    implementationBlock,
    '',
  ].join('\n');
  fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
  fs.writeFileSync(sourcePath, sourceText, 'utf8');

  const implementationConfirmationHash = sha256Text(stableStringify(semanticConfirmation));
  const extractedImplementationBlock = extractImplementationConfirmationBlock(sourceText);
  const sourceDocumentHash = sha256Text(
    sourceText.replace(
      extractedImplementationBlock,
      `implementationConfirmation:${stableStringify(semanticConfirmation)}`
    )
  );
  const confirmationPagePath = path.join(input.recordRoot, 'confirmation', 'confirmation.html');
  const confirmationRenderReportPath = path.join(
    input.recordRoot,
    'confirmation',
    'confirmation-render-report.json'
  );
  fs.mkdirSync(path.dirname(confirmationPagePath), { recursive: true });
  fs.writeFileSync(
    confirmationPagePath,
    `<html><body>${input.recordId}:${sourceDocumentHash}:${implementationConfirmationHash}</body></html>\n`,
    'utf8'
  );
  fs.writeFileSync(
    confirmationRenderReportPath,
    `${JSON.stringify(
      {
        schemaVersion: 'test-confirmation-render-report/v1',
        recordId: input.recordId,
        requirementSetId: input.requirementSetId,
        sourceDocumentHash,
        implementationConfirmationHash,
      },
      null,
      2
    )}\n`,
    'utf8'
  );
  const confirmationPageHash = sha256File(confirmationPagePath);
  return {
    sourceDocumentHash,
    implementationConfirmationHash,
    confirmationPageHash,
    confirmationHistory: [
      {
        eventType: 'confirmation_recorded',
        recordId: input.recordId,
        requirementSetId: input.requirementSetId,
        confirmedAt: '2026-05-19T00:00:00.000Z',
        confirmedBy: 'test-fixture',
        sourcePath: path.relative(input.root, sourcePath).replace(/\\/g, '/'),
        sourceDocumentHash,
        implementationConfirmationHash,
        confirmationPageHash,
        confirmationText: 'confirmed fixture requirement source for main-agent lifecycle tests',
        renderReportPath: path
          .relative(input.root, confirmationRenderReportPath)
          .replace(/\\/g, '/'),
        htmlPath: path.relative(input.root, confirmationPagePath).replace(/\\/g, '/'),
      },
    ],
  };
}

export function writeMinimalRequirementRecordContext(
  root: string,
  opts: MinimalRegistryOpts = {}
): string {
  const flow = opts.flow ?? 'story';
  const stage = opts.stage ?? 'specify';
  const runId = opts.runId ?? (opts.preserveMissingRunId ? undefined : `run-${flow}-${stage}`);
  const identitySegment = runId ?? `${flow}-${stage}`;
  const requirementSetId = `REQSET-${identitySegment}`.replace(/[^a-zA-Z0-9._-]+/g, '-');
  const recordId = `REQ-${identitySegment}`.replace(/[^a-zA-Z0-9._-]+/g, '-');
  const recordRoot = path.join(
    root,
    '_bmad-output',
    'runtime',
    'requirement-records',
    requirementSetId
  );
  const recordPath = path.join(recordRoot, 'requirement-record.json');
  const recoveryRoot = path.join(recordRoot, 'recovery');
  const runtimePolicySnapshotPath = path.join(recoveryRoot, 'runtime-policy-snapshot.json');
  const recoveryContextPath = path.join(recoveryRoot, 'recovery-context.json');
  fs.mkdirSync(recoveryRoot, { recursive: true });
  fs.writeFileSync(runtimePolicySnapshotPath, '{"kind":"runtime-policy-snapshot"}\n', 'utf8');
  fs.writeFileSync(recoveryContextPath, '{"kind":"recovery-context"}\n', 'utf8');
  const sourcePathValue = opts.artifactPath ?? opts.artifactRoot ?? 'docs/requirements.md';
  const confirmedSource = opts.confirmedSource
    ? buildConfirmedSourceFixture({
        root,
        recordRoot,
        recordId,
        requirementSetId,
        flow,
        stage,
        sourcePathValue,
      })
    : null;

  const record = {
    recordId,
    requirementSetId,
    status: 'user_confirmed',
    flow,
    stage,
    updatedAt: '2026-05-19T00:00:00.000Z',
    entryFlow: flow,
    sourceMode: opts.sourceMode ?? 'full_bmad',
    templateId: opts.templateId,
    epicId: opts.epicId,
    storyId: opts.storyId,
    storySlug: opts.storySlug,
    ...(runId ? { runId } : {}),
    architectureConfirmationState: {
      status: 'active',
      currentArchitectureConfirmationRunId: `arch-${runId}`,
      currentArchitectureConfirmationHash:
        'sha256:4444444444444444444444444444444444444444444444444444444444444444',
      currentArchitectureConfirmationPath: path
        .relative(
          recordRoot,
          path.join(recordRoot, 'architecture', `architecture-confirmation-${runId}.json`)
        )
        .replace(/\\/g, '/'),
      resolvedRecipeHash: 'sha256:5555555555555555555555555555555555555555555555555555555555555555',
      lastEventType: 'architecture_confirmation_recorded',
      updatedAt: '2026-05-19T00:00:00.000Z',
    },
    artifactRoot: opts.artifactRoot,
    artifactPath: opts.artifactPath ?? opts.artifactRoot,
    sourcePath: sourcePathValue,
    sourceDocumentHash:
      confirmedSource?.sourceDocumentHash ??
      'sha256:1111111111111111111111111111111111111111111111111111111111111111',
    implementationConfirmationHash:
      confirmedSource?.implementationConfirmationHash ??
      'sha256:2222222222222222222222222222222222222222222222222222222222222222',
    confirmationPageHash:
      confirmedSource?.confirmationPageHash ??
      'sha256:3333333333333333333333333333333333333333333333333333333333333333',
    ...(confirmedSource ? { confirmationHistory: confirmedSource.confirmationHistory } : {}),
    ...(opts.currentMentalModel ? { currentMentalModel: opts.currentMentalModel } : {}),
    ...(opts.sixModelResults ? { sixModelResults: opts.sixModelResults } : {}),
    implementationEntryGate: opts.implementationEntryGate ?? {
      gateName: 'implementation-readiness',
      requestedFlow: flow === 'bugfix' || flow === 'standalone_tasks' ? flow : 'story',
      recommendedFlow: flow === 'bugfix' || flow === 'standalone_tasks' ? flow : 'story',
      decision: 'block',
      readinessStatus: 'missing',
      blockerCodes: ['missing_readiness_evidence'],
      blockerSummary: ['缺少 implementation-readiness 所需证据'],
      rerouteRequired: false,
      rerouteReason: null,
      evidenceSources: {
        readinessReportPath: null,
        remediationArtifactPath: null,
        executionRecordPath: null,
        authoritativeAuditReportPath: null,
      },
      semanticFingerprint: opts.artifactPath ?? opts.artifactRoot ?? 'docs/requirements.md',
      evaluatedAt: '2026-05-19T00:00:00.000Z',
    },
    runtimePolicySnapshotRef: {
      path: path.relative(root, runtimePolicySnapshotPath).replace(/\\/g, '/'),
      contentHash: sha256File(runtimePolicySnapshotPath),
      artifactType: 'runtime_policy_snapshot',
      sourceOfTruthRole: 'projection',
      producer: 'tests/helpers/runtime-registry-fixture',
      purpose: 'runtime policy snapshot for main-agent acceptance fixture',
      relatedRequirementIds: [recordId],
      status: 'active',
      inputVersion: 'runtime-policy-snapshot/v1',
      outputVersion: 'runtime-policy-snapshot/v1',
    },
    recoveryContextRef: {
      path: path.relative(root, recoveryContextPath).replace(/\\/g, '/'),
    },
    controlStore: {
      executionIterations: [],
    },
    ...(opts.latestReviewerCloseout ? { latestReviewerCloseout: opts.latestReviewerCloseout } : {}),
  };
  fs.writeFileSync(recordPath, JSON.stringify(record, null, 2) + '\n', 'utf8');

  const indexPath = path.join(root, '_bmad-output', 'runtime', 'requirement-records', 'index.json');
  fs.mkdirSync(path.dirname(indexPath), { recursive: true });
  fs.writeFileSync(
    indexPath,
    JSON.stringify(
      {
        version: 1,
        active: {
          recordId,
          requirementSetId,
          ...(runId ? { runId } : {}),
        },
        records: [
          {
            recordId,
            requirementSetId,
            ...(runId ? { runId } : {}),
            recordPath: path.relative(root, recordPath).replace(/\\/g, '/'),
          },
        ],
      },
      null,
      2
    ) + '\n',
    'utf8'
  );
  return recordPath;
}

export function buildPassImplementationEntryGate(
  opts: Pick<MinimalRegistryOpts, 'flow' | 'artifactPath' | 'artifactRoot'> = {}
): ImplementationEntryGate {
  const flow = opts.flow === 'bugfix' || opts.flow === 'standalone_tasks' ? opts.flow : 'story';
  const semanticFingerprint = opts.artifactPath ?? opts.artifactRoot ?? 'docs/requirements.md';
  return {
    gateName: 'implementation-readiness',
    requestedFlow: flow,
    recommendedFlow: flow,
    decision: 'pass',
    readinessStatus: 'ready_clean',
    blockerCodes: [],
    blockerSummary: [],
    rerouteRequired: false,
    rerouteReason: null,
    evidenceSources: {
      readinessReportPath: null,
      remediationArtifactPath: null,
      executionRecordPath: null,
      authoritativeAuditReportPath: null,
    },
    semanticFingerprint,
    evaluatedAt: '2026-05-19T00:00:00.000Z',
  };
}

/** Write `_bmad-output/runtime/registry.json` + `context/project.json` under root. */
export function writeMinimalRegistryAndProjectContext(
  root: string,
  opts: MinimalRegistryOpts = {}
): void {
  const flow = opts.flow ?? 'story';
  const stage = opts.stage ?? 'specify';
  const ctx = defaultRuntimeContextFile({
    flow,
    stage,
    templateId: opts.templateId,
    epicId: opts.epicId,
    storyId: opts.storyId,
    storySlug: opts.storySlug,
    runId: opts.runId,
    artifactRoot: opts.artifactRoot,
    ...(opts.latestReviewerCloseout ? { latestReviewerCloseout: opts.latestReviewerCloseout } : {}),
    contextScope: 'project',
  });
  const dir = path.join(root, '_bmad-output', 'runtime', 'context');
  fs.mkdirSync(dir, { recursive: true });
  writeRuntimeContext(root, ctx);

  const registry: RuntimeContextRegistry = defaultRuntimeContextRegistry(root);
  registry.activeScope = {
    scopeType: 'project',
    resolvedContextPath: path.join('_bmad-output', 'runtime', 'context', 'project.json'),
    reason: 'test fixture',
  };
  registry.latestReviewerCloseout = opts.latestReviewerCloseout ?? null;
  writeRuntimeContextRegistry(root, registry);
  writeMinimalRequirementRecordContext(root, {
    ...opts,
    preserveMissingRunId:
      opts.preserveMissingRunId ??
      (opts.runId === undefined && flow === 'story' && stage === 'implement' && !opts.storyId),
  });
}
