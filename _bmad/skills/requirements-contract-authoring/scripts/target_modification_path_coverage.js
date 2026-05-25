const path = require('node:path');

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function stringList(value) {
  return Array.isArray(value) ? value.map((item) => String(item)).filter(Boolean) : [];
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function normalizePathForReport(value) {
  return String(value ?? '').trim().replace(/\\/g, '/');
}

function refsForRow(row, keys) {
  return unique(keys.flatMap((key) => stringList(row?.[key])));
}

function commandId(row) {
  return String(row?.id ?? row?.commandId ?? '').trim();
}

function commandRefsForTrace(row) {
  return unique([
    ...stringList(row?.contractValidationCommandRefs),
    ...stringList(row?.deliveryEvidenceCommandRefs),
    ...stringList(row?.commandRefs),
  ]);
}

function extractPathRefs(command) {
  const refs = new Set();
  const normalized = String(command ?? '').replace(/\r?\n/gu, ' ');
  const matches = normalized.matchAll(
    /(?<![A-Za-z0-9_@.-])((?:[A-Za-z]:)?[./\\A-Za-z0-9_-][A-Za-z0-9_./\\-]*\.(?:test|spec)\.(?:tsx|ts|jsx|js|mjs|cjs)|[./\\A-Za-z0-9_-][A-Za-z0-9_./\\-]*\.(?:tsx|ts|jsx|json|mjs|cjs|js|ya?ml|md|txt))(?=$|[^A-Za-z0-9_.-])/giu
  );
  for (const match of matches) {
    const ref = match[1];
    if (/[\\/]/u.test(ref) || /\.(?:test|spec)\./iu.test(ref)) refs.add(normalizePathForReport(ref));
  }
  return [...refs];
}

function targetPathClassification(row) {
  return [
    row?.coverageRole,
    row?.targetPathRole,
    row?.pathRole,
    row?.classification,
    row?.changeType,
    row?.artifactType,
  ]
    .map((value) => String(value ?? '').trim())
    .find(Boolean)
    ?.toLowerCase() ?? '';
}

function isNonModificationTarget(row) {
  const role = targetPathClassification(row);
  return [
    'validation_only',
    'validation-only',
    'generated_output',
    'generated-output',
    'runtime_output',
    'runtime-output',
    'generated',
    'output',
  ].includes(role);
}

function isExplicitModificationTarget(row) {
  const role = targetPathClassification(row);
  return ['modify', 'add', 'create', 'delete', 'remove', 'update', 'replace'].includes(role);
}

function isRepoLikePath(value) {
  const normalized = normalizePathForReport(value);
  if (!normalized) return false;
  if (/^[a-z]+:\/\//iu.test(normalized)) return false;
  if (/^model_packet\.json\./u.test(normalized)) return false;
  if (/^[A-Za-z][A-Za-z0-9_ -]*$/u.test(normalized)) return false;
  return (
    normalized.includes('/') ||
    /\.(?:ts|tsx|js|jsx|mjs|cjs|py|md|json|ya?ml|txt|html|css|svg)$/iu.test(normalized)
  );
}

function artifactPathRequiresCoverage(item) {
  const sourceRole = String(item?.sourceOfTruthRole ?? '').trim();
  return (
    item?.canAffectControlFlow === true ||
    sourceRole === 'implementation' ||
    /_(?:oracle|surface|standard)$/iu.test(sourceRole)
  );
}

function pushRequired(required, row) {
  const pathValue = normalizePathForReport(row.path);
  if (!pathValue || !isRepoLikePath(pathValue)) return;
  const existing = required.get(pathValue);
  if (existing) {
    existing.sources = unique([...existing.sources, ...row.sources]);
    existing.refs = unique([...existing.refs, ...row.refs]);
    existing.traceRefs = unique([...existing.traceRefs, ...row.traceRefs]);
    existing.evidenceRefs = unique([...existing.evidenceRefs, ...row.evidenceRefs]);
    existing.artifactRefs = unique([...existing.artifactRefs, ...row.artifactRefs]);
    if (row.requiresExplicitModification) existing.requiresExplicitModification = true;
    return;
  }
  required.set(pathValue, {
    path: pathValue,
    reason: row.reason,
    sources: unique(row.sources),
    refs: unique(row.refs),
    traceRefs: unique(row.traceRefs),
    evidenceRefs: unique(row.evidenceRefs),
    artifactRefs: unique(row.artifactRefs),
    requiresExplicitModification: Boolean(row.requiresExplicitModification),
  });
}

function buildCommandIndex(confirmation) {
  const commandRows = [...asArray(confirmation?.requiredCommands), ...asArray(confirmation?.suggestedCommands)];
  const traceRows = asArray(confirmation?.traceRows);
  const traceRowsByCommand = new Map();
  for (const trace of traceRows) {
    for (const ref of commandRefsForTrace(trace)) {
      if (!traceRowsByCommand.has(ref)) traceRowsByCommand.set(ref, []);
      traceRowsByCommand.get(ref).push(trace);
    }
  }
  return { commandRows, traceRowsByCommand };
}

function collectRequiredTargetPaths(confirmation, artifactPlan = []) {
  const required = new Map();
  const { commandRows, traceRowsByCommand } = buildCommandIndex(confirmation);

  for (const item of asArray(artifactPlan)) {
    if (!artifactPathRequiresCoverage(item)) continue;
    pushRequired(required, {
      path: item.path,
      reason: 'artifact_requires_target_path_coverage',
      sources: ['artifactAutomationPlan'],
      refs: [item.artifactId ?? item.id].filter(Boolean),
      traceRefs: refsForRow(item, ['traceRows', 'traceRefs']),
      evidenceRefs: refsForRow(item, ['evidenceRefs', 'linkedEvidenceIds']),
      artifactRefs: [item.artifactId ?? item.id].filter(Boolean),
      requiresExplicitModification: true,
    });
  }

  for (const command of commandRows) {
    const id = commandId(command);
    const linkedTraceRows = traceRowsByCommand.get(id) ?? [];
    const traceRefs = unique([...refsForRow(command, ['traceRows', 'traceRefs']), ...linkedTraceRows.map((trace) => trace.id)]);
    const evidenceRefs = unique([
      ...refsForRow(command, ['evidenceRefs', 'linkedEvidenceIds']),
      ...linkedTraceRows.flatMap((trace) => stringList(trace.evidenceRefs)),
    ]);
    const files = unique([...stringList(command.targetFiles), ...extractPathRefs(command.command)]);
    for (const file of files) {
      pushRequired(required, {
        path: file,
        reason: 'command_target_file_requires_target_path_coverage',
        sources: ['requiredCommands.targetFiles'],
        refs: [id].filter(Boolean),
        traceRefs,
        evidenceRefs,
        artifactRefs: [],
        requiresExplicitModification: false,
      });
    }
  }

  const currentTargetMap = confirmation?.currentTargetMap ?? {};
  const currentTargetRows = [
    ...asArray(currentTargetMap.artifactPaths).map((row) => ({
      path: row.path,
      source: 'currentTargetMap.artifactPaths',
      traceRefs: refsForRow(row, ['traceRows', 'traceRefs']),
      evidenceRefs: refsForRow(row, ['evidenceRefs', 'linkedEvidenceIds']),
    })),
    ...asArray(currentTargetMap.pathRegistry).map((row) => ({
      path: row.path ?? row.fixedPath,
      source: 'currentTargetMap.pathRegistry',
      traceRefs: refsForRow(row, ['traceRows', 'traceRefs']),
      evidenceRefs: refsForRow(row, ['evidenceRefs', 'linkedEvidenceIds']),
    })),
    ...asArray(currentTargetMap.scriptConvergence).map((row) => ({
      path: row.scriptOrConfigPath,
      source: 'currentTargetMap.scriptConvergence',
      traceRefs: refsForRow(row, ['traceRows', 'traceRefs']),
      evidenceRefs: refsForRow(row, ['evidenceRefs', 'linkedEvidenceIds']),
    })),
  ];
  for (const row of currentTargetRows) {
    pushRequired(required, {
      path: row.path,
      reason: 'current_target_path_requires_target_path_coverage',
      sources: [row.source],
      refs: [],
      traceRefs: row.traceRefs,
      evidenceRefs: row.evidenceRefs,
      artifactRefs: [],
      requiresExplicitModification: false,
    });
  }

  return [...required.values()].sort((a, b) => a.path.localeCompare(b.path));
}

function evaluateTargetModificationPathCoverage(confirmation, targetModificationPaths = [], artifactPlan = []) {
  const required = collectRequiredTargetPaths(confirmation, artifactPlan);
  const targetRows = asArray(targetModificationPaths)
    .filter((row) => row?.sourceSection !== 'artifactAutomationPlan.derived')
    .map((row) => ({
      ...row,
      path: normalizePathForReport(row?.path),
    }));
  const targetPathSet = new Set(targetRows.map((row) => row.path).filter(Boolean));
  const nonModificationPathSet = new Set(targetRows.filter(isNonModificationTarget).map((row) => row.path).filter(Boolean));
  const modificationPathSet = new Set(targetRows.filter(isExplicitModificationTarget).map((row) => row.path).filter(Boolean));
  const missing = required
    .filter((item) => !targetPathSet.has(item.path))
    .map((item) => ({
      ...item,
      allowedClassifications: item.requiresExplicitModification
        ? []
        : ['validation_only', 'generated_output', 'runtime_output'],
    }));
  const unclassified = required
    .filter(
      (item) =>
        targetPathSet.has(item.path) &&
        !item.requiresExplicitModification &&
        !nonModificationPathSet.has(item.path) &&
        !modificationPathSet.has(item.path)
    )
    .map((item) => ({
      ...item,
      allowedClassifications: ['validation_only', 'generated_output', 'runtime_output'],
    }));
  return {
    required,
    missing,
    unclassified,
    ready: missing.length === 0 && unclassified.length === 0,
    counts: {
      required: required.length,
      targetRows: targetRows.length,
      missing: missing.length,
      unclassified: unclassified.length,
    },
  };
}

module.exports = {
  collectRequiredTargetPaths,
  evaluateTargetModificationPathCoverage,
  normalizePathForReport,
};
