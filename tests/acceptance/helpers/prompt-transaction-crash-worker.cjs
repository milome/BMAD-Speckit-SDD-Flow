const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
require('ts-node').register({ transpileOnly: true,
  compilerOptions: { module: 'CommonJS', moduleResolution: 'node' } });

const [statePath, cut] = process.argv.slice(2);
const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
const hash = (file) => `sha256:${crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}`;
const sourceRoot = path.join(process.cwd(), 'packages/bmad-speckit/src/main-agent/source-authority/scripts');
const publisher = require(path.join(sourceRoot, 'requirements-contract-prompt-transaction-publisher.ts'));
const runner = require(path.join(sourceRoot, 'main-agent-compiled-prompt-runner.ts'));
const rename = fs.renameSync;
fs.renameSync = (from, to) => {
  rename(from, to);
  const target = String(to);
  if (cut === 'hold-control' && target === path.join(state.publicationOutDir, 'model_packet.json')) {
    fs.writeSync(1, JSON.stringify({ controlHeld: true, pid: process.pid }) + '\n');
    const deadline = Date.now() + 20000;
    while (!fs.existsSync(state.releasePath) && Date.now() < deadline) {
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50);
    }
    if (!fs.existsSync(state.releasePath)) process.exit(87);
  }
  const journalCut = cut === 'journal' && path.basename(target) === 'journal.json' &&
    target.includes('.publisher-publication-');
  const committedCut = cut === 'committed-journal' && path.basename(target) === 'journal.json' &&
    target.includes('.publisher-publication-') && JSON.parse(fs.readFileSync(target, 'utf8')).state === 'committed';
  if (journalCut || committedCut || target === path.join(state.publicationOutDir, cut) || target === state[cut]) {
    fs.writeSync(1, JSON.stringify({ interrupted: true, cut, pid: process.pid, target }) + '\n');
    process.exit(86);
  }
};

publisher.requirementsContractPromptTransactionPublishCommand({ ...state.options, json: false }, {
  runCompiledPrompt(input) {
    fs.mkdirSync(input.outDir, { recursive: true });
    const metadata = { entryScenario: 'main_agent_compile', entryExplicit: true,
      compilerIdentity: { path: state.installedGeneratorPath, hash: hash(state.installedGeneratorPath) } };
    const packet = { ...JSON.parse(state.rawArtifacts['model_packet.json']), ...metadata };
    const receipt = { ...JSON.parse(state.rawArtifacts['audit_receipt.json']), ...metadata };
    const goalPath = path.join(input.outDir, 'goal_execution.md');
    fs.writeFileSync(goalPath, state.rawArtifacts['goal_execution.md'], 'utf8');
    receipt.goalCommand.documentPath = goalPath;
    receipt.goalCommand.documentHash = hash(goalPath);
    receipt.goalCommand.commandText = `/goal Execute ${input.packetId} by following ${goalPath}.`;
    receipt.continuationDirective.directive = receipt.goalCommand.commandText;
    const writes = { 'model_packet.json': JSON.stringify(packet), 'audit_receipt.json': JSON.stringify(receipt),
      'human_prompt.txt': state.rawArtifacts['human_prompt.txt'] };
    for (const [name, text] of Object.entries(writes)) fs.writeFileSync(path.join(input.outDir, name), text, 'utf8');
    const actual = runner.runMainAgentCompiledPrompt(input);
    return { ...actual, runnerRef: { path: state.installedRunnerPath, hash: hash(state.installedRunnerPath) } };
  },
}).then((code) => {
  process.stdout.write(JSON.stringify({ interrupted: false, code }) + '\n');
  process.exitCode = code;
});
