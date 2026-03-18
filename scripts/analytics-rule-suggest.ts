/**
 * Story 5.5 B09: 规则自优化建议 CLI
 * 用法：
 *   npx ts-node scripts/analytics-rule-suggest.ts --dataPath scoring/data
 *   npx ts-node scripts/analytics-rule-suggest.ts --dataPath scoring/data --clustersPath clusters.json --rulesDir scoring/rules
 */
import * as fs from 'fs';
import * as path from 'path';
import { clusterWeaknesses } from '../packages/scoring/analytics/cluster-weaknesses';
import {
  generateRuleSuggestions,
  formatRuleSuggestionsYaml,
} from '../packages/scoring/analytics/rule-suggestion';
import type { RunScoreRecord } from '../packages/scoring/writer/types';
import type { WeaknessCluster } from '../packages/scoring/analytics/cluster-weaknesses';

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
  const dataPath = args.dataPath ?? args.data ?? path.join(process.cwd(), 'packages', 'scoring', 'data');
  const clustersPath = args.clustersPath ?? args.clusters;
  const rulesDir = args.rulesDir ?? path.join(process.cwd(), 'packages', 'scoring', 'rules');

  const records = loadRecords(dataPath);

  let clusters: WeaknessCluster[];
  if (clustersPath && fs.existsSync(clustersPath)) {
    clusters = loadClusters(clustersPath);
  } else {
    clusters = clusterWeaknesses(records, 2);
  }

  const suggestions = generateRuleSuggestions(clusters, records, rulesDir);
  const outputPath = path.join(dataPath, 'rule-upgrade-suggestions.yaml');
  fs.mkdirSync(path.dirname(path.resolve(outputPath)), { recursive: true });
  fs.writeFileSync(outputPath, formatRuleSuggestionsYaml(suggestions), 'utf-8');
  console.log(`rule-suggestion: wrote ${suggestions.length} suggestions to ${outputPath}`);
}

main();
