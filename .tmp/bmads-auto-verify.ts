import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  buildProductDesignContractIndex,
  buildRuntimeProtocolContractIndex,
  validateContractIndex,
  type ContractIndexEntry,
} from './bmads-auto-contract-index';
import { releaseBlockedByGaps, type GapRegistry } from './bmads-auto-gaps';
import {
  validateFixtureRegistry,
  validateTraceabilityCoverage,
  type FixtureRegistryEntry,
  type TraceabilityRow,
} from './bmads-auto-traceability';

export interface VerifyReport {
  schemaVersion: 'bmads_auto_verify_report/v1';
  command: 'verify-design' | 'verify-run';
  runId: string;
  against: string;
  contractIndexHash: string;
  checkedContracts: string[];
  missingContracts: string[];
  failedContracts: Array<{ contractId: string; blockers: string[] }>;
  blockingGaps: string[];
  repairTargets: Array<{ target: string; reason: string }>;
  resultCode: 'OK' | 'BLOCKED_VERIFY_DESIGN' | 'BLOCKED_VERIFY_RUN';
  completionAllowed: boolean;
  deliveryTruthReportPath: string;
  blockers: string[];
}

function hashText(value: string): string {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

function normalizeDesignText(text: string): string {
  return text.replace(/\r\n/g, '\n');
}

function hasAll(text: string, values: string[]): string[] {
  return values.filter((value) => !text.includes(value));
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function isNonEmptyText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function addFailure(
  failures: Array<{ contractId: string; blockers: string[] }>,
  contractId: string,
  blockers: string[]
): void {
  if (blockers.length === 0) return;
  const existing = failures.find((item) => item.contractId === contractId);
  if (existing) existing.blockers = unique([...existing.blockers, ...blockers]);
  else failures.push({ contractId, blockers: unique(blockers) });
}

function validateRunSpecificContracts(contracts: ContractIndexEntry[]): string[] {
  const blockers: string[] = [];
  const seen = new Set<string>();
  for (const contract of contracts) {
    if (!isNonEmptyText(contract.contractId)) blockers.push('contractId:missing');
    if (seen.has(contract.contractId)) blockers.push(`${contract.contractId}:duplicate`);
    seen.add(contract.contractId);
    if (contract.requirementRefs.length === 0) blockers.push(`${contract.contractId}:requirementRefs`);
    if (contract.runtimeArtifacts.length === 0) blockers.push(`${contract.contractId}:runtimeArtifacts`);
    if (contract.blockingResultCodes.length === 0) blockers.push(`${contract.contractId}:blockingResultCodes`);
    if (contract.implementationTargets.length === 0 || !contract.implementationTargets.every(isNonEmptyText)) {
      blockers.push(`${contract.contractId}:implementationTargets`);
    }
    if (contract.testTargets.length === 0 || !contract.testTargets.every(isNonEmptyText)) {
      blockers.push(`${contract.contractId}:testTargets`);
    }
    if (!contract.verifyResponsibilities?.verifyRun) blockers.push(`${contract.contractId}:verifyRun`);
  }
  return blockers;
}

function extractTableRefs(text: string, prefix: 'REQ' | 'E2E' | 'G'): string[] {
  const pattern =
    prefix === 'REQ'
      ? /`(REQ-\d{3}(?:\.\d+)?|REQ-VERIFY-\d{3})`/g
      : prefix === 'E2E'
        ? /`(E2E-\d+(?:-[^`|]+)?)`/g
        : /`(G\d+)`/g;
  return unique([...text.matchAll(pattern)].map((match) => match[1]));
}

function extractRequirementRows(text: string): Array<{ requirementId: string; fixtureRefs: string[] }> {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /^\| `(?:REQ-\d{3}(?:\.\d+)?|REQ-VERIFY-\d{3})` \|/.test(line))
    .map((line) => {
      const cells = line
        .split('|')
        .slice(1, -1)
        .map((cell) => cell.trim());
      return {
        requirementId: (cells[0] ?? '').replace(/`/g, ''),
        fixtureRefs: extractTableRefs(cells[2] ?? '', 'E2E').map((ref) => ref.split('-').slice(0, 2).join('-')),
      };
    });
}

