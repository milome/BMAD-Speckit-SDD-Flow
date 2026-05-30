import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { buildContractExecutionManifest, buildDerivedContractExecutionManifest } =
  require('../../_bmad/shared/contract-execution-manifest/build-contract-execution-manifest.js') as {
    buildContractExecutionManifest(input: Record<string, unknown>): Record<string, unknown>;
    buildDerivedContractExecutionManifest(input: Record<string, unknown>): Record<string, unknown>;
  };
const { auditContractExecutionManifest } =
  require('../../_bmad/shared/contract-execution-manifest/audit-contract-execution-manifest.js') as {
    auditContractExecutionManifest(input: Record<string, unknown>): Record<string, unknown>;
  };

function confirmation(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    aiTddContractExecutionManifestProjection: {
      schemaVersion: 'contract-execution-manifest/v1',
      requiredSections: ['commandTargets', 'closeoutProof'],
      commandTargets: { commandRefs: ['CMD-001'] },
      closeoutProof: { requiredCommands: ['CMD-001'] },
      note: 'presentation-only note',
    },
    requiredCommands: [
      {
        id: 'CMD-001',
        command: 'node --version',
        traceRows: ['TRACE-001'],
        evidenceRefs: ['EVD-001'],
      },
    ],
    ...overrides,
  };
}

