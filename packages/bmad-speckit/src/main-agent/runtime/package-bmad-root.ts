import * as fs from 'node:fs';
import * as path from 'node:path';

function findPackageRoot(startDir: string): string | null {
  let current = path.resolve(startDir);
  let reachedFilesystemRoot = false;
  while (!reachedFilesystemRoot) {
    const packageJson = path.join(current, 'package.json');
    if (fs.existsSync(packageJson)) {
      const manifest = JSON.parse(fs.readFileSync(packageJson, 'utf8')) as { name?: string };
      if (manifest.name === 'bmad-speckit') return current;
    }
    const parent = path.dirname(current);
    reachedFilesystemRoot = parent === current;
    current = parent;
  }
  return null;
}

function defaultStartDirectories(): string[] {
  const candidates = [
    typeof __dirname === 'string' ? __dirname : '',
    process.argv[1] ? path.dirname(path.resolve(process.argv[1])) : '',
    process.cwd(),
    path.join(process.cwd(), 'packages', 'bmad-speckit'),
  ];
  return [...new Set(candidates.filter(Boolean).map((candidate) => path.resolve(candidate)))];
}

function resolvePackageRoot(startDir?: string): string {
  const candidates = startDir ? [path.resolve(startDir)] : defaultStartDirectories();
  for (const candidate of candidates) {
    const packageRoot = findPackageRoot(candidate);
    if (packageRoot) return packageRoot;
  }
  throw new Error(
    `Cannot resolve installed bmad-speckit package root from ${candidates.join(', ')}`
  );
}

export function resolvePackageBmadRoot(startDir?: string): string {
  const bmadRoot = path.join(resolvePackageRoot(startDir), '_bmad');
  if (!fs.existsSync(bmadRoot) || !fs.statSync(bmadRoot).isDirectory()) {
    throw new Error(`Installed bmad-speckit package _bmad owner missing: ${bmadRoot}`);
  }
  return bmadRoot;
}

export function resolvePackageOwnedBmadPath(
  ...segments: string[]
): string {
  return path.join(resolvePackageBmadRoot(), ...segments);
}

export function resolvePackageMainAgentModulePath(...segments: string[]): string {
  const packageRoot = resolvePackageRoot();
  const runtimeRoots = [
    path.join(packageRoot, 'dist', 'main-agent'),
    path.join(packageRoot, 'src', 'main-agent'),
  ];
  const candidates = runtimeRoots.flatMap((runtimeRoot) => {
    const basePath = path.join(runtimeRoot, ...segments);
    return path.extname(basePath)
      ? [basePath]
      : [`${basePath}.js`, `${basePath}.cjs`, `${basePath}.ts`];
  });
  const modulePath = candidates.find((candidate) => fs.existsSync(candidate));
  if (!modulePath) {
    throw new Error(
      `Installed bmad-speckit Main Agent module missing: ${segments.join(path.sep)}`
    );
  }
  return modulePath;
}

export function resolveConsumerBmadPath(
  projectRoot: string,
  ...segments: string[]
): string {
  return path.join(path.resolve(projectRoot), '_bmad', ...segments);
}
