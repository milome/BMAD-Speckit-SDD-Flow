#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

function take(args, name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function has(args, name) {
  return args.includes(name);
}

function sha256File(filePath) {
  return `sha256:${crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex')}`;
}

function normalize(filePath) {
  return path.resolve(filePath).replace(/\\/g, '/');
}

function readJsonIfExists(filePath, blockingReasons, code) {
  if (!filePath || !fs.existsSync(filePath)) {
    blockingReasons.push(code);
    return null;
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function checkGoalContractReleaseGate({
  source,
  goal,
  coverage,
  generation,
}) {
  const blockingReasons = [];
  if (!source || !fs.existsSync(source)) blockingReasons.push('source_plan_missing');
  if (!goal || !fs.existsSync(goal)) blockingReasons.push('goal_contract_missing');
  const coverageReceipt = readJsonIfExists(coverage, blockingReasons, 'coverage_receipt_missing');
  const generationReceipt = readJsonIfExists(generation, blockingReasons, 'generation_receipt_missing');

  const sourceHash = source && fs.existsSync(source) ? sha256File(source) : null;
  const goalHash = goal && fs.existsSync(goal) ? sha256File(goal) : null;

  if (coverageReceipt) {
    if (sourceHash && coverageReceipt.sourcePlanHash !== sourceHash) blockingReasons.push('source_hash_mismatch');
    if (goalHash && coverageReceipt.goalContractHash !== goalHash) blockingReasons.push('goal_contract_hash_mismatch');
    if ((coverageReceipt.unmappedSourceObligations ?? []).length > 0) {
      blockingReasons.push('unmapped_source_obligations');
    }
    if (coverageReceipt.decision !== 'pass') blockingReasons.push('coverage_decision_not_pass');
  }

  if (generationReceipt) {
    if (sourceHash && generationReceipt.sourcePlanHash !== sourceHash) blockingReasons.push('generation_source_hash_mismatch');
    if (goalHash && generationReceipt.goalContractHash !== goalHash) blockingReasons.push('generation_goal_hash_mismatch');
    if (generationReceipt.unmappedSourceObligations !== 0) {
      blockingReasons.push('generation_unmapped_source_obligations');
    }
    if (!generationReceipt.coverageReceiptPath) blockingReasons.push('generation_coverage_receipt_path_missing');
  }

  return {
    ok: blockingReasons.length === 0,
    decision: blockingReasons.length === 0 ? 'pass' : 'blocked',
    blockingReasons,
    sourcePlanPath: source ? normalize(source) : null,
    goalContractPath: goal ? normalize(goal) : null,
    coverageReceiptPath: coverage ? normalize(coverage) : null,
    generationReceiptPath: generation ? normalize(generation) : null,
    sourcePlanHash: sourceHash,
    goalContractHash: goalHash,
    unmappedSourceObligations: coverageReceipt?.unmappedSourceObligations?.length ?? null,
  };
}

function main(argv = process.argv.slice(2)) {
  const result = checkGoalContractReleaseGate({
    source: take(argv, '--source'),
    goal: take(argv, '--goal'),
    coverage: take(argv, '--coverage'),
    generation: take(argv, '--generation'),
  });
  const output = has(argv, '--json')
    ? JSON.stringify(result, null, 2)
    : `${result.decision.toUpperCase()}: ${result.blockingReasons.join(', ') || 'goal contract coverage proof current'}`;
  process.stdout.write(`${output}\n`);
  return result.ok ? 0 : 1;
}

if (require.main === module) {
  process.exitCode = main();
}

module.exports = {
  checkGoalContractReleaseGate,
};
