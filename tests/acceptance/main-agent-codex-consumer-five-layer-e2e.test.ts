import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = path.join(import.meta.dirname, '..', '..');

function run(command: string, cwd: string): string {
  return execSync(command, {
    cwd,
    encoding: 'utf8',
    env: { ...process.env },
  });
}

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + '\n', 'utf8');
}

function writeText(filePath: string, value: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, value, 'utf8');
}

function writeFakeCodexBinary(root: string): string {
  const fakeCodexPath = path.join(root, 'fake-codex.cjs');
  writeText(
    fakeCodexPath,
    [
      "const fs = require('fs');",
      "const input = fs.readFileSync(0, 'utf8');",
      "const reportPath = input.match(/write a JSON TaskReport to: (.+)/i)?.[1]?.trim();",
      "const packetId = input.match(/Packet ID: (.+)/i)?.[1]?.trim();",
      "if (!reportPath || !packetId) process.exit(2);",
      "fs.mkdirSync(require('path').dirname(reportPath), { recursive: true });",
      "fs.writeFileSync(reportPath, JSON.stringify({ packetId, status: 'done', filesChanged: [], validationsRun: ['fake-codex-consumer-exec'], evidence: ['fake-codex-consumer-exec'], downstreamContext: ['consumer codex exec completed'] }, null, 2) + '\\n', 'utf8');",
      "process.exit(0);",
      '',
    ].join('\n')
  );
  const fakeCodexBin =
    process.platform === 'win32' ? path.join(root, 'fake-codex.cmd') : path.join(root, 'fake-codex');
  writeText(
    fakeCodexBin,
    process.platform === 'win32'
      ? `@echo off\r\n"${process.execPath}" "${fakeCodexPath}" %*\r\n`
      : `#!/usr/bin/env sh\n"${process.execPath}" "${fakeCodexPath}" "$@"\n`
  );
  if (process.platform !== 'win32') {
    fs.chmodSync(fakeCodexBin, 0o755);
  }
  return fakeCodexBin;
}

