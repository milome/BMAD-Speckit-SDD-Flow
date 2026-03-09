# plan-E11-S2.md 审计报告

**被审文档**：`specs/epic-11-speckit-template-offline/story-2-offline-version-lock/plan-E11-S2.md`  
**原始需求**：Story 11-2、spec-E11-S2.md  
**审计日期**：2026-03-09  
**审计依据**：audit-prompts.md §2 plan.md 审计提示词、audit-prompts-critical-auditor-appendix.md

---

## 模型选择信息

| 项目 | 值 |
|------|-----|
| 配置来源 | .claude/agents/code-reviewer.md |
| 指定模型 | inherit（来自 frontmatter，继承主 Agent 模型） |
| 选择依据 | 子代理 YAML 中 model: inherit；可改为 fast 以节省审计成本（若环境支持） |

---

## §1 逐条检查与验证

### 1.1 Story 11-2 本 Story 范围覆盖

| 需求点 | plan 对应位置 | 验证方式 | 结果 |
|--------|---------------|----------|------|
| --offline 仅用本地 cache、不发起网络 | Phase 1 §1.1、§1.2 | 对照 §1.1 opts.offline 分支、禁止 HTTP | ✅ |
| templateVersion 写入 bmad-speckit.json | Phase 1 §1.2、Phase 2 step 7 | 对照 writeSelectedAI、init-skeleton | ✅ |
| 退出码 5 离线 cache 缺失 | Phase 1 §1.2、Phase 3 E2E-2 | 对照 catch OFFLINE_CACHE_MISSING、exit(5) | ✅ |

### 1.2 Story 11-2 AC 覆盖

| AC/Scenario | plan 对应 | 验证方式 | 结果 |
|-------------|-----------|----------|------|
| AC-1.1 离线且 cache 存在 | Phase 3 E2E-1 | 对照不发起网络、从 cache 完成 init | ✅ |
| AC-1.2 离线且 cache 缺失 | Phase 3 E2E-2 | 对照退出码 5、报错含「离线」「cache 缺失」 | ✅ |
| AC-1.3 未传 --offline | Phase 3 E2E-3 | 对照行为与 11.1 一致、退出码 3 | ✅ |
| AC-2.1 首次 init 成功 | Phase 3 E2E-1、INT-3 | 对照 templateVersion 写入、目录创建 | ✅ |
| AC-2.2 已有配置合并 | Phase 3 E2E-4（审计中补充） | 对照仅更新 templateVersion、不覆盖其他字段 | ✅ |
| AC-2.3 版本可识别 | Phase 1 §1.2 tag/latest | 对照 tag 或 latest 可识别标识 | ✅ |
| AC-3.1 退出码 5 仅用于离线 cache 缺失 | Phase 3 E2E-2、UNIT-2 | 对照场景与 exit(5) | ✅ |
| AC-3.2 非离线不用 5 | Phase 3 E2E-3 | 对照网络失败用 3 | ✅ |

### 1.3 spec-E11-S2.md 功能需求覆盖

| FR | 需求要点 | plan 对应 | 结果 |
|----|----------|-----------|------|
| FR-001 | --offline 解析、仅 cache | Phase 1 §1.1、§1.2 | ✅ |
| FR-002 | cache 存在返回、缺失报错退出码 5 | Phase 1 §1.1 | ✅ |
| FR-003 | 退出码 5、报错含「离线」「cache 缺失」 | Phase 1 §1.2、Phase 3 | ✅ |
| FR-004 | 未传 --offline 保持 11.1 行为 | Phase 3 E2E-3 | ✅ |
| FR-005 | templateVersion 写入 | Phase 1 §1.2、Phase 2 | ✅ |
| FR-006 | 目录不存在则创建、已存在则合并更新 | Phase 3 E2E-4、init-skeleton 已用 ConfigManager.setAll 合并 | ✅ |
| FR-007 | path、fs、os.homedir | Phase 0 Tech Stack | ✅ |
| FR-008 | 单元/集成测试 | Phase 3、Phase 4 | ✅ |

### 1.4 spec Success Criteria 覆盖

| SC | plan 对应 | 结果 |
|----|-----------|------|
| SC-001 | E2E-1、INT-1 | ✅ |
| SC-002 | E2E-2、UNIT-2 | ✅ |
| SC-003 | E2E-1、E2E-4、INT-3 | ✅ |
| SC-004 | E2E-3 | ✅ |

### 1.5 spec Key Entities、Implementation Constraints 覆盖

| 实体/约束 | plan 对应 | 结果 |
|-----------|-----------|------|
| TemplateFetcher opts.offline 分支 | Phase 1 §1.1 | ✅ |
| init.js 解析 --offline、catch exit(5) | Phase 1 §1.2 | ✅ |
| Cache 结构 ~/.bmad-speckit/templates/ | Phase 0、§1.1 | ✅ |
| 退出码 5 / 3 | Phase 0、Phase 1 | ✅ |
| 依赖 11.1、路径 Node.js | Phase 0、§1.3 | ✅ |

### 1.6 集成测试与端到端测试专项审查

| 审查项 | 验证方式 | 结果 |
|--------|----------|------|
| plan 是否包含完整集成测试计划 | 逐条对照 Phase 3 | ✅ Phase 3 现含 INT-1～INT-4（审计中补充） |
| plan 是否包含端到端功能测试计划 | 逐条对照 Phase 3 | ✅ E2E-1～E2E-4 覆盖用户可见流程 |
| 是否仅依赖单元测试 | 检查 Phase 3 结构 | ✅ 含 E2E、集成、单元三层 |
| 模块间协作、生产代码关键路径 | Phase 3 INT-1～INT-4 | ✅ init→fetchTemplate→generateSkeleton→writeSelectedAI |
| 孤岛模块风险 | 检查 Phase 1、2 | ✅ Data Flow 明确 init 调用 fetchTemplate；§1.3 明确 getLocalTemplatePath 优先 |

