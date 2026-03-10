# tasks-E10-S4：配置持久化

**Epic**：E10 speckit-init-core  
**Story ID**：10.4  
**输入**：spec-E10-S4.md、plan-E10-S4.md、IMPLEMENTATION_GAPS-E10-S4.md、10-4-config-persistence.md

---

## 1. 本批任务 ↔ 需求追溯

| 任务 ID | 需求文档 | 章节 | 需求要点 |
|---------|----------|------|----------|
| T1 | 10-4-config-persistence, spec §3 AC-1 | GAP-1.1, 1.2 | ConfigManager 模块、全局/项目级路径、目录创建、UTF-8 读写 |
| T2 | spec §3 AC-2、AC-5, plan Phase 2 | GAP-2.1, 2.2 | get(key, options)、项目级优先、networkTimeoutMs 默认 30000、key 类型 |
| T3 | spec §3 AC-3、AC-5, plan Phase 3 | GAP-3.1, 3.2 | set、setAll、scope、合并写入 |
| T4 | spec §3 AC-4, plan Phase 4 | GAP-4.1 | list 合并视图 |
| T5 | spec §3 AC-6, plan Phase 5 | GAP-5.1, 5.2 | init 经 ConfigManager 写入项目级；getDefaultAI/defaultScript 传 cwd |
| T6 | plan Phase 6、§4 | GAP-6.1, 6.2, 6.3 | 单元测试、集成/E2E、生产路径验证 |

---

## 2. Gaps → 任务映射（按需求文档章节）

**核对规则**：IMPLEMENTATION_GAPS 中出现的每一条 Gap 必须在本任务表中出现并对应到具体任务；不得遗漏。

| 章节 | Gap ID | 本任务表行 | 对应任务 |
|------|--------|------------|----------|
| Story 范围、AC-1 | GAP-1.1, 1.2 | ✓ 有 | T1 |
| AC-2、AC-5 | GAP-2.1, 2.2 | ✓ 有 | T2 |
| AC-3、AC-5 | GAP-3.1, 3.2 | ✓ 有 | T3 |
| AC-4 | GAP-4.1 | ✓ 有 | T4 |
| AC-6、Phase 5 | GAP-5.1, 5.2 | ✓ 有 | T5 |
| Phase 6、§4、§4.2 | GAP-6.1, 6.2, 6.3 | ✓ 有 | T6 |

---

## 3. 任务列表

**说明**：Phase 1–4（ConfigManager 核心）的集成测试与端到端用例由 T6.2 覆盖；「该模块在生产代码关键路径中被导入、实例化并调用」的验证由 T6.3 统一覆盖；各 Phase 验收中的单元/行为验收与 T6.2/T6.3 共同构成完整验收。

### Phase 1：ConfigManager 模块与路径（GAP-1.1, 1.2）

