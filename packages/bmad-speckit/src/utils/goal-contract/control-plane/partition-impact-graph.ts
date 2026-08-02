const { createHash } = require('node:crypto');
const path = require('node:path');

const {
  hashControlPlaneValue,
  stableControlPlaneStringify,
} = require(
  __filename.endsWith('.ts')
    ? './canonical-hash.ts'
    : './canonical-hash'
);
const {
  loadPartitionImpactPolicy,
} = require(
  __filename.endsWith('.ts')
    ? './partition-impact-policy.ts'
    : './partition-impact-policy'
);
const {
  validateGoalContractSchema,
} = require(
  __filename.endsWith('.ts')
    ? './schema-registry.ts'
    : './schema-registry'
);
const {
  enumerateRepositoryFacts,
} = require(
  __filename.endsWith('.ts')
    ? '../repository-facts.ts'
    : '../repository-facts'
);

export type GoalContractPartitionImpactGraphModule = never;

const HASH_PATTERN = /^sha256:[0-9a-f]{64}$/u;
const ZERO_HASH = `sha256:${'0'.repeat(64)}`;
const COMMAND_KINDS = Object.freeze([
  'direct',
  'impacted',
  'integration',
  'regression',
]);
const ALLOWED_INPUT_FIELDS = new Set([
  'repositoryRoot',
  'packageRoot',
  'partitionPlan',
  'reconciledGraph',
]);

function failure(failureClass, details = {}) {
  return Object.assign(new Error(failureClass), {
    failureClass,
    ...details,
  });
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
    return value;
  }
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function compareIds(left, right) {
  return String(left).localeCompare(String(right), 'en');
}

function unique(values = []) {
  return [...new Set(values.filter(Boolean).map(String))].sort(compareIds);
}

function sha256Buffer(value) {
  return `sha256:${createHash('sha256')
    .update(Buffer.from(value))
    .digest('hex')}`;
}

function assertHash(value, field) {
  if (!HASH_PATTERN.test(String(value || ''))) {
    throw failure('partition_impact_authority_invalid', {
      field,
      value,
    });
  }
  return value;
}

function assertNoAuthorityInjection(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw failure('partition_impact_authority_invalid');
  }
  const forbiddenFields = Object.keys(input)
    .filter((field) => !ALLOWED_INPUT_FIELDS.has(field))
    .sort(compareIds);
  if (forbiddenFields.length > 0) {
    throw failure('partition_impact_authority_injection', {
      forbiddenFields,
    });
  }
}

function normalizeRepositoryPath(value) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw failure('partition_impact_path_escape', { value });
  }
  const candidate = value.trim().replace(/\\/gu, '/');
  if (
    path.posix.isAbsolute(candidate) ||
    /^[A-Za-z]:\//u.test(candidate) ||
    candidate.startsWith('//') ||
    candidate.split('/').includes('..')
  ) {
    throw failure('partition_impact_path_escape', { value });
  }
  const normalized = path.posix.normalize(candidate).replace(/^\.\//u, '');
  if (
    normalized === '.' ||
    normalized.length === 0 ||
    normalized.startsWith('../')
  ) {
    throw failure('partition_impact_path_escape', { value });
  }
  return normalized;
}

function absoluteRepositoryPath(repositoryRoot, relativePath) {
  const root = path.resolve(repositoryRoot);
  const resolved = path.resolve(root, ...relativePath.split('/'));
  const relative = path.relative(root, resolved);
  if (
    relative.startsWith('..') ||
    path.isAbsolute(relative) ||
    relative === ''
  ) {
    throw failure('partition_impact_path_escape', {
      relativePath,
    });
  }
  return resolved;
}

function pathIsExcluded(relativePath, policy) {
  const canonicalPath = relativePath.replace(/\\/gu, '/');
  const normalized = `${canonicalPath}${
    canonicalPath.endsWith('/') ? '' : '/'
  }`;
  return policy.excludedPathPrefixes.some((prefix) => {
    const canonicalPrefix = prefix.replace(/\\/gu, '/').replace(/^\/+/u, '');
    return (
      canonicalPath === canonicalPrefix.replace(/\/$/u, '') ||
      normalized.startsWith(canonicalPrefix) ||
      normalized.includes(`/${canonicalPrefix}`)
    );
  });
}

function artifactKind(relativePath) {
  const basename = path.posix.basename(relativePath);
  const extension = path.posix.extname(relativePath).toLowerCase();
  if (basename === 'package.json') return 'package_manifest';
  if (/^tsconfig(?:\..+)?\.json$/u.test(basename)) {
    return 'typescript_configuration';
  }
  if (extension === '.json' && relativePath.includes('schema')) {
    return 'json_schema';
  }
  if (['.ts', '.tsx', '.mts', '.cts'].includes(extension)) {
    return 'typescript_source';
  }
  if (['.js', '.jsx', '.mjs', '.cjs'].includes(extension)) {
    return 'javascript_source';
  }
  if (['.yaml', '.yml', '.toml', '.json'].includes(extension)) {
    return 'configuration';
  }
  return 'text_artifact';
}

