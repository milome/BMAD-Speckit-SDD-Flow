import * as fs from 'node:fs';
import * as path from 'node:path';
import { expect } from 'vitest';

export const REQUIREMENT_PATH = path.join(
  process.cwd(),
  'docs',
  'requirements',
  '2026-05-29-main-agent-six-mental-model-production-orchestration-hardening.md'
);

export function readRequirementSource(): string {
  return fs.readFileSync(REQUIREMENT_PATH, 'utf8');
}

export function expectFragments(source: string, fragments: string[]): void {
  for (const fragment of fragments) {
    expect(source).toContain(fragment);
  }
}

export function expectIdSection(source: string, id: string, fragments: string[]): void {
  const start = source.indexOf(`- id: ${id}`);
  expect(start).toBeGreaterThanOrEqual(0);
  const next = source.indexOf('\n    - id:', start + 1);
  const section = source.slice(start, next > start ? next : undefined);
  expectFragments(section, fragments);
}
