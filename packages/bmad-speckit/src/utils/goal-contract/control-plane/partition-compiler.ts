const { createHash } = require('node:crypto');
const path = require('node:path');

export type GoalContractPartitionCompilerModule = never;

type CanonicalIntentRecord = {
  intentRecordId: string;
  semanticOwnershipKey: string;
};

type SubordinateSourceDescriptor = {
  sourceArtifactId: string;
  parentTaskRefs: unknown[];
};

type SubordinateObligation = {
  intentRecordId: string;
  declaredSourceId: string;
  semanticOwnershipKey: string;
  namespace: string;
  sourceArtifactId: string;
  sourceSnapshotHash: string;
  sourceRole: string;
  parentTaskRefs: string[];
  specSpanRefs: string[];
};

type SubordinateCoverageReceipt = {
  sourceArtifactId: string;
  receiptHash: string;
};

type SpecSpanAuthority = {
  specSpanId: string;
  sourceArtifactId: string;
  namespace: string;
  sourceSnapshotHash: string;
};

type PartitionCompileRequest = {
  sourceCompositionPolicy?: unknown;
  orderedSourceSnapshotSet?: unknown;
  compositeSourceAuthorityBundle?: unknown;
  canonicalIntentBundle?: unknown;
  goalContractBundle?: unknown;
  subordinateCoverageReceipts?: unknown;
  sourceSnapshot?: {
    aggregateHash?: string;
    sourcePath?: string;
    sourceId?: string;
  };
  sourceObligationGraph?: {
    specSpanRegistryHash?: string;
    [key: string]: unknown;
  };
  methodologyProfile?: {
    methodologyProfileHash?: string;
  };
  partitionPolicyBinding?: unknown;
  reconciledGraph?: unknown;
  reconciliationReceiptHash?: string;
  sequenceApplicabilityReceipt?: unknown;
  sequenceConstraintInput?: unknown;
  sequenceExecutionState?: unknown;
  repositoryFacts?: unknown;
  [key: string]: unknown;
};

function modulePath(relativePath) {
  return `${relativePath}${__filename.endsWith('.ts') ? '.ts' : ''}`;
}

const { hashControlPlaneValue, stableControlPlaneStringify } = require(
  modulePath('./canonical-hash')
);
const { verifyCanonicalIntentBundle } = require(modulePath('./canonical-intent-compiler'));
const { verifyCompositeSourceAuthorityBundle } = require(
  modulePath('./composite-source-authority-bundle')
);
const { validateGoalContractSchema } = require(modulePath('./schema-registry'));
const { verifySourceCompositionPolicy } = require(modulePath('./source-composition-policy'));
const {
  verifyOrderedSourceSnapshotSet,
  verifySourceSnapshot,
} = require(modulePath('./source-snapshot'));
const { compileExecutionProjection } = require(modulePath('../execution-projection'));
const { hashSourceObligationGraph } = require(modulePath('../source-obligation-extractor'));
const { buildPartitionComponents } = require(modulePath('../partition-components'));
const { optimizePartitions } = require(modulePath('../partition-optimizer'));
const { assertCurrentPartitionPolicyBinding } = require(modulePath('../partition-policy'));
const { finalizePartitionManifest } = require(modulePath('../partition-manifest'));
const { createPendingChildCompilationReceipt } = require(modulePath('../partition-receipts'));
const { compilePartitionImpactGraph } = require(modulePath('./partition-impact-graph'));
const { compilePartitionClosureFeasibility } = require(
  modulePath('./partition-closure-feasibility')
);

const HASH_PATTERN = /^sha256:[0-9a-f]{64}$/u;
const TASK_ID_PATTERN =
  /^[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*-T\d+[A-Z]?$/u;
const TASK_FILE_SCOPE_FIELDS = new Set([
  'Files',
  'Create',
  'Modify',
  'Delete',
]);
const NO_PRODUCTION_FILES = 'No production files';
const EXECUTABLE_CHILD = 'executable_child';
const AGGREGATE_ONLY = 'aggregate_only';
const AGGREGATE_PHASE_ORDER = new Map([
  ['post_child_execution', 0],
  ['final_aggregate', 1],
]);
const COMMAND_KINDS = Object.freeze(['direct', 'impacted', 'integration', 'regression']);
const ALLOWED_REQUEST_FIELDS = new Set([
  'sourceCompositionPolicy',
  'orderedSourceSnapshotSet',
  'compositeSourceAuthorityBundle',
  'canonicalIntentBundle',
  'goalContractBundle',
  'subordinateCoverageReceipts',
  'methodologyProfile',
  'partitionPolicyBinding',
  'reconciledGraph',
  'reconciliationReceiptHash',
  'sequenceApplicabilityReceipt',
  'sequenceConstraintInput',
  'sequenceExecutionState',
  'repositoryFacts',
]);
const IMPACT_DRIFT_BASELINE_FIELDS = new Set([
  'repositoryTreeHash',
  'partitionPlanBasisHash',
  'partitionSetHash',
  'partitionImpactGraphHash',
  'partitionClosureFeasibilityReceiptHash',
]);
const PARTITION_IMPACT_ARTIFACT_PATHS = Object.freeze({
  partitionAnalysisReceiptPath:
    'receipts/partition-analysis.receipt.json',
  partitionImpactGraphPath:
    'receipts/partition-impact-graph.json',
  partitionClosureFeasibilityReceiptPath:
    'receipts/partition-closure-feasibility.receipt.json',
  partitionImpactDriftReceiptPath:
    'receipts/partition-impact-drift.receipt.json',
});

function failure(failureClass, extra = {}) {
  return Object.assign(new Error(failureClass), {
    failureClass,
    ...extra,
  });
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function compareIds(left, right) {
  const normalizedLeft = String(left);
  const normalizedRight = String(right);
  if (normalizedLeft < normalizedRight) return -1;
  if (normalizedLeft > normalizedRight) return 1;
  return 0;
}

function canonicalIdentifierList(values = []) {
  return [...new Set((values || []).filter(Boolean).map(String))].sort(compareIds);
}

function unique(values = []) {
  return canonicalIdentifierList(values);
}

function normalizeTaskFileScopePath(value) {
  const token = String(value || '').trim();
  const normalized = token.replace(/\\/gu, '/');
  if (
    token.length === 0 ||
    token !== value ||
    /\s/u.test(token) ||
    TASK_ID_PATTERN.test(token) ||
    /[*?[\]{}]/u.test(token) ||
    path.posix.isAbsolute(normalized) ||
    /^[A-Za-z]:\//u.test(normalized) ||
    normalized.startsWith('//') ||
    normalized === '.' ||
    normalized.split('/').some(
      (segment) => segment.length === 0 || segment === '.' || segment === '..'
    ) ||
    /[<>:"|]/u.test(normalized)
  ) {
    return null;
  }
  return path.posix.normalize(normalized);
}

function taskFileScopeReason(value) {
  const token = String(value ?? '');
  const normalized = token.replace(/\\/gu, '/');
  if (TASK_ID_PATTERN.test(token)) return 'task_id';
  if (/[*?[\]{}]/u.test(token)) return 'whole_repository_wildcard';
  if (
    path.posix.isAbsolute(normalized) ||
    /^[A-Za-z]:\//u.test(normalized) ||
    normalized.startsWith('//')
  ) {
    return 'absolute_path';
  }
  if (normalized.split('/').includes('..')) return 'path_escape';
  if (/\s/u.test(token)) return 'prose_directive';
  return 'invalid_path';
}

function throwTaskFileScopeInvalid({
  taskId,
  fieldName,
  offendingToken,
  reasonCode,
  sourceBinding,
}) {
  throw failure('task_file_scope_invalid', {
    errorCode: 'ER-GH-001',
    taskId,
    fieldName,
    offendingToken,
    reasonCode,
    ...(sourceBinding || {}),
  });
}

function validateTaskFileScopeCells({
  taskId,
  cells = [],
  declaredPathFamilies = [],
  declaredGeneratedSurfaceClasses = [],
} = {}) {
  const normalizedTaskId = String(taskId || '');
  const declaredClasses = new Set([
    ...unique(declaredPathFamilies),
    ...unique(declaredGeneratedSurfaceClasses),
  ]);
  const tokenCount = (cells || []).reduce(
    (count, cell) => count + (Array.isArray(cell?.tokens) ? cell.tokens.length : 0),
    0
  );
  const normalizedCells = (cells || []).map((cell) => {
    const fieldName = String(cell?.fieldName || '');
    const tokens = Array.isArray(cell?.tokens) ? cell.tokens : [];
    if (!TASK_FILE_SCOPE_FIELDS.has(fieldName) || tokens.length === 0) {
      throwTaskFileScopeInvalid({
        taskId: normalizedTaskId,
        fieldName,
        offendingToken: tokens[0] ?? null,
        reasonCode: 'field_invalid',
        sourceBinding: cell?.sourceBinding,
      });
    }
    const normalizedTokens = tokens.map((rawToken) => {
      const offendingToken = String(rawToken ?? '');
      if (offendingToken === NO_PRODUCTION_FILES) {
        if (tokenCount !== 1) {
          throwTaskFileScopeInvalid({
            taskId: normalizedTaskId,
            fieldName,
            offendingToken,
            reasonCode: 'no_production_files_mixed',
            sourceBinding: cell?.sourceBinding,
          });
        }
        return offendingToken;
      }
      if (declaredClasses.has(offendingToken)) {
        return offendingToken;
      }
      const normalizedPath = normalizeTaskFileScopePath(offendingToken);
      if (!normalizedPath) {
        throwTaskFileScopeInvalid({
          taskId: normalizedTaskId,
          fieldName,
          offendingToken,
          reasonCode: taskFileScopeReason(offendingToken),
          sourceBinding: cell?.sourceBinding,
        });
      }
      return normalizedPath;
    });
    return {
      fieldName,
      tokens: unique(normalizedTokens),
    };
  });
  return Object.freeze({
    decision: 'pass',
    taskId: normalizedTaskId,
    normalizedCells: Object.freeze(normalizedCells),
  });
}

function normalizeTaskFileScopeToken(value) {
  const trimmed = String(value || '').trim().replace(/[.。]\s*$/u, '');
  const quoted = /^`([^`\r\n]+)`$/u.exec(trimmed);
  return quoted ? quoted[1] : trimmed;
}

function canonicalTaskFileScopeField(value) {
  const normalized = String(value || '').toLowerCase();
  if (['files', '文件'].includes(normalized)) return 'Files';
  if (['create', 'add', '创建', '新增'].includes(normalized)) return 'Create';
  if (['modify', 'regenerate', '修改', '重新生成'].includes(normalized)) {
    return 'Modify';
  }
  if (['delete', '删除'].includes(normalized)) return 'Delete';
  return null;
}

function taskSourceSections(snapshotSet, taskId, allowedSourceRoles = null) {
  const escapedTaskId = String(taskId).replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
  const taskTokenPattern = new RegExp(
    `(?:^|\\s)${escapedTaskId}(?=[:：\\s]|$)`,
    'u'
  );
  const sections = [];
  for (const snapshot of snapshotSet.sourceSnapshots || []) {
    if (
      allowedSourceRoles &&
      !allowedSourceRoles.has(snapshot.sourceRole)
    ) {
      continue;
    }
    const lines = Buffer.from(
      snapshot.frozenBytesBase64,
      'base64'
    )
      .toString('utf8')
      .replace(/\r\n/gu, '\n')
      .replace(/\r/gu, '\n')
      .split('\n');
    for (let index = 0; index < lines.length; index += 1) {
      const heading = /^(#{1,6})\s+(.+)$/u.exec(lines[index]);
      if (!heading || !taskTokenPattern.test(heading[2])) continue;
      const headingLevel = heading[1].length;
      let endIndex = lines.length;
      for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
        const nextHeading = /^(#{1,6})\s+/u.exec(lines[cursor]);
        if (nextHeading && nextHeading[1].length <= headingLevel) {
          endIndex = cursor;
          break;
        }
      }
      sections.push({
        sourceArtifactId: snapshot.sourceArtifactId,
        sourceSnapshotHash: snapshot.sourceSnapshotHash,
        lineStart: index + 1,
        lines: lines.slice(index, endIndex),
      });
    }
  }
  return sections;
}

function taskFileScopeCellsFromSection(section) {
  const cells = [];
  let activeField = null;
  for (let offset = 1; offset < section.lines.length; offset += 1) {
    const rawLine = section.lines[offset];
    const trimmed = rawLine.trim();
    if (trimmed.length === 0) continue;
    const marker = /^\*{0,2}(Files|Create|Modify|Delete|文件|创建|修改|删除)\*{0,2}\s*[:：]?\s*$/iu.exec(
      trimmed
    );
    if (marker) {
      activeField = canonicalTaskFileScopeField(marker[1]);
      continue;
    }
    const bullet = /^(?:[-*]|\d+\.)\s+(?:\[[ xX]\]\s*)?(.*)$/u.exec(
      trimmed
    );
    if (!bullet) {
      activeField = null;
      continue;
    }
    const inline = /^\*{0,2}(Files|Create|Modify|Delete|Add|Regenerate|文件|创建|修改|新增|删除|重新生成)\*{0,2}(?:\s*[:：]\s*(.+)|\s+(`[^`\r\n]+`[.。]?))$/iu.exec(
      bullet[1]
    );
    const fieldName = inline
      ? canonicalTaskFileScopeField(inline[1])
      : activeField;
    if (!fieldName) continue;
    const offendingToken = normalizeTaskFileScopeToken(
      inline ? inline[2] || inline[3] : bullet[1]
    );
    cells.push({
      fieldName,
      tokens: [offendingToken],
      sourceBinding: {
        sourceArtifactId: section.sourceArtifactId,
        sourceSnapshotHash: section.sourceSnapshotHash,
        lineStart: section.lineStart + offset,
        lineEnd: section.lineStart + offset,
      },
    });
  }
  return cells;
}

