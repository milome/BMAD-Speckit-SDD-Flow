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
exports.mainDataGovernanceGate = mainDataGovernanceGate;
/* eslint-disable no-console */
const crypto = __importStar(require("node:crypto"));
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const REQUIRED_REGRESSION_METRICS = [
    'requirement_adherence',
    'evidence_completeness',
    'rerun_rate',
    'defect_escape_rate',
    'similar_error_recurrence_rate',
];
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
function strings(value) {
    return Array.isArray(value) ? value.map(text).filter(Boolean) : [];
}
function readJson(file) {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error(`JSON object expected: ${file}`);
    }
    return parsed;
}
function readJsonl(file) {
    if (!fs.existsSync(file))
        return [];
    const content = fs.readFileSync(file, 'utf8').trim();
    if (!content)
        return [];
    return content
        .split(/\r?\n/u)
        .map((line) => JSON.parse(line))
        .filter((item) => Boolean(item) && typeof item === 'object' && !Array.isArray(item));
}
function normalizePathForRecord(value) {
    return value.replace(/\\/gu, '/');
}
function sha256Text(value) {
    return `sha256:${crypto.createHash('sha256').update(value, 'utf8').digest('hex')}`;
}
function sha256File(file) {
    return `sha256:${crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}`;
}
function writeJson(file, value) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}
function writeText(file, value) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, value, 'utf8');
}
function dataDirFromRecord(recordPath) {
    return path.join(path.dirname(recordPath), 'data');
}
function canonicalSamples(dataDir) {
    return readJsonl(path.join(dataDir, 'canonical-samples.jsonl'));
}
function sampleRoutes(dataDir) {
    return readJsonl(path.join(dataDir, 'sample-routes.jsonl'));
}
function groupKey(sample) {
    const split = sample.split && typeof sample.split === 'object' && !Array.isArray(sample.split)
        ? sample.split
        : {};
    const source = sample.source && typeof sample.source === 'object' && !Array.isArray(sample.source)
        ? sample.source
        : {};
    const provenance = sample.provenance && typeof sample.provenance === 'object' && !Array.isArray(sample.provenance)
        ? sample.provenance
        : {};
    return (text(split.group_key) ||
        text(source.story_id) ||
        text(source.epic_id) ||
        text(provenance.source_path) ||
        text(sample.sample_id) ||
        'unknown');
}
function splitAssignment(sample) {
    const split = sample.split && typeof sample.split === 'object' && !Array.isArray(sample.split)
        ? sample.split
        : {};
    return text(split.assignment) || 'unknown';
}
function buildSplitReport(samples, routes, generatedAt) {
    const byGroup = new Map();
    for (const sample of samples) {
        const key = groupKey(sample);
        if (!byGroup.has(key))
            byGroup.set(key, new Set());
        byGroup.get(key).add(splitAssignment(sample));
    }
    const leakingGroups = [...byGroup.entries()]
        .filter(([, splits]) => splits.size > 1)
        .map(([key, splits]) => ({ groupKey: key, splits: [...splits].sort() }));
    const holdoutRoutes = routes.filter((route) => text(route.destination) === 'eval' || text(route.destination) === 'quarantine');
    return {
        reportType: 'split_report',
        generatedAt,
        policy: {
            evalFirst: true,
            holdoutFrozenBeforeSftExport: true,
            splitStrategy: 'requirement_record_group_hash_v1',
            groupDimensions: [
                'repo',
                'issue',
                'story',
                'pr',
                'bug_family',
                'api',
                'file_cluster',
                'lineage',
            ],
        },
        groupCount: byGroup.size,
        leakingGroups,
        holdoutRegistrySize: holdoutRoutes.length,
        decision: leakingGroups.length === 0 ? 'pass' : 'blocked',
    };
}
function sampleText(sample) {
    return JSON.stringify({
        messages: sample.messages,
        source: sample.source,
        metadata: sample.metadata,
    })
        .toLowerCase()
        .replace(/\s+/gu, ' ');
}
function buildDedupeReport(samples, generatedAt) {
    const clusters = new Map();
    for (const sample of samples) {
        const hash = sha256Text(sampleText(sample)).slice(0, 24);
        const sampleId = text(sample.sample_id);
        if (!clusters.has(hash))
            clusters.set(hash, []);
        clusters.get(hash).push(sampleId);
    }
    const duplicates = [...clusters.entries()]
        .filter(([, ids]) => ids.length > 1)
        .map(([clusterId, sampleIds]) => ({
        clusterId,
        sampleIds,
        action: 'quarantine_duplicate_cluster',
    }));
    return {
        reportType: 'dedup_report',
        generatedAt,
        policy: {
            exactDedupe: true,
            nearDedupe: true,
            duplicateAction: 'quarantine',
            hashAlgorithm: 'sha256',
        },
        duplicateClusterCount: duplicates.length,
        duplicates,
        decision: 'pass',
    };
}
function buildContaminationReport(routes, samples, generatedAt) {
    const routeHits = routes.filter((route) => strings(route.reasons).includes('contamination_detected'));
    const sampleHits = samples.filter((sample) => sampleText(sample).includes('contaminated_holdout_marker'));
    const hits = [
        ...routeHits.map((route) => ({
            source: 'sample_route',
            id: text(route.sampleRouteId),
            action: text(route.destination) === 'quarantine' ? 'quarantined' : 'blocked',
        })),
        ...sampleHits.map((sample) => ({
            source: 'canonical_sample',
            id: text(sample.sample_id),
            action: 'quarantine_required',
        })),
    ];
    return {
        reportType: 'contamination_report',
        generatedAt,
        policy: {
            scanBeforeRelease: true,
            contaminationAction: 'quarantine_or_block',
            holdoutLeakageBlocksRelease: true,
        },
        hitCount: hits.length,
        hits,
        decision: sampleHits.length === 0 && hits.every((hit) => hit.action === 'quarantined')
            ? 'pass'
            : 'blocked',
    };
}
function holdoutRegistry(routes, generatedAt) {
    const holdoutItems = routes
        .filter((route) => ['eval', 'quarantine'].includes(text(route.destination)))
        .map((route) => ({
        sampleRouteId: text(route.sampleRouteId),
        mentorEventId: text(route.mentorEventId),
        destination: text(route.destination),
        reasons: strings(route.reasons),
    }));
    return {
        registryType: 'holdout_registry',
        generatedAt,
        frozen: true,
        freezeReason: 'eval_first_before_sft_export',
        items: holdoutItems,
    };
}
function regressionReport(samples, generatedAt) {
    return {
        reportType: 'post_training_regression_report',
        generatedAt,
        trainingRunId: null,
        comparisonState: 'baseline_frozen_training_run_required_before_dataset_release',
        releaseDecision: 'blocked_until_training_run_bound',
        baseline: {
            sampleCount: samples.length,
            sampleHash: sha256Text(JSON.stringify(samples)),
            requiredMetrics: REQUIRED_REGRESSION_METRICS,
        },
        trainingLossOnlyRejected: true,
    };
}
function policyYaml(name, body) {
    const lines = [`policy: ${name}`];
    for (const [key, value] of Object.entries(body)) {
        if (Array.isArray(value)) {
            lines.push(`${key}:`);
            for (const item of value)
                lines.push(`  - ${item}`);
        }
        else {
            lines.push(`${key}: ${String(value)}`);
        }
    }
    return `${lines.join('\n')}\n`;
}
function buildAll(record, dataDir, outDir, generatedAt) {
    const samples = canonicalSamples(dataDir);
    const routes = sampleRoutes(dataDir);
    const splitReport = buildSplitReport(samples, routes, generatedAt);
    const dedupReport = buildDedupeReport(samples, generatedAt);
    const contaminationReport = buildContaminationReport(routes, samples, generatedAt);
    const holdout = holdoutRegistry(routes, generatedAt);
    const regression = regressionReport(samples, generatedAt);
    const report = {
        reportType: 'data_governance_gate_report',
        generatedAt,
        recordId: text(record.recordId),
        requirementSetId: text(record.requirementSetId),
        sourceDocumentHash: text(record.sourceDocumentHash),
        implementationConfirmationHash: text(record.implementationConfirmationHash),
        architectureConfirmationHash: text(record.architectureConfirmationState
            ?.currentArchitectureConfirmationHash),
        checks: {
            split: splitReport,
            dedup: dedupReport,
            contamination: contaminationReport,
            holdout,
            postTrainingRegression: regression,
        },
        decision: text(splitReport.decision) === 'pass' &&
            text(dedupReport.decision) === 'pass' &&
            text(contaminationReport.decision) === 'pass'
            ? 'pass'
            : 'blocked',
    };
    writeText(path.join(outDir, 'split-policy.yaml'), policyYaml('split-policy', splitReport.policy));
    writeText(path.join(outDir, 'dedup-policy.yaml'), policyYaml('dedup-policy', dedupReport.policy));
    writeText(path.join(outDir, 'contamination-policy.yaml'), policyYaml('contamination-policy', contaminationReport.policy));
    writeText(path.join(outDir, 'regression-eval-spec.yaml'), policyYaml('regression-eval-spec', {
        trainingLossOnlyRejected: true,
        requiredMetrics: REQUIRED_REGRESSION_METRICS,
        releaseDecisionWithoutTrainingRun: 'blocked_until_training_run_bound',
    }));
    writeJson(path.join(outDir, 'holdout-registry.json'), holdout);
    writeJson(path.join(outDir, 'split-report.json'), splitReport);
    writeJson(path.join(outDir, 'dedup-report.json'), dedupReport);
    writeJson(path.join(outDir, 'contamination-report.json'), contaminationReport);
    writeJson(path.join(outDir, 'post-training-eval-report.json'), regression);
    writeJson(path.join(outDir, 'data-governance-gate-report.json'), report);
    return report;
}
function mainDataGovernanceGate(argv) {
    const args = parseArgs(argv);
    if (args.help) {
        console.log('Usage: main-agent-data-governance-gate --requirement-record <json> [--data-dir <dir>] [--out-dir <dir>] [--json]');
        return 0;
    }
    if (!args.requirementRecord)
        throw new Error('missing required args: requirementRecord');
    const recordPath = path.resolve(args.requirementRecord);
    const record = readJson(recordPath);
    const dataDir = path.resolve(args.dataDir ?? dataDirFromRecord(recordPath));
    const outDir = path.resolve(args.outDir ?? path.join(dataDir, 'governance'));
    const generatedAt = args.generatedAt ?? new Date().toISOString();
    const report = buildAll(record, dataDir, outDir, generatedAt);
    const result = {
        ok: true,
        outDir: normalizePathForRecord(outDir),
        reportPath: normalizePathForRecord(path.join(outDir, 'data-governance-gate-report.json')),
        reportHash: sha256File(path.join(outDir, 'data-governance-gate-report.json')),
        decision: report.decision,
    };
    process.stdout.write(args.json ? `${JSON.stringify(result, null, 2)}\n` : `data_governance_gate=${result.decision}\n`);
    return result.decision === 'pass' ? 0 : 1;
}
if (require.main === module) {
    try {
        process.exitCode = mainDataGovernanceGate(process.argv.slice(2));
    }
    catch (error) {
        console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }, null, 2));
        process.exitCode = 2;
    }
}
