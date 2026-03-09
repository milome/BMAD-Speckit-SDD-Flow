# Tasks E13-S1: check 与 version 子命令

**Epic**: 13 - Speckit Diagnostic Commands  
**Story**: 13.1 - check 与 version 子命令  
**输入**: IMPLEMENTATION_GAPS-E13-S1.md, plan-E13-S1.md, spec-E13-S1.md

---

## 1. 本批任务 ↔ 需求追溯

| 任务 ID | 需求文档 | 章节 | 需求要点 |
|---------|----------|------|----------|
| T1–T1.4 | Story 13-1, spec §4 | AC3 | VersionCommand、version 子命令、--json |
| T2–T2.6 | Story 13-1, spec §3.1–§3.5 | AC1, AC2, AC7, AC8 | CheckCommand 诊断、detectCommand、--json、--ignore-agent-tools、--list-ai --json |
| T3–T3.5 | Story 13-1, spec §5 | AC4, AC5, AC6 | 结构验证、_bmad-output、selectedAI 映射、.cursor 默认 |
| T4 | plan §3.3 | — | 单元、集成、E2E 测试 |

---

## 2. Gaps → 任务映射

| 章节 | Gap ID | 对应任务 |
|------|--------|----------|
| spec §4 | GAP-1.1–1.3 | T1.1–T1.4 |
| spec §3.1–§3.5 | GAP-2.1–2.6 | T2.1–T2.6 |
| spec §5 | GAP-3.1–3.5 | T3.1–T3.5 |
| plan §3.3 | — | T4 |

---

## 3. Agent 执行规则

**禁止事项**：禁止占位、伪实现、跳过 TDD 红灯、标记完成但功能未调用。  
**必须事项**：集成任务修改生产路径、运行验证命令、TDD 红绿灯、实施前检索需求。

---

## 4. 任务列表

### T1: VersionCommand（AC3）

- [ ] **T1.1** 新建 `packages/bmad-speckit/src/commands/version.js`，实现 versionCommand(options)
  - **验收**：versionCommand 存在且可调用；读取 package.json version、bmad-speckit.json templateVersion、process.version；**集成验证**：bin 注册后 `bmad-speckit version` 成功，由 T4 覆盖
  - **生产代码**：version.js
  - **单元测试**：versionCommand 返回值含 cliVersion、templateVersion、nodeVersion

- [ ] **T1.2** templateVersion 来源：优先 `_bmad-output/config/bmad-speckit.json` 的 templateVersion；若无则尝试 bmadPath 或 _bmad 根下 package.json
  - **验收**：有 config 时用 config；无 config 时 bmadPath 或 _bmad 根；均无时为 null 或 "unknown"
  - **生产代码**：version.js
  - **单元测试**：各数据源场景

- [ ] **T1.3** 支持 --json：options.json 为 true 时 JSON.stringify({ cliVersion, templateVersion, nodeVersion }) 输出；否则人类可读文本
  - **验收**：`bmad-speckit version --json` 输出合法 JSON
  - **生产代码**：version.js
  - **集成测试**：CLI version --json

- [ ] **T1.4** 在 bin/bmad-speckit.js 注册 `version` 子命令，传入 .option('--json')，调用 versionCommand
  - **验收**：bmad-speckit version、bmad-speckit version --json 均成功
  - **生产代码**：bin/bmad-speckit.js
  - **集成测试**：CLI 执行

### T2: CheckCommand 诊断输出（AC1, AC2, AC7, AC8）

- [ ] **T2.1** 解析 check 选项：--json、--ignore-agent-tools；扩展 checkCommand(options)
  - **验收**：check --json、check --ignore-agent-tools 被正确解析
  - **生产代码**：bin/bmad-speckit.js check 选项、check.js
  - **集成测试**：check --help 含新选项

- [ ] **T2.2** 实现 diagnoseReport：收集 cliVersion（package.json）、templateVersion（config 或 bmadPath）、selectedAI、subagentSupport（AIRegistry.getById）、envVars（CURSOR_*、BMAD_*、PATH 等）
  - **验收**：诊断对象含上述字段；subagentSupport 为 none/limited 时含提示文本
  - **生产代码**：check.js
  - **单元测试**：diagnoseReport 结构

- [ ] **T2.3** 实现 aiToolsInstalled 检测：遍历 AIRegistry.load({ cwd })，对有 detectCommand 的条目执行 spawnSync(detectCommand, { shell: true })；exitCode 0 即加入已安装列表；options.ignoreAgentTools 为 true 时跳过
  - **验收**：detectCommand 执行逻辑正确；--ignore-agent-tools 时 aiToolsInstalled 为空或跳过
  - **生产代码**：check.js
  - **单元测试**：mock spawnSync，断言已安装列表

