const { createHash } = require('node:crypto');
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

const FILE_HASH_CHUNK_BYTES = 64 * 1024;

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

function compareIds(left, right) {
  return String(left).localeCompare(String(right), 'en');
}

function normalizeRepositoryPath(value) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw failure('partition_impact_path_escape', { value });
  }
  const candidate = value.trim().replace(/\\/gu, '/');
  if (
    path.posix.isAbsolute(candidate) ||
    /^[A-Za-z]:\//u.test(candidate) ||
    candidate.startsWith('//') ||
    candidate.split('/').includes('..')
  ) {
    throw failure('partition_impact_path_escape', { value });
  }
  const normalized = path.posix.normalize(candidate).replace(/^\.\//u, '');
  if (
    normalized === '.' ||
    normalized.length === 0 ||
    normalized.startsWith('../')
  ) {
    throw failure('partition_impact_path_escape', { value });
  }
  return normalized;
}

function absoluteRepositoryPath(repositoryRoot, relativePath) {
  const root = path.resolve(repositoryRoot);
  const resolved = path.resolve(root, ...relativePath.split('/'));
  const relative = path.relative(root, resolved);
  if (
    relative.startsWith('..') ||
    path.isAbsolute(relative) ||
    relative === ''
  ) {
    throw failure('partition_impact_path_escape', { relativePath });
  }
  return resolved;
}

function pathIsExcluded(relativePath, policy) {
  const canonicalPath = relativePath.replace(/\\/gu, '/');
  const normalized = `${canonicalPath}${
    canonicalPath.endsWith('/') ? '' : '/'
  }`;
  return policy.excludedPathPrefixes.some((prefix) => {
    const canonicalPrefix = prefix.replace(/\\/gu, '/').replace(/^\/+/u, '');
    return (
      canonicalPath === canonicalPrefix.replace(/\/$/u, '') ||
      normalized.startsWith(canonicalPrefix) ||
      normalized.includes(`/${canonicalPrefix}`)
    );
  });
}

function sha256FileStreamed(filePath) {
  const digest = createHash('sha256');
  const buffer = Buffer.allocUnsafe(FILE_HASH_CHUNK_BYTES);
  const descriptor = fs.openSync(filePath, 'r');
  try {
    let bytesRead = 0;
    do {
      bytesRead = fs.readSync(
        descriptor,
        buffer,
        0,
        buffer.length,
        null
      );
      if (bytesRead > 0) digest.update(buffer.subarray(0, bytesRead));
    } while (bytesRead > 0);
  } finally {
    fs.closeSync(descriptor);
  }
  return `sha256:${digest.digest('hex')}`;
}

