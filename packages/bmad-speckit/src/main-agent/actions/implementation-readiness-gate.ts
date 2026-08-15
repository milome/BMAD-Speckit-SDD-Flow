import { mainImplementationReadinessGateV2 } from '../source-authority/scripts/main-agent-implementation-readiness-v2';
import {
  invokeSourceAuthorityMainAction,
  type MainAgentActionContext,
  type SourceAuthorityJson,
} from './source-authority-main-action';

function kebab(value: string): string {
  return value.replace(/[A-Z]/gu, (letter) => `-${letter.toLowerCase()}`);
}

function canonicalContext(context: MainAgentActionContext): MainAgentActionContext {
  const allowed = new Set(['action', 'cwd', 'json', 'requestId', 'executeRedProof', 'help']);
  const forbidden = Object.entries(context.args).find(
    ([key, value]) => value !== undefined && !allowed.has(key)
  );
  const rawArgv = ['implementation-readiness-gate'];
  if (forbidden) {
    rawArgv.push(`--${kebab(forbidden[0])}`);
    if (forbidden[1] !== true && String(forbidden[1]) !== 'true') {
      rawArgv.push(String(forbidden[1]));
    }
  } else {
    if (String(context.args.help ?? '') === 'true') rawArgv.push('--help');
    if (context.args.requestId) rawArgv.push('--request-id', String(context.args.requestId));
    if (String(context.args.executeRedProof ?? '') === 'true') rawArgv.push('--execute-red-proof');
  }
  rawArgv.push('--json');
  return { ...context, rawArgv };
}

function resultStatus(result: SourceAuthorityJson | null): string {
  return typeof result?.status === 'string' ? result.status : 'implementation_readiness_blocked';
}

export function implementationReadinessGateAction(context: MainAgentActionContext) {
  return invokeSourceAuthorityMainAction({
    context: canonicalContext(context),
    action: 'implementation-readiness-gate',
    invoke: mainImplementationReadinessGateV2,
    successStatus: resultStatus,
    blockedStatus: 'implementation_readiness_blocked',
  });
}
