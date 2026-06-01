/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');
const { applyLimit, resolveDisplayBudget } = require('./ai-tdd/display-budget');
const { resolveAiTddRuntimeDecision } = require('./ai-tdd/runtime-decision');

const QUICK_START_MESSAGE =
  '当前项目尚未创建需求契约。BMAD 不会把初始化占位状态当作真实需求。请先创建或导入一个可确认的需求源文档。';

const QUICK_START_ENTRIES = [
  '创建产品/功能需求契约',
  '创建 Bugfix 需求契约',
  '创建独立任务契约',
  '导入已有需求文档',
  '查看当前阻塞原因',
];

function parseArgs(argv) {
  const options = { projectRoot: process.cwd() };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--cwd') options.projectRoot = argv[++index] || options.projectRoot;
    else if (arg.startsWith('--cwd=')) options.projectRoot = arg.slice('--cwd='.length);
    else if (arg === '--json') options.json = true;
    else if (arg === '--budget') options.budget = argv[++index];
    else if (arg.startsWith('--budget=')) options.budget = arg.slice('--budget='.length);
  }
  if (process.env.npm_config_json === 'true') options.json = true;
  return options;
}

function packageAssetRoot() {
  return path.resolve(__dirname, '..', '..');
}

function repoAssetRoot() {
  return path.resolve(__dirname, '..', '..', '..', '..');
}

function hasBmadAssets(assetRoot) {
  return fs.existsSync(path.join(assetRoot, '_bmad', '_config', 'bmads-runtime.yaml'));
}

function resolveBmadAssetRoot(projectRoot, explicitAssetRoot) {
  const candidates = [
    explicitAssetRoot,
    projectRoot,
    packageAssetRoot(),
    repoAssetRoot(),
  ].filter(Boolean);
  for (const candidate of candidates) {
    const resolved = path.resolve(candidate);
    if (hasBmadAssets(resolved)) return resolved;
  }
  return path.resolve(explicitAssetRoot || projectRoot || packageAssetRoot());
}

function loadRuntimeContract(assetRoot) {
  const contractPath = path.join(assetRoot, '_bmad', '_config', 'bmads-runtime.yaml');
  const parsed = yaml.load(fs.readFileSync(contractPath, 'utf8'));
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('bmads-runtime.yaml must be a YAML object');
  }
  return parsed;
}

function existsRelative(projectRoot, relativePath) {
  return fs.existsSync(path.join(projectRoot, relativePath));
}

function toProjectRelative(projectRoot, filePath) {
  return path.relative(projectRoot, filePath).replace(/\\/g, '/');
}

function collectFilesRecursive(root) {
  if (!fs.existsSync(root)) return [];
  const files = [];
  const visit = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const entryPath = path.join(dir, entry.name);
      if (entry.isDirectory()) visit(entryPath);
      else files.push(entryPath);
    }
  };
  visit(root);
  return files;
}

function artifactRecord(projectRoot, filePath) {
  const stat = fs.statSync(filePath);
  return {
    path: toProjectRelative(projectRoot, filePath),
    bytes: stat.size,
    updatedAt: stat.mtime.toISOString(),
  };
}

function collectUpstreamArtifacts(projectRoot) {
  const planningRoot = path.join(projectRoot, '_bmad-output', 'planning-artifacts');
  const files = collectFilesRecursive(planningRoot);
  const byName = (predicate) =>
    files
      .filter((filePath) => predicate(path.basename(filePath).toLowerCase()))
      .map((filePath) => artifactRecord(projectRoot, filePath))
      .sort((left, right) => left.path.localeCompare(right.path));
  return {
    productBriefs: byName(
      (name) => /^product-brief.*\.md$/u.test(name) || /^brief.*\.md$/u.test(name)
    ),
    prds: byName((name) => name === 'prd.md' || /^prd[._-].*\.md$/u.test(name)),
    architectures: byName(
      (name) => name === 'architecture.md' || /^arch(?:itecture)?[._-].*\.md$/u.test(name)
    ),
    epics: byName((name) => name === 'epics.md' || /^epics[._-].*\.md$/u.test(name)),
  };
}

