# IMPLEMENTATION_GAPS 审计报告：Story 10.4 配置持久化

**被审文档**：specs/epic-10-speckit-init-core/story-4-config-persistence/IMPLEMENTATION_GAPS-E10-S4.md  
**审计日期**：2025-03-08  
**审计依据**：audit-prompts §3、audit-prompts-critical-auditor-appendix.md、§4.1 可解析评分块  
**需求依据**：10-4-config-persistence.md、spec-E10-S4.md、plan-E10-S4.md

---

## 1. 逐条对照验证

### 1.1 原始需求文档 10-4-config-persistence.md

#### 1.1.1 Story 陈述与需求追溯

| 需求要点 | 验证方式 | GAP 覆盖 | 验证结果 |
|----------|----------|----------|----------|
| As a 多项目用户，配置持久化到全局与项目级，项目级覆盖全局 | 对照 Story 陈述 | 本 Story 范围 + GAP-1.1～4.1、5.1～5.2 | ✅ |
| PRD US-8、§5.9；ARCH §3.2、§4.1；Epics 10.4 追溯 | 对照需求追溯表 | 通过 本 Story 范围与 AC 映射体现，§2 需求映射已列「10-4 本 Story 范围」 | ✅ |

#### 1.1.2 本 Story 范围（4 条）

| 需求要点 | 验证方式 | GAP 覆盖 | 验证结果 |
|----------|----------|----------|----------|
| ConfigManager 模块：统一读写 ~/.bmad-speckit/config.json 与 \<cwd\>/_bmad-output/config/bmad-speckit.json | 对照 10-4 本 Story 范围 | GAP-1.1、1.2 | ✅ |
| 支持 key：defaultAI、defaultScript、templateSource、networkTimeoutMs；项目级扩展 templateVersion、selectedAI、initLog | 对照 10-4 本 Story 范围、AC-5 | GAP-2.2、3.1、3.2、5.1 | ✅ |
| 优先级：读取时项目级优先于全局；写入由调用方指定目标 | 对照 10-4 本 Story 范围、AC-2、AC-3 | GAP-2.1、3.1、4.1 | ✅ |
| init 集成：init 完成后经 ConfigManager 写项目级；10.2/10.3 经 ConfigManager 读 defaultAI/defaultScript | 对照 10-4 本 Story 范围、AC-6 | GAP-5.1、5.2 | ✅ |

#### 1.1.3 非本 Story 范围

| 需求要点 | 验证方式 | GAP 覆盖 | 验证结果 |
|----------|----------|----------|----------|
| 10.1/10.2/10.3/13.4/10.5 职责划分 | 对照 10-4 非本 Story 范围表 | GAPS 仅描述 ConfigManager 与 init 集成点，未将 config 子命令、bmadPath 等纳入，符合边界 | ✅ |

#### 1.1.4 AC-1：全局与项目级路径与格式（3 scenarios）

| Scenario | Given / When / Then | GAP 覆盖 | 验证结果 |
|----------|---------------------|----------|----------|
| 全局路径 | 解析全局配置路径 → ~/.bmad-speckit/config.json（os.homedir + path.join） | GAP-1.1 | ✅ |
| 项目级路径 | 已 init 项目根 → \<cwd\>/_bmad-output/config/bmad-speckit.json | GAP-1.1 | ✅ |
| 文件格式 | JSON；写入不破坏已有键值 | GAP-1.2、3.1 | ✅ |

#### 1.1.5 AC-2：get(key) 与优先级（4 scenarios）

| Scenario | Given / When / Then | GAP 覆盖 | 验证结果 |
|----------|---------------------|----------|----------|
| 仅全局有值 | 全局含 defaultAI，项目级无 → get('defaultAI', { cwd }) 返回全局 | GAP-2.1 | ✅ |
| 项目级有值 | 项目级含 defaultAI → 返回项目级（项目级优先） | GAP-2.1 | ✅ |
| 均无 | 两处均无 → 返回 undefined 或约定默认 | GAP-2.1 | ✅ |
| 仅项目级存在 | 无全局，项目级有 defaultScript → 返回项目级 | GAP-2.1 | ✅ |

#### 1.1.6 AC-3：set(key, value) 与目标（3 scenarios）

