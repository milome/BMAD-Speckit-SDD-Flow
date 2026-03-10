# Plan E13-S1: check 与 version 子命令实现方案

**Epic**: 13 - Speckit Diagnostic Commands  
**Story**: 13.1 - check 与 version 子命令  
**输入**: spec-E13-S1.md, 13-1-check-version.md, PRD §5.5, ARCH §3.2

---

## 1. 概述

本 plan 定义 Story 13.1 的实现方案：新建 VersionCommand 输出 CLI/模板/Node 版本；增强 CheckCommand 支持诊断报告（AI 工具 detectCommand 检测、版本、环境变量）、--list-ai、--json、--ignore-agent-tools、结构验证（§5.5 清单、selectedAI 目标目录）、subagentSupport 输出；退出码 0/1。

---

## 2. 需求映射清单（plan.md ↔ 需求文档 + spec.md）

| 需求文档章节 | spec.md 对应 | plan.md 对应 | 覆盖状态 |
|-------------|-------------|-------------|----------|
| Story AC1 | spec §3.1–§3.3 | Phase 2、Phase 3、集成测试 | ✅ |
| Story AC2 | spec §3.4 | Phase 3、集成测试 | ✅ |
| Story AC3 | spec §4 | Phase 1、集成测试 | ✅ |
| Story AC4 | spec §5.1–§5.5 | Phase 4、Phase 5、集成测试 | ✅ |
| Story AC5 | spec §5.2 | Phase 4、Phase 5 | ✅ |
| Story AC6 | spec §5.3、§5.4 | Phase 5、集成测试 | ✅ |
| Story AC7 | spec §3.2 | Phase 3 | ✅ |
| Story AC8 | spec §3.5 | Phase 3 | ✅ |
| Story AC9 | spec §6 | Phase 4、Phase 5 | ✅ |
| PRD §5.5 | spec §5 | Phase 4、Phase 5 | ✅ |
| ARCH §3.2 | spec §3、§4 | 全 Phase | ✅ |

---

## 3. 技术架构

### 3.1 模块职责

| 模块 | 路径 | 职责 |
|------|------|------|
| VersionCommand | `src/commands/version.js` | version 子命令；输出 cliVersion、templateVersion、nodeVersion；--json |
| CheckCommand | `src/commands/check.js` | 诊断输出、--list-ai、--json、--ignore-agent-tools、结构验证、subagentSupport |
| structure-validate | `src/utils/structure-validate.js` | 扩展：验证 _bmad-output/config/ 存在 |
| detectCommand 执行 | 内联 check.js 或 utils | 遍历 AIRegistry，对有 detectCommand 的条目执行 spawnSync |

### 3.2 数据流

```
version 流程:
  读取 package.json version
       ↓
  读取 bmad-speckit.json templateVersion（或 bmadPath 根）
       ↓
  process.version
       ↓
  --json ? JSON.stringify : 文本输出

check 流程 (非 --list-ai):
  读取 bmad-speckit.json
       ↓
  --ignore-agent-tools ? 跳过 : 遍历 AIRegistry.load()，对有 detectCommand 的条目 spawnSync
       ↓
  收集 cliVersion、templateVersion、envVars、selectedAI、subagentSupport
       ↓
  执行结构验证（§5.5 清单 + selectedAI 目标目录）
       ↓
  验证失败 ? exit 1 : 输出诊断报告，exit 0

check --list-ai:
  AIRegistry.listIds({ cwd })
       ↓
  --json ? JSON 数组 : 每行一个 id
       ↓
  exit 0
```

### 3.3 集成测试与端到端测试计划（必须）

| 测试类型 | 覆盖内容 | 验收方式 |
|---------|---------|---------|
| **version 单元** | 无 bmad-speckit.json、有 config、有 bmadPath；--json 输出格式 | 断言 cliVersion、templateVersion、nodeVersion |
| **version 集成** | version 子命令被 bin 注册；运行 bmad-speckit version 成功 | 执行 CLI，断言 stdout |
| **check 诊断单元** | detectCommand 检测（有/无、--ignore-agent-tools）；envVars 输出 |  mock spawnSync |
| **check --list-ai** | 内置 + 用户 registry 合并；--json 数组 | 断言 id 列表 |
| **check 结构验证** | _bmad、bmadPath、_bmad-output、selectedAI 目标目录；缺失时 exit 1 | 临时目录 fixture，断言 exitCode |
| **check subagentSupport** | none/limited 时输出提示 | 断言 stdout 含提示 |
| **端到端** | init → check → version 全流程；--json 可解析 | 覆盖 cursor-agent、无 init 项目 |

