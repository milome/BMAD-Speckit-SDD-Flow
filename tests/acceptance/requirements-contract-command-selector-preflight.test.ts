import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const {
  architectureWaveSelectorInventory,
  cmd31SelectorInventory,
  preflightArchitectureWaveSelectors,
  preflightCmd31Selectors,
} = require('../contract-command-selector-preflight.cjs');

const ROOT = process.cwd();
const COMMAND_AUTHORITY_PATH = path.resolve(
  'tests/fixtures/requirements-contract-command-selector-authority.json'
);

type CommandSelectorAuthority = {
  commandCount: number;
  selectorCount: number;
  commands: Array<{
    commandId: string;
    allSelectors: string[];
    commandSelectors: string[];
  }>;
};

function withMutatedCommandAuthority(
  mutate: (authority: CommandSelectorAuthority) => void,
  verify: (root: string, contractPath: string) => void
): void {
  const authority = JSON.parse(
    readFileSync(COMMAND_AUTHORITY_PATH, 'utf8')
  ) as CommandSelectorAuthority;
  mutate(authority);
  withCommandAuthorityValue(authority, verify);
}

function withCommandAuthorityValue(
  authority: unknown,
  verify: (root: string, contractPath: string) => void
): void {
  const tempRoot = mkdtempSync(path.join(tmpdir(), 'command-selector-authority-'));
  const contractPath = 'authority.json';
  try {
    writeFileSync(path.join(tempRoot, contractPath), JSON.stringify(authority), 'utf8');
    verify(tempRoot, contractPath);
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

describe('requirements contract command selector preflight', () => {
  it('rejects a non-array selector inventory without dereferencing its length', () => {
    withMutatedCommandAuthority(
      (authority) => {
        Object.assign(authority.commands[0], { allSelectors: null });
      },
      (root, contractPath) => {
        expect(() =>
          architectureWaveSelectorInventory(root, { contractPath })
        ).toThrow(/cmd01_selector_inventory_invalid/u);
      }
    );
  });

  it('rejects duplicate command identities in selector authority', () => {
    withMutatedCommandAuthority(
      (authority) => {
        authority.commands[1].commandId = authority.commands[0].commandId;
      },
      (root, contractPath) => {
        expect(() =>
          architectureWaveSelectorInventory(root, { contractPath })
        ).toThrow(/command_selector_authority_duplicate_command_id:CMD-01/u);
      }
    );
  });

  it('rejects duplicate command selectors in a command inventory', () => {
    withMutatedCommandAuthority(
      (authority) => {
        const command = authority.commands.find((entry) => entry.commandSelectors.length > 0);
        if (!command) throw new Error('test_fixture_command_selector_missing');
        command.commandSelectors.push(command.commandSelectors[0]);
      },
      (root, contractPath) => {
        expect(() =>
          architectureWaveSelectorInventory(root, { contractPath })
        ).toThrow(/cmd02_selector_inventory_invalid/u);
      }
    );
  });

  it.each(['', 'not-a-test-selector'])(
    'rejects an invalid selector path %j',
    (invalidSelector) => {
      withMutatedCommandAuthority(
        (authority) => {
          const command = authority.commands.find((entry) => entry.commandSelectors.length > 0);
          if (!command) throw new Error('test_fixture_command_selector_missing');
          command.allSelectors[0] = invalidSelector;
          command.commandSelectors[0] = invalidSelector;
        },
        (root, contractPath) => {
          expect(() =>
            architectureWaveSelectorInventory(root, { contractPath })
          ).toThrow(/cmd02_selector_inventory_invalid/u);
        }
      );
    }
  );

  it('rejects command identities outside the frozen architecture wave', () => {
    withMutatedCommandAuthority(
      (authority) => {
        authority.commands.push({
          commandId: 'CMD-99',
          allSelectors: [],
          commandSelectors: [],
        });
        authority.commandCount += 1;
      },
      (root, contractPath) => {
        expect(() =>
          architectureWaveSelectorInventory(root, { contractPath })
        ).toThrow(/command_selector_authority_command_ids_mismatch:.*extra=CMD-99/u);
      }
    );
  });

  it.each([null, []])('rejects an invalid top-level authority value %j', (authority) => {
    withCommandAuthorityValue(authority, (root, contractPath) => {
      expect(() =>
        architectureWaveSelectorInventory(root, { contractPath })
      ).toThrow('command_selector_authority_invalid');
    });
  });

  it('rejects a command count that does not match selector authority rows', () => {
    withMutatedCommandAuthority(
      (authority) => {
        authority.commandCount += 1;
      },
      (root, contractPath) => {
        expect(() =>
          architectureWaveSelectorInventory(root, { contractPath })
        ).toThrow(/command_selector_authority_command_count_mismatch:29:28/u);
      }
    );
  });

  it('rejects a selector count that does not match declared selector inventories', () => {
    withMutatedCommandAuthority(
      (authority) => {
        authority.selectorCount += 1;
      },
      (root, contractPath) => {
        expect(() =>
          architectureWaveSelectorInventory(root, { contractPath })
        ).toThrow(/command_selector_authority_selector_count_mismatch:275:274/u);
      }
    );
  });

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
