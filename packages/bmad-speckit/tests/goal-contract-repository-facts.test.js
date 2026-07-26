const { afterEach, describe, it } = require('node:test');
const assert = require('node:assert');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  loadRepositoryFacts,
} = require('../src/utils/goal-contract/repository-facts.ts');

const tempRoots = [];
const sha256 = (value) =>
  `sha256:${crypto.createHash('sha256').update(value).digest('hex')}`;

function writePacket(packet) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'goal-contract-facts-'));
  tempRoots.push(root);
  const factsPath = path.join(root, 'facts.json');
  fs.writeFileSync(factsPath, `${JSON.stringify(packet, null, 2)}\n`, 'utf8');
  return factsPath;
}

function validPacket() {
  const filePath =
    'packages/bmad-speckit/src/utils/goal-contract/source-obligation-extractor.ts';
  return {
    schemaVersion: 'goal-contract-repository-facts/v1',
    analyzerId: 'repository-analyzer',
    analyzerVersion: '1.0.0',
    repositoryTreeHash: `sha256:${'a'.repeat(64)}`,
    facts: [
      {
        factId: 'FACT-001',
        kind: 'file_ownership',
        filePath,
        fileHash: sha256(fs.readFileSync(filePath)),
        owner: 'goal-contract',
      },
    ],
  };
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe('goal-contract repository facts', () => {
  it('returns a deterministic not-provided binding', () => {
    const result = loadRepositoryFacts({
      factsPath: null,
      expectedRepositoryTreeHash: `sha256:${'a'.repeat(64)}`,
      allowlistedAnalyzers: ['repository-analyzer@1.0.0'],
    });

    assert.equal(result.state, 'not_provided');
    assert.deepEqual(result.facts, []);
    assert.match(result.repositoryFactsHash, /^sha256:[0-9a-f]{64}$/u);
    assert.equal(Object.isFrozen(result), true);
  });

  it('accepts only allowlisted facts bound to the current tree and file bytes', () => {
    const packet = validPacket();
    const result = loadRepositoryFacts({
      factsPath: writePacket(packet),
      expectedRepositoryTreeHash: packet.repositoryTreeHash,
      allowlistedAnalyzers: ['repository-analyzer@1.0.0'],
    });

    assert.equal(result.state, 'provided');
    assert.deepEqual(result.facts, packet.facts);
    assert.match(result.repositoryFactsHash, /^sha256:[0-9a-f]{64}$/u);
    assert.equal(Object.isFrozen(result.facts), true);
  });

  it('fails closed on untrusted, cross-tree, and stale-file packets', () => {
    const packet = validPacket();
    const load = (candidate, allowlistedAnalyzers = ['repository-analyzer@1.0.0']) =>
      loadRepositoryFacts({
        factsPath: writePacket(candidate),
        expectedRepositoryTreeHash: packet.repositoryTreeHash,
        allowlistedAnalyzers,
      });

    assert.throws(
      () => load(packet, []),
      (error) => error.failureClass === 'partition_repository_fact_untrusted'
    );
    assert.throws(
      () => load({ ...packet, repositoryTreeHash: `sha256:${'b'.repeat(64)}` }),
      (error) => error.failureClass === 'partition_repository_facts_stale'
    );
    assert.throws(
      () =>
        load({
          ...packet,
          facts: [{ ...packet.facts[0], fileHash: `sha256:${'c'.repeat(64)}` }],
        }),
      (error) => error.failureClass === 'partition_repository_facts_stale'
    );
  });
});
