/**
 * CLI: stdin JSON → stdout JSON language policy subset; optional merge into project runtime context.
 *
 * Stdin: { "projectRoot": string, "userMessage": string, "recentMessages"?: string[], "writeContext"?: boolean }
 */
/* eslint-disable no-console */

import * as path from 'node:path';
import { loadConfig } from '../bmad-config';
import { ensureFacilitatorRuntimeDefinition } from '../facilitator-runtime-definition';
import { mergeLanguagePolicyIntoProjectContext } from '../runtime-context';
import { resolveLanguagePolicyForSession } from './resolve-for-session';

function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => {
      data += chunk;
    });
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', reject);
  });
}

async function main(): Promise<void> {
  const rawText = (await readStdin()).trim();
  let body: Record<string, unknown> = {};
  try {
    body = rawText ? (JSON.parse(rawText) as Record<string, unknown>) : {};
  } catch {
    process.stderr.write('[resolve-for-session-cli] invalid JSON stdin\n');
    process.exit(1);
    return;
  }

  const projectRoot = path.resolve(String(body.projectRoot || process.cwd()));
  const userMessage = String(body.userMessage ?? '');
  const recentMessages = Array.isArray(body.recentMessages)
    ? (body.recentMessages as unknown[]).map((x) => String(x))
    : [];
  const writeContext = body.writeContext === true;

  const prevCwd = process.cwd();
  try {
    process.chdir(projectRoot);
    const config = loadConfig();
    const policy = resolveLanguagePolicyForSession(config, userMessage, recentMessages);
    const out: Record<string, unknown> = {
      resolvedMode: policy.resolvedMode,
      requestedMode: policy.requestedMode,
      detectionSource: policy.detectionSource,
      artifactLanguage: policy.artifactLanguage,
      userLanguage: policy.userLanguage,
    };
    if (writeContext) {
      out.contextSync = mergeLanguagePolicyIntoProjectContext(projectRoot, {
        resolvedMode: policy.resolvedMode,
      });
      if (
        out.contextSync &&
        typeof out.contextSync === 'object' &&
        (out.contextSync as { status?: string }).status === 'skipped'
      ) {
        const receipts = ensureFacilitatorRuntimeDefinition(projectRoot, {
          mode: policy.resolvedMode,
        });
        out.temporaryResolvedModeApplied = {
          resolvedMode: policy.resolvedMode,
          targets: receipts
            .filter((receipt) => receipt.skippedReason == null)
            .map((receipt) => ({
              host: receipt.host,
              updated: receipt.updated,
            })),
        };
      }
    }
    console.log(JSON.stringify(out));
  } finally {
    try {
      process.chdir(prevCwd);
    } catch {
      /* ignore */
    }
  }
}

main().catch((e) => {
  process.stderr.write(`${e && (e as Error).message ? (e as Error).message : e}\n`);
  process.exit(1);
});