function findLatestReadinessReport(projectRoot) {
  const roots = [
    path.join(projectRoot, '_bmad-output', 'planning-artifacts'),
    path.join(projectRoot, '_bmad-output', 'implementation-artifacts'),
  ];
  const matches = [];
  const visit = (dir) => {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const entryPath = path.join(dir, entry.name);
      if (entry.isDirectory()) visit(entryPath);
      else if (/implementation-readiness-report-\d{4}-\d{2}-\d{2}\.md$/iu.test(entry.name)) {
        matches.push({ filePath: entryPath, mtimeMs: fs.statSync(entryPath).mtimeMs });
      }
    }
  };
  for (const root of roots) visit(root);
  matches.sort((left, right) => right.mtimeMs - left.mtimeMs);
  return matches[0]?.filePath || null;
}

function resolveReadinessStatus(projectRoot) {
  const reportPath = findLatestReadinessReport(projectRoot);
  if (!reportPath) {
    return {
      status: 'missing',
      reportPath: null,
      reason: 'No implementation-readiness report was found.',
    };
  }
  const content = fs.readFileSync(reportPath, 'utf8');
  const hasReadyConclusion =
    /\bREADY\b/iu.test(content) ||
    /ready_clean/iu.test(content) ||
    /repair_closed/iu.test(content) ||
    /Overall Readiness Status\s*\n+\s*\*\*READY\*\*/iu.test(content);
  if (!hasReadyConclusion) {
    return {
      status: 'missing',
      reportPath: toProjectRelative(projectRoot, reportPath),
      reason:
        'Latest implementation-readiness report does not state READY / ready_clean / repair_closed.',
    };
  }
  const runtimeContextPath = path.join(
    projectRoot,
    '_bmad-output',
    'runtime',
    'context',
    'project.json'
  );
  if (
    fs.existsSync(runtimeContextPath) &&
    fs.statSync(reportPath).mtimeMs < fs.statSync(runtimeContextPath).mtimeMs
  ) {
    return {
      status: 'stale',
      reportPath: toProjectRelative(projectRoot, reportPath),
      reason: 'Latest implementation-readiness report is older than the active runtime context.',
    };
  }
  return {
    status: 'ready',
    reportPath: toProjectRelative(projectRoot, reportPath),
    reason: 'Latest implementation-readiness report states READY / ready_clean / repair_closed.',
  };
}

function readJson(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function outputRootForLayer(layerId) {
  switch (layerId) {
    case 'layer_1':
      return '_bmad-output/runtime/context';
    case 'layer_2':
      return 'docs/architecture';
    case 'layer_3':
      return 'docs/stories';
    case 'layer_4':
      return 'specs';
    case 'layer_5':
      return '_bmad-output/runtime/gates';
    default:
      return '_bmad-output/runtime/context';
  }
}

function loadLayerDefinitions(assetRoot) {
  const mappingPath = path.join(assetRoot, '_bmad', '_config', 'stage-mapping.yaml');
  const parsed = yaml.load(fs.readFileSync(mappingPath, 'utf8')) || {};
  const rawLayers = parsed.layer_to_stages || {};
  return ['layer_1', 'layer_2', 'layer_3', 'layer_4', 'layer_5'].map((id) => {
    const stages = rawLayers[id]?.stages || [];
    const executableStages = Array.from(
      new Set(
        stages.map((stage) =>
          stage === 'story' ? 'story_create' : stage === 'post_impl' ? 'post_audit' : stage
        )
      )
    );
    return {
      id,
      name: rawLayers[id]?.name || id,
      stages: executableStages,
      outputRoot: outputRootForLayer(id),
    };
  });
}

function stageEvidencePath(projectRoot, layer, stage) {
  return path.join(projectRoot, layer.outputRoot, `${layer.id}-${stage}.complete.json`);
}

function exactStageEvidenceNames(stage) {
  const normalized = String(stage).toLowerCase();
  const dashed = normalized.replace(/_/gu, '-');
  const names = new Set([
    `${normalized}.json`,
    `${normalized}.md`,
    `${dashed}.json`,
    `${dashed}.md`,
  ]);
  if (stage === 'arch') {
    for (const item of ['architecture.md', 'architecture.json', 'arch.md', 'arch.json']) {
      names.add(item);
    }
  }
  if (stage === 'epics') {
    names.add('epics.md');
    names.add('epics.json');
  }
  if (stage === 'story_create') {
    names.add('story-create.md');
    names.add('story-create.json');
  }
  if (stage === 'post_audit') {
    names.add('post-audit.md');
    names.add('post-audit.json');
  }
  return names;
}

function hasUpstreamPlanningArtifact(projectRoot, fileNames) {
  const planningRoot = path.join(projectRoot, '_bmad-output', 'planning-artifacts');
  if (!fs.existsSync(planningRoot)) return false;
  const names = new Set(fileNames.map((item) => item.toLowerCase()));
  const stack = [planningRoot];
  while (stack.length > 0) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const absolutePath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(absolutePath);
      } else if (names.has(entry.name.toLowerCase())) {
        return true;
      }
    }
  }
  return false;
}

