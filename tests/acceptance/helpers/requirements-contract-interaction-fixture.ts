import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { ProductionSemanticSourceRoot } from '../../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-production-semantic-pipeline';

export interface InteractionFixtureSeed {
  token: string;
  ordinal: number;
  actorLabel: string;
  componentLabel: string;
  owningSystem: string;
  targetExportName: string;
  commandOperation: string;
  resultOperation: string;
  branchCondition: string;
  correlationKey: string;
  deadlineMs?: number;
  duplicatePolicy?: string;
  orderingPolicy?: string;
}

export interface InteractionFixtureDescriptor {
  paths: {
    sourceFileName: string;
    targetPath: string;
    testPath: string;
  };
  refs: {
    recordId: string;
    requirementSetId: string;
    journeyId: string;
    sourceRequirementId: string;
    mustRequirementId: string;
    nonFunctionalSourceRequirementId: string;
    nonFunctionalMustRequirementId: string;
    negativeRequirementId: string;
    outOfScopeId: string;
    actorParticipantId: string;
    componentParticipantId: string;
    commandStepId: string;
    resultStepId: string;
    branchId: string;
    orderingId: string;
    temporalId: string;
    branchTestId: string;
    orderingOracleId: string;
    orderingTestId: string;
    temporalOracleId: string;
    temporalTestId: string;
    failureId: string;
    acceptanceId: string;
    commandId: string;
    e2eId: string;
    requirementTraceId: string;
    nonFunctionalTraceId: string;
    negativeTraceId: string;
    implementationPathId: string;
  };
  semantics: {
    title: string;
    actorLabel: string;
    componentLabel: string;
    owningSystem: string;
    targetExportName: string;
    commandOperation: string;
    resultOperation: string;
    branchCondition: string;
    correlationKey: string;
    orderingReason: string;
    nonFunctionalRequirement: string;
    outOfScope: string;
  };
  timing: {
    deadlineMs: number;
    eventualConsistencyWindowMs: null;
    duplicatePolicy: string;
    orderingPolicy: string;
  };
  execution: {
    sessionId: string;
    turnId: string;
    messageId: string;
    actorIdentityClass: string;
    branch: string;
    capturedAt: string;
    implementationAttemptId: string;
  };
}

type MarkdownCell = string | number | null;

interface MarkdownTable {
  heading: string;
  columns: string[];
  rows: MarkdownCell[][];
}

function fixtureOrdinal(value: number): string {
  return String(value).padStart(3, '0');
}

function fixtureToken(value: string, transform: 'upper' | 'lower'): string {
  const normalized = value
    .trim()
    .replace(/[^A-Za-z0-9]+/gu, '-')
    .replace(/^-|-$/gu, '');
  if (!normalized) throw new Error('interaction fixture token must be non-empty');
  return transform === 'upper' ? normalized.toUpperCase() : normalized.toLowerCase();
}

