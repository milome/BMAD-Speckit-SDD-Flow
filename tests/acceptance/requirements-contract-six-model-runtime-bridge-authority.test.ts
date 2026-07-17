import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  defaultRuntimeContextRegistry,
  writeRuntimeContextRegistry,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/runtime-context-registry';
import {
  projectContextPath,
  writeRuntimeContext,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/runtime-context';
import { mainEmitRuntimePolicy } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/emit-runtime-policy';

function materializeBridge(stage: 'implement' | 'post_audit') {
  const root = mkdtempSync(path.join(os.tmpdir(), `six-model-runtime-bridge-${stage}-`));
  const configSource = path.join(process.cwd(), '_bmad', '_config');
  const configTarget = path.join(root, '_bmad', '_config');
  mkdirSync(path.dirname(configTarget), { recursive: true });
  cpSync(configSource, configTarget, { recursive: true });

  const contextFile = projectContextPath(root);
  mkdirSync(path.dirname(contextFile), { recursive: true });
  writeRuntimeContext(root, {
    version: 1,
    flow: 'story',
    stage,
    sourceMode: 'full_bmad',
    contextScope: 'project',
    epicId: 'epic-bridge',
    storyId: `bridge-${stage}`,
    updatedAt: '2026-07-15T00:00:00.000Z',
  });

  const registry = defaultRuntimeContextRegistry(root);
  registry.projectContextPath = path.join(
    '_bmad-output',
    'runtime',
    'context',
    'project.json'
  );
  registry.activeScope = {
    scopeType: 'project',
    resolvedContextPath: registry.projectContextPath,
    reason: 'bridge authority test',
  };
  writeRuntimeContextRegistry(root, registry);

  expect(mainEmitRuntimePolicy(['--cwd', root, '--legacy-registry-bridge'])).toBe(0);
  const indexPath = path.join(
    root,
    '_bmad-output',
    'runtime',
    'requirement-records',
    'index.json'
  );
  const index = JSON.parse(readFileSync(indexPath, 'utf8')) as Record<string, any>;
  const recordPath = path.join(
    root,
    String(index.records[0].recordPath).replace(/\//gu, path.sep)
  );
  return {
    root,
    record: JSON.parse(readFileSync(recordPath, 'utf8')) as Record<string, any>,
  };
}

describe('requirements contract six-model runtime bridge authority', () => {
  for (const stage of ['implement', 'post_audit'] as const) {
    it(`keeps ${stage} registry state non-authoritative`, () => {
      const fixture = materializeBridge(stage);
      try {
        const projections = Object.values(
          fixture.record.sixModelResults ?? {}
        ) as Array<Record<string, any>>;
        expect(projections.length).toBe(6);
        expect(projections.every((projection) => projection.status === 'not_established')).toBe(
          true
        );
        expect(
          projections.every((projection) =>
            projection.blockingReasons?.includes(
              'runtime_registry_bridge_non_authoritative'
            )
          )
        ).toBe(true);
        expect(fixture.record.runtimeStatusDecisionReceipts ?? []).toEqual([]);
      } finally {
        rmSync(fixture.root, { recursive: true, force: true });
      }
    });
  }
});
