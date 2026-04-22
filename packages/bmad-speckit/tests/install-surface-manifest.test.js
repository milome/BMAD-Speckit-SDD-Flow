const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const {
  createInstallStateTracker,
  getInstallManifestPath,
  getInstallStateRoot,
  normalizeAgentList,
  readInstallManifest,
} = require('../src/services/install-surface-manifest');
const ROOT_PACKAGE_VERSION = require('../../../package.json').version;

function writeJson(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2) + '\n', 'utf8');
}

describe('install-surface-manifest helper', () => {
  it('normalizes agent aliases to canonical runtime ids', () => {
    assert.deepStrictEqual(normalizeAgentList('cursor-agent,claude'), ['cursor', 'claude-code']);
  });

  it('captures overwritten project file state and writes manifest + snapshot root', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'manifest-helper-'));
    try {
      const targetFile = path.join(root, '.cursor', 'hooks.json');
      fs.mkdirSync(path.dirname(targetFile), { recursive: true });
      fs.writeFileSync(targetFile, '{"before":true}\n', 'utf8');

      const tracker = createInstallStateTracker({
        projectRoot: root,
        packageName: 'bmad-speckit-sdd-flow',
        packageVersion: ROOT_PACKAGE_VERSION,
        installedVia: 'postinstall',
        installedTools: ['cursor'],
      });
      tracker.registerProjectSpec({
        logicalPath: '.cursor/hooks.json',
        kind: 'host_generated_file',
        ownerAgents: ['cursor'],
        deletePolicy: 'match_generated_only',
      });

      fs.writeFileSync(targetFile, '{"after":true}\n', 'utf8');
      const manifest = tracker.finalize();

      const written = readInstallManifest(root);
      assert.ok(written, 'manifest should exist');
      assert.strictEqual(written.install_session_id, manifest.install_session_id);
      assert.strictEqual(written.snapshot_root.includes('_bmad-output/install-state/'), true);
      assert.strictEqual(written.managed_surface.length, 1);
      assert.strictEqual(
        written.managed_surface[0].preinstall_state.classification,
        'overwritten'
      );
      const snapshotAbs = path.join(root, written.managed_surface[0].preinstall_state.snapshot_ref);
      assert.ok(fs.existsSync(snapshotAbs), 'snapshot should exist');
      assert.strictEqual(fs.readFileSync(snapshotAbs, 'utf8'), '{"before":true}\n');
      assert.strictEqual(written.managed_surface[0].installed_state.content_hash_after_install.length > 0, true);
      assert.ok(fs.existsSync(getInstallManifestPath(root)));
      assert.ok(fs.existsSync(getInstallStateRoot(root, manifest.install_session_id)));
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('marks missing target as created', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'manifest-created-'));
    try {
      const tracker = createInstallStateTracker({
        projectRoot: root,
        packageName: 'bmad-speckit',
        packageVersion: ROOT_PACKAGE_VERSION,
        installedVia: 'bmad-speckit-init-command',
        installedTools: ['cursor-agent'],
      });
      tracker.registerProjectSpec({
        logicalPath: '.cursor/commands/demo.md',
        kind: 'host_file',
        ownerAgents: ['cursor'],
        deletePolicy: 'delete_entry_only',
      });
      const targetFile = path.join(root, '.cursor', 'commands', 'demo.md');
      fs.mkdirSync(path.dirname(targetFile), { recursive: true });
      fs.writeFileSync(targetFile, 'new\n', 'utf8');
      const manifest = tracker.finalize();
      assert.strictEqual(manifest.installed_tools[0], 'cursor');
      assert.strictEqual(manifest.managed_surface[0].preinstall_state.classification, 'created');
      assert.strictEqual(manifest.managed_surface[0].restore.strategy, 'delete_created');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('merges existing manifest installed_tools and managed entries across repeated init/install sessions', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'manifest-merge-'));
    try {
      const cursorFile = path.join(root, '.cursor', 'commands', 'demo.md');
      fs.mkdirSync(path.dirname(cursorFile), { recursive: true });
      fs.writeFileSync(cursorFile, 'cursor\n', 'utf8');

      writeJson(getInstallManifestPath(root), {
        manifest_version: 2,
        install_session_id: 'old-session',
        package_name: 'bmad-speckit-sdd-flow',
        package_version: ROOT_PACKAGE_VERSION,
        installed_via: 'postinstall',
        generated_at: new Date().toISOString(),
        project_root: root,
        snapshot_root: '_bmad-output/install-state/old-session',
        installed_tools: ['cursor'],
        managed_surface: [
          {
            path: '.cursor/commands/demo.md',
            kind: 'host_file',
            owner_agents: ['cursor'],
            delete_policy: 'delete_entry_only',
            preinstall_state: { classification: 'created' },
            restore: { strategy: 'delete_created', source_ref: '', skip_reason: '' },
            installed_state: {
              path_exists_after_install: true,
              path_kind_after_install: 'file',
              content_hash_after_install: 'hash',
              captured_at: new Date().toISOString(),
            },
          },
        ],
        managed_global_skill_paths: [],
        preserved_paths: ['_bmad-output'],
        last_uninstall_report_path: '_bmad-output/config/bmad-speckit-uninstall-report.json',
      });

      const claudeFile = path.join(root, '.claude', 'rules', 'rule.md');
      fs.mkdirSync(path.dirname(claudeFile), { recursive: true });
      fs.writeFileSync(claudeFile, 'claude\n', 'utf8');

      const tracker = createInstallStateTracker({
        projectRoot: root,
        packageName: 'bmad-speckit-sdd-flow',
        packageVersion: ROOT_PACKAGE_VERSION,
        installedVia: 'bmad-speckit-init',
        installedTools: ['claude-code'],
      });
      tracker.registerProjectSpec({
        logicalPath: '.claude/rules/rule.md',
        kind: 'host_file',
        ownerAgents: ['claude-code'],
        deletePolicy: 'delete_entry_only',
      });

      const manifest = tracker.finalize();
      assert.deepStrictEqual(manifest.installed_tools, ['claude-code', 'cursor']);
      const paths = manifest.managed_surface.map((entry) => entry.path).sort();
      assert.deepStrictEqual(paths, ['.claude/rules/rule.md', '.cursor/commands/demo.md']);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
