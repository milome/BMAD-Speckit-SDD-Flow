import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import {
  canonicalJson,
  fileHash,
  sha256,
  slash,
  writeGovernedJson,
} from './requirements-contract-governed-write';

type JsonRecord = Record<string, ReturnType<typeof JSON.parse>>;

interface ControlledCommand {
  commandId: string;
  fixtureOnly: boolean;
}

export interface RequirementsContractProductionActivateOptions {
  cwd?: string;
  requirementRecord: string;
  registry: string;
  activationPlanDir: string;
  activationPlanWriteReceiptDir: string;
  successReceipt: string;
  blockedAttemptDir: string;
  json?: boolean;
}

const CONTRACT_PATH =
  'docs/plans/2026-07-11-loop-engineering-evidence-closure-remediation-goal-execution-plan.md';
const REGISTRY_PATH =
  '_bmad/shared/requirements-contract/requirements-contract-consumer-registry.json';
const LOCK_PATH =
  '_bmad/shared/requirements-contract/.requirements-contract-consumer-registry.activation.lock';

function resolveWithin(root: string, value: string): string {
  const resolved = path.resolve(root, value);
  const relative = path.relative(root, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`production_activate_path_escape:${value}`);
  }
  return resolved;
}

function parseJsonObject(text: string, label: string): JsonRecord {
  const value = JSON.parse(text) as unknown;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`production_activate_json_object_required:${slash(label)}`);
  }
  return value as JsonRecord;
}

function readJson(filePath: string): JsonRecord {
  return parseJsonObject(fs.readFileSync(filePath, 'utf8'), filePath);
}

function controlledCommands(): ControlledCommand[] {
  const schema = readJson(
    path.resolve(
      __dirname,
      '..',
      'schemas',
      'requirements-contract-production-activate-input.schema.json'
    )
  );
  const commands = schema.properties?.controlledCommands?.const;
  if (
    !Array.isArray(commands) ||
    commands.some(
      (command) =>
        !command ||
        typeof command !== 'object' ||
        typeof command.commandId !== 'string' ||
        typeof command.fixtureOnly !== 'boolean'
    )
  ) {
    throw new Error('production_activate_controlled_commands_invalid');
  }
  return commands.map((command) => ({
    commandId: command.commandId,
    fixtureOnly: command.fixtureOnly,
  }));
}

