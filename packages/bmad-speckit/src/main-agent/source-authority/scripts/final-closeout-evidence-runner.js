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
exports.mainFinalCloseoutEvidenceRunner = mainFinalCloseoutEvidenceRunner;
/* eslint-disable no-console */
const node_child_process_1 = require("node:child_process");
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const DYNAMIC_RUNNER = 'scripts/run-required-commands-from-ai-tdd-manifest.ts';
function parseArgs(argv) {
    const args = {};
    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];
        if (arg === '--json')
            args.json = true;
        else if (arg === '--help' || arg === '-h')
            args.help = true;
        else if (arg === '--strict-proof-only')
            args.strictProofOnly = true;
        else if (arg === '--record-closeout-receipt')
            args.recordCloseoutReceipt = true;
        else if (arg.startsWith('--')) {
            const value = argv[index + 1];
            if (!value || value.startsWith('--'))
                throw new Error(`Missing value for ${arg}`);
            args[arg.slice(2).replace(/-([a-z])/gu, (_, letter) => letter.toUpperCase())] = value;
            index += 1;
        }
        else {
            throw new Error(`Unexpected positional argument: ${arg}`);
        }
    }
    return args;
}
function text(value) {
    return typeof value === 'string' ? value.trim() : '';
}
function normalizePath(value) {
    return value.replace(/\\/gu, '/');
}
function readJson(file) {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error(`JSON object expected: ${file}`);
    }
    return parsed;
}
function writeJson(file, value) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}
function recordPathForArgs(args) {
    if (!args.requirementRecord)
        throw new Error('missing required args: requirement-record');
    return path.resolve(args.requirementRecord);
}
function sourcePathForArgs(args, record) {
    const source = text(args.sourceDocument) || text(args.source) || text(record.sourcePath);
    if (!source)
        throw new Error('missing required args: source-document');
    return path.resolve(source);
}
function runDynamicRunner(input) {
    const command = [
        'npx.cmd',
        'ts-node',
        '--project',
        'tsconfig.node.json',
        '--transpile-only',
        DYNAMIC_RUNNER,
        '--source',
        input.sourcePath,
        '--requirement-record',
        input.recordPath,
        '--mode',
        'closeout',
        '--attempt-id',
        input.attemptId,
        '--run-id',
        input.runId,
        '--evidence-dir',
        input.evidenceDir,
        '--json',
    ];
    const result = (0, node_child_process_1.spawnSync)(command[0], command.slice(1), {
        cwd: process.cwd(),
        encoding: 'utf8',
        shell: process.platform === 'win32',
        windowsHide: true,
        maxBuffer: 32 * 1024 * 1024,
    });
    fs.mkdirSync(input.evidenceDir, { recursive: true });
    const outputPath = path.join(input.evidenceDir, 'CMD-AI-TDD-MANIFEST-DYNAMIC-RUNNER.output.txt');
    fs.writeFileSync(outputPath, [
        `COMMAND: ${command.join(' ')}`,
        `EXIT_CODE: ${result.status ?? 2}`,
        'STDOUT:',
        result.stdout ?? '',
        'STDERR:',
        result.stderr ?? '',
        result.error ? `SPAWN_ERROR: ${result.error.message}` : '',
    ].join('\n'), 'utf8');
    writeJson(path.join(input.evidenceDir, 'run-meta.json'), {
        schemaVersion: 'generic-final-closeout-run-meta/v1',
        delegatedRunner: DYNAMIC_RUNNER,
        delegatedRunnerOutput: normalizePath(outputPath),
        sourcePath: normalizePath(input.sourcePath),
        recordPath: normalizePath(input.recordPath),
        runId: input.runId,
        closeoutAttemptId: input.attemptId,
        evidenceDir: normalizePath(input.evidenceDir),
    });
    const ok = result.status === 0;
    const payload = {
        ok,
        delegatedRunner: DYNAMIC_RUNNER,
        delegatedRunnerOutput: normalizePath(outputPath),
        runId: input.runId,
        closeoutAttemptId: input.attemptId,
        evidenceDir: normalizePath(input.evidenceDir),
    };
    process.stdout.write(input.args.json
        ? `${JSON.stringify(payload, null, 2)}\n`
        : `final_closeout_evidence=${ok ? 'pass' : 'blocked'}\n`);
    return ok ? 0 : 1;
}
function mainFinalCloseoutEvidenceRunner(argv) {
    const args = parseArgs(argv);
    if (args.help) {
        console.log('Usage: final-closeout-evidence-runner --requirement-record <json> --source-document <md> [--run-id <id>] [--attempt-id <id>] [--evidence-dir <dir>] [--json]');
        return 0;
    }
    if (args.strictProofOnly || args.recordCloseoutReceipt) {
        throw new Error('final-closeout-evidence-runner no longer executes local closeout paths; use the manifest dynamic runner');
    }
    const recordPath = recordPathForArgs(args);
    const record = readJson(recordPath);
    const recordId = text(record.recordId) || 'REQ-AI-TDD-MANIFEST';
    const timestamp = new Date()
        .toISOString()
        .replace(/[-:]/gu, '')
        .replace(/\.\d{3}Z$/u, 'Z');
    const runId = args.runId ?? `run-AI-TDD-MANIFEST-${timestamp}`;
    const attemptId = args.attemptId ?? `closeout-attempt-${recordId}-${timestamp}`;
    const evidenceDir = args.evidenceDir ??
        `_bmad-output/runtime/requirement-records/${recordId}/evidence/AI-TDD-MANIFEST/${runId}`;
    return runDynamicRunner({
        args,
        recordPath,
        sourcePath: sourcePathForArgs(args, record),
        runId,
        attemptId,
        evidenceDir,
    });
}
if (require.main === module) {
    try {
        process.exitCode = mainFinalCloseoutEvidenceRunner(process.argv.slice(2));
    }
    catch (error) {
        console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }, null, 2));
        process.exitCode = 2;
    }
}
