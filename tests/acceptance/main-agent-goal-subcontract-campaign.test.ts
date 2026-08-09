import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { runNativeGoalInvocation } from '../../packages/bmad-speckit/src/main-agent/actions/native-goal-invoker';

const hash = (value: string | Buffer) =>
  `sha256:${createHash('sha256').update(value).digest('hex')}`;
const write = (file: string, value: string) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, value, 'utf8');
  return hash(fs.readFileSync(file));
};

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'governed-campaign-'));
  const out = path.join(root, '_bmad-output', 'runtime', 'trace-execution', 'packet-1');
  const model = path.join(out, 'model_packet.json');
  const human = path.join(out, 'human_prompt.txt');
  const audit = path.join(out, 'audit_receipt.json');
  const goal = path.join(out, 'goal_execution.md');
  const transaction = path.join(out, 'prompt-transaction-manifest.json');
  const pointer = path.join(out, 'current-dispatch-pointer.json');
  const taskReportPath = path.join(out, 'task-report.json');
  const commandText = `/goal Execute packet-1 by following ${goal}`;
  const modelHash = write(model, '{"packetId":"packet-1"}\n');
  const humanHash = write(human, 'human\n');
  const goalHash = write(goal, '# Goal\n');
  const auditHash = write(
    audit,
    `${JSON.stringify({
      decision: 'pass',
      goalCommand: {
        mode: 'native_goal_document_ref',
        commandText,
        documentPath: goal,
        documentHash: goalHash,
        nativeGoalCommandUsed: true,
      },
      continuationDirective: {
        directive: commandText,
        nativeGoalCommandUsed: true,
      },
    })}\n`
  );
  const transactionHash = write(transaction, '{}\n');
  const pointerHash = write(pointer, '{}\n');
  const compiledPromptRef = {
    modelPacketPath: model,
    modelPacketHash: modelHash,
    humanPromptPath: human,
    humanPromptHash: humanHash,
    auditReceiptPath: audit,
    auditReceiptHash: auditHash,
    goalExecutionPath: goal,
    goalExecutionHash: goalHash,
    sourceDocumentHash: hash('source'),
    implementationConfirmationHash: hash('confirmation'),
  };
  const packet = {
    packetId: 'packet-1',
    parentSessionId: 'REQ-1',
    expectedDelta: 'campaign',
    executionStrategy: { strategyId: 'governed_skill_adapter', availability: 'available' },
  };
  const attemptBundle = {
    sourceDocumentHash: compiledPromptRef.sourceDocumentHash,
    implementationConfirmationHash: compiledPromptRef.implementationConfirmationHash,
    modelPacketHash: modelHash,
    auditReceiptHash: auditHash,
    goalExecutionHash: goalHash,
    transactionManifestPath: transaction,
    transactionManifestHash: transactionHash,
    currentDispatchPointerPath: pointer,
    currentDispatchPointerHash: pointerHash,
  };
  return { root, packet, compiledPromptRef, taskReportPath, attemptBundle, commandText };
}

function campaign(events: string[]) {
  const packageHash = hash('package');
  const campaignPromptHash = hash('campaign-prompt');
  const compileReceiptHash = hash('compile-receipt');
  return {
    children: [{ partitionId: 'child-1' }, { partitionId: 'child-2' }],
    requirementRecordBinding: { status: 'absent' },
    packageRequestRef: { path: 'package-request.json', hash: hash('package-request') },
    partitionManifestRef: { path: 'partition-manifest.json', hash: hash('partition-manifest') },
    dependencies: {
      compileExecutionPackage: () => ({
        packageManifestHash: packageHash,
        packageManifestPath: 'package/package-manifest.json',
        campaignPromptPath: 'package/campaign-prompt.md',
        campaignPromptHash,
        packageCompileReceiptPath: 'package/compile-receipt.json',
        packageCompileReceiptHash: compileReceiptHash,
      }),
      auditExecutionPackage: () => ({ status: 'pass', packageManifestHash: packageHash }),
      auditCompletedChild: ({ child }: any) => {
        events.push(`audit:${child.partitionId}`);
        return {
          status: 'closed',
          partitionId: child.partitionId,
          commitHash: hash(child.partitionId),
        };
      },
      auditCompletedCampaign: () => ({
        status: 'done',
        packageManifestHash: packageHash,
        campaignReportHash: hash('campaign'),
      }),
    },
  };
}

