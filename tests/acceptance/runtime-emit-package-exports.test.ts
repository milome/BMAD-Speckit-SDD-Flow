import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { build } from 'esbuild';
import { describe, expect, it } from 'vitest';

const ROOT = join(import.meta.dirname, '..', '..');

describe('runtime-emit package exports', () => {
  it('bundles the controlled closeout admission boundary through ESM exports', async () => {
    await expect(
      build({
        entryPoints: [
          join(
            ROOT,
            'packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-controlled-closeout-confirmation.ts'
          ),
        ],
        bundle: true,
        platform: 'node',
        format: 'cjs',
        target: 'node18',
        write: false,
        logLevel: 'silent',
      })
    ).resolves.toMatchObject({ errors: [] });
  });

  it('publishes auditor orchestration bundles for consumer hosts', () => {
    const pkg = JSON.parse(
      readFileSync(join(ROOT, 'packages/runtime-emit/package.json'), 'utf8')
    ) as { exports: Record<string, string> };
    const readme = readFileSync(join(ROOT, 'packages/runtime-emit/README.md'), 'utf8');

    expect(pkg.exports['./dist/update-runtime-audit-index.cjs']).toBe(
      './dist/update-runtime-audit-index.cjs'
    );
    expect(pkg.exports['./dist/auditor-post-actions.cjs']).toBe('./dist/auditor-post-actions.cjs');
    expect(pkg.exports['./dist/run-auditor-host.cjs']).toBe('./dist/run-auditor-host.cjs');

    expect(readme).toContain('dist/update-runtime-audit-index.cjs');
    expect(readme).toContain('dist/auditor-post-actions.cjs');
    expect(readme).toContain('dist/run-auditor-host.cjs');
  });

  it('does not publish legacy worker-era bundles as accepted consumer exports', () => {
    const pkg = JSON.parse(
      readFileSync(join(ROOT, 'packages/runtime-emit/package.json'), 'utf8')
    ) as { exports: Record<string, string> };
    const exportKeys = Object.keys(pkg.exports);
    expect(
      exportKeys.filter((key) =>
        /\/dist\/(?:run-bmad-.*|governance-cursor-agent-.*|governance-.*(?:worker|runner|ingestor|reconciler))\.cjs$/i.test(
          key
        )
      )
    ).toHaveLength(0);
  });
});
