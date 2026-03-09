# Tasks: Story 11.2 离线与版本锁定

**Epic**: 11 - speckit-template-offline  
**Story**: 11.2 - 离线与版本锁定（offline-version-lock）  
**Input**: spec-E11-S2.md、plan-E11-S2.md、IMPLEMENTATION_GAPS-E11-S2.md  
**Prerequisites**: spec、plan、GAPS 均已通过审计

---

## 本批任务 ↔ 需求追溯

| 任务 ID | 需求文档 | 章节 | 需求要点 |
|---------|----------|------|----------|
| T001–T003 | Story 11-2、spec、plan | Task 1、GAP-1.x | --offline 解析与传递；TemplateFetcher offline 分支；cache 缺失退出码 5 |
| T004 | Story 11-2、spec、plan | Task 2、GAP-2.x | templateVersion 写入（已实现，验收确认） |
| T005–T006 | Story 11-2、spec、plan | Task 3、GAP-3.x | 退出码 5 仅用于离线 cache 缺失；单元/集成/E2E 测试 |

---

## Gaps → 任务映射

| 章节 | Gap ID | 本任务表行 | 对应任务 |
|------|--------|------------|----------|
| Task 1 | GAP-1.1, 1.2 | ✓ 有 | T001, T002, T003 |
| Task 2 | GAP-2.1, 2.2 | ✓ 有 | T004（验收确认） |
| Task 3 | GAP-3.1, 3.2 | ✓ 有 | T005, T006 |

---

## Phase 1: TemplateFetcher offline 分支（AC-1）

**Purpose**: opts.offline 为真时仅 cache 检查、不发起网络；cache 缺失 throw OFFLINE_CACHE_MISSING

- [ ] **T001** 在 template-fetcher.js 的 fetchTemplate 中新增 opts.offline 分支：当 opts.offline 为真时，跳过 getLocalTemplatePath 之后、先解析所需 cache 路径（getCacheDir 或 url-\<hash\>），调用 isCacheValid(cacheDir)；若有效则返回 cacheDir；若无效则 throw new Error('离线模式下模板 cache 缺失 (Offline mode: template cache missing)') 或含「离线」「cache 缺失」的等价表述，err.code = 'OFFLINE_CACHE_MISSING'。禁止在 offline 为真时调用 fetchJson、downloadAndExtract 或发起任何 HTTP(S) 请求。（GAP-1.1, 1.2）

  **验收命令**：`node -e "const tf=require('./packages/bmad-speckit/src/services/template-fetcher'); (async()=>{try{await tf.fetchTemplate('latest',{offline:true,templateSource:'bmad-method/bmad-method'});}catch(e){console.log(e.code,e.message);}})();"`（cache 缺失时输出 OFFLINE_CACHE_MISSING 及含「离线」「cache 缺失」的消息）

- [ ] **T002** 在 init.js 的 runNonInteractiveFlow 与 runInteractiveFlow 中，将 options.offline 传入 fetchTemplate 的 opts；即 fetchTemplate(templateSpec, { ..., offline: options.offline })；在 bin/bmad-speckit.js 的 init 子命令中新增 .option('--offline', 'Use only local cache, no network')；initCommand 接收 options.offline。（GAP-1.1）

  **验收命令**：`cd packages/bmad-speckit && node bin/bmad-speckit.js init --help` 显示 --offline 选项；grep 确认 init.js 将 offline 传入 fetchTemplate

- [ ] **T003** 在 init.js 的 runNonInteractiveFlow 与 runInteractiveFlow 的 catch 块中，当 err.code === 'OFFLINE_CACHE_MISSING' 时，console.error(err.message)、process.exit(exitCodes.OFFLINE_CACHE_MISSING)；确保 NETWORK_TEMPLATE 路径仍使用 exit(3)。（GAP-1.2, 3.1）

  **验收命令**：mock TemplateFetcher throw OFFLINE_CACHE_MISSING，执行 init --offline --ai cursor-agent --yes 在无 cache 目录下退出码 5；stderr 含「离线」与「cache 缺失」或等价表述

---

## Phase 2: templateVersion 写入验收确认（AC-2）

**Purpose**: 确认 init 成功路径下 templateVersion 已正确写入；GAP-2.1/2.2 已实现

- [ ] **T004** 验收确认：init 成功完成（含 --offline 且 cache 存在、或未传 --offline 网络拉取成功）后，_bmad-output/config/bmad-speckit.json 含 templateVersion 字段；已有配置时仅更新 templateVersion、不覆盖其他字段。执行 E2E：init --offline --ai cursor-agent --yes（需先拉取 cache）→ 检查 bmad-speckit.json；init 至已有项目（含 defaultAI 等）→ 检查仅 templateVersion 更新。（GAP-2.1, 2.2）

  **验收命令**：`cd packages/bmad-speckit && npm test -- --grep "init.*templateVersion|E2E.*offline|E2E.*config"` 或等价 E2E/集成测试

---

## Phase 3: 测试与退出码验收（AC-3）

**Purpose**: 单元/集成/E2E 覆盖 --offline、cache 存在/缺失、退出码 5、templateVersion

- [ ] **T005** 为 TemplateFetcher 补充单元测试：opts.offline 为真且 cache 存在时返回路径、不发起请求（mock fs）；opts.offline 为真且 cache 缺失时 throw 含 code OFFLINE_CACHE_MISSING、message 含「离线」「cache 缺失」；mock 网络层验证 offline 时无 HTTP 请求。（GAP-3.2）

  **验收命令**：`cd packages/bmad-speckit && npm test -- tests/template-fetcher.test.js -v` 或 `tests/offline-*.test.js`

- [ ] **T006** 为 init 补充集成/E2E 测试：init --offline 且 cache 存在 → 退出码 0、bmad-speckit.json 含 templateVersion；init --offline 且 cache 缺失 → 退出码 5、stderr 含「离线」「cache 缺失」；init 未传 --offline 网络失败 → 退出码 3 非 5；已有配置合并（E2E-4）：项目已有 bmad-speckit.json 含其他字段，init 成功后仅 templateVersion 更新。（GAP-3.2）

  **验收命令**：`cd packages/bmad-speckit && npm test -- tests/e2e/init-e2e.test.js -v` 或等价；mock cache 目录与网络以稳定执行

---

## 验收汇总

| AC | 验收 |
|----|------|
| AC-1 | T001–T003 验收命令；--offline 仅用 cache、不发起网络；cache 缺失退出码 5 |
| AC-2 | T004 验收命令；templateVersion 写入、已有配置合并 |
| AC-3 | T005–T006 验收命令；退出码 5 仅用于离线 cache 缺失；测试覆盖 |

---

## Agent 执行规则

**禁止事项**：
1. ❌ 禁止在任务描述中添加「注: 将在后续迭代...」
2. ❌ 禁止标记任务完成但功能未实际调用
3. ❌ 禁止仅初始化对象而不在关键路径中使用
4. ❌ 禁止用「预留」「占位」等词规避实现
5. ❌ 禁止模块内部实现完整但未被生产代码关键路径导入、调用

**必须事项**：
1. ✅ 集成任务必须修改生产代码路径
2. ✅ 必须运行验收命令确认功能启用
3. ✅ 遇到无法完成的情况，应报告阻塞而非自行延迟
4. ✅ 功能实施前必须先检索并阅读 Story 11-2、spec、plan 相关章节
5. ✅ 每个任务验收须包含：该模块在生产代码关键路径中被导入、实例化并调用

<!-- AUDIT: PASSED by code-reviewer -->
