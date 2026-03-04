# HKFE Period Rules - 港期时间周期划分规则

## 概述

本技能定义了港期交易所（小恒指期货主连）的时间周期划分规则
# HKFE 日线周期完整理解

> **最后更新**: 2026-01-04 | **状态**: 规范定义

## 核心概念

HKFE（日交所）日线周期的关键在于理解**交易日**与**自然日**的区别。

### 交易日定义

交易日 = 夜盘 + 凌晨 + 日盘（连续的交易时段）

```
交易日 = [17:15, 24:00) + [00:00, 03:00) + [09:15, 16:30)
```

交易日跨越自然日：
- **周一交易日** = 周一 17:15 - 周二 16:30
- **周二交易日** = 周二 17:15 - 周三 16:30
- 以此类推...

**交易日 = period_end 所在的自然日**

## 四个关键时间戳

| 字段 | 含义 | 验证规则 |
|------|------|----------|
| **period_start** | 周期开始（左闭） | `datetime ∈ [period_start, period_end]` |
| **datetime** | 等于 period_start | `datetime == period_start` |
| **period_end** | 周期结束（右闭） | `datetime ∈ [period_start, period_end]` |
| **datetime_end** | 周期结束（右开） | `datetime < datetime_end` |

### 时间戳关系

```
period_start = datetime
period_end < datetime_end (通常差1分钟)
```

### 示例：周一交易日

| 字段 | 时间 | 说明 |
|------|------|------|
| period_start | **周一 17:15** | 夜盘开始 |
| datetime | **周一 17:15** | 等于 period_start |
| period_end | **周二 16:29** | 日盘最后一分钟 |
| datetime_end | **周二 16:30** | 日盘结束（右开） |

### 左闭右开验证

```
区间: [period_start, period_end] = [周一 17:15, 周二 16:29]

验证:
- 周一 17:15 ∈ 区间 ✓ (左闭，包含)
- 周一 20:00 ∈ 区间 ✓
- 周二 02:00 ∈ 区间 ✓
- 周二 16:29 ∈ 区间 ✓ (右闭，包含)
- 周二 16:30 ∉ 区间 ✗ (右开，不包含)
```

## period_start 计算规则

### 规则：period_start 是当前交易时段的开始时间

**夜盘时段的 period_start**
- 输入: 周一 20:00 → period_start = **周一 17:15**
- 输入: 周二 20:00 → period_start = **周二 17:15**

**日盘时段的 period_start**
- 输入: 周二 14:30 → period_start = **周一 17:15** (上一个交易日的夜盘开始)

### period_start 速查表

| 输入时间 | period_start | period_end | 交易日 (period_end所在自然日) |
|----------|--------------|------------|------------------------------|
| 周一 20:00 (夜盘) | 周一 17:15 | 周二 16:29 | 周二 |
| 周二 02:00 (凌晨) | 周一 17:15 | 周一 16:29 | 周一 |
| 周二 14:30 (日盘) | 周一 17:15 | 周一 16:29 | 周一 |
| 周三 10:00 (日盘) | 周二 17:15 | 周三 16:29 | 周三 |

### period_end 速查表

| 输入时间 | period_end | 交易日 (period_end所在自然日) |
|----------|------------|------------------------------|
| 周一 20:00 | 周二 16:29 | 周二 |
| 周二 14:30 | 周一 16:29 | 周一 |
| 周三 10:00 | 周三 16:29 | 周三 |

## 特殊场景

### 周一凌晨 (00:00 - 03:00)

属于**上周五交易日**的延续：
- period_start = 上周五 17:15
- period_end = 周一 16:29

### 金融假期前夕

**周五是金融假期**（如 12/24, 12/31）：
- period_start = 当天 09:15 (无夜盘)
- period_end = 当天 12:29 或 11:59 (半日休市)

### 正常周五

- period_start = 周五 17:15
- period_end = 下周一 16:29 (跨越周末)

## 代码实现注意事项

### Legacy 模式 (period_utils.py)

```python
# 夜盘: period_start 是当天的 17:15
if time_value >= 1715:
    return dt.replace(hour=17, minute=15, ...)

# 日盘周一: period_start 是上周五的 17:15
if dt.weekday() == 0:  # 周一
    return last_friday_1715
```

### Config-driven 模式 (hkfe_period_calculator.py)

```python
# 夜盘: period_start = 今天的 17:15
if is_night_session(dt):
    return datetime.combine(dt.date(), normal_time)  # 17:15

# 日盘周一: period_start = 上周五的 17:15
if dt.weekday() == 0 and not is_night_session(dt):
    return datetime.combine(last_friday, normal_time)  # 17:15
```

## 常见错误

### 错误1：混淆交易日与自然日

**错误理解**：
- 认为"周二交易日" = 周二日盘 [09:15, 16:30)

**正确理解**：
- 周二交易日 = 周一 17:15 - 周二 16:30 (跨越自然日)

### 错误2：period_start 与 period_end 同一天

**错误理解**：
- period_start = 周二 17:15 → period_end = 周二 16:29

**正确理解**：
- period_start = 周一 17:15 → period_end = 周二 16:29 (跨自然日)

### 错误3：左闭右开方向错误

**错误理解**：
- [start, end) 区间

**正确理解**：
- period_start 使用左闭 [start, closed]
- datetime_end 使用右开 [start, end)

## 测试用例模板

```python
def test_daily_period_start():
    # 周一 20:00 (夜盘)
    dt = datetime(2024, 1, 15, 20, 0)
    result = get_period_start(dt, Interval.DAILY, Exchange.HKFE)
    assert result == datetime(2024, 1, 15, 17, 15)  # 周一 17:15

    # 周二 14:30 (日盘)
    dt = datetime(2024, 1, 16, 14, 30)
    result = get_period_start(dt, Interval.DAILY, Exchange.HKFE)
    assert result == datetime(2024, 1, 15, 17, 15)  # 周一 17:15 (上周五夜盘延续)
```

## 总结

1. **period_start** = 当前交易时段的开始（17:15）
2. **period_end** = 交易日结束（16:29），可能跨越自然日
3. **交易日** = period_end 所在的自然日
4. **左闭右开** 只适用于 datetime_end，不适用于 period_end
