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
import {
  defaultRuntimeContextFile,
  writeRuntimeContext,
} from '../../scripts/runtime-context';
import {
  defaultRuntimeContextRegistry,
  writeRuntimeContextRegistry,
  type RuntimeContextRegistry,
} from '../../scripts/runtime-context-registry';
import type { RuntimeFlowId } from '../../scripts/runtime-governance';
import type { StageName } from '../../scripts/bmad-config';

export interface MinimalRegistryOpts {
  flow?: RuntimeFlowId;
  stage?: StageName;
  templateId?: string;
  epicId?: string;
  storyId?: string;
  storySlug?: string;
  runId?: string;
  artifactRoot?: string;
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
  writeRuntimeContextRegistry(root, registry);
}