function canonicalPlanBasis(partitionPlan) {
  const topologicalOrder = [
    ...new Set(
      (partitionPlan.topologicalOrder || [])
        .filter(Boolean)
        .map(String)
    ),
  ];
  const index = new Map(
    topologicalOrder.map((partitionId, position) => [
      partitionId,
      position,
    ])
  );
  const partitions = [...(partitionPlan.partitions || [])]
    .map((partition) => ({
      partitionId: String(partition.partitionId || ''),
      dependencyPartitionIds: unique(
        partition.dependencyPartitionIds || []
      ),
      ownedArtifactPaths: unique(
        (partition.ownedArtifactPaths || []).map(
          normalizeRepositoryPath
        )
      ),
      governedPaths: unique(
        (
          partition.governedPaths ??
          partition.ownedArtifactPaths ??
          []
        ).map(normalizeRepositoryPath)
      ),
      commandIds: unique(partition.commandIds || []),
    }))
    .sort(
      (left, right) =>
        (index.get(left.partitionId) ?? Number.MAX_SAFE_INTEGER) -
          (index.get(right.partitionId) ?? Number.MAX_SAFE_INTEGER) ||
        compareIds(left.partitionId, right.partitionId)
    );
  if (
    topologicalOrder.length !== partitions.length ||
    partitions.some(
      (partition, position) =>
        partition.partitionId !== topologicalOrder[position]
    )
  ) {
    throw failure('partition_impact_partition_topology_invalid');
  }
  const dependencyEdges = partitions.flatMap((partition) =>
    partition.dependencyPartitionIds.map((dependencyPartitionId) => ({
      fromPartitionId: dependencyPartitionId,
      toPartitionId: partition.partitionId,
    }))
  );
  return {
    topologicalOrder,
    partitions,
    dependencyEdges: dependencyEdges.sort((left, right) =>
      compareIds(
        `${left.fromPartitionId}|${left.toPartitionId}`,
        `${right.fromPartitionId}|${right.toPartitionId}`
      )
    ),
  };
}

function ownerState(planBasis) {
  const ownerByPath = new Map();
  const commandOwnerById = new Map();
  const commandOwnersById = new Map();
  for (const partition of planBasis.partitions) {
    for (const artifactPath of partition.ownedArtifactPaths) {
      const currentOwner = ownerByPath.get(artifactPath);
      if (currentOwner && currentOwner !== partition.partitionId) {
        throw failure('partition_impact_owner_ambiguous', {
          artifactPath,
          ownerPartitionIds: unique([
            currentOwner,
            partition.partitionId,
          ]),
        });
      }
      ownerByPath.set(artifactPath, partition.partitionId);
    }
    for (const commandId of partition.commandIds) {
      if (!commandOwnersById.has(commandId)) {
        commandOwnersById.set(commandId, new Set());
      }
      commandOwnersById.get(commandId).add(
        partition.partitionId
      );
    }
  }
  for (const [commandId, owners] of commandOwnersById) {
    const ownerPartitionIds = [...owners].sort(compareIds);
    if (ownerPartitionIds.length === 1) {
      commandOwnerById.set(commandId, ownerPartitionIds[0]);
      continue;
    }
    if (
      ownerPartitionIds.length ===
      planBasis.partitions.length
    ) {
      commandOwnerById.set(commandId, 'baseline');
      continue;
    }
    throw failure('partition_impact_owner_ambiguous', {
      commandId,
      ownerPartitionIds,
    });
  }
  return { ownerByPath, commandOwnerById };
}

function artifactId(relativePath) {
  return `artifact-${hashControlPlaneValue({
    path: relativePath,
  }).slice('sha256:'.length)}`;
}

function buildArtifactNodes({ enumeration, ownerByPath }) {
  const allPaths = unique([
    ...enumeration.files.keys(),
    ...ownerByPath.keys(),
  ]);
  return allPaths.map((relativePath) => {
    const current = enumeration.files.get(relativePath);
    const ownerPartitionId = ownerByPath.get(relativePath) || 'baseline';
    const mutable = ownerPartitionId !== 'baseline';
    return {
      artifactId: artifactId(relativePath),
      path: relativePath,
      artifactKind: artifactKind(relativePath),
      existenceState: current ? 'present' : 'planned',
      fileHash: current?.fileHash || ZERO_HASH,
      plannedOperation: mutable
        ? current
          ? 'modify'
          : 'create'
        : 'none',
      mutable,
      ownerPartitionId,
      provenanceRefs: mutable
        ? [`partition-plan:${ownerPartitionId}`]
        : [`repository:${relativePath}`],
    };
  });
}

function resolveRepositorySpecifier({
  sourcePath,
  specifier,
  knownPaths,
}) {
  if (!specifier.startsWith('.')) return null;
  const unresolved = normalizeRepositoryPath(
    path.posix.join(path.posix.dirname(sourcePath), specifier)
  );
  const candidates = [
    unresolved,
    ...[
      '.ts',
      '.tsx',
      '.mts',
      '.cts',
      '.js',
      '.jsx',
      '.mjs',
      '.cjs',
      '.json',
    ].map((extension) => `${unresolved}${extension}`),
    ...[
      '.ts',
      '.tsx',
      '.js',
      '.jsx',
      '.json',
    ].map((extension) => `${unresolved}/index${extension}`),
  ];
  return candidates.find((candidate) => knownPaths.has(candidate)) || null;
}

function isExcludedRepositorySpecifier({
  sourcePath,
  specifier,
  policy,
}) {
  if (!specifier.startsWith('.')) return false;
  const unresolved = normalizeRepositoryPath(
    path.posix.join(path.posix.dirname(sourcePath), specifier)
  );
  return pathIsExcluded(unresolved, policy);
}

function relationEdge({
  relationKind,
  fromNodeId,
  toNodeId,
  evidencePath,
  line,
  evidenceText,
  provenanceKind,
}) {
  const semantic = {
    relationKind,
    fromNodeId,
    toNodeId,
    evidencePath,
    lineStart: line,
    lineEnd: line,
    evidenceHash: sha256Buffer(Buffer.from(evidenceText, 'utf8')),
    provenanceKind,
  };
  return {
    edgeId: `relation-${hashControlPlaneValue(semantic).slice(
      'sha256:'.length
    )}`,
    ...semantic,
  };
}

function unsupportedRecord({
  sourcePath,
  line,
  relationClass,
  expression,
}) {
  return {
    sourcePath,
    line,
    relationClass,
    expressionHash: sha256Buffer(Buffer.from(expression, 'utf8')),
    requiredRemediation: 'register_supported_static_relation',
  };
}