| Scenario | Given / When / Then | GAP 覆盖 | 验证结果 |
|----------|---------------------|----------|----------|
| 写入全局 | set(key, value, { scope: 'global' }) → 写入 ~/.bmad-speckit/config.json，必要时创建目录 | GAP-3.1 | ✅ |
| 写入项目级 | set(key, value, { scope: 'project', cwd }) → 写入 \<cwd\>/_bmad-output/config/bmad-speckit.json | GAP-3.1 | ✅ |
| 合并写入 | 目标文件已有其他 key → set 单 key 仅更新该 key，不删其他 key | GAP-3.1 | ✅ |

#### 1.1.7 AC-4：list() 与合并视图（2 scenarios）

| Scenario | Given / When / Then | GAP 覆盖 | 验证结果 |
|----------|---------------------|----------|----------|
| 合并列表 | 全局与项目级均有不同 key → list({ cwd }) 返回合并；同 key 项目级覆盖 | GAP-4.1 | ✅ |
| 仅全局 | 无项目级文件 → list({ cwd }) 返回全局键值对 | GAP-4.1 | ✅ |

#### 1.1.8 AC-5：支持的 key 与类型（4 项）

| Key | 类型/默认 | GAP 覆盖 | 验证结果 |
|-----|-----------|----------|----------|
| defaultAI | 字符串（AI id） | GAP-2.2 | ✅ |
| defaultScript | 字符串（sh/ps） | GAP-2.2 | ✅ |
| templateSource | 字符串 | GAP-2.2 | ✅ |
| networkTimeoutMs | 数值；未设置时 get 可返回 30000 | GAP-2.1、2.2 | ✅ |

#### 1.1.9 AC-6：init 流程写入项目级（1 scenario）

| Scenario | Given / When / Then | GAP 覆盖 | 验证结果 |
|----------|---------------------|----------|----------|
| init 写入 | init 完成 → ConfigManager 写入项目级 selectedAI、templateVersion、initLog；set 或 setAll 供 init 调用 | GAP-5.1、5.2 | ✅ |

#### 1.1.10 Tasks T1～T6 及子项

| Task | 子项 | 需求要点 | GAP 覆盖 | 验证结果 |
|------|------|----------|----------|----------|
| T1 | T1.1 | config-manager.js，全局路径与项目级路径解析（os.homedir、path.join） | GAP-1.1 | ✅ |
| T1 | T1.2 | 目录不存在时创建（mkdirp/mkdirSync recursive）；读写 UTF-8 | GAP-1.2 | ✅ |
| T2 | T2.1 | get(key, { cwd })：项目级优先→全局→undefined | GAP-2.1 | ✅ |
| T2 | T2.2 | networkTimeoutMs 均无时返回 30000 | GAP-2.1 | ✅ |
| T2 | T2.3 | 导出 getDefaultAI/getDefaultScript 或统一 get | GAP-2.1（init 用 get 传 key） | ✅ |
| T3 | T3.1 | set(key, value, { scope, cwd })；存在则读入合并写回 | GAP-3.1 | ✅ |
| T3 | T3.2 | setAll(record, options) 供 init 写入多键 | GAP-3.2 | ✅ |
| T4 | T4.1 | list({ cwd }) 合并全局与项目级，同 key 项目级覆盖 | GAP-4.1 | ✅ |
| T5 | T5.1 | init 完成后 ConfigManager 写入项目级（selectedAI、templateVersion、initLog） | GAP-5.1 | ✅ |
| T5 | T5.2 | getDefaultAI 调用 ConfigManager.get('defaultAI', { cwd }) | GAP-5.2 | ✅ |
| T5 | T5.3 | defaultScript 调用 ConfigManager.get('defaultScript', { cwd }) | GAP-5.2 | ✅ |
| T6 | T6.1 | 单元测试：get/set/list 优先级、合并、set 不破坏其他 key | GAP-6.1 | ✅ |
| T6 | T6.2 | 集成：init 后项目级含 selectedAI/templateVersion/initLog；defaultAI 来自全局；defaultScript 来自项目级 | GAP-6.2 | ✅ |

#### 1.1.11 Dev Notes

