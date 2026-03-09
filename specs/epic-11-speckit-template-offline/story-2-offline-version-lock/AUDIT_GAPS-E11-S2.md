# IMPLEMENTATION_GAPS 审计报告：Story 11.2 离线与版本锁定

**被审文档**：specs/epic-11-speckit-template-offline/story-2-offline-version-lock/IMPLEMENTATION_GAPS-E11-S2.md  
**审计日期**：2026-03-09  
**审计依据**：audit-prompts §3、audit-prompts-critical-auditor-appendix.md、§4.1 可解析评分块  
**需求依据**：11-2-offline-version-lock.md、spec-E11-S2.md、plan-E11-S2.md

---

## 模型选择信息

| 项目 | 值 |
|------|-----|
| 配置来源 | .claude/agents/code-reviewer.md |
| 指定模型 | inherit（来自 frontmatter，继承主 Agent 模型） |
| 选择依据 | 子代理 YAML 中 model: inherit；可改为 fast 以节省审计成本（若环境支持） |

---

## 1. 逐条对照验证

### 1.1 Story 11-2 (11-2-offline-version-lock.md)

#### 1.1.1 Story 陈述与需求追溯

| 需求要点 | 验证方式 | GAP 覆盖 | 验证结果 |
|----------|----------|----------|----------|
| As a 独立开发者/CI 工程师，--offline 仅用 cache、templateVersion 写入、退出码 5 离线 cache 缺失 | 对照 Story 陈述 | GAP-1.1、1.2、2.1、2.2、3.1、3.2 | ✅ |
| PRD §5.4、ARCH §3.2/§4.3、Epics 11.2/13.2 追溯 | 对照需求追溯表 | 需求映射清单已列「Story 11-2 本 Story 范围」 | ✅ |

#### 1.1.2 本 Story 范围（3 条）

| 需求要点 | 验证方式 | GAP 覆盖 | 验证结果 |
|----------|----------|----------|----------|
| --offline 仅用 ~/.bmad-speckit/templates/，不发起网络；cache 缺失时报错含「离线」「cache 缺失」、退出码 5 | 对照本 Story 范围 | GAP-1.1、1.2 | ✅ |
| templateVersion 写入 _bmad-output/config/bmad-speckit.json；不存在则创建；已存在则合并 | 对照本 Story 范围 | GAP-2.1、2.2 | ✅ |
| 退出码 5 仅用于 --offline 且 cache 缺失；报错含「离线」与「cache 缺失」 | 对照本 Story 范围 | GAP-3.1 | ✅ |

#### 1.1.3 非本 Story 范围

| 说明 | 验证结果 |
|------|----------|
| 11.1：模板拉取、cache 写入、--template、网络超时 | GAPS 不覆盖，符合边界 ✅ |
| 13.2：退出码 1/2/3/4 | GAPS 仅约定退出码 5，符合 ✅ |
| 13.4：ConfigCommand get/set/list | GAPS 仅负责 init 写入，符合 ✅ |

#### 1.1.4 AC-1：--offline 仅使用本地 cache、不发起网络

| Scenario | Given / When / Then | GAP 覆盖 | 验证结果 |
|----------|---------------------|----------|----------|
| 1 离线且 cache 存在 | 已拉取至 cache、传 --offline | 不发起网络、从 cache 完成 init | GAP-1.1 | ✅ |
| 2 离线且 cache 缺失 | 传 --offline、cache 中不存在 | 报错含「离线」「cache 缺失」、退出码 5 | GAP-1.2 | ✅ |
| 3 未传 --offline | 与 11.1 一致 | 可发起网络拉取 | GAP-1.1、FR-004 | ✅ |

#### 1.1.5 AC-2：templateVersion 写入

| Scenario | Given / When / Then | GAP 覆盖 | 验证结果 |
|----------|---------------------|----------|----------|
| 1 首次 init 成功 | 无 _bmad-output/config/ 或无 bmad-speckit.json | 创建目录/文件、写入 templateVersion | GAP-2.1、2.2 | ✅ |
| 2 已有配置合并 | 已有 bmad-speckit.json 含 defaultAI 等 | 仅更新 templateVersion，不覆盖其他字段 | GAP-2.2、3.2（E2E-4） | ✅ |
| 3 版本可识别 | tag 或 latest | 写入可识别标识 | GAP-2.1 | ✅ |

#### 1.1.6 AC-3：退出码 5 与报错提示

| Scenario | Given / When / Then | GAP 覆盖 | 验证结果 |
|----------|---------------------|----------|----------|
| 1 仅用于离线 cache 缺失 | --offline、cache 不存在 | 退出码 5、报错含「离线」「cache 缺失」 | GAP-3.1 | ✅ |
| 2 非离线不用 5 | 未传 --offline、网络失败 | 使用 3 等，不用 5 | GAP-3.1 | ✅ |

