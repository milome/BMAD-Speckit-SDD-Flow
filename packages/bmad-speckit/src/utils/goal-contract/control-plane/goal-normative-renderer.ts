export function renderNormativeDetails(row: Record<string, unknown>): string[] {
  const applicability = row.applicability as { scope: string; obligationRefs?: string[]; sourceRefs: string[] };
  const conditions = row.conditions as Array<{ text: string; state: string; sourceRefs: string[] }>;
  return [
    `  Strength: ${String(row.normativeStrength)}; polarity: ${String(row.polarity)}; execution role: ${String(row.executionRole)}.`,
    `  Applicability: ${applicability.scope}${applicability.obligationRefs ? ` [${applicability.obligationRefs.join(', ')}]` : ''}; source: ${applicability.sourceRefs.join(', ')}.`,
    ...conditions.map((condition) => `  Condition (${condition.state}): ${condition.text}; source: ${condition.sourceRefs.join(', ')}.`),
  ];
}
