const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const AIRegistry = require('./ai-registry');

const KNOWN_AGENT_IDS = ['cursor', 'claude-code', 'codex'];
const AGENT_ID_ALIASES = {
  'cursor-agent': 'cursor',
  claude: 'claude-code',
};
const TOOL_TO_REGISTRY_ID = {
  cursor: 'cursor-agent',
  'claude-code': 'claude',
  codex: 'codex',
};

const MANIFEST_REL_PATH = path.join('_bmad-output', 'config', 'bmad-speckit-install-manifest.json');
const UNINSTALL_REPORT_REL_PATH = path.join('_bmad-output', 'config', 'bmad-speckit-uninstall-report.json');
const INSTALL_STATE_ROOT_REL_PATH = path.join('_bmad-output', 'install-state');
const ACCEPTED_CONSUMER_MAIN_AGENT_HOOK_FILES = Object.freeze([
  'emit-runtime-policy.cjs',
  'resolve-for-session.cjs',
  'render-audit-block.cjs',
  'runtime-policy-inject.cjs',
  'post-tool-use.cjs',
  'pre-continue-check.cjs',
  'write-runtime-context.cjs',
]);
const LEGACY_CONSUMER_HOOK_PATTERNS = Object.freeze([
  /^run-bmad-.*\.cjs$/i,
  /^governance-cursor-agent-.*\.cjs$/i,
  /^governance-.*worker\.cjs$/i,
  /^governance-.*runner\.cjs$/i,
  /^governance-.*(?:ingestor|reconciler)\.cjs$/i,
]);

function toPortablePath(value) {
  return String(value).replace(/\\/g, '/');
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function readJsonSafe(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function writeJson(filePath, value) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + '\n', 'utf8');
}

function removePath(targetPath) {
  if (!fs.existsSync(targetPath)) return;
  fs.rmSync(targetPath, { recursive: true, force: true });
}

function isAcceptedConsumerMainAgentHookFile(fileName) {
  return ACCEPTED_CONSUMER_MAIN_AGENT_HOOK_FILES.includes(String(fileName || ''));
}

function isUnexpectedLegacyConsumerHookFile(fileName) {
  const normalized = String(fileName || '');
  if (!normalized || isAcceptedConsumerMainAgentHookFile(normalized)) {
    return false;
  }
  return LEGACY_CONSUMER_HOOK_PATTERNS.some((pattern) => pattern.test(normalized));
}

function listUnexpectedLegacyConsumerHookFiles(hookDir) {
  if (!fs.existsSync(hookDir) || !fs.statSync(hookDir).isDirectory()) {
    return [];
  }
  return fs
    .readdirSync(hookDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && isUnexpectedLegacyConsumerHookFile(entry.name))
    .map((entry) => path.join(hookDir, entry.name));
}

function removeUnexpectedLegacyConsumerHookFiles(hookDir) {
  const removed = listUnexpectedLegacyConsumerHookFiles(hookDir);
  for (const filePath of removed) {
    removePath(filePath);
  }
  return removed;
}

function copyRecursive(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    ensureDir(dest);
    for (const entry of fs.readdirSync(src)) {
      copyRecursive(path.join(src, entry), path.join(dest, entry));
    }
    return;
  }
  ensureDir(path.dirname(dest));
  fs.copyFileSync(src, dest);
}

function hashPath(targetPath) {
  if (!fs.existsSync(targetPath)) return '';
  const hash = crypto.createHash('sha256');

  function walk(currentPath, basePath) {
    const stat = fs.statSync(currentPath);
    const rel = toPortablePath(path.relative(basePath, currentPath)) || '.';
    hash.update(`${stat.isDirectory() ? 'dir' : 'file'}:${rel}\n`);
    if (stat.isDirectory()) {
      const entries = fs.readdirSync(currentPath).sort((a, b) => a.localeCompare(b));
      for (const entry of entries) {
        walk(path.join(currentPath, entry), basePath);
      }
      return;
    }
    hash.update(fs.readFileSync(currentPath));
    hash.update('\n');
  }

  walk(targetPath, targetPath);
  return hash.digest('hex');
}

