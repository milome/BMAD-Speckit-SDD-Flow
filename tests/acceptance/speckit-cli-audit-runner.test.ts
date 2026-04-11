import { describe, expect, it, vi } from 'vitest';

describe('speckit-cli audit runner integration', () => {
  it('routes audit execution through runAuditorHost instead of direct auditor script orchestration', async () => {
    const speckitCli = await import('../../scripts/speckit-cli');
    const runAuditorHostImpl = vi.fn().mockResolvedValue({ status: 'PASS' as const });

    await speckitCli.runAudit(
      'implement',
      'specs/demo/tasks.md',
      {
        artifactPath: 'specs/demo/tasks.md',
        projectRoot: process.cwd(),
        reportPath: 'reports/demo-implement.audit.md',
        iterationCount: '2',
      },
      { runAuditorHostImpl }
    );

    expect(runAuditorHostImpl).toHaveBeenCalledTimes(1);
  });
});
