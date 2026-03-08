# Tasks: Story 10.1 交互式 init

**Epic**: 10 - speckit-init-core  
**Story**: 10.1 - 交互式 init  
**Input**: spec-E10-S1.md、plan-E10-S1.md、IMPLEMENTATION_GAPS-E10-S1.md  
**Prerequisites**: spec、plan、GAPS 均已通过审计

---

## 本批任务 ↔ 需求追溯

| 任务 ID | 需求文档 | 章节 | 需求要点 |
|---------|----------|------|----------|
| T001–T007 | Story 10-1、spec、plan | T1、GAP-1.x、GAP-7.x、GAP-8.1 | InitCommand 骨架、参数解析、路径、非空校验、path/tty utils |
| T008–T012 | Story 10-1、spec、plan | T2、GAP-2.x | Banner、AI 选择、路径确认、模板版本交互 |
| T013–T014 | Story 10-1、spec、plan | T3、GAP-3.1 | ai-builtin.js 19+ AI |
| T015–T020 | Story 10-1、spec、plan | T4、GAP-4.x | TemplateFetcher、版本选择、--modules、网络参数 |
| T021–T026 | Story 10-1、spec、plan | T5、GAP-5.x | 骨架生成、git init、selectedAI 写入、--force |
| T027–T029 | Story 10-1、spec、plan、plan §Integration | T6、GAP-6.x、Integration Test Plan | --debug、错误处理、exit-codes.js；E2E-1 至 E2E-10、生产代码关键路径验证 |

---

## Gaps → 任务映射（按需求文档章节）

| 章节 | Gap ID | 本任务表行 | 对应任务 |
|------|--------|------------|----------|
| T1 | GAP-1.1 | ✓ 有 | T001, T002, T006 |
| T1 | GAP-1.2 | ✓ 有 | T007 |
| T1 | GAP-1.3 | ✓ 有 | T008 |
| T1 | GAP-1.4 | ✓ 有 | T009 |
| T1 | GAP-7.1, 7.2 | ✓ 有 | T004, T005 |
| T1 | GAP-8.1 | ✓ 有 | T010 |
| T2 | GAP-2.1 | ✓ 有 | T012 |
| T2 | GAP-2.2, 2.3 | ✓ 有 | T013 |
| T2 | GAP-2.4 | ✓ 有 | T014 |
| T3 | GAP-3.1 | ✓ 有 | T011 |
| T4 | GAP-4.1–4.5 | ✓ 有 | T015–T019 |
| T5 | GAP-5.1–5.5 | ✓ 有 | T020–T024 |
| T6 | GAP-6.1–6.3 | ✓ 有 | T003, T025, T026 |
| Integration | plan §Integration | ✓ 有 | T027–T029 |

---

## Phase 1: Setup（包结构与 utils）

**Purpose**: 创建 bmad-speckit 包结构、utils、constants

- [x] **T001** [P] 创建 packages/bmad-speckit 目录结构（bin/、src/commands/、src/services/、src/constants/、src/utils/）
- [x] **T002** [P] 创建 package.json，配置 bin、依赖（commander、inquirer、chalk、boxen、ora）
- [x] **T003** [P] 创建 src/constants/exit-codes.js，定义 0/1/2/3/4/5（GAP-6.3）
- [x] **T004** [P] 创建 src/utils/path.js，封装 path.resolve/join，供 init、template-fetcher 调用（GAP-7.1）
- [x] **T005** [P] 创建 src/utils/tty.js，封装 process.stdout.isTTY（GAP-7.2）
- [x] **T006** 创建 bin/bmad-speckit.js 入口，使用 Commander.js 注册 init 子命令（GAP-1.1）

**Checkpoint**: 包结构就绪，可运行 `node bin/bmad-speckit.js init --help`；path.js、tty.js、exit-codes 的集成验证由 Phase 8 T029（grep 调用链）覆盖

---

## Phase 2: InitCommand 骨架与参数解析

**Purpose**: 实现 init 子命令参数解析、路径解析、非空校验

- [x] **T007** 在 src/commands/init.js 解析 [project-name]、`.`、`--here`、`--modules`、`--force`、`--no-git`、`--debug`、`--github-token`、`--skip-tls`（GAP-1.2）
- [x] **T008** 实现目标路径解析：`.`/`--here` → process.cwd()；[project-name] → path.resolve(cwd, name)（GAP-1.3）
- [x] **T009** 实现非空目录校验：无 --force 且路径已存在且非空 → process.exit(4)；非空判定（FR-019）（GAP-1.4）
- [x] **T010** 实现目标路径不可写校验：无写权限 → process.exit(4)（GAP-8.1）

**验收命令**: `node bin/bmad-speckit.js init .` 在非空目录无 --force 时退出码 4

---

## Phase 3: ai-builtin 与 Banner

**Purpose**: 19+ AI 列表、Banner 渲染

- [x] **T011** [P] 创建 src/constants/ai-builtin.js，19+ AI（id、name、description）（GAP-3.1）
- [x] **T012** 使用 chalk + boxen 实现 Banner「BMAD-Speckit」，ASCII/box-drawing 风格，含 CLI 名称与版本号（GAP-2.1）

**验收命令**: 运行 init 进入交互时显示 Banner

---

## Phase 4: 交互步骤（AI 选择、路径确认、模板版本）

**Purpose**: Inquirer.js 实现交互流程

- [x] **T013** 使用 Inquirer.js 实现 AI 选择步骤，从 ai-builtin 加载，支持输入过滤（GAP-2.2, 2.3）
- [x] **T014** 实现路径确认、模板版本选择交互步骤（GAP-2.4）

