import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const SKILL_ROOT = join(ROOT, '_bmad', 'skills', 'goal-contract-partition-orchestrator');

describe('goal-contract-partition-orchestrator skill contract', () => {
  it('ships the canonical skill, partition protocol, and OpenAI interface metadata', () => {
    const skillPath = join(SKILL_ROOT, 'SKILL.md');
    const protocolPath = join(SKILL_ROOT, 'references', 'partition-protocol.md');
    const openAiPath = join(SKILL_ROOT, 'agents', 'openai.yaml');

    expect(existsSync(skillPath)).toBe(true);
    expect(existsSync(protocolPath)).toBe(true);
    expect(existsSync(openAiPath)).toBe(true);

    const skill = readFileSync(skillPath, 'utf8');
    const protocol = readFileSync(protocolPath, 'utf8');
    const openAi = readFileSync(openAiPath, 'utf8');

    expect(skill).toContain('name: goal-contract-partition-orchestrator');
    expect(skill).toContain('references/partition-protocol.md');
    expect(skill).toContain('blocked_by_frozen_successor_goal_contract');
    expect(skill).toContain('goal-contract-partition-manifest/v2');
    expect(skill).toContain('blocked_until_er_gh_004_runtime_implemented');
    expect(skill).not.toContain('goal-contract-partition-manifest/v3');
    expect(skill).toContain('Current package runtime output remains diagnostic-only');

    expect(protocol).toContain('freeze parent authority');
    expect(protocol).toContain('The current raw `--out` command is diagnostic compatibility only.');
    expect(protocol).toContain('legacy `contracts/`');

    expect(openAi).toContain('display_name: "Goal Contract Partition Orchestrator"');
    expect(openAi).toContain('$goal-contract-partition-orchestrator');
    expect(openAi).toContain('diagnostic child-contract candidates');

    const portableText = [skill, protocol, openAi].join('\n');
    expect(portableText).not.toMatch(/[A-Za-z]:[\\/]/u);
    expect(portableText).not.toMatch(/(?:^|\s)\\\\[^\\\s]/mu);
    expect(portableText).not.toContain('/Users/');
    expect(portableText).not.toContain('/home/');
  });
});