function gateReportPassed(filePath, predicate) {
  if (!fs.existsSync(filePath)) return false;
  try {
    return predicate(JSON.parse(fs.readFileSync(filePath, 'utf8')));
  } catch {
    return false;
  }
}

function resolveStageEvidence(projectRoot, layer, stage) {
  const root = path.join(projectRoot, layer.outputRoot);
  if (stage === 'release_gate') {
    const completed =
      fs.existsSync(root) &&
      gateReportPassed(
        path.join(root, 'main-agent-release-gate-report.json'),
        (value) => value.critical_failures === 0 && value.blocked_sprint_status_update === false
      );
    return { completed, evidenceKind: completed ? 'gate_report' : 'missing' };
  }
  if (stage === 'delivery_truth_gate') {
    const completed =
      fs.existsSync(root) &&
      gateReportPassed(
        path.join(root, 'main-agent-delivery-truth-gate-report.json'),
        (value) => value.completionAllowed === true
      );
    return { completed, evidenceKind: completed ? 'gate_report' : 'missing' };
  }
  const explicitStageMarker = stageEvidencePath(projectRoot, layer, stage);
  if (fs.existsSync(explicitStageMarker)) {
    return { completed: true, evidenceKind: 'strict_marker' };
  }
  if (layer.id === 'layer_1' && stage === 'prd') {
    const upstreamPrdComplete = hasUpstreamPlanningArtifact(projectRoot, ['prd.md']);
    return {
      completed: upstreamPrdComplete,
      evidenceKind: upstreamPrdComplete ? 'upstream_artifact' : 'missing',
    };
  }
  if (!fs.existsSync(root)) {
    if (layer.id === 'layer_2' && stage === 'arch') {
      const completed = hasUpstreamPlanningArtifact(projectRoot, ['architecture.md']);
      return { completed, evidenceKind: completed ? 'upstream_artifact' : 'missing' };
    }
    if (layer.id === 'layer_3' && stage === 'epics') {
      const completed = hasUpstreamPlanningArtifact(projectRoot, ['epics.md']);
      return { completed, evidenceKind: completed ? 'upstream_artifact' : 'missing' };
    }
    return { completed: false, evidenceKind: 'missing' };
  }
  const exactNames = exactStageEvidenceNames(stage);
  const completed = fs
    .readdirSync(root, { withFileTypes: true })
    .some((entry) => exactNames.has(entry.name.toLowerCase()));
  if (completed) return { completed: true, evidenceKind: 'strict_marker' };
  if (layer.id === 'layer_2' && stage === 'arch') {
    const upstreamComplete = hasUpstreamPlanningArtifact(projectRoot, ['architecture.md']);
    return {
      completed: upstreamComplete,
      evidenceKind: upstreamComplete ? 'upstream_artifact' : 'missing',
    };
  }
  if (layer.id === 'layer_3' && stage === 'epics') {
    const upstreamComplete = hasUpstreamPlanningArtifact(projectRoot, ['epics.md']);
    return {
      completed: upstreamComplete,
      evidenceKind: upstreamComplete ? 'upstream_artifact' : 'missing',
    };
  }
  return { completed: false, evidenceKind: 'missing' };
}

