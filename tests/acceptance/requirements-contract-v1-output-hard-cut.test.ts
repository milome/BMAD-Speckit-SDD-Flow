import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { renderCanonicalRequirementSourcePrd } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-prd-render-write-seam';

const GOLDEN_SOURCE_PRD = path.resolve(
  'packages/bmad-speckit/src/main-agent/source-authority/tests/fixtures/source-prd/golden-source-prd.md'
);

function sourceAuthoritySections(): string {
  const canonicalFixture = readFileSync(GOLDEN_SOURCE_PRD, 'utf8');
  const semanticStart = canonicalFixture.indexOf('## Product Context');
  const semanticEnd = canonicalFixture.indexOf('## Revision History');
  return canonicalFixture.slice(semanticStart, semanticEnd).trim();
}

function renderInput(sourceText: string) {
  return {
    recordId: 'REQ-V1-HARD-CUT',
    requirementSetId: 'REQSET-V1-HARD-CUT',
    title: 'V1 Output Hard Cut',
    entrySource: 'session_requirements' as const,
    createdAt: '2026-07-19T00:00:00.000Z',
    semanticModelHash: `sha256:${'1'.repeat(64)}`,
    sourceAuthorityHash: `sha256:${'2'.repeat(64)}`,
    proofRefs: {
      intakeReceipt: {
        path: 'intake-receipt.json',
        hash: `sha256:${'3'.repeat(64)}`,
      },
      intentLineageLedger: {
        path: 'intent-lineage-ledger.json',
        hash: `sha256:${'4'.repeat(64)}`,
      },
      semanticConservationManifest: {
        path: 'semantic-conservation-manifest.json',
        hash: `sha256:${'5'.repeat(64)}`,
      },
    },
    sourceText,
    outputPolicy: {
      shadowOutputEnabled: false,
      v1OutputEnabled: false,
      productionReadModelVersion: 'v2' as const,
    },
  };
}

