const fs = require('fs');
const path = require('path');
const {
  copyRecursive,
  createSkipEntry,
  getInstallManifestPath,
  getUninstallReportPath,
  hashPath,
  normalizeAgentList,
  readInstallManifest,
  removeInstallManifest,
  writeInstallManifest,
  writeUninstallReport,
} = require('../services/install-surface-manifest');

function absProjectPath(projectRoot, relPath) {
  return path.resolve(projectRoot, relPath);
}

function isWithinRoot(root, candidate) {
  const relative = path.relative(path.resolve(root), path.resolve(candidate));
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function removeEntry(absPath) {
  if (!fs.existsSync(absPath)) return;
  fs.rmSync(absPath, { recursive: true, force: true });
}

function isRetriableFsError(error) {
  return (
    error &&
    typeof error === 'object' &&
    ['EPERM', 'EBUSY', 'ENOTEMPTY'].includes(error.code)
  );
}

function sleepMs(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function withFsRetry(fn, options = {}) {
  const attempts = Number.isInteger(options.attempts) ? options.attempts : 6;
  const baseDelayMs = Number.isInteger(options.baseDelayMs) ? options.baseDelayMs : 120;
  let lastError = null;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return fn();
    } catch (error) {
      lastError = error;
      if (!isRetriableFsError(error) || attempt === attempts - 1) {
        throw error;
      }
      sleepMs(baseDelayMs * (attempt + 1));
    }
  }
  throw lastError;
}

function safeRemoveEntry(absPath) {
  return withFsRetry(() => removeEntry(absPath));
}

function restoreEntryFromSource(absPath, restoreSource) {
  const sourceStat = fs.statSync(restoreSource);
  if (!sourceStat.isDirectory()) {
    return withFsRetry(() => copyRecursive(restoreSource, absPath));
  }

  return withFsRetry(() => {
    removeEntry(absPath);
    copyRecursive(restoreSource, absPath);
  });
}

function cleanEmptyParents(startPath, stopRoots) {
  let current = path.dirname(startPath);
  while (current && !stopRoots.has(current)) {
    if (!fs.existsSync(current)) {
      current = path.dirname(current);
      continue;
    }
    const stat = fs.statSync(current);
    if (!stat.isDirectory()) break;
    if (fs.readdirSync(current).length > 0) break;
    fs.rmdirSync(current);
    current = path.dirname(current);
  }
}

function resolveRestoreSource(projectRoot, entry) {
  const sourceRef = entry?.restore?.source_ref;
  if (!sourceRef) return null;
  return path.resolve(projectRoot, sourceRef);
}

function resolveCurrentPath(projectRoot, entry, scope) {
  if (scope === 'global') return path.resolve(entry.path);
  return absProjectPath(projectRoot, entry.path);
}

function hasCurrentBeenModified(absPath, entry) {
  const installedHash = entry?.installed_state?.content_hash_after_install || '';
  if (!installedHash) return false;
  if (!fs.existsSync(absPath)) return false;
  return hashPath(absPath) !== installedHash;
}