function resolveBmadHelpFiveLayerProgressState(input) {
  const projectRoot = path.resolve(input.projectRoot);
  const assetRoot = path.resolve(input.assetRoot || projectRoot);
  const layers = loadLayerDefinitions(assetRoot);
  const stageStatuses = layers.flatMap((layer) =>
    layer.stages.map((stage) => {
      const evidence = resolveStageEvidence(projectRoot, layer, stage);
      return {
        layer: layer.id,
        stage,
        completed: evidence.completed,
        evidenceKind: evidence.evidenceKind,
        evidencePath: stageEvidencePath(projectRoot, layer, stage),
      };
    })
  );
  const firstIncomplete = stageStatuses.find((item) => !item.completed) || stageStatuses.at(-1);
  if (!firstIncomplete) {
    throw new Error('bmad-help five-layer mapping has no executable stages');
  }
  const completedLayers = layers
    .filter(
      (layer) =>
        layer.stages.length > 0 &&
        layer.stages.every((stage) =>
          stageStatuses.some(
            (item) => item.layer === layer.id && item.stage === stage && item.completed
          )
        )
    )
    .map((layer) => layer.id);
  return {
    currentLayer: firstIncomplete.layer,
    currentStage: firstIncomplete.stage,
    nextRequiredLayer: firstIncomplete.layer,
    completedLayers,
    stageStatuses,
  };
}

function buildNoActiveRequirementSurface() {
  return {
    source: 'no_active_requirement',
    nextAction: 'contract_authoring_required',
    ready: false,
    pendingPacketStatus: 'none',
    sessionId: null,
    stageSummary: {
      currentMentalModelStatus: 'context_intake_blocked',
      userFacingMessage: QUICK_START_MESSAGE,
      blockingReasons: ['no_active_requirement', 'contract_authoring_required'],
    },
  };
}

function resolveMainAgentOrchestrationSurface(projectRoot) {
  const requirementIndex = readJson(
    path.join(projectRoot, '_bmad-output', 'runtime', 'requirement-records', 'index.json')
  );
  const hasActiveRequirement =
    Boolean(requirementIndex?.activeRequirementSetId) ||
    Boolean(requirementIndex?.activeRecordId) ||
    Boolean(requirementIndex?.currentRequirementSetId);
  if (!hasActiveRequirement) return buildNoActiveRequirementSurface();
  return {
    source: 'requirement_record',
    nextAction: 'inspect_requirement_record',
    ready: true,
    pendingPacketStatus: 'none',
    sessionId: String(
      requirementIndex.activeRequirementSetId ||
        requirementIndex.activeRecordId ||
        requirementIndex.currentRequirementSetId
    ),
    stageSummary: {
      currentMentalModelStatus: 'requirement_record_available',
      userFacingMessage: 'Active requirement record is available. Inspect the current record for next action.',
      blockingReasons: [],
    },
  };
}

function filterRecommendedWorkflows(input) {
  if (input.currentStage !== 'story_create') return input.workflows;
  if (input.readiness.status === 'ready') return input.workflows;
  return input.workflows.filter((workflow) => workflow !== 'bmad-story-assistant');
}