#### 1.1.7 Tasks T1～T3 及子项

| Task | 子项 | 需求要点 | GAP 覆盖 | 验证结果 |
|------|------|----------|----------|----------|
| T1 | 1.1 | init 与 TemplateFetcher 解析 --offline；offline 为真时仅从 cache、不发起 HTTP(S) | GAP-1.1 | ✅ |
| T1 | 1.2 | offline 为真且 cache 不存在时，报错含「离线」「cache 缺失」、退出码 5 | GAP-1.2 | ✅ |
| T2 | 2.1 | init 成功后将 templateVersion 写入 bmad-speckit.json | GAP-2.1 | ✅ |
| T2 | 2.2 | 文件或父目录不存在则创建；已存在则合并，仅更新 templateVersion | GAP-2.2 | ✅ |
| T3 | 3.1 | 仅「--offline 且 cache 缺失」使用退出码 5 | GAP-3.1 | ✅ |
| T3 | 3.2 | 补充单元/集成测试：--offline、cache 存在/缺失、templateVersion、退出码 5 | GAP-3.2 | ✅ |

#### 1.1.8 Dev Notes

| 章节 | 需求要点 | GAP 覆盖 | 验证结果 |
|------|----------|----------|----------|
| 依赖 | Story 11.1 TemplateFetcher、cache 结构 | GAP 包/文件汇总、说明 | ✅ |
| 配置路径 | _bmad-output/config/bmad-speckit.json | GAP-2.2 已实现 | ✅ |
| 禁止词 | 不得使用模糊表述 | 说明与 GAP 表述明确 | ✅ |
| Project Structure Notes | 新增逻辑限于 --offline、cache 校验、退出码 5、templateVersion 写盘 | GAP 清单覆盖 | ✅ |
| Previous Story Intelligence | TemplateFetcher 位置、Cache 结构、跨平台 path/fs/os.homedir | GAP 与 plan 一致 | ✅ |

---

### 1.2 spec-E11-S2.md

#### 1.2.1 §需求映射清单

| 原始文档 | spec 对应 | 覆盖状态 | 验证结果 |
|----------|-----------|----------|----------|
| Story 11-2 本 Story 范围 | §User Scenarios、§Requirements | GAP-1.1～3.2 | ✅ |
| PRD §5.4、ARCH §3.2/§4.3、Epics 11.2/13.2 | spec 各节 | 通过 GAP 映射 | ✅ |

#### 1.2.2 §User Scenarios 1–3

| User Story | 要点 | GAP 覆盖 | 验证结果 |
|------------|------|----------|----------|
| 1 | --offline 仅用 cache、不发起网络；cache 缺失退出码 5 | GAP-1.1、1.2 | ✅ |
| 2 | templateVersion 写入；首次创建/已有合并；版本可识别 | GAP-2.1、2.2 | ✅ |
| 3 | 退出码 5 仅用于 --offline 且 cache 缺失；报错含「离线」「cache 缺失」 | GAP-3.1 | ✅ |

#### 1.2.3 §Requirements FR-001～FR-008

| FR | 要点 | GAP 覆盖 | 验证结果 |
|----|------|----------|----------|
| FR-001 | init 与 TemplateFetcher 解析 --offline；offline 为真时仅从 cache | GAP-1.1 | ✅ |
| FR-002 | offline 为真时检查 cache；不存在则报错退出 5 | GAP-1.1、1.2 | ✅ |
| FR-003 | 离线 cache 缺失用退出码 5；报错含「离线」「cache 缺失」 | GAP-1.2、3.1 | ✅ |
| FR-004 | 未传 --offline 保持 11.1；网络失败用 3 不用 5 | GAP-3.1 | ✅ |
| FR-005 | init 成功写入 templateVersion | GAP-2.1 | ✅ |
| FR-006 | 目录/文件不存在则创建；已存在则合并仅更新 templateVersion | GAP-2.2 | ✅ |
| FR-007 | Node.js path、fs、os.homedir()；禁止硬编码；配置路径约定 | 实现约束，ConfigManager 已满足；GAP 说明与 plan 一致 | ✅ |
| FR-008 | 补充单元/集成测试 | GAP-3.2 | ✅ |

#### 1.2.4 §Key Entities

| 实体 | 要点 | GAP 覆盖 | 验证结果 |
|------|------|----------|----------|
| TemplateFetcher | opts.offline 分支；cache 缺失 throw OFFLINE_CACHE_MISSING | GAP-1.1、1.2 | ✅ |
| init.js | 解析 --offline、传入 TemplateFetcher、catch 时 exit(5)、writeSelectedAI(tag) | GAP-1.1、2.1 | ✅ |
| Cache 结构 | 复用 11.1 | 说明与包汇总 | ✅ |
| 退出码 | 5=离线 cache 缺失 | GAP-3.1 | ✅ |

