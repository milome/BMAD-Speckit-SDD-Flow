import { mainPrepareArchitectureConfirmation } from '../source-authority/scripts/prepare-architecture-confirmation';
import {
  invokeSourceAuthorityMainAction,
  type MainAgentActionContext,
  type SourceAuthorityJson,
} from './source-authority-main-action';

function resultStatus(result: SourceAuthorityJson | null): string {
  const status = result?.status;
  return typeof status === 'string' ? status : 'user_confirmable';
}

export function runPrepareArchitectureConfirmation(context: MainAgentActionContext) {
  return invokeSourceAuthorityMainAction({
    context,
    action: 'prepare-architecture-confirmation',
    invoke: mainPrepareArchitectureConfirmation,
    successStatus: resultStatus,
    blockedStatus: 'architecture_confirmation_blocked',
  });
}
