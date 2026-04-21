import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('implement drift prompt i18n contract', () => {
  const files = [
    '_bmad/claude/skills/speckit-workflow/references/audit-prompts-code.en.md',
    '_bmad/cursor/skills/speckit-workflow/references/audit-prompts-code.en.md',
    '_bmad/claude/skills/speckit-workflow/references/audit-prompts.en.md',
    '_bmad/cursor/skills/speckit-workflow/references/audit-prompts.en.md',
  ];

  it.each(files)('%s contains the structured drift signal block contract', (relativePath) => {
    const content = readFileSync(path.join(process.cwd(), relativePath), 'utf8');

    expect(content).toContain('Structured Drift Signal Block');
    expect(content).toContain('smoke_task_chain');
    expect(content).toContain('closure_task_id');
    expect(content).toContain('journey_unlock');
    expect(content).toContain('gap_split_contract');
    expect(content).toContain('shared_path_reference');
  });
});
