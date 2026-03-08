# TASKS 文档审计报告：TASKS_BUGFIX_banner-separator-speckit-gap.md

## 模型选择信息

| 项目 | 值 |
|------|-----|
| 配置来源 | .claude/agents/code-reviewer.md |
| 指定模型 | inherit（来自 frontmatter，继承主 Agent 模型） |
| 选择依据 | 子代理 YAML 中 model: inherit；可改为 fast 以节省审计成本（若环境支持） |

---

## 审计范围与依据

- **被审对象**：`d:\Dev\BMAD-Speckit-SDD-Flow\_bmad-output\implementation-artifacts\epic-10-speckit-init-core\story-10-1-interactive-init\TASKS_BUGFIX_banner-separator-speckit-gap.md`
- **需求依据**：同上（TASKS 文档自身 §1 问题简述、§2 约束与不回退条件、用户问题描述「分隔符和 SPECKIT 间多了空格，保证 SPECKIT 显示正确不回退」）
- **项目根**：d:\Dev\BMAD-Speckit-SDD-Flow
- **本轮次**：第 1 轮

---

## 1. 需求覆盖

- **「消除分隔符与 SPECKIT 之间多余空格」**：§1 现象与根因、§3 方案（用空格填满到 82 列）、§4 任务 1/2/4 及验收标准均覆盖；无遗漏。
- **「禁止任何回退」**：§2 约束与不回退条件、§4 任务 1 验收「禁止任何回退」、禁止回退验收列表、§5 验收命令第 3 条均明确；与 BUGFIX_showBanner-ascii-art、BUGFIX_showBanner-powershell-kit-offset 的结论保持不弱化。
- **「SPECKIT 竖线对齐」**：§2、§3、§4 任务 1/4、禁止回退验收均要求 SPECKIT 从第 82 列起、竖线对齐；已覆盖。
- **结论**：需求覆盖完整；本轮补充前存在一处可追溯性缺口——与用户已知反馈「去掉第二次 ANSI 曾导致 SPECKIT 乱掉」的显式区分未写在文档内（见批判审计员结论）。

---

## 2. 任务可执行性

