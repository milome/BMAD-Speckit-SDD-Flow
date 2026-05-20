# 运行时语言与 BMAD i18n 配置说明

本文面向 **使用 BMAD / Speckit 工作流的项目成员**（不写内核代码也能读懂）。读完你可以回答三件事：

- 对话和产物会按 **哪种语言偏好** 运行？
- 这些偏好 **写在哪里、谁改、何时生效**？
- **审计提示词** 等工具读语言时，和上面的规则有什么 **细微差别**？

若你已了解 Runtime Governance 自动注入，可先阅读 [Runtime Governance 自动注入（Cursor / Claude Code）](./runtime-governance-auto-inject-cursor-claude.md)，再读本篇补全「语言」这一条纵切面。

---

## 1. 两个容易混在一起的「语言」

| 概念 | 作用 | 典型落点 |
|------|------|----------|
| **语言策略（Language Policy）** | 决定本轮会话的展示/产物语言倾向（中文、英文或双语等） | 写入 requirement-scoped `runtimePolicySnapshot.locale`；不得再依赖 `_bmad-output/runtime/context/project.json` |
| **审计提示词 locale** | 决定代码审查等场景用哪套 **audit-prompts** 文件（例如 `.md` 主稿或 `.en.md` 英文侧车） | 由同一套运行时上下文推导，但 **缺省规则与语言策略的兜底不完全相同**（见下文第 4 节） |

两者都尽量依赖 **项目内运行时文件**，而不是靠零散环境变量，便于团队 reproducible。

---

## 2. 运行时里的 `languagePolicy` 是什么

### 2.1 存在哪里

目标路径（相对项目根）：

```text
_bmad-output/runtime/requirement-records/<requirement-set-id>/recovery/runtime-policy-snapshot.json
```

其中的字段：

```json
"locale": "zh-CN"
```

`locale` 取值一般为 **`zh-CN`**、**`en-US`** 或 **`bilingual`**（以项目内 runtimePolicySnapshot contract 为准）。确认页语言仍由用户显式选择，不能从 `locale` 推断。

### 2.2 什么时候文件里会有这一项

- `runtimePolicySnapshot` 由当前 Requirement 的 readiness / runtime policy producer 生成，并通过 artifactIndex 注册。
- Hooks 或 no-hook 等价入口只能读取 Active Requirement Resolver 解析出的当前 record，再读取该 record 指向的 `runtimePolicySnapshot`。
- 若当前 Requirement 没有可校验的 `runtimePolicySnapshot`，相关 runtime policy / hook trust / closeout 检查必须 fail closed 或重新 readiness，不能回退到 `project.json`。

**对你意味着什么**：新仓库或刚清过 `_bmad-output` 时，必须先进入需求确认和实施准备，生成当前 Requirement 的 runtime policy snapshot。不要手工补 `project.json`。

---

## 3. `resolvedMode` 是怎么「决定」的（决策顺序）

决策在 **`resolveLanguagePolicy`** 一类逻辑中完成，输入大致包括：

1. **你在消息里的显式要求**（例如明确说「用英文回复」）——优先级最高。
2. **项目 BMAD 配置里的 i18n 默认值**（见第 5 节）：`default_language_mode`、`default_artifact_language`、`allow_bilingual_auto_mode` 等。
3. **自动推断**（在配置允许且提供了近期用户消息等输入时）：根据最近几条消息的语言特征推断。
4. **兜底**：当没有足够信号时，语言策略逻辑可能落到代码里定义的 **fallback**（与「审计提示词缺省」不是同一套规则，见下节）。

Hooks 里调用会话解析时，**近期消息数组有时为空**，因此 **项目级 i18n 默认** 往往比「自动推断」更常起作用；若默认是 `auto` 且又没有近期消息，更容易一路走到 **兜底**。

---

## 4. 审计提示词（audit prompts）何时用中文版、何时用英文版

工具链在解析 **审计模板路径** 时，应读取当前 Requirement 的 **`runtimePolicySnapshot.locale`**：

