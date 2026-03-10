# IMPLEMENTATION_GAPS E13-S2: 异常路径

**Epic**: 13 - Speckit Diagnostic Commands  
**Story**: 13.2 - 异常路径（exception-paths）  
**输入**: plan-E13-S2.md, spec-E13-S2.md, 13-2-exception-paths.md, 当前实现

---

## 1. 概述

本文档对照 plan、spec 与当前 bmad-speckit 实现，逐章节列出实现差距（Gap），供 tasks 拆解与执行。

**当前实现范围**：
- exit-codes.js：已含全部常量 0–5 ✅
- init.js：已使用 exitCodes；resolveNetworkTimeoutMs 实现配置链；--ai 无效已输出 Available + check --list-ai；--bmad-path、目标非空、无写权限已 exit 4
- check.js：结构验证失败 exit 1；bmadPath 失败 exit 4
- TemplateFetcher：超时错误含 TIMEOUT_MESSAGE「网络超时」；使用 opts.networkTimeoutMs、SDD_NETWORK_TIMEOUT_MS、DEFAULT
- init 调用 fetchTemplate 时传入 networkTimeoutMs（来自 resolveNetworkTimeoutMs）✅

---

## 2. Gaps 清单（按需求文档章节）

| 需求文档章节 | Gap ID | 需求要点 | 当前实现状态 | 缺失/偏差说明 |
|-------------|--------|----------|-------------|---------------|
| spec §5.1, §5.2, AC-3#1, AC-3#2 | GAP-1.1 | 退出码 3 场景（超时、404、解压失败）stderr 建议 --offline 或检查网络 | 部分实现 | init catch NETWORK_TEMPLATE 时仅输出 err.message，未追加「建议使用 --offline 或检查网络」；spec §5.2 要求 404/解压失败同上 |
| spec §8.2, AC-6 | GAP-1.2 | TemplateFetcher 独立调用时读取配置链 | 部分实现 | fetchFromGitHub/fetchFromUrl 在 opts.networkTimeoutMs 为空时仅读 SDD_NETWORK_TIMEOUT_MS + 默认，未读项目/全局 ConfigManager；init 已传入故 init 路径正确；upgrade 未实现，未来 upgrade 须传 networkTimeoutMs |
| spec §9.2 | GAP-1.3 | 梳理 init、check、upgrade 所有 process.exit | 部分实现 | init、check 已梳理；upgrade 不存在，本 Story 仅需确认 init/check 无遗漏 |
| spec §7, AC-5 | GAP-1.4 | 错误信息禁止空或占位符 | 待验证 | 需审查各 catch 块确保 stderr 输出非空可识别 |
| plan Phase 2 | GAP-2.1 | process.exit 与退出码约定一致 | 已实现 | init、check 退出码与 spec 一致 |
| plan Phase 4 | GAP-2.2 | --ai 无效输出可用 AI 或 check --list-ai | 已实现 | init 已有 Available、Run check --list-ai |
| plan Phase 5 | GAP-2.3 | 退出码 3 错误信息含「网络超时」及建议 | 部分实现 | TemplateFetcher 含 TIMEOUT_MESSAGE；init catch 未追加 --offline 建议 |
| plan Phase 6 | GAP-2.4 | 退出码 4 各场景 | 已实现 | init、check 已覆盖 |
| plan Phase 8 | GAP-2.5 | 网络超时配置链 | 部分实现 | init 传入；TemplateFetcher 自身未实现配置链，依赖 caller 传入 |

---

## 3. Gaps 分类汇总

| 类别 | Gap ID | 说明 |
|------|--------|------|
| **退出码 3 错误提示** | GAP-1.1, GAP-2.3 | init catch 时追加「建议 --offline 或检查网络」 |
| **TemplateFetcher 配置链** | GAP-1.2, GAP-2.5 | TemplateFetcher 在 opts.networkTimeoutMs 缺失时读取 ConfigManager（或文档约定 upgrade 必须传入） |
| **process.exit 梳理** | GAP-1.3 | 确认 init、check 无遗漏；upgrade 待后续 Story |
| **错误格式审查** | GAP-1.4 | 审查各异常路径 stderr 非空 |
| **已实现** | GAP-2.1, GAP-2.2, GAP-2.4 | 无需修改 |

