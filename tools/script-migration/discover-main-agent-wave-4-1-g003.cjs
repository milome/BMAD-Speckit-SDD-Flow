#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = path.resolve(__dirname, '..', '..');
const ORIGINAL_PATH = 'scripts/main-agent-orchestration.ts';
const OWNER_TASK_ID = 'G003';
const ENTRY_ID = 'main-agent-orchestration';
const WAVE_DIR = 'repo-governance/script-migrations/main-agent-runtime-migration-wave-4.1';
const DEFAULT_OUTPUT_PATH = `${WAVE_DIR}/owner-matrices/G003.main-agent-orchestration.discovery.json`;

const REQUIRED_G003_ACTIONS = [
  'inspect',
  'dispatch-plan',
  'run-loop',
  'claim',
  'dispatch',
  'complete',
  'invalidate',
  'route-intake',
  'adaptive-intake',
  'confirm-scope',
  'confirmation-ingest',
  'confirm-closeout-acceptance',
  'closeout-acceptance-ingest',
  'route-confirmation-drift',
  'confirmation-drift-route',
  'repair-confirmation-bookkeeping',
  'confirmation-bookkeeping-repair',
  'pre-confirmation-drilldown',
  'pre_confirmation_drilldown',
  'author-confirmation-ready-source',
  'author_confirmation_ready_source',
  'authoring-repair',
  'authoring_repair',
  'post-close-defect-intake',
  'controlled-readiness-audit',
];

function repoPath(relativePath) {
  return path.join(ROOT, relativePath);
}

function normalizePath(value) {
  return String(value || '').replace(/\\/g, '/');
}

function sha256Text(value) {
  return `sha256:${crypto.createHash('sha256').update(canonicalizeText(value), 'utf8').digest('hex')}`;
}

function canonicalizeText(value) {
  return String(value || '').replace(/\r\n|\r/gu, '\n');
}

function readCanonicalText(relativePath) {
  return canonicalizeText(fs.readFileSync(repoPath(relativePath), 'utf8'));
}

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right));
}

function collectMatches(source, regex, groupIndex = 1) {
  const values = [];
  let match;
  while ((match = regex.exec(source)) !== null) {
    values.push(match[groupIndex]);
  }
  return values;
}

function sourceLineAnchors(lines, matcher) {
  const anchors = [];
  for (let index = 0; index < lines.length; index += 1) {
    const text = lines[index];
    if (!matcher(text)) continue;
    anchors.push({
      line: index + 1,
      anchor: `${ORIGINAL_PATH}:${index + 1}`,
      text: text.trim(),
    });
  }
  return anchors;
}

function actionLineAnchors(lines, action) {
  const quoted = [`'${action}'`, `"${action}"`];
  return sourceLineAnchors(lines, (line) => quoted.some((needle) => line.includes(needle))).map(
    ({ line, anchor, text }) => ({ line, anchor, text })
  );
}

function parseArgs(argv) {
  const args = {
    json: false,
    write: false,
    output: DEFAULT_OUTPUT_PATH,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--json') args.json = true;
    else if (arg === '--write') args.write = true;
    else if (arg === '--output' && argv[index + 1]) args.output = normalizePath(argv[++index]);
    else throw new Error(`unknown argument: ${arg}`);
  }
  return args;
}

