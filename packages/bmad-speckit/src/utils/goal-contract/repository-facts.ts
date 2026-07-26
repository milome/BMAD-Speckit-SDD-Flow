const fs = require('node:fs');
const path = require('node:path');
const {
  sha256Buffer,
  sha256Text,
  stableStringify,
} = require(
  __filename.endsWith('.ts')
    ? '../large-document-writer/receipts.ts'
    : '../large-document-writer/receipts'
);

export type GoalContractRepositoryFactsModule = never;

function failure(failureClass, extra = {}) {
  return Object.assign(new Error(failureClass), { failureClass, ...extra });
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function canonicalizeRepositoryFacts(facts) {
  return facts
    .map((fact) =>
      Object.fromEntries(
        Object.keys(fact)
          .sort()
          .map((key) => [key, fact[key]])
      )
    )
    .sort((left, right) =>
      stableStringify(left).localeCompare(stableStringify(right))
    );
}

function validateRepositoryFactPacket(packet) {
  if (
    !packet ||
    packet.schemaVersion !== 'goal-contract-repository-facts/v1' ||
    typeof packet.analyzerId !== 'string' ||
    typeof packet.analyzerVersion !== 'string' ||
    !/^sha256:[0-9a-f]{64}$/u.test(packet.repositoryTreeHash || '') ||
    !Array.isArray(packet.facts)
  ) {
    throw failure('partition_repository_facts_invalid');
  }
  return packet;
}

function validateFactFileHashes(facts) {
  const repositoryRoot = path.resolve(process.cwd());
  for (const fact of facts) {
    if (
      typeof fact.filePath !== 'string' ||
      !/^sha256:[0-9a-f]{64}$/u.test(fact.fileHash || '')
    ) {
      throw failure('partition_repository_facts_invalid');
    }
    const absolutePath = path.resolve(repositoryRoot, fact.filePath);
    const relativePath = path.relative(repositoryRoot, absolutePath);
    if (
      relativePath.startsWith('..') ||
      path.isAbsolute(relativePath) ||
      !fs.existsSync(absolutePath) ||
      sha256Buffer(fs.readFileSync(absolutePath)) !== fact.fileHash
    ) {
      throw failure('partition_repository_facts_stale', {
        filePath: fact.filePath,
      });
    }
  }
}

function loadRepositoryFacts({
  factsPath,
  expectedRepositoryTreeHash,
  allowlistedAnalyzers = [],
}) {
  if (!factsPath) {
    return deepFreeze({
      schemaVersion: 'goal-contract-repository-facts/v1',
      state: 'not_provided',
      facts: [],
      repositoryFactsHash: sha256Text(
        stableStringify({ state: 'not_provided' })
      ),
    });
  }
  const packet = validateRepositoryFactPacket(
    JSON.parse(fs.readFileSync(path.resolve(factsPath), 'utf8'))
  );
  const analyzerRef = `${packet.analyzerId}@${packet.analyzerVersion}`;
  if (!allowlistedAnalyzers.includes(analyzerRef)) {
    throw failure('partition_repository_fact_untrusted', {
      analyzerId: packet.analyzerId,
      analyzerVersion: packet.analyzerVersion,
    });
  }
  if (packet.repositoryTreeHash !== expectedRepositoryTreeHash) {
    throw failure('partition_repository_facts_stale', {
      expectedRepositoryTreeHash,
      actualRepositoryTreeHash: packet.repositoryTreeHash,
    });
  }
  validateFactFileHashes(packet.facts);
  const facts = canonicalizeRepositoryFacts(packet.facts);
  return deepFreeze({
    ...packet,
    state: 'provided',
    facts,
    repositoryFactsHash: sha256Text(stableStringify(facts)),
  });
}

module.exports = {
  canonicalizeRepositoryFacts,
  loadRepositoryFacts,
  validateRepositoryFactPacket,
};
