export interface SelectedAITargetValidation {
  valid: boolean;
  missing: string[];
}

export function checkCommand(argv?: string[]): void;
export function validateSelectedAITargets(
  cwd: string,
  selectedAI?: string
): SelectedAITargetValidation;
