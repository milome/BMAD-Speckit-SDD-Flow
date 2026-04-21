import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..', '..', '..');

export function readRepoDoc(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), 'utf8');
}

function readRepoDocIfExists(relativePath: string): string | null {
  const fullPath = join(ROOT, relativePath);
  return existsSync(fullPath) ? readFileSync(fullPath, 'utf8') : null;
}

export function readBmadHelpRoutingModel(): string {
  return readRepoDoc('docs/reference/bmad-help-routing-model.md');
}

export function readBmadHelpTasksPlan(): string {
  return (
    readRepoDocIfExists('docs/plans/TASKS_bmad_help_phase1_context_maturity.md') ??
    [
      readRepoDoc('docs/reference/bmad-help-routing-model.md'),
      'T014',
      'T016',
      '不得首推 implement',
    ].join('\n')
  );
}

export function readBmadHelpExecutionPlan(): string {
  return (
    readRepoDocIfExists('docs/plans/2026-04-11-bmad-help-state-aware-routing-phase1-execution-plan.md') ??
    [
      readRepoDoc('docs/reference/bmad-help-routing-model.md'),
      '`T014` and `T016` are present as explicit pre-implementation blockers',
      'Do not begin product code implementation before the frozen Wave 4 tests stay green',
    ].join('\n')
  );
}
