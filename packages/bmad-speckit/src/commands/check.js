/**
 * CheckCommand - check subcommand (ARCH §3.2, Story 10.5, 12.1)
 * When bmad-speckit.json has bmadPath, validate that path exists and structure matches; exit 4 if not.
 * --list-ai: list available AI ids from AIRegistry.
 */
const path = require('path');
const exitCodes = require('../constants/exit-codes');
const { validateBmadStructure } = require('../utils/structure-validate');
const AIRegistry = require('../services/ai-registry');

function getProjectBmadPath(cwd) {
  const configManager = require('../services/config-manager');
  try {
    const bmadPath = configManager.get('bmadPath', { cwd });
    if (bmadPath != null && typeof bmadPath === 'string') return bmadPath;
  } catch (_) {}
  return undefined;
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

  if (!bmadPathRaw) {
    console.log('No project bmadPath (not a worktree init). OK.');
    process.exit(exitCodes.SUCCESS);
  }

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
  console.log('Check OK: bmadPath valid.');
  process.exit(exitCodes.SUCCESS);
}

module.exports = { checkCommand };
