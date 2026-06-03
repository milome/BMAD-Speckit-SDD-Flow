#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

function printHelp() {
  process.stdout.write(
    [
      'Usage: bmad-speckit write-runtime-context <targetFile> [flow] [stage] [templateId] [epicId] [storyId] [storySlug] [runId] [artifactRoot] [contextScope] [workflow] [step] [artifactPath]',
      '',
      'Writes a runtime context JSON file from the installed package helper.',
      '',
    ].join('\n')
  );
}

function nonEmpty(value) {
  return value !== undefined && String(value).trim() !== '';
}

function writeAtomicJson(targetFile, payload) {
  fs.mkdirSync(path.dirname(targetFile), { recursive: true });
  const tmp = `${targetFile}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  let fd = fs.openSync(tmp, 'r+');
  try {
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  fs.renameSync(tmp, targetFile);
  fd = fs.openSync(targetFile, 'r+');
  try {
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
}

function buildPayload(argv) {
  const [
    targetFileArg,
    flow = 'story',
    stage = 'specify',
    templateId,
    epicId,
    storyId,
    storySlug,
    runId,
    artifactRoot,
    contextScope,
    workflow,
    step,
    artifactPath,
  ] = argv;
  if (!nonEmpty(targetFileArg)) {
    throw new Error('write-runtime-context requires <targetFile>');
  }
  const payload = {
    version: 1,
    flow: String(flow).trim(),
    stage: String(stage).trim(),
    updatedAt: new Date().toISOString(),
  };
  for (const [key, value] of Object.entries({
    templateId,
    epicId,
    storyId,
    storySlug,
    runId,
    artifactRoot,
    workflow,
    step,
    artifactPath,
  })) {
    if (nonEmpty(value)) payload[key] = String(value).trim();
  }
  if (nonEmpty(contextScope) && ['project', 'story'].includes(String(contextScope).trim())) {
    payload.contextScope = String(contextScope).trim();
  }
  return {
    targetFile: path.resolve(targetFileArg),
    payload,
  };
}

function main(argv = process.argv.slice(2)) {
  if (argv.includes('--help') || argv.includes('-h')) {
    printHelp();
    return 0;
  }
  try {
    const { targetFile, payload } = buildPayload(argv);
    writeAtomicJson(targetFile, payload);
    process.stdout.write(`Wrote ${targetFile}\n`);
    return 0;
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    return 1;
  }
}

module.exports = {
  buildPayload,
  main,
};

if (require.main === module) {
  process.exitCode = main();
}
