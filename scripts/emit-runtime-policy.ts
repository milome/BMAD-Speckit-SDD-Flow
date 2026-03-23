/**
 * CLI: stdout = stable JSON policy from `resolveRuntimePolicy` (single evaluation source).
 *
 * Args: --flow, --stage, --template-id, --cwd
 * Env: BMAD_RUNTIME_FLOW, BMAD_RUNTIME_STAGE, BMAD_RUNTIME_TEMPLATE_ID, BMAD_RUNTIME_CWD,
 *      BMAD_RUNTIME_EPIC_ID, BMAD_RUNTIME_STORY_ID, BMAD_RUNTIME_STORY_SLUG,
 *      BMAD_RUNTIME_RUN_ID, BMAD_RUNTIME_ARTIFACT_ROOT
 *
 * Missing flow/stage from CLI+env → read registry-backed runtime context.
 * On missing/invalid registry-backed context when needed: exit 1, stderr message; stdout empty (documented).
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
    if (a === '--flow' && argv[i + 1]) {
      out.flow = argv[++i];
    } else if (a === '--stage' && argv[i + 1]) {
      out.stage = argv[++i];
    } else if (a === '--template-id' && argv[i + 1]) {
      out.templateId = argv[++i];
    } else if (a === '--cwd' && argv[i + 1]) {
      out.cwd = argv[++i];
    }
  }
  return out;
}

function hydrateIdentityFromContext(ctx: {
  templateId?: string;
  epicId?: string;
  storyId?: string;
  storySlug?: string;
  runId?: string;
  artifactRoot?: string;
}): string | undefined {
  if (ctx.epicId) process.env.BMAD_RUNTIME_EPIC_ID = ctx.epicId;
  if (ctx.storyId) process.env.BMAD_RUNTIME_STORY_ID = ctx.storyId;
  if (ctx.storySlug) process.env.BMAD_RUNTIME_STORY_SLUG = ctx.storySlug;
  if (ctx.runId) process.env.BMAD_RUNTIME_RUN_ID = ctx.runId;
  if (ctx.artifactRoot) process.env.BMAD_RUNTIME_ARTIFACT_ROOT = ctx.artifactRoot;
  return ctx.templateId;
}

function loadContextFromRegistry(root: string): {
  flow?: string;
  stage?: string;
  templateId?: string;
} {
  const registry = readRuntimeContextRegistry(root);
  const scope = resolveActiveScope(registry, registry.activeScope);
  const resolvedContextPath = resolveContextPathFromActiveScope(registry, scope);
  const ctx = readRuntimeContext(root, resolvedContextPath);
  const templateId = hydrateIdentityFromContext(ctx);
  return {
    flow: ctx.flow,
    stage: ctx.stage,
    templateId,
  };
}

function pickRoot(args: Record<string, string | undefined>): string {
  const fromArg = args.cwd?.trim();
  const fromEnv = process.env.BMAD_RUNTIME_CWD?.trim();
  if (fromArg) return path.resolve(fromArg);
  if (fromEnv) return path.resolve(fromEnv);
  return process.cwd();
}

export function mainEmitRuntimePolicy(argv: string[]): number {
  if (process.env.BMAD_POLICY_INJECT === '0') {
    console.error('BMAD_POLICY_INJECT=0: emit-runtime-policy skipped (no stdout).');
    return 0;
  }

  const args = parseArgs(argv);
  const root = pickRoot(args);

  const prevCwd = process.cwd();
  let needChdir = false;
  if (path.resolve(prevCwd) !== path.resolve(root)) {
    process.chdir(root);
    needChdir = true;
  }

  try {
    let flow = (args.flow || process.env.BMAD_RUNTIME_FLOW || '').trim();
    let stage = (args.stage || process.env.BMAD_RUNTIME_STAGE || '').trim();
    let templateId = (args.templateId || process.env.BMAD_RUNTIME_TEMPLATE_ID || '').trim();

    if (!flow || !stage) {
      try {
        const loaded = loadContextFromRegistry(root);
        if (!flow && loaded.flow) flow = loaded.flow;
        if (!stage && loaded.stage) stage = loaded.stage;
        if (!templateId && loaded.templateId) templateId = loaded.templateId;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (!msg.includes('registry') && !msg.includes('runtime-context')) {
          console.error(`emit-runtime-policy: ${msg}`);
          return 1;
        }
      }
    } else if (!templateId) {
      try {
        const loaded = loadContextFromRegistry(root);
        if (loaded.templateId) templateId = loaded.templateId;
      } catch {
        /* optional templateId from registry-backed context only */
      }
    }

    const contextProvided =
      Boolean(process.env.BMAD_RUNTIME_RUN_ID && process.env.BMAD_RUNTIME_RUN_ID.trim()) ||
      Boolean(process.env.BMAD_RUNTIME_STORY_ID && process.env.BMAD_RUNTIME_STORY_ID.trim());

    if (flow === 'story' && stage === 'implement' && !contextProvided) {
      console.error(
        'emit-runtime-policy: story/implement requires explicit runtime context in story-scoped mode.'
      );
      return 1;
    }

    if (!flow || !stage) {
      console.error(
        'emit-runtime-policy: missing flow/stage (CLI/env or runtime registry activeScope/context resolution).'
      );
      return 1;
    }

    const input: ResolveRuntimePolicyInput = {
      flow: flow as RuntimeFlowId,
      stage: stage as StageName,
      ...(process.env.BMAD_RUNTIME_EPIC_ID ? { epicId: process.env.BMAD_RUNTIME_EPIC_ID } : {}),
      ...(process.env.BMAD_RUNTIME_STORY_ID ? { storyId: process.env.BMAD_RUNTIME_STORY_ID } : {}),
      ...(process.env.BMAD_RUNTIME_STORY_SLUG
        ? { storySlug: process.env.BMAD_RUNTIME_STORY_SLUG }
        : {}),
      ...(process.env.BMAD_RUNTIME_RUN_ID ? { runId: process.env.BMAD_RUNTIME_RUN_ID } : {}),
      ...(process.env.BMAD_RUNTIME_ARTIFACT_ROOT
        ? { artifactRoot: process.env.BMAD_RUNTIME_ARTIFACT_ROOT }
        : {}),
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