#### 1.2.5 §Success Criteria SC-001～SC-004

| SC | 要点 | GAP 覆盖 | 验证结果 |
|----|------|----------|----------|
| SC-001 | init --offline 且 cache 存在 → 不发起网络 | GAP-1.1 | ✅ |
| SC-002 | init --offline 且 cache 缺失 → 退出码 5、报错含「离线」「cache 缺失」 | GAP-1.2 | ✅ |
| SC-003 | init 成功后 bmad-speckit.json 含 templateVersion；已有则合并 | GAP-2.1、2.2 | ✅ |
| SC-004 | 未传 --offline 行为与 11.1 一致，不用 5 | GAP-3.1 | ✅ |

#### 1.2.6 §Implementation Constraints

| 约束 | 验证结果 |
|------|----------|
| 依赖 Story 11.1 | 说明与 GAP 一致 ✅ |
| 路径 path、os.homedir() | 包汇总、ConfigManager 已实现 ✅ |
| 禁止词 | GAP 无模糊表述 ✅ |

---

### 1.3 plan-E11-S2.md

#### 1.3.1 Phase 0：Technical Context

| 需求要点 | GAP 覆盖 | 验证结果 |
|----------|----------|----------|
| 现有实现（template-fetcher、init、init-skeleton、exit-codes） | 包/文件 Gap 汇总、说明 | ✅ |
| Tech Stack | 与 GAP 一致 | ✅ |

#### 1.3.2 Phase 1：Module Design

| 章节 | 要点 | GAP 覆盖 | 验证结果 |
|------|------|----------|----------|
| §1.1 | TemplateFetcher opts.offline；offline 为真时仅 cache 检查、无效 throw OFFLINE_CACHE_MISSING | GAP-1.1、1.2 | ✅ |
| §1.2 | init --offline 解析、传入 fetchTemplate；catch OFFLINE_CACHE_MISSING 时 exit(5)；templateVersion 已写入 | GAP-1.1、2.1、3.1 | ✅ |
| §1.3 | getLocalTemplatePath 有值时直接返回，不进入 offline 分支 | 说明已补充 | ✅ |

#### 1.3.3 Phase 2：Data Flow

| 步骤 | 要点 | GAP 覆盖 | 验证结果 |
|------|------|----------|----------|
| 1–2 | init --offline、bin 解析、initCommand 接收 | GAP-1.1 | ✅ |
| 3–4 | runNonInteractiveFlow/runInteractiveFlow 传 offline、fetchTemplate(offline:true) | GAP-1.1 | ✅ |
| 5–6 | TemplateFetcher offline 分支、catch exit(5) | GAP-1.2、3.1 | ✅ |
| 7 | init 成功 → writeSelectedAI、templateVersion | GAP-2.1 | ✅ |

#### 1.3.4 Phase 3：Integration Test Plan

| 测试 | 要点 | GAP 覆盖 | 验证结果 |
|------|------|----------|----------|
| E2E-1 | init --offline 且 cache 存在 → 不发起网络、init 成功、bmad-speckit.json 含 templateVersion | GAP-3.2 | ✅ |
| E2E-2 | init --offline 且 cache 缺失 → 退出码 5、stderr 含「离线」「cache 缺失」 | GAP-3.2 | ✅ |
| E2E-3 | 未传 --offline → 与 11.1 一致；网络失败退出码 3 | GAP-3.2 | ✅ |
| E2E-4 | 已有配置合并 — 仅 templateVersion 更新，其他字段保留 | GAP-3.2（已补充 E2E-4/AC-2.2） | ✅ |
| INT-1 | fetchTemplate(offline:true) 仅走 cache、不调用 fetchFromGitHub/fetchFromUrl | GAP-3.2 | ✅ |
| INT-2 | catch OFFLINE_CACHE_MISSING 时 process.exit(5) | GAP-3.2 | ✅ |
| INT-3 | writeSelectedAI 被调用、bmad-speckit.json 含 templateVersion | GAP-3.2 | ✅ |
| INT-4 | bin init --offline 解析传入 initCommand | GAP-3.2 | ✅ |
| UNIT-1 | TemplateFetcher opts.offline cache 存在/缺失 | GAP-3.2 | ✅ |
| UNIT-2 | init --offline 解析、catch exit(5) | GAP-3.2 | ✅ |

#### 1.3.5 Phase 4：接口与测试策略汇总

| 项目 | GAP 覆盖 | 验证结果 |
|------|----------|----------|
| template-fetcher.js opts.offline | GAP-1.1 | ✅ |
| init.js --offline、exit(5) | GAP-1.1、3.1 | ✅ |
| bin init --offline | GAP-1.1 | ✅ |
| 单元/集成/E2E 测试策略 | GAP-3.2 | ✅ |

---

