# TASKS: BUGFIX Banner SPECKIT 对齐不回退

## §1 问题简述

- **现象（严重回退）**：Banner 中 **SPECKIT 完全错位**，不可接受。用户反馈：虽然分隔符和 SPECKIT 之间的空格减少了，但 SPECKIT 竖线不再对齐。
- **当前实现**：`packages/bmad-speckit/src/commands/banner.js` 的 `buildBannerLines` 使用「按显示宽度计算的空格填充到第 82 列」后直接拼接 SPECKIT，**未使用** ANSI 光标定位 `\x1b[82G`。
- **历史**：BUGFIX_showBanner-powershell-kit-offset 的结论为：在 Windows PowerShell/终端中，Unicode 块体字符（█、═、║）渲染为 2 列宽，必须用 ANSI `\x1b[<col>G` 将 SPECKIT 固定到第 82 列才能保证竖线对齐。后续 TASKS_BUGFIX_banner-separator-speckit-gap 移除了 `\x1b[82G` 改为仅用空格填充，导致在用户环境下 SPECKIT 错位。

---

## §2 根因分析（为何去掉 \x1b[82G 导致错位）

1. **终端列计数与逻辑列不一致**：在用户使用的 Windows 终端（如 PowerShell ConHost 或部分环境）中，光标位置或列计数可能按**字符数（code unit/code point）**推进，或对块体字符的显示宽度与 `getRenderWidth()` 的 2 列假设不一致，导致「逻辑列」与「显示列」不同步。
2. **空格填充假设不成立**：当前实现假设「`gap` 个 ASCII 空格 + 直接拼接 SPECKIT」会使 SPECKIT 从**显示列 82** 开始。该假设依赖终端在输出前述字符后，光标恰好位于显示列 82。若终端按字符数推进或对前导 BMAD/分隔符的宽度处理与 `getRenderWidth()` 不一致，则 SPECKIT 起始列会偏离 82，出现错位。
3. **ANSI 列定位的不可替代性**：`\x1b[82G` 显式将光标移动到第 82 列，不依赖前述内容的宽度计算，是当前环境下**唯一可验证、可依赖**的保证 SPECKIT 从第 82 列起对齐的手段。去掉后即失去该保证，导致严重回退。

---

## §3 约束与不回退条件

- **禁止回退**：不得再次移除或弱化对 SPECKIT 的 ANSI 列定位（`\x1b[82G` 或 `\x1b[${speckitCol}G`）；SPECKIT 竖线必须从第 82 列起对齐；不得出现 SPECKIT 错位。
- **必须保持**：BMAD 与分隔符内容及显示正确；`buildAsciiBannerLines()`、`shouldUseAsciiFallback()`、`forceUnicode` 逻辑不变；现有 banner 相关测试除与本 BUGFIX 直接冲突的断言外均通过。
- **验收硬性条件**：每行 Unicode banner 包含 `\x1b[82G`（或等价 `\x1b[${speckitCol}G`）；`npx bmad-speckit init --help` 目视 SPECKIT 竖线从第 82 列起对齐、无错位；BMAD 与分隔符显示正确；`npm test` 中 banner 相关用例通过。

---

## §4 最终方案（明确唯一方案，无模糊词）

- **唯一方案**：在 `buildBannerLines` 的 Unicode 分支中，**恢复**对每行在 SPECKIT 前输出 ANSI 列定位序列 `\x1b[82G`（或使用已有常量 `speckitCol` 为 82 的 `\x1b[${speckitCol}G`），即每行构造为：  
  `bmad + separator + \x1b[82G + SPECKIT_LINES[i]`  
  （分隔符与 SPECKIT 之间不再依赖空格填充到 82 列，仅依赖 ANSI 定位到第 82 列。）
- **实现要点**：
  - `speckitCol` 保持为 `BMAD_MAX_RENDER_WIDTH + 1 + SEPARATOR_RENDER_WIDTH`（82）。
  - 第 3 行（i===2）使用 `SEPARATOR`，其余行使用 `SPACING`（9 个空格）；然后直接拼接 `\x1b[${speckitCol}G` 与 `SPECKIT_LINES[i]`，不再计算 `gap` 与 `padding`。
