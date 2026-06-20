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
exports.buildPerMustClosureEvidenceIndex = buildPerMustClosureEvidenceIndex;
exports.mainPerMustClosureEvidenceIndex = mainPerMustClosureEvidenceIndex;
/* eslint-disable no-console */
const crypto = __importStar(require("node:crypto"));
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
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
function uniqueStrings(values) {
    return [...new Set(values.filter(Boolean))];
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
function sha256FileIfExists(file) {
    return fs.existsSync(file)
        ? `sha256:${crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}`
        : '';
}
function requirementMustRows(modelPacket) {
    return objects(nested(modelPacket.requirements).must).filter((row) => /^MUST-\d{3}$/u.test(text(row.id)));
}
function traceRowsForMust(modelPacket, must) {
    const id = text(must.id);
    const explicitTraceIds = new Set(strings(must.coveredByTraceRows));
    return objects(modelPacket.traceSlices).filter((slice) => {
        const traceId = text(slice.traceId);
        return (strings(slice.requirementRefs).includes(id) ||
            strings(slice.covers).includes(id) ||
            (traceId && explicitTraceIds.has(traceId)));
    });
}
function commandRowsForMust(modelPacket, must, traces) {
    const traceIds = new Set(traces.map((trace) => text(trace.traceId)).filter(Boolean));
    const evidenceRefs = new Set([
        ...strings(must.evidenceRefs),
        ...traces.flatMap((trace) => strings(trace.evidenceRefs)),
    ]);
    const commandRefs = new Set([
        ...strings(must.commandRefs),
        ...traces.flatMap((trace) => [
            ...strings(trace.commandRefs),
            ...strings(trace.deliveryCommandRefs),
        ]),
    ]);
    const commands = objects(modelPacket.requiredCommands);
    const directlyMapped = commands.filter((command) => {
        const commandId = text(command.id ?? command.commandId);
        if (commandId && commandRefs.has(commandId))
            return true;
        return strings(command.traceRows).some((traceId) => traceIds.has(traceId));
    });
    if (directlyMapped.length > 0)
        return directlyMapped;
    return commands.filter((command) => {
        return strings(command.evidenceRefs).some((evidenceRef) => evidenceRefs.has(evidenceRef));
    });
}
function latestClosure(record, mustId) {
    const matches = objects(record.requirementClosures).filter((closure) => text(closure.requirementId) === mustId);
    return matches.length > 0 ? matches[matches.length - 1] : null;
}
function runMatchesAttempt(run, attemptId) {
    if (!attemptId)
        return true;
    return text(run.closeoutAttemptId) === attemptId;
}
function commandRuns(record, commandId, attemptId) {
    return objects(record.executionIterations).flatMap((iteration) => objects(iteration.commandRunRefs)
        .filter((run) => text(run.commandId) === commandId && runMatchesAttempt(run, attemptId))
        .map((run) => ({
        commandId: text(run.commandId),
        command: text(run.command),
        runId: text(run.runId),
        closeoutAttemptId: text(run.closeoutAttemptId),
        executionIterationId: text(iteration.executionIterationId),
        exitCode: typeof run.exitCode === 'number' ? run.exitCode : null,
        startedAt: text(run.startedAt),
        completedAt: text(run.completedAt),
        outputSummary: text(run.outputSummary),
    })));
}
function deliveryCommands(record, commandId, attemptId) {
    return objects(nested(record.deliveryEvidence).requiredCommands).filter((command) => {
        if (text(command.commandId ?? command.id) !== commandId)
            return false;
        if (!attemptId)
            return true;
        if (text(command.closeoutAttemptId) === attemptId)
            return true;
        const lastRunRef = nested(command.lastRunRef);
        return text(lastRunRef.closeoutAttemptId) === attemptId;
    });
}
function artifactCompletenessIssues(artifact) {
    const issues = [];
    if (!text(artifact.path))
        issues.push('path_missing');
    if (!text(artifact.hash ?? artifact.contentHash))
        issues.push('hash_missing');
    if (!text(artifact.artifactType))
        issues.push('artifact_type_missing');
    if (!text(artifact.producer))
        issues.push('producer_missing');
    if (!text(artifact.purpose))
        issues.push('purpose_missing');
    if (strings(artifact.relatedRequirementIds).length === 0)
        issues.push('related_requirement_ids_missing');
    if (!text(artifact.status))
        issues.push('status_missing');
    if (!text(artifact.inputVersion))
        issues.push('input_version_missing');
    if (!text(artifact.outputVersion))
        issues.push('output_version_missing');
    const role = text(artifact.sourceOfTruthRole);
    const artifactType = text(artifact.artifactType);
    const requiresEvidenceRole = !role ||
        role === 'evidence' ||
        artifactType === 'command_output' ||
        artifactType.startsWith('command_');
    if (requiresEvidenceRole && role !== 'evidence')
        issues.push('source_of_truth_role_not_evidence');
    return issues;
}
function artifactIndexed(record, artifact) {
    const artifactPath = normalizePathForRecord(text(artifact.path));
    const artifactHash = text(artifact.hash ?? artifact.contentHash);
    if (!artifactPath || !artifactHash || artifactCompletenessIssues(artifact).length > 0)
        return false;
    return objects(record.artifactIndex).some((indexed) => {
        if (artifactCompletenessIssues(indexed).length > 0)
            return false;
        return (normalizePathForRecord(text(indexed.path)) === artifactPath &&
            text(indexed.hash ?? indexed.contentHash) === artifactHash &&
            text(indexed.sourceOfTruthRole) === 'evidence');
    });
}
function executionArtifactRefs(record, commandId, attemptId) {
    return objects(record.executionIterations).flatMap((iteration) => {
        const hasCommand = objects(iteration.commandRunRefs).some((run) => text(run.commandId) === commandId && runMatchesAttempt(run, attemptId));
        return hasCommand ? objects(iteration.evidenceArtifactRefs) : [];
    });
}
function artifactRefsForCommand(record, commandId, attemptId) {
    const seen = new Set();
    return [
        ...deliveryCommands(record, commandId, attemptId).flatMap((command) => objects(command.artifactRefs)),
        ...executionArtifactRefs(record, commandId, attemptId),
    ].filter((artifact) => {
        const key = `${normalizePathForRecord(text(artifact.path))}|${text(artifact.hash ?? artifact.contentHash)}`;
        if (seen.has(key))
            return false;
        seen.add(key);
        return true;
    });
}
function commandStatus(input) {
    const commandId = text(input.command.id ?? input.command.commandId);
    const runs = commandRuns(input.record, commandId, input.attemptId);
    const artifacts = artifactRefsForCommand(input.record, commandId, input.attemptId);
    const artifactRows = artifacts.map((artifact) => {
        const issues = artifactCompletenessIssues(artifact);
        return {
            artifactType: text(artifact.artifactType),
            sourceOfTruthRole: text(artifact.sourceOfTruthRole),
            path: normalizePathForRecord(text(artifact.path)),
            hash: text(artifact.hash ?? artifact.contentHash),
            indexed: artifactIndexed(input.record, artifact),
            completenessIssues: issues,
        };
    });
    const blockingReasons = [];
    if (!commandId)
        blockingReasons.push('command_id_missing');
    if (!text(input.command.command))
        blockingReasons.push(`command_text_missing:${commandId || '<missing>'}`);
    if (runs.length === 0)
        blockingReasons.push(`test_result_missing:${commandId || '<missing>'}`);
    if (!runs.some((run) => run.exitCode === 0))
        blockingReasons.push(`test_result_not_pass:${commandId || '<missing>'}`);
    if (artifactRows.length === 0)
        blockingReasons.push(`artifact_missing:${commandId || '<missing>'}`);
    if (!artifactRows.some((artifact) => artifact.indexed === true)) {
        blockingReasons.push(`artifact_not_indexed:${commandId || '<missing>'}`);
    }
    for (const artifact of artifactRows) {
        for (const issue of strings(artifact.completenessIssues)) {
            blockingReasons.push(`artifact_incomplete:${commandId || '<missing>'}:${issue}`);
        }
    }
    return {
        commandId,
        command: text(input.command.command),
        traceRows: strings(input.command.traceRows),
        evidenceRefs: strings(input.command.evidenceRefs),
        testResults: runs,
        artifactRefs: artifactRows,
        status: blockingReasons.length === 0 ? 'pass' : 'blocked',
        blockingReasons: uniqueStrings(blockingReasons),
    };
}
function rowForMust(input) {
    const mustId = text(input.must.id);
    const traces = traceRowsForMust(input.modelPacket, input.must);
    const commands = commandRowsForMust(input.modelPacket, input.must, traces);
    const closure = latestClosure(input.record, mustId);
    const commandResults = commands.map((command) => commandStatus({ record: input.record, command, attemptId: input.attemptId }));
    const blockingReasons = [];
    if (traces.length === 0)
        blockingReasons.push(`trace_missing:${mustId}`);
    if (commands.length === 0)
        blockingReasons.push(`command_missing:${mustId}`);
    for (const commandResult of commandResults) {
        for (const reason of strings(commandResult.blockingReasons)) {
            blockingReasons.push(`command_not_closed:${mustId}:${reason}`);
        }
    }
    if (!closure) {
        blockingReasons.push(`closure_missing:${mustId}`);
    }
    else if (text(closure.status) !== 'pass') {
        blockingReasons.push(`closure_not_pass:${mustId}:${text(closure.status) || '<missing>'}`);
    }
    const status = blockingReasons.length === 0 ? 'pass' : 'blocked';
    return {
        mustId,
        requirementText: text(input.must.text) || text(input.must.textZh),
        traceRows: traces.map((trace) => text(trace.traceId)).filter(Boolean),
        commandResults,
        artifactRefs: uniqueStrings(commandResults.flatMap((command) => objects(command.artifactRefs)
            .map((artifact) => normalizePathForRecord(text(artifact.path)))
            .filter(Boolean))),
        closureStatus: closure ? text(closure.status) || 'open' : 'missing',
        closureRecordedAt: closure ? text(closure.recordedAt) || null : null,
        closureClosed: text(closure?.status) === 'pass',
        status,
        blockingReasons: uniqueStrings(blockingReasons),
    };
}
function buildPerMustClosureEvidenceIndex(input) {
    const mustRows = requirementMustRows(input.modelPacket);
    const rows = mustRows.map((must) => rowForMust({
        modelPacket: input.modelPacket,
        record: input.record,
        must,
        attemptId: input.attemptId,
    }));
    const blockingReasons = uniqueStrings([
        ...(mustRows.length === 0 ? ['model_packet_must_rows_missing'] : []),
        ...rows.flatMap((row) => strings(row.blockingReasons)),
    ]);
    const decision = blockingReasons.length === 0 ? 'pass' : 'blocked';
    return {
        schemaVersion: 'per-must-closure-evidence-index/v1',
        reportType: 'per_must_closure_evidence_index',
        generatedAt: input.generatedAt ?? new Date().toISOString(),
        recordId: text(input.record.recordId),
        requirementSetId: text(input.record.requirementSetId) || text(input.record.recordId),
        attemptId: input.attemptId ?? null,
        sourceDocumentHash: text(input.record.sourceDocumentHash),
        implementationConfirmationHash: text(input.record.implementationConfirmationHash),
        modelPacketPath: input.modelPacketPath ? normalizePathForRecord(input.modelPacketPath) : null,
        modelPacketHash: input.modelPacketPath ? sha256FileIfExists(input.modelPacketPath) : null,
        requirementRecordPath: input.requirementRecordPath
            ? normalizePathForRecord(input.requirementRecordPath)
            : null,
        decision,
        counts: {
            total: rows.length,
            pass: rows.filter((row) => text(row.status) === 'pass').length,
            blocked: rows.filter((row) => text(row.status) !== 'pass').length,
        },
        closurePolicy: {
            authority: 'model_packet.requirements.must + requirement-record runtime evidence',
            passCriteria: 'Every MUST row requires at least one trace, at least one command, current-attempt passing command result, indexed evidence artifact, and latest requirementClosures status=pass.',
            forbiddenProofs: [
                'command_green_without_artifact',
                'artifact_without_command_result',
                'task_report_done_without_requirement_closure',
                'model_packet_trace_only',
            ],
        },
        blockingReasons,
        rows,
    };
}
function mainPerMustClosureEvidenceIndex(argv) {
    const args = parseArgs(argv);
    if (args.help) {
        console.log('Usage: per-must-closure-evidence-index --model-packet <json> --requirement-record <json> [--attempt-id <id>] [--out <json>] [--json]');
        return 0;
    }
    if (!args.modelPacket || !args.requirementRecord) {
        throw new Error('missing required args: modelPacket, requirementRecord');
    }
    const modelPacketPath = path.resolve(args.modelPacket);
    const requirementRecordPath = path.resolve(args.requirementRecord);
    const index = buildPerMustClosureEvidenceIndex({
        modelPacket: readJson(modelPacketPath),
        record: readJson(requirementRecordPath),
        attemptId: args.attemptId,
        modelPacketPath,
        requirementRecordPath,
    });
    const outPath = path.resolve(args.out ??
        path.join(path.dirname(requirementRecordPath), 'per-must-closure-evidence-index.json'));
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, `${JSON.stringify(index, null, 2)}\n`, 'utf8');
    const output = {
        ok: text(index.decision) === 'pass',
        decision: text(index.decision),
        outPath: normalizePathForRecord(outPath),
        counts: index.counts,
        blockingReasons: index.blockingReasons,
    };
    process.stdout.write(args.json
        ? `${JSON.stringify(output, null, 2)}\n`
        : `per_must_closure=${text(index.decision)}\n`);
    return text(index.decision) === 'pass' ? 0 : 1;
}
if (require.main === module) {
    try {
        process.exitCode = mainPerMustClosureEvidenceIndex(process.argv.slice(2));
    }
    catch (error) {
        console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }, null, 2));
        process.exitCode = 2;
    }
}
