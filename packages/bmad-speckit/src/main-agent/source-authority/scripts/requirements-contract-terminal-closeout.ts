import * as fs from 'node:fs';
import * as path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import {
  canonicalJson,
  fileHash,
  sha256,
  slash,
  writeGovernedJson,
} from './requirements-contract-governed-write';
import {
  deriveRequirementsContractFrozenUniverse,
  validateRequirementsContractEvidenceUniverse,
} from './requirements-contract-frozen-universe';

type JsonRecord = Record<string, ReturnType<typeof JSON.parse>>;

export interface RequirementsContractTerminalCloseoutOptions {
  cwd?: string;
  contract: string;
  bundle: string;
  terminalReceipt: string;
  expectedTerminalReceiptHash?: string;
  packet: string;
  readbackReceipt: string;
}

export interface RequirementsContractTerminalCloseoutProjectionOptions {
  cwd?: string;
  packet: string;
  readbackReceipt: string;
}

const BASE = 'docs/plans/evidence/loop-engineering-remediation';
const PACKET_PATH = `${BASE}/terminal-closeout-packet.json`;
const READBACK_RECEIPT_PATH = `${BASE}/terminal-closeout-packet.readback.receipt.json`;
const FORBIDDEN_PACKET_KEYS = new Set([
  'packetHash',
  'selfHash',
  'readbackReceiptHash',
  'terminalCloseoutPacketHash',
  'terminalCloseoutReadbackReceiptHash',
]);

function resolveWithin(root: string, value: string): string {
  const resolved = path.resolve(root, value);
  const relative = path.relative(root, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`terminal_closeout_path_escape:${value}`);
  }
  return resolved;
}

function readJson(filePath: string): JsonRecord {
  const value = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`terminal_closeout_json_object_required:${slash(filePath)}`);
  }
  return value as JsonRecord;
}

function schemaPath(schemaName: string): string {
  return path.resolve(__dirname, '..', 'schemas', schemaName);
}

function validator(schemaName: string) {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  return ajv.compile(readJson(schemaPath(schemaName)));
}

function validate(value: JsonRecord, schemaName: string, label: string): void {
  const validateValue = validator(schemaName);
  if (!validateValue(value)) {
    throw new Error(
      `terminal_closeout_${label}_schema_invalid:${JSON.stringify(validateValue.errors ?? [])}`
    );
  }
}

function rejectForbiddenPacketFacts(value: unknown, seen = new Set<unknown>()): void {
  if (!value || typeof value !== 'object' || seen.has(value)) return;
  seen.add(value);
  if (Array.isArray(value)) {
    value.forEach((entry) => rejectForbiddenPacketFacts(entry, seen));
    return;
  }
  for (const [key, entry] of Object.entries(value as JsonRecord)) {
    if (FORBIDDEN_PACKET_KEYS.has(key)) {
      throw new Error(`terminal_closeout_forbidden_packet_fact:${key}`);
    }
    if (typeof entry === 'string' && entry.includes(READBACK_RECEIPT_PATH)) {
      throw new Error(`terminal_closeout_successor_reference_forbidden:${key}`);
    }
    rejectForbiddenPacketFacts(entry, seen);
  }
}

function relativeRef(root: string, filePath: string) {
  return {
    path: slash(path.relative(root, filePath)),
    hash: fileHash(filePath),
  };
}