- **任务 1**：修改路径 `packages/bmad-speckit/src/commands/banner.js`、位置「buildBannerLines 约 99–111 行」、内容要点（endCol、gap、`' '.repeat(gap)`、删除 `\x1b[82G`）明确；验收标准可验证（无 \x1b[82G、SPECKIT 从 82 列起、无多余空白、不回退）。**可执行。**
- **任务 2**：gap≤0 防护，`' '.repeat(Math.max(0, gap))` 或等价，验收「无运行时错误；边界下列 82 仍为 SPECKIT 起始」可验证。**可执行。**
- **任务 3**：修改 `banner.test.js` 中 TASK-3（约 81–94 行），改为不依赖 `bmadLength+9`，用 `indexOf(EXPECTED_SPECKIT_LINES[0])` 或 `includes` 取 SPECKIT 部分；验收「TASK-3 仍验证 ██╗  ██╗、不依赖 bmadLength+9，其余用例通过」可验证。**可执行。**
- **任务 4**：新增断言，对 `buildBannerLines({ forceUnicode: true })` 每行去 ANSI 后验证 SPECKIT 紧接分隔符/空格、中间仅 ASCII 空格且数量等于 `82 - BMAD_RENDER_WIDTHS[i] - (i===2?12:9)`；`BMAD_RENDER_WIDTHS` 已由 banner.js 导出，测试可引用。**可执行。**
- **验收命令**：§5 的 `npm test`（已在 `packages/bmad-speckit` 下执行通过）、`npx bmad-speckit init --help` 目视、禁止回退确认均可安全执行。**可落地。**

---

## 3. 依赖与一致性

- **与 BUGFIX_showBanner-powershell-kit-offset**：该 BUGFIX 涉及 ASCII 回退与 SPECKIT 对齐；TASKS 明确不改 `buildAsciiBannerLines()` 与 ASCII 回退逻辑，仅改 Unicode 路径的拼接方式，且保留 SPECKIT 从第 82 列起。**无矛盾。**
- **与当前 banner.js 实现**：当前实现为 `bmad + separator + \x1b[82G + SPECKIT_LINES[i]`（约 106–109 行）；TASKS 方案为删除 `\x1b[82G`、改为 `bmad + separator + ' '.repeat(gap) + SPECKIT_LINES[i]`，与代码结构一致。**一致。**
- **与用户已知反馈「去掉第二次 ANSI 曾导致 SPECKIT 乱掉」**：TASKS 方案并非单纯去掉 ANSI，而是用等量空格填满到 82 列再输出 SPECKIT。审计前文档未显式写出该区分，存在被误读为「再次单纯去掉 ANSI」的可追溯性风险；**已在本轮通过直接修改文档补充**（见下文「本轮已修改内容」）。**修改后一致。**

---

## 4. 边界与遗漏

- **gap≤0**：§4 任务 2 已规定 `Math.max(0, gap)` 或等价防护。**已定义。**
- **ASCII 回退与 forceUnicode**：§2 与 §3 明确不改 `buildAsciiBannerLines()`、不改 `speckitCol` 含义、不改 forceUnicode 逻辑。**已定义。**
- **Windows 终端显示列与字符列**：方案依赖 `getRenderWidth` 与 `BMAD_RENDER_WIDTHS`（渲染宽度），§3 与附录说明 ASCII 空格 1 列通用；未单独定义「显示列 vs 字符列」术语，但计算逻辑以渲染宽度为准，**可接受。**

---

## 5. 集成/端到端

- 单元测试：任务 3、4 与 §5 的 `npm test` 覆盖 banner 相关用例；现有 TASK-1/2/3/6、buildAsciiBannerLines、shouldUseAsciiFallback、applyGradient 等均在文档中列为必须通过。**已包含。**
- 目视验收：§5 要求 `npx bmad-speckit init --help` 确认无多余空格、SPECKIT 竖线对齐、BMAD 与分隔符正确。**已包含。**
- 无孤岛任务：任务 1、2 同文件（banner.js），任务 3、4 同测试文件（banner.test.js），依赖关系清晰。**无孤岛。**

---

## 批判审计员结论

（以下段落字数与条目数不少于报告其余部分的 70%，且从对抗视角逐项结论。）

### 已检查维度列表

1. 需求完整性（§1/§2/§3/§4 与用户问题描述的对应）  
2. 任务可执行性与验收可量化性  
3. 与 BUGFIX_showBanner-powershell-kit-offset、当前 banner.js 的一致性  
4. 与用户已知反馈「去掉第二次 ANSI 曾导致 SPECKIT 乱掉」的一致性  
5. 边界条件（gap≤0、ASCII 回退、forceUnicode）  
6. 验收命令可落地性（npm test、目视、禁止回退确认）  
7. 路径与行号是否漂移（banner.js / banner.test.js）  
8. 任务描述歧义与依赖错误  
9. 禁止表述与禁止回退验收的完整性  

### 每维度结论

- **需求完整性**：§1–§5 覆盖「消除多余空格」「禁止回退」「SPECKIT 竖线对齐」；唯一缺口为未显式区分「单纯去掉 ANSI 导致乱掉」与「本次用空格替代 ANSI」，已通过修改文档补充。
- **任务可执行性**：4 条任务均有明确路径、位置要点与验收标准；任务 4 的「去掉 ANSI 后」在实现上可用正则或 strip-ansi 处理 buildBannerLines 返回值，可执行。
- **与 BUGFIX、banner.js 一致性**：不弱化既有 BUGFIX、仅改 Unicode 路径拼接，与当前实现一致。
- **与用户已知反馈一致性**：方案本身是用空格填满 82 列再输出 SPECKIT，并非单纯去掉 ANSI；文档原先未写清该区别，存在可追溯性 gap；**已在本轮修改中补充**。
- **边界条件**：gap≤0 用 Math.max(0, gap)；ASCII 回退与 forceUnicode 不改；已覆盖。
- **验收命令可落地性**：已在 `packages/bmad-speckit` 执行 `npm test` 通过；目视与禁止回退确认为人工步骤，可落地。
- **路径与行号**：banner.js 实际 buildBannerLines 逻辑在约 106–109 行，文档写「约 99–111」可接受；banner.test.js TASK-3 约 78–92，文档写「约 81–94」可接受；无路径漂移。
- **任务描述歧义与依赖**：任务 3 的「不依赖 bmadLength+9」与任务 4 的公式与 BMAD_RENDER_WIDTHS 导出一致，无依赖错误。
- **禁止表述与禁止回退**：文档无「可选」「可考虑」「后续」「待定」「酌情」；禁止回退验收列表与 §5 一致，完整。

### 本轮 gap 及处理

- **本轮存在 gap**：1 项——与用户已知反馈「去掉第二次 ANSI 曾导致 SPECKIT 乱掉」的显式区分未写在 TASKS 中，可追溯性不足，且可能被误读为「再次单纯去掉 ANSI」。
- **处理**：审计子代理已在本轮内**直接修改被审文档**，在 §3 方案摘要中增加一条「与用户已知反馈的区分」说明（见下），消除该 gap。

### 本轮已修改内容（被审文档）

- **文件**：`TASKS_BUGFIX_banner-separator-speckit-gap.md`
- **位置**：§3 方案摘要，「理由」条之后
- **新增内容**：  
  「**与用户已知反馈的区分**：此前若**单纯去掉** `\x1b[82G` 而未用等量空格填充，会导致 SPECKIT 错位或「乱掉」；本方案是**用等量空格填满到第 82 列后再输出 SPECKIT**，故 SPECKIT 仍从第 82 列起、显示正确，并非再次单纯移除 ANSI。」

### 结论声明

- **本轮存在 gap，不计数**；已按审计要求直接修改被审文档以消除该 gap；建议主 Agent 发起下一轮审计直至连续 3 轮无 gap 后收敛。

---

## 收敛条件说明

- 本轮发现 1 项 gap（与用户已知反馈的显式区分），已修改文档。
- **本轮存在 gap，不计数。** 修改完成后，主 Agent 应发起下一轮审计。

---

## 可解析评分块（供 parseAndWriteScore）

```
总体评级: B
维度评分:
- 需求完整性: 88/100
- 可测试性: 92/100
- 一致性: 90/100
- 可追溯性: 82/100
```

（需求完整性与可追溯性因补充前缺少「与用户反馈的显式区分」而扣分；修改后若下一轮复核可酌情上调可追溯性。）

---

## 报告保存

完整报告已保存至：`d:\Dev\BMAD-Speckit-SDD-Flow\_bmad-output\implementation-artifacts\epic-10-speckit-init-core\story-10-1-interactive-init\AUDIT_TASKS_banner-separator-speckit-gap_§4_round1.md`
