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
exports.writeDatasetBundle = writeDatasetBundle;
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const exporters_1 = require("./exporters");
const validation_report_1 = require("./validation-report");
const hash_1 = require("../utils/hash");
const dataset_analytics_1 = require("./dataset-analytics");
function ensureDir(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}
function writeJsonl(filePath, rows) {
    if (rows.length === 0) {
        fs.writeFileSync(filePath, '', 'utf-8');
        return;
    }
    fs.writeFileSync(filePath, `${rows.map((row) => JSON.stringify(row)).join('\n')}\n`, 'utf-8');
}
async function writeDatasetBundle(samples, options) {
    const clusteredSamples = (0, dataset_analytics_1.assignDedupeClusters)(samples);
    const duplicateSummary = (0, dataset_analytics_1.buildDatasetDuplicateSummary)(clusteredSamples);
    const balanceSummary = (0, dataset_analytics_1.buildDatasetBalanceSummary)(clusteredSamples);
    const trainingViewSummary = (0, dataset_analytics_1.buildDatasetTrainingViewSummary)(clusteredSamples);
    const exportResult = (0, exporters_1.exportCanonicalSamples)(clusteredSamples, options.exportTarget);
    const serializedRows = [
        ...exportResult.rowsBySplit.train.map((row) => JSON.stringify(row)),
        ...exportResult.rowsBySplit.validation.map((row) => JSON.stringify(row)),
        ...exportResult.rowsBySplit.test.map((row) => JSON.stringify(row)),
    ].join('\n');
    const exportHash = `sha256:${(0, hash_1.computeStringHash)(serializedRows)}`;
    const scopeKey = JSON.stringify(options.sourceScope ?? { scope_type: 'global' });
    const bundleId = `${options.exportTarget}-${(0, hash_1.computeStringHash)(`${options.exportTarget}::${scopeKey}::${exportResult.validationReport.exported_sample_ids.join(',')}::${exportResult.validationReport.rejected_samples.map((sample) => sample.sample_id).join(',')}`).slice(0, 12)}`;
    const bundleDir = path.join(options.outputRoot, bundleId);
    ensureDir(bundleDir);
    const trainFile = `train.${options.exportTarget}.jsonl`;
    const validationFile = `validation.${options.exportTarget}.jsonl`;
    const testFile = `test.${options.exportTarget}.jsonl`;
    const manifestFile = 'manifest.json';
    const statsFile = 'stats.json';
    const validationJsonFile = 'validation-report.json';
    const validationMdFile = 'validation-report.md';
    const rejectionFile = 'rejection-report.json';
    writeJsonl(path.join(bundleDir, trainFile), exportResult.rowsBySplit.train);
    writeJsonl(path.join(bundleDir, validationFile), exportResult.rowsBySplit.validation);
    writeJsonl(path.join(bundleDir, testFile), exportResult.rowsBySplit.test);
    const manifest = {
        bundle_id: bundleId,
        bundle_version: 'v2',
        bundle_kind: 'training',
        export_target: options.exportTarget,
        created_at: new Date().toISOString(),
        canonical_schema_version: 'v1',
        exporter_version: options.exporterVersion ?? 'v1',
        generator_version: 'bundle-writer.v2',
        source_snapshot: {
            sample_count: clusteredSamples.length,
            split_seed: clusteredSamples[0]?.split.seed ?? 42,
            split_strategy: clusteredSamples[0]?.split.strategy ?? 'story_hash_v1',
        },
        ...(options.sourceScope ? { source_scope: options.sourceScope } : {}),
        export_hash: exportHash,
        filter_settings: options.filterSettings ?? {},
        split: {
            seed: samples[0]?.split.seed ?? 42,
            strategy: samples[0]?.split.strategy ?? 'story_hash_v1',
        },
        counts: {
            total_candidates: clusteredSamples.length,
            accepted: exportResult.validationReport.counts.accepted,
            rejected: exportResult.validationReport.counts.rejected,
            downgraded: exportResult.validationReport.counts.downgraded,
            blocked: samples.filter((sample) => sample.redaction.status === 'blocked').length,
            train: exportResult.validationReport.counts.train,
            validation: exportResult.validationReport.counts.validation,
            test: exportResult.validationReport.counts.test,
        },
        provider_summary: {
            provider_ids: [
                ...new Set(clusteredSamples.map((sample) => sample.source.provider_id).filter(Boolean)),
            ],
            provider_modes: [
                ...new Set(clusteredSamples.map((sample) => sample.source.provider_mode).filter(Boolean)),
            ],
        },
        redaction_summary: exportResult.validationReport.redaction_summary,
        validation_summary: {
            schema_valid: exportResult.validationReport.schema_valid,
            privacy_gate_passed: exportResult.validationReport.privacy_gate_passed,
            trace_quality_passed: exportResult.validationReport.trace_quality_passed,
            provider_compatibility_passed: exportResult.validationReport.provider_compatibility_passed,
            training_ready_passed: exportResult.validationReport.training_ready_passed,
            duplicate_cluster_count: duplicateSummary.duplicate_cluster_count,
            duplicated_sample_count: duplicateSummary.duplicated_sample_count,
            dominant_host_kind_share: balanceSummary.dominant_host_kind_share,
            dominant_provider_share: balanceSummary.dominant_provider_share,
            dominant_stage_share: balanceSummary.dominant_stage_share,
            dominant_source_scope_share: balanceSummary.dominant_source_scope_share,
            source_scope_counts: balanceSummary.by_source_scope,
            assistant_only_ready: trainingViewSummary.assistant_only_ready,
            completion_only_ready: trainingViewSummary.completion_only_ready,
            tool_calling_ready: trainingViewSummary.tool_calling_ready,
        },
        artifacts: {
            train_path: trainFile,
            validation_path: validationFile,
            test_path: testFile,
            manifest_path: manifestFile,
            validation_report_path: validationJsonFile,
            rejection_report_path: rejectionFile,
        },
    };
    const stats = {
        target: options.exportTarget,
        counts: exportResult.validationReport.counts,
        exported_sample_ids: exportResult.validationReport.exported_sample_ids,
        redaction_summary: exportResult.validationReport.redaction_summary,
    };
    fs.writeFileSync(path.join(bundleDir, manifestFile), JSON.stringify(manifest, null, 2), 'utf-8');
    fs.writeFileSync(path.join(bundleDir, statsFile), JSON.stringify(stats, null, 2), 'utf-8');
    fs.writeFileSync(path.join(bundleDir, validationJsonFile), JSON.stringify(exportResult.validationReport, null, 2), 'utf-8');
    fs.writeFileSync(path.join(bundleDir, validationMdFile), (0, validation_report_1.renderValidationReportMarkdown)(exportResult.validationReport), 'utf-8');
    fs.writeFileSync(path.join(bundleDir, rejectionFile), JSON.stringify({ rejected_samples: exportResult.validationReport.rejected_samples }, null, 2), 'utf-8');
    return {
        bundleDir,
        manifest,
    };
}