function getInstallManifestPath(projectRoot) {
  return path.join(projectRoot, MANIFEST_REL_PATH);
}

function getUninstallReportPath(projectRoot) {
  return path.join(projectRoot, UNINSTALL_REPORT_REL_PATH);
}

function getInstallStateRoot(projectRoot, installSessionId) {
  return path.join(projectRoot, INSTALL_STATE_ROOT_REL_PATH, installSessionId);
}

function readInstallManifest(projectRoot) {
  return readJsonSafe(getInstallManifestPath(projectRoot));
}

function writeInstallManifest(projectRoot, payload) {
  writeJson(getInstallManifestPath(projectRoot), payload);
}

function removeInstallManifest(projectRoot) {
  removePath(getInstallManifestPath(projectRoot));
}

function writeUninstallReport(projectRoot, payload) {
  writeJson(getUninstallReportPath(projectRoot), payload);
}

function normalizeAgentId(agentId) {
  if (!agentId) return null;
  const normalized = AGENT_ID_ALIASES[agentId] || agentId;
  return KNOWN_AGENT_IDS.includes(normalized) ? normalized : null;
}

function normalizeAgentList(agentValue) {
  if (!agentValue) return [];
  const raw = Array.isArray(agentValue)
    ? agentValue
    : String(agentValue)
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
  const result = [];
  for (const item of raw) {
    const normalized = normalizeAgentId(item);
    if (normalized && !result.includes(normalized)) result.push(normalized);
  }
  return result;
}

function getInstallStateSnapshotRootRel(installSessionId) {
  return toPortablePath(path.join(INSTALL_STATE_ROOT_REL_PATH, installSessionId));
}

function makeInstallSessionId() {
  return typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : crypto.randomBytes(16).toString('hex');
}

function sanitizeExternalName(targetPath) {
  const base = path.basename(targetPath) || 'entry';
  const digest = crypto.createHash('sha1').update(targetPath).digest('hex').slice(0, 12);
  return `${base}-${digest}`;
}

function createSnapshotLocation(projectRoot, installSessionId, scope, logicalPath) {
  if (scope === 'project') {
    return {
      abs: path.join(getInstallStateRoot(projectRoot, installSessionId), 'surface', logicalPath),
      rel: toPortablePath(path.join(getInstallStateSnapshotRootRel(installSessionId), 'surface', logicalPath)),
    };
  }

  const safeName = sanitizeExternalName(logicalPath);
  return {
    abs: path.join(getInstallStateRoot(projectRoot, installSessionId), 'global-skills', safeName),
    rel: toPortablePath(
      path.join(getInstallStateSnapshotRootRel(installSessionId), 'global-skills', safeName)
    ),
  };
}

function capturePreinstallState(projectRoot, installSessionId, absPath, scope, logicalPath) {
  const capturedAt = new Date().toISOString();
  if (!fs.existsSync(absPath)) {
    return {
      classification: 'created',
      path_existed: false,
      path_kind_before: 'missing',
      content_hash_before: '',
      snapshot_ref: '',
      backup_ref: '',
      captured_at: capturedAt,
    };
  }

  const stat = fs.statSync(absPath);
  const snapshot = createSnapshotLocation(projectRoot, installSessionId, scope, logicalPath);
  const contentHashBefore = hashPath(absPath);

  try {
    copyRecursive(absPath, snapshot.abs);
    return {
      classification: 'overwritten',
      path_existed: true,
      path_kind_before: stat.isDirectory() ? 'dir' : 'file',
      content_hash_before: contentHashBefore,
      snapshot_ref: snapshot.rel,
      backup_ref: '',
      captured_at: capturedAt,
    };
  } catch (error) {
    return {
      classification: 'preexisting-unmanaged',
      path_existed: true,
      path_kind_before: stat.isDirectory() ? 'dir' : 'file',
      content_hash_before: contentHashBefore,
      snapshot_ref: '',
      backup_ref: '',
      captured_at: capturedAt,
      capture_error: error instanceof Error ? error.message : String(error),
    };
  }
}