function projectedTaskPaths(reconciledGraph) {
  const pathsByTaskId = new Map();
  for (const slice of reconciledGraph?.traceSlices || []) {
    const tokens = Array.isArray(slice?.allowedPaths)
      ? slice.allowedPaths.map((candidate) =>
          typeof candidate === 'string'
            ? candidate
            : candidate?.literal || candidate?.path || candidate?.id
        )
      : [];
    for (const taskId of unique(slice.taskIds || slice.goalIds)) {
      const current = pathsByTaskId.get(taskId) || [];
      pathsByTaskId.set(taskId, unique([...current, ...tokens]));
    }
  }
  return pathsByTaskId;
}

function resolveTaskSourceSnapshotSet({
  orderedSourceSnapshotSet,
  sourceSnapshot = null,
} = {}) {
  if (
    orderedSourceSnapshotSet?.schemaVersion ===
    'goal-contract-ordered-source-snapshot-set/v1'
  ) {
    return verifyOrderedSourceSnapshotSet(orderedSourceSnapshotSet);
  }
  return {
    orderedSourceSnapshotSetHash:
      orderedSourceSnapshotSet?.orderedSourceSnapshotSetHash,
    sourceSnapshots: [
      {
        ...verifySourceSnapshot(sourceSnapshot),
        sourceRole: 'primary_implementation_authority',
      },
    ],
  };
}

function compileTaskFileScopeAuthority({
  orderedSourceSnapshotSet,
  reconciledGraph,
  sourceSnapshot = null,
} = {}) {
  const snapshotSet = resolveTaskSourceSnapshotSet({
    orderedSourceSnapshotSet,
    sourceSnapshot,
  });
  const pathsByTaskId = projectedTaskPaths(reconciledGraph);
  const taskIds = unique([
    ...(reconciledGraph?.tasks || []).map((task) => task.id),
    ...pathsByTaskId.keys(),
  ]);
  const records = taskIds.map((taskId) => {
    const sections = taskSourceSections(snapshotSet, taskId);
    if (sections.length > 1) {
      throwTaskFileScopeInvalid({
        taskId,
        fieldName: 'Files',
        offendingToken: taskId,
        reasonCode: 'source_task_ambiguous',
      });
    }
    const sourceCells =
      sections.length === 1
        ? taskFileScopeCellsFromSection(sections[0])
        : [];
    const sourceValidation =
      sourceCells.length > 0
        ? validateTaskFileScopeCells({
            taskId,
            cells: sourceCells,
          })
        : null;
    const projectedPaths = pathsByTaskId.get(taskId) || [];
    if (projectedPaths.length > 0) {
      validateTaskFileScopeCells({
        taskId,
        cells: [{ fieldName: 'Files', tokens: projectedPaths }],
      });
    }
    if (sourceValidation) {
      const sourcePaths = unique(
        sourceValidation.normalizedCells
          .flatMap((cell) => cell.tokens)
          .filter((token) => token !== NO_PRODUCTION_FILES)
      );
      if (
        stableControlPlaneStringify(sourcePaths) !==
        stableControlPlaneStringify(unique(projectedPaths))
      ) {
        throwTaskFileScopeInvalid({
          taskId,
          fieldName: 'Files',
          offendingToken:
            projectedPaths.find((token) => !sourcePaths.includes(token)) ||
            sourcePaths.find((token) => !projectedPaths.includes(token)) ||
            taskId,
          reasonCode: 'projection_mismatch',
          sourceBinding: sourceCells[0]?.sourceBinding,
        });
      }
    }
    return {
      taskId,
      sourceBound: sourceValidation !== null,
      cells: sourceValidation?.normalizedCells || [],
      projectedPaths: unique(projectedPaths),
    };
  });
  const semanticAuthority = {
    schemaVersion: 'goal-contract-task-file-scope-authority/v1',
    orderedSourceSnapshotSetHash:
      snapshotSet.orderedSourceSnapshotSetHash,
    records,
  };
  return deepFreeze({
    ...semanticAuthority,
    taskFileScopeAuthorityHash:
      hashControlPlaneValue(semanticAuthority),
  });
}

function declarationValues(section, pattern) {
  return section.lines
    .map((line, offset) => ({
      line: line.trim(),
      lineNumber: section.lineStart + offset,
    }))
    .map(({ line, lineNumber }) => {
      const match = pattern.exec(line);
      return match
        ? {
            value: match[1].trim(),
            lineNumber,
          }
        : null;
    })
    .filter(Boolean);
}

function normalizeDeclarationToken(value) {
  const token = String(value || '').trim();
  const quoted = /^`([^`\r\n]+)`$/u.exec(token);
  return (quoted ? quoted[1] : token).trim();
}

function parseDeclaredCommandIds(value) {
  const backtickTokens = [...String(value || '').matchAll(/`([^`\r\n]+)`/gu)]
    .map((match) => match[1].trim())
    .filter(Boolean);
  const tokens =
    backtickTokens.length > 0
      ? backtickTokens
      : String(value || '')
          .split(/[,，]/u)
          .map((token) => token.trim())
          .filter(Boolean);
  return [...new Set(tokens)];
}

function sourceDeclaredDependencies(section) {
  const match = /\[Dependencies:\s*([^\]]+)\]/iu.exec(
    section.lines[0] || ''
  );
  if (!match) return [];
  const value = match[1].trim();
  if (/^none$/iu.test(value)) return [];
  return unique(
    value
      .split(/[,，]/u)
      .map(normalizeDeclarationToken)
      .filter(Boolean)
  );
}

function graphTaskDependencies(reconciledGraph, task) {
  const taskId = String(task?.id || task?.taskId || '');
  return unique([
    ...(task?.dependencies || task?.dependencyIds || []),
    ...(reconciledGraph?.dependencies || [])
      .filter(
        (dependency) =>
          String(dependency?.from || dependency?.taskId || '') === taskId
      )
      .map((dependency) => dependency?.to || dependency?.dependsOn),
  ]);
}

function recordTaskRefs(record) {
  return unique(record?.taskIds || record?.goalIds || []);
}

function recordSliceRefs(record) {
  return unique(record?.traceIds || record?.sliceIds || []);
}

function aggregateTaskProjection({
  taskId,
  section,
  phase,
  commandIds,
  task,
  reconciledGraph,
}) {
  const slices = (reconciledGraph?.traceSlices || []).filter((slice) =>
    recordTaskRefs(slice).includes(taskId)
  );
  const sliceIds = new Set(
    slices.map((slice) => String(slice.id || slice.sliceId || ''))
  );
  const acceptanceRecords = (reconciledGraph?.acceptanceItems || []).filter(
    (acceptance) =>
      recordTaskRefs(acceptance).includes(taskId) ||
      recordSliceRefs(acceptance).some((sliceId) => sliceIds.has(sliceId))
  );
  const evidenceIds = unique([
    ...slices.flatMap((slice) => slice.evidenceIds || []),
    ...acceptanceRecords.flatMap(
      (acceptance) => acceptance.expectedEvidenceIds || []
    ),
    ...(reconciledGraph?.expectedEvidence || [])
      .filter((evidence) =>
        unique([
          ...(evidence?.producerTaskIds || []),
          evidence?.producer,
        ]).includes(taskId)
      )
      .map((evidence) => evidence.id || evidence.evidenceContractId),
  ]);
  return {
    taskId,
    phase,
    dependencyTaskIds: unique([
      ...sourceDeclaredDependencies(section),
      ...graphTaskDependencies(reconciledGraph, task),
    ]),
    commandIds,
    sourceObligationIds: unique(
      slices.flatMap((slice) => slice.sourceIds || [])
    ),
    acceptanceIds: unique([
      ...slices.flatMap((slice) => slice.acceptanceIds || []),
      ...acceptanceRecords.map(
        (acceptance) => acceptance.id || acceptance.predicateId
      ),
    ]),
    evidenceIds,
  };
}

