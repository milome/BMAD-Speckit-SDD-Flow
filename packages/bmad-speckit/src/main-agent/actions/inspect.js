const fs = require('node:fs');
const path = require('node:path');

function requirementIndexPath(projectRoot) {
  return path.join(projectRoot, '_bmad-output', 'runtime', 'requirement-records', 'index.json');
}

function orchestrationStateDir(projectRoot) {
  return path.join(projectRoot, '_bmad-output', 'runtime', 'governance', 'orchestration-state');
}

function readJsonIfPresent(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    return {
      parseError: error instanceof Error ? error.message : String(error),
    };
  }
}

function resolveProjectPath(projectRoot, candidate) {
  if (!candidate) return null;
  return path.isAbsolute(candidate) ? candidate : path.resolve(projectRoot, candidate);
}

function toPosixRelative(projectRoot, filePath) {
  return path.relative(projectRoot, filePath).replace(/\\/g, '/');
}

function activeRequirement(index) {
  if (!index || typeof index !== 'object') return null;
  if (index.active && typeof index.active === 'object' && !Array.isArray(index.active)) {
    return {
      recordId: index.active.recordId || null,
      requirementSetId: index.active.requirementSetId || index.active.recordId || null,
      runId: index.active.runId || null,
    };
  }
  if (typeof index.active === 'string') {
    return {
      recordId: index.active,
      requirementSetId: index.active,
      runId: null,
    };
  }
  return null;
}

function activeRecordEntry(index, active) {
  if (!index || !active || !Array.isArray(index.records)) return null;
  return (
    index.records.find((entry) => {
      if (!entry || typeof entry !== 'object') return false;
      return (
        entry.recordId === active.recordId ||
        entry.requirementSetId === active.requirementSetId ||
        entry.runId === active.runId
      );
    }) || null
  );
}

function readRuntimeRecordContext(projectRoot) {
  const indexPath = requirementIndexPath(projectRoot);
  const index = readJsonIfPresent(indexPath);
  const active = activeRequirement(index);
  const entry = activeRecordEntry(index, active);
  const recordPath = resolveProjectPath(projectRoot, entry?.recordPath);
  return {
    index,
    indexPath: index ? indexPath : null,
    active,
    recordEntry: entry,
    recordPath,
    record: recordPath ? readJsonIfPresent(recordPath) : null,
  };
}

function latestOrchestrationState(projectRoot) {
  const dir = orchestrationStateDir(projectRoot);
  if (!fs.existsSync(dir)) return null;
  const candidates = fs
    .readdirSync(dir)
    .filter((name) => name.endsWith('.json'))
    .map((name) => path.join(dir, name))
    .sort((left, right) => fs.statSync(right).mtimeMs - fs.statSync(left).mtimeMs);
  for (const candidate of candidates) {
    const state = readJsonIfPresent(candidate);
    if (state && !state.parseError) {
      return {
        path: candidate,
        state,
      };
    }
  }
  return null;
}

function inspectRuntimeState(projectRoot) {
  const runtime = readRuntimeRecordContext(projectRoot);
  if (!runtime.index) {
    return {
      source: 'none',
      indexPath: null,
      active: null,
      activeRecordPath: null,
      activeRecord: null,
      inventory: {
        hasRequirementIndex: false,
      },
    };
  }
  return {
    source: 'requirement-records-index',
    indexPath: runtime.indexPath,
    active: runtime.active ?? runtime.index.active ?? null,
    activeRecordPath: runtime.recordPath,
    activeRecord: runtime.record,
    inventory: {
      hasRequirementIndex: true,
      requirementSets: Object.keys(runtime.index.requirementSets ?? {}).length,
      records: Array.isArray(runtime.index.records) ? runtime.index.records.length : 0,
    },
  };
}

function hasRuntimeState(projectRoot) {
  return fs.existsSync(requirementIndexPath(projectRoot));
}

function legacyInspectSurface(projectRoot, args = {}) {
  const runtime = readRuntimeRecordContext(projectRoot);
  const latestState = latestOrchestrationState(projectRoot);
  const state = latestState?.state ?? null;
  const active = runtime.active;
  const host = args.host || state?.host || null;
  const sessionId = state?.sessionId || active?.requirementSetId || active?.recordId || null;
  const pendingPacketStatus = state?.pendingPacket?.status || (active ? 'ready_for_main_agent' : 'none');
  return {
    source: state ? 'orchestration_state' : active ? 'requirement_record' : 'no_active_requirement',
    sessionId,
    orchestrationStatePath: latestState?.path
      ? toPosixRelative(projectRoot, latestState.path)
      : null,
    orchestrationState: state || (host ? { host } : null),
    pendingPacketStatus,
    pendingPacket: state?.pendingPacket ?? null,
    diagnostics: [],
    mainAgentCanContinue: pendingPacketStatus === 'ready_for_main_agent',
    continueDecision: pendingPacketStatus === 'ready_for_main_agent' ? 'continue' : 'blocked',
    mainAgentNextAction: state?.nextAction || (active ? 'dispatch_implement' : 'await_user'),
    mainAgentReady: Boolean(active),
    mainAgentStageSummary: {
      flow: args.flow || runtime.record?.flow || null,
      stage: args.stage || runtime.record?.stage || null,
      ready: Boolean(active),
      blocked: !active,
      nextAction: state?.nextAction || (active ? 'dispatch_implement' : 'await_user'),
    },
  };
}

module.exports = {
  hasRuntimeState,
  inspectRuntimeState,
  legacyInspectSurface,
  readJsonIfPresent,
  readRuntimeRecordContext,
  requirementIndexPath,
  orchestrationStateDir,
  toPosixRelative,
};
