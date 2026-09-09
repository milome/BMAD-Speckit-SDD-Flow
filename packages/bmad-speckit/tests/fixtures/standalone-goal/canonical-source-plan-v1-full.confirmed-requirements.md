# Requirements Contract

Request: `REQ-GOAL-SOURCE-NORMALIZATION-FULL-20260908-05`
Semantic revision: `SEMREV-0D5C8A146837319DFB3853D66228AAA41CA384E3698E534E55AD3AA0EB053153`
Binding revision: `BINDREV-3B8F37598A3D57B79CD1496537657C94D9F7A0B9FE7D7928CFF36D64ED471018`

## Requirements

### TASK-DATASERVICE-001

### WORK-01：冻结822旧行为characterization

Acceptance oracle: PASS：四类旧行为都有直接值/顺序证据且与本文件一致。
Requirement kind: functional
Polarity: positive

- TASK-DATASERVICE-001-A1: ### WORK-01：冻结822旧行为characterization
 | PASS：四类旧行为都有直接值/顺序证据且与本文件一致。

### TASK-DATASERVICE-002

### WORK-02：验证已冻结fixture并完成测试有效性审计

Acceptance oracle: PASS：manifest全部SHA/字段/事件可解析，replay factory可被Windows spawn，测试审计无未分类项。
Requirement kind: functional
Polarity: positive

- TASK-DATASERVICE-002-A1: ### WORK-02：验证已冻结fixture并完成测试有效性审计
 | PASS：manifest全部SHA/字段/事件可解析，replay factory可被Windows spawn，测试审计无未分类项。

### TASK-DATASERVICE-003

### WORK-03：收敛active、logical/actual和实时订阅

Acceptance oracle: PASS：只有一个canonical active可写，切换顺序、stream fence、actual换月和无K_1M全部成立。
Requirement kind: functional
Polarity: positive

- TASK-DATASERVICE-003-A1: ### WORK-03：收敛active、logical/actual和实时订阅
 | PASS：只有一个canonical active可写，切换顺序、stream fence、actual换月和无K_1M全部成立。

### TASK-DATASERVICE-004

### WORK-04：单线程ingress与canonical增量聚合

Acceptance oracle: PASS：同Tick只聚合一次，边界Tick直通，4H/DAILY open正确，一次rollover一个batch。
Requirement kind: functional
Polarity: positive

- TASK-DATASERVICE-004-A1: ### WORK-04：单线程ingress与canonical增量聚合
 | PASS：同Tick只聚合一次，边界Tick直通，4H/DAILY open正确，一次rollover一个batch。

### TASK-DATASERVICE-005

### WORK-05：DataManager coverage和现有history IPC

Acceptance oracle: PASS：DataManager唯一写repair DB，DataService DB write为0，头中尾缺口和所有临时SHM终态有直接证据。
Requirement kind: functional
Polarity: positive

- TASK-DATASERVICE-005-A1: ### WORK-05：DataManager coverage和现有history IPC
 | PASS：DataManager唯一写repair DB，DataService DB write为0，头中尾缺口和所有临时SHM终态有直接证据。

### TASK-DATASERVICE-006

### WORK-06：SQLite completed幂等入口

Acceptance oracle: PASS：无schema变化、无replace覆盖、一次list一次transaction、冲突可交DataManager。
Requirement kind: functional
Polarity: positive

- TASK-DATASERVICE-006-A1: ### WORK-06：SQLite completed幂等入口
 | PASS：无schema变化、无replace覆盖、一次list一次transaction、冲突可交DataManager。

### TASK-DATASERVICE-007

### WORK-07：cold/hot权威、局部refresh和稳定GDS

Acceptance oracle: PASS：DB/hot/current权威唯一，缺口不伪造bar，未受影响segment持续，GDS普通读取稳定。
Requirement kind: functional
Polarity: positive

- TASK-DATASERVICE-007-A1: ### WORK-07：cold/hot权威、局部refresh和稳定GDS
 | PASS：DB/hot/current权威唯一，缺口不伪造bar，未受影响segment持续，GDS普通读取稳定。

### TASK-DATASERVICE-008

### WORK-08：恢复legacy指标输入和L1/L2/LMDB

Acceptance oracle: PASS：BOLL及全部注册指标沿同一旧链，current不清空prefix，cold/warm LMDB一致。
Requirement kind: functional
Polarity: positive

- TASK-DATASERVICE-008-A1: ### WORK-08：恢复legacy指标输入和L1/L2/LMDB
 | PASS：BOLL及全部注册指标沿同一旧链，current不清空prefix，cold/warm LMDB一致。

### TASK-DATASERVICE-009

### WORK-09：Qt映射、绘制和4H/DAILY open

Acceptance oracle: PASS：4H/DAILY open、断线、LMDB映射和最小化恢复均由真实Qt终点证明。
Requirement kind: functional
Polarity: positive

