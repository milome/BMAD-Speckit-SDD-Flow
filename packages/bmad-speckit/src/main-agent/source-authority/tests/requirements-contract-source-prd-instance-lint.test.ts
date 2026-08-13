import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { lintRequirementsContractSourcePrd } from '../scripts/lint-requirements-contract-source-prd';

const ROOT = process.cwd();
const SOURCE_AUTHORITY_ROOT = path.join(
  ROOT,
  'packages',
  'bmad-speckit',
  'src',
  'main-agent',
  'source-authority'
);
const FIXTURE_ROOT = path.join(SOURCE_AUTHORITY_ROOT, 'tests', 'fixtures', 'source-prd');
const LINT_SCRIPT_PATH = path.join(
  SOURCE_AUTHORITY_ROOT,
  'scripts',
  'lint-requirements-contract-source-prd.ts'
);

function fixture(name: string): string {
  return path.join(FIXTURE_ROOT, name);
}

describe('requirements contract source PRD instance lint', () => {
  it('emits source_prd_draft_ready only for a fully closed source PRD', () => {
    const result = lintRequirementsContractSourcePrd({
      source: fixture('golden-source-prd.md'),
      entrySource: 'source_prd_draft',
      json: true,
    });

    expect(result.ok, JSON.stringify(result.issues, null, 2)).toBe(true);
    expect(result.status).toBe('source_prd_draft_ready');
    expect(result.sourcePrdDraftReady).toBe(true);
    expect(result.counts.requirementRows).toBe(2);
    expect(result.counts.negativeRows).toBe(1);
    expect(result.counts.traceRows).toBeGreaterThanOrEqual(3);
    expect(result.counts.pathRows).toBe(1);
    expect(result.counts.currentTargetRows).toBe(1);
  });

  it.each([
    ['weak-trace-all.md', 'trace_covers_all_must_forbidden'],
    ['weak-generic-business-visual.md', 'generic_business_visual_forbidden'],
    ['weak-orphan-source-binding.md', 'orphan_source_binding'],
  ])('fails closed for %s with %s', (fileName, expectedIssue) => {
    const result = lintRequirementsContractSourcePrd({
      source: fixture(fileName),
      entrySource: 'source_prd_draft',
      json: true,
    });

    expect(result.ok).toBe(false);
    expect(result.status).toBe('source_prd_draft_blocked');
    expect(result.sourcePrdDraftReady).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toContain(expectedIssue);
  });

  it.each([
    ['weak-missing-neg.md', 'negative_requirement_missing'],
    ['weak-missing-path.md', 'target_path_or_no_code_missing'],
    ['weak-missing-current-target.md', 'current_target_map_missing'],
  ])(
    'keeps %s under structural lint without restoring %s as Markdown semantic authority',
    (fileName, retiredSemanticIssue) => {
      const result = lintRequirementsContractSourcePrd({
        source: fixture(fileName),
        entrySource: 'source_prd_draft',
        json: true,
      });

      const issueCodes = result.issues.map((issue) => issue.code);
      expect(result.ok).toBe(false);
      expect(issueCodes).toContain('required_heading_missing');
      expect(issueCodes).not.toContain(retiredSemanticIssue);
    }
  );

  it('rejects inline implementationConfirmation for BMAD PRD mode', () => {
    const result = lintRequirementsContractSourcePrd({
      source: fixture('golden-source-prd.md'),
      entrySource: 'bmad_prd',
      allowInlineConfirmation: false,
      json: true,
    });

    expect(result.entrySource).toBe('bmad_prd');
    expect(result.issues.map((issue) => issue.code)).not.toContain(
      'inline_implementation_confirmation_forbidden'
    );
  });

  it('publishes a JSON CLI report with required contract fields', () => {
    const tsxCliPath = path.join(ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs');
    const output = execFileSync(
      process.execPath,
      [
        tsxCliPath,
        LINT_SCRIPT_PATH,
        '--source',
        fixture('golden-source-prd.md'),
        '--entry-source',
        'session_requirements',
        '--json',
      ],
      {
        cwd: ROOT,
        encoding: 'utf8',
        maxBuffer: 5 * 1024 * 1024,
      }
    );
    const report = JSON.parse(output);

    expect(report.ok).toBe(true);
    expect(report.status).toBe('source_prd_draft_ready');
    expect(report.entrySource).toBe('session_requirements');
    expect(report.issues).toEqual([]);
    expect(report.counts.requirementRows).toBe(2);
  });

  it('does not execute the CLI when imported by another bundled runtime entry', () => {
    const tsxCliPath = path.join(ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs');
    const lintScriptUrl = pathToFileURL(LINT_SCRIPT_PATH).href;
    const output = execFileSync(
      process.execPath,
      [
        tsxCliPath,
        '-e',
        `(async()=>{ const before=process.exitCode; await import(${JSON.stringify(lintScriptUrl)}); console.log(JSON.stringify({ before: before ?? null, after: process.exitCode ?? null })); })().catch((error)=>{ console.error(error); process.exit(1); });`,
      ],
      {
        cwd: ROOT,
        encoding: 'utf8',
        maxBuffer: 5 * 1024 * 1024,
      }
    );

    expect(JSON.parse(output)).toEqual({ before: null, after: null });
  });
});