### 1.7 审计中已对 plan 的修改（消除 gap）

1. **Phase 2 Data Flow**：补充 runNonInteractiveFlow/runInteractiveFlow 均传 offline，以及 bin 解析到 init 的链条。
2. **Phase 3 Integration Test Plan**：
   - 新增 **E2E-4**：AC-2.2 已有配置合并场景，验证仅 templateVersion 更新、其他字段保留。
   - 新增 **INT-1～INT-4**：集成测试用例（TemplateFetcher 不发起网络、OFFLINE_CACHE_MISSING catch、writeSelectedAI 调用链、bin→init CLI 路径）。
3. **Phase 4 测试策略**：与 Phase 3 结构对齐，明确集成与 E2E 覆盖范围。

---

## §2 批判审计员结论

**已检查维度**：遗漏需求点、边界未定义、验收不可执行、与前置文档矛盾、孤岛模块、伪实现、验收一致性、集成/E2E 测试完整性、行号/路径漂移。

**每维度结论**：

- **遗漏需求点**：审计前 plan 未显式覆盖以下内容：① AC-2.2（已有配置合并）的 E2E/集成测试；② runInteractiveFlow 的 offline 传递（Phase 2 仅描述非交互）；③ bin→init 的 CLI 集成验证。逐条对照 Story 11-2 AC-2.2 与 spec FR-006 后，确认「若文件已存在则合并更新」的验证用例缺失。已通过直接修改 plan 补充 E2E-4、INT-1～INT-4 及 Phase 2 step 2-3 消除。
- **边界未定义**：边界条件已在 plan 中明确：offline 为真时仅 cache 检查、禁止 HTTP；offline 为假时保持 11.1 行为；getLocalTemplatePath 有值时 local 优先、不进入 offline 分支。Phase 1 §1.3 与现有 template-fetcher.js getLocalTemplatePath 实现一致。无边界未定义 gap。
- **验收不可执行**：Phase 3 各测试用例具备可执行性：E2E 可预先拉取 cache 或 mock 目录、集成可 mock TemplateFetcher 或网络层、单元可 mock fs。验收命令可具体化为 `node bin/bmad-speckit.js init ... --offline` 及断言退出码、stderr、bmad-speckit.json 内容。无不可执行 gap。
- **与前置文档矛盾**：plan 需求映射清单、Phase 1-4 与 Story 11-2、spec-E11-S2 逐条对照无矛盾。非本 Story 范围（11.1、13.2、13.4）的划分与 Story 文档一致。
- **孤岛模块**：TemplateFetcher opts.offline 分支由 init 调用；init 由 bin 触发；writeSelectedAI 由 init 在成功路径调用。Data Flow 与 INT-1～INT-4 明确验证 init→fetchTemplate→generateSkeleton→writeSelectedAI 链条。不存在「模块内部完整但未被生产代码关键路径导入」的孤岛风险。
- **伪实现**：plan 为设计文档，不涉及实现细节占位。Phase 1 模块设计、Phase 2 数据流、Phase 3 测试计划均为可实施规格。无伪实现 gap。
- **验收一致性**：Phase 3 E2E/INT/UNIT 与 Phase 4 测试策略一一对应；需求映射清单中「覆盖状态」与各 Phase 内容一致。可验证。
- **集成/E2E 测试完整性**：审计前 Phase 3 的「集成」仅有一句「init --offline 完整流程；templateVersion 写入验证」，未覆盖：① TemplateFetcher 在 offline 下不发起网络；② OFFLINE_CACHE_MISSING catch 与 exit(5)；③ writeSelectedAI 在生产路径的调用；④ bin 到 init 的 CLI 路径。已补充 INT-1～INT-4 及 E2E-4（AC-2.2），满足 audit-prompts §2 要求的「覆盖模块间协作、生产代码关键路径、用户可见功能流程」。
- **行号/路径漂移**：plan 引用的路径（template-fetcher.js、init.js、bin/bmad-speckit.js、exit-codes.js、init-skeleton.js）与当前代码库 grep 结果一致；Reference 章节路径有效。无漂移。

**本轮结论**：审计中发现 gap 并已在本轮内直接修改被审文档 plan-E11-S2.md 消除。修改后，**本轮无新 gap**。第 1 轮；建议累计至连续 3 轮无 gap 后收敛（若采用 strict 模式）。

---

## §3 结论

**完全覆盖、验证通过。**

审计过程中发现并已修复的 gap：
- Phase 2 补充 runInteractiveFlow 与 bin 解析链条；
- Phase 3 补充 E2E-4（AC-2.2 已有配置合并）、INT-1～INT-4（集成测试）；
- Phase 4 测试策略与 Phase 3 对齐。

修改后 plan-E11-S2.md 已完全覆盖 Story 11-2 与 spec-E11-S2.md 所有章节，且包含完整的集成测试与端到端功能测试计划，不存在仅依赖单元测试或孤岛模块风险。

**报告保存路径**：`d:\Dev\BMAD-Speckit-SDD-Flow\specs\epic-11-speckit-template-offline\story-2-offline-version-lock\AUDIT_plan-E11-S2.md`  
**iteration_count**：1（首轮发现 gap 并修改，修改后通过）

---

## 可解析评分块（供 parseAndWriteScore）

总体评级: A

维度评分:
- 需求完整性: 95/100
- 可测试性: 94/100
- 一致性: 92/100
- 可追溯性: 93/100
