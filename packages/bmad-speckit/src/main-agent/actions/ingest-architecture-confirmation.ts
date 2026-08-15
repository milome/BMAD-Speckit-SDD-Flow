import { mainIngestArchitectureConfirmation } from '../source-authority/scripts/ingest-architecture-confirmation';
import {
  invokeSourceAuthorityMainAction,
  type MainAgentActionContext,
} from './source-authority-main-action';

export function runIngestArchitectureConfirmation(context: MainAgentActionContext) {
  return invokeSourceAuthorityMainAction({
    context,
    action: 'ingest-architecture-confirmation',
    invoke: mainIngestArchitectureConfirmation,
    successStatus: (result) =>
      result?.status === 'architecture_confirmation_reused'
        ? 'architecture_confirmation_reused'
        : 'architecture_confirmation_recorded',
    blockedStatus: 'architecture_confirmation_blocked',
  });
}
