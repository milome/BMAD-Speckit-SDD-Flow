import {
  compileRequirementsContractRequirementsScope,
  type RequirementsContractJsonRecord,
  type RequirementsContractRequirementsScope,
} from './requirements-contract-requirements-scope-compiler';
import {
  assertRequirementsContractJudgeInvocationReadiness,
  type RequirementsContractJudgeInvocationReadinessReceipt,
} from './requirements-contract-judge-invocation-readiness-gate';
import { canonicalJson, sha256 } from './requirements-contract-governed-write';

function text(value: unknown, code: string): string {
  if (typeof value !== 'string' || value.length === 0) throw new Error(code);
  return value;
}

export { compileRequirementsContractRequirementsScope };

export interface RequirementsContractRequirementsInvocationInput {
  schemaVersion: 'requirements-contract-requirements-invocation-input/v1';
  role: 'requirements';
  outputDir: string;
  systemPrompt: string;
  structuredOutputSchema: RequirementsContractJsonRecord;
  readinessReceiptHash: string;
  requestHash: string;
  request: {
    schemaVersion: 'requirements-contract-requirements-judge-request/v1';
    role: 'requirements';
    sourceDocument: string;
    sourceBytesHash: string;
    sourceDocumentHash: string;
    semanticModelHash: string;
    projectionSetHash: string;
    scopeHash: string;
    mustRefs: string[];
    sourceRequirementTexts: string[];
    projectionRefs: string[];
    packetProjectionSummary: RequirementsContractRequirementsScope['packetProjectionSummary'];
  };
}

export function buildRequirementsContractRequirementsInvocationInput(input: {
  scope: RequirementsContractRequirementsScope | RequirementsContractJsonRecord;
  readinessReceipt:
    | RequirementsContractJudgeInvocationReadinessReceipt
    | RequirementsContractJsonRecord;
  systemPrompt: string;
  structuredOutputSchema: RequirementsContractJsonRecord;
  outputDir: string;
}): RequirementsContractRequirementsInvocationInput {
  const readinessReceipt = assertRequirementsContractJudgeInvocationReadiness({
    readinessReceipt: input.readinessReceipt as RequirementsContractJsonRecord,
    scope: input.scope as RequirementsContractJsonRecord,
    providerInvocationCount: 0,
  });
  const scope = input.scope as RequirementsContractRequirementsScope;
  const request = {
    schemaVersion: 'requirements-contract-requirements-judge-request/v1' as const,
    role: 'requirements' as const,
    sourceDocument: text(
      scope.sourceDocument,
      'requirements_contract_requirements_invocation_source_missing'
    ),
    sourceBytesHash: text(
      scope.sourceBytesHash,
      'requirements_contract_requirements_invocation_source_bytes_hash_missing'
    ),
    sourceDocumentHash: readinessReceipt.sourceDocumentHash,
    semanticModelHash: readinessReceipt.semanticModelHash,
    projectionSetHash: readinessReceipt.projectionSetHash,
    scopeHash: readinessReceipt.scopeHash,
    mustRefs: [...scope.mustRefs],
    sourceRequirementTexts: [...scope.sourceRequirementTexts],
    projectionRefs: [...scope.projectionRefs],
    packetProjectionSummary: scope.packetProjectionSummary,
  };
  const requestHash = sha256(canonicalJson(request));
  return {
    schemaVersion: 'requirements-contract-requirements-invocation-input/v1',
    role: 'requirements',
    outputDir: text(
      input.outputDir,
      'requirements_contract_requirements_invocation_output_missing'
    ),
    systemPrompt: text(
      input.systemPrompt,
      'requirements_contract_requirements_invocation_prompt_missing'
    ),
    structuredOutputSchema: input.structuredOutputSchema,
    readinessReceiptHash: readinessReceipt.readinessHash,
    requestHash,
    request,
  };
}
