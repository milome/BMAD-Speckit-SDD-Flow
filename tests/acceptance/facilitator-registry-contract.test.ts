import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import {
  FACILITATOR_REGISTRY_VERSION,
  getFacilitatorRegistration,
  resolveFacilitatorRuntimeBindings,
} from '../../scripts/facilitator-registry';

describe('facilitator registry contract', () => {
  it('registers facilitator as a formal cross-host product object with specialized Claude subtype routing', () => {
    expect(FACILITATOR_REGISTRY_VERSION).toBe('facilitator_registry_v1');

    const registration = getFacilitatorRegistration();
    expect(registration.identity).toBe('party_mode_facilitator');
    expect(registration.displayName).toBe('party-mode-facilitator');
    expect(registration.cursorDefinitionSourcePath).toBe('.cursor/agents/party-mode-facilitator.md');
    expect(registration.claudeTarget).toStrictEqual({
      agentPath: '.claude/agents/party-mode-facilitator.md',
      subagentType: 'party-mode-facilitator',
    });

    expect(registration.hosts.cursor.preferredRoute).toStrictEqual({
      tool: 'cursor-task',
      subtypeOrExecutor: 'party-mode-facilitator',
    });
    expect(registration.hosts.cursor.fallbackRoute).toStrictEqual({
      tool: 'mcp_task',
      subtypeOrExecutor: 'generalPurpose',
    });
    expect(registration.hosts.claude.preferredRoute).toStrictEqual({
      tool: 'Agent',
      subtypeOrExecutor: 'party-mode-facilitator',
    });
    expect(registration.hosts.claude.fallbackRoute).toStrictEqual({
      tool: 'Agent',
      subtypeOrExecutor: 'general-purpose',
    });
  });

  it('points at canonical source files for both hosts', () => {
    const registration = getFacilitatorRegistration();
    expect(
      existsSync(path.join(process.cwd(), registration.cursorDefinitionSourcePath))
    ).toBe(true);
    expect(existsSync(path.join(process.cwd(), registration.claudeTarget.agentPath))).toBe(true);

    const claudeContent = readFileSync(
      path.join(process.cwd(), registration.claudeTarget.agentPath),
      'utf8'
    );
    expect(claudeContent).toContain('name: party-mode-facilitator');
    expect(claudeContent).toContain('formal `party-mode-facilitator` subtype');
  });

  it('resolves facilitator and canonical party-mode assets through the shared localized resolver entry', () => {
    const cursor = resolveFacilitatorRuntimeBindings(process.cwd(), 'cursor', 'zh');
    expect(cursor.facilitator.resolvedRelativePath).toBe(
      '_bmad/cursor/agents/party-mode-facilitator.zh.md'
    );
    expect(cursor.workflow.resolvedRelativePath).toBe(
      '_bmad/core/skills/bmad-party-mode/workflow.zh.md'
    );
    expect(cursor.step02.resolvedRelativePath).toBe(
      '_bmad/core/skills/bmad-party-mode/steps/step-02-discussion-orchestration.zh.md'
    );

    const claude = resolveFacilitatorRuntimeBindings(process.cwd(), 'claude', 'en');
    expect(claude.facilitator.resolvedRelativePath).toBe(
      '_bmad/claude/agents/party-mode-facilitator.en.md'
    );
    expect(claude.step03.resolvedRelativePath).toBe(
      '_bmad/core/skills/bmad-party-mode/steps/step-03-graceful-exit.en.md'
    );
  });
});
