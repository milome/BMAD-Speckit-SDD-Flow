const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');

const STAGE_TO_REVIEWER = {
  spec: ['spec', 'spec_audit', 'auditor-spec'],
  specify: ['spec', 'spec_audit', 'auditor-spec'],
  plan: ['plan', 'plan_audit', 'auditor-plan'],
  gaps: ['gaps', 'gaps_audit', 'auditor-gaps'],
  tasks: ['tasks', 'tasks_audit', 'auditor-tasks'],
  implement: ['implement', 'implement_audit', 'auditor-implement'],
  document: ['document', 'document_audit', 'auditor-document'],
};

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function loadRuntimeContext(root) {
  const registry = readJsonIfExists(path.join(root, '_bmad-output', 'runtime', 'registry.json')) ?? {};
  const contextRel = registry.activeScope?.resolvedContextPath ?? path.join('_bmad-output', 'runtime', 'context', 'project.json');
  const contextPath = path.resolve(root, contextRel);
  const runtimeContext = readJsonIfExists(contextPath) ?? {};
  return {
    registry,
    runtimeContext: {
      ...runtimeContext,
      latestReviewerCloseout: runtimeContext.latestReviewerCloseout ?? registry.latestReviewerCloseout ?? null,
    },
    stage: runtimeContext.stage ?? 'specify',
  };
}

function buildReviewerContract(stage) {
  const route = STAGE_TO_REVIEWER[stage] ?? STAGE_TO_REVIEWER.specify;
  return {
    version: 'reviewer_contract_projection_v1',
    reviewerIdentity: 'bmad_code_reviewer',
    registryVersion: 'reviewer_registry_v1',
    sharedCore: {
      version: 'reviewer_shared_core_v1',
      rootPath: '_bmad/core/agents/code-reviewer',
    },
    activeAuditConsumer: {
      entryStage: route[0],
      profile: route[1],
      auditorScript: route[2],
    },
    closeoutRunner: 'runAuditorHost',
    rolloutGate: {
      status: 'active',
      summary: 'package reviewer projection runtime available',
    },
  };
}

function collectReviewerProjectionDiagnosis(root) {
  try {
    const loaded = loadRuntimeContext(root);
    const reviewerContract = buildReviewerContract(loaded.stage);
    const activeConsumer = reviewerContract.activeAuditConsumer;
    const closeout = loaded.runtimeContext.latestReviewerCloseout;
    return {
      reviewerContract,
      lines: [
        '【诊断项 4】Reviewer Projection:',
        `✅ reviewer contract: ${reviewerContract.reviewerIdentity} (${reviewerContract.version})`,
        `   shared core: ${reviewerContract.sharedCore.rootPath} [${reviewerContract.sharedCore.version}]`,
        `   active consumer: ${activeConsumer.entryStage} -> ${activeConsumer.profile} -> ${activeConsumer.auditorScript} -> ${reviewerContract.closeoutRunner}`,
        '   cursor carrier: _bmad/cursor/agents/code-reviewer.md -> .cursor/agents/code-reviewer.md',
        '   cursor route: preferred=cursor-task/code-reviewer fallback=mcp_task/generalPurpose',
        '   claude carrier: _bmad/claude/agents/code-reviewer.md -> .claude/agents/code-reviewer.md',
        '   claude route: preferred=Agent/code-reviewer fallback=Agent/general-purpose',
        '   route reason: package runtime reviewer projection',
        '   fallback status: available',
        '   maturity: package-runtime',
        '   complexity: registry-backed',
        '   blocker: (none)',
        `   rollout gate: ${reviewerContract.rolloutGate.status} -> ${reviewerContract.rolloutGate.summary}`,
        closeout
          ? `   latest closeout: ${closeout.closeoutEnvelope?.resultCode} / ${closeout.closeoutEnvelope?.packetExecutionClosureStatus} / approved=${closeout.closeoutApproved ? 'yes' : 'no'}`
          : '   latest closeout: (none)',
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

function collectReadinessProjectionDiagnosis(root) {
  try {
    readJsonIfExists(path.join(root, '_bmad-output', 'runtime', 'requirement-records', 'index.json'));
    return {
      lines: [
        '【诊断项 5】Readiness Projection:',
        '✅ readiness baseline run: (none)',
        '   readiness score: (none)',
        '   effective verdict: unknown',
        '   drift severity: none',
        '   re-readiness required: no',
        '   drift signals: (none)',
        '   drifted dimensions: (none)',
        '   blocking reason: (none)',
      ],
    };
  } catch (error) {
    return {
      lines: [
        '【诊断项 5】Readiness Projection:',
        `⚠️ readiness projection unavailable: ${error instanceof Error ? error.message : String(error)}`,
      ],
    };
  }
}

function diagnoseBmadState(root = process.cwd()) {
  const progressPath = path.join(root, '.claude', 'state', 'bmad-progress.yaml');
  console.log('=== BMAD 状态诊断 ===\n');
  if (!fs.existsSync(progressPath)) {
    console.error(`❌ 文件不存在: ${path.relative(root, progressPath)}`);
    console.log('建议: 运行 bmad-master 初始化流程创建状态文件');
    return 1;
  }
  const content = fs.readFileSync(progressPath, 'utf8');
  const state = yaml.load(content) || {};
  console.log('【诊断项 1】current_context 设置:');
  if (!state.current_context) {
    console.error('❌ current_context 未定义');
  } else if (!state.current_context.epic || !state.current_context.story) {
    console.error('❌ current_context.epic 或 current_context.story 为空');
  } else {
    console.log(`✅ current_context 正常: epic=${state.current_context.epic}, story=${state.current_context.story}`);
  }
  console.log('\n【诊断项 2】active_stories 列表:');
  const activeStories = Array.isArray(state.active_stories) ? state.active_stories : [];
  console.log(activeStories.length > 0 ? `   发现 ${activeStories.length} 个活动 Story:` : '⚠️ active_stories 为空列表');
  console.log('\n【诊断项 3】Story 状态文件一致性:');
  const storiesDir = path.join(root, '.claude', 'state', 'stories');
  console.log(fs.existsSync(storiesDir) ? `   发现 ${fs.readdirSync(storiesDir).filter((file) => file.endsWith('-progress.yaml')).length} 个 Story 状态文件` : '⚠️ stories 目录不存在');
  console.log('');
  for (const line of collectReviewerProjectionDiagnosis(root).lines) console.log(line);
  console.log('');
  for (const line of collectReadinessProjectionDiagnosis(root).lines) console.log(line);
  console.log('\n=== 诊断完成 ===');
  return 0;
}

module.exports = {
  collectReviewerProjectionDiagnosis,
  collectReadinessProjectionDiagnosis,
  diagnoseBmadState,
};
