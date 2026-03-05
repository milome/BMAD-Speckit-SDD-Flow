# scoring/coach

Story 4.2 的 AI Code Coach 模块。模块职责是消费既有 scoring 数据并输出诊断报告，不执行新的审计流程。

## 触发时机

- 手动触发：`npm run coach:diagnose -- --run-id=<id> --format=json|markdown`
- 阶段触发：post_impl 完成后由配置控制是否自动触发

## 配置

文件：`config/coach-trigger.yaml`

```yaml
# 全局 skill 路径（运行时由 config.ts 展开 {SKILLS_ROOT}）
required_skill_path: "{SKILLS_ROOT}/bmad-code-reviewer-lifecycle/SKILL.md"
auto_trigger_post_impl: false
run_mode: "manual_or_post_impl"
```

- `required_skill_path`：必引全链路 Skill 路径。`{SKILLS_ROOT}` = Windows `%USERPROFILE%\.cursor\skills\`、macOS/Linux `~/.cursor/skills/`
- `auto_trigger_post_impl`：post_impl 后是否自动触发，默认 `false`
- `run_mode`：运行模式（manual_or_post_impl / manual_only / post_impl_only）

## manifest 入驻与路由防御

- manifest 条目：`_bmad/_config/agent-manifest.csv` 中 `ai-coach`（`module=scoring`）。
- persona 来源：`_bmad/scoring/agents/ai-coach.md`（`diagnose.ts` 优先从 manifest 指向文件加载）。
- 路由防御：`ai-coach` 不进入常规 `/bmad ask` 可见列表，也不参与自动调度。
- 调用边界：仅允许两种入口
  - 显式指定 `ai-coach`
  - `coachDiagnose` 专属链路（CLI/API）

## 核心 API

- `coachDiagnose(runId, options?)`
- `formatToMarkdown(report)`
- `loadRunRecords(runId, dataPath?)`
- `loadForbiddenWords()` / `validateForbiddenWords(text)`

## 输出字段

- `summary`
- `phase_scores`
- `weak_areas`
- `recommendations`
- `iteration_passed`

## 错误码与异常

- `run_not_found`：找不到 run_id 对应记录
- `forbidden_dominant_terms`：诊断文本命中主导禁止词（面试、面试官、应聘、候选人）

## 示例命令

```bash
npm test -- scoring/coach/__tests__/loader.test.ts
npm test -- scoring/coach/__tests__/forbidden.test.ts
npm test -- scoring/coach/__tests__/diagnose.test.ts
npm test -- scoring/coach/__tests__/coach-integration.test.ts
npx ts-node scripts/accept-e4-s2.ts --run-id=sample-run --format=json
npx ts-node scripts/accept-e4-s2.ts --run-id=sample-run --format=markdown
npm run coach:diagnose -- --run-id=sample-run --format=json
```

