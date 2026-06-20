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
exports.NoActiveRequirementError = exports.NO_ACTIVE_REQUIREMENT = void 0;
exports.isNoActiveRequirementError = isNoActiveRequirementError;
exports.requirementRecordsRoot = requirementRecordsRoot;
exports.requirementRecordIndexPath = requirementRecordIndexPath;
exports.emitRepairProjection = emitRepairProjection;
exports.resolveActiveRequirement = resolveActiveRequirement;
exports.resolvedRuntimeContextToRuntimeContext = resolvedRuntimeContextToRuntimeContext;
exports.mainResolveActiveRequirement = mainResolveActiveRequirement;
/* eslint-disable no-console */
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const FLOWS = new Set(['story', 'bugfix', 'standalone_tasks', 'epic', 'unknown']);
exports.NO_ACTIVE_REQUIREMENT = 'NO_ACTIVE_REQUIREMENT';
class NoActiveRequirementError extends Error {
    code = exports.NO_ACTIVE_REQUIREMENT;
    constructor(root) {
        super(`NO_ACTIVE_REQUIREMENT: no active requirement record found under ${requirementRecordsRoot(root)}; nextRequiredAction=contract_authoring_required`);
        this.name = 'NoActiveRequirementError';
    }
}
exports.NoActiveRequirementError = NoActiveRequirementError;
function isNoActiveRequirementError(error) {
    return (error instanceof NoActiveRequirementError ||
        (error instanceof Error && error.message.includes(exports.NO_ACTIVE_REQUIREMENT)));
}
function isDirectResolveActiveRequirementCli(entry) {
    return /(^|[\\/])resolve-active-requirement(\.[cm]?js|\.ts)?$/iu.test(entry ?? '');
}
function text(value) {
    return typeof value === 'string' ? value.trim() : '';
}
function abs(root, value) {
    return path.isAbsolute(value) ? value : path.resolve(root, value);
}
function readJson(file) {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error(`JSON object expected: ${file}`);
    }
    return parsed;
}
function requirementRecordsRoot(root) {
    return path.join(root, '_bmad-output', 'runtime', 'requirement-records');
}
function requirementRecordIndexPath(root) {
    return path.join(requirementRecordsRoot(root), 'index.json');
}
function defaultRecordPath(root, requirementSetId) {
    return path.join(requirementRecordsRoot(root), requirementSetId, 'requirement-record.json');
}
function nested(obj, key) {
    const value = obj[key];
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}
function firstText(...values) {
    for (const value of values) {
        const candidate = text(value);
        if (candidate)
            return candidate;
    }
    return '';
}
function recordEntries(index) {
    const out = [];
    for (const key of ['records', 'requirements', 'requirementRecords']) {
        const value = index[key];
        if (Array.isArray(value)) {
            out.push(...value.filter((item) => Boolean(item) && typeof item === 'object'));
        }
        else if (value && typeof value === 'object') {
            for (const [id, entry] of Object.entries(value)) {
                if (typeof entry === 'string') {
                    out.push({ requirementSetId: id, recordPath: entry });
                }
                else if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
                    out.push({ requirementSetId: id, ...entry });
                }
            }
        }
    }
    return out;
}
function pointerToInput(pointer) {
    return {
        recordId: firstText(pointer.recordId, pointer.id),
        requirementSetId: firstText(pointer.requirementSetId, pointer.requirement_set_id),
        runId: firstText(pointer.runId, pointer.run_id),
        ...(firstText(pointer.recordPath, pointer.path, pointer.controlRecordPath)
            ? { recordPath: firstText(pointer.recordPath, pointer.path, pointer.controlRecordPath) }
            : {}),
    };
}
function activePointer(index) {
    return (nested(index, 'active') ??
        nested(index, 'current') ??
        nested(index, 'activeRequirement') ??
        nested(index, 'currentRequirement') ??
        nested(index, 'currentRequirementRef'));
}
function matches(entry, input) {
    const recordId = firstText(entry.recordId, entry.id);
    const requirementSetId = firstText(entry.requirementSetId, entry.requirement_set_id);
    const runId = firstText(entry.runId, entry.run_id);
    const entryRecordPath = firstText(entry.recordPath, entry.path, entry.controlRecordPath);
    const inputRecordPath = firstText(input.recordPath, input.path, input.controlRecordPath);
    if (input.recordId && recordId !== input.recordId)
        return false;
    if (input.requirementSetId && requirementSetId !== input.requirementSetId)
        return false;
    if (input.runId && runId !== input.runId)
        return false;
    if (inputRecordPath &&
        entryRecordPath &&
        path.normalize(inputRecordPath) !== path.normalize(entryRecordPath)) {
        return false;
    }
    const hasRequirementIdentity = Boolean(input.recordId || input.requirementSetId || inputRecordPath);
    if (input.runId && !hasRequirementIdentity && runId !== input.runId)
        return false;
    return Boolean(input.recordId || input.requirementSetId || input.runId || inputRecordPath);
}
function selectedFromIndex(index, input) {
    const entries = recordEntries(index);
    const explicit = entries.find((entry) => matches(entry, input));
    if (explicit)
        return { ...explicit, resolutionSource: 'index_match' };
    if (input.recordId || input.requirementSetId || input.runId) {
        return null;
    }
    const pointer = activePointer(index);
    if (!pointer)
        return null;
    const pointed = entries.find((entry) => matches(entry, pointerToInput(pointer)));
    return { ...(pointed ?? pointer), resolutionSource: 'index_active' };
}
function refPath(record, defaultPathValue, ...keys) {
    for (const key of keys) {
        const value = record[key];
        if (typeof value === 'string' && value.trim())
            return value;
        if (value && typeof value === 'object' && !Array.isArray(value)) {
            const candidate = text(value.path);
            if (candidate)
                return candidate;
        }
    }
    return defaultPathValue;
}
function readJsonIfExists(file) {
    if (!fs.existsSync(file))
        return null;
    return readJson(file);
}
function resolveRecordPath(root, selected, requirementSetId) {
    const configured = firstText(selected?.recordPath, selected?.path, selected?.controlRecordPath);
    return configured ? abs(root, configured) : defaultRecordPath(root, requirementSetId);
}
function requireFlow(value) {
    if (FLOWS.has(value))
        return value;
    throw new Error(`requirement record flow invalid or missing: ${value || '<missing>'}`);
}
function requireStage(value) {
    if (value)
        return value;
    throw new Error('requirement record stage invalid or missing');
}
function objects(value) {
    return Array.isArray(value)
        ? value.filter((item) => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
        : [];
}
function latestByTextDate(...values) {
    for (const value of values) {
        const candidate = text(value);
        if (candidate)
            return candidate;
    }
    return '1970-01-01T00:00:00.000Z';
}
function closeoutDecision(record) {
    const closeout = nested(record, 'closeout');
    return firstText(closeout?.decision, objects(closeout?.attempts).at(-1)?.decision);
}
function hasOpenRepairSignal(record) {
    const openLoop = objects(record.rerunLoops).some((loop) => ['open', 'in_progress', 'no_progress', 'blocked'].includes(text(loop.status)));
    const repairGate = objects(record.gateChecks).some((gate) => ['fail', 'blocked'].includes(text(gate.decision)));
    return openLoop || repairGate;
}
function candidateTier(record) {
    const status = text(record.status);
    const closeout = closeoutDecision(record);
    if (closeout === 'pass')
        return { order: 40, label: 'closeout_pass' };
    if (closeout === 'blocked' || closeout === 'fail')
        return { order: 30, label: 'closeout_blocked' };
    if (hasOpenRepairSignal(record))
        return { order: 20, label: 'repair_or_reroute' };
    if (['active', 'in_progress', 'user_confirmed'].includes(status)) {
        return { order: 10, label: 'active_non_closeout' };
    }
    return { order: 50, label: 'latest_updated_fallback' };
}
function scanRequirementRecordCandidates(root, input) {
    const recordsRoot = requirementRecordsRoot(root);
    if (!fs.existsSync(recordsRoot))
        return [];
    const candidates = [];
    for (const entry of fs.readdirSync(recordsRoot, { withFileTypes: true })) {
        if (!entry.isDirectory())
            continue;
        const recordPath = path.join(recordsRoot, entry.name, 'requirement-record.json');
        if (!fs.existsSync(recordPath))
            continue;
        try {
            const record = readJson(recordPath);
            const candidate = {
                recordId: firstText(record.recordId),
                requirementSetId: firstText(record.requirementSetId, entry.name),
                recordPath,
                status: firstText(record.status) || 'unknown',
                stage: firstText(record.stage, record.currentStage, nested(record, 'runtime')?.stage),
                updatedAt: latestByTextDate(record.updatedAt, record.lastUpdatedAt, record.confirmedAt),
                closeoutDecision: closeoutDecision(record),
                selectionTier: candidateTier(record).label,
            };
            if (input.recordId && candidate.recordId !== input.recordId)
                continue;
            if (input.requirementSetId && candidate.requirementSetId !== input.requirementSetId)
                continue;
            if (input.runId &&
                !(input.recordId || input.requirementSetId) &&
                firstText(record.runId) !== input.runId)
                continue;
            candidates.push(candidate);
        }
        catch {
            // Invalid candidate records are intentionally ignored during recovery scan.
        }
    }
    return candidates;
}
function candidateSortKey(candidate) {
    const tierOrderByLabel = {
        active_non_closeout: 10,
        repair_or_reroute: 20,
        closeout_blocked: 30,
        closeout_pass: 40,
        latest_updated_fallback: 50,
    };
    const updatedMs = Date.parse(candidate.updatedAt);
    return {
        tierOrder: tierOrderByLabel[candidate.selectionTier] ?? 50,
        updatedMs: Number.isFinite(updatedMs) ? updatedMs : 0,
    };
}
function selectScannedCandidate(candidates) {
    if (candidates.length === 0) {
        return { selected: null, rejected: [], reason: 'blocked_missing_active_requirement' };
    }
    const sorted = [...candidates].sort((left, right) => {
        const leftKey = candidateSortKey(left);
        const rightKey = candidateSortKey(right);
        if (leftKey.tierOrder !== rightKey.tierOrder)
            return leftKey.tierOrder - rightKey.tierOrder;
        if (leftKey.updatedMs !== rightKey.updatedMs)
            return rightKey.updatedMs - leftKey.updatedMs;
        return left.requirementSetId.localeCompare(right.requirementSetId);
    });
    const best = sorted[0];
    const bestKey = candidateSortKey(best);
    const tied = sorted.filter((candidate) => {
        const key = candidateSortKey(candidate);
        return key.tierOrder === bestKey.tierOrder && key.updatedMs === bestKey.updatedMs;
    });
    if (tied.length > 1) {
        return {
            selected: null,
            rejected: sorted,
            reason: 'blocked_ambiguous_active_requirement',
        };
    }
    return {
        selected: best,
        rejected: sorted.slice(1),
        reason: best.selectionTier,
    };
}
function projectionFile(root) {
    return path.join(requirementRecordsRoot(root), 'index-repair-projection.json');
}
function emitRepairProjection(root, input) {
    const projectedAt = new Date().toISOString();
    const projectionPath = projectionFile(root);
    const projection = {
        eventType: 'requirement_index_repair_projected',
        ...input,
        projectedAt,
        projectionPath,
    };
    fs.mkdirSync(path.dirname(projectionPath), { recursive: true });
    fs.writeFileSync(projectionPath, `${JSON.stringify(projection, null, 2)}\n`, 'utf8');
    return projection;
}
function failWithProjection(root, projection) {
    const candidateList = projection.rejectedCandidates
        .map((candidate) => `${candidate.requirementSetId}:${candidate.recordId}:${candidate.selectionTier}`)
        .join(', ');
    throw new Error(`${projection.selectionReason}: ${candidateList || 'no controlled requirement-record candidates'}; projection=${projection.projectionPath}`);
}
function hasExplicitRequirementSelector(input) {
    return Boolean(input.recordId || input.requirementSetId || input.runId);
}
function stageFromConfirmedImplementationEntry(record, flow) {
    const status = firstText(record.status);
    const entryFlow = firstText(record.entryFlow, nested(record, 'implementationConfirmation')?.entryFlow);
    const entryFlowClass = firstText(record.entryFlowClass, nested(record, 'implementationConfirmation')?.entryFlowClass);
    const workflowAdapter = firstText(record.workflowAdapter, nested(record, 'implementationConfirmation')?.workflowAdapter);
    if (flow === 'standalone_tasks' &&
        entryFlow === 'standalone_tasks' &&
        entryFlowClass === 'task_packet_entry' &&
        ['direct', 'legacy', 'speckit'].includes(workflowAdapter) &&
        ['user_confirmed', 'in_progress'].includes(status)) {
        return 'implement';
    }
    return '';
}
function maybeImplementationEntryGate(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value))
        return undefined;
    const gate = value;
    if (gate.gateName === 'implementation-readiness' && gate.decision) {
        return gate;
    }
    return undefined;
}
function assertIdentity(record, input, recordPath) {
    if (input.recordId && text(record.recordId) !== input.recordId) {
        throw new Error(`recordId mismatch in ${recordPath}: expected ${input.recordId}, got ${text(record.recordId)}`);
    }
    if (input.requirementSetId && text(record.requirementSetId) !== input.requirementSetId) {
        throw new Error(`requirementSetId mismatch in ${recordPath}: expected ${input.requirementSetId}, got ${text(record.requirementSetId)}`);
    }
}
function resolveActiveRequirement(input = {}) {
    const root = path.resolve(input.root ?? process.cwd());
    const indexPath = requirementRecordIndexPath(root);
    const hasIndex = fs.existsSync(indexPath);
    let index = null;
    let indexReadError = '';
    if (hasIndex) {
        try {
            index = readJson(indexPath);
        }
        catch (error) {
            indexReadError = error instanceof Error ? error.message : String(error);
        }
    }
    let selected = index ? selectedFromIndex(index, input) : null;
    let repairProjection;
    if (!selected) {
        const scanned = scanRequirementRecordCandidates(root, input);
        const scanResult = selectScannedCandidate(scanned);
        if (!scanResult.selected) {
            if (!hasExplicitRequirementSelector(input) &&
                scanResult.reason === 'blocked_missing_active_requirement') {
                throw new NoActiveRequirementError(root);
            }
            repairProjection = emitRepairProjection(root, {
                requirementSetId: null,
                recordPath: null,
                selectionReason: scanResult.reason,
                rejectedCandidates: scanResult.rejected,
                safeToWrite: false,
            });
            failWithProjection(root, repairProjection);
        }
        repairProjection = emitRepairProjection(root, {
            requirementSetId: scanResult.selected.requirementSetId,
            recordPath: scanResult.selected.recordPath,
            selectionReason: index
                ? `index_repair:${scanResult.reason}`
                : indexReadError
                    ? `index_unreadable:${scanResult.reason}`
                    : `index_missing:${scanResult.reason}`,
            rejectedCandidates: scanResult.rejected,
            safeToWrite: true,
        });
        selected = {
            recordId: scanResult.selected.recordId,
            requirementSetId: scanResult.selected.requirementSetId,
            recordPath: scanResult.selected.recordPath,
            resolutionSource: input.recordId || input.requirementSetId || input.runId
                ? 'record_scan_match'
                : 'record_scan_recovered',
        };
    }
    let requirementSetId = input.requirementSetId ??
        firstText(selected?.requirementSetId, selected?.requirement_set_id, selected?.recordId, input.recordId);
    if (!requirementSetId) {
        throw new Error('Unable to resolve requirementSetId from explicit args or requirement index');
    }
    let recordPath = resolveRecordPath(root, selected, requirementSetId);
    if (!fs.existsSync(recordPath) && !(input.recordId || input.requirementSetId || input.runId)) {
        const scanned = scanRequirementRecordCandidates(root, {});
        const scanResult = selectScannedCandidate(scanned);
        if (!scanResult.selected) {
            if (scanResult.reason === 'blocked_missing_active_requirement') {
                throw new NoActiveRequirementError(root);
            }
            repairProjection = emitRepairProjection(root, {
                requirementSetId: null,
                recordPath: null,
                selectionReason: scanResult.reason,
                rejectedCandidates: scanResult.rejected,
                safeToWrite: false,
            });
            failWithProjection(root, repairProjection);
        }
        repairProjection = emitRepairProjection(root, {
            requirementSetId: scanResult.selected.requirementSetId,
            recordPath: scanResult.selected.recordPath,
            selectionReason: `index_pointer_missing_record:${scanResult.reason}`,
            rejectedCandidates: scanResult.rejected,
            safeToWrite: true,
        });
        selected = {
            recordId: scanResult.selected.recordId,
            requirementSetId: scanResult.selected.requirementSetId,
            recordPath: scanResult.selected.recordPath,
            resolutionSource: 'record_scan_recovered',
        };
        requirementSetId = scanResult.selected.requirementSetId;
        recordPath = scanResult.selected.recordPath;
    }
    if (!fs.existsSync(recordPath)) {
        throw new Error(`requirement record missing: ${recordPath}`);
    }
    const record = readJson(recordPath);
    assertIdentity(record, input, recordPath);
    const recordId = firstText(record.recordId, selected?.recordId, input.recordId);
    if (!recordId)
        throw new Error(`requirement record recordId missing: ${recordPath}`);
    const finalRequirementSetId = firstText(record.requirementSetId, requirementSetId);
    const base = path.dirname(recordPath);
    const runtimePolicySnapshotPath = abs(root, refPath(record, path.join(base, 'recovery', 'runtime-policy-snapshot.json'), 'runtimePolicySnapshotRef', 'runtimePolicySnapshotPath'));
    const runtimePolicySnapshot = readJsonIfExists(runtimePolicySnapshotPath);
    const runtimePolicySnapshotPolicy = runtimePolicySnapshot
        ? nested(runtimePolicySnapshot, 'policy')
        : null;
    const flow = requireFlow(firstText(record.flow, record.entryFlow, nested(record, 'implementationConfirmation')?.entryFlow, runtimePolicySnapshot?.flow, runtimePolicySnapshotPolicy?.flow));
    const stage = requireStage(firstText(record.stage, record.currentStage, nested(record, 'runtime')?.stage, runtimePolicySnapshot?.stage, runtimePolicySnapshotPolicy?.stage, stageFromConfirmedImplementationEntry(record, flow)));
    const recoveryContextPath = abs(root, refPath(record, path.join(base, 'recovery', 'recovery-context.json'), 'recoveryContextRef', 'recoveryContextPath'));
    return {
        version: 1,
        kind: 'ResolvedRuntimeContext',
        recordId,
        requirementSetId: finalRequirementSetId,
        ...(firstText(record.runId, selected?.runId, input.runId)
            ? { runId: firstText(record.runId, selected?.runId, input.runId) }
            : {}),
        status: firstText(record.status) || 'unknown',
        flow,
        stage,
        ...(firstText(record.entryFlow) ? { entryFlow: firstText(record.entryFlow) } : {}),
        ...(firstText(record.entryFlowClass)
            ? { entryFlowClass: firstText(record.entryFlowClass) }
            : {}),
        ...(firstText(record.workflowAdapter)
            ? { workflowAdapter: firstText(record.workflowAdapter) }
            : {}),
        ...(firstText(record.updatedAt, record.lastUpdatedAt, record.confirmedAt)
            ? { updatedAt: firstText(record.updatedAt, record.lastUpdatedAt, record.confirmedAt) }
            : {}),
        ...(firstText(record.sourceMode) ? { sourceMode: firstText(record.sourceMode) } : {}),
        ...(firstText(record.sourcePath) ? { sourcePath: firstText(record.sourcePath) } : {}),
        ...(firstText(record.sourceDocumentHash)
            ? { sourceDocumentHash: firstText(record.sourceDocumentHash) }
            : {}),
        ...(firstText(record.implementationConfirmationHash)
            ? { implementationConfirmationHash: firstText(record.implementationConfirmationHash) }
            : {}),
        ...(firstText(record.confirmationPageHash)
            ? { confirmationPageHash: firstText(record.confirmationPageHash) }
            : {}),
        ...(firstText(record.templateId) ? { templateId: firstText(record.templateId) } : {}),
        ...(firstText(record.epicId) ? { epicId: firstText(record.epicId) } : {}),
        ...(firstText(record.storyId) ? { storyId: firstText(record.storyId) } : {}),
        ...(firstText(record.storySlug) ? { storySlug: firstText(record.storySlug) } : {}),
        ...(firstText(record.artifactRoot) ? { artifactRoot: firstText(record.artifactRoot) } : {}),
        ...(firstText(record.artifactPath, record.sourcePath)
            ? { artifactPath: firstText(record.artifactPath, record.sourcePath) }
            : {}),
        ...(record.latestReviewerCloseout
            ? { latestReviewerCloseout: record.latestReviewerCloseout }
            : {}),
        ...(maybeImplementationEntryGate(record.implementationEntryGate)
            ? { implementationEntryGate: maybeImplementationEntryGate(record.implementationEntryGate) }
            : {}),
        indexPath: hasIndex ? indexPath : null,
        recordPath,
        runtimePolicySnapshotPath,
        runtimePolicySnapshotExists: fs.existsSync(runtimePolicySnapshotPath),
        recoveryContextPath,
        recoveryContextExists: fs.existsSync(recoveryContextPath),
        ...(record.traceCheckpointRef ? { traceCheckpointRef: record.traceCheckpointRef } : {}),
        ...(firstText(record.traceRowsCheckpointHash)
            ? { traceRowsCheckpointHash: firstText(record.traceRowsCheckpointHash) }
            : {}),
        artifactIndexPath: path.join(requirementRecordsRoot(root), 'artifact-index.jsonl'),
        orchestrationStateDir: path.join(base, 'orchestration', 'orchestration-state'),
        promptPacketsDir: path.join(base, 'prompts', 'prompt-packets'),
        resolutionSource: selected?.resolutionSource ??
            'explicit_args_without_index',
        ...(repairProjection ? { repairProjection } : {}),
        resolvedAt: new Date().toISOString(),
    };
}
function resolvedRuntimeContextToRuntimeContext(resolved) {
    return {
        version: 1,
        flow: resolved.flow,
        stage: resolved.stage,
        sourceMode: resolved.sourceMode === 'full_bmad' ||
            resolved.sourceMode === 'seeded_solutioning' ||
            resolved.sourceMode === 'standalone_story'
            ? resolved.sourceMode
            : undefined,
        templateId: resolved.templateId,
        epicId: resolved.epicId,
        storyId: resolved.storyId,
        storySlug: resolved.storySlug,
        runId: resolved.runId,
        artifactRoot: resolved.artifactRoot,
        artifactPath: resolved.artifactPath,
        contextScope: resolved.runId ? 'run' : resolved.storyId ? 'story' : 'project',
        latestReviewerCloseout: resolved.latestReviewerCloseout,
        updatedAt: resolved.updatedAt ?? resolved.resolvedAt,
        implementationEntryGate: resolved.implementationEntryGate,
        resolvedRuntimeContext: resolved,
    };
}
function parseArgs(argv) {
    const out = {};
    for (let i = 0; i < argv.length; i += 1) {
        const arg = argv[i];
        if (arg === '--json')
            out.json = true;
        else if (arg === '--cwd' && argv[i + 1])
            out.root = argv[++i];
        else if (arg === '--record-id' && argv[i + 1])
            out.recordId = argv[++i];
        else if (arg === '--requirement-set-id' && argv[i + 1])
            out.requirementSetId = argv[++i];
        else if (arg === '--run-id' && argv[i + 1])
            out.runId = argv[++i];
        else
            throw new Error(`Unsupported or incomplete argument: ${arg}`);
    }
    return out;
}
function mainResolveActiveRequirement(argv) {
    try {
        const args = parseArgs(argv);
        const resolved = resolveActiveRequirement(args);
        process.stdout.write(`${JSON.stringify(resolved, null, 2)}\n`);
        return 0;
    }
    catch (error) {
        console.error(`resolve-active-requirement: ${error instanceof Error ? error.message : String(error)}`);
        return 1;
    }
}
if (require.main === module && isDirectResolveActiveRequirementCli(process.argv[1])) {
    process.exit(mainResolveActiveRequirement(process.argv.slice(2)));
}
