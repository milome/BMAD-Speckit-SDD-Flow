const { execSync } = require('node:child_process');
const path = require('node:path');
const {
  prepareSpeckitImplementRalphTracking,
  recordSpeckitImplementRalphPhase,
  verifySpeckitImplementRalphTracking,
} = require('@bmad-speckit/ralph-method/speckit-implement');

function resolveCurrentBranchName(projectRoot, tasksPath) {
  try {
    const current = execSync('git branch --show-current', {
      cwd: projectRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    if (current) {
      return current;
    }
  } catch {
    // Fall through to deterministic fallback.
  }

  return `bmad-speckit/ralph/${path.basename(tasksPath, path.extname(tasksPath))}`;
}

function requiredString(value, label) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Missing required option: ${label}`);
  }
  return value;
}

function baseInput(opts) {
  return {
    projectRoot: process.cwd(),
    tasksPath: requiredString(opts.tasksPath, '--tasksPath'),
    mode: typeof opts.mode === 'string' ? opts.mode : undefined,
    epic: typeof opts.epic === 'string' ? opts.epic : undefined,
    story: typeof opts.story === 'string' ? opts.story : undefined,
    epicSlug: typeof opts.epicSlug === 'string' ? opts.epicSlug : undefined,
    storySlug: typeof opts.storySlug === 'string' ? opts.storySlug : undefined,
  };
}

function ralphPrepareCommand(opts) {
  const input = baseInput(opts);
  const prepared = prepareSpeckitImplementRalphTracking({
    ...input,
    branchName: resolveCurrentBranchName(
      input.projectRoot,
      path.resolve(input.projectRoot, input.tasksPath)
    ),
    taskDescription: typeof opts.taskDescription === 'string' ? opts.taskDescription : undefined,
    overwrite: Boolean(opts.overwrite),
  });

  console.log(`Prepared Ralph tracking for ${input.tasksPath}`);
  console.log(`prdPath: ${prepared.paths.prdPath}`);
  console.log(`progressPath: ${prepared.paths.progressPath}`);
}

function ralphRecordPhaseCommand(opts) {
  const recorded = recordSpeckitImplementRalphPhase({
    ...baseInput(opts),
    userStoryId: requiredString(opts.userStoryId, '--userStoryId'),
    title: requiredString(opts.title, '--title'),
    phase: requiredString(opts.phase, '--phase'),
    detail: requiredString(opts.detail, '--detail'),
    storyLogTimestamp:
      typeof opts.storyLogTimestamp === 'string' ? opts.storyLogTimestamp : undefined,
  });

  console.log(`Recorded Ralph phase ${opts.phase} for ${opts.userStoryId}`);
  console.log(`prdPath: ${recorded.paths.prdPath}`);
  console.log(`progressPath: ${recorded.paths.progressPath}`);
}

function ralphVerifyCommand(opts) {
  const verification = verifySpeckitImplementRalphTracking(baseInput(opts));
  if (verification.result.status !== 'pass') {
    console.error('Ralph compliance verification failed');
    verification.result.errors.forEach((error) => console.error(`- ${error}`));
    process.exit(1);
  }

  console.log('Ralph compliance verification passed');
  console.log(`prdPath: ${verification.paths.prdPath}`);
  console.log(`progressPath: ${verification.paths.progressPath}`);
}

module.exports = {
  ralphPrepareCommand,
  ralphRecordPhaseCommand,
  ralphVerifyCommand,
};
