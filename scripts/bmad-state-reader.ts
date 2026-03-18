#!/usr/bin/env ts-node
import * as fs from 'fs';
import * as yaml from 'js-yaml';
import * as path from 'path';

export interface StoryState {
  version: string;
  epic: string;
  story: string;
  story_slug: string;
  epic_slug?: string;
  layer: number;
  stage: string;
  audit_status: 'pending' | 'pass' | 'fail';
  artifacts: {
    spec?: string;
    plan?: string;
    gaps?: string;
    tasks?: string;
    prd?: string;
    progress?: string;
    code?: string[];
  };
  scores?: Record<string, {
    rating: string;
    dimensions: Record<string, number>;
  }>;
}

export interface BmadProgress {
  version: string;
  active_stories: Array<{
    epic: string;
    story: string;
    stage: string;
    status: string;
  }>;
  completed_stories: Array<{
    epic: string;
    story: string;
    completed_at: string;
  }>;
  current_context?: {
    epic: string;
    story: string;
  };
}

export function readBmadProgress(): BmadProgress | null {
  const progressPath = path.join('.claude', 'state', 'bmad-progress.yaml');

  if (!fs.existsSync(progressPath)) {
    console.error(`[bmad-state-reader] 全局状态文件不存在: ${progressPath}`);
    return null;
  }

  try {
    const content = fs.readFileSync(progressPath, 'utf-8');
    return yaml.load(content) as BmadProgress;
  } catch (error) {
    console.error(`[bmad-state-reader] 解析全局状态文件失败:`, error);
    return null;
  }
}

export function readStoryState(epic: string, story: string): StoryState | null {
  const storyStatePath = path.join('.claude', 'state', 'stories', `${epic}-${story}-progress.yaml`);

  if (!fs.existsSync(storyStatePath)) {
    console.error(`[bmad-state-reader] Story 状态文件不存在: ${storyStatePath}`);
    return null;
  }

  try {
    const content = fs.readFileSync(storyStatePath, 'utf-8');
    return yaml.load(content) as StoryState;
  } catch (error) {
    console.error(`[bmad-state-reader] 解析 Story 状态文件失败:`, error);
    return null;
  }
}

export function getCurrentStoryState(): { epic: string; story: string; state: StoryState } | null {
  const progress = readBmadProgress();

  if (!progress || !progress.current_context) {
    console.error('[bmad-state-reader] 当前上下文未设置');
    return null;
  }

  const { epic, story } = progress.current_context;
  const state = readStoryState(epic, story);

  if (!state) {
    console.error(`[bmad-state-reader] 无法读取当前 Story 状态: ${epic}-${story}`);
    return null;
  }

  return { epic, story, state };
}

export function buildPaths(epic: string, story: string, epicSlug: string, storySlug: string) {
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

    storyState: `.claude/state/stories/${epic}-${story}-progress.yaml`
  };
}

if (require.main === module) {
  const current = getCurrentStoryState();
  if (current) {
    console.log('当前 Story:', current.epic, '-', current.story);
    console.log('当前 Stage:', current.state.stage);
    console.log('Artifacts:', JSON.stringify(current.state.artifacts, null, 2));

    if (current.state.epic_slug && current.state.story_slug) {
      const paths = buildPaths(current.epic, current.story, current.state.epic_slug, current.state.story_slug);
      console.log('\n预期路径:', JSON.stringify(paths, null, 2));
    }
  }
}
