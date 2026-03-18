import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('bmad-master auto-continue gate', () => {
  it('requires explicit auto-continue enablement before auto proceeding', () => {
    const masterAgent = readFileSync('.claude/agents/bmad-master.md', 'utf8');

    expect(masterAgent).toContain('auto_continue.enabled === true');
    expect(masterAgent).toContain('BMAD_AUTO_CONTINUE=true');
    expect(masterAgent).toContain('CLI `--continue`');
    expect(masterAgent).toContain('story_state.next_action 存在');
    expect(masterAgent).toContain('story_state.ready === true');
  });

  it('documents manual fallback when handoff is ready but continue is not enabled', () => {
    const masterAgent = readFileSync('.claude/agents/bmad-master.md', 'utf8');

    expect(masterAgent).toContain('不自动推进');
    expect(masterAgent).toContain('等待用户确认或显式用 `--continue` 重入');
    expect(masterAgent).toContain('suggested_command: "@bmad-master 继续 {epic}-{story} --continue"');
    expect(masterAgent).toContain('auto_proceed: false');
  });

  it('documents reason text for explicit auto-proceed semantics', () => {
    const masterAgent = readFileSync('.claude/agents/bmad-master.md', 'utf8');

    expect(masterAgent).toContain('reason: "auto_continue enabled 且 handoff.next_action={action} 且 ready=true"');
  });
});
