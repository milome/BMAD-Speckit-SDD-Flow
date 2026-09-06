---
文档类型: Goal Source Plan
文档版本: dataservice-cold-hot-legacy-chain-source/v6
文档状态: 待人工审阅
文档日期: 2026-09-05
行为权威提交: 822c715e6e02c935f309ec07f919514825202583
实施起点提交: c276ba923e40c9c481db59abf3349f2e4f23d004
时段规则提交: 09593a1c1bf8b928679827367ddb60d4155a4099
目标合同版本: goal-execution-contract/v1
目标合同模式: frozen
目标执行模式: execute_only
---

# DataService 冷热数据与旧指标链最小迁移修复 Source Plan

## 1. 文档用途与当前门禁

本文件是本次 DataService 修复的唯一 Source Plan。它冻结业务目标、旧行为证据、目标数据流、模块所有权、最小修改边界、逐场景验收和性能门禁，供用户人工审阅和 GoalExecutionIR/v1 编译使用。

本文件当前状态为“待人工审阅”。用户明确确认本版本之前：

- 不得生成 Goal 合同。
- 不得执行 Goal。
- 不得修改生产代码。
- 不得修改测试代码。
- 不得修改数据库、配置、依赖或 Git 历史。
- 不得把本 Source Plan 视为实施授权。
- 本轮只执行本 Source Plan 的审阅、修订和大文档写入 receipts。

本轮交付只更新本文件。BOLL 5m 只是强制验证样本，不是专用实现分支，也不是唯一需要恢复的指标。

## 2. 冻结目标

REQ-GOAL-001：实施者必须把 DataService 重构收敛为一次最小迁移：把旧主进程或旧 Worker 的历史读取适配、实时共享 K 线聚合和 IPC 发布移入 DataService，其他已经由用户验证的业务语义保持不变。

REQ-GOAL-002：唯一有效数据模型固定为：

```text
effective_series = cold_historical_baseline ⊕ hot_completed_tail ⊕ hot_current_bar
```

其中 `⊕` 是按 `(vt_symbol, interval, period_start)` identity 合并、校验和排序，不是 Python list 直接拼接。

REQ-GOAL-003：实施者必须修复以下已经观察到的用户问题：

- 多周期图表 BOLL 5m 加载不正确。
- BOLL 指标线缺失或只显示 completed prefix。
- current 5m BOLL 不随实时价格正确更新。
- 实时未完成 4H K 线 open 错误。
- 实时未完成 DAILY K 线 open 存在回退风险。
- 非空历史中的中间缺口没有在计算和绘制前补齐。
- 图表拖拽触发 canonical query 重试风暴。
- 普通 query 导致 Worker 或 DataService 反复重启。
- 重构后冷启动和 warm 指标加载性能低于行为基线。
- DataRecorder 新架构下缺少可验证的 completed 接收、写库和 UI 状态链。
- vn.py 原有 Tick 回调消费者存在断链或轮询替代风险。

REQ-GOAL-004：修复必须作用于全部已注册指标共享的数据输入、缓存、LMDB、映射和绘制链。不得根据指标名称、指标 ID 或 `BOLL` 字符串在 DataService、IndicatorRuntime、Worker、缓存或 UI 中创建专用旁路。

REQ-GOAL-005：性能优化仅发生在以下位置：

- DB 范围读取和增量加载。
- Cold Range Cache。
- hot completed/current 的增量维护。
- K 线聚合的进程归属。
- TickDatabus、GDS 和 Queue IPC。
- 共享内存稳定分配和读取。
- 单次数据发布。
- 多图表、多指标共享同一 effective series。

REQ-GOAL-006：性能优化不得改变以下用户语义：

- Tick 到 K 线的 OHLCV、turnover、open interest 计算。
- K 线 period identity 和 `datetime_end`。
- 交易时段和跨日边界。
- 指标输入数组、公式、参数和输出。
- L1、L2、LMDB L3 契约。
- period value 到 1m index 的映射。
- 主图与副图 PlotDataItem 的实际 xData/yData。
- CTA 策略 `on_tick/on_bar/on_window_bar`。
- OmsEngine `get_tick()`、手工交易和追价行为。
- DataRecorder 配置、保存时机、日志、统计和 UI 状态。

## 3. 权威顺序

发生冲突时必须按以下顺序裁决：

1. 本 Source Plan 明文冻结的业务规则。
2. 用户已经实际验证的提交 `822c715e6e02c935f309ec07f919514825202583` 的旧业务行为。
3. `2026-07-20 17:00` 起生效的 HKFE V2 时段规则，以 `09593a1c1bf8b928679827367ddb60d4155a4099` 和当前 `vnpy/trader/period_utils.py` 中的 cutover 定义为准。
4. 当前 HEAD `c276ba923e40c9c481db59abf3349f2e4f23d004` 只用于定位现状、文件路径、调用链和待删除旁路。
5. 当前测试只作为现状证据，不得覆盖真实用户行为和本文件。
6. 当前工作区未提交文件不得自动成为需求、实现或验收权威。

REQ-AUTH-001：`822c715e6` 是指标公式、指标输入、L1/L2/LMDB、映射、绘制、Recorder 业务时机、主连映射顺序和 vn.py 回调语义的行为基线。

REQ-AUTH-002：HKFE V2 只覆盖时段切换：`2026-07-20 17:00` 及之后夜盘起点为 `17:00`；此前仍为 `17:15`。历史数据必须按 bar 市场时间选择 V1 或 V2，禁止按程序当前日期统一回算。

REQ-AUTH-003：当前代码中的 revision winner、业务 snapshot 权威、只含 completed 的指标输入旁路、服务端冻结旧视图、查询 TTL、普通 descriptor lease、Recorder 配置两阶段事务和实时 `K_1M` seed，均不得因为已经存在而被认定为需求。

REQ-AUTH-004：实现与本文件冲突时必须修改实现；测试与本文件冲突时必须先判定测试无效，再按真实生产链重写测试。

REQ-AUTH-005：无法从本文件、`822c715e6`、时段权威提交和实际仓库路径确定的业务决策必须失败关闭，返回 `blocked_by_contract_ambiguity:<exact_field>`，不得自行扩展语义。

## 4. 最小重构边界与完整业务流

### 4.1 一句话边界

DataService 只替换数据来源和共享位置，不替换旧指标算法、缓存算法、图表映射、策略回调和 Recorder 用户语义。

### 4.2 唯一 active 合约

REQ-FLOW-001：全程序同时仅有一个 active 行情合约。active 合约由用户在“查询合约”窗口设置；启动时恢复该窗口的持久化选择；不存在有效选择时由主进程发送默认值 `MHImain.HKFE`。

REQ-FLOW-002：合约目录、历史查询、Recorder 保存配置和图表 interval 切换都不得创建第二个实时订阅合约。

REQ-FLOW-003：Recorder 中保存但不是当前 active 的合约配置保持 dormant。切换到该合约时先由 DataManager 完成目标历史缺口检查和补齐，再建立唯一实时流。

### 4.3 目标进程拓扑

```text
用户“查询合约”窗口
→ 主进程 RuntimeSupervisor 转发 active command
→ DataService 复用旧 main_contract_mapping 解析 logical/actual
→ FUTU QUOTE / ORDER_BOOK callback
→ DataService 单线程 ingress
   ├─ 同一进程直接更新 latest Tick 状态
   ├─ 同一进程直接更新 canonical 1m 与多周期聚合器
   ├─ TickDatabus SHM ring
   │  ├─ CTA 子进程：process_tick_event → strategy.on_tick → 策略私有 BarGenerator
   │  ├─ Trigger 子进程：逐 Tick 判断 → candidate Queue
   │  ├─ Recorder 子进程：仅在 tick_recordings 命中时批量保存 Tick
   │  ├─ 主进程 compatibility bridge：EVENT_TICK → OmsEngine/latest UI
   │  └─ execution quote consumer：FUTU 追价快速唤醒
   ├─ 稳定 GDS：图表与全部指标共享 effective series
   └─ bounded CompletedBarLog：每次 canonical 1m rollover 发布一个 CompletedRolloverBatch
      └─ DataRecorder 按自己的 batch cursor、配置快照和 checkpoint 过滤并持久化

DataManager
→ 计算 completed 1m 历史覆盖和精确缺口
→ 通过现有 HistoricalBarRequest 请求 DataService 使用唯一 OpenD context 下载
→ DataManager 规范化、写 DB、回读、复验
→ 通知 DataService 局部刷新 cold baseline

DataService legacy contract
→ 旧 L1 周期 K 线缓存
→ 旧 L2 completed-prefix 结果复用
→ 已注册指标原 calculate/compute 入口
→ LMDB L3 u0/u1
→ index_ranges 映射
→ Qt 真实 PlotDataItem
```

### 4.4 DataService 接收 Tick 后的固定步骤

每个 FUTU callback 必须在同一个 ingress 所有权线程内按以下顺序处理：

1. 将供应商 actual symbol 按 `822c715e6` 的 `main_contract_mapping` 投影为唯一 canonical `vt_symbol`。
2. 校验 canonical identity、时区、事件时间、价格、累计 volume、turnover、open interest 和盘口字段的基本合法性。
3. 为本地传输分配单调 `tick_sequence`。该序号只表示 DataService 已接收事件的传输顺序，不声明供应商逐笔数据完整。
4. 按 `822c715e6` 的 QUOTE 与 ORDER_BOOK 字段合并方式更新同一 latest Tick 状态。
5. 将 raw Tick envelope 写入 TickDatabus，供需要逐 Tick 的独立消费者读取。
6. 使用旧版限流、重复和迟到规则判断该 Tick 是否进入 canonical K 线聚合器。
7. 新分钟或新 period 的首个 Tick 必须绕过普通同周期限流，先完成上一周期 rollover，再建立新 current。
8. accepted Tick 在 DataService 进程内直接更新聚合器；DataService 禁止写 TickDatabus 后再读回自己的 Tick 进行聚合。
9. 同 period 只原位更新 current；rollover 只完成并追加一根 bar。
10. 更新稳定 GDS 的 current 区域和映射元数据；不得为每个 Tick 重建全历史。
11. canonical 1m rollover 时，先收集该边界同时完成的 1m 和全部目标周期 bar，按固定 interval 顺序组成一个 `CompletedRolloverBatch`。
12. 将 batch 中每根 canonical bar 各写入对应 hot tail；随后为整个 batch 分配一个 `batch_sequence`，向 bounded `CompletedBarLog` 追加一次。禁止按 batch 内 bar 数量分配多个 sequence。
13. 同一规范化 Tick 只向 TickDatabus 发布一次。启动缓存的内部重放只进入 canonical 聚合器，不得再次发布给 CTA、Trigger、Recorder Tick、EventEngine compatibility bridge 或 execution quote consumer。

### 4.5 三种连续性不得混淆

REQ-FLOW-004：供应商行情不提供可证明的逐笔全序列，因此本地 `tick_sequence` 跳号或连续都不能证明市场 Tick 是否缺失。

REQ-FLOW-005：旧版 Tick 限流有意跳过部分同周期 Tick。被限流 Tick 不进入 canonical 聚合不等于历史 K 线缺口，不得触发 DataManager、DB 重读、READY 撤销或进程重启。

REQ-FLOW-006：TickDatabus consumer cursor 落后并被 ring 覆盖，表示该消费者发生 transport overrun。它只影响该消费者的逐 Tick 语义，不得伪装成可由历史 K 线补回的 Tick。

REQ-FLOW-007：历史 K 线完整性只通过交易日历、V1/V2 交易时段和 requested completed 1m identities 检查。发现头部、中间或尾部 completed 1m 缺口时才进入 DataManager 缺口修复。

### 4.6 模块唯一所有权

| 模块 | 唯一职责 | 明确禁止 |
|---|---|---|
| 查询合约窗口 | 设置和持久化唯一 active logical symbol | Supervisor、Recorder、首次图表 query 自选 active |
| RuntimeSupervisor | 进程生命周期、命令和状态转发、generation fence | 选择业务合约、计算 coverage、裁决 DB/hot |
| DataService | 唯一 active 行情接入、canonical K 线聚合、cold/hot 内存、GDS 发布 | 写 DB、计算指标、执行交易、读取自身 TickDatabus 聚合 |
| DataManager | coverage、精确缺口范围、历史规范化、DB 修复、回读复验 | 维护实时 current、直接向图表发布下载结果 |
| DataRecorder | 按自身 UI 配置消费 Tick/completed 并持久化 | 重新聚合 canonical K 线、决定 DataService interval、裁剪 hot tail |
| CTA 子进程 | 消费 Tick 并维持策略私有回调和 BarGenerator | 成为共享 canonical bar 写入者 |
| Trigger 子进程 | 逐 Tick 判断止损止盈并发送 candidate | 调用真实交易 API、依赖主进程一秒 timer 判定 |
| Gateway/OrderExecutionGate | 订单生命周期、下单、撤单、追价 | 聚合图表 K 线、承担指标计算 |
| OmsEngine | 通过 EVENT_TICK 维护 O(1) latest Tick 缓存 | 执行 K 线聚合、DB I/O、指标计算 |
| IndicatorRuntime/Worker | 使用 legacy contract 执行旧 L1/L2/指标/LMDB | 直接查 DB、重建第二套 period 数据 |
| Qt 图表 | 映射和绘制已发布数据 | 下载、补缺、聚合、裁决、同步全量计算 |

### 4.7 active stream 的唯一身份和切换顺序

REQ-FLOW-008：实时流身份固定为：

```text
stream_key = (service_generation, active_generation)
```

- `service_generation` 在 DataService 每次成功启动新进程时递增。
- `active_generation` 在同一 DataService 进程内每次用户切换 logical active 时递增。
- 用户切回先前使用过的同一 logical symbol 仍创建新的 `active_generation`。
- actual 月份自动换月不改变 `service_generation`、`active_generation` 或 `stream_key`。
- 不再增加独立 `tick_epoch`、mapping version 或随机 stream id 表达同一生命周期事实。

REQ-FLOW-009：用户切换 logical active 的顺序固定为：

```text
查询合约窗口提交目标 logical symbol
→ RuntimeSupervisor 转发切换请求
→ DataManager 在旧 active 继续运行期间检查并补齐目标 symbol 的启动历史范围
→ DataManager 回读复验成功
→ DataService ingress dispatcher 串行订阅目标 actual 的 QUOTE/ORDER_BOOK
→ 订阅成功后完成旧 callback 队列边界
→ 封存旧 stream_key 并发布 STREAM_SEAL(final_batch_sequence)
→ active_generation 加一并建立新 TickDatabus、GDS、hot store 和 CompletedBarLog
→ 原子切换 callback 接受目标和 canonical mapping
→ 取消旧 actual 订阅
→ 返回 ACTIVE_ACK(new_stream_key)
```

- 目标历史补齐或新 actual 订阅失败时，不封存旧 stream，旧 active 继续工作，切换请求返回 FAILED。
- subscribe new 到 unsubscribe old 的短暂重叠只用于连接交接；ingress dispatcher 任一时刻仅有一个 actual callback 更新 canonical 数据。
- 旧 `CompletedRolloverBatch` 可在 seal 后继续被 Recorder drain，但 envelope、ACK、checkpoint 和 cursor 必须携带旧 `stream_key`，不得推进新 stream checkpoint。
- 收到 `STREAM_SEAL` 且 Recorder checkpoint 达到 `final_batch_sequence` 后，旧 stream 才完成正常 drain。
- DataService 异常退出时旧 stream 标记为 `ABORTED`，不得伪造 `STREAM_SEAL`；恢复责任转交 DataManager coverage。

REQ-FLOW-010：一次 canonical 1m rollover 的 completed 发布粒度固定为：

```text
rollover boundary
→ CompletedRolloverBatch(
     stream_key,
     batch_sequence,
     rollover_period_start,
     bars=[本边界完成的1m/5m/15m/30m/45m/1h/4h/DAILY]
   )
→ Recorder 按本地配置把每根 bar 标为 selected 或 skipped
→ 同 batch 的 selected 高周期 bars 合并为一次 immediate save_bar_data(list, stream=False)
→ selected 1m 和 immediate 失败项进入原 timer buffer
→ timer flush 一次 save_bar_data(buffered_bars, stream=True)
→ batch 内全部 selected bar durable、全部不匹配 bar skipped
→ checkpoint=batch_sequence
→ ACK(batch_sequence)
```

- `bars` 只包含该边界真实完成的周期，不创建未完成周期占位项。
- 一个 batch 只有一个 sequence、一个最终 checkpoint 和一个 ACK；禁止“一根 completed bar 一个 envelope/sequence/ACK”。
- batch 内高周期合并一次 SQLite transaction 是减少不同周期独立写入会话的边界；它不得把旧 Tick/1m timer batch 改成逐事件写库。
- Recorder 配置在 batch 首次消费、尚未进入本地 buffer 前判定。selected/skipped identities 和 durability 状态进入该 batch checkpoint；崩溃重放沿用已记录决定，不重新按新配置解释旧 batch，也不引入 config version 或两阶段配置事务。

### 4.8 不得引入的替代架构

- 不使用实时 `K_1M` 订阅建立 current 或启动 seed。
- 不使用 revision、generation 或 sequence 选择 DB/hot winner。
- 不把 query snapshot 变成数据权威或缓存层。
- 不保留停止更新的上一帧作为系统继续运行的权威。
- 不为 Recorder 配置设计 `CONFIG_PREPARE/CONFIG_COMMIT` 两阶段协议。
- 不为普通 GDS reader 引入 TTL 或 consumer lease。
- 不建立多个 active TickDatabus 或多个合约并行实时录制。
- 不建立第二套 completed broker、durable outbox或跨 SQLite/SHM 分布式事务；只复用一个 bounded `CompletedBarLog`，并把其条目从单 bar 改为 rollover batch。
- 不让 DataRecorder 恢复自己的 canonical BarGenerator。
- 不让 UI 恢复主进程多周期聚合。

## 5. 17 项旧行为证据与最小修复矩阵

本节是 Goal 合同的业务主干。每项都必须完整保留以下五段，不得在生成 GoalExecutionIR 时压缩成抽象架构任务：

```text
822c715e6 实际行为
→ 当前实现偏差
→ 必须保留的旧语义
→ 只替换数据源所需的最小修改
→ 真实场景验收
```

### FIX-01：cold/hot 相同 identity 的权威和冲突处理

**822c715e6 实际行为**

- 图表和指标首次加载时以 DB 中 `datetime_end != None` 的历史 bar 为基线。
- 启动后产生的 completed/current bar 在内存尾部继续参与显示和指标计算，不等待 Recorder 再次读库。
- DB 写入状态不是图表是否使用实时 bar 的条件。
- 旧链没有使用 revision、generation 或 snapshot 版本号在两份 OHLCV 之间选赢家。

**当前实现偏差**

- `vnpy/trader/dataservice/runtime.py` 的 cold/hot 合并路径使用 revision 或派生版本信息影响同 identity 选择。
- 比较字段混入 `gateway_name`、revision、generation、sequence 等传输或来源元数据，会把来源元数据不同的同一业务 bar 判成冲突。
- 冲突后存在冻结整个旧视图或等待另一份 snapshot 的路径，数据权威不明确。

**必须保留的旧语义**

- `bar_identity = (canonical_vt_symbol, interval, normalized_period_start)`。
- 比较前使用仓库既有 DB 时区、NumPy dtype、价格精度和数量精度规范化。
- 比较字段固定为 `symbol/exchange/interval/datetime/datetime_end/open/high/low/close/volume/turnover/open_interest`。
- `gateway_name`、revision、generation、sequence、SHM 名称和来源标签不参与业务内容一致性。
- DB 已存在的 completed bar 是该 completed identity 当前权威；DB 不存在而 hot completed 存在时，hot 是运行时权威；current 只由 hot current 提供。

**只替换数据源所需的最小修改**

- 删除 revision winner 和静默覆盖分支。
- cold 与 hot 内容一致时只去重，不复制第二根。
- 内容不一致时立即使用 DB completed bar 继续构建 effective series，隔离冲突 hot bar，并把精确 underlying 1m 范围交给 DataManager 修复。
- DataManager 修复并回读成功后，DataService 局部重读 DB 1m，从 1m 重建受影响目标周期并原子替换冲突 materialization。
- 不新增“冲突仲裁服务”、多版本 bar 或长期双写兼容层。

**真实场景验收**

- 使用隔离 SQLite 放入一根 completed 5m bar，再通过真实 DataService ingress 生成同 identity、完全相同 OHLCV 的 hot bar；断言 effective series 只含一根。
- 重放同 identity 但 close 不同的 hot bar；断言发布值立即保持 DB close，revision 变化不改变结果，并产生精确 repair request。
- DataManager 用 authoritative 1m 修复后回读；断言目标 5m 只从修复后 1m 重建，旧 hot 冲突对象不再参与合并。
- 证据必须包含合并前后 identity、逐字段值、DB 查询结果、repair range 和最终 GDS 值。

### FIX-02：缺口或修复失败时必须继续工作

**822c715e6 实际行为**

- DB 中已经存在的历史 bar 继续显示；内存中的实时 current 继续随 Tick 更新。
- 图表缺口检测针对缺失范围补数，不把全部历史和全部指标停止在一个旧帧。
- 无数据时不伪造 OHLCV，也不使用后一根分钟线冒充缺失起点。

**当前实现偏差**

- `vnpy/trader/dataservice/query_runtime.py` 存在服务端保存旧 GDS 结果并反复返回的业务性旧视图逻辑。
- 文档和部分状态机把真实缺失建模为可发布的占位 bar/status，再以该状态阻断整个 snapshot。
- repair 失败路径会使全部 interval 停止更新，而不是只隔离精确受影响范围。

**必须保留的旧语义**

- 有 DB completed 的 identity 始终有明确权威，repair 失败不改变其可用性。
- 有 hot current 的当前 identity继续实时更新。
- 三方都没有数据的 expected identity 是“缺口记录”，不是 bar，也不进入指标数组。
- 只有依赖该缺口的 period 和指标区段不能产出；缺口之前、缺口之后的独立数据和其他 interval 继续服务。

**只替换数据源所需的最小修改**

- 删除服务端业务性旧视图缓存和可进入 effective series 的缺失占位对象。
- 维护精确 `gap_range` 状态，只包含 symbol、interval、start、end、reason 和最后错误。
- DataService 持续接收 Tick、维护 hot current、发布不依赖缺口的增量。
- DataManager 对精确范围重试；成功后只重建受影响 period 并补发一次有效数据更新。
- 不引入全局“降级数据权威”或人工确认才能恢复的状态。

**真实场景验收**

- 隔离 DB 中保留缺口前 completed bars，制造中间四小时缺口并让第一次下载失败；断言 current Tick仍更新、缺口前数据仍可读、缺口 identity 不出现在 bar 数组。
- 第二次下载成功后，断言只刷新相交 cold range，缺口对应 period 和指标恢复，DataService/Worker 进程 PID 不变化。
- 断言没有任何停止更新的旧 GDS 数组被当作新 series 返回。

### FIX-03：DataManager 独占缺口裁决和 DB 修复

**822c715e6 实际行为**

- 用户启动后首先由 DataManager 检测历史数据缺口并补齐。
- DataManager 负责确定查询范围、下载历史、规范化并写入 DB。
- 图表和指标在历史基线可用后读取 DB，不自行决定供应商下载范围。

**当前实现偏差**

- DataService recovery 路径承担 coverage、winner、repair attempt 和 DB 应用等业务决策。
- “DataService 拥有 OpenD context”被错误扩展为“DataService 拥有历史完整性和 DB 修复”。
- 冲突路径不得由 DataService 直接构造或写入权威数据，避免形成第二个 DataManager。

**必须保留的旧语义**

- DataManager 独占 expected completed 1m identity 计算、头中尾缺口检测、下载范围决策、供应商结果规范化、DB 写入、DB 回读和复验。
- DataService 拥有唯一 OpenD quote context，但只作为无业务裁决的 history fetch executor。
- DataService 不写 DB；图表、指标、Recorder 和 UI 不写 repair 数据。

**只替换数据源所需的最小修改**

- 保留 DataService 中唯一 FUTU/OpenD context，暴露现有历史请求执行入口。
- DataManager 发送精确 `HistoricalBarRequest`；DataService 调用 provider 并返回 `HistoricalBarResponse` 或临时 SHM 批量结果。
- DataManager 收到结果后完成规范化、写 DB、回读验证，再发送 changed range。
- DataService 根据 changed range 只重读相交 cold 范围。
- 删除 DataService 内重复的 coverage 决策和 repair DB write 分支。

**真实场景验收**

- 真实启动链在非空 DB 中制造 4 小时中间缺口；断言 coverage 计算、range 决策、DB transaction 和回读全部发生在 DataManager 进程。
- 断言 DataService 进程只执行一次精确 history fetch，DB write 调用数为 0。
- 断言只存在一个 OpenD quote context，DataManager 没有创建第二连接。

### FIX-04：历史补缺复用现有 IPC，不再发明 repair 总线

**822c715e6 实际行为**

- DataManager 的历史下载是明确 request/response 行为，调用完成后取得 bar 列表或明确错误。
- 数据写库和查询状态围绕一个历史请求闭环，不依赖日志文本。

**当前实现偏差**

- 文档曾新增 repair Queue、attempt id、双向多跳路由和另一套 ACK 状态机。
- 同一历史请求同时存在 query、recovery、repair 三套重复 protocol，增加重复状态和故障点。
- 大历史结果如果直接穿过 Queue，会产生序列化复制和内存峰值。

**必须保留的旧语义**

- 一个历史范围对应一个现有 `HistoricalBarRequest` 和最终 `HistoricalBarResponse`。
- control/status Queue 只传小型命令、状态和临时 SHM 描述符。
- 大批量 bars 通过现有临时 shared memory 结果传递，不在 Queue 中复制完整数组。
- request id只做请求关联；process generation 只拒绝陈旧进程回复。

**只替换数据源所需的最小修改**

- 历史 IPC 只复用 `vnpy/trader/dataservice/recovery_protocol.py` 和 `vnpy/trader/dataservice/query_runtime.py` 中已经存在的 `HistoricalBarRequest`、`HistoricalBarResponse`、`DataServiceHistoricalQueryResult`，不得增加第二套 repair message family。
- 请求关联只复用现有 `session_id/request_id/request_generation/active_contract_generation`；不得新增 query tombstone、repair attempt generation 或 history winner revision。
- RuntimeSupervisor 只转发请求和回应，不理解 coverage 和 winner。
- 同一个精确 request key 只能有一个 in-flight fetch；相同请求附着等待现有结果。
- 不实现任意重叠范围合并框架；不同 range 由 Cold Range Cache 差集自然减少读取。
- 大结果写入一次临时 SHM，`HistoricalBarResponse` 只携带 descriptor。DataManager 在 success、validation failure、request cancellation 和 requester shutdown 的 `finally` 路径都必须发送或执行 release。
- 迟到 response 先校验上述四个现有身份字段；不匹配时不得替换 stable GDS、cold cache 或 request 终态，只释放其临时 SHM。
- DataService 只 fetch 和管理临时 SHM 生命周期，DB write 调用次数必须为 0；`source_revision` 不参与 DB/hot 选择。

**真实场景验收**

- 发起两个完全相同的精确范围请求；断言 provider fetch 一次、两个 caller 均收到终态。
- 发起两个不同但相交范围；断言不创建通用 coalescing DAG，第二请求只加载 cold cache 未覆盖差集。
- 取消一个已发出的 request 并让 response 迟到；断言 stable GDS 和终态不变，临时 SHM 被释放且无 tombstone 状态。
- 断言 Queue payload 不含完整历史数组，DataService DB write 为 0，临时 SHM 在正常、失败、取消和迟到四条路径全部释放。

### FIX-05：验收必须是用户场景，不是 helper 自证

**822c715e6 实际行为**

- 用户验证的是“打开程序、补数据、加载图表、实时变化、写库、切换和交易回调”完整行为。
- 指标正确性最终体现在 LMDB、映射和真实图表线，不只体现在一个数组函数返回值。

**当前实现偏差**

- 部分测试只断言 dataclass、helper、数组拼接或源码字符串。
- fake DataService、fake LMDB、fake PlotDataItem 和空闲计时器不能证明生产链。
- 测试名称写着 E2E，但没有独立 DataService 进程、真实 SQLite/LMDB 或 Qt item。

**必须保留的旧语义**

- 每个关键 Acceptance 必须从生产入口驱动，并在用户可观察终点断言。
- 单元测试用于定位算法错误，但不能替代端到端验收。
- 测试失败必须区分本次回归、既有失败、环境缺失和合同输入缺失。

**只替换数据源所需的最小修改**

