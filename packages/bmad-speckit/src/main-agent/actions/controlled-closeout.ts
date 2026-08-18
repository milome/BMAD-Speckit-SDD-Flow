import {
  confirmMainAgentControlledCloseoutByRequestId,
  type MainAgentControlledCloseoutConfirmationResult,
} from '../source-authority/scripts/main-agent-controlled-closeout-confirmation';
import type { MainAgentActionContext } from './source-authority-main-action';

const USAGE =
  'main-agent controlled-closeout --cwd <path> --request-id <requestId> --exact-confirmation-text <text> --json';

function blockedResult(issueCode: string): MainAgentControlledCloseoutConfirmationResult {
  return {
    ok: false,
    status: 'blocked',
    exitCode: 2,
    issueCode,
    error: issueCode,
    sourceUpdated: false,
  };
}

export function runControlledCloseoutAction(context: MainAgentActionContext): {
  payload: MainAgentControlledCloseoutConfirmationResult | { usage: string };
  exitCode: number;
} {
  const allowed = new Set(['action', 'cwd', 'requestId', 'exactConfirmationText', 'json', 'help']);
  const forbidden = Object.keys(context.args).find((key) => !allowed.has(key));
  if (forbidden) {
    return { payload: blockedResult('caller_derived_input_forbidden'), exitCode: 2 };
  }
  if (context.args.help === 'true') {
    return { payload: { usage: USAGE }, exitCode: 0 };
  }
  if (typeof context.args.cwd !== 'string' || context.args.cwd.length === 0) {
    return { payload: blockedResult('controlled_closeout_cwd_required'), exitCode: 2 };
  }
  if (typeof context.args.requestId !== 'string' || context.args.requestId.length === 0) {
    return { payload: blockedResult('controlled_closeout_request_id_required'), exitCode: 2 };
  }
  if (
    typeof context.args.exactConfirmationText !== 'string' ||
    context.args.exactConfirmationText.length === 0
  ) {
    return {
      payload: blockedResult('controlled_closeout_exact_confirmation_text_required'),
      exitCode: 2,
    };
  }
  if (context.args.json !== 'true') {
    return { payload: blockedResult('controlled_closeout_json_required'), exitCode: 2 };
  }

  const payload = confirmMainAgentControlledCloseoutByRequestId({
    projectRoot: context.cwd,
    requestId: context.args.requestId,
    exactConfirmationText: context.args.exactConfirmationText,
  });
  return { payload, exitCode: payload.exitCode };
}
