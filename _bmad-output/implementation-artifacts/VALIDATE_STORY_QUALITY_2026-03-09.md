# Story 上下文质量检查报告

**检查日期**: 2026-03-09  
**依据**: create-story checklist（`_bmad/bmm/workflows/4-implementation/create-story/checklist.md`）  
**范围**: sprint-status 中 ready-for-dev 的 Story（12-1、12-2、12-3、13-1）

---

## 检查结果摘要

| Story | 关键问题 | 增强建议 | 优化建议 | LLM 优化 |
|-------|----------|----------|----------|----------|
| 12-1-ai-registry | 1 | 2 | 1 | 2 |
| 12-2-reference-integrity | 0 | 1 | 1 | 1 |
| 12-3-skill-publish | 0 | 1 | 0 | 1 |
| 13-1-check-version | 1 | 1 | 0 | 1 |

---

## Story 12-1: AI Registry

### 关键问题（须修复）

1. **ai-builtin 扩展策略未定**
   - **现象**：Dev Notes 写「保留 ai-builtin 为简化列表、或新建 ai-registry-builtin 存完整 configTemplate，由 AIRegistry 统一暴露」，而 T2.1 写「扩展 ai-builtin 为完整 configTemplate」。
   - **后果**：开发容易在「扩展现有文件」和「新建文件」之间摇摆，导致重复实现或错误选型。
   - **建议**：在 Story 中明确选用其一并给出理由。建议采用「新建 ai-registry-builtin.js」以避免污染 Story 10.1 的简单结构，并在 T2.1 中改为「新建 `src/constants/ai-registry-builtin.js`，定义 19+ AI 的完整 configTemplate」。

2. **subagentSupport 映射表未内联**
   - **现象**：AC-2.8 与 T2.3 要求按 PRD §5.12.1 填充 subagentSupport，但 Story 未提供具体映射。
   - **后果**：开发必须翻 PRD，易遗漏或填错。
   - **建议**：在 Story 的 References 或本 Story 范围下增加「subagentSupport 映射表（来自 PRD §5.12.1）」，列出 native/mcp/limited/none 与各 AI 的对应关系。

### 增强建议（建议补充）

1. **configTemplate 深度合并规则**
   - 在 AC-5.4 或 Dev Notes 中补充：项目级覆盖全局时，configTemplate 的合并策略（同名字段覆盖 vs 深度 merge 子对象）。PRD/ARCH 未明确，易引起实现差异。

2. **init.js 与 check 的调用点**
   - T5.1 写「将 AIRegistry 接入 init.js 的 AI 选择逻辑」，建议明确：init 在解析 `--ai`、交互选择前调用 `load({ cwd })`；check 在 `--list-ai`、结构验证前调用。减少开发者猜测。

### 优化建议（可选）

1. **22 项 vs 19+ 表述统一**
   - AC-2.6 写「22 项」，PRD 写「19+」；实际 PRD §5.12 表为 22 项。建议 Story 统一为「22 项（与 PRD §5.12 表一致）」。

### LLM 优化

1. **核心路径摘要**
   - 在 Story 顶部「本 Story 范围」之前增加 3–5 句摘要，便于 LLM 快速把握：AIRegistry 模块、19+ configTemplate 扩展、registry 文件优先级、generic 校验、与 init/check 的集成点。

2. **任务执行顺序**
   - T1–T5 已有序，但 T5.1 依赖 T1、T2 完成。建议在 T5 下注明「T5.1 须在 T1、T2 完成后执行」。

---

## Story 12-2: 引用完整性

### 增强建议

1. **源路径解析优先级**
   - 本 Story 范围写「源路径由 E10.5 的 bmadPath 或默认 _bmad 决定」，建议明确：先读 `bmad-speckit.json` 的 `bmadPath`，有则用该路径；否则用 `{projectRoot}/_bmad`。避免与 Story 10.5 的约定不一致。

### 优化建议

1. **vscodeSettings 合并策略**
   - AC-2.3 写「冲突时以 configTemplate 为准或按合并策略」，表述模糊。建议明确：深度合并，configTemplate 的键覆盖现有；或顶层键冲突时 configTemplate 优先。

### LLM 优化

1. **目标目录一览**
   - 在「本 Story 范围」下增加表格：selectedAI → 目标根目录（如 cursor-agent→.cursor、opencode→.opencode），便于 LLM 快速定位关键映射。

---

## Story 12-3: Skill 发布

### 增强建议

1. **无子代理支持 AI 的处理**
   - Epics 写「无子代理支持 AI 时 init/check 输出提示」，建议在 AC 中增加：当 configTemplate.subagentSupport 为 `none` 时，init 完成时 stdout 输出「该 AI 不支持子代理，skills 未发布」；check 同理。

### LLM 优化

1. **与 12-2 的区分**
   - 在 Story 开头用 1–2 句区分：12-2 负责 commands/rules/config 同步；12-3 负责 skills 从 _bmad/skills 同步到 configTemplate.skillsDir。避免混淆。

---

## Story 13-1: check 与 version

### 关键问题

1. **无 selectedAI 时的验证行为**
   - Epics 写「无 selectedAI 时跳过 AI 目标目录验证或验证 .cursor 向后兼容」，12-2 AC-3.7 同理。13-1 需明确选择：跳过 或 验证 .cursor。建议采用「跳过」，并在 AC 中写明。

### 增强建议

1. **version 子命令输出格式**
   - Epics 仅提 `version` 与 `--json`，未定义非 JSON 时的输出格式。建议在 AC 中增加：无 `--json` 时输出人类可读格式（CLI 版本、模板版本、Node 版本，分行显示）。

### LLM 优化

1. **check 验证项清单**
   - 在「本 Story 范围」下用列表列出 check 必验证项：_bmad 存在、bmadPath（若有）、_bmad-output/config、selectedAI 对应目标目录、AI 工具检测（若未 --ignore-agent-tools）。便于实现时逐项对照。

---

## 改进选项

**请选择要应用的改进：**

- **all** — 应用上述全部分析
- **critical** — 仅应用关键问题（12-1 两项、13-1 一项）
- **select** — 指定编号（如 12-1 关键 1、12-1 增强 1）
- **none** — 保持现状
- **details** — 查看某项的详细说明

**下一步**：选择后，Agent 将把选定改进合并进对应 Story 文件；若无选择，可运行 `dev-story` 按当前 Story 实施，并在开发中自行参考本报告。