- 每个场景固定写出 fixture、初始 DB、启动的真实进程、生产入口、操作步骤、直接断言、PASS、FAIL/BLOCKED、清理和命令。
- 真实 UI 测试使用 Qt offscreen 和真正的 `PlotDataItem`。
- 真实缓存测试使用隔离 LMDB 目录；真实数据测试使用隔离 SQLite。
- 核心被测方法禁止 monkeypatch；确定性行情只能从外部 provider/replay 边界输入。
- 现有错误测试逐个审计，不能因为位于 `tests/` 就保留。
- Goal 合同生成前必须冻结每个真实 fixture 的精确路径、真实来源、市场时间范围、记录数、字节数、SHA-256、关键 event ID、period start 和预期 OHLCV；任何字段缺失都返回 `blocked_by_contract_ambiguity:performance_dataset`，不得把 fixture 构造留给实施代理猜测。

**真实场景验收**

- `test-validity-audit.json` 必须逐测试记录生产入口、替代对象、直接 assertion、错误业务假设和 KEEP/REWRITE/DELETE。
- 任一 E2E 缺少独立 DataService、真实 DB、真实 LMDB、真实 Qt item 或用户终点断言时，该 Acceptance 判 FAIL。
- 日志字符串只能作为诊断，不能作为唯一 PASS 证据。

### FIX-06：真实 fixture 不再依赖实时 K_1M

**822c715e6 实际行为**

- 历史权威来自 DB completed bars。
- 实时 current 来自 Tick 聚合，而不是供应商实时分钟 K 线订阅。
- 用户问题发生在真实 MHI 历史、真实交易时段和真实 Tick 字段上。

**当前实现偏差**

- 测试夹具把实时 `K_1M` seed 当作启动正确性的必要输入。
- 随机 OHLCV 或手写极小数组不能覆盖 4H/DAILY 边界、BOLL lookback、volume delta 和中间缺口。
- 直接使用工作区 `database.db` 会污染用户数据并使测试不可重复。

**必须保留的旧语义**

- fixture 由真实 completed 1m 历史和真实 QUOTE/ORDER_BOOK tick 回放组成。
- 每个 fixture 有 manifest、来源范围、行数、字节数和 SHA-256。
- 测试运行时从 fixture 创建隔离 SQLite 和隔离 LMDB；不得写工作区生产数据库。

**只替换数据源所需的最小修改**

- 在 Goal 合同生成前固定一份覆盖 V1、V2、4H/DAILY 开盘、5m rollover 和 BOLL lookback 的真实 1m Parquet 数据；manifest 明列每个验收窗口的首尾 identity 和权威 OHLCV。
- 在 Goal 合同生成前固定一份同范围真实 QUOTE/ORDER_BOOK JSONL；manifest 明列跨分钟、同 rollover 多周期完成、actual 换月和 Trigger 触发事件 ID，并保留事件时间、累计 volume、turnover、open interest 和盘口字段。
- 不新增 `K_1M` replay fixture，不在生产启动路径订阅实时 `K_1M`。
- 通过顶层可 pickle 的 replay market runtime factory 把事件送入生产 ingress 边界；生产配置强制 factory 为 `None`。

**真实场景验收**

- 校验 manifest SHA 后创建隔离 DB，执行 coverage、DataService、GDS、指标、LMDB 和 Qt 链。
- 修改任一 fixture 字节后必须在启动测试前失败。
- 测试结束断言生产 `database.db` mtime/hash 不变，隔离 SHM/LMDB/SQLite 全部清理。

### FIX-07：持久化崩溃测试只增加三个确定性 barrier

**822c715e6 实际行为**

- DataRecorder 的业务目标是 completed bar 最终落库且不重复。
- SQLite 写入、进程内缓冲和后台 writer 已经形成明确持久化边界。

**当前实现偏差**

- 没有办法确定性命中“commit 前”“commit 后 checkpoint 前”“checkpoint 后 ACK 前”三个窗口。
- 使用 sleep、杀随机 PID 或 mock database 会得到不可重复证据。
- 为测试可靠性而引入通用 fault framework 会扩大生产复杂度。

**必须保留的旧语义**

- 生产默认路径不等待测试 barrier。
- 只有 Recorder 进程入口识别测试专用、默认关闭的 barrier 配置。
- 数据库和 Queue 必须仍是真实实现。

**只替换数据源所需的最小修改**

- 在 Recorder subprocess 顶层启动参数中增加三个互斥测试 barrier：`before_db_commit`、`after_db_commit_before_checkpoint`、`after_checkpoint_before_ack`。
- barrier 只暴露 ready/release 两个同步原语，生产默认均为空。
- 测试收到 ready 后终止 Recorder 进程并重启真实进程，验证重放和幂等。
- 不 monkeypatch SQLite commit、Queue.get、DataService publish 或 checkpoint 实现。

**真实场景验收**

- 三个独立测试逐一命中对应 barrier，并记录 DB row、checkpoint 和 ACK 在崩溃前的真实状态。
- 重启后同 identity 只有一行，内容与 completed envelope 一致，checkpoint 最终推进到该 sequence。
- barrier 未配置时性能样本中等待次数为 0。

### FIX-08：QUOTE/ORDER_BOOK 是实时 Tick 来源，删除实时 K_1M

**822c715e6 实际行为**

- FUTU `process_quote()` 更新成交、价格、累计量等字段并调用 `on_tick(copy(tick))`。
- FUTU `process_orderbook()` 更新五档盘口，并沿既有 Tick 链向消费者提供盘口变化。
- BarGenerator 使用 Tick 流生成 1m；Recorder 和策略各自在旧所有权边界消费 Tick。

**当前实现偏差**

- DataService 订阅实时 `K_1M` 并把它作为 seed，与缓存 Tick 设计复杂水位。
- `vnpy/trader/dataservice/quote_state.py` 的 ORDER_BOOK 路径存在只更新状态、不按旧行为发布 Tick 的偏差。
- 如果 QUOTE 和 ORDER_BOOK 都错误累计同一累计量，会造成 volume/turnover 翻倍。

**必须保留的旧语义**

- 实时行情输入只有 QUOTE 和 ORDER_BOOK；两者按旧 FUTU adapter 字段投影进入同一 ingress。
- ORDER_BOOK 更新盘口后必须让逐 Tick 消费者看到新盘口。
- K 线 volume/turnover 使用旧累计值差分语义；纯盘口更新没有新累计量时增量必须为 0。
- 同一 ingress 顺序串行，completed bar 不得被迟到 Tick重新打开。

**只替换数据源所需的最小修改**

- 从 DataService active subscription 删除实时 `K_1M`。
- 把 `process_quote` 和 `process_orderbook` 的既有 Tick 字段更新迁到唯一 DataService quote state。
- 每次 callback 生成一个 raw Tick envelope；聚合 admission 使用旧限流和累计量差分，盘口事件不得重复增加 volume/turnover。
- 保留供应商历史 K 线查询能力，仅用于 DataManager 明确发出的 history request；历史查询不进入实时 callback 链。

**真实场景验收**

- 回放同一成交的 QUOTE 后紧跟 ORDER_BOOK；断言逐 Tick消费者收到两次顺序事件，第二次含新盘口，但 1m volume/turnover只累计一次。
- 回放一分钟内多次报价和盘口变化；断言 OHLCV 与 `822c715e6` 同输入结果逐字段一致。
- 断言 active subscribe 请求中实时 `K_1M` 数量为 0。

### FIX-09：启动使用 DB completed 1m 加缓存 Tick，不使用 K_1M seed

**822c715e6 实际行为**

- 用户进入程序后由 DataManager 检测和补齐 DB 历史。
- 图表/指标读取 completed 历史作为首个权威基线。
- 实时 current 由程序启动后收到的 Tick持续聚合；历史 DB 不保存 `datetime_end == None`。

**当前实现偏差**

- 当前启动设计让 `K_1M` seed 和 `seed_ingress_seq` 决定 current 建立，扩大了双源合并问题。
- 进程启动状态早于历史完整性，图表反复查询得到 `GDS_PREWARM_PENDING`。
- 中间缺口只在全空时处理，非空但不完整的数据直接进入指标。

**必须保留的旧语义**

- DataService 启动行情后立即缓存 ingress Tick，不丢失 DB 加载窗口内的数据。
- DataManager 先把 DB 补至“请求时刻之前最后一根应 completed 的 1m”。
- DataService 加载 completed cold baseline，从 DB completed 1m 重建当前大周期已经完成的分钟前缀，再应用边界之后缓存 Tick。
- 当前 1m 只由 Tick建立；DB 中没有 incomplete bar。
- 启动 coverage 范围严格复用 `822c715e6` DataManager 的既有启动配置，不由 DataService、首个图表或 Recorder 自行扩大。
- 图表 normalized range 由请求图表的 visible range、IndicatorRuntime 对本次已注册指标计算出的实际最大 lookback、4H/DAILY 所需真实 period-start 前缀共同确定；不得写死 BOLL lookback 或全局最大历史年数。

**只替换数据源所需的最小修改**

- active subscription ACK 后记录一个本地 ingress cursor，开始有界缓存 Tick。
- DataManager 完成 coverage 和 DB 回读后返回精确 completed watermark。
- DataService 加载到该 watermark，丢弃已被 completed 1m覆盖的缓存 Tick，只按 sequence 应用 watermark 之后的 Tick。
- 4H/DAILY current open 必须从真实 period_start 1m取得；起始分钟尚未 completed且缓存中也没有第一笔时，不得用启动后第一笔冒充。
- 完整 legacy contract构建成功后只发布一次 range COMPLETE。
- 启动缓存中的每个 Tick 已在接收时向外部逐 Tick 消费者发布一次；cold load 后的内部 replay 只送 canonical 聚合器，禁止重复写 TickDatabus 或重复触发 CTA、Trigger、Recorder Tick、EVENT_TICK 和追价。

**真实场景验收**

- 在 22:05 启动，DB 含 21:00 至最后 completed minute，启动期间继续回放 Tick；断言 4H open 等于21:00 1m open，volume不重复，缓存边界无丢失。
- 在非空 DB 中删除中间四小时；断言首次 range COMPLETE 前 DataManager 已补齐并回读。
- 断言启动全链没有实时 `K_1M` callback、seed对象或 seed水位。

### FIX-10：READY 和 active 状态只保留消费者真正需要的边界

**822c715e6 实际行为**

- 进程能启动、行情合约已订阅、一次历史查询已完成是三个不同事实。
- 用户选择哪个合约由应用已有合约查询/选择流程决定，不由数据消费者隐式决定。
- 图表请求自己的数据范围，成功后才显示该范围；没有全局“所有范围都已准备完成”的业务状态。

**当前实现偏差**

- `vnpy/trader/dataservice/runtime.py` 在 prewarm 尚未完成时存在报告宽泛 READY 的路径。
- 文档曾增加 `PROCESS_READY/MARKET_READY/DATA_READY` 三层全局状态，其中全局 DATA_READY 无法表达多个 interval/range 的真实完成状态。
- Runtime 或首次 query 存在自动激活默认合约的路径，绕过用户设置所有权。

**必须保留的旧语义**

- `PROCESS_READY` 只证明子进程循环和 IPC 已就绪。
- `ACTIVE_ACK` 只证明指定 canonical symbol 已完成 logical/actual 解析、TickDatabus/GDS 建立和实时 QUOTE/ORDER_BOOK 订阅。
- 每个历史/图表请求独立返回 `COMPLETE` 或 `FAILED`；只有该请求的 COMPLETE 才授权消费者使用对应 descriptor。
- active 设置只来自查询合约窗口的持久化选择；没有有效值时主进程显式发送 `MHImain.HKFE`。

**只替换数据源所需的最小修改**

- 复用 Supervisor 现有 process ready 和 active command/ack。
- 删除全局 DATA_READY 和对应等待环。
- query runtime 为每个 request id 发一次终态 COMPLETE/FAILED；相同 request 不轮询重发。
- DataService PROCESS_READY 后，DataManager发出 history request，不等待图表数据状态。
- 删除 DataService、Supervisor、Recorder 和首次 chart query 自行选择 active symbol 的路径。

**真实场景验收**

- 启动时断言先收到 DataService PROCESS_READY；主进程随后发送用户保存的 active command；订阅和稳定 stores完成后收到一次 ACTIVE_ACK。
- 在同一 active 下并发请求 1m、5m、4h 不同范围；断言各自只有一个终态且互不冒充全局 ready。
- 无持久化 active 时断言主进程显式发送一次 `MHImain.HKFE`，DataService内部默认选择次数为 0。

### FIX-11：IPC 技术栈按数据频率和体积固定，不建立统一消息总线

**822c715e6 实际行为**

- 高频 Tick 适合共享内存，历史/图表数组适合共享数据区，控制命令和低频状态适合 Queue。
- DataRecorder 内部使用 `queue.Queue` 将 UI/event线程缓冲与 DB writer 线程隔离。
- 旧业务不要求跨 SHM 和 SQLite 的原子事务。

**当前实现偏差**

- DataService 写 TickDatabus 后又自行读取同一 ring 聚合，增加一次序列化、游标和 overrun 故障面。
- query-specific immutable snapshot、TTL 和 lease 使普通读取变成资源管理协议。
- completed delivery 曾被设计为 SHM ring 或复杂 pending/config 总线，超出低频事件需要。

**必须保留的旧语义**

- DataService ingress 在进程内直接调用聚合器，不经过 IPC 回环。
- 高频 raw Tick：一个 active TickDatabus，底层为 `multiprocessing.shared_memory` 加固定 NumPy dtype 和每消费者独立 cursor。
- 有效 K 线：每 active generation 一组稳定 GDS allocation，图表和全部指标共享。
- 历史批量响应：临时 SHM 加小型 response descriptor。
- completed：复用现有有界 `CompletedBarLog` 的共享内存读写和 cursor 机制，但日志条目固定改为 `CompletedRolloverBatch`。
- completed wake-up、batch ACK、Trigger candidate/ACK、health、control：父进程创建的低频 `multiprocessing.Queue`；Queue 消息只携带小型 identity、sequence 或状态，不复制完整 batch bars。
- Recorder 进程内：原 `self.ticks/self.bars` 加 `queue.Queue` 加 DB writer线程。

**只替换数据源所需的最小修改**

- 删除 DataService 自读 TickDatabus 的 reader/cursor。
- 删除普通 descriptor lease、TTL 和每 query allocation；稳定 allocation 只在容量不足、active 切换或 DataService generation 变化时替换。
- completed batch 写入 bounded `CompletedBarLog` 后只用单独低频 Queue 唤醒 Recorder；Recorder 按 cursor 从 log 读取，不与 Tick ring 混用。
- `CompletedBarLog` 达到容量时不得阻塞 DataService ingress；未消费 batch 被覆盖后返回精确 retained head/tail 和 `stream_key`，由 DataManager 按 Recorder 配置周期恢复 DB 缺口。
- 保留 SHM odd/even seqlock 和 `series_seq`，只证明一次跨数组读取一致。
- `stream_key=(service_generation, active_generation)` 只用于拒绝陈旧进程、陈旧 SHM 和错流 ACK；不得成为业务 winner。不再为同一事实维护独立 tick epoch。

**真实场景验收**

- 连续回放一万 Tick，断言 DataService 自身 TickDatabus read次数为0，GDS shm_name 不变化，每 Tick新 allocation次数为0。
- 同时加载三个指标和两个图表，断言共享同一 effective series descriptor，不复制五份历史数组。
- completed wake Queue 堵塞时，断言 batch 已存在 bounded log、Tick ingress和current聚合继续；Queue恢复或Recorder主动poll后按同一 `batch_sequence` 消费。
- 将 Recorder cursor 放到 retained head 之前；断言 overrun 不让 Recorder 自行聚合 bar，DataManager 根据配置周期和 authoritative 1m 精确恢复。

### FIX-12：Recorder 界面配置完全归 Recorder，DataService 不参与配置事务

**822c715e6 实际行为**

- `data_recorder_setting.json` 保存 `tick_recordings`、`bar_recordings`、每合约 intervals、`recording_paused` 和过滤设置。
- 用户在 Recorder UI 添加、删除、暂停、恢复后，Recorder 的下一次事件处理立即按本地当前配置判断。
- DataRecorder 配置不决定市场数据系统是否继续生成 K 线。

**当前实现偏差**

- Recorder subprocess 启动时只复制一次配置的路径使运行中 UI 修改没有进入真实消费路径。
- 文档曾要求 DataService 接收 Recorder `CONFIG_PREPARE/CONFIG_COMMIT`、config version 和 Tick cursor 边界。
- DataService 根据 Recorder intervals 决定是否产生 completed，会把持久化配置变成 canonical 数据所有权。

**必须保留的旧语义**

- 配置读写、持久化、UI ACK 和过滤都由 Recorder runtime拥有。
- DataService 对唯一 active 合约维护图表/指标所支持的 canonical intervals，并在 rollover 时产生 completed event；它不读取 Recorder配置。
- Recorder 收到 Tick 或 completed event 时，先读取自己当前配置，再决定是否放入持久化缓冲。
- 非 active 合约配置只保存，不触发实时订阅或实时写库。
- completed batch 首次消费时，Recorder 把每根 bar 的 `selected/skipped` 决定保存到该 batch checkpoint；崩溃重放沿用该决定，避免配置变更重新解释已经消费过的旧 batch。

**只替换数据源所需的最小修改**

- 将 UI add/delete/pause/resume 命令直接送到 Recorder subprocess并等待 Recorder ACK。
- Recorder runtime 原子替换本地配置快照并保存原 JSON 格式。
- completed envelope 不携带 Recorder config version，也不携带 `effective_from_transport_seq`。
- checkpoint 只保存消费结果和 durability 进度，不保存或协商 config version；DataService 不参与该决定。
- 删除 DataService 的 Recorder subscription/config handler和配置边界状态。
- DataService interval 生命周期不得由 Recorder UI 删除操作销毁。

**真实场景验收**

- 打开 Recorder UI 添加 active合约5m，收到下一根5m completed后断言入库；DataService没有收到配置命令。
- 删除5m后，下一根5m completed仍存在于GDS/hot tail但Recorder不写库。
- 保存一个非active合约配置，断言不增加FUTU实时订阅、TickDatabus或canonical store。

### FIX-13：Recorder add/delete/pause/resume 以消费入缓冲边界生效

**822c715e6 实际行为**

- `process_tick_event/update_tick` 在事件处理时检查 `recording_paused` 和 recording dict。
- 已经进入 `self.ticks/self.bars` 的数据由下一次 timer flush继续写入。
- pause/delete不回滚已经接收的数据；resume不补造暂停期间未接收的数据。

**当前实现偏差**

- 两阶段配置协议把边界绑定到 DataService transport sequence，增加跨进程竞态和旧 config保留。
- pause/delete路径会错误清空已缓冲数据，或要求 DataService停止产生 canonical bar。
- delayed completed envelope按生产时配置而非Recorder实际消费时配置处理。

**必须保留的旧语义**

- 生效点固定为 Recorder consumer准备把一条事件放入 `self.ticks/self.bars` 之前读取的本地配置快照。
- add/resume之后消费到的匹配事件进入缓冲。
- delete/pause之后消费到的事件不进入缓冲。
- 生效前已经进入缓冲的数据必须照常 flush；不得逆向删除。
- 已被某个 batch checkpoint 记录为 selected 或 skipped 的 bar 在崩溃重放时保持原决定；这不是配置版本协议，而是 at-least-once 消费状态。

**只替换数据源所需的最小修改**

- Recorder控制线程更新一个进程内锁保护或单线程所有权的配置快照。
- Tick reader和completed consumer在入缓冲前调用同一个本地 eligibility函数。
- UI等待Recorder command ACK，仅表示本地配置已生效并已持久化。
- 不添加config版本、prepare/commit、DataService ACK或transport sequence边界。

**真实场景验收**

- completed A进入`self.bars`后执行pause，再到达completed B；断言A仍写库、B不写库。
- pause期间到达C，resume后到达D；断言C不补写、D写入。
- delete interval前已缓冲E，删除后到达F；断言E写入、F不写入，UI状态与JSON一致。

### FIX-14：completed按rollover batch可靠交付，并保留旧落库节奏

**822c715e6 实际行为**

- Tick进入`self.ticks`，1m completed进入`self.bars`，由默认10秒`timer_interval`批量送往进程内`queue.Queue`和DB writer。
- 已确认的5m、1h、4h等高周期在period rollover后优先调用`save_bar_data([bar], stream=False)`立即写库。
- 高周期立即写失败或数据库锁定时，才调用`record_bar`降级进入下一次批量flush。
- 日线保留旧版明确完成时机和立即写库路径。

**当前实现偏差**

- 当前 canonical consumer 按 interval 建立独立 reader、cursor 和写入会话，同一1m rollover同时完成多个周期时重复轮询和提交。
- 文档曾错误要求Tick和所有completed统一批量，改变了高周期用户可见落库时机。
- 文档也曾错误要求每根bar独立envelope、sequence和ACK，放大checkpoint、ACK和SQLite事务数量。
- 新路径缺少逐周期接收、立即成功、降级、批量成功和失败的Recorder日志/UI证据。

**必须保留的旧语义**

- completed产生时机仍为：下一分钟开始完成上一根1m；同一边界达到结束条件的高周期在该次rollover同时完成；DAILY使用旧版交易时段完成规则。
- 1m和Tick继续旧timer批量链。
- 5m、15m、30m、45m、1h、4h和DAILY等已配置高周期优先立即写入，失败才进入批量队列；同一rollover的多个已选高周期必须合并为一次`save_bar_data(list, stream=False)`原子事务。
- current bar永不写DB。
- DataRecorder写入前后hot completed仍留在effective series，显示和指标不变。

**只替换数据源所需的最小修改**

- DataService在每个canonical 1m rollover向bounded `CompletedBarLog`追加一个`CompletedRolloverBatch`，不按Recorder配置过滤。
- batch固定包含`stream_key`、`batch_sequence`、rollover identity和`bars[]`；每根bar包含完整BarData持久化字段。batch不包含config version、mapping version或每bar sequence。
- `bars[]`按固定interval顺序包含该rollover同时完成的全部canonical bars；一个batch只分配一个sequence和一个最终ACK。
- Recorder首次消费batch时按本地配置把每根bar标为selected/skipped，并把该决定、persistence group和durable状态写入checkpoint；重放不得重新解释配置。
- Recorder将selected 1m放入旧`self.bars`，将同batch selected高周期合并送入一次旧立即写入口；立即失败项整体或逐失败identity降级进入旧timer buffer。
- batch内所有selected identity durable且所有其余identity已标记skipped后，才推进一个batch checkpoint并发送一个ACK；任一selected identity未持久化时不得越过该batch。
- SQLite在单事务内执行identity insert-or-compare：不存在则插入，相同则视为幂等成功，不同则不覆盖并交DataManager精确修复。
- `save_bar_data(list)`必须使用现有`vnpy_sqlite/vnpy_sqlite/sqlite_database.py`单个`db.atomic()`事务，不为每个interval开启独立事务。
- DataService崩溃时旧`stream_key`标记ABORTED；Recorder不自行补造高周期bar，而是向DataManager提交当前Recorder配置周期和最后checkpoint对应的精确恢复范围。DataManager以DB authoritative completed 1m重建缺失高周期并幂等写DB。
- completed log overrun使用同一恢复路径；DataManager完成DB回读复验后，Recorder从新stream最新有效cursor继续，不要求DataService补发已经被覆盖的内存batch。

**真实场景验收**

- 回放一个同时完成1m、5m和1h的边界，断言只产生一个batch sequence；1m进入timer buffer，5m和1h通过一次immediate transaction提交，最终只产生一个checkpoint和一个ACK。
- 强制高周期第一次立即写返回真实SQLite locked，断言bar进入批量buffer并在锁释放后成功写入。
- 分别在commit前、commit后checkpoint前、checkpoint后ACK前崩溃；重启后同一batch沿用原selected/skipped决定，每identity只有一行且checkpoint最终连续。
- 断言每次成功写入日志含`stream_key`、batch sequence、canonical symbol、interval、period start/end、DB disposition和checkpoint；current写入数为0。

### FIX-15：主连 logical/actual 映射严格迁移旧实现

**822c715e6 实际行为**

- `MHImain.HKFE` 是用户、DB、Recorder、图表和指标使用的logical/canonical identity。
- FUTU实际月份`MHIyyMM.HKFE`只用于供应商订阅、交易请求、追价以及持仓/委托匹配。
- 主连解析复用既有`main_contract_mapping`，按旧缓存、origin code、名称月份、成交量/持仓量和到期规则选择actual。
- actual切换发布既有`EVENT_MAIN_CONTRACT_SWITCH`，logical symbol不变。

**当前实现偏差**

- DataService存在把actual symbol直接写入TickDatabus、GDS或DB的路径，导致主连历史分裂。
- 为actual切换引入mapping version、新generation或新stream会让消费者误判为用户切换合约。
- 旧actual callback迟到会污染新actual下的canonical current。

**必须保留的旧语义**

- 用户active仍为`MHImain.HKFE`；canonical Tick/bar/DB/Recorder/descriptor/指标全部保持该identity。
- provider adapter内部保存current actual，仅在FUTU API边界使用。
- actual切换不改变active generation、TickDatabus stream id和completed stream id。
- 既有主连切换事件只发布一次，字段和调用方保持旧约定。
- actual mapping更新、subscribe/unsubscribe和provider callback acceptance必须全部串行进入同一个ingress dispatcher，禁止不同线程各自读取或修改mapping。

**只替换数据源所需的最小修改**

- 把`822c715e6`的`main_contract_mapping`解析入口迁到DataService provider adapter，不复制算法。
- actual自动换月先在ingress dispatcher订阅new actual；成功后原子切换当前mapping和callback接受目标，发布一次旧`EVENT_MAIN_CONTRACT_SWITCH`，再取消old actual。订阅失败时继续使用old actual，不发布切换事件。
- callback ingress直接比较供应商回传actual symbol与dispatcher当前mapping；不相等即拒绝旧订阅迟到callback，不新增mapping token或mapping version。
- 接受后立即投影为canonical identity，再进入TickDatabus和聚合器。
- execution quote同时保留canonical查找键和current actual API键，追价只用actual调用FUTU。
- 不新增mapping version；只使用现有mapping值和旧事件。

**真实场景验收**

- 模拟MHImain从MHI2609切到MHI2610；断言GDS、DB、Recorder和指标identity始终为MHImain。
- 断言FUTU subscribe/order/chase使用MHI2610，旧MHI2609迟到callback被拒绝且不更新current。
- 断言只产生一次旧格式主连切换事件，active generation和两个transport stream id均不变化。
- 在subscribe new成功、mapping切换、unsubscribe old三个边界各注入callback；断言只有dispatcher当时接受目标的callback进入canonical current，顺序无竞态。

### FIX-16：高频消费者、稳定GDS和hot生命周期采用最少机制

**822c715e6 实际行为**

- CTA策略通过自己的Tick处理链调用`strategy.on_tick`，再由策略私有BarGenerator调用`on_bar/on_window_bar`。
- OmsEngine注册`EVENT_TICK`并更新`self.ticks`，`MainEngine.get_tick()`为手工交易和图表交易交互提供最新价格。
- FUTU Gateway在Tick到达时调用`_try_replace_on_tick`快速唤醒REPLACE订单。
- 图表/指标重复读取同一组稳定GDS数据；内存completed/current随时间增量变化。

**当前实现偏差**

- 删除主进程EVENT_TICK后，Oms最新Tick、手工对手价/超价/市价/下单校验和图表交易交互会为空或过期。
- Trigger candidate由主进程`EVENT_TIMER`每秒轮询，增加触发到提交延迟。
- query-specific snapshot、TTL、lease和频繁SHM更名增加复制、attach和生命周期故障。
- hot tail存在按Recorder ACK、时间、数量或snapshot刷新错误裁剪的路径。

**必须保留的旧语义**

- CTA子进程直接消费TickDatabus，每个未overrun raw Tick依次进入旧`process_tick_event → strategy.on_tick → 私有BarGenerator`；共享canonical bar不得再次调用策略bar回调。
- Trigger子进程逐Tick判断；命中后通过专用candidate Queue立即交给主进程阻塞bridge和`OrderExecutionGate`，不等待一秒timer。
- compatibility bridge为主进程发布`EVENT_TICK`和`EVENT_TICK + vt_symbol`，OmsEngine恢复O(1) latest cache；主进程不做K线聚合、指标、DB或同步绘图。
- execution quote consumer直接唤醒等价旧`_try_replace_on_tick`路径。
- GDS allocation稳定；hot tail直到经过cold局部刷新和逐字段验证后才吸收。

**只替换数据源所需的最小修改**

