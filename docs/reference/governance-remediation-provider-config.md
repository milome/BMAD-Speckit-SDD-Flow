# Governance Remediation Provider 配置参考

> 说明 `_bmad/_config/governance-remediation.yaml` 中 `provider` 段如何配置，以及 OpenAI / Anthropic 的最小可用示例。
> **Current path**: provider 仅作为 governance remediation / hint sidecar
> **Legacy path**: provider 直接充当 authoritative gate / routing / readiness 判定源

---

## 字段说明

`governance-remediation.yaml` 把两层概念分开：

- `primaryHost` / `packetHosts`
  - 决定治理 remediation packet 面向哪个宿主生成，例如 `cursor`、`claude`、`codex`
- `provider`
  - 决定 runner 通过哪种模型接口协议去解析 governance hints

当前仓内已接入的 `provider.mode`：

- `stub`
- `http-json`
- `openai-compatible`
- `anthropic-compatible`

常用字段：

| 字段               | 含义                                                |
| ------------------ | --------------------------------------------------- |
| `mode`             | provider 协议模式                                   |
| `id`               | provider 标识，会写入治理 hint 元数据               |
| `baseUrl`          | provider API 基础地址                               |
| `endpoint`         | `http-json` 模式下的目标接口地址                    |
| `method`           | `http-json` 模式下的 HTTP 方法，支持 `POST` / `PUT` |
| `model`            | 请求使用的模型名                                    |
| `apiKeyEnv`        | 从环境变量读取 API Key                              |
| `timeoutMs`        | provider 请求超时                                   |
| `systemPrompt`     | 覆盖默认治理系统提示词                              |
| `maxTokens`        | `anthropic-compatible` 模式下的 `max_tokens`        |
| `anthropicVersion` | `anthropic-compatible` 请求头版本                   |

---

## OpenAI 示例

适用于：

- OpenAI 官方接口
- 或任何兼容 `POST /chat/completions` 的 OpenAI-compatible 网关

```yaml
version: 1
primaryHost: cursor
packetHosts:
  - cursor
  - claude
  - codex

provider:
  mode: openai-compatible
  id: openai-governance
  baseUrl: https://api.openai.com/v1
  model: gpt-5.4
  apiKeyEnv: OPENAI_API_KEY
  timeoutMs: 30000
```

说明：

- 代码会请求 `POST {baseUrl}/chat/completions`
- 该 endpoint 需要支持 JSON object 返回约束
- `primaryHost: cursor` 只影响宿主 packet 和 hook，不影响 provider 协议

---

## HTTP JSON 示例

适用于：

- 你自己封装的一层治理 hint 服务
- 网关 / 中台统一出口
- 任何不想直接暴露 OpenAI / Anthropic 原始协议的场景

```yaml
version: 1
primaryHost: cursor
packetHosts:
  - cursor
  - claude
  - codex

provider:
  mode: http-json
  id: custom-http-governance
  endpoint: http://127.0.0.1:8080/governance/hint
  method: POST
  timeoutMs: 30000
```

默认请求体大致为：

```json
{
  "promptText": "做 implementation readiness 修复，不要联网，最小修复。",
  "routingContext": {
    "stageContextKnown": true,
    "gateFailureExists": true,
    "blockerOwnershipLocked": true,
    "rootTargetLocked": true,
    "equivalentAdapterCount": 2,
    "capabilitySlot": "qa.readiness",
    "canonicalAgent": "PM + QA / readiness reviewer",
    "actualExecutor": "implementation readiness workflow",
    "targetArtifacts": ["prd.md", "architecture.md"]
  }
}
```

返回 JSON 只要能解析成 governance hint candidate 即可，推荐格式：

```json
{
  "hint": {
    "confidence": "high",
    "suggestedStage": "architecture",
    "suggestedAction": "patch",
    "explicitRolePreference": ["critical-auditor"],
    "researchPolicy": "preferred",
    "delegationPreference": "ask-me-first",
    "constraints": ["docs-only"],
    "rationale": "Need a narrow architecture remediation."
  }
}
```

---

## Anthropic 示例

适用于：

- Anthropic 原生 Messages API
- 或任何兼容 `POST /messages` 的 Anthropic-compatible 网关

```yaml
version: 1
primaryHost: claude
packetHosts:
  - claude
  - cursor
  - codex

provider:
  mode: anthropic-compatible
  id: anthropic-governance
  baseUrl: https://api.anthropic.com/v1
  model: claude-opus-4-1-20250805
  apiKeyEnv: ANTHROPIC_API_KEY
  timeoutMs: 30000
  maxTokens: 512
  anthropicVersion: '2023-06-01'
```

说明：

- 代码会请求 `POST {baseUrl}/messages`
- 会自动发送 `x-api-key` 与 `anthropic-version`
- 响应需要在 `content[].text` 中返回 JSON hint 对象

---

## 宿主与 Provider 的关系

几个容易混淆的点：

1. `primaryHost: claude` 不等于 provider 必须走 Anthropic
2. `primaryHost: cursor` 也可以配 `openai-compatible` 或 `anthropic-compatible`
3. 宿主决定 packet / hook 消费路径，provider 决定治理 hints 的来源协议

换句话说，可以合法组合：

- `primaryHost: claude` + `provider.mode: openai-compatible`
- `primaryHost: cursor` + `provider.mode: anthropic-compatible`
- `primaryHost: codex` + `provider.mode: http-json`

---

## 环境变量建议

OpenAI：

```powershell
$env:OPENAI_API_KEY="..."
```

Anthropic：

```powershell
$env:ANTHROPIC_API_KEY="..."
```

不建议把真实 API Key 直接写进 YAML。
