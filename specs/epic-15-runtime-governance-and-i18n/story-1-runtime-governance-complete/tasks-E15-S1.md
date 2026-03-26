# tasks-E15-S1：Runtime Governance 完整实施

**Epic**：E15 runtime-governance-and-i18n  
**Story ID**：15.1  
**输入**：spec-E15-S1.md、plan-E15-S1.md、IMPLEMENTATION_GAPS-E15-S1.md

**执行基线**：S1、S3 已 PASS；从 S2 起手。tasks 反映 S2–S16 依赖与批次。

**勾选状态（2026-03-24）**：第 2 节任务列表与第 7 节验收表内复选框已全部勾选为完成，与 Stage 4 审计通过及 `_bmad-output/.../prd.tasks-E15-S1.json` 中各 `passes: true` 一致。

**措辞规则**：本文件内任务描述**禁止**使用「或、若、可能、若存在、可选、可考虑、等效、备选」等模糊词；每条任务给出**唯一**文件路径、**唯一**行为、**唯一**验收命令。

**Implement 阶段追踪（speckit-workflow）**：进入 `/speckit.implement`（含等价 implement 命令）前**必须**已创建并持续更新  
`_bmad-output/implementation-artifacts/epic-15-runtime-governance-and-i18n/story-1-runtime-governance-complete/prd.tasks-E15-S1.json`  
与  
`_bmad-output/implementation-artifacts/epic-15-runtime-governance-and-i18n/story-1-runtime-governance-complete/progress.tasks-E15-S1.txt`。  
每完成一个 Batch，以及每闭合一个 userStory，更新 prd 中对应条目的 `passes` 与 `tddRecords`，并在 progress 文件写入完成标记与时间戳。

---

## 1. 本批任务 ↔ 需求追溯

| 任务 ID | 需求文档 | 章节 | 需求要点 |
|---------|----------|------|----------|
| S-PRD-ALIGN | speckit-workflow §5.1 | — | prd/progress 与 tasks 批次对齐 |
| S2 | spec §3.2.1 | GAP-1 | Hooks shared core |
| S4–S5 | spec §3.2.2 | GAP-2 | Hooks Claude/Cursor adapter |
| S6 | spec §3.3 | GAP-3 | init 自动 registry |
| S7 | spec §3.2.3 | GAP-4 | Hooks 部署 shared |
| S8 | spec §3.4.1 | GAP-5 | sprint-planning/sprint-status 完成时 sync |
| S9 | spec §3.4.2 | GAP-6 | create-epics-and-stories 完成时 sync |
| S10 | spec §3.4.2 | GAP-6 | create-story/story audit 完成时 sync |
| S11 | spec §3.4.3 | GAP-7 | dev-story/post-audit 启动生成 run context；完成后持久化 |
| S12–S14 | spec §3.5 | GAP-8 | 三种 sourceMode 自动触发（依赖 S8–S11 接线） |
| S15 | spec §3.6 | GAP-9 | Hook 边界 |
| S16 | spec §3.7 | GAP-10 | 文档责任矩阵 |
| S-PACK | tasks 本节「Batch 7」 | — | npm pack、干净目录安装、runtime 子命令门禁 |
| S-SYNC-V6 | tasks 本节「Batch 8」 | — | upstream 文档与 v6 同步脚本保护恢复一致 |
| S8-WIRING-TEST | tasks 本节「Batch 8a」 | — | `runtime-upstream-s8-sync-wiring` 门禁 sprint-planning、sprint-status |
| S9-WIRING-TEST | tasks 本节「Batch 8a」 | — | `runtime-upstream-s9-sync-wiring` 门禁 step-04-final-validation |
| S10-WIRING-TEST | tasks 本节「Batch 8a」 | — | `runtime-upstream-s10-sync-wiring` 门禁 create-story、story-audit、Cursor SKILL |
| S11-WIRING-TEST | tasks 本节「Batch 8b」 | — | `runtime-upstream-s11-sync-wiring` 含 Claude SKILL 断言 |

---

## 2. 任务列表（含具体路径与内容）

### Batch 0：PRD 与进度对齐（S-PRD-ALIGN）

**依赖**：无。本 Batch **先于** Batch 1 执行。

- [x] **S-PRD-ALIGN** prd.userStories 与 tasks 批次 ID 对齐
  - **修改路径**：`_bmad-output/implementation-artifacts/epic-15-runtime-governance-and-i18n/story-1-runtime-governance-complete/prd.tasks-E15-S1.json`
  - **内容**：`userStories` 含独立条目 `US-S-PACK`（acceptanceCriteria 绑定 `tests/acceptance/accept-pack-bmad-speckit.test.ts` PASS）、`US-S-SYNC-V6`（acceptanceCriteria 绑定 `tests/acceptance/runtime-v6-sync-protected-paths.test.ts` PASS）；`US-S8-WIRING-TEST`、`US-S9-WIRING-TEST`、`US-S10-WIRING-TEST`、`US-S11-WIRING-TEST` 各绑定 `tests/acceptance/runtime-upstream-s8-sync-wiring.test.ts` 至 `runtime-upstream-s11-sync-wiring.test.ts` 对应单文件 PASS；`US-S-FINAL` 的 `title` 与 `acceptanceCriteria` 写明 tasks §4 所列全部 vitest 路径与根目录 `npm run lint` 退出码 0；`US-S-LINT` 保留并与 `npm run lint` 一致
  - **验收**：`rg "US-S-PACK" _bmad-output/implementation-artifacts/epic-15-runtime-governance-and-i18n/story-1-runtime-governance-complete/prd.tasks-E15-S1.json` 退出码 0；`rg "US-S-SYNC-V6" _bmad-output/implementation-artifacts/epic-15-runtime-governance-and-i18n/story-1-runtime-governance-complete/prd.tasks-E15-S1.json` 退出码 0；`rg "US-S8-WIRING-TEST" _bmad-output/implementation-artifacts/epic-15-runtime-governance-and-i18n/story-1-runtime-governance-complete/prd.tasks-E15-S1.json` 退出码 0；`rg "US-S9-WIRING-TEST" _bmad-output/implementation-artifacts/epic-15-runtime-governance-and-i18n/story-1-runtime-governance-complete/prd.tasks-E15-S1.json` 退出码 0；`rg "US-S10-WIRING-TEST" _bmad-output/implementation-artifacts/epic-15-runtime-governance-and-i18n/story-1-runtime-governance-complete/prd.tasks-E15-S1.json` 退出码 0；`rg "US-S11-WIRING-TEST" _bmad-output/implementation-artifacts/epic-15-runtime-governance-and-i18n/story-1-runtime-governance-complete/prd.tasks-E15-S1.json` 退出码 0

