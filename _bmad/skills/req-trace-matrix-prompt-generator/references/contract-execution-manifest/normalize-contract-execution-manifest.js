const CANONICAL_SCHEMA_VERSION = 'contract-execution-manifest/v1';
const CANONICAL_BUILDER_VERSION = 'contract-execution-manifest-builder/v1';
const CANONICAL_COMMAND_TARGET_FIELD = 'commandTargetCollection';

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function objects(value) {
  return Array.isArray(value) ? value.filter(isObject) : [];
}

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function strings(value) {
  return Array.isArray(value) ? value.map(text).filter(Boolean) : [];
}

function isTestFileRef(value) {
  const normalized = text(value).replace(/\\/gu, '/').toLowerCase();
  const fileName = normalized.split('/').pop() ?? '';
  if (!/\.(?:py|tsx?|jsx?|mjs|cjs|java|kt|go|rs|cs|rb|php|feature)$/u.test(fileName)) {
    return false;
  }
  return (
    /(?:^|\/)(?:tests?|__tests__)(?:\/|$)/u.test(normalized) ||
    /(?:^|[._-])(?:test|spec)(?:[._-]|$)/u.test(fileName)
  );
}

function extractCommandFileRefs(command) {
  const refs = new Set();
  const tokens = text(command).replace(/\r?\n/gu, ' ').match(/"[^"]+"|'[^']+'|\S+/gu) ?? [];
  for (const token of tokens) {
    const ref = token.replace(/^['"]|['"]$/gu, '');
    if (/(?:^|[\\/])[^\\/]+\.(?:py|tsx|ts|jsx|json|mjs|cjs|js|ya?ml|md)$/iu.test(ref)) {
      refs.add(ref.replace(/\\/gu, '/'));
    }
  }
  return [...refs];
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (!value || typeof value !== 'object') return JSON.stringify(value);
  const entries = Object.entries(value)
    .filter(([, item]) => item !== undefined)
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0));
  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(',')}}`;
}

function equivalent(left, right) {
  return stableStringify(left) === stableStringify(right);
}

function equivalentCommandTargetAliases(commandTargets, commandTargetCollection) {
  if (equivalent(commandTargets, commandTargetCollection)) return true;
  if (!Array.isArray(commandTargets) || !isObject(commandTargetCollection)) return false;
  if (
    commandTargets.length === 0 ||
    !commandTargets.every((value) => typeof value === 'string' && text(value))
  ) {
    return false;
  }
  const canonicalRefs = strings(
    commandTargetCollection.requiredCommandRefs ?? commandTargetCollection.commandRefs
  );
  if (canonicalRefs.length === 0) return false;
  const legacySet = [...new Set(commandTargets.map(text))].sort();
  const canonicalSet = [...new Set(canonicalRefs)].sort();
  return equivalent(legacySet, canonicalSet);
}

function normalizeRequiredCommands(manifest, confirmation) {
  const existing = objects(manifest.requiredCommands);
  if (existing.length > 0) return existing;
  return objects(confirmation.requiredCommands).map((row) => ({
    id: text(row.id ?? row.commandId),
    command: text(row.command),
    role: text(row.role) || text(row.commandRole) || text(row.gate),
    expectedMode: text(row.expectedMode) || text(row.expectedExitCodeAfterImplementation),
    files: [
      ...extractCommandFileRefs(row.command),
      text(row.file),
      text(row.path),
      text(row.testFile),
      text(row.testPath),
      ...strings(row.files),
      ...strings(row.testFiles),
      ...strings(row.targetFiles).filter(isTestFileRef),
    ].filter(Boolean),
    traceRefs: strings(row.traceRows).concat(strings(row.traceRefs)),
    evidenceRefs: strings(row.evidenceRefs),
  }));
}

function normalizeCommandTargets(manifest, audit) {
  const commandTargets = manifest.commandTargets;
  const commandTargetCollection = manifest.commandTargetCollection;
  if (commandTargets !== undefined) audit.aliasesUsed.push('commandTargets');
  if (commandTargetCollection !== undefined) audit.aliasesUsed.push('commandTargetCollection');
  if (commandTargets !== undefined && commandTargetCollection !== undefined) {
    if (!equivalentCommandTargetAliases(commandTargets, commandTargetCollection)) {
      audit.blockingReasons.push(
        'MANIFEST_ALIAS_CONFLICT:commandTargets:commandTargetCollection'
      );
    }
    return commandTargetCollection;
  }
  return commandTargetCollection ?? commandTargets;
}

function normalizeContractExecutionManifest(input) {
  const activeV2 = input.sourceFormatVersion === 'v2';
  const confirmation = input.confirmation ?? {};
  const sourceProjection = isObject(confirmation.aiTddContractExecutionManifestProjection)
    ? confirmation.aiTddContractExecutionManifestProjection
    : {};
  const audit = {
    aliasesUsed: [],
    blockingReasons: [],
  };
  const base = {
    ...sourceProjection,
    ...(input.manifest ?? {}),
  };
  if (activeV2) {
    delete base.currentTargetMap;
    delete base.currentTargetMapRefs;
  }
  const commandTargetCollection = normalizeCommandTargets(base, audit);
  const normalized = {
    ...base,
    schemaVersion: CANONICAL_SCHEMA_VERSION,
    builderVersion: input.builderVersion ?? CANONICAL_BUILDER_VERSION,
    requiredSections: strings(base.requiredSections),
    requiredCommands: normalizeRequiredCommands(base, confirmation),
  };
  delete normalized.commandTargets;
  if (commandTargetCollection !== undefined) {
    normalized[CANONICAL_COMMAND_TARGET_FIELD] = commandTargetCollection;
  }
  if (!activeV2 && !normalized.currentTargetMap && confirmation.currentTargetMap) {
    normalized.currentTargetMap = confirmation.currentTargetMap;
  }
  return { manifest: normalized, audit };
}

module.exports = {
  CANONICAL_BUILDER_VERSION,
  CANONICAL_COMMAND_TARGET_FIELD,
  CANONICAL_SCHEMA_VERSION,
  normalizeContractExecutionManifest,
};