---

## 4. 实现阶段（Phases）

### Phase 1: VersionCommand

**目标**：新建 `src/commands/version.js`，在 bin 注册 `version` 子命令。

**实现要点**：
1. 读取 package.json（require 相对路径）获取 cliVersion
2. 读取 `_bmad-output/config/bmad-speckit.json` 的 templateVersion；若不存在或無该字段，尝试 bmadPath 或 _bmad 根下 package.json
3. nodeVersion = process.version
4. 解析 --json：有则 JSON.stringify({ cliVersion, templateVersion, nodeVersion }) 输出；否则人类可读文本
5. 在 bin/bmad-speckit.js 注册 `.command('version')`，调用 versionCommand

**产出**：`src/commands/version.js`，bin 修改

### Phase 2: CheckCommand 诊断输出（AC1、AC7、AC8）

**目标**：实现诊断报告、--ignore-agent-tools、subagentSupport。

**实现要点**：
1. 解析 options.json、options.ignoreAgentTools（--json、--ignore-agent-tools）
2. 若 options.listAi：走 --list-ai 分支（Phase 3），直接返回
3. 诊断数据收集：
   - cliVersion：package.json
   - templateVersion：bmad-speckit.json 或 bmadPath
   - selectedAI：config
   - subagentSupport：AIRegistry.getById(selectedAI)?.configTemplate?.subagentSupport
   - envVars：process.env 过滤 CURSOR_*、BMAD_*、PATH 等关键 key
   - aiToolsInstalled：若 !ignoreAgentTools，遍历 AIRegistry.load({ cwd })，对有 detectCommand 的条目执行 spawnSync(detectCommand, { shell: true })，exitCode 0 即加入已安装列表
4. detectCommand 检测：detectCommand 可为 "cursor --version" 等形式；需 split 或直接 shell:true 执行整串
5. subagentSupport 为 none/limited 时追加提示文本
6. 输出：--json 则 JSON 对象；否则逐行文本

**产出**：修改 `check.js`

### Phase 3: check --list-ai（AC2）

**目标**：实现 --list-ai，支持 --json。

**实现要点**：
1. options.listAi 时，ids = AIRegistry.listIds({ cwd })
2. options.json 时：console.log(JSON.stringify(ids))
3. 否则：ids.forEach(id => console.log(id))
4. process.exit(exitCodes.SUCCESS)

**产出**：修改 `check.js`（当前已有 --list-ai 基础，需补 --json）

### Phase 4: 结构验证扩展（AC4、AC5）

**目标**：实现 §5.5 验证清单，包含 _bmad-output/config/。

**实现要点**：
1. 扩展 structure-validate.js：新增 validateBmadOutputStructure(cwd) 或 validateProjectStructure(cwd, config)，验证：
   - _bmad-output 存在且为目录
   - _bmad-output/config 存在且为目录
2. 或 check 内联实现 _bmad-output 验证
3. 整合 validateBmadStructure：当有 bmadPath 时验证 bmadPath 指向目录；否则验证项目内 _bmad
4. _bmad/cursor 存在时验证 commands/、rules/
5. 任一失败：收集 missing 列表，输出到 stderr，exit 1

**产出**：修改 `structure-validate.js` 或 check 内联逻辑

### Phase 5: selectedAI 目标目录验证（AC6）

**目标**：按 selectedAI 映射表验证目标目录。

**实现要点**：
1. 无 bmad-speckit.json：跳过（已在 Phase 4 前判断）
2. 有 config 但无 selectedAI：验证 .cursor 含 commands/、rules/ 或 agents/ 至少其一
3. 有 selectedAI：按 spec §5.4 映射表逐项校验；复用 check.js 既有 validateSelectedAITargets，补全映射表缺失项（gemini、windsurf、kilocode、auggie、roo）
4. 验证失败：加入 missing，exit 1

**产出**：修改 `check.js` 的 validateSelectedAITargets

---

## 5. 测试策略

| 层级 | 覆盖 |
|------|------|
| 单元 | version 各数据源；check detectCommand、--ignore-agent-tools、subagentSupport |
| 集成 | version/check 子命令 CLI；结构验证各场景；--list-ai --json |
| 端到端 | init → check → version；多 selectedAI；无 init 项目 |

---

## 6. 依赖与约束

- **依赖**：Story 12.1 AIRegistry（含 detectCommand 字段）、ConfigManager、exit-codes.js
- **约束**：禁止写死 .cursor；目标目录由 configTemplate 或映射表决定；detectCommand 执行需考虑超时（可选，默认 5s）

<!-- AUDIT: PASSED by code-reviewer -->
