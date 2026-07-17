import path from 'node:path';
import { describe, expect, it } from 'vitest';

const {
  architectureWaveSelectorInventory,
  cmd31SelectorInventory,
  preflightArchitectureWaveSelectors,
  preflightCmd31Selectors,
} = require('../contract-command-selector-preflight.cjs');

const ROOT = process.cwd();

describe('requirements contract command selector preflight', () => {
  it('resolves every frozen architecture-wave command selector inventory', () => {
    const inventory = architectureWaveSelectorInventory(ROOT);

    expect(inventory.commands).toHaveLength(28);
    expect(inventory.commands.map((command: { commandId: string }) => command.commandId)).toEqual([
      'CMD-01',
      'CMD-02',
      'CMD-03',
      'CMD-04',
      'CMD-05',
      'CMD-06',
      'CMD-07',
      'CMD-08',
      'CMD-09',
      'CMD-10',
      'CMD-11',
      'CMD-12',
      'CMD-13',
      'CMD-14',
      'CMD-15',
      'CMD-16',
      'CMD-17',
      'CMD-18',
      'CMD-19',
      'CMD-20',
      'CMD-26',
      'CMD-27',
      'CMD-28',
      'CMD-29',
      'CMD-30',
      'CMD-31',
      'CMD-33',
      'CMD-36',
    ]);
    expect(
      inventory.commands.find((command: { commandId: string }) => command.commandId === 'CMD-28')
        .allSelectors
    ).toHaveLength(9);
  });

  it('fails closed before Vitest collection when a frozen architecture-wave selector is absent', () => {
    const inventory = architectureWaveSelectorInventory(ROOT);
    const cmd28 = inventory.commands.find(
      (command: { commandId: string }) => command.commandId === 'CMD-28'
    );
    const missingSelector =
      'tests/acceptance/requirements-contract-source-prd-lint-state-machine.test.ts';

    expect(() =>
      preflightArchitectureWaveSelectors({
        root: ROOT,
        argv: cmd28.vitestSelectors,
        exists: (candidate: string) => candidate !== path.join(ROOT, missingSelector),
      })
    ).toThrow(
      /cmd28_selector_missing:.*requirements-contract-source-prd-lint-state-machine\.test\.ts/u
    );
  });

  it('fails closed when a frozen architecture-wave command omits a declared selector argument', () => {
    const inventory = architectureWaveSelectorInventory(ROOT);
    const cmd28 = inventory.commands.find(
      (command: { commandId: string }) => command.commandId === 'CMD-28'
    );

    expect(() =>
      preflightArchitectureWaveSelectors({
        root: ROOT,
        argv: cmd28.vitestSelectors.slice(1),
        exists: () => true,
      })
    ).toThrow(/cmd28_selector_argument_missing/u);
  });

  it('resolves exact CMD-29 intent instead of the overlapping CMD-11 inventory', () => {
    const inventory = architectureWaveSelectorInventory(ROOT);
    const cmd29 = inventory.commands.find(
      (command: { commandId: string }) => command.commandId === 'CMD-29'
    );

    expect(
      preflightArchitectureWaveSelectors({
        root: ROOT,
        argv: cmd29.vitestSelectors,
        exists: () => true,
      })
    ).toMatchObject({
      applicable: true,
      commandId: 'CMD-29',
    });
  });

  it('keeps incomplete CMD-29 intent fail-closed under its own command identity', () => {
    const inventory = architectureWaveSelectorInventory(ROOT);
    const cmd29 = inventory.commands.find(
      (command: { commandId: string }) => command.commandId === 'CMD-29'
    );

    expect(() =>
      preflightArchitectureWaveSelectors({
        root: ROOT,
        argv: cmd29.vitestSelectors.slice(1),
        exists: () => true,
      })
    ).toThrow(/cmd29_selector_argument_missing/u);
  });

  it('keeps the complete overlapping CMD-11 inventory authoritative', () => {
    const inventory = architectureWaveSelectorInventory(ROOT);
    const cmd11 = inventory.commands.find(
      (command: { commandId: string }) => command.commandId === 'CMD-11'
    );

    expect(
      preflightArchitectureWaveSelectors({
        root: ROOT,
        argv: cmd11.vitestSelectors,
        exists: () => true,
      })
    ).toMatchObject({
      applicable: true,
      commandId: 'CMD-11',
    });
  });

  it('uses an explicitly supplied contract authority path', () => {
    expect(() =>
      architectureWaveSelectorInventory(ROOT, {
        contractPath: 'docs/plans/non-existent-contract-authority.md',
      })
    ).toThrow(/non-existent-contract-authority\.md/u);
  });

  it('resolves the exact CMD-31 runner-owned selector inventory', () => {
    const inventory = cmd31SelectorInventory(ROOT);

    expect(inventory.vitestSelectors).toHaveLength(5);
    expect(inventory.nodeSelectors).toHaveLength(3);
    expect(inventory.allSelectors).toHaveLength(8);
    expect(
      preflightCmd31Selectors({
        root: ROOT,
        argv: inventory.vitestSelectors,
      })
    ).toEqual({
      applicable: true,
      declaredCount: 8,
      resolvedCount: 8,
    });
  });

  it('fails closed when an explicit Vitest selector or declared file is absent', () => {
    const inventory = cmd31SelectorInventory(ROOT);

    expect(() =>
      preflightCmd31Selectors({
        root: ROOT,
        argv: inventory.vitestSelectors.slice(1),
      })
    ).toThrow(/cmd31_selector_argument_missing/u);

    expect(() =>
      preflightCmd31Selectors({
        root: ROOT,
        argv: inventory.vitestSelectors,
        exists: (filePath: string) => filePath !== path.join(ROOT, inventory.nodeSelectors[0]),
      })
    ).toThrow(/cmd31_selector_missing/u);
  });

  it('does not affect unrelated Vitest commands', () => {
    expect(
      preflightCmd31Selectors({
        root: ROOT,
        argv: ['tests/acceptance/requirement-record-schema.test.ts'],
      })
    ).toMatchObject({ applicable: false });
  });

  it('does not treat the CMD-08/CMD-31 shared selector as CMD-31 intent', () => {
    const inventory = cmd31SelectorInventory(ROOT);
    const sharedSelector = inventory.vitestSelectors.find((selector: string) =>
      selector.includes('prompt-transaction-production-publication')
    );

    expect(sharedSelector).toBeDefined();
    expect(
      preflightCmd31Selectors({
        root: ROOT,
        argv: [sharedSelector],
      })
    ).toMatchObject({ applicable: false });
  });
});