### Batch 1：Hooks 基础层（S2）

**依赖**：S1 已 PASS；Batch 0（S-PRD-ALIGN）已完成。

- [x] **S2.1** 核实 `_bmad/runtime/hooks/` 下 4 个文件存在且职责符合 spec §3.2.1
  - **文件路径**：`_bmad/runtime/hooks/runtime-policy-inject-core.js`、`run-emit-runtime-policy.js`、`should-skip-runtime-policy.js`、`build-runtime-error-message.js`
  - **验收**：`npx vitest run tests/acceptance/runtime-hooks-shared-core.test.ts`

### Batch 2：Hooks Adapter 层（S4、S5）

**依赖**：S2。

- [x] **S4** Claude adapter 仅调 shared core
  - **修改路径**：`_bmad/claude/hooks/runtime-policy-inject.js`
  - **验收**：`npx vitest run tests/acceptance/runtime-hooks-claude-adapter.test.ts`

- [x] **S5** Cursor adapter 仅调 shared core
  - **修改路径**：`_bmad/cursor/hooks/runtime-policy-inject.js`
  - **验收**：`npx vitest run tests/acceptance/runtime-hooks-cursor-adapter.test.ts`

### Batch 3：Init & Deploy（S6、S7）

**依赖**：S3 已 PASS；S2。

- [x] **S6** init 后自动 bootstrap registry + project context
  - **修改路径**：`scripts/init-to-root.js`
  - **内容**：在 bootstrap project context 之后调用 `writeDefaultRuntimeRegistry`、`writeDefaultRuntimeContext`（定义见 `scripts/runtime-context-registry.ts`、`scripts/runtime-context.ts`）
  - **验收**：`npx vitest run tests/acceptance/runtime-init-auto-registry-bootstrap.test.ts`

- [x] **S7** init 部署 shared helpers 到 `.claude/hooks/`、`.cursor/hooks/`，源目录 `_bmad/runtime/hooks/`
  - **修改路径 1**：`scripts/init-to-root.js`
  - **修改路径 2**：`packages/bmad-speckit/src/services/sync-service.js`
  - **内容**：两段代码中的部署逻辑均将 `_bmad/runtime/hooks/` 下全部 `*.js` 复制到 `.claude/hooks/`、`.cursor/hooks/`（含 shared core 与 adapter 所需文件，与 `runtime-hooks-deploy-layering.test.ts` 断言一致）
  - **验收**：`npx vitest run tests/acceptance/runtime-hooks-deploy-layering.test.ts`

### Batch 4：Phase C Workflow 接入（S8–S11）

**依赖**：S3；S8→S9→S10→S11 顺序。

**职责边界**：本 Batch 为 **Story 15.1 任务列表内**对 `_bmad` 工作流、Agent、Skill **正文插入 Runtime Governance 接线的唯一批次**（Batch 8a 仅补 acceptance 测试与 `package.json`，不改 `_bmad` 正文）。

---

#### S8：sprint-planning / sprint-status 写入 sprint-status.yaml 后自动 sync

**S8.1 sprint-planning**

- **修改路径**：`_bmad/bmm/workflows/4-implementation/sprint-planning/instructions.md`
- **插入位置**：`<step n="5">` 内，在 `</step>` 之前，`<action>Display completion summary to {user_name}...` 之前
- **具体内容**：

```xml
<action>MANDATORY: After writing {status_file}, run sync to refresh runtime registry and project context.</action>
<action>Execute: npx bmad-speckit sync-runtime-context-from-sprint</action>
<action>Verify stdout contains the line starting with OK: registry and project context synced</action>
```

**S8.2 sprint-status（仅 corrections 分支写入文件后）**

- **修改路径**：`_bmad/bmm/workflows/4-implementation/sprint-status/instructions.md`
- **插入位置**：`<check if="user provided corrections">` 内，`<action>Re-parse the file with corrected statuses</action>` 之后、`</check>` 之前
- **具体内容**：

```xml
<action>Execute: npx bmad-speckit sync-runtime-context-from-sprint</action>
<action>Verify stdout contains the line starting with OK: registry and project context synced</action>
```

**说明**：sync 附加在 sprint-status step 2 的 `<check if="user provided corrections">` 分支内，紧跟 `Update sprint-status.yaml with corrected values` 与 `Re-parse the file with corrected statuses` 之后；该分支为 sprint-status 写入文件的唯一点。

**验收**：`npx vitest run tests/acceptance/runtime-context-project-sync.test.ts`；`npx vitest run tests/acceptance/runtime-upstream-s8-sync-wiring.test.ts`

---

#### S9：create-epics-and-stories step 4 结束时执行 sync

**前置约束（写入 step-04 正文）**：`create-epics-and-stories` 的 Step 4 在 `sprint-planning` 已生成 `_bmad-output/implementation-artifacts/sprint-status.yaml` 之后执行；该文件在 Step 4 开始时**必须**存在。

- **修改路径**：`_bmad/bmm/workflows/3-solutioning/create-epics-and-stories/steps/step-04-final-validation.md`
- **插入位置**：「### 6. Complete and Save」小节内，在「Save the final epics.md」之后、「**Present Final Menu:**」之前
- **具体内容**：

```markdown
**Runtime Governance (S9 - MANDATORY):** 本 step 开始前 `_bmad-output/implementation-artifacts/sprint-status.yaml` 已存在（sprint-planning 已执行）。保存 epics.md 之后执行：
`npx bmad-speckit sync-runtime-context-from-sprint`
Exit code must be 0. Stdout must contain the line starting with `OK: registry and project context synced`.
文件缺失：终止工作流；向用户输出固定文案：先运行 sprint-planning，再从 create-epics-and-stories 的 Step 1 重跑。
```

