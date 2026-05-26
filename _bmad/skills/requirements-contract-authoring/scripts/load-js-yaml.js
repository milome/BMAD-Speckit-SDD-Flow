const path = require('node:path');
const { createRequire } = require('node:module');

function requireFrom(baseDir) {
  return createRequire(path.join(baseDir, 'package.json'))('js-yaml');
}

function loadJsYaml() {
  const candidates = [__dirname, process.cwd(), process.env.BMAD_SPECKIT_PACKAGE_ROOT].filter(Boolean);
  const errors = [];
  for (const candidate of candidates) {
    try {
      return requireFrom(candidate);
    } catch (error) {
      errors.push(`${candidate}: ${error.message}`);
    }
  }
  throw new Error(
    `Cannot resolve js-yaml from the skill directory, current project root, or BMAD_SPECKIT_PACKAGE_ROOT. Install js-yaml in the project running this skill, or run through the bmad-speckit package entrypoint.\n${errors.join('\n')}`
  );
}

module.exports = loadJsYaml();
