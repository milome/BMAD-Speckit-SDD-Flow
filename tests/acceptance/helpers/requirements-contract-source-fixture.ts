import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

type MarkdownCell = string | number | null;

interface MarkdownTable {
  heading: string;
  columns: string[];
  rows: MarkdownCell[][];
}

export interface SourceAuthorityProjectionDescriptor {
  seedHash: string;
  title: string;
  language: string;
  sourcePath: string;
  requirement: {
    sourceId: string;
    mustId: string;
    text: string;
    rationale: string;
  };
  outOfScope: Array<{
    id: string;
    text: string;
    boundary: string;
  }>;
  negatives: Array<{
    id: string;
    text: string;
    negativeAssertion: string;
    blocksCompletionWhen: string;
    acceptanceId: string;
    commandId: string;
    traceId: string;
    testPath: string;
    targetPath: string;
    pathId: string;
  }>;
  failure: {
    id: string;
    condition: string;
    behavior: string;
  };
  primary: {
    acceptanceId: string;
    validationCommandId: string;
    commandId: string;
    endToEndId: string;
    traceId: string;
    pathId: string;
    testPath: string;
    targetPath: string;
    owner: string;
    oracle: string;
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

export interface SourceAuthorityProjectionOptions {
  negativeCount?: number;
  firstNegativeTargetPath?: string;
  sourcePath?: string;
}

export interface SourceAuthorityProjectionRenderOptions {
  omitFailureMatrix?: boolean;
}

export interface StaleImplementationConfirmationDescriptor {
  recordId: string;
  requirementSetId: string;
  mustId: string;
  text: string;
}

function fixtureIdentity(seed: string): {
  digest: string;
  token: string;
  upperToken: string;
  baseOrdinal: number;
} {
  const normalized = seed.trim();
  if (!normalized) throw new Error('source fixture seed must be non-empty');
  const digest = createHash('sha256').update(normalized, 'utf8').digest('hex');
  const token = digest.slice(0, 12);
  return {
    digest,
    token,
    upperToken: token.toUpperCase(),
    baseOrdinal: (Number.parseInt(digest.slice(0, 8), 16) % 400) + 100,
  };
}

function ref(prefix: string, ordinal: number): string {
  return `${prefix}-${String(ordinal).padStart(3, '0')}`;
}

function markdownCell(value: MarkdownCell): string {
  if (value === null) return 'none';
  return String(value).replace(/\r?\n/gu, ' ').replace(/\|/gu, '\\|').trim();
}

function renderTable(table: MarkdownTable): string {
  const header = `| ${table.columns.join(' | ')} |`;
  const separator = `| ${table.columns.map(() => '---').join(' | ')} |`;
  const rows = table.rows.map((row) => `| ${row.map(markdownCell).join(' | ')} |`);
  return [`## ${table.heading}`, '', header, separator, ...rows].join('\n');
}

export function createSourceAuthorityProjectionDescriptor(
  seed: string,
  options: SourceAuthorityProjectionOptions = {}
): SourceAuthorityProjectionDescriptor {
  const identity = fixtureIdentity(seed);
  const negativeCount = options.negativeCount ?? 15;
  if (!Number.isInteger(negativeCount) || negativeCount < 1 || negativeCount > 50) {
    throw new Error('source fixture negativeCount must be an integer from 1 through 50');
  }
  const { baseOrdinal, digest, token, upperToken } = identity;
  const capturedSecond = String(Number.parseInt(digest.slice(12, 14), 16) % 60).padStart(2, '0');
  const targetPath = `src/authority-fixtures/a-${token}.ts`;
  const testPath = `tests/acceptance/a-${token}.test.ts`;
  const primaryPathId = ref('PATH', baseOrdinal);
  const negatives = Array.from({ length: negativeCount }, (_item, index) => {
    const requirementOrdinal = baseOrdinal + index + 1;
    const closureOrdinal = baseOrdinal + 100 + index;
    const usesDedicatedTarget = index === 0 && Boolean(options.firstNegativeTargetPath);
    return {
      id: ref('NEG', requirementOrdinal),
      text: `Shortcut ${index + 1} does not count as completion.`,
      negativeAssertion: `Shortcut ${index + 1} must remain forbidden.`,
      blocksCompletionWhen: `Shortcut ${index + 1} is not rejected.`,
      acceptanceId: ref('ACC', closureOrdinal),
      commandId: ref('CMD', closureOrdinal),
      traceId: ref('TRACE', closureOrdinal),
      testPath: `tests/acceptance/a-${token}-n${String(index + 1).padStart(3, '0')}.test.ts`,
      targetPath: usesDedicatedTarget ? String(options.firstNegativeTargetPath) : targetPath,
      pathId: usesDedicatedTarget ? ref('PATH', closureOrdinal) : primaryPathId,
    };
  });

  return {
    seedHash: `sha256:${digest}`,
    title: `Source Authority Projection ${upperToken}`,
    language: 'en-US',
    sourcePath: options.sourcePath ?? `docs/requirements/authority-${token}.md`,
    requirement: {
      sourceId: ref('FR', baseOrdinal),
      mustId: ref('MUST-FR', baseOrdinal),
      text: 'The component must preserve source-authorized behavior.',
      rationale: 'Prevent semantic drift.',
    },
    outOfScope: [
      {
        id: ref('OUT', baseOrdinal),
        text: 'Rewriting unrelated engines is out of scope.',
        boundary: 'Keep unrelated engines unchanged.',
      },
      {
        id: ref('OUT', baseOrdinal + 1),
        text: 'Changing unrelated package definitions is out of scope.',
        boundary: 'Keep unrelated package definitions unchanged.',
      },
    ],
    negatives,
    failure: {
      id: ref('FAIL', baseOrdinal),
      condition: 'A forbidden authority shortcut is attempted.',
      behavior: 'Reject the shortcut and preserve the last source-authorized state.',
    },
    primary: {
      acceptanceId: ref('ACC', baseOrdinal),
      validationCommandId: ref('CMD', baseOrdinal + 500),
      commandId: ref('CMD', baseOrdinal),
      endToEndId: ref('E2E', baseOrdinal),
      traceId: ref('TRACE', baseOrdinal),
      pathId: primaryPathId,
      testPath,
      targetPath,
      owner: `authority-${token}-owner`,
      oracle: `Authority ${token} behavior remains source-authorized.`,
    },
    execution: {
      sessionId: `SESSION-${upperToken}`,
      turnId: `TURN-${upperToken}`,
      messageId: `MESSAGE-${upperToken}`,
      actorIdentityClass: 'test_fixture',
      branch: `fixture-${token}`,
      capturedAt: `2026-01-01T00:00:${capturedSecond}.000Z`,
      implementationAttemptId: `IMPL-ATTEMPT-${upperToken}`,
    },
  };
}

function projectionTables(descriptor: SourceAuthorityProjectionDescriptor): MarkdownTable[] {
  const { failure, negatives, outOfScope, primary, requirement } = descriptor;
  const negativeIds = negatives.map((row) => row.id);
  const allCovers = [requirement.mustId, ...negativeIds].join(' ');
  const validationCommand = `node scripts/lint-source.js --source ${descriptor.sourcePath}`;
  const deliveryCommand = `npx vitest run ${primary.testPath}`;
  const failureEvidence = [
    primary.acceptanceId,
    primary.endToEndId,
    ...negatives.map((row) => row.acceptanceId),
  ].join(' ');
  const pathRows = new Map<
    string,
    {
      pathId: string;
      targetPath: string;
      requirementRefs: string[];
      assertionRefs: string[];
      owner: string;
    }
  >();
  pathRows.set(primary.targetPath, {
    pathId: primary.pathId,
    targetPath: primary.targetPath,
    requirementRefs: [requirement.sourceId],
    assertionRefs: [
      primary.acceptanceId,
      primary.endToEndId,
      primary.validationCommandId,
      primary.commandId,
      primary.traceId,
    ],
    owner: primary.owner,
  });
  for (const negative of negatives) {
    const existing = pathRows.get(negative.targetPath);
    if (existing) {
      existing.requirementRefs.push(negative.id);
      existing.assertionRefs.push(negative.acceptanceId, negative.commandId, negative.traceId);
      continue;
    }
    pathRows.set(negative.targetPath, {
      pathId: negative.pathId,
      targetPath: negative.targetPath,
      requirementRefs: [negative.id],
      assertionRefs: [negative.acceptanceId, negative.commandId, negative.traceId],
      owner: `${primary.owner}-negative`,
    });
  }

  return [
    {
      heading: 'Functional Requirements',
      columns: ['ID', 'Requirement', 'Source rationale', 'Acceptance link'],
      rows: [
        [
          requirement.sourceId,
          requirement.text,
          requirement.rationale,
          `${primary.acceptanceId} ${primary.endToEndId}`,
        ],
      ],
    },
    {
      heading: 'Out Of Scope',
      columns: ['ID', 'Forbidden scope', 'Boundary assertion', 'Evidence'],
      rows: outOfScope.map((row) => [row.id, row.text, row.boundary, primary.acceptanceId]),
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
      rows: negatives.map((row) => [
        row.id,
        row.text,
        row.negativeAssertion,
        row.blocksCompletionWhen,
        failure.id,
        `${row.acceptanceId} ${row.commandId}`,
      ]),
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
          failure.id,
          failure.condition,
          failure.behavior,
          negativeIds.join(' '),
          failureEvidence,
          requirement.mustId,
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
          primary.acceptanceId,
          'Authority projection acceptance',
          requirement.sourceId,
          `${deliveryCommand}; artifact ${primary.testPath}`,
          primary.oracle,
          `${primary.commandId} ${primary.traceId}; ${primary.testPath}`,
          `${primary.pathId} owns remediation.`,
        ],
        ...negatives.map((row) => [
          row.acceptanceId,
          `${row.id} independent acceptance`,
          row.id,
          `artifact ${row.testPath}`,
          row.negativeAssertion,
          `${row.commandId} ${row.traceId}; ${row.testPath}`,
          `${row.pathId} owns remediation.`,
        ]),
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
          primary.endToEndId,
          'e2e',
          allCovers,
          deliveryCommand,
          'Exit code 0.',
          primary.oracle,
          `${primary.acceptanceId} ${primary.commandId} ${primary.traceId}`,
          `${primary.pathId} owns remediation.`,
          `${primary.testPath} ${primary.targetPath}`,
        ],
        [
          primary.validationCommandId,
          'contract-validation',
          'source structure only; no MUST coverage',
          validationCommand,
          'Source structure passes.',
          'Source structure remains parseable.',
          primary.traceId,
          `${primary.pathId} owns remediation.`,
          descriptor.sourcePath,
        ],
        [
          primary.commandId,
          'delivery-evidence',
          requirement.mustId,
          deliveryCommand,
          'Exit code 0.',
          primary.oracle,
          `${primary.acceptanceId} ${primary.endToEndId} ${primary.traceId}`,
          `${primary.pathId} owns remediation.`,
          `${primary.testPath} ${primary.targetPath}`,
        ],
        ...negatives.map((row) => [
          row.commandId,
          'delivery-evidence',
          row.id,
          `python -m pytest -q "${row.testPath}"`,
          'Exit code 0.',
          row.negativeAssertion,
          `${row.acceptanceId} ${row.traceId}`,
          `${row.pathId} owns remediation.`,
          `${row.testPath} ${row.targetPath}`,
        ]),
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
          primary.traceId,
          requirement.mustId,
          primary.acceptanceId,
          `${primary.acceptanceId} ${primary.endToEndId}`,
          primary.validationCommandId,
          primary.commandId,
          'none',
          primary.pathId,
          outOfScope[0]?.id ?? 'none',
          primary.oracle,
          `${requirement.mustId} closes through ${primary.acceptanceId}.`,
          `${primary.pathId} owns remediation.`,
        ],
        ...negatives.map((row) => [
          row.traceId,
          row.id,
          row.acceptanceId,
          `${row.acceptanceId} ${primary.endToEndId}`,
          primary.validationCommandId,
          row.commandId,
          'none',
          row.pathId,
          'none',
          row.negativeAssertion,
          `${row.id} closes through ${row.acceptanceId}.`,
          `${row.pathId} owns remediation.`,
        ]),
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
      rows: Array.from(pathRows.values(), (row) => [
        row.pathId,
        `\`${row.targetPath}\``,
        row.owner,
        'Preserve source-authorized behavior and reject forbidden shortcuts.',
        row.requirementRefs.join(' '),
        primary.oracle,
        row.assertionRefs.join(' '),
        `${row.owner} owns remediation.`,
      ]),
    },
  ];
}