- **接受的设计**：分隔符与 SPECKIT 之间可能存在视觉空隙（因每行 BMAD 渲染宽度不同，ANSI 统一跳到 82 列），以保证竖线对齐为第一优先级。
- **禁止**：不得在 Unicode 路径中移除 `\x1b[82G`；不得再采用「仅用空格填充、不用 ANSI 定位」的实现。

---

## §5 最终任务列表

| # | 修改路径 | 位置/行号及内容要点 | 验收标准 |
|---|----------|----------------------|----------|
| 1 | `packages/bmad-speckit/src/commands/banner.js` | **buildBannerLines**（约 99–115 行）：在 Unicode 分支内，每行构造改为 `bmad + separator + \x1b[${speckitCol}G + SPECKIT_LINES[i]`。删除基于 `endCol`、`gap`、`padding` 的计算与拼接；保留 `speckitCol = BMAD_MAX_RENDER_WIDTH + 1 + SEPARATOR_RENDER_WIDTH`（82）及注释。文件头注释中明确：必须对 SPECKIT 使用 `\x1b[82G` 以保证竖线对齐，禁止移除。 | 每行输出包含 `\x1b[82G`（或 `\x1b[${speckitCol}G`）；SPECKIT 竖线从第 82 列起对齐；BMAD 与分隔符显示正确；无 SPECKIT 错位。 |
| 2 | `packages/bmad-speckit/tests/banner.test.js` | **删除或改写**「buildBannerLines() Unicode 分支无 ANSI 列定位」describe 块（约 63–72 行）：将「每行不得包含 \x1b[82G」改为**每行必须包含** `\x1b[82G`（或 `\x1b[82G` 的等价形式）的断言，确保恢复 ANSI 定位后该用例通过。 | 测试明确要求 Unicode 分支每行包含 ANSI 列定位；`npm test` 通过。 |
| 3 | `packages/bmad-speckit/tests/banner.test.js` | **删除或改写**「buildBannerLines() 无多余空格（SPECKIT 从第 82 列起）」describe 块（约 94–113 行）：当前断言为「去 ANSI 后 padding 长度等于 82 - endCol」。恢复 ANSI 后，分隔符与 SPECKIT 之间无空格填充（仅 ANSI 序列），去 ANSI 后可能无中间字符或结构不同。改为断言：每行包含 `\x1b[82G`，且 SPECKIT 内容紧接在该 ANSI 序列之后出现；或删除该 describe 块，由任务 2 与目视验收保证对齐。 | 不出现与「空格填充长度 = gap」矛盾的断言；banner 相关测试通过。 |
| 4 | `packages/bmad-speckit/src/commands/banner.js` | 在 buildBannerLines 上方或文件头注释中增加**禁止回退**说明：禁止移除对 SPECKIT 的 `\x1b[82G` 列定位，否则在部分 Windows 终端下会导致 SPECKIT 错位。 | 代码或注释中可追溯禁止回退约束。 |

**禁止表述**：任务列表中不得出现「可选」「可考虑」「后续」「酌情」「待定」。

**禁止回退验收**（必须全部满足）：
- SPECKIT 竖线从第 82 列起对齐（目视 + 测试断言每行含 `\x1b[82G`）；不得出现 SPECKIT 错位。
- BMAD 与分隔符显示正确；现有 banner 相关测试通过（含 TASK-1、TASK-2、TASK-3、TASK-6、buildAsciiBannerLines、shouldUseAsciiFallback、applyGradient 等，与任务 2、3 的修改一致）。
- `buildAsciiBannerLines()` 与 ASCII 回退、`forceUnicode` 逻辑未被修改或弱化。

---

## §6 验收命令

1. **单元测试**：在项目根或 `packages/bmad-speckit` 下执行 `npm test`（或 `node --test tests/banner.test.js`），全部通过。
2. **目视**：执行 `npx bmad-speckit init --help`，确认 banner 中 SPECKIT 竖线从第 82 列起对齐、无错位，BMAD 与分隔符正确。
3. **禁止回退**：确认已恢复对 SPECKIT 的 `\x1b[82G` 使用；未删除或弱化 BUGFIX_showBanner-ascii-art、BUGFIX_showBanner-powershell-kit-offset 相关逻辑与测试。

---

**文档版本**: 1.0  
**创建日期**: 2026-03-08  
**来源**: Party-Mode 多角色辩论（批判审计员 >70%，Winston 架构师、Amelia 开发、Quinn 测试、John 产品经理），100 轮收敛后产出。