function createRestoreState(preinstallState) {
  if (!preinstallState || preinstallState.classification === 'created') {
    return {
      strategy: 'delete_created',
      source_ref: '',
      skip_reason: '',
    };
  }

  if (preinstallState.classification === 'overwritten') {
    return {
      strategy: preinstallState.snapshot_ref ? 'restore_snapshot' : 'restore_backup',
      source_ref: preinstallState.snapshot_ref || preinstallState.backup_ref || '',
      skip_reason: '',
    };
  }

  return {
    strategy: 'skip_report',
    source_ref: '',
    skip_reason: preinstallState.capture_error || 'preexisting_path_without_safe_restore_source',
  };
}

function readDirNamesSafe(dirPath) {
  if (!fs.existsSync(dirPath) || !fs.statSync(dirPath).isDirectory()) return [];
  return fs.readdirSync(dirPath).sort((a, b) => a.localeCompare(b));
}

function collectImmediateChildSpecs(sourceDir, destDir, kind, ownerAgents, deletePolicy) {
  if (!fs.existsSync(sourceDir) || !fs.statSync(sourceDir).isDirectory()) return [];
  return readDirNamesSafe(sourceDir).map((entry) => {
    const src = path.join(sourceDir, entry);
    const stat = fs.statSync(src);
    return {
      logicalPath: toPortablePath(path.join(destDir, entry)),
      kind: stat.isDirectory() ? (kind === 'host_file' ? 'host_dir' : kind) : kind,
      ownerAgents,
      deletePolicy,
      scope: 'project',
    };
  });
}

function collectSkillNamesFromRoot(root) {
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) return [];
  const result = new Set();

  function walk(current) {
    const entries = fs.readdirSync(current, { withFileTypes: true });
    if (entries.some((entry) => entry.isFile() && entry.name === 'SKILL.md')) {
      result.add(path.basename(current));
      return;
    }
    for (const entry of entries) {
      if (entry.isDirectory()) {
        walk(path.join(current, entry.name));
      }
    }
  }

  walk(root);
  return [...result];
}

function collectTopLevelSkillDirs(root) {
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) return [];
  return fs
    .readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
}

function getPublishedSkillNames(bmadRoot, platformSkillsDir) {
  const skillNames = new Set();
  for (const name of collectTopLevelSkillDirs(path.join(bmadRoot, 'skills'))) {
    skillNames.add(name);
  }
  const recursiveRoots = [
    path.join(bmadRoot, 'bmm', 'workflows'),
    path.join(bmadRoot, 'bmm', 'agents'),
    path.join(bmadRoot, 'core', 'tasks'),
    path.join(bmadRoot, 'core', 'skills'),
  ];
  for (const root of recursiveRoots) {
    for (const name of collectSkillNamesFromRoot(root)) {
      skillNames.add(name);
    }
  }
  if (platformSkillsDir) {
    for (const name of collectTopLevelSkillDirs(platformSkillsDir)) {
      skillNames.add(name);
    }
  }
  return [...skillNames].sort((a, b) => a.localeCompare(b));
}

