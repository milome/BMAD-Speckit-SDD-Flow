# HKFE Period Aggregation - 港期周期聚合最佳实践

> **核心原则**：港期30分钟K线采用"边遍历边创建"模式聚合，复用 `should_force_close_hkfe_daily()` 的 gap-based 逻辑识别金融假期，跨时段周期 [02:45, 09:30) 使用 `original_dt.weekday() == 0` 实现 Monday Rollback。

## 1. 港期交易时段

| Session | Time (HKST) | Description |
|---------|-------------|-------------|
| Night Session | 17:15 - 03:00 (next day) | 夜盘交易 |
| Day Session | 09:15 - 12:00, 13:00 - 16:30 | 日盘交易（含午休） |
| Lunch Break | 12:00 - 13:00 | 午休（无交易） |

## 2. 30分钟周期划分

```
Night Session (17:15 - 03:00):
├── 17:15 - 17:44  -> period_start = 17:15
├── 17:45 - 18:14  -> period_start = 17:45
├── 02:15 - 02:44  -> period_start = 02:15
└── 02:45 - 09:29  -> period_start = 02:45 (跨时段特殊周期)

Day Session (09:15 - 16:30):
├── 09:30 - 09:59  -> period_start = 09:30
├── 10:00 - 10:29  -> period_start = 10:00
├── 11:30 - 11:59  -> period_start = 11:30
├── 12:00 - 12:29  -> period_start = 12:00 (午休时段，正常日盘无交易)
└── 13:00 - 13:29  -> period_start = 13:00
```

## 3. 跨时段周期 [02:45, 09:30)

- **定义**：夜盘最后一根30分钟K线，跨越休市时段（02:45 - 09:29）
- **period_start**: 02:45
- **period_end**: 09:29
- **特殊行为**：
  - 周一 09:15-09:29 属于**上周六 02:45** 开始的周期（Monday Rollback）
  - 金融假期后首个交易日 09:15 触发 Force Close

## 4. Force Close 判断逻辑

`should_force_close_hkfe_daily(last_minute_dt, current_minute_dt, daily_end=time(16, 29))`:

| 条件 | 结果 | 说明 |
|------|------|------|
| `last_time == daily_end` | **True** | 日盘正常结束（16:29） |
| `last_time < daily_end` 且 `gap < 24h` | **False** | 同一天延续（如 02:59 → 09:15） |
| `last_time < daily_end` 且 `gap >= 24h` 且 `(周五/周六)→周一` 且 `gap <= 72h` | **False** | 正常周末延续 |
| `last_time < daily_end` 且 `gap >= 24h` 且 **其他情况** | **True** | 金融假期强制收盘 |

**关键时间点示例**：
| 场景 | last_time | gap | 结果 |
|------|-----------|-----|------|
| 正常周二 | 02:59 | 6.27h | False (同一天延续) |
| 正常周末 | 02:59 (周五) | 54.27h | False (周五→周一, gap<=72h) |
| 清明节 | 02:59 (周五) | 78.27h | **True** (gap>72h, 非正常周末) |
| 佛诞日 | 02:59 (周六) | 78.27h | **True** (gap>72h) |
| 成立纪念日 | 02:59 (周一) | 54.27h | **True** (非周五/周六→周一) |
| 国庆节 | 02:59 (周二) | 54.27h | **True** (非周五/周六→周一) |

## 5. 跨时段K线边界对比

| 周期 | 跨时段K线 | Force Close 边界 |
|------|----------|------------------|
| 30分钟 | [02:45, 09:30) | 从 02:45 开始的跨时段K线 |
| 1小时 | [02:15, 09:30) | 从 02:15 开始的1小时跨时段K线 |
| 4小时 | [01:15, 11:30) | 从 01:15 开始的4小时跨时段K线 |

**各周期时间划分规则**：
| 周期 | 夜盘 | 跨休市 | 日盘 |
|------|------|--------|------|
| 30分钟 | :15, :45 | 02:45 | :00, :30 |
| 1小时 | :15 | 02:15 | :30（11:30跨午休） |
| 4小时 | 17:15, 21:15 | 01:15 | 11:30（跨午休） |

## 6. 推荐聚合实现方式

### 6.1 状态变量设计

```python
# 推荐使用与 HKFEBarGenerator 一致的状态变量
state = {
    'current_period_start': None,      # 当前周期开始时间
    'current_original_datetime': None,  # 当前原始时间（用于Monday Rollback）
    'window_bar': None,                 # 当前周期聚合K线
    'last_minute_bar': None,            # 上一根分钟K线（用于Force Close检测）
}
```

### 6.2 周期变化检测

```python
# 使用 period_start 对比检测周期变化
if current_period_start != period_start:
    # 完成上一个周期
    # 开始新周期
```

### 6.3 Force Close 检测

```python
# 只在 09:15 时间点触发
if last_minute_bar and bar_dt.hour == 9 and bar_dt.minute == 15:
    if should_force_close_hkfe_daily(
        last_minute_bar.datetime.replace(tzinfo=None),
        bar_dt.replace(tzinfo=None),
        time(16, 29)
    ):
        is_force_close = True
```

## 7. datetime_end 计算速查

```python
def calc_datetime_end(bar, period_end, is_force_close):
    if is_force_close:
        return bar.datetime + timedelta(minutes=1)  # last_minute + 1min
    if bar.datetime.hour == 2 and bar.datetime.minute == 45:
        return period_end + timedelta(minutes=1)   # 跨时段: 09:30
    return period_end + timedelta(minutes=1)       # 普通周期
```

