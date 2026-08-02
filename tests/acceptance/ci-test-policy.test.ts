import {
  existsSync,
  lstatSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const {
  analyzePolicyExceptions,
  expandCapabilityBehaviorBindings,
  expandSemanticObligations,
  PROFILES,
  readTestPolicy,
  STATES,
  validateTestPolicy,
} = require('../../tools/ci/test-policy.cjs');
const {
  readCanonicalArtifact,
  writeCanonicalArtifact,
} = require('../../tools/ci/canonical-artifact.cjs');
const { collectAuditFacts } = require('../../tools/test-portfolio-audit/facts.cjs');

const basePolicy = {
  schemaVersion: 'test-portfolio-policy/v1',
  budgets: {
    executableTestCount: 1200,
    corePermanentCount: 120,
    prP95Minutes: 10,
  },
  profiles: [
    'pr-fast',
    'pr-full',
    'nightly-deep',
    'release-verify',
    'nightly-full',
    'release-full',
  ],
  semanticObligations: [
    {
      model: 'requirement_confirmation',
      applicability: 'applicable',
      minimumEvidenceKind: 'indirect',
      requiredBehaviors: [
        'state_entry',
        'applicability_or_not_applicable',
        'successful_promotion',
        'fail_closed',
        'invalidation',
        'reconfirmation',
        'evidence_binding',
        'authority_rejection',
        'stale_evidence_rejection',
      ],
    },
    {
      model: 'architecture_confirmation',
      applicability: 'applicable',
      minimumEvidenceKind: 'indirect',
      requiredBehaviors: [
        'state_entry',
        'applicability_or_not_applicable',
        'successful_promotion',
        'fail_closed',
        'invalidation',
        'reconfirmation',
        'evidence_binding',
        'authority_rejection',
        'stale_evidence_rejection',
      ],
    },
    {
      model: 'implementation_readiness',
      applicability: 'applicable',
      minimumEvidenceKind: 'indirect',
      requiredBehaviors: [
        'state_entry',
        'applicability_or_not_applicable',
        'successful_promotion',
        'fail_closed',
        'invalidation',
        'reconfirmation',
        'evidence_binding',
        'authority_rejection',
        'stale_evidence_rejection',
      ],
    },
    {
      model: 'execution_closure',
      applicability: 'applicable',
      minimumEvidenceKind: 'indirect',
      requiredBehaviors: [
        'state_entry',
        'applicability_or_not_applicable',
        'successful_promotion',
        'fail_closed',
        'invalidation',
        'reconfirmation',
        'evidence_binding',
        'authority_rejection',
        'stale_evidence_rejection',
      ],
    },
    {
      model: 'audit_review',
      applicability: 'applicable',
      minimumEvidenceKind: 'indirect',
      requiredBehaviors: [
        'state_entry',
        'applicability_or_not_applicable',
        'successful_promotion',
        'fail_closed',
        'invalidation',
        'reconfirmation',
        'evidence_binding',
        'authority_rejection',
        'stale_evidence_rejection',
        'reverse_audit_execution',
        'judge_continuation',
      ],
    },
    {
      model: 'delivery_confirmation',
      applicability: 'applicable',
      minimumEvidenceKind: 'indirect',
      requiredBehaviors: [
        'state_entry',
        'applicability_or_not_applicable',
        'successful_promotion',
        'fail_closed',
        'invalidation',
        'reconfirmation',
        'evidence_binding',
        'authority_rejection',
        'stale_evidence_rejection',
        'record_closed_final_transition',
      ],
    },
  ],
  semanticJourneys: [
    {
      journeyId: 'six-model-complete-record-closed',
      model: 'six_model_e2e',
      transition: 'ingress_to_record_closed',
      applicability: 'applicable',
      minimumEvidenceKind: 'direct',
      anyOfEvidenceRefs: ['trace:six-model/full-e2e/record-closed'],
      affectedTargetRefs: ['capability:six-model-state-machine', 'transition:record-closed'],
      remediationOwner: 'dev',
    },
  ],
  semanticEvidenceBindings: [],
  protectedCapabilities: [
    {
      capabilityId: 'six-model-state-machine',
      selectionRefs: ['script:test:ci:codex'],
      survivalEvidenceRefs: ['target:src/main-agent-state-machine.ts'],
      requiredBehaviors: {
        'requirement_confirmation/*': {
          anyOfEvidenceRefs: ['target:src/main-agent-state-machine.ts'],
          evidenceKind: 'indirect',
        },
      },
    },
  ],
  classification: {
    directoryRules: [
      { ruleId: 'acceptance', pattern: 'tests/acceptance/**', state: 'retained_on_demand' },
    ],
    exceptions: [],
  },
  selection: {
    expansionOrder: ['trace_capability', 'feature', 'package'],
    highDiffusionPathRules: ['packages/bmad-speckit/src/utils/main-agent/**'],
    releaseSurfacePathRules: ['package.json'],
    productSurvivalCapabilityRefs: ['six-model-state-machine'],
    releaseCapabilityRefs: ['six-model-state-machine'],
    releaseRequiredBindingKinds: [
      'package_install',
      'cli_bin',
      'consumer_compatibility',
      'packaged_runtime',
      'security_encoding_persistence',
      'protected_acceptance_or_proof',
    ],
  },
  timing: {
    unknownDurationMs: 60_000,
    maxShardDurationMs: 480_000,
    maxShardsPerLane: 8,
  },
  deletion: {
    optimizationUseForbidden: true,
    requiredReviewMode: 'manual_exception',
    minimumApprovals: 2,
    maxBatchSize: 10,
    deterministicReasonCodes: [
      'EXACT_DUPLICATE',
      'TARGET_REMOVED',
      'SELF_PROVING_ORACLE',
      'REPLACED_BY_CONTRACT_TEST',
    ],
    localReview: { maxCandidates: 10, maxCalls: 1, retries: 0, timeoutMs: 120000 },
  },
};

const temporaryRoots: string[] = [];

function temporaryRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'ci-test-policy-'));
  temporaryRoots.push(root);
  return root;
}

