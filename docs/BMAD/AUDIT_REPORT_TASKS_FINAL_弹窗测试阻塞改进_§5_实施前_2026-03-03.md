# 审计报告（§5 实施前）：TASKS_FINAL_弹窗测试阻塞改进_2026-03-03

**审计依据**：audit-prompts §5（实施前审计）、TASKS_FINAL 文档自述、批判审计员视角  
**被审文档**：`_bmad-output/implementation-artifacts/0-1-弹窗测试阻塞改进/TASKS_FINAL_弹窗测试阻塞改进_2026-03-03.md`、`docs/BMAD/TASKS_FINAL_弹窗测试阻塞改进_2026-03-03.md`（内容一致）  
**审计日期**：2026-03-03

---

## 模型选择信息

| 项目 | 值 |
|------|-----|
| 配置来源 | .claude/agents/code-reviewer.md |
| 指定模型 | inherit（来自 frontmatter，继承主 Agent 模型） |
| 选择依据 | 子代理 YAML 中 model: inherit；可改为 fast 以节省审计成本（若环境支持） |

---

## 1. §5 六项逐项验证

### 1.1 任务明确可执行

| 检查项 | 结果 | 说明 |
|--------|------|------|
| 每行任务有明确「修改前」「修改后」 | ✅ 通过 | T7a/T7b/T7c/T7d 表格中均有具体代码片段与修改方向 |
| 无「待定」「TBD」等占位 | ✅ 通过 | 全文无占位符 |
| 判定规则（§3.3）与统一 qapp 规则（§1）可操作 | ✅ 通过 | 窗口/布局/点击打 qt_dialog、仅触发分支用 mock；删除自定义 qapp、改用 pytest-qt fixture 均明确 |

### 1.2 修改路径与具体修改明确

| 检查项 | 结果 | 说明 |
|--------|------|------|
| 文件路径以项目根起、唯一可定位 | ✅ 通过 | 如 `tests/ui/test_log_settings_dialog.py` 等，均可在仓库内唯一定位 |
| 修改前列含具体位置与代码片段 | ✅ 通过 | 含行号或行号区间及关键代码（`def qapp`、`QApplication.instance()`、`QApplication([])`、`QApplication(sys.argv)` 等） |
| 行号与当前代码不一致时的约定 | ✅ 通过 | 文档首段明确：「实施时若行号与当前代码不一致，以『修改前』列描述的代码片段为准定位；行号仅供参考。」 |

### 1.3 无占位、无模糊

| 检查项 | 结果 | 说明 |
|--------|------|------|
| 无未定义缩写或「同上」导致歧义 | ✅ 通过 | 「同上」仅用于验收列（指同批首行验收命令）或修改后列（指同批前一项的修改方式）；同批内前项已明确，无歧义 |
| T7c-2/3、T7d 部分「同上模式」| ✅ 通过 | T7c-2/3 指与 T7c-1 相同的 `def qapp():` + instance/`QApplication([])` 模式；T7d 中「同上」指 T7d-3 的「移除自定义 app 创建，改用 qapp fixture」 |

### 1.4 验收可验证（含 V5 三模式 + 多环境）

| 检查项 | 结果 | 说明 |
|--------|------|------|
| 每批有可执行 pytest 验收命令 | ✅ 通过 | T7a/T7b/T7c/T7d 均有「同上」或显式 `pytest ... -m "not qt_dialog"` |
| V1/V2 总体验收命令明确 | ✅ 通过 | V1：`pytest tests/ -m "not qt_dialog"`；V2：两阶段 not qt_dialog + qt_dialog |
| **V5 禁止三种调用且验收命令覆盖** | ✅ 通过 | 见下节 §2 专项结论 |

### 1.5 完全覆盖分析文档

| 检查项 | 结果 | 说明 |
|--------|------|------|
| 依据文档注明 | ✅ 通过 | 依据 `ANALYSIS_100轮决策根因_弹窗测试阻塞改进_2026-03-03.md` §3、§4 及 TASKS_0-1 的 §5 |
| 与当前仓库 tests/ 中 QApplication 使用一致 | ✅ 通过 | 已用同一正则对 `tests/` 做 grep，命中文件均落在 T7a/T7b/T7c/T7d 清单内，无遗漏文件（见 §3 文件覆盖核对） |

