import {
  assertValidModelGovernanceHintCandidate,
  type ModelGovernanceHintCandidate,
  type ModelGovernanceProviderMode,
} from './model-governance-hints-schema';

export interface ResolveModelGovernanceHintInput {
  promptText: string;
  stageContextKnown: boolean;
  gateFailureExists: boolean;
  blockerOwnershipLocked: boolean;
  rootTargetLocked: boolean;
  equivalentAdapterCount: number;
}

export interface ModelGovernanceHintProvider {
  id: string;
  mode: ModelGovernanceProviderMode;
  resolve(
    input: ResolveModelGovernanceHintInput
  ): ModelGovernanceHintCandidate | null | Promise<ModelGovernanceHintCandidate | null>;
}

export async function resolveModelGovernanceHintCandidate(
  input: ResolveModelGovernanceHintInput,
  provider: ModelGovernanceHintProvider
): Promise<ModelGovernanceHintCandidate | null> {
  const candidate = await Promise.resolve(provider.resolve(input));
  if (!candidate) {
    return null;
  }

  assertValidModelGovernanceHintCandidate(candidate);
  if (candidate.providerId !== provider.id) {
    throw new Error(
      `Model governance provider mismatch: candidate=${candidate.providerId}, provider=${provider.id}`
    );
  }
  if (candidate.providerMode !== provider.mode) {
    throw new Error(
      `Model governance provider mode mismatch: candidate=${candidate.providerMode}, provider=${provider.mode}`
    );
  }
  return candidate;
}

export function createStubModelGovernanceHintProvider(
  candidate: ModelGovernanceHintCandidate | null,
  id = 'stub-model-governance-provider'
): ModelGovernanceHintProvider {
  return {
    id,
    mode: 'stub',
    resolve() {
      if (!candidate) {
        return null;
      }
      return {
        ...candidate,
        providerId: id,
        providerMode: 'stub',
      };
    },
  };
}