function extractFixtureRows(text: string): Array<{ fixtureId: string; requirementRefs: string[]; gapRefs: string[] }> {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /^\| `E2E-\d+/.test(line))
    .flatMap((line) => {
      const cells = line
        .split('|')
        .slice(1, -1)
        .map((cell) => cell.trim());
      const requirementRefs = extractTableRefs(cells[1] ?? '', 'REQ');
      const gapRefs = extractTableRefs(cells[2] ?? '', 'G');
      if (requirementRefs.length === 0 && gapRefs.length === 0) return [];
      return [{
        fixtureId: (cells[0] ?? '').replace(/`/g, ''),
        requirementRefs,
        gapRefs,
      }];
    });
}

function extractFixtureCatalogIds(text: string): string[] {
  return unique(
    text
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => /^\| `E2E-\d+/.test(line))
      .map((line) => line.split('|').slice(1, -1)[0]?.trim().replace(/`/g, '') ?? '')
      .filter(Boolean)
  );
}

function fixtureMatches(ref: string, fixtureId: string): boolean {
  return fixtureId === ref || fixtureId.startsWith(`${ref}-`);
}

function extractOpenDesignGaps(text: string): Array<{
  gapId: string;
  status: string;
  repairTarget: string;
}> {
  const blockingStatuses = new Set(['missing', 'partial', 'needs e2e', 'needs implementation']);
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /^\| G\d+ \|/.test(line))
    .flatMap((line) => {
      const cells = line
        .split('|')
        .slice(1, -1)
        .map((cell) => cell.trim());
      const gapId = cells[0] ?? '';
      const status = cells[3] ?? '';
      const repairTarget = cells[6] ?? '';
      return blockingStatuses.has(status.toLowerCase()) ? [{ gapId, status, repairTarget }] : [];
    });
}

const requiredSequenceSteps = [
  'run integration audit',
  'verify PR topology closed',
  'verify gap registry, traceability, risk register, open questions, drift, and lease release',
  'run release gate',
  'run sprint-status dry-run authorization and audit',
  'run delivery truth gate',
  'perform authorized terminal sprint-status update',
  'write completion-receipt.json',
];

const requiredCloseoutBlockers = [
  'severity=blocker',
  'severity=high',
  'priority=P0',
  'priority=P1',
  'activeChangeControl != none',
  'invalidatedArtifacts',
  'traceability status `missing`, `planned`, or `invalidated`',
  'DriftDetector',
  'contract-index',
  'verify-design',
  'verify-run',
  'Integration audit fails',
  'Sprint-status authorization',
];

function contractIndexHash(contracts: ContractIndexEntry[]): string {
  return hashText(JSON.stringify(contracts));
}

function makeReport(input: {
  command: 'verify-design' | 'verify-run';
  runId?: string;
  against: string;
  contracts: ContractIndexEntry[];
  missingContracts?: string[];
  failedContracts?: Array<{ contractId: string; blockers: string[] }>;
  blockingGaps?: string[];
  repairTargets?: Array<{ target: string; reason: string }>;
  deliveryTruthReportPath?: string;
}): VerifyReport {
  const blockers = [
    ...(input.missingContracts ?? []).map((contractId) => `${contractId}:missing`),
    ...(input.failedContracts ?? []).flatMap((item) => item.blockers.map((blocker) => `${item.contractId}:${blocker}`)),
    ...(input.blockingGaps ?? []),
  ];
  return {
    schemaVersion: 'bmads_auto_verify_report/v1',
    command: input.command,
    runId: input.runId ?? '',
    against: input.against,
    contractIndexHash: contractIndexHash(input.contracts),
    checkedContracts: input.contracts.map((contract) => contract.contractId),
    missingContracts: input.missingContracts ?? [],
    failedContracts: input.failedContracts ?? [],
    blockingGaps: input.blockingGaps ?? [],
    repairTargets: input.repairTargets ?? [],
    resultCode: blockers.length === 0 ? 'OK' : input.command === 'verify-design' ? 'BLOCKED_VERIFY_DESIGN' : 'BLOCKED_VERIFY_RUN',
    completionAllowed: blockers.length === 0,
    deliveryTruthReportPath: input.deliveryTruthReportPath ?? '',
    blockers,
  };
}

