const modulePath = (relativePath: string): string =>
  `${relativePath}${__filename.endsWith('.ts') ? '.ts' : ''}`;
const { extractSourceObligations } = require(modulePath('../source-obligation-extractor'));
const {
  extractCanonicalSourcePlanModel,
  isCanonicalSourcePlanSnapshot,
} = require(modulePath('./canonical-source-adapter'));

export function extractGoalContractSourceModel(input: { snapshot: Record<string, unknown> }) {
  return isCanonicalSourcePlanSnapshot(input.snapshot)
    ? extractCanonicalSourcePlanModel(input)
    : extractSourceObligations(input);
}

module.exports = { extractGoalContractSourceModel };
