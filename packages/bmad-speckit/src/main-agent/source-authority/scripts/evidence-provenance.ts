import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export interface EvidenceProvenance {
  runId: string;
  storyKey: string;
  evidenceBundleId: string;
  contractHash?: string;
  gateReportHash?: string;
}

export function normalizeEvidenceText(value: string | null | undefined): string {
  return (value ?? '').trim();
}

export function sha256(value: string | Buffer): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function sha256FileIfExists(filePath: string): string | undefined {
  if (!fs.existsSync(filePath)) return undefined;
  return sha256(fs.readFileSync(filePath));
}

export function defaultEvidenceRunId(prefix = 'main-agent-run'): string {
  return `${prefix}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
}

export function defaultEvidenceBundleId(runId: string): string {
  return `${runId}:bundle`;
}

export function buildEvidenceProvenance(input: {
  root?: string;
  runId?: string | null;
  storyKey?: string | null;
  evidenceBundleId?: string | null;
  gateReportHash?: string | null;
  prefix?: string;
}): EvidenceProvenance {
  const root = path.resolve(input.root ?? process.cwd());
  const runId = normalizeEvidenceText(input.runId) || defaultEvidenceRunId(input.prefix);
  const storyKey = normalizeEvidenceText(input.storyKey) || 'S-release-gate';
  const evidenceBundleId =
    normalizeEvidenceText(input.evidenceBundleId) || defaultEvidenceBundleId(runId);
  const contractHash = sha256FileIfExists(
    path.join(root, '_bmad', '_config', 'orchestration-governance.contract.yaml')
  );
  return {
    runId,
    storyKey,
    evidenceBundleId,
    ...(contractHash ? { contractHash } : {}),
    ...(normalizeEvidenceText(input.gateReportHash)
      ? { gateReportHash: normalizeEvidenceText(input.gateReportHash) }
      : {}),
  };
}

export function sameRunSummary(expected: EvidenceProvenance): string {
  return `runId=${expected.runId}, storyKey=${expected.storyKey}, evidenceBundleId=${expected.evidenceBundleId}`;
}
