# 项目源代码文件清单

**统计**：生产 16,416 行 | 测试 9,702 行 | 合计 26,118 行  
**范围**：.ts / .js / .py / .ps1 / .sh（已排除 node_modules、_bmad-output）

---

## _bmad

  [生产] _bmad/speckit/scripts/powershell/check-prerequisites.ps1
  [生产] _bmad/speckit/scripts/powershell/common.ps1
  [生产] _bmad/speckit/scripts/powershell/create-new-feature.ps1
  [生产] _bmad/speckit/scripts/powershell/find-related-docs.ps1
  [生产] _bmad/speckit/scripts/powershell/setup_worktree.ps1
  [生产] _bmad/speckit/scripts/powershell/setup-plan.ps1
  [生产] _bmad/speckit/scripts/powershell/update-agent-context.ps1
  [生产] _bmad/speckit/scripts/powershell/validate-audit-config.ps1
  [生产] _bmad/speckit/scripts/powershell/validate-sync-manifest.ps1
  [生产] _bmad/speckit/scripts/python/check_speckit_prerequisites.py
  [生产] _bmad/speckit/scripts/python/migrate_bmad_output_to_subdirs.py
  [生产] _bmad/speckit/scripts/python/migrate_planning_artifacts_to_branch.py
  [生产] _bmad/speckit/scripts/python/validate_sync_manifest.py
  [生产] _bmad/speckit/scripts/shell/check-prerequisites.sh
  [生产] _bmad/speckit/scripts/shell/common.sh
  [生产] _bmad/speckit/scripts/shell/create-new-feature.sh
  [生产] _bmad/speckit/scripts/shell/find-related-docs.sh
  [生产] _bmad/speckit/scripts/shell/setup_worktree.sh
  [生产] _bmad/speckit/scripts/shell/setup-plan.sh
  [生产] _bmad/speckit/scripts/shell/update-agent-context.sh
  [生产] _bmad/speckit/scripts/shell/validate-audit-config.sh
  [生产] _bmad/speckit/scripts/shell/validate-sync-manifest.sh


## packages

  [生产] packages/bmad-speckit/bin/bmad-speckit.js
  [生产] packages/bmad-speckit/src/commands/banner.js
  [生产] packages/bmad-speckit/src/commands/check.js
  [生产] packages/bmad-speckit/src/commands/config.js
  [生产] packages/bmad-speckit/src/commands/feedback.js
  [生产] packages/bmad-speckit/src/commands/init.js
  [生产] packages/bmad-speckit/src/commands/init-skeleton.js
  [生产] packages/bmad-speckit/src/commands/script-generator.js
  [生产] packages/bmad-speckit/src/commands/upgrade.js
  [生产] packages/bmad-speckit/src/commands/version.js
  [生产] packages/bmad-speckit/src/constants/ai-builtin.js
  [生产] packages/bmad-speckit/src/constants/ai-registry-builtin.js
  [生产] packages/bmad-speckit/src/constants/exit-codes.js
  [生产] packages/bmad-speckit/src/services/ai-registry.js
  [生产] packages/bmad-speckit/src/services/config-manager.js
  [生产] packages/bmad-speckit/src/services/skill-publisher.js
  [生产] packages/bmad-speckit/src/services/sync-service.js
  [生产] packages/bmad-speckit/src/services/template-fetcher.js
  [生产] packages/bmad-speckit/src/utils/file-encoding.js
  [生产] packages/bmad-speckit/src/utils/network-timeout.js
  [生产] packages/bmad-speckit/src/utils/path.js
  [生产] packages/bmad-speckit/src/utils/structure-validate.js
  [生产] packages/bmad-speckit/src/utils/tty.js
  [测试] packages/bmad-speckit/tests/ai-registry.test.js
  [测试] packages/bmad-speckit/tests/ai-registry-builtin.test.js
  [测试] packages/bmad-speckit/tests/ai-registry-integration.test.js
  [测试] packages/bmad-speckit/tests/banner.test.js
  [测试] packages/bmad-speckit/tests/config.test.js
  [测试] packages/bmad-speckit/tests/config-manager.test.js
  [测试] packages/bmad-speckit/tests/e2e/init-e2e.test.js
  [测试] packages/bmad-speckit/tests/exception-paths-e13-s2.test.js
  [测试] packages/bmad-speckit/tests/feedback.test.js
  [测试] packages/bmad-speckit/tests/init-config.test.js
  [测试] packages/bmad-speckit/tests/init-interactive-generic.test.js
  [生产] packages/bmad-speckit/tests/run-init-exit3-helper.js
  [测试] packages/bmad-speckit/tests/skill-publisher.test.js
  [测试] packages/bmad-speckit/tests/structure-validate.test.js
  [测试] packages/bmad-speckit/tests/sync-service.test.js
  [测试] packages/bmad-speckit/tests/template-fetcher.test.js
  [测试] packages/bmad-speckit/tests/template-fetch-exit3.test.js
  [测试] packages/bmad-speckit/tests/upgrade.test.js
  [测试] packages/bmad-speckit/tests/version.test.js


