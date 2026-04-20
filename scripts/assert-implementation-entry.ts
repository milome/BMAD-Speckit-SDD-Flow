/* eslint-disable no-console */

import * as path from 'node:path';
import { resolveBmadHelpRuntimePolicy } from './bmad-config';
import { type ResolveRuntimePolicyInput, type RuntimeFlowId } from './runtime-governance';
import type { StageName } from './bmad-config';
import {
  buildImplementationEntryIndexKey,
  recordImplementationEntryGate,
} from './runtime-context-registry';
import { loadPolicyContextFromRegistry } from './emit-runtime-policy';

function parseArgs(argv: string[]): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--cwd' && argv[index + 1]) {
      out.cwd = argv[index + 1];
      index += 1;
    }
  }
  return out;
}

function pickRoot(args: Record<string, string | undefined>): string {
  const fromArg = args.cwd?.trim();
  return fromArg ? path.resolve(fromArg) : process.cwd();
}

export function mainAssertImplementationEntry(argv: string[]): number {
  const args = parseArgs(argv);
  const root = pickRoot(args);

  let loaded: ReturnType<typeof loadPolicyContextFromRegistry>;
  try {
    loaded = loadPolicyContextFromRegistry(root);
  } catch (error) {
    console.error(
      `assert-implementation-entry: ${error instanceof Error ? error.message : String(error)}`
    );
    return 1;
  }

  const flow = loaded.flow as RuntimeFlowId;
  if (flow !== 'story' && flow !== 'bugfix' && flow !== 'standalone_tasks') {
    console.error(`assert-implementation-entry: unsupported flow=${loaded.flow}`);
    return 1;
  }

  const input: ResolveRuntimePolicyInput = {
    flow,
    stage: loaded.stage as StageName,
    ...(loaded.epicId ? { epicId: loaded.epicId } : {}),
    ...(loaded.storyId ? { storyId: loaded.storyId } : {}),
    ...(loaded.storySlug ? { storySlug: loaded.storySlug } : {}),
    ...(loaded.runId ? { runId: loaded.runId } : {}),
    ...(loaded.artifactRoot ? { artifactRoot: loaded.artifactRoot } : {}),
  };

  const policy = resolveBmadHelpRuntimePolicy({
    ...input,
    projectRoot: root,
    runtimeContext: loaded.runtimeContext,
    runtimeContextPath: loaded.resolvedContextPath,
  });

  const key = buildImplementationEntryIndexKey({
    flow,
    runId: loaded.runtimeContext.runId,
    artifactRoot: loaded.runtimeContext.artifactRoot,
    artifactDocPath: loaded.runtimeContext.artifactPath,
    storyId: loaded.runtimeContext.storyId,
  });
  recordImplementationEntryGate(root, {
    flow,
    key,
    gate: policy.implementationEntryGate,
  });

  process.stdout.write(`${JSON.stringify(policy.implementationEntryGate, null, 2)}\n`);
  return policy.implementationEntryGate.decision === 'pass' ? 0 : 2;
}

if (require.main === module) {
  process.exit(mainAssertImplementationEntry(process.argv.slice(2)));
}
