import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  executeCriticalAuditorJudgeAdapter,
  buildMainAgentCanonicalJudgeRunDispatch,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-orchestration';

const ROOT = process.cwd();
const LEGACY_ACTION = 'requirements-contract-critical-auditor-judge-adapter';

describe('requirements contract Judge forbidden seams', () => {
  it('keeps legacy direct adapter dispatch fail-closed in Main Agent production wiring', () => {
    expect(() =>
      executeCriticalAuditorJudgeAdapter({
        projectRoot: ROOT,
        requestPath: 'request.json',
        outputDir: 'out',
        roundIndex: 1,
        expected: {} as never,
      })
    ).toThrow('main_agent_judge_legacy_direct_adapter_forbidden');
  });

  it('exposes canonical judge run dispatch without caller authority injection', () => {
    expect(() =>
      buildMainAgentCanonicalJudgeRunDispatch({
        projectRoot: ROOT,
        config: '_bmad/_config/governance-remediation.yaml',
        request: 'request.json',
        role: 'requirements_critical_auditor',
        attemptId: 'attempt-1',
        outputDir: 'out',
        controlledDispatchRef: { packetId: 'packet-1', packetKind: 'execution' },
        callerVerdict: 'pass',
      })
    ).toThrow('main_agent_judge_bridge_caller_authority_injection');

    const dispatch = buildMainAgentCanonicalJudgeRunDispatch({
      projectRoot: ROOT,
      config: '_bmad/_config/governance-remediation.yaml',
      request: 'request.json',
      role: 'final_acceptance_judge',
      attemptId: 'attempt-2',
      outputDir: 'out',
      controlledDispatchRef: { packetId: 'packet-2', packetKind: 'execution' },
    });

    expect(dispatch).toMatchObject({
      command: 'bmad-speckit judge run',
      role: 'final_acceptance_judge',
      roleInference: false,
      directAdapterDispatch: false,
      callerAuthorityInjection: false,
      decision: 'pass',
    });
    expect(dispatch.argv).toContain('judge');
    expect(dispatch.argv).toContain('run');
  });

  it('does not expose the legacy Critical Auditor adapter as a public package action', () => {
    const bin = readFileSync(path.join(ROOT, 'packages/bmad-speckit/bin/bmad-speckit.js'), 'utf8');
    const manifest = JSON.parse(
      readFileSync(
        path.join(
          ROOT,
          '_bmad/shared/requirements-contract/requirements-contract-package-runtime-action-binding-manifest.json'
        ),
        'utf8'
      )
    ) as { actions: Array<{ actionId: string }> };

    expect(bin).not.toContain(LEGACY_ACTION);
    expect(manifest.actions.map((action) => action.actionId)).not.toContain(LEGACY_ACTION);
    expect(manifest.actions.map((action) => action.actionId)).toContain('requirements-contract-judge-run');
  });
});
