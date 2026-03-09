/**
 * CheckCommand - check subcommand (ARCH §3.2, Story 10.5, 12.1, 12.2)
 * - bmadPath: validate path exists and structure; exit 4 if not.
 * - selectedAI: validate target directories per configTemplate; exit 1 if not.
 * - --list-ai: list available AI ids from AIRegistry.
 */
const fs = require('fs');
const path = require('path');
const exitCodes = require('../constants/exit-codes');
const { validateBmadStructure } = require('../utils/structure-validate');
const AIRegistry = require('../services/ai-registry');

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
  } else if (ct.commandsDir || ct.rulesDir) {
    const root = ct.commandsDir ? path.dirname(ct.commandsDir) : path.dirname(ct.rulesDir);
    const full = path.join(cwd, root);
    if (!fs.existsSync(full)) missing.push(root);
  }

  return { valid: missing.length === 0, missing };
}

/**
 * Check command handler
 */
function checkCommand(options = {}) {
  const cwd = options.cwd != null ? options.cwd : process.cwd();

  if (options.listAi) {
    const ids = AIRegistry.listIds({ cwd });
    console.log(ids.join('\n'));
    process.exit(exitCodes.SUCCESS);
  }

  const bmadPathRaw = getProjectBmadPath(cwd);
  const selectedAI = getProjectSelectedAI(cwd);

  if (bmadPathRaw) {
    const bmadPath = path.resolve(bmadPathRaw);
    const structure = validateBmadStructure(bmadPath);
    if (!structure.valid) {
      if (structure.missing.some((m) => m.includes('does not exist') || m.includes('path is required'))) {
        console.error('Error: bmadPath points to a path that does not exist or is not a directory:', bmadPath);
      } else {
        console.error('Error: bmadPath structure invalid. Missing:', (structure.missing || []).join('; '));
      }
      process.exit(exitCodes.TARGET_PATH_UNAVAILABLE);
    }
  } else {
    const bmadLocal = path.join(cwd, '_bmad');
    if (fs.existsSync(bmadLocal) && fs.statSync(bmadLocal).isDirectory()) {
      const structure = validateBmadStructure(bmadLocal);
      if (!structure.valid) {
        console.error('Error: _bmad structure invalid. Missing:', (structure.missing || []).join('; '));
        process.exit(exitCodes.GENERAL_ERROR);
      }
    }
  }

  if (selectedAI) {
    const aiResult = validateSelectedAITargets(cwd, selectedAI);
    if (!aiResult.valid) {
      console.error('Error: selectedAI target directories invalid. Missing:', aiResult.missing.join('; '));
      process.exit(exitCodes.GENERAL_ERROR);
    }
    const entry = AIRegistry.getById(selectedAI, { cwd });
    const support = entry?.configTemplate?.subagentSupport || 'unknown';
    console.log('子代理支持等级:', support);
    if (support === 'none' || support === 'limited') {
      console.log('所选 AI 不支持或仅部分支持子代理，BMAD/Speckit 全流程（party-mode、code-reviewer、mcp_task 等）可能无法正常运行；建议使用支持子代理的 AI（如 cursor-agent、claude）');
    }
  }

  console.log('Check OK.');
  process.exit(exitCodes.SUCCESS);
}

module.exports = { checkCommand, validateSelectedAITargets };
