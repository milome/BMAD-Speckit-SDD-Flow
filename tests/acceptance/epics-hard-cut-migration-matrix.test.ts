import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const LOCAL_REQUIREMENT_PATH =
  'docs/requirements/2026-04-27-epics-branch-scoped-canonical-path-requirement.md';

function readRepoFile(relativePath: string): string {
  return readFileSync(path.join(ROOT, relativePath), 'utf8');
}

const HARD_CUT_MATRIX = [
  {
    case: 'create-story canonical epics only',
    file: '_bmad/bmm/workflows/4-implementation/create-story/instructions.xml',
    mustContain: ['{planning_artifacts}/{branch_ref_sanitized}/epics.md', 'HALT'],
    mustNotContain: ['{planning_artifacts}/epics.md'],
  },
  {
    case: 'sprint-planning canonical epics only',
    file: '_bmad/bmm/workflows/4-implementation/sprint-planning/instructions.md',
    mustContain: ['{planning_artifacts}/{branch}/epics.md', 'HALT'],
    mustNotContain: ['{planning_artifacts}/epics.md', 'legacy flat'],
  },
  {
    case: 'sprint-planning canonical readiness only',
    file: '_bmad/bmm/workflows/4-implementation/sprint-planning/workflow.yaml',
    mustContain: ['{planning_artifacts}/{branch}/implementation-readiness-report-*.md'],
    mustNotContain: ['{planning_artifacts}/implementation-readiness-report-*.md'],
  },
  {
    case: 'runtime epics candidate is branch-only',
    file: '_bmad/runtime/hooks/runtime-step-state.cjs',
    mustContain: ["'{planning_artifacts}/{branch}/epics.md'"],
    mustNotContain: ["'{planning_artifacts}/epics.md'"],
  },
  {
    case: 'runtime readiness candidate is branch-only',
    file: '_bmad/runtime/hooks/runtime-step-state.cjs',
    mustContain: ["'{planning_artifacts}/{branch}/implementation-readiness-report-*.md'"],
    mustNotContain: ["'{planning_artifacts}/implementation-readiness-report-*.md'"],
  },
  {
    case: 'sprint status template stores branch-scoped readiness source',
    file: '_bmad/bmm/workflows/4-implementation/sprint-planning/sprint-status-template.yaml',
    mustContain: ['_bmad-output/planning-artifacts/{branch}/implementation-readiness-report-'],
    mustNotContain: ['_bmad-output/planning-artifacts/implementation-readiness-report-'],
  },
] as const;

const LOCAL_ONLY_HARD_CUT_MATRIX = [
  {
    case: 'canonical requirement records hard-cut semantics',
    file: LOCAL_REQUIREMENT_PATH,
    mustContain: ['must not be read as fallback after the 2026-04-27 hard cut'],
    mustNotContain: ['may be read only as fallback during migration'],
  },
] as const;

function expectHardCutRow(
  row: (typeof HARD_CUT_MATRIX | typeof LOCAL_ONLY_HARD_CUT_MATRIX)[number]
) {
  const content = readRepoFile(row.file);
  for (const snippet of row.mustContain) {
    expect(content, `${row.file} must contain ${snippet}`).toContain(snippet);
  }
  for (const snippet of row.mustNotContain) {
    expect(content, `${row.file} must not contain ${snippet}`).not.toContain(snippet);
  }
}

describe('epics hard-cut migration matrix', () => {
  for (const row of HARD_CUT_MATRIX) {
    it(row.case, () => {
      expectHardCutRow(row);
    });
  }

  for (const row of LOCAL_ONLY_HARD_CUT_MATRIX) {
    it.skipIf(process.env.CI === 'true' || !existsSync(path.join(ROOT, row.file)))(row.case, () => {
      expectHardCutRow(row);
    });
  }
});