- [ ] **T2.4** 诊断输出格式：--json 时 JSON.stringify 输出；否则逐行文本
  - **验收**：check、check --json 输出格式正确
  - **生产代码**：check.js
  - **集成测试**：check、check --json

- [ ] **T2.5** check --list-ai 支持 --json：options.json 时输出 JSON 数组
  - **验收**：check --list-ai --json 输出合法 JSON 数组
  - **生产代码**：check.js
  - **集成测试**：check --list-ai --json

- [ ] **T2.6** 整合诊断输出与结构验证执行顺序：先执行结构验证；失败则 exit 1；成功则输出诊断报告（含 subagentSupport，已有可保留）
  - **验收**：check 先验证结构，再输出诊断
  - **生产代码**：check.js
  - **集成测试**：check 全流程

### T3: 结构验证（AC4, AC5, AC6）

- [ ] **T3.1** 扩展 structure-validate 或 check 内联：验证 _bmad-output 存在且含 config/
  - **验收**：_bmad-output 或 _bmad-output/config 缺失时验证失败，列出缺失项
  - **生产代码**：structure-validate.js 或 check.js
  - **单元测试**：validateBmadOutput 或等效

- [ ] **T3.2** 整合验证顺序：无 bmad-speckit.json 时跳过 AI 目标验证；仍验证 _bmad（若存在）、_bmad-output；有 bmadPath 时验证 bmadPath 不验证项目内 _bmad
  - **验收**：符合 spec §5.1、§5.2、§5.3
  - **生产代码**：check.js
  - **集成测试**：无 config、有 bmadPath 等场景

- [ ] **T3.3** 有 bmad-speckit.json 但无 selectedAI 时：验证 .cursor 含 commands/、rules/ 或 agents/ 至少其一（向后兼容默认）
  - **验收**：无 selectedAI 时验证 .cursor
  - **生产代码**：check.js validateSelectedAITargets 或等效
  - **集成测试**：config 无 selectedAI，.cursor 存在/缺失

- [ ] **T3.4** 补全 validateSelectedAITargets 映射：gemini、windsurf、kilocode、auggie、roo（按 spec §5.4 映射表）
  - **验收**：上述 selectedAI 的目标目录验证正确
  - **生产代码**：check.js validateSelectedAITargets
  - **单元测试**：各 AI 目标目录校验

- [ ] **T3.5** 验证失败时：列出缺失项，exit 1；成功 exit 0
  - **验收**：结构或 AI 目标失败时 exitCode 1；成功 0
  - **生产代码**：check.js
  - **集成测试**：断言 exitCode

### T4: 单元、集成、E2E 测试

- [ ] **T4.1** 单元测试：versionCommand 各数据源；check diagnoseReport、detectCommand、--ignore-agent-tools
  - **验收**：node --test 或 vitest 通过
  - **测试代码**：packages/bmad-speckit/tests/version.test.js、check 相关测试

- [ ] **T4.2** 集成测试：bmad-speckit version、version --json；bmad-speckit check、check --json、check --list-ai、check --list-ai --json、check --ignore-agent-tools
  - **验收**：CLI 执行成功，输出正确
  - **测试代码**：packages/bmad-speckit/tests/e2e/ 或等价

- [ ] **T4.3** 集成测试：结构验证（_bmad、_bmad-output、bmadPath、selectedAI 目标）；缺失时 exit 1
  - **验收**：临时 fixture 目录，断言 exitCode 与输出
  - **测试代码**：packages/bmad-speckit/tests/

- [ ] **T4.4** 端到端：init → check → version 全流程；多 selectedAI；无 init 项目
  - **验收**：完整流程通过
  - **测试代码**：packages/bmad-speckit/tests/e2e/

---

## 5. 验收命令汇总

| 任务 | 验收命令 |
|------|----------|
| T1 | `node packages/bmad-speckit/bin/bmad-speckit.js version`；`... version --json` |
| T2 | `... check`；`... check --json`；`... check --ignore-agent-tools`；`... check --list-ai --json` |
| T3 | `... check` 在缺失结构时 exit 1 |
| T4 | `cd packages/bmad-speckit && npm run test` 或 `node --test tests/` |

<!-- AUDIT: PASSED by code-reviewer -->
