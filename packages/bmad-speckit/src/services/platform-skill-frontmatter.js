const fs = require('fs');
const path = require('path');

const PLATFORM_SKILLS_DIRS = ['.codex/skills', '.claude/skills', '.cursor/skills'];

function isPlatformSkillFile(filePath) {
  const portablePath = String(filePath || '').replace(/\\/g, '/');
  return (
    path.basename(filePath) === 'SKILL.md' &&
    PLATFORM_SKILLS_DIRS.some(
      (skillsDir) => portablePath.includes(`/${skillsDir}/`) || portablePath.startsWith(`${skillsDir}/`)
    )
  );
}

function normalizePlatformSkillFrontmatterContent(raw, skillName) {
  const source = String(raw || '').replace(/^\uFEFF/u, '');
  const withoutPolicy = source.replace(/^<!--\s*BLOCK_LABEL_POLICY=[^>]*-->\s*\r?\n?/u, '');
  let frontmatter = '';
  let body = withoutPolicy;
  const lines = withoutPolicy.split(/\r?\n/u);

  if (lines[0] === '---') {
    const endIndex = lines.findIndex((line, index) => index > 0 && line.trim() === '---');
    if (endIndex > 0) {
      frontmatter = lines.slice(1, endIndex).join('\n');
      body = lines.slice(endIndex + 1).join('\n').replace(/^\s*\r?\n/u, '');
    }
  }

  const name =
    frontmatter.match(/^name:\s*['"]?([^'"\r\n]+)['"]?\s*$/mu)?.[1]?.trim() || skillName;
  const blockDescriptionMatch = frontmatter.match(/^description:\s*\|\s*\n((?:[ \t]+.*\n?)*)/mu);
  const inlineDescriptionMatch = frontmatter.match(/^description:\s*(.+)$/mu);
  const rawDescription = blockDescriptionMatch
    ? blockDescriptionMatch[1]
        .split(/\r?\n/u)
        .map((line) => line.trim())
        .filter(Boolean)
        .join(' ')
    : inlineDescriptionMatch?.[1]?.replace(/^['"]|['"]$/gu, '').trim();
  const description = (rawDescription || `BMAD platform skill ${name}.`)
    .replace(/\s+/gu, ' ')
    .slice(0, 500);

  return [
    '---',
    `name: ${JSON.stringify(name)}`,
    `description: ${JSON.stringify(description)}`,
    '---',
    '',
    body,
  ].join('\n');
}

function normalizePlatformSkillFrontmatterFile(filePath) {
  if (!isPlatformSkillFile(filePath) || !fs.existsSync(filePath)) return false;
  const raw = fs.readFileSync(filePath, 'utf8');
  const normalized = normalizePlatformSkillFrontmatterContent(raw, path.basename(path.dirname(filePath)));
  if (normalized === raw) return false;
  fs.writeFileSync(filePath, normalized, 'utf8');
  return true;
}

module.exports = {
  isPlatformSkillFile,
  normalizePlatformSkillFrontmatterContent,
  normalizePlatformSkillFrontmatterFile,
};