**验收**：`npx vitest run tests/acceptance/runtime-context-epic-sync.test.ts`；`npx vitest run tests/acceptance/runtime-upstream-s9-sync-wiring.test.ts`

---

#### S10：create-story 与 story audit 完成时刷新 story context

**S10.1 扩展 sync 脚本**

- **实现位置**：`@bmad-speckit/runtime-context`（`sync-from-sprint-cli.ts`），CLI：`npx bmad-speckit sync-runtime-context-from-sprint`。
- **内容**：增加 CLI 参数 `--story-key <EPIC-STORY-SLUG>`。带 `--story-key` 的执行顺序：先执行 `buildProjectRegistryFromSprintStatus`、`writeRuntimeContextRegistry`、`writeRuntimeContextFromSprintStatus`；再调用 `ensureStoryRuntimeContext(root, { epicId, storyId })`，`epicId` 由 story key 首段数字推导为 `epic-<N>`，`storyId` 等于传入的 story key 字符串。

**S10.2 create-story**

- **修改路径**：`_bmad/bmm/workflows/4-implementation/create-story/instructions.xml`
- **插入位置**：`<step n="6">` 内，`<action>Save file, preserving ALL comments and structure including STATUS DEFINITIONS</action>` 之后，`<action>Report completion</action>` 之前
- **具体内容**：

```xml
<action>MANDATORY: Run sync to refresh runtime registry and story context.</action>
<action>Execute: npx bmad-speckit sync-runtime-context-from-sprint --story-key {{story_key}}</action>
<action>Verify stdout contains the line starting with OK: registry and project context synced</action>
```

**S10.3 story audit（两处均改）**

- **修改路径 A**：`_bmad/claude/agents/bmad-story-audit.md`
- **修改路径 B**：`_bmad/cursor/skills/bmad-story-assistant/SKILL.md`
- **插入位置 A**：「执行结束时必须输出」YAML 块之前，新增独立 Markdown 小节「Runtime sync (S10)」
- **插入位置 B**：「【审计通过后必做】」段落内、`npx bmad-speckit score` 命令说明**之前**
- **具体内容（两处文字一致，占位符由执行时替换）**：

```markdown
**Runtime sync (S10 - MANDATORY):** 审计结论为通过；通过判定之后、返回主 Agent 之前执行：
`npx bmad-speckit sync-runtime-context-from-sprint --story-key <story_key>`
`<story_key>` 填被审计 Story 的 kebab-case key，与 sprint-status `development_status` 中的键名相同。
```

**验收**：`npx vitest run tests/acceptance/runtime-context-story-sync.test.ts`；`npx vitest run tests/acceptance/runtime-upstream-s10-sync-wiring.test.ts`

---

#### S11：dev-story 启动生成 run context；step 9  sprint 更新后持久化；post-audit 按 SKILL 执行

**S11.1 新增脚本**

- **实现位置**：`@bmad-speckit/runtime-context` 包（与 `@bmad-speckit/scoring` 同构发布），CLI 入口：`bmad-speckit ensure-run-runtime-context`（见 `packages/runtime-context/src/cli.ts`）。
- **内容**：CLI 固定参数：`--story-key <KEY>`、`--lifecycle` 取值仅 `dev_story`、`post_audit` 两项。`--lifecycle dev_story` 且不带 `--persist`：生成 run context、stdout 打印 `RUN_ID:<uuid>`、将 `{ storyKey, runId }` 写入 `_bmad-output/runtime/last-dev-story-run.json`。`--lifecycle dev_story` 且带 `--persist`：读取 `_bmad-output/runtime/last-dev-story-run.json` 的 `runId`，调用 `writeRuntimeContextRegistry` 完成持久化。`--lifecycle post_audit` 且不带 `--persist`：同上，写入 `_bmad-output/runtime/last-post-audit-run.json`。`--lifecycle post_audit` 且带 `--persist`：读取 `_bmad-output/runtime/last-post-audit-run.json` 的 `runId`，调用 `writeRuntimeContextRegistry` 完成持久化。`ensureRunRuntimeContext` 从 `story_key` 解析 epic 编号与 story 编号（规则与 `create-story` 的 story key 一致）。实现引用 `packages/runtime-context` 内 `ensureRunRuntimeContext`（原 `scripts/runtime-context.ts` 逻辑已迁入该包）。

**S11.2 dev-story**

- **修改路径**：`_bmad/bmm/workflows/4-implementation/dev-story/instructions.xml`
- **插入位置 1**：`<step n="1">` 内，在第一个 `<goto anchor="task_check" />` 之前
- **插入内容 1**：

```xml
<action>MANDATORY: Generate run context for dev_story lifecycle.</action>
<action>Execute: npx bmad-speckit ensure-run-runtime-context --story-key {{story_key}} --lifecycle dev_story</action>
<action>Confirm _bmad-output/runtime/last-dev-story-run.json exists and contains runId</action>
```

- **插入位置 2**：`<step n="9">` 内，在 `<check if="{sprint_status} file exists AND {{current_sprint_status}} != 'no-sprint-tracking'">` 块中，`<action>Save file, preserving ALL comments and structure including STATUS DEFINITIONS</action>` 之后，`<output>✅ Story status updated...</output>` 之前
- **插入内容 2**：

```xml
<action>MANDATORY: Persist run context to registry after sprint-status write.</action>
<action>Execute: npx bmad-speckit ensure-run-runtime-context --story-key {{story_key}} --lifecycle dev_story --persist</action>
```

**S11.2 补充**：step 9 的 `--persist` 读取 `_bmad-output/runtime/last-dev-story-run.json`；该文件由本工作流 step 1 的无 `--persist` 调用写入。

**S11.3 post-audit**

- **修改路径 A**：`_bmad/cursor/skills/bmad-story-assistant/SKILL.md`
- **修改路径 B**：`_bmad/claude/skills/bmad-story-assistant/SKILL.md`
- **插入位置**：阶段四「实施后审计」章节中，子标题「执行体: bmad-story-post-audit」的**首段文字之前**
- **具体内容（两处文字一致）**：

