import { mainGapClosureEvidence } from '../source-authority/scripts/requirements-contract-gap-closure-evidence';
import {
  invokeSourceAuthorityMainAction,
  type MainAgentActionContext,
} from './source-authority-main-action';

export function gapClosureEvidenceAction(context: MainAgentActionContext) {
  return invokeSourceAuthorityMainAction({
    context,
    action: 'gap-closure-evidence',
    invoke: mainGapClosureEvidence,
    successStatus: (result) =>
      result?.closureDecision === 'Verified Closed'
        ? 'gap_verified_closed'
        : 'gap_closure_implemented',
    blockedStatus: 'gap_closure_blocked',
  });
}
