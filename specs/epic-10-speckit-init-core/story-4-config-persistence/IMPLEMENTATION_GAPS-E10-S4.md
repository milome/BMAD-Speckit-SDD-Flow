# IMPLEMENTATION_GAPS E10-S4：配置持久化

**Epic**：10 - Speckit Init Core  
**Story**：10.4 - 配置持久化  
**输入**：plan-E10-S4.md、10-4-config-persistence.md、spec-E10-S4.md  
**对照基准**：当前代码（packages/bmad-speckit）

---

## 1. Gaps 清单（按需求文档章节）

| 需求文档章节 | Gap ID | 需求要点 | 当前实现状态 | 缺失/偏差说明 |
|-------------|--------|----------|-------------|---------------|
| Story 范围、AC-1 | GAP-1.1 | ConfigManager 模块：全局路径 getGlobalConfigPath()、项目级路径 getProjectConfigPath(cwd) | 未实现 | packages/bmad-speckit/src/services/config-manager.js 不存在；init.js 通过 try/require('../services/config-manager') 与 configManager?.get 预留调用，模块未实现 |
| Story 范围、AC-1 | GAP-1.2 | 读写约定：目录不存在时创建（mkdirSync recursive）、UTF-8 | 未实现 | 依赖 GAP-1.1；init-skeleton writeSelectedAI 已局部实现目录创建与 UTF-8，但非 ConfigManager 统一入口 |
| AC-2、AC-5 | GAP-2.1 | get(key, options)：项目级优先、options.cwd、均无 undefined、networkTimeoutMs 默认 30000 | 未实现 | ConfigManager 未实现；init.js getDefaultAI 调用 configManager?.get?.('defaultAI') 未传 cwd；defaultScript 处 get('defaultScript') 未传 cwd |
| AC-2、AC-5 | GAP-2.2 | 支持 key 类型：defaultAI、defaultScript、templateSource 字符串；networkTimeoutMs 数值 | 未实现 | 依赖 ConfigManager 实现 |
| AC-3、AC-5 | GAP-3.1 | set(key, value, options)：scope 'global'\|'project'、cwd、合并写入不删其他 key | 未实现 | ConfigManager 未实现 |
| AC-3、AC-5 | GAP-3.2 | setAll(record, options)：多键合并写入供 init 使用 | 未实现 | ConfigManager 未实现 |
| AC-4 | GAP-4.1 | list(options)：合并全局与项目级，同 key 项目级覆盖 | 未实现 | ConfigManager 未实现 |
| AC-6、Phase 5 | GAP-5.1 | init 完成后通过 ConfigManager 写入项目级 bmad-speckit.json（selectedAI、templateVersion、initLog） | 部分实现 | init-skeleton writeSelectedAI 直接写文件，写入 selectedAI、initLog，未写入 templateVersion；未经 ConfigManager，不符合「统一经 ConfigManager」 |
| AC-6、Phase 5 | GAP-5.2 | init.js getDefaultAI 与 defaultScript 解析传入 cwd（targetPath 或项目根） | 未实现 | getDefaultAI() 无参数，调用 get('defaultAI') 未传 { cwd }；defaultScript 解析处 get('defaultScript') 未传 { cwd }；spec/plan 要求 get('defaultAI', { cwd })、get('defaultScript', { cwd }) |
| Phase 6、§4 | GAP-6.1 | 单元测试：get/set/list/setAll 优先级、合并、networkTimeoutMs 默认 30000、set 不破坏其他 key | 未实现 | 无 config-manager 单元测试 |
| Phase 6、§4 | GAP-6.2 | 集成测试：init 后项目级文件含 selectedAI、templateVersion、initLog；defaultAI 来自全局；defaultScript 来自项目级；E2E：init 完成后 ConfigManager.list({ cwd: 项目根 }) 返回含 selectedAI、templateVersion、initLog | 未实现 | 无对应集成用例；init 当前未写 templateVersion |
| Phase 6、§4.2 | GAP-6.3 | 生产路径验证：init.js、init-skeleton 中 require/调用 config-manager；ConfigManager 在 init 与脚本默认值路径被使用 | 部分 | init.js 已 require 与 get 调用（模块不存在故 try/catch）；init-skeleton 未使用 ConfigManager，仍直接写文件 |

---

## 2. 需求映射（Gaps ↔ 原始需求）

| 原始文档章节 | 对应 Gap ID | 说明 |
|-------------|-------------|------|
| 10-4-config-persistence 本 Story 范围 | GAP-1.1, 1.2, 2.1, 2.2, 3.1, 3.2, 4.1 | ConfigManager 模块与路径、get/set/setAll/list 全缺 |
| AC-1 全局与项目级路径与格式 | GAP-1.1, 1.2 | 路径解析与读写基础 |
| AC-2 get 与优先级 | GAP-2.1, 2.2 | get 与 key 类型 |
| AC-3 set 与目标 | GAP-3.1, 3.2 | set/setAll |
| AC-4 list 与合并视图 | GAP-4.1 | list |
| AC-6 init 流程写入项目级 | GAP-5.1, 5.2 | init 经 ConfigManager 写入；get 传 cwd |
| plan Phase 6、§4 集成与 E2E | GAP-6.1, 6.2, 6.3 | 单元/集成/生产路径验证；§4.1 E2E「init 后 list({ cwd }) 可读」由 GAP-6.2 覆盖 |

---

## 3. 当前实现摘要

| 位置 | 当前行为 | 与需求差异 |
|------|----------|------------|
| packages/bmad-speckit/src/services/ | 无 config-manager.js | 需新增 ConfigManager 模块 |
| init.js | require('../services/config-manager')；getDefaultAI 用 get('defaultAI')；defaultScript 用 get('defaultScript') | 模块缺失则 try/catch 静默；未传 cwd |
| init-skeleton.js writeSelectedAI | 直接写 _bmad-output/config/bmad-speckit.json；写 selectedAI、initLog，不写 templateVersion | 应改为 ConfigManager.setAll(..., { scope: 'project', cwd })；需写入 templateVersion |

<!-- AUDIT: PASSED by code-reviewer --> 参见 AUDIT_GAPS-E10-S4.md