```markdown
**Runtime Governance (S11 - post-audit):** 主 Agent 在调用 post-audit 子任务之前执行：
`npx bmad-speckit ensure-run-runtime-context --story-key {story_key} --lifecycle post_audit`
子任务返回之后执行：
`npx bmad-speckit ensure-run-runtime-context --story-key {story_key} --lifecycle post_audit --persist`
`{story_key}` 为当前 Story 的 kebab-case key。
```

**验收**：`npx vitest run tests/acceptance/runtime-context-run-sync.test.ts`；`npx vitest run tests/acceptance/runtime-upstream-s11-sync-wiring.test.ts`

---

### Batch 5：三种 sourceMode 自动触发（S12–S14）

**依赖**：S8、S9、S10、S11 接线完成。

- [x] **S12** full_bmad 入口自动刷新
  - **修改路径**：`tests/acceptance/runtime-context-full-bmad-auto-trigger.test.ts`
  - **内容**：增加用例：读取 `_bmad/bmm/workflows/4-implementation/sprint-planning/instructions.md`、`_bmad/bmm/workflows/4-implementation/sprint-status/instructions.md`、`_bmad/bmm/workflows/3-solutioning/create-epics-and-stories/steps/step-04-final-validation.md`、`_bmad/bmm/workflows/4-implementation/create-story/instructions.xml`，每份文件内容**必须**包含子字符串 `bmad-speckit sync-runtime-context-from-sprint`
  - **验收**：`npx vitest run tests/acceptance/runtime-context-full-bmad-auto-trigger.test.ts`

- [x] **S13** seeded_solutioning 自动建 registry/context
  - **修改路径**：`tests/acceptance/runtime-context-seeded-solutioning-auto-trigger.test.ts`
  - **内容**：增加用例：`_bmad/bmm/workflows/3-solutioning/create-epics-and-stories/steps/step-04-final-validation.md` 内容包含 `bmad-speckit sync-runtime-context-from-sprint`；`_bmad/bmm/workflows/4-implementation/create-story/instructions.xml` 内容包含 `--story-key`
  - **验收**：`npx vitest run tests/acceptance/runtime-context-seeded-solutioning-auto-trigger.test.ts`

- [x] **S14** standalone_story 自动建 story/run context
  - **修改路径**：`tests/acceptance/runtime-context-standalone-story-auto-trigger.test.ts`
  - **内容**：增加用例：`_bmad/bmm/workflows/4-implementation/create-story/instructions.xml` 内容包含 `--story-key`；`_bmad/bmm/workflows/4-implementation/dev-story/instructions.xml` 内容包含 `bmad-speckit ensure-run-runtime-context`
  - **验收**：`npx vitest run tests/acceptance/runtime-context-standalone-story-auto-trigger.test.ts`

### Batch 6：边界与文档（S15、S16）

- [x] **S15** Hook 边界：只消费不补状态
  - **验收**：`npx vitest run tests/acceptance/runtime-policy-inject-auto-trigger-boundary.test.ts`

- [x] **S16** 文档责任矩阵与自动触发链
  - **修改路径**：`docs/design/runtime-governance-implementation-analysis.md`
  - **修改路径**：`docs/reference/runtime-governance-upstream-wiring.md`（新建单文件，集中列出 §3 表格全文）
  - **修改路径**：`docs/how-to/runtime-sync-after-workflows.md`（新建单文件，逐步列出 sync 命令与前置条件）
  - **内容**：三份文档均包含 §3「upstream 修改汇总表」的完整复制；`docs/how-to/runtime-sync-after-workflows.md` 首段写明 S9 前置：`sprint-status.yaml` 已存在
  - **验收**：`rg "sync-runtime-context-from-sprint" docs/design/runtime-governance-implementation-analysis.md docs/reference/runtime-governance-upstream-wiring.md docs/how-to/runtime-sync-after-workflows.md` 退出码 0；`rg "sprint-planning" docs/design/runtime-governance-implementation-analysis.md` 退出码 0

### Batch 7：npm pack、干净目录安装与 runtime 子命令（S-PACK）

**依赖**：无（可与 S8–S11 并行；发布 `bmad-speckit` 前必须 PASS）。

**验收目标**

- **G1**：根目录 `npm run prepublishOnly` 成功退出；`scripts/prepublish-check.js` 将 `@bmad-speckit/scoring`、`@bmad-speckit/runtime-context`、`@bmad-speckit/runtime-emit` 按各自 `package.json` 的 `files` 同步到 `packages/bmad-speckit/node_modules/@bmad-speckit/*`，并与 `packages/bmad-speckit/package.json` 的 `bundleDependencies` 一致。
- **G2**：在 `packages/bmad-speckit` 执行 `npm pack --pack-destination .` 生成单一 `bmad-speckit-*.tgz`； tarball **不**含历史遗留的嵌套 `*.tgz`（`packages/bmad-speckit/.npmignore` 排除 `*.tgz`）。
- **G3**：在**与 monorepo 无 workspace 链接**的空白目录中仅 `npm install "<绝对路径>/bmad-speckit-0.1.0.tgz"` 后，下列子命令全部成功（退出码 0），stdout 满足给定断言。

**实现与门禁文件**

- [x] **S-PACK.1** `bundleDependencies` 与 prepublish 同步  
  - **修改路径**：`packages/bmad-speckit/package.json`（`bundleDependencies` 列出上述三个 scoped 包）  
  - **修改路径**：根目录 `package.json` 的 `prepublishOnly` 在 pack 前执行构建与 `node scripts/prepublish-check.js`  
  - **修改路径**：`scripts/prepublish-check.js`（将 workspace 包复制进 `packages/bmad-speckit/node_modules/@bmad-speckit/...` 并校验产物）

- [x] **S-PACK.2** 避免嵌套 tgz  
  - **修改路径**：`packages/bmad-speckit/.npmignore` 含 `*.tgz`

