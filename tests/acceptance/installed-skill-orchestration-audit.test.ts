import { describe, expect, it } from 'vitest';
import {
  auditInstalledSkillOrchestration,
  type SkillOrchestrationAuditEntry,
} from '../../scripts/skill-orchestration-audit';

function bySkillId(entries: SkillOrchestrationAuditEntry[], skillId: string): SkillOrchestrationAuditEntry {
  const entry = entries.find((candidate) => candidate.skillId === skillId);
  expect(entry, `missing skill audit entry for ${skillId}`).toBeDefined();
  return entry as SkillOrchestrationAuditEntry;
}

describe('installed project skill orchestration audit', () => {
  const audit = auditInstalledSkillOrchestration({
    projectRoot: process.cwd(),
    hostKind: 'claude',
    includeSources: ['project-host'],
  });

  it('walks every installed project-host Claude skill and produces a classification matrix', () => {
    expect(audit.summary.totalSkills).toBeGreaterThan(20);
    expect(audit.entries).toHaveLength(audit.summary.totalSkills);
    expect(audit.summary.byClassification['runtime-handoff-main-agent']).toBeGreaterThan(0);
    expect(audit.summary.byClassification['direct-main-agent']).toBeGreaterThan(0);
    expect(audit.summary.byClassification['subagent-capable-but-unproven']).toBe(0);
  });

  it('keeps the core BMAD orchestration skills under proven main-agent control classes', () => {
    const canonicalSkillIds = [
      'bmad-bug-assistant',
      'bmad-code-reviewer-lifecycle',
      'bmad-rca-helper',
      'bmad-standalone-tasks',
      'bmad-standalone-tasks-doc-review',
      'bmad-story-assistant',
      'speckit-workflow',
    ];

    for (const skillId of canonicalSkillIds) {
      const entry = bySkillId(audit.entries, skillId);
      expect(entry.classification).toBe('runtime-handoff-main-agent');
      expect(entry.evidence.subagentMatches.length).toBeGreaterThan(0);
      expect(entry.evidence.canonicalMainAgentSurfaceMatches.length).toBeGreaterThan(0);
    }
  });

  it('captures the checkpoint-batched facilitator model for party-mode', () => {
    const entry = bySkillId(audit.entries, 'bmad-party-mode');

    expect(entry.classification).toBe('checkpoint-batched-main-agent');
    expect(entry.evidence.checkpointMatches.some((match) => /batch-boundary checkpoint/iu.test(match.text))).toBe(
      true
    );
    expect(
      entry.evidence.checkpointMatches.some((match) => /不得.*交还主 Agent/iu.test(match.text))
    ).toBe(true);
  });

  it('captures direct main-agent dispatch/resume control for the installed worktree workflow', () => {
    const entry = bySkillId(audit.entries, 'using-git-worktrees');

    expect(entry.classification).toBe('direct-main-agent');
    expect(
      entry.evidence.resumeControlMatches.some((match) => /CLI Calling Summary/iu.test(match.text))
    ).toBe(true);
    expect(
      entry.evidence.mainAgentTextMatches.some((match) => /\bMain Agent\b|主 Agent/iu.test(match.text))
    ).toBe(true);
  });

  it('forbids newly added subagent-capable skills from remaining unproven', () => {
    const unproven = audit.entries.filter(
      (entry) => entry.classification === 'subagent-capable-but-unproven'
    );

    expect(unproven).toEqual([]);
  });

  it('upgrades the formerly unproven project-host skills into direct main-agent orchestration', () => {
    const upgradedSkillIds = [
      'bmad-agent-tech-writer',
      'bmad-code-review',
      'bmad-create-story',
      'bmad-distillator',
      'bmad-domain-research',
      'bmad-help',
      'bmad-market-research',
      'bmad-product-brief-preview',
      'bmad-quick-dev',
      'bmad-quick-dev-new-preview',
      'bmad-quick-spec',
      'bmad-technical-research',
      'code-review',
    ];

    for (const skillId of upgradedSkillIds) {
      const entry = bySkillId(audit.entries, skillId);
      expect(entry.classification).toBe('direct-main-agent');
      expect(entry.evidence.subagentMatches.length).toBeGreaterThan(0);
      expect(entry.evidence.mainAgentTextMatches.length).toBeGreaterThan(0);
      expect(entry.evidence.resumeControlMatches.length).toBeGreaterThan(0);
    }
  });
});
