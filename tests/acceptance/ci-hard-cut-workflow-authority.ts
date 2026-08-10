import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { expect, it } from 'vitest';
import { runProfileWithSelectionStatus } from './ci-hard-cut-governed-profile.fixture';

const require = createRequire(import.meta.url);
const { verifyCiAuthorityHardCut } = require('../../tools/ci/verify-ci-authority-hard-cut.cjs');

function readWorkflowSource(filePath: string) {
  return readFileSync(filePath, 'utf8').replace(/\r\n?/gu, '\n');
}

function sources() {
  return {
    ciSource: readWorkflowSource('.github/workflows/ci.yml'),
    releaseSource: readWorkflowSource('.github/workflows/release.yml'),
    publishSource: readWorkflowSource('.github/workflows/publish-npm.yml'),
    packageJson: JSON.parse(readFileSync('package.json', 'utf8')),
  };
}

export function registerWorkflowAuthorityTests() {
  it('omits absent failure evidence and lets an explicit path override the default', () => {
    const withoutFailureRecords = runProfileWithSelectionStatus('blocked');
    const explicitFailureRecords =
      '.artifacts/test-portfolio/explicit-product-failure-records.json';
    const withOverride = runProfileWithSelectionStatus('blocked', {
      seedDefaultFailureRecords: true,
      failureRecordsPath: explicitFailureRecords,
    });
    const { parseCliArgs } = require('../../tools/ci/run-governed-profile.cjs');

    expect(withoutFailureRecords.coverageArgs).not.toContain('--failure-records');
    expect(withOverride.coverageArgs).toEqual(
      expect.arrayContaining(['--failure-records', explicitFailureRecords])
    );
    expect(
      parseCliArgs(['--profile', 'pr-fast', '--failure-records', explicitFailureRecords])
    ).toMatchObject({
      profile: 'pr-fast',
      'failure-records': explicitFailureRecords,
    });
  });

  it('exposes one fail-closed CLI for every production authority module', () => {
    for (const modulePath of [
      '../../tools/ci/generate-test-catalog.cjs',
      '../../tools/ci/freeze-core-portfolio.cjs',
      '../../tools/ci/generate-six-model-coverage-gap-report.cjs',
      '../../tools/ci/build-product-failure-records.cjs',
      '../../tools/ci/select-ci-tests.cjs',
      '../../tools/ci/build-shard-plan.cjs',
      '../../tools/ci/write-ci-run-manifest.cjs',
      '../../tools/ci/join-ci-evidence.cjs',
    ]) {
      expect(require(modulePath).main, modulePath).toBeTypeOf('function');
    }
  });

  it('binds product failure evidence to the formal producer CLI without temp authority', () => {
    const {
      parseCliArgs: parseProductFailureArgs,
    } = require('../../tools/ci/build-product-failure-records.cjs');
    const source = readWorkflowSource('tools/ci/build-product-failure-records.cjs');

    expect(
      parseProductFailureArgs([
        '--test-report',
        '.artifacts/test-portfolio/vitest-report.json',
        '--catalog',
        '.artifacts/test-portfolio/test-catalog.json',
        '--run-receipt',
        '.artifacts/test-portfolio/run-receipt.json',
        '--selection',
        '.artifacts/test-portfolio/test-selection.json',
      ])
    ).toMatchObject({
      testReport: '.artifacts/test-portfolio/vitest-report.json',
      catalog: '.artifacts/test-portfolio/test-catalog.json',
      runReceipt: '.artifacts/test-portfolio/run-receipt.json',
      selections: ['.artifacts/test-portfolio/test-selection.json'],
      output: '.artifacts/test-portfolio/product-failure-records.json',
    });
    expect(source).toContain("schemaVersion: 'product-failure-records/v1'");
    expect(source).not.toContain('.codex-tmp');
  });

  it('accepts the production workflow as one fail-closed authority', () => {
    const source = sources();
    expect(verifyCiAuthorityHardCut(source)).toMatchObject({
      catalogProducerCount: 1,
      selectionProducerCount: 1,
      semanticIndexProducerCount: 1,
      packagePrepareAuthorityCount: 1,
      planningAuthorityStepCount: 1,
      diagnosticsSummaryStepCount: 1,
      diagnosticsUploadCount: 1,
      tolerantPlanDownloadCount: 1,
      tolerantLaneDownloadCount: 1,
      blockedDiagnosticsStepCount: 1,
      blockedDiagnosticsSummaryStepCount: 1,
      prFastPlanningBudgetSeconds: 90,
      classifyTimeoutMinutes: 5,
      serialAllTestsJobCount: 0,
      oldSelectionFallbackCount: 0,
      modelInvocationCount: 0,
      independentPublishAuthorityCount: 0,
    });
    expect(source.packageJson.scripts['ci:semantic-index']).toBe(
      'node tools/ci/build-shard-semantic-index.cjs'
    );
    expect(source.packageJson.scripts['ci:diagnostics']).toBe(
      'node tools/ci/build-six-model-ci-diagnostics.cjs'
    );
    expect(source.ciSource).toContain(
      '--semantic-index .artifacts/test-portfolio/ci-shard-semantic-index.json'
    );
    expect(source.ciSource).toContain('$GITHUB_STEP_SUMMARY');
    expect(source.ciSource).toContain('six-model-ci-diagnostics.md');
    expect(source.ciSource).toContain('canonicalJsonBytes(rows)');
    expect(source.ciSource).toContain('canonicalJsonBytes([])');
  });

  it('guards the blocked-selection diagnostics summary when no report was produced', () => {
    const blockedSummaryStep = sources().ciSource.match(
      /- name: Publish blocked-selection diagnostic summary[\s\S]*?(?=\n\s+- (?:name|uses):)/u
    )?.[0];

    expect(blockedSummaryStep).toContain(
      'report=.artifacts/test-portfolio/final/six-model-ci-diagnostics.md'
    );
    expect(blockedSummaryStep).toContain('if [ -f "$report" ]; then');
  });

  it('runs TypeScript diagnostics for the six-model acceptance test', () => {
    expect(sources().ciSource).toContain(
      'npx tsc --noEmit --target ES2022 --lib ES2022 --module ES2022 --moduleResolution node --strict --esModuleInterop --skipLibCheck --resolveJsonModule tests/acceptance/ci-six-model-diagnostics.test.ts'
    );
  });

  it('requires tolerant plan and lane downloads independently', () => {
    const base = sources();
    const withoutLaneDownload = {
      ...base,
      ciSource: base.ciSource.replace(
        '          pattern: ci-lane-*',
        '          name: ci-plan-duplicate-${{ github.sha }}'
      ),
    };

    expect(() => verifyCiAuthorityHardCut(withoutLaneDownload)).toThrow(
      'CI_DIAGNOSTICS_INGESTION_PATH_REQUIRED'
    );
  });

  it('rejects old fallback, model execution, second pack, and matrix path authority', () => {
    const base = sources();
    const mutations = [
      {
        label: 'production test:ci fallback',
        source: {
          ...base,
          ciSource: base.ciSource.replace(
            '      - name: Prepare the canonical package once',
            '      - run: npm run test:ci\n\n      - name: Prepare the canonical package once'
          ),
        },
        code: 'CI_OLD_SELECTION_FALLBACK',
      },
      {
        label: 'model credential',
        source: {
          ...base,
          ciSource: base.ciSource.replace(
            '      - name: Prepare the canonical package once',
            '      - run: echo "$OPENAI_API_KEY"\n\n      - name: Prepare the canonical package once'
          ),
        },
        code: 'CI_MODEL_INVOCATION_FORBIDDEN',
      },
      {
        label: 'second package authority',
        source: {
          ...base,
          releaseSource: base.releaseSource.replace(
            '      - run: npm ci',
            '      - run: npm ci\n\n      - run: npm pack'
          ),
        },
        code: 'CI_SECOND_PACKAGE_AUTHORITY',
      },
      {
        label: 'matrix path authority',
        source: {
          ...base,
          ciSource: base.ciSource.replace(
            '${{ fromJSON(needs.classify.outputs.matrix) }}',
            '${{ fromJSON(needs.classify.outputs.testPath) }}'
          ),
        },
        code: 'CI_MATRIX_TEST_PATH_FORBIDDEN',
      },
      {
        label: 'contributor profile downgrade',
        source: {
          ...base,
          ciSource: base.ciSource.replace(
            'pull_request)\n              profile=pr-fast',
            'pull_request)\n              profile="${INPUT_PROFILE:-pr-fast}"'
          ),
        },
        code: 'CI_CONTRIBUTOR_PROFILE_DOWNGRADE',
      },
      {
        label: 'second Catalog producer',
        source: {
          ...base,
          ciSource: base.ciSource.replace(
            'npm run ci:catalog --',
            'npm run ci:catalog --\n          npm run ci:catalog --'
          ),
        },
        code: 'CI_CATALOG_AUTHORITY_COUNT',
      },
      {
        label: 'semantic index producer removed',
        source: {
          ...base,
          ciSource: base.ciSource.replace(/^.*run_stage ci:semantic-index.*\n/mu, ''),
        },
        code: 'CI_SEMANTIC_INDEX_AUTHORITY_COUNT',
      },
      {
        label: 'diagnostics summary removed',
        source: {
          ...base,
          ciSource: base.ciSource.replaceAll('$GITHUB_STEP_SUMMARY', '$REMOVED_SUMMARY'),
        },
        code: 'CI_DIAGNOSTICS_SUMMARY_REQUIRED',
      },
      {
        label: 'pr-fast planning timeout bypass',
        source: {
          ...base,
          ciSource: base.ciSource.replace(
            'timeout --foreground --signal=TERM --kill-after=10s',
            'bash'
          ),
        },
        code: 'CI_PR_FAST_PLANNING_BUDGET_REQUIRED',
      },
      {
        label: 'classify timeout removed',
        source: {
          ...base,
          ciSource: base.ciSource.replace('    timeout-minutes: 5\n', ''),
        },
        code: 'CI_CLASSIFY_TIMEOUT_INVALID',
      },
      {
        label: 'skipped required lane',
        source: {
          ...base,
          ciSource: base.ciSource.replace(
            '  evidence-join:\n    if: always()',
            "  evidence-join:\n    if: ${{ needs.execute-shard.result == 'success' }}"
          ),
        },
        code: 'CI_EVIDENCE_JOIN_NOT_ALWAYS',
      },
      {
        label: 'release parity bypass',
        source: {
          ...base,
          releaseSource: base.releaseSource.replace(
            'npm run ci:verify-release-parity',
            'echo parity-bypassed'
          ),
        },
        code: 'RELEASE_EVIDENCE_PARITY_REQUIRED',
      },
    ];

    for (const mutation of mutations) {
      expect(() => verifyCiAuthorityHardCut(mutation.source), mutation.label).toThrow(
        mutation.code
      );
    }
  });
}
