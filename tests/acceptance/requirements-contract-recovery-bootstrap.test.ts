import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { expect, it } from 'vitest';
import { requirementsContractRecoveryBootstrapCommand } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-recovery-bootstrap';
import {
  createRecoveryFixture,
  fileHash,
  installConsumerGitIdentityDriftShim,
} from './helpers/requirements-contract-recovery-test-fixture';

const FROZEN_CONSUMER_IDENTITY = JSON.parse(
  readFileSync(
    path.resolve(
      'tests/acceptance/fixtures/requirements-contract-recovery/consumer-baseline-authority.json'
    ),
    'utf8'
  )
) as Record<string, any>;
const FROZEN_TRACKED_FILES = FROZEN_CONSUMER_IDENTITY.trackedFiles as Array<{
  mode: string;
  blob: string;
  path: string;
}>;
const FROZEN_INDEX_BYTES = FROZEN_TRACKED_FILES.map(
  (entry) => `${entry.mode} ${entry.blob} ${entry.path}`
).join('\n');
const FROZEN_INDEX_HASH = FROZEN_CONSUMER_IDENTITY.baselineFileIndexHash as string;

function sha256(value: string): string {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

function bootstrapOptions(
  fixture: ReturnType<typeof createRecoveryFixture>
) {
  return {
    cwd: fixture.cwd,
    contract: fixture.contractPath,
    authority: fixture.authorityPath,
    architectureAuthority: fixture.architectureAuthorityPath,
    attemptContext: fixture.contextPath,
    qualifiedRedReceipt: fixture.qualifiedRedPath,
    consumerRoot: fixture.consumerRoot,
    createIfAbsent: true,
    initialPublicationReceipt: fixture.publicationPath,
    out: fixture.provisionalPath,
    json: false,
  };
}

function runGit(cwd: string, args: string[]): string {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed: ${result.stderr}`);
  }
  return result.stdout.trim();
}

function frozenConsumer(root: string, existsBefore = false) {
  const { commitTimestamp: _commitTimestamp, ...identity } =
    structuredClone(FROZEN_CONSUMER_IDENTITY);
  return {
    normalizedRoot: root,
    existsBefore,
    ...identity,
    repositoryRoot: root,
    clean: true,
    partialCreationRecovery: 'not_required',
  };
}

function unpublishedArtifactNames(fixture: ReturnType<typeof createRecoveryFixture>): string[] {
  const directory = path.dirname(fixture.provisionalPath);
  return existsSync(directory)
    ? readdirSync(directory)
        .filter((name) => name.startsWith('recovery-lineage-receipt'))
        .sort()
    : [];
}

it('publishes provisional recovery lineage without mutating the canonical target', async () => {
  const fixture = createRecoveryFixture();
  try {
    const targetPreimageHash = fileHash(fixture.targetPath);
    const exitCode = await requirementsContractRecoveryBootstrapCommand(
      bootstrapOptions(fixture)
    );

    expect(exitCode).toBe(0);
    expect(fileHash(fixture.targetPath)).toBe(targetPreimageHash);
    expect(existsSync(fixture.consumerRoot)).toBe(true);
    expect(existsSync(fixture.provisionalPath)).toBe(true);
    expect(existsSync(fixture.publicationPath)).toBe(true);

    const provisional = JSON.parse(
      readFileSync(fixture.provisionalPath, 'utf8')
    ) as Record<string, any>;
    const publication = JSON.parse(
      readFileSync(fixture.publicationPath, 'utf8')
    ) as Record<string, any>;
    const commandRoles = fixture.schema['x-commandRoles'];

    expect(provisional.state).toBe('provisional');
    expect(provisional.passAuthority).toBe(false);
    expect(Object.keys(provisional.commandReceiptRefs).sort()).toEqual(
      [commandRoles.preEdit, commandRoles.bootstrap].sort()
    );
    expect(provisional.pendingFinalization.missingReceiptRoles).toEqual([
      commandRoles.postBootstrap,
    ]);
    expect(provisional).not.toHaveProperty('provisionalCandidate');
    expect(provisional).not.toHaveProperty('initialPublicationReceipt');
    expect(publication.targetHash).toBe(fileHash(fixture.provisionalPath));
    expect(publication.readbackVerified).toBe(true);
  } finally {
    fixture.cleanup();
  }
});

it('uses frozen literal index bytes as an independent hash oracle', () => {
  expect(sha256(FROZEN_INDEX_BYTES)).toBe(FROZEN_INDEX_HASH);
  const [markerRow, packageRow] = FROZEN_INDEX_BYTES.split('\n');
  const blobPrefix = FROZEN_TRACKED_FILES[0].blob.slice(0, 8);
  const mutatedBlobPrefix = `${blobPrefix[0] === '0' ? '1' : '0'}${blobPrefix.slice(1)}`;
  for (const invalidBytes of [
    `${packageRow}\n${markerRow}`,
    FROZEN_INDEX_BYTES.replace(/^100644/u, '100755'),
    FROZEN_INDEX_BYTES.replace(blobPrefix, mutatedBlobPrefix),
    FROZEN_INDEX_BYTES.replace('bmad-speckit-consumer-project.json', 'consumer.json'),
    `${FROZEN_INDEX_BYTES}\n`,
  ]) {
    expect(sha256(invalidBytes)).not.toBe(FROZEN_INDEX_HASH);
  }
});

it('publishes the complete frozen Consumer Git identity tuple', async () => {
  const fixture = createRecoveryFixture();
  try {
    const exitCode = await requirementsContractRecoveryBootstrapCommand(
      bootstrapOptions(fixture)
    );

    expect(exitCode).toBe(0);
    const provisional = JSON.parse(
      readFileSync(fixture.provisionalPath, 'utf8')
    ) as Record<string, any>;
    expect(provisional.consumer).toEqual(frozenConsumer(fixture.consumerRoot));
  } finally {
    fixture.cleanup();
  }
});

it('schema fixes the canonical tracked-file tuple count, order, mode, blob, and path', async () => {
  const fixture = createRecoveryFixture();
  try {
    const exitCode = await requirementsContractRecoveryBootstrapCommand(
      bootstrapOptions(fixture)
    );
    expect(exitCode).toBe(0);
    const provisional = JSON.parse(readFileSync(fixture.provisionalPath, 'utf8'));
    const ajv = new Ajv2020({ allErrors: true, strict: false });
    addFormats(ajv);
    const validate = ajv.compile(fixture.schema);
    expect(validate(provisional)).toBe(true);
    const invalidTrackedFiles = [
      [FROZEN_TRACKED_FILES[0]],
      [...FROZEN_TRACKED_FILES, FROZEN_TRACKED_FILES[0]],
      [...FROZEN_TRACKED_FILES].reverse(),
      [{ ...FROZEN_TRACKED_FILES[0], mode: '100755' }, FROZEN_TRACKED_FILES[1]],
      [{ ...FROZEN_TRACKED_FILES[0], blob: '0'.repeat(40) }, FROZEN_TRACKED_FILES[1]],
      [{ ...FROZEN_TRACKED_FILES[0], path: 'consumer.json' }, FROZEN_TRACKED_FILES[1]],
    ];
    for (const trackedFiles of invalidTrackedFiles) {
      const candidate = structuredClone(provisional);
      candidate.consumer.trackedFiles = trackedFiles;
      expect(validate(candidate)).toBe(false);
    }
  } finally {
    fixture.cleanup();
  }
});

const consumerDrifts = [
  {
    name: 'tracked content',
    mutate: (fixture: ReturnType<typeof createRecoveryFixture>) =>
      writeFileSync(path.join(fixture.consumerRoot, 'package.json'), '{"drift":true}\n', 'utf8'),
  },
  {
    name: 'untracked content',
    mutate: (fixture: ReturnType<typeof createRecoveryFixture>) =>
      writeFileSync(path.join(fixture.consumerRoot, 'untracked.tmp'), 'drift\n', 'utf8'),
  },
  {
    name: 'ignored content',
    mutate: (fixture: ReturnType<typeof createRecoveryFixture>) => {
      writeFileSync(path.join(fixture.consumerRoot, '.git/info/exclude'), 'ignored.tmp\n', 'utf8');
      writeFileSync(path.join(fixture.consumerRoot, 'ignored.tmp'), 'drift\n', 'utf8');
    },
  },
  {
    name: 'HEAD/tree',
    mutate: (fixture: ReturnType<typeof createRecoveryFixture>) => {
      writeFileSync(path.join(fixture.consumerRoot, 'head-drift.txt'), 'drift\n', 'utf8');
      runGit(fixture.consumerRoot, ['add', '--', 'head-drift.txt']);
      runGit(fixture.consumerRoot, ['commit', '-m', 'test: drift Consumer HEAD']);
    },
  },
  {
    name: 'remote',
    mutate: (fixture: ReturnType<typeof createRecoveryFixture>) =>
      runGit(fixture.consumerRoot, ['remote', 'add', 'origin', 'https://example.invalid/repo.git']),
  },
  {
    name: 'local identity',
    mutate: (fixture: ReturnType<typeof createRecoveryFixture>) =>
      runGit(fixture.consumerRoot, [
        'config',
        '--local',
        'user.email',
        'drifted@bmad-speckit.local',
      ]),
  },
  {
    name: 'package-lock',
    mutate: (fixture: ReturnType<typeof createRecoveryFixture>) =>
      writeFileSync(path.join(fixture.consumerRoot, 'package-lock.json'), '{}\n', 'utf8'),
  },
  {
    name: 'node_modules',
    mutate: (fixture: ReturnType<typeof createRecoveryFixture>) =>
      mkdirSync(path.join(fixture.consumerRoot, 'node_modules')),
  },
  {
    name: 'submodule',
    mutate: (fixture: ReturnType<typeof createRecoveryFixture>) => {
      const source = path.join(fixture.root, 'submodule-source');
      mkdirSync(source);
      runGit(source, ['init', '--initial-branch=main']);
      runGit(source, ['config', 'user.name', 'Recovery Test']);
      runGit(source, ['config', 'user.email', 'recovery-test@bmad-speckit.local']);
      writeFileSync(path.join(source, 'README.md'), 'submodule\n', 'utf8');
      runGit(source, ['add', '--', 'README.md']);
      runGit(source, ['commit', '-m', 'test: initialize submodule']);
      runGit(fixture.consumerRoot, [
        '-c',
        'protocol.file.allow=always',
        'submodule',
        'add',
        source,
        'vendor/submodule',
      ]);
      runGit(fixture.consumerRoot, ['commit', '-m', 'test: add submodule drift']);
    },
  },
];

it.each(consumerDrifts)('blocks $name Consumer drift before publishing', async ({ mutate }) => {
  const fixture = createRecoveryFixture({ consumerExistsBefore: true });
  try {
    mutate(fixture);
    const exitCode = await requirementsContractRecoveryBootstrapCommand(
      bootstrapOptions(fixture)
    );
    expect(exitCode).toBe(1);
    expect(existsSync(fixture.provisionalPath)).toBe(false);
    expect(existsSync(fixture.publicationPath)).toBe(false);
  } finally {
    fixture.cleanup();
  }
});

it('revalidates the complete Consumer tuple before writing the provisional artifact', async () => {
  const fixture = createRecoveryFixture({ consumerExistsBefore: true });
  const shim = installConsumerGitIdentityDriftShim(fixture, 4);
  try {
    const exitCode = await requirementsContractRecoveryBootstrapCommand(
      bootstrapOptions(fixture)
    );
    expect(exitCode).toBe(1);
    expect(shim.readState().triggered).toBe(true);
    expect(unpublishedArtifactNames(fixture)).toEqual([]);
  } finally {
    shim.restore();
    fixture.cleanup();
  }
});

it('revalidates before publication and removes the stale provisional artifact on drift', async () => {
  const fixture = createRecoveryFixture({ consumerExistsBefore: true });
  const publicationSentinel = '{"sentinel":true}\n';
  const shim = installConsumerGitIdentityDriftShim(fixture, 7, {
    createPublicationSentinel: true,
  });
  try {
    const exitCode = await requirementsContractRecoveryBootstrapCommand(
      bootstrapOptions(fixture)
    );
    expect(exitCode).toBe(1);
    expect(shim.readState().triggered).toBe(true);
    expect(existsSync(fixture.provisionalPath)).toBe(false);
    expect(readFileSync(fixture.publicationPath, 'utf8')).toBe(publicationSentinel);
    expect(unpublishedArtifactNames(fixture)).toEqual([
      path.basename(fixture.publicationPath),
    ]);
  } finally {
    shim.restore();
    fixture.cleanup();
  }
});

it('blocks an existing provisional output before creating the Consumer', async () => {
  const fixture = createRecoveryFixture();
  try {
    mkdirSync(path.dirname(fixture.provisionalPath), { recursive: true });
    writeFileSync(fixture.provisionalPath, '{"sentinel":true}\n', 'utf8');
    const targetPreimageHash = fileHash(fixture.targetPath);

    const exitCode = await requirementsContractRecoveryBootstrapCommand(
      bootstrapOptions(fixture)
    );

    expect(exitCode).toBe(1);
    expect(readFileSync(fixture.provisionalPath, 'utf8')).toBe(
      '{"sentinel":true}\n'
    );
    expect(existsSync(fixture.consumerRoot)).toBe(false);
    expect(fileHash(fixture.targetPath)).toBe(targetPreimageHash);
  } finally {
    fixture.cleanup();
  }
});

it('blocks authority drift before publishing recovery artifacts', async () => {
  const fixture = createRecoveryFixture();
  try {
    writeFileSync(fixture.authorityPath, 'changed authority\n', 'utf8');

    const exitCode = await requirementsContractRecoveryBootstrapCommand(
      bootstrapOptions(fixture)
    );

    expect(exitCode).toBe(1);
    expect(existsSync(fixture.provisionalPath)).toBe(false);
    expect(existsSync(fixture.publicationPath)).toBe(false);
    expect(existsSync(fixture.consumerRoot)).toBe(false);
  } finally {
    fixture.cleanup();
  }
});
