#!/usr/bin/env node
'use strict';

const path = require('node:path');
const {
  appendTurn,
} = require('./party-mode-session-runtime.cjs');

function parseBoolean(value) {
  return value === 'true' || value === true;
}

function parseArgs(argv) {
  const out = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1];
    switch (token) {
      case '--project-root':
        out.projectRoot = next;
        index += 1;
        break;
      case '--session-key':
        out.sessionKey = next;
        index += 1;
        break;
      case '--round-index':
        out.roundIndex = Number(next);
        index += 1;
        break;
      case '--speaker-id':
        out.speakerId = next;
        index += 1;
        break;
      case '--designated-challenger-id':
        out.designatedChallengerId = next;
        index += 1;
        break;
      case '--counts-toward-ratio':
        out.countsTowardRatio = parseBoolean(next);
        index += 1;
        break;
      case '--has-new-gap':
        out.hasNewGap = parseBoolean(next);
        index += 1;
        break;
      case '--timestamp':
        out.timestamp = next;
        index += 1;
        break;
      default:
        throw new Error(`Unknown argument: ${token}`);
    }
  }
  return out;
}

try {
  const args = parseArgs(process.argv.slice(2));
  const projectRoot = path.resolve(args.projectRoot || process.cwd());
  if (!args.sessionKey || !Number.isFinite(args.roundIndex) || !args.speakerId) {
    throw new Error(
      'Usage: node party-mode-session-event.cjs --project-root <root> --session-key <key> --round-index <n> --speaker-id <id> [--designated-challenger-id <id>] [--counts-toward-ratio true|false] [--has-new-gap true|false] [--timestamp <iso>]'
    );
  }
  const result = appendTurn(projectRoot, {
    sessionKey: args.sessionKey,
    roundIndex: args.roundIndex,
    speakerId: args.speakerId,
    designatedChallengerId: args.designatedChallengerId,
    countsTowardRatio: args.countsTowardRatio !== false,
    hasNewGap: args.hasNewGap === true,
    timestamp: args.timestamp,
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
} catch (error) {
  process.stderr.write(`${error && error.message ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
