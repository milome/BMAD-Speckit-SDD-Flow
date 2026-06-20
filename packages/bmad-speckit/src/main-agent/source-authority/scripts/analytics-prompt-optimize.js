"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Story 5.5 B08: Prompt 优化建议 CLI
 * 用法：
 *   npx ts-node scripts/analytics-prompt-optimize.ts --dataPath scoring/data
 *   npx ts-node scripts/analytics-prompt-optimize.ts --dataPath scoring/data --clustersPath clusters.json
 */
const fs = require("fs");
const path = require("path");
const cluster_weaknesses_1 = require("../packages/scoring/analytics/cluster-weaknesses");
const prompt_optimizer_1 = require("../packages/scoring/analytics/prompt-optimizer");
const path_1 = require("../packages/scoring/constants/path");
function parseArgs(argv) {
    const args = {};
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (!arg.startsWith('--'))
            continue;
        if (arg.includes('=')) {
            const idx = arg.indexOf('=');
            args[arg.slice(2, idx)] = arg.slice(idx + 1);
            continue;
        }
        const key = arg.slice(2);
        const next = argv[i + 1];
        if (next != null && !next.startsWith('--')) {
            args[key] = next;
            i++;
        }
    }
    return args;
}
function loadRecords(dataPath) {
    const base = path.isAbsolute(dataPath) ? dataPath : path.resolve(process.cwd(), dataPath);
    const records = [];
    if (!fs.existsSync(base))
        return records;
    for (const name of fs.readdirSync(base)) {
        if (!name.endsWith('.json') || name === 'scores.jsonl')
            continue;
        try {
            const content = fs.readFileSync(path.join(base, name), 'utf-8');
            const parsed = JSON.parse(content);
            if (Array.isArray(parsed)) {
                records.push(...parsed);
            }
            else {
                records.push(parsed);
            }
        }
        catch {
            // skip
        }
    }
    const jsonlPath = path.join(base, 'scores.jsonl');
    if (fs.existsSync(jsonlPath)) {
        for (const line of fs
            .readFileSync(jsonlPath, 'utf-8')
            .split('\n')
            .map((l) => l.trim())
            .filter(Boolean)) {
            try {
                records.push(JSON.parse(line));
            }
            catch {
                // skip
            }
        }
    }
    return records;
}
function loadClusters(clustersPath) {
    const content = fs.readFileSync(clustersPath, 'utf-8');
    return JSON.parse(content);
}
function main() {
    const args = parseArgs(process.argv.slice(2));
    const dataPath = args.dataPath ?? args.data ?? (0, path_1.getScoringDataPath)();
    const clustersPath = args.clustersPath ?? args.clusters;
    let clusters;
    if (clustersPath && fs.existsSync(clustersPath)) {
        clusters = loadClusters(clustersPath);
    }
    else {
        const records = loadRecords(dataPath);
        clusters = (0, cluster_weaknesses_1.clusterWeaknesses)(records, 2);
    }
    const suggestions = (0, prompt_optimizer_1.generatePromptSuggestions)(clusters);
    const outputPath = path.join(dataPath, 'prompt-optimization-suggestions.md');
    fs.mkdirSync(path.dirname(path.resolve(outputPath)), { recursive: true });
    fs.writeFileSync(outputPath, (0, prompt_optimizer_1.formatPromptSuggestionsMarkdown)(suggestions), 'utf-8');
    console.log(`prompt-optimizer: wrote ${suggestions.length} suggestions to ${outputPath}`);
}
main();
