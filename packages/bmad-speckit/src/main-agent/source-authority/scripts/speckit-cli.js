"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.prepareImplementRalphTracking = prepareImplementRalphTracking;
exports.verifyImplementRalphTracking = verifyImplementRalphTracking;
exports.recordImplementRalphTddPhase = recordImplementRalphTddPhase;
exports.buildAgentCommand = buildAgentCommand;
exports.runAudit = runAudit;
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
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const child_process_1 = require("child_process");
const reviewer_registry_1 = require("./reviewer-registry");
const run_auditor_host_1 = require("./run-auditor-host");
const reviewer_schema_1 = require("./reviewer-schema");
const speckit_implement_1 = require("./ralph-method/speckit-implement");
function buildCrossPlatformCommand(command) {
    if (process.platform !== 'win32') {
        return command;
    }
    const escaped = command.replace(/"/g, '""');
    return `cmd.exe /d /s /c "${escaped}"`;
}
const COMMANDS = {
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
const VERSION = '2.0.1';
function printUsage(command) {
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
    }
    else {
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
function parseArgs(args) {
    const options = {};
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
        }
        else {
            options[key] = true;
        }
    }
    return { command, options };
}
function validateArgs(command, options) {
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
function resolveCurrentBranchName(projectRoot, tasksPath) {
    try {
        const current = (0, child_process_1.execSync)(buildCrossPlatformCommand('git branch --show-current'), {
            cwd: projectRoot,
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'ignore'],
        }).trim();
        if (current) {
            return current;
        }
    }
    catch {
        // Fall through to deterministic local fallback.
    }
    return `speckit-implement/${path.basename(tasksPath, path.extname(tasksPath))}`;
}
function prepareImplementRalphTracking(options, deps = {}) {
    const projectRoot = path.resolve(deps.projectRoot ?? process.cwd());
    const tasksPath = path.isAbsolute(String(options.tasksPath))
        ? path.resolve(String(options.tasksPath))
        : path.resolve(projectRoot, String(options.tasksPath));
    return (0, speckit_implement_1.prepareSpeckitImplementRalphTracking)({
        projectRoot,
        tasksPath: String(options.tasksPath),
        mode: typeof options.mode === 'string' ? options.mode : undefined,
        epic: typeof options.epic === 'string' ? options.epic : undefined,
        story: typeof options.story === 'string' ? options.story : undefined,
        epicSlug: typeof options.epicSlug === 'string' ? options.epicSlug : undefined,
        storySlug: typeof options.storySlug === 'string' ? options.storySlug : undefined,
        branchName: resolveCurrentBranchName(projectRoot, tasksPath),
    });
}
function verifyImplementRalphTracking(options, deps = {}) {
    const projectRoot = path.resolve(deps.projectRoot ?? process.cwd());
    return (0, speckit_implement_1.verifySpeckitImplementRalphTracking)({
        projectRoot,
        tasksPath: String(options.tasksPath),
        mode: typeof options.mode === 'string' ? options.mode : undefined,
        epic: typeof options.epic === 'string' ? options.epic : undefined,
        story: typeof options.story === 'string' ? options.story : undefined,
        epicSlug: typeof options.epicSlug === 'string' ? options.epicSlug : undefined,
        storySlug: typeof options.storySlug === 'string' ? options.storySlug : undefined,
    });
}
function getRequiredStringOption(options, key) {
    const value = options[key];
    if (typeof value !== 'string' || value.trim() === '') {
        throw new Error(`Missing required argument: --${key}`);
    }
    return value;
}
function recordImplementRalphTddPhase(options, deps = {}) {
    const projectRoot = path.resolve(deps.projectRoot ?? process.cwd());
    return (0, speckit_implement_1.recordSpeckitImplementRalphPhase)({
        projectRoot,
        tasksPath: getRequiredStringOption(options, 'tasksPath'),
        mode: typeof options.mode === 'string' ? options.mode : undefined,
        epic: typeof options.epic === 'string' ? options.epic : undefined,
        story: typeof options.story === 'string' ? options.story : undefined,
        epicSlug: typeof options.epicSlug === 'string' ? options.epicSlug : undefined,
        storySlug: typeof options.storySlug === 'string' ? options.storySlug : undefined,
        userStoryId: getRequiredStringOption(options, 'userStoryId'),
        title: getRequiredStringOption(options, 'title'),
        phase: getRequiredStringOption(options, 'phase'),
        detail: getRequiredStringOption(options, 'detail'),
        storyLogTimestamp: typeof options.storyLogTimestamp === 'string' ? options.storyLogTimestamp : undefined,
    });
}
function buildAgentCommand(command, options) {
    const config = COMMANDS[command];
    const agentPath = path.resolve(config.agentFile);
    // Read agent file to get context
    let agentContext = '';
    if (fs.existsSync(agentPath)) {
        agentContext = fs.readFileSync(agentPath, 'utf8').slice(0, 2000);
    }
    // Build the claude-code command
    const args = [];
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
    const ralphSharedTrackingSection = command === 'implement' &&
        typeof options.prdPath === 'string' &&
        typeof options.progressPath === 'string'
        ? `
## Ralph Shared Tracking
- prdPath: ${options.prdPath}
- progressPath: ${options.progressPath}
- Final compliance gate: ${typeof options.ralphVerifyCommand === 'string' ? options.ralphVerifyCommand : 'n/a'}

## Ralph Script-Enforced Subset
${speckit_implement_1.RALPH_SCRIPT_ENFORCED_SUBSET.map((item) => `- ${item}`).join('\n')}

## Ralph Phase Hooks
- TDD-RED hook: ${(0, speckit_implement_1.buildSpeckitImplementRecordPhaseCommand)({
            tasksPath: String(options.tasksPath),
            mode: typeof options.mode === 'string' ? options.mode : undefined,
            epic: typeof options.epic === 'string' ? options.epic : undefined,
            story: typeof options.story === 'string' ? options.story : undefined,
            epicSlug: typeof options.epicSlug === 'string' ? options.epicSlug : undefined,
            storySlug: typeof options.storySlug === 'string' ? options.storySlug : undefined,
            userStoryId: '<US-ID>',
            title: '<US title>',
            phase: 'TDD-RED',
            detail: '<failing test command => N failed>',
            storyLogTimestamp: '<ISO8601>',
        })}
- TDD-GREEN hook: ${(0, speckit_implement_1.buildSpeckitImplementRecordPhaseCommand)({
            tasksPath: String(options.tasksPath),
            mode: typeof options.mode === 'string' ? options.mode : undefined,
            epic: typeof options.epic === 'string' ? options.epic : undefined,
            story: typeof options.story === 'string' ? options.story : undefined,
            epicSlug: typeof options.epicSlug === 'string' ? options.epicSlug : undefined,
            storySlug: typeof options.storySlug === 'string' ? options.storySlug : undefined,
            userStoryId: '<US-ID>',
            title: '<US title>',
            phase: 'TDD-GREEN',
            detail: '<passing test command => N passed>',
            storyLogTimestamp: '<ISO8601>',
        })}
- TDD-REFACTOR hook: ${(0, speckit_implement_1.buildSpeckitImplementRecordPhaseCommand)({
            tasksPath: String(options.tasksPath),
            mode: typeof options.mode === 'string' ? options.mode : undefined,
            epic: typeof options.epic === 'string' ? options.epic : undefined,
            story: typeof options.story === 'string' ? options.story : undefined,
            epicSlug: typeof options.epicSlug === 'string' ? options.epicSlug : undefined,
            storySlug: typeof options.storySlug === 'string' ? options.storySlug : undefined,
            userStoryId: '<US-ID>',
            title: '<US title>',
            phase: 'TDD-REFACTOR',
            detail: '<refactor summary>',
            storyLogTimestamp: '<ISO8601>',
        })}
`
        : '';
    return `
# Speckit CLI Command: ${command}
# Description: ${config.description}
# Agent: ${config.agentFile}

## Context
${agentContext}

## Execution
Execute the ${command} stage with the following parameters:
${args.join('\n')}
${ralphSharedTrackingSection}

## Expected Output
See agent definition for expected outputs and handoff protocol.
`;
}
function runValidation(projectPath = './') {
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
        if (!exists)
            allValid = false;
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
        if (!exists)
            allValid = false;
    });
    // Check for protocols
    console.log('\nRequired Protocols:');
    const requiredProtocols = ['audit-result-schema.md', 'handoff-schema.md', 'commit-protocol.md'];
    requiredProtocols.forEach((protocol) => {
        const protocolPath = path.resolve(projectPath, '.claude/protocols', protocol);
        const exists = fs.existsSync(protocolPath);
        console.log(`${exists ? '✅' : '❌'} ${protocol}`);
        if (!exists)
            allValid = false;
    });
    console.log(`\n${allValid ? '✅ All checks passed!' : '❌ Some checks failed.'}`);
    process.exit(allValid ? 0 : 1);
}
async function runAudit(stage, artifactPath, options, deps = {}) {
    if (!(0, reviewer_registry_1.isReviewerAuditEntryStage)(stage)) {
        console.error(`Unknown stage: ${stage}`);
        process.exit(1);
    }
    const reportPath = (typeof options.reportPath === 'string' && options.reportPath.trim() !== ''
        ? options.reportPath
        : undefined) ?? undefined;
    const runAuditorHostImpl = deps.runAuditorHostImpl ?? run_auditor_host_1.runAuditorHost;
    const result = await runAuditorHostImpl({
        projectRoot: process.cwd(),
        stage,
        artifactPath,
        reportPath,
        iterationCount: options.iterationCount,
    });
    const closeoutApproved = result &&
        typeof result === 'object' &&
        'closeoutEnvelope' in result &&
        result.closeoutEnvelope &&
        typeof result.closeoutEnvelope === 'object'
        ? (0, reviewer_schema_1.isReviewCloseoutApproved)(result.closeoutEnvelope)
        : result.status === 'PASS';
    if (result.status !== 'PASS' || !closeoutApproved) {
        console.error('Audit failed');
        process.exit(1);
    }
}
async function main() {
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
        runValidation(options.projectPath);
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
        await runAudit(options.stage, options.artifactPath, options);
        return;
    }
    if (command === 'implement' && options.verifyRalph) {
        const verification = verifyImplementRalphTracking(options);
        if (verification.result.status !== 'pass') {
            console.error('Ralph compliance verification failed');
            verification.result.errors.forEach((error) => console.error(`- ${error}`));
            process.exit(1);
        }
        console.log('Ralph compliance verification passed');
        console.log(`prdPath: ${verification.paths.prdPath}`);
        console.log(`progressPath: ${verification.paths.progressPath}`);
        return;
    }
    if (command === 'implement' && options.recordTddPhase) {
        const recorded = recordImplementRalphTddPhase(options);
        console.log(`Recorded Ralph phase ${options.phase} for ${options.userStoryId}`);
        console.log(`prdPath: ${recorded.paths.prdPath}`);
        console.log(`progressPath: ${recorded.paths.progressPath}`);
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
    if (command === 'implement') {
        const prepared = prepareImplementRalphTracking(options);
        options.prdPath = prepared.paths.prdPath;
        options.progressPath = prepared.paths.progressPath;
        options.ralphVerifyCommand = prepared.verifyCommand;
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
