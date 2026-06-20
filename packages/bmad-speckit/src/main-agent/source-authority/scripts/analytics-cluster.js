"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Story 5.4 CLI: 能力短板聚类分析
 * 用法：
 *   npx ts-node scripts/analytics-cluster.ts --dataPath scoring/data --minFrequency 2
 *   npx ts-node scripts/analytics-cluster.ts --dataPath scoring/data --output clusters.json
 */
const fs = require("fs");
const path = require("path");
const cluster_weaknesses_1 = require("../packages/scoring/analytics/cluster-weaknesses");
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
function loadRecordsFromDataPath(dataPath) {
    const base = path.isAbsolute(dataPath) ? dataPath : path.resolve(process.cwd(), dataPath);
    const records = [];
    if (!fs.existsSync(base)) {
        return [];
    }
    const entries = fs.readdirSync(base, { withFileTypes: true });
    for (const e of entries) {
        if (!e.isFile())
            continue;
        const full = path.join(base, e.name);
        if (e.name.endsWith('.json') && e.name !== 'scores.jsonl') {
            try {
                const content = fs.readFileSync(full, 'utf-8');
                const parsed = JSON.parse(content);
                if (Array.isArray(parsed)) {
                    records.push(...parsed);
                }
                else {
                    records.push(parsed);
                }
            }
            catch {
                // skip invalid json
            }
        }
    }
    const jsonlPath = path.join(base, 'scores.jsonl');
    if (fs.existsSync(jsonlPath)) {
        const lines = fs
            .readFileSync(jsonlPath, 'utf-8')
            .split('\n')
            .map((l) => l.trim())
            .filter((l) => l.length > 0);
        for (const line of lines) {
            try {
                records.push(JSON.parse(line));
            }
            catch {
                // skip invalid line
            }
        }
    }
    return records;
}
function main() {
    const args = parseArgs(process.argv.slice(2));
    const dataPath = args.dataPath ?? args.data ?? 'scoring/data';
    const minFrequency = parseInt(args.minFrequency ?? '2', 10) || 2;
    const outputPath = args.output;
    const records = loadRecordsFromDataPath(dataPath);
    const clusters = (0, cluster_weaknesses_1.clusterWeaknesses)(records, minFrequency);
    const out = JSON.stringify(clusters, null, 2);
    if (outputPath) {
        fs.mkdirSync(path.dirname(path.resolve(outputPath)), { recursive: true });
        fs.writeFileSync(outputPath, out, 'utf-8');
    }
    else {
        console.log(out);
    }
}
main();
