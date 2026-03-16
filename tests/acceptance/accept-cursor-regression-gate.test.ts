import { readFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

describe('cursor regression gate', () => {
  it('documents cursor non-regression as a release gate', () => {
    const pkg = readFileSync('package.json', 'utf8');
    expect(pkg).toContain('test:cursor-regression');
  });

  it('ships both Cursor rule entrypoints', () => {
    expect(existsSync('.cursor/rules/bmad-story-assistant.mdc')).toBe(true);
    expect(existsSync('_bmad/cursor/rules/bmad-story-assistant.mdc')).toBe(true);
  });

  it('keeps mirrored Cursor rules identical', () => {
    const cursorRule = readFileSync('.cursor/rules/bmad-story-assistant.mdc', 'utf8');
    const mirrorRule = readFileSync('_bmad/cursor/rules/bmad-story-assistant.mdc', 'utf8');
    expect(cursorRule).toBe(mirrorRule);
  });

  it('exposes audit granularity support in Cursor rule docs', () => {
    const cursorRule = readFileSync('.cursor/rules/bmad-story-assistant.mdc', 'utf8');

    expect(cursorRule).toContain('--audit-granularity');
    expect(cursorRule).toContain('BMAD_AUDIT_GRANULARITY');
    expect(cursorRule).toContain('mcp_task');
    expect(cursorRule).toContain('generalPurpose');
    expect(cursorRule).toContain('full');
    expect(cursorRule).toContain('story');
    expect(cursorRule).toContain('epic');
    expect(cursorRule).toContain('basic');
    expect(cursorRule).toContain('test_only');
  });

  it('provides a dedicated Cursor audit granularity verification script', () => {
    expect(existsSync('scripts/verify-cursor-audit-granularity.ts')).toBe(true);

    const pkg = readFileSync('package.json', 'utf8');
    expect(pkg).toContain('verify:cursor-audit-granularity');
  });

  it('keeps Cursor guide and installation docs aligned with the rule contract', () => {
    const cursorGuide = readFileSync('docs/how-to/bmad-story-assistant.md', 'utf8');
    const guideIndex = readFileSync('docs/how-to/guide-index.md', 'utf8');
    const cursorGuideIndex = readFileSync('docs/how-to/cursor-setup.md', 'utf8');
    const installGuide = readFileSync('docs/how-to/migration.md', 'utf8');

    expect(guideIndex).toContain('bmad-story-assistant.md');
    expect(cursorGuideIndex).toContain('bmad-story-assistant.md');

    expect(cursorGuide).toContain('--audit-granularity');
    expect(cursorGuide).toContain('BMAD_AUDIT_GRANULARITY');
    expect(cursorGuide).toContain('mcp_task');
    expect(cursorGuide).toContain('generalPurpose');
    expect(cursorGuide).toContain('full');
    expect(cursorGuide).toContain('story');
    expect(cursorGuide).toContain('epic');

    expect(installGuide).toContain('Cursor');
    expect(installGuide).toContain('.cursor');

    // docs/design/ is gitignored; assertions run only when files exist on disk
    if (existsSync('docs/design/cross-platform-compatibility.md')) {
      const designDoc = readFileSync('docs/design/cross-platform-compatibility.md', 'utf8');
      expect(designDoc).toContain('Cursor 专项 guide 文档');
      expect(designDoc).toContain('Cursor 回归测试');
    }
    if (existsSync('docs/design/audit-granularity-config-design.md')) {
      const configDesign = readFileSync('docs/design/audit-granularity-config-design.md', 'utf8');
      expect(configDesign).toContain('Cursor 侧入口规则与专项使用文档');
      expect(configDesign).toContain('Cursor 回归测试升级为行为断言');
    }
  });
});