- 为CTA、Trigger、Recorder Tick、compatibility bridge和execution quote各保留独立TickDatabus cursor，不在主进程复制聚合逻辑。
- Trigger candidate使用稳定candidate id和intent id；未ACK时重发同一candidate，不创建新订单意图，不以三次失败进入永久停用状态。
- candidate和ACK identity固定为`(service_generation, active_generation, candidate_id)`；attempt只进入诊断计数，不进入identity。
- candidate首次发送后每500ms重试一次，共两次快速重试；仍无ACK时进入`DELIVERY_DEGRADED`并每1秒重发同一candidate，直到收到ACK或rule/active失效。不得三次后永久停止。
- Trigger只有自身TickDatabus cursor真实overrun时进入短暂`UNPROTECTED`。它复用现有`LineRuleGraph`、position projection和readiness，attach最新cursor后立即用latest Tick重评全部有效规则；完成重评后由Trigger发恢复ACK，不调用DataManager。
- `OrderIntent`继续复用现有`actual_vt_symbol`字段，不新增mapping epoch。OrderExecutionGate执行前重验active generation、current actual、position/projection和reduce-only volume；验证失败则拒绝旧candidate，不提交订单。
- compatibility bridge是主进程标准Tick事件的唯一发布者；Gateway旧行情publisher关闭，Oms收到兼容事件后不得再次写TickDatabus。
- UI可限制repaint频率，但不得用100ms latest轮询替代框架EVENT_TICK兼容事件。
- 每active generation/interval复用稳定GDS；容量增长时才分配新SHM并原子切换，普通query/repaint不换shm_name。
- hot completed使用identity map加有序视图；Recorder ACK、TTL、固定数量和wall-clock均不能删除它。

**真实场景验收**

- CTA真实子进程回放N笔Tick，断言`strategy.on_tick=N`，策略私有`on_bar/on_window_bar`与822结果一致，共享canonical bar直接回调次数为0。
- 主进程compatibility bridge回放Tick，断言Oms`get_tick`、手工对手价和图表交易交互立即读取同一最新值；主进程聚合和指标调用数为0。
- Trigger命中后断言candidate不等待EVENT_TIMER；断开ACK再恢复，最终只提交同一intent一次。
- 触发真实ring overrun后断言状态只在重新attach和latest Tick重评期间为`UNPROTECTED`，恢复ACK后继续保护，DataManager调用次数为0。
- 阻断candidate ACK超过1秒，断言先发生两次500ms快速重试，再以1秒周期发送同一identity；恢复ACK后OrderExecutionGate只有一个intent。
- actual换月期间保留一条pending candidate；断言Gate按当前actual和active generation重验，旧actual intent被拒绝或按既有投影安全更新，不新增mapping epoch。
- 一万Tick内断言GDS allocation稳定；Recorder ACK后hot identity仍存在；cold refresh验证重叠后才裁剪。

### FIX-17：恢复通用旧指标链，BOLL只做明确强校验

**822c715e6 实际行为**

- Worker接收`arr_1m`、`period_bars`、`index_ranges`、`current_bar_start_ix`和base metadata。
- 指标L1缓存历史period bars，L2复用completed prefix并只计算尾部/current。
- 指标结果按原契约写入LMDB `u0/u1`，再通过`index_ranges`映射到1m坐标并交给真实PlotDataItem。
- BOLL、LOWER_HIGHER_TREND、TREND_STATE_MACHINE及registry中其他自定义指标共享这条链。

**当前实现偏差**

- `vnpy/datafeed/indicator_engine.py`和Worker的新路径使用只含completed的输入或新rolling cache替代旧L2语义，current输出被截断。
- `vnpy/datafeed/indicator_worker.py`中的旧稳定GDS attach路径被禁用，Worker重复query并复制历史。
- DataService descriptor被误当成指标结果缓存，LMDB或旧L1/L2被绕过。
- BOLL修补散落在gap-fill、stable input和UI层，无法保证其他指标无回退。

**必须保留的旧语义**

- DataService只提供一次构建的legacy data contract，不计算任何指标。
- `period_bars = completed period bars + 最多一根current period bar`。
- current更新不能使completed prefix失效；L2只计算必要tail和current。
- LMDB `u0`保持period长度结果和period metadata，`u1`保持1m对齐结果和base metadata。
- 全部registry指标走同一production compute、LMDB cold/warm、映射和绘制链。

**只替换数据源所需的最小修改**

- 在DataService descriptor到旧Worker之间保留一个薄legacy adapter，只负责字段和SHM view适配。
- 删除只含completed的主输入旁路和新指标rolling cache，不修改指标公式。
- 恢复`822c715e6`的L1 key/hit/失效、L2 completed-prefix/tail和LMDB `u0/u1`加载保存语义。
- current变化沿用`822c715e6`既有指标刷新节奏；积压刷新只合并到最新待处理series sequence，但rollover最终状态不得被跳过。
- BOLL 5m用TA-Lib对同一close数组做数值oracle；其他全部注册指标与822同fixture输出逐点对照。
- Qt验收读取实际PlotDataItem的xData/yData，不以worker返回数组代替用户视角。

**真实场景验收**

- 5m completed达到lookback后加入一根current，断言BOLL upper/middle/lower均存在并随current close更新。
- rollover前最后current值与转completed后同identity值一致；Recorder commit前后BOLL输入和输出不变。
- `LOWER_HIGHER_TREND`和`TREND_STATE_MACHINE`执行cold LMDB、warm LMDB、current更新、mapping和真实Qt绘制对照。
- registry discovery得到的全部其他指标执行production-chain smoke并与822输出契约比较。
- warm 5m BOLL P50/P95均不高于822基线的80%，且每Tick全DB读取、全历史snapshot重建、UI主线程聚合均为0。

### 第三轮审计问题闭环索引

下列24项全部是Goal合同的源义务。合同作者必须将每项映射到明确Task和Acceptance scenario；不得只把本表作为说明文字引用。

| 审计ID | 已冻结的唯一答案 | 后续绑定 |
|---|---|---|
| AUDIT-B01 | WORK-01至WORK-16每项必须包含精确路径、实施步骤、红灯、绿灯、回归、证据、PASS、FAIL、BLOCKED和清理。 | 第12节 |
| AUDIT-B02 | AC-01至AC-24必须拆分为可独立执行的`AC-xx-Sxx`，每个场景具有自己的fixture、步骤、断言、命令、证据和teardown。 | 第10节 |
| AUDIT-B03 | 真实fixture的event ID、时间范围、OHLCV、字节数和SHA-256在Goal合同生成前冻结；缺失即`blocked_by_contract_ambiguity:performance_dataset`。 | FIX-05、FIX-06、第10.1节 |
| AUDIT-B04 | logical active使用`stream_key=(service_generation, active_generation)`；正常切换seal，崩溃abort，旧消息按stream key drain/fence。 | 第4.7节、REQ-MAP、AC-21 |
| AUDIT-B05 | 一次canonical 1m rollover只产生一个`CompletedRolloverBatch`、一个batch sequence和一个最终ACK；batch含同边界全部completed周期。 | 第4.7节、FIX-14、REQ-REC、AC-15/16 |
| AUDIT-B06 | 历史IPC只使用`HistoricalBarRequest/Response`、`DataServiceHistoricalQueryResult`和临时SHM；DataManager唯一写DB。 | FIX-03、FIX-04、REQ-GAP、AC-03/04 |
| AUDIT-M01 | 每个`AC-xx-Sxx`必须映射Goal Task、精确产品文件、pytest nodeid和artifact。 | 第10.2节、第12节 |
| AUDIT-M02 | WORK依赖必须先冻结旧行为和fixture，再修active/ingress/history/cold-hot，之后修指标、Recorder、callback、Trigger和query，最后验收清理。 | 第12节 |
| AUDIT-M03 | Qt命令在当前PowerShell直接设置`$env:QT_QPA_PLATFORM='offscreen'`后运行pytest，不嵌套第二层`pwsh -Command`。 | 第10节命令模板 |
| AUDIT-M04 | 仓库没有冻结的全局lint权威；质量门禁使用compileall、import、pytest collect和修改文件Ruff相对基线，不虚构mypy/pyright通过。 | 第12.1节 |
| AUDIT-M05 | 生产仅配置三个默认关闭的Recorder崩溃barrier；其他故障用真实Queue、provider和明确PID状态驱动，不用sleep决定时序。 | FIX-07、AC-16 |
| AUDIT-M06 | Trigger仅在真实ring overrun时短暂`UNPROTECTED`，attach latest cursor后用latest Tick重评并自行恢复ACK，不调用DataManager。 | FIX-16、REQ-CALLBACK、AC-20 |
| AUDIT-M07 | DataService崩溃将旧stream标记ABORTED；DataManager从authoritative completed 1m重建Recorder配置周期的缺口。 | FIX-14、REQ-REC、AC-24 |
| AUDIT-M08 | 复用有界`CompletedBarLog`，存储单位改为rollover batch；log或wake Queue压力不得阻塞Tick/current，overrun交DataManager。 | FIX-11、FIX-14、AC-15/16 |
| AUDIT-M09 | actual mapping、subscribe/unsubscribe和callback acceptance全部串行进入ingress dispatcher；先订阅new，再切mapping，最后取消old。 | FIX-15、REQ-MAP、AC-22 |
| AUDIT-M10 | coverage复用现有`missing_ranges`并发布`coverage_segments`；缺口只在绘图数组插断点，不创建bar。 | REQ-GAP、REQ-PUB、AC-04/05/13 |
| AUDIT-M11 | 启动范围复用822 DataManager配置；图表normalized range由visible range、实际最大lookback和4H/DAILY period-start前缀确定。 | FIX-09、REQ-BOOT、AC-04/06/12 |
| AUDIT-M12 | Trigger candidate先以500ms间隔重试两次，再进入`DELIVERY_DEGRADED`并每秒重发同一candidate，直到ACK或规则失效。 | FIX-16、REQ-CALLBACK、AC-20 |
| AUDIT-M13 | candidate/ACK identity固定为`(service_generation, active_generation, candidate_id)`，attempt不是identity。 | FIX-16、REQ-CALLBACK、AC-20 |
| AUDIT-M14 | 复用`OrderIntent.actual_vt_symbol`；Gate执行前重验active generation、actual、position projection和reduce-only volume，不新增mapping epoch。 | FIX-16、REQ-MAP、AC-19/20/22 |
| AUDIT-M15 | query只复用`session_id/request_id/request_generation/active_contract_generation`；迟到response不替换GDS且立即release临时SHM。 | FIX-04、REQ-QUERY、AC-23/24 |
| AUDIT-M16 | 只合并完全相同的in-flight request；不同相交range只用Cold Range Cache差集，不建立overlap DAG。 | FIX-04、REQ-QUERY、AC-23 |
| AUDIT-M17 | Recorder checkpoint保存未ACK batch的selected/skipped identities、persistence group和durable状态；不增加config version。 | FIX-12至FIX-14、REQ-REC、AC-14/16 |
| AUDIT-M18 | 启动Tick只向逐Tick消费者发布一次；cold加载后的内部replay只进入canonical聚合器。 | FIX-09、REQ-BOOT、AC-09/17/18/20 |

## 6. 冻结数据模型

### 6.1 identity 与业务字段

REQ-DATA-001：bar identity固定为：

```text
(canonical_vt_symbol, interval, normalized_period_start)
```

REQ-DATA-002：`period_start`必须通过现有`vnpy/trader/period_utils.py`、`vnpy/trader/hkfe_period_common.py`和`vnpy/trader/hkfe_bar_generator.py`规则计算。不得用整数分钟取模重写HKFE跨日周期。

REQ-DATA-003：`2026-07-20 17:00`之前的HKFE bar使用V1；该时刻及之后使用V2。V1夜盘起点为17:15，V2夜盘起点为17:00。

REQ-DATA-004：completed比较字段固定为：

- symbol。
- exchange。
- interval。
- datetime，即period start。
- datetime_end。
- open_price。
- high_price。
- low_price。
- close_price。
- volume。
- turnover。
- open_interest。

REQ-DATA-005：`gateway_name`、revision、series sequence、transport sequence、process generation、active generation、SHM名称和来源标签不是K线内容字段。

### 6.2 cold_historical_baseline

REQ-COLD-001：cold只来源于DB。

REQ-COLD-002：cold只包含`datetime_end != None`的completed bars。

REQ-COLD-003：DB内`datetime_end == None`的bar数量必须始终为0；读取时发现此类记录必须报告数据污染并由DataManager处理，禁止并入cold。

REQ-COLD-004：cold在以下事件发生时加载或局部刷新：

- active启动后的首次range request。
- 用户切换active合约。
- 请求范围超出当前cache coverage。
- DataManager changed range与cache相交。
- 用户明确刷新数据。
- DataService中断造成completed范围未知，启动coverage修复完成后。

REQ-COLD-005：普通Tick、current更新、Recorder commit、Recorder ACK、图表paint、drag和zoom不得触发全范围DB读取。

REQ-COLD-006：Cold Range Cache按canonical symbol、interval和range保存DB completed结果；范围扩展只读取未覆盖差集。

REQ-COLD-007：changed range只失效相交范围。Recorder写入通知丢失不停止hot实时链；下一次相交query或显式刷新仍须比较DB/hot。

### 6.3 hot_completed_tail

REQ-HOT-001：`live_completed_suffix`统一改名为`hot_completed_tail`。

REQ-HOT-002：hot completed是DataService在当前cold baseline捕获之后实时产生、尚未被一次成功cold refresh吸收的全部completed bars。

REQ-HOT-003：每根hot completed满足`datetime_end != None`。

REQ-HOT-004：hot completed在DataRecorder写入DB前后都继续保留；持久化状态不影响图表和指标继续使用该bar。

REQ-HOT-005：DataRecorder commit、ACK、checkpoint、固定分钟数、固定bar数、wall-clock和内存压力策略均不得直接删除hot completed。

REQ-HOT-006：只有cold局部刷新成功、DB已覆盖相同identity、内容比较一致后，DataService才从hot tail吸收该identity。

REQ-HOT-007：目标高周期DB bar不存在时，DB completed 1m完整覆盖该period并且能够确定重建出相同bar时，DataService在原子重建后吸收hot高周期identity。

REQ-HOT-008：hot completed使用identity map维护唯一对象，对外按period start有序暴露；禁止反复复制整个list完成去重。

### 6.4 hot_current_bar

REQ-CURRENT-001：每个`(canonical_vt_symbol, interval)`最多一根current。

REQ-CURRENT-002：current只来源于DataService实时聚合，满足`datetime_end == None`。

REQ-CURRENT-003：current必须位于effective series最后；不存在current时completed末尾仍有效。

REQ-CURRENT-004：同一period内accepted Tick只原位更新current的high、low、close、volume、turnover、open_interest和最后事件元数据；open和period start不变。

REQ-CURRENT-005：rollover在DataService ingress线程内原子执行：

```text
冻结旧current最终值
→ 设置权威datetime_end
→ 插入hot_completed_tail一次
→ 收集同一1m边界同时完成的全部周期bar
→ 追加一个CompletedRolloverBatch并分配一个batch_sequence
→ 创建新period current
→ 更新GDS completed count/current row/index range
→ 增加series_seq并发布
```

同一rollover内每个interval的hot/GDS各追加一根对应completed bar，但可靠交付层只追加一个batch；禁止每根bar分配独立completed sequence。

REQ-CURRENT-006：迟到到已completed period的Tick不得重新打开或静默修改completed bar。该Tick按`822c715e6`迟到规则丢弃并计数，不因为一笔迟到Tick启动全局恢复。

### 6.5 effective series合并

REQ-MERGE-001：合并顺序固定为cold、hot completed、current按identity有序合并。

REQ-MERGE-002：cold和hot completed identity不同，均按period start进入结果；禁止简单把两个list首尾相接后保留重复identity。

REQ-MERGE-003：相同identity内容一致，只保留一根。

REQ-MERGE-004：相同completed identity内容不一致，当前发布使用DB completed；冲突hot隔离，不进入effective series；DataManager修复精确underlying 1m范围。

REQ-MERGE-005：DB不存在而hot completed存在时，hot completed进入effective series，不等待Recorder。

REQ-MERGE-006：DB、hot均不存在的expected completed identity不创建空bar、NaN bar、复制前值bar或状态bar。

REQ-MERGE-007：缺口只阻止依赖该identity的period materialization和指标区段；其他period/current/interval继续更新。

REQ-MERGE-008：DataRecorder写入相同completed bar前后，effective series的identity、逐字段内容、顺序、长度和指标结果完全不变。

REQ-MERGE-009：revision仅作为SHM odd/even seqlock实现细节；任何DB/hot比较中读取revision均判失败。

## 7. DataService完整运行步骤

### 7.1 进程启动与active激活

启动顺序固定为：

```text
父进程创建现有control/status Queue、completed wake Queue、batch ACK Queue、candidate Queue
→ RuntimeSupervisor启动DataService、DataManager、Recorder、CTA、Trigger
→ 每个进程报告PROCESS_READY
→ 主进程读取查询合约窗口持久化选择
→ 无有效值时主进程明确选择MHImain.HKFE
→ 主进程发送active command
→ DataService按旧main_contract_mapping解析actual
→ DataService设置stream_key=(service_generation, active_generation)
→ DataService创建唯一TickDatabus、稳定GDS和bounded CompletedBarLog
→ 各Tick消费者附着独立cursor
→ DataService订阅actual QUOTE和ORDER_BOOK
→ DataService开始缓存ingress Tick
→ DataService返回ACTIVE_ACK
→ DataManager先检查启动配置范围的历史覆盖并补齐DB
→ DataService加载完整cold baseline
→ DataService应用cold加载期间缓存且未被completed watermark覆盖的Tick
→ DataService构建hot current和各target current
→ DataService构建legacy contract
→ 对应range request返回一次COMPLETE
```

REQ-BOOT-001：PROCESS_READY之前不得接受业务命令；PROCESS_READY之后DataManager可使用history request，禁止等待全局数据状态。

REQ-BOOT-002：ACTIVE_ACK之前任何消费者不得把目标symbol视为当前可写active stream。

REQ-BOOT-003：range COMPLETE之前图表和指标不得消费该range的未验证descriptor；其他已经COMPLETE的range不受影响。

REQ-BOOT-004：启动缓存使用DataService内部有界sequence buffer。buffer overrun时不猜测，DataManager重新检查从cold watermark到最后completed minute的coverage，再建立current。

REQ-BOOT-005：启动不订阅、不等待、不消费实时`K_1M`。

REQ-BOOT-006：启动coverage范围只来自`822c715e6` DataManager现有启动配置。每个图表normalized range由visible range、IndicatorRuntime对本次指标集合计算出的实际最大lookback、4H/DAILY真实period-start前缀共同确定。

REQ-BOOT-007：启动期间收到的规范化Tick只向TickDatabus和外部逐Tick消费者发布一次。cold baseline建立后的缓存Tick replay只进入canonical聚合器，不得第二次进入CTA、Trigger、Recorder Tick、EVENT_TICK或execution quote。

REQ-BOOT-008：DataService重启时`service_generation`递增，旧`stream_key`标记ABORTED；不得沿用旧cursor或伪造正常seal。DataManager先修复Recorder配置周期和图表请求范围的completed缺口，再将新range标记为COMPLETE。

### 7.2 QUOTE与ORDER_BOOK ingress

REQ-TICK-001：DataService provider callback必须把QUOTE和ORDER_BOOK提交给一个单线程dispatcher；两个callback不得并发修改同一Tick/current。

REQ-TICK-002：每个callback先比较供应商回传actual symbol与当前旧`main_contract_mapping`结果，并校验现有active generation。旧actual或旧active callback直接丢弃并计数；不得新增mapping token或mapping version。

REQ-TICK-003：合法性校验不得把0成交量的盘口更新丢掉；非法NaN/inf价格、负累计volume/turnover和无效时区不得进入聚合。

REQ-TICK-004：raw Tick sequence对每个被DataService接受的callback加一。sequence用于ring cursor和诊断，不用于推断供应商漏Tick。

REQ-TICK-005：QUOTE负责旧字段投影；ORDER_BOOK在同一latest Tick上更新五档。两者均发布raw Tick以保持逐Tick消费者行为。

REQ-TICK-006：K线聚合admission必须复用`822c715e6`的限流和边界直通语义。普通同周期Tick被限流时，逐Tick消费者仍可收到raw Tick。

REQ-TICK-007：ORDER_BOOK未带来新的累计volume/turnover时，聚合delta固定为0；不得对前一次QUOTE累计值重复记账。

REQ-TICK-008：DataService禁止从TickDatabus读取自己的输出。聚合器直接接收dispatcher中的同一规范化Tick对象或只读view。

### 7.3 1m与多周期聚合

REQ-AGG-001：canonical 1m聚合的open为该分钟第一笔accepted Tick price；high/low为accepted prices极值；close为最后一笔accepted price。

REQ-AGG-002：volume、turnover和open interest逐字段保持`822c715e6` BarGenerator语义。不得借重构修改累计值差分或负值保护。

REQ-AGG-003：发现Tick进入新分钟时，必须先完成上一根1m，再创建新1m；该首Tick绕过普通限流。

REQ-AGG-004：5m、15m、30m、45m、1h、4h和DAILY从canonical 1m增量聚合，使用统一period authority。

REQ-AGG-005：每根completed 1m只进入每个目标period accumulator一次。UI、Worker、Recorder、CTA和Trigger不得重复生成共享period bar。

REQ-AGG-006：current 4H和DAILY可由“DB completed 1m period前缀 + DataService current 1m”建立；不得用Tick日开字段或启动后第一笔价格覆盖真实period open。

REQ-AGG-007：若真实period-start 1m不存在，必须发精确gap request。该4H/DAILY current在起始分钟恢复前不发布伪造值；其他interval继续。

REQ-AGG-008：V1 4H/DAILY和V2 4H/DAILY边界分别测试；不得只测试当前V2。

### 7.4 缺口检查与修复

固定流程为：

```text
ensure_coverage
→ HistoricalBarRequest
→ provider fetch
→ DataManager normalize/write/read-back/verify
→ changed range
→ load_cold_missing_only
→ snapshot_hot_tail（仅指锁内复制必要hot引用）
→ merge_and_validate
→ build_legacy_contract
→ publish_once
```

REQ-GAP-001：ensure_coverage根据交易日历、休市、半日市、V1/V2时段和请求范围计算expected completed 1m identities。

REQ-GAP-002：必须检测头部、中间和尾部缺口；cold非空不代表coverage完整。

REQ-GAP-003：下载范围必须是缺失或冲突所需的精确1m范围，不得无条件重新下载整年。

REQ-GAP-004：DataManager只通过现有`HistoricalBarRequest`请求DataService fetch；DataService用`HistoricalBarResponse`和`DataServiceHistoricalQueryResult`返回小型状态或临时SHM descriptor。DataManager必须把下载结果写DB、回读同范围并再次验证。只下载到内存而不写DB不得返回成功，DataService DB write调用次数必须为0。

REQ-GAP-005：高周期缺失或冲突从修复后DB completed 1m确定重建，不直接使用供应商高周期作为winner。

REQ-GAP-006：第一次修复失败记录结构化gap并继续服务已有DB completed和hot current；同一精确范围按现有query retry规则再次请求，不重启进程。

REQ-GAP-007：修复成功后只使相交Cold Range Cache失效；DataService在ingress线程安全点应用新cold并重建受影响period。

REQ-GAP-008：窗口最小化不停止DataService。恢复时先附着稳定GDS；只有DataService实际报告completed coverage缺失才调用DataManager。

REQ-GAP-009：TickDatabus overrun不能通过DataManager补造Tick。Recorder Tick和CTA记录gap后从最新cursor继续；K线是否修复由completed 1m coverage独立判断。

REQ-GAP-010：coverage计算复用现有`missing_ranges`结果，不建立第二套gap算法。GDS descriptor必须为请求范围发布有序`coverage_segments`，每段只包含真实连续identity；缺失范围不创建bar。

REQ-GAP-011：DataService崩溃或CompletedBarLog overrun导致高周期event未知时，Recorder向DataManager提交`stream_key`、最后checkpoint、当前配置interval和精确时间范围。DataManager从DB authoritative completed 1m重建缺失高周期、幂等写DB并回读复验；Recorder不得重新聚合Tick或自行下载。

REQ-GAP-012：临时history SHM在正常消费、校验失败、request取消、requester退出和迟到response五条路径均必须释放。释放失败是该request的结构化资源错误，不得把迟到数据写入stable GDS。

### 7.5 stable GDS与legacy contract发布

REQ-PUB-001：每个active generation按支持interval维护稳定GDS allocation。普通query、Tick、paint、drag、zoom和指标数量变化不得更换shm_name。

REQ-PUB-002：容量足够时原位更新；容量不足时分配更大allocation、复制一次有效数据、在seqlock保护下交换descriptor，然后释放旧allocation。

REQ-PUB-003：active切换或DataService进程重启创建新allocation；消费者按generation拒绝陈旧descriptor并重新attach。

REQ-PUB-004：不使用普通consumer lease或TTL。GDS生命周期由active generation和DataService owner统一管理。

REQ-PUB-005：同一series sequence的descriptor只发布一次。多个指标和图表读取同一descriptor。

REQ-PUB-006：legacy contract一次提供：

- `arr_1m`。
- `period_bars`。
- `index_ranges`。
- `current_bar_start_ix`。
- `base_n`。
- `base_first_ns`。
- `base_last_ns`。
- target current `period_start`和`open`。

REQ-PUB-007：`arr_1m = completed 1m + 最多一根current 1m`。

REQ-PUB-008：`period_bars = completed target + 最多一根current target`。只含completed的数组不得替代该输入。

REQ-PUB-009：`index_ranges`每行表示对应period bar覆盖的1m双闭索引范围；current行end等于`base_n - 1`。

REQ-PUB-010：`current_bar_start_ix`必须指向真实period-start 1m；4H/DAILY首分钟缺失时不得指向下一分钟。

REQ-PUB-011：消费者只在前后读到同一个偶数series sequence时接受跨数组视图。series sequence不得参与缓存key或业务winner。

REQ-PUB-012：每个Tick只更新current row、current mapping end和必要metadata；每个rollover只追加一根completed row和一行mapping。

REQ-PUB-013：每个descriptor携带与`arr_1m`和`period_bars`一致的`coverage_segments`。legacy adapter只能在同一连续segment内计算`index_ranges`，禁止让一个period跨越真实缺口。

REQ-PUB-014：Qt只在最终绘图数组的segment边界插入断线值，使PlotDataItem不跨缺口连线；断线值不是bar、不进入指标close数组、不写LMDB u0/u1，也不改变period identity。

## 8. 旧业务兼容契约

### 8.1 指标L1/L2/LMDB与绘制

REQ-IND-001：legacy adapter只适配DataService view到`822c715e6` Worker输入，不聚合、不计算指标、不持久化结果。

REQ-IND-002：指标L1保留旧period bar历史缓存key、命中、bar switch和DB tail invalidation语义。

REQ-IND-003：指标L2保留completed-prefix结果；current变化只计算必要tail/current，不使整个prefix失效。

REQ-IND-004：DataService Cold Range Cache不能替代指标L1；GDS不能替代L2；Worker结果不能绕过LMDB直接成为唯一绘图来源。

REQ-IND-005：LMDB L3保留旧`persistent_result_key_v1`及`u0/u1`契约。cold load和warm load都必须真实验收。

REQ-IND-006：period values只能通过同一descriptor的`index_ranges`映射到1m，不得通过数组尾长、period count或revision猜测。

REQ-IND-007：单个指标失败只隔离该指标；不得清空共享GDS、重启DataService或阻断其他指标。

REQ-IND-008：实施开始先对`822c715e6`和candidate执行registry discovery，生成全部已注册指标manifest；硬编码名称列表不能替代discovery。

REQ-IND-009：BOLL、LOWER_HIGHER_TREND和TREND_STATE_MACHINE必须执行完整数值与绘制验收；manifest中的其他指标执行同链smoke和基线输出比较。

REQ-IND-010：不修改任何指标数学公式、参数、输出名称、输出数量或pane归属来掩盖数据输入错误。

REQ-IND-011：current变化沿用`822c715e6`既有指标刷新节奏。多个刷新请求积压时只计算最新待处理series sequence，但period rollover的最终completed状态必须被持久化和绘制，不能被下一current覆盖。

### 8.2 DataRecorder completed交付

REQ-REC-001：DataService为唯一active合约的全部产品支持interval生成canonical completed事件，不读取Recorder配置。

REQ-REC-002：completed可靠传输只复用一个bounded `CompletedBarLog`，其共享内存条目固定为`CompletedRolloverBatch`。completed wake Queue只通知新tail，batch ACK Queue只返回小型确认；两者不得复制`bars[]`。

