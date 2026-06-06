#!/usr/bin/env node
/**
 * bmad-speckit CLI main entry (ARCH section 3.1)
 *
 * @description
 * BMAD-Speckit CLI provides init, check, version, upgrade, config, feedback,
 * and main-agent governance commands for consumer projects.
 *
 * Usage:
 * - Project root: npx bmad-speckit <cmd> or npm run speckit -- <cmd>
 * - Package dir: node bin/bmad-speckit.js <cmd>
 * - Global: bmad-speckit <cmd> after npm link
 *
 * Exit codes are defined in constants/exit-codes.js.
 */
const { program } = require('commander');
const pkg = require('../package.json');
const ttyUtils = require('../src/utils/tty');

function loadCommand(modulePath, exportName) {
  return require(modulePath)[exportName];
}

function runRuntimeModule(modulePath, exportName, args) {
  Promise.resolve(require(modulePath)[exportName](args))
    .then((exitCode) => {
      process.exitCode = exitCode ?? 0;
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    });
}

function forwardedArgsFromCommand(command) {
  const args = Array.isArray(command?.args) ? [...command.args] : [];
  const options = typeof command?.opts === 'function' ? command.opts() : {};
  for (const [key, value] of Object.entries(options)) {
    if (value === undefined || value === false) continue;
    const flag = `--${key.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`)}`;
    if (value === true) args.push(flag);
    else args.push(flag, String(value));
  }
  return args;
}

function emitDeprecatedAlias(commandName, replacement, args) {
  const json = args.includes('--json');
  const payload = {
    schemaVersion: 'bmad-speckit-deprecated-alias/v1',
    command: commandName,
    status: 'deprecated',
    exitCode: 0,
    replacement,
  };
  if (json) {
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  } else {
    process.stdout.write(
      `${commandName} is deprecated. Use ${replacement} or a source-repository maintenance workflow.\n`
    );
  }
}

function runCommandPromise(commandName, result) {
  return Promise.resolve(result)
    .then((exitCode) => {
      if (typeof exitCode === 'number') process.exitCode = exitCode;
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    });
}

function registerWave312PublicCommand(commandName, exportName, description) {
  program
    .command(commandName)
    .description(description)
    .option('--json', 'Print machine-readable JSON')
    .allowUnknownOption(true)
    .allowExcessArguments(true)
    .action((opts, command) =>
      runCommandPromise(
        commandName,
        loadCommand(`../src/commands/${commandName}`, exportName)(opts, forwardedArgsFromCommand(command))
      )
    );
}

// Show banner for init (including init --help) when in TTY
if (process.argv.includes('init') && ttyUtils.isTTY()) {
  const { showBanner } = require('../src/commands/init');
  showBanner();
}

program
  .name('bmad-speckit')
  .version(pkg.version)
  .enablePositionalOptions()
  .description('BMAD-Speckit: init, check, version, upgrade, uninstall, config, feedback');

program
  .command('init [project-name]')
  .description('Initialize a new bmad-speckit project')
  .option('--here', 'Use current directory')
  .option('--ai <name>', 'AI selection, comma-separated for multi (e.g. cursor-agent,claude)')
  .option('--ai-commands-dir <path>', 'Commands directory for generic AI (required when --ai generic)')
  .option('-y, --yes', 'Skip all prompts, use defaults')
  .option('--template <tag|url>', 'Template version (latest, v1.0.0) or tarball URL')
  .option('--network-timeout <ms>', 'Network timeout in ms (overrides env and config)')
  .option('--modules <list>', 'Comma-separated modules (bmm,bmb,tea,bmgd,cis,...)')
  .option('--force', 'Force overwrite non-empty directory')
  .option('--no-git', 'Skip git init')
  .option('--script <type>', 'Script type: sh (POSIX) or ps (PowerShell)')
  .option('--bmad-path <path>', 'Shared _bmad path (worktree mode, no copy)')
  .option('--ai-skills', 'Publish AI skills to project-local skill directories (default)')
  .option('--no-ai-skills', 'Skip publishing AI skills')
  .option('--allow-global-skill-writes', 'Allow explicit user-global skill writes for registries that declare skillScope=user-global')
  .option('--debug', 'Enable debug output')
  .option('--github-token <token>', 'GitHub API token')
  .option('--skip-tls', 'Skip SSL/TLS verification (not recommended)')
  .option('--offline', 'Use only local cache, no network')
  .action((...args) => loadCommand('../src/commands/init', 'initCommand')(...args));

program
  .command('check')
  .description('Verify bmad-speckit setup (e.g. bmadPath when using worktree)')
  .option('--list-ai', 'List available AI ids from registry')
  .option('--json', 'Output as JSON')
  .option('--ignore-agent-tools', 'Skip AI tool (detectCommand) detection')
  .action((opts) =>
    loadCommand('../src/commands/check', 'checkCommand')({
      cwd: process.cwd(),
      listAi: opts.listAi,
      json: opts.json,
      ignoreAgentTools: opts.ignoreAgentTools,
    })
  );

program
  .command('version')
  .description('Show CLI version, template version, Node version')
  .option('--json', 'Output as JSON')
  .action((opts) =>
    loadCommand('../src/commands/version', 'versionCommand')({
      cwd: process.cwd(),
      json: opts.json,
    })
  );

program
  .command('upgrade')
  .description('Upgrade template version in initialized project')
  .option('--dry-run', 'Only check upgrade info, no file writes')
  .option('--template <tag>', 'Target version (latest, v1.0.0)')
  .option('--offline', 'Use only local cache')
  .action((opts) =>
    loadCommand('../src/commands/upgrade', 'upgradeCommand')(process.cwd(), {
      dryRun: opts.dryRun,
      template: opts.template,
      offline: opts.offline,
    })
  );

program
  .command('uninstall')
  .description('Safely uninstall managed bmad-speckit install surface from current project')
  .option('--target <path>', 'Project root to uninstall from', '.')
  .option('--agent <ids>', 'Optional agent filter (cursor|claude-code|codex|cursor,claude-code,codex)')
  .option('--remove-global-skills', 'Also remove managed global skill directories')
  .option('--dry-run', 'Preview uninstall actions without changing files')
  .action((opts) =>
    loadCommand('../src/commands/uninstall', 'uninstallCommand')({
      target: opts.target,
      agent: opts.agent,
      removeGlobalSkills: opts.removeGlobalSkills,
      dryRun: opts.dryRun,
    })
  );

program
  .command('add-agent <ai>')
  .description('Add AI agent infrastructure to an initialized project (e.g. bmad-speckit add-agent claude)')
  .action((ai) => loadCommand('../src/commands/add-agent', 'addAgentCommand')(ai, { cwd: process.cwd() }));

program
  .command('feedback')
  .description('Show feedback entry and full-flow compatible AI list')
  .action(() => loadCommand('../src/commands/feedback', 'feedbackCommand')());

const ralphCmd = program.command('ralph').description('Ralph tracking runtime helpers');

ralphCmd
  .command('prepare')
  .description('Create or refresh Ralph tracking files for a tasks.md context')
  .requiredOption('--tasksPath <path>', 'Path to tasks.md')
  .option('--mode <mode>', 'Mode (standalone|bmad)', 'standalone')
  .option('--epic <n>', 'Epic number')
  .option('--story <n>', 'Story number')
  .option('--epicSlug <slug>', 'Epic slug')
  .option('--storySlug <slug>', 'Story slug')
  .option('--taskDescription <text>', 'Override task description')
  .option('--overwrite', 'Overwrite existing Ralph files')
  .action((opts) => loadCommand('../src/commands/ralph', 'ralphPrepareCommand')(opts));

ralphCmd
  .command('record-phase')
  .description('Record one Ralph phase transition for a specific user story')
  .requiredOption('--tasksPath <path>', 'Path to tasks.md')
  .requiredOption('--userStoryId <id>', 'User story id, e.g. US-001')
  .requiredOption('--title <text>', 'User story title')
  .requiredOption('--phase <phase>', 'Phase (TDD-RED|TDD-GREEN|TDD-REFACTOR|DONE)')
  .requiredOption('--detail <text>', 'Phase detail line')
  .option('--mode <mode>', 'Mode (standalone|bmad)', 'standalone')
  .option('--epic <n>', 'Epic number')
  .option('--story <n>', 'Story number')
  .option('--epicSlug <slug>', 'Epic slug')
  .option('--storySlug <slug>', 'Story slug')
  .option('--storyLogTimestamp <iso>', 'ISO-8601 timestamp used for progress entry')
  .action((opts) => loadCommand('../src/commands/ralph', 'ralphRecordPhaseCommand')(opts));

ralphCmd
  .command('verify')
  .description('Verify Ralph tracking compliance for a tasks.md context')
  .requiredOption('--tasksPath <path>', 'Path to tasks.md')
  .option('--mode <mode>', 'Mode (standalone|bmad)', 'standalone')
  .option('--epic <n>', 'Epic number')
  .option('--story <n>', 'Story number')
  .option('--epicSlug <slug>', 'Epic slug')
  .option('--storySlug <slug>', 'Story slug')
  .action((opts) => loadCommand('../src/commands/ralph', 'ralphVerifyCommand')(opts));

const configCmd = program
  .command('config')
  .description('Get/set/list bmad-speckit config');

configCmd
  .command('get <key>')
  .description('Get config value by key')
  .option('--json', 'Output as JSON')
  .action((key, opts) => {
    loadCommand('../src/commands/config', 'configGetCommand')(process.cwd(), {
      key,
      json: opts.json,
    });
  });

configCmd
  .command('set <key> <value>')
  .description('Set config value')
  .option('--global', 'Force global scope')
  .action((key, value, opts) => {
    loadCommand('../src/commands/config', 'configSetCommand')(process.cwd(), {
      key,
      value,
      global: opts.global,
    });
  });

configCmd
  .command('list')
  .description('List merged config (project overrides global)')
  .option('--json', 'Output as JSON')
  .action((opts) => {
    loadCommand('../src/commands/config', 'configListCommand')(process.cwd(), {
      json: opts.json,
    });
  });

program
  .command('score')
  .description('Parse audit report and write scoring record')
  .requiredOption('--reportPath <path>', 'Path to audit report file')
  .option('--stage <stage>', 'Audit stage (prd|arch|story|spec|plan|gaps|tasks|implement)', 'prd')
  .option('--runId <id>', 'Run ID (auto-generated if omitted)')
  .option('--epic <n>', 'Epic number')
  .option('--story <n>', 'Story number')
  .option('--event <event>', 'Trigger event', 'user_explicit_request')
  .option('--scenario <scenario>', 'Scenario (real_dev|eval_question)', 'real_dev')
  .option('--writeMode <mode>', 'Write mode (single_file|jsonl|both)', 'single_file')
  .option('--dataPath <path>', 'Scoring data directory')
  .option('--triggerStage <stage>', 'Trigger stage override')
  .option('--iteration-count <n>', 'Audit iteration fail count')
  .option('--iterationReportPaths <paths>', 'Comma-separated failed iteration report paths')
  .option('--artifactDocPath <path>', 'Artifact document path')
  .option('--questionVersion <ver>', 'Question version')
  .option('--host <host>', 'Host identifier, e.g. cursor or claude')
  .option('--hostKind <kind>', 'Canonical host kind for provenance')
  .option('--providerId <id>', 'Provider identifier for provenance')
  .option('--providerMode <mode>', 'Provider mode for provenance')
  .option('--toolTraceRef <hash>', 'Tool trace content hash reference')
  .option('--toolTracePath <path>', 'Tool trace artifact path')
  .option('--skipTriggerCheck', 'Skip trigger check')
  .option('--baseCommitHash <hash>', 'Base commit hash')
  .option('--sourceHashFilePath <path>', 'Source hash file path')
  .option('--agent <agent>', 'Agent type (cursor|claude-code|codex)')
  .option('--source <source>', 'Source type (cursor_command|claude_agent|claude_hook)')
  .action((opts) => {
    loadCommand('../src/commands/score', 'scoreCommand')(opts).catch((err) => {
      console.error(err);
      process.exit(1);
    });
  });

program
  .command('check-score')
  .description('Check if epic/story has scoring records')
  .requiredOption('--epic <n>', 'Epic number')
  .requiredOption('--story <n>', 'Story number')
  .option('--dataPath <path>', 'Scoring data directory')
  .option('--stage <stage>', 'Stage filter (story|implement)')
  .action((opts) => loadCommand('../src/commands/check-score', 'checkScoreCommand')(opts));

program
  .command('eval-question-generate')
  .description('Generate eval question templates from coach diagnosis output')
  .option('--run-id <id>', 'Run ID')
  .option('--input <path>', 'Coach diagnosis JSON input path')
  .option('--version <version>', 'Eval question version directory', 'v1')
  .option('--outputDir <path>', 'Output directory')
  .option('--output-dir <path>', 'Output directory')
  .option('--dataPath <path>', 'Scoring data directory for --run-id compatibility')
  .allowUnknownOption(false)
  .action((opts) => {
    loadCommand('../src/commands/eval-question-generate', 'evalQuestionGenerateCli')(opts).then(
      (exitCode) => process.exit(exitCode)
    );
  });

program
  .command('coach')
  .description('AI Coach diagnosis')
  .option('--run-id <id>', 'Run ID')
  .option('--format <format>', 'Output format (json|markdown)', 'markdown')
  .option('--epic <n>', 'Epic number')
  .option('--story <x.y>', 'Story X.Y')
  .option('--limit <n>', 'Discovery limit', String(100))
  .option('--scenario <scenario>', 'Scenario filter (real_dev|eval_question|all)', 'real_dev')
  .option('--dataPath <path>', 'Scoring data directory')
  .action((opts) => {
    loadCommand('../src/commands/coach', 'coachCommand')(opts).catch((err) => {
      console.error(err);
      process.exit(1);
    });
  });

program
  .command('dashboard')
  .description('Generate project health dashboard')
  .option('--strategy <strategy>', 'Strategy (epic_story_window|run_id)', 'epic_story_window')
  .option('--dataPath <path>', 'Scoring data directory')
  .option('--epic <n>', 'Epic number')
  .option('--story <x.y>', 'Story number')
  .option('--windowHours <n>', 'Window hours for aggregation')
  .option('--output <path>', 'Markdown output path')
  .option('--json', 'Print runtime-aware dashboard snapshot as JSON')
  .option('--output-json <path>', 'JSON snapshot output path')
  .option('--include-runtime', 'Append runtime context sections to markdown output')
  .option('--show-deferred-gaps', 'Append deferred gap governance table to dashboard markdown')
  .action((opts) => loadCommand('../src/commands/dashboard', 'dashboardCommand')(opts));

program
  .command('deferred-gap-audit')
  .description('Audit readiness deferred gaps for drift, ownership, planning, and expiry')
  .option('--output <path>', 'Write markdown or JSON audit output to file')
  .option('--json', 'Print JSON audit output')
  .option('--fail-on-alert', 'Exit non-zero when alerts are present')
  .action((opts) =>
    loadCommand('../src/commands/deferred-gap-audit', 'deferredGapAuditCommand')(opts)
  );

program
  .command('sft-extract')
  .description('Extract SFT training dataset from scoring data (legacy JSONL or canonical bundle compatibility mode)')
  .option('--min-score <n>', 'Minimum score for inclusion (default: 90, minimum: 90)')
  .option(
    '--target <target>',
    'Export target (openai_chat|hf_conversational|hf_tool_calling|legacy_instruction_io)',
    'legacy_instruction_io'
  )
  .option('--output <path>', 'Output file path')
  .option('--bundle-dir <path>', 'Bundle output directory when --target is not legacy_instruction_io')
  .option('--dataPath <path>', 'Scoring data directory')
  .option('--split-seed <n>', 'Deterministic split seed for canonical exporters')
  .option('--max-tokens <n>', 'Maximum token estimate allowed for canonical exporters')
  .option('--drop-no-code-pair', 'Reject samples without code pair in canonical exporters')
  .action((opts) => {
    loadCommand('../src/commands/sft-extract', 'sftExtractCommand')(opts).catch((err) => {
      console.error(err);
      process.exit(1);
    });
  });

program
  .command('sft-preview')
  .description('Preview accepted/rejected SFT dataset candidates')
  .option('--min-score <n>', 'Minimum score for inclusion (default: 90)')
  .option(
    '--target <target>',
    'Preview target (openai_chat|hf_conversational|hf_tool_calling)',
    'openai_chat'
  )
  .option('--format <format>', 'Output format (json)', 'json')
  .option('--dataPath <path>', 'Scoring data directory')
  .option('--split-seed <n>', 'Deterministic split seed')
  .option('--max-tokens <n>', 'Maximum token estimate allowed')
  .option('--drop-no-code-pair', 'Reject samples without code pair')
  .action((opts) => {
    loadCommand('../src/commands/sft-preview', 'sftPreviewCommand')(opts).catch((err) => {
      console.error(err);
      process.exit(1);
    });
  });

program
  .command('sft-validate')
  .description('Validate canonical SFT samples and export compatibility')
  .option('--min-score <n>', 'Minimum score for inclusion (default: 90)')
  .option(
    '--target <target>',
    'Validation target (openai_chat|hf_conversational|hf_tool_calling)',
    'openai_chat'
  )
  .option('--format <format>', 'Output format (json)', 'json')
  .option('--dataPath <path>', 'Scoring data directory')
  .option('--split-seed <n>', 'Deterministic split seed')
  .option('--max-tokens <n>', 'Maximum token estimate allowed')
  .option('--drop-no-code-pair', 'Reject samples without code pair')
  .action((opts) => {
    loadCommand('../src/commands/sft-validate', 'sftValidateCommand')(opts).catch((err) => {
      console.error(err);
      process.exit(1);
    });
  });

program
  .command('sft-bundle')
  .description('Write a training-ready canonical SFT dataset bundle')
  .option('--min-score <n>', 'Minimum score for inclusion (default: 90)')
  .option(
    '--target <target>',
    'Bundle target (openai_chat|hf_conversational|hf_tool_calling)',
    'openai_chat'
  )
  .option('--bundle-dir <path>', 'Bundle output directory', '_bmad-output/datasets')
  .option('--dataPath <path>', 'Scoring data directory')
  .option('--split-seed <n>', 'Deterministic split seed')
  .option('--max-tokens <n>', 'Maximum token estimate allowed')
  .option('--drop-no-code-pair', 'Reject samples without code pair')
  .action((opts) => {
    loadCommand('../src/commands/sft-bundle', 'sftBundleCommand')(opts).catch((err) => {
      console.error(err);
      process.exit(1);
    });
  });

program
  .command('scores')
  .description('Display scoring summary')
  .option('--epic <n>', 'Epic number')
  .option('--story <x.y>', 'Story X.Y')
  .option('--dataPath <path>', 'Scoring data directory')
  .option('--limit <n>', 'Max records to display', String(100))
  .action((opts) => loadCommand('../src/commands/scores', 'scoresCommand')(opts));

program
  .command('ensure-run-runtime-context')
  .description('Generate or persist run-scoped runtime context (dev_story / post_audit)')
  .requiredOption('--story-key <key>', 'Story key (e.g. 15-1-runtime-governance-complete)')
  .option('--lifecycle <phase>', 'dev_story | post_audit', 'dev_story')
  .option('--persist', 'After sprint-status write: refresh registry using last-*-run.json')
  .action((opts) => {
    try {
      loadCommand('../src/commands/ensure-run-runtime-context', 'ensureRunRuntimeContextCommand')(opts);
    } catch (err) {
      console.error(err);
      process.exit(1);
    }
  });

program
  .command('sync-runtime-context-from-sprint')
  .description('Refresh runtime registry and project context from sprint-status.yaml')
  .option('--story-key <key>', 'After sync, scope story context (S10; kebab-case story key)')
  .action((opts) => {
    try {
      loadCommand(
        '../src/commands/sync-runtime-context-from-sprint',
        'syncRuntimeContextFromSprintCommand'
      )(opts);
    } catch (err) {
      console.error(err);
      process.exit(1);
    }
  });

program
  .command('assert-implementation-entry')
  .description('Assert the current implementation-entry gate from registry-backed runtime context')
  .option('--cwd <path>', 'Project root used to resolve runtime context')
  .action((opts) => {
    try {
      const gate = loadCommand(
        '../src/commands/assert-implementation-entry',
        'assertImplementationEntryCommand'
      )(opts);
      if (gate && gate.decision !== 'pass') {
        process.exit(2);
      }
    } catch (err) {
      console.error(err);
      process.exit(1);
    }
  });

program
  .command('runtime-mcp')
  .description('Start the runtime dashboard MCP server over stdio')
  .option('--dataPath <path>', 'Scoring data directory')
  .option('--dashboard-url <url>', 'Existing dashboard URL')
  .option('--dashboard-port <n>', 'Port to auto-start the dashboard on')
  .option('--host <host>', 'Dashboard host when auto-starting', '127.0.0.1')
  .action((opts) => {
    loadCommand('../src/commands/runtime-mcp', 'runtimeMcpCommand')(opts).catch((err) => {
      console.error(err);
      process.exit(1);
    });
  });

program
  .command('provider-smoke')
  .description('Run a provider connectivity and response-shape smoke check')
  .option('--config <path>', 'Path to governance-remediation.yaml')
  .option('--timeoutMs <ms>', 'Request timeout in ms')
  .option('--prompt <text>', 'Custom smoke prompt')
  .action((opts) => {
    loadCommand('../src/commands/provider-smoke', 'providerSmokeCommand')(opts).catch((err) => {
      console.error(err);
      process.exit(1);
    });
  });

program
  .command('dashboard-start')
  .description('Start or reuse a stable local runtime dashboard web server')
  .option('--dataPath <path>', 'Scoring data directory')
  .option('--port <n>', 'Port to listen on', String(0))
  .option('--host <host>', 'Host to bind', '127.0.0.1')
  .option('--open', 'Open the dashboard in the default browser')
  .action((opts) => {
    loadCommand('../src/commands/dashboard-start', 'dashboardStartCommand')(opts).catch((err) => {
      console.error(err);
      process.exit(1);
    });
  });

program
  .command('dashboard-status')
  .description('Inspect the stable runtime dashboard server state and health')
  .action(() => {
    loadCommand('../src/commands/dashboard-status', 'dashboardStatusCommand')().catch((err) => {
      console.error(err);
      process.exit(1);
    });
  });

program
  .command('dashboard-stop')
  .description('Stop the stable runtime dashboard server and clear state')
  .action(() => {
    loadCommand('../src/commands/dashboard-stop', 'dashboardStopCommand')().catch((err) => {
      console.error(err);
      process.exit(1);
    });
  });

program
  .command('dashboard-live')
  .description('Start the local live runtime dashboard web server')
  .option('--dataPath <path>', 'Scoring data directory')
  .option('--port <n>', 'Port to listen on', String(43123))
  .option('--host <host>', 'Host to bind', '127.0.0.1')
  .option('--open', 'Start a stable background server and open the dashboard in the browser')
  .action((opts) => {
    loadCommand('../src/commands/dashboard-live', 'dashboardLiveCommand')(opts).catch((err) => {
      console.error(err);
      process.exit(1);
    });
  });

program
  .command('bmad-help')
  .description('Render BMAD Method help guidance from the package runtime')
  .option('--cwd <path>', 'Project root to inspect')
  .option('--all', 'Show all available BMAD help details')
  .option('--module <name>', 'Filter help by module')
  .option('--phase <name>', 'Filter help by phase')
  .option('--json', 'Print machine-readable JSON')
  .option('--workflow-guidance', 'Include workflow guidance')
  .option('--raw-workflow', 'Print raw workflow guidance')
  .option('--debug', 'Include diagnostics')
  .option('--full', 'Include full raw runtime records in JSON diagnostics')
  .option('--catalog', 'Include catalog details')
  .option('--budget <level>', 'Display budget: compact, route, expanded, or full')
  .allowUnknownOption(true)
  .allowExcessArguments(true)
  .action((_options, command) =>
    runRuntimeModule(
      '../src/runtime/bmad-help-renderer.js',
      'mainBmadHelpRenderer',
      forwardedArgsFromCommand(command)
    )
  );

program
  .command('bmads')
  .description('Render the BMAD-Speckit main-agent runtime console')
  .option('--cwd <path>', 'Project root to inspect')
  .option('--json', 'Print machine-readable JSON')
  .option('--budget <level>', 'Display budget: compact, route, expanded, or full')
  .option('--lang <locale>', 'Output language, for example en or zh-CN')
  .option('--locale <locale>', 'Alias for --lang')
  .allowUnknownOption(true)
  .allowExcessArguments(true)
  .action((_options, command) =>
    runRuntimeModule(
      '../src/runtime/bmads-renderer.js',
      'mainBmadsRenderer',
      forwardedArgsFromCommand(command)
    )
  );

program
  .command('bmads-auto')
  .description('Deprecated compatibility alias for BMADS Auto source-repository orchestration')
  .option('--json', 'Print machine-readable deprecation status')
  .allowUnknownOption(true)
  .allowExcessArguments(true)
  .action((_options, command) =>
    emitDeprecatedAlias('bmads-auto', 'bmads', forwardedArgsFromCommand(command))
  );

program
  .command('bmad-speckit')
  .description('Alias for bmads: render the BMAD-Speckit main-agent runtime console')
  .option('--cwd <path>', 'Project root to inspect')
  .option('--json', 'Print machine-readable JSON')
  .option('--budget <level>', 'Display budget: compact, route, expanded, or full')
  .option('--lang <locale>', 'Output language, for example en or zh-CN')
  .option('--locale <locale>', 'Alias for --lang')
  .allowUnknownOption(true)
  .allowExcessArguments(true)
  .action((_options, command) =>
    runRuntimeModule(
      '../src/runtime/bmads-renderer.js',
      'mainBmadsRenderer',
      forwardedArgsFromCommand(command)
    )
  );

program
  .command('main-agent-orchestration')
  .description('Run the BMAD main-agent orchestration CLI surface')
  .allowUnknownOption(true)
  .allowExcessArguments(true)
  .action((_options, command) =>
    runRuntimeModule(
      '../dist/main-agent/index.js',
      'mainAgentRuntimeCommand',
      ['--legacy-orchestration', ...forwardedArgsFromCommand(command)]
    )
  );

program
  .command('confirm-scope')
  .description('Confirm requirement scope through controlled ingest after exact chat hash confirmation')
  .allowUnknownOption(true)
  .allowExcessArguments(true)
  .action((_options, command) =>
    runRuntimeModule('../dist/main-agent/index.js', 'mainAgentRuntimeCommand', [
      '--legacy-orchestration',
      '--action',
      'confirm-scope',
      ...forwardedArgsFromCommand(command),
    ])
  );

program
  .command('main-agent:confirm-scope')
  .description('Run the BMAD confirmation ingest orchestration surface')
  .allowUnknownOption(true)
  .allowExcessArguments(true)
  .action((_options, command) =>
    runRuntimeModule('../dist/main-agent/index.js', 'mainAgentRuntimeCommand', [
      '--legacy-orchestration',
      '--action',
      'confirm-scope',
      ...forwardedArgsFromCommand(command),
    ])
  );

program
  .command('main-agent:bmad-help-five-layer-matrix')
  .description('Deprecated compatibility alias; use bmad-help for stable user help rendering')
  .option('--json', 'Print machine-readable deprecation status')
  .allowUnknownOption(true)
  .allowExcessArguments(true)
  .action((_options, command) =>
    emitDeprecatedAlias(
      'main-agent:bmad-help-five-layer-matrix',
      'bmad-help',
      forwardedArgsFromCommand(command)
    )
  );

program
  .command('main-agent:quality-gate')
  .description('Run the BMAD main-agent quality gate CLI surface')
  .allowUnknownOption(true)
  .allowExcessArguments(true)
  .action((_options, command) =>
    runRuntimeModule('../dist/main-agent/index.js', 'mainAgentRuntimeCommand', [
      'quality-gate',
      ...forwardedArgsFromCommand(command),
    ])
  );

program
  .command('main-agent:host-matrix-pr-orchestrate')
  .description('Deprecated compatibility alias for source-repository host matrix orchestration')
  .option('--json', 'Print machine-readable deprecation status')
  .allowUnknownOption(true)
  .allowExcessArguments(true)
  .action((_options, command) =>
    emitDeprecatedAlias(
      'main-agent:host-matrix-pr-orchestrate',
      'main-agent run-loop',
      forwardedArgsFromCommand(command)
    )
  );

program
  .command('main-agent:release-gate')
  .description('Run the BMAD main-agent release gate CLI surface')
  .allowUnknownOption(true)
  .allowExcessArguments(true)
  .action((_options, command) =>
    runRuntimeModule('../dist/main-agent/index.js', 'mainAgentRuntimeCommand', [
      'release-gate',
      ...forwardedArgsFromCommand(command),
    ])
  );

program
  .command('main-agent:delivery-truth-gate')
  .description('Run the BMAD main-agent delivery truth gate CLI surface')
  .allowUnknownOption(true)
  .allowExcessArguments(true)
  .action((_options, command) =>
    runRuntimeModule('../dist/main-agent/index.js', 'mainAgentRuntimeCommand', [
      'delivery-truth-gate',
      ...forwardedArgsFromCommand(command),
    ])
  );

program
  .command('write-runtime-context')
  .description('Run the BMAD runtime context writer CLI surface')
  .allowUnknownOption(true)
  .allowExcessArguments(true)
  .action((_options, command) =>
    runRuntimeModule(
      '../dist/main-agent/helpers/write-runtime-context.cjs',
      'main',
      forwardedArgsFromCommand(command)
    )
  );

program
  .command('run-auditor-host')
  .description('Run the BMAD auditor host CLI surface')
  .allowUnknownOption(true)
  .allowExcessArguments(true)
  .action((_options, command) =>
    runRuntimeModule(
      '../dist/main-agent/auditor-host/run-auditor-host.cjs',
      'main',
      forwardedArgsFromCommand(command)
    )
  );

registerWave312PublicCommand(
  'architecture-drift-check',
  'architectureDriftCheckCommand',
  'Run the package architecture drift check surface'
);
registerWave312PublicCommand('coach-diagnose', 'coachDiagnoseCommand', 'Run the package coach diagnosis surface');
registerWave312PublicCommand(
  'emit-runtime-policy',
  'emitRuntimePolicyCommand',
  'Emit the package runtime policy surface'
);
registerWave312PublicCommand('init-to-root', 'initToRootCommand', 'Run the package init-to-root surface');
registerWave312PublicCommand(
  'live-smoke-speckit-workflow',
  'liveSmokeSpeckitWorkflowCommand',
  'Run the package live smoke workflow surface'
);
registerWave312PublicCommand('setup', 'setupCommand', 'Run the package setup surface');
registerWave312PublicCommand('speckit-cli', 'speckitCliCommand', 'Run the package Speckit CLI surface');
registerWave312PublicCommand(
  'validate-single-source-whitelist',
  'validateSingleSourceWhitelistCommand',
  'Run the package single-source whitelist validation surface'
);

program
  .command('eval-questions')
  .description('Deprecated compatibility alias for source-repository evaluation question tooling')
  .option('--json', 'Print machine-readable deprecation status')
  .allowUnknownOption(true)
  .allowExcessArguments(true)
  .action((_options, command) =>
    emitDeprecatedAlias('eval-questions', 'source-repository evaluation workflow', forwardedArgsFromCommand(command))
  );

program
  .command('main-agent')
  .argument('[action]')
  .description('Run stable package-local Main Agent runtime actions')
  .option('--cwd <path>', 'Project root to inspect')
  .option('--json', 'Print machine-readable JSON')
  .allowUnknownOption(true)
  .allowExcessArguments(true)
  .action((_action, _options, command) =>
    runRuntimeModule(
      '../dist/main-agent/index.js',
      'mainAgentRuntimeCommand',
      forwardedArgsFromCommand(command)
    )
  );

program.parse();
