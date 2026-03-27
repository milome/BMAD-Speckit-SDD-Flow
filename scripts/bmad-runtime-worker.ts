import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  createGovernanceProviderAdapterFromConfig,
  readGovernanceRemediationConfig,
} from './governance-remediation-config';
import {
  createGovernanceExecutorPacket,
  runGovernanceRemediation,
  writeGovernanceExecutorPacket,
} from './governance-remediation-runner';
import {
  appendGovernanceCurrentRun,
  ensureGovernanceQueueDirs,
  governanceCurrentRunPath,
  governanceDoneQueueFilePath,
  governanceFailedQueueFilePath,
  governancePendingQueueFilePath,
  governanceProcessingQueueFilePath,
  type GovernanceRuntimeQueueItem,
} from './governance-runtime-queue';

const LEGACY_QUEUE_DIR = path.join('.claude', 'state', 'runtime', 'queue');

interface LegacyQueueItem {
  id: string;
  type: string;
  payload: unknown;
  timestamp: string;
}

interface GovernanceRemediationRerunPayload {
  projectRoot?: string;
  configPath?: string;
  runnerInput?: Parameters<typeof runGovernanceRemediation>[0];
}

function legacyCurrentRunPath(projectRoot: string): string {
  return path.join(projectRoot, '.claude', 'state', 'runtime', 'current-run.json');
}

function ensureLegacyQueueDirs(projectRoot: string): void {
  for (const bucket of ['pending', 'processing', 'done', 'failed'] as const) {
    fs.mkdirSync(path.join(projectRoot, LEGACY_QUEUE_DIR, bucket), { recursive: true });
  }
}

function readQueueFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) {
    return [];
  }
  return fs
    .readdirSync(dir)
    .filter((file) => file.endsWith('.json'))
    .sort((left, right) => left.localeCompare(right));
}

function appendLegacyCurrentRun(projectRoot: string, item: LegacyQueueItem): void {
  const currentRunFile = legacyCurrentRunPath(projectRoot);
  const existing = fs.existsSync(currentRunFile)
    ? (JSON.parse(fs.readFileSync(currentRunFile, 'utf8')) as LegacyQueueItem[])
    : [];
  existing.push(item);
  fs.mkdirSync(path.dirname(currentRunFile), { recursive: true });
  fs.writeFileSync(currentRunFile, JSON.stringify(existing, null, 2) + '\n', 'utf8');
}

function processLegacyEvent(projectRoot: string, item: LegacyQueueItem): void {
  appendLegacyCurrentRun(projectRoot, item);
}

async function processLegacyQueue(projectRoot: string): Promise<void> {
  ensureLegacyQueueDirs(projectRoot);

  const pendingDir = path.join(projectRoot, LEGACY_QUEUE_DIR, 'pending');
  const processingDir = path.join(projectRoot, LEGACY_QUEUE_DIR, 'processing');
  const doneDir = path.join(projectRoot, LEGACY_QUEUE_DIR, 'done');
  const failedDir = path.join(projectRoot, LEGACY_QUEUE_DIR, 'failed');

  for (const file of readQueueFiles(pendingDir)) {
    const itemPath = path.join(pendingDir, file);
    const processingPath = path.join(processingDir, file);

    fs.renameSync(itemPath, processingPath);

    try {
      const item = JSON.parse(fs.readFileSync(processingPath, 'utf8')) as LegacyQueueItem;
      processLegacyEvent(projectRoot, item);
      fs.renameSync(processingPath, path.join(doneDir, file));
    } catch {
      fs.renameSync(processingPath, path.join(failedDir, file));
    }
  }
}

