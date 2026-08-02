const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_AUTHORITY_PATH =
  'tests/fixtures/requirements-contract-command-selector-authority.json';
const SELECTOR_AUTHORITY_SCHEMA_VERSION =
  'requirements-contract-command-selector-authority/v1';
const SELECTOR_PATH_PATTERN =
  /^(?:tests|packages)\/[A-Za-z0-9_./-]+\.test\.(?:ts|js)$/u;
const ARCHITECTURE_WAVE_COMMAND_IDS = [
  ...Array.from({ length: 20 }, (_, index) => `CMD-${String(index + 1).padStart(2, '0')}`),
  ...Array.from({ length: 6 }, (_, index) => `CMD-${index + 26}`),
  'CMD-33',
  'CMD-36',
];

function normalize(value) {
  return String(value ?? '').replace(/\\/gu, '/');
}

function extractSelectors(value) {
  return [
    ...String(value).matchAll(/(?:tests|packages)\/[A-Za-z0-9_./-]+\.test\.(?:ts|js)/gu),
  ].map((match) => match[0]);
}

function validatedSelectorInventory(commandId, allSelectors, commandSelectors, expectedCount) {
  const label = commandId.toLowerCase().replace('-', '');
  const allSelectorCount = Array.isArray(allSelectors) ? allSelectors.length : 'invalid';
  if (
    !Array.isArray(allSelectors) ||
    !allSelectors.every(
      (selector) => typeof selector === 'string' && SELECTOR_PATH_PATTERN.test(selector)
    ) ||
    !Array.isArray(commandSelectors) ||
    !commandSelectors.every(
      (selector) => typeof selector === 'string' && SELECTOR_PATH_PATTERN.test(selector)
    ) ||
    (expectedCount !== null && allSelectors.length !== expectedCount) ||
    new Set(allSelectors).size !== allSelectors.length ||
    new Set(commandSelectors).size !== commandSelectors.length ||
    commandSelectors.some((selector) => !allSelectors.includes(selector))
  ) {
    throw new Error(`${label}_selector_inventory_invalid:${allSelectorCount}`);
  }
  return {
    commandId,
    allSelectors,
    commandSelectors,
    vitestSelectors: commandSelectors.filter((selector) => selector.endsWith('.test.ts')),
    nodeSelectors: commandSelectors.filter((selector) => selector.endsWith('.test.js')),
    indirectSelectors: allSelectors.filter((selector) => !commandSelectors.includes(selector)),
  };
}

function validatedJsonAuthority(authority) {
  if (
    !authority ||
    typeof authority !== 'object' ||
    Array.isArray(authority) ||
    authority.schemaVersion !== SELECTOR_AUTHORITY_SCHEMA_VERSION ||
    !Array.isArray(authority.commands) ||
    !authority.commands.every(
      (entry) => entry && typeof entry === 'object' && typeof entry.commandId === 'string'
    )
  ) {
    throw new Error('command_selector_authority_invalid');
  }
  if (authority.commandCount !== authority.commands.length) {
    throw new Error(
      `command_selector_authority_command_count_mismatch:${authority.commandCount}:${authority.commands.length}`
    );
  }

  const commandIds = authority.commands.map((entry) => entry.commandId);
  const duplicateCommandId = commandIds.find(
    (commandId, index) => commandIds.indexOf(commandId) !== index
  );
  if (duplicateCommandId) {
    throw new Error(`command_selector_authority_duplicate_command_id:${duplicateCommandId}`);
  }
  const expectedCommandIds = new Set(ARCHITECTURE_WAVE_COMMAND_IDS);
  const missingCommandIds = ARCHITECTURE_WAVE_COMMAND_IDS.filter(
    (commandId) => !commandIds.includes(commandId)
  );
  const extraCommandIds = commandIds.filter((commandId) => !expectedCommandIds.has(commandId));
  if (missingCommandIds.length > 0 || extraCommandIds.length > 0) {
    throw new Error(
      `command_selector_authority_command_ids_mismatch:missing=${
        missingCommandIds.join(',') || 'none'
      }:extra=${extraCommandIds.join(',') || 'none'}`
    );
  }

  const inventories = authority.commands.map((entry) =>
    validatedSelectorInventory(
      entry.commandId,
      entry.allSelectors,
      entry.commandSelectors,
      null
    )
  );
  const selectorCount = inventories.reduce(
    (count, inventory) => count + inventory.allSelectors.length,
    0
  );
  if (authority.selectorCount !== selectorCount) {
    throw new Error(
      `command_selector_authority_selector_count_mismatch:${authority.selectorCount}:${selectorCount}`
    );
  }
  return inventories;
}