export function renderRequirementsContractTerminalCloseout(
  options: RequirementsContractTerminalCloseoutOptions
) {
  const root = path.resolve(options.cwd ?? process.cwd());
  if (
    slash(options.packet) !== PACKET_PATH ||
    slash(options.readbackReceipt) !== READBACK_RECEIPT_PATH
  ) {
    throw new Error('terminal_closeout_fixed_output_path_mismatch');
  }
  const contractPath = resolveWithin(root, options.contract);
  const bundlePath = resolveWithin(root, options.bundle);
  const terminalReceiptPath = resolveWithin(root, options.terminalReceipt);
  const packetPath = resolveWithin(root, options.packet);
  const readbackReceiptPath = resolveWithin(root, options.readbackReceipt);
  if (fs.existsSync(packetPath) || fs.existsSync(readbackReceiptPath)) {
    throw new Error('terminal_closeout_output_immutable');
  }
  const bundle = readJson(bundlePath);
  const terminalReceipt = readJson(terminalReceiptPath);
  const terminalReceiptHash = fileHash(terminalReceiptPath);
  if (
    options.expectedTerminalReceiptHash &&
    terminalReceiptHash !== options.expectedTerminalReceiptHash
  ) {
    throw new Error('terminal_closeout_terminal_receipt_hash_mismatch');
  }
  validate(
    bundle,
    'requirements-contract-completion-evidence.schema.json',
    'completion_evidence'
  );
  validate(
    terminalReceipt,
    'requirements-contract-terminal-command-receipt.schema.json',
    'terminal_receipt'
  );
  const contractHash = fileHash(contractPath);
  const bundleHash = fileHash(bundlePath);
  const universe = deriveRequirementsContractFrozenUniverse(contractPath);
  validateRequirementsContractEvidenceUniverse(
    {
      sourceAmendmentHashes: bundle.sourceAmendmentHashes,
      coverage: bundle.coverage,
      evidenceIndex: bundle.evidenceIndex,
      artifactIndex: bundle.artifactIndex,
    },
    universe
  );
  if (
    terminalReceipt.result !== 'PASS' ||
    terminalReceipt.orderedExecutionDecision !== 'pass' ||
    terminalReceipt.contractHash !== contractHash ||
    terminalReceipt.contractHash !== bundle.contractHash ||
    terminalReceipt.frozenEvidenceBundleHash !== bundleHash
  ) {
    throw new Error('terminal_closeout_upstream_binding_mismatch');
  }
  rejectForbiddenPacketFacts(bundle);
  const packet = {
    schemaVersion: 'requirements-contract-terminal-closeout-packet/v1',
    contract: relativeRef(root, contractPath),
    completionEvidence: relativeRef(root, bundlePath),
    terminalCommandReceipt: relativeRef(root, terminalReceiptPath),
    identity: {
      transactionId: bundle.transactionId,
      implementationAttemptId: bundle.implementationAttemptId,
      auditAttemptId: bundle.auditAttemptId,
      architectureAuditAttemptId: bundle.architectureAuditAttemptId,
      preCandidateAuditAttemptId: bundle.preCandidateAuditAttemptId,
      finalAuditAttemptId: bundle.finalAuditAttemptId,
    },
    authority: {
      contractHash: bundle.contractHash,
      sourcePlanHash: bundle.sourcePlanHash,
      sourceAmendmentHashes: bundle.sourceAmendmentHashes,
      aggregateAmendmentHash: bundle.aggregateAmendmentHash,
      semanticModelHash: bundle.semanticModelHash,
      sequenceContractHash: bundle.sequenceContractHash,
      closureReportHash: bundle.closureReportHash,
    },
    evidenceBundleId: bundle.evidenceBundleId,
    coverage: bundle.coverage,
    criticalMetrics: bundle.criticalMetrics,
    lifecycleDecisions: bundle.lifecycleDecisions ?? {},
    phaseHistory: bundle.phaseHistory ?? [],
    evidenceIndex: bundle.evidenceIndex,
    artifactIndex: bundle.artifactIndex,
    finalization: {
      terminalFinalizationTargetSetDeclarationHash:
        terminalReceipt.terminalFinalizationTargetSetDeclarationHash,
      terminalFinalizationTargetSetClosureHash:
        terminalReceipt.terminalFinalizationTargetSetClosureHash,
      targets: terminalReceipt.finalizationTargets,
    },
    commands: terminalReceipt.commands,
    residualRisks: bundle.residualRisks ?? [],
    upstreamEvidenceHash: sha256(canonicalJson(bundle)),
  };
  rejectForbiddenPacketFacts(packet);
  validateRequirementsContractEvidenceUniverse(
    {
      sourceAmendmentHashes: packet.authority.sourceAmendmentHashes,
      coverage: packet.coverage,
      evidenceIndex: packet.evidenceIndex,
      artifactIndex: packet.artifactIndex,
    },
    universe
  );
  validate(
    packet,
    'requirements-contract-terminal-closeout-packet.schema.json',
    'packet'
  );
  const packetWrite = writeGovernedJson(packetPath, packet);
  const publishedAt = new Date().toISOString();
  const packetSchemaPath = schemaPath(
    'requirements-contract-terminal-closeout-packet.schema.json'
  );
  const readbackReceipt = {
    schemaVersion: 'requirements-contract-artifact-readback-receipt/v1',
    artifactId: 'TERMINAL-CLOSEOUT-PACKET',
    artifactType: 'requirements-contract-terminal-closeout-packet/v1',
    artifactPath: PACKET_PATH,
    artifactHash: packetWrite.targetRef.hash,
    observedReadbackHash: packetWrite.targetRef.readbackHash,
    artifactSchema: relativeRef(root, packetSchemaPath),
    publicationReceipt: {
      path: slash(path.relative(root, packetWrite.receiptRef.path)),
      hash: packetWrite.receiptRef.hash,
    },
    terminalCommandReceipt: relativeRef(root, terminalReceiptPath),
    contractHash,
    transactionId: bundle.transactionId,
    implementationAttemptId: bundle.implementationAttemptId,
    auditAttemptId: bundle.auditAttemptId,
    publishedAt,
    readbackAt: new Date().toISOString(),
    decision: 'pass',
  };
  validate(
    readbackReceipt,
    'requirements-contract-artifact-readback-receipt.schema.json',
    'readback_receipt'
  );
  writeGovernedJson(readbackReceiptPath, readbackReceipt);
  return { packet, readbackReceipt };
}

