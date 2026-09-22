import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { readRequirementsContract } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-read-facade';

const repoRoot = path.resolve(__dirname, '../..');

function retiredPath(...parts: string[]): string {
  return path.join(repoRoot, ...parts);
}

describe('requirements authoring V1 compatibility hard cut', () => {
  it('removes retired repair and migration writer seams from the installed source surface', () => {
    const runtimeDecision = readFileSync(
      retiredPath('packages', 'bmad-speckit', 'src', 'runtime', 'ai-tdd', 'runtime-decision.ts'),
      'utf8'
    );
    const safeWriteRegistry = readFileSync(
      retiredPath(
        'packages', 'bmad-speckit', 'src', 'main-agent', 'source-authority', 'rules',
        'requirements-contract-safe-write-target-registry.ts'
      ),
      'utf8'
    );
    expect(runtimeDecision).not.toContain('authoring-repair-preserve-existing');
    expect(safeWriteRegistry).not.toContain('legacy_prd_migration_receipt');
  });

  it('removes the retired V1 read and inventory surfaces from source and registry', () => {
    const retiredFiles = [
      retiredPath(
        'packages',
        'bmad-speckit',
        'src',
        'main-agent',
        'source-authority',
        'scripts',
        ['requirements-contract-', 'v1-read-adapter.ts'].join('')
      ),
      retiredPath(
        'packages',
        'bmad-speckit',
        'src',
        'main-agent',
        'source-authority',
        'scripts',
        ['requirements-contract-', 'v1-legacy-inventory.ts'].join('')
      ),
      retiredPath(
        'packages',
        'bmad-speckit',
        'src',
        'main-agent',
        'source-authority',
        'scripts',
        ['requirements-contract-', 'legacy-prd-migration.ts'].join('')
      ),
      retiredPath(
        'packages',
        'bmad-speckit',
        'src',
        'main-agent',
        'source-authority',
        'schemas',
        ['requirements-contract-', 'v1-legacy-inventory.schema.json'].join('')
      ),
      retiredPath(
        '_bmad',
        'shared',
        'requirements-contract',
        ['requirements-contract-', 'v1-legacy-inventory.json'].join('')
      ),
      retiredPath(
        '_bmad',
        'shared',
        'requirements-contract',
        ['requirements-contract-', 'v1-legacy-inventory.freeze.json'].join('')
      ),
    ];

    for (const filePath of retiredFiles) {
      expect(existsSync(filePath), filePath).toBe(false);
    }

    const registryPath = retiredPath(
      '_bmad',
      'shared',
      'requirements-contract',
      'requirements-contract-consumer-registry.json'
    );
    const registryText = readFileSync(registryPath, 'utf8');
    expect(registryText).not.toContain('legacyReadEligibility');
    expect(registryText).not.toContain('g00_baseline_source_prd_inventory');
    expect(registryText).not.toContain('v1-read-adapter');
  });

  it('blocks the retired source format before any adapter or source read', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'requirements-v1-hard-cut-'));
    try {
      const sourcePath = path.join(root, 'legacy.md');
      writeFileSync(sourcePath, '# retired source\n', 'utf8');
      const sourceHash = `sha256:${createHash('sha256').update(readFileSync(sourcePath)).digest('hex')}`;
      const registryPath = path.join(
        root,
        '_bmad',
        'shared',
        'requirements-contract',
        'requirements-contract-consumer-registry.json'
      );
      mkdirSync(path.dirname(registryPath), { recursive: true });
      writeFileSync(
        registryPath,
        `${JSON.stringify({
          schemaVersion: 'requirements-contract-consumer-registry/v2',
          activation: {
            shadowOutputEnabled: false,
            v1OutputEnabled: false,
            productionReadModelVersion: 'v2',
          },
          consumers: [
            {
              consumerId: 'retired-v1-consumer',
              readFacadeRef: 'requirements-contract-read-facade/v1',
              adapterRef: ['requirements-contract-', 'v1-read-adapter/v1'].join(''),
              sourceFormatVersion: ['requirement-contract-source-prd/', 'v1'].join(''),
              validationModes: ['execution'],
              eligibilityAuthority: 'frozen_inventory',
              [['legacy', 'EligibilitySourceRef'].join('')]: 'inventory.json',
              [['legacy', 'EligibilitySourceHash'].join('')]: `sha256:${'3'.repeat(64)}`,
              [['legacy', 'InventoryFreezeReceiptRef'].join('')]: 'freeze.json',
              [['legacy', 'InventoryFreezeReceiptHash'].join('')]: `sha256:${'4'.repeat(64)}`,
              v1FormatProofHash: `sha256:${'5'.repeat(64)}`,
              cutoverPredecessorHash: `sha256:${'6'.repeat(64)}`,
              [['legacy', 'InventoryWriterHash'].join('')]: `sha256:${'7'.repeat(64)}`,
              [['legacy', 'InventoryG00BaselineHash'].join('')]: `sha256:${'8'.repeat(64)}`,
              [['legacy', 'InventoryFreezeTransactionId'].join('')]: 'retired-freeze',
            },
          ],
        })}\n`,
        'utf8'
      );

      const result = readRequirementsContract({
        projectRoot: root,
        consumerId: 'retired-v1-consumer',
        mode: 'execution',
        envelope: {
          requirementSetId: 'REQ-RETIRED-V1',
          sourcePath: 'legacy.md',
          sourceHash,
          sourceFormatVersion: ['requirement-contract-source-prd/', 'v1'].join('') as never,
          cutoverId: 'retired-cutover',
          activeBundleRevision: 'none',
          semanticModelHash: `sha256:${'1'.repeat(64)}`,
          traceGraphHash: `sha256:${'2'.repeat(64)}`,
        },
      });

      expect(result).toMatchObject({
        ok: false,
        decision: 'block',
        adapterInvoked: false,
      });
      expect(result.issues[0]?.code).toBe('consumer_contract_mismatch');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
