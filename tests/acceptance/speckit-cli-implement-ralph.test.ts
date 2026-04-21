import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { appendTddTrace } from '../../scripts/ralph-method/write-tracking-files';

const tempRoots: string[] = [];

function makeTempRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'speckit-cli-implement-ralph-'));
  tempRoots.push(root);
  return root;
}

function writeTasksFile(root: string, relativePath: string): string {
  const tasksPath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(tasksPath), { recursive: true });
  fs.writeFileSync(
    tasksPath,
    `# Tasks

- [ ] T001 Implement runtime flow in scripts/runtime-context.ts
- [x] T002 Update docs/how-to.md with operator guidance
`,
    'utf8'
  );
  return tasksPath;
}

function writeSingleProductionTaskFile(root: string, relativePath: string): string {
  const tasksPath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(tasksPath), { recursive: true });
  fs.writeFileSync(
    tasksPath,
    `# Tasks

- [ ] T001 Implement runtime flow in scripts/runtime-context.ts
`,
    'utf8'
  );
  return tasksPath;
}

afterEach(() => {
  while (tempRoots.length > 0) {
    fs.rmSync(tempRoots.pop()!, { recursive: true, force: true });
  }
});

describe('speckit-cli implement Ralph integration', () => {
  it('prepares standalone Ralph tracking files from tasks.md', async () => {
    const speckitCli = await import('../../scripts/speckit-cli');
    const root = makeTempRoot();
    const tasksPath = writeTasksFile(root, path.join('specs', 'story-1', 'tasks.md'));

    const prepared = speckitCli.prepareImplementRalphTracking(
      { tasksPath, mode: 'standalone' },
      { projectRoot: root }
    );

    expect(prepared.paths.prdPath).toBe(path.join(root, 'specs', 'story-1', 'prd.tasks.json'));
    expect(prepared.paths.progressPath).toBe(
      path.join(root, 'specs', 'story-1', 'progress.tasks.txt')
    );
    expect(fs.existsSync(prepared.paths.prdPath)).toBe(true);
    expect(fs.existsSync(prepared.paths.progressPath)).toBe(true);

    const prd = JSON.parse(fs.readFileSync(prepared.paths.prdPath, 'utf8')) as {
      userStories: Array<{
        id: string;
        title: string;
        involvesProductionCode: boolean;
        passes: boolean;
      }>;
    };

    expect(prd.userStories).toHaveLength(2);
    expect(prd.userStories[0]).toMatchObject({
      id: 'US-001',
      title: 'T001 Implement runtime flow in scripts/runtime-context.ts',
      involvesProductionCode: true,
      passes: false,
    });
    expect(prd.userStories[1]).toMatchObject({
      id: 'US-002',
      title: 'T002 Update docs/how-to.md with operator guidance',
      involvesProductionCode: false,
      passes: true,
    });
    expect(prepared.verifyCommand).toContain('bmad-speckit ralph verify');
  });

  it('writes BMAD tracking files into implementation-artifacts', async () => {
    const speckitCli = await import('../../scripts/speckit-cli');
    const root = makeTempRoot();
    const tasksPath = writeTasksFile(
      root,
      path.join('specs', 'epic-4-ralph', 'story-1-implement', 'tasks-E4-S1.md')
    );

    const prepared = speckitCli.prepareImplementRalphTracking(
      {
        tasksPath,
        mode: 'bmad',
        epic: '4',
        story: '1',
        epicSlug: 'ralph',
        storySlug: 'implement',
      },
      { projectRoot: root }
    );

    expect(prepared.paths.prdPath).toBe(
      path.join(
        root,
        '_bmad-output',
        'implementation-artifacts',
        'epic-4-ralph',
        'story-1-implement',
        'prd.tasks-E4-S1.json'
      )
    );
    expect(prepared.paths.progressPath).toBe(
      path.join(
        root,
        '_bmad-output',
        'implementation-artifacts',
        'epic-4-ralph',
        'story-1-implement',
        'progress.tasks-E4-S1.txt'
      )
    );
  });

  it('verifies implement tracking through the shared Ralph compliance gate', async () => {
    const speckitCli = await import('../../scripts/speckit-cli');
    const root = makeTempRoot();
    const tasksPath = writeTasksFile(root, path.join('specs', 'story-1', 'tasks.md'));

    const prepared = speckitCli.prepareImplementRalphTracking(
      { tasksPath, mode: 'standalone' },
      { projectRoot: root }
    );

    appendTddTrace({
      progressPath: prepared.paths.progressPath,
      userStoryId: 'US-001',
      title: 'T001 Implement runtime flow in scripts/runtime-context.ts',
      storyLogTimestamp: '2026-04-19T12:00:00.000Z',
      phases: [
        { phase: 'TDD-RED', detail: 'T001 vitest tests/runtime.test.ts => 1 failed' },
        { phase: 'TDD-GREEN', detail: 'T001 vitest tests/runtime.test.ts => 1 passed' },
        { phase: 'TDD-REFACTOR', detail: 'T001 no refactor needed' },
      ],
    });
    appendTddTrace({
      progressPath: prepared.paths.progressPath,
      userStoryId: 'US-002',
      title: 'T002 Update docs/how-to.md with operator guidance',
      storyLogTimestamp: '2026-04-19T12:01:00.000Z',
      phases: [{ phase: 'DONE', detail: 'T002 docs updated' }],
    });

    const verification = speckitCli.verifyImplementRalphTracking(
      { tasksPath, mode: 'standalone' },
      { projectRoot: root }
    );

    expect(verification.paths.prdPath).toBe(prepared.paths.prdPath);
    expect(verification.paths.progressPath).toBe(prepared.paths.progressPath);
    expect(verification.result.status).toBe('pass');
  });

  it('injects resolved Ralph paths and verification gate into the implement agent command', async () => {
    const speckitCli = await import('../../scripts/speckit-cli');
    const root = makeTempRoot();
    const tasksPath = writeTasksFile(root, path.join('specs', 'story-1', 'tasks.md'));
    const prepared = speckitCli.prepareImplementRalphTracking(
      { tasksPath, mode: 'standalone' },
      { projectRoot: root }
    );

    const command = speckitCli.buildAgentCommand('implement', {
      tasksPath,
      mode: 'standalone',
      prdPath: prepared.paths.prdPath,
      progressPath: prepared.paths.progressPath,
      ralphVerifyCommand: prepared.verifyCommand,
    });

    expect(command).toContain('## Ralph Shared Tracking');
    expect(command).toContain(prepared.paths.prdPath);
    expect(command).toContain(prepared.paths.progressPath);
    expect(command).toContain('bmad-speckit ralph verify');
  });

  it('records TDD-RED/TDD-GREEN/TDD-REFACTOR incrementally and only closes the story on the final phase', async () => {
    const speckitCli = await import('../../scripts/speckit-cli');
    const root = makeTempRoot();
    const tasksPath = writeSingleProductionTaskFile(root, path.join('specs', 'story-1', 'tasks.md'));

    const prepared = speckitCli.prepareImplementRalphTracking(
      { tasksPath, mode: 'standalone' },
      { projectRoot: root }
    );

    speckitCli.recordImplementRalphTddPhase(
      {
        tasksPath,
        mode: 'standalone',
        userStoryId: 'US-001',
        title: 'T001 Implement runtime flow in scripts/runtime-context.ts',
        phase: 'TDD-RED',
        detail: 'T001 vitest tests/runtime.test.ts => 1 failed',
        storyLogTimestamp: '2026-04-19T12:00:00+08:00',
      },
      { projectRoot: root }
    );

    let progress = fs.readFileSync(prepared.paths.progressPath, 'utf8');
    let prd = JSON.parse(fs.readFileSync(prepared.paths.prdPath, 'utf8')) as {
      userStories: Array<{ passes: boolean }>;
    };
    expect(progress).toContain('[TDD-RED] T001 vitest tests/runtime.test.ts => 1 failed');
    expect(progress).toContain('[TDD-GREEN] _pending_');
    expect(progress).toContain('[TDD-REFACTOR] _pending_');
    expect(progress).not.toContain('US-001: T001 Implement runtime flow in scripts/runtime-context.ts - PASSED');
    expect(progress).toContain('Status: PENDING');
    expect(progress).toContain('Completed: 0');
    expect(prd.userStories[0]!.passes).toBe(false);

    speckitCli.recordImplementRalphTddPhase(
      {
        tasksPath,
        mode: 'standalone',
        userStoryId: 'US-001',
        title: 'T001 Implement runtime flow in scripts/runtime-context.ts',
        phase: 'TDD-GREEN',
        detail: 'T001 vitest tests/runtime.test.ts => 1 passed',
        storyLogTimestamp: '2026-04-19T12:01:00+08:00',
      },
      { projectRoot: root }
    );

    progress = fs.readFileSync(prepared.paths.progressPath, 'utf8');
    prd = JSON.parse(fs.readFileSync(prepared.paths.prdPath, 'utf8')) as {
      userStories: Array<{ passes: boolean }>;
    };
    expect(progress).toContain('[TDD-GREEN] T001 vitest tests/runtime.test.ts => 1 passed');
    expect(progress).not.toContain('US-001: T001 Implement runtime flow in scripts/runtime-context.ts - PASSED');
    expect(progress).toContain('Status: PENDING');
    expect(progress).toContain('Completed: 0');
    expect(prd.userStories[0]!.passes).toBe(false);

    speckitCli.recordImplementRalphTddPhase(
      {
        tasksPath,
        mode: 'standalone',
        userStoryId: 'US-001',
        title: 'T001 Implement runtime flow in scripts/runtime-context.ts',
        phase: 'TDD-REFACTOR',
        detail: 'T001 no refactor needed',
        storyLogTimestamp: '2026-04-19T12:02:00+08:00',
      },
      { projectRoot: root }
    );

    progress = fs.readFileSync(prepared.paths.progressPath, 'utf8');
    prd = JSON.parse(fs.readFileSync(prepared.paths.prdPath, 'utf8')) as {
      userStories: Array<{ passes: boolean }>;
    };
    expect(progress).toContain('[TDD-REFACTOR] T001 no refactor needed');
    expect(progress).toContain('US-001: T001 Implement runtime flow in scripts/runtime-context.ts - PASSED');
    expect(progress).toContain('Status: PASSED');
    expect(progress).toContain('Completed: 1');
    expect(prd.userStories[0]!.passes).toBe(true);
  });

  it('injects script-enforced phase hook commands into the implement agent command', async () => {
    const speckitCli = await import('../../scripts/speckit-cli');
    const root = makeTempRoot();
    const tasksPath = writeSingleProductionTaskFile(root, path.join('specs', 'story-2', 'tasks.md'));
    const prepared = speckitCli.prepareImplementRalphTracking(
      { tasksPath, mode: 'standalone' },
      { projectRoot: root }
    );

    const command = speckitCli.buildAgentCommand('implement', {
      tasksPath,
      mode: 'standalone',
      prdPath: prepared.paths.prdPath,
      progressPath: prepared.paths.progressPath,
      ralphVerifyCommand: prepared.verifyCommand,
    });

    expect(command).toContain('## Ralph Script-Enforced Subset');
    expect(command).toContain('bmad-speckit ralph record-phase');
    expect(command).toContain('bmad-speckit ralph verify');
  });
});
