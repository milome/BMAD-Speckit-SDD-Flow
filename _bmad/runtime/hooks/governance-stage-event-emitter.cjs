#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

function queueDir(projectRoot) {
  return path.join(projectRoot, '_bmad-output', 'runtime', 'governance', 'queue');
}

function pendingEventDir(projectRoot) {
  return path.join(queueDir(projectRoot), 'pending-events');
}

function sanitizeEventToken(value) {
  return String(value || '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function buildGovernanceStageRerunResultEvent(input) {
  return {
    type: 'governance-rerun-result',
    payload: {
      projectRoot: input.projectRoot,
      ...(input.configPath ? { configPath: input.configPath } : {}),
      ...(Array.isArray(input.journeyContractHints) && input.journeyContractHints.length > 0
        ? { journeyContractHints: input.journeyContractHints }
        : {}),
      ...(input.sourceEventType ? { sourceEventType: input.sourceEventType } : {}),
      runnerInput: input.runnerInput,
      ...(input.rerunGateResult ? { rerunGateResult: input.rerunGateResult } : {}),
    },
  };
}

function persistGovernanceStageRerunResultEvent(event) {
  const projectRoot = event.payload.projectRoot;
  const dir = pendingEventDir(projectRoot);
  fs.mkdirSync(dir, { recursive: true });

  const runnerInput = event.payload.runnerInput || {};
  const rerunGate =
    typeof runnerInput.rerunGate === 'string' && runnerInput.rerunGate.trim() !== ''
      ? runnerInput.rerunGate
      : 'unknown-gate';
  const attemptId =
    typeof runnerInput.attemptId === 'string' && runnerInput.attemptId.trim() !== ''
      ? runnerInput.attemptId
      : 'unknown-attempt';

  const fileName = `${sanitizeEventToken(rerunGate)}--${sanitizeEventToken(attemptId)}--${Date.now()}.json`;
  const filePath = path.join(dir, fileName);
  fs.writeFileSync(filePath, JSON.stringify(event, null, 2) + '\n', 'utf8');
  return filePath;
}

module.exports = {
  buildGovernanceStageRerunResultEvent,
  persistGovernanceStageRerunResultEvent,
};
