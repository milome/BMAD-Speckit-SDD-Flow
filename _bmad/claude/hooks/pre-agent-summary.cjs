#!/usr/bin/env node
// PreToolUse hook (matcher: Agent): Display CLI calling summary before subagent launch
// T4.5: inject manifest-rendered audit parseable block preview from runtime languagePolicy (en/zh/bilingual).
'use strict';

const { spawnSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

const { loadHookMessages, getHooksTimeLocale } = require('./hook-load-messages.cjs');

const LINE = '═'.repeat(50);

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
 * Prefer package resolution from project root, then init-deployed copies next to hooks
 * (symmetric with runtime-policy-inject-core `resolveResolveSessionCjs`).
 * @param {string} projectRoot
 * @returns {string | null}
 */
function resolveRenderAuditBlockCjs(projectRoot) {
  try {
    const resolved = require.resolve('@bmad-speckit/runtime-emit/dist/render-audit-block.cjs', {
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
    'render-audit-block.cjs'
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
    'render-audit-block.cjs'
  );
  if (fs.existsSync(nestedBundled)) return nestedBundled;
  for (const rel of ['.cursor/hooks', '.claude/hooks']) {
    const adj = path.join(projectRoot, rel, 'render-audit-block.cjs');
    if (fs.existsSync(adj)) return adj;
  }
  return null;
}

function tryRenderAuditInjectSnippet(cwd) {
  const cjsPath = resolveRenderAuditBlockCjs(cwd);
  if (!cjsPath) {
    console.warn(
      'pre-agent-summary: render-audit-block.cjs not found (node_modules/@bmad-speckit/runtime-emit/dist or .cursor/.claude hooks). Run: npm install, npm run build:runtime-emit, then npx bmad-speckit init.'
    );
    return '';
  }
  const r = spawnSync(process.execPath, [cjsPath, 'speckit.audit.spec'], {
    cwd,
    encoding: 'utf8',
    maxBuffer: 5 * 1024 * 1024,
  });
  if (r.status !== 0 || !r.stdout) {
    return '';
  }
  return r.stdout.trim();
}

function isPartyModeFacilitatorCall(toolInput) {
  if (!toolInput || typeof toolInput !== 'object') return false;
  const joined = [toolInput.subagent_type, toolInput.description, toolInput.prompt]
    .filter((value) => typeof value === 'string' && value.trim())
    .join('\n')
    .toLowerCase();
  return (
    joined.includes('party-mode-facilitator') ||
    joined.includes('party mode session bootstrap') ||
    (joined.includes('party-mode:') && joined.includes('subagent'))
  );
}

function shouldInjectAuditPreview(toolInput) {
  if (!toolInput || typeof toolInput !== 'object') return false;
  if (isPartyModeFacilitatorCall(toolInput)) return false;
  const joined = [toolInput.subagent_type, toolInput.description, toolInput.prompt]
    .filter((value) => typeof value === 'string' && value.trim())
    .join('\n')
    .toLowerCase();

  return (
    joined.includes('code-reviewer') ||
    joined.includes('auditor-') ||
    joined.includes('spec auditor') ||
    joined.includes('/agents/auditors/') ||
    joined.includes('\\agents\\auditors\\')
  );
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
  const ts = new Date().toLocaleTimeString(getHooksTimeLocale(), { hour12: false });
  const MSG = loadHookMessages(__dirname);
  const ps = MSG.preAgentSummary || {};
  const labels = ps.labels || {};

  const cwd = process.cwd();
  const auditInject = shouldInjectAuditPreview(ti) ? tryRenderAuditInjectSnippet(cwd) : '';

  const parts = [
    LINE,
    `${ps.title}  ${ts}`,
    LINE,
    `${labels.desc}     ${desc}`,
    `${labels.type}     ${type}`,
    `${labels.prompt}   ${promptLen} ${ps.charsUnit || 'chars'}`,
    `${labels.preview}     ${preview}${promptLen > 200 ? '...' : ''}`,
    LINE,
  ];
  if (auditInject) {
    parts.push('');
    parts.push(auditInject);
    parts.push(LINE);
  }

  const msg = parts.join('\n');

  if (process.env.BMAD_HOOKS_QUIET !== '1') {
    process.stderr.write(msg + '\n');
  }
  process.stdout.write(JSON.stringify({ systemMessage: msg }));
}

main().catch(() => process.exit(0));
