import * as fs from 'node:fs';
import * as path from 'node:path';
import type { RuntimeDashboardSnapshot } from './runtime-query';

export interface WriteDashboardSnapshotOptions {
  markdownPath: string;
  jsonPath: string;
  markdown: string;
  includeRuntime?: boolean;
}

function ensureDir(filePath: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

export function renderDashboardSnapshotMarkdown(
  markdown: string,
  snapshot: RuntimeDashboardSnapshot,
  includeRuntime = false
): string {
  if (!includeRuntime) {
    return markdown.endsWith('\n') ? markdown : `${markdown}\n`;
  }

  const lines: string[] = [markdown.trimEnd(), '', '## Runtime Context', ''];
  lines.push(`- Run ID: ${snapshot.runtime_context.run_id ?? 'N/A'}`);
  lines.push(`- Status: ${snapshot.runtime_context.status}`);
  lines.push(`- Current Stage: ${snapshot.runtime_context.current_stage ?? 'N/A'}`);
  lines.push(`- Flow: ${snapshot.runtime_context.flow ?? 'N/A'}`);
  if (snapshot.runtime_context.scope?.story_key) {
    lines.push(`- Story Key: ${snapshot.runtime_context.scope.story_key}`);
  }
  if (snapshot.runtime_context.scope?.resolved_context_path) {
    lines.push(`- Context Path: ${snapshot.runtime_context.scope.resolved_context_path}`);
  }
  lines.push('');
  lines.push('## Stage Timeline');
  lines.push('');
  lines.push('| Stage | Status | Score | Veto | Iterations |');
  lines.push('|------|--------|-------|------|------------|');
  for (const entry of snapshot.stage_timeline) {
    lines.push(
      `| ${entry.stage} | ${entry.status} | ${entry.phase_score ?? 'N/A'} | ${entry.veto_triggered ? 'yes' : 'no'} | ${entry.iteration_count ?? 'N/A'} |`
    );
  }
  lines.push('');
  lines.push('## SFT Builder Summary');
  lines.push('');
  lines.push(`- Total Candidates: ${snapshot.sft_summary.total_candidates}`);
  lines.push(`- Accepted: ${snapshot.sft_summary.accepted}`);
  lines.push(`- Rejected: ${snapshot.sft_summary.rejected}`);
  lines.push(`- Downgraded: ${snapshot.sft_summary.downgraded}`);
  return lines.join('\n') + '\n';
}

export function writeDashboardSnapshotFiles(
  snapshot: RuntimeDashboardSnapshot,
  options: WriteDashboardSnapshotOptions
): { markdown: string; json: string } {
  const markdownBody = renderDashboardSnapshotMarkdown(
    options.markdown,
    snapshot,
    options.includeRuntime ?? false
  );
  const jsonBody = JSON.stringify(snapshot, null, 2) + '\n';

  ensureDir(options.markdownPath);
  ensureDir(options.jsonPath);
  fs.writeFileSync(options.markdownPath, markdownBody, 'utf-8');
  fs.writeFileSync(options.jsonPath, jsonBody, 'utf-8');

  return { markdown: markdownBody, json: jsonBody };
}
