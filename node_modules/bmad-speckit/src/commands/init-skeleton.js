/**
 * Skeleton generation, selectedAI write, git init (T020-T024)
 */
const fs = require('fs');
const path = require('path');

/** Shared _bmad dirs always copied (core workflows, config, commands, skills, platform dirs) */
const SHARED_BMAD_DIRS = new Set(['core', '_config', 'commands', 'skills', 'cursor', 'claude', 'utility']);

/**
 * T020: Generate _bmad, _bmad-output from template (PRD §5.10).
 * T019: --modules filter: only deploy selected modules when specified (AC-5, GAP-4.3).
 * T021: --force: overwrite existing files, keep non-conflicting.
 * @param {string} targetPath - Project root to deploy into.
 * @param {string} templateDir - Path to template directory containing _bmad, _bmad-output.
 * @param {string[] | null} [modules] - If non-empty, only deploy these module dirs; null = all.
 * @param {boolean} [force] - If true, overwrite existing files.
 * @returns {Promise<void>}
 * @throws {Error} If templateDir does not exist.
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
        if (opts.skipHidden && e.name.startsWith('.')) return;
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
 * T024 / Story 10.4: Write selectedAI, templateVersion, initLog via ConfigManager (GAP-5.1).
 * Story 10.5: optional bmadPath to merge into project config. Story 12.3: initLogExt.
 * @param {string} targetPath - Project root for config write.
 * @param {string} [selectedAI] - Selected AI id.
 * @param {string} [templateVersion] - Template version string.
 * @param {string | null} [bmadPath] - Optional bmadPath for worktree mode.
 * @param {{ skillsPublished?: string[], skippedReasons?: string[] } | null} [initLogExt] - Init log extras.
 * @returns {void}
 */
function writeSelectedAI(targetPath, selectedAI, templateVersion = 'latest', bmadPath = null, initLogExt = null) {
  const configManager = require('../services/config-manager');
  const selectedAIs = Array.isArray(selectedAI) ? selectedAI : [selectedAI];
  const primaryAI = selectedAIs[0];
  const initLog = {
    timestamp: new Date().toISOString(),
    selectedAI: primaryAI,
    selectedAIs,
    templateVersion,
    skillsPublished: (initLogExt && Array.isArray(initLogExt.skillsPublished)) ? initLogExt.skillsPublished : [],
  };
  if (initLogExt && Array.isArray(initLogExt.skippedReasons) && initLogExt.skippedReasons.length > 0) {
    initLog.skippedReasons = initLogExt.skippedReasons;
  }
  const record = { selectedAI: primaryAI, selectedAIs, templateVersion, initLog };
  if (bmadPath != null) record.bmadPath = bmadPath;
  configManager.setAll(record, { scope: 'project', cwd: targetPath });
}

/**
 * Story 10.5 / 12.2: Worktree mode - create only _bmad-output and config.
 * Sync commands/rules/config is delegated to SyncService.syncCommandsRulesConfig (Story 12.2).
 * @param {string} targetPath - Project root; creates _bmad-output/config here.
 * @param {string} [_bmadPath] - Unused; reserved for future worktree path.
 * @param {string} [_selectedAI] - Unused; reserved for future.
 * @returns {void}
 */
function createWorktreeSkeleton(targetPath, _bmadPath, _selectedAI) {
  if (!fs.existsSync(targetPath)) {
    fs.mkdirSync(targetPath, { recursive: true });
  }
  const destOutput = path.join(targetPath, '_bmad-output');
  fs.mkdirSync(destOutput, { recursive: true });
  fs.mkdirSync(path.join(destOutput, 'config'), { recursive: true });
}

/**
 * T022: git init, create .gitignore when not --no-git (GAP-5.2).
 * Creates .gitignore with node_modules, _bmad-output if missing; runs git init.
 * @param {string} targetPath - Project root for git init.
 * @returns {void}
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