describe('Main Agent governed Goal campaign native hook', () => {
  it('uses one host invocation and projects the audited campaign TaskReport', () => {
    const value = fixture();
    try {
      const events: string[] = [];
      let invocations = 0;
      const result = runNativeGoalInvocation({
        ...value,
        projectRoot: value.root,
        host: 'codex',
        governedCampaign: campaign(events),
        executor: (input: any) => {
          invocations += 1;
          expect(input.commandText).toContain(value.commandText);
          expect(input.commandText).toContain('package/package-manifest.json');
          const childInvocations = input.children.map((child: Record<string, unknown>) => {
            expect(input.reportChildResult(child)).toBe(true);
            return child;
          });
          return {
            exitCode: 0,
            childInvocations,
          };
        },
      } as any);
      expect(invocations).toBe(1);
      expect(events).toEqual(['audit:child-1', 'audit:child-2']);
      expect(result.status).toBe('executed');
      expect(result.taskReport).toMatchObject({ packetId: 'packet-1', status: 'done' });
      expect(JSON.parse(fs.readFileSync(value.taskReportPath, 'utf8'))).toEqual(result.taskReport);
    } finally {
      fs.rmSync(value.root, { recursive: true, force: true });
    }
  });

  it('does not fabricate a TaskReport when the governed executor is unavailable', () => {
    const value = fixture();
    try {
      const result = runNativeGoalInvocation({
        ...value,
        projectRoot: value.root,
        host: 'codex',
        governedCampaign: campaign([]),
      } as any);
      expect(result.status).toBe('awaiting_task_report');
      expect(result.validationErrors).toContain('governed_campaign_executor_unavailable');
      expect(fs.existsSync(value.taskReportPath)).toBe(false);
    } finally {
      fs.rmSync(value.root, { recursive: true, force: true });
    }
  });

  it('does not authorize child 2 after child 1 audit fails', () => {
    const value = fixture();
    try {
      const audited: string[] = [];
      const governedCampaign = campaign(audited);
      governedCampaign.dependencies.auditCompletedChild = ({ child }: any) => {
        audited.push(child.partitionId);
        return {
          status: 'blocked',
          partitionId: child.partitionId,
          failureClass: 'child_audit_failed',
          driftFlags: ['child_audit_failed'],
        };
      };
      const dispatched: string[] = [];
      const result = runNativeGoalInvocation({
        ...value,
        projectRoot: value.root,
        host: 'codex',
        governedCampaign,
        executor: (input: any) => {
          const childInvocations: Array<Record<string, unknown>> = [];
          for (const child of input.children) {
            dispatched.push(child.partitionId);
            childInvocations.push(child);
            if (!input.reportChildResult(child)) break;
          }
          return { exitCode: 0, childInvocations };
        },
      } as any);
      expect(result.status).toBe('executed');
      expect(result.taskReport).toMatchObject({
        status: 'blocked',
        driftFlags: ['child_audit_failed'],
      });
      expect(audited).toEqual(['child-1']);
      expect(dispatched).toEqual(['child-1']);
    } finally {
      fs.rmSync(value.root, { recursive: true, force: true });
    }
  });

  it('blocks a host that reports child 2 after authorization was denied', () => {
    const value = fixture();
    try {
      const governedCampaign = campaign([]);
      governedCampaign.dependencies.auditCompletedChild = ({ child }: any) => ({
        status: 'blocked',
        partitionId: child.partitionId,
        failureClass: 'child_audit_failed',
      });
      const result = runNativeGoalInvocation({
        ...value,
        projectRoot: value.root,
        host: 'codex',
        governedCampaign,
        executor: (input: any) => {
          input.reportChildResult({ partitionId: 'child-1' });
          input.reportChildResult({ partitionId: 'child-2' });
          return { exitCode: 0 };
        },
      } as any);
      expect(result.status).toBe('blocked');
      expect(result.validationErrors).toContain(
        'main_agent_goal_child_dispatched_after_audit_failure'
      );
    } finally {
      fs.rmSync(value.root, { recursive: true, force: true });
    }
  });

  it('blocks a host that reports the same child twice', () => {
    const value = fixture();
    try {
      const audited: string[] = [];
      const governedCampaign = campaign(audited);
      const result = runNativeGoalInvocation({
        ...value,
        projectRoot: value.root,
        host: 'codex',
        governedCampaign,
        executor: (input: any) => {
          const child = input.children[0];
          expect(input.reportChildResult(child)).toBe(true);
          expect(() => input.reportChildResult(child)).toThrow(
            'main_agent_goal_campaign_input_invalid'
          );
          return { exitCode: 0, childInvocations: [child] };
        },
      } as any);
      expect(result.status).toBe('executed');
      expect(result.taskReport).toMatchObject({ status: 'partial' });
      expect(audited).toEqual(['audit:child-1']);
    } finally {
      fs.rmSync(value.root, { recursive: true, force: true });
    }
  });

  it('blocks a host that reports child 2 before child 1', () => {
    const value = fixture();
    try {
      const audited: string[] = [];
      const result = runNativeGoalInvocation({
        ...value,
        projectRoot: value.root,
        host: 'codex',
        governedCampaign: campaign(audited),
        executor: (input: any) => {
          input.reportChildResult(input.children[1]);
          return { exitCode: 0 };
        },
      } as any);
      expect(result.status).toBe('blocked');
      expect(result.validationErrors).toContain(
        'main_agent_goal_campaign_input_invalid'
      );
      expect(result.taskReport).toBeNull();
      expect(audited).toEqual([]);
    } finally {
      fs.rmSync(value.root, { recursive: true, force: true });
    }
  });
});
