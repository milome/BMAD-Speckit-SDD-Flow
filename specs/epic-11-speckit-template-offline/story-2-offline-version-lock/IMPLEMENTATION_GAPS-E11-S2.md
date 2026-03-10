# IMPLEMENTATION_GAPS: Story 11.2 离线与版本锁定

**Epic**: 11 - speckit-template-offline  
**Story**: 11.2 - 离线与版本锁定（offline-version-lock）  
**Created**: 2026-03-09  
**Input**: spec-E11-S2.md、plan-E11-S2.md、Story 11-2、packages/bmad-speckit 当前实现

---

## 需求映射清单（GAPS ↔ 需求文档 + plan）

| 需求文档章节 | spec.md 对应 | plan.md 对应 | GAPS 覆盖 |
|-------------|-------------|-------------|----------|
| Story 11-2 本 Story 范围 | spec §Requirements | plan Phase 1–4 | 见下表 |
| spec FR-001–FR-008 | spec §Requirements | plan §1–§4 | 见下表 |
| plan Phase 1–4 | plan §Module Design、§Data Flow、§Integration Test Plan | plan 全文 | 见下表 |

---

## Gaps 清单（按需求文档章节）

| 需求文档章节 | Gap ID | 需求要点 | 当前实现状态 | 缺失/偏差说明 |
|-------------|--------|----------|-------------|---------------|
| Story 11-2 Task 1 | GAP-1.1 | init 与 TemplateFetcher 解析 --offline；当 --offline 为真时仅从 cache 解析，不发起网络 | 未实现 | bin/bmad-speckit.js 无 --offline 选项；init.js 未解析、未传入；template-fetcher.js 无 opts.offline 分支 |
| Story 11-2 Task 1 | GAP-1.2 | --offline 为真且 cache 缺失时输出含「离线」「cache 缺失」的报错并退出码 5 | 未实现 | template-fetcher 无 offline 分支，无 OFFLINE_CACHE_MISSING throw；init 无 catch exit(5) |
| Story 11-2 Task 2 | GAP-2.1 | init 成功完成后将 templateVersion 写入 _bmad-output/config/bmad-speckit.json | 已实现 | init-skeleton writeSelectedAI 已通过 ConfigManager.setAll 写入 selectedAI、templateVersion、initLog；init 调用时传入 tag |
| Story 11-2 Task 2 | GAP-2.2 | 文件或父目录不存在则创建；已有则仅合并 templateVersion | 已实现 | ConfigManager.setAll 内部处理目录创建与合并 |
| Story 11-2 Task 3 | GAP-3.1 | 确保仅「--offline 且 cache 缺失」使用退出码 5 | 未实现 | 无 --offline 路径，退出码 5 未被使用 |
| Story 11-2 Task 3 | GAP-3.2 | 补充单元/集成测试：--offline、cache 存在/缺失、templateVersion、退出码 5、已有配置合并（E2E-4/AC-2.2） | 未实现 | 无 --offline 相关测试 |

---

## 包/文件 Gap 汇总

| 预期变更 | 当前状态 | Gap ID |
|----------|----------|--------|
| template-fetcher.js：opts.offline 分支，cache 检查，cache 缺失 throw OFFLINE_CACHE_MISSING | 无 opts.offline；始终走 fetchFromGitHub/fetchFromUrl | GAP-1.1, 1.2 |
| init.js：解析 --offline、传入 opts.offline、catch OFFLINE_CACHE_MISSING 时 exit(5) | 无 offline 解析与传递；无 exit(5) 路径 | GAP-1.1, 1.2, 3.1 |
| bin/bmad-speckit.js：init 子命令 --offline 选项 | 无 --offline 选项 | GAP-1.1 |
| 单元/集成测试 | 无 offline、exit(5) 相关测试 | GAP-3.2 |

---

## 说明

- **templateVersion 写入**：init-skeleton writeSelectedAI 已实现，init 在非 worktree 路径下调用 writeSelectedAI(finalPath, selectedAI, tag)，tag 为实际使用的版本（latest 或 --template 指定）；无需额外实现。
- **getLocalTemplatePath 与 offline**（plan §1.3）：当 getLocalTemplatePath() 有值时直接返回本地路径，不进入 fetchFromGitHub/fetchFromUrl 也不进入 offline cache 检查；实施时保持该优先顺序即可，无需变更。
- **实施顺序**：先实现 template-fetcher offline 分支（GAP-1.1, 1.2），再实现 init 与 bin 的 --offline 解析及 exit(5)（GAP-1.1, 3.1），最后补充测试（GAP-3.2）。

<!-- AUDIT: PASSED by code-reviewer -->