REQ-REC-003：每次canonical 1m rollover只分配一个`batch_sequence`。batch的`bars[]`按固定interval顺序包含该边界同时完成的1m及全部目标周期；一个bar一个sequence的实现判失败。

REQ-REC-004：DataRecorder checkpoint按`stream_key=(service_generation, active_generation)`保存最高连续完成的batch sequence，并为当前未ACK batch保存selected identities、skipped identities、persistence group和每个selected identity的durable状态。

REQ-REC-005：消费顺序固定为：

```text
按cursor读取CompletedRolloverBatch N
→ 校验stream_key、batch_sequence、completed和identity
→ 首次消费时按Recorder当前本地配置冻结selected/skipped集合
→ selected 1m进入旧timer buffer
→ selected高周期合并为一次immediate save_bar_data(list, stream=False)
→ immediate失败项进入旧timer buffer
→ timer flush一次save_bar_data(buffered_bars, stream=True)
→ 全部selected durable且其余bar skipped
→ checkpoint=N
→ ACK(stream_key, N)
```

REQ-REC-006：不命中当前Recorder配置的bar标为skipped，不进入DB；它仍参与该batch完成判定。batch中任一selected bar未durable时不得推进checkpoint或ACK，也不得越过N处理为已完成。

REQ-REC-007：配置只在batch首次消费、尚未入本地buffer前判定。checkpoint已记录的selected/skipped决定在崩溃重放时保持不变；不得引入config version、prepare/commit或DataService配置事务。

REQ-REC-008：commit前崩溃时对应durable状态不推进；commit后checkpoint前重放由SQLite identity compare返回相同；checkpoint后ACK前重放补发同一ACK。生产代码只增加`before_db_commit`、`after_db_commit_before_checkpoint`、`after_checkpoint_before_ack`三个默认关闭测试barrier。

REQ-REC-009：SQLite幂等入口不修改schema。`save_bar_data(list)`在一个现有`db.atomic()`中处理同batch高周期：identity不存在则插入，内容相同则成功，内容不同时不得覆盖并请求DataManager修复。

REQ-REC-010：DataService异常退出时旧stream标记ABORTED，正常active切换时发布`STREAM_SEAL(final_batch_sequence)`。旧batch、ACK、checkpoint和cursor只能作用于其原`stream_key`。

REQ-REC-011：CompletedBarLog overrun或ABORTED stream造成未ACK batch不可读时，不实现durable outbox。Recorder把最后checkpoint、配置interval和精确时间范围交给DataManager；DataManager从DB authoritative completed 1m重建并写入缺失周期。

REQ-REC-012：DataRecorder UI日志和统计必须来自真实batch receive、逐barselected/skipped、immediate/timer DB结果、checkpoint、ACK、seal、abort和overrun恢复，不得只打印进程启动。

REQ-REC-013：Tick录制继续消费TickDatabus并进入旧10秒批量链；每Tick直接调用DB数量为0。1m completed继续旧timer批量链；同batch配置高周期合并一次立即写，失败项降级到timer批量链。

REQ-REC-014：Recorder关闭顺序为停止接收新batch、完成已经进入本地buffer的写入、完成可达batch checkpoint/ACK、停止writer线程；不得强制完成或写入current。正常seal必须drain至final batch，ABORTED不得等待不存在的final sequence。

### 8.3 vn.py回调和交易Tick链

REQ-CALLBACK-001：Gateway/EventEngine/Oms、CTA、Trigger、execution quote和Recorder各消费同一raw Tick语义，但拥有独立cursor和独立职责。

REQ-CALLBACK-002：CTA生产链固定为：

```text
TickDatabusReader.read_next
→ CtaEngine.process_tick_event
→ SerialStrategyDispatcher("tick")
→ check_stop_order
→ strategy.on_tick
→ 策略私有BarGenerator
→ strategy.on_bar/on_window_bar
```

REQ-CALLBACK-003：DataService canonical completed bar直接调用CTA `process_bar_event`的次数为0，防止策略bar回调双发。

REQ-CALLBACK-004：主进程compatibility bridge必须是标准`EVENT_TICK`和symbol-specific Tick事件的唯一publisher；DataService接管行情后Gateway旧Tick event publisher必须关闭。

REQ-CALLBACK-005：OmsEngine只更新latest Tick及`822c715e6`已有轻量副作用；DataService已经是TickDatabus唯一writer时，OmsEngine不得再次写TickDatabus。

REQ-CALLBACK-006：MarketMonitor和TradingWidget可合并UI repaint，但不能用各自100ms轮询替代EventEngine事件。第三方EventEngine消费者仍能收到Tick。

REQ-CALLBACK-007：`MainEngine.get_tick()`必须返回当前active canonical Tick，驱动手工对手价、超价、市价、下单前校验和图表交易交互。

REQ-CALLBACK-008：FUTU追价使用execution quote consumer在每次新Tick到达时唤醒等价旧`_try_replace_on_tick`；取消回报只保留兜底。

REQ-CALLBACK-009：Trigger逐Tick判断并发送candidate；主进程bridge阻塞读取Queue后立即调用OrderExecutionGate，不通过EVENT_TIMER提交。

REQ-CALLBACK-010：candidate和ACK identity固定为`(service_generation, active_generation, candidate_id)`；attempt只做诊断。首次发送后以500ms间隔重试两次，仍无ACK则进入`DELIVERY_DEGRADED`并每1秒重发同一candidate，直到ACK或rule/active失效。

REQ-CALLBACK-011：主进程每Tick禁止执行K线聚合、指标计算、DB查询、全量SHM复制和同步PlotDataItem更新。

REQ-CALLBACK-012：Trigger只有自身TickDatabus cursor真实overrun时进入短暂`UNPROTECTED`。它必须复用现有`LineRuleGraph`、position projection和readiness，attach latest cursor后立即用latest Tick重评有效规则并由Trigger发恢复ACK；不得调用DataManager修复Tick。

REQ-CALLBACK-013：OrderIntent复用现有`actual_vt_symbol`。OrderExecutionGate提交前必须重验active generation、current actual、position/projection和reduce-only volume；不增加mapping epoch，旧active或旧actual candidate不得执行。

### 8.4 logical/actual和active切换

REQ-MAP-001：canonical active和DB identity始终是用户选择的logical symbol；实际月份只存在于provider/execution边界。

REQ-MAP-002：主连解析顺序必须从`822c715e6`提取characterization并逐分支锁定，不得另写新算法。

REQ-MAP-003：用户切换logical active时，旧active继续运行，DataManager先补齐并回读目标历史；成功后DataService订阅目标actual，在ingress dispatcher边界封存旧`stream_key`并发送`STREAM_SEAL(final_batch_sequence)`，递增active generation、建立新stream、原子切换callback接受目标、取消旧订阅并返回`ACTIVE_ACK(new_stream_key)`。补缺或订阅失败时旧active继续，任一时刻可写canonical symbol数量不超过1。

REQ-MAP-004：actual月份自动切换不等于用户切换logical active，不增加active generation或stream id。

REQ-MAP-005：实际月份切换后的旧callback通过“回传actual symbol必须等于当前旧mapping结果”拒绝；禁止将旧actual Tick投影到新mapping，禁止为此新增mapping token或mapping version。

REQ-MAP-006：active stream唯一身份为`(service_generation, active_generation)`。切回相同logical symbol仍递增active generation；actual自动换月不递增。旧envelope、ACK、checkpoint、cursor和descriptor必须按完整stream key fence。

REQ-MAP-007：actual mapping更新、subscribe/unsubscribe和callback acceptance全部在同一ingress dispatcher串行执行。自动换月顺序固定为subscribe new成功、切mapping、发布一次旧格式切换事件、unsubscribe old；subscribe失败保持old mapping。

### 8.5 query、错误和可观测性

REQ-QUERY-001：图表首次需要范围时发一个request并等待COMPLETE/FAILED；不得每约250ms重发canonical query。

REQ-QUERY-002：完全相同的in-flight request key复用一次工作；普通paint/drag/zoom只读取当前稳定GDS和已有cold coverage。

REQ-QUERY-003：相交但不相同range不引入通用coalescing抽象；各请求从Cold Range Cache计算自己的未覆盖差集。

REQ-QUERY-004：普通query失败只结束该request，不重启DataService、Worker、CTA、Trigger或Recorder。

REQ-QUERY-005：request身份只复用`session_id/request_id/request_generation/active_contract_generation`。取消或迟到response不得改变已有终态、stable GDS或cold cache；若携带临时SHM descriptor，必须立即release，不增加tombstone。

REQ-QUERY-006：完全相同request key共享一个in-flight fetch；不同但相交range分别从Cold Range Cache减去已覆盖部分，禁止建立overlap/coalescing DAG。

REQ-OBS-001：结构化日志至少区分process ready、active ack、range complete/failed、gap request/result、cold load、hot rollover、GDS publish、Recorder receive/filter/write/checkpoint/ack、Tick overrun和consumer reattach。

REQ-OBS-002：高频Tick不得逐笔输出INFO日志；计数和延迟按有界周期聚合。

REQ-OBS-003：每一种command/request/candidate/envelope必须能指出真实producer、consumer和终态；没有消费者的消息类型必须删除。

## 9. 测试真实性和证据规则

REQ-TEST-001：验收主链固定为：

```text
真实fixture
→ 隔离SQLite
→ DataManager coverage和写库
→ 独立DataService进程
→ 生产ingress
→ TickDatabus/GDS/Queue
→ IndicatorRuntime/Worker
→ L1/L2
→ 注册指标
→ 真实LMDB u0/u1
→ index_ranges
→ Qt MultiTimeframeWidget
→ 真实PlotDataItem
```

REQ-TEST-002：替代项仅包括外部不可重复边界：通过顶层replay factory代替真实OpenD持续推送，通过隔离order sink代替真实下单。DataService、DataManager、Recorder、SQLite、LMDB、GDS、Queue和PlotDataItem不得替代。

REQ-TEST-003：禁止monkeypatch被测核心方法；禁止fake DataService、fake LMDB、fake PlotDataItem、fake Queue和源码字符串搜索作为功能证据。

REQ-TEST-004：每个Acceptance必须写出fixture、初始DB、进程、生产入口、步骤、直接断言、PASS、FAIL/BLOCKED、清理、命令和artifact。

REQ-TEST-005：测试进程必须使用Windows `spawn`兼容的模块顶层factory；闭包、lambda和测试模块隐式全局不得作为child target输入。

REQ-TEST-006：测试结束必须验证所有child process退出、SHM unlink、LMDB关闭、临时SQLite删除；失败时保留诊断artifact但不得污染生产路径。

REQ-TEST-007：真实OpenD smoke只作为人工补充，不替代确定性自动验收，也不得向真实Gateway提交订单。

REQ-TEST-008：现有测试必须先做validity audit。错误地固化revision winner、实时K_1M、全局DATA_READY、业务旧视图、Recorder配置事务、统一批量或per-query lease的测试必须REWRITE或DELETE。

REQ-TEST-009：证据索引写入`.artifacts/goal/dataservice-cold-hot-legacy-chain/evidence-index.json`，每条包含Acceptance ID、命令、退出码、artifact路径和SHA-256。

REQ-TEST-010：Goal合同生成前，`tests/fixtures/dataservice/manifest.json`必须已经包含离线 fixture 的精确 event ID、市场时间、期望 OHLCV、记录数、字节数和 SHA-256；任一离线字段不存在时返回`blocked_by_contract_ambiguity:performance_dataset`。实时 callback 尚未采集的场景必须在 manifest 中标记为`blocked_until_market_open:<scenario>`，不得伪造事件。

REQ-TEST-011：每个`AC-xx`必须拆成至少一个`AC-xx-Sxx`。每个scenario独立声明Goal Task、精确产品文件、测试文件和pytest nodeid、fixture、初始DB、真实进程、操作、直接断言、PASS、FAIL、BLOCKED、teardown、命令和artifact。

REQ-TEST-012：PowerShell Qt命令必须在当前shell直接执行`$env:QT_QPA_PLATFORM='offscreen'; python -m pytest ...`；不得把含`$env:`的命令再嵌套进双引号`pwsh -Command`。

REQ-TEST-013：除三个Recorder barrier外，故障场景必须通过真实bounded log/Queue容量、真实provider error response、真实request cancellation、明确child PID终止和真实SQLite锁驱动。禁止以sleep时长决定故障边界。

REQ-TEST-014：仓库未冻结全局lint配置，因此合同质量命令只声明Python compileall、关键模块import、pytest collect-only和修改Python文件的Ruff candidate/baseline差异。不得声称全局mypy、pyright或未配置lint已通过。

## 10. 逐项与逐场景验收矩阵

### 10.1 统一fixture与运行环境

FIXTURE-001：历史样本路径固定为`tests/fixtures/dataservice/mhi_completed_1m.parquet`。

FIXTURE-002：实时回放路径固定为`tests/fixtures/dataservice/mhi_quote_orderbook.jsonl`。

FIXTURE-003：来源、市场时间范围、记录数、字节数和SHA-256固定在`tests/fixtures/dataservice/manifest.json`。

FIXTURE-004：样本必须覆盖以下时间点：

- V1规则下17:15 DAILY open。
- V1规则下21:15 4H open。
- `2026-07-20 17:00` V2 cutover。
- V2规则下17:00 DAILY open。
- V2规则下21:00 4H open。
- 至少两个完整5m rollover。
- BOLL默认lookback之前和之后。
- 一个可删除的四小时中间completed 1m范围。
- QUOTE后紧邻ORDER_BOOK且累计volume不变的事件对。

FIXTURE-005：每个测试运行时创建独立SQLite、LMDB、SHM namespace和artifact目录，不读取或写入工作区`database.db`。

FIXTURE-006：统一Qt命令设置`QT_QPA_PLATFORM=offscreen`；所有子进程使用Windows spawn。

FIXTURE-007：`manifest.json`必须为每个场景列出`fixture_id/source/timezone/start/end/record_count/byte_count/sha256/event_ids/expected_period_starts/expected_ohlcv`，并明确V1/V2、缺口、同rollover多周期、actual换月、Trigger触发和query迟到response所使用的记录ID。

FIXTURE-008：Goal合同生成前必须实际读取`mhi_completed_1m.parquet`、`mhi_historical_ticks.parquet`、`mhi_quote_orderbook.jsonl`和`manifest.json`并核验 manifest。离线核心场景的文件不存在、SHA不匹配、精确 event ID 缺失或期望值缺失时，合同生成必须停止并返回`blocked_by_contract_ambiguity:performance_dataset`；实施代理不得生成随机数据补位。实时 callback 或实际换月场景保持`blocked_until_market_open:<scenario>`，该状态阻止对应验收通过，不阻止离线实现任务和性能对照任务进入 Goal 合同。

FIXTURE-009：离线核心场景必须使用真实 completed 1m、真实合并历史 Tick 和真实生产代码；真实 QUOTE/ORDER_BOOK 来源及实际换月只能使用真实 FUTU callback 采集结果。市场关闭时不得以 CSV、Parquet、合并 Tick 或首推快照声明实时 callback 场景通过。

FIXTURE-010：CSV 是离线回放载体；CSV 作为验收输入必须同时满足以下条件：CSV 必须来自生产 SQLite 的索引窄范围导出或真实 OpenD callback 采集；manifest 必须列出 CSV 的精确路径、字段名、时区、时间范围、记录数、字节数、SHA-256、来源 receipt 和每个场景的期望 identity/OHLCV；回放入口必须按旧链字段规则将 CSV 行归一化为 `BarData` 或 `TickData`，再送入真实 DataManager、DataService、IndicatorRuntime、LMDB 和 Qt 生产链；CSV 不得包含随机、线性演示或未证明来源的数据；CSV 不能证明原始 `QUOTE`/`ORDER_BOOK` callback 类型，也不能证明实际合约换月，两个场景仍必须使用真实 FUTU callback 证据。当前 `test_data/MHImain_HKFE.csv` 未列入 manifest 且没有生产来源 receipt，不得作为本目标的性能或业务权威；当前真实权威离线样本仍为 `tests/fixtures/dataservice/mhi_completed_1m.parquet`、`tests/fixtures/dataservice/mhi_historical_ticks.parquet` 和 `tests/fixtures/dataservice/manifest.json`。

### 10.1.1 当前前置证据冻结状态（2026-09-05）

以下证据已在合同生成前检查并写入本 Source Plan。它们只记录数据来源和门禁状态，不改变业务语义，也不解除 FIXTURE-008。

- `tests/fixtures/dataservice/mhi_completed_1m.parquet`：真实生产 SQLite 窄范围只读导出，2,760 根 completed 1m，字节数 `91322`，SHA-256 `54613812fad211ef7f5eb5b48668613eab9b6dc1ba3c08f9164d02e7d2c81131`。
- `.artifacts/source-plan/dataservice-cold-hot-legacy-chain/historical-fixture-export.v1.json`：导出 receipt，字节数 `3518`，SHA-256 `e3bb9915f8b41ab62c5424dd375b931871cc18401c487fa09d9d4467e4be0f1b`。
- `tests/fixtures/dataservice/mhi_historical_ticks.parquet`：真实生产 SQLite `dbtickdata` 窄范围只读导出，51 条合并历史 Tick，包含成交字段和五档盘口，字节数 `14788`，SHA-256 `579d88d97a678528e5daeaa5c523fff39c0e50bf40a5b18933af7f873fb91937`；该文件不包含原始 callback 类型。
- `.artifacts/source-plan/dataservice-cold-hot-legacy-chain/historical-tick-fixture-export.v1.json`：历史 Tick 导出 receipt，SHA-256 `61df4e98193ed8a53fc42ba5929eb7abf14436f5073d5c6ce6254d50c161b95d`。
- `tests/fixtures/dataservice/mhi_quote_orderbook.jsonl`：真实 FUTU OpenD callback 首推样本，按同一会话实际到达顺序包含相邻 `QUOTE → ORDER_BOOK` 各一条，字节数 `2513`，SHA-256 `1c14a8ac79ed6c2837b48fdf8a6eb67c84c450697ccac9385413dd1c85cc9169`。
- `tests/fixtures/dataservice/manifest.json`：当前 manifest 状态为 `PASS_OFFLINE_LIVE_PENDING`，包含真实外部 CSV 交叉校验和四个离线派生场景定义，字节数 `9251`，SHA-256 `1f83705f2bba8c1ae94f854e0eced443a2e5f3c89400fe122b50e44c155229e4`。
- `.artifacts/source-plan/dataservice-cold-hot-legacy-chain/historical-offline-validation.v1.json`：生产 `HKFEBarGenerator`、`BarGenerator` 和 TA-Lib 离线验证 receipt，状态 `PASS`，SHA-256 `6de087d391f733edeb05f89757588c99e84e0f09bd9a15dc08c0685ab3d4ed08`。
- `.artifacts/source-plan/dataservice-cold-hot-legacy-chain/fixture-coverage-validation.v1.json`：覆盖验证状态为 `PASS_OFFLINE_LIVE_PENDING`，10 个场景中 8 个已有离线输入、2 个实时场景待市场开放，CSV 交叉校验已通过，manifest 哈希已绑定，SHA-256 `68b3e9abfa6a83ee1982d14baf00a0216477a3e24ab5f15ea52f4d4ce7052f53`。
- `.artifacts/source-plan/dataservice-cold-hot-legacy-chain/pre-goal-fixture-integrity.v1.json`：真实读取 manifest、2,760 根 completed 1m、51 条历史 Tick、2 条 raw callback 和外部 CSV；六个开盘样本、缺口 identity、60 根 Recorder rollover 输入、Trigger 指定 Tick 行及全部 fixture 哈希均通过，状态 `PASS_OFFLINE_LIVE_PENDING`，SHA-256 `671334e026c06080e2d9769d5a84db793ba010c2bd8bd5081ff1df27b32afb4d`。
- 外部来源文件 D:\Dev\MHImain\1m\MHImain_1m_2026_09_2026.csv：用户提供的真实 2026 年 1m 历史 CSV，159,120 根，字节数 `16640461`，SHA-256 `6da1a2746269f5627efc8f14a7bf36e6de34f5cdd71d01b19b02e5838b345a16`；与真实 Parquet 重叠的 2,760 根按 `datetime、OHLCV、turnover、open_interest` 逐字段一致，manifest 六个 V1/V2 开盘样本全部一致；验证 receipt 为 `.artifacts/source-plan/dataservice-cold-hot-legacy-chain/csv-historical-fixture-validation.v1.json`。该 CSV 可用于离线历史回放、缺口检测输入和 Parquet 交叉校验，但未复制进仓库且未作为合同唯一 fixture；它不能证明原始 QUOTE/ORDER_BOOK、Trigger/Recorder IPC 或实际合约换月。
- `.artifacts/source-plan/dataservice-cold-hot-legacy-chain/encoding-pre-goal-20260905.log`：编码门禁输出 `checkedFiles=361 findings=0 source=git`，SHA-256 `d43e7023f5cb0fb28397b2dab9875e9252f2007a13fd394b5d87cab1cc130153`。
- .artifacts/source-plan/dataservice-cold-hot-legacy-chain/judge-credential-copy-receipt-20260905.json：已核对外部 BMAD-Speckit-SDD-Flow 凭据与当前治理配置兼容，目标文件 SHA-256 与源文件一致；收据不包含密钥内容。
- `.artifacts/source-plan/dataservice-cold-hot-legacy-chain/command-portability-pre-goal-20260905.json`：PowerShell portability 门禁 `status=PASS`、`issueCount=0`，SHA-256 `19f6269adf1c6f609db455286e2345fb63ddf69bf4f2014e41bb3035091b7ae4`。
- 当前实时阻塞为 `blocked_until_market_open:live_callback_cross_minute_sequence` 和 `blocked_until_market_open:live_actual_contract_switch_sequence`。历史 CSV/Parquet 和合并历史 Tick 用于离线开发、离线功能验证与性能对照；实时 callback 场景在市场开放前不得标记为通过。

### AC-01：cold只包含completed，current只在hot末尾

#### AC-01-S01：隔离DB污染记录与实时current顺序

- 对应修复：FIX-01、FIX-09。
- 对应工作包：WORK-05、WORK-07。
- 精确产品路径：`vnpy/trader/dataservice/runtime.py`；`vnpy/trader/dataservice/query_runtime.py`。
- 测试文件/nodeid：`tests/integration/test_dataservice_cold_hot_effective_series_e2e.py::test_cold_completed_and_current_last`。
- 初始状态：隔离DB含连续completed 1m/5m，另人工插入一条`datetime_end == None`污染记录。
- 生产入口：DataManager coverage后启动真实DataService range query。
- 操作：加载cold，回放当前5m内QUOTE Tick，读取稳定GDS descriptor。
- 直接断言：污染记录不进入cold；DB incomplete行触发结构化污染错误；每interval最多一根current；current为最后一根；`base_n`和first/last ns一致。
- PASS：全部字段和顺序断言成立，range只发布一次COMPLETE。
- FAIL：DB incomplete进入数组、current不在末尾、同interval出现两根current或发布未验证range。
- 命令：`python -m pytest -q tests/integration/test_dataservice_cold_hot_effective_series_e2e.py::test_cold_completed_and_current_last`。
- 证据：`.artifacts/goal/dataservice-cold-hot-legacy-chain/ac-01/series.json`。
- 清理：关闭进程并验证测试SHM、SQLite和LMDB路径删除。
- BLOCKED：隔离SQLite或SHM不可创建时返回`blocked_by_environment:sqlite_or_shm`；缺少fixture时返回`blocked_by_contract_ambiguity:performance_dataset`。

### AC-02：cold/hot一致去重，Recorder写入前后序列不变

#### AC-02-S01：hot落库和cold吸收的四阶段不变性

- 对应修复：FIX-01、FIX-14。
- 对应工作包：WORK-06、WORK-07、WORK-11。
- 精确产品路径：`vnpy/trader/dataservice/runtime.py`；`vnpy_datarecorder/vnpy_datarecorder/canonical_consumer.py`。
- 测试文件/nodeid：`tests/integration/test_dataservice_cold_hot_effective_series_e2e.py::test_recorder_commit_does_not_change_effective_series`。
- 初始状态：DataService hot tail含一根completed 5m；DB最初没有该identity。
- 生产入口：真实CompletedRolloverBatch log到Recorder，再到真实SQLite。
- 操作：记录写入前descriptor hash；Recorder commit；changed range；DataService局部cold refresh并吸收hot。
- 直接断言：写入前后identity、OHLCV、顺序、BOLL输入close和GDS值完全相同；重叠identity始终只有一根；只有验证后hot map才删除。
- PASS：四个阶段的业务hash一致，hot吸收发生在cold compare之后。
- FAIL：Recorder ACK立即删除hot、出现重复bar、指标重算值变化或全范围DB reload。
- 命令：`python -m pytest -q tests/integration/test_dataservice_cold_hot_effective_series_e2e.py::test_recorder_commit_does_not_change_effective_series`。
- 证据：`.artifacts/goal/dataservice-cold-hot-legacy-chain/ac-02/timeline.json`。
- BLOCKED：无法隔离Recorder DB/checkpoint时返回`blocked_by_environment:recorder_isolation`。
- 清理：停止Recorder/DataService，关闭SQLite并unlink GDS/CompletedBarLog。

### AC-03：cold/hot冲突由DB继续权威并完成精确修复

#### AC-03-S01：DB权威继续服务并由DataManager修复冲突

- 对应修复：FIX-01、FIX-03、FIX-04。
- 对应工作包：WORK-05、WORK-06、WORK-07。
- 精确产品路径：`vnpy/trader/dataservice/query_runtime.py`；`vnpy_datamanager/vnpy_datamanager/engine.py`。
- 测试文件/nodeid：`tests/integration/test_dataservice_datamanager_repair_e2e.py::test_conflict_uses_db_then_rebuilds_from_repaired_1m`。
- 初始状态：隔离DB 5m close为A，hot同identity close为B；underlying 1m可确定权威结果C。
- 生产入口：DataService merge、现有HistoricalBarRequest/Response、DataManager DB transaction、changed range。
- 操作：触发merge冲突，读取冲突期间GDS；执行精确repair；读取修复后GDS。
- 直接断言：冲突期间发布A而非B；revision变化不影响选择；DataManager拥有range/write/read-back；修复后目标5m等于从修复后1m聚合的C。
- PASS：无静默hot winner、无全局冻结、无第二OpenD context、DataService DB write次数为0。
- FAIL：发布B、比较revision、跳过DB回读或直接采用供应商高周期。
- 命令：`python -m pytest -q tests/integration/test_dataservice_datamanager_repair_e2e.py::test_conflict_uses_db_then_rebuilds_from_repaired_1m`。
- 证据：`.artifacts/goal/dataservice-cold-hot-legacy-chain/ac-03/repair-trace.json`。
- BLOCKED：fixture没有可证明C值的underlying 1m时返回`blocked_by_contract_ambiguity:performance_dataset`。
- 清理：停止DataManager/DataService，release history SHM，关闭并删除隔离SQLite/GDS。

### AC-04：非空DB中的四小时中间缺口必须先补齐

#### AC-04-S01：首次发布前修复中间四小时缺口

- 对应修复：FIX-02、FIX-03、FIX-09。
- 对应工作包：WORK-05、WORK-07。
- 精确产品路径：`vnpy_datamanager/vnpy_datamanager/engine.py`；`vnpy/trader/dataservice/query_runtime.py`。
- 测试文件/nodeid：`tests/integration/test_dataservice_datamanager_repair_e2e.py::test_middle_four_hour_gap_is_filled_before_publish`。
- 初始状态：真实历史子集非空，删除交易时段内连续四小时completed 1m。
- 生产入口：首次4H chart range query。
- 操作：DataManager计算expected identities，下载精确缺口，写DB，回读；DataService仅在回读验证通过后build/publish。
- 直接断言：头部、中间、尾部coverage均被检查；首次COMPLETE前DB缺口为0；4H bars连续；IndicatorRuntime没有在缺口存在时计算该range。
- PASS：缺口下载、DB commit、read-back、局部cold load和单次publish顺序一致。
- FAIL：cold非空即跳过检测、先算指标后补数、使用后一根分钟填洞或反复返回pending。
- 命令：`python -m pytest -q tests/integration/test_dataservice_datamanager_repair_e2e.py::test_middle_four_hour_gap_is_filled_before_publish`。
- 证据：`.artifacts/goal/dataservice-cold-hot-legacy-chain/ac-04/coverage.json`。
- BLOCKED：fixture未冻结四小时缺口event/identity范围时返回`blocked_by_contract_ambiguity:performance_dataset`。
- 清理：release history response SHM，停止进程并删除隔离DB/cache/GDS。

