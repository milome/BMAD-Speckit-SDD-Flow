import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const GOLDEN_SOURCE_PRD = path.resolve(
  'packages/bmad-speckit/src/main-agent/source-authority/tests/fixtures/source-prd/golden-source-prd.md'
);
const PRODUCTION_PRD_RENDER_SEAM = path.resolve(
  'packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-prd-render-write-seam.ts'
);

function sourceAuthoritySections(): string {
  const canonicalFixture = readFileSync(GOLDEN_SOURCE_PRD, 'utf8');
  const semanticStart = canonicalFixture.indexOf('## Product Context');
  const semanticEnd = canonicalFixture.indexOf('## Revision History');
  return canonicalFixture.slice(semanticStart, semanticEnd).trim();
}

function renderInput(projectRoot: string) {
  return {
    projectRoot,
    recordId: 'REQ-POST-CUTOVER',
    requirementSetId: 'REQSET-POST-CUTOVER',
    title: 'Post-cutover Source PRD',
    entrySource: 'session_requirements' as const,
    createdAt: '2026-07-19T00:00:00.000Z',
    semanticModelHash: `sha256:${'1'.repeat(64)}`,
    sourceAuthorityHash: `sha256:${'2'.repeat(64)}`,
    proofRefs: {
      intakeReceipt: { path: 'intake.json', hash: `sha256:${'3'.repeat(64)}` },
      intentLineageLedger: { path: 'lineage.json', hash: `sha256:${'4'.repeat(64)}` },
      semanticConservationManifest: {
        path: 'conservation.json',
        hash: `sha256:${'5'.repeat(64)}`,
      },
    },
    sourceText: [
      sourceAuthoritySections(),
      '',
      'implementationConfirmation:',
      '  status: draft',
      '  currentTargetMap:',
      '    currentSummary: ["legacy output"]',
    ].join('\n'),
  };
}

describe('post-cutover V1 Source PRD output', () => {
  it('routes production Source PRD rendering through the project-root selector seam', () => {
    const seamSource = readFileSync(PRODUCTION_PRD_RENDER_SEAM, 'utf8');

    expect(seamSource.includes('renderProductionCanonicalRequirementSourcePrd')).toBe(true);
    expect(seamSource.includes('readProductionOutputPolicyBinding(projectRoot)')).toBe(true);
    expect(seamSource.includes('renderProductionClassifiedRequirementSourcePrd')).toBe(true);
  });

  it('loads the live V2 selector before the production renderer can emit legacy layout', async () => {
    const root = mkdtempSync(path.join(tmpdir(), 'requirements-post-cutover-'));
    const registryPath = path.join(
      root,
      '_bmad/shared/requirements-contract/requirements-contract-consumer-registry.json'
    );
    mkdirSync(path.dirname(registryPath), { recursive: true });
    writeFileSync(
      registryPath,
      JSON.stringify({
        schemaVersion: 'requirements-contract-consumer-registry/v2',
        shadowOutputEnabled: false,
        v1OutputEnabled: false,
        productionReadModelVersion: 'v2',
      }),
      'utf8'
    );

    try {
      const seam =
        await import('../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-prd-render-write-seam');
      expect(seam.renderProductionCanonicalRequirementSourcePrd).toBeTypeOf('function');
      expect(() => seam.renderProductionCanonicalRequirementSourcePrd(renderInput(root))).toThrow(
        /V2 activation.*currentTargetMap|currentTargetMap.*V2 activation/iu
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails closed when activation authority exists without a complete selector', async () => {
    const root = mkdtempSync(path.join(tmpdir(), 'requirements-post-cutover-invalid-'));
    const registryPath = path.join(
      root,
      '_bmad/shared/requirements-contract/requirements-contract-consumer-registry.json'
    );
    mkdirSync(path.dirname(registryPath), { recursive: true });
    writeFileSync(
      registryPath,
      JSON.stringify({
        schemaVersion: 'requirements-contract-consumer-registry/v2',
        activationReceiptId: 'ACT-RECEIPT-POST-CUTOVER',
      }),
      'utf8'
    );

    try {
      const seam =
        await import('../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-prd-render-write-seam');
      expect(() => seam.renderProductionCanonicalRequirementSourcePrd(renderInput(root))).toThrow(
        /production output selector is invalid/iu
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
