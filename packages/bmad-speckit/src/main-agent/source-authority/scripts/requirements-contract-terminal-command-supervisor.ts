import { spawnSync } from 'node:child_process';
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
import { renderRequirementsContractTerminalCloseout } from './requirements-contract-terminal-closeout';

type JsonRecord = Record<string, ReturnType<typeof JSON.parse>>;

export interface RequirementsContractTerminalCommandSupervisorOptions {
  cwd?: string;
  contract: string;
  bundle: string;
  safeWriteManifestReceipt: string;
  evd15Receipt: string;
  artifact01Receipt: string;
  receipt: string;
  firstCommand: string;
  secondCommand: string;
  json?: boolean;
}

const BASE = 'docs/plans/evidence/loop-engineering-remediation';
const TARGETS = [
  {
    artifactRole: 'SAFE-WRITE-RECEIPT-MANIFEST',
    targetPath: `${BASE}/safe-write-receipt-manifest.json`,
    receiptPath: `${BASE}/finalization-receipts/safe-write-receipt-manifest.receipt.json`,
    predecessorRole: 'not_applicable',
  },
  {
    artifactRole: 'EVD-15',
    targetPath: `${BASE}/G15-final-gates.json`,
    receiptPath: `${BASE}/finalization-receipts/G15-final-gates.receipt.json`,
    predecessorRole: 'SAFE-WRITE-RECEIPT-MANIFEST',
  },
  {
    artifactRole: 'ARTIFACT-01',
    targetPath: `${BASE}/implementation-evidence.json`,
    receiptPath: `${BASE}/finalization-receipts/implementation-evidence.receipt.json`,
    predecessorRole: 'EVD-15',
  },
] as const;

function resolveWithin(root: string, value: string): string {
  const resolved = path.resolve(root, value);
  const relative = path.relative(root, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`terminal_command_supervisor_path_escape:${value}`);
  }
  return resolved;
}

function readJson(filePath: string): JsonRecord {
  const value = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`terminal_command_supervisor_json_object_required:${slash(filePath)}`);
  }
  return value as JsonRecord;
}

function validator(schemaName: string) {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  return ajv.compile(readJson(path.resolve(__dirname, '..', 'schemas', schemaName)));
}

function terminalCommandIds(): [string, string] {
  const schema = readJson(
    path.resolve(
      __dirname,
      '..',
      'schemas',
      'requirements-contract-terminal-command-supervisor-input.schema.json'
    )
  );
  return [
    String(schema.properties?.firstCommand?.const ?? ''),
    String(schema.properties?.secondCommand?.const ?? ''),
  ];
}

function commandCell(contract: string, commandId: string): string {
  const row = contract.split(/\r?\n/u).find((line) => line.startsWith(`| ${commandId} |`));
  const cell = row?.match(/^\| [^|]+ \| (.*?) \| Repository root \|/u)?.[1]?.trim();
  if (!cell) throw new Error(`terminal_command_supervisor_command_missing:${commandId}`);
  return cell.startsWith('`') && cell.endsWith('`') ? cell.slice(1, -1) : cell;
}

function splitArgv(command: string): string[] {
  const tokens = command.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/gu) ?? [];
  return tokens.map((token) => {
    const quoted =
      (token.startsWith('"') && token.endsWith('"')) ||
      (token.startsWith("'") && token.endsWith("'"));
    return quoted ? token.slice(1, -1) : token;
  });
}

function runCommand(root: string, commandId: string, commandText: string): JsonRecord {
  const exactArgv = splitArgv(commandText);
  if (exactArgv.length === 0) {
    throw new Error(`terminal_command_supervisor_argv_empty:${commandId}`);
  }
  const startedAt = new Date().toISOString();
  const result = spawnSync(exactArgv[0], exactArgv.slice(1), {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true,
  });
  const endedAt = new Date().toISOString();
  return {
    commandId,
    exactArgv,
    argvHash: sha256(canonicalJson(exactArgv)),
    cwd: slash(root),
    executorIdentity: 'requirements-contract-terminal-command-supervisor/v1',
    hostIdentity: `${process.platform}-${process.arch}`,
    startedAt,
    endedAt,
    exitCode: result.status ?? (result.error ? 1 : 0),
    stdoutHash: sha256(result.stdout ?? ''),
    stderrHash: sha256(`${result.stderr ?? ''}${result.error?.message ?? ''}`),
  };
}