function collectManagedSurfaceSpecs(projectRoot, bmadRoot, installedTools) {
  const normalizedTools = normalizeAgentList(installedTools);
  const specs = new Map();
  const add = (spec) => {
    const key = `${spec.scope || 'project'}:${spec.logicalPath}`;
    const existing = specs.get(key);
    if (existing) {
      const ownerAgents = new Set([...(existing.ownerAgents || []), ...(spec.ownerAgents || [])]);
      existing.ownerAgents = [...ownerAgents].sort((a, b) => a.localeCompare(b));
      if (!existing.deletePolicy && spec.deletePolicy) existing.deletePolicy = spec.deletePolicy;
      return;
    }
    specs.set(key, {
      scope: spec.scope || 'project',
      logicalPath: spec.logicalPath,
      kind: spec.kind,
      ownerAgents: [...new Set(spec.ownerAgents || [])].sort((a, b) => a.localeCompare(b)),
      deletePolicy: spec.deletePolicy,
    });
  };

  if (normalizedTools.length > 0) {
    add({
      logicalPath: '_bmad',
      kind: 'project_private_dir',
      ownerAgents: normalizedTools,
      deletePolicy: 'delete_when_owner_agents_empty',
    });
    add({
      logicalPath: '.specify',
      kind: 'project_private_dir',
      ownerAgents: normalizedTools,
      deletePolicy: 'delete_when_owner_agents_empty',
    });
  }

  for (const agentId of normalizedTools) {
    if (agentId === 'cursor') {
      const ownerAgents = ['cursor'];
      for (const spec of collectImmediateChildSpecs(path.join(bmadRoot, 'commands'), '.cursor/commands', 'host_file', ownerAgents, 'delete_entry_only')) add(spec);
      for (const spec of collectImmediateChildSpecs(path.join(bmadRoot, 'speckit', 'commands'), '.cursor/commands', 'host_file', ownerAgents, 'delete_entry_only')) add(spec);
      for (const spec of collectImmediateChildSpecs(path.join(bmadRoot, 'cursor', 'rules'), '.cursor/rules', 'host_file', ownerAgents, 'delete_entry_only')) add(spec);
      for (const spec of collectImmediateChildSpecs(path.join(bmadRoot, 'cursor', 'agents'), '.cursor/agents', 'host_file', ownerAgents, 'delete_entry_only')) add(spec);
      for (const spec of collectImmediateChildSpecs(path.join(bmadRoot, 'i18n'), '.cursor/i18n', 'host_file', ownerAgents, 'delete_entry_only')) add(spec);
      for (const spec of collectImmediateChildSpecs(path.join(bmadRoot, 'runtime', 'hooks'), '.cursor/hooks', 'host_file', ownerAgents, 'delete_entry_only')) add(spec);
      for (const spec of collectImmediateChildSpecs(path.join(bmadRoot, 'cursor', 'hooks'), '.cursor/hooks', 'host_file', ownerAgents, 'delete_entry_only')) add(spec);
      add({
        logicalPath: '.cursor/hooks.json',
        kind: 'host_generated_file',
        ownerAgents,
        deletePolicy: 'match_generated_only',
      });
      add({
        logicalPath: '.cursor/agents/code-reviewer-config.yaml',
        kind: 'host_file',
        ownerAgents,
        deletePolicy: 'delete_entry_only',
      });
      for (const emittedName of [
        'emit-runtime-policy.cjs',
        'resolve-for-session.cjs',
        'render-audit-block.cjs',
        'write-runtime-context.cjs',
      ]) {
        add({
          logicalPath: toPortablePath(path.join('.cursor', 'hooks', emittedName)),
          kind: 'host_generated_file',
          ownerAgents,
          deletePolicy: 'delete_entry_only',
        });
      }
      const cursorPlatformSkillsDir = path.join(bmadRoot, 'cursor', 'skills');
      for (const skillName of getPublishedSkillNames(bmadRoot, cursorPlatformSkillsDir)) {
        add({
          logicalPath: toPortablePath(path.join('.cursor', 'skills', skillName)),
          kind: 'host_skill_dir',
          ownerAgents,
          deletePolicy: 'delete_entry_only',
        });
      }
    }

    if (agentId === 'claude-code') {
      const ownerAgents = ['claude-code'];
      for (const spec of collectImmediateChildSpecs(path.join(bmadRoot, 'commands'), '.claude/commands', 'host_file', ownerAgents, 'delete_entry_only')) add(spec);
      for (const spec of collectImmediateChildSpecs(path.join(bmadRoot, 'speckit', 'commands'), '.claude/commands', 'host_file', ownerAgents, 'delete_entry_only')) add(spec);
      for (const spec of collectImmediateChildSpecs(path.join(bmadRoot, 'claude', 'rules'), '.claude/rules', 'host_file', ownerAgents, 'delete_entry_only')) add(spec);
      for (const spec of collectImmediateChildSpecs(path.join(bmadRoot, 'claude', 'agents'), '.claude/agents', 'host_file', ownerAgents, 'delete_entry_only')) add(spec);
      for (const spec of collectImmediateChildSpecs(path.join(bmadRoot, 'claude', 'hooks'), '.claude/hooks', 'host_file', ownerAgents, 'delete_entry_only')) add(spec);
      for (const spec of collectImmediateChildSpecs(path.join(bmadRoot, 'runtime', 'hooks'), '.claude/hooks', 'host_file', ownerAgents, 'delete_entry_only')) add(spec);
      for (const spec of collectImmediateChildSpecs(path.join(bmadRoot, 'i18n'), '.claude/i18n', 'host_file', ownerAgents, 'delete_entry_only')) add(spec);
      for (const spec of collectImmediateChildSpecs(path.join(bmadRoot, 'claude', 'protocols'), '.claude/protocols', 'host_file', ownerAgents, 'delete_entry_only')) add(spec);
      for (const spec of collectImmediateChildSpecs(path.join(bmadRoot, 'claude', 'state'), '.claude/state', 'host_file', ownerAgents, 'delete_entry_only')) add(spec);
      add({
        logicalPath: '.claude/settings.json',
        kind: 'host_generated_file',
        ownerAgents,
        deletePolicy: 'match_generated_only',
      });
      add({
        logicalPath: 'CLAUDE.md',
        kind: 'project_doc',
        ownerAgents,
        deletePolicy: 'match_generated_only',
      });
      for (const emittedName of [
        'emit-runtime-policy.cjs',
        'resolve-for-session.cjs',
        'render-audit-block.cjs',
        'write-runtime-context.cjs',
      ]) {
        add({
          logicalPath: toPortablePath(path.join('.claude', 'hooks', emittedName)),
          kind: 'host_generated_file',
          ownerAgents,
          deletePolicy: 'delete_entry_only',
        });
      }
      const claudePlatformSkillsDir = path.join(bmadRoot, 'claude', 'skills');
      for (const skillName of getPublishedSkillNames(bmadRoot, claudePlatformSkillsDir)) {
        add({
          logicalPath: toPortablePath(path.join('.claude', 'skills', skillName)),
          kind: 'host_skill_dir',
          ownerAgents,
          deletePolicy: 'delete_entry_only',
        });
      }
    }

    if (agentId === 'codex') {
      const ownerAgents = ['codex'];
      for (const spec of collectImmediateChildSpecs(path.join(bmadRoot, 'commands'), '.codex/commands', 'host_file', ownerAgents, 'delete_entry_only')) add(spec);
      for (const spec of collectImmediateChildSpecs(path.join(bmadRoot, 'speckit', 'commands'), '.codex/commands', 'host_file', ownerAgents, 'delete_entry_only')) add(spec);
      for (const spec of collectImmediateChildSpecs(path.join(bmadRoot, 'i18n'), '.codex/i18n', 'host_file', ownerAgents, 'delete_entry_only')) add(spec);
      for (const spec of collectImmediateChildSpecs(path.join(bmadRoot, 'codex', 'agents'), '.codex/agents', 'host_file', ownerAgents, 'delete_entry_only')) add(spec);
      for (const spec of collectImmediateChildSpecs(path.join(bmadRoot, 'codex', 'protocols'), '.codex/protocols', 'host_file', ownerAgents, 'delete_entry_only')) add(spec);
      for (const spec of collectImmediateChildSpecs(path.join(bmadRoot, 'codex', 'skills'), '.codex/skills', 'host_file', ownerAgents, 'delete_entry_only')) add(spec);
      add({
        logicalPath: '.codex/README.md',
        kind: 'host_generated_file',
        ownerAgents,
        deletePolicy: 'match_generated_only',
      });
      for (const skillName of getPublishedSkillNames(bmadRoot, null)) {
        add({
          logicalPath: toPortablePath(path.join('.codex', 'skills', skillName)),
          kind: 'host_skill_dir',
          ownerAgents,
          deletePolicy: 'delete_entry_only',
        });
      }
    }
  }

  return [...specs.values()];
}

