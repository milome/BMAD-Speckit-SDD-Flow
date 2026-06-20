"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.stableStringify = exports.sha256Json = exports.profileHashFor = void 0;
exports.resolveCriticalAuditorProfile = resolveCriticalAuditorProfile;
exports.stageProfileForCallPoint = stageProfileForCallPoint;
exports.validateCriticalAuditorProfileForStage = validateCriticalAuditorProfileForStage;
const load_critical_auditor_profile_1 = require("../_bmad/shared/critical-auditor-profile/load-critical-auditor-profile");
Object.defineProperty(exports, "profileHashFor", { enumerable: true, get: function () { return load_critical_auditor_profile_1.profileHashFor; } });
Object.defineProperty(exports, "sha256Json", { enumerable: true, get: function () { return load_critical_auditor_profile_1.sha256Json; } });
Object.defineProperty(exports, "stableStringify", { enumerable: true, get: function () { return load_critical_auditor_profile_1.stableStringify; } });
const validate_critical_auditor_profile_1 = require("../_bmad/shared/critical-auditor-profile/validate-critical-auditor-profile");
function resolveCriticalAuditorProfile(projectRoot = process.cwd()) {
    return (0, load_critical_auditor_profile_1.loadCriticalAuditorProfile)(projectRoot);
}
function stageProfileForCallPoint(callPoint) {
    switch (callPoint) {
        case 'implementation_readiness':
        case 'readiness_blocker_classification':
            return 'implementation_readiness';
        case 'execution_closure_evidence':
        case 'audit_review':
        case 'audit_scoring_materialization':
            return 'post_implementation_code_audit';
        case 'delivery_confirmation':
            return 'delivery_confirmation';
        case 'requirements_compiler':
        case 'must_atomic_decomposition':
        case 'packet_source_reconciliation':
        case 'compiler_projection':
        case 'goal_execution_contract':
        case 'docs_review':
        case 'grill_with_docs':
        default:
            return 'requirements_compiler';
    }
}
function validateCriticalAuditorProfileForStage(input) {
    return (0, validate_critical_auditor_profile_1.validateCriticalAuditorProfileForStage)(input);
}
