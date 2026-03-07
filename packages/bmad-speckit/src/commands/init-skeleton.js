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
 * T024: Write selectedAI to _bmad-output/config/bmad-speckit.json (GAP-5.4)
 */
function writeSelectedAI(targetPath, selectedAI) {
  const configPath = path.join(targetPath, '_bmad-output', 'config', 'bmad-speckit.json');
  const configDir = path.dirname(configPath);
  if (!fs.existsSync(configDir)) fs.mkdirSync(configDir, { recursive: true });
  let config = {};
  if (fs.existsSync(configPath)) {
    try {
      config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch (_) {}
  }
  config.selectedAI = selectedAI;
  config.initLog = config.initLog || {};
  config.initLog.timestamp = new Date().toISOString();
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
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
  runGitInit,
};
