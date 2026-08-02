import {
  type RequirementsContractSequenceContract,
  validateSequenceContract,
} from './requirements-contract-sequence-model';
import { sha256Stable } from './requirements-contract-semantic-resolver';

export type RequirementsContractSequenceCompilerInput = Omit<
  RequirementsContractSequenceContract,
  'schemaVersion' | 'sequenceContractHash'
>;

const SYNTHETIC_PARTICIPANT_LABELS = new Set([
  'agent',
  'gate',
  'record',
  'system',
  'user',
]);

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.freeze(value);
    for (const nested of Object.values(value as Record<string, unknown>)) {
      deepFreeze(nested);
    }
  }
  return value;
}

export function compileRequirementsContractSequenceContract(
  input: RequirementsContractSequenceCompilerInput
): RequirementsContractSequenceContract {
  const candidate = structuredClone(input);
  for (const scenario of candidate.sequenceScenarios) {
    for (const participant of scenario.participants) {
      if (SYNTHETIC_PARTICIPANT_LABELS.has(participant.label.trim().toLowerCase())) {
        throw new Error(`synthetic participant is forbidden: ${participant.label}`);
      }
    }
  }
  const preimage = {
    schemaVersion: 'requirements-contract-sequence-contract/v1' as const,
    ...candidate,
  };
  const contract: RequirementsContractSequenceContract = {
    ...preimage,
    sequenceContractHash: sha256Stable(preimage),
  };
  const validation = validateSequenceContract(contract);
  if (!validation.ok) {
    throw new Error(`Sequence Contract validation failed: ${JSON.stringify(validation.issues)}`);
  }
  return deepFreeze(contract);
}

export function validateRequirementsContractSequenceContractHash(
  contract: RequirementsContractSequenceContract
): boolean {
  const { sequenceContractHash, ...preimage } = contract;
  return sequenceContractHash === sha256Stable(preimage);
}