function compileTaskExecutionRoleAuthority({
  orderedSourceSnapshotSet,
  reconciledGraph,
  sourceSnapshot = null,
} = {}) {
  const snapshotSet = resolveTaskSourceSnapshotSet({
    orderedSourceSnapshotSet,
    sourceSnapshot,
  });
  const sourceRoles = new Set(['primary_implementation_authority']);
  const tasks = (reconciledGraph?.tasks || []).map((task, sourceOrder) => ({
    task,
    sourceOrder,
    taskId: String(task?.id || task?.taskId || ''),
  }));
  const records = tasks.map(({ task, sourceOrder, taskId }) => {
    const sections = taskSourceSections(snapshotSet, taskId, sourceRoles);
    if (sections.length > 1) {
      throw failure('partition_execution_class_ambiguous', {
        taskId,
        reason: 'source_task_ambiguous',
      });
    }
    const section = sections[0] || null;
    const executionClassDeclarations = section
      ? declarationValues(
          section,
          /^\*\*Execution Class:\*\*\s*(.+)$/iu
        )
      : [];
    return {
      task,
      taskId,
      sourceOrder,
      section,
      executionClassDeclarations,
    };
  });
  const explicit = records.some(
    ({ executionClassDeclarations }) =>
      executionClassDeclarations.length > 0
  );
  if (!explicit) {
    const aggregateValidation = {
      taskOrder: [],
      commandOrder: [],
      tasks: [],
    };
    const semanticAuthority = {
      schemaVersion:
        'goal-contract-task-execution-role-authority/v1',
      mode: 'legacy',
      executableTaskIds: records.map(({ taskId }) => taskId),
      aggregateTaskIds: [],
      aggregateValidation: {
        ...aggregateValidation,
        aggregateValidationHash:
          hashControlPlaneValue(aggregateValidation),
      },
    };
    return deepFreeze({
      ...semanticAuthority,
      taskExecutionRoleAuthorityHash:
        hashControlPlaneValue(semanticAuthority),
    });
  }

  const resolvedTaskFileScopeAuthority =
    compileTaskFileScopeAuthority({
      orderedSourceSnapshotSet,
      reconciledGraph,
      sourceSnapshot,
    });
  const fileScopeByTaskId = new Map(
    (resolvedTaskFileScopeAuthority.records || []).map((record) => [
      record.taskId,
      record,
    ])
  );
  const completeCommandAuthority = typedCommandAuthority(reconciledGraph);
  const aggregateTasks = [];
  const executableTaskIds = [];
  for (const record of records) {
    const {
      task,
      taskId,
      section,
      executionClassDeclarations,
    } = record;
    if (executionClassDeclarations.length === 0) {
      throw failure('partition_execution_class_missing', { taskId });
    }
    if (executionClassDeclarations.length !== 1) {
      throw failure('partition_execution_class_ambiguous', { taskId });
    }
    const executionClass = normalizeDeclarationToken(
      executionClassDeclarations[0].value
    );
    if (![EXECUTABLE_CHILD, AGGREGATE_ONLY].includes(executionClass)) {
      throw failure('partition_execution_class_invalid', {
        taskId,
        executionClass,
      });
    }
    if (executionClass === EXECUTABLE_CHILD) {
      executableTaskIds.push(taskId);
      continue;
    }
    const ownershipDeclarations = declarationValues(
      section,
      /^\*\*Owned Production Paths:\*\*\s*(.+)$/iu
    );
    if (
      ownershipDeclarations.length !== 1 ||
      normalizeDeclarationToken(
        ownershipDeclarations[0]?.value
      ).toLowerCase() !== 'none'
    ) {
      throw failure('partition_aggregate_ownership_invalid', {
        taskId,
      });
    }
    const fileScopeRecord = fileScopeByTaskId.get(taskId);
    const sourceFileScopeTokens = unique(
      (fileScopeRecord?.cells || []).flatMap((cell) => cell.tokens || [])
    );
    if (
      !fileScopeRecord?.sourceBound ||
      (fileScopeRecord.projectedPaths || []).length > 0 ||
      sourceFileScopeTokens.length === 0 ||
      sourceFileScopeTokens.some(
        (token) => token !== NO_PRODUCTION_FILES
      )
    ) {
      throw failure('partition_aggregate_ownership_invalid', {
        taskId,
      });
    }
    const phaseDeclarations = declarationValues(
      section,
      /^\*\*Aggregate Gate Phase:\*\*\s*(.+)$/iu
    );
    const phase = normalizeDeclarationToken(
      phaseDeclarations[0]?.value
    );
    if (
      phaseDeclarations.length !== 1 ||
      !AGGREGATE_PHASE_ORDER.has(phase)
    ) {
      throw failure('partition_aggregate_phase_invalid', {
        taskId,
        phase,
      });
    }
    const commandDeclarations = declarationValues(
      section,
      /^\*\*Aggregate Validation Commands:\*\*\s*(.+)$/iu
    );
    const commandIds =
      commandDeclarations.length === 1
        ? parseDeclaredCommandIds(commandDeclarations[0].value)
        : [];
    if (commandDeclarations.length !== 1 || commandIds.length === 0) {
      throw failure('partition_aggregate_command_missing', {
        taskId,
      });
    }
    const taskScopedCommandIds = [
      ...new Set(
        (reconciledGraph?.traceSlices || [])
          .filter((slice) => recordTaskRefs(slice).includes(taskId))
          .flatMap((slice) =>
            COMMAND_KINDS.flatMap(
              (kind) => slice?.[`${kind}Commands`] || []
            )
          )
          .filter(Boolean)
          .map(String)
      ),
    ];
    const missingTypedCommandIds = commandIds.filter(
      (commandId) => !completeCommandAuthority.recordsById.has(commandId)
    );
    if (
      missingTypedCommandIds.length > 0 ||
      stableControlPlaneStringify(commandIds) !==
        stableControlPlaneStringify(taskScopedCommandIds)
    ) {
      throw failure(
        'partition_aggregate_command_authority_invalid',
        {
          taskId,
          declaredCommandIds: commandIds,
          taskScopedCommandIds,
          missingTypedCommandIds,
        }
      );
    }
    aggregateTasks.push(
      aggregateTaskProjection({
        taskId,
        section,
        phase,
        commandIds,
        task,
        reconciledGraph,
      })
    );
  }

  const knownTaskIds = new Set([
    ...executableTaskIds,
    ...aggregateTasks.map(({ taskId }) => taskId),
  ]);
  let previousPhase = -1;
  const completedTaskIds = new Set(executableTaskIds);
  for (const aggregateTask of aggregateTasks) {
    const phaseOrder = AGGREGATE_PHASE_ORDER.get(aggregateTask.phase);
    if (phaseOrder < previousPhase) {
      throw failure('partition_aggregate_order_invalid', {
        taskId: aggregateTask.taskId,
      });
    }
    previousPhase = phaseOrder;
    for (const dependencyTaskId of aggregateTask.dependencyTaskIds) {
      if (
        !knownTaskIds.has(dependencyTaskId) ||
        !completedTaskIds.has(dependencyTaskId)
      ) {
        throw failure('partition_aggregate_dependency_invalid', {
          taskId: aggregateTask.taskId,
          dependencyTaskId,
        });
      }
    }
    completedTaskIds.add(aggregateTask.taskId);
  }
  const aggregateValidationSemantic = {
    taskOrder: aggregateTasks.map(({ taskId }) => taskId),
    commandOrder: aggregateTasks.flatMap(
      ({ commandIds }) => commandIds
    ),
    tasks: aggregateTasks,
  };
  const semanticAuthority = {
    schemaVersion:
      'goal-contract-task-execution-role-authority/v1',
    mode: 'explicit',
    executableTaskIds: unique(executableTaskIds),
    aggregateTaskIds: aggregateTasks.map(({ taskId }) => taskId),
    aggregateValidation: {
      ...aggregateValidationSemantic,
      aggregateValidationHash:
        hashControlPlaneValue(aggregateValidationSemantic),
    },
  };
  return deepFreeze({
    ...semanticAuthority,
    taskExecutionRoleAuthorityHash:
      hashControlPlaneValue(semanticAuthority),
  });
}

function projectExecutableReconciledGraph(
  reconciledGraph,
  taskExecutionRoleAuthority
) {
  if (taskExecutionRoleAuthority.mode !== 'explicit') {
    return reconciledGraph;
  }
  const executableTaskIds = new Set(
    taskExecutionRoleAuthority.executableTaskIds
  );
  const aggregateTaskIds = new Set(
    taskExecutionRoleAuthority.aggregateTaskIds
  );
  const tasks = (reconciledGraph?.tasks || []).filter((task) =>
    executableTaskIds.has(String(task?.id || task?.taskId || ''))
  );
  for (const task of tasks) {
    const taskId = String(task?.id || task?.taskId || '');
    const aggregateDependency = graphTaskDependencies(
      reconciledGraph,
      task
    ).find((dependencyTaskId) =>
      aggregateTaskIds.has(dependencyTaskId)
    );
    if (aggregateDependency) {
      throw failure('partition_execution_role_dependency_invalid', {
        taskId,
        dependencyTaskId: aggregateDependency,
      });
    }
  }
  const traceSlices = [];
  for (const slice of reconciledGraph?.traceSlices || []) {
    const taskIds = recordTaskRefs(slice);
    const executableRefs = taskIds.filter((taskId) =>
      executableTaskIds.has(taskId)
    );
    const aggregateRefs = taskIds.filter((taskId) =>
      aggregateTaskIds.has(taskId)
    );
    if (executableRefs.length > 0 && aggregateRefs.length > 0) {
      throw failure('partition_execution_role_mixed_slice', {
        sliceId: slice.id || slice.sliceId || null,
        taskIds,
      });
    }
    if (executableRefs.length > 0) traceSlices.push(slice);
  }
  const executableSliceIds = new Set(
    traceSlices.map((slice) => String(slice.id || slice.sliceId || ''))
  );
  const executableSourceIds = new Set(
    traceSlices.flatMap((slice) =>
      (slice.sourceIds || []).map(String)
    )
  );
  const executableCommandIds = new Set(
    traceSlices.flatMap(commandReferences)
  );
  const acceptanceItems = (
    reconciledGraph?.acceptanceItems || []
  ).filter((acceptance) => {
    const taskRefs = recordTaskRefs(acceptance);
    const sliceRefs = recordSliceRefs(acceptance);
    const commandRefs = unique(
      acceptance?.requiredCommands || []
    );
    return (
      taskRefs.some((taskId) => executableTaskIds.has(taskId)) ||
      sliceRefs.some((sliceId) => executableSliceIds.has(sliceId)) ||
      commandRefs.some((commandId) =>
        executableCommandIds.has(commandId)
      )
    );
  });
  const executableEvidenceIds = new Set([
    ...traceSlices.flatMap((slice) => slice.evidenceIds || []),
    ...acceptanceItems.flatMap(
      (acceptance) => acceptance.expectedEvidenceIds || []
    ),
  ]);
  return {
    ...reconciledGraph,
    sourceObligations: (
      reconciledGraph?.sourceObligations || []
    ).filter((source) =>
      executableSourceIds.has(String(source?.id || ''))
    ),
    tasks: tasks.map((task) => ({
      ...task,
      dependencies: unique(task?.dependencies || []).filter(
        (taskId) => executableTaskIds.has(taskId)
      ),
      dependencyIds: unique(task?.dependencyIds || []).filter(
        (taskId) => executableTaskIds.has(taskId)
      ),
    })),
    traceSlices,
    dependencies: (reconciledGraph?.dependencies || []).filter(
      (dependency) =>
        executableTaskIds.has(
          String(dependency?.from || dependency?.taskId || '')
        ) &&
        executableTaskIds.has(
          String(dependency?.to || dependency?.dependsOn || '')
        )
    ),
    acceptanceItems,
    expectedEvidence: (
      reconciledGraph?.expectedEvidence || []
    ).filter((evidence) => {
      const evidenceId = String(
        evidence?.id || evidence?.evidenceContractId || ''
      );
      return (
        executableEvidenceIds.has(evidenceId) ||
        unique([
          ...(evidence?.producerTaskIds || []),
          evidence?.producer,
        ]).some((taskId) => executableTaskIds.has(taskId))
      );
    }),
  };
}

