# plan-E10-S4：配置持久化实现方案

**Epic**：E10 speckit-init-core  
**Story ID**：10.4  
**输入**：spec-E10-S4.md、10-4-config-persistence.md

---

## 1. 需求映射清单（plan.md ↔ 需求文档 + spec.md）

| 需求文档章节 | spec.md 对应 | plan.md 对应 | 覆盖状态 |
|-------------|-------------|-------------|----------|
| Story 陈述 | §1 概述 | Phase 1–6、§4 | ✅ |
| AC-1 全局与项目级路径与格式 | spec §3 AC-1 | Phase 1 | ✅ |
| AC-2 get 与优先级 | spec §3 AC-2 | Phase 2 | ✅ |
| AC-3 set 与目标 | spec §3 AC-3 | Phase 3 | ✅ |
| AC-4 list 与合并视图 | spec §3 AC-4 | Phase 4 | ✅ |
| AC-5 支持的 key 与类型 | spec §3 AC-5 | Phase 2、3 | ✅ |
| AC-6 init 流程写入项目级 | spec §3 AC-6 | Phase 5 | ✅ |
| 本 Story 范围 | spec §2.1 | Phase 1–6 | ✅ |
| 架构约束、与 10.1/10.2/10.3 集成 | spec §4 | Phase 1–6 依赖说明、§5 | ✅ |

---

## 2. 目标与约束

- **目标**：实现 ConfigManager 模块（src/services/config-manager.js），提供全局 ~/.bmad-speckit/config.json 与项目级 _bmad-output/config/bmad-speckit.json 的 get/set/setAll/list；读取时项目级优先于全局；networkTimeoutMs 均无时返回 30000；init 流程通过 ConfigManager 写入项目级；init.js 已有 require('../services/config-manager') 与 getDefaultAI/defaultScript 调用，本 Story 实现该模块并接入 init-skeleton 写入。
- **约束**：路径仅用 Node.js path 与 os.homedir()；目录不存在时 mkdirSync recursive；读写 UTF-8；不解析 CLI；config 子命令由 Story 13.4 实现。
- **必须包含**：集成测试与 E2E（get/set/list 优先级与合并、set 不破坏其他 key、init 后项目级文件内容、10.2/10.3 读取 defaultAI/defaultScript 的生产路径验证）。

---

## 3. 实施分期

### Phase 1：路径解析与文件读写基础（AC-1）

