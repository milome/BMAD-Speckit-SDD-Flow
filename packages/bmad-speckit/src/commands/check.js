/**
 * CheckCommand - check subcommand (ARCH 鎼?.2, Story 10.5, 12.1, 12.2, 13.1)
 * - bmadPath: validate path exists and structure; exit 4 if not.
 * - selectedAI: validate target directories per configTemplate; exit 1 if not.
 * - --list-ai: list available AI ids from AIRegistry; --json for JSON array.
 * - Diagnostic output: aiToolsInstalled, cliVersion, templateVersion, envVars, subagentSupport.
 * - --ignore-agent-tools: skip detectCommand detection.
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const exitCodes = require('../constants/exit-codes');
const { validateBmadStructure } = require('../utils/structure-validate');
const AIRegistry = require('../services/ai-registry');

const pkg = require('../../package.json');

/**
 * Load project config from config-manager path for the given cwd.
 * @param {string} [cwd] - Working directory (default: process.cwd() for config path resolution).
 * @returns {Record<string, unknown>} Parsed config object, or {} on parse error or missing file.
 */
function getProjectConfig(cwd) {
  const { getProjectConfigPath } = require('../services/config-manager');
  try {
    const configPath = getProjectConfigPath(cwd);
    if (!fs.existsSync(configPath)) return {};
    const raw = fs.readFileSync(configPath, 'utf8');
    return JSON.parse(raw);
  } catch (_) {
    return {};
  }
}

/**
 * Get the bmadPath from project config.
 * @param {string} [cwd] - Working directory for config lookup.
 * @returns {string | undefined} Resolved bmadPath string, or undefined if not set.
 */
function getProjectBmadPath(cwd) {
  const config = getProjectConfig(cwd);
  const bmadPath = config.bmadPath;
  if (bmadPath != null && typeof bmadPath === 'string') return bmadPath;
  return undefined;
}

/**
 * Get the selected AI id from project config.
 * @param {string} [cwd] - Working directory for config lookup.
 * @returns {string | undefined} selectedAI value from config, or undefined.
 */
function getProjectSelectedAI(cwd) {
  const config = getProjectConfig(cwd);
  return config.selectedAI;
}

/**
 * Story 12.2: Validate selectedAI target directories per spec 鎼?.2 / PRD 鎼?.5.
 * Checks that the AI-specific config dirs (e.g. .cursor, .claude) exist and have required subdirs.
 * @param {string} [cwd] - Working directory to validate against.
 * @param {string} [selectedAI] - AI id (e.g. 'cursor-agent', 'claude').
 * @returns {{ valid: boolean, missing: string[] }} Validation result; missing lists absent paths.
 */