- **`en-US`**：优先使用 `.en.md` 等英文侧车（若存在）。
- **`zh-CN` 或 `bilingual`**：走中文路径（例如 `.zh.md` 或默认主稿 `.md`）。
- **snapshot 缺失、hash 不匹配或字段无效**：不得读取旧 `project.json`；应 fail closed、重新 readiness，或使用明确标记为 not_applicable / fallback 的受控 gate 结果。

**对你意味着什么**：希望审计阶段稳定用英文模板时，应让当前 Requirement 的 **`runtimePolicySnapshot.locale` 稳定为 `en-US`**，并确认 snapshot 已被 artifactIndex 注册且 hash 可复核。

---

## 5. BMAD i18n 配置：怎么配、谁配、何时读

### 5.1 它是什么

**BMAD i18n** 指 BMAD Story 总配置 YAML 里的 **`i18n:`** 段，用来设定 **项目默认语言模式**、**产物语言**、**是否允许自动双语** 等。运行时会把 **代码内置默认** 与 **你 YAML 里写的覆盖项** 合并。

### 5.2 怎么配

1. 在项目里准备 **BMAD Story 配置文件**（YAML）。
2. 在文件中增加或修改 **`i18n:`** 段，只写需要覆盖的键即可；未写的键沿用内置默认。
3. 常见键名包括：`default_language_mode`、`default_artifact_language`、`allow_bilingual_auto_mode`、`fallback_language`，以及是否保留英文控制键、路径等开关（以仓库内 `scripts/bmad-config.ts` 中 `getDefaultConfig()` 与类型定义为准）。

**路径约定（重要）**：加载器默认查找的是 **项目根下的**：

```text
config/bmad-story-config.yaml
```

（相对 **当前工作目录**。）若该文件 **不存在**，则视为 **没有文件覆盖**，i18n 全部使用 **代码内置默认**。

仓库中 **示例/模板** 常放在 `_bmad/_config/bmad-story-config.yaml`；若你的项目 **没有**把配置复制或链接到 `config/bmad-story-config.yaml`，默认 `loadConfig()` **不会**自动读到 `_bmad/_config/` 下那份文件。需要自定义时，请任选其一：

- 在 **`config/bmad-story-config.yaml`** 维护正式配置（推荐与加载器默认一致）；或  
- 在内部工具/脚本中显式传入你使用的配置文件路径（由集成方约定）。

### 5.3 谁来配置

- **项目负责人或熟悉 BMAD 的开发者**：在 YAML 中维护 `i18n` 与审计粒度等。
- **工具不会自动替你写** `i18n`；不配置则一直用内置默认。

### 5.4 什么时候生效

- 保存 YAML 后，下一次执行 **`loadConfig()`** 的流程会读到（进程内可能对无参配置有缓存，同进程重复调用仍用合并结果）。
- **会话语言解析**、部分 CLI 会在 **`cd` 到项目根** 后加载配置，因此 **项目根路径** 与 **`config/bmad-story-config.yaml` 是否存在** 会直接影响结果。

---

## 6. 建议自检清单

| 我想达到的效果 | 建议动作 |
|----------------|----------|
| 固定中文会话与产物 | 在 `config/bmad-story-config.yaml` 的 `i18n` 中设置 `default_language_mode: zh`（或等价组合），并确认文件路径被加载器读到 |
| 固定英文会话与产物 | 同上设为 `en`，并在消息中避免歧义；必要时显式说明语言 |
| 审计阶段稳定用英文模板 | 确保当前 Requirement 的 `runtimePolicySnapshot.locale` 为 `en-US`，且 snapshot hash 被 artifactIndex 注册 |
| 刚 init 后没有语言策略 | 先完成 active requirement 定位、需求确认和 readiness，生成 requirement-scoped `runtimePolicySnapshot` |

---

## 7. 相关文档

- [Runtime Governance 自动注入（Cursor / Claude Code）](./runtime-governance-auto-inject-cursor-claude.md)
- [入门教程](../tutorials/getting-started.md)
- Story 助手：[bmad-story-assistant.md](./bmad-story-assistant.md)

策略与文件约定补充：`_bmad/_config/AUDIT_PROMPTS_STRATEGY.md`（若仓库已提供）。
