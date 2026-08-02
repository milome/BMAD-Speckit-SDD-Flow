import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, relative, resolve } from 'node:path';
import type { Reporter, SerializedError, TestModule, TestRunEndReason } from 'vitest/node';

const require = createRequire(import.meta.url);
const { canonicalJsonBytes, sha256Bytes } = require('../test-portfolio-audit/canonical.cjs') as {
  canonicalJsonBytes: (value: unknown) => Buffer;
  sha256Bytes: (value: Buffer) => string;
};
const { normalizeTimingTestPath } = require('./summarize-test-timings.cjs') as {
  normalizeTimingTestPath: (value: unknown, code?: string) => string;
};

export default class CanonicalTimingReporter implements Reporter {
  constructor(private readonly outputFile: string) {}

  private resolveCommitSha() {
    const commitSha = process.env.CI_COMMIT_SHA?.trim();
    if (!commitSha || !/^[0-9a-f]{40}$/iu.test(commitSha)) {
      throw new Error('CI_TIMING_COMMIT_SHA_REQUIRED');
    }
    return commitSha.toLowerCase();
  }

  private resolvePlanHash() {
    const planHash = process.env.CI_PLAN_HASH?.trim();
    if (!planHash || !/^sha256:[0-9a-f]{64}$/iu.test(planHash)) {
      throw new Error('CI_TIMING_PLAN_HASH_REQUIRED');
    }
    return planHash.toLowerCase();
  }

  onTestRunEnd(
    modules: ReadonlyArray<TestModule>,
    _errors: ReadonlyArray<SerializedError>,
    _reason: TestRunEndReason
  ) {
    const commitSha = this.resolveCommitSha();
    const planHash = this.resolvePlanHash();
    const observedModules = modules.flatMap((module) => {
      const outcome = module.state();
      if (outcome !== 'passed' && outcome !== 'failed' && outcome !== 'skipped') return [];
      return [{ module, outcome }];
    });
    const events = observedModules
      .map(({ module, outcome }) => {
        const repoRoot = resolve(process.cwd());
        const modulePath = resolve(module.moduleId);
        const testPath = normalizeTimingTestPath(
          relative(repoRoot, modulePath),
          'CI_TIMING_TEST_PATH_INVALID'
        );
        const observedDurationMs =
          module.diagnostic()?.duration ?? (outcome === 'skipped' ? 0 : Number.NaN);
        if (!Number.isFinite(observedDurationMs) || observedDurationMs < 0) {
          throw new Error('CI_TIMING_DURATION_INVALID');
        }
        const durationMs = Math.max(1, Math.ceil(observedDurationMs));
        return {
          eventId: sha256Bytes(
            canonicalJsonBytes({
              commitSha,
              identityKey: `vitest::${testPath}`,
            })
          ),
          identityKey: `vitest::${testPath}`,
          runnerId: 'vitest',
          testPath,
          durationMs,
          outcome,
        };
      })
      .sort((left, right) => left.identityKey.localeCompare(right.identityKey, 'en'));
    mkdirSync(dirname(this.outputFile), { recursive: true });
    writeFileSync(this.outputFile, canonicalJsonBytes({ commitSha, planHash, events }));
  }
}