export function createInteractionFixtureDescriptor(
  seed: InteractionFixtureSeed
): InteractionFixtureDescriptor {
  const upper = fixtureToken(seed.token, 'upper');
  const lower = fixtureToken(seed.token, 'lower');
  const ordinal = fixtureOrdinal(seed.ordinal);
  const nextOrdinal = fixtureOrdinal(seed.ordinal + 1);
  const secondNextOrdinal = fixtureOrdinal(seed.ordinal + 2);
  const capturedSecond = String(seed.ordinal % 60).padStart(2, '0');
  return {
    paths: {
      sourceFileName: `interaction-${lower}.md`,
      targetPath: `src/${lower}-semantic-target.ts`,
      testPath: `tests/${lower}-semantic-target.test.ts`,
    },
    refs: {
      recordId: `REQ-INTERACTION-${upper}`,
      requirementSetId: `interaction-${lower}-set`,
      journeyId: `UJ-${ordinal}`,
      sourceRequirementId: `FR-${ordinal}`,
      mustRequirementId: `MUST-FR-${ordinal}`,
      nonFunctionalSourceRequirementId: `NFR-${nextOrdinal}`,
      nonFunctionalMustRequirementId: `MUST-NFR-${nextOrdinal}`,
      negativeRequirementId: `NEG-${ordinal}`,
      outOfScopeId: `OUT-${ordinal}`,
      actorParticipantId: `PARTICIPANT-${upper}-ACTOR`,
      componentParticipantId: `COMPONENT-${upper}-TARGET`,
      commandStepId: `MSG-${ordinal}`,
      resultStepId: `MSG-${nextOrdinal}`,
      branchId: `BR-${ordinal}`,
      orderingId: `ORD-${ordinal}`,
      temporalId: `TMP-${ordinal}`,
      branchTestId: `RED-BR-${ordinal}`,
      orderingOracleId: `ORC-ORD-${ordinal}`,
      orderingTestId: `RED-ORD-${ordinal}`,
      temporalOracleId: `ORC-TMP-${ordinal}`,
      temporalTestId: `RED-TMP-${ordinal}`,
      failureId: `FAIL-${ordinal}`,
      acceptanceId: `ACC-${ordinal}`,
      commandId: `CMD-${ordinal}`,
      e2eId: `E2E-${ordinal}`,
      requirementTraceId: `TRACE-${ordinal}`,
      nonFunctionalTraceId: `TRACE-${nextOrdinal}`,
      negativeTraceId: `TRACE-${secondNextOrdinal}`,
      implementationPathId: `PATH-${ordinal}`,
    },
    semantics: {
      title: `${seed.componentLabel} Interaction Source`,
      actorLabel: seed.actorLabel,
      componentLabel: seed.componentLabel,
      owningSystem: seed.owningSystem,
      targetExportName: seed.targetExportName,
      commandOperation: seed.commandOperation,
      resultOperation: seed.resultOperation,
      branchCondition: seed.branchCondition,
      correlationKey: seed.correlationKey,
      orderingReason: `${seed.commandOperation} completes before ${seed.resultOperation}.`,
      nonFunctionalRequirement: `${seed.componentLabel} must reject duplicate or stale ${seed.resultOperation} publication before changing observable state.`,
      outOfScope: `Changing unrelated ${seed.owningSystem} components is out of scope.`,
    },
    timing: {
      deadlineMs: seed.deadlineMs ?? 1000,
      eventualConsistencyWindowMs: null,
      duplicatePolicy: seed.duplicatePolicy ?? 'forbid',
      orderingPolicy: seed.orderingPolicy ?? `per_${lower}_key`,
    },
    execution: {
      sessionId: `SESSION-${upper}`,
      turnId: `TURN-${upper}`,
      messageId: `MESSAGE-${upper}`,
      actorIdentityClass: 'test_fixture',
      branch: `fixture-${lower}`,
      capturedAt: `2026-01-01T00:00:${capturedSecond}.000Z`,
      implementationAttemptId: `IMPL-ATTEMPT-${upper}`,
    },
  };
}

function markdownCell(value: MarkdownCell): string {
  if (value === null) return 'none';
  return String(value).replace(/\r?\n/gu, ' ').replace(/\|/gu, '\\|').trim();
}

function renderMarkdownTable(table: MarkdownTable): string {
  const header = `| ${table.columns.join(' | ')} |`;
  const separator = `| ${table.columns.map(() => '---').join(' | ')} |`;
  const rows = table.rows.map((row) => `| ${row.map(markdownCell).join(' | ')} |`);
  return [`## ${table.heading}`, '', header, separator, ...rows].join('\n');
}

