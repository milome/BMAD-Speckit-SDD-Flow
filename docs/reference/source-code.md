# 项目源代码文件清单

**统计**：生产 16,416 行 | 测试 9,702 行 | 合计 26,118 行  
**范围**：.ts / .js / .py / .ps1 / .sh（已排除 node_modules、\_bmad-output）

---

## 2026-03-28 Runtime Dashboard / Canonical SFT 增量

> 本节只补充本轮 runtime dashboard、live dashboard MCP、canonical SFT pipeline 的增量入口，避免整份清单继续漂移。

### 新增运行时入口

[生产] packages/bmad-speckit/src/commands/dashboard-live.js
[生产] packages/bmad-speckit/src/commands/runtime-mcp.js
[生产] packages/bmad-speckit/src/commands/sft-preview.js
[生产] packages/bmad-speckit/src/commands/sft-validate.js
[生产] packages/bmad-speckit/src/commands/sft-bundle.js
[生产] packages/bmad-speckit/src/runtime-client.js

### 新增 dashboard shared core / live server / MCP

[生产] packages/scoring/dashboard/runtime-query.ts
[生产] packages/scoring/dashboard/snapshot.ts
[生产] packages/scoring/dashboard/live-server.ts
[生产] packages/scoring/dashboard/mcp-server.ts
[生产] packages/scoring/dashboard/ui/index.html
[生产] packages/scoring/dashboard/ui/app.js
[生产] packages/scoring/dashboard/ui/styles.css
[测试] packages/scoring/dashboard/**tests**/runtime-query.test.ts

### 新增 canonical SFT pipeline

[生产] packages/scoring/analytics/candidate-builder.ts
[生产] packages/scoring/analytics/bundle-writer.ts
[生产] packages/scoring/analytics/canonical-sample.ts
[生产] packages/scoring/analytics/quality-gates.ts
[生产] packages/scoring/analytics/redaction.ts
[生产] packages/scoring/analytics/split.ts
[生产] packages/scoring/analytics/validation-report.ts
[生产] packages/scoring/analytics/exporters/openai-chat.ts
[生产] packages/scoring/analytics/exporters/hf-conversational.ts
[生产] packages/scoring/analytics/exporters/hf-tool-calling.ts
[测试] packages/scoring/analytics/**tests**/candidate-builder.test.ts
[测试] packages/scoring/analytics/**tests**/bundle-writer.test.ts
[测试] packages/scoring/analytics/**tests**/openai-chat-export.test.ts
[测试] packages/scoring/analytics/**tests**/hf-conversational-export.test.ts
[测试] packages/scoring/analytics/**tests**/hf-tool-calling-export.test.ts

### 新增 acceptance contracts

[测试] tests/acceptance/runtime-dashboard-live-api.test.ts
[测试] tests/acceptance/runtime-dashboard-live-server.test.ts
[测试] tests/acceptance/runtime-dashboard-mcp-server.test.ts
[测试] tests/acceptance/runtime-dashboard-mcp-fallback.test.ts
[测试] tests/acceptance/runtime-dashboard-sft-tab.test.ts
[测试] tests/acceptance/runtime-dashboard-docs-contract.test.ts
[测试] tests/acceptance/training-ready-sft-docs-contract.test.ts

---

## \_bmad

[生产] \_bmad/speckit/scripts/powershell/check-prerequisites.ps1
[生产] \_bmad/speckit/scripts/powershell/common.ps1
[生产] \_bmad/speckit/scripts/powershell/create-new-feature.ps1
[生产] \_bmad/speckit/scripts/powershell/find-related-docs.ps1
[生产] \_bmad/speckit/scripts/powershell/setup_worktree.ps1
[生产] \_bmad/speckit/scripts/powershell/setup-plan.ps1
[生产] \_bmad/speckit/scripts/powershell/update-agent-context.ps1
[生产] \_bmad/speckit/scripts/powershell/validate-audit-config.ps1
[生产] \_bmad/speckit/scripts/powershell/validate-sync-manifest.ps1
[生产] \_bmad/speckit/scripts/python/check_speckit_prerequisites.py
[生产] \_bmad/speckit/scripts/python/migrate_bmad_output_to_subdirs.py
[生产] \_bmad/speckit/scripts/python/migrate_planning_artifacts_to_branch.py
[生产] \_bmad/speckit/scripts/python/validate_sync_manifest.py
[生产] \_bmad/speckit/scripts/shell/check-prerequisites.sh
[生产] \_bmad/speckit/scripts/shell/common.sh
[生产] \_bmad/speckit/scripts/shell/create-new-feature.sh
[生产] \_bmad/speckit/scripts/shell/find-related-docs.sh
[生产] \_bmad/speckit/scripts/shell/setup_worktree.sh
[生产] \_bmad/speckit/scripts/shell/setup-plan.sh
[生产] \_bmad/speckit/scripts/shell/update-agent-context.sh
[生产] \_bmad/speckit/scripts/shell/validate-audit-config.sh
[生产] \_bmad/speckit/scripts/shell/validate-sync-manifest.sh

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

