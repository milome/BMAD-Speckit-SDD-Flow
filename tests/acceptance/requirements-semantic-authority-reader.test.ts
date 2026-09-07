import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { scanRequirementsContractConsumerAuthority } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-consumer-authority-scanner';
import { compileRequirementsTypedSourceCandidate } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-typed-source-compiler';
import { readRequirementsContractSemanticIrAuthority } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-semantic-ir-reader';
import { validateRequirementsContractSemanticIr } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-semantic-ir';
import { stableStringify } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-semantic-resolver';
import { createFullSourceBundle, hash, SOURCE_HASH } from '../helpers/source-authority-full-source';

describe('full-source persisted Requirements semantic authority, test-only without user confirmation or Judge', () => {
  let fixture: ReturnType<typeof createFullSourceBundle>;
  let compiled: ReturnType<typeof compileRequirementsTypedSourceCandidate>;
  let compilationError: unknown;
  function compileFixture() {
    if (compilationError) throw compilationError;
    if (compiled) return compiled;
    try {
      fixture = createFullSourceBundle();
      const scan = scanRequirementsContractConsumerAuthority({ cwd: fixture.root,
        intakeSource: fixture.intakeSource, authoritySources: fixture.authoritySources });
      compiled = compileRequirementsTypedSourceCandidate({ scan,
        authoringRequestId: 'TEST-ONLY-AUTHORITY-READER', authoringAttemptId: 'TEST-ONLY-READER-ATTEMPT' });
      return compiled;
    } catch (error) {
      compilationError = error;
      throw error;
    }
  }
  afterAll(() => { if (fixture) rmSync(fixture.root, { recursive: true, force: true }); });

  it('loads the actual bounded candidate file as the complete expanded semantic model', () => {
    compileFixture();
    const candidatePath = path.join(fixture.root, 'test-only-semantic-candidate.json');
    const bytes = `${stableStringify(compiled.semanticIrAuthority)}\n`;
    expect(Buffer.byteLength(bytes)).toBeLessThanOrEqual(1048576);
    writeFileSync(candidatePath, bytes, 'utf8');
    const restored = readRequirementsContractSemanticIrAuthority(candidatePath);
    expect(validateRequirementsContractSemanticIr(restored).decision).toBe('pass');
    expect(hash(stableStringify(restored))).toBe(hash(stableStringify(compiled.semanticIr)));
    expect(hash(readFileSync(path.join(fixture.root, 'inputs/raw-source.md')))).toBe(SOURCE_HASH);
  }, 300_000);

  it.each(['missing-dictionary', 'changed-hash', 'expanded-v2'])(
    'rejects %s instead of exposing partial semanticPayload to confirmation consumers', (damage) => {
      compileFixture();
      const candidate: Record<string, unknown> = JSON.parse(stableStringify(compiled.semanticIrAuthority));
      if (damage === 'missing-dictionary') delete candidate.semanticIr;
      if (damage === 'changed-hash') candidate.candidateHash = `sha256:${'0'.repeat(64)}`;
      const candidatePath = path.join(fixture.root, `test-only-${damage}.json`);
      writeFileSync(candidatePath, stableStringify(damage === 'expanded-v2' ? compiled.semanticIr : candidate), 'utf8');
      expect(() => readRequirementsContractSemanticIrAuthority(candidatePath)).toThrow();
    });
});
