#!/usr/bin/env node
/**
 * Bundles repo-root CLIs into dist/*.cjs:
 * - scripts/emit-runtime-policy.ts → emit-runtime-policy.cjs
 * - scripts/i18n/resolve-for-session-cli.ts → resolve-for-session.cjs
 * - scripts/i18n/render-audit-block-cli.ts → render-audit-block.cjs
 * Invoked by prepare/prepublishOnly and `npm run build` from this package.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const esbuild = require('esbuild');

const governanceHookAliasPlugin = {
  name: 'governance-hook-alias',
  setup(build) {
    const aliasMap = new Map([
      [
        '../_bmad/runtime/hooks/governance-runner-summary-presenter.cjs',
        path.join(repoRoot, '_bmad', 'runtime', 'hooks', 'governance-runner-summary-presenter.cjs'),
      ],
      [
        '../_bmad/runtime/hooks/governance-runner-summary-format.cjs',
        path.join(repoRoot, '_bmad', 'runtime', 'hooks', 'governance-runner-summary-format.cjs'),
      ],
      [
        '../_bmad/runtime/hooks/governance-stage-event-emitter.cjs',
        path.join(repoRoot, '_bmad', 'runtime', 'hooks', 'governance-stage-event-emitter.cjs'),
      ],
    ]);

    for (const [request, target] of aliasMap.entries()) {
      build.onResolve(
        { filter: new RegExp('^' + request.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$') },
        () => ({
          path: target,
        })
      );
    }
  },
};

const governanceRuntimeConsumerPathPlugin = {
  name: 'governance-runtime-consumer-paths',
  setup(build) {
    build.onResolve(
      {
        filter: /^\.\.\/packages\/scoring\/(governance\/write-rerun-history|query\/loader|query)$/,
      },
      (args) => {
        const map = {
          '../packages/scoring/governance/write-rerun-history': path.join(
            repoRoot,
            'packages',
            'scoring',
            'governance',
            'write-rerun-history.ts'
          ),
          '../packages/scoring/query/loader': path.join(
            repoRoot,
            'packages',
            'scoring',
            'query',
            'loader.ts'
          ),
          '../packages/scoring/query': path.join(
            repoRoot,
            'packages',
            'scoring',
            'query',
            'index.ts'
          ),
        };
        return { path: map[args.path] };
      }
    );
    build.onResolve({ filter: /^\.\/constants\/path$/ }, () => ({
      path: path.join(repoRoot, 'packages', 'scoring', 'constants', 'path.ts'),
    }));
  },
};

const pkgDir = __dirname;
const repoRoot = path.resolve(pkgDir, '../..');
const outDir = path.join(pkgDir, 'dist');
const workerEntry = path.join(repoRoot, 'scripts', 'bmad-runtime-worker.ts');
const runnerEntry = path.join(repoRoot, 'scripts', 'governance-remediation-runner.ts');
const dispatchWorkerEntry = path.join(repoRoot, 'scripts', 'governance-packet-dispatch-worker.ts');
const executionResultIngestorEntry = path.join(
  repoRoot,
  'scripts',
  'governance-execution-result-ingestor.ts'
);
const packetReconcilerEntry = path.join(repoRoot, 'scripts', 'governance-packet-reconciler.ts');
const auditIndexEntry = path.join(repoRoot, 'scripts', 'update-runtime-audit-index.ts');
const auditorPostActionsEntry = path.join(repoRoot, 'scripts', 'auditor-post-actions.ts');
const auditorHostEntry = path.join(repoRoot, 'scripts', 'run-auditor-host.ts');
const bundles = [
  {
    entry: path.join(repoRoot, 'scripts', 'emit-runtime-policy.ts'),
    outfile: path.join(outDir, 'emit-runtime-policy.cjs'),
    label: 'emit-runtime-policy',
  },
  {
    entry: path.join(repoRoot, 'scripts', 'i18n', 'resolve-for-session-cli.ts'),
    outfile: path.join(outDir, 'resolve-for-session.cjs'),
    label: 'resolve-for-session',
  },
  {
    entry: path.join(repoRoot, 'scripts', 'i18n', 'render-audit-block-cli.ts'),
    outfile: path.join(outDir, 'render-audit-block.cjs'),
    label: 'render-audit-block',
  },
  {
    entry: path.join(pkgDir, 'src', 'consumer-mcp-server.js'),
    outfile: path.join(outDir, 'consumer-mcp-server.cjs'),
    label: 'consumer-mcp-server',
  },
  {
    entry: workerEntry,
    outfile: path.join(outDir, 'governance-runtime-worker.cjs'),
    label: 'governance-runtime-worker',
  },
  {
    entry: runnerEntry,
    outfile: path.join(outDir, 'governance-remediation-runner.cjs'),
    label: 'governance-remediation-runner',
  },
  {
    entry: dispatchWorkerEntry,
    outfile: path.join(outDir, 'governance-packet-dispatch-worker.cjs'),
    label: 'governance-packet-dispatch-worker',
  },
  {
    entry: executionResultIngestorEntry,
    outfile: path.join(outDir, 'governance-execution-result-ingestor.cjs'),
    label: 'governance-execution-result-ingestor',
  },
  {
    entry: packetReconcilerEntry,
    outfile: path.join(outDir, 'governance-packet-reconciler.cjs'),
    label: 'governance-packet-reconciler',
  },
  {
    entry: auditIndexEntry,
    outfile: path.join(outDir, 'update-runtime-audit-index.cjs'),
    label: 'update-runtime-audit-index',
  },
  {
    entry: auditorPostActionsEntry,
    outfile: path.join(outDir, 'auditor-post-actions.cjs'),
    label: 'auditor-post-actions',
  },
  {
    entry: auditorHostEntry,
    outfile: path.join(outDir, 'run-auditor-host.cjs'),
    label: 'run-auditor-host',
  },
];

fs.mkdirSync(outDir, { recursive: true });

async function main() {
  for (const { entry, outfile, label } of bundles) {
    if (!fs.existsSync(entry)) {
      console.error(`runtime-emit build: missing entry for ${label}:`, entry);
      process.exit(1);
    }
    await esbuild.build({
      entryPoints: [entry],
      bundle: true,
      platform: 'node',
      format: 'cjs',
      target: 'node18',
      plugins: [governanceHookAliasPlugin, governanceRuntimeConsumerPathPlugin],
      outfile,
    });
    console.log('runtime-emit: wrote', path.relative(repoRoot, outfile));
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