## 8. 核心 API 一览

```python
# === 周期计算 ===
get_hkfe_30min_period_start(dt)           # -> datetime | None (period_start)
get_hkfe_30min_period_end(dt, original_dt=None)  # -> datetime | None (period_end)

# === 聚合函数 ===
aggregate_to_30minute_from_minutes(bars, symbol=None, exchange=None)
# 返回: (List[BarData], Dict[datetime, datetime])

# === Force Close 判断 ===
should_force_close_hkfe_daily(last_minute_dt, current_minute_dt, daily_end=time(16, 29))
# 返回: True (Force Close) | False (继续)
```

## 9. 常见陷阱

### 9.1 时区陷阱

```python
# ❌ 陷阱：混合 naive 和 aware datetime
naive_dt = datetime(2025, 4, 4, 2, 45)  # 无时区
result1 = get_hkfe_30min_period_start(naive_dt)  # 可能返回 None！

# ✅ 正确做法：始终使用 aware datetime
from vnpy.trader.database import DB_TZ
bar_dt = bar.datetime
if bar_dt.tzinfo is None:
    bar_dt = bar_dt.replace(tzinfo=DB_TZ)
period_start = get_hkfe_30min_period_start(bar_dt)
```

### 9.2 Force Close 判断陷阱

```python
# ❌ 陷阱：在非 09:15 时间点调用 should_force_close_hkfe_daily
# 只能在 09:15 时间点触发 Force Close 检测

# ✅ 正确理解：
# - 16:29 收盘：last_time == daily_end -> True（正常结束当天）
# - 09:15 开盘 + gap > 72h -> True（金融假期 Force Close）
# - 09:15 开盘 + gap < 24h -> False（同一天延续）
# - 09:15 开盘 + gap > 72h + 非周五/周六->周一 -> True（金融假期）
```

### 9.3 Monday Rollback 陷阱

```python
# ❌ 陷阱：假设周一 09:15 有自己的 period_start
monday_0915 = datetime(2025, 4, 7, 9, 15)
period_start = get_hkfe_30min_period_start(monday_0915)
# 返回: 2025-04-05 02:45:00 (周六！不是周一)

# ✅ 正确理解：周一 09:15 属于 [02:45, 09:30) 周期
# 这个周期从周六 02:45 开始，跨越整个周末
```

## 10. 最小可运行示例

```python
from datetime import datetime, time, timedelta
from vnpy.trader.constant import Exchange, Interval
from vnpy.trader.object import BarData
from vnpy.trader.database import DB_TZ
from vnpy.trader.period_utils import aggregate_to_30minute_from_minutes

def create_minute_bar(dt, idx):
    return BarData(
        symbol="MHImain",
        exchange=Exchange.HKFE,
        datetime=dt.replace(tzinfo=DB_TZ),
        interval=Interval.MINUTE,
        gateway_name="test",
        open_price=20000 + idx,
        high_price=20010 + idx,
        low_price=19990 + idx,
        close_price=20000 + idx,
        volume=100.0,
        turnover=1000000.0,
    )

# 清明节测试数据
minute_bars = []
# 4/4 周五 02:45 - 02:59
for i, minute in enumerate(range(45, 60)):
    dt = datetime(2025, 4, 4, 2, minute)
    minute_bars.append(create_minute_bar(dt, i))
# 4/7 周一 09:15 - 09:30
for i, minute in enumerate(range(15, 31)):
    dt = datetime(2025, 4, 7, 9, minute)
    minute_bars.append(create_minute_bar(dt, i))

# 聚合
aggregated_bars, _ = aggregate_to_30minute_from_minutes(
    minute_bars, "MHImain", Exchange.HKFE
)

for bar in aggregated_bars:
    end = bar.datetime_end
    end_str = end.strftime("%Y-%m-%d %H:%M") if end else "None"
    print(f"period_start: {bar.datetime.strftime('%Y-%m-%d %H:%M')} | datetime_end: {end_str}")

# 预期输出:
# period_start: 2025-04-04 02:45 | datetime_end: 2025-04-04 03:00  (Force Close)
# period_start: 2025-04-07 09:30 | datetime_end: 2025-04-07 10:00  (新周期)
```

## 11. 测试命令

```bash
# 运行30分钟周期测试
pytest tests/test_period_utils_30min.py -v

# 运行金融假期测试
pytest tests/test_period_utils_30min_financial_holiday.py -v

# 运行并查看覆盖率
pytest tests/test_period_utils_30min.py --cov=vnpy.trader.period_utils

# 调试模式运行
pytest tests/test_period_utils_30min_financial_holiday.py::TestFinancialHolidayForceClose::test_qingming_festival_2025_force_close -v -s
```

## 12. 相关文件

| 文件 | 说明 |
|------|------|
| `vnpy/trader/period_utils.py` | 周期计算核心函数 |
| `vnpy/trader/calendar_config.py` | 假期配置 |
| `tests/test_period_utils_30min.py` | 30分钟周期计算测试 |
| `tests/test_period_utils_30min_financial_holiday.py` | 金融假期Force Close测试 |
| `specs/013-hkfe-period-refactor/HKFE周期聚合最佳实践.md` | 完整设计文档 |
