const path = require('node:path');
const { createRequire } = require('node:module');

function requireFrom(baseDir) {
  return createRequire(path.join(baseDir, 'package.json'))('js-yaml');
}

function ancestorDirs(startDir) {
  const dirs = [];
  let current = path.resolve(startDir);
  while (true) {
    dirs.push(current);
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return dirs;
}

function installedPackageCandidates(startDir) {
  const packageNames = ['bmad-speckit-sdd-flow', 'bmad-speckit'];
  return ancestorDirs(startDir).flatMap((dir) =>
    packageNames.flatMap((name) => [
      path.join(dir, 'node_modules', name),
      path.join(dir, 'node_modules', name, 'node_modules', name),
    ])
  );
}

function loadJsYaml() {
  const candidates = [
    __dirname,
    process.cwd(),
    process.env.BMAD_SPECKIT_PACKAGE_ROOT,
    ...installedPackageCandidates(process.cwd()),
    ...installedPackageCandidates(__dirname),
  ].filter(Boolean);
  const uniqueCandidates = [...new Set(candidates.map((candidate) => path.resolve(candidate)))];
  const errors = [];
  for (const candidate of uniqueCandidates) {
    try {
      return requireFrom(candidate);
    } catch (error) {
      errors.push(`${candidate}: ${error.message}`);
    }
  }
  throw new Error(
    `Cannot resolve js-yaml from the skill directory, current project root, BMAD_SPECKIT_PACKAGE_ROOT, or installed bmad-speckit package roots. Install bmad-speckit-sdd-flow/bmad-speckit normally or set BMAD_SPECKIT_PACKAGE_ROOT.\n${errors.join('\n')}`
  );
}

module.exports = loadJsYaml();
