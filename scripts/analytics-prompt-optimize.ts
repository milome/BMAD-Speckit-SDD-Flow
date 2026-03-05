/**
 * Story 5.5 B08: Prompt 优化建议 CLI
 * 用法：
 *   npx ts-node scripts/analytics-prompt-optimize.ts --dataPath scoring/data
 *   npx ts-node scripts/analytics-prompt-optimize.ts --dataPath scoring/data --clustersPath clusters.json
 */
import * as fs from 'fs';
import * as path from 'path';
import { clusterWeaknesses } from '../scoring/analytics/cluster-weaknesses';
import {
  generatePromptSuggestions,
  formatPromptSuggestionsMarkdown,
} from '../scoring/analytics/prompt-optimizer';
import type { RunScoreRecord } from '../scoring/writer/types';
import type { WeaknessCluster } from '../scoring/analytics/cluster-weaknesses';

function parseArgs(argv: string[]): Record<string, string> {
  const args: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
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

function loadRecords(dataPath: string): RunScoreRecord[] {
  const base = path.isAbsolute(dataPath) ? dataPath : path.resolve(process.cwd(), dataPath);
  const records: RunScoreRecord[] = [];
  if (!fs.existsSync(base)) return records;

  for (const name of fs.readdirSync(base)) {
    if (!name.endsWith('.json') || name === 'scores.jsonl') continue;
    try {
      const content = fs.readFileSync(path.join(base, name), 'utf-8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        records.push(...(parsed as RunScoreRecord[]));
      } else {
        records.push(parsed as RunScoreRecord);
      }
    } catch {
      // skip
    }
  }
  const jsonlPath = path.join(base, 'scores.jsonl');
  if (fs.existsSync(jsonlPath)) {
    for (const line of fs.readFileSync(jsonlPath, 'utf-8').split('\n').map((l) => l.trim()).filter(Boolean)) {
      try {
        records.push(JSON.parse(line) as RunScoreRecord);
      } catch {
        // skip
      }
    }
  }
  return records;
}

function loadClusters(clustersPath: string): WeaknessCluster[] {
  const content = fs.readFileSync(clustersPath, 'utf-8');
  return JSON.parse(content) as WeaknessCluster[];
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const dataPath = args.dataPath ?? args.data ?? path.join(process.cwd(), 'scoring', 'data');
  const clustersPath = args.clustersPath ?? args.clusters;

  let clusters: WeaknessCluster[];
  if (clustersPath && fs.existsSync(clustersPath)) {
    clusters = loadClusters(clustersPath);
  } else {
    const records = loadRecords(dataPath);
    clusters = clusterWeaknesses(records, 2);
  }

  const suggestions = generatePromptSuggestions(clusters);
  const outputPath = path.join(dataPath, 'prompt-optimization-suggestions.md');
  fs.mkdirSync(path.dirname(path.resolve(outputPath)), { recursive: true });
  fs.writeFileSync(outputPath, formatPromptSuggestionsMarkdown(suggestions), 'utf-8');
  console.log(`prompt-optimizer: wrote ${suggestions.length} suggestions to ${outputPath}`);
}

main();
