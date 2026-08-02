# Multi Timeframe Display Settings

目标文件：`vnpy/chart/multi_timeframe_widget.py`, `vnpy/chart/multi_timeframe_settings_dialog.py`, `vnpy/trader/ui/widget.py`

## Functional Requirements

| ID | Requirement | Acceptance link |
| --- | --- | --- |
| FR-001 | 主图摘要必须展示所有启用周期和指标。 | ACC-001 |
| FR-002 | 设置面板必须显示可编辑周期列表并实时预览修改。 | ACC-002 |
| FR-003 | 取消操作必须回滚全部预览变更。 | ACC-003 |
| FR-004 | OK 操作必须持久化设置并刷新图表。 | ACC-004 |

## Negative Requirements And Not Done Conditions

| ID | Not-done condition | Negative assertion | Blocks completion when | Failure refs | Evidence refs |
| --- | --- | --- | --- | --- | --- |
| NEG-001 | 仅更新确认页或内存预览不能算完成。 | 持久化失败时必须保留先前设置且不得宣称保存成功。 | 失败后状态被部分写入或错误显示成功。 | FAIL-001 | ACC-003 ACC-004 CMD-001 |

## Failure Matrix

| ID | Failure condition | Required system behavior | Negative requirement refs | Evidence | Requirement refs |
| --- | --- | --- | --- | --- | --- |
| FAIL-001 | 设置校验、持久化或刷新失败。 | 阻止提交，保留最近一次有效设置，并向用户显示可恢复错误。 | NEG-001 | ACC-001 ACC-002 ACC-003 ACC-004 E2E-001 | MUST-FR-001 MUST-FR-002 MUST-FR-003 MUST-FR-004 |

## Acceptance Evidence

| ID | Evidence target | Covers | Required evidence | Oracle | Assertion source | Responsibility mapping |
| --- | --- | --- | --- | --- | --- | --- |
| ACC-001 | 摘要显示 | MUST-FR-001 | pytest tests/test_multi_timeframe_settings.py | 所有启用周期和指标都出现在摘要中。 | CMD-001 TRACE-001 | PATH-001 owns implementation and remediation. |
| ACC-002 | 设置预览 | MUST-FR-002 | pytest tests/test_multi_timeframe_settings.py | 编辑周期后预览立即反映新配置。 | CMD-001 TRACE-002 | PATH-002 owns implementation and remediation. |
| ACC-003 | 取消回滚 | MUST-FR-003 NEG-001 | pytest tests/test_multi_timeframe_settings.py | 取消后恢复修改前设置且无持久化副作用。 | CMD-001 TRACE-003 TRACE-005 | PATH-002 owns implementation and remediation. |
| ACC-004 | 保存刷新 | MUST-FR-004 NEG-001 | pytest tests/test_multi_timeframe_settings.py | 保存成功后设置持久化且图表刷新一次。 | CMD-001 TRACE-004 TRACE-005 | PATH-003 owns implementation and remediation. |

## Test And Verification Paths

| ID | Type | Covers | Command or evidence path | Completion rule | Per-MUST oracle | Assertion source | Responsibility mapping | Target files |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| CMD-001 | delivery-evidence | MUST-FR-001 MUST-FR-002 MUST-FR-003 MUST-FR-004 NEG-001 | pytest tests/test_multi_timeframe_settings.py | Exit code 0. | 每个 MUST 使用对应 ACC/TRACE oracle 独立闭环。 | ACC-001 ACC-002 ACC-003 ACC-004 E2E-001 TRACE-001 TRACE-002 TRACE-003 TRACE-004 TRACE-005 | PATH-001 PATH-002 PATH-003 own remediation. | tests/test_multi_timeframe_settings.py vnpy/chart/multi_timeframe_widget.py vnpy/chart/multi_timeframe_settings_dialog.py vnpy/trader/ui/widget.py |
| E2E-001 | e2e | MUST-FR-001 MUST-FR-002 MUST-FR-003 MUST-FR-004 NEG-001 | pytest tests/test_multi_timeframe_settings.py | Exit code 0. | 用户完成预览、取消、保存和刷新闭环。 | ACC-001 ACC-002 ACC-003 ACC-004 CMD-001 TRACE-001 TRACE-002 TRACE-003 TRACE-004 TRACE-005 | PATH-001 PATH-002 PATH-003 own remediation. | tests/test_multi_timeframe_settings.py vnpy/chart/multi_timeframe_widget.py vnpy/chart/multi_timeframe_settings_dialog.py vnpy/trader/ui/widget.py |

