/**
 * Resolves audit prompt template file path for locale (TASKS 附录 A / AUDIT_PROMPTS_STRATEGY.md).
 * Default `{stem}.md` = 中文主稿；`{stem}.zh.md` 显式中文；`{stem}.en.md` 全英文。
 *
 * Locale **does not** use environment variables. It comes from runtime context
 * `_bmad-output/runtime/context/project.json` → `languagePolicy.resolvedMode` (same contract as hooks / `render-audit-block-cli`).
 */
import * as fs from 'fs';
import * as path from 'path';

export type AuditPromptLocale = 'zh' | 'en';

const PROJECT_RUNTIME_CONTEXT = path.join(
  '_bmad-output',
  'runtime',
  'context',
  'project.json'
);

/**
 * Maps `languagePolicy.resolvedMode` to which sidecar to prefer.
 * - `en` → English `.en.md` when present.
 * - `zh` | `bilingual` → Chinese path (`.zh.md` or default `.md`); bilingual does not pick a second file here.
 * - Missing/invalid file or field → **zh** (default main稿).
 * @param {string} [projectRoot=process.cwd()] - Project root used to locate runtime context
 * @returns {AuditPromptLocale} Preferred audit prompt locale
 */
export function getAuditPromptLocaleFromRuntimeContext(
  projectRoot: string = process.cwd()
): AuditPromptLocale {
  const ctxPath = path.join(projectRoot, PROJECT_RUNTIME_CONTEXT);
  if (!fs.existsSync(ctxPath)) {
    return 'zh';
  }
  try {
    const raw = JSON.parse(fs.readFileSync(ctxPath, 'utf8')) as {
      languagePolicy?: { resolvedMode?: string };
    };
    const m = raw?.languagePolicy?.resolvedMode;
    if (m === 'en') return 'en';
    if (m === 'zh' || m === 'bilingual') return 'zh';
  } catch {
    /* ignore malformed context */
  }
  return 'zh';
}

/** Alias for documentation clarity. */
export const getAuditPromptLocale = getAuditPromptLocaleFromRuntimeContext;

export interface ResolveAuditPromptResult {
  /** Absolute or joined path under refsDir */
  resolvedPath: string;
  /** True if requested locale file missing and fell back */
  usedFallback: boolean;
  /** Which file was chosen: 'en' | 'zh-explicit' | 'default' */
  variant: 'en' | 'zh-explicit' | 'default';
}

/**
 * Resolve the concrete audit prompt template path for a locale.
 * @param {string} refsDir - e.g. .../speckit-workflow/references
 * @param {string} templateBasename - Value from code-reviewer-config prompt_template, e.g. audit-prompts-code.md
 * @param {AuditPromptLocale} locale - Locale from runtime context (`zh` | `en`)
 * @returns {ResolveAuditPromptResult} Resolved path metadata
 */
export function resolveAuditPromptPath(
  refsDir: string,
  templateBasename: string,
  locale: AuditPromptLocale
): ResolveAuditPromptResult {
  const stem = templateBasename.replace(/\.md$/i, '');
  const defaultPath = path.join(refsDir, `${stem}.md`);
  const zhPath = path.join(refsDir, `${stem}.zh.md`);
  const enPath = path.join(refsDir, `${stem}.en.md`);

  if (locale === 'en') {
    if (fs.existsSync(enPath)) {
      return { resolvedPath: enPath, usedFallback: false, variant: 'en' };
    }
    return { resolvedPath: defaultPath, usedFallback: true, variant: 'default' };
  }

  if (fs.existsSync(zhPath)) {
    return { resolvedPath: zhPath, usedFallback: false, variant: 'zh-explicit' };
  }
  return { resolvedPath: defaultPath, usedFallback: false, variant: 'default' };
}
