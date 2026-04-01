/**
 * Parity:
 * - §4.1: bmad-help legacy command paths documented in `docs/explanation/upstream-relationship.md`
 *   must appear under ### 4.1 (not only elsewhere in the doc).
 * - §4.4: Runtime Governance upstream paths documented in upstream-relationship.md
 *   appear in scripts/bmad-sync-from-v6.ps1 $EXCLUDE_PATTERNS and $BACKUP_ITEMS.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(import.meta.dirname, '..', '..');
const PS1 = readFileSync(join(ROOT, 'scripts/bmad-sync-from-v6.ps1'), 'utf8');
const DOC = readFileSync(join(ROOT, 'docs/explanation/upstream-relationship.md'), 'utf8');

/** Must appear in docs §4.1 table (bmad-help OFFICIAL vs legacy commands row). */
const BMAD_HELP_LEGACY_COMMAND_PATHS = [
  '_bmad/commands/bmad-bmm-dev-story.md',
  '_bmad/commands/bmad-bmm-quick-dev.md',
  '_bmad/commands/bmad-bmm-quick-spec.md',
  '_bmad/commands/bmad-agent-bmm-quick-flow-solo-dev.md',
] as const;

function getDocSection41Body(doc: string): string {
  const startMarker = '### 4.1 路径排除（永不覆盖）';
  const endMarker = '### 4.2';
  const start = doc.indexOf(startMarker);
  expect(start).toBeGreaterThan(-1);
  const end = doc.indexOf(endMarker, start + startMarker.length);
  expect(end).toBeGreaterThan(-1);
  return doc.slice(start, end);
}

/** Substrings that must appear in both EXCLUDE_PATTERNS block and BACKUP_ITEMS in the script */
const SCRIPT_PROTECTED = [
  '_bmad/bmm/workflows/4-implementation/sprint-planning',
  '_bmad/bmm/workflows/4-implementation/sprint-status',
  'step-04-final-validation.md',
  '_bmad/bmm/workflows/4-implementation/dev-story',
  '_bmad/claude/agents/bmad-story-audit',
  '_bmad/claude/skills/bmad-story-assistant',
  'sprint-planning-workflow',
  'sprint-status-workflow',
  'dev-story-workflow',
  'bmad-story-assistant-skill-claude',
  ...BMAD_HELP_LEGACY_COMMAND_PATHS,
];

describe('v6 sync script protects Runtime Governance upstream paths', () => {
  it('docs §4.1 table includes all four bmad-help legacy command paths', () => {
    const section41 = getDocSection41Body(DOC);
    for (const p of BMAD_HELP_LEGACY_COMMAND_PATHS) {
      expect(section41).toContain(p);
    }
  });

  it('docs §4.4 exists and lists protected paths', () => {
    expect(DOC).toContain('### 4.4');
    expect(DOC).toContain('Runtime Governance');
    expect(DOC).toContain('_bmad/bmm/workflows/4-implementation/sprint-planning/');
    expect(DOC).toContain('_bmad/claude/skills/bmad-story-assistant/');
  });

  it('bmad-sync-from-v6.ps1 contains EXCLUDE and BACKUP entries for each protected path', () => {
    const exStart = PS1.indexOf('$EXCLUDE_PATTERNS = @(');
    const exEnd = PS1.indexOf(')', exStart + 1);
    expect(exStart).toBeGreaterThan(-1);
    const excludeBlock = PS1.slice(exStart, exEnd + 1);
    const bakStart = PS1.indexOf('$BACKUP_ITEMS = @(');
    const bakEnd = PS1.indexOf(')', bakStart + 1);
    expect(bakStart).toBeGreaterThan(-1);
    const backupBlock = PS1.slice(bakStart, bakEnd + 1);
    for (const fragment of SCRIPT_PROTECTED) {
      expect(
        excludeBlock.includes(fragment) || backupBlock.includes(fragment),
        `missing in EXCLUDE or BACKUP: ${fragment}`
      ).toBe(true);
    }
  });
});