function interactionSourceTables(
  descriptor: InteractionFixtureDescriptor,
  command: string
): MarkdownTable[] {
  const { paths, refs, semantics, timing } = descriptor;
  const mustCovers = `${refs.mustRequirementId} ${refs.nonFunctionalMustRequirementId}`;
  const covers = `${mustCovers} ${refs.negativeRequirementId}`;
  const evidenceRefs = `${refs.acceptanceId} ${refs.e2eId}`;
  const traceRefs = `${refs.requirementTraceId} ${refs.nonFunctionalTraceId} ${refs.negativeTraceId}`;
  const targetFiles = `${paths.testPath} ${paths.targetPath}`;
  const sourceRequirementRefs = `${refs.sourceRequirementId} ${refs.nonFunctionalSourceRequirementId}`;
  return [
    {
      heading: 'User Journeys',
      columns: ['ID', 'Actor', 'Trigger', 'Required flow', 'Completion state'],
      rows: [
        [
          refs.journeyId,
          semantics.actorLabel,
          `A request reaches ${semantics.componentLabel}.`,
          semantics.orderingReason,
          `${semantics.resultOperation} is visible.`,
        ],
      ],
    },
    {
      heading: 'Functional Requirements',
      columns: ['ID', 'Requirement', 'Acceptance link'],
      rows: [
        [
          refs.sourceRequirementId,
          `${semantics.componentLabel} must execute ${semantics.commandOperation} before ${semantics.resultOperation}.`,
          `${refs.acceptanceId} ${refs.e2eId}`,
        ],
      ],
    },
    {
      heading: 'Non-Functional Requirements',
      columns: ['ID', 'Requirement', 'Acceptance link'],
      rows: [
        [
          refs.nonFunctionalSourceRequirementId,
          semantics.nonFunctionalRequirement,
          `${refs.acceptanceId} ${refs.e2eId}`,
        ],
      ],
    },
    {
      heading: 'Sequence Participants',
      columns: ['ID', 'Kind', 'Label', 'Owning system', 'Requirement refs'],
      rows: [
        [
          refs.actorParticipantId,
          'human_actor',
          semantics.actorLabel,
          semantics.owningSystem,
          sourceRequirementRefs,
        ],
        [
          refs.componentParticipantId,
          'runtime_component',
          semantics.componentLabel,
          semantics.owningSystem,
          sourceRequirementRefs,
        ],
      ],
    },
    {
      heading: 'Sequence Steps',
      columns: [
        'ID',
        'Order',
        'Type',
        'From',
        'To',
        'Operation',
        'Owning system',
        'Integration boundary ref',
        'Requirement refs',
      ],
      rows: [
        [
          refs.commandStepId,
          1,
          'command',
          refs.actorParticipantId,
          refs.componentParticipantId,
          semantics.commandOperation,
          semantics.owningSystem,
          null,
          sourceRequirementRefs,
        ],
        [
          refs.resultStepId,
          2,
          'user_visible_result',
          refs.componentParticipantId,
          refs.actorParticipantId,
          semantics.resultOperation,
          semantics.owningSystem,
          null,
          sourceRequirementRefs,
        ],
      ],
    },
    {
      heading: 'Sequence Branches',
      columns: ['ID', 'Condition', 'Test scenario refs', 'Owning system', 'Requirement refs'],
      rows: [
        [
          refs.branchId,
          semantics.branchCondition,
          refs.branchTestId,
          semantics.owningSystem,
          sourceRequirementRefs,
        ],
      ],
    },
    {
      heading: 'Sequence Ordering Constraints',
      columns: [
        'ID',
        'Before',
        'After',
        'Reason',
        'Oracle ref',
        'Test refs',
        'Owning system',
        'Requirement refs',
      ],
      rows: [
        [
          refs.orderingId,
          refs.commandStepId,
          refs.resultStepId,
          semantics.orderingReason,
          refs.orderingOracleId,
          refs.orderingTestId,
          semantics.owningSystem,
          sourceRequirementRefs,
        ],
      ],
    },
    {
      heading: 'Sequence Temporal Constraints',
      columns: [
        'ID',
        'Step ref',
        'Correlation key',
        'Deadline ms',
        'Eventual consistency window ms',
        'Duplicate policy',
        'Ordering policy',
        'Oracle ref',
        'Test refs',
        'Owning system',
        'Requirement refs',
      ],
      rows: [
        [
          refs.temporalId,
          refs.resultStepId,
          semantics.correlationKey,
          timing.deadlineMs,
          timing.eventualConsistencyWindowMs,
          timing.duplicatePolicy,
          timing.orderingPolicy,
          refs.temporalOracleId,
          refs.temporalTestId,
          semantics.owningSystem,
          sourceRequirementRefs,
        ],
      ],
    },
    {
      heading: 'Out Of Scope',
      columns: ['ID', 'Forbidden scope', 'Boundary assertion', 'Evidence'],
      rows: [
        [
          refs.outOfScopeId,
          semantics.outOfScope,
          `Preserve unrelated ${semantics.owningSystem} behavior.`,
          refs.acceptanceId,
        ],
      ],
    },
    {
      heading: 'Negative Requirements And Not Done Conditions',
      columns: [
        'ID',
        'Not-done condition',
        'Negative assertion',
        'Blocks completion when',
        'Failure refs',
        'Evidence refs',
      ],
      rows: [
        [
          refs.negativeRequirementId,
          `${semantics.resultOperation} must not precede ${semantics.commandOperation}.`,
          'Early result publication is forbidden.',
          `${refs.resultStepId} is observed before ${refs.commandStepId}.`,
          refs.failureId,
          evidenceRefs,
        ],
      ],
    },
    {
      heading: 'Failure Matrix',
      columns: [
        'ID',
        'Failure condition',
        'Required system behavior',
        'Negative requirement refs',
        'Evidence',
        'Requirement refs',
      ],
      rows: [
        [
          refs.failureId,
          `${semantics.commandOperation} cannot complete.`,
          `Keep ${semantics.resultOperation} unpublished and expose a recoverable failure.`,
          refs.negativeRequirementId,
          evidenceRefs,
          mustCovers,
        ],
      ],
    },
    {
      heading: 'Acceptance Evidence',
      columns: [
        'ID',
        'Evidence target',
        'Covers',
        'Required evidence',
        'Oracle',
        'Assertion source',
        'Responsibility mapping',
      ],
      rows: [
        [
          refs.acceptanceId,
          'Interaction ordering',
          covers,
          command,
          `${refs.commandStepId} is observed before ${refs.resultStepId}.`,
          `${refs.commandId} ${traceRefs}`,
          `${refs.implementationPathId} owns remediation.`,
        ],
      ],
    },
    {
      heading: 'Test And Verification Paths',
      columns: [
        'ID',
        'Type',
        'Covers',
        'Command or evidence path',
        'Completion rule',
        'Per-MUST oracle',
        'Assertion source',
        'Responsibility mapping',
        'Target files',
      ],
      rows: [
        [
          refs.commandId,
          'delivery-evidence',
          covers,
          command,
          'Exit code 0.',
          `${semantics.commandOperation} precedes ${semantics.resultOperation}.`,
          `${refs.acceptanceId} ${refs.e2eId} ${traceRefs}`,
          `${refs.implementationPathId} owns remediation.`,
          targetFiles,
        ],
        [
          refs.e2eId,
          'e2e',
          covers,
          command,
          'Exit code 0.',
          'The source-authorized interaction completes or fails closed.',
          `${refs.acceptanceId} ${refs.commandId} ${traceRefs}`,
          `${refs.implementationPathId} owns remediation.`,
          targetFiles,
        ],
      ],
    },
    {
      heading: 'Trace Matrix Source',
      columns: [
        'ID',
        'Covers',
        'Evidence refs',
        'Acceptance refs',
        'Contract validation command refs',
        'Delivery evidence command refs',
        'View refs',
        'Artifact refs',
        'Boundary refs',
        'Per-MUST oracle',
        'Per-MUST closure assertion',
        'Responsibility mapping',
      ],
      rows: [
        [
          refs.requirementTraceId,
          refs.mustRequirementId,
          refs.acceptanceId,
          `${refs.acceptanceId} ${refs.e2eId}`,
          refs.commandId,
          refs.commandId,
          refs.journeyId,
          refs.implementationPathId,
          refs.outOfScopeId,
          `${refs.commandStepId} is observed before ${refs.resultStepId}.`,
          `${refs.mustRequirementId} closes through the explicit interaction rows.`,
          `${refs.implementationPathId} owns remediation.`,
        ],
        [
          refs.nonFunctionalTraceId,
          refs.nonFunctionalMustRequirementId,
          refs.acceptanceId,
          `${refs.acceptanceId} ${refs.e2eId}`,
          refs.commandId,
          refs.commandId,
          refs.journeyId,
          refs.implementationPathId,
          refs.outOfScopeId,
          semantics.nonFunctionalRequirement,
          `${refs.nonFunctionalMustRequirementId} closes through the fail-closed interaction controls.`,
          `${refs.implementationPathId} owns remediation.`,
        ],
        [
          refs.negativeTraceId,
          refs.negativeRequirementId,
          refs.acceptanceId,
          `${refs.acceptanceId} ${refs.e2eId}`,
          refs.commandId,
          refs.commandId,
          refs.journeyId,
          refs.implementationPathId,
          'none',
          'Early result publication is rejected.',
          `${refs.negativeRequirementId} closes through the ordering negative control.`,
          `${refs.implementationPathId} owns remediation.`,
        ],
      ],
    },
    {
      heading: 'Implementation Path Map',
      columns: [
        'ID',
        'Repository path',
        'Ownership',
        'Required change',
        'Requirement refs',
        'Per-MUST oracle',
        'Assertion source',
        'Responsibility mapping',
      ],
      rows: [
        [
          refs.implementationPathId,
          `\`${paths.targetPath}\``,
          `${semantics.componentLabel} owner`,
          'Preserve the source-authorized interaction order.',
          covers,
          `${refs.acceptanceId} passes.`,
          `${refs.acceptanceId} ${refs.commandId} ${traceRefs}`,
          `${semantics.componentLabel} owner owns remediation.`,
        ],
      ],
    },
  ];
}