## scoring

  [测试] scoring/__tests__/calculator.test.ts
  [测试] scoring/__tests__/constants.test.ts
  [测试] scoring/__tests__/e2e/eval-question-flow.test.ts
  [测试] scoring/__tests__/integration/calculator-schema.test.ts
  [测试] scoring/__tests__/integration/dashboard-epic-aggregate.test.ts
  [测试] scoring/__tests__/integration/dashboard-fixture.test.ts
  [测试] scoring/__tests__/integration/table-calculator.test.ts
  [测试] scoring/__tests__/integration/test_calculator_imported_in_production_path.test.ts
  [测试] scoring/__tests__/path.test.ts
  [测试] scoring/__tests__/rules/parser.test.ts
  [测试] scoring/__tests__/rules/ref-resolution.test.ts
  [测试] scoring/__tests__/schema.test.ts
  [测试] scoring/__tests__/writer/validate-scenario.test.ts
  [测试] scoring/__tests__/writer/writer.test.ts
  [测试] scoring/__tests__/writer/write-score.test.ts
  [测试] scoring/analytics/__tests__/audit-report-parser.test.ts
  [测试] scoring/analytics/__tests__/cluster-weaknesses.test.ts
  [测试] scoring/analytics/__tests__/prompt-optimizer.test.ts
  [测试] scoring/analytics/__tests__/rule-suggestion.test.ts
  [测试] scoring/analytics/__tests__/sft-extractor.test.ts
  [生产] scoring/analytics/audit-report-parser.ts
  [生产] scoring/analytics/cluster-weaknesses.ts
  [生产] scoring/analytics/prompt-optimizer.ts
  [生产] scoring/analytics/rule-suggestion.ts
  [生产] scoring/analytics/sft-extractor.ts
  [测试] scoring/bugfix/__tests__/writeback.test.ts
  [生产] scoring/bugfix/writeback.ts
  [测试] scoring/coach/__tests__/coach-integration.test.ts
  [测试] scoring/coach/__tests__/diagnose.test.ts
  [测试] scoring/coach/__tests__/discovery.test.ts
  [测试] scoring/coach/__tests__/filter-epic-story.test.ts
  [测试] scoring/coach/__tests__/forbidden.test.ts
  [测试] scoring/coach/__tests__/format.test.ts
  [测试] scoring/coach/__tests__/loader.test.ts
  [生产] scoring/coach/config.ts
  [生产] scoring/coach/diagnose.ts
  [生产] scoring/coach/discovery.ts
  [生产] scoring/coach/filter-epic-story.ts
  [生产] scoring/coach/forbidden.ts
  [生产] scoring/coach/format.ts
  [生产] scoring/coach/index.ts
  [生产] scoring/coach/loader.ts
  [生产] scoring/coach/types.ts
  [生产] scoring/constants/path.ts
  [生产] scoring/constants/table-a.ts
  [生产] scoring/constants/table-b.ts
  [生产] scoring/constants/weights.ts
  [生产] scoring/core/calculator.ts
  [生产] scoring/core/index.ts
  [测试] scoring/dashboard/__tests__/compute.test.ts
  [测试] scoring/dashboard/__tests__/compute-epic-aggregate.test.ts
  [测试] scoring/dashboard/__tests__/format.test.ts
  [生产] scoring/dashboard/compute.ts
  [生产] scoring/dashboard/format.ts
  [生产] scoring/dashboard/index.ts
  [测试] scoring/eval-questions/__tests__/cli-integration.test.ts
  [测试] scoring/eval-questions/__tests__/manifest-loader.test.ts
  [测试] scoring/eval-questions/__tests__/run-core.test.ts
  [测试] scoring/eval-questions/__tests__/template-generator.test.ts
  [生产] scoring/eval-questions/agent-answer.ts
  [生产] scoring/eval-questions/manifest-loader.ts
  [生产] scoring/eval-questions/run-core.ts
  [生产] scoring/eval-questions/template-generator.ts
  [测试] scoring/gate/__tests__/rollback.test.ts
  [测试] scoring/gate/__tests__/version-lock.test.ts
  [生产] scoring/gate/rollback.ts
  [生产] scoring/gate/version-lock.ts
  [测试] scoring/orchestrator/__tests__/parse-and-write.test.ts
  [生产] scoring/orchestrator/index.ts
  [生产] scoring/orchestrator/parse-and-write.ts
  [测试] scoring/parsers/__tests__/audit-arch.test.ts
  [测试] scoring/parsers/__tests__/audit-generic.test.ts
  [测试] scoring/parsers/__tests__/audit-index.test.ts
  [测试] scoring/parsers/__tests__/audit-prd.test.ts
  [测试] scoring/parsers/__tests__/audit-story.test.ts
  [测试] scoring/parsers/__tests__/dimension-parser.test.ts
  [测试] scoring/parsers/__tests__/integration/parse-and-write.test.ts
  [测试] scoring/parsers/__tests__/llm-fallback.test.ts
  [生产] scoring/parsers/audit-arch.ts
  [生产] scoring/parsers/audit-generic.ts
  [生产] scoring/parsers/audit-index.ts
  [生产] scoring/parsers/audit-item-mapping.ts
  [生产] scoring/parsers/audit-prd.ts
  [生产] scoring/parsers/audit-story.ts
  [生产] scoring/parsers/dimension-parser.ts
  [生产] scoring/parsers/index.ts
  [生产] scoring/parsers/llm-fallback.ts
  [生产] scoring/parsers/rules.ts
  [生产] scoring/parsers/types.ts
  [测试] scoring/query/__tests__/loader.test.ts
  [测试] scoring/query/__tests__/parse-epic-story.test.ts
  [测试] scoring/query/__tests__/query.test.ts
  [生产] scoring/query/index.ts
  [生产] scoring/query/loader.ts
  [生产] scoring/query/parse-epic-story.ts
  [测试] scoring/scores/__tests__/format-table.test.ts
  [生产] scoring/scores/format-table.ts
  [测试] scoring/trigger/__tests__/trigger-loader.test.ts
  [生产] scoring/trigger/trigger-loader.ts
  [测试] scoring/utils/__tests__/hash.test.ts
  [测试] scoring/utils/__tests__/sanitize-iteration.test.ts
  [生产] scoring/utils/hash.ts
  [生产] scoring/utils/sanitize-iteration.ts
  [测试] scoring/veto/__tests__/apply-tier-and-veto.test.ts
  [测试] scoring/veto/__tests__/epic-veto.test.ts
  [测试] scoring/veto/__tests__/tier.test.ts
  [测试] scoring/veto/__tests__/veto.test.ts
  [生产] scoring/veto/epic-veto.ts
  [生产] scoring/veto/index.ts
  [生产] scoring/veto/tier.ts
  [生产] scoring/veto/types.ts
  [生产] scoring/veto/veto.ts
  [生产] scoring/writer/index.ts
  [生产] scoring/writer/types.ts
  [生产] scoring/writer/validate.ts
  [生产] scoring/writer/write-score.ts