- TASK-DATASERVICE-009-A1: ### WORK-09：Qt映射、绘制和4H/DAILY open
 | PASS：4H/DAILY open、断线、LMDB映射和最小化恢复均由真实Qt终点证明。

### TASK-DATASERVICE-010

### WORK-10：Recorder本地配置和Tick消费

Acceptance oracle: PASS：配置只归Recorder且消费边界确定，DataService配置命令次数为0，非active配置不订阅。
Requirement kind: functional
Polarity: positive

- TASK-DATASERVICE-010-A1: ### WORK-10：Recorder本地配置和Tick消费
 | PASS：配置只归Recorder且消费边界确定，DataService配置命令次数为0，非active配置不订阅。

### TASK-DATASERVICE-011

### WORK-11：CompletedRolloverBatch、旧落库节奏和checkpoint

Acceptance oracle: PASS：一次rollover一个batch/sequence/ACK，同batch高周期一次事务，三个崩溃窗口和overrun恢复均无丢失重复。
Requirement kind: functional
Polarity: positive

- TASK-DATASERVICE-011-A1: ### WORK-11：CompletedRolloverBatch、旧落库节奏和checkpoint
 | PASS：一次rollover一个batch/sequence/ACK，同batch高周期一次事务，三个崩溃窗口和overrun恢复均无丢失重复。

### TASK-DATASERVICE-012

### WORK-12：CTA、EVENT_TICK、Oms和execution quote

Acceptance oracle: PASS：CTA私有回调、第三方EVENT_TICK、Oms交易读取和追价全部恢复，主进程高频重计算为0。
Requirement kind: functional
Polarity: positive

- TASK-DATASERVICE-012-A1: ### WORK-12：CTA、EVENT_TICK、Oms和execution quote
 | PASS：CTA私有回调、第三方EVENT_TICK、Oms交易读取和追价全部恢复，主进程高频重计算为0。

### TASK-DATASERVICE-013

### WORK-13：Trigger逐Tick candidate链

Acceptance oracle: PASS：Trigger不等timer、不直接交易、不永久停止，重试同一intent，overrun恢复不调用DataManager。
Requirement kind: functional
Polarity: positive

- TASK-DATASERVICE-013-A1: ### WORK-13：Trigger逐Tick candidate链
 | PASS：Trigger不等timer、不直接交易、不永久停止，重试同一intent，overrun恢复不调用DataManager。

### TASK-DATASERVICE-014

### WORK-14：query生命周期和恢复

Acceptance oracle: PASS：无250ms重试风暴、无普通query重启、无迟到GDS覆盖或SHM泄漏。
Requirement kind: functional
Polarity: positive

- TASK-DATASERVICE-014-A1: ### WORK-14：query生命周期和恢复
 | PASS：无250ms重试风暴、无普通query重启、无迟到GDS覆盖或SHM泄漏。

### TASK-DATASERVICE-015

### WORK-15：全链验收与性能对照

Acceptance oracle: PASS：所有scenario PASS，PERF-001至020通过，evidence index无缺项且生产database.db hash不变。
Requirement kind: functional
Polarity: positive

- TASK-DATASERVICE-015-A1: ### WORK-15：全链验收与性能对照
 | PASS：所有scenario PASS，PERF-001至020通过，evidence index无缺项且生产database.db hash不变。

### TASK-DATASERVICE-016

### WORK-16：删除被替代旁路并执行最终回归

Acceptance oracle: PASS：只有一条生产链，所有AC/PERF通过，修改/暂存文件均在合同授权范围。
Requirement kind: functional
Polarity: positive

- TASK-DATASERVICE-016-A1: ### WORK-16：删除被替代旁路并执行最终回归
 | PASS：只有一条生产链，所有AC/PERF通过，修改/暂存文件均在合同授权范围。

## Confirmed Decisions

No user decisions were required.

## Authority Citations

- EVIDENCE-CLAIM-TYPED-SOURCE-GRAPH: source_grounded

## Confirmation

```text
确认以上需求范围进入下一阶段
requestId=REQ-GOAL-SOURCE-NORMALIZATION-FULL-20260908-05
semanticRevisionId=SEMREV-0D5C8A146837319DFB3853D66228AAA41CA384E3698E534E55AD3AA0EB053153
scopeSemanticHash=sha256:2ff9fb10cd4148882665a45db9bc6957a2d41c8ec3804940f0b39f1a1789e4f5
bindingRevisionId=BINDREV-3B8F37598A3D57B79CD1496537657C94D9F7A0B9FE7D7928CFF36D64ED471018
requirementsEffectivePassHash=sha256:9fa331e3a4158c09d2ad0c9b044287a1b8ff44ccd3eb0de5044aea898ade2f68
```
