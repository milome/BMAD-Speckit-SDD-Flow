import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const DELIVERY_CLOSEOUT_FIXTURE_PATH = path.resolve(
  'tests/acceptance/main-agent-delivery-closeout-gate-record.test.ts'
);
const FIXTURE_AUTHORITY_DECLARATION = 'const CLOSEOUT_FIXTURE_IDS = Object.freeze({';
const COPIED_IDENTITIES = ['MUST-001', 'TRACE-001', 'EVD-001', 'CMD-DELIVERY', 'closeout-pass'];

function fixtureAuthorityViolations(source: string): string[] {
  const lines = source.split(/\r?\n/u);
  const violations = lines.flatMap((line, index) =>
    COPIED_IDENTITIES.filter((identity) => line.includes(identity)).map(
      (identity) => `${identity}@${index + 1}`
    )
  );
  violations.push(
    ...lines.flatMap((line, index) =>
      Array.from(line.matchAll(/['"](closeout-[a-z0-9-]+)['"]/gu), (match) => {
        return `${match[1]}@${index + 1}`;
      })
    )
  );

  const authorityStart = source.indexOf(FIXTURE_AUTHORITY_DECLARATION);
  const authorityEnd = source.indexOf('});', authorityStart);
  if (authorityStart < 0 || authorityEnd < authorityStart) {
    violations.push('fixture-authority@missing');
    return violations;
  }
  const outsideAuthority = `${source.slice(0, authorityStart)}${source.slice(authorityEnd + 3)}`;
  violations.push(
    ...outsideAuthority.split(/\r?\n/u).flatMap((line, index) => {
      if (line.trimStart().startsWith('function closeoutAttemptId(')) return [];
      return Array.from(line.matchAll(/\bcloseoutAttemptId\(/gu), () => {
        return `closeoutAttemptId@outside-authority:${index + 1}`;
      });
    })
  );
  return violations;
}

describe('main-agent delivery closeout fixture authority', () => {
  it('derives semantic identities from one fixture authority without copied literals', () => {
    const source = readFileSync(DELIVERY_CLOSEOUT_FIXTURE_PATH, 'utf8');

    expect(source).toContain(FIXTURE_AUTHORITY_DECLARATION);
    expect(source).toContain('function passingCloseoutEvidence(');
    expect(fixtureAuthorityViolations(source)).toEqual([]);
  });

  it('detects copied semantic identities and attempt derivation outside the authority', () => {
    const source = readFileSync(DELIVERY_CLOSEOUT_FIXTURE_PATH, 'utf8');
    const mutatedSource = [
      source,
      "const copiedRequirementId = 'MUST-001';",
      "const copiedAttemptId = closeoutAttemptId('mutation');",
    ].join('\n');
    const violations = fixtureAuthorityViolations(mutatedSource);

    expect(violations).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^MUST-001@/u),
        expect.stringMatching(/^closeoutAttemptId@outside-authority:/u),
      ])
    );
  });
});
