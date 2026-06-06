#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');
const {
  CLOSURE_AUDIT_PATH,
  loadSafeWriteReceipts,
  rel: evidenceRel,
  safeWriteFile,
  saveSafeWriteReceipts,
} = require('./main-agent-wave-3-11-evidence-utils.cjs');

const ROOT = path.resolve(__dirname, '..', '..');
const DEFAULT_OUT = path.join(
  ROOT,
  'repo-governance',
  'script-migrations',
  'consumer-reachable-closure-audit',
  'audit-report.json'
);

const RISK_STRATEGIES = new Set([
  'repo_internal_reclassify',
  'deprecated_no_migration',
  'durable_helper_copy',
]);

const SURFACE_PATHS = [
  'package.json',
  'packages/bmad-speckit/package.json',
  'packages/bmad-speckit/bin',
  'packages/bmad-speckit/src',
  '_bmad/commands',
  '_bmad/_config',
  '.codex/commands',
  '.cursor/hooks',
  '.cursor/rules',
  '.claude/hooks',
  'scripts/README.md',
  'packages/scoring/eval-questions/README.md',
  'README.zh-CN.md',
  'docs/reference',
  'docs/how-to',
];

const CORRECTION_RECLASSIFICATIONS = {
  'scripts/host-runtime-mode.ts': {
    correctedFrom: 'repo_internal_reclassify_possible',
    correctedTo: 'package_runtime_module',
    evidenceBasis: [
      'tests/acceptance/main-agent-host-runtime-mode.test.ts imports this runtime contract',
      'script selects execution runtime host and writes runtime blocker records',
    ],
    featureFamily: {
      family: 'main_agent_runtime_mode',
      expectedStrategy: 'package_runtime_module',
      confidence: 'confirmed',
      reason: 'runtime host and execution-mode selection is part of the consumer runtime closure',
    },
    recommendation: {
      severity: 'major',
      verdict: 'consumer_runtime_contract_reclassified',
      recommendedStrategy: 'package_runtime_module',
      recommendedAction: 'register as package runtime module migration target, not repo_internal',
      reason: 'runtime mode selection is exercised by Main Agent runtime acceptance coverage',
    },
  },
  'scripts/supervised-worker-runtime.ts': {
    correctedFrom: 'repo_internal_reclassify_possible',
    correctedTo: 'package_runtime_module',
    evidenceBasis: [
      'tests/acceptance/main-agent-supervised-worker-timeout.test.ts imports this runtime contract',
      'script supervises worker heartbeat, timeout, recovery, and blocker state',
    ],
    featureFamily: {
      family: 'main_agent_supervised_worker_runtime',
      expectedStrategy: 'package_runtime_module',
      confidence: 'confirmed',
      reason: 'supervised worker timeout and recovery logic is runtime behavior',
    },
    recommendation: {
      severity: 'major',
      verdict: 'consumer_runtime_contract_reclassified',
      recommendedStrategy: 'package_runtime_module',
      recommendedAction: 'register as package runtime module migration target, not repo_internal',
      reason: 'supervised worker runtime is acceptance-covered Main Agent runtime behavior',
    },
  },
  'scripts/bmad-help-renderer.ts': {
    correctedFrom: 'repo_internal_reclassify_possible',
    correctedTo: 'already_migrated_package_runtime_deprecated_root_path',
    evidenceBasis: [
      'root script path is absent',
      'packages/bmad-speckit/bin/bmad-speckit.js dispatches bmad-help to packages/bmad-speckit/src/runtime/bmad-help-renderer.js',
    ],
    featureFamily: {
      family: 'bmad_help_package_runtime',
      expectedStrategy: 'already_migrated_package_runtime_deprecated_root_path',
      confidence: 'confirmed',
      reason: 'bmad-help is a package CLI/runtime surface and the root TypeScript path is historical',
    },
    recommendation: {
      severity: 'major',
      verdict: 'already_migrated_package_runtime_deprecated_root_path',
      recommendedStrategy: 'already_migrated_package_runtime_deprecated_root_path',
      recommendedAction: 'track as deprecated root path with package runtime authority',
      reason: 'package CLI dispatches bmad-help through package runtime, not root scripts',
    },
  },
  'scripts/bmad-state-reader.ts': {
    correctedFrom: 'repo_internal_reclassify_possible',
    correctedTo: 'package_local_helper',
    evidenceBasis: [
      'script reads BMAD project state files used by runtime diagnostics',
      'state-reader semantics belong to package-local helper closure if consumed outside source repo',
    ],
    featureFamily: {
      family: 'bmad_state_runtime_helper',
      expectedStrategy: 'package_local_helper',
      confidence: 'medium',
      reason: 'BMAD state reading is helper behavior for installed/runtime diagnostics',
    },
    recommendation: {
      severity: 'minor',
      verdict: 'package_helper_candidate_reclassified',
      recommendedStrategy: 'package_local_helper',
      recommendedAction: 'register as package-local helper candidate pending caller proof',
      reason: 'state reader should not be treated as generic source-dev-only internal',
    },
  },
  'scripts/bmads-renderer.ts': {
    correctedFrom: 'repo_internal_reclassify_possible',
    correctedTo: 'already_migrated_package_runtime_deprecated_root_path',
    evidenceBasis: [
      'root script path is absent',
      'packages/bmad-speckit/bin/bmad-speckit.js dispatches bmads and bmad-speckit aliases to packages/bmad-speckit/src/runtime/bmads-renderer.js',
    ],
    featureFamily: {
      family: 'bmads_package_runtime',
      expectedStrategy: 'already_migrated_package_runtime_deprecated_root_path',
      confidence: 'confirmed',
      reason: 'bmads is a package CLI/runtime surface and the root TypeScript path is historical',
    },
    recommendation: {
      severity: 'major',
      verdict: 'already_migrated_package_runtime_deprecated_root_path',
      recommendedStrategy: 'already_migrated_package_runtime_deprecated_root_path',
      recommendedAction: 'track as deprecated root path with package runtime authority',
      reason: 'package CLI dispatches bmads through package runtime, not root scripts',
    },
  },
  'scripts/check-story-score-written.ts': {
    correctedFrom: 'repo_internal_reclassify_possible',
    correctedTo: 'public_cli_package_action_existing_root_legacy',
    evidenceBasis: [
      'packages/bmad-speckit/src/commands/check-score.js is ported from this script',
      'docs/reference/source-code.md maps this script to npx bmad-speckit check-score',
    ],
    featureFamily: {
      family: 'scoring_check_score_cli',
      expectedStrategy: 'public_cli_package_action',
      confidence: 'confirmed',
      reason: 'story scoring completion check is exposed by the package CLI check-score command',
    },
    recommendation: {
      severity: 'major',
      verdict: 'public_cli_package_action_existing_root_legacy',
      recommendedStrategy: 'public_cli_package_action',
      recommendedAction: 'track root script as legacy source path for bmad-speckit check-score',
      reason: 'consumer-facing check-score action exists in package runtime',
    },
  },
  'scripts/eval-question-generate.ts': {
    correctedFrom: 'repo_internal_reclassify',
    correctedTo: 'public_cli_package_action',
    evidenceBasis: [
      'eval question generation is part of the eval-questions user-facing feature family',
      'Wave 3.11 promotes the prior follow-up recommendation into an explicit package CLI action decision',
    ],
    featureFamily: {
      family: 'eval_questions_generate',
      expectedStrategy: 'public_cli_package_action',
      confidence: 'confirmed',
      reason: 'eval question generation belongs to the eval-questions user-facing feature family',
    },
    recommendation: {
      severity: 'blocker',
      verdict: 'public_cli_package_action',
      recommendedStrategy: 'public_cli_package_action',
      recommendedAction: 'add package eval-questions generate action and update registry',
      reason: 'Wave 3.11 closes the previous recommendation-only state as a package CLI action',
    },
  },
  'scripts/create-second-story.ts': {
    correctedFrom: 'repo_internal_reclassify_possible',
    correctedTo: 'repo_internal_test_seed_only',
    evidenceBasis: [
      'script creates a hard-coded second story for testing',
      'no package CLI or runtime surface signal found',
    ],
    featureFamily: {
      family: 'source_repo_test_seed',
      expectedStrategy: 'repo_internal_test_seed_only',
      confidence: 'medium',
      reason: 'hard-coded source-repo test seed script is not a consumer runtime feature',
    },
    recommendation: {
      severity: 'info',
      verdict: 'repo_internal_test_seed_only',
      recommendedStrategy: 'repo_internal_test_seed_only',
      recommendedAction: 'keep only under narrow test-seed internal classification',
      reason: 'script is hard-coded source repository test setup, not generic runtime internal',
    },
  },
  'scripts/diagnose-bmad-state.ts': {
    correctedFrom: 'repo_internal_reclassify_possible',
    correctedTo: 'package_runtime_module',
    evidenceBasis: [
      'tests/acceptance/diagnose-bmad-state-reviewer-projection.test.ts imports this diagnosis projection',
      'script composes runtime policy, reviewer projection, and scoring readiness diagnostics',
    ],
    featureFamily: {
      family: 'bmad_state_runtime_diagnostics',
      expectedStrategy: 'package_runtime_module',
      confidence: 'confirmed',
      reason: 'diagnostic projection depends on runtime policy and reviewer/scoring closures',
    },
    recommendation: {
      severity: 'major',
      verdict: 'consumer_runtime_contract_reclassified',
      recommendedStrategy: 'package_runtime_module',
      recommendedAction: 'register as package runtime module migration target, not repo_internal',
      reason: 'diagnostic projection is acceptance-covered runtime behavior',
    },
  },
  'scripts/e2e-verify-paths.ts': {
    correctedFrom: 'repo_internal_reclassify_possible',
    correctedTo: 'package_local_helper',
    evidenceBasis: [
      'script validates installed agent/path structure used by BMAD workflow surfaces',
      'path verification belongs to install-surface helper closure if exposed to consumers',
    ],
    featureFamily: {
      family: 'install_surface_path_validator',
      expectedStrategy: 'package_local_helper',
      confidence: 'medium',
      reason: 'installed path validation is package/helper behavior, not generic repo internal',
    },
    recommendation: {
      severity: 'minor',
      verdict: 'package_helper_candidate_reclassified',
      recommendedStrategy: 'package_local_helper',
      recommendedAction: 'register as package-local helper candidate pending caller proof',
      reason: 'path verification may be needed by installed workflow validation',
    },
  },
  'scripts/parallel-mission-control.ts': {
    correctedFrom: 'repo_internal_reclassify_possible',
    correctedTo: 'package_runtime_module',
    evidenceBasis: [
      'tests/acceptance/main-agent-delivery-truth-gate.test.ts imports this runtime contract',
      'tests/acceptance/main-agent-pr-topology.test.ts and parallel mission tests import it',
      'docs/reference/pr-topology-contract.md names this script as canonical implementation',
    ],
    featureFamily: {
      family: 'main_agent_pr_topology_runtime',
      expectedStrategy: 'package_runtime_module',
      confidence: 'confirmed',
      reason: 'PR topology and parallel mission contracts are runtime governance closure',
    },
    recommendation: {
      severity: 'major',
      verdict: 'consumer_runtime_contract_reclassified',
      recommendedStrategy: 'package_runtime_module',
      recommendedAction: 'register as package runtime module migration target, not repo_internal',
      reason: 'parallel mission control is acceptance-covered PR topology runtime behavior',
    },
  },
  'scripts/query-validate.ts': {
    correctedFrom: 'repo_internal_reclassify_possible',
    correctedTo: 'package_local_helper',
    evidenceBasis: [
      'script validates scoring query APIs',
      'docs/reference/source-code.md marks it as production source',
    ],
    featureFamily: {
      family: 'scoring_query_validation_helper',
      expectedStrategy: 'package_local_helper',
      confidence: 'medium',
      reason: 'scoring query validation belongs to package/helper closure if consumer-visible',
    },
    recommendation: {
      severity: 'minor',
      verdict: 'package_helper_candidate_reclassified',
      recommendedStrategy: 'package_local_helper',
      recommendedAction: 'register as package-local helper candidate pending caller proof',
      reason: 'query validation should not remain generic source-dev-only internal without owner proof',
    },
  },
  'scripts/runtime-step-state.ts': {
    correctedFrom: 'repo_internal_reclassify_possible',
    correctedTo: 'package_local_helper',
    evidenceBasis: [
      'script is a wrapper around _bmad/runtime/hooks/runtime-step-state.cjs',
      'runtime step state is used by installed hook/runtime surfaces',
    ],
    featureFamily: {
      family: 'runtime_step_state_helper',
      expectedStrategy: 'package_local_helper',
      confidence: 'confirmed',
      reason: 'runtime step state is hook/runtime helper behavior',
    },
    recommendation: {
      severity: 'major',
      verdict: 'package_helper_candidate_reclassified',
      recommendedStrategy: 'package_local_helper',
      recommendedAction: 'register as package-local helper candidate, not repo_internal',
      reason: 'runtime step state supports installed runtime hooks',
    },
  },
  'scripts/verify-agent-files.ts': {
    correctedFrom: 'repo_internal_reclassify_possible',
    correctedTo: 'package_local_helper',
    evidenceBasis: [
      'script verifies installed .claude agent files and prerequisites',
      'verification is tied to installed workflow surfaces',
    ],
    featureFamily: {
      family: 'install_surface_agent_validator',
      expectedStrategy: 'package_local_helper',
      confidence: 'medium',
      reason: 'agent-file verification is install-surface validation helper behavior',
    },
    recommendation: {
      severity: 'minor',
      verdict: 'package_helper_candidate_reclassified',
      recommendedStrategy: 'package_local_helper',
      recommendedAction: 'register as package-local helper candidate pending caller proof',
      reason: 'agent-file verification should not be generic repo internal if installation validation uses it',
    },
  },
  'scripts/verify-score-auto-scoped-bundle.cjs': {
    correctedFrom: 'repo_internal_reclassify_possible',
    correctedTo: 'repo_internal_verification_harness',
    evidenceBasis: [
      'script is a non-vitest score to scoped-bundle to dashboard verification harness',
      'no direct package CLI or installed runtime surface signal found',
    ],
    featureFamily: {
      family: 'source_repo_verification_harness',
      expectedStrategy: 'repo_internal_verification_harness',
      confidence: 'medium',
      reason: 'verification harness can remain internal only under narrow harness classification',
    },
    recommendation: {
      severity: 'info',
      verdict: 'repo_internal_verification_harness',
      recommendedStrategy: 'repo_internal_verification_harness',
      recommendedAction: 'keep only under narrow verification-harness internal classification',
      reason: 'harness validates package runtime behavior but is not itself a consumer runtime entry',
    },
  },
};

