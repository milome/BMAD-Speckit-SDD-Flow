"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.evaluateAdaptiveIntakeProof = evaluateAdaptiveIntakeProof;
exports.main = main;
/* eslint-disable no-console */
const fs = __importStar(require("node:fs"));
const os = __importStar(require("node:os"));
const path = __importStar(require("node:path"));
const user_story_mapping_1 = require("./user-story-mapping");
const REQUIRED_FLOWS = ['story', 'bugfix', 'standalone_tasks'];
function normalizeText(value) {
    return String(value ?? '').trim();
}
function isMapped(item) {
    return (normalizeText(item.requirementId) !== '' &&
        normalizeText(item.epicId) !== '' &&
        normalizeText(item.storyId) !== '' &&
        normalizeText(item.sprintId) !== '' &&
        item.allowedWriteScope.length > 0);
}
function queueSyncPath(projectRoot, requirementId) {
    return path.join(projectRoot, '_bmad-output', 'runtime', 'governance', 'adaptive-intake-queue-sync', `${requirementId}.json`);
}
function hasQueueSync(projectRoot, item) {
    const file = queueSyncPath(projectRoot, item.requirementId);
    if (!fs.existsSync(file)) {
        return false;
    }
    try {
        const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
        return (parsed.decision?.applied === true &&
            parsed.decision.route?.requirementId === item.requirementId &&
            parsed.decision.route?.storyId === item.storyId &&
            Array.isArray(parsed.decision.route?.allowedWriteScope) &&
            parsed.decision.route.allowedWriteScope.length > 0);
    }
    catch {
        return false;
    }
}
function evaluateAdaptiveIntakeProof(projectRoot, index = (0, user_story_mapping_1.readUserStoryMappingIndexOrDefault)(projectRoot)) {
    const activeItems = index.items.filter((item) => (0, user_story_mapping_1.isActiveUserStoryMappingStatus)(item.status));
    const orphanItems = activeItems.filter((item) => !isMapped(item));
    const coveredFlows = REQUIRED_FLOWS.filter((flow) => activeItems.some((item) => item.flow === flow && isMapped(item)));
    const missingFlows = REQUIRED_FLOWS.filter((flow) => !coveredFlows.includes(flow));
    const missingQueueSync = activeItems.filter((item) => !hasQueueSync(projectRoot, item));
    const checks = [
        {
            id: 'orphan-task-zero',
            passed: orphanItems.length === 0,
            summary: orphanItems.length === 0
                ? 'orphan-task=0'
                : `orphan-task=${orphanItems.length}: ${orphanItems
                    .map((item) => item.requirementId)
                    .join(', ')}`,
        },
        {
            id: 'three-flow-coverage',
            passed: missingFlows.length === 0,
            summary: missingFlows.length === 0
                ? 'story/bugfix/standalone_tasks covered'
                : `missing flows: ${missingFlows.join(', ')}`,
        },
        {
            id: 'queue-sync-dependency-proof',
            passed: missingQueueSync.length === 0,
            summary: missingQueueSync.length === 0
                ? 'all active mappings have applied queue-sync artifacts'
                : `missing queue-sync: ${missingQueueSync.map((item) => item.requirementId).join(', ')}`,
        },
    ];
    return {
        reportType: 'adaptive_intake_proof_gate',
        critical_failures: checks.filter((check) => !check.passed).length,
        checks,
        orphanTaskCount: orphanItems.length,
        coveredFlows,
    };
}
function parseArgs(argv) {
    const out = {};
    for (let index = 0; index < argv.length; index += 1) {
        const token = argv[index];
        if (token === '--cwd' && argv[index + 1]) {
            out.cwd = argv[++index];
        }
        else if (token === '--contract-fixture') {
            out.contractFixture = 'true';
        }
    }
    return out;
}
function fixtureItem(flow) {
    return {
        requirementId: `REQ-${flow}`,
        sourceType: flow === 'bugfix' ? 'bugfix' : flow === 'standalone_tasks' ? 'standalone' : 'prd',
        epicId: `E-${flow}`,
        storyId: `S-${flow}`,
        flow,
        sprintId: 'SPRINT-CONTRACT',
        allowedWriteScope: [`src/${flow}/**`],
        status: 'planned',
    };
}
function writeFixtureQueueSync(projectRoot, item) {
    const file = queueSyncPath(projectRoot, item.requirementId);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify({
        decision: {
            applied: true,
            route: {
                requirementId: item.requirementId,
                storyId: item.storyId,
                allowedWriteScope: item.allowedWriteScope,
            },
        },
    }, null, 2) + '\n', 'utf8');
}
function createContractFixtureRoot() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'adaptive-intake-proof-'));
    const items = REQUIRED_FLOWS.map((flow) => fixtureItem(flow));
    (0, user_story_mapping_1.writeUserStoryMappingIndex)(root, {
        version: 1,
        updatedAt: '2026-04-27T00:00:00.000Z',
        source: '_bmad-output/runtime/requirement-records/index.json',
        items,
    });
    for (const item of items) {
        writeFixtureQueueSync(root, item);
    }
    return root;
}
function main(argv) {
    const args = parseArgs(argv);
    const fixtureRoot = args.contractFixture === 'true' ? createContractFixtureRoot() : null;
    const root = fixtureRoot ?? path.resolve(args.cwd ?? process.cwd());
    try {
        const report = evaluateAdaptiveIntakeProof(root);
        console.log(JSON.stringify(report, null, 2));
        return report.critical_failures === 0 ? 0 : 1;
    }
    finally {
        if (fixtureRoot) {
            fs.rmSync(fixtureRoot, { recursive: true, force: true });
        }
    }
}
if (require.main === module) {
    process.exitCode = main(process.argv.slice(2));
}
