import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, execSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

describe('runtime-emit pack contract', () => {
  it('cleans stale dist files before build and packs only manifest-listed bundles', () => {
    const packageRoot = path.join(process.cwd(), 'packages', 'runtime-emit');
    const stalePath = path.join(packageRoot, 'dist', 'governance-runtime-worker.cjs');
    fs.mkdirSync(path.dirname(stalePath), { recursive: true });
    fs.writeFileSync(stalePath, 'stale', 'utf8');

    execFileSync(process.execPath, ['build.js'], { cwd: packageRoot, stdio: 'pipe' });

    expect(fs.existsSync(stalePath)).toBe(false);
    const manifest = JSON.parse(
      fs.readFileSync(path.join(packageRoot, 'dist', 'build-manifest.json'), 'utf8')
    ) as { files: string[] };
    expect(manifest.files).toContain('emit-runtime-policy.cjs');

    const packOutput = execSync('npm pack --dry-run --json', {
      cwd: packageRoot,
      encoding: 'utf8',
    });
    const jsonStart = packOutput.search(/^\[\s*\{/m);
    expect(jsonStart).toBeGreaterThanOrEqual(0);
    let depth = 0;
    let inString = false;
    let escaped = false;
    let jsonEnd = -1;
    for (let index = jsonStart; index < packOutput.length; index += 1) {
      const char = packOutput[index];
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === '\\') {
        escaped = true;
        continue;
      }
      if (char === '"') {
        inString = !inString;
        continue;
      }
      if (inString) continue;
      if (char === '[') depth += 1;
      if (char === ']') {
        depth -= 1;
        if (depth === 0) {
          jsonEnd = index + 1;
          break;
        }
      }
    }
    expect(jsonEnd).toBeGreaterThan(jsonStart);
    const parsedPackOutput = JSON.parse(packOutput.slice(jsonStart, jsonEnd)) as Array<{
      files: Array<{ path: string }>;
    }>;
    const packEntry = parsedPackOutput.find(
      (entry) => Array.isArray(entry.files) && entry.files.some((file) => file.path === 'package.json')
    );
    expect(packEntry).toBeDefined();
    const paths = packEntry!.files.map((file) => file.path);
    expect(paths).not.toContain('dist/governance-runtime-worker.cjs');
    for (const file of manifest.files) {
      expect(paths).toContain(`dist/${file}`);
    }
  }, 120_000);
});
