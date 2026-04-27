/* eslint-disable no-console */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { runMainAgentAutomaticLoop } from './main-agent-orchestration';
import type { RuntimeFlowId } from './runtime-governance';

export type MainAgentHostMode = 'hooks_enabled' | 'no_hooks';
export type MainAgentHostKind = 'cursor' | 'claude' | 'codex';
export type MainAgentOrchestrationEntry = 'hook_ingress' | 'cli_ingress';

export interface UnifiedIngressReceipt {
  reportType: 'main_agent_unified_ingress';
  generatedAt: string;
  projectRoot: string;
  hostKind: MainAgentHostKind;
  hostMode: MainAgentHostMode;
  orchestrationEntry: MainAgentOrchestrationEntry;
  hookAvailable: boolean;
  degradationReason: string | null;
  controlPlane: 'main-agent-orchestration';
  flow: RuntimeFlowId;
  stage: string;
  runLoop: {
    runId: string;
    status: 'completed' | 'blocked';
    packetId: string | null;
    finalNextAction: string | null;
    pendingPacketStatus: string;
  };
  sameControlPlane: true;
}

function parseArgs(argv: string[]): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token.startsWith('--') && argv[index + 1]) {
      out[token.slice(2)] = argv[++index];
    }
  }
  return out;
}

function hookPathFor(root: string, hostKind: MainAgentHostKind): string | null {
  if (hostKind === 'cursor') return path.join(root, '.cursor', 'hooks.json');
  if (hostKind === 'claude')
    return path.join(root, '_bmad', 'claude', 'hooks', 'runtime-policy-inject.cjs');
  return null;
}

function resolveEntry(input: {
  projectRoot: string;
  hostKind: MainAgentHostKind;
  forceNoHooks?: boolean;
}): Pick<
  UnifiedIngressReceipt,
  'hostMode' | 'orchestrationEntry' | 'hookAvailable' | 'degradationReason'
> {
  const hookPath = hookPathFor(input.projectRoot, input.hostKind);
  const hookAvailable = hookPath != null && fs.existsSync(hookPath);
  if (input.forceNoHooks || input.hostKind === 'codex') {
    return {
      hostMode: 'no_hooks',
      orchestrationEntry: 'cli_ingress',
      hookAvailable,
      degradationReason: input.hostKind === 'codex' ? 'codex has no hook adapter' : null,
    };
  }
  if (hookAvailable) {
    return {
      hostMode: 'hooks_enabled',
      orchestrationEntry: 'hook_ingress',
      hookAvailable,
      degradationReason: null,
    };
  }
  return {
    hostMode: 'no_hooks',
    orchestrationEntry: 'cli_ingress',
    hookAvailable,
    degradationReason: 'hook unavailable; degraded to cli_ingress',
  };
}

export function runUnifiedIngress(input: {
  projectRoot: string;
  hostKind: MainAgentHostKind;
  flow: RuntimeFlowId;
  stage: string;
  forceNoHooks?: boolean;
}): UnifiedIngressReceipt {
  const projectRoot = path.resolve(input.projectRoot);
  const entry = resolveEntry({
    projectRoot,
    hostKind: input.hostKind,
    forceNoHooks: input.forceNoHooks,
  });
  const runLoop = runMainAgentAutomaticLoop({
    projectRoot,
    flow: input.flow,
    stage: input.stage,
    args: {
      reportEvidence: `${entry.orchestrationEntry}:${input.hostKind}`,
    },
  });
  return {
    reportType: 'main_agent_unified_ingress',
    generatedAt: new Date().toISOString(),
    projectRoot,
    hostKind: input.hostKind,
    ...entry,
    controlPlane: 'main-agent-orchestration',
    flow: input.flow,
    stage: input.stage,
    runLoop: {
      runId: runLoop.runId,
      status: runLoop.status,
      packetId: runLoop.dispatchInstruction?.packetId ?? null,
      finalNextAction: runLoop.finalSurface.mainAgentNextAction,
      pendingPacketStatus: runLoop.finalSurface.pendingPacketStatus,
    },
    sameControlPlane: true,
  };
}

export function main(argv: string[]): number {
  const args = parseArgs(argv);
  const hostKind: MainAgentHostKind =
    args.hostKind === 'claude' || args.hostKind === 'codex' ? args.hostKind : 'cursor';
  const receipt = runUnifiedIngress({
    projectRoot: path.resolve(args.cwd ?? process.cwd()),
    hostKind,
    flow: (args.flow as RuntimeFlowId | undefined) ?? 'story',
    stage: args.stage ?? 'implement',
    forceNoHooks: args.forceNoHooks === 'true',
  });
  const reportPath = path.resolve(
    args.reportPath ??
      path.join(
        receipt.projectRoot,
        '_bmad-output',
        'runtime',
        'ingress',
        `${hostKind}-${receipt.orchestrationEntry}.json`
      )
  );
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(receipt, null, 2) + '\n', 'utf8');
  console.log(JSON.stringify({ reportPath, ...receipt }, null, 2));
  return receipt.runLoop.status === 'completed' ? 0 : 1;
}

if (require.main === module) {
  process.exitCode = main(process.argv.slice(2));
}
