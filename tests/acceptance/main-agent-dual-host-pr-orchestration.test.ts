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
      const report = runDualHostPrOrchestration({ provider: 'real' });
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
});
