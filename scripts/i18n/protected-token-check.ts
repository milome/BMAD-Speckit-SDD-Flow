export interface ProtectedTokenManifest {
  control?: {
    protected_tokens?: string[];
    placeholders?: Record<string, string>;
  };
  anchors?: Record<string, string>;
}

export interface ProtectedTokenCheckResult {
  valid: boolean;
  errors: string[];
}

export function collectProtectedTokens(manifest: ProtectedTokenManifest): string[] {
  const tokens = new Set<string>();

  for (const token of manifest.control?.protected_tokens ?? []) {
    tokens.add(token);
  }

  for (const anchor of Object.values(manifest.anchors ?? {})) {
    tokens.add(anchor);
  }

  return [...tokens];
}

export function assertProtectedTokensPreserved(
  protectedTokens: string[],
  renderedOutputs: string[]
): ProtectedTokenCheckResult {
  const errors: string[] = [];
  const joinedOutput = renderedOutputs.join('\n');

  for (const token of protectedTokens) {
    if (!joinedOutput.includes(token)) {
      errors.push(`Protected token missing from output: ${token}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
