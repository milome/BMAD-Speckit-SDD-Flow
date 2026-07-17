import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { expect, it } from 'vitest';

const SCRIPT_ROOT = path.resolve(
  'packages/bmad-speckit/src/main-agent/source-authority/scripts'
);
const CONTRACT_PATH = path.resolve(
  'docs/plans/2026-07-11-loop-engineering-evidence-closure-remediation-goal-execution-plan.md'
);
const SCHEMA_PATH = path.resolve(
  'packages/bmad-speckit/src/main-agent/source-authority/schemas/requirements-contract-recovery-lineage-receipt.schema.json'
);
const CLI_PATH = path.resolve('packages/bmad-speckit/bin/bmad-speckit.js');
const TEST_ROOT = path.resolve('tests/acceptance');
const RECOVERY_TEST_HELPER_PATH = path.resolve(
  'tests/acceptance/helpers/requirements-contract-recovery-test-fixture.ts'
);
const RECOVERY_HELPER_ROOT = path.resolve('tests/acceptance/helpers');
const CONSUMER_BASELINE_PATH = path.resolve(
  'tests/acceptance/fixtures/requirements-contract-recovery/consumer-baseline-authority.json'
);

function recoveryFeatureTestPaths(): string[] {
  return readdirSync(TEST_ROOT)
    .filter(
      (name) =>
        name.startsWith('requirements-contract-recovery-') && name.endsWith('.test.ts')
    )
    .map((name) => path.join(TEST_ROOT, name))
    .sort();
}

function recoveryRuntimePaths(): string[] {
  return readdirSync(SCRIPT_ROOT)
    .filter(
      (name) =>
        name.startsWith('requirements-contract-recovery-') &&
        /\.(?:ts|cjs)$/u.test(name)
    )
    .map((name) => path.join(SCRIPT_ROOT, name))
    .sort();
}

function recoveryHelperPaths(): string[] {
  return readdirSync(RECOVERY_HELPER_ROOT)
    .filter(
      (name) =>
        (name.startsWith('requirements-contract-recovery-') ||
          name.startsWith('run-requirements-contract-recovery-')) &&
        /\.(?:ts|cjs)$/u.test(name)
    )
    .map((name) => path.join(RECOVERY_HELPER_ROOT, name))
    .sort();
}

function expandAcceptanceRefs(expression: string): string[] {
  const refs: string[] = [];
  for (const match of expression.matchAll(
    /AC-(\d+)(?:\s+through\s+AC-(\d+))?/gu
  )) {
    const start = Number(match[1]);
    const end = match[2] === undefined ? start : Number(match[2]);
    for (let value = start; value <= end; value += 1) {
      refs.push(`AC-${String(value).padStart(2, '0')}`);
    }
  }
  return refs;
}

it('derives recovery command identities only from schema authority and hash-bound receipts', () => {
  const schema = JSON.parse(readFileSync(SCHEMA_PATH, 'utf8')) as Record<string, unknown>;
  const contract = readFileSync(CONTRACT_PATH, 'utf8');
  const consumerBaseline = JSON.parse(
    readFileSync(CONSUMER_BASELINE_PATH, 'utf8')
  ) as Record<string, any>;
  const roles = schema['x-commandRoles'] as Record<string, unknown> | undefined;
  const finalizedRoles = schema['x-finalizedCommandReceiptRoles'];
  const finalizerRole = schema['x-finalizerCommandRole'];
  const gitIdentities = [
    consumerBaseline.baselineCommit,
    consumerBaseline.baselineTree,
    ...consumerBaseline.trackedFiles.map(
      (entry: Record<string, string>) => entry.blob
    ),
  ];
  const consumerIdentityLiterals = [
    consumerBaseline.markerHash,
    consumerBaseline.packageHash,
    consumerBaseline.baselineFileIndexHash,
    consumerBaseline.markerHash.replace(/^sha256:/u, ''),
    consumerBaseline.packageHash.replace(/^sha256:/u, ''),
    consumerBaseline.baselineFileIndexHash.replace(/^sha256:/u, ''),
    ...gitIdentities.flatMap((identity) => [
      identity,
      ...Array.from({ length: 9 }, (_, index) => identity.slice(0, index + 4)),
    ]),
  ];

  expect(roles).toEqual(
    expect.objectContaining({
      preEdit: expect.any(String),
      bootstrap: expect.any(String),
      postBootstrap: expect.any(String),
    })
  );
  expect(finalizedRoles).toEqual(expect.any(Array));
  expect(new Set(finalizedRoles as unknown[]).size).toBe(
    (finalizedRoles as unknown[]).length
  );
  expect(finalizerRole).toEqual(expect.any(String));

  for (const sourcePath of [
    ...recoveryRuntimePaths(),
    ...new Set([RECOVERY_TEST_HELPER_PATH, ...recoveryHelperPaths()]),
    ...recoveryFeatureTestPaths(),
  ]) {
    const source = readFileSync(sourcePath, 'utf8');
    const concreteIdentityLiterals =
      source.match(
        /\b(?:(?:CMD|ARTIFACT|AMEND|AC|TR)-\d+|S\d{3}|sha256:[a-f0-9]{64}|[a-f0-9]{40}|[a-f0-9]{64})\b/gu
      ) ?? [];
    const concretePlanSelectors =
      source.match(/\bcommandPlan\s*(?:\?\.)?\s*(?:\.\s*cmd\d+|\[\s*['"]cmd\d+['"]\s*\])/giu) ??
      [];
    const embeddedConsumerIdentities = consumerIdentityLiterals.filter(
      (identity) => typeof identity === 'string' && source.includes(identity)
    );

    expect(
      concreteIdentityLiterals,
      `${path.basename(sourcePath)} must not embed execution-contract identities`
    ).toEqual([]);
    expect(
      embeddedConsumerIdentities,
      `${path.basename(sourcePath)} must derive Consumer identities from authority`
    ).toEqual([]);
    expect(
      concretePlanSelectors,
      `${path.basename(sourcePath)} must resolve command roles through schema authority`
    ).toEqual([]);
  }

  const commandRows = new Map(
    contract
      .split(/\r?\n/u)
      .filter((line) => /^\| CMD-\d+ \|/u.test(line))
      .map((line) => {
        const columns = line
          .split('|')
          .slice(1, -1)
          .map((column) => column.trim());
        return [columns[0], expandAcceptanceRefs(columns[4])] as const;
      })
  );
  const bindings = schema['x-commandReceiptBindings'] as Record<
    string,
    { acceptanceRefs: string[]; traceRefs: string[] }
  >;
  for (const [commandId, binding] of Object.entries(bindings)) {
    const expectedAcceptanceRefs = commandRows.get(commandId);
    expect(expectedAcceptanceRefs, `${commandId} must exist in the contract command table`)
      .toBeDefined();
    expect(binding.acceptanceRefs).toEqual(expectedAcceptanceRefs);
    expect(binding.traceRefs).toEqual(
      expectedAcceptanceRefs!.map((ref) => ref.replace(/^AC-/u, 'TR-'))
    );
  }
});

it('loads recovery actions from built package output and parses repeated receipt options safely', () => {
  const cliSource = readFileSync(CLI_PATH, 'utf8');

  expect(cliSource).not.toContain('../src/main-agent/source-authority');
  expect(cliSource).not.toContain('--command-receipt <path...>');
  expect(cliSource).toMatch(/--command-receipt <path>/u);
});
