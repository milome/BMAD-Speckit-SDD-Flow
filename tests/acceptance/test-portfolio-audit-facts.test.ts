import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { collectAuditFacts } = require('../../tools/test-portfolio-audit/facts.cjs');
const { reduceAudit } = require('../../tools/test-portfolio-audit/audit.cjs');

const FIXTURE = join(process.cwd(), 'tests/fixtures/test-portfolio-audit/criticality');

describe('test portfolio audit facts', () => {
  it('collects complete facts without creating report artifacts', async () => {
    const timings = { 'root-vitest#tests/package-install.test.ts': 125 };
    expect(existsSync(join(FIXTURE, '.artifacts'))).toBe(false);

    const facts = await collectAuditFacts({
      repoRoot: FIXTURE,
      probeLimit: 0,
      probeBudgetMs: 0,
      probeSandboxRoot: null,
      timings,
    });

    expect(existsSync(join(FIXTURE, '.artifacts'))).toBe(false);
    expect(facts.schemaVersion).toBe('test-portfolio-audit-facts/v1');
    expect(facts.discovery.complete).toBe(true);
    expect(facts.timings).toBe(timings);

    const installIdentity = facts.inventory.tests.find(
      (test: { runnerId: string; testPath: string }) =>
        test.runnerId === 'root-vitest' && test.testPath === 'tests/package-install.test.ts'
    );
    expect(installIdentity.identityKey.replace('#', '::')).toBe(
      'root-vitest::tests/package-install.test.ts'
    );

    const criticality = facts.analyzerResults.find(
      (result: { dimension: string }) => result.dimension === 'criticality'
    );
    const bindingKinds = Object.fromEntries(
      criticality.findings
        .filter((finding: { bindings?: object[] }) => finding.bindings?.length)
        .map((finding: { identityKey: string; bindings: { kind: string }[] }) => [
          finding.identityKey.replace('#', '::'),
          finding.bindings.map((binding) => binding.kind).sort(),
        ])
    );

    expect(bindingKinds).toEqual({
      'root-vitest::tests/cli-bin.test.ts': [
        'cli_bin',
        'consumer_compatibility',
        'package_install',
      ],
      'root-vitest::tests/package-install.test.ts': [
        'cli_bin',
        'consumer_compatibility',
        'package_install',
      ],
      'root-vitest::tests/packaged-runtime.test.ts': ['packaged_runtime'],
    });

    const bindingContracts = criticality.findings
      .filter((finding: { bindings?: object[] }) => finding.bindings?.length)
      .flatMap(
        (finding: { bindings: { evidenceRef: string; selectionRef?: string }[] }) =>
          finding.bindings
      );
    const installBindings = bindingContracts.filter((binding) =>
      binding.evidenceRef.endsWith('testPortfolioAudit.criticalBindings[0]')
    );
    const runtimeBindings = bindingContracts.filter((binding) =>
      binding.evidenceRef.endsWith('testPortfolioAudit.criticalBindings[1]')
    );

    expect(installBindings).not.toHaveLength(0);
    expect(
      installBindings.every((binding) => binding.selectionRef === 'script:critical:install')
    ).toBe(true);
    expect(runtimeBindings).not.toHaveLength(0);
    expect(
      runtimeBindings.every((binding) => binding.selectionRef === 'script:critical:runtime')
    ).toBe(true);
    expect(
      bindingContracts.every((binding) => binding.evidenceRef.startsWith('source:package.json#'))
    ).toBe(true);
  });

  it('feeds the existing reducer without changing Phase 1 report semantics', async () => {
    const facts = await collectAuditFacts({
      repoRoot: FIXTURE,
      probeLimit: 0,
      probeBudgetMs: 0,
      probeSandboxRoot: null,
      timings: {},
    });
    const reduced = reduceAudit(facts);

    expect(reduced.artifact.status).toBe('COMPLETE');
    expect(reduced.artifact.tests.length).toBe(facts.inventory.tests.length);
    expect(reduced.artifact.tests.every((test: object) => !('bindings' in test))).toBe(true);
  });

  it('does not register nested fixture package scripts as production Node runners', async () => {
    const facts = await collectAuditFacts({
      repoRoot: process.cwd(),
      probeLimit: 0,
      probeBudgetMs: 0,
      probeSandboxRoot: null,
      timings: {},
    });

    expect(
      facts.inventory.tests
        .filter(
          (test: { runnerId: string; testPath: string }) =>
            test.runnerId === 'node-test' && test.testPath.startsWith('tests/fixtures/')
        )
        .map((test: { identityKey: string }) => test.identityKey)
    ).toEqual([]);
  }, 300_000);
});