function buildBmadsOutput(projectRootInput = process.cwd(), buildOptions = {}) {
  const projectRoot =
    typeof projectRootInput === 'object'
      ? path.resolve(projectRootInput.projectRoot || process.cwd())
      : path.resolve(projectRootInput);
  const options = typeof projectRootInput === 'object' ? projectRootInput : buildOptions;
  const assetRoot = resolveBmadAssetRoot(projectRoot, options.assetRoot);
  const runtime = loadRuntimeContract(assetRoot);
  const progress = resolveBmadHelpFiveLayerProgressState({ projectRoot, assetRoot });
  const orchestration = resolveMainAgentOrchestrationSurface(projectRoot);
  const readiness = resolveReadinessStatus(projectRoot);
  const artifacts = collectUpstreamArtifacts(projectRoot);
  const aiTdd = resolveAiTddRuntimeDecision(projectRoot, {
    assetRoot,
    displayBudget: options.budget,
  });
  const displayBudget = resolveDisplayBudget(options.budget, 'route');
  const currentRoute = runtime.layers
    .flatMap((layer) => layer.stages.map((stage) => ({ layer, stage })))
    .find(
      (item) => item.layer.id === progress.currentLayer && item.stage.id === progress.currentStage
    );
  const contractStatus = {
    governance: existsRelative(projectRoot, runtime.contracts.governance),
    dispatch: existsRelative(projectRoot, runtime.contracts.dispatch),
    stageMapping: existsRelative(projectRoot, runtime.contracts.stageMapping),
  };
  return {
    console: 'BMADS Runtime Console',
    viewMode: aiTdd.viewMode,
    projectRoot,
    assetRoot,
    schemaVersion: runtime.schemaVersion,
    entry: runtime.entry,
    contracts: runtime.contracts,
    contractStatus,
    artifacts,
    progress,
    currentRoute: currentRoute
      ? {
          layer: currentRoute.layer.id,
          layerName: currentRoute.layer.name,
          stage: currentRoute.stage.id,
          governanceStage: currentRoute.stage.governanceStage,
          requiredGovernanceSignalsFrom: currentRoute.stage.requiredGovernanceSignalsFrom,
          recommendedWorkflows: filterRecommendedWorkflows({
            currentStage: progress.currentStage,
            workflows: currentRoute.stage.recommendedWorkflows || [],
            readiness,
          }),
          blockedWorkflows:
            progress.currentStage === 'story_create' && readiness.status !== 'ready'
              ? [
                  {
                    workflow: 'bmad-story-assistant',
                    reason:
                      'implementation-readiness must be READY / ready_clean / repair_closed before story development.',
                  },
                ]
              : [],
          dispatch: currentRoute.stage.dispatch || null,
          gates: currentRoute.stage.gates || null,
          next: currentRoute.stage.next || null,
        }
      : null,
    readiness,
    orchestration: {
      source: orchestration.source,
      nextAction: orchestration.nextAction,
      ready: orchestration.ready,
      pendingPacketStatus: orchestration.pendingPacketStatus,
      sessionId: orchestration.sessionId,
      stageSummary: orchestration.stageSummary,
    },
    quickStart:
      orchestration.source === 'no_active_requirement'
        ? {
            status: 'no_active_requirement',
            nextRequiredAction: 'contract_authoring_required',
            message: QUICK_START_MESSAGE,
            entries: QUICK_START_ENTRIES,
          }
        : null,
    advisory: runtime.entry.advisory,
    aiTdd,
    displayBudget,
    commandHints: [
      'bmads',
      'bmad-speckit bmads',
      'bmad-speckit bmad-help',
      'bmad-speckit confirm-scope',
      'bmad-speckit main-agent:confirm-scope',
      'bmad-speckit main-agent-orchestration --action inspect',
      'bmad-speckit main-agent-orchestration --action confirm-scope',
      'bmad-speckit main-agent-orchestration --action dispatch-plan --host codex',
      'bmad-speckit main-agent:release-gate',
      'bmad-speckit main-agent:delivery-truth-gate',
    ],
  };
}

function renderArtifactGroup(label, artifacts) {
  if (artifacts.length === 0) return [`${label}: missing`];
  return [
    `${label}:`,
    ...artifacts.map((item) => `- ${item.path} (${item.bytes} bytes, updated ${item.updatedAt})`),
  ];
}

function renderAiTddActiveRecord(record, isPrimary, budget) {
  const lines = [
    `- recordId: ${record.recordId}${isPrimary ? ' (primary)' : ''}`,
    `  source/title: ${record.sourceOrTitle}`,
    `  current mental model: ${record.currentMentalModel}`,
    `  schema model status: ${record.schemaModelStatus}`,
    `  display state: ${record.displayState}`,
    `  blocker summary: ${record.blockerSummary}`,
    `  next safe action: ${record.nextSafeAction}`,
    `  updatedAt/current: ${record.updatedAt}`,
  ];
  if (record.currentAttemptId) lines.push(`  current attempt/hash: ${record.currentAttemptId}`);
  else if (record.sourceDocumentHash) lines.push(`  current attempt/hash: ${record.sourceDocumentHash}`);
  if (record.delivery.awaiting) {
    lines.push(`  closeout page: ${record.delivery.pagePath}`);
    lines.push(`  closeout render report: ${record.delivery.renderReportPath}`);
    lines.push(
      `  delivery closeout report hash: ${record.delivery.deliveryCloseoutReportHash || 'missing'}`
    );
    lines.push(`  exact confirmation instruction: ${record.delivery.exactInstruction}`);
    lines.push('  user-facing next action: confirm-closeout-acceptance');
  }
  if (
    record.delivery.stalePage ||
    record.delivery.staleAttempt ||
    record.delivery.hashMismatch ||
    record.delivery.missingAcceptanceRequest
  ) {
    lines.push(
      '  terminal completion: blocked until current closeout page, attempt, hash, and acceptance request match'
    );
  }
  if (!isPrimary && budget.name === 'compact') {
    return lines.slice(0, 4);
  }
  return lines;
}