function applyEntryAction({ projectRoot, entry, scope, requestedAgents, dryRun, stopRoots }) {
  const absPath = resolveCurrentPath(projectRoot, entry, scope);
  const classification = entry?.preinstall_state?.classification || 'preexisting-unmanaged';
  const ownerAgents = Array.isArray(entry.owner_agents) ? entry.owner_agents : [];
  const overlap = ownerAgents.filter((agent) => requestedAgents.has(agent));
  if (overlap.length === 0) {
    return { keep: true, entry, report: null };
  }

  const remainingOwners = ownerAgents.filter((agent) => !requestedAgents.has(agent));
  if (remainingOwners.length > 0) {
    return {
      keep: true,
      entry: { ...entry, owner_agents: remainingOwners },
      report: {
        path: entry.path,
        remaining_owner_agents: remainingOwners,
        action: 'owner_rewritten',
      },
    };
  }

  if (scope === 'project' && !isWithinRoot(projectRoot, absPath)) {
    return {
      keep: true,
      entry,
      report: createSkipEntry(
        entry.path,
        classification,
        'path_escapes_project_root',
        'verify manifest path normalization before retrying uninstall'
      ),
    };
  }

  if (entry.kind === 'project_doc' || entry.delete_policy === 'match_generated_only') {
    if (fs.existsSync(absPath) && hasCurrentBeenModified(absPath, entry)) {
      return {
        keep: true,
        entry,
        report: createSkipEntry(
          entry.path,
          classification,
          'current_content_modified_since_install',
          'review file manually before deleting or restoring'
        ),
      };
    }
  }

  if (classification === 'preexisting-unmanaged') {
    return {
      keep: true,
      entry,
      report: createSkipEntry(
        entry.path,
        classification,
        entry?.restore?.skip_reason || 'preexisting_unmanaged',
        'manual cleanup required because safe restore source was never captured'
      ),
    };
  }

  if (classification === 'created') {
    if (fs.existsSync(absPath) && hasCurrentBeenModified(absPath, entry)) {
      return {
        keep: true,
        entry,
        report: createSkipEntry(
          entry.path,
          classification,
          'current_content_modified_since_install',
          'manual cleanup required because managed entry changed after install'
        ),
      };
    }
    if (!dryRun) {
      try {
        safeRemoveEntry(absPath);
        cleanEmptyParents(absPath, stopRoots);
      } catch (error) {
        return {
          keep: true,
          entry,
          report: createSkipEntry(
            entry.path,
            classification,
            `filesystem_${error.code || 'delete_failed'}`,
            'manual cleanup required because managed entry is locked or inaccessible'
          ),
        };
      }
    }
    return {
      keep: false,
      entry: null,
      report: { path: entry.path, action: 'deleted_created' },
    };
  }

  if (classification === 'overwritten') {
    if (fs.existsSync(absPath) && hasCurrentBeenModified(absPath, entry)) {
      return {
        keep: true,
        entry,
        report: createSkipEntry(
          entry.path,
          classification,
          'current_content_modified_since_install',
          'manual restore required because current content diverged from installed snapshot'
        ),
      };
    }
    const restoreSource = resolveRestoreSource(projectRoot, entry);
    if (!restoreSource || !fs.existsSync(restoreSource)) {
      return {
        keep: true,
        entry,
        report: createSkipEntry(
          entry.path,
          classification,
          'missing_restore_source',
          'recreate original file manually or restore from backup'
        ),
      };
    }
    if (!dryRun) {
      try {
        restoreEntryFromSource(absPath, restoreSource);
        cleanEmptyParents(absPath, stopRoots);
      } catch (error) {
        return {
          keep: true,
          entry,
          report: createSkipEntry(
            entry.path,
            classification,
            `filesystem_${error.code || 'restore_failed'}`,
            'manual restore required because the destination is locked or inaccessible'
          ),
        };
      }
    }
    return {
      keep: false,
      entry: null,
      report: { path: entry.path, action: 'restored_snapshot', source_ref: entry.restore.source_ref },
    };
  }

  return {
    keep: true,
    entry,
    report: createSkipEntry(
      entry.path,
      classification,
      'unknown_classification',
      'inspect manifest entry manually'
    ),
  };
}

