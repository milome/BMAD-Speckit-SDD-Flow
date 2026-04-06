#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { shouldSkipRuntimePolicy } = require('./should-skip-runtime-policy.cjs');
const { buildRuntimeErrorMessage } = require('./build-runtime-error-message.cjs');
const { runEmitRuntimePolicy } = require('./run-emit-runtime-policy.cjs');
const { loadHookMessages } = require('./hook-load-messages.cjs');

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

  const rg = loadHookMessages(__dirname).runtimeGovernance || {};
  const prefix = rg.jsonBlockPrefix || '本回合 Runtime Governance（JSON）：';
  const block = `${prefix}\n${mergedJson}\n`;
  if (mode === 'subagent') {
    return {
      exitCode: 0,
      output: JSON.stringify({
        hookSpecificOutput: { hookEventName: 'SubagentStart', additionalContext: block },
      }),
      stderr: langDiag,
    };
  }
  return { exitCode: 0, output: JSON.stringify({ systemMessage: block }), stderr: langDiag };
}

module.exports = { runtimePolicyInjectCore };
