#!/usr/bin/env ts-node
import * as fs from 'fs';
import * as yaml from 'js-yaml';
import * as path from 'path';
import { loadPolicyContextFromRegistry } from './emit-runtime-policy';
import { resolveBmadHelpRuntimePolicy } from './bmad-config';
import type { ReviewerContractProjection } from './reviewer-registry';

interface BmadProgress {
  version?: string;
  current_context?: {
    epic?: string;
    story?: string;
  };
  active_stories?: Array<{
    epic: string;
    story: string;
    stage: string;
    status: string;
  }>;
}

export interface ReviewerProjectionDiagnosis {
  reviewerContract: ReviewerContractProjection | null;
  lines: string[];
}

export function collectReviewerProjectionDiagnosis(root: string): ReviewerProjectionDiagnosis {
  try {
    const loaded = loadPolicyContextFromRegistry(root);
    const policy = resolveBmadHelpRuntimePolicy({
      projectRoot: root,
      flow: loaded.flow,
      stage: loaded.stage,
      runtimeContext: loaded.runtimeContext,
      runtimeContextPath: loaded.resolvedContextPath,
      epicId: loaded.epicId,
      storyId: loaded.storyId,
      storySlug: loaded.storySlug,
      runId: loaded.runId,
      artifactRoot: loaded.artifactRoot,
    });
    const reviewerContract = policy.reviewerContract;
    const activeConsumer = reviewerContract.activeAuditConsumer;

    return {
      reviewerContract,
      lines: [
        '【诊断项 4】Reviewer Projection:',
        `✅ reviewer contract: ${reviewerContract.reviewerIdentity} (${reviewerContract.version})`,
        activeConsumer
          ? `   active consumer: ${activeConsumer.entryStage} -> ${activeConsumer.profile} -> ${activeConsumer.auditorScript} -> ${reviewerContract.closeoutRunner}`
          : '   active consumer: (none)',
        `   cursor route: preferred=cursor-task/code-reviewer fallback=mcp_task/generalPurpose`,
        `   claude route: preferred=Agent/code-reviewer fallback=Agent/general-purpose`,
      ],
    };
  } catch (error) {
    return {
      reviewerContract: null,
      lines: [
        '【诊断项 4】Reviewer Projection:',
        `⚠️ reviewer projection unavailable: ${error instanceof Error ? error.message : String(error)}`,
      ],
    };
  }
}

export function diagnoseBmadState(root: string = process.cwd()): number {
  const progressPath = path.join(root, '.claude', 'state', 'bmad-progress.yaml');

  console.log('=== BMAD 状态诊断 ===\n');

  if (!fs.existsSync(progressPath)) {
    console.error(`❌ 文件不存在: ${path.relative(root, progressPath)}`);
    console.log('建议: 运行 bmad-master 初始化流程创建状态文件');
    return 1;
  }

  const content = fs.readFileSync(progressPath, 'utf-8');
  const state: BmadProgress = yaml.load(content) as BmadProgress;

  console.log('【诊断项 1】current_context 设置:');
  if (!state.current_context) {
    console.error('❌ current_context 未定义');
    console.log('   影响: bmad-master 无法确定当前工作上下文');
    console.log('   修复: 在 bmad-progress.yaml 中添加 current_context 节点');
  } else if (!state.current_context.epic || !state.current_context.story) {
    console.error('❌ current_context.epic 或 current_context.story 为空');
    console.log(`   当前值: epic=${state.current_context.epic}, story=${state.current_context.story}`);
    console.log('   修复: 设置有效的 epic 和 story 值');
  } else {
    console.log(`✅ current_context 正常: epic=${state.current_context.epic}, story=${state.current_context.story}`);
  }

  console.log('\n【诊断项 2】active_stories 列表:');
  if (!state.active_stories || state.active_stories.length === 0) {
    console.warn('⚠️ active_stories 为空列表');
    console.log('   说明: 当前没有活动的 Story');
  } else {
    console.log(`   发现 ${state.active_stories.length} 个活动 Story:\n`);
    state.active_stories.forEach((story, index) => {
      const stageValid = [
        'new', 'story_created', 'story_audit_passed',
        'specify_passed', 'plan_passed', 'gaps_passed',
        'tasks_passed', 'implement_passed', 'document_audit_passed',
        'commit_gate_passed', 'commit_ready', 'completed'
      ].includes(story.stage);

      const status = stageValid ? '✅' : '❌';
      console.log(`   ${index + 1}. ${story.epic}-${story.story}`);
      console.log(`      stage: ${story.stage} ${status}`);
      console.log(`      status: ${story.status}`);

      if (!stageValid) {
        console.log(`      ⚠️ 警告: stage 值 "${story.stage}" 不在预定义列表中`);
      }
    });
  }

  console.log('\n【诊断项 3】Story 状态文件一致性:');
  const storiesDir = path.join(root, '.claude', 'state', 'stories');
  if (fs.existsSync(storiesDir)) {
    const storyFiles = fs.readdirSync(storiesDir).filter((f) => f.endsWith('-progress.yaml'));
    console.log(`   发现 ${storyFiles.length} 个 Story 状态文件`);
    storyFiles.forEach((f) => {
      console.log(`   - ${f}`);
    });
  } else {
    console.warn('⚠️ stories 目录不存在');
  }

  console.log('');
  for (const line of collectReviewerProjectionDiagnosis(root).lines) {
    console.log(line);
  }

  console.log('\n=== 诊断完成 ===');
  return 0;
}

if (require.main === module) {
  process.exit(diagnoseBmadState());
}