function parseArgs(argv) {
  const args = { out: null, pretty: false, quiet: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--out') {
      args.out = path.resolve(argv[++index]);
    } else if (arg === '--write') {
      args.out = DEFAULT_OUT;
    } else if (arg === '--pretty') {
      args.pretty = true;
    } else if (arg === '--quiet') {
      args.quiet = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return args;
}

function rel(filePath) {
  return path.relative(ROOT, filePath).replace(/\\/g, '/');
}

function readText(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function readJsonIfExists(relativePath) {
  const full = path.join(ROOT, relativePath);
  if (!fs.existsSync(full)) return null;
  return JSON.parse(fs.readFileSync(full, 'utf8'));
}

function listFiles(rootPath) {
  const fullRoot = path.join(ROOT, rootPath);
  if (!fs.existsSync(fullRoot)) return [];
  const stat = fs.statSync(fullRoot);
  if (stat.isFile()) return [fullRoot];
  const files = [];
  const stack = [fullRoot];
  while (stack.length > 0) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === '.git') continue;
        stack.push(full);
      } else if (/\.(?:cjs|js|mjs|json|md|yaml|yml|toml|txt)$/iu.test(entry.name)) {
        files.push(full);
      }
    }
  }
  return files;
}

function parsePriorityMatrix() {
  const text = readText(
    'repo-governance/script-migrations/main-agent-runtime-closure-wave-3/priority-matrix.md'
  );
  const rows = [];
  const rowPattern =
    /^\| `([^`]+)` \| `([^`]+)` \| `([^`]+)` \|\s*([0-9]+) \| `([^`]+)` \|$/gmu;
  for (const match of text.matchAll(rowPattern)) {
    rows.push({
      scriptPath: match[1],
      matrixClassification: match[2],
      matrixStrategy: match[3],
      score: Number(match[4]),
      targetWave: match[5],
      priorityBand: priorityBand(match[4], match[5]),
    });
  }
  return rows;
}

function priorityBand(scoreInput, targetWave) {
  const score = Number(scoreInput);
  if (targetWave === 'main-agent-runtime-migration-wave-3.6') return 'P1';
  if (targetWave === 'main-agent-runtime-migration-wave-3.7') return 'P2';
  if (targetWave === 'main-agent-runtime-migration-wave-3.8') return 'P3';
  if (targetWave === 'main-agent-runtime-migration-wave-3.9') return 'P4';
  if (score <= 10 || targetWave === 'none_deprecated' || targetWave === 'none_source_dev_only') {
    return 'P5';
  }
  if (score >= 90) return 'P0';
  return 'other';
}

function wavePriorityBand(waveId) {
  if (waveId === 'main-agent-runtime-migration-wave-3.6') return 'P1';
  if (waveId === 'main-agent-runtime-migration-wave-3.7') return 'P2';
  if (waveId === 'main-agent-runtime-migration-wave-3.8') return 'P3';
  if (waveId === 'main-agent-runtime-migration-wave-3.9') return 'P4';
  return null;
}

function parseRegistry() {
  const registry = yaml.load(readText('repo-governance/script-migration-registry.yaml'));
  const latest = new Map();
  const allEntries = [];
  for (const wave of registry.waves || []) {
    for (const entry of wave.entries || []) {
      const normalized = {
        waveId: wave.waveId,
        waveStatus: wave.status,
        entryId: entry.entryId,
        scriptPath: entry.originalPath,
        strategy: entry.migrationStrategy,
        migrationStatus: entry.migrationStatus,
        validationStatus: entry.validationStatus,
        targetPaths: entry.targetPaths || [],
        publicCommandsBeforeMigration: entry.publicCommandsBeforeMigration || [],
        publicCommandsAfterMigration: entry.publicCommandsAfterMigration || [],
        oldPathDisposition: entry.oldPathDisposition,
        deletionAllowed: entry.deletionAllowed,
      };
      allEntries.push(normalized);
      latest.set(entry.originalPath, normalized);
    }
  }
  return { registry, latest, allEntries };
}

function collectSurfaceRefs(scriptPath) {
  const basename = path.basename(scriptPath);
  const refs = [];
  const candidates = new Set([scriptPath, basename]);
  for (const surfacePath of SURFACE_PATHS) {
    for (const filePath of listFiles(surfacePath)) {
      const text = fs.readFileSync(filePath, 'utf8');
      const lines = text.split(/\r?\n/u);
      for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index];
        if (![...candidates].some((needle) => line.includes(needle))) continue;
        refs.push({
          path: rel(filePath),
          line: index + 1,
          kind: refKind(rel(filePath)),
          strength: refStrength(rel(filePath), line),
          match: line.trim().slice(0, 240),
        });
      }
    }
  }
  return refs;
}