export function projectRequirementsContractTerminalCloseout(
  options: RequirementsContractTerminalCloseoutProjectionOptions
) {
  const root = path.resolve(options.cwd ?? process.cwd());
  if (
    slash(options.packet) !== PACKET_PATH ||
    slash(options.readbackReceipt) !== READBACK_RECEIPT_PATH
  ) {
    throw new Error('terminal_closeout_fixed_output_path_mismatch');
  }
  const packetPath = resolveWithin(root, options.packet);
  const readbackReceiptPath = resolveWithin(root, options.readbackReceipt);
  const packet = readJson(packetPath);
  const readbackReceipt = readJson(readbackReceiptPath);
  const contractPath = resolveWithin(root, String(packet.contract?.path ?? ''));
  if (fileHash(contractPath) !== packet.contract?.hash) {
    throw new Error('terminal_closeout_contract_hash_mismatch');
  }
  const universe = deriveRequirementsContractFrozenUniverse(contractPath);
  validate(
    packet,
    'requirements-contract-terminal-closeout-packet.schema.json',
    'packet'
  );
  validate(
    readbackReceipt,
    'requirements-contract-artifact-readback-receipt.schema.json',
    'readback_receipt'
  );
  const packetHash = fileHash(packetPath);
  if (
    readbackReceipt.artifactPath !== PACKET_PATH ||
    readbackReceipt.artifactHash !== packetHash ||
    readbackReceipt.observedReadbackHash !== packetHash
  ) {
    throw new Error('terminal_closeout_readback_binding_mismatch');
  }
  rejectForbiddenPacketFacts(packet);
  validateRequirementsContractEvidenceUniverse(
    {
      sourceAmendmentHashes: packet.authority.sourceAmendmentHashes,
      coverage: packet.coverage,
      evidenceIndex: packet.evidenceIndex,
      artifactIndex: packet.artifactIndex,
    },
    universe
  );
  return {
    ...packet,
    terminalCloseoutPacketPath: PACKET_PATH,
    terminalCloseoutPacketHash: packetHash,
    terminalCloseoutReadbackReceiptPath: READBACK_RECEIPT_PATH,
    terminalCloseoutReadbackReceiptHash: fileHash(readbackReceiptPath),
  };
}
