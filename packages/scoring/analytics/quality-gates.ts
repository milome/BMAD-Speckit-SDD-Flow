import type { CanonicalSftSample, ExportDecision } from './types';

export interface QualityGateOptions {
  minScore?: number;
  maxIterations?: number;
  maxTokens?: number;
  requireCodePair?: boolean;
}

function hasUserAndAssistantMessages(sample: CanonicalSftSample): boolean {
  const hasUser = sample.messages.some((message) => message.role === 'user');
  const hasAssistant = sample.messages.some((message) => message.role === 'assistant');
  return hasUser && hasAssistant;
}

function hasAssistantTarget(sample: CanonicalSftSample): boolean {
  return sample.messages.some(
    (message) => message.role === 'assistant' && String(message.content).trim().length > 0
  );
}

function usesTooling(sample: CanonicalSftSample): boolean {
  return (
    Boolean(sample.tools && sample.tools.length > 0) ||
    sample.messages.some(
      (message) =>
        message.role === 'tool' ||
        Boolean(message.tool_calls && message.tool_calls.length > 0)
    )
  );
}

function withCompatibility(
  compatible: boolean,
  reasons: string[],
  warnings: string[]
): ExportDecision {
  return {
    compatible,
    reasons,
    warnings,
  };
}

function unique(items: string[]): string[] {
  return [...new Set(items)];
}

function hasUnresolvedFinding(
  sample: CanonicalSftSample,
  matcher: (kind: string) => boolean
): boolean {
  return sample.redaction.findings.some(
    (finding) => matcher(finding.kind) && finding.action !== 'redact'
  );
}

export function applyQualityGates(
  sample: CanonicalSftSample,
  options: QualityGateOptions = {}
): CanonicalSftSample {
  const minScore = options.minScore ?? 90;
  const maxIterations = options.maxIterations ?? 3;
  const maxTokens = options.maxTokens ?? 8192;
  const requireCodePair = options.requireCodePair ?? false;

  const hardReasons: string[] = [];
  const softReasons: string[] = [];
  const warnings = [...sample.quality.warnings];

  if (
    !sample.provenance.base_commit_hash ||
    !sample.provenance.content_hash ||
    !sample.provenance.source_hash
  ) {
    hardReasons.push('prov_missing_hash');
  }
  if (!sample.provenance.source_path) {
    hardReasons.push('prov_missing_source_artifact');
  }
  if (!hasUserAndAssistantMessages(sample)) {
    hardReasons.push('missing_messages');
  }
  if (!hasAssistantTarget(sample)) {
    hardReasons.push('missing_assistant_target');
  }
  if ((sample.quality.phase_score ?? 0) < minScore) {
    hardReasons.push('score_below_floor');
  }
  if (sample.quality.veto_triggered) {
    hardReasons.push('veto_triggered');
  }
  if (sample.quality.token_estimate > maxTokens) {
    hardReasons.push('token_over_limit');
  }
  if (sample.redaction.status === 'blocked') {
    hardReasons.push('redaction_blocked');
    if (hasUnresolvedFinding(sample, (kind) => kind.includes('secret') || kind.includes('private'))) {
      hardReasons.push('secret_detected_unresolved');
    }
    if (hasUnresolvedFinding(sample, (kind) => kind.includes('pii'))) {
      hardReasons.push('pii_detected_unresolved');
    }
  }

  if (sample.quality.iteration_count > maxIterations) {
    softReasons.push('too_many_iterations');
  }
  if (!sample.quality.has_code_pair) {
    if (requireCodePair) {
      hardReasons.push('missing_code_pair');
    } else {
      softReasons.push('missing_code_pair');
    }
  }
  if (sample.redaction.status === 'redacted') {
    warnings.push('warning_redacted_noncritical');
  }

  const rejectionReasons = unique([...hardReasons, ...softReasons]);
  const acceptanceDecision =
    hardReasons.length > 0 ? 'rejected' : softReasons.length > 0 ? 'downgraded' : 'accepted';

  const sharedWarnings = unique(warnings);
  const sharedHardReasons = unique(hardReasons);
  const toolAware = usesTooling(sample);

  return {
    ...sample,
    quality: {
      ...sample.quality,
      acceptance_decision: acceptanceDecision,
      rejection_reasons: rejectionReasons,
      warnings: sharedWarnings,
    },
    export_compatibility: {
      openai_chat: withCompatibility(sharedHardReasons.length === 0, sharedHardReasons, sharedWarnings),
      hf_conversational: toolAware
        ? withCompatibility(
            false,
            unique([...sharedHardReasons, 'target_incompatible_hf_conversational']),
            sharedWarnings
          )
        : withCompatibility(sharedHardReasons.length === 0, sharedHardReasons, sharedWarnings),
      hf_tool_calling: sample.tools && sample.tools.length > 0
        ? withCompatibility(sharedHardReasons.length === 0, sharedHardReasons, sharedWarnings)
        : withCompatibility(
            false,
            unique([...sharedHardReasons, 'target_incompatible_hf_tool_calling']),
            sharedWarnings
          ),
    },
  };
}
