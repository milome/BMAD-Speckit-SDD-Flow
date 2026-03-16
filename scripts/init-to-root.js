#!/usr/bin/env node
/**
 * Init-to-root: 将 _bmad、_bmad-output 部署到项目根，再按 agent 从 _bmad/ 同步到运行时目录。
 *
 * 源路径约定：_bmad/ 是唯一内容源。
 *   - 共享 commands: _bmad/commands/
 *   - Cursor rules/skills: _bmad/cursor/
 *   - Claude agents/skills/hooks/rules: _bmad/claude/
 *
 * 用途：部署 BMAD 目录结构；--full 时包含 config、templates、workflows。
 *
 * CLI 参数：[targetDir], --full, --agent cursor|claude-code
 *
 * 示例：node scripts/init-to-root.js
 *
 * 退出码：0=成功
 */
const fs = require('node:fs');
const path = require('node:path');

const PKG_ROOT = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const fullMode = args.includes('--full');
const agentArgIndex = args.findIndex((a) => a === '--agent');
let requestedAgentTarget =
  agentArgIndex >= 0 && args[agentArgIndex + 1] ? args[agentArgIndex + 1] : null;

if (!requestedAgentTarget) {
  try {
    const configPath = path.join(PKG_ROOT, '_bmad-output', 'config', 'bmad-speckit.json');
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      requestedAgentTarget = config.selectedAI || 'cursor';
    }
  } catch { /* ignore */ }
  if (!requestedAgentTarget) requestedAgentTarget = 'cursor';
}
const REGISTERED_AGENT_PROFILES = {
  cursor: {
    runtimeRoot: '.cursor',
    sync(targetDir) {
      const bmadRoot = path.join(targetDir, '_bmad');
      const cursorSync = [
        { src: path.join(bmadRoot, 'commands'), dest: '.cursor/commands' },
        { src: path.join(bmadRoot, 'cursor', 'rules'), dest: '.cursor/rules' },
        { src: path.join(bmadRoot, 'cursor', 'skills'), dest: '.cursor/skills' },
      ];
      let totalFiles = 0;
      for (const { src, dest } of cursorSync) {
        const destPath = path.join(targetDir, dest);
        if (fs.existsSync(src)) {
          console.log('Sync', path.relative(targetDir, src), '->', dest);
          copyRecursive(src, destPath);
          totalFiles += countFiles(destPath);
        }
      }
      const crSrc = path.join(targetDir, 'config', 'code-reviewer-config.yaml');
      const crDest = path.join(targetDir, '.cursor', 'agents', 'code-reviewer-config.yaml');
      if (fs.existsSync(crSrc)) {
        fs.mkdirSync(path.dirname(crDest), { recursive: true });
        fs.copyFileSync(crSrc, crDest);
        console.log('Sync config/code-reviewer-config.yaml -> .cursor/agents/');
        totalFiles += 1;
      }
      return totalFiles;
    },
  },
  'claude-code': {
    runtimeRoot: '.claude',
    sync(targetDir) {
      const bmadRoot = path.join(targetDir, '_bmad');
      const claudeSync = [
        { src: path.join(bmadRoot, 'commands'), dest: '.claude/commands' },
        { src: path.join(bmadRoot, 'claude', 'rules'), dest: '.claude/rules' },
        { src: path.join(bmadRoot, 'claude', 'agents'), dest: '.claude/agents' },
        { src: path.join(bmadRoot, 'claude', 'skills'), dest: '.claude/skills' },
        { src: path.join(bmadRoot, 'claude', 'state'), dest: '.claude/state' },
        { src: path.join(bmadRoot, 'claude', 'hooks'), dest: '.claude/hooks' },
        { src: path.join(bmadRoot, 'claude', 'protocols'), dest: '.claude/protocols' },
      ];
      let totalFiles = 0;
      for (const { src, dest } of claudeSync) {
        const destPath = path.join(targetDir, dest);
        if (fs.existsSync(src)) {
          console.log('Sync', path.relative(targetDir, src), '->', dest);
          copyRecursive(src, destPath);
          totalFiles += countFiles(destPath);
        } else {
          fs.mkdirSync(destPath, { recursive: true });
        }
      }
      const settingsSrc = path.join(bmadRoot, 'claude', 'settings.json');
      const settingsDest = path.join(targetDir, '.claude', 'settings.json');
      if (fs.existsSync(settingsSrc)) {
        fs.mkdirSync(path.dirname(settingsDest), { recursive: true });
        fs.copyFileSync(settingsSrc, settingsDest);
        console.log('Sync _bmad/claude/settings.json -> .claude/settings.json');
        totalFiles += 1;
      }
      const templateSrc = path.join(bmadRoot, 'claude', 'CLAUDE.md.template');
      const claudeMdDest = path.join(targetDir, 'CLAUDE.md');
      if (fs.existsSync(templateSrc) && !fs.existsSync(claudeMdDest)) {
        let content = fs.readFileSync(templateSrc, 'utf8');
        content = content.replace(/\{\{PROJECT_NAME\}\}/g, path.basename(targetDir));
        fs.writeFileSync(claudeMdDest, content, 'utf8');
        console.log('Generated CLAUDE.md from template');
        totalFiles += 1;
      }
      return totalFiles;
    },
  },
};
const AGENT_ID_ALIASES = {
  'cursor-agent': 'cursor',
  'claude': 'claude-code',
};
const normalizedAgent = AGENT_ID_ALIASES[requestedAgentTarget] || requestedAgentTarget;
const agentProfile = REGISTERED_AGENT_PROFILES[normalizedAgent];
if (!agentProfile) {
  const validKeys = [...Object.keys(REGISTERED_AGENT_PROFILES), ...Object.keys(AGENT_ID_ALIASES)];
  console.error(`Unsupported --agent value: ${requestedAgentTarget}. Valid: ${validKeys.join(', ')}`);
  process.exit(1);
}
const agentTarget = normalizedAgent;
const targetArg = args.find(
  (a, index) => a !== '--full' && a !== '--agent' && index !== agentArgIndex + 1
);
const TARGET = targetArg ? path.resolve(targetArg) : process.cwd();

