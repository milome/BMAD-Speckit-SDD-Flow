/**
 * Skeleton generation, selectedAI write, git init (T020-T024)
 */
const fs = require('fs');
const path = require('path');

/** Shared _bmad dirs always copied (core workflows, config) */
const SHARED_BMAD_DIRS = new Set(['core', '_config']);

/**
 * T020: Generate _bmad, _bmad-output from template (PRD §5.10)
 * T019: --modules filter: only deploy selected modules when specified (AC-5, GAP-4.3)
 * T021: --force: overwrite existing files, keep non-conflicting
 */
async function generateSkeleton(targetPath, templateDir, modules, force) {
  if (!fs.existsSync(templateDir)) {
    throw new Error(`Template directory not found: ${templateDir}`);
  }
  if (!fs.existsSync(targetPath)) {
    fs.mkdirSync(targetPath, { recursive: true });
  }

  const modulesSet = modules && modules.length > 0 ? new Set(modules.map((m) => m.toLowerCase())) : null;

  const copyDir = (src, dest, opts = {}) => {
    if (!fs.existsSync(src)) return;
    const entries = fs.readdirSync(src, { withFileTypes: true });
    for (const e of entries) {
      const s = path.join(src, e.name);
      const d = path.join(dest, e.name);
      if (e.isDirectory()) {
        if (opts.skipHidden && e.name.startsWith('.') && e.name !== '.cursor' && e.name !== '.claude') return;
        if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
        copyDir(s, d, opts);
      } else {
        if (force || !fs.existsSync(d)) {
          fs.copyFileSync(s, d);
        }
      }
    }
  };

  const copyBmadWithModulesFilter = (srcBmad, destBmad) => {
    if (!fs.existsSync(srcBmad)) return;
    if (!fs.existsSync(destBmad)) fs.mkdirSync(destBmad, { recursive: true });
    const entries = fs.readdirSync(srcBmad, { withFileTypes: true });
    for (const e of entries) {
      const s = path.join(srcBmad, e.name);
      const d = path.join(destBmad, e.name);
      if (e.isDirectory()) {
        if (modulesSet) {
          const nameLower = e.name.toLowerCase();
          if (!SHARED_BMAD_DIRS.has(nameLower) && !modulesSet.has(nameLower)) continue;
        }
        if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
        copyDir(s, d, {});
      } else {
        if (force || !fs.existsSync(d)) fs.copyFileSync(s, d);
      }
    }
  };

  const templateBmad = path.join(templateDir, '_bmad');
  const templateOutput = path.join(templateDir, '_bmad-output');
  const destBmad = path.join(targetPath, '_bmad');
  const destOutput = path.join(targetPath, '_bmad-output');

  if (fs.existsSync(templateBmad)) {
    copyBmadWithModulesFilter(templateBmad, destBmad);
  } else {
    fs.mkdirSync(destBmad, { recursive: true });
    fs.mkdirSync(path.join(destBmad, 'core'), { recursive: true });
    fs.mkdirSync(path.join(destBmad, 'cursor'), { recursive: true });
    fs.mkdirSync(path.join(destBmad, 'speckit'), { recursive: true });
    fs.mkdirSync(path.join(destBmad, 'skills'), { recursive: true });
  }

  fs.mkdirSync(destOutput, { recursive: true });
  fs.mkdirSync(path.join(destOutput, 'config'), { recursive: true });
  if (fs.existsSync(templateOutput)) {
    copyDir(templateOutput, destOutput, {});
  }
}

/**
 * Story 10.5: Worktree mode - only create _bmad-output, sync from bmadPath to .cursor/ (and bmadPath/skills)
 */
