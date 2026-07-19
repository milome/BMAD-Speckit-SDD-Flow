import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import { describe, expect, it } from 'vitest';
import { REQUIREMENTS_CONTRACT_BMAD_CONSUMERS } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-bmad-consumer-registry';
import { sha256Stable } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-semantic-resolver';

interface ConsumerRegistry {
  schemaVersion: string;
  owner: { path: string; hash: string };
  registryHash: string;
  validationModes: string[];
  discoveryRules: Array<{
    ruleId: string;
    root: string;
    fileNamePattern: string;
  }>;
  consumers: Array<{
    consumerId: string;
    path: string;
    pathHash: string;
    supportedModes: string[];
    confirmationComposition?: {
      codec: string;
      schema: string;
      validator: string;
      projector: string;
      renderInputSchema: string;
      renderInputProjector: string;
      renderer: string;
      reference: string;
      rendererSpecification: string;
    };
    closeoutComposition?: {
      packetSchema: string;
      renderer: {
        assetId: string;
        symbolRef: string;
      };
      readbackReceiptSchema: string;
      finalResponseProjector: {
        assetId: string;
        symbolRef: string;
      };
    };
    directConfirmationFieldRead: false;
  }>;
  discovery: {
    discoveredPaths: string[];
    declaredPaths: string[];
    unregisteredConsumerCount: number;
  };
}

const ROOT = process.cwd();
const REGISTRY_PATH = path.join(
  ROOT,
  '_bmad',
  'shared',
  'requirements-contract',
  'requirements-contract-consumer-registry.json'
);
const SCHEMA_PATH = path.join(
  ROOT,
  'packages',
  'bmad-speckit',
  'src',
  'main-agent',
  'source-authority',
  'schemas',
  'requirements-contract-consumer-registry.schema.json'
);

const CONFIRMATION_COMPOSITION = {
  codec: 'implementation_confirmation_codec',
  schema: 'implementation_confirmation_schema',
  validator: 'implementation_confirmation_validator',
  projector: 'implementation_confirmation_projector',
  renderInputSchema: 'confirmation_render_input_schema',
  renderInputProjector: 'confirmation_render_input_projector',
  renderer: 'confirmation_renderer',
  reference: 'implementation_confirmation_reference',
  rendererSpecification: 'confirmation_renderer_specification',
} as const;

const CLOSEOUT_COMPOSITION = {
  packetSchema: 'closeout_packet_schema',
  renderer: {
    assetId: 'closeout_renderer',
    symbolRef: 'renderRequirementsContractTerminalCloseout',
  },
  readbackReceiptSchema: 'closeout_readback_receipt_schema',
  finalResponseProjector: {
    assetId: 'closeout_final_response_projector',
    symbolRef: 'projectRequirementsContractTerminalCloseout',
  },
} as const;

function normalize(value: string): string {
  return value.replace(/\\/gu, '/');
}

function fileHash(filePath: string): string {
  return `sha256:${createHash('sha256').update(readFileSync(filePath)).digest('hex')}`;
}

function filesBelow(root: string): string[] {
  if (!existsSync(root)) return [];
  const result: string[] = [];
  for (const entry of readdirSync(root)) {
    const candidate = path.join(root, entry);
    if (statSync(candidate).isDirectory()) result.push(...filesBelow(candidate));
    else result.push(candidate);
  }
  return result;
}

function discoverPaths(registry: ConsumerRegistry): string[] {
  const discovered = new Set<string>();
  for (const rule of registry.discoveryRules) {
    const root = path.resolve(ROOT, rule.root);
    const pattern = new RegExp(rule.fileNamePattern, 'u');
    for (const filePath of filesBelow(root)) {
      if (pattern.test(path.basename(filePath))) {
        discovered.add(normalize(path.relative(ROOT, filePath)));
      }
    }
  }
  return [...discovered].sort();
}

