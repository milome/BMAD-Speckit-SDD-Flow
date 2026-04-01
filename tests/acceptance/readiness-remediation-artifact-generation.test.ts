import { execSync } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as yaml from 'js-yaml';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = path.join(import.meta.dirname, '..', '..');
const FIXED_DATE = '2026-03-27';

const CANONICAL_STEP_06 = path.join(
  REPO_ROOT,
  '_bmad',
  'bmm',
  'workflows',
  '3-solutioning',
  'check-implementation-readiness',
  'steps',
  'step-06-final-assessment.md'
);

const MIRROR_STEP_06 = path.join(
  REPO_ROOT,
  '_bmad',
  'bmm',
  'workflows',
  '3-solutioning',
  'bmad-check-implementation-readiness',
  'steps',
  'step-06-final-assessment.md'
);

interface StepContract {
  outputFile: string;
  remediationArtifactFile: string;
}

function loadStepContract(stepPath: string): StepContract {
  const raw = readFileSync(stepPath, 'utf8');
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) {
    throw new Error(`Missing frontmatter in ${stepPath}`);
  }

  const doc = yaml.load(match[1]) as Partial<StepContract> | undefined;
  if (!doc?.outputFile || !doc?.remediationArtifactFile) {
    throw new Error(`Step contract incomplete in ${stepPath}`);
  }

  return {
    outputFile: doc.outputFile,
    remediationArtifactFile: doc.remediationArtifactFile,
  };
}

function resolvePathTemplate(
  template: string,
  planningArtifactsRoot: string,
  branch: string,
  date: string
): string {
  return path.normalize(
    template
      .replace(/\{planning_artifacts\}/g, planningArtifactsRoot)
      .replace(/\{branch\}/g, branch)
      .replace(/\{\{date\}\}/g, date)
  );
}

function writeMinimalReadinessReport(reportPath: string, status: string): void {
  mkdirSync(path.dirname(reportPath), { recursive: true });
  writeFileSync(
    reportPath,
    [
      '# Implementation Readiness Report',
      '',
      '## Summary and Recommendations',
      '',
      '### Overall Readiness Status',
      '',
      status,
      '',
      '### Readiness Metrics',
      '',
      '- Blocker count: 2',
      '- Journey coverage percentage: 62%',
      '- Smoke E2E coverage count: 1',
      '- Stories without journey source: 1',
      '',
      '### Blockers Requiring Immediate Action',
      '',
      '- IR-BLK-001: Missing smoke E2E proof for the critical journey',
      '- IR-BLK-002: Fixture dependency is not specified',
      '',
    ].join('\n'),
    'utf8'
  );
}

function shellQuote(value: string): string {
  return `"${value.replace(/"/g, '\\"')}"`;
}

function writeGovernanceRunnerConfig(projectRoot: string): string {
  const sourceRules = path.join(REPO_ROOT, '_bmad', 'bmm', 'data', 'prompt-routing-rules.yaml');
  const targetRules = path.join(projectRoot, '_bmad', 'bmm', 'data', 'prompt-routing-rules.yaml');
  mkdirSync(path.dirname(targetRules), { recursive: true });
  writeFileSync(targetRules, readFileSync(sourceRules, 'utf8'), 'utf8');

  const configPath = path.join(projectRoot, '_bmad', '_config', 'governance-remediation.yaml');
  mkdirSync(path.dirname(configPath), { recursive: true });
  writeFileSync(
    configPath,
    [
      'version: 1',
      'primaryHost: cursor',
      'packetHosts:',
      '  - cursor',
      '  - claude',
      '  - codex',
      'provider:',
      '  mode: stub',
      '  id: readiness-governance-stub',
    ].join('\n'),
    'utf8'
  );
  return configPath;
}

function toPacketPath(remediationPath: string, host: 'cursor' | 'claude' | 'codex'): string {
  return remediationPath.replace(/\.md$/i, `.${host}-packet.md`);
}

