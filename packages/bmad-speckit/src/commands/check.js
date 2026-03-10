/**
 * CheckCommand - check subcommand (ARCH §3.2, Story 10.5, 12.1, 12.2, 13.1)
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

function getProjectBmadPath(cwd) {
  const config = getProjectConfig(cwd);
  const bmadPath = config.bmadPath;
  if (bmadPath != null && typeof bmadPath === 'string') return bmadPath;
  return undefined;
}

function getProjectSelectedAI(cwd) {
  const config = getProjectConfig(cwd);
  return config.selectedAI;
}

/**
 * Story 12.2: Validate selectedAI target directories per spec §4.2 / PRD §5.5
 * @returns {{ valid: boolean, missing: string[] }}
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

  if (selectedAI === 'cursor-agent') {
    if (!hasDir('.cursor')) missing.push('.cursor');
    else {
      const hasCmd = hasDir('.cursor', 'commands');
      const hasRules = hasDir('.cursor', 'rules');
      const hasAgents = hasDir('.cursor', 'agents');
      if (!hasCmd && !hasRules && !hasAgents) missing.push('.cursor must have commands/, rules/, or agents/');
    }
  } else if (selectedAI === 'claude') {
    if (!hasDir('.claude')) missing.push('.claude');
    else {
      const hasCmd = hasDir('.claude', 'commands');
      const hasRules = hasDir('.claude', 'rules');
      if (!hasCmd && !hasRules) missing.push('.claude must have commands/ or rules/');
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
    else if (!hasDir('.codex', 'commands')) missing.push('.codex/commands');
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
 * Story 13.1: Validate _bmad-output exists and contains config/
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
 * Story 13.1: Validate .cursor for backward compat when no selectedAI (spec §5.4)
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
 * Story 13.1: detectCommand - collect installed AI tools
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
 * Story 13.1: Build diagnosis report
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
 * Check command handler
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
    console.log('子代理支持等级:', report.subagentSupport);
    if (report.aiToolsInstalled && report.aiToolsInstalled.length > 0) {
      console.log('Installed AI tools:', report.aiToolsInstalled.join(', '));
    }
    if (Object.keys(report.envVars).length > 0) {
      console.log('Key env vars:', JSON.stringify(report.envVars));
    }
    if (report.subagentSupport === 'none' || report.subagentSupport === 'limited') {
      console.log('所选 AI 不支持或仅部分支持子代理，BMAD/Speckit 全流程（party-mode、审计子任务等）可能不可用');
    }
    console.log('Check OK.');
  }

  process.exit(exitCodes.SUCCESS);
}

module.exports = { checkCommand, validateSelectedAITargets };