function refKind(relativePath) {
  if (relativePath === 'package.json' || relativePath.endsWith('/package.json')) return 'package_manifest';
  if (relativePath.startsWith('packages/bmad-speckit/bin/')) return 'package_cli';
  if (relativePath.startsWith('packages/bmad-speckit/src/')) return 'package_runtime_source';
  if (
    relativePath.startsWith('_bmad/') ||
    relativePath.startsWith('.codex/') ||
    relativePath.startsWith('.cursor/') ||
    relativePath.startsWith('.claude/')
  ) {
    return 'installed_surface';
  }
  if (relativePath.startsWith('docs/') || relativePath.endsWith('README.md')) return 'docs';
  return 'other';
}

function refStrength(relativePath, line) {
  const trimmed = line.trim();
  if (/^(?:\/\/|\/\*|\*)/u.test(trimmed)) return 'weak_comment_only';
  if (relativePath.includes('/compiled/')) return 'weak_compiled_bundle';
  if (relativePath === 'package.json' || relativePath.endsWith('/package.json')) {
    return /scripts\/|bin|bmad-speckit/u.test(line) ? 'strong_manifest' : 'weak_manifest_metadata';
  }
  if (relativePath.startsWith('packages/bmad-speckit/bin/')) return 'strong_package_cli';
  if (
    relativePath.startsWith('_bmad/') ||
    relativePath.startsWith('.codex/') ||
    relativePath.startsWith('.cursor/') ||
    relativePath.startsWith('.claude/')
  ) {
    return /(?:path|sourceRepoPath|script|command):|scripts\//u.test(line)
      ? 'strong_installed_surface'
      : 'medium_installed_surface';
  }
  if (relativePath.startsWith('packages/bmad-speckit/src/')) return 'strong_package_runtime';
  if (relativePath.startsWith('docs/') || relativePath.endsWith('README.md')) return 'weak_docs';
  return 'medium_reference';
}

