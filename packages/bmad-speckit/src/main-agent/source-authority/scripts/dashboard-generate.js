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
/**
 * Dashboard-generate CLI: 生成项目健康度仪表盘 Markdown。
 *
 * 用途：聚合 scoring 数据，计算健康分数、短板 Top3、高迭代 Top3，输出 _bmad-output/dashboard.md。
 *
 * CLI 参数：--strategy (epic_story_window|run_id), --dataPath, --epic, --story, --windowHours, --output (默认 _bmad-output/dashboard.md)
 *
 * 示例：npx ts-node scripts/dashboard-generate.ts --epic 2
 *
 * 退出码：0=成功，1=无数据或错误
 */
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const path_1 = require("../packages/scoring/constants/path");
const loader_1 = require("../packages/scoring/query/loader");
const query_1 = require("../packages/scoring/query");
const dashboard_1 = require("../packages/scoring/dashboard");
const EMPTY_DATA_MESSAGE = '暂无数据，请先完成至少一轮 Dev Story';
const INSUFFICIENT_RUN_MESSAGE = '数据不足，暂无完整 run（至少 2 stage）';
const EPIC_NO_COMPLETE_STORY_MESSAGE = (epicId) => `Epic ${epicId} 下无完整 Story，暂无聚合数据`;
const OUTPUT_PATH = '_bmad-output/dashboard.md';
const OUTPUT_JSON_PATH = '_bmad-output/dashboard/runtime-dashboard.json';
function resolveScopedAnalyticsRecords(records, strategy, epic, story, windowHours) {
    if (strategy !== 'epic_story_window') {
        return records;
    }
    if (epic != null && !isNaN(epic) && story != null && !isNaN(story)) {
        return (0, dashboard_1.aggregateByEpicStoryTimeWindow)(records, epic, story, windowHours);
    }
    if (epic != null && !isNaN(epic)) {
        return (0, dashboard_1.aggregateByEpicOnly)(records, epic, windowHours);
    }
    return records;
}
function parseArgs() {
    const args = {};
    for (let i = 2; i < process.argv.length; i++) {
        const arg = process.argv[i];
        if (arg.startsWith('--')) {
            const key = arg.slice(2);
            const val = process.argv[i + 1];
            if (val != null && !val.startsWith('--')) {
                args[key] = val;
                i++;
            }
            else {
                args[key] = 'true';
            }
        }
    }
    return args;
}
function ensureDir(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}
function main() {
    const args = parseArgs();
    const strategy = (args.strategy ?? 'epic_story_window');
    const dataPathArg = args.dataPath;
    const dataPath = dataPathArg != null && dataPathArg !== ''
        ? path.isAbsolute(dataPathArg)
            ? dataPathArg
            : path.resolve(process.cwd(), dataPathArg)
        : (0, path_1.getScoringDataPath)();
    const records = (0, loader_1.loadAndDedupeRecords)(dataPath).filter((r) => r.scenario !== 'eval_question');
    const outputArg = args.output;
    const outputRel = outputArg != null && outputArg !== '' ? outputArg : OUTPUT_PATH;
    const outDir = path.resolve(process.cwd(), path.dirname(outputRel));
    ensureDir(outDir);
    const outFile = path.resolve(process.cwd(), outputRel);
    const outputJsonArg = args['output-json'];
    const outputJsonRel = outputJsonArg != null && outputJsonArg !== '' ? outputJsonArg : OUTPUT_JSON_PATH;
    const outJsonFile = path.resolve(process.cwd(), outputJsonRel);
    const printJson = args.json === 'true';
    const includeRuntime = args['include-runtime'] === 'true';
    const epicRaw = args.epic;
    const storyRaw = args.story;
    const epic = epicRaw != null ? parseInt(epicRaw, 10) : undefined;
    const story = storyRaw != null ? parseInt(storyRaw, 10) : undefined;
    const windowHours = args.windowHours != null ? parseInt(args.windowHours, 10) : 24 * 7;
    const isEpicOnly = strategy === 'epic_story_window' &&
        epic != null &&
        !isNaN(epic) &&
        (story == null || isNaN(story));
    const analyticsRecords = resolveScopedAnalyticsRecords(records, strategy, epic != null && !isNaN(epic) ? epic : undefined, story != null && !isNaN(story) ? story : undefined, windowHours);
    const snapshot = (0, dashboard_1.queryRuntimeDashboard)({
        root: process.cwd(),
        dataPath,
        strategy,
        epic: epic != null && !isNaN(epic) ? epic : undefined,
        story: story != null && !isNaN(story) ? story : undefined,
        windowHours,
    });
    function writeArtifacts(markdown) {
        const written = (0, dashboard_1.writeDashboardSnapshotFiles)(snapshot, {
            markdownPath: outFile,
            jsonPath: outJsonFile,
            markdown,
            includeRuntime,
        });
        console.log(printJson ? written.json.trimEnd() : written.markdown.trimEnd());
    }
    if (records.length === 0) {
        writeArtifacts(EMPTY_DATA_MESSAGE);
        return;
    }
    const latestRecords = strategy === 'epic_story_window'
        ? (0, dashboard_1.getLatestRunRecordsV2)(records, {
            strategy: 'epic_story_window',
            epic: epic != null && !isNaN(epic) ? epic : undefined,
            story: story != null && !isNaN(story) ? story : undefined,
            windowHours,
        })
        : (0, dashboard_1.getLatestRunRecords)(records);
    if (latestRecords.length === 0) {
        const msg = isEpicOnly && epic != null ? EPIC_NO_COMPLETE_STORY_MESSAGE(epic) : INSUFFICIENT_RUN_MESSAGE;
        writeArtifacts(msg);
        return;
    }
    const healthScore = isEpicOnly
        ? (0, dashboard_1.computeEpicHealthScore)(latestRecords)
        : (0, dashboard_1.computeHealthScore)(latestRecords);
    const dimensions = isEpicOnly
        ? (0, dashboard_1.getEpicDimensionScores)(latestRecords)
        : (0, dashboard_1.getDimensionScores)(latestRecords);
    const weakTop3 = strategy === 'epic_story_window'
        ? (0, dashboard_1.getWeakTop3EpicStory)(latestRecords)
        : (0, dashboard_1.getWeakTop3)(latestRecords);
    const highIterTop3 = (0, dashboard_1.getHighIterationTop3)(latestRecords);
    const journeyContractSummary = (0, dashboard_1.getJourneyContractSummary)(latestRecords);
    const vetoCount = (0, dashboard_1.countVetoTriggers)(latestRecords);
    const trend = (0, dashboard_1.getTrend)(records);
    const governanceRoutingSummary = (0, dashboard_1.getGovernanceRoutingSummary)(analyticsRecords);
    const governanceRoutingModeDistribution = (0, dashboard_1.getGovernanceRoutingModeDistribution)(analyticsRecords);
    const governanceSignalHotspots = (0, dashboard_1.getGovernanceSignalHotspots)(analyticsRecords);
    const governanceGateFailureTrend = (0, dashboard_1.getGovernanceRerunGateFailureTrend)(analyticsRecords);
    let formatOpts;
    if (isEpicOnly && epic != null) {
        const storyIdsSet = new Set();
        for (const r of latestRecords) {
            const p = (0, query_1.parseEpicStoryFromRecord)(r);
            if (p)
                storyIdsSet.add(p.storyId);
        }
        const storyIds = [...storyIdsSet].sort((a, b) => a - b);
        const candidates = (0, dashboard_1.aggregateByEpicOnly)(records, epic, windowHours);
        const inResult = new Set(latestRecords
            .map((r) => {
            const p = (0, query_1.parseEpicStoryFromRecord)(r);
            return p ? `E${p.epicId}.S${p.storyId}` : null;
        })
            .filter((x) => x != null));
        const excludedStories = [];
        const seen = new Set();
        for (const r of candidates) {
            const p = (0, query_1.parseEpicStoryFromRecord)(r);
            if (p) {
                const key = `E${p.epicId}.S${p.storyId}`;
                if (!inResult.has(key) && !seen.has(key)) {
                    seen.add(key);
                    excludedStories.push(key);
                }
            }
        }
        formatOpts = { viewMode: 'epic_aggregate', epicId: epic, storyIds, excludedStories };
    }
    const markdown = (0, dashboard_1.formatDashboardMarkdown)({
        healthScore,
        dimensions,
        weakTop3,
        highIterTop3,
        journeyContractSummary,
        governanceRoutingSummary,
        governanceRoutingModeDistribution,
        governanceSignalHotspots,
        governanceGateFailureTrend,
        vetoCount,
        trend,
    }, formatOpts);
    writeArtifacts(markdown);
}
main();
