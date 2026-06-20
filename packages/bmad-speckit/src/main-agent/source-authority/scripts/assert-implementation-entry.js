"use strict";
/* eslint-disable no-console */
Object.defineProperty(exports, "__esModule", { value: true });
exports.mainAssertImplementationEntry = mainAssertImplementationEntry;
const path = require("node:path");
const emit_runtime_policy_1 = require("./emit-runtime-policy");
function parseArgs(argv) {
    const out = {};
    for (let index = 0; index < argv.length; index += 1) {
        const token = argv[index];
        if (token === '--cwd' && argv[index + 1]) {
            out.cwd = argv[index + 1];
            index += 1;
        }
    }
    return out;
}
function pickRoot(args) {
    const fromArg = args.cwd?.trim();
    return fromArg ? path.resolve(fromArg) : process.cwd();
}
function mainAssertImplementationEntry(argv) {
    const args = parseArgs(argv);
    const root = pickRoot(args);
    let loaded;
    try {
        loaded = (0, emit_runtime_policy_1.loadPolicyContextFromRegistry)(root);
    }
    catch (error) {
        console.error(`assert-implementation-entry: ${error instanceof Error ? error.message : String(error)}`);
        return 1;
    }
    const flow = loaded.flow;
    if (flow !== 'story' && flow !== 'bugfix' && flow !== 'standalone_tasks') {
        console.error(`assert-implementation-entry: unsupported flow=${loaded.flow}`);
        return 1;
    }
    const stdoutChunks = [];
    const originalWrite = process.stdout.write.bind(process.stdout);
    process.stdout.write = (chunk) => {
        stdoutChunks.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8'));
        return true;
    };
    try {
        const code = (0, emit_runtime_policy_1.mainEmitRuntimePolicy)(['--cwd', root]);
        if (code !== 0) {
            console.error('assert-implementation-entry: emit-runtime-policy failed');
            return 1;
        }
    }
    finally {
        process.stdout.write = originalWrite;
    }
    const policy = JSON.parse(stdoutChunks.join(''));
    process.stdout.write(`${JSON.stringify(policy.implementationEntryGate ?? {}, null, 2)}\n`);
    return policy.implementationEntryGate?.decision === 'pass' ? 0 : 2;
}
if (require.main === module) {
    process.exit(mainAssertImplementationEntry(process.argv.slice(2)));
}