function loadClosureInventory() {
  const inventory = readJsonIfExists(
    'repo-governance/script-migrations/main-agent-runtime-closure-wave-3/closure-inventory.json'
  );
  if (!inventory) return { entries: new Map(), publicSeeds: new Map() };
  return {
    entries: new Map((inventory.closureEntries || []).map((entry) => [entry.scriptPath, entry])),
    publicSeeds: new Map(
      (inventory.publicRunRepoScriptSeeds || []).map((entry) => [entry.scriptPath, entry])
    ),
  };
}

function classifyFamily(scriptPath) {
  const correction = CORRECTION_RECLASSIFICATIONS[scriptPath];
  if (correction) return correction.featureFamily;

  const name = path.basename(scriptPath);
  if (scriptPath === 'scripts/eval-question-generate.ts') {
    return {
      family: 'eval_questions_generate',
      expectedStrategy: 'public_cli_package_action',
      confidence: 'confirmed',
      reason: 'eval question generation belongs to the eval-questions user-facing feature family',
    };
  }
  if (/eval-questions?-|eval-question/iu.test(name)) {
    return {
      family: 'eval_questions',
      expectedStrategy: 'public_cli_package_action',
      confidence: 'high',
      reason: 'eval question tooling is a user-visible scoring/evaluation workflow',
    };
  }
  if (/^(bmad-speckit-cli|speckit-cli|init-to-root)\./iu.test(name)) {
    return {
      family: 'install_or_public_cli',
      expectedStrategy: 'public_cli_package_action',
      confidence: 'high',
      reason: 'script name maps to package init/bin installation surface',
    };
  }
  if (/^(coach-diagnose|scores-summary|sft-extract|analytics-|dashboard-|runtime-dashboard|run-runtime-dashboard|start-runtime-dashboard|ensure-runtime-dashboard)/iu.test(name)) {
    return {
      family: 'scoring_dashboard_coach',
      expectedStrategy: 'public_cli_package_action_or_package_runtime_module',
      confidence: 'medium',
      reason: 'script belongs to scoring, coach, SFT, analytics, or dashboard feature surfaces',
    };
  }
  if (/(requirement|reconfirmation|six-model|resolve-active-requirement|runtime-scoring-data-path)/iu.test(name)) {
    return {
      family: 'six_mental_model_runtime',
      expectedStrategy: 'package_runtime_module',
      confidence: 'high',
      reason: 'script belongs to the six mental model runtime closure',
    };
  }
  if (/(main-agent|orchestration|runtime-governance|governance-|adaptive|audit|auditor|reviewer|facilitator|subagent|execution|implementation|delivery|readiness|closure|policy|runtime-context|control-event|strict-|sprint-status|stable-runtime|write-runtime|user-story|sdd-artifact)/iu.test(name)) {
    return {
      family: 'main_agent_governance_runtime',
      expectedStrategy: 'package_runtime_module_or_package_local_helper',
      confidence: 'medium',
      reason: 'script is in Main Agent, governance, policy, or runtime vocabulary',
    };
  }
  if (/(prompt-routing|skill-inventory|model-governance|party-mode-runtime|i18n|agent-display-names|load-manifest)/iu.test(scriptPath)) {
    return {
      family: 'package_local_helper_candidate',
      expectedStrategy: 'package_local_helper',
      confidence: 'medium',
      reason: 'script looks like package-local helper support code',
    };
  }
  return {
    family: 'unclassified',
    expectedStrategy: 'requires_owner_review',
    confidence: 'low',
    reason: 'no strong feature-family signal from script name',
  };
}

