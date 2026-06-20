import * as fs from 'node:fs';
import * as path from 'node:path';
import * as yaml from 'js-yaml';

export interface AdaptiveIntakeGovernanceConfig {
  gateName: string;
  appliesToFlows: Array<'story' | 'bugfix' | 'standalone_tasks'>;
  matchScoring: {
    domainFit: number;
    dependencyFit: number;
    sprintFit: number;
    riskFit: number;
    readinessFit: number;
  };
  decisionThresholds: {
    minConfidenceForAutoMatch: number;
    minConfidenceForWarn: number;
  };
}

export interface OrchestrationGovernanceContract {
  mappingContract: {
    requiredFields: string[];
    consistencyRules: string[];
  };
  adaptiveIntakeGovernanceGate: AdaptiveIntakeGovernanceConfig;
}

interface RawGovernanceContract {
  mapping_contract?: {
    required_fields?: string[];
    consistency_rules?: string[];
  };
  adaptive_intake_governance_gate?: {
    gate_name?: string;
    applies_to_flows?: Array<'story' | 'bugfix' | 'standalone_tasks'>;
    match_scoring?: {
      domain_fit?: number;
      dependency_fit?: number;
      sprint_fit?: number;
      risk_fit?: number;
      readiness_fit?: number;
    };
    decision_thresholds?: {
      min_confidence_for_auto_match?: number;
      min_confidence_for_warn?: number;
    };
  };
}

export function orchestrationGovernanceContractPath(projectRoot: string): string {
  return path.join(projectRoot, '_bmad', '_config', 'orchestration-governance.contract.yaml');
}

export function readOrchestrationGovernanceContract(
  projectRoot: string
): OrchestrationGovernanceContract {
  const file = orchestrationGovernanceContractPath(projectRoot);
  const parsed = yaml.load(fs.readFileSync(file, 'utf8')) as RawGovernanceContract | null;
  const gate = parsed?.adaptive_intake_governance_gate;
  const scoring = gate?.match_scoring;
  const thresholds = gate?.decision_thresholds;

  if (!gate || !scoring || !thresholds) {
    throw new Error(`adaptive intake governance gate missing in contract: ${file}`);
  }

  return {
    mappingContract: {
      requiredFields: parsed?.mapping_contract?.required_fields ?? [],
      consistencyRules: parsed?.mapping_contract?.consistency_rules ?? [],
    },
    adaptiveIntakeGovernanceGate: {
      gateName: gate.gate_name ?? 'adaptive_intake_governance_gate',
      appliesToFlows: gate.applies_to_flows ?? ['story', 'bugfix', 'standalone_tasks'],
      matchScoring: {
        domainFit: scoring.domain_fit ?? 0,
        dependencyFit: scoring.dependency_fit ?? 0,
        sprintFit: scoring.sprint_fit ?? 0,
        riskFit: scoring.risk_fit ?? 0,
        readinessFit: scoring.readiness_fit ?? 0,
      },
      decisionThresholds: {
        minConfidenceForAutoMatch: thresholds.min_confidence_for_auto_match ?? 0.7,
        minConfidenceForWarn: thresholds.min_confidence_for_warn ?? 0.55,
      },
    },
  };
}
