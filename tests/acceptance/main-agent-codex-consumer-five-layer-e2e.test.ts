import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildPassImplementationEntryGate,
  buildSixModelResultsForImplementationReady,
  linkRepoNodeModulesIntoProject,
  writeMinimalRequirementRecordContext,
} from '../helpers/runtime-registry-fixture';
import { writeFakeReqTraceSkill } from '../helpers/requirement-fixture-runtime';

const ROOT = path.join(import.meta.dirname, '..', '..');

function run(command: string, cwd: string): string {
  return execSync(command, {
    cwd,
    encoding: 'utf8',
    env: { ...process.env },
  });
}

function hasCodexCli(): boolean {
  try {
    execSync('codex --version', {
      cwd: ROOT,
      stdio: 'ignore',
      env: { ...process.env },
    });
    return true;
  } catch {
    return false;
  }
}

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + '\n', 'utf8');
}

function writeText(filePath: string, value: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, value, 'utf8');
}

function sha256File(filePath: string): string {
  return createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function writeLayer1PrdCompletionEvidence(root: string): void {
  const prdRelativePath = '_bmad-output/planning-artifacts/dev/prd.md';
  const productBriefRelativePath = '_bmad-output/planning-artifacts/product-brief-consumer.md';
  const runtimeContextRelativePath = '_bmad-output/runtime/context/project.json';
  const prdPath = path.join(root, prdRelativePath);
  const productBriefPath = path.join(root, productBriefRelativePath);
  const runtimeContextPath = path.join(root, runtimeContextRelativePath);
  writeText(prdPath, '# PRD\n\nConsumer layer 1 PRD evidence.\n');
  writeText(productBriefPath, '# Product Brief\n\nConsumer layer 1 product brief evidence.\n');
  if (!fs.existsSync(runtimeContextPath)) {
    writeJson(runtimeContextPath, { flow: 'story', stage: 'prd' });
  }
  writeJson(path.join(root, '_bmad-output', 'runtime', 'context', 'layer_1-prd.complete.json'), {
    markerType: 'bmad_help_five_layer_stage_complete',
    schemaVersion: 'layer_1_prd_completion/v1',
    layer: 'layer_1',
    stage: 'prd',
    generatedAt: '2026-04-29T00:00:00.000Z',
    inputs: {
      productBriefs: [productBriefRelativePath],
      prds: [prdRelativePath],
      runtimeContext: runtimeContextRelativePath,
    },
    sources: {
      planningArtifactsRoot: '_bmad-output/planning-artifacts',
      branch: 'dev',
      bmmConfigPath: '_bmad/bmm/config.yaml',
      productBriefWorkflowPath:
        '_bmad/bmm/workflows/1-analysis/create-product-brief/steps/step-01-init.md',
      prdWorkflowPath: '_bmad/bmm/workflows/2-plan-workflows/create-prd/steps-c/step-01-init.md',
    },
    hashes: {
      [prdRelativePath]: sha256File(prdPath),
      [productBriefRelativePath]: sha256File(productBriefPath),
    },
    acceptance: {
      prdPresent: true,
      contextPresent: true,
      productBriefPresent: true,
      layer1Complete: true,
    },
    handoff: {
      nextLayer: 'layer_2',
      nextStage: 'arch',
      summary: 'Layer 1 PRD/context evidence is complete and ready for architecture handoff.',
    },
  });
}

function writeFakeCodexBinary(root: string): string {
  const fakeCodexPath = path.join(root, 'fake-codex.cjs');
  writeText(
    fakeCodexPath,
    [
      "const fs = require('fs');",
      "const path = require('path');",
      "const input = fs.readFileSync(0, 'utf8');",
      'const reportPath = input.match(/write a JSON TaskReport to: (.+)/i)?.[1]?.trim();',
      'const packetId = input.match(/Packet ID: (.+)/i)?.[1]?.trim();',
      'const allowedScopeLine = input.match(/Allowed write scope: (.+)/i)?.[1] || "";',
      'const evidencePath = allowedScopeLine.split(",").map((item) => item.trim()).find((item) => item && !item.endsWith("/**") && fs.existsSync(path.resolve(item))) || reportPath;',
      'if (!reportPath || !packetId) process.exit(2);',
      'fs.mkdirSync(path.dirname(reportPath), { recursive: true });',
      "fs.writeFileSync(reportPath, JSON.stringify({ packetId, status: 'done', filesChanged: [], validationsRun: ['fake-codex-consumer-exec'], evidence: [evidencePath], downstreamContext: ['consumer codex exec completed'] }, null, 2) + '\\n', 'utf8');",
      'process.exit(0);',
      '',
    ].join('\n')
  );
  const fakeCodexBin =
    process.platform === 'win32'
      ? path.join(root, 'fake-codex.cmd')
      : path.join(root, 'fake-codex');
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

function materializeConfirmedImplementationRequirement(
  root: string,
  opts: { storyId: string; runId: string }
): void {
  linkRepoNodeModulesIntoProject(root);
  writeMinimalRequirementRecordContext(root, {
    flow: 'story',
    stage: 'implement',
    sourceMode: 'full_bmad',
    storyId: opts.storyId,
    runId: opts.runId,
    implementationEntryGate: buildPassImplementationEntryGate({ flow: 'story' }),
    confirmedSource: true,
    currentMentalModel: 'implementation_readiness',
    sixModelResults: buildSixModelResultsForImplementationReady(),
  });
  writeFakeReqTraceSkill(root);
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
          path.join(
            target,
            'node_modules',
            'bmad-speckit-sdd-flow',
            'docs',
            'how-to',
            'codex-setup.md'
          )
        )
      ).toBe(true);

      run(
        'npx bmad-speckit ensure-run-runtime-context --story-key 16-1-codex-consumer --lifecycle dev_story',
        target
      );
      const registryPath = path.join(target, '_bmad-output', 'runtime', 'registry.json');
      expect(fs.existsSync(registryPath)).toBe(true);
      const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8')) as {
        activeScope?: { scopeType?: string; runId?: string; resolvedContextPath?: string };
        runContexts?: Record<string, { path?: string }>;
      };
      expect(registry.activeScope?.scopeType).toBe('run');
      expect(registry.activeScope?.runId).toEqual(expect.any(String));
      expect(registry.runContexts?.[registry.activeScope?.runId ?? '']?.path).toBe(
        registry.activeScope?.resolvedContextPath
      );
      expect(fs.existsSync(registry.activeScope?.resolvedContextPath ?? '')).toBe(true);
      materializeConfirmedImplementationRequirement(target, {
        storyId: '16-1-codex-consumer',
        runId: registry.activeScope?.runId ?? 'codex-consumer-run',
      });

      const fakeCodexBin = writeFakeCodexBinary(target);
      const output = execSync(
        'npx bmad-speckit main-agent-orchestration --action run-loop --flow story --stage implement --host codex',
        {
          cwd: target,
          encoding: 'utf8',
          env: {
            ...process.env,
            CODEX_WORKER_ADAPTER_BIN: fakeCodexBin,
            MAIN_AGENT_ALLOW_CODEX_BIN_OVERRIDE: 'true',
          },
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

      writeLayer1PrdCompletionEvidence(target);
      writeJson(path.join(target, 'docs', 'architecture', 'architecture.json'), {
        architecture: true,
      });
      writeJson(path.join(target, 'docs', 'stories', 'epics.json'), { epics: [] });
      writeJson(path.join(target, 'docs', 'stories', 'story-create.json'), { stories: [] });
      const matrixAlias = JSON.parse(
        run('npx bmad-speckit main-agent:bmad-help-five-layer-matrix --json', target)
      ) as {
        schemaVersion: string;
        command: string;
        status: string;
        replacement: string;
        exitCode: number;
      };
      expect(matrixAlias.schemaVersion).toBe('bmad-speckit-deprecated-alias/v1');
      expect(matrixAlias.command).toBe('main-agent:bmad-help-five-layer-matrix');
      expect(matrixAlias.status).toBe('deprecated');
      expect(matrixAlias.replacement).toBe('bmad-help');
      expect(matrixAlias.exitCode).toBe(0);
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

      const reportPath = path.join(
        target,
        '_bmad-output',
        'runtime',
        'gates',
        'delivery-truth.json'
      );
      const deliveryOutput = run(
        `npx --no-install bmad-speckit main-agent:delivery-truth-gate --cwd . --json --reportPath "${reportPath}"`,
        target
      );
      const deliveryEnvelope = JSON.parse(deliveryOutput) as {
        schemaVersion: string;
        action: string;
        status: string;
        exitCode: number;
        data?: { reportPath?: string };
      };
      expect(deliveryEnvelope.schemaVersion).toBe('main-agent-package-runtime/v1');
      expect(deliveryEnvelope.action).toBe('delivery-truth-gate');
      expect(deliveryEnvelope.status).toBe('package_runtime_ready');
      expect(deliveryEnvelope.exitCode).toBe(0);
      expect(deliveryEnvelope.data?.reportPath).toBe(reportPath);
      const report = JSON.parse(fs.readFileSync(reportPath, 'utf8')) as {
        completionAllowed: boolean;
        completionLanguage: string;
        mode: string;
      };
      expect(report.completionAllowed).toBe(false);
      expect(report.completionLanguage).toBe('partial_only');
      expect(report.mode).toBe('package_runtime_module');
    } finally {
      fs.rmSync(target, { recursive: true, force: true });
    }
  }, 180_000);

  it.skipIf(!hasCodexCli())(
    'fails closed instead of claiming success when real Codex CLI produces no TaskReport',
    () => {
      const target = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-consumer-real-cli-'));
      try {
        run('codex --version', ROOT);
        fs.writeFileSync(
          path.join(target, 'package.json'),
          JSON.stringify({ name: 'codex-consumer-real-cli', version: '1.0.0', private: true }),
          'utf8'
        );
        run(`npm install --save-dev "file:${ROOT.replace(/\\/g, '/')}"`, target);
        run('npx --no-install bmad-speckit-init --agent codex', target);
        run(
          'npx --no-install bmad-speckit ensure-run-runtime-context --story-key 16-3-codex-real-cli --lifecycle dev_story',
          target
        );
        const registry = JSON.parse(
          fs.readFileSync(path.join(target, '_bmad-output', 'runtime', 'registry.json'), 'utf8')
        ) as { activeScope?: { runId?: string } };
        materializeConfirmedImplementationRequirement(target, {
          storyId: '16-3-codex-real-cli',
          runId: registry.activeScope?.runId ?? 'codex-real-cli-run',
        });
        let output = '';
        expect(() => {
          output = run(
            'npx --no-install bmad-speckit main-agent-orchestration --action run-loop --flow story --stage implement --host codex',
            target
          );
        }).toThrow();
        const reportPath = path.join(target, '_bmad-output', 'runtime', 'codex', 'task-reports');
        const taskReports = fs.existsSync(reportPath) ? fs.readdirSync(reportPath) : [];
        expect(taskReports.length).toBeGreaterThan(0);
        const blockedReport = JSON.parse(
          fs.readFileSync(path.join(reportPath, taskReports[0]), 'utf8')
        ) as {
          status: string;
          evidence?: string[];
        };
        expect(blockedReport.status).toBe('blocked');
        expect(blockedReport.evidence).toContain('codex did not produce task report');
        expect(output).toBe('');
        const stateFilesRoot = path.join(
          target,
          '_bmad-output',
          'runtime',
          'governance',
          'orchestration-state'
        );
        const stateFile = fs.readdirSync(stateFilesRoot).find((name) => name.endsWith('.json'));
        expect(stateFile).toEqual(expect.any(String));
        const state = JSON.parse(
          fs.readFileSync(path.join(stateFilesRoot, stateFile as string), 'utf8')
        ) as {
          status: string;
          host?: string;
          lastTaskReport?: { status?: string };
        };
        expect(state.host).toBe('codex');
        expect(state.lastTaskReport?.status).toBe('blocked');
      } finally {
        fs.rmSync(target, { recursive: true, force: true });
      }
    },
    240_000
  );

  it('installs from packed tgz and exposes Codex public closeout CLI without transient tool install', () => {
    const packRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-pack-root-'));
    const target = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-packed-consumer-'));
    try {
      const packOutput = run(`npm pack --pack-destination "${packRoot}"`, ROOT);
      const tgzName = packOutput.trim().split(/\r?\n/).filter(Boolean).at(-1);
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
          path.join(
            target,
            'node_modules',
            'bmad-speckit-sdd-flow',
            'docs',
            'how-to',
            'codex-setup.md'
          )
        )
      ).toBe(true);

      run(
        'npx --no-install bmad-speckit ensure-run-runtime-context --story-key 16-2-codex-packed --lifecycle dev_story',
        target
      );
      const registryPath = path.join(target, '_bmad-output', 'runtime', 'registry.json');
      expect(fs.existsSync(registryPath)).toBe(true);
      const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8')) as {
        activeScope?: { scopeType?: string; runId?: string; resolvedContextPath?: string };
        runContexts?: Record<string, { path?: string }>;
      };
      expect(registry.activeScope?.scopeType).toBe('run');
      expect(registry.activeScope?.runId).toEqual(expect.any(String));
      expect(registry.runContexts?.[registry.activeScope?.runId ?? '']?.path).toBe(
        registry.activeScope?.resolvedContextPath
      );
      expect(fs.existsSync(registry.activeScope?.resolvedContextPath ?? '')).toBe(true);
      materializeConfirmedImplementationRequirement(target, {
        storyId: '16-2-codex-packed',
        runId: registry.activeScope?.runId ?? 'codex-packed-run',
      });
      const fakeCodexBin = writeFakeCodexBinary(target);
      const runLoop = JSON.parse(
        execSync(
          'npx --no-install bmad-speckit main-agent-orchestration --action run-loop --flow story --stage implement --host codex',
          {
            cwd: target,
            encoding: 'utf8',
            env: {
              ...process.env,
              CODEX_WORKER_ADAPTER_BIN: fakeCodexBin,
              MAIN_AGENT_ALLOW_CODEX_BIN_OVERRIDE: 'true',
            },
          }
        )
      ) as {
        status: string;
        dispatchInstruction?: { host?: string };
        taskReport?: { status?: string; validationsRun?: string[] };
        finalSurface?: { pendingPacketStatus?: string };
      };
      expect(runLoop.status).toBe('completed');
      expect(runLoop.dispatchInstruction?.host).toBe('codex');
      expect(runLoop.taskReport?.status).toBe('done');
      expect(runLoop.taskReport?.validationsRun).toContain('fake-codex-consumer-exec');
      expect(runLoop.finalSurface?.pendingPacketStatus).toBe('completed');
      const matrixAlias = JSON.parse(
        run('npx --no-install bmad-speckit main-agent:bmad-help-five-layer-matrix --json', target)
      ) as {
        schemaVersion: string;
        command: string;
        status: string;
        replacement: string;
        exitCode: number;
      };
      expect(matrixAlias.schemaVersion).toBe('bmad-speckit-deprecated-alias/v1');
      expect(matrixAlias.command).toBe('main-agent:bmad-help-five-layer-matrix');
      expect(matrixAlias.status).toBe('deprecated');
      expect(matrixAlias.replacement).toBe('bmad-help');
      expect(matrixAlias.exitCode).toBe(0);

      const runId = 'codex-packed-run';
      const storyKey = 'S-codex-packed';
      const evidenceBundleId = 'codex-packed-run:bundle';
      const gatesRoot = path.join(target, '_bmad-output', 'runtime', 'gates');
      const codexProofPath = path.join(gatesRoot, 'codex-quality-proof', `${runId}.proof.json`);
      const qualityGatePath = path.join(gatesRoot, 'main-agent-quality-gate-report.json');
      writeJson(codexProofPath, {
        reportType: 'codex_run_scoped_quality_proof',
        evidence_provenance: { runId, storyKey, evidenceBundleId },
        codex: { hostKind: 'codex', mode: 'codex_exec', taskReportStatus: 'done' },
      });
      const qualityOutput = run(
        [
          'npx --no-install bmad-speckit main-agent:quality-gate',
          '--runId',
          runId,
          '--storyKey',
          storyKey,
          '--evidenceBundleId',
          evidenceBundleId,
          '--codexProofPath',
          `"${codexProofPath}"`,
          '--json',
          '--reportPath',
          `"${qualityGatePath}"`,
        ].join(' '),
        target
      );
      const quality = JSON.parse(qualityOutput) as {
        schemaVersion: string;
        action: string;
        status: string;
        exitCode: number;
        data?: {
          report?: {
            reportType?: string;
            criticalFailures?: number;
            mode?: string;
          };
          reportPath?: string;
        };
      };
      expect(quality.schemaVersion).toBe('main-agent-package-runtime/v1');
      expect(quality.action).toBe('quality-gate');
      expect(quality.status).toBe('package_runtime_ready');
      expect(quality.exitCode).toBe(0);
      expect(quality.data?.report?.reportType).toBe('main_agent_quality_gate_package_runtime');
      expect(quality.data?.report?.criticalFailures).toBe(0);
      expect(quality.data?.report?.mode).toBe('package_runtime_module');
      expect(quality.data?.reportPath).toBe(qualityGatePath);

      const hostMatrixPath = path.join(
        target,
        '_bmad-output',
        'runtime',
        'e2e',
        'multi-host-pr-orchestration-report.json'
      );
      const prTopologyPath = path.join(target, '_bmad-output', 'runtime', 'pr', 'pr_topology.json');
      const ledgerPath = path.join(
        target,
        '_bmad-output',
        'runtime',
        'governance',
        'execution-audit-ledger.json'
      );
      const ledgerEvidencePath = path.join(
        target,
        '_bmad-output',
        'runtime',
        'governance',
        'ledger-evidence.json'
      );
      writeJson(hostMatrixPath, {
        journeyMode: 'real',
        journeyE2EPassed: true,
        hostsPassed: { claude: true, codex: true },
        hostMatrix: {
          matrixType: 'main_agent_multi_host_matrix',
          requiredHosts: ['cursor', 'claude', 'codex'],
          hostsPassed: { cursor: true, claude: true, codex: true },
          allRequiredHostsPassed: true,
          legacyDualHostPassed: true,
        },
        githubPrApi: { passed: true, prUrl: 'https://example.invalid/pull/1' },
        evidence_provenance: {
          runId,
          storyKey,
          evidenceBundleId,
          gateReportHash: 'host-matrix-hash',
        },
      });
      writeJson(prTopologyPath, {
        version: 1,
        batch_id: 'codex-packed',
        evidence_provenance: {
          runId,
          storyKey,
          evidenceBundleId,
          gateReportHash: 'pr-topology-hash',
        },
        required_nodes: [
          {
            node_id: 'codex-node',
            target_pr: 'https://example.invalid/pull/1',
            depends_on: [],
            state: 'merged',
          },
        ],
        all_affected_stories_passed: true,
      });
      writeJson(ledgerEvidencePath, { status: 'pass' });
      writeJson(ledgerPath, {
        version: 1,
        ledgerType: 'execution_audit',
        runId,
        generatedAt: '2026-04-28T00:00:00.000Z',
        items: [
          {
            taskId: 'codex-packed-closeout',
            status: 'pass',
            updatedAt: '2026-04-28T00:00:00.000Z',
            evidenceRefs: ['_bmad-output/runtime/governance/ledger-evidence.json'],
          },
        ],
      });
      run(
        [
          'npx --no-install bmad-speckit main-agent:release-gate',
          '--runId',
          runId,
          '--storyKey',
          storyKey,
          '--evidenceBundleId',
          evidenceBundleId,
          '--hostMatrixPath',
          `"${hostMatrixPath}"`,
          '--prTopologyPath',
          `"${prTopologyPath}"`,
          '--qualityGatePath',
          `"${qualityGatePath}"`,
          '--ledgerPath',
          `"${ledgerPath}"`,
          '--singleSourceCommand',
          `"${process.execPath} -e \\"process.exit(0)\\""`,
          '--rerunGateCommand',
          `"${process.execPath} -e \\"process.exit(0)\\""`,
          '--json',
          '--writeReport',
        ].join(' '),
        target
      );
      const releaseReportPath = path.join(gatesRoot, 'main-agent-release-gate-report.json');
      const releaseOutput = fs.readFileSync(releaseReportPath, 'utf8');
      const release = JSON.parse(releaseOutput) as {
        reportType?: string;
        criticalFailures: number;
        mode?: string;
      };
      expect(release.reportType).toBe('main_agent_release_gate_package_runtime');
      expect(release.criticalFailures).toBe(0);
      expect(release.mode).toBe('package_runtime_module');

      const sprintAuditPath = path.join(
        target,
        '_bmad-output',
        'runtime',
        'governance',
        'sprint-status-update-audit.json'
      );
      writeJson(sprintAuditPath, { authorized: true });
      const deliveryOutput = run(
        [
          'npx --no-install bmad-speckit main-agent:delivery-truth-gate',
          '--cwd',
          '.',
          '--releaseGatePath',
          `"${releaseReportPath}"`,
          '--hostMatrixPath',
          `"${hostMatrixPath}"`,
          '--prTopologyPath',
          `"${prTopologyPath}"`,
          '--sprintAuditPath',
          `"${sprintAuditPath}"`,
          '--qualityGatePath',
          `"${qualityGatePath}"`,
          '--json',
        ].join(' '),
        target
      );
      const delivery = JSON.parse(deliveryOutput) as {
        schemaVersion: string;
        action: string;
        status: string;
        exitCode: number;
        data?: { report?: { completionAllowed?: boolean; mode?: string } };
      };
      expect(delivery.schemaVersion).toBe('main-agent-package-runtime/v1');
      expect(delivery.action).toBe('delivery-truth-gate');
      expect(delivery.status).toBe('package_runtime_ready');
      expect(delivery.exitCode).toBe(0);
      expect(delivery.data?.report?.completionAllowed).toBe(false);
      expect(delivery.data?.report?.mode).toBe('package_runtime_module');
    } finally {
      fs.rmSync(packRoot, { recursive: true, force: true });
      fs.rmSync(target, { recursive: true, force: true });
    }
  }, 240_000);
});