function recommendationFor(input) {
  const {
    scriptPath,
    currentStrategy,
    refs,
    closureEntry,
    publicSeed,
    family,
  } = input;
  const correction = CORRECTION_RECLASSIFICATIONS[scriptPath];
  if (correction) return correction.recommendation;

  const strongRefs = refs.filter((ref) =>
    String(ref.strength || '').startsWith('strong_')
  );
  const hasPackageCli = strongRefs.some((ref) => ref.kind === 'package_cli');
  const hasInstalledSurface = strongRefs.some((ref) => ref.kind === 'installed_surface');
  const hasPackageRuntime = strongRefs.some((ref) => ref.kind === 'package_runtime_source');
  const hasManifest = strongRefs.some((ref) => ref.kind === 'package_manifest');
  const closureInstallSurface = (closureEntry?.installSurfaces || []).length > 0;
  const closurePackageCommands = (closureEntry?.packageCliCommands || []).length > 0;

  if (scriptPath === 'scripts/eval-question-generate.ts') {
    return {
      severity: 'blocker',
      verdict: 'misclassified_consumer_feature_gap',
      recommendedStrategy: 'public_cli_package_action',
      recommendedAction: 'add package eval-questions generate action and update registry',
      reason: family.reason,
    };
  }
  if (publicSeed || hasPackageCli || closurePackageCommands) {
    return {
      severity: currentStrategy === 'deprecated_no_migration' ? 'blocker' : 'major',
      verdict: 'consumer_public_cli_reachable',
      recommendedStrategy: 'public_cli_package_action',
      recommendedAction: 'provide package CLI action or explicit compatibility alias with replacement coverage',
      reason: 'script is reachable from public package CLI evidence',
    };
  }
  if (hasPackageRuntime || hasInstalledSurface || closureInstallSurface) {
    return {
      severity: currentStrategy === 'repo_internal_reclassify' ? 'blocker' : 'major',
      verdict: 'consumer_runtime_or_install_surface_reachable',
      recommendedStrategy:
        family.expectedStrategy === 'package_local_helper'
          ? 'package_local_helper'
          : 'package_runtime_module',
      recommendedAction: 'migrate into package runtime/helper closure before marking root script internal',
      reason: 'script has package runtime or generated install-surface references',
    };
  }
  if (hasManifest && /scripts\//u.test(JSON.stringify(strongRefs))) {
    return {
      severity: 'major',
      verdict: 'package_manifest_script_reachable',
      recommendedStrategy: family.expectedStrategy,
      recommendedAction: 'replace package/root manifest script dependency with package-safe command',
      reason: 'script is referenced by a package manifest command or bin',
    };
  }
  if (family.confidence === 'high' || family.confidence === 'confirmed') {
    return {
      severity: 'major',
      verdict: 'feature_family_requires_reclassification',
      recommendedStrategy: family.expectedStrategy,
      recommendedAction: 'perform caller/import proof and migrate or add package command',
      reason: family.reason,
    };
  }
  if (family.confidence === 'medium') {
    return {
      severity: 'minor',
      verdict: 'needs_owner_review_before_internal',
      recommendedStrategy: family.expectedStrategy,
      recommendedAction: 'do not close as repo_internal without negative reachability proof',
      reason: family.reason,
    };
  }
  return {
    severity: 'info',
    verdict: 'no_consumer_reachability_signal_found',
    recommendedStrategy: 'repo_internal_reclassify_possible',
    recommendedAction: 'can stay internal only if owner confirms no consumer workflow uses it',
    reason: 'only weak or docs/self references were found',
  };
}

