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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.mainTraceStatusPolicyCheck = mainTraceStatusPolicyCheck;
/* eslint-disable no-console */
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const js_yaml_1 = __importDefault(require("js-yaml"));
const ALLOWED_STATUSES = new Set([
    'PENDING',
    'PASS',
    'FAIL',
    'BLOCKED',
    'LINKED_DOWNSTREAM',
    'USER_APPROVED_DEFERRED',
    'USER_APPROVED_OUT_OF_SCOPE',
]);
const FULL_CLOSEOUT_STATUSES = new Set(['PASS', 'FAIL', 'BLOCKED']);
const USER_SCOPED_STATUSES = new Set([
    'LINKED_DOWNSTREAM',
    'USER_APPROVED_DEFERRED',
    'USER_APPROVED_OUT_OF_SCOPE',
]);
function parseArgs(argv) {
    const out = {};
    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];
        if (arg === '--help' || arg === '-h')
            out.help = true;
        else if (arg === '--json')
            out.json = true;
        else if (arg === '--full-closeout')
            out.fullCloseout = true;
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
function text(value) {
    return typeof value === 'string' ? value.trim() : '';
}
function objects(value) {
    return Array.isArray(value)
        ? value.filter((item) => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
        : [];
}
function strings(value) {
    return Array.isArray(value) ? value.map(text).filter(Boolean) : [];
}
function asObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? value
        : undefined;
}
function normalizePathForRecord(value) {
    return value.replace(/\\/gu, '/');
}
function readJson(file) {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error(`JSON object expected: ${file}`);
    }
    return parsed;
}
function extractImplementationConfirmation(sourceText) {
    const lines = sourceText.replace(/\r\n/gu, '\n').split('\n');
    const start = lines.findIndex((line) => /^implementationConfirmation:\s*$/u.test(line));
    if (start < 0)
        return undefined;
    let end = lines.length;
    for (let index = start + 1; index < lines.length; index += 1) {
        const line = lines[index];
        if (line.trim() === '')
            continue;
        if (/^\S/u.test(line) && !/^implementationConfirmation:\s*$/u.test(line)) {
            end = index;
            break;
        }
    }
    const parsed = asObject(js_yaml_1.default.load(lines.slice(start, end).join('\n')));
    return asObject(parsed?.implementationConfirmation);
}
function requiredFieldsPresent(row, fields) {
    return fields.filter((field) => {
        const value = row[field];
        if (Array.isArray(value))
            return value.length > 0;
        return !text(value);
    });
}
function validatePolicy(policy) {
    const issues = [];
    if (!policy)
        return ['traceStatusPolicy_missing'];
    if (text(policy.schemaVersion) !== 'trace-status-policy/v1')
        issues.push('traceStatusPolicy_schemaVersion_invalid');
    const allowed = new Set(strings(policy.allowedStatuses));
    for (const status of ALLOWED_STATUSES) {
        if (!allowed.has(status))
            issues.push(`traceStatusPolicy_missing_allowed_status:${status}`);
    }
    const terminal = new Set(strings(policy.terminalFullCloseoutStatuses));
    for (const status of FULL_CLOSEOUT_STATUSES) {
        if (!terminal.has(status))
            issues.push(`traceStatusPolicy_missing_terminal_status:${status}`);
    }
    for (const status of USER_SCOPED_STATUSES) {
        if (terminal.has(status))
            issues.push(`traceStatusPolicy_user_scoped_status_can_full_closeout:${status}`);
    }
    if (policy.bareDeferredForbidden !== true)
        issues.push('traceStatusPolicy_bareDeferredForbidden_must_be_true');
    if (policy.bareOutOfScopeForbidden !== true)
        issues.push('traceStatusPolicy_bareOutOfScopeForbidden_must_be_true');
    if (policy.fullCloseoutForUserScopedStatusesForbidden !== true) {
        issues.push('traceStatusPolicy_fullCloseoutForUserScopedStatusesForbidden_must_be_true');
    }
    return issues;
}
function validateTraceRows(sourceConfirmation, policy, activeTraceIds, fullCloseout) {
    if (!sourceConfirmation)
        return { issues: ['source_implementationConfirmation_missing'], rows: [] };
    const rows = objects(sourceConfirmation.traceRows).filter((row) => activeTraceIds.has(text(row.id)));
    const issues = [];
    const linkedFields = strings(policy?.linkedDownstreamRequiredFields);
    const deferredFields = strings(policy?.userApprovedDeferredRequiredFields);
    const outOfScopeFields = strings(policy?.userApprovedOutOfScopeRequiredFields);
    for (const row of rows) {
        const id = text(row.id);
        const status = text(row.status);
        if (!ALLOWED_STATUSES.has(status))
            issues.push(`traceRow_status_invalid:${id}:${status || '<missing>'}`);
        if (status === 'DEFERRED')
            issues.push(`traceRow_bare_deferred_forbidden:${id}`);
        if (status === 'OUT_OF_SCOPE')
            issues.push(`traceRow_bare_out_of_scope_forbidden:${id}`);
        if (fullCloseout && USER_SCOPED_STATUSES.has(status)) {
            issues.push(`traceRow_user_scoped_status_forbidden_for_full_closeout:${id}:${status}`);
        }
        if (status === 'LINKED_DOWNSTREAM') {
            for (const field of requiredFieldsPresent(row, linkedFields)) {
                issues.push(`traceRow_linked_downstream_field_missing:${id}:${field}`);
            }
        }
        if (status === 'USER_APPROVED_DEFERRED') {
            for (const field of requiredFieldsPresent(row, deferredFields)) {
                issues.push(`traceRow_user_deferred_field_missing:${id}:${field}`);
            }
        }
        if (status === 'USER_APPROVED_OUT_OF_SCOPE') {
            for (const field of requiredFieldsPresent(row, outOfScopeFields)) {
                issues.push(`traceRow_user_out_of_scope_field_missing:${id}:${field}`);
            }
        }
    }
    return {
        issues,
        rows: rows.map((row) => ({
            id: text(row.id),
            status: text(row.status),
            covers: strings(row.covers),
            taskRefs: strings(row.taskRefs),
            evidenceRefs: strings(row.evidenceRefs),
        })),
    };
}
function buildReport(args) {
    if (!args.requirementRecord)
        throw new Error('missing required args: requirementRecord');
    const recordPath = path.resolve(args.requirementRecord);
    const record = readJson(recordPath);
    const sourcePath = args.source ? path.resolve(args.source) : '';
    const sourceConfirmation = sourcePath
        ? extractImplementationConfirmation(fs.readFileSync(sourcePath, 'utf8'))
        : undefined;
    const policy = asObject(record.traceStatusPolicy);
    const activeTraceIds = new Set(objects(record.executionIterations).flatMap((item) => strings(item.traceRows)));
    const policyIssues = validatePolicy(policy);
    const rowCheck = validateTraceRows(sourceConfirmation, policy, activeTraceIds, args.fullCloseout === true);
    const blockingReasons = [...policyIssues, ...rowCheck.issues];
    const decision = blockingReasons.length ? 'blocked' : 'pass';
    return {
        reportType: 'main_agent_trace_status_policy_check',
        recordId: text(record.recordId),
        requirementSetId: text(record.requirementSetId),
        evaluatedAt: args.evaluatedAt ?? new Date().toISOString(),
        evaluatedBy: args.evaluatedBy ?? 'agent',
        decision,
        blockingReasons,
        traceStatusPolicy: policy ?? null,
        checkedTraceRows: rowCheck.rows,
        fullCloseoutMode: args.fullCloseout === true,
        recordPath: normalizePathForRecord(recordPath),
        sourcePath: sourcePath ? normalizePathForRecord(sourcePath) : null,
    };
}
function mainTraceStatusPolicyCheck(argv) {
    const args = parseArgs(argv);
    if (args.help) {
        console.log('Usage: main-agent-trace-status-policy-check --requirement-record <json> --source <contract.md> [--full-closeout] [--json]');
        return 0;
    }
    const report = buildReport(args);
    const reportPath = path.resolve(args.reportPath ??
        path.join(path.dirname(path.resolve(args.requirementRecord)), 'trace-status-policy-check.json'));
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    const output = {
        ok: true,
        reportPath: normalizePathForRecord(reportPath),
        decision: report.decision,
        blockingReasons: report.blockingReasons,
    };
    process.stdout.write(args.json ? `${JSON.stringify(output, null, 2)}\n` : `trace_status_policy=${report.decision}\n`);
    return report.decision === 'pass' ? 0 : 1;
}
if (require.main === module) {
    try {
        process.exitCode = mainTraceStatusPolicyCheck(process.argv.slice(2));
    }
    catch (error) {
        console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }, null, 2));
        process.exitCode = 2;
    }
}