function validateExecutablePartitionReadiness({
  partitions = [],
  executableTaskIds = [],
  aggregateTaskIds = [],
} = {}) {
  const executableTasks = new Set(unique(executableTaskIds));
  const aggregateTasks = new Set(unique(aggregateTaskIds));
  const taskOwners = new Map();
  const pathOwners = new Map();
  for (const partition of partitions || []) {
    const partitionId = String(partition?.partitionId || '');
    const primaryTaskIds = unique(partition?.primaryTaskIds || []);
    const aggregateTaskId = primaryTaskIds.find((taskId) =>
      aggregateTasks.has(taskId)
    );
    if (aggregateTaskId) {
      throw failure('partition_readiness_aggregate_task_leak', {
        partitionId,
        taskId: aggregateTaskId,
      });
    }
    for (const taskId of primaryTaskIds) {
      if (!executableTasks.has(taskId)) {
        throw failure('partition_readiness_task_membership_invalid', {
          partitionId,
          taskId,
        });
      }
      const owners = taskOwners.get(taskId) || [];
      owners.push(partitionId);
      taskOwners.set(taskId, owners);
    }
    const ownedArtifactPaths = unique(
      partition?.ownedArtifactPaths || []
    );
    if (ownedArtifactPaths.length === 0) {
      throw failure('partition_readiness_empty_ownership', {
        partitionId,
      });
    }
    if (unique(partition?.commandIds || []).length === 0) {
      throw failure(
        'partition_readiness_required_command_missing',
        { partitionId }
      );
    }
    if (
      unique(
        partition?.completionPredicateIds ||
          partition?.acceptanceIds ||
          []
      ).length === 0
    ) {
      throw failure(
        'partition_readiness_atomic_commit_unprovable',
        { partitionId }
      );
    }
    for (const artifactPath of ownedArtifactPaths) {
      const owner = pathOwners.get(artifactPath);
      if (owner && owner !== partitionId) {
        throw failure(
          'partition_readiness_ownership_overlap',
          {
            path: artifactPath,
            partitionIds: [owner, partitionId].sort(compareIds),
          }
        );
      }
      pathOwners.set(artifactPath, partitionId);
    }
  }
  for (const taskId of executableTasks) {
    const owners = taskOwners.get(taskId) || [];
    if (owners.length !== 1) {
      throw failure(
        'partition_readiness_task_membership_invalid',
        { taskId, partitionIds: owners }
      );
    }
  }
  return Object.freeze({ decision: 'pass' });
}

function intersects(left = [], right = new Set<string>()) {
  return (left || []).some((value) => right.has(String(value)));
}

function sha256Text(value) {
  return `sha256:${createHash('sha256').update(String(value), 'utf8').digest('hex')}`;
}

function compilePartitionImpactDriftBaseline(input = {}) {
  if (!isRecord(input)) {
    throw failure('partition_impact_drift_input_invalid');
  }
  const forbiddenFields = Object.keys(input)
    .filter((field) => !IMPACT_DRIFT_BASELINE_FIELDS.has(field))
    .sort(compareIds);
  if (forbiddenFields.length > 0) {
    throw failure('partition_impact_drift_authority_injection', {
      forbiddenFields,
    });
  }
  const authority = Object.fromEntries(
    [...IMPACT_DRIFT_BASELINE_FIELDS].map((field) => [
      field,
      requireHash(input[field], field),
    ])
  );
  const driftBasis = {
    ...authority,
    changedArtifactIds: [],
    impactedPartitionIds: [],
  };
  const driftHash = hashControlPlaneValue(driftBasis);
  const semanticDecisionHash = hashControlPlaneValue({
    mode: 'generation_baseline',
    decision: 'baseline_frozen',
    driftHash,
  });
  const payload = {
    schemaVersion:
      'goal-contract-partition-impact-drift-receipt/v1',
    mode: 'generation_baseline',
    ...driftBasis,
    decision: 'baseline_frozen',
    driftHash,
    semanticDecisionHash,
  };
  const receipt = {
    ...payload,
    receiptHash: hashControlPlaneValue(payload),
  };
  try {
    validateGoalContractSchema(
      'goal-contract-partition-impact-drift-receipt.schema.json',
      receipt
    );
  } catch (error) {
    throw failure('partition_impact_drift_schema_invalid', {
      validationErrors: error.validationErrors || [],
    });
  }
  return deepFreeze(receipt);
}

function canonicalArtifactBytes(value) {
  return `${stableControlPlaneStringify(value)}\n`;
}

function compilePartitionImpactAuthority(input = {}) {
  if (
    !isRecord(input) ||
    !isRecord(input.partitionPlan) ||
    !isRecord(input.reconciledGraph)
  ) {
    throw failure('partition_impact_authority_input_invalid');
  }
  const impactGraph = compilePartitionImpactGraph({
    repositoryRoot: input.repositoryRoot,
    packageRoot: input.packageRoot,
    partitionPlan: input.partitionPlan,
    reconciledGraph: input.reconciledGraph,
  });
  const impactGraphBytes = canonicalArtifactBytes(impactGraph);
  const impactGraphDocumentHash = sha256Text(impactGraphBytes);
  const closureFeasibility =
    compilePartitionClosureFeasibility({
      partitionPlan: input.partitionPlan,
      impactGraph,
      packageRoot: input.packageRoot,
    });
  if (closureFeasibility.decision !== 'pass') {
    throw failure('partition_closure_feasibility_blocked', {
      blockingIssues: structuredClone(
        closureFeasibility.blockingIssues
      ),
      partitionClosureFeasibilityReceiptHash:
        closureFeasibility.receiptHash,
    });
  }
  const closureFeasibilityBytes =
    canonicalArtifactBytes(closureFeasibility);
  const closureFeasibilityDocumentHash = sha256Text(
    closureFeasibilityBytes
  );
  const impactDrift = compilePartitionImpactDriftBaseline({
    repositoryTreeHash: impactGraph.repositoryTreeHash,
    partitionPlanBasisHash:
      impactGraph.partitionPlanBasisHash,
    partitionSetHash: input.partitionPlan.partitionSetHash,
    partitionImpactGraphHash: impactGraph.impactGraphHash,
    partitionClosureFeasibilityReceiptHash:
      closureFeasibilityDocumentHash,
  });
  const impactDriftBytes = canonicalArtifactBytes(impactDrift);
  const impactDriftDocumentHash = sha256Text(impactDriftBytes);
  const feasibilityByPartitionId = new Map(
    closureFeasibility.partitionRecords.map((record) => [
      record.partitionId,
      record,
    ])
  );
  const projectFeasibility = (record) => {
    const feasibility = feasibilityByPartitionId.get(
      record.partitionId
    );
    if (!feasibility || feasibility.decision !== 'pass') {
      throw failure('partition_impact_coverage_incomplete', {
        partitionId: record.partitionId,
      });
    }
    return {
      ...record,
      partitionClosureFeasibilityHash:
        feasibility.partitionClosureFeasibilityHash,
      closureRelevantArtifactIds: [
        ...feasibility.closureRelevantArtifactIds,
      ],
      closureRelevantCommandIds: [
        ...feasibility.closureRelevantCommandIds,
      ],
    };
  };
  const {
    partitionPlanHash: _corePartitionPlanHash,
    ...coreSemanticPlan
  } = input.partitionPlan;
  const semanticPlan = {
    ...coreSemanticPlan,
    partitionPlanBasisHash:
      impactGraph.partitionPlanBasisHash,
    repositoryTreeHash: impactGraph.repositoryTreeHash,
    partitionImpactPolicyHash:
      impactGraph.partitionImpactPolicyHash,
    partitionImpactAnalyzerIdentityHash:
      impactGraph.analyzerIdentityHash,
    partitionImpactGraphPath:
      PARTITION_IMPACT_ARTIFACT_PATHS.partitionImpactGraphPath,
    partitionImpactGraphHash: impactGraph.impactGraphHash,
    partitionImpactGraphDocumentHash:
      impactGraphDocumentHash,
    partitionClosureFeasibilityReceiptPath:
      PARTITION_IMPACT_ARTIFACT_PATHS
        .partitionClosureFeasibilityReceiptPath,
    partitionClosureFeasibilityReceiptHash:
      closureFeasibilityDocumentHash,
    partitionClosureFeasibilityDecision:
      closureFeasibility.decision,
    partitionImpactDriftReceiptPath:
      PARTITION_IMPACT_ARTIFACT_PATHS
        .partitionImpactDriftReceiptPath,
    partitionImpactDriftReceiptHash:
      impactDriftDocumentHash,
    driftHash: impactDrift.driftHash,
    partitions: input.partitionPlan.partitions.map(
      projectFeasibility
    ),
    childProjectionInputs:
      input.partitionPlan.childProjectionInputs.map(
        projectFeasibility
      ),
  };
  const partitionPlan = {
    ...semanticPlan,
    partitionPlanHash: hashControlPlaneValue(semanticPlan),
  };
  validatePlanSchema(partitionPlan);
  return deepFreeze({
    schemaVersion:
      'goal-contract-partition-impact-authority/v1',
    artifactPaths: PARTITION_IMPACT_ARTIFACT_PATHS,
    partitionPlan,
    partitionPlanBytes: canonicalArtifactBytes(partitionPlan),
    partitionPlanHash: partitionPlan.partitionPlanHash,
    impactGraph,
    impactGraphBytes,
    impactGraphDocumentHash,
    closureFeasibility,
    closureFeasibilityBytes,
    closureFeasibilityDocumentHash,
    impactDrift,
    impactDriftBytes,
    impactDriftDocumentHash,
  });
}

function commandReferences(slice) {
  return unique(COMMAND_KINDS.flatMap((kind) => slice?.[`${kind}Commands`] || []));
}

function typedCommandAuthority(reconciledGraph) {
  const commands = isRecord(reconciledGraph?.commands) ? reconciledGraph.commands : {};
  const recordsById = new Map();
  for (const kind of COMMAND_KINDS) {
    const records = commands[kind] || [];
    if (!Array.isArray(records)) {
      throw failure('command_projection_type_leak', {
        commandKind: kind,
        reason: 'command_collection_not_array',
      });
    }
    for (const candidate of records) {
      if (!isRecord(candidate)) {
        throw failure('command_projection_type_leak', {
          commandKind: kind,
          reason: 'command_record_not_object',
        });
      }
      const commandId = typeof candidate.id === 'string' ? candidate.id.trim() : '';
      const literal = typeof candidate.literal === 'string' ? candidate.literal.trim() : '';
      const sourceBinding = isRecord(candidate.sourceBinding) ? candidate.sourceBinding : null;
      const specSpanRefs = sourceBinding?.specSpanRefs;
      const hasSourceDeclaration =
        typeof sourceBinding?.sourcePlanPath === 'string' &&
        sourceBinding.sourcePlanPath.length > 0 &&
        Number.isInteger(sourceBinding.lineStart) &&
        sourceBinding.lineStart > 0 &&
        Number.isInteger(sourceBinding.lineEnd) &&
        sourceBinding.lineEnd >= sourceBinding.lineStart &&
        HASH_PATTERN.test(String(sourceBinding.textHash || ''));
      const hasSpecSpanBinding =
        Array.isArray(specSpanRefs) &&
        specSpanRefs.length > 0 &&
        specSpanRefs.every(
          (specSpanRef) => typeof specSpanRef === 'string' && specSpanRef.length > 0
        );
      const missingFields = [
        ['id', commandId],
        ['literal', literal],
        ['commandTextHash', HASH_PATTERN.test(String(candidate.commandTextHash || ''))],
        [
          'workingDirectory',
          typeof candidate.workingDirectory === 'string' && candidate.workingDirectory.length > 0,
        ],
        ['shell', typeof candidate.shell === 'string' && candidate.shell.length > 0],
        ['runtime', typeof candidate.runtime === 'string' && candidate.runtime.length > 0],
        [
          'sourceBinding',
          Boolean(
            sourceBinding &&
            Array.isArray(specSpanRefs) &&
            (hasSourceDeclaration || hasSpecSpanBinding)
          ),
        ],
      ]
        .filter(([, present]) => !present)
        .map(([field]) => field);
      if (missingFields.length > 0) {
        throw failure('command_projection_type_leak', {
          commandId: commandId || null,
          commandKind: kind,
          missingFields,
        });
      }
      if (candidate.commandTextHash !== sha256Text(literal)) {
        throw failure('command_projection_command_hash_mismatch', {
          commandId,
          expectedHash: sha256Text(literal),
          actualHash: candidate.commandTextHash,
        });
      }
      const canonicalRecord = stableControlPlaneStringify(candidate);
      const existing = recordsById.get(commandId);
      if (existing && existing.canonicalRecord !== canonicalRecord) {
        throw failure('command_projection_duplicate_conflict', {
          commandId,
        });
      }
      recordsById.set(commandId, {
        canonicalRecord,
        record: candidate,
      });
    }
  }

  const referencedCommandIds = unique(
    (reconciledGraph?.traceSlices || []).flatMap(commandReferences)
  );
  for (const commandId of referencedCommandIds) {
    if (!recordsById.has(commandId)) {
      throw failure('command_projection_type_leak', {
        commandId,
        reason: 'typed_command_record_missing',
      });
    }
  }
  return {
    recordsById,
    referencedCommandIds,
  };
}

