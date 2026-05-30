/**
 * Test helpers: minimal registry + project context so `emit-runtime-policy` needs no env vars.
 */
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
  fs.mkdirSync(recoveryRoot, { recursive: true });
  fs.writeFileSync(
    path.join(recoveryRoot, 'runtime-policy-snapshot.json'),
    '{"kind":"runtime-policy-snapshot"}\n',
    'utf8'
  );
  fs.writeFileSync(
    path.join(recoveryRoot, 'recovery-context.json'),
    '{"kind":"recovery-context"}\n',
    'utf8'
  );

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
    sourcePath: opts.artifactPath ?? opts.artifactRoot ?? 'docs/requirements.md',
    sourceDocumentHash: 'sha256:1111111111111111111111111111111111111111111111111111111111111111',
    implementationConfirmationHash:
      'sha256:2222222222222222222222222222222222222222222222222222222222222222',
    confirmationPageHash: 'sha256:3333333333333333333333333333333333333333333333333333333333333333',
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
      path: path
        .relative(root, path.join(recoveryRoot, 'runtime-policy-snapshot.json'))
        .replace(/\\/g, '/'),
    },
    recoveryContextRef: {
      path: path
        .relative(root, path.join(recoveryRoot, 'recovery-context.json'))
        .replace(/\\/g, '/'),
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