describe('shared ContractExecutionManifest canonicalization', () => {
  it('builds canonical metadata and normalizes commandTargets alias', () => {
    const manifest = buildContractExecutionManifest({
      confirmation: confirmation(),
      sourceDocumentHash: 'sha256:1111111111111111111111111111111111111111111111111111111111111111',
      implementationConfirmationHash:
        'sha256:2222222222222222222222222222222222222222222222222222222222222222',
    });

    expect(manifest).toMatchObject({
      schemaVersion: 'contract-execution-manifest/v1',
      builderVersion: 'contract-execution-manifest-builder/v1',
      sourceProjectionHash: expect.stringMatching(/^sha256:[a-f0-9]{64}$/u),
      manifestHash: expect.stringMatching(/^sha256:[a-f0-9]{64}$/u),
      commandTargetCollection: { commandRefs: ['CMD-001'] },
    });
    expect(manifest).not.toHaveProperty('commandTargets');
    expect(manifest.aliasAudit).toMatchObject({
      aliasesUsed: ['commandTargets'],
      blockingReasons: [],
    });
  });

  it('preserves explicit required command targetFiles in canonical command files', () => {
    const manifest = buildContractExecutionManifest({
      confirmation: confirmation({
        requiredCommands: [
          {
            id: 'CMD-001',
            command: 'npx tsc --noEmit --project tsconfig.node.json --pretty false',
            targetFiles: ['tsconfig.node.json'],
            traceRows: ['TRACE-001'],
            evidenceRefs: ['EVD-001'],
          },
        ],
      }),
    });

    expect(manifest.requiredCommands).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'CMD-001',
          files: ['tsconfig.node.json'],
        }),
      ])
    );
  });

  it('keeps hash stable for presentation-only projection changes', () => {
    const first = buildContractExecutionManifest({ confirmation: confirmation() });
    const baseProjection = confirmation().aiTddContractExecutionManifestProjection as Record<
      string,
      unknown
    >;
    const second = buildContractExecutionManifest({
      confirmation: confirmation({
        aiTddContractExecutionManifestProjection: {
          ...baseProjection,
          note: 'different presentation-only note',
        },
      }),
    });

    expect(second.manifestHash).toBe(first.manifestHash);
  });

  it('changes hash for semantic projection changes', () => {
    const first = buildContractExecutionManifest({ confirmation: confirmation() });
    const baseProjection = confirmation().aiTddContractExecutionManifestProjection as Record<
      string,
      unknown
    >;
    const second = buildContractExecutionManifest({
      confirmation: confirmation({
        aiTddContractExecutionManifestProjection: {
          ...baseProjection,
          closeoutProof: { requiredCommands: ['CMD-001', 'CMD-002'] },
        },
        requiredCommands: [
          ...(confirmation().requiredCommands as unknown[]),
          { id: 'CMD-002', command: 'node -e "process.exit(0)"' },
        ],
      }),
    });

    expect(second.manifestHash).not.toBe(first.manifestHash);
  });

  it('blocks alias conflicts and missing closeout required commands', () => {
    const source = confirmation({
      aiTddContractExecutionManifestProjection: {
        schemaVersion: 'contract-execution-manifest/v1',
        requiredSections: ['commandTargets', 'closeoutProof'],
        commandTargets: { commandRefs: ['CMD-001'] },
        commandTargetCollection: { commandRefs: ['CMD-OTHER'] },
        closeoutProof: { requiredCommands: ['CMD-MISSING'] },
      },
    });

    const manifest = buildContractExecutionManifest({ confirmation: source });
    const audit = auditContractExecutionManifest({
      confirmation: source,
      canonicalManifest: manifest,
    });

    expect(audit.decision).toBe('blocked');
    expect(audit.blockingReasons).toEqual(
      expect.arrayContaining([
        'MANIFEST_ALIAS_CONFLICT:commandTargets:commandTargetCollection',
        'CLOSEOUT_REQUIRED_COMMAND_MISSING:CMD-MISSING',
      ])
    );
  });

  it('preserves artifact sourceProjectionHash during artifact-only drift audit', () => {
    const manifest = buildContractExecutionManifest({ confirmation: confirmation() });
    const audit = auditContractExecutionManifest({
      canonicalManifest: manifest,
      artifacts: [{ name: 'modelPacket', value: { contractExecutionManifest: manifest } }],
    });

    expect(audit.decision).toBe('pass');
    expect(audit.canonical).toMatchObject({
      manifestHash: manifest.manifestHash,
      sourceProjectionHash: manifest.sourceProjectionHash,
    });
    expect((audit.artifacts as Array<Record<string, unknown>>)[0]).toMatchObject({
      manifestHash: manifest.manifestHash,
      sourceProjectionHash: manifest.sourceProjectionHash,
    });
  });

  it('changes derived canonical hash when authority-critical artifact sections change', () => {
    const first = buildDerivedContractExecutionManifest({
      confirmation: confirmation({
        traceRows: [
          {
            id: 'TRACE-001',
            covers: ['MUST-001'],
            evidenceRefs: ['EVD-001'],
            commandRefs: ['CMD-001'],
            acceptanceRefs: ['ACC-001'],
            artifactRefs: ['ART-001'],
          },
        ],
        evidence: [
          {
            id: 'EVD-001',
            text: 'Evidence',
            oracle: 'oracle',
            requiredCommandRefs: ['CMD-001'],
            artifactRefs: ['ART-001'],
          },
        ],
        acceptanceTests: [
          {
            id: 'ACC-001',
            file: 'tests/acceptance/fixture.test.ts',
            covers: ['MUST-001'],
            commandRefs: ['CMD-001'],
            failurePathRefs: ['FAIL-001'],
          },
        ],
      }),
    });
    const second: Record<string, unknown> = {
      ...first,
      commandTargetCollection: {
        ...(first.commandTargetCollection as Record<string, unknown>),
        rows: [
          {
            id: 'CMD-TAMPERED',
            command: 'node tampered.js',
            files: ['tampered.js'],
            traceRefs: ['TRACE-001'],
            evidenceRefs: ['EVD-001'],
            missing: [],
            ready: true,
          },
        ],
      },
    };
    const audit = auditContractExecutionManifest({
      canonicalManifest: first,
      artifacts: [{ name: 'modelPacket', value: { contractExecutionManifest: second } }],
    });

    expect(second.manifestHash).toBe(first.manifestHash);
    expect(audit.decision).toBe('blocked');
    expect(audit.blockingReasons).toContain('MANIFEST_HASH_MISMATCH:modelPacket');
  });
});
