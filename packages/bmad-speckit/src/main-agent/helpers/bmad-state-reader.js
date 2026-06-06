const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');

function resolveRoot(projectRoot) {
  return path.resolve(projectRoot || process.cwd());
}

function readBmadProgress(projectRoot) {
  const root = resolveRoot(projectRoot);
  const progressPath = path.join(root, '.claude', 'state', 'bmad-progress.yaml');
  if (!fs.existsSync(progressPath)) {
    console.error(`[bmad-state-reader] 全局状态文件不存在: ${path.relative(root, progressPath)}`);
    return null;
  }
  try {
    return yaml.load(fs.readFileSync(progressPath, 'utf8'));
  } catch (error) {
    console.error('[bmad-state-reader] 解析全局状态文件失败:', error);
    return null;
  }
}

function readStoryState(epic, story, projectRoot) {
  const root = resolveRoot(projectRoot);
  const storyStatePath = path.join(root, '.claude', 'state', 'stories', `${epic}-${story}-progress.yaml`);
  if (!fs.existsSync(storyStatePath)) {
    console.error(`[bmad-state-reader] Story 状态文件不存在: ${path.relative(root, storyStatePath)}`);
    return null;
  }
  try {
    return yaml.load(fs.readFileSync(storyStatePath, 'utf8'));
  } catch (error) {
    console.error('[bmad-state-reader] 解析 Story 状态文件失败:', error);
    return null;
  }
}

function getCurrentStoryState(projectRoot) {
  const progress = readBmadProgress(projectRoot);
  if (!progress || !progress.current_context) {
    console.error('[bmad-state-reader] 当前上下文未设置');
    return null;
  }
  const { epic, story } = progress.current_context;
  const state = readStoryState(epic, story, projectRoot);
  if (!state) {
    console.error(`[bmad-state-reader] 无法读取当前 Story 状态: ${epic}-${story}`);
    return null;
  }
  return { epic, story, state };
}

function buildPaths(epic, story, epicSlug, storySlug) {
  const baseDir = `specs/epic-${epic}-${epicSlug}/story-${story}-${storySlug}`;
  const outputDir = `_bmad-output/implementation-artifacts/epic-${epic}-${epicSlug}/story-${story}-${storySlug}`;
  return {
    spec: `${baseDir}/spec-E${epic}-S${story}.md`,
    plan: `${baseDir}/plan-E${epic}-S${story}.md`,
    gaps: `${baseDir}/IMPLEMENTATION_GAPS-E${epic}-S${story}.md`,
    tasks: `${baseDir}/tasks-E${epic}-S${story}.md`,
    auditSpec: `${baseDir}/AUDIT_spec-E${epic}-S${story}.md`,
    auditPlan: `${baseDir}/AUDIT_plan-E${epic}-S${story}.md`,
    auditGaps: `${baseDir}/AUDIT_GAPS-E${epic}-S${story}.md`,
    auditTasks: `${baseDir}/AUDIT_tasks-E${epic}-S${story}.md`,
    prd: `${outputDir}/prd.tasks-E${epic}-S${story}.json`,
    progress: `${outputDir}/progress.tasks-E${epic}-S${story}.txt`,
    storyState: `.claude/state/stories/${epic}-${story}-progress.yaml`,
  };
}

module.exports = {
  readBmadProgress,
  readStoryState,
  getCurrentStoryState,
  buildPaths,
};
