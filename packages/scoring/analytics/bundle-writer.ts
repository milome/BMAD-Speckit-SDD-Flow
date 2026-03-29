import * as fs from 'node:fs';
import * as path from 'node:path';
import { exportCanonicalSamples } from './exporters';
import type { DatasetBundleManifest, CanonicalSftSample } from './types';
import {
  renderValidationReportMarkdown,
  type DatasetExportTarget,
} from './validation-report';
import { computeStringHash } from '../utils/hash';

export interface WriteDatasetBundleOptions {
  exportTarget: DatasetExportTarget;
  outputRoot: string;
  exporterVersion?: string;
  filterSettings?: DatasetBundleManifest['filter_settings'];
}

export interface DatasetBundleWriteResult {
  bundleDir: string;
  manifest: DatasetBundleManifest;
}

function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function writeJsonl(filePath: string, rows: unknown[]): void {
  if (rows.length === 0) {
    fs.writeFileSync(filePath, '', 'utf-8');
    return;
  }
  fs.writeFileSync(filePath, `${rows.map((row) => JSON.stringify(row)).join('\n')}\n`, 'utf-8');
}

export async function writeDatasetBundle(
  samples: CanonicalSftSample[],
  options: WriteDatasetBundleOptions
): Promise<DatasetBundleWriteResult> {
  const exportResult = exportCanonicalSamples(samples, options.exportTarget);
  const serializedRows = [
    ...exportResult.rowsBySplit.train.map((row) => JSON.stringify(row)),
    ...exportResult.rowsBySplit.validation.map((row) => JSON.stringify(row)),
    ...exportResult.rowsBySplit.test.map((row) => JSON.stringify(row)),
  ].join('\n');
  const exportHash = `sha256:${computeStringHash(serializedRows)}`;
  const bundleId = `${options.exportTarget}-${computeStringHash(
    `${options.exportTarget}::${exportResult.validationReport.exported_sample_ids.join(',')}::${exportResult.validationReport.rejected_samples.map((sample) => sample.sample_id).join(',')}`
  ).slice(0, 12)}`;

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

  const manifest: DatasetBundleManifest = {
    bundle_id: bundleId,
    export_target: options.exportTarget,
    created_at: new Date().toISOString(),
    canonical_schema_version: 'v1',
    exporter_version: options.exporterVersion ?? 'v1',
    export_hash: exportHash,
    filter_settings: options.filterSettings ?? {},
    split: {
      seed: samples[0]?.split.seed ?? 42,
      strategy: samples[0]?.split.strategy ?? 'story_hash_v1',
    },
    counts: {
      accepted: exportResult.validationReport.counts.accepted,
      rejected: exportResult.validationReport.counts.rejected,
      train: exportResult.validationReport.counts.train,
      validation: exportResult.validationReport.counts.validation,
      test: exportResult.validationReport.counts.test,
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
  };

  fs.writeFileSync(path.join(bundleDir, manifestFile), JSON.stringify(manifest, null, 2), 'utf-8');
  fs.writeFileSync(path.join(bundleDir, statsFile), JSON.stringify(stats, null, 2), 'utf-8');
  fs.writeFileSync(
    path.join(bundleDir, validationJsonFile),
    JSON.stringify(exportResult.validationReport, null, 2),
    'utf-8'
  );
  fs.writeFileSync(
    path.join(bundleDir, validationMdFile),
    renderValidationReportMarkdown(exportResult.validationReport),
    'utf-8'
  );
  fs.writeFileSync(
    path.join(bundleDir, rejectionFile),
    JSON.stringify({ rejected_samples: exportResult.validationReport.rejected_samples }, null, 2),
    'utf-8'
  );

  return {
    bundleDir,
    manifest,
  };
}
