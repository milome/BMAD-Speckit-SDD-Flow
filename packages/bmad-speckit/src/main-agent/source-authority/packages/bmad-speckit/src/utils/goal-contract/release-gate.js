const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

function take(args, name) {
  const index = args.indexOf(name);
  if (index < 0) return undefined;
  const value = args[index + 1];
  if (!value || value.startsWith('-')) return undefined;
  return value;
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

function readJsonIfExists(filePath, blockingReasons, missingCode, invalidCode) {
  if (!filePath || !fs.existsSync(filePath)) {
    blockingReasons.push(missingCode);
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    blockingReasons.push(invalidCode);
    return null;
  }
}

function checkArrayField(value, fieldName, blockingReasons) {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null) {
    blockingReasons.push(`${fieldName}_missing`);
    return [];
  }
  blockingReasons.push(`${fieldName}_not_array`);
  return [];
}

function checkGoalContractReleaseGate({ source, goal, coverage, generation }) {
  const blockingReasons = [];
  if (!source || !fs.existsSync(source)) blockingReasons.push('source_plan_missing');
  if (!goal || !fs.existsSync(goal)) blockingReasons.push('goal_contract_missing');
  const coverageReceipt = readJsonIfExists(
    coverage,
    blockingReasons,
    'coverage_receipt_missing',
    'coverage_receipt_invalid_json'
  );
  const generationReceipt = readJsonIfExists(
    generation,
    blockingReasons,
    'generation_receipt_missing',
    'generation_receipt_invalid_json'
  );

  const sourceHash = source && fs.existsSync(source) ? sha256File(source) : null;
  const goalHash = goal && fs.existsSync(goal) ? sha256File(goal) : null;

  if (coverageReceipt) {
    if (sourceHash && coverageReceipt.sourcePlanHash !== sourceHash) blockingReasons.push('source_hash_mismatch');
    if (goalHash && coverageReceipt.goalContractHash !== goalHash) blockingReasons.push('goal_contract_hash_mismatch');
    const unmappedSourceObligations = checkArrayField(
      coverageReceipt.unmappedSourceObligations,
      'coverage_unmapped_source_obligations',
      blockingReasons
    );
    const orphanGeneratedRefs = checkArrayField(
      coverageReceipt.orphanGeneratedRefs,
      'coverage_orphan_generated_refs',
      blockingReasons
    );
    const coverageBlockingReasons = checkArrayField(
      coverageReceipt.blockingReasons,
      'coverage_blocking_reasons',
      blockingReasons
    );
    if (unmappedSourceObligations.length > 0) {
      blockingReasons.push('unmapped_source_obligations');
    }
    if (orphanGeneratedRefs.length > 0) {
      blockingReasons.push('orphan_generated_refs');
    }
    if (coverageBlockingReasons.length > 0) {
      blockingReasons.push('coverage_blocking_reasons');
    }
    if (coverageReceipt.decision !== 'pass') blockingReasons.push('coverage_decision_not_pass');
  }

  if (generationReceipt) {
    if (generationReceipt.ok !== true) blockingReasons.push('generation_receipt_not_ok');
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
    unmappedSourceObligations: Array.isArray(coverageReceipt?.unmappedSourceObligations)
      ? coverageReceipt.unmappedSourceObligations.length
      : null,
  };
}

function goalContractReleaseGateCommand(_opts = {}, forwardedArgs = []) {
  const args = [...forwardedArgs];
  const result = checkGoalContractReleaseGate({
    source: take(args, '--source'),
    goal: take(args, '--goal'),
    coverage: take(args, '--coverage'),
    generation: take(args, '--generation'),
  });
  const json = has(args, '--json') || _opts.json;
  const output = json
    ? JSON.stringify(result, null, 2)
    : `${result.decision.toUpperCase()}: ${result.blockingReasons.join(', ') || 'goal contract coverage proof current'}`;
  process.stdout.write(`${output}\n`);
  return result.ok ? 0 : 1;
}

module.exports = {
  checkGoalContractReleaseGate,
  goalContractReleaseGateCommand,
};
