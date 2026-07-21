import { mainImplementationReadinessGate } from '../source-authority/scripts/main-agent-implementation-readiness-gate';
import {
  invokeSourceAuthorityMainAction,
  type MainAgentActionContext,
} from './source-authority-main-action';

export function implementationReadinessGateAction(context: MainAgentActionContext) {
  return invokeSourceAuthorityMainAction({
    context,
    action: 'implementation-readiness-gate',
    invoke: mainImplementationReadinessGate,
    successStatus: (result) =>
      result?.decision === 'pass'
        ? 'implementation_readiness_pass'
        : 'implementation_readiness_blocked',
    blockedStatus: 'implementation_readiness_blocked',
  });
}