function matchesDeclaredRoot(testPath: string, pattern: string): boolean {
  if (!pattern.endsWith('/**')) return false;
  const prefix = pattern.slice(0, -3);
  return testPath === prefix || testPath.startsWith(`${prefix}/`);
}

afterEach(() => {
  while (temporaryRoots.length > 0) {
    rmSync(temporaryRoots.pop()!, { recursive: true, force: true });
  }
});

describe('test portfolio policy', () => {
  it('tracks the complete six-model E2E as a semantic Journey instead of a test file', () => {
    expect(basePolicy.semanticJourneys).toEqual([
      {
        journeyId: 'six-model-complete-record-closed',
        model: 'six_model_e2e',
        transition: 'ingress_to_record_closed',
        applicability: 'applicable',
        minimumEvidenceKind: 'direct',
        anyOfEvidenceRefs: ['trace:six-model/full-e2e/record-closed'],
        affectedTargetRefs: ['capability:six-model-state-machine', 'transition:record-closed'],
        remediationOwner: 'dev',
      },
    ]);
    expect(basePolicy.semanticJourneys[0]).not.toHaveProperty('identityKey');
    expect(basePolicy.semanticJourneys[0]).not.toHaveProperty('testPath');
  });

  it('accepts only the exact profiles, states, and hard budgets', () => {
    expect(PROFILES).toEqual([
      'pr-fast',
      'pr-full',
      'nightly-deep',
      'release-verify',
      'nightly-full',
      'release-full',
    ]);
    expect(STATES).toEqual([
      'core_permanent',
      'feature_working_set',
      'retained_on_demand',
      'deletion_candidate',
    ]);
    expect(validateTestPolicy(structuredClone(basePolicy))).toEqual(basePolicy);
  });

  it('expands a compact six-model behavior authority deterministically', () => {
    const obligations = expandSemanticObligations(structuredClone(basePolicy));

    expect(obligations).toHaveLength(58);
    expect(obligations[0]).toEqual({
      obligationId: 'architecture_confirmation/applicability_or_not_applicable',
      model: 'architecture_confirmation',
      behavior: 'applicability_or_not_applicable',
      applicability: 'applicable',
      minimumEvidenceKind: 'indirect',
    });
    expect(obligations).toContainEqual({
      obligationId: 'audit_review/reverse_audit_execution',
      model: 'audit_review',
      behavior: 'reverse_audit_execution',
      applicability: 'applicable',
      minimumEvidenceKind: 'indirect',
    });
    expect(obligations).toContainEqual({
      obligationId: 'delivery_confirmation/record_closed_final_transition',
      model: 'delivery_confirmation',
      behavior: 'record_closed_final_transition',
      applicability: 'applicable',
      minimumEvidenceKind: 'indirect',
    });
    expect(obligations).toContainEqual({
      obligationId: 'survival/six-model-state-machine',
      model: 'minimum_survival',
      behavior: 'six-model-state-machine',
      applicability: 'applicable',
      minimumEvidenceKind: 'direct',
    });
  });

  it('expands survival obligations from semantic survival evidence, not selection membership', () => {
    const capability = basePolicy.protectedCapabilities[0];
    const survivalBinding = expandCapabilityBehaviorBindings(basePolicy, capability).find(
      (binding: any) => binding.obligationId === 'survival/six-model-state-machine'
    );

    expect(survivalBinding).toEqual({
      obligationId: 'survival/six-model-state-machine',
      anyOfEvidenceRefs: ['target:src/main-agent-state-machine.ts'],
      evidenceKind: 'direct',
    });
  });

  it.each([0, 119, 120])('accepts a safe permanent-core budget of %s', (corePermanentCount) => {
    const policy = structuredClone(basePolicy);
    policy.budgets.corePermanentCount = corePermanentCount;

    expect(validateTestPolicy(policy)).toEqual(policy);
  });

  it.each([-1, 121, 1.5, Number.NaN, Number.MAX_SAFE_INTEGER + 1])(
    'rejects an out-of-range permanent-core budget of %s',
    (corePermanentCount) => {
      const policy = structuredClone(basePolicy);
      policy.budgets.corePermanentCount = corePermanentCount;

      expect(() => validateTestPolicy(policy)).toThrow('POLICY_CORE_BUDGET_INVALID');
    }
  );

  it.each([0, 300001, 1.5, Number.NaN])(
    'rejects an invalid bounded local review timeout of %s',
    (timeoutMs) => {
      const policy = structuredClone(basePolicy);
      policy.deletion.localReview.timeoutMs = timeoutMs;

      expect(() => validateTestPolicy(policy)).toThrow('POLICY_LOCAL_REVIEW_TIMEOUT_INVALID');
    }
  );

  it('requires deletion to remain a manual exception rather than a CI optimization tool', () => {
    for (const [mutate, code] of [
      [
        (policy: any) => (policy.deletion.optimizationUseForbidden = false),
        'POLICY_DELETION_OPTIMIZATION_FORBIDDEN_REQUIRED',
      ],
      [
        (policy: any) => (policy.deletion.requiredReviewMode = 'local_model_once'),
        'POLICY_DELETION_REVIEW_MODE_INVALID',
      ],
      [
        (policy: any) => (policy.deletion.minimumApprovals = 1),
        'POLICY_DELETION_APPROVALS_INVALID',
      ],
      [(policy: any) => (policy.deletion.maxBatchSize = 11), 'POLICY_DELETION_BATCH_SIZE_INVALID'],
    ] as const) {
      const policy = structuredClone(basePolicy);
      mutate(policy);
      expect(() => validateTestPolicy(policy)).toThrow(code);
    }
  });

  it('fails closed on equal-specificity classification conflict independent of rule order', () => {
    const conflicting = structuredClone(basePolicy);
    conflicting.classification.directoryRules.push({
      ruleId: 'acceptance-conflict',
      pattern: 'tests/acceptance/**',
      state: 'deletion_candidate',
    });

    expect(() => validateTestPolicy(conflicting)).toThrow('POLICY_CLASSIFICATION_CONFLICT');
    conflicting.classification.directoryRules.reverse();
    expect(() => validateTestPolicy(conflicting)).toThrow('POLICY_CLASSIFICATION_CONFLICT');
  });

  it('rejects a redundant full-record exception', () => {
    const redundant = structuredClone(basePolicy);
    redundant.classification.exceptions.push({
      testPath: 'tests/acceptance/example.test.ts',
      state: 'retained_on_demand',
    });

    expect(() => validateTestPolicy(redundant)).toThrow('POLICY_EXCEPTION_REDUNDANT');
  });

  it('reports repeated override shapes as directory-rule promotion candidates', () => {
    const policy = structuredClone(basePolicy);
    for (const name of ['linux', 'macos', 'windows']) {
      policy.classification.exceptions.push({
        testPath: `tests/compatibility/${name}.test.ts`,
        state: 'deletion_candidate',
      });
    }

    const diagnostics = analyzePolicyExceptions({
      policy,
      baselineExceptionCount: 0,
    });

    expect(diagnostics.directoryRulePromotionCandidates).toEqual([
      expect.objectContaining({
        directory: 'tests/compatibility',
        exceptionCount: 3,
      }),
    ]);
    expect(diagnostics.exceptionCount).toBe(3);
    expect(diagnostics.exceptionCountDelta).toBe(3);
    expect(diagnostics.redundantExceptionCount).toBe(0);
  });

  it.each([
    ['state', (policy: any) => (policy.classification.directoryRules[0].state = 'unknown')],
    ['profile', (policy: any) => (policy.profiles[3] = 'unknown')],
    ['reason', (policy: any) => policy.deletion.deterministicReasonCodes.push('MODEL_APPROVED')],
    ['expansion level', (policy: any) => policy.selection.expansionOrder.push('repository')],
  ])('rejects an unknown %s', (_label, mutate) => {
    const policy = structuredClone(basePolicy);
    mutate(policy);
    expect(() => validateTestPolicy(policy)).toThrow(/^POLICY_/);
  });

  it('rejects missing or empty Task 4 selection authority fields', () => {
    const cases = [
      [
        'release surface rules missing',
        (policy: any) => delete policy.selection.releaseSurfacePathRules,
        'POLICY_RELEASE_SURFACE_RULES_INVALID',
      ],
      [
        'product survival refs empty',
        (policy: any) => (policy.selection.productSurvivalCapabilityRefs = []),
        'POLICY_PRODUCT_SURVIVAL_REFS_INVALID',
      ],
      [
        'release capability refs missing',
        (policy: any) => delete policy.selection.releaseCapabilityRefs,
        'POLICY_RELEASE_CAPABILITY_REFS_INVALID',
      ],
      [
        'release binding kinds empty',
        (policy: any) => (policy.selection.releaseRequiredBindingKinds = []),
        'POLICY_RELEASE_REQUIRED_BINDING_KINDS_INVALID',
      ],
    ] as const;

    for (const [label, mutate, code] of cases) {
      const policy = structuredClone(basePolicy);
      mutate(policy);
      expect(() => validateTestPolicy(policy), label).toThrow(code);
    }
  });

  it('rejects a policy with the entire Task 4 selection authority group missing', () => {
    const policy = structuredClone(basePolicy);
    delete policy.selection.releaseSurfacePathRules;
    delete policy.selection.productSurvivalCapabilityRefs;
    delete policy.selection.releaseCapabilityRefs;
    delete policy.selection.releaseRequiredBindingKinds;

    expect(() => validateTestPolicy(policy)).toThrow('POLICY_RELEASE_SURFACE_RULES_INVALID');
  });

  it('requires the exact governed release critical binding kinds', () => {
    const missing = structuredClone(basePolicy);
    missing.selection.releaseRequiredBindingKinds.pop();
    expect(() => validateTestPolicy(missing)).toThrow(
      'POLICY_RELEASE_REQUIRED_BINDING_KINDS_INVALID'
    );

    const extra = structuredClone(basePolicy);
    extra.selection.releaseRequiredBindingKinds.push('release_path');
    expect(() => validateTestPolicy(extra)).toThrow(
      'POLICY_RELEASE_REQUIRED_BINDING_KINDS_INVALID'
    );
  });

  it('loads the tracked policy with every minimum-survival protected capability', () => {
    const policy = readTestPolicy(process.cwd());
    const obligations = expandSemanticObligations(policy);
    const bindings = policy.protectedCapabilities.flatMap((capability: any) =>
      expandCapabilityBehaviorBindings(policy, capability)
    );
    const sourceAuthorityTarget = (fileName: string) =>
      `target:packages/bmad-speckit/src/main-agent/source-authority/scripts/${fileName}`;
    const auditTarget = sourceAuthorityTarget('audit-triad-orchestrator.ts');

    expect(policy.semanticJourneys).toEqual([
      expect.objectContaining({
        journeyId: 'six-model-complete-record-closed',
        minimumEvidenceKind: 'indirect',
      }),
    ]);
    expect(policy.protectedCapabilities.map((entry: any) => entry.selectionRefs)).toEqual([
      ['script:test:consumer-install-final'],
      ['script:test:consumer-runtime-final'],
      ['script:test:ci:codex'],
      ['script:test:runtime-policy-inject'],
      ['script:test:main-agent-sprint-status-write-gate'],
      ['script:test:governance-audit:round1'],
      ['script:test:governance-audit:round2'],
      ['script:core:requirement-record-authority'],
      ['script:core:judge-audit-reverse-audit-continuation'],
      ['script:core:cli-startup-boundary'],
      ['script:core:canonical-package-runtime-boundary'],
      ['script:core:persistence-boundary'],
      ['script:core:encoding-boundary'],
    ]);
    expect(policy.protectedCapabilities).toHaveLength(13);
    expect(
      Object.fromEntries(
        policy.protectedCapabilities.map((entry: any) => [
          entry.capabilityId,
          entry.survivalEvidenceRefs,
        ])
      )
    ).toEqual({
      'consumer-install-boundary': ['target:scripts/init-to-root.js'],
      'consumer-runtime-boundary': [
        sourceAuthorityTarget('requirements-contract-real-consumer-journey.ts'),
      ],
      'six-model-state-machine': [sourceAuthorityTarget('orchestration-state.ts')],
      'runtime-policy-security-boundary': [sourceAuthorityTarget('stable-runtime-policy-json.ts')],
      'sprint-status-write-security-boundary': [
        sourceAuthorityTarget('sprint-status-authorized-update.ts'),
      ],
      'governance-proof-round-1': [sourceAuthorityTarget('governance-remediation-runner.ts')],
      'governance-proof-round-2': [sourceAuthorityTarget('governance-remediation-artifact.ts')],
      'requirement-record-authority': [
        sourceAuthorityTarget('requirement-record-control-store.ts'),
      ],
      'judge-audit-reverse-audit-continuation': [auditTarget],
      'cli-startup-boundary': ['target:scripts/bmad-speckit-cli.js'],
      'canonical-package-runtime-boundary': [
        sourceAuthorityTarget('requirements-contract-package-runtime-index.ts'),
      ],
      'persistence-boundary': [sourceAuthorityTarget('governance-packet-execution-store.ts')],
      'encoding-boundary': [sourceAuthorityTarget('requirements-contract-intake-receipt.ts')],
    });
    const sixModelCapability = policy.protectedCapabilities.find(
      (entry: any) => entry.capabilityId === 'six-model-state-machine'
    );
    expect(sixModelCapability.requiredBehaviors).toEqual({});
    expect(sixModelCapability.semanticEvidenceNamespace).toBe('trace:six-model');
    const sixModelBindings = expandCapabilityBehaviorBindings(policy, sixModelCapability).filter(
      (binding: any) => !binding.obligationId.startsWith('survival/')
    );
    expect(sixModelBindings).toHaveLength(57);
    expect(
      sixModelBindings.every(
        (binding: any) =>
          binding.anyOfEvidenceRefs.length === 1 &&
          binding.anyOfEvidenceRefs[0].startsWith('trace:six-model/') &&
          !binding.obligationId.includes('*')
      )
    ).toBe(true);
    expect(
      policy.protectedCapabilities.some((entry: any) =>
        Object.prototype.hasOwnProperty.call(entry, 'coreIdentityKeys')
      )
    ).toBe(false);
    expect(obligations).toHaveLength(70);
    expect(bindings.map((binding: any) => binding.obligationId).sort()).toEqual(
      obligations.map((obligation: any) => obligation.obligationId)
    );
    expect(
      bindings
        .flatMap((binding: any) => binding.anyOfEvidenceRefs)
        .some((evidenceRef: string) => evidenceRef.startsWith('selection:'))
    ).toBe(false);
    expect(policy.classification.directoryRules.map((rule: any) => rule.pattern)).toEqual(
      expect.arrayContaining(['tests/**', 'packages/bmad-speckit/tests/**'])
    );
    expect(policy.selection.highDiffusionPathRules).toContain('repo-governance/ci/**');
    expect(policy.selection.releaseRequiredBindingKinds).toEqual(
      basePolicy.selection.releaseRequiredBindingKinds
    );
  });

  it('binds only production-observed evidence for the audited six-model behavior gaps', () => {
    const policy = readTestPolicy(process.cwd());
    const evidenceByTest = Object.fromEntries(
      policy.semanticEvidenceBindings.map((entry: any) => [
        entry.testPath,
        Object.fromEntries(
          entry.bindings.map((binding: any) => [binding.evidenceRef, binding.evidenceKind])
        ),
      ])
    );

    expect(evidenceByTest).toMatchObject({
      'tests/acceptance/confirmation-drift-classifier.test.ts': {
        'trace:six-model/requirement-confirmation/reconfirmation': 'indirect',
        'trace:six-model/requirement-confirmation/stale-evidence-rejection': 'indirect',
      },
      'tests/acceptance/requirements-contract-stage-five-star-audit-architecture-wave-gate.test.ts':
        {
          'trace:six-model/architecture-confirmation/invalidation': 'indirect',
        },
      'tests/acceptance/readiness-drift-closeout-proof.test.ts': {
        'trace:six-model/implementation-readiness/stale-evidence-rejection': 'direct',
        'trace:six-model/execution-closure/invalidation': 'indirect',
      },
      'tests/acceptance/critical-auditor-receipt-binding.test.ts': {
        'trace:six-model/audit-review/fail-closed': 'direct',
      },
      'tests/acceptance/requirements-contract-reverse-audit.test.ts': {
        'trace:six-model/audit-review/judge-continuation': 'direct',
      },
      'tests/acceptance/requirements-contract-six-model-runtime-bridge-authority.test.ts': {
        'trace:six-model/audit-review/state-entry': 'indirect',
        'trace:six-model/delivery-confirmation/fail-closed': 'indirect',
        'trace:six-model/delivery-confirmation/state-entry': 'indirect',
        'trace:six-model/execution-closure/authority-rejection': 'indirect',
        'trace:six-model/execution-closure/state-entry': 'indirect',
        'trace:six-model/implementation-readiness/authority-rejection': 'indirect',
        'trace:six-model/implementation-readiness/state-entry': 'indirect',
        'trace:six-model/implementation-readiness/successful-promotion': 'indirect',
      },
      'tests/acceptance/requirements-contract-six-model-receipt-projection-transaction.test.ts': {
        'trace:six-model/execution-closure/evidence-binding': 'direct',
        'trace:six-model/implementation-readiness/evidence-binding': 'direct',
      },
      'tests/unit/main-agent-implementation-readiness-gate.test.ts': {
        'trace:six-model/architecture-confirmation/applicability-or-not-applicable': 'indirect',
        'trace:six-model/implementation-readiness/fail-closed': 'direct',
      },
      'tests/acceptance/main-agent-delivery-truth-gate.test.ts': {
        'trace:six-model/delivery-confirmation/stale-evidence-rejection': 'indirect',
        'trace:six-model/delivery-confirmation/successful-promotion': 'direct',
      },
      'tests/acceptance/ai-tdd-contract-gate.test.ts': {
        'trace:six-model/execution-closure/stale-evidence-rejection': 'indirect',
      },
    });
  });

  it('forbids deterministic frozen core identities in policy authority', () => {
    const policy = structuredClone(basePolicy);
    policy.protectedCapabilities[0].coreIdentityKeys = ['vitest::tests/core/state-machine.test.ts'];
    expect(() => validateTestPolicy(policy)).toThrow('POLICY_CORE_IDENTITY_KEYS_FORBIDDEN');
  });

  it('accepts only explicit true for survival-evidence test binding', () => {
    const enabled = structuredClone(basePolicy);
    enabled.protectedCapabilities[0].bindTestsBySurvivalEvidence = true;
    expect(() => validateTestPolicy(enabled)).not.toThrow();

    const disabled = structuredClone(basePolicy);
    disabled.protectedCapabilities[0].bindTestsBySurvivalEvidence = false;
    expect(() => validateTestPolicy(disabled)).toThrow(
      'POLICY_SURVIVAL_EVIDENCE_TEST_BINDING_INVALID'
    );
  });

  it('rejects duplicate tracked semantic evidence identities', () => {
    const policy = structuredClone(basePolicy);
    policy.protectedCapabilities[0].semanticEvidenceNamespace = 'trace:six-model';
    policy.protectedCapabilities[0].requiredBehaviors = {};
    const binding = {
      runnerId: 'vitest',
      testPath: 'tests/core/state-machine.test.ts',
      bindings: [
        {
          evidenceRef: 'trace:six-model/requirement-confirmation/state-entry',
          evidenceKind: 'direct',
        },
      ],
    };
    policy.semanticEvidenceBindings = [binding, structuredClone(binding)];

    expect(() => validateTestPolicy(policy)).toThrow('POLICY_SEMANTIC_EVIDENCE_IDENTITY_DUPLICATE');
  });

  it('rejects semantic evidence outside the declared obligation namespace', () => {
    const policy = structuredClone(basePolicy);
    policy.protectedCapabilities[0].semanticEvidenceNamespace = 'trace:six-model';
    policy.protectedCapabilities[0].requiredBehaviors = {};
    policy.semanticEvidenceBindings = [
      {
        runnerId: 'vitest',
        testPath: 'tests/core/state-machine.test.ts',
        bindings: [
          {
            evidenceRef: 'trace:unrelated/requirement-confirmation/state-entry',
            evidenceKind: 'direct',
          },
        ],
      },
    ];

    expect(() => validateTestPolicy(policy)).toThrow(
      'POLICY_SEMANTIC_EVIDENCE_REF_OUTSIDE_NAMESPACE'
    );
  });

  it('rejects one semantic evidence ref assigned to multiple test identities', () => {
    const policy = structuredClone(basePolicy);
    policy.protectedCapabilities[0].semanticEvidenceNamespace = 'trace:six-model';
    policy.protectedCapabilities[0].requiredBehaviors = {};
    const evidenceRef = 'trace:six-model/requirement-confirmation/state-entry';
    policy.semanticEvidenceBindings = [
      {
        runnerId: 'vitest',
        testPath: 'tests/core/state-machine-a.test.ts',
        bindings: [{ evidenceRef, evidenceKind: 'direct' }],
      },
      {
        runnerId: 'vitest',
        testPath: 'tests/core/state-machine-b.test.ts',
        bindings: [{ evidenceRef, evidenceKind: 'direct' }],
      },
    ];

    expect(() => validateTestPolicy(policy)).toThrow(
      'POLICY_SEMANTIC_EVIDENCE_REF_ASSIGNED_MULTIPLE_IDENTITIES'
    );
  });

  it('scopes independent Oracle authority to assertion evidence from the bound test', () => {
    const valid = structuredClone(basePolicy);
    valid.protectedCapabilities[0].semanticEvidenceNamespace = 'trace:six-model';
    valid.protectedCapabilities[0].requiredBehaviors = {};
    valid.semanticEvidenceBindings = [
      {
        runnerId: 'vitest',
        testPath: 'tests/core/state-machine.test.ts',
        bindings: [
          {
            evidenceRef: 'trace:six-model/requirement-confirmation/state-entry',
            evidenceKind: 'direct',
            oracleAuthority: {
              independence: 'independent',
              evidenceRefs: ['source:tests/core/state-machine.test.ts#assertion:line:42'],
            },
          },
        ],
      },
    ];

    expect(() => validateTestPolicy(valid)).not.toThrow();

    const missingEvidence = structuredClone(valid);
    delete missingEvidence.semanticEvidenceBindings[0].bindings[0].oracleAuthority.evidenceRefs;
    expect(() => validateTestPolicy(missingEvidence)).toThrow(
      'POLICY_SEMANTIC_ORACLE_EVIDENCE_INVALID'
    );

    const foreignTest = structuredClone(valid);
    foreignTest.semanticEvidenceBindings[0].bindings[0].oracleAuthority.evidenceRefs = [
      'source:tests/core/other.test.ts#assertion:line:42',
    ];
    expect(() => validateTestPolicy(foreignTest)).toThrow(
      'POLICY_SEMANTIC_ORACLE_EVIDENCE_OUTSIDE_TEST'
    );
  });

  it('expands one exact trace evidence ref per semantic behavior without wildcard duplication', () => {
    const policy = structuredClone(basePolicy);
    const capability = policy.protectedCapabilities[0];
    capability.semanticEvidenceNamespace = 'trace:six-model';
    capability.requiredBehaviors = {};

    const bindings = expandCapabilityBehaviorBindings(policy, capability);
    const behaviorBindings = bindings.filter(
      (binding: any) => !binding.obligationId.startsWith('survival/')
    );

    expect(behaviorBindings).toHaveLength(57);
    expect(
      behaviorBindings.find(
        (binding: any) => binding.obligationId === 'requirement_confirmation/state_entry'
      )
    ).toEqual({
      obligationId: 'requirement_confirmation/state_entry',
      anyOfEvidenceRefs: ['trace:six-model/requirement-confirmation/state-entry'],
      evidenceKind: 'indirect',
    });
    expect(behaviorBindings.some((binding: any) => binding.obligationId.includes('*'))).toBe(false);
  });

  it.each([
    ['missing', (capability: any) => delete capability.survivalEvidenceRefs],
    ['empty', (capability: any) => (capability.survivalEvidenceRefs = [])],
    [
      'selection evidence',
      (capability: any) => (capability.survivalEvidenceRefs = ['selection:script:test:ci:codex']),
    ],
    ['script evidence', (capability: any) => (capability.survivalEvidenceRefs = ['script:test'])],
    [
      'non-canonical semantic evidence',
      (capability: any) => (capability.survivalEvidenceRefs = ['target:']),
    ],
  ])('rejects %s survival evidence refs', (_label, mutate) => {
    const policy = structuredClone(basePolicy);
    mutate(policy.protectedCapabilities[0]);

    expect(() => validateTestPolicy(policy)).toThrow('POLICY_SURVIVAL_EVIDENCE_REFS_INVALID');
  });

  it.each(['script:', 'script:test core-state-machine'])(
    'rejects a non-canonical protected selection ref: %s',
    (selectionRef) => {
      const policy = structuredClone(basePolicy);
      policy.protectedCapabilities[0].selectionRefs = [selectionRef];

      expect(() => validateTestPolicy(policy)).toThrow('POLICY_SELECTION_REF_INVALID');
    }
  );

  it('forbids selection membership from claiming six-model behavior evidence', () => {
    const policy = structuredClone(basePolicy);
    policy.protectedCapabilities[0].requiredBehaviors['requirement_confirmation/*'] = {
      anyOfEvidenceRefs: ['selection:script:test:ci:codex'],
      evidenceKind: 'indirect',
    };

    expect(() => validateTestPolicy(policy)).toThrow('POLICY_REQUIRED_BEHAVIOR_EVIDENCE_INVALID');
  });

  it('forbids policy classification from preselecting permanent core tests', () => {
    const policy = structuredClone(basePolicy);
    policy.classification.directoryRules[0].state = 'core_permanent';

    expect(() => validateTestPolicy(policy)).toThrow('POLICY_STATIC_CORE_FORBIDDEN');
  });

  it('forbids one evidence ref from claiming behavior across multiple models', () => {
    const policy = structuredClone(basePolicy);
    policy.protectedCapabilities[0].requiredBehaviors['architecture_confirmation/state_entry'] = {
      anyOfEvidenceRefs: ['target:src/main-agent-state-machine.ts'],
      evidenceKind: 'indirect',
    };

    expect(() => validateTestPolicy(policy)).toThrow('POLICY_CROSS_MODEL_EVIDENCE_REUSE_FORBIDDEN');
  });

  it('covers every runner-resolved executable test with a configured directory root', async () => {
    const policy = readTestPolicy(process.cwd());
    const facts = await collectAuditFacts({
      repoRoot: process.cwd(),
      probeLimit: 0,
      probeBudgetMs: 0,
      probeSandboxRoot: null,
      timings: {},
    });
    expect(facts.discovery.complete).toBe(true);
    expect(facts.fatalIssues).toEqual([]);
    expect(
      facts.discovery.issues.filter((issue: { severity?: string }) => issue.severity === 'fatal')
    ).toEqual([]);
    expect(facts.inventory.tests.length).toBeGreaterThan(0);

    const patterns = policy.classification.directoryRules.map((rule: any) => rule.pattern);
    const uncovered = facts.inventory.tests
      .map((test: any) => test.testPath)
      .filter(
        (testPath: string) =>
          !patterns.some((pattern: string) => matchesDeclaredRoot(testPath, pattern))
      );

    expect(uncovered).toEqual([]);
  }, 60_000);
});

