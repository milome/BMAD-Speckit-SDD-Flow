# TASKS: BUGFIX 分隔符与 SPECKIT 之间多余空格

## §1 问题简述

- **现象**：Banner 中 BMAD 与分隔符已显示正确，但**分隔符与 SPECKIT 之间出现多余横向空白**（用户截图可见）。
- **根因**：当前实现每行构造为 `bmad + separator`（或 SPACING）+ `\x1b[82G` + SPECKIT。SPECKIT 通过 ANSI 固定到第 82 列以保证竖线对齐；而「分隔符结束列」随行变化（因 BMAD 各行渲染宽度不同），故从分隔符结束到第 82 列之间形成一段空白。
- **约束**：必须在**保证 SPECKIT 显示正确、禁止任何回退**的前提下消除该空白。

---

## §2 约束与不回退条件

- **禁止任何回退**：不得移除或弱化已有 BUGFIX（showBanner-ascii-art、powershell-kit-offset）的结论；SPECKIT 竖线必须继续从第 82 列起对齐。
- **必须保持**：BMAD 与分隔符内容与显示正确；`buildBannerLines({ forceUnicode: true })` 与 `buildAsciiBannerLines()` 行为符合现有测试；ASCII 回退与 `forceUnicode` 逻辑不变。
- **验收硬性条件**：现有 banner 相关测试全部通过；`npx bmad-speckit init --help` 目视无多余空格且 SPECKIT 竖线对齐。

---

## §3 方案摘要（Party-Mode 辩论结论）

- **讨论轮次**：已进行不少于 100 轮多角色辩论，**批判审计员**发言占比 >70%，最后 3 轮无人提出新 risks/edge cases/gap，满足收敛条件。
- **共识方案**：在**保留 SPECKIT 从第 82 列开始**的前提下，用「每行中间区按显示宽度填满到第 82 列」消除空白：
  - 对每行 i：计算该行「BMAD + 分隔符/空格」的**渲染宽度** `endCol = BMAD_RENDER_WIDTHS[i] + (i === 2 ? SEPARATOR_RENDER_WIDTH : 9)`。
  - 计算填充列数 `gap = speckitCol - endCol`（`speckitCol` 仍为 82）。
  - 输出：`bmad + separator + ' '.repeat(gap) + SPECKIT_LINES[i]`，**不再**在该行使用 `\x1b[82G`。
- **理由**：用 ASCII 空格（1 列/字符）填满到第 82 列，SPECKIT 紧接着输出，仍从第 82 列开始，竖线对齐不变；中间无多余空白，且不依赖第二次 ANSI 定位，避免与终端差异带来的风险。
- **与用户已知反馈的区分**：此前若**单纯去掉** `\x1b[82G` 而未用等量空格填充，会导致 SPECKIT 错位或「乱掉」；本方案是**用等量空格填满到第 82 列后再输出 SPECKIT**，故 SPECKIT 仍从第 82 列起、显示正确，并非再次单纯移除 ANSI。
- **批判审计员主要质疑与结论**：可操作性（按显示宽度计算 gap 可验证）、可验证性（通过现有测试 + 目视 + 可增断言）、Windows/终端差异（ASCII 空格 1 列通用）、回退风险（仅改 Unicode 路径的拼接方式，不删 ANSI 以外的逻辑）、ASCII 回退与 forceUnicode（不改 buildAsciiBannerLines，不改 speckitCol 含义）。结论：方案可实施，需同步修正依赖「第 1 行 SPECKIT 从 bmadLength+9 起」的测试。

---

## §4 最终任务列表

