import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

export const LAYER_1_PRD_COMPLETION_SCHEMA_VERSION = 'layer_1_prd_completion/v1';
export const LAYER_1_PRD_MARKER_TYPE = 'bmad_help_five_layer_stage_complete';
export const LAYER_1_PRD_MARKER_FILE = 'layer_1-prd.complete.json';

type Layer1InputRecord = {
  path: string;
  priority: number;
  sourceType: 'branch_prd' | 'root_prd' | 'product_brief';
};

export type Layer1PrdCompletionMarker = {
  markerType: typeof LAYER_1_PRD_MARKER_TYPE;
  schemaVersion: typeof LAYER_1_PRD_COMPLETION_SCHEMA_VERSION;
  layer: 'layer_1';
  stage: 'prd';
  generatedAt: string;
  inputs: {
    productBriefs: string[];
    prds: string[];
    runtimeContext: string;
  };
  sources: {
    planningArtifactsRoot: string;
    branch: string;
    bmmConfigPath: string;
    productBriefWorkflowPath: string;
    prdWorkflowPath: string;
  };
  hashes: Record<string, string>;
  acceptance: {
    prdPresent: boolean;
    contextPresent: boolean;
    productBriefPresent: boolean;
    layer1Complete: boolean;
  };
  handoff: {
    nextLayer: 'layer_2';
    nextStage: 'arch';
    summary: string;
  };
};

function toProjectRelativePath(projectRoot: string, filePath: string): string {
  return path.relative(projectRoot, filePath).replace(/\\/g, '/');
}

