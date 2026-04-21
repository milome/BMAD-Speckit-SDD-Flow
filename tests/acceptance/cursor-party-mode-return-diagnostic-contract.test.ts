import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();

const DIAGNOSTIC_CONTRACT_FILES = [
  path.join(ROOT, '_bmad', 'cursor', 'skills', 'bmad-bug-assistant', 'SKILL.zh.md'),
  path.join(ROOT, '_bmad', 'cursor', 'skills', 'bmad-story-assistant', 'SKILL.zh.md'),
  path.join(ROOT, '_bmad', 'cursor', 'rules', 'bmad-bug-auto-party-mode-rule.mdc'),
  path.join(ROOT, '_bmad', 'cursor', 'rules', 'bmad-bug-assistant.mdc'),
  path.join(ROOT, '_bmad', 'cursor', 'rules', 'bmad-story-assistant.mdc'),
  path.join(ROOT, '.cursor', 'skills', 'bmad-bug-assistant', 'SKILL.zh.md'),
  path.join(ROOT, '.cursor', 'skills', 'bmad-story-assistant', 'SKILL.zh.md'),
  path.join(ROOT, '.cursor', 'rules', 'bmad-bug-auto-party-mode-rule.mdc'),
  path.join(ROOT, '.cursor', 'rules', 'bmad-bug-assistant.mdc'),
  path.join(ROOT, '.cursor', 'rules', 'bmad-story-assistant.mdc'),
];

const FORBIDDEN_PROBES = [
  'session file missing',
  'ls -la',
  'mkdir -p',
  'No terminals folder',
  'agent-transcripts',
  'terminals/',
  '2>&null',
];

function extractDiagnosticSection(content: string): string {
  const anchors = [
    'Party-Mode 返回合法性检查',
    'party-mode 返回合法性检查',
    'Cursor-only return validation',
    'Cursor party-mode return validation',
    'Party-Mode 返回检查',
    'current-session.json',
  ];
  const start = anchors
    .map((anchor) => content.indexOf(anchor))
    .filter((index) => index >= 0)
    .sort((left, right) => left - right)[0];
  if (start === undefined) {
    return content;
  }
  return content.slice(start, start + 1600);
}

describe('cursor party-mode return diagnostic contract', () => {
  it('requires main-agent return diagnostics to start from current-session.json, execution_evidence_level, and visible_output_summary', () => {
    for (const filePath of DIAGNOSTIC_CONTRACT_FILES) {
      const fullContent = fs.readFileSync(filePath, 'utf8');
      const content = extractDiagnosticSection(fullContent);

      expect(content).toContain('current-session.json');
      expect(content).toContain('execution_evidence_level');
      expect(content).toContain('visible_output_summary');
      expect(content).toContain('diagnostic_classification');
      expect(fullContent).toContain('party-mode-read-current-session.cjs');
      expect(fullContent).toMatch(/none\|pending\|partial\|final|none \/ pending \/ partial \/ final|none、pending、partial、final/iu);

      const currentSessionIndex = content.indexOf('current-session.json');
      const evidenceLevelIndex = content.indexOf('execution_evidence_level');
      const visibleSummaryIndex = content.indexOf('visible_output_summary');
      expect(currentSessionIndex).toBeGreaterThanOrEqual(0);
      expect(evidenceLevelIndex).toBeGreaterThan(currentSessionIndex);
      expect(visibleSummaryIndex).toBeGreaterThan(evidenceLevelIndex);

      const sessionLogIndex = content.indexOf('session log');
      if (sessionLogIndex >= 0) {
        expect(sessionLogIndex).toBeGreaterThan(visibleSummaryIndex);
      }

      const toolResultIndex = content.indexOf('tool-result.md');
      if (toolResultIndex >= 0) {
        expect(toolResultIndex).toBeGreaterThan(visibleSummaryIndex);
      }
    }
  });

  it('forbids shell-probe diagnosis patterns in main-agent return-diagnostic contracts', () => {
    for (const filePath of DIAGNOSTIC_CONTRACT_FILES) {
      const content = extractDiagnosticSection(fs.readFileSync(filePath, 'utf8'));

      for (const forbidden of FORBIDDEN_PROBES) {
        if (content.includes(forbidden)) {
          expect(content).toMatch(/禁止|Do not|forbidden|不得/iu);
        }
      }

      if (/\bdir\s+.*\/b/iu.test(content)) {
        expect(content).toMatch(/禁止|Do not|forbidden|不得/iu);
      }
      if (content.includes('2>/dev/null')) {
        expect(content).toMatch(/禁止|Do not|forbidden|不得/iu);
      }
    }
  });

  it('requires the current-session helper to be invoked as a standalone command, never a shell fallback chain', () => {
    for (const filePath of DIAGNOSTIC_CONTRACT_FILES) {
      const fullContent = fs.readFileSync(filePath, 'utf8');
      const content = extractDiagnosticSection(fullContent);

      expect(fullContent).toContain(
        'node .cursor/hooks/party-mode-read-current-session.cjs --project-root "{project-root}"'
      );
      expect(fullContent).toMatch(/单独运行|单独执行|standalone command|single command|separately/iu);
      expect(fullContent).not.toMatch(/party-mode-read-current-session\.cjs[^\n`]*\|\|/iu);
      expect(fullContent).not.toMatch(/party-mode-read-current-session\.cjs[^\n`]*2>&null/iu);
      expect(fullContent).not.toMatch(/party-mode-read-current-session\.cjs[^\n`]*2>\/dev\/null/iu);
      expect(content).toContain('current-session.json');
    }
  });

  it('forbids main-agent return diagnostics from collapsing degenerate output and stub-only output into a generic Task-tool incapability claim', () => {
    for (const filePath of DIAGNOSTIC_CONTRACT_FILES) {
      const fullContent = fs.readFileSync(filePath, 'utf8');
      expect(fullContent).toContain('degenerate_placeholder_completion');
      expect(fullContent).toContain('stub_only_completion');
      expect(fullContent).toMatch(/不得|禁止|Do not|forbidden/iu);
    }
  });

  it('requires main-agent diagnostics to treat recovered newer launches as active current runs instead of drifting to older completed sessions', () => {
    for (const filePath of DIAGNOSTIC_CONTRACT_FILES) {
      const fullContent = fs.readFileSync(filePath, 'utf8');
      expect(fullContent).toContain('recovered_from_newer_launch');
      expect(fullContent).toContain('pending_launch_evidence_present');
      expect(fullContent).toMatch(/不得|禁止|Do not|forbidden/iu);
    }
  });

  it('documents the RCA for why earlier party-mode runs looked more stable without allowing generic blame-shifting', () => {
    for (const filePath of DIAGNOSTIC_CONTRACT_FILES) {
      const fullContent = fs.readFileSync(filePath, 'utf8');
      expect(fullContent).toMatch(/为什么以前看起来更稳定|以前.?看起来更稳定/iu);
      expect(fullContent).toMatch(/旧问题.*显性|旧问题.*暴露|隐性变显性|旧问题.*被吞掉|旧问题.*被看见|旧问题.*被显式分类/iu);
      expect(fullContent).toMatch(/新.*回归|同步回归风险|状态同步风险|新回归引入/iu);
      expect(fullContent).toMatch(/(禁止|不得).*(全局无法处理|全局不稳定|整体坏了)/iu);
    }
  });
});
