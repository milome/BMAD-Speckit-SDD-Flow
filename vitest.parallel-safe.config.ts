import { defineConfig, mergeConfig } from 'vitest/config';
import base from './vitest.config';
import CanonicalTimingReporter from './tools/ci/vitest-timing-reporter';

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`CI_REPORT_OUTPUT_REQUIRED:${name}`);
  return value;
}

export default mergeConfig(
  base,
  defineConfig({
    test: {
      fileParallelism: true,
      maxWorkers: Number(process.env.CI_VITEST_WORKERS || 4),
      reporters: [
        'default',
        ['junit', { classnameTemplate: '{filepath}' }],
        new CanonicalTimingReporter(requiredEnv('CI_TIMING_OUTPUT')),
      ],
      outputFile: { junit: requiredEnv('CI_JUNIT_OUTPUT') },
    },
  })
);
