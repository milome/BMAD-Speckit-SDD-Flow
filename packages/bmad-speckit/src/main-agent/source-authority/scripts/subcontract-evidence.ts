import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  hashControlPlaneValue,
  stableControlPlaneStringify,
} from '../../../utils/goal-contract/control-plane/canonical-hash';
import { validateGoalContractSchema } from '../../../utils/goal-contract/control-plane/schema-registry';
import { projectGovernedGoalExecutionTaskReport } from './main-agent-governed-goal-integration';

type JsonRecord = Record<string, unknown>;

export interface PublishedGoalArtifact {
  absolutePath: string;
  projectRelativePath: string;
  outRootRelativePath: string;
  hash: string;
}

function canonicalBytes(value: unknown): Buffer {
  return Buffer.from(`${stableControlPlaneStringify(value)}\n`, 'utf8');
}

function normalizedRelative(root: string, target: string): string {
  const relative = path.relative(path.resolve(root), path.resolve(target)).replace(/\\/gu, '/');
  if (!relative || relative === '..' || relative.startsWith('../') || path.isAbsolute(relative)) {
    throw new Error('goal_execution_artifact_path_invalid');
  }
  return relative;
}

function assertPhysicalConfinement(root: string, target: string): void {
  const resolvedRoot = path.resolve(root);
  const resolvedTarget = path.resolve(target);
  const relative = normalizedRelative(resolvedRoot, resolvedTarget);
  try {
    const rootStat = fs.lstatSync(resolvedRoot);
    if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) {
      throw new Error('invalid');
    }
    const realRoot = fs.realpathSync.native(resolvedRoot);
    let current = resolvedRoot;
    for (const segment of relative.split('/')) {
      current = path.join(current, segment);
      if (!fs.existsSync(current)) break;
      const stat = fs.lstatSync(current);
      if (stat.isSymbolicLink()) throw new Error('invalid');
      const realCurrent = fs.realpathSync.native(current);
      if (realCurrent !== realRoot && !realCurrent.startsWith(`${realRoot}${path.sep}`)) {
        throw new Error('invalid');
      }
    }
  } catch {
    throw new Error('goal_execution_artifact_path_invalid');
  }
}

function publishImmutable(input: {
  projectRoot: string;
  outRoot: string;
  targetPath: string;
  bytes: Buffer;
  hash: string;
}): PublishedGoalArtifact {
  const targetPath = path.resolve(input.targetPath);
  normalizedRelative(input.outRoot, targetPath);
  assertPhysicalConfinement(input.outRoot, targetPath);
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  assertPhysicalConfinement(input.outRoot, targetPath);
  if (fs.existsSync(targetPath)) {
    const stat = fs.lstatSync(targetPath);
    if (!stat.isFile() || stat.isSymbolicLink()) {
      throw new Error('goal_execution_artifact_path_invalid');
    }
    if (!fs.readFileSync(targetPath).equals(input.bytes)) {
      throw new Error('goal_execution_immutable_artifact_conflict');
    }
  } else {
    const descriptor = fs.openSync(targetPath, 'wx');
    try {
      assertPhysicalConfinement(input.outRoot, targetPath);
      const descriptorStat = fs.fstatSync(descriptor);
      const targetStat = fs.lstatSync(targetPath);
      if (
        !targetStat.isFile() ||
        targetStat.isSymbolicLink() ||
        descriptorStat.dev !== targetStat.dev ||
        descriptorStat.ino !== targetStat.ino
      ) {
        throw new Error('goal_execution_artifact_path_invalid');
      }
      fs.writeFileSync(descriptor, input.bytes);
      fs.fsyncSync(descriptor);
    } finally {
      fs.closeSync(descriptor);
    }
  }
  if (!fs.readFileSync(targetPath).equals(input.bytes)) {
    throw new Error('goal_execution_immutable_artifact_invalid');
  }
  return Object.freeze({
    absolutePath: targetPath,
    projectRelativePath: normalizedRelative(input.projectRoot, targetPath),
    outRootRelativePath: normalizedRelative(input.outRoot, targetPath),
    hash: input.hash,
  });
}

function publishCanonicalRecord(input: {
  projectRoot: string;
  outRoot: string;
  targetPath: string;
  schemaName: string;
  hashField: string;
  payload: JsonRecord;
}): PublishedGoalArtifact & { record: JsonRecord } {
  const record = {
    ...input.payload,
    [input.hashField]: hashControlPlaneValue(input.payload),
  };
  validateGoalContractSchema(input.schemaName, record);
  const published = publishImmutable({
    ...input,
    bytes: canonicalBytes(record),
    hash: String(record[input.hashField]),
  });
  return Object.freeze({ ...published, record: Object.freeze(record) });
}