---

## 4. 与 plan 阶段对应

| plan Phase | 对应 Gap | 说明 |
|-------------|----------|------|
| Phase 1 | 无 | exit-codes.js 已完整 |
| Phase 2 | GAP-1.3 | process.exit 梳理 |
| Phase 3 | 无 | 退出码 1 已正确 |
| Phase 4 | GAP-2.2 | 已实现 |
| Phase 5 | GAP-1.1, GAP-2.3 | init catch 追加 --offline 建议 |
| Phase 6 | GAP-2.4 | 已实现 |
| Phase 7 | GAP-1.4 | 错误格式审查 |
| Phase 8 | GAP-1.2, GAP-2.5 | TemplateFetcher 配置链或文档约定 |

---

## 5. 与 plan §3.3 集成/端到端测试计划对应

| plan §3.3 测试类型 | 对应 Gap | 验收方式 |
|-------------------|----------|----------|
| 退出码 1 | GAP-1.3, GAP-1.4 | 临时目录 fixture，断言 exitCode 1，stderr 含可识别描述 |
| 退出码 2 | GAP-2.2 已实现 | 断言 exitCode 2，stderr 含可用 AI 或 check --list-ai |
| 退出码 3 | GAP-1.1, GAP-2.3 | mock HTTP，断言 exitCode 3，stderr 含「网络超时」或等价表述及 --offline 建议 |
| 退出码 4 | GAP-2.4 已实现 | 临时目录 fixture，断言 exitCode 4，stderr 明确说明 |
| 网络超时配置链 | GAP-1.2, GAP-2.5 | 断言 SDD_NETWORK_TIMEOUT_MS、项目配置、默认 30000 生效 |
| 端到端 | 全部 | init 各异常路径 → 脚本可据 $? 判断 |

---

## 6. 与 13-2-exception-paths Tasks 对应

| 13-2 Task | 对应 Gap | 说明 |
|------------|----------|------|
| Task 1.1 退出码常量 | 无 | exit-codes.js 已完整 |
| Task 1.2 process.exit 梳理 | GAP-1.3 | grep 逐项核验 |
| Task 2.1 --ai 无效输出 | GAP-2.2 已实现 | — |
| Task 2.2 --ai 测试 | — | 需补充 |
| Task 3.1 退出码 3 与建议 | GAP-1.1, GAP-2.3 | init catch 追加 --offline 建议 |
| Task 3.2 网络/拉取失败测试 | — | 需补充 |
| Task 4.1–4.3 退出码 4 | GAP-2.4 已实现 | — |
| Task 5.1 通用错误格式 | GAP-1.4 | 审查 stderr 非空 |
| Task 5.2 错误格式测试 | — | 需补充 |
| Task 6.1 配置链 | GAP-1.2, GAP-2.5 | TemplateFetcher 或 upgrade 约定 |
| Task 6.2 配置链测试 | — | 需补充 |

---

## 7. 实施顺序建议

1. GAP-1.1：init catch 块追加「建议 --offline 或检查网络」
2. GAP-1.2：TemplateFetcher 在 opts.networkTimeoutMs 空时调用 resolveNetworkTimeoutMs 等价逻辑（可抽 util 共用），或 plan 明确 upgrade 须传入
3. GAP-1.3：grep process.exit 逐项核验
4. GAP-1.4：审查各 stderr 输出
5. 补充各退出码场景的单元/集成测试（对应 plan §3.3、13-2 Tasks 2.2/3.2/5.2/6.2）

<!-- AUDIT: PASSED by code-reviewer -->
