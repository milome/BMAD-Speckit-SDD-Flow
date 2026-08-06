const { createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');

const subordinatePath = path.resolve(
  __dirname,
  'fixtures/bounded-code-reviewer-component-design.md'
);
const primaryPath = path.resolve(
  __dirname,
  'fixtures/2026-07-25-judge-role-separation-implementation-task-list.md'
);
const kernelPlanPath = path.resolve(
  __dirname,
  'fixtures/2026-07-28-canonical-intent-control-plane-kernel-implementation-plan.md'
);

function parseAuthorityDocuments(sourceText) {
  const fencedDocuments = [
    ...sourceText.matchAll(/```yaml\s*\r?\n([\s\S]*?)\r?\n```/gu),
  ].map((match) => match[1]);
  const documents =
    fencedDocuments.length > 0 ? fencedDocuments : [sourceText];
  return documents
    .map((document) => yaml.load(document))
    .filter((document) => document && typeof document === 'object');
}

function authorityFixture(sourceText) {
  const fixture = parseAuthorityDocuments(sourceText).find(
    (document) =>
      document.sourceCompositionPolicy &&
      Array.isArray(
        document.sourceCompositionPolicy.requiredSubordinateBindings
      )
  );
  if (!fixture) {
    throw new Error('normative composite authority fixture missing');
  }
  return fixture;
}

function extractRequiredSubordinateBinding(sourceText, sourceArtifactId) {
  const binding =
    authorityFixture(sourceText).sourceCompositionPolicy.requiredSubordinateBindings.find(
      (candidate) => candidate.sourceArtifactId === sourceArtifactId
    );
  if (!binding) {
    throw new Error(`subordinate binding missing for ${sourceArtifactId}`);
  }
  return {
    role: binding.role,
    namespace: binding.namespace,
    sourceArtifactId: binding.sourceArtifactId,
    parentTaskRefs: [...binding.parentTaskRefs],
    requiredRequirementIds: [...binding.requiredRequirementIds],
    requiredTaskIds: [...binding.requiredTaskIds],
  };
}

function canonicalArtifactId(filePath) {
  return path
    .basename(filePath, path.extname(filePath))
    .replace(/^\d{4}-\d{2}-\d{2}-/u, '');
}

function sha256(bytes) {
  return `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
}

function reconciledGraphFixture(parentTaskRef, { reverse = false } = {}) {
  const taskIds = [parentTaskRef, 'secondary-task'];
  const commandKinds = [
    'direct',
    'impacted',
    'integration',
    'regression',
  ];
  const commandRecord = (taskId, kind) => {
    const id = `command-${taskId}-${kind}`;
    const literal = `node -e "process.stdout.write('${taskId}:${kind}')"`;
    return {
      id,
      literal,
      commandTextHash: sha256(Buffer.from(literal, 'utf8')),
      workingDirectory: '.',
      shell: 'host_shell',
      runtime: 'node',
      sourceBinding: {
        sourcePlanPath: 'docs/plans/primary-authority.md',
        lineStart: 1,
        lineEnd: 1,
        textHash: sha256(
          Buffer.from(`${taskId}:${kind}`, 'utf8')
        ),
        specSpanRefs: [],
      },
    };
  };
  const graph = {
    schemaVersion: 'goal-contract-reconciled-graph-input/v2',
    sourceObligations: taskIds.map((taskId) => ({
      id: `source-${taskId}`,
      applicabilityState: 'applicable',
      summary: `${taskId} source`,
    })),
    tasks: taskIds.map((taskId) => ({
      id: taskId,
      title: `${taskId} implementation`,
      sourceIds: [`source-${taskId}`],
    })),
    traceSlices: taskIds.map((taskId) => ({
      id: `slice-${taskId}`,
      goalIds: [taskId],
      sourceIds: [`source-${taskId}`],
      acceptanceIds: [`accept-${taskId}`],
      evidenceIds: [`evidence-${taskId}`],
      productionSymbols: [`entry-${taskId}`],
      allowedPaths: [`src/${taskId}.ts`],
      dependencies: [],
      directCommands: [`command-${taskId}-direct`],
      impactedCommands: [`command-${taskId}-impacted`],
      integrationCommands: [`command-${taskId}-integration`],
      regressionCommands: [`command-${taskId}-regression`],
      closeCondition: `${taskId} is observable`,
    })),
    commands: Object.fromEntries(
      commandKinds.map((kind) => [
        kind,
        taskIds.map((taskId) => commandRecord(taskId, kind)),
      ])
    ),
    dependencies: [],
    acceptanceItems: taskIds.map((taskId) => ({
      id: `accept-${taskId}`,
      traceIds: [`slice-${taskId}`],
      goalIds: [taskId],
      sourceIds: [`source-${taskId}`],
      passCondition: `${taskId} passes`,
      expectedEvidenceIds: [`evidence-${taskId}`],
    })),
    expectedEvidence: taskIds.map((taskId) => ({
      id: `evidence-${taskId}`,
      producerTaskIds: [taskId],
      admissibleTypes: ['behavior'],
      freshnessRule: 'current source roots',
    })),
    productionEntryPoints: taskIds.map(
      (taskId) => `entry-${taskId}`
    ),
  };
  if (reverse) {
    for (const field of [
      'sourceObligations',
      'tasks',
      'traceSlices',
      'acceptanceItems',
      'expectedEvidence',
      'productionEntryPoints',
    ]) {
      graph[field].reverse();
    }
  }
  return graph;
}

function readFixtureMetadata() {
  const subordinateText = fs.readFileSync(subordinatePath, 'utf8');
  const primaryText = fs.readFileSync(primaryPath, 'utf8');
  const kernelPlanText = fs.readFileSync(kernelPlanPath, 'utf8');
  const sourceArtifactId = canonicalArtifactId(subordinatePath);
  const primarySourceArtifactId = canonicalArtifactId(primaryPath);
  const fixture = authorityFixture(kernelPlanText);
  const requiredSubordinateBinding = extractRequiredSubordinateBinding(
    kernelPlanText,
    sourceArtifactId
  );
  const primarySource = fixture.CompositeSourceAuthorityBundle?.primarySource;
  if (primarySource?.sourceArtifactId !== primarySourceArtifactId) {
    throw new Error(
      `primary source binding missing for ${primarySourceArtifactId}`
    );
  }
  return {
    subordinatePath,
    primaryPath,
    kernelPlanPath,
    subordinateText,
    primaryText,
    kernelPlanText,
    namespace: requiredSubordinateBinding.namespace,
    primaryNamespace: primarySource.namespace,
    sourceArtifactId,
    primarySourceArtifactId,
    requirementIds: [...requiredSubordinateBinding.requiredRequirementIds],
    taskIds: [...requiredSubordinateBinding.requiredTaskIds],
    parentTaskRefs: [...requiredSubordinateBinding.parentTaskRefs],
    requiredSubordinateBinding,
  };
}

function subordinateBinding(overrides = {}) {
  const fixture = readFixtureMetadata();
  return {
    ...fixture.requiredSubordinateBinding,
    ...overrides,
  };
}

function authorityRecord(
  mode,
  requiredSubordinateBindings = [],
  hashControlPlaneValue
) {
  const fixture = readFixtureMetadata();
  const canonicalBindings = requiredSubordinateBindings
    .map((binding) => ({
      ...binding,
      parentTaskRefs: [...binding.parentTaskRefs].sort(),
      requiredRequirementIds: [...binding.requiredRequirementIds].sort(),
      requiredTaskIds: [...binding.requiredTaskIds].sort(),
    }))
    .sort((left, right) =>
      `${left.role}|${left.namespace}|${left.sourceArtifactId}`.localeCompare(
        `${right.role}|${right.namespace}|${right.sourceArtifactId}`,
        'en'
      )
    );
  return {
    authorityKind: 'deterministic_source_authority_adapter',
    authoritySourceId: `${fixture.primarySourceArtifactId}-source-authority`,
    declaredMode: mode,
    requiredSubordinateBindings: canonicalBindings,
    declaredRequiredBindingsHash: hashControlPlaneValue(
      canonicalBindings
    ),
    authorityEvidenceHash: hashControlPlaneValue({
      authoritySourceId:
        `${fixture.primarySourceArtifactId}-source-authority`,
      mode,
      requiredSubordinateBindings: canonicalBindings,
    }),
  };
}

module.exports = {
  authorityRecord,
  extractRequiredSubordinateBinding,
  kernelPlanPath,
  primaryPath,
  readFixtureMetadata,
  reconciledGraphFixture,
  subordinateBinding,
  subordinatePath,
};
