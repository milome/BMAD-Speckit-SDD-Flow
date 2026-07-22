import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildScaleEdges,
  buildScaleNodes,
  expandScalePathDescriptor,
  scalePathVectorHash,
  scaleNodeId,
  type ScalePathDescriptor,
} from './helpers/requirements-contract-normalized-package-scale-fixture';

type ScaleProfile = {
  profile: 'sparse' | 'boundedDense';
  nodeCount: number;
  edgeCount: number;
  packageHash: string;
  canonicalBytes: number;
  lookupIndices: number[];
  expectedLookup: unknown[];
  outgoingIndices: number[];
  expectedOutgoingEdgeIds: Record<string, string[]>;
  expectedCriticalPath: ScalePathDescriptor;
  expectedBoundedDenseCriticalPaths: ScalePathDescriptor;
  operationOutputHashes: Record<string, string>;
  expectedOutputSetHash: string;
  workUnits: Record<string, number>;
  workUnitLimit: number;
};

type ScaleCorpus = {
  schemaVersion: string;
  nodeSizes: number[];
  cases: Array<{
    nodeCount: number;
    profiles: {
      sparse: ScaleProfile;
      boundedDense: ScaleProfile;
    };
  }>;
};

const CORPUS = JSON.parse(
  readFileSync(
    path.resolve('tests/fixtures/requirements-contract/normalized-contract-scale-corpus.v1.json'),
    'utf8'
  )
) as ScaleCorpus;

describe('Normalized Contract Package scale corpus', () => {
  it(
    'matches every frozen expected vector within the deterministic work-unit bound',
    { timeout: 180_000 },
    async () => {
      const rendererModule =
        (await import('../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-normalized-package-renderer')) as Record<
          string,
          unknown
        >;
      const measure = rendererModule.measureRequirementsContractNormalizedPackageOperations as
        | ((input: {
            packageValue: unknown;
            lookupNodeIds: string[];
            outgoingNodeIds: string[];
          }) => Record<string, unknown>)
        | undefined;

      expect(typeof measure).toBe('function');
      expect(CORPUS.schemaVersion).toBe('normalized-contract-scale-corpus/v1');
      expect(CORPUS.nodeSizes).toEqual([1024, 2048, 4096, 8192, 16384]);

      for (const scaleCase of CORPUS.cases) {
        const shared = buildScaleNodes(scaleCase.nodeCount);
        for (const profile of [scaleCase.profiles.sparse, scaleCase.profiles.boundedDense]) {
          const expectedCriticalPathEdgeIds = expandScalePathDescriptor(
            profile.expectedCriticalPath
          );
          const expectedBoundedDenseCriticalPaths = expandScalePathDescriptor(
            profile.expectedBoundedDenseCriticalPaths
          ).map((edgeId) => [edgeId]);
          expect(expectedCriticalPathEdgeIds).toHaveLength(profile.expectedCriticalPath.count);
          expect(expectedCriticalPathEdgeIds.at(0) ?? null).toBe(
            profile.expectedCriticalPath.firstEdgeId
          );
          expect(expectedCriticalPathEdgeIds.at(-1) ?? null).toBe(
            profile.expectedCriticalPath.lastEdgeId
          );
          expect(scalePathVectorHash(expectedCriticalPathEdgeIds)).toBe(
            profile.expectedCriticalPath.expectedHash
          );
          expect(expectedBoundedDenseCriticalPaths).toHaveLength(
            profile.expectedBoundedDenseCriticalPaths.count
          );
          expect(expectedBoundedDenseCriticalPaths.at(0)?.[0] ?? null).toBe(
            profile.expectedBoundedDenseCriticalPaths.firstEdgeId
          );
          expect(expectedBoundedDenseCriticalPaths.at(-1)?.[0] ?? null).toBe(
            profile.expectedBoundedDenseCriticalPaths.lastEdgeId
          );
          expect(scalePathVectorHash(expectedBoundedDenseCriticalPaths)).toBe(
            profile.expectedBoundedDenseCriticalPaths.expectedHash
          );

          const packageValue = {
            semanticBodies: shared.semanticBodies,
            nodes: shared.nodes,
            edges: buildScaleEdges(profile.profile, scaleCase.nodeCount, shared.bodyHashes),
          };
          const observed = measure?.({
            packageValue,
            lookupNodeIds: profile.lookupIndices.map(scaleNodeId),
            outgoingNodeIds: profile.outgoingIndices.map(scaleNodeId),
          });

          expect(observed).toMatchObject({
            nodeCount: profile.nodeCount,
            edgeCount: profile.edgeCount,
            packageHash: profile.packageHash,
            canonicalBytes: profile.canonicalBytes,
            lookup: profile.expectedLookup,
            outgoingEdgeIds: profile.expectedOutgoingEdgeIds,
            sparseCriticalPathEdgeIds: expectedCriticalPathEdgeIds,
            boundedDenseCriticalPaths: expectedBoundedDenseCriticalPaths,
            operationOutputHashes: profile.operationOutputHashes,
            expectedOutputSetHash: profile.expectedOutputSetHash,
            workUnits: profile.workUnits,
          });
          expect(
            Math.max(...Object.values(observed?.workUnits as Record<string, number>))
          ).toBeLessThanOrEqual(profile.workUnitLimit);
        }
      }
    }
  );
});
