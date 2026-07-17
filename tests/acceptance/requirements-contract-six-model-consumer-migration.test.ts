import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();

const FORBIDDEN_CONTROL_READS = [
  {
    path: 'packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-orchestration.ts',
    patterns: [
      /record\?\.sixModelResults/u,
      /input\.record\?\.sixModelResults/u,
      /sixModelResults\?\.\[currentMentalModel\]/u,
    ],
  },
  {
    path: 'packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-audit-review-gate.ts',
    patterns: [/nested\(nested\(record\.sixModelResults\)\[model\]\)/u],
  },
  {
    path: 'packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-delivery-closeout-gate.ts',
    patterns: [/nested\(record\.sixModelResults\)/u],
  },
  {
    path: 'packages/bmad-speckit/src/main-agent/source-authority/scripts/run-required-commands-from-ai-tdd-manifest.ts',
    patterns: [/nested\(nested\(record\.sixModelResults\)\.audit_review\)/u],
  },
] as const;

describe('requirements contract six-model consumer migration', () => {
  it('removes raw projection reads from every control and prerequisite consumer', () => {
    const findings = FORBIDDEN_CONTROL_READS.flatMap((entry) => {
      const source = readFileSync(path.join(ROOT, entry.path), 'utf8');
      return entry.patterns
        .filter((pattern) => pattern.test(source))
        .map((pattern) => `${entry.path}:${pattern.source}`);
    });

    expect(findings).toEqual([]);
  });

  it('keeps the verified facade as the only status authority implementation', () => {
    const facade = readFileSync(
      path.join(
        ROOT,
        'packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-runtime-status-authority-core.cjs'
      ),
      'utf8'
    );
    expect(facade).toContain('function resolveVerifiedSixModelStatus');
    expect(facade).toContain('runtime_status_projection_decision_mismatch');
    expect(facade).toContain('runtime_status_receipt_attempt_stale');
  });
});
