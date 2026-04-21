#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

function resolveHookModule(moduleName) {
  const candidates = [
    path.join(__dirname, moduleName),
    path.join(__dirname, '..', '..', 'runtime', 'hooks', moduleName),
    path.join(__dirname, '..', '..', '_bmad', 'runtime', 'hooks', moduleName),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return require(candidate);
    }
  }
  throw new Error(`Cannot resolve ${moduleName} from known Cursor hook locations`);
}

const { loadHookMessages, getHooksTimeLocale } = resolveHookModule('hook-load-messages.cjs');
const { refreshPartyModeSessionFromToolUse } = resolveHookModule('post-tool-use-core.cjs');
const hookMessagesDir = fs.existsSync(path.join(__dirname, 'messages.zh.json'))
  ? __dirname
  : path.join(__dirname, '..', '..', 'runtime', 'hooks');

function readStdin() {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => {
      data += chunk;
    });
    process.stdin.on('end', () => {
      if (!data.trim()) {
        resolve(null);
        return;
      }
      try {
        resolve(JSON.parse(data));
      } catch {
        resolve(null);
      }
    });
    process.stdin.on('error', reject);
  });
}

function readPathCandidate(source, paths) {
  for (const pathSegments of paths) {
    let cursor = source;
    let missing = false;
    for (const segment of pathSegments) {
      if (!cursor || typeof cursor !== 'object' || !(segment in cursor)) {
        missing = true;
        break;
      }
      cursor = cursor[segment];
    }
    if (!missing && cursor !== undefined && cursor !== null) {
      return cursor;
    }
  }
  return undefined;
}

function resolveProjectRoot(event) {
  const candidate = readPathCandidate(event, [
    ['cwd'],
    ['projectRoot'],
    ['payload', 'projectRoot'],
    ['runnerInput', 'projectRoot'],
  ]);
  if (typeof candidate === 'string' && candidate.trim()) {
    return path.resolve(candidate);
  }
  return path.resolve(process.env.CURSOR_PROJECT_ROOT || process.env.CLAUDE_PROJECT_DIR || process.cwd());
}

function extractText(event) {
  const candidate = readPathCandidate(event, [
    ['last_assistant_message'],
    ['lastAssistantMessage'],
    ['assistant_message'],
    ['assistantMessage'],
    ['tool_result'],
    ['toolResult'],
    ['message'],
    ['output'],
    ['result'],
    ['payload', 'last_assistant_message'],
    ['payload', 'assistant_message'],
  ]);
  return typeof candidate === 'string' ? candidate : '';
}

function extractTranscriptPath(event) {
  const candidate = readPathCandidate(event, [
    ['transcript_path'],
    ['transcriptPath'],
    ['payload', 'transcript_path'],
    ['payload', 'transcriptPath'],
  ]);
  return typeof candidate === 'string' ? candidate : '';
}

function extractPartyModeIntent(event, text) {
  const joined = [
    readPathCandidate(event, [['agent_type'], ['agentType'], ['subagent_type'], ['subagentType']]),
    readPathCandidate(event, [['task'], ['prompt'], ['description']]),
    text,
  ]
    .filter((value) => typeof value === 'string' && value.trim())
    .join('\n')
    .toLowerCase();
  return (
    joined.includes('party-mode-facilitator') ||
    joined.includes('party mode') ||
    joined.includes('party-mode') ||
    /^### Round \d+\s*$/mu.test(text) ||
    /^## Final Gate Evidence$/gmu.test(text)
  );
}

function buildSyntheticToolUseEvent(root, event, visibleOutput) {
  return {
    cwd: root,
    tool_name: 'Task',
    tool_input: {
      executor:
        readPathCandidate(event, [
          ['agent_type'],
          ['agentType'],
          ['subagent_type'],
          ['subagentType'],
          ['executor'],
        ]) || 'party-mode-facilitator',
      description: readPathCandidate(event, [['description'], ['task'], ['prompt']]) || '',
      prompt: readPathCandidate(event, [['prompt'], ['task'], ['description']]) || '',
    },
    tool_output: visibleOutput,
    transcript_path: extractTranscriptPath(event),
  };
}

function resolveCurrentSessionHelperPath(projectRoot) {
  const candidates = [
    path.join(projectRoot, '.cursor', 'hooks', 'party-mode-read-current-session.cjs'),
    path.join(projectRoot, '_bmad', 'runtime', 'hooks', 'party-mode-read-current-session.cjs'),
    path.join(__dirname, 'party-mode-read-current-session.cjs'),
    path.join(__dirname, '..', '..', 'runtime', 'hooks', 'party-mode-read-current-session.cjs'),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) || null;
}

function readCurrentSessionSummary(projectRoot) {
  const helperPath = resolveCurrentSessionHelperPath(projectRoot);
  if (!helperPath) {
    return null;
  }
  const result = spawnSync(process.execPath, [helperPath, '--project-root', projectRoot], {
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    return null;
  }
  try {
    return JSON.parse(result.stdout || '{}');
  } catch {
    return null;
  }
}

function formatSummary(summary, event) {
  const messages = loadHookMessages(hookMessagesDir);
  const locale = getHooksTimeLocale();
  const labels = messages.subagentResult || {
    title: 'Agent finished',
    type: 'Type:',
    resultSummary: 'Result summary:',
  };
  const lines = [
    labels.title || 'Agent finished',
    `${labels.type || 'Type:'} ${
      readPathCandidate(event, [['agent_type'], ['agentType'], ['subagent_type'], ['subagentType']]) ||
      'party-mode-facilitator'
    }`,
    `${labels.resultSummary || 'Result summary:'} session=${summary.session_key || '(unknown)'}`,
    `status=${summary.status || '(unknown)'} validation=${summary.validation_status || '(unknown)'}`,
    `execution_evidence_level=${summary.execution_evidence_level || '(unknown)'}`,
  ];
  if (Number.isFinite(Number(summary.observed_visible_round_count))) {
    lines.push(`observed_visible_round_count=${Number(summary.observed_visible_round_count)}`);
  }
  if (summary.final_gate_result) {
    lines.push(`final_gate_result=${summary.final_gate_result}`);
  }
  if (summary.diagnostic_classification) {
    lines.push(`diagnostic_classification=${summary.diagnostic_classification}`);
  }
  lines.push(`generated_at=${new Date().toLocaleString(locale)}`);
  return lines.join('\n');
}

async function main() {
  const event = await readStdin();
  const projectRoot = resolveProjectRoot(event);
  const visibleOutput = extractText(event);
  if (!extractPartyModeIntent(event, visibleOutput)) {
    return;
  }
  refreshPartyModeSessionFromToolUse(buildSyntheticToolUseEvent(projectRoot, event, visibleOutput));
  const summary = readCurrentSessionSummary(projectRoot);
  if (summary) {
    process.stderr.write(`${formatSummary(summary, event)}\n`);
  }
}

main().catch((error) => {
  process.stderr.write(
    `[cursor subagentStop summary skipped] ${error && error.message ? error.message : String(error)}\n`
  );
  process.exitCode = 0;
});