function runReadinessRemediationRunnerCli(
  projectRoot: string,
  outputPath: string,
  outcome: string,
  gateFailureExists: boolean
): void {
  const configPath = writeGovernanceRunnerConfig(projectRoot);
  const command = [
    'npx',
    'ts-node',
    '--transpile-only',
    'scripts/governance-remediation-runner.ts',
    '--projectRoot',
    shellQuote(projectRoot),
    '--configPath',
    shellQuote(configPath),
    '--outputPath',
    shellQuote(outputPath),
    '--promptText',
    shellQuote('请执行 implementation readiness 审计，不要联网，直接给 blocker 修复建议。'),
    '--stageContextKnown true',
    `--gateFailureExists ${gateFailureExists ? 'true' : 'false'}`,
    '--blockerOwnershipLocked true',
    '--rootTargetLocked true',
    '--equivalentAdapterCount 1',
    '--attemptId',
    shellQuote(`implementation-readiness-${FIXED_DATE}`),
    '--sourceGateFailureIds',
    shellQuote('IR-BLK-001,IR-BLK-002'),
    '--capabilitySlot qa.readiness',
    '--canonicalAgent',
    shellQuote('PM + QA / readiness reviewer'),
    '--actualExecutor',
    shellQuote('implementation readiness workflow'),
    '--adapterPath',
    shellQuote('local workflow fallback'),
    '--targetArtifacts',
    shellQuote('prd.md,architecture.md,epics.md'),
    '--expectedDelta',
    shellQuote('close blockers on critical journey coverage and fixture readiness'),
    '--rerunOwner PM',
    '--rerunGate implementation-readiness',
    '--outcome',
    shellQuote(outcome),
    '--sharedArtifactsUpdated implementation-readiness-report',
    '--contradictionsDelta',
    shellQuote('2 opened / 0 closed'),
    '--externalProofAdded none',
    '--readyToRerunGate false',
    '--stopReason',
    shellQuote('critical blockers remain open'),
  ].join(' ');

  execSync(command, { cwd: REPO_ROOT, encoding: 'utf8' });
}