function discover() {
  const source = readCanonicalText(ORIGINAL_PATH);
  const lines = source.split(/\n/u);
  const actionsFromComparisons = collectMatches(source, /action\s*(?:={2,3}|!={1,2})\s*['"]([^'"]+)['"]/gu);
  const actionsFromCases = collectMatches(source, /case\s+['"]([^'"]+)['"]\s*:/gu);
  const actionAliases = uniqueSorted([...actionsFromComparisons, ...actionsFromCases]);
  const parseArgFlags = uniqueSorted(collectMatches(source, /token\s*===\s*['"](--[^'"]+)['"]/gu));
  const envKeys = uniqueSorted(collectMatches(source, /process\.env\.([A-Z0-9_]+)/gu));
  const fileOperationAnchors = sourceLineAnchors(lines, (line) =>
    /\bfs\.(?:readFileSync|writeFileSync|mkdirSync|copyFileSync|rmSync|existsSync)\b/u.test(line)
  );
  const errorPathAnchors = sourceLineAnchors(lines, (line) =>
    /console\.error|throw new Error|return 1|unsupported action=/u.test(line)
  );
  const entryPointAnchors = sourceLineAnchors(lines, (line) =>
    /mainMainAgentOrchestration|mainMainAgentOrchestrationAsync|isDirectMainAgentOrchestrationCli|parseArgs/u.test(
      line
    )
  );
  const discoveredRequiredActionStatus = REQUIRED_G003_ACTIONS.map((action) => {
    const anchors = actionLineAnchors(lines, action);
    return {
      action,
      discovered: anchors.length > 0,
      sourceLineAnchors: anchors.slice(0, 12),
    };
  });
  const missingRequiredActions = discoveredRequiredActionStatus
    .filter((item) => !item.discovered)
    .map((item) => item.action);
  const actionScenarioBlueprints = discoveredRequiredActionStatus.map((item) => ({
    action: item.action,
    originalEntryPoint: ORIGINAL_PATH,
    originalEntryCommandBlueprint: `node ${ORIGINAL_PATH} --action ${item.action} --cwd <fixture-root>`,
    packageEntryPointStatus: 'blocked_until_package_source_equivalence_is_implemented',
    packageEntryCommandStatus: 'blocked_until_package_source_equivalence_is_implemented',
    argsStatus: 'blocked_until_owner_task_replays_original',
    envStatus:
      envKeys.length > 0
        ? 'blocked_until_owner_task_replays_env_variants'
        : 'no_env_keys_discovered_in_source',
    expectedOutputStatus: 'blocked_until_original_replay_or_source_derived_expected_output_is_recorded',
    replayStatus: 'blocked_until_package_implementation_exists',
    sourceLineAnchors: item.sourceLineAnchors,
  }));

  return {
    schemaVersion: 'main-agent-runtime-migration-wave-4-1-g003-discovery/v1',
    waveId: 'main-agent-runtime-migration-wave-4.1',
    ownerTaskId: OWNER_TASK_ID,
    entryId: ENTRY_ID,
    originalPath: ORIGINAL_PATH,
    status: 'discovery_only_not_completion_evidence',
    completionEvidenceAllowed: false,
    ledgerMutationAllowed: false,
    packageImplementationSetAllowed: false,
    behaviorEquivalenceMatrixAllowed: false,
    source: {
      path: ORIGINAL_PATH,
      sha256: sha256Text(source),
      bytes: Buffer.byteLength(source, 'utf8'),
      loc: lines.length,
    },
    discovered: {
      entryPoints: entryPointAnchors,
      actionAliases,
      requiredG003Actions: discoveredRequiredActionStatus,
      missingRequiredActions,
      parseArgFlags,
      envKeys,
      fileOperationAnchors,
      errorPathAnchors,
    },
    scenarioBlueprints: actionScenarioBlueprints,
    nextRequiredWork: [
      'Implement package source equivalents under packages/bmad-speckit/src/main-agent/**.',
      'Replay original commands from this discovery against source-derived or original-replay expected outputs.',
      'Write real behaviorEquivalenceMatrix rows only after package source entry points exist.',
      'Do not use this discovery artifact as packageImplementationSet, replay proof, size proof, or no-fallback proof.',
    ],
  };
}

function writeDiscovery(outputPath, discovery) {
  const target = repoPath(outputPath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(discovery, null, 2)}\n`, 'utf8');
  return {
    path: outputPath,
    sha256: sha256Text(fs.readFileSync(target, 'utf8')),
    bytes: fs.statSync(target).size,
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const discovery = discover();
  if (args.write) {
    discovery.writtenArtifact = writeDiscovery(args.output, discovery);
  }
  process.stdout.write(args.json ? `${JSON.stringify(discovery, null, 2)}\n` : `${discovery.status}\n`);
  if (discovery.discovered.missingRequiredActions.length > 0) process.exitCode = 1;
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${error.stack || error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  DEFAULT_OUTPUT_PATH,
  REQUIRED_G003_ACTIONS,
  discover,
};
