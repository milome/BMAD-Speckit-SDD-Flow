"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.canMainAgentContinue = canMainAgentContinue;
exports.canMainAgentContinueFromCloseout = canMainAgentContinueFromCloseout;
function canMainAgentContinue(input) {
    if (input.circuitOpen) {
        return false;
    }
    if (input.latestGateDecision === 'true_blocker' || input.latestGateDecision === 'reroute') {
        return false;
    }
    if (input.fourSignalStatus === 'block') {
        return false;
    }
    if (!input.closeoutApproved) {
        return false;
    }
    if (input.scoreWriteResult !== 'ok') {
        return false;
    }
    if (!input.handoffPersisted) {
        return false;
    }
    return true;
}
function canMainAgentContinueFromCloseout(input) {
    return canMainAgentContinue({
        latestGateDecision: input.latestGateDecision,
        fourSignalStatus: input.fourSignalStatus,
        closeoutApproved: input.closeoutApproved,
        scoreWriteResult: input.scoreWriteResult ?? null,
        handoffPersisted: input.handoffPersisted ?? false,
        circuitOpen: input.circuitOpen ?? false,
    });
}