function requireHash(value, field) {
  if (!HASH_PATTERN.test(String(value || ''))) {
    throw failure('partition_authority_hash_invalid', { field, value });
  }
  return value;
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
    return value;
  }
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function canonicalizeSets(value) {
  if (Array.isArray(value)) {
    return value
      .map(canonicalizeSets)
      .sort((left, right) =>
        stableControlPlaneStringify(left).localeCompare(stableControlPlaneStringify(right), 'en')
      );
  }
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort(compareIds)
      .map((key) => [key, canonicalizeSets(value[key])])
  );
}

function canonicalGraphHash(graph) {
  return hashControlPlaneValue(canonicalizeSets(graph));
}

function authorityInjectionFields(request) {
  return Object.keys(request).filter((field) => !ALLOWED_REQUEST_FIELDS.has(field));
}

function assertNoAuthorityInjection(request) {
  if (!isRecord(request)) {
    throw failure('partition_compile_request_invalid');
  }
  const forbiddenFields = authorityInjectionFields(request).sort(compareIds);
  if (forbiddenFields.length > 0) {
    throw failure('partition_authority_injection', { forbiddenFields });
  }
}

function receiptPayloadHash(receipt) {
  if (!isRecord(receipt)) return null;
  const payload = { ...receipt };
  delete payload.receiptHash;
  return hashControlPlaneValue(payload);
}

function orderedSourceBindings(snapshotSet) {
  return snapshotSet.sourceSnapshots
    .map((snapshot) => ({
      sourceOrder: snapshot.sourceOrder,
      sourceArtifactId: snapshot.sourceArtifactId,
      sourceRole: snapshot.sourceRole,
      namespace: snapshot.namespace,
      sourceSnapshotHash: snapshot.sourceSnapshotHash,
    }))
    .sort(
      (left, right) =>
        left.sourceOrder - right.sourceOrder ||
        compareIds(left.sourceArtifactId, right.sourceArtifactId)
    );
}

function exactCoverageReceipts(goalContractBundle) {
  return [...(goalContractBundle.subordinateSourceCoverageReceipts || [])].sort((left, right) =>
    compareIds(left.receiptHash, right.receiptHash)
  );
}

function verifyCoverageReceipts(goalContractBundle, receipts) {
  if (!Array.isArray(receipts)) {
    throw failure('subordinate_coverage_incomplete');
  }
  for (const receipt of receipts) {
    if (
      !isRecord(receipt) ||
      !HASH_PATTERN.test(String(receipt.receiptHash || '')) ||
      receiptPayloadHash(receipt) !== receipt.receiptHash
    ) {
      throw failure('subordinate_source_stale');
    }
  }
  const expectedHashes = exactCoverageReceipts(goalContractBundle).map(
    ({ receiptHash }) => receiptHash
  );
  const actualHashes = receipts.map(({ receiptHash }) => receiptHash).sort(compareIds);
  if (stableControlPlaneStringify(expectedHashes) !== stableControlPlaneStringify(actualHashes)) {
    throw failure('subordinate_source_stale', {
      expectedReceiptHashes: expectedHashes,
      actualReceiptHashes: actualHashes,
    });
  }
  return receipts
    .map((receipt) => structuredClone(receipt))
    .sort((left, right) => compareIds(left.receiptHash, right.receiptHash));
}

function verifyGoalContractBundle(bundle, authority) {
  if (!isRecord(bundle) || bundle.schemaVersion !== 'goal-contract-bundle/v1') {
    throw failure('goal_contract_bundle_invalid');
  }
  const fields = [
    ['sourceCompositionPolicyHash', authority.policy.sourceCompositionPolicyHash],
    ['orderedSourceSnapshotSetHash', authority.snapshotSet.orderedSourceSnapshotSetHash],
    ['sourceAuthorityBundleHash', authority.sourceAuthorityBundle.sourceAuthorityBundleHash],
    ['canonicalIntentSemanticHash', authority.canonicalIntentBundle.canonicalIntentSemanticHash],
    ['canonicalIntentBundleHash', authority.canonicalIntentBundle.canonicalIntentBundleHash],
    ['authorityAttestationHash', authority.canonicalIntentBundle.authorityAttestationHash],
  ];
  for (const [field, expected] of fields) {
    requireHash(bundle[field], field);
    if (bundle[field] !== expected) {
      throw failure('source_composition_policy_mismatch', {
        field,
        expected,
        actual: bundle[field],
      });
    }
  }
  for (const field of ['goalContractSemanticHash', 'goalContractHash', 'markdownHash']) {
    requireHash(bundle[field], field);
  }
  if (!isRecord(bundle.goalContractSemanticModel)) {
    throw failure('goal_contract_bundle_invalid');
  }
  return bundle;
}

function verifyAuthority(request) {
  const rawPolicy = request.sourceCompositionPolicy;
  const rawAuthorityBundle = request.compositeSourceAuthorityBundle;
  if (
    rawPolicy?.mode === 'single_source' &&
    Array.isArray(rawAuthorityBundle?.subordinateSources) &&
    rawAuthorityBundle.subordinateSources.length > 0
  ) {
    throw failure('source_composition_downgrade_rejected');
  }
  const policy = verifySourceCompositionPolicy(rawPolicy);
  const snapshotSet = verifyOrderedSourceSnapshotSet(request.orderedSourceSnapshotSet);
  const sourceAuthorityBundle = verifyCompositeSourceAuthorityBundle(rawAuthorityBundle);
  const canonicalIntentBundle = verifyCanonicalIntentBundle(request.canonicalIntentBundle);
  if (
    policy.sourceCompositionPolicyHash !== sourceAuthorityBundle.sourceCompositionPolicyHash ||
    policy.sourceCompositionPolicyHash !== canonicalIntentBundle.sourceCompositionPolicyHash ||
    snapshotSet.orderedSourceSnapshotSetHash !==
      sourceAuthorityBundle.orderedSourceSnapshotSetHash ||
    snapshotSet.orderedSourceSnapshotSetHash !==
      canonicalIntentBundle.orderedSourceSnapshotSetHash ||
    sourceAuthorityBundle.sourceAuthorityBundleHash !==
      canonicalIntentBundle.sourceAuthorityBundleHash
  ) {
    throw failure('source_composition_policy_mismatch');
  }
  if (
    policy.mode === 'single_source' &&
    (sourceAuthorityBundle.subordinateSources.length > 0 ||
      snapshotSet.sourceSnapshots.length !== 1)
  ) {
    throw failure('source_composition_downgrade_rejected');
  }
  if (
    policy.mode === 'composite_required' &&
    sourceAuthorityBundle.subordinateSources.length === 0
  ) {
    throw failure('subordinate_source_missing');
  }
  const goalContractBundle = verifyGoalContractBundle(request.goalContractBundle, {
    policy,
    snapshotSet,
    sourceAuthorityBundle,
    canonicalIntentBundle,
  });
  const subordinateCoverageReceipts = verifyCoverageReceipts(
    goalContractBundle,
    request.subordinateCoverageReceipts
  );
  const methodologyProfile = request.methodologyProfile;
  requireHash(methodologyProfile?.methodologyProfileHash, 'methodologyProfileHash');
  if (!isRecord(request.reconciledGraph)) {
    throw failure('partition_reconciled_graph_missing');
  }
  requireHash(request.reconciliationReceiptHash, 'reconciliationReceiptHash');
  return {
    policy,
    snapshotSet,
    sourceAuthorityBundle,
    canonicalIntentBundle,
    goalContractBundle,
    subordinateCoverageReceipts,
    methodologyProfile,
  };
}

function sourceAuthorityProjection(authority) {
  return {
    sourceCompositionMode: authority.policy.mode,
    sourceCompositionPolicyHash: authority.policy.sourceCompositionPolicyHash,
    orderedSourceSnapshotSetHash: authority.snapshotSet.orderedSourceSnapshotSetHash,
    orderedSourceBindings: orderedSourceBindings(authority.snapshotSet),
    sourceAuthorityBundleHash: authority.sourceAuthorityBundle.sourceAuthorityBundleHash,
    canonicalIntentSemanticHash: authority.canonicalIntentBundle.canonicalIntentSemanticHash,
    canonicalIntentBundleHash: authority.canonicalIntentBundle.canonicalIntentBundleHash,
    specSpanRegistryHash: authority.canonicalIntentBundle.specSpanRegistry.specSpanRegistryHash,
    intentAuthorityAttestationHash: authority.canonicalIntentBundle.authorityAttestationHash,
    subordinateCoverageReceiptHashes: authority.subordinateCoverageReceipts.map(
      ({ receiptHash }) => receiptHash
    ),
    goalContractSemanticHash: authority.goalContractBundle.goalContractSemanticHash,
    goalContractHash: authority.goalContractBundle.goalContractHash,
  };
}

function semanticRecordIndex(authority): Map<string, CanonicalIntentRecord> {
  return new Map<string, CanonicalIntentRecord>(
    authority.canonicalIntentBundle.canonicalIntentIR.map(
      (record) => [record.intentRecordId, record] as [string, CanonicalIntentRecord]
    )
  );
}

function subordinateObligations(authority): SubordinateObligation[] {
  const records = semanticRecordIndex(authority);
  const descriptors = new Map<string, SubordinateSourceDescriptor>(
    authority.sourceAuthorityBundle.subordinateSources.map(
      (descriptor) =>
        [descriptor.sourceArtifactId, descriptor] as [string, SubordinateSourceDescriptor]
    )
  );
  return authority.goalContractBundle.goalContractSemanticModel.records
    .filter(
      (record) =>
        record.sourceRole === 'subordinate_component_specification' &&
        record.ownership === 'owned_obligation' &&
        record.declaredSourceId
    )
    .map((record) => {
      const canonicalRecord = records.get(record.intentRecordId);
      const descriptor = descriptors.get(record.sourceArtifactId);
      if (!canonicalRecord || !descriptor) {
        throw failure('subordinate_source_stale', {
          intentRecordId: record.intentRecordId,
        });
      }
      return {
        intentRecordId: record.intentRecordId,
        declaredSourceId: record.declaredSourceId,
        semanticOwnershipKey: canonicalRecord.semanticOwnershipKey,
        namespace: record.namespace,
        sourceArtifactId: record.sourceArtifactId,
        sourceSnapshotHash: record.sourceSnapshotHash,
        sourceRole: record.sourceRole,
        parentTaskRefs: unique(descriptor.parentTaskRefs),
        specSpanRefs: unique(record.specSpanRefs),
      };
    })
    .sort((left, right) => compareIds(left.declaredSourceId, right.declaredSourceId));
}

