const fs = require('fs');
const path = require('path');

const PLATFORM_SKILLS_DIRS = ['.codex/skills', '.claude/skills', '.cursor/skills'];
const MAX_PLATFORM_SKILL_DESCRIPTION_LENGTH = 1024;
const KNOWN_PLATFORM_SKILL_DESCRIPTIONS = Object.freeze({
  'bmad-bug-assistant':
    'Diagnose and fix BMAD bugs with root-cause analysis, evidence collection, targeted remediation, regression checks, and concise closeout reporting.',
  'bmad-story-assistant':
    'Use when the user provides Epic/Story numbers such as Story 4.1 or asks to create, implement, audit, or close out a BMAD story. Triggers include Create Story, Story audit, Dev Story, post-implementation audit, closeout approved, party-mode tier selection 20/50/100, ralph-method, TDD traffic lights, Codex worker/code-reviewer dispatch, handoff/state/score writing, commit gate, Chinese deliverables, and copy-paste prompts.',
  'speckit-workflow':
    'Use when the user runs or asks about /speckit.constitution, /speckit.specify, /speckit.plan, /speckit.tasks, /speckit.implement, IMPLEMENTATION_GAPS, tasks.md, tasks-v*.md, or Speckit workflows needing requirement mapping, clarify/checklist/analyze, code-review audit closed loops, TDD red-green-refactor, QA_Agent rules, ralph-wiggum, architecture fidelity, no fake implementation, active regression testing, and validation gates.',
});

function isCodexSkillFile(filePath) {
  const portablePath = String(filePath || '').replace(/\\/g, '/');
  return (
    path.basename(filePath) === 'SKILL.md' &&
    (portablePath.includes('/.codex/skills/') || portablePath.startsWith('.codex/skills/'))
  );
}

function isPlatformSkillFile(filePath) {
  const portablePath = String(filePath || '').replace(/\\/g, '/');
  return (
    path.basename(filePath) === 'SKILL.md' &&
    PLATFORM_SKILLS_DIRS.some(
      (skillsDir) => portablePath.includes(`/${skillsDir}/`) || portablePath.startsWith(`${skillsDir}/`)
    )
  );
}

function splitFrontmatter(raw) {
  const lines = String(raw || '').split(/\r?\n/u);
  if (lines[0] !== '---') return false;
  const endIndex = lines.findIndex((line, index) => index > 0 && line.trim() === '---');
  if (endIndex < 0) return false;
  return {
    frontmatter: lines.slice(1, endIndex).join('\n'),
    body: lines.slice(endIndex + 1).join('\n'),
  };
}

function readFrontmatterName(frontmatter, fallbackName) {
  return frontmatter.match(/^name:\s*['"]?([^'"\r\n]+)['"]?\s*$/mu)?.[1]?.trim() || fallbackName;
}

function readFrontmatterDescription(frontmatter) {
  const blockDescriptionMatch = frontmatter.match(/^description:\s*\|\s*\n((?:[ \t]+.*\n?)*)/mu);
  const inlineDescriptionMatch = frontmatter.match(/^description:\s*(.+)$/mu);
  return blockDescriptionMatch
    ? blockDescriptionMatch[1]
        .split(/\r?\n/u)
        .map((line) => line.trim())
        .filter(Boolean)
        .join(' ')
    : inlineDescriptionMatch?.[1]?.replace(/^['"]|['"]$/gu, '').trim();
}

function compactDescription(description) {
  return String(description || '').replace(/\s+/gu, ' ').trim();
}

function isLikelyMechanicalTruncation(description) {
  const compact = compactDescription(description);
  return compact.length >= 450 && !/[.!?。！？]$/u.test(compact);
}

function resolvePlatformSkillDescription(description, name) {
  const curated = KNOWN_PLATFORM_SKILL_DESCRIPTIONS[name];
  const compact = compactDescription(description);
  if (curated && (!compact || compact.length > MAX_PLATFORM_SKILL_DESCRIPTION_LENGTH || isLikelyMechanicalTruncation(compact))) {
    return curated;
  }
  if (compact && compact.length <= MAX_PLATFORM_SKILL_DESCRIPTION_LENGTH) {
    return compact;
  }
  if (curated) {
    return curated;
  }
  return `Platform skill ${name}. Use for the workflow described in the skill body; follow its trigger rules, steps, scripts, and verification requirements.`;
}

function hasUsableFrontmatter(raw) {
  const parsed = splitFrontmatter(raw);
  if (!parsed) return false;
  const name = readFrontmatterName(parsed.frontmatter, '');
  const description = readFrontmatterDescription(parsed.frontmatter);
  if (!name || !description || description.length > MAX_PLATFORM_SKILL_DESCRIPTION_LENGTH) {
    return false;
  }
  return !(KNOWN_PLATFORM_SKILL_DESCRIPTIONS[name] && isLikelyMechanicalTruncation(description));
}

function hasRequiredFrontmatter(raw) {
  return hasUsableFrontmatter(raw);
}

function normalizePlatformSkillFrontmatterContent(raw, skillName) {
  const source = String(raw || '').replace(/^\uFEFF/u, '');
  const withoutPolicy = source.replace(/^<!--\s*BLOCK_LABEL_POLICY=[^>]*-->\s*\r?\n?/u, '');
  if (hasRequiredFrontmatter(withoutPolicy)) {
    return withoutPolicy;
  }
  let frontmatter = '';
  let body = withoutPolicy;
  const parsed = splitFrontmatter(withoutPolicy);

  if (parsed) {
    frontmatter = parsed.frontmatter;
    body = parsed.body.replace(/^\s*\r?\n/u, '');
  }

  const name = readFrontmatterName(frontmatter, skillName);
  const rawDescription = readFrontmatterDescription(frontmatter);
  const description = resolvePlatformSkillDescription(rawDescription || `BMAD platform skill ${name}.`, name);

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
  const normalizedContent = normalizePlatformSkillFrontmatterContent(raw, path.basename(path.dirname(filePath)));
  const normalized = isCodexSkillFile(filePath) ? normalizedContent.replace(/\r\n/gu, '\n') : normalizedContent;
  if (normalized === raw) return false;
  fs.writeFileSync(filePath, normalized, 'utf8');
  return true;
}

module.exports = {
  isPlatformSkillFile,
  normalizePlatformSkillFrontmatterContent,
  normalizePlatformSkillFrontmatterFile,
};
