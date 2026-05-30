import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  resolveConfirmedSource,
  runMainAgentCompiledPrompt,
} from '../../scripts/main-agent-compiled-prompt-runner';
import { resolveExecutionDisciplineProfile } from '../../scripts/execution-discipline-profiles';
import {
  buildExecutionStrategyOptions,
  selectExecutionStrategy,
} from '../../scripts/execution-strategy-selection';

function sha256Text(value: string): string {
  return `sha256:${createHash('sha256').update(value, 'utf8').digest('hex')}`;
}

function writeJson(filePath: string, value: unknown): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

type FakeReqTraceBehavior =
  | 'pass'
  | 'block'
  | 'fallbackGoal'
  | 'inlineGoal'
  | 'missingAudit'
  | 'missingModel'
  | 'missingGoalDocument'
  | 'overlongGoal';

function writeFakeReqTraceSkill(root: string, behavior: FakeReqTraceBehavior): string {
  const skillDir = path.join(root, '_bmad', 'skills', 'req-trace-matrix-prompt-generator');
  const scriptPath = path.join(skillDir, 'scripts', 'generate_prompt.js');
  mkdirSync(path.dirname(scriptPath), { recursive: true });
  writeFileSync(
    scriptPath,
    [
      '#!/usr/bin/env node',
      "const fs = require('node:fs');",
      "const path = require('node:path');",
      "const crypto = require('node:crypto');",
      "function arg(name) { const i = process.argv.indexOf(name); return i === -1 ? null : process.argv[i + 1]; }",
      "function sha(v) { return 'sha256:' + crypto.createHash('sha256').update(v, 'utf8').digest('hex'); }",
      "const outDir = arg('--out-dir');",
      "const recordPath = arg('--requirement-record');",
      "const sourcePath = arg('--source-document');",
      "const profilePath = arg('--execution-discipline-profile-ref');",
      "if (!outDir || !recordPath || !sourcePath) { console.log('BLOCK: missing args'); process.exit(3); }",
      "fs.mkdirSync(outDir, { recursive: true });",
      "fs.writeFileSync(path.join(outDir, 'compiler-invocation.json'), JSON.stringify({ main: require.main.filename, argv: process.argv.slice(2) }, null, 2));",
      "const record = JSON.parse(fs.readFileSync(recordPath, 'utf8'));",
      "const profile = profilePath ? JSON.parse(fs.readFileSync(profilePath, 'utf8')) : null;",
      behavior === 'block'
        ? "fs.writeFileSync(path.join(outDir, 'audit_receipt.json'), JSON.stringify({ decision: 'blocked', blockingReasons: ['FAKE_BLOCK'], executionDisciplineProfile: profile }, null, 2)); console.log('BLOCK: FAKE_BLOCK'); process.exit(3);"
        : "void 0;",
      "const modelPacket = { artifactRole: 'execution_authority', sourceDocumentHash: record.sourceDocumentHash, implementationConfirmationHash: record.implementationConfirmationHash, executionDisciplineProfile: profile };",
      behavior === 'missingModel'
        ? "void 0;"
        : "fs.writeFileSync(path.join(outDir, 'model_packet.json'), JSON.stringify(modelPacket, null, 2));",
      "fs.writeFileSync(path.join(outDir, 'human_prompt.txt'), `Execution Discipline Profile\\nprofileId: ${profile.profileId}\\nprofileHash: ${profile.profileHash}\\nmodel_packet.json is the machine-readable execution authority\\ncompiled direct body\\n`);",
      behavior === 'inlineGoal'
        ? "const goalCommand = { mode: 'native_goal_inline' };"
        : behavior === 'fallbackGoal'
          ? "const goalCommand = { mode: 'fallback_prompt_contract' };"
        : behavior === 'missingGoalDocument'
          ? "const goalCommand = { mode: 'native_goal_document_ref', documentPath: path.join(outDir, 'goal_execution.md'), documentHash: 'sha256:0000000000000000000000000000000000000000000000000000000000000000' };"
          : behavior === 'overlongGoal'
            ? "console.log('BLOCK: GOAL_COMMAND_TOO_LONG'); process.exit(3);"
            : "const goalPath = path.join(outDir, 'goal_execution.md'); fs.writeFileSync(goalPath, `## Execution Discipline Profile\\nprofileId: ${profile.profileId}\\nprofileHash: ${profile.profileHash}\\n`); const goalCommand = { mode: 'native_goal_document_ref', documentHash: sha(fs.readFileSync(goalPath, 'utf8')) };",
      "const receipt = { decision: 'pass', goalCommand, executionHost: arg('--execution-host'), humanPromptProfile: arg('--human-prompt-profile'), humanPromptLanguage: arg('--prompt-language'), continuationDirective: { strategy: 'test' }, humanPromptRequiredFragmentsPassed: true, executionDisciplineProfile: { profileId: profile.profileId, profileHash: profile.profileHash, humanPromptProfileRendered: true, goalExecutionProfileRendered: true } };",
      behavior === 'missingAudit'
        ? "void 0;"
        : "fs.writeFileSync(path.join(outDir, 'audit_receipt.json'), JSON.stringify(receipt, null, 2));",
      "process.exit(0);",
      '',
    ].join('\n'),
    'utf8'
  );
  return skillDir;
}

