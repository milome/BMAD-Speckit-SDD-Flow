import { randomUUID } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { requirementsContractProductionActivateCommand } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-production-activate';

function write(root: string, relativePath: string, value: string) {
  const target = path.join(root, relativePath);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, value, 'utf8');
}

interface ControlledCommand {
  commandId: string;
  fixtureOnly: boolean;
}

const CONTRACT_PATH =
  'docs/plans/2026-07-11-loop-engineering-evidence-closure-remediation-goal-execution-plan.md';
const LOCK_PATH =
  '_bmad/shared/requirements-contract/.requirements-contract-consumer-registry.activation.lock';

function activationCommands(): ControlledCommand[] {
  const schema = JSON.parse(
    readFileSync(
      path.resolve(
        'packages/bmad-speckit/src/main-agent/source-authority/schemas/requirements-contract-production-activate-input.schema.json'
      ),
      'utf8'
    )
  );
  return schema.properties.controlledCommands.const;
}

function writeActivationContract(
  root: string,
  commands: ControlledCommand[],
  commandText: (command: ControlledCommand, index: number) => string
) {
  const commandRows = commands.map(
    (command, index) =>
      `| ${command.commandId} | \`${commandText(
        command,
        index
      )}\` | Repository root | pass | AC-01 |`
  );
  write(root, CONTRACT_PATH, `${commandRows.join('\n')}\n`);
}

function fixture() {
  const root = mkdtempSync(path.join(tmpdir(), 'requirements-production-activate-'));
  const requirementSetId = `req-${randomUUID()}`;
  const implementationAttemptId = `IMPL-ATTEMPT-${randomUUID().toUpperCase()}`;
  const recordPath =
    `_bmad-output/runtime/requirement-records/${requirementSetId}/requirement-record.json`;
  const registryPath =
    '_bmad/shared/requirements-contract/requirements-contract-consumer-registry.json';
  write(
    root,
    recordPath,
    `${JSON.stringify({
      schemaVersion: 'requirement-record/v1',
      recordId: requirementSetId,
      requirementSetId,
      currentAttemptId: implementationAttemptId,
      status: 'user_confirmed',
    })}\n`
  );
  write(
    root,
    registryPath,
    `${JSON.stringify({
      schemaVersion: 'requirements-contract-consumer-registry/v1',
      requirementSetId,
      shadowOutputEnabled: true,
      v1OutputEnabled: true,
      productionReadModelVersion: 'v1',
      activationReceiptId: null,
      consumers: [],
    })}\n`
  );
  write(root, 'packages/bmad-speckit/bin/bmad-speckit.js', '#!/usr/bin/env node\n');
  const controlledCommands = activationCommands();
  const commandIds = controlledCommands.map(({ commandId }) => commandId);
  writeActivationContract(
    root,
    controlledCommands,
    ({ commandId }) =>
      `node -e "require('fs').appendFileSync('command-order.txt','${commandId}\\n')"`
  );
  return {
    root,
    recordPath,
    registryPath,
    requirementSetId,
    implementationAttemptId,
    controlledCommands,
    commandIds,
  };
}

function options(value: ReturnType<typeof fixture>) {
  return {
    cwd: value.root,
    requirementRecord: value.recordPath,
    registry: value.registryPath,
    activationPlanDir:
      'docs/plans/evidence/loop-engineering-remediation/normalized-contract-activation-plans',
    activationPlanWriteReceiptDir:
      'docs/plans/evidence/loop-engineering-remediation/normalized-contract-activation-plan-write-receipts',
    successReceipt:
      'docs/plans/evidence/loop-engineering-remediation/normalized-contract-activation-receipt.json',
    blockedAttemptDir:
      'docs/plans/evidence/loop-engineering-remediation/normalized-contract-activation-attempts',
    json: false,
  };
}

