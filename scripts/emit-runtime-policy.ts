/**
 * CLI: stdout = stable JSON policy from `resolveRuntimePolicy` (single evaluation source).
 *
 * **唯一真相源**：`_bmad-output/runtime/registry.json` + activeScope 解析出的 scoped context JSON
 * （如 `project.json`）。不通过环境变量注入 flow/stage 或覆盖 registry 解析结果；不提供 CLI 参数覆盖 flow/stage（仅 `--cwd`）。
 *
 * Args: 仅 `--cwd <dir>` 用于指定项目根（定位 registry）；缺省为 `process.cwd()`。
 *
 * 若 registry 或 context 缺失/非法：exit 1，stderr 说明；stdout 为空。
 */
/* eslint-disable no-console */

import * as path from 'node:path';
import {
  resolveRuntimePolicy,
  type ResolveRuntimePolicyInput,
  type RuntimeFlowId,
} from './runtime-governance';
import type { StageName } from './bmad-config';
import { readRuntimeContext } from './runtime-context';
import {
  readRuntimeContextRegistry,
  resolveActiveScope,
  resolveContextPathFromActiveScope,
} from './runtime-context-registry';
import { stableStringifyPolicy } from './stable-runtime-policy-json';

function parseArgs(argv: string[]): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--cwd' && argv[i + 1]) {
      out.cwd = argv[++i];
    }
  }
  return out;
}

/** Load flow/stage/identity **only** from registry-backed runtime context. */
export function loadPolicyContextFromRegistry(root: string): {
  flow: string;
  stage: string;
  templateId?: string;
  epicId?: string;
  storyId?: string;
  storySlug?: string;
  runId?: string;
  artifactRoot?: string;
} {
  const registry = readRuntimeContextRegistry(root);
  const scope = resolveActiveScope(registry, registry.activeScope);
  const resolvedContextPath = resolveContextPathFromActiveScope(registry, scope);
  const ctx = readRuntimeContext(root, resolvedContextPath);
  return {
    flow: ctx.flow,
    stage: ctx.stage,
    templateId: ctx.templateId,
    epicId: ctx.epicId,
    storyId: ctx.storyId,
    storySlug: ctx.storySlug,
    runId: ctx.runId,
    artifactRoot: ctx.artifactRoot,
  };
}

function pickRoot(args: Record<string, string | undefined>): string {
  const fromArg = args.cwd?.trim();
  if (fromArg) return path.resolve(fromArg);
  return process.cwd();
}

export function mainEmitRuntimePolicy(argv: string[]): number {
  const args = parseArgs(argv);
  const root = pickRoot(args);

  const prevCwd = process.cwd();
  let needChdir = false;
  if (path.resolve(prevCwd) !== path.resolve(root)) {
    process.chdir(root);
    needChdir = true;
  }

  try {
    let loaded: ReturnType<typeof loadPolicyContextFromRegistry>;
    try {
      loaded = loadPolicyContextFromRegistry(root);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`emit-runtime-policy: ${msg}`);
      return 1;
    }

    const flow = (loaded.flow || '').trim();
    const stage = (loaded.stage || '').trim();
    const templateId = (loaded.templateId || '').trim();

    const contextProvided =
      Boolean(loaded.runId && loaded.runId.trim()) ||
      Boolean(loaded.storyId && loaded.storyId.trim());

    if (flow === 'story' && stage === 'implement' && !contextProvided) {
      console.error(
        'emit-runtime-policy: story/implement requires storyId or runId in runtime context (registry-backed).'
      );
      return 1;
    }

    if (!flow || !stage) {
      console.error(
        'emit-runtime-policy: missing flow/stage in registry-backed runtime context (see _bmad-output/runtime/).'
      );
      return 1;
    }

    const input: ResolveRuntimePolicyInput = {
      flow: flow as RuntimeFlowId,
      stage: stage as StageName,
      ...(loaded.epicId ? { epicId: loaded.epicId } : {}),
      ...(loaded.storyId ? { storyId: loaded.storyId } : {}),
      ...(loaded.storySlug ? { storySlug: loaded.storySlug } : {}),
      ...(loaded.runId ? { runId: loaded.runId } : {}),
      ...(loaded.artifactRoot ? { artifactRoot: loaded.artifactRoot } : {}),
    };
    if (templateId) {
      input.templateId = templateId;
    }

    const policy = resolveRuntimePolicy(input);
    process.stdout.write(stableStringifyPolicy(policy));
    return 0;
  } finally {
    if (needChdir) {
      try {
        process.chdir(prevCwd);
      } catch {
        /* ignore */
      }
    }
  }
}

if (require.main === module) {
  const code = mainEmitRuntimePolicy(process.argv.slice(2));
  process.exit(code);
}
