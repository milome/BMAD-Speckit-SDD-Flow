import { readFileSync } from 'node:fs';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import { describe, expect, it } from 'vitest';
import {
  REQUIRED_MANDATORY_PORTFOLIO_SECTIONS,
  compileRequirementsContractMandatoryVerificationPortfolio,
  validateRequirementsContractMandatoryVerificationPortfolio,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-mandatory-verification-portfolio';
import { sha256Stable } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-semantic-resolver';

const hash = (label: string) => sha256Stable({ label });

function validInput() {
  return {
    campaignId: 'goal-campaign-001',
    scopeManifestHash: hash('scope'),
    campaignLineageKey: hash('lineage'),
    requiredSections: [...REQUIRED_MANDATORY_PORTFOLIO_SECTIONS].reverse(),
    evidenceRefs: ['evidence/child-closure', 'evidence/reachability'],
    commandRefs: ['CMD-J05-T01-01'],
    taskReportProvenanceRefs: ['task-report/p01'],
    deliverySurfaceRefs: ['surface/codex', 'surface/cursor'],
    policyRefs: ['policy/fail-closed'],
    priorFindingRefs: ['finding/legacy-1'],
    currentAuthority: {
      scopeManifestHash: hash('scope'),
      campaignLineageKey: hash('lineage'),
    },
  };
}

describe('requirements contract mandatory verification portfolio', () => {
  it('normalizes the mandatory portfolio and binds it to current scope authority', () => {
    const portfolio = compileRequirementsContractMandatoryVerificationPortfolio(validInput());
    const schema = JSON.parse(
      readFileSync(
        path.resolve(
          'packages/bmad-speckit/src/main-agent/source-authority/schemas/requirements-contract-mandatory-verification-portfolio.schema.json'
        ),
        'utf8'
      )
    );
    const validate = new Ajv2020({ allErrors: true, strict: false }).compile(schema);

    expect(portfolio.requiredSections).toEqual([...REQUIRED_MANDATORY_PORTFOLIO_SECTIONS]);
    expect(portfolio.decision).toBe('pass');
    expect(validate(portfolio), JSON.stringify(validate.errors ?? [])).toBe(true);
    expect(
      validateRequirementsContractMandatoryVerificationPortfolio(portfolio, {
        scopeManifestHash: portfolio.scopeManifestHash,
        campaignLineageKey: portfolio.campaignLineageKey,
      })
    ).toBe(portfolio);
  });

  it.each([
    [
      'missing section',
      { requiredSections: ['complete_dependencies'] },
      'mandatory_portfolio_section_missing',
    ],
    [
      'duplicate section',
      { requiredSections: ['complete_dependencies', 'complete_dependencies'] },
      'mandatory_portfolio_section_missing',
    ],
    ['missing evidence', { evidenceRefs: [] }, 'mandatory_portfolio_evidence_missing'],
    ['missing command', { commandRefs: [] }, 'mandatory_portfolio_command_missing'],
    [
      'missing task report',
      { taskReportProvenanceRefs: [] },
      'mandatory_portfolio_task_report_missing',
    ],
    [
      'missing delivery surface',
      { deliverySurfaceRefs: [] },
      'mandatory_portfolio_delivery_surface_missing',
    ],
    ['missing policy', { policyRefs: [] }, 'mandatory_portfolio_policy_missing'],
    [
      'stale scope',
      { currentAuthority: { scopeManifestHash: hash('other') } },
      'mandatory_portfolio_scope_stale',
    ],
    ['fallback evidence', { fallbackEvidence: true }, 'mandatory_portfolio_forbidden_field'],
    ['budget scaling', { budgetScaling: true }, 'mandatory_portfolio_forbidden_field'],
  ])('fails closed for %s', (_name, patch, code) => {
    expect(() =>
      compileRequirementsContractMandatoryVerificationPortfolio({
        ...validInput(),
        ...patch,
      })
    ).toThrow(code);
  });

  it('rejects portfolio hash tampering', () => {
    const portfolio = compileRequirementsContractMandatoryVerificationPortfolio(validInput());

    expect(() =>
      validateRequirementsContractMandatoryVerificationPortfolio(
        { ...portfolio, evidenceRefs: ['evidence/tampered'] },
        {
          scopeManifestHash: portfolio.scopeManifestHash,
          campaignLineageKey: portfolio.campaignLineageKey,
        }
      )
    ).toThrow('mandatory_portfolio_hash_mismatch');
  });
});