function generateWorktreeSkeleton(targetPath, bmadPath, selectedAI) {
  if (!fs.existsSync(targetPath)) {
    fs.mkdirSync(targetPath, { recursive: true });
  }
  const destOutput = path.join(targetPath, '_bmad-output');
  const destConfig = path.join(destOutput, 'config');
  fs.mkdirSync(destConfig, { recursive: true });

  const copyDir = (src, dest) => {
    if (!fs.existsSync(src)) return;
    const entries = fs.readdirSync(src, { withFileTypes: true });
    for (const e of entries) {
      const s = path.join(src, e.name);
      const d = path.join(dest, e.name);
      if (e.isDirectory()) {
        if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
        copyDir(s, d);
      } else {
        fs.copyFileSync(s, d);
      }
    }
  };

  const cursorSrc = path.join(bmadPath, 'cursor');
  const cursorDest = path.join(targetPath, '.cursor');
  if (fs.existsSync(cursorSrc) && fs.statSync(cursorSrc).isDirectory()) {
    if (!fs.existsSync(cursorDest)) fs.mkdirSync(cursorDest, { recursive: true });
    copyDir(cursorSrc, cursorDest);
  }
  const skillsSrc = path.join(bmadPath, 'skills');
  const skillsDest = path.join(targetPath, '.cursor', 'skills');
  if (fs.existsSync(skillsSrc) && fs.statSync(skillsSrc).isDirectory()) {
    if (!fs.existsSync(skillsDest)) fs.mkdirSync(skillsDest, { recursive: true });
    copyDir(skillsSrc, skillsDest);
  }
}

/**
 * T024 / Story 10.4: Write selectedAI, templateVersion, initLog via ConfigManager (GAP-5.1)
 * Story 10.5: optional bmadPath to merge into project config
 */
function writeSelectedAI(targetPath, selectedAI, templateVersion = 'latest', bmadPath = null) {
  const configManager = require('../services/config-manager');
  const initLog = { timestamp: new Date().toISOString() };
  const record = { selectedAI, templateVersion, initLog };
  if (bmadPath != null) record.bmadPath = bmadPath;
  configManager.setAll(record, { scope: 'project', cwd: targetPath });
}

/**
 * Story 10.5: Worktree mode - create only _bmad-output and config; sync commands/rules/skills from bmadPath (no _bmad copy)
 */
function createWorktreeSkeleton(targetPath, bmadPath, selectedAI) {
  if (!fs.existsSync(targetPath)) {
    fs.mkdirSync(targetPath, { recursive: true });
  }
  const destOutput = path.join(targetPath, '_bmad-output');
  fs.mkdirSync(destOutput, { recursive: true });
  fs.mkdirSync(path.join(destOutput, 'config'), { recursive: true });

  const copyDir = (src, dest) => {
    if (!fs.existsSync(src)) return;
    const entries = fs.readdirSync(src, { withFileTypes: true });
    for (const e of entries) {
      const s = path.join(src, e.name);
      const d = path.join(dest, e.name);
      if (e.isDirectory()) {
        if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
        copyDir(s, d);
      } else {
        fs.copyFileSync(s, d);
      }
    }
  };

  const cursorSrc = path.join(bmadPath, 'cursor');
  const cursorDest = path.join(targetPath, '.cursor');
  if (fs.existsSync(cursorSrc)) {
    if (!fs.existsSync(cursorDest)) fs.mkdirSync(cursorDest, { recursive: true });
    copyDir(cursorSrc, cursorDest);
  }

  const claudeSrc = path.join(bmadPath, 'claude');
  const claudeDest = path.join(targetPath, '.claude');
  if (fs.existsSync(claudeSrc) && (selectedAI === 'claude' || selectedAI === 'cursor-agent')) {
    if (!fs.existsSync(claudeDest)) fs.mkdirSync(claudeDest, { recursive: true });
    copyDir(claudeSrc, claudeDest);
  }

  const skillsSrc = path.join(bmadPath, 'skills');
  const skillsDest = path.join(targetPath, '.cursor', 'skills');
  if (fs.existsSync(skillsSrc)) {
    if (!fs.existsSync(skillsDest)) fs.mkdirSync(skillsDest, { recursive: true });
    copyDir(skillsSrc, skillsDest);
  }
}

/**
 * T022: git init, create .gitignore when not --no-git (GAP-5.2)
 */
function runGitInit(targetPath) {
  const { spawnSync } = require('child_process');
  const gitignore = `node_modules/
_bmad-output/
*.log
.DS_Store
`;
  const gitignorePath = path.join(targetPath, '.gitignore');
  if (!fs.existsSync(gitignorePath)) {
    fs.writeFileSync(gitignorePath, gitignore, 'utf8');
  }
  const r = spawnSync('git', ['init'], { cwd: targetPath, stdio: 'pipe' });
  if (r.error) {
    console.warn('Warning: git init failed:', r.error.message);
  }
}

module.exports = {
  generateSkeleton,
  writeSelectedAI,
  createWorktreeSkeleton,
  runGitInit,
};
