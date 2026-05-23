const path = require('node:path');
const { createRequire } = require('node:module');

function requireFrom(baseDir) {
  return createRequire(path.join(baseDir, 'package.json'))('js-yaml');
}

function loadJsYaml() {
  const candidates = [__dirname, process.cwd()];
  const errors = [];
  for (const candidate of candidates) {
    try {
      return requireFrom(candidate);
    } catch (error) {
      errors.push(`${candidate}: ${error.message}`);
    }
  }
  throw new Error(
    `Cannot resolve js-yaml from the skill directory or current project root. Install js-yaml in the project running this skill, or run from a workspace that provides it.\n${errors.join('\n')}`
  );
}

module.exports = loadJsYaml();
