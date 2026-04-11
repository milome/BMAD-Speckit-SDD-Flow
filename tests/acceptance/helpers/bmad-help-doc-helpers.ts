import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..', '..', '..');

export function readRepoDoc(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), 'utf8');
}

export function readBmadHelpRoutingModel(): string {
  return readRepoDoc('docs/reference/bmad-help-routing-model.md');
}

export function readBmadHelpTasksPlan(): string {
  return readRepoDoc('docs/plans/TASKS_bmad_help_phase1_context_maturity.md');
}

export function readBmadHelpExecutionPlan(): string {
  return readRepoDoc(
    'docs/plans/2026-04-11-bmad-help-state-aware-routing-phase1-execution-plan.md'
  );
}