function isPackageOwnedGoalContractRuntimeLoader({
  sourcePath,
  text,
  expression,
}) {
  const normalizedExpression = expression.replace(/\s+/gu, ' ').trim();
  if (
    sourcePath === 'packages/bmad-speckit/src/commands/goal-contract.ts' &&
    text.includes('/* goal-contract-source-runtime:start */') &&
    text.includes('/* goal-contract-source-runtime:end */') &&
    new Set([
      "return require(path.join(PACKAGE_ROOT, 'dist', relativePath));",
      'return require(resolvePartitionModulePath(relativePath));',
      'return require(resolveRendererPath());',
      'return require(resolveCommandPortabilityCheckerPath());',
    ]).has(normalizedExpression)
  ) {
    return true;
  }
  if (
    sourcePath === 'packages/bmad-speckit/src/main-agent/runtime.ts' &&
    text.includes('const WAVE_3_12_PACKAGE_RUNTIME_ACTIONS') &&
    normalizedExpression === 'return require(modulePath)[exportName];'
  ) {
    return true;
  }
  if (
    sourcePath === '_bmad/shared/skill-runtime/resolve-bmad-runtime.js' &&
    text.includes('function requireRootPackageDependency(name)') &&
    text.includes('function requireBmadSpeckit(') &&
    text.includes('function modulePathExists(candidate)') &&
    text.includes('if (!modulePathExists(candidate))') &&
    new Set([
      'return require(require.resolve(name, { paths: resolvePaths }));',
      'return require(require.resolve(packageRequest, { paths: resolvePaths }));',
      'return require(candidate);',
    ]).has(normalizedExpression)
  ) {
    return true;
  }
  return (
    sourcePath ===
      'packages/bmad-speckit/src/utils/goal-contract/control-plane/authority-supersession.ts' &&
    text.includes('function loadGoalContractModule(relativePath)') &&
    text.includes('function loadRequirementRecordControlStore()') &&
    new Set([
      'return require(',
      'return require(modulePath);',
    ]).has(normalizedExpression)
  );
}

function executableCodeMask(text) {
  const mask = new Uint8Array(text.length);
  const templateReturnModes = [];
  const templateExpressionDepths = [];
  let mode = 'code';

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const next = text[index + 1];

    if (mode === 'line_comment') {
      if (character === '\n' || character === '\r') {
        mode = 'code';
        mask[index] = 1;
      }
      continue;
    }
    if (mode === 'block_comment') {
      if (character === '*' && next === '/') {
        index += 1;
        mode = 'code';
      }
      continue;
    }
    if (mode === 'single_quote' || mode === 'double_quote') {
      if (character === '\\') {
        index += 1;
        continue;
      }
      if (
        (mode === 'single_quote' && character === "'") ||
        (mode === 'double_quote' && character === '"')
      ) {
        mode = 'code';
      }
      continue;
    }
    if (mode === 'template') {
      if (character === '\\') {
        index += 1;
        continue;
      }
      if (character === '`') {
        mode = templateReturnModes.pop() || 'code';
        continue;
      }
      if (character === '$' && next === '{') {
        templateExpressionDepths.push(1);
        index += 1;
        mode = 'code';
      }
      continue;
    }

    mask[index] = 1;
    if (character === '/' && next === '/') {
      mask[index] = 0;
      index += 1;
      mode = 'line_comment';
      continue;
    }
    if (character === '/' && next === '*') {
      mask[index] = 0;
      index += 1;
      mode = 'block_comment';
      continue;
    }
    if (character === "'") {
      mask[index] = 0;
      mode = 'single_quote';
      continue;
    }
    if (character === '"') {
      mask[index] = 0;
      mode = 'double_quote';
      continue;
    }
    if (character === '`') {
      mask[index] = 0;
      templateReturnModes.push('code');
      mode = 'template';
      continue;
    }
    if (templateExpressionDepths.length > 0) {
      const lastIndex = templateExpressionDepths.length - 1;
      if (character === '{') {
        templateExpressionDepths[lastIndex] += 1;
      } else if (character === '}') {
        templateExpressionDepths[lastIndex] -= 1;
        if (templateExpressionDepths[lastIndex] === 0) {
          templateExpressionDepths.pop();
          mask[index] = 0;
          mode = 'template';
        }
      }
    }
  }
  return mask;
}

