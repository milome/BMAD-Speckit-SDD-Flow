"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Story 5.5 B07: SFT 数据集提取 CLI
 * 用法：
 *   npx ts-node scripts/analytics-sft-extract.ts --dataPath scoring/data --output scoring/data/sft-dataset.jsonl
 */
const path = require("path");
const sft_extractor_1 = require("../packages/scoring/analytics/sft-extractor");
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
async function main() {
    const args = parseArgs(process.argv.slice(2));
    const dataPath = args.dataPath ?? args.data ?? (0, path_1.getScoringDataPath)();
    const output = args.output ?? path.join(dataPath, 'sft-dataset.jsonl');
    const result = await (0, sft_extractor_1.extractSftDataset)(dataPath, output);
    console.log(`extractSftDataset: wrote ${result.entries.length} entries to ${output}`);
}
main().catch((err) => {
    console.error(err);
    process.exit(1);
});