function validateSelectedAITargets(cwd, selectedAI) {
  const missing = [];
  const entry = AIRegistry.getById(selectedAI, { cwd });
  if (!entry || !entry.configTemplate) {
    return { valid: true, missing: [] };
  }
  const ct = entry.configTemplate;

  const hasDir = (relPath, requiredSub) => {
    const full = path.join(cwd, relPath);
    if (!fs.existsSync(full)) return false;
    if (!requiredSub) return true;
    const sub = path.join(full, requiredSub);
    return fs.existsSync(sub) && fs.statSync(sub).isDirectory();
  };
  const hasFile = (relPath) => {
    const full = path.join(cwd, relPath);
    return fs.existsSync(full) && fs.statSync(full).isFile();
  };
  const requireGovernedEntryAliases = (rootDir) => {
    const hasBmadPath = typeof getProjectBmadPath(cwd) === 'string';
    if (hasBmadPath) return;
    for (const alias of ['bmad-speckit', 'bmads']) {
      if (!hasFile(path.join(rootDir, 'commands', `${alias}.md`))) {
        missing.push(`${rootDir}/commands/${alias}.md`);
      }
      if (!hasFile(path.join(rootDir, 'skills', alias, 'SKILL.md'))) {
        missing.push(`${rootDir}/skills/${alias}/SKILL.md`);
      }
    }
  };
  const requireCodexProtocolFiles = () => {
    for (const name of ['audit-result-schema.md', 'handoff-schema.md', 'commit-protocol.md']) {
      if (!hasFile(path.join('.codex', 'protocols', name))) {
        missing.push(`.codex/protocols/${name}`);
      }
    }
  };
  const requireCodexSkills = () => {
    for (const skill of [
      'speckit-workflow',
      'bmad-story-assistant',
      'bmad-standalone-tasks',
      'bmad-standalone-tasks-doc-review',
      'bmad-rca-helper',
      'bmad-code-reviewer-lifecycle',
    ]) {
      const skillPath = path.join('.codex', 'skills', skill, 'SKILL.md');
      if (!hasFile(skillPath)) {
        missing.push(`.codex/skills/${skill}/SKILL.md`);
        continue;
      }
      const fullSkillPath = path.join(cwd, skillPath);
      const content = fs.readFileSync(fullSkillPath, 'utf8').replace(/^\uFEFF/, '');
      const lines = content.split(/\r?\n/);
      if (lines[0] !== '---') {
        missing.push(`.codex/skills/${skill}/SKILL.md missing YAML frontmatter`);
        continue;
      }
      const endIndex = lines.findIndex((line, index) => index > 0 && line.trim() === '---');
      if (endIndex < 0) {
        missing.push(`.codex/skills/${skill}/SKILL.md missing YAML frontmatter close`);
        continue;
      }
      const frontmatter = lines.slice(1, endIndex).join('\n');
      const nameMatch = frontmatter.match(/^name:\s*(.+)$/m);
      const descriptionMatch = frontmatter.match(/^description:\s*(.+)$/m);
      if (!nameMatch || !descriptionMatch) {
        missing.push(`.codex/skills/${skill}/SKILL.md missing name/description frontmatter`);
        continue;
      }
      const rawDescription = descriptionMatch[1].trim();
      let description = rawDescription;
      if (
        (rawDescription.startsWith('"') && rawDescription.endsWith('"')) ||
        (rawDescription.startsWith("'") && rawDescription.endsWith("'"))
      ) {
        try {
          description = rawDescription.startsWith('"')
            ? JSON.parse(rawDescription)
            : rawDescription.slice(1, -1);
        } catch (_) {
          missing.push(`.codex/skills/${skill}/SKILL.md invalid Codex description frontmatter`);
          continue;
        }
      }
      if (!description || description.length > 1024) {
        missing.push(`.codex/skills/${skill}/SKILL.md invalid Codex description frontmatter`);
      }
    }
  };
  const requireCodexPublicCliSurface = () => {
    const cliPath = path.join(__dirname, '..', '..', 'bin', 'bmad-speckit.js');
    if (!fs.existsSync(cliPath)) {
      missing.push('bmad-speckit public CLI missing');
      return;
    }
    const help = spawnSync(process.execPath, [cliPath, '--help'], {
      cwd,
      encoding: 'utf8',
      timeout: 10_000,
      shell: process.platform === 'win32',
    });
    const output = `${help.stdout ?? ''}\n${help.stderr ?? ''}`;
    for (const command of ['bmads', 'bmad-speckit', 'main-agent-orchestration', 'write-runtime-context', 'run-auditor-host']) {
      if (!output.includes(command)) {
        missing.push(`bmad-speckit public CLI missing ${command}`);
      }
    }
  };
  const requireBmadsRuntimeContract = () => {
    for (const relPath of [
      '_bmad/_config/bmads-runtime.yaml',
      '_bmad/_config/orchestration-governance.contract.yaml',
      '_bmad/_config/stage-mapping.yaml',
    ]) {
      if (!hasFile(relPath)) missing.push(relPath);
    }
  };

  if (selectedAI === 'cursor-agent') {
    if (!hasDir('.cursor')) missing.push('.cursor');
    else {
      const hasCmd = hasDir('.cursor', 'commands');
      const hasRules = hasDir('.cursor', 'rules');
      const hasAgents = hasDir('.cursor', 'agents');
      if (!hasCmd && !hasRules && !hasAgents) missing.push('.cursor must have commands/, rules/, or agents/');
      requireGovernedEntryAliases('.cursor');
    }
  } else if (selectedAI === 'claude') {
    if (!hasDir('.claude')) missing.push('.claude');
    else {
      const hasCmd = hasDir('.claude', 'commands');
      const hasRules = hasDir('.claude', 'rules');
      if (!hasCmd && !hasRules) missing.push('.claude must have commands/ or rules/');
      requireGovernedEntryAliases('.claude');
    }
  } else if (selectedAI === 'opencode') {
    if (!hasDir('.opencode')) missing.push('.opencode');
    else if (!hasDir('.opencode', 'command')) missing.push('.opencode/command');
  } else if (selectedAI === 'bob') {
    if (!hasDir('.bob')) missing.push('.bob');
    else if (!hasDir('.bob', 'commands')) missing.push('.bob/commands');
  } else if (selectedAI === 'shai') {
    if (!hasDir('.shai')) missing.push('.shai');
    else if (!hasDir('.shai', 'commands')) missing.push('.shai/commands');
  } else if (selectedAI === 'codex') {
    if (!hasDir('.codex')) missing.push('.codex');
    else {
      if (!hasDir('.codex', 'commands')) missing.push('.codex/commands');
      if (!hasDir('.codex', 'agents')) missing.push('.codex/agents');
      if (!hasDir('.codex', 'skills')) missing.push('.codex/skills');
      if (!hasDir('.codex', 'protocols')) missing.push('.codex/protocols');
      if (!hasDir('.codex', 'i18n')) missing.push('.codex/i18n');
      requireGovernedEntryAliases('.codex');
      requireBmadsRuntimeContract();
      requireCodexProtocolFiles();
      requireCodexSkills();
      requireCodexPublicCliSurface();
      const readmePath = path.join(cwd, '.codex', 'README.md');
      if (!fs.existsSync(readmePath) || !fs.statSync(readmePath).isFile()) {
        missing.push('.codex/README.md');
      }
    }
    const manifestPath = path.join(
      cwd,
      '_bmad-output',
      'config',
      'bmad-speckit-install-manifest.json'
    );
    if (!fs.existsSync(manifestPath)) {
      missing.push('_bmad-output/config/bmad-speckit-install-manifest.json');
    } else {
      try {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        if (!Array.isArray(manifest.installed_tools) || !manifest.installed_tools.includes('codex')) {
          missing.push('install manifest missing codex installed_tools');
        }
        if (
          !Array.isArray(manifest.managed_surface) ||
          !manifest.managed_surface.some((entry) => String(entry.path || '').startsWith('.codex/'))
        ) {
          missing.push('install manifest missing .codex managed_surface');
        }
        if (
          !Array.isArray(manifest.managed_surface) ||
          !manifest.managed_surface.some((entry) => String(entry.path || '').startsWith('.codex/protocols'))
        ) {
          missing.push('install manifest missing .codex/protocols managed_surface');
        }
      } catch (_) {
        missing.push('_bmad-output/config/bmad-speckit-install-manifest.json invalid');
      }
    }
  } else if (selectedAI === 'gemini') {
    if (!hasDir('.gemini')) missing.push('.gemini');
    else if (!hasDir('.gemini', 'commands')) missing.push('.gemini/commands');
  } else if (selectedAI === 'windsurf') {
    if (!hasDir('.windsurf')) missing.push('.windsurf');
    else if (!hasDir('.windsurf', 'workflows')) missing.push('.windsurf/workflows');
  } else if (selectedAI === 'kilocode') {
    if (!hasDir('.kilocode')) missing.push('.kilocode');
    else if (!hasDir('.kilocode', 'rules')) missing.push('.kilocode/rules');
  } else if (selectedAI === 'auggie') {
    if (!hasDir('.augment')) missing.push('.augment');
    else if (!hasDir('.augment', 'rules')) missing.push('.augment/rules');
  } else if (selectedAI === 'roo') {
    if (!hasDir('.roo')) missing.push('.roo');
    else if (!hasDir('.roo', 'rules')) missing.push('.roo/rules');
  } else if (ct.commandsDir || ct.rulesDir) {
    const root = ct.commandsDir ? path.dirname(ct.commandsDir) : path.dirname(ct.rulesDir);
    const full = path.join(cwd, root);
    if (!fs.existsSync(full)) missing.push(root);
  }

  return { valid: missing.length === 0, missing };
}

