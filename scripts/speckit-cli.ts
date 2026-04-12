/**
 * Speckit CLI - Unified command entry for speckit-workflow
 *
 * Usage:
 *   npx ts-node scripts/speckit-cli.ts <command> [options]
 *
 * Commands:
 *   constitution  - §0.5 Establish project principles
 *   specify       - §1 Generate spec.md with requirements mapping
 *   plan          - §2 Generate plan.md with architecture
 *   gaps          - §3 Generate IMPLEMENTATION_GAPS.md
 *   tasks         - §4 Generate tasks.md with acceptance criteria
 *   implement     - §5 Execute tasks with TDD red-green-refactor
 *   clarify       - §1.2 Clarify ambiguous spec (embedded in specify audit)
 *   checklist     - §2.2 Quality checklist (embedded in plan audit)
 *   analyze       - §4.2 Cross-artifact analysis (embedded in tasks audit)
 *   audit         - Run standalone audit for any stage
 *   validate      - Validate speckit configuration
 *   version       - Show version info
 *
 * Examples:
 *   npx ts-node scripts/speckit-cli.ts constitution --projectPath ./
 *   npx ts-node scripts/speckit-cli.ts specify --epic 4 --story 1
 *   npx ts-node scripts/speckit-cli.ts implement --tasksPath specs/.../tasks.md
 */
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { isReviewerAuditEntryStage } from './reviewer-registry';
import { runAuditorHost } from './run-auditor-host';
import { isReviewCloseoutApproved } from './reviewer-schema';

function buildCrossPlatformCommand(command: string): string {
  if (process.platform !== 'win32') {
    return command;
  }

  const escaped = command.replace(/"/g, '""');
  return `cmd.exe /d /s /c "${escaped}"`;
}

interface CliOptions {
  [key: string]: string | boolean | undefined;
}

interface CommandConfig {
  description: string;
  requiredArgs: string[];
  optionalArgs: string[];
  agentFile: string;
  stage?: string;
  triggerStage?: string;
}

const COMMANDS: Record<string, CommandConfig> = {
  constitution: {
    description: '§0.5 Establish project principles',
    requiredArgs: ['projectPath'],
    optionalArgs: ['projectType', 'mode'],
    agentFile: '.claude/agents/speckit-constitution.md',
  },
  specify: {
    description: '§1 Generate spec.md with requirements mapping',
    requiredArgs: ['epic', 'story'],
    optionalArgs: ['epicSlug', 'storySlug', 'mode', 'constitutionPath'],
    agentFile: '.claude/agents/speckit-specify.md',
    stage: 'spec',
    triggerStage: 'speckit_1_2',
  },
  plan: {
    description: '§2 Generate plan.md with architecture',
    requiredArgs: ['epic', 'story', 'specPath'],
    optionalArgs: ['epicSlug', 'storySlug', 'mode', 'constitutionPath'],
    agentFile: '.claude/agents/speckit-plan.md',
    stage: 'plan',
    triggerStage: 'speckit_2_2',
  },
  gaps: {
    description: '§3 Generate IMPLEMENTATION_GAPS.md',
    requiredArgs: ['epic', 'story', 'planPath'],
    optionalArgs: ['epicSlug', 'storySlug', 'mode', 'specPath'],
    agentFile: '.claude/agents/speckit-gaps.md',
    stage: 'plan',
    triggerStage: 'speckit_3_2',
  },
  tasks: {
    description: '§4 Generate tasks.md with acceptance criteria',
    requiredArgs: ['epic', 'story', 'planPath'],
    optionalArgs: ['epicSlug', 'storySlug', 'mode', 'gapsPath'],
    agentFile: '.claude/agents/speckit-tasks.md',
    stage: 'tasks',
    triggerStage: 'speckit_4_2',
  },
  implement: {
    description: '§5 Execute tasks with TDD red-green-refactor',
    requiredArgs: ['tasksPath'],
    optionalArgs: ['epic', 'story', 'epicSlug', 'storySlug', 'mode', 'batchSize'],
    agentFile: '.claude/agents/speckit-implement.md',
    stage: 'implement',
    triggerStage: 'speckit_5_2',
  },
  clarify: {
    description: '§1.2 Clarify ambiguous spec (embedded)',
    requiredArgs: ['specPath', 'auditReportPath'],
    optionalArgs: ['originalRequirementsPath', 'epic', 'story'],
    agentFile: '.claude/agents/speckit-clarify.md',
  },
  checklist: {
    description: '§2.2 Quality checklist for complex plans (embedded)',
    requiredArgs: ['planPath', 'specPath'],
    optionalArgs: ['constitutionPath', 'epic', 'story'],
    agentFile: '.claude/agents/speckit-checklist.md',
  },
  analyze: {
    description: '§4.2 Cross-artifact analysis (embedded)',
    requiredArgs: ['tasksPath', 'planPath', 'specPath'],
    optionalArgs: ['gapsPath', 'constitutionPath', 'epic', 'story'],
    agentFile: '.claude/agents/speckit-analyze.md',
  },
  audit: {
    description: 'Run standalone audit for any stage',
    requiredArgs: ['stage', 'artifactPath'],
    optionalArgs: ['epic', 'story', 'iterationCount'],
    agentFile: '', // Dynamic based on stage
  },
  validate: {
    description: 'Validate speckit configuration',
    requiredArgs: [],
    optionalArgs: ['projectPath'],
    agentFile: '', // No agent, direct validation
  },
  version: {
    description: 'Show version info',
    requiredArgs: [],
    optionalArgs: [],
    agentFile: '',
  },
};

const VERSION = '1.0.0';

function printUsage(command?: string): void {
  if (command && COMMANDS[command]) {
    const config = COMMANDS[command];
    console.log(`\nUsage: npx ts-node scripts/speckit-cli.ts ${command} [options]\n`);
    console.log(`Description: ${config.description}\n`);
    console.log('Required Arguments:');
    config.requiredArgs.forEach((arg) => {
      console.log(`  --${arg} <value>`);
    });
    if (config.optionalArgs.length > 0) {
      console.log('\nOptional Arguments:');
      config.optionalArgs.forEach((arg) => {
        console.log(`  --${arg} <value>`);
      });
    }
    console.log('\nAgent File:');
    console.log(`  ${config.agentFile}`);
    console.log('');
  } else {
    console.log(`
Speckit CLI - Unified command entry for speckit-workflow
Version: ${VERSION}

Usage: npx ts-node scripts/speckit-cli.ts <command> [options]

Commands:
${Object.entries(COMMANDS)
  .map(([cmd, config]) => `  ${cmd.padEnd(12)} ${config.description}`)
  .join('\n')}

Global Options:
  --help        Show this help message
  --version     Show version info

Examples:
  npx ts-node scripts/speckit-cli.ts constitution --projectPath ./
  npx ts-node scripts/speckit-cli.ts specify --epic 4 --story 1
  npx ts-node scripts/speckit-cli.ts plan --epic 4 --story 1 --specPath specs/.../spec.md
  npx ts-node scripts/speckit-cli.ts implement --tasksPath specs/.../tasks.md

See docs/speckit-cli-complete-mapping.md for full documentation.
`);
  }
}

function parseArgs(args: string[]): { command: string; options: CliOptions } {
  const options: CliOptions = {};
  let command = '';

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (!arg.startsWith('--')) {
      if (!command) {
        command = arg;
      }
      continue;
    }

    const key = arg.slice(2);
    const nextArg = args[i + 1];

    if (nextArg && !nextArg.startsWith('--')) {
      options[key] = nextArg;
      i++;
    } else {
      options[key] = true;
    }
  }

  return { command, options };
}

