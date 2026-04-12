# Readiness 审计提示词

本文件为 `_bmad/_config/code-reviewer-config.yaml` 中 `modes.readiness` 的 `prompt_template`。

适用场景：

- `implementation_readiness` score stage
- readiness report parseable block 生成合同
- Four-Signal Governance Contract 的结构化评分面

## 可解析评分块（强制）

readiness 报告必须包含以下可解析块，与 `modes.readiness.dimensions` 一致：

```markdown
## 可解析评分块（供 parseAndWriteScore）

总体评级: [A|B|C|D]

维度评分:
- P0 Journey Coverage: XX/100
- Smoke E2E Readiness: XX/100
- Evidence Proof Chain: XX/100
- Cross-Document Traceability: XX/100
```

禁止：

1. 使用区间分数或概括性文字代替逐行维度分
2. 使用 `A- / B+ / C+ / D-` 这类带修饰符的总体评级
3. 省略任一 readiness 维度
4. 只输出 narrative summary，不输出结构化 block
