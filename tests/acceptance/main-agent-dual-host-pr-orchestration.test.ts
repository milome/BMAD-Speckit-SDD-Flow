import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { runDualHostPrOrchestration } from '../../scripts/main-agent-dual-host-pr-orchestrator';

describe('main-agent dual-host PR orchestration', () => {
  it('passes in deterministic mock provider mode with closed PR topology', () => {
    const report = runDualHostPrOrchestration({ provider: 'mock' });
    expect(report.finalPassed).toBe(true);
    expect(report.journeyE2EPassed).toBe(true);
    expect(report.hostsPassed).toEqual({ claude: true, codex: true });
    expect(report.prTopology.all_affected_stories_passed).toBe(true);
  });

  it('fails closed in real provider mode when external prerequisites are unavailable', () => {
    const previousGithubToken = process.env.GITHUB_TOKEN;
    const previousGhToken = process.env.GH_TOKEN;
    delete process.env.GITHUB_TOKEN;
    delete process.env.GH_TOKEN;
    try {
      const report = runDualHostPrOrchestration({
        provider: 'real',
        checkCommand: () => false,
      });
      expect(report.finalPassed).toBe(false);
      expect(report.providerPreflight.some((check) => !check.passed)).toBe(true);
      expect(report.prTopology.all_affected_stories_passed).toBe(false);
    } finally {
      if (previousGithubToken == null) {
        delete process.env.GITHUB_TOKEN;
      } else {
        process.env.GITHUB_TOKEN = previousGithubToken;
      }
      if (previousGhToken == null) {
        delete process.env.GH_TOKEN;
      } else {
        process.env.GH_TOKEN = previousGhToken;
      }
    }
  });

  it('accepts gh auth status as GitHub credentials even without token environment variables', () => {
    const previousGithubToken = process.env.GITHUB_TOKEN;
    const previousGhToken = process.env.GH_TOKEN;
    const previousPatToken = process.env.GITHUB_PAT_TOKEN;
    const previousPersonalAccessToken = process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
    delete process.env.GITHUB_TOKEN;
    delete process.env.GH_TOKEN;
    delete process.env.GITHUB_PAT_TOKEN;
    delete process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
    try {
      const report = runDualHostPrOrchestration({
        provider: 'real',
        checkCommand: (command, args = []) => {
          if (command === 'gh' && args.join(' ') === 'auth status') return true;
          return ['gh', 'claude', 'codex'].includes(command);
        },
      });
      expect(report.providerPreflight.find((check) => check.id === 'github-auth')?.passed).toBe(
        true
      );
      expect(report.providerPreflight.every((check) => check.passed)).toBe(true);
    } finally {
      if (previousGithubToken == null) {
        delete process.env.GITHUB_TOKEN;
      } else {
        process.env.GITHUB_TOKEN = previousGithubToken;
      }
      if (previousGhToken == null) {
        delete process.env.GH_TOKEN;
      } else {
        process.env.GH_TOKEN = previousGhToken;
      }
      if (previousPatToken == null) {
        delete process.env.GITHUB_PAT_TOKEN;
      } else {
        process.env.GITHUB_PAT_TOKEN = previousPatToken;
      }
      if (previousPersonalAccessToken == null) {
        delete process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
      } else {
        process.env.GITHUB_PERSONAL_ACCESS_TOKEN = previousPersonalAccessToken;
      }
    }
  });

  it('accepts common personal access token environment variable names', () => {
    const previousGithubToken = process.env.GITHUB_TOKEN;
    const previousGhToken = process.env.GH_TOKEN;
    const previousPatToken = process.env.GITHUB_PAT_TOKEN;
    const previousPersonalAccessToken = process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
    delete process.env.GITHUB_TOKEN;
    delete process.env.GH_TOKEN;
    process.env.GITHUB_PAT_TOKEN = 'test-token';
    delete process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
    try {
      const report = runDualHostPrOrchestration({
        provider: 'real',
        checkCommand: (command) => ['gh', 'claude', 'codex'].includes(command),
      });
      expect(report.providerPreflight.find((check) => check.id === 'github-auth')?.passed).toBe(
        true
      );
    } finally {
      if (previousGithubToken == null) {
        delete process.env.GITHUB_TOKEN;
      } else {
        process.env.GITHUB_TOKEN = previousGithubToken;
      }
      if (previousGhToken == null) {
        delete process.env.GH_TOKEN;
      } else {
        process.env.GH_TOKEN = previousGhToken;
      }
      if (previousPatToken == null) {
        delete process.env.GITHUB_PAT_TOKEN;
      } else {
        process.env.GITHUB_PAT_TOKEN = previousPatToken;
      }
      if (previousPersonalAccessToken == null) {
        delete process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
      } else {
        process.env.GITHUB_PERSONAL_ACCESS_TOKEN = previousPersonalAccessToken;
      }
    }
  });

  it('fails closed in real provider mode unless real PR API mutation is explicitly enabled', () => {
    const report = runDualHostPrOrchestration({
      provider: 'real',
      checkCommand: (command, args = []) => {
        if (command === 'gh' && args.join(' ') === 'auth status') return true;
        return ['gh', 'claude', 'codex'].includes(command);
      },
    });

    expect(report.providerPreflight.every((check) => check.passed)).toBe(true);
    expect(report.githubPrApi.attempted).toBe(true);
    expect(report.githubPrApi.passed).toBe(false);
    expect(report.githubPrApi.steps[0].id).toBe('real-pr-api-disabled');
    expect(report.finalPassed).toBe(false);
    expect(report.prTopology.all_affected_stories_passed).toBe(false);
  });

  it('writes standard truth-gate evidence artifacts from the CLI', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dual-host-pr-evidence-'));
    try {
      fs.mkdirSync(path.join(root, '_bmad', '_config'), { recursive: true });
      fs.mkdirSync(path.join(root, '_bmad-output', 'implementation-artifacts'), {
        recursive: true,
      });
      fs.writeFileSync(
        path.join(root, '_bmad', '_config', 'orchestration-governance.contract.yaml'),
        [
          'signals: {}',
          'stage_requirements:',
          '  implement: {}',
          'mapping_contract: {}',
          'adaptiveIntakeGovernanceGate:',
          '  matchScoring: {}',
          '  decisionThresholds: {}',
        ].join('\n') + '\n',
        'utf8'
      );
      fs.writeFileSync(
        path.join(root, '_bmad-output', 'implementation-artifacts', 'sprint-status.yaml'),
        'development_status:\n  S1: in_progress\n',
        'utf8'
      );
      const run = spawnSync(
        process.execPath,
        [
          path.join(process.cwd(), 'node_modules', 'ts-node', 'dist', 'bin.js'),
          '--project',
          path.join(process.cwd(), 'tsconfig.node.json'),
          '--transpile-only',
          path.join(process.cwd(), 'scripts', 'main-agent-dual-host-pr-orchestrator.ts'),
          '--provider',
          'mock',
          '--projectRoot',
          root,
        ],
        { encoding: 'utf8' }
      );
      if (run.status !== 0) {
        throw new Error(`dual-host CLI failed\nstdout=${run.stdout}\nstderr=${run.stderr}`);
      }
      expect(run.status).toBe(0);
      expect(
        fs.existsSync(
          path.join(
            root,
            '_bmad-output',
            'runtime',
            'e2e',
            'dual-host-pr-orchestration-report.json'
          )
        )
      ).toBe(true);
      expect(
        fs.existsSync(path.join(root, '_bmad-output', 'runtime', 'pr', 'pr_topology.json'))
      ).toBe(true);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
