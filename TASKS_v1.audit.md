# TASKS_v1.audit - Gate Audit Checklist

> 用途：与 `TASKS_v1.md` 配套。每完成一个任务即执行本清单，形成统一 gate 证据，避免“完成了但不可验证”。
>
> 统一引用（single source）：
> - 策略层：`_bmad/_config/orchestration-governance.contract.yaml`
> - 事实层：`_bmad-output/runtime/governance/user_story_mapping.json`

---

## 0. 时序图参考（主循环对照）

- **现状与目标态**的时序图及 **Host parity 泳道子图**见 `TASKS_v1.md` **第 0.3 节**（0.3.1 / 0.3.2 / **0.3.3**；含 Mermaid 源码，便于评审与 diff）。
- 审计 **G1（主循环契约）** 时，应用该时序逐项核对：`inspect → dispatch-plan → packet 生命周期 → ingest → closeout` 未被第二 orchestrator、隐式聊天或平行策略源旁路替代。

---

## A. 全局审计规则（每个任务都要执行）

1. **证据优先**：没有命令输出摘要或工件路径，视为未完成。
2. **主控一致性**：不得引入“第二 orchestrator”行为（后台自行推进主流程）。
3. **语义一致性**：`hooks/no-hooks` 必须同构，不允许出现两套 nextAction 语义。
4. **完成语义**：必须满足 `gate pass + closeout approved`，否则任务只能标记为 `partial`。
5. **可回滚**：任何高风险改动必须给出回退策略或 feature flag。
6. **单一真相源**：策略层只认 `orchestration-governance.contract.yaml`，事实层只认 `user_story_mapping.json`。
7. **边界契约**：
   - contract 只定义规则，不存运行事实；
   - mapping 只存事实，不存规则阈值；
   - runtime policy 只存会话参数，并带 `contractHash + mappingHash`；
   - 主循环判定只认 `inspect surface` 单入口；
   - single-source 测试失败即整体验收失败。
8. **字段白名单**：以 `TASKS_v1.md` §0.1.2 为准；白名单外字段一律判定违规。

---

## B. Gate 分级

### G0 - 变更完整性 Gate
- [ ] 代码改动与任务目标一致（无越界实现）
- [ ] 必要文档更新已完成
- [ ] 对应测试文件已新增/更新
- [ ] 无破坏性改动未声明

### G1 - 主循环契约 Gate
- [ ] 主 Agent 仍为唯一 owner
- [ ] 子代理仍为 bounded execution
- [ ] `recommendation` 不可直接 dispatch（有防护）
- [ ] `inspect -> dispatch-plan -> packet lifecycle -> ingest -> closeout` 主链未破坏

### G2 - 状态机与恢复 Gate
- [ ] 幂等性通过（重复执行无重复副作用）
- [ ] 中断恢复通过（resume 后状态一致）
- [ ] `gatesLoop` 重试/熔断行为符合预期
- [ ] 状态工件可追溯（state/packet/report 路径可读）

### G3 - Host Parity Gate
- [ ] Cursor 路径通过
- [ ] Claude 路径通过
- [ ] no-hooks 路径通过
- [ ] 三路径关键字段一致（phase/nextAction/pendingPacket）

### G4 - Closeout Gate
- [ ] 仅在 gate pass 后进入 closeout
- [ ] closeout 结果写回 orchestration state
- [ ] 未通过 closeout 不得标记 done

### G5 - Contract/Index Gate（新增）
- [ ] five-signal 与 stage gate 规则仅来自 contract
- [ ] 路由/漂移/纳管事实仅来自 user_story_mapping index
- [ ] 主循环不存在第三策略来源（文档/临时脚本/硬编码）
- [ ] contract 文件版本与运行日志记录一致
- [ ] `adaptive_intake_governance_gate` 在 intake/reroute/closeout 前触发
- [ ] runtime policy 仅包含会话参数，且附 `contractHash + mappingHash`
- [ ] 主循环判定仅经 `inspect surface`（无旁路判定）
- [ ] contract/mapping/runtimePolicy 字段均符合白名单（见 `TASKS_v1.md` §0.1.2）
- [ ] 未出现白名单外字段或黑名单字段

