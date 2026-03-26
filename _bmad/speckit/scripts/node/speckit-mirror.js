const fs = require('node:fs');
const path = require('node:path');

const MIRROR_RULES = [
  {
    sourceRoot: ['speckit', 'templates'],
    targetRoot: ['.specify', 'templates'],
  },
  {
    sourceRoot: ['speckit', 'workflows'],
    targetRoot: ['.specify', 'workflows'],
  },
  {
    sourceRoot: ['speckit', 'scripts', 'shell'],
    targetRoot: ['.specify', 'scripts'],
  },
  {
    sourceRoot: ['speckit', 'scripts', 'powershell'],
    targetRoot: ['.specify', 'scripts'],
  },
  {
    sourceRoot: ['speckit', 'commands'],
    targetRoot: ['.specify', 'templates', 'commands'],
    transformRelative(relativePath) {
      const parsed = path.parse(relativePath);
      const basename = parsed.base.startsWith('speckit.')
        ? parsed.base.slice('speckit.'.length)
        : parsed.base;
      return parsed.dir ? path.join(parsed.dir, basename) : basename;
    },
  },
];

function walkFiles(rootDir) {
  if (!fs.existsSync(rootDir) || !fs.statSync(rootDir).isDirectory()) {
    return [];
  }

  const files = [];
  const entries = fs.readdirSync(rootDir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(fullPath));
      continue;
    }
    files.push(fullPath);
  }
  return files;
}

function ensureDir(targetPath) {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
}

function removeEmptyDirectories(rootDir) {
  if (!fs.existsSync(rootDir) || !fs.statSync(rootDir).isDirectory()) {
    return;
  }

  const entries = fs.readdirSync(rootDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const childDir = path.join(rootDir, entry.name);
    removeEmptyDirectories(childDir);
    if (fs.readdirSync(childDir).length === 0) {
      fs.rmdirSync(childDir);
    }
  }
}

function normalizePath(filePath) {
  return path.normalize(filePath);
}

function buildSpecifyMirrorPlan({ bmadRoot, projectRoot }) {
  const entries = [];

  for (const rule of MIRROR_RULES) {
    const sourceRoot = path.join(bmadRoot, ...rule.sourceRoot);
    const targetRoot = path.join(projectRoot, ...rule.targetRoot);

    for (const sourcePath of walkFiles(sourceRoot)) {
      const relativePath = path.relative(sourceRoot, sourcePath);
      const targetRelativePath = rule.transformRelative
        ? rule.transformRelative(relativePath)
        : relativePath;
      const targetPath = path.join(targetRoot, targetRelativePath);

      entries.push({
        sourcePath,
        targetPath,
        sourceRelative: path.relative(projectRoot, sourcePath),
        targetRelative: path.relative(projectRoot, targetPath),
      });
    }
  }

  const managedRoots = [
    path.join(projectRoot, '.specify', 'templates'),
    path.join(projectRoot, '.specify', 'workflows'),
    path.join(projectRoot, '.specify', 'scripts'),
  ];

  return {
    entries,
    managedRoots,
  };
}

function emitLog(logger, message) {
  if (!logger) {
    return;
  }
  if (typeof logger === 'function') {
    logger(message);
    return;
  }
  if (typeof logger.log === 'function') {
    logger.log(message);
  }
}

function syncSpecifyMirror({ bmadRoot, projectRoot, logger }) {
  const plan = buildSpecifyMirrorPlan({ bmadRoot, projectRoot });
  const expectedTargets = new Set(plan.entries.map((entry) => normalizePath(entry.targetPath)));
  const syncedFiles = [];
  const removedFiles = [];

  for (const entry of plan.entries) {
    const sourceBuffer = fs.readFileSync(entry.sourcePath);
    const targetExists = fs.existsSync(entry.targetPath);
    const targetMatches =
      targetExists && sourceBuffer.equals(fs.readFileSync(entry.targetPath));

    if (!targetMatches) {
      ensureDir(entry.targetPath);
      fs.copyFileSync(entry.sourcePath, entry.targetPath);
      syncedFiles.push(entry.targetRelative);
      emitLog(logger, `Sync ${entry.sourceRelative} -> ${entry.targetRelative}`);
    }
  }

  for (const managedRoot of plan.managedRoots) {
    for (const targetPath of walkFiles(managedRoot)) {
      if (expectedTargets.has(normalizePath(targetPath))) {
        continue;
      }
      fs.unlinkSync(targetPath);
      removedFiles.push(path.relative(projectRoot, targetPath));
      emitLog(logger, `Remove stale ${path.relative(projectRoot, targetPath)}`);
    }
    removeEmptyDirectories(managedRoot);
  }

  fs.mkdirSync(path.join(projectRoot, '.specify', 'memory'), { recursive: true });

  return {
    plan,
    syncedFiles,
    removedFiles,
    fileCount: plan.entries.length,
  };
}

function verifySpecifyMirror({ bmadRoot, projectRoot }) {
  const plan = buildSpecifyMirrorPlan({ bmadRoot, projectRoot });
  const expectedTargets = new Set(plan.entries.map((entry) => normalizePath(entry.targetPath)));
  const issues = [];

  for (const entry of plan.entries) {
    if (!fs.existsSync(entry.targetPath)) {
      issues.push({
        type: 'missing',
        targetRelative: entry.targetRelative,
        sourceRelative: entry.sourceRelative,
      });
      continue;
    }

    const sourceBuffer = fs.readFileSync(entry.sourcePath);
    const targetBuffer = fs.readFileSync(entry.targetPath);
    if (!sourceBuffer.equals(targetBuffer)) {
      issues.push({
        type: 'mismatch',
        targetRelative: entry.targetRelative,
        sourceRelative: entry.sourceRelative,
      });
    }
  }

  for (const managedRoot of plan.managedRoots) {
    for (const targetPath of walkFiles(managedRoot)) {
      if (expectedTargets.has(normalizePath(targetPath))) {
        continue;
      }
      issues.push({
        type: 'extra',
        targetRelative: path.relative(projectRoot, targetPath),
      });
    }
  }

  return {
    ok: issues.length === 0,
    issues,
    plan,
  };
}

module.exports = {
  buildSpecifyMirrorPlan,
  syncSpecifyMirror,
  verifySpecifyMirror,
};