export function renderSourceAuthorityProjection(
  descriptor: SourceAuthorityProjectionDescriptor,
  options: SourceAuthorityProjectionRenderOptions = {}
): string {
  const tables = projectionTables(descriptor).filter(
    (table) => !options.omitFailureMatrix || table.heading !== 'Failure Matrix'
  );
  return [
    `# ${descriptor.title}`,
    '',
    ...tables.flatMap((table) => [renderTable(table), '']),
  ].join('\n');
}

function writeFixtureFile(root: string, relativePath: string, content: string): string {
  const target = path.join(root, relativePath);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, content, 'utf8');
  return target;
}

function fixtureModulePath(testPath: string, targetPath: string): string {
  const relative = path
    .relative(path.dirname(testPath), targetPath)
    .replace(/\\/gu, '/')
    .replace(/\.[cm]?[jt]sx?$/u, '');
  return relative.startsWith('.') ? relative : `./${relative}`;
}

function renderFixtureTest(exportName: string, testPath: string, targetPath: string): string {
  return [
    `import { describe, expect, it } from 'vitest';`,
    `import { ${exportName} } from '${fixtureModulePath(testPath, targetPath)}';`,
    '',
    `describe('${exportName}', () => {`,
    `  it('exposes the descriptor-owned target', () => {`,
    `    expect(${exportName}).toBe(true);`,
    '  });',
    '});',
    '',
  ].join('\n');
}

