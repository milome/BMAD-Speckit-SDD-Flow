import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..', '..');

describe('Deferred Gap Dev Story contract', () => {
  it('requires Claude Dev Story flow to validate register and journey artifacts before implementation', () => {
    const content = readFileSync(
      join(ROOT, '_bmad', 'claude', 'skills', 'bmad-story-assistant', 'SKILL.md'),
      'utf8'
    );

    expect(content).toContain('读取并验证 `deferred-gap-register.yaml`');
    expect(content).toContain('读取并验证 `journey-ledger`、`trace-map`、`closure-notes`');
    expect(content).toContain('active deferred gap 但无 task binding、Smoke Task Chain、Closure Task ID 或 production path 映射');
  });

  it('requires Claude post-audit to inspect runnable journey evidence and deferred gap closure state', () => {
    const content = readFileSync(
      join(ROOT, '_bmad', 'claude', 'skills', 'bmad-story-assistant', 'SKILL.md'),
      'utf8'
    );

    expect(content).toContain('closure / carry-forward evidence');
    expect(content).toContain('Production Path');
    expect(content).toContain('Smoke Proof');
    expect(content).toContain('Acceptance Evidence');
    expect(content).toContain('module complete but journey not runnable');
  });

  it('requires Cursor Dev Story flow to validate register and journey artifacts before implementation', () => {
    const content = readFileSync(
      join(ROOT, '_bmad', 'cursor', 'skills', 'bmad-story-assistant', 'SKILL.md'),
      'utf8'
    );

    expect(content).toContain('验证 `deferred-gap-register.yaml` 已存在且可读');
    expect(content).toContain('优先检查独立工件: `journey-ledger`、`trace-map`、`closure-notes/`');
    expect(content).toContain('active deferred gap 但无 Smoke Task Chain、Closure Task ID 或 production path 映射');
  });

  it('keeps Create Story bypass warning explicit in workflow instructions', () => {
    const content = readFileSync(
      join(ROOT, '_bmad', 'bmm', 'workflows', '4-implementation', 'create-story', 'instructions.xml'),
      'utf8'
    );

    expect(content).toContain('该绕过仅放行 Create Story');
    expect(content).toContain('deferred-gap-register');
    expect(content).toContain('journey-ledger');
    expect(content).toContain('trace-map');
    expect(content).toContain('closure-notes');
  });
});
