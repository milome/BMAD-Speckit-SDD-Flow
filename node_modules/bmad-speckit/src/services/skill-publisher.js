/**
 * SkillPublisher - publish skills from _bmad/skills to configTemplate.skillsDir (Story 12.3)
 * spec §3: 按 configTemplate.skillsDir 同步；bmadPath 源；~ 展开；递归复制
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const AIRegistry = require('./ai-registry');

/**
 * Expand ~ in path to os.homedir()
 */
function expandTilde(p) {
  if (!p || typeof p !== 'string') return p;
  if (p === '~' || p.startsWith('~/') || p.startsWith('~' + path.sep)) {
    const rest = p.slice(1).replace(/^[/\\]/, '') || '';
    return rest ? path.join(os.homedir(), rest) : os.homedir();
  }
  return p;
}

/**
 * Recursively copy directory, preserving structure
 * @returns {string[]} names of top-level subdirs copied
 */
function copyDirRecursive(src, dest) {
  const copied = [];
  if (!fs.existsSync(src) || !fs.statSync(src).isDirectory()) return copied;

  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const e of entries) {
    const s = path.join(src, e.name);
    const d = path.join(dest, e.name);
    if (e.isDirectory()) {
      if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
      copyDirRecursive(s, d);
      copied.push(e.name);
    } else {
      if (!fs.existsSync(path.dirname(d))) fs.mkdirSync(path.dirname(d), { recursive: true });
      fs.copyFileSync(s, d);
    }
  }
  return copied;
}

/**
 * Publish skills from source to configTemplate.skillsDir
 * @param {string} projectRoot - project root
 * @param {string} selectedAI - AI id from registry
 * @param {{ bmadPath?: string, noAiSkills?: boolean }} options
 * @returns {{ published: string[], skippedReasons: string[] }}
 */
function publish(projectRoot, selectedAI, options = {}) {
  const noAiSkills = options.noAiSkills === true || options['no-ai-skills'] === true;
  if (noAiSkills) {
    return { published: [], skippedReasons: ['用户指定 --no-ai-skills 跳过'] };
  }

  const entry = AIRegistry.getById(selectedAI, { cwd: projectRoot });
  if (!entry || !entry.configTemplate) {
    return { published: [], skippedReasons: [] };
  }

  const skillsDir = entry.configTemplate.skillsDir;
  if (!skillsDir || String(skillsDir).trim() === '') {
    return { published: [], skippedReasons: ['该 AI 不支持全局 skill'] };
  }

  let srcRoot;
  if (options.bmadPath) {
    const resolvedBmad = path.resolve(projectRoot, options.bmadPath);
    srcRoot = path.join(resolvedBmad, 'skills');
  } else {
    srcRoot = path.join(projectRoot, '_bmad', 'skills');
  }

  if (!fs.existsSync(srcRoot) || !fs.statSync(srcRoot).isDirectory()) {
    return { published: [], skippedReasons: [] };
  }

  const entries = fs.readdirSync(srcRoot, { withFileTypes: true });
  const subdirs = entries.filter((e) => e.isDirectory());
  if (subdirs.length === 0) {
    return { published: [], skippedReasons: [] };
  }

  const destRaw = expandTilde(skillsDir);
  const destFull = path.isAbsolute(destRaw) ? destRaw : path.join(projectRoot, destRaw);
  if (!fs.existsSync(destFull)) {
    fs.mkdirSync(destFull, { recursive: true });
  }

  const published = [];
  for (const sub of subdirs) {
    const srcSub = path.join(srcRoot, sub.name);
    const destSub = path.join(destFull, sub.name);
    if (!fs.existsSync(destSub)) fs.mkdirSync(destSub, { recursive: true });
    copyDirRecursive(srcSub, destSub);
    published.push(sub.name);
  }

  return { published, skippedReasons: [] };
}

module.exports = { publish };