1. **src/services/config-manager.js**：实现 getGlobalConfigPath()（os.homedir() + path.join('.bmad-speckit', 'config.json')）、getProjectConfigPath(cwd)（path.join(cwd, '_bmad-output', 'config', 'bmad-speckit.json')）；禁止硬编码 `/` 或 `\`。
2. **读写约定**：读文件时若不存在返回 {} 或等效；写文件前若目录不存在则 fs.mkdirSync(dir, { recursive: true })；所有 readFileSync/writeFileSync 使用 'utf8'。
3. **验收**：单元测试在临时目录下验证全局路径含 homedir、项目级路径为 cwd/_bmad-output/config/bmad-speckit.json；写后读回 JSON 一致。

### Phase 2：get(key, options) 与优先级（AC-2、AC-5）

1. **get(key, options)**：options.cwd 可选。若 cwd 下存在项目级文件且该文件含 key，返回项目级值；否则读全局文件返回该 key 的值；均无则返回 undefined。key 为 'networkTimeoutMs' 且全局与项目级均无时返回 30000。
2. **类型**：defaultAI、defaultScript、templateSource 按字符串读写；networkTimeoutMs 按数值读写（写入时 Number(value)）。
3. **导出**：导出 get、set、setAll、list；可选导出 getDefaultAI/getDefaultScript 便捷方法或由调用方 get('defaultAI', { cwd })。
4. **验收**：单元测试 mock 两路径，覆盖「仅全局有值」「仅项目级有值」「两者都有（项目级覆盖）」「均无」「networkTimeoutMs 均无返回 30000」。

### Phase 3：set(key, value, options) 与 setAll(record, options)（AC-3、AC-5）

1. **set(key, value, options)**：options.scope 为 'global' 或 'project'；scope 为 'project' 时 options.cwd 必传。根据 scope 确定目标路径，若文件存在则 JSON.parse 读入，合并该 key，写回；若不存在则创建目录与文件后写入单 key。
2. **setAll(record, options)**：同上按 scope 确定路径，读入现有 JSON，与 record 合并（Object.assign 或逐 key），写回 UTF-8。
3. **验收**：set 单 key 不删除其他 key；setAll 多键合并；全局与项目级分别写入后读回正确。

### Phase 4：list(options)（AC-4）

1. **list(options)**：读全局配置对象，再读项目级配置对象（若 cwd 下存在）；合并为一对象，同 key 时项目级覆盖全局，返回该对象。
2. **验收**：全局与项目级各有不同 key 时 list 返回合并结果；仅全局时返回全局；同 key 时项目级值覆盖。

### Phase 5：与 init 集成（AC-6）

1. **init-skeleton.js**：在 writeSelectedAI 或等价流程中，改为通过 ConfigManager 写入项目级。即 require config-manager，调用 setAll({ selectedAI, templateVersion, initLog }) 或多次 set，写入 <targetPath>/_bmad-output/config/bmad-speckit.json；保留目录创建与 UTF-8 写入由 ConfigManager 内部完成。若 init 当前已有 writeSelectedAI 直接写 bmad-speckit.json，则改为调用 ConfigManager.setAll(..., { scope: 'project', cwd: targetPath })。
2. **init.js**：已存在 getDefaultAI（require('../services/config-manager')、configManager?.get?.('defaultAI')）与 defaultScript 解析（configManager?.get?.('defaultScript')）；本 Story 确保 config-manager.js 实现 get 且接受 { cwd }，init 传入 targetPath 或 process.cwd() 作为 cwd。
3. **验收**：init 完成后 _bmad-output/config/bmad-speckit.json 存在且含 selectedAI、templateVersion、initLog；getDefaultAI 在未传 --ai 时返回 ConfigManager 的 defaultAI（若有）；defaultScript 在未传 --script 时被 init 从 ConfigManager 读取。

### Phase 6：集成与回归

1. **单元测试**：get/set/list/setAll 在 mock 或临时目录下覆盖优先级、合并、networkTimeoutMs 默认 30000、set 不破坏其他 key。
2. **集成**：在已 init 项目根运行 init 后，检查 _bmad-output/config/bmad-speckit.json 含 selectedAI、templateVersion、initLog；修改全局 defaultAI 后再次 init 另一目录，验证默认 AI 来自全局；在项目级 bmad-speckit.json 设置 defaultScript 后，init 未传 --script 时使用项目级 defaultScript。
3. **生产路径**：grep 确认 init.js 与 init-skeleton.js 中 require/调用 config-manager 或 ConfigManager；确认 ConfigManager 在 init 与脚本生成默认值路径上被使用，无孤岛模块。

---

## 4. 集成测试与端到端功能测试计划（必须）

### 4.1 ConfigManager 与 init 集成

| 测试类型 | 测试内容 | 命令/入口 | 预期 |
|----------|----------|-----------|------|
| 单元 | get 仅全局有值 | 准备全局文件含 defaultAI，无项目级，get('defaultAI', { cwd }) | 返回全局值 |
| 单元 | get 项目级优先 | 项目级与全局均含 defaultAI，get('defaultAI', { cwd }) | 返回项目级值 |
| 单元 | get 均无、networkTimeoutMs | 两文件均无，get('defaultAI') 为 undefined；get('networkTimeoutMs') 为 30000 | 符合 spec |
| 单元 | set 合并写入 | 目标文件已有其他 key，set('defaultAI', 'x') | 仅更新 defaultAI，其他 key 保留 |
| 单元 | list 合并 | 全局含 a，项目级含 b，list({ cwd }) | 返回 { a, b }；同 key 项目级覆盖 |
| 集成 | init 写入项目级 | init --ai cursor-agent --yes（临时目录） | 退出码 0，_bmad-output/config/bmad-speckit.json 含 selectedAI、templateVersion、initLog |
| 集成 | defaultAI 来自全局 | 先 set defaultAI 全局，再 init 另一目录不传 --ai | 使用的 AI 为全局 defaultAI |
| 集成 | defaultScript 来自项目级 | 在已 init 项目级 bmad-speckit.json 写 defaultScript: "sh"，init 不传 --script（如 Windows） | 生成 .sh（项目级覆盖平台默认） |
| E2E | init 后配置可读 | init 完成后再调用 ConfigManager.list({ cwd: 项目根 }) | 含 selectedAI、templateVersion、initLog |

### 4.2 生产代码关键路径验证

- **init.js**：getDefaultAI 内 require('../services/config-manager') 并 get('defaultAI')；defaultScript 解析处 get('defaultScript', { cwd })；验收：grep 确认两处调用存在且 cwd 传入正确。
- **init-skeleton.js**：writeSelectedAI 或等价逻辑改为 ConfigManager.setAll 写入项目级；验收：grep 确认 config-manager 被 require 且 setAll/set 在 init 完成路径被调用。
- **config-manager.js**：被 init 与（未来）13.4 config 子命令使用；本 Story 仅保证被 init 与 10.2/10.3 默认值逻辑使用。

---

## 5. 模块与文件改动设计

### 5.1 新增文件

| 文件 | 说明 |
|------|------|
| packages/bmad-speckit/src/services/config-manager.js | ConfigManager：getGlobalConfigPath、getProjectConfigPath、get、set、setAll、list；路径用 path + os.homedir；读写 UTF-8；目录不存在时创建 |

### 5.2 修改文件

| 文件 | 变更 | 说明 |
|------|------|------|
| packages/bmad-speckit/src/commands/init-skeleton.js | writeSelectedAI 改为通过 ConfigManager.setAll 写入项目级（或保留写 selectedAI/templateVersion/initLog，改为调用 config-manager） | 使 init 写入项目级配置统一经 ConfigManager，不破坏现有字段 |
| packages/bmad-speckit/src/commands/init.js | 无需改 require 路径；确保 getDefaultAI 与 defaultScript 解析传入的 cwd 为 targetPath 或当前项目根 | 已有 try/require config-manager，本 Story 实现该模块即可 |
| packages/bmad-speckit/tests/ | 新增或扩展：config-manager 单元测试；init 集成测试（init 后项目级配置、defaultAI/defaultScript 来源） | 覆盖 §4.1、§4.2 |

### 5.3 依赖关系

- Phase 1 先行（路径与读写基础）。
- Phase 2、3、4 可并行或按 2→3→4（get 被 set/list 复用）。
- Phase 5 依赖 Phase 1–4，并修改 init-skeleton 与验证 init.js 调用。
- Phase 6 依赖 Phase 5，覆盖单元与集成/E2E。

<!-- AUDIT: PASSED by code-reviewer --> 参见 AUDIT_plan-E10-S4.md
