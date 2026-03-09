# Story 12.1 AI Registry 实施后审计报告（§5 第二轮）

**审计对象**：d:/Dev/BMAD-Speckit-SDD-Flow 下 Story 12-1 实现（含 GAP-R2 修复）  
**审计依据**：audit-prompts.md §5、12-1-ai-registry.md、spec-E12-S1.md、tasks-E12-S1.md、AUDIT_Story_12-1_stage4.md（第一轮）  
**审计时间**：2026-03-09  
**审计模式**：audit-post-impl-rules strict，第二轮验证；连续 3 轮无 gap 才收敛

---

## 1. 逐项审查结果（对抗视角）

### （1）需求覆盖

| AC | 场景要点 | 实现位置 | 对抗核查 | 结论 |
|----|----------|----------|----------|------|
| AC-1 | 全局/项目 registry 路径、优先级、缺失/无效 | ai-registry.js getGlobalRegistryPath、readRegistryFile、mergeByPriority | 路径硬编码 `_bmad-output/config`；若 PRD 变更则需改代码。已用 path.join、os.homedir()，跨平台满足。 | ✅ |
| AC-2 | 22 项 configTemplate、spec-kit 对齐、subagentSupport | ai-registry-builtin.js | **批判审计员**：逐条对照 spec §4.3 表，gemini 无 rulesDir（spec 为 —），auggie 仅 rulesDir，cody 仅 configDir，tabnine 仅 skillsDir。builtin 不经 validateConfigTemplate，故 cody/tabnine 的「commandsDir 或 rulesDir 至少其一」约束不适用于内置，设计正确。opencode/.opencode/command、auggie/.augment/rules、bob/.bob/commands、shai/.shai/commands、codex/.codex/commands 与 spec 一致。 | ✅ |
| AC-3 | 两种格式、configTemplate 必填、条件约束 | parseRegistryFile、validateConfigTemplate | 用户/项目自定义 AI 无 configTemplate 时 throw；违反 commandsDir/rulesDir 至少其一、agentsDir/configDir 二选一时 throw。agentsDir/configDir 二选一校验存在。 | ✅ |
| AC-4 | generic 无 aiCommandsDir → exit 2；init/check 任一子命令适用 | resolveGenericAiCommandsDir；runNonInteractiveFlow、runWorktreeFlow、**runInteractiveFlow** | **批判审计员**：spec §5 表末行「init/check 任一子命令」——check 当前无 `--ai` 参数，仅 `--list-ai`。generic 校验仅 init 三 flow 适用。check 未来若由 Story 13.1 引入 `--ai` 或按 bmad-speckit.json 的 selectedAI 校验，则需补充。**本 Story 范围内**：init 三 flow 已全覆盖，check 无 --ai 属设计现状，非本 Story gap。 | ✅ |
| AC-5 | load、getById、listIds、合并逻辑 | ai-registry.js | 合并逻辑 project > global > builtin；configTemplate 深度合并为逐字段覆盖（非嵌套深度），对 configTemplate 字符串字段足够。 | ✅ |

### （2）集成测试与端到端功能测试

| 审查项 | 依据 | 对抗核查 | 结论 |
|--------|------|----------|------|
| 集成测试已执行 | plan §5.2 | **批判审计员**：第二轮实际执行 `node --test tests/ai-registry.test.js tests/ai-registry-builtin.test.js tests/ai-registry-integration.test.js tests/init-interactive-generic.test.js` → **28 用例全部通过**。T4.1 generic 无 dir exit 2、T4.1 有 --ai-commands-dir 通过、T5.1 check --list-ai 输出 22 项均验证。 | ✅ |
| E2E 功能测试 | plan §5.3 | init-interactive-generic.test.js 用例 2（E2E Unix script）：**Windows 下静默 return 跳过**，不执行 E2E。第一轮已接受此设计。对抗核查：runNonInteractiveFlow 的 integration T4.1 在**所有平台**验证 generic exit 2；runInteractiveFlow 的 grep 回归用例在**所有平台**执行；E2E(Unix) 为补充验证，Windows 跳过不导致验收缺口。 | ✅ |
| runInteractiveFlow + generic | GAP-R2-2 | init.js 411–417 行：`if (selectedAI === 'generic')` 内调用 `resolveGenericAiCommandsDir`，null 则 `process.exit(exitCodes.AI_INVALID)`。grep 回归断言 `resolveGenericAiCommandsDir` 与 `selectedAI === 'generic'` 均存在于 runInteractiveFlow 函数体内，防止未来删改。 | ✅ |

### （3）生产代码关键路径与孤岛模块

| 模块 | 路径 | 导入方 | 对抗核查 | 结论 |
|------|------|--------|----------|------|
| ai-registry.js | src/services/ai-registry.js | init.js、check.js | init require 路径 `../services/ai-registry`；check 同。无 ai-builtin 引用。 | ✅ |
| ai-registry-builtin.js | src/constants/ai-registry-builtin.js | ai-registry.js | load() 内 map builtin 作为底稿；无其他地方 require。 | ✅ |
| init.js | src/commands/init.js | bin | runNonInteractiveFlow、runWorktreeFlow、runInteractiveFlow 均使用 AIRegistry.load、getById、listIds、resolveGenericAiCommandsDir。 | ✅ |
| check.js | src/commands/check.js | bin | --list-ai 时调用 AIRegistry.listIds。 | ✅ |

**grep 验证**：`require('../services/ai-registry')`、`resolveGenericAiCommandsDir`、`selectedAI === 'generic'` 均在 init.js 存在；无孤岛。

