import { describe, expect, it } from 'vitest';
import { REQUIREMENTS_CONTRACT_CONSUMER_DEFINITIONS } from '../../packages/bmad-speckit/src/main-agent/source-authority/rules/requirements-contract-consumer-registry';

const REQUIRED_INTERACTION_CONSUMERS = [
  {
    consumerId: 'ai-tdd-contract-gate',
    fileName: 'ai-tdd-contract-gate.ts',
    mode: 'execution',
  },
  {
    consumerId: 'run-confirmed-trace-slice',
    fileName: 'run-confirmed-trace-slice.ts',
    mode: 'execution',
  },
  {
    consumerId: 'main-agent-functional-resume-check',
    fileName: 'main-agent-functional-resume-check.ts',
    mode: 'execution',
  },
  {
    consumerId: 'main-agent-compiled-prompt-runner',
    fileName: 'main-agent-compiled-prompt-runner.ts',
    mode: 'execution',
  },
  {
    consumerId: 'architecture-confirmation-artifact',
    path: '_bmad/skills/requirements-contract-authoring/scripts/generate-architecture-confirmation-artifact.ts',
    mode: 'confirmation-ready',
  },
  {
    consumerId: 'requirements-contract-reverse-audit',
    fileName: 'requirements-contract-reverse-audit.ts',
    mode: 'closeout',
  },
  {
    consumerId: 'main-agent-delivery-closeout-gate',
    fileName: 'main-agent-delivery-closeout-gate.ts',
    mode: 'closeout',
  },
  {
    consumerId: 'strict-closeout-proof-gate',
    fileName: 'strict-closeout-proof-gate.ts',
    mode: 'closeout',
  },
] as const;

describe('requirements contract interaction consumer migration', () => {
  it('registers every production interaction consumer before Facade activation', () => {
    const definitions = REQUIREMENTS_CONTRACT_CONSUMER_DEFINITIONS as readonly {
      consumerId: string;
      fileName?: string;
      path?: string;
      supportedModes: readonly string[];
    }[];
    const missing = REQUIRED_INTERACTION_CONSUMERS.filter((expected) => {
      const actual = definitions.find(
        (definition) => definition.consumerId === expected.consumerId
      );
      return (
        !actual ||
        actual.fileName !== ('fileName' in expected ? expected.fileName : undefined) ||
        actual.path !== ('path' in expected ? expected.path : undefined) ||
        !actual.supportedModes.includes(expected.mode)
      );
    }).map((consumer) => consumer.consumerId);

    expect(missing).toEqual([]);
  });
});