export function verifyDesign(againstPath: string): VerifyReport {
  const contracts = buildProductDesignContractIndex();
  const indexValidation = validateContractIndex(contracts);
  const failedContracts: Array<{ contractId: string; blockers: string[] }> = [];
  const repairTargets: Array<{ target: string; reason: string }> = [];
  const blockingGaps: string[] = [];

  if (indexValidation.resultCode !== 'OK') {
    failedContracts.push({ contractId: 'CONTRACT-INDEX', blockers: indexValidation.blockers });
  }
  if (!fs.existsSync(againstPath)) {
    return makeReport({
      command: 'verify-design',
      against: againstPath,
      contracts,
      failedContracts: [{ contractId: 'CONTRACT-CLI-API', blockers: ['BLOCKED_DESIGN_DOC_MISSING'] }],
      repairTargets: [{ target: againstPath, reason: 'authoritative design document is missing' }],
    });
  }

  const text = normalizeDesignText(fs.readFileSync(againstPath, 'utf8'));
  const requiredTokens = [
    'REQ-026',
    'REQ-027',
    'REQ-VERIFY-001',
    'REQ-VERIFY-002',
    'REQ-VERIFY-003',
    'G54',
    'G55',
    'E2E-29',
    'E2E-30',
    'completionAllowed',
    'bmads-auto contract-index',
    'bmads-auto verify-design',
    'bmads-auto verify-run',
  ];
  for (const missing of hasAll(text, requiredTokens)) {
    blockingGaps.push(`${missing}:missing_in_design`);
    repairTargets.push({ target: againstPath, reason: `add or repair ${missing} coverage` });
  }
  for (const gap of extractOpenDesignGaps(text)) {
    blockingGaps.push(`${gap.gapId}:${gap.status}`);
    repairTargets.push({
      target: gap.repairTarget || againstPath,
      reason: `${gap.gapId} remains ${gap.status} in the authoritative gaps matrix`,
    });
  }
  for (const contract of contracts) {
    const missingRefs = hasAll(text, [contract.contractId, ...contract.requirementRefs, ...contract.fixtureRefs]);
    if (missingRefs.length > 0) {
      failedContracts.push({
        contractId: contract.contractId,
        blockers: missingRefs.map((ref) => `${ref}:missing_in_design`),
      });
      repairTargets.push({
        target: contract.implementationTargets[0],
        reason: `${contract.contractId} is not fully traceable from design refs`,
      });
    }
  }

  const requirementRows = extractRequirementRows(text);
  const fixtureRows = extractFixtureRows(text);
  const fixtureCatalogIds = extractFixtureCatalogIds(text);
  const requirementIds = requirementRows.map((row) => row.requirementId);
  const fixtureIds = fixtureRows.map((row) => row.fixtureId);
  if (requirementRows.length === 0) {
    addFailure(failedContracts, 'CONTRACT-TRACEABILITY', ['BLOCKED_DESIGN_REQ_TABLE_MISSING']);
    repairTargets.push({ target: againstPath, reason: 'Section 20 must enumerate REQ-* acceptance rows' });
  }
  if (fixtureRows.length === 0) {
    addFailure(failedContracts, 'CONTRACT-FIXTURE-REGISTRY', ['BLOCKED_DESIGN_E2E_TABLE_MISSING']);
    repairTargets.push({ target: againstPath, reason: 'Section 22.1 must enumerate E2E-* fixture mappings' });
  }
  const fixtureRowIds = new Set([...fixtureIds, ...fixtureCatalogIds]);
  const missingFixtureRows = unique(requirementRows.flatMap((row) => row.fixtureRefs)).filter(
    (fixtureId) => ![...fixtureRowIds].some((knownFixtureId) => fixtureMatches(fixtureId, knownFixtureId))
  );
  if (missingFixtureRows.length > 0) {
    addFailure(
      failedContracts,
      'CONTRACT-FIXTURE-REGISTRY',
      missingFixtureRows.map((fixtureId) => `${fixtureId}:missing_fixture_row`)
    );
  }
  const requirementRowIds = new Set(requirementIds);
  const orphanFixtures = fixtureRows.filter(
    (fixture) =>
      fixture.requirementRefs.length === 0 ||
      fixture.requirementRefs.some((requirementId) => !requirementRowIds.has(requirementId))
  );
  if (orphanFixtures.length > 0) {
    addFailure(
      failedContracts,
      'CONTRACT-FIXTURE-REGISTRY',
      orphanFixtures.map((fixture) => `${fixture.fixtureId}:orphan_or_unknown_requirement`)
    );
  }
  const missingSequenceSteps = requiredSequenceSteps.filter((step) => !text.includes(step));
  if (missingSequenceSteps.length > 0) {
    addFailure(
      failedContracts,
      'CONTRACT-FINAL-CLOSEOUT',
      missingSequenceSteps.map((step) => `sequence_step_missing:${step}`)
    );
    repairTargets.push({ target: againstPath, reason: 'final closeout sequence diagram is missing required normative steps' });
  }
  const missingCloseoutBlockers = requiredCloseoutBlockers.filter((blocker) => !text.includes(blocker));
  if (missingCloseoutBlockers.length > 0) {
    addFailure(
      failedContracts,
      'CONTRACT-FINAL-CLOSEOUT',
      missingCloseoutBlockers.map((blocker) => `closeout_blocker_missing:${blocker}`)
    );
    repairTargets.push({ target: againstPath, reason: 'release and closeout blocking rules must enumerate every fail-closed blocker class' });
  }
  return makeReport({
    command: 'verify-design',
    against: againstPath,
    contracts,
    failedContracts,
    blockingGaps,
    repairTargets,
  });
}

