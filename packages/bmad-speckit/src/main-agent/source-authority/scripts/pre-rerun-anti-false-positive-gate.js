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
exports.evaluatePreRerunAntiFalsePositiveGate = evaluatePreRerunAntiFalsePositiveGate;
exports.mainPreRerunAntiFalsePositiveGate = mainPreRerunAntiFalsePositiveGate;
/* eslint-disable no-console */
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const ai_tdd_contract_gate_1 = require("./ai-tdd-contract-gate");
function parseArgs(argv) {
    const out = {};
    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];
        if (arg === '--help' || arg === '-h')
            out.help = true;
        else if (arg === '--json')
            out.json = true;
        else if (arg.startsWith('--')) {
            const value = argv[index + 1];
            if (!value || value.startsWith('--'))
                throw new Error(`Missing value for ${arg}`);
            out[arg.slice(2).replace(/-([a-z])/gu, (_, letter) => letter.toUpperCase())] = value;
            index += 1;
        }
        else {
            throw new Error(`Unexpected positional argument: ${arg}`);
        }
    }
    return out;
}
function text(value) {
    return typeof value === 'string' ? value.trim() : '';
}
function normalizePath(value) {
    return value.replace(/\\/gu, '/');
}
function readJson(file) {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
        throw new Error(`JSON object expected: ${file}`);
    return parsed;
}
function currentAttempt(record, explicit) {
    if (explicit)
        return explicit;
    const closeout = record.closeout && typeof record.closeout === 'object' && !Array.isArray(record.closeout)
        ? record.closeout
        : {};
    return text(closeout.currentAttemptId) || 'pre-rerun-attempt';
}
function evaluatePreRerunAntiFalsePositiveGate(input) {
    const evaluatedAt = input.evaluatedAt ?? new Date().toISOString();
    const evaluatedBy = input.evaluatedBy ?? 'agent';
    const attemptId = currentAttempt(input.record, input.attemptId);
    const aiTddReport = (0, ai_tdd_contract_gate_1.evaluateAiTddContractGate)({
        sourcePath: input.sourcePath,
        record: input.record,
        recordPath: input.recordPath,
        mode: 'pre-rerun',
        attemptId,
        evaluatedAt,
        evaluatedBy,
    });
    const subReports = Array.isArray(aiTddReport.subReports)
        ? aiTddReport.subReports
        : [];
    const blockingReasons = Array.isArray(aiTddReport.blockingReasons)
        ? aiTddReport.blockingReasons
        : [];
    return {
        reportType: 'pre_rerun_anti_false_positive_report',
        generatedAt: evaluatedAt,
        generatedBy: evaluatedBy,
        sourcePath: normalizePath(path.resolve(input.sourcePath)),
        recordPath: normalizePath(path.resolve(input.recordPath)),
        currentAttemptId: attemptId,
        decision: blockingReasons.length === 0 ? 'pass' : 'blocked',
        blockingReasons,
        subReports,
        aiTddContractGateReport: aiTddReport,
        mutationPolicy: {
            writesPass: false,
            closesTrace: false,
            writesRecordClosed: false,
            modifiesSourceTraceRows: false,
        },
    };
}
function mainPreRerunAntiFalsePositiveGate(argv) {
    const args = parseArgs(argv);
    if (args.help) {
        console.log('Usage: pre-rerun-anti-false-positive-gate --source <requirement.md> --requirement-record <json> [--attempt-id <id>] [--report-path <json>] [--json]');
        return 0;
    }
    if (!args.source || !args.requirementRecord)
        throw new Error('missing required args: source, requirementRecord');
    const recordPath = path.resolve(args.requirementRecord);
    const reportPath = path.resolve(args.reportPath ??
        path.join(path.dirname(recordPath), 'pre-rerun-anti-false-positive-report.json'));
    const report = evaluatePreRerunAntiFalsePositiveGate({
        sourcePath: args.source,
        record: readJson(recordPath),
        recordPath,
        attemptId: args.attemptId,
        evaluatedAt: args.evaluatedAt,
        evaluatedBy: args.evaluatedBy,
    });
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    const output = {
        ok: true,
        reportPath: normalizePath(reportPath),
        decision: report.decision,
        blockingReasons: report.blockingReasons,
    };
    process.stdout.write(args.json
        ? `${JSON.stringify(output, null, 2)}\n`
        : `pre_rerun_anti_false_positive=${report.decision}\n`);
    return text(report.decision) === 'pass' ? 0 : 1;
}
if (require.main === module) {
    try {
        process.exitCode = mainPreRerunAntiFalsePositiveGate(process.argv.slice(2));
    }
    catch (error) {
        console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }, null, 2));
        process.exitCode = 2;
    }
}
