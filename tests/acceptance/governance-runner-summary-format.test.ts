import { createRequire } from 'node:module';
import { describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);

describe('governance runner summary shared formatter', () => {
  it('formats the same runner summary lines for dashboard raw event, stop-hook output, and remediation artifact append', () => {
    const {
      buildGovernanceLatestRawEventSectionLines,
      appendRunnerSummaryToArtifactMarkdown,
      printGovernanceRunnerSummaryLines,
    } = require('../../_bmad/runtime/hooks/governance-runner-summary-format.cjs') as {
      buildGovernanceLatestRawEventSectionLines: (lines: string[]) => string[];
      appendRunnerSummaryToArtifactMarkdown: (
        artifactMarkdown: string,
        runnerSummaryLines: string[]
      ) => string;
      printGovernanceRunnerSummaryLines: (
        runnerSummaryLines: string[],
        log?: (line: string) => void
      ) => void;
    };

    const runnerSummaryLines = [
      '## Governance Remediation Runner Summary',
      '- Should Continue: no',
      '- Stop Reason: await human review',
      '',
      '## Loop State Trace Summary',
      '- Journey Contract Signals: smoke_task_chain',
    ];

    expect(buildGovernanceLatestRawEventSectionLines(runnerSummaryLines)).toEqual([
      '## Governance Latest Raw Event',
      '',
      '## Governance Remediation Runner Summary',
      '- Should Continue: no',
      '- Stop Reason: await human review',
      '',
      '## Loop State Trace Summary',
      '- Journey Contract Signals: smoke_task_chain',
      '',
    ]);

    expect(
      appendRunnerSummaryToArtifactMarkdown('# Remediation Attempt\n\n## Existing Section\n', runnerSummaryLines)
    ).toBe(
      [
        '# Remediation Attempt',
        '',
        '## Existing Section',
        '',
        '## Governance Remediation Runner Summary',
        '- Should Continue: no',
        '- Stop Reason: await human review',
        '',
        '## Loop State Trace Summary',
        '- Journey Contract Signals: smoke_task_chain',
        '',
      ].join('\n')
    );

    const log = vi.fn<(line: string) => void>();
    printGovernanceRunnerSummaryLines(runnerSummaryLines, log);
    expect(log.mock.calls.map(([line]) => line)).toEqual(runnerSummaryLines);
  });
});
