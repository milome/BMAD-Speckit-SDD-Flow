const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const packageRoot = path.resolve(__dirname, '..');
const distRoot = path.join(packageRoot, 'dist', 'main-agent', 'source-authority');
const runtimePath = path.join(
  distRoot,
  'scripts',
  'requirements-contract-command-execution-receipt.js'
);
const schemaPath = path.join(
  distRoot,
  'schemas',
  'requirements-contract-command-execution-receipt.schema.json'
);

test('main-agent dist publishes the command execution Receipt schema beside its runtime', () => {
  assert.equal(fs.existsSync(runtimePath), true, `missing dist runtime: ${runtimePath}`);
  assert.equal(fs.existsSync(schemaPath), true, `missing dist schema: ${schemaPath}`);

  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-command-receipt-dist-'));
  try {
    const receiptPath = path.join(root, 'command-receipt.json');
    fs.writeFileSync(receiptPath, '{}\n', 'utf8');
    const runtime = require(runtimePath);
    const result = runtime.validateModelPacketCommandExecutionReceipts({
      projectRoot: root,
      modelPacket: {
        controlledExecutionContext: {
          requirementSetId: 'REQ-DIST-RECEIPT',
          transactionId: 'TX-DIST-RECEIPT',
          implementationAttemptId: 'IMP-DIST-RECEIPT',
          architectureAuditAttemptId: 'AUDIT-DIST-RECEIPT',
          activePhaseAuditAttemptId: 'AUDIT-DIST-RECEIPT',
          contractHash: `sha256:${'a'.repeat(64)}`,
          inputSnapshotHash: `sha256:${'b'.repeat(64)}`,
        },
        requiredCommands: [
          {
            id: 'CMD-DIST-RECEIPT',
            command: 'node --test',
            argv: ['node', '--test'],
            cwd: root,
            receiptPath,
            requirementRefs: ['S123'],
            acceptanceRefs: ['AC-150'],
            traceRefs: ['TR-150'],
          },
        ],
      },
    });

    assert.equal(result.decision, 'block');
    assert.deepEqual(result.issueCodes, [
      'required_command_receipt_schema_invalid:CMD-DIST-RECEIPT',
    ]);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
