import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/** EN Claude adapters may cite "Cursor Task" inside markdown table rows (Cursor↔Claude executor parity). Strip those lines for platform-isolation checks. */
function proseWithoutCursorParityTableRows(s: string): string {
  return s
    .split(/\r?\n/)
    .filter((line) => !(line.includes('|') && line.includes('Cursor Task')))
    .join('\n');
}

describe('T3: Claude adapted speckit-workflow skill', () => {
  const skillPath = '.claude/skills/speckit-workflow/SKILL.md';
  const refsDir = '.claude/skills/speckit-workflow/references';
  const cursorRefsDir = '.cursor/skills/speckit-workflow/references';

  it('SKILL.md exists at .claude/skills/speckit-workflow/', () => {
    expect(existsSync(skillPath)).toBe(true);
  });

  it('references/ directory exists with required audit files', () => {
    expect(existsSync(refsDir)).toBe(true);
    expect(existsSync(`${refsDir}/audit-prompts.md`)).toBe(true);
    expect(existsSync(`${refsDir}/audit-post-impl-rules.md`)).toBe(true);
    expect(existsSync(`${refsDir}/audit-document-iteration-rules.md`)).toBe(true);
    expect(existsSync(`${refsDir}/audit-prompts-critical-auditor-appendix.md`)).toBe(true);
  });

  it('references/ file count matches Cursor version', () => {
    const claudeRefs = readdirSync(refsDir);
    const cursorRefs = readdirSync(cursorRefsDir);
    expect(claudeRefs.length).toBe(cursorRefs.length);
  });

  it('contains no Cursor-specific keywords (platform isolation)', () => {
    const content = readFileSync(skillPath, 'utf8');
    expect(content).not.toMatch(/\bmcp_task\b/);
    expect(content).not.toMatch(/Cursor Task/);
    expect(content).not.toMatch(/\.cursor\/rules\//);
  });

  it('uses Claude-native execution keywords', () => {
    const content = readFileSync(skillPath, 'utf8');
    expect(content).toContain('subagent_type');
    expect(content).toContain('.claude/agents/');
  });

  it('has ADAPTATION_COMPLETE marker', () => {
    const content = readFileSync(skillPath, 'utf8');
    expect(content).toMatch(/ADAPTATION_COMPLETE/);
  });

  it('follows three-layer architecture pattern', () => {
    const content = readFileSync(skillPath, 'utf8');
    expect(content).toContain('Cursor Canonical Base');
    expect(content).toContain('Runtime Adapter');
    expect(content).toContain('Fallback Strategy');
  });

  it('maps each speckit stage to correct auditor agent', () => {
    const content = readFileSync(skillPath, 'utf8');
    expect(content).toContain('auditor-spec');
    expect(content).toContain('auditor-plan');
    expect(content).toContain('auditor-tasks');
    expect(content).toContain('auditor-implement');
  });

  it('includes Fallback degradation notification (FR26)', () => {
    const content = readFileSync(skillPath, 'utf8');
    expect(content).toMatch(/Fallback.*降级|降级.*通知|执行体层级/);
  });

  it('preserves TDD and ralph-method constraints (FR15a)', () => {
    const content = readFileSync(skillPath, 'utf8');
    expect(content).toContain('TDD');
    expect(content).toMatch(/红灯|红绿灯|RED.*GREEN/i);
    expect(content).toContain('ralph-method');
    expect(content).toContain('prd');
    expect(content).toContain('progress');
  });

  it('includes CLI Calling Summary fields (Architecture D2)', () => {
    const content = readFileSync(skillPath, 'utf8');
    expect(content).toContain('CLI Calling Summary');
    expect(content).toContain('execution_summary');
  });

  it('includes YAML Handoff (Architecture D2)', () => {
    const content = readFileSync(skillPath, 'utf8');
    expect(content).toMatch(/YAML\s*Handoff/i);
    expect(content).toContain('next_steps');
  });

  it('.claude/agents/ references point to .claude/skills/speckit-workflow/ not .cursor/', () => {
    const agentFiles = [
      '.claude/agents/auditors/auditor-spec.md',
      '.claude/agents/auditors/auditor-plan.md',
      '.claude/agents/auditors/auditor-gaps.md',
      '.claude/agents/auditors/auditor-tasks.md',
      '.claude/agents/auditors/auditor-implement.md',
      '.claude/agents/auditors/auditor-document.md',
      '.claude/agents/layers/bmad-layer4-speckit-specify.md',
      '.claude/agents/layers/bmad-layer4-speckit-plan.md',
      '.claude/agents/layers/bmad-layer4-speckit-gaps.md',
      '.claude/agents/layers/bmad-layer4-speckit-tasks.md',
      '.claude/agents/layers/bmad-layer4-speckit-implement.md',
      '.claude/agents/speckit-implement.md',
    ];
    for (const agentFile of agentFiles) {
      if (!existsSync(agentFile)) continue;
      const agentContent = readFileSync(agentFile, 'utf8');
      const cursorRefs = agentContent.match(/\.cursor\/skills\/speckit-workflow/g) || [];
      expect(cursorRefs.length).toBe(0);
    }
  });
});

describe('T4: Claude adapted bmad-code-reviewer-lifecycle skill', () => {
  const skillPath = '.claude/skills/bmad-code-reviewer-lifecycle/SKILL.md';

  it('SKILL.md exists at .claude/skills/bmad-code-reviewer-lifecycle/', () => {
    expect(existsSync(skillPath)).toBe(true);
  });

  it('contains no Cursor-specific keywords (platform isolation)', () => {
    const content = readFileSync(skillPath, 'utf8');
    expect(content).not.toMatch(/\bmcp_task\b/);
    expect(content).not.toMatch(/Cursor Task/);
    expect(content).not.toMatch(/\.cursor\/rules\//);
  });

  it('uses Claude-native execution keywords', () => {
    const content = readFileSync(skillPath, 'utf8');
    expect(content).toContain('subagent_type');
    expect(content).toContain('.claude/agents/');
  });

  it('has ADAPTATION_COMPLETE marker', () => {
    const content = readFileSync(skillPath, 'utf8');
    expect(content).toMatch(/ADAPTATION_COMPLETE/);
  });

  it('follows three-layer architecture pattern', () => {
    const content = readFileSync(skillPath, 'utf8');
    expect(content).toMatch(/Cursor\s+[Cc]anonical\s+[Bb]ase/);
    expect(content).toMatch(/[Rr]untime\s+[Aa]dapter/);
    expect(content).toMatch(/Fallback\s+[Ss]trategy|Fallback\s+notice/i);
  });

  it('maps each stage to correct auditor agent', () => {
    const content = readFileSync(skillPath, 'utf8');
    expect(content).toContain('auditor-spec');
    expect(content).toContain('auditor-plan');
    expect(content).toContain('auditor-tasks');
    expect(content).toContain('auditor-implement');
    expect(content).toContain('auditor-bugfix');
    expect(content).toContain('auditor-document');
  });

  it('includes Fallback degradation notification (FR26)', () => {
    const content = readFileSync(skillPath, 'utf8');
    expect(content).toMatch(
      /Fallback.*降级|降级.*通知|执行体层级|Fallback\s+notice|audit\s+executor\s+level|Executor\s+downgrade/i
    );
  });

  it('includes CLI Calling Summary fields (Architecture D2)', () => {
    const content = readFileSync(skillPath, 'utf8');
    expect(content).toContain('CLI Calling Summary');
    expect(content).toContain('execution_summary');
  });

  it('includes YAML Handoff (Architecture D2)', () => {
    const content = readFileSync(skillPath, 'utf8');
    expect(content).toMatch(/YAML\s*Handoff/i);
    expect(content).toContain('next_steps');
  });

  it('preserves unified host runner scoring pipeline references', () => {
    const content = readFileSync(skillPath, 'utf8');
    expect(content).toContain('runAuditorHost');
    expect(content).toContain('code-reviewer-config.yaml');
    expect(content).toContain('stage-mapping.yaml');
    expect(content).toContain('eval-lifecycle-report-paths.yaml');
  });

  it('preserves lifecycle phases', () => {
    const content = readFileSync(skillPath, 'utf8');
    expect(content).toMatch(/Pre-?[Aa]udit/);
    expect(content).toMatch(/Audit\s+execution/i);
    expect(content).toMatch(/Report\s+generation/i);
    expect(content).toMatch(/Host\s+trigger/i);
    expect(content).toMatch(/Iteration\s+tracking/i);
    expect(content).toMatch(/Convergence\s+check/i);
  });

  it('.claude/agents/ references point to .claude/skills/bmad-code-reviewer-lifecycle/ not .cursor/', () => {
    const agentFile = '.claude/agents/layers/bmad-code-reviewer-lifecycle.md';
    if (existsSync(agentFile)) {
      const agentContent = readFileSync(agentFile, 'utf8');
      const cursorRefs =
        agentContent.match(/\.cursor\/skills\/bmad-code-reviewer-lifecycle/g) || [];
      expect(cursorRefs.length).toBe(0);
    }
  });

  it('references self path as .claude/skills/bmad-code-reviewer-lifecycle/', () => {
    const content = readFileSync(skillPath, 'utf8');
    expect(content).toContain('.claude/skills/bmad-code-reviewer-lifecycle/');
  });
});

describe('T5: Claude adapted bmad-bug-assistant skill', () => {
  const skillPath = '.claude/skills/bmad-bug-assistant/SKILL.md';
  const refsDir = '.claude/skills/bmad-bug-assistant/references';
  const cursorRefsDir = '.cursor/skills/bmad-bug-assistant/references';

  it('SKILL.md exists at .claude/skills/bmad-bug-assistant/', () => {
    expect(existsSync(skillPath)).toBe(true);
  });

  it('references/ directory exists with audit-prompts-section5.md', () => {
    expect(existsSync(refsDir)).toBe(true);
    expect(existsSync(`${refsDir}/audit-prompts-section5.md`)).toBe(true);
  });

  it('references/ file count matches Cursor version', () => {
    const claudeRefs = readdirSync(refsDir);
    const cursorRefs = readdirSync(cursorRefsDir);
    expect(claudeRefs.length).toBe(cursorRefs.length);
  });

  it('contains no Cursor-specific keywords (platform isolation)', () => {
    const content = readFileSync(skillPath, 'utf8');
    expect(content).not.toMatch(/\bmcp_task\b/);
    expect(content).not.toMatch(/Cursor Task/);
    expect(content).not.toMatch(/\.cursor\/rules\//);
  });

  it('uses Claude-native execution keywords', () => {
    const content = readFileSync(skillPath, 'utf8');
    expect(content).toContain('subagent_type');
    expect(content).toContain('.claude/agents/');
  });

  it('has ADAPTATION_COMPLETE marker', () => {
    const content = readFileSync(skillPath, 'utf8');
    expect(content).toMatch(/ADAPTATION_COMPLETE/);
  });

  it('follows three-layer architecture pattern', () => {
    const content = readFileSync(skillPath, 'utf8');
    expect(content).toMatch(/Cursor\s+[Cc]anonical\s+[Bb]ase/);
    expect(content).toMatch(/[Rr]untime\s+[Aa]dapter/);
    expect(content).toMatch(/Fallback\s+[Ss]trategy|Fallback\s+notice/i);
  });

  it('maps bugfix auditing to correct auditor agent', () => {
    const content = readFileSync(skillPath, 'utf8');
    expect(content).toContain('auditor-bugfix');
  });

  it('includes Fallback degradation notification (FR26)', () => {
    const content = readFileSync(skillPath, 'utf8');
    expect(content).toMatch(
      /Fallback.*降级|降级.*通知|执行体层级|Fallback\s+notice|audit\s+executor\s+level|Executor\s+downgrade/i
    );
  });

  it('preserves FR20a: main Agent cannot edit production code', () => {
    const content = readFileSync(skillPath, 'utf8');
    expect(content).toMatch(
      /主\s*Agent\s*禁止.*直接.*生产代码|禁止直接.*改.*生产代码|prohibited\s+from\s+directly\s+modifying\s+the\s+production\s+code|must\s+not\s+edit\s+production\s+code|must\s+not\s+use\s+`search_replace`/i
    );
  });

  it('preserves all 7 prompt template IDs', () => {
    const content = readFileSync(skillPath, 'utf8');
    expect(content).toContain('BUG-A1-ROOT');
    expect(content).toContain('BUG-A1-AUDIT');
    expect(content).toContain('BUG-A2-UPDATE');
    expect(content).toContain('BUG-A3-TASKS');
    expect(content).toContain('BUG-A3-AUDIT');
    expect(content).toContain('BUG-A4-IMPL');
    expect(content).toContain('BUG-A4-POSTAUDIT');
  });

  it('includes CLI Calling Summary fields (Architecture D2)', () => {
    const content = readFileSync(skillPath, 'utf8');
    expect(content).toContain('CLI Calling Summary');
    expect(content).toContain('execution_summary');
  });

  it('includes YAML Handoff (Architecture D2)', () => {
    const content = readFileSync(skillPath, 'utf8');
    expect(content).toMatch(/YAML\s*Handoff/i);
    expect(content).toContain('next_steps');
  });

  it('.claude/agents/ references point to .claude/skills/ not .cursor/skills/bmad-bug-assistant', () => {
    const agentFiles = [
      '.claude/agents/layers/bmad-bug-agent.md',
      '.claude/agents/auditors/auditor-bugfix.md',
    ];
    for (const agentFile of agentFiles) {
      if (!existsSync(agentFile)) continue;
      const agentContent = readFileSync(agentFile, 'utf8');
      const cursorRefs = agentContent.match(/\.cursor\/skills\/bmad-bug-assistant/g) || [];
      expect(cursorRefs.length).toBe(0);
    }
  });
});

describe('T6: Claude adapted bmad-standalone-tasks skill', () => {
  const skillPath = '.claude/skills/bmad-standalone-tasks/SKILL.md';
  const refsDir = '.claude/skills/bmad-standalone-tasks/references';
  const cursorRefsDir = '.cursor/skills/bmad-standalone-tasks/references';

  it('SKILL.md exists at .claude/skills/bmad-standalone-tasks/', () => {
    expect(existsSync(skillPath)).toBe(true);
  });

  it('references/ directory exists with prompt-templates.md', () => {
    expect(existsSync(refsDir)).toBe(true);
    expect(existsSync(`${refsDir}/prompt-templates.md`)).toBe(true);
  });

  it('references/ file count matches Cursor version', () => {
    const claudeRefs = readdirSync(refsDir);
    const cursorRefs = readdirSync(cursorRefsDir);
    expect(claudeRefs.length).toBe(cursorRefs.length);
  });

  it('contains no Cursor-specific keywords (platform isolation)', () => {
    const content = readFileSync(skillPath, 'utf8');
    expect(content).not.toMatch(/\bmcp_task\b/);
    expect(content).not.toMatch(/Cursor Task/);
    expect(content).not.toMatch(/\.cursor\/rules\//);
  });

  it('uses Claude-native execution keywords', () => {
    const content = readFileSync(skillPath, 'utf8');
    expect(content).toContain('subagent_type');
    expect(content).toContain('.claude/agents/');
  });

  it('has ADAPTATION_COMPLETE marker', () => {
    const content = readFileSync(skillPath, 'utf8');
    expect(content).toMatch(/ADAPTATION_COMPLETE/);
  });

  it('follows three-layer architecture pattern', () => {
    const content = readFileSync(skillPath, 'utf8');
    expect(content).toMatch(/Cursor\s+[Cc]anonical\s+[Bb]ase/);
    expect(content).toMatch(/[Rr]untime\s+[Aa]dapter/);
    expect(content).toMatch(/Fallback\s+[Ss]trategy|Fallback\s+notice/i);
  });

  it('maps to correct auditor agents', () => {
    const content = readFileSync(skillPath, 'utf8');
    expect(content).toContain('auditor-tasks-doc');
    expect(content).toContain('auditor-implement');
  });

  it('includes Fallback degradation notification (FR26)', () => {
    const content = readFileSync(skillPath, 'utf8');
    expect(content).toMatch(
      /Fallback.*降级|降级.*通知|执行体层级|Fallback\s+notice|audit\s+executor\s+level|Executor\s+downgrade/i
    );
  });

  it('preserves FR20a: main Agent cannot edit production code', () => {
    const content = readFileSync(skillPath, 'utf8');
    expect(content).toMatch(
      /主\s*Agent\s*禁止.*直接.*生产代码|禁止直接.*改.*生产代码|禁止.*直接编辑生产代码|must\s+not\s+edit\s+production\s+code|must\s+not\s+use\s+`search_replace`/i
    );
  });

  it('preserves TDD and ralph-method constraints (FR15a)', () => {
    const content = readFileSync(skillPath, 'utf8');
    expect(content).toContain('TDD');
    expect(content).toMatch(/红灯|红绿灯|RED.*GREEN/i);
    expect(content).toContain('ralph-method');
    expect(content).toContain('prd');
    expect(content).toContain('progress');
    expect(content).toContain('prd.{stem}.json');
    expect(content).toContain('progress.{stem}.txt');
  });

  it('includes CLI Calling Summary fields (Architecture D2)', () => {
    const content = readFileSync(skillPath, 'utf8');
    expect(content).toContain('CLI Calling Summary');
    expect(content).toContain('execution_summary');
  });

  it('includes YAML Handoff (Architecture D2)', () => {
    const content = readFileSync(skillPath, 'utf8');
    expect(content).toMatch(/YAML\s*Handoff/i);
    expect(content).toContain('next_steps');
  });

  it('preserves prompt template completeness', () => {
    const content = readFileSync(skillPath, 'utf8');
    expect(content).toContain('DOC_PATH');
    expect(content).toContain('TASK_LIST');
    expect(content).toContain('批判审计员');
    expect(content).toContain('3 轮无 gap');
  });

  it('.claude/agents/ references point to .claude/skills/bmad-standalone-tasks/ not .cursor/', () => {
    const agentFile = '.claude/agents/layers/bmad-standalone-tasks.md';
    if (existsSync(agentFile)) {
      const agentContent = readFileSync(agentFile, 'utf8');
      const cursorRefs = agentContent.match(/\.cursor\/skills\/bmad-standalone-tasks\//g) || [];
      expect(cursorRefs.length).toBe(0);
    }
  });
});

describe('T7: Claude adapted bmad-standalone-tasks-doc-review skill', () => {
  const skillPath = '.claude/skills/bmad-standalone-tasks-doc-review/SKILL.md';
  const refsDir = '.claude/skills/bmad-standalone-tasks-doc-review/references';
  const cursorRefsDir = '.cursor/skills/bmad-standalone-tasks-doc-review/references';

  it('SKILL.md exists at .claude/skills/bmad-standalone-tasks-doc-review/', () => {
    expect(existsSync(skillPath)).toBe(true);
  });

  it('references/ directory exists with audit-prompt-tasks-doc.md and audit-prompt-impl.md', () => {
    expect(existsSync(refsDir)).toBe(true);
    expect(existsSync(`${refsDir}/audit-prompt-tasks-doc.md`)).toBe(true);
    expect(existsSync(`${refsDir}/audit-prompt-impl.md`)).toBe(true);
  });

  it('references/ file count matches Cursor version', () => {
    const claudeRefs = readdirSync(refsDir);
    const cursorRefs = readdirSync(cursorRefsDir);
    expect(claudeRefs.length).toBe(cursorRefs.length);
  });

  it('contains no Cursor-specific keywords (platform isolation)', () => {
    const content = readFileSync(skillPath, 'utf8');
    expect(content).not.toMatch(/\bmcp_task\b/);
    expect(proseWithoutCursorParityTableRows(content)).not.toMatch(/Cursor Task/);
    expect(content).not.toMatch(/\.cursor\/rules\//);
  });

  it('uses Claude-native execution keywords', () => {
    const content = readFileSync(skillPath, 'utf8');
    expect(content).toContain('subagent_type');
    expect(content).toContain('.claude/agents/');
  });

  it('has ADAPTATION_COMPLETE marker', () => {
    const content = readFileSync(skillPath, 'utf8');
    expect(content).toMatch(/ADAPTATION_COMPLETE/);
  });

  it('follows three-layer architecture pattern', () => {
    const content = readFileSync(skillPath, 'utf8');
    expect(content).toMatch(/Cursor\s+[Cc]anonical\s+[Bb]ase/);
    expect(content).toMatch(/[Rr]untime\s+[Aa]dapter/);
    expect(content).toMatch(/Fallback\s+[Ss]trategy|Fallback\s+notice/i);
  });

  it('maps to correct auditor agent', () => {
    const content = readFileSync(skillPath, 'utf8');
    expect(content).toContain('auditor-tasks-doc');
  });

  it('includes Fallback degradation notification (FR26)', () => {
    const content = readFileSync(skillPath, 'utf8');
    expect(content).toMatch(
      /Fallback.*降级|降级.*通知|执行体层级|Fallback\s+notice|audit\s+executor\s+level|Executor\s+downgrade/i
    );
  });

  it('preserves critical auditor >70% and 3-round convergence', () => {
    const content = readFileSync(skillPath, 'utf8');
    expect(content).toMatch(/批判审计员|批判性审计员|Critical\s+Auditor/i);
    expect(content).toContain('>70%');
    expect(content).toMatch(
      /3\s*轮无\s*gap|three\s+consecutive\s+rounds\s+with\s+no\s+new\s+gap|3\s+no-gap/i
    );
    expect(content).toMatch(/直接修改被审文档|edit\s+the\s+audited\s+document/i);
  });

  it('includes CLI Calling Summary fields (Architecture D2)', () => {
    const content = readFileSync(skillPath, 'utf8');
    expect(content).toContain('CLI Calling Summary');
    expect(content).toContain('execution_summary');
  });

  it('includes YAML Handoff (Architecture D2)', () => {
    const content = readFileSync(skillPath, 'utf8');
    expect(content).toMatch(/YAML\s*Handoff/i);
    expect(content).toContain('next_steps');
  });

  it('preserves scoring block and convergence workflow', () => {
    const content = readFileSync(skillPath, 'utf8');
    expect(content).toContain('可解析评分块');
    expect(content).toContain('parseAndWriteScore');
    expect(content).toContain('convergence');
  });

  it('.claude/agents/ references point to .claude/skills/bmad-standalone-tasks-doc-review/ not .cursor/', () => {
    const agentFile = '.claude/agents/auditors/auditor-tasks-doc.md';
    if (existsSync(agentFile)) {
      const agentContent = readFileSync(agentFile, 'utf8');
      const cursorRefs =
        agentContent.match(/\.cursor\/skills\/bmad-standalone-tasks-doc-review/g) || [];
      expect(cursorRefs.length).toBe(0);
    }
  });
});

describe('T8: Claude adapted bmad-rca-helper skill', () => {
  const skillPath = '.claude/skills/bmad-rca-helper/SKILL.md';
  const refsDir = '.claude/skills/bmad-rca-helper/references';
  const cursorRefsDir = '.cursor/skills/bmad-rca-helper/references';

  it('SKILL.md exists at .claude/skills/bmad-rca-helper/', () => {
    expect(existsSync(skillPath)).toBe(true);
  });

  it('references/ directory exists with audit-prompt-rca-tasks.md and audit-document-iteration-rules.md', () => {
    expect(existsSync(refsDir)).toBe(true);
    expect(existsSync(`${refsDir}/audit-prompt-rca-tasks.md`)).toBe(true);
    expect(existsSync(`${refsDir}/audit-document-iteration-rules.md`)).toBe(true);
  });

  it('references/ file count matches Cursor version', () => {
    const claudeRefs = readdirSync(refsDir);
    const cursorRefs = readdirSync(cursorRefsDir);
    expect(claudeRefs.length).toBe(cursorRefs.length);
  });

  it('contains no Cursor-specific keywords (platform isolation)', () => {
    const content = readFileSync(skillPath, 'utf8');
    expect(content).not.toMatch(/\bmcp_task\b/);
    expect(proseWithoutCursorParityTableRows(content)).not.toMatch(/Cursor Task/);
    expect(content).not.toMatch(/\.cursor\/rules\//);
  });

  it('uses Claude-native execution keywords', () => {
    const content = readFileSync(skillPath, 'utf8');
    expect(content).toContain('subagent_type');
    expect(content).toContain('.claude/agents/');
  });

  it('has ADAPTATION_COMPLETE marker', () => {
    const content = readFileSync(skillPath, 'utf8');
    expect(content).toMatch(/ADAPTATION_COMPLETE/);
  });

  it('follows three-layer architecture pattern', () => {
    const content = readFileSync(skillPath, 'utf8');
    expect(content).toMatch(/Cursor\s+[Cc]anonical\s+[Bb]ase/);
    expect(content).toMatch(/[Rr]untime\s+[Aa]dapter/);
    expect(content).toMatch(/Fallback\s+[Ss]trategy|Fallback\s+notice/i);
  });

  it('maps audit to correct auditor agent', () => {
    const content = readFileSync(skillPath, 'utf8');
    expect(content).toContain('auditor-document');
  });

  it('includes Fallback degradation notification (FR26)', () => {
    const content = readFileSync(skillPath, 'utf8');
    expect(content).toMatch(
      /Fallback.*降级|降级.*通知|执行体层级|Fallback\s+notice|audit\s+executor\s+level|Executor\s+downgrade/i
    );
  });

  it('preserves critical auditor >70% and 3-round convergence (FR23a)', () => {
    const content = readFileSync(skillPath, 'utf8');
    expect(content).toMatch(/批判审计员|批判性审计员|Critical\s+Auditor/i);
    expect(content).toContain('>70%');
    expect(content).toMatch(
      /3\s*轮无\s*gap|three\s+consecutive\s+rounds\s+with\s+no\s+new\s+gap|three\s+consecutive\s+no-gap/i
    );
    expect(content).toMatch(/直接修改被审文档|edit\s+the\s+audited\s+document/i);
  });

  it('preserves Party-Mode 100 round requirement', () => {
    const content = readFileSync(skillPath, 'utf8');
    expect(content).toMatch(/100\s*轮|至少\s*100\s*轮|at\s+least\s+100|100\s+rounds/i);
    expect(content).toContain('party-mode');
  });

  it('includes CLI Calling Summary fields (Architecture D2)', () => {
    const content = readFileSync(skillPath, 'utf8');
    expect(content).toContain('CLI Calling Summary');
    expect(content).toContain('execution_summary');
  });

  it('includes YAML Handoff (Architecture D2)', () => {
    const content = readFileSync(skillPath, 'utf8');
    expect(content).toMatch(/YAML\s*Handoff/i);
    expect(content).toContain('next_steps');
  });

  it('.claude/agents/ references point to .claude/skills/bmad-rca-helper/ not .cursor/', () => {
    const agentFiles = [
      '.claude/agents/layers/bmad-bug-agent.md',
      '.claude/agents/auditors/auditor-bugfix.md',
    ];
    for (const agentFile of agentFiles) {
      if (!existsSync(agentFile)) continue;
      const agentContent = readFileSync(agentFile, 'utf8');
      const cursorRefs = agentContent.match(/\.cursor\/skills\/bmad-rca-helper/g) || [];
      expect(cursorRefs.length).toBe(0);
    }
  });

  it('preserves forbidden words list', () => {
    const content = readFileSync(skillPath, 'utf8');
    expect(content).toMatch(/禁止词|Forbidden\s+wording/i);
    expect(content).toMatch(/可选/);
    expect(content).toMatch(/酌情/);
  });
});

describe('T9: Claude adapted using-git-worktrees skill', () => {
  const skillPath = '.claude/skills/using-git-worktrees/SKILL.md';

  it('SKILL.md exists at .claude/skills/using-git-worktrees/', () => {
    expect(existsSync(skillPath)).toBe(true);
  });

  it('contains no Cursor-specific keywords (platform isolation)', () => {
    const content = readFileSync(skillPath, 'utf8');
    expect(content).not.toMatch(/\bmcp_task\b/);
    expect(content).not.toMatch(/Cursor Task/);
    expect(content).not.toMatch(/\.cursor\/rules\//);
  });

  it('uses Claude-native execution keywords', () => {
    const content = readFileSync(skillPath, 'utf8');
    expect(content).toContain('subagent_type');
    expect(content).toContain('.claude/agents/');
  });

  it('has ADAPTATION_COMPLETE marker', () => {
    const content = readFileSync(skillPath, 'utf8');
    expect(content).toMatch(/ADAPTATION_COMPLETE/);
  });

  it('follows three-layer architecture pattern', () => {
    const content = readFileSync(skillPath, 'utf8');
    expect(content).toContain('Cursor Canonical Base');
    expect(content).toContain('Runtime Adapter');
    expect(content).toContain('Fallback Strategy');
  });

  it('includes Fallback degradation notification (FR26)', () => {
    const content = readFileSync(skillPath, 'utf8');
    expect(content).toMatch(/Fallback.*降级|降级.*通知|执行体层级/);
  });

  it('includes CLI Calling Summary fields (Architecture D2)', () => {
    const content = readFileSync(skillPath, 'utf8');
    expect(content).toContain('CLI Calling Summary');
    expect(content).toContain('execution_summary');
  });

  it('includes YAML Handoff (Architecture D2)', () => {
    const content = readFileSync(skillPath, 'utf8');
    expect(content).toMatch(/YAML\s*Handoff/i);
    expect(content).toContain('next_steps');
  });

  it('preserves core worktree creation logic', () => {
    const content = readFileSync(skillPath, 'utf8');
    expect(content).toContain('git worktree add');
    expect(content).toContain('repo_name');
    expect(content).toContain('worktree_base');
  });

  it('preserves adaptive worktree strategy (story-level vs epic-level)', () => {
    const content = readFileSync(skillPath, 'utf8');
    expect(content).toContain('story-level');
    expect(content).toContain('epic-level');
    expect(content).toContain('story_count');
  });

  it('preserves safety verification and baseline test checks', () => {
    const content = readFileSync(skillPath, 'utf8');
    expect(content).toContain('Safety Verification');
    expect(content).toContain('baseline');
  });

  it('preserves conflict resolution audit flow with Claude-native executor', () => {
    const content = readFileSync(skillPath, 'utf8');
    expect(content).toContain('冲突');
    expect(content).toContain('审计');
    expect(content).toMatch(/auditor|code-review/);
  });

  it('preserves serial/parallel mode switching', () => {
    const content = readFileSync(skillPath, 'utf8');
    expect(content).toContain('串行');
    expect(content).toContain('并行');
  });

  it('no .claude/agents/ files reference .cursor/skills/using-git-worktrees', () => {
    const agentsDir = '.claude/agents';
    if (!existsSync(agentsDir)) return;
    const checkDir = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const fullPath = `${dir}/${entry.name}`;
        if (entry.isDirectory()) {
          checkDir(fullPath);
        } else if (entry.name.endsWith('.md')) {
          const agentContent = readFileSync(fullPath, 'utf8');
          const cursorRefs = agentContent.match(/\.cursor\/skills\/using-git-worktrees/g) || [];
          expect(cursorRefs.length).toBe(0);
        }
      }
    };
    checkDir(agentsDir);
  });
});

describe('T10: CI verification script verify-skill-architecture.sh', () => {
  const scriptPath = 'scripts/verify-skill-architecture.sh';

  it('script exists at scripts/verify-skill-architecture.sh', () => {
    expect(existsSync(scriptPath)).toBe(true);
  });

  it('script is a valid bash script with shebang', () => {
    const content = readFileSync(scriptPath, 'utf8');
    expect(content).toMatch(/^#!/);
    expect(content).toMatch(/bash/);
  });

  it('checks directory counts using public + adapter skill totals, not legacy adapter-only totals', () => {
    const content = readFileSync(scriptPath, 'utf8');
    expect(content).toContain('PUBLIC_SKILLS');
    expect(content).toContain('CURSOR_SKILLS');
    expect(content).toContain('expected_cursor_total');
    expect(content).toContain('expected_claude_total');
    expect(content).not.toContain('.cursor/skills/=8');
    expect(content).not.toContain('.claude/skills/=8');
  });

  it('checks for bare reference residuals while supporting explicit exclusions', () => {
    const content = readFileSync(scriptPath, 'utf8');
    expect(content).toMatch(/bare|裸引用|裸.*引用/i);
    expect(content).toMatch(/grep -v|exclude/i);
  });

  it('checks backmigration residuals (.claude/ with .cursor/skills/ refs) while allowing only documented legacy exceptions', () => {
    const content = readFileSync(scriptPath, 'utf8');
    expect(content).toMatch(/backmigrat|回迁|residual|残留/i);
    expect(content).toMatch(/grep -v|exclude/i);
    expect(content).toContain('bmad-customization-backup');
  });

  it('checks platform keyword isolation', () => {
    const content = readFileSync(scriptPath, 'utf8');
    expect(content).toContain('mcp_task');
    expect(content).toContain('Cursor Task');
    expect(content).toContain('subagent_type');
  });

  it('checks ADAPTATION_COMPLETE markers', () => {
    const content = readFileSync(scriptPath, 'utf8');
    expect(content).toContain('ADAPTATION_COMPLETE');
  });

  it('checks template line ratio (>= 90%)', () => {
    const content = readFileSync(scriptPath, 'utf8');
    expect(content).toMatch(/90|line.*ratio|行数/i);
  });

  it('checks references directory sync', () => {
    const content = readFileSync(scriptPath, 'utf8');
    expect(content).toMatch(/references|refs.*sync|refs.*count/i);
  });

  it('outputs PASS/FAIL format', () => {
    const content = readFileSync(scriptPath, 'utf8');
    expect(content).toContain('[PASS]');
    expect(content).toContain('[FAIL]');
  });

  it('has summary output with total pass/fail counts', () => {
    const content = readFileSync(scriptPath, 'utf8');
    expect(content).toMatch(/RESULT|SUMMARY|汇总/i);
    expect(content).toMatch(/PASSED/);
    expect(content).toMatch(/FAILED/);
  });

  it('exits with code 0 on success and non-zero on failure', () => {
    const content = readFileSync(scriptPath, 'utf8');
    expect(content).toMatch(/exit\s+0/);
    expect(content).toMatch(/exit\s+1/);
  });
});

describe('T11: Claude adapted bmad-story-assistant skill', () => {
  const skillPath = '.claude/skills/bmad-story-assistant/SKILL.md';

  it('SKILL.md exists at .claude/skills/bmad-story-assistant/', () => {
    expect(existsSync(skillPath)).toBe(true);
  });

  it('contains no Cursor-specific keywords (platform isolation)', () => {
    const content = readFileSync(skillPath, 'utf8');
    expect(content).not.toMatch(/\bmcp_task\b/);
    expect(content).not.toMatch(/Cursor Task/);
    expect(content).not.toMatch(/\.cursor\/rules\//);
    expect(content).not.toMatch(/\bgeneralPurpose\b/);
    expect(content).not.toMatch(/detectEnvironment/);
    expect(content).not.toMatch(/getSubagentParams/);
  });

  it('uses Claude-native execution keywords', () => {
    const content = readFileSync(skillPath, 'utf8');
    expect(content).toContain('subagent_type');
    expect(content).toContain('.claude/agents/');
    expect(content).toContain('general-purpose');
  });

  it('has ADAPTATION_COMPLETE marker', () => {
    const content = readFileSync(skillPath, 'utf8');
    expect(content).toMatch(/ADAPTATION_COMPLETE/);
  });

  it('follows three-layer architecture pattern', () => {
    const content = readFileSync(skillPath, 'utf8');
    expect(content).toContain('Cursor Canonical Base');
    expect(content).toContain('Runtime Adapter');
    expect(content).toContain('Repo Add-ons');
  });

  it('includes Fallback Strategy and execution contracts', () => {
    const content = readFileSync(skillPath, 'utf8');
    expect(content).toContain('Fallback Strategy');
    expect(content).toContain('execution_summary');
  });

  it('includes handoff output with structured fields', () => {
    const content = readFileSync(skillPath, 'utf8');
    expect(content).toContain('handoff');
    expect(content).toContain('next_action');
  });
});

describe('T12: general-purpose subagent_type across all .claude/skills/', () => {
  const claudeSkillsDir = '.claude/skills';

  it('no SKILL.md under .claude/skills/ uses generalPurpose as subagent_type', () => {
    const skillDirs = readdirSync(claudeSkillsDir, { withFileTypes: true }).filter((d) =>
      d.isDirectory()
    );
    for (const dir of skillDirs) {
      const skillFile = `${claudeSkillsDir}/${dir.name}/SKILL.md`;
      if (!existsSync(skillFile)) continue;
      const content = readFileSync(skillFile, 'utf8');
      const matches = content.match(/\bgeneralPurpose\b/g) || [];
      expect(
        matches.length,
        `${skillFile} still contains ${matches.length} generalPurpose references`
      ).toBe(0);
    }
  });

  it('skills that use subagent_type specify general-purpose', () => {
    const skillDirs = readdirSync(claudeSkillsDir, { withFileTypes: true }).filter((d) =>
      d.isDirectory()
    );
    const skillsWithSubagent: string[] = [];
    for (const dir of skillDirs) {
      const skillFile = `${claudeSkillsDir}/${dir.name}/SKILL.md`;
      if (!existsSync(skillFile)) continue;
      const content = readFileSync(skillFile, 'utf8');
      if (content.includes('subagent_type')) {
        skillsWithSubagent.push(dir.name);
        expect(content).toContain('general-purpose');
      }
    }
    expect(skillsWithSubagent.length).toBeGreaterThan(0);
  });
});

describe('extension agents', () => {
  it('all agents follow protocol', () => {
    const standalone = readFileSync('.claude/agents/layers/bmad-standalone-tasks.md', 'utf8');
    const bugAgent = readFileSync('.claude/agents/layers/bmad-bug-agent.md', 'utf8');
    const reviewer = readFileSync('.claude/agents/layers/bmad-code-reviewer-lifecycle.md', 'utf8');

    for (const content of [standalone, bugAgent, reviewer]) {
      expect(content).toContain('bmad-progress.yaml');
      expect(content).toContain('audit-result-schema.md');
      expect(content).toContain('禁止自行 commit');
    }
  });

  it('requires standalone tasks and bug flows to match the final adaptation standard', () => {
    expect(existsSync('.claude/agents/auditors/auditor-tasks-doc.md')).toBe(true);
    expect(existsSync('.claude/agents/auditors/auditor-bugfix.md')).toBe(true);

    const standalone = readFileSync('.claude/agents/layers/bmad-standalone-tasks.md', 'utf8');
    const bugAgent = readFileSync('.claude/agents/layers/bmad-bug-agent.md', 'utf8');
    const reviewer = readFileSync('.claude/agents/layers/bmad-code-reviewer-lifecycle.md', 'utf8');
    const tasksDocAuditor = readFileSync('.claude/agents/auditors/auditor-tasks-doc.md', 'utf8');
    const bugfixAuditor = readFileSync('.claude/agents/auditors/auditor-bugfix.md', 'utf8');

    for (const content of [standalone, bugAgent]) {
      expect(content).toContain('Cursor Canonical Base');
      expect(content).toContain('Claude/OMC Runtime Adapter');
      expect(content).toContain('Repo Add-ons');
      expect(content).toContain('Primary Executor');
      expect(content).toContain('Fallback Strategy');
      expect(content).toContain('Runtime Contracts');
      expect(content).toContain('execution_summary');
      expect(content).toContain('handoff');
      expect(content).toContain('next_action');
      expect(content).toContain('ready');
    }

    expect(standalone).toContain('auditor-tasks-doc');
    expect(standalone).toContain('每批任务完成后进行实施审计');
    expect(standalone).toContain('Master 门控');
    expect(standalone).toContain('party-mode');
    expect(standalone).toMatch(/100\s*轮|至少\s*100\s*轮/);
    expect(standalone).toContain('完整复制 Cursor');
    expect(standalone).toContain('commit_request');
    expect(standalone).toContain('prd.{stem}.json');
    expect(standalone).toContain('progress.{stem}.txt');

    expect(bugAgent).toContain('根因分析');
    expect(bugAgent).toContain('BUGFIX');
    expect(bugAgent).toContain('auditor-bugfix');
    expect(bugAgent).toContain('先写复现测试');
    expect(bugAgent).toContain('实施后审计');
    expect(bugAgent).toContain('Master 门控');
    expect(bugAgent).toContain('party-mode');
    expect(bugAgent).toMatch(/100\s*轮|至少\s*100\s*轮/);
    expect(bugAgent).toContain('完整复制');
    expect(bugAgent).toContain('commit_request');

    expect(reviewer).toContain('Cursor Canonical Base');
    expect(reviewer).toContain('Claude/OMC Runtime Adapter');
    expect(reviewer).toContain('Repo Add-ons');
    expect(reviewer).toContain('Primary Executor');
    expect(reviewer).toContain('Fallback Strategy');
    expect(reviewer).toContain('Runtime Contracts');
    expect(reviewer).toContain('Pre-Audit');
    expect(reviewer).toContain('Audit Execution');
    expect(reviewer).toContain('Report Generation');
    expect(reviewer).toContain('Scoring Trigger');
    expect(reviewer).toContain('Iteration Tracking');
    expect(reviewer).toContain('Convergence Check');
    expect(reviewer).toContain('code-reviewer-config.yaml');
    expect(reviewer).toContain('stage-mapping.yaml');
    expect(reviewer).toContain('eval-lifecycle-report-paths.yaml');
    expect(reviewer).toContain('runAuditorHost');

    for (const content of [tasksDocAuditor, bugfixAuditor]) {
      expect(content).toContain('## 批判审计员结论');
      expect(content).toContain('>70%');
      expect(content).toContain('完全覆盖、验证通过');
      expect(content).toMatch(/3\s*轮无\s*gap|连续\s*3\s*轮无\s*gap/);
      expect(content).toContain('直接修改被审文档');
      expect(content).toContain('reportPath');
      expect(content).toContain('convergence_status');
    }
  });
});