function findPartitionForParentTasks(partitions, obligation) {
  const owners = partitions.filter((partition) =>
    obligation.parentTaskRefs.some((taskRef) => partition.primaryTaskIds.includes(taskRef))
  );
  if (owners.length !== 1) {
    throw failure('subordinate_scope_escape', {
      declaredSourceId: obligation.declaredSourceId,
      parentTaskRefs: obligation.parentTaskRefs,
      ownerPartitionIds: owners.map(({ partitionId }) => partitionId),
    });
  }
  return owners[0].partitionId;
}

function projectOwnedArtifactPaths({ components, fileScopeById, sharedArtifactOwnership = [] }) {
  const componentIds = new Set(components.map(({ componentId }) => componentId));
  const ownershipByPath = new Map(
    (sharedArtifactOwnership || []).map((ownership) => [ownership.path, ownership])
  );
  return unique(
    components.flatMap(({ fileScopeIds }) =>
      (fileScopeIds || [])
        .map((fileScopeId) => fileScopeById.get(fileScopeId))
        .filter((artifactPath) => {
          if (!artifactPath) return false;
          const ownership = ownershipByPath.get(artifactPath);
          return !ownership || componentIds.has(ownership.ownerComponentId);
        })
    )
  );
}

function projectGovernedArtifactPaths({ taskIds, fileScopeIndex }) {
  const partitionTaskIds = new Set(unique(taskIds));
  return unique(
    (fileScopeIndex || [])
      .filter((scope) => intersects(scope.taskIds, partitionTaskIds))
      .map((scope) => scope.path)
      .filter(Boolean)
  );
}

function partitionRecords(
  optimization,
  componentGraph,
  projection,
  reconciledGraph,
  commandAuthority
) {
  const componentById = new Map(
    componentGraph.components.map((component) => [component.componentId, component])
  );
  const fileScopeById = new Map(
    projection.fileScopeIndex.map((scope) => [scope.fileScopeId, scope.path])
  );
  return optimization.topologicalOrder.map((partitionId) => {
    const optimized = optimization.partitions.find(
      (partition) => partition.partitionId === partitionId
    );
    if (!optimized) {
      throw failure('partition_optimizer_currentness_mismatch', {
        partitionId,
      });
    }
    const components = optimized.primaryComponentIds.map((componentId) => {
      const component = componentById.get(componentId);
      if (!component) {
        throw failure('partition_component_unknown', {
          componentId,
          partitionId,
        });
      }
      return component;
    });
    const taskIds = new Set(unique(optimized.primaryTaskIds));
    const traceSliceIds = new Set(unique(optimized.primaryTraceSliceIds));
    const slices = (projection.traceSlices || []).filter(
      (slice) => traceSliceIds.has(String(slice.sliceId)) || intersects(slice.taskIds, taskIds)
    );
    const reconciledSlices = (
      Array.isArray(reconciledGraph?.traceSlices) ? reconciledGraph.traceSlices : []
    ).filter(
      (slice) =>
        traceSliceIds.has(String(slice.id || slice.sliceId)) ||
        intersects(slice.taskIds || slice.goalIds, taskIds)
    );
    const completionPredicateIds = unique(
      components.flatMap(({ completionPredicateIds: predicateIds }) => predicateIds || [])
    );
    const closureMinuteBreakdown = {
      declaredTaskMinutes: optimized.closureMinuteBreakdown.declaredTaskMinutes || 0,
      derivedTaskMinutes: optimized.closureMinuteBreakdown.derivedTaskMinutes || 0,
      verificationMinutes: optimized.closureMinuteBreakdown.verificationMinutes || 0,
      coordinationMinutes: optimized.closureMinuteBreakdown.coordinationMinutes || 0,
      totalMinutes: optimized.closureMinuteBreakdown.totalMinutes,
    };
    return {
      ...structuredClone(optimized),
      primaryComponentIds: unique(optimized.primaryComponentIds),
      primaryTraceSliceIds: unique(optimized.primaryTraceSliceIds),
      primaryTaskIds: unique(optimized.primaryTaskIds),
      outcome:
        unique(slices.map(({ observableOutcome }) => observableOutcome).filter(Boolean)).join(
          ' | '
        ) || `Complete ${unique(optimized.primaryTraceSliceIds).join(', ')}`,
      primaryEpicIds: unique(
        (projection.executionEpics || [])
          .filter(
            (epic) =>
              intersects(epic.taskIds, taskIds) || intersects(epic.traceSliceIds, traceSliceIds)
          )
          .map(({ epicId }) => epicId)
      ),
      dependencyPartitionIds: unique(optimized.dependencyPartitionIds),
      primarySourceObligationIds: unique(components.flatMap(({ sourceIds }) => sourceIds || [])),
      inheritedConstraintIds: unique(
        slices.flatMap(({ sequenceConstraintIds }) => sequenceConstraintIds || [])
      ),
      acceptanceIds: completionPredicateIds,
      commandIds: unique(
        reconciledSlices
          .flatMap(commandReferences)
          .filter((commandId) => commandAuthority.recordsById.has(commandId))
      ),
      completionPredicateIds,
      evidenceContractIds: unique(
        components.flatMap(({ evidenceContractIds }) => evidenceContractIds || [])
      ),
      ownedArtifactPaths: projectOwnedArtifactPaths({
        components,
        fileScopeById,
        sharedArtifactOwnership: componentGraph.sharedArtifactOwnership,
      }),
      governedPaths: projectGovernedArtifactPaths({
        taskIds: optimized.primaryTaskIds,
        fileScopeIndex: projection.fileScopeIndex,
      }),
      blockedConditions: [],
      failureClasses: [],
      estimatedClosureCost: {
        unit: 'minutes',
        total: optimized.estimatedClosureMinutes,
        breakdown: closureMinuteBreakdown,
      },
      closureMinuteBreakdown,
    };
  });
}

function selectionRecords({
  partitions,
  obligations,
  reconciledGraph,
  sourceCompositionPolicyHash,
  subordinateCoverageReceiptHashes,
}) {
  const sourceObligationsById = new Map(
    (reconciledGraph.sourceObligations || []).map((obligation) => [obligation.id, obligation])
  );
  const obligationsByPartition = new Map<string, SubordinateObligation[]>(
    partitions.map(({ partitionId }) => [partitionId, []] as [string, SubordinateObligation[]])
  );
  for (const obligation of obligations) {
    obligationsByPartition
      .get(findPartitionForParentTasks(partitions, obligation))
      .push(obligation);
  }
  return partitions.map((partition) => {
    const primarySpecSpanRefs = unique(
      partition.primarySourceObligationIds.flatMap((sourceId) => {
        const source = sourceObligationsById.get(sourceId);
        return [...(source?.specSpanRefs || []), ...(source?.sourceBinding?.specSpanRefs || [])];
      })
    );
    const namespacedObligations = obligationsByPartition
      .get(partition.partitionId)
      .sort((left, right) => compareIds(left.declaredSourceId, right.declaredSourceId));
    const semantic = {
      partitionId: partition.partitionId,
      sourceCompositionPolicyHash,
      primaryComponentIds: partition.primaryComponentIds,
      primaryTraceSliceIds: partition.primaryTraceSliceIds,
      primaryTaskIds: partition.primaryTaskIds,
      dependencyPartitionIds: partition.dependencyPartitionIds,
      primarySourceObligationIds: partition.primarySourceObligationIds,
      completionPredicateIds: partition.completionPredicateIds,
      evidenceContractIds: partition.evidenceContractIds,
      ownedArtifactPaths: partition.ownedArtifactPaths,
      governedPaths: partition.governedPaths,
      namespacedObligations,
      namespaceRefs: unique(namespacedObligations.map(({ namespace }) => namespace)),
      sourceArtifactRefs: unique(
        namespacedObligations.map(({ sourceArtifactId }) => sourceArtifactId)
      ),
      specSpanRefs: unique([
        ...primarySpecSpanRefs,
        ...namespacedObligations.flatMap(({ specSpanRefs }) => specSpanRefs),
      ]),
      subordinateCoverageReceiptHashes:
        namespacedObligations.length > 0 ? subordinateCoverageReceiptHashes : [],
    };
    return {
      ...semantic,
      selectionHash: hashControlPlaneValue(semantic),
    };
  });
}

function coverageObligations(projection, obligations, commandAuthority) {
  return {
    sourceObligationIds: unique(projection.traceSlices.flatMap(({ sourceIds }) => sourceIds)),
    traceSliceIds: unique(projection.traceSlices.map(({ sliceId }) => sliceId)),
    atomicTaskIds: unique(projection.atomicTasks.map(({ taskId }) => taskId)),
    completionPredicateIds: unique(
      projection.completionPredicates.map(({ predicateId }) => predicateId)
    ),
    commandIds: commandAuthority.referencedCommandIds,
    evidenceContractIds: unique(
      projection.evidenceContracts.map(({ evidenceContractId }) => evidenceContractId)
    ),
    subordinateDeclaredSourceIds: unique(
      obligations.map(({ declaredSourceId }) => declaredSourceId)
    ),
  };
}

function dependencyEdges(partitions) {
  return partitions
    .flatMap((partition) =>
      partition.dependencyPartitionIds.map((fromPartitionId) => ({
        fromPartitionId,
        toPartitionId: partition.partitionId,
      }))
    )
    .sort((left, right) =>
      compareIds(
        `${left.fromPartitionId}|${left.toPartitionId}`,
        `${right.fromPartitionId}|${right.toPartitionId}`
      )
    );
}

function projectOwnerConsumerRecords(componentGraph, partitions) {
  const partitionByComponent = new Map(
    partitions.flatMap((partition) =>
      partition.primaryComponentIds.map((componentId) => [componentId, partition.partitionId])
    )
  );
  return (componentGraph.sharedArtifactOwnership || [])
    .map((ownership) => ({
      artifactPath: ownership.path,
      ownerPartitionId: partitionByComponent.get(ownership.ownerComponentId),
      consumerPartitionIds: unique(
        ownership.participatingComponentIds
          .map((componentId) => partitionByComponent.get(componentId))
          .filter(
            (partitionId) =>
              partitionId && partitionId !== partitionByComponent.get(ownership.ownerComponentId)
          )
      ),
    }))
    .filter(({ artifactPath, ownerPartitionId, consumerPartitionIds }) =>
      Boolean(artifactPath && ownerPartitionId && consumerPartitionIds.length > 0)
    )
    .sort((left, right) => compareIds(left.artifactPath, right.artifactPath));
}

function candidateSummaries(optimization) {
  return optimization.candidates.map((candidate) => ({
    candidateId: candidate.candidateId,
    selected: candidate.selected,
    partitionCount: candidate.partitions.length,
    partitionIds: candidate.partitions.map(({ partitionId }) => partitionId),
    score: Number(candidate.score?.total || 0),
  }));
}

