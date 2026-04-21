import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  deriveLocalizedMarkdownPaths,
  resolveLocalizedMarkdownPath,
} from '../../scripts/i18n/resolve-localized-markdown-path';

describe('resolveLocalizedMarkdownPath', () => {
  let tmp: string;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'localized-markdown-'));
    fs.writeFileSync(path.join(tmp, 'workflow.md'), '# default');
    fs.writeFileSync(path.join(tmp, 'workflow.zh.md'), '# zh');
    fs.writeFileSync(path.join(tmp, 'workflow.en.md'), '# en');
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('prefers .en.md for en mode', () => {
    const result = resolveLocalizedMarkdownPath({
      basePath: path.join(tmp, 'workflow.md'),
      resolvedMode: 'en',
    });
    expect(result).toStrictEqual({
      resolvedPath: path.join(tmp, 'workflow.en.md'),
      usedFallback: false,
      variant: 'en',
    });
  });

  it('prefers .zh.md for zh mode', () => {
    const result = resolveLocalizedMarkdownPath({
      basePath: path.join(tmp, 'workflow.md'),
      resolvedMode: 'zh',
    });
    expect(result).toStrictEqual({
      resolvedPath: path.join(tmp, 'workflow.zh.md'),
      usedFallback: false,
      variant: 'zh',
    });
  });

  it('maps bilingual mode to the zh path layer contract', () => {
    const result = resolveLocalizedMarkdownPath({
      basePath: path.join(tmp, 'workflow.md'),
      resolvedMode: 'bilingual',
    });
    expect(result).toStrictEqual({
      resolvedPath: path.join(tmp, 'workflow.zh.md'),
      usedFallback: false,
      variant: 'zh',
    });
  });

  it('falls back to default .md when the requested localized sidecar is missing', () => {
    fs.unlinkSync(path.join(tmp, 'workflow.en.md'));
    fs.unlinkSync(path.join(tmp, 'workflow.zh.md'));

    const enResult = resolveLocalizedMarkdownPath({
      basePath: path.join(tmp, 'workflow.md'),
      resolvedMode: 'en',
    });
    expect(enResult).toStrictEqual({
      resolvedPath: path.join(tmp, 'workflow.md'),
      usedFallback: true,
      variant: 'base',
    });

    const bilingualResult = resolveLocalizedMarkdownPath({
      basePath: path.join(tmp, 'workflow.md'),
      resolvedMode: 'bilingual',
    });
    expect(bilingualResult).toStrictEqual({
      resolvedPath: path.join(tmp, 'workflow.md'),
      usedFallback: true,
      variant: 'base',
    });
  });

  it('normalizes base paths that omit the .md suffix', () => {
    const paths = deriveLocalizedMarkdownPaths(path.join(tmp, 'workflow'));
    expect(paths).toStrictEqual({
      defaultPath: path.join(tmp, 'workflow.md'),
      zhPath: path.join(tmp, 'workflow.zh.md'),
      enPath: path.join(tmp, 'workflow.en.md'),
    });

    const result = resolveLocalizedMarkdownPath({
      basePath: path.join(tmp, 'workflow'),
      resolvedMode: 'zh',
    });
    expect(result.resolvedPath).toBe(path.join(tmp, 'workflow.zh.md'));
  });

  it('returns the normalized default path for missing files', () => {
    const result = resolveLocalizedMarkdownPath({
      basePath: path.join(tmp, 'missing-workflow.md'),
      resolvedMode: 'en',
    });
    expect(result).toStrictEqual({
      resolvedPath: path.join(tmp, 'missing-workflow.md'),
      usedFallback: true,
      variant: 'base',
    });
  });

  it('treats invalid runtime modes as the zh-path contract instead of throwing', () => {
    const result = resolveLocalizedMarkdownPath({
      basePath: path.join(tmp, 'workflow.md'),
      resolvedMode: 'invalid' as never,
    });
    expect(result).toStrictEqual({
      resolvedPath: path.join(tmp, 'workflow.zh.md'),
      usedFallback: false,
      variant: 'zh',
    });
  });
});