function sha256File(filePath: string): string {
  return createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function resolveCurrentBranch(projectRoot: string): string {
  try {
    const gitHead = fs.readFileSync(path.join(projectRoot, '.git', 'HEAD'), 'utf8').trim();
    if (gitHead.startsWith('ref: refs/heads/')) {
      return gitHead.replace('ref: refs/heads/', '').replace(/\//g, '-');
    }
  } catch {
    // Test fixtures usually do not have a Git checkout; default to the repo branch convention.
  }
  return 'dev';
}

function findProductBriefInputs(projectRoot: string, planningRoot: string): Layer1InputRecord[] {
  if (!fs.existsSync(planningRoot)) return [];
  return fs
    .readdirSync(planningRoot, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /^product-brief-.*\.md$/i.test(entry.name))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((entry, index) => ({
      path: toProjectRelativePath(projectRoot, path.join(planningRoot, entry.name)),
      priority: 3 + index,
      sourceType: 'product_brief' as const,
    }));
}

function collectLayer1PrdInputs(projectRoot: string): {
  branch: string;
  planningRoot: string;
  prds: Layer1InputRecord[];
  productBriefs: Layer1InputRecord[];
  runtimeContextPath: string;
  contextPresent: boolean;
} {
  const branch = resolveCurrentBranch(projectRoot);
  const planningRoot = path.join(projectRoot, '_bmad-output', 'planning-artifacts');
  const branchPrd = path.join(planningRoot, branch, 'prd.md');
  const rootPrd = path.join(planningRoot, 'prd.md');
  const prds: Layer1InputRecord[] = [];
  if (fs.existsSync(branchPrd)) {
    prds.push({
      path: toProjectRelativePath(projectRoot, branchPrd),
      priority: 1,
      sourceType: 'branch_prd',
    });
  }
  if (fs.existsSync(rootPrd)) {
    prds.push({
      path: toProjectRelativePath(projectRoot, rootPrd),
      priority: 2,
      sourceType: 'root_prd',
    });
  }
  const runtimeContextPath = path.join(projectRoot, '_bmad-output', 'runtime', 'context', 'project.json');
  return {
    branch,
    planningRoot,
    prds,
    productBriefs: findProductBriefInputs(projectRoot, planningRoot),
    runtimeContextPath: toProjectRelativePath(projectRoot, runtimeContextPath),
    contextPresent: fs.existsSync(runtimeContextPath),
  };
}

export function buildLayer1PrdCompletionMarker(input: {
  projectRoot: string;
  generatedAt?: string;
}): Layer1PrdCompletionMarker {
  const projectRoot = path.resolve(input.projectRoot);
  const collected = collectLayer1PrdInputs(projectRoot);
  const artifactInputs = [...collected.prds, ...collected.productBriefs];
  const hashes: Record<string, string> = {};
  for (const item of artifactInputs) {
    hashes[item.path] = sha256File(path.join(projectRoot, item.path));
  }

  const prdPresent = collected.prds.length > 0;
  const productBriefPresent = collected.productBriefs.length > 0;
  const contextPresent = collected.contextPresent;

  return {
    markerType: LAYER_1_PRD_MARKER_TYPE,
    schemaVersion: LAYER_1_PRD_COMPLETION_SCHEMA_VERSION,
    layer: 'layer_1',
    stage: 'prd',
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    inputs: {
      productBriefs: collected.productBriefs.map((item) => item.path),
      prds: collected.prds.map((item) => item.path),
      runtimeContext: collected.runtimeContextPath,
    },
    sources: {
      planningArtifactsRoot: toProjectRelativePath(projectRoot, collected.planningRoot),
      branch: collected.branch,
      bmmConfigPath: '_bmad/bmm/config.yaml',
      productBriefWorkflowPath:
        '_bmad/bmm/workflows/1-analysis/create-product-brief/steps/step-01-init.md',
      prdWorkflowPath: '_bmad/bmm/workflows/2-plan-workflows/create-prd/steps-c/step-01-init.md',
    },
    hashes,
    acceptance: {
      prdPresent,
      contextPresent,
      productBriefPresent,
      layer1Complete: prdPresent && productBriefPresent && contextPresent,
    },
    handoff: {
      nextLayer: 'layer_2',
      nextStage: 'arch',
      summary: 'Layer 1 PRD/context evidence is complete and ready for architecture handoff.',
    },
  };
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string' && item.length > 0);
}

function isLayer1PrdCompletionMarker(value: unknown): value is Layer1PrdCompletionMarker {
  if (typeof value !== 'object' || value === null) return false;
  const marker = value as Partial<Layer1PrdCompletionMarker>;
  return (
    marker.markerType === LAYER_1_PRD_MARKER_TYPE &&
    marker.schemaVersion === LAYER_1_PRD_COMPLETION_SCHEMA_VERSION &&
    marker.layer === 'layer_1' &&
    marker.stage === 'prd' &&
    typeof marker.generatedAt === 'string' &&
    marker.inputs != null &&
    isStringArray(marker.inputs.productBriefs) &&
    isStringArray(marker.inputs.prds) &&
    typeof marker.inputs.runtimeContext === 'string' &&
    marker.sources != null &&
    marker.sources.planningArtifactsRoot === '_bmad-output/planning-artifacts' &&
    typeof marker.sources.branch === 'string' &&
    marker.sources.bmmConfigPath === '_bmad/bmm/config.yaml' &&
    marker.sources.productBriefWorkflowPath ===
      '_bmad/bmm/workflows/1-analysis/create-product-brief/steps/step-01-init.md' &&
    marker.sources.prdWorkflowPath ===
      '_bmad/bmm/workflows/2-plan-workflows/create-prd/steps-c/step-01-init.md' &&
    marker.hashes != null &&
    typeof marker.hashes === 'object' &&
    marker.acceptance?.prdPresent === true &&
    marker.acceptance.contextPresent === true &&
    marker.acceptance.productBriefPresent === true &&
    marker.acceptance.layer1Complete === true &&
    marker.handoff?.nextLayer === 'layer_2' &&
    marker.handoff.nextStage === 'arch' &&
    typeof marker.handoff.summary === 'string'
  );
}

export function validateLayer1PrdCompletionMarker(input: {
  projectRoot: string;
  markerPath: string;
}): boolean {
  const projectRoot = path.resolve(input.projectRoot);
  if (!fs.existsSync(input.markerPath)) return false;
  try {
    const parsed = JSON.parse(fs.readFileSync(input.markerPath, 'utf8')) as unknown;
    if (!isLayer1PrdCompletionMarker(parsed)) return false;
    const marker = parsed;
    const requiredHashPaths = [...marker.inputs.prds, ...marker.inputs.productBriefs];
    if (requiredHashPaths.length === 0) return false;
    for (const relativePath of requiredHashPaths) {
      const absolutePath = path.join(projectRoot, relativePath);
      if (!fs.existsSync(absolutePath)) return false;
      if (marker.hashes[relativePath] !== sha256File(absolutePath)) return false;
    }
    return fs.existsSync(path.join(projectRoot, marker.inputs.runtimeContext));
  } catch {
    return false;
  }
}

export function writeLayer1PrdCompletionMarker(input: {
  projectRoot: string;
  generatedAt?: string;
}): string {
  const projectRoot = path.resolve(input.projectRoot);
  const marker = buildLayer1PrdCompletionMarker({
    projectRoot,
    generatedAt: input.generatedAt,
  });
  if (!marker.acceptance.layer1Complete) {
    throw new Error(
      [
        'layer_1 PRD completion evidence is incomplete',
        `prdPresent=${marker.acceptance.prdPresent}`,
        `productBriefPresent=${marker.acceptance.productBriefPresent}`,
        `contextPresent=${marker.acceptance.contextPresent}`,
      ].join('; ')
    );
  }
  const markerPath = path.join(projectRoot, '_bmad-output', 'runtime', 'context', LAYER_1_PRD_MARKER_FILE);
  fs.mkdirSync(path.dirname(markerPath), { recursive: true });
  fs.writeFileSync(markerPath, `${JSON.stringify(marker, null, 2)}\n`, 'utf8');
  return markerPath;
}
