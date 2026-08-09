'use strict';

const path = require('node:path');

const { compareText, fail } = require('./canonical-artifact.cjs');

const EXECUTION_CLASSES = new Set(['governed_profile', 'local_maintenance']);
const COMMAND_BINDINGS = Object.freeze(
  [
    {
      commandId: 'governed-profile-freeze-core',
      executionClass: 'governed_profile',
      targetPath: 'tools/ci/freeze-core-portfolio.cjs',
    },
    {
      commandId: 'governed-profile-coverage-gap',
      executionClass: 'governed_profile',
      targetPath: 'tools/ci/generate-six-model-coverage-gap-report.cjs',
    },
    {
      commandId: 'governed-profile-product-failure-records',
      executionClass: 'governed_profile',
      targetPath: 'tools/ci/build-product-failure-records.cjs',
    },
    {
      commandId: 'governed-profile-semantic-index',
      executionClass: 'governed_profile',
      targetPath: 'tools/ci/build-shard-semantic-index.cjs',
    },
    {
      commandId: 'portfolio-maintenance-generate-deletion-candidates',
      executionClass: 'local_maintenance',
      targetPath: 'tools/ci/generate-test-deletion-candidates.cjs',
    },
  ]
    .map((binding) =>
      Object.freeze({
        ...binding,
        evidenceRef: `source:tools/ci/test-command-bindings.cjs#${binding.commandId}`,
      })
    )
    .sort((left, right) => compareText(left.commandId, right.commandId))
);

function normalizeTargetPath(value) {
  return path.posix.normalize(String(value || '').replace(/\\/gu, '/')).replace(/^\.\//u, '');
}

function validateCommandBindings(bindings = COMMAND_BINDINGS) {
  if (!Array.isArray(bindings) || bindings.length === 0) {
    fail('CI_COMMAND_BINDINGS_INVALID');
  }
  const commandIds = new Set();
  for (const binding of bindings) {
    if (
      !binding ||
      typeof binding !== 'object' ||
      Array.isArray(binding) ||
      typeof binding.commandId !== 'string' ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(binding.commandId) ||
      typeof binding.targetPath !== 'string' ||
      binding.targetPath.trim() === '' ||
      normalizeTargetPath(binding.targetPath) !== binding.targetPath ||
      !EXECUTION_CLASSES.has(binding.executionClass) ||
      typeof binding.evidenceRef !== 'string' ||
      binding.evidenceRef.trim() === '' ||
      commandIds.has(binding.commandId)
    ) {
      fail('CI_COMMAND_BINDING_INVALID');
    }
    commandIds.add(binding.commandId);
  }
  return bindings;
}

function commandBinding(commandId) {
  if (typeof commandId !== 'string' || commandId.trim() === '') {
    fail('CI_COMMAND_BINDING_ID_INVALID');
  }
  const binding = validateCommandBindings().find((entry) => entry.commandId === commandId);
  if (!binding) fail('CI_COMMAND_BINDING_UNKNOWN', { commandId });
  return binding;
}

function commandTargetPath(commandId) {
  return commandBinding(commandId).targetPath;
}

function commandBindingsForTarget(targetPath) {
  const normalized = normalizeTargetPath(targetPath);
  return validateCommandBindings().filter((binding) => binding.targetPath === normalized);
}

module.exports = {
  COMMAND_BINDINGS,
  commandBinding,
  commandBindingsForTarget,
  commandTargetPath,
  validateCommandBindings,
};
