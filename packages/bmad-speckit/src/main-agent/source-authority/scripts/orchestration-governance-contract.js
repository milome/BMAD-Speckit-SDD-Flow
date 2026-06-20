"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.orchestrationGovernanceContractPath = orchestrationGovernanceContractPath;
exports.readOrchestrationGovernanceContract = readOrchestrationGovernanceContract;
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const yaml = __importStar(require("js-yaml"));
function orchestrationGovernanceContractPath(projectRoot) {
    return path.join(projectRoot, '_bmad', '_config', 'orchestration-governance.contract.yaml');
}
function readOrchestrationGovernanceContract(projectRoot) {
    const file = orchestrationGovernanceContractPath(projectRoot);
    const parsed = yaml.load(fs.readFileSync(file, 'utf8'));
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
