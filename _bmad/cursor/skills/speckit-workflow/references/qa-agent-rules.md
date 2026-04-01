# Agent 执行规则（QA_Agent 任务执行最佳实践 §396–416）

生成 plan.md / tasks.md 时必须遵守以下规则。

## 禁止事项

1. ❌ 禁止在任务描述中添加「注: 将在后续迭代...」
2. ❌ 禁止标记任务完成但功能未实际调用
3. ❌ 禁止仅初始化对象而不在关键路径中使用
4. ❌ 禁止用「预留」「占位」等词规避实现
5. ❌ 禁止把任务按 frontend / backend / db 模块先行拆分，却没有形成 `Journey ID` 对应的 runnable slice
6. ❌ 禁止出现“模块完成但 journey 仍不可跑”的孤岛模块任务
7. ❌ 禁止缺少 closure note 就宣称 P0 journey 完成
8. ❌ 禁止把 definition gap 与 implementation gap 混写后直接标记通过

## 必须事项

1. ✅ 集成任务必须修改生产代码路径
2. ✅ 必须运行验证命令确认功能启用
3. ✅ 遇到无法完成的情况，应报告阻塞而非自行延迟
4. ✅ 功能/配置/UI 相关任务实施前必须先检索并阅读需求文档相关章节（见 §9 需求追溯与闭环）
5. ✅ 需求追溯（实施前必填）
6. ✅ 每个 setup / foundational / implementation 任务必须显式挂接 `Journey ID`
7. ✅ 每个 runnable slice 必须写明 `Evidence Type`、`Verification Command`、`Closure Note Path`
8. ✅ 若变更触及 P0 completion semantics / dependency semantics / permission boundaries，必须触发 `re-readiness`
9. ✅ 交付与 handoff 中必须明确区分 `definition gap` 与 `implementation gap`

- **问题关键词**: （如 DuckDB、全局配置、vt_setting）
- **检索范围**: specs/ 下需求文档、设计文档
- **相关章节**: （如 《指标系统重构需求分析文档_v1.md》§27.5.8.9–27.5.8.11）
- **既有约定摘要**: （如 四键、BacktestDuckDBSettingsWidget、GlobalSettingDialog 集成方式）
- **方案是否与需求一致**: 是 / 否（若否，说明原因及是否更新需求）
