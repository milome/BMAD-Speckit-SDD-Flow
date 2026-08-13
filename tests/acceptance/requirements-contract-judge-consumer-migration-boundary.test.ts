import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { REQUIREMENTS_CONTRACT_PROJECTION_SURFACE_ROOTS } from '../../packages/bmad-speckit/src/main-agent/source-authority/rules/requirements-contract-projection-registry';

const ROOT = process.cwd();
const MANIFEST_FILE = 'requirements-contract-package-runtime-action-binding-manifest.json';
const LEGACY_ACTION = 'requirements-contract-critical-auditor-judge-adapter';

function fileHash(filePath: string): string {
  return `sha256:${createHash('sha256').update(readFileSync(filePath)).digest('hex')}`;
}

describe('requirements contract Judge consumer migration boundary', () => {
  it('projects the canonical judge run action to every consumer surface', () => {
    const surfacePaths = REQUIREMENTS_CONTRACT_PROJECTION_SURFACE_ROOTS.map((surfaceRoot) =>
      path.resolve(ROOT, surfaceRoot, MANIFEST_FILE)
    );
    const canonicalHash = fileHash(surfacePaths[0]!);

    for (const surfacePath of surfacePaths) {
      expect(existsSync(surfacePath), `missing action binding surface: ${surfacePath}`).toBe(true);
      expect(fileHash(surfacePath)).toBe(canonicalHash);
      const manifest = JSON.parse(readFileSync(surfacePath, 'utf8')) as {
        actionUniverseHash: string;
        decision: string;
        actions: Array<{
          actionId: string;
          sourceHandlerRef: { path: string };
          runtimeRefs?: Array<{ role: string; packagePath: string }>;
        }>;
      };
      const actionIds = manifest.actions.map((action) => action.actionId);
      const judgeRun = manifest.actions.find(
        (action) => action.actionId === 'requirements-contract-judge-run'
      );

      expect(manifest.decision).toBe('pass');
      expect(actionIds).toContain('requirements-contract-judge-run');
      expect(actionIds).not.toContain(LEGACY_ACTION);
      expect(judgeRun?.sourceHandlerRef.path).toBe(
        'packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-judge-command.ts'
      );
      expect(judgeRun?.runtimeRefs ?? []).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ role: 'claude-code-cli-judge-adapter' }),
          expect.objectContaining({ role: 'codex-cli-judge-adapter' }),
        ])
      );
      expect(judgeRun?.runtimeRefs ?? []).not.toEqual(
        expect.arrayContaining([
          expect.objectContaining({ role: 'legacy-critical-auditor-judge-adapter' }),
        ])
      );
    }
  });

  it('preserves deferred consumer migration assets without making them Judge authority', () => {
    const consumerRegistry = JSON.parse(
      readFileSync(
        path.join(ROOT, '_bmad/shared/requirements-contract/requirements-contract-consumer-registry.json'),
        'utf8'
      )
    ) as Record<string, unknown>;
    const projectionRegistry = JSON.parse(
      readFileSync(
        path.join(ROOT, '_bmad/shared/requirements-contract/requirements-contract-projection-registry.json'),
        'utf8'
      )
    ) as Record<string, unknown>;
    const serializedConsumer = JSON.stringify(consumerRegistry);
    const serializedProjection = JSON.stringify(projectionRegistry);

    expect(serializedConsumer).toContain('requirements-contract');
    expect(serializedProjection).toContain('requirements-contract');
    expect(serializedConsumer).not.toContain('"judgeRole":"requirements_critical_auditor"');
    expect(serializedProjection).not.toContain('"judgeRole":"final_acceptance_judge"');
  });
});