describe('requirements contract V1 output hard cut', () => {
  it('rejects legacy currentTargetMap Source PRD output after V2 activation', () => {
    const sourceText = [
      sourceAuthoritySections(),
      '',
      'implementationConfirmation:',
      '  status: draft',
      '  currentTargetMap:',
      '    currentSummary: ["legacy physical layout"]',
      '    targetSummary: ["normalized V2 output"]',
    ].join('\n');

    expect(() =>
      renderCanonicalRequirementSourcePrd(
        renderInput(sourceText) as Parameters<typeof renderCanonicalRequirementSourcePrd>[0]
      )
    ).toThrow(/V2 activation.*currentTargetMap|currentTargetMap.*V2 activation/iu);
  });

  it('rejects inline YAML currentTargetMap fields after V2 activation', () => {
    const sourceText = [
      sourceAuthoritySections(),
      '',
      'implementationConfirmation:',
      '  status: draft',
      '  currentTargetMap: { currentSummary: ["inline legacy layout"] }',
    ].join('\n');

    expect(() =>
      renderCanonicalRequirementSourcePrd(
        renderInput(sourceText) as Parameters<typeof renderCanonicalRequirementSourcePrd>[0]
      )
    ).toThrow(/V2 activation.*currentTargetMap|currentTargetMap.*V2 activation/iu);
  });

  it('rejects V1 contract schema markers after V2 activation', () => {
    const sourceText = [
      sourceAuthoritySections(),
      '',
      'implementationConfirmation:',
      '  status: draft',
      '  contractSchemaVersion: 1',
    ].join('\n');

    expect(() =>
      renderCanonicalRequirementSourcePrd(
        renderInput(sourceText) as Parameters<typeof renderCanonicalRequirementSourcePrd>[0]
      )
    ).toThrow(/V2 activation.*V1|V1.*V2 activation/iu);
  });

  it('blocks persistence when the production selector changes after rendering', async () => {
    const root = mkdtempSync(path.join(tmpdir(), 'requirements-output-policy-race-'));
    const registryPath = path.join(
      root,
      '_bmad/shared/requirements-contract/requirements-contract-consumer-registry.json'
    );
    mkdirSync(path.dirname(registryPath), { recursive: true });
    const writeRegistry = (version: 'v1' | 'v2') =>
      writeFileSync(
        registryPath,
        JSON.stringify({
          schemaVersion: 'requirements-contract-consumer-registry/v2',
          shadowOutputEnabled: version === 'v1',
          v1OutputEnabled: version === 'v1',
          productionReadModelVersion: version,
        }),
        'utf8'
      );

    try {
      writeRegistry('v2');
      const seam =
        await import('../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-prd-render-write-seam');
      const { outputPolicy: _outputPolicy, ...baseInput } = renderInput(
        `${sourceAuthoritySections()}\n\nimplementationConfirmation:\n  status: draft\n`
      );
      const rendered = seam.renderProductionCanonicalRequirementSourcePrd({
        ...baseInput,
        projectRoot: root,
      });
      writeRegistry('v1');

      expect(seam.assertProductionPrdOutputPolicyCurrent).toBeTypeOf('function');
      expect(() =>
        seam.assertProductionPrdOutputPolicyCurrent({ projectRoot: root, rendered })
      ).toThrow(/production output selector changed after rendering/iu);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('does not persist registered output after the selector changes', async () => {
    const root = mkdtempSync(path.join(tmpdir(), 'requirements-output-policy-write-race-'));
    const registryPath = path.join(
      root,
      '_bmad/shared/requirements-contract/requirements-contract-consumer-registry.json'
    );
    const targetPath = path.join(root, 'requirement-source-prd.md');
    mkdirSync(path.dirname(registryPath), { recursive: true });
    const writeRegistry = (version: 'v1' | 'v2') =>
      writeFileSync(
        registryPath,
        JSON.stringify({
          schemaVersion: 'requirements-contract-consumer-registry/v2',
          shadowOutputEnabled: version === 'v1',
          v1OutputEnabled: version === 'v1',
          productionReadModelVersion: version,
        }),
        'utf8'
      );

    try {
      writeRegistry('v2');
      const seam =
        await import('../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-prd-render-write-seam');
      const { outputPolicy: _outputPolicy, ...baseInput } = renderInput(
        `${sourceAuthoritySections()}\n\nimplementationConfirmation:\n  status: draft\n`
      );
      const rendered = seam.renderProductionCanonicalRequirementSourcePrd({
        ...baseInput,
        projectRoot: root,
      });
      writeRegistry('v1');

      expect(() =>
        seam.writeRegisteredPrdRender({
          rendered,
          targetPath,
          projectRoot: root,
        } as Parameters<typeof seam.writeRegisteredPrdRender>[0])
      ).toThrow(/production output selector changed after rendering/iu);
      expect(existsSync(targetPath)).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('shares one production output policy lock across the orchestration promotion boundary', async () => {
    const root = mkdtempSync(path.join(tmpdir(), 'requirements-output-policy-lock-'));
    const lockPath = path.join(
      root,
      '_bmad/shared/requirements-contract/.requirements-contract-consumer-registry.activation.lock'
    );
    try {
      const seam =
        await import('../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-prd-render-write-seam');
      const release = seam.acquireProductionOutputPolicyLock(root);
      try {
        const probe = spawnSync(
          process.execPath,
          [
            '-e',
            `const fs=require('node:fs');process.exit(fs.existsSync(${JSON.stringify(lockPath)})?0:1);`,
          ],
          { cwd: root, encoding: 'utf8' }
        );

        expect(probe.status).toBe(0);
        expect(() => seam.acquireProductionOutputPolicyLock(root)).toThrow(
          /production output policy lock is already held/iu
        );
        const orchestrationSource = readFileSync(
          path.resolve(
            'packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-orchestration.ts'
          ),
          'utf8'
        );
        expect(orchestrationSource).toContain('acquireProductionOutputPolicyLock(root)');
        expect(orchestrationSource).toContain('production_output_selector_changed_after_promotion');
      } finally {
        release();
      }
      expect(existsSync(lockPath)).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
