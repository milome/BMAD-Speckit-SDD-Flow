#!/usr/bin/env node
// SubagentStop hook: compose and display result summary from milestones + last message
'use strict';

const fs = require('fs');
const path = require('path');

const LINE = '═'.repeat(50);

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

function parseMilestones(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const lines = fs.readFileSync(filePath, 'utf8').trim().split('\n');
  const entries = [];
  for (const line of lines) {
    try { entries.push(JSON.parse(line)); } catch { /* skip malformed */ }
  }
  return entries;
}

function formatDuration(startIso, endDate) {
  const start = new Date(startIso);
  const diffMs = endDate - start;
  if (isNaN(diffMs) || diffMs < 0) return '?';
  const secs = Math.floor(diffMs / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  const remSecs = secs % 60;
  return `${mins}m ${remSecs}s`;
}

function truncate(str, maxLen) {
  if (!str) return '(empty)';
  const clean = str.replace(/\s+/g, ' ').trim();
  if (clean.length <= maxLen) return clean;
  return clean.substring(0, maxLen) + '...';
}

async function main() {
  const input = await readStdin();
  if (!input) {
    process.exit(0);
  }

  const agentId = input.agent_id || 'unknown';
  const agentType = input.agent_type || 'unknown';
  const lastMsg = input.last_assistant_message || '';
  const projectDir = input.cwd || process.cwd();
  const now = new Date();
  const ts = now.toLocaleTimeString('zh-CN', { hour12: false });

  const milestoneFile = path.join(projectDir, '.claude', 'state', 'milestones', `${agentId}.jsonl`);
  const milestones = parseMilestones(milestoneFile);

  const parts = [LINE, `Agent 完成  ${ts}`, LINE];
  parts.push(`类型: ${agentType}`);

  if (milestones.length > 0) {
    const startEntry = milestones.find(m => m.event === 'agent_start');
    if (startEntry) {
      parts.push(`耗时: ${formatDuration(startEntry.ts, now)}`);
    }

    const phaseEntries = milestones.filter(m => m.event !== 'agent_start');
    if (phaseEntries.length > 0) {
      parts.push('里程碑:');
      phaseEntries.forEach((m, i) => {
        const mTime = new Date(m.ts).toLocaleTimeString('zh-CN', { hour12: false });
        const detail = m.detail ? `: ${m.detail}` : '';
        parts.push(`  ${i + 1}. [${mTime}] ${m.event}${detail}`);
      });
    }
  } else {
    parts.push('里程碑: (子代理未写入里程碑文件)');
  }

  parts.push(`结果摘要: ${truncate(lastMsg, 500)}`);
  parts.push(LINE);

  const summary = parts.join('\n');
  // stderr → displayed to user in terminal (skip if model natively shows agent calls)
  if (process.env.BMAD_HOOKS_QUIET !== '1') {
    process.stderr.write(summary + '\n');
  }
  // stdout → systemMessage for model context (always active)
  process.stdout.write(JSON.stringify({ systemMessage: summary }));

  // Cleanup milestone file
  try { fs.unlinkSync(milestoneFile); } catch { /* ignore */ }
}

main().catch(() => process.exit(0));
