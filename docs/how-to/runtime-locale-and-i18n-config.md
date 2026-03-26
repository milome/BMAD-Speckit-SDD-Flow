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
| **语言策略（Language Policy）** | 决定本轮会话的展示/产物语言倾向（中文、英文或双语等） | 注入到模型上下文的 JSON 里；可合并进 `_bmad-output/runtime/context/project.json` 的 `languagePolicy` |
| **审计提示词 locale** | 决定代码审查等场景用哪套 **audit-prompts** 文件（例如 `.md` 主稿或 `.en.md` 英文侧车） | 由同一套运行时上下文推导，但 **缺省规则与语言策略的兜底不完全相同**（见下文第 4 节） |

两者都尽量依赖 **项目内运行时文件**，而不是靠零散环境变量，便于团队 reproducible。

---

## 2. 运行时里的 `languagePolicy` 是什么

### 2.1 存在哪里

路径（相对项目根）：

```text
_bmad-output/runtime/context/project.json
```

其中的字段：

```json
"languagePolicy": {
  "resolvedMode": "zh"
}
```

`resolvedMode` 取值一般为 **`zh`**、**`en`** 或 **`bilingual`**（以项目内 schema 为准）。

### 2.2 什么时候文件里会有这一项

- `project.json` 往往由 **工作流/bootstrap**（例如 sprint 状态同步、确保 project context 等）先创建，里面 **不一定**一开始就有 `languagePolicy`。
- **Hooks**（如 Agent 调用前、会话开始、子代理启动）在成功跑完治理 emit 之后，会调用 **会话语言解析**，并在 **`project.json` 已存在且可读** 时，把本轮解析出的 `resolvedMode` **合并写回**该文件（并更新 `updatedAt`）。
- 若 **`project.json` 尚不存在**，合并会 **跳过**（不因此报错）。此时其他逻辑若读不到 `languagePolicy`，会走各自的 **默认策略**（见第 4 节）。

**对你意味着什么**：新仓库或刚清过 `_bmad-output` 时，可能短暂看不到 `languagePolicy`，属预期；跑过带 hook 的流程或已生成 project context 后，通常会补上。

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

工具链在解析 **审计模板路径** 时，会读取 **`project.json` → `languagePolicy.resolvedMode`**：

- **`en`**：优先使用 `.en.md` 等英文侧车（若存在）。
- **`zh` 或 `bilingual`**：走中文路径（例如 `.zh.md` 或默认主稿 `.md`）。
- **文件不存在、`languagePolicy` 缺失或字段无效**：按约定 **默认按中文主稿** 处理（与第 3 节里语言策略的「兜底可能是 en」是 **两条消费链**，不要混用）。

**对你意味着什么**：希望审计阶段稳定用英文模板时，应让 **`resolvedMode` 能稳定为 `en`**（通过第 5 节配置 + 明确使用习惯），并确认 `project.json` 已被写入；仅依赖「系统默认」时，审计侧可能仍偏向中文主稿。

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
| 审计阶段稳定用英文模板 | 确保 `languagePolicy.resolvedMode` 为 `en` 且 `project.json` 存在；必要时检查 hook 是否成功合并语言 |
| 刚 init 后没有 `languagePolicy` | 先跑会生成 `_bmad-output/runtime/context/project.json` 的流程，再触发带语言合并的 hook |

---

## 7. 相关文档

- [Runtime Governance 自动注入（Cursor / Claude Code）](./runtime-governance-auto-inject-cursor-claude.md)
- [入门教程](../tutorials/getting-started.md)
- Story 助手：[bmad-story-assistant.md](./bmad-story-assistant.md)

策略与文件约定补充：`_bmad/_config/AUDIT_PROMPTS_STRATEGY.md`（若仓库已提供）。