### AC-05：repair首次失败只隔离缺口，其他数据继续更新

#### AC-05-S01：精确缺口重试期间未受影响区段持续更新

- 对应修复：FIX-02、FIX-04。
- 对应工作包：WORK-05、WORK-07。
- 精确产品路径：`vnpy/trader/dataservice/recovery.py`；`vnpy/trader/dataservice/query_runtime.py`。
- 测试文件/nodeid：`tests/integration/test_dataservice_datamanager_repair_e2e.py::test_failed_repair_keeps_unaffected_series_live`。
- 初始状态：DB有缺口前后completed，provider第一次对精确range返回可重试错误，第二次成功。
- 生产入口：真实history request executor和DataManager状态机。
- 操作：第一次query失败期间继续回放当前Tick；随后执行第二次history response。
- 直接断言：DB已有completed继续可读；hot current close继续变化；缺失identity不进入数组；DataService/Worker PID不变；第二次成功后只更新相交range。
- PASS：系统持续接收和发布未受影响数据，修复成功后缺口恢复。
- FAIL：返回停止更新的旧数组冒充实时、新建占位bar、停止全部指标或重启进程。
- 命令：`python -m pytest -q tests/integration/test_dataservice_datamanager_repair_e2e.py::test_failed_repair_keeps_unaffected_series_live`。
- 证据：`.artifacts/goal/dataservice-cold-hot-legacy-chain/ac-05/live-during-repair.json`。
- BLOCKED：provider replay不能返回确定的失败/成功序列时返回`blocked_by_environment:replay_provider`。
- 清理：完成或取消pending request，release临时SHM，停止进程并删除隔离DB。

### AC-06：22:05启动正确构建实时4H open

#### AC-06-S01：V2中途启动从21:00历史前缀恢复4H open

- 对应修复：FIX-08、FIX-09、FIX-17。
- 对应工作包：WORK-04、WORK-07、WORK-09。
- 精确产品路径：`vnpy/trader/dataservice/canonical_bars.py`；`vnpy/chart/multi_timeframe_widget.py`。
- 测试文件/nodeid：`tests/integration/test_dataservice_period_open_e2e.py::test_v2_mid_period_4h_open_comes_from_2100_minute`。
- 初始状态：V2交易日，DB含21:00至22:04前最后completed 1m，真实21:00 open为O；DataService在22:05开始缓存Tick。
- 生产入口：active ACK、DataManager coverage、DataService cold load和生产ingress。
- 操作：完成启动并打开4H图表，再回放22:05内多个QUOTE/ORDER_BOOK。
- 直接断言：4H current period start为21:00；open为O；`arr_1m[current_bar_start_ix].datetime==21:00`；对应open同为O；启动后第一Tick价格不覆盖open。
- PASS：单周期和多周期图表读取同一descriptor并显示O。
- FAIL：open取21:01、22:05第一Tick、Tick日开字段或UI本地修正值。
- 命令：`python -m pytest -q tests/integration/test_dataservice_period_open_e2e.py::test_v2_mid_period_4h_open_comes_from_2100_minute`。
- 证据：`.artifacts/goal/dataservice-cold-hot-legacy-chain/ac-06/4h-open.json`。
- BLOCKED：fixture缺少V2 21:00至22:05完整前缀时返回`blocked_by_contract_ambiguity:performance_dataset`。
- 清理：关闭图表和Worker，停止DataService并unlink GDS/LMDB/SQLite。

### AC-07：4H和DAILY开盘价同时覆盖V1/V2

#### AC-07-S01：V1/V2四组period-start矩阵

- 对应修复：FIX-09、FIX-17。
- 对应工作包：WORK-04、WORK-09。
- 精确产品路径：`vnpy/trader/period_utils.py`；`vnpy/chart/multi_timeframe_widget.py`。
- 测试文件/nodeid：`tests/integration/test_dataservice_period_open_e2e.py::test_v1_v2_daily_and_4h_open_matrix`。
- 初始状态：fixture分别覆盖cutover前后两个交易日。
- 生产入口：现有period authority、DataService聚合、stable GDS、Qt图表。
- 操作：分别加载V1 17:15 DAILY、V1 21:15 4H、V2 17:00 DAILY、V2 21:00 4H current。
- 直接断言：四个current open都等于真实period-start 1m open；历史跨cutover查询逐bar选择版本；UI没有DB查询或later-minute fallback。
- PASS：四组period start/open/current_bar_start_ix逐项成立。
- FAIL：按当前日期统一使用V2、V1夜盘从17:00开始、V2夜盘从17:15开始或任何起始分钟替代。
- 命令：`python -m pytest -q tests/integration/test_dataservice_period_open_e2e.py::test_v1_v2_daily_and_4h_open_matrix`。
- 证据：`.artifacts/goal/dataservice-cold-hot-legacy-chain/ac-07/session-open-matrix.json`。
- BLOCKED：V1或V2任一真实fixture窗口缺失时返回`blocked_by_contract_ambiguity:performance_dataset`。
- 清理：关闭Qt/Worker/DataService，unlink全部测试SHM并删除隔离DB/LMDB。

### AC-08：period-start分钟缺失时先补缺，不用较晚分钟冒充

#### AC-08-S01：21:00缺失时禁止21:01替代

- 对应修复：FIX-02、FIX-03、FIX-09。
- 对应工作包：WORK-05、WORK-07、WORK-09。
- 精确产品路径：`vnpy_datamanager/vnpy_datamanager/engine.py`；`vnpy/trader/dataservice/canonical_bars.py`。
- 测试文件/nodeid：`tests/integration/test_dataservice_period_open_e2e.py::test_missing_period_start_is_repaired_without_later_minute_fallback`。
- 初始状态：删除V2 21:00 1m，保留21:01以后数据。
- 生产入口：4H range query和DataManager coverage。
- 操作：请求4H current；第一次provider失败，第二次返回21:00。
- 直接断言：第一次不发布open为21:01的4H current，其他interval仍更新；第二次DB回读后4H current open等于真实21:00 open。
- PASS：缺失起点全程没有伪造4H bar，恢复后只发布正确值。
- FAIL：用21:01替代、UI修正open、冻结全部GDS或跳过DB写入。
- 命令：`python -m pytest -q tests/integration/test_dataservice_period_open_e2e.py::test_missing_period_start_is_repaired_without_later_minute_fallback`。
- 证据：`.artifacts/goal/dataservice-cold-hot-legacy-chain/ac-08/missing-open.json`。
- BLOCKED：fixture没有21:00 authoritative bar及21:01以后bar时返回`blocked_by_contract_ambiguity:performance_dataset`。
- 清理：完成repair/release SHM，关闭图表和进程，删除隔离DB/LMDB。

### AC-09：QUOTE与ORDER_BOOK维持旧Tick语义且不重复累计

#### AC-09-S01：成交与盘口双事件只累计一次成交量

- 对应修复：FIX-08。
- 对应工作包：WORK-03、WORK-04。
- 精确产品路径：`vnpy/trader/dataservice/quote_state.py`；`vnpy/trader/dataservice/runtime.py`。
- 测试文件/nodeid：`tests/integration/test_dataservice_quote_orderbook_ingress_e2e.py::test_quote_orderbook_preserve_tick_and_volume_semantics`。
- 初始状态：加载manifest中QUOTE/ORDER_BOOK事件对。
- 生产入口：真实DataService provider adapter和单线程ingress。
- 操作：按JSONL顺序回放一笔QUOTE及随后盘口更新，再跨分钟回放。
- 直接断言：两个raw Tick sequence连续；五类consumer cursor可读；ORDER_BOOK Tick含新五档；1m volume/turnover只增加QUOTE对应delta；新分钟首Tick完成上一分钟一次。
- PASS：OHLCV与`822c715e6`同输入characterization逐字段一致。
- FAIL：ORDER_BOOK不发布、重复累计volume、DataService读回自身ring或实时订阅K_1M。
- 命令：`python -m pytest -q tests/integration/test_dataservice_quote_orderbook_ingress_e2e.py::test_quote_orderbook_preserve_tick_and_volume_semantics`。
- 证据：`.artifacts/goal/dataservice-cold-hot-legacy-chain/ac-09/tick-aggregation.json`。
- BLOCKED：QUOTE/ORDER_BOOK真实配对event IDs缺失时返回`blocked_by_contract_ambiguity:performance_dataset`。
- 清理：停止全部cursor和DataService，取消provider订阅并unlink TickDatabus/GDS。

### AC-10：限流、迟到Tick和consumer overrun不得混成历史缺口

#### AC-10-S01：三种连续性分离处置

- 对应修复：FIX-08、FIX-16。
- 对应工作包：WORK-04、WORK-12。
- 精确产品路径：`vnpy/trader/dataservice/throttle.py`；`vnpy/datafeed/tick_databus.py`。
- 测试文件/nodeid：`tests/integration/test_dataservice_tick_continuity_e2e.py::test_throttle_late_tick_and_overrun_are_distinct`。
- 初始状态：小容量测试ring，包含高频同分钟Tick、新分钟边界Tick、迟到Tick和刻意慢consumer。
- 生产入口：TickDatabus和DataService admission。
- 操作：触发限流、rollover、迟到和physical overrun。
- 直接断言：限流不发history request；边界首Tick直通；迟到不重开completed；overrun只记录对应consumer gap；K线coverage完整时DataManager调用为0。
- PASS：每种连续性按第4.5节独立处置。
- FAIL：sequence跳号触发DB重载、DataManager补造Tick、阻塞producer或修改completed。
- 命令：`python -m pytest -q tests/integration/test_dataservice_tick_continuity_e2e.py::test_throttle_late_tick_and_overrun_are_distinct`。
- 证据：`.artifacts/goal/dataservice-cold-hot-legacy-chain/ac-10/continuity.json`。
- BLOCKED：无法创建隔离小容量TickDatabus时返回`blocked_by_environment:shared_memory`。
- 清理：停止慢consumer和DataService，unlink ring/GDS并删除隔离DB。

### AC-11：5m current BOLL完整、实时和rollover连续

#### AC-11-S01：BOLL current、TA-Lib和rollover绘图闭环

- 对应修复：FIX-17。
- 对应工作包：WORK-08、WORK-09。
- 精确产品路径：`vnpy/datafeed/indicator_engine.py`；`vnpy/chart/indicator_drawing_manager.py`。
- 测试文件/nodeid：`tests/integration/test_dataservice_indicator_lmdb_qt_e2e.py::test_5m_boll_current_rollover_and_plot`。
- 初始状态：隔离DB提供超过BOLL lookback的completed 5m；DataService创建current 5m。
- 生产入口：descriptor→legacy adapter→L1→L2→BOLL→LMDB→mapping→Qt。
- 操作：记录初始三线；回放改变current close的Tick；回放period最后Tick和下一period首Tick。
- 直接断言：current upper/middle/lower均非缺失；close变化后三线等于TA-Lib同close数组；rollover前最后current和转completed同identity值一致。
- PASS：LMDB u0/u1、映射值和PlotDataItem实际xData/yData逐点一致。
- FAIL：current被截断、整段prefix重算、rollover跳线或只断言worker数组。
- 命令：`$env:QT_QPA_PLATFORM='offscreen'; python -m pytest -q tests/integration/test_dataservice_indicator_lmdb_qt_e2e.py::test_5m_boll_current_rollover_and_plot`。
- 证据：`.artifacts/goal/dataservice-cold-hot-legacy-chain/ac-11/boll-values.npz`和`plot-values.json`。
- BLOCKED：TA-Lib、Qt offscreen或真实LMDB不可用时返回`blocked_by_environment:talib_qt_lmdb`。
- 清理：关闭PlotDataItem所属widget和Worker，关闭LMDB，unlink SHM并删除隔离DB。

### AC-12：全部自定义指标共享旧L1/L2/LMDB链

#### AC-12-S01：registry全部指标cold/warm/current/rollover

- 对应修复：FIX-17。
- 对应工作包：WORK-08、WORK-09。
- 精确产品路径：`vnpy/datafeed/indicator_worker.py`；`indicators/indicator_registry.py`。
- 测试文件/nodeid：`tests/integration/test_dataservice_all_indicators_e2e.py::test_all_registered_indicators_use_legacy_chain`。
- 初始状态：执行registry discovery，加载与822基线相同fixture和参数。
- 生产入口：真实IndicatorRuntime/Worker、LMDB和Qt item factory。
- 操作：对每个注册指标执行cold compute、第二次warm load、current更新和rollover。
- 直接断言：每个指标输出名称/数量/dtype/长度与822一致；共享descriptor相同；current变化不清空completed prefix；LMDB cold/warm均可读。
- PASS：BOLL、LOWER_HIGHER_TREND、TREND_STATE_MACHINE完整通过，其他manifest指标smoke通过。
- FAIL：任何指标使用专用DataService query、绕过LMDB、直接查DB或输出契约漂移。
- 命令：`$env:QT_QPA_PLATFORM='offscreen'; python -m pytest -q tests/integration/test_dataservice_all_indicators_e2e.py::test_all_registered_indicators_use_legacy_chain`。
- 证据：`.artifacts/goal/dataservice-cold-hot-legacy-chain/ac-12/indicator-manifest.json`和`baseline-diff.json`。
- BLOCKED：822 worktree或registry manifest无法建立时返回`blocked_by_contract_ambiguity:legacy_indicator_registry`。
- 清理：关闭全部Worker/widget/LMDB，unlink共享descriptor并删除隔离DB。

### AC-13：LMDB u0/u1到index_ranges再到真实PlotDataItem一致

#### AC-13-S01：真实LMDB重开后映射到真实PlotDataItem

- 对应修复：FIX-17。
- 对应工作包：WORK-08、WORK-09。
- 精确产品路径：`vnpy/datafeed/indicator_storage.py`；`vnpy/datafeed/index_range_builder.py`；`vnpy/chart/indicator_drawing_manager.py`。
- 测试文件/nodeid：`tests/integration/test_dataservice_indicator_lmdb_qt_e2e.py::test_lmdb_u0_u1_mapping_reaches_real_plot_item`。
- 初始状态：清空隔离LMDB，使用同一5m descriptor。
- 生产入口：生产LMDB storage和Qt MultiTimeframeWidget。
- 操作：第一次计算写u0/u1；关闭并重开Worker执行warm load；打开真实主图与副图。
- 直接断言：u0为period长度；u1为base 1m长度；base metadata匹配；index_ranges映射逐点相等；PlotDataItem实际数据hash相等。
- PASS：cold和warm两次最终绘图完全一致，第二次命中LMDB。
- FAIL：启发式remap、数组尾部对齐、fake item或GDS结果绕过LMDB。
- 命令：`$env:QT_QPA_PLATFORM='offscreen'; python -m pytest -q tests/integration/test_dataservice_indicator_lmdb_qt_e2e.py::test_lmdb_u0_u1_mapping_reaches_real_plot_item`。
- 证据：`.artifacts/goal/dataservice-cold-hot-legacy-chain/ac-13/lmdb-map-plot.json`。
- BLOCKED：Qt offscreen或LMDB不可用时返回`blocked_by_environment:qt_or_lmdb`。
- 清理：关闭widget/Worker/LMDB，unlink SHM并删除隔离SQLite。

### AC-14：Recorder UI配置即时生效且不控制DataService

#### AC-14-S01：add/pause/resume/delete消费边界

- 对应修复：FIX-12、FIX-13。
- 对应工作包：WORK-10、WORK-11。
- 精确产品路径：`vnpy_datarecorder/vnpy_datarecorder/engine.py`；`vnpy_datarecorder/vnpy_datarecorder/canonical_consumer.py`。
- 测试文件/nodeid：`tests/integration/test_datarecorder_runtime_config_e2e.py::test_add_pause_resume_delete_apply_at_consume_boundary`。
- 初始状态：active为MHImain；Recorder启动时没有bar/tick配置。
- 生产入口：真实Recorder UI facade到Recorder subprocess control Queue。
- 操作：添加5m；让A进入buffer；pause；发送B；resume；发送C；删除5m；发送D。
- 直接断言：A和C落库，B和D不落库；配置JSON与UI一致；已经buffer的A未被pause清除；DataService始终继续产生全部canonical completed。
- PASS：DataService收到Recorder config命令次数为0，非active实时订阅增加数为0。
- FAIL：使用config version/两阶段commit、pause停止GDS或删除后回滚buffer。
- 命令：`python -m pytest -q tests/integration/test_datarecorder_runtime_config_e2e.py::test_add_pause_resume_delete_apply_at_consume_boundary`。
- 证据：`.artifacts/goal/dataservice-cold-hot-legacy-chain/ac-14/config-timeline.json`。
- BLOCKED：Recorder配置文件无法隔离时返回`blocked_by_environment:recorder_config_isolation`。
- 清理：停止Recorder/DataService，恢复隔离配置，删除checkpoint/DB并unlink log/ring。

### AC-15：Recorder保持1m/Tick批量和高周期立即写

#### AC-15-S01：同rollover多周期单batch与旧持久化节奏

- 对应修复：FIX-14。
- 对应工作包：WORK-06、WORK-10、WORK-11。
- 精确产品路径：`vnpy/trader/dataservice/completed_bar_log.py`；`vnpy_datarecorder/vnpy_datarecorder/canonical_consumer.py`；`vnpy_sqlite/vnpy_sqlite/sqlite_database.py`。
- 测试文件/nodeid：`tests/integration/test_datarecorder_persistence_cadence_e2e.py::test_rollover_batch_preserves_persistence_cadence`。
- 初始状态：Recorder配置active Tick、1m、5m、1h、4h。
- 生产入口：TickDatabus、bounded `CompletedBarLog`、completed wake Queue、batch ACK Queue、`self.ticks/self.bars`、进程内Queue、SQLite writer。
- 操作：回放一个同时完成1m、5m和1h的canonical rollover；随后在另一batch的高周期立即写期间持有真实SQLite写锁后释放。
- 直接断言：首个rollover只有一个`CompletedRolloverBatch`和一个`batch_sequence`；1m进入timer buffer；5m/1h通过一次`save_bar_data(list, stream=False)`和一个`db.atomic()`提交；全部durable后只有一个checkpoint和ACK；锁定失败项进入timer batch并最终成功；current从不写入。
- PASS：日志、统计、DB rows、selected/skipped、persistence group、durable状态、checkpoint和ACK逐项对应真实操作。
- FAIL：每bar独立sequence/ACK、逐Tick DB调用、所有周期统一timer批量、同rollover多个高周期开启多个SQLite事务、立即失败后丢bar或没有可见Recorder日志。
- 命令：`python -m pytest -q tests/integration/test_datarecorder_persistence_cadence_e2e.py::test_rollover_batch_preserves_persistence_cadence`。
- 证据：`.artifacts/goal/dataservice-cold-hot-legacy-chain/ac-15/recorder-cadence.json`。
- BLOCKED：隔离SQLite无法获取可控真实写锁时返回`blocked_by_environment:sqlite_lock_control`。
- 清理：释放写锁，flush并停止Recorder，关闭SQLite并unlink CompletedBarLog/TickDatabus。

### AC-16：completed at-least-once三个崩溃窗口

#### AC-16-S01：commit前崩溃与幂等重放

- 对应修复：FIX-07、FIX-14。
- 对应工作包：WORK-06、WORK-11。
- 精确产品路径：`vnpy_datarecorder/vnpy_datarecorder/canonical_consumer.py`；`vnpy_datarecorder/vnpy_datarecorder/persistence_protocol.py`。
- 测试文件/nodeid：`tests/integration/test_datarecorder_delivery_recovery_e2e.py::test_crash_before_commit_replays_same_batch`。
- 初始状态：真实DataService和Recorder，隔离SQLite，只启用默认关闭的`before_db_commit` barrier。
- 生产入口：`CompletedRolloverBatch` log→Recorder→SQLite→checkpoint→ACK。
- 操作：batch到达barrier后终止Recorder，确认DB和checkpoint未推进，再重启消费同一batch。
- 直接断言：重放后插入全部selected identities；最终每identity一行、字段一致、selected/skipped决定不变、batch checkpoint连续、一个ACK。
- PASS：checkpoint未越过未commit batch，重启后无sequence hole。
- FAIL：崩溃前checkpoint推进、重复行、重放冲突被覆盖或使用mock数据库。
- 命令：`python -m pytest -q tests/integration/test_datarecorder_delivery_recovery_e2e.py::test_crash_before_commit_replays_same_batch`。
- 证据：`.artifacts/goal/dataservice-cold-hot-legacy-chain/ac-16/crash-windows.json`。
- BLOCKED：默认关闭barrier无法通过进程启动参数启用时判FAIL，不得改用sleep或mock。
- 清理：释放barrier，停止Recorder/DataService，删除隔离DB/checkpoint并unlink log/ring。

### AC-17：CTA策略回调名称、顺序和数量无回退

#### AC-17-S01：CTA私有BarGenerator回调无双发

- 对应修复：FIX-16。
- 对应工作包：WORK-12。
- 精确产品路径：`vnpy_ctastrategy/vnpy_ctastrategy/engine.py`；`vnpy_ctastrategy/vnpy_ctastrategy/serial_dispatcher.py`。
- 测试文件/nodeid：`tests/integration/test_dataservice_cta_callback_e2e.py::test_cta_private_bar_generator_callbacks_match_baseline`。
- 初始状态：启动真实CTA子进程和最小策略，策略内部使用真实BarGenerator。
- 生产入口：TickDatabusReader→CtaEngine→SerialStrategyDispatcher。
- 操作：回放未overrun Tick并跨1m和策略window边界。
- 直接断言：`on_tick`数量和顺序等于raw input；`on_bar/on_window_bar`只由策略私有BarGenerator调用；stop order检查顺序与822 characterization一致。
- PASS：DataService shared completed直接调用策略bar callback次数为0。
- FAIL：回调漏发、双发、线程所有权变化或用canonical bar替代策略私有生成。
- 命令：`python -m pytest -q tests/integration/test_dataservice_cta_callback_e2e.py::test_cta_private_bar_generator_callbacks_match_baseline`。
- 证据：`.artifacts/goal/dataservice-cold-hot-legacy-chain/ac-17/cta-callback-trace.json`。
- BLOCKED：CTA child无法以Windows spawn启动时返回`blocked_by_environment:cta_spawn`。
- 清理：停止CTA/DataService，关闭策略与cursor并unlink TickDatabus。

### AC-18：EVENT_TICK、Oms和手工交易最新价恢复

#### AC-18-S01：compatibility bridge到Oms及交易交互

- 对应修复：FIX-16。
- 对应工作包：WORK-12。
- 精确产品路径：`vnpy/trader/subprocess_event_bridge.py`；`vnpy/trader/engine.py`；`vnpy/trader/ui/widget_trading.py`。
- 测试文件/nodeid：`tests/integration/test_dataservice_eventengine_compatibility_e2e.py::test_event_tick_updates_oms_and_manual_trading`。
- 初始状态：主进程EventEngine、OmsEngine、TradingWidget和第三方probe handler已注册。
- 生产入口：TickDatabus compatibility bridge。
- 操作：回放不同价格和盘口Tick，调用对手价、超价、市价和图表交易交互读取。
- 直接断言：标准和symbol-specific事件各按旧约定到达；Oms latest为最后Tick；所有价格功能读取同一值；主进程K线聚合/指标/DB调用为0。
- PASS：不依赖100ms UI轮询也能读取最新Tick。
- FAIL：MainEngine.get_tick为空/过期、第三方handler无事件或主进程恢复重计算。
- 命令：`$env:QT_QPA_PLATFORM='offscreen'; python -m pytest -q tests/integration/test_dataservice_eventengine_compatibility_e2e.py::test_event_tick_updates_oms_and_manual_trading`。
- 证据：`.artifacts/goal/dataservice-cold-hot-legacy-chain/ac-18/eventengine-trace.json`。
- BLOCKED：Qt offscreen或EventEngine线程无法启动时返回`blocked_by_environment:qt_eventengine`。
- 清理：注销probe handlers，关闭widget/EventEngine/DataService并unlink TickDatabus。

### AC-19：FUTU追价由Tick快速唤醒

#### AC-19-S01：execution quote即时唤醒追价

- 对应修复：FIX-15、FIX-16。
- 对应工作包：WORK-03、WORK-12。
- 精确产品路径：`vnpy/trader/execution_quote.py`；`vnpy_futu/vnpy_futu/futu_gateway.py`。
- 测试文件/nodeid：`tests/integration/test_futu_chase_execution_quote_e2e.py::test_tick_wakes_replace_path_with_actual_symbol`。
- 初始状态：隔离order sink中存在REPLACE状态订单，canonical/actual mapping有效。
- 生产入口：execution quote consumer→FutuGateway等价`_try_replace_on_tick`路径。
- 操作：回放匹配symbol的新Tick。
- 直接断言：不等待timer即调用一次replace decision；FUTU API参数使用actual symbol；EventEngine事件保持canonical symbol；取消回报路径不是唯一触发源。
- PASS：同一Tick不造成重复replace，旧actual Tick被拒绝。
- FAIL：等待下一轮timer、使用canonical调用供应商API或DataService直接执行交易。
- 命令：`python -m pytest -q tests/integration/test_futu_chase_execution_quote_e2e.py::test_tick_wakes_replace_path_with_actual_symbol`。
- 证据：`.artifacts/goal/dataservice-cold-hot-legacy-chain/ac-19/chase-trace.json`。
- BLOCKED：隔离order sink不支持REPLACE状态时返回`blocked_by_environment:order_sink_contract`。
- 清理：停止execution quote consumer/DataService并关闭order sink，不连接真实交易API。

### AC-20：Trigger在子进程逐Tick判断并可靠提交同一intent

#### AC-20-S01：触发Tick立即形成唯一intent

- 对应修复：FIX-16。
- 对应工作包：WORK-13。
- 精确产品路径：`vnpy/trader/trigger_service/runtime.py`；`vnpy/trader/order_execution_gate.py`。
- 测试文件/nodeid：`tests/integration/test_trigger_candidate_execution_e2e.py::test_trigger_tick_submits_one_stable_intent`。
- 初始状态：Trigger子进程加载一条止损规则，主进程OrderExecutionGate使用隔离order sink。
- 生产入口：Trigger TickDatabus cursor→candidate Queue→blocking bridge→OrderExecutionGate。
- 操作：回放穿越触发价的Tick；主场景保持ACK畅通。
- 直接断言：candidate产生于触发Tick处理；提交不等待EVENT_TIMER；identity为`(service_generation, active_generation, candidate_id)`；sink最终只有一次intent。
- PASS：ACK后pending清除，Trigger继续处理新Tick。
- FAIL：一秒timer轮询提交、identity包含attempt、重复intent或Trigger直接下单。
- 命令：`python -m pytest -q tests/integration/test_trigger_candidate_execution_e2e.py::test_trigger_tick_submits_one_stable_intent`。
- 证据：`.artifacts/goal/dataservice-cold-hot-legacy-chain/ac-20/trigger-trace.json`。
- BLOCKED：Trigger child或隔离order sink无法启动时返回`blocked_by_environment:trigger_runtime`。
- 清理：停止Trigger/bridge/Gate，关闭order sink并unlink TickDatabus。

### AC-21：单active和Recorder dormant配置

#### AC-21-S01：正常logical active切换

- 对应修复：FIX-10、FIX-12、FIX-15。
- 对应工作包：WORK-03、WORK-05、WORK-11。
- 精确产品路径：`vnpy/trader/runtime_supervisor.py`；`vnpy/trader/dataservice/runtime.py`；`vnpy_datarecorder/vnpy_datarecorder/canonical_consumer.py`。
- 测试文件/nodeid：`tests/integration/test_dataservice_active_symbol_e2e.py::test_logical_active_switch_seals_and_fences_old_stream`。
- 初始状态：查询合约持久化选择MHImain；Recorder另存两个非active合约配置。
- 生产入口：主进程active command→RuntimeSupervisor→DataService。
- 操作：启动、查询非active历史、打开不同interval、再由用户切换active；记录旧`stream_key`和final batch sequence。
- 直接断言：切换前实时TickDatabus/canonical store/FUTU可写symbol均为1；历史query不激活；目标DB先补齐；subscribe new成功后旧stream收到`STREAM_SEAL(final_batch_sequence)`；新active generation递增；old batch可drain但old ACK不推进new checkpoint；非active实时写库为0。
- PASS：active设置只来自用户选择或主进程默认发送，最终只有新stream可写并收到一次`ACTIVE_ACK(new_stream_key)`。
- FAIL：Supervisor/DataService自选、补缺失败仍切换、Recorder配置创建stream、旧消息污染新stream或同时两个canonical stream可写。
- 命令：`python -m pytest -q tests/integration/test_dataservice_active_symbol_e2e.py::test_logical_active_switch_seals_and_fences_old_stream`。
- 证据：`.artifacts/goal/dataservice-cold-hot-legacy-chain/ac-21/active-timeline.json`。
- BLOCKED：第二logical symbol fixture缺失时返回`blocked_by_contract_ambiguity:performance_dataset`。
- 清理：drain/seal测试stream，停止进程，取消订阅并删除隔离DB/SHM/checkpoint。

