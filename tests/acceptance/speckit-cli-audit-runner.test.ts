import { describe, expect, it, vi } from 'vitest';

describe('speckit-cli audit runner integration', () => {
  it('routes audit execution through runAuditorHost instead of direct auditor script orchestration', async () => {
    const speckitCli = await import('../../scripts/speckit-cli');
    const runAuditorHostImpl = vi.fn().mockResolvedValue({
      status: 'PASS' as const,
      closeoutEnvelope: {
        resultCode: 'approved',
        packetExecutionClosureStatus: 'gate_passed',
      },
    });

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
    const runAuditorHostImpl = vi.fn().mockResolvedValue({
      status: 'PASS' as const,
      closeoutEnvelope: {
        resultCode: 'approved',
        packetExecutionClosureStatus: 'gate_passed',
      },
    });

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

  it('treats blocked closeout envelope as failure even when audit status is PASS', async () => {
    const speckitCli = await import('../../scripts/speckit-cli');
    const runAuditorHostImpl = vi.fn().mockResolvedValue({
      status: 'PASS' as const,
      closeoutEnvelope: {
        resultCode: 'blocked',
        packetExecutionClosureStatus: 'awaiting_rerun_gate',
      },
    });
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: string | number | null) => {
      throw new Error(`process.exit:${code}`);
    }) as never);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(
      speckitCli.runAudit(
        'implement',
        'specs/demo/tasks.md',
        {
          artifactPath: 'specs/demo/tasks.md',
          reportPath: 'reports/demo-implement.audit.md',
        },
        { runAuditorHostImpl }
      )
    ).rejects.toThrow('process.exit:1');

    expect(errorSpy).toHaveBeenCalledWith('Audit failed');
    exitSpy.mockRestore();
    errorSpy.mockRestore();
  });
});
