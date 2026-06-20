import * as fs from 'node:fs';
import * as path from 'node:path';

export const DEFAULT_AGENT_MANIFEST_RELATIVE_PATH = '_bmad/_config/agent-manifest.csv' as const;

export interface AgentManifestRow {
  name: string;
  displayName: string;
  title: string;
  icon: string;
  capabilities: string;
  role: string;
  identity: string;
  communicationStyle: string;
  principles: string;
  module: string;
  path: string;
  [key: string]: string;
}

export function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        index += 1;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }

    if (char === ',' && !inQuotes) {
      cells.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  cells.push(current.trim());
  return cells;
}

export function readAgentManifestRows(
  projectRoot: string,
  relativePath: string = DEFAULT_AGENT_MANIFEST_RELATIVE_PATH
): AgentManifestRow[] {
  const manifestPath = path.join(projectRoot, relativePath);
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Agent manifest not found: ${manifestPath}`);
  }

  const lines = fs
    .readFileSync(manifestPath, 'utf8')
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length < 2) {
    return [];
  }

  const header = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    const row = Object.fromEntries(header.map((key, index) => [key, values[index] ?? '']));
    return row as AgentManifestRow;
  });
}

export function readAgentManifestRow(
  projectRoot: string,
  agentId: string,
  relativePath: string = DEFAULT_AGENT_MANIFEST_RELATIVE_PATH
): AgentManifestRow | undefined {
  return readAgentManifestRows(projectRoot, relativePath).find((row) => row.name === agentId);
}
