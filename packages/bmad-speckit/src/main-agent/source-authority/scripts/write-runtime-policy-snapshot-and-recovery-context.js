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
exports.mainWriteRuntimePolicySnapshotAndRecoveryContext = mainWriteRuntimePolicySnapshotAndRecoveryContext;
/* eslint-disable no-console */
const crypto = __importStar(require("node:crypto"));
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const policy_1 = require("../packages/scoring/policy");
const emit_runtime_policy_1 = require("./emit-runtime-policy");
function parseArgs(argv) {
    const out = {};
    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];
        if (arg === '--help' || arg === '-h')
            out.help = true;
        else if (arg === '--json')
            out.json = true;
        else if (arg.startsWith('--')) {
            const key = arg.slice(2).replace(/-([a-z])/gu, (_, letter) => letter.toUpperCase());
            const value = argv[index + 1];
            if (!value || value.startsWith('--'))
                throw new Error(`Missing value for ${arg}`);
            out[key] = value;
            index += 1;
        }
        else {
            throw new Error(`Unexpected positional argument: ${arg}`);
        }
    }
    return out;
}
function sha256Buffer(value) {
    return `sha256:${crypto.createHash('sha256').update(value).digest('hex')}`;
}
function sortKeysDeep(value) {
    if (value === null || typeof value !== 'object')
        return value;
    if (Array.isArray(value))
        return value.map(sortKeysDeep);
    const out = {};
    for (const key of Object.keys(value).sort())
        out[key] = sortKeysDeep(value[key]);
    return out;
}
function stablePolicyHash(value) {
    return sha256Buffer(JSON.stringify(sortKeysDeep(value)));
}
function normalizePathForRecord(value) {
    return value.replace(/\\/gu, '/');
}
function text(value) {
    return typeof value === 'string' ? value.trim() : '';
}
function asObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? value
        : undefined;
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
function captureRuntimePolicy(args, root) {
    const chunks = [];
    const errors = [];
    const origWrite = process.stdout.write.bind(process.stdout);
    const origError = console.error;
    process.stdout.write = (msg) => {
        chunks.push(typeof msg === 'string' ? msg : Buffer.from(msg).toString('utf8'));
        return true;
    };
    console.error = (...items) => {
        errors.push(items.map((item) => String(item)).join(' '));
    };
    try {
        const emitArgs = ['--cwd', root];
        if (args.recordId)
            emitArgs.push('--record-id', args.recordId);
        if (args.requirementSetId)
            emitArgs.push('--requirement-set-id', args.requirementSetId);
        if (args.runId)
            emitArgs.push('--run-id', args.runId);
        const code = (0, emit_runtime_policy_1.mainEmitRuntimePolicy)(emitArgs);
        if (code !== 0)
            throw new Error(errors.join('\n') || `emit-runtime-policy exited ${code}`);
    }
    finally {
        process.stdout.write = origWrite;
        console.error = origError;
    }
    return readJsonFromText(chunks.join(''));
}
function readJsonFromText(value) {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('runtime policy JSON object expected');
    }
    return parsed;
}
function architectureHash(record) {
    return text(asObject(record.architectureConfirmationState)?.currentArchitectureConfirmationHash);
}
function runtimePolicySnapshotRef(input) {
    return {
        eventType: 'artifact_indexed',
        artifactType: 'runtime_policy_snapshot',
        sourceOfTruthRole: 'projection',
        recordId: text(input.record.recordId),
        requirementSetId: text(input.record.requirementSetId),
        path: normalizePathForRecord(path.relative(input.root, input.snapshotPath)),
        contentHash: input.snapshotHash,
        producer: 'write-runtime-policy-snapshot-and-recovery-context',
        purpose: 'Requirement-scoped runtime policy snapshot for recovery, audit, hook trust, and closeout context; not a direct control decision source.',
        relatedRequirementIds: ['MUST-026', 'NEG-014', 'OUT-012', 'EVD-026', 'TRACE-019'],
        status: 'active',
        inputVersion: `source=${text(input.record.sourceDocumentHash)};implementation=${text(input.record.implementationConfirmationHash)};architecture=${architectureHash(input.record)}`,
        outputVersion: 'runtime-policy-snapshot/v1',
        traceRows: ['TRACE-019'],
        evidenceRefs: ['EVD-026'],
    };
}
function buildSnapshot(input) {
    return {
        kind: 'runtime-policy-snapshot',
        schemaVersion: 'runtime-policy-snapshot/v1',
        recordId: text(input.record.recordId),
        requirementSetId: text(input.record.requirementSetId),
        generatedAt: input.generatedAt,
        sourceDocumentHash: text(input.record.sourceDocumentHash),
        implementationConfirmationHash: text(input.record.implementationConfirmationHash),
        architectureConfirmationHash: architectureHash(input.record),
        policyHash: stablePolicyHash(input.policy),
        policy: input.policy,
        resolvedScoringPolicy: input.resolvedScoringPolicy,
        locale: input.locale,
        host: input.host,
        stage: text(input.policy.stage),
        strictness: text(input.policy.strictness),
        mandatoryGates: input.policy.mandatoryGate === true ? ['runtime_mandatory_gate'] : [],
        localeIsolation: {
            localeAffectsConfirmationLanguage: false,
            localeAffectsRequirementSemantics: false,
            localeAffectsPassEvidence: false,
            localeAffectsCloseout: false,
        },
    };
}
function buildRecoveryContext(input) {
    return {
        kind: 'recovery-context',
        schemaVersion: 'recovery-context/v1',
        recordId: text(input.record.recordId),
        requirementSetId: text(input.record.requirementSetId),
        generatedAt: input.generatedAt,
        resolvedRuntimeContext: input.loaded.resolvedRuntimeContext,
        runtimePolicySnapshotRef: input.runtimePolicySnapshotRef,
        controlSource: 'requirement-record.json',
        legacyRuntimeContextAllowed: false,
    };
}
function resolveScoringPolicyRuleRoot(root) {
    if (fs.existsSync(path.join(root, 'packages', 'scoring', 'rules')))
        return root;
    return path.resolve(__dirname, '..');
}
function mainWriteRuntimePolicySnapshotAndRecoveryContext(argv) {
    const args = parseArgs(argv);
    if (args.help) {
        console.log('Usage: write-runtime-policy-snapshot-and-recovery-context --record-id <id> --requirement-set-id <id> [--json]');
        return 0;
    }
    const root = path.resolve(args.cwd ?? process.cwd());
    const loaded = (0, emit_runtime_policy_1.loadPolicyContextFromRegistry)(root, {
        recordId: args.recordId,
        requirementSetId: args.requirementSetId,
        runId: args.runId,
    });
    const record = readJson(loaded.resolvedContextPath);
    const policy = captureRuntimePolicy(args, root);
    const resolvedScoringPolicy = (0, policy_1.resolveScoringPolicy)({
        root,
        ruleRoot: resolveScoringPolicyRuleRoot(root),
    });
    const generatedAt = args.generatedAt ?? new Date().toISOString();
    const outDir = path.resolve(args.outDir ?? path.dirname(loaded.resolvedRuntimeContext.runtimePolicySnapshotPath));
    const snapshotPath = path.join(outDir, 'runtime-policy-snapshot.json');
    const recoveryContextPath = path.join(outDir, 'recovery-context.json');
    const snapshot = buildSnapshot({
        record,
        policy,
        resolvedScoringPolicy,
        locale: args.locale ?? 'zh-CN',
        host: args.host ?? 'codex',
        generatedAt,
    });
    writeJson(snapshotPath, snapshot);
    const snapshotHash = sha256Buffer(fs.readFileSync(snapshotPath));
    const ref = runtimePolicySnapshotRef({ root, record, snapshotPath, snapshotHash });
    const recoveryContext = buildRecoveryContext({
        record,
        loaded,
        runtimePolicySnapshotRef: ref,
        generatedAt,
    });
    writeJson(recoveryContextPath, recoveryContext);
    const output = {
        ok: true,
        runtimePolicySnapshotPath: normalizePathForRecord(snapshotPath),
        runtimePolicySnapshotHash: snapshotHash,
        recoveryContextPath: normalizePathForRecord(recoveryContextPath),
        runtimePolicySnapshotRef: ref,
    };
    process.stdout.write(args.json ? `${JSON.stringify(output, null, 2)}\n` : `runtime_policy_snapshot=${snapshotHash}\n`);
    return 0;
}
if (require.main === module) {
    try {
        process.exitCode = mainWriteRuntimePolicySnapshotAndRecoveryContext(process.argv.slice(2));
    }
    catch (error) {
        console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }, null, 2));
        process.exitCode = 2;
    }
}
