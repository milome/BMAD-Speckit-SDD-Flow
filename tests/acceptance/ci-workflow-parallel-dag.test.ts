import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { load } from 'js-yaml';

const require = createRequire(import.meta.url);
const { inspectCiWorkflow } = require('../../tools/ci/verify-ci-authority-hard-cut.cjs');

function readWorkflow() {
  return load(readFileSync('.github/workflows/ci.yml', 'utf8')) as any;
}

function bashExecutable() {
  if (process.platform !== 'win32') return process.env.BASH_EXE?.trim() || 'bash';
  const candidates = [];
  const explicit = process.env.BASH_EXE?.trim();
  if (explicit) candidates.push(resolve(explicit));
  try {
    for (const gitPath of execFileSync('where.exe', ['git'], { encoding: 'utf8' })
      .split(/\r?\n/u)
      .filter(Boolean)) {
      candidates.push(resolve(dirname(gitPath.trim()), '..', 'bin', 'bash.exe'));
    }
  } catch {
    // Fall through to Git's runtime path and the final diagnostic.
  }
  try {
    const gitExecPath = execFileSync('git', ['--exec-path'], { encoding: 'utf8' }).trim();
    candidates.push(resolve(gitExecPath, '..', '..', '..', 'bin', 'bash.exe'));
  } catch {
    // The final diagnostic below covers a missing Git installation.
  }
  const candidate = [...new Set(candidates)].find((path) => existsSync(path));
  if (!candidate) throw new Error('GIT_BASH_NOT_FOUND');
  return candidate;
}

