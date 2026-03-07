# Story 8.2：题库 list 与 add 命令

Status: ready-for-dev

**Epic**：8 eval-question-bank  
**Story**：8.2  
**Slug**：question-bank-list-add  
**来源**：epics.md §Epic 8、prd.eval-ux-last-mile.md §5.5（REQ-UX-5.3、REQ-UX-5.4、REQ-UX-5.9）  
**依赖**：Story 8.1（目录结构、manifest.yaml schema、manifest-loader）

---

## 1. 需求追溯

| PRD 需求 ID | 需求描述 | 本 Story 覆盖 | 验收对应 |
|-------------|----------|---------------|----------|
| REQ-UX-5.3 | Command `/bmad-eval-questions list` | 是 | AC-1 |
| REQ-UX-5.4 | Command `/bmad-eval-questions add --title "xxx"`，生成 q00X-{slug}.md 到当前版本目录 | 是 | AC-2, AC-3 |
| REQ-UX-5.9 | 题目 .md 与 parser 输入格式兼容 | 是 | AC-3（模板生成逻辑符合 MANIFEST_SCHEMA.md §3） |

---

## 2. Story

**As a** 团队 Lead（TeamLead），  
**I want** 运行 `/bmad-eval-questions list` 与 `/bmad-eval-questions add --title "xxx"`，  
**so that** 可查看当前版本题目清单，并新增题目时生成符合 parser 格式的 q00X-{slug}.md 模板。

---

## 3. Scope

### 3.1 本 Story 实现范围

1. **Command 实现：`/bmad-eval-questions list`**
   - 实现 list 子命令，返回当前版本题目清单
   - 调用 Story 8.1 产出的 manifest-loader 加载 `scoring/eval-questions/{version}/manifest.yaml`
   - 输出格式：题目 id、title、path（或等效可读列表）

2. **Command 实现：`/bmad-eval-questions add --title "xxx"`**
   - 实现 add 子命令，解析 `--title` 参数
   - 生成 `q00X-{slug}.md` 模板文件到当前版本目录（默认 v1，即 `scoring/eval-questions/v1/`）
   - 序号 q00X 按当前版本目录内已有题目数量递增（如已有 q001、q002，则新题为 q003）
   - slug 由 title 生成：去除非字母数字字符、空格替换为连字符、小写；若 title 为空或无效，使用 `untitled` 作为 slug

3. **题目 .md 模板生成逻辑**
   - 模板内容符合 `scoring/eval-questions/MANIFEST_SCHEMA.md` §3.1 最小模板
   - 占位符替换：`{题目标题}` ← --title 参数；`{题目 id 或描述}` ← 新生成的 id（如 q003）；`{日期}` ← 当前日期（YYYY-MM-DD）；`场景: eval_question` 固定
   - 生成完成后将新题目条目追加到 manifest.yaml 的 questions 数组，含 id、title、path、difficulty 缺省、tags 缺省

### 3.2 非本 Story 范围

| 功能 | 负责 Story | 说明 |
|------|------------|------|
| `/bmad-eval-questions run --id q001 --version v1` | Story 8.3 | 加载题目→调用评审/Skill→写入时注入 scenario=eval_question、question_version |
| run_id 约定（eval-q001-v1-{timestamp}） | Story 8.3 | 写入评分时的 run_id 格式 |
| 目录结构与 manifest schema | Story 8.1 | 已由 8.1 产出 |

---

## 4. 验收标准

| # | Scenario | Given | When | Then |
|---|----------|-------|------|------|
| AC-1 | list 返回题目清单 | v1 下有 manifest.yaml 且 questions 非空 | 用户运行 `/bmad-eval-questions list` | 返回题目清单（含 id、title、path 或等效字段）；无题目时返回空清单并明确提示 |
| AC-2 | add 生成模板到当前版本目录 | 当前版本为 v1，v1 目录存在 | 用户运行 `/bmad-eval-questions add --title "refactor-scoring"` | 在 `scoring/eval-questions/v1/` 下生成 `q00X-refactor-scoring.md`（X 为下一可用序号），文件内容符合 MANIFEST_SCHEMA.md §3.1 模板 |
| AC-3 | 题目 .md 模板生成逻辑正确 | — | add 命令执行 | 生成的文件含：题目标题、id、审计日期、场景 eval_question、总体评级占位、维度评分占位、问题清单占位、通过标准；且 manifest.yaml 中 questions 数组新增对应条目（id、title、path） |
| AC-4 | 版本参数 | v1、v2 均存在 | 用户运行 `list --version v2` 或等效参数 | 返回 v2 目录的题目清单；add 时支持 `--version v2` 将模板写入 v2 目录 |

---

## 5. Tasks / Subtasks

- [ ] **T1** Command 框架与 list 实现（AC: #1）
  - [ ] T1.1 新增 Cursor Command 文件 `bmad-eval-questions.md`（或等效），支持子命令 list、add
  - [ ] T1.2 list 子命令：调用 manifest-loader 加载当前版本 manifest，输出题目清单（id、title、path）
  - [ ] T1.3 支持 `--version v1|v2` 或等效参数指定版本；缺省为 v1
  - [ ] T1.4 无题目时输出明确提示（如「当前版本无题目」）

