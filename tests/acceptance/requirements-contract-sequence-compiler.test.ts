import { existsSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { sequenceCompilerFixture } from './helpers/requirements-contract-sequence-compiler-fixture';

const ownerPath = path.resolve(
  'packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-sequence-compiler.ts'
);

it('publishes the requirements interaction Sequence Compiler owner', () => {
  expect(existsSync(ownerPath)).toBe(true);
});

describe.runIf(existsSync(ownerPath))('requirements-contract Sequence Compiler', () => {
  it('freezes one schema-valid hash-bound Sequence Contract from proof-carrying semantics', async () => {
    const { compileRequirementsContractSequenceContract } = await import(
      '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-sequence-compiler'
    );
    const { validateSequenceContract } = await import(
      '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-sequence-model'
    );
    const contract = compileRequirementsContractSequenceContract(sequenceCompilerFixture());

    expect(contract.schemaVersion).toBe('requirements-contract-sequence-contract/v1');
    expect(contract.sequenceContractHash).toMatch(/^sha256:[a-f0-9]{64}$/u);
    expect(validateSequenceContract(contract)).toEqual({ ok: true, issues: [] });
  });

  it('rejects generic synthetic participants instead of filling unresolved semantics', async () => {
    const { compileRequirementsContractSequenceContract } = await import(
      '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-sequence-compiler'
    );
    const input = sequenceCompilerFixture();
    input.sequenceScenarios[0].participants[0].label = 'User';

    expect(() => compileRequirementsContractSequenceContract(input)).toThrow(
      /synthetic participant/iu
    );
  });
});