### （4）ralph-method：prd、progress 与 TDD 红绿灯

| 审查项 | 对抗核查 | 结论 |
|--------|----------|------|
| prd.tasks-E12-S1.json | 5/5 US completed，tddSteps RED/GREEN/REFACTOR 均为 done。 | ✅ |
| progress.tasks-E12-S1.txt | US-001–US-005 含 [TDD-RED]、[TDD-GREEN]、[TDD-REFACTOR]；GAP-R2 段含 [GAP-R2-1]、[GAP-R2-2]、[TDD-REFACTOR]。 | ✅ |
| GAP-R2 修复记录 | progress 明确记录 runInteractiveFlow generic 校验与 init-interactive-generic.test.js。 | ✅ |

### （5）回归

| 审查项 | 验证方式 | 结论 |
|--------|----------|------|
| Story 12-1 相关测试 | `node --test tests/ai-registry.test.js tests/ai-registry-builtin.test.js tests/ai-registry-integration.test.js tests/init-interactive-generic.test.js` | ✅ 28 用例全部通过 |
| 测试 skip 合理性 | init-interactive-generic E2E(Unix) 在 Windows 下 return 跳过；无不当排除。 | ✅ |

---

## 2. 批判审计员专项对抗核查（段落占比≥50%）

**① 第一轮可能遗漏的需求点**：逐条对照 spec §3–§6、IMPLEMENTATION_GAPS 25 条、tasks T1–T5、GAP-R2。AC-1–AC-5 均有对应实现；GAP-R2 已修复。**新增对抗点**：spec §5「init/check 任一子命令」——check 当前无 --ai，故 generic 校验仅 init 适用。tasks T4.1 表述「init 与 check 的 --ai 校验逻辑」；check 无 --ai，故无逻辑可加。Story 13.1 负责 check 按 selectedAI 验证，届时若有 generic 相关校验则属 13.1 范围。**结论：非本 Story gap。**

**② 边界与异常路径**：文件不存在返回空数组、JSON 解析失败 throw 含路径、自定义 AI 无 configTemplate 抛错、configTemplate 违反 commandsDir/rulesDir 至少其一抛错、generic 交互选且无 aiCommandsDir 退出码 2，均与 spec 一致。**对抗点**：resolveGenericAiCommandsDir 对 options.aiCommandsDir 做 trim 与空字符串校验；registry 条目 aiCommandsDir 同理。空字符串、仅空格均返回 null，逻辑正确。**无未定义边界。**

**③ 验收可执行性**：验收命令已实际执行，28 用例通过。plan §5.1–§5.3 单元/集成/E2E 均有对应测试。**对抗点**：init-interactive-generic 的 E2E(Unix) 在 Windows 上不执行——若 CI 仅 Windows 则 E2E 永不跑。第一轮结论为 runNonInteractiveFlow 的 T4.1 已在所有平台验证 generic exit 2，交互式补充验证可接受 Windows 跳过。**可执行。**

**④ 与前序文档一致性**：实现与 spec §4.3 表、plan Phase 1–5、tasks、GAP-R2 一致。**无矛盾。**

**⑤ 孤岛与伪实现**：ai-registry.js、ai-registry-builtin.js 均被生产路径导入；init 三 flow 均使用 AIRegistry。grep 生产代码无 TODO、placeholder、预留、占位。**无孤岛、无伪实现。**

**⑥ TDD 与回归**：progress 逐 US 含 TDD 三步；GAP-R2 段已记录。28 用例全部通过。**符合。**

**⑦ 潜在脆弱点（非 gap，记录备查）**：
- ai-registry builtin 22 条为静态数据；若 PRD §5.12 表更新，需手动同步 ai-registry-builtin.js。
- init-interactive-generic E2E 依赖 Unix `script`；若无 script 则用例静默跳过，可能掩盖环境问题。

---

## 3. 与第一轮差异核查

| 第一轮结论 | 第二轮复核 | 结果 |
|------------|------------|------|
| runInteractiveFlow 已实现 generic 校验 | 逐行阅读 init.js 411–417，逻辑正确 | 一致 |
| 28 用例全部通过 | 实际执行，28 通过 | 一致 |
| 无孤岛模块 | grep 复核，无新增引用 | 一致 |
| prd/progress 完整 | 再次阅读 prd.json、progress.txt | 一致 |
| check 无 --ai | 对抗核查：spec §5「init/check 任一子命令」与 check 无 --ai 的兼容性 | 已说明，非 gap |

---

## 4. 批判审计员结论（段落占比≥50%）

**综合对抗核查**：需求覆盖、集成/E2E、生产路径、孤岛模块、ralph-method TDD、回归六项均满足。GAP-R2 修复后，runInteractiveFlow generic 校验完整；init-interactive-generic.test.js grep 回归 + E2E(Unix) 双通道覆盖。check 无 --ai 属 Story 范围外设计，不构成 gap。

**本轮 gap 结论**：

**本轮无新 gap。**

第一轮与第二轮连续两轮无新 gap。按 audit-post-impl-rules strict，需连续 3 轮无 gap 才收敛，建议进行第三轮验证。

---

## 5. 结论

**完全覆盖、验证通过。**

Story 12-1 AI Registry 实施（含 GAP-R2 修复）满足 audit-prompts §5 要求。第二轮对抗核查未发现新 gap。建议执行第三轮以达成 3 轮无 gap 收敛。

---

## 可解析评分块（§5.1 格式）

总体评级: A

维度评分:
- 功能性: 96/100
- 代码质量: 93/100
- 测试覆盖: 95/100
- 安全性: 88/100