function runManualProfileStep(inputProfile: string) {
  const root = mkdtempSync(join(tmpdir(), 'ci-workflow-profile-'));
  const outputPath = join(root, 'github-output').replaceAll('\\', '/');
  const profileStep = readWorkflow().jobs.classify.steps.find((step: any) => step.id === 'profile');
  try {
    const result = spawnSync(bashExecutable(), ['-c', String(profileStep.run)], {
      cwd: root,
      encoding: 'utf8',
      env: {
        ...process.env,
        EVENT_NAME: 'workflow_dispatch',
        GITHUB_OUTPUT: outputPath,
        GITHUB_SHA: 'a'.repeat(40),
        TARGET_SHA: 'a'.repeat(40),
        INPUT_BASE_SHA: '',
        INPUT_PROFILE: inputProfile,
        MERGE_GROUP_BASE_SHA: '',
        PR_BASE_SHA: '',
      },
    });
    return {
      ...result,
      workflowOutput: existsSync(outputPath) ? readFileSync(outputPath, 'utf8') : '',
    };
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
}

describe('governed CI workflow DAG', () => {
  it('uses the single classify, matrix execution, evidence join, and result DAG', () => {
    const workflow = readWorkflow();

    expect(Object.keys(workflow.jobs)).toEqual([
      'classify',
      'execute-shard',
      'evidence-join',
      'ci-result',
    ]);
    expect(workflow.jobs['execute-shard'].strategy.matrix).toBe(
      '${{ fromJSON(needs.classify.outputs.matrix) }}'
    );
    expect(workflow.jobs['classify'].outputs.execution_allowed).toBe(
      '${{ steps.selection-gate.outputs.execution_allowed }}'
    );
    expect(workflow.jobs['classify'].outputs.commit_sha).toBe(
      '${{ steps.target.outputs.commit_sha }}'
    );
    expect(workflow.jobs['execute-shard'].if).toBe(
      "needs.classify.outputs.execution_allowed == 'true'"
    );
    expect(workflow.jobs['evidence-join'].needs).toEqual(['classify', 'execute-shard']);
    expect(workflow.jobs['evidence-join'].if).toBe(
      "always() && needs.classify.outputs.execution_allowed == 'true'"
    );
    expect(workflow.jobs['ci-result'].needs).toEqual(['classify', 'evidence-join']);
    expect(workflow.jobs['ci-result'].name).toBe('CI required');

    const selectionGate = workflow.jobs.classify.steps.find(
      (step: any) => step.id === 'selection-gate'
    );
    expect(selectionGate.run).toContain('selectionStatus');
    expect(selectionGate.run).toContain('execution_allowed');

    const resultStep = workflow.jobs['ci-result'].steps.at(-1);
    expect(resultStep.run).toContain('CI_SELECTION_BLOCKED');
  });

  it('prepares generated runtime before every isolated shard execution', () => {
    const workflow = readWorkflow();
    const steps = workflow.jobs['execute-shard'].steps;
    const checkout = steps.find((step: any) => step.uses === 'actions/checkout@v4');
    const prepareIndex = steps.findIndex((step: any) =>
      String(step.run || '').includes('npm run ci:prepare-shard-runtime')
    );
    const executeIndex = steps.findIndex((step: any) =>
      String(step.run || '').includes('npm run ci:run-shard')
    );

    expect(checkout?.with?.['fetch-depth']).toBe(0);
    expect(prepareIndex).toBeGreaterThanOrEqual(0);
    expect(executeIndex).toBeGreaterThan(prepareIndex);
  });

  it('keeps selection authority in classify and matrix rows free of test paths', () => {
    const inspection = inspectCiWorkflow({
      workflowSource: readFileSync('.github/workflows/ci.yml', 'utf8'),
    });

    expect(inspection.catalogProducerCount).toBe(1);
    expect(inspection.selectionProducerCount).toBe(1);
    expect(inspection.manifestProducerCount).toBe(1);
    expect(inspection.serialAllTestsJobCount).toBe(0);
    expect(inspection.oldSelectionFallbackCount).toBe(0);
    expect(inspection.matrixTestPathFieldCount).toBe(0);
    expect(inspection.modelInvocationCount).toBe(0);
  });

  it('pins the declared npm runtime in every job that invokes governed npm scripts', () => {
    const workflow = readWorkflow();
    for (const jobId of ['classify', 'execute-shard', 'evidence-join']) {
      const runText = workflow.jobs[jobId].steps
        .map((step: any) => String(step.run || ''))
        .join('\n');
      expect(runText, jobId).toContain('npm install --global npm@10.9.4');
    }
  });

  it('maps pull requests to pr-fast and scheduled compensation to nightly-full', () => {
    const workflow = readWorkflow();
    const profileStep = workflow.jobs.classify.steps.find((step: any) => step.id === 'profile');
    const profileOptions = workflow.on.workflow_dispatch.inputs.requested_profile.options;

    expect(profileStep.run).toMatch(/pull_request\)\s+profile=pr-fast/mu);
    expect(profileStep.run).toMatch(/merge_group\)\s+profile=pr-fast/mu);
    expect(profileStep.run).toMatch(/schedule\)\s+profile=nightly-full/mu);
    expect(profileOptions).toEqual(
      expect.arrayContaining(['pr-fast', 'nightly-full', 'release-full'])
    );
  });

  it('runs pull request CI for the dev integration branch', () => {
    const workflow = readWorkflow();

    expect(workflow.on.pull_request.branches).toContain('dev');
  });

  it('uses one complete changed-code impact mode for each selection run', () => {
    const workflow = readWorkflow();
    const profileStep = workflow.jobs.classify.steps.find((step: any) => step.id === 'profile');
    const planningStep = workflow.jobs.classify.steps.find((step: any) => step.id === 'planning');
    const selectCommand = String(planningStep.run)
      .split('\n')
      .find((line) => line.includes('run_stage ci:select'));

    expect(profileStep.run).toContain('echo "base_sha=$base" >> "$GITHUB_OUTPUT"');
    expect(planningStep.env.BASE_SHA).toBe('${{ steps.profile.outputs.base_sha }}');
    expect(planningStep.run).toContain('if [ -n "$BASE_SHA" ]');
    expect(planningStep.run).toContain('--facts .artifacts/test-portfolio/test-catalog-facts.json');
    expect(planningStep.run).toContain('--base-sha "$BASE_SHA"');
    expect(planningStep.run).toContain('--commit-sha "$COMMIT_SHA"');
    expect(planningStep.run).toContain(
      '--changed-paths .artifacts/test-portfolio/changed-paths.json'
    );
    expect(selectCommand).toContain('"${selection_args[@]}"');
  });

  it('defaults manual dispatch to nightly-full and exposes an optional base SHA', () => {
    const workflow = readWorkflow();
    const dispatchInputs = workflow.on.workflow_dispatch.inputs;

    expect(dispatchInputs.requested_profile.default).toBe('nightly-full');
    expect(dispatchInputs.base_sha).toMatchObject({ required: false, type: 'string' });
    expect(dispatchInputs.commit_sha).toMatchObject({ required: false, type: 'string' });
  });

  it('binds reusable execution and artifacts to the exact requested commit', () => {
    const workflow = readWorkflow();
    const classify = workflow.jobs.classify;
    const execute = workflow.jobs['execute-shard'];
    const join = workflow.jobs['evidence-join'];
    const classifyCheckout = classify.steps.find(
      (step: any) => step.uses === 'actions/checkout@v4'
    );
    const executeCheckout = execute.steps.find((step: any) => step.uses === 'actions/checkout@v4');
    const joinCheckout = join.steps.find((step: any) => step.uses === 'actions/checkout@v4');
    const planUpload = classify.steps.find(
      (step: any) => step.uses === 'actions/upload-artifact@v4'
    );
    const planDownload = execute.steps.find(
      (step: any) => step.uses === 'actions/download-artifact@v4'
    );
    const finalUpload = join.steps.find((step: any) => step.uses === 'actions/upload-artifact@v4');

    expect(workflow.on.workflow_call.inputs.commit_sha).toMatchObject({
      required: false,
      default: '',
      type: 'string',
    });
    expect(classifyCheckout.with.ref).toBe('${{ inputs.commit_sha || github.sha }}');
    expect(executeCheckout.with.ref).toBe('${{ needs.classify.outputs.commit_sha }}');
    expect(joinCheckout.with.ref).toBe('${{ needs.classify.outputs.commit_sha }}');
    expect(planUpload.with.name).toBe('ci-plan-${{ steps.target.outputs.commit_sha }}');
    expect(planDownload.with.name).toBe('ci-plan-${{ needs.classify.outputs.commit_sha }}');
    expect(finalUpload.with.name).toBe('ci-final-${{ needs.classify.outputs.commit_sha }}');
  });

  it.each(['pr-fast', 'pr-full', 'nightly-deep', 'release-verify'])(
    'fails closed when manual %s omits its base SHA',
    (profile) => {
      const result = runManualProfileStep(profile);

      expect(result.status).toBe(1);
      expect(`${result.stdout}\n${result.stderr}`).toContain(`CI_BASE_SHA_REQUIRED:${profile}`);
      expect(result.workflowOutput).toBe('');
    }
  );

  it.each(['nightly-full', 'release-full'])('allows manual %s without a base SHA', (profile) => {
    const result = runManualProfileStep(profile);

    expect(result.status).toBe(0);
    expect(result.workflowOutput).toContain('base_sha=');
    expect(result.workflowOutput).toContain(`profile=${profile}`);
  });
});
