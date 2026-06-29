import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { CompiledPromptRef } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/orchestration-dispatch-contract';
import { resolveNativeGoalCommand } from '../../packages/bmad-speckit/src/main-agent/actions/native-goal-command';

const roots: string[] = [];

function sha256Text(value: string): string {
  return `sha256:${createHash('sha256').update(value, 'utf8').digest('hex')}`;
}

function sha256File(filePath: string): string {
  return `sha256:${createHash('sha256').update(fs.readFileSync(filePath)).digest('hex')}`;
}

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function createCompiledPromptRef(input: {
  mode: string;
  commandText?: string;
  documentHash?: string;
  documentPath?: string | null;
}): { projectRoot: string; compiledPromptRef: CompiledPromptRef; goalExecutionPath: string } {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'native-goal-command-'));
  roots.push(projectRoot);
  const outDir = path.join(projectRoot, '_bmad-output', 'runtime', 'trace-execution', 'packet-1');
  fs.mkdirSync(outDir, { recursive: true });
  const modelPacketPath = path.join(outDir, 'model_packet.json');
  const humanPromptPath = path.join(outDir, 'human_prompt.txt');
  const auditReceiptPath = path.join(outDir, 'audit_receipt.json');
  const goalExecutionPath = path.join(outDir, 'goal_execution.md');
  const commandText =
    input.commandText ??
    `/goal Execute packet-1 by following ${goalExecutionPath}; use ${modelPacketPath} as authority; stop only on final pass or reconfirm_required.`;

  writeJson(modelPacketPath, { packetId: 'packet-1' });
  fs.writeFileSync(humanPromptPath, 'human prompt fixture\n', 'utf8');
  fs.writeFileSync(goalExecutionPath, '# goal execution fixture\n', 'utf8');
  writeJson(auditReceiptPath, {
    decision: 'pass',
    goalCommand: {
      mode: input.mode,
      chars: Array.from(commandText).length,
      documentPath: input.documentPath === undefined ? goalExecutionPath : input.documentPath,
      documentHash: input.documentHash ?? sha256File(goalExecutionPath),
      commandText,
      nativeGoalCommandUsed: input.mode === 'native_goal_document_ref',
    },
    continuationDirective: {
      directive: commandText,
      nativeGoalCommandUsed: input.mode === 'native_goal_document_ref',
    },
  });

  return {
    projectRoot,
    goalExecutionPath,
    compiledPromptRef: {
      modelPacketPath,
      modelPacketHash: sha256File(modelPacketPath),
      humanPromptPath,
      humanPromptHash: sha256File(humanPromptPath),
      auditReceiptPath,
      auditReceiptHash: sha256File(auditReceiptPath),
      goalExecutionPath,
      goalExecutionHash: sha256File(goalExecutionPath),
      sourceDocumentHash: sha256Text('source'),
      implementationConfirmationHash: sha256Text('confirmation'),
    },
  };
}

afterEach(() => {
  while (roots.length > 0) {
    const root = roots.pop();
    if (root) fs.rmSync(root, { recursive: true, force: true });
  }
});

describe('native goal command resolver', () => {
  it('returns hash-bound Codex native goal document-ref command metadata', () => {
    const fixture = createCompiledPromptRef({ mode: 'native_goal_document_ref' });

    const result = resolveNativeGoalCommand({
      projectRoot: fixture.projectRoot,
      host: 'codex',
      packetId: 'packet-1',
      compiledPromptRef: fixture.compiledPromptRef,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.reasonCode);
    expect(result.commandText).toMatch(/^\/goal Execute packet-1/u);
    expect(result.goalExecutionPath).toBe(fixture.goalExecutionPath);
    expect(result.goalExecutionHash).toBe(fixture.compiledPromptRef.goalExecutionHash);
    expect(result.auditReceiptPath).toBe(fixture.compiledPromptRef.auditReceiptPath);
    expect(result.goalCommand).toMatchObject({
      mode: 'native_goal_document_ref',
      commandText: result.commandText,
      documentPath: fixture.goalExecutionPath,
      documentHash: fixture.compiledPromptRef.goalExecutionHash,
      nativeGoalCommandUsed: true,
    });
  });

  it('returns hash-bound Claude native goal document-ref command metadata', () => {
    const fixture = createCompiledPromptRef({ mode: 'native_goal_document_ref' });

    const result = resolveNativeGoalCommand({
      projectRoot: fixture.projectRoot,
      host: 'claude-code-cli',
      packetId: 'packet-1',
      compiledPromptRef: fixture.compiledPromptRef,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.reasonCode);
    expect(result.commandText).toContain('reconfirm_required');
    expect(result.goalCommand.nativeGoalCommandUsed).toBe(true);
  });

  it.each(['native_goal_inline', 'fallback_prompt_contract'])(
    'rejects %s command modes for native goal hosts',
    (mode) => {
      const fixture = createCompiledPromptRef({ mode });

      const result = resolveNativeGoalCommand({
        projectRoot: fixture.projectRoot,
        host: 'codex',
        packetId: 'packet-1',
        compiledPromptRef: fixture.compiledPromptRef,
      });

      expect(result.ok).toBe(false);
      if (result.ok) throw new Error('expected blocked result');
      expect(result.reasonCode).toBe('native_goal_command_missing');
      expect(result.driftFlags).toContain('native-goal-command-missing');
    }
  );

  it('rejects document hash mismatch between audit receipt and goal_execution.md', () => {
    const fixture = createCompiledPromptRef({
      mode: 'native_goal_document_ref',
      documentHash: sha256Text('wrong-goal'),
    });

    const result = resolveNativeGoalCommand({
      projectRoot: fixture.projectRoot,
      host: 'codex',
      packetId: 'packet-1',
      compiledPromptRef: fixture.compiledPromptRef,
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected blocked result');
    expect(result.reasonCode).toBe('native_goal_document_hash_mismatch');
    expect(result.driftFlags).toContain('native-goal-document-hash-mismatch');
  });
});
