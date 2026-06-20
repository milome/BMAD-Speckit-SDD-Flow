"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Story 5.5 B09: 规则自优化建议 CLI
 * 用法：
 *   npx ts-node scripts/analytics-rule-suggest.ts --dataPath scoring/data
 *   npx ts-node scripts/analytics-rule-suggest.ts --dataPath scoring/data --clustersPath clusters.json --rulesDir scoring/rules
 */
const fs = require("fs");
const path = require("path");
const cluster_weaknesses_1 = require("../packages/scoring/analytics/cluster-weaknesses");
const rule_suggestion_1 = require("../packages/scoring/analytics/rule-suggestion");
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
    const rulesDir = args.rulesDir ?? path.join(process.cwd(), 'packages', 'scoring', 'rules');
    const records = loadRecords(dataPath);
    let clusters;
    if (clustersPath && fs.existsSync(clustersPath)) {
        clusters = loadClusters(clustersPath);
    }
    else {
        clusters = (0, cluster_weaknesses_1.clusterWeaknesses)(records, 2);
    }
    const suggestions = (0, rule_suggestion_1.generateRuleSuggestions)(clusters, records, rulesDir);
    const outputPath = path.join(dataPath, 'rule-upgrade-suggestions.yaml');
    fs.mkdirSync(path.dirname(path.resolve(outputPath)), { recursive: true });
    fs.writeFileSync(outputPath, (0, rule_suggestion_1.formatRuleSuggestionsYaml)(suggestions), 'utf-8');
    console.log(`rule-suggestion: wrote ${suggestions.length} suggestions to ${outputPath}`);
}
main();
