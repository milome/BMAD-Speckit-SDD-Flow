# Provider 配置说明

## 目标

本文档补充说明 BMAD/Speckit 在 **provider 配置层** 的落点与约定，重点覆盖：

- OpenAI-compatible provider
- Anthropic-compatible provider
- 自定义 HTTP JSON provider
- API key / endpoint / model mapping 的配置方式

本文档主要面向两类场景：

1. runtime governance / remediation provider 配置
2. consumer 项目安装后，需要继续接入真实模型 provider 的场景

---

## 一、当前 provider 配置落点

当前仓库内，治理相关 provider 的主配置入口是：

- [governance-remediation.yaml](/D:/Dev/BMAD-Speckit-SDD-Flow/_bmad/_config/governance-remediation.yaml) 或消费项目中的同路径副本

读取逻辑与适配器创建在：

- [governance-remediation-config.ts](/D:/Dev/BMAD-Speckit-SDD-Flow/scripts/governance-remediation-config.ts)
- [governance-provider-adapter.ts](/D:/Dev/BMAD-Speckit-SDD-Flow/scripts/governance-provider-adapter.ts)

已支持的 provider mode：

- `stub`
- `http-json`
- `openai-compatible`
- `anthropic-compatible`

说明：

- consumer 项目当前安装链已能把治理配置骨架落到消费项目
- 但 provider 的真实联网能力，仍应通过项目内配置文件或环境变量显式提供
- 不建议把 API key 写死在仓库文件中

---

## 二、配置字段总览

`provider` 节点当前支持这些核心字段：

```yaml
provider:
  mode: openai-compatible | anthropic-compatible | http-json | stub
  id: my-provider
  displayName: My Provider
  timeoutMs: 30000
  headers: {}

  endpoint: https://example.com/path
  method: POST

  baseUrl: https://api.example.com/v1
  model: gpt-4.1-mini
  apiKey: ""
  apiKeyEnv: OPENAI_API_KEY
  systemPrompt: "..."
  maxTokens: 512
  anthropicVersion: 2023-06-01
```

字段用途：

- `mode`: 选择 provider 适配模式
- `id`: provider 的稳定标识，建议不要频繁改
- `displayName`: UI/日志可读名称
- `timeoutMs`: 请求超时
- `headers`: 额外请求头
- `endpoint`: 仅 `http-json` 使用，指向完整 URL
- `method`: 仅 `http-json` 使用，默认 `POST`
- `baseUrl`: `openai-compatible` / `anthropic-compatible` 的基础地址
- `model`: 发送给 provider 的目标模型名
- `apiKey`: 直接写入的密钥，不推荐
- `apiKeyEnv`: 从环境变量读取密钥，推荐
- `systemPrompt`: provider 级系统提示词
- `maxTokens`: Anthropic 兼容模式下的 `max_tokens`
- `anthropicVersion`: Anthropic 兼容 header

---

## 三、OpenAI-compatible 配置

### 1. 适用范围

适用于以下接口风格：

- 官方 OpenAI 风格 `/chat/completions`
- OpenRouter / Azure OpenAI 兼容网关
- 自建 OpenAI-compatible proxy
- 任何能接受 OpenAI Chat Completions 请求体的服务

代码入口：

- [governance-provider-adapter.ts](/D:/Dev/BMAD-Speckit-SDD-Flow/scripts/governance-provider-adapter.ts)

当前实现会把请求发到：

- `baseUrl + /chat/completions`

并附带：

- `Authorization: Bearer <apiKey>`

### 2. 推荐配置示例

```yaml
provider:
  mode: openai-compatible
  id: openai-prod
  displayName: OpenAI Production
  baseUrl: https://api.openai.com/v1
  model: gpt-4.1-mini
  apiKeyEnv: OPENAI_API_KEY
  timeoutMs: 30000
```

### 3. 若使用 OpenRouter

