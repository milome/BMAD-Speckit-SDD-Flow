"use strict";
/* eslint-disable no-console */
Object.defineProperty(exports, "__esModule", { value: true });
exports.mainAuditorPostActions = mainAuditorPostActions;
const runtime_context_registry_1 = require("./runtime-context-registry");
function parseArgs(argv) {
    const out = {};
    for (let i = 0; i < argv.length; i++) {
        const token = argv[i];
        if (token === '--projectRoot' && argv[i + 1]) {
            out.projectRoot = argv[++i];
        }
        else if (token === '--reportPath' && argv[i + 1]) {
            out.reportPath = argv[++i];
        }
        else if (token === '--stage' && argv[i + 1]) {
            out.stage = argv[++i];
        }
    }
    return out;
}
function mainAuditorPostActions(argv) {
    const args = parseArgs(argv);
    const projectRoot = args.projectRoot?.trim();
    const reportPath = args.reportPath?.trim();
    if (!projectRoot || !reportPath) {
        console.error('auditor-post-actions: usage --projectRoot <path> --reportPath <audit-report-path> [--stage <stage>]');
        return 1;
    }
    try {
        (0, runtime_context_registry_1.syncAuditIndexFromReport)(projectRoot, reportPath);
        const registry = (0, runtime_context_registry_1.readRuntimeContextRegistry)(projectRoot);
        process.stdout.write(JSON.stringify({ updated: true, auditIndex: registry.auditIndex }));
        return 0;
    }
    catch (error) {
        console.error(`auditor-post-actions: ${error instanceof Error ? error.message : String(error)}`);
        return 1;
    }
}
function isDirectAuditorPostActionsCli(entry) {
    return /(^|[\\/])auditor-post-actions(\.[cm]?js|\.ts)?$/iu.test(entry ?? '');
}
if (require.main === module && isDirectAuditorPostActionsCli(process.argv[1])) {
    process.exit(mainAuditorPostActions(process.argv.slice(2)));
}
