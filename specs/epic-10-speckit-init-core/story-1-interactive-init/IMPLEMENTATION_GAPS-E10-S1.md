# IMPLEMENTATION_GAPS: Story 10.1 交互式 init

**Epic**: 10 - speckit-init-core  
**Story**: 10.1 - 交互式 init  
**Created**: 2025-03-08  
**Input**: spec-E10-S1.md、plan-E10-S1.md、Story 10-1、PRD、ARCH

---

## 需求映射清单（GAPS ↔ 需求文档 + plan）

| 需求文档章节 | spec.md 对应 | plan.md 对应 | GAPS 覆盖 |
|-------------|-------------|-------------|----------|
| Story 10-1 本 Story 范围 | spec §Requirements | plan Phase 1–5 | 见下表 |
| PRD §5.2–5.6、§5.10 | spec FR-001–FR-020 | plan §1–§5 | 见下表 |
| ARCH §3.1–3.2 | spec Implementation Constraints | plan §1.1、§1.2 | 见下表 |

---

## Gaps 清单（按需求文档章节）

| 需求文档章节 | Gap ID | 需求要点 | 当前实现状态 | 缺失/偏差说明 |
|-------------|--------|----------|-------------|---------------|
| Story 10-1 T1 | GAP-1.1 | InitCommand 骨架、Commander.js 注册 init 子命令 | 未实现 | 无 bin/bmad-speckit.js、src/commands/init.js |
| Story 10-1 T1 | GAP-1.2 | 解析 [project-name]、`.`、`--here`、`--modules`、`--force`、`--no-git`、`--debug`、`--github-token`、`--skip-tls` | 未实现 | 无参数解析逻辑 |
| Story 10-1 T1 | GAP-1.3 | 目标路径解析：`.`/`--here` → 当前目录 | 未实现 | 无 path.js 或等效 |
| Story 10-1 T1 | GAP-1.4 | 非空目录校验：无 --force 时路径已存在且非空则退出码 4；非空判定（FR-019）：含 _bmad 或 _bmad-output 或含其他文件/子目录 | 未实现 | 无校验逻辑 |
| Story 10-1 T2 | GAP-2.1 | Banner BMAD-Speckit，ASCII/box-drawing，chalk+boxen | 未实现 | 无 Banner 渲染 |
| Story 10-1 T2 | GAP-2.2 | Inquirer.js/prompts AI 选择步骤 | 未实现 | 无交互步骤 |
| Story 10-1 T2 | GAP-2.3 | AI 列表输入过滤、box-drawing 选择器边框 | 未实现 | 无 AI 选择 UI |
| Story 10-1 T2 | GAP-2.4 | 路径确认、模板版本选择交互步骤 | 未实现 | 无交互步骤 |
| Story 10-1 T3 | GAP-3.1 | constants/ai-builtin.js，19+ AI（id、name、description） | 未实现 | 无 ai-builtin.js |
| Story 10-1 T4 | GAP-4.1 | TemplateFetcher 最小实现：GitHub Release 拉取 tarball | 未实现 | 无 template-fetcher.js |
| Story 10-1 T4 | GAP-4.2 | 模板版本选择（latest/指定 tag）与拉取调用 | 未实现 | 无版本选择逻辑 |
| Story 10-1 T4 | GAP-4.3 | --modules 解析：逗号分隔，指定时仅部署所选模块 | 未实现 | 无 --modules 逻辑 |
| Story 10-1 T4 | GAP-4.4 | --github-token、--skip-tls 集成 | 未实现 | 无网络参数传递 |
| plan §3.1 | GAP-4.5 | 模板拉取超时/网络失败 → 退出码 3，明确错误信息（spec Edge Cases、PRD §5.2） | 未实现 | 无 TemplateFetcher 错误处理逻辑 |
| Story 10-1 T5 | GAP-5.1 | 按模板生成 _bmad、_bmad-output 目录结构（PRD §5.10 方案 A，_bmad-output 含 config/） | 未实现 | 无骨架生成逻辑 |
| Story 10-1 T5 | GAP-5.2 | 未传 --no-git 时 git init、创建 .gitignore | 未实现 | 无 git init 逻辑 |
| Story 10-1 T5 | GAP-5.3 | 传 --no-git 时跳过 git init | 未实现 | 无 --no-git 分支 |
| spec Edge Cases、plan Data Model | GAP-5.4 | 所选 AI 写入 _bmad-output/config（如 bmad-speckit.json 的 selectedAI），供后续 sync 与 check 使用 | 未实现 | 无配置写入逻辑 |
| plan §4.3 | GAP-5.5 | --force 时覆盖已存在同名文件，保留无冲突的既有文件 | 未实现 | 无 --force 合并/覆盖逻辑 |
| Story 10-1 T6 | GAP-6.1 | --debug 时输出详细日志 | 未实现 | 无 debug 输出 |
| Story 10-1 T6 | GAP-6.2 | 目标路径不可用时退出码 4，明确提示（含路径已存在且非空、目标路径不可写两种场景） | 未实现 | 依赖 GAP-1.4、GAP-8.1 |
| Story 10-1 T6 | GAP-6.3 | constants/exit-codes.js，定义 0/1/2/3/4/5 | 未实现 | 无 exit-codes.js |
| plan §1.6 | GAP-7.1 | utils/path.js 跨平台路径，被 InitCommand、TemplateFetcher 调用 | 未实现 | 无 path.js |
| plan §1.6 | GAP-7.2 | utils/tty.js 最小 TTY 检测，被 InitCommand 调用 | 未实现 | 无 tty.js |
| plan §5.2、spec Edge Cases | GAP-8.1 | 目标路径不可写校验：无写权限时退出码 4，明确提示（Integration Test E2E-10） | 未实现 | 无可写性校验逻辑 |

---

## 包结构 Gap 汇总

| 预期路径 | 当前状态 | Gap ID |
|----------|----------|--------|
| bin/bmad-speckit.js | 不存在 | GAP-1.1 |
| src/commands/init.js | 不存在 | GAP-1.1, 1.2, 1.3, 1.4, 2.x, 4.x, 5.x, 6.x, 8.1 |
| src/services/template-fetcher.js | 不存在 | GAP-4.1, 4.2, 4.4, 4.5 |
| src/constants/ai-builtin.js | 不存在 | GAP-3.1 |
| src/constants/exit-codes.js | 不存在 | GAP-6.3 |
| src/utils/path.js | 不存在 | GAP-7.1 |
| src/utils/tty.js | 不存在 | GAP-7.2 |

---

## 说明

本 Story 为**首次实施**，bmad-speckit CLI 包尚未创建。当前项目（BMAD-Speckit-SDD-Flow）为规划/规范项目，包含 _bmad 脚本、specs、_bmad-output 等，但不含 bmad-speckit 可执行 CLI。GAPS 反映从零到 plan 所述完整实现的全部差距。

**实施策略**：在项目内创建 `packages/bmad-speckit/` 或等效子包，按 plan 包结构建立目录并逐项实现；或按项目约定将 bmad-speckit 置于独立 repo/worktree。