describe('canonical CI artifacts', () => {
  it('writes atomically under the governed root and verifies canonical bytes on read', () => {
    const repoRoot = temporaryRoot();
    const outputDir = join(repoRoot, '.artifacts', 'test-portfolio');
    const write = writeCanonicalArtifact({
      repoRoot,
      outputDir,
      fileName: 'catalog.json',
      artifact: { z: 1, a: 2 },
    });

    expect(readFileSync(write.path, 'utf8')).toBe('{"a":2,"z":1}\n');
    expect(readCanonicalArtifact({ repoRoot, filePath: write.path })).toMatchObject({
      artifact: { a: 2, z: 1 },
      sha256: write.sha256,
    });
  });

  it('rejects writes outside the governed artifact root', () => {
    const repoRoot = temporaryRoot();
    expect(() =>
      writeCanonicalArtifact({
        repoRoot,
        outputDir: join(repoRoot, '.artifacts', 'ci'),
        fileName: 'catalog.json',
        artifact: {},
      })
    ).toThrow('CI_ARTIFACT_PATH_OUTSIDE_GOVERNED_ROOT');
  });

  it('rejects writes through a governed-root directory link to an external directory', () => {
    const repoRoot = temporaryRoot();
    const externalRoot = temporaryRoot();
    const governedRoot = join(repoRoot, '.artifacts', 'test-portfolio');
    const linkedOutputDir = join(governedRoot, 'linked-output');
    mkdirSync(governedRoot, { recursive: true });
    symlinkSync(externalRoot, linkedOutputDir, process.platform === 'win32' ? 'junction' : 'dir');
    expect(lstatSync(linkedOutputDir).isSymbolicLink()).toBe(true);

    expect(() =>
      writeCanonicalArtifact({
        repoRoot,
        outputDir: linkedOutputDir,
        fileName: 'catalog.json',
        artifact: {},
      })
    ).toThrow('CI_ARTIFACT_PATH_OUTSIDE_GOVERNED_ROOT');
    expect(existsSync(join(externalRoot, 'catalog.json'))).toBe(false);
    expect(readdirSync(externalRoot)).toEqual([]);
  });

  it('rejects readable JSON whose bytes are not canonical', () => {
    const repoRoot = temporaryRoot();
    const filePath = join(repoRoot, '.artifacts', 'test-portfolio', 'catalog.json');
    mkdirSync(join(filePath, '..'), { recursive: true });
    writeFileSync(filePath, '{\n  "z": 1,\n  "a": 2\n}\n', 'utf8');

    expect(() => readCanonicalArtifact({ repoRoot, filePath })).toThrow(
      'CI_ARTIFACT_NOT_CANONICAL'
    );
  });
});
