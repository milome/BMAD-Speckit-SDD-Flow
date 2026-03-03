**原始 artifact 路径**：`_bmad-output/implementation-artifacts/0-1-弹窗测试阻塞改进/TASKS_FINAL_弹窗测试阻塞改进_2026-03-03.md`  
**两份内容一致**；本文档为便于查阅的副本。

---

# 弹窗测试阻塞改进 — 最终任务列表（明确路径与具体修改）

**产出日期**: 2026-03-03  
**依据**: `ANALYSIS_100轮决策根因_弹窗测试阻塞改进_2026-03-03.md` §3、§4；`TASKS_0-1-弹窗测试阻塞改进.md` §5  
**要求**: 修改路径与具体修改内容均明确描述，禁止模糊表述。**实施时若行号与当前代码不一致，以「修改前」列描述的代码片段为准定位；行号仅供参考。**

---

## §1 范围与约定

- **目标**: 完成 T7（审查并统一自定义 qapp）+ 产出「需打 qt_dialog 的用例清单」+ 执行 T8（按清单打标）。
- **判定规则（§3.3）**: 凡需验证**窗口显示、布局、用户点击对话框按钮**的用例打 `qt_dialog`；凡仅触发 QMessageBox/业务逻辑分支的用例一律 **mock**（使用 `mock_message_boxes` 或 mock `dialog.exec()`），不打 qt_dialog。
- **统一 qapp 规则**: 删除模块级 `app = QApplication.instance() or QApplication(...)` 及自定义 `def qapp(...)`；需要 Qt 的测试改为使用 pytest-qt 的 `qtbot` 或 `qapp` fixture（在测试函数参数中注入，或对类使用 `@pytest.mark.usefixtures("qapp")`）。

---

## §2 T7a：tests/ui/ 下文件（逐文件修改）

| 序号 | 文件路径（项目根起） | 修改前（具体位置与代码） | 修改后（具体内容） | 验收 |
|------|----------------------|--------------------------|--------------------|------|
| T7a-1 | `tests/ui/test_log_settings_dialog.py` | 第 11–18 行：`def qapp(qtbot):` 及 `app = QApplication.instance()`、`QApplication([])` 创建逻辑 | 删除整个 `qapp` 函数；所有使用 `qapp` 的测试改为在参数中注入 `qtbot` 或 `qapp`（pytest-qt 提供），或对测试类加 `@pytest.mark.usefixtures("qapp")` | `pytest tests/ui/test_log_settings_dialog.py -v -m "not qt_dialog"` 通过 |
| T7a-2 | `tests/ui/test_widget_chart_event_remaining.py` | 第 22 行：`app = QtWidgets.QApplication.instance()`（模块级）；若该文件另有 `app = QtWidgets.QApplication(sys.argv)` 或同类模块级创建，一并删除 | 删除上述所有模块级 app 创建行；在需要 Qt 的测试中注入 `qapp` 或对模块/类使用 `@pytest.mark.usefixtures("qapp")` | 同上目录 |
| T7a-3 | `tests/ui/test_widget_chart_control.py` | 第 22 行起：模块级 `app = QtWidgets.QApplication.instance()`；若该文件另有 `QApplication(sys.argv)` 或同类模块级创建，一并删除 | 删除上述所有模块级 app 创建，改用 fixture | 同上 |
| T7a-4 | `tests/ui/test_widget_chart_mode.py` | 第 21 行：模块级 `app = QtWidgets.QApplication.instance()` | 同上 | 同上 |
| T7a-5 | `tests/ui/test_widget_tdd_regression.py` | 第 21 行：模块级 `app = QtWidgets.QApplication.instance()` | 同上 | 同上 |
| T7a-6 | `tests/ui/test_qt_app_appearance.py` | 第 14–16 行与第 34–36 行：两处 `app = QtWidgets.QApplication.instance()` 及 `app = QtWidgets.QApplication(...)` | 删除两处模块级 app 创建；测试改为使用 `qapp` fixture | 同上 |
| T7a-7 | `tests/ui/test_mainwindow_subprocess_menu_actions.py` | 第 14–18 行：`def qapp():` 及 `app = QApplication.instance()`、`QApplication([])` | 删除 `qapp` 函数；测试改为注入 `qtbot`/`qapp` | 同上 |
| T7a-8 | `tests/ui/test_widget_chart_perf.py` | 第 26 行：模块级 `app = QtWidgets.QApplication.instance()` | 删除；改用 `qapp` fixture | 同上 |
| T7a-9 | `tests/ui/test_widget_trading.py` | 第 23 行：模块级 `app = QtWidgets.QApplication.instance()` | 删除；改用 `qapp` fixture | 同上 |

