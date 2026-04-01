import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { parseDimensionScores, stageToMode } from '../../packages/scoring/parsers/dimension-parser';
import {
  REAL_TOOL_TRACE_FIXTURE_MANIFEST,
  getReportFixturePathForStage,
} from '../helpers/runtime-dashboard-fixture-manifest';

const repoRoot = process.cwd();
const fixtureRoot = path.join(
  repoRoot,
  'packages',
  'scoring',
  'parsers',
  '__tests__',
  'fixtures'
);
const conventionsDoc = path.join(
  repoRoot,
  'docs',
  'reference',
  'test-fixture-conventions.md'
);

describe('runtime dashboard fixture contract', () => {
  it('documents stage-aligned fixture rules for runtime dashboard and CLI smoke tests', () => {
    expect(fs.existsSync(conventionsDoc)).toBe(true);
    const content = fs.readFileSync(conventionsDoc, 'utf8');

    expect(content).toContain('`fixture` 的语义必须和 `stage` 对齐');
    expect(content).toContain('不得把 `story / prd / tasks` 样本误喂给 `implement`');
    expect(content).toContain('runtime-dashboard-fixture-manifest.ts');
    expect(content).toContain('runtime-dashboard-fixture.ts');
    expect(content).toContain('runtime-cli-e2e-smoke.test.ts');
    expect(content).toContain('clean -> implement');
    expect(content).toContain('redacted -> tasks');
    expect(content).toContain('blocked -> plan');
    expect(content).toContain('fixture contract test');
  });

  it('keeps runtime dashboard real-tool-trace variants mapped to same-stage parseable fixtures', () => {
    const clean = REAL_TOOL_TRACE_FIXTURE_MANIFEST.clean;
    const redacted = REAL_TOOL_TRACE_FIXTURE_MANIFEST.redacted;
    const blocked = REAL_TOOL_TRACE_FIXTURE_MANIFEST.blocked;

    expect(clean.stage).toBe('implement');
    expect(redacted.stage).toBe('tasks');
    expect(blocked.stage).toBe('plan');

    expect(clean.reportFixture).toContain('implement');
    expect(redacted.reportFixture).toContain('tasks');
    expect(blocked.reportFixture).toContain('plan');

    expect(getReportFixturePathForStage(clean.stage)).toBe(path.join(fixtureRoot, clean.reportFixture));
    expect(getReportFixturePathForStage(redacted.stage)).toBe(path.join(fixtureRoot, redacted.reportFixture));
    expect(getReportFixturePathForStage(blocked.stage)).toBe(path.join(fixtureRoot, blocked.reportFixture));

    const cleanContent = fs.readFileSync(getReportFixturePathForStage(clean.stage), 'utf8');
    const redactedContent = fs.readFileSync(getReportFixturePathForStage(redacted.stage), 'utf8');
    const blockedContent = fs.readFileSync(getReportFixturePathForStage(blocked.stage), 'utf8');

    expect(parseDimensionScores(cleanContent, stageToMode(clean.stage))).toHaveLength(4);
    expect(parseDimensionScores(redactedContent, stageToMode(redacted.stage))).toHaveLength(4);
    expect(parseDimensionScores(blockedContent, stageToMode(blocked.stage))).toHaveLength(4);
  });
});
