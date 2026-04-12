import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  getAuditPromptLocaleFromRuntimeContext,
  resolveAuditPromptPath,
} from '../../scripts/i18n/resolve-audit-prompt-path';
import { resolveLocalizedMarkdownPath } from '../../scripts/i18n/resolve-localized-markdown-path';

describe('resolveAuditPromptPath', () => {
  let tmp: string;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-prompt-'));
    fs.writeFileSync(path.join(tmp, 'audit-prompts-code.md'), '# default zh');
    fs.writeFileSync(path.join(tmp, 'audit-prompts-code.zh.md'), '# zh explicit');
    fs.writeFileSync(path.join(tmp, 'audit-prompts-code.en.md'), '# en');
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('locale en prefers .en.md', () => {
    const r = resolveAuditPromptPath(tmp, 'audit-prompts-code.md', 'en');
    expect(r.resolvedPath).toBe(path.join(tmp, 'audit-prompts-code.en.md'));
    expect(r.usedFallback).toBe(false);
    expect(r.variant).toBe('en');
  });

  it('locale zh prefers .zh.md when present', () => {
    const r = resolveAuditPromptPath(tmp, 'audit-prompts-code.md', 'zh');
    expect(r.resolvedPath).toBe(path.join(tmp, 'audit-prompts-code.zh.md'));
    expect(r.variant).toBe('zh-explicit');
  });

  it('locale en falls back to default .md when .en.md missing', () => {
    fs.unlinkSync(path.join(tmp, 'audit-prompts-code.en.md'));
    const r = resolveAuditPromptPath(tmp, 'audit-prompts-code.md', 'en');
    expect(r.resolvedPath).toBe(path.join(tmp, 'audit-prompts-code.md'));
    expect(r.usedFallback).toBe(true);
    expect(r.variant).toBe('default');
  });

  it('locale zh falls back to default when .zh.md missing', () => {
    fs.unlinkSync(path.join(tmp, 'audit-prompts-code.zh.md'));
    const r = resolveAuditPromptPath(tmp, 'audit-prompts-code.md', 'zh');
    expect(r.resolvedPath).toBe(path.join(tmp, 'audit-prompts-code.md'));
    expect(r.variant).toBe('default');
    expect(r.usedFallback).toBe(false);
  });

  it('stays contract-compatible with the generic localized markdown resolver', () => {
    const genericEn = resolveLocalizedMarkdownPath({
      basePath: path.join(tmp, 'audit-prompts-code.md'),
      resolvedMode: 'en',
    });
    const auditEn = resolveAuditPromptPath(tmp, 'audit-prompts-code.md', 'en');
    expect(auditEn.resolvedPath).toBe(genericEn.resolvedPath);
    expect(auditEn.variant).toBe('en');
    expect(auditEn.usedFallback).toBe(false);

    fs.unlinkSync(path.join(tmp, 'audit-prompts-code.zh.md'));
    const genericZh = resolveLocalizedMarkdownPath({
      basePath: path.join(tmp, 'audit-prompts-code.md'),
      resolvedMode: 'zh',
    });
    const auditZh = resolveAuditPromptPath(tmp, 'audit-prompts-code.md', 'zh');
    expect(auditZh.resolvedPath).toBe(genericZh.resolvedPath);
    expect(auditZh.variant).toBe('default');
    expect(auditZh.usedFallback).toBe(false);
  });
});

describe('getAuditPromptLocaleFromRuntimeContext', () => {
  let root: string | undefined;

  afterEach(() => {
    if (root) fs.rmSync(root, { recursive: true, force: true });
    root = undefined;
  });

  function writeProjectContext(projectRoot: string, resolvedMode: string): void {
    const dir = path.join(projectRoot, '_bmad-output', 'runtime', 'context');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, 'project.json'),
      JSON.stringify({
        version: 1,
        languagePolicy: { resolvedMode },
        updatedAt: new Date().toISOString(),
      })
    );
  }

  it('defaults to zh when project.json is missing', () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-locale-'));
    expect(getAuditPromptLocaleFromRuntimeContext(root)).toBe('zh');
  });

  it('returns en when languagePolicy.resolvedMode is en', () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-locale-'));
    writeProjectContext(root, 'en');
    expect(getAuditPromptLocaleFromRuntimeContext(root)).toBe('en');
  });

  it('returns zh when resolvedMode is zh or bilingual', () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-locale-'));
    writeProjectContext(root, 'zh');
    expect(getAuditPromptLocaleFromRuntimeContext(root)).toBe('zh');
    writeProjectContext(root, 'bilingual');
    expect(getAuditPromptLocaleFromRuntimeContext(root)).toBe('zh');
  });
});
