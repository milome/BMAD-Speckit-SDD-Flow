/**
 * TB.F1: one English fixture per AuditStage (prd, arch, story, spec, plan, gaps, tasks, implement).
 * Mutually exclusive with TB.F2 (inline EN_REPORT_* in parsers tests).
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { extractOverallGrade } from '../audit-generic';
import { parseDimensionScores, stageToMode } from '../dimension-parser';

const FIXTURES = path.join(__dirname, 'fixtures');

const STAGE_FILES: Array<{ stage: string; file: string }> = [
  { stage: 'prd', file: 'sample-prd-report.en.md' },
  { stage: 'arch', file: 'sample-arch-report.en.md' },
  { stage: 'story', file: 'sample-story-report.en.md' },
  { stage: 'spec', file: 'sample-spec-report.en.md' },
  { stage: 'plan', file: 'sample-plan-report.en.md' },
  { stage: 'gaps', file: 'sample-gaps-report.en.md' },
  { stage: 'tasks', file: 'sample-tasks-report.en.md' },
  { stage: 'implement', file: 'sample-implement-report.en.md' },
];

describe('TB.F1 English fixtures (per stage)', () => {
  it.each(STAGE_FILES)('$file exists and parses Overall Grade + dimensions', ({ stage, file }) => {
    const full = path.join(FIXTURES, file);
    expect(fs.existsSync(full), `missing ${file}`).toBe(true);
    const content = fs.readFileSync(full, 'utf-8');
    expect(extractOverallGrade(content)).toBeTruthy();

    const mode = stageToMode(stage);
    const scores = parseDimensionScores(content, mode);
    expect(scores.length).toBeGreaterThanOrEqual(4);
  });
});