function buildCandidates(matrixRows, latestRegistry) {
  const rowsByPath = new Map(matrixRows.map((row) => [row.scriptPath, row]));
  const candidates = new Map();

  for (const row of matrixRows) {
    const latest = latestRegistry.get(row.scriptPath);
    const effectiveStrategy = latest?.strategy || row.matrixStrategy;
    if (!RISK_STRATEGIES.has(effectiveStrategy)) continue;
    const effectiveBand = wavePriorityBand(latest?.waveId) || row.priorityBand;
    if (!['P1', 'P2', 'P3', 'P4', 'P5'].includes(effectiveBand)) continue;
    candidates.set(row.scriptPath, {
      scriptPath: row.scriptPath,
      priorityBand: effectiveBand,
      score: row.score,
      matrixStrategy: row.matrixStrategy,
      matrixClassification: row.matrixClassification,
      targetWave: row.targetWave,
      registry: latest || null,
      currentStrategy: effectiveStrategy,
    });
  }

  for (const [scriptPath, latest] of latestRegistry.entries()) {
    if (!RISK_STRATEGIES.has(latest.strategy)) continue;
    const row = rowsByPath.get(scriptPath);
    const band = wavePriorityBand(latest.waveId) || row?.priorityBand || 'registry_only';
    if (!['P1', 'P2', 'P3', 'P4', 'P5'].includes(band)) continue;
    candidates.set(scriptPath, {
      scriptPath,
      priorityBand: band,
      score: row?.score ?? null,
      matrixStrategy: row?.matrixStrategy ?? null,
      matrixClassification: row?.matrixClassification ?? null,
      targetWave: row?.targetWave ?? null,
      registry: latest,
      currentStrategy: latest.strategy,
    });
  }
  for (const [scriptPath, correction] of Object.entries(CORRECTION_RECLASSIFICATIONS)) {
    if (candidates.has(scriptPath)) continue;
    const row = rowsByPath.get(scriptPath);
    const latest = latestRegistry.get(scriptPath) || null;
    candidates.set(scriptPath, {
      scriptPath,
      priorityBand: wavePriorityBand(latest?.waveId) || row?.priorityBand || 'correction_seed',
      score: row?.score ?? null,
      matrixStrategy: row?.matrixStrategy ?? latest?.strategy ?? correction.correctedFrom,
      matrixClassification: row?.matrixClassification ?? null,
      targetWave: row?.targetWave ?? null,
      registry: latest,
      currentStrategy: latest?.strategy || row?.matrixStrategy || correction.correctedFrom,
    });
  }
  return [...candidates.values()].sort((a, b) => {
    const bandCompare = String(a.priorityBand).localeCompare(String(b.priorityBand));
    if (bandCompare !== 0) return bandCompare;
    return a.scriptPath.localeCompare(b.scriptPath);
  });
}