function relativeModulePath(fromFile: string, toFile: string): string {
  const relative = path
    .relative(path.dirname(fromFile), toFile)
    .replace(/\\/gu, '/')
    .replace(/\.[cm]?[jt]sx?$/u, '');
  return relative.startsWith('.') ? relative : `./${relative}`;
}

export function renderInteractionSourcePrd(
  descriptor: InteractionFixtureDescriptor,
  command: string
): string {
  return [
    `# ${descriptor.semantics.title}`,
    '',
    ...interactionSourceTables(descriptor, command).flatMap((table) => [
      renderMarkdownTable(table),
      '',
    ]),
  ].join('\n');
}

export function writeProductionInteractionSource(
  root: string,
  descriptor: InteractionFixtureDescriptor
): {
  sourcePath: string;
  targetPath: string;
  testPath: string;
  command: string;
  authoringOptions: {
    sessionId: string;
    sessionTurnId: string;
    sessionMessageId: string;
    sessionActorIdentityClass: string;
    sessionBranch: string;
    sessionCapturedAt: string;
    implementationAttemptId: string;
  };
} {
  const sourcePath = path.join(root, 'docs', 'requirements', descriptor.paths.sourceFileName);
  const targetFile = path.join(root, descriptor.paths.targetPath);
  const testFile = path.join(root, descriptor.paths.testPath);
  const command = `npx vitest run ${descriptor.paths.testPath}`;
  mkdirSync(path.dirname(sourcePath), { recursive: true });
  mkdirSync(path.dirname(targetFile), { recursive: true });
  mkdirSync(path.dirname(testFile), { recursive: true });
  writeFileSync(
    targetFile,
    `export const ${descriptor.semantics.targetExportName} = true;\n`,
    'utf8'
  );
  writeFileSync(
    testFile,
    `import { ${descriptor.semantics.targetExportName} } from '${relativeModulePath(testFile, targetFile)}';\nvoid ${descriptor.semantics.targetExportName};\n`,
    'utf8'
  );
  writeFileSync(sourcePath, renderInteractionSourcePrd(descriptor, command), 'utf8');
  return {
    sourcePath,
    targetPath: descriptor.paths.targetPath,
    testPath: descriptor.paths.testPath,
    command,
    authoringOptions: {
      sessionId: descriptor.execution.sessionId,
      sessionTurnId: descriptor.execution.turnId,
      sessionMessageId: descriptor.execution.messageId,
      sessionActorIdentityClass: descriptor.execution.actorIdentityClass,
      sessionBranch: descriptor.execution.branch,
      sessionCapturedAt: descriptor.execution.capturedAt,
      implementationAttemptId: descriptor.execution.implementationAttemptId,
    },
  };
}

