function normalizeText(value: unknown): string {
  return String(value ?? '').trim();
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  return `{${Object.keys(value)
    .sort()
    .map(
      (key) =>
        `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`
    )
    .join(',')}}`;
}

function recordObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asRecordArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is Record<string, unknown> =>
          Boolean(item) && typeof item === 'object' && !Array.isArray(item)
      )
    : [];
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}

function uniqueNonEmpty(values: unknown[]): string[] {
  return [...new Set(values.map(normalizeText).filter(Boolean))];
}

function splitMustOracleSimilarity(left: string, right: string): number {
  const bigrams = (text: string): Set<string> => {
    const chars = Array.from(
      normalizeText(text)
        .normalize('NFKC')
        .toLocaleLowerCase('en-US')
        .replace(/[^\p{L}\p{N}]/gu, '')
    );
    return new Set(chars.slice(1).map((char, index) => `${chars[index]}${char}`));
  };
  const source = bigrams(left);
  const task = bigrams(right);
  if (source.size === 0 || task.size === 0) return 0;
  return (2 * [...source].filter((part) => task.has(part)).length) / (source.size + task.size);
}

function splitMustOracleConstraintsMatch(
  left: string,
  right: string,
  sourceMustText: string
): boolean {
  const significantLiterals = (value: string): string[] => {
    const text = normalizeText(value).normalize('NFKC');
    return [
      ...new Set([
        ...(text.match(/(?<![\p{L}\p{N}])[-+]?\d+(?:\.\d+)?/gu) ?? []),
        ...(text.match(/\b[A-Z][A-Z0-9_]{2,}\b/gu) ?? []),
        ...[...text.matchAll(/`([^`]+)`/gu)].map((match) => match[1]),
      ]),
    ].sort();
  };
  const asciiWords = (value: string): Set<string> =>
    new Set(
      (normalizeText(value).normalize('NFKC').match(/[a-z][a-z0-9_-]*/giu) ?? []).map((word) =>
        word.toLowerCase()
      )
    );
  const sourceWords = asciiWords(sourceMustText);
  const replacementWords = asciiWords(left);
  const oracleWords = asciiWords(right);
  const hasNegation = (value: string): boolean =>
    /不得|禁止|不允许|不能|不应|不准|没有|不可|\bno\b|\bnone\b|\bnot\b|\bnever\b|\bwithout\b|\bcannot\b|\bneither\b/iu.test(
      value
    );
  const negatedClause = (value: string): string =>
    normalizeText(value)
      .normalize('NFKC')
      .toLocaleLowerCase('en-US')
      .replace(/[/／]/gu, '或')
      .replace(/[^\p{L}\p{N}()]/gu, '');
  return (
    stableStringify(significantLiterals(left)) === stableStringify(significantLiterals(right)) &&
    hasNegation(left) === hasNegation(right) &&
    (!hasNegation(left) || negatedClause(left) === negatedClause(right)) &&
    [...oracleWords].every((word) => replacementWords.has(word)) &&
    [...replacementWords].every((word) => oracleWords.has(word) || sourceWords.has(word))
  );
}

export function rebindSplitMustProjectionMetadata(
  confirmation: Record<string, unknown>,
  split: {
    sourceMustRef: string;
    sourceMustText: string;
    replacements: Array<{ mustId: string; text: string }>;
  }
):
  | { ok: true; confirmation: Record<string, unknown>; changedFields: string[] }
  | { ok: false; reason: string } {
  const sourceMustRef = normalizeText(split.sourceMustRef);
  const replacements = split.replacements;
  const fail = (reason: string): { ok: false; reason: string } => ({ ok: false, reason });
  const atoms = asRecordArray(confirmation.atomicImplementationTaskList).filter(
    (row) => normalizeText(row.derivedFromMustRef) === sourceMustRef
  );
  const ids = replacements.map((row) => normalizeText(row.mustId));
  const mustRowsById = new Map(
    asRecordArray(confirmation.must).map((row) => [normalizeText(row.id), row] as const)
  );
  if (
    !normalizeText(split.sourceMustText) ||
    replacements.length < 2 ||
    atoms.length !== replacements.length ||
    ids.some((id) => !id) ||
    new Set(ids).size !== ids.length ||
    !ids.includes(sourceMustRef) ||
    replacements.some(
      (row) =>
        !normalizeText(row.text) ||
        normalizeText(mustRowsById.get(normalizeText(row.mustId))?.text) !== normalizeText(row.text)
    )
  ) {
    return fail('Split MUST replacements must have a one-to-one source-bound atomic task inventory.');
  }

  const assigned = new Map<string, string>();
  for (const replacement of replacements) {
    const scores = atoms
      .map((atom) => {
        const oracle =
          asStringArray(atom.primaryAcceptanceOracles)[0] ||
          asStringArray(atom.primaryObservableBehaviors)[0] ||
          normalizeText(atom.text);
        return {
          id: normalizeText(atom.id),
          score: splitMustOracleConstraintsMatch(replacement.text, oracle, split.sourceMustText)
            ? splitMustOracleSimilarity(replacement.text, oracle)
            : 0,
        };
      })
      .sort((left, right) => right.score - left.score);
    if (
      !scores[0]?.id ||
      scores[0].score < 0.8 ||
      scores[0].score - (scores[1]?.score ?? 0) < 0.12 ||
      assigned.has(scores[0].id)
    ) {
      return fail(`Split MUST ${replacement.mustId} has no unique source-backed atomic oracle.`);
    }
    assigned.set(scores[0].id, replacement.mustId);
  }

  const existingTasks = asRecordArray(confirmation.implementationTasks);
  const matrix = asRecordArray(confirmation.mustExecutionDecompositionMatrix);
  const sourceMatrix = matrix.filter((row) => normalizeText(row.mustRef) === sourceMustRef);
  const mustTaskMap = recordObject(confirmation.mustToAtomicTaskMap);
  if (
    existingTasks.filter((row) => assigned.has(normalizeText(row.id))).length !== assigned.size ||
    sourceMatrix.length !== 1 ||
    asStringArray(sourceMatrix[0].atomicTaskRefs).length !== assigned.size ||
    asStringArray(sourceMatrix[0].atomicTaskRefs).some((id) => !assigned.has(id)) ||
    asStringArray(mustTaskMap[sourceMustRef]).length !== assigned.size ||
    asStringArray(mustTaskMap[sourceMustRef]).some((id) => !assigned.has(id))
  ) {
    return fail(`Split MUST ${sourceMustRef} lacks complete existing task or matrix authority.`);
  }
  const matrixIds = new Set(matrix.map((row) => normalizeText(row.id)));
  const additionalMatrixIds = ids
    .slice(1)
    .map((_, index) => `${normalizeText(sourceMatrix[0].id)}-SPLIT-${index + 2}`);
  if (additionalMatrixIds.some((id) => matrixIds.has(id))) {
    return fail(`Split MUST ${sourceMustRef} collides with an existing decomposition matrix ID.`);
  }

  const projections = [
    ['atomicTaskToTraceMap', 'traceRows'],
    ['atomicTaskToEvidenceMap', 'evidence'],
    ['atomicTaskToAcceptanceMap', 'acceptanceTests'],
    ['atomicTaskToTargetPathMap', 'targetModificationPaths'],
    ['atomicTaskToCommandMap', 'requiredCommands'],
  ] as const;
  const ownedRowsByField = new Map<string, Map<string, Set<string>>>();
  for (const [mapField, rowField] of projections) {
    const taskMap = recordObject(confirmation[mapField]);
    const rows = asRecordArray(confirmation[rowField]);
    const rowsById = new Map(rows.map((row) => [normalizeText(row.id), row] as const));
    const e2eRowsById =
      mapField === 'atomicTaskToAcceptanceMap'
        ? new Map(
            asRecordArray(confirmation.e2eSuites).map(
              (row) => [normalizeText(row.id), row] as const
            )
          )
        : new Map<string, Record<string, unknown>>();
    for (const [taskId, mustId] of assigned) {
      const refs = asStringArray(taskMap[taskId]);
      if (!refs.length || refs.some((id) => rowsById.has(id) === e2eRowsById.has(id))) {
        return fail(`Split MUST ${mustId} lacks a resolved ${mapField} entry for ${taskId}.`);
      }
      for (const id of refs) {
        const actualField = e2eRowsById.has(id) ? 'e2eSuites' : rowField;
        const row = (rowsById.get(id) ?? e2eRowsById.get(id))!;
        const atom = atoms.find((candidate) => normalizeText(candidate.id) === taskId)!;
        const ownsSourceMust =
          asStringArray(row.covers).includes(sourceMustRef) ||
          Object.hasOwn(recordObject(row.perMustAssertions), sourceMustRef) ||
          Object.hasOwn(recordObject(row.perMustOracles), sourceMustRef);
        if (
          (actualField === 'traceRows' &&
            (!asStringArray(row.covers).includes(sourceMustRef) ||
              (!asStringArray(row.taskRefs).includes(taskId) &&
                !asStringArray(atom.traceRows).includes(id)))) ||
          (actualField === 'evidence' &&
            (!ownsSourceMust || !asStringArray(atom.evidenceRefs).includes(id))) ||
          ((actualField === 'acceptanceTests' || actualField === 'e2eSuites') &&
            (!ownsSourceMust || !asStringArray(atom.acceptanceRefs).includes(id)))
        ) {
          return fail(
            `Split MUST ${mustId} has no source-owned ${actualField}[${id}] binding for ${taskId}.`
          );
        }
        if (
          (rowField === 'targetModificationPaths' || rowField === 'requiredCommands') &&
          !asRecordArray(row.perMustRows).some(
            (entry) => normalizeText(entry.mustRef) === sourceMustRef
          )
        ) {
          return fail(`Split MUST ${mustId} lacks source-owned ${rowField}[${id}] metadata.`);
        }
        const ownership = ownedRowsByField.get(actualField) ?? new Map<string, Set<string>>();
        if (!ownership.has(id)) ownership.set(id, new Set());
        ownership.get(id)!.add(mustId);
        ownedRowsByField.set(actualField, ownership);
      }
    }
  }

  const next: Record<string, unknown> = { ...confirmation };
  const changedFields = new Set<string>();
  const update = (field: string, rows: Record<string, unknown>[]): void => {
    next[field] = rows;
    changedFields.add(field);
  };
  const tasksByMustId = new Map(ids.map((id) => [id, [] as string[]]));
  for (const atom of atoms) {
    tasksByMustId.get(assigned.get(normalizeText(atom.id))!)!.push(normalizeText(atom.id));
  }
  update(
    'atomicImplementationTaskList',
    asRecordArray(confirmation.atomicImplementationTaskList).map((row) => {
      const mustId = assigned.get(normalizeText(row.id));
      return mustId
        ? { ...row, derivedFromMustRef: mustId, atomicUnitIndex: 1, atomicUnitCount: 1 }
        : row;
    })
  );
  update(
    'implementationTasks',
    existingTasks.map((row) => {
      const mustId = assigned.get(normalizeText(row.id));
      return mustId
        ? {
            ...row,
            requirementRefs: uniqueNonEmpty(
              asStringArray(row.requirementRefs).map((ref) =>
                ref === sourceMustRef ? mustId : ref
              )
            ),
          }
        : row;
    })
  );
  update(
    'mustExecutionDecompositionMatrix',
    matrix.flatMap((row) => {
      if (row !== sourceMatrix[0]) return [row];
      return ids.map((mustId, index) => ({
        ...row,
        id: index === 0 ? row.id : additionalMatrixIds[index - 1],
        mustRef: mustId,
        derivedFromMustRef: mustId,
        atomicTaskRefs: tasksByMustId.get(mustId),
      }));
    })
  );
  next.mustToAtomicTaskMap = {
    ...mustTaskMap,
    ...Object.fromEntries(tasksByMustId),
  };
  changedFields.add('mustToAtomicTaskMap');
  const manifest = recordObject(confirmation.aiTddContractExecutionManifestProjection);
  const lineage = recordObject(manifest.atomicImplementationTaskLineage);
  if (Object.keys(recordObject(lineage.mustToAtomicTaskMap)).length > 0) {
    next.aiTddContractExecutionManifestProjection = {
      ...manifest,
      atomicImplementationTaskLineage: {
        ...lineage,
        mustToAtomicTaskMap: {
          ...recordObject(lineage.mustToAtomicTaskMap),
          ...Object.fromEntries(tasksByMustId),
        },
      },
    };
    changedFields.add('aiTddContractExecutionManifestProjection');
  }
  for (const field of [
    'traceRows',
    'evidence',
    'acceptanceTests',
    'e2eSuites',
    'targetModificationPaths',
    'requiredCommands',
  ]) {
    const ownership = ownedRowsByField.get(field) ?? new Map<string, Set<string>>();
    update(
      field,
      asRecordArray(confirmation[field]).map((row) => {
        const mustIds = ownership.get(normalizeText(row.id));
        if (!mustIds) return row;
        const expanded = [...mustIds];
        const fieldName = field === 'targetModificationPaths' ? 'requirementRefs' : 'covers';
        const nextRow: Record<string, unknown> = { ...row };
        if (field !== 'requiredCommands') {
          nextRow[fieldName] = uniqueNonEmpty([...asStringArray(row[fieldName]), ...expanded]);
        }
        if (field === 'targetModificationPaths' || field === 'requiredCommands') {
          const sourceRow = asRecordArray(row.perMustRows).find(
            (entry) => normalizeText(entry.mustRef) === sourceMustRef
          )!;
          nextRow.perMustRows = [
            ...asRecordArray(row.perMustRows),
            ...expanded
              .filter((id) => id !== sourceMustRef)
              .map((mustRef) => ({ ...sourceRow, mustRef })),
          ];
        }
        for (const listField of [
          'perMustOracles',
          'perMustAssertions',
          'perMustResponsibilities',
        ]) {
          if (Array.isArray(row[listField]) && asStringArray(row[listField]).includes(sourceMustRef)) {
            nextRow[listField] = uniqueNonEmpty([
              ...asStringArray(row[listField]),
              ...expanded,
            ]);
          } else {
            const keyed = recordObject(row[listField]);
            if (Object.hasOwn(keyed, sourceMustRef)) {
              nextRow[listField] = {
                ...keyed,
                ...Object.fromEntries(
                  expanded
                    .filter((id) => id !== sourceMustRef)
                    .map((mustId) => [
                      mustId,
                      typeof keyed[sourceMustRef] === 'string'
                        ? String(keyed[sourceMustRef]).replaceAll(sourceMustRef, mustId)
                        : keyed[sourceMustRef],
                    ])
                ),
              };
            }
          }
        }
        const assertions = recordObject(row.perMustAssertions);
        if (Object.hasOwn(assertions, sourceMustRef)) {
          nextRow.perMustAssertions = {
            ...assertions,
            ...Object.fromEntries(
              expanded
                .filter((id) => id !== sourceMustRef)
                .map((mustId) => [
                  mustId,
                  asStringArray(
                    atoms.find(
                      (atom) => assigned.get(normalizeText(atom.id)) === mustId
                    )?.primaryAcceptanceOracles
                  )[0] || assertions[sourceMustRef],
                ])
            ),
          };
        }
        return nextRow;
      })
    );
  }
  return { ok: true, confirmation: next, changedFields: [...changedFields].sort() };
}
