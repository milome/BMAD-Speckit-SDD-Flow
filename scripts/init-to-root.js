#!/usr/bin/env node
/**
 * Init-to-root: 将 _bmad、_bmad-output 部署到项目根，再按 agent 从 _bmad/ 同步到运行时目录。
 *
 * 源路径约定：_bmad/ 是唯一内容源。
 *   - 共享 commands: _bmad/commands/
 *   - Cursor rules/skills: _bmad/cursor/
 *   - Claude agents/skills/hooks/rules: _bmad/claude/
 *
 * 用途：部署 BMAD 目录结构。
 * speckit commands 从 _bmad/speckit/commands/ 合并；.specify/ 部署 templates/workflows/scripts。
 *
 * CLI 参数：[targetDir], --full, --agent cursor|claude-code, --no-package-json
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
const noPackageJson = args.includes('--no-package-json');
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
/**
 * Deploy .specify/ runtime directory from _bmad/speckit/ source.
 * @param {string} targetDir - Project root.
 * @returns {number} Number of files deployed.
 */
function deploySpecify(targetDir) {
  const bmadRoot = path.join(targetDir, '_bmad');
  const specifyDest = path.join(targetDir, '.specify');
  const specifySync = [
    { src: path.join(bmadRoot, 'speckit', 'templates'), dest: path.join(specifyDest, 'templates') },
    { src: path.join(bmadRoot, 'speckit', 'workflows'), dest: path.join(specifyDest, 'workflows') },
    { src: path.join(bmadRoot, 'speckit', 'scripts', 'shell'), dest: path.join(specifyDest, 'scripts') },
    { src: path.join(bmadRoot, 'speckit', 'scripts', 'powershell'), dest: path.join(specifyDest, 'scripts') },
  ];
  let totalFiles = 0;
  for (const { src, dest } of specifySync) {
    if (fs.existsSync(src)) {
      console.log('Sync', path.relative(targetDir, src), '->', path.relative(targetDir, dest));
      copyRecursive(src, dest);
      totalFiles += countFiles(dest);
    }
  }
  const cmdSrc = path.join(bmadRoot, 'speckit', 'commands');
  const cmdDest = path.join(specifyDest, 'templates', 'commands');
  if (fs.existsSync(cmdSrc)) {
    console.log('Sync', path.relative(targetDir, cmdSrc), '->', path.relative(targetDir, cmdDest), '(strip speckit. prefix)');
    copyStripPrefix(cmdSrc, cmdDest, 'speckit.');
    totalFiles += countFiles(cmdDest);
  }
  const memoryDir = path.join(specifyDest, 'memory');
  if (!fs.existsSync(memoryDir)) {
    fs.mkdirSync(memoryDir, { recursive: true });
  }
  return totalFiles;
}

/**
 * Copy directory contents, stripping a filename prefix from top-level files.
 * e.g. speckit.plan.md -> plan.md (upstream convention for .specify/templates/commands/).
 */
function copyStripPrefix(src, dest, prefix) {
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  for (const name of fs.readdirSync(src)) {
    const srcPath = path.join(src, name);
    const stat = fs.statSync(srcPath);
    if (stat.isDirectory()) {
      copyRecursive(srcPath, path.join(dest, name));
    } else {
      const destName = name.startsWith(prefix) ? name.slice(prefix.length) : name;
      fs.copyFileSync(srcPath, path.join(dest, destName));
    }
  }
}