export function publishGoalExecutionObservedEvidence(input: {
  projectRoot: string;
  outRoot: string;
  attemptRoot: string;
  authorityFileId: string;
  payload: JsonRecord;
}) {
  return publishCanonicalRecord({
    projectRoot: input.projectRoot,
    outRoot: input.outRoot,
    targetPath: path.join(input.attemptRoot, 'evidence', `${input.authorityFileId}.json`),
    schemaName: 'goal-execution-observed-evidence.schema.json',
    hashField: 'evidenceHash',
    payload: input.payload,
  });
}

export function publishGoalExecutionAuthorityClosure(input: {
  projectRoot: string;
  outRoot: string;
  attemptRoot: string;
  authorityFileId: string;
  payload: JsonRecord;
}) {
  return publishCanonicalRecord({
    projectRoot: input.projectRoot,
    outRoot: input.outRoot,
    targetPath: path.join(input.attemptRoot, 'closures', `${input.authorityFileId}.json`),
    schemaName: 'goal-execution-authority-closure.schema.json',
    hashField: 'closureHash',
    payload: input.payload,
  });
}

export function publishGoalExecutionCampaignClosure(input: {
  projectRoot: string;
  outRoot: string;
  attemptRoot: string;
  payload: JsonRecord;
}) {
  return publishCanonicalRecord({
    projectRoot: input.projectRoot,
    outRoot: input.outRoot,
    targetPath: path.join(input.attemptRoot, 'campaign-closure.json'),
    schemaName: 'goal-execution-campaign-closure.schema.json',
    hashField: 'campaignClosureHash',
    payload: input.payload,
  });
}

export function publishGoalExecutionProjections(input: {
  projectRoot: string;
  outRoot: string;
  attemptRoot: string;
  campaignClosureRef: string;
  campaignClosureHash: string;
  packageManifestHash: string;
  goalId: string;
  candidateRunId: string;
  filesChanged: string[];
  validationsRun: string[];
  evidence: string[];
  closedAuthorities: Array<{ executionAuthorityId: string; closureHash: string }>;
}): Array<{ role: string; artifactRef: string; artifactHash: string }> {
  const publishProjection = (entry: { role: string; fileName: string; bytes: Buffer }) => {
    const artifactHash = `sha256:${createHash('sha256').update(entry.bytes).digest('hex')}`;
    const published = publishImmutable({
      projectRoot: input.projectRoot,
      outRoot: input.outRoot,
      targetPath: path.join(input.attemptRoot, 'projections', entry.fileName),
      bytes: entry.bytes,
      hash: artifactHash,
    });
    return Object.freeze({
      role: entry.role,
      artifactRef: published.projectRelativePath,
      artifactHash,
    });
  };
  const campaignReport = publishProjection({
    role: 'campaign_report',
    fileName: 'campaign-report.md',
    bytes: Buffer.from(
      `# Goal Execution Campaign\n\nGoal: ${input.goalId}\nCandidate run: ${input.candidateRunId}\nCampaign closure: ${input.campaignClosureHash}\n`,
      'utf8'
    ),
  });
  const finalExecution = publishProjection({
    role: 'final_execution_projection',
    fileName: 'final-execution.md',
    bytes: Buffer.from(
      `# Final Execution Projection\n\nStatus: pre-final-review\nCampaign closure: ${input.campaignClosureHash}\n`,
      'utf8'
    ),
  });
  const taskReportRecord = projectGovernedGoalExecutionTaskReport({
    packetId: input.goalId,
    packageManifestHash: input.packageManifestHash,
    campaignClosureHash: input.campaignClosureHash,
    closedAuthorities: input.closedAuthorities,
    filesChanged: input.filesChanged,
    validationsRun: input.validationsRun,
    evidence: input.evidence,
    downstreamContext: [
      `candidateRunId=${input.candidateRunId}`,
      `campaignClosureRef=${input.campaignClosureRef}`,
      `campaignClosureHash=${input.campaignClosureHash}`,
      'state=pre-final-review',
    ],
  });
  const taskReport = publishProjection({
    role: 'task_report',
    fileName: 'TaskReport.json',
    bytes: canonicalBytes(taskReportRecord),
  });
  const handoff = publishProjection({
    role: 'main_agent_handoff',
    fileName: 'main-agent-handoff.json',
    bytes: canonicalBytes({
      schemaVersion: 'MainAgentGoalExecutionHandoff/v1',
      state: 'pre-final-review',
      goalId: input.goalId,
      candidateRunId: input.candidateRunId,
      campaignClosureRef: input.campaignClosureRef,
      campaignClosureHash: input.campaignClosureHash,
      taskReportRef: {
        path: taskReport.artifactRef,
        hash: taskReport.artifactHash,
      },
    }),
  });
  return [campaignReport, finalExecution, taskReport, handoff];
}
