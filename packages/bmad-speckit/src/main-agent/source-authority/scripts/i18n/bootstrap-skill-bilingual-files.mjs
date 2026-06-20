/**
 * E15-S2 T5.x+: SKILL.zh.md mirrors SKILL.md (Chinese canonical).
 * SKILL.en.md is **not** overwritten — maintain English translations separately.
 * Run from repo root: node scripts/i18n/bootstrap-skill-bilingual-files.mjs
 */
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');

const SKILL_DIRS = [
  '_bmad/cursor/skills/bmad-bug-assistant',
  '_bmad/claude/skills/bmad-bug-assistant',
  '_bmad/cursor/skills/bmad-story-assistant',
  '_bmad/claude/skills/bmad-story-assistant',
  '_bmad/skills/bmad-eval-analytics',
  '_bmad/cursor/skills/speckit-workflow',
  '_bmad/claude/skills/speckit-workflow',
  '_bmad/cursor/skills/using-git-worktrees',
  '_bmad/claude/skills/using-git-worktrees',
  '_bmad/cursor/skills/bmad-standalone-tasks',
  '_bmad/claude/skills/bmad-standalone-tasks',
  '_bmad/cursor/skills/bmad-standalone-tasks-doc-review',
  '_bmad/claude/skills/bmad-standalone-tasks-doc-review',
  '_bmad/cursor/skills/bmad-rca-helper',
  '_bmad/claude/skills/bmad-rca-helper',
  '_bmad/cursor/skills/bmad-code-reviewer-lifecycle',
  '_bmad/claude/skills/bmad-code-reviewer-lifecycle',
  '_bmad/skills/bmad-party-mode',
  '_bmad/core/skills/bmad-party-mode',
  '_bmad/skills/bmad-customization-backup',
  '_bmad/skills/git-push-monitor',
];

/**
 * Canonical: SKILL.md (default zh) → SKILL.zh.md (byte copy).
 * SKILL.en.md: English only; if missing, warn (do not copy Chinese into en).
 */

function ensureDir(p) {
  mkdirSync(dirname(p), { recursive: true });
}

for (const rel of SKILL_DIRS) {
  const dir = join(ROOT, rel);
  const skillMd = join(dir, 'SKILL.md');
  const zh = join(dir, 'SKILL.zh.md');
  const en = join(dir, 'SKILL.en.md');
  if (!existsSync(skillMd)) {
    console.warn('Skip (no SKILL.md):', rel);
    continue;
  }
  ensureDir(zh);
  copyFileSync(skillMd, zh);
  if (!existsSync(en)) {
    console.warn('Missing SKILL.en.md (add English translation):', rel);
  }
  console.log('Synced SKILL.md → SKILL.zh.md', rel);
}

console.log('Done.');
