import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(import.meta.dirname, '..', '..');

function readRepoFile(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), 'utf8');
}

describe('readiness intent facade and bmad-help catalog contract', () => {
  it('routes bmad-check-implementation-readiness through the runtime router before upstream fallback', () => {
    const skill = readRepoFile(
      '_bmad/bmm/workflows/3-solutioning/bmad-check-implementation-readiness/SKILL.md'
    );
    const router = readRepoFile(
      '_bmad/bmm/workflows/3-solutioning/bmad-check-implementation-readiness/runtime-router.md'
    );

    expect(skill).toContain('Follow ./runtime-router.md first.');
    expect(skill).toContain('If governed runtime state exists');
    expect(skill).toContain('../check-implementation-readiness/workflow.md');

    expect(router).toContain('upstream_planning_readiness');
    expect(router).toContain('speckit_runtime_readiness');
    expect(router).toContain('readiness_help_projection');
    expect(router).toContain('governed_runtime_readiness_gate');
    expect(router).toContain('readiness_auto_remediation');
    expect(router).toContain('currentMentalModel=implementation_readiness');
    expect(router).toContain('this skill must not run the upstream planning readiness workflow');
    expect(router).toContain('Only `main_agent_orchestration` and controlled ingest may progress');
    expect(router).toContain('must not write `requirement-record.json`');
  });

  it('keeps bmad-help as a read-only dual-view projection with upstream catalog visibility', () => {
    for (const path of [
      '_bmad/skills/bmad-help/workflow.md',
      '_bmad/core/skills/bmad-help/workflow.md',
    ]) {
      const workflow = readRepoFile(path);

      expect(workflow).toContain('## DUAL VIEW OUTPUT');
      expect(workflow).toContain('Governed Runtime Next Step');
      expect(workflow).toContain('BMAD Upstream Workflow Catalog');
      expect(workflow).toContain('available');
      expect(workflow).toContain('blocked by currentMentalModel');
      expect(workflow).toContain('compatibility only');
      expect(workflow).toContain('replaced by project official skill');
      expect(workflow).toContain('governed_runtime_readiness_gate');
      expect(workflow).toContain('readiness_auto_remediation');
      expect(workflow).toContain('must not trigger remediation');
      expect(workflow).toContain('Only `main_agent_orchestration` and controlled ingest may progress');
    }
  });

  it('keeps upstream workflow rows visible while making IR runtime-aware', () => {
    const catalog = readRepoFile('_bmad/_config/bmad-help.csv');

    for (const workflowName of [
      'Create PRD',
      'Create UX',
      'Create Architecture',
      'Create Epics and Stories',
      'Check Implementation Readiness',
      'Sprint Planning',
      'Create Story',
      'Dev Story',
    ]) {
      expect(catalog).toContain(workflowName);
    }

    const readinessRow = catalog
      .split(/\r?\n/u)
      .find((line) => line.includes('Check Implementation Readiness'));

    expect(readinessRow).toContain('When governed runtime state exists');
    expect(readinessRow).toContain('governed runtime implementation-readiness gate');
    expect(readinessRow).toContain('upstream PRD/UX/Architecture/Epics readiness workflow');
  });
});
