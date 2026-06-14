const fs = require('node:fs');
const writer = require('../utils/large-document-writer');

function take(args, name, fallback = undefined) {
  const index = args.indexOf(name);
  if (index === -1) return fallback;
  return args[index + 1];
}

function takeAll(args, name) {
  const values = [];
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === name && args[index + 1] !== undefined) values.push(args[index + 1]);
  }
  return values;
}

function has(args, name) {
  return args.includes(name);
}

function parseChunkPlan(args) {
  return takeAll(args, '--chunk').map((value) => {
    const [chunkId, sectionId, extra] = String(value).split(':');
    if (!chunkId || !sectionId || extra !== undefined) {
      throw new Error('--chunk must be chunkId:sectionId');
    }
    return { chunkId, sectionId };
  });
}

function parseInteger(args, name) {
  const value = take(args, name);
  if (value === undefined) return undefined;
  if (!/^\d+$/u.test(String(value))) {
    throw new Error(`${name} must be a non-negative integer`);
  }
  return Number(value);
}

function emitJson(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function requireValue(value, name) {
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function largeDocCommand(_opts = {}, forwardedArgs = []) {
  const args = [...forwardedArgs];
  const command = args.shift();
  if (!command || command === 'help' || command === '--help') {
    process.stdout.write('Usage: bmad-speckit large-doc <init|status|add-chunk|assemble|validate|promote|cleanup> --json\n');
    return 0;
  }

  const json = has(args, '--json');
  let result;

  if (command === 'init') {
    result = writer.initSession({
      targetPath: requireValue(take(args, '--target'), '--target'),
      mode: take(args, '--mode', 'create'),
      profile: take(args, '--profile', 'markdown'),
      chunkPlan: parseChunkPlan(args),
      requiredHeadings: takeAll(args, '--require-heading'),
      requiredFragments: takeAll(args, '--require-fragment'),
      forbiddenFragments: takeAll(args, '--forbidden-fragment'),
      allowPlaceholders: !has(args, '--no-placeholders'),
      minBytes: parseInteger(args, '--min-bytes') ?? 0,
      minLines: parseInteger(args, '--min-lines') ?? 0,
    });
  } else if (command === 'status') {
    result = writer.getSessionStatus({ sessionDir: requireValue(take(args, '--session'), '--session') });
  } else if (command === 'add-chunk') {
    result = writer.addChunk({
      sessionDir: requireValue(take(args, '--session'), '--session'),
      chunkId: requireValue(take(args, '--chunk-id'), '--chunk-id'),
      sectionId: requireValue(take(args, '--section-id'), '--section-id'),
      content: fs.readFileSync(requireValue(take(args, '--content-file'), '--content-file'), 'utf8'),
    });
  } else if (command === 'assemble') {
    result = writer.assembleSession({ sessionDir: requireValue(take(args, '--session'), '--session') });
  } else if (command === 'validate') {
    result = writer.validateAssembly({ sessionDir: requireValue(take(args, '--session'), '--session') });
  } else if (command === 'promote') {
    result = writer.promoteAssembly({ sessionDir: requireValue(take(args, '--session'), '--session') });
  } else if (command === 'cleanup') {
    result = writer.cleanupSession({
      sessionDir: requireValue(take(args, '--session'), '--session'),
      policy: take(args, '--policy', 'keep'),
    });
  } else {
    throw new Error(`unknown large-doc subcommand: ${command}`);
  }

  if (json) emitJson(result);
  else process.stdout.write(`${result.schemaVersion || 'large-doc'} OK\n`);
  return 0;
}

module.exports = {
  largeDocCommand,
};