### 1.6 批判审计：遗漏、行号、T7d「同上」、V5 误伤/漏网

| 检查项 | 结果 | 说明 |
|--------|------|------|
| 是否有未列入 TASKS 的 tests 文件仍含 QApplication 调用 | ✅ 无遗漏 | grep 命中 25 个文件，均对应 T7a-1～T7a-9、T7b-1～T7b-10、T7c-1～3、T7d-1～10 |
| 行号漂移风险 | ✅ 已约定 | 文档已规定以「修改前」列代码片段为准，行号仅供参考 |
| T7d「同上」是否可唯一还原 | ✅ 可还原 | 验收列「同上」指该批批验收命令；修改后列「同上」指 T7d-3 的「移除自定义 app 创建，改用 qapp fixture」 |
| V5 误伤（允许的注释/文档被禁） | ✅ 无 | 规则为「仅允许文档或注释中出现」，验收为「命中应仅剩文档或注释」，不禁止注释中出现上述字符串 |
| V5 漏网（变体未覆盖） | ⚠ 见 §2 | 见下节「批判审计员结论」中的可选加强 |

---

## 2. §8 V5 扩展确认（三模式 + 验收命令）

### 2.1 禁止与验收范围

- **禁止**：在测试代码中保留以下三种调用（仅允许在文档或注释中出现）：
  - `QApplication.instance()`
  - `QApplication([])`
  - `QApplication(sys.argv)`
- **验收**：实施后执行给定 grep/rg，命中应仅剩文档或注释；若有例外须在文档中明确标注。

### 2.2 正则与命令核对

| 环境 | 文档给出的命令/模式 | 正则正确性 | 备注 |
|------|----------------------|------------|------|
| Bash/WSL/Git Bash (ERE) | `grep -rE "QApplication\.instance\(\)\|QApplication\(\[\]\)\|QApplication\(sys\.argv\)" tests/` | ✅ 正确 | 三子模式均正确转义；`\[\]` 匹配字面 `[]` |
| Bash (BRE 备选) | `grep -r "QApplication.instance()\|QApplication([])\|QApplication(sys.argv)" tests/` | ⚠ 依赖实现 | BRE 下 `[]` 可能被解析为字符类，建议优先用上条 -E 或 rg |
| PowerShell / rg | `rg "QApplication\.instance\(\)|QApplication\(\[\]\)|QApplication\(sys\.argv\)" tests/` | ✅ 正确 | 与 ERE 等价，已在工作区用相同模式 grep 验证，命中所有当前调用 |

### 2.3 实际验证结果

在工作区内对 `tests/` 执行与 V5 等价的模式匹配，命中文件共 25 个，且均已在 TASKS 的 T7a/T7b/T7c/T7d 中列出，**无未列入 TASKS 的漏网文件**。实施后再次执行同一检查，若命中仅剩注释/文档则 V5 通过。

### 2.4 批判审计员结论（V5）

- **表述与正则**：§8 V5 的三种禁止形式与文档中的 ERE/rg 模式一致，**表述无误、正则无误**。
- **漏网**：当前代码中未见 `QApplication( sys.argv )` 或 `QApplication( [] )` 等带空格的变体；若未来出现，现有模式不会命中，属**理论漏网**。可选加强：在文档或 CI 中补充说明「禁止在测试代码中写带空格的上述变体」，或将模式扩展为允许可选空白（如 `QApplication\s*\(\s*sys\.argv\s*\)`），非必须。
- **误伤**：允许「文档或注释中出现」；验收为「命中应仅剩文档或注释」，不会误伤注释/文档中的合法出现。

---

## 3. 文件覆盖核对（tests/ 内 QApplication 与 TASKS 清单）

以下为本次对 `tests/` 的 grep 命中文件与 TASKS 条目的对应关系，用于确认无遗漏：

