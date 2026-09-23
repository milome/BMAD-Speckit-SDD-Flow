import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  auditProviderRunHash,
  buildAuditTriadJudgeRuntimeBinding,
  validateAuditProviderEvidence,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-judge-provider-independence';

const ROOT = process.cwd();
const SCRIPT_ROOT = path.join(
  ROOT,
  'packages/bmad-speckit/src/main-agent/source-authority/scripts'
);

describe('neutral audit provider independence hard cut', () => {
  it('exports only the neutral audit provider surface from the neutral module path', () => {
    expect(typeof auditProviderRunHash).toBe('function');
    expect(typeof buildAuditTriadJudgeRuntimeBinding).toBe('function');
    expect(typeof validateAuditProviderEvidence).toBe('function');
    expect(
      existsSync(path.join(SCRIPT_ROOT, 'requirements-contract-critical-auditor-independence.ts'))
    ).toBe(false);
  });

  it('removes the generic legacy protocol identifiers from source authority', () => {
    const sourceFiles = [
      'requirements-contract-judge-provider-independence.ts',
      'audit-triad-orchestrator.ts',
      'orchestration-dispatch-contract.ts',
      'audit-triad-producer-artifact-validator.ts',
      'main-agent-orchestration.ts',
    ];
    const source = sourceFiles
      .map((file) => readFileSync(path.join(SCRIPT_ROOT, file), 'utf8'))
      .join('\n');

    expect(source).not.toContain('CriticalAuditorIndependentProvider');
    expect(source).not.toContain('CriticalAuditorJudgeRuntimeBinding');
    expect(source).not.toContain('critical-auditor-judge-invocation-receipt');
  });
});
