import { readFileSync } from 'node:fs';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020';
import {
  canonicalJson,
} from './requirements-contract-governed-write';
import { sha256Stable } from './requirements-contract-semantic-resolver';

type NormalizedPackage = {
  semanticBodies: Record<string, Record<string, unknown>>;
  nodes: Record<string, {
    nodeType: string;
    bodySchemaVersion: string;
    bodyHash: string;
    applicability: { decision: string };
  }>;
  edges: Record<string, {
    edgeType: string;
    fromRef: string;
    fromHash: string;
    toRef: string;
    toHash: string;
    edgeHash: string;
  }>;
};

function validatePackage(value: unknown): value is NormalizedPackage {
  const schemaPath = path.resolve(
    __dirname,
    '..',
    'schemas',
    'requirements-contract-normalized-package.schema.json'
  );
  const schema = JSON.parse(readFileSync(schemaPath, 'utf8')) as object;
  return new Ajv2020({ allErrors: true, strict: false }).compile(schema)(value) as boolean;
}

function cell(value: string): string {
  return value.replace(/\|/gu, '\\|').replace(/\r?\n/gu, ' ');
}

export function renderRequirementsContractNormalizedPackage(input: unknown) {
  if (!validatePackage(input)) throw new Error('Normalized Contract Package schema validation failed');
  const edgeJson = canonicalJson(input.edges);
  const duplicateSemanticBodyInEdgeCount = Object.values(input.semanticBodies).filter((body) =>
    edgeJson.includes(canonicalJson(body))
  ).length;
  const nodeRows = Object.entries(input.nodes)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(
      ([id, node]) =>
        `| ${cell(id)} | ${cell(node.nodeType)} | ${cell(node.bodySchemaVersion)} | ${node.bodyHash} | ${cell(node.applicability.decision)} |`
    );
  const edgeRows = Object.entries(input.edges)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(
      ([id, edge]) =>
        `| ${cell(id)} | ${cell(edge.edgeType)} | ${cell(edge.fromRef)} | ${cell(edge.toRef)} | ${edge.edgeHash} |`
    );
  const markdown = [
    '## Normalized Nodes',
    '',
    '| Node | Type | Body schema | Body hash | Applicability |',
    '|---|---|---|---|---|',
    ...nodeRows,
    '',
    '## Normalized Edges',
    '',
    '| Edge | Type | From | To | Edge hash |',
    '|---|---|---|---|---|',
    ...edgeRows,
    '',
  ].join('\n');
  return {
    schemaVersion: 'requirements-contract-normalized-package-render/v1',
    packageHash: sha256Stable(input),
    canonicalJson: `${canonicalJson(input)}\n`,
    markdown,
    semanticBodyCount: Object.keys(input.semanticBodies).length,
    nodeCount: Object.keys(input.nodes).length,
    edgeCount: Object.keys(input.edges).length,
    duplicateSemanticBodyInEdgeCount,
    decision: duplicateSemanticBodyInEdgeCount === 0 ? ('pass' as const) : ('block' as const),
  };
}
