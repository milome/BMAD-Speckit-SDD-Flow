$script = @'
const fs = require('node:fs');
const source = fs.readFileSync('packages/bmad-speckit/bin/bmad-speckit.js', 'utf8');
const rootShim = fs.readFileSync('scripts/bmad-speckit-cli.js', 'utf8');
const covered = [
  'main-agent',
  'main-agent-orchestration',
  'confirm-scope',
  'main-agent:confirm-scope',
];

function fail(message) {
  console.error(message);
  process.exit(1);
}

function commandBlock(command) {
  const patterns = [
    ".command('" + command + "'",
    '.command("' + command + '"',
    ".command('" + command + ' ',
    '.command("' + command + ' ',
  ];
  const starts = patterns
    .map((pattern) => source.indexOf(pattern))
    .filter((index) => index !== -1);
  const start = starts.length === 0 ? -1 : Math.min(...starts);
  if (start === -1) {
    fail('missing covered command ' + command);
  }
  const next = source.indexOf('\nprogram', start + 1);
  return source.slice(start, next === -1 ? source.length : next);
}

for (const command of covered) {
  const block = commandBlock(command);
  if (!block.includes('../dist/main-agent/index.js')) {
    fail('covered command ' + command + ' does not use dist runtime');
  }
  if (/runRepoScript\(|scripts[\\/]main-agent-orchestration\.ts|\btsx\b|ts-node/.test(block)) {
    fail('covered command ' + command + ' still uses source-dev runtime');
  }
}

if (!rootShim.includes('node_modules') || !rootShim.includes('bmad-speckit') || !rootShim.includes('bin')) {
  fail('root bin shim does not forward to package CLI');
}
if (/runRepoScript\(|scripts[\\/]main-agent-orchestration\.ts|\btsx\b|ts-node/.test(rootShim)) {
  fail('root bin shim still exposes source-dev Main Agent runtime');
}
'@

node -e $script