| 章节 | 需求要点 | GAP 覆盖 | 验证结果 |
|------|----------|----------|----------|
| 架构约束 | ConfigManager 无 UI、不解析 CLI；优先级与 PRD §5.9、ARCH §4.1 一致；path + os.homedir，禁止硬编码 | GAP-1.1、2.1、3.1、4.1 描述与 spec/plan 一致 | ✅ |
| Previous Story Intelligence | InitCommand 写入项目级；10.2 getDefaultAI、10.3 defaultScript 由本 Story 提供 get | GAP-5.1、5.2 | ✅ |
| Project Structure Notes | config-manager 路径建议 src/config-manager.js 或 src/config/；spec §4.1 约定 src/services/config-manager.js | GAP-1.1 与 当前实现摘要 采用 src/services/config-manager.js，与 spec 一致 | ✅ |

---

### 1.2 spec-E10-S4.md

#### 1.2.1 §1 概述

| 需求要点 | GAP 覆盖 | 验证结果 |
|----------|----------|----------|
| 全局/项目级路径、get/set/setAll/list、defaultAI/defaultScript/templateSource/networkTimeoutMs、项目级优先、scope 写入、init 集成、10.2/10.3 读取 | GAP-1.1～5.2 | ✅ |

#### 1.2.2 §2.1 本 Story 范围（表）

| 功能点 | 描述/边界 | GAP 覆盖 | 验证结果 |
|--------|-----------|----------|----------|
| 全局路径 | os.homedir() + path.join('.bmad-speckit', 'config.json') | GAP-1.1 | ✅ |
| 项目级路径 | \<cwd\>/_bmad-output/config/bmad-speckit.json，path 模块 | GAP-1.1 | ✅ |
| get(key, options) | options.cwd；项目级优先；均无 undefined；networkTimeoutMs 30000 | GAP-2.1、2.2 | ✅ |
| set(key, value, options) | scope 'global'\|'project'；cwd 在 project 必传；合并不删其他 key | GAP-3.1 | ✅ |
| setAll(record, options) | 多键合并，供 init | GAP-3.2 | ✅ |
| list(options) | 合并视图，同 key 项目级覆盖 | GAP-4.1 | ✅ |
| 支持 key | defaultAI/defaultScript/templateSource/networkTimeoutMs；类型与默认 30000 | GAP-2.2 | ✅ |
| 项目级扩展 key | templateVersion、selectedAI、initLog 由 init 写入 | GAP-5.1 | ✅ |

#### 1.2.3 §2.2 非本 Story 范围

| 说明 | 验证结果 |
|------|----------|
| GAPS 不覆盖 10.1/10.2/10.3/13.4/10.5 职责，仅提供 ConfigManager 与集成点 | ✅ |

#### 1.2.4 §3 AC-1～AC-6 与实现要点

| AC | 实现要点 | GAP 覆盖 | 验证结果 |
|----|----------|----------|----------|
| AC-1 | 路径 path + os.homedir；目录不存在时创建（mkdirSync recursive）；读写 UTF-8 | GAP-1.1、1.2 | ✅ |
| AC-2 | 先读项目级（cwd 下存在且含 key）再全局；均无 undefined；networkTimeoutMs 30000 | GAP-2.1 | ✅ |
| AC-3 | 读入现有 JSON，合并单 key 或 setAll，写回 UTF-8 | GAP-3.1、3.2 | ✅ |
| AC-4 | 先读全局再读项目级，同 key 项目级覆盖，返回单一对象 | GAP-4.1 | ✅ |
| AC-5 | 四 key 类型与默认 | GAP-2.2 | ✅ |
| AC-6 | init 通过 ConfigManager.set 或 setAll 写入项目级；ConfigManager 可被 init require（src/services/config-manager.js） | GAP-5.1、5.2、6.3 | ✅ |

#### 1.2.5 §4.1 与 Story 10.1/10.2/10.3 集成

| 要点 | GAP 覆盖 | 验证结果 |
|------|----------|----------|
| InitCommand 完成后 ConfigManager 写入项目级；writeSelectedAI 改为 setAll/set | GAP-5.1、6.3 | ✅ |
| 10.2 getDefaultAI：ConfigManager.get('defaultAI', { cwd })；config-manager 路径 ../services/config-manager | GAP-5.2、1.1 | ✅ |
| 10.3 未传 --script 时 get('defaultScript', { cwd })；无值平台默认 | GAP-5.2 | ✅ |

#### 1.2.6 §4.2 架构约束