export function writeSourceAuthorityProjection(
  root: string,
  descriptor: SourceAuthorityProjectionDescriptor,
  renderOptions: SourceAuthorityProjectionRenderOptions = {}
): {
  sourcePath: string;
  authoringOptions: {
    confirmationLanguage: string;
    sessionId: string;
    sessionTurnId: string;
    sessionMessageId: string;
    sessionActorIdentityClass: string;
    sessionBranch: string;
    sessionCapturedAt: string;
    implementationAttemptId: string;
  };
} {
  const token = descriptor.seedHash.slice('sha256:'.length, 19);
  const targetPaths = new Set([
    descriptor.primary.targetPath,
    ...descriptor.negatives.map((row) => row.targetPath),
  ]);
  for (const [index, targetPath] of Array.from(targetPaths).entries()) {
    const exportName = `authorityFixture${token}${index}`;
    writeFixtureFile(root, targetPath, `export const ${exportName} = true;\n`);
  }
  const targetExports = new Map(
    Array.from(targetPaths).map((targetPath, index) => [
      targetPath,
      `authorityFixture${token}${index}`,
    ])
  );
  writeFixtureFile(
    root,
    descriptor.primary.testPath,
    renderFixtureTest(
      String(targetExports.get(descriptor.primary.targetPath)),
      descriptor.primary.testPath,
      descriptor.primary.targetPath
    )
  );
  for (const negative of descriptor.negatives) {
    writeFixtureFile(
      root,
      negative.testPath,
      renderFixtureTest(
        String(targetExports.get(negative.targetPath)),
        negative.testPath,
        negative.targetPath
      )
    );
  }
  return {
    sourcePath: writeFixtureFile(
      root,
      descriptor.sourcePath,
      renderSourceAuthorityProjection(descriptor, renderOptions)
    ),
    authoringOptions: {
      confirmationLanguage: descriptor.language,
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

export function createStaleImplementationConfirmationDescriptor(
  seed: string
): StaleImplementationConfirmationDescriptor {
  const { baseOrdinal, token, upperToken } = fixtureIdentity(seed);
  return {
    recordId: `REQ-STALE-${upperToken}`,
    requirementSetId: `REQ-STALE-${upperToken}-SET`,
    mustId: ref('MUST-FR', baseOrdinal),
    text: `Stale contract ${token} must be replaced by the current authoring transaction.`,
  };
}

export function renderStaleImplementationConfirmation(
  descriptor: StaleImplementationConfirmationDescriptor
): string {
  return [
    'implementationConfirmation:',
    '  status: draft',
    `  recordId: ${descriptor.recordId}`,
    `  requirementSetId: ${descriptor.requirementSetId}`,
    '  must:',
    `    - id: ${descriptor.mustId}`,
    `      text: ${descriptor.text}`,
  ].join('\n');
}