function namespaceOwnership(authority) {
  return [
    authority.sourceAuthorityBundle.primarySource,
    ...authority.sourceAuthorityBundle.subordinateSources,
  ]
    .map((descriptor) => ({
      namespace: descriptor.namespace,
      sourceArtifactId: descriptor.sourceArtifactId,
      sourceRole: descriptor.role,
      sourceSnapshotHash: descriptor.sourceSnapshotHash,
      parentTaskRefs: unique(descriptor.parentTaskRefs),
    }))
    .sort((left, right) => compareIds(left.namespace, right.namespace));
}

function subordinateTaskMappings({ authority, obligations, partitions }) {
  const coverageBySource = new Map<string, SubordinateCoverageReceipt>(
    authority.subordinateCoverageReceipts.map(
      (receipt) => [receipt.sourceArtifactId, receipt] as [string, SubordinateCoverageReceipt]
    )
  );
  return authority.sourceAuthorityBundle.subordinateSources
    .map((descriptor) => {
      const sourceObligations = obligations.filter(
        ({ sourceArtifactId }) => sourceArtifactId === descriptor.sourceArtifactId
      );
      const partitionIds = unique(
        sourceObligations.map((obligation) => findPartitionForParentTasks(partitions, obligation))
      );
      if (partitionIds.length !== 1) {
        throw failure('subordinate_scope_escape', {
          sourceArtifactId: descriptor.sourceArtifactId,
          partitionIds,
        });
      }
      const receipt = coverageBySource.get(descriptor.sourceArtifactId);
      if (!receipt) throw failure('subordinate_coverage_incomplete');
      return {
        namespace: descriptor.namespace,
        sourceArtifactId: descriptor.sourceArtifactId,
        parentTaskRefs: unique(descriptor.parentTaskRefs),
        declaredSourceIds: unique(
          sourceObligations.map(({ declaredSourceId }) => declaredSourceId)
        ),
        coverageReceiptHash: receipt.receiptHash,
        partitionId: partitionIds[0],
      };
    })
    .sort((left, right) => compareIds(left.namespace, right.namespace));
}

function validatePlanSchema(plan) {
  try {
    validateGoalContractSchema('goal-contract-partition-plan.schema.json', plan);
  } catch (error) {
    if (error?.failureClass === 'canonical_schema_invalid' && error.phase === 'validate') {
      throw failure('partition_plan_schema_invalid', {
        validationErrors: error.validationErrors || [],
      });
    }
    throw error;
  }
}

function compilePartitionBundle(request, authority) {
  const taskFileScopeAuthority =
    compileTaskFileScopeAuthority({
      orderedSourceSnapshotSet: authority.snapshotSet,
      reconciledGraph: request.reconciledGraph,
      sourceSnapshot: request.sourceSnapshot,
    });
  const taskExecutionRoleAuthority =
    compileTaskExecutionRoleAuthority({
      orderedSourceSnapshotSet: authority.snapshotSet,
      reconciledGraph: request.reconciledGraph,
      sourceSnapshot: request.sourceSnapshot,
    });
  const executableReconciledGraph =
    projectExecutableReconciledGraph(
      request.reconciledGraph,
      taskExecutionRoleAuthority
    );
  const authorityProjection = sourceAuthorityProjection(authority);
  const reconciledGraphHash = canonicalGraphHash(
    executableReconciledGraph
  );
  const commandAuthority = typedCommandAuthority(
    executableReconciledGraph
  );
  const projectionAuthority = {
    ...authorityProjection,
    sourceSnapshotHash: authority.snapshotSet.orderedSourceSnapshotSetHash,
    sourceObligationGraphHash: hashSourceObligationGraph(
      authority.canonicalIntentBundle.sourceObligationGraph
    ),
    methodologyProfileHash: authority.methodologyProfile.methodologyProfileHash,
    semanticModelHash: authority.goalContractBundle.goalContractSemanticHash,
    traceGraphHash: reconciledGraphHash,
    reconciledGraph: executableReconciledGraph,
    reconciledGraphHash,
    sequenceApplicabilityReceipt: request.sequenceApplicabilityReceipt,
    sequenceConstraintInput: request.sequenceConstraintInput,
    sequenceExecutionState: request.sequenceExecutionState,
  };
  const executionProjection = compileExecutionProjection(projectionAuthority);
  const partitionPolicyBinding = assertCurrentPartitionPolicyBinding({
    policyBinding: request.partitionPolicyBinding,
    sourceSnapshotHash: executionProjection.sourceSnapshotHash,
    semanticModelHash: executionProjection.semanticModelHash,
    executionProjectionHash: executionProjection.executionProjectionHash,
  });
  const componentGraph = buildPartitionComponents({
    executionProjection,
    policy: partitionPolicyBinding.policy,
  });
  const optimization = optimizePartitions({
    componentGraph,
    executionProjection,
    policyBinding: partitionPolicyBinding,
    projectionAuthority,
  });
  const partitions = partitionRecords(
    optimization,
    componentGraph,
    executionProjection,
    executableReconciledGraph,
    commandAuthority
  );
  if (taskExecutionRoleAuthority.mode === 'explicit') {
    validateExecutablePartitionReadiness({
      partitions,
      executableTaskIds:
        taskExecutionRoleAuthority.executableTaskIds,
      aggregateTaskIds:
        taskExecutionRoleAuthority.aggregateTaskIds,
    });
  }
  const obligations = subordinateObligations(authority);
  const selections = selectionRecords({
    partitions,
    obligations,
    reconciledGraph: request.reconciledGraph,
    sourceCompositionPolicyHash: authority.policy.sourceCompositionPolicyHash,
    subordinateCoverageReceiptHashes: authorityProjection.subordinateCoverageReceiptHashes,
  });
  const partitionSetHash = hashControlPlaneValue(
    selections.map(({ partitionId, selectionHash, dependencyPartitionIds }) => ({
      partitionId,
      selectionHash,
      dependencyPartitionIds,
    }))
  );
  const semanticPlan = {
    schemaVersion: 'goal-contract-partition-plan/v1',
    ...authorityProjection,
    methodologyProfileHash: authority.methodologyProfile.methodologyProfileHash,
    executionProjectionHash: executionProjection.executionProjectionHash,
    taskDagHash: executionProjection.taskDagHash,
    integrationJoinGraphHash: executionProjection.integrationJoinGraphHash,
    partitionPolicyHash: partitionPolicyBinding.partitionPolicyHash,
    optimizerVersion: optimization.optimizerVersion,
    selectedCandidateId: optimization.selectedCandidateId,
    sequenceMode: executionProjection.sequenceConstraintBinding.sequenceMode,
    sequenceApplicability: executionProjection.sequenceConstraintBinding.applicabilityDecision,
    sequenceCoverage: executionProjection.sequenceConstraintBinding.sequenceCoverage,
    sequenceClosureStatus: executionProjection.sequenceConstraintBinding.sequenceClosureStatus,
    childContractAuthority: executionProjection.sequenceConstraintBinding.childContractAuthority,
    ...(taskExecutionRoleAuthority.mode === 'explicit'
      ? {
          taskExecutionRoleAuthorityHash:
            taskExecutionRoleAuthority
              .taskExecutionRoleAuthorityHash,
          aggregateValidation:
            taskExecutionRoleAuthority.aggregateValidation,
        }
      : {}),
    namespaceOwnership: namespaceOwnership(authority),
    subordinateTaskMappings: subordinateTaskMappings({
      authority,
      obligations,
      partitions,
    }),
    partitionCandidates: candidateSummaries(optimization),
    topologicalOrder: optimization.topologicalOrder,
    partitions,
    selections,
    coverageObligations: coverageObligations(executionProjection, obligations, commandAuthority),
    dependencyEdges: dependencyEdges(partitions),
    ownerConsumerRecords: projectOwnerConsumerRecords(componentGraph, partitions),
    childProjectionInputs: selections.map((selection) => ({
      ...selection,
      goalContractHash: authority.goalContractBundle.goalContractHash,
      orderedSourceSnapshotSetHash: authority.snapshotSet.orderedSourceSnapshotSetHash,
      sourceAuthorityBundleHash: authority.sourceAuthorityBundle.sourceAuthorityBundleHash,
      partitionSetHash,
    })),
    partitionSetHash,
  };
  const partitionPlan = {
    ...semanticPlan,
    partitionPlanHash: hashControlPlaneValue(semanticPlan),
  };
  validatePlanSchema(partitionPlan);
  const partitionPlanBytes = `${stableControlPlaneStringify(partitionPlan)}\n`;
  return deepFreeze({
    schemaVersion: 'goal-contract-partition-bundle/v1',
    executionProjection,
    projectionAuthority,
    reconciledGraphAuthority: canonicalizeSets(
      executableReconciledGraph
    ),
    componentGraph,
    optimization,
    partitionPolicyBinding,
    taskFileScopeAuthority,
    taskExecutionRoleAuthority,
    partitionPlan,
    partitionPlanBytes,
    partitionPlanHash: partitionPlan.partitionPlanHash,
    partitionSetHash,
  });
}

function compilePartitions(request: PartitionCompileRequest = {}) {
  assertNoAuthorityInjection(request);
  return compilePartitionBundle(request, verifyAuthority(request));
}

function normalizeProjectedChildPath(value) {
  if (typeof value !== 'string' || value.length === 0) {
    throw failure('partition_child_path_invalid');
  }
  const normalized = value.replace(/\\/gu, '/');
  if (
    path.posix.isAbsolute(normalized) ||
    /^[A-Za-z]:\//u.test(normalized) ||
    normalized.split('/').some((segment) => segment === '..')
  ) {
    throw failure('partition_child_path_escape', {
      childContractPath: value,
    });
  }
  return path.posix.normalize(normalized);
}

function resolveRepositoryRelativeChildContractPath({
  repositoryRoot,
  childContractPath,
} = {}) {
  if (
    typeof repositoryRoot !== 'string' ||
    repositoryRoot.length === 0
  ) {
    throw failure('partition_repository_root_invalid');
  }
  const normalized = normalizeProjectedChildPath(
    childContractPath
  );
  if (normalized === '.') {
    throw failure('partition_child_path_invalid', {
      childContractPath,
    });
  }
  const resolvedRoot = path.resolve(repositoryRoot);
  const resolvedChild = path.resolve(
    resolvedRoot,
    ...normalized.split('/')
  );
  const relative = path.relative(resolvedRoot, resolvedChild);
  if (
    relative.length === 0 ||
    relative === '..' ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  ) {
    throw failure('partition_child_path_escape', {
      childContractPath,
    });
  }
  return relative.replace(/\\/gu, '/');
}

