/**
 * CLI: print resolved audit prompt path (JSON) for a references dir + stem template.
 * Usage: npx ts-node --transpile-only scripts/i18n/print-resolved-audit-prompt.ts <refsDir> <templateBasename> [projectRoot]
 * Locale: `_bmad-output/runtime/context/project.json` → languagePolicy.resolvedMode (not env). See AUDIT_PROMPTS_STRATEGY.md.
 */
import * as fs from 'fs';
import {
  getAuditPromptLocaleFromRuntimeContext,
  resolveAuditPromptPath,
} from './resolve-audit-prompt-path';

function main(): void {
  const refsDir = process.argv[2];
  const templateBasename = process.argv[3];
  const projectRoot = process.argv[4] || process.cwd();
  if (!refsDir || !templateBasename) {
    console.error(
      'Usage: print-resolved-audit-prompt <refsDir> <templateBasename> [projectRoot]'
    );
    process.exit(2);
  }
  const locale = getAuditPromptLocaleFromRuntimeContext(projectRoot);
  const r = resolveAuditPromptPath(refsDir, templateBasename, locale);
  const out = {
    locale,
    projectRoot,
    resolvedPath: r.resolvedPath,
    usedFallback: r.usedFallback,
    variant: r.variant,
    exists: fs.existsSync(r.resolvedPath),
  };
  console.log(JSON.stringify(out, null, 2));
}

main();