- [ ] **T2** add 子命令实现（AC: #2, #3）
  - [ ] T2.1 解析 `add --title "xxx"` 参数；title 必填，缺失时报错并提示用法
  - [ ] T2.2 计算下一序号：读取当前版本 manifest，从现有 questions 中解析最大 id（如 q003）→ 新 id 为 q00X（X=最大序号+1）
  - [ ] T2.3 slug 生成：title → 小写、空格→连字符、非字母数字去除；无效时用 `untitled`
  - [ ] T2.4 生成 `q00X-{slug}.md` 文件到 `scoring/eval-questions/{version}/`

- [ ] **T3** 题目 .md 模板生成逻辑（AC: #3）
  - [ ] T3.1 实现模板内容生成函数，符合 MANIFEST_SCHEMA.md §3.1 最小模板结构
  - [ ] T3.2 占位符：题目标题、id、审计日期（当前日期）、场景 eval_question、总体评级、维度评分、问题清单、通过标准
  - [ ] T3.3 将新条目（id、title、path）追加到 manifest.yaml 的 questions 数组；写回 manifest 文件
  - [ ] T3.4 文件已存在时：报错并提示用户选择不同 title 或手动处理

- [ ] **T4** 集成与验收（AC: #1, #2, #3, #4）
  - [ ] T4.1 单元测试或验收脚本：list 返回正确格式；add 生成的文件可被 manifest-loader 正确解析
  - [ ] T4.2 验收：运行 list 与 add 命令，验证 AC-1～AC-4

---

## 6. Dev Notes

### 6.1 相关架构与约束

- **依赖 Story 8.1**：manifest-loader、EvalQuestionManifest 类型、loadManifest(versionDir)；目录 `scoring/eval-questions/v1/`、`v2/` 及 manifest.yaml 已就绪
- **Command 实现方式**：采用 Cursor Command（.cursor/commands/bmad-eval-questions.md）作为入口，内部调用 `scripts/eval-questions-cli.ts` 或 `scoring/eval-questions/cli.ts` 实现 list/add 逻辑，与 bmad-coach、bmad-scores 等现有命令模式一致；子命令通过参数解析（list/add）分发
- **manifest-loader 调用**：loadManifest(versionDir) 的 versionDir 为 `scoring/eval-questions/{version}`（如 v1、v2），从项目根 resolve；返回 EvalQuestionManifest
- **模板路径**：`scoring/eval-questions/MANIFEST_SCHEMA.md` §3.1 定义最小模板；与 `scoring/parsers` 输入格式兼容

### 6.2 源树与模块

| 组件 | 路径 | 说明 |
|------|------|------|
| Command | .cursor/commands/bmad-eval-questions.md | 入口；调用 scripts/eval-questions-cli.ts 或 scoring/eval-questions/cli.ts |
| CLI 脚本 | scripts/eval-questions-cli.ts 或 scoring/eval-questions/cli.ts | 实现 list/add 子命令逻辑；接收 --version 参数 |
| manifest-loader | scoring/eval-questions/manifest-loader.ts | Story 8.1 产出；loadManifest(versionDir) 加载 manifest |
| 模板生成 | add 子命令内联或 scoring/eval-questions/template-generator.ts | 生成 q00X-{slug}.md 内容，符合 MANIFEST_SCHEMA.md §3.1 |
| 版本目录 | scoring/eval-questions/v1/、v2/ | 题目 .md 与 manifest.yaml 所在 |

### 6.3 测试标准

- 验收命令可手动执行并验证输出
- 若有单元测试：覆盖 list 加载、add 序号计算、slug 生成、模板内容结构、manifest 追加
- 不修改 Story 8.1 产出的 manifest-loader 接口；本 Story 为调用方

### 6.4 验收命令示例

```bash
# list（缺省 v1）
npx ts-node scripts/eval-questions-cli.ts list
npx ts-node scripts/eval-questions-cli.ts list --version v2

# add
npx ts-node scripts/eval-questions-cli.ts add --title "refactor-scoring"
npx ts-node scripts/eval-questions-cli.ts add --title "refactor-scoring" --version v2
```

Cursor Command `/bmad-eval-questions` 内部等价调用上述脚本；验收时可直接运行脚本或通过 Command 触发。

### 6.5 References

- [Source: scoring/eval-questions/MANIFEST_SCHEMA.md]
- [Source: _bmad-output/planning-artifacts/dev/epics.md §Epic 8]
- [Source: prd.eval-ux-last-mile.md §5.5]
- [Source: _bmad-output/implementation-artifacts/epic-8-eval-question-bank/story-8-1-question-bank-structure-manifest/8-1-question-bank-structure-manifest.md]
- [Source: scoring/parsers/__tests__/fixtures/sample-eval-question-report.md]

---

## 7. 禁止词表合规声明

本 Story 文档已避免使用禁止词表所列全部词汇（可选、可考虑、后续、先实现、后续扩展、待定、酌情、视情况、技术债）。所有范围界定均采用明确归属（由 Story 8.1、8.3 负责）。

---

## 8. Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

- Create Story 工作流执行完毕（2026-03-06）：基于现有文档完善，明确 Command 实现方式（Cursor Command + scripts/cli）、manifest-loader 调用约定、验收命令示例；未进入 party-mode（无重大方案歧义，与 epics/PRD/Story 8.1 已对齐）。

### File List
