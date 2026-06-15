const fs = require('node:fs');
const path = require('node:path');

function unique(values) {
  const result = [];
  const seen = new Set();
  for (const value of values) {
    if (!value) continue;
    const resolved = path.resolve(value);
    if (!seen.has(resolved)) {
      seen.add(resolved);
      result.push(resolved);
    }
  }
  return result;
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

function resolveSharedRuntime() {
  const anchors = unique([
    process.env.BMAD_SPECKIT_PACKAGE_ROOT,
    process.cwd(),
    __dirname,
    ...ancestorDirs(process.cwd()),
    ...ancestorDirs(__dirname),
  ]);
  const candidates = [];
  for (const anchor of anchors) {
    candidates.push(path.join(anchor, '_bmad', 'shared', 'skill-runtime', 'resolve-bmad-runtime.js'));
    candidates.push(path.join(anchor, 'packages', 'bmad-speckit', '_bmad', 'shared', 'skill-runtime', 'resolve-bmad-runtime.js'));
    candidates.push(path.join(anchor, 'node_modules', 'bmad-speckit', '_bmad', 'shared', 'skill-runtime', 'resolve-bmad-runtime.js'));
    candidates.push(
      path.join(
        anchor,
        'node_modules',
        'bmad-speckit-sdd-flow',
        'node_modules',
        'bmad-speckit',
        '_bmad',
        'shared',
        'skill-runtime',
        'resolve-bmad-runtime.js'
      )
    );
  }

  const found = unique(candidates).find((candidate) => fs.existsSync(candidate));
  if (!found) {
    throw new Error(`Cannot resolve shared skill runtime. Checked: ${unique(candidates).join(', ')}`);
  }
  return require(found);
}

module.exports = resolveSharedRuntime();