- [x] **S-PACK.3** 自动化验收测试  
  - **修改路径**：`tests/acceptance/accept-pack-bmad-speckit.test.ts`  
  - **内容**：根目录 `npm run prepublishOnly` → `packages/bmad-speckit` 内 `npm pack --pack-destination .` → 临时目录最小 `package.json` → `npm install` 该 tgz → 依次执行 `npx bmad-speckit version`（匹配 `0.1.0`）、写入最小 `sprint-status.yaml` 后 `npx bmad-speckit sync-runtime-context-from-sprint`（stdout 含 `OK: registry and project context synced`）、`npx bmad-speckit ensure-run-runtime-context --story-key 1-1-test-story --lifecycle dev_story`（stdout 含 `RUN_ID:` + UUID）

**手动验收步骤（与 `accept-pack-bmad-speckit.test.ts` 对齐；任一步失败则整批不通过）**

1. 仓库根目录执行 `npm run prepublishOnly`，进程退出码 0。  
2. `cd packages/bmad-speckit`；若存在旧的 `bmad-speckit-*.tgz` 先删除；执行 `npm pack --pack-destination .`，确认生成唯一匹配的 `bmad-speckit-0.1.0.tgz`（版本以 `package.json` 为准）。  
3. 在系统临时目录新建空文件夹，写入仅含 `name`/`version`/`private` 的最小 `package.json`。  
4. 在该文件夹执行 `npm install "<tgz 的绝对路径>"`，退出码 0。  
5. 执行 `npx bmad-speckit version`，输出包含 `0.1.0`。  
6. 创建目录 `_bmad-output/implementation-artifacts/`，新建 `sprint-status.yaml`，内容至少包含：  
   `development_status:` 下 `epic-1: backlog` 与 `1-1-test-story: backlog`。  
7. 执行 `npx bmad-speckit sync-runtime-context-from-sprint`，stdout 出现以 `OK: registry and project context synced` 开头的行。  
8. 执行 `npx bmad-speckit ensure-run-runtime-context --story-key 1-1-test-story --lifecycle dev_story`，stdout 出现 `RUN_ID:` 后跟 UUID。  
9. 清理：删除临时目录与 `packages/bmad-speckit` 下打出的 `.tgz`（避免误入后续 pack）。

**自动化验收**：与 **§4 集成验收（S-FINAL）** 中同一条 shell 内的 `npx vitest run` 列表一致（列表含 `accept-pack-bmad-speckit.test.ts`）。仅本地调试 S-PACK 单文件：`npx vitest run tests/acceptance/accept-pack-bmad-speckit.test.ts`。

**与既有用例的分工**：`tests/acceptance/accept-install-consumer-cli.test.ts` 验证 consumer 安装与 CLI 行为；**S-PACK** 专门锁定 **`npm pack` 产物在非 workspace 干净目录可装可跑**；两者均须 PASS 方可认为发布路径完整。

### Batch 8：upstream 文档与 v6 同步脚本（S-SYNC-V6）

**依赖**：S8–S11 所改动的 `_bmad` 路径已落地（接线字符串已写入对应 instructions/workflows）。

**验收目标**

- **G1**：`docs/explanation/upstream-relationship.md` 含 **§4.4 Runtime Governance（E15）**，表格列出 sprint-planning、sprint-status、step-04、create-story、dev-story、bmad-story-audit、双端 `bmad-story-assistant` 等路径与说明；§4.3 补充备份目录与 Rollback 指向。
- **G2**：`scripts/bmad-sync-from-v6.ps1` 的 `$EXCLUDE_PATTERNS` 覆盖上述路径（Phase 2 不向工作区拷贝上游同名文件覆盖定制）。
- **G3**：同一脚本的 `$BACKUP_ITEMS` 在 Phase 2 前备份上述路径；控制台 **Rollback commands** 可将备份拷回项目根，用于同步后的恢复。

- [x] **S-SYNC-V6.1** 更新上游关系文档  
  - **修改路径**：`docs/explanation/upstream-relationship.md`  
  - **内容**：§4.1 表格增加 Runtime Governance 行指向 §4.4；新增 §4.4 路径表与恢复说明；§4.3 增加 Rollback 与 `$BackupDir` 说明句

- [x] **S-SYNC-V6.2** 更新 v6 同步脚本  
  - **修改路径**：`scripts/bmad-sync-from-v6.ps1`  
  - **内容**：`$EXCLUDE_PATTERNS` 增加 `_bmad/bmm/workflows/4-implementation/sprint-planning`、`sprint-status`、`step-04-final-validation.md`、`dev-story`、`_bmad/claude/agents/bmad-story-audit`、`_bmad/claude/skills/bmad-story-assistant`、`_bmad/cursor/skills/bmad-story-assistant`；`$BACKUP_ITEMS` 增加对应 `From`/`To`（`sprint-planning-workflow`、`sprint-status-workflow`、`step-04-final-validation.md`、`dev-story-workflow`、`bmad-story-audit.md`、`bmad-story-assistant-skill-claude`、`bmad-story-assistant-skill`）；文件头注释引用 §4.4

- [x] **S-SYNC-V6.3** 门禁测试  
  - **修改路径**：`tests/acceptance/runtime-v6-sync-protected-paths.test.ts`  
  - **内容**：断言 §4.4 标题与关键路径存在于 `upstream-relationship.md`；断言 `$EXCLUDE_PATTERNS` 与 `$BACKUP_ITEMS` 块内含脚本保护片段  
  - **验收**：`npx vitest run tests/acceptance/runtime-v6-sync-protected-paths.test.ts`

### Batch 8a：S8–S10 upstream wiring 测试补全（S8-WIRING-TEST、S9-WIRING-TEST、S10-WIRING-TEST）

**依赖**：Batch 4 **S8.1–S8.2**、**S9**、**S10.1–S10.3** 已在对应 `_bmad` 路径写入 `sync-runtime-context-from-sprint` 与 `--story-key` 等接线（见 §3 汇总表）。本 Batch **仅新增** acceptance 测试文件与 `test:bmad` 登记；**不**修改 `_bmad` 正文。

**规则**：断言子串与 §5.1–5.3 一致；**禁止**在单条 `expect` 内使用正则 alternation（`|`）表达多选一。

