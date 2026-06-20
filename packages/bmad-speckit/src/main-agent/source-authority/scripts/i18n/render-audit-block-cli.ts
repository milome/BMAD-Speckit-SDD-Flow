/**
 * CLI: print manifest-rendered audit parseable block for injection (T4.5).
 * Used by pre-agent-summary hook; reads `_bmad-output/runtime/context/project.json` for languagePolicy.
 */
import { readFileSync, existsSync } from 'node:fs';
import * as path from 'node:path';
import type { LanguagePolicy } from './language-policy';
import type { ResolvedLanguage } from './detect-language';
import { loadManifest } from './load-manifest';
import { renderTemplate } from './render-template';

function readResolvedMode(): ResolvedLanguage {
  const ctxPath = path.join(process.cwd(), '_bmad-output', 'runtime', 'context', 'project.json');
  if (!existsSync(ctxPath)) return 'en';
  try {
    const raw = JSON.parse(readFileSync(ctxPath, 'utf8')) as {
      languagePolicy?: { resolvedMode?: string };
    };
    const m = raw?.languagePolicy?.resolvedMode;
    if (m === 'zh' || m === 'en' || m === 'bilingual') return m;
  } catch {
    /* ignore */
  }
  return 'en';
}

function makeLanguagePolicy(resolved: ResolvedLanguage): LanguagePolicy {
  return {
    requestedMode: resolved === 'bilingual' ? 'bilingual' : resolved,
    resolvedMode: resolved,
    userLanguage: resolved === 'zh' ? 'zh' : resolved === 'en' ? 'en' : 'mixed',
    artifactLanguage: resolved === 'bilingual' ? 'bilingual' : resolved,
    detectionSource: 'project_default',
    allowBilingualDisplay: resolved === 'bilingual',
    preserveControlKeysInEnglish: true,
    preserveCommandsAndPaths: true,
  };
}

function main(): void {
  const manifestId = process.argv[2] || 'speckit.audit.spec';
  const resolved = readResolvedMode();
  const manifest = loadManifest(manifestId);
  const languagePolicy = makeLanguagePolicy(resolved);
  const result = renderTemplate({
    manifest,
    languagePolicy,
    placeholders: { epic: '15', story: '2' },
  });
  process.stdout.write(
    [
      '[i18n audit template preview]',
      `manifest=${manifestId} resolvedMode=${resolved}`,
      '',
      result.content,
      '',
    ].join('\n')
  );
}

main();