function collectManagedGlobalSkillSpecs(projectRoot, bmadRoot, installedTools) {
  const normalizedTools = normalizeAgentList(installedTools);
  const specs = new Map();

  for (const agentId of normalizedTools) {
    const entry = AIRegistry.getById(TOOL_TO_REGISTRY_ID[agentId] || agentId, { cwd: projectRoot });
    if (!entry || !entry.configTemplate) continue;
    const destRaw = entry.configTemplate.skillsDir;
    if (!destRaw || !String(destRaw).trim()) continue;
    const destFull = path.isAbsolute(destRaw) ? destRaw : path.join(projectRoot, destRaw);
    const platformSkillsDir =
      agentId === 'cursor'
        ? path.join(bmadRoot, 'cursor', 'skills')
        : agentId === 'claude-code'
          ? path.join(bmadRoot, 'claude', 'skills')
          : null;
    const skillNames = getPublishedSkillNames(bmadRoot, platformSkillsDir);
    for (const skillName of skillNames) {
      const logicalPath = toPortablePath(path.join(destFull, skillName));
      const key = `global:${logicalPath}`;
      const existing = specs.get(key);
      if (existing) {
        if (!existing.ownerAgents.includes(agentId)) {
          existing.ownerAgents.push(agentId);
          existing.ownerAgents.sort((a, b) => a.localeCompare(b));
        }
        continue;
      }
      specs.set(key, {
        scope: 'global',
        logicalPath,
        kind: 'global_skill_dir',
        ownerAgents: [agentId],
        deletePolicy: 'delete_entry_only',
      });
    }
  }

  return [...specs.values()];
}