export function createInteractionSourceRoot(
  descriptor: InteractionFixtureDescriptor,
  sourceRootId: string,
  rootClass: string,
  bodySchemaVersion: string,
  semanticBody: Record<string, unknown>,
  nodeType: ProductionSemanticSourceRoot['nodeType'] = 'scenario'
): ProductionSemanticSourceRoot {
  const sourceContent = JSON.stringify(semanticBody);
  return {
    sourceRootId,
    rootClass,
    nodeType,
    bodySchemaVersion,
    semanticBody,
    sourcePath: `docs/requirements/${descriptor.refs.requirementSetId}/${sourceRootId.toLowerCase()}.json`,
    sourceContent,
    sourceSpan: { startLine: 1, endLine: 1 },
    authorityClass: 'source_extracted',
    relatedRequirementRefs: [
      descriptor.refs.mustRequirementId,
      descriptor.refs.nonFunctionalMustRequirementId,
    ],
  };
}

export function buildInteractionSourceRoots(
  descriptor: InteractionFixtureDescriptor
): ProductionSemanticSourceRoot[] {
  const { refs, semantics, timing } = descriptor;
  const requirementRefs = [refs.mustRequirementId, refs.nonFunctionalMustRequirementId];
  return [
    createInteractionSourceRoot(
      descriptor,
      refs.actorParticipantId,
      'sequence_participant',
      'requirements-contract-sequence-participant-root/v1',
      {
        id: refs.actorParticipantId,
        kind: 'human_actor',
        label: semantics.actorLabel,
        owningSystem: semantics.owningSystem,
        requirementRefs,
      }
    ),
    createInteractionSourceRoot(
      descriptor,
      refs.componentParticipantId,
      'sequence_participant',
      'requirements-contract-sequence-participant-root/v1',
      {
        id: refs.componentParticipantId,
        kind: 'runtime_component',
        label: semantics.componentLabel,
        owningSystem: semantics.owningSystem,
        requirementRefs,
      }
    ),
    createInteractionSourceRoot(
      descriptor,
      refs.commandStepId,
      'sequence_step',
      'requirements-contract-sequence-step-root/v1',
      {
        id: refs.commandStepId,
        order: 1,
        type: 'command',
        from: refs.actorParticipantId,
        to: refs.componentParticipantId,
        operation: semantics.commandOperation,
        owningSystem: semantics.owningSystem,
        integrationBoundaryRef: null,
        requirementRefs,
      },
      'sequence_step'
    ),
    createInteractionSourceRoot(
      descriptor,
      refs.resultStepId,
      'sequence_step',
      'requirements-contract-sequence-step-root/v1',
      {
        id: refs.resultStepId,
        order: 2,
        type: 'user_visible_result',
        from: refs.componentParticipantId,
        to: refs.actorParticipantId,
        operation: semantics.resultOperation,
        owningSystem: semantics.owningSystem,
        integrationBoundaryRef: null,
        requirementRefs,
      },
      'sequence_step'
    ),
    createInteractionSourceRoot(
      descriptor,
      refs.branchId,
      'sequence_branch',
      'requirements-contract-sequence-branch-root/v1',
      {
        id: refs.branchId,
        condition: semantics.branchCondition,
        testScenarioRefs: [refs.branchTestId],
        owningSystem: semantics.owningSystem,
        requirementRefs,
      }
    ),
    createInteractionSourceRoot(
      descriptor,
      refs.orderingId,
      'sequence_ordering',
      'requirements-contract-sequence-ordering-root/v1',
      {
        id: refs.orderingId,
        before: refs.commandStepId,
        after: refs.resultStepId,
        reason: semantics.orderingReason,
        oracleRef: refs.orderingOracleId,
        testRefs: [refs.orderingTestId],
        owningSystem: semantics.owningSystem,
        requirementRefs,
      }
    ),
    createInteractionSourceRoot(
      descriptor,
      refs.temporalId,
      'sequence_temporal',
      'requirements-contract-sequence-temporal-root/v1',
      {
        id: refs.temporalId,
        stepRef: refs.resultStepId,
        correlationKey: semantics.correlationKey,
        deadlineMs: timing.deadlineMs,
        eventualConsistencyWindowMs: timing.eventualConsistencyWindowMs,
        duplicatePolicy: timing.duplicatePolicy,
        orderingPolicy: timing.orderingPolicy,
        oracleRef: refs.temporalOracleId,
        testRefs: [refs.temporalTestId],
        owningSystem: semantics.owningSystem,
        requirementRefs,
      }
    ),
  ];
}