export function verifyRun(cwd: string, runId: string): VerifyReport {
  const runtimeProtocolContracts = buildRuntimeProtocolContractIndex();
  const runtimeRoot = path.join(cwd, '_bmad-output', 'runtime', 'bmads-auto', runId);
  const artifactsRoot = path.join(runtimeRoot, 'artifacts');
  const manifestPath = path.join(runtimeRoot, 'run-manifest.json');
  const runContractIndexPath = path.join(artifactsRoot, 'contract-index.json');
  let runSpecificContracts: ContractIndexEntry[] = [];
  let contracts = runtimeProtocolContracts;
  const failedContracts: Array<{ contractId: string; blockers: string[] }> = [];
  const repairTargets: Array<{ target: string; reason: string }> = [];
  const blockingGaps: string[] = [];
  const indexValidation = validateContractIndex(runtimeProtocolContracts);
  if (indexValidation.resultCode !== 'OK') {
    failedContracts.push({ contractId: 'CONTRACT-RUNTIME-PROTOCOL-INDEX', blockers: indexValidation.blockers });
  }
  if (!fs.existsSync(manifestPath)) {
    return makeReport({
      command: 'verify-run',
      runId,
      against: runtimeRoot,
      contracts,
      failedContracts: [{ contractId: 'CONTRACT-ORCHESTRATION-RUNTIME', blockers: ['BLOCKED_MANIFEST_MISSING'] }],
      repairTargets: [{ target: manifestPath, reason: 'run-manifest.json is required for runtime verification' }],
    });
  }
  if (!fs.existsSync(runContractIndexPath)) {
    return makeReport({
      command: 'verify-run',
      runId,
      against: runtimeRoot,
      contracts,
      failedContracts: [{ contractId: 'RUN-SPECIFIC-CONTRACT-INDEX', blockers: ['BLOCKED_RUN_CONTRACT_INDEX_MISSING'] }],
      repairTargets: [{ target: runContractIndexPath, reason: 'run-specific contract-index.json is required for verify-run' }],
    });
  }
  try {
    const runIndex = readJson<{ runId?: string; contracts?: ContractIndexEntry[] }>(runContractIndexPath);
    if (runIndex.runId !== runId) {
      failedContracts.push({ contractId: 'RUN-SPECIFIC-CONTRACT-INDEX', blockers: ['BLOCKED_RUN_CONTRACT_INDEX_CROSS_RUN'] });
    }
    runSpecificContracts = Array.isArray(runIndex.contracts) ? runIndex.contracts : [];
    contracts = [...runtimeProtocolContracts, ...runSpecificContracts];
    if (runSpecificContracts.length === 0) {
      failedContracts.push({ contractId: 'RUN-SPECIFIC-CONTRACT-INDEX', blockers: ['BLOCKED_RUN_CONTRACT_INDEX_EMPTY'] });
    }
    addFailure(failedContracts, 'RUN-SPECIFIC-CONTRACT-INDEX', validateRunSpecificContracts(runSpecificContracts));
  } catch {
    failedContracts.push({ contractId: 'RUN-SPECIFIC-CONTRACT-INDEX', blockers: ['BLOCKED_RUN_CONTRACT_INDEX_INVALID_JSON'] });
  }

  const manifest = readJson<{
    runId?: string;
    manifestVersion?: number;
    artifactPaths?: Record<string, string>;
    packetIndex?: Record<string, unknown>;
    storyStates?: Record<string, unknown>;
    openLeases?: unknown[];
    driftCheckpoints?: string[];
    deliveryTruthMode?: string;
    soakMode?: string;
  }>(manifestPath);
  if (manifest.runId !== runId) {
    failedContracts.push({
      contractId: 'CONTRACT-PROVENANCE-SAME-RUN',
      blockers: ['BLOCKED_CROSS_RUN_MANIFEST'],
    });
    repairTargets.push({ target: manifestPath, reason: `manifest runId must equal ${runId}` });
  }
  if (!Number.isInteger(manifest.manifestVersion) || (manifest.manifestVersion ?? 0) <= 0) {
    failedContracts.push({
      contractId: 'CONTRACT-ORCHESTRATION-RUNTIME',
      blockers: ['BLOCKED_MANIFEST_VERSION_INVALID'],
    });
  }
  if ((manifest.openLeases ?? []).length > 0) {
    failedContracts.push({ contractId: 'CONTRACT-LEASE-LIFECYCLE', blockers: ['BLOCKED_OPEN_LEASES'] });
  }

  const requiredArtifacts: Array<{ key: string; filePath: string; contractId: string }> = [
    { key: 'gapRegistry', filePath: manifest.artifactPaths?.gapRegistry ?? path.join(artifactsRoot, 'gap-registry.json'), contractId: 'CONTRACT-GAP-REGISTRY' },
    { key: 'traceabilityMatrix', filePath: manifest.artifactPaths?.traceabilityMatrix ?? path.join(artifactsRoot, 'traceability-matrix.json'), contractId: 'CONTRACT-TRACEABILITY' },
    { key: 'fixtureRegistry', filePath: manifest.artifactPaths?.fixtureRegistry ?? path.join(artifactsRoot, 'fixture-registry.json'), contractId: 'CONTRACT-FIXTURE-REGISTRY' },
    { key: 'completionReceipt', filePath: manifest.artifactPaths?.completionReceipt ?? path.join(artifactsRoot, 'completion-receipt.json'), contractId: 'CONTRACT-FINAL-CLOSEOUT' },
    { key: 'deliveryTruthReport', filePath: manifest.artifactPaths?.deliveryTruthReport ?? path.join(artifactsRoot, 'delivery-truth-report.json'), contractId: 'CONTRACT-DELIVERY-TRUTH' },
  ];
  for (const artifact of requiredArtifacts) {
    if (!fs.existsSync(artifact.filePath)) {
      failedContracts.push({ contractId: artifact.contractId, blockers: [`${artifact.key}:missing`] });
      repairTargets.push({ target: artifact.filePath, reason: `${artifact.key} artifact is required for verify-run` });
    } else {
      try {
        const parsed = readJson<{ runId?: string }>(artifact.filePath);
        if (parsed.runId && parsed.runId !== runId) {
          failedContracts.push({ contractId: artifact.contractId, blockers: [`${artifact.key}:cross_run`] });
        }
      } catch {
        failedContracts.push({ contractId: artifact.contractId, blockers: [`${artifact.key}:invalid_json`] });
      }
    }
  }

  if (Object.keys(manifest.packetIndex ?? {}).length === 0) {
    failedContracts.push({ contractId: 'CONTRACT-DISPATCH-ELIGIBILITY', blockers: ['BLOCKED_PACKET_INDEX_MISSING'] });
  }
  if (Object.keys(manifest.storyStates ?? {}).length === 0) {
    failedContracts.push({ contractId: 'CONTRACT-TASKREPORT-INGEST', blockers: ['BLOCKED_STORY_STATES_MISSING'] });
  }
  for (const dispatchPacketId of Object.keys(manifest.packetIndex ?? {})) {
    const packetRoot = path.join(artifactsRoot, 'packets', dispatchPacketId);
    const packetPath = path.join(packetRoot, 'dispatch-packet.json');
    const ackPath = path.join(packetRoot, 'dispatch-ack.json');
    const taskReportPath = path.join(packetRoot, 'taskreport.json');
    const ingestReceiptPath = path.join(packetRoot, 'taskreport-ingest-receipt.json');
    for (const artifact of [
      { filePath: packetPath, contractId: 'CONTRACT-DISPATCH-ELIGIBILITY', blocker: 'dispatchPacket:missing' },
      { filePath: ackPath, contractId: 'CONTRACT-DISPATCH-ELIGIBILITY', blocker: 'dispatchAck:missing' },
      { filePath: taskReportPath, contractId: 'CONTRACT-TASKREPORT-INGEST', blocker: 'taskReport:missing' },
      { filePath: ingestReceiptPath, contractId: 'CONTRACT-TASKREPORT-INGEST', blocker: 'taskReportIngestReceipt:missing' },
    ]) {
      if (!fs.existsSync(artifact.filePath)) {
        failedContracts.push({ contractId: artifact.contractId, blockers: [artifact.blocker] });
        repairTargets.push({ target: artifact.filePath, reason: artifact.blocker });
      }
    }
  }
  const leaseLogPath = path.join(artifactsRoot, 'lease-log.jsonl');
  if (!fs.existsSync(leaseLogPath)) {
    failedContracts.push({ contractId: 'CONTRACT-LEASE-LIFECYCLE', blockers: ['leaseLog:missing'] });
    repairTargets.push({ target: leaseLogPath, reason: 'lease lifecycle must record acquire/release events' });
  } else {
    const leaseLog = fs.readFileSync(leaseLogPath, 'utf8');
    if (!leaseLog.includes('lease.acquired') || !leaseLog.includes('lease.released')) {
      failedContracts.push({ contractId: 'CONTRACT-LEASE-LIFECYCLE', blockers: ['leaseLifecycle:incomplete'] });
    }
  }
  for (const checkpoint of ['pre-dispatch', 'post-ingest', 'wave-closeout']) {
    if (!(manifest.driftCheckpoints ?? []).includes(checkpoint)) {
      failedContracts.push({ contractId: 'CONTRACT-DRIFT-CHECKPOINT', blockers: [`${checkpoint}:missing`] });
    }
  }

  const completionPath = manifest.artifactPaths?.completionReceipt ?? path.join(artifactsRoot, 'completion-receipt.json');
  const traceabilityPath = manifest.artifactPaths?.traceabilityMatrix ?? path.join(artifactsRoot, 'traceability-matrix.json');
  const fixtureRegistryPath = manifest.artifactPaths?.fixtureRegistry ?? path.join(artifactsRoot, 'fixture-registry.json');
  const gapRegistryPath = manifest.artifactPaths?.gapRegistry ?? path.join(artifactsRoot, 'gap-registry.json');
  const deliveryTruthPath = manifest.artifactPaths?.deliveryTruthReport ?? path.join(artifactsRoot, 'delivery-truth-report.json');

  if (fs.existsSync(traceabilityPath) && fs.existsSync(fixtureRegistryPath) && fs.existsSync(gapRegistryPath)) {
    const traceability = readJson<{ rows?: TraceabilityRow[] }>(traceabilityPath);
    const fixtures = readJson<{ entries?: FixtureRegistryEntry[] }>(fixtureRegistryPath);
    const gapRegistry = readJson<GapRegistry>(gapRegistryPath);
    const traceabilityResult = validateTraceabilityCoverage({
      rows: traceability.rows ?? [],
      requiredRequirementIds: runSpecificContracts.flatMap((contract) => contract.requirementRefs),
      fixtureIds: (fixtures.entries ?? []).map((entry) => entry.fixtureId),
      expectedGapRefs: gapRegistry.gaps.length > 0 ? gapRegistry.gaps.map((gap) => gap.gapId) : undefined,
      runId,
    });
    if (traceabilityResult.resultCode !== 'OK') {
      addFailure(failedContracts, 'CONTRACT-TRACEABILITY', traceabilityResult.blockers);
      repairTargets.push({ target: traceabilityPath, reason: 'traceability rows must fully cover run-specific requirements, fixtures, gaps, provenance, and evidence targets' });
    }
    const fixtureResult = validateFixtureRegistry(fixtures.entries ?? []);
    if (fixtureResult.resultCode !== 'OK') {
      addFailure(failedContracts, 'CONTRACT-FIXTURE-REGISTRY', fixtureResult.blockers);
      repairTargets.push({ target: fixtureRegistryPath, reason: 'fixture registry must reject duplicates, orphans, and real-8h optionality leaks' });
    }
    if (gapRegistry.runId !== runId) {
      addFailure(failedContracts, 'CONTRACT-GAP-REGISTRY', ['gapRegistry:cross_run']);
    }
    if (releaseBlockedByGaps(gapRegistry)) {
      addFailure(failedContracts, 'CONTRACT-GAP-REGISTRY', ['BLOCKED_OPEN_GAPS']);
    }
  }

  if (fs.existsSync(completionPath)) {
    const completion = readJson<{
      blockers?: string[];
      completionAllowed?: boolean;
      deliveryTruthReportPath?: string;
      orderedSteps?: string[];
      orderedStepArtifacts?: Array<{ step: string; path: string }>;
    }>(completionPath);
    for (const blocker of completion.blockers ?? []) {
      if (blocker.includes('G') || blocker.includes('GAP')) blockingGaps.push(blocker);
    }
    if (completion.completionAllowed !== true) {
      failedContracts.push({ contractId: 'CONTRACT-DELIVERY-TRUTH', blockers: ['BLOCKED_COMPLETION_NOT_ALLOWED'] });
    }
    const stepAliases: Record<string, string[]> = {
      'verify gap registry, traceability, risk register, open questions, drift, and lease release': [
        'closeout guard and traceability',
      ],
      'perform authorized terminal sprint-status update': ['terminal sprint-status update only when completionAllowed=true'],
      'write completion-receipt.json': ['completion receipt'],
    };
    for (const step of requiredSequenceSteps) {
      const aliases = [step, ...(stepAliases[step] ?? [])];
      const matchingArtifact = (completion.orderedStepArtifacts ?? []).find((artifact) =>
        aliases.some((alias) => artifact.step.includes(alias) || alias.includes(artifact.step))
      );
      if (!matchingArtifact || !isNonEmptyText(matchingArtifact.path) || matchingArtifact.path === 'not-authorized') {
        addFailure(failedContracts, 'CONTRACT-FINAL-CLOSEOUT', [`closeout_step_artifact_missing:${step}`]);
      }
    }
    if (fs.existsSync(deliveryTruthPath)) {
      const deliveryTruth = readJson<{ completionAllowed?: boolean; blockers?: string[]; runId?: string }>(deliveryTruthPath);
      if (deliveryTruth.runId !== runId) {
        addFailure(failedContracts, 'CONTRACT-DELIVERY-TRUTH', ['deliveryTruth:cross_run']);
      }
      if (deliveryTruth.completionAllowed !== completion.completionAllowed) {
        addFailure(failedContracts, 'CONTRACT-DELIVERY-TRUTH', ['deliveryTruth:completion_mismatch']);
      }
      if ((deliveryTruth.blockers ?? []).length !== (completion.blockers ?? []).length) {
        addFailure(failedContracts, 'CONTRACT-DELIVERY-TRUTH', ['deliveryTruth:blocker_mismatch']);
      }
    }
  }

  return makeReport({
    command: 'verify-run',
    runId,
    against: runtimeRoot,
    contracts,
    failedContracts,
    blockingGaps,
    repairTargets,
    deliveryTruthReportPath: manifest.artifactPaths?.deliveryTruthReport ?? '',
  });
}
