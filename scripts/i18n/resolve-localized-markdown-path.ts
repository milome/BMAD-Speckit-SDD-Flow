import * as fs from 'node:fs';

export type LocalizedMarkdownResolvedMode = 'zh' | 'en' | 'bilingual';
export type LocalizedMarkdownVariant = 'base' | 'zh' | 'en';

export interface ResolveLocalizedMarkdownPathInput {
  basePath: string;
  resolvedMode: LocalizedMarkdownResolvedMode;
}

export interface ResolveLocalizedMarkdownPathResult {
  resolvedPath: string;
  usedFallback: boolean;
  variant: LocalizedMarkdownVariant;
}

function normalizeDefaultMarkdownPath(basePath: string): string {
  return /\.md$/i.test(basePath) ? basePath : `${basePath}.md`;
}

function buildSidecarPath(defaultPath: string, locale: 'zh' | 'en'): string {
  return defaultPath.replace(/\.md$/i, `.${locale}.md`);
}

export function resolveLocalizedMarkdownPath(
  input: ResolveLocalizedMarkdownPathInput
): ResolveLocalizedMarkdownPathResult {
  const defaultPath = normalizeDefaultMarkdownPath(input.basePath);
  const zhPath = buildSidecarPath(defaultPath, 'zh');
  const enPath = buildSidecarPath(defaultPath, 'en');
  const resolvedMode =
    input.resolvedMode === 'en' || input.resolvedMode === 'zh' || input.resolvedMode === 'bilingual'
      ? input.resolvedMode
      : 'zh';

  if (resolvedMode === 'en') {
    if (fs.existsSync(enPath)) {
      return { resolvedPath: enPath, usedFallback: false, variant: 'en' };
    }
    return { resolvedPath: defaultPath, usedFallback: true, variant: 'base' };
  }

  if (fs.existsSync(zhPath)) {
    return { resolvedPath: zhPath, usedFallback: false, variant: 'zh' };
  }

  return { resolvedPath: defaultPath, usedFallback: true, variant: 'base' };
}

export function deriveLocalizedMarkdownPaths(basePath: string): {
  defaultPath: string;
  zhPath: string;
  enPath: string;
} {
  const defaultPath = normalizeDefaultMarkdownPath(basePath);
  return {
    defaultPath,
    zhPath: buildSidecarPath(defaultPath, 'zh'),
    enPath: buildSidecarPath(defaultPath, 'en'),
  };
}
