import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();

function readRepoFile(relativePath: string): string {
  return readFileSync(path.join(ROOT, relativePath), 'utf8');
}

describe('epics branch-scoped path consumer contract', () => {
  it('keeps branch-scoped epics.md as the canonical create-epics-and-stories output rule', () => {
    const command = readRepoFile('_bmad/commands/bmad-bmm-create-epics-and-stories.md');
    expect(command).toContain('_bmad-output/planning-artifacts/{branch}/epics.md');
  });

  it('teaches create-story and sprint-planning to resolve branch-scoped epics only', () => {
    const createStory = readRepoFile(
      '_bmad/bmm/workflows/4-implementation/create-story/instructions.xml'
    );
    const sprintPlanning = readRepoFile(
      '_bmad/bmm/workflows/4-implementation/sprint-planning/instructions.md'
    );

    expect(createStory).toContain('canonical_epics_file');
    expect(createStory).toContain('{planning_artifacts}/{branch_ref_sanitized}/epics.md');
    expect(createStory).toContain('HALT');
    expect(createStory).not.toContain('{planning_artifacts}/epics.md');
    expect(sprintPlanning).toContain('{planning_artifacts}/{branch}/epics.md');
    expect(sprintPlanning).toContain('branch-scoped whole document');
    expect(sprintPlanning).not.toContain('{planning_artifacts}/epics.md');
  });

  it('redirects legacy skills to official branch-aware workflow surfaces', () => {
    const createEpicsSkill = readRepoFile(
      '_bmad/bmm/workflows/3-solutioning/bmad-create-epics-and-stories/SKILL.md'
    );
    const createStorySkill = readRepoFile(
      '_bmad/bmm/workflows/4-implementation/bmad-create-story/SKILL.md'
    );
    const sprintPlanningSkill = readRepoFile(
      '_bmad/bmm/workflows/4-implementation/bmad-sprint-planning/SKILL.md'
    );

    expect(createEpicsSkill).toContain('../create-epics-and-stories/workflow.md');
    expect(createStorySkill).toContain('../create-story/workflow.yaml');
    expect(sprintPlanningSkill).toContain('../sprint-planning/workflow.yaml');
  });

  it('keeps PM/SM route-adjacent legacy agent menus behind skill wrappers instead of bypassing skills', () => {
    const pmAgent = readRepoFile('_bmad/bmm/agents/pm.md');
    const smAgent = readRepoFile('_bmad/bmm/agents/sm.md');
    const architectAgent = readRepoFile('_bmad/bmm/agents/architect.md');
    const pmAgentYaml = readRepoFile('_bmad/bmm/agents/pm.agent.yaml');
    const smAgentYaml = readRepoFile('_bmad/bmm/agents/sm.agent.yaml');
    const architectAgentYaml = readRepoFile('_bmad/bmm/agents/architect.agent.yaml');

    expect(pmAgent).toContain(
      '{project-root}/_bmad/bmm/workflows/3-solutioning/bmad-create-epics-and-stories/SKILL.md'
    );
    expect(smAgent).toContain(
      '{project-root}/_bmad/bmm/workflows/4-implementation/bmad-sprint-planning/SKILL.md'
    );
    expect(smAgent).toContain(
      '{project-root}/_bmad/bmm/workflows/4-implementation/bmad-create-story/SKILL.md'
    );
    expect(architectAgent).toContain(
      '{project-root}/_bmad/bmm/workflows/3-solutioning/bmad-check-implementation-readiness/SKILL.md'
    );
    expect(pmAgentYaml).toContain('exec: "skill:bmad-create-epics-and-stories"');
    expect(smAgentYaml).toContain('exec: "skill:bmad-sprint-planning"');
    expect(smAgentYaml).toContain('exec: "skill:bmad-create-story"');
    expect(architectAgentYaml).toContain('exec: "skill:bmad-check-implementation-readiness"');
  });

  it('demotes legacy bmad-create-epics-and-stories step text to branch-scoped canonical language', () => {
    const files = [
      '_bmad/bmm/workflows/3-solutioning/bmad-create-epics-and-stories/workflow.md',
      '_bmad/bmm/workflows/3-solutioning/bmad-create-epics-and-stories/steps/step-01-validate-prerequisites.md',
      '_bmad/bmm/workflows/3-solutioning/bmad-create-epics-and-stories/steps/step-02-design-epics.md',
      '_bmad/bmm/workflows/3-solutioning/bmad-create-epics-and-stories/steps/step-03-create-stories.md',
      '_bmad/bmm/workflows/3-solutioning/bmad-create-epics-and-stories/steps/step-04-final-validation.md',
      '_bmad/bmm/workflows/4-implementation/bmad-create-story/workflow.md',
    ];

    for (const relativePath of files) {
      const content = readRepoFile(relativePath);
      expect(
        content.includes('{planning_artifacts}/{branch}/epics.md') ||
          content.includes('_bmad-output/planning-artifacts/{branch}/epics.md')
      ).toBe(true);
      expect(content).toContain('Legacy compatibility');
    }
  });

  it('keeps readiness validation aligned to branch-scoped epics.md only', () => {
    const readiness = readRepoFile(
      '_bmad/bmm/workflows/3-solutioning/check-implementation-readiness/steps/step-06-final-assessment.md'
    );
    const readinessSkill = readRepoFile(
      '_bmad/bmm/workflows/3-solutioning/bmad-check-implementation-readiness/SKILL.md'
    );
    const readinessLegacyWorkflow = readRepoFile(
      '_bmad/bmm/workflows/3-solutioning/bmad-check-implementation-readiness/workflow.md'
    );

    expect(readiness).toContain('{planning_artifacts}/{branch}/epics.md');
    expect(readiness).not.toContain('{planning_artifacts}/epics.md');
    expect(readiness).not.toMatch(/flat planning-artifacts paths are legacy fallback only/i);
    expect(readinessSkill).toContain('../check-implementation-readiness/workflow.md');
    expect(readinessLegacyWorkflow).toContain('Legacy compatibility surface only');
    expect(readinessLegacyWorkflow).not.toContain('flat {planning_artifacts}/');
  });

  it('keeps active bmad-story-assistant variants branch-scoped only for epics.md', () => {
    const variants = [
      '_bmad/cursor/skills/bmad-story-assistant/SKILL.md',
      '_bmad/cursor/skills/bmad-story-assistant/SKILL.zh.md',
      '_bmad/cursor/skills/bmad-story-assistant/SKILL.en.md',
    ];

    for (const relativePath of variants) {
      const content = readRepoFile(relativePath);
      expect(content).toContain('_bmad-output/planning-artifacts/{branch}/epics.md');
      expect(content).not.toContain('_bmad-output/planning-artifacts/epics.md');
      expect(content).not.toContain('从 `_bmad-output/planning-artifacts/epics.md` 中');
      expect(content).not.toContain('in `_bmad-output/planning-artifacts/epics.md`');
    }
  });
});