```yaml
provider:
  mode: openai-compatible
  id: openrouter
  displayName: OpenRouter
  baseUrl: https://openrouter.ai/api/v1
  model: openai/gpt-4.1-mini
  apiKeyEnv: OPENROUTER_API_KEY
  timeoutMs: 30000
  headers:
    HTTP-Referer: https://your-project.example
    X-Title: BMAD Runtime Governance
```

### 4. model mapping 建议

当前实现中，`model` 是直接透传给 provider 的字符串，没有额外映射层。

因此推荐的做法是：

- 在配置文件里直接填写 provider 实际要求的模型名
- 如果后续需要“逻辑模型名 → 实际 provider 模型名”的映射，建议新增一层 `modelMap` 或 `profiles` 配置，而不是在现有 `model` 字段里混写别名

建议约定：

```yaml
providerProfiles:
  default_fast: gpt-4.1-mini
  default_strong: gpt-4.1
  cheap_eval: gpt-4.1-nano

provider:
  mode: openai-compatible
  id: openai-prod
  baseUrl: https://api.openai.com/v1
  model: gpt-4.1-mini
  apiKeyEnv: OPENAI_API_KEY
```

如果未来要做正式 model mapping，可以扩展为：

```yaml
provider:
  mode: openai-compatible
  id: openai-prod
  baseUrl: https://api.openai.com/v1
  model: default_fast
  modelMap:
    default_fast: gpt-4.1-mini
    default_strong: gpt-4.1
```

当前仓库代码还**没有**内建 `modelMap` 解析逻辑，这只是推荐扩展方向。

---

## 四、Anthropic-compatible 配置

### 1. 适用范围

适用于以下接口风格：

- 官方 Anthropic `/messages`
- 兼容 Anthropic Messages 协议的代理服务

当前实现会把请求发到：

- `baseUrl + /messages`

并附带：

- `x-api-key`
- `anthropic-version`

### 2. 推荐配置示例

```yaml
provider:
  mode: anthropic-compatible
  id: anthropic-prod
  displayName: Anthropic Production
  baseUrl: https://api.anthropic.com/v1
  model: claude-3-5-sonnet-latest
  apiKeyEnv: ANTHROPIC_API_KEY
  timeoutMs: 30000
  maxTokens: 512
  anthropicVersion: 2023-06-01
```

### 3. model mapping 建议

与 OpenAI-compatible 相同：

- 当前 `model` 直接透传
- 最稳妥的方式是配置真实 provider model 名

例如：

```yaml
provider:
  mode: anthropic-compatible
  id: anthropic-prod
  baseUrl: https://api.anthropic.com/v1
  model: claude-3-5-sonnet-latest
  apiKeyEnv: ANTHROPIC_API_KEY
```

---

## 五、自定义 HTTP JSON provider 配置

### 1. 适用范围

适用于：

- 团队内部网关
- 自建治理建议服务
- 任意接受 JSON 输入并返回 JSON 输出的 HTTP 服务

当前实现要求：

- 提供完整 `endpoint`
- 默认 `POST`
- 返回内容能够被解析成 governance hint candidate 所需结构

### 2. 推荐配置示例

```yaml
provider:
  mode: http-json
  id: internal-gov
  displayName: Internal Governance Service
  endpoint: https://governance.example.com/v1/hints
  method: POST
  timeoutMs: 30000
  apiKeyEnv: GOVERNANCE_API_KEY
  headers:
    x-api-key: ${GOVERNANCE_API_KEY}
```

注意：当前 YAML 不会自动展开 `${...}`。如果要传 header 里的密钥，推荐：

- 在启动脚本层做环境变量注入
- 或扩展 `governance-remediation-config.ts`，支持 header 环境变量替换

### 3. 返回格式建议

最稳妥的返回结构应包含：

```json
{
  "confidence": "medium",
  "suggestedStage": "implement",
  "suggestedAction": "remediate",
  "recommendedSkillChain": ["systematic-debugging", "verification-before-completion"],
  "recommendedSubagentRoles": ["generalPurpose"],
  "constraints": ["do-not-change-shared-schema"],
  "researchPolicy": "allowed",
  "delegationPreference": "ask-me-first",
  "rationale": "Provider synthesized governance hints"
}
```

