/**
 * SkillPublisher - publish skills from _bmad/skills to configTemplate.skillsDir (Story 12.3)
 * spec §3: 按 configTemplate.skillsDir 同步；bmadPath 源；~ 展开；递归复制
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const AIRegistry = require('./ai-registry');

const SHARED_REF_PATTERN = /@\.\/\.\.\/_shared\/([^\s)]+)/g;

/**
 * Expand ~ in path to os.homedir(). Handles ~, ~/, ~\.
 * @param {string} [p] - Path that may start with ~.
 * @returns {string} Expanded path or original if no tilde.
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
 * Recursively copy directory, preserving structure.
 * @param {string} src - Source directory.
 * @param {string} dest - Destination directory.
 * @returns {string[]} Names of top-level subdirs copied.
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

function normalizeSharedRef(ref) {
  const normalized = String(ref || '').replace(/\\/g, '/').trim();
  if (!normalized || path.isAbsolute(normalized) || normalized.split('/').includes('..')) {
    return null;
  }
  return normalized;
}

function readSharedRefs(skillDir) {
  const skillMd = path.join(skillDir, 'SKILL.md');
  if (!fs.existsSync(skillMd) || !fs.statSync(skillMd).isFile()) return [];
  const content = fs.readFileSync(skillMd, 'utf8');
  const refs = new Set();
  let match;
  SHARED_REF_PATTERN.lastIndex = 0;
  while ((match = SHARED_REF_PATTERN.exec(content)) !== null) {
    const normalized = normalizeSharedRef(match[1]);
    if (normalized) refs.add(normalized);
  }
  return [...refs].sort();
}

function copyReferencedSharedFiles(skillSrc, skillDest) {
  const refs = readSharedRefs(skillSrc);
  if (refs.length === 0) return;

  const srcSharedRoot = path.resolve(skillSrc, '..', '_shared');
  const destSharedRoot = path.resolve(skillDest, '..', '_shared');
  if (!fs.existsSync(srcSharedRoot) || !fs.statSync(srcSharedRoot).isDirectory()) {
    throw new Error(`Skill references ../_shared but source _shared is missing: ${srcSharedRoot}`);
  }

  for (const ref of refs) {
    const srcFile = path.resolve(srcSharedRoot, ...ref.split('/'));
    if (!srcFile.startsWith(srcSharedRoot + path.sep) || !fs.existsSync(srcFile) || !fs.statSync(srcFile).isFile()) {
      throw new Error(`Skill shared reference is missing: ${ref}`);
    }
    const destFile = path.resolve(destSharedRoot, ...ref.split('/'));
    if (!fs.existsSync(path.dirname(destFile))) fs.mkdirSync(path.dirname(destFile), { recursive: true });
    fs.copyFileSync(srcFile, destFile);
  }
}

/**
 * Copy all skill subdirectories from srcRoot to destFull.
 * @param {string} srcRoot - Source skills directory.
 * @param {string} destFull - Destination skills directory.
 * @returns {string[]} Names of published skill directories.
 */
function publishFromDir(srcRoot, destFull) {
  if (!fs.existsSync(srcRoot) || !fs.statSync(srcRoot).isDirectory()) return [];
  const entries = fs.readdirSync(srcRoot, { withFileTypes: true });
  const subdirs = entries.filter((e) => e.isDirectory());
  const published = [];
  for (const sub of subdirs) {
    const srcSub = path.join(srcRoot, sub.name);
    const destSub = path.join(destFull, sub.name);
    if (!fs.existsSync(destSub)) fs.mkdirSync(destSub, { recursive: true });
    copyDirRecursive(srcSub, destSub);
    copyReferencedSharedFiles(srcSub, destSub);
    published.push(sub.name);
  }
  return published;
}

/**
 * Discover skill directories recursively by finding SKILL.md files and publishing the parent dir.
 * This supports upstream layouts like _bmad/bmm/workflows/<phase>/bmad-create-prd/SKILL.md.
 * @param {string} srcRoot - Source root to scan.
 * @param {string} destFull - Destination skills directory.
 * @returns {string[]} Names of published skill directories.
 */
function publishRecursiveSkillDirs(srcRoot, destFull) {
  if (!fs.existsSync(srcRoot) || !fs.statSync(srcRoot).isDirectory()) return [];

  const published = new Set();

  function walk(current) {
    const entries = fs.readdirSync(current, { withFileTypes: true });
    const hasSkill = entries.some((entry) => entry.isFile() && entry.name === 'SKILL.md');
    if (hasSkill) {
      const skillName = path.basename(current);
      const destSub = path.join(destFull, skillName);
      if (!fs.existsSync(destSub)) fs.mkdirSync(destSub, { recursive: true });
      copyDirRecursive(current, destSub);
      copyReferencedSharedFiles(current, destSub);
      published.add(skillName);
      return;
    }
    for (const entry of entries) {
      if (entry.isDirectory()) {
        walk(path.join(current, entry.name));
      }
    }
  }

  walk(srcRoot);
  return [...published];
}

/**
 * Publish skills to configTemplate.skillsDir in two phases:
 * 1. Universal skills from _bmad/skills/
 * 2. Platform-adapted skills from configTemplate.platformSkillsDir (e.g. _bmad/cursor/skills/)
 * Same-name skills in phase 2 overwrite phase 1 (platform-specific wins).
 * @param {string} projectRoot - Project root.
 * @param {string} selectedAI - AI id from registry.
 * @param {{ bmadPath?: string, noAiSkills?: boolean }} [options] - bmadPath for worktree; noAiSkills to skip.
 * @returns {{ published: string[], skippedReasons: string[] }} Published skill dir names and skip reasons.
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

  const bmadRoot = options.bmadPath
    ? path.resolve(projectRoot, options.bmadPath)
    : path.join(projectRoot, '_bmad');

  const destRaw = expandTilde(skillsDir);
  const destFull = path.isAbsolute(destRaw) ? destRaw : path.join(projectRoot, destRaw);
  if (!fs.existsSync(destFull)) {
    fs.mkdirSync(destFull, { recursive: true });
  }

  const universalSrc = path.join(bmadRoot, 'skills');
  const universalPublished = publishFromDir(universalSrc, destFull);

  const workflowSkillRoots = [
    path.join(bmadRoot, 'bmm', 'workflows'),
    path.join(bmadRoot, 'bmm', 'agents'),
    path.join(bmadRoot, 'core', 'tasks'),
    path.join(bmadRoot, 'core', 'skills'),
  ];
  const workflowPublished = workflowSkillRoots.flatMap((root) => publishRecursiveSkillDirs(root, destFull));

  let platformPublished = [];
  const platformSkillsDir = entry.configTemplate.platformSkillsDir;
  if (platformSkillsDir) {
    const platformSrc = path.isAbsolute(platformSkillsDir)
      ? platformSkillsDir
      : path.join(projectRoot, platformSkillsDir);
    platformPublished = publishFromDir(platformSrc, destFull);
  }

  const allPublished = [...new Set([...universalPublished, ...workflowPublished, ...platformPublished])];
  return { published: allPublished, skippedReasons: [] };
}

module.exports = { publish };