### AC-22：主连actual换月不改变canonical数据流

#### AC-22-S01：actual自动换月的串行mapping边界

- 对应修复：FIX-15。
- 对应工作包：WORK-03、WORK-04、WORK-12。
- 精确产品路径：`vnpy/trader/dataservice/futu_metadata.py`；`vnpy/trader/dataservice/runtime.py`；`vnpy_futu/vnpy_futu/futu_gateway.py`。
- 测试文件/nodeid：`tests/integration/test_dataservice_main_contract_mapping_e2e.py::test_actual_rollover_keeps_canonical_stream_identity`。
- 初始状态：active logical为MHImain，actual初始MHI2609。
- 生产入口：旧main_contract_mapping解析和FUTU callback ingress。
- 操作：切换到MHI2610，随后发送一笔旧actual迟到callback和一笔新actualcallback。
- 直接断言：canonical identity始终MHImain；`stream_key`不变；执行顺序为subscribe new成功、切mapping和callback acceptance、发布一次旧事件、unsubscribe old；旧callback不更新，新callback更新。
- PASS：FUTU execution使用MHI2610，DB/GDS/Recorder/指标仍用MHImain。
- FAIL：新增mapping version影响业务、canonical历史分裂或切换事件重复。
- 命令：`python -m pytest -q tests/integration/test_dataservice_main_contract_mapping_e2e.py::test_actual_rollover_keeps_canonical_stream_identity`。
- 证据：`.artifacts/goal/dataservice-cold-hot-legacy-chain/ac-22/mapping-trace.json`。
- BLOCKED：真实mapping分支或actual换月fixture未冻结时返回`blocked_by_contract_ambiguity:main_contract_mapping_fixture`。
- 清理：取消old/new actual订阅，停止进程并unlink canonical SHM。

### AC-23：稳定GDS、多消费者共享和无query重试风暴

#### AC-23-S01：稳定allocation、共享descriptor和范围差集

- 对应修复：FIX-04、FIX-11、FIX-16、FIX-17。
- 对应工作包：WORK-05、WORK-07、WORK-08、WORK-14。
- 精确产品路径：`vnpy/trader/dataservice/query_runtime.py`；`vnpy/trader/dataservice/gds_snapshot.py`；`vnpy/datafeed/indicator_runtime_client.py`。
- 测试文件/nodeid：`tests/integration/test_dataservice_stable_gds_query_e2e.py::test_stable_gds_shared_descriptor_and_no_retry_storm`。
- 初始状态：一个active、三个指标、单周期和多周期两个图表，另准备一个相同request、一个相交request和一个可取消request。
- 生产入口：chart query runtime、stable GDS和Indicator Worker attach。
- 操作：首次加载；连续回放一万Tick；执行drag/zoom/paint；再扩展历史范围。
- 直接断言：容量未超时shm_name不变；五个消费者共享descriptor；每Tickallocation/full snapshot/全DB读取为0；drag/zoom不发新canonical query；相同request只fetch一次；相交request只读cold差集；取消后的迟到response不替换GDS并立即release临时SHM。
- PASS：相同精确in-flight request只执行一次，所有caller收到一个终态。
- FAIL：per-query snapshot/lease、250ms重试、指标数倍增DB读取或普通query重启进程。
- 命令：`python -m pytest -q tests/integration/test_dataservice_stable_gds_query_e2e.py::test_stable_gds_shared_descriptor_and_no_retry_storm`。
- 证据：`.artifacts/goal/dataservice-cold-hot-legacy-chain/ac-23/gds-query-counters.json`。
- BLOCKED：不能读取真实allocation/query/DB计数器时返回`blocked_by_environment:runtime_counters`。
- 清理：取消pending query，release临时SHM，关闭消费者/DataService并删除隔离DB/cache。

### AC-24：最小化恢复和DataService重启恢复

#### AC-24-S01：最小化期间持续聚合与恢复attach

- 对应修复：FIX-02、FIX-09、FIX-11。
- 对应工作包：WORK-07、WORK-09、WORK-14。
- 精确产品路径：`vnpy/trader/dataservice/chart_session.py`；`vnpy/chart/multi_timeframe_widget.py`；`vnpy/trader/runtime_supervisor.py`。
- 测试文件/nodeid：`tests/integration/test_dataservice_resume_recovery_e2e.py::test_minimize_keeps_aggregation_and_resume_only_reattaches`。
- 初始状态：图表已加载，DataService持续收Tick。
- 生产入口：Qt窗口生命周期、stable GDS reattach、DataManager coverage。
- 操作：最小化期间继续回放并跨越两个5m rollover；恢复窗口。
- 直接断言：最小化不停止聚合；普通恢复只attach当前GDS不查DB；图表直接看到期间completed和最新current；current不重复累计。
- PASS：图表恢复后历史和current连续，DataService/Worker/Recorder/CTA/Trigger PID均未因最小化变化。
- FAIL：最小化停止行情、恢复全量重查、用K_1M seed、遗漏期间rollover或重启进程。
- 命令：`$env:QT_QPA_PLATFORM='offscreen'; python -m pytest -q tests/integration/test_dataservice_resume_recovery_e2e.py::test_minimize_keeps_aggregation_and_resume_only_reattaches`。
- 证据：`.artifacts/goal/dataservice-cold-hot-legacy-chain/ac-24/recovery-timeline.json`。
- BLOCKED：Qt offscreen窗口状态无法驱动时返回`blocked_by_environment:qt_offscreen`。
- 清理：恢复窗口后关闭widget/Worker和全部child，unlink SHM并删除隔离DB/LMDB。

### 10.2 主场景到实施和证据的精确映射

下表补齐上述24个`S01`场景的Task、产品路径和pytest nodeid。测试文件固定为新增目标路径；产品路径必须在Goal合同生成前再次验证存在。

| 场景ID | Goal Task | 精确产品文件 | pytest nodeid | artifact |
|---|---|---|---|---|
| AC-01-S01 | WORK-05、WORK-07 | `vnpy/trader/dataservice/runtime.py`；`vnpy/trader/dataservice/query_runtime.py` | `tests/integration/test_dataservice_cold_hot_effective_series_e2e.py::test_cold_completed_and_current_last` | `ac-01/series.json` |
| AC-02-S01 | WORK-06、WORK-07、WORK-11 | `vnpy/trader/dataservice/runtime.py`；`vnpy_datarecorder/vnpy_datarecorder/canonical_consumer.py` | `tests/integration/test_dataservice_cold_hot_effective_series_e2e.py::test_recorder_commit_does_not_change_effective_series` | `ac-02/timeline.json` |
| AC-03-S01 | WORK-05、WORK-06、WORK-07 | `vnpy/trader/dataservice/query_runtime.py`；`vnpy_datamanager/vnpy_datamanager/engine.py` | `tests/integration/test_dataservice_datamanager_repair_e2e.py::test_conflict_uses_db_then_rebuilds_from_repaired_1m` | `ac-03/repair-trace.json` |
| AC-04-S01 | WORK-05、WORK-07 | `vnpy_datamanager/vnpy_datamanager/engine.py`；`vnpy/trader/dataservice/query_runtime.py` | `tests/integration/test_dataservice_datamanager_repair_e2e.py::test_middle_four_hour_gap_is_filled_before_publish` | `ac-04/coverage.json` |
| AC-05-S01 | WORK-05、WORK-07 | `vnpy/trader/dataservice/recovery.py`；`vnpy/trader/dataservice/query_runtime.py` | `tests/integration/test_dataservice_datamanager_repair_e2e.py::test_failed_repair_keeps_unaffected_series_live` | `ac-05/live-during-repair.json` |
| AC-06-S01 | WORK-04、WORK-07、WORK-09 | `vnpy/trader/dataservice/canonical_bars.py`；`vnpy/chart/multi_timeframe_widget.py` | `tests/integration/test_dataservice_period_open_e2e.py::test_v2_mid_period_4h_open_comes_from_2100_minute` | `ac-06/4h-open.json` |
| AC-07-S01 | WORK-04、WORK-09 | `vnpy/trader/period_utils.py`；`vnpy/chart/multi_timeframe_widget.py` | `tests/integration/test_dataservice_period_open_e2e.py::test_v1_v2_daily_and_4h_open_matrix` | `ac-07/session-open-matrix.json` |
| AC-08-S01 | WORK-05、WORK-07、WORK-09 | `vnpy_datamanager/vnpy_datamanager/engine.py`；`vnpy/trader/dataservice/canonical_bars.py` | `tests/integration/test_dataservice_period_open_e2e.py::test_missing_period_start_is_repaired_without_later_minute_fallback` | `ac-08/missing-open.json` |
| AC-09-S01 | WORK-03、WORK-04 | `vnpy/trader/dataservice/quote_state.py`；`vnpy/trader/dataservice/runtime.py` | `tests/integration/test_dataservice_quote_orderbook_ingress_e2e.py::test_quote_orderbook_preserve_tick_and_volume_semantics` | `ac-09/tick-aggregation.json` |
| AC-10-S01 | WORK-04、WORK-12 | `vnpy/trader/dataservice/throttle.py`；`vnpy/datafeed/tick_databus.py` | `tests/integration/test_dataservice_tick_continuity_e2e.py::test_throttle_late_tick_and_overrun_are_distinct` | `ac-10/continuity.json` |
| AC-11-S01 | WORK-08、WORK-09 | `vnpy/datafeed/indicator_engine.py`；`vnpy/chart/indicator_drawing_manager.py` | `tests/integration/test_dataservice_indicator_lmdb_qt_e2e.py::test_5m_boll_current_rollover_and_plot` | `ac-11/boll-values.npz` |
| AC-12-S01 | WORK-08、WORK-09 | `vnpy/datafeed/indicator_worker.py`；`indicators/indicator_registry.py` | `tests/integration/test_dataservice_all_indicators_e2e.py::test_all_registered_indicators_use_legacy_chain` | `ac-12/indicator-manifest.json` |
| AC-13-S01 | WORK-08、WORK-09 | `vnpy/datafeed/indicator_storage.py`；`vnpy/datafeed/index_range_builder.py`；`vnpy/chart/indicator_drawing_manager.py` | `tests/integration/test_dataservice_indicator_lmdb_qt_e2e.py::test_lmdb_u0_u1_mapping_reaches_real_plot_item` | `ac-13/lmdb-map-plot.json` |
| AC-14-S01 | WORK-10、WORK-11 | `vnpy_datarecorder/vnpy_datarecorder/engine.py`；`vnpy_datarecorder/vnpy_datarecorder/canonical_consumer.py` | `tests/integration/test_datarecorder_runtime_config_e2e.py::test_add_pause_resume_delete_apply_at_consume_boundary` | `ac-14/config-timeline.json` |
| AC-15-S01 | WORK-06、WORK-10、WORK-11 | `vnpy/trader/dataservice/completed_bar_log.py`；`vnpy_datarecorder/vnpy_datarecorder/canonical_consumer.py`；`vnpy_sqlite/vnpy_sqlite/sqlite_database.py` | `tests/integration/test_datarecorder_persistence_cadence_e2e.py::test_rollover_batch_preserves_persistence_cadence` | `ac-15/recorder-cadence.json` |
| AC-16-S01 | WORK-06、WORK-11 | `vnpy_datarecorder/vnpy_datarecorder/canonical_consumer.py`；`vnpy_datarecorder/vnpy_datarecorder/persistence_protocol.py` | `tests/integration/test_datarecorder_delivery_recovery_e2e.py::test_crash_before_commit_replays_same_batch` | `ac-16/crash-windows.json` |
| AC-17-S01 | WORK-12 | `vnpy_ctastrategy/vnpy_ctastrategy/engine.py`；`vnpy_ctastrategy/vnpy_ctastrategy/serial_dispatcher.py` | `tests/integration/test_dataservice_cta_callback_e2e.py::test_cta_private_bar_generator_callbacks_match_baseline` | `ac-17/cta-callback-trace.json` |
| AC-18-S01 | WORK-12 | `vnpy/trader/subprocess_event_bridge.py`；`vnpy/trader/engine.py`；`vnpy/trader/ui/widget_trading.py` | `tests/integration/test_dataservice_eventengine_compatibility_e2e.py::test_event_tick_updates_oms_and_manual_trading` | `ac-18/eventengine-trace.json` |
| AC-19-S01 | WORK-03、WORK-12 | `vnpy/trader/execution_quote.py`；`vnpy_futu/vnpy_futu/futu_gateway.py` | `tests/integration/test_futu_chase_execution_quote_e2e.py::test_tick_wakes_replace_path_with_actual_symbol` | `ac-19/chase-trace.json` |
| AC-20-S01 | WORK-13 | `vnpy/trader/trigger_service/runtime.py`；`vnpy/trader/order_execution_gate.py` | `tests/integration/test_trigger_candidate_execution_e2e.py::test_trigger_tick_submits_one_stable_intent` | `ac-20/trigger-trace.json` |
| AC-21-S01 | WORK-03、WORK-05、WORK-11 | `vnpy/trader/runtime_supervisor.py`；`vnpy/trader/dataservice/runtime.py`；`vnpy_datarecorder/vnpy_datarecorder/canonical_consumer.py` | `tests/integration/test_dataservice_active_symbol_e2e.py::test_logical_active_switch_seals_and_fences_old_stream` | `ac-21/active-timeline.json` |
| AC-22-S01 | WORK-03、WORK-04、WORK-12 | `vnpy/trader/dataservice/futu_metadata.py`；`vnpy/trader/dataservice/runtime.py`；`vnpy_futu/vnpy_futu/futu_gateway.py` | `tests/integration/test_dataservice_main_contract_mapping_e2e.py::test_actual_rollover_keeps_canonical_stream_identity` | `ac-22/mapping-trace.json` |
| AC-23-S01 | WORK-05、WORK-07、WORK-08、WORK-14 | `vnpy/trader/dataservice/query_runtime.py`；`vnpy/trader/dataservice/gds_snapshot.py`；`vnpy/datafeed/indicator_runtime_client.py` | `tests/integration/test_dataservice_stable_gds_query_e2e.py::test_stable_gds_shared_descriptor_and_no_retry_storm` | `ac-23/gds-query-counters.json` |
| AC-24-S01 | WORK-07、WORK-09、WORK-14 | `vnpy/trader/dataservice/chart_session.py`；`vnpy/chart/multi_timeframe_widget.py`；`vnpy/trader/runtime_supervisor.py` | `tests/integration/test_dataservice_resume_recovery_e2e.py::test_minimize_keeps_aggregation_and_resume_only_reattaches` | `ac-24/recovery-timeline.json` |

### 10.3 第三轮新增独立场景

#### AC-09-S02：启动缓存Tick只对逐Tick消费者发布一次

- 对应工作包：WORK-04、WORK-12。
- 精确产品路径：`vnpy/trader/dataservice/runtime.py`、`vnpy/datafeed/tick_databus.py`、`vnpy/trader/subprocess_event_bridge.py`。
- 测试文件/nodeid：`tests/integration/test_dataservice_quote_orderbook_ingress_e2e.py::test_startup_replay_publishes_tick_once`。
- 初始状态：DataService已订阅但cold baseline尚未完成，CTA、Trigger、Recorder Tick、compatibility bridge和execution quote五个cursor已附着。
- 生产入口：DataService provider callback→single ingress dispatcher→TickDatabus publish→startup replay buffer→canonical aggregator。
- 操作：在cold load期间回放固定event IDs；完成cold后触发内部replay。
- 直接断言：每个外部cursor对每个event ID只读到一次；canonical聚合器应用一次；EVENT_TICK、CTA on_tick、Trigger评估、Tick持久化和追价唤醒均不重复。
- PASS：外部投递计数等于fixture事件数，聚合结果与单次输入一致。
- FAIL：内部replay再次写TickDatabus、任一消费者双发或聚合volume重复。
- BLOCKED：fixture缺少启动窗口event IDs时返回`blocked_by_contract_ambiguity:performance_dataset`。
- 命令：`python -m pytest -q tests/integration/test_dataservice_quote_orderbook_ingress_e2e.py::test_startup_replay_publishes_tick_once`。
- 证据：`.artifacts/goal/dataservice-cold-hot-legacy-chain/ac-09-s02/delivery-counts.json`。
- 清理：停止全部child PID，关闭五个cursor，unlink测试TickDatabus/GDS，删除隔离DB和LMDB。

#### AC-13-S02：coverage segment跨缺口时PlotDataItem必须断线

- 对应工作包：WORK-05、WORK-07、WORK-08、WORK-09。
- 精确产品路径：`vnpy/trader/dataservice/query_runtime.py`、`vnpy/datafeed/index_range_builder.py`、`vnpy/chart/indicator_drawing_manager.py`。
- 测试文件/nodeid：`tests/integration/test_dataservice_indicator_lmdb_qt_e2e.py::test_coverage_segments_break_plot_without_fake_bars`。
- 初始状态：隔离DB在两个连续segment之间保留一个未修复expected 1m缺口，LMDB为空。
- 生产入口：DataManager missing_ranges→stable GDS coverage_segments→legacy adapter→LMDB→Qt MultiTimeframeWidget→PlotDataItem。
- 操作：构建descriptor、运行生产指标链、读取LMDB并绘制真实PlotDataItem。
- 直接断言：`coverage_segments`为两段；bar数组和指标close数组中没有占位bar；`index_ranges`不跨缺口；PlotDataItem在边界断线且两侧数值与LMDB一致。
- PASS：用户看到缺口而非跨缺口连线或伪造K线，其他segment仍显示。
- FAIL：插入OHLCV占位、指标计算跨缺口、LMDB保存绘图断线值或PlotDataItem跨段连线。
- BLOCKED：Qt offscreen或真实LMDB不可启动时返回`blocked_by_environment:qt_or_lmdb`。
- 命令：`$env:QT_QPA_PLATFORM='offscreen'; python -m pytest -q tests/integration/test_dataservice_indicator_lmdb_qt_e2e.py::test_coverage_segments_break_plot_without_fake_bars`。
- 证据：`.artifacts/goal/dataservice-cold-hot-legacy-chain/ac-13-s02/segments-map-plot.json`。
- 清理：关闭Qt widget和Worker，关闭LMDB，unlink SHM，删除隔离SQLite和临时目录。

#### AC-16-S02：commit后checkpoint前崩溃重放

- 对应工作包：WORK-06、WORK-11。
- 精确产品路径：`vnpy_datarecorder/vnpy_datarecorder/canonical_consumer.py`、`vnpy_datarecorder/vnpy_datarecorder/persistence_protocol.py`、`vnpy_sqlite/vnpy_sqlite/sqlite_database.py`。
- 测试文件/nodeid：`tests/integration/test_datarecorder_delivery_recovery_e2e.py::test_crash_after_commit_before_checkpoint_replays_identically`。
- 初始状态：只启用`after_db_commit_before_checkpoint` barrier，同batch含1m/5m/1h selected bars。
- 生产入口：CompletedBarLog reader→Recorder batch consumer→SQLite `save_bar_data(list)`→checkpoint writer→ACK Queue。
- 操作：DB commit后终止Recorder，确认checkpoint仍指向前一batch，再重启。
- 直接断言：重放对已写identity返回IDENTICAL，不覆盖OHLCV；原selected/skipped集合不变；最终一个batch checkpoint和一个ACK。
- PASS：DB每identity一行且事务字段完全相同。
- FAIL：重复插入、replace覆盖、按重启后配置重新过滤或checkpoint跳过batch。
- BLOCKED：三个barrier之外需要monkeypatch数据库才能命中窗口时判FAIL，不得标记环境阻塞。
- 命令：`python -m pytest -q tests/integration/test_datarecorder_delivery_recovery_e2e.py::test_crash_after_commit_before_checkpoint_replays_identically`。
- 证据：`.artifacts/goal/dataservice-cold-hot-legacy-chain/ac-16-s02/db-checkpoint-timeline.json`。
- 清理：释放barrier，终止重启后的Recorder，关闭SQLite，删除checkpoint和测试SHM。

#### AC-16-S03：checkpoint后ACK前崩溃补ACK

- 对应工作包：WORK-06、WORK-11。
- 精确产品路径：`vnpy_datarecorder/vnpy_datarecorder/canonical_consumer.py`、`vnpy_datarecorder/vnpy_datarecorder/persistence_protocol.py`。
- 测试文件/nodeid：`tests/integration/test_datarecorder_delivery_recovery_e2e.py::test_crash_after_checkpoint_before_ack_resends_ack`。
- 初始状态：只启用`after_checkpoint_before_ack` barrier。
- 生产入口：CompletedBarLog reader→Recorder checkpoint recovery→batch ACK Queue→DataService pending batch state。
- 操作：checkpoint落盘后终止Recorder并重启，使producer仍保留同batch。
- 直接断言：Recorder识别checkpoint已完成，不重复开启写事务，只补发相同`(stream_key,batch_sequence)` ACK。
- PASS：DB不变、checkpoint不回退、producer释放该batch等待状态。
- FAIL：再次写库、生成新sequence、ACK错误stream或等待永久挂起。
- BLOCKED：无法读取真实checkpoint文件时返回`blocked_by_environment:checkpoint_storage`。
- 命令：`python -m pytest -q tests/integration/test_datarecorder_delivery_recovery_e2e.py::test_crash_after_checkpoint_before_ack_resends_ack`。
- 证据：`.artifacts/goal/dataservice-cold-hot-legacy-chain/ac-16-s03/checkpoint-ack-timeline.json`。
- 清理：释放barrier，停止进程，关闭SQLite并删除隔离checkpoint/SHM。

#### AC-16-S04：配置变更不得重新解释未ACK batch

- 对应工作包：WORK-10、WORK-11。
- 精确产品路径：`vnpy_datarecorder/vnpy_datarecorder/canonical_consumer.py`、`vnpy_datarecorder/vnpy_datarecorder/persistence_protocol.py`、`vnpy_datarecorder/vnpy_datarecorder/engine.py`。
- 测试文件/nodeid：`tests/integration/test_datarecorder_delivery_recovery_e2e.py::test_crash_replay_keeps_original_batch_selection`。
- 初始状态：batch首次消费时1m/5m selected、1h skipped，checkpoint已保存决定但batch未ACK。
- 生产入口：Recorder UI control Queue→Recorder local config→CompletedRolloverBatch consumer→checkpoint→SQLite。
- 操作：终止Recorder，修改本地配置为仅1h，再重启重放旧batch并处理下一新batch。
- 直接断言：旧batch仍写1m/5m且跳过1h；新batch按新配置只选1h；envelope无config version，DataService未收到配置命令。
- PASS：配置生效边界是首次消费，崩溃不改变旧决定。
- FAIL：旧batch按新配置重筛、增加两阶段事务或丢失已selected bar。
- BLOCKED：Recorder UI配置文件无法隔离时返回`blocked_by_environment:recorder_config_isolation`。
- 命令：`python -m pytest -q tests/integration/test_datarecorder_delivery_recovery_e2e.py::test_crash_replay_keeps_original_batch_selection`。
- 证据：`.artifacts/goal/dataservice-cold-hot-legacy-chain/ac-16-s04/config-replay.json`。
- 清理：恢复测试配置副本，停止Recorder，删除隔离DB、checkpoint和SHM。

#### AC-20-S02：ACK中断进入DELIVERY_DEGRADED后恢复

- 对应工作包：WORK-13。
- 精确产品路径：`vnpy/trader/trigger_service/runtime.py`、`vnpy/trader/trigger_service/protocol.py`、`vnpy/trader/order_execution_gate.py`。
- 测试文件/nodeid：`tests/integration/test_trigger_candidate_execution_e2e.py::test_missing_ack_enters_delivery_degraded_and_recovers`。
- 初始状态：Trigger已生成一个candidate，真实candidate Queue可写，ACK consumer被明确暂停。
- 生产入口：Trigger pending scheduler→candidate Queue→blocking bridge→OrderExecutionGate→ACK Queue。
- 操作：记录两次500ms快速重试，再跨过1秒降级重试；恢复ACK consumer。
- 直接断言：全部消息identity相同且attempt不在identity中；两次快速重试后状态为DELIVERY_DEGRADED；每秒继续；最终Gate只有一个intent并ACK清除pending。
- PASS：保护不会在三次后永久停止，ACK恢复后状态回到ready。
- FAIL：生成新candidate/intent、通过EVENT_TIMER提交、三次后停止或重复下单。
- BLOCKED：测试时钟无法用真实单调时钟观测时返回`blocked_by_environment:monotonic_clock`；禁止用sleep作为唯一断言。
- 命令：`python -m pytest -q tests/integration/test_trigger_candidate_execution_e2e.py::test_missing_ack_enters_delivery_degraded_and_recovers`。
- 证据：`.artifacts/goal/dataservice-cold-hot-legacy-chain/ac-20-s02/retry-timeline.json`。
- 清理：恢复ACK consumer，停止Trigger和bridge，关闭隔离order sink及TickDatabus。

#### AC-20-S03：Trigger ring overrun后立即重评并恢复保护

- 对应工作包：WORK-12、WORK-13。
- 精确产品路径：`vnpy/trader/trigger_service/runtime.py`、`vnpy/trader/trigger_service/execution_quote_source.py`、`vnpy/datafeed/tick_databus.py`。
- 测试文件/nodeid：`tests/integration/test_trigger_candidate_execution_e2e.py::test_ring_overrun_rechecks_latest_tick_and_recovers`。
- 初始状态：小容量真实TickDatabus、有效LineRuleGraph和position projection，Trigger cursor故意落后。
- 生产入口：TickDatabusReader overrun→Trigger runtime reattach→latest Tick source→LineRuleGraph→recovery ACK。
- 操作：造成真实overrun，保留触发价后的latest Tick，让Trigger attach latest cursor并重评。
- 直接断言：只有overrun到重评完成期间为UNPROTECTED；latest Tick触发同一规则；Trigger发送恢复ACK；DataManager调用为0。
- PASS：恢复后继续逐Tick保护且没有补造历史Tick。
- FAIL：永久UNPROTECTED、调用DataManager、忽略latest Tick或重复intent。
- BLOCKED：无法创建隔离SHM namespace时返回`blocked_by_environment:shared_memory`。
- 命令：`python -m pytest -q tests/integration/test_trigger_candidate_execution_e2e.py::test_ring_overrun_rechecks_latest_tick_and_recovers`。
- 证据：`.artifacts/goal/dataservice-cold-hot-legacy-chain/ac-20-s03/overrun-recovery.json`。
- 清理：停止Trigger/Gate，unlink TickDatabus并关闭order sink。

#### AC-20-S04：actual换月期间pending candidate执行前重验

- 对应工作包：WORK-03、WORK-12、WORK-13。
- 精确产品路径：`vnpy/trader/trigger_service/protocol.py`、`vnpy/trader/order_execution_gate.py`、`vnpy_futu/vnpy_futu/futu_gateway.py`。
- 测试文件/nodeid：`tests/integration/test_trigger_candidate_execution_e2e.py::test_pending_candidate_revalidated_across_actual_rollover`。
- 初始状态：candidate持有旧`OrderIntent.actual_vt_symbol`且尚未执行，logical active不变。
- 生产入口：Trigger candidate Queue→main mapping switch event→OrderExecutionGate validation→隔离order sink。
- 操作：按旧main mapping完成actual换月，再把pending candidate交给Gate。
- 直接断言：Gate重验active generation、current actual、position projection和reduce-only volume；旧actual请求不被直接提交；没有mapping epoch字段。
- PASS：只产生符合当前actual和仓位约束的零或一个订单intent。
- FAIL：向旧actual下单、绕过reduce-only、添加mapping epoch或重复intent。
- BLOCKED：隔离order sink无法表达actual symbol时返回`blocked_by_environment:order_sink_contract`。
- 命令：`python -m pytest -q tests/integration/test_trigger_candidate_execution_e2e.py::test_pending_candidate_revalidated_across_actual_rollover`。
- 证据：`.artifacts/goal/dataservice-cold-hot-legacy-chain/ac-20-s04/intent-revalidation.json`。
- 清理：停止Trigger/Gate，重置隔离mapping fixture并关闭order sink。

#### AC-21-S02：目标历史补齐失败时旧active继续

