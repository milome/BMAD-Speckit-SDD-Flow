#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { shouldSkipRuntimePolicy } = require('./should-skip-runtime-policy');
const { buildRuntimeErrorMessage } = require('./build-runtime-error-message');
const { runEmitRuntimePolicy } = require('./run-emit-runtime-policy');

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

function outDisabled(mode) {
  const line = 'Runtime governance policy inject is OFF (BMAD_POLICY_INJECT=0).\n';
  if (mode === 'subagent') {
    return JSON.stringify({
      hookSpecificOutput: { hookEventName: 'SubagentStart', additionalContext: line },
    });
  }
  return JSON.stringify({ systemMessage: line });
}

async function runtimePolicyInjectCore({ host }) {
  const mode = process.argv.includes('--subagent-start') ? 'subagent' : 'pretooluse';
  const cursorHost = process.argv.includes('--cursor-host') || host === 'cursor';

  if (process.env.BMAD_POLICY_INJECT === '0') {
    return { exitCode: 0, output: outDisabled(mode), stderr: '' };
  }

  const input = await readStdin();

  if (mode === 'pretooluse' && !cursorHost) {
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
  const block = `本回合 Runtime Governance（JSON）：\n${json}\n`;
  if (mode === 'subagent') {
    return {
      exitCode: 0,
      output: JSON.stringify({
        hookSpecificOutput: { hookEventName: 'SubagentStart', additionalContext: block },
      }),
      stderr: '',
    };
  }
  return { exitCode: 0, output: JSON.stringify({ systemMessage: block }), stderr: '' };
}

module.exports = { runtimePolicyInjectCore };
