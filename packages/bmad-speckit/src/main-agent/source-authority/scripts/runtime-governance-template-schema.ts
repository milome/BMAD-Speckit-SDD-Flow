/**
 * JSON Schema validation for entries under `runtime-policy-templates.yaml` `templates`.
 * Only whitelisted `RuntimePolicy` fields may appear (not `flow` / `stage`).
 * `triggerStage` / `scoringEnabled` are excluded: they must stay aligned with
 * `stage-mapping.yaml` + `scoringEnabledForTriggerStage` (A.7 二选一：禁止模板覆盖 trigger 链).
 */
import Ajv from 'ajv';

const ajv = new Ajv({ allErrors: true, strict: true, allowUnionTypes: true });

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
} as const;

const validatePatch = ajv.compile(runtimePolicyTemplatePatchSchema);

export function assertValidRuntimePolicyTemplatePatch(patch: unknown, templateId: string): void {
  if (!validatePatch(patch)) {
    throw new Error(
      `Invalid runtime policy template "${templateId}": ${ajv.errorsText(validatePatch.errors, { separator: '; ' })}`
    );
  }
}

export interface RuntimePolicyTemplatesFile {
  version: string;
  templates: Record<string, Record<string, unknown>>;
}

export function parseRuntimePolicyTemplatesYaml(raw: unknown): RuntimePolicyTemplatesFile {
  if (!raw || typeof raw !== 'object') {
    throw new Error('runtime-policy-templates.yaml: expected object root');
  }
  const o = raw as Record<string, unknown>;
  if (typeof o.version !== 'string') {
    throw new Error('runtime-policy-templates.yaml: missing string version');
  }
  if (!o.templates || typeof o.templates !== 'object') {
    throw new Error('runtime-policy-templates.yaml: missing templates map');
  }
  const templates = o.templates as Record<string, unknown>;
  for (const [id, patch] of Object.entries(templates)) {
    assertValidRuntimePolicyTemplatePatch(patch, id);
  }
  return {
    version: o.version,
    templates: templates as Record<string, Record<string, unknown>>,
  };
}
