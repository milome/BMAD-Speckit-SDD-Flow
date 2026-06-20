"use strict";
/**
 * CLI: stdin JSON → stdout JSON language policy subset; optional merge into project runtime context.
 *
 * Stdin: { "projectRoot": string, "userMessage": string, "recentMessages"?: string[], "writeContext"?: boolean }
 */
/* eslint-disable no-console */
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("node:path");
const bmad_config_1 = require("../bmad-config");
const facilitator_runtime_definition_1 = require("../facilitator-runtime-definition");
const runtime_context_1 = require("../runtime-context");
const resolve_for_session_1 = require("./resolve-for-session");
function isDirectResolveForSessionCli(entry) {
    return /(^|[\\/])resolve-for-session(\.[cm]?js|\.ts)?$/iu.test(entry ?? '');
}
function readStdin() {
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
async function main() {
    const rawText = (await readStdin()).trim();
    let body = {};
    try {
        body = rawText ? JSON.parse(rawText) : {};
    }
    catch {
        process.stderr.write('[resolve-for-session-cli] invalid JSON stdin\n');
        process.exit(1);
        return;
    }
    const projectRoot = path.resolve(String(body.projectRoot || process.cwd()));
    const userMessage = String(body.userMessage ?? '');
    const recentMessages = Array.isArray(body.recentMessages)
        ? body.recentMessages.map((x) => String(x))
        : [];
    const writeContext = body.writeContext === true;
    const prevCwd = process.cwd();
    try {
        process.chdir(projectRoot);
        const config = (0, bmad_config_1.loadConfig)();
        const policy = (0, resolve_for_session_1.resolveLanguagePolicyForSession)(config, userMessage, recentMessages);
        const receipts = writeContext
            ? (0, facilitator_runtime_definition_1.ensureFacilitatorRuntimeDefinition)(projectRoot, {
                mode: policy.resolvedMode,
            })
            : [];
        const out = {
            resolvedMode: policy.resolvedMode,
            requestedMode: policy.requestedMode,
            detectionSource: policy.detectionSource,
            artifactLanguage: policy.artifactLanguage,
            userLanguage: policy.userLanguage,
        };
        if (writeContext) {
            out.contextSync = (0, runtime_context_1.mergeLanguagePolicyIntoProjectContext)(projectRoot, {
                resolvedMode: policy.resolvedMode,
            });
            if (out.contextSync &&
                typeof out.contextSync === 'object' &&
                out.contextSync.status === 'skipped') {
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
    }
    finally {
        try {
            process.chdir(prevCwd);
        }
        catch {
            /* ignore */
        }
    }
}
if (require.main === module && isDirectResolveForSessionCli(process.argv[1])) {
    main().catch((e) => {
        process.stderr.write(`${e && e.message ? e.message : e}\n`);
        process.exit(1);
    });
}