**T7a 批验收**: `pytest tests/ui/ -v -m "not qt_dialog"` 全部通过。  
**T7a 产出**: 在 `_bmad-output/implementation-artifacts/0-1-弹窗测试阻塞改进/QT_DIALOG_CASES.md` 中追加本批「需打 qt_dialog」的用例（若无可追加则写「T7a：无」）。

---

## §3 T7b：tests/chart/ 下文件（逐文件修改）

| 序号 | 文件路径（项目根起） | 修改前（具体位置与代码） | 修改后（具体内容） | 验收 |
|------|----------------------|--------------------------|--------------------|------|
| T7b-1 | `tests/chart/test_subplot_multi_target_chain.py` | 第 153 行：`app = QApplication.instance() or QApplication([])`（在测试或 setup 内） | 删除该行；该测试改为注入 `qapp` 或使用 `@pytest.mark.usefixtures("qapp")` | `pytest tests/chart/ -v -m "not qt_dialog"` 通过 |
| T7b-2 | `tests/chart/test_candle_item_integration.py` | 第 40–46 行：`def qapp():` 及 `QtWidgets.QApplication.instance()`、`QApplication([])` | 删除 `qapp` 函数；测试改为使用 pytest-qt 的 `qapp` | 同上 |
| T7b-3 | `tests/chart/test_cross_index_candle_item_fill_rect_guard.py` | 第 17–20 行：`def qapp():` 及 instance/`QApplication([])` | 同上 | 同上 |
| T7b-4 | `tests/chart/test_indicator_selection_dialog_unified_1m.py` | 第 16–19 行：`def qapp():` 及 instance/`QApplication([])` | 同上 | 同上 |
| T7b-5 | `tests/chart/test_cross_index_candle_item_visible_fallback.py` | 第 32–36 行：`def qapp():` 及 `QtWidgets.QApplication.instance() if QtWidgets else None`、`QApplication([])` | 同上 | 同上 |
| T7b-6 | `tests/chart/test_subplot_value_at_cursor.py` | 第 20–24 行：`def qapp():` 及 instance/`QApplication([])` | 同上 | 同上 |
| T7b-7 | `tests/chart/test_subplot_widget_bar_dual_item.py` | 第 19–23 行：`def qapp():` 及 instance/`QApplication([])` | 同上 | 同上 |
| T7b-8 | `tests/chart/test_candle_item_unfilled_drawing.py` | 第 41–47 行：`def qapp():` 及 instance/`QApplication([])` | 同上 | 同上 |
| T7b-9 | `tests/chart/test_cross_index_candle_item_daily.py` | 第 31–35 行：`def qapp():` 及 instance/`QApplication([])` | 同上 | 同上 |
| T7b-10 | `tests/chart/test_indicator_selection_overlay_targets.py` | 第 19–22 行：`def qapp():` 及 instance/`QApplication([])` | 同上 | 同上 |

**T7b 批验收**: `pytest tests/chart/ -v -m "not qt_dialog"` 全部通过。  
**T7b 产出**: 更新 `QT_DIALOG_CASES.md`，追加本批需打 qt_dialog 的用例（若无可追加则写「T7b：无」）。

---

## §4 T7c：tests/integration/ 下文件（逐文件修改）