## 2. 实现验证（grep / 代码核对）

| 验证项 | 命令/方式 | 结果 |
|--------|-----------|------|
| bin 无 --offline | grep --offline packages/bmad-speckit/bin | 无 --offline 选项 ✅ |
| template-fetcher 无 opts.offline | 阅读 fetchTemplate、fetchFromGitHub | 无 opts.offline 分支 ✅ |
| init 未传 offline、无 exit(5) | 阅读 runNonInteractiveFlow | 无 offline 解析与传递 ✅ |
| exit-codes 已有 OFFLINE_CACHE_MISSING: 5 | 阅读 exit-codes.js | 已定义 ✅ |
| writeSelectedAI 写入 templateVersion | 阅读 init-skeleton.js | ConfigManager.setAll 已写入 ✅ |

---

## 3. 审计结论

**完全覆盖、验证通过。**

IMPLEMENTATION_GAPS-E11-S2.md 已完全覆盖 Story 11-2（本 Story 范围、非本 Story 范围、AC-1～AC-3、Tasks T1～T3、Dev Notes）、spec-E11-S2.md（FR-001～FR-008、Key Entities、Success Criteria、Implementation Constraints）、plan-E11-S2.md（Phase 0～4、§1.3 getLocalTemplatePath、§3 Integration Test Plan 含 E2E-4）。逐条对照无遗漏章节、无未覆盖要点。

**审计中已修改内容**（消除 gap）：
1. GAP-3.2 补充「已有配置合并（E2E-4/AC-2.2）」以显式映射 plan §3 E2E-4。
2. 说明章节补充「getLocalTemplatePath 与 offline（plan §1.3）」以明确边界逻辑。

**报告保存路径**：d:\Dev\BMAD-Speckit-SDD-Flow\specs\epic-11-speckit-template-offline\story-2-offline-version-lock\AUDIT_GAPS-E11-S2.md

**iteration_count**：1（本轮发现 2 处可完善点并已直接修改被审文档，修改后验证通过）

---

## 可解析评分块（供 parseAndWriteScore）

总体评级: A

维度评分:
- 需求完整性: 95/100
- 可测试性: 92/100
- 一致性: 93/100
- 可追溯性: 94/100

---

## 批判审计员结论

**已检查维度**：遗漏需求点、边界未定义、验收不可执行、与前置文档矛盾、孤岛模块、伪实现/占位、行号/路径漂移、验收一致性。

**每维度结论**：

- **遗漏需求点**：已逐条对照 Story 11-2（本 Story 范围、非本 Story 范围、AC-1～AC-3、Tasks T1～T3、Dev Notes）、spec-E11-S2.md（FR-001～FR-008、Key Entities、Success Criteria、Implementation Constraints）、plan-E11-S2.md（Phase 0～4、§1.3、§3 全部 E2E/INT/UNIT）。本轮修改前 GAP-3.2 未显式列出 E2E-4（已有配置合并）、说明未提 plan §1.3；修改后已补充，无遗漏。

- **边界未定义**：--offline 为真时的 cache 检查、cache 缺失 throw、报错含「离线」「cache 缺失」、退出码 5 仅用于该场景、getLocalTemplatePath 优先于 offline（plan §1.3）均在 GAP 与 plan 中明确。边界已定义。

- **验收不可执行**：GAP-1.1、1.2、3.1 对应 template-fetcher、init、bin 实现；GAP-3.2 对应 plan §3 全部测试用例；每项 GAP 均可通过实现与运行测试验证。验收可执行。

- **与前置文档矛盾**：GAPS 与 Story 本 Story 范围、非本 Story 范围一致；与 spec FR、Key Entities、SC 一致；与 plan Phase 1～4、接口变更、测试策略一致。无矛盾。

- **孤岛模块**：GAP 包/文件汇总明确变更 template-fetcher.js、init.js、bin/bmad-speckit.js；调用链 init → fetchTemplate(opts.offline) 已在 plan §2 定义。无孤岛风险。

- **伪实现/占位**：GAP 正确标注「未实现」「已实现」；已实现项（GAP-2.1、2.2）经代码核对 writeSelectedAI/ConfigManager.setAll 属实。无伪实现。

- **行号/路径漂移**：GAP 引用文件路径（template-fetcher.js、init.js、bin/bmad-speckit.js、_bmad-output/config/bmad-speckit.json）与 plan、packages/bmad-speckit 一致。无漂移。

- **验收一致性**：GAP-3.2 与 plan §3 E2E-1～4、INT-1～4、UNIT-1～2 一一对应；E2E-4 已补充至 GAP-3.2。验收与 GAP 描述一致。

**本轮结论**：本轮发现 2 处可完善点并已直接修改 IMPLEMENTATION_GAPS-E11-S2.md；修改后完全覆盖、验证通过，无新 gap。
