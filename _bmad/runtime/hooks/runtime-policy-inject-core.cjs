#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { shouldSkipRuntimePolicy } = require('./should-skip-runtime-policy.cjs');
const { buildRuntimeErrorMessage } = require('./build-runtime-error-message.cjs');
const { runEmitRuntimePolicy } = require('./run-emit-runtime-policy.cjs');
const { loadHookMessages } = require('./hook-load-messages.cjs');
const {
  resolveRuntimeStepState,
  persistRuntimeStepState,
} = require('./runtime-step-state.cjs');
const {
  bootstrapSession,
  extractSubagentText,
  isPartyModeFacilitatorStart,
} = require('./party-mode-session-runtime.cjs');

function readStdin() {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => {
      data += chunk;
    });
    process.stdin.on('end', () => {
      try {
        resolve(JSON.parse(data));
      } catch {
        resolve(null);
      }
    });
    process.stdin.on('error', reject);
  });
}

function isRecord(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function readInputPath(input, candidates) {
  for (const candidate of candidates) {
    let current = input;
    let ok = true;
    for (const part of candidate) {
      if (!isRecord(current) || !(part in current)) {
        ok = false;
        break;
      }
      current = current[part];
    }
    if (ok && current !== undefined) {
      return current;
    }
  }
  return undefined;
}

function parseOptionalPositiveInt(value, field) {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Invalid ${field}: ${value}`);
  }
  return parsed;
}

/**
 * Prefer package resolution from project root, then init-deployed copies next to hooks.
 * @param {string} projectRoot
 * @returns {string | null}
 */
function resolveResolveSessionCjs(projectRoot) {
  try {
    const resolved = require.resolve('@bmad-speckit/runtime-emit/dist/resolve-for-session.cjs', {
      paths: [projectRoot],
    });
    if (resolved && fs.existsSync(resolved)) return resolved;
  } catch {
    /* continue */
  }
  const direct = path.join(
    projectRoot,
    'node_modules',
    '@bmad-speckit',
    'runtime-emit',
    'dist',
    'resolve-for-session.cjs'
  );
  if (fs.existsSync(direct)) return direct;
  const nestedBundled = path.join(
    projectRoot,
    'node_modules',
    'bmad-speckit',
    'node_modules',
    '@bmad-speckit',
    'runtime-emit',
    'dist',
    'resolve-for-session.cjs'
  );
  if (fs.existsSync(nestedBundled)) return nestedBundled;
  for (const rel of ['.cursor/hooks', '.claude/hooks']) {
    const adj = path.join(projectRoot, rel, 'resolve-for-session.cjs');
    if (fs.existsSync(adj)) return adj;
  }
  return null;
}

/**
 * @param {'pretooluse' | 'subagent' | 'session'} hookMode
 */
function extractUserMessage(input, hookMode) {
  if (!input || typeof input !== 'object') return '';
  if (hookMode === 'subagent') {
    return String(input.task || input.prompt || input.user_message || '').trim();
  }
  if (hookMode === 'session') {
    return String(
      input.initial_user_message ||
        input.user_message ||
        input.message ||
        input.agent_message ||
        ''
    ).trim();
  }
  const ti = input.tool_input;
  if (ti && typeof ti === 'object') {
    const pr = ti.prompt;
    if (typeof pr === 'string' && pr.trim()) return pr.trim();
  }
  if (typeof input.agent_message === 'string' && input.agent_message.trim()) {
    return input.agent_message.trim();
  }
  return '';
}

function extractResolvedMode(langStdout) {
  try {
    const parsed = JSON.parse((langStdout || '').trim());
    const mode = parsed?.resolvedMode;
    if (mode === 'zh' || mode === 'en' || mode === 'bilingual') {
      return mode;
    }
  } catch {
    /* noop */
  }
  return undefined;
}

function extractPartyModeBootstrapOptions(input, inputText, resolvedMode) {
  return {
    sessionKey: readInputPath(input, [
      ['sessionKey'],
      ['session_key'],
      ['partyModeBatch', 'sessionKey'],
      ['party_mode_batch', 'session_key'],
      ['partyModeSession', 'sessionKey'],
      ['party_mode_session', 'session_key'],
    ]),
    gateProfileId: readInputPath(input, [
      ['gateProfileId'],
      ['gate_profile_id'],
      ['partyModeBatch', 'gateProfileId'],
      ['party_mode_batch', 'gate_profile_id'],
      ['partyModeSession', 'gateProfileId'],
      ['party_mode_session', 'gate_profile_id'],
    ]),
    batchIndex: parseOptionalPositiveInt(
      readInputPath(input, [
        ['batchIndex'],
        ['batch_index'],
        ['partyModeBatch', 'batchIndex'],
        ['party_mode_batch', 'batch_index'],
      ]),
      'batch_index'
    ),
    batchStartRound: parseOptionalPositiveInt(
      readInputPath(input, [
        ['batchStartRound'],
        ['batch_start_round'],
        ['partyModeBatch', 'batchStartRound'],
        ['party_mode_batch', 'batch_start_round'],
      ]),
      'batch_start_round'
    ),
    batchTargetRound: parseOptionalPositiveInt(
      readInputPath(input, [
        ['batchTargetRound'],
        ['batch_target_round'],
        ['partyModeBatch', 'batchTargetRound'],
        ['party_mode_batch', 'batch_target_round'],
      ]),
      'batch_target_round'
    ),
    targetRoundsTotal: parseOptionalPositiveInt(
      readInputPath(input, [
        ['targetRoundsTotal'],
        ['target_rounds_total'],
        ['partyModeBatch', 'targetRoundsTotal'],
        ['party_mode_batch', 'target_rounds_total'],
      ]),
      'target_rounds_total'
    ),
    checkpointWindowMs: parseOptionalPositiveInt(
      readInputPath(input, [
        ['checkpointWindowMs'],
        ['checkpoint_window_ms'],
        ['partyModeBatch', 'checkpointWindowMs'],
        ['party_mode_batch', 'checkpoint_window_ms'],
      ]),
      'checkpoint_window_ms'
    ),
    topic:
      readInputPath(input, [
        ['topic'],
        ['partyModeBatch', 'topic'],
        ['party_mode_batch', 'topic'],
      ]) || inputText,
    resolvedMode:
      readInputPath(input, [
        ['resolvedMode'],
        ['resolved_mode'],
        ['partyModeBatch', 'resolvedMode'],
        ['party_mode_batch', 'resolved_mode'],
      ]) || resolvedMode,
  };
}

function runResolveLanguagePolicyCli(root, userMessage, writeContext) {
  const cjsPath = resolveResolveSessionCjs(root);
  if (!cjsPath) {
    return {
      status: 1,
      stdout: '',
      stderr:
        'runtime-policy-inject: resolve-for-session.cjs not found (node_modules/@bmad-speckit/runtime-emit/dist or .cursor/.claude hooks). Run: npm install, npm run build:runtime-emit (in BMAD monorepo), then npx bmad-speckit init to deploy hook bundles.',
    };
  }
  const payload = JSON.stringify({
    projectRoot: root,
    userMessage,
    recentMessages: [],
    writeContext: Boolean(writeContext),
  });
  return spawnSync(process.execPath, [cjsPath], {
    cwd: root,
    input: payload,
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
    env: {
      ...process.env,
      CLAUDE_PROJECT_DIR: root,
      CURSOR_PROJECT_ROOT: root,
    },
  });
}

function buildPartyModeBootstrapBlock(projectRoot, hookMode, input, resolvedMode) {
  if (hookMode !== 'subagent' || !isPartyModeFacilitatorStart(input)) {
    return '';
  }
  const inputText = extractSubagentText(input);
  const bootstrap = bootstrapSession(projectRoot, {
    inputText,
    ...extractPartyModeBootstrapOptions(input, inputText, resolvedMode),
  });
  return `Party Mode Session Bootstrap (JSON):\n${JSON.stringify(
    {
      session_key: bootstrap.sessionKey,
      gate_profile_id: bootstrap.meta.gate_profile_id,
      closure_level: bootstrap.meta.closure_level,
      batch_index: bootstrap.meta.current_batch_index,
      batch_start_round: bootstrap.meta.current_batch_start_round,
      batch_target_round: bootstrap.meta.current_batch_target_round,
      target_rounds_total: bootstrap.meta.target_rounds_total,
      checkpoint_window_ms: bootstrap.meta.checkpoint_window_ms,
      current_batch_status: bootstrap.meta.current_batch_status,
      topic: bootstrap.meta.topic,
      resolved_mode: bootstrap.meta.resolved_mode,
      designated_challenger_id: bootstrap.meta.designated_challenger_id,
      agent_turn_event_source_mode: bootstrap.meta.agent_turn_event_source_mode,
      host_native_agent_turn_supported: bootstrap.meta.host_native_agent_turn_supported,
      host_native_agent_turn_reason: bootstrap.meta.host_native_agent_turn_reason,
      session_log_path: bootstrap.meta.session_log_path,
      snapshot_path: bootstrap.meta.snapshot_path,
      convergence_record_path: bootstrap.meta.convergence_record_path,
      audit_verdict_path: bootstrap.meta.audit_verdict_path,
      checkpoint_json_path: bootstrap.paths.currentBatchCheckpointJsonPath,
      checkpoint_markdown_path: bootstrap.paths.currentBatchCheckpointMarkdownPath,
      checkpoint_receipt_path: bootstrap.paths.currentBatchReceiptPath,
      event_writer_command:
        `node {project-root}/_bmad/runtime/hooks/party-mode-session-event.cjs ` +
        `--project-root "{project-root}" --session-key "${bootstrap.sessionKey}" ` +
        `--round-index <n> --speaker-id <agent_id> --counts-toward-ratio true|false --has-new-gap true|false`,
    },
    null,
    2
  )}\n`;
}

function mergeGovernanceWithLanguage(govJsonLine, langStdout) {
  let govObj;
  try {
    govObj = JSON.parse((govJsonLine || '').trim());
  } catch {
    return govJsonLine;
  }
  let langObj;
  try {
    langObj = JSON.parse((langStdout || '').trim());
  } catch {
    return JSON.stringify(govObj, null, 2);
  }
  if (!langObj || typeof langObj !== 'object') {
    return JSON.stringify(govObj, null, 2);
  }
  return JSON.stringify({ ...govObj, languagePolicy: langObj }, null, 2);
}

async function runtimePolicyInjectCore({ host }) {
  const sessionStart = process.argv.includes('--session-start');
  const hookMode = sessionStart
    ? 'session'
    : process.argv.includes('--subagent-start')
      ? 'subagent'
      : 'pretooluse';
  const mode = process.argv.includes('--subagent-start') ? 'subagent' : 'pretooluse';
  const cursorHost = process.argv.includes('--cursor-host') || host === 'cursor';

  const input = await readStdin();

  if (hookMode === 'pretooluse' && !cursorHost) {
    if (!input || input.tool_name !== 'Agent') {
      return { exitCode: 0, output: '', stderr: '' };
    }
  }

  const root = path.resolve(
    process.env.CLAUDE_PROJECT_DIR ||
      (input && input.cwd) ||
      process.env.CURSOR_PROJECT_ROOT ||
      process.cwd()
  );

  if (cursorHost && !fs.existsSync(path.join(root, '_bmad'))) {
    return { exitCode: 0, output: JSON.stringify({ systemMessage: '' }), stderr: '' };
  }

  let stateDiag = '';
  try {
    const resolvedState = resolveRuntimeStepState(root, {
      argv: process.argv.slice(0, 2),
      env: process.env,
      hookInput: input,
    });
    persistRuntimeStepState(root, resolvedState);
  } catch (error) {
    const hint = error && error.message ? error.message : String(error);
    if (hint && process.env.BMAD_HOOKS_QUIET !== '1') {
      stateDiag = `[runtime-policy-inject] runtime step state sync skipped: ${hint}\n`;
    }
  }

  const res = runEmitRuntimePolicy(root);
  if (res.status !== 0) {
    if (shouldSkipRuntimePolicy({ cursorHost, root, res })) {
      return { exitCode: 0, output: JSON.stringify({ systemMessage: '' }), stderr: '' };
    }

    const errText = buildRuntimeErrorMessage({ stderr: res.stderr, stdout: res.stdout });
    if (mode === 'subagent') {
      return {
        exitCode: 1,
        output: JSON.stringify({
          hookSpecificOutput: {
            hookEventName: 'SubagentStart',
            additionalContext: errText,
          },
        }),
        stderr: errText,
      };
    }
    return {
      exitCode: 1,
      output: JSON.stringify({ systemMessage: errText }),
      stderr: errText,
    };
  }

  const json = (res.stdout || '').trim();
  const userMsg = extractUserMessage(input, hookMode);
  const langRes = runResolveLanguagePolicyCli(root, userMsg, true);
  const resolvedMode = langRes.status === 0 ? extractResolvedMode(langRes.stdout) : undefined;
  let mergedJson = json;
  if (langRes.status === 0 && (langRes.stdout || '').trim()) {
    mergedJson = mergeGovernanceWithLanguage(json, langRes.stdout);
  }
  let langDiag = '';
  if (langRes.status !== 0) {
    const hint = (langRes.stderr || '').trim() || `resolve-for-session exit ${langRes.status}`;
    if (hint && process.env.BMAD_HOOKS_QUIET !== '1') {
      langDiag = `[runtime-policy-inject] languagePolicy merge skipped: ${hint}\n`;
    }
  }
  const stderr = `${stateDiag}${langDiag}`;

  const rg = loadHookMessages(__dirname).runtimeGovernance || {};
  const prefix = rg.jsonBlockPrefix || '本回合 Runtime Governance（JSON）：';
  const bootstrapBlock = buildPartyModeBootstrapBlock(root, hookMode, input, resolvedMode);
  const block = `${prefix}\n${mergedJson}\n${bootstrapBlock}`;
  if (mode === 'subagent') {
    return {
      exitCode: 0,
      output: JSON.stringify({
        hookSpecificOutput: { hookEventName: 'SubagentStart', additionalContext: block },
      }),
      stderr,
    };
  }
  return { exitCode: 0, output: JSON.stringify({ systemMessage: block }), stderr };
}

module.exports = { runtimePolicyInjectCore };
