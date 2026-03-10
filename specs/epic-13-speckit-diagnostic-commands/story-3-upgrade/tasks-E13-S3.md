# Tasks E13-S3: upgrade 子命令

**Epic**: 13 - Speckit Diagnostic Commands  
**Story**: 13.3 - upgrade 子命令  
**输入**: IMPLEMENTATION_GAPS-E13-S3.md, plan-E13-S3.md, spec-E13-S3.md

---

## 1. 本批任务 ↔ 需求追溯

| 任务 ID | 需求文档 | 章节 | 需求要点 |
|---------|----------|------|----------|
| T1–T1.3 | Story 13-3, spec §3 | AC-1 | UpgradeCommand 骨架、已 init 校验、bin 注册 |
| T2–T2.2 | Story 13-3, spec §4 | AC-2 | --dry-run |
| T3–T3.4 | Story 13-3, spec §5、§6、§7 | AC-3, AC-4, AC-5 | 执行更新、worktree 模式、templateVersion、networkTimeoutMs |
| T4–T4.3 | Story 13-3, plan §5 | AC-1–5 | 单元、集成测试 |

---

## 2. Gaps → 任务映射

| 章节 | Gap ID | 对应任务 |
|------|--------|----------|
| spec §3 | GAP-1.1, 1.2, 1.3 | T1.1–T1.3 |
| spec §4 | GAP-2.1 | T2.1–T2.2 |
| spec §5、§6、§7 | GAP-3.1, 3.2, 3.3, 3.4 | T3.1–T3.4 |
| plan Phase 1–4 | GAP-4.1 | T1–T3 全部 |

---

## 3. Agent 执行规则

**禁止事项**:
1. ❌ 禁止在任务描述中添加「注: 将在后续迭代...」
2. ❌ 禁止标记任务完成但功能未实际调用
3. ❌ 禁止伪实现、占位
4. ❌ 禁止跳过 TDD 红灯阶段

**必须事项**:
1. ✅ TDD 红绿灯：红灯 → 绿灯 → 重构
2. ✅ 必须运行验收命令确认功能
3. ✅ 创建 prd.tasks-E13-S3.json、progress.tasks-E13-S3.txt
4. ✅ ralph-method：每完成一 US 更新 prd、progress

---

## 4. 任务列表

### T1: UpgradeCommand 骨架与已 init 校验（AC-1）

- [ ] **T1.1** 新建 `packages/bmad-speckit/src/commands/upgrade.js`，实现 upgradeCommand(cwd, options)；支持 dryRun、template、offline 参数
  - **验收**：函数存在且可调用；options 含 dryRun、template、offline；**集成验证**：bin 注册后执行 `bmad-speckit upgrade --help` 有输出
  - **生产代码**：upgrade.js
  - **TDD**：先写验收测试（未 init 目录 upgrade → exit 1），红灯后实现

- [ ] **T1.2** 在 `bin/bmad-speckit.js` 注册 upgrade 子命令，添加 `--dry-run`、`--template <tag>`、`--offline` 选项
  - **验收**：`bmad-speckit upgrade --help` 显示选项；`bmad-speckit upgrade --dry-run` 在未 init 目录 exit 1
  - **生产代码**：bin/bmad-speckit.js
  - **集成测试**：未 init 目录 upgrade → exit 1、stderr 含「未 init」或等价

- [ ] **T1.3** 已 init 校验：读取 `_bmad-output/config/bmad-speckit.json`，不存在则 stderr 输出明确错误（含「未 init」或等价），exit 1
  - **验收**：未 init 目录 upgrade → exit 1；已 init 目录 upgrade（dry-run）→ exit 0
  - **生产代码**：upgrade.js 校验逻辑
  - **单元/集成测试**：未 init / 已 init 双场景

### T2: --dry-run（AC-2）

