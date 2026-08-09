import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  compileRequirementsEffectivePassReceipt,
  type RequirementsEffectivePassReceipt,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-requirements-effective-pass-gate';
import { sha256Stable } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-semantic-resolver';

const HASHES = {
  request: sha256Stable({ field: 'fixture-confirmation-request' }),
  attempt: sha256Stable({ field: 'fixture-confirmation-attempt' }),
  scope: sha256Stable({ field: 'fixture-confirmation-scope' }),
  evidence: sha256Stable({ field: 'fixture-confirmation-evidence' }),
  providerInvocation: sha256Stable({ field: 'fixture-confirmation-provider-invocation' }),
  prompt: sha256Stable({ field: 'fixture-confirmation-prompt' }),
  schema: sha256Stable({ field: 'fixture-confirmation-schema' }),
  providerConfiguration: sha256Stable({ field: 'fixture-confirmation-provider-configuration' }),
  ledger: sha256Stable({ field: 'fixture-confirmation-ledger' }),
};

function effectivePassInput(): Record<string, unknown> {
  const coverageUnitRefs = ['coverage/dimension', 'coverage/must', 'coverage/projection'];
  return {
    request: {
      actorClass: 'requirements_critical_auditor_judge',
      judgeRole: 'requirements_critical_auditor',
      requestHash: HASHES.request,
      attemptKeyHash: HASHES.attempt,
      scopeManifestHash: HASHES.scope,
      promptTemplateHash: HASHES.prompt,
      assessmentSchemaHash: HASHES.schema,
      providerAuthority: {
        providerRef: 'provider/requirements',
        providerRegistryHash: sha256Stable({ field: 'fixture-confirmation-provider-registry' }),
        providerConfigurationHash: HASHES.providerConfiguration,
        credentialRevision: 1,
      },
    },
    assessment: {
      schemaVersion: 'critical-auditor-judge-assessment/v1',
      actorClass: 'requirements_critical_auditor_judge',
      judgeRole: 'requirements_critical_auditor',
      verdict: 'no_new_valid_gap',
      validatedGaps: [],
    },
    frozenScope: {
      coverageUnitRefs,
    },
    coverage: {
      observedCoverageUnitRefs: [...coverageUnitRefs],
      unassessedScopeRefs: [],
      blockingConditionRefs: [],
    },
    evidence: {
      evidenceManifestHash: HASHES.evidence,
      providerInvocationReceiptHash: HASHES.providerInvocation,
      missingEvidenceRefs: [],
    },
    priorFindings: {
      ledgerEntryHash: HASHES.ledger,
      requiredPriorFindingRefs: ['finding/1', 'finding/2'],
      currentDispositionRefs: ['finding/1', 'finding/2'],
      unresolvedPriorFindingRefs: [],
    },
    veto: {
      requirementsVetoRefs: ['veto/security', 'veto/scope'],
      passedVetoRefs: ['veto/security', 'veto/scope'],
    },
    currentAuthority: {
      attemptKeyHash: HASHES.attempt,
      scopeManifestHash: HASHES.scope,
      evidenceManifestHash: HASHES.evidence,
      providerInvocationReceiptHash: HASHES.providerInvocation,
      promptTemplateHash: HASHES.prompt,
      assessmentSchemaHash: HASHES.schema,
      providerConfigurationHash: HASHES.providerConfiguration,
    },
    identity: {
      replayDetected: false,
      duplicateIdentityDetected: false,
    },
  };
}

export function materializeRequirementsEffectivePassFixture(input: {
  root: string;
  recordId: string;
}): {
  receipt: RequirementsEffectivePassReceipt;
  receiptPath: string;
} {
  const receipt = compileRequirementsEffectivePassReceipt(effectivePassInput());
  const receiptPath = path.join(
    input.root,
    '_bmad-output',
    'runtime',
    'requirement-records',
    input.recordId,
    'judge',
    'requirements_critical_auditor',
    'requirements-effective-pass.receipt.json'
  );
  fs.mkdirSync(path.dirname(receiptPath), { recursive: true });
  fs.writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, 'utf8');
  return { receipt, receiptPath };
}