const CORE_DIRS = ['_bmad', '_bmad-output'];
const FULL_DIRS = [
  '_bmad',
  '_bmad-output',
  'config',
  'templates',
  'workflows',
];
const DIRS = fullMode ? FULL_DIRS : CORE_DIRS;

function copyRecursive(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    for (const name of fs.readdirSync(src)) {
      copyRecursive(path.join(src, name), path.join(dest, name));
    }
  } else {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }
}

function countFiles(dirPath) {
  if (!fs.existsSync(dirPath)) return 0;
  let n = 0;
  for (const name of fs.readdirSync(dirPath)) {
    const p = path.join(dirPath, name);
    n += fs.statSync(p).isDirectory() ? countFiles(p) : 1;
  }
  return n;
}

console.log(
  'BMAD-Speckit-SDD-Flow init: deploy to',
  TARGET,
  fullMode ? '(full mode)' : '',
  `[agent=${agentTarget}]`
);
let totalFiles = 0;
for (const dir of DIRS) {
  const src = path.join(PKG_ROOT, dir);
  const dest = path.join(TARGET, dir);
  if (!fs.existsSync(src)) {
    console.warn('Skip (missing):', dir);
    continue;
  }
  console.log('Copy', dir, '->', dest);
  if (fs.existsSync(dest)) {
    console.warn('Target exists, merging:', dest);
  }
  copyRecursive(src, dest);
  totalFiles += countFiles(dest);
}

totalFiles += agentProfile.sync(TARGET, PKG_ROOT);

console.log('Done. Copied', DIRS.length, 'dirs,', totalFiles, 'files.');
console.log('Verify with: _bmad/scripts/bmad-speckit/powershell/check-prerequisites.ps1');
