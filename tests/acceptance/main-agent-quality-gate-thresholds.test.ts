import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();

describe('main-agent quality gate thresholds', () => {
  it('loads versioned thresholds and passes when required paths exist', () => {
    const output = execFileSync(
      process.execPath,
      [
        path.join(ROOT, 'node_modules', 'ts-node', 'dist', 'bin.js'),
        '--project',
        'tsconfig.node.json',
        '--transpile-only',
        'scripts/main-agent-quality-gate.ts',
      ],
      { cwd: ROOT, encoding: 'utf8' }
    );

    const report = JSON.parse(output) as {
      thresholdsPath: string;
      critical_failures: number;
      checks: Array<{ id: string; passed: boolean }>;
    };

    expect(report.thresholdsPath).toBe('_bmad/_config/main-agent-quality-gate.thresholds.json');
    expect(report.critical_failures).toBe(0);
    expect(report.checks.every((check) => check.passed)).toBe(true);
  });

  it('keeps the quality gate implementation out of fail-closed TODO stub mode', () => {
    const source = readFileSync(path.join(ROOT, 'scripts/main-agent-quality-gate.ts'), 'utf8');
    expect(source).not.toContain("failTodo('main-agent-quality-gate'");
    expect(source).not.toContain('TODO implementation not completed');
  });

  it('fails closed when run-scoped Codex proof provenance does not match', () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'quality-gate-codex-proof-'));
    try {
      const proofPath = path.join(dir, 'codex-proof.json');
      writeFileSync(
        proofPath,
        JSON.stringify(
          {
            reportType: 'codex_run_scoped_quality_proof',
            evidence_provenance: {
              runId: 'old-run',
              storyKey: 'S-quality',
              evidenceBundleId: 'bundle-quality',
            },
            codex: {
              hostKind: 'codex',
              mode: 'codex_exec',
              taskReportStatus: 'done',
              validationsRun: ['fake-codex-exec'],
            },
          },
          null,
          2
        ),
        'utf8'
      );

      expect(() =>
        execFileSync(
          process.execPath,
          [
            path.join(ROOT, 'node_modules', 'ts-node', 'dist', 'bin.js'),
            '--project',
            'tsconfig.node.json',
            '--transpile-only',
            'scripts/main-agent-quality-gate.ts',
            '--runId',
            'run-quality',
            '--storyKey',
            'S-quality',
            '--evidenceBundleId',
            'bundle-quality',
            '--codexProofPath',
            proofPath,
          ],
          { cwd: ROOT, encoding: 'utf8' }
        )
      ).toThrow();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('emits same-run provenance when run-scoped Codex proof is valid', () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'quality-gate-codex-proof-'));
    try {
      const proofPath = path.join(dir, 'codex-proof.json');
      writeFileSync(
        proofPath,
        JSON.stringify(
          {
            reportType: 'codex_run_scoped_quality_proof',
            evidence_provenance: {
              runId: 'run-quality',
              storyKey: 'S-quality',
              evidenceBundleId: 'bundle-quality',
            },
            codex: {
              hostKind: 'codex',
              mode: 'codex_exec',
              taskReportStatus: 'done',
              validationsRun: ['fake-codex-exec'],
            },
          },
          null,
          2
        ),
        'utf8'
      );

      const output = execFileSync(
        process.execPath,
        [
          path.join(ROOT, 'node_modules', 'ts-node', 'dist', 'bin.js'),
          '--project',
          'tsconfig.node.json',
          '--transpile-only',
          'scripts/main-agent-quality-gate.ts',
          '--runId',
          'run-quality',
          '--storyKey',
          'S-quality',
          '--evidenceBundleId',
          'bundle-quality',
          '--codexProofPath',
          proofPath,
        ],
        { cwd: ROOT, encoding: 'utf8' }
      );

      const report = JSON.parse(output) as {
        critical_failures: number;
        evidence_provenance?: {
          runId: string;
          storyKey: string;
          evidenceBundleId: string;
        };
        checks: Array<{ id: string; passed: boolean }>;
      };
      expect(report.critical_failures).toBe(0);
      expect(report.evidence_provenance).toEqual({
        runId: 'run-quality',
        storyKey: 'S-quality',
        evidenceBundleId: 'bundle-quality',
      });
      expect(report.checks.find((check) => check.id === 'codex-run-scoped-proof')?.passed).toBe(
        true
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