| 约束 | GAP 覆盖 | 验证结果 |
|------|----------|----------|
| 无 UI、不解析 CLI；13.4 负责 config 子命令 | GAP 未将 CLI 纳入，符合 | ✅ |
| 优先级项目级 > 全局；path + os.homedir；目录自动创建；UTF-8 | GAP-1.1、1.2、2.1、4.1 | ✅ |

#### 1.2.7 §5 需求映射清单

| 说明 | 验证结果 |
|------|----------|
| spec 与原始需求映射为 meta 信息，GAPS §2 需求映射已覆盖原始文档章节 | ✅ |

---

### 1.3 plan-E10-S4.md

#### 1.3.1 §1 需求映射清单、§2 目标与约束

| 需求要点 | GAP 覆盖 | 验证结果 |
|----------|----------|----------|
| plan ↔ 需求/spec 映射 | §2 需求映射表 | ✅ |
| 目标：ConfigManager get/set/setAll/list、项目级优先、networkTimeoutMs 30000、init 经 ConfigManager 写入、init.js 传 cwd | GAP-1.1～5.2 | ✅ |
| 必须包含：集成测试与 E2E、生产路径验证 | GAP-6.1、6.2、6.3 | ✅ |

#### 1.3.2 §3 Phase 1～6

| Phase | 实施内容 | GAP 覆盖 | 验证结果 |
|-------|----------|----------|----------|
| Phase 1 | getGlobalConfigPath()、getProjectConfigPath(cwd)；读写约定 mkdirSync recursive、utf8；验收路径与写读一致 | GAP-1.1、1.2 | ✅ |
| Phase 2 | get(key, options)、options.cwd、networkTimeoutMs 30000；类型与导出；验收仅全局/仅项目级/两者/均无 | GAP-2.1、2.2 | ✅ |
| Phase 3 | set(scope, cwd)、合并单 key；setAll 合并多键；验收 set 不删其他 key | GAP-3.1、3.2 | ✅ |
| Phase 4 | list({ cwd }) 合并、项目级覆盖；验收合并结果 | GAP-4.1 | ✅ |
| Phase 5 | init-skeleton 改为 ConfigManager 写入；init.js 传 cwd；验收项目级文件含 selectedAI/templateVersion/initLog、getDefaultAI/defaultScript 来源 | GAP-5.1、5.2 | ✅ |
| Phase 6 | 单元测试 get/set/list/setAll；集成 init 后项目级、defaultAI 全局、defaultScript 项目级；生产路径 grep require/调用 config-manager | GAP-6.1、6.2、6.3 | ✅ |

#### 1.3.3 §4.1 ConfigManager 与 init 集成（测试表）

| 测试类型 | 测试内容 | GAP 覆盖 | 验证结果 |
|----------|----------|----------|----------|
| 单元 | get 仅全局有值、项目级优先、均无与 networkTimeoutMs、set 合并、list 合并 | GAP-6.1 | ✅ |
| 集成 | init 写入项目级含 selectedAI/templateVersion/initLog；defaultAI 来自全局；defaultScript 来自项目级 | GAP-6.2 | ✅ |
| E2E | init 后 ConfigManager.list({ cwd: 项目根 }) 含 selectedAI、templateVersion、initLog | GAP-6.2（当前 IMPLEMENTATION_GAPS 已含「E2E：init 完成后 list({ cwd }) 可读」） | ✅ |

#### 1.3.4 §4.2 生产代码关键路径验证

| 验证项 | GAP 覆盖 | 验证结果 |
|--------|----------|----------|
| init.js：getDefaultAI 与 defaultScript 处 require config-manager、get 传 cwd | GAP-5.2、6.3 | ✅ |
| init-skeleton.js：writeSelectedAI 改为 ConfigManager.setAll 写入项目级 | GAP-5.1、6.3 | ✅ |
| config-manager.js 被 init 与 10.2/10.3 默认值路径使用 | GAP-6.3 | ✅ |

#### 1.3.5 §5 模块与文件改动设计

| 章节 | 内容 | GAP 覆盖 | 验证结果 |
|------|------|----------|----------|
| §5.1 新增 | src/services/config-manager.js（getGlobalConfigPath、getProjectConfigPath、get、set、setAll、list） | GAP-1.1、2.1、3.1、3.2、4.1 | ✅ |
| §5.2 修改 | init-skeleton writeSelectedAI → ConfigManager.setAll；init.js 传 cwd；tests 单元与集成 | GAP-5.1、5.2、6.1、6.2 | ✅ |
| §5.3 依赖 | Phase 1 先行，2～4 可并行，5 依赖 1～4，6 依赖 5 | 与 GAP 依赖关系一致 | ✅ |

