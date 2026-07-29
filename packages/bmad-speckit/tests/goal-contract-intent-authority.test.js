const assert = require('node:assert');
const { describe, it } = require('node:test');

const {
  compileIntentAuthorityEnvelope,
  verifyIntentAuthorityEnvelope,
} = require('../src/utils/goal-contract/control-plane/intent-authority.ts');

function bundle() {
  return {
    sourceCompositionPolicyHash: 'sha256:' + '1'.repeat(64),
    orderedSourceSnapshotSetHash: 'sha256:' + '2'.repeat(64),
    sourceAuthorityBundleHash: 'sha256:' + '3'.repeat(64),
  };
}

function subject() {
  return {
    sourceSnapshotHash: 'sha256:' + '4'.repeat(64),
    canonicalIntentSemanticHash: 'sha256:' + '5'.repeat(64),
    specSpanRegistryHash: 'sha256:' + '6'.repeat(64),
  };
}

function expectFailure(action, failureClass) {
  assert.throws(action, (error) => error.failureClass === failureClass);
}

describe('goal-contract intent authority envelope', () => {
  it('keeps authority kinds distinct while preserving semantic subject', () => {
    const direct = compileIntentAuthorityEnvelope({
      subject: subject(),
      compositeSourceAuthorityBundle: bundle(),
      authorityBasis: {
        kind: 'direct_source_declaration',
        sourceDeclarationHash: 'sha256:' + '7'.repeat(64),
        declaringUserAuthorityIdentity: 'user:planner',
        entryScenario: 'standalone_goal_contract',
      },
    });
    const confirmed = compileIntentAuthorityEnvelope({
      subject: subject(),
      compositeSourceAuthorityBundle: bundle(),
      authorityBasis: {
        kind: 'implementation_confirmation',
        requirementRecordId: 'REQ-001',
        confirmationHash: 'sha256:' + '8'.repeat(64),
        confirmationSchemaVersion: 'implementation-confirmation/v1',
        confirmedAuthorityIdentity: 'user:planner',
      },
    });
    const imported = compileIntentAuthorityEnvelope({
      subject: subject(),
      compositeSourceAuthorityBundle: bundle(),
      authorityBasis: {
        kind: 'imported_approved_contract',
        importedContractHash: 'sha256:' + '9'.repeat(64),
        approvalReceiptHash: 'sha256:' + 'a'.repeat(64),
        approvalAuthorityIdentity: 'authority:release',
      },
    });

    assert.equal(
      new Set([
        direct.authorityAttestationHash,
        confirmed.authorityAttestationHash,
        imported.authorityAttestationHash,
      ]).size,
      3
    );
    assert.deepEqual(verifyIntentAuthorityEnvelope(direct), direct);
    assert.deepEqual(verifyIntentAuthorityEnvelope(confirmed), confirmed);
    assert.deepEqual(verifyIntentAuthorityEnvelope(imported), imported);
  });

  it('rejects missing authority, fabricated confirmation, and confirmed fallback', () => {
    expectFailure(
      () =>
        compileIntentAuthorityEnvelope({
          subject: subject(),
          compositeSourceAuthorityBundle: bundle(),
        }),
      'authority_missing'
    );
    expectFailure(
      () =>
        compileIntentAuthorityEnvelope({
          subject: subject(),
          compositeSourceAuthorityBundle: bundle(),
          authorityBasis: {
            kind: 'implementation_confirmation',
            requirementRecordId: 'REQ-001',
          },
        }),
      'authority_missing'
    );
    expectFailure(
      () =>
        compileIntentAuthorityEnvelope({
          subject: subject(),
          compositeSourceAuthorityBundle: bundle(),
          entryScenario: 'confirmed_requirements',
          authorityBasis: {
            kind: 'direct_source_declaration',
            sourceDeclarationHash: 'sha256:' + '7'.repeat(64),
            declaringUserAuthorityIdentity: 'user:planner',
            entryScenario: 'confirmed_requirements',
          },
        }),
      'authority_fallback_forbidden'
    );
  });

  it('rejects a syntactically complete confirmation from a standalone entry', () => {
    expectFailure(
      () =>
        compileIntentAuthorityEnvelope({
          subject: subject(),
          compositeSourceAuthorityBundle: bundle(),
          entryScenario: 'standalone_goal_contract',
          authorityBasis: {
            kind: 'implementation_confirmation',
            requirementRecordId: 'REQ-001',
            confirmationHash: 'sha256:' + '8'.repeat(64),
            confirmationSchemaVersion: 'implementation-confirmation/v1',
            confirmedAuthorityIdentity: 'user:planner',
          },
        }),
      'authority_fallback_forbidden'
    );
  });

  it('rejects caller-authored attestation and cross-kind replay mutations', () => {
    const base = {
      subject: subject(),
      compositeSourceAuthorityBundle: bundle(),
      authorityBasis: {
        kind: 'imported_approved_contract',
        importedContractHash: 'sha256:' + '9'.repeat(64),
        approvalReceiptHash: 'sha256:' + 'a'.repeat(64),
        approvalAuthorityIdentity: 'authority:release',
      },
    };
    const envelope = compileIntentAuthorityEnvelope(base);
    expectFailure(
      () =>
        compileIntentAuthorityEnvelope({
          ...base,
          authorityAttestationHash: envelope.authorityAttestationHash,
        }),
      'authority_provenance_forbidden'
    );
    expectFailure(
      () =>
        verifyIntentAuthorityEnvelope({
          ...envelope,
          authorityBasis: {
            ...envelope.authorityBasis,
            kind: 'direct_source_declaration',
          },
        }),
      'authority_attestation_mismatch'
    );
    expectFailure(
      () =>
        compileIntentAuthorityEnvelope({
          subject: subject(),
          compositeSourceAuthorityBundle: bundle(),
          authorityBasis: {
            kind: 'direct_source_declaration',
            sourceDeclarationHash: 'sha256:' + '7'.repeat(64),
            declaringUserAuthorityIdentity: 'user:planner',
            entryScenario: 'standalone_goal_contract',
            approvalReceiptHash: 'sha256:' + 'a'.repeat(64),
          },
        }),
      'authority_kind_mismatch'
    );
    expectFailure(
      () =>
        compileIntentAuthorityEnvelope({
          subject: subject(),
          compositeSourceAuthorityBundle: bundle(),
          authorityBasis: {
            kind: 'imported_approved_contract',
            importedContractHash: 'sha256:' + '9'.repeat(64),
            approvalReceiptHash: 'sha256:' + 'a'.repeat(64),
            approvalAuthorityIdentity: 'authority:release',
            confirmationHash: 'sha256:' + '8'.repeat(64),
          },
        }),
      'authority_kind_mismatch'
    );
  });
});
