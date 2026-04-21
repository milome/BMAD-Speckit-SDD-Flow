#!/usr/bin/env node
// SubagentStart hook: initialize milestone tracking file and inject context
'use strict';

const fs = require('fs');
const path = require('path');

function readStdin() {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => { data += chunk; });
    process.stdin.on('end', () => {
      try { resolve(JSON.parse(data)); } catch { resolve(null); }
    });
    process.stdin.on('error', reject);
  });
}

function shouldSkipMilestoneTracking(agentType) {
  return String(agentType || '').trim() === 'party-mode-facilitator';
}

async function main() {
  const input = await readStdin();
  if (!input) {
    process.exit(0);
  }

  const agentId = input.agent_id || 'unknown';
  const agentType = input.agent_type || 'unknown';
  const projectDir = input.cwd || process.cwd();

  if (shouldSkipMilestoneTracking(agentType)) {
    process.stdout.write(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'SubagentStart',
          additionalContext: '',
        },
      })
    );
    return;
  }

  const milestoneDir = path.join(projectDir, '.claude', 'state', 'milestones');
  const milestoneFile = path.join(milestoneDir, `${agentId}.jsonl`);

  fs.mkdirSync(milestoneDir, { recursive: true });

  const startEntry = JSON.stringify({
    ts: new Date().toISOString(),
    event: 'agent_start',
    agent_id: agentId,
    agent_type: agentType,
  });
  fs.writeFileSync(milestoneFile, startEntry + '\n');

  const ctx = [
    `MILESTONE TRACKING ACTIVE: agent_id=${agentId}`,
    `At each major phase transition, append a line to ${milestoneFile}`,
    'Format: {"ts":"<ISO>","event":"<name>","detail":"<brief>"}',
    'Events to track: phase_start, phase_complete, tdd_red, tdd_green, tdd_refactor, test_result, error, handoff',
    'Use Bash tool: echo \'{"ts":"...","event":"...","detail":"..."}\' >> <path>',
  ].join('\n');

  const output = JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'SubagentStart',
      additionalContext: ctx,
    },
  });
  process.stdout.write(output);
}

main().catch(() => process.exit(0));
