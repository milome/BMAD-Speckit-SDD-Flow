# Tasks E13-S2: 异常路径

**Epic**: 13 - Speckit Diagnostic Commands  
**Story**: 13.2 - 异常路径（exception-paths）  
**输入**: IMPLEMENTATION_GAPS-E13-S2.md, plan-E13-S2.md, spec-E13-S2.md, 13-2-exception-paths.md

---

## 1. 本批任务 ↔ 需求追溯

| 任务 ID | 需求文档 | 章节 | 需求要点 |
|---------|----------|------|----------|
| T1 | spec §9.1, Story Task 1.1 | 退出码常量 | exit-codes.js 含 0–5，与 ARCH §3.4 一致 |
| T2 | spec §9.2, GAP-1.3 | process.exit 梳理 | init、check 所有 process.exit 与退出码约定一致 |
| T3 | GAP-1.1, GAP-2.3, spec §5.1/§5.2 | 退出码 3 错误提示 | init catch NETWORK_TEMPLATE 时追加「建议 --offline 或检查网络」 |
| T4 | GAP-1.2, GAP-2.5, spec §8 | 网络超时配置链 | TemplateFetcher opts 空时读取 ConfigManager，或文档约定 upgrade 须传入 |
| T5 | GAP-1.4, spec §7 | 错误格式审查 | 各 catch 块 stderr 非空可识别 |
| T6 | plan §3.3 | 集成/端到端测试 | 退出码 1–4、网络超时、端到端场景 |

---

## 2. Gaps → 任务映射

| 章节 | Gap ID | 对应任务 |
|------|--------|----------|
| spec §9.1 | 无（已实现） | T1 核验 |
| spec §9.2 | GAP-1.3 | T2 |
| spec §5.1, §5.2 | GAP-1.1, GAP-2.3 | T3 |
| spec §8 | GAP-1.2, GAP-2.5 | T4 |
| spec §7 | GAP-1.4 | T5 |
| plan §3.3 | — | T6 |

---

## 3. Agent 执行规则

**禁止事项**：禁止占位、伪实现、跳过 TDD 红灯、标记完成但功能未调用。  
**必须事项**：集成任务修改生产路径、运行验证命令、TDD 红绿灯、实施前检索需求。

---

## 4. 任务列表

### T1: 退出码常量核验（spec §9.1）

- [ ] **T1.1** 确认 exit-codes.js 含 SUCCESS(0)、GENERAL_ERROR(1)、AI_INVALID(2)、NETWORK_TEMPLATE_FAILED(3)、TARGET_PATH_UNAVAILABLE(4)、OFFLINE_CACHE_MISSING(5)
  - **验收**：grep 确认常量存在；若缺失则补充
  - **生产代码**：packages/bmad-speckit/src/constants/exit-codes.js
  - **单元测试**：无新增（仅核验）

### T2: process.exit 梳理（spec §9.2, GAP-1.3）

- [ ] **T2.1** grep 全仓库 process.exit 与 exitCodes.，逐项对照 spec §3–§6
  - **验收**：结构验证失败→1；--ai 无效→2；网络/模板→3；路径不可用→4；无遗漏或错误
  - **生产代码**：init.js、check.js（修正不一致处）
  - **集成测试**：各异常路径执行断言 exitCode

### T3: 退出码 3 错误提示（GAP-1.1, spec §5.1/§5.2）

- [ ] **T3.1** init catch 块：当 err.code === 'NETWORK_TEMPLATE' 或 message 含网络/模板相关词（超时、404、解压失败）时，输出 err.message 后追加「建议使用 --offline 或检查网络」到 stderr
  - **验收**：init 网络超时、404、解压失败时 stderr 含可识别描述 + 上述建议
  - **生产代码**：packages/bmad-speckit/src/commands/init.js
  - **单元/集成测试**：mock fetchTemplate 抛 NETWORK_TEMPLATE 或 404/解压失败，断言 stderr 含建议

### T4: 网络超时配置链（GAP-1.2, spec §8）

- [ ] **T4.1** TemplateFetcher fetchFromGitHub、fetchFromUrl：当 opts.networkTimeoutMs 为空时，调用 resolveNetworkTimeoutMs 等价逻辑（读取 ConfigManager 项目/全局 + SDD_NETWORK_TIMEOUT_MS + 默认 30000）
  - **验收**：无 opts 传入时 TemplateFetcher 使用配置链；或 plan/Dev Notes 明确 upgrade 须传入 networkTimeoutMs；**集成验证**：init 或 upgrade 调用 TemplateFetcher 时使用正确超时值（由 T6.5 覆盖）
  - **生产代码**：template-fetcher.js 或抽出 shared util（如 resolveNetworkTimeoutMs）
  - **单元测试**：断言 SDD_NETWORK_TIMEOUT_MS、项目配置、默认值生效

### T5: 错误格式审查（GAP-1.4, spec §7）

- [ ] **T5.1** 审查 init、check 各 catch 块与异常路径：stderr 输出非空、含可识别问题描述
  - **验收**：无空串或纯「Error:」无后续；各退出码场景有明确描述
  - **生产代码**：init.js、check.js
  - **集成测试**：各异常路径断言 stderr 非空且可识别

### T6: 集成/端到端测试（plan §3.3）

- [ ] **T6.1** 补充退出码 1：check 结构验证失败、init 未预期异常；断言 exitCode 1，stderr 含可识别描述
  - **验收**：临时目录 fixture；CLI 执行；断言 exitCode、stderr
  - **生产代码**：tests/
  - **测试**：集成测试

- [ ] **T6.2** 补充退出码 2：--ai 无效；断言 exitCode 2，stderr 含 Available 或 check --list-ai
  - **验收**：init --ai invalid-name；--ai generic 无 aiCommandsDir；断言 exitCode 2，stderr 含可用 AI 或 check --list-ai
  - **生产代码**：tests/
  - **测试**：集成测试

- [ ] **T6.3** 补充退出码 3：网络超时、404；mock HTTP；断言 exitCode 3，stderr 含「网络超时」或等价表述及 --offline 建议
  - **验收**：mock fetchTemplate 或 HTTP；init 触发；断言
  - **生产代码**：tests/
  - **测试**：集成测试

- [ ] **T6.4** 补充退出码 4：--bmad-path 不存在、目标已存在非空、无写权限；断言 exitCode 4
  - **验收**：临时目录 fixture；init 各场景；断言
  - **生产代码**：tests/
  - **测试**：集成测试

- [ ] **T6.5** 补充网络超时配置链测试：SDD_NETWORK_TIMEOUT_MS、项目配置、默认 30000
  - **验收**：TemplateFetcher 或 init 使用正确超时值；断言项目级 networkTimeoutMs（bmad-speckit.json）、默认 30000 生效
  - **生产代码**：tests/
  - **测试**：单元/集成测试

<!-- AUDIT: PASSED by code-reviewer -->
