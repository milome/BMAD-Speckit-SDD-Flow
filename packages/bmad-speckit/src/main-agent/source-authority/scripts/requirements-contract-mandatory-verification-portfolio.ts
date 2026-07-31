import {
  assertNoForbiddenKeys,
  isRecord,
  requireHash,
  requireNonEmptyUniqueStrings,
  requireText,
  sameSet,
  stableHash,
  strings,
} from './requirements-contract-verification-evidence-normalizer';

const REQUIRED_SECTIONS = [
  'complete_dependencies',
  'governed_bytes',
  'verification_evidence',
  'production_reachability',
  'task_report_provenance',
  'mandatory_portfolio',
  'delivery_surfaces',
  'prior_findings',
  'policy',
] as const;

const FORBIDDEN_PORTFOLIO_KEYS = ['fallback', 'budgetscaling', 'partitioncountbudget', 'score'];

export interface RequirementsContractMandatoryVerificationPortfolio {
  schemaVersion: 'requirements-contract-mandatory-verification-portfolio/v1';
  campaignId: string;
  scopeManifestHash: string;
  campaignLineageKey: string;
  requiredSections: string[];
  evidenceRefs: string[];
  commandRefs: string[];
  taskReportProvenanceRefs: string[];
  deliverySurfaceRefs: string[];
  policyRefs: string[];
  priorFindingRefs: string[];
  portfolioHash: string;
  decision: 'pass';
}

export class RequirementsContractMandatoryPortfolioError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.name = 'RequirementsContractMandatoryPortfolioError';
    this.code = code;
  }
}

function fail(code: string): never {
  throw new RequirementsContractMandatoryPortfolioError(code);
}

export function compileRequirementsContractMandatoryVerificationPortfolio(
  input: unknown
): RequirementsContractMandatoryVerificationPortfolio {
  if (!isRecord(input)) fail('mandatory_portfolio_input_invalid');
  assertNoForbiddenKeys(input, FORBIDDEN_PORTFOLIO_KEYS, 'mandatory_portfolio_forbidden_field');
  const declaredSections = requireNonEmptyUniqueStrings(
    input.requiredSections,
    'mandatory_portfolio_section_missing'
  );
  if (!sameSet(declaredSections, REQUIRED_SECTIONS)) fail('mandatory_portfolio_section_missing');
  const evidenceRefs = requireNonEmptyUniqueStrings(
    input.evidenceRefs,
    'mandatory_portfolio_evidence_missing'
  );
  const commandRefs = requireNonEmptyUniqueStrings(
    input.commandRefs,
    'mandatory_portfolio_command_missing'
  );
  const taskReportProvenanceRefs = requireNonEmptyUniqueStrings(
    input.taskReportProvenanceRefs,
    'mandatory_portfolio_task_report_missing'
  );
  const deliverySurfaceRefs = requireNonEmptyUniqueStrings(
    input.deliverySurfaceRefs,
    'mandatory_portfolio_delivery_surface_missing'
  );
  const policyRefs = requireNonEmptyUniqueStrings(
    input.policyRefs,
    'mandatory_portfolio_policy_missing'
  );
  const scopeManifestHash = requireHash(
    input,
    'scopeManifestHash',
    'mandatory_portfolio_scope_stale'
  );
  const currentAuthority = isRecord(input.currentAuthority) ? input.currentAuthority : {};
  if (
    currentAuthority.scopeManifestHash !== scopeManifestHash ||
    currentAuthority.campaignLineageKey !== input.campaignLineageKey
  ) {
    fail('mandatory_portfolio_scope_stale');
  }
  const payload = {
    schemaVersion: 'requirements-contract-mandatory-verification-portfolio/v1' as const,
    campaignId: requireText(input, 'campaignId', 'mandatory_portfolio_identity_invalid'),
    scopeManifestHash,
    campaignLineageKey: requireHash(
      input,
      'campaignLineageKey',
      'mandatory_portfolio_identity_invalid'
    ),
    requiredSections: [...REQUIRED_SECTIONS],
    evidenceRefs,
    commandRefs,
    taskReportProvenanceRefs,
    deliverySurfaceRefs,
    policyRefs,
    priorFindingRefs: [...new Set(strings(input.priorFindingRefs))].sort((left, right) =>
      left.localeCompare(right)
    ),
  };
  return { ...payload, portfolioHash: stableHash(payload), decision: 'pass' };
}

export function validateRequirementsContractMandatoryVerificationPortfolio(
  value: unknown,
  currentAuthority: unknown
): RequirementsContractMandatoryVerificationPortfolio {
  if (!isRecord(value) || !isRecord(currentAuthority)) fail('mandatory_portfolio_invalid');
  const portfolio = value as unknown as RequirementsContractMandatoryVerificationPortfolio;
  const { portfolioHash, decision, ...payload } = portfolio;
  if (decision !== 'pass') fail('mandatory_portfolio_invalid');
  if (portfolioHash !== stableHash(payload)) fail('mandatory_portfolio_hash_mismatch');
  if (
    portfolio.scopeManifestHash !== currentAuthority.scopeManifestHash ||
    portfolio.campaignLineageKey !== currentAuthority.campaignLineageKey
  ) {
    fail('mandatory_portfolio_scope_stale');
  }
  return portfolio;
}

export { REQUIRED_SECTIONS as REQUIRED_MANDATORY_PORTFOLIO_SECTIONS };
