# Multi Timeframe Display Settings

目标文件：`vnpy/chart/multi_timeframe_widget.py`, `vnpy/chart/multi_timeframe_settings_dialog.py`, `vnpy/trader/ui/widget.py`

## 默认显示

| 项目 | 默认 | 行为 |
|---|---|---|
| 主图摘要 | 开启 | 主图摘要展示所有启用周期和指标。 |
| 设置面板 | 开启 | 设置面板默认显示可编辑周期列表。 |

## 设置面板

- 支持批量操作启用和禁用多个周期。
- 实时预览在用户修改设置时立即更新主图摘要。
- 取消时回滚所有预览变更。
- OK 按钮持久化设置并刷新图表。

## 验收标准

- 1366x768 分辨率下必须可用，不遮挡 OK 和取消按钮。
- pytest tests/test_multi_timeframe_settings.py 必须覆盖设置持久化。

```text
This fenced block must not become a requirement candidate.
```

## 非目标

本需求不重写交易引擎。