/**
 * Story 13.1: Validate _bmad-output exists and contains config/.
 * @param {string} [cwd] - Working directory to check.
 * @returns {{ valid: boolean, missing: string[] }} Validation result; missing lists absent paths.
 */
function validateBmadOutput(cwd) {
  const outDir = path.join(cwd, '_bmad-output');
  if (!fs.existsSync(outDir) || !fs.statSync(outDir).isDirectory()) {
    return { valid: false, missing: ['_bmad-output'] };
  }
  const configDir = path.join(outDir, 'config');
  if (!fs.existsSync(configDir) || !fs.statSync(configDir).isDirectory()) {
    return { valid: false, missing: ['_bmad-output/config'] };
  }
  return { valid: true, missing: [] };
}

/**
 * Story 13.1: Validate .cursor for backward compat when no selectedAI (spec 鎼?.4).
 * Ensures .cursor exists with commands/, rules/, or agents/ subdir.
 * @param {string} [cwd] - Working directory to check.
 * @returns {{ valid: boolean, missing: string[] }} Validation result; missing lists absent paths.
 */
function validateCursorBackwardCompat(cwd) {
  const hasDir = (relPath, requiredSub) => {
    const full = path.join(cwd, relPath);
    if (!fs.existsSync(full)) return false;
    if (!requiredSub) return true;
    const sub = path.join(full, requiredSub);
    return fs.existsSync(sub) && fs.statSync(sub).isDirectory();
  };
  if (!hasDir('.cursor')) return { valid: false, missing: ['.cursor'] };
  if (!hasDir('.cursor', 'commands') && !hasDir('.cursor', 'rules') && !hasDir('.cursor', 'agents')) {
    return { valid: false, missing: ['.cursor must have commands/, rules/, or agents/'] };
  }
  return { valid: true, missing: [] };
}

