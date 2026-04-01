/**
 * sync-runtime-context-from-sprint → @bmad-speckit/runtime-context
 */
const { runSyncRuntimeContextFromSprintCli } = require('@bmad-speckit/runtime-context/sync-from-sprint-cli');

function syncRuntimeContextFromSprintCommand(opts) {
  runSyncRuntimeContextFromSprintCli({
    storyKey: opts.storyKey,
    cwd: process.cwd(),
  });
}

module.exports = { syncRuntimeContextFromSprintCommand };