function writeRequirementRecord(root: string, options: { confirmed: boolean; sourceExists?: boolean }): {
  recordPath: string;
  sourcePath: string;
  sourceDocumentHash: string;
  implementationConfirmationHash: string;
} {
  const suffix = `${options.confirmed ? 'confirmed' : 'draft'}-${options.sourceExists === false ? 'missing' : 'present'}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const recordDir = path.join(root, '_bmad-output', 'runtime', 'requirement-records', `REQ-DISPATCH-${suffix}`);
  const sourcePath = path.join(root, 'docs', 'requirements', `dispatch-${suffix}.md`);
  if (options.sourceExists ?? true) {
    mkdirSync(path.dirname(sourcePath), { recursive: true });
    writeFileSync(sourcePath, '# Dispatch fixture\n', 'utf8');
  }
  const sourceDocumentHash = sha256Text('source');
  const implementationConfirmationHash = sha256Text('confirmation');
  const record = {
    recordId: 'REQ-DISPATCH',
    requirementSetId: 'REQ-DISPATCH',
    status: options.confirmed ? 'user_confirmed' : 'draft',
    flow: 'standalone_tasks',
    stage: 'implement',
    sourcePath,
    sourceDocumentHash,
    implementationConfirmationHash,
    confirmationHistory: options.confirmed
      ? [
          {
            eventType: 'confirmation_recorded',
            sourceDocumentHash,
            implementationConfirmationHash,
          },
        ]
      : [],
  };
  const recordPath = path.join(recordDir, 'requirement-record.json');
  writeJson(recordPath, record);
  return { recordPath, sourcePath, sourceDocumentHash, implementationConfirmationHash };
}

describe('req-trace main-agent dispatch integration', () => {
  it('resolves confirmed and unconfirmed source states without legacy fallback on broken confirmation', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'req-trace-dispatch-resolution-'));
    try {
      const confirmed = writeRequirementRecord(root, { confirmed: true });
      expect(resolveConfirmedSource({ projectRoot: root, recordPath: confirmed.recordPath }).status).toBe(
        'confirmed'
      );

      const unconfirmed = writeRequirementRecord(root, { confirmed: false });
      expect(resolveConfirmedSource({ projectRoot: root, recordPath: unconfirmed.recordPath }).status).toBe(
        'no_confirmed_source'
      );

      const broken = writeRequirementRecord(root, { confirmed: true, sourceExists: false });
      expect(resolveConfirmedSource({ projectRoot: root, recordPath: broken.recordPath }).status).toBe(
        'confirmed_source_unresolvable'
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('calls req-trace compiler and returns hash-bound compiled artifacts for confirmed source', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'req-trace-dispatch-pass-'));
    try {
      const fixture = writeRequirementRecord(root, { confirmed: true });
      const reqTraceSkillDir = writeFakeReqTraceSkill(root, 'pass');
      const result = runMainAgentCompiledPrompt({
        projectRoot: root,
        recordPath: fixture.recordPath,
        packetId: 'implement-test',
        flow: 'standalone_tasks',
        executionHost: 'codex',
        executionDisciplineProfile: resolveExecutionDisciplineProfile('standalone_tasks'),
        goalCommandAvailable: 'true',
        reqTraceSkillDir,
      });

      expect(result.status).toBe('pass');
      expect(result.compiledPromptRef?.modelPacketPath).toContain('model_packet.json');
      expect(result.compiledPromptRef?.humanPromptPath).toContain('human_prompt.txt');
      expect(result.compiledPromptRef?.auditReceiptPath).toContain('audit_receipt.json');
      expect(result.compiledPromptRef?.goalExecutionPath).toContain('goal_execution.md');
      expect(result.compiledPromptRef?.sourceDocumentHash).toBe(fixture.sourceDocumentHash);
      expect(result.compiledPromptRef?.implementationConfirmationHash).toBe(
        fixture.implementationConfirmationHash
      );
      expect(readFileSync(path.join(result.outDir!, 'compiler.stdout.log'), 'utf8')).not.toContain(
        'BLOCK:'
      );
      const invocation = JSON.parse(
        readFileSync(path.join(result.outDir!, 'compiler-invocation.json'), 'utf8')
      ) as { main: string; argv: string[] };
      expect(path.normalize(invocation.main)).toBe(
        path.normalize(path.join(reqTraceSkillDir, 'scripts', 'generate_prompt.js'))
      );
      expect(invocation.argv).toContain('--requirement-record');
      expect(invocation.argv).toContain('--source-document');
      expect(invocation.argv).toContain('--out-dir');
      expect(invocation.argv).toContain('--execution-discipline-profile-ref');
      expect(invocation.argv).toEqual(
        expect.arrayContaining(['--goal-command-available', 'true'])
      );
      const modelPacket = JSON.parse(readFileSync(result.compiledPromptRef!.modelPacketPath, 'utf8'));
      expect(modelPacket.artifactRole).toBe('execution_authority');
      const humanPrompt = readFileSync(result.compiledPromptRef!.humanPromptPath, 'utf8');
      expect(humanPrompt).toContain('Execution Discipline Profile');
      expect(humanPrompt).toContain('compiled direct body');
      expect(humanPrompt).not.toContain('BUG-A4-IMPL');
      expect(humanPrompt).not.toContain('STORY-A3-DEV');
      expect(humanPrompt).not.toContain('standalone implementation prompt');
      const receipt = JSON.parse(readFileSync(result.compiledPromptRef!.auditReceiptPath, 'utf8'));
      expect(receipt.goalCommand.mode).toBe('native_goal_document_ref');
      expect(result.compiledPromptRef?.goalExecutionPath).toContain('goal_execution.md');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('blocks dispatch when compiler artifacts or native goal projection are invalid', () => {
    const cases: Array<[FakeReqTraceBehavior, string]> = [
      ['block', 'compiler_block'],
      ['fallbackGoal', 'native_goal_document_ref_required:fallback_prompt_contract'],
      ['inlineGoal', 'native_goal_inline_rejected'],
      ['missingAudit', 'audit_receipt_missing'],
      ['missingModel', 'model_packet_missing'],
      ['missingGoalDocument', 'goal_execution_missing'],
      ['overlongGoal', 'compiler_block'],
    ];
    for (const [behavior, blocker] of cases) {
      const root = mkdtempSync(path.join(os.tmpdir(), `req-trace-dispatch-${behavior}-`));
      try {
        const fixture = writeRequirementRecord(root, { confirmed: true });
        const result = runMainAgentCompiledPrompt({
          projectRoot: root,
          recordPath: fixture.recordPath,
          packetId: `implement-${behavior}`,
          flow: 'standalone_tasks',
          executionHost: 'codex',
          executionDisciplineProfile: resolveExecutionDisciplineProfile('standalone_tasks'),
          goalCommandAvailable: 'true',
          reqTraceSkillDir: writeFakeReqTraceSkill(root, behavior),
        });

        expect(result.status).toBe('blocked');
        expect(result.blockingReasons).toContain(blocker);
        expect(result.compiledPromptRef).toBeNull();
        if (behavior === 'overlongGoal') {
          expect(readFileSync(path.join(result.outDir!, 'compiler.stdout.log'), 'utf8')).toContain(
            'BLOCK: GOAL_COMMAND_TOO_LONG'
          );
        }
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    }
  });

  it('uses legacy fallback only when no confirmed source exists', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'req-trace-dispatch-legacy-'));
    try {
      const fixture = writeRequirementRecord(root, { confirmed: false });
      const result = runMainAgentCompiledPrompt({
        projectRoot: root,
        recordPath: fixture.recordPath,
        packetId: 'implement-legacy',
        flow: 'standalone_tasks',
        executionHost: 'codex',
        executionDisciplineProfile: resolveExecutionDisciplineProfile('standalone_tasks'),
      });

      expect(result.status).toBe('no_confirmed_source');
      expect(result.compiledPromptRef).toBeNull();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('blocks strategy selection from human_prompt.txt alone and keeps old-skill strategies uncertified', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'req-trace-dispatch-strategy-'));
    try {
      const fixture = writeRequirementRecord(root, { confirmed: true });
      const result = runMainAgentCompiledPrompt({
        projectRoot: root,
        recordPath: fixture.recordPath,
        packetId: 'implement-strategy',
        flow: 'standalone_tasks',
        executionHost: 'codex',
        executionDisciplineProfile: resolveExecutionDisciplineProfile('standalone_tasks'),
        goalCommandAvailable: 'true',
        reqTraceSkillDir: writeFakeReqTraceSkill(root, 'pass'),
      });
      expect(result.status).toBe('pass');
      const humanPromptOnly = {
        ...result.compiledPromptRef!,
        modelPacketPath: '',
        modelPacketHash: '',
      };
      expect(
        buildExecutionStrategyOptions({
          compiledPromptRef: humanPromptOnly,
          modelPacketGateDecision: 'pass',
        }).status
      ).toBe('blocked');

      const options = buildExecutionStrategyOptions({
        compiledPromptRef: result.compiledPromptRef,
        modelPacketGateDecision: 'pass',
      });
      expect(options.status).toBe('pass');
      expect(
        options.options.find((option) => option.strategyId === 'compiled_trace_direct')?.availability
      ).toBe('available');
      expect(
        options.options.find((option) => option.strategyId === 'compiled_trace_with_sdd_artifacts')
          ?.availability
      ).toBe('blocked_until_artifact_realization_lane');
      expect(
        options.options.find((option) => option.strategyId === 'governed_skill_adapter')
          ?.availability
      ).toBe('blocked_until_adapter_certification_gate');
      expect(() =>
        selectExecutionStrategy({
          optionsResult: options,
          strategyId: 'governed_skill_adapter',
          selectedBy: 'policy',
          policyDefaultAllowed: true,
        })
      ).toThrow(/execution strategy is not available/u);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