**验收命令**: 运行 init 可完成 AI 选择、路径确认、模板版本选择

---

## Phase 5: TemplateFetcher

**Purpose**: 模板拉取最小实现

- [x] **T015** 创建 src/services/template-fetcher.js，从 GitHub Release 拉取 tarball（GAP-4.1）
- [x] **T016** 实现模板版本选择（latest/指定 tag）与拉取调用（GAP-4.2）
- [x] **T017** 集成 --github-token（参数优先，否则 GH_TOKEN/GITHUB_TOKEN）、--skip-tls（GAP-4.4）
- [x] **T018** 模板拉取超时/网络失败 → 退出码 3，明确错误信息（GAP-4.5）

**验收命令**: mock 网络失败时退出码 3

---

## Phase 6: --modules 与骨架生成

**Purpose**: --modules 解析、目录生成、git init

- [x] **T019** 实现 --modules 解析：逗号分隔，未指定时完整模板；指定时仅部署所选模块（GAP-4.3）
- [x] **T020** 按模板生成 _bmad、_bmad-output 目录结构（PRD §5.10 方案 A）（GAP-5.1）
- [x] **T021** --force 时覆盖已存在同名文件，保留无冲突既有文件（GAP-5.5）
- [x] **T022** 未传 --no-git 时执行 git init，创建 .gitignore（GAP-5.2）
- [x] **T023** 传 --no-git 时跳过 git init（GAP-5.3）
- [x] **T024** 所选 AI 写入 _bmad-output/config/bmad-speckit.json 的 selectedAI（GAP-5.4）

**验收命令**: `init test-dir` 完成交互后目标目录含 _bmad、_bmad-output、bmad-speckit.json

---

## Phase 7: --debug 与错误处理

**Purpose**: 调试输出、错误码

- [x] **T025** --debug 时输出详细日志（GAP-6.1）
- [x] **T026** 目标路径不可用时退出码 4，明确提示（路径已存在且非空、目标路径不可写）（GAP-6.2）

**验收命令**: 非空目录无 --force 时退出码 4；无写权限目录退出码 4

---

## Phase 8: 集成与 E2E 测试

**Purpose**: 验证生产代码关键路径、E2E 用例

- [x] **T027** 编写 E2E-1 至 E2E-6：init 完整流程、路径解析、--modules、非空退出码 4、--no-git
- [x] **T028** 编写 E2E-7 至 E2E-10：--force 覆盖、token/skip-tls、模板失败、目标路径不可写
- [x] **T029** 验证生产代码关键路径：grep bin 导入 init、init 导入 template-fetcher/ai-builtin/path/tty

**验收命令**: 全部 E2E 用例通过；grep 验证无孤岛模块

---

## 按需求文档章节（GAP-x.y）验收表

| Gap ID | 对应任务 | 生产代码实现要点 | 集成测试要求 | 执行情况 | 验证通过 |
|--------|----------|------------------|--------------|----------|----------|
| GAP-1.1 | T001, T002, T006 | bin/bmad-speckit.js、init 子命令注册 | E2E-1 | [ ] 待执行 | [ ] |
| GAP-1.2 | T007 | init.js 参数解析 | E2E-2, E2E-3 | [ ] 待执行 | [ ] |
| GAP-1.3 | T008 | path.js、init 路径解析 | E2E-2, E2E-3 | [ ] 待执行 | [ ] |
| GAP-1.4 | T009 | init 非空校验 | E2E-5 | [ ] 待执行 | [ ] |
| GAP-2.1 | T012 | chalk+boxen Banner | E2E-1 | [ ] 待执行 | [ ] |
| GAP-2.2, 2.3 | T013 | Inquirer AI 选择 | E2E-1 | [ ] 待执行 | [ ] |
| GAP-2.4 | T014 | 路径确认、模板版本 | E2E-1 | [ ] 待执行 | [ ] |
| GAP-3.1 | T011 | ai-builtin.js | grep init 导入 ai-builtin | [ ] 待执行 | [ ] |
| GAP-4.1–4.5 | T015–T019 | template-fetcher.js、--modules | E2E-4, E2E-8, E2E-9 | [ ] 待执行 | [ ] |
| GAP-5.1–5.5 | T020–T024 | 骨架生成、git、selectedAI、--force | E2E-1, E2E-6, E2E-7 | [ ] 待执行 | [ ] |
| GAP-6.1–6.3 | T025, T026, T003 | --debug、错误码、exit-codes | E2E-5, E2E-10 | [ ] 待执行 | [ ] |
| GAP-7.1, 7.2 | T004, T005 | path.js、tty.js | grep 调用链 | [ ] 待执行 | [ ] |
| GAP-8.1 | T010 | 可写性校验 | E2E-10 | [ ] 待执行 | [ ] |

---

## Dependencies & Execution Order

- Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 6 → Phase 7 → Phase 8
- T001–T006 可并行（标记 [P] 的）
- T011 可与其他 Phase 3 任务并行

---

## Reference Documents

- [spec-E10-S1](./spec-E10-S1.md)
- [plan-E10-S1](./plan-E10-S1.md)
- [IMPLEMENTATION_GAPS-E10-S1](./IMPLEMENTATION_GAPS-E10-S1.md)
- [Story 10-1](../../../_bmad-output/implementation-artifacts/epic-10-speckit-init-core/story-10-1-interactive-init/10-1-interactive-init.md)