function validateArgs(command: string, options: CliOptions): string | null {
  const config = COMMANDS[command];
  if (!config) {
    return `Unknown command: ${command}`;
  }

  for (const arg of config.requiredArgs) {
    if (!options[arg]) {
      return `Missing required argument: --${arg}`;
    }
  }

  return null;
}

function buildAgentCommand(command: string, options: CliOptions): string {
  const config = COMMANDS[command];
  const agentPath = path.resolve(config.agentFile);

  // Read agent file to get context
  let agentContext = '';
  if (fs.existsSync(agentPath)) {
    agentContext = fs.readFileSync(agentPath, 'utf8').slice(0, 2000);
  }

  // Build the claude-code command
  const args: string[] = [];

  // Add required args
  config.requiredArgs.forEach((arg) => {
    if (options[arg]) {
      args.push(`--${arg} ${options[arg]}`);
    }
  });

  // Add optional args
  config.optionalArgs.forEach((arg) => {
    if (options[arg]) {
      args.push(`--${arg} ${options[arg]}`);
    }
  });

  return `
# Speckit CLI Command: ${command}
# Description: ${config.description}
# Agent: ${config.agentFile}

## Context
${agentContext}

## Execution
Execute the ${command} stage with the following parameters:
${args.join('\n')}

## Expected Output
See agent definition for expected outputs and handoff protocol.
`;
}