function enumerateRepositoryFacts({
  repositoryRoot,
  policy,
  requiredPaths,
}) {
  const root = path.resolve(repositoryRoot);
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
    throw failure('partition_impact_repository_root_invalid', {
      repositoryRoot: root.replace(/\\/gu, '/'),
    });
  }
  const analyzedExtensions = new Set(policy.analyzedExtensions);
  const hashOnlyExtensions = new Set(policy.hashOnlyTextExtensions);
  const binaryExtensions = new Set(policy.binaryExtensions);
  const required = new Set(
    (requiredPaths || []).map(normalizeRepositoryPath)
  );
  const candidates = [];
  let visitedDirectoryCount = 0;

  function visit(directory, relativeDirectory = '') {
    visitedDirectoryCount += 1;
    if (visitedDirectoryCount > policy.maxVisitedDirectories) {
      throw failure('partition_impact_scan_limit_exceeded', {
        limit: 'maxVisitedDirectories',
      });
    }
    const entries = fs
      .readdirSync(directory, { withFileTypes: true })
      .sort((left, right) => compareIds(left.name, right.name));
    for (const entry of entries) {
      const relativePath = normalizeRepositoryPath(
        relativeDirectory
          ? `${relativeDirectory}/${entry.name}`
          : entry.name
      );
      if (pathIsExcluded(relativePath, policy)) continue;
      const absolutePath = absoluteRepositoryPath(root, relativePath);
      const stat = fs.lstatSync(absolutePath);
      if (stat.isSymbolicLink()) {
        const requiredThroughSymlink = [...required].some(
          (requiredPath) =>
            requiredPath === relativePath ||
            requiredPath.startsWith(`${relativePath}/`)
        );
        if (requiredThroughSymlink) {
          throw failure('partition_impact_required_path_symlink', {
            path: relativePath,
          });
        }
        continue;
      }
      if (stat.isDirectory()) {
        visit(absolutePath, relativePath);
        continue;
      }
      if (!stat.isFile()) continue;
      const extension = path.posix.extname(relativePath).toLowerCase();
      if (binaryExtensions.has(extension)) continue;
      const allowed =
        analyzedExtensions.has(extension) ||
        hashOnlyExtensions.has(extension) ||
        required.has(relativePath);
      if (!allowed) continue;
      candidates.push({
        relativePath,
        absolutePath,
        extension,
        size: stat.size,
        mode: stat.mode & 0o777,
      });
      if (candidates.length > policy.maxCandidateFiles) {
        throw failure('partition_impact_scan_limit_exceeded', {
          limit: 'maxCandidateFiles',
        });
      }
    }
  }

  visit(root);
  const files = new Map();
  let aggregateBytes = 0;
  for (const candidate of candidates.sort((left, right) =>
    compareIds(left.relativePath, right.relativePath)
  )) {
    if (candidate.size > policy.maxBytesPerFile) {
      if (required.has(candidate.relativePath)) {
        throw failure('partition_impact_scan_limit_exceeded', {
          limit: 'maxBytesPerFile',
          path: candidate.relativePath,
        });
      }
      if (aggregateBytes + candidate.size > policy.maxAggregateBytes) {
        throw failure('partition_impact_scan_limit_exceeded', {
          limit: 'maxAggregateBytes',
        });
      }
      aggregateBytes += candidate.size;
      files.set(candidate.relativePath, {
        ...candidate,
        bytes: null,
        fileHash: sha256FileStreamed(candidate.absolutePath),
      });
      continue;
    }
    if (aggregateBytes + candidate.size > policy.maxAggregateBytes) {
      throw failure('partition_impact_scan_limit_exceeded', {
        limit: 'maxAggregateBytes',
      });
    }
    const bytes = fs.readFileSync(candidate.absolutePath);
    if (
      !policy.analyzedExtensions.includes(candidate.extension) &&
      !policy.hashOnlyTextExtensions.includes(candidate.extension) &&
      bytes.subarray(0, 8192).includes(0)
    ) {
      if (required.has(candidate.relativePath)) {
        throw failure('partition_impact_coverage_incomplete', {
          path: candidate.relativePath,
          reason: 'required_artifact_is_binary',
        });
      }
      continue;
    }
    aggregateBytes += bytes.length;
    files.set(candidate.relativePath, {
      ...candidate,
      bytes,
      fileHash: sha256Buffer(bytes),
    });
  }
  const repositoryTreeRecords = [...files.values()].map(
    ({ relativePath, mode, fileHash }) => ({
      path: relativePath,
      mode,
      existenceState: 'present',
      fileHash,
    })
  );
  const facts = canonicalizeRepositoryFacts(
    [...files.values()].map(({ relativePath, mode, size, fileHash }) => ({
      filePath: relativePath,
      fileHash,
      mode,
      size,
    }))
  );
  return {
    enumerationMode: 'package_repository_facts',
    files,
    repositoryTreeHash: sha256Text(
      stableStringify(repositoryTreeRecords)
    ),
    repositoryFactsHash: sha256Text(stableStringify(facts)),
    facts,
    statistics: {
      visitedDirectoryCount,
      candidateFileCount: candidates.length,
      analyzedFileCount: files.size,
      aggregateBytes,
    },
  };
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
  enumerateRepositoryFacts,
  loadRepositoryFacts,
  validateRepositoryFactPacket,
};
