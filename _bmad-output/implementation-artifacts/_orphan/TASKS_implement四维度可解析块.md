# TASKS：Implement 阶段可解析评分块四维度完整性

**来源**：DEBATE_implement四维度可解析块_100轮.md  
**日期**：2026-03-06  
**目标**：让 implement 阶段审计报告在可解析评分块中同时包含四个维度（功能性、代码质量、测试覆盖、安全性），消除仪表盘「无数据」。

---

## 需求映射

| 需求 | 描述 | 对应任务 |
|------|------|----------|
| REQ-1 | Implement 可解析块含四维（功能性、代码质量、测试覆盖、安全性） | T1, T3 |
| REQ-2 | audit-prompts §5 引用 implement 专用可解析块规范 | T1 |
| REQ-3 | code-reviewer code 模式 prompt 可加载 implement 四维要求 | T3 |
| REQ-4 | 验证 implement 审计 prompt 包含四维要求 | T2 |
| REQ-5 | 解析与写入后 dimension_scores 四维完整 | T4 |
| REQ-6 | 文档与 §5.1 一致 | T5 |
| REQ-7 | 历史记录补跑（用户决策） | T6 |

---

## 任务列表

### T1：audit-prompts 新增 §5.1 并修正 §5 引用

| 字段 | 内容 |
|------|------|
| **描述** | 在 `skills/speckit-workflow/references/audit-prompts.md` 中新增 §5.1「Implement 阶段可解析评分块（强制）」，定义四维：功能性、代码质量、测试覆盖、安全性；将 §5 正文中对「§4.1」的引用改为「§5.1」；§5.1 须包含：总体评级 A/B/C/D、四行 `- 维度名: XX/100`（维度名与 config/code-reviewer-config.yaml modes.code.dimensions 的 name 完全一致）、禁止用描述代替、反例（可引用 §4.1） |
| **验收标准** | ① §5.1 存在且四维名为 功能性、代码质量、测试覆盖、安全性；② §5 引用 §5.1；③ §4.1 未被误改；④ 模型按 §5.1 输出的报告可被 parseDimensionScores(mode=code) 完整解析 |
| **依赖** | - |
| **产出路径** | skills/speckit-workflow/references/audit-prompts.md |

**§5.1 模板（供实施参考）**：

在 §5 标题后新增小节，内容如下。可解析块须含四行 `- 维度名: XX/100`，维度名与 config 完全一致：

```
### §5.1 Implement 阶段可解析评分块（强制）

implement 阶段审计报告必须在结尾包含以下可解析块，与 config/code-reviewer-config.yaml modes.code.dimensions 一致。禁止用描述代替。总体评级仅限 A/B/C/D。

## 可解析评分块（供 parseAndWriteScore）

总体评级: [A|B|C|D]

维度评分:
- 功能性: XX/100
- 代码质量: XX/100
- 测试覆盖: XX/100
- 安全性: XX/100
```

---

### T2：验证 implement 审计 prompt 包含 §5.1

| 字段 | 内容 |
|------|------|
| **描述** | 验证 implement 审计实际使用的 prompt 包含 §5.1 可解析块要求；覆盖 speckit-workflow §5.2 的 implement 审计与 bmad-story-assistant 阶段四实施后审计两条路径；若 prompt 组装未包含 §5 全文或 §5.1，修正对应 workflow 描述或 prompt 模板 |
| **验收标准** | ① 两条路径的 prompt 均可追溯到 §5.1 要求；② 必要时已修正 workflow 或模板 |
| **依赖** | T1 |
| **产出路径** | 若有修正：skills/speckit-workflow/SKILL.md、skills/bmad-story-assistant/SKILL.md |

---

### T3：创建 audit-prompts-code.md

| 字段 | 内容 |
|------|------|
| **描述** | 在 `skills/speckit-workflow/references/` 创建 `audit-prompts-code.md`，内容为 implement 阶段审计提示词（等效 audit-prompts §5），可解析块部分明确为 §5.1 四维格式；文件头注释说明与 audit-prompts §5 及 code-reviewer-config 的对应关系 |
| **验收标准** | ① 文件存在；② 可解析块含四维（功能性、代码质量、测试覆盖、安全性）；③ 与 config modes.code 一致 |
| **依赖** | T1 |
| **产出路径** | skills/speckit-workflow/references/audit-prompts-code.md |

---

### T4：单元/集成测试

| 字段 | 内容 |
|------|------|
| **描述** | 新增或增强 dimension-parser / parse-and-write 的单元或集成测试：对含「- 功能性: XX/100、- 代码质量: XX/100、- 测试覆盖: XX/100、- 安全性: XX/100」的 implement 报告内容运行解析，断言 dimension_scores 长度为 4 且四维名称正确；可选：端到端运行一次 implement 审计→parse-and-write-score→dashboard，验证四维非「无数据」 |
| **验收标准** | ① 单测或集成测通过；② 断言 dimension_scores 四维完整 |
| **依赖** | T1 |
| **产出路径** | scoring/parsers/__tests__/ 或 scoring/orchestrator/__tests__/ |

---

### T5：文档更新

| 字段 | 内容 |
|------|------|
| **描述** | 检查并更新 `docs/BMAD/审计报告格式与解析约定.md`（及仪表盘健康度说明等）中若有 implement 可解析块描述，使其与 §5.1 一致；若无则增加「Implement 阶段可解析块见 audit-prompts §5.1」的引用 |
| **验收标准** | ① 文档与 §5.1 一致或已引用 |
| **依赖** | T1 |
| **产出路径** | docs/BMAD/审计报告格式与解析约定.md 等 |

---

### T6：历史 implement 记录补跑（可选，用户决策）

| 字段 | 内容 |
|------|------|
| **描述** | 若需对既有 implement 记录补全四维，可 (1) 对仍有报告文件的记录，在报告末手工补四维可解析块后重新运行 parse-and-write-score；或 (2) 重新执行 implement 审计产出新报告后写入。由用户指定补跑范围 |
| **验收标准** | 用户明确指定时执行；否则跳过 |
| **依赖** | - |
| **产出路径** | scoring/data/*.json（补写） |

---

## 交付说明

- **新** implement 审计：修复后，新产生的 implement 审计报告将自动包含四维可解析块，parse-and-write-score 写入完整 dimension_scores，仪表盘四维不再显示「无数据」，**无需手工补数据**。
- **历史**记录：已写入的记录（如 dev-e9-s2-implement）需通过 T6 补跑（若用户选择）才能获得四维数据。
- **当前实现**：**未**确保不需手工补数据；本修复确保**今后**不需要。

---

## 依赖图

```
T1
├── T2
├── T3
├── T4
└── T5

T6（独立，用户决策）
```
