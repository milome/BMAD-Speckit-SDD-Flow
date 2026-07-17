import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  publishCurrentDispatchPointer,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-current-dispatch-pointer';
import {
  writeGovernedJson,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-governed-write';
import {
  requirementsContractPromptTransactionPublishCommand,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-prompt-transaction-publisher';
import {
  materializePromptPublicationFixture,
} from './helpers/prompt-transaction-publication-fixture';
import { compiledPromptRunnerFor } from './helpers/prompt-transaction-compiled-runner-fixture';

const fixtures: Array<ReturnType<typeof materializePromptPublicationFixture>> = [];

afterEach(() => {
  while (fixtures.length > 0) fixtures.pop()?.cleanup();
});

async function publishedPointerFixture() {
  const fixture = materializePromptPublicationFixture();
  fixtures.push(fixture);
  const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
  const code = await requirementsContractPromptTransactionPublishCommand(fixture.options, {
    runCompiledPrompt: compiledPromptRunnerFor(fixture, {
      extraPacket: {
        packetId: fixture.identity.implementationAttemptId,
      },
    }),
  }).finally(() => stdout.mockRestore());
  expect(code).toBe(0);
  const pointer = JSON.parse(
    fs.readFileSync(fixture.options.currentDispatchPointer, 'utf8')
  );
  return { fixture, pointer };
}

function expectedIdentity(pointer: Record<string, any>) {
  return {
    requirementSetId: pointer.requirementSetId,
    implementationAttemptId: pointer.implementationAttemptId,
    transactionId: pointer.transactionId,
  };
}

async function resolverForTest() {
  const module = await import(
    '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-current-dispatch-pointer'
  );
  const resolver = (
    module as typeof module & {
      resolveCurrentDispatchPointer?: (input: {
        pointerPath: string;
        expected: {
          requirementSetId: string;
          implementationAttemptId: string;
          transactionId: string;
        };
      }) => {
        pointer: Record<string, unknown>;
        modelPacket: Record<string, unknown>;
        transactionManifest: Record<string, unknown>;
      };
    }
  ).resolveCurrentDispatchPointer;
  expect(
    typeof resolver,
    'current_dispatch_pointer_resolver_missing'
  ).toBe('function');
  return resolver!;
}

describe('requirements contract current dispatch pointer', () => {
  it('resolves the executable packet only through the exact current pointer', async () => {
    const resolver = await resolverForTest();
    const { fixture, pointer } = await publishedPointerFixture();
    const resolution = resolver!({
      pointerPath: fixture.options.currentDispatchPointer,
      expected: expectedIdentity(pointer),
    });

    expect(resolution.pointer).toEqual(pointer);
    expect(resolution.modelPacket).toEqual(
      JSON.parse(fs.readFileSync(pointer.modelPacketRef.path, 'utf8'))
    );
    expect(resolution.transactionManifest).toEqual(
      JSON.parse(fs.readFileSync(pointer.transactionManifestRef.path, 'utf8'))
    );
  });

  it('does not scan or select a decoy packet when the exact pointer is missing', async () => {
    const resolver = await resolverForTest();
    const { fixture, pointer } = await publishedPointerFixture();
    fs.writeFileSync(
      path.join(fixture.paths.outDir, 'newer-decoy-model-packet.json'),
      `${JSON.stringify({ packetId: 'decoy' })}\n`,
      'utf8'
    );

    expect(() =>
      resolver({
        pointerPath: path.join(fixture.paths.evidenceRoot, 'missing-current-pointer.json'),
        expected: expectedIdentity(pointer),
      })
    ).toThrow('current_dispatch_pointer_missing');
  });

  it('binds the main-agent dispatch consumer to the exact pointer instead of a newer packet', async () => {
    const orchestration = await import(
      '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-orchestration'
    );
    const consumer = (
      orchestration as typeof orchestration & {
        resolveCurrentCompiledPromptRefFromDispatchPointer?: (input: {
          pointerPath: string;
          expected: {
            requirementSetId: string;
            implementationAttemptId: string;
            transactionId: string;
          };
        }) => Record<string, unknown>;
      }
    ).resolveCurrentCompiledPromptRefFromDispatchPointer;
    expect(
      typeof consumer,
      'current_dispatch_pointer_main_agent_consumer_missing'
    ).toBe('function');

    const { fixture, pointer } = await publishedPointerFixture();
    const decoyPath = path.join(
      fixture.paths.outDir,
      'newer-historical-model-packet.json'
    );
    fs.writeFileSync(
      decoyPath,
      `${JSON.stringify({
        packetId: 'newer-historical-packet',
        sourceDocumentHash: pointer.sourceDocumentHash,
        implementationConfirmationHash: 'sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
      })}\n`,
      'utf8'
    );
    const future = new Date(Date.now() + 60_000);
    fs.utimesSync(decoyPath, future, future);

    const compiledPromptRef = consumer!({
      pointerPath: fixture.options.currentDispatchPointer,
      expected: expectedIdentity(pointer),
    });
    expect(compiledPromptRef).toMatchObject({
      modelPacketPath: pointer.modelPacketRef.path,
      modelPacketHash: pointer.modelPacketRef.hash,
      humanPromptPath: pointer.humanPromptRef.path,
      humanPromptHash: pointer.humanPromptRef.hash,
      auditReceiptPath: pointer.auditReceiptRef.path,
      auditReceiptHash: pointer.auditReceiptRef.hash,
      goalExecutionPath: pointer.goalExecutionRef.path,
      goalExecutionHash: pointer.goalExecutionRef.hash,
      sourceDocumentHash: pointer.sourceDocumentHash,
    });
    expect(compiledPromptRef.modelPacketPath).not.toBe(decoyPath);
  });

  it.each([
    ['requirementSetId', 'other-requirement-set'],
    ['implementationAttemptId', 'other-implementation-attempt'],
    ['transactionId', 'other-transaction'],
  ] as const)('rejects a cross-context %s', async (field, value) => {
    const resolver = await resolverForTest();
    const { fixture, pointer } = await publishedPointerFixture();

    expect(() =>
      resolver({
        pointerPath: fixture.options.currentDispatchPointer,
        expected: {
          ...expectedIdentity(pointer),
          [field]: value,
        },
      })
    ).toThrow(`current_dispatch_pointer_identity_mismatch:${field}`);
  });

  it('rejects a packet whose published hash no longer matches', async () => {
    const resolver = await resolverForTest();
    const { fixture, pointer } = await publishedPointerFixture();
    fs.appendFileSync(pointer.modelPacketRef.path, '\n', 'utf8');

    expect(() =>
      resolver({
        pointerPath: fixture.options.currentDispatchPointer,
        expected: expectedIdentity(pointer),
      })
    ).toThrow('current_dispatch_pointer_reference_hash_mismatch:modelPacketRef');
  });

  it('rejects a manifest whose internal transaction identity differs from the pointer', async () => {
    const resolver = await resolverForTest();
    const { fixture, pointer } = await publishedPointerFixture();
    const manifest = JSON.parse(
      fs.readFileSync(pointer.transactionManifestRef.path, 'utf8')
    );
    const manifestWrite = writeGovernedJson(pointer.transactionManifestRef.path, {
      ...manifest,
      transactionId: 'TX-OTHER',
    });
    const targetPath = path.join(
      fixture.paths.evidenceRoot,
      'cross-transaction-current-pointer.json'
    );
    publishCurrentDispatchPointer({
      targetPath,
      expectedPreimageHash: null,
      pointer: {
        ...pointer,
        transactionManifestRef: manifestWrite.targetRef,
      },
    });

    expect(() =>
      resolver({
        pointerPath: targetPath,
        expected: expectedIdentity(pointer),
      })
    ).toThrow('current_dispatch_pointer_transaction_manifest_mismatch:transactionId');
  });

  it('rejects a tampered pointer safe-write receipt', async () => {
    const resolver = await resolverForTest();
    const { fixture, pointer } = await publishedPointerFixture();
    const receiptPath = `${fixture.options.currentDispatchPointer}.safe-write-receipt.json`;
    const receipt = JSON.parse(fs.readFileSync(receiptPath, 'utf8'));
    fs.writeFileSync(
      receiptPath,
      `${JSON.stringify({ ...receipt, finalHash: pointer.sourceDocumentHash }, null, 2)}\n`,
      'utf8'
    );

    expect(() =>
      resolver({
        pointerPath: fixture.options.currentDispatchPointer,
        expected: expectedIdentity(pointer),
      })
    ).toThrow('current_dispatch_pointer_safe_write_receipt_invalid');
  });

  it('rejects publication when the pointer packet reference is absent', async () => {
    const { fixture, pointer } = await publishedPointerFixture();
    const targetPath = path.join(
      fixture.paths.evidenceRoot,
      'invalid-current-dispatch-pointer.json'
    );
    const missingPacketPath = path.join(
      fixture.paths.outDir,
      'missing-model-packet.json'
    );

    expect(() =>
      publishCurrentDispatchPointer({
        targetPath,
        expectedPreimageHash: null,
        pointer: {
          ...pointer,
          modelPacketRef: {
            ...pointer.modelPacketRef,
            path: missingPacketPath,
          },
        },
      })
    ).toThrow('current_dispatch_pointer_reference_missing:modelPacketRef');
    expect(fs.existsSync(targetPath)).toBe(false);
  });
});
