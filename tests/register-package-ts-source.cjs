const Module = require('node:module');
const fs = require('node:fs');
const path = require('node:path');

require('ts-node/register/transpile-only');

const repoRoot = path.resolve(__dirname, '..');
const packageSourceRoot = path.join(repoRoot, 'packages', 'bmad-speckit', 'src');
const originalResolveFilename = Module._resolveFilename;

function resolvePackageTypeScriptSource(request, parent) {
  if (!request.startsWith('.')) return null;
  const parentFile = parent?.filename ? path.resolve(parent.filename) : '';
  const base = path.resolve(path.dirname(parentFile), request);
  if (!base.startsWith(`${packageSourceRoot}${path.sep}`)) return null;
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    path.join(base, 'index.ts'),
    path.join(base, 'index.tsx'),
  ];

  for (const candidate of candidates) {
    const resolved = path.resolve(candidate);
    if (
      resolved.startsWith(`${packageSourceRoot}${path.sep}`) &&
      fs.existsSync(resolved) &&
      fs.statSync(resolved).isFile()
    ) {
      return resolved;
    }
  }

  return null;
}

Module._resolveFilename = function resolveFilename(request, parent, isMain, options) {
  const sourcePath = resolvePackageTypeScriptSource(request, parent);
  if (sourcePath) return sourcePath;
  return originalResolveFilename.call(this, request, parent, isMain, options);
};