- 对应工作包：WORK-03、WORK-05。
- 精确产品路径：`vnpy/trader/runtime_supervisor.py`、`vnpy/trader/dataservice/runtime.py`、`vnpy_datamanager/vnpy_datamanager/engine.py`。
- 测试文件/nodeid：`tests/integration/test_dataservice_active_symbol_e2e.py::test_failed_target_coverage_keeps_old_active`。
- 初始状态：旧active正常流动，目标symbol存在缺口且provider返回确定失败。
- 生产入口：查询合约窗口→RuntimeSupervisor active command→DataManager coverage→HistoricalBarRequest/Response→DataService switch state。
- 操作：用户提交切换目标，等待DataManager失败终态并继续回放旧active Tick。
- 直接断言：旧stream未seal、generation不变、旧current继续更新、没有目标subscribe或ACTIVE_ACK，UI收到FAILED。
- PASS：失败切换不造成行情空窗或双active。
- FAIL：先停旧stream、创建半成品新stream、吞掉失败或自动重启DataService。
- BLOCKED：fixture没有第二logical symbol历史窗口时返回`blocked_by_contract_ambiguity:performance_dataset`。
- 命令：`python -m pytest -q tests/integration/test_dataservice_active_symbol_e2e.py::test_failed_target_coverage_keeps_old_active`。
- 证据：`.artifacts/goal/dataservice-cold-hot-legacy-chain/ac-21-s02/failed-switch.json`。
- 清理：停止进程并删除两个symbol的隔离DB/SHM；不修改用户active设置。

#### AC-21-S03：切回同一logical symbol创建新active generation

- 对应工作包：WORK-03、WORK-11、WORK-14。
- 精确产品路径：`vnpy/trader/runtime_supervisor.py`、`vnpy/trader/dataservice/runtime.py`、`vnpy_datarecorder/vnpy_datarecorder/persistence_protocol.py`。
- 测试文件/nodeid：`tests/integration/test_dataservice_active_symbol_e2e.py::test_switch_back_same_symbol_uses_new_active_generation`。
- 初始状态：依次准备logical A、B，保存A旧stream未迟到ACK和一个旧descriptor。
- 生产入口：查询合约窗口→RuntimeSupervisor→DataManager coverage→DataService stream seal/create→Recorder/GDS fence。
- 操作：A切B并drain，再由用户切回A，随后注入A旧ACK/descriptor。
- 直接断言：三次stream key不同且service generation相同；切回A的active generation继续递增；旧A消息全部被fence，不推进新A checkpoint或GDS。
- PASS：logical symbol相同不会复用旧生命周期。
- FAIL：只按symbol匹配、旧ACK释放新batch或旧descriptor替换新GDS。
- BLOCKED：无法获取两个隔离logical fixture时返回`blocked_by_contract_ambiguity:performance_dataset`。
- 命令：`python -m pytest -q tests/integration/test_dataservice_active_symbol_e2e.py::test_switch_back_same_symbol_uses_new_active_generation`。
- 证据：`.artifacts/goal/dataservice-cold-hot-legacy-chain/ac-21-s03/generation-fence.json`。
- 清理：drain并停止三个stream的消费者，unlink所有测试SHM，删除隔离DB/checkpoint。

#### AC-22-S02：actual切换边界callback严格串行

- 对应工作包：WORK-03、WORK-04。
- 精确产品路径：`vnpy/trader/dataservice/runtime.py`、`vnpy/trader/dataservice/quote_state.py`、`vnpy/trader/dataservice/futu_metadata.py`。
- 测试文件/nodeid：`tests/integration/test_dataservice_main_contract_mapping_e2e.py::test_actual_callbacks_are_fenced_by_dispatcher_switch_order`。
- 初始状态：old actual已订阅，new actual可订阅，fixture在subscribe success、mapping switch、unsubscribe old三个边界各有callback。
- 生产入口：main contract mapping command和FUTU callbacks→DataService single ingress dispatcher→canonical Tick/current。
- 操作：所有callback和mapping命令进入同一ingress dispatcher队列并按event ID执行。
- 直接断言：切换前只接old；原子切换后只接new；旧callback被计数拒绝；切换事件一次；stream key不变。
- PASS：canonical current没有并发写或actual混合。
- FAIL：两个线程直接改mapping、先unsubscribe造成空窗、subscribe失败仍切换或旧callback污染。
- BLOCKED：fixture缺少边界event IDs时返回`blocked_by_contract_ambiguity:performance_dataset`。
- 命令：`python -m pytest -q tests/integration/test_dataservice_main_contract_mapping_e2e.py::test_actual_callbacks_are_fenced_by_dispatcher_switch_order`。
- 证据：`.artifacts/goal/dataservice-cold-hot-legacy-chain/ac-22-s02/dispatcher-order.json`。
- 清理：停止DataService，取消隔离provider订阅并unlink SHM。

#### AC-23-S02：相同request合并，不同相交range只用cache差集

- 对应工作包：WORK-05、WORK-07、WORK-14。
- 精确产品路径：`vnpy/trader/dataservice/query_runtime.py`、`vnpy/trader/dataservice/chart_session.py`、`vnpy/trader/dataservice/bar_query.py`。
- 测试文件/nodeid：`tests/integration/test_dataservice_stable_gds_query_e2e.py::test_identical_requests_coalesce_but_overlap_uses_cache_difference`。
- 初始状态：Cold Range Cache为空，两个完全相同request和一个不同相交range准备就绪。
- 生产入口：chart/indicator request clients→query runtime in-flight registry→HistoricalBarRequest→Cold Range Cache。
- 操作：并发提交相同request，完成后提交相交range。
- 直接断言：相同key只有一次provider fetch且两个caller各收终态；相交range只fetch未覆盖差集；没有overlap DAG或第二query类型。
- PASS：fetch range集合精确等于首次范围加差集。
- FAIL：相同request重复fetch、相交range重读全量或建立通用coalescing状态图。
- BLOCKED：fixture范围无法覆盖相交窗口时返回`blocked_by_contract_ambiguity:performance_dataset`。
- 命令：`python -m pytest -q tests/integration/test_dataservice_stable_gds_query_e2e.py::test_identical_requests_coalesce_but_overlap_uses_cache_difference`。
- 证据：`.artifacts/goal/dataservice-cold-hot-legacy-chain/ac-23-s02/fetch-ranges.json`。
- 清理：取消未完成request，release临时SHM，停止DataService并删除隔离cache/DB。

#### AC-23-S03：取消request的迟到response只释放临时SHM

- 对应工作包：WORK-05、WORK-14。
- 精确产品路径：`vnpy/trader/dataservice/query_runtime.py`、`vnpy/trader/dataservice/query_protocol.py`、`vnpy/trader/dataservice/chart_session.py`。
- 测试文件/nodeid：`tests/integration/test_dataservice_stable_gds_query_e2e.py::test_cancelled_late_response_releases_temporary_shm`。
- 初始状态：已有stable GDS hash H，history request已发出且provider response被明确挂起。
- 生产入口：chart session cancel→query runtime terminal state→迟到HistoricalBarResponse→temporary SHM release。
- 操作：取消request并产生终态，再释放真实response使其迟到。
- 直接断言：校验`session_id/request_id/request_generation/active_contract_generation`失败；GDS仍为H；终态不变；临时SHM被unlink；无tombstone对象。
- PASS：迟到数据不成为新权威且资源计数回到0。
- FAIL：替换GDS、重复终态、泄漏SHM或新增tombstone状态机。
- BLOCKED：无法列举隔离SHM owner资源时返回`blocked_by_environment:shared_memory_introspection`。
- 命令：`python -m pytest -q tests/integration/test_dataservice_stable_gds_query_e2e.py::test_cancelled_late_response_releases_temporary_shm`。
- 证据：`.artifacts/goal/dataservice-cold-hot-legacy-chain/ac-23-s03/late-response-release.json`。
- 清理：release所有response，停止session/DataService，unlink SHM并删除隔离DB。

#### AC-24-S02：DataService崩溃后从DB 1m重建缺失高周期

- 对应工作包：WORK-05、WORK-07、WORK-11、WORK-14。
- 精确产品路径：`vnpy/trader/dataservice/runtime.py`、`vnpy_datamanager/vnpy_datamanager/engine.py`、`vnpy_datarecorder/vnpy_datarecorder/canonical_consumer.py`。
- 测试文件/nodeid：`tests/integration/test_dataservice_resume_recovery_e2e.py::test_dataservice_crash_rebuilds_missing_configured_periods_from_db_1m`。
- 初始状态：Recorder配置1m/5m/1h，DB authoritative 1m完整；旧stream有未ACK 5m/1h batch。
- 生产入口：RuntimeSupervisor process exit→Recorder ABORTED recovery request→DataManager 1m rebuild/write/read-back→new DataService range COMPLETE。
- 操作：强制终止DataService使旧stream ABORTED；重启新generation；Recorder提交恢复请求。
- 直接断言：DataManager从DB 1m重建缺失5m/1h并幂等写库；DataService不补发旧内存batch、不写DB；新range在coverage后发布。
- PASS：高周期DB完整且与1m聚合一致，旧ACK不进入新stream。
- FAIL：Recorder重放Tick聚合、依赖消失内存、DataService写DB或在coverage前发布。
- BLOCKED：隔离DB缺少重建窗口authoritative 1m时返回`blocked_by_contract_ambiguity:performance_dataset`。
- 命令：`python -m pytest -q tests/integration/test_dataservice_resume_recovery_e2e.py::test_dataservice_crash_rebuilds_missing_configured_periods_from_db_1m`。
- 证据：`.artifacts/goal/dataservice-cold-hot-legacy-chain/ac-24-s02/abort-rebuild.json`。
- 清理：停止新旧generation所有消费者，unlink SHM，关闭并删除隔离DB/LMDB/checkpoint。

#### AC-24-S03：CompletedBarLog overrun后精确恢复Recorder周期

- 对应工作包：WORK-05、WORK-11。
- 精确产品路径：`vnpy/trader/dataservice/completed_bar_log.py`、`vnpy_datarecorder/vnpy_datarecorder/canonical_consumer.py`、`vnpy_datamanager/vnpy_datamanager/engine.py`。
- 测试文件/nodeid：`tests/integration/test_dataservice_resume_recovery_e2e.py::test_completed_log_overrun_recovers_period_db_without_tick_reaggregation`。
- 初始状态：小容量真实CompletedBarLog，Recorder配置5m/1h，cursor位于retained head之前，DB 1m完整。
- 生产入口：CompletedBarLog reader overrun→Recorder recovery request→DataManager period rebuild→SQLite→Recorder new cursor。
- 操作：Recorder读取触发overrun并提交精确恢复；DataManager重建；Recorder移到latest有效cursor继续。
- 直接断言：DataService Tick/current持续更新且producer不阻塞；恢复范围只覆盖checkpoint到log head缺口；5m/1h从DB 1m重建；Recorder本地BarGenerator调用为0。
- PASS：DB完整、checkpoint在恢复后连续、新到达batch正常ACK。
- FAIL：阻塞ingress、补造Tick、全库下载、恢复未配置周期或漏掉配置周期。
- BLOCKED：fixture缺少足以覆盖log容量的rollover事件时返回`blocked_by_contract_ambiguity:performance_dataset`。
- 命令：`python -m pytest -q tests/integration/test_dataservice_resume_recovery_e2e.py::test_completed_log_overrun_recovers_period_db_without_tick_reaggregation`。
- 证据：`.artifacts/goal/dataservice-cold-hot-legacy-chain/ac-24-s03/log-overrun-recovery.json`。
- 清理：停止Recorder/DataService/DataManager，unlink log/Tick/GDS SHM并删除隔离DB/checkpoint。

## 11. 性能门禁

PERF-001：对照提交固定为`822c715e6`，candidate固定为实施完成提交；两者使用同一机器、Python、依赖、fixture、range和指标参数。

PERF-002：baseline和candidate分别使用干净worktree。不得在当前脏工作区直接比较后声称结论有效。

PERF-003：每个场景先预热3次，再正式测量20次，保存20次原始样本并计算P50/P95。

PERF-004：冷启动多周期首帧定义为用户发出range query到真实主图所有请求指标PlotDataItem获得首个有效xData/yData的时间。

PERF-005：warm 5m BOLL定义为cold baseline、L1、L2和LMDB已建立后，再次打开相同active/interval/range到三条真实PlotDataItem有效的时间。

PERF-006：candidate冷启动首帧P50和P95均不得高于baseline。

PERF-007：candidate warm 5m BOLL P50和P95均不得高于baseline的80%。

PERF-008：每个Tick的DB全范围读取次数为0。

PERF-009：每个Tick的完整历史snapshot重建次数为0。

PERF-010：每个Tick的新GDS allocation次数为0。

PERF-011：每个canonical 1m rollover的`CompletedRolloverBatch` log append次数为1、batch sequence增量为1；batch内各实际完成interval的hot/GDS append各为1。

PERF-012：同一series sequence的descriptor publish次数为1。

PERF-013：增加指标数量不重复读取相同1m/period DB范围，不复制完整GDS。

PERF-014：UI主线程多周期聚合、指标计算和DB query次数均为0。

PERF-015：compatibility bridge单独测量EVENT_TICK/Oms O(1)成本；样本不得包含聚合、指标、DB或同步绘图。

PERF-016：Trigger命中到OrderExecutionGate入口不得等待下一次EVENT_TIMER；正常样本与ACK故障重试样本分开统计。

PERF-017：Recorder Tick和1m DB调用次数等于timer flush批次数，不等于Tick或1m数量；同rollover全部selected高周期的immediate `save_bar_data(list)`和`db.atomic()`次数各不超过1。

PERF-018：性能命令固定为`python -m pytest -q tests/performance/test_dataservice_legacy_chain_benchmark.py --benchmark-json=.artifacts/goal/dataservice-cold-hot-legacy-chain/performance/candidate.json`。

PERF-019：原始结果、环境指纹、fixture manifest和SHA-256写入`.artifacts/goal/dataservice-cold-hot-legacy-chain/performance/`。

PERF-020：缺少可重复真实fixture时，Goal合同必须返回`blocked_by_contract_ambiguity:performance_dataset`，禁止用随机数据替代。

## 12. 实施工作包和依赖顺序

每个Goal Task必须包含Purpose、精确修改文件清单、明确禁止行为、前置Task ID、实施步骤、红灯命令、绿灯命令、回归命令、证据路径、Acceptance ID和Stop condition。

PRECONTRACT-001：Goal合同生成前必须执行FIXTURE-008。离线 fixture 不存在或 manifest 离线字段不完整时立即返回`blocked_by_contract_ambiguity:performance_dataset`；manifest 为`PASS_OFFLINE_LIVE_PENDING`且实时场景仅标记`blocked_until_market_open:<scenario>`时，合同生成器才生成包含离线任务和实时阻塞验收的冻结合同；不得把寻找离线数据留给实施阶段，也不得把实时阻塞场景标记为通过。

QUALITY-001：每个WORK修改Python后必须对该WORK实际修改文件执行`python -m compileall -q <精确文件列表>`、关键模块import和对应pytest collect-only。Ruff只做同一精确文件集合相对任务起点的新增问题比较；未安装Ruff时记录`blocked_by_environment:ruff`，不得声称全局lint通过。

QUALITY-002：所有Qt绿灯/回归命令直接在当前PowerShell先设置`$env:QT_QPA_PLATFORM='offscreen'`，不嵌套第二个`pwsh -Command`。所有完整stdout/stderr写入对应evidence目录，终端只回显退出码、测试计数、字节数和SHA-256。

### WORK-01：冻结822旧行为characterization

- Purpose：把本文件引用的旧指标、Recorder、Tick、回调和主连行为变成可执行证据。
- 产品路径：无。
- 测试路径固定为：`tests/characterization/test_legacy_indicator_chain_822c715e6.py`、`tests/characterization/test_legacy_recorder_chain_822c715e6.py`、`tests/characterization/test_legacy_callback_chain_822c715e6.py`、`tests/characterization/test_legacy_main_contract_mapping_822c715e6.py`。
- 前置：无。
- 验收：AC-09、AC-11、AC-12、AC-15、AC-17、AC-18、AC-19、AC-22的baseline侧。
- 实施步骤：在独立只读822 worktree运行四个characterization文件；固定回调顺序、Recorder cadence、指标输入/LMDB/绘制和main mapping分支；将逐字段结果写入baseline artifact。
- 红灯命令：`python -m pytest -q tests/characterization/test_legacy_indicator_chain_822c715e6.py tests/characterization/test_legacy_recorder_chain_822c715e6.py tests/characterization/test_legacy_callback_chain_822c715e6.py tests/characterization/test_legacy_main_contract_mapping_822c715e6.py`在candidate已知偏差断言上必须失败。
- 绿灯命令：同一命令在822 worktree必须全部通过。
- 回归命令：`python -m pytest --collect-only -q tests/characterization`并核对nodeid清单SHA。
- 证据：`.artifacts/goal/dataservice-cold-hot-legacy-chain/work-01/legacy-characterization.json`及四份完整pytest日志。
- PASS：四类旧行为都有直接值/顺序证据且与本文件一致。
- FAIL/BLOCKED：822实际行为与本文件冲突时返回`blocked_by_contract_ambiguity:legacy_behavior:<field>`；不得修改822代码使测试通过。
- 清理：删除只用于测试的临时DB/LMDB/SHM；保留独立worktree和只读证据，不触碰当前脏工作区。
- Stop condition：无法在独立822 worktree复现本文件声称的旧行为时停止，返回精确冲突字段。

### WORK-02：验证已冻结fixture并完成测试有效性审计

- Purpose：验证PRECONTRACT-001已冻结的真实1m/QUOTE/ORDER_BOOK输入，建立production-ingress replay和现有测试有效性审计；不得生成或改写权威样本内容。
- 产品路径：无。
- 只读fixture路径：`tests/fixtures/dataservice/mhi_completed_1m.parquet`、`tests/fixtures/dataservice/mhi_quote_orderbook.jsonl`、`tests/fixtures/dataservice/manifest.json`。
- 测试路径固定为：`tests/fixtures/dataservice_market_runtime_factory.py`、`tests/characterization/test_dataservice_fixture_manifest.py`、`tests/VALIDITY_DATASERVICE_TESTS.md`。
- 前置：WORK-01。
- 验收：FIX-05、FIX-06、FIX-07。
- 实施步骤：逐文件校验SHA和manifest必填字段；按event ID回放到生产ingress；审查现有DataService测试并逐项标记KEEP/REWRITE/DELETE及理由。
- 红灯命令：`python -m pytest -q tests/characterization/test_dataservice_fixture_manifest.py`必须在任一副本字节改变、event ID缺失或expected OHLCV缺失时失败。
- 绿灯命令：`python -m pytest -q tests/characterization/test_dataservice_fixture_manifest.py`对冻结原件必须通过。
- 回归命令：`python -m pytest --collect-only -q tests/integration tests/performance`并生成现有测试nodeid索引。
- 证据：`.artifacts/goal/dataservice-cold-hot-legacy-chain/work-02/fixture-verification.json`、`test-validity-audit.json`。
- PASS：manifest全部SHA/字段/事件可解析，replay factory可被Windows spawn，测试审计无未分类项。
- FAIL/BLOCKED：fixture或manifest缺失立即返回`blocked_by_contract_ambiguity:performance_dataset`；禁止随机生成替代数据。
- 清理：关闭replay child，删除仅由测试产生的隔离副本；冻结fixture保持只读且hash不变。
- Stop condition：无法证明fixture来源或SHA时停止，不生成随机替代。

### WORK-03：收敛active、logical/actual和实时订阅

- Purpose：恢复单active、旧main mapping并删除实时K_1M。
- 产品路径固定为：`vnpy/trader/dataservice/runtime.py`、`vnpy/trader/dataservice/quote_state.py`、`vnpy/trader/dataservice/futu_metadata.py`、`vnpy/trader/dataservice/subscription_registry.py`、`vnpy/trader/runtime_supervisor.py`、`vnpy/trader/runtime_protocol.py`、`vnpy_futu/vnpy_futu/futu_gateway.py`、`vnpy/trader/ui/widget.py`、`examples/veighna_trader/run.py`。
- 测试路径固定为：AC-09、AC-21、AC-22对应测试文件。
- 前置：WORK-01、WORK-02。
- 实施步骤：characterize并迁移旧main mapping调用；实现`stream_key`和active切换seal/abort/fence；把mapping/subscription/callback串行放入ingress dispatcher；删除实时K_1M和隐式active选择。
- 红灯命令：`python -m pytest -q tests/integration/test_dataservice_active_symbol_e2e.py tests/integration/test_dataservice_main_contract_mapping_e2e.py tests/integration/test_dataservice_quote_orderbook_ingress_e2e.py`在现状必须暴露切换或K_1M偏差。
- 绿灯命令：同一命令必须通过AC-09-S01、AC-21-S01/S02/S03、AC-22-S01/S02。
- 回归命令：`python -m pytest -q tests/trader/test_futu_quote_owner_handoff.py tests/trader/test_root_runtime_process_ownership.py`。
- 证据：`.artifacts/goal/dataservice-cold-hot-legacy-chain/work-03/active-mapping-subscription.json`及pytest日志。
- PASS：只有一个canonical active可写，切换顺序、stream fence、actual换月和无K_1M全部成立。
- FAIL/BLOCKED：旧mapping入口无法唯一确定时返回`blocked_by_contract_ambiguity:main_contract_mapping_path`；不得新写mapping算法。
- 清理：取消测试provider订阅，停止child并unlink所有stream SHM；不修改用户active持久化文件。
- Stop condition：旧main mapping分支无法唯一定位时返回`blocked_by_contract_ambiguity:main_contract_mapping_path`。

### WORK-04：单线程ingress与canonical增量聚合

- Purpose：DataService直接聚合QUOTE/ORDER_BOOK，保持限流、OHLCV和rollover。
- 产品路径固定为：`vnpy/trader/dataservice/runtime.py`、`vnpy/trader/dataservice/quote_state.py`、`vnpy/trader/dataservice/canonical_bars.py`、`vnpy/trader/dataservice/throttle.py`、`vnpy/trader/period_utils.py`、`vnpy/trader/hkfe_bar_generator.py`、`vnpy/trader/hkfe_period_common.py`、`vnpy/datafeed/period_aggregation.py`。
- 测试路径固定为：AC-06至AC-10对应测试文件。
- 前置：WORK-03。
- 实施步骤：让QUOTE/ORDER_BOOK进入一个dispatcher；复用旧限流和累计量差分；DataService进程内直接维护1m及目标周期；rollover构建一个多周期batch；启动replay只进聚合器。
- 红灯命令：`python -m pytest -q tests/integration/test_dataservice_quote_orderbook_ingress_e2e.py tests/integration/test_dataservice_tick_continuity_e2e.py tests/integration/test_dataservice_period_open_e2e.py`。
- 绿灯命令：同一命令必须通过AC-06至AC-10及AC-09-S02。
- 回归命令：`python -m pytest -q tests/test_hkfe_period_performance.py tests/test_gap003_multiframe.py`。
- 证据：`.artifacts/goal/dataservice-cold-hot-legacy-chain/work-04/ingress-aggregation.json`、OHLCV逐字段对照和发布计数。
- PASS：同Tick只聚合一次，边界Tick直通，4H/DAILY open正确，一次rollover一个batch。
- FAIL/BLOCKED：任何修改指标公式、时段业务规则或CTA私有BarGenerator的方案立即FAIL；fixture缺失返回性能数据blocker。
- 清理：停止dispatcher/DataService和全部cursor，unlink TickDatabus/GDS/log并删除隔离DB。
- Stop condition：修改指标公式、时段规则或CTA策略BarGenerator属于越界并停止。

### WORK-05：DataManager coverage和现有history IPC

- Purpose：DataManager独占缺口裁决、写库和回读，DataService只fetch。
- 产品路径固定为：`vnpy_datamanager/vnpy_datamanager/engine.py`、`vnpy_datamanager/vnpy_datamanager/runtime.py`、`vnpy/trader/dataservice/market_protocol.py`、`vnpy/trader/dataservice/query_protocol.py`、`vnpy/trader/dataservice/recovery_protocol.py`、`vnpy/trader/dataservice/recovery.py`、`vnpy/trader/runtime_supervisor.py`、`vnpy/trader/subprocess_queues.py`。
- 测试路径固定为：AC-03至AC-05、AC-08对应测试文件。
- 前置：WORK-02、WORK-03。
- 实施步骤：将expected identity、missing_ranges和DB写/回读保留在DataManager；history fetch只复用三种现有payload和临时SHM；实现取消/迟到release及changed-range局部失效。
- 红灯命令：`python -m pytest -q tests/integration/test_dataservice_datamanager_repair_e2e.py tests/integration/test_dataservice_stable_gds_query_e2e.py::test_cancelled_late_response_releases_temporary_shm`。
- 绿灯命令：同一命令必须通过AC-03至AC-05、AC-08、AC-23-S03。
- 回归命令：`python -m pytest -q tests/trader/test_dataservice_query_runtime.py tests/chart/test_chart_async_history_retry.py`。
- 证据：`.artifacts/goal/dataservice-cold-hot-legacy-chain/work-05/history-coverage-ipc.json`及SHM owner清单。
- PASS：DataManager唯一写repair DB，DataService DB write为0，头中尾缺口和所有临时SHM终态有直接证据。
- FAIL/BLOCKED：需要第二OpenD context、第二repair总线或缺少精确fixture范围时停止并报告对应ambiguity。
- 清理：取消pending request，release临时SHM，关闭DataManager/DataService和隔离DB。
- Stop condition：需要第二OpenD context或第二repair总线时停止并回到本文件审计。

### WORK-06：SQLite completed幂等入口

- Purpose：为at-least-once delivery提供事务内insert-or-compare，不改schema。
- 产品路径固定为：`vnpy/trader/database.py`、`vnpy_sqlite/vnpy_sqlite/sqlite_database.py`。
- 测试路径固定为：`tests/integration/test_database_completed_idempotency.py`、AC-03、AC-16对应测试文件。
- 前置：WORK-01。
- 实施步骤：在现有`save_bar_data(list)`单个`db.atomic()`内实现identity insert-or-compare；相同返回幂等成功，不同返回结构化冲突且不覆盖；不改schema。
- 红灯命令：`python -m pytest -q tests/integration/test_database_completed_idempotency.py`必须证明现状重复/冲突行为偏差。
- 绿灯命令：同一命令必须覆盖不存在、IDENTICAL、CONFLICT和同batch多bar原子回滚。
- 回归命令：`python -m pytest -q tests/integration/test_datarecorder_delivery_recovery_e2e.py::test_crash_after_commit_before_checkpoint_replays_identically`。
- 证据：`.artifacts/goal/dataservice-cold-hot-legacy-chain/work-06/sqlite-idempotency.json`和隔离DB查询结果。
- PASS：无schema变化、无replace覆盖、一次list一次transaction、冲突可交DataManager。
- FAIL/BLOCKED：需要migration、通用分布式锁或无法建立隔离SQLite时分别FAIL或`blocked_by_environment:sqlite`。
- 清理：rollback未完成事务，关闭连接并删除隔离DB/WAL/SHM文件。
- Stop condition：实现需要DB schema migration、通用分布式锁或静默replace冲突时停止。

### WORK-07：cold/hot权威、局部refresh和稳定GDS

- Purpose：实现唯一effective series并删除revision winner、业务旧视图、query snapshot/lease。
- 产品路径固定为：`vnpy/trader/dataservice/runtime.py`、`vnpy/trader/dataservice/query_runtime.py`、`vnpy/trader/dataservice/gds_snapshot.py`、`vnpy/trader/dataservice/bar_query.py`、`vnpy/trader/dataservice/bar_protocol.py`、`vnpy/trader/dataservice/chart_session.py`、`vnpy/datafeed/bar_data_array.py`、`vnpy/datafeed/index_range_builder.py`、`vnpy/datafeed/index_map_store.py`。
- 测试路径固定为：AC-01至AC-05、AC-23、AC-24对应测试文件。
- 前置：WORK-04、WORK-05、WORK-06。
- 实施步骤：实现cold range cache、hot identity map、DB冲突权威和局部重建；发布coverage_segments和稳定GDS；删除revision winner、业务旧视图、per-query snapshot/lease。
- 红灯命令：`python -m pytest -q tests/integration/test_dataservice_cold_hot_effective_series_e2e.py tests/integration/test_dataservice_datamanager_repair_e2e.py tests/integration/test_dataservice_stable_gds_query_e2e.py`。
- 绿灯命令：同一命令必须通过AC-01至AC-05、AC-23-S01/S02/S03。
- 回归命令：`python -m pytest -q tests/trader/test_dataservice_gds_range_snapshot.py tests/trader/test_dataservice_gds_rolling_window.py tests/chart/test_chart_dataservice_live_gds.py`。
- 证据：`.artifacts/goal/dataservice-cold-hot-legacy-chain/work-07/effective-series-gds.json`、allocation/DB read/publish计数。
- PASS：DB/hot/current权威唯一，缺口不伪造bar，未受影响segment持续，GDS普通读取稳定。
- FAIL/BLOCKED：相同identity无明确权威或产品路径超出授权时返回精确contract ambiguity。
- 清理：停止reader/writer，release query SHM，unlink stable GDS并删除隔离cache/DB。
- Stop condition：相同identity没有明确DB/hot/current权威时不得进入发布实现。