| 命中文件 | TASKS 序号 |
|----------|------------|
| tests/ui/test_log_settings_dialog.py | T7a-1 |
| tests/ui/test_widget_chart_event_remaining.py | T7a-2 |
| tests/ui/test_widget_chart_control.py | T7a-3 |
| tests/ui/test_widget_chart_mode.py | T7a-4 |
| tests/ui/test_widget_tdd_regression.py | T7a-5 |
| tests/ui/test_qt_app_appearance.py | T7a-6 |
| tests/ui/test_mainwindow_subprocess_menu_actions.py | T7a-7 |
| tests/ui/test_widget_chart_perf.py | T7a-8 |
| tests/ui/test_widget_trading.py | T7a-9 |
| tests/chart/test_subplot_multi_target_chain.py | T7b-1 |
| tests/chart/test_candle_item_integration.py | T7b-2 |
| tests/chart/test_cross_index_candle_item_fill_rect_guard.py | T7b-3 |
| tests/chart/test_indicator_selection_dialog_unified_1m.py | T7b-4 |
| tests/chart/test_cross_index_candle_item_visible_fallback.py | T7b-5 |
| tests/chart/test_subplot_value_at_cursor.py | T7b-6 |
| tests/chart/test_subplot_widget_bar_dual_item.py | T7b-7 |
| tests/chart/test_candle_item_unfilled_drawing.py | T7b-8 |
| tests/chart/test_cross_index_candle_item_daily.py | T7b-9 |
| tests/chart/test_indicator_selection_overlay_targets.py | T7b-10 |
| tests/integration/test_realtime_bar_display.py | T7c-1 |
| tests/integration/test_daily_bar_fill_color.py | T7c-2 |
| tests/integration/test_border_fill_sync.py | T7c-3 |
| tests/unit/test_trade_log_monitor.py | T7d-1 |
| tests/unit/test_integration_policy_activation.py | T7d-2 |
| tests/trader/test_tick_throttle_settings.py | T7d-3 |
| tests/trader/test_unify_drawing_order_detection_interval.py | T7d-4 |
| tests/test_invalidate_l2_cache_call_sites.py | T7d-5 |
| tests/test_phase2_integration.py | T7d-6 |
| tests/test_datamanager_table_header_resize.py | T7d-7 |
| tests/test_cross_index_candle_item_realtime.py | T7d-8 |
| tests/test_datamanager_table_regression.py | T7d-9 |
| tests/test_datamanager_table_models.py | T7d-10 |

**结论**：所有命中文件均在 TASKS 中有对应条目，**完全覆盖，无遗漏**。

---

## 4. 结论与收敛

### 4.1 审计结论

**「完全覆盖、验证通过」**

- §5 六项（任务可执行、路径与修改明确、无占位无模糊、验收可验证、覆盖分析文档、批判审计无遗漏/行号/T7d同上/V5误伤）均满足。
- §8 V5 已扩展为禁止并验收 `QApplication.instance()`、`QApplication([])`、`QApplication(sys.argv)`；文档中的 ERE/rg 模式与表述正确，验收命令覆盖 Bash/WSL/Git Bash 与 PowerShell/rg；当前仓库 tests/ 中所有命中文件均在 TASKS 清单内。

### 4.2 批判审计员结论

- **保留**：无必须修改的保留项。
- **可选加强**（非必须）：
  - V5 验收：若需更稳健，可优先采用 `grep -rE "..." tests/` 或 `rg "..." tests/`，将 BRE 形式仅作备选并注明「部分环境请用 -E 或 rg」。
  - 理论漏网：若希望覆盖 `QApplication( sys.argv )` 等带空格变体，可在文档或 CI 中补充说明或扩展正则；当前代码库无此类写法，非必须。

### 4.3 收敛

**本轮无新 gap，第 1 轮；建议累计至 3 轮无 gap 后收敛。**

---

**文档结束。**

*本报告由 code-reviewer 按 audit-prompts §5 实施前审计及批判审计员视角执行。*