---

## C. 任务级审计清单（对应 TASKS_v1 逐项）

## M1 审计

### T1.1 Host Parity 回归矩阵
- [ ] 新增回归测试可在 CI 稳定运行
- [ ] 基线报告已输出到 `docs/ops/host-parity-regression-matrix.md`
- [ ] 失败样例有明确分类（host bug / orchestration drift / flaky）

### T1.2 State 幂等与重入
- [ ] claim/dispatch/complete/invalidate 重复执行无污染
- [ ] 中断点恢复后 `originalExecutionPacketId` 未丢失
- [ ] `gatesLoop.retryCount` 行为正确

### T1.3 Gates Loop 异常补偿
- [ ] retry budget 生效
- [ ] no-progress 熔断生效
- [ ] 熔断后 nextAction = blocked 且有 machine-readable reason

### T1.4 Contract/Index 收敛接入
- [ ] `orchestration-governance.contract.yaml` 已创建并生效
- [ ] `user_story_mapping.json` 已创建并生效
- [ ] 主循环只读取 contract + index

### T1.5 StageName 对齐治理合同
- [ ] `stage_requirements` 键与运行时 `StageName` 对齐（无静默未定义阶段）
- [ ] `tests/acceptance/governance-stage-requirements-alignment.test.ts` 在 CI 稳定通过
- [ ] 对齐结果已记入本 audit-log 对应条目

### T1.6 返工闭环自动续跑
- [ ] 触发 `auto_repairable_block` 后，主循环进入 `dispatch_remediation`
- [ ] 返工 `TaskReport(done)` 后，1 个主循环周期内自动产生复审下一跳（非人工触发）
- [ ] 复审通过可回主链（`dispatch_implement`/`run_closeout`）；失败可受控再返工
- [ ] Cursor/Claude/no-hooks 三路径等价通过同一 E2E fixture
- [ ] 审计证据包含命令输出摘要 + 状态工件路径（缺一不可）

### T1.7 Release Gate 总控脚本
- [ ] `main-agent:release-gate` 单命令可聚合关键门禁并返回唯一 pass/fail
- [ ] 任一子门禁失败时 exit code 非 0
- [ ] 报告输出包含失败项、证据路径、修复建议

### T1.8 代码质量退化硬阈值
- [ ] 质量阈值（lint/复杂度/重复/关键覆盖）可机器校验
- [ ] 任一阈值 breach 时 `main-agent:quality-gate` 失败
- [ ] 阈值文档与脚本版本一致（不一致直接 fail）

### T1.9 审计状态自动回写
- [ ] `task-audit:sync-status` 自动更新 audit-log 状态板
- [ ] 检测上游 fail 下游 pass/in_progress 并返回失败
- [ ] 检测手工篡改状态且无证据并返回失败

### T1.10 故障注入与恢复验收
- [ ] 覆盖最小故障集（packet 丢失/closeout fail/pending gate/中断恢复/host 切换）
- [ ] 每个场景有可恢复证据与恢复步数记录
- [ ] 任一场景未恢复到可继续状态则测试失败

### T1.11 P0 硬校验（validate-single-source-whitelist）
- [ ] `validate:single-source-whitelist` 可执行且 fail-closed
- [ ] contract/mapping/runtimePolicy 字段越界可被检测并阻断
- [ ] 缺失 `contractHash/mappingHash` 会失败

### T1.12 P0 闭环校验（main-agent-rerun-gate-e2e-loop）
- [ ] `test:main-agent-rerun-gate-e2e-loop` 可执行且稳定
- [ ] `rerun_gate` 后自动续跑复审被证明（无需人工二次触发）
- [ ] 闭环失败场景能返回非 0 并给出证据

### T1.13 P0 总门禁（main-agent:release-gate）
- [ ] release-gate 聚合 T1.11 + T1.12 + 关键 gate
- [ ] 任一子门禁失败时整体失败（exit code 非 0）
- [ ] 未通过 release-gate 禁止宣称完成