/**
 * Story 13.1: detectCommand - collect installed AI tools.
 * Runs each registered AI's detectCommand and returns ids of those that return exit 0.
 * @param {string} [cwd] - Working directory for AIRegistry.load.
 * @returns {string[]} List of AI ids whose detectCommand succeeded.
 */
function detectInstalledAITools(cwd) {
  const list = AIRegistry.load({ cwd });
  const installed = [];
  for (const entry of list) {
    const cmd = entry?.detectCommand;
    if (!cmd || typeof cmd !== 'string') continue;
    const r = spawnSync(cmd, [], { shell: true, timeout: 5000 });
    if (r.status === 0) installed.push(entry.id);
  }
  return installed;
}

/**
 * Story 13.1: Build diagnosis report.
 * @param {string} [cwd] - Working directory for config and AI detection.
 * @param {{ ignoreAgentTools?: boolean }} [options] - If ignoreAgentTools is true, aiToolsInstalled is [].
 * @returns {{ cliVersion: string, templateVersion: string|null, selectedAI: string|null, subagentSupport: string, envVars: Record<string, string>, aiToolsInstalled: string[] }} Diagnosis report object.
 */
function buildDiagnoseReport(cwd, options) {
  const config = getProjectConfig(cwd);
  const selectedAI = config.selectedAI || null;
  const entry = selectedAI ? AIRegistry.getById(selectedAI, { cwd }) : null;
  const subagentSupport = entry?.configTemplate?.subagentSupport || 'unknown';

  const envVars = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (k.startsWith('CURSOR_') || k.startsWith('BMAD_') || k === 'PATH' || k === 'HOME') {
      envVars[k] = k === 'PATH' ? (v || '').substring(0, 100) + (v && v.length > 100 ? '...' : '') : v;
    }
  }

  return {
    cliVersion: pkg.version || '0.0.0',
    templateVersion: config.templateVersion || null,
    selectedAI,
    subagentSupport,
    envVars,
    aiToolsInstalled: options.ignoreAgentTools ? [] : detectInstalledAITools(cwd),
  };
}

