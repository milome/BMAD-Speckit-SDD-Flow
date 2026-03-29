#!/usr/bin/env node
/**
 * bmad-speckit CLI 主入口 (ARCH §3.1)
 *
 * @description
 * BMAD-Speckit CLI：提供 init、check、version、upgrade、config、feedback 等子命令，
 * 用于初始化项目、校验配置、管理模板版本等。
 *
 * 运行方式：
 * - 项目根: npx bmad-speckit <cmd> 或 npm run speckit -- <cmd>
 * - 包目录: node bin/bmad-speckit.js <cmd>
 * - 全局: bmad-speckit <cmd> (npm link 后)
 *
 * 退出码约定（见 constants/exit-codes.js）：
 * - 0: SUCCESS
 * - 1: GENERAL_ERROR
 * - 2: AI_INVALID
 * - 3: NETWORK_TEMPLATE_FAILED
 * - 4: TARGET_PATH_UNAVAILABLE
 * - 5: OFFLINE_CACHE_MISSING
 */
const { program } = require('commander');
const pkg = require('../package.json');
const { initCommand, showBanner } = require('../src/commands/init');
const { checkCommand } = require('../src/commands/check');
const { versionCommand } = require('../src/commands/version');
const { upgradeCommand } = require('../src/commands/upgrade');
const { addAgentCommand } = require('../src/commands/add-agent');
const { configGetCommand, configSetCommand, configListCommand } = require('../src/commands/config');
const { feedbackCommand } = require('../src/commands/feedback');
const { scoreCommand } = require('../src/commands/score');
const { checkScoreCommand } = require('../src/commands/check-score');
const { coachCommand } = require('../src/commands/coach');
const { dashboardCommand } = require('../src/commands/dashboard');
const { sftExtractCommand } = require('../src/commands/sft-extract');
const { sftPreviewCommand } = require('../src/commands/sft-preview');
const { sftValidateCommand } = require('../src/commands/sft-validate');
const { sftBundleCommand } = require('../src/commands/sft-bundle');
const { scoresCommand } = require('../src/commands/scores');
const { ensureRunRuntimeContextCommand } = require('../src/commands/ensure-run-runtime-context');
const { syncRuntimeContextFromSprintCommand } = require('../src/commands/sync-runtime-context-from-sprint');
const { runtimeMcpCommand } = require('../src/commands/runtime-mcp');
const { dashboardLiveCommand } = require('../src/commands/dashboard-live');
const ttyUtils = require('../src/utils/tty');

// Show banner for init (including init --help) when in TTY
if (process.argv.includes('init') && ttyUtils.isTTY()) {
  showBanner();
}

program
  .name('bmad-speckit')
  .version(pkg.version)
  .description('BMAD-Speckit: init, check, version, upgrade, config, feedback');

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
  .option('--ai-skills', 'Publish AI skills (default)')
  .option('--no-ai-skills', 'Skip publishing AI skills')
  .option('--debug', 'Enable debug output')
  .option('--github-token <token>', 'GitHub API token')
  .option('--skip-tls', 'Skip SSL/TLS verification (not recommended)')
  .option('--offline', 'Use only local cache, no network')
  .action(initCommand);

program
  .command('check')
  .description('Verify bmad-speckit setup (e.g. bmadPath when using worktree)')
  .option('--list-ai', 'List available AI ids from registry')
  .option('--json', 'Output as JSON')
  .option('--ignore-agent-tools', 'Skip AI tool (detectCommand) detection')
  .action((opts) =>
    checkCommand({
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
  .action((opts) => versionCommand({ cwd: process.cwd(), json: opts.json }));

program
  .command('upgrade')
  .description('Upgrade template version in initialized project')
  .option('--dry-run', 'Only check upgrade info, no file writes')
  .option('--template <tag>', 'Target version (latest, v1.0.0)')
  .option('--offline', 'Use only local cache')
  .action((opts) =>
    upgradeCommand(process.cwd(), {
      dryRun: opts.dryRun,
      template: opts.template,
      offline: opts.offline,
    })
  );

program
  .command('add-agent <ai>')
  .description('Add AI agent infrastructure to an initialized project (e.g. bmad-speckit add-agent claude)')
  .action((ai) => addAgentCommand(ai, { cwd: process.cwd() }));

program
  .command('feedback')
  .description('Show feedback entry and full-flow compatible AI list')
  .action(() => feedbackCommand());

const configCmd = program
  .command('config')
  .description('Get/set/list bmad-speckit config');

configCmd
  .command('get <key>')
  .description('Get config value by key')
  .option('--json', 'Output as JSON')
  .action((key, opts) => {
    configGetCommand(process.cwd(), { key, json: opts.json });
  });

configCmd
  .command('set <key> <value>')
  .description('Set config value')
  .option('--global', 'Force global scope')
  .action((key, value, opts) => {
    configSetCommand(process.cwd(), { key, value, global: opts.global });
  });

configCmd
  .command('list')
  .description('List merged config (project overrides global)')
  .option('--json', 'Output as JSON')
  .action((opts) => {
    configListCommand(process.cwd(), { json: opts.json });
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
  .option('--skipTriggerCheck', 'Skip trigger check')
  .option('--baseCommitHash <hash>', 'Base commit hash')
  .option('--sourceHashFilePath <path>', 'Source hash file path')
  .option('--agent <agent>', 'Agent type (cursor|claude-code)')
  .option('--source <source>', 'Source type (cursor_command|claude_agent|claude_hook)')
  .action((opts) => {
    scoreCommand(opts).catch((err) => {
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
  .action((opts) => checkScoreCommand(opts));

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
    coachCommand(opts).catch((err) => {
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
  .action((opts) => dashboardCommand(opts));

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
    sftExtractCommand(opts).catch((err) => {
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
    sftPreviewCommand(opts).catch((err) => {
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
    sftValidateCommand(opts).catch((err) => {
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
    sftBundleCommand(opts).catch((err) => {
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
  .action((opts) => scoresCommand(opts));

program
  .command('ensure-run-runtime-context')
  .description('Generate or persist run-scoped runtime context (dev_story / post_audit)')
  .requiredOption('--story-key <key>', 'Story key (e.g. 15-1-runtime-governance-complete)')
  .option('--lifecycle <phase>', 'dev_story | post_audit', 'dev_story')
  .option('--persist', 'After sprint-status write: refresh registry using last-*-run.json')
  .action((opts) => {
    try {
      ensureRunRuntimeContextCommand(opts);
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
      syncRuntimeContextFromSprintCommand(opts);
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
    runtimeMcpCommand(opts).catch((err) => {
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
  .option('--open', 'Reserved for future browser-open behavior')
  .action((opts) => {
    dashboardLiveCommand(opts).catch((err) => {
      console.error(err);
      process.exit(1);
    });
  });

program.parse();