---

## 六、API Key 配置建议

### 1. 推荐：使用环境变量

推荐写法：

```yaml
provider:
  mode: openai-compatible
  id: openai-prod
  baseUrl: https://api.openai.com/v1
  model: gpt-4.1-mini
  apiKeyEnv: OPENAI_API_KEY
```

而不是：

```yaml
provider:
  apiKey: sk-xxxx
```

原因：

- 避免密钥进入 git
- 避免模板或安装脚本中留下明文
- 便于本地、CI、不同环境分别注入

### 2. 常见环境变量命名建议

- OpenAI: `OPENAI_API_KEY`
- Anthropic: `ANTHROPIC_API_KEY`
- OpenRouter: `OPENROUTER_API_KEY`
- Internal service: `GOVERNANCE_API_KEY`

### 3. endpoint 与 key 的组合建议

| Provider 类型 | endpoint/baseUrl | key 推荐字段 |
|---|---|---|
| OpenAI-compatible | `baseUrl` | `apiKeyEnv` |
| Anthropic-compatible | `baseUrl` | `apiKeyEnv` |
| HTTP JSON | `endpoint` | 优先外层注入 header / 后续扩展 env 替换 |

---

## 七、consumer 安装链与 provider 的关系

需要明确：

- consumer 安装链负责的是**项目内目录、hooks、运行时配置骨架**
- `provider 配置` 负责的是**治理逻辑真正联网时怎么访问模型服务**

两者关系是：

1. 先把 `_bmad` 与运行时骨架部署到消费项目
2. provider 再通过项目配置或环境变量补齐真实模型访问能力

所以目前 provider 配置文档的价值在于：

- 先把“配置契约”定义清楚
- 为后续真实 consumer 运行时接入模型 provider 提前铺路

---

## 八、推荐的后续演进

如果后续要把 provider 体系做完整，建议按这个顺序演进：

1. 给 `governance-remediation.yaml` 增加 `providerProfiles`
2. 增加 `modelMap` / `logical model alias` 解析层
3. 给 `headers` 支持 `${ENV_VAR}` 替换
4. 在 consumer 运行时入口中正式接入 provider config 读取
5. 增加 provider smoke 测试与 fail-fast 校验

---

## 九、最小示例

### OpenAI-compatible

```yaml
provider:
  mode: openai-compatible
  id: openai-prod
  displayName: OpenAI
  baseUrl: https://api.openai.com/v1
  model: gpt-4.1-mini
  apiKeyEnv: OPENAI_API_KEY
  timeoutMs: 30000
```

### Anthropic-compatible

```yaml
provider:
  mode: anthropic-compatible
  id: anthropic-prod
  displayName: Anthropic
  baseUrl: https://api.anthropic.com/v1
  model: claude-3-5-sonnet-latest
  apiKeyEnv: ANTHROPIC_API_KEY
  timeoutMs: 30000
  maxTokens: 512
```

### 自定义 HTTP JSON

```yaml
provider:
  mode: http-json
  id: internal-gateway
  displayName: Internal Gateway
  endpoint: https://governance.example.com/v1/hints
  method: POST
  timeoutMs: 30000
  headers:
    x-client: bmad-runtime
```

---

## 十、结论

现在 provider 配置的主实现入口已经存在，但说明文档之前不够细，尤其缺少：

- OpenAI / Anthropic / 自定义 provider 的区别
- API key 的推荐注入方式
- endpoint / model 字段的语义边界
- model mapping 的当前现状与推荐演进路径

本文档补齐后，consumer 安装文档就可以更清楚地区分：

- “consumer 安装骨架”负责什么
- “provider 配置”应该放在哪里、怎么写、目前做到哪一步

---

## 十一、阿里百炼 Coding 兼容路径实测样例

已对你给出的阿里百炼 Coding Plan 入口做过一次兼容性验证，结论是：