## scripts

> Scoring 相关脚本已整合进 `bmad-speckit` CLI 子命令。`scripts/*.ts` 保留为源仓库开发入口。
> 对应关系：`parse-and-write-score.ts` → `npx bmad-speckit score`、`check-story-score-written.ts` → `npx bmad-speckit check-score`、`coach-diagnose.ts` → `npx bmad-speckit coach`、`dashboard-generate.ts` → `npx bmad-speckit dashboard`、`sft-extract.ts` → `npx bmad-speckit sft-extract`、`scores-summary.ts` → `npx bmad-speckit scores`。

  [生产] scripts/accept-e1-s1.ts
  [生产] scripts/accept-e1-s2.ts
  [生产] scripts/accept-e2-s1.ts
  [生产] scripts/accept-e2-s2.ts
  [生产] scripts/accept-e3-s1.ts
  [生产] scripts/accept-e3-s2.ts
  [生产] scripts/accept-e3-s3.ts
  [生产] scripts/accept-e4-s1.ts
  [生产] scripts/accept-e4-s2.ts
  [生产] scripts/accept-e4-s3.ts
  [生产] scripts/analytics-cluster.ts
  [生产] scripts/analytics-prompt-optimize.ts
  [生产] scripts/analytics-rule-suggest.ts
  [生产] scripts/analytics-sft-extract.ts
  [生产] scripts/bmad-sync-from-v6.ps1
  [生产] scripts/bmad-sync-from-v6.sh
  [生产] scripts/check-sprint-ready.ps1
  [生产] scripts/check-sprint-ready.sh
  [生产] scripts/check-story-score-written.ts
  [生产] scripts/coach-diagnose.ts
  [生产] scripts/dashboard-generate.ts
  [生产] scripts/eval-question-generate.ts
  [生产] scripts/eval-questions-cli.ts
  [生产] scripts/init-to-root.js
  [生产] scripts/parse-and-write-score.ts
  [生产] scripts/query-validate.ts
  [生产] scripts/scores-summary.ts
  [生产] scripts/setup.ps1
  [生产] scripts/setup.sh
  [生产] scripts/sft-extract.ts


## skills

  [生产] skills/bmad-customization-backup/scripts/apply_bmad_backup.py
  [生产] skills/bmad-customization-backup/scripts/backup_bmad.py
  [生产] skills/bmad-orchestrator/scripts/check-status.sh
  [生产] skills/bmad-orchestrator/scripts/init-project.sh
  [生产] skills/bmad-orchestrator/scripts/install.sh
  [生产] skills/bmad-orchestrator/scripts/phase-gate-review.sh
  [生产] skills/bmad-orchestrator/scripts/validate-config.sh
  [生产] skills/git-push-monitor/scripts/monitor-push.ps1
  [生产] skills/git-push-monitor/scripts/monitor-push.sh
  [生产] skills/git-push-monitor/scripts/start-push-with-monitor.ps1
  [生产] skills/git-push-monitor/scripts/start-push-with-monitor.sh
  [生产] skills/pr-template-generator/scripts/generate-pr-template.ps1
  [生产] skills/pr-template-generator/scripts/generate-pr-template.py
  [生产] skills/pr-template-generator/scripts/generate-pr-template.sh


## tmp-e10s5b

  [生产] tmp-e10s5b/_bmad/speckit/scripts/bmad-speckit.ps1


## 根目录

  [生产] vitest.config.ts

