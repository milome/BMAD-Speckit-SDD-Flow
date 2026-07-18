const HASH = `sha256:${'7'.repeat(64)}`;

function proof() {
  return {
    sourceSpanRefs: ['SRC-CHECKOUT-001'],
    sourceHashes: [HASH],
    semanticResolutionReceiptRefs: ['RESOLUTION-CHECKOUT-001'],
    repositoryRefs: ['REPOSITORY-CHECKOUT-001'],
    policyApplicabilityReceiptRefs: ['POLICY-CHECKOUT-001'],
    decisionReceiptRefs: [],
    requirementRefs: ['MUST-FR-001'],
    targetRefs: ['src/checkout.ts'],
    verificationBindings: {
      oracleRef: 'ORACLE-CHECKOUT-001',
      redTestRef: 'RED-CHECKOUT-001',
      commandRefs: ['CMD-CHECKOUT-001'],
      evidenceRefs: ['EVD-CHECKOUT-001'],
    },
    semanticModelHash: HASH,
  };
}

export function sequenceCompilerFixture(stepCount = 2) {
  return {
    projectKind: 'consumer_product' as const,
    projectProfileHash: HASH,
    semanticModelHash: HASH,
    integrationBoundaries: [],
    sequenceScenarios: [
      {
        id: 'SCN-CHECKOUT-001',
        owningSystem: 'checkout',
        requirementRefs: ['MUST-FR-001'],
        trigger: {
          actorRef: 'ACTOR-CUSTOMER',
          event: 'customer_submits_checkout',
          sourceRefs: ['SRC-CHECKOUT-001'],
        },
        participants: [
          {
            id: 'ACTOR-CUSTOMER',
            kind: 'human_actor' as const,
            label: 'Customer',
            owningSystem: 'checkout',
            ...proof(),
          },
          {
            id: 'COMPONENT-CHECKOUT',
            kind: 'runtime_component' as const,
            label: 'Checkout Service',
            owningSystem: 'checkout',
            ...proof(),
          },
        ],
        steps: Array.from({ length: stepCount }, (_, index) => ({
          id: `MSG-${String(index + 1).padStart(3, '0')}`,
          order: index + 1,
          type: index % 2 === 0 ? ('command' as const) : ('response' as const),
          from: index % 2 === 0 ? 'ACTOR-CUSTOMER' : 'COMPONENT-CHECKOUT',
          to: index % 2 === 0 ? 'COMPONENT-CHECKOUT' : 'ACTOR-CUSTOMER',
          operation: `checkout_step_${index + 1}`,
          owningSystem: 'checkout',
          integrationBoundaryRef: null,
          ...proof(),
        })),
        branches: [],
        orderingConstraints: [],
        temporalConstraints: [],
        stateTransitions: [],
      },
    ],
  };
}
