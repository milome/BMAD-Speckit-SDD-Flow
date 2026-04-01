import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const root = __dirname;
const entryFile = path.join(root, 'src', 'main.jsx');
const outfile = path.join(root, 'app.js');
const inputCss = path.join(root, 'src', 'styles.css');
const outputCss = path.join(root, 'styles.css');

const esbuildCli = process.platform === 'win32'
  ? path.join(root, '..', '..', '..', '..', 'node_modules', '.bin', 'esbuild.cmd')
  : path.join(root, '..', '..', '..', '..', 'node_modules', '.bin', 'esbuild');

const tailwindBinary = process.platform === 'win32'
  ? path.join(root, '..', '..', '..', '..', 'node_modules', '.bin', 'tailwindcss.cmd')
  : path.join(root, '..', '..', '..', '..', 'node_modules', '.bin', 'tailwindcss');

const cssBuild = spawnSync(tailwindBinary, ['-i', inputCss, '-o', outputCss], {
  cwd: root,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

if (cssBuild.status !== 0) {
  throw new Error(`tailwind build failed with exit code ${cssBuild.status ?? 'unknown'}`);
}

const jsBuild = spawnSync(esbuildCli, [
  entryFile,
  '--bundle',
  '--format=esm',
  '--platform=browser',
  '--target=es2022',
  `--outfile=${outfile}`,
  '--jsx=automatic',
  '--minify',
  '--log-level=info',
  '--external:tailwindcss',
  '--loader:.js=jsx',
  '--loader:.jsx=jsx',
], {
  cwd: root,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

if (jsBuild.status !== 0) {
  throw new Error(`esbuild cli failed with exit code ${jsBuild.status ?? 'unknown'}`);
}

for (const emittedCssName of ['app.css', 'app.js.css']) {
  const emittedCss = path.join(root, emittedCssName);
  if (fs.existsSync(emittedCss)) {
    fs.rmSync(emittedCss, { force: true });
  }
}
