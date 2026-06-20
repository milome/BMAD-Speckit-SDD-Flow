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
exports.extractImplementationConfirmation = extractImplementationConfirmation;
exports.readImplementationConfirmation = readImplementationConfirmation;
exports.implementationConfirmationHash = implementationConfirmationHash;
exports.deriveTargetArtifactChecklist = deriveTargetArtifactChecklist;
exports.evaluateTargetArtifactRealization = evaluateTargetArtifactRealization;
exports.evaluateRequiredCommandFileExistence = evaluateRequiredCommandFileExistence;
exports.evaluateCanonicalSchemaReducerGate = evaluateCanonicalSchemaReducerGate;
exports.evaluateCanonicalEventRegistryGate = evaluateCanonicalEventRegistryGate;
exports.evaluateReverseAuditReadinessGate = evaluateReverseAuditReadinessGate;
exports.evaluateCloseoutTargetControlFlowGate = evaluateCloseoutTargetControlFlowGate;
exports.evaluateExternalBoundaryGate = evaluateExternalBoundaryGate;
exports.mainTargetArtifactRealizationGate = mainTargetArtifactRealizationGate;
/* eslint-disable no-console */
const crypto = __importStar(require("node:crypto"));
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const node_child_process_1 = require("node:child_process");
const js_yaml_1 = __importDefault(require("js-yaml"));
const requirement_record_control_store_1 = require("./requirement-record-control-store");
function isDirectTargetArtifactRealizationGateCli(entry) {
    return /(^|[\\/])target-artifact-realization-gate(\.[cm]?js|\.ts)?$/iu.test(entry ?? '');
}
const SHA256_RE = /^sha256:[a-f0-9]{64}$/u;
const RECORD_PREFIX = 'RequirementRecord.';
const LEGACY_POLICIES = new Set(['legacy_only', 'not_completion_proof']);
const REQUIRED_PROOF_POLICIES = new Set(['required_current_proof']);
const RECORD_FIELD_ROOTS = new Set([
    'artifactIndex',
    'closeout',
    'contractChecks',
    'deliveryEvidence',
    'executionIterations',
    'extensionRefs',
    'failureRecords',
    'gateChecks',
    'requirementClosures',
    'rerunLoops',
]);
const POST_CLOSEOUT_SURFACES = new Set([
    'postCloseoutConfirmationReview',
    '_bmad-output/runtime/requirement-records/<recordId>/confirmation/closeout-review-<closeoutAttemptId>.html',
    '_bmad-output/runtime/requirement-records/<recordId>/confirmation/closeout-review-<closeoutAttemptId>.render-report.json',
]);
const SUCCESS_PATH_OPTIONAL_SURFACES = new Set([
    '_bmad-output/runtime/requirement-records/<recordId>/evidence/<runId>/implementation-evidence-packet.failed.json',
    '_bmad-output/runtime/requirement-records/<recordId>/evidence/<runId>/ai-tdd-closeout-report.json',
]);
const GENERIC_SEMANTIC_MATCH_ROLES = new Set([
    'control',
    'evidence',
    'implementation',
    'legacy_compatibility',
    'post_closeout_review_evidence',
    'post_closeout_review_projection',
    'projection',
]);
const CONFIRMATION_BOOKKEEPING_FIELDS = new Set([
    'status',
    'confirmedAt',
    'confirmedBy',
    'sourceDocumentHash',
    'implementationConfirmationHash',
    'reconfirmationRequest',
    'confirmationRender',
]);
function resolveSkillDir(skillName) {
    const root = process.cwd();
    const home = process.env.USERPROFILE || process.env.HOME || '';
    const packageRoot = path.resolve(__dirname, '..');
    const candidates = [
        path.join(root, '.codex', 'skills', skillName),
        path.join(root, '.cursor', 'skills', skillName),
        path.join(root, '.claude', 'skills', skillName),
        path.join(root, '_bmad', 'skills', skillName),
        path.join(root, '.agents', 'skills', skillName),
        path.join(packageRoot, '.codex', 'skills', skillName),
        path.join(packageRoot, '.cursor', 'skills', skillName),
        path.join(packageRoot, '.claude', 'skills', skillName),
        path.join(packageRoot, '_bmad', 'skills', skillName),
        ...(home
            ? [
                path.join(home, '.codex', 'skills', skillName),
                path.join(home, '.cursor', 'skills', skillName),
                path.join(home, '.claude', 'skills', skillName),
                path.join(home, '.agents', 'skills', skillName),
            ]
            : []),
    ];
    return (candidates.find((candidate) => fs.existsSync(path.join(candidate, 'SKILL.md'))) ?? candidates[0]);
}
function resolveSkillPlaceholders(value) {
    return value
        .split('<skill-dir>')
        .join(normalizePath(resolveSkillDir('requirements-contract-authoring')))
        .split('<encoding-integrity-guardian-dir>')
        .join(normalizePath(resolveSkillDir('encoding-integrity-guardian')));
}
function resolveLogicalSkillRef(value) {
    const match = /^skill:\/\/([^/]+)\/(.+)$/u.exec(value);
    if (!match)
        return value;
    return path.join(resolveSkillDir(match[1]), match[2]);
}
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
function objects(value) {
    return Array.isArray(value)
        ? value.filter((item) => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
        : [];
}
function strings(value) {
    return Array.isArray(value) ? value.map(text).filter(Boolean) : [];
}
function nested(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}
function issue(code, message, refs = []) {
    return { code, message, refs };
}
function normalizePath(value) {
    return value.replace(/\\/gu, '/');
}
function repoPath(value) {
    return normalizePath(path.isAbsolute(value) ? value : path.resolve(value));
}
function sha256Bytes(value) {
    return `sha256:${crypto.createHash('sha256').update(value).digest('hex')}`;
}
function sha256File(file) {
    return sha256Bytes(fs.readFileSync(file));
}
function sha256Directory(directory) {
    const entries = [];
    const walk = (current) => {
        for (const entry of fs
            .readdirSync(current, { withFileTypes: true })
            .sort((left, right) => left.name.localeCompare(right.name))) {
            const absolute = path.join(current, entry.name);
            const relative = normalizePath(path.relative(directory, absolute));
            if (entry.isDirectory()) {
                walk(absolute);
            }
            else if (entry.isFile()) {
                entries.push(`${relative}:${sha256File(absolute)}`);
            }
        }
    };
    walk(directory);
    return sha256Bytes(entries.join('\n'));
}
function sha256ExistingPath(absolutePath) {
    const stat = fs.statSync(absolutePath);
    if (stat.isDirectory())
        return sha256Directory(absolutePath);
    return sha256File(absolutePath);
}
function stableStringify(value) {
    if (Array.isArray(value))
        return `[${value.map(stableStringify).join(',')}]`;
    if (!value || typeof value !== 'object')
        return JSON.stringify(value);
    const entries = Object.entries(value)
        .filter(([, item]) => item !== undefined)
        .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(',')}}`;
}
function readJson(file) {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
        throw new Error(`JSON object expected: ${file}`);
    return parsed;
}
function readJsonl(file) {
    if (!fs.existsSync(file))
        return [];
    const content = fs.readFileSync(file, 'utf8').trim();
    return content ? content.split(/\r?\n/u).map((line) => JSON.parse(line)) : [];
}
function asObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? value
        : undefined;
}
function extractImplementationConfirmation(sourceText) {
    const fenced = [...sourceText.matchAll(/```yaml\s*\n([\s\S]*?)```/giu)];
    for (const match of fenced) {
        const parsed = asObject(js_yaml_1.default.load(match[1]));
        const confirmation = asObject(parsed?.implementationConfirmation);
        if (confirmation)
            return { confirmation, blockText: match[1] };
    }
    const lines = sourceText.replace(/\r\n/gu, '\n').split('\n');
    const start = lines.findIndex((line) => /^implementationConfirmation:\s*$/u.test(line));
    if (start < 0)
        throw new Error('missing implementationConfirmation block');
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
    const blockText = lines.slice(start, end).join('\n');
    const parsed = asObject(js_yaml_1.default.load(blockText));
    const confirmation = asObject(parsed?.implementationConfirmation);
    if (!confirmation)
        throw new Error('implementationConfirmation block is not valid YAML');
    return { confirmation, blockText };
}
function readImplementationConfirmation(sourcePath) {
    const absolute = path.resolve(sourcePath);
    const sourceText = fs.readFileSync(absolute, 'utf8');
    const extracted = extractImplementationConfirmation(sourceText);
    return { ...extracted, sourceText, sourcePath: absolute };
}
function implementationConfirmationHash(confirmation) {
    return sha256Bytes(stableStringify(semanticConfirmationForHash(confirmation)));
}
function semanticConfirmationForHash(confirmation) {
    const semantic = {};
    for (const [key, value] of Object.entries(confirmation)) {
        if (!CONFIRMATION_BOOKKEEPING_FIELDS.has(key))
            semantic[key] = value;
    }
    return semantic;
}
function fieldValue(root, fieldPath) {
    const parts = fieldPath.split('.').filter(Boolean);
    let current = root;
    for (const part of parts) {
        if (!current || typeof current !== 'object' || Array.isArray(current))
            return undefined;
        current = current[part];
    }
    return current;
}
function hasValue(value) {
    if (Array.isArray(value))
        return value.length > 0;
    if (value && typeof value === 'object')
        return Object.keys(value).length > 0;
    return text(value).length > 0 || typeof value === 'boolean' || typeof value === 'number';
}
function sentinelForRecordField(field) {
    const now = '2026-01-01T00:00:00.000Z';
    if (field === 'closeout') {
        return {
            currentAttemptId: 'sentinel-closeout-attempt',
            attempts: [
                { closeoutAttemptId: 'sentinel-closeout-attempt', decision: 'blocked', checkedAt: now },
            ],
        };
    }
    if (field === 'deliveryEvidence') {
        return {
            requiredCommands: [
                {
                    commandId: 'CMD-SENTINEL',
                    command: 'node --version',
                    blockingIfMissing: true,
                    negativeOrRegression: true,
                    closeoutAttemptId: 'sentinel-closeout-attempt',
                    lastRunRef: {
                        commandId: 'CMD-SENTINEL',
                        runId: 'run-sentinel',
                        closeoutAttemptId: 'sentinel-closeout-attempt',
                    },
                    traceRows: ['TRACE-SENTINEL'],
                    evidenceRefs: ['EVD-SENTINEL'],
                    artifactRefs: [
                        {
                            artifactType: 'command_output',
                            sourceOfTruthRole: 'evidence',
                            path: '_bmad-output/runtime/requirement-records/REQ-SENTINEL/evidence/run-sentinel/output.txt',
                            contentHash: 'sha256:0000000000000000000000000000000000000000000000000000000000000000',
                            producer: 'canonical-reducer-sentinel',
                            purpose: 'schema reducer replay sentinel',
                            relatedRequirementIds: ['TRACE-SENTINEL', 'EVD-SENTINEL'],
                            status: 'active',
                            inputVersion: 'sentinel',
                            outputVersion: 'sentinel',
                        },
                    ],
                },
            ],
        };
    }
    if (field === 'currentMentalModel')
        return 'execution_closure';
    if (field === 'sixModelResults') {
        return {
            execution_closure: {
                status: 'pass',
                resultRecordedAt: now,
                resultRecordedBy: 'canonical-reducer-sentinel',
            },
        };
    }
    if (field === 'requirementClosures') {
        return [
            { requirementId: 'TRACE-SENTINEL', status: 'pass', closureSource: 'schema_reducer_sentinel' },
        ];
    }
    return [{ sentinel: field }];
}
function isPathLike(value) {
    return /[\\/]/u.test(value) || /\.[a-z0-9]{1,8}$/iu.test(value);
}
function filePathPrefix(value) {
    const normalized = normalizePath(value);
    const match = /^(.+\.[a-z0-9]{1,8})(?:\s+.+)?$/iu.exec(normalized);
    return match ? match[1] : normalized;
}
function recordFieldPath(value) {
    return value.replace(/\[\]/gu, '').replace(/^\./u, '').trim();
}
function isRequirementRecordFieldRef(value) {
    const fieldPath = value.startsWith(RECORD_PREFIX) ? value.slice(RECORD_PREFIX.length) : value;
    const root = recordFieldPath(fieldPath).split('.')[0];
    return RECORD_FIELD_ROOTS.has(root);
}
function targetKindForPathOrField(value) {
    if (value.startsWith(RECORD_PREFIX) || isRequirementRecordFieldRef(value))
        return 'record_field';
    if (value.endsWith('control-events.jsonl'))
        return 'event_journal';
    if (value.startsWith('ContractExecutionManifest.') ||
        value === 'postCloseoutConfirmationReview' ||
        (/\s/u.test(value) && !isPathLike(value))) {
        return 'logical_surface';
    }
    return 'file_artifact';
}
function normalizedExpectedSourceOfTruthRole(role) {
    const aliases = {
        acceptance_evidence: 'evidence',
        closeout_remediation_coordinator: 'evidence',
        compatibility_launcher: 'evidence',
        controlled_ingest_input: 'evidence',
        controlled_ingest_validator: 'evidence',
        current_attempt_command_evidence: 'evidence',
        delegation_adapter: 'evidence',
        final_closeout_decision: 'evidence',
        implementation: 'evidence',
        legacy_compatibility: 'evidence',
        post_closeout_review_evidence: 'evidence',
        post_closeout_review_projection: 'projection',
    };
    return aliases[role] ?? role;
}
function replaceKnownPlaceholders(value, record, attemptId) {
    const activeRunId = text(record.runId) ||
        text(objects(record.executionIterations)
            .filter((iteration) => text(iteration.closeoutAttemptId) === attemptId)
            .at(-1)?.runId) ||
        text(objects(record.executionIterations)
            .filter((iteration) => objects(iteration.commandRunRefs).some((run) => text(run.closeoutAttemptId) === attemptId))
            .at(-1)?.runId);
    return value
        .replace(/<requirement-set-id>/gu, text(record.requirementSetId) || text(record.recordId))
        .replace(/<requirementSetId>/gu, text(record.requirementSetId) || text(record.recordId))
        .replace(/<record-id>/gu, text(record.recordId))
        .replace(/<recordId>/gu, text(record.recordId))
        .replace(/<closeout-attempt-id>/gu, attemptId)
        .replace(/<closeoutAttemptId>/gu, attemptId)
        .replace(/<attempt-id>/gu, attemptId)
        .replace(/<attemptId>/gu, attemptId)
        .replace(/<runId>/gu, activeRunId || '<runId>')
        .replace(/<run-id>/gu, activeRunId || '<run-id>');
}
function templateToRegExp(value, record, attemptId) {
    const replaced = replaceKnownPlaceholders(normalizePath(value), record, attemptId);
    let escaped = replaced.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&').replace(/<[^>]+>/gu, '[^/]+');
    escaped = escaped.replace(/\/evidence\/((?:[^/]+|\[\^\/\]\+))\//gu, '/evidence/(?:[^/]+/)?$1/');
    return new RegExp(`(^|/)${escaped}$`, 'u');
}
function resolveDeclaredPath(value, record, attemptId) {
    const pathValue = filePathPrefix(value);
    const replaced = replaceKnownPlaceholders(pathValue, record, attemptId);
    const pattern = /<[^>]+>/u.test(pathValue)
        ? templateToRegExp(pathValue, record, attemptId)
        : undefined;
    if (/<[^>]+>/u.test(replaced)) {
        return {
            displayPath: normalizePath(replaced),
            pattern,
        };
    }
    return {
        displayPath: normalizePath(replaced),
        absolutePath: path.isAbsolute(replaced) ? replaced : path.resolve(replaced),
        pattern,
    };
}
function collectLinkedIds(row) {
    const raw = [
        ...strings(row.traceRows),
        ...strings(row.traceRefs),
        ...strings(row.evidenceRefs),
        ...strings(row.linkedRequirementIds),
        ...strings(row.linkedRequirements),
        ...strings(row.linkedEvidenceIds),
        ...strings(row.relatedRequirementIds),
        text(row.derivedFromMustRef),
        ...strings(row.linkedIds),
    ];
    return {
        traceRefs: [...new Set(raw.filter((id) => /^TRACE-/u.test(id)))],
        evidenceRefs: [...new Set(raw.filter((id) => /^EVD-/u.test(id)))],
        requirementRefs: [...new Set(raw.filter((id) => /^(?:MUST|NEG|OUT)-/u.test(id)))],
    };
}
function pushTarget(targets, item) {
    item.aliases = [...new Set([item.id, item.pathOrField, ...(item.aliases ?? [])].filter(Boolean))];
    const key = `${item.kind}:${item.pathOrField}:${item.completionProofPolicy ?? ''}`;
    const existing = targets.find((target) => `${target.kind}:${target.pathOrField}:${target.completionProofPolicy ?? ''}` === key);
    if (!existing) {
        targets.push(item);
        return;
    }
    existing.aliases = [
        ...new Set([...(existing.aliases ?? []), ...(item.aliases ?? [])].filter(Boolean)),
    ];
    existing.id = existing.id || item.id;
    existing.traceRefs = [...new Set([...existing.traceRefs, ...item.traceRefs])];
    existing.evidenceRefs = [...new Set([...existing.evidenceRefs, ...item.evidenceRefs])];
    existing.requirementRefs = [
        ...new Set([...(existing.requirementRefs ?? []), ...(item.requirementRefs ?? [])]),
    ];
    existing.contractBound = existing.contractBound === true || item.contractBound === true;
    existing.expectedProducer = existing.expectedProducer || item.expectedProducer;
    existing.expectedSourceOfTruthRole =
        existing.expectedSourceOfTruthRole || item.expectedSourceOfTruthRole;
}
function contractBound(row, sourceSection) {
    return (sourceSection.startsWith('currentTargetMap.') ||
        Boolean(text(row.projectionStatus)) ||
        Boolean(text(row.derivedFromMustRef)) ||
        strings(row.linkedRequirements).length > 0 ||
        strings(row.linkedRequirementIds).length > 0 ||
        strings(row.relatedRequirementIds).length > 0);
}
function requirementLinkResolver(confirmation) {
    const traceRefsByRequirement = new Map();
    const evidenceRefsByRequirement = new Map();
    const traceRefsByEvidence = new Map();
    const add = (map, key, values) => {
        if (!key || values.length === 0)
            return;
        map.set(key, [...new Set([...(map.get(key) ?? []), ...values])]);
    };
    for (const row of [
        ...objects(confirmation.must),
        ...objects(confirmation.notDone),
        ...objects(confirmation.mustNot),
    ]) {
        const id = text(row.id);
        add(traceRefsByRequirement, id, [
            ...strings(row.coveredByTraceRows),
            ...strings(row.traceRows),
            ...strings(row.traceRefs),
        ]);
        add(evidenceRefsByRequirement, id, [
            ...strings(row.evidenceRefs),
            ...strings(row.linkedEvidenceIds),
        ]);
    }
    for (const trace of objects(confirmation.traceRows)) {
        const traceId = text(trace.id);
        if (!traceId)
            continue;
        for (const requirementId of strings(trace.covers)) {
            add(traceRefsByRequirement, requirementId, [traceId]);
            add(evidenceRefsByRequirement, requirementId, strings(trace.evidenceRefs));
        }
        for (const evidenceId of strings(trace.evidenceRefs)) {
            add(traceRefsByEvidence, evidenceId, [traceId]);
        }
    }
    for (const command of objects(confirmation.requiredCommands)) {
        const commandTraceRefs = strings(command.traceRows).concat(strings(command.traceRefs));
        for (const evidenceId of strings(command.evidenceRefs)) {
            add(traceRefsByEvidence, evidenceId, commandTraceRefs);
        }
    }
    for (const evidence of objects(confirmation.evidence)) {
        const evidenceId = text(evidence.id);
        const requirementRefs = [
            ...strings(evidence.linkedRequirementIds),
            ...strings(evidence.linkedRequirements),
            text(evidence.derivedFromMustRef),
        ].filter((id) => /^(?:MUST|NEG|OUT)-/u.test(id));
        add(traceRefsByEvidence, evidenceId, requirementRefs.flatMap((id) => traceRefsByRequirement.get(id) ?? []));
    }
    return (links) => {
        const derivedTraceRefs = links.requirementRefs.flatMap((id) => traceRefsByRequirement.get(id) ?? []);
        const evidenceTraceRefs = links.evidenceRefs.flatMap((id) => traceRefsByEvidence.get(id) ?? []);
        const derivedEvidenceRefs = links.requirementRefs.flatMap((id) => evidenceRefsByRequirement.get(id) ?? []);
        return {
            traceRefs: [...new Set([...links.traceRefs, ...derivedTraceRefs, ...evidenceTraceRefs])],
            evidenceRefs: [...new Set([...links.evidenceRefs, ...derivedEvidenceRefs])],
            requirementRefs: links.requirementRefs,
        };
    };
}
function artifactPlanRowDefinesTargetSurface(row) {
    const role = text(row.sourceOfTruthRole);
    const artifactType = text(row.artifactType);
    return (role === 'implementation' ||
        role === 'control' ||
        role === 'projection' ||
        role === 'generator_self_audit' ||
        role === 'self_audit_receipt' ||
        role === 'compatibility_launcher' ||
        role === 'acceptance_oracle' ||
        role === 'evidence' ||
        role === 'current_attempt_command_evidence' ||
        role === 'failure_evidence_not_completion_proof' ||
        role === 'controlled_ingest_input' ||
        role === 'post_closeout_review_evidence' ||
        role === 'manifest_gate_oracle' ||
        role === 'contract_manifest_standard' ||
        role === 'execution_authority' ||
        role === 'historical_requirement_context' ||
        role === 'host_surface_projection' ||
        row.canAffectControlFlow === true ||
        /^(?:code|script|hook|test|config|schema|control_record|requirement_source|skill_surface|execution_packet|prompt_projection|generator_receipt|gate|report|test_report|quality_report|render_report|evidence_bundle|failed_evidence_packet|implementation_evidence_packet|html_projection)$/iu.test(artifactType));
}
function deriveTargetArtifactChecklist(confirmation) {
    const targets = [];
    const resolveLinks = requirementLinkResolver(confirmation);
    for (const row of objects(confirmation.artifactAutomationPlan)) {
        if (!artifactPlanRowDefinesTargetSurface(row))
            continue;
        const sourceSection = 'artifactAutomationPlan';
        const id = text(row.id) || text(row.artifactId) || `artifactAutomationPlan:${targets.length + 1}`;
        const links = resolveLinks(collectLinkedIds(row));
        const rowPath = text(row.path);
        if (rowPath) {
            pushTarget(targets, {
                id,
                kind: targetKindForPathOrField(rowPath),
                sourceSection,
                pathOrField: rowPath,
                expectedProducer: text(row.producer),
                expectedSourceOfTruthRole: text(row.sourceOfTruthRole),
                traceRefs: links.traceRefs,
                evidenceRefs: links.evidenceRefs,
                requirementRefs: links.requirementRefs,
                contractBound: contractBound(row, sourceSection),
            });
        }
        if (text(row.artifactType) === 'control_record') {
            const outputSourceSection = 'artifactAutomationPlan.outputArtifacts';
            for (const output of strings(row.outputArtifacts)) {
                if (output && !isPathLike(output)) {
                    pushTarget(targets, {
                        id: `${id}:${output}`,
                        kind: 'record_field',
                        sourceSection: outputSourceSection,
                        pathOrField: output.startsWith(RECORD_PREFIX) ? output : `${RECORD_PREFIX}${output}`,
                        traceRefs: links.traceRefs,
                        evidenceRefs: links.evidenceRefs,
                        requirementRefs: links.requirementRefs,
                        contractBound: contractBound(row, outputSourceSection),
                    });
                }
            }
        }
    }
    const currentTargetMap = nested(confirmation.currentTargetMap);
    for (const row of objects(currentTargetMap.canonicalArtifacts)) {
        const sourceSection = 'currentTargetMap.canonicalArtifacts';
        const id = text(row.id) || text(row.targetPathOrField) || `canonicalArtifacts:${targets.length + 1}`;
        const pathOrField = text(row.targetPathOrField);
        if (!pathOrField)
            continue;
        const links = resolveLinks(collectLinkedIds(row));
        pushTarget(targets, {
            id,
            kind: targetKindForPathOrField(pathOrField),
            sourceSection,
            pathOrField,
            traceRefs: links.traceRefs,
            evidenceRefs: links.evidenceRefs,
            requirementRefs: links.requirementRefs,
            contractBound: contractBound(row, sourceSection),
        });
    }
    for (const row of [
        ...objects(currentTargetMap.pathRegistry),
        ...objects(currentTargetMap.artifactPaths),
    ]) {
        const declaredPath = text(row.fixedPath) || text(row.path);
        if (!declaredPath)
            continue;
        const sourceSection = text(row.fixedPath)
            ? 'currentTargetMap.pathRegistry'
            : 'currentTargetMap.artifactPaths';
        const links = resolveLinks(collectLinkedIds(row));
        pushTarget(targets, {
            id: text(row.id) || text(row.category) || declaredPath,
            kind: targetKindForPathOrField(declaredPath),
            sourceSection,
            pathOrField: declaredPath,
            expectedSourceOfTruthRole: text(row.sourceOfTruthRole) || text(row.targetRole),
            traceRefs: links.traceRefs,
            evidenceRefs: links.evidenceRefs,
            requirementRefs: links.requirementRefs,
            contractBound: contractBound(row, sourceSection),
        });
    }
    for (const row of objects(currentTargetMap.existingArtifacts)) {
        const sourceSection = 'currentTargetMap.existingArtifacts';
        const currentPath = text(row.currentPath);
        if (!currentPath)
            continue;
        const policy = text(row.completionProofPolicy);
        const links = resolveLinks(collectLinkedIds(row));
        if (LEGACY_POLICIES.has(policy)) {
            pushTarget(targets, {
                id: text(row.id) || currentPath,
                kind: 'legacy_policy',
                sourceSection,
                pathOrField: currentPath,
                completionProofPolicy: policy,
                traceRefs: links.traceRefs,
                evidenceRefs: links.evidenceRefs,
                requirementRefs: links.requirementRefs,
                contractBound: contractBound(row, sourceSection),
            });
        }
        else if (REQUIRED_PROOF_POLICIES.has(policy) && isPathLike(currentPath)) {
            pushTarget(targets, {
                id: text(row.id) || currentPath,
                kind: 'file_artifact',
                sourceSection,
                pathOrField: currentPath,
                completionProofPolicy: policy,
                traceRefs: links.traceRefs,
                evidenceRefs: links.evidenceRefs,
                requirementRefs: links.requirementRefs,
                contractBound: contractBound(row, sourceSection),
            });
        }
    }
    return targets;
}
function eventLogPath(recordPath, record) {
    const fromStore = text(nested(record.controlStore).eventLogPath);
    if (!fromStore)
        return path.join(path.dirname(recordPath), 'events', 'control-events.jsonl');
    return path.isAbsolute(fromStore) ? fromStore : path.resolve(fromStore);
}
function commandRunsForAttempt(record, attemptId) {
    return objects(record.executionIterations).flatMap((iteration) => objects(iteration.commandRunRefs)
        .filter((run) => text(run.closeoutAttemptId) === attemptId)
        .map((run) => ({ ...run, executionIterationId: text(iteration.executionIterationId) })));
}
function artifactPathMatches(item, declared) {
    const artifactPath = normalizePath(text(item.path));
    if (!artifactPath)
        return false;
    if (declared.pattern?.test(artifactPath))
        return true;
    const wanted = normalizePath(declared.absolutePath ?? declared.displayPath);
    return (artifactPath === wanted ||
        repoPath(artifactPath) === repoPath(wanted) ||
        normalizePath(path.resolve(artifactPath)) === repoPath(wanted));
}
function artifactAliasMatches(item, target) {
    const searchable = [
        text(item.artifactId),
        text(item.id),
        text(item.pathOrField),
        text(item.logicalSurface),
        ...strings(item.aliases),
        ...strings(item.relatedRequirementIds),
    ];
    return [target.id, target.pathOrField, ...(target.aliases ?? [])]
        .filter(Boolean)
        .some((alias) => searchable.includes(alias));
}
function artifactLinkedIds(entry) {
    return [
        ...strings(entry.relatedRequirementIds),
        ...strings(entry.traceRows),
        ...strings(entry.evidenceRefs),
        ...strings(entry.linkedEvidenceIds),
        ...strings(entry.linkedRequirementIds),
    ];
}
function artifactSemanticMatches(item, target) {
    const expectedRole = target.expectedSourceOfTruthRole;
    if (!expectedRole || GENERIC_SEMANTIC_MATCH_ROLES.has(expectedRole))
        return false;
    if (text(item.sourceOfTruthRole) !== expectedRole)
        return false;
    const linked = artifactLinkedIds(item);
    const targetLinks = [
        ...target.traceRefs,
        ...target.evidenceRefs,
        ...(target.requirementRefs ?? []),
    ].filter(Boolean);
    if (targetLinks.length > 0)
        return targetLinks.some((id) => linked.includes(id));
    return Boolean(target.id && text(item.purpose).includes(target.id));
}
function artifactIndexEntry(record, declared, target, attemptId, events) {
    const artifactIndex = objects(record.artifactIndex);
    const directMatches = artifactIndex.filter((item) => artifactPathMatches(item, declared) || (target ? artifactAliasMatches(item, target) : false));
    const matches = directMatches.length > 0 || !target
        ? directMatches
        : artifactIndex.filter((item) => artifactSemanticMatches(item, target));
    const boundMatches = matches.filter((item) => artifactBoundToAttempt(record, item, attemptId, events));
    return boundMatches.at(-1) ?? matches.at(-1);
}
function artifactIdentityMatches(entryPath, entryHash, refPath, refHash) {
    if (entryHash && refHash)
        return entryHash === refHash;
    return (Boolean(entryPath && refPath && entryPath === refPath) ||
        Boolean(entryHash && refHash && entryHash === refHash));
}
function artifactBoundToAttempt(record, entry, attemptId, events) {
    if (!entry)
        return false;
    const artifactPath = normalizePath(text(entry.path));
    const artifactHash = text(entry.contentHash ?? entry.hash);
    if (text(entry.closeoutAttemptId) === attemptId ||
        text(nested(entry.lastRunRef).closeoutAttemptId) === attemptId ||
        text(entry.inputVersion) === attemptId ||
        text(entry.outputVersion) === attemptId)
        return true;
    const commandRefs = commandRunsForAttempt(record, attemptId);
    if (commandRefs.some((run) => artifactIdentityMatches(artifactPath, artifactHash, normalizePath(text(run.artifactPath)), text(run.artifactHash))))
        return true;
    for (const command of objects(nested(record.deliveryEvidence).requiredCommands)) {
        const selected = text(command.closeoutAttemptId) === attemptId ||
            text(nested(command.lastRunRef).closeoutAttemptId) === attemptId ||
            objects(command.commandRunRefs).some((run) => text(run.closeoutAttemptId) === attemptId);
        if (!selected)
            continue;
        const refs = [...objects(command.artifactRefs), ...objects(command.extensionRefs)];
        if (refs.some((ref) => artifactIdentityMatches(artifactPath, artifactHash, normalizePath(text(ref.path)), text(ref.contentHash ?? ref.hash))))
            return true;
    }
    return events.some((event) => {
        const packet = nested(nested(event.payload).packet);
        const eventAttempt = text(packet.closeoutAttemptId) || text(nested(event.payload).attemptId);
        if (eventAttempt !== attemptId)
            return false;
        const refs = [
            ...objects(packet.artifactRefs),
            ...objects(packet.extensionRefs),
            ...objects(nested(event.payload).artifactRefs),
        ];
        return refs.some((ref) => artifactIdentityMatches(artifactPath, artifactHash, normalizePath(text(ref.path)), text(ref.contentHash ?? ref.hash)));
    });
}
function artifactLinksPresent(entry, target) {
    if (!entry)
        return [];
    const linked = artifactLinkedIds(entry);
    const issues = [];
    if (target.traceRefs.length > 0 && !target.traceRefs.some((id) => linked.includes(id)))
        issues.push('target_artifact_trace_binding_missing');
    if (target.evidenceRefs.length > 0 && !target.evidenceRefs.some((id) => linked.includes(id)))
        issues.push('target_artifact_evidence_binding_missing');
    return issues;
}
function postCloseoutReviewReportIssues(input) {
    const issues = [];
    const filePath = input.concreteFile;
    if (!filePath || !fs.existsSync(filePath))
        return issues;
    if (!input.target.pathOrField.endsWith('.render-report.json'))
        return issues;
    let report = {};
    try {
        report = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
    catch {
        return [
            issue('post_closeout_review_report_invalid', `${input.target.pathOrField} is not parseable JSON`, [input.target.id]),
        ];
    }
    const finalAcceptance = nested(report.finalAcceptanceReview);
    const reportAttemptId = text(finalAcceptance.currentAttemptId) || text(finalAcceptance.closeoutAttemptId);
    if (text(report.mode) !== 'closeout-review') {
        issues.push(issue('post_closeout_review_report_mode_mismatch', `${input.target.pathOrField} is not closeout-review mode`, [input.target.id]));
    }
    if (finalAcceptance.ready !== true) {
        issues.push(issue('post_closeout_review_not_ready', `${input.target.pathOrField} finalAcceptanceReview.ready is not true`, [input.target.id]));
    }
    if (reportAttemptId !== input.attemptId) {
        issues.push(issue('post_closeout_review_attempt_mismatch', `${input.target.pathOrField} attempt ${reportAttemptId || '<missing>'} does not match ${input.attemptId}`, [input.target.id]));
    }
    if (finalAcceptance.recordClosed !== true) {
        issues.push(issue('post_closeout_review_record_closed_missing', `${input.target.pathOrField} does not prove record_closed`, [input.target.id]));
    }
    const expectedSourceHash = text(input.record.sourceDocumentHash);
    const expectedImplementationHash = text(input.record.implementationConfirmationHash);
    if (expectedSourceHash && text(report.sourceDocumentHash) !== expectedSourceHash) {
        issues.push(issue('post_closeout_review_source_hash_mismatch', `${input.target.pathOrField} source hash is stale`, [input.target.id]));
    }
    if (expectedImplementationHash &&
        text(report.implementationConfirmationHash) !== expectedImplementationHash) {
        issues.push(issue('post_closeout_review_implementation_hash_mismatch', `${input.target.pathOrField} implementation confirmation hash is stale`, [input.target.id]));
    }
    return issues;
}
function validateFileTarget(input) {
    const issues = [];
    const events = input.events;
    if (POST_CLOSEOUT_SURFACES.has(input.target.pathOrField) &&
        !currentAttemptClosed(input.record, input.attemptId, events)) {
        return [];
    }
    if (SUCCESS_PATH_OPTIONAL_SURFACES.has(input.target.pathOrField)) {
        return [];
    }
    const declared = resolveDeclaredPath(input.target.pathOrField, input.record, input.attemptId);
    const concreteFile = declared.absolutePath;
    const exists = concreteFile ? fs.existsSync(concreteFile) : false;
    if (POST_CLOSEOUT_SURFACES.has(input.target.pathOrField)) {
        if (!exists) {
            issues.push(issue('target_artifact_missing', `${input.target.pathOrField} does not exist`, [
                input.target.id,
            ]));
        }
        issues.push(...postCloseoutReviewReportIssues({
            target: input.target,
            record: input.record,
            declared,
            concreteFile,
            attemptId: input.attemptId,
        }));
        return issues;
    }
    const entry = artifactIndexEntry(input.record, declared, input.target, input.attemptId, input.events);
    if (!exists && !entry) {
        issues.push(issue('target_artifact_missing', `${input.target.pathOrField} does not exist and has no artifactIndex match`, [input.target.id]));
    }
    if (!entry) {
        issues.push(issue('target_artifact_index_missing', `${input.target.pathOrField} missing from artifactIndex`, [input.target.id]));
        return issues;
    }
    const hash = text(entry.contentHash ?? entry.hash);
    if (!hash)
        issues.push(issue('target_artifact_hash_missing', `${input.target.pathOrField} artifactIndex hash missing`, [input.target.id]));
    else if (!SHA256_RE.test(hash))
        issues.push(issue('target_artifact_hash_invalid', `${input.target.pathOrField} artifactIndex hash is not sha256`, [input.target.id]));
    else if (concreteFile && exists && sha256ExistingPath(concreteFile) !== hash) {
        issues.push(issue('target_artifact_hash_mismatch', `${input.target.pathOrField} hash does not match file content`, [input.target.id]));
    }
    if (!text(entry.producer))
        issues.push(issue('target_artifact_producer_missing', `${input.target.pathOrField} artifactIndex producer missing`, [input.target.id]));
    if (!text(entry.sourceOfTruthRole)) {
        issues.push(issue('target_artifact_source_of_truth_role_missing', `${input.target.pathOrField} artifactIndex sourceOfTruthRole missing`, [input.target.id]));
    }
    else if (input.target.expectedSourceOfTruthRole &&
        normalizedExpectedSourceOfTruthRole(text(entry.sourceOfTruthRole)) !==
            normalizedExpectedSourceOfTruthRole(input.target.expectedSourceOfTruthRole)) {
        issues.push(issue('target_artifact_source_of_truth_role_mismatch', `${input.target.pathOrField} sourceOfTruthRole ${text(entry.sourceOfTruthRole)} does not match ${input.target.expectedSourceOfTruthRole}`, [input.target.id]));
    }
    issues.push(...artifactLinksPresent(entry, input.target).map((code) => issue(code, `${input.target.pathOrField} missing declared TRACE/EVD binding`, [
        input.target.id,
    ])));
    if (!artifactBoundToAttempt(input.record, entry, input.attemptId, input.events)) {
        issues.push(issue('target_artifact_attempt_binding_missing', `${input.target.pathOrField} not bound to current attempt ${input.attemptId}`, [input.target.id]));
    }
    return issues;
}
function recordFieldBoundToAttempt(record, target, attemptId, events) {
    if (target.traceRefs.length === 0 && target.evidenceRefs.length === 0)
        return true;
    const expected = new Set([...target.traceRefs, ...target.evidenceRefs]);
    for (const iteration of objects(record.executionIterations)) {
        const runs = objects(iteration.commandRunRefs);
        if (!runs.some((run) => text(run.closeoutAttemptId) === attemptId))
            continue;
        const ids = [
            ...strings(iteration.traceRows),
            ...strings(iteration.evidenceRefs),
            ...strings(iteration.coveredRequirementIds),
        ];
        if (ids.some((id) => expected.has(id)))
            return true;
    }
    return events.some((event) => {
        const packet = nested(nested(event.payload).packet);
        const eventAttempt = text(packet.closeoutAttemptId) || text(nested(event.payload).attemptId);
        if (eventAttempt !== attemptId)
            return false;
        const ids = [
            ...strings(packet.traceRows),
            ...strings(packet.evidenceRefs),
            ...strings(packet.relatedRequirementIds),
            ...strings(nested(event.payload).traceRows),
            ...strings(nested(event.payload).evidenceRefs),
        ];
        return ids.some((id) => expected.has(id));
    });
}
function validateRecordFieldTarget(target, record, attemptId, events) {
    const fieldPath = recordFieldPath(target.pathOrField.startsWith(RECORD_PREFIX)
        ? target.pathOrField.slice(RECORD_PREFIX.length)
        : target.pathOrField);
    const issues = [];
    if (!hasValue(fieldValue(record, fieldPath))) {
        issues.push(issue('target_record_field_missing', `${target.pathOrField} missing or empty in requirement record`, [target.id]));
    }
    if (!recordFieldBoundToAttempt(record, target, attemptId, events)) {
        issues.push(issue('target_record_field_attempt_binding_missing', `${target.pathOrField} lacks current-attempt TRACE/EVD binding`, [target.id]));
    }
    return issues;
}
function currentAttemptClosed(record, attemptId, events) {
    if (text(record.lastEventType) === 'record_closed' &&
        text(nested(record.closeout).currentAttemptId) === attemptId) {
        return true;
    }
    return events.some((event) => {
        if (text(event.eventType) !== 'record_closed')
            return false;
        const payload = nested(event.payload);
        return (text(payload.closeoutAttemptId) === attemptId ||
            text(nested(payload.packet).closeoutAttemptId) === attemptId ||
            text(nested(payload.closeout).currentAttemptId) === attemptId);
    });
}
function validateLogicalSurfaceTarget(target, record, attemptId, events) {
    if (POST_CLOSEOUT_SURFACES.has(target.pathOrField) &&
        !currentAttemptClosed(record, attemptId, events)) {
        return [];
    }
    const fieldPath = target.pathOrField.startsWith(RECORD_PREFIX)
        ? target.pathOrField.slice(RECORD_PREFIX.length)
        : target.pathOrField;
    if (isRequirementRecordFieldRef(fieldPath)) {
        return validateRecordFieldTarget({
            ...target,
            kind: 'record_field',
            pathOrField: `${RECORD_PREFIX}${recordFieldPath(fieldPath)}`,
        }, record, attemptId, events);
    }
    const artifact = objects(record.artifactIndex).find((item) => artifactAliasMatches(item, target));
    if (artifact) {
        return artifactBoundToAttempt(record, artifact, attemptId, events)
            ? []
            : [
                issue('target_logical_surface_attempt_binding_missing', `${target.pathOrField} not bound to current attempt ${attemptId}`, [target.id]),
            ];
    }
    const hasAttemptEvidence = recordFieldBoundToAttempt(record, target, attemptId, events);
    return hasAttemptEvidence
        ? []
        : [
            issue('target_logical_surface_evidence_missing', `${target.pathOrField} lacks current-attempt evidence binding`, [target.id]),
        ];
}
function legacyUsedAsCompletionProof(record, token, events) {
    const lastEventType = text(record.lastEventType);
    const proofValues = [
        isCompletionProofEventType(lastEventType) ? lastEventType : '',
        ...events
            .filter((event) => ['record_closed', 'requirement_closure_recorded'].includes(text(event.eventType)))
            .map((event) => text(event.eventType)),
        ...objects(record.requirementClosures).flatMap((closure) => text(closure.status) === 'pass'
            ? [
                text(closure.proofPath),
                text(closure.proofRef),
                text(closure.completionProofPath),
                text(closure.completionProofRef),
                ...strings(closure.completionProofRefs),
                ...strings(closure.completionProofPaths),
            ]
            : []),
        ...objects(nested(record.deliveryEvidence).requiredCommands).flatMap((command) => [
            text(command.completionProofPath),
            text(command.completionProofRef),
            ...strings(command.completionProofRefs),
            ...strings(command.completionProofPaths),
        ]),
    ];
    const haystack = proofValues.filter(Boolean).join('\n');
    return haystack.includes(token);
}
function isCompletionProofEventType(eventType) {
    return /completion|closeout|closure|closed/u.test(eventType);
}
function validateLegacyPolicyTarget(target, record, events) {
    if (target.completionProofPolicy &&
        LEGACY_POLICIES.has(target.completionProofPolicy) &&
        legacyUsedAsCompletionProof(record, target.pathOrField, events)) {
        return [
            issue('legacy_artifact_used_as_completion_proof', `${target.pathOrField} is declared ${target.completionProofPolicy} but appears in completion proof surfaces`, [target.id]),
        ];
    }
    return [];
}
function evaluateTargetArtifactRealization(input) {
    const source = readImplementationConfirmation(input.sourcePath);
    const confirmation = source.confirmation;
    const eventPath = eventLogPath(input.recordPath, input.record);
    const events = readJsonl(eventPath);
    const targets = deriveTargetArtifactChecklist(confirmation);
    const issues = [];
    if (text(confirmation.status) !== 'user_confirmed') {
        issues.push(issue('source_implementation_confirmation_not_user_confirmed', `implementationConfirmation.status=${text(confirmation.status) || '<missing>'}`, ['implementationConfirmation.status']));
    }
    const expectedHash = text(input.record.implementationConfirmationHash);
    const actualHash = implementationConfirmationHash(confirmation);
    if (expectedHash && expectedHash !== actualHash) {
        issues.push(issue('implementation_confirmation_hash_mismatch', `record hash ${expectedHash} does not match source ${actualHash}`, ['implementationConfirmationHash']));
    }
    for (const target of targets) {
        if (target.kind === 'record_field')
            issues.push(...validateRecordFieldTarget(target, input.record, input.attemptId, events));
        else if (target.kind === 'legacy_policy')
            issues.push(...validateLegacyPolicyTarget(target, input.record, events));
        else if (target.kind === 'logical_surface')
            issues.push(...validateLogicalSurfaceTarget(target, input.record, input.attemptId, events));
        else
            issues.push(...validateFileTarget({
                target,
                record: input.record,
                recordPath: input.recordPath,
                attemptId: input.attemptId,
                events,
            }));
    }
    const blockingReasons = [...new Set(issues.map((item) => item.code))];
    return {
        reportType: 'target_artifact_realization_report',
        generatedAt: input.evaluatedAt ?? new Date().toISOString(),
        generatedBy: input.evaluatedBy ?? 'agent',
        sourcePath: normalizePath(source.sourcePath),
        currentAttemptId: input.attemptId,
        decision: blockingReasons.length === 0 ? 'pass' : 'blocked',
        blockingReasons,
        implementationConfirmationHash: actualHash,
        targetCount: targets.length,
        targets,
        issues,
    };
}
function extractCommandFileRefs(command) {
    const refs = new Set();
    const normalized = resolveSkillPlaceholders(command).replace(/\r?\n/gu, ' ');
    const tokens = normalized.match(/"[^"]+"|'[^']+'|\S+/gu) ?? [];
    for (const token of tokens) {
        const ref = token.replace(/^['"]|['"]$/gu, '');
        if (/(?:^|[\\/])[^\\/]+\.(?:tsx|ts|jsx|json|mjs|cjs|js|ya?ml|md)$/iu.test(ref) &&
            (/[\\/]/u.test(ref) || /\.(?:test|spec)\./iu.test(ref))) {
            refs.add(ref);
        }
    }
    return [...refs];
}
function commandFileExists(ref) {
    const resolved = resolveLogicalSkillRef(resolveSkillPlaceholders(ref));
    const absolute = path.isAbsolute(resolved) ? resolved : path.resolve(resolved);
    return { absolutePath: absolute, exists: fs.existsSync(absolute) };
}
function evaluateRequiredCommandFileExistence(input) {
    const { confirmation, sourcePath } = readImplementationConfirmation(input.sourcePath);
    const issues = [];
    const checkedFiles = [];
    for (const command of objects(confirmation.requiredCommands)) {
        const commandId = text(command.id) || text(command.commandId) || '<missing-command-id>';
        for (const ref of extractCommandFileRefs(text(command.command))) {
            const { absolutePath, exists } = commandFileExists(ref);
            checkedFiles.push({
                commandId,
                path: normalizePath(ref),
                absolutePath: normalizePath(absolutePath),
                exists,
            });
            if (!exists)
                issues.push(issue('required_command_file_missing', `${commandId} references missing file ${ref}`, [
                    commandId,
                    ref,
                ]));
        }
    }
    const blockingReasons = [...new Set(issues.map((item) => item.code))];
    return {
        reportType: 'required_command_file_existence_report',
        generatedAt: input.evaluatedAt ?? new Date().toISOString(),
        generatedBy: input.evaluatedBy ?? 'agent',
        sourcePath: normalizePath(sourcePath),
        decision: blockingReasons.length === 0 ? 'pass' : 'blocked',
        blockingReasons,
        checkedFiles,
        issues,
    };
}
function declaredRecordFields(confirmation) {
    const fields = new Set();
    for (const target of deriveTargetArtifactChecklist(confirmation)) {
        if (target.kind === 'record_field') {
            const fieldPath = target.pathOrField.startsWith(RECORD_PREFIX)
                ? target.pathOrField.slice(RECORD_PREFIX.length)
                : target.pathOrField;
            fields.add(recordFieldPath(fieldPath).split('.')[0]);
        }
    }
    for (const eventType of objects(confirmation.governanceEventTypeRegistry)) {
        for (const field of strings(eventType.writesControlFields))
            fields.add(field.split('.')[0]);
    }
    return [...fields].filter(Boolean).sort();
}
function evaluateCanonicalSchemaReducerGate(input) {
    const { confirmation, sourcePath } = readImplementationConfirmation(input.sourcePath);
    const fields = declaredRecordFields(confirmation);
    const schemaPath = path.resolve('_bmad/_schemas/requirement-record.schema.json');
    const reducerPath = path.resolve('scripts/requirement-record-control-store.ts');
    const schemaText = fs.existsSync(schemaPath) ? fs.readFileSync(schemaPath, 'utf8') : '';
    const reducerText = fs.existsSync(reducerPath) ? fs.readFileSync(reducerPath, 'utf8') : '';
    const issues = [];
    for (const field of fields) {
        if (!schemaText.includes(`"${field}"`))
            issues.push(issue('canonical_schema_field_missing', `${field} missing from requirement-record schema`, [
                field,
                normalizePath(schemaPath),
            ]));
        if (!reducerText.includes(`'${field}'`) && !reducerText.includes(`"${field}"`)) {
            issues.push(issue('canonical_reducer_field_missing', `${field} missing from control-store reducer allowlist`, [field, normalizePath(reducerPath)]));
        }
    }
    if (input.record && fields.length > 0) {
        const sentinel = Object.fromEntries(fields.map((field) => [field, sentinelForRecordField(field)]));
        const reduced = (0, requirement_record_control_store_1.canonicalizeRequirementRecord)({
            ...input.record,
            recordId: text(input.record.recordId) || 'REQ-FIXTURE',
            ...sentinel,
        });
        for (const field of fields) {
            if (!hasValue(reduced[field]))
                issues.push(issue('canonical_reducer_replay_field_dropped', `${field} was dropped by canonical reducer replay`, [field]));
        }
    }
    const blockingReasons = [...new Set(issues.map((item) => item.code))];
    return {
        reportType: 'canonical_schema_reducer_report',
        generatedAt: input.evaluatedAt ?? new Date().toISOString(),
        generatedBy: input.evaluatedBy ?? 'agent',
        sourcePath: normalizePath(sourcePath),
        decision: blockingReasons.length === 0 ? 'pass' : 'blocked',
        blockingReasons,
        declaredRecordFields: fields,
        issues,
    };
}
function evaluateCanonicalEventRegistryGate(input) {
    const { confirmation, sourcePath } = readImplementationConfirmation(input.sourcePath);
    const issues = [];
    const eventRows = objects(confirmation.governanceEventTypeRegistry);
    const writers = objects(confirmation.controlledIngestWriterRegistry);
    const coveredEvents = new Set(writers.flatMap((writer) => strings(writer.allowedEventTypes)));
    for (const row of eventRows) {
        const eventType = text(row.eventType);
        if (!eventType) {
            issues.push(issue('canonical_event_type_missing', 'governanceEventTypeRegistry row missing eventType'));
            continue;
        }
        if (!text(row.payloadKind))
            issues.push(issue('canonical_event_payload_kind_missing', `${eventType} missing payloadKind`, [
                eventType,
            ]));
        const contract = nested(row.payloadContract);
        if (Object.keys(contract).length === 0)
            issues.push(issue('canonical_event_payload_contract_missing', `${eventType} missing payloadContract`, [
                eventType,
            ]));
        if (!text(contract.allowedControlWriteMode)) {
            issues.push(issue('canonical_event_write_mode_missing', `${eventType} missing payloadContract.allowedControlWriteMode`, [eventType]));
        }
        if (strings(row.writesControlFields).length > 0 &&
            strings(row.allowedWriterRefs).length === 0 &&
            !coveredEvents.has(eventType)) {
            issues.push(issue('canonical_event_writer_refs_missing', `${eventType} writes control fields but has no allowedWriterRefs`, [eventType]));
        }
    }
    for (const row of eventRows) {
        const eventType = text(row.eventType);
        if (eventType && strings(row.writesControlFields).length > 0 && !coveredEvents.has(eventType)) {
            issues.push(issue('canonical_event_writer_registry_missing', `${eventType} not covered by controlledIngestWriterRegistry`, [eventType]));
        }
    }
    const blockingReasons = [...new Set(issues.map((item) => item.code))];
    return {
        reportType: 'canonical_event_registry_report',
        generatedAt: input.evaluatedAt ?? new Date().toISOString(),
        generatedBy: input.evaluatedBy ?? 'agent',
        sourcePath: normalizePath(sourcePath),
        decision: blockingReasons.length === 0 ? 'pass' : 'blocked',
        blockingReasons,
        checkedEvents: eventRows.length,
        issues,
    };
}
function evaluateReverseAuditReadinessGate(input) {
    const script = path.resolve('_bmad/skills/requirements-contract-authoring/scripts/reverse_audit_contract.js');
    const result = (0, node_child_process_1.spawnSync)(process.execPath, [
        script,
        path.resolve(input.sourcePath),
        '--mode',
        'readiness',
        ...(input.recordPath ? ['--requirement-record', path.resolve(input.recordPath)] : []),
        ...(input.attemptId ? ['--attempt-id', input.attemptId] : []),
        '--json',
    ], {
        cwd: process.cwd(),
        encoding: 'utf8',
        maxBuffer: 20 * 1024 * 1024,
    });
    const issues = [];
    let auditReport = {};
    try {
        auditReport = JSON.parse(result.stdout || '{}');
    }
    catch {
        issues.push(issue('reverse_audit_json_parse_failed', 'reverse audit did not emit parseable JSON'));
    }
    const rendererReadiness = nested(nested(auditReport.rendererAuthority).deliveryReadiness);
    const directReadiness = nested(auditReport.deliveryReadiness);
    const effectiveReadiness = Object.keys(directReadiness).length > 0
        ? directReadiness
        : Object.keys(rendererReadiness).length > 0
            ? rendererReadiness
            : {};
    const readiness = effectiveReadiness.ready;
    if (result.status !== 0 && readiness !== true)
        issues.push(issue('reverse_audit_exit_nonzero', `reverse audit exitCode=${result.status ?? '<null>'}`));
    if (readiness !== true)
        issues.push(issue('reverse_audit_delivery_readiness_not_ready', 'deliveryReadiness.ready is not true in readiness mode', ['deliveryReadiness.ready']));
    const blockingReasons = [...new Set(issues.map((item) => item.code))];
    return {
        reportType: 'reverse_audit_readiness_report',
        generatedAt: input.evaluatedAt ?? new Date().toISOString(),
        generatedBy: input.evaluatedBy ?? 'agent',
        sourcePath: normalizePath(path.resolve(input.sourcePath)),
        decision: blockingReasons.length === 0 ? 'pass' : 'blocked',
        blockingReasons,
        exitCode: result.status,
        auditVerdict: text(auditReport.verdict),
        auditFailedChecks: strings(auditReport.failedChecks),
        auditFindings: objects(auditReport.findings),
        deliveryReadiness: Object.keys(effectiveReadiness).length > 0 ? effectiveReadiness : null,
        issues,
    };
}
function evaluateCloseoutTargetControlFlowGate(input) {
    const { confirmation, sourcePath } = readImplementationConfirmation(input.sourcePath);
    const currentTargetMap = nested(confirmation.currentTargetMap);
    const legacyTokens = objects(currentTargetMap.existingArtifacts)
        .filter((row) => LEGACY_POLICIES.has(text(row.completionProofPolicy)))
        .map((row) => text(row.currentPath))
        .filter((value) => value && !isPathLike(value));
    const closeoutScripts = objects(currentTargetMap.scriptConvergence)
        .map((row) => text(row.scriptOrConfigPath))
        .filter((value) => value && /closeout|delivery/iu.test(value));
    const issues = [];
    for (const scriptPath of closeoutScripts) {
        const absolute = path.resolve(scriptPath);
        if (!fs.existsSync(absolute)) {
            issues.push(issue('closeout_control_flow_script_missing', `${scriptPath} missing`, [scriptPath]));
            continue;
        }
        const source = fs.readFileSync(absolute, 'utf8');
        for (const token of legacyTokens) {
            if (source.includes(token)) {
                issues.push(issue('closeout_target_control_flow_uses_legacy_completion_path', `${scriptPath} still references legacy completion token ${token}`, [scriptPath, token]));
            }
        }
    }
    const blockingReasons = [...new Set(issues.map((item) => item.code))];
    return {
        reportType: 'closeout_target_control_flow_report',
        generatedAt: input.evaluatedAt ?? new Date().toISOString(),
        generatedBy: input.evaluatedBy ?? 'agent',
        sourcePath: normalizePath(sourcePath),
        decision: blockingReasons.length === 0 ? 'pass' : 'blocked',
        blockingReasons,
        checkedScripts: closeoutScripts,
        legacyTokens,
        issues,
    };
}
function evaluateExternalBoundaryGate(input) {
    const { confirmation, sourcePath } = readImplementationConfirmation(input.sourcePath);
    const registries = [
        ...objects(confirmation.artifactAutomationPlan),
        ...objects(confirmation.scriptsAndHooksRegistry),
        ...objects(nested(confirmation.currentTargetMap).scriptConvergence),
    ];
    const externalRows = registries.filter((row) => {
        const searchable = JSON.stringify(row).toLowerCase();
        return (searchable.includes('external') ||
            searchable.includes('board') ||
            searchable.includes('kanban') ||
            searchable.includes('github') ||
            searchable.includes('gitlab'));
    });
    const issues = [];
    for (const row of externalRows) {
        if (row.canAffectControlFlow === true) {
            issues.push(issue('external_boundary_can_affect_control_flow', `${text(row.id) || text(row.path) || '<external-row>'} canAffectControlFlow=true`, [text(row.id) || text(row.path)]));
        }
        const role = `${text(row.controlOrEvidenceRole)} ${text(row.sourceOfTruthRole)} ${text(row.controlPlaneRole)}`.toLowerCase();
        if (role.includes('control') &&
            !role.includes('projection') &&
            !role.includes('evidence') &&
            !role.includes('validation')) {
            issues.push(issue('external_boundary_control_authority_leak', `${text(row.id) || text(row.path) || '<external-row>'} appears to grant control authority`, [text(row.id) || text(row.path)]));
        }
    }
    const blockingReasons = [...new Set(issues.map((item) => item.code))];
    return {
        reportType: 'external_boundary_report',
        generatedAt: input.evaluatedAt ?? new Date().toISOString(),
        generatedBy: input.evaluatedBy ?? 'agent',
        sourcePath: normalizePath(sourcePath),
        decision: blockingReasons.length === 0 ? 'pass' : 'blocked',
        blockingReasons,
        checkedRows: externalRows.length,
        issues,
    };
}
function mainTargetArtifactRealizationGate(argv) {
    const args = parseArgs(argv);
    if (args.help) {
        console.log('Usage: target-artifact-realization-gate --source <requirement.md> --requirement-record <json> --attempt-id <id> [--report-path <json>] [--json]');
        return 0;
    }
    if (!args.source || !args.requirementRecord || !args.attemptId)
        throw new Error('missing required args: source, requirementRecord, attemptId');
    const recordPath = path.resolve(args.requirementRecord);
    const reportPath = path.resolve(args.reportPath ??
        path.join(path.dirname(recordPath), 'target-artifact-realization-report.json'));
    const report = evaluateTargetArtifactRealization({
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
        : `target_artifact_realization=${report.decision}\n`);
    return text(report.decision) === 'pass' ? 0 : 1;
}
if (require.main === module && isDirectTargetArtifactRealizationGateCli(process.argv[1])) {
    try {
        process.exitCode = mainTargetArtifactRealizationGate(process.argv.slice(2));
    }
    catch (error) {
        console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }, null, 2));
        process.exitCode = 2;
    }
}