- [ ] **T2.1** 当 dryRun 为 true 时，调用 fetchTemplate 获取目标版本信息；stdout 输出可升级版本信息；不执行任何文件写入或 _bmad 覆盖
  - **验收**：upgrade --dry-run 在已 init 目录 exit 0；无文件变更
  - **生产代码**：upgrade.js dry-run 分支
  - **集成测试**：已 init 目录 upgrade --dry-run → 无 _bmad 变更、无 config 变更

- [ ] **T2.2** upgrade --dry-run --template v1.2.0 输出目标版本信息，不执行更新
  - **验收**：指定 --template 时 dry-run 输出对应版本信息
  - **生产代码**：upgrade.js template 解析
  - **集成测试**：upgrade --dry-run --template v1.0.0

### T3: --template 与执行更新（AC-3、AC-4、AC-5）

- [ ] **T3.1** 解析 --template：未传时使用 latest；传入 tag 时使用该 tag。调用 fetchTemplate(tag, opts)，opts 含 networkTimeoutMs（从 resolveNetworkTimeoutMs({ cwd }) 获取）、templateSource、offline
  - **验收**：fetchTemplate 被调用且传入正确 opts；networkTimeoutMs 从配置链解析
  - **生产代码**：upgrade.js、utils/network-timeout
  - **集成测试**：可选 mock 验证 opts 传递

- [ ] **T3.2** 拉取失败时：err.code === 'OFFLINE_CACHE_MISSING' → exit 5；err.code === 'NETWORK_TEMPLATE' 或网络异常 → exit 3；stderr 输出含「网络超时」或等价
  - **验收**：--offline 且 cache 缺失 → exit 5；网络失败 → exit 3
  - **生产代码**：upgrade.js 异常处理
  - **集成测试**：exception-paths 风格测试（可 mock 或使用现有 exception-paths 框架）

- [ ] **T3.3** 无 bmadPath：使用 generateSkeleton(cwd, templateDir, null, true) 覆盖项目内 _bmad；按需更新 _bmad-output 来自模板的子结构；ConfigManager.set('templateVersion', tag, { scope: 'project', cwd })
  - **验收**：upgrade 成功后 _bmad 已更新；bmad-speckit.json 的 templateVersion 已更新；其他字段（defaultAI、networkTimeoutMs 等）保留
  - **生产代码**：upgrade.js、init-skeleton、config-manager
  - **集成测试**：已 init 目录 upgrade --template latest → _bmad 更新、templateVersion 正确

- [ ] **T3.4** 有 bmadPath（worktree 共享）：不调用 generateSkeleton；仅 ConfigManager.set('templateVersion', tag, { scope: 'project', cwd })
  - **验收**：bmadPath 存在时 upgrade 不覆盖外部 _bmad；仅 templateVersion 更新
  - **生产代码**：upgrade.js worktree 分支
  - **集成测试**：人工构造 bmadPath config，执行 upgrade，验证 bmadPath 指向目录未变、templateVersion 已更新

### T4: 测试与验收

- [ ] **T4.1** 单元/集成测试：未 init 目录 upgrade → exit 1；已 init 目录 upgrade --dry-run → exit 0、无文件变更
  - **验收**：npm test 或等效命令通过
  - **测试文件**：packages/bmad-speckit/tests/upgrade*.test.js 或集成到现有 test 文件

- [ ] **T4.2** 集成测试：已 init 目录 upgrade --template latest → _bmad 更新、templateVersion 更新
  - **验收**：测试通过
  - **测试文件**：同上

- [ ] **T4.3** worktree 模式测试：bmadPath 存在时 upgrade 仅更新 templateVersion
  - **验收**：测试通过或人工验收
  - **测试文件**：同上或 E2E

---

## 5. 验收命令

| 任务 | 验收命令 |
|------|----------|
| T1–T2 | `cd <未init目录> && npx bmad-speckit upgrade` => exit 1；`cd <已init目录> && npx bmad-speckit upgrade --dry-run` => exit 0 |
| T3 | `cd <已init目录> && npx bmad-speckit upgrade` => exit 0；检查 _bmad、bmad-speckit.json |
| T4 | `cd packages/bmad-speckit && npm test` |

<!-- AUDIT: PASSED by code-reviewer -->