- `https://coding.dashscope.aliyuncs.com/v1/chat/completions` 可用
- 该入口可按 **OpenAI-compatible** 模式接入
- `model` 使用 `kimi-k2.5` 时，请求可正常返回

实测结果要点：

- 可用 URL：`https://coding.dashscope.aliyuncs.com/v1/chat/completions`
- 不可用 URL：
  - `https://coding.dashscope.aliyuncs.com/chat/completions`
  - `https://coding.dashscope.aliyuncs.com/api/v1/chat/completions`
  - `https://coding.dashscope.aliyuncs.com/compatible-mode/v1/chat/completions`
- 鉴权方式：`Authorization: Bearer <API_KEY>`
- 返回结构：兼容 OpenAI Chat Completions

### 推荐配置样例

```yaml
provider:
  mode: openai-compatible
  id: dashscope-coding-kimi
  displayName: DashScope Coding Kimi K2.5
  baseUrl: https://coding.dashscope.aliyuncs.com/v1
  model: kimi-k2.5
  apiKeyEnv: DASHSCOPE_API_KEY
  timeoutMs: 30000
```

说明：

- 这里 `baseUrl` 必须写到 `/v1`
- 当前实现会自动拼接 `/chat/completions`
- 所以最终请求地址会是：
  - `https://coding.dashscope.aliyuncs.com/v1/chat/completions`

### 若临时直写 API key

不推荐长期这样做，但临时验证时可以：

```yaml
provider:
  mode: openai-compatible
  id: dashscope-coding-kimi
  displayName: DashScope Coding Kimi K2.5
  baseUrl: https://coding.dashscope.aliyuncs.com/v1
  model: kimi-k2.5
  apiKey: YOUR_TEMP_KEY
  timeoutMs: 30000
```

正式使用仍建议改回：

- `apiKeyEnv: DASHSCOPE_API_KEY`

---

## 十二、governance-remediation.yaml 完整可复制片段

下面这份是可直接复制的完整示例，适合作为 `_bmad/_config/governance-remediation.yaml` 的起点。

### 使用环境变量注入 API key 的推荐版本

```yaml
version: 1

primaryHost: cursor

packetHosts:
  - cursor
  - claude

provider:
  mode: openai-compatible
  id: dashscope-coding-kimi
  displayName: DashScope Coding Kimi K2.5
  baseUrl: https://coding.dashscope.aliyuncs.com/v1
  model: kimi-k2.5
  apiKeyEnv: DASHSCOPE_API_KEY
  timeoutMs: 30000
  headers: {}
  systemPrompt: >-
    You are a governance hint synthesizer.
    Return JSON only.
    The input contains an explicit semanticSkillFeatures field describing
    skill-derived stage/action/interaction/research/delegation/constraint signals.
    Treat semanticSkillFeatures as first-class structured routing evidence.
    You may suggest stage/action/artifact/role/research/delegation/constraints.
    You must not assert authority over blocker ownership, failed-check severity,
    or artifact-derived root target.
```

### 临时直写 key 的验证版本

```yaml
version: 1

primaryHost: cursor

packetHosts:
  - cursor
  - claude

provider:
  mode: openai-compatible
  id: dashscope-coding-kimi
  displayName: DashScope Coding Kimi K2.5
  baseUrl: https://coding.dashscope.aliyuncs.com/v1
  model: kimi-k2.5
  apiKey: YOUR_TEMP_KEY
  timeoutMs: 30000
  headers: {}
  systemPrompt: >-
    You are a governance hint synthesizer.
    Return JSON only.
    The input contains an explicit semanticSkillFeatures field describing
    skill-derived stage/action/interaction/research/delegation/constraint signals.
    Treat semanticSkillFeatures as first-class structured routing evidence.
    You may suggest stage/action/artifact/role/research/delegation/constraints.
    You must not assert authority over blocker ownership, failed-check severity,
    or artifact-derived root target.
```

### 对应环境变量设置示例

PowerShell:

```powershell
$env:DASHSCOPE_API_KEY = "your-key-here"
```