| 序号 | 文件路径（项目根起） | 修改前（具体位置与代码） | 修改后（具体内容） | 验收 |
|------|----------------------|--------------------------|--------------------|------|
| T7c-1 | `tests/integration/test_realtime_bar_display.py` | 第 31–35 行：`def qapp():` 及 `QtWidgets.QApplication.instance() if QtWidgets else None`、`QApplication([])` | 删除 `qapp` 函数；测试改为使用 pytest-qt 的 `qapp` | `pytest tests/integration/ -v -m "not qt_dialog"` 通过 |
| T7c-2 | `tests/integration/test_daily_bar_fill_color.py` | 第 41–45 行：同上模式 | 同上 | 同上 |
| T7c-3 | `tests/integration/test_border_fill_sync.py` | 第 41–45 行：同上模式 | 同上 | 同上 |

**T7c 批验收**: `pytest tests/integration/ -v -m "not qt_dialog"` 全部通过。  
**T7c 产出**: 更新 `QT_DIALOG_CASES.md`，追加本批需打 qt_dialog 的用例（若无可追加则写「T7c：无」）。

---

## §5 T7d：tests/unit/、tests/trader/、tests/ 根下及其他（逐文件修改）

| 序号 | 文件路径（项目根起） | 修改前（具体位置与代码） | 修改后（具体内容） | 验收 |
|------|----------------------|--------------------------|--------------------|------|
| T7d-1 | `tests/unit/test_trade_log_monitor.py` | 第 16–21 行：`def qapp(qtbot):` 及 `QApplication.instance()`、`QApplication([])` | 删除 `qapp` 函数；测试改为注入 `qtbot`/`qapp` | `pytest tests/unit/ -v -m "not qt_dialog"` 通过 |
| T7d-2 | `tests/unit/test_integration_policy_activation.py` | 第 18–22 行：`def qapp():` 及 instance/`QApplication([])` | 删除 `qapp` 函数；改用 `qapp` fixture | 同上 |
| T7d-3 | `tests/trader/test_tick_throttle_settings.py` | 第 104、123、149、171、190 行：共 5 处 `app = QtWidgets.QApplication.instance() or QtWidgets.QApplication([])`（或类似） | 每处删除或改为在测试中依赖 pytest-qt 的 `qapp`（若在测试函数内则改为使用注入的 `qapp` 或在该测试类/模块使用 `@pytest.mark.usefixtures("qapp")`） | `pytest tests/trader/test_tick_throttle_settings.py -v -m "not qt_dialog"` 通过 |
| T7d-4 | `tests/trader/test_unify_drawing_order_detection_interval.py` | 第 19、32、45 行：3 处 `app = QtWidgets.QApplication.instance() or QtWidgets.QApplication([])` | 同上：移除自定义 app 创建，改用 `qapp` fixture | `pytest tests/trader/test_unify_drawing_order_detection_interval.py -v -m "not qt_dialog"` 通过 |
| T7d-5 | `tests/test_invalidate_l2_cache_call_sites.py` | 第 16 行：模块级 `app = QtWidgets.QApplication.instance()` | 删除；改用 `qapp` fixture | `pytest tests/test_invalidate_l2_cache_call_sites.py -v -m "not qt_dialog"` 通过 |
| T7d-6 | `tests/test_phase2_integration.py` | 第 373 行：`app = QApplication.instance() or QApplication([])`（在测试或 setup 内） | 删除该行；该测试改为注入 `qapp` 或使用 usefixtures | `pytest tests/test_phase2_integration.py -v -m "not qt_dialog"` 通过 |
| T7d-7 | `tests/test_datamanager_table_header_resize.py` | 第 14–19 行：`def qapp():` 及 `if not QtWidgets.QApplication.instance():`、`QApplication([])`、`app = QtWidgets.QApplication.instance()` | 删除 `qapp` 函数；测试改为使用 `qapp` fixture | `pytest tests/test_datamanager_table_header_resize.py -v -m "not qt_dialog"` 通过 |
| T7d-8 | `tests/test_cross_index_candle_item_realtime.py` | 第 41–44 行：`def qapp():` 及 `app = QtWidgets.QApplication.instance()`（及可能存在的 `QApplication([])`） | 同上 | `pytest tests/test_cross_index_candle_item_realtime.py -v -m "not qt_dialog"` 通过 |
| T7d-9 | `tests/test_datamanager_table_regression.py` | 第 41–46 行：`def qapp():` 及 `if not QtWidgets.QApplication.instance():`、`QApplication([])`、`app = QtWidgets.QApplication.instance()` | 同上 | `pytest tests/test_datamanager_table_regression.py -v -m "not qt_dialog"` 通过 |
| T7d-10 | `tests/test_datamanager_table_models.py` | 第 49–55 行：`def qapp():` 及 `if not QtWidgets.QApplication.instance():`、`QApplication([])`、`app = QtWidgets.QApplication.instance()` | 同上 | `pytest tests/test_datamanager_table_models.py -v -m "not qt_dialog"` 通过 |

