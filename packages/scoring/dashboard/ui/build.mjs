import { build } from 'esbuild';
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

await build({
  entryPoints: [entryFile],
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: ['es2022'],
  outfile,
  absWorkingDir: root,
  conditions: ['browser', 'import', 'style'],
  loader: {
    '.js': 'jsx',
    '.jsx': 'jsx',
  },
  jsx: 'automatic',
  sourcemap: false,
  minify: true,
  logLevel: 'info',
});

for (const emittedCssName of ['app.css', 'app.js.css']) {
  const emittedCss = path.join(root, emittedCssName);
  if (fs.existsSync(emittedCss)) {
    fs.rmSync(emittedCss, { force: true });
  }
}
