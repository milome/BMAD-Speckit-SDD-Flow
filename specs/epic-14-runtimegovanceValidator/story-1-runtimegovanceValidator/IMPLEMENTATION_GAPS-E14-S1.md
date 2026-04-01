# IMPLEMENTATION_GAPS E14-S1 — Runtime Governance Story 14.1

## 1. Gap Matrix

| Gap ID | Authority Requirement | Current State | Gap Description | Closure Direction |
|---|---|---|---|---|
| GAP-001 | T12: 引入 RuntimePolicy 子结构 | `scripts/runtime-governance.ts` 仍以扁平 `RuntimePolicy` 为主 | 缺少 `identity / control / language` 子结构，无法作为后续治理与语言统一的稳定控制面 | 先引入子结构，再维持顶层兼容镜像 |
| GAP-002 | T13: 顶层兼容镜像与消费者迁移 | 现有测试主要覆盖 legacy-aligned fields | 尚无 mirror consistency tests 冻结新旧读取面的一致性；消费者迁移顺序未被文档化 | 首批 implement 新增 mirror tests，并更新主要消费者优先读子结构 |
| GAP-003 | T1/T2/T3: story-scoped isolation + runtime context schema + policy input identity | runtime-context schema 仍是简化结构；ResolveRuntimePolicyInput 缺少 story/run identity 字段 | 没有正式支持 storyId、storySlug、runId、artifactRoot、contextScope 等身份输入 | 扩展 schema、读写器、policy input 与 reason 可观察性 |
| GAP-004 | T4: emit 并发模式禁用共享 fallback | `runtime-context.md` 仍描述共享 fallback 行为；emit 契约未体现 story-scoped fail loud | 并发 story 模式下 shared root context fallback 仍有歧义 | 修改 emit 解析顺序与文档，增加 concurrency emit tests |
| GAP-005 | T5/T6: score/state 幂等与并发协议 | 已有 scoring-chain 测试，但未见 story/run 粒度唯一键与状态顺序冻结 | authoritative final pass 去重、state 单调推进规则未正式闭环 | 定义唯一键、冲突裁决与 state ordering tests |
| GAP-006 | T7/T8/T9/T10: dual-host automation | Story 文档要求 Cursor native hooks.json 主路径；当前仓内尚未完成完整 Story 级文档链收口 | 双宿主 transport-only、Cursor native envelope、hooks.json 自动落盘、统一文档口径尚未形成 Story 级闭环 | 在 T1–T13 稳定后推进 host adapter 文档、实现与 parity tests |
| GAP-007 | T14–T17: language ownership | 已有 `scripts/i18n/language-policy.ts` 与若干 i18n tests | 语言决策尚未正式收口到 Runtime Governance；缺少 runtime-governance-language-policy / audit-report-language-policy / scoring-language-policy / trace-language-policy / sft-language-policy tests | 将 languagePolicy 子策略挂入 RuntimePolicy，并补齐语言治理测试矩阵 |
| GAP-008 | T18: skill lightening | skills 仍包含较多动态治理说明文本 | 还未完成“skills 只保留骨架与静态约束”的正式边界冻结 | 在 governance 与 language 收口后清理 skill/prompt 中的第二控制面痕迹 |
| GAP-009 | T19: CI / regression closure | 现有验收命令存在，但并非全部 Story 14.1 新增测试已纳入 | mirror / native hooks / parity / language-governance / concurrency 新测试尚未全部入 CI | 最后批次补齐 CI wiring 与关单门槛 |
| GAP-010 | speckit 文档链 authority | 现有 spec/plan/tasks/GAPS 漂移到 fresh regression harness | 技术规格链与 Story 文档严重错位，无法作为实施依据 | 本次已重建文档链，以 Story 14.1 权威重新对齐 |

## 2. Blocking Gaps

### Critical Blockers

1. **RuntimePolicy 仍是扁平结构**
   - 直接阻塞 T12/T13 首批实施目标。
2. **缺少 mirror consistency tests**
   - 无法证明子结构迁移不打坏现有系统。
3. **speckit 文档链漂移**
   - 不先纠偏，后续 tasks 与 implementation 会继续跑偏。

### Major Gaps

1. **runtime context / policy input 缺少 story-scoped identity**
   - 它是 T12/T13 首批之后的下一个关键批次，不是与首批同级的立即实现 blocker。
2. Cursor native hooks.json 与 native envelope 的 Story 级实现/验证尚未闭合。
3. languagePolicy 尚未成为统一动态语言决策源。
4. skills 仍可能保留第二控制面与第二语言判断面。

## 3. Ordering Implications

实施顺序必须固定为：

1. **RuntimePolicy 结构化与兼容镜像**（T12/T13）
2. **runtime isolation / context / idempotency**（T1–T6）
3. **dual-host hooks automation**（T7–T10）
4. **language policy ownership**（T14–T17）
5. **skill lightening / CI closure**（T18–T19）

禁止事项：
- 不得把 skill 文案瘦身排在 RuntimePolicy 结构化之前。
- 不得把 narrative 双语化排在 `languagePolicy` 接入之前。
- 不得在并发模式下继续依赖共享 root context 作为默认真相源。

## 4. Closure Standard

每个 gap 只有在以下条件同时满足时视为闭合：

- 对应 Story requirement 与 authority plan 条目已在代码、测试、文档中对齐。
- 相关 acceptance / i18n / scoring / parity 测试通过。
- 没有引入第二控制面或第二语言判断面。
- 审计报告明确说明“本轮无新 gap”。

<!-- AUDIT: PENDING REBUILD -->
