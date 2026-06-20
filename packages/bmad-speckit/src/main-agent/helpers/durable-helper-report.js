const fs = require('node:fs');
const path = require('node:path');

const sourceAuthorityHelperCache = new Map();

function packageRoot() {
  return path.resolve(__dirname, '..', '..', '..');
}

function sourceAuthorityRoots() {
  const root = packageRoot();
  return [
    path.join(root, 'dist', 'main-agent', 'source-authority', 'scripts'),
    path.join(root, 'src', 'main-agent', 'source-authority', 'scripts'),
  ];
}

function collectFiles(root) {
  if (!fs.existsSync(root)) return [];
  const out = [];
  const stack = [root];
  while (stack.length > 0) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(fullPath);
      else if (entry.isFile() && entry.name.endsWith('.js')) out.push(fullPath);
    }
  }
  return out.sort();
}

function helperSourceAuthorityCandidates(helperId) {
  const normalized = String(helperId || '').trim();
  return [`${normalized}.js`, `main-agent-${normalized}.js`];
}

function findSourceAuthorityHelper(helperId) {
  const cacheKey = String(helperId || '');
  if (sourceAuthorityHelperCache.has(cacheKey)) return sourceAuthorityHelperCache.get(cacheKey);
  const candidates = new Set(helperSourceAuthorityCandidates(cacheKey));
  for (const root of sourceAuthorityRoots()) {
    for (const file of collectFiles(root)) {
      if (candidates.has(path.basename(file))) {
        sourceAuthorityHelperCache.set(cacheKey, file);
        return file;
      }
    }
  }
  sourceAuthorityHelperCache.set(cacheKey, null);
  return null;
}

function loadSourceAuthorityHelper(helperId) {
  const runtimePath = findSourceAuthorityHelper(helperId);
  if (!runtimePath) {
    return {
      status: 'missing_source_authority_helper',
      runtimePath: null,
      exportedKeys: [],
      usedRootScript: false,
      usedCompiledFallback: false,
      usedTypeScriptRunner: false,
    };
  }
  try {
    const loaded = require(runtimePath);
    return {
      status: 'source_authority_helper_loaded',
      runtimePath: path.relative(packageRoot(), runtimePath).replace(/\\/g, '/'),
      exportedKeys: Object.keys(loaded).sort(),
      usedRootScript: false,
      usedCompiledFallback: false,
      usedTypeScriptRunner: false,
    };
  } catch (error) {
    return {
      status: 'source_authority_helper_load_error',
      runtimePath: path.relative(packageRoot(), runtimePath).replace(/\\/g, '/'),
      exportedKeys: [],
      error: error instanceof Error ? error.message : String(error),
      usedRootScript: false,
      usedCompiledFallback: false,
      usedTypeScriptRunner: false,
    };
  }
}

function createDurableHelperDescriptor({ helperId, purpose, ownedFiles = [] }) {
  return function durableHelperDescriptor(context = {}) {
    const cwd = String(context.cwd || process.cwd());
    const sourceAuthorityRuntimeProof = loadSourceAuthorityHelper(helperId);
    return {
      schemaVersion: 'main-agent-durable-helper/v1',
      helperId,
      cwd,
      mode: 'durable_helper_copy',
      targetSurface: 'package_main_agent_helper',
      publicCliAction: false,
      supportedConsumerInvocation: null,
      purpose,
      ownedFiles,
      consumerRuntimeProof: {
        usedRootScript: false,
        usedCompiledFallback: false,
        usedTypeScriptRunner: false,
      },
      sourceAuthorityRuntimeProof,
    };
  };
}

module.exports = {
  createDurableHelperDescriptor,
};
