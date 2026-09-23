import {
  createExecutionConstraintRegistry,
  validateExecutionConstraintRegistry,
  type RequirementsExecutionConstraint,
} from './requirements-contract-semantic-ir';

const SHA256 = /^sha256:[a-f0-9]{64}$/u;

export function validateRequirementsContractExecutionManifest(value: unknown) {
  const issueCodes: string[] = [];
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { decision: 'block' as const, issueCodes: ['execution_manifest_invalid'] };
  }
  const manifest = value as Record<string, unknown>;
  const allowed = new Set(['schemaVersion', 'semanticRevisionId', 'scopeSemanticHash', 'constraints']);
  if (Object.keys(manifest).some((key) => !allowed.has(key))) {
    issueCodes.push('execution_manifest_unknown_field');
  }
  if (
    !['requirements-contract-execution-manifest/v1', 'requirements-contract-execution-manifest/v2']
      .includes(String(manifest.schemaVersion)) ||
    typeof manifest.semanticRevisionId !== 'string' || !manifest.semanticRevisionId ||
    !SHA256.test(String(manifest.scopeSemanticHash)) ||
    !Array.isArray(manifest.constraints)
  ) {
    issueCodes.push('execution_manifest_invalid');
  }
  if (Array.isArray(manifest.constraints)) {
    const registry = createExecutionConstraintRegistry(
      manifest.constraints as RequirementsExecutionConstraint[]
    );
    issueCodes.push(...validateExecutionConstraintRegistry(registry).issueCodes);
  }
  return {
    decision: issueCodes.length ? 'block' as const : 'pass' as const,
    issueCodes: [...new Set(issueCodes)].sort(),
  };
}
