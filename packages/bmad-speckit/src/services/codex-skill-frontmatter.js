const {
  normalizePlatformSkillFrontmatterContent,
} = require('./platform-skill-frontmatter');
const fs = require('fs');
const path = require('path');

function isCodexSkillFile(filePath) {
  const portablePath = String(filePath || '').replace(/\\/g, '/');
  return (
    path.basename(filePath) === 'SKILL.md' &&
    (portablePath.includes('/.codex/skills/') || portablePath.startsWith('.codex/skills/'))
  );
}

function normalizeCodexSkillFrontmatterFile(filePath) {
  if (!isCodexSkillFile(filePath) || !fs.existsSync(filePath)) return false;
  const raw = fs.readFileSync(filePath, 'utf8');
  const normalized = normalizePlatformSkillFrontmatterContent(raw, path.basename(path.dirname(filePath)));
  if (normalized === raw) return false;
  fs.writeFileSync(filePath, normalized, 'utf8');
  return true;
}

module.exports = {
  isCodexSkillFile,
  normalizeCodexSkillFrontmatterContent: normalizePlatformSkillFrontmatterContent,
  normalizeCodexSkillFrontmatterFile,
};