- [ ] **T1.1** 新增 src/services/config-manager.js：实现 getGlobalConfigPath()（os.homedir() + path.join('.bmad-speckit', 'config.json')）、getProjectConfigPath(cwd)（path.join(cwd, '_bmad-output', 'config', 'bmad-speckit.json')）；禁止硬编码 `/` 或 `\`。
  - **验收**：单元测试在临时目录或 mock 下验证全局路径含 os.homedir() 结果、项目级路径为 cwd/_bmad-output/config/bmad-speckit.json。
- [ ] **T1.2** 读写约定：读文件若不存在返回 {}；写前若目录不存在则 fs.mkdirSync(dir, { recursive: true })；所有 readFileSync/writeFileSync 使用 'utf8'。
  - **验收**：写后读回 JSON 一致；目录不存在时写入不抛错且文件创建成功。该模块在生产代码关键路径中的集成验证由 T6.3 统一验收。

### Phase 2：get(key, options) 与优先级（GAP-2.1, 2.2）

- [ ] **T2.1** 实现 get(key, options)：若 options.cwd 下存在项目级文件且含 key 则返回项目级值；否则读全局文件返回该 key；均无则 undefined。key 为 'networkTimeoutMs' 且均无时返回 30000。
  - **验收**：单元测试覆盖「仅全局有值」「仅项目级有值」「两者都有项目级覆盖」「均无」「networkTimeoutMs 均无返回 30000」。
- [ ] **T2.2** 支持 key 类型：defaultAI、defaultScript、templateSource 字符串；networkTimeoutMs 数值（写入时 Number(value)）。导出 get、set、setAll、list。
  - **验收**：get/set 对上述 key 读写类型正确；模块导出可被 require 并调用。

### Phase 3：set(key, value, options) 与 setAll(record, options)（GAP-3.1, 3.2）

- [ ] **T3.1** 实现 set(key, value, options)：options.scope 为 'global' 或 'project'；scope 为 'project' 时 options.cwd 必传。目标路径存在则读入 JSON、合并该 key、写回；不存在则创建目录与文件后写入。
  - **验收**：set 单 key 不删除文件中其他 key；全局与项目级分别 set 后读回正确。
- [ ] **T3.2** 实现 setAll(record, options)：按 scope 确定路径，读入现有 JSON，与 record 合并后写回 UTF-8。
  - **验收**：setAll({ a: 1, b: 2 }) 后文件含 a、b；再次 setAll({ c: 3 }) 后文件含 a、b、c。

### Phase 4：list(options)（GAP-4.1）

- [ ] **T4.1** 实现 list(options)：读全局配置对象，再读项目级（若 options.cwd 下存在）；合并为一对象，同 key 项目级覆盖全局，返回该对象。
  - **验收**：单元测试：全局与项目级各有不同 key 时 list 返回合并结果；仅全局时返回全局；同 key 时项目级值覆盖。

### Phase 5：与 init 集成（GAP-5.1, 5.2）

- [ ] **T5.1** init-skeleton.js：将 writeSelectedAI（或等价）改为通过 ConfigManager 写入项目级。require config-manager，在 init 完成时调用 ConfigManager.setAll({ selectedAI, templateVersion, initLog }, { scope: 'project', cwd: targetPath })（或多次 set）；确保 templateVersion 写入；目录创建与 UTF-8 由 ConfigManager 内部完成。
  - **验收**：init 完成后 _bmad-output/config/bmad-speckit.json 存在且含 selectedAI、templateVersion、initLog；grep 确认 init-skeleton 中 require/调用 config-manager。
- [ ] **T5.2** init.js：getDefaultAI 调用 ConfigManager.get('defaultAI', { cwd }) 时传入 cwd（targetPath 或当前项目根）；defaultScript 解析处 get('defaultScript', { cwd }) 传入 cwd。若 getDefaultAI 无 targetPath 上下文，则 get('defaultAI') 可传 { cwd: process.cwd() } 或由调用方传入 cwd。
  - **验收**：grep 确认 get('defaultAI', { cwd: ... }) 与 get('defaultScript', { cwd: ... }) 存在且 cwd 传入；在已 init 项目根未传 --ai 时使用的 AI 来自 ConfigManager.get('defaultAI', { cwd })（若有）。

### Phase 6：单元测试、集成/E2E 与生产路径（GAP-6.1, 6.2, 6.3）

- [ ] **T6.1** 单元测试：get/set/list/setAll 在 mock 或临时目录下覆盖优先级、合并、networkTimeoutMs 默认 30000、set 不破坏其他 key。
  - **验收**：config-manager 单元测试文件存在且上述用例通过。
- [ ] **T6.2** 集成与 E2E：init --ai cursor-agent --yes（临时目录）后 _bmad-output/config/bmad-speckit.json 含 selectedAI、templateVersion、initLog；设置全局 defaultAI 后 init 另一目录不传 --ai 使用的 AI 为全局 defaultAI；在项目级 bmad-speckit.json 设置 defaultScript 后 init 不传 --script 使用项目级 defaultScript；E2E：init 完成后 ConfigManager.list({ cwd: 项目根 }) 返回含 selectedAI、templateVersion、initLog。
  - **验收**：集成/E2E 用例存在且通过；或已 init 项目根运行 list({ cwd }) 得到上述字段。
- [ ] **T6.3** 生产路径验证：grep 确认 init.js、init-skeleton.js 中 require 或调用 config-manager；ConfigManager 在 init 与脚本默认值路径被使用，无孤岛模块。
  - **验收**：grep 结果符合 plan §4.2；init 与 defaultScript 默认值路径均经 ConfigManager。

---

## 4. 需求映射清单（tasks ↔ plan + GAPS）

| plan 章节 | Gaps | tasks 对应 | 覆盖状态 |
|-----------|------|------------|----------|
| Phase 1 路径与读写 | GAP-1.1, 1.2 | T1.1, T1.2 | ✅ |
| Phase 2 get 与优先级 | GAP-2.1, 2.2 | T2.1, T2.2 | ✅ |
| Phase 3 set/setAll | GAP-3.1, 3.2 | T3.1, T3.2 | ✅ |
| Phase 4 list | GAP-4.1 | T4.1 | ✅ |
| Phase 5 init 集成 | GAP-5.1, 5.2 | T5.1, T5.2 | ✅ |
| Phase 6、§4、§4.2 | GAP-6.1, 6.2, 6.3 | T6.1, T6.2, T6.3 | ✅ |

---

## 5. 验收表头（按 Gap 逐条验证）

| Gap ID | 对应任务 | 生产代码实现要点（文件/类/方法/实现细节） | 集成测试要求（测试文件/用例/命令/预期） | 执行情况 | 验证通过 |
|--------|----------|------------------------------------------|----------------------------------------|----------|----------|
| GAP-1.1, 1.2 | T1.1, T1.2 | config-manager.js getGlobalConfigPath、getProjectConfigPath、读写目录创建与 UTF-8 | 单元：路径含 homedir 与 cwd；写后读回一致 | [ ] 待执行 | [ ] |
| GAP-2.1, 2.2 | T2.1, T2.2 | get(key, options)、项目级优先、networkTimeoutMs 30000、key 类型、导出 get/set/setAll/list | 单元：仅全局/仅项目级/覆盖/均无/networkTimeoutMs | [ ] 待执行 | [ ] |
| GAP-3.1, 3.2 | T3.1, T3.2 | set、setAll、scope、合并写入不删其他 key | 单元：set 不破坏其他 key；setAll 多键合并 | [ ] 待执行 | [ ] |
| GAP-4.1 | T4.1 | list(options) 合并全局与项目级 | 单元：合并、仅全局、同 key 项目级覆盖 | [ ] 待执行 | [ ] |
| GAP-5.1, 5.2 | T5.1, T5.2 | init-skeleton 经 ConfigManager.setAll 写入；init.js get 传 cwd | 集成：init 后项目级含 selectedAI/templateVersion/initLog；get 传 cwd | [ ] 待执行 | [ ] |
| GAP-6.1, 6.2, 6.3 | T6.1, T6.2, T6.3 | 单元/集成/E2E 用例；生产路径 grep | plan §4.1 全部用例 + §4.2 grep 验证 | [ ] 待执行 | [ ] |

<!-- AUDIT: PASSED by code-reviewer --> 参见 AUDIT_tasks-E10-S4.md
