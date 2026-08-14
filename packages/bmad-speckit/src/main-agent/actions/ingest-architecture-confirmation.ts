import { mainIngestArchitectureConfirmation } from '../source-authority/scripts/ingest-architecture-confirmation';
import {
  invokeSourceAuthorityMainAction,
  type MainAgentActionContext,
  type SourceAuthorityJson,
} from './source-authority-main-action';

function eventType(result: SourceAuthorityJson | null): unknown {
  const event = result?.event;
  return event && typeof event === 'object' && !Array.isArray(event)
    ? (event as SourceAuthorityJson).eventType
    : null;
}

export function runIngestArchitectureConfirmation(context: MainAgentActionContext) {
  return invokeSourceAuthorityMainAction({
    context,
    action: 'ingest-architecture-confirmation',
    invoke: mainIngestArchitectureConfirmation,
    successStatus: (result) => {
      if (eventType(result) === 'architecture_confirmation_state_checked') {
        return 'architecture_confirmation_state_checked';
      }
      return result?.status === 'architecture_confirmation_reused'
        ? 'architecture_confirmation_reused'
        : 'architecture_confirmation_recorded';
    },
    blockedStatus: 'architecture_confirmation_blocked',
  });
}