function renderAiTddStatus(output) {
  const runtime = output.aiTdd;
  if (!runtime) return [];
  const budget = output.displayBudget || resolveDisplayBudget('route');
  const primary = runtime.primaryRecord;
  const activeRecords = runtime.activeRecords;
  const secondary = activeRecords.filter((record) => record !== primary);
  const visibleSecondary = applyLimit(secondary, budget.secondaryRecords);
  const lines = [
    `View Mode: ${runtime.viewMode}`,
    '',
    '## Status Summary',
    '',
    `Active records: ${activeRecords.length}`,
    `Primary record: ${primary ? primary.recordId : 'none'}`,
    `Primary because: ${runtime.primaryBecause}`,
    `Next Safe Action: ${runtime.nextSafeAction}`,
    `/goal route: ${runtime.goalRoute.skill} (${runtime.goalRoute.reason})`,
    '',
    '## Recommended Next Steps',
    '',
    `1. Follow Next Safe Action: \`${runtime.nextSafeAction}\``,
    `2. /goal guidance: \`${runtime.goalRoute.skill}\``,
    '3. If you need the upstream BMAD workflow catalog, run `bmad-speckit bmad-help`.',
    '',
    '## Active Requirement Records',
    '',
  ];
  if (!primary) {
    lines.push(
      '- none',
      '- next safe action: requirements-contract-authoring author-confirmation-ready-source'
    );
  } else {
    lines.push(...renderAiTddActiveRecord(primary, true, budget));
    for (const record of visibleSecondary) {
      lines.push(...renderAiTddActiveRecord(record, false, budget));
    }
    if (visibleSecondary.length < secondary.length) {
      lines.push(`- ${secondary.length - visibleSecondary.length} secondary record(s) hidden by ${budget.name} budget`);
    }
  }
  lines.push('', '## Six Mental Model Panorama', '');
  const modelRows = applyLimit(runtime.manifests.sixModelManifest || [], budget.projectionRows);
  for (const row of modelRows) {
    const marker = primary && primary.currentMentalModel === row.modelId ? 'current' : 'pending';
    lines.push(
      `- ${row.sequence}. ${row.displayName} (${row.modelId}) - ${marker}; terminalEvent=${row.terminalEvent || 'none'}`
    );
  }
  if (modelRows.length < (runtime.manifests.sixModelManifest || []).length) {
    lines.push(`- panorama rows hidden by ${budget.name} budget`);
  }
  lines.push(
    '',
    '## Runtime Workflow Guidance',
    '',
    '- CSV manifests are display projections only; they never write RequirementRecord control state.',
    '- `record_closed` is terminal event state only, not a user-executable primary route.',
    '- Safety priority outranks explicit user selection: awaiting acceptance, reconfirmation, stale hash, stale attempt, delivery blocker, and readiness blocker win.',
    '- Reconfirmation routes cover source hash drift, confirmation mismatch, architecture stale state, execution semantic gap, stale closeout page, stale acceptance request, and post-close defect.',
    '',
    '## See also: bmad-help',
    '',
    'Run `bmad-speckit bmad-help` for the full BMAD Method workflow panorama and catalog.'
  );
  return lines;
}