**T7d 批验收**: `pytest tests/unit/ tests/trader/ tests/test_invalidate_l2_cache_call_sites.py tests/test_phase2_integration.py tests/test_datamanager_table_header_resize.py tests/test_cross_index_candle_item_realtime.py tests/test_datamanager_table_regression.py tests/test_datamanager_table_models.py -v -m "not qt_dialog"` 全部通过。  
**T7d 产出**: 更新 `QT_DIALOG_CASES.md`，追加本批需打 qt_dialog 的用例（若无可追加则写「T7d：无」）。

---

## §6 清单产出物：路径与格式

- **路径**: `_bmad-output/implementation-artifacts/0-1-弹窗测试阻塞改进/QT_DIALOG_CASES.md`
- **格式**: Markdown 表格或列表，每行一条「需打 qt_dialog」的用例，包含：文件路径、测试函数名（或类名.方法名）、判定理由（符合 §3.3：验证窗口显示/布局/对话框按钮点击）。若某批无此类用例，则写「T7x：无」。
- **更新时机**: 每完成 T7a、T7b、T7c、T7d 中一批即更新该文件；T7 全部完成后清单冻结，供 T8 使用。

---

## §7 T8：按清单打 qt_dialog 标记

- **输入**: §6 的 `QT_DIALOG_CASES.md` 冻结清单。
- **操作**: 对清单中列出的每个用例，在其测试函数或测试类上添加 `@pytest.mark.qt_dialog`。若清单为空（或仅含「T7a：无」等），则 T8 无代码修改，仅在 artifact 中记录「T8 无操作，qt_dialog 集以清单为准」。
- **验收**: `pytest tests/ -m "not qt_dialog"` 不包含上述用例；`pytest tests/ -m qt_dialog` 可运行且仅包含上述用例（或 0 个若清单为空）。

---

## §8 总体验收与可选任务

- **V1**: `pytest tests/ -m "not qt_dialog"` 可完整跑完，无阻塞、无 access violation。
- **V2**: 本地有显示器下执行两阶段：`pytest tests/ -m "not qt_dialog"` 与 `pytest tests/ -m qt_dialog`，均通过。
- **V5**: 全仓库 `tests/` 下不得在测试代码中保留 `QApplication.instance()`、`QApplication([])` 或 `QApplication(sys.argv)` 的调用，仅允许文档或注释中出现。验收方式：在 **Bash / WSL / Git Bash** 下执行 `grep -rE "QApplication\.instance\(\)|QApplication\(\[\]\)|QApplication\(sys\.argv\)" tests/`（或 `grep -r "QApplication.instance()\|QApplication([])\|QApplication(sys.argv)" tests/`），命中应仅剩文档或注释；在 **PowerShell** 下可使用 `rg "QApplication\.instance\(\)|QApplication\(\[\]\)|QApplication\(sys\.argv\)" tests/` 或等价命令做同样检查。若有例外须在文档中明确标注。
- **可选**: CI 增加可选 job 或 workflow_dispatch，运行两阶段命令；CI 或 pre-commit 增加检查禁止在 `tests/` 下新增模块级/自定义 QApplication（见 ANALYSIS §3.2）。

---

**文档结束**
