import { computeStringHash } from '../utils/hash';
import type { CanonicalMessage, CanonicalSftSample } from './types';

export interface DatasetDuplicateSummary {
  cluster_count: number;
  duplicate_cluster_count: number;
  duplicated_sample_count: number;
  largest_cluster_size: number;
  clusters: Array<{
    cluster_id: string;
    size: number;
  }>;
}

export interface DatasetBalanceSummary {
  by_host_kind: Record<string, number>;
  by_provider_id: Record<string, number>;
  by_stage: Record<string, number>;
  by_source_scope: Record<string, number>;
  by_sample_kind: Record<string, number>;
  by_split: Record<string, number>;
  by_target: Record<string, number>;
  dominant_host_kind_share: number;
  dominant_provider_share: number;
  dominant_stage_share: number;
  dominant_source_scope_share: number;
  dominant_sample_kind_share: number;
}

export interface DatasetTrainingViewSummary {
  assistant_only_ready: number;
  completion_only_ready: number;
  tool_calling_ready: number;
  schema_target_counts: Record<string, number>;
}

function normalizeText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function messageContentToText(content: CanonicalMessage['content']): string {
  if (typeof content === 'string') {
    return content;
  }
  return content.map((part) => part.text).join('\n');
}

function sampleFingerprint(sample: CanonicalSftSample): string {
  const userText = sample.messages
    .filter((message) => message.role === 'user')
    .map((message) => normalizeText(messageContentToText(message.content)))
    .join('\n');
  const assistantText = sample.messages
    .filter((message) => message.role === 'assistant')
    .map((message) => normalizeText(messageContentToText(message.content)))
    .join('\n');
  const toolNames = (sample.tools ?? []).map((tool) => tool.function.name).sort();
  return JSON.stringify({
    stage: sample.source.stage,
    sampleKind: sample.metadata.sample_kind ?? 'unknown',
    userText,
    assistantText,
    toolNames,
  });
}

