import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { runMainAgentPreConfirmationDrilldown } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-orchestration';
import { validateRequirementContractModelV2 } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-model';
import {
  SOURCE_ROOT_CLASS_REGISTRY_HASH,
  extractRegisteredSourceRootCandidates,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-source-root-registry';

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const GOLDEN_SOURCE = path.join(
  PROJECT_ROOT,
  'packages',
  'bmad-speckit',
  'src',
  'main-agent',
  'source-authority',
  'tests',
  'fixtures',
  'source-prd',
  'golden-source-prd.md'
);

function authoringPath(
  root: string,
  requirementSetId: string,
  ...pathSegments: string[]
): string {
  return path.join(
    root,
    '_bmad-output',
    'runtime',
    'requirement-records',
    requirementSetId,
    'authoring',
    ...pathSegments
  );
}

describe('requirement entry-source conservation evaluation', () => {
  it('feeds the complete registered Source Root inventory into direct V2 production IR', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'entry-source-conservation-eval-'));
    const requirementSetId = 'REQ-ENTRY-CONSERVATION-EVAL';
    try {
      const relativeSourcePath = 'docs/requirements/golden-source-prd.md';
      const sourcePath = path.join(root, relativeSourcePath);
      mkdirSync(path.dirname(sourcePath), { recursive: true });
      copyFileSync(GOLDEN_SOURCE, sourcePath);
      const sourceText = readFileSync(sourcePath, 'utf8');
      const expectedRoots = extractRegisteredSourceRootCandidates({
        sourcePath: relativeSourcePath,
        sourceText,
      });

      const result = runMainAgentPreConfirmationDrilldown(root, {
        source: relativeSourcePath,
        entrySource: 'source_prd_draft',
        recordId: requirementSetId,
        requirementSetId,
        implementationAttemptId: 'IMPL-ENTRY-CONSERVATION-EVAL',
      });
      const semanticIrPath = authoringPath(root, requirementSetId, 'semantic-ir.json');
      const manifestPath = authoringPath(
        root,
        requirementSetId,
        'proofs',
        'semantic-conservation-manifest.json'
      );
      const semanticKernelPath = authoringPath(root, requirementSetId, 'semantic-kernel.json');
      const mustPacketPath = authoringPath(
        root,
        requirementSetId,
        'must_decomposition_packet.json'
      );
      const draftConfirmationPath = authoringPath(
        root,
        requirementSetId,
        'draft-implementation-confirmation.json'
      );

      expect(
        existsSync(semanticIrPath) && existsSync(manifestPath),
        JSON.stringify({
          substate: result.substate,
          blockingStage: result.blockingStage,
          blockingIssues: result.blockingIssues,
        })
      ).toBe(true);

      const semanticIr = JSON.parse(readFileSync(semanticIrPath, 'utf8')) as Record<string, any>;
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Record<string, any>;
      expect(validateRequirementContractModelV2(semanticIr)).toEqual({
        ok: true,
        issues: [],
      });
      expect(manifest.sourceRootClassRegistryHash).toBe(SOURCE_ROOT_CLASS_REGISTRY_HASH);

      const productionRootIds = new Set(
        manifest.sourceRoots.map((rootRow: { sourceRootId: string }) => rootRow.sourceRootId)
      );
      for (const expectedRoot of expectedRoots) {
        expect(productionRootIds.has(expectedRoot.sourceRootId), expectedRoot.sourceRootId).toBe(
          true
        );
        const node = semanticIr.nodes[expectedRoot.sourceRootId];
        expect(node, expectedRoot.sourceRootId).toBeDefined();
        expect(node.bodySchemaVersion, expectedRoot.sourceRootId).toBe(
          expectedRoot.bodySchemaVersion
        );
        expect(
          semanticIr.semanticBodies[node.bodyHash],
          expectedRoot.sourceRootId
        ).toEqual(expectedRoot.semanticBody);
      }

      const requirementRoots = expectedRoots.filter((rootRow) =>
        [
          'functional_requirement',
          'non_functional_requirement',
          'negative_requirement',
          'out_of_scope_boundary',
        ].includes(rootRow.rootClass)
      );
      expect(requirementRoots).not.toHaveLength(0);
      for (const rootRow of requirementRoots) {
        expect(rootRow.bodySchemaVersion).toBe('requirement-contract-requirement/v2');
        expect(rootRow.semanticBody.schemaVersion).toBe(
          'requirement-contract-requirement/v2'
        );
      }

      expect(
        [semanticKernelPath, mustPacketPath, draftConfirmationPath].every(existsSync),
        JSON.stringify({
          substate: result.substate,
          blockingStage: result.blockingStage,
          blockingIssues: result.blockingIssues,
        })
      ).toBe(true);
      const semanticKernel = JSON.parse(readFileSync(semanticKernelPath, 'utf8'))
        .semanticKernel as Record<string, any>;
      const mustPacket = JSON.parse(readFileSync(mustPacketPath, 'utf8'))
        .must_decomposition_packet as Record<string, any>;
      const draftConfirmation = JSON.parse(
        readFileSync(draftConfirmationPath, 'utf8')
      ).implementationConfirmation as Record<string, any>;
      expect(
        semanticKernel.sourceRequirementMap.map((row: { source: string }) => row.source)
      ).toEqual(semanticKernel.mustCandidates.map(() => 'canonical_semantic_ir'));
      expect(
        mustPacket.mustPackets.map(
          (row: { sourceRequirementAuthority: string }) => row.sourceRequirementAuthority
        )
      ).toEqual(mustPacket.mustRefs.map(() => 'canonical_semantic_ir'));
      expect(draftConfirmation.must.map((row: { source: string }) => row.source)).toEqual(
        draftConfirmation.must.map(() => 'canonical_semantic_ir')
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
