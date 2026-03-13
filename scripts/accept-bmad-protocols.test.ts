import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('protocol documents', () => {
  it('defines audit result schema and commit request contract', () => {
    const auditSchema = readFileSync('.claude/protocols/audit-result-schema.md', 'utf8');
    const handoff = readFileSync('.claude/protocols/handoff-schema.md', 'utf8');
    const commitProtocol = readFileSync('.claude/protocols/commit-protocol.md', 'utf8');

    expect(auditSchema).toContain('status');
    expect(auditSchema).toContain('PASS');
    expect(auditSchema).toContain('FAIL');
    expect(handoff).toContain('artifactDocPath');
    expect(commitProtocol).toContain('commit_request');
    expect(commitProtocol).toContain('bmad-master');
  });
});