describe('Codex consumer five-layer main-agent e2e', () => {
  it('runs installed Codex no-hooks main-agent loop through the public bmad-speckit CLI', () => {
    const target = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-consumer-five-layer-'));
    try {
      fs.writeFileSync(
        path.join(target, 'package.json'),
        JSON.stringify({ name: 'codex-consumer-five-layer', version: '1.0.0', private: true }),
        'utf8'
      );
      run(`npm install --save-dev "file:${ROOT.replace(/\\/g, '/')}"`, target);
      run('npx bmad-speckit-init --agent codex', target);
      expect(run('npx bmad-speckit check', target)).toMatch(/Check OK|OK/i);
      expect(
        fs.existsSync(
          path.join(target, 'node_modules', 'bmad-speckit-sdd-flow', 'docs', 'how-to', 'codex-setup.md')
        )
      ).toBe(true);

      writeJson(path.join(target, '_bmad-output', 'runtime', 'registry.json'), {
        version: 1,
        activeScope: 'story:S-codex-consumer',
        scopes: {
          'story:S-codex-consumer': {
            contextPath: '_bmad-output/runtime/context/stories/S-codex-consumer.json',
          },
        },
      });
      writeJson(path.join(target, '_bmad-output', 'runtime', 'context', 'stories', 'S-codex-consumer.json'), {
        version: 1,
        flow: 'story',
        stage: 'implement',
        sourceMode: 'full_bmad',
        contextScope: 'story',
        storyId: 'S-codex-consumer',
        runId: 'codex-consumer-five-layer-run',
        artifactRoot: '_bmad-output/implementation-artifacts/S-codex-consumer',
        updatedAt: new Date().toISOString(),
      });

      const fakeCodexBin = writeFakeCodexBinary(target);
      const output = execSync(
        'npx bmad-speckit main-agent-orchestration --action run-loop --flow story --stage implement --host codex',
        {
          cwd: target,
          encoding: 'utf8',
          env: { ...process.env, CODEX_WORKER_ADAPTER_BIN: fakeCodexBin },
        }
      );
      const result = JSON.parse(output) as {
        status: string;
        dispatchInstruction?: { host?: string; packetId?: string };
        taskReport?: { status?: string; validationsRun?: string[] };
        finalSurface?: { pendingPacketStatus?: string; orchestrationState?: { host?: string } };
      };

      expect(result.status).toBe('completed');
      expect(result.dispatchInstruction?.host).toBe('codex');
      expect(result.taskReport?.status).toBe('done');
      expect(result.taskReport?.validationsRun).toContain('fake-codex-consumer-exec');
      expect(result.taskReport?.validationsRun).not.toContain('codex-worker-adapter-smoke');
      expect(result.finalSurface?.pendingPacketStatus).toBe('completed');
      expect(result.finalSurface?.orchestrationState?.host).toBe('codex');

      const deliveryOutput = run(
        'npx bmad-speckit main-agent-orchestration --action inspect --flow story --stage implement --host codex',
        target
      );
      expect(JSON.parse(deliveryOutput).orchestrationState.host).toBe('codex');

      writeText(path.join(target, '_bmad-output', 'runtime', 'context', 'project.json'), 'project-context\n');
      writeText(path.join(target, '_bmad-output', 'runtime', 'gates', 'main-agent-release-gate-report.json'), '{}\n');
      writeText(path.join(target, '_bmad-output', 'runtime', 'gates', 'main-agent-delivery-truth-gate-report.json'), '{}\n');
      const matrixOutput = run('npx bmad-speckit main-agent:bmad-help-five-layer-matrix', target);
      const matrix = JSON.parse(matrixOutput) as {
        allPassed: boolean;
        bmadHelpEntry?: { docsExposeCodex?: boolean };
        progressState?: {
          currentLayer?: string;
          currentStage?: string;
          nextRequiredLayer?: string;
        };
        layers?: Array<{ stages: string[] }>;
      };
      expect(matrix.allPassed).toBe(true);
      expect(matrix.bmadHelpEntry?.docsExposeCodex).toBe(true);
      expect(matrix.progressState?.currentLayer).toBe('layer_2');
      expect(matrix.progressState?.currentStage).toBe('arch');
      expect(matrix.progressState?.nextRequiredLayer).toBe('layer_2');
      expect(matrix.layers?.flatMap((layer) => layer.stages)).toEqual(
        expect.arrayContaining(['post_audit', 'pr_review', 'release_gate', 'delivery_truth_gate'])
      );
    } finally {
      fs.rmSync(target, { recursive: true, force: true });
    }
  }, 180_000);

  it('keeps consumer Codex closeout fail-closed until real release and delivery truth evidence exists', () => {
    const target = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-consumer-delivery-gate-'));
    try {
      fs.writeFileSync(
        path.join(target, 'package.json'),
        JSON.stringify({ name: 'codex-consumer-delivery-gate', version: '1.0.0', private: true }),
        'utf8'
      );
      run(`npm install --save-dev "file:${ROOT.replace(/\\/g, '/')}"`, target);
      run('npx bmad-speckit-init --agent codex', target);

      const reportPath = path.join(target, '_bmad-output', 'runtime', 'gates', 'delivery-truth.json');
      expect(() =>
        run(
          `npx --no-install bmad-speckit main-agent:delivery-truth-gate --cwd . --reportPath "${reportPath}"`,
          target
        )
      ).toThrow();
      const report = JSON.parse(fs.readFileSync(reportPath, 'utf8')) as {
        completionAllowed: boolean;
        completionLanguage: string;
        missingEvidence: string[];
      };
      expect(report.completionAllowed).toBe(false);
      expect(report.completionLanguage).toBe('blocked_only');
      expect(report.missingEvidence.length).toBeGreaterThan(0);
    } finally {
      fs.rmSync(target, { recursive: true, force: true });
    }
  }, 180_000);

  it('installs from packed tgz and exposes Codex public closeout CLI without transient tool install', () => {
    const packRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-pack-root-'));
    const target = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-packed-consumer-'));
    try {
      const packOutput = run(`npm pack --pack-destination "${packRoot}"`, ROOT);
      const tgzName = packOutput
        .trim()
        .split(/\r?\n/)
        .filter(Boolean)
        .at(-1);
      if (!tgzName) {
        throw new Error(`npm pack did not return a tarball name: ${packOutput}`);
      }
      const tgzPath = path.join(packRoot, tgzName);
      fs.writeFileSync(
        path.join(target, 'package.json'),
        JSON.stringify({ name: 'codex-packed-consumer', version: '1.0.0', private: true }),
        'utf8'
      );
      run(`npm install --save-dev "${tgzPath.replace(/\\/g, '/')}"`, target);
      run('npx --no-install bmad-speckit-init --agent codex', target);
      expect(run('npx --no-install bmad-speckit check', target)).toMatch(/Check OK|OK/i);
      expect(
        fs.existsSync(
          path.join(target, 'node_modules', 'bmad-speckit-sdd-flow', 'docs', 'how-to', 'codex-setup.md')
        )
      ).toBe(true);

      writeText(path.join(target, '_bmad-output', 'runtime', 'context', 'project.json'), 'project-context\n');
      const matrix = JSON.parse(run('npx --no-install bmad-speckit main-agent:bmad-help-five-layer-matrix', target)) as {
        allPassed: boolean;
        bmadHelpEntry?: { docsExposeCodex?: boolean };
      };
      expect(matrix.allPassed).toBe(true);
      expect(matrix.bmadHelpEntry?.docsExposeCodex).toBe(true);

      expect(run('npx --no-install bmad-speckit main-agent:quality-gate --help', target)).toContain(
        'main-agent:quality-gate'
      );
      expect(run('npx --no-install bmad-speckit main-agent:release-gate --help', target)).toContain(
        'main-agent:release-gate'
      );
      expect(run('npx --no-install bmad-speckit main-agent:delivery-truth-gate --help', target)).toContain(
        'main-agent:delivery-truth-gate'
      );
    } finally {
      fs.rmSync(packRoot, { recursive: true, force: true });
      fs.rmSync(target, { recursive: true, force: true });
    }
  }, 240_000);
});
