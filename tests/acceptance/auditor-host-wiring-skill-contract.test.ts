import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(import.meta.dirname, '..', '..');

function readRepoFile(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), 'utf8');
}

function readRepoFileIfExists(relativePath: string): string | null {
  const fullPath = join(ROOT, relativePath);
  return existsSync(fullPath) ? readFileSync(fullPath, 'utf8') : null;
}

describe('auditor host runner wiring in higher-level entry surfaces', () => {
  it('routes post-audit automation through the unified auditor host runner instead of direct score/audit-index CLI instructions', () => {
    const bugAssistant = readRepoFile('_bmad/claude/skills/bmad-bug-assistant/SKILL.md');
    const standalone = readRepoFile('_bmad/claude/skills/bmad-standalone-tasks/SKILL.md');
    const reviewer = readRepoFile('_bmad/claude/skills/bmad-code-reviewer-lifecycle/SKILL.md');
    const storyAssistant = readRepoFile('_bmad/claude/skills/bmad-story-assistant/SKILL.md');
    const speckitWorkflow = readRepoFile('_bmad/claude/skills/speckit-workflow/SKILL.md');
    const cursorSpeckitWorkflow = readRepoFile('_bmad/cursor/skills/speckit-workflow/SKILL.md');
    const cursorBugAssistant = readRepoFile('_bmad/cursor/skills/bmad-bug-assistant/SKILL.md');
    const layerHosts = [
      readRepoFile('_bmad/claude/agents/layers/bmad-layer4-speckit-specify.md'),
      readRepoFile('_bmad/claude/agents/layers/bmad-layer4-speckit-plan.md'),
      readRepoFile('_bmad/claude/agents/layers/bmad-layer4-speckit-gaps.md'),
      readRepoFile('_bmad/claude/agents/layers/bmad-layer4-speckit-tasks.md'),
      readRepoFile('_bmad/claude/agents/layers/bmad-layer4-speckit-implement.md'),
      readRepoFile('_bmad/claude/agents/layers/bmad-bug-agent.md'),
      readRepoFile('_bmad/claude/agents/layers/bmad-standalone-tasks.md'),
    ];

    for (const doc of [
      bugAssistant,
      standalone,
      reviewer,
      storyAssistant,
      speckitWorkflow,
      cursorSpeckitWorkflow,
      cursorBugAssistant,
      ...layerHosts,
    ]) {
      expect(doc).toContain('runAuditorHost');
    }

    for (const doc of [bugAssistant, standalone, reviewer, storyAssistant]) {
      expect(doc).toContain('统一 auditor host runner');
    }

    for (const doc of [speckitWorkflow, cursorSpeckitWorkflow, cursorBugAssistant, ...layerHosts]) {
      expect(doc).not.toContain('npx bmad-speckit score');
    }
  });

  it('enforces closeout hard gates and final response checklist across bug/story/standalone skills', () => {
    const docs = [
      readRepoFile('_bmad/cursor/skills/bmad-bug-assistant/SKILL.md'),
      readRepoFile('_bmad/cursor/skills/bmad-story-assistant/SKILL.md'),
      readRepoFile('_bmad/cursor/skills/bmad-standalone-tasks/SKILL.md'),
      readRepoFile('_bmad/claude/skills/bmad-bug-assistant/SKILL.md'),
      readRepoFile('_bmad/claude/skills/bmad-story-assistant/SKILL.md'),
      readRepoFile('_bmad/claude/skills/bmad-standalone-tasks/SKILL.md'),
    ];

    for (const doc of docs) {
      expect(doc).toContain('未执行 `runAuditorHost` 并验证评分写入成功前，禁止结束、禁止交还用户手动操作。');
      expect(doc).toContain('只有 `runAuditorHost` 返回 `closeout approved` 才算完成；其余都算未完成。');
      expect(doc).toContain('禁止给“你可以手动做下一步”的建议，除非用户明确要求。');
      expect(doc).toContain('`runAuditorHost` 失败时必须自动重试，并在每次重试时记录失败原因与修复动作；未成功前不得退出当前闭环。');
      expect(doc).toContain('`runAuditorHost 调用参数`');
      expect(doc).toContain('`runAuditorHost 返回结果`');
      expect(doc).toContain('`评分写入结果（成功/失败码）`');
      expect(doc).toContain('`closeout 状态（approved/未approved）`');
    }
  });

  it('removes direct score/check-score walkthroughs from cleaned wave docs and mirrors', () => {
    const cleanedDocs = [
      '_bmad/claude/skills/bmad-bug-assistant/SKILL.zh.md',
      '_bmad/claude/skills/bmad-bug-assistant/SKILL.en.md',
      '_bmad/claude/skills/bmad-code-reviewer-lifecycle/SKILL.zh.md',
      '_bmad/claude/skills/bmad-code-reviewer-lifecycle/SKILL.en.md',
      '_bmad/claude/skills/speckit-workflow/SKILL.zh.md',
      '_bmad/claude/skills/speckit-workflow/SKILL.en.md',
      '_bmad/claude/skills/bmad-story-assistant/SKILL.md',
      '_bmad/claude/skills/bmad-story-assistant/SKILL.zh.md',
      '_bmad/claude/skills/bmad-story-assistant/SKILL.en.md',
      '_bmad/cursor/skills/bmad-bug-assistant/SKILL.zh.md',
      '_bmad/cursor/skills/bmad-bug-assistant/SKILL.en.md',
      '_bmad/cursor/skills/bmad-code-reviewer-lifecycle/SKILL.md',
      '_bmad/cursor/skills/bmad-code-reviewer-lifecycle/SKILL.zh.md',
      '_bmad/cursor/skills/bmad-code-reviewer-lifecycle/SKILL.en.md',
      '_bmad/cursor/skills/speckit-workflow/SKILL.zh.md',
      '_bmad/cursor/skills/speckit-workflow/SKILL.en.md',
      '_bmad/cursor/skills/bmad-story-assistant/SKILL.md',
      '_bmad/cursor/skills/bmad-story-assistant/SKILL.zh.md',
      '_bmad/cursor/skills/bmad-story-assistant/SKILL.en.md',
      'docs/tutorials/getting-started.md',
      'docs/how-to/bmad-story-assistant.md',
      'docs/sample/prd.md',
      'docs/examples/layer4-complete-workflow-example.md',
      '_bmad/claude/skills/bmad-rca-helper/SKILL.md',
      '_bmad/claude/skills/bmad-rca-helper/SKILL.zh.md',
      '_bmad/claude/skills/bmad-rca-helper/SKILL.en.md',
      '_bmad/claude/skills/bmad-standalone-tasks-doc-review/SKILL.md',
      '_bmad/claude/skills/bmad-standalone-tasks-doc-review/SKILL.zh.md',
      '_bmad/claude/skills/bmad-standalone-tasks-doc-review/SKILL.en.md',
      '_bmad/claude/skills/speckit-workflow/references/audit-prompts.md',
      '_bmad/claude/skills/speckit-workflow/references/audit-prompts.en.md',
      '_bmad/claude/skills/speckit-workflow/references/audit-prompts-code.md',
      '_bmad/claude/skills/speckit-workflow/references/audit-prompts-code.en.md',
      '_bmad/cursor/skills/speckit-workflow/references/audit-prompts.md',
      '_bmad/cursor/skills/speckit-workflow/references/audit-prompts.en.md',
      '_bmad/cursor/skills/speckit-workflow/references/audit-prompts-code.md',
      '_bmad/cursor/skills/speckit-workflow/references/audit-prompts-code.en.md',
    ];

    for (const relativePath of cleanedDocs) {
      const doc = readRepoFileIfExists(relativePath);
      if (doc == null) {
        continue;
      }
      expect(doc).not.toMatch(/npx bmad-speckit score(?:\s|$)/);
      expect(doc).not.toMatch(/npx bmad-speckit check-score(?:\s|$)/);
    }
  });

  it('keeps current reference docs aligned with runAuditorHost as the post-audit automation entry', () => {
    const skillsRef = readRepoFile('docs/reference/skills.md');
    const configRef = readRepoFile('docs/reference/configuration.md');

    expect(skillsRef).toContain('runAuditorHost');
    expect(skillsRef).not.toContain('触发 `bmad-speckit score`');

    expect(configRef).toContain('runAuditorHost');
    expect(configRef).toContain('scoringEnabled=false');
    expect(configRef).not.toContain('不触发 `bmad-speckit score`');
  });

  it('keeps reference and explanation infrastructure docs on the current path layering', () => {
    const architecture = readRepoFile('docs/explanation/architecture.md');
    const scoringSystem = readRepoFile('docs/explanation/scoring-system.md');
    const scoringDeepDive = readRepoFileIfExists(
      'docs/explanation/bmad-speckit-sdd-scoring-deep-dive.md'
    );
    const governanceOral = readRepoFileIfExists(
      'docs/explanation/runtime-governance-5to8min-oral-guide.md'
    );
    const governanceWhiteboard = readRepoFileIfExists(
      'docs/explanation/runtime-governance-whiteboard-guide.md'
    );
    const cursorHooks = readRepoFile('docs/reference/cursor-runtime-governance-hooks.md');
    const upstreamWiring = readRepoFile('docs/reference/runtime-governance-upstream-wiring.md');
    const governanceTerms = readRepoFile('docs/reference/runtime-governance-terms.md');
    const speckitGovernance = readRepoFile('docs/reference/speckit-governance.md');
    const flowMetrics = readRepoFile('docs/reference/speckit-flow-metrics.md');
    const runtimeContext = readRepoFile('docs/reference/runtime-context.md');
    const sourceCode = readRepoFile('docs/reference/source-code.md');
    const speckitCli = readRepoFile('docs/reference/speckit-cli.md');

    for (const doc of [
      architecture,
      scoringSystem,
      ...(scoringDeepDive ? [scoringDeepDive] : []),
      ...(governanceOral ? [governanceOral] : []),
      ...(governanceWhiteboard ? [governanceWhiteboard] : []),
      cursorHooks,
      upstreamWiring,
      governanceTerms,
      speckitGovernance,
      flowMetrics,
      runtimeContext,
      sourceCode,
      speckitCli,
    ]) {
      expect(doc).toContain('Current path');
    }

    for (const doc of [
      architecture,
      scoringSystem,
      ...(scoringDeepDive ? [scoringDeepDive] : []),
      ...(governanceOral ? [governanceOral] : []),
      ...(governanceWhiteboard ? [governanceWhiteboard] : []),
      cursorHooks,
      upstreamWiring,
      governanceTerms,
      speckitGovernance,
      flowMetrics,
      sourceCode,
      speckitCli,
    ]) {
      expect(doc).toContain('runAuditorHost');
    }

    expect(scoringSystem).toContain('底层 `bmad-speckit score`');
    if (scoringDeepDive) {
      expect(scoringDeepDive).toContain('底层 scoring CLI');
    }
    if (governanceOral) {
      expect(governanceOral).toContain('post-audit automation');
    }
    if (governanceWhiteboard) {
      expect(governanceWhiteboard).toContain('scoring write / auditIndex');
    }
    expect(cursorHooks).toContain('post-audit automation');
    expect(upstreamWiring).toContain('host runner 收口');
    expect(governanceTerms).toContain('runAuditorHost');
    expect(speckitGovernance).toContain('post-audit automation');
    expect(flowMetrics).toContain('post-audit artifact');
    expect(runtimeContext).toContain('registry + activeScope + scoped context file');
    expect(runtimeContext).toContain('.speckit-state.yaml');
    expect(sourceCode).toContain('scripts/run-auditor-host.ts');
    expect(sourceCode).toContain('scripts/auditor-post-actions.ts');
    expect(speckitCli).toContain('底层 scoring CLI');
  });

  it('marks the remaining base infrastructure docs with current-path and legacy-path guidance', () => {
    const agents = readRepoFile('docs/reference/agents.md');
    const helpRouting = readRepoFile('docs/reference/bmad-help-routing-model.md');
    const configuration = readRepoFile('docs/reference/configuration.md');
    const remediationProvider = readRepoFile(
      'docs/reference/governance-remediation-provider-config.md'
    );
    const emitSchema = readRepoFile('docs/reference/runtime-policy-emit-schema.md');
    const skills = readRepoFile('docs/reference/skills.md');
    const doneStandards = readRepoFile('docs/reference/speckit-done-standards.md');
    const exceptionTemplate = readRepoFile('docs/reference/speckit-exception-log-template.md');
    const fixtureConventions = readRepoFile('docs/reference/test-fixture-conventions.md');
    const environmentRequirements = readRepoFile('docs/explanation/environment-requirements.md');
    const pathConventions = readRepoFile('docs/explanation/path-conventions.md');
    const upstreamRelationship = readRepoFile('docs/explanation/upstream-relationship.md');

    for (const doc of [
      agents,
      helpRouting,
      configuration,
      remediationProvider,
      emitSchema,
      skills,
      doneStandards,
      exceptionTemplate,
      fixtureConventions,
      environmentRequirements,
      pathConventions,
      upstreamRelationship,
    ]) {
      expect(doc).toContain('Current path');
      expect(doc).toContain('Legacy path');
    }

    for (const doc of [agents, configuration, emitSchema, skills, upstreamRelationship]) {
      expect(doc).toContain('runAuditorHost');
    }

    expect(helpRouting).toContain('implementationReadinessStatus');
    expect(remediationProvider).toContain('sidecar');
    expect(remediationProvider).toContain('authoritative');
    expect(doneStandards).toContain('post-audit artifacts');
    expect(exceptionTemplate).toContain('next gate');
    expect(fixtureConventions).toContain('host-runner consumers');
    expect(environmentRequirements).toContain('runtime-emit artifacts');
    expect(pathConventions).toContain('_bmad');
    expect(pathConventions).toContain('scoped runtime outputs');
  });

  it('keeps how-to, ops, and design docs aligned on current post-audit wording', () => {
    const runtimeSync = readRepoFile('docs/how-to/runtime-sync-after-workflows.md');
    const sftPilot = readRepoFile('docs/ops/2026-04-09-sft-production-pilot-report.md');
    const acceptanceMatrix = readRepoFile(
      'docs/ops/2026-04-09-runtime-production-acceptance-matrix.md'
    );
    const architectureDesignPath = 'docs/design/SDD架构设计总览与运行时治理设计.md';

    expect(runtimeSync).toContain('runAuditorHost');
    expect(runtimeSync).toContain('post-audit host runner 收口');
    expect(runtimeSync).not.toContain('插入 S11 post-audit 两条命令');

    expect(sftPilot).toContain('runAuditorHost');
    expect(sftPilot).toContain('Historical commands used for this rerun');

    expect(acceptanceMatrix).toContain('runAuditorHost');
    expect(acceptanceMatrix).not.toContain(
      'fresh scoring data written via `parse-and-write-score`'
    );

    if (existsSync(join(ROOT, architectureDesignPath))) {
      const architectureDesign = readRepoFile(architectureDesignPath);
      expect(architectureDesign).toContain('participant Host as post-audit host runner');
      expect(architectureDesign).toContain('runAuditorHost');
      expect(architectureDesign).not.toContain('Auditor->>Scoring: 触发 parse-and-write-score');
    }
  });

  it('cleans the last narrow scatter docs without reintroducing manual close-out wording', () => {
    const interviewGuidePath = 'docs/design/ai-native-agent-engineering-interview-guide.md';
    const zeroScriptsPath = 'docs/requirements/2026-04-08-runtime-governance-consumer-zero-scripts.md';
    const dashboardLauncher = readRepoFile('docs/how-to/runtime-dashboard-stable-launcher.md');
    const consumerInstallation = readRepoFile('docs/how-to/consumer-installation.md');
    const storyAssistantHowTo = readRepoFile('docs/how-to/bmad-story-assistant.md');

    if (existsSync(join(ROOT, interviewGuidePath))) {
      const interviewGuide = readRepoFile(interviewGuidePath);
      expect(interviewGuide).toContain('runAuditorHost');
      expect(interviewGuide).toContain('post-audit close-out');
    }

    if (existsSync(join(ROOT, zeroScriptsPath))) {
      const zeroScripts = readRepoFile(zeroScriptsPath);
      expect(zeroScripts).toContain('不代表当前产品路径需要人工串联 post-audit close-out');
      expect(zeroScripts).toContain('手动触发或通过测试驱动验证 `post-tool-use`');
    }

    expect(dashboardLauncher).toContain('dashboard fallback');
    expect(dashboardLauncher).toContain('不代表治理或 post-audit 主路径需要人工触发');

    expect(consumerInstallation).toContain('安装校验或排障 fallback');
    expect(consumerInstallation).toContain('不代表治理或 post-audit 主路径需要人工触发');

    expect(storyAssistantHowTo).toContain('runAuditorHost');
    expect(storyAssistantHowTo).toContain('不是面向最终使用者的主入口');
  });
});
