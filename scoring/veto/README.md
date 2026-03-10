# scoring/veto — 一票否决与阶梯模块

Story 4.1 产出；与 Story 3.2、4.2 衔接。

## 导出

- `applyTierAndVeto(record, options?)` — 先判定 veto，若触发则 phase_score=0；否则应用阶梯系数
- `evaluateEpicVeto(input, options?)` — Epic 8 项条件判定
- `getTierCoefficient(record, options?)` — 阶梯系数
- `isVetoTriggered(checkItems, vetoItemIds)` — 环节级 veto 判定
- `buildVetoItemIds(options?)` — 从 loadPhaseScoringYaml、loadGapsScoringYaml 构建 veto 集合

## 入参 / 出参

### applyTierAndVeto

**入参**：`RunScoreRecord & { raw_phase_score?: number }`；`raw_phase_score` 未传入时用 `phase_score` 作基数。

**出参**：`{ phase_score, veto_triggered, tier_coefficient }`

### evaluateEpicVeto

**入参**：`EpicVetoInput`（storyRecords、epicStoryCount、passedStoryCount?、testStats?）

**出参**：`{ triggered: boolean, triggeredConditions: string[] }`

## 与 Story 3.2 衔接

RunScoreRecord 的 check_items 可含 veto 类 item_id（与 config veto_items 键名一致）；解析器产出后由本模块判定。

## 与 Story 4.2 衔接

教练可调用 `applyTierAndVeto`、`evaluateEpicVeto` 决定 `iteration_passed`。