- [x] **S8-WIRING-TEST** 新建 `tests/acceptance/runtime-upstream-s8-sync-wiring.test.ts`
  - **修改路径**：`tests/acceptance/runtime-upstream-s8-sync-wiring.test.ts`
  - **内容**：读取 `_bmad/bmm/workflows/4-implementation/sprint-planning/instructions.md`，断言包含 `bmad-speckit sync-runtime-context-from-sprint`；读取 `_bmad/bmm/workflows/4-implementation/sprint-status/instructions.md`，断言包含 `bmad-speckit sync-runtime-context-from-sprint`
  - **验收**：`npx vitest run tests/acceptance/runtime-upstream-s8-sync-wiring.test.ts`

- [x] **S9-WIRING-TEST** 新建 `tests/acceptance/runtime-upstream-s9-sync-wiring.test.ts`
  - **修改路径**：`tests/acceptance/runtime-upstream-s9-sync-wiring.test.ts`
  - **内容**：读取 `_bmad/bmm/workflows/3-solutioning/create-epics-and-stories/steps/step-04-final-validation.md`，断言包含 `bmad-speckit sync-runtime-context-from-sprint` 与 `Runtime Governance (S9`
  - **验收**：`npx vitest run tests/acceptance/runtime-upstream-s9-sync-wiring.test.ts`

- [x] **S10-WIRING-TEST** 新建 `tests/acceptance/runtime-upstream-s10-sync-wiring.test.ts`
  - **修改路径**：`tests/acceptance/runtime-upstream-s10-sync-wiring.test.ts`
  - **内容**：读取 `_bmad/bmm/workflows/4-implementation/create-story/instructions.xml`，断言包含 `bmad-speckit sync-runtime-context-from-sprint` 与 `--story-key`；读取 `_bmad/claude/agents/bmad-story-audit.md`，断言包含 `bmad-speckit sync-runtime-context-from-sprint`；读取 `_bmad/cursor/skills/bmad-story-assistant/SKILL.md`，断言包含 `bmad-speckit sync-runtime-context-from-sprint`
  - **验收**：`npx vitest run tests/acceptance/runtime-upstream-s10-sync-wiring.test.ts`

- [x] **S8–S10-WIRING-PACKAGE** 根目录 `package.json` 的 `scripts.test:bmad` 字符串**追加**上述三个文件路径（每个路径在列表中**恰好出现一次**；与 `runtime-upstream-s11-sync-wiring.test.ts` 并列）
  - **修改路径**：`package.json`
  - **验收**：`rg "runtime-upstream-s8-sync-wiring" package.json` 退出码 0；`rg "runtime-upstream-s9-sync-wiring" package.json` 退出码 0；`rg "runtime-upstream-s10-sync-wiring" package.json` 退出码 0

### Batch 8b：S11 upstream wiring 测试补全（S11-WIRING-TEST）

**依赖**：Batch 4 **S11.3** 已在 `_bmad/cursor/skills/bmad-story-assistant/SKILL.md`、`_bmad/claude/skills/bmad-story-assistant/SKILL.md` 写入 `ensure-run-runtime-context` 与 `post_audit` 接线；`dev-story/instructions.xml` 含 dev_story 生命周期命令。

- [x] **S11-WIRING-TEST** 落地 `tests/acceptance/runtime-upstream-s11-sync-wiring.test.ts`  
  - **修改路径**：`tests/acceptance/runtime-upstream-s11-sync-wiring.test.ts`  
  - **内容**：读取 `_bmad/bmm/workflows/4-implementation/dev-story/instructions.xml`，断言包含 `bmad-speckit ensure-run-runtime-context` 与 `--lifecycle dev_story`；读取 `_bmad/cursor/skills/bmad-story-assistant/SKILL.md` 与 `_bmad/claude/skills/bmad-story-assistant/SKILL.md`，断言均包含 `bmad-speckit ensure-run-runtime-context` 与 `post_audit`  
  - **验收**：`npx vitest run tests/acceptance/runtime-upstream-s11-sync-wiring.test.ts`

---

## 3. upstream 修改汇总表（必改文件）

| 任务 | 文件路径 | 修改类型 |
|------|----------|----------|
| S8 | `_bmad/bmm/workflows/4-implementation/sprint-planning/instructions.md` | 插入 sync 调用 |
| S8 | `_bmad/bmm/workflows/4-implementation/sprint-status/instructions.md` | 在 corrections 写入后插入 sync |
| S9 | `_bmad/bmm/workflows/3-solutioning/create-epics-and-stories/steps/step-04-final-validation.md` | 插入 sync 调用与缺失文件时停止说明 |
| S10 | `bmad-speckit sync-runtime-context-from-sprint`（`@bmad-speckit/runtime-context`） | `--story-key` + `ensureStoryRuntimeContext` |
| S10 | `_bmad/bmm/workflows/4-implementation/create-story/instructions.xml` | 插入 sync 调用 |
| S10 | `_bmad/claude/agents/bmad-story-audit.md` | 插入 S10 sync 小节 |
| S10 | `_bmad/cursor/skills/bmad-story-assistant/SKILL.md` | 在审计通过后必做之前插入 S10 sync |
| S11 | `packages/runtime-context` + `bmad-speckit ensure-run-runtime-context` | 新建 |
| S11 | `_bmad/bmm/workflows/4-implementation/dev-story/instructions.xml` | step 1 插入 generate；step 9 插入 persist |
| S11 | `_bmad/cursor/skills/bmad-story-assistant/SKILL.md` | 插入 S11 post-audit 两条命令 |
| S11 | `_bmad/claude/skills/bmad-story-assistant/SKILL.md` | 插入 S11 post-audit 两条命令 |
| S12 | `tests/acceptance/runtime-context-full-bmad-auto-trigger.test.ts` | 增加 upstream 子串断言 |
| S13 | `tests/acceptance/runtime-context-seeded-solutioning-auto-trigger.test.ts` | 增加 upstream 子串断言 |
| S14 | `tests/acceptance/runtime-context-standalone-story-auto-trigger.test.ts` | 增加 upstream 子串断言 |
| S16 | `docs/design/runtime-governance-implementation-analysis.md` | 更新责任矩阵 |
| S16 | `docs/reference/runtime-governance-upstream-wiring.md` | 新建 |
| S16 | `docs/how-to/runtime-sync-after-workflows.md` | 新建 |
| S-PACK | `scripts/prepublish-check.js` | 同步 bundle 到 bmad-speckit node_modules |
| S-PACK | `packages/bmad-speckit/package.json` | `bundleDependencies` |
| S-PACK | 根目录 `package.json` | `prepublishOnly` 含 prepublish-check |
| S-PACK | `packages/bmad-speckit/.npmignore` | `*.tgz` |
| S-PACK | `tests/acceptance/accept-pack-bmad-speckit.test.ts` | pack → 干净安装 → 子命令 |
| S-SYNC-V6 | `docs/explanation/upstream-relationship.md` | §4.4 + §4.1 行 |
| S-SYNC-V6 | `scripts/bmad-sync-from-v6.ps1` | `$EXCLUDE_PATTERNS` + `$BACKUP_ITEMS` |
| S-SYNC-V6 | `tests/acceptance/runtime-v6-sync-protected-paths.test.ts` | 文档与脚本片段一致 |
| S8-WIRING-TEST | `tests/acceptance/runtime-upstream-s8-sync-wiring.test.ts` | 新建 |
| S9-WIRING-TEST | `tests/acceptance/runtime-upstream-s9-sync-wiring.test.ts` | 新建 |
| S10-WIRING-TEST | `tests/acceptance/runtime-upstream-s10-sync-wiring.test.ts` | 新建 |
| S8–S10-WIRING-PACKAGE | 根目录 `package.json` | `test:bmad` 追加三文件路径 |

