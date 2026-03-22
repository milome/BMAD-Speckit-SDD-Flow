#!/usr/bin/env node
/**
 * PreToolUse (Agent) + SubagentStart: run emit-runtime-policy-cli, inject JSON block.
 * Failure: stderr + stdout JSON (error text only) + exit 1 — no fake policy.
 * --subagent-start: SubagentStart envelope (additionalContext).
 * --cursor-host: skip Agent tool_name gate (Cursor / tests).
 */
'use strict';

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

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

function emitCliPath(root) {
  const deployed = path.join(root, '.claude', 'hooks', 'emit-runtime-policy-cli.js');
  if (fs.existsSync(deployed)) return deployed;
  const cursorDeployed = path.join(root, '.cursor', 'hooks', 'emit-runtime-policy-cli.js');
  if (fs.existsSync(cursorDeployed)) return cursorDeployed;
  return path.join(__dirname, 'emit-runtime-policy-cli.js');
}

function runEmit(root) {
  const script = emitCliPath(root);
  return spawnSync(process.execPath, [script], {
    cwd: root,
    encoding: 'utf8',
    env: {
      ...process.env,
      CLAUDE_PROJECT_DIR: root,
      CURSOR_PROJECT_ROOT: root,
      BMAD_RUNTIME_CWD: root,
    },
    maxBuffer: 10 * 1024 * 1024,
  });
}

function outDisabled(mode) {
  const line = 'Runtime governance policy inject is OFF (BMAD_POLICY_INJECT=0).\n';
  if (mode === 'subagent') {
    process.stdout.write(
      JSON.stringify({
        hookSpecificOutput: { hookEventName: 'SubagentStart', additionalContext: line },
      })
    );
  } else {
    process.stdout.write(JSON.stringify({ systemMessage: line }));
  }
}

async function main() {
  const mode = process.argv.includes('--subagent-start') ? 'subagent' : 'pretooluse';
  const cursorHost = process.argv.includes('--cursor-host');

  if (process.env.BMAD_POLICY_INJECT === '0') {
    outDisabled(mode);
    process.exit(0);
    return;
  }

  const input = await readStdin();

  if (mode === 'pretooluse' && !cursorHost) {
    if (!input || input.tool_name !== 'Agent') {
      process.exit(0);
      return;
    }
  }

  const root = path.resolve(
    process.env.CLAUDE_PROJECT_DIR ||
      (input && input.cwd) ||
      process.env.CURSOR_PROJECT_ROOT ||
      process.cwd()
  );

  if (cursorHost && !fs.existsSync(path.join(root, '_bmad'))) {
    process.stdout.write(JSON.stringify({ systemMessage: '' }));
    process.exit(0);
    return;
  }

  const res = runEmit(root);
  if (res.status !== 0) {
    const errText = ['[emit-runtime-policy FAILED]', res.stderr || '', res.stdout || '']
      .filter(Boolean)
      .join('\n');
    if (process.env.BMAD_HOOKS_QUIET !== '1') {
      process.stderr.write(`${errText}\n`);
    }
    if (mode === 'subagent') {
      process.stdout.write(
        JSON.stringify({
          hookSpecificOutput: {
            hookEventName: 'SubagentStart',
            additionalContext: errText,
          },
        })
      );
    } else {
      process.stdout.write(JSON.stringify({ systemMessage: errText }));
    }
    process.exit(1);
    return;
  }

  const json = (res.stdout || '').trim();
  const block = `本回合 Runtime Governance（JSON）：\n${json}\n`;
  if (mode === 'subagent') {
    process.stdout.write(
      JSON.stringify({
        hookSpecificOutput: { hookEventName: 'SubagentStart', additionalContext: block },
      })
    );
  } else {
    process.stdout.write(JSON.stringify({ systemMessage: block }));
  }
}

main().catch((e) => {
  process.stderr.write(`${e && e.message ? e.message : e}\n`);
  process.exit(1);
});
