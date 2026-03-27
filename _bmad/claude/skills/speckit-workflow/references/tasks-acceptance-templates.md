# Tasks 验收与执行模板（固定模板，可复制）

从 `tasks-template.md` 提炼的可复用模板：Agent 执行规则、需求追溯格式、验收标准必备要素、验收执行规则。生成或维护 tasks.md 时可直接复制到文档中使用。

---

## 1. Agent 执行规则（块）

完整规则见 [references/qa-agent-rules.md](qa-agent-rules.md)。以下为可嵌入 tasks.md 的简短块：

```markdown
## Agent 执行规则

**禁止事项**:
1. ❌ 禁止在任务描述中添加「注: 将在后续迭代...」
2. ❌ 禁止标记任务完成但功能未实际调用
3. ❌ 禁止仅初始化对象而不在关键路径中使用
4. ❌ 禁止用「预留」「占位」等词规避实现

**必须事项**:
1. ✅ 集成任务必须修改生产代码路径
2. ✅ 必须运行验证命令确认功能启用
3. ✅ 遇到无法完成的情况，应报告阻塞而非自行延迟
4. ✅ 功能/数据路径相关任务实施前必须先检索并阅读需求文档相关章节（见 §9 需求追溯与闭环）
5. ✅ 需求追溯（实施前必填）：问题关键词、检索范围、相关章节、既有约定摘要、方案是否与需求一致
```

---

## 2. 需求追溯（实施前必填）字段模板

每个任务实施前须填写以下块，可直接复制到任务描述中：

```markdown
- **需求追溯（实施前必填）**
  - **问题关键词**: （如 SimpleHeader、共享内存、revision）
  - **检索范围**: （如 specs/015-indicator-system-refactor/指标系统重构需求分析文档_v1.md）
  - **相关章节**: （如 §7, §8, §16）
  - **既有约定摘要**: （如 count, revision；单写入者无 Seqlock）
  - **方案是否与需求一致**: 是 / 否（若否，说明原因）
```

---

## 3. 验收标准必备要素：生产代码实现

验收时每条 Gap **必须**在对应行中写明以下子项，可直接用下表作为说明块：

```markdown
#### 1. 生产代码实现（必须逐项列出）

验收时**必须**在对应 Gap 行中写明：

| 子项 | 必须列出的内容 | 示例 |
|------|----------------|------|
| **文件路径** | 修改/新增的生产代码文件（绝对或相对路径） | `vnpy/datafeed/hot_data_source.py`、`vnpy/datafeed/indicator_worker.py` |
| **类名** | 实现该 Gap 的具体类 | `GlobalDataSource`、`SharedTimeframeDataStore`、`SmartBarDataLoader` |
| **方法名** | 关键方法（含签名或行为说明） | `initialize(create=True)`、`update_bar(bar, is_realtime)`、`get_or_create_store(...)`、`load_bars(...)`、`submit_calculation(...)` |
| **代码实现细节** | 调用链、关键逻辑、grep 可定位特征 | 谁在何时调用谁；数据如何写入共享区；Worker 如何从视图读；`grep -n "write_bars\|get_view" 文件` 可定位 |
```

---

## 4. 验收标准必备要素：集成测试

验收时每条 Gap **必须**在对应行中写明并在验收时执行，可直接用下表作为说明块：

```markdown
#### 2. 集成测试（必须逐项列出并填写执行情况）

验收时**必须**在对应 Gap 行中写明并在验收时执行：

| 子项 | 必须列出的内容 | 示例 |
|------|----------------|------|
| **测试文件路径** | 集成测试所在文件 | `tests/test_hot_data_source_integration.py`、`tests/test_gds_load_and_worker_integration.py` |
| **测试用例名** | 具体用例函数名（可多个） | `test_global_data_source_singleton`、`test_load_1min_writes_to_gds`、`test_worker_reads_from_ringbuffer_view` |
| **执行命令** | 完整可执行命令 | `pytest tests/test_hot_data_source_integration.py -v`、`pytest tests/ -k "gds or ringbuffer" -v` |
| **预期结果** | 用例通过条件 | 上述用例全部 PASSED、无 FAILED |
| **执行情况** | 验收时**必填** | `[ ] 待执行` / `[x] 通过` / `[ ] 失败（注明原因）`；未执行或失败不得勾选「验证通过」 |
```

---

## 5. 验收执行规则（块）

可直接复制到 tasks.md 的「验收执行规则」小节：

