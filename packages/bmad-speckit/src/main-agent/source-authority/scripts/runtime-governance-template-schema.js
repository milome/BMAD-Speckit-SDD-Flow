"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertValidRuntimePolicyTemplatePatch = assertValidRuntimePolicyTemplatePatch;
exports.parseRuntimePolicyTemplatesYaml = parseRuntimePolicyTemplatesYaml;
/**
 * JSON Schema validation for entries under `runtime-policy-templates.yaml` `templates`.
 * Only whitelisted `RuntimePolicy` fields may appear (not `flow` / `stage`).
 * `triggerStage` / `scoringEnabled` are excluded: they must stay aligned with
 * `stage-mapping.yaml` + `scoringEnabledForTriggerStage` (A.7 二选一：禁止模板覆盖 trigger 链).
 */
const ajv_1 = __importDefault(require("ajv"));
const ajv = new ajv_1.default({ allErrors: true, strict: true, allowUnionTypes: true });
const runtimePolicyTemplatePatchSchema = {
    type: 'object',
    additionalProperties: false,
    properties: {
        auditRequired: { type: 'boolean' },
        validationLevel: {
            anyOf: [
                { type: 'string', enum: ['basic', 'test_only', 'full_validation'] },
                { type: 'null' },
            ],
        },
        strictness: { type: 'string', enum: ['strict', 'standard'] },
        generateDoc: { type: 'boolean' },
        skipAllowed: { type: 'boolean' },
        convergence: { type: 'object', additionalProperties: true },
        mandatoryGate: { type: 'boolean' },
        granularityGoverned: { type: 'boolean' },
    },
};
const validatePatch = ajv.compile(runtimePolicyTemplatePatchSchema);
function assertValidRuntimePolicyTemplatePatch(patch, templateId) {
    if (!validatePatch(patch)) {
        throw new Error(`Invalid runtime policy template "${templateId}": ${ajv.errorsText(validatePatch.errors, { separator: '; ' })}`);
    }
}
function parseRuntimePolicyTemplatesYaml(raw) {
    if (!raw || typeof raw !== 'object') {
        throw new Error('runtime-policy-templates.yaml: expected object root');
    }
    const o = raw;
    if (typeof o.version !== 'string') {
        throw new Error('runtime-policy-templates.yaml: missing string version');
    }
    if (!o.templates || typeof o.templates !== 'object') {
        throw new Error('runtime-policy-templates.yaml: missing templates map');
    }
    const templates = o.templates;
    for (const [id, patch] of Object.entries(templates)) {
        assertValidRuntimePolicyTemplatePatch(patch, id);
    }
    return {
        version: o.version,
        templates: templates,
    };
}