describe('requirements contract consumer registry', () => {
  it('publishes one tracked schema-valid registry with deterministic discovery', () => {
    expect(existsSync(REGISTRY_PATH), 'consumer registry is missing').toBe(true);
    expect(existsSync(SCHEMA_PATH), 'consumer registry schema is missing').toBe(true);
    if (!existsSync(REGISTRY_PATH) || !existsSync(SCHEMA_PATH)) return;

    const registry = JSON.parse(readFileSync(REGISTRY_PATH, 'utf8')) as ConsumerRegistry;
    const schema = JSON.parse(readFileSync(SCHEMA_PATH, 'utf8'));
    const validate = new Ajv2020({ allErrors: true, strict: false }).compile(schema);

    expect(validate(registry), JSON.stringify(validate.errors ?? [])).toBe(true);
    expect(JSON.stringify(registry)).not.toContain('docs/plans/evidence');
    expect(registry.owner.hash).toBe(fileHash(path.resolve(ROOT, registry.owner.path)));
    expect(registry.registryHash).toBe(
      sha256Stable({
        schemaVersion: registry.schemaVersion,
        validationModes: registry.validationModes,
        discoveryRules: registry.discoveryRules,
        consumers: registry.consumers,
        discovery: registry.discovery,
      })
    );
    expect(discoverPaths(registry)).toEqual(registry.discovery.discoveredPaths);
    expect(registry.discovery.unregisteredConsumerCount).toBe(0);
  });

  it('registers every discovered path and BMAD consumer without local read authority', () => {
    expect(existsSync(REGISTRY_PATH), 'consumer registry is missing').toBe(true);
    if (!existsSync(REGISTRY_PATH)) return;

    const registry = JSON.parse(readFileSync(REGISTRY_PATH, 'utf8')) as ConsumerRegistry;
    const ids = registry.consumers.map((consumer) => consumer.consumerId);
    const declaredPaths = [...new Set(registry.consumers.map((consumer) => consumer.path))].sort();

    expect(new Set(ids).size).toBe(ids.length);
    expect(declaredPaths).toEqual(registry.discovery.declaredPaths);
    expect(
      registry.discovery.discoveredPaths.filter(
        (discoveredPath) => !declaredPaths.includes(discoveredPath)
      )
    ).toEqual([]);
    expect(ids).toEqual(
      expect.arrayContaining(
        REQUIREMENTS_CONTRACT_BMAD_CONSUMERS.map((consumer) => consumer.consumerId)
      )
    );

    for (const consumer of registry.consumers) {
      const resolved = path.resolve(ROOT, consumer.path);
      expect(existsSync(resolved), `consumer path is missing: ${consumer.path}`).toBe(true);
      if (existsSync(resolved)) expect(consumer.pathHash).toBe(fileHash(resolved));
      expect(consumer.supportedModes.length).toBeGreaterThan(0);
      expect(consumer.supportedModes.every((mode) => registry.validationModes.includes(mode))).toBe(
        true
      );
      expect(consumer.directConfirmationFieldRead).toBe(false);
    }
  });

  it('binds exact AMEND-13 compositions for every applicable consumer', () => {
    expect(existsSync(REGISTRY_PATH), 'consumer registry is missing').toBe(true);
    if (!existsSync(REGISTRY_PATH)) return;

    const registry = JSON.parse(readFileSync(REGISTRY_PATH, 'utf8')) as ConsumerRegistry;

    for (const consumer of registry.consumers) {
      if (consumer.supportedModes.includes('confirmation-ready')) {
        expect(
          consumer.confirmationComposition,
          `${consumer.consumerId} is missing confirmation composition`
        ).toEqual(CONFIRMATION_COMPOSITION);
      } else {
        expect(consumer.confirmationComposition).toBeUndefined();
      }

      if (consumer.supportedModes.includes('closeout')) {
        expect(
          consumer.closeoutComposition,
          `${consumer.consumerId} is missing closeout composition`
        ).toEqual(CLOSEOUT_COMPOSITION);
      } else {
        expect(consumer.closeoutComposition).toBeUndefined();
      }
    }
  });
});