### T1.14 P0 写入前置闭环（sprint-status 资格令牌）
- [ ] release-gate 通过后才签发 `completion-intent` 令牌
- [ ] 无令牌执行 sprint-status 写入必须失败（exit code 非 0）
- [ ] 写入审计记录包含 `sessionId/contractHash/gateReportPath/storyKey/fromStatus/toStatus`
- [ ] 不存在未授权脚本写入 sprint-status 的旁路路径

### T1.15 P0 真用户路径 E2E（双宿主 Claude/Codex）
- [ ] 双宿主 journey runner 覆盖 mock/real 两层
- [ ] E2E 通过前禁止推进 sprint-status 状态
- [ ] 合同 preflight/postflight 均输出结构化证据
- [ ] Claude/Codex 在同一 fixture 下结论一致（pass/fail 一致）

### T1.16 P0 反旁路硬门禁（sprint-status 写路径）
- [ ] `validate:sprint-status-write-path` 可检测并阻断非授权写入
- [ ] release-gate 报告含 `blocked_sprint_status_update` 且语义正确
- [ ] 检测到旁路写入时，必须输出“禁止更新 sprint-status”的明确阻断原因

---

## M2 审计

### T2.1 Long-Run Runtime Policy
- [ ] 长跑策略参数可配置（checkpoint/compaction/retry budget）
- [ ] 参数被主循环真实消费，不是仅文档声明
- [ ] 回归测试覆盖策略边界值

### T2.2 Soak Test (>=8h)
- [ ] soak 脚本可运行
- [ ] 报告模板已落地并有样例输出
- [ ] 恢复成功率达到目标（>=95%）

---

## M3 审计

### T3.1 Churn-in 路由评分器
- [ ] 评分维度可解释（impact/dependency/capacity）
- [ ] reroute 不跳出主循环
- [ ] story/bugfix/standalone 三类都有覆盖用例

### T3.2 Sprint Epic/Story Queue 自动联动
- [ ] Epic/Story Queue 更新工件可追溯
- [ ] 依赖关系更新正确
- [ ] 增量注入后 DoD/Gate 不被绕过

### T3.3 Adaptive Intake Governance Gate
- [ ] 匹配评分（domain/dependency/sprint/risk/readiness）有输出证据
- [ ] mapping/lifecycle/sprint 三类一致性检查有结果记录
- [ ] 任一一致性失败时 verdict=block
- [ ] reroute 后旧 active mapping 正确降级

---

## M4 审计

### T4.1 Parallel Planner + Write Scope Lock
- [ ] 并行分组规则可解释
- [ ] writeScope 冲突检测准确
- [ ] 冲突后自动重排或降级串行有证据

### T4.2 PR Topology Orchestration
- [ ] PR DAG 工件生成成功
- [ ] create/update/sync/merge 规则可验证
- [ ] gate 失败时不会错误推进后续 merge 节点

---

## M5 审计

### T5.1 ADR Drift Guard
- [ ] drift 检查脚本能检测“第二 orchestrator”回归
- [ ] 与 ADR 原则冲突时测试失败
- [ ] 失败信息具备修复指引

### T5.2 三向追踪矩阵
- [ ] 5大目标均映射到代码路径
- [ ] 每个目标均映射至少1个 acceptance test
- [ ] 映射文档可被审计自动消费（结构化）

### T5.3 Single Source Guard
- [ ] 平行标准检测测试已接入
- [ ] 读取来源越界会导致测试失败
- [ ] 报告可指出违规来源路径

---

## D. 标准审计记录模板（每任务一份）

```md
## Audit Record: <Task ID>

- Date:
- Owner:
- Scope:

### Evidence
- Commands run:
  - `<command>`
- Output summary:
  - `<key result>`
- Artifacts:
  - `<path>`

### Gate Results
- G0:
- G1:
- G2:
- G3:
- G4:
- G5:

### Verdict
- pass | partial | fail

### Follow-ups
- [ ] item 1
- [ ] item 2
```

---

## E. 建议执行顺序

1. 每完成一个 `T*`，先跑对应测试，再填一份 Audit Record。
2. 每个里程碑（M1~M5）结束时，执行一次 G0~G5 全量复核。
3. 任一 Gate fail：立即进入修复，不得推进下一任务。
4. 任一 Contract/Index 路径缺失：直接 fail，不允许降级跳过。