/**
 * Check command handler. Validates bmadPath, selectedAI targets, _bmad-output structure.
 * Exits with exit code 4 if bmadPath invalid, 1 if selectedAI invalid, prints diagnosis on success.
 * @param {{ cwd?: string, listAi?: boolean, json?: boolean, ignoreAgentTools?: boolean }} [options] - Command options.
 * @returns {void} Does not return; process.exit on completion.
 */
function checkCommand(options = {}) {
  const cwd = options.cwd != null ? options.cwd : process.cwd();

  if (options.listAi) {
    const ids = AIRegistry.listIds({ cwd });
    if (options.json) {
      console.log(JSON.stringify(ids));
    } else {
      ids.forEach((id) => console.log(id));
    }
    process.exit(exitCodes.SUCCESS);
  }

  const config = getProjectConfig(cwd);
  const hasConfig = Object.keys(config).length > 0;
  const bmadPathRaw = getProjectBmadPath(cwd);
  const selectedAI = getProjectSelectedAI(cwd);

  const structureMissing = [];

  if (bmadPathRaw) {
    const bmadPath = path.resolve(cwd, bmadPathRaw);
    if (!fs.existsSync(bmadPath) || !fs.statSync(bmadPath).isDirectory()) {
      console.error('Error: bmadPath points to a path that does not exist or is not a directory:', bmadPath);
      process.exit(exitCodes.TARGET_PATH_UNAVAILABLE);
    }
    const structure = validateBmadStructure(bmadPath);
    if (!structure.valid) {
      console.error('Error: bmadPath structure does not match (need core/cursor/speckit/skills and cursor/commands, cursor/rules):', (structure.missing || []).join('; '));
      process.exit(exitCodes.TARGET_PATH_UNAVAILABLE);
    }
  } else {
    const bmadLocal = path.join(cwd, '_bmad');
    if (fs.existsSync(bmadLocal) && fs.statSync(bmadLocal).isDirectory()) {
      const structure = validateBmadStructure(bmadLocal);
      if (!structure.valid) structureMissing.push(...structure.missing);
    }
  }

  const bmadOutputResult = validateBmadOutput(cwd);
  if (!bmadOutputResult.valid) structureMissing.push(...bmadOutputResult.missing);

  if (hasConfig) {
    if (selectedAI) {
      const aiResult = validateSelectedAITargets(cwd, selectedAI);
      if (!aiResult.valid) structureMissing.push(...aiResult.missing);
    } else {
      const cursorResult = validateCursorBackwardCompat(cwd);
      if (!cursorResult.valid) structureMissing.push(...cursorResult.missing);
    }
  }

  if (structureMissing.length > 0) {
    console.error('Error: structure validation failed. Missing:', structureMissing.join('; '));
    process.exit(exitCodes.GENERAL_ERROR);
  }

  const report = buildDiagnoseReport(cwd, options);

  if (options.json) {
    console.log(JSON.stringify(report, null, 0));
  } else {
    console.log('CLI version:', report.cliVersion);
    console.log('Template version:', report.templateVersion || 'unknown');
    console.log('Selected AI:', report.selectedAI || 'none');
    console.log('Subagent support:', report.subagentSupport);
    if (report.aiToolsInstalled && report.aiToolsInstalled.length > 0) {
      console.log('Installed AI tools:', report.aiToolsInstalled.join(', '));
    }
    if (Object.keys(report.envVars).length > 0) {
      console.log('Key env vars:', JSON.stringify(report.envVars));
    }
    if (report.subagentSupport === 'none' || report.subagentSupport === 'limited') {
      console.log('Selected AI has no or limited subagent support; some BMAD/Speckit flows may be unavailable.');
      console.log('子代理支持等级: none/limited; party-mode and reviewer automation may be unavailable.');
    }
    console.log('Check OK.');
  }

  process.exit(exitCodes.SUCCESS);
}

module.exports = { checkCommand, validateSelectedAITargets };