function uuidv7(): string {
  const bytes = randomBytes(16);
  const milliseconds = BigInt(Date.now());
  bytes[0] = Number((milliseconds >> 40n) & 0xffn);
  bytes[1] = Number((milliseconds >> 32n) & 0xffn);
  bytes[2] = Number((milliseconds >> 24n) & 0xffn);
  bytes[3] = Number((milliseconds >> 16n) & 0xffn);
  bytes[4] = Number((milliseconds >> 8n) & 0xffn);
  bytes[5] = Number(milliseconds & 0xffn);
  bytes[6] = (bytes[6] & 0x0f) | 0x70;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(
    16,
    20
  )}-${hex.slice(20)}`;
}

function validate(value: JsonRecord, schemaName: string, label: string): void {
  const schemaPath = path.resolve(__dirname, '..', 'schemas', schemaName);
  const validator = new Ajv2020({ allErrors: true, strict: false }).compile(
    readJson(schemaPath)
  );
  if (!validator(value)) {
    throw new Error(`${label}_schema_invalid:${JSON.stringify(validator.errors ?? [])}`);
  }
}

function commandText(contract: string, commandId: string): string {
  const row = contract.split(/\r?\n/u).find((line) => line.startsWith(`| ${commandId} |`));
  const cell = row?.match(/^\| [^|]+ \| (.*?) \| Repository root \|/u)?.[1]?.trim();
  if (!cell) throw new Error(`production_activate_contract_command_missing:${commandId}`);
  return cell.startsWith('`') && cell.endsWith('`') ? cell.slice(1, -1) : cell;
}

function directoryHash(root: string): string {
  const entries: JsonRecord[] = [];
  const visit = (current: string) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const resolved = path.join(current, entry.name);
      if (entry.isDirectory()) visit(resolved);
      else if (entry.isFile()) {
        entries.push({
          path: slash(path.relative(root, resolved)),
          hash: fileHash(resolved),
        });
      }
    }
  };
  visit(root);
  return sha256(canonicalJson(entries.sort((a, b) => a.path.localeCompare(b.path))));
}

function writeAtomicText(target: string, value: string, identity: string): void {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const temporary = `${target}.${identity}.tmp`;
  fs.writeFileSync(temporary, value, 'utf8');
  fs.renameSync(temporary, target);
}

function executeCommands(root: string, commands: JsonRecord[]): JsonRecord[] {
  return commands.map((command) => {
    const result = spawnSync(String(command.commandText), {
      cwd: root,
      encoding: 'utf8',
      shell: true,
      windowsHide: true,
    });
    const exitCode = result.status ?? (result.error ? 1 : 0);
    return {
      commandId: command.commandId,
      argvHash: command.argvHash,
      exitCode,
      stdoutHash: sha256(result.stdout ?? ''),
      stderrHash: sha256(`${result.stderr ?? ''}${result.error?.message ?? ''}`),
      decision: exitCode === 0 ? 'pass' : 'blocked',
    };
  });
}

function promotionReceipt(targetPath: string, targetHash: string): JsonRecord {
  return {
    schemaVersion: 'large-document-writer-safe-write/v1',
    targetPath,
    targetHash,
    readbackHash: targetHash,
    result: 'PASS',
  };
}

export async function requirementsContractProductionActivateCommand(
  options: RequirementsContractProductionActivateOptions
): Promise<JsonRecord> {
  const root = path.resolve(options.cwd ?? process.cwd());
  if (slash(options.registry) !== REGISTRY_PATH) {
    throw new Error('production_activate_registry_path_mismatch');
  }
  const recordPath = resolveWithin(root, options.requirementRecord);
  const registryPath = resolveWithin(root, options.registry);
  const successReceiptPath = resolveWithin(root, options.successReceipt);
  const record = readJson(recordPath);
  const requirementSetId = String(record.requirementSetId ?? record.recordId ?? '');
  const implementationAttemptId = String(record.currentAttemptId ?? '');
  if (!/^[a-z0-9][a-z0-9._-]*$/u.test(requirementSetId)) {
    throw new Error('production_activate_requirement_set_id_invalid');
  }
  if (!/^IMPL-ATTEMPT-[A-Z0-9][A-Z0-9._-]*$/u.test(implementationAttemptId)) {
    throw new Error('production_activate_active_implementation_attempt_invalid');
  }
  if (Array.isArray(record.implementationAttempts)) {
    const active = record.implementationAttempts.filter(
      (entry: JsonRecord) =>
        entry.active === true || ['active', 'implementation_in_progress'].includes(entry.status)
    );
    if (
      active.length !== 1 ||
      String(active[0].implementationAttemptId ?? active[0].attemptId) !== implementationAttemptId
    ) {
      throw new Error('production_activate_active_implementation_attempt_not_unique');
    }
  }
  const registryPreimageText = fs.readFileSync(registryPath, 'utf8');
  const registryBefore = parseJsonObject(registryPreimageText, registryPath);
  if (
    registryBefore.requirementSetId !== undefined &&
    registryBefore.requirementSetId !== requirementSetId
  ) {
    throw new Error('production_activate_registry_requirement_set_mismatch');
  }
  const preimageHash = sha256(registryPreimageText);
  const activationAttemptId = `ACT-ATTEMPT-${uuidv7()}`;
  const activationReceiptId = `ACT-RECEIPT-${uuidv7()}`;
  const targetRegistry = {
    ...registryBefore,
    requirementSetId,
    shadowOutputEnabled: false,
    v1OutputEnabled: false,
    productionReadModelVersion: 'v2',
    activationReceiptId,
  };
  const targetRegistryText = `${JSON.stringify(targetRegistry, null, 2)}\n`;
  const targetRegistryHash = sha256(targetRegistryText);
  const plannedSnapshotPath = slash(
    path.join(
      '_bmad-output/runtime/requirement-records',
      requirementSetId,
      'activation',
      implementationAttemptId,
      activationAttemptId,
      'candidate-snapshot',
      '/'
    )
  );
  const planRelativePath = slash(
    path.join(options.activationPlanDir, `${activationAttemptId}.json`)
  );
  const promotionRelativePath = slash(
    path.join(options.activationPlanWriteReceiptDir, `${activationAttemptId}.receipt.json`)
  );
  const contract = fs.readFileSync(resolveWithin(root, CONTRACT_PATH), 'utf8');
  const commandPlans = controlledCommands().map(({ commandId, fixtureOnly }) => {
    const text = commandText(contract, commandId);
    return {
      commandId,
      argvHash: sha256(canonicalJson([text])),
      fixtureOnly,
      commandText: text,
    };
  });
  const plan = {
    schemaVersion: 'requirements-contract-production-activation-plan/v1',
    requirementRecord: {
      path: slash(path.relative(root, recordPath)),
      hash: fileHash(recordPath),
    },
    requirementSetId,
    implementationAttemptId,
    activationAttemptId,
    activationReceiptId,
    idGenerationScheme: 'uuidv7',
    registry: {
      path: REGISTRY_PATH,
      preimageHash,
      targetArtifact12Hash: targetRegistryHash,
    },
    plannedSnapshotPath,
    nestedCommands: commandPlans.map(({ commandText: _commandText, ...command }) => command),
    cliIdentityHash: fileHash(
      resolveWithin(root, 'packages/bmad-speckit/bin/bmad-speckit.js')
    ),
    schemaIdentityHash: fileHash(
      path.resolve(
        __dirname,
        '..',
        'schemas',
        'requirements-contract-production-activation-plan.schema.json'
      )
    ),
    expectedPromotionReceiptPath: promotionRelativePath,
    createdAt: new Date().toISOString(),
  };
  validate(
    plan,
    'requirements-contract-production-activation-plan.schema.json',
    'production_activate_plan'
  );
  const planPath = resolveWithin(root, planRelativePath);
  writeGovernedJson(planPath, plan);
  const planHash = fileHash(planPath);
  const promotionPath = resolveWithin(root, promotionRelativePath);
  writeGovernedJson(promotionPath, promotionReceipt(planRelativePath, planHash));
  const snapshotRoot = resolveWithin(root, plannedSnapshotPath);
  fs.mkdirSync(path.join(snapshotRoot, path.dirname(REGISTRY_PATH)), { recursive: true });
  fs.writeFileSync(path.join(snapshotRoot, REGISTRY_PATH), targetRegistryText, 'utf8');
  writeGovernedJson(path.join(snapshotRoot, 'snapshot-manifest.json'), {
    schemaVersion: 'requirements-contract-production-activation-snapshot/v1',
    activationAttemptId,
    activationReceiptId,
    registryPath: REGISTRY_PATH,
    registryHash: targetRegistryHash,
    requirementRecordHash: fileHash(recordPath),
  });
  const candidateSnapshotHash = directoryHash(snapshotRoot);
  const commandReceipts = executeCommands(root, commandPlans);
  const receiptSchemaPath = path.resolve(
    __dirname,
    '..',
    'schemas',
    'requirements-contract-production-activation-receipt.schema.json'
  );
  const baseReceipt = {
    schemaVersion: 'requirements-contract-production-activation-receipt/v1',
    requirementSetId,
    implementationAttemptId,
    activationAttemptId,
    activationReceiptId,
    selectedReceiptSchemaVersion: 'requirements-contract-production-activation-receipt/v1',
    selectedReceiptSchemaHash: fileHash(receiptSchemaPath),
    activationPlan: {
      path: planRelativePath,
      hash: planHash,
      promotionReceiptPath: promotionRelativePath,
      promotionReceiptHash: fileHash(promotionPath),
    },
    candidateSnapshot: {
      path: plannedSnapshotPath,
      hash: candidateSnapshotHash,
    },
    commands: commandReceipts,
    lock: {
      acquired: false,
      lockIdentityHash: sha256(`requirements-contract-production-activation-lock/v1\n${LOCK_PATH}`),
    },
    compareAndSwap: {
      registryPreimageHash: preimageHash,
      registryTargetHash: targetRegistryHash,
      decision: 'blocked',
    },
  };
  const blocked = (code: string, phase: string, stderrHash = sha256('')) => {
    if (!fs.existsSync(registryPath) || fileHash(registryPath) !== preimageHash) {
      writeAtomicText(registryPath, registryPreimageText, `${activationAttemptId}.restore`);
    }
    const restoredRegistryHash = fileHash(registryPath);
    if (restoredRegistryHash !== preimageHash) {
      throw new Error('production_activate_registry_restore_failed');
    }
    const selectedReceiptPath = slash(
      path.join(options.blockedAttemptDir, `${activationAttemptId}.json`)
    );
    const receipt = {
      ...baseReceipt,
      activationOutcome: 'blocked',
      selectedReceiptPath,
      failure: { code, phase, stderrHash },
      restoration: {
        registryRestored: true,
        restoredRegistryHash,
        decision: 'pass',
      },
    };
    validate(
      receipt,
      'requirements-contract-production-activation-receipt.schema.json',
      'production_activate_receipt'
    );
    writeGovernedJson(resolveWithin(root, selectedReceiptPath), receipt);
    if (options.json) process.stdout.write(`${JSON.stringify(receipt)}\n`);
    return receipt;
  };
  const failedCommand = commandReceipts.find((command) => command.decision !== 'pass');
  if (failedCommand) {
    return blocked(
      'nested_command_failed',
      String(failedCommand.commandId).toLowerCase().replace('-', '_'),
      failedCommand.stderrHash
    );
  }
  const lockPath = resolveWithin(root, LOCK_PATH);
  fs.mkdirSync(path.dirname(lockPath), { recursive: true });
  try {
    fs.mkdirSync(lockPath);
  } catch {
    return blocked('activation_lock_unavailable', 'lock');
  }
  baseReceipt.lock.acquired = true;
  try {
    if (fileHash(registryPath) !== preimageHash) {
      return blocked('registry_preimage_mismatch', 'compare_and_swap');
    }
    writeAtomicText(registryPath, targetRegistryText, activationAttemptId);
    const readbackHash = fileHash(registryPath);
    if (readbackHash !== targetRegistryHash) {
      return blocked('registry_readback_mismatch', 'readback');
    }
    const selectedReceiptPath = slash(options.successReceipt);
    const receipt = {
      ...baseReceipt,
      activationOutcome: 'success',
      selectedReceiptPath,
      compareAndSwap: {
        ...baseReceipt.compareAndSwap,
        decision: 'pass',
      },
      readback: {
        registryHash: readbackHash,
        selectorDecision: 'pass',
        activeImplementationAttemptId: implementationAttemptId,
        decision: 'pass',
      },
    };
    validate(
      receipt,
      'requirements-contract-production-activation-receipt.schema.json',
      'production_activate_receipt'
    );
    if (fs.existsSync(successReceiptPath)) {
      return blocked('success_receipt_already_exists', 'receipt');
    }
    writeGovernedJson(successReceiptPath, receipt);
    if (options.json) process.stdout.write(`${JSON.stringify(receipt)}\n`);
    return receipt;
  } finally {
    fs.rmSync(lockPath, { recursive: true, force: true });
  }
}
