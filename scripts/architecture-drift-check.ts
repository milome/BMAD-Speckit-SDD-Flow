/* eslint-disable no-console */
import * as fs from 'node:fs';
import * as path from 'node:path';

const REQUIRED_INVARIANTS = [
  {
    id: 'single-main-control-plane',
    terms: ['main-agent', 'control plane', 'CP0 -> CP1 -> CP2 -> CP3 -> CP4 -> CP5 -> CP6'],
  },
  {
    id: 'governance-support-layer',
    terms: ['governance', 'contract', 'user_story_mapping'],
  },
  {
    id: 'closeout-source-of-truth',
    terms: ['closeout', 'release-gate', 'single-source'],
  },
];

export function runArchitectureDriftCheck(root: string): { passed: boolean; failures: string[] } {
  const adrPath = path.join(root, 'docs/design/2026-04-24-orchestration-recommended-architecture-adr.md');
  const tasksPath = path.join(root, 'docs/plans/TASKS_v1.md');
  if (!fs.existsSync(adrPath) || !fs.existsSync(tasksPath)) {
    return { passed: true, failures: [] };
  }
  const source = `${fs.readFileSync(adrPath, 'utf8')}\n${fs.readFileSync(tasksPath, 'utf8')}`;
  const failures = REQUIRED_INVARIANTS.flatMap((invariant) =>
    invariant.terms
      .filter((term) => !source.includes(term))
      .map((term) => `${invariant.id}: missing ${term}`)
  );
  return { passed: failures.length === 0, failures };
}

export function main(argv: string[]): number {
  const cwdIndex = argv.indexOf('--cwd');
  const root = cwdIndex >= 0 && argv[cwdIndex + 1] ? path.resolve(argv[cwdIndex + 1]) : process.cwd();
  const result = runArchitectureDriftCheck(root);
  console.log(JSON.stringify(result, null, 2));
  return result.passed ? 0 : 1;
}

if (require.main === module) {
  process.exitCode = main(process.argv.slice(2));
}