Bash:

```bash
export DASHSCOPE_API_KEY="your-key-here"
```

---

## 十三、配置时的注意点

1. `baseUrl` 不要写成 `https://coding.dashscope.aliyuncs.com`
   否则当前适配器会拼出错误路径：`/chat/completions`

2. 正确写法应为：
   `https://coding.dashscope.aliyuncs.com/v1`

3. 当前代码不会做 model alias 映射
   所以要直接写 provider 接受的真实模型名：`kimi-k2.5`

4. 如果后续换成别的兼容网关，只要满足：
   - OpenAI Chat Completions 协议兼容
   - Bearer Token 鉴权
   - `/v1/chat/completions` 可访问
   就可以继续沿用 `openai-compatible` 模式

---

## 十四、是否必须配置提示词

不必须。

当前实现中：

- `systemPrompt` 是可选字段
- 如果不配置，会使用适配器内置默认提示词
- 默认提示词已经包含“返回 JSON only”“把 semanticSkillFeatures 当作一等路由信号”“不要越权改 blocker ownership / root target”这类基础约束

因此：

- 想先验证 provider 通不通：可以不配 `systemPrompt`
- 想更强约束 provider 输出：再显式补 `systemPrompt`

推荐分层：

### 最小可用配置

```yaml
provider:
  mode: openai-compatible
  id: dashscope-coding-kimi
  baseUrl: https://coding.dashscope.aliyuncs.com/v1
  model: kimi-k2.5
  apiKeyEnv: DASHSCOPE_API_KEY
  timeoutMs: 30000
```

### 强约束配置

```yaml
provider:
  mode: openai-compatible
  id: dashscope-coding-kimi
  baseUrl: https://coding.dashscope.aliyuncs.com/v1
  model: kimi-k2.5
  apiKeyEnv: DASHSCOPE_API_KEY
  timeoutMs: 30000
  systemPrompt: >-
    You are a governance hint synthesizer.
    Return JSON only.
    Treat semanticSkillFeatures as first-class routing evidence.
```

---

## 十五、本地 smoke provider

如果只是验证 provider 这条链“能否连通”，建议先做一个最小 smoke，而不是一开始就跑完整治理流程。

### 1. 准备环境变量

PowerShell:

```powershell
$env:DASHSCOPE_API_KEY = "your-key-here"
```

### 2. 建议先写入治理配置

把 `_bmad/_config/governance-remediation.yaml` 改成下述最小版本：

```yaml
version: 1
primaryHost: cursor
packetHosts:
  - cursor
  - claude
provider:
  mode: openai-compatible
  id: dashscope-coding-kimi
  displayName: DashScope Coding Kimi K2.5
  baseUrl: https://coding.dashscope.aliyuncs.com/v1
  model: kimi-k2.5
  apiKeyEnv: DASHSCOPE_API_KEY
  timeoutMs: 30000
```

### 3. 最小联网 smoke 思路

当前仓库还没有单独的 `provider-smoke` CLI，但可以按下面两种方式验证。

方式 A：直接用最小 fetch 验证 OpenAI-compatible 通道

```powershell
@'
const url = 'https://coding.dashscope.aliyuncs.com/v1/chat/completions';
const apiKey = process.env.DASHSCOPE_API_KEY;
const body = {
  model: 'kimi-k2.5',
  temperature: 0,
  response_format: { type: 'json_object' },
  messages: [
    { role: 'system', content: 'Return JSON only.' },
    { role: 'user', content: JSON.stringify({ ping: 'pong' }) },
  ],
};

(async () => {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });
  console.log(await response.text());
})();
'@ | node -
```

方式 B：后续如果要正式沉淀，建议新增一个脚本，例如：

- `scripts/provider-smoke.ts`

职责只做：

- 读取 `governance-remediation.yaml`
- 构造 provider adapter
- 发送一个固定最小请求
- 打印解析结果与错误上下文

这样就能把“provider 通道是否可用”和“治理流程是否可用”拆开验证。