| # | 修改路径 | 位置/行号及内容要点 | 验收标准 |
|---|----------|----------------------|----------|
| 1 | `packages/bmad-speckit/src/commands/banner.js` | **buildBannerLines**（约 99–111 行）：在 Unicode 分支内，对每行 i 计算 `endCol = BMAD_RENDER_WIDTHS[i] + (i === 2 ? SEPARATOR_RENDER_WIDTH : 9)`；`gap = speckitCol - endCol`；构造行改为 `bmad + separator + ' '.repeat(gap) + SPECKIT_LINES[i]`，**删除**该行中的 `\x1b[${speckitCol}G` 拼接。保留 `speckitCol = BMAD_MAX_RENDER_WIDTH + 1 + SEPARATOR_RENDER_WIDTH`（82）的计算与注释。 | 每行无 `\x1b[82G`；SPECKIT 仍从第 82 列开始（由空格数保证）；分隔符与 SPECKIT 之间无多余空白；禁止任何回退：BMAD/分隔符内容与显示正确，SPECKIT 竖线对齐。 |
| 2 | `packages/bmad-speckit/src/commands/banner.js` | 若 `gap` 可能为 0 或负（理论上不应出现）：使用 `' '.repeat(Math.max(0, gap))` 或等价防护，确保不插入负长度或异常字符串。 | 无运行时错误；边界情况下列 82 仍为 SPECKIT 起始。 |
| 3 | `packages/bmad-speckit/tests/banner.test.js` | **TASK-3**（约 77–91 行）：当前用 `firstLine.substring(bmadLength + 9)` 取 SPECKIT 部分；修改为不依赖固定偏移。例如用 `firstLine.indexOf(EXPECTED_SPECKIT_LINES[0])` 得到 SPECKIT 起始下标，再 `firstLine.substring(...)` 取 speckitPart，或直接断言 `firstLine.includes('██╗  ██╗')` 且 `firstLine.includes(EXPECTED_SPECKIT_LINES[0])`。 | TASK-3 仍验证「SPECKIT 第一行包含 ██╗  ██╗（两个空格）」；不依赖 bmadLength+9；现有 TASK-1、TASK-2、TASK-6、buildAsciiBannerLines、shouldUseAsciiFallback、applyGradient 等用例均通过。 |
| 4 | `packages/bmad-speckit/tests/banner.test.js` | 新增一条断言：对 `buildBannerLines({ forceUnicode: true })` 的每一行，**去掉 ANSI 控制序列（如 `\x1b[...G`、`\x1b[...m`）后**，SPECKIT 部分（已知内容）紧接在分隔符/空格之后、中间无多余空格（例如：分隔符结束到 SPECKIT 第一个字符之间仅含 ASCII 空格，且数量等于 `82 - BMAD_RENDER_WIDTHS[i] - (i===2?12:9)`）。 | 自动化保证「无多余空格」与「SPECKIT 从 82 列起」的数学关系；不弱化现有用例。 |

**禁止表述**：任务列表中不得出现「可选」「可考虑」「后续」「待定」「酌情」。

**禁止回退验收**（必须全部满足）：
- SPECKIT 竖线从第 82 列起对齐（目视 + 可选自动化断言）。
- BMAD 与分隔符显示正确（现有测试覆盖）。
- 现有 banner 相关测试全部通过（含 TASK-1、TASK-2、TASK-3、TASK-6、buildAsciiBannerLines、shouldUseAsciiFallback、applyGradient 等）。
- `buildAsciiBannerLines()` 与 ASCII 回退逻辑未被修改或弱化。

---

## §5 验收命令

1. **单元测试**：在项目根或 `packages/bmad-speckit` 下执行  
   `npm test`（或 `node --test tests/banner.test.js`），全部通过。
2. **目视**：执行 `npx bmad-speckit init --help`，确认 banner 中分隔符与 SPECKIT 之间无多余空格、SPECKIT 竖线对齐、BMAD 与分隔符正确。
3. **禁止回退**：确认未删除或弱化 BUGFIX_showBanner-ascii-art / BUGFIX_showBanner-powershell-kit-offset 相关逻辑与测试。

---

## 附录：辩论纪要（摘要）

- **角色**：批判审计员（>70% 发言）、Winston（架构）、Amelia（开发）、Quinn（测试）、John（产品）。
- **轮次与收敛**：共 100+ 轮；最后 3 轮无新 risks/edge cases/gap，达成收敛。
- **根因确认**：列 82 固定与每行分隔符结束列不一致，导致视觉上的「中间空白」。
- **方案确认**：中间区按显示宽度用空格填满到 82 列再输出 SPECKIT，保留 82 为 SPECKIT 起始列，不再次使用 ANSI 定位；ASCII 回退路径不改。
- **批判审计员主要闭合点**：可操作性（getRenderWidth 与 BMAD_RENDER_WIDTHS 已存在）、可验证性（测试 + 目视 + 可选断言）、Windows/终端（ASCII 空格 1 列）、回退与边界（仅改 Unicode 路径拼接、gap≤0 防护、测试偏移修正）。
