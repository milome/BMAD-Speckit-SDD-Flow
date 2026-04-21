#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

function ensureParentDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function writeJson(filePath, payload) {
  ensureParentDir(filePath);
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function normalizePath(value) {
  return String(value || '').replace(/\\/g, '/');
}

function partyModeCurrentSessionStatePath(projectRoot) {
  return path.join(projectRoot, '_bmad-output', 'party-mode', 'runtime', 'current-session.json');
}

function derivePartyModeVisibleOutputCapturePath(projectRoot, sessionKey) {
  return path.join(
    projectRoot,
    '_bmad-output',
    'party-mode',
    'captures',
    `${sessionKey}.tool-result.md`
  );
}

function derivePartyModeLaunchCapturePath(projectRoot, sessionKey) {
  return path.join(
    projectRoot,
    '_bmad-output',
    'party-mode',
    'captures',
    `${sessionKey}.subagent-start.raw.json`
  );
}

function derivePartyModeSidecarDir(projectRoot) {
  return path.join(projectRoot, '_bmad-output', 'party-mode', 'sidecar');
}

function derivePartyModeStartedSidecarPath(projectRoot, sessionKey) {
  return path.join(derivePartyModeSidecarDir(projectRoot), `${sessionKey}.started.json`);
}

function derivePartyModeProgressSidecarPath(projectRoot, sessionKey) {
  return path.join(derivePartyModeSidecarDir(projectRoot), `${sessionKey}.progress.json`);
}

function derivePartyModeFinalSidecarPath(projectRoot, sessionKey) {
  return path.join(derivePartyModeSidecarDir(projectRoot), `${sessionKey}.final.json`);
}

function readPartyModeSidecar(filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    return null;
  }
  try {
    return readJson(filePath);
  } catch {
    return null;
  }
}

function writePartyModeSidecar(filePath, payload) {
  writeJson(filePath, payload);
  return payload;
}

function readPartyModeCurrentSessionState(projectRoot) {
  const filePath = partyModeCurrentSessionStatePath(projectRoot);
  if (!fs.existsSync(filePath)) {
    return null;
  }
  try {
    return readJson(filePath);
  } catch {
    return null;
  }
}

function omitStaleDerivedFields(state) {
  if (!state || typeof state !== 'object') {
    return {};
  }
  const next = { ...state };
  const keys = [
    'validation_status',
    'observed_visible_round_count',
    'reconstructed_at',
    'final_gate_profile',
    'final_gate_total_rounds',
    'final_gate_result',
    'validation_errors',
    'validation_warnings',
    'visible_progress_current_round',
    'visible_progress_target_round',
    'visible_output_summary',
    'visible_fragment_record_present',
    'bugfix_doc_path',
    'expected_document_paths',
    'expected_document_count',
    'document_generation_required',
    'generated_document_paths',
    'generated_document_count',
    'latest_generated_document_path',
    'latest_generated_document_kind',
    'document_generation_observed_at',
    'recovered_from_sidecar',
    'recovered_from_sidecar_kind',
    'recovered_from_sidecar_at',
    'sidecar_started_path',
    'sidecar_progress_path',
    'sidecar_final_path',
  ];
  for (const key of keys) {
    delete next[key];
  }
  return next;
}

function writePartyModeCurrentSessionState(projectRoot, payload) {
  const filePath = partyModeCurrentSessionStatePath(projectRoot);
  const previous = readPartyModeCurrentSessionState(projectRoot) || {};
  const previousForMerge =
    payload &&
    typeof payload.session_key === 'string' &&
    payload.session_key.trim() &&
    previous.session_key &&
    previous.session_key !== payload.session_key
      ? omitStaleDerivedFields(previous)
      : previous;
  const next = {
    ...previousForMerge,
    ...payload,
    session_log_path: payload.session_log_path
      ? normalizePath(payload.session_log_path)
      : previousForMerge.session_log_path,
    snapshot_path: payload.snapshot_path
      ? normalizePath(payload.snapshot_path)
      : previousForMerge.snapshot_path,
    convergence_record_path: payload.convergence_record_path
      ? normalizePath(payload.convergence_record_path)
      : previousForMerge.convergence_record_path,
    audit_verdict_path: payload.audit_verdict_path
      ? normalizePath(payload.audit_verdict_path)
      : previousForMerge.audit_verdict_path,
    visible_output_capture_path: payload.visible_output_capture_path
      ? normalizePath(payload.visible_output_capture_path)
      : previousForMerge.visible_output_capture_path,
    sidecar_started_path: payload.sidecar_started_path
      ? normalizePath(payload.sidecar_started_path)
      : previousForMerge.sidecar_started_path,
    sidecar_progress_path: payload.sidecar_progress_path
      ? normalizePath(payload.sidecar_progress_path)
      : previousForMerge.sidecar_progress_path,
    sidecar_final_path: payload.sidecar_final_path
      ? normalizePath(payload.sidecar_final_path)
      : previousForMerge.sidecar_final_path,
    recorded_at: new Date().toISOString(),
  };
  writeJson(filePath, next);
  return next;
}

module.exports = {
  derivePartyModeFinalSidecarPath,
  derivePartyModeLaunchCapturePath,
  derivePartyModeProgressSidecarPath,
  derivePartyModeSidecarDir,
  derivePartyModeStartedSidecarPath,
  derivePartyModeVisibleOutputCapturePath,
  partyModeCurrentSessionStatePath,
  readPartyModeSidecar,
  readPartyModeCurrentSessionState,
  writePartyModeSidecar,
  writePartyModeCurrentSessionState,
};