function uninstallCommand(options = {}) {
  const projectRoot = path.resolve(options.target || process.cwd());
  const manifestPath = getInstallManifestPath(projectRoot);
  const manifest = readInstallManifest(projectRoot);
  if (!manifest) {
    console.error(
      `install manifest missing; uninstall cannot safely determine managed surface (${manifestPath})`
    );
    process.exit(1);
  }

  const requestedAgents = normalizeAgentList(options.agent);
  const effectiveAgents = new Set(
    requestedAgents.length > 0
      ? requestedAgents
      : Array.isArray(manifest.installed_tools)
        ? manifest.installed_tools
        : []
  );

  const dryRun = options.dryRun === true;
  const removeGlobalSkills = options.removeGlobalSkills === true;
  const stopRoots = new Set([
    path.resolve(projectRoot, '.cursor'),
    path.resolve(projectRoot, '.claude'),
    path.resolve(projectRoot, '.codex'),
  ]);

  const deletedEntries = [];
  const restoredEntries = [];
  const skippedEntries = [];
  const missingRestoreSourceEntries = [];
  const ownerRewriteEntries = [];
  const nextManagedSurface = [];
  const nextManagedGlobalSkillPaths = [];

  for (const entry of Array.isArray(manifest.managed_surface) ? manifest.managed_surface : []) {
    const result = applyEntryAction({
      projectRoot,
      entry,
      scope: 'project',
      requestedAgents: effectiveAgents,
      dryRun,
      stopRoots,
    });
    if (result.keep && result.entry) {
      nextManagedSurface.push(result.entry);
    }
    if (result.report) {
      if (result.report.action === 'deleted_created') deletedEntries.push(result.report);
      else if (result.report.action === 'restored_snapshot') restoredEntries.push(result.report);
      else if (result.report.action === 'owner_rewritten') ownerRewriteEntries.push(result.report);
      else {
        skippedEntries.push(result.report);
        if (result.report.skip_reason === 'missing_restore_source') {
          missingRestoreSourceEntries.push(result.report);
        }
      }
    }
  }

  for (const entry of Array.isArray(manifest.managed_global_skill_paths)
    ? manifest.managed_global_skill_paths
    : []) {
    const overlap =
      Array.isArray(entry.owner_agents) &&
      entry.owner_agents.some((agent) => effectiveAgents.has(agent));
    if (!overlap) {
      nextManagedGlobalSkillPaths.push(entry);
      continue;
    }
    if (!removeGlobalSkills) {
      nextManagedGlobalSkillPaths.push(entry);
      skippedEntries.push(
        createSkipEntry(
          entry.path,
          entry?.preinstall_state?.classification || 'created',
          'remove_global_skills_flag_not_set',
          'rerun uninstall with --remove-global-skills to remove global skill directories'
        )
      );
      continue;
    }

    const globalStopRoots = new Set([path.dirname(path.resolve(entry.path))]);
    const result = applyEntryAction({
      projectRoot,
      entry,
      scope: 'global',
      requestedAgents: effectiveAgents,
      dryRun,
      stopRoots: globalStopRoots,
    });
    if (result.keep && result.entry) {
      nextManagedGlobalSkillPaths.push(result.entry);
    }
    if (result.report) {
      if (result.report.action === 'deleted_created') deletedEntries.push(result.report);
      else if (result.report.action === 'restored_snapshot') restoredEntries.push(result.report);
      else if (result.report.action === 'owner_rewritten') ownerRewriteEntries.push(result.report);
      else {
        skippedEntries.push(result.report);
        if (result.report.skip_reason === 'missing_restore_source') {
          missingRestoreSourceEntries.push(result.report);
        }
      }
    }
  }

  const nextInstalledTools =
    requestedAgents.length > 0
      ? (Array.isArray(manifest.installed_tools) ? manifest.installed_tools : []).filter(
          (agent) => !effectiveAgents.has(agent)
        )
      : [];

  const uninstallReport = {
    install_session_id: manifest.install_session_id || '',
    uninstall_session_id:
      typeof require('crypto').randomUUID === 'function'
        ? require('crypto').randomUUID()
        : String(Date.now()),
    project_root: projectRoot,
    requested_agents: [...effectiveAgents],
    deleted_entries: deletedEntries,
    restored_entries: restoredEntries,
    skipped_entries: skippedEntries,
    missing_restore_source_entries: missingRestoreSourceEntries,
    preserved_paths: ['_bmad-output'],
    final_installed_tools: nextInstalledTools,
    owner_rewrite_entries: ownerRewriteEntries,
    dry_run: dryRun,
  };

  if (!dryRun) {
    writeUninstallReport(projectRoot, uninstallReport);
  }

  if (!dryRun) {
    if (nextInstalledTools.length === 0 && nextManagedSurface.length === 0 && nextManagedGlobalSkillPaths.length === 0) {
      removeInstallManifest(projectRoot);
    } else {
      writeInstallManifest(projectRoot, {
        ...manifest,
        generated_at: new Date().toISOString(),
        installed_tools: nextInstalledTools,
        managed_surface: nextManagedSurface,
        managed_global_skill_paths: nextManagedGlobalSkillPaths,
        last_uninstall_report_path: path.relative(projectRoot, getUninstallReportPath(projectRoot)).replace(/\\/g, '/'),
      });
    }
  }

  const packageRemovalAdvice =
    nextInstalledTools.length === 0 &&
    nextManagedSurface.length === 0 &&
    nextManagedGlobalSkillPaths.length === 0
      ? {
          npm: `npm uninstall ${manifest.package_name}`,
          pnpm: `pnpm remove ${manifest.package_name}`,
          yarn: `yarn remove ${manifest.package_name}`,
          bun: `bun remove ${manifest.package_name}`,
        }
      : null;

  const summary = {
    deleted: deletedEntries.length,
    restored: restoredEntries.length,
    skipped: skippedEntries.length,
    reportPath: getUninstallReportPath(projectRoot),
    packageRemovalAdvice,
  };
  const rendered = JSON.stringify(summary, null, 2);
  console.log(rendered);
}

module.exports = {
  uninstallCommand,
};
