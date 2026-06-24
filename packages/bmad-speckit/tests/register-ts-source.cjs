const Module = require('node:module');
const fs = require('node:fs');
const path = require('node:path');

require('ts-node/register/transpile-only');

const packageRoot = path.resolve(__dirname, '..');
const originalResolveFilename = Module._resolveFilename;

function resolvePackageSource(request, parent) {
  if (!request.startsWith('../src/') && !request.startsWith('../../src/')) return null;
  const parentDir = parent?.filename ? path.dirname(parent.filename) : __dirname;
  const base = path.resolve(parentDir, request);
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
      resolved.startsWith(path.join(packageRoot, 'src') + path.sep) &&
      fs.existsSync(resolved) &&
      fs.statSync(resolved).isFile()
    ) {
      return resolved;
    }
  }
  return null;
}

Module._resolveFilename = function resolveFilename(request, parent, isMain, options) {
  const sourcePath = resolvePackageSource(request, parent);
  if (sourcePath) return sourcePath;
  return originalResolveFilename.call(this, request, parent, isMain, options);
};
