'use strict';

const fs = require('node:fs');
const path = require('node:path');

function resolveProjectRoot() {
  const configured = process.env.BMAD_PROJECT_ROOT || '.';
  return path.resolve(process.cwd(), configured);
}

function resolveServerConfigPath(projectRoot) {
  return path.resolve(
    projectRoot,
    process.env.BMAD_MCP_SERVER_CONFIG || '.runtime-mcp/server/config/server.config.json'
  );
}

function loadJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
  return JSON.parse(raw);
}

function smokePayload() {
  const projectRoot = resolveProjectRoot();
  const configPath = resolveServerConfigPath(projectRoot);
  const runtimeContextPath = path.join(projectRoot, '_bmad-output', 'runtime', 'context', 'project.json');
  return {
    ok: true,
    mode: 'smoke',
    projectRoot,
    configPath,
    configExists: fs.existsSync(configPath),
    runtimeContextPath,
    runtimeContextExists: fs.existsSync(runtimeContextPath),
    serverConfig: loadJsonIfExists(configPath),
  };
}

function main() {
  if (process.env.BMAD_PROJECT_ROOT) {
    try {
      process.chdir(resolveProjectRoot());
    } catch (error) {
      process.stderr.write(`[bmad-runtime] failed to chdir to project root: ${error.message}\n`);
      process.exit(1);
    }
  }

  if (process.argv.includes('--smoke')) {
    process.stdout.write(JSON.stringify(smokePayload()) + '\n');
    process.exit(0);
  }

  const projectRoot = resolveProjectRoot();
  const configPath = resolveServerConfigPath(projectRoot);
  process.stdin.resume();
  process.stderr.write(
    `[bmad-runtime] consumer MCP placeholder started. projectRoot=${projectRoot} config=${configPath}\n`
  );
}

main();