[测试] scoring/**tests**/calculator.test.ts
[测试] scoring/**tests**/constants.test.ts
[测试] scoring/**tests**/e2e/eval-question-flow.test.ts
[测试] scoring/**tests**/integration/calculator-schema.test.ts
[测试] scoring/**tests**/integration/dashboard-epic-aggregate.test.ts
[测试] scoring/**tests**/integration/dashboard-fixture.test.ts
[测试] scoring/**tests**/integration/table-calculator.test.ts
[测试] scoring/**tests**/integration/test_calculator_imported_in_production_path.test.ts
[测试] scoring/**tests**/path.test.ts
[测试] scoring/**tests**/rules/parser.test.ts
[测试] scoring/**tests**/rules/ref-resolution.test.ts
[测试] scoring/**tests**/schema.test.ts
[测试] scoring/**tests**/writer/validate-scenario.test.ts
[测试] scoring/**tests**/writer/writer.test.ts
[测试] scoring/**tests**/writer/write-score.test.ts
[测试] scoring/analytics/**tests**/audit-report-parser.test.ts
[测试] scoring/analytics/**tests**/cluster-weaknesses.test.ts
[测试] scoring/analytics/**tests**/prompt-optimizer.test.ts
[测试] scoring/analytics/**tests**/rule-suggestion.test.ts
[测试] scoring/analytics/**tests**/sft-extractor.test.ts
[生产] scoring/analytics/audit-report-parser.ts
[生产] scoring/analytics/cluster-weaknesses.ts
[生产] scoring/analytics/prompt-optimizer.ts
[生产] scoring/analytics/rule-suggestion.ts
[生产] scoring/analytics/sft-extractor.ts
[测试] scoring/bugfix/**tests**/writeback.test.ts
[生产] scoring/bugfix/writeback.ts
[测试] scoring/coach/**tests**/coach-integration.test.ts
[测试] scoring/coach/**tests**/diagnose.test.ts
[测试] scoring/coach/**tests**/discovery.test.ts
[测试] scoring/coach/**tests**/filter-epic-story.test.ts
[测试] scoring/coach/**tests**/forbidden.test.ts
[测试] scoring/coach/**tests**/format.test.ts
[测试] scoring/coach/**tests**/loader.test.ts
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
[测试] scoring/dashboard/**tests**/compute.test.ts
[测试] scoring/dashboard/**tests**/compute-epic-aggregate.test.ts
[测试] scoring/dashboard/**tests**/format.test.ts
[生产] scoring/dashboard/compute.ts
[生产] scoring/dashboard/format.ts
[生产] scoring/dashboard/index.ts
[测试] scoring/eval-questions/**tests**/cli-integration.test.ts
[测试] scoring/eval-questions/**tests**/manifest-loader.test.ts
[测试] scoring/eval-questions/**tests**/run-core.test.ts
[测试] scoring/eval-questions/**tests**/template-generator.test.ts
[生产] scoring/eval-questions/agent-answer.ts
[生产] scoring/eval-questions/manifest-loader.ts
[生产] scoring/eval-questions/run-core.ts
[生产] scoring/eval-questions/template-generator.ts
[测试] scoring/gate/**tests**/rollback.test.ts
[测试] scoring/gate/**tests**/version-lock.test.ts
[生产] scoring/gate/rollback.ts
[生产] scoring/gate/version-lock.ts
[测试] scoring/orchestrator/**tests**/parse-and-write.test.ts
[生产] scoring/orchestrator/index.ts
[生产] scoring/orchestrator/parse-and-write.ts
[测试] scoring/parsers/**tests**/audit-arch.test.ts
[测试] scoring/parsers/**tests**/audit-generic.test.ts
[测试] scoring/parsers/**tests**/audit-index.test.ts
[测试] scoring/parsers/**tests**/audit-prd.test.ts
[测试] scoring/parsers/**tests**/audit-story.test.ts
[测试] scoring/parsers/**tests**/dimension-parser.test.ts
[测试] scoring/parsers/**tests**/integration/parse-and-write.test.ts
[测试] scoring/parsers/**tests**/llm-fallback.test.ts
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
[测试] scoring/query/**tests**/loader.test.ts
[测试] scoring/query/**tests**/parse-epic-story.test.ts
[测试] scoring/query/**tests**/query.test.ts
[生产] scoring/query/index.ts
[生产] scoring/query/loader.ts
[生产] scoring/query/parse-epic-story.ts
[测试] scoring/scores/**tests**/format-table.test.ts
[生产] scoring/scores/format-table.ts
[测试] scoring/trigger/**tests**/trigger-loader.test.ts
[生产] scoring/trigger/trigger-loader.ts
[测试] scoring/utils/**tests**/hash.test.ts
[测试] scoring/utils/**tests**/sanitize-iteration.test.ts
[生产] scoring/utils/hash.ts
[生产] scoring/utils/sanitize-iteration.ts
[测试] scoring/veto/**tests**/apply-tier-and-veto.test.ts
[测试] scoring/veto/**tests**/epic-veto.test.ts
[测试] scoring/veto/**tests**/tier.test.ts
[测试] scoring/veto/**tests**/veto.test.ts
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

[生产] tmp-e10s5b/\_bmad/speckit/scripts/bmad-speckit.ps1

## 根目录

[生产] vitest.config.ts
