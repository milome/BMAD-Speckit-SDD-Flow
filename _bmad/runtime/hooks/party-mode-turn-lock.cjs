#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_TTL_MS = 5 * 60 * 1000;

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

function resolveProjectRoot(input) {
  if (typeof process.env.CLAUDE_PROJECT_DIR === 'string' && process.env.CLAUDE_PROJECT_DIR.trim()) {
    return path.resolve(process.env.CLAUDE_PROJECT_DIR.trim());
  }
  if (input && typeof input.cwd === 'string' && input.cwd.trim()) {
    return path.resolve(input.cwd.trim());
  }
  return process.cwd();
}

function partyModeTurnLockPath(projectRoot) {
  return path.join(projectRoot, '.claude', 'state', 'runtime', 'party-mode-turn-lock.json');
}

function clearPartyModeTurnLock(projectRoot) {
  const filePath = partyModeTurnLockPath(projectRoot);
  try {
    fs.unlinkSync(filePath);
  } catch {
    // ignore
  }
}

function readActivePartyModeTurnLock(projectRoot, now = Date.now()) {
  const filePath = partyModeTurnLockPath(projectRoot);
  if (!fs.existsSync(filePath)) {
    return null;
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const expiresAtMs = Date.parse(parsed?.expires_at || '');
    if (!Number.isFinite(expiresAtMs) || expiresAtMs <= now) {
      clearPartyModeTurnLock(projectRoot);
      return null;
    }
    return parsed;
  } catch {
    clearPartyModeTurnLock(projectRoot);
    return null;
  }
}

function writePartyModeTurnLock(projectRoot, payload) {
  const ttlMs =
    Number.isInteger(payload?.ttl_ms) && payload.ttl_ms > 0 ? payload.ttl_ms : DEFAULT_TTL_MS;
  const filePath = partyModeTurnLockPath(projectRoot);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const now = new Date();
  const record = {
    created_at: now.toISOString(),
    expires_at: new Date(now.getTime() + ttlMs).toISOString(),
    reason: typeof payload?.reason === 'string' ? payload.reason : 'party-mode hard stop',
    system_message:
      typeof payload?.system_message === 'string' ? payload.system_message : '',
    source_tool: typeof payload?.source_tool === 'string' ? payload.source_tool : 'Agent',
    blocked_topic: typeof payload?.blocked_topic === 'string' ? payload.blocked_topic : '',
  };
  fs.writeFileSync(filePath, `${JSON.stringify(record, null, 2)}\n`, 'utf8');
  return record;
}

function buildTurnLockSystemMessage(lock, input) {
  const toolName = typeof input?.tool_name === 'string' ? input.tool_name : 'unknown';
  return [
    'Previous party-mode launch was already fail-closed in this assistant turn.',
    `Blocked follow-up tool: \`${toolName}\``,
    `Stop Reason: ${lock.reason || '(none)'}`,
    'Do not continue this party-mode request in the main thread with Read / Bash / Skill / Write tools.',
    'Wait for the next user turn, then either ask for the required intensity / route or re-issue the correct facilitator call.',
  ].join('\n');
}

async function main() {
  const input = await readStdin();
  const projectRoot = resolveProjectRoot(input);
  const lock = readActivePartyModeTurnLock(projectRoot);
  if (!lock) {
    process.stdout.write(JSON.stringify({ systemMessage: '' }));
    return;
  }
  process.stdout.write(
    JSON.stringify({
      continue: false,
      stopReason: lock.reason,
      systemMessage: buildTurnLockSystemMessage(lock, input),
    })
  );
}

if (require.main === module) {
  main().catch(() => process.exit(0));
}

module.exports = {
  DEFAULT_TTL_MS,
  buildTurnLockSystemMessage,
  clearPartyModeTurnLock,
  main,
  partyModeTurnLockPath,
  readActivePartyModeTurnLock,
  resolveProjectRoot,
  writePartyModeTurnLock,
};
