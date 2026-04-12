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
    expect(runAuditorHostImpl).toHaveBeenCalledWith(
      expect.objectContaining({
        projectRoot: process.cwd(),
        stage: 'implement',
        artifactPath: 'specs/demo/tasks.md',
        reportPath: 'reports/demo-implement.audit.md',
        iterationCount: '2',
      })
    );
  });

  it('supports document audit entry through the registry-backed consumer map', async () => {
    const speckitCli = await import('../../scripts/speckit-cli');
    const runAuditorHostImpl = vi.fn().mockResolvedValue({ status: 'PASS' as const });

    await speckitCli.runAudit(
      'document',
      'D:/repo/_bmad-output/implementation-artifacts/_orphan/TASKS_demo.md',
      {
        artifactPath: 'D:/repo/_bmad-output/implementation-artifacts/_orphan/TASKS_demo.md',
        reportPath: 'D:/repo/_bmad-output/implementation-artifacts/_orphan/TASKS_demo.audit.md',
      },
      { runAuditorHostImpl }
    );

    expect(runAuditorHostImpl).toHaveBeenCalledTimes(1);
    expect(runAuditorHostImpl).toHaveBeenCalledWith(
      expect.objectContaining({
        stage: 'document',
      })
    );
  });
});
