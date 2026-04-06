#!/usr/bin/env node
// WorktreeCreate hook: create worktrees in sibling directory instead of .claude/worktrees/
// Naming: {parent}/{repo}-{NN}-{name}/
'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

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

function findNextIndex(parentDir, repoName) {
  if (!fs.existsSync(parentDir)) return 1;
  const prefix = `${repoName}-`;
  const entries = fs.readdirSync(parentDir).filter(e => {
    if (!e.startsWith(prefix)) return false;
    const rest = e.slice(prefix.length);
    const idx = parseInt(rest.split('-')[0], 10);
    return !isNaN(idx);
  });

  let maxIdx = 0;
  for (const e of entries) {
    const rest = e.slice(prefix.length);
    const idx = parseInt(rest.split('-')[0], 10);
    if (idx > maxIdx) maxIdx = idx;
  }
  return maxIdx + 1;
}

async function main() {
  const input = await readStdin();
  if (!input) {
    process.stderr.write('WorktreeCreate hook: no input received\n');
    process.exit(1);
  }

  const wtName = input.name || `wt-${Date.now()}`;
  const projectDir = input.cwd || process.cwd();

  const parentDir = path.dirname(projectDir);
  const repoName = path.basename(projectDir);
  const nextIdx = findNextIndex(parentDir, repoName);
  const paddedIdx = String(nextIdx).padStart(2, '0');
  const dirName = `${repoName}-${paddedIdx}-${wtName}`;
  const wtPath = path.join(parentDir, dirName);
  const branchName = `worktree-${wtName}`;

  try {
    execSync(
      `git worktree add "${wtPath}" -b "${branchName}"`,
      { cwd: projectDir, stdio: ['pipe', 'pipe', 'pipe'] }
    );
  } catch (err) {
    // Branch may already exist; try without -b
    try {
      execSync(
        `git worktree add "${wtPath}"`,
        { cwd: projectDir, stdio: ['pipe', 'pipe', 'pipe'] }
      );
    } catch (err2) {
      process.stderr.write(`WorktreeCreate hook failed: ${err2.message}\n`);
      process.exit(1);
    }
  }

  // Print absolute path — this is what Claude Code uses as the working directory
  const absPath = path.resolve(wtPath);
  process.stdout.write(absPath);
}

main().catch(err => {
  process.stderr.write(`WorktreeCreate hook error: ${err.message}\n`);
  process.exit(1);
});
