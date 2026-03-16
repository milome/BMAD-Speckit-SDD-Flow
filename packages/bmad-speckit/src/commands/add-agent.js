/**
 * AddAgentCommand - add-agent subcommand
 * Add additional AI agent infrastructure to an already initialized project.
 * Runs SyncService + SkillPublisher for the new agent and appends to selectedAIs.
 */
const fs = require('fs');
const exitCodes = require('../constants/exit-codes');
const AIRegistry = require('../services/ai-registry');
const { getProjectConfigPath, set } = require('../services/config-manager');
const { readJsonSafe } = require('../utils/json');

/**
 * Add one or more AI agents to an existing project.
 * @param {string} aiArg - Comma-separated AI ids (e.g. 'claude' or 'cursor-agent,claude').
 * @param {{ cwd?: string }} [options]
 */
function addAgentCommand(aiArg, options = {}) {
  const cwd = options.cwd || process.cwd();

  const configPath = getProjectConfigPath(cwd);
  if (!fs.existsSync(configPath)) {
    console.error('Error: 项目未 init，请先执行 bmad-speckit init');
    process.exit(exitCodes.GENERAL_ERROR);
  }

  const config = readJsonSafe(configPath) || {};
  const existingAIs = Array.isArray(config.selectedAIs)
    ? config.selectedAIs
    : (config.selectedAI ? [config.selectedAI] : []);

  const { parseAIList, validateAIIds, syncAllAIs } = require('./init');
  const newAIs = parseAIList(aiArg);

  if (newAIs.length === 0) {
    console.error('Error: 请指定至少一个 AI，如 --ai claude');
    process.exit(exitCodes.AI_INVALID);
  }

  const { invalid } = validateAIIds(newAIs, cwd);
  if (invalid.length > 0) {
    const list = AIRegistry.listIds({ cwd }).join(', ');
    console.error(`Error: Invalid AI "${invalid.join(', ')}". Available: ${list}`);
    process.exit(exitCodes.AI_INVALID);
  }

  for (const aiId of newAIs) {
    if (aiId === 'generic') {
      const entry = AIRegistry.getById('generic', { cwd });
      const aiCommandsDir = entry?.aiCommandsDir;
      if (!aiCommandsDir || typeof aiCommandsDir !== 'string' || !aiCommandsDir.trim()) {
        console.error('Error: --ai generic requires aiCommandsDir in registry.');
        process.exit(exitCodes.AI_INVALID);
      }
    }
  }

  const alreadyInstalled = newAIs.filter((id) => existingAIs.includes(id));
  const toInstall = newAIs.filter((id) => !existingAIs.includes(id));

  if (alreadyInstalled.length > 0) {
    console.log(`Already installed: ${alreadyInstalled.join(', ')}`);
  }

  if (toInstall.length === 0) {
    console.log('No new agents to add.');
    process.exit(exitCodes.SUCCESS);
  }

  const bmadPath = config.bmadPath;
  const syncOpts = bmadPath ? { bmadPath } : {};
  syncAllAIs(cwd, toInstall, syncOpts);

  const mergedAIs = [...new Set([...existingAIs, ...toInstall])];
  set('selectedAIs', mergedAIs, { scope: 'project', cwd });
  set('selectedAI', mergedAIs[0], { scope: 'project', cwd });

  console.log(`✓ Added: ${toInstall.join(', ')}`);
  console.log(`Active agents: ${mergedAIs.join(', ')}`);
}

module.exports = { addAgentCommand };