```markdown
#### 验收执行规则

- **生产代码**：逐条核对「文件 / 类 / 方法 / 实现细节」是否与表中描述一致；可通过 grep、阅读源码确认。
- **集成测试**：必须运行表中「执行命令」，根据实际结果填写「执行情况」；未运行或失败则不得在「验证通过」列打勾。
- **lint（必须）**：项目须按其所用技术栈配置并执行对应的 Lint 工具（见 lint-requirement-matrix.md）；验收前须执行且无错误、无警告。若项目使用主流语言但未配置该语言的 Lint 工具，须作为重要质量问题修复，审计不予通过。禁止以「与本次任务不相关」为由豁免。
- **验证通过**：仅当「生产代码实现」「集成测试」及「lint」均满足，且执行情况为「通过」时，方可在「验证通过」列勾选 `[x]`。
- **阻塞处理**：若某条 Gap 因依赖或平台限制无法完全满足，须在任务中**报告阻塞**并注明原因，不得勾选「验证通过」。

下表「生产代码实现要点」与「集成测试要求」列给出每条 Gap 的上述必备要素；验收时需逐条核对、执行测试并填写「执行情况」列。
```

---

## 6. 验收执行说明（简短版，用于文档末尾）

```markdown
### 验收执行说明

- **生产代码（必须列出）**：验收时逐条核对「生产代码实现要点」——**文件路径**、**类名**、**方法名**、**代码实现细节**（调用链、关键逻辑、grep 可定位特征）是否在表中写明且与源码一致；可通过 grep、阅读源码确认。
- **集成测试（必须列出并执行）**：每条 Gap 的「集成测试要求」须写明**测试文件路径**、**测试用例名**、**执行命令**、**预期结果**；验收时必须运行表中「执行命令」，并在「执行情况」列填写：`[ ] 待执行` / `[x] 通过` / `[ ] 失败（注明原因）`；未执行或失败不得勾选「验证通过」。
- **lint（必须）**：项目须按技术栈配置并执行 Lint（见 lint-requirement-matrix）；若使用主流语言但未配置 Lint 须修复；已配置的须执行且无错误、无警告。禁止以「与本次任务不相关」豁免。
- **验证通过**：仅当「生产代码实现」「集成测试」及「lint」均满足，且「执行情况」为通过时，方可在「验证通过」列打勾 `[x]`。
- **阻塞处理**：若某条 Gap 因依赖或平台限制无法完全满足，须在任务中**报告阻塞**并注明原因，不得将「验证通过」勾选为完成。
```

---

## 7. Gaps ↔ 任务覆盖核对规则（块）

用于「Gaps → 任务映射完整清单」开头的核对规则说明：

```markdown
**核对规则**：IMPLEMENTATION_GAPS.md（或 IMPLEMENTATION_GAPS_Vx.md）中出现的**每一条** Gap 必须在本任务表中出现且对应到任务 Txxxx–Txxxx；不得遗漏。
```

```markdown
**结论**：本任务列表与 IMPLEMENTATION_GAPS_xx.md **一一对应**；按章节 N 条 Gap + 四类汇总 M 条 Gap 均在上述两表中出现并映射到任务 Txxxx–Txxxx，**无遗漏**。验收时以「按需求文档章节」表与「四类汇总」表为准逐条执行。
```

---

## 8. Runnable Slice 元数据模板（每个 Journey Slice 必填）

```markdown
### Journey Slice 元数据

- **Journey ID**: `J01`
- **Invariant ID**: `INV-01` / `INV-N/A`（若为 N/A，必须写原因）
- **Evidence Type**: `unit` / `integration` / `smoke-e2e` / `full-e2e` / `closure-note`
- **Verification Command**: `[完整命令]`
- **Closure Note Path**: `closure-notes/J01.md`
- **Definition Gap IDs**: `DG-01` / `N/A`
- **Implementation Gap IDs**: `IG-01` / `N/A`
```

**要求**：
- 每个 runnable slice 都必须写全上述字段。
- `Evidence Type` 不能留空；若一个 slice 有多个证据层，需逐条列出。
- `Closure Note Path` 为空时，不得宣称 Journey 完成。

---

## 9. Journey 验收模板（证明完成 + 收口）

```markdown
### Journey 验收

| Journey ID | 对应任务 | 哪条测试证明完成 | Verification Command | Closure Note | Gap 类型 |
|------------|----------|------------------|----------------------|--------------|----------|
| J01 | T021, T022, T023 | `tests/e2e/smoke/test_checkout.py::test_checkout_smoke` | `pytest tests/e2e/smoke/test_checkout.py -v` | `closure-notes/J01.md` | Implementation Gap |
| J02 | T024, T025 | `N/A`（当前仍是定义澄清） | `N/A` | `closure-notes/J02.md`（标记 deferred） | Definition Gap |
```

**要求**：
- 验收必须明确写出“由哪条测试证明完成”，不能只写“已覆盖测试”。
- 验收必须明确写出“由哪条 closure note 收口”，不能只写“已记录”。
- 若当前任务只是在消除 `definition gap`，必须明确标注为 `Definition Gap`，禁止借此宣称功能已可跑通。
- 若当前任务是在修复代码或接线问题，标注为 `Implementation Gap`，并给出真实验证命令。