## Trace Matrix Source

| ID | Covers | Evidence refs | Acceptance refs | Contract validation command refs | Delivery evidence command refs | View refs | Artifact refs | Boundary refs | Per-MUST oracle | Per-MUST closure assertion | Responsibility mapping |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| TRACE-001 | MUST-FR-001 | ACC-001 | ACC-001 E2E-001 | CMD-001 | CMD-001 | none | PATH-001 | OUT-001 | 所有启用周期和指标都出现在摘要中。 | MUST-FR-001 closes through ACC-001 and TRACE-001. | PATH-001 owns remediation. |
| TRACE-002 | MUST-FR-002 | ACC-002 | ACC-002 E2E-001 | CMD-001 | CMD-001 | none | PATH-002 | none | 编辑周期后预览立即反映新配置。 | MUST-FR-002 closes through ACC-002 and TRACE-002. | PATH-002 owns remediation. |
| TRACE-003 | MUST-FR-003 | ACC-003 | ACC-003 E2E-001 | CMD-001 | CMD-001 | none | PATH-002 | none | 取消后恢复修改前设置且无持久化副作用。 | MUST-FR-003 closes through ACC-003 and TRACE-003. | PATH-002 owns remediation. |
| TRACE-004 | MUST-FR-004 | ACC-004 | ACC-004 E2E-001 | CMD-001 | CMD-001 | none | PATH-003 | none | 保存成功后设置持久化且图表刷新一次。 | MUST-FR-004 closes through ACC-004 and TRACE-004. | PATH-003 owns remediation. |
| TRACE-005 | NEG-001 | ACC-003 ACC-004 | ACC-003 ACC-004 E2E-001 | CMD-001 | CMD-001 | none | PATH-002 PATH-003 | none | 失败时保留先前设置且不显示保存成功。 | NEG-001 closes through negative controls in ACC-003 and ACC-004. | PATH-002 PATH-003 own remediation. |

## Implementation Path Map

| ID | Repository path | Ownership | Required change | Requirement refs | Per-MUST oracle | Assertion source | Responsibility mapping |
| --- | --- | --- | --- | --- | --- | --- | --- |
| PATH-001 | `vnpy/chart/multi_timeframe_widget.py` | Widget owner | Render enabled periods and refresh the chart. | MUST-FR-001 MUST-FR-004 | ACC-001 and ACC-004 pass. | ACC-001 ACC-004 CMD-001 TRACE-001 TRACE-004 | Widget owner owns implementation and rollback. |
| PATH-002 | `vnpy/chart/multi_timeframe_settings_dialog.py` | Dialog owner | Implement preview, cancel, validation, and rollback. | MUST-FR-002 MUST-FR-003 NEG-001 | ACC-002 and ACC-003 pass. | ACC-002 ACC-003 CMD-001 TRACE-002 TRACE-003 TRACE-005 | Dialog owner owns implementation and rollback. |
| PATH-003 | `vnpy/trader/ui/widget.py` | UI owner | Persist accepted settings and trigger one refresh. | MUST-FR-004 NEG-001 | ACC-004 passes without partial writes. | ACC-004 CMD-001 TRACE-004 TRACE-005 | UI owner owns implementation and rollback. |

## Out Of Scope

| ID | Forbidden scope | Boundary assertion | Evidence |
| --- | --- | --- | --- |
| OUT-001 | 本需求不重写交易引擎。 | 保持交易引擎不变。 | ACC-001 |