---

## 4. 集成验收（AC6）

**说明**：spec §4 列出 37 个基线 acceptance 文件；本节 S-FINAL 在基线之上追加 upstream wiring、`accept-pack-bmad-speckit`、`runtime-v6-sync-protected-paths` 与根目录 **ESLint**（`npm run lint`），以本节命令为 Story 15.1 最终门禁。

- [x] **S-FINAL** 单条 shell 连续执行：下列 vitest 列表全部 PASS；随后 `npm run lint` 退出码 0。覆盖 runtime 集成、`runtime-upstream-s8`～`s11` 四件 upstream wiring、**S-PACK**（`accept-pack-bmad-speckit.test.ts`）、**S-SYNC-V6**（`runtime-v6-sync-protected-paths.test.ts`：§4.4 与 `bmad-sync-from-v6.ps1` 保护恢复一致）。

```bash
npx vitest run \
  tests/acceptance/runtime-context-registry-schema.test.ts \
  tests/acceptance/runtime-governance-lifecycle-workflow-stage.test.ts \
  tests/acceptance/runtime-context-source-mode.test.ts \
  tests/acceptance/runtime-context-registry-io.test.ts \
  tests/acceptance/runtime-context-paths.test.ts \
  tests/acceptance/runtime-context-active-scope.test.ts \
  tests/acceptance/runtime-context-project-sync.test.ts \
  tests/acceptance/runtime-context-epic-sync.test.ts \
  tests/acceptance/runtime-context-story-sync.test.ts \
  tests/acceptance/runtime-context-run-sync.test.ts \
  tests/acceptance/runtime-policy-registry-consumption.test.ts \
  tests/acceptance/runtime-policy-no-speckit-fallback.test.ts \
  tests/acceptance/runtime-policy-no-speckit-template-distribution.test.ts \
  tests/acceptance/runtime-policy-lifecycle-workflow-consumers.test.ts \
  tests/acceptance/runtime-context-full-bmad-mode.test.ts \
  tests/acceptance/runtime-context-seeded-solutioning-mode.test.ts \
  tests/acceptance/runtime-context-standalone-story-mode.test.ts \
  tests/acceptance/runtime-context-auto-trigger-contract.test.ts \
  tests/acceptance/runtime-init-auto-registry-bootstrap.test.ts \
  tests/acceptance/runtime-context-full-bmad-auto-trigger.test.ts \
  tests/acceptance/runtime-context-seeded-solutioning-auto-trigger.test.ts \
  tests/acceptance/runtime-context-standalone-story-auto-trigger.test.ts \
  tests/acceptance/runtime-policy-inject-auto-trigger-boundary.test.ts \
  tests/acceptance/runtime-hooks-layering-contract.test.ts \
  tests/acceptance/runtime-hooks-shared-core.test.ts \
  tests/acceptance/runtime-hooks-claude-adapter.test.ts \
  tests/acceptance/runtime-hooks-cursor-adapter.test.ts \
  tests/acceptance/runtime-hooks-deploy-layering.test.ts \
  tests/acceptance/runtime-context-full-chain-milestone.test.ts \
  tests/acceptance/runtime-language-english-chain-milestone.test.ts \
  tests/acceptance/runtime-policy-story-create-run-first-consumption.test.ts \
  tests/acceptance/runtime-policy-story-audit-run-first-consumption.test.ts \
  tests/acceptance/runtime-policy-workflow-stage-propagation.test.ts \
  tests/acceptance/runtime-policy-dev-story-plan-run-first-consumption.test.ts \
  tests/acceptance/runtime-policy-dev-story-tasks-run-first-consumption.test.ts \
  tests/acceptance/runtime-policy-post-audit-run-first-consumption.test.ts \
  tests/acceptance/runtime-upstream-s8-sync-wiring.test.ts \
  tests/acceptance/runtime-upstream-s9-sync-wiring.test.ts \
  tests/acceptance/runtime-upstream-s10-sync-wiring.test.ts \
  tests/acceptance/runtime-upstream-s11-sync-wiring.test.ts \
  tests/acceptance/accept-pack-bmad-speckit.test.ts \
  tests/acceptance/runtime-v6-sync-protected-paths.test.ts \
&& npm run lint
```

---

## 5. 新增 Acceptance Tests（验证 _bmad upstream 改动）

**规则**：每个测试文件使用 `expect(content.includes('子字符串'))`，子字符串为 `bmad-speckit sync-runtime-context-from-sprint`、`bmad-speckit ensure-run-runtime-context`、`--story-key` 之一；**禁止**在断言中使用正则 alternation（`|`）表达「多选一」。