describe('requirements contract production activate command', () => {
  it('does not hard-code controlled command identities in the runtime', () => {
    const source = readFileSync(
      path.resolve(
        'packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-production-activate.ts'
      ),
      'utf8'
    );

    expect(source).not.toMatch(/\bCMD-\d+\b/u);
  });

  it('plans, tests, and atomically activates the exact registry preimage', async () => {
    const value = fixture();
    try {
      const receipt = await requirementsContractProductionActivateCommand(options(value));

      const registry = JSON.parse(readFileSync(path.join(value.root, value.registryPath), 'utf8'));
      expect(receipt.activationOutcome).toBe('success');
      expect(receipt.implementationAttemptId).toBe(value.implementationAttemptId);
      expect(registry).toMatchObject({
        shadowOutputEnabled: false,
        v1OutputEnabled: false,
        productionReadModelVersion: 'v2',
        activationReceiptId: receipt.activationReceiptId,
      });
      expect(readFileSync(path.join(value.root, 'command-order.txt'), 'utf8')).toBe(
        `${value.commandIds.join('\n')}\n`
      );
      const plan = JSON.parse(
        readFileSync(path.join(value.root, receipt.activationPlan.path), 'utf8')
      );
      expect(
        plan.nestedCommands.map(({ commandId, fixtureOnly }: ControlledCommand) => ({
          commandId,
          fixtureOnly,
        }))
      ).toEqual(value.controlledCommands);
      expect(existsSync(path.join(value.root, receipt.activationPlan.path))).toBe(true);
      expect(existsSync(path.join(value.root, receipt.selectedReceiptPath))).toBe(true);
    } finally {
      rmSync(value.root, { recursive: true, force: true });
    }
  });

  it('restores the registry preimage when a success receipt collision blocks activation', async () => {
    const value = fixture();
    try {
      const registryPath = path.join(value.root, value.registryPath);
      const preimage = readFileSync(registryPath, 'utf8');
      const commandOptions = options(value);
      write(value.root, commandOptions.successReceipt, '{"existing":true}\n');

      const receipt = await requirementsContractProductionActivateCommand(commandOptions);

      expect(receipt).toMatchObject({
        activationOutcome: 'blocked',
        failure: { code: 'success_receipt_already_exists', phase: 'receipt' },
        restoration: { registryRestored: true, decision: 'pass' },
      });
      expect(readFileSync(registryPath, 'utf8')).toBe(preimage);
      expect(existsSync(path.join(value.root, receipt.selectedReceiptPath))).toBe(true);
    } finally {
      rmSync(value.root, { recursive: true, force: true });
    }
  });

  it('restores the registry preimage when nested command drift blocks compare-and-swap', async () => {
    const value = fixture();
    try {
      const registryPath = path.join(value.root, value.registryPath);
      const preimage = readFileSync(registryPath, 'utf8');
      const commandOptions = options(value);
      writeActivationContract(
        value.root,
        value.controlledCommands,
        ({ commandId }, index) =>
          index === 0
            ? `node -e "require('fs').writeFileSync('${value.registryPath}','registry-drift')"`
            : `node -e "require('fs').appendFileSync('command-order.txt','${commandId}\\n')"`
      );

      const receipt = await requirementsContractProductionActivateCommand(commandOptions);

      expect(receipt).toMatchObject({
        activationOutcome: 'blocked',
        failure: { code: 'registry_preimage_mismatch', phase: 'compare_and_swap' },
        compareAndSwap: { decision: 'blocked' },
        restoration: { registryRestored: true, decision: 'pass' },
      });
      expect(readFileSync(registryPath, 'utf8')).toBe(preimage);
      expect(existsSync(path.join(value.root, receipt.selectedReceiptPath))).toBe(true);
      expect(existsSync(path.join(value.root, commandOptions.successReceipt))).toBe(false);
    } finally {
      rmSync(value.root, { recursive: true, force: true });
    }
  });

  it('blocks without disturbing the registry or an externally held activation lock', async () => {
    const value = fixture();
    try {
      const registryPath = path.join(value.root, value.registryPath);
      const preimage = readFileSync(registryPath, 'utf8');
      const commandOptions = options(value);
      mkdirSync(path.join(value.root, LOCK_PATH), { recursive: true });

      const receipt = await requirementsContractProductionActivateCommand(commandOptions);

      expect(receipt).toMatchObject({
        activationOutcome: 'blocked',
        failure: { code: 'activation_lock_unavailable', phase: 'lock' },
        lock: { acquired: false },
        restoration: { registryRestored: true, decision: 'pass' },
      });
      expect(readFileSync(registryPath, 'utf8')).toBe(preimage);
      expect(existsSync(path.join(value.root, receipt.selectedReceiptPath))).toBe(true);
      expect(existsSync(path.join(value.root, commandOptions.successReceipt))).toBe(false);
      expect(existsSync(path.join(value.root, LOCK_PATH))).toBe(true);
    } finally {
      rmSync(value.root, { recursive: true, force: true });
    }
  });
});
