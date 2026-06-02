const fs = require('node:fs');
const path = require('node:path');

function requirementIndexPath(projectRoot) {
  return path.join(projectRoot, '_bmad-output', 'runtime', 'requirement-records', 'index.json');
}

function readJsonIfPresent(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    return {
      parseError: error instanceof Error ? error.message : String(error),
    };
  }
}

function inspectRuntimeState(projectRoot) {
  const indexPath = requirementIndexPath(projectRoot);
  const index = readJsonIfPresent(indexPath);
  if (!index) {
    return {
      source: 'none',
      indexPath: null,
      active: null,
      inventory: {
        hasRequirementIndex: false,
      },
    };
  }
  return {
    source: 'requirement-records-index',
    indexPath,
    active: index.active ?? null,
    inventory: {
      hasRequirementIndex: true,
      requirementSets: Object.keys(index.requirementSets ?? {}).length,
    },
  };
}

function hasRuntimeState(projectRoot) {
  return fs.existsSync(requirementIndexPath(projectRoot));
}

module.exports = {
  hasRuntimeState,
  inspectRuntimeState,
  requirementIndexPath,
};
