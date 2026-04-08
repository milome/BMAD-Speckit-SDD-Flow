import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import yaml from 'js-yaml';

const ROOT = join(import.meta.dirname, '..', '..');

export const FOUR_SIGNAL_KEYS = [
  'p0_journey',
  'smoke_e2e',
  'evidence_proof',
  'traceability',
] as const;

export type GateRule = {
  required_keywords?: Record<string, string[]>;
};

export type GateStep = {
  gate_rules?: GateRule[];
};

export type GateSet = {
  workflow_keys?: string[];
  runtime?: { gate?: string };
  steps?: Record<string, GateStep>;
};

export type ArchitectureGateConfig = {
  gate_sets?: Record<string, GateSet>;
};

export type ContinueGateRoutingConfig = {
  routes?: Array<{
    workflow: string;
    aliases?: string[];
    steps?: Record<string, string>;
  }>;
};

export type GovernedRoutingStage = {
  workflow: string;
  step: string;
  rerunGate: string;
  gateSet: string;
  runtimeGate: string;
};

export function loadArchitectureGateConfig(): ArchitectureGateConfig {
  return yaml.load(
    readFileSync(join(ROOT, '_bmad', '_config', 'architecture-gates.yaml'), 'utf8')
  ) as ArchitectureGateConfig;
}

export function loadContinueGateRoutingConfig(): ContinueGateRoutingConfig {
  return yaml.load(
    readFileSync(join(ROOT, '_bmad', '_config', 'continue-gate-routing.yaml'), 'utf8')
  ) as ContinueGateRoutingConfig;
}

export function hasFourSignalKeywords(rule: GateRule | undefined): boolean {
  const keys = Object.keys(rule?.required_keywords ?? {});
  return FOUR_SIGNAL_KEYS.every((key) => keys.includes(key));
}

export function enumerateGovernedRoutingIntersection(): string[] {
  return enumerateGovernedRoutingStages().map((entry) => `${entry.workflow}/${entry.step}`);
}

export function enumerateGovernedRoutingStages(): GovernedRoutingStage[] {
  const routing = loadContinueGateRoutingConfig();
  const gates = loadArchitectureGateConfig();

  const byWorkflow = new Map<string, { gateSet: string; runtimeGate: string }>();
  for (const [gateSetKey, gateSet] of Object.entries(gates.gate_sets ?? {})) {
    for (const workflowKey of gateSet.workflow_keys ?? []) {
      byWorkflow.set(workflowKey, {
        gateSet: gateSetKey,
        runtimeGate: gateSet.runtime?.gate ?? gateSetKey,
      });
    }
  }

  const stages: GovernedRoutingStage[] = [];
  for (const route of routing.routes ?? []) {
    const workflowKeys = [route.workflow, ...(route.aliases ?? [])];
    const matchedWorkflow = workflowKeys
      .map((workflowKey) => ({ workflowKey, meta: byWorkflow.get(workflowKey) }))
      .find((entry) => entry.meta != null);

    if (!matchedWorkflow?.meta || !route.steps) {
      continue;
    }

    for (const [step, rerunGate] of Object.entries(route.steps)) {
      stages.push({
        workflow: route.workflow,
        step,
        rerunGate,
        gateSet: matchedWorkflow.meta.gateSet,
        runtimeGate: matchedWorkflow.meta.runtimeGate,
      });
    }
  }

  return stages.sort((left, right) => `${left.workflow}/${left.step}`.localeCompare(`${right.workflow}/${right.step}`));
}