export async function requirementsContractTerminalCommandSupervisorCommand(
  options: RequirementsContractTerminalCommandSupervisorOptions
): Promise<JsonRecord> {
  const root = path.resolve(options.cwd ?? process.cwd());
  const commandIds = terminalCommandIds();
  if (
    options.firstCommand !== commandIds[0] ||
    options.secondCommand !== commandIds[1] ||
    slash(options.receipt) !== `${BASE}/terminal-command-receipt.json`
  ) {
    throw new Error('terminal_command_supervisor_fixed_contract_mismatch');
  }
  const receiptOptions = [
    slash(options.safeWriteManifestReceipt),
    slash(options.evd15Receipt),
    slash(options.artifact01Receipt),
  ];
  if (canonicalJson(receiptOptions) !== canonicalJson(TARGETS.map((entry) => entry.receiptPath))) {
    throw new Error('terminal_command_supervisor_receipt_set_mismatch');
  }
  const finalizationValidator = validator(
    'requirements-contract-finalization-safe-write-receipt.schema.json'
  );
  let identity: JsonRecord | null = null;
  const finalizationTargets = TARGETS.map((target, index) => {
    const receiptPath = resolveWithin(root, target.receiptPath);
    const receipt = readJson(receiptPath);
    if (!finalizationValidator(receipt)) {
      throw new Error(
        `terminal_command_supervisor_finalization_receipt_invalid:${JSON.stringify(
          finalizationValidator.errors ?? []
        )}`
      );
    }
    if (
      receipt.result !== 'PASS' ||
      receipt.artifactRole !== target.artifactRole ||
      receipt.target.path !== target.targetPath ||
      receipt.selectedReceiptPath !== target.receiptPath
    ) {
      throw new Error(`terminal_command_supervisor_finalization_binding_mismatch:${target.artifactRole}`);
    }
    const currentIdentity = {
      requirementRecordPath: receipt.requirementRecord.path,
      requirementRecordHash: receipt.requirementRecord.hash,
      implementationAttemptId: receipt.implementationAttemptId,
      finalizationDeclarationHash: receipt.finalizationDeclarationHash,
    };
    if (identity && canonicalJson(identity) !== canonicalJson(currentIdentity)) {
      throw new Error('terminal_command_supervisor_finalization_identity_mismatch');
    }
    identity = currentIdentity;
    const recordPath = resolveWithin(root, currentIdentity.requirementRecordPath);
    if (fileHash(recordPath) !== currentIdentity.requirementRecordHash) {
      throw new Error('terminal_command_supervisor_requirement_record_hash_mismatch');
    }
    if (index === 0) {
      if (receipt.predecessor.applicable !== false) {
        throw new Error('terminal_command_supervisor_predecessor_mismatch');
      }
    } else if (
      receipt.predecessor.receipt?.artifactRole !== TARGETS[index - 1].artifactRole ||
      receipt.predecessor.receipt?.path !== TARGETS[index - 1].receiptPath ||
      fileHash(resolveWithin(root, receipt.predecessor.receipt.path)) !==
        receipt.predecessor.receipt.hash
    ) {
      throw new Error('terminal_command_supervisor_predecessor_mismatch');
    }
    const targetPath = resolveWithin(root, target.targetPath);
    const targetHash = fileHash(targetPath);
    if (
      targetHash !== receipt.target.promotedHash ||
      targetHash !== receipt.target.readbackHash
    ) {
      throw new Error(`terminal_command_supervisor_target_hash_mismatch:${target.artifactRole}`);
    }
    const targetValue = readJson(targetPath);
    return {
      order: index + 1,
      artifactRole: target.artifactRole,
      targetPath: target.targetPath,
      receiptPath: target.receiptPath,
      targetSchemaVersion: String(targetValue.schemaVersion),
      minimumBytes: 2,
      predecessorRole: target.predecessorRole,
      targetHash,
      promotionReceiptHash: fileHash(receiptPath),
      promotionHash: receipt.target.promotedHash,
      readbackHash: receipt.target.readbackHash,
    };
  });
  const contractPath = resolveWithin(root, options.contract);
  const bundlePath = resolveWithin(root, options.bundle);
  if (slash(path.relative(root, bundlePath)) !== TARGETS[2].targetPath) {
    throw new Error('terminal_command_supervisor_bundle_path_mismatch');
  }
  const receiptPath = resolveWithin(root, options.receipt);
  if (fs.existsSync(receiptPath)) {
    throw new Error('terminal_command_supervisor_receipt_immutable');
  }
  const bundleText = fs.readFileSync(bundlePath, 'utf8');
  if (
    bundleText.includes('terminal-command-receipt.json') ||
    bundleText.includes('terminalCommandReceiptHash')
  ) {
    throw new Error('terminal_command_supervisor_bundle_circular_reference');
  }
  const frozenEvidenceBundleHash = fileHash(bundlePath);
  const contract = fs.readFileSync(contractPath, 'utf8');
  const first = runCommand(root, commandIds[0], commandCell(contract, commandIds[0]));
  const second =
    first.exitCode === 0
      ? runCommand(root, commandIds[1], commandCell(contract, commandIds[1]))
      : {
          commandId: commandIds[1],
          exactArgv: splitArgv(commandCell(contract, commandIds[1])),
          argvHash: sha256(canonicalJson(splitArgv(commandCell(contract, commandIds[1])))),
          cwd: slash(root),
          executorIdentity: 'requirements-contract-terminal-command-supervisor/v1',
          hostIdentity: `${process.platform}-${process.arch}`,
          startedAt: new Date().toISOString(),
          endedAt: new Date().toISOString(),
          exitCode: -1,
          stdoutHash: sha256(''),
          stderrHash: sha256('not_run_after_cmd24_failure'),
        };
  if (fileHash(bundlePath) !== frozenEvidenceBundleHash && second.exitCode === 0) {
    second.exitCode = -2;
    second.stderrHash = sha256('terminal_command_supervisor_bundle_mutated');
  }
  const commands = [first, second];
  const passed = commands.every((command) => command.exitCode === 0);
  const receipt = {
    schemaVersion: 'requirements-contract-terminal-command-receipt/v1',
    contractHash: fileHash(contractPath),
    frozenEvidenceBundleHash,
    terminalFinalizationTargetSetDeclarationHash:
      identity?.finalizationDeclarationHash,
    terminalFinalizationTargetSetClosureHash: sha256(canonicalJson(finalizationTargets)),
    finalizationTargets,
    commands,
    orderedExecutionDecision: passed ? 'pass' : 'block',
    result: passed ? 'PASS' : 'BLOCK',
  };
  const receiptValidator = validator(
    'requirements-contract-terminal-command-receipt.schema.json'
  );
  if (!receiptValidator(receipt)) {
    throw new Error(
      `terminal_command_supervisor_receipt_schema_invalid:${JSON.stringify(
        receiptValidator.errors ?? []
      )}`
    );
  }
  writeGovernedJson(receiptPath, receipt);
  if (passed) {
    renderRequirementsContractTerminalCloseout({
      cwd: root,
      contract: options.contract,
      bundle: options.bundle,
      terminalReceipt: options.receipt,
      expectedTerminalReceiptHash: fileHash(receiptPath),
      packet: `${BASE}/terminal-closeout-packet.json`,
      readbackReceipt: `${BASE}/terminal-closeout-packet.readback.receipt.json`,
    });
  }
  if (options.json) process.stdout.write(`${JSON.stringify(receipt)}\n`);
  return receipt;
}
