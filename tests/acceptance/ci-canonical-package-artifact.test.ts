import { execFileSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { delimiter, join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveCanonicalPackageTarball } from '../helpers/canonical-package-artifact';

const require = createRequire(import.meta.url);
const {
  preparePackageArtifact,
  validatePackageDescriptor,
} = require('../../tools/ci/prepare-package-artifact.cjs');

function fixtureRepo() {
  const repoRoot = mkdtempSync(join(tmpdir(), 'canonical-package-'));
  writeFileSync(
    join(repoRoot, 'package.json'),
    JSON.stringify({ name: 'fixture-package', version: '1.2.3', private: true }),
    'utf8'
  );
  return repoRoot;
}

function git(repoRoot: string, ...args: string[]) {
  return execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8' }).trim();
}

function installLargePackOutputNpm(repoRoot: string) {
  const binDir = join(repoRoot, 'fake-bin');
  const implementationPath = join(binDir, 'fake-npm.cjs');
  mkdirSync(binDir, { recursive: true });
  writeFileSync(
    implementationPath,
    `'use strict';
const fs = require('node:fs');
const path = require('node:path');

const args = process.argv.slice(2);
if (args[0] === 'run' && args[1] === 'prepack') {
  fs.writeFileSync(path.join(process.cwd(), 'generated.txt'), 'mutated', 'utf8');
}
if (args[0] === 'pack') {
  const workspaceDependency = path.join(process.cwd(), 'node_modules', 'fixture-workspace');
  if (
    fs.existsSync(workspaceDependency) &&
    !fs.realpathSync(workspaceDependency).startsWith(process.cwd())
  ) {
    process.stderr.write('workspace dependency escaped the isolated build root');
    process.exit(7);
  }
  const outputIndex = args.indexOf('--pack-destination');
  const outputDir = args[outputIndex + 1];
  const filename = 'fixture-package-1.2.3.tgz';
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(path.join(outputDir, filename), 'tarball', 'utf8');
  const files = Array.from({ length: 25000 }, (_, index) => ({
    path: \`generated/file-\${String(index).padStart(5, '0')}-\${'x'.repeat(48)}.json\`,
    size: 1,
    mode: 420
  }));
  process.stdout.write(JSON.stringify([{ filename, files }]));
}
`,
    'utf8'
  );
  if (process.platform === 'win32') {
    writeFileSync(
      join(binDir, 'npm.cmd'),
      `@echo off\r\n"${process.execPath}" "%~dp0fake-npm.cjs" %*\r\n`,
      'utf8'
    );
  } else {
    const executablePath = join(binDir, 'npm');
    writeFileSync(executablePath, "#!/usr/bin/env node\nrequire('./fake-npm.cjs');\n", 'utf8');
    chmodSync(executablePath, 0o755);
  }
  return binDir;
}

describe('canonical package artifact', () => {
  it('builds in an isolated commit workspace without mutating the caller worktree', () => {
    const repoRoot = fixtureRepo();
    const generatedPath = join(repoRoot, 'generated.txt');
    const workspacePackage = join(repoRoot, 'packages', 'fixture-workspace');
    const previousPath = process.env.PATH;
    try {
      writeFileSync(generatedPath, 'baseline', 'utf8');
      mkdirSync(workspacePackage, { recursive: true });
      writeFileSync(
        join(workspacePackage, 'package.json'),
        JSON.stringify({ name: 'fixture-workspace', version: '1.0.0' }),
        'utf8'
      );
      git(repoRoot, 'init');
      git(repoRoot, 'config', 'user.email', 'ci@example.invalid');
      git(repoRoot, 'config', 'user.name', 'CI Test');
      git(
        repoRoot,
        'add',
        'package.json',
        'generated.txt',
        'packages/fixture-workspace/package.json'
      );
      git(repoRoot, 'commit', '-m', 'baseline');
      const commitSha = git(repoRoot, 'rev-parse', 'HEAD');
      mkdirSync(join(repoRoot, 'node_modules'), { recursive: true });
      mkdirSync(join(repoRoot, 'node_modules', '.bin'), { recursive: true });
      const workspaceLink = join(repoRoot, 'node_modules', 'fixture-workspace');
      symlinkSync(
        workspacePackage,
        workspaceLink,
        process.platform === 'win32' ? 'junction' : 'dir'
      );
      process.env.PATH = `${installLargePackOutputNpm(repoRoot)}${delimiter}${previousPath || ''}`;

      preparePackageArtifact({
        repoRoot,
        commitSha,
        listTarEntries: () => ['package/package.json'],
      });

      expect(readFileSync(generatedPath, 'utf8')).toBe('baseline');
      expect(git(repoRoot, 'status', '--porcelain', '--untracked-files=no')).toBe('');
    } finally {
      if (previousPath === undefined) delete process.env.PATH;
      else process.env.PATH = previousPath;
      rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it('rebinds workspace junctions from sibling worktrees into the isolated commit workspace', () => {
    const repoRoot = fixtureRepo();
    const siblingParent = mkdtempSync(join(tmpdir(), 'canonical-package-sibling-'));
    const siblingRoot = join(siblingParent, 'w');
    const workspacePackage = join(repoRoot, 'packages', 'fixture-workspace');
    const previousPath = process.env.PATH;
    let siblingAdded = false;
    try {
      mkdirSync(workspacePackage, { recursive: true });
      writeFileSync(
        join(workspacePackage, 'package.json'),
        JSON.stringify({ name: 'fixture-workspace', version: '1.0.0' }),
        'utf8'
      );
      git(repoRoot, 'init');
      git(repoRoot, 'config', 'user.email', 'ci@example.invalid');
      git(repoRoot, 'config', 'user.name', 'CI Test');
      git(repoRoot, 'add', 'package.json', 'packages/fixture-workspace/package.json');
      git(repoRoot, 'commit', '-m', 'baseline');
      const commitSha = git(repoRoot, 'rev-parse', 'HEAD');
      git(repoRoot, 'worktree', 'add', '--detach', siblingRoot, commitSha);
      siblingAdded = true;

      mkdirSync(join(repoRoot, 'node_modules'), { recursive: true });
      symlinkSync(
        join(siblingRoot, 'packages', 'fixture-workspace'),
        join(repoRoot, 'node_modules', 'fixture-workspace'),
        process.platform === 'win32' ? 'junction' : 'dir'
      );
      process.env.PATH = `${installLargePackOutputNpm(repoRoot)}${delimiter}${previousPath || ''}`;

      preparePackageArtifact({
        repoRoot,
        commitSha,
        listTarEntries: () => ['package/package.json'],
      });
    } finally {
      if (previousPath === undefined) delete process.env.PATH;
      else process.env.PATH = previousPath;
      rmSync(join(repoRoot, 'node_modules'), { recursive: true, force: true });
      if (siblingAdded) {
        git(repoRoot, 'worktree', 'remove', '--force', siblingRoot);
      }
      rmSync(siblingParent, { recursive: true, force: true });
      rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it('preserves non-commit dependency junctions until offline materialization', () => {
    const repoRoot = fixtureRepo();
    const runtimeDependency = join(
      repoRoot,
      '.runtime-deps',
      'node_modules',
      'fixture-runtime'
    );
    let projectedDependency: string | undefined;
    try {
      mkdirSync(runtimeDependency, { recursive: true });
      writeFileSync(
        join(runtimeDependency, 'package.json'),
        JSON.stringify({ name: 'fixture-runtime', version: '1.0.0' }),
        'utf8'
      );
      writeFileSync(join(repoRoot, '.gitignore'), '.runtime-deps/\n', 'utf8');
      git(repoRoot, 'init');
      git(repoRoot, 'config', 'user.email', 'ci@example.invalid');
      git(repoRoot, 'config', 'user.name', 'CI Test');
      git(repoRoot, 'add', 'package.json', '.gitignore');
      git(repoRoot, 'commit', '-m', 'baseline');
      const commitSha = git(repoRoot, 'rev-parse', 'HEAD');
      mkdirSync(join(repoRoot, 'node_modules'), { recursive: true });
      symlinkSync(
        runtimeDependency,
        join(repoRoot, 'node_modules', 'fixture-runtime'),
        process.platform === 'win32' ? 'junction' : 'dir'
      );

      preparePackageArtifact({
        repoRoot,
        commitSha,
        listTarEntries: () => ['package/package.json'],
        runCommand: (request: any) => {
          if (request.kind === 'materialize') {
            projectedDependency = realpathSync(
              join(request.cwd, 'node_modules', 'fixture-runtime')
            );
          }
          if (request.kind === 'npm_pack') {
            mkdirSync(request.outputDir, { recursive: true });
            writeFileSync(
              join(request.outputDir, 'fixture-package-1.2.3.tgz'),
              'tarball',
              'utf8'
            );
            return {
              status: 0,
              stdout: JSON.stringify([{ filename: 'fixture-package-1.2.3.tgz' }]),
            };
          }
          return { status: 0, stdout: '' };
        },
      });

      expect(projectedDependency).toBe(realpathSync(runtimeDependency));
    } finally {
      rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it('preserves sibling worktree runtime dependency junctions until offline materialization', () => {
    const repoRoot = fixtureRepo();
    const siblingParent = mkdtempSync(join(tmpdir(), 'canonical-package-runtime-sibling-'));
    const siblingRoot = join(siblingParent, 'w');
    let siblingAdded = false;
    let projectedDependency: string | undefined;
    try {
      git(repoRoot, 'init');
      git(repoRoot, 'config', 'user.email', 'ci@example.invalid');
      git(repoRoot, 'config', 'user.name', 'CI Test');
      git(repoRoot, 'add', 'package.json');
      git(repoRoot, 'commit', '-m', 'baseline');
      const commitSha = git(repoRoot, 'rev-parse', 'HEAD');
      git(repoRoot, 'worktree', 'add', '--detach', siblingRoot, commitSha);
      siblingAdded = true;

      const runtimeDependency = join(
        siblingRoot,
        '.runtime-deps',
        'node_modules',
        'fixture-runtime'
      );
      mkdirSync(runtimeDependency, { recursive: true });
      writeFileSync(
        join(runtimeDependency, 'package.json'),
        JSON.stringify({ name: 'fixture-runtime', version: '1.0.0' }),
        'utf8'
      );
      mkdirSync(join(repoRoot, 'node_modules'), { recursive: true });
      symlinkSync(
        runtimeDependency,
        join(repoRoot, 'node_modules', 'fixture-runtime'),
        process.platform === 'win32' ? 'junction' : 'dir'
      );

      preparePackageArtifact({
        repoRoot,
        commitSha,
        listTarEntries: () => ['package/package.json'],
        runCommand: (request: any) => {
          if (request.kind === 'materialize') {
            projectedDependency = realpathSync(
              join(request.cwd, 'node_modules', 'fixture-runtime')
            );
          }
          if (request.kind === 'npm_pack') {
            mkdirSync(request.outputDir, { recursive: true });
            writeFileSync(
              join(request.outputDir, 'fixture-package-1.2.3.tgz'),
              'tarball',
              'utf8'
            );
            return {
              status: 0,
              stdout: JSON.stringify([{ filename: 'fixture-package-1.2.3.tgz' }]),
            };
          }
          return { status: 0, stdout: '' };
        },
      });

      expect(projectedDependency).toBe(realpathSync(runtimeDependency));
    } finally {
      rmSync(join(repoRoot, 'node_modules'), { recursive: true, force: true });
      if (siblingAdded) {
        git(repoRoot, 'worktree', 'remove', '--force', siblingRoot);
      }
      rmSync(siblingParent, { recursive: true, force: true });
      rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it('captures npm-pack JSON above the Node default within the governed budget', () => {
    const repoRoot = fixtureRepo();
    const previousPath = process.env.PATH;
    try {
      process.env.PATH = `${installLargePackOutputNpm(repoRoot)}${delimiter}${previousPath || ''}`;
      const prepared = preparePackageArtifact({
        repoRoot,
        commitSha: 'e'.repeat(40),
        listTarEntries: () => ['package/package.json'],
      });

      expect(validatePackageDescriptor({ repoRoot, descriptor: prepared })).toEqual(prepared);
    } finally {
      if (previousPath === undefined) delete process.env.PATH;
      else process.env.PATH = previousPath;
      rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it('materializes once, builds once, packs once, and freezes the exact tarball hash', () => {
    const repoRoot = fixtureRepo();
    const calls: any[] = [];
    try {
      const prepared = preparePackageArtifact({
        repoRoot,
        commitSha: 'a'.repeat(40),
        listTarEntries: () => ['package/package.json'],
        runCommand: (request: any) => {
          calls.push(request);
          if (request.kind === 'npm_pack') {
            mkdirSync(request.outputDir, { recursive: true });
            writeFileSync(join(request.outputDir, 'fixture-package-1.2.3.tgz'), 'tarball', 'utf8');
            return {
              status: 0,
              stdout: JSON.stringify([{ filename: 'fixture-package-1.2.3.tgz' }]),
            };
          }
          return { status: 0, stdout: '' };
        },
      });

      expect(calls.map((command) => command.kind)).toEqual([
        'materialize',
        'build',
        'npm_pack',
        'cleanup',
      ]);
      expect(calls.filter((command) => command.kind === 'materialize')).toHaveLength(1);
      expect(calls.filter((command) => command.kind === 'build')).toHaveLength(1);
      expect(calls.filter((command) => command.kind === 'npm_pack')).toHaveLength(1);
      expect(calls.filter((command) => command.kind === 'cleanup')).toHaveLength(1);
      expect(calls.find((command) => command.kind === 'materialize').args).toEqual([
        'ci',
        '--offline',
        '--ignore-scripts',
      ]);
      expect(calls.find((command) => command.kind === 'build').args).toEqual(['run', 'prepack']);
      expect(calls.find((command) => command.kind === 'npm_pack').args).toContain(
        '--ignore-scripts'
      );
      expect(prepared.commitSha).toBe('a'.repeat(40));
      expect(prepared.packageName).toBe('fixture-package');
      expect(prepared.packageVersion).toBe('1.2.3');
      expect(validatePackageDescriptor({ repoRoot, descriptor: prepared })).toEqual(prepared);
      expect(JSON.parse(readFileSync(prepared.descriptorPath, 'utf8')).tarballSha256).toBe(
        prepared.tarballSha256
      );
    } finally {
      rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it.runIf(process.platform === 'win32')(
    'materializes external dependency directories with file hardlinks inside staging',
    () => {
      const repoRoot = fixtureRepo();
      const sourceBin = join(repoRoot, 'node_modules', '.bin', 'fixture.cmd');
      let inspectedStaging = false;
      try {
        git(repoRoot, 'init');
        git(repoRoot, 'config', 'user.email', 'ci@example.invalid');
        git(repoRoot, 'config', 'user.name', 'CI Test');
        git(repoRoot, 'add', 'package.json');
        git(repoRoot, 'commit', '-m', 'baseline');
        const commitSha = git(repoRoot, 'rev-parse', 'HEAD');
        mkdirSync(join(repoRoot, 'node_modules', '.bin'), { recursive: true });
        writeFileSync(sourceBin, '@echo off\r\n', 'utf8');

        preparePackageArtifact({
          repoRoot,
          commitSha,
          listTarEntries: () => ['package/package.json'],
          runCommand: (request: any) => {
            if (request.kind === 'build') {
              const stagedBinDir = join(request.cwd, 'node_modules', '.bin');
              const stagedBin = join(stagedBinDir, 'fixture.cmd');
              expect(lstatSync(stagedBinDir).isSymbolicLink()).toBe(false);
              expect(lstatSync(stagedBinDir).isDirectory()).toBe(true);
              const sourceStat = statSync(sourceBin, { bigint: true });
              const stagedStat = statSync(stagedBin, { bigint: true });
              expect(stagedStat.dev).toBe(sourceStat.dev);
              expect(stagedStat.ino).toBe(sourceStat.ino);
              inspectedStaging = true;
            }
            if (request.kind === 'npm_pack') {
              mkdirSync(request.outputDir, { recursive: true });
              writeFileSync(
                join(request.outputDir, 'fixture-package-1.2.3.tgz'),
                'tarball',
                'utf8'
              );
              return {
                status: 0,
                stdout: JSON.stringify([{ filename: 'fixture-package-1.2.3.tgz' }]),
              };
            }
            return { status: 0, stdout: '' };
          },
        });

        expect(inspectedStaging).toBe(true);
      } finally {
        rmSync(repoRoot, { recursive: true, force: true });
      }
    }
  );

  it.runIf(process.platform === 'win32')(
    'maps workspace links from an external dependency source back into staging',
    () => {
      const repoRoot = fixtureRepo();
      const dependencySourceRoot = mkdtempSync(join(tmpdir(), 'canonical-package-source-'));
      const projectedNodeModules = join(repoRoot, 'node_modules');
      try {
        git(repoRoot, 'init');
        git(repoRoot, 'config', 'user.email', 'ci@example.invalid');
        git(repoRoot, 'config', 'user.name', 'CI Test');
        git(repoRoot, 'add', 'package.json');
        git(repoRoot, 'commit', '-m', 'baseline');
        const commitSha = git(repoRoot, 'rev-parse', 'HEAD');
        mkdirSync(join(dependencySourceRoot, 'node_modules'), { recursive: true });
        symlinkSync(
          dependencySourceRoot,
          join(dependencySourceRoot, 'node_modules', 'fixture-package'),
          'junction'
        );
        symlinkSync(join(dependencySourceRoot, 'node_modules'), projectedNodeModules, 'junction');

        preparePackageArtifact({
          repoRoot,
          commitSha,
          listTarEntries: () => ['package/package.json'],
          runCommand: (request: any) => {
            if (request.kind === 'build') {
              const stagedWorkspace = join(request.cwd, 'node_modules', 'fixture-package');
              expect(lstatSync(stagedWorkspace).isSymbolicLink()).toBe(true);
              expect(resolve(realpathSync(stagedWorkspace))).toBe(resolve(request.cwd));
            }
            if (request.kind === 'npm_pack') {
              mkdirSync(request.outputDir, { recursive: true });
              writeFileSync(
                join(request.outputDir, 'fixture-package-1.2.3.tgz'),
                'tarball',
                'utf8'
              );
              return {
                status: 0,
                stdout: JSON.stringify([{ filename: 'fixture-package-1.2.3.tgz' }]),
              };
            }
            return { status: 0, stdout: '' };
          },
        });
      } finally {
        rmSync(projectedNodeModules, { recursive: true, force: true });
        rmSync(join(dependencySourceRoot, 'node_modules', 'fixture-package'), {
          recursive: true,
          force: true,
        });
        rmSync(repoRoot, { recursive: true, force: true });
        rmSync(dependencySourceRoot, { recursive: true, force: true });
      }
    }
  );

  it('rejects parent traversal entries before writing the package descriptor', () => {
    const repoRoot = fixtureRepo();
    const descriptorPath = join(
      repoRoot,
      '.artifacts',
      'test-portfolio',
      'package',
      'canonical-package.json'
    );
    try {
      expect(() =>
        preparePackageArtifact({
          repoRoot,
          commitSha: '9'.repeat(40),
          listTarEntries: () => ['package/package.json', 'package/../escape'],
          runCommand: (request: any) => {
            if (request.kind === 'npm_pack') {
              mkdirSync(request.outputDir, { recursive: true });
              writeFileSync(
                join(request.outputDir, 'fixture-package-1.2.3.tgz'),
                'tarball',
                'utf8'
              );
              return {
                status: 0,
                stdout: JSON.stringify([{ filename: 'fixture-package-1.2.3.tgz' }]),
              };
            }
            return { status: 0, stdout: '' };
          },
        })
      ).toThrow('CANONICAL_PACKAGE_TAR_ENTRY_UNSAFE');
      expect(existsSync(descriptorPath)).toBe(false);
    } finally {
      rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it('fails closed before build when dependency materialization fails', () => {
    const repoRoot = fixtureRepo();
    const calls: string[] = [];
    try {
      expect(() =>
        preparePackageArtifact({
          repoRoot,
          commitSha: '9'.repeat(40),
          runCommand: (request: any) => {
            calls.push(request.kind);
            if (request.kind === 'materialize') return { status: 17, stdout: '' };
            return { status: 0, stdout: '' };
          },
        })
      ).toThrow('CANONICAL_PACKAGE_MATERIALIZATION_FAILED');
      expect(calls).toEqual(['materialize', 'cleanup']);
    } finally {
      rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it.each([null, undefined, 0, false])(
    'preserves primary throw %s when cleanup also fails',
    (primaryError) => {
      const repoRoot = fixtureRepo();
      const calls: string[] = [];
      try {
        let didThrow = false;
        let thrownValue: unknown;
        try {
          preparePackageArtifact({
            repoRoot,
            commitSha: 'f'.repeat(40),
            runCommand: (request: any) => {
              calls.push(request.kind);
              if (request.kind === 'build') throw primaryError;
              if (request.kind === 'cleanup') throw new Error('cleanup failed');
              return { status: 0, stdout: '' };
            },
          });
        } catch (error) {
          didThrow = true;
          thrownValue = error;
        }

        expect(didThrow).toBe(true);
        expect(thrownValue).toBe(primaryError);
        expect(calls).toEqual(['materialize', 'build', 'cleanup']);
      } finally {
        rmSync(repoRoot, { recursive: true, force: true });
      }
    }
  );

  it('rejects tarball bytes that drift after preparation', () => {
    const repoRoot = fixtureRepo();
    try {
      const prepared = preparePackageArtifact({
        repoRoot,
        commitSha: 'b'.repeat(40),
        listTarEntries: () => ['package/package.json'],
        runCommand: (request: any) => {
          if (request.kind === 'npm_pack') {
            mkdirSync(request.outputDir, { recursive: true });
            writeFileSync(join(request.outputDir, 'fixture-package-1.2.3.tgz'), 'original', 'utf8');
            return {
              status: 0,
              stdout: JSON.stringify([{ filename: 'fixture-package-1.2.3.tgz' }]),
            };
          }
          return { status: 0, stdout: '' };
        },
      });

      writeFileSync(join(repoRoot, prepared.tarballPath), 'mutated', 'utf8');
      expect(() => validatePackageDescriptor({ repoRoot, descriptor: prepared })).toThrow(
        'CANONICAL_PACKAGE_HASH_MISMATCH'
      );
    } finally {
      rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it('rejects an output directory before deleting anything outside the governed root', () => {
    const repoRoot = fixtureRepo();
    const sentinel = join(repoRoot, 'tests', 'sentinel.txt');
    mkdirSync(join(repoRoot, 'tests'), { recursive: true });
    writeFileSync(sentinel, 'keep', 'utf8');
    try {
      expect(() =>
        preparePackageArtifact({
          repoRoot,
          outputDir: 'tests',
          commitSha: 'b'.repeat(40),
          runCommand: () => {
            throw new Error('COMMAND_MUST_NOT_START');
          },
        })
      ).toThrow('CI_ARTIFACT_PATH_OUTSIDE_GOVERNED_ROOT');
      expect(readFileSync(sentinel, 'utf8')).toBe('keep');
    } finally {
      rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it('binds descriptor authority to the current commit, package metadata, and commands', () => {
    const repoRoot = fixtureRepo();
    try {
      const prepared = preparePackageArtifact({
        repoRoot,
        commitSha: 'c'.repeat(40),
        listTarEntries: () => ['package/package.json'],
        runCommand: (request: any) => {
          if (request.kind === 'npm_pack') {
            mkdirSync(request.outputDir, { recursive: true });
            writeFileSync(join(request.outputDir, 'fixture-package-1.2.3.tgz'), 'tarball', 'utf8');
            return {
              status: 0,
              stdout: JSON.stringify([{ filename: 'fixture-package-1.2.3.tgz' }]),
            };
          }
          return { status: 0, stdout: '' };
        },
      });

      for (const mutation of [
        { commitSha: 'd'.repeat(40) },
        { packageName: 'forged-package' },
        { packageVersion: '9.9.9' },
        { buildCommandHash: `sha256:${'0'.repeat(64)}` },
        { packCommandHash: `sha256:${'1'.repeat(64)}` },
      ]) {
        expect(() =>
          validatePackageDescriptor({
            repoRoot,
            descriptor: { ...prepared, ...mutation },
            descriptorPath: prepared.descriptorPath,
            expectedCommitSha: 'c'.repeat(40),
          })
        ).toThrow('CANONICAL_PACKAGE_DESCRIPTOR_AUTHORITY_MISMATCH');
      }
    } finally {
      rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it('fails closed when governed consumers lack the frozen artifact binding', () => {
    const previous = {
      CI: process.env.CI,
      CI_RUN_MANIFEST: process.env.CI_RUN_MANIFEST,
      BMAD_SPECKIT_TARBALL: process.env.BMAD_SPECKIT_TARBALL,
      BMAD_SPECKIT_PACKAGE_DESCRIPTOR: process.env.BMAD_SPECKIT_PACKAGE_DESCRIPTOR,
    };
    try {
      process.env.CI_RUN_MANIFEST = '1';
      delete process.env.BMAD_SPECKIT_TARBALL;
      delete process.env.BMAD_SPECKIT_PACKAGE_DESCRIPTOR;

      expect(() => resolveCanonicalPackageTarball(process.cwd())).toThrow(
        'CANONICAL_PACKAGE_TARBALL_REQUIRED'
      );
    } finally {
      for (const [name, value] of Object.entries(previous)) {
        if (value === undefined) delete process.env[name];
        else process.env[name] = value;
      }
    }
  });

  it('rejects a configured tarball that differs from the descriptor artifact', () => {
    const repoRoot = fixtureRepo();
    const fixtureCommitSha = 'd'.repeat(40);
    const previous = {
      CI: process.env.CI,
      CI_COMMIT_SHA: process.env.CI_COMMIT_SHA,
      CI_RUN_MANIFEST: process.env.CI_RUN_MANIFEST,
      BMAD_SPECKIT_TARBALL: process.env.BMAD_SPECKIT_TARBALL,
      BMAD_SPECKIT_PACKAGE_DESCRIPTOR: process.env.BMAD_SPECKIT_PACKAGE_DESCRIPTOR,
    };
    try {
      const prepared = preparePackageArtifact({
        repoRoot,
        commitSha: fixtureCommitSha,
        listTarEntries: () => ['package/package.json'],
        runCommand: (request: any) => {
          if (request.kind === 'npm_pack') {
            mkdirSync(request.outputDir, { recursive: true });
            writeFileSync(
              join(request.outputDir, 'fixture-package-1.2.3.tgz'),
              'canonical',
              'utf8'
            );
            return {
              status: 0,
              stdout: JSON.stringify([{ filename: 'fixture-package-1.2.3.tgz' }]),
            };
          }
          return { status: 0, stdout: '' };
        },
      });
      const differentTarball = join(repoRoot, 'different.tgz');
      writeFileSync(differentTarball, 'canonical', 'utf8');
      process.env.CI_COMMIT_SHA = fixtureCommitSha;
      process.env.CI_RUN_MANIFEST = '1';
      process.env.BMAD_SPECKIT_TARBALL = differentTarball;
      process.env.BMAD_SPECKIT_PACKAGE_DESCRIPTOR = prepared.descriptorPath;

      expect(() => resolveCanonicalPackageTarball(repoRoot)).toThrow(
        'CANONICAL_PACKAGE_TARBALL_DESCRIPTOR_MISMATCH'
      );
    } finally {
      for (const [name, value] of Object.entries(previous)) {
        if (value === undefined) delete process.env[name];
        else process.env[name] = value;
      }
      rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it('requires a descriptor whenever a governed manifest supplies a tarball', () => {
    const repoRoot = fixtureRepo();
    const tarball = join(repoRoot, 'configured.tgz');
    const previous = {
      CI: process.env.CI,
      CI_RUN_MANIFEST: process.env.CI_RUN_MANIFEST,
      BMAD_SPECKIT_TARBALL: process.env.BMAD_SPECKIT_TARBALL,
      BMAD_SPECKIT_PACKAGE_DESCRIPTOR: process.env.BMAD_SPECKIT_PACKAGE_DESCRIPTOR,
    };
    writeFileSync(tarball, 'tarball', 'utf8');
    try {
      delete process.env.CI;
      process.env.CI_RUN_MANIFEST = '1';
      process.env.BMAD_SPECKIT_TARBALL = tarball;
      delete process.env.BMAD_SPECKIT_PACKAGE_DESCRIPTOR;

      expect(() => resolveCanonicalPackageTarball(repoRoot)).toThrow(
        'CANONICAL_PACKAGE_DESCRIPTOR_REQUIRED'
      );
    } finally {
      for (const [name, value] of Object.entries(previous)) {
        if (value === undefined) delete process.env[name];
        else process.env[name] = value;
      }
      rmSync(repoRoot, { recursive: true, force: true });
    }
  });
});