function javascriptRelations({
  sourcePath,
  text,
  artifactByPath,
  policy,
}) {
  const relationEdges = [];
  const unsupportedRelationRecords = [];
  const knownPaths = new Set(artifactByPath.keys());
  const patterns = [
    {
      kind: 'static_export',
      pattern: /\bexport\s+[^'"]*?\s+from\s+['"]([^'"]+)['"]/gu,
    },
    {
      kind: 'static_import',
      pattern:
        /\bimport\s+(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]/gu,
    },
    {
      kind: 'dynamic_import_literal',
      pattern: /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/gu,
    },
    {
      kind: 'commonjs_require',
      pattern: /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/gu,
    },
  ];
  const sourceArtifact = artifactByPath.get(sourcePath);
  const lines = text.split(/\r?\n/gu);
  const codeMask = executableCodeMask(text);
  const candidateTargetsByVariable = new Map();
  const registerCandidateTargets = (variable, targets) => {
    const existing = candidateTargetsByVariable.get(variable) || [];
    const merged = [...existing, ...targets].filter(
      (target, index, all) =>
        all.findIndex(
          (candidate) =>
            candidate.kind === target.kind && candidate.value === target.value
        ) === index
    );
    candidateTargetsByVariable.set(variable, merged);
  };
  const candidateLoaderPattern =
    /const\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*\[([\s\S]*?)\];\s*const\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*\1\.find\s*\(\s*\(\s*candidate\s*\)\s*=>\s*fs\.existsSync\s*\(\s*candidate\s*\)\s*\)\s*;/gu;
  for (const match of text.matchAll(candidateLoaderPattern)) {
    const targets = [];
    const pathResolvePattern =
      /path\.resolve\(\s*__dirname((?:\s*,\s*['"][^'"]+['"])*)\s*\)/gu;
    for (const pathMatch of match[2].matchAll(pathResolvePattern)) {
      const segments = [...pathMatch[1].matchAll(/['"]([^'"]+)['"]/gu)].map(
        (segment) => segment[1]
      );
      if (segments.length === 0) continue;
      targets.push({
        kind: 'path',
        value: normalizeRepositoryPath(
          path.posix.join(path.posix.dirname(sourcePath), ...segments)
        ),
      });
    }
    registerCandidateTargets(match[3], targets);
  }
  const conditionalModuleAssignmentPattern =
    /const\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*__filename\.endsWith\('\.ts'\)\s*\?([\s\S]*?);/gu;
  for (const match of text.matchAll(conditionalModuleAssignmentPattern)) {
    const targets = [];
    for (const literalMatch of match[2].matchAll(
      /['"](\.{1,2}\/[^'"]+)['"]/gu
    )) {
      targets.push({ kind: 'specifier', value: literalMatch[1] });
    }
    const pathResolvePattern =
      /path\.join\(\s*__dirname((?:\s*,\s*['"][^'"]+['"])*)\s*\)/gu;
    for (const pathMatch of match[2].matchAll(pathResolvePattern)) {
      const segments = [...pathMatch[1].matchAll(/['"]([^'"]+)['"]/gu)].map(
        (segment) => segment[1]
      );
      if (segments.length === 0) continue;
      targets.push({
        kind: 'path',
        value: normalizeRepositoryPath(
          path.posix.join(path.posix.dirname(sourcePath), ...segments)
        ),
      });
    }
    registerCandidateTargets(match[1], targets);
  }
  const literalModuleAssignmentPattern =
    /const\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*['"](\.{1,2}\/[^'"]+)['"]\s*;/gu;
  for (const match of text.matchAll(literalModuleAssignmentPattern)) {
    if (codeMask[match.index] !== 1) continue;
    registerCandidateTargets(match[1], [
      { kind: 'specifier', value: match[2] },
    ]);
  }
  const externalPathVariables = new Set();
  const externalTemporaryRootPattern =
    /const\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*fs\.mkdtempSync\s*\(\s*path\.join\s*\(\s*os\.tmpdir\s*\(\s*\)/gu;
  for (const match of text.matchAll(externalTemporaryRootPattern)) {
    if (codeMask[match.index] === 1) externalPathVariables.add(match[1]);
  }
  const externalPathJoinAssignmentPattern =
    /const\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*path\.join\s*\(\s*([A-Za-z_$][A-Za-z0-9_$]*)\s*,/gu;
  let externalPathVariablesChanged = true;
  while (externalPathVariablesChanged) {
    externalPathVariablesChanged = false;
    for (const match of text.matchAll(externalPathJoinAssignmentPattern)) {
      if (
        codeMask[match.index] === 1 &&
        externalPathVariables.has(match[2]) &&
        !externalPathVariables.has(match[1])
      ) {
        externalPathVariables.add(match[1]);
        externalPathVariablesChanged = true;
      }
    }
  }
  const relativeLoaderPrefixes = new Map();
  for (const loaderName of [
    'modulePath',
    'loadGoalContractModule',
    'loadPartitionModule',
  ]) {
    const loaderDeclarationPattern = new RegExp(
      String.raw`\bfunction\s+${loaderName}\s*\(\s*relativePath(?:\s*:\s*[^)]+)?\s*\)(?:\s*:\s*[^\r\n{]+)?\s*\{`,
      'u'
    );
    if (loaderDeclarationPattern.test(text)) {
      relativeLoaderPrefixes.set(
        loaderName,
        loaderName === 'modulePath' ? '' : '../'
      );
    }
  }
  const recordStaticRelation = ({
    kind,
    specifier,
    lineNumber,
    expression,
    evidenceText,
  }) => {
    const targetPath = resolveRepositorySpecifier({
      sourcePath,
      specifier,
      knownPaths,
    });
    if (!targetPath) {
      if (
        specifier.startsWith('.') &&
        !isExcludedRepositorySpecifier({
          sourcePath,
          specifier,
          policy,
        })
      ) {
        unsupportedRelationRecords.push(
          unsupportedRecord({
            sourcePath,
            line: lineNumber,
            relationClass: kind,
            expression,
          })
        );
      }
      return;
    }
    relationEdges.push(
      relationEdge({
        relationKind: kind,
        fromNodeId: sourceArtifact.artifactId,
        toNodeId: artifactByPath.get(targetPath).artifactId,
        evidencePath: sourcePath,
        line: lineNumber,
        evidenceText,
        provenanceKind: 'package_owned_static_parser',
      })
    );
  };
  const lineNumberAtOffset = (offset) =>
    text.slice(0, offset).split(/\r?\n/gu).length;
  if (
    sourcePath === 'packages/bmad-speckit/src/commands/goal-contract.ts' ||
    sourcePath ===
      'packages/bmad-speckit/src/utils/goal-contract/control-plane/authority-supersession.ts'
  ) {
    const loaderPattern =
      sourcePath === 'packages/bmad-speckit/src/commands/goal-contract.ts'
        ? /\bloadPartitionModule\s*\(\s*(['"])([^'"]+)\1\s*\)/gu
        : /\bloadGoalContractModule\s*\(\s*(['"])([^'"]+)\1\s*\)/gu;
    for (const match of text.matchAll(loaderPattern)) {
      if (codeMask[match.index] !== 1) continue;
      recordStaticRelation({
        kind: 'commonjs_require',
        specifier: `../${match[2]}`,
        lineNumber: lineNumberAtOffset(match.index),
        expression: match[0],
        evidenceText: match[0],
      });
    }
  }
  let lineOffset = 0;
  for (let index = 0; index < lines.length; index += 1) {
    const lineNumber = index + 1;
    const line = lines[index];
    for (const { kind, pattern } of patterns) {
      pattern.lastIndex = 0;
      for (const match of line.matchAll(pattern)) {
        if (codeMask[lineOffset + match.index] !== 1) continue;
        recordStaticRelation({
          kind,
          specifier: match[1],
          lineNumber,
          expression: match[0],
          evidenceText: line,
        });
      }
    }
    for (const match of line.matchAll(
      /\b(?:require|import)\s*\(\s*(?!['"])/gu
    )) {
      if (codeMask[lineOffset + match.index] !== 1) continue;
      const callOffset = lineOffset + match.index;
      const directDirnameTemplate = text
        .slice(callOffset)
        .match(
          /^require\s*\(\s*`\$\{__dirname\}([^`$]+)\$\{__filename\.endsWith\('\.ts'\)\s*\?\s*'\.ts'\s*:\s*''\}`\s*\)/u
        );
      if (directDirnameTemplate) {
        const suffix = directDirnameTemplate[1];
        recordStaticRelation({
          kind: 'commonjs_require',
          specifier: suffix.startsWith('/') ? `.${suffix}` : `./${suffix}`,
          lineNumber,
          expression: directDirnameTemplate[0],
          evidenceText: directDirnameTemplate[0],
        });
        continue;
      }
      const dirnameBranchCall = text
        .slice(callOffset)
        .match(
          /^require\s*\(\s*__filename\.endsWith\('\.ts'\)\s*\?\s*path\.join\(\s*__dirname((?:\s*,\s*['"][^'"]+['"])*)\s*\)\s*:\s*(['"])([^'"]+)\2\s*\)/u
        );
      if (dirnameBranchCall) {
        const trueSegments = [
          ...dirnameBranchCall[1].matchAll(/['"]([^'"]+)['"]/gu),
        ].map((segment) => segment[1]);
        if (trueSegments.length > 0) {
          recordStaticRelation({
            kind: 'commonjs_require',
            specifier: path.posix.join(...trueSegments),
            lineNumber,
            expression: dirnameBranchCall[0],
            evidenceText: dirnameBranchCall[0],
          });
        }
        recordStaticRelation({
          kind: 'commonjs_require',
          specifier: dirnameBranchCall[3],
          lineNumber,
          expression: dirnameBranchCall[0],
          evidenceText: dirnameBranchCall[0],
        });
        continue;
      }
      const staticTemplateCall = text
        .slice(callOffset)
        .match(
          /^require\s*\(\s*`([^`$]+)\$\{__filename\.endsWith\('\.ts'\)\s*\?\s*'\.ts'\s*:\s*''\}`\s*\)/u
        );
      if (staticTemplateCall) {
        recordStaticRelation({
          kind: 'commonjs_require',
          specifier: staticTemplateCall[1],
          lineNumber,
          expression: staticTemplateCall[0],
          evidenceText: staticTemplateCall[0],
        });
        continue;
      }
      const staticBranchCall = text
        .slice(callOffset)
        .match(
          /^require\s*\(\s*__filename\.endsWith\('\.ts'\)\s*\?\s*(['"])([^'"]+)\1\s*:\s*(['"])([^'"]+)\3\s*\)/u
        );
      if (staticBranchCall) {
        recordStaticRelation({
          kind: 'commonjs_require',
          specifier: staticBranchCall[2],
          lineNumber,
          expression: staticBranchCall[0],
          evidenceText: staticBranchCall[0],
        });
        continue;
      }
      const nestedLoaderCall = text
        .slice(callOffset)
        .match(
          /^require\s*\(\s*([A-Za-z_$][A-Za-z0-9_$]*)\s*\(\s*(['"])([^'"]+)\2\s*\)\s*\)/u
        );
      if (
        nestedLoaderCall &&
        relativeLoaderPrefixes.has(nestedLoaderCall[1])
      ) {
        recordStaticRelation({
          kind: 'commonjs_require',
          specifier: `${
            relativeLoaderPrefixes.get(nestedLoaderCall[1]) || ''
          }${nestedLoaderCall[3]}`,
          lineNumber,
          expression: nestedLoaderCall[0],
          evidenceText: nestedLoaderCall[0],
        });
        continue;
      }
      const candidateCall = text
        .slice(callOffset)
        .match(/^require\s*\(\s*([A-Za-z_$][A-Za-z0-9_$]*)\s*\)/u);
      if (
        candidateCall &&
        candidateTargetsByVariable.has(candidateCall[1])
      ) {
        const targetPath = candidateTargetsByVariable
          .get(candidateCall[1])
          .map((target) =>
            target.kind === 'path'
              ? artifactByPath.has(target.value)
                ? target.value
                : null
              : resolveRepositorySpecifier({
                  sourcePath,
                  specifier: target.value,
                  knownPaths,
                })
          )
          .find(Boolean);
        if (targetPath) {
          relationEdges.push(
            relationEdge({
              relationKind: 'commonjs_require',
              fromNodeId: sourceArtifact.artifactId,
              toNodeId: artifactByPath.get(targetPath).artifactId,
              evidencePath: sourcePath,
              line: lineNumber,
              evidenceText: candidateCall[0],
              provenanceKind: 'package_owned_static_parser',
            })
          );
        }
        continue;
      }
      const externalRuntimeModuleCall = text
        .slice(callOffset)
        .match(
          /^require\s*\(\s*path\.join\s*\(\s*([A-Za-z_$][A-Za-z0-9_$]*)\s*,/u
        );
      if (
        externalRuntimeModuleCall &&
        externalPathVariables.has(externalRuntimeModuleCall[1])
      ) {
        continue;
      }
      const staticCall = text
        .slice(callOffset)
        .match(/^(require|import)\s*\(\s*(['"])([^'"]+)\2\s*\)/u);
      if (staticCall) {
        recordStaticRelation({
          kind:
            staticCall[1] === 'require'
              ? 'commonjs_require'
              : 'dynamic_import_literal',
          specifier: staticCall[3],
          lineNumber,
          expression: staticCall[0],
          evidenceText: staticCall[0],
        });
        continue;
      }
      const expression = line.trim();
      if (
        isPackageOwnedGoalContractRuntimeLoader({
          sourcePath,
          text,
          expression,
        })
      ) {
        continue;
      }
      unsupportedRelationRecords.push(
        unsupportedRecord({
          sourcePath,
          line: lineNumber,
          relationClass: 'dynamic_module_specifier',
          expression,
        })
      );
    }
    const separatorOffset = lineOffset + line.length;
    const separatorLength = text.startsWith('\r\n', separatorOffset)
      ? 2
      : text[separatorOffset] === '\n' || text[separatorOffset] === '\r'
        ? 1
        : 0;
    lineOffset = separatorOffset + separatorLength;
  }
  return { relationEdges, unsupportedRelationRecords };
}

function jsonRelations({ sourcePath, text, artifactByPath }) {
  let document;
  try {
    document = JSON.parse(text);
  } catch {
    return {
      relationEdges: [],
      unsupportedRelationRecords: [],
    };
  }
  const sourceArtifact = artifactByPath.get(sourcePath);
  const relationEdges = [];
  const knownPaths = new Set(artifactByPath.keys());
  const visit = (value, keyPath = []) => {
    if (Array.isArray(value)) {
      value.forEach((item, index) => visit(item, [...keyPath, index]));
      return;
    }
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      if (
        typeof child === 'string' &&
        (key === '$ref' ||
          [
            'main',
            'module',
            'types',
            'bin',
            'files',
            'extends',
          ].includes(key) ||
          key === 'path')
      ) {
        const specifier = child.split('#')[0];
        const targetPath = resolveRepositorySpecifier({
          sourcePath,
          specifier: specifier.startsWith('.')
            ? specifier
            : `./${specifier}`,
          knownPaths,
        });
        if (targetPath) {
          relationEdges.push(
            relationEdge({
              relationKind:
                key === '$ref'
                  ? 'json_schema_ref'
                  : key === 'path'
                    ? 'canonical_asset_path'
                    : sourcePath.includes('tsconfig')
                      ? 'tsconfig_path'
                      : 'json_manifest_path',
              fromNodeId: sourceArtifact.artifactId,
              toNodeId: artifactByPath.get(targetPath).artifactId,
              evidencePath: sourcePath,
              line: 1,
              evidenceText: `${keyPath.join('.')}.${key}=${child}`,
              provenanceKind: 'package_owned_json_parser',
            })
          );
        }
      }
      visit(child, [...keyPath, key]);
    }
  };
  visit(document);
  return { relationEdges, unsupportedRelationRecords: [] };
}

function compileArtifactRelations({
  enumeration,
  artifactNodes,
  policy,
}) {
  const artifactByPath = new Map(
    artifactNodes.map((artifact) => [artifact.path, artifact])
  );
  const relationEdges = [];
  const unsupportedRelationRecords = [];
  for (const [sourcePath, file] of enumeration.files) {
    if (!artifactByPath.has(sourcePath)) continue;
    if (!file.bytes) continue;
    const extension = path.posix.extname(sourcePath).toLowerCase();
    const text = file.bytes.toString('utf8');
    const result =
      extension === '.json'
        ? jsonRelations({ sourcePath, text, artifactByPath })
        : [
              '.ts',
              '.tsx',
              '.mts',
              '.cts',
              '.js',
              '.jsx',
              '.mjs',
              '.cjs',
            ].includes(extension)
          ? javascriptRelations({
              sourcePath,
              text,
              artifactByPath,
              policy,
            })
          : { relationEdges: [], unsupportedRelationRecords: [] };
    relationEdges.push(...result.relationEdges);
    unsupportedRelationRecords.push(
      ...result.unsupportedRelationRecords
    );
  }
  return { relationEdges, unsupportedRelationRecords };
}

function assertClosureRelevantCoverage({
  artifactNodes,
  relationEdges,
  unsupportedRelationRecords,
}) {
  const artifactById = new Map(
    artifactNodes.map((artifact) => [artifact.artifactId, artifact])
  );
  const incomingArtifactIds = new Map(
    artifactNodes.map((artifact) => [artifact.artifactId, []])
  );
  for (const edge of relationEdges) {
    if (
      artifactById.has(edge.fromNodeId) &&
      artifactById.has(edge.toNodeId)
    ) {
      incomingArtifactIds
        .get(edge.toNodeId)
        .push(edge.fromNodeId);
    }
  }
  const reachedArtifactIds = new Set(
    artifactNodes
      .filter((artifact) => artifact.mutable)
      .map((artifact) => artifact.artifactId)
  );
  const queue = [...reachedArtifactIds].sort(compareIds);
  while (queue.length > 0) {
    const currentArtifactId = queue.shift();
    for (const consumerArtifactId of unique(
      incomingArtifactIds.get(currentArtifactId) || []
    )) {
      if (reachedArtifactIds.has(consumerArtifactId)) continue;
      reachedArtifactIds.add(consumerArtifactId);
      queue.push(consumerArtifactId);
      queue.sort(compareIds);
    }
  }
  const reachedArtifacts = [...reachedArtifactIds]
    .map((artifactIdValue) => artifactById.get(artifactIdValue))
    .filter(Boolean)
    .sort((left, right) => compareIds(left.path, right.path));
  const missingOwner = reachedArtifacts.find(
    (artifact) =>
      typeof artifact.ownerPartitionId !== 'string' ||
      artifact.ownerPartitionId.length === 0
  );
  if (missingOwner) {
    throw failure('partition_impact_owner_missing', {
      artifactPath: missingOwner.path,
      artifactId: missingOwner.artifactId,
    });
  }
  const reachedPaths = new Set(
    reachedArtifacts.map((artifact) => artifact.path)
  );
  const unsupported = unsupportedRelationRecords.find((record) =>
    reachedPaths.has(record.sourcePath)
  );
  if (unsupported) {
    throw failure('partition_impact_coverage_incomplete', {
      ...unsupported,
    });
  }
  return reachedPaths;
}

function commandArtifactPaths(literal, artifactByPath) {
  const paths = [];
  const tokenPattern =
    /(?:^|\s)(?:["']([^"']+\.[A-Za-z0-9]+)["']|([^\s"'`]+\.[A-Za-z0-9]+))/gu;
  for (const match of literal.matchAll(tokenPattern)) {
    const candidate = String(match[1] || match[2] || '')
      .replace(/[),;]+$/u, '')
      .replace(/\\/gu, '/');
    if (!candidate || path.posix.isAbsolute(candidate)) continue;
    let normalized;
    try {
      normalized = normalizeRepositoryPath(candidate);
    } catch {
      continue;
    }
    if (artifactByPath.has(normalized)) paths.push(normalized);
  }
  return unique(paths);
}

function compileCommandAuthority({
  reconciledGraph,
  commandOwnerById,
  artifactNodes,
}) {
  const artifactByPath = new Map(
    artifactNodes.map((artifact) => [artifact.path, artifact])
  );
  const commandRecords = new Map();
  const commands = reconciledGraph?.commands || {};
  for (const kind of COMMAND_KINDS) {
    for (const record of commands[kind] || []) {
      if (!record || typeof record !== 'object') {
        throw failure('partition_impact_coverage_incomplete', {
          reason: 'command_record_invalid',
          commandKind: kind,
        });
      }
      const existing = commandRecords.get(record.id);
      if (
        existing &&
        stableControlPlaneStringify(existing.record) !==
          stableControlPlaneStringify(record)
      ) {
        throw failure('partition_impact_coverage_incomplete', {
          reason: 'command_record_conflict',
          commandId: record.id,
        });
      }
      commandRecords.set(record.id, { kind, record });
    }
  }
  const commandNodes = [];
  const relationEdges = [];
  for (const [commandId, commandOwnerPartitionId] of [
    ...commandOwnerById.entries(),
  ].sort(([left], [right]) => compareIds(left, right))) {
    const entry = commandRecords.get(commandId);
    if (!entry) {
      throw failure('partition_impact_coverage_incomplete', {
        reason: 'command_record_missing',
        commandId,
      });
    }
    const { kind, record } = entry;
    if (
      typeof record.literal !== 'string' ||
      !HASH_PATTERN.test(String(record.commandTextHash || '')) ||
      record.commandTextHash !==
        sha256Buffer(Buffer.from(record.literal, 'utf8'))
    ) {
      throw failure('partition_impact_coverage_incomplete', {
        reason: 'command_identity_invalid',
        commandId,
      });
    }
    const targetPaths = commandArtifactPaths(
      record.literal,
      artifactByPath
    );
    const targetArtifactIds = targetPaths.map(
      (targetPath) => artifactByPath.get(targetPath).artifactId
    );
    const testArtifactIds = /\b(?:--test|vitest|jest|playwright)\b/u.test(
      record.literal
    )
      ? targetArtifactIds
      : [];
    commandNodes.push({
      commandId,
      commandKind: kind,
      commandOwnerPartitionId,
      commandTextHash: record.commandTextHash,
      workingDirectory: String(record.workingDirectory || ''),
      shell: String(record.shell || ''),
      runtime: String(record.runtime || ''),
      executableArtifactId: null,
      testArtifactIds,
      targetArtifactIds,
      scriptExpansionChain: [],
      sourceBindingHash: hashControlPlaneValue(
        record.sourceBinding || {}
      ),
    });
    for (const targetPath of targetPaths) {
      relationEdges.push(
        relationEdge({
          relationKind: 'command_artifact',
          fromNodeId: `command:${commandId}`,
          toNodeId: artifactByPath.get(targetPath).artifactId,
          evidencePath: String(
            record.sourceBinding?.sourcePlanPath || 'source-authority'
          ),
          line: Number(record.sourceBinding?.lineStart || 1),
          evidenceText: record.literal,
          provenanceKind: 'typed_command_authority',
        })
      );
    }
  }
  return { commandNodes, relationEdges };
}

function partitionNodes(planBasis, artifactNodes) {
  const artifactByPath = new Map(
    artifactNodes.map((artifact) => [artifact.path, artifact])
  );
  return planBasis.partitions.map((partition, topologicalIndex) => ({
    partitionId: partition.partitionId,
    topologicalIndex,
    dependencyPartitionIds: partition.dependencyPartitionIds,
    ownedArtifactIds: partition.ownedArtifactPaths.map(
      (artifactPath) => artifactByPath.get(artifactPath).artifactId
    ),
    commandIds: partition.commandIds,
  }));
}

function validateImpactGraph(graph, packageRoot) {
  try {
    validateGoalContractSchema(
      'goal-contract-partition-impact-graph.schema.json',
      graph,
      { packageRoot }
    );
  } catch (error) {
    throw failure('partition_impact_graph_schema_invalid', {
      validationErrors: error.validationErrors || [],
    });
  }
}

function compilePartitionImpactGraph(input = {}) {
  assertNoAuthorityInjection(input);
  const repositoryRoot = path.resolve(
    input.repositoryRoot || process.cwd()
  );
  const partitionPlan = input.partitionPlan;
  if (!partitionPlan || typeof partitionPlan !== 'object') {
    throw failure('partition_impact_authority_invalid', {
      field: 'partitionPlan',
    });
  }
  const sourceSnapshotHash = assertHash(
    partitionPlan.orderedSourceSnapshotSetHash,
    'orderedSourceSnapshotSetHash'
  );
  const sourceObligationGraphHash = assertHash(
    partitionPlan.canonicalIntentSemanticHash,
    'canonicalIntentSemanticHash'
  );
  const executionProjectionHash = assertHash(
    partitionPlan.executionProjectionHash,
    'executionProjectionHash'
  );
  const policy = loadPartitionImpactPolicy({
    packageRoot: input.packageRoot,
  });
  const planBasis = canonicalPlanBasis(partitionPlan);
  const partitionPlanBasisHash = hashControlPlaneValue(planBasis);
  const { ownerByPath, commandOwnerById } = ownerState(planBasis);
  const enumeration = enumerateRepositoryFacts({
    repositoryRoot,
    policy,
    requiredPaths: [...ownerByPath.keys()],
  });
  const artifactNodes = buildArtifactNodes({
    enumeration,
    ownerByPath,
  });
  const artifactRelations = compileArtifactRelations({
    enumeration,
    artifactNodes,
    policy,
  });
  assertClosureRelevantCoverage({
    artifactNodes,
    relationEdges: artifactRelations.relationEdges,
    unsupportedRelationRecords:
      artifactRelations.unsupportedRelationRecords,
  });
  const commandAuthority = compileCommandAuthority({
    reconciledGraph: input.reconciledGraph,
    commandOwnerById,
    artifactNodes,
  });
  const canonicalEdges = [
    ...artifactRelations.relationEdges,
    ...commandAuthority.relationEdges,
  ]
    .sort((left, right) => compareIds(left.edgeId, right.edgeId))
    .filter(
      (edge, index, edges) =>
        index === 0 || edge.edgeId !== edges[index - 1].edgeId
    );
  if (canonicalEdges.length > policy.maxResolvedEdges) {
    throw failure('partition_impact_scan_limit_exceeded', {
      limit: 'maxResolvedEdges',
    });
  }
  const unsupportedRelationRecords =
    artifactRelations.unsupportedRelationRecords
      .sort((left, right) =>
        compareIds(
          `${left.sourcePath}|${left.line}|${left.expressionHash}`,
          `${right.sourcePath}|${right.line}|${right.expressionHash}`
        )
      )
      .slice(0, policy.maxDiagnosticRecords);
  const semanticGraph = {
    schemaVersion: 'goal-contract-partition-impact-graph/v1',
    enumerationMode: enumeration.enumerationMode,
    repositoryTreeHash: enumeration.repositoryTreeHash,
    repositoryFactsHash: enumeration.repositoryFactsHash,
    partitionImpactPolicyHash: policy.partitionImpactPolicyHash,
    analyzerIdentityHash: hashControlPlaneValue({
      analyzerId: policy.analyzerId,
      analyzerVersion: policy.analyzerVersion,
      supportedRelationKinds: policy.supportedRelationKinds,
    }),
    sourceSnapshotHash,
    sourceObligationGraphHash,
    executionProjectionHash,
    partitionPlanBasisHash,
    artifactNodes: artifactNodes.sort((left, right) =>
      compareIds(left.artifactId, right.artifactId)
    ),
    commandNodes: commandAuthority.commandNodes.sort((left, right) =>
      compareIds(left.commandId, right.commandId)
    ),
    partitionNodes: partitionNodes(
      planBasis,
      artifactNodes
    ),
    relationEdges: canonicalEdges,
    unsupportedRelationRecords,
    graphStatistics: {
      ...enumeration.statistics,
      artifactNodeCount: artifactNodes.length,
      commandNodeCount: commandAuthority.commandNodes.length,
      partitionNodeCount: planBasis.partitions.length,
      relationEdgeCount: canonicalEdges.length,
      unsupportedRelationCount:
        artifactRelations.unsupportedRelationRecords.length,
    },
  };
  const graph = {
    ...semanticGraph,
    impactGraphHash: hashControlPlaneValue(semanticGraph),
  };
  validateImpactGraph(graph, input.packageRoot);
  return deepFreeze(graph);
}

function verifyPartitionImpactGraph(input = {}) {
  const graph = input.graph;
  if (!graph || typeof graph !== 'object' || Array.isArray(graph)) {
    throw failure('partition_impact_graph_missing');
  }
  const { impactGraphHash: declaredHash, ...semanticGraph } = graph;
  if (
    !HASH_PATTERN.test(String(declaredHash || '')) ||
    declaredHash !== hashControlPlaneValue(semanticGraph)
  ) {
    throw failure('partition_impact_graph_hash_mismatch');
  }
  const { graph: _ignored, ...compileInput } = input;
  const current = compilePartitionImpactGraph(compileInput);
  if (
    stableControlPlaneStringify(current) !==
    stableControlPlaneStringify(graph)
  ) {
    throw failure('partition_impact_graph_stale', {
      expectedImpactGraphHash: current.impactGraphHash,
      actualImpactGraphHash: graph.impactGraphHash,
    });
  }
  return Object.freeze({
    decision: 'pass',
    impactGraphHash: graph.impactGraphHash,
  });
}

module.exports = {
  canonicalPartitionImpactPlanBasis: canonicalPlanBasis,
  compilePartitionImpactGraph,
  verifyPartitionImpactGraph,
};
