import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();

const TARGET_FILES = [
  '_bmad/bmm/agents/pm.md',
  '_bmad/bmm/agents/sm.md',
  '_bmad/bmm/agents/architect.md',
  '_bmad/bmm/agents/pm.agent.yaml',
  '_bmad/bmm/agents/sm.agent.yaml',
  '_bmad/bmm/agents/architect.agent.yaml',
  '_bmad/bmm/workflows/4-implementation/create-story/instructions.xml',
  '_bmad/bmm/workflows/4-implementation/create-story/workflow.yaml',
  '_bmad/bmm/workflows/4-implementation/sprint-planning/instructions.md',
  '_bmad/bmm/workflows/4-implementation/sprint-planning/workflow.yaml',
  '_bmad/bmm/workflows/4-implementation/sprint-planning/sprint-status-template.yaml',
  '_bmad/bmm/workflows/4-implementation/correct-course/workflow.yaml',
  '_bmad/bmm/workflows/4-implementation/retrospective/workflow.yaml',
  '_bmad/bmm/workflows/4-implementation/code-review/workflow.yaml',
  '_bmad/bmm/workflows/4-implementation/bmad-sprint-planning/workflow.md',
  '_bmad/bmm/workflows/4-implementation/bmad-correct-course/workflow.md',
  '_bmad/bmm/workflows/4-implementation/bmad-retrospective/workflow.md',
  '_bmad/bmm/workflows/4-implementation/retrospective/instructions.md',
  '_bmad/bmm/workflows/3-solutioning/check-implementation-readiness/steps/step-06-final-assessment.md',
  '_bmad/bmm/workflows/3-solutioning/check-implementation-readiness/steps/step-01-document-discovery.md',
  '_bmad/bmm/workflows/3-solutioning/check-implementation-readiness/steps/step-02-prd-analysis.md',
  '_bmad/bmm/workflows/3-solutioning/bmad-check-implementation-readiness/steps/step-01-document-discovery.md',
  '_bmad/bmm/workflows/3-solutioning/bmad-create-epics-and-stories/workflow.md',
  '_bmad/bmm/workflows/3-solutioning/bmad-check-implementation-readiness/workflow.md',
  '_bmad/runtime/hooks/runtime-step-state.cjs',
  '_bmad/cursor/skills/bmad-story-assistant/SKILL.md',
  '_bmad/cursor/skills/bmad-story-assistant/SKILL.zh.md',
  '_bmad/cursor/skills/bmad-story-assistant/SKILL.en.md',
  '_bmad/claude/skills/bmad-story-assistant/SKILL.md',
  '_bmad/claude/skills/bmad-story-assistant/SKILL.zh.md',
  '_bmad/claude/skills/bmad-story-assistant/SKILL.en.md',
] as const;

const FORBIDDEN_FLAT_READ_FALLBACK_SNIPPETS = [
  'exec="{project-root}/_bmad/bmm/workflows/3-solutioning/create-epics-and-stories/workflow.md"',
  'workflow="{project-root}/_bmad/bmm/workflows/4-implementation/sprint-planning/workflow.yaml"',
  'workflow="{project-root}/_bmad/bmm/workflows/4-implementation/create-story/workflow.yaml"',
  'Load {planning_artifacts}/epics.md and review:',
  'Populate {planning_artifacts}/epics.md with extracted requirements',
  'Append epics and stories to {planning_artifacts}/epics.md following template',
  "outputFile: '{planning_artifacts}/implementation-readiness-report-{{date}}.md'",
  "remediationArtifactFile: '{planning_artifacts}/implementation-readiness-remediation-{{date}}.md'",
  '{planning_artifacts}/epics.md',
  '{planning_artifacts}/implementation-readiness-report-',
  '{planning_artifacts}/implementation-readiness-remediation-',
  '_bmad-output/planning-artifacts/epics.md',
  '{planning_artifacts}/*epic*.md',
  '{planning_artifacts}/*epic*/*.md',
  '{planning_artifacts}/*epic*/index.md',
  '{planning_artifacts}/*epic*/epic-',
  '{planning_artifacts}/epic*.md',
  '{planning_artifacts}/epic*/epic-',
  'legacy fallback',
  'flat fallback',
  'flat path is legacy fallback',
  'flat planning-artifacts paths are legacy fallback only',
] as const;

describe('epics branch path deny-list', () => {
  it('forbids flat read fallback across active and route-adjacent surfaces', () => {
    for (const relativePath of TARGET_FILES) {
      const content = readFileSync(path.join(ROOT, relativePath), 'utf8');
      for (const snippet of FORBIDDEN_FLAT_READ_FALLBACK_SNIPPETS) {
        expect(
          content.includes(snippet),
          `forbidden flat read fallback snippet still present in ${relativePath}: ${snippet}`
        ).toBe(false);
      }
    }
  });
});