const REGISTERED_AGENT_PROFILES = {
  cursor: {
    runtimeRoot: '.cursor',
    sync(targetDir) {
      const bmadRoot = path.join(targetDir, '_bmad');
      const cursorSync = [
        { src: path.join(bmadRoot, 'commands'), dest: '.cursor/commands' },
        { src: path.join(bmadRoot, 'speckit', 'commands'), dest: '.cursor/commands' },
        { src: path.join(bmadRoot, 'cursor', 'rules'), dest: '.cursor/rules' },
        { src: path.join(bmadRoot, 'skills'), dest: '.cursor/skills' },
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
      const crSrc = path.join(targetDir, '_bmad', '_config', 'code-reviewer-config.yaml');
      const crDest = path.join(targetDir, '.cursor', 'agents', 'code-reviewer-config.yaml');
      if (fs.existsSync(crSrc)) {
        fs.mkdirSync(path.dirname(crDest), { recursive: true });
        fs.copyFileSync(crSrc, crDest);
        console.log('Sync _bmad/_config/code-reviewer-config.yaml -> .cursor/agents/');
        totalFiles += 1;
      }
      totalFiles += deploySpecify(targetDir);
      return totalFiles;
    },
  },
  'claude-code': {
    runtimeRoot: '.claude',
    sync(targetDir) {
      const bmadRoot = path.join(targetDir, '_bmad');
      const claudeSync = [
        { src: path.join(bmadRoot, 'commands'), dest: '.claude/commands' },
        { src: path.join(bmadRoot, 'speckit', 'commands'), dest: '.claude/commands' },
        { src: path.join(bmadRoot, 'claude', 'rules'), dest: '.claude/rules' },
        { src: path.join(bmadRoot, 'claude', 'agents'), dest: '.claude/agents' },
        { src: path.join(bmadRoot, 'skills'), dest: '.claude/skills' },
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
      totalFiles += deploySpecify(targetDir);
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
  (a, index) => a !== '--full' && a !== '--no-package-json' && a !== '--agent' && index !== agentArgIndex + 1
);
// When run as postinstall (npm install in consumer), INIT_CWD = consumer root; use it as target.
const TARGET = targetArg
  ? path.resolve(targetArg)
  : (process.env.INIT_CWD && path.resolve(process.env.INIT_CWD)) || process.cwd();

const CORE_DIRS = ['_bmad'];
const FULL_DIRS = [
  '_bmad',
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
    let stat;
    try {
      stat = fs.statSync(p);
    } catch (err) {
      if (err && err.code === 'ENOENT') continue;
      throw err;
    }
    n += stat.isDirectory() ? countFiles(p) : 1;
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

// Ensure _bmad-output/config exists (empty); never copy source's _bmad-output contents.
const bmadOutputDir = path.join(TARGET, '_bmad-output');
const bmadOutputConfig = path.join(bmadOutputDir, 'config');
if (!fs.existsSync(bmadOutputConfig)) {
  fs.mkdirSync(bmadOutputConfig, { recursive: true });
  console.log('Created _bmad-output/config/ (empty structure for target project)');
}

// Ensure package.json with bmad-speckit dep when deploying to external project (not self).
// --no-package-json 标志：跳过 package.json 创建与 npm install（适用于已发布 CLI 的场景）
const targetReal = fs.realpathSync(TARGET, { encoding: 'utf8' });
const pkgRootReal = fs.realpathSync(PKG_ROOT, { encoding: 'utf8' });
if (noPackageJson) {
  console.log('Skipped package.json creation (--no-package-json)');
} else if (targetReal !== pkgRootReal) {
  const relToPkg = path.relative(TARGET, path.join(PKG_ROOT, 'packages', 'bmad-speckit'));
  const bmadSpeckitDep = 'file:' + relToPkg.replace(/\\/g, '/');
  const pkgPath = path.join(TARGET, 'package.json');
  let pkg = {};
  if (fs.existsSync(pkgPath)) {
    let raw = fs.readFileSync(pkgPath, 'utf8');
    if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1); // strip BOM
    pkg = JSON.parse(raw);
  } else {
    pkg = {
      name: path.basename(TARGET).toLowerCase().replace(/\s+/g, '-'),
      version: '0.1.0',
      private: true,
      description: 'BMAD-Speckit project',
    };
    console.log('Created package.json (minimal)');
  }
  pkg.devDependencies = pkg.devDependencies || {};
  if (!pkg.devDependencies['bmad-speckit']) {
    pkg.devDependencies['bmad-speckit'] = bmadSpeckitDep;
    pkg.scripts = pkg.scripts || {};
    if (!pkg.scripts.check) pkg.scripts.check = 'npx bmad-speckit check';
    if (!pkg.scripts.speckit) pkg.scripts.speckit = 'npx bmad-speckit';
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
    console.log('Added bmad-speckit to devDependencies');
    const { execSync } = require('node:child_process');
    try {
      execSync('npm install', { cwd: TARGET, stdio: 'inherit' });
      console.log('Ran npm install');
    } catch (e) {
      console.warn('npm install failed (run manually in target):', e.message);
    }
  }
}

console.log('Done. Copied', DIRS.length, 'dirs,', totalFiles, 'files.');
console.log('Verify with: _bmad/speckit/scripts/powershell/check-prerequisites.ps1');
