import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const SOURCE_OF_TRUTH_PATH =
  '{project-root}/_bmad/core/skills/bmad-party-mode/steps/step-02-discussion-orchestration.md';

const SOURCE_OF_TRUTH_FILES = [
  '_bmad/cursor/agents/party-mode-facilitator.md',
  '_bmad/cursor/agents/party-mode-facilitator.zh.md',
  '_bmad/cursor/agents/party-mode-facilitator.en.md',
  '_bmad/claude/agents/party-mode-facilitator.md',
  '_bmad/claude/agents/party-mode-facilitator.zh.md',
  '_bmad/claude/agents/party-mode-facilitator.en.md',
  '_bmad/cursor/skills/bmad-rca-helper/SKILL.md',
  '_bmad/cursor/skills/bmad-rca-helper/SKILL.zh.md',
  '_bmad/cursor/skills/bmad-rca-helper/SKILL.en.md',
  '_bmad/claude/skills/bmad-rca-helper/SKILL.md',
  '_bmad/claude/skills/bmad-rca-helper/SKILL.zh.md',
  '_bmad/claude/skills/bmad-rca-helper/SKILL.en.md',
  '_bmad/cursor/rules/bmad-bug-auto-party-mode.mdc',
  '_bmad/claude/rules/bmad-bug-auto-party-mode.md',
  '_bmad/cursor/rules/bmad-story-assistant.mdc',
  '_bmad/claude/rules/bmad-story-assistant.md',
  '_bmad/cursor/skills/speckit-workflow/SKILL.md',
  '_bmad/cursor/skills/speckit-workflow/SKILL.zh.md',
  '_bmad/cursor/skills/speckit-workflow/SKILL.en.md',
  '_bmad/claude/skills/speckit-workflow/SKILL.md',
  '_bmad/claude/skills/speckit-workflow/SKILL.zh.md',
  '_bmad/claude/skills/speckit-workflow/SKILL.en.md',
  '_bmad/cursor/skills/bmad-bug-assistant/SKILL.md',
  '_bmad/cursor/skills/bmad-bug-assistant/SKILL.zh.md',
  '_bmad/cursor/skills/bmad-bug-assistant/SKILL.en.md',
  '_bmad/claude/skills/bmad-bug-assistant/SKILL.md',
  '_bmad/claude/skills/bmad-bug-assistant/SKILL.zh.md',
  '_bmad/claude/skills/bmad-bug-assistant/SKILL.en.md',
  '_bmad/cursor/skills/bmad-story-assistant/SKILL.md',
  '_bmad/cursor/skills/bmad-story-assistant/SKILL.zh.md',
  '_bmad/cursor/skills/bmad-story-assistant/SKILL.en.md',
  '_bmad/claude/skills/bmad-story-assistant/SKILL.md',
  '_bmad/claude/skills/bmad-story-assistant/SKILL.zh.md',
  '_bmad/claude/skills/bmad-story-assistant/SKILL.en.md',
  '_bmad/claude/agents/bmad-story-create.md',
  '_bmad/claude/agents/layers/bmad-bug-agent.md',
  '_bmad/claude/agents/layers/bmad-standalone-tasks.md',
  '_bmad/claude/agents/auditors/auditor-bugfix.md',
] as const;

const CANONICAL_WORKFLOW_FILES = [
  '_bmad/cursor/agents/party-mode-facilitator.md',
  '_bmad/cursor/agents/party-mode-facilitator.zh.md',
  '_bmad/cursor/agents/party-mode-facilitator.en.md',
  '_bmad/claude/agents/party-mode-facilitator.md',
  '_bmad/claude/agents/party-mode-facilitator.zh.md',
  '_bmad/claude/agents/party-mode-facilitator.en.md',
  '_bmad/cursor/skills/bmad-rca-helper/SKILL.md',
  '_bmad/cursor/skills/bmad-rca-helper/SKILL.zh.md',
  '_bmad/cursor/skills/bmad-rca-helper/SKILL.en.md',
  '_bmad/claude/skills/bmad-rca-helper/SKILL.md',
  '_bmad/claude/skills/bmad-rca-helper/SKILL.zh.md',
  '_bmad/claude/skills/bmad-rca-helper/SKILL.en.md',
  '_bmad/cursor/rules/bmad-bug-auto-party-mode.mdc',
  '_bmad/claude/rules/bmad-bug-auto-party-mode.md',
  '_bmad/cursor/rules/bmad-story-assistant.mdc',
  '_bmad/claude/rules/bmad-story-assistant.md',
  '_bmad/cursor/skills/speckit-workflow/SKILL.md',
  '_bmad/cursor/skills/speckit-workflow/SKILL.zh.md',
  '_bmad/cursor/skills/speckit-workflow/SKILL.en.md',
  '_bmad/claude/skills/speckit-workflow/SKILL.md',
  '_bmad/claude/skills/speckit-workflow/SKILL.zh.md',
  '_bmad/claude/skills/speckit-workflow/SKILL.en.md',
  '_bmad/cursor/skills/bmad-bug-assistant/SKILL.md',
  '_bmad/cursor/skills/bmad-bug-assistant/SKILL.zh.md',
  '_bmad/cursor/skills/bmad-bug-assistant/SKILL.en.md',
  '_bmad/claude/skills/bmad-bug-assistant/SKILL.md',
  '_bmad/claude/skills/bmad-bug-assistant/SKILL.zh.md',
  '_bmad/claude/skills/bmad-bug-assistant/SKILL.en.md',
  '_bmad/cursor/skills/bmad-story-assistant/SKILL.md',
  '_bmad/cursor/skills/bmad-story-assistant/SKILL.zh.md',
  '_bmad/cursor/skills/bmad-story-assistant/SKILL.en.md',
  '_bmad/claude/skills/bmad-story-assistant/SKILL.md',
  '_bmad/claude/skills/bmad-story-assistant/SKILL.zh.md',
  '_bmad/claude/skills/bmad-story-assistant/SKILL.en.md',
  '_bmad/claude/agents/bmad-story-create.md',
  '_bmad/claude/agents/layers/bmad-bug-agent.md',
  '_bmad/claude/agents/layers/bmad-standalone-tasks.md',
  '_bmad/claude/agents/auditors/auditor-bugfix.md',
] as const;

describe('party-mode downstream parity', () => {
  it('critical downstream consumers declare core step-02 as the source of truth', () => {
    for (const relativePath of SOURCE_OF_TRUTH_FILES) {
      const content = fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
      expect(content).toContain(SOURCE_OF_TRUTH_PATH);
    }
  });

  it('critical downstream consumers no longer bind party-mode workflow semantics to core/workflows mirrors', () => {
    for (const relativePath of CANONICAL_WORKFLOW_FILES) {
      const content = fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
      expect(content).not.toContain('{project-root}/_bmad/core/workflows/party-mode/workflow.md');
      expect(content).not.toContain(
        '{project-root}/_bmad/core/workflows/party-mode/steps/step-02-discussion-orchestration.md'
      );
    }
  });
});