function commandSelectorInventory(root, commandId, expectedCount = null, options = {}) {
  const authorityPath = options.contractPath ?? DEFAULT_AUTHORITY_PATH;
  const authorityText = fs.readFileSync(path.join(root, authorityPath), 'utf8');
  if (authorityPath.endsWith('.json')) {
    const authority = JSON.parse(authorityText);
    const inventories = validatedJsonAuthority(authority);
    const command = inventories.find((entry) => entry.commandId === commandId);
    if (!command) {
      throw new Error(`${commandId.toLowerCase().replace('-', '')}_contract_row_missing`);
    }
    return validatedSelectorInventory(
      commandId,
      command.allSelectors,
      command.commandSelectors,
      expectedCount
    );
  }

  const row = authorityText
    .split(/\r?\n/u)
    .find((line) => line.startsWith(`| ${commandId} |`));
  const label = commandId.toLowerCase().replace('-', '');
  if (!row) throw new Error(`${label}_contract_row_missing`);
  const commandText = row.match(/^\| [^|]+ \| (.*?) \| Repository root \|/u)?.[1];
  if (!commandText) throw new Error(`${label}_command_cell_missing`);
  return validatedSelectorInventory(
    commandId,
    extractSelectors(row),
    extractSelectors(commandText),
    expectedCount
  );
}

function cmd08SelectorInventory(root, options = {}) {
  return commandSelectorInventory(root, 'CMD-08', 6, options);
}

function cmd31SelectorInventory(root, options = {}) {
  return commandSelectorInventory(root, 'CMD-31', 8, options);
}

function architectureWaveSelectorInventory(root, options = {}) {
  return {
    commands: ARCHITECTURE_WAVE_COMMAND_IDS.map((commandId) =>
      commandSelectorInventory(root, commandId, null, options)
    ),
  };
}

function argvHas(argv, selector) {
  return argv.some((arg) => arg === selector || arg.endsWith(`/${selector}`));
}

function preflightArchitectureWaveSelectors(input) {
  const root = path.resolve(input.root);
  const argv = input.argv.map(normalize);
  const exists = input.exists ?? fs.existsSync;
  const inventory = architectureWaveSelectorInventory(root, {
    contractPath: input.contractPath,
  });
  const candidates = inventory.commands
    .map((command) => ({
      command,
      matchedCount: command.vitestSelectors.filter((selector) => argvHas(argv, selector)).length,
    }))
    .filter(({ command, matchedCount }) => {
      const threshold = Math.min(2, command.vitestSelectors.length);
      return threshold > 0 && matchedCount >= threshold;
    })
    .sort((left, right) => {
      const leftCoverage = left.matchedCount / left.command.vitestSelectors.length;
      const rightCoverage = right.matchedCount / right.command.vitestSelectors.length;
      return (
        rightCoverage - leftCoverage ||
        right.matchedCount - left.matchedCount ||
        left.command.commandId.localeCompare(right.command.commandId)
      );
    });
  if (candidates.length === 0) return { applicable: false };

  const { command } = candidates[0];
  const label = command.commandId.toLowerCase().replace('-', '');
  const missingArguments = command.vitestSelectors.filter(
    (selector) => !argvHas(argv, selector)
  );
  if (missingArguments.length > 0) {
    throw new Error(`${label}_selector_argument_missing:${missingArguments.join(',')}`);
  }
  const wrongRunner = command.nodeSelectors.filter((selector) => argvHas(argv, selector));
  if (wrongRunner.length > 0) {
    throw new Error(`${label}_selector_wrong_runner:${wrongRunner.join(',')}`);
  }
  const missingFiles = command.allSelectors.filter(
    (selector) => !exists(path.join(root, selector))
  );
  if (missingFiles.length > 0) {
    throw new Error(`${label}_selector_missing:${missingFiles.join(',')}`);
  }
  return {
    applicable: true,
    commandId: command.commandId,
    declaredCount: command.allSelectors.length,
    resolvedCount: command.allSelectors.length,
  };
}

function preflightCmd31Selectors(input) {
  const root = path.resolve(input.root);
  const argv = input.argv.map(normalize);
  const exists = input.exists ?? fs.existsSync;
  const inventory = cmd31SelectorInventory(root, {
    contractPath: input.contractPath,
  });
  const cmd08Selectors = new Set(cmd08SelectorInventory(root).vitestSelectors);
  const exclusiveSelectors = inventory.vitestSelectors.filter(
    (selector) => !cmd08Selectors.has(selector)
  );
  const applicable = exclusiveSelectors.some((selector) => argvHas(argv, selector));
  if (!applicable) return { applicable: false };

  const missingArguments = inventory.vitestSelectors.filter((selector) => !argvHas(argv, selector));
  if (missingArguments.length > 0) {
    throw new Error(`cmd31_selector_argument_missing:${missingArguments.join(',')}`);
  }
  const wrongRunner = inventory.nodeSelectors.filter((selector) => argvHas(argv, selector));
  if (wrongRunner.length > 0) {
    throw new Error(`cmd31_selector_wrong_runner:${wrongRunner.join(',')}`);
  }
  const missingFiles = inventory.allSelectors.filter(
    (selector) => !exists(path.join(root, selector))
  );
  if (missingFiles.length > 0) {
    throw new Error(`cmd31_selector_missing:${missingFiles.join(',')}`);
  }
  return {
    applicable: true,
    declaredCount: inventory.allSelectors.length,
    resolvedCount: inventory.allSelectors.length,
  };
}

module.exports = {
  architectureWaveSelectorInventory,
  cmd08SelectorInventory,
  cmd31SelectorInventory,
  preflightArchitectureWaveSelectors,
  preflightCmd31Selectors,
};