function buildCountMap(values: string[]): Record<string, number> {
  const counts = new Map<string, number>();
  for (const value of values) {
    const key = value && value.trim() !== '' ? value : 'unknown';
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Object.fromEntries([...counts.entries()].sort((left, right) => left[0].localeCompare(right[0])));
}

function dominantShare(counts: Record<string, number>, total: number): number {
  if (total <= 0) {
    return 0;
  }
  const values = Object.values(counts);
  if (values.length === 0) {
    return 0;
  }
  return Number((Math.max(...values) / total).toFixed(4));
}

function hasAssistantTarget(sample: CanonicalSftSample): boolean {
  return sample.messages.some((message) => {
    if (message.role !== 'assistant') {
      return false;
    }
    const content = messageContentToText(message.content).trim();
    return content.length > 0;
  });
}

function usesTooling(sample: CanonicalSftSample): boolean {
  return Boolean(sample.tools?.length) || sample.messages.some((message) => message.role === 'tool');
}

function normalizePath(value?: string | null): string {
  return String(value ?? '').replace(/\\/g, '/').toLowerCase();
}

function resolveSourceScope(sample: CanonicalSftSample): 'story_scoped' | 'orphan_scoped' | 'unknown' {
  const flow = String(sample.source.flow ?? '').trim().toLowerCase();
  if (flow === 'story' || flow === 'epic') {
    return 'story_scoped';
  }
  if (flow === 'bugfix' || flow === 'standalone_tasks') {
    return 'orphan_scoped';
  }

  const sourcePath = normalizePath(
    sample.provenance.source_path ?? sample.source.artifact_refs[0]?.path ?? null
  );
  if (
    sourcePath.includes('/_orphan/') ||
    /(?:^|\/)bugfix[_-]/i.test(sourcePath) ||
    sourcePath.includes('/standalone_tasks/')
  ) {
    return 'orphan_scoped';
  }
  if (
    /\/epic-[^/]+\/story-[^/]+/i.test(sourcePath) ||
    /\/specs\/epic-\d+\/story-\d+-/i.test(sourcePath) ||
    /(?:^|\/)story-\d+-/i.test(sourcePath)
  ) {
    return 'story_scoped';
  }
  return 'unknown';
}

export function assignDedupeClusters(samples: CanonicalSftSample[]): CanonicalSftSample[] {
  const groups = new Map<string, CanonicalSftSample[]>();
  for (const sample of samples) {
    const fingerprint = sampleFingerprint(sample);
    const clusterId = `dup-${computeStringHash(fingerprint).slice(0, 12)}`;
    if (!groups.has(clusterId)) {
      groups.set(clusterId, []);
    }
    groups.get(clusterId)!.push(sample);
  }

  return samples.map((sample) => {
    const fingerprint = sampleFingerprint(sample);
    const clusterId = `dup-${computeStringHash(fingerprint).slice(0, 12)}`;
    const clusterSize = groups.get(clusterId)?.length ?? 0;
    if (clusterSize <= 1) {
      return sample;
    }
    return {
      ...sample,
      quality: {
        ...sample.quality,
        dedupe_cluster_id: clusterId,
        warnings: [...new Set([...sample.quality.warnings, 'near_duplicate_clustered'])],
      },
    };
  });
}

export function buildDatasetDuplicateSummary(samples: CanonicalSftSample[]): DatasetDuplicateSummary {
  const clusterCounts = new Map<string, number>();
  for (const sample of samples) {
    const clusterId = sample.quality.dedupe_cluster_id;
    if (!clusterId) {
      continue;
    }
    clusterCounts.set(clusterId, (clusterCounts.get(clusterId) ?? 0) + 1);
  }

  const clusters = [...clusterCounts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([cluster_id, size]) => ({ cluster_id, size }));

  return {
    cluster_count: clusterCounts.size,
    duplicate_cluster_count: clusters.filter((cluster) => cluster.size > 1).length,
    duplicated_sample_count: clusters.reduce((sum, cluster) => sum + cluster.size, 0),
    largest_cluster_size: clusters[0]?.size ?? 0,
    clusters,
  };
}

export function buildDatasetBalanceSummary(samples: CanonicalSftSample[]): DatasetBalanceSummary {
  const total = samples.length;
  const by_host_kind = buildCountMap(samples.map((sample) => sample.metadata.host_kind ?? 'unknown'));
  const by_provider_id = buildCountMap(samples.map((sample) => sample.source.provider_id ?? 'unknown'));
  const by_stage = buildCountMap(samples.map((sample) => sample.source.stage));
  const by_source_scope = buildCountMap(samples.map((sample) => resolveSourceScope(sample)));
  const by_sample_kind = buildCountMap(samples.map((sample) => sample.metadata.sample_kind ?? 'unknown'));
  const by_split = buildCountMap(samples.map((sample) => sample.split.assignment));
  const by_target = buildCountMap(samples.flatMap((sample) => sample.metadata.schema_targets));

  return {
    by_host_kind,
    by_provider_id,
    by_stage,
    by_source_scope,
    by_sample_kind,
    by_split,
    by_target,
    dominant_host_kind_share: dominantShare(by_host_kind, total),
    dominant_provider_share: dominantShare(by_provider_id, total),
    dominant_stage_share: dominantShare(by_stage, total),
    dominant_source_scope_share: dominantShare(by_source_scope, total),
    dominant_sample_kind_share: dominantShare(by_sample_kind, total),
  };
}

export function buildDatasetTrainingViewSummary(samples: CanonicalSftSample[]): DatasetTrainingViewSummary {
  const readySamples = samples.filter(
    (sample) => sample.quality.acceptance_decision === 'accepted' && sample.quality.training_ready === true
  );

  return {
    assistant_only_ready: readySamples.filter((sample) => hasAssistantTarget(sample)).length,
    completion_only_ready: readySamples.filter(
      (sample) => hasAssistantTarget(sample) && !usesTooling(sample)
    ).length,
    tool_calling_ready: readySamples.filter((sample) => usesTooling(sample)).length,
    schema_target_counts: buildCountMap(samples.flatMap((sample) => sample.metadata.schema_targets)),
  };
}
