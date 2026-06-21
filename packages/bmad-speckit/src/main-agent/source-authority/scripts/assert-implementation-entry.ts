/* eslint-disable no-console */

import * as path from 'node:path';
import { mainEmitRuntimePolicy, loadPolicyContextFromRegistry } from './emit-runtime-policy';
import { type RuntimeFlowId } from './runtime-governance';

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

  const stdoutChunks: string[] = [];
  const originalWrite = process.stdout.write.bind(process.stdout);
  (process.stdout as { write: typeof process.stdout.write }).write = (
    chunk: string | Uint8Array
  ) => {
    stdoutChunks.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8'));
    return true;
  };

  try {
    const code = mainEmitRuntimePolicy(['--cwd', root]);
    if (code !== 0) {
      console.error('assert-implementation-entry: emit-runtime-policy failed');
      return 1;
    }
  } finally {
    (process.stdout as { write: typeof process.stdout.write }).write = originalWrite;
  }

  const policy = JSON.parse(stdoutChunks.join('')) as {
    implementationEntryGate?: { decision?: string };
  };
  process.stdout.write(`${JSON.stringify(policy.implementationEntryGate ?? {}, null, 2)}\n`);
  return policy.implementationEntryGate?.decision === 'pass' ? 0 : 2;
}

if (require.main === module) {
  process.exit(mainAssertImplementationEntry(process.argv.slice(2)));
}