function summarize(entries) {
  const countBy = (key) =>
    entries.reduce((acc, entry) => {
      const value = key.split('.').reduce((current, part) => current?.[part], entry) || 'none';
      acc[value] = (acc[value] || 0) + 1;
      return acc;
    }, {});
  return {
    totalCandidates: entries.length,
    byPriorityBand: countBy('priorityBand'),
    byCurrentStrategy: countBy('currentStrategy'),
    bySeverity: countBy('recommendation.severity'),
    byVerdict: countBy('recommendation.verdict'),
    byRecommendedStrategy: countBy('recommendation.recommendedStrategy'),
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const matrixRows = parsePriorityMatrix();
  const { latest } = parseRegistry();
  const closure = loadClosureInventory();
  const candidates = buildCandidates(matrixRows, latest);
  const entries = candidates.map((candidate) => {
    const correction = CORRECTION_RECLASSIFICATIONS[candidate.scriptPath] || null;
    const refs = collectSurfaceRefs(candidate.scriptPath);
    const closureEntry = closure.entries.get(candidate.scriptPath) || null;
    const publicSeed = closure.publicSeeds.get(candidate.scriptPath) || null;
    const family = classifyFamily(candidate.scriptPath);
    const recommendation = recommendationFor({
      scriptPath: candidate.scriptPath,
      currentStrategy: candidate.currentStrategy,
      refs,
      closureEntry,
      publicSeed,
      family,
    });
    return {
      ...candidate,
      sourceMatrixClassification: candidate.matrixClassification,
      sourceTargetWave: candidate.targetWave,
      matrixClassification: correction?.correctedTo || candidate.matrixClassification,
      targetWave:
        correction && candidate.targetWave === 'blocked_requires_followup'
          ? 'main-agent-runtime-migration-wave-3.11'
          : candidate.targetWave,
      currentStrategy: correction?.correctedTo || candidate.currentStrategy,
      currentClassification: correction?.correctedTo || candidate.currentStrategy,
      featureFamily: family,
      evidence: {
        publicCliSeed: publicSeed,
        closureConsumerReachability: closureEntry?.consumerReachability || null,
        closureInstallSurfaceCount: (closureEntry?.installSurfaces || []).length,
        closurePackageCliCommandCount: (closureEntry?.packageCliCommands || []).length,
        correctionOverride: correction,
        surfaceRefs: refs,
      },
      recommendation,
    };
  });

  const report = {
    schemaVersion: 'consumer-reachable-closure-audit/v1',
    generatedAt: new Date().toISOString(),
    scope: {
      priorityBands: ['P1', 'P2', 'P3', 'P4', 'P5'],
      auditedStrategies: [...RISK_STRATEGIES],
      registryPath: 'repo-governance/script-migration-registry.yaml',
      priorityMatrixPath:
        'repo-governance/script-migrations/main-agent-runtime-closure-wave-3/priority-matrix.md',
      closureInventoryPath:
        'repo-governance/script-migrations/main-agent-runtime-closure-wave-3/closure-inventory.json',
    },
    decisionRule:
      'A script may be repo_internal only when package CLI, install surfaces, package runtime sources, generated commands, and feature-family checks show no consumer-reachable workflow.',
    confirmedMisclassificationSeeds: ['scripts/eval-question-generate.ts'],
    correctionReclassificationSeeds: Object.keys(CORRECTION_RECLASSIFICATIONS),
    correctionReclassifications: Object.fromEntries(
      Object.entries(CORRECTION_RECLASSIFICATIONS).map(([scriptPath, correction]) => [
        scriptPath,
        {
          correctedFrom: correction.correctedFrom,
          correctedTo: correction.correctedTo,
          evidenceBasis: correction.evidenceBasis,
          recommendation: correction.recommendation,
        },
      ])
    ),
    summary: summarize(entries),
    entries,
  };

  const json = `${JSON.stringify(report, null, args.pretty ? 2 : 0)}\n`;
  if (args.out) {
    const targetPath = evidenceRel(args.out);
    if (targetPath === CLOSURE_AUDIT_PATH) {
      const receipts = loadSafeWriteReceipts();
      receipts.push(safeWriteFile(targetPath, json, { operation: 'closure_audit_write' }));
      saveSafeWriteReceipts(receipts);
    } else {
      const customOut = path.resolve(args.out);
      fs.mkdirSync(path.dirname(customOut), { recursive: true });
      fs.writeFileSync(customOut, json, 'utf8');
    }
  }
  if (!args.quiet) process.stdout.write(json);
}

main();