describe('readiness remediation artifact generation', () => {
  it('canonical step-06 contract can generate report + remediation artifact in the same branch-scoped planning folder', () => {
    const tmpRoot = mkdtempSync(path.join(os.tmpdir(), 'readiness-artifact-canonical-'));
    try {
      const branch = 'feature-readiness-artifact';
      const planningArtifactsRoot = path.join(tmpRoot, '_bmad-output', 'planning-artifacts');
      const stepContract = loadStepContract(CANONICAL_STEP_06);
      const reportPath = resolvePathTemplate(stepContract.outputFile, planningArtifactsRoot, branch, FIXED_DATE);
      const remediationPath = resolvePathTemplate(
        stepContract.remediationArtifactFile,
        planningArtifactsRoot,
        branch,
        FIXED_DATE
      );

      writeMinimalReadinessReport(reportPath, 'NOT READY');
      runReadinessRemediationRunnerCli(tmpRoot, remediationPath, 'not_ready', true);

      expect(existsSync(reportPath)).toBe(true);
      expect(existsSync(remediationPath)).toBe(true);
      expect(existsSync(toPacketPath(remediationPath, 'cursor'))).toBe(true);
      expect(existsSync(toPacketPath(remediationPath, 'claude'))).toBe(true);
      expect(reportPath).toContain(path.join('_bmad-output', 'planning-artifacts', branch));
      expect(remediationPath).toContain(path.join('_bmad-output', 'planning-artifacts', branch));
      expect(path.dirname(reportPath)).toBe(path.dirname(remediationPath));

      const remediation = readFileSync(remediationPath, 'utf8');
      const cursorPacket = readFileSync(toPacketPath(remediationPath, 'cursor'), 'utf8');
      const claudePacket = readFileSync(toPacketPath(remediationPath, 'claude'), 'utf8');
      expect(remediation).toContain('Attempt ID: implementation-readiness-2026-03-27');
      expect(remediation).toContain('Capability Slot: qa.readiness');
      expect(remediation).toContain('Actual Executor: implementation readiness workflow');
      expect(remediation).toContain('Outcome: not_ready');
      expect(remediation).toContain('Source GateFailure IDs: IR-BLK-001, IR-BLK-002');
      expect(remediation).toContain('- implementation-readiness-report');
      expect(remediation).toContain('- Blocker ownership affected: no');
      expect(remediation).toContain('## Remediation Audit Trace Summary');
      expect(remediation).toContain('Routing Mode: generic');
      expect(remediation).toContain('Executor Route: default-gate-remediation');
      expect(remediation).toContain('Stop Reason: critical blockers remain open');
      expect(remediation).toContain('Journey Contract Signals: (none)');
      expect(remediation).toContain('## Governance Remediation Runner Summary');
      expect(remediation).toContain('## Loop State Trace Summary');
      expect(remediation).toContain('- Stop Reason: critical blockers remain open');
      expect(cursorPacket).toContain('# Governance Remediation Task Packet');
      expect(cursorPacket).toContain('cursor-mcp-task');
      expect(cursorPacket).toContain('## Remediation Audit Trace Summary');
      expect(cursorPacket).toContain('Stop Reason: critical blockers remain open');
      expect(cursorPacket).toContain('Journey Contract Signals: (none)');
      expect(claudePacket).toContain('claude-agent-tool');
      expect(claudePacket).toContain('## Remediation Audit Trace Summary');
      expect(claudePacket).toContain('Stop Reason: critical blockers remain open');
    } finally {
      rmSync(tmpRoot, { recursive: true, force: true });
    }
  });

  it('mirror step-06 contract can generate remediation artifact beside the readiness report without branch expansion', () => {
    const tmpRoot = mkdtempSync(path.join(os.tmpdir(), 'readiness-artifact-mirror-'));
    try {
      const branch = 'ignored-branch-value';
      const planningArtifactsRoot = path.join(tmpRoot, '_bmad-output', 'planning-artifacts');
      const stepContract = loadStepContract(MIRROR_STEP_06);
      const reportPath = resolvePathTemplate(stepContract.outputFile, planningArtifactsRoot, branch, FIXED_DATE);
      const remediationPath = resolvePathTemplate(
        stepContract.remediationArtifactFile,
        planningArtifactsRoot,
        branch,
        FIXED_DATE
      );

      writeMinimalReadinessReport(reportPath, 'NEEDS WORK');
      runReadinessRemediationRunnerCli(tmpRoot, remediationPath, 'needs_work', true);

      expect(existsSync(reportPath)).toBe(true);
      expect(existsSync(remediationPath)).toBe(true);
      expect(existsSync(toPacketPath(remediationPath, 'cursor'))).toBe(true);
      expect(existsSync(toPacketPath(remediationPath, 'claude'))).toBe(true);
      expect(reportPath).toBe(
        path.join(planningArtifactsRoot, `implementation-readiness-report-${FIXED_DATE}.md`)
      );
      expect(remediationPath).toBe(
        path.join(planningArtifactsRoot, `implementation-readiness-remediation-${FIXED_DATE}.md`)
      );

      const remediation = readFileSync(remediationPath, 'utf8');
      const cursorPacket = readFileSync(toPacketPath(remediationPath, 'cursor'), 'utf8');
      expect(remediation).toContain('Rerun Gate: implementation-readiness');
      expect(remediation).toContain('Outcome: needs_work');
      expect(remediation).toContain('Adapter Path: local workflow fallback');
      expect(remediation).toContain('Prompt hint present: yes');
      expect(remediation).toContain('- Blocker ownership affected: no');
      expect(remediation).toContain('## Remediation Audit Trace Summary');
      expect(remediation).toContain('Routing Mode: generic');
      expect(remediation).toContain('Executor Route: default-gate-remediation');
      expect(remediation).toContain('Stop Reason: critical blockers remain open');
      expect(remediation).toContain('## Governance Remediation Runner Summary');
      expect(remediation).toContain('## Loop State Trace Summary');
      expect(remediation).toContain('- Stop Reason: critical blockers remain open');
      expect(cursorPacket).toContain('## Remediation Artifact');
      expect(cursorPacket).toContain('## Remediation Audit Trace Summary');
      expect(cursorPacket).toContain('Stop Reason: critical blockers remain open');
    } finally {
      rmSync(tmpRoot, { recursive: true, force: true });
    }
  });
});