function projectExecutionArtifacts({
  partitionPlan,
  displayTitles = {},
  renderChildContract,
  artifactLayout,
  partitionAnalysisReceipt,
  partitionImpactAuthority,
}) {
  if (!partitionPlan || typeof renderChildContract !== 'function') {
    throw failure('execution_projection_request_invalid');
  }
  const childPaths = new Set();
  const childCompilationReceipts = partitionPlan.childProjectionInputs.map(
    (childProjectionInput, index) => {
      const displayOrdinal = index + 1;
      const rendered = renderChildContract({
        partitionPlan: structuredClone(partitionPlan),
        childProjectionInput: structuredClone(childProjectionInput),
        displayOrdinal,
      });
      if (
        !rendered ||
        (!Buffer.isBuffer(rendered.childContractBytes) &&
          typeof rendered.childContractBytes !== 'string')
      ) {
        throw failure('partition_child_render_invalid', {
          partitionId: childProjectionInput.partitionId,
        });
      }
      const childContractPath = normalizeProjectedChildPath(rendered.childContractPath);
      if (childPaths.has(childContractPath)) {
        throw failure('partition_child_path_duplicate', {
          childContractPath,
        });
      }
      childPaths.add(childContractPath);
      return createPendingChildCompilationReceipt({
        partitionPlan,
        childProjectionInput,
        displayOrdinal,
        childContractPath,
        childContractBytes: rendered.childContractBytes,
      });
    }
  );
  const finalized = finalizePartitionManifest({
    partitionPlan,
    displayTitles,
    childCompilationReceipts,
    artifactLayout,
    partitionAnalysisReceipt,
    partitionImpactAuthority,
  });
  return deepFreeze({
    schemaVersion: 'goal-contract-execution-projection-bundle/v1',
    partitionPlanHash: partitionPlan.partitionPlanHash,
    partitionSetHash: partitionPlan.partitionSetHash,
    analysisReceipt: finalized.analysisReceipt,
    analysisReceiptBytes: finalized.analysisReceiptBytes,
    partitionAnalysisReceiptHash:
      finalized.partitionAnalysisReceiptHash,
    childCompilationReceipts,
    orderedChildContractHashes: finalized.orderedChildContractHashes,
    partitionManifest: finalized.manifest,
    partitionManifestBytes: finalized.partitionManifestBytes,
    partitionManifestHash: finalized.partitionManifestHash,
    partitionManifestDocumentHash: finalized.partitionManifestDocumentHash,
    childMembershipReceipts: finalized.childMembershipReceipts,
  });
}

function compileLegacySingleSourcePartitions(request: PartitionCompileRequest = {}) {
  const allowed = new Set([
    'sourceSnapshot',
    'sourceObligationGraph',
    'methodologyProfile',
    'partitionPolicyBinding',
    'reconciledGraph',
    'reconciliationReceiptHash',
    'sequenceApplicabilityReceipt',
    'sequenceConstraintInput',
    'sequenceExecutionState',
    'repositoryFacts',
  ]);
  if (!isRecord(request)) {
    throw failure('partition_compile_request_invalid');
  }
  const forbiddenFields = Object.keys(request)
    .filter((field) => !allowed.has(field))
    .sort(compareIds);
  if (forbiddenFields.length > 0) {
    throw failure('partition_authority_injection', {
      forbiddenFields,
    });
  }
  const sourceSnapshot = request.sourceSnapshot;
  const sourceSnapshotHash = requireHash(
    sourceSnapshot?.aggregateHash,
    'sourceSnapshot.aggregateHash'
  );
  const sourceArtifactId = `standalone-source-${sourceSnapshotHash.slice(7)}`;
  const namespace = `STANDALONE_${sourceSnapshotHash.slice(7).toUpperCase()}`;
  const sourceCompositionPolicyHash = hashControlPlaneValue({
    schemaVersion: 'goal-contract-source-composition-policy/v1',
    mode: 'single_source',
    sourceSnapshotHash,
  });
  const orderedSourceSnapshotSetHash = hashControlPlaneValue({
    schemaVersion: 'goal-contract-ordered-source-snapshot-set/v1',
    sourceSnapshots: [
      {
        sourceOrder: 0,
        sourceArtifactId,
        sourceSnapshotHash,
      },
    ],
  });
  const sourceAuthorityBundleHash = hashControlPlaneValue({
    schemaVersion: 'goal-contract-source-authority-bundle/v1',
    sourceCompositionPolicyHash,
    orderedSourceSnapshotSetHash,
    primarySourceArtifactId: sourceArtifactId,
    namespace,
  });
  const sourceObligationGraphHash = hashSourceObligationGraph(request.sourceObligationGraph);
  const reconciledGraphHash = canonicalGraphHash(request.reconciledGraph);
  const specSpanRegistryHash =
    request.sourceObligationGraph?.specSpanRegistryHash ||
    hashControlPlaneValue({
      schemaVersion: 'goal-contract-spec-span-registry/v1',
      sourceSnapshotHash,
      specSpans: [],
    });
  const canonicalIntentSemanticHash = hashControlPlaneValue({
    schemaVersion: 'goal-contract-legacy-canonical-intent/v1',
    sourceObligationGraphHash,
    reconciledGraphHash,
  });
  const canonicalIntentBundleHash = hashControlPlaneValue({
    schemaVersion: 'goal-contract-legacy-canonical-intent-bundle/v1',
    canonicalIntentSemanticHash,
    sourceCompositionPolicyHash,
    orderedSourceSnapshotSetHash,
    sourceAuthorityBundleHash,
    specSpanRegistryHash,
  });
  const authorityAttestationHash = hashControlPlaneValue({
    schemaVersion: 'goal-contract-legacy-intent-attestation/v1',
    canonicalIntentBundleHash,
    sourceSnapshotHash,
  });
  const goalContractSemanticHash = hashControlPlaneValue({
    schemaVersion: 'goal-contract-legacy-parent-semantics/v1',
    canonicalIntentSemanticHash,
    reconciledGraphHash,
  });
  const goalContractHash = hashControlPlaneValue({
    schemaVersion: 'goal-contract-legacy-parent-authority/v1',
    goalContractSemanticHash,
    authorityAttestationHash,
    sourceCompositionPolicyHash,
    sourceAuthorityBundleHash,
  });
  const primarySource = {
    role: 'primary_implementation_authority',
    namespace,
    sourceArtifactId,
    sourceSnapshotHash,
    pathOrSegmentId: sourceSnapshot.sourcePath || sourceSnapshot.sourceId,
    sourceOrder: 0,
    ownedSemanticDomains: [],
    parentTaskRefs: [],
  };
  const authority = {
    policy: {
      mode: 'single_source',
      sourceCompositionPolicyHash,
    },
    snapshotSet: {
      orderedSourceSnapshotSetHash,
      sourceSnapshots: [
        {
          sourceOrder: 0,
          sourceArtifactId,
          sourceRole: primarySource.role,
          namespace,
          sourceSnapshotHash,
        },
      ],
    },
    sourceAuthorityBundle: {
      sourceAuthorityBundleHash,
      primarySource,
      subordinateSources: [],
    },
    canonicalIntentBundle: {
      canonicalIntentSemanticHash,
      canonicalIntentBundleHash,
      authorityAttestationHash,
      sourceObligationGraph: request.sourceObligationGraph,
      sourceObligationGraphHash,
      canonicalIntentIR: [],
      specSpanRegistry: {
        specSpanRegistryHash,
        specSpans: [],
      },
    },
    goalContractBundle: {
      goalContractSemanticHash,
      goalContractHash,
      goalContractSemanticModel: {
        records: [],
      },
      subordinateSourceCoverageReceipts: [],
    },
    subordinateCoverageReceipts: [],
    methodologyProfile: request.methodologyProfile,
  };
  requireHash(authority.methodologyProfile?.methodologyProfileHash, 'methodologyProfileHash');
  if (!isRecord(request.reconciledGraph)) {
    throw failure('partition_reconciled_graph_missing');
  }
  requireHash(request.reconciliationReceiptHash, 'reconciliationReceiptHash');
  return compilePartitionBundle(request, authority);
}

function validateSpecSpanOwnership(plan, authority) {
  const spanById = new Map<string, SpecSpanAuthority>(
    authority.canonicalIntentBundle.specSpanRegistry.specSpans.map(
      (span) => [span.specSpanId, span] as [string, SpecSpanAuthority]
    )
  );
  for (const selection of plan.selections || []) {
    for (const obligation of selection.namespacedObligations || []) {
      for (const specSpanId of obligation.specSpanRefs || []) {
        const span = spanById.get(specSpanId);
        if (
          !span ||
          span.sourceArtifactId !== obligation.sourceArtifactId ||
          span.namespace !== obligation.namespace ||
          span.sourceSnapshotHash !== obligation.sourceSnapshotHash
        ) {
          throw failure('cross_source_spec_span_substitution', {
            declaredSourceId: obligation.declaredSourceId,
            specSpanId,
          });
        }
      }
    }
  }
}

function validateSubordinatePlacement(plan, authority) {
  const expected = subordinateObligations(authority);
  const actual = (plan.selections || []).flatMap((selection) =>
    (selection.namespacedObligations || []).map((obligation) => ({
      partitionId: selection.partitionId,
      primaryTaskIds: selection.primaryTaskIds || [],
      obligation,
    }))
  );
  const expectedIds = expected.map(({ declaredSourceId }) => declaredSourceId);
  const actualIds = actual.map(({ obligation }) => obligation.declaredSourceId);
  if (
    stableControlPlaneStringify(expectedIds) !==
    stableControlPlaneStringify([...actualIds].sort(compareIds))
  ) {
    throw failure('subordinate_coverage_incomplete', {
      expectedIds,
      actualIds: [...actualIds].sort(compareIds),
    });
  }
  for (const { primaryTaskIds, obligation } of actual) {
    if (!obligation.parentTaskRefs.some((taskRef) => primaryTaskIds.includes(taskRef))) {
      throw failure('subordinate_scope_escape', {
        declaredSourceId: obligation.declaredSourceId,
      });
    }
  }
}

function validatePolicyBindings(plan, authority) {
  const expected = authority.policy.sourceCompositionPolicyHash;
  if (
    plan.sourceCompositionPolicyHash !== expected ||
    (plan.selections || []).some(
      (selection) => selection.sourceCompositionPolicyHash !== expected
    ) ||
    (plan.childProjectionInputs || []).some(
      (projection) => projection.sourceCompositionPolicyHash !== expected
    )
  ) {
    throw failure('source_composition_policy_mismatch');
  }
  if (
    authority.policy.mode === 'composite_required' &&
    plan.sourceCompositionMode === 'single_source'
  ) {
    throw failure('source_composition_downgrade_rejected');
  }
}

function verifyPartitionPlan(plan, request: PartitionCompileRequest = {}) {
  if (!isRecord(plan)) throw failure('partition_plan_invalid');
  assertNoAuthorityInjection(request);
  const authority = verifyAuthority(request);
  validatePolicyBindings(plan, authority);
  validateSubordinatePlacement(plan, authority);
  validateSpecSpanOwnership(plan, authority);
  const { partitionPlanHash: _ignored, ...semanticPlan } = plan;
  if (plan.partitionPlanHash !== hashControlPlaneValue(semanticPlan)) {
    throw failure('partition_plan_hash_mismatch');
  }
  validatePlanSchema(plan);
  const expected = compilePartitions(request).partitionPlan;
  if (stableControlPlaneStringify(plan) !== stableControlPlaneStringify(expected)) {
    throw failure('partition_plan_currentness_mismatch');
  }
  return Object.freeze({ decision: 'pass' });
}

module.exports = {
  canonicalIdentifierList,
  compileLegacySingleSourcePartitions,
  compilePartitionImpactAuthority,
  compilePartitionImpactDriftBaseline,
  compilePartitions,
  compileTaskExecutionRoleAuthority,
  compileTaskFileScopeAuthority,
  projectOwnerConsumerRecords,
  projectOwnedArtifactPaths,
  projectExecutionArtifacts,
  resolveRepositoryRelativeChildContractPath,
  validateExecutablePartitionReadiness,
  validateTaskFileScopeCells,
  verifyPartitionPlan,
};
