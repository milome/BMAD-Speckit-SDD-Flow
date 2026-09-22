import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const fixtureRelativePath =
  'tests/acceptance/fixtures/requirements-contract/multi-timeframe-display-settings.real.md';
const metadataRelativePath =
  'tests/acceptance/fixtures/requirements-contract/multi-timeframe-display-settings.real.metadata.json';
const requireForProjectionGate = createRequire(import.meta.url);
const { collectProjectionQualityIssues } = requireForProjectionGate(
  '../../_bmad/skills/requirements-contract-authoring/scripts/projection_quality_gate.js'
) as {
  collectProjectionQualityIssues: (
    confirmation: Record<string, unknown>,
    options?: Record<string, unknown>
  ) => Array<{ code: string; refs: string[] }>;
};
function readUtf8(relativePath: string): string {
  return readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

function sha256Text(text: string): string {
  return createHash('sha256').update(Buffer.from(text, 'utf8')).digest('hex');
}

function byteLength(text: string): number {
  return Buffer.byteLength(text, 'utf8');
}

function lineCount(text: string): number {
  return text.split(/\r?\n/).length;
}

function sectionBetween(text: string, startHeading: string, nextHeading: string): string {
  const start = text.indexOf(startHeading);
  const end = text.indexOf(nextHeading, start + startHeading.length);
  expect(start, `${startHeading} must exist`).toBeGreaterThanOrEqual(0);
  expect(end, `${nextHeading} must exist after ${startHeading}`).toBeGreaterThan(start);
  return text.slice(start, end);
}

function stringify(value: unknown): string {
  return JSON.stringify(value);
}

describe('requirements contract sanitized real fixture coverage', () => {
  it('fails generic current-target rows and partial business visual coverage per business MUST', () => {
    const issues = collectProjectionQualityIssues({
      must: [
        {
          id: 'MUST-001',
          text: 'Business timeframe selector must preserve hidden period defaults.',
        },
        {
          id: 'MUST-002',
          text: 'Business timeframe selector must apply explicit visible period settings.',
        },
      ],
      traceRows: [
        { id: 'TRACE-001', covers: ['MUST-001'] },
        { id: 'TRACE-002', covers: ['MUST-002'] },
      ],
      requirementBoundary: {
        business: {
          requirementIds: ['MUST-001', 'MUST-002'],
        },
      },
      currentTargetMap: {
        currentSummary: [
          {
            id: 'CTM-001',
            requirementRefs: ['MUST-001', 'MUST-002'],
            current: 'source-derived current state for all requirements',
            target: 'generic target state for all requirements',
          },
        ],
      },
      businessVisuals: [
        {
          id: 'BUS-001',
          covers: ['MUST-001'],
          title: 'Hidden period default flow',
          mermaid: 'flowchart TD\nUser-->Settings\nSettings-->HiddenPeriods',
        },
      ],
    });
    const currentTargetIssue = issues.find(
      (issue) => issue.code === 'current_target_map_not_product_specific'
    );
    const visualIssue = issues.find(
      (issue) => issue.code === 'business_visual_generic_or_compressed'
    );

    expect(currentTargetIssue?.refs).toEqual(['currentTargetMap', 'MUST-001', 'MUST-002']);
    expect(visualIssue?.refs).toEqual(['businessVisuals', 'MUST-002']);
  });

  it('does not classify exact Source MUST payload as generic current-target boilerplate', () => {
    const sourceMustText =
      'The production Judge can inspect all source-derived MUST references before promotion.';
    const issues = collectProjectionQualityIssues({
      must: [
        {
          id: 'MUST-001',
          text: 'Preserve each authored MUST as an independently traceable product behavior.',
        },
        {
          id: 'MUST-002',
          text: sourceMustText,
        },
      ],
      traceRows: [
        { id: 'TRACE-001', covers: ['MUST-001'] },
        { id: 'TRACE-002', covers: ['MUST-002'] },
      ],
      requirementBoundary: {
        business: {
          requirementIds: ['MUST-001', 'MUST-002'],
        },
      },
      currentTargetMap: {
        diffRows: [
          {
            id: 'CT-MUST-001',
            requirementRefs: ['MUST-001'],
            derivedFromMustRef: 'MUST-001',
            currentState: 'Current product behavior remains independently traceable.',
            targetState:
              'Target product behavior preserves each authored MUST as an independently traceable product behavior.',
            targetFiles: ['src/product.ts'],
            traceRows: ['TRACE-001'],
          },
          {
            id: 'CT-MUST-002',
            requirementRefs: ['MUST-002'],
            derivedFromMustRef: 'MUST-002',
            currentState: 'Current auditor visibility is incomplete.',
            targetState: `Target product behavior: ${sourceMustText}`,
            targetFiles: ['src/auditor.ts'],
            traceRows: ['TRACE-002'],
          },
        ],
      },
    });

    expect(issues.find((issue) => issue.code === 'current_target_map_not_product_specific')).toBe(
      undefined
    );
  });

  it('records source provenance and sanitized fixture integrity', () => {
    const fixture = readUtf8(fixtureRelativePath);
    const metadata = JSON.parse(readUtf8(metadataRelativePath)) as {
      fixturePath: string;
      sourceClassification: string;
      sourceBackup: { bytes: number; lines: number; sha256: string };
      sourceProject: string;
      currentSource: { path: string; bytes: number; lines: number; sha256: string };
      sanitizedFixture: { bytes: number; lines: number; sha256: string };
      sanitization: { removedBlock: string; removedLineCount: number };
      externalConsumerProjectAccessed: boolean;
    };

    expect(metadata.fixturePath).toBe(fixtureRelativePath);
    expect(metadata.sourceClassification).toBe('sanitized-real-consumer-requirements');
    expect(metadata.sourceProject).toBe('REDACTED_CONSUMER_PROJECT');
    expect(metadata.sourceBackup).toMatchObject({
      bytes: 59946,
      lines: 1470,
      sha256: '4663d96263a67491b977e9555065d520ad720f5ffe00442b95eda69f9bd2d6e8',
    });
    expect(metadata.currentSource).toMatchObject({
      bytes: 53267,
      lines: 1384,
      sha256: '008846a38b07adf6113dc5d932ea1d51c75a9600bafc8d7d70edec3869cdcf40',
    });
    expect(metadata.sanitizedFixture).toMatchObject({
      bytes: 27762,
      lines: 541,
      sha256: '4e71bf5f1766f81bbd6f11b5052d3ae7f3c8ced7059606a23480998a579acc06',
    });
    expect(byteLength(fixture)).toBe(metadata.sanitizedFixture.bytes);
    expect(lineCount(fixture)).toBe(metadata.sanitizedFixture.lines);
    expect(sha256Text(fixture)).toBe(metadata.sanitizedFixture.sha256);
    expect(fixture).toContain('sourceBackupBytes: 59946');
    expect(fixture).toContain('sourceBackupLines: 1470');
    expect(fixture).toContain(`sourceBackupSha256: ${metadata.sourceBackup.sha256}`);
    expect(fixture).toContain('sourceProject: REDACTED_CONSUMER_PROJECT');
    expect(fixture).not.toMatch(/[A-Za-z]:[\\/]/);
    expect(stringify(metadata)).not.toMatch(/[A-Za-z]:[\\/]/);
    expect(metadata.sanitizedFixture.path).toBe(fixtureRelativePath);
    expect(metadata.currentSource.path).toBe(
      '<redacted-consumer-project>/docs/plans/multi_timeframe_display_settings_requirements.md'
    );
    expect(fixture).not.toMatch(/^implementationConfirmation:\s*$/m);
    expect(metadata.sanitization).toMatchObject({
      removedBlock: 'implementationConfirmation',
      removedLineCount: 1007,
    });
    expect(metadata.externalConsumerProjectAccessed).toBe(false);
  });

  it('clean-source multi-timeframe authoring materializes business coverage from the sanitized real fixture anchors', () => {
    const fixture = readUtf8(fixtureRelativePath);
    const metadata = JSON.parse(readUtf8(metadataRelativePath)) as {
      requiredBusinessAnchors: {
        frIds: string[];
        hiddenByDefaultPeriods: string[];
        outOfScopeTimeline: string;
        targetPaths: string[];
        testSuggestionAnchors: string[];
      };
    };

    expect(metadata.requiredBusinessAnchors.frIds).toEqual([
      'FR-1',
      'FR-2',
      'FR-3',
      'FR-4',
      'FR-5',
      'FR-6',
      'FR-7',
      'FR-8',
      'FR-9',
    ]);
    for (const frId of metadata.requiredBusinessAnchors.frIds) {
      expect(fixture).toMatch(new RegExp(`^### ${frId}(?:\\s|$)`, 'm'));
    }

    const defaultStrategy = sectionBetween(fixture, '## 7. 默认显示策略', '## 8. 信息架构');
    for (const period of metadata.requiredBusinessAnchors.hiddenByDefaultPeriods) {
      expect(defaultStrategy).toContain(`| ${period} | 否 |`);
    }

    const nonGoals = sectionBetween(fixture, '## 5. 非目标', '## 6. 用户与场景');
    expect(nonGoals).toContain(metadata.requiredBusinessAnchors.outOfScopeTimeline);
    expect(defaultStrategy).toContain(
      '`1m` 是主时间轴，不属于叠加周期，不在多周期显示设置中提供显示开关。'
    );

    for (const targetPath of metadata.requiredBusinessAnchors.targetPaths) {
      expect(fixture).toContain(targetPath);
    }
    for (const anchor of metadata.requiredBusinessAnchors.testSuggestionAnchors) {
      expect(fixture).toContain(anchor);
    }
    expect(fixture).not.toContain('tests/acceptance/main-agent');
    expect(fixture).not.toContain('node_modules/bmad-speckit-sdd-flow');
  });
});
