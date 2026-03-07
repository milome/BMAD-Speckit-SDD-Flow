# resultCode 证据表（T11 验收产出）

| 场景 | resultCode | 说明 | 文档落点 |
|------|------------|------|----------|
| **成功** | （无特殊码，正常返回） | parseAndWriteScore 调用成功，评分写入存储 | speckit-workflow §1.2-5.2、bmad-story-assistant §2.2/§4 |
| **输入非法** | SCORE_WRITE_INPUT_INVALID | scenario=eval_question 时缺 question_version，不调用 | 各触发子段：eval_question 缺 question_version 则记 SCORE_WRITE_INPUT_INVALID 且不调用 |
| **调用异常** | SCORE_WRITE_CALL_EXCEPTION | parseAndWriteScore 调用抛出异常 | bmad-story-assistant §4 通过（A/B级）分支 |
| **配置跳过** | （不调用） | scoring_write_control.enabled=false 或 branch_id 未配置 | 各触发子段：若 enabled 为 true 才调用；config/scoring-trigger-modes.yaml 控制 |