---

## 2. 审计结论

**完全覆盖、验证通过。**

IMPLEMENTATION_GAPS-E10-S4.md 已完全覆盖原始需求文档 10-4-config-persistence.md（Story 陈述、需求追溯、本 Story 范围、非本 Story 范围、AC-1～AC-6、Tasks T1～T6、Dev Notes）、参考文档 spec-E10-S4.md（§1～§5 及实现要点）、plan-E10-S4.md（§1～§5、Phase 1～6、§4.1 测试表、§4.2 生产路径验证）。逐条对照无遗漏章节、无未覆盖要点；GAP 清单与需求映射、当前实现摘要一致，可直接作为 tasks 阶段输入。

**报告保存路径**：d:\Dev\BMAD-Speckit-SDD-Flow\specs\epic-10-speckit-init-core\story-4-config-persistence\AUDIT_GAPS-E10-S4.md

---

## 可解析评分块（供 parseAndWriteScore）

总体评级: A

维度评分:
- 需求完整性: 95/100
- 可测试性: 92/100
- 一致性: 90/100
- 可追溯性: 93/100

---

## 批判审计员结论

**已检查维度**：遗漏需求点、边界未定义、验收不可执行、与前置文档矛盾、孤岛模块、伪实现/占位、行号/路径漂移、验收一致性。

**每维度结论**：

- **遗漏需求点**：已逐条对照 10-4-config-persistence.md（本 Story 范围、非本 Story 范围、AC-1～AC-6、Tasks T1～T6、Dev Notes）、spec-E10-S4.md（§1～§5、AC 实现要点、§4.1/§4.2）、plan-E10-S4.md（§1～§5、Phase 1～6、§4.1 测试表、§4.2 生产路径验证、§5.1/5.2）。需求追溯（PRD US-8、§5.9、ARCH §3.2/§4.1、Epics 10.4）通过「本 Story 范围」与 AC 映射覆盖，无需单独 GAP。无遗漏。

- **边界未定义**：全局/项目级路径、scope 'global'|'project'、cwd 在 project 时必传、合并写入不删其他 key、networkTimeoutMs 默认 30000、仅项目级扩展 key（templateVersion、selectedAI、initLog）由 init 写入，均在 GAP 与 spec/plan 中明确。边界已定义。

- **验收不可执行**：GAP-6.1/6.2/6.3 对应 plan §4.1 单元/集成/E2E 表与 §4.2 生产路径验证；每项 GAP 均可通过「实现 config-manager + 修改 init/init-skeleton + 编写/运行测试」验证。验收可执行。

- **与前置文档矛盾**：GAPS 与 10-4 本 Story 范围、非本 Story 范围一致；与 spec §2.1/§2.2、§3 AC、§4 集成与架构约束一致；与 plan Phase 1～6、§4、§5 一致。路径约定 src/services/config-manager.js 与 spec §4.1 一致。无矛盾。

- **孤岛模块**：GAP-6.3 明确要求「init.js、init-skeleton 中 require/调用 config-manager；ConfigManager 在 init 与脚本默认值路径被使用」，当前实现摘要已标注 init.js 已 require 与 get 调用、init-skeleton 仍直接写文件，实施时须改为 ConfigManager，避免孤岛。GAPS 已覆盖。

- **伪实现/占位**：GAPS 正确标注「未实现」「部分实现」；init.js try/require 与 configManager?.get 为预留调用，模块不存在故 try/catch，非假完成。无伪实现或占位未被识别。

- **行号/路径漂移**：GAPS 引用需求文档章节（Story 范围、AC-1～AC-6、Phase 1～6、§4.1/§4.2）、文件路径（packages/bmad-speckit/src/services/config-manager.js、init.js、init-skeleton.js）与 spec/plan 一致。无漂移。

- **验收一致性**：GAP-6.1/6.2/6.3 与 plan §4.1 测试表、§4.2 生产路径验证一一对应；E2E「init 后 list({ cwd }) 可读」已纳入 GAP-6.2 与 §2 需求映射。验收与 GAP 描述一致。

**本轮结论**：本轮无新 gap。IMPLEMENTATION_GAPS-E10-S4.md 完全覆盖、验证通过。
