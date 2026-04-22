const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

const BIN = path.join(__dirname, '../bin/bmad-speckit.js');
const { uninstallCommand } = require('../src/commands/uninstall');
const { getInstallManifestPath, getUninstallReportPath, writeInstallManifest } = require('../src/services/install-surface-manifest');
const ROOT_PACKAGE_VERSION = require('../../../package.json').version;

function writeJson(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2) + '\n', 'utf8');
}

function createBaseManifest(projectRoot, overrides = {}) {
  return {
    manifest_version: 2,
    install_session_id: 'session-1',
    package_name: 'bmad-speckit-sdd-flow',
    package_version: ROOT_PACKAGE_VERSION,
    installed_via: 'postinstall',
    generated_at: new Date().toISOString(),
    project_root: projectRoot,
    snapshot_root: '_bmad-output/install-state/session-1',
    installed_tools: ['cursor'],
    managed_surface: [],
    managed_global_skill_paths: [],
    preserved_paths: ['_bmad-output'],
    last_uninstall_report_path: '_bmad-output/config/bmad-speckit-uninstall-report.json',
    ...overrides,
  };
}

describe('uninstall command', () => {
  it('deletes created managed entries and preserves _bmad-output', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'uninstall-created-'));
    try {
      const targetFile = path.join(root, '.cursor', 'commands', 'demo.md');
      const sentinel = path.join(root, '_bmad-output', 'sentinel.txt');
      fs.mkdirSync(path.dirname(targetFile), { recursive: true });
      fs.mkdirSync(path.dirname(sentinel), { recursive: true });
      fs.writeFileSync(targetFile, 'managed\n', 'utf8');
      fs.writeFileSync(sentinel, 'keep\n', 'utf8');

      writeInstallManifest(
        root,
        createBaseManifest(root, {
          managed_surface: [
            {
              path: '.cursor/commands/demo.md',
              kind: 'host_file',
              owner_agents: ['cursor'],
              delete_policy: 'delete_entry_only',
              preinstall_state: {
                classification: 'created',
                path_existed: false,
                path_kind_before: 'missing',
                content_hash_before: '',
                snapshot_ref: '',
                backup_ref: '',
                captured_at: new Date().toISOString(),
              },
              restore: {
                strategy: 'delete_created',
                source_ref: '',
                skip_reason: '',
              },
              installed_state: {
                path_exists_after_install: true,
                path_kind_after_install: 'file',
                content_hash_after_install: require('../src/services/install-surface-manifest').hashPath(targetFile),
                captured_at: new Date().toISOString(),
              },
            },
          ],
        })
      );

      uninstallCommand({ target: root });

      assert.strictEqual(fs.existsSync(targetFile), false);
      assert.strictEqual(fs.existsSync(path.join(root, '.cursor')), true);
      assert.strictEqual(fs.existsSync(sentinel), true);
      assert.strictEqual(fs.existsSync(getInstallManifestPath(root)), false);
      assert.strictEqual(fs.existsSync(getUninstallReportPath(root)), true);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('restores overwritten file from snapshot', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'uninstall-overwritten-'));
    try {
      const targetFile = path.join(root, '.cursor', 'hooks.json');
      const snapshotFile = path.join(root, '_bmad-output', 'install-state', 'session-1', 'surface', '.cursor', 'hooks.json');
      fs.mkdirSync(path.dirname(targetFile), { recursive: true });
      writeJson(snapshotFile, { before: true });
      writeJson(targetFile, { after: true });

      writeInstallManifest(
        root,
        createBaseManifest(root, {
          managed_surface: [
            {
              path: '.cursor/hooks.json',
              kind: 'host_generated_file',
              owner_agents: ['cursor'],
              delete_policy: 'match_generated_only',
              preinstall_state: {
                classification: 'overwritten',
                path_existed: true,
                path_kind_before: 'file',
                content_hash_before: 'before',
                snapshot_ref: '_bmad-output/install-state/session-1/surface/.cursor/hooks.json',
                backup_ref: '',
                captured_at: new Date().toISOString(),
              },
              restore: {
                strategy: 'restore_snapshot',
                source_ref: '_bmad-output/install-state/session-1/surface/.cursor/hooks.json',
                skip_reason: '',
              },
              installed_state: {
                path_exists_after_install: true,
                path_kind_after_install: 'file',
                content_hash_after_install: require('../src/services/install-surface-manifest').hashPath(targetFile),
                captured_at: new Date().toISOString(),
              },
            },
          ],
        })
      );

      uninstallCommand({ target: root });

      assert.deepStrictEqual(JSON.parse(fs.readFileSync(targetFile, 'utf8')), { before: true });
      assert.strictEqual(fs.existsSync(getInstallManifestPath(root)), false);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('retries transient EPERM when restoring overwritten file from snapshot', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'uninstall-overwritten-retry-'));
    const originalCopyFileSync = fs.copyFileSync;
    let failOnce = true;
    try {
      const targetFile = path.join(root, '.claude', 'commands', 'demo.md');
      const snapshotFile = path.join(
        root,
        '_bmad-output',
        'install-state',
        'session-1',
        'surface',
        '.claude',
        'commands',
        'demo.md'
      );
      fs.mkdirSync(path.dirname(targetFile), { recursive: true });
      fs.mkdirSync(path.dirname(snapshotFile), { recursive: true });
      fs.writeFileSync(snapshotFile, 'before\n', 'utf8');
      fs.writeFileSync(targetFile, 'after\n', 'utf8');

      writeInstallManifest(
        root,
        createBaseManifest(root, {
          managed_surface: [
            {
              path: '.claude/commands/demo.md',
              kind: 'host_file',
              owner_agents: ['claude-code'],
              delete_policy: 'delete_entry_only',
              preinstall_state: {
                classification: 'overwritten',
                path_existed: true,
                path_kind_before: 'file',
                content_hash_before: 'before',
                snapshot_ref: '_bmad-output/install-state/session-1/surface/.claude/commands/demo.md',
                backup_ref: '',
                captured_at: new Date().toISOString(),
              },
              restore: {
                strategy: 'restore_snapshot',
                source_ref: '_bmad-output/install-state/session-1/surface/.claude/commands/demo.md',
                skip_reason: '',
              },
              installed_state: {
                path_exists_after_install: true,
                path_kind_after_install: 'file',
                content_hash_after_install: require('../src/services/install-surface-manifest').hashPath(targetFile),
                captured_at: new Date().toISOString(),
              },
            },
          ],
          installed_tools: ['claude-code'],
        })
      );

      fs.copyFileSync = (src, dest) => {
        if (failOnce && dest === targetFile) {
          failOnce = false;
          const error = new Error('EPERM simulated');
          error.code = 'EPERM';
          throw error;
        }
        return originalCopyFileSync(src, dest);
      };

      uninstallCommand({ target: root, agent: 'claude-code' });

      assert.strictEqual(fs.readFileSync(targetFile, 'utf8'), 'before\n');
      assert.strictEqual(fs.existsSync(getInstallManifestPath(root)), false);
    } finally {
      fs.copyFileSync = originalCopyFileSync;
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('does not crash when restoring overwritten file keeps failing with EPERM', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'uninstall-overwritten-skip-'));
    const originalCopyFileSync = fs.copyFileSync;
    try {
      const targetFile = path.join(root, '.claude', 'commands', 'demo.md');
      const snapshotFile = path.join(
        root,
        '_bmad-output',
        'install-state',
        'session-1',
        'surface',
        '.claude',
        'commands',
        'demo.md'
      );
      fs.mkdirSync(path.dirname(targetFile), { recursive: true });
      fs.mkdirSync(path.dirname(snapshotFile), { recursive: true });
      fs.writeFileSync(snapshotFile, 'before\n', 'utf8');
      fs.writeFileSync(targetFile, 'after\n', 'utf8');

      writeInstallManifest(
        root,
        createBaseManifest(root, {
          managed_surface: [
            {
              path: '.claude/commands/demo.md',
              kind: 'host_file',
              owner_agents: ['claude-code'],
              delete_policy: 'delete_entry_only',
              preinstall_state: {
                classification: 'overwritten',
                path_existed: true,
                path_kind_before: 'file',
                content_hash_before: 'before',
                snapshot_ref: '_bmad-output/install-state/session-1/surface/.claude/commands/demo.md',
                backup_ref: '',
                captured_at: new Date().toISOString(),
              },
              restore: {
                strategy: 'restore_snapshot',
                source_ref: '_bmad-output/install-state/session-1/surface/.claude/commands/demo.md',
                skip_reason: '',
              },
              installed_state: {
                path_exists_after_install: true,
                path_kind_after_install: 'file',
                content_hash_after_install: require('../src/services/install-surface-manifest').hashPath(targetFile),
                captured_at: new Date().toISOString(),
              },
            },
          ],
          installed_tools: ['claude-code'],
        })
      );

      fs.copyFileSync = (src, dest) => {
        if (dest === targetFile) {
          const error = new Error('EPERM simulated');
          error.code = 'EPERM';
          throw error;
        }
        return originalCopyFileSync(src, dest);
      };

      uninstallCommand({ target: root, agent: 'claude-code' });

      const report = JSON.parse(fs.readFileSync(getUninstallReportPath(root), 'utf8'));
      assert.strictEqual(report.skipped_entries.length, 1);
      assert.match(report.skipped_entries[0].skip_reason, /filesystem_EPERM/);
      assert.strictEqual(fs.existsSync(getInstallManifestPath(root)), true);
      assert.strictEqual(fs.readFileSync(targetFile, 'utf8'), 'after\n');
    } finally {
      fs.copyFileSync = originalCopyFileSync;
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('keeps preexisting-unmanaged entry and writes skipped report', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'uninstall-skip-'));
    try {
      const targetFile = path.join(root, '.cursor', 'rules', 'custom.mdc');
      fs.mkdirSync(path.dirname(targetFile), { recursive: true });
      fs.writeFileSync(targetFile, 'user\n', 'utf8');
      writeInstallManifest(
        root,
        createBaseManifest(root, {
          managed_surface: [
            {
              path: '.cursor/rules/custom.mdc',
              kind: 'host_file',
              owner_agents: ['cursor'],
              delete_policy: 'delete_entry_only',
              preinstall_state: {
                classification: 'preexisting-unmanaged',
                path_existed: true,
                path_kind_before: 'file',
                content_hash_before: 'sha',
                snapshot_ref: '',
                backup_ref: '',
                captured_at: new Date().toISOString(),
              },
              restore: {
                strategy: 'skip_report',
                source_ref: '',
                skip_reason: 'preexisting_path_without_safe_restore_source',
              },
              installed_state: {
                path_exists_after_install: true,
                path_kind_after_install: 'file',
                content_hash_after_install: require('../src/services/install-surface-manifest').hashPath(targetFile),
                captured_at: new Date().toISOString(),
              },
            },
          ],
        })
      );

      uninstallCommand({ target: root });

      assert.strictEqual(fs.existsSync(targetFile), true);
      const report = JSON.parse(fs.readFileSync(getUninstallReportPath(root), 'utf8'));
      assert.strictEqual(report.skipped_entries.length, 1);
      assert.strictEqual(report.skipped_entries[0].classification, 'preexisting-unmanaged');
      assert.strictEqual(fs.existsSync(getInstallManifestPath(root)), true);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('supports partial uninstall by owner_agents rewrite', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'uninstall-partial-'));
    try {
      const cursorFile = path.join(root, '.cursor', 'commands', 'demo.md');
      const sharedDir = path.join(root, '_bmad');
      fs.mkdirSync(path.dirname(cursorFile), { recursive: true });
      fs.mkdirSync(sharedDir, { recursive: true });
      fs.writeFileSync(cursorFile, 'managed\n', 'utf8');
      fs.writeFileSync(path.join(sharedDir, 'marker.txt'), 'shared\n', 'utf8');

      writeInstallManifest(
        root,
        createBaseManifest(root, {
          installed_tools: ['cursor', 'claude-code'],
          managed_surface: [
            {
              path: '.cursor/commands/demo.md',
              kind: 'host_file',
              owner_agents: ['cursor'],
              delete_policy: 'delete_entry_only',
              preinstall_state: {
                classification: 'created',
                path_existed: false,
                path_kind_before: 'missing',
                content_hash_before: '',
                snapshot_ref: '',
                backup_ref: '',
                captured_at: new Date().toISOString(),
              },
              restore: { strategy: 'delete_created', source_ref: '', skip_reason: '' },
              installed_state: {
                path_exists_after_install: true,
                path_kind_after_install: 'file',
                content_hash_after_install: require('../src/services/install-surface-manifest').hashPath(cursorFile),
                captured_at: new Date().toISOString(),
              },
            },
            {
              path: '_bmad',
              kind: 'project_private_dir',
              owner_agents: ['cursor', 'claude-code'],
              delete_policy: 'delete_when_owner_agents_empty',
              preinstall_state: {
                classification: 'created',
                path_existed: false,
                path_kind_before: 'missing',
                content_hash_before: '',
                snapshot_ref: '',
                backup_ref: '',
                captured_at: new Date().toISOString(),
              },
              restore: { strategy: 'delete_created', source_ref: '', skip_reason: '' },
              installed_state: {
                path_exists_after_install: true,
                path_kind_after_install: 'dir',
                content_hash_after_install: require('../src/services/install-surface-manifest').hashPath(sharedDir),
                captured_at: new Date().toISOString(),
              },
            },
          ],
        })
      );

      uninstallCommand({ target: root, agent: 'cursor' });

      assert.strictEqual(fs.existsSync(cursorFile), false);
      assert.strictEqual(fs.existsSync(sharedDir), true);
      const manifest = JSON.parse(fs.readFileSync(getInstallManifestPath(root), 'utf8'));
      assert.deepStrictEqual(manifest.installed_tools, ['claude-code']);
      assert.deepStrictEqual(manifest.managed_surface[0].owner_agents, ['claude-code']);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails closed when manifest is missing', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'uninstall-missing-'));
    try {
      const result = spawnSync('node', [BIN, 'uninstall', '--target', root], {
        cwd: path.join(__dirname, '..'),
        encoding: 'utf8',
      });
      assert.strictEqual(result.status, 1);
      assert.match(result.stderr || '', /install manifest missing/i);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