### WORK-08：恢复legacy指标输入和L1/L2/LMDB

- Purpose：只替换数据源，恢复全部指标旧计算链。
- 产品路径固定为：`vnpy/datafeed/indicator_data_session.py`、`vnpy/datafeed/indicator_protocol.py`、`vnpy/datafeed/indicator_runtime.py`、`vnpy/datafeed/indicator_runtime_client.py`、`vnpy/datafeed/indicator_worker.py`、`vnpy/datafeed/indicator_worker_pool.py`、`vnpy/datafeed/indicator_engine.py`、`vnpy/datafeed/l1_cache.py`、`vnpy/datafeed/l2_cache.py`、`vnpy/datafeed/indicator_storage.py`、`vnpy/datafeed/indicator_metadata_lmdb.py`、`indicators/indicator_registry.py`。
- 测试路径固定为：AC-11至AC-13对应测试文件。
- 前置：WORK-01、WORK-07。
- 实施步骤：建立薄legacy adapter；恢复period_bars含current、旧L1/L2和LMDB u0/u1；registry全部指标共享descriptor；删除stable-period和新rolling cache旁路。
- 红灯命令：`$env:QT_QPA_PLATFORM='offscreen'; python -m pytest -q tests/integration/test_dataservice_indicator_lmdb_qt_e2e.py tests/integration/test_dataservice_all_indicators_e2e.py`。
- 绿灯命令：同一命令必须通过AC-11-S01、AC-12-S01、AC-13-S01/S02。
- 回归命令：`python -m pytest -q tests/chart/test_indicator_drawing_manager_lmdb_mapping.py tests/datafeed/test_indicator_runtime_ownership.py tests/datafeed/test_indicator_no_data_bypass.py`。
- 证据：`.artifacts/goal/dataservice-cold-hot-legacy-chain/work-08/legacy-indicator-chain.json`、LMDB key/value hashes和registry diff。
- PASS：BOLL及全部注册指标沿同一旧链，current不清空prefix，cold/warm LMDB一致。
- FAIL/BLOCKED：需要BOLL专用路径、修改公式、新缓存层或缺少822 registry authority时停止。
- 清理：关闭Worker/LMDB，unlink descriptor SHM并删除隔离cache/DB。
- Stop condition：需要BOLL专用数据路径、新指标缓存层或公式修改时停止。

### WORK-09：Qt映射、绘制和4H/DAILY open

- Purpose：保证descriptor到真实图表的值和开盘价无回退。
- 产品路径固定为：`vnpy/chart/multi_timeframe_widget.py`、`vnpy/chart/indicator_drawing_manager.py`、`vnpy/chart/indicator_line_item.py`、`vnpy/chart/widget.py`、`vnpy/chart/widget_indicator.py`、`vnpy/chart/widget_mouse.py`、`vnpy/trader/ui/widget_chart_event.py`。
- 测试路径固定为：AC-06至AC-08、AC-11至AC-13、AC-24对应测试文件。
- 前置：WORK-07、WORK-08。
- 实施步骤：让Qt只消费descriptor的period_start/open/current_bar_start_ix/index_ranges/coverage_segments；在绘图数组segment边界插断线；删除UI本地聚合、DB查询和open重算。
- 红灯命令：`$env:QT_QPA_PLATFORM='offscreen'; python -m pytest -q tests/integration/test_dataservice_period_open_e2e.py tests/integration/test_dataservice_indicator_lmdb_qt_e2e.py tests/integration/test_dataservice_resume_recovery_e2e.py::test_minimize_keeps_aggregation_and_resume_only_reattaches`。
- 绿灯命令：同一命令必须通过AC-06至AC-08、AC-11、AC-13-S01/S02、AC-24-S01。
- 回归命令：`$env:QT_QPA_PLATFORM='offscreen'; python -m pytest -q tests/chart/test_multi_timeframe_widget_p0_2.py tests/chart/test_multi_timeframe_daily_symbol_normalization.py tests/chart/test_productized_chart_gds_delta_render.py`。
- 证据：`.artifacts/goal/dataservice-cold-hot-legacy-chain/work-09/qt-map-open.json`及真实PlotDataItem hashes。
- PASS：4H/DAILY open、断线、LMDB映射和最小化恢复均由真实Qt终点证明。
- FAIL/BLOCKED：Qt需要自行查DB、聚合或纠正open即FAIL；offscreen环境不可用则明确block。
- 清理：关闭所有widget/PlotDataItem/Worker，unlink SHM并删除隔离DB/LMDB。
- Stop condition：UI需要自行查DB、聚合或纠正period open时停止。

### WORK-10：Recorder本地配置和Tick消费

- Purpose：恢复UI配置、dormant合约和旧Tick批量链。
- 产品路径固定为：`vnpy_datarecorder/vnpy_datarecorder/engine.py`、`vnpy_datarecorder/vnpy_datarecorder/subprocess_facade.py`、`vnpy_datarecorder/vnpy_datarecorder/run_recorder_subprocess.py`、`vnpy_datarecorder/vnpy_datarecorder/ui/widget.py`、`vnpy/trader/recorder_subprocess_launcher.py`。
- 测试路径固定为：AC-14、AC-15对应测试文件。
- 前置：WORK-03、WORK-04。
- 实施步骤：把UI命令直接交Recorder subprocess；原子替换本地配置快照；Tick/batch首次入buffer前统一eligibility；保留dormant配置和旧Tick timer batch。
- 红灯命令：`python -m pytest -q tests/integration/test_datarecorder_runtime_config_e2e.py tests/integration/test_datarecorder_persistence_cadence_e2e.py`。
- 绿灯命令：同一命令必须通过AC-14-S01和AC-15-S01的配置/cadence部分。
- 回归命令：`python -m pytest -q tests/datarecorder/test_recorder_no_local_aggregation.py`。
- 证据：`.artifacts/goal/dataservice-cold-hot-legacy-chain/work-10/recorder-config-tick.json`、UI/JSON/buffer timeline。
- PASS：配置只归Recorder且消费边界确定，DataService配置命令次数为0，非active配置不订阅。
- FAIL/BLOCKED：需要DataService理解配置、多active或两阶段配置即FAIL；配置无法隔离则环境BLOCKED。
- 清理：恢复隔离配置，flush后停止Recorder，关闭DB并unlink TickDatabus。
- Stop condition：需要DataService理解Recorder配置或多active stream时停止。

### WORK-11：CompletedRolloverBatch、旧落库节奏和checkpoint

- Purpose：用一个bounded CompletedBarLog连接DataService rollover batch与Recorder持久化，保持旧周期时机并支持at-least-once。
- 产品路径固定为：`vnpy/trader/dataservice/completed_bar_log.py`、`vnpy/trader/subprocess_queues.py`、`vnpy_datarecorder/vnpy_datarecorder/canonical_consumer.py`、`vnpy_datarecorder/vnpy_datarecorder/engine.py`、`vnpy_datarecorder/vnpy_datarecorder/persistence_protocol.py`、`vnpy_datarecorder/vnpy_datarecorder/run_recorder_subprocess.py`、`vnpy/trader/recorder_subprocess_launcher.py`。
- 测试路径固定为：AC-02、AC-14至AC-16对应测试文件。
- 前置：WORK-06、WORK-07、WORK-10。
- 实施步骤：将现有CompletedBarLog条目改为多周期batch；实现wake/ACK、stream seal/abort/fence、selected/skipped/durable checkpoint、同batch高周期一次事务、timer fallback和overrun/DataService崩溃恢复请求。
- 红灯命令：`python -m pytest -q tests/integration/test_datarecorder_persistence_cadence_e2e.py tests/integration/test_datarecorder_delivery_recovery_e2e.py tests/integration/test_dataservice_resume_recovery_e2e.py::test_completed_log_overrun_recovers_period_db_without_tick_reaggregation`。
- 绿灯命令：同一命令必须通过AC-15-S01、AC-16-S01至S04、AC-24-S02/S03。
- 回归命令：`python -m pytest -q tests/datarecorder/test_recorder_no_local_aggregation.py tests/trader/test_dataservice_gds_rolling_window.py`。
- 证据：`.artifacts/goal/dataservice-cold-hot-legacy-chain/work-11/completed-batch-delivery.json`、DB/checkpoint/ACK/seal/abort timeline。
- PASS：一次rollover一个batch/sequence/ACK，同batch高周期一次事务，三个崩溃窗口和overrun恢复均无丢失重复。
- FAIL/BLOCKED：需要第二broker、durable outbox、config version、每bar sequence或Recorder重新聚合即FAIL；SHM/SQLite环境缺失明确BLOCKED。
- 清理：drain正常sealed stream，abort故障stream，停止进程并删除隔离DB/checkpoint/log SHM。
- Stop condition：需要第二completed broker、durable outbox、config version、每bar sequence或跨SQLite/SHM分布式事务时停止。

### WORK-12：CTA、EVENT_TICK、Oms和execution quote

- Purpose：恢复原vn.py回调和交易最新价，同时保持主进程轻量。
- 产品路径固定为：`vnpy/datafeed/tick_shm_ringbuffer.py`、`vnpy/datafeed/tick_databus.py`、`vnpy/trader/subprocess_event_bridge.py`、`vnpy/trader/engine.py`、`vnpy/trader/execution_quote.py`、`vnpy/trader/order_execution_gate.py`、`vnpy/trader/ui/widget_trading.py`、`vnpy/chart/widget_mouse.py`、`vnpy_ctastrategy/vnpy_ctastrategy/engine.py`、`vnpy_ctastrategy/vnpy_ctastrategy/run_cta_subprocess.py`、`vnpy_ctastrategy/vnpy_ctastrategy/serial_dispatcher.py`、`vnpy_futu/vnpy_futu/futu_gateway.py`。
- 测试路径固定为：AC-17至AC-19对应测试文件。
- 前置：WORK-03、WORK-04。
- 实施步骤：为CTA、Trigger、Recorder Tick、compatibility bridge和execution quote保留独立cursor；恢复CTA旧回调、EVENT_TICK/Oms latest和追价唤醒；确保启动Tick不双发且主进程不聚合。
- 红灯命令：`$env:QT_QPA_PLATFORM='offscreen'; python -m pytest -q tests/integration/test_dataservice_cta_callback_e2e.py tests/integration/test_dataservice_eventengine_compatibility_e2e.py tests/integration/test_futu_chase_execution_quote_e2e.py tests/integration/test_dataservice_quote_orderbook_ingress_e2e.py::test_startup_replay_publishes_tick_once`。
- 绿灯命令：同一命令必须通过AC-09-S02、AC-17-S01、AC-18-S01、AC-19-S01。
- 回归命令：`python -m pytest -q tests/trader/test_futu_quote_owner_handoff.py tests/ui/test_dataservice_market_ui.py tests/chart/test_widget_trigger.py`。
- 证据：`.artifacts/goal/dataservice-cold-hot-legacy-chain/work-12/callback-execution-quote.json`、各cursor event counts。
- PASS：CTA私有回调、第三方EVENT_TICK、Oms交易读取和追价全部恢复，主进程高频重计算为0。
- FAIL/BLOCKED：共享canonical bar直接回调CTA、UI轮询替代EventEngine或主进程恢复聚合均FAIL；child/Qt环境缺失明确BLOCKED。
- 清理：注销handlers，停止CTA/bridge/quote consumer/DataService并unlink TickDatabus。
- Stop condition：主进程恢复canonical聚合、指标或DB I/O时停止。

### WORK-13：Trigger逐Tick candidate链

- Purpose：把判断留在Trigger子进程，把真实交易留在OrderExecutionGate。
- 产品路径固定为：`vnpy/trader/trigger_service/engine.py`、`vnpy/trader/trigger_service/runtime.py`、`vnpy/trader/trigger_service/protocol.py`、`vnpy/trader/trigger_service/execution_quote_source.py`、`vnpy/trader/order_execution_gate.py`、`vnpy/trader/subprocess_event_bridge.py`。
- 测试路径固定为：AC-20对应测试文件。
- 前置：WORK-04、WORK-12。
- 实施步骤：逐Tick执行现有LineRuleGraph；固定candidate identity和500ms/1s重试；实现DELIVERY_DEGRADED；真实overrun时attach latest cursor、用latest Tick重评并ACK恢复；Gate执行前重验actual/position/reduce-only。
- 红灯命令：`python -m pytest -q tests/integration/test_trigger_candidate_execution_e2e.py`。
- 绿灯命令：同一命令必须通过AC-20-S01至AC-20-S04。
- 回归命令：`python -m pytest -q tests/chart/test_widget_trigger.py tests/trader/test_root_runtime_process_ownership.py`。
- 证据：`.artifacts/goal/dataservice-cold-hot-legacy-chain/work-13/trigger-delivery-overrun.json`、candidate/ACK/order sink timeline。
- PASS：Trigger不等timer、不直接交易、不永久停止，重试同一intent，overrun恢复不调用DataManager。
- FAIL/BLOCKED：attempt进入identity、三次后停止、旧actual直接下单或DataManager补Tick均FAIL；order sink/SHM不可用明确BLOCKED。
- 清理：恢复ACK consumer，停止Trigger/bridge/Gate，关闭order sink并unlink TickDatabus。
- Stop condition：candidate通过EVENT_TIMER提交、Trigger直接调用Gateway或重试产生新intent时停止。

### WORK-14：query生命周期和恢复

- Purpose：删除250ms重试风暴，按range终态和稳定GDS恢复。
- 产品路径固定为：`vnpy/trader/dataservice/query_runtime.py`、`vnpy/trader/dataservice/query_protocol.py`、`vnpy/trader/dataservice/chart_session.py`、`vnpy/datafeed/indicator_runtime_client.py`、`vnpy/chart/multi_timeframe_widget.py`、`vnpy/trader/runtime_supervisor.py`。
- 测试路径固定为：AC-23、AC-24对应测试文件。
- 前置：WORK-05、WORK-07、WORK-09。
- 实施步骤：每request只发一次终态；相同key共享in-flight；相交range用cold差集；取消/迟到只release临时SHM；drag/zoom读稳定GDS；最小化attach和DataService generation恢复分离。
- 红灯命令：`python -m pytest -q tests/integration/test_dataservice_stable_gds_query_e2e.py tests/integration/test_dataservice_resume_recovery_e2e.py`。
- 绿灯命令：同一命令必须通过AC-23-S01至S03、AC-24-S01至S03。
- 回归命令：`python -m pytest -q tests/chart/test_chart_async_history_retry.py tests/chart/test_chart_dataservice_session.py tests/trader/test_dataservice_query_runtime.py tests/trader/test_runtime_supervisor_lifecycle.py`。
- 证据：`.artifacts/goal/dataservice-cold-hot-legacy-chain/work-14/query-resume-lifecycle.json`、request终态和SHM owner计数。
- PASS：无250ms重试风暴、无普通query重启、无迟到GDS覆盖或SHM泄漏。
- FAIL/BLOCKED：需要per-query lease、TTL、tombstone或overlap DAG即FAIL；无法观察SHM owner明确BLOCKED。
- 清理：取消所有request，release临时SHM，关闭chart session/DataService和隔离DB。
- Stop condition：方案需要per-query lease、TTL或普通query重启进程时停止。

### WORK-15：全链验收与性能对照

- Purpose：执行AC-01至AC-24和PERF-001至PERF-020，生成证据索引。
- 产品路径：无，发现失败返回对应实施任务。
- 测试路径固定为：本节全部明确测试文件、`tests/performance/test_dataservice_legacy_chain_benchmark.py`。
- 前置：WORK-08至WORK-14全部绿灯。
- 实施步骤：按scenario独立执行AC-01-S01至AC-24-S03；在822和candidate干净worktree各预热3次、测量20次；生成P50/P95、runtime counters、环境指纹和evidence index。
- 红灯命令：先在candidate修复前运行各AC nodeid和`python -m pytest -q tests/performance/test_dataservice_legacy_chain_benchmark.py --benchmark-json=.artifacts/goal/dataservice-cold-hot-legacy-chain/performance/pre-fix.json`并记录真实失败。
- 绿灯命令：逐scenario执行第10节精确命令，随后运行PERF-018固定命令。
- 回归命令：`python -m pytest -q tests/integration/test_dataservice_*_e2e.py tests/integration/test_datarecorder_*_e2e.py tests/integration/test_trigger_candidate_execution_e2e.py`。
- 证据：`.artifacts/goal/dataservice-cold-hot-legacy-chain/evidence-index.json`和`performance/`全部原始样本/hash。
- PASS：所有scenario PASS，PERF-001至020通过，evidence index无缺项且生产database.db hash不变。
- FAIL/BLOCKED：任何scenario只由fake/helper/log证明即FAIL；fixture缺失返回`blocked_by_contract_ambiguity:performance_dataset`；依赖环境缺失保留精确BLOCKED，不得改写为PASS。
- 清理：结束两worktree测试进程，关闭/unlink全部隔离资源，保留只读evidence和benchmark JSON。
- Stop condition：任何核心场景只由fake/helper/log证明时判FAIL，不得进入完成状态。

### WORK-16：删除被替代旁路并执行最终回归

- Purpose：确保生产只剩一条权威链，不以兼容层长期保留双实现。
- 产品路径：删除范围仅限WORK-03至WORK-14已经明确列出的文件内旁路。
- 测试路径：修改范围仅限WORK-03至WORK-14明确列出的测试文件，以及`tests/performance/test_dataservice_legacy_chain_benchmark.py`。
- 必须删除：revision winner、实时K_1M seed、DataService自读TickDatabus、业务旧视图、全局DATA_READY、Recorder配置事务、每bar completed sequence、每interval Recorder completed reader、query snapshot/lease、主进程timer Trigger提交、Worker新指标旁路。
- 前置：WORK-03、WORK-04、WORK-05、WORK-06、WORK-07、WORK-08、WORK-09、WORK-10、WORK-11、WORK-12、WORK-13、WORK-14和WORK-15全部完成；AC-09、AC-10、AC-11、AC-12、AC-13、AC-14、AC-15、AC-16、AC-17、AC-18、AC-19、AC-20、AC-21、AC-22、AC-23和AC-24的所有Sxx场景均已通过。
- 实施步骤：逐旁路定位调用者；每删除一条先运行其替代场景；确认无生产引用后删除；执行compile/import/collect、修改文件Ruff差异、全部AC和回归。
- 红灯命令：每条旁路删除前运行对应AC，确认测试能在旁路重新启用时失败；禁止源码字符串搜索作为唯一红灯。
- 绿灯命令：`$env:QT_QPA_PLATFORM='offscreen'; python -m pytest -q tests/integration/test_dataservice_*_e2e.py tests/integration/test_datarecorder_*_e2e.py tests/integration/test_trigger_candidate_execution_e2e.py`。
- 回归命令：执行WORK-03至WORK-14全部回归命令和PERF-018，不运行无边界的“全部tests”替代精确证据。
- 证据：`.artifacts/goal/dataservice-cold-hot-legacy-chain/work-16/final-regression.json`、删除路径调用图、compile/import/collect/Ruff差异和完整日志hash。
- PASS：只有一条生产链，所有AC/PERF通过，修改/暂存文件均在合同授权范围。
- FAIL/BLOCKED：删除影响未characterize用户功能时返回`blocked_by_contract_ambiguity:uncharacterized_consumer:<symbol>`；不得保留双链掩盖问题。
- 清理：关闭所有测试进程和资源；只用明确路径暂存产品、有效测试和Source Plan授权文档，不暂存运行产物。
- Stop condition：删除会影响未characterize用户功能时停止并补充Source Plan审阅，不得猜测。

## 13. 明确不实施事项

NOT-DONE-001：不修改任何指标数学公式、参数、输出名称、输出数量或pane。

NOT-DONE-002：不重新发明HKFE交易时段；只使用V1和已提交V2 cutover。

NOT-DONE-003：不修改DB schema，不引入新数据库，不保存current bar。

NOT-DONE-004：不改变旧DataRecorder 1m/Tick批量和高周期立即写、失败降级语义。

NOT-DONE-005：不恢复DataRecorder自己的canonical BarGenerator和多周期聚合。

NOT-DONE-006：不让DataService、UI、Worker、Recorder、CTA或Trigger写repair DB。

NOT-DONE-007：不让DataService计算指标，不用GDS替代L1/L2/LMDB。

NOT-DONE-008：不新增指标缓存层，不按BOLL名称建立旁路。

NOT-DONE-009：不使用revision、generation、sequence或snapshot选择cold/hot winner。

NOT-DONE-010：不保留停止更新的旧视图作为运行权威。

NOT-DONE-011：不创建可进入指标数组的缺失占位bar。

NOT-DONE-012：不订阅实时K_1M，不使用分钟seed建立current。

NOT-DONE-013：不创建多个active symbol、多个实时TickDatabus或非active实时Recorder。

NOT-DONE-014：不新增mapping version，不因actual换月改变logical generation或stream。

NOT-DONE-015：不把Tick限流、Tick sequence或consumer overrun当作历史bar缺口。

NOT-DONE-016：不让DataService读回自身TickDatabus聚合。

NOT-DONE-017：不建立第二套completed broker、durable outbox或分布式事务；只复用并最小修改现有bounded CompletedBarLog，使其传输rollover batch。

NOT-DONE-018：不为Recorder配置建立两阶段跨进程事务或config version。

NOT-DONE-019：不把Tick/1m/高周期改成同一种持久化节奏，也不逐Tick写DB；同rollover高周期的一次原子list事务不属于统一timer批量。

NOT-DONE-020：不为普通descriptor建立consumer lease、TTL或每query allocation。

NOT-DONE-021：不实现任意重叠range coalescing框架，不保留250ms重试。

NOT-DONE-022：不使用EVENT_TIMER提交Trigger candidate，不让Trigger/DataService调用真实交易API。

NOT-DONE-023：不让shared canonical bar直接调用CTA策略`on_bar/on_window_bar`。

NOT-DONE-024：不让UI恢复DB查询、周期聚合、指标计算或period open纠正权威。

NOT-DONE-025：不使用fake DataService、fake LMDB、fake PlotDataItem、fake Queue或日志字符串作为唯一验收。

NOT-DONE-026：不修改合同未授权路径，不顺带修复无关测试或图表功能。

NOT-DONE-027：不提交`database.db`、LMDB、日志、报告、性能原始数据、临时文件、cache或`__pycache__`。

## 14. Goal合同编译约束

CONTRACT-001：Source Plan路径固定为`docs/plans/2026-09-04-dataservice-cold-hot-legacy-chain-source-plan.md`。

CONTRACT-002：Goal Contract路径固定为`docs/plans/2026-09-04-dataservice-cold-hot-legacy-chain-goal-execution-plan.md`。

CONTRACT-003：本文件经用户明确确认后，合同作者才可执行：

```powershell
npm exec --offline -- bmad-speckit goal-contract generate --entry standalone_goal_contract --source docs/plans/2026-09-04-dataservice-cold-hot-legacy-chain-source-plan.md --out docs/plans/2026-09-04-dataservice-cold-hot-legacy-chain-goal-execution-plan.md --json
```

CONTRACT-004：GoalExecutionIR必须为FIX-01至FIX-17、AUDIT-B01至B06、AUDIT-M01至M18、AC-01-S01至AC-24-S03实际存在的全部scenario、PERF-001至PERF-020建立双向映射，`unmappedSourceObligations=0`。

CONTRACT-005：每个Goal Task只选择WORK节列出的精确文件子集。不得使用`vnpy/**`、`tests/**`、“所有DataService文件”、“指标文件”或“必要文件”。

CONTRACT-006：某任务需要清单外路径时返回`blocked_by_contract_ambiguity:file_scope:<exact_path>`，等待Source Plan successor授权。

CONTRACT-007：合同必须为每个`AC-xx-Sxx`绑定Goal Task、实际实现文件、测试文件和pytest nodeid、可执行PowerShell命令、直接assertion/artifact、PASS、FAIL、BLOCKED和teardown。

CONTRACT-008：合同必须验证`goalContractVersion=goal-execution-contract/v1`、`contractMode=frozen`、`rewritePolicy=forbidden`、`executionMode=execute_only`和`goalJudgeDispatchCount=1`。

CONTRACT-009：合同必须生成并核对source plan hash、goal contract hash、GoalExecutionIR hash、closure、active authority、coverage receipt和generation receipt。

CONTRACT-010：不得执行partition，不得生成子合同，不得启动Goal，不得运行第二次authoring semantic Judge。

CONTRACT-011：GoalExecutionIR、任务、Acceptance、命令和Stop condition禁止出现确定性语言门禁词表中的全部不确定性表达。

CONTRACT-012：每条义务必须写明执行者、精确目标、必须条件、证明命令和失败状态。

## 15. 脏工作区保护

DIRTY-001：合同生成前记录当前HEAD、residual worktree清单及其SHA-256。

DIRTY-002：合同生成前记录每个任务授权文件的初始SHA-256和相对HEAD状态。

DIRTY-003：实施代理不得reset、checkout覆盖、revert、删除或暂存用户既有修改。

DIRTY-004：授权文件在合同冻结后被外部修改时立即停止该任务并报告路径和新hash。

DIRTY-005：测试既有失败必须通过822基线对照或最小复现分类，不得自动归因于本次修改。

DIRTY-006：提交必须使用明确路径暂存，禁止`git add -A`。

DIRTY-007：提交前检查`git status --short`、`git diff --cached --name-only`和完整staged diff，范围外文件存在时停止提交。

## 16. 人工审阅清单

- [ ] 17项均包含五段证据链。
- [ ] DataService只是数据源和共享位置替换，不是新指标系统。
- [ ] DB completed、hot completed、hot current三类权威明确。
- [ ] 冲突期间由DB completed继续权威，不冻结整个旧视图。
- [ ] 缺失identity不伪造成bar，未受影响数据继续工作。
- [ ] DataManager独占coverage、DB写入和回读复验。
- [ ] DataService只复用唯一OpenD context执行history fetch。
- [ ] 实时行情只使用QUOTE和ORDER_BOOK，不依赖实时K_1M。
- [ ] Tick限流、transport overrun和bar gap严格区分。
- [ ] active合约只由查询合约窗口设置，默认值由主进程明确发送。
- [ ] logical/actual严格复用旧main_contract_mapping。
- [ ] DataRecorder配置完全归Recorder，无两阶段配置协议。
- [ ] Recorder保留Tick/1m timer批量、高周期立即写失败降级，同rollover高周期只用一次原子事务。
- [ ] CompletedRolloverBatch、bounded CompletedBarLog、checkpoint和SQLite幂等满足at-least-once。
- [ ] 一次canonical 1m rollover只有一个batch sequence和一个最终ACK，不是每bar一个sequence。
- [ ] active切换使用stream_key、STREAM_SEAL、ABORTED和旧消息fence，切回同symbol不会复用旧generation。
- [ ] CTA策略私有回调、EVENT_TICK/Oms、追价和Trigger链无回退。
- [ ] GDS稳定，不使用普通query snapshot/lease/TTL。
- [ ] hot tail只在cold刷新并验证后吸收。
- [ ] 全部注册指标恢复旧L1/L2/LMDB/mapping/PlotDataItem链。
- [ ] BOLL 5m current、rollover和TA-Lib oracle有真实验收。
- [ ] 4H和DAILY open同时覆盖V1/V2与缺失起始分钟。
- [ ] `AC-01至AC-24`的全部`AC-xx-Sxx`均包含fixture、入口、步骤、断言、命令、证据、PASS、FAIL、BLOCKED和清理。
- [ ] 历史IPC只复用三种现有payload和临时SHM，取消/迟到response不会覆盖GDS且释放资源。
- [ ] Trigger具备500ms快速重试、DELIVERY_DEGRADED每秒重试、真实overrun重评和恢复ACK。
- [ ] coverage_segments使指标和PlotDataItem跨缺口断线但不创建bar。
- [ ] `WORK-01至WORK-16`均有精确步骤、红灯、绿灯、回归、证据、PASS/FAIL/BLOCKED和清理。
- [ ] 性能门禁与822基线使用同环境、3次预热和20次测量。
- [ ] 本文件经用户确认前不生成Goal合同、不实施代码。
