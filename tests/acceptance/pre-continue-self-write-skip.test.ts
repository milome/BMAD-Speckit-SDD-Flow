import { cpSync, existsSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

const ROOT = join(import.meta.dirname, '..', '..');

describe('pre-continue self-write skip', () => {
  it('skips governed artifact self writes instead of treating them as continue-gated actions', () => {
    const project = mkdtempSync(join(tmpdir(), 'pre-continue-self-write-'));
    try {
      cpSync(join(ROOT, '_bmad'), join(project, '_bmad'), { recursive: true });
      mkdirSync(join(project, '_bmad-output', 'planning-artifacts', 'dev'), { recursive: true });
      mkdirSync(join(project, '_bmad-output', 'runtime', 'context'), { recursive: true });
      mkdirSync(join(project, '.git'), { recursive: true });
      writeFileSync(join(project, '.git', 'HEAD'), 'ref: refs/heads/dev\n', 'utf8');
      writeFileSync(
        join(project, '_bmad-output', 'runtime', 'context', 'project.json'),
        JSON.stringify(
          {
            version: 1,
            flow: 'story',
            stage: 'arch',
            workflow: 'bmad-check-implementation-readiness',
            step: 'step-06-final-assessment',
            contextScope: 'project',
            updatedAt: '2026-04-08T00:00:00.000Z',
          },
          null,
          2
        ) + '\n',
        'utf8'
      );

      const artifactPath = join(
        project,
        '_bmad-output',
        'planning-artifacts',
        'dev',
        'implementation-readiness-report-2026-04-08.md'
      );

      writeFileSync(
        artifactPath,
        [
          '---',
          'stepsCompleted:',
          '  - step-01-document-discovery',
          '  - step-02-prd-analysis',
          '  - step-03-epic-coverage-validation',
          '  - step-04-ux-alignment',
          '  - step-05-epic-quality-review',
          '  - step-06-final-assessment',
          'date: 2026-04-08',
          'assessor: BMAD Implementation Readiness Workflow',
          '---',
          '',
          '# Implementation Readiness Report',
        ].join('\n'),
        'utf8'
      );

      const stdout = execFileSync(
        process.execPath,
        [join(ROOT, '_bmad', 'runtime', 'hooks', 'pre-continue-check.cjs')],
        {
          cwd: project,
          encoding: 'utf8',
          input: JSON.stringify({
            tool_name: 'Write',
            tool_input: {
              file_path: artifactPath,
            },
          }),
          stdio: ['pipe', 'pipe', 'pipe'],
        }
      );

      const result = JSON.parse(stdout) as {
        ok: boolean;
        skipped: boolean;
        reason?: string;
        workflow?: string;
        step?: string;
        gate?: string;
      };

      expect(result.ok).toBe(true);
      expect(result.skipped).toBe(true);
      expect(result.reason).toBe('artifact-self-write');
      expect(result.workflow).toBe('bmad-check-implementation-readiness');
      expect(result.step).toBe('step-06-final-assessment');
      expect(result.gate).toBe('readiness-blocker-gate');

      const pendingDir = join(project, '_bmad-output', 'runtime', 'governance', 'queue', 'pending');
      expect(existsSync(pendingDir)).toBe(false);
    } finally {
      rmSync(project, { recursive: true, force: true });
    }
  });
});