function renderBmads(output) {
  const progress = output.progress;
  const route = output.currentRoute;
  const readiness = output.readiness;
  const artifacts = output.artifacts;
  const orchestration = output.orchestration;
  const quickStart = output.quickStart;
  const contractStatus = output.contractStatus;
  const advisory = output.advisory;
  const aiTddStatus = renderAiTddStatus(output);
  const lines = [
    '# BMADS Runtime Console',
    '',
  ];
  if (aiTddStatus.length > 0) lines.push(...aiTddStatus, '');
  lines.push(
    '## Project State',
    '',
    `Current: ${progress.currentLayer} / ${progress.currentStage}`,
    `Next required: ${progress.nextRequiredLayer}`,
    `Completed layers: ${progress.completedLayers.length > 0 ? progress.completedLayers.join(', ') : 'none'}`,
    '',
    '## Upstream BMAD Artifacts',
    '',
    ...renderArtifactGroup('Product briefs', artifacts.productBriefs),
    ...renderArtifactGroup('PRDs', artifacts.prds),
    ...renderArtifactGroup('Architectures', artifacts.architectures),
    ...renderArtifactGroup('Epics', artifacts.epics),
    '',
    '## Completed Layer Artifacts',
    '',
    ...progress.stageStatuses
      .filter((item) => progress.completedLayers.includes(item.layer))
      .map((item) => `- ${item.layer}/${item.stage}: ${item.evidenceKind} ${item.evidencePath}`),
    ...(progress.completedLayers.length === 0 ? ['- none'] : []),
    '',
    '## Implementation Readiness',
    '',
    `Status: ${readiness.status}`,
    `Reason: ${readiness.reason}`,
    `Report: ${readiness.reportPath || 'none'}`,
    '',
    '## Current Route',
    '',
  );
  if (route) {
    lines.push(`Layer name: ${route.layerName}`);
    lines.push(`Governance stage: ${route.governanceStage}`);
    lines.push(`Governance source: ${route.requiredGovernanceSignalsFrom}`);
    lines.push(
      `Recommended workflows: ${route.recommendedWorkflows.length > 0 ? route.recommendedWorkflows.join(', ') : 'none'}`
    );
    if (route.blockedWorkflows && route.blockedWorkflows.length > 0) {
      lines.push('Blocked workflows:');
      for (const item of route.blockedWorkflows) lines.push(`- ${item.workflow}: ${item.reason}`);
    }
    if (route.dispatch)
      lines.push(`Dispatch: ${route.dispatch.taskType} via ${route.dispatch.hosts.join(', ')}`);
    if (route.gates) lines.push(`Required gates: ${route.gates.required.join(', ')}`);
    if (route.next) lines.push(`Next: ${route.next.layer} / ${route.next.stage}`);
  } else {
    lines.push('No route matched current layer/stage.');
  }
  lines.push(
    '',
    '## Main Agent',
    '',
    `Source: ${orchestration.source || 'unknown'}`,
    `Next action: ${orchestration.nextAction || 'none'}`,
    `Ready: ${String(orchestration.ready)}`,
    `Pending packet: ${orchestration.pendingPacketStatus}`,
    `Session: ${orchestration.sessionId || 'none'}`,
    ...(orchestration.stageSummary?.currentMentalModelStatus
      ? [`Mental model status: ${orchestration.stageSummary.currentMentalModelStatus}`]
      : []),
    ...(orchestration.stageSummary?.userFacingMessage
      ? [`Message: ${orchestration.stageSummary.userFacingMessage}`]
      : []),
    ...(orchestration.stageSummary?.blockingReasons &&
    orchestration.stageSummary.blockingReasons.length > 0
      ? [`Blocking reasons: ${orchestration.stageSummary.blockingReasons.join(', ')}`]
      : []),
    ...(quickStart
      ? [
          '',
          '## Quick Start',
          '',
          quickStart.message,
          '',
          `Status: ${quickStart.status}`,
          `Next required action: ${quickStart.nextRequiredAction}`,
          '',
          ...quickStart.entries.map((item) => `- ${item}`),
        ]
      : []),
    '',
    '## Contract Status',
    '',
    ...Object.entries(contractStatus).map(
      ([name, exists]) => `- ${name}: ${exists ? 'present' : 'missing'}`
    ),
    '',
    '## Stage Evidence',
    '',
    ...progress.stageStatuses.map(
      (item) =>
        `- ${item.layer}/${item.stage}: ${item.completed ? 'complete' : 'missing'} (${item.evidenceKind}) ${item.evidencePath}`
    ),
    '',
    '## Command Hints',
    '',
    ...output.commandHints.map((item) => `- ${item}`),
    '',
    '## BMAD Method Advisory',
    '',
    `${advisory.message} Command: \`${advisory.bmadHelpCommand}\`.`
  );
  return `${lines.join('\n')}\n`;
}

function mainBmadsRenderer(argv = process.argv.slice(2)) {
  try {
    const options = parseArgs(argv);
    const output = buildBmadsOutput(options);
    if (options.json) console.log(JSON.stringify(output, null, 2));
    else process.stdout.write(renderBmads(output));
    return 0;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

module.exports = {
  buildBmadsOutput,
  mainBmadsRenderer,
  renderBmads,
};

if (require.main === module) {
  process.exitCode = mainBmadsRenderer();
}