function runValidation(projectPath: string = './'): void {
  console.log('Validating speckit configuration...\n');

  const checks = [
    { name: 'Agent definitions', path: '.claude/agents/' },
    { name: 'Protocol schemas', path: '.claude/protocols/' },
    { name: 'State directory', path: '.claude/state/' },
    { name: 'Scripts', path: 'scripts/' },
  ];

  let allValid = true;

  checks.forEach((check) => {
    const fullPath = path.resolve(projectPath, check.path);
    const exists = fs.existsSync(fullPath);
    console.log(`${exists ? '✅' : '❌'} ${check.name}: ${check.path}`);
    if (!exists) allValid = false;
  });

  // Check for required agents
  console.log('\nRequired Agents:');
  const requiredAgents = [
    'speckit-constitution.md',
    'speckit-specify.md',
    'speckit-plan.md',
    'speckit-gaps.md',
    'speckit-tasks.md',
    'speckit-implement.md',
    'speckit-clarify.md',
    'speckit-checklist.md',
    'speckit-analyze.md',
    'bmad-master.md',
    'gaps.md',
  ];

  requiredAgents.forEach((agent) => {
    const agentPath = path.resolve(projectPath, '.claude/agents', agent);
    const exists = fs.existsSync(agentPath);
    console.log(`${exists ? '✅' : '❌'} ${agent}`);
    if (!exists) allValid = false;
  });

  // Check for protocols
  console.log('\nRequired Protocols:');
  const requiredProtocols = ['audit-result-schema.md', 'handoff-schema.md', 'commit-protocol.md'];

  requiredProtocols.forEach((protocol) => {
    const protocolPath = path.resolve(projectPath, '.claude/protocols', protocol);
    const exists = fs.existsSync(protocolPath);
    console.log(`${exists ? '✅' : '❌'} ${protocol}`);
    if (!exists) allValid = false;
  });

  console.log(`\n${allValid ? '✅ All checks passed!' : '❌ Some checks failed.'}`);
  process.exit(allValid ? 0 : 1);
}

export async function runAudit(
  stage: string,
  artifactPath: string,
  options: CliOptions,
  deps: {
    runAuditorHostImpl?: typeof runAuditorHost;
  } = {}
): Promise<void> {
  if (!isReviewerAuditEntryStage(stage)) {
    console.error(`Unknown stage: ${stage}`);
    process.exit(1);
  }

  const reportPath =
    (typeof options.reportPath === 'string' && options.reportPath.trim() !== ''
      ? options.reportPath
      : undefined) ?? undefined;

  const runAuditorHostImpl = deps.runAuditorHostImpl ?? runAuditorHost;
  const result = await runAuditorHostImpl({
    projectRoot: process.cwd(),
    stage,
    artifactPath,
    reportPath,
    iterationCount: options.iterationCount as string | undefined,
  });

  const closeoutApproved =
    result &&
    typeof result === 'object' &&
    'closeoutEnvelope' in result &&
    result.closeoutEnvelope &&
    typeof result.closeoutEnvelope === 'object'
      ? isReviewCloseoutApproved(result.closeoutEnvelope as {
          resultCode: 'approved' | 'required_fixes' | 'blocked' | 'unknown';
          packetExecutionClosureStatus:
            | 'awaiting_rerun_gate'
            | 'retry_pending'
            | 'gate_passed'
            | 'escalated';
        })
      : result.status === 'PASS';

  if (result.status !== 'PASS' || !closeoutApproved) {
    console.error('Audit failed');
    process.exit(1);
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === '--help' || args[0] === 'help') {
    printUsage();
    process.exit(0);
  }

  if (args[0] === '--version' || args[0] === 'version') {
    console.log(`Speckit CLI v${VERSION}`);
    process.exit(0);
  }

  const { command, options } = parseArgs(args);

  if (!command) {
    console.error('Error: No command specified\n');
    printUsage();
    process.exit(1);
  }

  // Handle validate command
  if (command === 'validate') {
    runValidation(options.projectPath as string);
    return;
  }

  // Handle version command
  if (command === 'version') {
    console.log(`Speckit CLI v${VERSION}`);
    process.exit(0);
  }

  // Handle audit command
  if (command === 'audit') {
    const error = validateArgs(command, options);
    if (error) {
      console.error(`Error: ${error}\n`);
      printUsage(command);
      process.exit(1);
    }
    await runAudit(options.stage as string, options.artifactPath as string, options);
    return;
  }

  // Validate command exists
  if (!COMMANDS[command]) {
    console.error(`Error: Unknown command '${command}'\n`);
    printUsage();
    process.exit(1);
  }

  // Validate required arguments
  const error = validateArgs(command, options);
  if (error) {
    console.error(`Error: ${error}\n`);
    printUsage(command);
    process.exit(1);
  }

  // Build and output agent command
  const agentCommand = buildAgentCommand(command, options);
  console.log(agentCommand);

  // Write to handoff file for bmad-master
  const handoffPath = path.resolve('.claude/state/last-handoff.yaml');
  const handoff = `
# Auto-generated handoff from speckit-cli
command: ${command}
timestamp: ${new Date().toISOString()}
options:
${Object.entries(options)
  .map(([k, v]) => `  ${k}: ${v}`)
  .join('\n')}
agent: ${COMMANDS[command].agentFile}
stage: ${COMMANDS[command].stage || 'N/A'}
`;

  fs.writeFileSync(handoffPath, handoff);
  console.log(`\nHandoff written to: ${handoffPath}`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
