#!/usr/bin/env node
// PreToolUse hook (matcher: Agent): Display CLI calling summary before subagent launch
'use strict';

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

async function main() {
  const input = await readStdin();
  if (!input || input.tool_name !== 'Agent') {
    process.exit(0);
  }

  const ti = input.tool_input || {};
  const desc = ti.description || '(no description)';
  const type = ti.subagent_type || 'unknown';
  const prompt = ti.prompt || '';
  const promptLen = prompt.length;
  const preview = prompt.replace(/\s+/g, ' ').substring(0, 200);
  const ts = new Date().toLocaleTimeString('zh-CN', { hour12: false });

  const msg = [
    LINE,
    `Agent 调用摘要  ${ts}`,
    LINE,
    `描述:     ${desc}`,
    `类型:     ${type}`,
    `提示词:   ${promptLen} chars`,
    `预览:     ${preview}${promptLen > 200 ? '...' : ''}`,
    LINE,
  ].join('\n');

  // stderr → displayed to user in terminal
  process.stderr.write(msg + '\n');
  // stdout → systemMessage for model context + approve decision
  process.stdout.write(JSON.stringify({ systemMessage: msg }));
}

main().catch(() => process.exit(0));
