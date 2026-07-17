import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  confirmationProjectionHash,
  requirementsContractHashDomainRegistry,
  sourceAuthorityHash,
  sourceDocumentHash,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-hash-domains';

function sha256(value: string): string {
  return `sha256:${createHash('sha256').update(value, 'utf8').digest('hex')}`;
}

const confirmation = {
  status: 'confirmed',
  confirmedAt: '2026-07-17T00:00:00.000Z',
  confirmedBy: 'user',
  sourceDocumentHash: `sha256:${'1'.repeat(64)}`,
  implementationConfirmationHash: `sha256:${'2'.repeat(64)}`,
  confirmationProjectionHash: `sha256:${'3'.repeat(64)}`,
  reconfirmationRequest: null,
  confirmationRender: { html: '<section>confirmed</section>' },
  bundleBinding: { path: 'bundle-manifest.json', hash: `sha256:${'4'.repeat(64)}` },
  acceptanceBinding: { path: 'acceptance-contracts.json', hash: `sha256:${'5'.repeat(64)}` },
};

const source = {
  title: 'Requirement source',
  requirements: [{ id: 'MUST-FR-001', text: 'Preserve semantics.' }],
  implementationConfirmation: confirmation,
};

describe('requirements-contract-hash-domains/v1', () => {
  it('freezes the three canonical domain tags', () => {
    expect(requirementsContractHashDomainRegistry()).toEqual({
      schemaVersion: 'requirements-contract-hash-domains/v1',
      sourceAuthority: 'requirements-source-authority/v1',
      confirmationProjection: 'requirements-confirmation-projection/v1',
      sourceDocument: 'requirements-source-document/v1',
    });
  });

  it('excludes the complete confirmation block from source authority', () => {
    const expectedPayload =
      '{"requirements":[{"id":"MUST-FR-001","text":"Preserve semantics."}],"title":"Requirement source"}\n';

    expect(sourceAuthorityHash(source)).toBe(
      sha256(`requirements-source-authority/v1\n${expectedPayload}`)
    );
    expect(
      sourceAuthorityHash({
        ...source,
        implementationConfirmation: { ...confirmation, status: 'blocked' },
      })
    ).toBe(sourceAuthorityHash(source));
  });

  it('excludes only confirmation bookkeeping while preserving Bundle and Acceptance refs', () => {
    const changedBookkeeping = {
      ...confirmation,
      status: 'blocked',
      confirmedAt: '2026-07-17T01:00:00.000Z',
      sourceDocumentHash: `sha256:${'9'.repeat(64)}`,
      confirmationRender: { html: '<section>blocked</section>' },
    };
    const changedBundle = {
      ...confirmation,
      bundleBinding: { ...confirmation.bundleBinding, hash: `sha256:${'8'.repeat(64)}` },
    };

    expect(confirmationProjectionHash(changedBookkeeping)).toBe(
      confirmationProjectionHash(confirmation)
    );
    expect(confirmationProjectionHash(changedBundle)).not.toBe(
      confirmationProjectionHash(confirmation)
    );
  });

  it('excludes only sourceDocumentHash from the complete source document domain', () => {
    const changedStoredConfirmation = {
      ...source,
      implementationConfirmation: {
        ...confirmation,
        status: 'blocked',
      },
    };
    const changedSelfHash = {
      ...source,
      sourceDocumentHash: `sha256:${'f'.repeat(64)}`,
    };

    expect(sourceDocumentHash(changedStoredConfirmation)).not.toBe(sourceDocumentHash(source));
    expect(sourceDocumentHash(changedSelfHash)).toBe(sourceDocumentHash(source));
  });
});
