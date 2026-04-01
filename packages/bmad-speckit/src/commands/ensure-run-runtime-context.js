/**
 * ensure-run-runtime-context: delegates to @bmad-speckit/runtime-context
 */
const { runEnsureRunCli } = require('@bmad-speckit/runtime-context/cli');

function ensureRunRuntimeContextCommand(opts) {
  const raw = String(opts.lifecycle || 'dev_story').toLowerCase();
  if (raw !== 'dev_story' && raw !== 'post_audit') {
    throw new Error(`Invalid --lifecycle: ${opts.lifecycle}; expected dev_story or post_audit`);
  }
  const lifecycle = raw === 'post_audit' ? 'post_audit' : 'dev_story';
  runEnsureRunCli({
    storyKey: opts.storyKey,
    lifecycle,
    persist: Boolean(opts.persist),
    cwd: process.cwd(),
  });
}

module.exports = { ensureRunRuntimeContextCommand };