async function processGovernanceRerunEvent(
  queueProjectRoot: string,
  item: GovernanceRuntimeQueueItem<GovernanceRemediationRerunPayload>
): Promise<GovernanceRuntimeQueueItem<GovernanceRemediationRerunPayload>> {
  const payload = item.payload ?? {};
  const runnerProjectRoot = payload.projectRoot ?? queueProjectRoot;
  const config = readGovernanceRemediationConfig(runnerProjectRoot, payload.configPath);
  const providerAdapter = createGovernanceProviderAdapterFromConfig(config);
  const runnerInput = payload.runnerInput;

  if (!runnerInput) {
    throw new Error('governance-remediation-rerun queue item missing payload.runnerInput');
  }

  const result = await runGovernanceRemediation({
    ...runnerInput,
    projectRoot: runnerProjectRoot,
    hostKind: config.primaryHost,
    providerAdapter,
  });

  const packetPaths: Record<string, string> = {};
  if (result.artifactPath && result.artifactResult) {
    for (const hostKind of config.packetHosts) {
      const packet = createGovernanceExecutorPacket({
        hostKind,
        runtimeContext: result.runtimeContext,
        runtimePolicy: result.runtimePolicy,
        loopState: result.loopState,
        currentAttemptNumber: result.currentAttemptNumber ?? result.loopState.attemptCount,
        rerunGate: result.loopState.rerunGate,
        artifactMarkdown: result.artifactResult.markdown,
      });
      packetPaths[hostKind] = writeGovernanceExecutorPacket(result.artifactPath, packet);
    }
  }

  const finalizedItem: GovernanceRuntimeQueueItem<GovernanceRemediationRerunPayload> = {
    ...item,
    processedAt: new Date().toISOString(),
    result: {
      artifactPath: result.artifactPath,
      packetPaths,
      shouldContinue: result.shouldContinue,
      stopReason: result.stopReason,
      currentAttemptNumber: result.currentAttemptNumber,
      nextAttemptNumber: result.nextAttemptNumber,
      loopStateId: result.loopState.loopStateId,
      rerunGateResultIngested: result.rerunGateResultIngested,
    },
  };

  appendGovernanceCurrentRun(queueProjectRoot, finalizedItem);
  return finalizedItem;
}

async function processGovernanceEvent(
  queueProjectRoot: string,
  item: GovernanceRuntimeQueueItem<GovernanceRemediationRerunPayload>
): Promise<GovernanceRuntimeQueueItem<GovernanceRemediationRerunPayload>> {
  if (item.type === 'governance-remediation-rerun') {
    return processGovernanceRerunEvent(queueProjectRoot, item);
  }

  const passthroughItem: GovernanceRuntimeQueueItem<GovernanceRemediationRerunPayload> = {
    ...item,
    processedAt: new Date().toISOString(),
  };
  appendGovernanceCurrentRun(queueProjectRoot, passthroughItem);
  return passthroughItem;
}

async function processGovernanceQueue(projectRoot: string): Promise<void> {
  ensureGovernanceQueueDirs(projectRoot);

  const pendingDir = path.dirname(governancePendingQueueFilePath(projectRoot, 'queue-probe'));

  for (const file of readQueueFiles(pendingDir)) {
    const itemPath = path.join(pendingDir, file);
    const itemId = path.basename(file, '.json');
    const processingPath = governanceProcessingQueueFilePath(projectRoot, itemId);

    fs.renameSync(itemPath, processingPath);

    try {
      const item = JSON.parse(
        fs.readFileSync(processingPath, 'utf8')
      ) as GovernanceRuntimeQueueItem<GovernanceRemediationRerunPayload>;

      await processGovernanceEvent(projectRoot, item);
      fs.renameSync(processingPath, governanceDoneQueueFilePath(projectRoot, itemId));
    } catch (error) {
      try {
        const failedItem = JSON.parse(
          fs.readFileSync(processingPath, 'utf8')
        ) as GovernanceRuntimeQueueItem<GovernanceRemediationRerunPayload>;
        failedItem.processedAt = new Date().toISOString();
        failedItem.error = error instanceof Error ? error.message : String(error);
        fs.writeFileSync(processingPath, JSON.stringify(failedItem, null, 2) + '\n', 'utf8');
      } catch {
        // Keep the original queue file if it cannot be re-read or re-written.
      }

      fs.renameSync(processingPath, governanceFailedQueueFilePath(projectRoot, itemId));
    }
  }
}

export { governanceCurrentRunPath };

export async function processQueue(projectRoot: string = process.cwd()): Promise<void> {
  await processGovernanceQueue(projectRoot);
  await processLegacyQueue(projectRoot);
}

if (require.main === module) {
  void processQueue();
}
