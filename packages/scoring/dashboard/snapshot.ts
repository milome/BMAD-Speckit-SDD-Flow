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
  if (snapshot.execution_state.execution_status) {
    lines.push(`- Execution Status: ${snapshot.execution_state.execution_status}`);
    lines.push(`- Execution Host: ${snapshot.execution_state.dispatched_host ?? snapshot.execution_state.configured_authoritative_host ?? 'N/A'}`);
  }
  if (snapshot.runtime_context.scope?.story_key) {
    lines.push(`- Story Key: ${snapshot.runtime_context.scope.story_key}`);
  }
  if (snapshot.runtime_context.scope?.resolved_context_path) {
    lines.push(`- Context Path: ${snapshot.runtime_context.scope.resolved_context_path}`);
  }
  if (snapshot.runtime_context.reviewer_contract) {
    lines.push('');
    lines.push('## Reviewer Projection');
    lines.push('');
    lines.push(`- Reviewer Identity: ${snapshot.runtime_context.reviewer_contract.reviewerIdentity}`);
    lines.push(`- Reviewer Registry: ${snapshot.runtime_context.reviewer_contract.registryVersion}`);
    lines.push(
      `- Shared Core: ${
        snapshot.runtime_context.reviewer_contract.sharedCore
          ? `${snapshot.runtime_context.reviewer_contract.sharedCore.rootPath} [${snapshot.runtime_context.reviewer_contract.sharedCore.version}]`
          : 'N/A'
      }`
    );
    lines.push(
      `- Active Reviewer Consumer: ${
        snapshot.runtime_context.reviewer_contract.activeAuditConsumer
          ? `${snapshot.runtime_context.reviewer_contract.activeAuditConsumer.entryStage} -> ${snapshot.runtime_context.reviewer_contract.activeAuditConsumer.profile}`
          : 'N/A'
      }`
    );
    lines.push(`- Reviewer Closeout: ${snapshot.runtime_context.reviewer_contract.closeoutRunner}`);
    const reviewerRoute = snapshot.execution_state.reviewer_route_explainability?.[0] ?? null;
    const executionHost =
      snapshot.execution_state.dispatched_host ??
      snapshot.execution_state.configured_authoritative_host ??
      null;
    if (executionHost && reviewerRoute?.hosts?.[executionHost as 'cursor' | 'claude']) {
      const currentCarrier = reviewerRoute.hosts[executionHost as 'cursor' | 'claude'];
      lines.push(
        `- Current Carrier: ${executionHost} -> ${currentCarrier.carrierSourcePath} -> ${currentCarrier.runtimeTargetPath}`
      );
    }
    lines.push(
      `- Cursor Route: ${
        reviewerRoute
          ? `${reviewerRoute.hosts.cursor.preferredRoute.tool}/${reviewerRoute.hosts.cursor.preferredRoute.subtypeOrExecutor}`
          : 'N/A'
      }`
    );
    lines.push(
      `- Claude Route: ${
        reviewerRoute
          ? `${reviewerRoute.hosts.claude.preferredRoute.tool}/${reviewerRoute.hosts.claude.preferredRoute.subtypeOrExecutor}`
          : 'N/A'
      }`
    );
    lines.push(`- Fallback Status: ${reviewerRoute?.fallbackStatus ?? 'N/A'}`);
    lines.push(`- Maturity: ${reviewerRoute?.isomorphismMaturity ?? 'N/A'}`);
    lines.push(`- Complexity: ${reviewerRoute?.complexitySource ?? 'N/A'}`);
    lines.push(`- Remaining Blocker: ${reviewerRoute?.remainingBlocker ?? 'N/A'}`);
    lines.push(
      `- Rollout Gate: ${
        snapshot.runtime_context.reviewer_contract.rolloutGate
          ? `${snapshot.runtime_context.reviewer_contract.rolloutGate.status} -> ${snapshot.runtime_context.reviewer_contract.rolloutGate.summary}`
          : 'N/A'
      }`
    );
  }
  if (snapshot.runtime_context.latest_reviewer_closeout) {
    const closeout = snapshot.runtime_context.latest_reviewer_closeout;
    lines.push('');
    lines.push('## Latest Reviewer Closeout');
    lines.push('');
    lines.push(`- Updated At: ${closeout.updated_at}`);
    lines.push(`- Runner: ${closeout.runner}`);
    lines.push(`- Profile: ${closeout.profile}`);
    lines.push(`- Stage: ${closeout.stage}`);
    lines.push(`- Audit Status: ${closeout.audit_status}`);
    lines.push(`- Closeout Approved: ${closeout.closeout_approved ? 'yes' : 'no'}`);
    lines.push(`- Result Code: ${closeout.result_code}`);
    lines.push(`- Rerun Decision: ${closeout.rerun_decision}`);
    lines.push(`- Packet Execution Closure Status: ${closeout.packet_execution_closure_status}`);
    lines.push(`- Scoring Failure Mode: ${closeout.scoring_failure_mode}`);
    lines.push(`- Blocking Reason: ${closeout.blocking_reason ?? 'N/A'}`);
    lines.push(
      `- Required Fixes: ${closeout.required_fixes.length > 0 ? closeout.required_fixes.join(', ') : 'N/A'}`
    );
    lines.push(`- Artifact Path: ${closeout.artifact_path}`);
    lines.push(`- Report Path: ${closeout.report_path}`);
    if (closeout.score_error) {
      lines.push(`- Score Error: ${closeout.score_error}`);
    }
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
  if (snapshot.readiness_projection) {
    lines.push('');
    lines.push('## Readiness Drift Projection');
    lines.push('');
    lines.push(
      `- Readiness Baseline Run ID: ${snapshot.readiness_projection.readiness_baseline_run_id ?? 'N/A'}`
    );
    lines.push(
      `- Readiness Score: ${snapshot.readiness_projection.readiness_score ?? 'N/A'}`
    );
    lines.push(
      `- Readiness Raw Score: ${snapshot.readiness_projection.readiness_raw_score ?? 'N/A'}`
    );
    lines.push(
      `- Effective Verdict: ${snapshot.readiness_projection.effective_verdict ?? 'N/A'}`
    );
    lines.push(
      `- Drift Severity: ${snapshot.readiness_projection.drift_severity ?? 'N/A'}`
    );
    lines.push(
      `- Re-Readiness Required: ${snapshot.readiness_projection.re_readiness_required ? 'yes' : 'no'}`
    );
    lines.push(
      `- Drift Signals: ${
        snapshot.readiness_projection.drift_signals.length > 0
          ? snapshot.readiness_projection.drift_signals.join(', ')
          : 'N/A'
      }`
    );
    lines.push(
      `- Drifted Dimensions: ${
        snapshot.readiness_projection.drifted_dimensions.length > 0
          ? snapshot.readiness_projection.drifted_dimensions.join(', ')
          : 'N/A'
      }`
    );
    lines.push(
      `- Blocking Reason: ${snapshot.readiness_projection.blocking_reason ?? 'N/A'}`
    );
  }
  lines.push('');
  lines.push('## SFT Builder Summary');
  lines.push('');
  lines.push(`- Total Candidates: ${snapshot.sft_summary.total_candidates}`);
  lines.push(`- Accepted: ${snapshot.sft_summary.accepted}`);
  lines.push(`- Rejected: ${snapshot.sft_summary.rejected}`);
  lines.push(`- Downgraded: ${snapshot.sft_summary.downgraded}`);
  lines.push(`- Redaction Clean: ${snapshot.sft_summary.redaction_status_counts.clean}`);
  lines.push(`- Redaction Redacted: ${snapshot.sft_summary.redaction_status_counts.redacted}`);
  lines.push(`- Redaction Blocked: ${snapshot.sft_summary.redaction_status_counts.blocked}`);
  if (snapshot.sft_summary.redaction_applied_rules.length > 0) {
    lines.push(
      `- Redaction Rules: ${snapshot.sft_summary.redaction_applied_rules
        .map((entry) => `${entry.rule}(${entry.count})`)
        .join(', ')}`
    );
  }
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