### 5.1 runtime-upstream-s8-sync-wiring.test.ts

- 读取 `_bmad/bmm/workflows/4-implementation/sprint-planning/instructions.md`，断言包含 `bmad-speckit sync-runtime-context-from-sprint`
- 读取 `_bmad/bmm/workflows/4-implementation/sprint-status/instructions.md`，断言包含 `bmad-speckit sync-runtime-context-from-sprint`

### 5.2 runtime-upstream-s9-sync-wiring.test.ts

- 读取 `_bmad/bmm/workflows/3-solutioning/create-epics-and-stories/steps/step-04-final-validation.md`，断言包含 `bmad-speckit sync-runtime-context-from-sprint` 与 `Runtime Governance (S9`

### 5.3 runtime-upstream-s10-sync-wiring.test.ts

- 读取 `_bmad/bmm/workflows/4-implementation/create-story/instructions.xml`，断言包含 `bmad-speckit sync-runtime-context-from-sprint` 与 `--story-key`
- 读取 `_bmad/claude/agents/bmad-story-audit.md`，断言包含 `bmad-speckit sync-runtime-context-from-sprint`
- 读取 `_bmad/cursor/skills/bmad-story-assistant/SKILL.md`，断言包含 `bmad-speckit sync-runtime-context-from-sprint`

### 5.4 runtime-upstream-s11-sync-wiring.test.ts

- 读取 `_bmad/bmm/workflows/4-implementation/dev-story/instructions.xml`，断言包含 `bmad-speckit ensure-run-runtime-context`
- 读取 `_bmad/cursor/skills/bmad-story-assistant/SKILL.md`，断言包含 `bmad-speckit ensure-run-runtime-context` 与 `post_audit`
- 读取 `_bmad/claude/skills/bmad-story-assistant/SKILL.md`，断言包含 `bmad-speckit ensure-run-runtime-context` 与 `post_audit`

### 5.5 runtime-v6-sync-protected-paths.test.ts

- 读取 `docs/explanation/upstream-relationship.md`，断言存在 `### 4.4` 与 Runtime Governance 相关路径行
- 读取 `scripts/bmad-sync-from-v6.ps1`，在 `$EXCLUDE_PATTERNS` 与 `$BACKUP_ITEMS` 块内断言含 sprint-planning、sprint-status、step-04、dev-story、bmad-story-audit、claude `bmad-story-assistant` 等保护片段

---

## 6. 需求映射清单（tasks ↔ plan + GAPS）

| plan Phase | Gaps | tasks 对应 | 覆盖状态 |
|------------|------|------------|----------|
| Phase 1 | GAP-1 | S2 | ✅ |
| Phase 2 | GAP-2 | S4, S5 | ✅ |
| Phase 3 | GAP-3, GAP-4 | S6, S7 | ✅ |
| Phase 4 | GAP-5, GAP-6, GAP-7 | S8, S9, S10, S11 | ✅ |
| Phase 5 | GAP-8 | S12, S13, S14 | ✅ |
| Phase 6 | GAP-9, GAP-10 | S15, S16 | ✅ |
| 发布门禁 | — | S-PACK | ✅ |
| 上游同步门禁 | — | S-SYNC-V6 | ✅ |
| upstream wiring S8–S10 | — | Batch 8a（S8–S10-WIRING-TEST + S8–S10-WIRING-PACKAGE） | ✅ |
| PRD 对齐 | — | S-PRD-ALIGN | ✅ |

---

## 7. 验收表头（按 Gap 逐条验证）

| Gap ID | 对应任务 | 生产代码实现要点 | 集成测试要求 | 执行情况 | 验证通过 |
|--------|----------|------------------|--------------|----------|----------|
| GAP-1 | S2 | _bmad/runtime/hooks/*.js | runtime-hooks-shared-core.test.ts | [x] | [x] |
| GAP-2 | S4, S5 | Claude/Cursor adapter 调 shared | runtime-hooks-claude、runtime-hooks-cursor-adapter.test.ts | [x] | [x] |
| GAP-3 | S6 | init-to-root writeDefaultRuntimeRegistry | runtime-init-auto-registry-bootstrap.test.ts | [x] | [x] |
| GAP-4 | S7 | init 与 sync-service 部署 _bmad/runtime/hooks/ | runtime-hooks-deploy-layering.test.ts | [x] | [x] |
| GAP-5 | S8 | sprint-planning、sprint-status 含 sync 子串 | runtime-context-project-sync、`runtime-upstream-s8-sync-wiring.test.ts` | [x] | [x] |
| GAP-6 | S9, S10 | create-epics step-04、create-story、bmad-story-audit、bmad-story-assistant 含 sync | runtime-context-epic-sync、runtime-context-story-sync、`runtime-upstream-s9-sync-wiring.test.ts`、`runtime-upstream-s10-sync-wiring.test.ts` | [x] | [x] |
| GAP-7 | S11 | dev-story、bmad-story-assistant 含 ensure-run | runtime-context-run-sync、runtime-upstream-s11-sync-wiring | [x] | [x] |
| GAP-8 | S12–S14 | auto-trigger 测试内含 upstream 子串断言 | runtime-context-full-bmad、seeded、standalone-story-auto-trigger.test.ts | [x] | [x] |
| GAP-9 | S15 | hook 仅消费 | runtime-policy-inject-auto-trigger-boundary.test.ts | [x] | [x] |
| GAP-10 | S16 | docs 三路径 + rg 验收 | rg 退出码 0 | [x] | [x] |
| — | S-PACK | `bundleDependencies` + prepublish-check + `.npmignore` `*.tgz` | accept-pack-bmad-speckit.test.ts（pack→干净安装→三子命令） | [x] | [x] |
| — | S-SYNC-V6 | §4.4 文档 + `bmad-sync-from-v6.ps1` 排除与备份 | runtime-v6-sync-protected-paths.test.ts | [x] | [x] |

<!-- AUDIT: PASSED by code-reviewer (2026-03-24 strict tasks-doc) -->
