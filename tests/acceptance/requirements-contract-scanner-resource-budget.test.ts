import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  scanRequirementsContractConsumerAuthority,
  type RequirementsContractConsumerAuthoritySourceEntry,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-consumer-authority-scanner';

const temporaryRoots: string[] = [];

function createFixture(rootCount: number) {
  const root = mkdtempSync(path.join(os.tmpdir(), 'requirements-scanner-budget-'));
  temporaryRoots.push(root);
  const sourceDir = path.join(root, 'authority');
  mkdirSync(sourceDir, { recursive: true });
  const intakeSource = path.join(root, 'requirements.md');
  writeFileSync(intakeSource, '# Requirements\n', 'utf8');
  const authoritySources: RequirementsContractConsumerAuthoritySourceEntry[] = [];
  let declaredBytes = 0;
  for (let index = 0; index < rootCount; index += 1) {
    const relativePath = `authority/root-${String(index).padStart(4, '0')}.json`;
    const body = JSON.stringify({
      schemaVersion: 'requirements-contract-authority-source/v1',
      sourceRootId: `MUST-FR-${String(index).padStart(4, '0')}`,
      semanticBody: { text: `Requirement ${index} MUST remain addressable.` },
    });
    writeFileSync(path.join(root, relativePath), body, 'utf8');
    declaredBytes += Buffer.byteLength(body, 'utf8');
    authoritySources.push({
      path: relativePath,
      rootClass: 'functional_requirement',
      proposedAuthorityClass: 'source_authority',
      bodySchemaVersion: 'requirement-contract-requirement/v2',
    });
  }
  return { root, intakeSource, authoritySources, declaredBytes };
}

describe('requirements contract scanner resource budgets', () => {
  afterEach(() => {
    for (const root of temporaryRoots.splice(0)) rmSync(root, { recursive: true, force: true });
  });

  it('accepts 129 sources when shared byte, node, and span budgets allow them', () => {
    const fixture = createFixture(129);
    const result = scanRequirementsContractConsumerAuthority({
      cwd: fixture.root,
      intakeSource: fixture.intakeSource,
      authoritySources: fixture.authoritySources,
      resourceLimits: {
        maxSingleSourceBytes: 4 * 1024,
        maxTotalSourceBytes: fixture.declaredBytes + 1024,
        maxSemanticNodes: 139,
        maxSourceSpans: 139,
      },
    });

    expect(result.sourceRootCandidates).toHaveLength(129);
    expect(result.capacity).toMatchObject({
      sourceArtifactCount: 129,
      sourceRootCount: 129,
      totalSourceBytes: fixture.declaredBytes,
    });
  });

  it('enforces the configured aggregate unique-byte boundary', () => {
    const fixture = createFixture(3);
    const scan = (maxTotalSourceBytes: number) => scanRequirementsContractConsumerAuthority({
      cwd: fixture.root,
      intakeSource: fixture.intakeSource,
      authoritySources: fixture.authoritySources,
      resourceLimits: {
        maxSingleSourceBytes: 4 * 1024,
        maxTotalSourceBytes,
        maxSemanticNodes: 10,
        maxSourceSpans: 10,
      },
    });

    expect(scan(fixture.declaredBytes).capacity.totalSourceBytes).toBe(fixture.declaredBytes);
    expect(() => scan(fixture.declaredBytes - 1))
      .toThrow('requirements_total_source_bytes_exceeded');
  });

  it('uses configurable semantic-node and source-span budgets instead of root constants', () => {
    const fixture = createFixture(3);
    const scan = (maxSemanticNodes: number, maxSourceSpans: number) =>
      scanRequirementsContractConsumerAuthority({
        cwd: fixture.root,
        intakeSource: fixture.intakeSource,
        authoritySources: fixture.authoritySources,
        resourceLimits: {
          maxSingleSourceBytes: 4 * 1024,
          maxTotalSourceBytes: fixture.declaredBytes,
          maxSemanticNodes,
          maxSourceSpans,
        },
      });

    expect(() => scan(2, 10)).toThrow('requirements_semantic_node_count_exceeded');
    expect(() => scan(10, 2)).toThrow('requirements_source_span_count_exceeded');
  });
});