function createInstallStateTracker({
  projectRoot,
  packageName,
  packageVersion,
  installedVia,
  installedTools,
}) {
  const installSessionId = makeInstallSessionId();
  const normalizedInstalledTools = normalizeAgentList(installedTools);
  const existingManifest = readInstallManifest(projectRoot);
  const tracked = new Map();

  function seedExistingEntry(entry, scope) {
    if (!entry || !entry.path) return;
    const key = `${scope}:${entry.path}`;
    tracked.set(key, {
      ...entry,
      _scope: scope,
      _abs_path:
        scope === 'project'
          ? path.join(projectRoot, entry.path)
          : path.resolve(entry.path),
      _seeded: true,
    });
  }

  for (const entry of Array.isArray(existingManifest?.managed_surface)
    ? existingManifest.managed_surface
    : []) {
    seedExistingEntry(entry, 'project');
  }
  for (const entry of Array.isArray(existingManifest?.managed_global_skill_paths)
    ? existingManifest.managed_global_skill_paths
    : []) {
    seedExistingEntry(entry, 'global');
  }

  function registerSpec(spec) {
    const scope = spec.scope || 'project';
    const key = `${scope}:${spec.logicalPath}`;
    const existing = tracked.get(key);
    if (existing) {
      const ownerAgents = new Set([...(existing.owner_agents || []), ...(spec.ownerAgents || [])]);
      existing.owner_agents = [...ownerAgents].sort((a, b) => a.localeCompare(b));
      existing.kind = spec.kind || existing.kind;
      existing.delete_policy = spec.deletePolicy || existing.delete_policy;
      existing._abs_path =
        scope === 'project'
          ? path.join(projectRoot, spec.logicalPath)
          : path.resolve(spec.logicalPath);
      if (!existing._seeded) {
        return existing;
      }
      const preinstallState = capturePreinstallState(
        projectRoot,
        installSessionId,
        existing._abs_path,
        scope,
        spec.logicalPath
      );
      existing.preinstall_state = preinstallState;
      existing.restore = createRestoreState(preinstallState);
      existing._seeded = false;
      return existing;
    }

    const absPath =
      scope === 'project'
        ? path.join(projectRoot, spec.logicalPath)
        : spec.logicalPath;
    const preinstallState = capturePreinstallState(
      projectRoot,
      installSessionId,
      absPath,
      scope,
      spec.logicalPath
    );
    const entry = {
      path: toPortablePath(spec.logicalPath),
      kind: spec.kind,
      owner_agents: [...new Set(spec.ownerAgents || [])].sort((a, b) => a.localeCompare(b)),
      delete_policy: spec.deletePolicy,
      preinstall_state: preinstallState,
      restore: createRestoreState(preinstallState),
      _scope: scope,
      _abs_path: absPath,
      _seeded: false,
    };
    tracked.set(key, entry);
    return entry;
  }

  return {
    installSessionId,
    registerProjectSpec(spec) {
      return registerSpec({ ...spec, scope: 'project' });
    },
    registerGlobalSpec(spec) {
      return registerSpec({ ...spec, scope: 'global' });
    },
    registerProjectSpecs(specs) {
      for (const spec of specs) this.registerProjectSpec(spec);
    },
    registerGlobalSpecs(specs) {
      for (const spec of specs) this.registerGlobalSpec(spec);
    },
    finalize() {
      const managedSurface = [];
      const managedGlobalSkillPaths = [];
      for (const entry of tracked.values()) {
        const installedExists = fs.existsSync(entry._abs_path);
        entry.installed_state = {
          path_exists_after_install: installedExists,
          path_kind_after_install: installedExists
            ? fs.statSync(entry._abs_path).isDirectory()
              ? 'dir'
              : 'file'
            : 'missing',
          content_hash_after_install: installedExists ? hashPath(entry._abs_path) : '',
          captured_at: new Date().toISOString(),
        };
        const serialized = {
          path: entry.path,
          kind: entry.kind,
          owner_agents: entry.owner_agents,
          delete_policy: entry.delete_policy,
          preinstall_state: entry.preinstall_state,
          restore: entry.restore,
          installed_state: entry.installed_state,
        };
        if (entry._scope === 'global') managedGlobalSkillPaths.push(serialized);
        else managedSurface.push(serialized);
      }

      const manifest = {
        manifest_version: 2,
        install_session_id: installSessionId,
        package_name: existingManifest?.package_name || packageName,
        package_version: packageVersion,
        installed_via: installedVia,
        generated_at: new Date().toISOString(),
        project_root: path.resolve(projectRoot),
        snapshot_root: toPortablePath(getInstallStateSnapshotRootRel(installSessionId)),
        installed_tools: [...new Set([...(existingManifest?.installed_tools || []), ...normalizedInstalledTools])].sort((a, b) => a.localeCompare(b)),
        managed_surface: managedSurface.sort((a, b) => a.path.localeCompare(b.path)),
        managed_global_skill_paths: managedGlobalSkillPaths.sort((a, b) => a.path.localeCompare(b.path)),
        preserved_paths: ['_bmad-output'],
        last_uninstall_report_path: toPortablePath(UNINSTALL_REPORT_REL_PATH),
      };

      writeInstallManifest(projectRoot, manifest);
      return manifest;
    },
  };
}

function createSkipEntry(pathValue, classification, skipReason, recommendedManualAction = '') {
  return {
    path: pathValue,
    classification,
    skip_reason: skipReason,
    recommended_manual_action: recommendedManualAction,
  };
}

module.exports = {
  KNOWN_AGENT_IDS,
  AGENT_ID_ALIASES,
  ACCEPTED_CONSUMER_MAIN_AGENT_HOOK_FILES,
  LEGACY_CONSUMER_HOOK_PATTERNS,
  normalizeAgentId,
  normalizeAgentList,
  getInstallManifestPath,
  getUninstallReportPath,
  getInstallStateRoot,
  getInstallStateSnapshotRootRel,
  readInstallManifest,
  writeInstallManifest,
  removeInstallManifest,
  writeUninstallReport,
  makeInstallSessionId,
  hashPath,
  copyRecursive,
  createInstallStateTracker,
  collectManagedSurfaceSpecs,
  collectManagedGlobalSkillSpecs,
  createSkipEntry,
  isAcceptedConsumerMainAgentHookFile,
  isUnexpectedLegacyConsumerHookFile,
  listUnexpectedLegacyConsumerHookFiles,
  removeUnexpectedLegacyConsumerHookFiles,
};
