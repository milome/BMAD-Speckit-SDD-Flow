const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_CONTRACT_PATH =
  'docs/plans/2026-07-11-loop-engineering-evidence-closure-remediation-goal-execution-plan.md';
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

function commandSelectorInventory(root, commandId, expectedCount = null, options = {}) {
  const contractPath = options.contractPath ?? DEFAULT_CONTRACT_PATH;
  const contract = fs.readFileSync(path.join(root, contractPath), 'utf8');
  const row = contract.split(/\r?\n/u).find((line) => line.startsWith(`| ${commandId} |`));
  const label = commandId.toLowerCase().replace('-', '');
  if (!row) throw new Error(`${label}_contract_row_missing`);
  const commandText = row.match(/^\| [^|]+ \| (.*?) \| Repository root \|/u)?.[1];
  if (!commandText) throw new Error(`${label}_command_cell_missing`);
  const allSelectors = extractSelectors(row);
  const commandSelectors = extractSelectors(commandText);
  if (
    (expectedCount !== null && allSelectors.length !== expectedCount) ||
    new Set(allSelectors).size !== allSelectors.length
  ) {
    throw new Error(`${label}_selector_inventory_invalid:${allSelectors.length}`);
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
