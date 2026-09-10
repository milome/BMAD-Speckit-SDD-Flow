# Goal Execution Contract

<!-- goal-slot:frontMatter required dynamic=frontMatter -->
---
goalContractVersion: goal-execution-contract/v1
goalContractProfileVersion: 3.1.0
goalContractProfileHash: sha256:ae347a66cd7e0c6ae62a866ff154e18300f1111dddfaa2bdbdf6f27d2a980ca7
entryScenario: standalone_goal_contract
finalArtifactAuthority: goal_active_execution_authority_tuple
contractMode: frozen
rewritePolicy: forbidden
executionMode: execute_only
sourcePlanPath: D:/Dev/BMAD-Speckit-SDD-Flow/packages/bmad-speckit/tests/fixtures/standalone-goal/canonical-source-plan-v1-full.md
sourcePlanHash: sha256:d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a
sourceBytes: 2579033
sourceLines: 81999
coverageReceiptPath: D:/Dev/BMAD-Speckit-SDD-Flow/packages/bmad-speckit/tests/fixtures/standalone-goal/.canonical-source-plan-v1-full-draft-goal-execution-plan.coverage.json
generationReceiptPath: D:/Dev/BMAD-Speckit-SDD-Flow/packages/bmad-speckit/tests/fixtures/standalone-goal/.canonical-source-plan-v1-full-draft-goal-execution-plan.generation.json
unmappedSourceObligations: 0
sourceCompositionPolicyHash: sha256:58378ca820d8bfe58d3279b698a4375190fd5153ac62b6fef7bc1156e6bf616d
orderedSourceSnapshotSetHash: sha256:b052cf07d17708d0874b48811591884a4ab6f031a0816e17ca0e8971ecf7a0fa
sourceAuthorityBundleHash: sha256:bacd63f90db61e7ae2ccf46c281d07bcc724919da0d4907e46248f8b7fe9644e
canonicalIntentSemanticHash: sha256:137b4b4d2da050f74c7145cac81e46bb02ce8f8640051a64de7c2ff5cd2c9413
canonicalIntentBundleHash: sha256:6d126ba01029c3f1b1cb025a265dc1e0f01eb479fb9b106a1b5285acd1c9b65e
authorityAttestationHash: sha256:d657ba06c66d9c9de6f1d7171c689208fdf023b3ae4ec7437a3bcbbc167fbec9
goalContractSemanticHash: sha256:24dac2101c691769ea1fabfa8c3c239d581a40dea229bf159037edf576c09958
goalContractHash: sha256:db508d2e9a0d82c2a5ff1af69356a28d7459f07ebd96bfdba6271f02ecdde8c3
runtimeRecordId: GOAL-CONTRACT-db508d2e9a0d82c2a5ff1af69356a28d7459f07ebd96bfdba6271f02ecdde8c3
entryFlow: goal_contract_generate
projectionMode: semantic
taskRange: TASK-DATASERVICE-001..TASK-DATASERVICE-016
acceptanceRange: AC-DATASERVICE-001-S01..AC-DATASERVICE-024-S03
completionGate: all_acceptance_items_and_required_commands_pass
repairPolicy: execute_declared_tasks_only_and_stop_on_scope_or_semantic_gap
stopPolicy: stop_on_contract_gap_scope_expansion_source_coverage_gap_or_hash_mismatch
generatedBy: bmad-speckit goal-contract generate
generatedAt: 1970-01-01T00:00:00.000Z
---
<!-- /goal-slot:frontMatter -->

> **For Codex /goal:** REQUIRED EXECUTION MODE: Use this file as the authoritative frozen `/goal` source. Execute task-by-task, keep fresh verification evidence, run the regression tests associated with every changed file, and do not claim completion until every strict acceptance item and associated regression test passes.
> **For Claude /goal:** REQUIRED EXECUTION MODE: Use this file as the authoritative frozen `/goal` source. Execute task-by-task, keep fresh verification evidence, run the regression tests associated with every changed file, and do not claim completion until every strict acceptance item and associated regression test passes.
> **For Cursor /goal:** REQUIRED EXECUTION MODE: Use this file as the authoritative frozen `/goal` source. Execute task-by-task, keep fresh verification evidence, run the regression tests associated with every changed file, and do not claim completion until every strict acceptance item and associated regression test passes.

The Markdown template is the human canonical contract source. The JSON profile is a machine-readable index and compatibility contract. The shared renderer may fill only declared slots and must preserve static prose outside slot boundaries.

---

## /goal Entry

Use this short command. The command is intentionally only a pointer so it stays below command-length limits.

<!-- goal-slot:goalEntry required dynamic=goalEntry -->
```text
/goal D:/Dev/BMAD-Speckit-SDD-Flow/packages/bmad-speckit/tests/fixtures/standalone-goal/canonical-source-plan-v1-full-draft-goal-execution-plan.md
```
<!-- /goal-slot:goalEntry -->

The full execution contract is this document, not the command text.

## Contract Freeze Rules

- `/goal` must not rewrite this contract.
- `/goal` must not replace this contract with a different task list, acceptance matrix, completion gate, authority model.
- `/goal` must not convert this template into a JSON-generates-Markdown design.
- `/goal` must not convert a consumer compiler into a hardcoded local Markdown string that bypasses shared template slots.
- If this contract is incomplete, `/goal` must stop with `contract_amendment_required` and list the missing fields.
- If acceptance criteria are insufficient, `/goal` must stop with `contract_amendment_required`; it must not silently add stricter acceptance criteria while executing.
- If a task requires files outside its declared write scope, `/goal` must stop with `scope_amendment_required` unless this contract explicitly allows scope expansion.
- If a requirement semantic decision is missing, `/goal` must stop with `semantic_decision_required`.
- If a validation command is unavailable, ambiguous, and not produced by a declared earlier task and not produced by the current task in this contract, `/goal` must stop with `validation_contract_required`.

## Contract Completeness Gate

Before editing files, verify this contract has all required sections:

- `/goal Entry`
- `Contract Freeze Rules`
- `Contract Completeness Gate`
- `Non-Negotiable Execution Rules`
- `Authority Model`
- `Root Cause To Fix`
- `Domain-Specific Contract Addenda`
- `Implementation Tasks`
- `Strict Acceptance Checklist`
- `Acceptance Traceability Matrix`
- `Source Coverage Matrix`
- `Required Test Commands`
- `Manual Verification Scenarios`
- `Completion Evidence Packet`
- `Stop Conditions`

Before editing files, verify the frozen front matter has no unresolved placeholders and that every required slot was rendered.

Source-plan contracts require front matter fields `sourcePlanHash`, `coverageReceiptPath`, and `unmappedSourceObligations: 0`.

Fail closed when any required section, field, task ID, acceptance ID, evidence command, matrix row, slot, invariant fragment is missing.

## Non-Negotiable Execution Rules

- Use the shell required by the host environment and repository rules.
- Use `apply_patch` for manual code and documentation edits.
- Run the project encoding gate before and after Markdown, JSON, skill, command, generated-surface edits when the repository provides one.
- Inspect `git status --short` before editing and do not revert unrelated dirty worktree changes.
- Do not mark a task complete without fresh command output and direct file evidence.
- Do not mark an acceptance item complete without evidence that directly proves that item.
- Run the regression tests associated with every changed file and keep fresh passing evidence before claiming completion.
- Do not claim completion from generated prompts, generated goal documents, audit receipts, stdout, exit code, dashboards, score records, audit prose alone.
- Do not weaken the declared authority model, machine-readable source bindings, or machine-readable evidence indexes.
- Do not hardcode absolute skill install paths into generated templates, profile files, compiler output, tests.

## Authority Model

<!-- goal-slot:authorityModel required dynamic=authorityModel -->
- `D:/Dev/BMAD-Speckit-SDD-Flow/packages/bmad-speckit/tests/fixtures/standalone-goal/canonical-source-plan-v1-full-draft-goal-execution-plan.md` is the compatibility Markdown projection for this generated goal contract.
- `D:/Dev/BMAD-Speckit-SDD-Flow/packages/bmad-speckit/tests/fixtures/standalone-goal/canonical-source-plan-v1-full-draft-goal-execution-plan.md.authority/goal/active-authority.json` selects the frozen Goal Execution IR and binding tuple.
- `D:/Dev/BMAD-Speckit-SDD-Flow/packages/bmad-speckit/tests/fixtures/standalone-goal/canonical-source-plan-v1-full.md` is the semantic input for StandaloneGoalSemanticIR/v2.
- `sourcePlanHash=sha256:d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a` binds this contract to source bytes.
- `entryScenario=standalone_goal_contract` selects the standalone authority profile.
- `finalArtifactAuthority=goal_active_execution_authority_tuple` binds execution authority to the active tuple.
- The standalone Markdown contract is a GoalExecutionIR projection and cannot create or repair semantics.
- `GoalExecutionIR/v2 is the shared deterministic execution compilation` for both standalone and requirements-backed profiles.
- `model_packet.json is the machine-readable execution authority` only for the two four-artifact compilation entries.
- `goal_execution.md is not execution authority`; the active GoalExecutionIR tuple is the execution source for this goal.
- `/goal completion is not closeout proof`; completion requires command evidence and receipt evidence.
<!-- /goal-slot:authorityModel -->

## Root Cause To Fix

<!-- goal-slot:rootCause required dynamic=rootCause -->
Source-backed role, modality, conditions and declared references govern the execution projection.
<!-- /goal-slot:rootCause -->

## Domain-Specific Contract Addenda

Use this section to bind any domain-specific classifier, state machine, schema, controlled writer, prompt/compiler output, renderer/report surface, gate, audit, score, additional machine contract.

<!-- goal-slot:domainAddenda required dynamic=domainAddenda -->
#### REQ-DATASERVICE-001

> 本文件是本次 dataservice 修复的唯一 source plan

- Source: `REQ-DATASERVICE-001`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:769b1971e04ae3eecde79ef6c17c24ba9f6136db9d7c8aceccb3448ff36ac876`.
- Provenance: `SPAN-7806B9EC4CCEE63C`; clauses: `B0007:C1, B0007:C2, B0009:C1, B0009:C2, B0011:C1, B0012:C1, B0013:C1, B0014:C1, B0015:C1, B0016:C1, B0017:C1, B0019:C1, B0019:C2, B0073:C1, B0075:C1, B0076:C1, B0077:C1, B0078:C1, B0079:C1, B0080:C1, B0096:C1, B0108:C1, B0112:C1, B0114:C1, B0115:C1, B0116:C1, B0116:C2, B0117:C1, B0118:C1, B0119:C1, B0120:C1, B0121:C1, B0121:C2, B0122:C1, B0122:C2, B0123:C1, B0123:C2, B0124:C1, B0125:C1, B0125:C2, B0125:C3, B0126:C1, B0126:C2, B0142:C1, B0142:C2, B0143:C1, B0143:C2, B0144:C1, B0144:C2, B0145:C1, B0145:C2, B0146:C1, B0146:C2, B0147:C1, B0147:C2, B0148:C1, B0148:C2, B0149:C1, B0149:C2, B0150:C1, B0150:C2, B0151:C1, B0151:C2, B0152:C1, B0152:C2, B0187:C1, B0188:C1, B0189:C1, B0190:C1, B0191:C1, B0192:C1, B0193:C1, B0194:C1, B0194:C2, B0195:C1, B0196:C1, B0200:C1, B0200:C2, B0202:C1, B0840:C1, B0840:C2, B0840:C3, B0981:C1, B0983:C1, B1039:C1, B1041:C1, B1298:C1, B1298:C2, B1300:C1, B1301:C1, B1302:C1, B1302:C2, B1303:C1, B1304:C1, B1305:C1, B1306:C1, B1307:C1, B1308:C1, B1308:C2, B1309:C1, B1309:C2, B1309:C3, B1309:C4, B1309:C5, B1310:C1, B1311:C1, B1311:C2, B1312:C1, B1313:C1, B1313:C2, B1313:C3, B1773:C1, B1773:C2, B1773:C3, B1777:C1, B1777:C2, B1778:C1, B1778:C2, B1779:C1, B1779:C2, B1780:C1, B1780:C2, B1781:C1, B1781:C2, B1782:C1, B1782:C2, B1783:C1, B1783:C2, B1784:C1, B1784:C2, B1785:C1, B1785:C2, B1786:C1, B1786:C2, B1787:C1, B1787:C2, B1788:C1, B1788:C2, B1789:C1, B1789:C2, B1789:C3, B1790:C1, B1790:C2, B1791:C1, B1791:C2, B1791:C3, B1792:C1, B1792:C2, B1793:C1, B1793:C2, B1794:C1, B1794:C2, B1794:C3, B1795:C1, B1795:C2, B1796:C1, B1796:C2, B1797:C1, B1797:C2, B1797:C3, B1798:C1, B1798:C2, B1798:C3, B1799:C1, B1799:C2, B1799:C3, B1800:C1, B1800:C2, B1800:C3, B2088:C1, B2458:C1, B2459:C1, B2460:C1, B2461:C1, B2462:C1, B2463:C1, B2464:C1, B2465:C1, B2466:C1, B2467:C1, B2468:C1, B2469:C1, B2470:C1, B2471:C1, B2472:C1, B2473:C1, B2474:C1, B2475:C1, B2476:C1, B2477:C1, B2478:C1, B2479:C1, B2480:C1, B2481:C1, B2482:C1, B2483:C1, B2484:C1, B2485:C1, B2486:C1`.

#### REQ-DATASERVICE-002

> 图表和指标首次加载时以 db 中 datetime_end none 的历史 bar 为基线

- Source: `REQ-DATASERVICE-002`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:aba85d094116a2f25d38da76d9063d76714317cd6bfc120c519c46aea9d527e9`.
- Provenance: `SPAN-901ECD1D36FA84B0`; clauses: `B0208:C1, B0209:C1, B0210:C1, B0211:C1, B0215:C1, B0216:C1, B0217:C1, B0221:C1, B0222:C1, B0223:C1, B0224:C1, B0225:C1, B0225:C2, B0225:C3, B0229:C1, B0230:C1, B0231:C1, B0232:C1, B0233:C1, B0237:C1, B0237:C2, B0238:C1, B0238:C2, B0239:C1, B0239:C2, B0240:C1`.

#### REQ-DATASERVICE-003

> db 中已经存在的历史 bar 继续显示

- Source: `REQ-DATASERVICE-003`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:0ce5869c20df10e6e173adb7a23ed18779dd630ccb04f724d4f100a31d343db1`.
- Provenance: `SPAN-54E68F629CFB9561`; clauses: `B0246:C1, B0246:C2, B0247:C1, B0248:C1, B0252:C1, B0253:C1, B0254:C1, B0258:C1, B0259:C1, B0260:C1, B0261:C1, B0261:C2, B0265:C1, B0266:C1, B0267:C1, B0268:C1, B0268:C2, B0269:C1, B0273:C1, B0273:C2, B0274:C1, B0275:C1`.

#### REQ-DATASERVICE-004

> 用户启动后首先由 datamanager 检测历史数据缺口并补齐

- Source: `REQ-DATASERVICE-004`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:4ec8bbfd8d98c55409a1e690172c09550947de937c515d825dd5e169f06767c1`.
- Provenance: `SPAN-FAC68090AE63B6CC`; clauses: `B0281:C1, B0282:C1, B0283:C1, B0287:C1, B0288:C1, B0289:C1, B0293:C1, B0294:C1, B0295:C1, B0295:C2, B0299:C1, B0300:C1, B0300:C2, B0301:C1, B0302:C1, B0303:C1, B0307:C1, B0307:C2, B0308:C1, B0309:C1`.

#### REQ-DATASERVICE-005

> datamanager 的历史下载是明确 request/response 行为 调用完成后取得 bar 列表或明确错误

- Source: `REQ-DATASERVICE-005`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:36bbb4530dc3d36b3ecbe3e86c7015f864852fd68aa8b70d00eaa4ca5bea62c5`.
- Provenance: `SPAN-29B1078DEE91966B`; clauses: `B0315:C1, B0316:C1, B0320:C1, B0321:C1, B0322:C1, B0326:C1, B0327:C1, B0328:C1, B0329:C1, B0329:C2, B0333:C1, B0334:C1, B0334:C2, B0335:C1, B0336:C1, B0336:C2, B0337:C1, B0337:C2, B0338:C1, B0338:C2, B0339:C1, B0339:C2, B0340:C1, B0340:C2, B0344:C1, B0344:C2, B0345:C1, B0345:C2, B0346:C1, B0346:C2, B0347:C1`.

#### REQ-DATASERVICE-006

> 用户验证的是 打开程序 补数据 加载图表 实时变化 写库 切换和交易回调 完整行为

- Source: `REQ-DATASERVICE-006`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:a6ead918313f0eaa9a07c29e1502045f6cda90bd82f3a39bb585cc9cf8739ea9`.
- Provenance: `SPAN-12D6F9F1B15C53AF`; clauses: `B0353:C1, B0354:C1, B0358:C1, B0359:C1, B0360:C1, B0364:C1, B0365:C1, B0366:C1, B0370:C1, B0371:C1, B0372:C1, B0372:C2, B0373:C1, B0373:C2, B0374:C1, B0375:C1, B0375:C2, B0379:C1, B0380:C1, B0381:C1`.

#### REQ-DATASERVICE-007

> 历史权威来自 db completed bars

- Source: `REQ-DATASERVICE-007`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:0334f65a010cd036d03819c382332c046c81a9b9002177f2c53b4810dfb20269`.
- Provenance: `SPAN-B11E94CF828941A8`; clauses: `B0387:C1, B0388:C1, B0389:C1, B0393:C1, B0394:C1, B0395:C1, B0399:C1, B0400:C1, B0401:C1, B0401:C2, B0405:C1, B0405:C2, B0406:C1, B0406:C2, B0407:C1, B0408:C1, B0408:C2, B0412:C1, B0413:C1, B0414:C1`.

#### REQ-DATASERVICE-008

> datarecorder 的业务目标是 completed bar 最终落库且不重复

- Source: `REQ-DATASERVICE-008`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:e137f4e7e6e09f9fbdd59930046b084d9df2b9fd170dfcd7492844ef5c1255d9`.
- Provenance: `SPAN-B88D75CD467595A8`; clauses: `B0420:C1, B0421:C1, B0425:C1, B0426:C1, B0427:C1, B0431:C1, B0432:C1, B0433:C1, B0437:C1, B0438:C1, B0439:C1, B0440:C1, B0444:C1, B0445:C1, B0446:C1`.

#### REQ-DATASERVICE-009

> futu process_quote 更新成交 价格 累计量等字段并调用 on_tick copy tick

- Source: `REQ-DATASERVICE-009`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:c9103a3e464a17b9e9c29355c62d442537a15649eaf1f8ce1b54a945947914a2`.
- Provenance: `SPAN-3DD0C890CA588A05`; clauses: `B0452:C1, B0453:C1, B0454:C1, B0454:C2, B0458:C1, B0459:C1, B0460:C1, B0464:C1, B0464:C2, B0465:C1, B0466:C1, B0466:C2, B0467:C1, B0471:C1, B0472:C1, B0473:C1, B0473:C2, B0474:C1, B0474:C2, B0478:C1, B0478:C2, B0479:C1, B0479:C2, B0480:C1`.

#### REQ-DATASERVICE-010

> 用户进入程序后由 datamanager 检测和补齐 db 历史

- Source: `REQ-DATASERVICE-010`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:85ee84b995e02bbcfc35cc583220b0d94bd1e62af080e9f1c056ac4e8fddfc48`.
- Provenance: `SPAN-21B33B4922325049`; clauses: `B0486:C1, B0487:C1, B0488:C1, B0488:C2, B0492:C1, B0493:C1, B0494:C1, B0498:C1, B0499:C1, B0500:C1, B0501:C1, B0501:C2, B0502:C1, B0503:C1, B0503:C2, B0507:C1, B0508:C1, B0509:C1, B0510:C1, B0510:C2, B0511:C1, B0512:C1, B0512:C2, B0516:C1, B0516:C2, B0517:C1, B0517:C2, B0518:C1`.

#### REQ-DATASERVICE-011

> 进程能启动 行情合约已订阅 一次历史查询已完成是三个不同事实

- Source: `REQ-DATASERVICE-011`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:7df29fe2669d894fbb717358bbcc6abef493dade9738b0af7ae021681ceeef5b`.
- Provenance: `SPAN-4A95F4B9DA79E1BA`; clauses: `B0524:C1, B0525:C1, B0526:C1, B0526:C2, B0530:C1, B0531:C1, B0532:C1, B0536:C1, B0537:C1, B0538:C1, B0538:C2, B0539:C1, B0539:C2, B0543:C1, B0544:C1, B0545:C1, B0545:C2, B0546:C1, B0547:C1, B0551:C1, B0551:C2, B0551:C3, B0552:C1, B0552:C2, B0553:C1`.

#### REQ-DATASERVICE-012

> 高频 tick 适合共享内存 历史/图表数组适合共享数据区 控制命令和低频状态适合 queue

- Source: `REQ-DATASERVICE-012`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:ce2529d0f34570775b1a8a639b2570d963c84f99ae576bf50513b36268076075`.
- Provenance: `SPAN-10AA8A8D194C2701`; clauses: `B0559:C1, B0560:C1, B0561:C1, B0565:C1, B0566:C1, B0567:C1, B0571:C1, B0572:C1, B0573:C1, B0574:C1, B0575:C1, B0576:C1, B0576:C2, B0577:C1, B0581:C1, B0582:C1, B0582:C2, B0583:C1, B0583:C2, B0584:C1, B0584:C2, B0585:C1, B0586:C1, B0586:C2, B0586:C3, B0590:C1, B0591:C1, B0592:C1, B0592:C2, B0593:C1, B0593:C2`.

#### REQ-DATASERVICE-013

> data_recorder_setting.json 保存 tick_recordings bar_recordings 每合约 intervals recording_paused 和过滤设置

- Source: `REQ-DATASERVICE-013`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:942d5c308b97d84e3d46471c9f9005d5c2a5b932f4c58b31943117c56f1a79d7`.
- Provenance: `SPAN-78939AA0B2034E8E`; clauses: `B0599:C1, B0600:C1, B0601:C1, B0605:C1, B0606:C1, B0607:C1, B0611:C1, B0612:C1, B0612:C2, B0613:C1, B0614:C1, B0615:C1, B0615:C2, B0619:C1, B0620:C1, B0621:C1, B0622:C1, B0622:C2, B0623:C1, B0624:C1, B0628:C1, B0628:C2, B0629:C1, B0630:C1`.

#### REQ-DATASERVICE-014

> process_tick_event/update_tick 在事件处理时检查 recording_paused 和 recording dict

- Source: `REQ-DATASERVICE-014`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:07dab1ad0392d90d8c0844aaf565d80719a191eb2ad29e2ca38c875aa459cbab`.
- Provenance: `SPAN-6F85B60698B4B020`; clauses: `B0636:C1, B0637:C1, B0638:C1, B0638:C2, B0642:C1, B0643:C1, B0644:C1, B0648:C1, B0649:C1, B0650:C1, B0651:C1, B0651:C2, B0652:C1, B0652:C2, B0656:C1, B0657:C1, B0658:C1, B0659:C1, B0663:C1, B0663:C2, B0664:C1, B0664:C2, B0665:C1, B0665:C2`.

#### REQ-DATASERVICE-015

> tick进入 self.ticks 1m completed进入 self.bars 由默认10秒 timer_interval 批量送往进程内 queue.queue 和db writer

- Source: `REQ-DATASERVICE-015`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:318f3121de1aade554ec7fc2ea18eac41f3e4810cdfee81df281d2f5d376c14d`.
- Provenance: `SPAN-4E00FC5F73A83FC8`; clauses: `B0671:C1, B0672:C1, B0673:C1, B0674:C1, B0678:C1, B0679:C1, B0680:C1, B0681:C1, B0685:C1, B0685:C2, B0685:C3, B0686:C1, B0687:C1, B0687:C2, B0688:C1, B0689:C1, B0693:C1, B0694:C1, B0694:C2, B0694:C3, B0695:C1, B0695:C2, B0696:C1, B0696:C2, B0697:C1, B0697:C2, B0698:C1, B0698:C2, B0699:C1, B0700:C1, B0701:C1, B0701:C2, B0701:C3, B0702:C1, B0702:C2, B0706:C1, B0706:C2, B0707:C1, B0708:C1, B0708:C2, B0709:C1, B0709:C2`.

#### REQ-DATASERVICE-016

> mhimain.hkfe 是用户 db recorder 图表和指标使用的logical/canonical identity

- Source: `REQ-DATASERVICE-016`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:861b9daa324c4461ae522cc6a76564860877e8ec012eac6a1c3410fd390d14fc`.
- Provenance: `SPAN-9D7C1C868A56379F`; clauses: `B0715:C1, B0716:C1, B0717:C1, B0718:C1, B0722:C1, B0723:C1, B0724:C1, B0728:C1, B0728:C2, B0729:C1, B0730:C1, B0731:C1, B0732:C1, B0736:C1, B0737:C1, B0737:C2, B0737:C3, B0738:C1, B0738:C2, B0739:C1, B0740:C1, B0741:C1, B0741:C2, B0745:C1, B0745:C2, B0746:C1, B0747:C1, B0748:C1, B0748:C2`.

#### REQ-DATASERVICE-017

> cta策略通过自己的tick处理链调用 strategy.on_tick 再由策略私有bargenerator调用 on_bar/on_window_bar

- Source: `REQ-DATASERVICE-017`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:157eeac82371879802502516ae792e09a9528dff96edee899127935473dd0ecd`.
- Provenance: `SPAN-1E23E0502A26AACF`; clauses: `B0754:C1, B0755:C1, B0756:C1, B0757:C1, B0757:C2, B0761:C1, B0762:C1, B0763:C1, B0764:C1, B0768:C1, B0768:C2, B0769:C1, B0769:C2, B0770:C1, B0770:C2, B0771:C1, B0772:C1, B0772:C2, B0776:C1, B0777:C1, B0777:C2, B0778:C1, B0778:C2, B0779:C1, B0779:C2, B0779:C3, B0780:C1, B0780:C2, B0780:C3, B0781:C1, B0781:C2, B0781:C3, B0782:C1, B0782:C2, B0783:C1, B0784:C1, B0784:C2, B0785:C1, B0785:C2, B0789:C1, B0790:C1, B0790:C2, B0791:C1, B0791:C2, B0792:C1, B0793:C1, B0793:C2, B0794:C1, B0794:C2, B0795:C1, B0795:C2, B0795:C3`.

#### REQ-DATASERVICE-018

> worker接收 arr_1m period_bars index_ranges current_bar_start_ix 和base metadata

- Source: `REQ-DATASERVICE-018`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:e87e2b5433999c51b420c5718883931b5a7fd7b216d10eccdbbb7c17b60a57f1`.
- Provenance: `SPAN-40F621131D3756D3`; clauses: `B0801:C1, B0802:C1, B0803:C1, B0804:C1, B0808:C1, B0809:C1, B0810:C1, B0811:C1, B0815:C1, B0816:C1, B0817:C1, B0817:C2, B0818:C1, B0819:C1, B0823:C1, B0824:C1, B0825:C1, B0826:C1, B0826:C2, B0827:C1, B0827:C2, B0828:C1, B0832:C1, B0833:C1, B0833:C2, B0834:C1, B0835:C1, B0836:C1`.

#### REQ-DATASERVICE-019

> audit-b01 work-01至work-16每项必须包含精确路径 实施步骤 红灯 绿灯 回归 证据 pass fail blocked和清理

- Source: `REQ-DATASERVICE-019`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:dec575c13cfa0c6d05311b4701bd2597b6c41f79d912db3cde2f62ba123535d9`.
- Provenance: `SPAN-8633865AF4429732`; clauses: `B0844:C1, B0844:C2`.

#### REQ-DATASERVICE-020

> audit-b02 ac-01至ac-24必须拆分为可独立执行的 ac-xx-sxx 每个场景具有自己的fixture 步骤 断言 命令 证据和teardown

- Source: `REQ-DATASERVICE-020`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:01d249a4d01496738b3dd61a993fbbec1466177e389e8cd83b4f0b4c5b0c5a8c`.
- Provenance: `SPAN-9484DC2F0A28654D`; clauses: `B0845:C1, B0845:C2`.

#### REQ-DATASERVICE-021

> audit-b03 真实fixture的event id 时间范围 ohlcv 字节数和sha-256在goal合同生成前冻结

- Source: `REQ-DATASERVICE-021`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:d0e1687646e67d0e718d5c446aab8b93bd844a826ab89a6f2d4f89a14b7eed86`.
- Provenance: `SPAN-783C739A17E19689`; clauses: `B0846:C1, B0846:C2, B0846:C3`.

#### REQ-DATASERVICE-022

> audit-b04 logical active使用 stream_key service_generation active_generation

- Source: `REQ-DATASERVICE-022`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:ea41f0508e4bca95812982fbd2d1d0fd9212ed555ca14d574ef6cd90d006b074`.
- Provenance: `SPAN-99A0F5EEA43921E9`; clauses: `B0847:C1, B0847:C2, B0847:C3`.

#### REQ-DATASERVICE-023

> audit-b05 一次canonical 1m rollover只产生一个 completedrolloverbatch 一个batch sequence和一个最终ack

- Source: `REQ-DATASERVICE-023`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:43e81c706108632fbac83c3aa94477675cc56faa761237923ab6dde23ee0a6f5`.
- Provenance: `SPAN-386061209B967B07`; clauses: `B0848:C1, B0848:C2, B0848:C3`.

#### REQ-DATASERVICE-024

> audit-b06 历史ipc只使用 historicalbarrequest/response dataservicehistoricalqueryresult 和临时shm

- Source: `REQ-DATASERVICE-024`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:ed0299a55fe8411ec4020c82da1708089e51552a1876540d3e29f924140d51d6`.
- Provenance: `SPAN-117D78E78BCB845B`; clauses: `B0849:C1, B0849:C2, B0849:C3`.

#### REQ-DATASERVICE-025

> audit-m01 每个 ac-xx-sxx 必须映射goal task 精确产品文件 pytest nodeid和artifact

- Source: `REQ-DATASERVICE-025`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:09705fd102b834d5f2ef4c8549216b32ca0d404d29454f9720da0928b2629e48`.
- Provenance: `SPAN-FF6140DF3C90E20F`; clauses: `B0850:C1, B0850:C2`.

#### REQ-DATASERVICE-026

> audit-m02 work依赖必须先冻结旧行为和fixture 再修active/ingress/history/cold-hot 之后修指标 recorder callback trigger和query 最后验收清理

- Source: `REQ-DATASERVICE-026`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:93d3bbc3eae027fc6bf84fa7162e622f079a735a4f09d70045c00175267733d8`.
- Provenance: `SPAN-BFDB08BA7D490E93`; clauses: `B0851:C1, B0851:C2`.

#### REQ-DATASERVICE-027

> audit-m03 qt命令在当前powershell直接设置 env:qt_qpa_platform offscreen 后运行pytest 不嵌套第二层 pwsh -command

- Source: `REQ-DATASERVICE-027`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:57a496cd6c031d3876ab4dd5ea65fbcd94e2da6fe89651fa14e1d091478c4cd6`.
- Provenance: `SPAN-0DC676B7B0B0255A`; clauses: `B0852:C1, B0852:C2`.

#### REQ-DATASERVICE-028

> audit-m04 仓库没有冻结的全局lint权威

- Source: `REQ-DATASERVICE-028`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:74da2216506548ab6ee12296f705cc9b48c70fd4b4b05d57db5ad0ff11f66948`.
- Provenance: `SPAN-0E307C53B233DDC7`; clauses: `B0853:C1, B0853:C2, B0853:C3`.

#### REQ-DATASERVICE-029

> audit-m05 生产仅配置三个默认关闭的recorder崩溃barrier

- Source: `REQ-DATASERVICE-029`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:80ad2bf1501af2b43f26983165a9112cb79956c5e16bd87243ba5891d5c89296`.
- Provenance: `SPAN-FF78C74754B0DE0D`; clauses: `B0854:C1, B0854:C2, B0854:C3`.

#### REQ-DATASERVICE-030

> audit-m06 trigger仅在真实ring overrun时短暂 unprotected attach latest cursor后用latest tick重评并自行恢复ack 不调用datamanager

- Source: `REQ-DATASERVICE-030`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:ce88eb09a14a758d6e5d311467e1cab127b035cf87c8df5bafd656f399f58994`.
- Provenance: `SPAN-C6CC238968A482DA`; clauses: `B0855:C1, B0855:C2`.

#### REQ-DATASERVICE-031

> audit-m07 dataservice崩溃将旧stream标记aborted

- Source: `REQ-DATASERVICE-031`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:8858cb982a024622f468b272e457b0a7f31e73992cabe14b6f8434635e1f5aef`.
- Provenance: `SPAN-B622AB7C5C29514E`; clauses: `B0856:C1, B0856:C2, B0856:C3`.

#### REQ-DATASERVICE-032

> audit-m08 复用有界 completedbarlog 存储单位改为rollover batch

- Source: `REQ-DATASERVICE-032`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:927fe9909663c30273711e8e86aa38006093e2b39921f58f081c1343f8639f2d`.
- Provenance: `SPAN-DAFBB12335199540`; clauses: `B0857:C1, B0857:C2, B0857:C3`.

#### REQ-DATASERVICE-033

> audit-m09 actual mapping subscribe/unsubscribe和callback acceptance全部串行进入ingress dispatcher

- Source: `REQ-DATASERVICE-033`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:89ef2c56e60235d3e50e4f0091aff1487544e344dfa13d27051ad68012193699`.
- Provenance: `SPAN-4637D94992C23DCC`; clauses: `B0858:C1, B0858:C2, B0858:C3`.

#### REQ-DATASERVICE-034

> audit-m10 coverage复用现有 missing_ranges 并发布 coverage_segments

- Source: `REQ-DATASERVICE-034`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:87e38ec9a0275d1b52055b75754b5e0eebd951c3d8417cb6a6e0b1d6221fdd1b`.
- Provenance: `SPAN-6DEA851312FEEE60`; clauses: `B0859:C1, B0859:C2, B0859:C3`.

#### REQ-DATASERVICE-035

> audit-m11 启动范围复用822 datamanager配置

- Source: `REQ-DATASERVICE-035`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:c3d1255c7c2c24a282a99946b90c80ad3eb66e00f5007a31d9aaff5693b5da71`.
- Provenance: `SPAN-3B85558B97E97935`; clauses: `B0860:C1, B0860:C2, B0860:C3`.

#### REQ-DATASERVICE-036

> audit-m12 trigger candidate先以500ms间隔重试两次 再进入 delivery_degraded 并每秒重发同一candidate 直到ack或规则失效

- Source: `REQ-DATASERVICE-036`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:515c5f1ec43c0c4d98f99edc8d1da0fc8db127b0da24aeb5aa3eb97db413448d`.
- Provenance: `SPAN-A5BAA0976527E338`; clauses: `B0861:C1, B0861:C2`.

#### REQ-DATASERVICE-037

> audit-m13 candidate/ack identity固定为 service_generation active_generation candidate_id attempt不是identity

- Source: `REQ-DATASERVICE-037`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:58e9a8f574154bc69f98749791e57a3e62111a2d7a96acbe19f1b8f37f8680d1`.
- Provenance: `SPAN-B5E76FB76F7F3FE9`; clauses: `B0862:C1, B0862:C2`.

#### REQ-DATASERVICE-038

> audit-m14 复用 orderintent.actual_vt_symbol

- Source: `REQ-DATASERVICE-038`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:92b2a4cf7ad19082dbcb6e886fa77bff9658ee47bc1c9f56825fc93cf41b1b3e`.
- Provenance: `SPAN-B7CE93AE2565FC5F`; clauses: `B0863:C1, B0863:C2, B0863:C3`.

#### REQ-DATASERVICE-039

> audit-m15 query只复用 session_id/request_id/request_generation/active_contract_generation

- Source: `REQ-DATASERVICE-039`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:18a52b3c48497819ac47c532780d6790d3e2333a16d62dc57035de196161fe67`.
- Provenance: `SPAN-EAF23AF31411C1AF`; clauses: `B0864:C1, B0864:C2, B0864:C3`.

#### REQ-DATASERVICE-040

> audit-m16 只合并完全相同的in-flight request

- Source: `REQ-DATASERVICE-040`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:179682d9df812b8168c3a80c2c77a46e631fe80ffac0674cfa149020b0f73ebc`.
- Provenance: `SPAN-52C778B4CDCC4705`; clauses: `B0865:C1, B0865:C2, B0865:C3`.

#### REQ-DATASERVICE-041

> audit-m17 recorder checkpoint保存未ack batch的selected/skipped identities persistence group和durable状态

- Source: `REQ-DATASERVICE-041`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:2f7d200209179db85081cbc1670e76727f00c7a2a8b0cb45732c11202177b67f`.
- Provenance: `SPAN-773CABDF4C19661D`; clauses: `B0866:C1, B0866:C2, B0866:C3`.

#### REQ-DATASERVICE-042

> audit-m18 启动tick只向逐tick消费者发布一次

- Source: `REQ-DATASERVICE-042`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:cd5c862318f67dd407428f8b6b090fb4fa6c39c0ae84ca491aeb8a8acbb5cb11`.
- Provenance: `SPAN-7B7586D7136AC6C5`; clauses: `B0867:C1, B0867:C2, B0867:C3`.

#### REQ-DATASERVICE-043

> contract-001 source plan路径固定为 docs/plans/2026-09-04-dataservice-cold-hot-legacy-chain-source-plan.md

- Source: `REQ-DATASERVICE-043`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:6791fe748efc46d3cdb1b3fcaa379309e1d122f3f5b1494f13b55aa1ca1a5263`.
- Provenance: `SPAN-B2A80206D0DF0E4D`; clauses: `B2414:C1`.

#### REQ-DATASERVICE-044

> contract-002 goal contract路径固定为 docs/plans/2026-09-04-dataservice-cold-hot-legacy-chain-goal-execution-plan.md

- Source: `REQ-DATASERVICE-044`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:cabad32cb52edd459e8bb44d222959c92f21e8294341348f86c4594c37f26721`.
- Provenance: `SPAN-0022004B583E5236`; clauses: `B2416:C1`.

#### REQ-DATASERVICE-045

> contract-003 本文件经用户明确确认后 合同作者才可执行

- Source: `REQ-DATASERVICE-045`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:59d06781f92b0d86b0ef4d5abe1b0a497b1340169cb413d9cfe001c712b108ce`.
- Provenance: `SPAN-61DA489C38AB60C5`; clauses: `B2418:C1, B2420:C1`.
- Condition (unevaluated):

  > CONTRACT-003：本文件经用户明确确认后，合同作者才可执行： AND CONTRACT-003：本文件经用户明确确认后，合同作者才可执行：


#### REQ-DATASERVICE-046

> contract-004 goalexecutionir必须为fix-01至fix-17 audit-b01至b06 audit-m01至m18 ac-01-s01至ac-24-s03实际存在的全部scenario perf-001至perf-020建立双向映射 unmappedsourceobligations 0

- Source: `REQ-DATASERVICE-046`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:6444926c2878ef2c5c25451d091c1c948f246ea69bbc9e4d1e7b0cc3c51aac9d`.
- Provenance: `SPAN-63C03DD3BD633FC9`; clauses: `B2422:C1`.

#### REQ-DATASERVICE-047

> contract-005 每个goal task只选择work节列出的精确文件子集

- Source: `REQ-DATASERVICE-047`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:fb3811e839c647026c9eca0d6f486fe7b827524f74cc716c4570178a5faa4807`.
- Provenance: `SPAN-B2065042B9FA87DF`; clauses: `B2424:C1, B2424:C2`.

#### REQ-DATASERVICE-048

> contract-006 某任务需要清单外路径时返回 blocked_by_contract_ambiguity:file_scope: exact_path 等待source plan successor授权

- Source: `REQ-DATASERVICE-048`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:21e3706b4b53d9f9bf2076f50269afecd8bf3ef34f6f7bcabe9dc6c6abdf9a71`.
- Provenance: `SPAN-2E55E08A0904F48E`; clauses: `B2426:C1`.
- Condition (unevaluated):

  > CONTRACT-006：某任务需要清单外路径时返回`blocked_by_contract_ambiguity:file_scope:<exact_path>`，等待Source Plan successor授权。


#### REQ-DATASERVICE-049

> contract-007 合同必须为每个 ac-xx-sxx 绑定goal task 实际实现文件 测试文件和pytest nodeid 可执行powershell命令 直接assertion/artifact pass fail blocked和teardown

- Source: `REQ-DATASERVICE-049`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:00fc680cef3b20e8348a1519133ede5447799dafee3f97f5a9fcf955d52c0d84`.
- Provenance: `SPAN-C1247D99CC80CA98`; clauses: `B2428:C1`.

#### REQ-DATASERVICE-050

> the contract must verify contractmode frozen rewritepolicy forbidden and executionmode execute_only. it must verify goalcontractversion goal-execution-contract/v1 only while the public wire contract remains unchanged.

- Source: `REQ-DATASERVICE-050`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:addbadfdf97190d1f3a747b3e0a98222c4fac167171bfa7ed487573ac3d76383`.
- Provenance: `SPAN-55E4444C44D79032`; clauses: `B2430:C1:P002, B2430:C1:P004, B2430:C1:P006, B2430:C1:P008`.

#### REQ-DATASERVICE-051

> contract-009 合同必须生成并核对source plan hash goal contract hash goalexecutionir hash closure active authority coverage receipt和generation receipt

- Source: `REQ-DATASERVICE-051`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:9eda1ddcd22d93b1fa1b6635ad8d6ebf4f3e41884ee63bf0b5a2d02d023a14bb`.
- Provenance: `SPAN-25429FDFFD277290`; clauses: `B2432:C1`.

#### NEG-DATASERVICE-001

> during the goal contract generation transaction partitioning child-contract generation and creation of an execution dispatch run lease or execution artifact are forbidden.

- Source: `NEG-DATASERVICE-001`; role: `boundary`; strength: `must`; polarity: `forbidden`.
- Source text hash: `sourceTextHash=sha256:7d67d9c0222256ba1a7309aeb49186e7d66780f52be7209d05be4dddb22a375e`.
- Provenance: `SPAN-C54D69D3508C7DAE`; clauses: `B2434:C1:P002, B2434:C1:P004, B2434:C1:P006`.
- Condition (unevaluated):

  > goal_contract_generation_transaction_active


#### NEG-DATASERVICE-002

> contract-011 goalexecutionir 任务 acceptance 命令和stop condition禁止出现确定性语言门禁词表中的全部不确定性表达

- Source: `NEG-DATASERVICE-002`; role: `boundary`; strength: `must`; polarity: `forbidden`.
- Source text hash: `sourceTextHash=sha256:072bba7b485e1a854e99352276fa44c9df4c4d7eb360978603606859501dee2d`.
- Provenance: `SPAN-DF0B586ACEB91878`; clauses: `B2436:C1`.

#### REQ-DATASERVICE-052

> contract-012 每条义务必须写明执行者 精确目标 必须条件 证明命令和失败状态

- Source: `REQ-DATASERVICE-052`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:c7537c06f276ef3800480a5519763844074fb81e598ccf7c4ce7d6659c5808fc`.
- Provenance: `SPAN-E3C2731FC6DAE496`; clauses: `B2438:C1`.

#### REQ-DATASERVICE-053

> dirty-001 合同生成前记录当前head residual worktree清单及其sha-256

- Source: `REQ-DATASERVICE-053`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:4ee2c4e72e5064cb92dbf756e57c0a3f1f74dd16351d9a2db33a16fdb0d82469`.
- Provenance: `SPAN-90F9A37E7B07B989`; clauses: `B2442:C1`.
- Condition (unevaluated):

  > DIRTY-001：合同生成前记录当前HEAD、residual worktree清单及其SHA-256。


#### REQ-DATASERVICE-054

> dirty-002 合同生成前记录每个任务授权文件的初始sha-256和相对head状态

- Source: `REQ-DATASERVICE-054`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:a0cc479dcfa780a034eae5fd2a72437773c41ba7875ec9e81455dc301857359a`.
- Provenance: `SPAN-866D131A292A5040`; clauses: `B2444:C1`.
- Condition (unevaluated):

  > DIRTY-002：合同生成前记录每个任务授权文件的初始SHA-256和相对HEAD状态。


#### NEG-DATASERVICE-003

> dirty-003 实施代理不得reset checkout覆盖 revert 删除或暂存用户既有修改

- Source: `NEG-DATASERVICE-003`; role: `boundary`; strength: `must`; polarity: `forbidden`.
- Source text hash: `sourceTextHash=sha256:b2e51221f9006e49252b28ffb37c8ad6d60eee9d29c5509f3779a60d1332bbbb`.
- Provenance: `SPAN-5F87952C09046E19`; clauses: `B2446:C1`.

#### REQ-DATASERVICE-055

> dirty-004 授权文件在合同冻结后被外部修改时立即停止该任务并报告路径和新hash

- Source: `REQ-DATASERVICE-055`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:2c15eeedfc6994ad4ea472fdf92a6646ec5c8498edee3e711713957fd4d9e60a`.
- Provenance: `SPAN-0E782D53BF26C638`; clauses: `B2448:C1`.
- Condition (unevaluated):

  > DIRTY-004：授权文件在合同冻结后被外部修改时立即停止该任务并报告路径和新hash。


#### REQ-DATASERVICE-056

> dirty-005 测试既有失败必须通过822基线对照或最小复现分类 不得自动归因于本次修改

- Source: `REQ-DATASERVICE-056`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:b17ac8e8f7ce79eae33fe8eb437f8e48551b872e80353a4b9493839d603cd6c5`.
- Provenance: `SPAN-E99BAC81DCF86182`; clauses: `B2450:C1`.
- Condition (unevaluated):

  > DIRTY-005：测试既有失败必须通过822基线对照或最小复现分类，不得自动归因于本次修改。


#### REQ-DATASERVICE-057

> dirty-006 提交必须使用明确路径暂存 禁止 git add -a

- Source: `REQ-DATASERVICE-057`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:92eb566154518e628e40bdef19bb48711d6433d7676b5912df4d337a9962d2be`.
- Provenance: `SPAN-B36B72F4ACAEBEBC`; clauses: `B2452:C1`.

#### REQ-DATASERVICE-058

> dirty-007 提交前检查 git status --short git diff --cached --name-only 和完整staged diff 范围外文件存在时停止提交

- Source: `REQ-DATASERVICE-058`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:29bfce1c127715166fb11d30779a02443c0de0082515601fa2175d90bd40bc0a`.
- Provenance: `SPAN-E998E815C6507713`; clauses: `B2454:C1`.
- Condition (unevaluated):

  > DIRTY-007：提交前检查`git status --short`、`git diff --cached --name-only`和完整staged diff，范围外文件存在时停止提交。


#### REQ-DATASERVICE-059

> fixture-001 历史样本路径固定为 tests/fixtures/dataservice/mhi_completed_1m.parquet

- Source: `REQ-DATASERVICE-059`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:fc83a1b7adc0b8a6a2061c8dec32d4fdb19a8ed583683cf657c16ca06c5569e7`.
- Provenance: `SPAN-1B2B2F0ED66DD140`; clauses: `B1266:C1`.

#### REQ-DATASERVICE-060

> fixture-002 实时回放路径固定为 tests/fixtures/dataservice/mhi_quote_orderbook.jsonl

- Source: `REQ-DATASERVICE-060`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:47d3536b3200e07f1d45e76a9ca8ab049b3d0bf292a46938ec42b324a5a1fdf5`.
- Provenance: `SPAN-762EFC6EF8F6BD5B`; clauses: `B1268:C1`.

#### REQ-DATASERVICE-061

> fixture-003 来源 市场时间范围 记录数 字节数和sha-256固定在 tests/fixtures/dataservice/manifest.json

- Source: `REQ-DATASERVICE-061`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:d7a28de0f4321562672e32b42b9d03c52176a589488b74e48d1f60d56a29ba50`.
- Provenance: `SPAN-20ED91CCE9543FAD`; clauses: `B1270:C1`.

#### REQ-DATASERVICE-062

> fixture-004 样本必须覆盖以下时间点

- Source: `REQ-DATASERVICE-062`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:4b255caba183b404c0282c22b5c6f567d278e4daef204047fd82bb54b8c42b84`.
- Provenance: `SPAN-4433302F947DB9B3`; clauses: `B1272:C1, B1274:C1, B1275:C1, B1276:C1, B1277:C1, B1278:C1, B1279:C1, B1280:C1, B1281:C1, B1282:C1`.

#### REQ-DATASERVICE-063

> fixture-005 每个测试运行时创建独立sqlite lmdb shm namespace和artifact目录 不读取或写入工作区 database.db

- Source: `REQ-DATASERVICE-063`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:7f2bfb5a44f2a7f0ee9210952ab111ef02d29d67132c7427dc5db0a6a9da545f`.
- Provenance: `SPAN-D8E6CE659FFE11E0`; clauses: `B1284:C1`.
- Condition (unevaluated):

  > FIXTURE-005：每个测试运行时创建独立SQLite、LMDB、SHM namespace和artifact目录，不读取或写入工作区`database.db`。


#### REQ-DATASERVICE-064

> fixture-006 统一qt命令设置 qt_qpa_platform offscreen

- Source: `REQ-DATASERVICE-064`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:3c7f68bfe26025ac77e31ff6c696da9878519b47ecb010ca8ccaf5f1b0572c35`.
- Provenance: `SPAN-6361EDB3B3E1FD1F`; clauses: `B1286:C1, B1286:C2`.

#### REQ-DATASERVICE-065

> fixture-007 manifest.json 必须为每个场景列出 fixture_id/source/timezone/start/end/record_count/byte_count/sha256/event_ids/expected_period_starts/expected_ohlcv 并明确v1/v2 缺口 同rollover多周期 actual换月 trigger触发和query迟到response所使用的记录id

- Source: `REQ-DATASERVICE-065`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:f88cd0855fc3f2a8e8b56a72bd693aa3b9b29d00946efce21cbed00321adbe08`.
- Provenance: `SPAN-FD91DC3EA896CB80`; clauses: `B1288:C1`.

#### REQ-DATASERVICE-066

> fixture-008 goal合同生成前必须实际读取 mhi_completed_1m.parquet mhi_historical_ticks.parquet mhi_quote_orderbook.jsonl 和 manifest.json 并核验 manifest

- Source: `REQ-DATASERVICE-066`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:b51a86e80f2f28d00e5babf5a2533a0c3e7426cf85a9e7584ef38c5f6db0c5cc`.
- Provenance: `SPAN-97CB4A8920728737`; clauses: `B1290:C1, B1290:C2, B1290:C3, B1290:C4`.

#### REQ-DATASERVICE-067

> fixture-009 离线核心场景必须使用真实 completed 1m 真实合并历史 tick 和真实生产代码

- Source: `REQ-DATASERVICE-067`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:84ab53edfe3f329f38ee37c3f3bfe0009ce20a6a35dfdc753ab5fad2390f3cb4`.
- Provenance: `SPAN-7DE1329568406D54`; clauses: `B1292:C1, B1292:C2, B1292:C3`.

#### REQ-DATASERVICE-068

> fixture-010 csv 是离线回放载体

- Source: `REQ-DATASERVICE-068`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:560a49ae15a0a7c4545203c6487334d42adb39484a36aac96602b639415fab22`.
- Provenance: `SPAN-B50956BC35B0DC28`; clauses: `B1294:C1, B1294:C2, B1294:C3, B1294:C4, B1294:C5, B1294:C6, B1294:C7, B1294:C8`.

#### OUT-DATASERVICE-001

> not-done-001 不修改任何指标数学公式 参数 输出名称 输出数量或pane

- Source: `OUT-DATASERVICE-001`; role: `boundary`; strength: `must`; polarity: `forbidden`.
- Source text hash: `sourceTextHash=sha256:b64179850b400328ca162e7a83ba66ab81a0592cc8be039ae70a72f1b6c4f2f4`.
- Provenance: `SPAN-1385FFFB2B629BA4`; clauses: `B2358:C1`.

#### OUT-DATASERVICE-002

> not-done-002 不重新发明hkfe交易时段

- Source: `OUT-DATASERVICE-002`; role: `boundary`; strength: `must`; polarity: `forbidden`.
- Source text hash: `sourceTextHash=sha256:e08608d69e813037f8c4d08dd7215f11ad46223d237a5e2b457cb554cb17232e`.
- Provenance: `SPAN-B757A852198105E2`; clauses: `B2360:C1, B2360:C2`.

#### OUT-DATASERVICE-003

> not-done-003 不修改db schema 不引入新数据库 不保存current bar

- Source: `OUT-DATASERVICE-003`; role: `boundary`; strength: `must`; polarity: `forbidden`.
- Source text hash: `sourceTextHash=sha256:7410204c90d0202ebd4f82446b6c00045144079099697c70055cc0a5fc715b9d`.
- Provenance: `SPAN-05E77115E2960D0C`; clauses: `B2362:C1`.

#### OUT-DATASERVICE-004

> not-done-004 不改变旧datarecorder 1m/tick批量和高周期立即写 失败降级语义

- Source: `OUT-DATASERVICE-004`; role: `boundary`; strength: `must`; polarity: `forbidden`.
- Source text hash: `sourceTextHash=sha256:297c7a693142eb5031630fd18859c81b9ac993f3f105d845fb13eb3438298170`.
- Provenance: `SPAN-9AC84A65F40DE09F`; clauses: `B2364:C1`.

#### OUT-DATASERVICE-005

> not-done-005 不恢复datarecorder自己的canonical bargenerator和多周期聚合

- Source: `OUT-DATASERVICE-005`; role: `boundary`; strength: `must`; polarity: `forbidden`.
- Source text hash: `sourceTextHash=sha256:625fb72bb5e589fb6465f34b3814865487fb396fd4b267fce0746b4de71d0675`.
- Provenance: `SPAN-5D21B5BE87415316`; clauses: `B2366:C1`.

#### OUT-DATASERVICE-006

> not-done-006 不让dataservice ui worker recorder cta或trigger写repair db

- Source: `OUT-DATASERVICE-006`; role: `boundary`; strength: `must`; polarity: `forbidden`.
- Source text hash: `sourceTextHash=sha256:ee615768a19aa72c821536e0476f38ba8e35c28e2e95abf642e98048c7ecc200`.
- Provenance: `SPAN-56494BC531B60E2A`; clauses: `B2368:C1`.

#### OUT-DATASERVICE-007

> not-done-007 不让dataservice计算指标 不用gds替代l1/l2/lmdb

- Source: `OUT-DATASERVICE-007`; role: `boundary`; strength: `must`; polarity: `forbidden`.
- Source text hash: `sourceTextHash=sha256:3d568ffd73d7a2e9436963ed62eb0830b5accb7c181d1a24c9e0537cab7d1673`.
- Provenance: `SPAN-9EBE1151B55B72DC`; clauses: `B2370:C1`.

#### OUT-DATASERVICE-008

> not-done-008 不新增指标缓存层 不按boll名称建立旁路

- Source: `OUT-DATASERVICE-008`; role: `boundary`; strength: `must`; polarity: `forbidden`.
- Source text hash: `sourceTextHash=sha256:910b0d0a51eed59f4f9fbe161a76581a85fe88992d1c8dbdacfc9f1c11fb3c39`.
- Provenance: `SPAN-40A639BB31871BA7`; clauses: `B2372:C1`.

#### OUT-DATASERVICE-009

> not-done-009 不使用revision generation sequence或snapshot选择cold/hot winner

- Source: `OUT-DATASERVICE-009`; role: `boundary`; strength: `must`; polarity: `forbidden`.
- Source text hash: `sourceTextHash=sha256:ea62cbdfc739cac7888039cb715eaa9a6569772165933d6e294c1e1e7f579b7f`.
- Provenance: `SPAN-16D61B092932A5C1`; clauses: `B2374:C1`.

#### OUT-DATASERVICE-010

> not-done-010 不保留停止更新的旧视图作为运行权威

- Source: `OUT-DATASERVICE-010`; role: `boundary`; strength: `must`; polarity: `forbidden`.
- Source text hash: `sourceTextHash=sha256:46f9f7c850d9e60da59a47fd898b0ddae514588c43283b46ffa2f103baed3372`.
- Provenance: `SPAN-724302F5CF488BAB`; clauses: `B2376:C1`.

#### OUT-DATASERVICE-011

> not-done-011 不创建可进入指标数组的缺失占位bar

- Source: `OUT-DATASERVICE-011`; role: `boundary`; strength: `must`; polarity: `forbidden`.
- Source text hash: `sourceTextHash=sha256:29b1a9a3b0addc290f421d708c3413d2cfed32983f3fd79dec66360e97411a1a`.
- Provenance: `SPAN-1D9EF5A6D6F3BAF2`; clauses: `B2378:C1`.

#### OUT-DATASERVICE-012

> not-done-012 不订阅实时k_1m 不使用分钟seed建立current

- Source: `OUT-DATASERVICE-012`; role: `boundary`; strength: `must`; polarity: `forbidden`.
- Source text hash: `sourceTextHash=sha256:0d407211430a0abd3c2848b27e77c3eea6642cc9cbeb6352de0a093fd7a372e3`.
- Provenance: `SPAN-B6958CE27B0ADECB`; clauses: `B2380:C1`.

#### OUT-DATASERVICE-013

> not-done-013 不创建多个active symbol 多个实时tickdatabus或非active实时recorder

- Source: `OUT-DATASERVICE-013`; role: `boundary`; strength: `must`; polarity: `forbidden`.
- Source text hash: `sourceTextHash=sha256:54c07a5ba6fa2ddf42ffafc229bc4aeedb4cc2705046c1c381cff2d347c8d759`.
- Provenance: `SPAN-FA741255BE5D02FC`; clauses: `B2382:C1`.

#### OUT-DATASERVICE-014

> not-done-014 不新增mapping version 不因actual换月改变logical generation或stream

- Source: `OUT-DATASERVICE-014`; role: `boundary`; strength: `must`; polarity: `forbidden`.
- Source text hash: `sourceTextHash=sha256:cc7ab5770eec18c20976365559302a6394dfca86eff8de2ae721d6193f7bb7fc`.
- Provenance: `SPAN-DFE6C9D5135819A9`; clauses: `B2384:C1`.

#### OUT-DATASERVICE-015

> not-done-015 不把tick限流 tick sequence或consumer overrun当作历史bar缺口

- Source: `OUT-DATASERVICE-015`; role: `boundary`; strength: `must`; polarity: `forbidden`.
- Source text hash: `sourceTextHash=sha256:9fec45013c0a4d35755a38af5586c190811eaf0f363e4307a7ceda1ec9e2af50`.
- Provenance: `SPAN-33D84D263DE8DA15`; clauses: `B2386:C1`.

#### OUT-DATASERVICE-016

> not-done-016 不让dataservice读回自身tickdatabus聚合

- Source: `OUT-DATASERVICE-016`; role: `boundary`; strength: `must`; polarity: `forbidden`.
- Source text hash: `sourceTextHash=sha256:12ac0666ca1a1c5a3e1fbf5962e4141786468094d1256711e3414b034b27f097`.
- Provenance: `SPAN-58B7A5E1BC1B7201`; clauses: `B2388:C1`.

#### OUT-DATASERVICE-017

> not-done-017 不建立第二套completed broker durable outbox或分布式事务

- Source: `OUT-DATASERVICE-017`; role: `boundary`; strength: `must`; polarity: `forbidden`.
- Source text hash: `sourceTextHash=sha256:f65f63b877085bc25b6778bf370301290506d9113ab93098ec20ca53504b5282`.
- Provenance: `SPAN-2CEBD3FF6666E1E8`; clauses: `B2390:C1, B2390:C2`.

#### OUT-DATASERVICE-018

> not-done-018 不为recorder配置建立两阶段跨进程事务或config version

- Source: `OUT-DATASERVICE-018`; role: `boundary`; strength: `must`; polarity: `forbidden`.
- Source text hash: `sourceTextHash=sha256:2e52f25368d15ce912a1bf3e372a7a9c4ac106289a9e086badb62d69c7e56985`.
- Provenance: `SPAN-DD4B5131D8F8D14A`; clauses: `B2392:C1`.

#### OUT-DATASERVICE-019

> not-done-019 不把tick/1m/高周期改成同一种持久化节奏 也不逐tick写db

- Source: `OUT-DATASERVICE-019`; role: `boundary`; strength: `must`; polarity: `forbidden`.
- Source text hash: `sourceTextHash=sha256:2353d8b197774bdfafae7c7270717c7b4f6be3c0c0ba1d189c1563296e4d1b11`.
- Provenance: `SPAN-3A65BBE42FA8A862`; clauses: `B2394:C1, B2394:C2`.

#### OUT-DATASERVICE-020

> not-done-020 不为普通descriptor建立consumer lease ttl或每query allocation

- Source: `OUT-DATASERVICE-020`; role: `boundary`; strength: `must`; polarity: `forbidden`.
- Source text hash: `sourceTextHash=sha256:9dd22a2a349a35d4558ff897af4f768213d66a4e821e2efb8d60a6b6d57f096e`.
- Provenance: `SPAN-15E5193CFD93977A`; clauses: `B2396:C1`.

#### OUT-DATASERVICE-021

> not-done-021 不实现任意重叠range coalescing框架 不保留250ms重试

- Source: `OUT-DATASERVICE-021`; role: `boundary`; strength: `must`; polarity: `forbidden`.
- Source text hash: `sourceTextHash=sha256:fc0539984b4b9ef8c0ab660b4fc2499a8ce33ed971318168a22aba1e0720a30c`.
- Provenance: `SPAN-55F365B13BB382C8`; clauses: `B2398:C1`.

#### OUT-DATASERVICE-022

> not-done-022 不使用event_timer提交trigger candidate 不让trigger/dataservice调用真实交易api

- Source: `OUT-DATASERVICE-022`; role: `boundary`; strength: `must`; polarity: `forbidden`.
- Source text hash: `sourceTextHash=sha256:7bbf756bff00ca3539495ba9db6cd55b8e98b040eb9aec79693239e45467d287`.
- Provenance: `SPAN-B6E5A0A71EB644A2`; clauses: `B2400:C1`.

#### OUT-DATASERVICE-023

> not-done-023 不让shared canonical bar直接调用cta策略 on_bar/on_window_bar

- Source: `OUT-DATASERVICE-023`; role: `boundary`; strength: `must`; polarity: `forbidden`.
- Source text hash: `sourceTextHash=sha256:ec2a320245471fbcb0f4e22b4ae87f846aed64e135466a4ef4c6fe4488f21b90`.
- Provenance: `SPAN-FE41EDA4E6BDCE55`; clauses: `B2402:C1`.

#### OUT-DATASERVICE-024

> not-done-024 不让ui恢复db查询 周期聚合 指标计算或period open纠正权威

- Source: `OUT-DATASERVICE-024`; role: `boundary`; strength: `must`; polarity: `forbidden`.
- Source text hash: `sourceTextHash=sha256:bf40bafd9409623b5b1b72c50cd281c58bfd899ab3a7aeeb8518e040c8b4ad95`.
- Provenance: `SPAN-69F527C3976204F1`; clauses: `B2404:C1`.

#### OUT-DATASERVICE-025

> not-done-025 不使用fake dataservice fake lmdb fake plotdataitem fake queue或日志字符串作为唯一验收

- Source: `OUT-DATASERVICE-025`; role: `boundary`; strength: `must`; polarity: `forbidden`.
- Source text hash: `sourceTextHash=sha256:ea6f2dbd805c853142593ad0726108e3645b2793e5a004798a15a7f4f147eb17`.
- Provenance: `SPAN-558A2BE88A1345C1`; clauses: `B2406:C1`.

#### OUT-DATASERVICE-026

> not-done-026 不修改合同未授权路径 不顺带修复无关测试或图表功能

- Source: `OUT-DATASERVICE-026`; role: `boundary`; strength: `must`; polarity: `forbidden`.
- Source text hash: `sourceTextHash=sha256:6073a9c50890348d6650c859050fb074292b705e7a1adb92b5e787aca21bd133`.
- Provenance: `SPAN-D0633BE7C9BF6292`; clauses: `B2408:C1`.

#### OUT-DATASERVICE-027

> not-done-027 不提交 database.db lmdb 日志 报告 性能原始数据 临时文件 cache或 __pycache__

- Source: `OUT-DATASERVICE-027`; role: `boundary`; strength: `must`; polarity: `forbidden`.
- Source text hash: `sourceTextHash=sha256:75f96615d6826e0a26dc8bbe0221dd911311cdfae3098024fff839b51358467e`.
- Provenance: `SPAN-88E91C206F982C20`; clauses: `B2410:C1`.

#### NFR-DATASERVICE-001

> perf-001 对照提交固定为 822c715e6 candidate固定为实施完成提交

- Source: `NFR-DATASERVICE-001`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:fd7c5c9d9e477e7083f09a72a84338e2a235460babcc51a26611ec1ef55e44eb`.
- Provenance: `SPAN-65FAAA1D83F6762F`; clauses: `B2046:C1, B2046:C2`.

#### NFR-DATASERVICE-002

> perf-002 baseline和candidate分别使用干净worktree

- Source: `NFR-DATASERVICE-002`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:2557fc5c6ad26614781e3039133c2dfe0e904ec202c0280ed60b19a4b0a897ed`.
- Provenance: `SPAN-26B0A742F3ADCA33`; clauses: `B2048:C1, B2048:C2`.

#### NFR-DATASERVICE-003

> perf-003 每个场景先预热3次 再正式测量20次 保存20次原始样本并计算p50/p95

- Source: `NFR-DATASERVICE-003`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:e08b7e5c689d3783860268160f52e71ed86361ab1b317cc05ac42ed3abcbe749`.
- Provenance: `SPAN-A545B81800D08F61`; clauses: `B2050:C1`.

#### NFR-DATASERVICE-004

> perf-004 冷启动多周期首帧定义为用户发出range query到真实主图所有请求指标plotdataitem获得首个有效xdata/ydata的时间

- Source: `NFR-DATASERVICE-004`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:3795a9f348ecbbf1591db32ccc5ac3668a646163febb7a238e4ad7b31e14bdc9`.
- Provenance: `SPAN-BA05ABF856609554`; clauses: `B2052:C1`.

#### NFR-DATASERVICE-005

> perf-005 warm 5m boll定义为cold baseline l1 l2和lmdb已建立后 再次打开相同active/interval/range到三条真实plotdataitem有效的时间

- Source: `NFR-DATASERVICE-005`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:40fade7b12d610fc4a611b67753e9fa9038ce7d394fc29149a83ee0afc51f4c5`.
- Provenance: `SPAN-A03A9B132EA3C687`; clauses: `B2054:C1`.
- Condition (unevaluated):

  > PERF-005：warm 5m BOLL定义为cold baseline、L1、L2和LMDB已建立后，再次打开相同active/interval/range到三条真实PlotDataItem有效的时间。


#### NFR-DATASERVICE-006

> perf-006 candidate冷启动首帧p50和p95均不得高于baseline

- Source: `NFR-DATASERVICE-006`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:d134311d7d5c9fedc6d2a238d010e5036a4679facc313eb2a9590ba02074d2ed`.
- Provenance: `SPAN-79D02ABA652CB658`; clauses: `B2056:C1`.

#### NFR-DATASERVICE-007

> perf-007 candidate warm 5m boll p50和p95均不得高于baseline的80

- Source: `NFR-DATASERVICE-007`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:86513cb487757e76faaa34b5eea7b94250701ceacc8ef201b533ca199eb3254d`.
- Provenance: `SPAN-0E88DCA619A77FAE`; clauses: `B2058:C1`.

#### NFR-DATASERVICE-008

> perf-008 每个tick的db全范围读取次数为0

- Source: `NFR-DATASERVICE-008`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:ad7d35f6ee94273125af3d1cde4560a82dddc218f12889d49f42757cd27d48b7`.
- Provenance: `SPAN-F73E27627F79914C`; clauses: `B2060:C1`.

#### NFR-DATASERVICE-009

> perf-009 每个tick的完整历史snapshot重建次数为0

- Source: `NFR-DATASERVICE-009`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:f6917f0a65936df70ea907fe33fe07e61aacaa2f6c7eb079dbb5c7fb40760ab9`.
- Provenance: `SPAN-BF43DEC4BD3B7924`; clauses: `B2062:C1`.

#### NFR-DATASERVICE-010

> perf-010 每个tick的新gds allocation次数为0

- Source: `NFR-DATASERVICE-010`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:88de8e32ca72daae7407a5940c645f6597fc73ba06f8c60fea1ed1203c3d3919`.
- Provenance: `SPAN-73AE512125C0FA40`; clauses: `B2064:C1`.

#### NFR-DATASERVICE-011

> perf-011 每个canonical 1m rollover的 completedrolloverbatch log append次数为1 batch sequence增量为1

- Source: `NFR-DATASERVICE-011`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:b843749d2c22d9e9299bb7658fdeb674708c24160932312648bc79b0eabd18d7`.
- Provenance: `SPAN-3FC3A18AA0618CE0`; clauses: `B2066:C1, B2066:C2`.

#### NFR-DATASERVICE-012

> perf-012 同一series sequence的descriptor publish次数为1

- Source: `NFR-DATASERVICE-012`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:06bde65668944ac023ca96072d032dfd4a4f8c61f24c79d12ad15509a661066f`.
- Provenance: `SPAN-7F332FE35A1920DF`; clauses: `B2068:C1`.

#### NFR-DATASERVICE-013

> perf-013 增加指标数量不重复读取相同1m/period db范围 不复制完整gds

- Source: `NFR-DATASERVICE-013`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:f1a3741a3f1b078186bc374cc146eed693939680d3e18b64370c918515d953b0`.
- Provenance: `SPAN-08721EF8518B7A66`; clauses: `B2070:C1`.

#### NFR-DATASERVICE-014

> perf-014 ui主线程多周期聚合 指标计算和db query次数均为0

- Source: `NFR-DATASERVICE-014`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:ae928ab36a065192a0c6eba99f57b45657c62f674408e39ecab75d349882f64a`.
- Provenance: `SPAN-5BC10623EB323F44`; clauses: `B2072:C1`.

#### NFR-DATASERVICE-015

> perf-015 compatibility bridge单独测量event_tick/oms o 1 成本

- Source: `NFR-DATASERVICE-015`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:67cf8e45526917c152aa1a68208e4493cc29ccd4450845fe93fce5aab3daa0a0`.
- Provenance: `SPAN-1B634D667E79B2D5`; clauses: `B2074:C1, B2074:C2`.

#### NFR-DATASERVICE-016

> perf-016 trigger命中到orderexecutiongate入口不得等待下一次event_timer

- Source: `NFR-DATASERVICE-016`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:66199f03972c08a90d98189651c91b704fd1956c8cfed0e1098cd18b82864b2f`.
- Provenance: `SPAN-DC513010E861AF95`; clauses: `B2076:C1, B2076:C2`.

#### NFR-DATASERVICE-017

> perf-017 recorder tick和1m db调用次数等于timer flush批次数 不等于tick或1m数量

- Source: `NFR-DATASERVICE-017`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:7b080de0d6cc6409d908e76ce9f53e48319664c733b0c3725de3d9ede1dd34f1`.
- Provenance: `SPAN-5BCF5FE51DD232C9`; clauses: `B2078:C1, B2078:C2`.

#### NFR-DATASERVICE-018

> perf-018 性能命令固定为 python -m pytest -q tests/performance/test_dataservice_legacy_chain_benchmark.py --benchmark-json .artifacts/goal/dataservice-cold-hot-legacy-chain/performance/candidate.json

- Source: `NFR-DATASERVICE-018`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:4b51fd5d7a0e17cf523ca136e7f5e8cb34f1007acb4ff487f90dc997c2f262d7`.
- Provenance: `SPAN-47AD25D23A02AC44`; clauses: `B2080:C1`.

#### NFR-DATASERVICE-019

> perf-019 原始结果 环境指纹 fixture manifest和sha-256写入 .artifacts/goal/dataservice-cold-hot-legacy-chain/performance/

- Source: `NFR-DATASERVICE-019`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:6b6b6fa2e4c75d1fcdd6b4ebac6f11fe284b7ce1abbdf7974e0ff39486f120d9`.
- Provenance: `SPAN-BBEDD3DF0634541F`; clauses: `B2082:C1`.

#### NFR-DATASERVICE-020

> perf-020 缺少可重复真实fixture时 goal合同必须返回 blocked_by_contract_ambiguity:performance_dataset 禁止用随机数据替代

- Source: `NFR-DATASERVICE-020`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:5126518bd798ee92f3cf3ec7a37e5cf63cc91eb9421cc7b84ae65a3a176c17ae`.
- Provenance: `SPAN-3EAFA6C1BA228EDE`; clauses: `B2084:C1`.
- Condition (unevaluated):

  > PERF-020：缺少可重复真实fixture时，Goal合同必须返回`blocked_by_contract_ambiguity:performance_dataset`，禁止用随机数据替代。


#### REQ-DATASERVICE-069

> precontract-001 goal合同生成前必须执行fixture-008

- Source: `REQ-DATASERVICE-069`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:a91330b546022299ee8447c9a4d47456adc8a16a441ceae8a365168f95dd372a`.
- Provenance: `SPAN-B27B6435CE29327F`; clauses: `B2090:C1, B2090:C2, B2090:C3, B2090:C4`.
- Condition (unevaluated):

  > PRECONTRACT-001：Goal合同生成前必须执行FIXTURE-008。 AND manifest 为`PASS_OFFLINE_LIVE_PENDING`且实时场景仅标记`blocked_until_market_open:<scenario>`时，合同生成器才生成包含离线任务和实时阻塞验收的冻结合同； AND 不得把寻找离线数据留给实施阶段，也不得把实时阻塞场景标记为通过。 AND 离线 fixture 不存在或 manifest 离线字段不完整时立即返回`blocked_by_contract_ambiguity:performance_dataset`；


#### NFR-DATASERVICE-021

> quality-001 每个work修改python后必须对该work实际修改文件执行 python -m compileall -q 精确文件列表 关键模块import和对应pytest collect-only

- Source: `NFR-DATASERVICE-021`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:e13c4996b08ee570569592ef7ac3e76d94bd78485c2748f060dbe98b3f09f0fe`.
- Provenance: `SPAN-783F497E768722DB`; clauses: `B2092:C1, B2092:C2, B2092:C3`.

#### NFR-DATASERVICE-022

> quality-002 所有qt绿灯/回归命令直接在当前powershell先设置 env:qt_qpa_platform offscreen 不嵌套第二个 pwsh -command

- Source: `NFR-DATASERVICE-022`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:95124985b2452b018600d06370cd78226cc9e6358a08cfb066d3ab519ce0b0a3`.
- Provenance: `SPAN-0B78E6F649EB278F`; clauses: `B2094:C1, B2094:C2`.

#### REQ-DATASERVICE-070

> req-agg-001 canonical 1m聚合的open为该分钟第一笔accepted tick price

- Source: `REQ-DATASERVICE-070`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:99a5c4ee5c9d42fa31edea72a071ad421507ec796f5b04820ebc85165deb3cec`.
- Provenance: `SPAN-931EC99C840CD0A3`; clauses: `B1021:C1, B1021:C2, B1021:C3`.

#### REQ-DATASERVICE-071

> req-agg-002 volume turnover和open interest逐字段保持 822c715e6 bargenerator语义

- Source: `REQ-DATASERVICE-071`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:c02574ec0d14edce62f0584e6b8e9152d7ebf3d2d3f7053c9a0c887a84582e13`.
- Provenance: `SPAN-95E488FB54C4B643`; clauses: `B1023:C1, B1023:C2`.

#### REQ-DATASERVICE-072

> req-agg-003 发现tick进入新分钟时 必须先完成上一根1m 再创建新1m

- Source: `REQ-DATASERVICE-072`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:ebcf1daf34000b0c01c3eaf742fb8830487ed75fdb001135ec2d5e92ed1d45b2`.
- Provenance: `SPAN-69C5C471AE857D36`; clauses: `B1025:C1, B1025:C2`.

#### REQ-DATASERVICE-073

> req-agg-004 5m 15m 30m 45m 1h 4h和daily从canonical 1m增量聚合 使用统一period authority

- Source: `REQ-DATASERVICE-073`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:856b4fc5525a96e9fe5cee8e520572316693862c1c8a6eaf7e504c51135bb83e`.
- Provenance: `SPAN-5D2E6F69E6F44A27`; clauses: `B1027:C1`.

#### REQ-DATASERVICE-074

> req-agg-005 每根completed 1m只进入每个目标period accumulator一次

- Source: `REQ-DATASERVICE-074`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:5ad42f2c455d5ca05aeeb4fdc0a50abfdbca9d5a07cf22eba4be2bce6e18c3c0`.
- Provenance: `SPAN-990C5035429AD250`; clauses: `B1029:C1, B1029:C2`.

#### REQ-DATASERVICE-075

> req-agg-006 current 4h和daily可由 db completed 1m period前缀 dataservice current 1m 建立

- Source: `REQ-DATASERVICE-075`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:549ea331114b1dd29ea5f6c3564f4a39830768bdcc30c0a496f15a4720880fe4`.
- Provenance: `SPAN-926403A4C3EA1682`; clauses: `B1031:C1, B1031:C2`.
- Condition (unevaluated):

  > REQ-AGG-006：current 4H和DAILY可由“DB completed 1m period前缀 + DataService current 1m”建立； AND 不得用Tick日开字段或启动后第一笔价格覆盖真实period open。


#### REQ-DATASERVICE-076

> req-agg-007 若真实period-start 1m不存在 必须发精确gap request

- Source: `REQ-DATASERVICE-076`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:9c7a96b643e7ef1d1704c5ca8da3e389ed134c49cf7eee2b55063b2a1de4029d`.
- Provenance: `SPAN-68BA5156F92062E9`; clauses: `B1033:C1, B1033:C2, B1033:C3`.

#### REQ-DATASERVICE-077

> req-agg-008 v1 4h/daily和v2 4h/daily边界分别测试

- Source: `REQ-DATASERVICE-077`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:016e8d0cfbec87ca775868d8abf437f3a07b6915734cfd279b2c20836e8b5a8b`.
- Provenance: `SPAN-B052D9C8ADF074DE`; clauses: `B1035:C1, B1035:C2`.

#### REQ-DATASERVICE-078

> req-auth-001 822c715e6 是指标公式 指标输入 l1/l2/lmdb 映射 绘制 recorder 业务时机 主连映射顺序和 vn.py 回调语义的行为基线

- Source: `REQ-DATASERVICE-078`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:8e053732100640789ec27d6fe902430ef4bb64fe13853b44bbfd63a9ca2c810d`.
- Provenance: `SPAN-8B9647638C62F44B`; clauses: `B0082:C1`.
- Condition (unevaluated):

  > REQ-AUTH-001：`822c715e6` 是指标公式、指标输入、L1/L2/LMDB、映射、绘制、Recorder 业务时机、主连映射顺序和 vn.py 回调语义的行为基线。


#### REQ-DATASERVICE-079

> req-auth-002 hkfe v2 只覆盖时段切换 2026-07-20 17:00 及之后夜盘起点为 17:00

- Source: `REQ-DATASERVICE-079`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:f0d6de8840bbca4a21028950a4322719f5568fc0882214d6d8c55e65dd97f3b5`.
- Provenance: `SPAN-E49736BC92B7E1E1`; clauses: `B0084:C1, B0084:C2, B0084:C3`.
- Condition (unevaluated):

  > REQ-AUTH-002：HKFE V2 只覆盖时段切换：`2026-07-20 17:00` 及之后夜盘起点为 `17:00`； AND 历史数据必须按 bar 市场时间选择 V1 或 V2，禁止按程序当前日期统一回算。 AND 此前仍为 `17:15`。


#### NEG-DATASERVICE-004

> req-auth-003 当前代码中的 revision winner 业务 snapshot 权威 只含 completed 的指标输入旁路 服务端冻结旧视图 查询 ttl 普通 descriptor lease recorder 配置两阶段事务和实时 k_1m seed 均不得因为已经存在而被认定为需求

- Source: `NEG-DATASERVICE-004`; role: `boundary`; strength: `must`; polarity: `forbidden`.
- Source text hash: `sourceTextHash=sha256:5d3a72dd0f8cc12d7064f02c76d8bc272d896ca98f065de122f625ef6c32418c`.
- Provenance: `SPAN-855C0F5275CD3625`; clauses: `B0086:C1`.
- Condition (unevaluated):

  > REQ-AUTH-003：当前代码中的 revision winner、业务 snapshot 权威、只含 completed 的指标输入旁路、服务端冻结旧视图、查询 TTL、普通 descriptor lease、Recorder 配置两阶段事务和实时 `K_1M` seed，均不得因为已经存在而被认定为需求。


#### REQ-DATASERVICE-080

> req-auth-004 实现与本文件冲突时必须修改实现

- Source: `REQ-DATASERVICE-080`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:0fbdf1f6d122614f2841da248077c5b5c600d4088540695abb97fb83906de37e`.
- Provenance: `SPAN-3552CBDD0D2397DC`; clauses: `B0088:C1, B0088:C2`.
- Condition (unevaluated):

  > REQ-AUTH-004：实现与本文件冲突时必须修改实现； AND 测试与本文件冲突时必须先判定测试无效，再按真实生产链重写测试。


#### REQ-DATASERVICE-081

> req-auth-005 无法从本文件 822c715e6 时段权威提交和实际仓库路径确定的业务决策必须失败关闭 返回 blocked_by_contract_ambiguity: exact_field 不得自行扩展语义

- Source: `REQ-DATASERVICE-081`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:5c07d5186466715f4e77cbb13b8873a96a5fecc615247d5595027e4f27378b98`.
- Provenance: `SPAN-D0EB6F43281C91B9`; clauses: `B0090:C1`.
- Condition (unevaluated):

  > REQ-AUTH-005：无法从本文件、`822c715e6`、时段权威提交和实际仓库路径确定的业务决策必须失败关闭，返回 `blocked_by_contract_ambiguity:<exact_field>`，不得自行扩展语义。


#### REQ-DATASERVICE-082

> req-boot-001 process_ready之前不得接受业务命令

- Source: `REQ-DATASERVICE-082`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:c1e43a660e226a2d2ede8e34ab169251f021d60c0cd66d52bfb9d7d1e9b777eb`.
- Provenance: `SPAN-C052587FC185848C`; clauses: `B0985:C1, B0985:C2`.
- Condition (unevaluated):

  > PROCESS_READY之后DataManager可使用history request，禁止等待全局数据状态。 AND REQ-BOOT-001：PROCESS_READY之前不得接受业务命令；


#### NEG-DATASERVICE-005

> req-boot-002 active_ack之前任何消费者不得把目标symbol视为当前可写active stream

- Source: `NEG-DATASERVICE-005`; role: `boundary`; strength: `must`; polarity: `forbidden`.
- Source text hash: `sourceTextHash=sha256:6135ac06a6eb8d93c4ed13cf1f13a45b5c829f4f159b7456c9bb2ef706baf79e`.
- Provenance: `SPAN-ADE75741CDAAA2D3`; clauses: `B0987:C1`.
- Condition (unevaluated):

  > REQ-BOOT-002：ACTIVE_ACK之前任何消费者不得把目标symbol视为当前可写active stream。


#### REQ-DATASERVICE-083

> req-boot-003 range complete之前图表和指标不得消费该range的未验证descriptor

- Source: `REQ-DATASERVICE-083`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:aa22ddb3bfafbe4a4b4eccc0d33dd5f7b78adeafb5a4881db453c5d01ea4dee3`.
- Provenance: `SPAN-A2F0FFBCADC258DF`; clauses: `B0989:C1, B0989:C2`.

#### REQ-DATASERVICE-084

> req-boot-004 启动缓存使用dataservice内部有界sequence buffer

- Source: `REQ-DATASERVICE-084`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:3323ebddc5e9ee2b0c853a73dce8804b171e1773eaba834c52973c183c811fdd`.
- Provenance: `SPAN-1CA02DEA75E8E4E9`; clauses: `B0991:C1, B0991:C2`.

#### NEG-DATASERVICE-006

> req-boot-005 启动不订阅 不等待 不消费实时 k_1m

- Source: `NEG-DATASERVICE-006`; role: `boundary`; strength: `must`; polarity: `forbidden`.
- Source text hash: `sourceTextHash=sha256:e4ac7b6de0a6bff6c37d901882dc34eb9d60dfd0c9e4e16c3a64eb37548bbe6a`.
- Provenance: `SPAN-805206173A3D54BD`; clauses: `B0993:C1`.
- Condition (unevaluated):

  > REQ-BOOT-005：启动不订阅、不等待、不消费实时`K_1M`。


#### REQ-DATASERVICE-085

> req-boot-006 启动coverage范围只来自 822c715e6 datamanager现有启动配置

- Source: `REQ-DATASERVICE-085`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:93a81e8bf71298e584212913abf5b4fff7dabf0711ed8e03e9d152e98a5dbb63`.
- Provenance: `SPAN-AC16A3982B35B29E`; clauses: `B0995:C1, B0995:C2`.

#### REQ-DATASERVICE-086

> req-boot-007 启动期间收到的规范化tick只向tickdatabus和外部逐tick消费者发布一次

- Source: `REQ-DATASERVICE-086`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:1ef3c6af30559d159058ba7cf5d4a6306606f52680ba55ba1d1ed30786521fc6`.
- Provenance: `SPAN-E08AED88C4149541`; clauses: `B0997:C1, B0997:C2`.

#### REQ-DATASERVICE-087

> req-boot-008 dataservice重启时 service_generation 递增 旧 stream_key 标记aborted

- Source: `REQ-DATASERVICE-087`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:480dde655b5ce35152f3243423ec39eeea207e7e4092d191327f35b9b2dd1e53`.
- Provenance: `SPAN-44C4F72AA375A86C`; clauses: `B0999:C1, B0999:C2, B0999:C3`.

#### REQ-DATASERVICE-088

> req-callback-001 gateway/eventengine/oms cta trigger execution quote和recorder各消费同一raw tick语义 但拥有独立cursor和独立职责

- Source: `REQ-DATASERVICE-088`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:80daa1b4245bab62ea0d5e6d4ad829ed95cae84460b3959500000be864ef38b3`.
- Provenance: `SPAN-51FCD5469BCDBAFA`; clauses: `B1166:C1`.

#### REQ-DATASERVICE-089

> req-callback-002 cta生产链固定为

- Source: `REQ-DATASERVICE-089`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:79a5bfa829167dd21a8a41d908e965b74677df86aaa2d22199460c6a9a235421`.
- Provenance: `SPAN-DED1E10302AE3032`; clauses: `B1168:C1, B1170:C1`.

#### REQ-DATASERVICE-090

> req-callback-003 dataservice canonical completed bar直接调用cta process_bar_event 的次数为0 防止策略bar回调双发

- Source: `REQ-DATASERVICE-090`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:ba32c87984fd117a649d56a77eaa61571b28f6472f3fbbeb4cc465c4e9f66238`.
- Provenance: `SPAN-11C89AE5B9016974`; clauses: `B1172:C1`.

#### REQ-DATASERVICE-091

> req-callback-004 主进程compatibility bridge必须是标准 event_tick 和symbol-specific tick事件的唯一publisher

- Source: `REQ-DATASERVICE-091`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:c293d14e660baf818be5a557f045ab7396bb54f4b92f0ef1a7e3bb863e1eae86`.
- Provenance: `SPAN-2841BDE68E4001BD`; clauses: `B1174:C1, B1174:C2`.

#### REQ-DATASERVICE-092

> req-callback-005 omsengine只更新latest tick及 822c715e6 已有轻量副作用

- Source: `REQ-DATASERVICE-092`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:16f0bc9a5fa49b43dccb1d3fd22107a2cb2bc26f003a682c238e249ade44c477`.
- Provenance: `SPAN-C3C455DAFE4B5573`; clauses: `B1176:C1, B1176:C2`.

#### REQ-DATASERVICE-093

> req-callback-006 marketmonitor和tradingwidget可合并ui repaint 但不能用各自100ms轮询替代eventengine事件

- Source: `REQ-DATASERVICE-093`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:12439c87a089316e02e86537085a2ee9026200dd6c4a2880325dbfe3a70eb1a5`.
- Provenance: `SPAN-5DD30B1888D154B8`; clauses: `B1178:C1, B1178:C2`.

#### REQ-DATASERVICE-094

> req-callback-007 mainengine.get_tick 必须返回当前active canonical tick 驱动手工对手价 超价 市价 下单前校验和图表交易交互

- Source: `REQ-DATASERVICE-094`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:d979ddff383dd7f04efdbda28fc679fd9c8e5d38aaaff180a93e4edf589357f4`.
- Provenance: `SPAN-6532EF00707B5F3A`; clauses: `B1180:C1`.
- Condition (unevaluated):

  > REQ-CALLBACK-007：`MainEngine.get_tick()`必须返回当前active canonical Tick，驱动手工对手价、超价、市价、下单前校验和图表交易交互。


#### REQ-DATASERVICE-095

> req-callback-008 futu追价使用execution quote consumer在每次新tick到达时唤醒等价旧 _try_replace_on_tick

- Source: `REQ-DATASERVICE-095`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:a5cfdfb5f2b5e1367854982a2e70746118a50f759d88ea7d988bfa009feababa`.
- Provenance: `SPAN-A006F930338D4A8D`; clauses: `B1182:C1, B1182:C2`.

#### REQ-DATASERVICE-096

> req-callback-009 trigger逐tick判断并发送candidate

- Source: `REQ-DATASERVICE-096`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:705e4f52ebb4817a2791690efdbbd909390e8767d60bbcf8fb4b7ef4dd4eaa6b`.
- Provenance: `SPAN-2F92D19BE5306670`; clauses: `B1184:C1, B1184:C2`.

#### REQ-DATASERVICE-097

> req-callback-010 candidate和ack identity固定为 service_generation active_generation candidate_id

- Source: `REQ-DATASERVICE-097`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:8ad8eefda20dcf623c061cdf364a8bead6063b623694a2c5d5d3e2146eb6d0d0`.
- Provenance: `SPAN-73D98A0B3668DD58`; clauses: `B1186:C1, B1186:C2, B1186:C3`.

#### NEG-DATASERVICE-007

> req-callback-011 主进程每tick禁止执行k线聚合 指标计算 db查询 全量shm复制和同步plotdataitem更新

- Source: `NEG-DATASERVICE-007`; role: `boundary`; strength: `must`; polarity: `forbidden`.
- Source text hash: `sourceTextHash=sha256:80dea63c91b85be71fdd23745723d08f5c726e4c6bd7e6f637ad94cf405e725f`.
- Provenance: `SPAN-5E84EF091A75BEF8`; clauses: `B1188:C1`.

#### REQ-DATASERVICE-098

> req-callback-012 trigger只有自身tickdatabus cursor真实overrun时进入短暂 unprotected

- Source: `REQ-DATASERVICE-098`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:b4f2fc8e2816b7d4fae3a6528115c9e48557045db5a28cbc1765bc2c3cf26714`.
- Provenance: `SPAN-1F35A519929AC9D0`; clauses: `B1190:C1, B1190:C2, B1190:C3`.

#### REQ-DATASERVICE-099

> req-callback-013 orderintent复用现有 actual_vt_symbol

- Source: `REQ-DATASERVICE-099`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:d56c07dd3c3ae36e10e4f7b8baf53c78cdb7123107238ded3f3d74d87a776c6a`.
- Provenance: `SPAN-E6B1887F460F3BC2`; clauses: `B1192:C1, B1192:C2, B1192:C3`.

#### REQ-DATASERVICE-100

> req-cold-001 cold只来源于db

- Source: `REQ-DATASERVICE-100`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:a5f002b77e63e3866f7d76d976ed9a55e21be026c08053e95e9c469139a5d8f0`.
- Provenance: `SPAN-793F2FDD9876E1DD`; clauses: `B0900:C1`.

#### REQ-DATASERVICE-101

> req-cold-002 cold只包含 datetime_end none 的completed bars

- Source: `REQ-DATASERVICE-101`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:f7be7b817d65bb3f4ba8b7d702843d720bd15ec26dd981b7c12943a84931cd0a`.
- Provenance: `SPAN-1248903883A64A93`; clauses: `B0902:C1`.

#### REQ-DATASERVICE-102

> req-cold-003 db内 datetime_end none 的bar数量必须始终为0

- Source: `REQ-DATASERVICE-102`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:c7ec5707faae9c5f9cb8b681e513ce871d34409e0c66c8b82ce22fb5b8fce788`.
- Provenance: `SPAN-C0B2954DFD63E8BF`; clauses: `B0904:C1, B0904:C2`.

#### REQ-DATASERVICE-103

> req-cold-004 cold在以下事件发生时加载或局部刷新

- Source: `REQ-DATASERVICE-103`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:af944780097acc53334e47ed8614ac87f8853ca8b4404f12ba0a2f23d881117d`.
- Provenance: `SPAN-B29939F36651E9BD`; clauses: `B0906:C1, B0908:C1, B0909:C1, B0910:C1, B0911:C1, B0912:C1, B0913:C1`.
- Condition (unevaluated):

  > - DataService中断造成completed范围未知，启动coverage修复完成后。 AND - active启动后的首次range request。 AND - 请求范围超出当前cache coverage。 AND REQ-COLD-004：cold在以下事件发生时加载或局部刷新： AND REQ-COLD-004：cold在以下事件发生时加载或局部刷新：


#### NEG-DATASERVICE-008

> req-cold-005 普通tick current更新 recorder commit recorder ack 图表paint drag和zoom不得触发全范围db读取

- Source: `NEG-DATASERVICE-008`; role: `boundary`; strength: `must`; polarity: `forbidden`.
- Source text hash: `sourceTextHash=sha256:55d83fd0aa40c564b2d3e2be4c099d7d6d2369f9a2f6d88a14fa5d14282a00ea`.
- Provenance: `SPAN-D063B5835EF38585`; clauses: `B0915:C1`.

#### REQ-DATASERVICE-104

> req-cold-006 cold range cache按canonical symbol interval和range保存db completed结果

- Source: `REQ-DATASERVICE-104`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:d6d46e178e89100cc9375ea36dcb4bd54d606b7d7fa44ddc54810fe978c68554`.
- Provenance: `SPAN-2F6E4BC854BC338F`; clauses: `B0917:C1, B0917:C2`.

#### REQ-DATASERVICE-105

> req-cold-007 changed range只失效相交范围

- Source: `REQ-DATASERVICE-105`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:96a8b481c317b7724c50ebb28ce16f6da2cb5413149518e4419e5ca1c35bb060`.
- Provenance: `SPAN-8322558B1C382942`; clauses: `B0919:C1, B0919:C2, B0919:C3`.

#### REQ-DATASERVICE-106

> req-current-001 每个 canonical_vt_symbol interval 最多一根current

- Source: `REQ-DATASERVICE-106`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:5ba63cd5283e9e55f9fd692dc63afd9bd7c4ec40e29b49c4531701222e3c6eb1`.
- Provenance: `SPAN-95638C192F471C27`; clauses: `B0941:C1`.

#### REQ-DATASERVICE-107

> req-current-002 current只来源于dataservice实时聚合 满足 datetime_end none

- Source: `REQ-DATASERVICE-107`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:d90f0083509ff1967e1e3339ef897b81ad59690ecf02674f649da45719797ed2`.
- Provenance: `SPAN-77B4B15FCF8833C5`; clauses: `B0943:C1`.
- Condition (unevaluated):

  > REQ-CURRENT-002：current只来源于DataService实时聚合，满足`datetime_end == None`。


#### REQ-DATASERVICE-108

> req-current-003 current必须位于effective series最后

- Source: `REQ-DATASERVICE-108`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:ba8a51455d47a2a9ea8763f6f27ad477f511b18719a9bd6b560c7b0d54561c0a`.
- Provenance: `SPAN-C6E940EAB64AC69D`; clauses: `B0945:C1, B0945:C2`.
- Condition (unevaluated):

  > REQ-CURRENT-003：current必须位于effective series最后； AND 不存在current时completed末尾仍有效。


#### REQ-DATASERVICE-109

> req-current-004 同一period内accepted tick只原位更新current的high low close volume turnover open_interest和最后事件元数据

- Source: `REQ-DATASERVICE-109`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:d851dba3706bb54c84baa04b0a4d66db0d8cb7e0ba1d0079efaed73230bdfe63`.
- Provenance: `SPAN-947A75DFE6092AF8`; clauses: `B0947:C1, B0947:C2`.

#### REQ-DATASERVICE-110

> req-current-005 rollover在dataservice ingress线程内原子执行

- Source: `REQ-DATASERVICE-110`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:db84f794937936d59852bf45cfa34bc86ce6c485a37d0c162115640282224b6f`.
- Provenance: `SPAN-0BF3D20FDF1249F6`; clauses: `B0949:C1, B0951:C1, B0953:C1, B0953:C2`.

#### REQ-DATASERVICE-111

> req-current-006 迟到到已completed period的tick不得重新打开或静默修改completed bar

- Source: `REQ-DATASERVICE-111`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:c1498afb972c49a7aebc1dd2b2bc6f7588f36b73e12dbfe6d5bb11756f968d95`.
- Provenance: `SPAN-03B3B0EBBEE2CCC5`; clauses: `B0955:C1, B0955:C2`.

#### REQ-DATASERVICE-112

> req-data-001 bar identity固定为

- Source: `REQ-DATASERVICE-112`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:cafd6866742a4ed4c25622f2839a6a3a3176278d1ca21a325d637409c20252e2`.
- Provenance: `SPAN-BAC3D75BDBAEEF94`; clauses: `B0873:C1, B0875:C1`.

#### REQ-DATASERVICE-113

> req-data-002 period_start 必须通过现有 vnpy/trader/period_utils.py vnpy/trader/hkfe_period_common.py 和 vnpy/trader/hkfe_bar_generator.py 规则计算

- Source: `REQ-DATASERVICE-113`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:2dd67d063277cadfe8ea8f80a7484a03b9a8fe8e0678d88408180c863bb094d6`.
- Provenance: `SPAN-51B19350189E0716`; clauses: `B0877:C1, B0877:C2`.

#### REQ-DATASERVICE-114

> req-data-003 2026-07-20 17:00 之前的hkfe bar使用v1

- Source: `REQ-DATASERVICE-114`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:536b1daca77776efaae5c8cb391c239603da65efd7cb4eba8db9e3a6a35a7095`.
- Provenance: `SPAN-8536526EF8A5E216`; clauses: `B0879:C1, B0879:C2, B0879:C3`.

#### REQ-DATASERVICE-115

> req-data-004 completed比较字段固定为

- Source: `REQ-DATASERVICE-115`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:f8ffac64c0b0a22fe226fd752dcbd8323eb4a905116bc1b1e2c1434a9868446e`.
- Provenance: `SPAN-6D2C419AC5628F41`; clauses: `B0881:C1, B0883:C1, B0884:C1, B0885:C1, B0886:C1, B0887:C1, B0888:C1, B0889:C1, B0890:C1, B0891:C1, B0892:C1, B0893:C1, B0894:C1`.

#### REQ-DATASERVICE-116

> req-data-005 gateway_name revision series sequence transport sequence process generation active generation shm名称和来源标签不是k线内容字段

- Source: `REQ-DATASERVICE-116`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:876a5c2e3413419c833af255757badd86e3ebc20e2d970dff8af0cd7da5e0469`.
- Provenance: `SPAN-D49BA5962E95B6C4`; clauses: `B0896:C1`.

#### REQ-DATASERVICE-117

> req-flow-001 全程序同时仅有一个 active 行情合约

- Source: `REQ-DATASERVICE-117`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:b83611a8ac3d4446220e6a65fd61063caa28024f51c8d44d5d72d3ae117226c1`.
- Provenance: `SPAN-55690637FF8A3BFA`; clauses: `B0100:C1, B0100:C2, B0100:C3, B0100:C4`.

#### NEG-DATASERVICE-009

> req-flow-002 合约目录 历史查询 recorder 保存配置和图表 interval 切换都不得创建第二个实时订阅合约

- Source: `NEG-DATASERVICE-009`; role: `boundary`; strength: `must`; polarity: `forbidden`.
- Source text hash: `sourceTextHash=sha256:9cfa9c768e0cf1f5624b2374eee5b86339a7036495c0e33bdc851301910cc437`.
- Provenance: `SPAN-AAA0CECDD5CF2926`; clauses: `B0102:C1`.
- Condition (unevaluated):

  > REQ-FLOW-002：合约目录、历史查询、Recorder 保存配置和图表 interval 切换都不得创建第二个实时订阅合约。


#### REQ-DATASERVICE-118

> req-flow-003 recorder 中保存但不是当前 active 的合约配置保持 dormant

- Source: `REQ-DATASERVICE-118`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:daf6892401f08398bd3448fa6d7d1500ba322bbe5073777e63f45a03932d6016`.
- Provenance: `SPAN-9AED74DFA0117E14`; clauses: `B0104:C1, B0104:C2`.
- Condition (unevaluated):

  > REQ-FLOW-003：Recorder 中保存但不是当前 active 的合约配置保持 dormant。 AND 切换到该合约时先由 DataManager 完成目标历史缺口检查和补齐，再建立唯一实时流。


#### NEG-DATASERVICE-010

> req-flow-004 供应商行情不提供可证明的逐笔全序列 因此本地 tick_sequence 跳号或连续都不能证明市场 tick 是否缺失

- Source: `NEG-DATASERVICE-010`; role: `boundary`; strength: `must`; polarity: `forbidden`.
- Source text hash: `sourceTextHash=sha256:24ce8cb7b662d5af3c0bcb63b07a1d65b939c0d20783306b6fafc57c8201ed95`.
- Provenance: `SPAN-27FC02B44472F7B1`; clauses: `B0130:C1`.

#### REQ-DATASERVICE-119

> req-flow-005 旧版 tick 限流有意跳过部分同周期 tick

- Source: `REQ-DATASERVICE-119`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:4347ed5e16c29fe23636c46137367f689a943cdf152a7409a66614241b5785bb`.
- Provenance: `SPAN-A8988AB069B431E8`; clauses: `B0132:C1, B0132:C2`.

#### REQ-DATASERVICE-120

> req-flow-006 tickdatabus consumer cursor 落后并被 ring 覆盖 表示该消费者发生 transport overrun

- Source: `REQ-DATASERVICE-120`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:c1fe005bc419e600afc288947a6f7862f7f1af6db5b68ff51f9c0764c7986de5`.
- Provenance: `SPAN-A7DC062C24DE9954`; clauses: `B0134:C1, B0134:C2`.

#### REQ-DATASERVICE-121

> req-flow-007 历史 k 线完整性只通过交易日历 v1/v2 交易时段和 requested completed 1m identities 检查

- Source: `REQ-DATASERVICE-121`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:89a138ff4371138145b9ae51615bfefb6031ca4d1714ba35b7c885d9d6991240`.
- Provenance: `SPAN-8ABC9B3DB3C18068`; clauses: `B0136:C1, B0136:C2`.
- Condition (unevaluated):

  > REQ-FLOW-007：历史 K 线完整性只通过交易日历、V1/V2 交易时段和 requested completed 1m identities 检查。 AND 发现头部、中间或尾部 completed 1m 缺口时才进入 DataManager 缺口修复。


#### REQ-DATASERVICE-122

> req-flow-008 实时流身份固定为

- Source: `REQ-DATASERVICE-122`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:07c489df545dad42cbd88f39af2d6d0ed6f02c2b2000d3ccffbdc118d1c2550c`.
- Provenance: `SPAN-5E5C117E2DC2F716`; clauses: `B0156:C1, B0158:C1, B0160:C1, B0161:C1, B0162:C1, B0163:C1, B0164:C1`.

#### REQ-DATASERVICE-123

> req-flow-009 用户切换 logical active 的顺序固定为

- Source: `REQ-DATASERVICE-123`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:81a9b05ec9f06eedc8978b5c367f8b9509e880b2e89635ad657745f65bd2731d`.
- Provenance: `SPAN-024056BBC4BB66E0`; clauses: `B0166:C1, B0168:C1, B0170:C1, B0171:C1, B0171:C2, B0172:C1, B0173:C1, B0174:C1, B0174:C2`.

#### REQ-DATASERVICE-124

> req-flow-010 一次 canonical 1m rollover 的 completed 发布粒度固定为

- Source: `REQ-DATASERVICE-124`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:c2a081607ccd77074bc30305ae5a5d65d9eba33d72fc7764d8389726ba22de18`.
- Provenance: `SPAN-7CED7281953E95AD`; clauses: `B0176:C1, B0178:C1, B0180:C1, B0181:C1, B0181:C2, B0182:C1, B0182:C2, B0183:C1, B0183:C2, B0183:C3`.

#### REQ-DATASERVICE-125

> req-gap-001 ensure_coverage根据交易日历 休市 半日市 v1/v2时段和请求范围计算expected completed 1m identities

- Source: `REQ-DATASERVICE-125`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:98a340f2028593404e174b8922b5050103925dc93d7de1ffcc5917176f8e37d1`.
- Provenance: `SPAN-031E14D89EB00F1C`; clauses: `B1043:C1`.
- Condition (unevaluated):

  > REQ-GAP-001：ensure_coverage根据交易日历、休市、半日市、V1/V2时段和请求范围计算expected completed 1m identities。


#### REQ-DATASERVICE-126

> req-gap-002 必须检测头部 中间和尾部缺口

- Source: `REQ-DATASERVICE-126`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:6e9024ccdd564d0274f2292b8ab83dacc3cf9e960575e3021ad4595c7d56d5a6`.
- Provenance: `SPAN-B2C879B812D5FC6A`; clauses: `B1045:C1, B1045:C2`.

#### REQ-DATASERVICE-127

> req-gap-003 下载范围必须是缺失或冲突所需的精确1m范围 不得无条件重新下载整年

- Source: `REQ-DATASERVICE-127`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:9a8809ed1b3851bd2abbdc5b9c0d0e1d00bc11d9dc7e20b2ffe7be3a89a94787`.
- Provenance: `SPAN-2CA5A6533CDAE794`; clauses: `B1047:C1`.

#### REQ-DATASERVICE-128

> req-gap-004 datamanager只通过现有 historicalbarrequest 请求dataservice fetch

- Source: `REQ-DATASERVICE-128`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:e09410f30e1cbee1ee2e4870e0f9573874ba000a426ce75bc409ee026f021769`.
- Provenance: `SPAN-469A78E840198E0A`; clauses: `B1049:C1, B1049:C2, B1049:C3, B1049:C4`.

#### REQ-DATASERVICE-129

> req-gap-005 高周期缺失或冲突从修复后db completed 1m确定重建 不直接使用供应商高周期作为winner

- Source: `REQ-DATASERVICE-129`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:26dbdab329456b90e0de8299f65a84e881c7d207946ffcdfb1ba7c9512d62b3f`.
- Provenance: `SPAN-4EABDC977FD79FD8`; clauses: `B1051:C1`.
- Condition (unevaluated):

  > REQ-GAP-005：高周期缺失或冲突从修复后DB completed 1m确定重建，不直接使用供应商高周期作为winner。


#### REQ-DATASERVICE-130

> req-gap-006 第一次修复失败记录结构化gap并继续服务已有db completed和hot current

- Source: `REQ-DATASERVICE-130`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:520c318d4e5406c82c034bb08f9f350b94f22796bd8147890c491497dd9921aa`.
- Provenance: `SPAN-3D604FDB1899AE9B`; clauses: `B1053:C1, B1053:C2`.

#### REQ-DATASERVICE-131

> req-gap-007 修复成功后只使相交cold range cache失效

- Source: `REQ-DATASERVICE-131`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:a74d90e682e14a684be5d5f14b3399d5b424df9a9c1f1e403bcfbb8ccdd059f3`.
- Provenance: `SPAN-6AA3BF00EA6EAEBD`; clauses: `B1055:C1, B1055:C2`.

#### REQ-DATASERVICE-132

> req-gap-008 窗口最小化不停止dataservice

- Source: `REQ-DATASERVICE-132`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:ea0879d831315db0b3bdb935c4e9cef0a10884ab74f179d6cf083345cc196711`.
- Provenance: `SPAN-3CB2D8BEE7160B84`; clauses: `B1057:C1, B1057:C2, B1057:C3`.

#### REQ-DATASERVICE-133

> req-gap-009 tickdatabus overrun不能通过datamanager补造tick

- Source: `REQ-DATASERVICE-133`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:3576d0317a84657c02642b3144cc0d7ba8f3e1bee63b15372011e7ada5e086da`.
- Provenance: `SPAN-D3FDBDD10D665A34`; clauses: `B1059:C1, B1059:C2, B1059:C3`.

#### REQ-DATASERVICE-134

> req-gap-010 coverage计算复用现有 missing_ranges 结果 不建立第二套gap算法

- Source: `REQ-DATASERVICE-134`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:4b29c09da9a1f1e5f5760f72f877d66082943bbd00630c517c580b34a43fcba1`.
- Provenance: `SPAN-5950F8D3E2414E0D`; clauses: `B1061:C1, B1061:C2, B1061:C3`.

#### REQ-DATASERVICE-135

> req-gap-011 dataservice崩溃或completedbarlog overrun导致高周期event未知时 recorder向datamanager提交 stream_key 最后checkpoint 当前配置interval和精确时间范围

- Source: `REQ-DATASERVICE-135`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:0a8e3b52a48a74a885adbf5ded8f4458f670df6eb4365ac492b992a39ea45698`.
- Provenance: `SPAN-7B237F99D03E31F2`; clauses: `B1063:C1, B1063:C2, B1063:C3`.

#### REQ-DATASERVICE-136

> req-gap-012 临时history shm在正常消费 校验失败 request取消 requester退出和迟到response五条路径均必须释放

- Source: `REQ-DATASERVICE-136`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:61d23027624a1b79ee7e1a3b1863aae3601a520ee89957e40e2d01ace91e595c`.
- Provenance: `SPAN-7E3A4CC07EA1B9E7`; clauses: `B1065:C1, B1065:C2`.
- Condition (unevaluated):

  > REQ-GAP-012：临时history SHM在正常消费、校验失败、request取消、requester退出和迟到response五条路径均必须释放。 AND 释放失败是该request的结构化资源错误，不得把迟到数据写入stable GDS。


#### REQ-DATASERVICE-137

> req-goal-001 实施者必须把 dataservice 重构收敛为一次最小迁移 把旧主进程或旧 worker 的历史读取适配 实时共享 k 线聚合和 ipc 发布移入 dataservice 其他已经由用户验证的业务语义保持不变

- Source: `REQ-DATASERVICE-137`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:f963ae408679c3d21e6aa2b9da63c833b9980e2ef9057332aa54e1d59c5475eb`.
- Provenance: `SPAN-778493C7A3AF717E`; clauses: `B0023:C1`.
- Condition (unevaluated):

  > REQ-GOAL-001：实施者必须把 DataService 重构收敛为一次最小迁移：把旧主进程或旧 Worker 的历史读取适配、实时共享 K 线聚合和 IPC 发布移入 DataService，其他已经由用户验证的业务语义保持不变。


#### REQ-DATASERVICE-138

> req-goal-002 唯一有效数据模型固定为

- Source: `REQ-DATASERVICE-138`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:375e451e734523aaed5ea73cf85646a178c61de516caf605ebbc74745b7b0ff4`.
- Provenance: `SPAN-06E7C70504943749`; clauses: `B0025:C1, B0027:C1, B0029:C1`.

#### REQ-DATASERVICE-139

> req-goal-003 实施者必须修复以下已经观察到的用户问题

- Source: `REQ-DATASERVICE-139`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:8ffc2334b7f78258775d7dbd223cfc1b6dc54d7cbb22842217382c29d2d606cc`.
- Provenance: `SPAN-DFBDB40F017DF6B5`; clauses: `B0031:C1, B0033:C1, B0034:C1, B0035:C1, B0036:C1, B0037:C1, B0038:C1, B0039:C1, B0040:C1, B0041:C1, B0042:C1, B0043:C1`.

#### REQ-DATASERVICE-140

> req-goal-004 修复必须作用于全部已注册指标共享的数据输入 缓存 lmdb 映射和绘制链

- Source: `REQ-DATASERVICE-140`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:f50dabbe8d55b8af844392694d0dd61ebb74b9f0966c2ece3c41b9fade068d33`.
- Provenance: `SPAN-7066A538D62CEE92`; clauses: `B0045:C1, B0045:C2`.

#### REQ-DATASERVICE-141

> req-goal-005 性能优化仅发生在以下位置

- Source: `REQ-DATASERVICE-141`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:cf69bcaf7fe1a9d0cd4ec053eb2336bcef319ec54f0d45677931f7339d5e66c5`.
- Provenance: `SPAN-D82F7398D5400CC6`; clauses: `B0047:C1, B0049:C1, B0050:C1, B0051:C1, B0052:C1, B0053:C1, B0054:C1, B0055:C1, B0056:C1`.

#### REQ-DATASERVICE-142

> req-goal-006 性能优化不得改变以下用户语义

- Source: `REQ-DATASERVICE-142`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:1f0e1b7b02ed1ef598153491d69057dfe4cc9161b212a28efe926d9e356ba33e`.
- Provenance: `SPAN-50CFB1543A21287B`; clauses: `B0058:C1, B0060:C1, B0061:C1, B0062:C1, B0063:C1, B0064:C1, B0065:C1, B0066:C1, B0067:C1, B0068:C1, B0069:C1`.

#### REQ-DATASERVICE-143

> req-hot-001 live_completed_suffix 统一改名为 hot_completed_tail

- Source: `REQ-DATASERVICE-143`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:3ed2b0fa8ec9d13f74af8198a96509b861396f15d4bf5e160cf2de38bb8b4bbb`.
- Provenance: `SPAN-D9547EB3AADDA61E`; clauses: `B0923:C1`.

#### REQ-DATASERVICE-144

> req-hot-002 hot completed是dataservice在当前cold baseline捕获之后实时产生 尚未被一次成功cold refresh吸收的全部completed bars

- Source: `REQ-DATASERVICE-144`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:cdd987805a1ce9c21796022f4ba3e4f35e2248bf559d03080a8f8a12e7784a10`.
- Provenance: `SPAN-3948004D2E77A2EC`; clauses: `B0925:C1`.
- Condition (unevaluated):

  > REQ-HOT-002：hot completed是DataService在当前cold baseline捕获之后实时产生、尚未被一次成功cold refresh吸收的全部completed bars。


#### REQ-DATASERVICE-145

> req-hot-003 每根hot completed满足 datetime_end none

- Source: `REQ-DATASERVICE-145`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:ffa57341f900e0d1b139943ac0964fe3642db011af050ef77421eaf10bcc9784`.
- Provenance: `SPAN-A499D3B4B088845B`; clauses: `B0927:C1`.

#### REQ-DATASERVICE-146

> req-hot-004 hot completed在datarecorder写入db前后都继续保留

- Source: `REQ-DATASERVICE-146`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:7a5f1ea2a6bf29b48e6307019edc0722b1120c9af74e31b934ea690c9c5aeefe`.
- Provenance: `SPAN-61E7E619D05896FC`; clauses: `B0929:C1, B0929:C2`.

#### NEG-DATASERVICE-011

> req-hot-005 datarecorder commit ack checkpoint 固定分钟数 固定bar数 wall-clock和内存压力策略均不得直接删除hot completed

- Source: `NEG-DATASERVICE-011`; role: `boundary`; strength: `must`; polarity: `forbidden`.
- Source text hash: `sourceTextHash=sha256:2948af62e37c96502bc38110fbb1ecf961f390997762bbf81c9782c1070683e4`.
- Provenance: `SPAN-323EF18CFD805F8C`; clauses: `B0931:C1`.

#### REQ-DATASERVICE-147

> req-hot-006 只有cold局部刷新成功 db已覆盖相同identity 内容比较一致后 dataservice才从hot tail吸收该identity

- Source: `REQ-DATASERVICE-147`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:7c4739f497a6fb61e435a7f612f6a780ed1802486c92c9c6e5fceb5a02be1377`.
- Provenance: `SPAN-ED0D0EAC5F08CE73`; clauses: `B0933:C1`.
- Condition (unevaluated):

  > REQ-HOT-006：只有cold局部刷新成功、DB已覆盖相同identity、内容比较一致后，DataService才从hot tail吸收该identity。


#### REQ-DATASERVICE-148

> req-hot-007 目标高周期db bar不存在时 db completed 1m完整覆盖该period并且能够确定重建出相同bar时 dataservice在原子重建后吸收hot高周期identity

- Source: `REQ-DATASERVICE-148`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:a3678227f9f252d6a12b5f5ab1203d5e4f66e81c61c671fece5ddb3cd251c7c9`.
- Provenance: `SPAN-DEA622FF3940B132`; clauses: `B0935:C1`.
- Condition (unevaluated):

  > REQ-HOT-007：目标高周期DB bar不存在时，DB completed 1m完整覆盖该period并且能够确定重建出相同bar时，DataService在原子重建后吸收hot高周期identity。


#### REQ-DATASERVICE-149

> req-hot-008 hot completed使用identity map维护唯一对象 对外按period start有序暴露

- Source: `REQ-DATASERVICE-149`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:11f1debdf1ddaff93f64d3061999d3d8058c236f8354d8bd23d97c334a7f2390`.
- Provenance: `SPAN-6637D346D532D137`; clauses: `B0937:C1, B0937:C2`.

#### REQ-DATASERVICE-150

> req-ind-001 legacy adapter只适配dataservice view到 822c715e6 worker输入 不聚合 不计算指标 不持久化结果

- Source: `REQ-DATASERVICE-150`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:d04d56a1286af0b8e9a915bf4a4931627272c724105fc8596ef8b587d1673150`.
- Provenance: `SPAN-FAA87C049BA3E80E`; clauses: `B1110:C1`.

#### REQ-DATASERVICE-151

> req-ind-002 指标l1保留旧period bar历史缓存key 命中 bar switch和db tail invalidation语义

- Source: `REQ-DATASERVICE-151`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:529ffe4f72144c702332a00aabcaf86e3601ec5ea1d74b69359aea95177cf091`.
- Provenance: `SPAN-9A81E8ABB48C0434`; clauses: `B1112:C1`.

#### REQ-DATASERVICE-152

> req-ind-003 指标l2保留completed-prefix结果

- Source: `REQ-DATASERVICE-152`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:b1ae376b4bc321632dc2919b6cfff1ff0513099e50fac938702a89247b367631`.
- Provenance: `SPAN-302295378BB3B65A`; clauses: `B1114:C1, B1114:C2`.

#### NEG-DATASERVICE-012

> req-ind-004 dataservice cold range cache不能替代指标l1

- Source: `NEG-DATASERVICE-012`; role: `boundary`; strength: `must`; polarity: `forbidden`.
- Source text hash: `sourceTextHash=sha256:319c7620f5870d1d78e36846b3d6f423d928ef6656204ddd41156153ea71957e`.
- Provenance: `SPAN-BAED2370E7A305E2`; clauses: `B1116:C1, B1116:C2, B1116:C3`.

#### REQ-DATASERVICE-153

> req-ind-005 lmdb l3保留旧 persistent_result_key_v1 及 u0/u1 契约

- Source: `REQ-DATASERVICE-153`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:2feacaf4f2fb7fcc9fbf2822927c563d3b3c32d69ea3c66d880a774018e75234`.
- Provenance: `SPAN-FB0464BA320B6BF5`; clauses: `B1118:C1, B1118:C2`.

#### REQ-DATASERVICE-154

> req-ind-006 period values只能通过同一descriptor的 index_ranges 映射到1m 不得通过数组尾长 period count或revision猜测

- Source: `REQ-DATASERVICE-154`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:0f68e73f98eff2f80b91b7bed7e4aef1aa62167500091a4337c649401c3e9056`.
- Provenance: `SPAN-8C7894942AEF31EA`; clauses: `B1120:C1`.

#### REQ-DATASERVICE-155

> req-ind-007 单个指标失败只隔离该指标

- Source: `REQ-DATASERVICE-155`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:fae38fc9dc5390d3b79e598087bfa83c7f2ce5f2a96111f43bc02849b5e2a85b`.
- Provenance: `SPAN-EB3B04EE4879F995`; clauses: `B1122:C1, B1122:C2`.

#### REQ-DATASERVICE-156

> req-ind-008 实施开始先对 822c715e6 和candidate执行registry discovery 生成全部已注册指标manifest

- Source: `REQ-DATASERVICE-156`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:113ef6b0c86eec38815ce3ee8cb64377d0d7486c0d2f5fdea2fa2ad54ad13fa0`.
- Provenance: `SPAN-430503F4B6339846`; clauses: `B1124:C1, B1124:C2`.

#### REQ-DATASERVICE-157

> req-ind-009 boll lower_higher_trend和trend_state_machine必须执行完整数值与绘制验收

- Source: `REQ-DATASERVICE-157`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:034e0469d7a0767ff3d4712a7ac2fc1cc392d82dd84ee9142d408f75b65ba99c`.
- Provenance: `SPAN-E41D39DCA79E6487`; clauses: `B1126:C1, B1126:C2`.

#### NEG-DATASERVICE-013

> req-ind-010 不修改任何指标数学公式 参数 输出名称 输出数量或pane归属来掩盖数据输入错误

- Source: `NEG-DATASERVICE-013`; role: `boundary`; strength: `must`; polarity: `forbidden`.
- Source text hash: `sourceTextHash=sha256:0c98ca99af16cdd822a5b7182bb770b928144dc4934c88a9bb0e2241950092c2`.
- Provenance: `SPAN-996050998DA96FED`; clauses: `B1128:C1`.

#### REQ-DATASERVICE-158

> req-ind-011 current变化沿用 822c715e6 既有指标刷新节奏

- Source: `REQ-DATASERVICE-158`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:cdfd19cbcc8b41c688c7b7a6ef368e347553b4af16a74dc38d45904d8d99deb8`.
- Provenance: `SPAN-1D2DEF6D174E107A`; clauses: `B1130:C1, B1130:C2`.

#### REQ-DATASERVICE-159

> req-map-001 canonical active和db identity始终是用户选择的logical symbol

- Source: `REQ-DATASERVICE-159`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:49fd0a74d0e2b2f6e3bdcf192eeda053fd54bdeb031690bebf12be214a07e896`.
- Provenance: `SPAN-BE8A6F2735B6FFE2`; clauses: `B1196:C1, B1196:C2`.

#### REQ-DATASERVICE-160

> req-map-002 主连解析顺序必须从 822c715e6 提取characterization并逐分支锁定 不得另写新算法

- Source: `REQ-DATASERVICE-160`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:db575dab64a84d61bdc338300f711574239a15e62c084a30d07353370d11b4bd`.
- Provenance: `SPAN-5C98B1E98ADCFCEF`; clauses: `B1198:C1`.

#### REQ-DATASERVICE-161

> req-map-003 用户切换logical active时 旧active继续运行 datamanager先补齐并回读目标历史

- Source: `REQ-DATASERVICE-161`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:ede932fdbc96749474429550ba9ac01807e9260975810d90b329470e572db236`.
- Provenance: `SPAN-25910DD40E3F53CD`; clauses: `B1200:C1, B1200:C2, B1200:C3`.
- Condition (unevaluated):

  > REQ-MAP-003：用户切换logical active时，旧active继续运行，DataManager先补齐并回读目标历史； AND 成功后DataService订阅目标actual，在ingress dispatcher边界封存旧`stream_key`并发送`STREAM_SEAL(final_batch_sequence)`，递增active generation、建立新stream、原子切换callback接受目标、取消旧订阅并返回`ACTIVE_ACK(new_stream_key)`。 AND 补缺或订阅失败时旧active继续，任一时刻可写canonical symbol数量不超过1。


#### REQ-DATASERVICE-162

> req-map-004 actual月份自动切换不等于用户切换logical active 不增加active generation或stream id

- Source: `REQ-DATASERVICE-162`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:29597c9682a5bafd60ea3cae5015bcd666be6148d3cb06eef1f8aab914857e4a`.
- Provenance: `SPAN-BABE8679A72BE0F6`; clauses: `B1202:C1`.

#### REQ-DATASERVICE-163

> req-map-005 实际月份切换后的旧callback通过 回传actual symbol必须等于当前旧mapping结果 拒绝

- Source: `REQ-DATASERVICE-163`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:b67236689374e75837252ac4f28aca946feaeee2ecd37d4d2917c3e541d4c0fb`.
- Provenance: `SPAN-E5E6AC20EEA336C1`; clauses: `B1204:C1, B1204:C2`.

#### REQ-DATASERVICE-164

> req-map-006 active stream唯一身份为 service_generation active_generation

- Source: `REQ-DATASERVICE-164`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:638e62b16411a2fec8d6889cee7b0093134e777ba8c0f470d5926c47d1cd7e92`.
- Provenance: `SPAN-AB23A17F0E8AEBD4`; clauses: `B1206:C1, B1206:C2, B1206:C3, B1206:C4`.

#### REQ-DATASERVICE-165

> req-map-007 actual mapping更新 subscribe/unsubscribe和callback acceptance全部在同一ingress dispatcher串行执行

- Source: `REQ-DATASERVICE-165`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:93e02b3395e1613e32d50fca8c5c0d2e92dee56a650ff1917fc7a60e25c088bb`.
- Provenance: `SPAN-9D45B40E44B06798`; clauses: `B1208:C1, B1208:C2, B1208:C3`.

#### REQ-DATASERVICE-166

> req-merge-001 合并顺序固定为cold hot completed current按identity有序合并

- Source: `REQ-DATASERVICE-166`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:5a680d4d0ef050de1f157b1f4c570c62830fc30b0fd4add94d2d3dc5672cb2aa`.
- Provenance: `SPAN-6DAC2E49A21FAA58`; clauses: `B0959:C1`.

#### REQ-DATASERVICE-167

> req-merge-002 cold和hot completed identity不同 均按period start进入结果

- Source: `REQ-DATASERVICE-167`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:df55b9c3bfb9b4130e5b4d57527ed5abb9e8c2376a8943d7ca8355df16379c6b`.
- Provenance: `SPAN-7FA2F1650131D138`; clauses: `B0961:C1, B0961:C2`.

#### REQ-DATASERVICE-168

> req-merge-003 相同identity内容一致 只保留一根

- Source: `REQ-DATASERVICE-168`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:d5f8c7d0274384b501508f28a0eedf2c2bc0fbebcd679145c1e4232f3f8f001d`.
- Provenance: `SPAN-767ECD470D7D7794`; clauses: `B0963:C1`.

#### REQ-DATASERVICE-169

> req-merge-004 相同completed identity内容不一致 当前发布使用db completed

- Source: `REQ-DATASERVICE-169`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:c9dcac909858a507905090c8c5cdc5ea1ac2a38dc9b1b1af223da7adcf604972`.
- Provenance: `SPAN-556D1C300B86897A`; clauses: `B0965:C1, B0965:C2, B0965:C3`.

#### REQ-DATASERVICE-170

> req-merge-005 db不存在而hot completed存在时 hot completed进入effective series 不等待recorder

- Source: `REQ-DATASERVICE-170`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:82889e52ede5d4ef602d92bd8f9b5af06904d5e46f3889f4b99b4b0bc5c05e34`.
- Provenance: `SPAN-F1F62B975DC56047`; clauses: `B0967:C1`.
- Condition (unevaluated):

  > REQ-MERGE-005：DB不存在而hot completed存在时，hot completed进入effective series，不等待Recorder。


#### NEG-DATASERVICE-014

> req-merge-006 db hot均不存在的expected completed identity不创建空bar nan bar 复制前值bar或状态bar

- Source: `NEG-DATASERVICE-014`; role: `boundary`; strength: `must`; polarity: `forbidden`.
- Source text hash: `sourceTextHash=sha256:a94c8c30603019d864de42a86a04c30c9e4a8a0d4743c210a6772a0c75083de4`.
- Provenance: `SPAN-68B47826F0A80C9F`; clauses: `B0969:C1`.
- Condition (unevaluated):

  > REQ-MERGE-006：DB、hot均不存在的expected completed identity不创建空bar、NaN bar、复制前值bar或状态bar。


#### REQ-DATASERVICE-171

> req-merge-007 缺口只阻止依赖该identity的period materialization和指标区段

- Source: `REQ-DATASERVICE-171`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:9f603fa0f0cdbc605f457d14377f907c1007519a96c8945a55c6ce7e3465ba63`.
- Provenance: `SPAN-3F42ECD27B3B337E`; clauses: `B0971:C1, B0971:C2`.

#### REQ-DATASERVICE-172

> req-merge-008 datarecorder写入相同completed bar前后 effective series的identity 逐字段内容 顺序 长度和指标结果完全不变

- Source: `REQ-DATASERVICE-172`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:28ab9bcdaf7daefe7076b36475c8c93f9f535d95912d8660d531bf5917b9cf2c`.
- Provenance: `SPAN-2AF389A98BA81263`; clauses: `B0973:C1`.
- Condition (unevaluated):

  > REQ-MERGE-008：DataRecorder写入相同completed bar前后，effective series的identity、逐字段内容、顺序、长度和指标结果完全不变。


#### REQ-DATASERVICE-173

> req-merge-009 revision仅作为shm odd/even seqlock实现细节

- Source: `REQ-DATASERVICE-173`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:d6eb3bd544fb5d5b1dde4f2c8e08c9ff1610eab06c62163b769d81766b5b6250`.
- Provenance: `SPAN-477D348BBC000667`; clauses: `B0975:C1, B0975:C2`.

#### REQ-DATASERVICE-174

> req-obs-001 结构化日志至少区分process ready active ack range complete/failed gap request/result cold load hot rollover gds publish recorder receive/filter/write/checkpoint/ack tick overrun和consumer reattach

- Source: `REQ-DATASERVICE-174`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:037e1bbdbe4d985241a0b9549b17250163243972211c4305a3071725219e7350`.
- Provenance: `SPAN-C9807767671EC5C8`; clauses: `B1224:C1`.

#### REQ-DATASERVICE-175

> req-obs-002 高频tick不得逐笔输出info日志

- Source: `REQ-DATASERVICE-175`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:f36b416c6023dcd2cf608f7462c5dd8bcec42481dc402280fc7f1914aa10b4d1`.
- Provenance: `SPAN-9786CEF198B3187C`; clauses: `B1226:C1, B1226:C2`.

#### REQ-DATASERVICE-176

> req-obs-003 每一种command/request/candidate/envelope必须能指出真实producer consumer和终态

- Source: `REQ-DATASERVICE-176`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:072fbff58e8e573714998eb7811d582237f620a5e75180be40f1478e1f64d672`.
- Provenance: `SPAN-4B10783C0C8B4A41`; clauses: `B1228:C1, B1228:C2`.

#### REQ-DATASERVICE-177

> req-pub-001 每个active generation按支持interval维护稳定gds allocation

- Source: `REQ-DATASERVICE-177`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:77582a6bb1f6ad018aa62770a578805629a5787bc25c81c0061e5e73e1b65dcf`.
- Provenance: `SPAN-B86FA1323BFFB03D`; clauses: `B1069:C1, B1069:C2`.

#### REQ-DATASERVICE-178

> req-pub-002 容量足够时原位更新

- Source: `REQ-DATASERVICE-178`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:ea50d8a02cc3c705aaee13aaf47225ae314246b86af9b2ce6e44a6949ca0729c`.
- Provenance: `SPAN-B8D662CD325584DA`; clauses: `B1071:C1, B1071:C2`.
- Condition (unevaluated):

  > REQ-PUB-002：容量足够时原位更新； AND 容量不足时分配更大allocation、复制一次有效数据、在seqlock保护下交换descriptor，然后释放旧allocation。


#### REQ-DATASERVICE-179

> req-pub-003 active切换或dataservice进程重启创建新allocation

- Source: `REQ-DATASERVICE-179`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:4916028f468aabe927285b5ca780e78cd7512c99850d87462924407f1d1d773d`.
- Provenance: `SPAN-07DDFE7D64B870AE`; clauses: `B1073:C1, B1073:C2`.

#### REQ-DATASERVICE-180

> req-pub-004 不使用普通consumer lease或ttl

- Source: `REQ-DATASERVICE-180`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:cebe0e0c2dcc1b2219286f42fe3dca4926e2497ebff81d2f0f0e5cd54677dda6`.
- Provenance: `SPAN-D192D998033FD12A`; clauses: `B1075:C1, B1075:C2`.

#### REQ-DATASERVICE-181

> req-pub-005 同一series sequence的descriptor只发布一次

- Source: `REQ-DATASERVICE-181`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:e7e7a66fe9db0e935016e29e79f6cbf62bbbdf88f7d4ee2370ad07c903afd1fd`.
- Provenance: `SPAN-11B13FA21A3BB54A`; clauses: `B1077:C1, B1077:C2`.

#### REQ-DATASERVICE-182

> req-pub-006 legacy contract一次提供

- Source: `REQ-DATASERVICE-182`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:c9cc1fcde228feb483869b392db5cfdab842e7982eb1ac2eff548d6f754449a0`.
- Provenance: `SPAN-E2B86C990A369198`; clauses: `B1079:C1, B1081:C1, B1082:C1, B1083:C1, B1084:C1, B1085:C1, B1086:C1, B1087:C1, B1088:C1`.

#### REQ-DATASERVICE-183

> req-pub-007 arr_1m completed 1m 最多一根current 1m

- Source: `REQ-DATASERVICE-183`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:a5638fd947064cede9ee9d4315f5e981300936e56df5806b65f50b07139fb3a5`.
- Provenance: `SPAN-3BBF11C666080290`; clauses: `B1090:C1`.

#### REQ-DATASERVICE-184

> req-pub-008 period_bars completed target 最多一根current target

- Source: `REQ-DATASERVICE-184`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:06e063dc15ec7efe8991ce69922c18d30c0f9b3dc3a0db0c849262fc45852b7b`.
- Provenance: `SPAN-EC725F00E88725D2`; clauses: `B1092:C1, B1092:C2`.

#### REQ-DATASERVICE-185

> req-pub-009 index_ranges 每行表示对应period bar覆盖的1m双闭索引范围

- Source: `REQ-DATASERVICE-185`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:702dd5ae87629b8639d1c4ad9a3aa783da8bc479995b173d757941c6b710f738`.
- Provenance: `SPAN-3FD99304497EFF95`; clauses: `B1094:C1, B1094:C2`.

#### REQ-DATASERVICE-186

> req-pub-010 current_bar_start_ix 必须指向真实period-start 1m

- Source: `REQ-DATASERVICE-186`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:b7b1235322185fe400e092124c9c916e4e0eae6521e5a474621d49f95502d8f7`.
- Provenance: `SPAN-7A5AE46496AA7D17`; clauses: `B1096:C1, B1096:C2`.

#### REQ-DATASERVICE-187

> req-pub-011 消费者只在前后读到同一个偶数series sequence时接受跨数组视图

- Source: `REQ-DATASERVICE-187`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:96e1252904a1a81c4fb88a0bc93816e7161bf57abd293525a3af674ab5d6b33b`.
- Provenance: `SPAN-B87981A0D0D7F268`; clauses: `B1098:C1, B1098:C2`.

#### REQ-DATASERVICE-188

> req-pub-012 每个tick只更新current row current mapping end和必要metadata

- Source: `REQ-DATASERVICE-188`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:750d85ad93fd8fbef0ca2eeb38cdd212800d10122125c75dd33287aad11cb8de`.
- Provenance: `SPAN-7DA930C3A8EAAD6E`; clauses: `B1100:C1, B1100:C2`.

#### REQ-DATASERVICE-189

> req-pub-013 每个descriptor携带与 arr_1m 和 period_bars 一致的 coverage_segments

- Source: `REQ-DATASERVICE-189`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:9bc32c1ff2538d4f7ee99012a413187ddc23eb116bbfa5c9b3b6bd4e38b47490`.
- Provenance: `SPAN-D63742BFE112CF81`; clauses: `B1102:C1, B1102:C2`.

#### REQ-DATASERVICE-190

> req-pub-014 qt只在最终绘图数组的segment边界插入断线值 使plotdataitem不跨缺口连线

- Source: `REQ-DATASERVICE-190`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:a83d5b59c98f02a9b2d5ee4757b56c805ae350d8bb6d8657b236a9d7ac0e00cd`.
- Provenance: `SPAN-DE25AC9CE134D8DA`; clauses: `B1104:C1, B1104:C2`.

#### REQ-DATASERVICE-191

> req-query-001 图表首次需要范围时发一个request并等待complete/failed

- Source: `REQ-DATASERVICE-191`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:5ec84cb2808d8ab5419a1c480c731fae0a66cc47e633fa1cc39829ffbb8ad35c`.
- Provenance: `SPAN-47EECAA65F540269`; clauses: `B1212:C1, B1212:C2`.

#### REQ-DATASERVICE-192

> req-query-002 完全相同的in-flight request key复用一次工作

- Source: `REQ-DATASERVICE-192`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:0cb7de1d829ba55e2f010607d2d1d65ffc9447217a475a9fcb482ec318684796`.
- Provenance: `SPAN-6DA5BC78D39A3727`; clauses: `B1214:C1, B1214:C2`.

#### REQ-DATASERVICE-193

> req-query-003 相交但不相同range不引入通用coalescing抽象

- Source: `REQ-DATASERVICE-193`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:2f2145e996e9ae1b22d29579deeaa27b4e625705472c22998c8a7442554c84d8`.
- Provenance: `SPAN-E5081A37D62B8549`; clauses: `B1216:C1, B1216:C2`.

#### REQ-DATASERVICE-194

> req-query-004 普通query失败只结束该request 不重启dataservice worker cta trigger或recorder

- Source: `REQ-DATASERVICE-194`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:5cf429c74bcd1df5080a6ba3090b8970a1f56da4f7a8528a41360bf6b316e7ed`.
- Provenance: `SPAN-FF69A9D2DA6C7C6C`; clauses: `B1218:C1`.
- Condition (unevaluated):

  > REQ-QUERY-004：普通query失败只结束该request，不重启DataService、Worker、CTA、Trigger或Recorder。


#### REQ-DATASERVICE-195

> req-query-005 request身份只复用 session_id/request_id/request_generation/active_contract_generation

- Source: `REQ-DATASERVICE-195`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:a6967a445cb0a329e17fc5793390062ffd192ee5eb797ed97d1f384823e4e14b`.
- Provenance: `SPAN-CB31022E95DF8B9B`; clauses: `B1220:C1, B1220:C2, B1220:C3`.

#### REQ-DATASERVICE-196

> req-query-006 完全相同request key共享一个in-flight fetch

- Source: `REQ-DATASERVICE-196`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:529f7debc4dcf165def426798b8b064beafcee2622d714011c71ea3b8d4276c7`.
- Provenance: `SPAN-21D7491F0FC354F4`; clauses: `B1222:C1, B1222:C2`.

#### REQ-DATASERVICE-197

> req-rec-001 dataservice为唯一active合约的全部产品支持interval生成canonical completed事件 不读取recorder配置

- Source: `REQ-DATASERVICE-197`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:b09d986b92d170dfc01baebf21e99c0eac07f557504f2ef69ecf003d60d87b0b`.
- Provenance: `SPAN-34F3C06B9792A157`; clauses: `B1134:C1`.

#### REQ-DATASERVICE-198

> req-rec-002 completed可靠传输只复用一个bounded completedbarlog 其共享内存条目固定为 completedrolloverbatch

- Source: `REQ-DATASERVICE-198`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:8ce32ec9876c25a384f515f0e1b49a6801c3546c99054fa3ce55c88df57765f7`.
- Provenance: `SPAN-2535DF66A9577BE0`; clauses: `B1136:C1, B1136:C2, B1136:C3`.

#### REQ-DATASERVICE-199

> req-rec-003 每次canonical 1m rollover只分配一个 batch_sequence

- Source: `REQ-DATASERVICE-199`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:3fcb1329797c5141fbf170c73e28b0971db1bf40e5cb2244782ff46e9f2fe8f7`.
- Provenance: `SPAN-05A7533E8A9D96CA`; clauses: `B1138:C1, B1138:C2, B1138:C3`.

#### REQ-DATASERVICE-200

> req-rec-004 datarecorder checkpoint按 stream_key service_generation active_generation 保存最高连续完成的batch sequence 并为当前未ack batch保存selected identities skipped identities persistence group和每个selected identity的durable状态

- Source: `REQ-DATASERVICE-200`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:4223f8a2d5e86ed04ece421980c462eea3b08f02c8b1dad522d1d7a00c89ee0f`.
- Provenance: `SPAN-6486745DFF59498E`; clauses: `B1140:C1`.
- Condition (unevaluated):

  > REQ-REC-004：DataRecorder checkpoint按`stream_key=(service_generation, active_generation)`保存最高连续完成的batch sequence，并为当前未ACK batch保存selected identities、skipped identities、persistence group和每个selected identity的durable状态。


#### REQ-DATASERVICE-201

> req-rec-005 消费顺序固定为

- Source: `REQ-DATASERVICE-201`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:ee61d106f7057cb5f365d951eb60f66c081431b9762253ade94848048b80cf12`.
- Provenance: `SPAN-AD083E26D2D37A30`; clauses: `B1142:C1, B1144:C1`.

#### REQ-DATASERVICE-202

> req-rec-006 不命中当前recorder配置的bar标为skipped 不进入db

- Source: `REQ-DATASERVICE-202`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:b206125d00bbfebfb10f80092d3bc0e936b8e73576520e765409b6f57919fc58`.
- Provenance: `SPAN-113DC701A6CBB98C`; clauses: `B1146:C1, B1146:C2, B1146:C3`.

#### REQ-DATASERVICE-203

> req-rec-007 配置只在batch首次消费 尚未入本地buffer前判定

- Source: `REQ-DATASERVICE-203`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:13c3fc0df4358cf83faa6fd87eb1dd1f0c1664bec6edf15bd39b003a96367a7f`.
- Provenance: `SPAN-978689EE66066FD8`; clauses: `B1148:C1, B1148:C2, B1148:C3`.

#### REQ-DATASERVICE-204

> req-rec-008 commit前崩溃时对应durable状态不推进

- Source: `REQ-DATASERVICE-204`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:f83b4339702d512754b50ca1f8e45a957d6e1dd9a19935931ae010f5a4dc4d41`.
- Provenance: `SPAN-449D961830046D0A`; clauses: `B1150:C1, B1150:C2, B1150:C3, B1150:C4`.

#### REQ-DATASERVICE-205

> req-rec-009 sqlite幂等入口不修改schema

- Source: `REQ-DATASERVICE-205`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:55a5511bd13cf8004bc0599527469e5e26ceb4614e80d3e950e905f82bd6b119`.
- Provenance: `SPAN-4C6CD34025ED9D32`; clauses: `B1152:C1, B1152:C2`.

#### REQ-DATASERVICE-206

> req-rec-010 dataservice异常退出时旧stream标记aborted 正常active切换时发布 stream_seal final_batch_sequence

- Source: `REQ-DATASERVICE-206`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:d4ed9d022ce0a830ea136ab0dad3ced85a59a8e6e43d7c067521f48b73e0a2fd`.
- Provenance: `SPAN-31186E342E821381`; clauses: `B1154:C1, B1154:C2`.

#### REQ-DATASERVICE-207

> req-rec-011 completedbarlog overrun或aborted stream造成未ack batch不可读时 不实现durable outbox

- Source: `REQ-DATASERVICE-207`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:d8b5275120aa05d3c0c4f547072d0342491706d1891a4d1e83753a74cbb5f0c8`.
- Provenance: `SPAN-1819866C3BCA0BF3`; clauses: `B1156:C1, B1156:C2, B1156:C3`.

#### REQ-DATASERVICE-208

> req-rec-012 datarecorder ui日志和统计必须来自真实batch receive 逐barselected/skipped immediate/timer db结果 checkpoint ack seal abort和overrun恢复 不得只打印进程启动

- Source: `REQ-DATASERVICE-208`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:d480b913f92ca8411cc0f12813d4e986cba020487a9ba1f6cfb8030db4d97f00`.
- Provenance: `SPAN-BCC0C9B1BF9B5D6C`; clauses: `B1158:C1`.

#### REQ-DATASERVICE-209

> req-rec-013 tick录制继续消费tickdatabus并进入旧10秒批量链

- Source: `REQ-DATASERVICE-209`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:2f5b88a9cd3fcff5a386db601760a264996ab6af445ebd01035b3aca0f914aec`.
- Provenance: `SPAN-6F810F1FEB3EDC94`; clauses: `B1160:C1, B1160:C2, B1160:C3, B1160:C4`.

#### REQ-DATASERVICE-210

> req-rec-014 recorder关闭顺序为停止接收新batch 完成已经进入本地buffer的写入 完成可达batch checkpoint/ack 停止writer线程

- Source: `REQ-DATASERVICE-210`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:d355219f78b4408429d84a1af2878414ec3ef1e73b3b9a7d5620ee16b9af20a4`.
- Provenance: `SPAN-2E007DD614C5E7E5`; clauses: `B1162:C1, B1162:C2, B1162:C3`.

#### REQ-DATASERVICE-211

> req-test-001 验收主链固定为

- Source: `REQ-DATASERVICE-211`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:4dde145cf843db35ca7d6315327ad3adcb5ceea23c3d8789cb352de46cb7c959`.
- Provenance: `SPAN-0F5D1FDEEBBDFADE`; clauses: `B1232:C1, B1234:C1`.

#### REQ-DATASERVICE-212

> req-test-002 替代项仅包括外部不可重复边界 通过顶层replay factory代替真实opend持续推送 通过隔离order sink代替真实下单

- Source: `REQ-DATASERVICE-212`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:2ca04676eaba3872b3a512d393bf421ce8420e65ff3003a5e0ab20b1d3194723`.
- Provenance: `SPAN-E743179237A8F023`; clauses: `B1236:C1, B1236:C2`.

#### NEG-DATASERVICE-015

> req-test-003 禁止monkeypatch被测核心方法

- Source: `NEG-DATASERVICE-015`; role: `boundary`; strength: `must`; polarity: `forbidden`.
- Source text hash: `sourceTextHash=sha256:5102b62f307176a84aae98ee3e37db37c54c5f1c3adac4cc500acdb55f5ac117`.
- Provenance: `SPAN-2C2C90CA8F1D14DB`; clauses: `B1238:C1, B1238:C2`.

#### REQ-DATASERVICE-213

> req-test-004 每个acceptance必须写出fixture 初始db 进程 生产入口 步骤 直接断言 pass fail/blocked 清理 命令和artifact

- Source: `REQ-DATASERVICE-213`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:a2b81f80cd3f57a6306d3921f4dbb7384314b3bdc7da27a8f8d2d8517e47f525`.
- Provenance: `SPAN-32EED0637B987B52`; clauses: `B1240:C1`.

#### REQ-DATASERVICE-214

> req-test-005 测试进程必须使用windows spawn 兼容的模块顶层factory

- Source: `REQ-DATASERVICE-214`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:3578910baa6d28e0de1cc791939355d765ceb9007bd70b47a46b9c7d63f5ed48`.
- Provenance: `SPAN-9EE489F3310794A4`; clauses: `B1242:C1, B1242:C2`.

#### REQ-DATASERVICE-215

> req-test-006 测试结束必须验证所有child process退出 shm unlink lmdb关闭 临时sqlite删除

- Source: `REQ-DATASERVICE-215`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:5c14759c2bed29c08a7f39bd0c1a6c1bc5b8e8e76ef45c99f376bdb5572cc760`.
- Provenance: `SPAN-EB0FEA68A4435181`; clauses: `B1244:C1, B1244:C2`.
- Condition (unevaluated):

  > REQ-TEST-006：测试结束必须验证所有child process退出、SHM unlink、LMDB关闭、临时SQLite删除； AND 失败时保留诊断artifact但不得污染生产路径。


#### NEG-DATASERVICE-016

> req-test-007 真实opend smoke只作为人工补充 不替代确定性自动验收 也不得向真实gateway提交订单

- Source: `NEG-DATASERVICE-016`; role: `boundary`; strength: `must`; polarity: `forbidden`.
- Source text hash: `sourceTextHash=sha256:8e3359202dc252919f14b7ea8059b334d5e6068873e37155b6a58824c5310f04`.
- Provenance: `SPAN-EE214942D0D41AFA`; clauses: `B1246:C1`.

#### REQ-DATASERVICE-216

> req-test-008 现有测试必须先做validity audit

- Source: `REQ-DATASERVICE-216`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:3aced086a815fcf64c7c2317cbc39033ce56081a13ab1061da9eeb490749552e`.
- Provenance: `SPAN-A2C39668518A064C`; clauses: `B1248:C1, B1248:C2`.

#### REQ-DATASERVICE-217

> req-test-009 证据索引写入 .artifacts/goal/dataservice-cold-hot-legacy-chain/evidence-index.json 每条包含acceptance id 命令 退出码 artifact路径和sha-256

- Source: `REQ-DATASERVICE-217`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:feadbc6f8fd379869914b489136a7dc9773d2165736ea7a1cac3e0efa5536497`.
- Provenance: `SPAN-74CCA44F1F328B34`; clauses: `B1250:C1`.

#### REQ-DATASERVICE-218

> req-test-010 goal合同生成前 tests/fixtures/dataservice/manifest.json 必须已经包含离线 fixture 的精确 event id 市场时间 期望 ohlcv 记录数 字节数和 sha-256

- Source: `REQ-DATASERVICE-218`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:51d2f621abb1ae48a5bcf62a21c22a38262cd29c29bade1dcf10a82fda51e05e`.
- Provenance: `SPAN-73C3A18DB1B7186F`; clauses: `B1252:C1, B1252:C2, B1252:C3`.
- Condition (unevaluated):

  > REQ-TEST-010：Goal合同生成前，`tests/fixtures/dataservice/manifest.json`必须已经包含离线 fixture 的精确 event ID、市场时间、期望 OHLCV、记录数、字节数和 SHA-256； AND 任一离线字段不存在时返回`blocked_by_contract_ambiguity:performance_dataset`。 AND 实时 callback 尚未采集的场景必须在 manifest 中标记为`blocked_until_market_open:<scenario>`，不得伪造事件。


#### REQ-DATASERVICE-219

> req-test-011 每个 ac-xx 必须拆成至少一个 ac-xx-sxx

- Source: `REQ-DATASERVICE-219`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:a5b274895c113f80b8dffc76a3ccf61c7634ea644b50f1e6755705cd12529ed2`.
- Provenance: `SPAN-C2156E44C920FD41`; clauses: `B1254:C1, B1254:C2`.

#### REQ-DATASERVICE-220

> req-test-012 powershell qt命令必须在当前shell直接执行 env:qt_qpa_platform offscreen python -m pytest ...

- Source: `REQ-DATASERVICE-220`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:5cabf802ac93113d1ca0283e3ab9aa2ed04366f4614f47713e2d9bb61c079430`.
- Provenance: `SPAN-4EF8AA6D1DD2551D`; clauses: `B1256:C1, B1256:C2`.

#### REQ-DATASERVICE-221

> req-test-013 除三个recorder barrier外 故障场景必须通过真实bounded log/queue容量 真实provider error response 真实request cancellation 明确child pid终止和真实sqlite锁驱动

- Source: `REQ-DATASERVICE-221`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:1a128cc6fec3a10afb8bc9860857c45348817d9930be7d7fd78412c0b4186c7c`.
- Provenance: `SPAN-92E90AD5DDE7759B`; clauses: `B1258:C1, B1258:C2`.

#### REQ-DATASERVICE-222

> req-test-014 仓库未冻结全局lint配置 因此合同质量命令只声明python compileall 关键模块import pytest collect-only和修改python文件的ruff candidate/baseline差异

- Source: `REQ-DATASERVICE-222`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:adb6ebeacfda4ea686e475e1ebc8d31befeee6c24c85be18572448e9e34fc292`.
- Provenance: `SPAN-E2D4B25592A45D58`; clauses: `B1260:C1, B1260:C2`.
- Condition (unevaluated):

  > REQ-TEST-014：仓库未冻结全局lint配置，因此合同质量命令只声明Python compileall、关键模块import、pytest collect-only和修改Python文件的Ruff candidate/baseline差异。 AND 不得声称全局mypy、pyright或未配置lint已通过。


#### REQ-DATASERVICE-223

> req-tick-001 dataservice provider callback必须把quote和order_book提交给一个单线程dispatcher

- Source: `REQ-DATASERVICE-223`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:20d39bd5d3002e43b86bad8926cedc7444a4cbef6d4c287cdb079df9012e157c`.
- Provenance: `SPAN-AC332BC68A224D32`; clauses: `B1003:C1, B1003:C2`.

#### REQ-DATASERVICE-224

> req-tick-002 每个callback先比较供应商回传actual symbol与当前旧 main_contract_mapping 结果 并校验现有active generation

- Source: `REQ-DATASERVICE-224`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:ff723a270be6083ee24e9d87eb11f87a7faac5afb0331eb024b7b09046cb0269`.
- Provenance: `SPAN-761A0F3E1DF0F14D`; clauses: `B1005:C1, B1005:C2, B1005:C3`.

#### NEG-DATASERVICE-017

> req-tick-003 合法性校验不得把0成交量的盘口更新丢掉

- Source: `NEG-DATASERVICE-017`; role: `boundary`; strength: `must`; polarity: `forbidden`.
- Source text hash: `sourceTextHash=sha256:4cb6be490e98414c5c1aa7af5f6cb1576e24bb98d07b220c8f1ab576f69dec56`.
- Provenance: `SPAN-BA792B517C01AEA1`; clauses: `B1007:C1, B1007:C2`.

#### REQ-DATASERVICE-225

> req-tick-004 raw tick sequence对每个被dataservice接受的callback加一

- Source: `REQ-DATASERVICE-225`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:addc8d60fedb82ebe92dfee00ec0f93c8138e9487d804f3c6988a5e4cd690286`.
- Provenance: `SPAN-2AE9B5E85DBBAE90`; clauses: `B1009:C1, B1009:C2`.

#### REQ-DATASERVICE-226

> req-tick-005 quote负责旧字段投影

- Source: `REQ-DATASERVICE-226`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:ebcb0bf0c226eee2df153f54af3f4ea8883f38b7af56716c1e0f7167c4b353f9`.
- Provenance: `SPAN-89DBF0AADA5595AE`; clauses: `B1011:C1, B1011:C2, B1011:C3`.

#### REQ-DATASERVICE-227

> req-tick-006 k线聚合admission必须复用 822c715e6 的限流和边界直通语义

- Source: `REQ-DATASERVICE-227`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:48153a01707192e64ec25fedb828f6765d5158df6b674078c110fa7ddbed10ab`.
- Provenance: `SPAN-FDBCC363AC9F2EDE`; clauses: `B1013:C1, B1013:C2`.

#### REQ-DATASERVICE-228

> req-tick-007 order_book未带来新的累计volume/turnover时 聚合delta固定为0

- Source: `REQ-DATASERVICE-228`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:c16f86c8fb38498db26c0b64417e80c79c462f99a9563ac2500283fe09914e80`.
- Provenance: `SPAN-3139239C64E9380F`; clauses: `B1015:C1, B1015:C2`.
- Condition (unevaluated):

  > REQ-TICK-007：ORDER_BOOK未带来新的累计volume/turnover时，聚合delta固定为0； AND 不得对前一次QUOTE累计值重复记账。


#### REQ-DATASERVICE-229

> req-tick-008 dataservice禁止从tickdatabus读取自己的输出

- Source: `REQ-DATASERVICE-229`; role: `requirement`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:88541a5c4065866ba00ca423e7872d586274b2032dfc945a6409ced89f3a4e2f`.
- Provenance: `SPAN-FE7D6B0B4E7197B9`; clauses: `B1017:C1, B1017:C2`.

#### AC-DATASERVICE-001-S01

> pass 全部字段和顺序断言成立 range只发布一次complete

- Source: `AC-DATASERVICE-001-S01`; role: `acceptance`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:586ba28c1833efb4ffa9ff047040235bdf71fb778d3b83ebd8b3f0d283de1fbd`.
- Provenance: `SPAN-BED36CD176053228`; clauses: `B1319:C1, B1320:C1, B1321:C1, B1321:C2, B1322:C1, B1323:C1, B1324:C1, B1325:C1, B1326:C1, B1326:C2, B1326:C3, B1326:C4, B1326:C5, B1327:C1, B1328:C1, B1329:C1, B1330:C1, B1331:C1, B1332:C1, B1332:C2`.

#### AC-DATASERVICE-002-S01

> pass 四个阶段的业务hash一致 hot吸收发生在cold compare之后

- Source: `AC-DATASERVICE-002-S01`; role: `acceptance`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:7d291d9c7cd8cf38b2c7b411371b8a7e84e2f16895dd95c52d7718f790d9adf1`.
- Provenance: `SPAN-B8ABF4DB63ECD25D`; clauses: `B1338:C1, B1339:C1, B1340:C1, B1340:C2, B1341:C1, B1342:C1, B1342:C2, B1343:C1, B1344:C1, B1344:C2, B1344:C3, B1344:C4, B1345:C1, B1345:C2, B1345:C3, B1346:C1, B1347:C1, B1348:C1, B1349:C1, B1350:C1, B1351:C1`.

#### AC-DATASERVICE-003-S01

> pass 无静默hot winner 无全局冻结 无第二opend context dataservice db write次数为0

- Source: `AC-DATASERVICE-003-S01`; role: `acceptance`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:28fb19bb2f2a5ee9d4c784836eadb1192b62242ec416e928c80a1f5140fa5486`.
- Provenance: `SPAN-284CCBA53D67DE83`; clauses: `B1357:C1, B1358:C1, B1359:C1, B1359:C2, B1360:C1, B1361:C1, B1361:C2, B1362:C1, B1363:C1, B1363:C2, B1363:C3, B1364:C1, B1364:C2, B1364:C3, B1364:C4, B1365:C1, B1366:C1, B1367:C1, B1368:C1, B1369:C1, B1370:C1`.

#### AC-DATASERVICE-004-S01

> pass 缺口下载 db commit read-back 局部cold load和单次publish顺序一致

- Source: `AC-DATASERVICE-004-S01`; role: `acceptance`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:e84072bf0e62c3f5794b7e2dd1c90eda11287e7beed17678368e1874e5e35df5`.
- Provenance: `SPAN-69FFA99C8E8966D8`; clauses: `B1376:C1, B1377:C1, B1378:C1, B1378:C2, B1379:C1, B1380:C1, B1381:C1, B1382:C1, B1382:C2, B1383:C1, B1383:C2, B1383:C3, B1383:C4, B1384:C1, B1385:C1, B1386:C1, B1387:C1, B1388:C1, B1389:C1`.

#### AC-DATASERVICE-005-S01

> pass 系统持续接收和发布未受影响数据 修复成功后缺口恢复

- Source: `AC-DATASERVICE-005-S01`; role: `acceptance`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:15cc2f054b5f31f34bf11d566feec42fb8239888ce15b082b479327cbf832836`.
- Provenance: `SPAN-7A9B2F331A28FD61`; clauses: `B1395:C1, B1396:C1, B1397:C1, B1397:C2, B1398:C1, B1399:C1, B1400:C1, B1401:C1, B1401:C2, B1402:C1, B1402:C2, B1402:C3, B1402:C4, B1402:C5, B1403:C1, B1404:C1, B1405:C1, B1406:C1, B1407:C1, B1408:C1`.

#### AC-DATASERVICE-006-S01

> pass 单周期和多周期图表读取同一descriptor并显示o

- Source: `AC-DATASERVICE-006-S01`; role: `acceptance`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:9d2012727b5f3e0d19c8ec6011c5331594d6a5711a39ba545e0dbe4602572f9a`.
- Provenance: `SPAN-E532BC3297487BFB`; clauses: `B1414:C1, B1415:C1, B1416:C1, B1416:C2, B1417:C1, B1418:C1, B1418:C2, B1419:C1, B1420:C1, B1421:C1, B1421:C2, B1421:C3, B1421:C4, B1421:C5, B1422:C1, B1423:C1, B1424:C1, B1425:C1, B1426:C1, B1427:C1`.

#### AC-DATASERVICE-007-S01

> pass 四组period start/open/current_bar_start_ix逐项成立

- Source: `AC-DATASERVICE-007-S01`; role: `acceptance`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:541a6af7f0b9420632636ad00a207f0f05e1938ad470dad450f0832dd935d543`.
- Provenance: `SPAN-8C80E7FE18EB9479`; clauses: `B1433:C1, B1434:C1, B1435:C1, B1435:C2, B1436:C1, B1437:C1, B1438:C1, B1439:C1, B1440:C1, B1440:C2, B1440:C3, B1441:C1, B1442:C1, B1443:C1, B1444:C1, B1445:C1, B1446:C1`.

#### AC-DATASERVICE-008-S01

> pass 缺失起点全程没有伪造4h bar 恢复后只发布正确值

- Source: `AC-DATASERVICE-008-S01`; role: `acceptance`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:e722587bc67c671dfd237bbccf3b0cd0629eabaa48e359fe54c02539456a86f0`.
- Provenance: `SPAN-0B6CF3FA4C99FDFF`; clauses: `B1452:C1, B1453:C1, B1454:C1, B1454:C2, B1455:C1, B1456:C1, B1457:C1, B1458:C1, B1458:C2, B1459:C1, B1459:C2, B1460:C1, B1461:C1, B1462:C1, B1463:C1, B1464:C1, B1465:C1`.

#### AC-DATASERVICE-009-S01

> pass ohlcv与 822c715e6 同输入characterization逐字段一致

- Source: `AC-DATASERVICE-009-S01`; role: `acceptance`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:35fa4b45c370062beaed28e18716995cfdfee574a168eaa8d74f1c8b916bbe0a`.
- Provenance: `SPAN-817B21D3E99688AB`; clauses: `B1471:C1, B1472:C1, B1473:C1, B1473:C2, B1474:C1, B1475:C1, B1476:C1, B1477:C1, B1478:C1, B1478:C2, B1478:C3, B1478:C4, B1478:C5, B1479:C1, B1480:C1, B1481:C1, B1482:C1, B1483:C1, B1484:C1`.

#### AC-DATASERVICE-010-S01

> pass 每种连续性按第4.5节独立处置

- Source: `AC-DATASERVICE-010-S01`; role: `acceptance`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:b4b051f5362e911e01daf546871669c70b00dfa427922285b64f48fcd8987603`.
- Provenance: `SPAN-44C7177E0817366A`; clauses: `B1490:C1, B1491:C1, B1492:C1, B1492:C2, B1493:C1, B1494:C1, B1495:C1, B1496:C1, B1497:C1, B1497:C2, B1497:C3, B1497:C4, B1497:C5, B1498:C1, B1499:C1, B1500:C1, B1501:C1, B1502:C1, B1503:C1`.

#### AC-DATASERVICE-011-S01

> pass lmdb u0/u1 映射值和plotdataitem实际xdata/ydata逐点一致

- Source: `AC-DATASERVICE-011-S01`; role: `acceptance`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:e23b61fe5164c6655146835dfabdef11bd4db7601b16b27bc882b82fafd4d623`.
- Provenance: `SPAN-86A28D6BC63AD491`; clauses: `B1509:C1, B1510:C1, B1511:C1, B1511:C2, B1512:C1, B1513:C1, B1513:C2, B1514:C1, B1515:C1, B1515:C2, B1515:C3, B1516:C1, B1516:C2, B1516:C3, B1517:C1, B1518:C1, B1519:C1, B1520:C1, B1521:C1, B1522:C1`.

#### AC-DATASERVICE-012-S01

> pass boll lower_higher_trend trend_state_machine完整通过 其他manifest指标smoke通过

- Source: `AC-DATASERVICE-012-S01`; role: `acceptance`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:46564028905e12948a8344b48992cb9b6d66ec69d2f37c53ecfea421936c0f7e`.
- Provenance: `SPAN-6C0C807B4BC1367C`; clauses: `B1528:C1, B1529:C1, B1530:C1, B1530:C2, B1531:C1, B1532:C1, B1533:C1, B1534:C1, B1535:C1, B1535:C2, B1535:C3, B1535:C4, B1536:C1, B1537:C1, B1538:C1, B1539:C1, B1540:C1, B1541:C1`.

#### AC-DATASERVICE-013-S01

> pass cold和warm两次最终绘图完全一致 第二次命中lmdb

- Source: `AC-DATASERVICE-013-S01`; role: `acceptance`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:1668050cb0d5af906c5c24dbf4fc1486625804e67d351da9b49387cd66aa00af`.
- Provenance: `SPAN-2540494699B33014`; clauses: `B1547:C1, B1548:C1, B1549:C1, B1549:C2, B1549:C3, B1550:C1, B1551:C1, B1552:C1, B1553:C1, B1553:C2, B1553:C3, B1554:C1, B1554:C2, B1554:C3, B1554:C4, B1554:C5, B1555:C1, B1556:C1, B1557:C1, B1558:C1, B1559:C1, B1560:C1`.

#### AC-DATASERVICE-014-S01

> pass dataservice收到recorder config命令次数为0 非active实时订阅增加数为0

- Source: `AC-DATASERVICE-014-S01`; role: `acceptance`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:8c3cbbb4678e80150d0514c7c602bfb6a62d8e3cbef668e9afe13aa9c0a461a5`.
- Provenance: `SPAN-A02ED94AB3023CEA`; clauses: `B1566:C1, B1567:C1, B1568:C1, B1568:C2, B1569:C1, B1570:C1, B1570:C2, B1571:C1, B1572:C1, B1572:C2, B1572:C3, B1572:C4, B1572:C5, B1572:C6, B1572:C7, B1572:C8, B1573:C1, B1573:C2, B1573:C3, B1573:C4, B1574:C1, B1575:C1, B1576:C1, B1577:C1, B1578:C1, B1579:C1`.

#### AC-DATASERVICE-015-S01

> pass 日志 统计 db rows selected/skipped persistence group durable状态 checkpoint和ack逐项对应真实操作

- Source: `AC-DATASERVICE-015-S01`; role: `acceptance`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:5255027ddaf3492b05efdb7f773407b076c7d2fe846a8fcd5ac5ff0203fefae3`.
- Provenance: `SPAN-8CA44DAF55F36C62`; clauses: `B1585:C1, B1586:C1, B1587:C1, B1587:C2, B1587:C3, B1588:C1, B1589:C1, B1590:C1, B1591:C1, B1591:C2, B1592:C1, B1592:C2, B1592:C3, B1592:C4, B1592:C5, B1592:C6, B1593:C1, B1594:C1, B1595:C1, B1596:C1, B1597:C1, B1598:C1`.

#### AC-DATASERVICE-016-S01

> pass checkpoint未越过未commit batch 重启后无sequence hole

- Source: `AC-DATASERVICE-016-S01`; role: `acceptance`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:c7948668045ec9e015365df91c79b4a9af4b3fb0dae7b3d621d056ed53b1f7bd`.
- Provenance: `SPAN-21AE996EC61014A3`; clauses: `B1604:C1, B1605:C1, B1606:C1, B1606:C2, B1607:C1, B1608:C1, B1609:C1, B1610:C1, B1611:C1, B1611:C2, B1612:C1, B1613:C1, B1614:C1, B1615:C1, B1616:C1, B1617:C1`.

#### AC-DATASERVICE-017-S01

> pass dataservice shared completed直接调用策略bar callback次数为0

- Source: `AC-DATASERVICE-017-S01`; role: `acceptance`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:901b48d48d9988101375223a008a10cbff7016cecf4ca58d446b857abb41f63d`.
- Provenance: `SPAN-E2AE58C0250AAB30`; clauses: `B1623:C1, B1624:C1, B1625:C1, B1625:C2, B1626:C1, B1627:C1, B1628:C1, B1629:C1, B1630:C1, B1630:C2, B1630:C3, B1631:C1, B1632:C1, B1633:C1, B1634:C1, B1635:C1, B1636:C1`.

#### AC-DATASERVICE-018-S01

> pass 不依赖100ms ui轮询也能读取最新tick

- Source: `AC-DATASERVICE-018-S01`; role: `acceptance`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:2b7dd1872e9d8c901574a155c16261a4fd2f59bc4ef58851175525b8123fd965`.
- Provenance: `SPAN-11315AC14DB9BA99`; clauses: `B1642:C1, B1643:C1, B1644:C1, B1644:C2, B1644:C3, B1645:C1, B1646:C1, B1647:C1, B1648:C1, B1649:C1, B1649:C2, B1649:C3, B1649:C4, B1650:C1, B1651:C1, B1652:C1, B1653:C1, B1654:C1, B1655:C1`.

#### AC-DATASERVICE-019-S01

> pass 同一tick不造成重复replace 旧actual tick被拒绝

- Source: `AC-DATASERVICE-019-S01`; role: `acceptance`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:78845b54b6d951505ea87a58beb31f851c1c5a881222810ce41ef0e8e27c1592`.
- Provenance: `SPAN-873AAAAF119E3FBE`; clauses: `B1661:C1, B1662:C1, B1663:C1, B1663:C2, B1664:C1, B1665:C1, B1666:C1, B1667:C1, B1668:C1, B1668:C2, B1668:C3, B1668:C4, B1669:C1, B1670:C1, B1671:C1, B1672:C1, B1673:C1, B1674:C1`.

#### AC-DATASERVICE-020-S01

> pass ack后pending清除 trigger继续处理新tick

- Source: `AC-DATASERVICE-020-S01`; role: `acceptance`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:6a2499f4cb59908d52468e9310fdb76015133a2c7c8f9ef7e884fbb1ca3d1c76`.
- Provenance: `SPAN-F94B67065ABD2612`; clauses: `B1680:C1, B1681:C1, B1682:C1, B1682:C2, B1683:C1, B1684:C1, B1685:C1, B1686:C1, B1686:C2, B1687:C1, B1687:C2, B1687:C3, B1687:C4, B1688:C1, B1689:C1, B1690:C1, B1691:C1, B1692:C1, B1693:C1`.

#### AC-DATASERVICE-021-S01

> pass active设置只来自用户选择或主进程默认发送 最终只有新stream可写并收到一次 active_ack new_stream_key

- Source: `AC-DATASERVICE-021-S01`; role: `acceptance`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:aee5b35a30b8e0ad7017541f6a8584ea0a3f84b2435bb528855a86ca8ca77784`.
- Provenance: `SPAN-FF4ABD160FB8F47E`; clauses: `B1699:C1, B1700:C1, B1701:C1, B1701:C2, B1701:C3, B1702:C1, B1703:C1, B1703:C2, B1704:C1, B1705:C1, B1705:C2, B1706:C1, B1706:C2, B1706:C3, B1706:C4, B1706:C5, B1706:C6, B1706:C7, B1707:C1, B1708:C1, B1709:C1, B1710:C1, B1711:C1, B1712:C1`.

#### AC-DATASERVICE-022-S01

> pass futu execution使用mhi2610 db/gds/recorder/指标仍用mhimain

- Source: `AC-DATASERVICE-022-S01`; role: `acceptance`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:37a3ec5ac71cbf82f97d89eecaab03dbdb88e851618b3ca71c0467518f85f086`.
- Provenance: `SPAN-4767A73D33E28F5C`; clauses: `B1718:C1, B1719:C1, B1720:C1, B1720:C2, B1720:C3, B1721:C1, B1722:C1, B1723:C1, B1724:C1, B1725:C1, B1725:C2, B1725:C3, B1725:C4, B1726:C1, B1727:C1, B1728:C1, B1729:C1, B1730:C1, B1731:C1`.

#### AC-DATASERVICE-023-S01

> pass 相同精确in-flight request只执行一次 所有caller收到一个终态

- Source: `AC-DATASERVICE-023-S01`; role: `acceptance`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:3f8dd6b4fdd7101fab36e18f1fd649e4ac246a5711558fc754940e286e0f29ad`.
- Provenance: `SPAN-2914598AD8DCE13E`; clauses: `B1737:C1, B1738:C1, B1739:C1, B1739:C2, B1739:C3, B1740:C1, B1741:C1, B1742:C1, B1743:C1, B1743:C2, B1743:C3, B1743:C4, B1744:C1, B1744:C2, B1744:C3, B1744:C4, B1744:C5, B1744:C6, B1744:C7, B1745:C1, B1746:C1, B1747:C1, B1748:C1, B1749:C1, B1750:C1`.

#### AC-DATASERVICE-024-S01

> pass 图表恢复后历史和current连续 dataservice/worker/recorder/cta/trigger pid均未因最小化变化

- Source: `AC-DATASERVICE-024-S01`; role: `acceptance`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:d3183e208f5cccd5a9877c1e989578cd7db23462ee1ec5a99ad341f1d162761b`.
- Provenance: `SPAN-D11677924691BF1D`; clauses: `B1756:C1, B1757:C1, B1758:C1, B1758:C2, B1758:C3, B1759:C1, B1760:C1, B1761:C1, B1762:C1, B1762:C2, B1763:C1, B1763:C2, B1763:C3, B1763:C4, B1764:C1, B1765:C1, B1766:C1, B1767:C1, B1768:C1, B1769:C1`.

#### AC-DATASERVICE-009-S02

> pass 外部投递计数等于fixture事件数 聚合结果与单次输入一致

- Source: `AC-DATASERVICE-009-S02`; role: `acceptance`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:4703dff69577f611217bddf2be1fc1802a6750ca4268f35ad4256f6b4fcdfaf8`.
- Provenance: `SPAN-8DE486DCD2DEEBE2`; clauses: `B1806:C1, B1807:C1, B1808:C1, B1809:C1, B1810:C1, B1811:C1, B1811:C2, B1812:C1, B1812:C2, B1812:C3, B1813:C1, B1814:C1, B1815:C1, B1816:C1, B1817:C1, B1818:C1`.

#### AC-DATASERVICE-013-S02

> pass 用户看到缺口而非跨缺口连线或伪造k线 其他segment仍显示

- Source: `AC-DATASERVICE-013-S02`; role: `acceptance`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:39297ed310cbd6816342353f21dc297b952d685ac0b5f4507ba134533b515b87`.
- Provenance: `SPAN-9BCE08382648AFE4`; clauses: `B1822:C1, B1823:C1, B1824:C1, B1825:C1, B1826:C1, B1827:C1, B1828:C1, B1828:C2, B1828:C3, B1828:C4, B1829:C1, B1830:C1, B1831:C1, B1832:C1, B1833:C1, B1834:C1`.

#### AC-DATASERVICE-016-S02

> pass db每identity一行且事务字段完全相同

- Source: `AC-DATASERVICE-016-S02`; role: `acceptance`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:5c1323f81910ab6fb5c937ffd365a2a5fac538d6e57e0970736191614ea60c20`.
- Provenance: `SPAN-411086ED8E83E5B0`; clauses: `B1838:C1, B1839:C1, B1840:C1, B1841:C1, B1842:C1, B1843:C1, B1844:C1, B1844:C2, B1844:C3, B1845:C1, B1846:C1, B1847:C1, B1848:C1, B1849:C1, B1850:C1`.

#### AC-DATASERVICE-016-S03

> pass db不变 checkpoint不回退 producer释放该batch等待状态

- Source: `AC-DATASERVICE-016-S03`; role: `acceptance`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:1c2fe7f174341417fb93d0615e920cafa86d7f256c1bf05d5901c17a8ad7ca36`.
- Provenance: `SPAN-DB318FAECD3DEFDE`; clauses: `B1854:C1, B1855:C1, B1856:C1, B1857:C1, B1858:C1, B1859:C1, B1860:C1, B1861:C1, B1862:C1, B1863:C1, B1864:C1, B1865:C1, B1866:C1`.

#### AC-DATASERVICE-016-S04

> pass 配置生效边界是首次消费 崩溃不改变旧决定

- Source: `AC-DATASERVICE-016-S04`; role: `acceptance`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:1a8892fca4ce69b63be9120686800bedde0abda8891e7148079c9fe075c5a990`.
- Provenance: `SPAN-EB2AAFC5286DEAEE`; clauses: `B1870:C1, B1871:C1, B1872:C1, B1873:C1, B1874:C1, B1875:C1, B1876:C1, B1876:C2, B1876:C3, B1877:C1, B1878:C1, B1879:C1, B1880:C1, B1881:C1, B1882:C1`.

#### AC-DATASERVICE-020-S02

> pass 保护不会在三次后永久停止 ack恢复后状态回到ready

- Source: `AC-DATASERVICE-020-S02`; role: `acceptance`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:c024e3c8fe39593d1476ec2d0c3549a6944f5a13b98550bed3968995673e2576`.
- Provenance: `SPAN-2FD9AAAA445DB4F0`; clauses: `B1886:C1, B1887:C1, B1888:C1, B1889:C1, B1890:C1, B1891:C1, B1891:C2, B1892:C1, B1892:C2, B1892:C3, B1892:C4, B1893:C1, B1894:C1, B1895:C1, B1895:C2, B1896:C1, B1897:C1, B1898:C1`.

#### AC-DATASERVICE-020-S03

> pass 恢复后继续逐tick保护且没有补造历史tick

- Source: `AC-DATASERVICE-020-S03`; role: `acceptance`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:d7db595ded81bce98abf8906b62bd425a58dedf0626942462335f2a4990d5a74`.
- Provenance: `SPAN-440365AD89DF2C15`; clauses: `B1902:C1, B1903:C1, B1904:C1, B1905:C1, B1906:C1, B1907:C1, B1908:C1, B1908:C2, B1908:C3, B1908:C4, B1909:C1, B1910:C1, B1911:C1, B1912:C1, B1913:C1, B1914:C1`.

#### AC-DATASERVICE-020-S04

> pass 只产生符合当前actual和仓位约束的零或一个订单intent

- Source: `AC-DATASERVICE-020-S04`; role: `acceptance`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:868aacacb143d56ffc4c14282da68bdf42dbf2e9213e5c78cd2846fa57bf73aa`.
- Provenance: `SPAN-3DAF01C9FCD69712`; clauses: `B1918:C1, B1919:C1, B1920:C1, B1921:C1, B1922:C1, B1923:C1, B1924:C1, B1924:C2, B1924:C3, B1925:C1, B1926:C1, B1927:C1, B1928:C1, B1929:C1, B1930:C1`.

#### AC-DATASERVICE-021-S02

> pass 失败切换不造成行情空窗或双active

- Source: `AC-DATASERVICE-021-S02`; role: `acceptance`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:58a515c905fd3cdbec0a0bba526013d8f8989f878b37e900646cb63472f669d9`.
- Provenance: `SPAN-73494F3F4329D144`; clauses: `B1934:C1, B1935:C1, B1936:C1, B1937:C1, B1938:C1, B1939:C1, B1940:C1, B1941:C1, B1942:C1, B1943:C1, B1944:C1, B1945:C1, B1946:C1, B1946:C2`.

#### AC-DATASERVICE-021-S03

> pass logical symbol相同不会复用旧生命周期

- Source: `AC-DATASERVICE-021-S03`; role: `acceptance`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:135ddd02ca7cd87e4de795ac552773d75164e2d5def2ace261cc84cfadf6793b`.
- Provenance: `SPAN-6D559B7BD991B304`; clauses: `B1950:C1, B1951:C1, B1952:C1, B1953:C1, B1954:C1, B1955:C1, B1956:C1, B1956:C2, B1956:C3, B1957:C1, B1958:C1, B1959:C1, B1960:C1, B1961:C1, B1962:C1`.

#### AC-DATASERVICE-022-S02

> pass canonical current没有并发写或actual混合

- Source: `AC-DATASERVICE-022-S02`; role: `acceptance`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:e2b9992dbbdcd8edc1420fef5a0ecda6b473ee87d5027e2f2108417316f89c17`.
- Provenance: `SPAN-182DC3A27608D94A`; clauses: `B1966:C1, B1967:C1, B1968:C1, B1969:C1, B1970:C1, B1971:C1, B1972:C1, B1972:C2, B1972:C3, B1972:C4, B1972:C5, B1973:C1, B1974:C1, B1975:C1, B1976:C1, B1977:C1, B1978:C1`.

#### AC-DATASERVICE-023-S02

> pass fetch range集合精确等于首次范围加差集

- Source: `AC-DATASERVICE-023-S02`; role: `acceptance`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:33506a11c95fdd20c80863b22fed18afcf28c3a9f4f5507fd172567c4257e203`.
- Provenance: `SPAN-2BE1068D725EB186`; clauses: `B1982:C1, B1983:C1, B1984:C1, B1985:C1, B1986:C1, B1987:C1, B1988:C1, B1988:C2, B1988:C3, B1989:C1, B1990:C1, B1991:C1, B1992:C1, B1993:C1, B1994:C1`.

#### AC-DATASERVICE-023-S03

> pass 迟到数据不成为新权威且资源计数回到0

- Source: `AC-DATASERVICE-023-S03`; role: `acceptance`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:c5cad67405579538b0435c616b457922b88cba72ce6e9284aa9fea1618a71920`.
- Provenance: `SPAN-3E720566719A07C2`; clauses: `B1998:C1, B1999:C1, B2000:C1, B2001:C1, B2002:C1, B2003:C1, B2004:C1, B2004:C2, B2004:C3, B2004:C4, B2004:C5, B2005:C1, B2006:C1, B2007:C1, B2008:C1, B2009:C1, B2010:C1`.

#### AC-DATASERVICE-024-S02

> pass 高周期db完整且与1m聚合一致 旧ack不进入新stream

- Source: `AC-DATASERVICE-024-S02`; role: `acceptance`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:33c230203d066e2519c4505775aefb22003b2bfd75831364713897fcf641e297`.
- Provenance: `SPAN-75E4CCDE24EF7799`; clauses: `B2014:C1, B2015:C1, B2016:C1, B2017:C1, B2017:C2, B2018:C1, B2019:C1, B2019:C2, B2019:C3, B2020:C1, B2020:C2, B2020:C3, B2021:C1, B2022:C1, B2023:C1, B2024:C1, B2025:C1, B2026:C1`.

#### AC-DATASERVICE-024-S03

> pass db完整 checkpoint在恢复后连续 新到达batch正常ack

- Source: `AC-DATASERVICE-024-S03`; role: `acceptance`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:150465b17ae31e6743df68f05d49685df950d766965ed6572f04bc61ae7e94fe`.
- Provenance: `SPAN-35F456807E719827`; clauses: `B2030:C1, B2031:C1, B2032:C1, B2033:C1, B2034:C1, B2035:C1, B2035:C2, B2035:C3, B2036:C1, B2036:C2, B2036:C3, B2036:C4, B2037:C1, B2038:C1, B2039:C1, B2040:C1, B2041:C1, B2042:C1`.
<!-- /goal-slot:domainAddenda -->

## Trace Slice Tracking Matrix

This dimension owns ordered execution, path scope, command impact, dependency, commit, and close-condition bindings.

<!-- goal-slot:traceSliceTrackingMatrix optional dynamic=traceEvidence -->
| Acceptance ID | Task IDs | Evidence command and artifact | Pass condition |
| --- | --- | --- | --- |
| AC-DATASERVICE-001-S01 | TASK-DATASERVICE-001, TASK-DATASERVICE-002, TASK-DATASERVICE-003, TASK-DATASERVICE-004, TASK-DATASERVICE-005, TASK-DATASERVICE-006, TASK-DATASERVICE-007, TASK-DATASERVICE-008, TASK-DATASERVICE-009, TASK-DATASERVICE-010, TASK-DATASERVICE-011, TASK-DATASERVICE-012, TASK-DATASERVICE-013, TASK-DATASERVICE-014, TASK-DATASERVICE-015, TASK-DATASERVICE-016 | CMD-DATASERVICE-057, CMD-DATASERVICE-058, CMD-DATASERVICE-059, CMD-DATASERVICE-063, CMD-DATASERVICE-064, CMD-DATASERVICE-065, CMD-DATASERVICE-003, CMD-DATASERVICE-004, CMD-DATASERVICE-005, CMD-DATASERVICE-006, CMD-DATASERVICE-007, CMD-DATASERVICE-008, CMD-DATASERVICE-009, CMD-DATASERVICE-010, CMD-DATASERVICE-011, CMD-DATASERVICE-012, CMD-DATASERVICE-013, CMD-DATASERVICE-014, CMD-DATASERVICE-015, CMD-DATASERVICE-016, CMD-DATASERVICE-017, CMD-DATASERVICE-018, CMD-DATASERVICE-019, CMD-DATASERVICE-020, CMD-DATASERVICE-021, CMD-DATASERVICE-022, CMD-DATASERVICE-023, CMD-DATASERVICE-024, CMD-DATASERVICE-025, CMD-DATASERVICE-026, CMD-DATASERVICE-027, CMD-DATASERVICE-028, CMD-DATASERVICE-029, CMD-DATASERVICE-030, CMD-DATASERVICE-031, CMD-DATASERVICE-032, CMD-DATASERVICE-033, CMD-DATASERVICE-034, CMD-DATASERVICE-035, CMD-DATASERVICE-036, CMD-DATASERVICE-037, CMD-DATASERVICE-038, CMD-DATASERVICE-039, CMD-DATASERVICE-040, CMD-DATASERVICE-041, CMD-DATASERVICE-042, CMD-DATASERVICE-087, CMD-DATASERVICE-090; EVD-DATASERVICE-005, EVD-DATASERVICE-007, EVD-DATASERVICE-015, EVD-DATASERVICE-017 | pass 全部字段和顺序断言成立 range只发布一次complete |
| AC-DATASERVICE-002-S01 | TASK-DATASERVICE-001, TASK-DATASERVICE-002, TASK-DATASERVICE-003, TASK-DATASERVICE-004, TASK-DATASERVICE-005, TASK-DATASERVICE-006, TASK-DATASERVICE-007, TASK-DATASERVICE-008, TASK-DATASERVICE-009, TASK-DATASERVICE-010, TASK-DATASERVICE-011, TASK-DATASERVICE-012, TASK-DATASERVICE-013, TASK-DATASERVICE-014, TASK-DATASERVICE-015, TASK-DATASERVICE-016 | CMD-DATASERVICE-060, CMD-DATASERVICE-061, CMD-DATASERVICE-062, CMD-DATASERVICE-063, CMD-DATASERVICE-064, CMD-DATASERVICE-065, CMD-DATASERVICE-075, CMD-DATASERVICE-076, CMD-DATASERVICE-077, CMD-DATASERVICE-003, CMD-DATASERVICE-004, CMD-DATASERVICE-005, CMD-DATASERVICE-006, CMD-DATASERVICE-007, CMD-DATASERVICE-008, CMD-DATASERVICE-009, CMD-DATASERVICE-010, CMD-DATASERVICE-011, CMD-DATASERVICE-012, CMD-DATASERVICE-013, CMD-DATASERVICE-014, CMD-DATASERVICE-015, CMD-DATASERVICE-016, CMD-DATASERVICE-017, CMD-DATASERVICE-018, CMD-DATASERVICE-019, CMD-DATASERVICE-020, CMD-DATASERVICE-021, CMD-DATASERVICE-022, CMD-DATASERVICE-023, CMD-DATASERVICE-024, CMD-DATASERVICE-025, CMD-DATASERVICE-026, CMD-DATASERVICE-027, CMD-DATASERVICE-028, CMD-DATASERVICE-029, CMD-DATASERVICE-030, CMD-DATASERVICE-031, CMD-DATASERVICE-032, CMD-DATASERVICE-033, CMD-DATASERVICE-034, CMD-DATASERVICE-035, CMD-DATASERVICE-036, CMD-DATASERVICE-037, CMD-DATASERVICE-038, CMD-DATASERVICE-039, CMD-DATASERVICE-040, CMD-DATASERVICE-041, CMD-DATASERVICE-042, CMD-DATASERVICE-087, CMD-DATASERVICE-090; EVD-DATASERVICE-006, EVD-DATASERVICE-007, EVD-DATASERVICE-011, EVD-DATASERVICE-015, EVD-DATASERVICE-018 | pass 四个阶段的业务hash一致 hot吸收发生在cold compare之后 |
| AC-DATASERVICE-003-S01 | TASK-DATASERVICE-001, TASK-DATASERVICE-002, TASK-DATASERVICE-003, TASK-DATASERVICE-004, TASK-DATASERVICE-005, TASK-DATASERVICE-006, TASK-DATASERVICE-007, TASK-DATASERVICE-008, TASK-DATASERVICE-009, TASK-DATASERVICE-010, TASK-DATASERVICE-011, TASK-DATASERVICE-012, TASK-DATASERVICE-013, TASK-DATASERVICE-014, TASK-DATASERVICE-015, TASK-DATASERVICE-016 | CMD-DATASERVICE-057, CMD-DATASERVICE-058, CMD-DATASERVICE-059, CMD-DATASERVICE-060, CMD-DATASERVICE-061, CMD-DATASERVICE-062, CMD-DATASERVICE-063, CMD-DATASERVICE-064, CMD-DATASERVICE-065, CMD-DATASERVICE-003, CMD-DATASERVICE-004, CMD-DATASERVICE-005, CMD-DATASERVICE-006, CMD-DATASERVICE-007, CMD-DATASERVICE-008, CMD-DATASERVICE-009, CMD-DATASERVICE-010, CMD-DATASERVICE-011, CMD-DATASERVICE-012, CMD-DATASERVICE-013, CMD-DATASERVICE-014, CMD-DATASERVICE-015, CMD-DATASERVICE-016, CMD-DATASERVICE-017, CMD-DATASERVICE-018, CMD-DATASERVICE-019, CMD-DATASERVICE-020, CMD-DATASERVICE-021, CMD-DATASERVICE-022, CMD-DATASERVICE-023, CMD-DATASERVICE-024, CMD-DATASERVICE-025, CMD-DATASERVICE-026, CMD-DATASERVICE-027, CMD-DATASERVICE-028, CMD-DATASERVICE-029, CMD-DATASERVICE-030, CMD-DATASERVICE-031, CMD-DATASERVICE-032, CMD-DATASERVICE-033, CMD-DATASERVICE-034, CMD-DATASERVICE-035, CMD-DATASERVICE-036, CMD-DATASERVICE-037, CMD-DATASERVICE-038, CMD-DATASERVICE-039, CMD-DATASERVICE-040, CMD-DATASERVICE-041, CMD-DATASERVICE-042, CMD-DATASERVICE-087, CMD-DATASERVICE-090; EVD-DATASERVICE-005, EVD-DATASERVICE-006, EVD-DATASERVICE-007, EVD-DATASERVICE-015, EVD-DATASERVICE-019 | pass 无静默hot winner 无全局冻结 无第二opend context dataservice db write次数为0 |
| AC-DATASERVICE-004-S01 | TASK-DATASERVICE-001, TASK-DATASERVICE-002, TASK-DATASERVICE-003, TASK-DATASERVICE-004, TASK-DATASERVICE-005, TASK-DATASERVICE-006, TASK-DATASERVICE-007, TASK-DATASERVICE-008, TASK-DATASERVICE-009, TASK-DATASERVICE-010, TASK-DATASERVICE-011, TASK-DATASERVICE-012, TASK-DATASERVICE-013, TASK-DATASERVICE-014, TASK-DATASERVICE-015, TASK-DATASERVICE-016 | CMD-DATASERVICE-057, CMD-DATASERVICE-058, CMD-DATASERVICE-059, CMD-DATASERVICE-063, CMD-DATASERVICE-064, CMD-DATASERVICE-065, CMD-DATASERVICE-003, CMD-DATASERVICE-004, CMD-DATASERVICE-005, CMD-DATASERVICE-006, CMD-DATASERVICE-007, CMD-DATASERVICE-008, CMD-DATASERVICE-009, CMD-DATASERVICE-010, CMD-DATASERVICE-011, CMD-DATASERVICE-012, CMD-DATASERVICE-013, CMD-DATASERVICE-014, CMD-DATASERVICE-015, CMD-DATASERVICE-016, CMD-DATASERVICE-017, CMD-DATASERVICE-018, CMD-DATASERVICE-019, CMD-DATASERVICE-020, CMD-DATASERVICE-021, CMD-DATASERVICE-022, CMD-DATASERVICE-023, CMD-DATASERVICE-024, CMD-DATASERVICE-025, CMD-DATASERVICE-026, CMD-DATASERVICE-027, CMD-DATASERVICE-028, CMD-DATASERVICE-029, CMD-DATASERVICE-030, CMD-DATASERVICE-031, CMD-DATASERVICE-032, CMD-DATASERVICE-033, CMD-DATASERVICE-034, CMD-DATASERVICE-035, CMD-DATASERVICE-036, CMD-DATASERVICE-037, CMD-DATASERVICE-038, CMD-DATASERVICE-039, CMD-DATASERVICE-040, CMD-DATASERVICE-041, CMD-DATASERVICE-042, CMD-DATASERVICE-087, CMD-DATASERVICE-090; EVD-DATASERVICE-005, EVD-DATASERVICE-007, EVD-DATASERVICE-015, EVD-DATASERVICE-020 | pass 缺口下载 db commit read-back 局部cold load和单次publish顺序一致 |
| AC-DATASERVICE-005-S01 | TASK-DATASERVICE-001, TASK-DATASERVICE-002, TASK-DATASERVICE-003, TASK-DATASERVICE-004, TASK-DATASERVICE-005, TASK-DATASERVICE-006, TASK-DATASERVICE-007, TASK-DATASERVICE-008, TASK-DATASERVICE-009, TASK-DATASERVICE-010, TASK-DATASERVICE-011, TASK-DATASERVICE-012, TASK-DATASERVICE-013, TASK-DATASERVICE-014, TASK-DATASERVICE-015, TASK-DATASERVICE-016 | CMD-DATASERVICE-057, CMD-DATASERVICE-058, CMD-DATASERVICE-059, CMD-DATASERVICE-063, CMD-DATASERVICE-064, CMD-DATASERVICE-065, CMD-DATASERVICE-003, CMD-DATASERVICE-004, CMD-DATASERVICE-005, CMD-DATASERVICE-006, CMD-DATASERVICE-007, CMD-DATASERVICE-008, CMD-DATASERVICE-009, CMD-DATASERVICE-010, CMD-DATASERVICE-011, CMD-DATASERVICE-012, CMD-DATASERVICE-013, CMD-DATASERVICE-014, CMD-DATASERVICE-015, CMD-DATASERVICE-016, CMD-DATASERVICE-017, CMD-DATASERVICE-018, CMD-DATASERVICE-019, CMD-DATASERVICE-020, CMD-DATASERVICE-021, CMD-DATASERVICE-022, CMD-DATASERVICE-023, CMD-DATASERVICE-024, CMD-DATASERVICE-025, CMD-DATASERVICE-026, CMD-DATASERVICE-027, CMD-DATASERVICE-028, CMD-DATASERVICE-029, CMD-DATASERVICE-030, CMD-DATASERVICE-031, CMD-DATASERVICE-032, CMD-DATASERVICE-033, CMD-DATASERVICE-034, CMD-DATASERVICE-035, CMD-DATASERVICE-036, CMD-DATASERVICE-037, CMD-DATASERVICE-038, CMD-DATASERVICE-039, CMD-DATASERVICE-040, CMD-DATASERVICE-041, CMD-DATASERVICE-042, CMD-DATASERVICE-087, CMD-DATASERVICE-090; EVD-DATASERVICE-005, EVD-DATASERVICE-007, EVD-DATASERVICE-015, EVD-DATASERVICE-021 | pass 系统持续接收和发布未受影响数据 修复成功后缺口恢复 |
| AC-DATASERVICE-006-S01 | TASK-DATASERVICE-001, TASK-DATASERVICE-002, TASK-DATASERVICE-003, TASK-DATASERVICE-004, TASK-DATASERVICE-005, TASK-DATASERVICE-006, TASK-DATASERVICE-007, TASK-DATASERVICE-008, TASK-DATASERVICE-009, TASK-DATASERVICE-010, TASK-DATASERVICE-011, TASK-DATASERVICE-012, TASK-DATASERVICE-013, TASK-DATASERVICE-014, TASK-DATASERVICE-015, TASK-DATASERVICE-016 | CMD-DATASERVICE-054, CMD-DATASERVICE-055, CMD-DATASERVICE-056, CMD-DATASERVICE-063, CMD-DATASERVICE-064, CMD-DATASERVICE-065, CMD-DATASERVICE-069, CMD-DATASERVICE-070, CMD-DATASERVICE-071, CMD-DATASERVICE-003, CMD-DATASERVICE-004, CMD-DATASERVICE-005, CMD-DATASERVICE-006, CMD-DATASERVICE-007, CMD-DATASERVICE-008, CMD-DATASERVICE-009, CMD-DATASERVICE-010, CMD-DATASERVICE-011, CMD-DATASERVICE-012, CMD-DATASERVICE-013, CMD-DATASERVICE-014, CMD-DATASERVICE-015, CMD-DATASERVICE-016, CMD-DATASERVICE-017, CMD-DATASERVICE-018, CMD-DATASERVICE-019, CMD-DATASERVICE-020, CMD-DATASERVICE-021, CMD-DATASERVICE-022, CMD-DATASERVICE-023, CMD-DATASERVICE-024, CMD-DATASERVICE-025, CMD-DATASERVICE-026, CMD-DATASERVICE-027, CMD-DATASERVICE-028, CMD-DATASERVICE-029, CMD-DATASERVICE-030, CMD-DATASERVICE-031, CMD-DATASERVICE-032, CMD-DATASERVICE-033, CMD-DATASERVICE-034, CMD-DATASERVICE-035, CMD-DATASERVICE-036, CMD-DATASERVICE-037, CMD-DATASERVICE-038, CMD-DATASERVICE-039, CMD-DATASERVICE-040, CMD-DATASERVICE-041, CMD-DATASERVICE-042, CMD-DATASERVICE-087, CMD-DATASERVICE-090; EVD-DATASERVICE-004, EVD-DATASERVICE-007, EVD-DATASERVICE-009, EVD-DATASERVICE-015, EVD-DATASERVICE-022 | pass 单周期和多周期图表读取同一descriptor并显示o |
| AC-DATASERVICE-007-S01 | TASK-DATASERVICE-001, TASK-DATASERVICE-002, TASK-DATASERVICE-003, TASK-DATASERVICE-004, TASK-DATASERVICE-005, TASK-DATASERVICE-006, TASK-DATASERVICE-007, TASK-DATASERVICE-008, TASK-DATASERVICE-009, TASK-DATASERVICE-010, TASK-DATASERVICE-011, TASK-DATASERVICE-012, TASK-DATASERVICE-013, TASK-DATASERVICE-014, TASK-DATASERVICE-015, TASK-DATASERVICE-016 | CMD-DATASERVICE-054, CMD-DATASERVICE-055, CMD-DATASERVICE-056, CMD-DATASERVICE-069, CMD-DATASERVICE-070, CMD-DATASERVICE-071, CMD-DATASERVICE-003, CMD-DATASERVICE-004, CMD-DATASERVICE-005, CMD-DATASERVICE-006, CMD-DATASERVICE-007, CMD-DATASERVICE-008, CMD-DATASERVICE-009, CMD-DATASERVICE-010, CMD-DATASERVICE-011, CMD-DATASERVICE-012, CMD-DATASERVICE-013, CMD-DATASERVICE-014, CMD-DATASERVICE-015, CMD-DATASERVICE-016, CMD-DATASERVICE-017, CMD-DATASERVICE-018, CMD-DATASERVICE-019, CMD-DATASERVICE-020, CMD-DATASERVICE-021, CMD-DATASERVICE-022, CMD-DATASERVICE-023, CMD-DATASERVICE-024, CMD-DATASERVICE-025, CMD-DATASERVICE-026, CMD-DATASERVICE-027, CMD-DATASERVICE-028, CMD-DATASERVICE-029, CMD-DATASERVICE-030, CMD-DATASERVICE-031, CMD-DATASERVICE-032, CMD-DATASERVICE-033, CMD-DATASERVICE-034, CMD-DATASERVICE-035, CMD-DATASERVICE-036, CMD-DATASERVICE-037, CMD-DATASERVICE-038, CMD-DATASERVICE-039, CMD-DATASERVICE-040, CMD-DATASERVICE-041, CMD-DATASERVICE-042, CMD-DATASERVICE-087, CMD-DATASERVICE-090; EVD-DATASERVICE-004, EVD-DATASERVICE-009, EVD-DATASERVICE-015, EVD-DATASERVICE-023 | pass 四组period start/open/current_bar_start_ix逐项成立 |
| AC-DATASERVICE-008-S01 | TASK-DATASERVICE-001, TASK-DATASERVICE-002, TASK-DATASERVICE-003, TASK-DATASERVICE-004, TASK-DATASERVICE-005, TASK-DATASERVICE-006, TASK-DATASERVICE-007, TASK-DATASERVICE-008, TASK-DATASERVICE-009, TASK-DATASERVICE-010, TASK-DATASERVICE-011, TASK-DATASERVICE-012, TASK-DATASERVICE-013, TASK-DATASERVICE-014, TASK-DATASERVICE-015, TASK-DATASERVICE-016 | CMD-DATASERVICE-057, CMD-DATASERVICE-058, CMD-DATASERVICE-059, CMD-DATASERVICE-063, CMD-DATASERVICE-064, CMD-DATASERVICE-065, CMD-DATASERVICE-069, CMD-DATASERVICE-070, CMD-DATASERVICE-071, CMD-DATASERVICE-003, CMD-DATASERVICE-004, CMD-DATASERVICE-005, CMD-DATASERVICE-006, CMD-DATASERVICE-007, CMD-DATASERVICE-008, CMD-DATASERVICE-009, CMD-DATASERVICE-010, CMD-DATASERVICE-011, CMD-DATASERVICE-012, CMD-DATASERVICE-013, CMD-DATASERVICE-014, CMD-DATASERVICE-015, CMD-DATASERVICE-016, CMD-DATASERVICE-017, CMD-DATASERVICE-018, CMD-DATASERVICE-019, CMD-DATASERVICE-020, CMD-DATASERVICE-021, CMD-DATASERVICE-022, CMD-DATASERVICE-023, CMD-DATASERVICE-024, CMD-DATASERVICE-025, CMD-DATASERVICE-026, CMD-DATASERVICE-027, CMD-DATASERVICE-028, CMD-DATASERVICE-029, CMD-DATASERVICE-030, CMD-DATASERVICE-031, CMD-DATASERVICE-032, CMD-DATASERVICE-033, CMD-DATASERVICE-034, CMD-DATASERVICE-035, CMD-DATASERVICE-036, CMD-DATASERVICE-037, CMD-DATASERVICE-038, CMD-DATASERVICE-039, CMD-DATASERVICE-040, CMD-DATASERVICE-041, CMD-DATASERVICE-042, CMD-DATASERVICE-087, CMD-DATASERVICE-090; EVD-DATASERVICE-005, EVD-DATASERVICE-007, EVD-DATASERVICE-009, EVD-DATASERVICE-015, EVD-DATASERVICE-024 | pass 缺失起点全程没有伪造4h bar 恢复后只发布正确值 |
| AC-DATASERVICE-009-S01 | TASK-DATASERVICE-001, TASK-DATASERVICE-002, TASK-DATASERVICE-003, TASK-DATASERVICE-004, TASK-DATASERVICE-005, TASK-DATASERVICE-006, TASK-DATASERVICE-007, TASK-DATASERVICE-008, TASK-DATASERVICE-009, TASK-DATASERVICE-010, TASK-DATASERVICE-011, TASK-DATASERVICE-012, TASK-DATASERVICE-013, TASK-DATASERVICE-014, TASK-DATASERVICE-015, TASK-DATASERVICE-016 | CMD-DATASERVICE-045, CMD-DATASERVICE-046, CMD-DATASERVICE-047, CMD-DATASERVICE-051, CMD-DATASERVICE-052, CMD-DATASERVICE-053, CMD-DATASERVICE-054, CMD-DATASERVICE-055, CMD-DATASERVICE-056, CMD-DATASERVICE-003, CMD-DATASERVICE-004, CMD-DATASERVICE-005, CMD-DATASERVICE-006, CMD-DATASERVICE-007, CMD-DATASERVICE-008, CMD-DATASERVICE-009, CMD-DATASERVICE-010, CMD-DATASERVICE-011, CMD-DATASERVICE-012, CMD-DATASERVICE-013, CMD-DATASERVICE-014, CMD-DATASERVICE-015, CMD-DATASERVICE-016, CMD-DATASERVICE-017, CMD-DATASERVICE-018, CMD-DATASERVICE-019, CMD-DATASERVICE-020, CMD-DATASERVICE-021, CMD-DATASERVICE-022, CMD-DATASERVICE-023, CMD-DATASERVICE-024, CMD-DATASERVICE-025, CMD-DATASERVICE-026, CMD-DATASERVICE-027, CMD-DATASERVICE-028, CMD-DATASERVICE-029, CMD-DATASERVICE-030, CMD-DATASERVICE-031, CMD-DATASERVICE-032, CMD-DATASERVICE-033, CMD-DATASERVICE-034, CMD-DATASERVICE-035, CMD-DATASERVICE-036, CMD-DATASERVICE-037, CMD-DATASERVICE-038, CMD-DATASERVICE-039, CMD-DATASERVICE-040, CMD-DATASERVICE-041, CMD-DATASERVICE-042, CMD-DATASERVICE-087, CMD-DATASERVICE-090, CMD-DATASERVICE-059, CMD-DATASERVICE-062, CMD-DATASERVICE-065, CMD-DATASERVICE-068, CMD-DATASERVICE-071, CMD-DATASERVICE-074, CMD-DATASERVICE-077, CMD-DATASERVICE-080, CMD-DATASERVICE-083, CMD-DATASERVICE-086, CMD-DATASERVICE-092; EVD-DATASERVICE-001, EVD-DATASERVICE-003, EVD-DATASERVICE-004, EVD-DATASERVICE-015, EVD-DATASERVICE-016, EVD-DATASERVICE-025 | pass ohlcv与 822c715e6 同输入characterization逐字段一致 |
| AC-DATASERVICE-009-S02 | TASK-DATASERVICE-001, TASK-DATASERVICE-002, TASK-DATASERVICE-003, TASK-DATASERVICE-004, TASK-DATASERVICE-005, TASK-DATASERVICE-006, TASK-DATASERVICE-007, TASK-DATASERVICE-008, TASK-DATASERVICE-009, TASK-DATASERVICE-010, TASK-DATASERVICE-011, TASK-DATASERVICE-012, TASK-DATASERVICE-013, TASK-DATASERVICE-014, TASK-DATASERVICE-015, TASK-DATASERVICE-016 | CMD-DATASERVICE-045, CMD-DATASERVICE-046, CMD-DATASERVICE-047, CMD-DATASERVICE-051, CMD-DATASERVICE-052, CMD-DATASERVICE-053, CMD-DATASERVICE-054, CMD-DATASERVICE-055, CMD-DATASERVICE-056, CMD-DATASERVICE-078, CMD-DATASERVICE-079, CMD-DATASERVICE-080, CMD-DATASERVICE-003, CMD-DATASERVICE-004, CMD-DATASERVICE-005, CMD-DATASERVICE-006, CMD-DATASERVICE-007, CMD-DATASERVICE-008, CMD-DATASERVICE-009, CMD-DATASERVICE-010, CMD-DATASERVICE-011, CMD-DATASERVICE-012, CMD-DATASERVICE-013, CMD-DATASERVICE-014, CMD-DATASERVICE-015, CMD-DATASERVICE-016, CMD-DATASERVICE-017, CMD-DATASERVICE-018, CMD-DATASERVICE-019, CMD-DATASERVICE-020, CMD-DATASERVICE-021, CMD-DATASERVICE-022, CMD-DATASERVICE-023, CMD-DATASERVICE-024, CMD-DATASERVICE-025, CMD-DATASERVICE-026, CMD-DATASERVICE-027, CMD-DATASERVICE-028, CMD-DATASERVICE-029, CMD-DATASERVICE-030, CMD-DATASERVICE-031, CMD-DATASERVICE-032, CMD-DATASERVICE-033, CMD-DATASERVICE-034, CMD-DATASERVICE-035, CMD-DATASERVICE-036, CMD-DATASERVICE-037, CMD-DATASERVICE-038, CMD-DATASERVICE-039, CMD-DATASERVICE-040, CMD-DATASERVICE-041, CMD-DATASERVICE-042, CMD-DATASERVICE-087, CMD-DATASERVICE-090, CMD-DATASERVICE-059, CMD-DATASERVICE-062, CMD-DATASERVICE-065, CMD-DATASERVICE-068, CMD-DATASERVICE-071, CMD-DATASERVICE-074, CMD-DATASERVICE-077, CMD-DATASERVICE-083, CMD-DATASERVICE-086, CMD-DATASERVICE-092; EVD-DATASERVICE-001, EVD-DATASERVICE-003, EVD-DATASERVICE-004, EVD-DATASERVICE-012, EVD-DATASERVICE-015, EVD-DATASERVICE-016, EVD-DATASERVICE-041 | pass 外部投递计数等于fixture事件数 聚合结果与单次输入一致 |
| AC-DATASERVICE-010-S01 | TASK-DATASERVICE-001, TASK-DATASERVICE-002, TASK-DATASERVICE-003, TASK-DATASERVICE-004, TASK-DATASERVICE-005, TASK-DATASERVICE-006, TASK-DATASERVICE-007, TASK-DATASERVICE-008, TASK-DATASERVICE-009, TASK-DATASERVICE-010, TASK-DATASERVICE-011, TASK-DATASERVICE-012, TASK-DATASERVICE-013, TASK-DATASERVICE-014, TASK-DATASERVICE-015, TASK-DATASERVICE-016 | CMD-DATASERVICE-054, CMD-DATASERVICE-055, CMD-DATASERVICE-056, CMD-DATASERVICE-078, CMD-DATASERVICE-079, CMD-DATASERVICE-080, CMD-DATASERVICE-003, CMD-DATASERVICE-004, CMD-DATASERVICE-005, CMD-DATASERVICE-006, CMD-DATASERVICE-007, CMD-DATASERVICE-008, CMD-DATASERVICE-009, CMD-DATASERVICE-010, CMD-DATASERVICE-011, CMD-DATASERVICE-012, CMD-DATASERVICE-013, CMD-DATASERVICE-014, CMD-DATASERVICE-015, CMD-DATASERVICE-016, CMD-DATASERVICE-017, CMD-DATASERVICE-018, CMD-DATASERVICE-019, CMD-DATASERVICE-020, CMD-DATASERVICE-021, CMD-DATASERVICE-022, CMD-DATASERVICE-023, CMD-DATASERVICE-024, CMD-DATASERVICE-025, CMD-DATASERVICE-026, CMD-DATASERVICE-027, CMD-DATASERVICE-028, CMD-DATASERVICE-029, CMD-DATASERVICE-030, CMD-DATASERVICE-031, CMD-DATASERVICE-032, CMD-DATASERVICE-033, CMD-DATASERVICE-034, CMD-DATASERVICE-035, CMD-DATASERVICE-036, CMD-DATASERVICE-037, CMD-DATASERVICE-038, CMD-DATASERVICE-039, CMD-DATASERVICE-040, CMD-DATASERVICE-041, CMD-DATASERVICE-042, CMD-DATASERVICE-087, CMD-DATASERVICE-090, CMD-DATASERVICE-053, CMD-DATASERVICE-059, CMD-DATASERVICE-062, CMD-DATASERVICE-065, CMD-DATASERVICE-068, CMD-DATASERVICE-071, CMD-DATASERVICE-074, CMD-DATASERVICE-077, CMD-DATASERVICE-083, CMD-DATASERVICE-086, CMD-DATASERVICE-092; EVD-DATASERVICE-004, EVD-DATASERVICE-012, EVD-DATASERVICE-015, EVD-DATASERVICE-016, EVD-DATASERVICE-026 | pass 每种连续性按第4.5节独立处置 |
| AC-DATASERVICE-011-S01 | TASK-DATASERVICE-001, TASK-DATASERVICE-002, TASK-DATASERVICE-003, TASK-DATASERVICE-004, TASK-DATASERVICE-005, TASK-DATASERVICE-006, TASK-DATASERVICE-007, TASK-DATASERVICE-008, TASK-DATASERVICE-009, TASK-DATASERVICE-010, TASK-DATASERVICE-011, TASK-DATASERVICE-012, TASK-DATASERVICE-013, TASK-DATASERVICE-014, TASK-DATASERVICE-015, TASK-DATASERVICE-016 | CMD-DATASERVICE-045, CMD-DATASERVICE-046, CMD-DATASERVICE-047, CMD-DATASERVICE-066, CMD-DATASERVICE-067, CMD-DATASERVICE-068, CMD-DATASERVICE-069, CMD-DATASERVICE-070, CMD-DATASERVICE-071, CMD-DATASERVICE-003, CMD-DATASERVICE-004, CMD-DATASERVICE-005, CMD-DATASERVICE-006, CMD-DATASERVICE-007, CMD-DATASERVICE-008, CMD-DATASERVICE-009, CMD-DATASERVICE-010, CMD-DATASERVICE-011, CMD-DATASERVICE-012, CMD-DATASERVICE-013, CMD-DATASERVICE-014, CMD-DATASERVICE-015, CMD-DATASERVICE-016, CMD-DATASERVICE-017, CMD-DATASERVICE-018, CMD-DATASERVICE-019, CMD-DATASERVICE-020, CMD-DATASERVICE-021, CMD-DATASERVICE-022, CMD-DATASERVICE-023, CMD-DATASERVICE-024, CMD-DATASERVICE-025, CMD-DATASERVICE-026, CMD-DATASERVICE-027, CMD-DATASERVICE-028, CMD-DATASERVICE-029, CMD-DATASERVICE-030, CMD-DATASERVICE-031, CMD-DATASERVICE-032, CMD-DATASERVICE-033, CMD-DATASERVICE-034, CMD-DATASERVICE-035, CMD-DATASERVICE-036, CMD-DATASERVICE-037, CMD-DATASERVICE-038, CMD-DATASERVICE-039, CMD-DATASERVICE-040, CMD-DATASERVICE-041, CMD-DATASERVICE-042, CMD-DATASERVICE-087, CMD-DATASERVICE-090, CMD-DATASERVICE-053, CMD-DATASERVICE-056, CMD-DATASERVICE-059, CMD-DATASERVICE-062, CMD-DATASERVICE-065, CMD-DATASERVICE-074, CMD-DATASERVICE-077, CMD-DATASERVICE-080, CMD-DATASERVICE-083, CMD-DATASERVICE-086, CMD-DATASERVICE-092; EVD-DATASERVICE-001, EVD-DATASERVICE-008, EVD-DATASERVICE-009, EVD-DATASERVICE-015, EVD-DATASERVICE-016, EVD-DATASERVICE-027 | pass lmdb u0/u1 映射值和plotdataitem实际xdata/ydata逐点一致 |
| AC-DATASERVICE-012-S01 | TASK-DATASERVICE-001, TASK-DATASERVICE-002, TASK-DATASERVICE-003, TASK-DATASERVICE-004, TASK-DATASERVICE-005, TASK-DATASERVICE-006, TASK-DATASERVICE-007, TASK-DATASERVICE-008, TASK-DATASERVICE-009, TASK-DATASERVICE-010, TASK-DATASERVICE-011, TASK-DATASERVICE-012, TASK-DATASERVICE-013, TASK-DATASERVICE-014, TASK-DATASERVICE-015, TASK-DATASERVICE-016 | CMD-DATASERVICE-045, CMD-DATASERVICE-046, CMD-DATASERVICE-047, CMD-DATASERVICE-066, CMD-DATASERVICE-067, CMD-DATASERVICE-068, CMD-DATASERVICE-069, CMD-DATASERVICE-070, CMD-DATASERVICE-071, CMD-DATASERVICE-003, CMD-DATASERVICE-004, CMD-DATASERVICE-005, CMD-DATASERVICE-006, CMD-DATASERVICE-007, CMD-DATASERVICE-008, CMD-DATASERVICE-009, CMD-DATASERVICE-010, CMD-DATASERVICE-011, CMD-DATASERVICE-012, CMD-DATASERVICE-013, CMD-DATASERVICE-014, CMD-DATASERVICE-015, CMD-DATASERVICE-016, CMD-DATASERVICE-017, CMD-DATASERVICE-018, CMD-DATASERVICE-019, CMD-DATASERVICE-020, CMD-DATASERVICE-021, CMD-DATASERVICE-022, CMD-DATASERVICE-023, CMD-DATASERVICE-024, CMD-DATASERVICE-025, CMD-DATASERVICE-026, CMD-DATASERVICE-027, CMD-DATASERVICE-028, CMD-DATASERVICE-029, CMD-DATASERVICE-030, CMD-DATASERVICE-031, CMD-DATASERVICE-032, CMD-DATASERVICE-033, CMD-DATASERVICE-034, CMD-DATASERVICE-035, CMD-DATASERVICE-036, CMD-DATASERVICE-037, CMD-DATASERVICE-038, CMD-DATASERVICE-039, CMD-DATASERVICE-040, CMD-DATASERVICE-041, CMD-DATASERVICE-042, CMD-DATASERVICE-087, CMD-DATASERVICE-090, CMD-DATASERVICE-053, CMD-DATASERVICE-056, CMD-DATASERVICE-059, CMD-DATASERVICE-062, CMD-DATASERVICE-065, CMD-DATASERVICE-074, CMD-DATASERVICE-077, CMD-DATASERVICE-080, CMD-DATASERVICE-083, CMD-DATASERVICE-086, CMD-DATASERVICE-092; EVD-DATASERVICE-001, EVD-DATASERVICE-008, EVD-DATASERVICE-009, EVD-DATASERVICE-015, EVD-DATASERVICE-016, EVD-DATASERVICE-028 | pass boll lower_higher_trend trend_state_machine完整通过 其他manifest指标smoke通过 |
| AC-DATASERVICE-013-S01 | TASK-DATASERVICE-001, TASK-DATASERVICE-002, TASK-DATASERVICE-003, TASK-DATASERVICE-004, TASK-DATASERVICE-005, TASK-DATASERVICE-006, TASK-DATASERVICE-007, TASK-DATASERVICE-008, TASK-DATASERVICE-009, TASK-DATASERVICE-010, TASK-DATASERVICE-011, TASK-DATASERVICE-012, TASK-DATASERVICE-013, TASK-DATASERVICE-014, TASK-DATASERVICE-015, TASK-DATASERVICE-016 | CMD-DATASERVICE-066, CMD-DATASERVICE-067, CMD-DATASERVICE-068, CMD-DATASERVICE-069, CMD-DATASERVICE-070, CMD-DATASERVICE-071, CMD-DATASERVICE-003, CMD-DATASERVICE-004, CMD-DATASERVICE-005, CMD-DATASERVICE-006, CMD-DATASERVICE-007, CMD-DATASERVICE-008, CMD-DATASERVICE-009, CMD-DATASERVICE-010, CMD-DATASERVICE-011, CMD-DATASERVICE-012, CMD-DATASERVICE-013, CMD-DATASERVICE-014, CMD-DATASERVICE-015, CMD-DATASERVICE-016, CMD-DATASERVICE-017, CMD-DATASERVICE-018, CMD-DATASERVICE-019, CMD-DATASERVICE-020, CMD-DATASERVICE-021, CMD-DATASERVICE-022, CMD-DATASERVICE-023, CMD-DATASERVICE-024, CMD-DATASERVICE-025, CMD-DATASERVICE-026, CMD-DATASERVICE-027, CMD-DATASERVICE-028, CMD-DATASERVICE-029, CMD-DATASERVICE-030, CMD-DATASERVICE-031, CMD-DATASERVICE-032, CMD-DATASERVICE-033, CMD-DATASERVICE-034, CMD-DATASERVICE-035, CMD-DATASERVICE-036, CMD-DATASERVICE-037, CMD-DATASERVICE-038, CMD-DATASERVICE-039, CMD-DATASERVICE-040, CMD-DATASERVICE-041, CMD-DATASERVICE-042, CMD-DATASERVICE-087, CMD-DATASERVICE-090, CMD-DATASERVICE-053, CMD-DATASERVICE-056, CMD-DATASERVICE-059, CMD-DATASERVICE-062, CMD-DATASERVICE-065, CMD-DATASERVICE-074, CMD-DATASERVICE-077, CMD-DATASERVICE-080, CMD-DATASERVICE-083, CMD-DATASERVICE-086, CMD-DATASERVICE-092; EVD-DATASERVICE-008, EVD-DATASERVICE-009, EVD-DATASERVICE-015, EVD-DATASERVICE-016, EVD-DATASERVICE-029 | pass cold和warm两次最终绘图完全一致 第二次命中lmdb |
| AC-DATASERVICE-013-S02 | TASK-DATASERVICE-001, TASK-DATASERVICE-002, TASK-DATASERVICE-003, TASK-DATASERVICE-004, TASK-DATASERVICE-005, TASK-DATASERVICE-006, TASK-DATASERVICE-007, TASK-DATASERVICE-008, TASK-DATASERVICE-009, TASK-DATASERVICE-010, TASK-DATASERVICE-011, TASK-DATASERVICE-012, TASK-DATASERVICE-013, TASK-DATASERVICE-014, TASK-DATASERVICE-015, TASK-DATASERVICE-016 | CMD-DATASERVICE-057, CMD-DATASERVICE-058, CMD-DATASERVICE-059, CMD-DATASERVICE-063, CMD-DATASERVICE-064, CMD-DATASERVICE-065, CMD-DATASERVICE-066, CMD-DATASERVICE-067, CMD-DATASERVICE-068, CMD-DATASERVICE-069, CMD-DATASERVICE-070, CMD-DATASERVICE-071, CMD-DATASERVICE-003, CMD-DATASERVICE-004, CMD-DATASERVICE-005, CMD-DATASERVICE-006, CMD-DATASERVICE-007, CMD-DATASERVICE-008, CMD-DATASERVICE-009, CMD-DATASERVICE-010, CMD-DATASERVICE-011, CMD-DATASERVICE-012, CMD-DATASERVICE-013, CMD-DATASERVICE-014, CMD-DATASERVICE-015, CMD-DATASERVICE-016, CMD-DATASERVICE-017, CMD-DATASERVICE-018, CMD-DATASERVICE-019, CMD-DATASERVICE-020, CMD-DATASERVICE-021, CMD-DATASERVICE-022, CMD-DATASERVICE-023, CMD-DATASERVICE-024, CMD-DATASERVICE-025, CMD-DATASERVICE-026, CMD-DATASERVICE-027, CMD-DATASERVICE-028, CMD-DATASERVICE-029, CMD-DATASERVICE-030, CMD-DATASERVICE-031, CMD-DATASERVICE-032, CMD-DATASERVICE-033, CMD-DATASERVICE-034, CMD-DATASERVICE-035, CMD-DATASERVICE-036, CMD-DATASERVICE-037, CMD-DATASERVICE-038, CMD-DATASERVICE-039, CMD-DATASERVICE-040, CMD-DATASERVICE-041, CMD-DATASERVICE-042, CMD-DATASERVICE-087, CMD-DATASERVICE-090, CMD-DATASERVICE-053, CMD-DATASERVICE-056, CMD-DATASERVICE-062, CMD-DATASERVICE-074, CMD-DATASERVICE-077, CMD-DATASERVICE-080, CMD-DATASERVICE-083, CMD-DATASERVICE-086, CMD-DATASERVICE-092; EVD-DATASERVICE-005, EVD-DATASERVICE-007, EVD-DATASERVICE-008, EVD-DATASERVICE-009, EVD-DATASERVICE-015, EVD-DATASERVICE-016, EVD-DATASERVICE-042 | pass 用户看到缺口而非跨缺口连线或伪造k线 其他segment仍显示 |
| AC-DATASERVICE-014-S01 | TASK-DATASERVICE-001, TASK-DATASERVICE-002, TASK-DATASERVICE-003, TASK-DATASERVICE-004, TASK-DATASERVICE-005, TASK-DATASERVICE-006, TASK-DATASERVICE-007, TASK-DATASERVICE-008, TASK-DATASERVICE-009, TASK-DATASERVICE-010, TASK-DATASERVICE-011, TASK-DATASERVICE-012, TASK-DATASERVICE-013, TASK-DATASERVICE-014, TASK-DATASERVICE-015, TASK-DATASERVICE-016 | CMD-DATASERVICE-072, CMD-DATASERVICE-073, CMD-DATASERVICE-074, CMD-DATASERVICE-075, CMD-DATASERVICE-076, CMD-DATASERVICE-077, CMD-DATASERVICE-003, CMD-DATASERVICE-004, CMD-DATASERVICE-005, CMD-DATASERVICE-006, CMD-DATASERVICE-007, CMD-DATASERVICE-008, CMD-DATASERVICE-009, CMD-DATASERVICE-010, CMD-DATASERVICE-011, CMD-DATASERVICE-012, CMD-DATASERVICE-013, CMD-DATASERVICE-014, CMD-DATASERVICE-015, CMD-DATASERVICE-016, CMD-DATASERVICE-017, CMD-DATASERVICE-018, CMD-DATASERVICE-019, CMD-DATASERVICE-020, CMD-DATASERVICE-021, CMD-DATASERVICE-022, CMD-DATASERVICE-023, CMD-DATASERVICE-024, CMD-DATASERVICE-025, CMD-DATASERVICE-026, CMD-DATASERVICE-027, CMD-DATASERVICE-028, CMD-DATASERVICE-029, CMD-DATASERVICE-030, CMD-DATASERVICE-031, CMD-DATASERVICE-032, CMD-DATASERVICE-033, CMD-DATASERVICE-034, CMD-DATASERVICE-035, CMD-DATASERVICE-036, CMD-DATASERVICE-037, CMD-DATASERVICE-038, CMD-DATASERVICE-039, CMD-DATASERVICE-040, CMD-DATASERVICE-041, CMD-DATASERVICE-042, CMD-DATASERVICE-087, CMD-DATASERVICE-090, CMD-DATASERVICE-053, CMD-DATASERVICE-056, CMD-DATASERVICE-059, CMD-DATASERVICE-062, CMD-DATASERVICE-065, CMD-DATASERVICE-068, CMD-DATASERVICE-071, CMD-DATASERVICE-080, CMD-DATASERVICE-083, CMD-DATASERVICE-086, CMD-DATASERVICE-092; EVD-DATASERVICE-010, EVD-DATASERVICE-011, EVD-DATASERVICE-015, EVD-DATASERVICE-016, EVD-DATASERVICE-030 | pass dataservice收到recorder config命令次数为0 非active实时订阅增加数为0 |
| AC-DATASERVICE-015-S01 | TASK-DATASERVICE-001, TASK-DATASERVICE-002, TASK-DATASERVICE-003, TASK-DATASERVICE-004, TASK-DATASERVICE-005, TASK-DATASERVICE-006, TASK-DATASERVICE-007, TASK-DATASERVICE-008, TASK-DATASERVICE-009, TASK-DATASERVICE-010, TASK-DATASERVICE-011, TASK-DATASERVICE-012, TASK-DATASERVICE-013, TASK-DATASERVICE-014, TASK-DATASERVICE-015, TASK-DATASERVICE-016 | CMD-DATASERVICE-045, CMD-DATASERVICE-046, CMD-DATASERVICE-047, CMD-DATASERVICE-060, CMD-DATASERVICE-061, CMD-DATASERVICE-062, CMD-DATASERVICE-072, CMD-DATASERVICE-073, CMD-DATASERVICE-074, CMD-DATASERVICE-075, CMD-DATASERVICE-076, CMD-DATASERVICE-077, CMD-DATASERVICE-003, CMD-DATASERVICE-004, CMD-DATASERVICE-005, CMD-DATASERVICE-006, CMD-DATASERVICE-007, CMD-DATASERVICE-008, CMD-DATASERVICE-009, CMD-DATASERVICE-010, CMD-DATASERVICE-011, CMD-DATASERVICE-012, CMD-DATASERVICE-013, CMD-DATASERVICE-014, CMD-DATASERVICE-015, CMD-DATASERVICE-016, CMD-DATASERVICE-017, CMD-DATASERVICE-018, CMD-DATASERVICE-019, CMD-DATASERVICE-020, CMD-DATASERVICE-021, CMD-DATASERVICE-022, CMD-DATASERVICE-023, CMD-DATASERVICE-024, CMD-DATASERVICE-025, CMD-DATASERVICE-026, CMD-DATASERVICE-027, CMD-DATASERVICE-028, CMD-DATASERVICE-029, CMD-DATASERVICE-030, CMD-DATASERVICE-031, CMD-DATASERVICE-032, CMD-DATASERVICE-033, CMD-DATASERVICE-034, CMD-DATASERVICE-035, CMD-DATASERVICE-036, CMD-DATASERVICE-037, CMD-DATASERVICE-038, CMD-DATASERVICE-039, CMD-DATASERVICE-040, CMD-DATASERVICE-041, CMD-DATASERVICE-042, CMD-DATASERVICE-087, CMD-DATASERVICE-090, CMD-DATASERVICE-053, CMD-DATASERVICE-056, CMD-DATASERVICE-059, CMD-DATASERVICE-065, CMD-DATASERVICE-068, CMD-DATASERVICE-071, CMD-DATASERVICE-080, CMD-DATASERVICE-083, CMD-DATASERVICE-086, CMD-DATASERVICE-092; EVD-DATASERVICE-001, EVD-DATASERVICE-006, EVD-DATASERVICE-010, EVD-DATASERVICE-011, EVD-DATASERVICE-015, EVD-DATASERVICE-016, EVD-DATASERVICE-031 | pass 日志 统计 db rows selected/skipped persistence group durable状态 checkpoint和ack逐项对应真实操作 |
| AC-DATASERVICE-016-S01 | TASK-DATASERVICE-001, TASK-DATASERVICE-002, TASK-DATASERVICE-003, TASK-DATASERVICE-004, TASK-DATASERVICE-005, TASK-DATASERVICE-006, TASK-DATASERVICE-007, TASK-DATASERVICE-008, TASK-DATASERVICE-009, TASK-DATASERVICE-010, TASK-DATASERVICE-011, TASK-DATASERVICE-012, TASK-DATASERVICE-013, TASK-DATASERVICE-014, TASK-DATASERVICE-015, TASK-DATASERVICE-016 | CMD-DATASERVICE-048, CMD-DATASERVICE-049, CMD-DATASERVICE-050, CMD-DATASERVICE-060, CMD-DATASERVICE-061, CMD-DATASERVICE-062, CMD-DATASERVICE-075, CMD-DATASERVICE-076, CMD-DATASERVICE-077, CMD-DATASERVICE-003, CMD-DATASERVICE-004, CMD-DATASERVICE-005, CMD-DATASERVICE-006, CMD-DATASERVICE-007, CMD-DATASERVICE-008, CMD-DATASERVICE-009, CMD-DATASERVICE-010, CMD-DATASERVICE-011, CMD-DATASERVICE-012, CMD-DATASERVICE-013, CMD-DATASERVICE-014, CMD-DATASERVICE-015, CMD-DATASERVICE-016, CMD-DATASERVICE-017, CMD-DATASERVICE-018, CMD-DATASERVICE-019, CMD-DATASERVICE-020, CMD-DATASERVICE-021, CMD-DATASERVICE-022, CMD-DATASERVICE-023, CMD-DATASERVICE-024, CMD-DATASERVICE-025, CMD-DATASERVICE-026, CMD-DATASERVICE-027, CMD-DATASERVICE-028, CMD-DATASERVICE-029, CMD-DATASERVICE-030, CMD-DATASERVICE-031, CMD-DATASERVICE-032, CMD-DATASERVICE-033, CMD-DATASERVICE-034, CMD-DATASERVICE-035, CMD-DATASERVICE-036, CMD-DATASERVICE-037, CMD-DATASERVICE-038, CMD-DATASERVICE-039, CMD-DATASERVICE-040, CMD-DATASERVICE-041, CMD-DATASERVICE-042, CMD-DATASERVICE-087, CMD-DATASERVICE-090, CMD-DATASERVICE-053, CMD-DATASERVICE-056, CMD-DATASERVICE-059, CMD-DATASERVICE-065, CMD-DATASERVICE-068, CMD-DATASERVICE-071, CMD-DATASERVICE-074, CMD-DATASERVICE-080, CMD-DATASERVICE-083, CMD-DATASERVICE-086, CMD-DATASERVICE-092; EVD-DATASERVICE-002, EVD-DATASERVICE-006, EVD-DATASERVICE-011, EVD-DATASERVICE-015, EVD-DATASERVICE-016, EVD-DATASERVICE-032 | pass checkpoint未越过未commit batch 重启后无sequence hole |
| AC-DATASERVICE-016-S02 | TASK-DATASERVICE-001, TASK-DATASERVICE-002, TASK-DATASERVICE-003, TASK-DATASERVICE-004, TASK-DATASERVICE-005, TASK-DATASERVICE-006, TASK-DATASERVICE-007, TASK-DATASERVICE-008, TASK-DATASERVICE-009, TASK-DATASERVICE-010, TASK-DATASERVICE-011, TASK-DATASERVICE-012, TASK-DATASERVICE-013, TASK-DATASERVICE-014, TASK-DATASERVICE-015, TASK-DATASERVICE-016 | CMD-DATASERVICE-060, CMD-DATASERVICE-061, CMD-DATASERVICE-062, CMD-DATASERVICE-075, CMD-DATASERVICE-076, CMD-DATASERVICE-077, CMD-DATASERVICE-003, CMD-DATASERVICE-004, CMD-DATASERVICE-005, CMD-DATASERVICE-006, CMD-DATASERVICE-007, CMD-DATASERVICE-008, CMD-DATASERVICE-009, CMD-DATASERVICE-010, CMD-DATASERVICE-011, CMD-DATASERVICE-012, CMD-DATASERVICE-013, CMD-DATASERVICE-014, CMD-DATASERVICE-015, CMD-DATASERVICE-016, CMD-DATASERVICE-017, CMD-DATASERVICE-018, CMD-DATASERVICE-019, CMD-DATASERVICE-020, CMD-DATASERVICE-021, CMD-DATASERVICE-022, CMD-DATASERVICE-023, CMD-DATASERVICE-024, CMD-DATASERVICE-025, CMD-DATASERVICE-026, CMD-DATASERVICE-027, CMD-DATASERVICE-028, CMD-DATASERVICE-029, CMD-DATASERVICE-030, CMD-DATASERVICE-031, CMD-DATASERVICE-032, CMD-DATASERVICE-033, CMD-DATASERVICE-034, CMD-DATASERVICE-035, CMD-DATASERVICE-036, CMD-DATASERVICE-037, CMD-DATASERVICE-038, CMD-DATASERVICE-039, CMD-DATASERVICE-040, CMD-DATASERVICE-041, CMD-DATASERVICE-042, CMD-DATASERVICE-087, CMD-DATASERVICE-090, CMD-DATASERVICE-053, CMD-DATASERVICE-056, CMD-DATASERVICE-059, CMD-DATASERVICE-065, CMD-DATASERVICE-068, CMD-DATASERVICE-071, CMD-DATASERVICE-074, CMD-DATASERVICE-080, CMD-DATASERVICE-083, CMD-DATASERVICE-086, CMD-DATASERVICE-092; EVD-DATASERVICE-006, EVD-DATASERVICE-011, EVD-DATASERVICE-015, EVD-DATASERVICE-016, EVD-DATASERVICE-043 | pass db每identity一行且事务字段完全相同 |
| AC-DATASERVICE-016-S03 | TASK-DATASERVICE-001, TASK-DATASERVICE-002, TASK-DATASERVICE-003, TASK-DATASERVICE-004, TASK-DATASERVICE-005, TASK-DATASERVICE-006, TASK-DATASERVICE-007, TASK-DATASERVICE-008, TASK-DATASERVICE-009, TASK-DATASERVICE-010, TASK-DATASERVICE-011, TASK-DATASERVICE-012, TASK-DATASERVICE-013, TASK-DATASERVICE-014, TASK-DATASERVICE-015, TASK-DATASERVICE-016 | CMD-DATASERVICE-060, CMD-DATASERVICE-061, CMD-DATASERVICE-062, CMD-DATASERVICE-075, CMD-DATASERVICE-076, CMD-DATASERVICE-077, CMD-DATASERVICE-003, CMD-DATASERVICE-004, CMD-DATASERVICE-005, CMD-DATASERVICE-006, CMD-DATASERVICE-007, CMD-DATASERVICE-008, CMD-DATASERVICE-009, CMD-DATASERVICE-010, CMD-DATASERVICE-011, CMD-DATASERVICE-012, CMD-DATASERVICE-013, CMD-DATASERVICE-014, CMD-DATASERVICE-015, CMD-DATASERVICE-016, CMD-DATASERVICE-017, CMD-DATASERVICE-018, CMD-DATASERVICE-019, CMD-DATASERVICE-020, CMD-DATASERVICE-021, CMD-DATASERVICE-022, CMD-DATASERVICE-023, CMD-DATASERVICE-024, CMD-DATASERVICE-025, CMD-DATASERVICE-026, CMD-DATASERVICE-027, CMD-DATASERVICE-028, CMD-DATASERVICE-029, CMD-DATASERVICE-030, CMD-DATASERVICE-031, CMD-DATASERVICE-032, CMD-DATASERVICE-033, CMD-DATASERVICE-034, CMD-DATASERVICE-035, CMD-DATASERVICE-036, CMD-DATASERVICE-037, CMD-DATASERVICE-038, CMD-DATASERVICE-039, CMD-DATASERVICE-040, CMD-DATASERVICE-041, CMD-DATASERVICE-042, CMD-DATASERVICE-087, CMD-DATASERVICE-090, CMD-DATASERVICE-053, CMD-DATASERVICE-056, CMD-DATASERVICE-059, CMD-DATASERVICE-065, CMD-DATASERVICE-068, CMD-DATASERVICE-071, CMD-DATASERVICE-074, CMD-DATASERVICE-080, CMD-DATASERVICE-083, CMD-DATASERVICE-086, CMD-DATASERVICE-092; EVD-DATASERVICE-006, EVD-DATASERVICE-011, EVD-DATASERVICE-015, EVD-DATASERVICE-016, EVD-DATASERVICE-044 | pass db不变 checkpoint不回退 producer释放该batch等待状态 |
| AC-DATASERVICE-016-S04 | TASK-DATASERVICE-001, TASK-DATASERVICE-002, TASK-DATASERVICE-003, TASK-DATASERVICE-004, TASK-DATASERVICE-005, TASK-DATASERVICE-006, TASK-DATASERVICE-007, TASK-DATASERVICE-008, TASK-DATASERVICE-009, TASK-DATASERVICE-010, TASK-DATASERVICE-011, TASK-DATASERVICE-012, TASK-DATASERVICE-013, TASK-DATASERVICE-014, TASK-DATASERVICE-015, TASK-DATASERVICE-016 | CMD-DATASERVICE-060, CMD-DATASERVICE-061, CMD-DATASERVICE-062, CMD-DATASERVICE-072, CMD-DATASERVICE-073, CMD-DATASERVICE-074, CMD-DATASERVICE-075, CMD-DATASERVICE-076, CMD-DATASERVICE-077, CMD-DATASERVICE-003, CMD-DATASERVICE-004, CMD-DATASERVICE-005, CMD-DATASERVICE-006, CMD-DATASERVICE-007, CMD-DATASERVICE-008, CMD-DATASERVICE-009, CMD-DATASERVICE-010, CMD-DATASERVICE-011, CMD-DATASERVICE-012, CMD-DATASERVICE-013, CMD-DATASERVICE-014, CMD-DATASERVICE-015, CMD-DATASERVICE-016, CMD-DATASERVICE-017, CMD-DATASERVICE-018, CMD-DATASERVICE-019, CMD-DATASERVICE-020, CMD-DATASERVICE-021, CMD-DATASERVICE-022, CMD-DATASERVICE-023, CMD-DATASERVICE-024, CMD-DATASERVICE-025, CMD-DATASERVICE-026, CMD-DATASERVICE-027, CMD-DATASERVICE-028, CMD-DATASERVICE-029, CMD-DATASERVICE-030, CMD-DATASERVICE-031, CMD-DATASERVICE-032, CMD-DATASERVICE-033, CMD-DATASERVICE-034, CMD-DATASERVICE-035, CMD-DATASERVICE-036, CMD-DATASERVICE-037, CMD-DATASERVICE-038, CMD-DATASERVICE-039, CMD-DATASERVICE-040, CMD-DATASERVICE-041, CMD-DATASERVICE-042, CMD-DATASERVICE-087, CMD-DATASERVICE-090, CMD-DATASERVICE-053, CMD-DATASERVICE-056, CMD-DATASERVICE-059, CMD-DATASERVICE-065, CMD-DATASERVICE-068, CMD-DATASERVICE-071, CMD-DATASERVICE-080, CMD-DATASERVICE-083, CMD-DATASERVICE-086, CMD-DATASERVICE-092; EVD-DATASERVICE-006, EVD-DATASERVICE-010, EVD-DATASERVICE-011, EVD-DATASERVICE-015, EVD-DATASERVICE-016, EVD-DATASERVICE-045 | pass 配置生效边界是首次消费 崩溃不改变旧决定 |
| AC-DATASERVICE-017-S01 | TASK-DATASERVICE-001, TASK-DATASERVICE-002, TASK-DATASERVICE-003, TASK-DATASERVICE-004, TASK-DATASERVICE-005, TASK-DATASERVICE-006, TASK-DATASERVICE-007, TASK-DATASERVICE-008, TASK-DATASERVICE-009, TASK-DATASERVICE-010, TASK-DATASERVICE-011, TASK-DATASERVICE-012, TASK-DATASERVICE-013, TASK-DATASERVICE-014, TASK-DATASERVICE-015, TASK-DATASERVICE-016 | CMD-DATASERVICE-045, CMD-DATASERVICE-046, CMD-DATASERVICE-047, CMD-DATASERVICE-078, CMD-DATASERVICE-079, CMD-DATASERVICE-080, CMD-DATASERVICE-003, CMD-DATASERVICE-004, CMD-DATASERVICE-005, CMD-DATASERVICE-006, CMD-DATASERVICE-007, CMD-DATASERVICE-008, CMD-DATASERVICE-009, CMD-DATASERVICE-010, CMD-DATASERVICE-011, CMD-DATASERVICE-012, CMD-DATASERVICE-013, CMD-DATASERVICE-014, CMD-DATASERVICE-015, CMD-DATASERVICE-016, CMD-DATASERVICE-017, CMD-DATASERVICE-018, CMD-DATASERVICE-019, CMD-DATASERVICE-020, CMD-DATASERVICE-021, CMD-DATASERVICE-022, CMD-DATASERVICE-023, CMD-DATASERVICE-024, CMD-DATASERVICE-025, CMD-DATASERVICE-026, CMD-DATASERVICE-027, CMD-DATASERVICE-028, CMD-DATASERVICE-029, CMD-DATASERVICE-030, CMD-DATASERVICE-031, CMD-DATASERVICE-032, CMD-DATASERVICE-033, CMD-DATASERVICE-034, CMD-DATASERVICE-035, CMD-DATASERVICE-036, CMD-DATASERVICE-037, CMD-DATASERVICE-038, CMD-DATASERVICE-039, CMD-DATASERVICE-040, CMD-DATASERVICE-041, CMD-DATASERVICE-042, CMD-DATASERVICE-087, CMD-DATASERVICE-090, CMD-DATASERVICE-053, CMD-DATASERVICE-056, CMD-DATASERVICE-059, CMD-DATASERVICE-062, CMD-DATASERVICE-065, CMD-DATASERVICE-068, CMD-DATASERVICE-071, CMD-DATASERVICE-074, CMD-DATASERVICE-077, CMD-DATASERVICE-083, CMD-DATASERVICE-086, CMD-DATASERVICE-092; EVD-DATASERVICE-001, EVD-DATASERVICE-012, EVD-DATASERVICE-015, EVD-DATASERVICE-016, EVD-DATASERVICE-033 | pass dataservice shared completed直接调用策略bar callback次数为0 |
| AC-DATASERVICE-018-S01 | TASK-DATASERVICE-001, TASK-DATASERVICE-002, TASK-DATASERVICE-003, TASK-DATASERVICE-004, TASK-DATASERVICE-005, TASK-DATASERVICE-006, TASK-DATASERVICE-007, TASK-DATASERVICE-008, TASK-DATASERVICE-009, TASK-DATASERVICE-010, TASK-DATASERVICE-011, TASK-DATASERVICE-012, TASK-DATASERVICE-013, TASK-DATASERVICE-014, TASK-DATASERVICE-015, TASK-DATASERVICE-016 | CMD-DATASERVICE-045, CMD-DATASERVICE-046, CMD-DATASERVICE-047, CMD-DATASERVICE-078, CMD-DATASERVICE-079, CMD-DATASERVICE-080, CMD-DATASERVICE-003, CMD-DATASERVICE-004, CMD-DATASERVICE-005, CMD-DATASERVICE-006, CMD-DATASERVICE-007, CMD-DATASERVICE-008, CMD-DATASERVICE-009, CMD-DATASERVICE-010, CMD-DATASERVICE-011, CMD-DATASERVICE-012, CMD-DATASERVICE-013, CMD-DATASERVICE-014, CMD-DATASERVICE-015, CMD-DATASERVICE-016, CMD-DATASERVICE-017, CMD-DATASERVICE-018, CMD-DATASERVICE-019, CMD-DATASERVICE-020, CMD-DATASERVICE-021, CMD-DATASERVICE-022, CMD-DATASERVICE-023, CMD-DATASERVICE-024, CMD-DATASERVICE-025, CMD-DATASERVICE-026, CMD-DATASERVICE-027, CMD-DATASERVICE-028, CMD-DATASERVICE-029, CMD-DATASERVICE-030, CMD-DATASERVICE-031, CMD-DATASERVICE-032, CMD-DATASERVICE-033, CMD-DATASERVICE-034, CMD-DATASERVICE-035, CMD-DATASERVICE-036, CMD-DATASERVICE-037, CMD-DATASERVICE-038, CMD-DATASERVICE-039, CMD-DATASERVICE-040, CMD-DATASERVICE-041, CMD-DATASERVICE-042, CMD-DATASERVICE-087, CMD-DATASERVICE-090, CMD-DATASERVICE-053, CMD-DATASERVICE-056, CMD-DATASERVICE-059, CMD-DATASERVICE-062, CMD-DATASERVICE-065, CMD-DATASERVICE-068, CMD-DATASERVICE-071, CMD-DATASERVICE-074, CMD-DATASERVICE-077, CMD-DATASERVICE-083, CMD-DATASERVICE-086, CMD-DATASERVICE-092; EVD-DATASERVICE-001, EVD-DATASERVICE-012, EVD-DATASERVICE-015, EVD-DATASERVICE-016, EVD-DATASERVICE-034 | pass 不依赖100ms ui轮询也能读取最新tick |
| AC-DATASERVICE-019-S01 | TASK-DATASERVICE-001, TASK-DATASERVICE-002, TASK-DATASERVICE-003, TASK-DATASERVICE-004, TASK-DATASERVICE-005, TASK-DATASERVICE-006, TASK-DATASERVICE-007, TASK-DATASERVICE-008, TASK-DATASERVICE-009, TASK-DATASERVICE-010, TASK-DATASERVICE-011, TASK-DATASERVICE-012, TASK-DATASERVICE-013, TASK-DATASERVICE-014, TASK-DATASERVICE-015, TASK-DATASERVICE-016 | CMD-DATASERVICE-045, CMD-DATASERVICE-046, CMD-DATASERVICE-047, CMD-DATASERVICE-051, CMD-DATASERVICE-052, CMD-DATASERVICE-053, CMD-DATASERVICE-078, CMD-DATASERVICE-079, CMD-DATASERVICE-080, CMD-DATASERVICE-003, CMD-DATASERVICE-004, CMD-DATASERVICE-005, CMD-DATASERVICE-006, CMD-DATASERVICE-007, CMD-DATASERVICE-008, CMD-DATASERVICE-009, CMD-DATASERVICE-010, CMD-DATASERVICE-011, CMD-DATASERVICE-012, CMD-DATASERVICE-013, CMD-DATASERVICE-014, CMD-DATASERVICE-015, CMD-DATASERVICE-016, CMD-DATASERVICE-017, CMD-DATASERVICE-018, CMD-DATASERVICE-019, CMD-DATASERVICE-020, CMD-DATASERVICE-021, CMD-DATASERVICE-022, CMD-DATASERVICE-023, CMD-DATASERVICE-024, CMD-DATASERVICE-025, CMD-DATASERVICE-026, CMD-DATASERVICE-027, CMD-DATASERVICE-028, CMD-DATASERVICE-029, CMD-DATASERVICE-030, CMD-DATASERVICE-031, CMD-DATASERVICE-032, CMD-DATASERVICE-033, CMD-DATASERVICE-034, CMD-DATASERVICE-035, CMD-DATASERVICE-036, CMD-DATASERVICE-037, CMD-DATASERVICE-038, CMD-DATASERVICE-039, CMD-DATASERVICE-040, CMD-DATASERVICE-041, CMD-DATASERVICE-042, CMD-DATASERVICE-087, CMD-DATASERVICE-090, CMD-DATASERVICE-056, CMD-DATASERVICE-059, CMD-DATASERVICE-062, CMD-DATASERVICE-065, CMD-DATASERVICE-068, CMD-DATASERVICE-071, CMD-DATASERVICE-074, CMD-DATASERVICE-077, CMD-DATASERVICE-083, CMD-DATASERVICE-086, CMD-DATASERVICE-092; EVD-DATASERVICE-001, EVD-DATASERVICE-003, EVD-DATASERVICE-012, EVD-DATASERVICE-015, EVD-DATASERVICE-016, EVD-DATASERVICE-035 | pass 同一tick不造成重复replace 旧actual tick被拒绝 |
| AC-DATASERVICE-020-S01 | TASK-DATASERVICE-001, TASK-DATASERVICE-002, TASK-DATASERVICE-003, TASK-DATASERVICE-004, TASK-DATASERVICE-005, TASK-DATASERVICE-006, TASK-DATASERVICE-007, TASK-DATASERVICE-008, TASK-DATASERVICE-009, TASK-DATASERVICE-010, TASK-DATASERVICE-011, TASK-DATASERVICE-012, TASK-DATASERVICE-013, TASK-DATASERVICE-014, TASK-DATASERVICE-015, TASK-DATASERVICE-016 | CMD-DATASERVICE-081, CMD-DATASERVICE-082, CMD-DATASERVICE-083, CMD-DATASERVICE-003, CMD-DATASERVICE-004, CMD-DATASERVICE-005, CMD-DATASERVICE-006, CMD-DATASERVICE-007, CMD-DATASERVICE-008, CMD-DATASERVICE-009, CMD-DATASERVICE-010, CMD-DATASERVICE-011, CMD-DATASERVICE-012, CMD-DATASERVICE-013, CMD-DATASERVICE-014, CMD-DATASERVICE-015, CMD-DATASERVICE-016, CMD-DATASERVICE-017, CMD-DATASERVICE-018, CMD-DATASERVICE-019, CMD-DATASERVICE-020, CMD-DATASERVICE-021, CMD-DATASERVICE-022, CMD-DATASERVICE-023, CMD-DATASERVICE-024, CMD-DATASERVICE-025, CMD-DATASERVICE-026, CMD-DATASERVICE-027, CMD-DATASERVICE-028, CMD-DATASERVICE-029, CMD-DATASERVICE-030, CMD-DATASERVICE-031, CMD-DATASERVICE-032, CMD-DATASERVICE-033, CMD-DATASERVICE-034, CMD-DATASERVICE-035, CMD-DATASERVICE-036, CMD-DATASERVICE-037, CMD-DATASERVICE-038, CMD-DATASERVICE-039, CMD-DATASERVICE-040, CMD-DATASERVICE-041, CMD-DATASERVICE-042, CMD-DATASERVICE-087, CMD-DATASERVICE-090, CMD-DATASERVICE-053, CMD-DATASERVICE-056, CMD-DATASERVICE-059, CMD-DATASERVICE-062, CMD-DATASERVICE-065, CMD-DATASERVICE-068, CMD-DATASERVICE-071, CMD-DATASERVICE-074, CMD-DATASERVICE-077, CMD-DATASERVICE-080, CMD-DATASERVICE-086, CMD-DATASERVICE-092; EVD-DATASERVICE-013, EVD-DATASERVICE-015, EVD-DATASERVICE-016, EVD-DATASERVICE-036 | pass ack后pending清除 trigger继续处理新tick |
| AC-DATASERVICE-020-S02 | TASK-DATASERVICE-001, TASK-DATASERVICE-002, TASK-DATASERVICE-003, TASK-DATASERVICE-004, TASK-DATASERVICE-005, TASK-DATASERVICE-006, TASK-DATASERVICE-007, TASK-DATASERVICE-008, TASK-DATASERVICE-009, TASK-DATASERVICE-010, TASK-DATASERVICE-011, TASK-DATASERVICE-012, TASK-DATASERVICE-013, TASK-DATASERVICE-014, TASK-DATASERVICE-015, TASK-DATASERVICE-016 | CMD-DATASERVICE-081, CMD-DATASERVICE-082, CMD-DATASERVICE-083, CMD-DATASERVICE-003, CMD-DATASERVICE-004, CMD-DATASERVICE-005, CMD-DATASERVICE-006, CMD-DATASERVICE-007, CMD-DATASERVICE-008, CMD-DATASERVICE-009, CMD-DATASERVICE-010, CMD-DATASERVICE-011, CMD-DATASERVICE-012, CMD-DATASERVICE-013, CMD-DATASERVICE-014, CMD-DATASERVICE-015, CMD-DATASERVICE-016, CMD-DATASERVICE-017, CMD-DATASERVICE-018, CMD-DATASERVICE-019, CMD-DATASERVICE-020, CMD-DATASERVICE-021, CMD-DATASERVICE-022, CMD-DATASERVICE-023, CMD-DATASERVICE-024, CMD-DATASERVICE-025, CMD-DATASERVICE-026, CMD-DATASERVICE-027, CMD-DATASERVICE-028, CMD-DATASERVICE-029, CMD-DATASERVICE-030, CMD-DATASERVICE-031, CMD-DATASERVICE-032, CMD-DATASERVICE-033, CMD-DATASERVICE-034, CMD-DATASERVICE-035, CMD-DATASERVICE-036, CMD-DATASERVICE-037, CMD-DATASERVICE-038, CMD-DATASERVICE-039, CMD-DATASERVICE-040, CMD-DATASERVICE-041, CMD-DATASERVICE-042, CMD-DATASERVICE-087, CMD-DATASERVICE-090, CMD-DATASERVICE-053, CMD-DATASERVICE-056, CMD-DATASERVICE-059, CMD-DATASERVICE-062, CMD-DATASERVICE-065, CMD-DATASERVICE-068, CMD-DATASERVICE-071, CMD-DATASERVICE-074, CMD-DATASERVICE-077, CMD-DATASERVICE-080, CMD-DATASERVICE-086, CMD-DATASERVICE-092; EVD-DATASERVICE-013, EVD-DATASERVICE-015, EVD-DATASERVICE-016, EVD-DATASERVICE-046 | pass 保护不会在三次后永久停止 ack恢复后状态回到ready |
| AC-DATASERVICE-020-S03 | TASK-DATASERVICE-001, TASK-DATASERVICE-002, TASK-DATASERVICE-003, TASK-DATASERVICE-004, TASK-DATASERVICE-005, TASK-DATASERVICE-006, TASK-DATASERVICE-007, TASK-DATASERVICE-008, TASK-DATASERVICE-009, TASK-DATASERVICE-010, TASK-DATASERVICE-011, TASK-DATASERVICE-012, TASK-DATASERVICE-013, TASK-DATASERVICE-014, TASK-DATASERVICE-015, TASK-DATASERVICE-016 | CMD-DATASERVICE-078, CMD-DATASERVICE-079, CMD-DATASERVICE-080, CMD-DATASERVICE-081, CMD-DATASERVICE-082, CMD-DATASERVICE-083, CMD-DATASERVICE-003, CMD-DATASERVICE-004, CMD-DATASERVICE-005, CMD-DATASERVICE-006, CMD-DATASERVICE-007, CMD-DATASERVICE-008, CMD-DATASERVICE-009, CMD-DATASERVICE-010, CMD-DATASERVICE-011, CMD-DATASERVICE-012, CMD-DATASERVICE-013, CMD-DATASERVICE-014, CMD-DATASERVICE-015, CMD-DATASERVICE-016, CMD-DATASERVICE-017, CMD-DATASERVICE-018, CMD-DATASERVICE-019, CMD-DATASERVICE-020, CMD-DATASERVICE-021, CMD-DATASERVICE-022, CMD-DATASERVICE-023, CMD-DATASERVICE-024, CMD-DATASERVICE-025, CMD-DATASERVICE-026, CMD-DATASERVICE-027, CMD-DATASERVICE-028, CMD-DATASERVICE-029, CMD-DATASERVICE-030, CMD-DATASERVICE-031, CMD-DATASERVICE-032, CMD-DATASERVICE-033, CMD-DATASERVICE-034, CMD-DATASERVICE-035, CMD-DATASERVICE-036, CMD-DATASERVICE-037, CMD-DATASERVICE-038, CMD-DATASERVICE-039, CMD-DATASERVICE-040, CMD-DATASERVICE-041, CMD-DATASERVICE-042, CMD-DATASERVICE-087, CMD-DATASERVICE-090, CMD-DATASERVICE-053, CMD-DATASERVICE-056, CMD-DATASERVICE-059, CMD-DATASERVICE-062, CMD-DATASERVICE-065, CMD-DATASERVICE-068, CMD-DATASERVICE-071, CMD-DATASERVICE-074, CMD-DATASERVICE-077, CMD-DATASERVICE-086, CMD-DATASERVICE-092; EVD-DATASERVICE-012, EVD-DATASERVICE-013, EVD-DATASERVICE-015, EVD-DATASERVICE-016, EVD-DATASERVICE-047 | pass 恢复后继续逐tick保护且没有补造历史tick |
| AC-DATASERVICE-020-S04 | TASK-DATASERVICE-001, TASK-DATASERVICE-002, TASK-DATASERVICE-003, TASK-DATASERVICE-004, TASK-DATASERVICE-005, TASK-DATASERVICE-006, TASK-DATASERVICE-007, TASK-DATASERVICE-008, TASK-DATASERVICE-009, TASK-DATASERVICE-010, TASK-DATASERVICE-011, TASK-DATASERVICE-012, TASK-DATASERVICE-013, TASK-DATASERVICE-014, TASK-DATASERVICE-015, TASK-DATASERVICE-016 | CMD-DATASERVICE-051, CMD-DATASERVICE-052, CMD-DATASERVICE-053, CMD-DATASERVICE-078, CMD-DATASERVICE-079, CMD-DATASERVICE-080, CMD-DATASERVICE-081, CMD-DATASERVICE-082, CMD-DATASERVICE-083, CMD-DATASERVICE-003, CMD-DATASERVICE-004, CMD-DATASERVICE-005, CMD-DATASERVICE-006, CMD-DATASERVICE-007, CMD-DATASERVICE-008, CMD-DATASERVICE-009, CMD-DATASERVICE-010, CMD-DATASERVICE-011, CMD-DATASERVICE-012, CMD-DATASERVICE-013, CMD-DATASERVICE-014, CMD-DATASERVICE-015, CMD-DATASERVICE-016, CMD-DATASERVICE-017, CMD-DATASERVICE-018, CMD-DATASERVICE-019, CMD-DATASERVICE-020, CMD-DATASERVICE-021, CMD-DATASERVICE-022, CMD-DATASERVICE-023, CMD-DATASERVICE-024, CMD-DATASERVICE-025, CMD-DATASERVICE-026, CMD-DATASERVICE-027, CMD-DATASERVICE-028, CMD-DATASERVICE-029, CMD-DATASERVICE-030, CMD-DATASERVICE-031, CMD-DATASERVICE-032, CMD-DATASERVICE-033, CMD-DATASERVICE-034, CMD-DATASERVICE-035, CMD-DATASERVICE-036, CMD-DATASERVICE-037, CMD-DATASERVICE-038, CMD-DATASERVICE-039, CMD-DATASERVICE-040, CMD-DATASERVICE-041, CMD-DATASERVICE-042, CMD-DATASERVICE-087, CMD-DATASERVICE-090, CMD-DATASERVICE-056, CMD-DATASERVICE-059, CMD-DATASERVICE-062, CMD-DATASERVICE-065, CMD-DATASERVICE-068, CMD-DATASERVICE-071, CMD-DATASERVICE-074, CMD-DATASERVICE-077, CMD-DATASERVICE-086, CMD-DATASERVICE-092; EVD-DATASERVICE-003, EVD-DATASERVICE-012, EVD-DATASERVICE-013, EVD-DATASERVICE-015, EVD-DATASERVICE-016, EVD-DATASERVICE-048 | pass 只产生符合当前actual和仓位约束的零或一个订单intent |
| AC-DATASERVICE-021-S01 | TASK-DATASERVICE-001, TASK-DATASERVICE-002, TASK-DATASERVICE-003, TASK-DATASERVICE-004, TASK-DATASERVICE-005, TASK-DATASERVICE-006, TASK-DATASERVICE-007, TASK-DATASERVICE-008, TASK-DATASERVICE-009, TASK-DATASERVICE-010, TASK-DATASERVICE-011, TASK-DATASERVICE-012, TASK-DATASERVICE-013, TASK-DATASERVICE-014, TASK-DATASERVICE-015, TASK-DATASERVICE-016 | CMD-DATASERVICE-051, CMD-DATASERVICE-052, CMD-DATASERVICE-053, CMD-DATASERVICE-057, CMD-DATASERVICE-058, CMD-DATASERVICE-059, CMD-DATASERVICE-075, CMD-DATASERVICE-076, CMD-DATASERVICE-077, CMD-DATASERVICE-003, CMD-DATASERVICE-004, CMD-DATASERVICE-005, CMD-DATASERVICE-006, CMD-DATASERVICE-007, CMD-DATASERVICE-008, CMD-DATASERVICE-009, CMD-DATASERVICE-010, CMD-DATASERVICE-011, CMD-DATASERVICE-012, CMD-DATASERVICE-013, CMD-DATASERVICE-014, CMD-DATASERVICE-015, CMD-DATASERVICE-016, CMD-DATASERVICE-017, CMD-DATASERVICE-018, CMD-DATASERVICE-019, CMD-DATASERVICE-020, CMD-DATASERVICE-021, CMD-DATASERVICE-022, CMD-DATASERVICE-023, CMD-DATASERVICE-024, CMD-DATASERVICE-025, CMD-DATASERVICE-026, CMD-DATASERVICE-027, CMD-DATASERVICE-028, CMD-DATASERVICE-029, CMD-DATASERVICE-030, CMD-DATASERVICE-031, CMD-DATASERVICE-032, CMD-DATASERVICE-033, CMD-DATASERVICE-034, CMD-DATASERVICE-035, CMD-DATASERVICE-036, CMD-DATASERVICE-037, CMD-DATASERVICE-038, CMD-DATASERVICE-039, CMD-DATASERVICE-040, CMD-DATASERVICE-041, CMD-DATASERVICE-042, CMD-DATASERVICE-087, CMD-DATASERVICE-090, CMD-DATASERVICE-056, CMD-DATASERVICE-062, CMD-DATASERVICE-065, CMD-DATASERVICE-068, CMD-DATASERVICE-071, CMD-DATASERVICE-074, CMD-DATASERVICE-080, CMD-DATASERVICE-083, CMD-DATASERVICE-086, CMD-DATASERVICE-092; EVD-DATASERVICE-003, EVD-DATASERVICE-005, EVD-DATASERVICE-011, EVD-DATASERVICE-015, EVD-DATASERVICE-016, EVD-DATASERVICE-037 | pass active设置只来自用户选择或主进程默认发送 最终只有新stream可写并收到一次 active_ack new_stream_key |
| AC-DATASERVICE-021-S02 | TASK-DATASERVICE-001, TASK-DATASERVICE-002, TASK-DATASERVICE-003, TASK-DATASERVICE-004, TASK-DATASERVICE-005, TASK-DATASERVICE-006, TASK-DATASERVICE-007, TASK-DATASERVICE-008, TASK-DATASERVICE-009, TASK-DATASERVICE-010, TASK-DATASERVICE-011, TASK-DATASERVICE-012, TASK-DATASERVICE-013, TASK-DATASERVICE-014, TASK-DATASERVICE-015, TASK-DATASERVICE-016 | CMD-DATASERVICE-051, CMD-DATASERVICE-052, CMD-DATASERVICE-053, CMD-DATASERVICE-057, CMD-DATASERVICE-058, CMD-DATASERVICE-059, CMD-DATASERVICE-003, CMD-DATASERVICE-004, CMD-DATASERVICE-005, CMD-DATASERVICE-006, CMD-DATASERVICE-007, CMD-DATASERVICE-008, CMD-DATASERVICE-009, CMD-DATASERVICE-010, CMD-DATASERVICE-011, CMD-DATASERVICE-012, CMD-DATASERVICE-013, CMD-DATASERVICE-014, CMD-DATASERVICE-015, CMD-DATASERVICE-016, CMD-DATASERVICE-017, CMD-DATASERVICE-018, CMD-DATASERVICE-019, CMD-DATASERVICE-020, CMD-DATASERVICE-021, CMD-DATASERVICE-022, CMD-DATASERVICE-023, CMD-DATASERVICE-024, CMD-DATASERVICE-025, CMD-DATASERVICE-026, CMD-DATASERVICE-027, CMD-DATASERVICE-028, CMD-DATASERVICE-029, CMD-DATASERVICE-030, CMD-DATASERVICE-031, CMD-DATASERVICE-032, CMD-DATASERVICE-033, CMD-DATASERVICE-034, CMD-DATASERVICE-035, CMD-DATASERVICE-036, CMD-DATASERVICE-037, CMD-DATASERVICE-038, CMD-DATASERVICE-039, CMD-DATASERVICE-040, CMD-DATASERVICE-041, CMD-DATASERVICE-042, CMD-DATASERVICE-087, CMD-DATASERVICE-090, CMD-DATASERVICE-056, CMD-DATASERVICE-062, CMD-DATASERVICE-065, CMD-DATASERVICE-068, CMD-DATASERVICE-071, CMD-DATASERVICE-074, CMD-DATASERVICE-077, CMD-DATASERVICE-080, CMD-DATASERVICE-083, CMD-DATASERVICE-086, CMD-DATASERVICE-092; EVD-DATASERVICE-003, EVD-DATASERVICE-005, EVD-DATASERVICE-015, EVD-DATASERVICE-016, EVD-DATASERVICE-049 | pass 失败切换不造成行情空窗或双active |
| AC-DATASERVICE-021-S03 | TASK-DATASERVICE-001, TASK-DATASERVICE-002, TASK-DATASERVICE-003, TASK-DATASERVICE-004, TASK-DATASERVICE-005, TASK-DATASERVICE-006, TASK-DATASERVICE-007, TASK-DATASERVICE-008, TASK-DATASERVICE-009, TASK-DATASERVICE-010, TASK-DATASERVICE-011, TASK-DATASERVICE-012, TASK-DATASERVICE-013, TASK-DATASERVICE-014, TASK-DATASERVICE-015, TASK-DATASERVICE-016 | CMD-DATASERVICE-051, CMD-DATASERVICE-052, CMD-DATASERVICE-053, CMD-DATASERVICE-075, CMD-DATASERVICE-076, CMD-DATASERVICE-077, CMD-DATASERVICE-084, CMD-DATASERVICE-085, CMD-DATASERVICE-086, CMD-DATASERVICE-003, CMD-DATASERVICE-004, CMD-DATASERVICE-005, CMD-DATASERVICE-006, CMD-DATASERVICE-007, CMD-DATASERVICE-008, CMD-DATASERVICE-009, CMD-DATASERVICE-010, CMD-DATASERVICE-011, CMD-DATASERVICE-012, CMD-DATASERVICE-013, CMD-DATASERVICE-014, CMD-DATASERVICE-015, CMD-DATASERVICE-016, CMD-DATASERVICE-017, CMD-DATASERVICE-018, CMD-DATASERVICE-019, CMD-DATASERVICE-020, CMD-DATASERVICE-021, CMD-DATASERVICE-022, CMD-DATASERVICE-023, CMD-DATASERVICE-024, CMD-DATASERVICE-025, CMD-DATASERVICE-026, CMD-DATASERVICE-027, CMD-DATASERVICE-028, CMD-DATASERVICE-029, CMD-DATASERVICE-030, CMD-DATASERVICE-031, CMD-DATASERVICE-032, CMD-DATASERVICE-033, CMD-DATASERVICE-034, CMD-DATASERVICE-035, CMD-DATASERVICE-036, CMD-DATASERVICE-037, CMD-DATASERVICE-038, CMD-DATASERVICE-039, CMD-DATASERVICE-040, CMD-DATASERVICE-041, CMD-DATASERVICE-042, CMD-DATASERVICE-087, CMD-DATASERVICE-090, CMD-DATASERVICE-056, CMD-DATASERVICE-059, CMD-DATASERVICE-062, CMD-DATASERVICE-065, CMD-DATASERVICE-068, CMD-DATASERVICE-071, CMD-DATASERVICE-074, CMD-DATASERVICE-080, CMD-DATASERVICE-083, CMD-DATASERVICE-092; EVD-DATASERVICE-003, EVD-DATASERVICE-011, EVD-DATASERVICE-014, EVD-DATASERVICE-015, EVD-DATASERVICE-016, EVD-DATASERVICE-050 | pass logical symbol相同不会复用旧生命周期 |
| AC-DATASERVICE-022-S01 | TASK-DATASERVICE-001, TASK-DATASERVICE-002, TASK-DATASERVICE-003, TASK-DATASERVICE-004, TASK-DATASERVICE-005, TASK-DATASERVICE-006, TASK-DATASERVICE-007, TASK-DATASERVICE-008, TASK-DATASERVICE-009, TASK-DATASERVICE-010, TASK-DATASERVICE-011, TASK-DATASERVICE-012, TASK-DATASERVICE-013, TASK-DATASERVICE-014, TASK-DATASERVICE-015, TASK-DATASERVICE-016 | CMD-DATASERVICE-045, CMD-DATASERVICE-046, CMD-DATASERVICE-047, CMD-DATASERVICE-051, CMD-DATASERVICE-052, CMD-DATASERVICE-053, CMD-DATASERVICE-054, CMD-DATASERVICE-055, CMD-DATASERVICE-056, CMD-DATASERVICE-078, CMD-DATASERVICE-079, CMD-DATASERVICE-080, CMD-DATASERVICE-003, CMD-DATASERVICE-004, CMD-DATASERVICE-005, CMD-DATASERVICE-006, CMD-DATASERVICE-007, CMD-DATASERVICE-008, CMD-DATASERVICE-009, CMD-DATASERVICE-010, CMD-DATASERVICE-011, CMD-DATASERVICE-012, CMD-DATASERVICE-013, CMD-DATASERVICE-014, CMD-DATASERVICE-015, CMD-DATASERVICE-016, CMD-DATASERVICE-017, CMD-DATASERVICE-018, CMD-DATASERVICE-019, CMD-DATASERVICE-020, CMD-DATASERVICE-021, CMD-DATASERVICE-022, CMD-DATASERVICE-023, CMD-DATASERVICE-024, CMD-DATASERVICE-025, CMD-DATASERVICE-026, CMD-DATASERVICE-027, CMD-DATASERVICE-028, CMD-DATASERVICE-029, CMD-DATASERVICE-030, CMD-DATASERVICE-031, CMD-DATASERVICE-032, CMD-DATASERVICE-033, CMD-DATASERVICE-034, CMD-DATASERVICE-035, CMD-DATASERVICE-036, CMD-DATASERVICE-037, CMD-DATASERVICE-038, CMD-DATASERVICE-039, CMD-DATASERVICE-040, CMD-DATASERVICE-041, CMD-DATASERVICE-042, CMD-DATASERVICE-087, CMD-DATASERVICE-090, CMD-DATASERVICE-059, CMD-DATASERVICE-062, CMD-DATASERVICE-065, CMD-DATASERVICE-068, CMD-DATASERVICE-071, CMD-DATASERVICE-074, CMD-DATASERVICE-077, CMD-DATASERVICE-083, CMD-DATASERVICE-086, CMD-DATASERVICE-092; EVD-DATASERVICE-001, EVD-DATASERVICE-003, EVD-DATASERVICE-004, EVD-DATASERVICE-012, EVD-DATASERVICE-015, EVD-DATASERVICE-016, EVD-DATASERVICE-038 | pass futu execution使用mhi2610 db/gds/recorder/指标仍用mhimain |
| AC-DATASERVICE-022-S02 | TASK-DATASERVICE-001, TASK-DATASERVICE-002, TASK-DATASERVICE-003, TASK-DATASERVICE-004, TASK-DATASERVICE-005, TASK-DATASERVICE-006, TASK-DATASERVICE-007, TASK-DATASERVICE-008, TASK-DATASERVICE-009, TASK-DATASERVICE-010, TASK-DATASERVICE-011, TASK-DATASERVICE-012, TASK-DATASERVICE-013, TASK-DATASERVICE-014, TASK-DATASERVICE-015, TASK-DATASERVICE-016 | CMD-DATASERVICE-045, CMD-DATASERVICE-046, CMD-DATASERVICE-047, CMD-DATASERVICE-051, CMD-DATASERVICE-052, CMD-DATASERVICE-053, CMD-DATASERVICE-054, CMD-DATASERVICE-055, CMD-DATASERVICE-056, CMD-DATASERVICE-003, CMD-DATASERVICE-004, CMD-DATASERVICE-005, CMD-DATASERVICE-006, CMD-DATASERVICE-007, CMD-DATASERVICE-008, CMD-DATASERVICE-009, CMD-DATASERVICE-010, CMD-DATASERVICE-011, CMD-DATASERVICE-012, CMD-DATASERVICE-013, CMD-DATASERVICE-014, CMD-DATASERVICE-015, CMD-DATASERVICE-016, CMD-DATASERVICE-017, CMD-DATASERVICE-018, CMD-DATASERVICE-019, CMD-DATASERVICE-020, CMD-DATASERVICE-021, CMD-DATASERVICE-022, CMD-DATASERVICE-023, CMD-DATASERVICE-024, CMD-DATASERVICE-025, CMD-DATASERVICE-026, CMD-DATASERVICE-027, CMD-DATASERVICE-028, CMD-DATASERVICE-029, CMD-DATASERVICE-030, CMD-DATASERVICE-031, CMD-DATASERVICE-032, CMD-DATASERVICE-033, CMD-DATASERVICE-034, CMD-DATASERVICE-035, CMD-DATASERVICE-036, CMD-DATASERVICE-037, CMD-DATASERVICE-038, CMD-DATASERVICE-039, CMD-DATASERVICE-040, CMD-DATASERVICE-041, CMD-DATASERVICE-042, CMD-DATASERVICE-087, CMD-DATASERVICE-090, CMD-DATASERVICE-059, CMD-DATASERVICE-062, CMD-DATASERVICE-065, CMD-DATASERVICE-068, CMD-DATASERVICE-071, CMD-DATASERVICE-074, CMD-DATASERVICE-077, CMD-DATASERVICE-080, CMD-DATASERVICE-083, CMD-DATASERVICE-086, CMD-DATASERVICE-092; EVD-DATASERVICE-001, EVD-DATASERVICE-003, EVD-DATASERVICE-004, EVD-DATASERVICE-015, EVD-DATASERVICE-016, EVD-DATASERVICE-051 | pass canonical current没有并发写或actual混合 |
| AC-DATASERVICE-023-S01 | TASK-DATASERVICE-001, TASK-DATASERVICE-002, TASK-DATASERVICE-003, TASK-DATASERVICE-004, TASK-DATASERVICE-005, TASK-DATASERVICE-006, TASK-DATASERVICE-007, TASK-DATASERVICE-008, TASK-DATASERVICE-009, TASK-DATASERVICE-010, TASK-DATASERVICE-011, TASK-DATASERVICE-012, TASK-DATASERVICE-013, TASK-DATASERVICE-014, TASK-DATASERVICE-015, TASK-DATASERVICE-016 | CMD-DATASERVICE-057, CMD-DATASERVICE-058, CMD-DATASERVICE-059, CMD-DATASERVICE-063, CMD-DATASERVICE-064, CMD-DATASERVICE-065, CMD-DATASERVICE-066, CMD-DATASERVICE-067, CMD-DATASERVICE-068, CMD-DATASERVICE-084, CMD-DATASERVICE-085, CMD-DATASERVICE-086, CMD-DATASERVICE-003, CMD-DATASERVICE-004, CMD-DATASERVICE-005, CMD-DATASERVICE-006, CMD-DATASERVICE-007, CMD-DATASERVICE-008, CMD-DATASERVICE-009, CMD-DATASERVICE-010, CMD-DATASERVICE-011, CMD-DATASERVICE-012, CMD-DATASERVICE-013, CMD-DATASERVICE-014, CMD-DATASERVICE-015, CMD-DATASERVICE-016, CMD-DATASERVICE-017, CMD-DATASERVICE-018, CMD-DATASERVICE-019, CMD-DATASERVICE-020, CMD-DATASERVICE-021, CMD-DATASERVICE-022, CMD-DATASERVICE-023, CMD-DATASERVICE-024, CMD-DATASERVICE-025, CMD-DATASERVICE-026, CMD-DATASERVICE-027, CMD-DATASERVICE-028, CMD-DATASERVICE-029, CMD-DATASERVICE-030, CMD-DATASERVICE-031, CMD-DATASERVICE-032, CMD-DATASERVICE-033, CMD-DATASERVICE-034, CMD-DATASERVICE-035, CMD-DATASERVICE-036, CMD-DATASERVICE-037, CMD-DATASERVICE-038, CMD-DATASERVICE-039, CMD-DATASERVICE-040, CMD-DATASERVICE-041, CMD-DATASERVICE-042, CMD-DATASERVICE-087, CMD-DATASERVICE-090, CMD-DATASERVICE-053, CMD-DATASERVICE-056, CMD-DATASERVICE-062, CMD-DATASERVICE-071, CMD-DATASERVICE-074, CMD-DATASERVICE-077, CMD-DATASERVICE-080, CMD-DATASERVICE-083, CMD-DATASERVICE-092; EVD-DATASERVICE-005, EVD-DATASERVICE-007, EVD-DATASERVICE-008, EVD-DATASERVICE-014, EVD-DATASERVICE-015, EVD-DATASERVICE-016, EVD-DATASERVICE-039 | pass 相同精确in-flight request只执行一次 所有caller收到一个终态 |
| AC-DATASERVICE-023-S02 | TASK-DATASERVICE-001, TASK-DATASERVICE-002, TASK-DATASERVICE-003, TASK-DATASERVICE-004, TASK-DATASERVICE-005, TASK-DATASERVICE-006, TASK-DATASERVICE-007, TASK-DATASERVICE-008, TASK-DATASERVICE-009, TASK-DATASERVICE-010, TASK-DATASERVICE-011, TASK-DATASERVICE-012, TASK-DATASERVICE-013, TASK-DATASERVICE-014, TASK-DATASERVICE-015, TASK-DATASERVICE-016 | CMD-DATASERVICE-057, CMD-DATASERVICE-058, CMD-DATASERVICE-059, CMD-DATASERVICE-063, CMD-DATASERVICE-064, CMD-DATASERVICE-065, CMD-DATASERVICE-084, CMD-DATASERVICE-085, CMD-DATASERVICE-086, CMD-DATASERVICE-003, CMD-DATASERVICE-004, CMD-DATASERVICE-005, CMD-DATASERVICE-006, CMD-DATASERVICE-007, CMD-DATASERVICE-008, CMD-DATASERVICE-009, CMD-DATASERVICE-010, CMD-DATASERVICE-011, CMD-DATASERVICE-012, CMD-DATASERVICE-013, CMD-DATASERVICE-014, CMD-DATASERVICE-015, CMD-DATASERVICE-016, CMD-DATASERVICE-017, CMD-DATASERVICE-018, CMD-DATASERVICE-019, CMD-DATASERVICE-020, CMD-DATASERVICE-021, CMD-DATASERVICE-022, CMD-DATASERVICE-023, CMD-DATASERVICE-024, CMD-DATASERVICE-025, CMD-DATASERVICE-026, CMD-DATASERVICE-027, CMD-DATASERVICE-028, CMD-DATASERVICE-029, CMD-DATASERVICE-030, CMD-DATASERVICE-031, CMD-DATASERVICE-032, CMD-DATASERVICE-033, CMD-DATASERVICE-034, CMD-DATASERVICE-035, CMD-DATASERVICE-036, CMD-DATASERVICE-037, CMD-DATASERVICE-038, CMD-DATASERVICE-039, CMD-DATASERVICE-040, CMD-DATASERVICE-041, CMD-DATASERVICE-042, CMD-DATASERVICE-087, CMD-DATASERVICE-090, CMD-DATASERVICE-053, CMD-DATASERVICE-056, CMD-DATASERVICE-062, CMD-DATASERVICE-068, CMD-DATASERVICE-071, CMD-DATASERVICE-074, CMD-DATASERVICE-077, CMD-DATASERVICE-080, CMD-DATASERVICE-083, CMD-DATASERVICE-092; EVD-DATASERVICE-005, EVD-DATASERVICE-007, EVD-DATASERVICE-014, EVD-DATASERVICE-015, EVD-DATASERVICE-016, EVD-DATASERVICE-052 | pass fetch range集合精确等于首次范围加差集 |
| AC-DATASERVICE-023-S03 | TASK-DATASERVICE-001, TASK-DATASERVICE-002, TASK-DATASERVICE-003, TASK-DATASERVICE-004, TASK-DATASERVICE-005, TASK-DATASERVICE-006, TASK-DATASERVICE-007, TASK-DATASERVICE-008, TASK-DATASERVICE-009, TASK-DATASERVICE-010, TASK-DATASERVICE-011, TASK-DATASERVICE-012, TASK-DATASERVICE-013, TASK-DATASERVICE-014, TASK-DATASERVICE-015, TASK-DATASERVICE-016 | CMD-DATASERVICE-057, CMD-DATASERVICE-058, CMD-DATASERVICE-059, CMD-DATASERVICE-063, CMD-DATASERVICE-064, CMD-DATASERVICE-065, CMD-DATASERVICE-084, CMD-DATASERVICE-085, CMD-DATASERVICE-086, CMD-DATASERVICE-003, CMD-DATASERVICE-004, CMD-DATASERVICE-005, CMD-DATASERVICE-006, CMD-DATASERVICE-007, CMD-DATASERVICE-008, CMD-DATASERVICE-009, CMD-DATASERVICE-010, CMD-DATASERVICE-011, CMD-DATASERVICE-012, CMD-DATASERVICE-013, CMD-DATASERVICE-014, CMD-DATASERVICE-015, CMD-DATASERVICE-016, CMD-DATASERVICE-017, CMD-DATASERVICE-018, CMD-DATASERVICE-019, CMD-DATASERVICE-020, CMD-DATASERVICE-021, CMD-DATASERVICE-022, CMD-DATASERVICE-023, CMD-DATASERVICE-024, CMD-DATASERVICE-025, CMD-DATASERVICE-026, CMD-DATASERVICE-027, CMD-DATASERVICE-028, CMD-DATASERVICE-029, CMD-DATASERVICE-030, CMD-DATASERVICE-031, CMD-DATASERVICE-032, CMD-DATASERVICE-033, CMD-DATASERVICE-034, CMD-DATASERVICE-035, CMD-DATASERVICE-036, CMD-DATASERVICE-037, CMD-DATASERVICE-038, CMD-DATASERVICE-039, CMD-DATASERVICE-040, CMD-DATASERVICE-041, CMD-DATASERVICE-042, CMD-DATASERVICE-087, CMD-DATASERVICE-090, CMD-DATASERVICE-053, CMD-DATASERVICE-056, CMD-DATASERVICE-062, CMD-DATASERVICE-068, CMD-DATASERVICE-071, CMD-DATASERVICE-074, CMD-DATASERVICE-077, CMD-DATASERVICE-080, CMD-DATASERVICE-083, CMD-DATASERVICE-092; EVD-DATASERVICE-005, EVD-DATASERVICE-007, EVD-DATASERVICE-014, EVD-DATASERVICE-015, EVD-DATASERVICE-016, EVD-DATASERVICE-053 | pass 迟到数据不成为新权威且资源计数回到0 |
| AC-DATASERVICE-024-S01 | TASK-DATASERVICE-001, TASK-DATASERVICE-002, TASK-DATASERVICE-003, TASK-DATASERVICE-004, TASK-DATASERVICE-005, TASK-DATASERVICE-006, TASK-DATASERVICE-007, TASK-DATASERVICE-008, TASK-DATASERVICE-009, TASK-DATASERVICE-010, TASK-DATASERVICE-011, TASK-DATASERVICE-012, TASK-DATASERVICE-013, TASK-DATASERVICE-014, TASK-DATASERVICE-015, TASK-DATASERVICE-016 | CMD-DATASERVICE-063, CMD-DATASERVICE-064, CMD-DATASERVICE-065, CMD-DATASERVICE-069, CMD-DATASERVICE-070, CMD-DATASERVICE-071, CMD-DATASERVICE-084, CMD-DATASERVICE-085, CMD-DATASERVICE-086, CMD-DATASERVICE-003, CMD-DATASERVICE-004, CMD-DATASERVICE-005, CMD-DATASERVICE-006, CMD-DATASERVICE-007, CMD-DATASERVICE-008, CMD-DATASERVICE-009, CMD-DATASERVICE-010, CMD-DATASERVICE-011, CMD-DATASERVICE-012, CMD-DATASERVICE-013, CMD-DATASERVICE-014, CMD-DATASERVICE-015, CMD-DATASERVICE-016, CMD-DATASERVICE-017, CMD-DATASERVICE-018, CMD-DATASERVICE-019, CMD-DATASERVICE-020, CMD-DATASERVICE-021, CMD-DATASERVICE-022, CMD-DATASERVICE-023, CMD-DATASERVICE-024, CMD-DATASERVICE-025, CMD-DATASERVICE-026, CMD-DATASERVICE-027, CMD-DATASERVICE-028, CMD-DATASERVICE-029, CMD-DATASERVICE-030, CMD-DATASERVICE-031, CMD-DATASERVICE-032, CMD-DATASERVICE-033, CMD-DATASERVICE-034, CMD-DATASERVICE-035, CMD-DATASERVICE-036, CMD-DATASERVICE-037, CMD-DATASERVICE-038, CMD-DATASERVICE-039, CMD-DATASERVICE-040, CMD-DATASERVICE-041, CMD-DATASERVICE-042, CMD-DATASERVICE-087, CMD-DATASERVICE-090, CMD-DATASERVICE-053, CMD-DATASERVICE-056, CMD-DATASERVICE-059, CMD-DATASERVICE-062, CMD-DATASERVICE-068, CMD-DATASERVICE-074, CMD-DATASERVICE-077, CMD-DATASERVICE-080, CMD-DATASERVICE-083, CMD-DATASERVICE-092; EVD-DATASERVICE-007, EVD-DATASERVICE-009, EVD-DATASERVICE-014, EVD-DATASERVICE-015, EVD-DATASERVICE-016, EVD-DATASERVICE-040 | pass 图表恢复后历史和current连续 dataservice/worker/recorder/cta/trigger pid均未因最小化变化 |
| AC-DATASERVICE-024-S02 | TASK-DATASERVICE-001, TASK-DATASERVICE-002, TASK-DATASERVICE-003, TASK-DATASERVICE-004, TASK-DATASERVICE-005, TASK-DATASERVICE-006, TASK-DATASERVICE-007, TASK-DATASERVICE-008, TASK-DATASERVICE-009, TASK-DATASERVICE-010, TASK-DATASERVICE-011, TASK-DATASERVICE-012, TASK-DATASERVICE-013, TASK-DATASERVICE-014, TASK-DATASERVICE-015, TASK-DATASERVICE-016 | CMD-DATASERVICE-057, CMD-DATASERVICE-058, CMD-DATASERVICE-059, CMD-DATASERVICE-063, CMD-DATASERVICE-064, CMD-DATASERVICE-065, CMD-DATASERVICE-069, CMD-DATASERVICE-070, CMD-DATASERVICE-071, CMD-DATASERVICE-075, CMD-DATASERVICE-076, CMD-DATASERVICE-077, CMD-DATASERVICE-084, CMD-DATASERVICE-085, CMD-DATASERVICE-086, CMD-DATASERVICE-003, CMD-DATASERVICE-004, CMD-DATASERVICE-005, CMD-DATASERVICE-006, CMD-DATASERVICE-007, CMD-DATASERVICE-008, CMD-DATASERVICE-009, CMD-DATASERVICE-010, CMD-DATASERVICE-011, CMD-DATASERVICE-012, CMD-DATASERVICE-013, CMD-DATASERVICE-014, CMD-DATASERVICE-015, CMD-DATASERVICE-016, CMD-DATASERVICE-017, CMD-DATASERVICE-018, CMD-DATASERVICE-019, CMD-DATASERVICE-020, CMD-DATASERVICE-021, CMD-DATASERVICE-022, CMD-DATASERVICE-023, CMD-DATASERVICE-024, CMD-DATASERVICE-025, CMD-DATASERVICE-026, CMD-DATASERVICE-027, CMD-DATASERVICE-028, CMD-DATASERVICE-029, CMD-DATASERVICE-030, CMD-DATASERVICE-031, CMD-DATASERVICE-032, CMD-DATASERVICE-033, CMD-DATASERVICE-034, CMD-DATASERVICE-035, CMD-DATASERVICE-036, CMD-DATASERVICE-037, CMD-DATASERVICE-038, CMD-DATASERVICE-039, CMD-DATASERVICE-040, CMD-DATASERVICE-041, CMD-DATASERVICE-042, CMD-DATASERVICE-087, CMD-DATASERVICE-090, CMD-DATASERVICE-053, CMD-DATASERVICE-056, CMD-DATASERVICE-062, CMD-DATASERVICE-068, CMD-DATASERVICE-074, CMD-DATASERVICE-080, CMD-DATASERVICE-083, CMD-DATASERVICE-092; EVD-DATASERVICE-005, EVD-DATASERVICE-007, EVD-DATASERVICE-009, EVD-DATASERVICE-011, EVD-DATASERVICE-014, EVD-DATASERVICE-015, EVD-DATASERVICE-016, EVD-DATASERVICE-054 | pass 高周期db完整且与1m聚合一致 旧ack不进入新stream |
| AC-DATASERVICE-024-S03 | TASK-DATASERVICE-001, TASK-DATASERVICE-002, TASK-DATASERVICE-003, TASK-DATASERVICE-004, TASK-DATASERVICE-005, TASK-DATASERVICE-006, TASK-DATASERVICE-007, TASK-DATASERVICE-008, TASK-DATASERVICE-009, TASK-DATASERVICE-010, TASK-DATASERVICE-011, TASK-DATASERVICE-012, TASK-DATASERVICE-013, TASK-DATASERVICE-014, TASK-DATASERVICE-015, TASK-DATASERVICE-016 | CMD-DATASERVICE-057, CMD-DATASERVICE-058, CMD-DATASERVICE-059, CMD-DATASERVICE-063, CMD-DATASERVICE-064, CMD-DATASERVICE-065, CMD-DATASERVICE-069, CMD-DATASERVICE-070, CMD-DATASERVICE-071, CMD-DATASERVICE-075, CMD-DATASERVICE-076, CMD-DATASERVICE-077, CMD-DATASERVICE-084, CMD-DATASERVICE-085, CMD-DATASERVICE-086, CMD-DATASERVICE-003, CMD-DATASERVICE-004, CMD-DATASERVICE-005, CMD-DATASERVICE-006, CMD-DATASERVICE-007, CMD-DATASERVICE-008, CMD-DATASERVICE-009, CMD-DATASERVICE-010, CMD-DATASERVICE-011, CMD-DATASERVICE-012, CMD-DATASERVICE-013, CMD-DATASERVICE-014, CMD-DATASERVICE-015, CMD-DATASERVICE-016, CMD-DATASERVICE-017, CMD-DATASERVICE-018, CMD-DATASERVICE-019, CMD-DATASERVICE-020, CMD-DATASERVICE-021, CMD-DATASERVICE-022, CMD-DATASERVICE-023, CMD-DATASERVICE-024, CMD-DATASERVICE-025, CMD-DATASERVICE-026, CMD-DATASERVICE-027, CMD-DATASERVICE-028, CMD-DATASERVICE-029, CMD-DATASERVICE-030, CMD-DATASERVICE-031, CMD-DATASERVICE-032, CMD-DATASERVICE-033, CMD-DATASERVICE-034, CMD-DATASERVICE-035, CMD-DATASERVICE-036, CMD-DATASERVICE-037, CMD-DATASERVICE-038, CMD-DATASERVICE-039, CMD-DATASERVICE-040, CMD-DATASERVICE-041, CMD-DATASERVICE-042, CMD-DATASERVICE-087, CMD-DATASERVICE-090, CMD-DATASERVICE-053, CMD-DATASERVICE-056, CMD-DATASERVICE-062, CMD-DATASERVICE-068, CMD-DATASERVICE-074, CMD-DATASERVICE-080, CMD-DATASERVICE-083, CMD-DATASERVICE-092; EVD-DATASERVICE-005, EVD-DATASERVICE-007, EVD-DATASERVICE-009, EVD-DATASERVICE-011, EVD-DATASERVICE-014, EVD-DATASERVICE-015, EVD-DATASERVICE-016, EVD-DATASERVICE-055 | pass db完整 checkpoint在恢复后连续 新到达batch正常ack |
<!-- /goal-slot:traceSliceTrackingMatrix -->

## Implementation Tasks

<!-- goal-slot:implementationTasks required dynamic=traceSlices -->
### TASK-DATASERVICE-001

> purpose 把本文件引用的旧指标 recorder tick 回调和主连行为变成可执行证据

- Source: `TASK-DATASERVICE-001`; role: `action`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:75d058f88cb995f64f37ed3e250c1eb27f868534076c3f458fd6afba18622d3d`.
- Provenance: `SPAN-40FE9628569B2CCA`; clauses: `B2098:C1, B2099:C1, B2100:C1, B2101:C1, B2102:C1, B2103:C1, B2103:C2, B2103:C3, B2104:C1, B2105:C1, B2106:C1, B2107:C1, B2108:C1, B2109:C1, B2109:C2, B2110:C1, B2110:C2, B2111:C1`.

**Execution Class:** `executable_child`
**Owned Production Paths:** none

- Acceptance refs: `AC-DATASERVICE-009-S01, AC-DATASERVICE-009-S02, AC-DATASERVICE-011-S01, AC-DATASERVICE-012-S01, AC-DATASERVICE-015-S01, AC-DATASERVICE-017-S01, AC-DATASERVICE-018-S01, AC-DATASERVICE-019-S01, AC-DATASERVICE-022-S01, AC-DATASERVICE-022-S02`.
- Command refs: `CMD-DATASERVICE-045, CMD-DATASERVICE-046, CMD-DATASERVICE-047`.
- Evidence refs: `EVD-DATASERVICE-001`.

### TASK-DATASERVICE-002

> purpose 验证precontract-001已冻结的真实1m/quote/order_book输入 建立production-ingress replay和现有测试有效性审计 不得生成或改写权威样本内容

- Source: `TASK-DATASERVICE-002`; role: `action`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:bebca7e9429e145ce65ca542cbc5065b19e4d85a4c7af011eece7dacea541148`.
- Provenance: `SPAN-9F63E4B9B023DB73`; clauses: `B2115:C1, B2115:C2, B2116:C1, B2117:C1, B2118:C1, B2119:C1, B2120:C1, B2121:C1, B2121:C2, B2121:C3, B2122:C1, B2123:C1, B2124:C1, B2125:C1, B2126:C1, B2127:C1, B2127:C2, B2128:C1, B2128:C2, B2129:C1`.

**Execution Class:** `executable_child`
**Owned Production Paths:** none

- Acceptance refs: `AC-DATASERVICE-016-S01`.
- Command refs: `CMD-DATASERVICE-048, CMD-DATASERVICE-049, CMD-DATASERVICE-050`.
- Evidence refs: `EVD-DATASERVICE-002`.

### TASK-DATASERVICE-003

> purpose 恢复单active 旧main mapping并删除实时k_1m

- Source: `TASK-DATASERVICE-003`; role: `action`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:da552a48eef98e559a94a97212e205fc1df7df94de150f99cec2cb87c43f1028`.
- Provenance: `SPAN-E94EC97492CFBCFC`; clauses: `B2133:C1, B2134:C1, B2135:C1, B2136:C1, B2137:C1, B2137:C2, B2137:C3, B2137:C4, B2138:C1, B2139:C1, B2140:C1, B2141:C1, B2142:C1, B2143:C1, B2143:C2, B2144:C1, B2144:C2, B2145:C1`.

**Execution Class:** `executable_child`
**Owned Production Paths:** vnpy/trader/dataservice/runtime.py, vnpy/trader/dataservice/quote_state.py, vnpy/trader/dataservice/futu_metadata.py, vnpy/trader/dataservice/subscription_registry.py, vnpy/trader/runtime_supervisor.py, vnpy/trader/runtime_protocol.py, vnpy_futu/vnpy_futu/futu_gateway.py, vnpy/trader/ui/widget.py, examples/veighna_trader/run.py

- Acceptance refs: `AC-DATASERVICE-009-S01, AC-DATASERVICE-009-S02, AC-DATASERVICE-019-S01, AC-DATASERVICE-020-S04, AC-DATASERVICE-021-S01, AC-DATASERVICE-021-S02, AC-DATASERVICE-021-S03, AC-DATASERVICE-022-S01, AC-DATASERVICE-022-S02`.
- Command refs: `CMD-DATASERVICE-051, CMD-DATASERVICE-052, CMD-DATASERVICE-053`.
- Evidence refs: `EVD-DATASERVICE-003`.

### TASK-DATASERVICE-004

> purpose dataservice直接聚合quote/order_book 保持限流 ohlcv和rollover

- Source: `TASK-DATASERVICE-004`; role: `action`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:fbd00e0ff89d9eb783b71776a55e866128882a2a3677a291a967012ca15cab4f`.
- Provenance: `SPAN-9B3F46E98428AFE4`; clauses: `B2149:C1, B2150:C1, B2151:C1, B2152:C1, B2153:C1, B2153:C2, B2153:C3, B2153:C4, B2153:C5, B2154:C1, B2155:C1, B2156:C1, B2157:C1, B2158:C1, B2159:C1, B2159:C2, B2160:C1, B2161:C1`.

**Execution Class:** `executable_child`
**Owned Production Paths:** vnpy/trader/dataservice/runtime.py, vnpy/trader/dataservice/quote_state.py, vnpy/trader/dataservice/canonical_bars.py, vnpy/trader/dataservice/throttle.py, vnpy/trader/period_utils.py, vnpy/trader/hkfe_bar_generator.py, vnpy/trader/hkfe_period_common.py, vnpy/datafeed/period_aggregation.py

- Acceptance refs: `AC-DATASERVICE-006-S01, AC-DATASERVICE-007-S01, AC-DATASERVICE-009-S01, AC-DATASERVICE-009-S02, AC-DATASERVICE-010-S01, AC-DATASERVICE-022-S01, AC-DATASERVICE-022-S02`.
- Command refs: `CMD-DATASERVICE-054, CMD-DATASERVICE-055, CMD-DATASERVICE-056`.
- Evidence refs: `EVD-DATASERVICE-004`.

### TASK-DATASERVICE-005

> purpose datamanager独占缺口裁决 写库和回读 dataservice只fetch

- Source: `TASK-DATASERVICE-005`; role: `action`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:14cce646b53d29913303571f2f6cbe8fad75dce9661e373f3acdf775581421f2`.
- Provenance: `SPAN-A95553D64306402D`; clauses: `B2165:C1, B2166:C1, B2167:C1, B2168:C1, B2169:C1, B2169:C2, B2169:C3, B2170:C1, B2171:C1, B2172:C1, B2173:C1, B2174:C1, B2175:C1, B2176:C1, B2177:C1`.

**Execution Class:** `executable_child`
**Owned Production Paths:** vnpy_datamanager/vnpy_datamanager/engine.py, vnpy_datamanager/vnpy_datamanager/runtime.py, vnpy/trader/dataservice/market_protocol.py, vnpy/trader/dataservice/query_protocol.py, vnpy/trader/dataservice/recovery_protocol.py, vnpy/trader/dataservice/recovery.py, vnpy/trader/runtime_supervisor.py, vnpy/trader/subprocess_queues.py

- Acceptance refs: `AC-DATASERVICE-001-S01, AC-DATASERVICE-003-S01, AC-DATASERVICE-004-S01, AC-DATASERVICE-005-S01, AC-DATASERVICE-008-S01, AC-DATASERVICE-013-S02, AC-DATASERVICE-021-S01, AC-DATASERVICE-021-S02, AC-DATASERVICE-023-S01, AC-DATASERVICE-023-S02, AC-DATASERVICE-023-S03, AC-DATASERVICE-024-S02, AC-DATASERVICE-024-S03`.
- Command refs: `CMD-DATASERVICE-057, CMD-DATASERVICE-058, CMD-DATASERVICE-059`.
- Evidence refs: `EVD-DATASERVICE-005`.

### TASK-DATASERVICE-006

> purpose 为at-least-once delivery提供事务内insert-or-compare 不改schema

- Source: `TASK-DATASERVICE-006`; role: `action`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:df2ecb8d786916b6f6501b4e91c29e5eb4e3f447087a0a69e72ac3d3ec6e3d3c`.
- Provenance: `SPAN-12D80B62643075BA`; clauses: `B2181:C1, B2182:C1, B2183:C1, B2184:C1, B2185:C1, B2185:C2, B2185:C3, B2186:C1, B2187:C1, B2188:C1, B2189:C1, B2190:C1, B2191:C1, B2192:C1, B2193:C1`.

**Execution Class:** `executable_child`
**Owned Production Paths:** vnpy/trader/database.py, vnpy_sqlite/vnpy_sqlite/sqlite_database.py

- Acceptance refs: `AC-DATASERVICE-002-S01, AC-DATASERVICE-003-S01, AC-DATASERVICE-015-S01, AC-DATASERVICE-016-S01, AC-DATASERVICE-016-S02, AC-DATASERVICE-016-S03, AC-DATASERVICE-016-S04`.
- Command refs: `CMD-DATASERVICE-060, CMD-DATASERVICE-061, CMD-DATASERVICE-062`.
- Evidence refs: `EVD-DATASERVICE-006`.

### TASK-DATASERVICE-007

> purpose 实现唯一effective series并删除revision winner 业务旧视图 query snapshot/lease

- Source: `TASK-DATASERVICE-007`; role: `action`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:56a53fa02d91a03c0b3c13efa0234292bdb635a19be60c1ef95074f63f417787`.
- Provenance: `SPAN-F39F2C35D45385E1`; clauses: `B2197:C1, B2198:C1, B2199:C1, B2200:C1, B2201:C1, B2201:C2, B2201:C3, B2202:C1, B2203:C1, B2204:C1, B2205:C1, B2206:C1, B2207:C1, B2208:C1, B2209:C1`.

**Execution Class:** `executable_child`
**Owned Production Paths:** vnpy/trader/dataservice/runtime.py, vnpy/trader/dataservice/query_runtime.py, vnpy/trader/dataservice/gds_snapshot.py, vnpy/trader/dataservice/bar_query.py, vnpy/trader/dataservice/bar_protocol.py, vnpy/trader/dataservice/chart_session.py, vnpy/datafeed/bar_data_array.py, vnpy/datafeed/index_range_builder.py, vnpy/datafeed/index_map_store.py

- Acceptance refs: `AC-DATASERVICE-001-S01, AC-DATASERVICE-002-S01, AC-DATASERVICE-003-S01, AC-DATASERVICE-004-S01, AC-DATASERVICE-005-S01, AC-DATASERVICE-006-S01, AC-DATASERVICE-008-S01, AC-DATASERVICE-013-S02, AC-DATASERVICE-023-S01, AC-DATASERVICE-023-S02, AC-DATASERVICE-023-S03, AC-DATASERVICE-024-S01, AC-DATASERVICE-024-S02, AC-DATASERVICE-024-S03`.
- Command refs: `CMD-DATASERVICE-063, CMD-DATASERVICE-064, CMD-DATASERVICE-065`.
- Evidence refs: `EVD-DATASERVICE-007`.

### TASK-DATASERVICE-008

> purpose 只替换数据源 恢复全部指标旧计算链

- Source: `TASK-DATASERVICE-008`; role: `action`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:b7ec151c688ad4bb4e8ce2712445a561760114fb65be5687637114ce43bb13bc`.
- Provenance: `SPAN-F09DD356A8366E16`; clauses: `B2213:C1, B2214:C1, B2215:C1, B2216:C1, B2217:C1, B2217:C2, B2217:C3, B2217:C4, B2218:C1, B2219:C1, B2220:C1, B2221:C1, B2222:C1, B2223:C1, B2224:C1, B2225:C1`.

**Execution Class:** `executable_child`
**Owned Production Paths:** vnpy/datafeed/indicator_data_session.py, vnpy/datafeed/indicator_protocol.py, vnpy/datafeed/indicator_runtime.py, vnpy/datafeed/indicator_runtime_client.py, vnpy/datafeed/indicator_worker.py, vnpy/datafeed/indicator_worker_pool.py, vnpy/datafeed/indicator_engine.py, vnpy/datafeed/l1_cache.py, vnpy/datafeed/l2_cache.py, vnpy/datafeed/indicator_storage.py, vnpy/datafeed/indicator_metadata_lmdb.py, indicators/indicator_registry.py

- Acceptance refs: `AC-DATASERVICE-011-S01, AC-DATASERVICE-012-S01, AC-DATASERVICE-013-S01, AC-DATASERVICE-013-S02, AC-DATASERVICE-023-S01`.
- Command refs: `CMD-DATASERVICE-066, CMD-DATASERVICE-067, CMD-DATASERVICE-068`.
- Evidence refs: `EVD-DATASERVICE-008`.

### TASK-DATASERVICE-009

> purpose 保证descriptor到真实图表的值和开盘价无回退

- Source: `TASK-DATASERVICE-009`; role: `action`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:0a3b6e2f1f37d68c10fd5001c9455318d86e37b9f72cc14d9fba5fb56205a98a`.
- Provenance: `SPAN-47415DB4F1CC813A`; clauses: `B2229:C1, B2230:C1, B2231:C1, B2232:C1, B2233:C1, B2233:C2, B2233:C3, B2234:C1, B2235:C1, B2236:C1, B2237:C1, B2238:C1, B2239:C1, B2239:C2, B2240:C1, B2241:C1`.

**Execution Class:** `executable_child`
**Owned Production Paths:** vnpy/chart/multi_timeframe_widget.py, vnpy/chart/indicator_drawing_manager.py, vnpy/chart/indicator_line_item.py, vnpy/chart/widget.py, vnpy/chart/widget_indicator.py, vnpy/chart/widget_mouse.py, vnpy/trader/ui/widget_chart_event.py

- Acceptance refs: `AC-DATASERVICE-006-S01, AC-DATASERVICE-007-S01, AC-DATASERVICE-008-S01, AC-DATASERVICE-011-S01, AC-DATASERVICE-012-S01, AC-DATASERVICE-013-S01, AC-DATASERVICE-013-S02, AC-DATASERVICE-024-S01, AC-DATASERVICE-024-S02, AC-DATASERVICE-024-S03`.
- Command refs: `CMD-DATASERVICE-069, CMD-DATASERVICE-070, CMD-DATASERVICE-071`.
- Evidence refs: `EVD-DATASERVICE-009`.

### TASK-DATASERVICE-010

> purpose 恢复ui配置 dormant合约和旧tick批量链

- Source: `TASK-DATASERVICE-010`; role: `action`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:e7bcf96f5207d2c2749a4491e748b0466c52bb1872f1953b7e8a230f74fc8a06`.
- Provenance: `SPAN-A3645BDB711B993D`; clauses: `B2245:C1, B2246:C1, B2247:C1, B2248:C1, B2249:C1, B2249:C2, B2249:C3, B2249:C4, B2250:C1, B2251:C1, B2252:C1, B2253:C1, B2254:C1, B2255:C1, B2255:C2, B2256:C1, B2257:C1`.

**Execution Class:** `executable_child`
**Owned Production Paths:** vnpy_datarecorder/vnpy_datarecorder/engine.py, vnpy_datarecorder/vnpy_datarecorder/subprocess_facade.py, vnpy_datarecorder/vnpy_datarecorder/run_recorder_subprocess.py, vnpy_datarecorder/vnpy_datarecorder/ui/widget.py, vnpy/trader/recorder_subprocess_launcher.py

- Acceptance refs: `AC-DATASERVICE-014-S01, AC-DATASERVICE-015-S01, AC-DATASERVICE-016-S04`.
- Command refs: `CMD-DATASERVICE-072, CMD-DATASERVICE-073, CMD-DATASERVICE-074`.
- Evidence refs: `EVD-DATASERVICE-010`.

### TASK-DATASERVICE-011

> purpose 用一个bounded completedbarlog连接dataservice rollover batch与recorder持久化 保持旧周期时机并支持at-least-once

- Source: `TASK-DATASERVICE-011`; role: `action`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:91e953f1259ec37c0557f895b85de16bdb52f378e91e3452723aca513dfbdbc1`.
- Provenance: `SPAN-0DA35C6E5F562706`; clauses: `B2261:C1, B2262:C1, B2263:C1, B2264:C1, B2265:C1, B2265:C2, B2266:C1, B2267:C1, B2268:C1, B2269:C1, B2270:C1, B2271:C1, B2271:C2, B2272:C1, B2273:C1`.

**Execution Class:** `executable_child`
**Owned Production Paths:** vnpy/trader/dataservice/completed_bar_log.py, vnpy/trader/subprocess_queues.py, vnpy_datarecorder/vnpy_datarecorder/canonical_consumer.py, vnpy_datarecorder/vnpy_datarecorder/engine.py, vnpy_datarecorder/vnpy_datarecorder/persistence_protocol.py, vnpy_datarecorder/vnpy_datarecorder/run_recorder_subprocess.py, vnpy/trader/recorder_subprocess_launcher.py

- Acceptance refs: `AC-DATASERVICE-002-S01, AC-DATASERVICE-014-S01, AC-DATASERVICE-015-S01, AC-DATASERVICE-016-S01, AC-DATASERVICE-016-S02, AC-DATASERVICE-016-S03, AC-DATASERVICE-016-S04, AC-DATASERVICE-021-S01, AC-DATASERVICE-021-S03, AC-DATASERVICE-024-S02, AC-DATASERVICE-024-S03`.
- Command refs: `CMD-DATASERVICE-075, CMD-DATASERVICE-076, CMD-DATASERVICE-077`.
- Evidence refs: `EVD-DATASERVICE-011`.

### TASK-DATASERVICE-012

> purpose 恢复原vn.py回调和交易最新价 同时保持主进程轻量

- Source: `TASK-DATASERVICE-012`; role: `action`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:25b6c37e68893db734e570c88358a009719190b2a5c7f86360b3a8489a22dd5b`.
- Provenance: `SPAN-39593A6859452F40`; clauses: `B2277:C1, B2278:C1, B2279:C1, B2280:C1, B2281:C1, B2281:C2, B2281:C3, B2282:C1, B2283:C1, B2284:C1, B2285:C1, B2286:C1, B2287:C1, B2287:C2, B2288:C1, B2289:C1`.

**Execution Class:** `executable_child`
**Owned Production Paths:** vnpy/datafeed/tick_shm_ringbuffer.py, vnpy/datafeed/tick_databus.py, vnpy/trader/subprocess_event_bridge.py, vnpy/trader/engine.py, vnpy/trader/execution_quote.py, vnpy/trader/order_execution_gate.py, vnpy/trader/ui/widget_trading.py, vnpy/chart/widget_mouse.py, vnpy_ctastrategy/vnpy_ctastrategy/engine.py, vnpy_ctastrategy/vnpy_ctastrategy/run_cta_subprocess.py, vnpy_ctastrategy/vnpy_ctastrategy/serial_dispatcher.py, vnpy_futu/vnpy_futu/futu_gateway.py

- Acceptance refs: `AC-DATASERVICE-009-S02, AC-DATASERVICE-010-S01, AC-DATASERVICE-017-S01, AC-DATASERVICE-018-S01, AC-DATASERVICE-019-S01, AC-DATASERVICE-020-S03, AC-DATASERVICE-020-S04, AC-DATASERVICE-022-S01`.
- Command refs: `CMD-DATASERVICE-078, CMD-DATASERVICE-079, CMD-DATASERVICE-080`.
- Evidence refs: `EVD-DATASERVICE-012`.

### TASK-DATASERVICE-013

> purpose 把判断留在trigger子进程 把真实交易留在orderexecutiongate

- Source: `TASK-DATASERVICE-013`; role: `action`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:abc4256c5a1af06d48c86b37447be58b86ad813a49fa3b12464860c55b62afd7`.
- Provenance: `SPAN-609F55D9D3FBA959`; clauses: `B2293:C1, B2294:C1, B2295:C1, B2296:C1, B2297:C1, B2297:C2, B2297:C3, B2297:C4, B2297:C5, B2298:C1, B2299:C1, B2300:C1, B2301:C1, B2302:C1, B2303:C1, B2303:C2, B2304:C1, B2305:C1`.

**Execution Class:** `executable_child`
**Owned Production Paths:** vnpy/trader/trigger_service/engine.py, vnpy/trader/trigger_service/runtime.py, vnpy/trader/trigger_service/protocol.py, vnpy/trader/trigger_service/execution_quote_source.py, vnpy/trader/order_execution_gate.py, vnpy/trader/subprocess_event_bridge.py

- Acceptance refs: `AC-DATASERVICE-020-S01, AC-DATASERVICE-020-S02, AC-DATASERVICE-020-S03, AC-DATASERVICE-020-S04`.
- Command refs: `CMD-DATASERVICE-081, CMD-DATASERVICE-082, CMD-DATASERVICE-083`.
- Evidence refs: `EVD-DATASERVICE-013`.

### TASK-DATASERVICE-014

> purpose 删除250ms重试风暴 按range终态和稳定gds恢复

- Source: `TASK-DATASERVICE-014`; role: `action`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:75c6d39169d568e104fc5f718519e773da05d0d777306de18caefe736ad28424`.
- Provenance: `SPAN-EF1BAE0004F2A7EE`; clauses: `B2309:C1, B2310:C1, B2311:C1, B2312:C1, B2313:C1, B2313:C2, B2313:C3, B2313:C4, B2313:C5, B2313:C6, B2314:C1, B2315:C1, B2316:C1, B2317:C1, B2318:C1, B2319:C1, B2319:C2, B2320:C1, B2321:C1`.

**Execution Class:** `executable_child`
**Owned Production Paths:** vnpy/trader/dataservice/query_runtime.py, vnpy/trader/dataservice/query_protocol.py, vnpy/trader/dataservice/chart_session.py, vnpy/datafeed/indicator_runtime_client.py, vnpy/chart/multi_timeframe_widget.py, vnpy/trader/runtime_supervisor.py

- Acceptance refs: `AC-DATASERVICE-021-S03, AC-DATASERVICE-023-S01, AC-DATASERVICE-023-S02, AC-DATASERVICE-023-S03, AC-DATASERVICE-024-S01, AC-DATASERVICE-024-S02, AC-DATASERVICE-024-S03`.
- Command refs: `CMD-DATASERVICE-084, CMD-DATASERVICE-085, CMD-DATASERVICE-086`.
- Evidence refs: `EVD-DATASERVICE-014`.

### TASK-DATASERVICE-015

> purpose 执行ac-01至ac-24和perf-001至perf-020 生成证据索引

- Source: `TASK-DATASERVICE-015`; role: `action`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:2b27c5e9592d2fefc2fb192e7828ee7eb132f01a96b379fca1a93f1c298ba49d`.
- Provenance: `SPAN-5252D08D7475DBFF`; clauses: `B2325:C1, B2326:C1, B2327:C1, B2328:C1, B2329:C1, B2329:C2, B2329:C3, B2330:C1, B2331:C1, B2332:C1, B2333:C1, B2334:C1, B2335:C1, B2335:C2, B2335:C3, B2336:C1, B2337:C1`.

**Execution Class:** `aggregate_only`
**Owned Production Paths:** none
**Aggregate Gate Phase:** `final_aggregate`
**Aggregate Validation Commands:** undefined

- Execute the source-declared aggregate validation commands at the declared aggregate gate phase.
- This task MUST NOT enter the executable child manifest.
- This task MUST NOT create an atomic child commit.

- Acceptance refs: `AC-DATASERVICE-001-S01, AC-DATASERVICE-002-S01, AC-DATASERVICE-003-S01, AC-DATASERVICE-004-S01, AC-DATASERVICE-005-S01, AC-DATASERVICE-006-S01, AC-DATASERVICE-007-S01, AC-DATASERVICE-008-S01, AC-DATASERVICE-009-S01, AC-DATASERVICE-009-S02, AC-DATASERVICE-010-S01, AC-DATASERVICE-011-S01, AC-DATASERVICE-012-S01, AC-DATASERVICE-013-S01, AC-DATASERVICE-013-S02, AC-DATASERVICE-014-S01, AC-DATASERVICE-015-S01, AC-DATASERVICE-016-S01, AC-DATASERVICE-016-S02, AC-DATASERVICE-016-S03, AC-DATASERVICE-016-S04, AC-DATASERVICE-017-S01, AC-DATASERVICE-018-S01, AC-DATASERVICE-019-S01, AC-DATASERVICE-020-S01, AC-DATASERVICE-020-S02, AC-DATASERVICE-020-S03, AC-DATASERVICE-020-S04, AC-DATASERVICE-021-S01, AC-DATASERVICE-021-S02, AC-DATASERVICE-021-S03, AC-DATASERVICE-022-S01, AC-DATASERVICE-022-S02, AC-DATASERVICE-023-S01, AC-DATASERVICE-023-S02, AC-DATASERVICE-023-S03, AC-DATASERVICE-024-S01, AC-DATASERVICE-024-S02, AC-DATASERVICE-024-S03`.
- Command refs: `CMD-DATASERVICE-003, CMD-DATASERVICE-004, CMD-DATASERVICE-005, CMD-DATASERVICE-006, CMD-DATASERVICE-007, CMD-DATASERVICE-008, CMD-DATASERVICE-009, CMD-DATASERVICE-010, CMD-DATASERVICE-011, CMD-DATASERVICE-012, CMD-DATASERVICE-013, CMD-DATASERVICE-014, CMD-DATASERVICE-015, CMD-DATASERVICE-016, CMD-DATASERVICE-017, CMD-DATASERVICE-018, CMD-DATASERVICE-019, CMD-DATASERVICE-020, CMD-DATASERVICE-021, CMD-DATASERVICE-022, CMD-DATASERVICE-023, CMD-DATASERVICE-024, CMD-DATASERVICE-025, CMD-DATASERVICE-026, CMD-DATASERVICE-027, CMD-DATASERVICE-028, CMD-DATASERVICE-029, CMD-DATASERVICE-030, CMD-DATASERVICE-031, CMD-DATASERVICE-032, CMD-DATASERVICE-033, CMD-DATASERVICE-034, CMD-DATASERVICE-035, CMD-DATASERVICE-036, CMD-DATASERVICE-037, CMD-DATASERVICE-038, CMD-DATASERVICE-039, CMD-DATASERVICE-040, CMD-DATASERVICE-041, CMD-DATASERVICE-042, CMD-DATASERVICE-087, CMD-DATASERVICE-090`.
- Evidence refs: `EVD-DATASERVICE-015`.

### TASK-DATASERVICE-016

> purpose 确保生产只剩一条权威链 不以兼容层长期保留双实现

- Source: `TASK-DATASERVICE-016`; role: `action`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:12df07df2ead84fc9cabc84045e119b21530ccc2fcefaca3f17247de56228ee4`.
- Provenance: `SPAN-60717E2FFE188AD3`; clauses: `B2341:C1, B2342:C1, B2343:C1, B2344:C1, B2345:C1, B2345:C2, B2346:C1, B2346:C2, B2346:C3, B2346:C4, B2347:C1, B2347:C2, B2348:C1, B2349:C1, B2350:C1, B2351:C1, B2352:C1, B2352:C2, B2353:C1, B2353:C2, B2354:C1`.

**Execution Class:** `executable_child`
**Owned Production Paths:** vnpy/trader/dataservice/runtime.py, vnpy/trader/dataservice/quote_state.py, vnpy/trader/dataservice/futu_metadata.py, vnpy/trader/dataservice/subscription_registry.py, vnpy/trader/runtime_supervisor.py, vnpy/trader/runtime_protocol.py, vnpy_futu/vnpy_futu/futu_gateway.py, vnpy/trader/ui/widget.py, examples/veighna_trader/run.py, vnpy/trader/dataservice/canonical_bars.py, vnpy/trader/dataservice/throttle.py, vnpy/trader/period_utils.py, vnpy/trader/hkfe_bar_generator.py, vnpy/trader/hkfe_period_common.py, vnpy/datafeed/period_aggregation.py, vnpy_datamanager/vnpy_datamanager/engine.py, vnpy_datamanager/vnpy_datamanager/runtime.py, vnpy/trader/dataservice/market_protocol.py, vnpy/trader/dataservice/query_protocol.py, vnpy/trader/dataservice/recovery_protocol.py, vnpy/trader/dataservice/recovery.py, vnpy/trader/subprocess_queues.py, vnpy/trader/database.py, vnpy_sqlite/vnpy_sqlite/sqlite_database.py, vnpy/trader/dataservice/query_runtime.py, vnpy/trader/dataservice/gds_snapshot.py, vnpy/trader/dataservice/bar_query.py, vnpy/trader/dataservice/bar_protocol.py, vnpy/trader/dataservice/chart_session.py, vnpy/datafeed/bar_data_array.py, vnpy/datafeed/index_range_builder.py, vnpy/datafeed/index_map_store.py, vnpy/datafeed/indicator_data_session.py, vnpy/datafeed/indicator_protocol.py, vnpy/datafeed/indicator_runtime.py, vnpy/datafeed/indicator_runtime_client.py, vnpy/datafeed/indicator_worker.py, vnpy/datafeed/indicator_worker_pool.py, vnpy/datafeed/indicator_engine.py, vnpy/datafeed/l1_cache.py, vnpy/datafeed/l2_cache.py, vnpy/datafeed/indicator_storage.py, vnpy/datafeed/indicator_metadata_lmdb.py, indicators/indicator_registry.py, vnpy/chart/multi_timeframe_widget.py, vnpy/chart/indicator_drawing_manager.py, vnpy/chart/indicator_line_item.py, vnpy/chart/widget.py, vnpy/chart/widget_indicator.py, vnpy/chart/widget_mouse.py, vnpy/trader/ui/widget_chart_event.py, vnpy_datarecorder/vnpy_datarecorder/engine.py, vnpy_datarecorder/vnpy_datarecorder/subprocess_facade.py, vnpy_datarecorder/vnpy_datarecorder/run_recorder_subprocess.py, vnpy_datarecorder/vnpy_datarecorder/ui/widget.py, vnpy/trader/recorder_subprocess_launcher.py, vnpy/trader/dataservice/completed_bar_log.py, vnpy_datarecorder/vnpy_datarecorder/canonical_consumer.py, vnpy_datarecorder/vnpy_datarecorder/persistence_protocol.py, vnpy/datafeed/tick_shm_ringbuffer.py, vnpy/datafeed/tick_databus.py, vnpy/trader/subprocess_event_bridge.py, vnpy/trader/engine.py, vnpy/trader/execution_quote.py, vnpy/trader/order_execution_gate.py, vnpy/trader/ui/widget_trading.py, vnpy_ctastrategy/vnpy_ctastrategy/engine.py, vnpy_ctastrategy/vnpy_ctastrategy/run_cta_subprocess.py, vnpy_ctastrategy/vnpy_ctastrategy/serial_dispatcher.py, vnpy/trader/trigger_service/engine.py, vnpy/trader/trigger_service/runtime.py, vnpy/trader/trigger_service/protocol.py, vnpy/trader/trigger_service/execution_quote_source.py

- Acceptance refs: `AC-DATASERVICE-009-S01, AC-DATASERVICE-009-S02, AC-DATASERVICE-010-S01, AC-DATASERVICE-011-S01, AC-DATASERVICE-012-S01, AC-DATASERVICE-013-S01, AC-DATASERVICE-013-S02, AC-DATASERVICE-014-S01, AC-DATASERVICE-015-S01, AC-DATASERVICE-016-S01, AC-DATASERVICE-016-S02, AC-DATASERVICE-016-S03, AC-DATASERVICE-016-S04, AC-DATASERVICE-017-S01, AC-DATASERVICE-018-S01, AC-DATASERVICE-019-S01, AC-DATASERVICE-020-S01, AC-DATASERVICE-020-S02, AC-DATASERVICE-020-S03, AC-DATASERVICE-020-S04, AC-DATASERVICE-021-S01, AC-DATASERVICE-021-S02, AC-DATASERVICE-021-S03, AC-DATASERVICE-022-S01, AC-DATASERVICE-022-S02, AC-DATASERVICE-023-S01, AC-DATASERVICE-023-S02, AC-DATASERVICE-023-S03, AC-DATASERVICE-024-S01, AC-DATASERVICE-024-S02, AC-DATASERVICE-024-S03`.
- Command refs: `CMD-DATASERVICE-042, CMD-DATASERVICE-053, CMD-DATASERVICE-056, CMD-DATASERVICE-059, CMD-DATASERVICE-062, CMD-DATASERVICE-065, CMD-DATASERVICE-068, CMD-DATASERVICE-071, CMD-DATASERVICE-074, CMD-DATASERVICE-077, CMD-DATASERVICE-080, CMD-DATASERVICE-083, CMD-DATASERVICE-086, CMD-DATASERVICE-092`.
- Evidence refs: `EVD-DATASERVICE-016`.
<!-- /goal-slot:implementationTasks -->

## Strict Acceptance Checklist

Every checkbox must have direct evidence before completion is claimed.

<!-- goal-slot:strictAcceptanceChecklist required dynamic=traceEvidence -->
- AC-DATASERVICE-001-S01:
> pass 全部字段和顺序断言成立 range只发布一次complete
  - Tasks: `TASK-DATASERVICE-001, TASK-DATASERVICE-002, TASK-DATASERVICE-003, TASK-DATASERVICE-004, TASK-DATASERVICE-005, TASK-DATASERVICE-006, TASK-DATASERVICE-007, TASK-DATASERVICE-008, TASK-DATASERVICE-009, TASK-DATASERVICE-010, TASK-DATASERVICE-011, TASK-DATASERVICE-012, TASK-DATASERVICE-013, TASK-DATASERVICE-014, TASK-DATASERVICE-015, TASK-DATASERVICE-016`.
  - Commands: `CMD-DATASERVICE-057, CMD-DATASERVICE-058, CMD-DATASERVICE-059, CMD-DATASERVICE-063, CMD-DATASERVICE-064, CMD-DATASERVICE-065, CMD-DATASERVICE-003, CMD-DATASERVICE-004, CMD-DATASERVICE-005, CMD-DATASERVICE-006, CMD-DATASERVICE-007, CMD-DATASERVICE-008, CMD-DATASERVICE-009, CMD-DATASERVICE-010, CMD-DATASERVICE-011, CMD-DATASERVICE-012, CMD-DATASERVICE-013, CMD-DATASERVICE-014, CMD-DATASERVICE-015, CMD-DATASERVICE-016, CMD-DATASERVICE-017, CMD-DATASERVICE-018, CMD-DATASERVICE-019, CMD-DATASERVICE-020, CMD-DATASERVICE-021, CMD-DATASERVICE-022, CMD-DATASERVICE-023, CMD-DATASERVICE-024, CMD-DATASERVICE-025, CMD-DATASERVICE-026, CMD-DATASERVICE-027, CMD-DATASERVICE-028, CMD-DATASERVICE-029, CMD-DATASERVICE-030, CMD-DATASERVICE-031, CMD-DATASERVICE-032, CMD-DATASERVICE-033, CMD-DATASERVICE-034, CMD-DATASERVICE-035, CMD-DATASERVICE-036, CMD-DATASERVICE-037, CMD-DATASERVICE-038, CMD-DATASERVICE-039, CMD-DATASERVICE-040, CMD-DATASERVICE-041, CMD-DATASERVICE-042, CMD-DATASERVICE-087, CMD-DATASERVICE-090`.
  - Evidence: `EVD-DATASERVICE-005, EVD-DATASERVICE-007, EVD-DATASERVICE-015, EVD-DATASERVICE-017`.

- AC-DATASERVICE-002-S01:
> pass 四个阶段的业务hash一致 hot吸收发生在cold compare之后
  - Tasks: `TASK-DATASERVICE-001, TASK-DATASERVICE-002, TASK-DATASERVICE-003, TASK-DATASERVICE-004, TASK-DATASERVICE-005, TASK-DATASERVICE-006, TASK-DATASERVICE-007, TASK-DATASERVICE-008, TASK-DATASERVICE-009, TASK-DATASERVICE-010, TASK-DATASERVICE-011, TASK-DATASERVICE-012, TASK-DATASERVICE-013, TASK-DATASERVICE-014, TASK-DATASERVICE-015, TASK-DATASERVICE-016`.
  - Commands: `CMD-DATASERVICE-060, CMD-DATASERVICE-061, CMD-DATASERVICE-062, CMD-DATASERVICE-063, CMD-DATASERVICE-064, CMD-DATASERVICE-065, CMD-DATASERVICE-075, CMD-DATASERVICE-076, CMD-DATASERVICE-077, CMD-DATASERVICE-003, CMD-DATASERVICE-004, CMD-DATASERVICE-005, CMD-DATASERVICE-006, CMD-DATASERVICE-007, CMD-DATASERVICE-008, CMD-DATASERVICE-009, CMD-DATASERVICE-010, CMD-DATASERVICE-011, CMD-DATASERVICE-012, CMD-DATASERVICE-013, CMD-DATASERVICE-014, CMD-DATASERVICE-015, CMD-DATASERVICE-016, CMD-DATASERVICE-017, CMD-DATASERVICE-018, CMD-DATASERVICE-019, CMD-DATASERVICE-020, CMD-DATASERVICE-021, CMD-DATASERVICE-022, CMD-DATASERVICE-023, CMD-DATASERVICE-024, CMD-DATASERVICE-025, CMD-DATASERVICE-026, CMD-DATASERVICE-027, CMD-DATASERVICE-028, CMD-DATASERVICE-029, CMD-DATASERVICE-030, CMD-DATASERVICE-031, CMD-DATASERVICE-032, CMD-DATASERVICE-033, CMD-DATASERVICE-034, CMD-DATASERVICE-035, CMD-DATASERVICE-036, CMD-DATASERVICE-037, CMD-DATASERVICE-038, CMD-DATASERVICE-039, CMD-DATASERVICE-040, CMD-DATASERVICE-041, CMD-DATASERVICE-042, CMD-DATASERVICE-087, CMD-DATASERVICE-090`.
  - Evidence: `EVD-DATASERVICE-006, EVD-DATASERVICE-007, EVD-DATASERVICE-011, EVD-DATASERVICE-015, EVD-DATASERVICE-018`.

- AC-DATASERVICE-003-S01:
> pass 无静默hot winner 无全局冻结 无第二opend context dataservice db write次数为0
  - Tasks: `TASK-DATASERVICE-001, TASK-DATASERVICE-002, TASK-DATASERVICE-003, TASK-DATASERVICE-004, TASK-DATASERVICE-005, TASK-DATASERVICE-006, TASK-DATASERVICE-007, TASK-DATASERVICE-008, TASK-DATASERVICE-009, TASK-DATASERVICE-010, TASK-DATASERVICE-011, TASK-DATASERVICE-012, TASK-DATASERVICE-013, TASK-DATASERVICE-014, TASK-DATASERVICE-015, TASK-DATASERVICE-016`.
  - Commands: `CMD-DATASERVICE-057, CMD-DATASERVICE-058, CMD-DATASERVICE-059, CMD-DATASERVICE-060, CMD-DATASERVICE-061, CMD-DATASERVICE-062, CMD-DATASERVICE-063, CMD-DATASERVICE-064, CMD-DATASERVICE-065, CMD-DATASERVICE-003, CMD-DATASERVICE-004, CMD-DATASERVICE-005, CMD-DATASERVICE-006, CMD-DATASERVICE-007, CMD-DATASERVICE-008, CMD-DATASERVICE-009, CMD-DATASERVICE-010, CMD-DATASERVICE-011, CMD-DATASERVICE-012, CMD-DATASERVICE-013, CMD-DATASERVICE-014, CMD-DATASERVICE-015, CMD-DATASERVICE-016, CMD-DATASERVICE-017, CMD-DATASERVICE-018, CMD-DATASERVICE-019, CMD-DATASERVICE-020, CMD-DATASERVICE-021, CMD-DATASERVICE-022, CMD-DATASERVICE-023, CMD-DATASERVICE-024, CMD-DATASERVICE-025, CMD-DATASERVICE-026, CMD-DATASERVICE-027, CMD-DATASERVICE-028, CMD-DATASERVICE-029, CMD-DATASERVICE-030, CMD-DATASERVICE-031, CMD-DATASERVICE-032, CMD-DATASERVICE-033, CMD-DATASERVICE-034, CMD-DATASERVICE-035, CMD-DATASERVICE-036, CMD-DATASERVICE-037, CMD-DATASERVICE-038, CMD-DATASERVICE-039, CMD-DATASERVICE-040, CMD-DATASERVICE-041, CMD-DATASERVICE-042, CMD-DATASERVICE-087, CMD-DATASERVICE-090`.
  - Evidence: `EVD-DATASERVICE-005, EVD-DATASERVICE-006, EVD-DATASERVICE-007, EVD-DATASERVICE-015, EVD-DATASERVICE-019`.

- AC-DATASERVICE-004-S01:
> pass 缺口下载 db commit read-back 局部cold load和单次publish顺序一致
  - Tasks: `TASK-DATASERVICE-001, TASK-DATASERVICE-002, TASK-DATASERVICE-003, TASK-DATASERVICE-004, TASK-DATASERVICE-005, TASK-DATASERVICE-006, TASK-DATASERVICE-007, TASK-DATASERVICE-008, TASK-DATASERVICE-009, TASK-DATASERVICE-010, TASK-DATASERVICE-011, TASK-DATASERVICE-012, TASK-DATASERVICE-013, TASK-DATASERVICE-014, TASK-DATASERVICE-015, TASK-DATASERVICE-016`.
  - Commands: `CMD-DATASERVICE-057, CMD-DATASERVICE-058, CMD-DATASERVICE-059, CMD-DATASERVICE-063, CMD-DATASERVICE-064, CMD-DATASERVICE-065, CMD-DATASERVICE-003, CMD-DATASERVICE-004, CMD-DATASERVICE-005, CMD-DATASERVICE-006, CMD-DATASERVICE-007, CMD-DATASERVICE-008, CMD-DATASERVICE-009, CMD-DATASERVICE-010, CMD-DATASERVICE-011, CMD-DATASERVICE-012, CMD-DATASERVICE-013, CMD-DATASERVICE-014, CMD-DATASERVICE-015, CMD-DATASERVICE-016, CMD-DATASERVICE-017, CMD-DATASERVICE-018, CMD-DATASERVICE-019, CMD-DATASERVICE-020, CMD-DATASERVICE-021, CMD-DATASERVICE-022, CMD-DATASERVICE-023, CMD-DATASERVICE-024, CMD-DATASERVICE-025, CMD-DATASERVICE-026, CMD-DATASERVICE-027, CMD-DATASERVICE-028, CMD-DATASERVICE-029, CMD-DATASERVICE-030, CMD-DATASERVICE-031, CMD-DATASERVICE-032, CMD-DATASERVICE-033, CMD-DATASERVICE-034, CMD-DATASERVICE-035, CMD-DATASERVICE-036, CMD-DATASERVICE-037, CMD-DATASERVICE-038, CMD-DATASERVICE-039, CMD-DATASERVICE-040, CMD-DATASERVICE-041, CMD-DATASERVICE-042, CMD-DATASERVICE-087, CMD-DATASERVICE-090`.
  - Evidence: `EVD-DATASERVICE-005, EVD-DATASERVICE-007, EVD-DATASERVICE-015, EVD-DATASERVICE-020`.

- AC-DATASERVICE-005-S01:
> pass 系统持续接收和发布未受影响数据 修复成功后缺口恢复
  - Tasks: `TASK-DATASERVICE-001, TASK-DATASERVICE-002, TASK-DATASERVICE-003, TASK-DATASERVICE-004, TASK-DATASERVICE-005, TASK-DATASERVICE-006, TASK-DATASERVICE-007, TASK-DATASERVICE-008, TASK-DATASERVICE-009, TASK-DATASERVICE-010, TASK-DATASERVICE-011, TASK-DATASERVICE-012, TASK-DATASERVICE-013, TASK-DATASERVICE-014, TASK-DATASERVICE-015, TASK-DATASERVICE-016`.
  - Commands: `CMD-DATASERVICE-057, CMD-DATASERVICE-058, CMD-DATASERVICE-059, CMD-DATASERVICE-063, CMD-DATASERVICE-064, CMD-DATASERVICE-065, CMD-DATASERVICE-003, CMD-DATASERVICE-004, CMD-DATASERVICE-005, CMD-DATASERVICE-006, CMD-DATASERVICE-007, CMD-DATASERVICE-008, CMD-DATASERVICE-009, CMD-DATASERVICE-010, CMD-DATASERVICE-011, CMD-DATASERVICE-012, CMD-DATASERVICE-013, CMD-DATASERVICE-014, CMD-DATASERVICE-015, CMD-DATASERVICE-016, CMD-DATASERVICE-017, CMD-DATASERVICE-018, CMD-DATASERVICE-019, CMD-DATASERVICE-020, CMD-DATASERVICE-021, CMD-DATASERVICE-022, CMD-DATASERVICE-023, CMD-DATASERVICE-024, CMD-DATASERVICE-025, CMD-DATASERVICE-026, CMD-DATASERVICE-027, CMD-DATASERVICE-028, CMD-DATASERVICE-029, CMD-DATASERVICE-030, CMD-DATASERVICE-031, CMD-DATASERVICE-032, CMD-DATASERVICE-033, CMD-DATASERVICE-034, CMD-DATASERVICE-035, CMD-DATASERVICE-036, CMD-DATASERVICE-037, CMD-DATASERVICE-038, CMD-DATASERVICE-039, CMD-DATASERVICE-040, CMD-DATASERVICE-041, CMD-DATASERVICE-042, CMD-DATASERVICE-087, CMD-DATASERVICE-090`.
  - Evidence: `EVD-DATASERVICE-005, EVD-DATASERVICE-007, EVD-DATASERVICE-015, EVD-DATASERVICE-021`.

- AC-DATASERVICE-006-S01:
> pass 单周期和多周期图表读取同一descriptor并显示o
  - Tasks: `TASK-DATASERVICE-001, TASK-DATASERVICE-002, TASK-DATASERVICE-003, TASK-DATASERVICE-004, TASK-DATASERVICE-005, TASK-DATASERVICE-006, TASK-DATASERVICE-007, TASK-DATASERVICE-008, TASK-DATASERVICE-009, TASK-DATASERVICE-010, TASK-DATASERVICE-011, TASK-DATASERVICE-012, TASK-DATASERVICE-013, TASK-DATASERVICE-014, TASK-DATASERVICE-015, TASK-DATASERVICE-016`.
  - Commands: `CMD-DATASERVICE-054, CMD-DATASERVICE-055, CMD-DATASERVICE-056, CMD-DATASERVICE-063, CMD-DATASERVICE-064, CMD-DATASERVICE-065, CMD-DATASERVICE-069, CMD-DATASERVICE-070, CMD-DATASERVICE-071, CMD-DATASERVICE-003, CMD-DATASERVICE-004, CMD-DATASERVICE-005, CMD-DATASERVICE-006, CMD-DATASERVICE-007, CMD-DATASERVICE-008, CMD-DATASERVICE-009, CMD-DATASERVICE-010, CMD-DATASERVICE-011, CMD-DATASERVICE-012, CMD-DATASERVICE-013, CMD-DATASERVICE-014, CMD-DATASERVICE-015, CMD-DATASERVICE-016, CMD-DATASERVICE-017, CMD-DATASERVICE-018, CMD-DATASERVICE-019, CMD-DATASERVICE-020, CMD-DATASERVICE-021, CMD-DATASERVICE-022, CMD-DATASERVICE-023, CMD-DATASERVICE-024, CMD-DATASERVICE-025, CMD-DATASERVICE-026, CMD-DATASERVICE-027, CMD-DATASERVICE-028, CMD-DATASERVICE-029, CMD-DATASERVICE-030, CMD-DATASERVICE-031, CMD-DATASERVICE-032, CMD-DATASERVICE-033, CMD-DATASERVICE-034, CMD-DATASERVICE-035, CMD-DATASERVICE-036, CMD-DATASERVICE-037, CMD-DATASERVICE-038, CMD-DATASERVICE-039, CMD-DATASERVICE-040, CMD-DATASERVICE-041, CMD-DATASERVICE-042, CMD-DATASERVICE-087, CMD-DATASERVICE-090`.
  - Evidence: `EVD-DATASERVICE-004, EVD-DATASERVICE-007, EVD-DATASERVICE-009, EVD-DATASERVICE-015, EVD-DATASERVICE-022`.

- AC-DATASERVICE-007-S01:
> pass 四组period start/open/current_bar_start_ix逐项成立
  - Tasks: `TASK-DATASERVICE-001, TASK-DATASERVICE-002, TASK-DATASERVICE-003, TASK-DATASERVICE-004, TASK-DATASERVICE-005, TASK-DATASERVICE-006, TASK-DATASERVICE-007, TASK-DATASERVICE-008, TASK-DATASERVICE-009, TASK-DATASERVICE-010, TASK-DATASERVICE-011, TASK-DATASERVICE-012, TASK-DATASERVICE-013, TASK-DATASERVICE-014, TASK-DATASERVICE-015, TASK-DATASERVICE-016`.
  - Commands: `CMD-DATASERVICE-054, CMD-DATASERVICE-055, CMD-DATASERVICE-056, CMD-DATASERVICE-069, CMD-DATASERVICE-070, CMD-DATASERVICE-071, CMD-DATASERVICE-003, CMD-DATASERVICE-004, CMD-DATASERVICE-005, CMD-DATASERVICE-006, CMD-DATASERVICE-007, CMD-DATASERVICE-008, CMD-DATASERVICE-009, CMD-DATASERVICE-010, CMD-DATASERVICE-011, CMD-DATASERVICE-012, CMD-DATASERVICE-013, CMD-DATASERVICE-014, CMD-DATASERVICE-015, CMD-DATASERVICE-016, CMD-DATASERVICE-017, CMD-DATASERVICE-018, CMD-DATASERVICE-019, CMD-DATASERVICE-020, CMD-DATASERVICE-021, CMD-DATASERVICE-022, CMD-DATASERVICE-023, CMD-DATASERVICE-024, CMD-DATASERVICE-025, CMD-DATASERVICE-026, CMD-DATASERVICE-027, CMD-DATASERVICE-028, CMD-DATASERVICE-029, CMD-DATASERVICE-030, CMD-DATASERVICE-031, CMD-DATASERVICE-032, CMD-DATASERVICE-033, CMD-DATASERVICE-034, CMD-DATASERVICE-035, CMD-DATASERVICE-036, CMD-DATASERVICE-037, CMD-DATASERVICE-038, CMD-DATASERVICE-039, CMD-DATASERVICE-040, CMD-DATASERVICE-041, CMD-DATASERVICE-042, CMD-DATASERVICE-087, CMD-DATASERVICE-090`.
  - Evidence: `EVD-DATASERVICE-004, EVD-DATASERVICE-009, EVD-DATASERVICE-015, EVD-DATASERVICE-023`.

- AC-DATASERVICE-008-S01:
> pass 缺失起点全程没有伪造4h bar 恢复后只发布正确值
  - Tasks: `TASK-DATASERVICE-001, TASK-DATASERVICE-002, TASK-DATASERVICE-003, TASK-DATASERVICE-004, TASK-DATASERVICE-005, TASK-DATASERVICE-006, TASK-DATASERVICE-007, TASK-DATASERVICE-008, TASK-DATASERVICE-009, TASK-DATASERVICE-010, TASK-DATASERVICE-011, TASK-DATASERVICE-012, TASK-DATASERVICE-013, TASK-DATASERVICE-014, TASK-DATASERVICE-015, TASK-DATASERVICE-016`.
  - Commands: `CMD-DATASERVICE-057, CMD-DATASERVICE-058, CMD-DATASERVICE-059, CMD-DATASERVICE-063, CMD-DATASERVICE-064, CMD-DATASERVICE-065, CMD-DATASERVICE-069, CMD-DATASERVICE-070, CMD-DATASERVICE-071, CMD-DATASERVICE-003, CMD-DATASERVICE-004, CMD-DATASERVICE-005, CMD-DATASERVICE-006, CMD-DATASERVICE-007, CMD-DATASERVICE-008, CMD-DATASERVICE-009, CMD-DATASERVICE-010, CMD-DATASERVICE-011, CMD-DATASERVICE-012, CMD-DATASERVICE-013, CMD-DATASERVICE-014, CMD-DATASERVICE-015, CMD-DATASERVICE-016, CMD-DATASERVICE-017, CMD-DATASERVICE-018, CMD-DATASERVICE-019, CMD-DATASERVICE-020, CMD-DATASERVICE-021, CMD-DATASERVICE-022, CMD-DATASERVICE-023, CMD-DATASERVICE-024, CMD-DATASERVICE-025, CMD-DATASERVICE-026, CMD-DATASERVICE-027, CMD-DATASERVICE-028, CMD-DATASERVICE-029, CMD-DATASERVICE-030, CMD-DATASERVICE-031, CMD-DATASERVICE-032, CMD-DATASERVICE-033, CMD-DATASERVICE-034, CMD-DATASERVICE-035, CMD-DATASERVICE-036, CMD-DATASERVICE-037, CMD-DATASERVICE-038, CMD-DATASERVICE-039, CMD-DATASERVICE-040, CMD-DATASERVICE-041, CMD-DATASERVICE-042, CMD-DATASERVICE-087, CMD-DATASERVICE-090`.
  - Evidence: `EVD-DATASERVICE-005, EVD-DATASERVICE-007, EVD-DATASERVICE-009, EVD-DATASERVICE-015, EVD-DATASERVICE-024`.

- AC-DATASERVICE-009-S01:
> pass ohlcv与 822c715e6 同输入characterization逐字段一致
  - Tasks: `TASK-DATASERVICE-001, TASK-DATASERVICE-002, TASK-DATASERVICE-003, TASK-DATASERVICE-004, TASK-DATASERVICE-005, TASK-DATASERVICE-006, TASK-DATASERVICE-007, TASK-DATASERVICE-008, TASK-DATASERVICE-009, TASK-DATASERVICE-010, TASK-DATASERVICE-011, TASK-DATASERVICE-012, TASK-DATASERVICE-013, TASK-DATASERVICE-014, TASK-DATASERVICE-015, TASK-DATASERVICE-016`.
  - Commands: `CMD-DATASERVICE-045, CMD-DATASERVICE-046, CMD-DATASERVICE-047, CMD-DATASERVICE-051, CMD-DATASERVICE-052, CMD-DATASERVICE-053, CMD-DATASERVICE-054, CMD-DATASERVICE-055, CMD-DATASERVICE-056, CMD-DATASERVICE-003, CMD-DATASERVICE-004, CMD-DATASERVICE-005, CMD-DATASERVICE-006, CMD-DATASERVICE-007, CMD-DATASERVICE-008, CMD-DATASERVICE-009, CMD-DATASERVICE-010, CMD-DATASERVICE-011, CMD-DATASERVICE-012, CMD-DATASERVICE-013, CMD-DATASERVICE-014, CMD-DATASERVICE-015, CMD-DATASERVICE-016, CMD-DATASERVICE-017, CMD-DATASERVICE-018, CMD-DATASERVICE-019, CMD-DATASERVICE-020, CMD-DATASERVICE-021, CMD-DATASERVICE-022, CMD-DATASERVICE-023, CMD-DATASERVICE-024, CMD-DATASERVICE-025, CMD-DATASERVICE-026, CMD-DATASERVICE-027, CMD-DATASERVICE-028, CMD-DATASERVICE-029, CMD-DATASERVICE-030, CMD-DATASERVICE-031, CMD-DATASERVICE-032, CMD-DATASERVICE-033, CMD-DATASERVICE-034, CMD-DATASERVICE-035, CMD-DATASERVICE-036, CMD-DATASERVICE-037, CMD-DATASERVICE-038, CMD-DATASERVICE-039, CMD-DATASERVICE-040, CMD-DATASERVICE-041, CMD-DATASERVICE-042, CMD-DATASERVICE-087, CMD-DATASERVICE-090, CMD-DATASERVICE-059, CMD-DATASERVICE-062, CMD-DATASERVICE-065, CMD-DATASERVICE-068, CMD-DATASERVICE-071, CMD-DATASERVICE-074, CMD-DATASERVICE-077, CMD-DATASERVICE-080, CMD-DATASERVICE-083, CMD-DATASERVICE-086, CMD-DATASERVICE-092`.
  - Evidence: `EVD-DATASERVICE-001, EVD-DATASERVICE-003, EVD-DATASERVICE-004, EVD-DATASERVICE-015, EVD-DATASERVICE-016, EVD-DATASERVICE-025`.

- AC-DATASERVICE-009-S02:
> pass 外部投递计数等于fixture事件数 聚合结果与单次输入一致
  - Tasks: `TASK-DATASERVICE-001, TASK-DATASERVICE-002, TASK-DATASERVICE-003, TASK-DATASERVICE-004, TASK-DATASERVICE-005, TASK-DATASERVICE-006, TASK-DATASERVICE-007, TASK-DATASERVICE-008, TASK-DATASERVICE-009, TASK-DATASERVICE-010, TASK-DATASERVICE-011, TASK-DATASERVICE-012, TASK-DATASERVICE-013, TASK-DATASERVICE-014, TASK-DATASERVICE-015, TASK-DATASERVICE-016`.
  - Commands: `CMD-DATASERVICE-045, CMD-DATASERVICE-046, CMD-DATASERVICE-047, CMD-DATASERVICE-051, CMD-DATASERVICE-052, CMD-DATASERVICE-053, CMD-DATASERVICE-054, CMD-DATASERVICE-055, CMD-DATASERVICE-056, CMD-DATASERVICE-078, CMD-DATASERVICE-079, CMD-DATASERVICE-080, CMD-DATASERVICE-003, CMD-DATASERVICE-004, CMD-DATASERVICE-005, CMD-DATASERVICE-006, CMD-DATASERVICE-007, CMD-DATASERVICE-008, CMD-DATASERVICE-009, CMD-DATASERVICE-010, CMD-DATASERVICE-011, CMD-DATASERVICE-012, CMD-DATASERVICE-013, CMD-DATASERVICE-014, CMD-DATASERVICE-015, CMD-DATASERVICE-016, CMD-DATASERVICE-017, CMD-DATASERVICE-018, CMD-DATASERVICE-019, CMD-DATASERVICE-020, CMD-DATASERVICE-021, CMD-DATASERVICE-022, CMD-DATASERVICE-023, CMD-DATASERVICE-024, CMD-DATASERVICE-025, CMD-DATASERVICE-026, CMD-DATASERVICE-027, CMD-DATASERVICE-028, CMD-DATASERVICE-029, CMD-DATASERVICE-030, CMD-DATASERVICE-031, CMD-DATASERVICE-032, CMD-DATASERVICE-033, CMD-DATASERVICE-034, CMD-DATASERVICE-035, CMD-DATASERVICE-036, CMD-DATASERVICE-037, CMD-DATASERVICE-038, CMD-DATASERVICE-039, CMD-DATASERVICE-040, CMD-DATASERVICE-041, CMD-DATASERVICE-042, CMD-DATASERVICE-087, CMD-DATASERVICE-090, CMD-DATASERVICE-059, CMD-DATASERVICE-062, CMD-DATASERVICE-065, CMD-DATASERVICE-068, CMD-DATASERVICE-071, CMD-DATASERVICE-074, CMD-DATASERVICE-077, CMD-DATASERVICE-083, CMD-DATASERVICE-086, CMD-DATASERVICE-092`.
  - Evidence: `EVD-DATASERVICE-001, EVD-DATASERVICE-003, EVD-DATASERVICE-004, EVD-DATASERVICE-012, EVD-DATASERVICE-015, EVD-DATASERVICE-016, EVD-DATASERVICE-041`.

- AC-DATASERVICE-010-S01:
> pass 每种连续性按第4.5节独立处置
  - Tasks: `TASK-DATASERVICE-001, TASK-DATASERVICE-002, TASK-DATASERVICE-003, TASK-DATASERVICE-004, TASK-DATASERVICE-005, TASK-DATASERVICE-006, TASK-DATASERVICE-007, TASK-DATASERVICE-008, TASK-DATASERVICE-009, TASK-DATASERVICE-010, TASK-DATASERVICE-011, TASK-DATASERVICE-012, TASK-DATASERVICE-013, TASK-DATASERVICE-014, TASK-DATASERVICE-015, TASK-DATASERVICE-016`.
  - Commands: `CMD-DATASERVICE-054, CMD-DATASERVICE-055, CMD-DATASERVICE-056, CMD-DATASERVICE-078, CMD-DATASERVICE-079, CMD-DATASERVICE-080, CMD-DATASERVICE-003, CMD-DATASERVICE-004, CMD-DATASERVICE-005, CMD-DATASERVICE-006, CMD-DATASERVICE-007, CMD-DATASERVICE-008, CMD-DATASERVICE-009, CMD-DATASERVICE-010, CMD-DATASERVICE-011, CMD-DATASERVICE-012, CMD-DATASERVICE-013, CMD-DATASERVICE-014, CMD-DATASERVICE-015, CMD-DATASERVICE-016, CMD-DATASERVICE-017, CMD-DATASERVICE-018, CMD-DATASERVICE-019, CMD-DATASERVICE-020, CMD-DATASERVICE-021, CMD-DATASERVICE-022, CMD-DATASERVICE-023, CMD-DATASERVICE-024, CMD-DATASERVICE-025, CMD-DATASERVICE-026, CMD-DATASERVICE-027, CMD-DATASERVICE-028, CMD-DATASERVICE-029, CMD-DATASERVICE-030, CMD-DATASERVICE-031, CMD-DATASERVICE-032, CMD-DATASERVICE-033, CMD-DATASERVICE-034, CMD-DATASERVICE-035, CMD-DATASERVICE-036, CMD-DATASERVICE-037, CMD-DATASERVICE-038, CMD-DATASERVICE-039, CMD-DATASERVICE-040, CMD-DATASERVICE-041, CMD-DATASERVICE-042, CMD-DATASERVICE-087, CMD-DATASERVICE-090, CMD-DATASERVICE-053, CMD-DATASERVICE-059, CMD-DATASERVICE-062, CMD-DATASERVICE-065, CMD-DATASERVICE-068, CMD-DATASERVICE-071, CMD-DATASERVICE-074, CMD-DATASERVICE-077, CMD-DATASERVICE-083, CMD-DATASERVICE-086, CMD-DATASERVICE-092`.
  - Evidence: `EVD-DATASERVICE-004, EVD-DATASERVICE-012, EVD-DATASERVICE-015, EVD-DATASERVICE-016, EVD-DATASERVICE-026`.

- AC-DATASERVICE-011-S01:
> pass lmdb u0/u1 映射值和plotdataitem实际xdata/ydata逐点一致
  - Tasks: `TASK-DATASERVICE-001, TASK-DATASERVICE-002, TASK-DATASERVICE-003, TASK-DATASERVICE-004, TASK-DATASERVICE-005, TASK-DATASERVICE-006, TASK-DATASERVICE-007, TASK-DATASERVICE-008, TASK-DATASERVICE-009, TASK-DATASERVICE-010, TASK-DATASERVICE-011, TASK-DATASERVICE-012, TASK-DATASERVICE-013, TASK-DATASERVICE-014, TASK-DATASERVICE-015, TASK-DATASERVICE-016`.
  - Commands: `CMD-DATASERVICE-045, CMD-DATASERVICE-046, CMD-DATASERVICE-047, CMD-DATASERVICE-066, CMD-DATASERVICE-067, CMD-DATASERVICE-068, CMD-DATASERVICE-069, CMD-DATASERVICE-070, CMD-DATASERVICE-071, CMD-DATASERVICE-003, CMD-DATASERVICE-004, CMD-DATASERVICE-005, CMD-DATASERVICE-006, CMD-DATASERVICE-007, CMD-DATASERVICE-008, CMD-DATASERVICE-009, CMD-DATASERVICE-010, CMD-DATASERVICE-011, CMD-DATASERVICE-012, CMD-DATASERVICE-013, CMD-DATASERVICE-014, CMD-DATASERVICE-015, CMD-DATASERVICE-016, CMD-DATASERVICE-017, CMD-DATASERVICE-018, CMD-DATASERVICE-019, CMD-DATASERVICE-020, CMD-DATASERVICE-021, CMD-DATASERVICE-022, CMD-DATASERVICE-023, CMD-DATASERVICE-024, CMD-DATASERVICE-025, CMD-DATASERVICE-026, CMD-DATASERVICE-027, CMD-DATASERVICE-028, CMD-DATASERVICE-029, CMD-DATASERVICE-030, CMD-DATASERVICE-031, CMD-DATASERVICE-032, CMD-DATASERVICE-033, CMD-DATASERVICE-034, CMD-DATASERVICE-035, CMD-DATASERVICE-036, CMD-DATASERVICE-037, CMD-DATASERVICE-038, CMD-DATASERVICE-039, CMD-DATASERVICE-040, CMD-DATASERVICE-041, CMD-DATASERVICE-042, CMD-DATASERVICE-087, CMD-DATASERVICE-090, CMD-DATASERVICE-053, CMD-DATASERVICE-056, CMD-DATASERVICE-059, CMD-DATASERVICE-062, CMD-DATASERVICE-065, CMD-DATASERVICE-074, CMD-DATASERVICE-077, CMD-DATASERVICE-080, CMD-DATASERVICE-083, CMD-DATASERVICE-086, CMD-DATASERVICE-092`.
  - Evidence: `EVD-DATASERVICE-001, EVD-DATASERVICE-008, EVD-DATASERVICE-009, EVD-DATASERVICE-015, EVD-DATASERVICE-016, EVD-DATASERVICE-027`.

- AC-DATASERVICE-012-S01:
> pass boll lower_higher_trend trend_state_machine完整通过 其他manifest指标smoke通过
  - Tasks: `TASK-DATASERVICE-001, TASK-DATASERVICE-002, TASK-DATASERVICE-003, TASK-DATASERVICE-004, TASK-DATASERVICE-005, TASK-DATASERVICE-006, TASK-DATASERVICE-007, TASK-DATASERVICE-008, TASK-DATASERVICE-009, TASK-DATASERVICE-010, TASK-DATASERVICE-011, TASK-DATASERVICE-012, TASK-DATASERVICE-013, TASK-DATASERVICE-014, TASK-DATASERVICE-015, TASK-DATASERVICE-016`.
  - Commands: `CMD-DATASERVICE-045, CMD-DATASERVICE-046, CMD-DATASERVICE-047, CMD-DATASERVICE-066, CMD-DATASERVICE-067, CMD-DATASERVICE-068, CMD-DATASERVICE-069, CMD-DATASERVICE-070, CMD-DATASERVICE-071, CMD-DATASERVICE-003, CMD-DATASERVICE-004, CMD-DATASERVICE-005, CMD-DATASERVICE-006, CMD-DATASERVICE-007, CMD-DATASERVICE-008, CMD-DATASERVICE-009, CMD-DATASERVICE-010, CMD-DATASERVICE-011, CMD-DATASERVICE-012, CMD-DATASERVICE-013, CMD-DATASERVICE-014, CMD-DATASERVICE-015, CMD-DATASERVICE-016, CMD-DATASERVICE-017, CMD-DATASERVICE-018, CMD-DATASERVICE-019, CMD-DATASERVICE-020, CMD-DATASERVICE-021, CMD-DATASERVICE-022, CMD-DATASERVICE-023, CMD-DATASERVICE-024, CMD-DATASERVICE-025, CMD-DATASERVICE-026, CMD-DATASERVICE-027, CMD-DATASERVICE-028, CMD-DATASERVICE-029, CMD-DATASERVICE-030, CMD-DATASERVICE-031, CMD-DATASERVICE-032, CMD-DATASERVICE-033, CMD-DATASERVICE-034, CMD-DATASERVICE-035, CMD-DATASERVICE-036, CMD-DATASERVICE-037, CMD-DATASERVICE-038, CMD-DATASERVICE-039, CMD-DATASERVICE-040, CMD-DATASERVICE-041, CMD-DATASERVICE-042, CMD-DATASERVICE-087, CMD-DATASERVICE-090, CMD-DATASERVICE-053, CMD-DATASERVICE-056, CMD-DATASERVICE-059, CMD-DATASERVICE-062, CMD-DATASERVICE-065, CMD-DATASERVICE-074, CMD-DATASERVICE-077, CMD-DATASERVICE-080, CMD-DATASERVICE-083, CMD-DATASERVICE-086, CMD-DATASERVICE-092`.
  - Evidence: `EVD-DATASERVICE-001, EVD-DATASERVICE-008, EVD-DATASERVICE-009, EVD-DATASERVICE-015, EVD-DATASERVICE-016, EVD-DATASERVICE-028`.

- AC-DATASERVICE-013-S01:
> pass cold和warm两次最终绘图完全一致 第二次命中lmdb
  - Tasks: `TASK-DATASERVICE-001, TASK-DATASERVICE-002, TASK-DATASERVICE-003, TASK-DATASERVICE-004, TASK-DATASERVICE-005, TASK-DATASERVICE-006, TASK-DATASERVICE-007, TASK-DATASERVICE-008, TASK-DATASERVICE-009, TASK-DATASERVICE-010, TASK-DATASERVICE-011, TASK-DATASERVICE-012, TASK-DATASERVICE-013, TASK-DATASERVICE-014, TASK-DATASERVICE-015, TASK-DATASERVICE-016`.
  - Commands: `CMD-DATASERVICE-066, CMD-DATASERVICE-067, CMD-DATASERVICE-068, CMD-DATASERVICE-069, CMD-DATASERVICE-070, CMD-DATASERVICE-071, CMD-DATASERVICE-003, CMD-DATASERVICE-004, CMD-DATASERVICE-005, CMD-DATASERVICE-006, CMD-DATASERVICE-007, CMD-DATASERVICE-008, CMD-DATASERVICE-009, CMD-DATASERVICE-010, CMD-DATASERVICE-011, CMD-DATASERVICE-012, CMD-DATASERVICE-013, CMD-DATASERVICE-014, CMD-DATASERVICE-015, CMD-DATASERVICE-016, CMD-DATASERVICE-017, CMD-DATASERVICE-018, CMD-DATASERVICE-019, CMD-DATASERVICE-020, CMD-DATASERVICE-021, CMD-DATASERVICE-022, CMD-DATASERVICE-023, CMD-DATASERVICE-024, CMD-DATASERVICE-025, CMD-DATASERVICE-026, CMD-DATASERVICE-027, CMD-DATASERVICE-028, CMD-DATASERVICE-029, CMD-DATASERVICE-030, CMD-DATASERVICE-031, CMD-DATASERVICE-032, CMD-DATASERVICE-033, CMD-DATASERVICE-034, CMD-DATASERVICE-035, CMD-DATASERVICE-036, CMD-DATASERVICE-037, CMD-DATASERVICE-038, CMD-DATASERVICE-039, CMD-DATASERVICE-040, CMD-DATASERVICE-041, CMD-DATASERVICE-042, CMD-DATASERVICE-087, CMD-DATASERVICE-090, CMD-DATASERVICE-053, CMD-DATASERVICE-056, CMD-DATASERVICE-059, CMD-DATASERVICE-062, CMD-DATASERVICE-065, CMD-DATASERVICE-074, CMD-DATASERVICE-077, CMD-DATASERVICE-080, CMD-DATASERVICE-083, CMD-DATASERVICE-086, CMD-DATASERVICE-092`.
  - Evidence: `EVD-DATASERVICE-008, EVD-DATASERVICE-009, EVD-DATASERVICE-015, EVD-DATASERVICE-016, EVD-DATASERVICE-029`.

- AC-DATASERVICE-013-S02:
> pass 用户看到缺口而非跨缺口连线或伪造k线 其他segment仍显示
  - Tasks: `TASK-DATASERVICE-001, TASK-DATASERVICE-002, TASK-DATASERVICE-003, TASK-DATASERVICE-004, TASK-DATASERVICE-005, TASK-DATASERVICE-006, TASK-DATASERVICE-007, TASK-DATASERVICE-008, TASK-DATASERVICE-009, TASK-DATASERVICE-010, TASK-DATASERVICE-011, TASK-DATASERVICE-012, TASK-DATASERVICE-013, TASK-DATASERVICE-014, TASK-DATASERVICE-015, TASK-DATASERVICE-016`.
  - Commands: `CMD-DATASERVICE-057, CMD-DATASERVICE-058, CMD-DATASERVICE-059, CMD-DATASERVICE-063, CMD-DATASERVICE-064, CMD-DATASERVICE-065, CMD-DATASERVICE-066, CMD-DATASERVICE-067, CMD-DATASERVICE-068, CMD-DATASERVICE-069, CMD-DATASERVICE-070, CMD-DATASERVICE-071, CMD-DATASERVICE-003, CMD-DATASERVICE-004, CMD-DATASERVICE-005, CMD-DATASERVICE-006, CMD-DATASERVICE-007, CMD-DATASERVICE-008, CMD-DATASERVICE-009, CMD-DATASERVICE-010, CMD-DATASERVICE-011, CMD-DATASERVICE-012, CMD-DATASERVICE-013, CMD-DATASERVICE-014, CMD-DATASERVICE-015, CMD-DATASERVICE-016, CMD-DATASERVICE-017, CMD-DATASERVICE-018, CMD-DATASERVICE-019, CMD-DATASERVICE-020, CMD-DATASERVICE-021, CMD-DATASERVICE-022, CMD-DATASERVICE-023, CMD-DATASERVICE-024, CMD-DATASERVICE-025, CMD-DATASERVICE-026, CMD-DATASERVICE-027, CMD-DATASERVICE-028, CMD-DATASERVICE-029, CMD-DATASERVICE-030, CMD-DATASERVICE-031, CMD-DATASERVICE-032, CMD-DATASERVICE-033, CMD-DATASERVICE-034, CMD-DATASERVICE-035, CMD-DATASERVICE-036, CMD-DATASERVICE-037, CMD-DATASERVICE-038, CMD-DATASERVICE-039, CMD-DATASERVICE-040, CMD-DATASERVICE-041, CMD-DATASERVICE-042, CMD-DATASERVICE-087, CMD-DATASERVICE-090, CMD-DATASERVICE-053, CMD-DATASERVICE-056, CMD-DATASERVICE-062, CMD-DATASERVICE-074, CMD-DATASERVICE-077, CMD-DATASERVICE-080, CMD-DATASERVICE-083, CMD-DATASERVICE-086, CMD-DATASERVICE-092`.
  - Evidence: `EVD-DATASERVICE-005, EVD-DATASERVICE-007, EVD-DATASERVICE-008, EVD-DATASERVICE-009, EVD-DATASERVICE-015, EVD-DATASERVICE-016, EVD-DATASERVICE-042`.

- AC-DATASERVICE-014-S01:
> pass dataservice收到recorder config命令次数为0 非active实时订阅增加数为0
  - Tasks: `TASK-DATASERVICE-001, TASK-DATASERVICE-002, TASK-DATASERVICE-003, TASK-DATASERVICE-004, TASK-DATASERVICE-005, TASK-DATASERVICE-006, TASK-DATASERVICE-007, TASK-DATASERVICE-008, TASK-DATASERVICE-009, TASK-DATASERVICE-010, TASK-DATASERVICE-011, TASK-DATASERVICE-012, TASK-DATASERVICE-013, TASK-DATASERVICE-014, TASK-DATASERVICE-015, TASK-DATASERVICE-016`.
  - Commands: `CMD-DATASERVICE-072, CMD-DATASERVICE-073, CMD-DATASERVICE-074, CMD-DATASERVICE-075, CMD-DATASERVICE-076, CMD-DATASERVICE-077, CMD-DATASERVICE-003, CMD-DATASERVICE-004, CMD-DATASERVICE-005, CMD-DATASERVICE-006, CMD-DATASERVICE-007, CMD-DATASERVICE-008, CMD-DATASERVICE-009, CMD-DATASERVICE-010, CMD-DATASERVICE-011, CMD-DATASERVICE-012, CMD-DATASERVICE-013, CMD-DATASERVICE-014, CMD-DATASERVICE-015, CMD-DATASERVICE-016, CMD-DATASERVICE-017, CMD-DATASERVICE-018, CMD-DATASERVICE-019, CMD-DATASERVICE-020, CMD-DATASERVICE-021, CMD-DATASERVICE-022, CMD-DATASERVICE-023, CMD-DATASERVICE-024, CMD-DATASERVICE-025, CMD-DATASERVICE-026, CMD-DATASERVICE-027, CMD-DATASERVICE-028, CMD-DATASERVICE-029, CMD-DATASERVICE-030, CMD-DATASERVICE-031, CMD-DATASERVICE-032, CMD-DATASERVICE-033, CMD-DATASERVICE-034, CMD-DATASERVICE-035, CMD-DATASERVICE-036, CMD-DATASERVICE-037, CMD-DATASERVICE-038, CMD-DATASERVICE-039, CMD-DATASERVICE-040, CMD-DATASERVICE-041, CMD-DATASERVICE-042, CMD-DATASERVICE-087, CMD-DATASERVICE-090, CMD-DATASERVICE-053, CMD-DATASERVICE-056, CMD-DATASERVICE-059, CMD-DATASERVICE-062, CMD-DATASERVICE-065, CMD-DATASERVICE-068, CMD-DATASERVICE-071, CMD-DATASERVICE-080, CMD-DATASERVICE-083, CMD-DATASERVICE-086, CMD-DATASERVICE-092`.
  - Evidence: `EVD-DATASERVICE-010, EVD-DATASERVICE-011, EVD-DATASERVICE-015, EVD-DATASERVICE-016, EVD-DATASERVICE-030`.

- AC-DATASERVICE-015-S01:
> pass 日志 统计 db rows selected/skipped persistence group durable状态 checkpoint和ack逐项对应真实操作
  - Tasks: `TASK-DATASERVICE-001, TASK-DATASERVICE-002, TASK-DATASERVICE-003, TASK-DATASERVICE-004, TASK-DATASERVICE-005, TASK-DATASERVICE-006, TASK-DATASERVICE-007, TASK-DATASERVICE-008, TASK-DATASERVICE-009, TASK-DATASERVICE-010, TASK-DATASERVICE-011, TASK-DATASERVICE-012, TASK-DATASERVICE-013, TASK-DATASERVICE-014, TASK-DATASERVICE-015, TASK-DATASERVICE-016`.
  - Commands: `CMD-DATASERVICE-045, CMD-DATASERVICE-046, CMD-DATASERVICE-047, CMD-DATASERVICE-060, CMD-DATASERVICE-061, CMD-DATASERVICE-062, CMD-DATASERVICE-072, CMD-DATASERVICE-073, CMD-DATASERVICE-074, CMD-DATASERVICE-075, CMD-DATASERVICE-076, CMD-DATASERVICE-077, CMD-DATASERVICE-003, CMD-DATASERVICE-004, CMD-DATASERVICE-005, CMD-DATASERVICE-006, CMD-DATASERVICE-007, CMD-DATASERVICE-008, CMD-DATASERVICE-009, CMD-DATASERVICE-010, CMD-DATASERVICE-011, CMD-DATASERVICE-012, CMD-DATASERVICE-013, CMD-DATASERVICE-014, CMD-DATASERVICE-015, CMD-DATASERVICE-016, CMD-DATASERVICE-017, CMD-DATASERVICE-018, CMD-DATASERVICE-019, CMD-DATASERVICE-020, CMD-DATASERVICE-021, CMD-DATASERVICE-022, CMD-DATASERVICE-023, CMD-DATASERVICE-024, CMD-DATASERVICE-025, CMD-DATASERVICE-026, CMD-DATASERVICE-027, CMD-DATASERVICE-028, CMD-DATASERVICE-029, CMD-DATASERVICE-030, CMD-DATASERVICE-031, CMD-DATASERVICE-032, CMD-DATASERVICE-033, CMD-DATASERVICE-034, CMD-DATASERVICE-035, CMD-DATASERVICE-036, CMD-DATASERVICE-037, CMD-DATASERVICE-038, CMD-DATASERVICE-039, CMD-DATASERVICE-040, CMD-DATASERVICE-041, CMD-DATASERVICE-042, CMD-DATASERVICE-087, CMD-DATASERVICE-090, CMD-DATASERVICE-053, CMD-DATASERVICE-056, CMD-DATASERVICE-059, CMD-DATASERVICE-065, CMD-DATASERVICE-068, CMD-DATASERVICE-071, CMD-DATASERVICE-080, CMD-DATASERVICE-083, CMD-DATASERVICE-086, CMD-DATASERVICE-092`.
  - Evidence: `EVD-DATASERVICE-001, EVD-DATASERVICE-006, EVD-DATASERVICE-010, EVD-DATASERVICE-011, EVD-DATASERVICE-015, EVD-DATASERVICE-016, EVD-DATASERVICE-031`.

- AC-DATASERVICE-016-S01:
> pass checkpoint未越过未commit batch 重启后无sequence hole
  - Tasks: `TASK-DATASERVICE-001, TASK-DATASERVICE-002, TASK-DATASERVICE-003, TASK-DATASERVICE-004, TASK-DATASERVICE-005, TASK-DATASERVICE-006, TASK-DATASERVICE-007, TASK-DATASERVICE-008, TASK-DATASERVICE-009, TASK-DATASERVICE-010, TASK-DATASERVICE-011, TASK-DATASERVICE-012, TASK-DATASERVICE-013, TASK-DATASERVICE-014, TASK-DATASERVICE-015, TASK-DATASERVICE-016`.
  - Commands: `CMD-DATASERVICE-048, CMD-DATASERVICE-049, CMD-DATASERVICE-050, CMD-DATASERVICE-060, CMD-DATASERVICE-061, CMD-DATASERVICE-062, CMD-DATASERVICE-075, CMD-DATASERVICE-076, CMD-DATASERVICE-077, CMD-DATASERVICE-003, CMD-DATASERVICE-004, CMD-DATASERVICE-005, CMD-DATASERVICE-006, CMD-DATASERVICE-007, CMD-DATASERVICE-008, CMD-DATASERVICE-009, CMD-DATASERVICE-010, CMD-DATASERVICE-011, CMD-DATASERVICE-012, CMD-DATASERVICE-013, CMD-DATASERVICE-014, CMD-DATASERVICE-015, CMD-DATASERVICE-016, CMD-DATASERVICE-017, CMD-DATASERVICE-018, CMD-DATASERVICE-019, CMD-DATASERVICE-020, CMD-DATASERVICE-021, CMD-DATASERVICE-022, CMD-DATASERVICE-023, CMD-DATASERVICE-024, CMD-DATASERVICE-025, CMD-DATASERVICE-026, CMD-DATASERVICE-027, CMD-DATASERVICE-028, CMD-DATASERVICE-029, CMD-DATASERVICE-030, CMD-DATASERVICE-031, CMD-DATASERVICE-032, CMD-DATASERVICE-033, CMD-DATASERVICE-034, CMD-DATASERVICE-035, CMD-DATASERVICE-036, CMD-DATASERVICE-037, CMD-DATASERVICE-038, CMD-DATASERVICE-039, CMD-DATASERVICE-040, CMD-DATASERVICE-041, CMD-DATASERVICE-042, CMD-DATASERVICE-087, CMD-DATASERVICE-090, CMD-DATASERVICE-053, CMD-DATASERVICE-056, CMD-DATASERVICE-059, CMD-DATASERVICE-065, CMD-DATASERVICE-068, CMD-DATASERVICE-071, CMD-DATASERVICE-074, CMD-DATASERVICE-080, CMD-DATASERVICE-083, CMD-DATASERVICE-086, CMD-DATASERVICE-092`.
  - Evidence: `EVD-DATASERVICE-002, EVD-DATASERVICE-006, EVD-DATASERVICE-011, EVD-DATASERVICE-015, EVD-DATASERVICE-016, EVD-DATASERVICE-032`.

- AC-DATASERVICE-016-S02:
> pass db每identity一行且事务字段完全相同
  - Tasks: `TASK-DATASERVICE-001, TASK-DATASERVICE-002, TASK-DATASERVICE-003, TASK-DATASERVICE-004, TASK-DATASERVICE-005, TASK-DATASERVICE-006, TASK-DATASERVICE-007, TASK-DATASERVICE-008, TASK-DATASERVICE-009, TASK-DATASERVICE-010, TASK-DATASERVICE-011, TASK-DATASERVICE-012, TASK-DATASERVICE-013, TASK-DATASERVICE-014, TASK-DATASERVICE-015, TASK-DATASERVICE-016`.
  - Commands: `CMD-DATASERVICE-060, CMD-DATASERVICE-061, CMD-DATASERVICE-062, CMD-DATASERVICE-075, CMD-DATASERVICE-076, CMD-DATASERVICE-077, CMD-DATASERVICE-003, CMD-DATASERVICE-004, CMD-DATASERVICE-005, CMD-DATASERVICE-006, CMD-DATASERVICE-007, CMD-DATASERVICE-008, CMD-DATASERVICE-009, CMD-DATASERVICE-010, CMD-DATASERVICE-011, CMD-DATASERVICE-012, CMD-DATASERVICE-013, CMD-DATASERVICE-014, CMD-DATASERVICE-015, CMD-DATASERVICE-016, CMD-DATASERVICE-017, CMD-DATASERVICE-018, CMD-DATASERVICE-019, CMD-DATASERVICE-020, CMD-DATASERVICE-021, CMD-DATASERVICE-022, CMD-DATASERVICE-023, CMD-DATASERVICE-024, CMD-DATASERVICE-025, CMD-DATASERVICE-026, CMD-DATASERVICE-027, CMD-DATASERVICE-028, CMD-DATASERVICE-029, CMD-DATASERVICE-030, CMD-DATASERVICE-031, CMD-DATASERVICE-032, CMD-DATASERVICE-033, CMD-DATASERVICE-034, CMD-DATASERVICE-035, CMD-DATASERVICE-036, CMD-DATASERVICE-037, CMD-DATASERVICE-038, CMD-DATASERVICE-039, CMD-DATASERVICE-040, CMD-DATASERVICE-041, CMD-DATASERVICE-042, CMD-DATASERVICE-087, CMD-DATASERVICE-090, CMD-DATASERVICE-053, CMD-DATASERVICE-056, CMD-DATASERVICE-059, CMD-DATASERVICE-065, CMD-DATASERVICE-068, CMD-DATASERVICE-071, CMD-DATASERVICE-074, CMD-DATASERVICE-080, CMD-DATASERVICE-083, CMD-DATASERVICE-086, CMD-DATASERVICE-092`.
  - Evidence: `EVD-DATASERVICE-006, EVD-DATASERVICE-011, EVD-DATASERVICE-015, EVD-DATASERVICE-016, EVD-DATASERVICE-043`.

- AC-DATASERVICE-016-S03:
> pass db不变 checkpoint不回退 producer释放该batch等待状态
  - Tasks: `TASK-DATASERVICE-001, TASK-DATASERVICE-002, TASK-DATASERVICE-003, TASK-DATASERVICE-004, TASK-DATASERVICE-005, TASK-DATASERVICE-006, TASK-DATASERVICE-007, TASK-DATASERVICE-008, TASK-DATASERVICE-009, TASK-DATASERVICE-010, TASK-DATASERVICE-011, TASK-DATASERVICE-012, TASK-DATASERVICE-013, TASK-DATASERVICE-014, TASK-DATASERVICE-015, TASK-DATASERVICE-016`.
  - Commands: `CMD-DATASERVICE-060, CMD-DATASERVICE-061, CMD-DATASERVICE-062, CMD-DATASERVICE-075, CMD-DATASERVICE-076, CMD-DATASERVICE-077, CMD-DATASERVICE-003, CMD-DATASERVICE-004, CMD-DATASERVICE-005, CMD-DATASERVICE-006, CMD-DATASERVICE-007, CMD-DATASERVICE-008, CMD-DATASERVICE-009, CMD-DATASERVICE-010, CMD-DATASERVICE-011, CMD-DATASERVICE-012, CMD-DATASERVICE-013, CMD-DATASERVICE-014, CMD-DATASERVICE-015, CMD-DATASERVICE-016, CMD-DATASERVICE-017, CMD-DATASERVICE-018, CMD-DATASERVICE-019, CMD-DATASERVICE-020, CMD-DATASERVICE-021, CMD-DATASERVICE-022, CMD-DATASERVICE-023, CMD-DATASERVICE-024, CMD-DATASERVICE-025, CMD-DATASERVICE-026, CMD-DATASERVICE-027, CMD-DATASERVICE-028, CMD-DATASERVICE-029, CMD-DATASERVICE-030, CMD-DATASERVICE-031, CMD-DATASERVICE-032, CMD-DATASERVICE-033, CMD-DATASERVICE-034, CMD-DATASERVICE-035, CMD-DATASERVICE-036, CMD-DATASERVICE-037, CMD-DATASERVICE-038, CMD-DATASERVICE-039, CMD-DATASERVICE-040, CMD-DATASERVICE-041, CMD-DATASERVICE-042, CMD-DATASERVICE-087, CMD-DATASERVICE-090, CMD-DATASERVICE-053, CMD-DATASERVICE-056, CMD-DATASERVICE-059, CMD-DATASERVICE-065, CMD-DATASERVICE-068, CMD-DATASERVICE-071, CMD-DATASERVICE-074, CMD-DATASERVICE-080, CMD-DATASERVICE-083, CMD-DATASERVICE-086, CMD-DATASERVICE-092`.
  - Evidence: `EVD-DATASERVICE-006, EVD-DATASERVICE-011, EVD-DATASERVICE-015, EVD-DATASERVICE-016, EVD-DATASERVICE-044`.

- AC-DATASERVICE-016-S04:
> pass 配置生效边界是首次消费 崩溃不改变旧决定
  - Tasks: `TASK-DATASERVICE-001, TASK-DATASERVICE-002, TASK-DATASERVICE-003, TASK-DATASERVICE-004, TASK-DATASERVICE-005, TASK-DATASERVICE-006, TASK-DATASERVICE-007, TASK-DATASERVICE-008, TASK-DATASERVICE-009, TASK-DATASERVICE-010, TASK-DATASERVICE-011, TASK-DATASERVICE-012, TASK-DATASERVICE-013, TASK-DATASERVICE-014, TASK-DATASERVICE-015, TASK-DATASERVICE-016`.
  - Commands: `CMD-DATASERVICE-060, CMD-DATASERVICE-061, CMD-DATASERVICE-062, CMD-DATASERVICE-072, CMD-DATASERVICE-073, CMD-DATASERVICE-074, CMD-DATASERVICE-075, CMD-DATASERVICE-076, CMD-DATASERVICE-077, CMD-DATASERVICE-003, CMD-DATASERVICE-004, CMD-DATASERVICE-005, CMD-DATASERVICE-006, CMD-DATASERVICE-007, CMD-DATASERVICE-008, CMD-DATASERVICE-009, CMD-DATASERVICE-010, CMD-DATASERVICE-011, CMD-DATASERVICE-012, CMD-DATASERVICE-013, CMD-DATASERVICE-014, CMD-DATASERVICE-015, CMD-DATASERVICE-016, CMD-DATASERVICE-017, CMD-DATASERVICE-018, CMD-DATASERVICE-019, CMD-DATASERVICE-020, CMD-DATASERVICE-021, CMD-DATASERVICE-022, CMD-DATASERVICE-023, CMD-DATASERVICE-024, CMD-DATASERVICE-025, CMD-DATASERVICE-026, CMD-DATASERVICE-027, CMD-DATASERVICE-028, CMD-DATASERVICE-029, CMD-DATASERVICE-030, CMD-DATASERVICE-031, CMD-DATASERVICE-032, CMD-DATASERVICE-033, CMD-DATASERVICE-034, CMD-DATASERVICE-035, CMD-DATASERVICE-036, CMD-DATASERVICE-037, CMD-DATASERVICE-038, CMD-DATASERVICE-039, CMD-DATASERVICE-040, CMD-DATASERVICE-041, CMD-DATASERVICE-042, CMD-DATASERVICE-087, CMD-DATASERVICE-090, CMD-DATASERVICE-053, CMD-DATASERVICE-056, CMD-DATASERVICE-059, CMD-DATASERVICE-065, CMD-DATASERVICE-068, CMD-DATASERVICE-071, CMD-DATASERVICE-080, CMD-DATASERVICE-083, CMD-DATASERVICE-086, CMD-DATASERVICE-092`.
  - Evidence: `EVD-DATASERVICE-006, EVD-DATASERVICE-010, EVD-DATASERVICE-011, EVD-DATASERVICE-015, EVD-DATASERVICE-016, EVD-DATASERVICE-045`.

- AC-DATASERVICE-017-S01:
> pass dataservice shared completed直接调用策略bar callback次数为0
  - Tasks: `TASK-DATASERVICE-001, TASK-DATASERVICE-002, TASK-DATASERVICE-003, TASK-DATASERVICE-004, TASK-DATASERVICE-005, TASK-DATASERVICE-006, TASK-DATASERVICE-007, TASK-DATASERVICE-008, TASK-DATASERVICE-009, TASK-DATASERVICE-010, TASK-DATASERVICE-011, TASK-DATASERVICE-012, TASK-DATASERVICE-013, TASK-DATASERVICE-014, TASK-DATASERVICE-015, TASK-DATASERVICE-016`.
  - Commands: `CMD-DATASERVICE-045, CMD-DATASERVICE-046, CMD-DATASERVICE-047, CMD-DATASERVICE-078, CMD-DATASERVICE-079, CMD-DATASERVICE-080, CMD-DATASERVICE-003, CMD-DATASERVICE-004, CMD-DATASERVICE-005, CMD-DATASERVICE-006, CMD-DATASERVICE-007, CMD-DATASERVICE-008, CMD-DATASERVICE-009, CMD-DATASERVICE-010, CMD-DATASERVICE-011, CMD-DATASERVICE-012, CMD-DATASERVICE-013, CMD-DATASERVICE-014, CMD-DATASERVICE-015, CMD-DATASERVICE-016, CMD-DATASERVICE-017, CMD-DATASERVICE-018, CMD-DATASERVICE-019, CMD-DATASERVICE-020, CMD-DATASERVICE-021, CMD-DATASERVICE-022, CMD-DATASERVICE-023, CMD-DATASERVICE-024, CMD-DATASERVICE-025, CMD-DATASERVICE-026, CMD-DATASERVICE-027, CMD-DATASERVICE-028, CMD-DATASERVICE-029, CMD-DATASERVICE-030, CMD-DATASERVICE-031, CMD-DATASERVICE-032, CMD-DATASERVICE-033, CMD-DATASERVICE-034, CMD-DATASERVICE-035, CMD-DATASERVICE-036, CMD-DATASERVICE-037, CMD-DATASERVICE-038, CMD-DATASERVICE-039, CMD-DATASERVICE-040, CMD-DATASERVICE-041, CMD-DATASERVICE-042, CMD-DATASERVICE-087, CMD-DATASERVICE-090, CMD-DATASERVICE-053, CMD-DATASERVICE-056, CMD-DATASERVICE-059, CMD-DATASERVICE-062, CMD-DATASERVICE-065, CMD-DATASERVICE-068, CMD-DATASERVICE-071, CMD-DATASERVICE-074, CMD-DATASERVICE-077, CMD-DATASERVICE-083, CMD-DATASERVICE-086, CMD-DATASERVICE-092`.
  - Evidence: `EVD-DATASERVICE-001, EVD-DATASERVICE-012, EVD-DATASERVICE-015, EVD-DATASERVICE-016, EVD-DATASERVICE-033`.

- AC-DATASERVICE-018-S01:
> pass 不依赖100ms ui轮询也能读取最新tick
  - Tasks: `TASK-DATASERVICE-001, TASK-DATASERVICE-002, TASK-DATASERVICE-003, TASK-DATASERVICE-004, TASK-DATASERVICE-005, TASK-DATASERVICE-006, TASK-DATASERVICE-007, TASK-DATASERVICE-008, TASK-DATASERVICE-009, TASK-DATASERVICE-010, TASK-DATASERVICE-011, TASK-DATASERVICE-012, TASK-DATASERVICE-013, TASK-DATASERVICE-014, TASK-DATASERVICE-015, TASK-DATASERVICE-016`.
  - Commands: `CMD-DATASERVICE-045, CMD-DATASERVICE-046, CMD-DATASERVICE-047, CMD-DATASERVICE-078, CMD-DATASERVICE-079, CMD-DATASERVICE-080, CMD-DATASERVICE-003, CMD-DATASERVICE-004, CMD-DATASERVICE-005, CMD-DATASERVICE-006, CMD-DATASERVICE-007, CMD-DATASERVICE-008, CMD-DATASERVICE-009, CMD-DATASERVICE-010, CMD-DATASERVICE-011, CMD-DATASERVICE-012, CMD-DATASERVICE-013, CMD-DATASERVICE-014, CMD-DATASERVICE-015, CMD-DATASERVICE-016, CMD-DATASERVICE-017, CMD-DATASERVICE-018, CMD-DATASERVICE-019, CMD-DATASERVICE-020, CMD-DATASERVICE-021, CMD-DATASERVICE-022, CMD-DATASERVICE-023, CMD-DATASERVICE-024, CMD-DATASERVICE-025, CMD-DATASERVICE-026, CMD-DATASERVICE-027, CMD-DATASERVICE-028, CMD-DATASERVICE-029, CMD-DATASERVICE-030, CMD-DATASERVICE-031, CMD-DATASERVICE-032, CMD-DATASERVICE-033, CMD-DATASERVICE-034, CMD-DATASERVICE-035, CMD-DATASERVICE-036, CMD-DATASERVICE-037, CMD-DATASERVICE-038, CMD-DATASERVICE-039, CMD-DATASERVICE-040, CMD-DATASERVICE-041, CMD-DATASERVICE-042, CMD-DATASERVICE-087, CMD-DATASERVICE-090, CMD-DATASERVICE-053, CMD-DATASERVICE-056, CMD-DATASERVICE-059, CMD-DATASERVICE-062, CMD-DATASERVICE-065, CMD-DATASERVICE-068, CMD-DATASERVICE-071, CMD-DATASERVICE-074, CMD-DATASERVICE-077, CMD-DATASERVICE-083, CMD-DATASERVICE-086, CMD-DATASERVICE-092`.
  - Evidence: `EVD-DATASERVICE-001, EVD-DATASERVICE-012, EVD-DATASERVICE-015, EVD-DATASERVICE-016, EVD-DATASERVICE-034`.

- AC-DATASERVICE-019-S01:
> pass 同一tick不造成重复replace 旧actual tick被拒绝
  - Tasks: `TASK-DATASERVICE-001, TASK-DATASERVICE-002, TASK-DATASERVICE-003, TASK-DATASERVICE-004, TASK-DATASERVICE-005, TASK-DATASERVICE-006, TASK-DATASERVICE-007, TASK-DATASERVICE-008, TASK-DATASERVICE-009, TASK-DATASERVICE-010, TASK-DATASERVICE-011, TASK-DATASERVICE-012, TASK-DATASERVICE-013, TASK-DATASERVICE-014, TASK-DATASERVICE-015, TASK-DATASERVICE-016`.
  - Commands: `CMD-DATASERVICE-045, CMD-DATASERVICE-046, CMD-DATASERVICE-047, CMD-DATASERVICE-051, CMD-DATASERVICE-052, CMD-DATASERVICE-053, CMD-DATASERVICE-078, CMD-DATASERVICE-079, CMD-DATASERVICE-080, CMD-DATASERVICE-003, CMD-DATASERVICE-004, CMD-DATASERVICE-005, CMD-DATASERVICE-006, CMD-DATASERVICE-007, CMD-DATASERVICE-008, CMD-DATASERVICE-009, CMD-DATASERVICE-010, CMD-DATASERVICE-011, CMD-DATASERVICE-012, CMD-DATASERVICE-013, CMD-DATASERVICE-014, CMD-DATASERVICE-015, CMD-DATASERVICE-016, CMD-DATASERVICE-017, CMD-DATASERVICE-018, CMD-DATASERVICE-019, CMD-DATASERVICE-020, CMD-DATASERVICE-021, CMD-DATASERVICE-022, CMD-DATASERVICE-023, CMD-DATASERVICE-024, CMD-DATASERVICE-025, CMD-DATASERVICE-026, CMD-DATASERVICE-027, CMD-DATASERVICE-028, CMD-DATASERVICE-029, CMD-DATASERVICE-030, CMD-DATASERVICE-031, CMD-DATASERVICE-032, CMD-DATASERVICE-033, CMD-DATASERVICE-034, CMD-DATASERVICE-035, CMD-DATASERVICE-036, CMD-DATASERVICE-037, CMD-DATASERVICE-038, CMD-DATASERVICE-039, CMD-DATASERVICE-040, CMD-DATASERVICE-041, CMD-DATASERVICE-042, CMD-DATASERVICE-087, CMD-DATASERVICE-090, CMD-DATASERVICE-056, CMD-DATASERVICE-059, CMD-DATASERVICE-062, CMD-DATASERVICE-065, CMD-DATASERVICE-068, CMD-DATASERVICE-071, CMD-DATASERVICE-074, CMD-DATASERVICE-077, CMD-DATASERVICE-083, CMD-DATASERVICE-086, CMD-DATASERVICE-092`.
  - Evidence: `EVD-DATASERVICE-001, EVD-DATASERVICE-003, EVD-DATASERVICE-012, EVD-DATASERVICE-015, EVD-DATASERVICE-016, EVD-DATASERVICE-035`.

- AC-DATASERVICE-020-S01:
> pass ack后pending清除 trigger继续处理新tick
  - Tasks: `TASK-DATASERVICE-001, TASK-DATASERVICE-002, TASK-DATASERVICE-003, TASK-DATASERVICE-004, TASK-DATASERVICE-005, TASK-DATASERVICE-006, TASK-DATASERVICE-007, TASK-DATASERVICE-008, TASK-DATASERVICE-009, TASK-DATASERVICE-010, TASK-DATASERVICE-011, TASK-DATASERVICE-012, TASK-DATASERVICE-013, TASK-DATASERVICE-014, TASK-DATASERVICE-015, TASK-DATASERVICE-016`.
  - Commands: `CMD-DATASERVICE-081, CMD-DATASERVICE-082, CMD-DATASERVICE-083, CMD-DATASERVICE-003, CMD-DATASERVICE-004, CMD-DATASERVICE-005, CMD-DATASERVICE-006, CMD-DATASERVICE-007, CMD-DATASERVICE-008, CMD-DATASERVICE-009, CMD-DATASERVICE-010, CMD-DATASERVICE-011, CMD-DATASERVICE-012, CMD-DATASERVICE-013, CMD-DATASERVICE-014, CMD-DATASERVICE-015, CMD-DATASERVICE-016, CMD-DATASERVICE-017, CMD-DATASERVICE-018, CMD-DATASERVICE-019, CMD-DATASERVICE-020, CMD-DATASERVICE-021, CMD-DATASERVICE-022, CMD-DATASERVICE-023, CMD-DATASERVICE-024, CMD-DATASERVICE-025, CMD-DATASERVICE-026, CMD-DATASERVICE-027, CMD-DATASERVICE-028, CMD-DATASERVICE-029, CMD-DATASERVICE-030, CMD-DATASERVICE-031, CMD-DATASERVICE-032, CMD-DATASERVICE-033, CMD-DATASERVICE-034, CMD-DATASERVICE-035, CMD-DATASERVICE-036, CMD-DATASERVICE-037, CMD-DATASERVICE-038, CMD-DATASERVICE-039, CMD-DATASERVICE-040, CMD-DATASERVICE-041, CMD-DATASERVICE-042, CMD-DATASERVICE-087, CMD-DATASERVICE-090, CMD-DATASERVICE-053, CMD-DATASERVICE-056, CMD-DATASERVICE-059, CMD-DATASERVICE-062, CMD-DATASERVICE-065, CMD-DATASERVICE-068, CMD-DATASERVICE-071, CMD-DATASERVICE-074, CMD-DATASERVICE-077, CMD-DATASERVICE-080, CMD-DATASERVICE-086, CMD-DATASERVICE-092`.
  - Evidence: `EVD-DATASERVICE-013, EVD-DATASERVICE-015, EVD-DATASERVICE-016, EVD-DATASERVICE-036`.

- AC-DATASERVICE-020-S02:
> pass 保护不会在三次后永久停止 ack恢复后状态回到ready
  - Tasks: `TASK-DATASERVICE-001, TASK-DATASERVICE-002, TASK-DATASERVICE-003, TASK-DATASERVICE-004, TASK-DATASERVICE-005, TASK-DATASERVICE-006, TASK-DATASERVICE-007, TASK-DATASERVICE-008, TASK-DATASERVICE-009, TASK-DATASERVICE-010, TASK-DATASERVICE-011, TASK-DATASERVICE-012, TASK-DATASERVICE-013, TASK-DATASERVICE-014, TASK-DATASERVICE-015, TASK-DATASERVICE-016`.
  - Commands: `CMD-DATASERVICE-081, CMD-DATASERVICE-082, CMD-DATASERVICE-083, CMD-DATASERVICE-003, CMD-DATASERVICE-004, CMD-DATASERVICE-005, CMD-DATASERVICE-006, CMD-DATASERVICE-007, CMD-DATASERVICE-008, CMD-DATASERVICE-009, CMD-DATASERVICE-010, CMD-DATASERVICE-011, CMD-DATASERVICE-012, CMD-DATASERVICE-013, CMD-DATASERVICE-014, CMD-DATASERVICE-015, CMD-DATASERVICE-016, CMD-DATASERVICE-017, CMD-DATASERVICE-018, CMD-DATASERVICE-019, CMD-DATASERVICE-020, CMD-DATASERVICE-021, CMD-DATASERVICE-022, CMD-DATASERVICE-023, CMD-DATASERVICE-024, CMD-DATASERVICE-025, CMD-DATASERVICE-026, CMD-DATASERVICE-027, CMD-DATASERVICE-028, CMD-DATASERVICE-029, CMD-DATASERVICE-030, CMD-DATASERVICE-031, CMD-DATASERVICE-032, CMD-DATASERVICE-033, CMD-DATASERVICE-034, CMD-DATASERVICE-035, CMD-DATASERVICE-036, CMD-DATASERVICE-037, CMD-DATASERVICE-038, CMD-DATASERVICE-039, CMD-DATASERVICE-040, CMD-DATASERVICE-041, CMD-DATASERVICE-042, CMD-DATASERVICE-087, CMD-DATASERVICE-090, CMD-DATASERVICE-053, CMD-DATASERVICE-056, CMD-DATASERVICE-059, CMD-DATASERVICE-062, CMD-DATASERVICE-065, CMD-DATASERVICE-068, CMD-DATASERVICE-071, CMD-DATASERVICE-074, CMD-DATASERVICE-077, CMD-DATASERVICE-080, CMD-DATASERVICE-086, CMD-DATASERVICE-092`.
  - Evidence: `EVD-DATASERVICE-013, EVD-DATASERVICE-015, EVD-DATASERVICE-016, EVD-DATASERVICE-046`.

- AC-DATASERVICE-020-S03:
> pass 恢复后继续逐tick保护且没有补造历史tick
  - Tasks: `TASK-DATASERVICE-001, TASK-DATASERVICE-002, TASK-DATASERVICE-003, TASK-DATASERVICE-004, TASK-DATASERVICE-005, TASK-DATASERVICE-006, TASK-DATASERVICE-007, TASK-DATASERVICE-008, TASK-DATASERVICE-009, TASK-DATASERVICE-010, TASK-DATASERVICE-011, TASK-DATASERVICE-012, TASK-DATASERVICE-013, TASK-DATASERVICE-014, TASK-DATASERVICE-015, TASK-DATASERVICE-016`.
  - Commands: `CMD-DATASERVICE-078, CMD-DATASERVICE-079, CMD-DATASERVICE-080, CMD-DATASERVICE-081, CMD-DATASERVICE-082, CMD-DATASERVICE-083, CMD-DATASERVICE-003, CMD-DATASERVICE-004, CMD-DATASERVICE-005, CMD-DATASERVICE-006, CMD-DATASERVICE-007, CMD-DATASERVICE-008, CMD-DATASERVICE-009, CMD-DATASERVICE-010, CMD-DATASERVICE-011, CMD-DATASERVICE-012, CMD-DATASERVICE-013, CMD-DATASERVICE-014, CMD-DATASERVICE-015, CMD-DATASERVICE-016, CMD-DATASERVICE-017, CMD-DATASERVICE-018, CMD-DATASERVICE-019, CMD-DATASERVICE-020, CMD-DATASERVICE-021, CMD-DATASERVICE-022, CMD-DATASERVICE-023, CMD-DATASERVICE-024, CMD-DATASERVICE-025, CMD-DATASERVICE-026, CMD-DATASERVICE-027, CMD-DATASERVICE-028, CMD-DATASERVICE-029, CMD-DATASERVICE-030, CMD-DATASERVICE-031, CMD-DATASERVICE-032, CMD-DATASERVICE-033, CMD-DATASERVICE-034, CMD-DATASERVICE-035, CMD-DATASERVICE-036, CMD-DATASERVICE-037, CMD-DATASERVICE-038, CMD-DATASERVICE-039, CMD-DATASERVICE-040, CMD-DATASERVICE-041, CMD-DATASERVICE-042, CMD-DATASERVICE-087, CMD-DATASERVICE-090, CMD-DATASERVICE-053, CMD-DATASERVICE-056, CMD-DATASERVICE-059, CMD-DATASERVICE-062, CMD-DATASERVICE-065, CMD-DATASERVICE-068, CMD-DATASERVICE-071, CMD-DATASERVICE-074, CMD-DATASERVICE-077, CMD-DATASERVICE-086, CMD-DATASERVICE-092`.
  - Evidence: `EVD-DATASERVICE-012, EVD-DATASERVICE-013, EVD-DATASERVICE-015, EVD-DATASERVICE-016, EVD-DATASERVICE-047`.

- AC-DATASERVICE-020-S04:
> pass 只产生符合当前actual和仓位约束的零或一个订单intent
  - Tasks: `TASK-DATASERVICE-001, TASK-DATASERVICE-002, TASK-DATASERVICE-003, TASK-DATASERVICE-004, TASK-DATASERVICE-005, TASK-DATASERVICE-006, TASK-DATASERVICE-007, TASK-DATASERVICE-008, TASK-DATASERVICE-009, TASK-DATASERVICE-010, TASK-DATASERVICE-011, TASK-DATASERVICE-012, TASK-DATASERVICE-013, TASK-DATASERVICE-014, TASK-DATASERVICE-015, TASK-DATASERVICE-016`.
  - Commands: `CMD-DATASERVICE-051, CMD-DATASERVICE-052, CMD-DATASERVICE-053, CMD-DATASERVICE-078, CMD-DATASERVICE-079, CMD-DATASERVICE-080, CMD-DATASERVICE-081, CMD-DATASERVICE-082, CMD-DATASERVICE-083, CMD-DATASERVICE-003, CMD-DATASERVICE-004, CMD-DATASERVICE-005, CMD-DATASERVICE-006, CMD-DATASERVICE-007, CMD-DATASERVICE-008, CMD-DATASERVICE-009, CMD-DATASERVICE-010, CMD-DATASERVICE-011, CMD-DATASERVICE-012, CMD-DATASERVICE-013, CMD-DATASERVICE-014, CMD-DATASERVICE-015, CMD-DATASERVICE-016, CMD-DATASERVICE-017, CMD-DATASERVICE-018, CMD-DATASERVICE-019, CMD-DATASERVICE-020, CMD-DATASERVICE-021, CMD-DATASERVICE-022, CMD-DATASERVICE-023, CMD-DATASERVICE-024, CMD-DATASERVICE-025, CMD-DATASERVICE-026, CMD-DATASERVICE-027, CMD-DATASERVICE-028, CMD-DATASERVICE-029, CMD-DATASERVICE-030, CMD-DATASERVICE-031, CMD-DATASERVICE-032, CMD-DATASERVICE-033, CMD-DATASERVICE-034, CMD-DATASERVICE-035, CMD-DATASERVICE-036, CMD-DATASERVICE-037, CMD-DATASERVICE-038, CMD-DATASERVICE-039, CMD-DATASERVICE-040, CMD-DATASERVICE-041, CMD-DATASERVICE-042, CMD-DATASERVICE-087, CMD-DATASERVICE-090, CMD-DATASERVICE-056, CMD-DATASERVICE-059, CMD-DATASERVICE-062, CMD-DATASERVICE-065, CMD-DATASERVICE-068, CMD-DATASERVICE-071, CMD-DATASERVICE-074, CMD-DATASERVICE-077, CMD-DATASERVICE-086, CMD-DATASERVICE-092`.
  - Evidence: `EVD-DATASERVICE-003, EVD-DATASERVICE-012, EVD-DATASERVICE-013, EVD-DATASERVICE-015, EVD-DATASERVICE-016, EVD-DATASERVICE-048`.

- AC-DATASERVICE-021-S01:
> pass active设置只来自用户选择或主进程默认发送 最终只有新stream可写并收到一次 active_ack new_stream_key
  - Tasks: `TASK-DATASERVICE-001, TASK-DATASERVICE-002, TASK-DATASERVICE-003, TASK-DATASERVICE-004, TASK-DATASERVICE-005, TASK-DATASERVICE-006, TASK-DATASERVICE-007, TASK-DATASERVICE-008, TASK-DATASERVICE-009, TASK-DATASERVICE-010, TASK-DATASERVICE-011, TASK-DATASERVICE-012, TASK-DATASERVICE-013, TASK-DATASERVICE-014, TASK-DATASERVICE-015, TASK-DATASERVICE-016`.
  - Commands: `CMD-DATASERVICE-051, CMD-DATASERVICE-052, CMD-DATASERVICE-053, CMD-DATASERVICE-057, CMD-DATASERVICE-058, CMD-DATASERVICE-059, CMD-DATASERVICE-075, CMD-DATASERVICE-076, CMD-DATASERVICE-077, CMD-DATASERVICE-003, CMD-DATASERVICE-004, CMD-DATASERVICE-005, CMD-DATASERVICE-006, CMD-DATASERVICE-007, CMD-DATASERVICE-008, CMD-DATASERVICE-009, CMD-DATASERVICE-010, CMD-DATASERVICE-011, CMD-DATASERVICE-012, CMD-DATASERVICE-013, CMD-DATASERVICE-014, CMD-DATASERVICE-015, CMD-DATASERVICE-016, CMD-DATASERVICE-017, CMD-DATASERVICE-018, CMD-DATASERVICE-019, CMD-DATASERVICE-020, CMD-DATASERVICE-021, CMD-DATASERVICE-022, CMD-DATASERVICE-023, CMD-DATASERVICE-024, CMD-DATASERVICE-025, CMD-DATASERVICE-026, CMD-DATASERVICE-027, CMD-DATASERVICE-028, CMD-DATASERVICE-029, CMD-DATASERVICE-030, CMD-DATASERVICE-031, CMD-DATASERVICE-032, CMD-DATASERVICE-033, CMD-DATASERVICE-034, CMD-DATASERVICE-035, CMD-DATASERVICE-036, CMD-DATASERVICE-037, CMD-DATASERVICE-038, CMD-DATASERVICE-039, CMD-DATASERVICE-040, CMD-DATASERVICE-041, CMD-DATASERVICE-042, CMD-DATASERVICE-087, CMD-DATASERVICE-090, CMD-DATASERVICE-056, CMD-DATASERVICE-062, CMD-DATASERVICE-065, CMD-DATASERVICE-068, CMD-DATASERVICE-071, CMD-DATASERVICE-074, CMD-DATASERVICE-080, CMD-DATASERVICE-083, CMD-DATASERVICE-086, CMD-DATASERVICE-092`.
  - Evidence: `EVD-DATASERVICE-003, EVD-DATASERVICE-005, EVD-DATASERVICE-011, EVD-DATASERVICE-015, EVD-DATASERVICE-016, EVD-DATASERVICE-037`.

- AC-DATASERVICE-021-S02:
> pass 失败切换不造成行情空窗或双active
  - Tasks: `TASK-DATASERVICE-001, TASK-DATASERVICE-002, TASK-DATASERVICE-003, TASK-DATASERVICE-004, TASK-DATASERVICE-005, TASK-DATASERVICE-006, TASK-DATASERVICE-007, TASK-DATASERVICE-008, TASK-DATASERVICE-009, TASK-DATASERVICE-010, TASK-DATASERVICE-011, TASK-DATASERVICE-012, TASK-DATASERVICE-013, TASK-DATASERVICE-014, TASK-DATASERVICE-015, TASK-DATASERVICE-016`.
  - Commands: `CMD-DATASERVICE-051, CMD-DATASERVICE-052, CMD-DATASERVICE-053, CMD-DATASERVICE-057, CMD-DATASERVICE-058, CMD-DATASERVICE-059, CMD-DATASERVICE-003, CMD-DATASERVICE-004, CMD-DATASERVICE-005, CMD-DATASERVICE-006, CMD-DATASERVICE-007, CMD-DATASERVICE-008, CMD-DATASERVICE-009, CMD-DATASERVICE-010, CMD-DATASERVICE-011, CMD-DATASERVICE-012, CMD-DATASERVICE-013, CMD-DATASERVICE-014, CMD-DATASERVICE-015, CMD-DATASERVICE-016, CMD-DATASERVICE-017, CMD-DATASERVICE-018, CMD-DATASERVICE-019, CMD-DATASERVICE-020, CMD-DATASERVICE-021, CMD-DATASERVICE-022, CMD-DATASERVICE-023, CMD-DATASERVICE-024, CMD-DATASERVICE-025, CMD-DATASERVICE-026, CMD-DATASERVICE-027, CMD-DATASERVICE-028, CMD-DATASERVICE-029, CMD-DATASERVICE-030, CMD-DATASERVICE-031, CMD-DATASERVICE-032, CMD-DATASERVICE-033, CMD-DATASERVICE-034, CMD-DATASERVICE-035, CMD-DATASERVICE-036, CMD-DATASERVICE-037, CMD-DATASERVICE-038, CMD-DATASERVICE-039, CMD-DATASERVICE-040, CMD-DATASERVICE-041, CMD-DATASERVICE-042, CMD-DATASERVICE-087, CMD-DATASERVICE-090, CMD-DATASERVICE-056, CMD-DATASERVICE-062, CMD-DATASERVICE-065, CMD-DATASERVICE-068, CMD-DATASERVICE-071, CMD-DATASERVICE-074, CMD-DATASERVICE-077, CMD-DATASERVICE-080, CMD-DATASERVICE-083, CMD-DATASERVICE-086, CMD-DATASERVICE-092`.
  - Evidence: `EVD-DATASERVICE-003, EVD-DATASERVICE-005, EVD-DATASERVICE-015, EVD-DATASERVICE-016, EVD-DATASERVICE-049`.

- AC-DATASERVICE-021-S03:
> pass logical symbol相同不会复用旧生命周期
  - Tasks: `TASK-DATASERVICE-001, TASK-DATASERVICE-002, TASK-DATASERVICE-003, TASK-DATASERVICE-004, TASK-DATASERVICE-005, TASK-DATASERVICE-006, TASK-DATASERVICE-007, TASK-DATASERVICE-008, TASK-DATASERVICE-009, TASK-DATASERVICE-010, TASK-DATASERVICE-011, TASK-DATASERVICE-012, TASK-DATASERVICE-013, TASK-DATASERVICE-014, TASK-DATASERVICE-015, TASK-DATASERVICE-016`.
  - Commands: `CMD-DATASERVICE-051, CMD-DATASERVICE-052, CMD-DATASERVICE-053, CMD-DATASERVICE-075, CMD-DATASERVICE-076, CMD-DATASERVICE-077, CMD-DATASERVICE-084, CMD-DATASERVICE-085, CMD-DATASERVICE-086, CMD-DATASERVICE-003, CMD-DATASERVICE-004, CMD-DATASERVICE-005, CMD-DATASERVICE-006, CMD-DATASERVICE-007, CMD-DATASERVICE-008, CMD-DATASERVICE-009, CMD-DATASERVICE-010, CMD-DATASERVICE-011, CMD-DATASERVICE-012, CMD-DATASERVICE-013, CMD-DATASERVICE-014, CMD-DATASERVICE-015, CMD-DATASERVICE-016, CMD-DATASERVICE-017, CMD-DATASERVICE-018, CMD-DATASERVICE-019, CMD-DATASERVICE-020, CMD-DATASERVICE-021, CMD-DATASERVICE-022, CMD-DATASERVICE-023, CMD-DATASERVICE-024, CMD-DATASERVICE-025, CMD-DATASERVICE-026, CMD-DATASERVICE-027, CMD-DATASERVICE-028, CMD-DATASERVICE-029, CMD-DATASERVICE-030, CMD-DATASERVICE-031, CMD-DATASERVICE-032, CMD-DATASERVICE-033, CMD-DATASERVICE-034, CMD-DATASERVICE-035, CMD-DATASERVICE-036, CMD-DATASERVICE-037, CMD-DATASERVICE-038, CMD-DATASERVICE-039, CMD-DATASERVICE-040, CMD-DATASERVICE-041, CMD-DATASERVICE-042, CMD-DATASERVICE-087, CMD-DATASERVICE-090, CMD-DATASERVICE-056, CMD-DATASERVICE-059, CMD-DATASERVICE-062, CMD-DATASERVICE-065, CMD-DATASERVICE-068, CMD-DATASERVICE-071, CMD-DATASERVICE-074, CMD-DATASERVICE-080, CMD-DATASERVICE-083, CMD-DATASERVICE-092`.
  - Evidence: `EVD-DATASERVICE-003, EVD-DATASERVICE-011, EVD-DATASERVICE-014, EVD-DATASERVICE-015, EVD-DATASERVICE-016, EVD-DATASERVICE-050`.

- AC-DATASERVICE-022-S01:
> pass futu execution使用mhi2610 db/gds/recorder/指标仍用mhimain
  - Tasks: `TASK-DATASERVICE-001, TASK-DATASERVICE-002, TASK-DATASERVICE-003, TASK-DATASERVICE-004, TASK-DATASERVICE-005, TASK-DATASERVICE-006, TASK-DATASERVICE-007, TASK-DATASERVICE-008, TASK-DATASERVICE-009, TASK-DATASERVICE-010, TASK-DATASERVICE-011, TASK-DATASERVICE-012, TASK-DATASERVICE-013, TASK-DATASERVICE-014, TASK-DATASERVICE-015, TASK-DATASERVICE-016`.
  - Commands: `CMD-DATASERVICE-045, CMD-DATASERVICE-046, CMD-DATASERVICE-047, CMD-DATASERVICE-051, CMD-DATASERVICE-052, CMD-DATASERVICE-053, CMD-DATASERVICE-054, CMD-DATASERVICE-055, CMD-DATASERVICE-056, CMD-DATASERVICE-078, CMD-DATASERVICE-079, CMD-DATASERVICE-080, CMD-DATASERVICE-003, CMD-DATASERVICE-004, CMD-DATASERVICE-005, CMD-DATASERVICE-006, CMD-DATASERVICE-007, CMD-DATASERVICE-008, CMD-DATASERVICE-009, CMD-DATASERVICE-010, CMD-DATASERVICE-011, CMD-DATASERVICE-012, CMD-DATASERVICE-013, CMD-DATASERVICE-014, CMD-DATASERVICE-015, CMD-DATASERVICE-016, CMD-DATASERVICE-017, CMD-DATASERVICE-018, CMD-DATASERVICE-019, CMD-DATASERVICE-020, CMD-DATASERVICE-021, CMD-DATASERVICE-022, CMD-DATASERVICE-023, CMD-DATASERVICE-024, CMD-DATASERVICE-025, CMD-DATASERVICE-026, CMD-DATASERVICE-027, CMD-DATASERVICE-028, CMD-DATASERVICE-029, CMD-DATASERVICE-030, CMD-DATASERVICE-031, CMD-DATASERVICE-032, CMD-DATASERVICE-033, CMD-DATASERVICE-034, CMD-DATASERVICE-035, CMD-DATASERVICE-036, CMD-DATASERVICE-037, CMD-DATASERVICE-038, CMD-DATASERVICE-039, CMD-DATASERVICE-040, CMD-DATASERVICE-041, CMD-DATASERVICE-042, CMD-DATASERVICE-087, CMD-DATASERVICE-090, CMD-DATASERVICE-059, CMD-DATASERVICE-062, CMD-DATASERVICE-065, CMD-DATASERVICE-068, CMD-DATASERVICE-071, CMD-DATASERVICE-074, CMD-DATASERVICE-077, CMD-DATASERVICE-083, CMD-DATASERVICE-086, CMD-DATASERVICE-092`.
  - Evidence: `EVD-DATASERVICE-001, EVD-DATASERVICE-003, EVD-DATASERVICE-004, EVD-DATASERVICE-012, EVD-DATASERVICE-015, EVD-DATASERVICE-016, EVD-DATASERVICE-038`.

- AC-DATASERVICE-022-S02:
> pass canonical current没有并发写或actual混合
  - Tasks: `TASK-DATASERVICE-001, TASK-DATASERVICE-002, TASK-DATASERVICE-003, TASK-DATASERVICE-004, TASK-DATASERVICE-005, TASK-DATASERVICE-006, TASK-DATASERVICE-007, TASK-DATASERVICE-008, TASK-DATASERVICE-009, TASK-DATASERVICE-010, TASK-DATASERVICE-011, TASK-DATASERVICE-012, TASK-DATASERVICE-013, TASK-DATASERVICE-014, TASK-DATASERVICE-015, TASK-DATASERVICE-016`.
  - Commands: `CMD-DATASERVICE-045, CMD-DATASERVICE-046, CMD-DATASERVICE-047, CMD-DATASERVICE-051, CMD-DATASERVICE-052, CMD-DATASERVICE-053, CMD-DATASERVICE-054, CMD-DATASERVICE-055, CMD-DATASERVICE-056, CMD-DATASERVICE-003, CMD-DATASERVICE-004, CMD-DATASERVICE-005, CMD-DATASERVICE-006, CMD-DATASERVICE-007, CMD-DATASERVICE-008, CMD-DATASERVICE-009, CMD-DATASERVICE-010, CMD-DATASERVICE-011, CMD-DATASERVICE-012, CMD-DATASERVICE-013, CMD-DATASERVICE-014, CMD-DATASERVICE-015, CMD-DATASERVICE-016, CMD-DATASERVICE-017, CMD-DATASERVICE-018, CMD-DATASERVICE-019, CMD-DATASERVICE-020, CMD-DATASERVICE-021, CMD-DATASERVICE-022, CMD-DATASERVICE-023, CMD-DATASERVICE-024, CMD-DATASERVICE-025, CMD-DATASERVICE-026, CMD-DATASERVICE-027, CMD-DATASERVICE-028, CMD-DATASERVICE-029, CMD-DATASERVICE-030, CMD-DATASERVICE-031, CMD-DATASERVICE-032, CMD-DATASERVICE-033, CMD-DATASERVICE-034, CMD-DATASERVICE-035, CMD-DATASERVICE-036, CMD-DATASERVICE-037, CMD-DATASERVICE-038, CMD-DATASERVICE-039, CMD-DATASERVICE-040, CMD-DATASERVICE-041, CMD-DATASERVICE-042, CMD-DATASERVICE-087, CMD-DATASERVICE-090, CMD-DATASERVICE-059, CMD-DATASERVICE-062, CMD-DATASERVICE-065, CMD-DATASERVICE-068, CMD-DATASERVICE-071, CMD-DATASERVICE-074, CMD-DATASERVICE-077, CMD-DATASERVICE-080, CMD-DATASERVICE-083, CMD-DATASERVICE-086, CMD-DATASERVICE-092`.
  - Evidence: `EVD-DATASERVICE-001, EVD-DATASERVICE-003, EVD-DATASERVICE-004, EVD-DATASERVICE-015, EVD-DATASERVICE-016, EVD-DATASERVICE-051`.

- AC-DATASERVICE-023-S01:
> pass 相同精确in-flight request只执行一次 所有caller收到一个终态
  - Tasks: `TASK-DATASERVICE-001, TASK-DATASERVICE-002, TASK-DATASERVICE-003, TASK-DATASERVICE-004, TASK-DATASERVICE-005, TASK-DATASERVICE-006, TASK-DATASERVICE-007, TASK-DATASERVICE-008, TASK-DATASERVICE-009, TASK-DATASERVICE-010, TASK-DATASERVICE-011, TASK-DATASERVICE-012, TASK-DATASERVICE-013, TASK-DATASERVICE-014, TASK-DATASERVICE-015, TASK-DATASERVICE-016`.
  - Commands: `CMD-DATASERVICE-057, CMD-DATASERVICE-058, CMD-DATASERVICE-059, CMD-DATASERVICE-063, CMD-DATASERVICE-064, CMD-DATASERVICE-065, CMD-DATASERVICE-066, CMD-DATASERVICE-067, CMD-DATASERVICE-068, CMD-DATASERVICE-084, CMD-DATASERVICE-085, CMD-DATASERVICE-086, CMD-DATASERVICE-003, CMD-DATASERVICE-004, CMD-DATASERVICE-005, CMD-DATASERVICE-006, CMD-DATASERVICE-007, CMD-DATASERVICE-008, CMD-DATASERVICE-009, CMD-DATASERVICE-010, CMD-DATASERVICE-011, CMD-DATASERVICE-012, CMD-DATASERVICE-013, CMD-DATASERVICE-014, CMD-DATASERVICE-015, CMD-DATASERVICE-016, CMD-DATASERVICE-017, CMD-DATASERVICE-018, CMD-DATASERVICE-019, CMD-DATASERVICE-020, CMD-DATASERVICE-021, CMD-DATASERVICE-022, CMD-DATASERVICE-023, CMD-DATASERVICE-024, CMD-DATASERVICE-025, CMD-DATASERVICE-026, CMD-DATASERVICE-027, CMD-DATASERVICE-028, CMD-DATASERVICE-029, CMD-DATASERVICE-030, CMD-DATASERVICE-031, CMD-DATASERVICE-032, CMD-DATASERVICE-033, CMD-DATASERVICE-034, CMD-DATASERVICE-035, CMD-DATASERVICE-036, CMD-DATASERVICE-037, CMD-DATASERVICE-038, CMD-DATASERVICE-039, CMD-DATASERVICE-040, CMD-DATASERVICE-041, CMD-DATASERVICE-042, CMD-DATASERVICE-087, CMD-DATASERVICE-090, CMD-DATASERVICE-053, CMD-DATASERVICE-056, CMD-DATASERVICE-062, CMD-DATASERVICE-071, CMD-DATASERVICE-074, CMD-DATASERVICE-077, CMD-DATASERVICE-080, CMD-DATASERVICE-083, CMD-DATASERVICE-092`.
  - Evidence: `EVD-DATASERVICE-005, EVD-DATASERVICE-007, EVD-DATASERVICE-008, EVD-DATASERVICE-014, EVD-DATASERVICE-015, EVD-DATASERVICE-016, EVD-DATASERVICE-039`.

- AC-DATASERVICE-023-S02:
> pass fetch range集合精确等于首次范围加差集
  - Tasks: `TASK-DATASERVICE-001, TASK-DATASERVICE-002, TASK-DATASERVICE-003, TASK-DATASERVICE-004, TASK-DATASERVICE-005, TASK-DATASERVICE-006, TASK-DATASERVICE-007, TASK-DATASERVICE-008, TASK-DATASERVICE-009, TASK-DATASERVICE-010, TASK-DATASERVICE-011, TASK-DATASERVICE-012, TASK-DATASERVICE-013, TASK-DATASERVICE-014, TASK-DATASERVICE-015, TASK-DATASERVICE-016`.
  - Commands: `CMD-DATASERVICE-057, CMD-DATASERVICE-058, CMD-DATASERVICE-059, CMD-DATASERVICE-063, CMD-DATASERVICE-064, CMD-DATASERVICE-065, CMD-DATASERVICE-084, CMD-DATASERVICE-085, CMD-DATASERVICE-086, CMD-DATASERVICE-003, CMD-DATASERVICE-004, CMD-DATASERVICE-005, CMD-DATASERVICE-006, CMD-DATASERVICE-007, CMD-DATASERVICE-008, CMD-DATASERVICE-009, CMD-DATASERVICE-010, CMD-DATASERVICE-011, CMD-DATASERVICE-012, CMD-DATASERVICE-013, CMD-DATASERVICE-014, CMD-DATASERVICE-015, CMD-DATASERVICE-016, CMD-DATASERVICE-017, CMD-DATASERVICE-018, CMD-DATASERVICE-019, CMD-DATASERVICE-020, CMD-DATASERVICE-021, CMD-DATASERVICE-022, CMD-DATASERVICE-023, CMD-DATASERVICE-024, CMD-DATASERVICE-025, CMD-DATASERVICE-026, CMD-DATASERVICE-027, CMD-DATASERVICE-028, CMD-DATASERVICE-029, CMD-DATASERVICE-030, CMD-DATASERVICE-031, CMD-DATASERVICE-032, CMD-DATASERVICE-033, CMD-DATASERVICE-034, CMD-DATASERVICE-035, CMD-DATASERVICE-036, CMD-DATASERVICE-037, CMD-DATASERVICE-038, CMD-DATASERVICE-039, CMD-DATASERVICE-040, CMD-DATASERVICE-041, CMD-DATASERVICE-042, CMD-DATASERVICE-087, CMD-DATASERVICE-090, CMD-DATASERVICE-053, CMD-DATASERVICE-056, CMD-DATASERVICE-062, CMD-DATASERVICE-068, CMD-DATASERVICE-071, CMD-DATASERVICE-074, CMD-DATASERVICE-077, CMD-DATASERVICE-080, CMD-DATASERVICE-083, CMD-DATASERVICE-092`.
  - Evidence: `EVD-DATASERVICE-005, EVD-DATASERVICE-007, EVD-DATASERVICE-014, EVD-DATASERVICE-015, EVD-DATASERVICE-016, EVD-DATASERVICE-052`.

- AC-DATASERVICE-023-S03:
> pass 迟到数据不成为新权威且资源计数回到0
  - Tasks: `TASK-DATASERVICE-001, TASK-DATASERVICE-002, TASK-DATASERVICE-003, TASK-DATASERVICE-004, TASK-DATASERVICE-005, TASK-DATASERVICE-006, TASK-DATASERVICE-007, TASK-DATASERVICE-008, TASK-DATASERVICE-009, TASK-DATASERVICE-010, TASK-DATASERVICE-011, TASK-DATASERVICE-012, TASK-DATASERVICE-013, TASK-DATASERVICE-014, TASK-DATASERVICE-015, TASK-DATASERVICE-016`.
  - Commands: `CMD-DATASERVICE-057, CMD-DATASERVICE-058, CMD-DATASERVICE-059, CMD-DATASERVICE-063, CMD-DATASERVICE-064, CMD-DATASERVICE-065, CMD-DATASERVICE-084, CMD-DATASERVICE-085, CMD-DATASERVICE-086, CMD-DATASERVICE-003, CMD-DATASERVICE-004, CMD-DATASERVICE-005, CMD-DATASERVICE-006, CMD-DATASERVICE-007, CMD-DATASERVICE-008, CMD-DATASERVICE-009, CMD-DATASERVICE-010, CMD-DATASERVICE-011, CMD-DATASERVICE-012, CMD-DATASERVICE-013, CMD-DATASERVICE-014, CMD-DATASERVICE-015, CMD-DATASERVICE-016, CMD-DATASERVICE-017, CMD-DATASERVICE-018, CMD-DATASERVICE-019, CMD-DATASERVICE-020, CMD-DATASERVICE-021, CMD-DATASERVICE-022, CMD-DATASERVICE-023, CMD-DATASERVICE-024, CMD-DATASERVICE-025, CMD-DATASERVICE-026, CMD-DATASERVICE-027, CMD-DATASERVICE-028, CMD-DATASERVICE-029, CMD-DATASERVICE-030, CMD-DATASERVICE-031, CMD-DATASERVICE-032, CMD-DATASERVICE-033, CMD-DATASERVICE-034, CMD-DATASERVICE-035, CMD-DATASERVICE-036, CMD-DATASERVICE-037, CMD-DATASERVICE-038, CMD-DATASERVICE-039, CMD-DATASERVICE-040, CMD-DATASERVICE-041, CMD-DATASERVICE-042, CMD-DATASERVICE-087, CMD-DATASERVICE-090, CMD-DATASERVICE-053, CMD-DATASERVICE-056, CMD-DATASERVICE-062, CMD-DATASERVICE-068, CMD-DATASERVICE-071, CMD-DATASERVICE-074, CMD-DATASERVICE-077, CMD-DATASERVICE-080, CMD-DATASERVICE-083, CMD-DATASERVICE-092`.
  - Evidence: `EVD-DATASERVICE-005, EVD-DATASERVICE-007, EVD-DATASERVICE-014, EVD-DATASERVICE-015, EVD-DATASERVICE-016, EVD-DATASERVICE-053`.

- AC-DATASERVICE-024-S01:
> pass 图表恢复后历史和current连续 dataservice/worker/recorder/cta/trigger pid均未因最小化变化
  - Tasks: `TASK-DATASERVICE-001, TASK-DATASERVICE-002, TASK-DATASERVICE-003, TASK-DATASERVICE-004, TASK-DATASERVICE-005, TASK-DATASERVICE-006, TASK-DATASERVICE-007, TASK-DATASERVICE-008, TASK-DATASERVICE-009, TASK-DATASERVICE-010, TASK-DATASERVICE-011, TASK-DATASERVICE-012, TASK-DATASERVICE-013, TASK-DATASERVICE-014, TASK-DATASERVICE-015, TASK-DATASERVICE-016`.
  - Commands: `CMD-DATASERVICE-063, CMD-DATASERVICE-064, CMD-DATASERVICE-065, CMD-DATASERVICE-069, CMD-DATASERVICE-070, CMD-DATASERVICE-071, CMD-DATASERVICE-084, CMD-DATASERVICE-085, CMD-DATASERVICE-086, CMD-DATASERVICE-003, CMD-DATASERVICE-004, CMD-DATASERVICE-005, CMD-DATASERVICE-006, CMD-DATASERVICE-007, CMD-DATASERVICE-008, CMD-DATASERVICE-009, CMD-DATASERVICE-010, CMD-DATASERVICE-011, CMD-DATASERVICE-012, CMD-DATASERVICE-013, CMD-DATASERVICE-014, CMD-DATASERVICE-015, CMD-DATASERVICE-016, CMD-DATASERVICE-017, CMD-DATASERVICE-018, CMD-DATASERVICE-019, CMD-DATASERVICE-020, CMD-DATASERVICE-021, CMD-DATASERVICE-022, CMD-DATASERVICE-023, CMD-DATASERVICE-024, CMD-DATASERVICE-025, CMD-DATASERVICE-026, CMD-DATASERVICE-027, CMD-DATASERVICE-028, CMD-DATASERVICE-029, CMD-DATASERVICE-030, CMD-DATASERVICE-031, CMD-DATASERVICE-032, CMD-DATASERVICE-033, CMD-DATASERVICE-034, CMD-DATASERVICE-035, CMD-DATASERVICE-036, CMD-DATASERVICE-037, CMD-DATASERVICE-038, CMD-DATASERVICE-039, CMD-DATASERVICE-040, CMD-DATASERVICE-041, CMD-DATASERVICE-042, CMD-DATASERVICE-087, CMD-DATASERVICE-090, CMD-DATASERVICE-053, CMD-DATASERVICE-056, CMD-DATASERVICE-059, CMD-DATASERVICE-062, CMD-DATASERVICE-068, CMD-DATASERVICE-074, CMD-DATASERVICE-077, CMD-DATASERVICE-080, CMD-DATASERVICE-083, CMD-DATASERVICE-092`.
  - Evidence: `EVD-DATASERVICE-007, EVD-DATASERVICE-009, EVD-DATASERVICE-014, EVD-DATASERVICE-015, EVD-DATASERVICE-016, EVD-DATASERVICE-040`.

- AC-DATASERVICE-024-S02:
> pass 高周期db完整且与1m聚合一致 旧ack不进入新stream
  - Tasks: `TASK-DATASERVICE-001, TASK-DATASERVICE-002, TASK-DATASERVICE-003, TASK-DATASERVICE-004, TASK-DATASERVICE-005, TASK-DATASERVICE-006, TASK-DATASERVICE-007, TASK-DATASERVICE-008, TASK-DATASERVICE-009, TASK-DATASERVICE-010, TASK-DATASERVICE-011, TASK-DATASERVICE-012, TASK-DATASERVICE-013, TASK-DATASERVICE-014, TASK-DATASERVICE-015, TASK-DATASERVICE-016`.
  - Commands: `CMD-DATASERVICE-057, CMD-DATASERVICE-058, CMD-DATASERVICE-059, CMD-DATASERVICE-063, CMD-DATASERVICE-064, CMD-DATASERVICE-065, CMD-DATASERVICE-069, CMD-DATASERVICE-070, CMD-DATASERVICE-071, CMD-DATASERVICE-075, CMD-DATASERVICE-076, CMD-DATASERVICE-077, CMD-DATASERVICE-084, CMD-DATASERVICE-085, CMD-DATASERVICE-086, CMD-DATASERVICE-003, CMD-DATASERVICE-004, CMD-DATASERVICE-005, CMD-DATASERVICE-006, CMD-DATASERVICE-007, CMD-DATASERVICE-008, CMD-DATASERVICE-009, CMD-DATASERVICE-010, CMD-DATASERVICE-011, CMD-DATASERVICE-012, CMD-DATASERVICE-013, CMD-DATASERVICE-014, CMD-DATASERVICE-015, CMD-DATASERVICE-016, CMD-DATASERVICE-017, CMD-DATASERVICE-018, CMD-DATASERVICE-019, CMD-DATASERVICE-020, CMD-DATASERVICE-021, CMD-DATASERVICE-022, CMD-DATASERVICE-023, CMD-DATASERVICE-024, CMD-DATASERVICE-025, CMD-DATASERVICE-026, CMD-DATASERVICE-027, CMD-DATASERVICE-028, CMD-DATASERVICE-029, CMD-DATASERVICE-030, CMD-DATASERVICE-031, CMD-DATASERVICE-032, CMD-DATASERVICE-033, CMD-DATASERVICE-034, CMD-DATASERVICE-035, CMD-DATASERVICE-036, CMD-DATASERVICE-037, CMD-DATASERVICE-038, CMD-DATASERVICE-039, CMD-DATASERVICE-040, CMD-DATASERVICE-041, CMD-DATASERVICE-042, CMD-DATASERVICE-087, CMD-DATASERVICE-090, CMD-DATASERVICE-053, CMD-DATASERVICE-056, CMD-DATASERVICE-062, CMD-DATASERVICE-068, CMD-DATASERVICE-074, CMD-DATASERVICE-080, CMD-DATASERVICE-083, CMD-DATASERVICE-092`.
  - Evidence: `EVD-DATASERVICE-005, EVD-DATASERVICE-007, EVD-DATASERVICE-009, EVD-DATASERVICE-011, EVD-DATASERVICE-014, EVD-DATASERVICE-015, EVD-DATASERVICE-016, EVD-DATASERVICE-054`.

- AC-DATASERVICE-024-S03:
> pass db完整 checkpoint在恢复后连续 新到达batch正常ack
  - Tasks: `TASK-DATASERVICE-001, TASK-DATASERVICE-002, TASK-DATASERVICE-003, TASK-DATASERVICE-004, TASK-DATASERVICE-005, TASK-DATASERVICE-006, TASK-DATASERVICE-007, TASK-DATASERVICE-008, TASK-DATASERVICE-009, TASK-DATASERVICE-010, TASK-DATASERVICE-011, TASK-DATASERVICE-012, TASK-DATASERVICE-013, TASK-DATASERVICE-014, TASK-DATASERVICE-015, TASK-DATASERVICE-016`.
  - Commands: `CMD-DATASERVICE-057, CMD-DATASERVICE-058, CMD-DATASERVICE-059, CMD-DATASERVICE-063, CMD-DATASERVICE-064, CMD-DATASERVICE-065, CMD-DATASERVICE-069, CMD-DATASERVICE-070, CMD-DATASERVICE-071, CMD-DATASERVICE-075, CMD-DATASERVICE-076, CMD-DATASERVICE-077, CMD-DATASERVICE-084, CMD-DATASERVICE-085, CMD-DATASERVICE-086, CMD-DATASERVICE-003, CMD-DATASERVICE-004, CMD-DATASERVICE-005, CMD-DATASERVICE-006, CMD-DATASERVICE-007, CMD-DATASERVICE-008, CMD-DATASERVICE-009, CMD-DATASERVICE-010, CMD-DATASERVICE-011, CMD-DATASERVICE-012, CMD-DATASERVICE-013, CMD-DATASERVICE-014, CMD-DATASERVICE-015, CMD-DATASERVICE-016, CMD-DATASERVICE-017, CMD-DATASERVICE-018, CMD-DATASERVICE-019, CMD-DATASERVICE-020, CMD-DATASERVICE-021, CMD-DATASERVICE-022, CMD-DATASERVICE-023, CMD-DATASERVICE-024, CMD-DATASERVICE-025, CMD-DATASERVICE-026, CMD-DATASERVICE-027, CMD-DATASERVICE-028, CMD-DATASERVICE-029, CMD-DATASERVICE-030, CMD-DATASERVICE-031, CMD-DATASERVICE-032, CMD-DATASERVICE-033, CMD-DATASERVICE-034, CMD-DATASERVICE-035, CMD-DATASERVICE-036, CMD-DATASERVICE-037, CMD-DATASERVICE-038, CMD-DATASERVICE-039, CMD-DATASERVICE-040, CMD-DATASERVICE-041, CMD-DATASERVICE-042, CMD-DATASERVICE-087, CMD-DATASERVICE-090, CMD-DATASERVICE-053, CMD-DATASERVICE-056, CMD-DATASERVICE-062, CMD-DATASERVICE-068, CMD-DATASERVICE-074, CMD-DATASERVICE-080, CMD-DATASERVICE-083, CMD-DATASERVICE-092`.
  - Evidence: `EVD-DATASERVICE-005, EVD-DATASERVICE-007, EVD-DATASERVICE-009, EVD-DATASERVICE-011, EVD-DATASERVICE-014, EVD-DATASERVICE-015, EVD-DATASERVICE-016, EVD-DATASERVICE-055`.
<!-- /goal-slot:strictAcceptanceChecklist -->

## Acceptance Traceability Matrix

<!-- goal-slot:acceptanceTraceabilityMatrix required dynamic=traceEvidence -->
| Acceptance ID | Task IDs | Evidence command and artifact | Pass condition |
| --- | --- | --- | --- |
| AC-DATASERVICE-001-S01 | TASK-DATASERVICE-001, TASK-DATASERVICE-002, TASK-DATASERVICE-003, TASK-DATASERVICE-004, TASK-DATASERVICE-005, TASK-DATASERVICE-006, TASK-DATASERVICE-007, TASK-DATASERVICE-008, TASK-DATASERVICE-009, TASK-DATASERVICE-010, TASK-DATASERVICE-011, TASK-DATASERVICE-012, TASK-DATASERVICE-013, TASK-DATASERVICE-014, TASK-DATASERVICE-015, TASK-DATASERVICE-016 | CMD-DATASERVICE-057, CMD-DATASERVICE-058, CMD-DATASERVICE-059, CMD-DATASERVICE-063, CMD-DATASERVICE-064, CMD-DATASERVICE-065, CMD-DATASERVICE-003, CMD-DATASERVICE-004, CMD-DATASERVICE-005, CMD-DATASERVICE-006, CMD-DATASERVICE-007, CMD-DATASERVICE-008, CMD-DATASERVICE-009, CMD-DATASERVICE-010, CMD-DATASERVICE-011, CMD-DATASERVICE-012, CMD-DATASERVICE-013, CMD-DATASERVICE-014, CMD-DATASERVICE-015, CMD-DATASERVICE-016, CMD-DATASERVICE-017, CMD-DATASERVICE-018, CMD-DATASERVICE-019, CMD-DATASERVICE-020, CMD-DATASERVICE-021, CMD-DATASERVICE-022, CMD-DATASERVICE-023, CMD-DATASERVICE-024, CMD-DATASERVICE-025, CMD-DATASERVICE-026, CMD-DATASERVICE-027, CMD-DATASERVICE-028, CMD-DATASERVICE-029, CMD-DATASERVICE-030, CMD-DATASERVICE-031, CMD-DATASERVICE-032, CMD-DATASERVICE-033, CMD-DATASERVICE-034, CMD-DATASERVICE-035, CMD-DATASERVICE-036, CMD-DATASERVICE-037, CMD-DATASERVICE-038, CMD-DATASERVICE-039, CMD-DATASERVICE-040, CMD-DATASERVICE-041, CMD-DATASERVICE-042, CMD-DATASERVICE-087, CMD-DATASERVICE-090; EVD-DATASERVICE-005, EVD-DATASERVICE-007, EVD-DATASERVICE-015, EVD-DATASERVICE-017 | pass 全部字段和顺序断言成立 range只发布一次complete |
| AC-DATASERVICE-002-S01 | TASK-DATASERVICE-001, TASK-DATASERVICE-002, TASK-DATASERVICE-003, TASK-DATASERVICE-004, TASK-DATASERVICE-005, TASK-DATASERVICE-006, TASK-DATASERVICE-007, TASK-DATASERVICE-008, TASK-DATASERVICE-009, TASK-DATASERVICE-010, TASK-DATASERVICE-011, TASK-DATASERVICE-012, TASK-DATASERVICE-013, TASK-DATASERVICE-014, TASK-DATASERVICE-015, TASK-DATASERVICE-016 | CMD-DATASERVICE-060, CMD-DATASERVICE-061, CMD-DATASERVICE-062, CMD-DATASERVICE-063, CMD-DATASERVICE-064, CMD-DATASERVICE-065, CMD-DATASERVICE-075, CMD-DATASERVICE-076, CMD-DATASERVICE-077, CMD-DATASERVICE-003, CMD-DATASERVICE-004, CMD-DATASERVICE-005, CMD-DATASERVICE-006, CMD-DATASERVICE-007, CMD-DATASERVICE-008, CMD-DATASERVICE-009, CMD-DATASERVICE-010, CMD-DATASERVICE-011, CMD-DATASERVICE-012, CMD-DATASERVICE-013, CMD-DATASERVICE-014, CMD-DATASERVICE-015, CMD-DATASERVICE-016, CMD-DATASERVICE-017, CMD-DATASERVICE-018, CMD-DATASERVICE-019, CMD-DATASERVICE-020, CMD-DATASERVICE-021, CMD-DATASERVICE-022, CMD-DATASERVICE-023, CMD-DATASERVICE-024, CMD-DATASERVICE-025, CMD-DATASERVICE-026, CMD-DATASERVICE-027, CMD-DATASERVICE-028, CMD-DATASERVICE-029, CMD-DATASERVICE-030, CMD-DATASERVICE-031, CMD-DATASERVICE-032, CMD-DATASERVICE-033, CMD-DATASERVICE-034, CMD-DATASERVICE-035, CMD-DATASERVICE-036, CMD-DATASERVICE-037, CMD-DATASERVICE-038, CMD-DATASERVICE-039, CMD-DATASERVICE-040, CMD-DATASERVICE-041, CMD-DATASERVICE-042, CMD-DATASERVICE-087, CMD-DATASERVICE-090; EVD-DATASERVICE-006, EVD-DATASERVICE-007, EVD-DATASERVICE-011, EVD-DATASERVICE-015, EVD-DATASERVICE-018 | pass 四个阶段的业务hash一致 hot吸收发生在cold compare之后 |
| AC-DATASERVICE-003-S01 | TASK-DATASERVICE-001, TASK-DATASERVICE-002, TASK-DATASERVICE-003, TASK-DATASERVICE-004, TASK-DATASERVICE-005, TASK-DATASERVICE-006, TASK-DATASERVICE-007, TASK-DATASERVICE-008, TASK-DATASERVICE-009, TASK-DATASERVICE-010, TASK-DATASERVICE-011, TASK-DATASERVICE-012, TASK-DATASERVICE-013, TASK-DATASERVICE-014, TASK-DATASERVICE-015, TASK-DATASERVICE-016 | CMD-DATASERVICE-057, CMD-DATASERVICE-058, CMD-DATASERVICE-059, CMD-DATASERVICE-060, CMD-DATASERVICE-061, CMD-DATASERVICE-062, CMD-DATASERVICE-063, CMD-DATASERVICE-064, CMD-DATASERVICE-065, CMD-DATASERVICE-003, CMD-DATASERVICE-004, CMD-DATASERVICE-005, CMD-DATASERVICE-006, CMD-DATASERVICE-007, CMD-DATASERVICE-008, CMD-DATASERVICE-009, CMD-DATASERVICE-010, CMD-DATASERVICE-011, CMD-DATASERVICE-012, CMD-DATASERVICE-013, CMD-DATASERVICE-014, CMD-DATASERVICE-015, CMD-DATASERVICE-016, CMD-DATASERVICE-017, CMD-DATASERVICE-018, CMD-DATASERVICE-019, CMD-DATASERVICE-020, CMD-DATASERVICE-021, CMD-DATASERVICE-022, CMD-DATASERVICE-023, CMD-DATASERVICE-024, CMD-DATASERVICE-025, CMD-DATASERVICE-026, CMD-DATASERVICE-027, CMD-DATASERVICE-028, CMD-DATASERVICE-029, CMD-DATASERVICE-030, CMD-DATASERVICE-031, CMD-DATASERVICE-032, CMD-DATASERVICE-033, CMD-DATASERVICE-034, CMD-DATASERVICE-035, CMD-DATASERVICE-036, CMD-DATASERVICE-037, CMD-DATASERVICE-038, CMD-DATASERVICE-039, CMD-DATASERVICE-040, CMD-DATASERVICE-041, CMD-DATASERVICE-042, CMD-DATASERVICE-087, CMD-DATASERVICE-090; EVD-DATASERVICE-005, EVD-DATASERVICE-006, EVD-DATASERVICE-007, EVD-DATASERVICE-015, EVD-DATASERVICE-019 | pass 无静默hot winner 无全局冻结 无第二opend context dataservice db write次数为0 |
| AC-DATASERVICE-004-S01 | TASK-DATASERVICE-001, TASK-DATASERVICE-002, TASK-DATASERVICE-003, TASK-DATASERVICE-004, TASK-DATASERVICE-005, TASK-DATASERVICE-006, TASK-DATASERVICE-007, TASK-DATASERVICE-008, TASK-DATASERVICE-009, TASK-DATASERVICE-010, TASK-DATASERVICE-011, TASK-DATASERVICE-012, TASK-DATASERVICE-013, TASK-DATASERVICE-014, TASK-DATASERVICE-015, TASK-DATASERVICE-016 | CMD-DATASERVICE-057, CMD-DATASERVICE-058, CMD-DATASERVICE-059, CMD-DATASERVICE-063, CMD-DATASERVICE-064, CMD-DATASERVICE-065, CMD-DATASERVICE-003, CMD-DATASERVICE-004, CMD-DATASERVICE-005, CMD-DATASERVICE-006, CMD-DATASERVICE-007, CMD-DATASERVICE-008, CMD-DATASERVICE-009, CMD-DATASERVICE-010, CMD-DATASERVICE-011, CMD-DATASERVICE-012, CMD-DATASERVICE-013, CMD-DATASERVICE-014, CMD-DATASERVICE-015, CMD-DATASERVICE-016, CMD-DATASERVICE-017, CMD-DATASERVICE-018, CMD-DATASERVICE-019, CMD-DATASERVICE-020, CMD-DATASERVICE-021, CMD-DATASERVICE-022, CMD-DATASERVICE-023, CMD-DATASERVICE-024, CMD-DATASERVICE-025, CMD-DATASERVICE-026, CMD-DATASERVICE-027, CMD-DATASERVICE-028, CMD-DATASERVICE-029, CMD-DATASERVICE-030, CMD-DATASERVICE-031, CMD-DATASERVICE-032, CMD-DATASERVICE-033, CMD-DATASERVICE-034, CMD-DATASERVICE-035, CMD-DATASERVICE-036, CMD-DATASERVICE-037, CMD-DATASERVICE-038, CMD-DATASERVICE-039, CMD-DATASERVICE-040, CMD-DATASERVICE-041, CMD-DATASERVICE-042, CMD-DATASERVICE-087, CMD-DATASERVICE-090; EVD-DATASERVICE-005, EVD-DATASERVICE-007, EVD-DATASERVICE-015, EVD-DATASERVICE-020 | pass 缺口下载 db commit read-back 局部cold load和单次publish顺序一致 |
| AC-DATASERVICE-005-S01 | TASK-DATASERVICE-001, TASK-DATASERVICE-002, TASK-DATASERVICE-003, TASK-DATASERVICE-004, TASK-DATASERVICE-005, TASK-DATASERVICE-006, TASK-DATASERVICE-007, TASK-DATASERVICE-008, TASK-DATASERVICE-009, TASK-DATASERVICE-010, TASK-DATASERVICE-011, TASK-DATASERVICE-012, TASK-DATASERVICE-013, TASK-DATASERVICE-014, TASK-DATASERVICE-015, TASK-DATASERVICE-016 | CMD-DATASERVICE-057, CMD-DATASERVICE-058, CMD-DATASERVICE-059, CMD-DATASERVICE-063, CMD-DATASERVICE-064, CMD-DATASERVICE-065, CMD-DATASERVICE-003, CMD-DATASERVICE-004, CMD-DATASERVICE-005, CMD-DATASERVICE-006, CMD-DATASERVICE-007, CMD-DATASERVICE-008, CMD-DATASERVICE-009, CMD-DATASERVICE-010, CMD-DATASERVICE-011, CMD-DATASERVICE-012, CMD-DATASERVICE-013, CMD-DATASERVICE-014, CMD-DATASERVICE-015, CMD-DATASERVICE-016, CMD-DATASERVICE-017, CMD-DATASERVICE-018, CMD-DATASERVICE-019, CMD-DATASERVICE-020, CMD-DATASERVICE-021, CMD-DATASERVICE-022, CMD-DATASERVICE-023, CMD-DATASERVICE-024, CMD-DATASERVICE-025, CMD-DATASERVICE-026, CMD-DATASERVICE-027, CMD-DATASERVICE-028, CMD-DATASERVICE-029, CMD-DATASERVICE-030, CMD-DATASERVICE-031, CMD-DATASERVICE-032, CMD-DATASERVICE-033, CMD-DATASERVICE-034, CMD-DATASERVICE-035, CMD-DATASERVICE-036, CMD-DATASERVICE-037, CMD-DATASERVICE-038, CMD-DATASERVICE-039, CMD-DATASERVICE-040, CMD-DATASERVICE-041, CMD-DATASERVICE-042, CMD-DATASERVICE-087, CMD-DATASERVICE-090; EVD-DATASERVICE-005, EVD-DATASERVICE-007, EVD-DATASERVICE-015, EVD-DATASERVICE-021 | pass 系统持续接收和发布未受影响数据 修复成功后缺口恢复 |
| AC-DATASERVICE-006-S01 | TASK-DATASERVICE-001, TASK-DATASERVICE-002, TASK-DATASERVICE-003, TASK-DATASERVICE-004, TASK-DATASERVICE-005, TASK-DATASERVICE-006, TASK-DATASERVICE-007, TASK-DATASERVICE-008, TASK-DATASERVICE-009, TASK-DATASERVICE-010, TASK-DATASERVICE-011, TASK-DATASERVICE-012, TASK-DATASERVICE-013, TASK-DATASERVICE-014, TASK-DATASERVICE-015, TASK-DATASERVICE-016 | CMD-DATASERVICE-054, CMD-DATASERVICE-055, CMD-DATASERVICE-056, CMD-DATASERVICE-063, CMD-DATASERVICE-064, CMD-DATASERVICE-065, CMD-DATASERVICE-069, CMD-DATASERVICE-070, CMD-DATASERVICE-071, CMD-DATASERVICE-003, CMD-DATASERVICE-004, CMD-DATASERVICE-005, CMD-DATASERVICE-006, CMD-DATASERVICE-007, CMD-DATASERVICE-008, CMD-DATASERVICE-009, CMD-DATASERVICE-010, CMD-DATASERVICE-011, CMD-DATASERVICE-012, CMD-DATASERVICE-013, CMD-DATASERVICE-014, CMD-DATASERVICE-015, CMD-DATASERVICE-016, CMD-DATASERVICE-017, CMD-DATASERVICE-018, CMD-DATASERVICE-019, CMD-DATASERVICE-020, CMD-DATASERVICE-021, CMD-DATASERVICE-022, CMD-DATASERVICE-023, CMD-DATASERVICE-024, CMD-DATASERVICE-025, CMD-DATASERVICE-026, CMD-DATASERVICE-027, CMD-DATASERVICE-028, CMD-DATASERVICE-029, CMD-DATASERVICE-030, CMD-DATASERVICE-031, CMD-DATASERVICE-032, CMD-DATASERVICE-033, CMD-DATASERVICE-034, CMD-DATASERVICE-035, CMD-DATASERVICE-036, CMD-DATASERVICE-037, CMD-DATASERVICE-038, CMD-DATASERVICE-039, CMD-DATASERVICE-040, CMD-DATASERVICE-041, CMD-DATASERVICE-042, CMD-DATASERVICE-087, CMD-DATASERVICE-090; EVD-DATASERVICE-004, EVD-DATASERVICE-007, EVD-DATASERVICE-009, EVD-DATASERVICE-015, EVD-DATASERVICE-022 | pass 单周期和多周期图表读取同一descriptor并显示o |
| AC-DATASERVICE-007-S01 | TASK-DATASERVICE-001, TASK-DATASERVICE-002, TASK-DATASERVICE-003, TASK-DATASERVICE-004, TASK-DATASERVICE-005, TASK-DATASERVICE-006, TASK-DATASERVICE-007, TASK-DATASERVICE-008, TASK-DATASERVICE-009, TASK-DATASERVICE-010, TASK-DATASERVICE-011, TASK-DATASERVICE-012, TASK-DATASERVICE-013, TASK-DATASERVICE-014, TASK-DATASERVICE-015, TASK-DATASERVICE-016 | CMD-DATASERVICE-054, CMD-DATASERVICE-055, CMD-DATASERVICE-056, CMD-DATASERVICE-069, CMD-DATASERVICE-070, CMD-DATASERVICE-071, CMD-DATASERVICE-003, CMD-DATASERVICE-004, CMD-DATASERVICE-005, CMD-DATASERVICE-006, CMD-DATASERVICE-007, CMD-DATASERVICE-008, CMD-DATASERVICE-009, CMD-DATASERVICE-010, CMD-DATASERVICE-011, CMD-DATASERVICE-012, CMD-DATASERVICE-013, CMD-DATASERVICE-014, CMD-DATASERVICE-015, CMD-DATASERVICE-016, CMD-DATASERVICE-017, CMD-DATASERVICE-018, CMD-DATASERVICE-019, CMD-DATASERVICE-020, CMD-DATASERVICE-021, CMD-DATASERVICE-022, CMD-DATASERVICE-023, CMD-DATASERVICE-024, CMD-DATASERVICE-025, CMD-DATASERVICE-026, CMD-DATASERVICE-027, CMD-DATASERVICE-028, CMD-DATASERVICE-029, CMD-DATASERVICE-030, CMD-DATASERVICE-031, CMD-DATASERVICE-032, CMD-DATASERVICE-033, CMD-DATASERVICE-034, CMD-DATASERVICE-035, CMD-DATASERVICE-036, CMD-DATASERVICE-037, CMD-DATASERVICE-038, CMD-DATASERVICE-039, CMD-DATASERVICE-040, CMD-DATASERVICE-041, CMD-DATASERVICE-042, CMD-DATASERVICE-087, CMD-DATASERVICE-090; EVD-DATASERVICE-004, EVD-DATASERVICE-009, EVD-DATASERVICE-015, EVD-DATASERVICE-023 | pass 四组period start/open/current_bar_start_ix逐项成立 |
| AC-DATASERVICE-008-S01 | TASK-DATASERVICE-001, TASK-DATASERVICE-002, TASK-DATASERVICE-003, TASK-DATASERVICE-004, TASK-DATASERVICE-005, TASK-DATASERVICE-006, TASK-DATASERVICE-007, TASK-DATASERVICE-008, TASK-DATASERVICE-009, TASK-DATASERVICE-010, TASK-DATASERVICE-011, TASK-DATASERVICE-012, TASK-DATASERVICE-013, TASK-DATASERVICE-014, TASK-DATASERVICE-015, TASK-DATASERVICE-016 | CMD-DATASERVICE-057, CMD-DATASERVICE-058, CMD-DATASERVICE-059, CMD-DATASERVICE-063, CMD-DATASERVICE-064, CMD-DATASERVICE-065, CMD-DATASERVICE-069, CMD-DATASERVICE-070, CMD-DATASERVICE-071, CMD-DATASERVICE-003, CMD-DATASERVICE-004, CMD-DATASERVICE-005, CMD-DATASERVICE-006, CMD-DATASERVICE-007, CMD-DATASERVICE-008, CMD-DATASERVICE-009, CMD-DATASERVICE-010, CMD-DATASERVICE-011, CMD-DATASERVICE-012, CMD-DATASERVICE-013, CMD-DATASERVICE-014, CMD-DATASERVICE-015, CMD-DATASERVICE-016, CMD-DATASERVICE-017, CMD-DATASERVICE-018, CMD-DATASERVICE-019, CMD-DATASERVICE-020, CMD-DATASERVICE-021, CMD-DATASERVICE-022, CMD-DATASERVICE-023, CMD-DATASERVICE-024, CMD-DATASERVICE-025, CMD-DATASERVICE-026, CMD-DATASERVICE-027, CMD-DATASERVICE-028, CMD-DATASERVICE-029, CMD-DATASERVICE-030, CMD-DATASERVICE-031, CMD-DATASERVICE-032, CMD-DATASERVICE-033, CMD-DATASERVICE-034, CMD-DATASERVICE-035, CMD-DATASERVICE-036, CMD-DATASERVICE-037, CMD-DATASERVICE-038, CMD-DATASERVICE-039, CMD-DATASERVICE-040, CMD-DATASERVICE-041, CMD-DATASERVICE-042, CMD-DATASERVICE-087, CMD-DATASERVICE-090; EVD-DATASERVICE-005, EVD-DATASERVICE-007, EVD-DATASERVICE-009, EVD-DATASERVICE-015, EVD-DATASERVICE-024 | pass 缺失起点全程没有伪造4h bar 恢复后只发布正确值 |
| AC-DATASERVICE-009-S01 | TASK-DATASERVICE-001, TASK-DATASERVICE-002, TASK-DATASERVICE-003, TASK-DATASERVICE-004, TASK-DATASERVICE-005, TASK-DATASERVICE-006, TASK-DATASERVICE-007, TASK-DATASERVICE-008, TASK-DATASERVICE-009, TASK-DATASERVICE-010, TASK-DATASERVICE-011, TASK-DATASERVICE-012, TASK-DATASERVICE-013, TASK-DATASERVICE-014, TASK-DATASERVICE-015, TASK-DATASERVICE-016 | CMD-DATASERVICE-045, CMD-DATASERVICE-046, CMD-DATASERVICE-047, CMD-DATASERVICE-051, CMD-DATASERVICE-052, CMD-DATASERVICE-053, CMD-DATASERVICE-054, CMD-DATASERVICE-055, CMD-DATASERVICE-056, CMD-DATASERVICE-003, CMD-DATASERVICE-004, CMD-DATASERVICE-005, CMD-DATASERVICE-006, CMD-DATASERVICE-007, CMD-DATASERVICE-008, CMD-DATASERVICE-009, CMD-DATASERVICE-010, CMD-DATASERVICE-011, CMD-DATASERVICE-012, CMD-DATASERVICE-013, CMD-DATASERVICE-014, CMD-DATASERVICE-015, CMD-DATASERVICE-016, CMD-DATASERVICE-017, CMD-DATASERVICE-018, CMD-DATASERVICE-019, CMD-DATASERVICE-020, CMD-DATASERVICE-021, CMD-DATASERVICE-022, CMD-DATASERVICE-023, CMD-DATASERVICE-024, CMD-DATASERVICE-025, CMD-DATASERVICE-026, CMD-DATASERVICE-027, CMD-DATASERVICE-028, CMD-DATASERVICE-029, CMD-DATASERVICE-030, CMD-DATASERVICE-031, CMD-DATASERVICE-032, CMD-DATASERVICE-033, CMD-DATASERVICE-034, CMD-DATASERVICE-035, CMD-DATASERVICE-036, CMD-DATASERVICE-037, CMD-DATASERVICE-038, CMD-DATASERVICE-039, CMD-DATASERVICE-040, CMD-DATASERVICE-041, CMD-DATASERVICE-042, CMD-DATASERVICE-087, CMD-DATASERVICE-090, CMD-DATASERVICE-059, CMD-DATASERVICE-062, CMD-DATASERVICE-065, CMD-DATASERVICE-068, CMD-DATASERVICE-071, CMD-DATASERVICE-074, CMD-DATASERVICE-077, CMD-DATASERVICE-080, CMD-DATASERVICE-083, CMD-DATASERVICE-086, CMD-DATASERVICE-092; EVD-DATASERVICE-001, EVD-DATASERVICE-003, EVD-DATASERVICE-004, EVD-DATASERVICE-015, EVD-DATASERVICE-016, EVD-DATASERVICE-025 | pass ohlcv与 822c715e6 同输入characterization逐字段一致 |
| AC-DATASERVICE-009-S02 | TASK-DATASERVICE-001, TASK-DATASERVICE-002, TASK-DATASERVICE-003, TASK-DATASERVICE-004, TASK-DATASERVICE-005, TASK-DATASERVICE-006, TASK-DATASERVICE-007, TASK-DATASERVICE-008, TASK-DATASERVICE-009, TASK-DATASERVICE-010, TASK-DATASERVICE-011, TASK-DATASERVICE-012, TASK-DATASERVICE-013, TASK-DATASERVICE-014, TASK-DATASERVICE-015, TASK-DATASERVICE-016 | CMD-DATASERVICE-045, CMD-DATASERVICE-046, CMD-DATASERVICE-047, CMD-DATASERVICE-051, CMD-DATASERVICE-052, CMD-DATASERVICE-053, CMD-DATASERVICE-054, CMD-DATASERVICE-055, CMD-DATASERVICE-056, CMD-DATASERVICE-078, CMD-DATASERVICE-079, CMD-DATASERVICE-080, CMD-DATASERVICE-003, CMD-DATASERVICE-004, CMD-DATASERVICE-005, CMD-DATASERVICE-006, CMD-DATASERVICE-007, CMD-DATASERVICE-008, CMD-DATASERVICE-009, CMD-DATASERVICE-010, CMD-DATASERVICE-011, CMD-DATASERVICE-012, CMD-DATASERVICE-013, CMD-DATASERVICE-014, CMD-DATASERVICE-015, CMD-DATASERVICE-016, CMD-DATASERVICE-017, CMD-DATASERVICE-018, CMD-DATASERVICE-019, CMD-DATASERVICE-020, CMD-DATASERVICE-021, CMD-DATASERVICE-022, CMD-DATASERVICE-023, CMD-DATASERVICE-024, CMD-DATASERVICE-025, CMD-DATASERVICE-026, CMD-DATASERVICE-027, CMD-DATASERVICE-028, CMD-DATASERVICE-029, CMD-DATASERVICE-030, CMD-DATASERVICE-031, CMD-DATASERVICE-032, CMD-DATASERVICE-033, CMD-DATASERVICE-034, CMD-DATASERVICE-035, CMD-DATASERVICE-036, CMD-DATASERVICE-037, CMD-DATASERVICE-038, CMD-DATASERVICE-039, CMD-DATASERVICE-040, CMD-DATASERVICE-041, CMD-DATASERVICE-042, CMD-DATASERVICE-087, CMD-DATASERVICE-090, CMD-DATASERVICE-059, CMD-DATASERVICE-062, CMD-DATASERVICE-065, CMD-DATASERVICE-068, CMD-DATASERVICE-071, CMD-DATASERVICE-074, CMD-DATASERVICE-077, CMD-DATASERVICE-083, CMD-DATASERVICE-086, CMD-DATASERVICE-092; EVD-DATASERVICE-001, EVD-DATASERVICE-003, EVD-DATASERVICE-004, EVD-DATASERVICE-012, EVD-DATASERVICE-015, EVD-DATASERVICE-016, EVD-DATASERVICE-041 | pass 外部投递计数等于fixture事件数 聚合结果与单次输入一致 |
| AC-DATASERVICE-010-S01 | TASK-DATASERVICE-001, TASK-DATASERVICE-002, TASK-DATASERVICE-003, TASK-DATASERVICE-004, TASK-DATASERVICE-005, TASK-DATASERVICE-006, TASK-DATASERVICE-007, TASK-DATASERVICE-008, TASK-DATASERVICE-009, TASK-DATASERVICE-010, TASK-DATASERVICE-011, TASK-DATASERVICE-012, TASK-DATASERVICE-013, TASK-DATASERVICE-014, TASK-DATASERVICE-015, TASK-DATASERVICE-016 | CMD-DATASERVICE-054, CMD-DATASERVICE-055, CMD-DATASERVICE-056, CMD-DATASERVICE-078, CMD-DATASERVICE-079, CMD-DATASERVICE-080, CMD-DATASERVICE-003, CMD-DATASERVICE-004, CMD-DATASERVICE-005, CMD-DATASERVICE-006, CMD-DATASERVICE-007, CMD-DATASERVICE-008, CMD-DATASERVICE-009, CMD-DATASERVICE-010, CMD-DATASERVICE-011, CMD-DATASERVICE-012, CMD-DATASERVICE-013, CMD-DATASERVICE-014, CMD-DATASERVICE-015, CMD-DATASERVICE-016, CMD-DATASERVICE-017, CMD-DATASERVICE-018, CMD-DATASERVICE-019, CMD-DATASERVICE-020, CMD-DATASERVICE-021, CMD-DATASERVICE-022, CMD-DATASERVICE-023, CMD-DATASERVICE-024, CMD-DATASERVICE-025, CMD-DATASERVICE-026, CMD-DATASERVICE-027, CMD-DATASERVICE-028, CMD-DATASERVICE-029, CMD-DATASERVICE-030, CMD-DATASERVICE-031, CMD-DATASERVICE-032, CMD-DATASERVICE-033, CMD-DATASERVICE-034, CMD-DATASERVICE-035, CMD-DATASERVICE-036, CMD-DATASERVICE-037, CMD-DATASERVICE-038, CMD-DATASERVICE-039, CMD-DATASERVICE-040, CMD-DATASERVICE-041, CMD-DATASERVICE-042, CMD-DATASERVICE-087, CMD-DATASERVICE-090, CMD-DATASERVICE-053, CMD-DATASERVICE-059, CMD-DATASERVICE-062, CMD-DATASERVICE-065, CMD-DATASERVICE-068, CMD-DATASERVICE-071, CMD-DATASERVICE-074, CMD-DATASERVICE-077, CMD-DATASERVICE-083, CMD-DATASERVICE-086, CMD-DATASERVICE-092; EVD-DATASERVICE-004, EVD-DATASERVICE-012, EVD-DATASERVICE-015, EVD-DATASERVICE-016, EVD-DATASERVICE-026 | pass 每种连续性按第4.5节独立处置 |
| AC-DATASERVICE-011-S01 | TASK-DATASERVICE-001, TASK-DATASERVICE-002, TASK-DATASERVICE-003, TASK-DATASERVICE-004, TASK-DATASERVICE-005, TASK-DATASERVICE-006, TASK-DATASERVICE-007, TASK-DATASERVICE-008, TASK-DATASERVICE-009, TASK-DATASERVICE-010, TASK-DATASERVICE-011, TASK-DATASERVICE-012, TASK-DATASERVICE-013, TASK-DATASERVICE-014, TASK-DATASERVICE-015, TASK-DATASERVICE-016 | CMD-DATASERVICE-045, CMD-DATASERVICE-046, CMD-DATASERVICE-047, CMD-DATASERVICE-066, CMD-DATASERVICE-067, CMD-DATASERVICE-068, CMD-DATASERVICE-069, CMD-DATASERVICE-070, CMD-DATASERVICE-071, CMD-DATASERVICE-003, CMD-DATASERVICE-004, CMD-DATASERVICE-005, CMD-DATASERVICE-006, CMD-DATASERVICE-007, CMD-DATASERVICE-008, CMD-DATASERVICE-009, CMD-DATASERVICE-010, CMD-DATASERVICE-011, CMD-DATASERVICE-012, CMD-DATASERVICE-013, CMD-DATASERVICE-014, CMD-DATASERVICE-015, CMD-DATASERVICE-016, CMD-DATASERVICE-017, CMD-DATASERVICE-018, CMD-DATASERVICE-019, CMD-DATASERVICE-020, CMD-DATASERVICE-021, CMD-DATASERVICE-022, CMD-DATASERVICE-023, CMD-DATASERVICE-024, CMD-DATASERVICE-025, CMD-DATASERVICE-026, CMD-DATASERVICE-027, CMD-DATASERVICE-028, CMD-DATASERVICE-029, CMD-DATASERVICE-030, CMD-DATASERVICE-031, CMD-DATASERVICE-032, CMD-DATASERVICE-033, CMD-DATASERVICE-034, CMD-DATASERVICE-035, CMD-DATASERVICE-036, CMD-DATASERVICE-037, CMD-DATASERVICE-038, CMD-DATASERVICE-039, CMD-DATASERVICE-040, CMD-DATASERVICE-041, CMD-DATASERVICE-042, CMD-DATASERVICE-087, CMD-DATASERVICE-090, CMD-DATASERVICE-053, CMD-DATASERVICE-056, CMD-DATASERVICE-059, CMD-DATASERVICE-062, CMD-DATASERVICE-065, CMD-DATASERVICE-074, CMD-DATASERVICE-077, CMD-DATASERVICE-080, CMD-DATASERVICE-083, CMD-DATASERVICE-086, CMD-DATASERVICE-092; EVD-DATASERVICE-001, EVD-DATASERVICE-008, EVD-DATASERVICE-009, EVD-DATASERVICE-015, EVD-DATASERVICE-016, EVD-DATASERVICE-027 | pass lmdb u0/u1 映射值和plotdataitem实际xdata/ydata逐点一致 |
| AC-DATASERVICE-012-S01 | TASK-DATASERVICE-001, TASK-DATASERVICE-002, TASK-DATASERVICE-003, TASK-DATASERVICE-004, TASK-DATASERVICE-005, TASK-DATASERVICE-006, TASK-DATASERVICE-007, TASK-DATASERVICE-008, TASK-DATASERVICE-009, TASK-DATASERVICE-010, TASK-DATASERVICE-011, TASK-DATASERVICE-012, TASK-DATASERVICE-013, TASK-DATASERVICE-014, TASK-DATASERVICE-015, TASK-DATASERVICE-016 | CMD-DATASERVICE-045, CMD-DATASERVICE-046, CMD-DATASERVICE-047, CMD-DATASERVICE-066, CMD-DATASERVICE-067, CMD-DATASERVICE-068, CMD-DATASERVICE-069, CMD-DATASERVICE-070, CMD-DATASERVICE-071, CMD-DATASERVICE-003, CMD-DATASERVICE-004, CMD-DATASERVICE-005, CMD-DATASERVICE-006, CMD-DATASERVICE-007, CMD-DATASERVICE-008, CMD-DATASERVICE-009, CMD-DATASERVICE-010, CMD-DATASERVICE-011, CMD-DATASERVICE-012, CMD-DATASERVICE-013, CMD-DATASERVICE-014, CMD-DATASERVICE-015, CMD-DATASERVICE-016, CMD-DATASERVICE-017, CMD-DATASERVICE-018, CMD-DATASERVICE-019, CMD-DATASERVICE-020, CMD-DATASERVICE-021, CMD-DATASERVICE-022, CMD-DATASERVICE-023, CMD-DATASERVICE-024, CMD-DATASERVICE-025, CMD-DATASERVICE-026, CMD-DATASERVICE-027, CMD-DATASERVICE-028, CMD-DATASERVICE-029, CMD-DATASERVICE-030, CMD-DATASERVICE-031, CMD-DATASERVICE-032, CMD-DATASERVICE-033, CMD-DATASERVICE-034, CMD-DATASERVICE-035, CMD-DATASERVICE-036, CMD-DATASERVICE-037, CMD-DATASERVICE-038, CMD-DATASERVICE-039, CMD-DATASERVICE-040, CMD-DATASERVICE-041, CMD-DATASERVICE-042, CMD-DATASERVICE-087, CMD-DATASERVICE-090, CMD-DATASERVICE-053, CMD-DATASERVICE-056, CMD-DATASERVICE-059, CMD-DATASERVICE-062, CMD-DATASERVICE-065, CMD-DATASERVICE-074, CMD-DATASERVICE-077, CMD-DATASERVICE-080, CMD-DATASERVICE-083, CMD-DATASERVICE-086, CMD-DATASERVICE-092; EVD-DATASERVICE-001, EVD-DATASERVICE-008, EVD-DATASERVICE-009, EVD-DATASERVICE-015, EVD-DATASERVICE-016, EVD-DATASERVICE-028 | pass boll lower_higher_trend trend_state_machine完整通过 其他manifest指标smoke通过 |
| AC-DATASERVICE-013-S01 | TASK-DATASERVICE-001, TASK-DATASERVICE-002, TASK-DATASERVICE-003, TASK-DATASERVICE-004, TASK-DATASERVICE-005, TASK-DATASERVICE-006, TASK-DATASERVICE-007, TASK-DATASERVICE-008, TASK-DATASERVICE-009, TASK-DATASERVICE-010, TASK-DATASERVICE-011, TASK-DATASERVICE-012, TASK-DATASERVICE-013, TASK-DATASERVICE-014, TASK-DATASERVICE-015, TASK-DATASERVICE-016 | CMD-DATASERVICE-066, CMD-DATASERVICE-067, CMD-DATASERVICE-068, CMD-DATASERVICE-069, CMD-DATASERVICE-070, CMD-DATASERVICE-071, CMD-DATASERVICE-003, CMD-DATASERVICE-004, CMD-DATASERVICE-005, CMD-DATASERVICE-006, CMD-DATASERVICE-007, CMD-DATASERVICE-008, CMD-DATASERVICE-009, CMD-DATASERVICE-010, CMD-DATASERVICE-011, CMD-DATASERVICE-012, CMD-DATASERVICE-013, CMD-DATASERVICE-014, CMD-DATASERVICE-015, CMD-DATASERVICE-016, CMD-DATASERVICE-017, CMD-DATASERVICE-018, CMD-DATASERVICE-019, CMD-DATASERVICE-020, CMD-DATASERVICE-021, CMD-DATASERVICE-022, CMD-DATASERVICE-023, CMD-DATASERVICE-024, CMD-DATASERVICE-025, CMD-DATASERVICE-026, CMD-DATASERVICE-027, CMD-DATASERVICE-028, CMD-DATASERVICE-029, CMD-DATASERVICE-030, CMD-DATASERVICE-031, CMD-DATASERVICE-032, CMD-DATASERVICE-033, CMD-DATASERVICE-034, CMD-DATASERVICE-035, CMD-DATASERVICE-036, CMD-DATASERVICE-037, CMD-DATASERVICE-038, CMD-DATASERVICE-039, CMD-DATASERVICE-040, CMD-DATASERVICE-041, CMD-DATASERVICE-042, CMD-DATASERVICE-087, CMD-DATASERVICE-090, CMD-DATASERVICE-053, CMD-DATASERVICE-056, CMD-DATASERVICE-059, CMD-DATASERVICE-062, CMD-DATASERVICE-065, CMD-DATASERVICE-074, CMD-DATASERVICE-077, CMD-DATASERVICE-080, CMD-DATASERVICE-083, CMD-DATASERVICE-086, CMD-DATASERVICE-092; EVD-DATASERVICE-008, EVD-DATASERVICE-009, EVD-DATASERVICE-015, EVD-DATASERVICE-016, EVD-DATASERVICE-029 | pass cold和warm两次最终绘图完全一致 第二次命中lmdb |
| AC-DATASERVICE-013-S02 | TASK-DATASERVICE-001, TASK-DATASERVICE-002, TASK-DATASERVICE-003, TASK-DATASERVICE-004, TASK-DATASERVICE-005, TASK-DATASERVICE-006, TASK-DATASERVICE-007, TASK-DATASERVICE-008, TASK-DATASERVICE-009, TASK-DATASERVICE-010, TASK-DATASERVICE-011, TASK-DATASERVICE-012, TASK-DATASERVICE-013, TASK-DATASERVICE-014, TASK-DATASERVICE-015, TASK-DATASERVICE-016 | CMD-DATASERVICE-057, CMD-DATASERVICE-058, CMD-DATASERVICE-059, CMD-DATASERVICE-063, CMD-DATASERVICE-064, CMD-DATASERVICE-065, CMD-DATASERVICE-066, CMD-DATASERVICE-067, CMD-DATASERVICE-068, CMD-DATASERVICE-069, CMD-DATASERVICE-070, CMD-DATASERVICE-071, CMD-DATASERVICE-003, CMD-DATASERVICE-004, CMD-DATASERVICE-005, CMD-DATASERVICE-006, CMD-DATASERVICE-007, CMD-DATASERVICE-008, CMD-DATASERVICE-009, CMD-DATASERVICE-010, CMD-DATASERVICE-011, CMD-DATASERVICE-012, CMD-DATASERVICE-013, CMD-DATASERVICE-014, CMD-DATASERVICE-015, CMD-DATASERVICE-016, CMD-DATASERVICE-017, CMD-DATASERVICE-018, CMD-DATASERVICE-019, CMD-DATASERVICE-020, CMD-DATASERVICE-021, CMD-DATASERVICE-022, CMD-DATASERVICE-023, CMD-DATASERVICE-024, CMD-DATASERVICE-025, CMD-DATASERVICE-026, CMD-DATASERVICE-027, CMD-DATASERVICE-028, CMD-DATASERVICE-029, CMD-DATASERVICE-030, CMD-DATASERVICE-031, CMD-DATASERVICE-032, CMD-DATASERVICE-033, CMD-DATASERVICE-034, CMD-DATASERVICE-035, CMD-DATASERVICE-036, CMD-DATASERVICE-037, CMD-DATASERVICE-038, CMD-DATASERVICE-039, CMD-DATASERVICE-040, CMD-DATASERVICE-041, CMD-DATASERVICE-042, CMD-DATASERVICE-087, CMD-DATASERVICE-090, CMD-DATASERVICE-053, CMD-DATASERVICE-056, CMD-DATASERVICE-062, CMD-DATASERVICE-074, CMD-DATASERVICE-077, CMD-DATASERVICE-080, CMD-DATASERVICE-083, CMD-DATASERVICE-086, CMD-DATASERVICE-092; EVD-DATASERVICE-005, EVD-DATASERVICE-007, EVD-DATASERVICE-008, EVD-DATASERVICE-009, EVD-DATASERVICE-015, EVD-DATASERVICE-016, EVD-DATASERVICE-042 | pass 用户看到缺口而非跨缺口连线或伪造k线 其他segment仍显示 |
| AC-DATASERVICE-014-S01 | TASK-DATASERVICE-001, TASK-DATASERVICE-002, TASK-DATASERVICE-003, TASK-DATASERVICE-004, TASK-DATASERVICE-005, TASK-DATASERVICE-006, TASK-DATASERVICE-007, TASK-DATASERVICE-008, TASK-DATASERVICE-009, TASK-DATASERVICE-010, TASK-DATASERVICE-011, TASK-DATASERVICE-012, TASK-DATASERVICE-013, TASK-DATASERVICE-014, TASK-DATASERVICE-015, TASK-DATASERVICE-016 | CMD-DATASERVICE-072, CMD-DATASERVICE-073, CMD-DATASERVICE-074, CMD-DATASERVICE-075, CMD-DATASERVICE-076, CMD-DATASERVICE-077, CMD-DATASERVICE-003, CMD-DATASERVICE-004, CMD-DATASERVICE-005, CMD-DATASERVICE-006, CMD-DATASERVICE-007, CMD-DATASERVICE-008, CMD-DATASERVICE-009, CMD-DATASERVICE-010, CMD-DATASERVICE-011, CMD-DATASERVICE-012, CMD-DATASERVICE-013, CMD-DATASERVICE-014, CMD-DATASERVICE-015, CMD-DATASERVICE-016, CMD-DATASERVICE-017, CMD-DATASERVICE-018, CMD-DATASERVICE-019, CMD-DATASERVICE-020, CMD-DATASERVICE-021, CMD-DATASERVICE-022, CMD-DATASERVICE-023, CMD-DATASERVICE-024, CMD-DATASERVICE-025, CMD-DATASERVICE-026, CMD-DATASERVICE-027, CMD-DATASERVICE-028, CMD-DATASERVICE-029, CMD-DATASERVICE-030, CMD-DATASERVICE-031, CMD-DATASERVICE-032, CMD-DATASERVICE-033, CMD-DATASERVICE-034, CMD-DATASERVICE-035, CMD-DATASERVICE-036, CMD-DATASERVICE-037, CMD-DATASERVICE-038, CMD-DATASERVICE-039, CMD-DATASERVICE-040, CMD-DATASERVICE-041, CMD-DATASERVICE-042, CMD-DATASERVICE-087, CMD-DATASERVICE-090, CMD-DATASERVICE-053, CMD-DATASERVICE-056, CMD-DATASERVICE-059, CMD-DATASERVICE-062, CMD-DATASERVICE-065, CMD-DATASERVICE-068, CMD-DATASERVICE-071, CMD-DATASERVICE-080, CMD-DATASERVICE-083, CMD-DATASERVICE-086, CMD-DATASERVICE-092; EVD-DATASERVICE-010, EVD-DATASERVICE-011, EVD-DATASERVICE-015, EVD-DATASERVICE-016, EVD-DATASERVICE-030 | pass dataservice收到recorder config命令次数为0 非active实时订阅增加数为0 |
| AC-DATASERVICE-015-S01 | TASK-DATASERVICE-001, TASK-DATASERVICE-002, TASK-DATASERVICE-003, TASK-DATASERVICE-004, TASK-DATASERVICE-005, TASK-DATASERVICE-006, TASK-DATASERVICE-007, TASK-DATASERVICE-008, TASK-DATASERVICE-009, TASK-DATASERVICE-010, TASK-DATASERVICE-011, TASK-DATASERVICE-012, TASK-DATASERVICE-013, TASK-DATASERVICE-014, TASK-DATASERVICE-015, TASK-DATASERVICE-016 | CMD-DATASERVICE-045, CMD-DATASERVICE-046, CMD-DATASERVICE-047, CMD-DATASERVICE-060, CMD-DATASERVICE-061, CMD-DATASERVICE-062, CMD-DATASERVICE-072, CMD-DATASERVICE-073, CMD-DATASERVICE-074, CMD-DATASERVICE-075, CMD-DATASERVICE-076, CMD-DATASERVICE-077, CMD-DATASERVICE-003, CMD-DATASERVICE-004, CMD-DATASERVICE-005, CMD-DATASERVICE-006, CMD-DATASERVICE-007, CMD-DATASERVICE-008, CMD-DATASERVICE-009, CMD-DATASERVICE-010, CMD-DATASERVICE-011, CMD-DATASERVICE-012, CMD-DATASERVICE-013, CMD-DATASERVICE-014, CMD-DATASERVICE-015, CMD-DATASERVICE-016, CMD-DATASERVICE-017, CMD-DATASERVICE-018, CMD-DATASERVICE-019, CMD-DATASERVICE-020, CMD-DATASERVICE-021, CMD-DATASERVICE-022, CMD-DATASERVICE-023, CMD-DATASERVICE-024, CMD-DATASERVICE-025, CMD-DATASERVICE-026, CMD-DATASERVICE-027, CMD-DATASERVICE-028, CMD-DATASERVICE-029, CMD-DATASERVICE-030, CMD-DATASERVICE-031, CMD-DATASERVICE-032, CMD-DATASERVICE-033, CMD-DATASERVICE-034, CMD-DATASERVICE-035, CMD-DATASERVICE-036, CMD-DATASERVICE-037, CMD-DATASERVICE-038, CMD-DATASERVICE-039, CMD-DATASERVICE-040, CMD-DATASERVICE-041, CMD-DATASERVICE-042, CMD-DATASERVICE-087, CMD-DATASERVICE-090, CMD-DATASERVICE-053, CMD-DATASERVICE-056, CMD-DATASERVICE-059, CMD-DATASERVICE-065, CMD-DATASERVICE-068, CMD-DATASERVICE-071, CMD-DATASERVICE-080, CMD-DATASERVICE-083, CMD-DATASERVICE-086, CMD-DATASERVICE-092; EVD-DATASERVICE-001, EVD-DATASERVICE-006, EVD-DATASERVICE-010, EVD-DATASERVICE-011, EVD-DATASERVICE-015, EVD-DATASERVICE-016, EVD-DATASERVICE-031 | pass 日志 统计 db rows selected/skipped persistence group durable状态 checkpoint和ack逐项对应真实操作 |
| AC-DATASERVICE-016-S01 | TASK-DATASERVICE-001, TASK-DATASERVICE-002, TASK-DATASERVICE-003, TASK-DATASERVICE-004, TASK-DATASERVICE-005, TASK-DATASERVICE-006, TASK-DATASERVICE-007, TASK-DATASERVICE-008, TASK-DATASERVICE-009, TASK-DATASERVICE-010, TASK-DATASERVICE-011, TASK-DATASERVICE-012, TASK-DATASERVICE-013, TASK-DATASERVICE-014, TASK-DATASERVICE-015, TASK-DATASERVICE-016 | CMD-DATASERVICE-048, CMD-DATASERVICE-049, CMD-DATASERVICE-050, CMD-DATASERVICE-060, CMD-DATASERVICE-061, CMD-DATASERVICE-062, CMD-DATASERVICE-075, CMD-DATASERVICE-076, CMD-DATASERVICE-077, CMD-DATASERVICE-003, CMD-DATASERVICE-004, CMD-DATASERVICE-005, CMD-DATASERVICE-006, CMD-DATASERVICE-007, CMD-DATASERVICE-008, CMD-DATASERVICE-009, CMD-DATASERVICE-010, CMD-DATASERVICE-011, CMD-DATASERVICE-012, CMD-DATASERVICE-013, CMD-DATASERVICE-014, CMD-DATASERVICE-015, CMD-DATASERVICE-016, CMD-DATASERVICE-017, CMD-DATASERVICE-018, CMD-DATASERVICE-019, CMD-DATASERVICE-020, CMD-DATASERVICE-021, CMD-DATASERVICE-022, CMD-DATASERVICE-023, CMD-DATASERVICE-024, CMD-DATASERVICE-025, CMD-DATASERVICE-026, CMD-DATASERVICE-027, CMD-DATASERVICE-028, CMD-DATASERVICE-029, CMD-DATASERVICE-030, CMD-DATASERVICE-031, CMD-DATASERVICE-032, CMD-DATASERVICE-033, CMD-DATASERVICE-034, CMD-DATASERVICE-035, CMD-DATASERVICE-036, CMD-DATASERVICE-037, CMD-DATASERVICE-038, CMD-DATASERVICE-039, CMD-DATASERVICE-040, CMD-DATASERVICE-041, CMD-DATASERVICE-042, CMD-DATASERVICE-087, CMD-DATASERVICE-090, CMD-DATASERVICE-053, CMD-DATASERVICE-056, CMD-DATASERVICE-059, CMD-DATASERVICE-065, CMD-DATASERVICE-068, CMD-DATASERVICE-071, CMD-DATASERVICE-074, CMD-DATASERVICE-080, CMD-DATASERVICE-083, CMD-DATASERVICE-086, CMD-DATASERVICE-092; EVD-DATASERVICE-002, EVD-DATASERVICE-006, EVD-DATASERVICE-011, EVD-DATASERVICE-015, EVD-DATASERVICE-016, EVD-DATASERVICE-032 | pass checkpoint未越过未commit batch 重启后无sequence hole |
| AC-DATASERVICE-016-S02 | TASK-DATASERVICE-001, TASK-DATASERVICE-002, TASK-DATASERVICE-003, TASK-DATASERVICE-004, TASK-DATASERVICE-005, TASK-DATASERVICE-006, TASK-DATASERVICE-007, TASK-DATASERVICE-008, TASK-DATASERVICE-009, TASK-DATASERVICE-010, TASK-DATASERVICE-011, TASK-DATASERVICE-012, TASK-DATASERVICE-013, TASK-DATASERVICE-014, TASK-DATASERVICE-015, TASK-DATASERVICE-016 | CMD-DATASERVICE-060, CMD-DATASERVICE-061, CMD-DATASERVICE-062, CMD-DATASERVICE-075, CMD-DATASERVICE-076, CMD-DATASERVICE-077, CMD-DATASERVICE-003, CMD-DATASERVICE-004, CMD-DATASERVICE-005, CMD-DATASERVICE-006, CMD-DATASERVICE-007, CMD-DATASERVICE-008, CMD-DATASERVICE-009, CMD-DATASERVICE-010, CMD-DATASERVICE-011, CMD-DATASERVICE-012, CMD-DATASERVICE-013, CMD-DATASERVICE-014, CMD-DATASERVICE-015, CMD-DATASERVICE-016, CMD-DATASERVICE-017, CMD-DATASERVICE-018, CMD-DATASERVICE-019, CMD-DATASERVICE-020, CMD-DATASERVICE-021, CMD-DATASERVICE-022, CMD-DATASERVICE-023, CMD-DATASERVICE-024, CMD-DATASERVICE-025, CMD-DATASERVICE-026, CMD-DATASERVICE-027, CMD-DATASERVICE-028, CMD-DATASERVICE-029, CMD-DATASERVICE-030, CMD-DATASERVICE-031, CMD-DATASERVICE-032, CMD-DATASERVICE-033, CMD-DATASERVICE-034, CMD-DATASERVICE-035, CMD-DATASERVICE-036, CMD-DATASERVICE-037, CMD-DATASERVICE-038, CMD-DATASERVICE-039, CMD-DATASERVICE-040, CMD-DATASERVICE-041, CMD-DATASERVICE-042, CMD-DATASERVICE-087, CMD-DATASERVICE-090, CMD-DATASERVICE-053, CMD-DATASERVICE-056, CMD-DATASERVICE-059, CMD-DATASERVICE-065, CMD-DATASERVICE-068, CMD-DATASERVICE-071, CMD-DATASERVICE-074, CMD-DATASERVICE-080, CMD-DATASERVICE-083, CMD-DATASERVICE-086, CMD-DATASERVICE-092; EVD-DATASERVICE-006, EVD-DATASERVICE-011, EVD-DATASERVICE-015, EVD-DATASERVICE-016, EVD-DATASERVICE-043 | pass db每identity一行且事务字段完全相同 |
| AC-DATASERVICE-016-S03 | TASK-DATASERVICE-001, TASK-DATASERVICE-002, TASK-DATASERVICE-003, TASK-DATASERVICE-004, TASK-DATASERVICE-005, TASK-DATASERVICE-006, TASK-DATASERVICE-007, TASK-DATASERVICE-008, TASK-DATASERVICE-009, TASK-DATASERVICE-010, TASK-DATASERVICE-011, TASK-DATASERVICE-012, TASK-DATASERVICE-013, TASK-DATASERVICE-014, TASK-DATASERVICE-015, TASK-DATASERVICE-016 | CMD-DATASERVICE-060, CMD-DATASERVICE-061, CMD-DATASERVICE-062, CMD-DATASERVICE-075, CMD-DATASERVICE-076, CMD-DATASERVICE-077, CMD-DATASERVICE-003, CMD-DATASERVICE-004, CMD-DATASERVICE-005, CMD-DATASERVICE-006, CMD-DATASERVICE-007, CMD-DATASERVICE-008, CMD-DATASERVICE-009, CMD-DATASERVICE-010, CMD-DATASERVICE-011, CMD-DATASERVICE-012, CMD-DATASERVICE-013, CMD-DATASERVICE-014, CMD-DATASERVICE-015, CMD-DATASERVICE-016, CMD-DATASERVICE-017, CMD-DATASERVICE-018, CMD-DATASERVICE-019, CMD-DATASERVICE-020, CMD-DATASERVICE-021, CMD-DATASERVICE-022, CMD-DATASERVICE-023, CMD-DATASERVICE-024, CMD-DATASERVICE-025, CMD-DATASERVICE-026, CMD-DATASERVICE-027, CMD-DATASERVICE-028, CMD-DATASERVICE-029, CMD-DATASERVICE-030, CMD-DATASERVICE-031, CMD-DATASERVICE-032, CMD-DATASERVICE-033, CMD-DATASERVICE-034, CMD-DATASERVICE-035, CMD-DATASERVICE-036, CMD-DATASERVICE-037, CMD-DATASERVICE-038, CMD-DATASERVICE-039, CMD-DATASERVICE-040, CMD-DATASERVICE-041, CMD-DATASERVICE-042, CMD-DATASERVICE-087, CMD-DATASERVICE-090, CMD-DATASERVICE-053, CMD-DATASERVICE-056, CMD-DATASERVICE-059, CMD-DATASERVICE-065, CMD-DATASERVICE-068, CMD-DATASERVICE-071, CMD-DATASERVICE-074, CMD-DATASERVICE-080, CMD-DATASERVICE-083, CMD-DATASERVICE-086, CMD-DATASERVICE-092; EVD-DATASERVICE-006, EVD-DATASERVICE-011, EVD-DATASERVICE-015, EVD-DATASERVICE-016, EVD-DATASERVICE-044 | pass db不变 checkpoint不回退 producer释放该batch等待状态 |
| AC-DATASERVICE-016-S04 | TASK-DATASERVICE-001, TASK-DATASERVICE-002, TASK-DATASERVICE-003, TASK-DATASERVICE-004, TASK-DATASERVICE-005, TASK-DATASERVICE-006, TASK-DATASERVICE-007, TASK-DATASERVICE-008, TASK-DATASERVICE-009, TASK-DATASERVICE-010, TASK-DATASERVICE-011, TASK-DATASERVICE-012, TASK-DATASERVICE-013, TASK-DATASERVICE-014, TASK-DATASERVICE-015, TASK-DATASERVICE-016 | CMD-DATASERVICE-060, CMD-DATASERVICE-061, CMD-DATASERVICE-062, CMD-DATASERVICE-072, CMD-DATASERVICE-073, CMD-DATASERVICE-074, CMD-DATASERVICE-075, CMD-DATASERVICE-076, CMD-DATASERVICE-077, CMD-DATASERVICE-003, CMD-DATASERVICE-004, CMD-DATASERVICE-005, CMD-DATASERVICE-006, CMD-DATASERVICE-007, CMD-DATASERVICE-008, CMD-DATASERVICE-009, CMD-DATASERVICE-010, CMD-DATASERVICE-011, CMD-DATASERVICE-012, CMD-DATASERVICE-013, CMD-DATASERVICE-014, CMD-DATASERVICE-015, CMD-DATASERVICE-016, CMD-DATASERVICE-017, CMD-DATASERVICE-018, CMD-DATASERVICE-019, CMD-DATASERVICE-020, CMD-DATASERVICE-021, CMD-DATASERVICE-022, CMD-DATASERVICE-023, CMD-DATASERVICE-024, CMD-DATASERVICE-025, CMD-DATASERVICE-026, CMD-DATASERVICE-027, CMD-DATASERVICE-028, CMD-DATASERVICE-029, CMD-DATASERVICE-030, CMD-DATASERVICE-031, CMD-DATASERVICE-032, CMD-DATASERVICE-033, CMD-DATASERVICE-034, CMD-DATASERVICE-035, CMD-DATASERVICE-036, CMD-DATASERVICE-037, CMD-DATASERVICE-038, CMD-DATASERVICE-039, CMD-DATASERVICE-040, CMD-DATASERVICE-041, CMD-DATASERVICE-042, CMD-DATASERVICE-087, CMD-DATASERVICE-090, CMD-DATASERVICE-053, CMD-DATASERVICE-056, CMD-DATASERVICE-059, CMD-DATASERVICE-065, CMD-DATASERVICE-068, CMD-DATASERVICE-071, CMD-DATASERVICE-080, CMD-DATASERVICE-083, CMD-DATASERVICE-086, CMD-DATASERVICE-092; EVD-DATASERVICE-006, EVD-DATASERVICE-010, EVD-DATASERVICE-011, EVD-DATASERVICE-015, EVD-DATASERVICE-016, EVD-DATASERVICE-045 | pass 配置生效边界是首次消费 崩溃不改变旧决定 |
| AC-DATASERVICE-017-S01 | TASK-DATASERVICE-001, TASK-DATASERVICE-002, TASK-DATASERVICE-003, TASK-DATASERVICE-004, TASK-DATASERVICE-005, TASK-DATASERVICE-006, TASK-DATASERVICE-007, TASK-DATASERVICE-008, TASK-DATASERVICE-009, TASK-DATASERVICE-010, TASK-DATASERVICE-011, TASK-DATASERVICE-012, TASK-DATASERVICE-013, TASK-DATASERVICE-014, TASK-DATASERVICE-015, TASK-DATASERVICE-016 | CMD-DATASERVICE-045, CMD-DATASERVICE-046, CMD-DATASERVICE-047, CMD-DATASERVICE-078, CMD-DATASERVICE-079, CMD-DATASERVICE-080, CMD-DATASERVICE-003, CMD-DATASERVICE-004, CMD-DATASERVICE-005, CMD-DATASERVICE-006, CMD-DATASERVICE-007, CMD-DATASERVICE-008, CMD-DATASERVICE-009, CMD-DATASERVICE-010, CMD-DATASERVICE-011, CMD-DATASERVICE-012, CMD-DATASERVICE-013, CMD-DATASERVICE-014, CMD-DATASERVICE-015, CMD-DATASERVICE-016, CMD-DATASERVICE-017, CMD-DATASERVICE-018, CMD-DATASERVICE-019, CMD-DATASERVICE-020, CMD-DATASERVICE-021, CMD-DATASERVICE-022, CMD-DATASERVICE-023, CMD-DATASERVICE-024, CMD-DATASERVICE-025, CMD-DATASERVICE-026, CMD-DATASERVICE-027, CMD-DATASERVICE-028, CMD-DATASERVICE-029, CMD-DATASERVICE-030, CMD-DATASERVICE-031, CMD-DATASERVICE-032, CMD-DATASERVICE-033, CMD-DATASERVICE-034, CMD-DATASERVICE-035, CMD-DATASERVICE-036, CMD-DATASERVICE-037, CMD-DATASERVICE-038, CMD-DATASERVICE-039, CMD-DATASERVICE-040, CMD-DATASERVICE-041, CMD-DATASERVICE-042, CMD-DATASERVICE-087, CMD-DATASERVICE-090, CMD-DATASERVICE-053, CMD-DATASERVICE-056, CMD-DATASERVICE-059, CMD-DATASERVICE-062, CMD-DATASERVICE-065, CMD-DATASERVICE-068, CMD-DATASERVICE-071, CMD-DATASERVICE-074, CMD-DATASERVICE-077, CMD-DATASERVICE-083, CMD-DATASERVICE-086, CMD-DATASERVICE-092; EVD-DATASERVICE-001, EVD-DATASERVICE-012, EVD-DATASERVICE-015, EVD-DATASERVICE-016, EVD-DATASERVICE-033 | pass dataservice shared completed直接调用策略bar callback次数为0 |
| AC-DATASERVICE-018-S01 | TASK-DATASERVICE-001, TASK-DATASERVICE-002, TASK-DATASERVICE-003, TASK-DATASERVICE-004, TASK-DATASERVICE-005, TASK-DATASERVICE-006, TASK-DATASERVICE-007, TASK-DATASERVICE-008, TASK-DATASERVICE-009, TASK-DATASERVICE-010, TASK-DATASERVICE-011, TASK-DATASERVICE-012, TASK-DATASERVICE-013, TASK-DATASERVICE-014, TASK-DATASERVICE-015, TASK-DATASERVICE-016 | CMD-DATASERVICE-045, CMD-DATASERVICE-046, CMD-DATASERVICE-047, CMD-DATASERVICE-078, CMD-DATASERVICE-079, CMD-DATASERVICE-080, CMD-DATASERVICE-003, CMD-DATASERVICE-004, CMD-DATASERVICE-005, CMD-DATASERVICE-006, CMD-DATASERVICE-007, CMD-DATASERVICE-008, CMD-DATASERVICE-009, CMD-DATASERVICE-010, CMD-DATASERVICE-011, CMD-DATASERVICE-012, CMD-DATASERVICE-013, CMD-DATASERVICE-014, CMD-DATASERVICE-015, CMD-DATASERVICE-016, CMD-DATASERVICE-017, CMD-DATASERVICE-018, CMD-DATASERVICE-019, CMD-DATASERVICE-020, CMD-DATASERVICE-021, CMD-DATASERVICE-022, CMD-DATASERVICE-023, CMD-DATASERVICE-024, CMD-DATASERVICE-025, CMD-DATASERVICE-026, CMD-DATASERVICE-027, CMD-DATASERVICE-028, CMD-DATASERVICE-029, CMD-DATASERVICE-030, CMD-DATASERVICE-031, CMD-DATASERVICE-032, CMD-DATASERVICE-033, CMD-DATASERVICE-034, CMD-DATASERVICE-035, CMD-DATASERVICE-036, CMD-DATASERVICE-037, CMD-DATASERVICE-038, CMD-DATASERVICE-039, CMD-DATASERVICE-040, CMD-DATASERVICE-041, CMD-DATASERVICE-042, CMD-DATASERVICE-087, CMD-DATASERVICE-090, CMD-DATASERVICE-053, CMD-DATASERVICE-056, CMD-DATASERVICE-059, CMD-DATASERVICE-062, CMD-DATASERVICE-065, CMD-DATASERVICE-068, CMD-DATASERVICE-071, CMD-DATASERVICE-074, CMD-DATASERVICE-077, CMD-DATASERVICE-083, CMD-DATASERVICE-086, CMD-DATASERVICE-092; EVD-DATASERVICE-001, EVD-DATASERVICE-012, EVD-DATASERVICE-015, EVD-DATASERVICE-016, EVD-DATASERVICE-034 | pass 不依赖100ms ui轮询也能读取最新tick |
| AC-DATASERVICE-019-S01 | TASK-DATASERVICE-001, TASK-DATASERVICE-002, TASK-DATASERVICE-003, TASK-DATASERVICE-004, TASK-DATASERVICE-005, TASK-DATASERVICE-006, TASK-DATASERVICE-007, TASK-DATASERVICE-008, TASK-DATASERVICE-009, TASK-DATASERVICE-010, TASK-DATASERVICE-011, TASK-DATASERVICE-012, TASK-DATASERVICE-013, TASK-DATASERVICE-014, TASK-DATASERVICE-015, TASK-DATASERVICE-016 | CMD-DATASERVICE-045, CMD-DATASERVICE-046, CMD-DATASERVICE-047, CMD-DATASERVICE-051, CMD-DATASERVICE-052, CMD-DATASERVICE-053, CMD-DATASERVICE-078, CMD-DATASERVICE-079, CMD-DATASERVICE-080, CMD-DATASERVICE-003, CMD-DATASERVICE-004, CMD-DATASERVICE-005, CMD-DATASERVICE-006, CMD-DATASERVICE-007, CMD-DATASERVICE-008, CMD-DATASERVICE-009, CMD-DATASERVICE-010, CMD-DATASERVICE-011, CMD-DATASERVICE-012, CMD-DATASERVICE-013, CMD-DATASERVICE-014, CMD-DATASERVICE-015, CMD-DATASERVICE-016, CMD-DATASERVICE-017, CMD-DATASERVICE-018, CMD-DATASERVICE-019, CMD-DATASERVICE-020, CMD-DATASERVICE-021, CMD-DATASERVICE-022, CMD-DATASERVICE-023, CMD-DATASERVICE-024, CMD-DATASERVICE-025, CMD-DATASERVICE-026, CMD-DATASERVICE-027, CMD-DATASERVICE-028, CMD-DATASERVICE-029, CMD-DATASERVICE-030, CMD-DATASERVICE-031, CMD-DATASERVICE-032, CMD-DATASERVICE-033, CMD-DATASERVICE-034, CMD-DATASERVICE-035, CMD-DATASERVICE-036, CMD-DATASERVICE-037, CMD-DATASERVICE-038, CMD-DATASERVICE-039, CMD-DATASERVICE-040, CMD-DATASERVICE-041, CMD-DATASERVICE-042, CMD-DATASERVICE-087, CMD-DATASERVICE-090, CMD-DATASERVICE-056, CMD-DATASERVICE-059, CMD-DATASERVICE-062, CMD-DATASERVICE-065, CMD-DATASERVICE-068, CMD-DATASERVICE-071, CMD-DATASERVICE-074, CMD-DATASERVICE-077, CMD-DATASERVICE-083, CMD-DATASERVICE-086, CMD-DATASERVICE-092; EVD-DATASERVICE-001, EVD-DATASERVICE-003, EVD-DATASERVICE-012, EVD-DATASERVICE-015, EVD-DATASERVICE-016, EVD-DATASERVICE-035 | pass 同一tick不造成重复replace 旧actual tick被拒绝 |
| AC-DATASERVICE-020-S01 | TASK-DATASERVICE-001, TASK-DATASERVICE-002, TASK-DATASERVICE-003, TASK-DATASERVICE-004, TASK-DATASERVICE-005, TASK-DATASERVICE-006, TASK-DATASERVICE-007, TASK-DATASERVICE-008, TASK-DATASERVICE-009, TASK-DATASERVICE-010, TASK-DATASERVICE-011, TASK-DATASERVICE-012, TASK-DATASERVICE-013, TASK-DATASERVICE-014, TASK-DATASERVICE-015, TASK-DATASERVICE-016 | CMD-DATASERVICE-081, CMD-DATASERVICE-082, CMD-DATASERVICE-083, CMD-DATASERVICE-003, CMD-DATASERVICE-004, CMD-DATASERVICE-005, CMD-DATASERVICE-006, CMD-DATASERVICE-007, CMD-DATASERVICE-008, CMD-DATASERVICE-009, CMD-DATASERVICE-010, CMD-DATASERVICE-011, CMD-DATASERVICE-012, CMD-DATASERVICE-013, CMD-DATASERVICE-014, CMD-DATASERVICE-015, CMD-DATASERVICE-016, CMD-DATASERVICE-017, CMD-DATASERVICE-018, CMD-DATASERVICE-019, CMD-DATASERVICE-020, CMD-DATASERVICE-021, CMD-DATASERVICE-022, CMD-DATASERVICE-023, CMD-DATASERVICE-024, CMD-DATASERVICE-025, CMD-DATASERVICE-026, CMD-DATASERVICE-027, CMD-DATASERVICE-028, CMD-DATASERVICE-029, CMD-DATASERVICE-030, CMD-DATASERVICE-031, CMD-DATASERVICE-032, CMD-DATASERVICE-033, CMD-DATASERVICE-034, CMD-DATASERVICE-035, CMD-DATASERVICE-036, CMD-DATASERVICE-037, CMD-DATASERVICE-038, CMD-DATASERVICE-039, CMD-DATASERVICE-040, CMD-DATASERVICE-041, CMD-DATASERVICE-042, CMD-DATASERVICE-087, CMD-DATASERVICE-090, CMD-DATASERVICE-053, CMD-DATASERVICE-056, CMD-DATASERVICE-059, CMD-DATASERVICE-062, CMD-DATASERVICE-065, CMD-DATASERVICE-068, CMD-DATASERVICE-071, CMD-DATASERVICE-074, CMD-DATASERVICE-077, CMD-DATASERVICE-080, CMD-DATASERVICE-086, CMD-DATASERVICE-092; EVD-DATASERVICE-013, EVD-DATASERVICE-015, EVD-DATASERVICE-016, EVD-DATASERVICE-036 | pass ack后pending清除 trigger继续处理新tick |
| AC-DATASERVICE-020-S02 | TASK-DATASERVICE-001, TASK-DATASERVICE-002, TASK-DATASERVICE-003, TASK-DATASERVICE-004, TASK-DATASERVICE-005, TASK-DATASERVICE-006, TASK-DATASERVICE-007, TASK-DATASERVICE-008, TASK-DATASERVICE-009, TASK-DATASERVICE-010, TASK-DATASERVICE-011, TASK-DATASERVICE-012, TASK-DATASERVICE-013, TASK-DATASERVICE-014, TASK-DATASERVICE-015, TASK-DATASERVICE-016 | CMD-DATASERVICE-081, CMD-DATASERVICE-082, CMD-DATASERVICE-083, CMD-DATASERVICE-003, CMD-DATASERVICE-004, CMD-DATASERVICE-005, CMD-DATASERVICE-006, CMD-DATASERVICE-007, CMD-DATASERVICE-008, CMD-DATASERVICE-009, CMD-DATASERVICE-010, CMD-DATASERVICE-011, CMD-DATASERVICE-012, CMD-DATASERVICE-013, CMD-DATASERVICE-014, CMD-DATASERVICE-015, CMD-DATASERVICE-016, CMD-DATASERVICE-017, CMD-DATASERVICE-018, CMD-DATASERVICE-019, CMD-DATASERVICE-020, CMD-DATASERVICE-021, CMD-DATASERVICE-022, CMD-DATASERVICE-023, CMD-DATASERVICE-024, CMD-DATASERVICE-025, CMD-DATASERVICE-026, CMD-DATASERVICE-027, CMD-DATASERVICE-028, CMD-DATASERVICE-029, CMD-DATASERVICE-030, CMD-DATASERVICE-031, CMD-DATASERVICE-032, CMD-DATASERVICE-033, CMD-DATASERVICE-034, CMD-DATASERVICE-035, CMD-DATASERVICE-036, CMD-DATASERVICE-037, CMD-DATASERVICE-038, CMD-DATASERVICE-039, CMD-DATASERVICE-040, CMD-DATASERVICE-041, CMD-DATASERVICE-042, CMD-DATASERVICE-087, CMD-DATASERVICE-090, CMD-DATASERVICE-053, CMD-DATASERVICE-056, CMD-DATASERVICE-059, CMD-DATASERVICE-062, CMD-DATASERVICE-065, CMD-DATASERVICE-068, CMD-DATASERVICE-071, CMD-DATASERVICE-074, CMD-DATASERVICE-077, CMD-DATASERVICE-080, CMD-DATASERVICE-086, CMD-DATASERVICE-092; EVD-DATASERVICE-013, EVD-DATASERVICE-015, EVD-DATASERVICE-016, EVD-DATASERVICE-046 | pass 保护不会在三次后永久停止 ack恢复后状态回到ready |
| AC-DATASERVICE-020-S03 | TASK-DATASERVICE-001, TASK-DATASERVICE-002, TASK-DATASERVICE-003, TASK-DATASERVICE-004, TASK-DATASERVICE-005, TASK-DATASERVICE-006, TASK-DATASERVICE-007, TASK-DATASERVICE-008, TASK-DATASERVICE-009, TASK-DATASERVICE-010, TASK-DATASERVICE-011, TASK-DATASERVICE-012, TASK-DATASERVICE-013, TASK-DATASERVICE-014, TASK-DATASERVICE-015, TASK-DATASERVICE-016 | CMD-DATASERVICE-078, CMD-DATASERVICE-079, CMD-DATASERVICE-080, CMD-DATASERVICE-081, CMD-DATASERVICE-082, CMD-DATASERVICE-083, CMD-DATASERVICE-003, CMD-DATASERVICE-004, CMD-DATASERVICE-005, CMD-DATASERVICE-006, CMD-DATASERVICE-007, CMD-DATASERVICE-008, CMD-DATASERVICE-009, CMD-DATASERVICE-010, CMD-DATASERVICE-011, CMD-DATASERVICE-012, CMD-DATASERVICE-013, CMD-DATASERVICE-014, CMD-DATASERVICE-015, CMD-DATASERVICE-016, CMD-DATASERVICE-017, CMD-DATASERVICE-018, CMD-DATASERVICE-019, CMD-DATASERVICE-020, CMD-DATASERVICE-021, CMD-DATASERVICE-022, CMD-DATASERVICE-023, CMD-DATASERVICE-024, CMD-DATASERVICE-025, CMD-DATASERVICE-026, CMD-DATASERVICE-027, CMD-DATASERVICE-028, CMD-DATASERVICE-029, CMD-DATASERVICE-030, CMD-DATASERVICE-031, CMD-DATASERVICE-032, CMD-DATASERVICE-033, CMD-DATASERVICE-034, CMD-DATASERVICE-035, CMD-DATASERVICE-036, CMD-DATASERVICE-037, CMD-DATASERVICE-038, CMD-DATASERVICE-039, CMD-DATASERVICE-040, CMD-DATASERVICE-041, CMD-DATASERVICE-042, CMD-DATASERVICE-087, CMD-DATASERVICE-090, CMD-DATASERVICE-053, CMD-DATASERVICE-056, CMD-DATASERVICE-059, CMD-DATASERVICE-062, CMD-DATASERVICE-065, CMD-DATASERVICE-068, CMD-DATASERVICE-071, CMD-DATASERVICE-074, CMD-DATASERVICE-077, CMD-DATASERVICE-086, CMD-DATASERVICE-092; EVD-DATASERVICE-012, EVD-DATASERVICE-013, EVD-DATASERVICE-015, EVD-DATASERVICE-016, EVD-DATASERVICE-047 | pass 恢复后继续逐tick保护且没有补造历史tick |
| AC-DATASERVICE-020-S04 | TASK-DATASERVICE-001, TASK-DATASERVICE-002, TASK-DATASERVICE-003, TASK-DATASERVICE-004, TASK-DATASERVICE-005, TASK-DATASERVICE-006, TASK-DATASERVICE-007, TASK-DATASERVICE-008, TASK-DATASERVICE-009, TASK-DATASERVICE-010, TASK-DATASERVICE-011, TASK-DATASERVICE-012, TASK-DATASERVICE-013, TASK-DATASERVICE-014, TASK-DATASERVICE-015, TASK-DATASERVICE-016 | CMD-DATASERVICE-051, CMD-DATASERVICE-052, CMD-DATASERVICE-053, CMD-DATASERVICE-078, CMD-DATASERVICE-079, CMD-DATASERVICE-080, CMD-DATASERVICE-081, CMD-DATASERVICE-082, CMD-DATASERVICE-083, CMD-DATASERVICE-003, CMD-DATASERVICE-004, CMD-DATASERVICE-005, CMD-DATASERVICE-006, CMD-DATASERVICE-007, CMD-DATASERVICE-008, CMD-DATASERVICE-009, CMD-DATASERVICE-010, CMD-DATASERVICE-011, CMD-DATASERVICE-012, CMD-DATASERVICE-013, CMD-DATASERVICE-014, CMD-DATASERVICE-015, CMD-DATASERVICE-016, CMD-DATASERVICE-017, CMD-DATASERVICE-018, CMD-DATASERVICE-019, CMD-DATASERVICE-020, CMD-DATASERVICE-021, CMD-DATASERVICE-022, CMD-DATASERVICE-023, CMD-DATASERVICE-024, CMD-DATASERVICE-025, CMD-DATASERVICE-026, CMD-DATASERVICE-027, CMD-DATASERVICE-028, CMD-DATASERVICE-029, CMD-DATASERVICE-030, CMD-DATASERVICE-031, CMD-DATASERVICE-032, CMD-DATASERVICE-033, CMD-DATASERVICE-034, CMD-DATASERVICE-035, CMD-DATASERVICE-036, CMD-DATASERVICE-037, CMD-DATASERVICE-038, CMD-DATASERVICE-039, CMD-DATASERVICE-040, CMD-DATASERVICE-041, CMD-DATASERVICE-042, CMD-DATASERVICE-087, CMD-DATASERVICE-090, CMD-DATASERVICE-056, CMD-DATASERVICE-059, CMD-DATASERVICE-062, CMD-DATASERVICE-065, CMD-DATASERVICE-068, CMD-DATASERVICE-071, CMD-DATASERVICE-074, CMD-DATASERVICE-077, CMD-DATASERVICE-086, CMD-DATASERVICE-092; EVD-DATASERVICE-003, EVD-DATASERVICE-012, EVD-DATASERVICE-013, EVD-DATASERVICE-015, EVD-DATASERVICE-016, EVD-DATASERVICE-048 | pass 只产生符合当前actual和仓位约束的零或一个订单intent |
| AC-DATASERVICE-021-S01 | TASK-DATASERVICE-001, TASK-DATASERVICE-002, TASK-DATASERVICE-003, TASK-DATASERVICE-004, TASK-DATASERVICE-005, TASK-DATASERVICE-006, TASK-DATASERVICE-007, TASK-DATASERVICE-008, TASK-DATASERVICE-009, TASK-DATASERVICE-010, TASK-DATASERVICE-011, TASK-DATASERVICE-012, TASK-DATASERVICE-013, TASK-DATASERVICE-014, TASK-DATASERVICE-015, TASK-DATASERVICE-016 | CMD-DATASERVICE-051, CMD-DATASERVICE-052, CMD-DATASERVICE-053, CMD-DATASERVICE-057, CMD-DATASERVICE-058, CMD-DATASERVICE-059, CMD-DATASERVICE-075, CMD-DATASERVICE-076, CMD-DATASERVICE-077, CMD-DATASERVICE-003, CMD-DATASERVICE-004, CMD-DATASERVICE-005, CMD-DATASERVICE-006, CMD-DATASERVICE-007, CMD-DATASERVICE-008, CMD-DATASERVICE-009, CMD-DATASERVICE-010, CMD-DATASERVICE-011, CMD-DATASERVICE-012, CMD-DATASERVICE-013, CMD-DATASERVICE-014, CMD-DATASERVICE-015, CMD-DATASERVICE-016, CMD-DATASERVICE-017, CMD-DATASERVICE-018, CMD-DATASERVICE-019, CMD-DATASERVICE-020, CMD-DATASERVICE-021, CMD-DATASERVICE-022, CMD-DATASERVICE-023, CMD-DATASERVICE-024, CMD-DATASERVICE-025, CMD-DATASERVICE-026, CMD-DATASERVICE-027, CMD-DATASERVICE-028, CMD-DATASERVICE-029, CMD-DATASERVICE-030, CMD-DATASERVICE-031, CMD-DATASERVICE-032, CMD-DATASERVICE-033, CMD-DATASERVICE-034, CMD-DATASERVICE-035, CMD-DATASERVICE-036, CMD-DATASERVICE-037, CMD-DATASERVICE-038, CMD-DATASERVICE-039, CMD-DATASERVICE-040, CMD-DATASERVICE-041, CMD-DATASERVICE-042, CMD-DATASERVICE-087, CMD-DATASERVICE-090, CMD-DATASERVICE-056, CMD-DATASERVICE-062, CMD-DATASERVICE-065, CMD-DATASERVICE-068, CMD-DATASERVICE-071, CMD-DATASERVICE-074, CMD-DATASERVICE-080, CMD-DATASERVICE-083, CMD-DATASERVICE-086, CMD-DATASERVICE-092; EVD-DATASERVICE-003, EVD-DATASERVICE-005, EVD-DATASERVICE-011, EVD-DATASERVICE-015, EVD-DATASERVICE-016, EVD-DATASERVICE-037 | pass active设置只来自用户选择或主进程默认发送 最终只有新stream可写并收到一次 active_ack new_stream_key |
| AC-DATASERVICE-021-S02 | TASK-DATASERVICE-001, TASK-DATASERVICE-002, TASK-DATASERVICE-003, TASK-DATASERVICE-004, TASK-DATASERVICE-005, TASK-DATASERVICE-006, TASK-DATASERVICE-007, TASK-DATASERVICE-008, TASK-DATASERVICE-009, TASK-DATASERVICE-010, TASK-DATASERVICE-011, TASK-DATASERVICE-012, TASK-DATASERVICE-013, TASK-DATASERVICE-014, TASK-DATASERVICE-015, TASK-DATASERVICE-016 | CMD-DATASERVICE-051, CMD-DATASERVICE-052, CMD-DATASERVICE-053, CMD-DATASERVICE-057, CMD-DATASERVICE-058, CMD-DATASERVICE-059, CMD-DATASERVICE-003, CMD-DATASERVICE-004, CMD-DATASERVICE-005, CMD-DATASERVICE-006, CMD-DATASERVICE-007, CMD-DATASERVICE-008, CMD-DATASERVICE-009, CMD-DATASERVICE-010, CMD-DATASERVICE-011, CMD-DATASERVICE-012, CMD-DATASERVICE-013, CMD-DATASERVICE-014, CMD-DATASERVICE-015, CMD-DATASERVICE-016, CMD-DATASERVICE-017, CMD-DATASERVICE-018, CMD-DATASERVICE-019, CMD-DATASERVICE-020, CMD-DATASERVICE-021, CMD-DATASERVICE-022, CMD-DATASERVICE-023, CMD-DATASERVICE-024, CMD-DATASERVICE-025, CMD-DATASERVICE-026, CMD-DATASERVICE-027, CMD-DATASERVICE-028, CMD-DATASERVICE-029, CMD-DATASERVICE-030, CMD-DATASERVICE-031, CMD-DATASERVICE-032, CMD-DATASERVICE-033, CMD-DATASERVICE-034, CMD-DATASERVICE-035, CMD-DATASERVICE-036, CMD-DATASERVICE-037, CMD-DATASERVICE-038, CMD-DATASERVICE-039, CMD-DATASERVICE-040, CMD-DATASERVICE-041, CMD-DATASERVICE-042, CMD-DATASERVICE-087, CMD-DATASERVICE-090, CMD-DATASERVICE-056, CMD-DATASERVICE-062, CMD-DATASERVICE-065, CMD-DATASERVICE-068, CMD-DATASERVICE-071, CMD-DATASERVICE-074, CMD-DATASERVICE-077, CMD-DATASERVICE-080, CMD-DATASERVICE-083, CMD-DATASERVICE-086, CMD-DATASERVICE-092; EVD-DATASERVICE-003, EVD-DATASERVICE-005, EVD-DATASERVICE-015, EVD-DATASERVICE-016, EVD-DATASERVICE-049 | pass 失败切换不造成行情空窗或双active |
| AC-DATASERVICE-021-S03 | TASK-DATASERVICE-001, TASK-DATASERVICE-002, TASK-DATASERVICE-003, TASK-DATASERVICE-004, TASK-DATASERVICE-005, TASK-DATASERVICE-006, TASK-DATASERVICE-007, TASK-DATASERVICE-008, TASK-DATASERVICE-009, TASK-DATASERVICE-010, TASK-DATASERVICE-011, TASK-DATASERVICE-012, TASK-DATASERVICE-013, TASK-DATASERVICE-014, TASK-DATASERVICE-015, TASK-DATASERVICE-016 | CMD-DATASERVICE-051, CMD-DATASERVICE-052, CMD-DATASERVICE-053, CMD-DATASERVICE-075, CMD-DATASERVICE-076, CMD-DATASERVICE-077, CMD-DATASERVICE-084, CMD-DATASERVICE-085, CMD-DATASERVICE-086, CMD-DATASERVICE-003, CMD-DATASERVICE-004, CMD-DATASERVICE-005, CMD-DATASERVICE-006, CMD-DATASERVICE-007, CMD-DATASERVICE-008, CMD-DATASERVICE-009, CMD-DATASERVICE-010, CMD-DATASERVICE-011, CMD-DATASERVICE-012, CMD-DATASERVICE-013, CMD-DATASERVICE-014, CMD-DATASERVICE-015, CMD-DATASERVICE-016, CMD-DATASERVICE-017, CMD-DATASERVICE-018, CMD-DATASERVICE-019, CMD-DATASERVICE-020, CMD-DATASERVICE-021, CMD-DATASERVICE-022, CMD-DATASERVICE-023, CMD-DATASERVICE-024, CMD-DATASERVICE-025, CMD-DATASERVICE-026, CMD-DATASERVICE-027, CMD-DATASERVICE-028, CMD-DATASERVICE-029, CMD-DATASERVICE-030, CMD-DATASERVICE-031, CMD-DATASERVICE-032, CMD-DATASERVICE-033, CMD-DATASERVICE-034, CMD-DATASERVICE-035, CMD-DATASERVICE-036, CMD-DATASERVICE-037, CMD-DATASERVICE-038, CMD-DATASERVICE-039, CMD-DATASERVICE-040, CMD-DATASERVICE-041, CMD-DATASERVICE-042, CMD-DATASERVICE-087, CMD-DATASERVICE-090, CMD-DATASERVICE-056, CMD-DATASERVICE-059, CMD-DATASERVICE-062, CMD-DATASERVICE-065, CMD-DATASERVICE-068, CMD-DATASERVICE-071, CMD-DATASERVICE-074, CMD-DATASERVICE-080, CMD-DATASERVICE-083, CMD-DATASERVICE-092; EVD-DATASERVICE-003, EVD-DATASERVICE-011, EVD-DATASERVICE-014, EVD-DATASERVICE-015, EVD-DATASERVICE-016, EVD-DATASERVICE-050 | pass logical symbol相同不会复用旧生命周期 |
| AC-DATASERVICE-022-S01 | TASK-DATASERVICE-001, TASK-DATASERVICE-002, TASK-DATASERVICE-003, TASK-DATASERVICE-004, TASK-DATASERVICE-005, TASK-DATASERVICE-006, TASK-DATASERVICE-007, TASK-DATASERVICE-008, TASK-DATASERVICE-009, TASK-DATASERVICE-010, TASK-DATASERVICE-011, TASK-DATASERVICE-012, TASK-DATASERVICE-013, TASK-DATASERVICE-014, TASK-DATASERVICE-015, TASK-DATASERVICE-016 | CMD-DATASERVICE-045, CMD-DATASERVICE-046, CMD-DATASERVICE-047, CMD-DATASERVICE-051, CMD-DATASERVICE-052, CMD-DATASERVICE-053, CMD-DATASERVICE-054, CMD-DATASERVICE-055, CMD-DATASERVICE-056, CMD-DATASERVICE-078, CMD-DATASERVICE-079, CMD-DATASERVICE-080, CMD-DATASERVICE-003, CMD-DATASERVICE-004, CMD-DATASERVICE-005, CMD-DATASERVICE-006, CMD-DATASERVICE-007, CMD-DATASERVICE-008, CMD-DATASERVICE-009, CMD-DATASERVICE-010, CMD-DATASERVICE-011, CMD-DATASERVICE-012, CMD-DATASERVICE-013, CMD-DATASERVICE-014, CMD-DATASERVICE-015, CMD-DATASERVICE-016, CMD-DATASERVICE-017, CMD-DATASERVICE-018, CMD-DATASERVICE-019, CMD-DATASERVICE-020, CMD-DATASERVICE-021, CMD-DATASERVICE-022, CMD-DATASERVICE-023, CMD-DATASERVICE-024, CMD-DATASERVICE-025, CMD-DATASERVICE-026, CMD-DATASERVICE-027, CMD-DATASERVICE-028, CMD-DATASERVICE-029, CMD-DATASERVICE-030, CMD-DATASERVICE-031, CMD-DATASERVICE-032, CMD-DATASERVICE-033, CMD-DATASERVICE-034, CMD-DATASERVICE-035, CMD-DATASERVICE-036, CMD-DATASERVICE-037, CMD-DATASERVICE-038, CMD-DATASERVICE-039, CMD-DATASERVICE-040, CMD-DATASERVICE-041, CMD-DATASERVICE-042, CMD-DATASERVICE-087, CMD-DATASERVICE-090, CMD-DATASERVICE-059, CMD-DATASERVICE-062, CMD-DATASERVICE-065, CMD-DATASERVICE-068, CMD-DATASERVICE-071, CMD-DATASERVICE-074, CMD-DATASERVICE-077, CMD-DATASERVICE-083, CMD-DATASERVICE-086, CMD-DATASERVICE-092; EVD-DATASERVICE-001, EVD-DATASERVICE-003, EVD-DATASERVICE-004, EVD-DATASERVICE-012, EVD-DATASERVICE-015, EVD-DATASERVICE-016, EVD-DATASERVICE-038 | pass futu execution使用mhi2610 db/gds/recorder/指标仍用mhimain |
| AC-DATASERVICE-022-S02 | TASK-DATASERVICE-001, TASK-DATASERVICE-002, TASK-DATASERVICE-003, TASK-DATASERVICE-004, TASK-DATASERVICE-005, TASK-DATASERVICE-006, TASK-DATASERVICE-007, TASK-DATASERVICE-008, TASK-DATASERVICE-009, TASK-DATASERVICE-010, TASK-DATASERVICE-011, TASK-DATASERVICE-012, TASK-DATASERVICE-013, TASK-DATASERVICE-014, TASK-DATASERVICE-015, TASK-DATASERVICE-016 | CMD-DATASERVICE-045, CMD-DATASERVICE-046, CMD-DATASERVICE-047, CMD-DATASERVICE-051, CMD-DATASERVICE-052, CMD-DATASERVICE-053, CMD-DATASERVICE-054, CMD-DATASERVICE-055, CMD-DATASERVICE-056, CMD-DATASERVICE-003, CMD-DATASERVICE-004, CMD-DATASERVICE-005, CMD-DATASERVICE-006, CMD-DATASERVICE-007, CMD-DATASERVICE-008, CMD-DATASERVICE-009, CMD-DATASERVICE-010, CMD-DATASERVICE-011, CMD-DATASERVICE-012, CMD-DATASERVICE-013, CMD-DATASERVICE-014, CMD-DATASERVICE-015, CMD-DATASERVICE-016, CMD-DATASERVICE-017, CMD-DATASERVICE-018, CMD-DATASERVICE-019, CMD-DATASERVICE-020, CMD-DATASERVICE-021, CMD-DATASERVICE-022, CMD-DATASERVICE-023, CMD-DATASERVICE-024, CMD-DATASERVICE-025, CMD-DATASERVICE-026, CMD-DATASERVICE-027, CMD-DATASERVICE-028, CMD-DATASERVICE-029, CMD-DATASERVICE-030, CMD-DATASERVICE-031, CMD-DATASERVICE-032, CMD-DATASERVICE-033, CMD-DATASERVICE-034, CMD-DATASERVICE-035, CMD-DATASERVICE-036, CMD-DATASERVICE-037, CMD-DATASERVICE-038, CMD-DATASERVICE-039, CMD-DATASERVICE-040, CMD-DATASERVICE-041, CMD-DATASERVICE-042, CMD-DATASERVICE-087, CMD-DATASERVICE-090, CMD-DATASERVICE-059, CMD-DATASERVICE-062, CMD-DATASERVICE-065, CMD-DATASERVICE-068, CMD-DATASERVICE-071, CMD-DATASERVICE-074, CMD-DATASERVICE-077, CMD-DATASERVICE-080, CMD-DATASERVICE-083, CMD-DATASERVICE-086, CMD-DATASERVICE-092; EVD-DATASERVICE-001, EVD-DATASERVICE-003, EVD-DATASERVICE-004, EVD-DATASERVICE-015, EVD-DATASERVICE-016, EVD-DATASERVICE-051 | pass canonical current没有并发写或actual混合 |
| AC-DATASERVICE-023-S01 | TASK-DATASERVICE-001, TASK-DATASERVICE-002, TASK-DATASERVICE-003, TASK-DATASERVICE-004, TASK-DATASERVICE-005, TASK-DATASERVICE-006, TASK-DATASERVICE-007, TASK-DATASERVICE-008, TASK-DATASERVICE-009, TASK-DATASERVICE-010, TASK-DATASERVICE-011, TASK-DATASERVICE-012, TASK-DATASERVICE-013, TASK-DATASERVICE-014, TASK-DATASERVICE-015, TASK-DATASERVICE-016 | CMD-DATASERVICE-057, CMD-DATASERVICE-058, CMD-DATASERVICE-059, CMD-DATASERVICE-063, CMD-DATASERVICE-064, CMD-DATASERVICE-065, CMD-DATASERVICE-066, CMD-DATASERVICE-067, CMD-DATASERVICE-068, CMD-DATASERVICE-084, CMD-DATASERVICE-085, CMD-DATASERVICE-086, CMD-DATASERVICE-003, CMD-DATASERVICE-004, CMD-DATASERVICE-005, CMD-DATASERVICE-006, CMD-DATASERVICE-007, CMD-DATASERVICE-008, CMD-DATASERVICE-009, CMD-DATASERVICE-010, CMD-DATASERVICE-011, CMD-DATASERVICE-012, CMD-DATASERVICE-013, CMD-DATASERVICE-014, CMD-DATASERVICE-015, CMD-DATASERVICE-016, CMD-DATASERVICE-017, CMD-DATASERVICE-018, CMD-DATASERVICE-019, CMD-DATASERVICE-020, CMD-DATASERVICE-021, CMD-DATASERVICE-022, CMD-DATASERVICE-023, CMD-DATASERVICE-024, CMD-DATASERVICE-025, CMD-DATASERVICE-026, CMD-DATASERVICE-027, CMD-DATASERVICE-028, CMD-DATASERVICE-029, CMD-DATASERVICE-030, CMD-DATASERVICE-031, CMD-DATASERVICE-032, CMD-DATASERVICE-033, CMD-DATASERVICE-034, CMD-DATASERVICE-035, CMD-DATASERVICE-036, CMD-DATASERVICE-037, CMD-DATASERVICE-038, CMD-DATASERVICE-039, CMD-DATASERVICE-040, CMD-DATASERVICE-041, CMD-DATASERVICE-042, CMD-DATASERVICE-087, CMD-DATASERVICE-090, CMD-DATASERVICE-053, CMD-DATASERVICE-056, CMD-DATASERVICE-062, CMD-DATASERVICE-071, CMD-DATASERVICE-074, CMD-DATASERVICE-077, CMD-DATASERVICE-080, CMD-DATASERVICE-083, CMD-DATASERVICE-092; EVD-DATASERVICE-005, EVD-DATASERVICE-007, EVD-DATASERVICE-008, EVD-DATASERVICE-014, EVD-DATASERVICE-015, EVD-DATASERVICE-016, EVD-DATASERVICE-039 | pass 相同精确in-flight request只执行一次 所有caller收到一个终态 |
| AC-DATASERVICE-023-S02 | TASK-DATASERVICE-001, TASK-DATASERVICE-002, TASK-DATASERVICE-003, TASK-DATASERVICE-004, TASK-DATASERVICE-005, TASK-DATASERVICE-006, TASK-DATASERVICE-007, TASK-DATASERVICE-008, TASK-DATASERVICE-009, TASK-DATASERVICE-010, TASK-DATASERVICE-011, TASK-DATASERVICE-012, TASK-DATASERVICE-013, TASK-DATASERVICE-014, TASK-DATASERVICE-015, TASK-DATASERVICE-016 | CMD-DATASERVICE-057, CMD-DATASERVICE-058, CMD-DATASERVICE-059, CMD-DATASERVICE-063, CMD-DATASERVICE-064, CMD-DATASERVICE-065, CMD-DATASERVICE-084, CMD-DATASERVICE-085, CMD-DATASERVICE-086, CMD-DATASERVICE-003, CMD-DATASERVICE-004, CMD-DATASERVICE-005, CMD-DATASERVICE-006, CMD-DATASERVICE-007, CMD-DATASERVICE-008, CMD-DATASERVICE-009, CMD-DATASERVICE-010, CMD-DATASERVICE-011, CMD-DATASERVICE-012, CMD-DATASERVICE-013, CMD-DATASERVICE-014, CMD-DATASERVICE-015, CMD-DATASERVICE-016, CMD-DATASERVICE-017, CMD-DATASERVICE-018, CMD-DATASERVICE-019, CMD-DATASERVICE-020, CMD-DATASERVICE-021, CMD-DATASERVICE-022, CMD-DATASERVICE-023, CMD-DATASERVICE-024, CMD-DATASERVICE-025, CMD-DATASERVICE-026, CMD-DATASERVICE-027, CMD-DATASERVICE-028, CMD-DATASERVICE-029, CMD-DATASERVICE-030, CMD-DATASERVICE-031, CMD-DATASERVICE-032, CMD-DATASERVICE-033, CMD-DATASERVICE-034, CMD-DATASERVICE-035, CMD-DATASERVICE-036, CMD-DATASERVICE-037, CMD-DATASERVICE-038, CMD-DATASERVICE-039, CMD-DATASERVICE-040, CMD-DATASERVICE-041, CMD-DATASERVICE-042, CMD-DATASERVICE-087, CMD-DATASERVICE-090, CMD-DATASERVICE-053, CMD-DATASERVICE-056, CMD-DATASERVICE-062, CMD-DATASERVICE-068, CMD-DATASERVICE-071, CMD-DATASERVICE-074, CMD-DATASERVICE-077, CMD-DATASERVICE-080, CMD-DATASERVICE-083, CMD-DATASERVICE-092; EVD-DATASERVICE-005, EVD-DATASERVICE-007, EVD-DATASERVICE-014, EVD-DATASERVICE-015, EVD-DATASERVICE-016, EVD-DATASERVICE-052 | pass fetch range集合精确等于首次范围加差集 |
| AC-DATASERVICE-023-S03 | TASK-DATASERVICE-001, TASK-DATASERVICE-002, TASK-DATASERVICE-003, TASK-DATASERVICE-004, TASK-DATASERVICE-005, TASK-DATASERVICE-006, TASK-DATASERVICE-007, TASK-DATASERVICE-008, TASK-DATASERVICE-009, TASK-DATASERVICE-010, TASK-DATASERVICE-011, TASK-DATASERVICE-012, TASK-DATASERVICE-013, TASK-DATASERVICE-014, TASK-DATASERVICE-015, TASK-DATASERVICE-016 | CMD-DATASERVICE-057, CMD-DATASERVICE-058, CMD-DATASERVICE-059, CMD-DATASERVICE-063, CMD-DATASERVICE-064, CMD-DATASERVICE-065, CMD-DATASERVICE-084, CMD-DATASERVICE-085, CMD-DATASERVICE-086, CMD-DATASERVICE-003, CMD-DATASERVICE-004, CMD-DATASERVICE-005, CMD-DATASERVICE-006, CMD-DATASERVICE-007, CMD-DATASERVICE-008, CMD-DATASERVICE-009, CMD-DATASERVICE-010, CMD-DATASERVICE-011, CMD-DATASERVICE-012, CMD-DATASERVICE-013, CMD-DATASERVICE-014, CMD-DATASERVICE-015, CMD-DATASERVICE-016, CMD-DATASERVICE-017, CMD-DATASERVICE-018, CMD-DATASERVICE-019, CMD-DATASERVICE-020, CMD-DATASERVICE-021, CMD-DATASERVICE-022, CMD-DATASERVICE-023, CMD-DATASERVICE-024, CMD-DATASERVICE-025, CMD-DATASERVICE-026, CMD-DATASERVICE-027, CMD-DATASERVICE-028, CMD-DATASERVICE-029, CMD-DATASERVICE-030, CMD-DATASERVICE-031, CMD-DATASERVICE-032, CMD-DATASERVICE-033, CMD-DATASERVICE-034, CMD-DATASERVICE-035, CMD-DATASERVICE-036, CMD-DATASERVICE-037, CMD-DATASERVICE-038, CMD-DATASERVICE-039, CMD-DATASERVICE-040, CMD-DATASERVICE-041, CMD-DATASERVICE-042, CMD-DATASERVICE-087, CMD-DATASERVICE-090, CMD-DATASERVICE-053, CMD-DATASERVICE-056, CMD-DATASERVICE-062, CMD-DATASERVICE-068, CMD-DATASERVICE-071, CMD-DATASERVICE-074, CMD-DATASERVICE-077, CMD-DATASERVICE-080, CMD-DATASERVICE-083, CMD-DATASERVICE-092; EVD-DATASERVICE-005, EVD-DATASERVICE-007, EVD-DATASERVICE-014, EVD-DATASERVICE-015, EVD-DATASERVICE-016, EVD-DATASERVICE-053 | pass 迟到数据不成为新权威且资源计数回到0 |
| AC-DATASERVICE-024-S01 | TASK-DATASERVICE-001, TASK-DATASERVICE-002, TASK-DATASERVICE-003, TASK-DATASERVICE-004, TASK-DATASERVICE-005, TASK-DATASERVICE-006, TASK-DATASERVICE-007, TASK-DATASERVICE-008, TASK-DATASERVICE-009, TASK-DATASERVICE-010, TASK-DATASERVICE-011, TASK-DATASERVICE-012, TASK-DATASERVICE-013, TASK-DATASERVICE-014, TASK-DATASERVICE-015, TASK-DATASERVICE-016 | CMD-DATASERVICE-063, CMD-DATASERVICE-064, CMD-DATASERVICE-065, CMD-DATASERVICE-069, CMD-DATASERVICE-070, CMD-DATASERVICE-071, CMD-DATASERVICE-084, CMD-DATASERVICE-085, CMD-DATASERVICE-086, CMD-DATASERVICE-003, CMD-DATASERVICE-004, CMD-DATASERVICE-005, CMD-DATASERVICE-006, CMD-DATASERVICE-007, CMD-DATASERVICE-008, CMD-DATASERVICE-009, CMD-DATASERVICE-010, CMD-DATASERVICE-011, CMD-DATASERVICE-012, CMD-DATASERVICE-013, CMD-DATASERVICE-014, CMD-DATASERVICE-015, CMD-DATASERVICE-016, CMD-DATASERVICE-017, CMD-DATASERVICE-018, CMD-DATASERVICE-019, CMD-DATASERVICE-020, CMD-DATASERVICE-021, CMD-DATASERVICE-022, CMD-DATASERVICE-023, CMD-DATASERVICE-024, CMD-DATASERVICE-025, CMD-DATASERVICE-026, CMD-DATASERVICE-027, CMD-DATASERVICE-028, CMD-DATASERVICE-029, CMD-DATASERVICE-030, CMD-DATASERVICE-031, CMD-DATASERVICE-032, CMD-DATASERVICE-033, CMD-DATASERVICE-034, CMD-DATASERVICE-035, CMD-DATASERVICE-036, CMD-DATASERVICE-037, CMD-DATASERVICE-038, CMD-DATASERVICE-039, CMD-DATASERVICE-040, CMD-DATASERVICE-041, CMD-DATASERVICE-042, CMD-DATASERVICE-087, CMD-DATASERVICE-090, CMD-DATASERVICE-053, CMD-DATASERVICE-056, CMD-DATASERVICE-059, CMD-DATASERVICE-062, CMD-DATASERVICE-068, CMD-DATASERVICE-074, CMD-DATASERVICE-077, CMD-DATASERVICE-080, CMD-DATASERVICE-083, CMD-DATASERVICE-092; EVD-DATASERVICE-007, EVD-DATASERVICE-009, EVD-DATASERVICE-014, EVD-DATASERVICE-015, EVD-DATASERVICE-016, EVD-DATASERVICE-040 | pass 图表恢复后历史和current连续 dataservice/worker/recorder/cta/trigger pid均未因最小化变化 |
| AC-DATASERVICE-024-S02 | TASK-DATASERVICE-001, TASK-DATASERVICE-002, TASK-DATASERVICE-003, TASK-DATASERVICE-004, TASK-DATASERVICE-005, TASK-DATASERVICE-006, TASK-DATASERVICE-007, TASK-DATASERVICE-008, TASK-DATASERVICE-009, TASK-DATASERVICE-010, TASK-DATASERVICE-011, TASK-DATASERVICE-012, TASK-DATASERVICE-013, TASK-DATASERVICE-014, TASK-DATASERVICE-015, TASK-DATASERVICE-016 | CMD-DATASERVICE-057, CMD-DATASERVICE-058, CMD-DATASERVICE-059, CMD-DATASERVICE-063, CMD-DATASERVICE-064, CMD-DATASERVICE-065, CMD-DATASERVICE-069, CMD-DATASERVICE-070, CMD-DATASERVICE-071, CMD-DATASERVICE-075, CMD-DATASERVICE-076, CMD-DATASERVICE-077, CMD-DATASERVICE-084, CMD-DATASERVICE-085, CMD-DATASERVICE-086, CMD-DATASERVICE-003, CMD-DATASERVICE-004, CMD-DATASERVICE-005, CMD-DATASERVICE-006, CMD-DATASERVICE-007, CMD-DATASERVICE-008, CMD-DATASERVICE-009, CMD-DATASERVICE-010, CMD-DATASERVICE-011, CMD-DATASERVICE-012, CMD-DATASERVICE-013, CMD-DATASERVICE-014, CMD-DATASERVICE-015, CMD-DATASERVICE-016, CMD-DATASERVICE-017, CMD-DATASERVICE-018, CMD-DATASERVICE-019, CMD-DATASERVICE-020, CMD-DATASERVICE-021, CMD-DATASERVICE-022, CMD-DATASERVICE-023, CMD-DATASERVICE-024, CMD-DATASERVICE-025, CMD-DATASERVICE-026, CMD-DATASERVICE-027, CMD-DATASERVICE-028, CMD-DATASERVICE-029, CMD-DATASERVICE-030, CMD-DATASERVICE-031, CMD-DATASERVICE-032, CMD-DATASERVICE-033, CMD-DATASERVICE-034, CMD-DATASERVICE-035, CMD-DATASERVICE-036, CMD-DATASERVICE-037, CMD-DATASERVICE-038, CMD-DATASERVICE-039, CMD-DATASERVICE-040, CMD-DATASERVICE-041, CMD-DATASERVICE-042, CMD-DATASERVICE-087, CMD-DATASERVICE-090, CMD-DATASERVICE-053, CMD-DATASERVICE-056, CMD-DATASERVICE-062, CMD-DATASERVICE-068, CMD-DATASERVICE-074, CMD-DATASERVICE-080, CMD-DATASERVICE-083, CMD-DATASERVICE-092; EVD-DATASERVICE-005, EVD-DATASERVICE-007, EVD-DATASERVICE-009, EVD-DATASERVICE-011, EVD-DATASERVICE-014, EVD-DATASERVICE-015, EVD-DATASERVICE-016, EVD-DATASERVICE-054 | pass 高周期db完整且与1m聚合一致 旧ack不进入新stream |
| AC-DATASERVICE-024-S03 | TASK-DATASERVICE-001, TASK-DATASERVICE-002, TASK-DATASERVICE-003, TASK-DATASERVICE-004, TASK-DATASERVICE-005, TASK-DATASERVICE-006, TASK-DATASERVICE-007, TASK-DATASERVICE-008, TASK-DATASERVICE-009, TASK-DATASERVICE-010, TASK-DATASERVICE-011, TASK-DATASERVICE-012, TASK-DATASERVICE-013, TASK-DATASERVICE-014, TASK-DATASERVICE-015, TASK-DATASERVICE-016 | CMD-DATASERVICE-057, CMD-DATASERVICE-058, CMD-DATASERVICE-059, CMD-DATASERVICE-063, CMD-DATASERVICE-064, CMD-DATASERVICE-065, CMD-DATASERVICE-069, CMD-DATASERVICE-070, CMD-DATASERVICE-071, CMD-DATASERVICE-075, CMD-DATASERVICE-076, CMD-DATASERVICE-077, CMD-DATASERVICE-084, CMD-DATASERVICE-085, CMD-DATASERVICE-086, CMD-DATASERVICE-003, CMD-DATASERVICE-004, CMD-DATASERVICE-005, CMD-DATASERVICE-006, CMD-DATASERVICE-007, CMD-DATASERVICE-008, CMD-DATASERVICE-009, CMD-DATASERVICE-010, CMD-DATASERVICE-011, CMD-DATASERVICE-012, CMD-DATASERVICE-013, CMD-DATASERVICE-014, CMD-DATASERVICE-015, CMD-DATASERVICE-016, CMD-DATASERVICE-017, CMD-DATASERVICE-018, CMD-DATASERVICE-019, CMD-DATASERVICE-020, CMD-DATASERVICE-021, CMD-DATASERVICE-022, CMD-DATASERVICE-023, CMD-DATASERVICE-024, CMD-DATASERVICE-025, CMD-DATASERVICE-026, CMD-DATASERVICE-027, CMD-DATASERVICE-028, CMD-DATASERVICE-029, CMD-DATASERVICE-030, CMD-DATASERVICE-031, CMD-DATASERVICE-032, CMD-DATASERVICE-033, CMD-DATASERVICE-034, CMD-DATASERVICE-035, CMD-DATASERVICE-036, CMD-DATASERVICE-037, CMD-DATASERVICE-038, CMD-DATASERVICE-039, CMD-DATASERVICE-040, CMD-DATASERVICE-041, CMD-DATASERVICE-042, CMD-DATASERVICE-087, CMD-DATASERVICE-090, CMD-DATASERVICE-053, CMD-DATASERVICE-056, CMD-DATASERVICE-062, CMD-DATASERVICE-068, CMD-DATASERVICE-074, CMD-DATASERVICE-080, CMD-DATASERVICE-083, CMD-DATASERVICE-092; EVD-DATASERVICE-005, EVD-DATASERVICE-007, EVD-DATASERVICE-009, EVD-DATASERVICE-011, EVD-DATASERVICE-014, EVD-DATASERVICE-015, EVD-DATASERVICE-016, EVD-DATASERVICE-055 | pass db完整 checkpoint在恢复后连续 新到达batch正常ack |
<!-- /goal-slot:acceptanceTraceabilityMatrix -->

## Source Coverage Matrix

Every source obligation must map to at least one generated task, acceptance item, required command, and evidence item.

<!-- goal-slot:sourceCoverageMatrix required dynamic=sourceCoverageMatrix -->
| Source ID | Intent Record | Declared ID | Source Artifact | Namespace | SpecSpan Refs | Parent Tasks | Goal Tasks | Acceptance | Commands | Evidence | Stop Conditions |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| REQ-DATASERVICE-001 | intent-cd2658420c1715d39646804220c31d695d88ba3b0899616403150ae11440f3b6 | REQ-DATASERVICE-001 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-f8df71283895b2a8f86cbd76a3ff5c35c8a0aab4cd5c6739917bab2c8670f912 | none | TASK-DATASERVICE-001, TASK-DATASERVICE-002, TASK-DATASERVICE-003, TASK-DATASERVICE-004, TASK-DATASERVICE-005, TASK-DATASERVICE-006, TASK-DATASERVICE-007, TASK-DATASERVICE-008, TASK-DATASERVICE-009, TASK-DATASERVICE-010, TASK-DATASERVICE-011, TASK-DATASERVICE-012, TASK-DATASERVICE-013, TASK-DATASERVICE-014, TASK-DATASERVICE-015, TASK-DATASERVICE-016 | AC-DATASERVICE-001-S01, AC-DATASERVICE-002-S01, AC-DATASERVICE-003-S01, AC-DATASERVICE-004-S01, AC-DATASERVICE-005-S01, AC-DATASERVICE-006-S01, AC-DATASERVICE-007-S01, AC-DATASERVICE-008-S01, AC-DATASERVICE-009-S01, AC-DATASERVICE-009-S02, AC-DATASERVICE-010-S01, AC-DATASERVICE-011-S01, AC-DATASERVICE-012-S01, AC-DATASERVICE-013-S01, AC-DATASERVICE-013-S02, AC-DATASERVICE-014-S01, AC-DATASERVICE-015-S01, AC-DATASERVICE-016-S01, AC-DATASERVICE-016-S02, AC-DATASERVICE-016-S03, AC-DATASERVICE-016-S04, AC-DATASERVICE-017-S01, AC-DATASERVICE-018-S01, AC-DATASERVICE-019-S01, AC-DATASERVICE-020-S01, AC-DATASERVICE-020-S02, AC-DATASERVICE-020-S03, AC-DATASERVICE-020-S04, AC-DATASERVICE-021-S01, AC-DATASERVICE-021-S02, AC-DATASERVICE-021-S03, AC-DATASERVICE-022-S01, AC-DATASERVICE-022-S02, AC-DATASERVICE-023-S01, AC-DATASERVICE-023-S02, AC-DATASERVICE-023-S03, AC-DATASERVICE-024-S01, AC-DATASERVICE-024-S02, AC-DATASERVICE-024-S03 |  |  |  |
| REQ-DATASERVICE-002 | intent-bd5532dcb48d144567c8a1954c346eaea852edcbe68fdcdaeaada8c96c94789f | REQ-DATASERVICE-002 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-2e1417e388580ac1fa853392ec77b550e234f9a62164239043778c54fd1d3f37 | none | TASK-DATASERVICE-005, TASK-DATASERVICE-006, TASK-DATASERVICE-007, TASK-DATASERVICE-011 | AC-DATASERVICE-001-S01, AC-DATASERVICE-002-S01, AC-DATASERVICE-003-S01 |  |  |  |
| REQ-DATASERVICE-003 | intent-17db6bcbf15a57b5bdefeb1b0c46a6df30bdf6b5e923b6832d330ccfedfa8c0d | REQ-DATASERVICE-003 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-15653a359b8b2f3e67f176bbaca2ad9be304e691d920b516fa0dc456aa4a6700 | none | TASK-DATASERVICE-005, TASK-DATASERVICE-007, TASK-DATASERVICE-009, TASK-DATASERVICE-014 | AC-DATASERVICE-004-S01, AC-DATASERVICE-005-S01, AC-DATASERVICE-008-S01, AC-DATASERVICE-024-S01 |  |  |  |
| REQ-DATASERVICE-004 | intent-096c731d280fee88e68856a6ee7ac6240787a0d95009afb266ad2930451b8b4e | REQ-DATASERVICE-004 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-cd35dfecf4625f8e96c77a6b54a0e7150726cc92b9e3d27da60050caccaa2569 | none | TASK-DATASERVICE-005, TASK-DATASERVICE-006, TASK-DATASERVICE-007, TASK-DATASERVICE-009 | AC-DATASERVICE-003-S01, AC-DATASERVICE-004-S01, AC-DATASERVICE-008-S01 |  |  |  |
| REQ-DATASERVICE-005 | intent-b4de0a6c9c20228a8f25cac87655e453f12279b49de83c16d73c1a08e239b269 | REQ-DATASERVICE-005 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-aeabdbcdbbc1cbebbe583a3e2ca79832b66f34940dce3e9bc61831c894408002 | none | TASK-DATASERVICE-005, TASK-DATASERVICE-006, TASK-DATASERVICE-007, TASK-DATASERVICE-008, TASK-DATASERVICE-014 | AC-DATASERVICE-003-S01, AC-DATASERVICE-005-S01, AC-DATASERVICE-023-S01 |  |  |  |
| REQ-DATASERVICE-006 | intent-8c975672db47bd8cdc98e9ac2583d84f7d00fe42ae153800cfe977e002bfdab7 | REQ-DATASERVICE-006 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-80cabdb7aa0483b038768e2c98a708ca0c0534cc8314eeeeeceb7ecd2b11413b | none | TASK-DATASERVICE-016 |  |  |  |  |
| REQ-DATASERVICE-007 | intent-277a68b38eb4046baddeb4527e003c8dcddc7c435a985fd66e50cb009a293551 | REQ-DATASERVICE-007 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-2666fe264cd66a83b112d7e262f03d97fac68bf195180b1ad630a80fa1436324 | none | TASK-DATASERVICE-016 |  |  |  |  |
| REQ-DATASERVICE-008 | intent-ee11210014d6a267a13405f27581c60559e1b0cc4334437518f86a5da76ecce2 | REQ-DATASERVICE-008 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-d673007070174d3a2a0371e936d9242276de22f8973761157a5dfa6693610adf | none | TASK-DATASERVICE-006, TASK-DATASERVICE-011 | AC-DATASERVICE-016-S01 |  |  |  |
| REQ-DATASERVICE-009 | intent-34afee462cad9f745eb08f278af8fa51bab9c8b0472af309863afd4eb695a440 | REQ-DATASERVICE-009 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-65bdeeea2b00edf8d73a901248680b9bb44b6733a05f6495913418e41c7431f4 | none | TASK-DATASERVICE-003, TASK-DATASERVICE-004, TASK-DATASERVICE-007, TASK-DATASERVICE-009, TASK-DATASERVICE-012 | AC-DATASERVICE-006-S01, AC-DATASERVICE-009-S01, AC-DATASERVICE-010-S01 |  |  |  |
| REQ-DATASERVICE-010 | intent-352486afcbb579562894aab6c012e25ea8a1e13ae43b5075730692465bee30de | REQ-DATASERVICE-010 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-53ede536df9b933afe27512825b047ad2f5f46cb47e5e08086700e3a607825b0 | none | TASK-DATASERVICE-004, TASK-DATASERVICE-005, TASK-DATASERVICE-007, TASK-DATASERVICE-009, TASK-DATASERVICE-014 | AC-DATASERVICE-001-S01, AC-DATASERVICE-004-S01, AC-DATASERVICE-006-S01, AC-DATASERVICE-007-S01, AC-DATASERVICE-008-S01, AC-DATASERVICE-024-S01 |  |  |  |
| REQ-DATASERVICE-011 | intent-341a6d8c8c0569d50de16a8a71d53ff70823d664cdeae7bf4d4d73b05e0be274 | REQ-DATASERVICE-011 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-cd522ee800ee561d0bfdf7e1b9becf44ad4fc569af7508f2fd61a8fce8eefeeb | none | TASK-DATASERVICE-003, TASK-DATASERVICE-005, TASK-DATASERVICE-011 | AC-DATASERVICE-021-S01 |  |  |  |
| REQ-DATASERVICE-012 | intent-46c7a6d8d19acf143178857cf9839035764a0a28f8dfae84e2fa5741c7b8da90 | REQ-DATASERVICE-012 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-0cc504914bba7a4990e00bdad318572349838a5e2281e13180807eb00f65cc08 | none | TASK-DATASERVICE-005, TASK-DATASERVICE-007, TASK-DATASERVICE-008, TASK-DATASERVICE-009, TASK-DATASERVICE-014 | AC-DATASERVICE-023-S01, AC-DATASERVICE-024-S01 |  |  |  |
| REQ-DATASERVICE-013 | intent-72ea931e2f60ebc5d0cdfcaff216947e4605b28e57e4c3b96de516e1bcea693f | REQ-DATASERVICE-013 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-921fa35254f25289b2f8c6d07779eee1343d0afe68144a6ba56e2e05c369bba6 | none | TASK-DATASERVICE-003, TASK-DATASERVICE-005, TASK-DATASERVICE-010, TASK-DATASERVICE-011 | AC-DATASERVICE-014-S01, AC-DATASERVICE-021-S01 |  |  |  |
| REQ-DATASERVICE-014 | intent-e3af9f5985daa7accb8234e733009fab2be998d4917b15528567d1961f1b8ab3 | REQ-DATASERVICE-014 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-69d9c89a2e82b3b0c7b6a2ccd33c8c59056791ccccc61c48d77ab8a2a3706899 | none | TASK-DATASERVICE-010, TASK-DATASERVICE-011 | AC-DATASERVICE-014-S01 |  |  |  |
| REQ-DATASERVICE-015 | intent-76848cc7d46798e94d98716343e8b1e2dc632258d9a91015c6271623e2003950 | REQ-DATASERVICE-015 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-94bf1f7a47b2899c5d72295656fd455634bac7480306c7325097ca14046aced5 | none | TASK-DATASERVICE-006, TASK-DATASERVICE-007, TASK-DATASERVICE-010, TASK-DATASERVICE-011 | AC-DATASERVICE-002-S01, AC-DATASERVICE-015-S01, AC-DATASERVICE-016-S01 |  |  |  |
| REQ-DATASERVICE-016 | intent-86a1d4d872fa4bbe16cd78d8e7fd975499d580a9a51d5abe0bd83423ccb67b36 | REQ-DATASERVICE-016 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-75d7d907fd7629d8b631cec66bb80bf253deb17060272647129b624cd9370e85 | none | TASK-DATASERVICE-003, TASK-DATASERVICE-004, TASK-DATASERVICE-005, TASK-DATASERVICE-011, TASK-DATASERVICE-012 | AC-DATASERVICE-019-S01, AC-DATASERVICE-021-S01, AC-DATASERVICE-022-S01 |  |  |  |
| REQ-DATASERVICE-017 | intent-cea59e977521f9c9476ac050520b2e95191cedbb478424a59f6f1bb69e252d09 | REQ-DATASERVICE-017 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-fafdf890c3b16c8acff494963e9311cc5e08d20efa1ff296a828c0fd8d8dbb22 | none | TASK-DATASERVICE-003, TASK-DATASERVICE-004, TASK-DATASERVICE-005, TASK-DATASERVICE-007, TASK-DATASERVICE-008, TASK-DATASERVICE-012, TASK-DATASERVICE-013, TASK-DATASERVICE-014 | AC-DATASERVICE-010-S01, AC-DATASERVICE-017-S01, AC-DATASERVICE-018-S01, AC-DATASERVICE-019-S01, AC-DATASERVICE-020-S01, AC-DATASERVICE-023-S01 |  |  |  |
| REQ-DATASERVICE-018 | intent-6f25ae7564d672165c1c0fee2f006169a554490d498b2970af924d2966d62778 | REQ-DATASERVICE-018 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-21d461b2ed8e6e42f885af82597b883e23c69fe7f544c948a69010a27dd3e206 | none | TASK-DATASERVICE-004, TASK-DATASERVICE-005, TASK-DATASERVICE-007, TASK-DATASERVICE-008, TASK-DATASERVICE-009, TASK-DATASERVICE-014 | AC-DATASERVICE-006-S01, AC-DATASERVICE-007-S01, AC-DATASERVICE-011-S01, AC-DATASERVICE-012-S01, AC-DATASERVICE-013-S01, AC-DATASERVICE-023-S01 |  |  |  |
| REQ-DATASERVICE-019 | intent-26788695a2cf5a34565555a000ab185c2f1c79222bbd5447aa9dba9afb70e675 | REQ-DATASERVICE-019 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-cb3578efc1d8a5b0a62428b76861c471d2becb054e52869f26ba7329ad6cf112 | none | TASK-DATASERVICE-001, TASK-DATASERVICE-016 |  |  |  |  |
| REQ-DATASERVICE-020 | intent-21d43bd79a4dbaccfd294c21377aaa90cfdac3167a599382c89da6a73d0c289e | REQ-DATASERVICE-020 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-66a689dfd5917d8b895d0663bff7a945f8735c9fd63b6316031ce7e4d5c1adfa | none | TASK-DATASERVICE-005, TASK-DATASERVICE-007, TASK-DATASERVICE-009, TASK-DATASERVICE-011, TASK-DATASERVICE-014 | AC-DATASERVICE-001-S01, AC-DATASERVICE-024-S01, AC-DATASERVICE-024-S02, AC-DATASERVICE-024-S03 |  |  |  |
| REQ-DATASERVICE-021 | intent-ad78cee825291ff2add820f2e108afe6f0d669a998ac3bd51a8142ed8c600f2e | REQ-DATASERVICE-021 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-cae20963e3061d84ed9a988e91d66b9e96878796efcb838ff4b9d1d0e8813e3b | none | TASK-DATASERVICE-016 |  |  |  |  |
| REQ-DATASERVICE-022 | intent-5e908195ba8921ea47d4da8edda5a9e406d3daf2ed106f079c89b27319d3b5c2 | REQ-DATASERVICE-022 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-7e2eaf7cb2cbf92b3b83e14c95e5443f15db5e61a07413e297660f378848197c | none | TASK-DATASERVICE-003, TASK-DATASERVICE-005, TASK-DATASERVICE-011, TASK-DATASERVICE-014 | AC-DATASERVICE-021-S01, AC-DATASERVICE-021-S02, AC-DATASERVICE-021-S03 |  |  |  |
| REQ-DATASERVICE-023 | intent-bade35c8dbd099f8fcac2b4b8b25d0f36db35c6bc8dac2918e8a4c5d6afe3479 | REQ-DATASERVICE-023 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-7bf9c1675f85ff7a45d66ee2d1f40f770a75b4101c99638e6b34d831213f80e2 | none | TASK-DATASERVICE-006, TASK-DATASERVICE-007, TASK-DATASERVICE-010, TASK-DATASERVICE-011 | AC-DATASERVICE-002-S01, AC-DATASERVICE-015-S01, AC-DATASERVICE-016-S01 |  |  |  |
| REQ-DATASERVICE-024 | intent-3cdb9c236bdf1dc35bb810c6397574459dff5f811324021414a8532eeb93db13 | REQ-DATASERVICE-024 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-231f082710367d28225f8feed74895f2a2a11e783637ca22f9179b9a48d17f47 | none | TASK-DATASERVICE-005, TASK-DATASERVICE-006, TASK-DATASERVICE-007, TASK-DATASERVICE-008, TASK-DATASERVICE-009, TASK-DATASERVICE-014 | AC-DATASERVICE-003-S01, AC-DATASERVICE-004-S01, AC-DATASERVICE-005-S01, AC-DATASERVICE-008-S01, AC-DATASERVICE-023-S01 |  |  |  |
| REQ-DATASERVICE-025 | intent-76f6acdd275f6a965f493fc161463bd9cb6236cfdd3a107ab896a143d6e8d15e | REQ-DATASERVICE-025 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-8fbd41e585176f593b443034be8e5386134fe8c5aed21f180eed39d02dfdf863 | none | TASK-DATASERVICE-016 |  |  |  |  |
| REQ-DATASERVICE-026 | intent-406b7aeb01904877c8d29e1381957b82d873b86d5c723ffee4557142e69a74c7 | REQ-DATASERVICE-026 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-c188711e65cb5953b16011e4d9bddfbe629f4803a7ac081d8c1b14de56912763 | none | TASK-DATASERVICE-016 |  |  |  |  |
| REQ-DATASERVICE-027 | intent-f90148ad83b3bda5048da669c6238c7b3dec61493981debe252af9a63d1f0a36 | REQ-DATASERVICE-027 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-20d455e590411e443f29166be9dc035c9f7bea556e7d4eab1eff077a43212bde | none | TASK-DATASERVICE-016 |  |  |  |  |
| REQ-DATASERVICE-028 | intent-8786d163c6e5e337c5a4895c20008d09c1c95f7df6770440248d31d806e5d9cb | REQ-DATASERVICE-028 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-2e121ef9ac8cdb1d9d4e33ff5ee99a4e1509b8b6e82a894019f4b7bfca46906f | none | TASK-DATASERVICE-016 |  |  |  |  |
| REQ-DATASERVICE-029 | intent-ef2fe15a5906bde8a1c7bf41fc8a41efac33997313ff0063d4e562cc089df767 | REQ-DATASERVICE-029 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-b190bffa7b13d6e3c486420c8e314ccb26f2e896fbb1795653cd3ed38237e868 | none | TASK-DATASERVICE-006, TASK-DATASERVICE-010, TASK-DATASERVICE-011 | AC-DATASERVICE-016-S01, AC-DATASERVICE-016-S02, AC-DATASERVICE-016-S03, AC-DATASERVICE-016-S04 |  |  |  |
| REQ-DATASERVICE-030 | intent-bcc73d731427c25b7bbc2cd757a5e0f070ce2de668049e1159ba28abb458b38f | REQ-DATASERVICE-030 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-63847c9e8fb0bab993a7ceb3687349a29f616c865a228b28b504ea03a984f2a1 | none | TASK-DATASERVICE-003, TASK-DATASERVICE-004, TASK-DATASERVICE-005, TASK-DATASERVICE-007, TASK-DATASERVICE-008, TASK-DATASERVICE-012, TASK-DATASERVICE-013, TASK-DATASERVICE-014 | AC-DATASERVICE-010-S01, AC-DATASERVICE-017-S01, AC-DATASERVICE-018-S01, AC-DATASERVICE-019-S01, AC-DATASERVICE-020-S01, AC-DATASERVICE-020-S02, AC-DATASERVICE-020-S03, AC-DATASERVICE-020-S04, AC-DATASERVICE-023-S01 |  |  |  |
| REQ-DATASERVICE-031 | intent-844e4f14236caf4b7d7c6b395207773ee3b4455f23f416ecff9db77e32508a62 | REQ-DATASERVICE-031 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-280dda7c07807b9c650be26978340111159528f71107eab7a4b633f8ee50f5b4 | none | TASK-DATASERVICE-005, TASK-DATASERVICE-006, TASK-DATASERVICE-007, TASK-DATASERVICE-009, TASK-DATASERVICE-010, TASK-DATASERVICE-011, TASK-DATASERVICE-014 | AC-DATASERVICE-002-S01, AC-DATASERVICE-015-S01, AC-DATASERVICE-016-S01, AC-DATASERVICE-024-S01, AC-DATASERVICE-024-S02, AC-DATASERVICE-024-S03 |  |  |  |
| REQ-DATASERVICE-032 | intent-f018789cac0c6f19f2a86bf040e7421bfb8289792afebd4a52f1220cdcb21086 | REQ-DATASERVICE-032 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-cf5581daf6d7690e1475d449517b92716405384f474ac1c0f3451851e9b917e8 | none | TASK-DATASERVICE-005, TASK-DATASERVICE-006, TASK-DATASERVICE-007, TASK-DATASERVICE-008, TASK-DATASERVICE-009, TASK-DATASERVICE-010, TASK-DATASERVICE-011, TASK-DATASERVICE-014 | AC-DATASERVICE-002-S01, AC-DATASERVICE-015-S01, AC-DATASERVICE-016-S01, AC-DATASERVICE-023-S01, AC-DATASERVICE-024-S01 |  |  |  |
| REQ-DATASERVICE-033 | intent-bf7bae57e6b95f4731c78f105b636ee0d3068670a6d36bde88e17d942793e5a2 | REQ-DATASERVICE-033 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-f6d588932eb927a24b8dc6ff66e88928d5255c74fd1bc65a2770fddf06e3057e | none | TASK-DATASERVICE-003, TASK-DATASERVICE-004, TASK-DATASERVICE-005, TASK-DATASERVICE-011, TASK-DATASERVICE-012 | AC-DATASERVICE-019-S01, AC-DATASERVICE-021-S01, AC-DATASERVICE-022-S01, AC-DATASERVICE-022-S02 |  |  |  |
| REQ-DATASERVICE-034 | intent-ddc823ff00b4136d9f9227e91df7862645615d5376fb83cd57cafec76eb66170 | REQ-DATASERVICE-034 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-f441622fb544aa8b4a971a0c2e090aff832d4a80881fff3cd9548b252181d3fd | none | TASK-DATASERVICE-005, TASK-DATASERVICE-007 | AC-DATASERVICE-004-S01 |  |  |  |
| REQ-DATASERVICE-035 | intent-a04259df92feb5a2d409439e8090031132c2f29a289b7169eb31e74b7145c2ec | REQ-DATASERVICE-035 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-217e7fdd9627bd8dd2c2d39a7a349730a7446e53a371d5f948abdae2e927abe3 | none | TASK-DATASERVICE-004, TASK-DATASERVICE-005, TASK-DATASERVICE-007, TASK-DATASERVICE-009, TASK-DATASERVICE-014 | AC-DATASERVICE-001-S01, AC-DATASERVICE-004-S01, AC-DATASERVICE-006-S01, AC-DATASERVICE-007-S01, AC-DATASERVICE-008-S01, AC-DATASERVICE-024-S01 |  |  |  |
| REQ-DATASERVICE-036 | intent-4ffb458a7ef502b0c706106cfccb90618d370ad32cd2b3f1db2e0286859a76fb | REQ-DATASERVICE-036 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-5e3fe524ea4b41b319e40134dcf913dc11bdb23b499738ecc72c99c1a17d59f6 | none | TASK-DATASERVICE-003, TASK-DATASERVICE-004, TASK-DATASERVICE-005, TASK-DATASERVICE-007, TASK-DATASERVICE-008, TASK-DATASERVICE-012, TASK-DATASERVICE-013, TASK-DATASERVICE-014 | AC-DATASERVICE-010-S01, AC-DATASERVICE-017-S01, AC-DATASERVICE-018-S01, AC-DATASERVICE-019-S01, AC-DATASERVICE-020-S01, AC-DATASERVICE-020-S02, AC-DATASERVICE-020-S03, AC-DATASERVICE-020-S04, AC-DATASERVICE-023-S01 |  |  |  |
| REQ-DATASERVICE-037 | intent-ce56f0eaa445816868a411a31c053954d29b35b5e42fbd6e563a4fddde1b7ad4 | REQ-DATASERVICE-037 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-077738dd6e24461920db9b8810d81d8f98e4d9de4165f009d070577475c98973 | none | TASK-DATASERVICE-003, TASK-DATASERVICE-004, TASK-DATASERVICE-005, TASK-DATASERVICE-007, TASK-DATASERVICE-008, TASK-DATASERVICE-012, TASK-DATASERVICE-013, TASK-DATASERVICE-014 | AC-DATASERVICE-010-S01, AC-DATASERVICE-017-S01, AC-DATASERVICE-018-S01, AC-DATASERVICE-019-S01, AC-DATASERVICE-020-S01, AC-DATASERVICE-020-S02, AC-DATASERVICE-020-S03, AC-DATASERVICE-020-S04, AC-DATASERVICE-023-S01 |  |  |  |
| REQ-DATASERVICE-038 | intent-9a1fb898d939851e8b9785b36bec428b20e8990e4eec1ef8f73ac09fa63f53f0 | REQ-DATASERVICE-038 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-8e92234a5642056106b1992116637e28063a7c0e3ec3dceb631d9d604e4755df | none | TASK-DATASERVICE-003, TASK-DATASERVICE-004, TASK-DATASERVICE-005, TASK-DATASERVICE-007, TASK-DATASERVICE-008, TASK-DATASERVICE-012, TASK-DATASERVICE-013, TASK-DATASERVICE-014 | AC-DATASERVICE-010-S01, AC-DATASERVICE-017-S01, AC-DATASERVICE-018-S01, AC-DATASERVICE-019-S01, AC-DATASERVICE-020-S01, AC-DATASERVICE-023-S01 |  |  |  |
| REQ-DATASERVICE-039 | intent-16d9ab68b9dcd8d03efff05bf4105fcd024666ea44afdf11141993e1bc286624 | REQ-DATASERVICE-039 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-bf075b4fe7c567701e6469c115bf51c6fadb2a227f98b5738964e5ecbdfcc86f | none | TASK-DATASERVICE-005, TASK-DATASERVICE-006, TASK-DATASERVICE-007, TASK-DATASERVICE-008, TASK-DATASERVICE-014 | AC-DATASERVICE-003-S01, AC-DATASERVICE-005-S01, AC-DATASERVICE-023-S01, AC-DATASERVICE-023-S02, AC-DATASERVICE-023-S03 |  |  |  |
| REQ-DATASERVICE-040 | intent-9927021cbaa7e3f84749d57e0220e97744be0930d4e2cb198e01e8560135fbf8 | REQ-DATASERVICE-040 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-af4801c1cf3d1c237e3be909221aa12385b91c3eee158ce10290eb03a928b730 | none | TASK-DATASERVICE-005, TASK-DATASERVICE-006, TASK-DATASERVICE-007, TASK-DATASERVICE-008, TASK-DATASERVICE-014 | AC-DATASERVICE-003-S01, AC-DATASERVICE-005-S01, AC-DATASERVICE-023-S01, AC-DATASERVICE-023-S02, AC-DATASERVICE-023-S03 |  |  |  |
| REQ-DATASERVICE-041 | intent-e4e57ff5f7614dc84eccbcc6f63c72154617edaf2ce4aeb7e3b97276c1817945 | REQ-DATASERVICE-041 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-5ad4bb87f844a99b6aef7db86e721e562ccf8652f2b7b143c5c2b89c73fbe937 | none | TASK-DATASERVICE-003, TASK-DATASERVICE-005, TASK-DATASERVICE-006, TASK-DATASERVICE-007, TASK-DATASERVICE-010, TASK-DATASERVICE-011 | AC-DATASERVICE-002-S01, AC-DATASERVICE-014-S01, AC-DATASERVICE-015-S01, AC-DATASERVICE-016-S01, AC-DATASERVICE-021-S01 |  |  |  |
| REQ-DATASERVICE-042 | intent-33f3bc412ff7e9dc403030d933c14e221882d9d142181e92c23dcbcfbe0a39be | REQ-DATASERVICE-042 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-9906a6b03b74d913f38ae30e0299cfccc1c45ad06e9e5a970e7906a7d3732a19 | none | TASK-DATASERVICE-003, TASK-DATASERVICE-004, TASK-DATASERVICE-005, TASK-DATASERVICE-007, TASK-DATASERVICE-009, TASK-DATASERVICE-012, TASK-DATASERVICE-014 | AC-DATASERVICE-001-S01, AC-DATASERVICE-004-S01, AC-DATASERVICE-006-S01, AC-DATASERVICE-007-S01, AC-DATASERVICE-008-S01, AC-DATASERVICE-009-S01, AC-DATASERVICE-009-S02, AC-DATASERVICE-024-S01 |  |  |  |
| REQ-DATASERVICE-043 | intent-7a01c5282fa10f526abf3f64a8b6dfbf322f1f3b9770b9587c5d2a330f26df15 | REQ-DATASERVICE-043 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-7fcbe5e2de2ca23e056be0fd24e6d9bda3b738e23d4d75c141eb6b9f9c5aba9c | none | TASK-DATASERVICE-015, TASK-DATASERVICE-016 |  |  |  |  |
| REQ-DATASERVICE-044 | intent-59da6965cc0bbcecf241f3a7065eca052ca39faeaa249366c31e39e4f0b76f98 | REQ-DATASERVICE-044 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-d5881f2dd07aab92ef2e0d2cbddeace93fdaa2e50f3e517b704e3920f457a662 | none | TASK-DATASERVICE-015, TASK-DATASERVICE-016 |  |  |  |  |
| REQ-DATASERVICE-045 | intent-829508232271c5be7835abb73d209c0484e5e1c1417eb5dbffb97af409241b07 | REQ-DATASERVICE-045 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-cb93643011d77bfa89237822cd7b095c62563bb92a8e0d61885fb60c1b6ecec3 | none | TASK-DATASERVICE-015, TASK-DATASERVICE-016 |  |  |  |  |
| REQ-DATASERVICE-046 | intent-498d23ca4cdcaa3a521435bd04b3f70b88d07dd363d30fb0b98b45359f5e661b | REQ-DATASERVICE-046 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-6c2d91f7166a082d979f870318544f90f04b54d8e7c34095eb6885fcce4a282e | none | TASK-DATASERVICE-004, TASK-DATASERVICE-005, TASK-DATASERVICE-006, TASK-DATASERVICE-007, TASK-DATASERVICE-008, TASK-DATASERVICE-009, TASK-DATASERVICE-011, TASK-DATASERVICE-014 | AC-DATASERVICE-001-S01, AC-DATASERVICE-002-S01, AC-DATASERVICE-003-S01, AC-DATASERVICE-006-S01, AC-DATASERVICE-007-S01, AC-DATASERVICE-011-S01, AC-DATASERVICE-012-S01, AC-DATASERVICE-013-S01, AC-DATASERVICE-023-S01, AC-DATASERVICE-024-S03 |  |  |  |
| REQ-DATASERVICE-047 | intent-5ca4313040d8e547430d5b30246f07914e7d3501daf75cc017de7c7e1597b2b7 | REQ-DATASERVICE-047 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-36f06dc282d5dfffa07d0b5aaf92063170b798607710054543e5fe42ee337773 | none | TASK-DATASERVICE-015, TASK-DATASERVICE-016 |  |  |  |  |
| REQ-DATASERVICE-048 | intent-5a2629492681f18d494705cf38c9a28e812c57290db050a0347b65be1988a512 | REQ-DATASERVICE-048 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-ba49e1c6281e899dcb99173654d20784a18d8c593cc0bf2f717466033622eee5 | none | TASK-DATASERVICE-015, TASK-DATASERVICE-016 |  |  |  |  |
| REQ-DATASERVICE-049 | intent-6f0d88f8f15ad85ed237806508c14a80622ebe038098f65d832a463c9d9a23a5 | REQ-DATASERVICE-049 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-c4a4f543afc22075f7f96846737e9d39dfc401c10efcbea30f8a69ad01dc8a07 | none | TASK-DATASERVICE-015, TASK-DATASERVICE-016 |  |  |  |  |
| REQ-DATASERVICE-050 | intent-b81e2b066d128331a9967a93f9bc1dc6ef0ebd9bb4c38cc6e3b4c4069b761591 | REQ-DATASERVICE-050 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-9f15e9aa2fa0f8b7cf189d1340f57122ba6d51377d1c3dab4d26220bc9ce7f8e | none | TASK-DATASERVICE-015, TASK-DATASERVICE-016 |  |  |  |  |
| REQ-DATASERVICE-051 | intent-8f7ecf81885799f3032b2f0b00b8ba0f8b459a25a149aa710a80c7b3aac66b42 | REQ-DATASERVICE-051 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-aa1323baccf50dd11b07e968f86fb394528b7475c1b554437c608cc91faacae4 | none | TASK-DATASERVICE-015, TASK-DATASERVICE-016 |  |  |  |  |
| NEG-DATASERVICE-001 | intent-1e96d282423f27019141c9f2c118c89f5e3179bf134aed196cfca280ed0cd924 | NEG-DATASERVICE-001 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-92d5a338edab9e1aaba052c9bc3e5941e0afc99bb541cc8d5b1e7754312a2ccc | none | TASK-DATASERVICE-015, TASK-DATASERVICE-016 |  |  |  |  |
| NEG-DATASERVICE-002 | intent-f7cf63bb5052e5b75e6c90e622614c4cef946a430c0033ef15257532eae02722 | NEG-DATASERVICE-002 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-0affd76604bb8f998f3cd70188ce98f62a03a3add6063780ef872b3c4364e45a | none | TASK-DATASERVICE-015, TASK-DATASERVICE-016 |  |  |  |  |
| REQ-DATASERVICE-052 | intent-da7e880aa5f5f727c9b2354e9b4af073622449a3c84712153dc536ed51e595f7 | REQ-DATASERVICE-052 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-c4e3e8739eaf60d5f74cff7fa2910b2a12957961e0fbccec7bafa51f95527eb4 | none | TASK-DATASERVICE-015, TASK-DATASERVICE-016 |  |  |  |  |
| REQ-DATASERVICE-053 | intent-9d28a0b11774c2fd8c66b0ec1f21b94f16f4258b5858eac3a57c32bed4d84dbb | REQ-DATASERVICE-053 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-2433e9b726dda23d729b561f7a834fc7524d6078e0b36a2f5f962e90bed7efb5 | none | TASK-DATASERVICE-016 |  |  |  |  |
| REQ-DATASERVICE-054 | intent-572a2d2c32a06d97c3d85ae3dceee5085b1dbd6b24ccc85a4ddcd02b56a951bf | REQ-DATASERVICE-054 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-cb4f41e7eee3fa582788f1532b9fc73b3c26f598f6221a58ee6ed13cf8bfcb0a | none | TASK-DATASERVICE-016 |  |  |  |  |
| NEG-DATASERVICE-003 | intent-d2250d75035880187c0d3e3a29699ce63fce74b16a39cdbf897d5403ba2d8d25 | NEG-DATASERVICE-003 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-a9a0bf88f1a356e8969df58810ca2b9c25901aa93457e4ad1772139631610940 | none | TASK-DATASERVICE-016 |  |  |  |  |
| REQ-DATASERVICE-055 | intent-daf078434a2ee05226bbbd4b9553175f44b5cf9847af364ef65c1a1a94269584 | REQ-DATASERVICE-055 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-1ab1c72f0388be8d3db1c6d460f87cfdb49e9f0b7a54e5c61e698991c449ab13 | none | TASK-DATASERVICE-016 |  |  |  |  |
| REQ-DATASERVICE-056 | intent-04cd926f329e6d867662ae554185954a1e2bb5ebce82ac23a2f1f9cd781a30c9 | REQ-DATASERVICE-056 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-06856f718c75d75e2895d518ca48654d339188f125608fec15b94d9185675405 | none | TASK-DATASERVICE-016 |  |  |  |  |
| REQ-DATASERVICE-057 | intent-8058c2082593398a9ac8cd0e53534de9a82200e31bd7fd8bdc28cfb49c549b4c | REQ-DATASERVICE-057 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-c3a7243da1a020d741756f6a4d6f086f5f1573e7b454cfbb0c0fafbc3824abb5 | none | TASK-DATASERVICE-016 |  |  |  |  |
| REQ-DATASERVICE-058 | intent-f98ec2d26f29fcf4d6b0d7c61e7716fda28999b557c41f05f45dd37932d40e6b | REQ-DATASERVICE-058 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-679a5f9b2e11d36872646c6a0390fe0323b8bf7689180f3f90f0f04b4fc16868 | none | TASK-DATASERVICE-016 |  |  |  |  |
| REQ-DATASERVICE-059 | intent-60f6fb63abd534ae504ed14edeade15b92ee10f443ac0053b7c16965266c0c75 | REQ-DATASERVICE-059 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-151239e2954dd0c8e3d26bed87efe49e08d65c31f0408f4df04f5525a7189fad | none | TASK-DATASERVICE-002, TASK-DATASERVICE-015 |  |  |  |  |
| REQ-DATASERVICE-060 | intent-de6e462778b6358ac540f1a068840f4f87f85f8987e4890ce485f2b2f61b7244 | REQ-DATASERVICE-060 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-98f9fb1b905feb72909fc2e9e0795366fd72305362b8107a6b64ff4017e6d2c6 | none | TASK-DATASERVICE-002, TASK-DATASERVICE-015 |  |  |  |  |
| REQ-DATASERVICE-061 | intent-f238f25b1f6219a029d89869d8f3991895638025139cc6c419f927aa6443e6fa | REQ-DATASERVICE-061 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-0d355c22ea5b83df8be4c9cdca449b267805827c70823fb9beb902d0d342a32b | none | TASK-DATASERVICE-002, TASK-DATASERVICE-015 |  |  |  |  |
| REQ-DATASERVICE-062 | intent-b3600d75afb12dc7fb8ac1de658b7695d74dee12fbe7abbf0a1f664e79cdb3d4 | REQ-DATASERVICE-062 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-dee345e1603861d0f24e241895eb28e617cd7a43058ceaecb4342edff7aec399 | none | TASK-DATASERVICE-002, TASK-DATASERVICE-015 |  |  |  |  |
| REQ-DATASERVICE-063 | intent-aab576a36245ce2cfb646bdaf193cf81b613bc6b25ea4e50cb378a1b0e19ea60 | REQ-DATASERVICE-063 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-716f1122adf4e6e188bbf76d515d2df3786f2a01e10b570bb792a8ad4f164546 | none | TASK-DATASERVICE-002, TASK-DATASERVICE-015 |  |  |  |  |
| REQ-DATASERVICE-064 | intent-9197dd95b70d320bfb316e5aff806d35c58ba9bc60d59e6cc9cecff65993023f | REQ-DATASERVICE-064 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-53139b7c30f7660c504ccecd3c9c7f78875390ed7e066651feb4c415110f05cd | none | TASK-DATASERVICE-002, TASK-DATASERVICE-015 |  |  |  |  |
| REQ-DATASERVICE-065 | intent-ff49dab18b7b671e1dde95f3ecf2ed808894ecdc7619b1a5a8d7c7b0a24fdb6c | REQ-DATASERVICE-065 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-60c9477c6b4fae3b1b63059115389dc45e9edf83ed6eee8aa7fdd080b675d6d6 | none | TASK-DATASERVICE-002, TASK-DATASERVICE-015 |  |  |  |  |
| REQ-DATASERVICE-066 | intent-2156f2513f0c95eeeafe74b7dbed82ff9837e2da75c6edd7a7160fdd2d963312 | REQ-DATASERVICE-066 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-3f5cdd65f96eb8714273bcca470db23e8c0cea2ba3f9da1e1d290185c9206101 | none | TASK-DATASERVICE-002, TASK-DATASERVICE-015 |  |  |  |  |
| REQ-DATASERVICE-067 | intent-b03e2641124b2ae42994390c584d5991ea12ab60ee3c7c661cbb0ce84256858e | REQ-DATASERVICE-067 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-a27af57b0f36680c7601326c3a4914fbdac961d4bf8e464cfcb3a79dcda93109 | none | TASK-DATASERVICE-002, TASK-DATASERVICE-015 |  |  |  |  |
| REQ-DATASERVICE-068 | intent-ee836536aae015a8088967914d84536412748f40203d31f8a23d5ea1c834a62c | REQ-DATASERVICE-068 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-08fb5f297e649348161b3617f146b5700b2148b48ddf9ebda2530617b3d613d9 | none | TASK-DATASERVICE-002, TASK-DATASERVICE-015 |  |  |  |  |
| OUT-DATASERVICE-001 | intent-6a5366556cd699ab1e8b421c6708af7b50ef9420d67eae5723077ed4723610d6 | OUT-DATASERVICE-001 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-b98647957ed3ed64eed0f98feadef85355f772869440661fa69482da06e8f32d | none | TASK-DATASERVICE-016 |  |  |  |  |
| OUT-DATASERVICE-002 | intent-8cd95dff9eb80f76706662ac3353699f0908125dc7341b0fc4698a044f4a95de | OUT-DATASERVICE-002 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-790e50d588c4cc78ff2e338fed1673ab6bc888450bf5e1366f038f1092214ee1 | none | TASK-DATASERVICE-016 |  |  |  |  |
| OUT-DATASERVICE-003 | intent-d7314cb5c2dc31de40780943f28e7a7a8705ba5e4f9d9cba1f2e8b6c93eea234 | OUT-DATASERVICE-003 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-63e6788eeec2bba9052b31fd16f7cc4a365aea5a62077a3010fb9839920aad59 | none | TASK-DATASERVICE-016 |  |  |  |  |
| OUT-DATASERVICE-004 | intent-b9ee573723e5d50010eefca2c57f11a0456fe4e9086d8c38b5d59041e7afe4ba | OUT-DATASERVICE-004 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-fd5a711959e6d2cf657979069047fe86f0239e13f3187328331f8bbc0ac1be61 | none | TASK-DATASERVICE-016 |  |  |  |  |
| OUT-DATASERVICE-005 | intent-85cc13abd81cbba66566520b2ca8661de92fdf1c57a02fc4daae35e198f8a42e | OUT-DATASERVICE-005 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-c152d152d4bf8ae554f02ed6d3431c1c186e5646fa0aa2d3bb5c11182e75b076 | none | TASK-DATASERVICE-016 |  |  |  |  |
| OUT-DATASERVICE-006 | intent-d37071fd303c21779a7303f8f1dca0bdf26d3a4d2bb67c694a29901c93530225 | OUT-DATASERVICE-006 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-6c678023fb8f448cb55549ff2ad3276d1d05d3b5d7c1eb9bfc2e3102a2212389 | none | TASK-DATASERVICE-016 |  |  |  |  |
| OUT-DATASERVICE-007 | intent-d59f29afea8c2f00fb63c080e825863908611c955f14fbf588aee5a92f0f8672 | OUT-DATASERVICE-007 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-6e99a9d9715bd682d33747accefa758cbe7f6be5952292b95fec4757b46c3d06 | none | TASK-DATASERVICE-016 |  |  |  |  |
| OUT-DATASERVICE-008 | intent-b55bc82a6b9bf2d97fd95f6400f7053d1d047e52da24959967357b3e5cf1ccda | OUT-DATASERVICE-008 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-35b197602fa82056c0a75c9dfb3a868168aecfcec3e055443fde41b08b7aaf6e | none | TASK-DATASERVICE-016 |  |  |  |  |
| OUT-DATASERVICE-009 | intent-a65df1e28d2c90b082f5057a4957e4c264ef8ae0feccfbef80ceac6e4465267a | OUT-DATASERVICE-009 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-e40d7dd37858fe761293caa45ba3dfdc0f7b47a761e18dfd57d1b0a96c3bd4df | none | TASK-DATASERVICE-016 |  |  |  |  |
| OUT-DATASERVICE-010 | intent-87af59073d2c719606f2dd3b289420ddd431e4b8a65ea01984fad7e50c98bf3f | OUT-DATASERVICE-010 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-a11c03b4cd53c4d1bb8222023f913baa522177d3151a82cffd20e8a257b373c5 | none | TASK-DATASERVICE-016 |  |  |  |  |
| OUT-DATASERVICE-011 | intent-0f27725ff86e6c8bb46fc5a8649d7f3688b0162b6d1a9f9129d97c12fcf9ecd8 | OUT-DATASERVICE-011 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-f661974c7c0b6725236abe161322e48ec38fefd44d3b546521981d79ee1c4903 | none | TASK-DATASERVICE-016 |  |  |  |  |
| OUT-DATASERVICE-012 | intent-5b4115f67950f116fe8bb39c037e0e6091b0dfab3d6c9cedd21847ab7f02b659 | OUT-DATASERVICE-012 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-09a80d43724aa7aa97f5c8f3347e680fb37f81a85cf0d7da046ed40c65a1463d | none | TASK-DATASERVICE-016 |  |  |  |  |
| OUT-DATASERVICE-013 | intent-7b2dfe3514305bb97c146a065bd6de7f01f3a9a8a0efba185e581302560c93cd | OUT-DATASERVICE-013 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-af56dc7587a256879d0b3eaaaae6c8a906409228a6766d75bef5201cc5fed40b | none | TASK-DATASERVICE-016 |  |  |  |  |
| OUT-DATASERVICE-014 | intent-eca3a608ff7e60e4ea8863490ba09813cce929db9d22fde9e19950f2baa09c08 | OUT-DATASERVICE-014 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-6acb0770dca96c1fad8b75cb4b43b3a4df051d3b2297cad5c8fd6787b5d57eb5 | none | TASK-DATASERVICE-016 |  |  |  |  |
| OUT-DATASERVICE-015 | intent-4874cbecc1eb423c52ee20d3e7606dc05b2a55cb4790c6d35178842e0fda3b40 | OUT-DATASERVICE-015 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-07f0504ea2ad79e5944adf4e37de668b20b490a732bb09680568b2499b0b487e | none | TASK-DATASERVICE-016 |  |  |  |  |
| OUT-DATASERVICE-016 | intent-4b4e53725bfd1441fabbda8f97cc1600cd5eb91e3697a93c5071596d736ea9f4 | OUT-DATASERVICE-016 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-272e0e4b9b009d0957a80ff794f2653f2f93abd229f4b7043ad93c7f63942d33 | none | TASK-DATASERVICE-016 |  |  |  |  |
| OUT-DATASERVICE-017 | intent-8d9bc9105e390a8f9a0fc74edc7dc72b2b9875921ab8434a87b31fbacabda3cb | OUT-DATASERVICE-017 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-87e3aaebd76190dd140ea587dd187043241ca00a0a0512744e10e235cc1d2c0f | none | TASK-DATASERVICE-016 |  |  |  |  |
| OUT-DATASERVICE-018 | intent-959047f95f2078462551bf67cb25016feac6c2db4ff54cac8621c480888b611a | OUT-DATASERVICE-018 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-6b0f6822ba59f8f6292544ce3452437707372384256dccc97fda9255585eb5d7 | none | TASK-DATASERVICE-016 |  |  |  |  |
| OUT-DATASERVICE-019 | intent-7f2290cf660a5a754dbb6e195b19139992151096b5770935f0908ceeb1803394 | OUT-DATASERVICE-019 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-ef6824c1ac2b3465d1f16dc6ca14d6298e1ecf637258ea02da0178cce89e4196 | none | TASK-DATASERVICE-016 |  |  |  |  |
| OUT-DATASERVICE-020 | intent-856b424e2f4db4a385a2e70b380fce8d33cf2acd71db2f6b3ca36fc32a38ca39 | OUT-DATASERVICE-020 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-60e0a788b2d7725ea70c8296224f3f85d2f499879ddddfb9c0f84ce22254cccb | none | TASK-DATASERVICE-016 |  |  |  |  |
| OUT-DATASERVICE-021 | intent-659271d828a9c9592dcf11dafef079b0d1b6cbb6f7e6d185f30b1a1a56656159 | OUT-DATASERVICE-021 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-62a98a350f0e311cf3f6375765758019f64d8d6f35f0c043450ff44494206a0e | none | TASK-DATASERVICE-016 |  |  |  |  |
| OUT-DATASERVICE-022 | intent-997aaed245c97e6ccfb1a9b40e015f60efb20e967c758593b30dad330684d8a1 | OUT-DATASERVICE-022 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-d8e20d715e1b495cf6a36dbd349a4380ca1c07ce9b2903b14421e651e8b0ec17 | none | TASK-DATASERVICE-016 |  |  |  |  |
| OUT-DATASERVICE-023 | intent-783879a94f3d79f919b4c110f65233fa01b1021f753013516bb1903a758891bd | OUT-DATASERVICE-023 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-44d0a9d1dd89a26fa9f1121ea55a57c67cb315fca9bc4fd47f6540b6f345c8db | none | TASK-DATASERVICE-016 |  |  |  |  |
| OUT-DATASERVICE-024 | intent-8bcf8297034975370e191ae40eff6275009d1970dccd7a3b2d266c5738f040cd | OUT-DATASERVICE-024 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-4ce942f32d811ea850d99847cfdb623297758a74ea42f1ca62e4eddb14104d60 | none | TASK-DATASERVICE-016 |  |  |  |  |
| OUT-DATASERVICE-025 | intent-234a8ef66aa4e24a805e5582f6a81eb502594ff28de40656c7880e340e43d148 | OUT-DATASERVICE-025 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-1ec52f297b742e8f132150504adf3b4d377efef13573488c14a7c2743c527141 | none | TASK-DATASERVICE-016 |  |  |  |  |
| OUT-DATASERVICE-026 | intent-fd7cf54cfc28b6d4e22816587d697c2f43ef97824f05b07ed82c0ee6dddc39f0 | OUT-DATASERVICE-026 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-270c4d34a4646247b7085ff5695d97a9530c0ac62f766f5d0f16773b099270ae | none | TASK-DATASERVICE-016 |  |  |  |  |
| OUT-DATASERVICE-027 | intent-b9d15c5a59b82930da22d282dd710fc112994bce4b003f35e3d4f116adb5cf3e | OUT-DATASERVICE-027 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-b221756f165d7d7d6b97bbd2d2e0ea221bfbbf855fa1f76cadb6e8c14a0b9f79 | none | TASK-DATASERVICE-016 |  |  |  |  |
| NFR-DATASERVICE-001 | intent-9099ca3046522cd68d7ba9934a57426977d914d7a2571c227d196432f1d701ea | NFR-DATASERVICE-001 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-9acfbb0132ecd18eaa3dbee5af7369da26f8fbc4eb3a69301278233b754d3cd5 | none | TASK-DATASERVICE-015 |  |  |  |  |
| NFR-DATASERVICE-002 | intent-f3d37ad82f1e83d7e5153a9d4d03c32f555e4c5e2bfba8ab21a08f7d2a253eb0 | NFR-DATASERVICE-002 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-8c23c3f54ab0be6a3574352292e1fdfc2c44658cd37a09401793cdc4bb2a2c6f | none | TASK-DATASERVICE-015 |  |  |  |  |
| NFR-DATASERVICE-003 | intent-892caac4666b606552536d213455e10164b302f8c7c10efac8771e8d59ce217b | NFR-DATASERVICE-003 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-c4510ef04403099662e7881c230037fb1c85d89f417a86496f28e09e8bd2d701 | none | TASK-DATASERVICE-015 |  |  |  |  |
| NFR-DATASERVICE-004 | intent-24f9d56b1d0be21bf08d1aabba4ded6dc04097b69102bd73cec3ac6a29db6831 | NFR-DATASERVICE-004 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-b983df3468ffaf2e97540c495d56a6339f8f6c38f50cae0676c1dddd694ad383 | none | TASK-DATASERVICE-015 |  |  |  |  |
| NFR-DATASERVICE-005 | intent-186a3083772efbf41d3ff24d4e5d8db30bc5864b05c3bf153f22cac0be2e9fe2 | NFR-DATASERVICE-005 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-26931bb436edc7641fe0d2c2e4be2d13de02ed4edad8ec85de2394261c760dec | none | TASK-DATASERVICE-015 |  |  |  |  |
| NFR-DATASERVICE-006 | intent-6d7c4f066d19c40ae532fced89f56b1b1ca3d4a9fb4648773b5afb676c77b739 | NFR-DATASERVICE-006 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-fc301ebf1f4c60c55813c300fdaea8dbde6bfad8346fb21c3d4ed6a7cbd39051 | none | TASK-DATASERVICE-015 |  |  |  |  |
| NFR-DATASERVICE-007 | intent-90ea297535dc065816119c81e01e2f8434dafcd192d16f3a0521cecf10c49f12 | NFR-DATASERVICE-007 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-6f6cf33eee863d3a62d50d1a0c71d43ef06dcc377066f902efb17c8c50d908ca | none | TASK-DATASERVICE-015 |  |  |  |  |
| NFR-DATASERVICE-008 | intent-524fbe715dc98e9badb0fbf6ccfda8071e5c26df78d76c3496fdfcb3fde8d5aa | NFR-DATASERVICE-008 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-0df7ef95ee7bb27e9d91886a49bc06c29e31cd55b0e34e52a4e76c485c7e0af4 | none | TASK-DATASERVICE-015 |  |  |  |  |
| NFR-DATASERVICE-009 | intent-21716fd11807f614afbaa1a6fb7a3fff264d29e34d94b528f8c3444ae2ad9e76 | NFR-DATASERVICE-009 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-7605674a9fa510ef4f1301d93a0ae46bc7a417449933d83c97054dc545d1137b | none | TASK-DATASERVICE-015 |  |  |  |  |
| NFR-DATASERVICE-010 | intent-70c424a53f9a3b46741323ef2b66e1e3da3f082a8a0f76c56a7824efb6f944ad | NFR-DATASERVICE-010 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-a3f5395134d93c535be04922832b4e92a9b2cac80e4e1aaa0039c497b07e25af | none | TASK-DATASERVICE-015 |  |  |  |  |
| NFR-DATASERVICE-011 | intent-a7f525a85a6bdccc807d5f6e4c5595e8f55350a0ef8032729ee4fde39a386f62 | NFR-DATASERVICE-011 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-034db19ddaf84a41cc3c7b6f43e2227f8ffbab83a1fb527495d9ce3e3ec6387d | none | TASK-DATASERVICE-015 |  |  |  |  |
| NFR-DATASERVICE-012 | intent-4beb37ae5c935490cf9d7c6c49955391d2944bd787d4b683974f75d5cf851bbc | NFR-DATASERVICE-012 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-f7da6f1649a52187ff4bbd0ff819a2d1421c16755c2e242b08717b67a3e89cc4 | none | TASK-DATASERVICE-015 |  |  |  |  |
| NFR-DATASERVICE-013 | intent-5394bac96682a1cf7ee2dd15d9f65c1257a7827c196632273a505a1d2b2024df | NFR-DATASERVICE-013 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-709aebdbad960d1460756d57d90b1231865e1a5ca00c1e859e229581aea5ade3 | none | TASK-DATASERVICE-015 |  |  |  |  |
| NFR-DATASERVICE-014 | intent-805fad578a86ab17e4fd7b47043ae5d63949b251b5e07989e2b83fc82c053ad0 | NFR-DATASERVICE-014 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-a611dec81ebddcb4c909262387b4868b7fd0eae75e8ea7f1b39ada8e86efd560 | none | TASK-DATASERVICE-015 |  |  |  |  |
| NFR-DATASERVICE-015 | intent-d5868dd4f7af88b3c2bc85bd67eaea64ca73ad594bf474174ef02d72cbf696b3 | NFR-DATASERVICE-015 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-380e1d409006a4fd093f4850cb9c0cf92acb7d5e60da02d8dd54be6fabb14e0d | none | TASK-DATASERVICE-015 |  |  |  |  |
| NFR-DATASERVICE-016 | intent-540055f5c8d1af53ef148d49df3a83f7ecc41c0a6cd22bfac7f8a22d96955413 | NFR-DATASERVICE-016 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-54365d0213ccc28eff22bfe92859d772b61c397cdc0083e47e4e370c3f96f079 | none | TASK-DATASERVICE-015 |  |  |  |  |
| NFR-DATASERVICE-017 | intent-bef680a1c21a4631353d43d29bca7a4e60b71dbdf8f94a7ccab9f3d9ba3d44a9 | NFR-DATASERVICE-017 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-50047fe1a9113016de85fd0c54cf9cea5fb96ba9a79db6b086fbae8c9cc1b903 | none | TASK-DATASERVICE-015 |  |  |  |  |
| NFR-DATASERVICE-018 | intent-fb337870059b3d59b3642673789ed53fabb238f1e5c51e19fdf4f855dd2d7f53 | NFR-DATASERVICE-018 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-bd9430daed5b211e636180180f6a0ec52a782e7e20794688b29a7af1683f5268 | none | TASK-DATASERVICE-015 |  |  |  |  |
| NFR-DATASERVICE-019 | intent-27157ae1a67f5aa349aae5cfe497921e78c00f4e117ba6d5584ad059e0f094f4 | NFR-DATASERVICE-019 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-1ce21b737c42579fd2cb659eb55a86eeaf598963434b04e4ba5b6ebf15766543 | none | TASK-DATASERVICE-015 |  |  |  |  |
| NFR-DATASERVICE-020 | intent-786ba0e670c51a4427778379a18fbed3fc39edb1378471077eb7147c8046383b | NFR-DATASERVICE-020 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-f51cd09913f09a741e3076933a6225c4dfa4486ad523a0046017bc356caaa6c5 | none | TASK-DATASERVICE-015 |  |  |  |  |
| REQ-DATASERVICE-069 | intent-c55d6fc92675a38facc2c38c80b490852e48e5aa5c2fbed953c342aba509bb66 | REQ-DATASERVICE-069 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-28de952afb30ab6c31cd8824a7c3193a98a57dde79f785f18403b58d8ee91573 | none | TASK-DATASERVICE-002 |  |  |  |  |
| NFR-DATASERVICE-021 | intent-c14f5b7d6b6d4aeb2d0ee482b22035fa8d82f6e6f55e30bfc7a6d16a962de23f | NFR-DATASERVICE-021 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-74c811ed0c926fee33c53426d81cb17891266d87a2751dafc1b7fd15add401b6 | none | TASK-DATASERVICE-015, TASK-DATASERVICE-016 |  |  |  |  |
| NFR-DATASERVICE-022 | intent-6ac32463c9f395d0c891a2309d48308b23ba3b537f675d6b9340803268713a1b | NFR-DATASERVICE-022 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-67061ec8088a36132c89a5609ea50a68e94adf07094d53c022164e7bf32de93a | none | TASK-DATASERVICE-015, TASK-DATASERVICE-016 |  |  |  |  |
| REQ-DATASERVICE-070 | intent-f222544dbf35a52e882f1b1ab2bb6b94046c8650e00625d8ba9c29b1463ae7b3 | REQ-DATASERVICE-070 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-9669cd9f0ed9113a6de791c669f21150b31661a9239eeca5e8577f20adecddd6 | none | TASK-DATASERVICE-004, TASK-DATASERVICE-007 | AC-DATASERVICE-001-S01, AC-DATASERVICE-002-S01, AC-DATASERVICE-003-S01, AC-DATASERVICE-004-S01, AC-DATASERVICE-005-S01, AC-DATASERVICE-006-S01, AC-DATASERVICE-007-S01, AC-DATASERVICE-008-S01, AC-DATASERVICE-009-S01, AC-DATASERVICE-009-S02, AC-DATASERVICE-010-S01, AC-DATASERVICE-013-S02, AC-DATASERVICE-022-S01, AC-DATASERVICE-022-S02, AC-DATASERVICE-023-S01, AC-DATASERVICE-023-S02, AC-DATASERVICE-024-S01, AC-DATASERVICE-024-S02 |  |  |  |
| REQ-DATASERVICE-071 | intent-f1962347ad2ff6eeaf1e094fc1d26680d8ae064d6d25c0190df6a892177b8214 | REQ-DATASERVICE-071 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-2985dddce608d0daa624d6938fbee06854598e17dd501d86328de8531fdbf45c | none | TASK-DATASERVICE-004, TASK-DATASERVICE-007 | AC-DATASERVICE-001-S01, AC-DATASERVICE-002-S01, AC-DATASERVICE-003-S01, AC-DATASERVICE-004-S01, AC-DATASERVICE-005-S01, AC-DATASERVICE-006-S01, AC-DATASERVICE-007-S01, AC-DATASERVICE-008-S01, AC-DATASERVICE-009-S01, AC-DATASERVICE-009-S02, AC-DATASERVICE-010-S01, AC-DATASERVICE-013-S02, AC-DATASERVICE-022-S01, AC-DATASERVICE-022-S02, AC-DATASERVICE-023-S01, AC-DATASERVICE-023-S02, AC-DATASERVICE-024-S01, AC-DATASERVICE-024-S02 |  |  |  |
| REQ-DATASERVICE-072 | intent-8e664927cdbfdb0655c426f3fcd065e651e59325eb7b83c505db5e7a97c149ef | REQ-DATASERVICE-072 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-9361a1151bbee1d24623d5037db5d773707e5a77958cf5d374d68308b79cfcc0 | none | TASK-DATASERVICE-004, TASK-DATASERVICE-007 | AC-DATASERVICE-001-S01, AC-DATASERVICE-002-S01, AC-DATASERVICE-003-S01, AC-DATASERVICE-004-S01, AC-DATASERVICE-005-S01, AC-DATASERVICE-006-S01, AC-DATASERVICE-007-S01, AC-DATASERVICE-008-S01, AC-DATASERVICE-009-S01, AC-DATASERVICE-009-S02, AC-DATASERVICE-010-S01, AC-DATASERVICE-013-S02, AC-DATASERVICE-022-S01, AC-DATASERVICE-022-S02, AC-DATASERVICE-023-S01, AC-DATASERVICE-023-S02, AC-DATASERVICE-024-S01, AC-DATASERVICE-024-S02 |  |  |  |
| REQ-DATASERVICE-073 | intent-364941b1cb0e9497bb78816debc677d924f6c446ce40704d65d7a17985ad72be | REQ-DATASERVICE-073 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-12b3eaab5b214e939ba793c4c5279990a5a0eb6d1de6c0a5c06e1ecd7c752edd | none | TASK-DATASERVICE-004, TASK-DATASERVICE-007 | AC-DATASERVICE-001-S01, AC-DATASERVICE-002-S01, AC-DATASERVICE-003-S01, AC-DATASERVICE-004-S01, AC-DATASERVICE-005-S01, AC-DATASERVICE-006-S01, AC-DATASERVICE-007-S01, AC-DATASERVICE-008-S01, AC-DATASERVICE-009-S01, AC-DATASERVICE-009-S02, AC-DATASERVICE-010-S01, AC-DATASERVICE-013-S02, AC-DATASERVICE-022-S01, AC-DATASERVICE-022-S02, AC-DATASERVICE-023-S01, AC-DATASERVICE-023-S02, AC-DATASERVICE-024-S01, AC-DATASERVICE-024-S02 |  |  |  |
| REQ-DATASERVICE-074 | intent-d5a073c5749756329e9e6b31bad338ea008d3d4accc3182c24eca71bcd63286a | REQ-DATASERVICE-074 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-bc21033cf3d163ca244eb4c7696e89931b6bf0c3d6dc2218b387aecc272be10d | none | TASK-DATASERVICE-004, TASK-DATASERVICE-007 | AC-DATASERVICE-001-S01, AC-DATASERVICE-002-S01, AC-DATASERVICE-003-S01, AC-DATASERVICE-004-S01, AC-DATASERVICE-005-S01, AC-DATASERVICE-006-S01, AC-DATASERVICE-007-S01, AC-DATASERVICE-008-S01, AC-DATASERVICE-009-S01, AC-DATASERVICE-009-S02, AC-DATASERVICE-010-S01, AC-DATASERVICE-013-S02, AC-DATASERVICE-022-S01, AC-DATASERVICE-022-S02, AC-DATASERVICE-023-S01, AC-DATASERVICE-023-S02, AC-DATASERVICE-024-S01, AC-DATASERVICE-024-S02 |  |  |  |
| REQ-DATASERVICE-075 | intent-eb547d4bc9a9c887105ce5ce11130b1dc997a7b96dac65d9f02d7e337d46c9fa | REQ-DATASERVICE-075 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-f4b6b6342a52fcec4a7081b417e8cd3e79c50e9b3442dfc2555660906a24e4e7 | none | TASK-DATASERVICE-004, TASK-DATASERVICE-007 | AC-DATASERVICE-001-S01, AC-DATASERVICE-002-S01, AC-DATASERVICE-003-S01, AC-DATASERVICE-004-S01, AC-DATASERVICE-005-S01, AC-DATASERVICE-006-S01, AC-DATASERVICE-007-S01, AC-DATASERVICE-008-S01, AC-DATASERVICE-009-S01, AC-DATASERVICE-009-S02, AC-DATASERVICE-010-S01, AC-DATASERVICE-013-S02, AC-DATASERVICE-022-S01, AC-DATASERVICE-022-S02, AC-DATASERVICE-023-S01, AC-DATASERVICE-023-S02, AC-DATASERVICE-024-S01, AC-DATASERVICE-024-S02 |  |  |  |
| REQ-DATASERVICE-076 | intent-b695d7cf496dfcb793704c38c4e3172f6563f505294b9f7ca52c854513e586e2 | REQ-DATASERVICE-076 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-cbed4b177222300fe963be7bf4dcc94f4b7852770a14b4c1499e573fc80fd737 | none | TASK-DATASERVICE-004, TASK-DATASERVICE-007 | AC-DATASERVICE-001-S01, AC-DATASERVICE-002-S01, AC-DATASERVICE-003-S01, AC-DATASERVICE-004-S01, AC-DATASERVICE-005-S01, AC-DATASERVICE-006-S01, AC-DATASERVICE-007-S01, AC-DATASERVICE-008-S01, AC-DATASERVICE-009-S01, AC-DATASERVICE-009-S02, AC-DATASERVICE-010-S01, AC-DATASERVICE-013-S02, AC-DATASERVICE-022-S01, AC-DATASERVICE-022-S02, AC-DATASERVICE-023-S01, AC-DATASERVICE-023-S02, AC-DATASERVICE-024-S01, AC-DATASERVICE-024-S02 |  |  |  |
| REQ-DATASERVICE-077 | intent-cdf88b62289b6c8441bc9f2e884b0ee58bff9ac8c13863d524ef6289761bc9ef | REQ-DATASERVICE-077 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-6556b58c3fdb9c846f9a7caaace991b56371c140750d560a627ef95a1c53964f | none | TASK-DATASERVICE-004, TASK-DATASERVICE-007 | AC-DATASERVICE-001-S01, AC-DATASERVICE-002-S01, AC-DATASERVICE-003-S01, AC-DATASERVICE-004-S01, AC-DATASERVICE-005-S01, AC-DATASERVICE-006-S01, AC-DATASERVICE-007-S01, AC-DATASERVICE-008-S01, AC-DATASERVICE-009-S01, AC-DATASERVICE-009-S02, AC-DATASERVICE-010-S01, AC-DATASERVICE-013-S02, AC-DATASERVICE-022-S01, AC-DATASERVICE-022-S02, AC-DATASERVICE-023-S01, AC-DATASERVICE-023-S02, AC-DATASERVICE-024-S01, AC-DATASERVICE-024-S02 |  |  |  |
| REQ-DATASERVICE-078 | intent-16fb519af73e89903c33fd50d9ac4bcbaf4eb4a677c36ce41c1c300fca7c464c | REQ-DATASERVICE-078 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-c33c868eb6f6ff86d3583994a3c5f619a50428c0fc62dbf05a0a6947229decd9 | none | TASK-DATASERVICE-005, TASK-DATASERVICE-006, TASK-DATASERVICE-007, TASK-DATASERVICE-013 | AC-DATASERVICE-001-S01, AC-DATASERVICE-002-S01, AC-DATASERVICE-003-S01, AC-DATASERVICE-004-S01, AC-DATASERVICE-005-S01, AC-DATASERVICE-006-S01, AC-DATASERVICE-008-S01, AC-DATASERVICE-013-S02, AC-DATASERVICE-015-S01, AC-DATASERVICE-016-S01, AC-DATASERVICE-016-S02, AC-DATASERVICE-016-S03, AC-DATASERVICE-020-S01, AC-DATASERVICE-020-S02, AC-DATASERVICE-020-S03, AC-DATASERVICE-020-S04, AC-DATASERVICE-021-S01, AC-DATASERVICE-021-S02, AC-DATASERVICE-023-S01, AC-DATASERVICE-023-S02, AC-DATASERVICE-023-S03, AC-DATASERVICE-024-S01, AC-DATASERVICE-024-S02, AC-DATASERVICE-024-S03 |  |  |  |
| REQ-DATASERVICE-079 | intent-ba99cd5a6dfd1e82b57fe4d3fa2a1a8efbdfc6c82ce0821ecaf41eb87109feda | REQ-DATASERVICE-079 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-1ff64fd4e40240db2456cdf785949cdabbfd058c6cd21b869a7aa14d28c93d31 | none | TASK-DATASERVICE-005, TASK-DATASERVICE-006, TASK-DATASERVICE-007, TASK-DATASERVICE-013 | AC-DATASERVICE-001-S01, AC-DATASERVICE-002-S01, AC-DATASERVICE-003-S01, AC-DATASERVICE-004-S01, AC-DATASERVICE-005-S01, AC-DATASERVICE-006-S01, AC-DATASERVICE-008-S01, AC-DATASERVICE-013-S02, AC-DATASERVICE-015-S01, AC-DATASERVICE-016-S01, AC-DATASERVICE-016-S02, AC-DATASERVICE-016-S03, AC-DATASERVICE-020-S01, AC-DATASERVICE-020-S02, AC-DATASERVICE-020-S03, AC-DATASERVICE-020-S04, AC-DATASERVICE-021-S01, AC-DATASERVICE-021-S02, AC-DATASERVICE-023-S01, AC-DATASERVICE-023-S02, AC-DATASERVICE-023-S03, AC-DATASERVICE-024-S01, AC-DATASERVICE-024-S02, AC-DATASERVICE-024-S03 |  |  |  |
| NEG-DATASERVICE-004 | intent-483d516a47881d7cb964b5673b366d5ab05b5e02f695c25590ff0bae74fb5b73 | NEG-DATASERVICE-004 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-ef1bf53b71c5d85fb9f22b1266c53b33fce35a1f32e3c3efa50fe224f5adba49 | none | TASK-DATASERVICE-005, TASK-DATASERVICE-006, TASK-DATASERVICE-007, TASK-DATASERVICE-013 | AC-DATASERVICE-001-S01, AC-DATASERVICE-002-S01, AC-DATASERVICE-003-S01, AC-DATASERVICE-004-S01, AC-DATASERVICE-005-S01, AC-DATASERVICE-006-S01, AC-DATASERVICE-008-S01, AC-DATASERVICE-013-S02, AC-DATASERVICE-015-S01, AC-DATASERVICE-016-S01, AC-DATASERVICE-016-S02, AC-DATASERVICE-016-S03, AC-DATASERVICE-020-S01, AC-DATASERVICE-020-S02, AC-DATASERVICE-020-S03, AC-DATASERVICE-020-S04, AC-DATASERVICE-021-S01, AC-DATASERVICE-021-S02, AC-DATASERVICE-023-S01, AC-DATASERVICE-023-S02, AC-DATASERVICE-023-S03, AC-DATASERVICE-024-S01, AC-DATASERVICE-024-S02, AC-DATASERVICE-024-S03 |  |  |  |
| REQ-DATASERVICE-080 | intent-ca5af2b86026d3905f1cb5eca07bc4a1c003b0ea300b2ed075b08031df1276d0 | REQ-DATASERVICE-080 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-b38ce237891afbc40eb2426b659cf3e2ff4bb3e0e4abcdc14403bc2335bfa608 | none | TASK-DATASERVICE-005, TASK-DATASERVICE-006, TASK-DATASERVICE-007, TASK-DATASERVICE-013 | AC-DATASERVICE-001-S01, AC-DATASERVICE-002-S01, AC-DATASERVICE-003-S01, AC-DATASERVICE-004-S01, AC-DATASERVICE-005-S01, AC-DATASERVICE-006-S01, AC-DATASERVICE-008-S01, AC-DATASERVICE-013-S02, AC-DATASERVICE-015-S01, AC-DATASERVICE-016-S01, AC-DATASERVICE-016-S02, AC-DATASERVICE-016-S03, AC-DATASERVICE-020-S01, AC-DATASERVICE-020-S02, AC-DATASERVICE-020-S03, AC-DATASERVICE-020-S04, AC-DATASERVICE-021-S01, AC-DATASERVICE-021-S02, AC-DATASERVICE-023-S01, AC-DATASERVICE-023-S02, AC-DATASERVICE-023-S03, AC-DATASERVICE-024-S01, AC-DATASERVICE-024-S02, AC-DATASERVICE-024-S03 |  |  |  |
| REQ-DATASERVICE-081 | intent-c3ef83fa9ef662258b9bf23e76361b58e8b783d29a72933638bfee4afc3a1db8 | REQ-DATASERVICE-081 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-8ab0bbe04bf07c10f56c5815f2a191cab8ff5c239bcf6508cbd0f250dd090f0f | none | TASK-DATASERVICE-005, TASK-DATASERVICE-006, TASK-DATASERVICE-007, TASK-DATASERVICE-013 | AC-DATASERVICE-001-S01, AC-DATASERVICE-002-S01, AC-DATASERVICE-003-S01, AC-DATASERVICE-004-S01, AC-DATASERVICE-005-S01, AC-DATASERVICE-006-S01, AC-DATASERVICE-008-S01, AC-DATASERVICE-013-S02, AC-DATASERVICE-015-S01, AC-DATASERVICE-016-S01, AC-DATASERVICE-016-S02, AC-DATASERVICE-016-S03, AC-DATASERVICE-020-S01, AC-DATASERVICE-020-S02, AC-DATASERVICE-020-S03, AC-DATASERVICE-020-S04, AC-DATASERVICE-021-S01, AC-DATASERVICE-021-S02, AC-DATASERVICE-023-S01, AC-DATASERVICE-023-S02, AC-DATASERVICE-023-S03, AC-DATASERVICE-024-S01, AC-DATASERVICE-024-S02, AC-DATASERVICE-024-S03 |  |  |  |
| REQ-DATASERVICE-082 | intent-e24c8fd9b59ca163f47ceab6f2f65848e7ac483341a32c0e980a9fc873c1784a | REQ-DATASERVICE-082 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-f37e7cc22a33730b04077e48e12cdf61163b258bef8b7f3a7916b33f71aa506d | none | TASK-DATASERVICE-003 | AC-DATASERVICE-009-S01, AC-DATASERVICE-019-S01, AC-DATASERVICE-020-S04, AC-DATASERVICE-021-S01, AC-DATASERVICE-021-S02, AC-DATASERVICE-021-S03, AC-DATASERVICE-022-S01, AC-DATASERVICE-022-S02 |  |  |  |
| NEG-DATASERVICE-005 | intent-02785d46c91ec5184524fae7486fdab86a92e2e0421b75e202d45f313271148d | NEG-DATASERVICE-005 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-bc2cd7fec40b83c9901907e1b1cf06e1a4aa2a2ced3acd28fafaa9bd96d85977 | none | TASK-DATASERVICE-003 | AC-DATASERVICE-009-S01, AC-DATASERVICE-019-S01, AC-DATASERVICE-020-S04, AC-DATASERVICE-021-S01, AC-DATASERVICE-021-S02, AC-DATASERVICE-021-S03, AC-DATASERVICE-022-S01, AC-DATASERVICE-022-S02 |  |  |  |
| REQ-DATASERVICE-083 | intent-cb09b4d143f8da5ea74ea7c745cef925b5ba5cf05e91c5f4f347fbcc64729d29 | REQ-DATASERVICE-083 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-f3f9fd7447afa16100562f7549a07568c077d997f1653baa8a2ec37dcd9e453c | none | TASK-DATASERVICE-003 | AC-DATASERVICE-009-S01, AC-DATASERVICE-019-S01, AC-DATASERVICE-020-S04, AC-DATASERVICE-021-S01, AC-DATASERVICE-021-S02, AC-DATASERVICE-021-S03, AC-DATASERVICE-022-S01, AC-DATASERVICE-022-S02 |  |  |  |
| REQ-DATASERVICE-084 | intent-0fadae3d0af16c07398ae13f66a8632c0b4968b53053c20e1e9e4dd9751168a3 | REQ-DATASERVICE-084 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-4a7193c12de60d747e1354291c48c5a33e6ee8ff4c1550a05246ee65e2d3d4bf | none | TASK-DATASERVICE-003 | AC-DATASERVICE-009-S01, AC-DATASERVICE-019-S01, AC-DATASERVICE-020-S04, AC-DATASERVICE-021-S01, AC-DATASERVICE-021-S02, AC-DATASERVICE-021-S03, AC-DATASERVICE-022-S01, AC-DATASERVICE-022-S02 |  |  |  |
| NEG-DATASERVICE-006 | intent-fcb59cf8722ac7acd25dfc32cd3db399b2808590b8b3e74faf14160e37e14ed8 | NEG-DATASERVICE-006 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-2eff952cd5884f51147836726c0a587d1ebcdec0634be48312e73a1d716020a9 | none | TASK-DATASERVICE-003 | AC-DATASERVICE-009-S01, AC-DATASERVICE-019-S01, AC-DATASERVICE-020-S04, AC-DATASERVICE-021-S01, AC-DATASERVICE-021-S02, AC-DATASERVICE-021-S03, AC-DATASERVICE-022-S01, AC-DATASERVICE-022-S02 |  |  |  |
| REQ-DATASERVICE-085 | intent-4c7e8360467e56be88de5c75da10d85820d1460c744462e9002172fbad10568c | REQ-DATASERVICE-085 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-9e9809184e852abc46eae84d62bdcba538ee19b230a53be61fa389b5d4b9524c | none | TASK-DATASERVICE-003 | AC-DATASERVICE-009-S01, AC-DATASERVICE-019-S01, AC-DATASERVICE-020-S04, AC-DATASERVICE-021-S01, AC-DATASERVICE-021-S02, AC-DATASERVICE-021-S03, AC-DATASERVICE-022-S01, AC-DATASERVICE-022-S02 |  |  |  |
| REQ-DATASERVICE-086 | intent-42c525ba2fc6a12cb75eda459da19fbe478331a34a66da609504408a58c820d4 | REQ-DATASERVICE-086 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-2681465f3cf51f9eb1b20aecbcb2722b4d83b1f71e1648b04c1a57cf73b9c5d4 | none | TASK-DATASERVICE-003 | AC-DATASERVICE-009-S01, AC-DATASERVICE-019-S01, AC-DATASERVICE-020-S04, AC-DATASERVICE-021-S01, AC-DATASERVICE-021-S02, AC-DATASERVICE-021-S03, AC-DATASERVICE-022-S01, AC-DATASERVICE-022-S02 |  |  |  |
| REQ-DATASERVICE-087 | intent-06b7f578368c02f84a873eb53aba108322c8642aaacec538aed8d46bfe60f71a | REQ-DATASERVICE-087 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-9a9e4fffab3e623fc0a3dbec48be5e1fa23520c1ec2f01fb10b17c3f3478daa1 | none | TASK-DATASERVICE-003 | AC-DATASERVICE-009-S01, AC-DATASERVICE-019-S01, AC-DATASERVICE-020-S04, AC-DATASERVICE-021-S01, AC-DATASERVICE-021-S02, AC-DATASERVICE-021-S03, AC-DATASERVICE-022-S01, AC-DATASERVICE-022-S02 |  |  |  |
| REQ-DATASERVICE-088 | intent-0860cc958bbf857204bcfae64c6c64e30a5a3370104eb04ba82242bb1d730733 | REQ-DATASERVICE-088 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-a27100307e2e93ff40ea37336f138d9ff62c573324eeeb579b334045dc61f104 | none | TASK-DATASERVICE-011, TASK-DATASERVICE-012, TASK-DATASERVICE-013 | AC-DATASERVICE-002-S01, AC-DATASERVICE-009-S02, AC-DATASERVICE-010-S01, AC-DATASERVICE-014-S01, AC-DATASERVICE-015-S01, AC-DATASERVICE-016-S01, AC-DATASERVICE-016-S02, AC-DATASERVICE-016-S03, AC-DATASERVICE-016-S04, AC-DATASERVICE-017-S01, AC-DATASERVICE-018-S01, AC-DATASERVICE-019-S01, AC-DATASERVICE-020-S01, AC-DATASERVICE-020-S02, AC-DATASERVICE-020-S03, AC-DATASERVICE-020-S04, AC-DATASERVICE-021-S01, AC-DATASERVICE-021-S03, AC-DATASERVICE-022-S01, AC-DATASERVICE-024-S02, AC-DATASERVICE-024-S03 |  |  |  |
| REQ-DATASERVICE-089 | intent-7791c9b4d44da410c6c5dcbf44ea5fcd80da43d8d88ae3adcf302d99a0e1671f | REQ-DATASERVICE-089 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-abf6b821aac9ab8c88d5ce56b0968b4d32bd68fd0e70af2c5f26049fdbbc253b | none | TASK-DATASERVICE-011, TASK-DATASERVICE-012, TASK-DATASERVICE-013 | AC-DATASERVICE-002-S01, AC-DATASERVICE-009-S02, AC-DATASERVICE-010-S01, AC-DATASERVICE-014-S01, AC-DATASERVICE-015-S01, AC-DATASERVICE-016-S01, AC-DATASERVICE-016-S02, AC-DATASERVICE-016-S03, AC-DATASERVICE-016-S04, AC-DATASERVICE-017-S01, AC-DATASERVICE-018-S01, AC-DATASERVICE-019-S01, AC-DATASERVICE-020-S01, AC-DATASERVICE-020-S02, AC-DATASERVICE-020-S03, AC-DATASERVICE-020-S04, AC-DATASERVICE-021-S01, AC-DATASERVICE-021-S03, AC-DATASERVICE-022-S01, AC-DATASERVICE-024-S02, AC-DATASERVICE-024-S03 |  |  |  |
| REQ-DATASERVICE-090 | intent-5e9b5c41b5e390d56bba7ff50215e60c68f4580c1f275caf31fb62e8f78f9716 | REQ-DATASERVICE-090 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-cebe133bec8e2e7dfba4e997a74c707b5546ce53eb1e66eef6236027ec0b1b2a | none | TASK-DATASERVICE-011, TASK-DATASERVICE-012, TASK-DATASERVICE-013 | AC-DATASERVICE-002-S01, AC-DATASERVICE-009-S02, AC-DATASERVICE-010-S01, AC-DATASERVICE-014-S01, AC-DATASERVICE-015-S01, AC-DATASERVICE-016-S01, AC-DATASERVICE-016-S02, AC-DATASERVICE-016-S03, AC-DATASERVICE-016-S04, AC-DATASERVICE-017-S01, AC-DATASERVICE-018-S01, AC-DATASERVICE-019-S01, AC-DATASERVICE-020-S01, AC-DATASERVICE-020-S02, AC-DATASERVICE-020-S03, AC-DATASERVICE-020-S04, AC-DATASERVICE-021-S01, AC-DATASERVICE-021-S03, AC-DATASERVICE-022-S01, AC-DATASERVICE-024-S02, AC-DATASERVICE-024-S03 |  |  |  |
| REQ-DATASERVICE-091 | intent-5c88ce23312aec79cde56b95d68275b1d69b7179a15771945d244522c341745e | REQ-DATASERVICE-091 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-9117c6a3226eaf2adebe5f6bbadf9fcca855d0567033fadf080c7858f02a0b15 | none | TASK-DATASERVICE-011, TASK-DATASERVICE-012, TASK-DATASERVICE-013 | AC-DATASERVICE-002-S01, AC-DATASERVICE-009-S02, AC-DATASERVICE-010-S01, AC-DATASERVICE-014-S01, AC-DATASERVICE-015-S01, AC-DATASERVICE-016-S01, AC-DATASERVICE-016-S02, AC-DATASERVICE-016-S03, AC-DATASERVICE-016-S04, AC-DATASERVICE-017-S01, AC-DATASERVICE-018-S01, AC-DATASERVICE-019-S01, AC-DATASERVICE-020-S01, AC-DATASERVICE-020-S02, AC-DATASERVICE-020-S03, AC-DATASERVICE-020-S04, AC-DATASERVICE-021-S01, AC-DATASERVICE-021-S03, AC-DATASERVICE-022-S01, AC-DATASERVICE-024-S02, AC-DATASERVICE-024-S03 |  |  |  |
| REQ-DATASERVICE-092 | intent-139ae2eb8d8051991e7c380d5668e5e4413c61f95b674951a662524265deb460 | REQ-DATASERVICE-092 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-b7694a3a0c45106933c932bfc24a5533eff317dce71d6307fdadf59e9d7c9125 | none | TASK-DATASERVICE-011, TASK-DATASERVICE-012, TASK-DATASERVICE-013 | AC-DATASERVICE-002-S01, AC-DATASERVICE-009-S02, AC-DATASERVICE-010-S01, AC-DATASERVICE-014-S01, AC-DATASERVICE-015-S01, AC-DATASERVICE-016-S01, AC-DATASERVICE-016-S02, AC-DATASERVICE-016-S03, AC-DATASERVICE-016-S04, AC-DATASERVICE-017-S01, AC-DATASERVICE-018-S01, AC-DATASERVICE-019-S01, AC-DATASERVICE-020-S01, AC-DATASERVICE-020-S02, AC-DATASERVICE-020-S03, AC-DATASERVICE-020-S04, AC-DATASERVICE-021-S01, AC-DATASERVICE-021-S03, AC-DATASERVICE-022-S01, AC-DATASERVICE-024-S02, AC-DATASERVICE-024-S03 |  |  |  |
| REQ-DATASERVICE-093 | intent-6512a967e1f4ef7e2c290e8e329b6013b98e0eb75f01590bd873ee2c3f09d2c9 | REQ-DATASERVICE-093 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-4ff6108bf734348d17ccd2238174c5a3fd01bc9052cb337bc5e268f8c436d330 | none | TASK-DATASERVICE-011, TASK-DATASERVICE-012, TASK-DATASERVICE-013 | AC-DATASERVICE-002-S01, AC-DATASERVICE-009-S02, AC-DATASERVICE-010-S01, AC-DATASERVICE-014-S01, AC-DATASERVICE-015-S01, AC-DATASERVICE-016-S01, AC-DATASERVICE-016-S02, AC-DATASERVICE-016-S03, AC-DATASERVICE-016-S04, AC-DATASERVICE-017-S01, AC-DATASERVICE-018-S01, AC-DATASERVICE-019-S01, AC-DATASERVICE-020-S01, AC-DATASERVICE-020-S02, AC-DATASERVICE-020-S03, AC-DATASERVICE-020-S04, AC-DATASERVICE-021-S01, AC-DATASERVICE-021-S03, AC-DATASERVICE-022-S01, AC-DATASERVICE-024-S02, AC-DATASERVICE-024-S03 |  |  |  |
| REQ-DATASERVICE-094 | intent-e043e6ebabd6bbe07de6f562dc239172c0f9018fcdbe3d5d158f009a1d7d5dbc | REQ-DATASERVICE-094 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-1f7646da3c234f5cde2a17339124e5c4b0dd3dbfcbc23a79fd65aeb32a49c0a1 | none | TASK-DATASERVICE-011, TASK-DATASERVICE-012, TASK-DATASERVICE-013 | AC-DATASERVICE-002-S01, AC-DATASERVICE-009-S02, AC-DATASERVICE-010-S01, AC-DATASERVICE-014-S01, AC-DATASERVICE-015-S01, AC-DATASERVICE-016-S01, AC-DATASERVICE-016-S02, AC-DATASERVICE-016-S03, AC-DATASERVICE-016-S04, AC-DATASERVICE-017-S01, AC-DATASERVICE-018-S01, AC-DATASERVICE-019-S01, AC-DATASERVICE-020-S01, AC-DATASERVICE-020-S02, AC-DATASERVICE-020-S03, AC-DATASERVICE-020-S04, AC-DATASERVICE-021-S01, AC-DATASERVICE-021-S03, AC-DATASERVICE-022-S01, AC-DATASERVICE-024-S02, AC-DATASERVICE-024-S03 |  |  |  |
| REQ-DATASERVICE-095 | intent-99866bd5b464b575cba7f3c9d70ce82c5db71b95dda3317c7b073bbd16e17af2 | REQ-DATASERVICE-095 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-b1edd2839e802e3f0723cac90e5ac2a0deb544fd1a95554cefe92a463e2d1585 | none | TASK-DATASERVICE-011, TASK-DATASERVICE-012, TASK-DATASERVICE-013 | AC-DATASERVICE-002-S01, AC-DATASERVICE-009-S02, AC-DATASERVICE-010-S01, AC-DATASERVICE-014-S01, AC-DATASERVICE-015-S01, AC-DATASERVICE-016-S01, AC-DATASERVICE-016-S02, AC-DATASERVICE-016-S03, AC-DATASERVICE-016-S04, AC-DATASERVICE-017-S01, AC-DATASERVICE-018-S01, AC-DATASERVICE-019-S01, AC-DATASERVICE-020-S01, AC-DATASERVICE-020-S02, AC-DATASERVICE-020-S03, AC-DATASERVICE-020-S04, AC-DATASERVICE-021-S01, AC-DATASERVICE-021-S03, AC-DATASERVICE-022-S01, AC-DATASERVICE-024-S02, AC-DATASERVICE-024-S03 |  |  |  |
| REQ-DATASERVICE-096 | intent-9bba16e3135c92202c74d60ce312da825cbe1955d8efbe0861cef2d436387345 | REQ-DATASERVICE-096 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-6a05acbe8acf8744723bd05bdef3d8dca1e6c8000126262c6a3abf021ad4683e | none | TASK-DATASERVICE-011, TASK-DATASERVICE-012, TASK-DATASERVICE-013 | AC-DATASERVICE-002-S01, AC-DATASERVICE-009-S02, AC-DATASERVICE-010-S01, AC-DATASERVICE-014-S01, AC-DATASERVICE-015-S01, AC-DATASERVICE-016-S01, AC-DATASERVICE-016-S02, AC-DATASERVICE-016-S03, AC-DATASERVICE-016-S04, AC-DATASERVICE-017-S01, AC-DATASERVICE-018-S01, AC-DATASERVICE-019-S01, AC-DATASERVICE-020-S01, AC-DATASERVICE-020-S02, AC-DATASERVICE-020-S03, AC-DATASERVICE-020-S04, AC-DATASERVICE-021-S01, AC-DATASERVICE-021-S03, AC-DATASERVICE-022-S01, AC-DATASERVICE-024-S02, AC-DATASERVICE-024-S03 |  |  |  |
| REQ-DATASERVICE-097 | intent-dd213acdcad766ec0056b94a4027c6649d41f3b677ba9220adceac0f5dad5b08 | REQ-DATASERVICE-097 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-1415082588e7960a0b2fc0a0e6774bf5023f9ffe6434aae021163676014d69b7 | none | TASK-DATASERVICE-011, TASK-DATASERVICE-012, TASK-DATASERVICE-013 | AC-DATASERVICE-002-S01, AC-DATASERVICE-009-S02, AC-DATASERVICE-010-S01, AC-DATASERVICE-014-S01, AC-DATASERVICE-015-S01, AC-DATASERVICE-016-S01, AC-DATASERVICE-016-S02, AC-DATASERVICE-016-S03, AC-DATASERVICE-016-S04, AC-DATASERVICE-017-S01, AC-DATASERVICE-018-S01, AC-DATASERVICE-019-S01, AC-DATASERVICE-020-S01, AC-DATASERVICE-020-S02, AC-DATASERVICE-020-S03, AC-DATASERVICE-020-S04, AC-DATASERVICE-021-S01, AC-DATASERVICE-021-S03, AC-DATASERVICE-022-S01, AC-DATASERVICE-024-S02, AC-DATASERVICE-024-S03 |  |  |  |
| NEG-DATASERVICE-007 | intent-e75f420d03cb91e0d342de8cfdbc204ab41f09863605385eabbb9c2d383e04b1 | NEG-DATASERVICE-007 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-0c80e42e9da1565e48ef74a59aa3ea471aafcf22be1a0ac2c748b5b984957d1d | none | TASK-DATASERVICE-011, TASK-DATASERVICE-012, TASK-DATASERVICE-013 | AC-DATASERVICE-002-S01, AC-DATASERVICE-009-S02, AC-DATASERVICE-010-S01, AC-DATASERVICE-014-S01, AC-DATASERVICE-015-S01, AC-DATASERVICE-016-S01, AC-DATASERVICE-016-S02, AC-DATASERVICE-016-S03, AC-DATASERVICE-016-S04, AC-DATASERVICE-017-S01, AC-DATASERVICE-018-S01, AC-DATASERVICE-019-S01, AC-DATASERVICE-020-S01, AC-DATASERVICE-020-S02, AC-DATASERVICE-020-S03, AC-DATASERVICE-020-S04, AC-DATASERVICE-021-S01, AC-DATASERVICE-021-S03, AC-DATASERVICE-022-S01, AC-DATASERVICE-024-S02, AC-DATASERVICE-024-S03 |  |  |  |
| REQ-DATASERVICE-098 | intent-09fcc48b1ef400881381334f826a4345e5ab9c66b9d2fb79904f1460753c7966 | REQ-DATASERVICE-098 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-bb7d60f6c1abce60c1970f981f8c5cb5123e6f0d69fc20df49316814e853b791 | none | TASK-DATASERVICE-011, TASK-DATASERVICE-012, TASK-DATASERVICE-013 | AC-DATASERVICE-002-S01, AC-DATASERVICE-009-S02, AC-DATASERVICE-010-S01, AC-DATASERVICE-014-S01, AC-DATASERVICE-015-S01, AC-DATASERVICE-016-S01, AC-DATASERVICE-016-S02, AC-DATASERVICE-016-S03, AC-DATASERVICE-016-S04, AC-DATASERVICE-017-S01, AC-DATASERVICE-018-S01, AC-DATASERVICE-019-S01, AC-DATASERVICE-020-S01, AC-DATASERVICE-020-S02, AC-DATASERVICE-020-S03, AC-DATASERVICE-020-S04, AC-DATASERVICE-021-S01, AC-DATASERVICE-021-S03, AC-DATASERVICE-022-S01, AC-DATASERVICE-024-S02, AC-DATASERVICE-024-S03 |  |  |  |
| REQ-DATASERVICE-099 | intent-e20a95b54f90e29e917ae2237f90c2c0b526ee965db6efc967d1f6cd2a8cfb99 | REQ-DATASERVICE-099 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-5df2fc149e609712bf060abdee64fc31f742c1d60d3c9095ffebbb8c2bf53b0e | none | TASK-DATASERVICE-011, TASK-DATASERVICE-012, TASK-DATASERVICE-013 | AC-DATASERVICE-002-S01, AC-DATASERVICE-009-S02, AC-DATASERVICE-010-S01, AC-DATASERVICE-014-S01, AC-DATASERVICE-015-S01, AC-DATASERVICE-016-S01, AC-DATASERVICE-016-S02, AC-DATASERVICE-016-S03, AC-DATASERVICE-016-S04, AC-DATASERVICE-017-S01, AC-DATASERVICE-018-S01, AC-DATASERVICE-019-S01, AC-DATASERVICE-020-S01, AC-DATASERVICE-020-S02, AC-DATASERVICE-020-S03, AC-DATASERVICE-020-S04, AC-DATASERVICE-021-S01, AC-DATASERVICE-021-S03, AC-DATASERVICE-022-S01, AC-DATASERVICE-024-S02, AC-DATASERVICE-024-S03 |  |  |  |
| REQ-DATASERVICE-100 | intent-874308c6a2fd90e4f7771151318c776de0492e3cb168e3a2229d6f90cd1021e2 | REQ-DATASERVICE-100 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-66d7d4c2adcf3d8cd173e69437aa101defaf26be2303932446320df664709d85 | none | TASK-DATASERVICE-005, TASK-DATASERVICE-006, TASK-DATASERVICE-007 | AC-DATASERVICE-001-S01, AC-DATASERVICE-002-S01, AC-DATASERVICE-003-S01, AC-DATASERVICE-004-S01, AC-DATASERVICE-005-S01, AC-DATASERVICE-006-S01, AC-DATASERVICE-008-S01, AC-DATASERVICE-013-S02, AC-DATASERVICE-015-S01, AC-DATASERVICE-016-S01, AC-DATASERVICE-016-S02, AC-DATASERVICE-016-S03, AC-DATASERVICE-021-S01, AC-DATASERVICE-021-S02, AC-DATASERVICE-023-S01, AC-DATASERVICE-023-S02, AC-DATASERVICE-023-S03, AC-DATASERVICE-024-S01, AC-DATASERVICE-024-S02, AC-DATASERVICE-024-S03 |  |  |  |
| REQ-DATASERVICE-101 | intent-cd2a8f72c8a8f8c32614591252ecf07cd23571567c582a44226663e4ba022b5f | REQ-DATASERVICE-101 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-6e2fb94eed1b5ad92c1a2c7cb2d74a455bd53e9264c136e89956b15ea90cf852 | none | TASK-DATASERVICE-005, TASK-DATASERVICE-006, TASK-DATASERVICE-007 | AC-DATASERVICE-001-S01, AC-DATASERVICE-002-S01, AC-DATASERVICE-003-S01, AC-DATASERVICE-004-S01, AC-DATASERVICE-005-S01, AC-DATASERVICE-006-S01, AC-DATASERVICE-008-S01, AC-DATASERVICE-013-S02, AC-DATASERVICE-015-S01, AC-DATASERVICE-016-S01, AC-DATASERVICE-016-S02, AC-DATASERVICE-016-S03, AC-DATASERVICE-021-S01, AC-DATASERVICE-021-S02, AC-DATASERVICE-023-S01, AC-DATASERVICE-023-S02, AC-DATASERVICE-023-S03, AC-DATASERVICE-024-S01, AC-DATASERVICE-024-S02, AC-DATASERVICE-024-S03 |  |  |  |
| REQ-DATASERVICE-102 | intent-1ee1a8da93b0c19fea8f888e14196f84d70a1056e6403862465c567342cdfcf0 | REQ-DATASERVICE-102 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-0c87d10c7031186988f741d6dfd931bb34a6088c0b33b7b8924cfaea1cd6e6ca | none | TASK-DATASERVICE-005, TASK-DATASERVICE-006, TASK-DATASERVICE-007 | AC-DATASERVICE-001-S01, AC-DATASERVICE-002-S01, AC-DATASERVICE-003-S01, AC-DATASERVICE-004-S01, AC-DATASERVICE-005-S01, AC-DATASERVICE-006-S01, AC-DATASERVICE-008-S01, AC-DATASERVICE-013-S02, AC-DATASERVICE-015-S01, AC-DATASERVICE-016-S01, AC-DATASERVICE-016-S02, AC-DATASERVICE-016-S03, AC-DATASERVICE-021-S01, AC-DATASERVICE-021-S02, AC-DATASERVICE-023-S01, AC-DATASERVICE-023-S02, AC-DATASERVICE-023-S03, AC-DATASERVICE-024-S01, AC-DATASERVICE-024-S02, AC-DATASERVICE-024-S03 |  |  |  |
| REQ-DATASERVICE-103 | intent-9f8947bfdd0b08781d52ddafb961f0328f69ce900ad59f112d85b87e1e0e381e | REQ-DATASERVICE-103 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-14cc8700da6aa187f1435633ca59d90783bd52b47479e5c46c5bbb1301f43c72 | none | TASK-DATASERVICE-005, TASK-DATASERVICE-006, TASK-DATASERVICE-007 | AC-DATASERVICE-001-S01, AC-DATASERVICE-002-S01, AC-DATASERVICE-003-S01, AC-DATASERVICE-004-S01, AC-DATASERVICE-005-S01, AC-DATASERVICE-006-S01, AC-DATASERVICE-008-S01, AC-DATASERVICE-013-S02, AC-DATASERVICE-015-S01, AC-DATASERVICE-016-S01, AC-DATASERVICE-016-S02, AC-DATASERVICE-016-S03, AC-DATASERVICE-021-S01, AC-DATASERVICE-021-S02, AC-DATASERVICE-023-S01, AC-DATASERVICE-023-S02, AC-DATASERVICE-023-S03, AC-DATASERVICE-024-S01, AC-DATASERVICE-024-S02, AC-DATASERVICE-024-S03 |  |  |  |
| NEG-DATASERVICE-008 | intent-e07b18d107cf8e695700ce562569ef17dee2c424647897112fa3dc97a11e0abe | NEG-DATASERVICE-008 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-b5b4d9f685175765c196f4a8a9ce27c209131f0f09e6eec3704d40bef6d5fb03 | none | TASK-DATASERVICE-005, TASK-DATASERVICE-006, TASK-DATASERVICE-007 | AC-DATASERVICE-001-S01, AC-DATASERVICE-002-S01, AC-DATASERVICE-003-S01, AC-DATASERVICE-004-S01, AC-DATASERVICE-005-S01, AC-DATASERVICE-006-S01, AC-DATASERVICE-008-S01, AC-DATASERVICE-013-S02, AC-DATASERVICE-015-S01, AC-DATASERVICE-016-S01, AC-DATASERVICE-016-S02, AC-DATASERVICE-016-S03, AC-DATASERVICE-021-S01, AC-DATASERVICE-021-S02, AC-DATASERVICE-023-S01, AC-DATASERVICE-023-S02, AC-DATASERVICE-023-S03, AC-DATASERVICE-024-S01, AC-DATASERVICE-024-S02, AC-DATASERVICE-024-S03 |  |  |  |
| REQ-DATASERVICE-104 | intent-8ce5fc3d80d8c1b7778c619a7fa73bf0dd2e988adfc5034955ceab3c10af591f | REQ-DATASERVICE-104 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-d189f1132f2a5259609750d71a6816a5ff5b2741dad69cd6184ac75d02f4d0bc | none | TASK-DATASERVICE-005, TASK-DATASERVICE-006, TASK-DATASERVICE-007 | AC-DATASERVICE-001-S01, AC-DATASERVICE-002-S01, AC-DATASERVICE-003-S01, AC-DATASERVICE-004-S01, AC-DATASERVICE-005-S01, AC-DATASERVICE-006-S01, AC-DATASERVICE-008-S01, AC-DATASERVICE-013-S02, AC-DATASERVICE-015-S01, AC-DATASERVICE-016-S01, AC-DATASERVICE-016-S02, AC-DATASERVICE-016-S03, AC-DATASERVICE-021-S01, AC-DATASERVICE-021-S02, AC-DATASERVICE-023-S01, AC-DATASERVICE-023-S02, AC-DATASERVICE-023-S03, AC-DATASERVICE-024-S01, AC-DATASERVICE-024-S02, AC-DATASERVICE-024-S03 |  |  |  |
| REQ-DATASERVICE-105 | intent-708c8184f27be8f19e1d31685fc46bc8b32765426ee188985b81746f4513730e | REQ-DATASERVICE-105 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-75458a150c6517106d32a8134dc106c2c64962a64e8e8e884d3df99333a046c5 | none | TASK-DATASERVICE-005, TASK-DATASERVICE-006, TASK-DATASERVICE-007 | AC-DATASERVICE-001-S01, AC-DATASERVICE-002-S01, AC-DATASERVICE-003-S01, AC-DATASERVICE-004-S01, AC-DATASERVICE-005-S01, AC-DATASERVICE-006-S01, AC-DATASERVICE-008-S01, AC-DATASERVICE-013-S02, AC-DATASERVICE-015-S01, AC-DATASERVICE-016-S01, AC-DATASERVICE-016-S02, AC-DATASERVICE-016-S03, AC-DATASERVICE-021-S01, AC-DATASERVICE-021-S02, AC-DATASERVICE-023-S01, AC-DATASERVICE-023-S02, AC-DATASERVICE-023-S03, AC-DATASERVICE-024-S01, AC-DATASERVICE-024-S02, AC-DATASERVICE-024-S03 |  |  |  |
| REQ-DATASERVICE-106 | intent-8bb282988e1521136db4e20befed9f9f7d931e0c1d5d5004ed9b057db76bf3d0 | REQ-DATASERVICE-106 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-a8a8dd6381182648ccf14a613e4d1523f43c58c01ac1b9f91f7d8cc823bd7855 | none | TASK-DATASERVICE-004, TASK-DATASERVICE-007, TASK-DATASERVICE-008, TASK-DATASERVICE-009 | AC-DATASERVICE-001-S01, AC-DATASERVICE-002-S01, AC-DATASERVICE-003-S01, AC-DATASERVICE-004-S01, AC-DATASERVICE-005-S01, AC-DATASERVICE-006-S01, AC-DATASERVICE-007-S01, AC-DATASERVICE-008-S01, AC-DATASERVICE-009-S01, AC-DATASERVICE-009-S02, AC-DATASERVICE-010-S01, AC-DATASERVICE-011-S01, AC-DATASERVICE-012-S01, AC-DATASERVICE-013-S01, AC-DATASERVICE-013-S02, AC-DATASERVICE-022-S01, AC-DATASERVICE-022-S02, AC-DATASERVICE-023-S01, AC-DATASERVICE-023-S02, AC-DATASERVICE-024-S01, AC-DATASERVICE-024-S02 |  |  |  |
| REQ-DATASERVICE-107 | intent-9d408236a2b44df58013ff2191e56eda5cd948949bf64904be3a856d819ddd19 | REQ-DATASERVICE-107 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-6762656279bf6c59f561e70ffa1c4dd74e83d8fae7e7c527fff05704b6fb5194 | none | TASK-DATASERVICE-004, TASK-DATASERVICE-007, TASK-DATASERVICE-008, TASK-DATASERVICE-009 | AC-DATASERVICE-001-S01, AC-DATASERVICE-002-S01, AC-DATASERVICE-003-S01, AC-DATASERVICE-004-S01, AC-DATASERVICE-005-S01, AC-DATASERVICE-006-S01, AC-DATASERVICE-007-S01, AC-DATASERVICE-008-S01, AC-DATASERVICE-009-S01, AC-DATASERVICE-009-S02, AC-DATASERVICE-010-S01, AC-DATASERVICE-011-S01, AC-DATASERVICE-012-S01, AC-DATASERVICE-013-S01, AC-DATASERVICE-013-S02, AC-DATASERVICE-022-S01, AC-DATASERVICE-022-S02, AC-DATASERVICE-023-S01, AC-DATASERVICE-023-S02, AC-DATASERVICE-024-S01, AC-DATASERVICE-024-S02 |  |  |  |
| REQ-DATASERVICE-108 | intent-88847480d1db9183bdba4de567df58492810816acbf014fa4595444d549d7090 | REQ-DATASERVICE-108 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-c034816fc89ba1a07c38a664ef53c2b853db92af73ba4cfb251253e24cd103c4 | none | TASK-DATASERVICE-004, TASK-DATASERVICE-007, TASK-DATASERVICE-008, TASK-DATASERVICE-009 | AC-DATASERVICE-001-S01, AC-DATASERVICE-002-S01, AC-DATASERVICE-003-S01, AC-DATASERVICE-004-S01, AC-DATASERVICE-005-S01, AC-DATASERVICE-006-S01, AC-DATASERVICE-007-S01, AC-DATASERVICE-008-S01, AC-DATASERVICE-009-S01, AC-DATASERVICE-009-S02, AC-DATASERVICE-010-S01, AC-DATASERVICE-011-S01, AC-DATASERVICE-012-S01, AC-DATASERVICE-013-S01, AC-DATASERVICE-013-S02, AC-DATASERVICE-022-S01, AC-DATASERVICE-022-S02, AC-DATASERVICE-023-S01, AC-DATASERVICE-023-S02, AC-DATASERVICE-024-S01, AC-DATASERVICE-024-S02 |  |  |  |
| REQ-DATASERVICE-109 | intent-0fbba87bd7d72c929dd1c35b0cb22bdb54629d797d9061e4c160cafdc5b63c9a | REQ-DATASERVICE-109 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-7e4f6197519f300a599e8a3cef78740083be043d0471fc4d3fd853ec71ea6de4 | none | TASK-DATASERVICE-004, TASK-DATASERVICE-007, TASK-DATASERVICE-008, TASK-DATASERVICE-009 | AC-DATASERVICE-001-S01, AC-DATASERVICE-002-S01, AC-DATASERVICE-003-S01, AC-DATASERVICE-004-S01, AC-DATASERVICE-005-S01, AC-DATASERVICE-006-S01, AC-DATASERVICE-007-S01, AC-DATASERVICE-008-S01, AC-DATASERVICE-009-S01, AC-DATASERVICE-009-S02, AC-DATASERVICE-010-S01, AC-DATASERVICE-011-S01, AC-DATASERVICE-012-S01, AC-DATASERVICE-013-S01, AC-DATASERVICE-013-S02, AC-DATASERVICE-022-S01, AC-DATASERVICE-022-S02, AC-DATASERVICE-023-S01, AC-DATASERVICE-023-S02, AC-DATASERVICE-024-S01, AC-DATASERVICE-024-S02 |  |  |  |
| REQ-DATASERVICE-110 | intent-df68dd328f749a927b71a6de0e1bed20848409b12a80a0af78995c4998ce4a7a | REQ-DATASERVICE-110 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-fee6f74f3fb79ee0f5ebe46037b7d9e782cf725b040b0b33c276e2def2dfc321 | none | TASK-DATASERVICE-004, TASK-DATASERVICE-007, TASK-DATASERVICE-008, TASK-DATASERVICE-009 | AC-DATASERVICE-001-S01, AC-DATASERVICE-002-S01, AC-DATASERVICE-003-S01, AC-DATASERVICE-004-S01, AC-DATASERVICE-005-S01, AC-DATASERVICE-006-S01, AC-DATASERVICE-007-S01, AC-DATASERVICE-008-S01, AC-DATASERVICE-009-S01, AC-DATASERVICE-009-S02, AC-DATASERVICE-010-S01, AC-DATASERVICE-011-S01, AC-DATASERVICE-012-S01, AC-DATASERVICE-013-S01, AC-DATASERVICE-013-S02, AC-DATASERVICE-022-S01, AC-DATASERVICE-022-S02, AC-DATASERVICE-023-S01, AC-DATASERVICE-023-S02, AC-DATASERVICE-024-S01, AC-DATASERVICE-024-S02 |  |  |  |
| REQ-DATASERVICE-111 | intent-487d1335e1d43c87b82b892e098ec9c2d574fc4baef913ef7f8b8a2d07549d46 | REQ-DATASERVICE-111 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-c1fd2ef03162520f0226c62cc991d1741136beb58a9e10514addf541730211c5 | none | TASK-DATASERVICE-004, TASK-DATASERVICE-007, TASK-DATASERVICE-008, TASK-DATASERVICE-009 | AC-DATASERVICE-001-S01, AC-DATASERVICE-002-S01, AC-DATASERVICE-003-S01, AC-DATASERVICE-004-S01, AC-DATASERVICE-005-S01, AC-DATASERVICE-006-S01, AC-DATASERVICE-007-S01, AC-DATASERVICE-008-S01, AC-DATASERVICE-009-S01, AC-DATASERVICE-009-S02, AC-DATASERVICE-010-S01, AC-DATASERVICE-011-S01, AC-DATASERVICE-012-S01, AC-DATASERVICE-013-S01, AC-DATASERVICE-013-S02, AC-DATASERVICE-022-S01, AC-DATASERVICE-022-S02, AC-DATASERVICE-023-S01, AC-DATASERVICE-023-S02, AC-DATASERVICE-024-S01, AC-DATASERVICE-024-S02 |  |  |  |
| REQ-DATASERVICE-112 | intent-c54f4fde6a127bf8b140119afa8ea8c867b27048eda4d5f1169fbf30c0c04409 | REQ-DATASERVICE-112 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-de55be063c688d98a1c87bfb2c35ddeebbd859dcc606ffc2c8703d4868d139c8 | none | TASK-DATASERVICE-005, TASK-DATASERVICE-006, TASK-DATASERVICE-007 | AC-DATASERVICE-001-S01, AC-DATASERVICE-002-S01, AC-DATASERVICE-003-S01, AC-DATASERVICE-004-S01, AC-DATASERVICE-005-S01, AC-DATASERVICE-006-S01, AC-DATASERVICE-008-S01, AC-DATASERVICE-013-S02, AC-DATASERVICE-015-S01, AC-DATASERVICE-016-S01, AC-DATASERVICE-016-S02, AC-DATASERVICE-016-S03, AC-DATASERVICE-021-S01, AC-DATASERVICE-021-S02, AC-DATASERVICE-023-S01, AC-DATASERVICE-023-S02, AC-DATASERVICE-023-S03, AC-DATASERVICE-024-S01, AC-DATASERVICE-024-S02, AC-DATASERVICE-024-S03 |  |  |  |
| REQ-DATASERVICE-113 | intent-334ac7452eca98fcf2b56bc025df411db52110d12a54e534eba2f6963f47cc35 | REQ-DATASERVICE-113 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-1c0050d05d9ec168541fee6d0fd55057e05e21493a58c907f860b808120a4f18 | none | TASK-DATASERVICE-005, TASK-DATASERVICE-006, TASK-DATASERVICE-007 | AC-DATASERVICE-001-S01, AC-DATASERVICE-002-S01, AC-DATASERVICE-003-S01, AC-DATASERVICE-004-S01, AC-DATASERVICE-005-S01, AC-DATASERVICE-006-S01, AC-DATASERVICE-008-S01, AC-DATASERVICE-013-S02, AC-DATASERVICE-015-S01, AC-DATASERVICE-016-S01, AC-DATASERVICE-016-S02, AC-DATASERVICE-016-S03, AC-DATASERVICE-021-S01, AC-DATASERVICE-021-S02, AC-DATASERVICE-023-S01, AC-DATASERVICE-023-S02, AC-DATASERVICE-023-S03, AC-DATASERVICE-024-S01, AC-DATASERVICE-024-S02, AC-DATASERVICE-024-S03 |  |  |  |
| REQ-DATASERVICE-114 | intent-47a907bb3eefdaedda6b769a8f1cf5b9cfc402ec53d8f5630dd08158fb72f7ee | REQ-DATASERVICE-114 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-ebc332a17073f89cbf06e8cabbffb8fb8b44d2b0c68e800b3dd26abed0ace723 | none | TASK-DATASERVICE-005, TASK-DATASERVICE-006, TASK-DATASERVICE-007 | AC-DATASERVICE-001-S01, AC-DATASERVICE-002-S01, AC-DATASERVICE-003-S01, AC-DATASERVICE-004-S01, AC-DATASERVICE-005-S01, AC-DATASERVICE-006-S01, AC-DATASERVICE-008-S01, AC-DATASERVICE-013-S02, AC-DATASERVICE-015-S01, AC-DATASERVICE-016-S01, AC-DATASERVICE-016-S02, AC-DATASERVICE-016-S03, AC-DATASERVICE-021-S01, AC-DATASERVICE-021-S02, AC-DATASERVICE-023-S01, AC-DATASERVICE-023-S02, AC-DATASERVICE-023-S03, AC-DATASERVICE-024-S01, AC-DATASERVICE-024-S02, AC-DATASERVICE-024-S03 |  |  |  |
| REQ-DATASERVICE-115 | intent-7be59f51e7593c276322a063d62acf91bc6460e280888e8bd369e259dec7a327 | REQ-DATASERVICE-115 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-daed9324d028c0b92b9073687527fd0c9c6585187670f8db7eb8ed65e75169d2 | none | TASK-DATASERVICE-005, TASK-DATASERVICE-006, TASK-DATASERVICE-007 | AC-DATASERVICE-001-S01, AC-DATASERVICE-002-S01, AC-DATASERVICE-003-S01, AC-DATASERVICE-004-S01, AC-DATASERVICE-005-S01, AC-DATASERVICE-006-S01, AC-DATASERVICE-008-S01, AC-DATASERVICE-013-S02, AC-DATASERVICE-015-S01, AC-DATASERVICE-016-S01, AC-DATASERVICE-016-S02, AC-DATASERVICE-016-S03, AC-DATASERVICE-021-S01, AC-DATASERVICE-021-S02, AC-DATASERVICE-023-S01, AC-DATASERVICE-023-S02, AC-DATASERVICE-023-S03, AC-DATASERVICE-024-S01, AC-DATASERVICE-024-S02, AC-DATASERVICE-024-S03 |  |  |  |
| REQ-DATASERVICE-116 | intent-41f0b83ab12f6af2b5793cbea1a73bcf7257b4e2ea9adbef3b369e99a3ab8052 | REQ-DATASERVICE-116 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-c9c794beed4f3c75515cd820f407d6f990239c471ffd7bb56912043fe24f1bad | none | TASK-DATASERVICE-005, TASK-DATASERVICE-006, TASK-DATASERVICE-007 | AC-DATASERVICE-001-S01, AC-DATASERVICE-002-S01, AC-DATASERVICE-003-S01, AC-DATASERVICE-004-S01, AC-DATASERVICE-005-S01, AC-DATASERVICE-006-S01, AC-DATASERVICE-008-S01, AC-DATASERVICE-013-S02, AC-DATASERVICE-015-S01, AC-DATASERVICE-016-S01, AC-DATASERVICE-016-S02, AC-DATASERVICE-016-S03, AC-DATASERVICE-021-S01, AC-DATASERVICE-021-S02, AC-DATASERVICE-023-S01, AC-DATASERVICE-023-S02, AC-DATASERVICE-023-S03, AC-DATASERVICE-024-S01, AC-DATASERVICE-024-S02, AC-DATASERVICE-024-S03 |  |  |  |
| REQ-DATASERVICE-117 | intent-3c9e41890e7adb3cbba6e51c6947d79f322af15208a88d6ee18fae432df71217 | REQ-DATASERVICE-117 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-b505507a67f3b977163d6d1fea66fc8dcd6a274601afad45538e7f2aaac1a9cf | none | TASK-DATASERVICE-003, TASK-DATASERVICE-004, TASK-DATASERVICE-011, TASK-DATASERVICE-012, TASK-DATASERVICE-013 | AC-DATASERVICE-002-S01, AC-DATASERVICE-006-S01, AC-DATASERVICE-007-S01, AC-DATASERVICE-009-S01, AC-DATASERVICE-009-S02, AC-DATASERVICE-010-S01, AC-DATASERVICE-014-S01, AC-DATASERVICE-015-S01, AC-DATASERVICE-016-S01, AC-DATASERVICE-016-S02, AC-DATASERVICE-016-S03, AC-DATASERVICE-016-S04, AC-DATASERVICE-017-S01, AC-DATASERVICE-018-S01, AC-DATASERVICE-019-S01, AC-DATASERVICE-020-S01, AC-DATASERVICE-020-S02, AC-DATASERVICE-020-S03, AC-DATASERVICE-020-S04, AC-DATASERVICE-021-S01, AC-DATASERVICE-021-S02, AC-DATASERVICE-021-S03, AC-DATASERVICE-022-S01, AC-DATASERVICE-022-S02, AC-DATASERVICE-024-S02, AC-DATASERVICE-024-S03 |  |  |  |
| NEG-DATASERVICE-009 | intent-52325f8a30afcb9d30f120f1adb350ac012c21a62c6fd6aa10a91a8fc3246dbb | NEG-DATASERVICE-009 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-448856f9ef1d20f1589073999a7981afaf15ef5d9546c37c4b079f8e2f10c668 | none | TASK-DATASERVICE-003, TASK-DATASERVICE-004, TASK-DATASERVICE-011, TASK-DATASERVICE-012, TASK-DATASERVICE-013 | AC-DATASERVICE-002-S01, AC-DATASERVICE-006-S01, AC-DATASERVICE-007-S01, AC-DATASERVICE-009-S01, AC-DATASERVICE-009-S02, AC-DATASERVICE-010-S01, AC-DATASERVICE-014-S01, AC-DATASERVICE-015-S01, AC-DATASERVICE-016-S01, AC-DATASERVICE-016-S02, AC-DATASERVICE-016-S03, AC-DATASERVICE-016-S04, AC-DATASERVICE-017-S01, AC-DATASERVICE-018-S01, AC-DATASERVICE-019-S01, AC-DATASERVICE-020-S01, AC-DATASERVICE-020-S02, AC-DATASERVICE-020-S03, AC-DATASERVICE-020-S04, AC-DATASERVICE-021-S01, AC-DATASERVICE-021-S02, AC-DATASERVICE-021-S03, AC-DATASERVICE-022-S01, AC-DATASERVICE-022-S02, AC-DATASERVICE-024-S02, AC-DATASERVICE-024-S03 |  |  |  |
| REQ-DATASERVICE-118 | intent-38660381f5ecdfef958c0c2ccf675e8aa85eb697e2f31601f35dfd451fe1246b | REQ-DATASERVICE-118 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-db8e0373a0ed403ad5ec283e409ece1050045a66bee27a5a6811943e6271789d | none | TASK-DATASERVICE-003, TASK-DATASERVICE-004, TASK-DATASERVICE-011, TASK-DATASERVICE-012, TASK-DATASERVICE-013 | AC-DATASERVICE-002-S01, AC-DATASERVICE-006-S01, AC-DATASERVICE-007-S01, AC-DATASERVICE-009-S01, AC-DATASERVICE-009-S02, AC-DATASERVICE-010-S01, AC-DATASERVICE-014-S01, AC-DATASERVICE-015-S01, AC-DATASERVICE-016-S01, AC-DATASERVICE-016-S02, AC-DATASERVICE-016-S03, AC-DATASERVICE-016-S04, AC-DATASERVICE-017-S01, AC-DATASERVICE-018-S01, AC-DATASERVICE-019-S01, AC-DATASERVICE-020-S01, AC-DATASERVICE-020-S02, AC-DATASERVICE-020-S03, AC-DATASERVICE-020-S04, AC-DATASERVICE-021-S01, AC-DATASERVICE-021-S02, AC-DATASERVICE-021-S03, AC-DATASERVICE-022-S01, AC-DATASERVICE-022-S02, AC-DATASERVICE-024-S02, AC-DATASERVICE-024-S03 |  |  |  |
| NEG-DATASERVICE-010 | intent-ff6531918a2a10f965d0a1ffbaf3153535dfa775984ee3e1938560d300a99189 | NEG-DATASERVICE-010 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-ea647ae46f68e29e1535d0ffaaf5bdd2e99dbc79051791b935131e480dd377c1 | none | TASK-DATASERVICE-003, TASK-DATASERVICE-004, TASK-DATASERVICE-011, TASK-DATASERVICE-012, TASK-DATASERVICE-013 | AC-DATASERVICE-002-S01, AC-DATASERVICE-006-S01, AC-DATASERVICE-007-S01, AC-DATASERVICE-009-S01, AC-DATASERVICE-009-S02, AC-DATASERVICE-010-S01, AC-DATASERVICE-014-S01, AC-DATASERVICE-015-S01, AC-DATASERVICE-016-S01, AC-DATASERVICE-016-S02, AC-DATASERVICE-016-S03, AC-DATASERVICE-016-S04, AC-DATASERVICE-017-S01, AC-DATASERVICE-018-S01, AC-DATASERVICE-019-S01, AC-DATASERVICE-020-S01, AC-DATASERVICE-020-S02, AC-DATASERVICE-020-S03, AC-DATASERVICE-020-S04, AC-DATASERVICE-021-S01, AC-DATASERVICE-021-S02, AC-DATASERVICE-021-S03, AC-DATASERVICE-022-S01, AC-DATASERVICE-022-S02, AC-DATASERVICE-024-S02, AC-DATASERVICE-024-S03 |  |  |  |
| REQ-DATASERVICE-119 | intent-75e7f1cd1e2f7bf5aab88cd7b47c65bf69b8a09c1b66d47f7dc9ce3dbe39574d | REQ-DATASERVICE-119 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-fc5c0c9dd697079636a95f0e05deb390a020269d654ac1c03816fc486cb6c3c2 | none | TASK-DATASERVICE-003, TASK-DATASERVICE-004, TASK-DATASERVICE-011, TASK-DATASERVICE-012, TASK-DATASERVICE-013 | AC-DATASERVICE-002-S01, AC-DATASERVICE-006-S01, AC-DATASERVICE-007-S01, AC-DATASERVICE-009-S01, AC-DATASERVICE-009-S02, AC-DATASERVICE-010-S01, AC-DATASERVICE-014-S01, AC-DATASERVICE-015-S01, AC-DATASERVICE-016-S01, AC-DATASERVICE-016-S02, AC-DATASERVICE-016-S03, AC-DATASERVICE-016-S04, AC-DATASERVICE-017-S01, AC-DATASERVICE-018-S01, AC-DATASERVICE-019-S01, AC-DATASERVICE-020-S01, AC-DATASERVICE-020-S02, AC-DATASERVICE-020-S03, AC-DATASERVICE-020-S04, AC-DATASERVICE-021-S01, AC-DATASERVICE-021-S02, AC-DATASERVICE-021-S03, AC-DATASERVICE-022-S01, AC-DATASERVICE-022-S02, AC-DATASERVICE-024-S02, AC-DATASERVICE-024-S03 |  |  |  |
| REQ-DATASERVICE-120 | intent-a538ff690387cfecad66dd1510e7d718e67f8248b41a46f2ba0ac353240b65fe | REQ-DATASERVICE-120 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-0a5c4a115480b877669a8e3ca4715abe368682edba8eb1ec81740ed5c691047b | none | TASK-DATASERVICE-003, TASK-DATASERVICE-004, TASK-DATASERVICE-011, TASK-DATASERVICE-012, TASK-DATASERVICE-013 | AC-DATASERVICE-002-S01, AC-DATASERVICE-006-S01, AC-DATASERVICE-007-S01, AC-DATASERVICE-009-S01, AC-DATASERVICE-009-S02, AC-DATASERVICE-010-S01, AC-DATASERVICE-014-S01, AC-DATASERVICE-015-S01, AC-DATASERVICE-016-S01, AC-DATASERVICE-016-S02, AC-DATASERVICE-016-S03, AC-DATASERVICE-016-S04, AC-DATASERVICE-017-S01, AC-DATASERVICE-018-S01, AC-DATASERVICE-019-S01, AC-DATASERVICE-020-S01, AC-DATASERVICE-020-S02, AC-DATASERVICE-020-S03, AC-DATASERVICE-020-S04, AC-DATASERVICE-021-S01, AC-DATASERVICE-021-S02, AC-DATASERVICE-021-S03, AC-DATASERVICE-022-S01, AC-DATASERVICE-022-S02, AC-DATASERVICE-024-S02, AC-DATASERVICE-024-S03 |  |  |  |
| REQ-DATASERVICE-121 | intent-ca58d62d3d41123f393e7c5485b9de039fc605fb4659b4cb6419eaeed86e0c73 | REQ-DATASERVICE-121 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-e33f889c52574f5b99f9e85d774eb82fb7105298890f1984bf830b75fce0cbe8 | none | TASK-DATASERVICE-003, TASK-DATASERVICE-004, TASK-DATASERVICE-011, TASK-DATASERVICE-012, TASK-DATASERVICE-013 | AC-DATASERVICE-002-S01, AC-DATASERVICE-006-S01, AC-DATASERVICE-007-S01, AC-DATASERVICE-009-S01, AC-DATASERVICE-009-S02, AC-DATASERVICE-010-S01, AC-DATASERVICE-014-S01, AC-DATASERVICE-015-S01, AC-DATASERVICE-016-S01, AC-DATASERVICE-016-S02, AC-DATASERVICE-016-S03, AC-DATASERVICE-016-S04, AC-DATASERVICE-017-S01, AC-DATASERVICE-018-S01, AC-DATASERVICE-019-S01, AC-DATASERVICE-020-S01, AC-DATASERVICE-020-S02, AC-DATASERVICE-020-S03, AC-DATASERVICE-020-S04, AC-DATASERVICE-021-S01, AC-DATASERVICE-021-S02, AC-DATASERVICE-021-S03, AC-DATASERVICE-022-S01, AC-DATASERVICE-022-S02, AC-DATASERVICE-024-S02, AC-DATASERVICE-024-S03 |  |  |  |
| REQ-DATASERVICE-122 | intent-0a4f03ab1e07a7afaad0a7fba033b2d4a7ef19b4b3a18ea52bb56ef6b08d15a1 | REQ-DATASERVICE-122 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-fa16ba43bd710958f693b3473bdbcfcb4cf8718920196afa9bdc7df97224cdb6 | none | TASK-DATASERVICE-003, TASK-DATASERVICE-004, TASK-DATASERVICE-011, TASK-DATASERVICE-012, TASK-DATASERVICE-013 | AC-DATASERVICE-002-S01, AC-DATASERVICE-006-S01, AC-DATASERVICE-007-S01, AC-DATASERVICE-009-S01, AC-DATASERVICE-009-S02, AC-DATASERVICE-010-S01, AC-DATASERVICE-014-S01, AC-DATASERVICE-015-S01, AC-DATASERVICE-016-S01, AC-DATASERVICE-016-S02, AC-DATASERVICE-016-S03, AC-DATASERVICE-016-S04, AC-DATASERVICE-017-S01, AC-DATASERVICE-018-S01, AC-DATASERVICE-019-S01, AC-DATASERVICE-020-S01, AC-DATASERVICE-020-S02, AC-DATASERVICE-020-S03, AC-DATASERVICE-020-S04, AC-DATASERVICE-021-S01, AC-DATASERVICE-021-S02, AC-DATASERVICE-021-S03, AC-DATASERVICE-022-S01, AC-DATASERVICE-022-S02, AC-DATASERVICE-024-S02, AC-DATASERVICE-024-S03 |  |  |  |
| REQ-DATASERVICE-123 | intent-45b904f368516a81f34adee3c395711debae56c98415ac34af0b815f64979a75 | REQ-DATASERVICE-123 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-edbedeb31eaf2cfb1424633e71a280f2dfb28fc3b21d109ab01ef76c1f676f9a | none | TASK-DATASERVICE-003, TASK-DATASERVICE-004, TASK-DATASERVICE-011, TASK-DATASERVICE-012, TASK-DATASERVICE-013 | AC-DATASERVICE-002-S01, AC-DATASERVICE-006-S01, AC-DATASERVICE-007-S01, AC-DATASERVICE-009-S01, AC-DATASERVICE-009-S02, AC-DATASERVICE-010-S01, AC-DATASERVICE-014-S01, AC-DATASERVICE-015-S01, AC-DATASERVICE-016-S01, AC-DATASERVICE-016-S02, AC-DATASERVICE-016-S03, AC-DATASERVICE-016-S04, AC-DATASERVICE-017-S01, AC-DATASERVICE-018-S01, AC-DATASERVICE-019-S01, AC-DATASERVICE-020-S01, AC-DATASERVICE-020-S02, AC-DATASERVICE-020-S03, AC-DATASERVICE-020-S04, AC-DATASERVICE-021-S01, AC-DATASERVICE-021-S02, AC-DATASERVICE-021-S03, AC-DATASERVICE-022-S01, AC-DATASERVICE-022-S02, AC-DATASERVICE-024-S02, AC-DATASERVICE-024-S03 |  |  |  |
| REQ-DATASERVICE-124 | intent-6f072bb4cc4fb74251bb4297bd9198625982e1bbed00d93eeed2e8e6b38c94a7 | REQ-DATASERVICE-124 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-702cace87493846591b847021b267a2cd819d3aff046bd0bbbd88ba6d5c82c59 | none | TASK-DATASERVICE-003, TASK-DATASERVICE-004, TASK-DATASERVICE-011, TASK-DATASERVICE-012, TASK-DATASERVICE-013 | AC-DATASERVICE-002-S01, AC-DATASERVICE-006-S01, AC-DATASERVICE-007-S01, AC-DATASERVICE-009-S01, AC-DATASERVICE-009-S02, AC-DATASERVICE-010-S01, AC-DATASERVICE-014-S01, AC-DATASERVICE-015-S01, AC-DATASERVICE-016-S01, AC-DATASERVICE-016-S02, AC-DATASERVICE-016-S03, AC-DATASERVICE-016-S04, AC-DATASERVICE-017-S01, AC-DATASERVICE-018-S01, AC-DATASERVICE-019-S01, AC-DATASERVICE-020-S01, AC-DATASERVICE-020-S02, AC-DATASERVICE-020-S03, AC-DATASERVICE-020-S04, AC-DATASERVICE-021-S01, AC-DATASERVICE-021-S02, AC-DATASERVICE-021-S03, AC-DATASERVICE-022-S01, AC-DATASERVICE-022-S02, AC-DATASERVICE-024-S02, AC-DATASERVICE-024-S03 |  |  |  |
| REQ-DATASERVICE-125 | intent-f6b02efc61f82bb538e8f822a5449e2947313835ea8dd747bad4b56743d757a4 | REQ-DATASERVICE-125 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-0e5f4344a139f5887a161c316e6f2443675402f69b5334eef37ca720fe06161f | none | TASK-DATASERVICE-005, TASK-DATASERVICE-007, TASK-DATASERVICE-014 | AC-DATASERVICE-001-S01, AC-DATASERVICE-002-S01, AC-DATASERVICE-003-S01, AC-DATASERVICE-004-S01, AC-DATASERVICE-005-S01, AC-DATASERVICE-006-S01, AC-DATASERVICE-008-S01, AC-DATASERVICE-013-S02, AC-DATASERVICE-021-S01, AC-DATASERVICE-021-S02, AC-DATASERVICE-021-S03, AC-DATASERVICE-023-S01, AC-DATASERVICE-023-S02, AC-DATASERVICE-023-S03, AC-DATASERVICE-024-S01, AC-DATASERVICE-024-S02, AC-DATASERVICE-024-S03 |  |  |  |
| REQ-DATASERVICE-126 | intent-6c6c62a3d57412da6fc0f920fecbcf6a94c767b37604d2b1281f325149806fe8 | REQ-DATASERVICE-126 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-f82677f35eb78b6c73e3eeab0e49d1e8ec446982a4b4d38eb58290a4718546f1 | none | TASK-DATASERVICE-005, TASK-DATASERVICE-007, TASK-DATASERVICE-014 | AC-DATASERVICE-001-S01, AC-DATASERVICE-002-S01, AC-DATASERVICE-003-S01, AC-DATASERVICE-004-S01, AC-DATASERVICE-005-S01, AC-DATASERVICE-006-S01, AC-DATASERVICE-008-S01, AC-DATASERVICE-013-S02, AC-DATASERVICE-021-S01, AC-DATASERVICE-021-S02, AC-DATASERVICE-021-S03, AC-DATASERVICE-023-S01, AC-DATASERVICE-023-S02, AC-DATASERVICE-023-S03, AC-DATASERVICE-024-S01, AC-DATASERVICE-024-S02, AC-DATASERVICE-024-S03 |  |  |  |
| REQ-DATASERVICE-127 | intent-5146d7ede780d3d1cbdffbbe9c1daf036ec93cd9c677f14e8d79649bcdfab811 | REQ-DATASERVICE-127 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-e4f5992ce11062ce8c5a6af9432b38faa9df0d02916b8c80b9a0cba0da18faa3 | none | TASK-DATASERVICE-005, TASK-DATASERVICE-007, TASK-DATASERVICE-014 | AC-DATASERVICE-001-S01, AC-DATASERVICE-002-S01, AC-DATASERVICE-003-S01, AC-DATASERVICE-004-S01, AC-DATASERVICE-005-S01, AC-DATASERVICE-006-S01, AC-DATASERVICE-008-S01, AC-DATASERVICE-013-S02, AC-DATASERVICE-021-S01, AC-DATASERVICE-021-S02, AC-DATASERVICE-021-S03, AC-DATASERVICE-023-S01, AC-DATASERVICE-023-S02, AC-DATASERVICE-023-S03, AC-DATASERVICE-024-S01, AC-DATASERVICE-024-S02, AC-DATASERVICE-024-S03 |  |  |  |
| REQ-DATASERVICE-128 | intent-dc424ae1143608759738f5bb5573014acebf6f94445e468a0dca7d8990f225f4 | REQ-DATASERVICE-128 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-d762277f0cd8943a246f81e3b8ddbb199f97e73ce40ecff46c8576b335076ad6 | none | TASK-DATASERVICE-005, TASK-DATASERVICE-007, TASK-DATASERVICE-014 | AC-DATASERVICE-001-S01, AC-DATASERVICE-002-S01, AC-DATASERVICE-003-S01, AC-DATASERVICE-004-S01, AC-DATASERVICE-005-S01, AC-DATASERVICE-006-S01, AC-DATASERVICE-008-S01, AC-DATASERVICE-013-S02, AC-DATASERVICE-021-S01, AC-DATASERVICE-021-S02, AC-DATASERVICE-021-S03, AC-DATASERVICE-023-S01, AC-DATASERVICE-023-S02, AC-DATASERVICE-023-S03, AC-DATASERVICE-024-S01, AC-DATASERVICE-024-S02, AC-DATASERVICE-024-S03 |  |  |  |
| REQ-DATASERVICE-129 | intent-8b260307e6c302444b052442d133987aa2e218add7b9401b63554985f2ea1a43 | REQ-DATASERVICE-129 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-823d6d825f8bfaa1d67c9b123ebfee488ce4eefd038054c324562ab3d0960bfd | none | TASK-DATASERVICE-005, TASK-DATASERVICE-007, TASK-DATASERVICE-014 | AC-DATASERVICE-001-S01, AC-DATASERVICE-002-S01, AC-DATASERVICE-003-S01, AC-DATASERVICE-004-S01, AC-DATASERVICE-005-S01, AC-DATASERVICE-006-S01, AC-DATASERVICE-008-S01, AC-DATASERVICE-013-S02, AC-DATASERVICE-021-S01, AC-DATASERVICE-021-S02, AC-DATASERVICE-021-S03, AC-DATASERVICE-023-S01, AC-DATASERVICE-023-S02, AC-DATASERVICE-023-S03, AC-DATASERVICE-024-S01, AC-DATASERVICE-024-S02, AC-DATASERVICE-024-S03 |  |  |  |
| REQ-DATASERVICE-130 | intent-38fe84d617b9fb09d2fe1481efd9ea73401939a709a628de6aaa666ad9220658 | REQ-DATASERVICE-130 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-c4a3483ea7533e280cbb07a15575821b0496458c45b7bd04ade5b98e80f1a5bb | none | TASK-DATASERVICE-005, TASK-DATASERVICE-007, TASK-DATASERVICE-014 | AC-DATASERVICE-001-S01, AC-DATASERVICE-002-S01, AC-DATASERVICE-003-S01, AC-DATASERVICE-004-S01, AC-DATASERVICE-005-S01, AC-DATASERVICE-006-S01, AC-DATASERVICE-008-S01, AC-DATASERVICE-013-S02, AC-DATASERVICE-021-S01, AC-DATASERVICE-021-S02, AC-DATASERVICE-021-S03, AC-DATASERVICE-023-S01, AC-DATASERVICE-023-S02, AC-DATASERVICE-023-S03, AC-DATASERVICE-024-S01, AC-DATASERVICE-024-S02, AC-DATASERVICE-024-S03 |  |  |  |
| REQ-DATASERVICE-131 | intent-6d8eb43b7350f5d7ce2b140340958f967a6a68901bee2020f4d11c17a7507943 | REQ-DATASERVICE-131 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-bbd2fc3aa0c5c40ded81972212f008447055562d10dc4cc2f9200bee5e465314 | none | TASK-DATASERVICE-005, TASK-DATASERVICE-007, TASK-DATASERVICE-014 | AC-DATASERVICE-001-S01, AC-DATASERVICE-002-S01, AC-DATASERVICE-003-S01, AC-DATASERVICE-004-S01, AC-DATASERVICE-005-S01, AC-DATASERVICE-006-S01, AC-DATASERVICE-008-S01, AC-DATASERVICE-013-S02, AC-DATASERVICE-021-S01, AC-DATASERVICE-021-S02, AC-DATASERVICE-021-S03, AC-DATASERVICE-023-S01, AC-DATASERVICE-023-S02, AC-DATASERVICE-023-S03, AC-DATASERVICE-024-S01, AC-DATASERVICE-024-S02, AC-DATASERVICE-024-S03 |  |  |  |
| REQ-DATASERVICE-132 | intent-14c7f6ffcddf1e725201724fc89f503ec9836683caf045a875a831b3c5a0eab8 | REQ-DATASERVICE-132 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-e51ec5e0e54fe8868b16a2723db5d0cd7768f0c6a227b30d18044413662497ad | none | TASK-DATASERVICE-005, TASK-DATASERVICE-007, TASK-DATASERVICE-014 | AC-DATASERVICE-001-S01, AC-DATASERVICE-002-S01, AC-DATASERVICE-003-S01, AC-DATASERVICE-004-S01, AC-DATASERVICE-005-S01, AC-DATASERVICE-006-S01, AC-DATASERVICE-008-S01, AC-DATASERVICE-013-S02, AC-DATASERVICE-021-S01, AC-DATASERVICE-021-S02, AC-DATASERVICE-021-S03, AC-DATASERVICE-023-S01, AC-DATASERVICE-023-S02, AC-DATASERVICE-023-S03, AC-DATASERVICE-024-S01, AC-DATASERVICE-024-S02, AC-DATASERVICE-024-S03 |  |  |  |
| REQ-DATASERVICE-133 | intent-21592338d324b0e4218bbf67a3a12663e3bb3b1fe1d3e7a05f7e6e10628b4a4d | REQ-DATASERVICE-133 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-169ee7b6da76b14332f8b7dcf62bb41858c3c7b247eae8b2e0283c4a92e11adc | none | TASK-DATASERVICE-005, TASK-DATASERVICE-007, TASK-DATASERVICE-014 | AC-DATASERVICE-001-S01, AC-DATASERVICE-002-S01, AC-DATASERVICE-003-S01, AC-DATASERVICE-004-S01, AC-DATASERVICE-005-S01, AC-DATASERVICE-006-S01, AC-DATASERVICE-008-S01, AC-DATASERVICE-013-S02, AC-DATASERVICE-021-S01, AC-DATASERVICE-021-S02, AC-DATASERVICE-021-S03, AC-DATASERVICE-023-S01, AC-DATASERVICE-023-S02, AC-DATASERVICE-023-S03, AC-DATASERVICE-024-S01, AC-DATASERVICE-024-S02, AC-DATASERVICE-024-S03 |  |  |  |
| REQ-DATASERVICE-134 | intent-df7ac899cb4bf96f657cb59beb7bba066e52cbfdb52b3536e487eaa9e463a3a9 | REQ-DATASERVICE-134 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-87a78d777682420a0c4242ae9b6de5de3cf43be422caa4dce09a554e245193ab | none | TASK-DATASERVICE-005, TASK-DATASERVICE-007, TASK-DATASERVICE-014 | AC-DATASERVICE-001-S01, AC-DATASERVICE-002-S01, AC-DATASERVICE-003-S01, AC-DATASERVICE-004-S01, AC-DATASERVICE-005-S01, AC-DATASERVICE-006-S01, AC-DATASERVICE-008-S01, AC-DATASERVICE-013-S02, AC-DATASERVICE-021-S01, AC-DATASERVICE-021-S02, AC-DATASERVICE-021-S03, AC-DATASERVICE-023-S01, AC-DATASERVICE-023-S02, AC-DATASERVICE-023-S03, AC-DATASERVICE-024-S01, AC-DATASERVICE-024-S02, AC-DATASERVICE-024-S03 |  |  |  |
| REQ-DATASERVICE-135 | intent-47eb6e187b2c1f71033b57741209689dd51bf4780d855f8d1ba417c828f0071c | REQ-DATASERVICE-135 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-739be6bfaa8f394aeab70f64cc9198314d9d7b0a484b0d5793b8e9a28335f19f | none | TASK-DATASERVICE-005, TASK-DATASERVICE-007, TASK-DATASERVICE-014 | AC-DATASERVICE-001-S01, AC-DATASERVICE-002-S01, AC-DATASERVICE-003-S01, AC-DATASERVICE-004-S01, AC-DATASERVICE-005-S01, AC-DATASERVICE-006-S01, AC-DATASERVICE-008-S01, AC-DATASERVICE-013-S02, AC-DATASERVICE-021-S01, AC-DATASERVICE-021-S02, AC-DATASERVICE-021-S03, AC-DATASERVICE-023-S01, AC-DATASERVICE-023-S02, AC-DATASERVICE-023-S03, AC-DATASERVICE-024-S01, AC-DATASERVICE-024-S02, AC-DATASERVICE-024-S03 |  |  |  |
| REQ-DATASERVICE-136 | intent-70357e2e5921045d407d773da23ed14bd65981142b8e463c6124f3e086b85dc1 | REQ-DATASERVICE-136 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-90bf310a1a92a0f6db46f8d278a8027d55e99bd616af318a98d24b07e0a0f61c | none | TASK-DATASERVICE-005, TASK-DATASERVICE-007, TASK-DATASERVICE-014 | AC-DATASERVICE-001-S01, AC-DATASERVICE-002-S01, AC-DATASERVICE-003-S01, AC-DATASERVICE-004-S01, AC-DATASERVICE-005-S01, AC-DATASERVICE-006-S01, AC-DATASERVICE-008-S01, AC-DATASERVICE-013-S02, AC-DATASERVICE-021-S01, AC-DATASERVICE-021-S02, AC-DATASERVICE-021-S03, AC-DATASERVICE-023-S01, AC-DATASERVICE-023-S02, AC-DATASERVICE-023-S03, AC-DATASERVICE-024-S01, AC-DATASERVICE-024-S02, AC-DATASERVICE-024-S03 |  |  |  |
| REQ-DATASERVICE-137 | intent-b32694e714dfac2cdb93d34a88c96719e957c4ebab4f763565fc1f0e92ee946a | REQ-DATASERVICE-137 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-d34ee07b282514fc15fe5186c8c902ca6858272a020723c7434f334bbda5b1c8 | none | TASK-DATASERVICE-015, TASK-DATASERVICE-016 |  |  |  |  |
| REQ-DATASERVICE-138 | intent-47a4506975114dee750e8c34958ad522386dc0229f1ba7a6f822ed1e60bd6517 | REQ-DATASERVICE-138 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-50dbda9673726921448e9167e3476a381e374781a79dc8574c3d70d5d8a12e39 | none | TASK-DATASERVICE-015, TASK-DATASERVICE-016 |  |  |  |  |
| REQ-DATASERVICE-139 | intent-fcc501d67da89a3f521c1a586fd9c231c233fb89c3be27033fd9b0b9d9cc3be7 | REQ-DATASERVICE-139 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-4e8b554ee256270046e5bd77e2dfd21e7f828bceee7921be22ad74827300cc8c | none | TASK-DATASERVICE-015, TASK-DATASERVICE-016 |  |  |  |  |
| REQ-DATASERVICE-140 | intent-f9e26178e5bdca590fa006283f5827e06779e5386b8d2635d33bb71ef2c083ee | REQ-DATASERVICE-140 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-1fc8aa03c650a6c11c4112c7b176a0dd915ae2897a257cbf73d5a707de4f32e5 | none | TASK-DATASERVICE-015, TASK-DATASERVICE-016 |  |  |  |  |
| REQ-DATASERVICE-141 | intent-3f2e45eae2301a2278f8928f5daa02c07d4c5f71ea7ffbf01e968ba8605cc9e2 | REQ-DATASERVICE-141 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-c4e6d14f5aa9b94b60062819a2fe3ec6cad377fddab8d6ce73134ef69e092cb5 | none | TASK-DATASERVICE-015, TASK-DATASERVICE-016 |  |  |  |  |
| REQ-DATASERVICE-142 | intent-87973872a88d125e58d267a7c038b339a30f83999791e4b71993952dd46eafeb | REQ-DATASERVICE-142 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-02277e3197d1923d6af50a5f234f8ddf3ec77dbb884d0bcd1019596f899c4622 | none | TASK-DATASERVICE-015, TASK-DATASERVICE-016 |  |  |  |  |
| REQ-DATASERVICE-143 | intent-d8f0bebbd9b1f019b2021371c387e90b982bb0fe45907e37ab01542da6d666ea | REQ-DATASERVICE-143 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-6f84c081cd48e871d61357c4d7822b844fe154ebf9f2542504a6ed9f334f9c6c | none | TASK-DATASERVICE-003, TASK-DATASERVICE-004, TASK-DATASERVICE-007 | AC-DATASERVICE-001-S01, AC-DATASERVICE-002-S01, AC-DATASERVICE-003-S01, AC-DATASERVICE-004-S01, AC-DATASERVICE-005-S01, AC-DATASERVICE-006-S01, AC-DATASERVICE-007-S01, AC-DATASERVICE-008-S01, AC-DATASERVICE-009-S01, AC-DATASERVICE-009-S02, AC-DATASERVICE-010-S01, AC-DATASERVICE-013-S02, AC-DATASERVICE-019-S01, AC-DATASERVICE-020-S04, AC-DATASERVICE-021-S01, AC-DATASERVICE-021-S02, AC-DATASERVICE-021-S03, AC-DATASERVICE-022-S01, AC-DATASERVICE-022-S02, AC-DATASERVICE-023-S01, AC-DATASERVICE-023-S02, AC-DATASERVICE-024-S01, AC-DATASERVICE-024-S02 |  |  |  |
| REQ-DATASERVICE-144 | intent-57e56ab89fb6b89b57dde8f0844d4a57e69e658e61c941faae784556df2a69d1 | REQ-DATASERVICE-144 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-3befae7338b2e22bb3ee5f11e97362a8730cd268e07416dd86fbb08eeb2e574d | none | TASK-DATASERVICE-003, TASK-DATASERVICE-004, TASK-DATASERVICE-007 | AC-DATASERVICE-001-S01, AC-DATASERVICE-002-S01, AC-DATASERVICE-003-S01, AC-DATASERVICE-004-S01, AC-DATASERVICE-005-S01, AC-DATASERVICE-006-S01, AC-DATASERVICE-007-S01, AC-DATASERVICE-008-S01, AC-DATASERVICE-009-S01, AC-DATASERVICE-009-S02, AC-DATASERVICE-010-S01, AC-DATASERVICE-013-S02, AC-DATASERVICE-019-S01, AC-DATASERVICE-020-S04, AC-DATASERVICE-021-S01, AC-DATASERVICE-021-S02, AC-DATASERVICE-021-S03, AC-DATASERVICE-022-S01, AC-DATASERVICE-022-S02, AC-DATASERVICE-023-S01, AC-DATASERVICE-023-S02, AC-DATASERVICE-024-S01, AC-DATASERVICE-024-S02 |  |  |  |
| REQ-DATASERVICE-145 | intent-ab741ee1e19ca86998d01d066d0b2d1ef25703bca2fac88c7f46440d7561d641 | REQ-DATASERVICE-145 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-77920d41c876eae9a6f998e54af21edecbca735c135bf7907963406a82dfc0a3 | none | TASK-DATASERVICE-003, TASK-DATASERVICE-004, TASK-DATASERVICE-007 | AC-DATASERVICE-001-S01, AC-DATASERVICE-002-S01, AC-DATASERVICE-003-S01, AC-DATASERVICE-004-S01, AC-DATASERVICE-005-S01, AC-DATASERVICE-006-S01, AC-DATASERVICE-007-S01, AC-DATASERVICE-008-S01, AC-DATASERVICE-009-S01, AC-DATASERVICE-009-S02, AC-DATASERVICE-010-S01, AC-DATASERVICE-013-S02, AC-DATASERVICE-019-S01, AC-DATASERVICE-020-S04, AC-DATASERVICE-021-S01, AC-DATASERVICE-021-S02, AC-DATASERVICE-021-S03, AC-DATASERVICE-022-S01, AC-DATASERVICE-022-S02, AC-DATASERVICE-023-S01, AC-DATASERVICE-023-S02, AC-DATASERVICE-024-S01, AC-DATASERVICE-024-S02 |  |  |  |
| REQ-DATASERVICE-146 | intent-7459bcf32fd490198d648922cca6098c9e54be9c998447f8dab593d071745ae6 | REQ-DATASERVICE-146 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-72619d53f57b4c4947603ff0e890bb68e5986163b22bc555e7c84791a5bda308 | none | TASK-DATASERVICE-003, TASK-DATASERVICE-004, TASK-DATASERVICE-007 | AC-DATASERVICE-001-S01, AC-DATASERVICE-002-S01, AC-DATASERVICE-003-S01, AC-DATASERVICE-004-S01, AC-DATASERVICE-005-S01, AC-DATASERVICE-006-S01, AC-DATASERVICE-007-S01, AC-DATASERVICE-008-S01, AC-DATASERVICE-009-S01, AC-DATASERVICE-009-S02, AC-DATASERVICE-010-S01, AC-DATASERVICE-013-S02, AC-DATASERVICE-019-S01, AC-DATASERVICE-020-S04, AC-DATASERVICE-021-S01, AC-DATASERVICE-021-S02, AC-DATASERVICE-021-S03, AC-DATASERVICE-022-S01, AC-DATASERVICE-022-S02, AC-DATASERVICE-023-S01, AC-DATASERVICE-023-S02, AC-DATASERVICE-024-S01, AC-DATASERVICE-024-S02 |  |  |  |
| NEG-DATASERVICE-011 | intent-5e7790272ef618fe075cddda19a65176e341d124dfea7ea4dd157ee27ffc8175 | NEG-DATASERVICE-011 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-5560ef6fd0eb8cf2b9fe8fe4328c0fca0bdc4eacea7d312e155046a8dcaee169 | none | TASK-DATASERVICE-003, TASK-DATASERVICE-004, TASK-DATASERVICE-007 | AC-DATASERVICE-001-S01, AC-DATASERVICE-002-S01, AC-DATASERVICE-003-S01, AC-DATASERVICE-004-S01, AC-DATASERVICE-005-S01, AC-DATASERVICE-006-S01, AC-DATASERVICE-007-S01, AC-DATASERVICE-008-S01, AC-DATASERVICE-009-S01, AC-DATASERVICE-009-S02, AC-DATASERVICE-010-S01, AC-DATASERVICE-013-S02, AC-DATASERVICE-019-S01, AC-DATASERVICE-020-S04, AC-DATASERVICE-021-S01, AC-DATASERVICE-021-S02, AC-DATASERVICE-021-S03, AC-DATASERVICE-022-S01, AC-DATASERVICE-022-S02, AC-DATASERVICE-023-S01, AC-DATASERVICE-023-S02, AC-DATASERVICE-024-S01, AC-DATASERVICE-024-S02 |  |  |  |
| REQ-DATASERVICE-147 | intent-b34eda4adfe7923033fdf4899e93d592f7754401e6cb9cf0b352374fa0a67949 | REQ-DATASERVICE-147 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-6819abb60454e30ebb7c94a736eb4a80262bf3a56ae31ab25f7fadebefc7fd7d | none | TASK-DATASERVICE-003, TASK-DATASERVICE-004, TASK-DATASERVICE-007 | AC-DATASERVICE-001-S01, AC-DATASERVICE-002-S01, AC-DATASERVICE-003-S01, AC-DATASERVICE-004-S01, AC-DATASERVICE-005-S01, AC-DATASERVICE-006-S01, AC-DATASERVICE-007-S01, AC-DATASERVICE-008-S01, AC-DATASERVICE-009-S01, AC-DATASERVICE-009-S02, AC-DATASERVICE-010-S01, AC-DATASERVICE-013-S02, AC-DATASERVICE-019-S01, AC-DATASERVICE-020-S04, AC-DATASERVICE-021-S01, AC-DATASERVICE-021-S02, AC-DATASERVICE-021-S03, AC-DATASERVICE-022-S01, AC-DATASERVICE-022-S02, AC-DATASERVICE-023-S01, AC-DATASERVICE-023-S02, AC-DATASERVICE-024-S01, AC-DATASERVICE-024-S02 |  |  |  |
| REQ-DATASERVICE-148 | intent-30dc3b1ef93c4e98b875864d8ce9a57967f3964b971185b2a1898db60cc365a5 | REQ-DATASERVICE-148 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-5264dc3a73b37241a2f3442e7b675b59e2f7948f65c9881807ee5cef1fee050d | none | TASK-DATASERVICE-003, TASK-DATASERVICE-004, TASK-DATASERVICE-007 | AC-DATASERVICE-001-S01, AC-DATASERVICE-002-S01, AC-DATASERVICE-003-S01, AC-DATASERVICE-004-S01, AC-DATASERVICE-005-S01, AC-DATASERVICE-006-S01, AC-DATASERVICE-007-S01, AC-DATASERVICE-008-S01, AC-DATASERVICE-009-S01, AC-DATASERVICE-009-S02, AC-DATASERVICE-010-S01, AC-DATASERVICE-013-S02, AC-DATASERVICE-019-S01, AC-DATASERVICE-020-S04, AC-DATASERVICE-021-S01, AC-DATASERVICE-021-S02, AC-DATASERVICE-021-S03, AC-DATASERVICE-022-S01, AC-DATASERVICE-022-S02, AC-DATASERVICE-023-S01, AC-DATASERVICE-023-S02, AC-DATASERVICE-024-S01, AC-DATASERVICE-024-S02 |  |  |  |
| REQ-DATASERVICE-149 | intent-79c365a1558d2ff2d100b19e4bcc878e9a37c6230682a8dcedbfae8dc3cd6a6f | REQ-DATASERVICE-149 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-e9efce25b1b8c310d09b4301fdb479dc40501b197b31426e84e21e4cfac97e30 | none | TASK-DATASERVICE-003, TASK-DATASERVICE-004, TASK-DATASERVICE-007 | AC-DATASERVICE-001-S01, AC-DATASERVICE-002-S01, AC-DATASERVICE-003-S01, AC-DATASERVICE-004-S01, AC-DATASERVICE-005-S01, AC-DATASERVICE-006-S01, AC-DATASERVICE-007-S01, AC-DATASERVICE-008-S01, AC-DATASERVICE-009-S01, AC-DATASERVICE-009-S02, AC-DATASERVICE-010-S01, AC-DATASERVICE-013-S02, AC-DATASERVICE-019-S01, AC-DATASERVICE-020-S04, AC-DATASERVICE-021-S01, AC-DATASERVICE-021-S02, AC-DATASERVICE-021-S03, AC-DATASERVICE-022-S01, AC-DATASERVICE-022-S02, AC-DATASERVICE-023-S01, AC-DATASERVICE-023-S02, AC-DATASERVICE-024-S01, AC-DATASERVICE-024-S02 |  |  |  |
| REQ-DATASERVICE-150 | intent-84e8299329ce78904eb97e10e1ddd36006f78bc09ce4ec8fcab43610d3c038a6 | REQ-DATASERVICE-150 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-822d728e15859b568df6879a58d896f0b728f48ee10e50c928b8b615a306e189 | none | TASK-DATASERVICE-008, TASK-DATASERVICE-009 | AC-DATASERVICE-006-S01, AC-DATASERVICE-007-S01, AC-DATASERVICE-008-S01, AC-DATASERVICE-011-S01, AC-DATASERVICE-012-S01, AC-DATASERVICE-013-S01, AC-DATASERVICE-013-S02, AC-DATASERVICE-023-S01, AC-DATASERVICE-024-S01 |  |  |  |
| REQ-DATASERVICE-151 | intent-8dd0e38c329fd4168eb4e24a796219e4cbc08528105d6244857317043dfc34bf | REQ-DATASERVICE-151 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-742019834db2b7df12be96fc408b83a32ba05845bde3b8cc81323cc1ea20ee96 | none | TASK-DATASERVICE-008, TASK-DATASERVICE-009 | AC-DATASERVICE-006-S01, AC-DATASERVICE-007-S01, AC-DATASERVICE-008-S01, AC-DATASERVICE-011-S01, AC-DATASERVICE-012-S01, AC-DATASERVICE-013-S01, AC-DATASERVICE-013-S02, AC-DATASERVICE-023-S01, AC-DATASERVICE-024-S01 |  |  |  |
| REQ-DATASERVICE-152 | intent-f0aacfa96460e4c855dbb592cf6f56a8c9826ff0096b75b048f3a27ef0d715dd | REQ-DATASERVICE-152 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-b8564e01eb44f8f4c2625d0238434bbd9139b1dfd57040e99f66fbc622573cf4 | none | TASK-DATASERVICE-008, TASK-DATASERVICE-009 | AC-DATASERVICE-006-S01, AC-DATASERVICE-007-S01, AC-DATASERVICE-008-S01, AC-DATASERVICE-011-S01, AC-DATASERVICE-012-S01, AC-DATASERVICE-013-S01, AC-DATASERVICE-013-S02, AC-DATASERVICE-023-S01, AC-DATASERVICE-024-S01 |  |  |  |
| NEG-DATASERVICE-012 | intent-05d5db8b82a57f055817040ad53f27f2ae944f5a4d4452b98a637735c47dc2e6 | NEG-DATASERVICE-012 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-30a5f4490eccd991175f7b3c88905b7e130085cff3cf08da1677bdc93ede1ec2 | none | TASK-DATASERVICE-008, TASK-DATASERVICE-009 | AC-DATASERVICE-006-S01, AC-DATASERVICE-007-S01, AC-DATASERVICE-008-S01, AC-DATASERVICE-011-S01, AC-DATASERVICE-012-S01, AC-DATASERVICE-013-S01, AC-DATASERVICE-013-S02, AC-DATASERVICE-023-S01, AC-DATASERVICE-024-S01 |  |  |  |
| REQ-DATASERVICE-153 | intent-7b52940bf21f588bff04b66a07a18a870de1dfd3ae73f209380dddadcf04c683 | REQ-DATASERVICE-153 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-0617fa813fadb610da9f8456470f952c034334838d2bfcded45049968979d039 | none | TASK-DATASERVICE-008, TASK-DATASERVICE-009 | AC-DATASERVICE-006-S01, AC-DATASERVICE-007-S01, AC-DATASERVICE-008-S01, AC-DATASERVICE-011-S01, AC-DATASERVICE-012-S01, AC-DATASERVICE-013-S01, AC-DATASERVICE-013-S02, AC-DATASERVICE-023-S01, AC-DATASERVICE-024-S01 |  |  |  |
| REQ-DATASERVICE-154 | intent-581ce9d98765b48f0810148398749b0b88ca30c9290f9bc274f483fb68ae8da9 | REQ-DATASERVICE-154 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-f3aac44fb2d8533a65c08498d94de8467aef6fbe16fd97ed07aff11d9958d82c | none | TASK-DATASERVICE-008, TASK-DATASERVICE-009 | AC-DATASERVICE-006-S01, AC-DATASERVICE-007-S01, AC-DATASERVICE-008-S01, AC-DATASERVICE-011-S01, AC-DATASERVICE-012-S01, AC-DATASERVICE-013-S01, AC-DATASERVICE-013-S02, AC-DATASERVICE-023-S01, AC-DATASERVICE-024-S01 |  |  |  |
| REQ-DATASERVICE-155 | intent-fe3dfc88a3a06e9f684363134408a89457ae7f4005c830816f057ff87d3b45bb | REQ-DATASERVICE-155 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-a25dbeeab510d6580ec4f96e364ab6d0b83deb83e76c52a96612177842c38577 | none | TASK-DATASERVICE-008, TASK-DATASERVICE-009 | AC-DATASERVICE-006-S01, AC-DATASERVICE-007-S01, AC-DATASERVICE-008-S01, AC-DATASERVICE-011-S01, AC-DATASERVICE-012-S01, AC-DATASERVICE-013-S01, AC-DATASERVICE-013-S02, AC-DATASERVICE-023-S01, AC-DATASERVICE-024-S01 |  |  |  |
| REQ-DATASERVICE-156 | intent-fa732c7eb3879b23cb4ee81c05ab5f93c414b2ce189493aa072665d2a41fd101 | REQ-DATASERVICE-156 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-f63c83f736ea4bea3c0cab1fd8f27f85e53e7f8a9f418ccc16b408b23b24c805 | none | TASK-DATASERVICE-008, TASK-DATASERVICE-009 | AC-DATASERVICE-006-S01, AC-DATASERVICE-007-S01, AC-DATASERVICE-008-S01, AC-DATASERVICE-011-S01, AC-DATASERVICE-012-S01, AC-DATASERVICE-013-S01, AC-DATASERVICE-013-S02, AC-DATASERVICE-023-S01, AC-DATASERVICE-024-S01 |  |  |  |
| REQ-DATASERVICE-157 | intent-9047e32c11e4803bd93b27c588e638dfd238b54dceba86d1d9d7190d602b28a4 | REQ-DATASERVICE-157 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-64cd23f3678bac54de03f646f84baf92beac6caa728d4c6303cc698d294d6e81 | none | TASK-DATASERVICE-008, TASK-DATASERVICE-009 | AC-DATASERVICE-006-S01, AC-DATASERVICE-007-S01, AC-DATASERVICE-008-S01, AC-DATASERVICE-011-S01, AC-DATASERVICE-012-S01, AC-DATASERVICE-013-S01, AC-DATASERVICE-013-S02, AC-DATASERVICE-023-S01, AC-DATASERVICE-024-S01 |  |  |  |
| NEG-DATASERVICE-013 | intent-72e4250e9645f510a20419181aa64e80512afd42ae1de40477e45b751fb872be | NEG-DATASERVICE-013 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-45a8662ff9dddf6454db2f39d5719eb46be51de510c4acffade31a7c8e0ca363 | none | TASK-DATASERVICE-008, TASK-DATASERVICE-009 | AC-DATASERVICE-006-S01, AC-DATASERVICE-007-S01, AC-DATASERVICE-008-S01, AC-DATASERVICE-011-S01, AC-DATASERVICE-012-S01, AC-DATASERVICE-013-S01, AC-DATASERVICE-013-S02, AC-DATASERVICE-023-S01, AC-DATASERVICE-024-S01 |  |  |  |
| REQ-DATASERVICE-158 | intent-e15386d5a38414ef4e5511e8ad5240bf0cb361f131f94188a6e1c31a8bd2f1ac | REQ-DATASERVICE-158 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-5230d9219ca56057f973314c8f11f60063b448da305d6c6fd98867dd68d5e017 | none | TASK-DATASERVICE-008, TASK-DATASERVICE-009 | AC-DATASERVICE-006-S01, AC-DATASERVICE-007-S01, AC-DATASERVICE-008-S01, AC-DATASERVICE-011-S01, AC-DATASERVICE-012-S01, AC-DATASERVICE-013-S01, AC-DATASERVICE-013-S02, AC-DATASERVICE-023-S01, AC-DATASERVICE-024-S01 |  |  |  |
| REQ-DATASERVICE-159 | intent-00f4b020578630a90617b78f1bf8b0e92bdc312c3a52ff2435cb385cb4fce92c | REQ-DATASERVICE-159 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-060e30c76f50a26b2a0f0f44c1107a4dd8e0e36e426ae176aeecac4f6eb1c8b6 | none | TASK-DATASERVICE-003, TASK-DATASERVICE-008, TASK-DATASERVICE-009 | AC-DATASERVICE-006-S01, AC-DATASERVICE-007-S01, AC-DATASERVICE-008-S01, AC-DATASERVICE-009-S01, AC-DATASERVICE-011-S01, AC-DATASERVICE-012-S01, AC-DATASERVICE-013-S01, AC-DATASERVICE-013-S02, AC-DATASERVICE-019-S01, AC-DATASERVICE-020-S04, AC-DATASERVICE-021-S01, AC-DATASERVICE-021-S02, AC-DATASERVICE-021-S03, AC-DATASERVICE-022-S01, AC-DATASERVICE-022-S02, AC-DATASERVICE-023-S01, AC-DATASERVICE-024-S01 |  |  |  |
| REQ-DATASERVICE-160 | intent-6b4232a9bfc2d91267ebfccc2d9bb6c7429f7ddccfd39d7e5cf645945b925251 | REQ-DATASERVICE-160 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-c94f91b39539122129b527846aef256c84513fb4d3dca8469c2db15cb750470a | none | TASK-DATASERVICE-003, TASK-DATASERVICE-008, TASK-DATASERVICE-009 | AC-DATASERVICE-006-S01, AC-DATASERVICE-007-S01, AC-DATASERVICE-008-S01, AC-DATASERVICE-009-S01, AC-DATASERVICE-011-S01, AC-DATASERVICE-012-S01, AC-DATASERVICE-013-S01, AC-DATASERVICE-013-S02, AC-DATASERVICE-019-S01, AC-DATASERVICE-020-S04, AC-DATASERVICE-021-S01, AC-DATASERVICE-021-S02, AC-DATASERVICE-021-S03, AC-DATASERVICE-022-S01, AC-DATASERVICE-022-S02, AC-DATASERVICE-023-S01, AC-DATASERVICE-024-S01 |  |  |  |
| REQ-DATASERVICE-161 | intent-bedda5234c68761e1a3d5394bbdefd0cd1d49387f79d810a6f5ffacab2b03850 | REQ-DATASERVICE-161 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-27ca65a1c73068c71857aa78cdd9d161372beda14b0b1b8c142abb9001ceb115 | none | TASK-DATASERVICE-003, TASK-DATASERVICE-008, TASK-DATASERVICE-009 | AC-DATASERVICE-006-S01, AC-DATASERVICE-007-S01, AC-DATASERVICE-008-S01, AC-DATASERVICE-009-S01, AC-DATASERVICE-011-S01, AC-DATASERVICE-012-S01, AC-DATASERVICE-013-S01, AC-DATASERVICE-013-S02, AC-DATASERVICE-019-S01, AC-DATASERVICE-020-S04, AC-DATASERVICE-021-S01, AC-DATASERVICE-021-S02, AC-DATASERVICE-021-S03, AC-DATASERVICE-022-S01, AC-DATASERVICE-022-S02, AC-DATASERVICE-023-S01, AC-DATASERVICE-024-S01 |  |  |  |
| REQ-DATASERVICE-162 | intent-d11cbd7b3ffb67d303f6628b5e11debe413467e1fea54434d9549a5544cad8e5 | REQ-DATASERVICE-162 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-5cb16d4337b43ceefa07b4e5073193126cf661f81df7871d89becffb432f897d | none | TASK-DATASERVICE-003, TASK-DATASERVICE-008, TASK-DATASERVICE-009 | AC-DATASERVICE-006-S01, AC-DATASERVICE-007-S01, AC-DATASERVICE-008-S01, AC-DATASERVICE-009-S01, AC-DATASERVICE-011-S01, AC-DATASERVICE-012-S01, AC-DATASERVICE-013-S01, AC-DATASERVICE-013-S02, AC-DATASERVICE-019-S01, AC-DATASERVICE-020-S04, AC-DATASERVICE-021-S01, AC-DATASERVICE-021-S02, AC-DATASERVICE-021-S03, AC-DATASERVICE-022-S01, AC-DATASERVICE-022-S02, AC-DATASERVICE-023-S01, AC-DATASERVICE-024-S01 |  |  |  |
| REQ-DATASERVICE-163 | intent-fc73b57f807978e0942ca501b98701eefb4f8d4a79b936d98b337f0490381b12 | REQ-DATASERVICE-163 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-a1a92c61f0861aa58a0c870510cba91b289e15339c1268ea453210c731037b06 | none | TASK-DATASERVICE-003, TASK-DATASERVICE-008, TASK-DATASERVICE-009 | AC-DATASERVICE-006-S01, AC-DATASERVICE-007-S01, AC-DATASERVICE-008-S01, AC-DATASERVICE-009-S01, AC-DATASERVICE-011-S01, AC-DATASERVICE-012-S01, AC-DATASERVICE-013-S01, AC-DATASERVICE-013-S02, AC-DATASERVICE-019-S01, AC-DATASERVICE-020-S04, AC-DATASERVICE-021-S01, AC-DATASERVICE-021-S02, AC-DATASERVICE-021-S03, AC-DATASERVICE-022-S01, AC-DATASERVICE-022-S02, AC-DATASERVICE-023-S01, AC-DATASERVICE-024-S01 |  |  |  |
| REQ-DATASERVICE-164 | intent-cf0c1b2ece1df42c8cd0194579159650530bb0e6fae32db5961c3a08b1e82429 | REQ-DATASERVICE-164 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-69323ac90ee5b29d416ec4a5ab79d8ae8b82636f7c1e101da75288244dd7b309 | none | TASK-DATASERVICE-003, TASK-DATASERVICE-008, TASK-DATASERVICE-009 | AC-DATASERVICE-006-S01, AC-DATASERVICE-007-S01, AC-DATASERVICE-008-S01, AC-DATASERVICE-009-S01, AC-DATASERVICE-011-S01, AC-DATASERVICE-012-S01, AC-DATASERVICE-013-S01, AC-DATASERVICE-013-S02, AC-DATASERVICE-019-S01, AC-DATASERVICE-020-S04, AC-DATASERVICE-021-S01, AC-DATASERVICE-021-S02, AC-DATASERVICE-021-S03, AC-DATASERVICE-022-S01, AC-DATASERVICE-022-S02, AC-DATASERVICE-023-S01, AC-DATASERVICE-024-S01 |  |  |  |
| REQ-DATASERVICE-165 | intent-6fc930cdf14ecfb846c9cb7149459c2df5c1dbd1065de2fe3f6162173ddef583 | REQ-DATASERVICE-165 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-bdc7b93e6a1e26f7b11e6af8d5d442c65f3af7192a550c217303caf251bfbd8f | none | TASK-DATASERVICE-003, TASK-DATASERVICE-008, TASK-DATASERVICE-009 | AC-DATASERVICE-006-S01, AC-DATASERVICE-007-S01, AC-DATASERVICE-008-S01, AC-DATASERVICE-009-S01, AC-DATASERVICE-011-S01, AC-DATASERVICE-012-S01, AC-DATASERVICE-013-S01, AC-DATASERVICE-013-S02, AC-DATASERVICE-019-S01, AC-DATASERVICE-020-S04, AC-DATASERVICE-021-S01, AC-DATASERVICE-021-S02, AC-DATASERVICE-021-S03, AC-DATASERVICE-022-S01, AC-DATASERVICE-022-S02, AC-DATASERVICE-023-S01, AC-DATASERVICE-024-S01 |  |  |  |
| REQ-DATASERVICE-166 | intent-956dbc7266f7c199bebbd4219d110cca560e6385ff0765ea74c9aa76d9fd2cfe | REQ-DATASERVICE-166 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-b89e5f840359197ebd99199ab0940f5f9c3b823e3d343398c56d278c48a323ec | none | TASK-DATASERVICE-004, TASK-DATASERVICE-007 | AC-DATASERVICE-001-S01, AC-DATASERVICE-002-S01, AC-DATASERVICE-003-S01, AC-DATASERVICE-004-S01, AC-DATASERVICE-005-S01, AC-DATASERVICE-006-S01, AC-DATASERVICE-007-S01, AC-DATASERVICE-008-S01, AC-DATASERVICE-009-S01, AC-DATASERVICE-009-S02, AC-DATASERVICE-010-S01, AC-DATASERVICE-013-S02, AC-DATASERVICE-022-S01, AC-DATASERVICE-022-S02, AC-DATASERVICE-023-S01, AC-DATASERVICE-023-S02, AC-DATASERVICE-024-S01, AC-DATASERVICE-024-S02 |  |  |  |
| REQ-DATASERVICE-167 | intent-0f6d734a5c87ac894542b6d2d280477104006d8e87e9baf97494f8420fd0741c | REQ-DATASERVICE-167 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-fa13598613442b4d4ef5ea3ccf9ac4060c61f95944e8b563c32b61254fc5edaa | none | TASK-DATASERVICE-004, TASK-DATASERVICE-007 | AC-DATASERVICE-001-S01, AC-DATASERVICE-002-S01, AC-DATASERVICE-003-S01, AC-DATASERVICE-004-S01, AC-DATASERVICE-005-S01, AC-DATASERVICE-006-S01, AC-DATASERVICE-007-S01, AC-DATASERVICE-008-S01, AC-DATASERVICE-009-S01, AC-DATASERVICE-009-S02, AC-DATASERVICE-010-S01, AC-DATASERVICE-013-S02, AC-DATASERVICE-022-S01, AC-DATASERVICE-022-S02, AC-DATASERVICE-023-S01, AC-DATASERVICE-023-S02, AC-DATASERVICE-024-S01, AC-DATASERVICE-024-S02 |  |  |  |
| REQ-DATASERVICE-168 | intent-c22bc76d678015a7f8820cdb59c488ceff20a29eef5bd55bef9ba888b8ec3cf0 | REQ-DATASERVICE-168 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-2c2bde619a0e03e7c679af20153ead8b13f93afa5980f857933a2bcd5454d8bd | none | TASK-DATASERVICE-004, TASK-DATASERVICE-007 | AC-DATASERVICE-001-S01, AC-DATASERVICE-002-S01, AC-DATASERVICE-003-S01, AC-DATASERVICE-004-S01, AC-DATASERVICE-005-S01, AC-DATASERVICE-006-S01, AC-DATASERVICE-007-S01, AC-DATASERVICE-008-S01, AC-DATASERVICE-009-S01, AC-DATASERVICE-009-S02, AC-DATASERVICE-010-S01, AC-DATASERVICE-013-S02, AC-DATASERVICE-022-S01, AC-DATASERVICE-022-S02, AC-DATASERVICE-023-S01, AC-DATASERVICE-023-S02, AC-DATASERVICE-024-S01, AC-DATASERVICE-024-S02 |  |  |  |
| REQ-DATASERVICE-169 | intent-d2fbadf93c59a90ae312e0832a16817c530342f479e7cd426fe5de7fc6f263df | REQ-DATASERVICE-169 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-8f6fae1ff812e2356823af8b119bb8d67766d258673b8c056a57fb098cc6d078 | none | TASK-DATASERVICE-004, TASK-DATASERVICE-007 | AC-DATASERVICE-001-S01, AC-DATASERVICE-002-S01, AC-DATASERVICE-003-S01, AC-DATASERVICE-004-S01, AC-DATASERVICE-005-S01, AC-DATASERVICE-006-S01, AC-DATASERVICE-007-S01, AC-DATASERVICE-008-S01, AC-DATASERVICE-009-S01, AC-DATASERVICE-009-S02, AC-DATASERVICE-010-S01, AC-DATASERVICE-013-S02, AC-DATASERVICE-022-S01, AC-DATASERVICE-022-S02, AC-DATASERVICE-023-S01, AC-DATASERVICE-023-S02, AC-DATASERVICE-024-S01, AC-DATASERVICE-024-S02 |  |  |  |
| REQ-DATASERVICE-170 | intent-7bc72e2388bccaf9303323bfd05104482ed2dc5e090a84e2c5209e1300a0a487 | REQ-DATASERVICE-170 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-07c6c9aaf9f78229e7f64067a4bb6a8bfac8893e27220e53837333735778e87d | none | TASK-DATASERVICE-004, TASK-DATASERVICE-007 | AC-DATASERVICE-001-S01, AC-DATASERVICE-002-S01, AC-DATASERVICE-003-S01, AC-DATASERVICE-004-S01, AC-DATASERVICE-005-S01, AC-DATASERVICE-006-S01, AC-DATASERVICE-007-S01, AC-DATASERVICE-008-S01, AC-DATASERVICE-009-S01, AC-DATASERVICE-009-S02, AC-DATASERVICE-010-S01, AC-DATASERVICE-013-S02, AC-DATASERVICE-022-S01, AC-DATASERVICE-022-S02, AC-DATASERVICE-023-S01, AC-DATASERVICE-023-S02, AC-DATASERVICE-024-S01, AC-DATASERVICE-024-S02 |  |  |  |
| NEG-DATASERVICE-014 | intent-3f1ea71317dabb3000700ce391b26a597d789f5a4a2334ce20d3b30334038b48 | NEG-DATASERVICE-014 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-121b2946bcff929c0d5c42398ec1307e6a5010ddc5ff367d4a2fc8135672bb75 | none | TASK-DATASERVICE-004, TASK-DATASERVICE-007 | AC-DATASERVICE-001-S01, AC-DATASERVICE-002-S01, AC-DATASERVICE-003-S01, AC-DATASERVICE-004-S01, AC-DATASERVICE-005-S01, AC-DATASERVICE-006-S01, AC-DATASERVICE-007-S01, AC-DATASERVICE-008-S01, AC-DATASERVICE-009-S01, AC-DATASERVICE-009-S02, AC-DATASERVICE-010-S01, AC-DATASERVICE-013-S02, AC-DATASERVICE-022-S01, AC-DATASERVICE-022-S02, AC-DATASERVICE-023-S01, AC-DATASERVICE-023-S02, AC-DATASERVICE-024-S01, AC-DATASERVICE-024-S02 |  |  |  |
| REQ-DATASERVICE-171 | intent-6b835de00137972f139380c1112a0af797286548ae5e87f7bbdf58d946303161 | REQ-DATASERVICE-171 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-3608ba7fb69ff6c4198a1876c2b7257ae60faf8cfb839adad0776ce5ed561e2a | none | TASK-DATASERVICE-004, TASK-DATASERVICE-007 | AC-DATASERVICE-001-S01, AC-DATASERVICE-002-S01, AC-DATASERVICE-003-S01, AC-DATASERVICE-004-S01, AC-DATASERVICE-005-S01, AC-DATASERVICE-006-S01, AC-DATASERVICE-007-S01, AC-DATASERVICE-008-S01, AC-DATASERVICE-009-S01, AC-DATASERVICE-009-S02, AC-DATASERVICE-010-S01, AC-DATASERVICE-013-S02, AC-DATASERVICE-022-S01, AC-DATASERVICE-022-S02, AC-DATASERVICE-023-S01, AC-DATASERVICE-023-S02, AC-DATASERVICE-024-S01, AC-DATASERVICE-024-S02 |  |  |  |
| REQ-DATASERVICE-172 | intent-ac2af2bfa7e6d774e8129164a22d560b60972ce09539b4f7767e426359ad8b34 | REQ-DATASERVICE-172 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-a5c7ec892f7d5753487d0223f91ee760caa91e74f92c0ace41894e3af5a3d357 | none | TASK-DATASERVICE-004, TASK-DATASERVICE-007 | AC-DATASERVICE-001-S01, AC-DATASERVICE-002-S01, AC-DATASERVICE-003-S01, AC-DATASERVICE-004-S01, AC-DATASERVICE-005-S01, AC-DATASERVICE-006-S01, AC-DATASERVICE-007-S01, AC-DATASERVICE-008-S01, AC-DATASERVICE-009-S01, AC-DATASERVICE-009-S02, AC-DATASERVICE-010-S01, AC-DATASERVICE-013-S02, AC-DATASERVICE-022-S01, AC-DATASERVICE-022-S02, AC-DATASERVICE-023-S01, AC-DATASERVICE-023-S02, AC-DATASERVICE-024-S01, AC-DATASERVICE-024-S02 |  |  |  |
| REQ-DATASERVICE-173 | intent-3feab779790ca498a1a17c5c8621522c2f07383fc255338682a01fae9ef4230f | REQ-DATASERVICE-173 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-357056c096287e708525323c737ed8074ce55d780bb9b3c43c81bc73ec94e8d6 | none | TASK-DATASERVICE-004, TASK-DATASERVICE-007 | AC-DATASERVICE-001-S01, AC-DATASERVICE-002-S01, AC-DATASERVICE-003-S01, AC-DATASERVICE-004-S01, AC-DATASERVICE-005-S01, AC-DATASERVICE-006-S01, AC-DATASERVICE-007-S01, AC-DATASERVICE-008-S01, AC-DATASERVICE-009-S01, AC-DATASERVICE-009-S02, AC-DATASERVICE-010-S01, AC-DATASERVICE-013-S02, AC-DATASERVICE-022-S01, AC-DATASERVICE-022-S02, AC-DATASERVICE-023-S01, AC-DATASERVICE-023-S02, AC-DATASERVICE-024-S01, AC-DATASERVICE-024-S02 |  |  |  |
| REQ-DATASERVICE-174 | intent-acace943c0c4d26ba83a3f1a237dbc978fc84d23bc571f19dd8cf42485da256c | REQ-DATASERVICE-174 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-2e68b022beadbea191b8f6abe9a55d88d1848297ff91e07473f38f1ef0918b3c | none | TASK-DATASERVICE-015 |  |  |  |  |
| REQ-DATASERVICE-175 | intent-3dbc909d4b6276e4aec6963730799f2c7f547edab2edb21163dcb05bd35c4765 | REQ-DATASERVICE-175 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-0579033fb800de328abeadc62114173a86104c1f4fc022453021f1f0fcd25e25 | none | TASK-DATASERVICE-015 |  |  |  |  |
| REQ-DATASERVICE-176 | intent-bdab18cb0f363d041ccd465a2828bb1273d2702294f091d52785da19ea82a416 | REQ-DATASERVICE-176 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-e42bfe764380a20d7c7aef008464a7c6b96d2667ef651bede7474c288808df34 | none | TASK-DATASERVICE-015 |  |  |  |  |
| REQ-DATASERVICE-177 | intent-8a3c0e8a95dc3654d90b308ba74e9396a14c43f512772f0819fbe9747fd1257a | REQ-DATASERVICE-177 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-ce27a653be51b5f91f5385e521e06312f50ee2db269e93932f08c385dbd7937d | none | TASK-DATASERVICE-007, TASK-DATASERVICE-014 | AC-DATASERVICE-001-S01, AC-DATASERVICE-002-S01, AC-DATASERVICE-003-S01, AC-DATASERVICE-004-S01, AC-DATASERVICE-005-S01, AC-DATASERVICE-006-S01, AC-DATASERVICE-008-S01, AC-DATASERVICE-013-S02, AC-DATASERVICE-021-S03, AC-DATASERVICE-023-S01, AC-DATASERVICE-023-S02, AC-DATASERVICE-023-S03, AC-DATASERVICE-024-S01, AC-DATASERVICE-024-S02 |  |  |  |
| REQ-DATASERVICE-178 | intent-8addc4c8639b855530ce28ae30ef72b7bf33f8c5718f3604814dcce0fde86aa1 | REQ-DATASERVICE-178 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-c0667c530923a0b818a4ab79f5a178d6930af9efa340381a51b2bb7218094b8f | none | TASK-DATASERVICE-007, TASK-DATASERVICE-014 | AC-DATASERVICE-001-S01, AC-DATASERVICE-002-S01, AC-DATASERVICE-003-S01, AC-DATASERVICE-004-S01, AC-DATASERVICE-005-S01, AC-DATASERVICE-006-S01, AC-DATASERVICE-008-S01, AC-DATASERVICE-013-S02, AC-DATASERVICE-021-S03, AC-DATASERVICE-023-S01, AC-DATASERVICE-023-S02, AC-DATASERVICE-023-S03, AC-DATASERVICE-024-S01, AC-DATASERVICE-024-S02 |  |  |  |
| REQ-DATASERVICE-179 | intent-86faddf2cd2af6516f029fd71cc981e559c1dd308bf356d49b2d420721238ce8 | REQ-DATASERVICE-179 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-179eed399bd499a3446ef89abfe31d57793a87e28aababf64444077d6184a4c8 | none | TASK-DATASERVICE-007, TASK-DATASERVICE-014 | AC-DATASERVICE-001-S01, AC-DATASERVICE-002-S01, AC-DATASERVICE-003-S01, AC-DATASERVICE-004-S01, AC-DATASERVICE-005-S01, AC-DATASERVICE-006-S01, AC-DATASERVICE-008-S01, AC-DATASERVICE-013-S02, AC-DATASERVICE-021-S03, AC-DATASERVICE-023-S01, AC-DATASERVICE-023-S02, AC-DATASERVICE-023-S03, AC-DATASERVICE-024-S01, AC-DATASERVICE-024-S02 |  |  |  |
| REQ-DATASERVICE-180 | intent-a1337d67fe15b32c8974027d3438f54ff77f0629e640ef0102e0b1326eedad4d | REQ-DATASERVICE-180 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-75e47db4682d485955782950ee443fcbfa6f91066de94bb478c9351ce460b335 | none | TASK-DATASERVICE-007, TASK-DATASERVICE-014 | AC-DATASERVICE-001-S01, AC-DATASERVICE-002-S01, AC-DATASERVICE-003-S01, AC-DATASERVICE-004-S01, AC-DATASERVICE-005-S01, AC-DATASERVICE-006-S01, AC-DATASERVICE-008-S01, AC-DATASERVICE-013-S02, AC-DATASERVICE-021-S03, AC-DATASERVICE-023-S01, AC-DATASERVICE-023-S02, AC-DATASERVICE-023-S03, AC-DATASERVICE-024-S01, AC-DATASERVICE-024-S02 |  |  |  |
| REQ-DATASERVICE-181 | intent-42aa8022627e474b41be0c0f29754ca25369c9d19598920369751b07462c0b63 | REQ-DATASERVICE-181 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-7517a4bf45744ae10b269790087edb5dd480248f5348d6a820a7109ecc475cb2 | none | TASK-DATASERVICE-007, TASK-DATASERVICE-014 | AC-DATASERVICE-001-S01, AC-DATASERVICE-002-S01, AC-DATASERVICE-003-S01, AC-DATASERVICE-004-S01, AC-DATASERVICE-005-S01, AC-DATASERVICE-006-S01, AC-DATASERVICE-008-S01, AC-DATASERVICE-013-S02, AC-DATASERVICE-021-S03, AC-DATASERVICE-023-S01, AC-DATASERVICE-023-S02, AC-DATASERVICE-023-S03, AC-DATASERVICE-024-S01, AC-DATASERVICE-024-S02 |  |  |  |
| REQ-DATASERVICE-182 | intent-28ba70a70f1965a7f400ff2bf6b63720df8ab7719beaddaa6614b6d354f25442 | REQ-DATASERVICE-182 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-f26d7a4b4c0e1d9ac8203cb47416b861f9450a1df1902952ac86fc41bc686410 | none | TASK-DATASERVICE-007, TASK-DATASERVICE-014 | AC-DATASERVICE-001-S01, AC-DATASERVICE-002-S01, AC-DATASERVICE-003-S01, AC-DATASERVICE-004-S01, AC-DATASERVICE-005-S01, AC-DATASERVICE-006-S01, AC-DATASERVICE-008-S01, AC-DATASERVICE-013-S02, AC-DATASERVICE-021-S03, AC-DATASERVICE-023-S01, AC-DATASERVICE-023-S02, AC-DATASERVICE-023-S03, AC-DATASERVICE-024-S01, AC-DATASERVICE-024-S02 |  |  |  |
| REQ-DATASERVICE-183 | intent-cfe9bb5f8d42dd5c3f2a4c6d3e7150647da99e4bea3990499c01912dda5dab40 | REQ-DATASERVICE-183 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-0255b1c3d367ac40c77e66d3382ac880d0f10be87f2822f4e1e386dac91bda61 | none | TASK-DATASERVICE-007, TASK-DATASERVICE-014 | AC-DATASERVICE-001-S01, AC-DATASERVICE-002-S01, AC-DATASERVICE-003-S01, AC-DATASERVICE-004-S01, AC-DATASERVICE-005-S01, AC-DATASERVICE-006-S01, AC-DATASERVICE-008-S01, AC-DATASERVICE-013-S02, AC-DATASERVICE-021-S03, AC-DATASERVICE-023-S01, AC-DATASERVICE-023-S02, AC-DATASERVICE-023-S03, AC-DATASERVICE-024-S01, AC-DATASERVICE-024-S02 |  |  |  |
| REQ-DATASERVICE-184 | intent-4c3593882a8bf30a32f696e4693dfeedd731c42615f1d6659401263ac80c9579 | REQ-DATASERVICE-184 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-c585254026f39bd02a5144f3bfcb8ba09d0e77ff16182c0a4586fd717b3384ff | none | TASK-DATASERVICE-007, TASK-DATASERVICE-014 | AC-DATASERVICE-001-S01, AC-DATASERVICE-002-S01, AC-DATASERVICE-003-S01, AC-DATASERVICE-004-S01, AC-DATASERVICE-005-S01, AC-DATASERVICE-006-S01, AC-DATASERVICE-008-S01, AC-DATASERVICE-013-S02, AC-DATASERVICE-021-S03, AC-DATASERVICE-023-S01, AC-DATASERVICE-023-S02, AC-DATASERVICE-023-S03, AC-DATASERVICE-024-S01, AC-DATASERVICE-024-S02 |  |  |  |
| REQ-DATASERVICE-185 | intent-cb33662239749ab213ca716a3bc5411f46508ec58d167409ef2eb444cb338b26 | REQ-DATASERVICE-185 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-064872d262195a7fdddee5e556e0236b25574daa5b0ae616eef6df4c4bec4a05 | none | TASK-DATASERVICE-007, TASK-DATASERVICE-014 | AC-DATASERVICE-001-S01, AC-DATASERVICE-002-S01, AC-DATASERVICE-003-S01, AC-DATASERVICE-004-S01, AC-DATASERVICE-005-S01, AC-DATASERVICE-006-S01, AC-DATASERVICE-008-S01, AC-DATASERVICE-013-S02, AC-DATASERVICE-021-S03, AC-DATASERVICE-023-S01, AC-DATASERVICE-023-S02, AC-DATASERVICE-023-S03, AC-DATASERVICE-024-S01, AC-DATASERVICE-024-S02 |  |  |  |
| REQ-DATASERVICE-186 | intent-35e42a938d249d3ac55e34cd1aeff054c209b78234a1db7b0f61525e6d957dae | REQ-DATASERVICE-186 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-0b73686f066eea536f77e57b274eabffdae6ebb5356240aa1213e994734ed4e3 | none | TASK-DATASERVICE-007, TASK-DATASERVICE-014 | AC-DATASERVICE-001-S01, AC-DATASERVICE-002-S01, AC-DATASERVICE-003-S01, AC-DATASERVICE-004-S01, AC-DATASERVICE-005-S01, AC-DATASERVICE-006-S01, AC-DATASERVICE-008-S01, AC-DATASERVICE-013-S02, AC-DATASERVICE-021-S03, AC-DATASERVICE-023-S01, AC-DATASERVICE-023-S02, AC-DATASERVICE-023-S03, AC-DATASERVICE-024-S01, AC-DATASERVICE-024-S02 |  |  |  |
| REQ-DATASERVICE-187 | intent-14ca66576545118407688c3259ad3035cbfb7aea38ef783cb5d0f30ee6417c39 | REQ-DATASERVICE-187 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-e2bd41821a1d90f9fd15d3e497a3ff2f0b5be5425dd8f231c0591e2150a1409e | none | TASK-DATASERVICE-007, TASK-DATASERVICE-014 | AC-DATASERVICE-001-S01, AC-DATASERVICE-002-S01, AC-DATASERVICE-003-S01, AC-DATASERVICE-004-S01, AC-DATASERVICE-005-S01, AC-DATASERVICE-006-S01, AC-DATASERVICE-008-S01, AC-DATASERVICE-013-S02, AC-DATASERVICE-021-S03, AC-DATASERVICE-023-S01, AC-DATASERVICE-023-S02, AC-DATASERVICE-023-S03, AC-DATASERVICE-024-S01, AC-DATASERVICE-024-S02 |  |  |  |
| REQ-DATASERVICE-188 | intent-ffc826405bced0d834534a2e925ff51783ce6afe2a9d987fd6146401bd67aae1 | REQ-DATASERVICE-188 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-263b5e094b994fdd518773ed07e442b5963744d1811494f7f5d303e5a6525753 | none | TASK-DATASERVICE-007, TASK-DATASERVICE-014 | AC-DATASERVICE-001-S01, AC-DATASERVICE-002-S01, AC-DATASERVICE-003-S01, AC-DATASERVICE-004-S01, AC-DATASERVICE-005-S01, AC-DATASERVICE-006-S01, AC-DATASERVICE-008-S01, AC-DATASERVICE-013-S02, AC-DATASERVICE-021-S03, AC-DATASERVICE-023-S01, AC-DATASERVICE-023-S02, AC-DATASERVICE-023-S03, AC-DATASERVICE-024-S01, AC-DATASERVICE-024-S02 |  |  |  |
| REQ-DATASERVICE-189 | intent-9bc8ada4322e52abbe53241a4b12f555eb59c8118e1e8c2b383d4e0de888e158 | REQ-DATASERVICE-189 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-b86a3f3252bffbb728f41c4f1ef01a5af0e4d8b3929b320fba7079e2fdac10d6 | none | TASK-DATASERVICE-007, TASK-DATASERVICE-014 | AC-DATASERVICE-001-S01, AC-DATASERVICE-002-S01, AC-DATASERVICE-003-S01, AC-DATASERVICE-004-S01, AC-DATASERVICE-005-S01, AC-DATASERVICE-006-S01, AC-DATASERVICE-008-S01, AC-DATASERVICE-013-S02, AC-DATASERVICE-021-S03, AC-DATASERVICE-023-S01, AC-DATASERVICE-023-S02, AC-DATASERVICE-023-S03, AC-DATASERVICE-024-S01, AC-DATASERVICE-024-S02 |  |  |  |
| REQ-DATASERVICE-190 | intent-e19ced00501d968691852716ab10da1c4ab76c8065f55007a1181077f4113efc | REQ-DATASERVICE-190 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-684f08461e4a13bb52f81f7bf380c0214caa93d97f1586174cdd05d1f024e5b6 | none | TASK-DATASERVICE-007, TASK-DATASERVICE-014 | AC-DATASERVICE-001-S01, AC-DATASERVICE-002-S01, AC-DATASERVICE-003-S01, AC-DATASERVICE-004-S01, AC-DATASERVICE-005-S01, AC-DATASERVICE-006-S01, AC-DATASERVICE-008-S01, AC-DATASERVICE-013-S02, AC-DATASERVICE-021-S03, AC-DATASERVICE-023-S01, AC-DATASERVICE-023-S02, AC-DATASERVICE-023-S03, AC-DATASERVICE-024-S01, AC-DATASERVICE-024-S02 |  |  |  |
| REQ-DATASERVICE-191 | intent-0050546270cab4baf4a72926c29f302c32e639f27952b6cf6a9d8969308e5a72 | REQ-DATASERVICE-191 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-f359ead570c4f603e06ef3e5e000a320fb3c9f608a62fb9a9321b8d808c56438 | none | TASK-DATASERVICE-007, TASK-DATASERVICE-014 | AC-DATASERVICE-001-S01, AC-DATASERVICE-002-S01, AC-DATASERVICE-003-S01, AC-DATASERVICE-004-S01, AC-DATASERVICE-005-S01, AC-DATASERVICE-006-S01, AC-DATASERVICE-008-S01, AC-DATASERVICE-013-S02, AC-DATASERVICE-021-S03, AC-DATASERVICE-023-S01, AC-DATASERVICE-023-S02, AC-DATASERVICE-023-S03, AC-DATASERVICE-024-S01, AC-DATASERVICE-024-S02 |  |  |  |
| REQ-DATASERVICE-192 | intent-8c4cc5754716f9ebb0afa365591dc1565aa28d6301f3ab1fdea5e1f1c8266074 | REQ-DATASERVICE-192 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-dca3c4250be9dd15aa32faa311093dfc8914c48ff4fdb3dda7f96a36b7f1578c | none | TASK-DATASERVICE-007, TASK-DATASERVICE-014 | AC-DATASERVICE-001-S01, AC-DATASERVICE-002-S01, AC-DATASERVICE-003-S01, AC-DATASERVICE-004-S01, AC-DATASERVICE-005-S01, AC-DATASERVICE-006-S01, AC-DATASERVICE-008-S01, AC-DATASERVICE-013-S02, AC-DATASERVICE-021-S03, AC-DATASERVICE-023-S01, AC-DATASERVICE-023-S02, AC-DATASERVICE-023-S03, AC-DATASERVICE-024-S01, AC-DATASERVICE-024-S02 |  |  |  |
| REQ-DATASERVICE-193 | intent-a26d8084a0befc564ee52421e0d7c7d4211540831c4f9365809f6ccf2e44740b | REQ-DATASERVICE-193 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-1e29d90704561375fc3499bfc420bccf6e036a7fa803738136c7cd24b873ac48 | none | TASK-DATASERVICE-007, TASK-DATASERVICE-014 | AC-DATASERVICE-001-S01, AC-DATASERVICE-002-S01, AC-DATASERVICE-003-S01, AC-DATASERVICE-004-S01, AC-DATASERVICE-005-S01, AC-DATASERVICE-006-S01, AC-DATASERVICE-008-S01, AC-DATASERVICE-013-S02, AC-DATASERVICE-021-S03, AC-DATASERVICE-023-S01, AC-DATASERVICE-023-S02, AC-DATASERVICE-023-S03, AC-DATASERVICE-024-S01, AC-DATASERVICE-024-S02 |  |  |  |
| REQ-DATASERVICE-194 | intent-2c259846a98a65648c7fe1ac94124fd245c9270a4092392340dc84636329e0a7 | REQ-DATASERVICE-194 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-ed83943e5c0d1e7a21da714d7f1e206940b97bb732e5fbd35b36d42f78b38a39 | none | TASK-DATASERVICE-007, TASK-DATASERVICE-014 | AC-DATASERVICE-001-S01, AC-DATASERVICE-002-S01, AC-DATASERVICE-003-S01, AC-DATASERVICE-004-S01, AC-DATASERVICE-005-S01, AC-DATASERVICE-006-S01, AC-DATASERVICE-008-S01, AC-DATASERVICE-013-S02, AC-DATASERVICE-021-S03, AC-DATASERVICE-023-S01, AC-DATASERVICE-023-S02, AC-DATASERVICE-023-S03, AC-DATASERVICE-024-S01, AC-DATASERVICE-024-S02 |  |  |  |
| REQ-DATASERVICE-195 | intent-489d4d3a494c035b97a17691c4f569bf7809a44dc606eeb87821a751a3b5df20 | REQ-DATASERVICE-195 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-1505db747f8fca1425394648f16e86a5233d877959c96347d451cce31b8b5647 | none | TASK-DATASERVICE-007, TASK-DATASERVICE-014 | AC-DATASERVICE-001-S01, AC-DATASERVICE-002-S01, AC-DATASERVICE-003-S01, AC-DATASERVICE-004-S01, AC-DATASERVICE-005-S01, AC-DATASERVICE-006-S01, AC-DATASERVICE-008-S01, AC-DATASERVICE-013-S02, AC-DATASERVICE-021-S03, AC-DATASERVICE-023-S01, AC-DATASERVICE-023-S02, AC-DATASERVICE-023-S03, AC-DATASERVICE-024-S01, AC-DATASERVICE-024-S02 |  |  |  |
| REQ-DATASERVICE-196 | intent-7ada442acf01680a96eabc091558168b6a7ba6b33508fb49edf55cd27cdb19b2 | REQ-DATASERVICE-196 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-157834020e14636757241735255d690e8316edf50c9aa4d7ea6e676eb45bac22 | none | TASK-DATASERVICE-007, TASK-DATASERVICE-014 | AC-DATASERVICE-001-S01, AC-DATASERVICE-002-S01, AC-DATASERVICE-003-S01, AC-DATASERVICE-004-S01, AC-DATASERVICE-005-S01, AC-DATASERVICE-006-S01, AC-DATASERVICE-008-S01, AC-DATASERVICE-013-S02, AC-DATASERVICE-021-S03, AC-DATASERVICE-023-S01, AC-DATASERVICE-023-S02, AC-DATASERVICE-023-S03, AC-DATASERVICE-024-S01, AC-DATASERVICE-024-S02 |  |  |  |
| REQ-DATASERVICE-197 | intent-7684b052bb91aa2ce26b927761c78479090be43dedeb719a117db59b5946ac26 | REQ-DATASERVICE-197 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-a92573b6c614c359ff751ef80867caed0acf15941e92b9758c545ea814c1dec4 | none | TASK-DATASERVICE-010, TASK-DATASERVICE-011 | AC-DATASERVICE-002-S01, AC-DATASERVICE-014-S01, AC-DATASERVICE-015-S01, AC-DATASERVICE-016-S01, AC-DATASERVICE-016-S02, AC-DATASERVICE-016-S03, AC-DATASERVICE-016-S04, AC-DATASERVICE-021-S01, AC-DATASERVICE-021-S03, AC-DATASERVICE-024-S02, AC-DATASERVICE-024-S03 |  |  |  |
| REQ-DATASERVICE-198 | intent-2f59982d6a084fd57a1dbdf800933c09058295b80d427a83ffbc6dee4c80e432 | REQ-DATASERVICE-198 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-e1cd69d57d671d0924fcaa449d364c77c99003dd4cc2fcba900ae569932d895f | none | TASK-DATASERVICE-010, TASK-DATASERVICE-011 | AC-DATASERVICE-002-S01, AC-DATASERVICE-014-S01, AC-DATASERVICE-015-S01, AC-DATASERVICE-016-S01, AC-DATASERVICE-016-S02, AC-DATASERVICE-016-S03, AC-DATASERVICE-016-S04, AC-DATASERVICE-021-S01, AC-DATASERVICE-021-S03, AC-DATASERVICE-024-S02, AC-DATASERVICE-024-S03 |  |  |  |
| REQ-DATASERVICE-199 | intent-1f184bdf0cd0e16ac9a595fb1ed2827346a4057b34d76c6586a465ccb06ad244 | REQ-DATASERVICE-199 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-e21459e99d9dc9144c8156ecbeea5ccef01226b7b17a8510d320b31ea1536889 | none | TASK-DATASERVICE-010, TASK-DATASERVICE-011 | AC-DATASERVICE-002-S01, AC-DATASERVICE-014-S01, AC-DATASERVICE-015-S01, AC-DATASERVICE-016-S01, AC-DATASERVICE-016-S02, AC-DATASERVICE-016-S03, AC-DATASERVICE-016-S04, AC-DATASERVICE-021-S01, AC-DATASERVICE-021-S03, AC-DATASERVICE-024-S02, AC-DATASERVICE-024-S03 |  |  |  |
| REQ-DATASERVICE-200 | intent-cc179a63e9ac77737f7ec1c06e22a64cfa1ee4584c791f08cabd473e8277f0a1 | REQ-DATASERVICE-200 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-93cd2a5ae856fec04b73d7aa9822fdc3789fc0e384ff5e006684ad8a19b71ebc | none | TASK-DATASERVICE-010, TASK-DATASERVICE-011 | AC-DATASERVICE-002-S01, AC-DATASERVICE-014-S01, AC-DATASERVICE-015-S01, AC-DATASERVICE-016-S01, AC-DATASERVICE-016-S02, AC-DATASERVICE-016-S03, AC-DATASERVICE-016-S04, AC-DATASERVICE-021-S01, AC-DATASERVICE-021-S03, AC-DATASERVICE-024-S02, AC-DATASERVICE-024-S03 |  |  |  |
| REQ-DATASERVICE-201 | intent-e907d2f4b343da44e65a17c76f15271f7fa031371a38f967e0b4720a7750487b | REQ-DATASERVICE-201 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-187a51b50da9e96ffec04b43b6de4994492ada0fc0265a69ec5a8a82e736c4bc | none | TASK-DATASERVICE-010, TASK-DATASERVICE-011 | AC-DATASERVICE-002-S01, AC-DATASERVICE-014-S01, AC-DATASERVICE-015-S01, AC-DATASERVICE-016-S01, AC-DATASERVICE-016-S02, AC-DATASERVICE-016-S03, AC-DATASERVICE-016-S04, AC-DATASERVICE-021-S01, AC-DATASERVICE-021-S03, AC-DATASERVICE-024-S02, AC-DATASERVICE-024-S03 |  |  |  |
| REQ-DATASERVICE-202 | intent-85425c99600e106aa6657b0f6d5351d70801dcf41459d096f8898bbec518dd96 | REQ-DATASERVICE-202 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-91f47ec3e13876afdc61440f1d2ce431b62dfc0acc1688aa2ab9feae39d9fa57 | none | TASK-DATASERVICE-010, TASK-DATASERVICE-011 | AC-DATASERVICE-002-S01, AC-DATASERVICE-014-S01, AC-DATASERVICE-015-S01, AC-DATASERVICE-016-S01, AC-DATASERVICE-016-S02, AC-DATASERVICE-016-S03, AC-DATASERVICE-016-S04, AC-DATASERVICE-021-S01, AC-DATASERVICE-021-S03, AC-DATASERVICE-024-S02, AC-DATASERVICE-024-S03 |  |  |  |
| REQ-DATASERVICE-203 | intent-6113f6de218b8890dc489880cdb76a8ebb7acd20c92bc7f72cd7b1044848f5da | REQ-DATASERVICE-203 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-d604413740f468fb92993b93458e68df4140d3139d4e339d45a221d3f2b16988 | none | TASK-DATASERVICE-010, TASK-DATASERVICE-011 | AC-DATASERVICE-002-S01, AC-DATASERVICE-014-S01, AC-DATASERVICE-015-S01, AC-DATASERVICE-016-S01, AC-DATASERVICE-016-S02, AC-DATASERVICE-016-S03, AC-DATASERVICE-016-S04, AC-DATASERVICE-021-S01, AC-DATASERVICE-021-S03, AC-DATASERVICE-024-S02, AC-DATASERVICE-024-S03 |  |  |  |
| REQ-DATASERVICE-204 | intent-8f5cabd284574a7b3ce30bb019453a54bdb0b6a832536e1c7f6c9c13d8f0ad5a | REQ-DATASERVICE-204 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-bf68404172f7024cccd1372420601bea901014bca5a44866bf86897b23f3d7d4 | none | TASK-DATASERVICE-010, TASK-DATASERVICE-011 | AC-DATASERVICE-002-S01, AC-DATASERVICE-014-S01, AC-DATASERVICE-015-S01, AC-DATASERVICE-016-S01, AC-DATASERVICE-016-S02, AC-DATASERVICE-016-S03, AC-DATASERVICE-016-S04, AC-DATASERVICE-021-S01, AC-DATASERVICE-021-S03, AC-DATASERVICE-024-S02, AC-DATASERVICE-024-S03 |  |  |  |
| REQ-DATASERVICE-205 | intent-71699ce6e4f53c05b4150d396bd5083b16973c9c097dd64815984c17e8296d5d | REQ-DATASERVICE-205 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-5db6d93e0b92691b54d3a94b76e0afaff13409852a8f89d7aa2da07ee130859f | none | TASK-DATASERVICE-010, TASK-DATASERVICE-011 | AC-DATASERVICE-002-S01, AC-DATASERVICE-014-S01, AC-DATASERVICE-015-S01, AC-DATASERVICE-016-S01, AC-DATASERVICE-016-S02, AC-DATASERVICE-016-S03, AC-DATASERVICE-016-S04, AC-DATASERVICE-021-S01, AC-DATASERVICE-021-S03, AC-DATASERVICE-024-S02, AC-DATASERVICE-024-S03 |  |  |  |
| REQ-DATASERVICE-206 | intent-13d503ccbd15c30d3257fdc3b92f9f1bcffd4feb13d9dc20fe5c3aa08f87b02f | REQ-DATASERVICE-206 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-1f44a75c692927d2a18e270137efeda164cd73b4d3766a2ffede6ad80d9d29fa | none | TASK-DATASERVICE-010, TASK-DATASERVICE-011 | AC-DATASERVICE-002-S01, AC-DATASERVICE-014-S01, AC-DATASERVICE-015-S01, AC-DATASERVICE-016-S01, AC-DATASERVICE-016-S02, AC-DATASERVICE-016-S03, AC-DATASERVICE-016-S04, AC-DATASERVICE-021-S01, AC-DATASERVICE-021-S03, AC-DATASERVICE-024-S02, AC-DATASERVICE-024-S03 |  |  |  |
| REQ-DATASERVICE-207 | intent-065201e40ff91d0c937fd12c494a02268da706436e20d4ecf97eded39a2070ec | REQ-DATASERVICE-207 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-01276612c77724cf68b79b8f1cb43e732c0991ab6ad1893f239fd72c6d4647d0 | none | TASK-DATASERVICE-010, TASK-DATASERVICE-011 | AC-DATASERVICE-002-S01, AC-DATASERVICE-014-S01, AC-DATASERVICE-015-S01, AC-DATASERVICE-016-S01, AC-DATASERVICE-016-S02, AC-DATASERVICE-016-S03, AC-DATASERVICE-016-S04, AC-DATASERVICE-021-S01, AC-DATASERVICE-021-S03, AC-DATASERVICE-024-S02, AC-DATASERVICE-024-S03 |  |  |  |
| REQ-DATASERVICE-208 | intent-3345d8f23cc7d57d692a78e6158debde90298fb8032549da6a1913308ace65a5 | REQ-DATASERVICE-208 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-2fd932bcd2e5d3a259a30a60fe76613199a1f28dc529b4717f35c4cdde6c8d3e | none | TASK-DATASERVICE-010, TASK-DATASERVICE-011 | AC-DATASERVICE-002-S01, AC-DATASERVICE-014-S01, AC-DATASERVICE-015-S01, AC-DATASERVICE-016-S01, AC-DATASERVICE-016-S02, AC-DATASERVICE-016-S03, AC-DATASERVICE-016-S04, AC-DATASERVICE-021-S01, AC-DATASERVICE-021-S03, AC-DATASERVICE-024-S02, AC-DATASERVICE-024-S03 |  |  |  |
| REQ-DATASERVICE-209 | intent-706bf9c8e63a36f96dc9982328f1751496a5a66964b7a33c12280f981af26fc5 | REQ-DATASERVICE-209 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-cc914ef396c749d70297eb1dc13c52b6b647ff81878e7cc83c496c34a280ddf0 | none | TASK-DATASERVICE-010, TASK-DATASERVICE-011 | AC-DATASERVICE-002-S01, AC-DATASERVICE-014-S01, AC-DATASERVICE-015-S01, AC-DATASERVICE-016-S01, AC-DATASERVICE-016-S02, AC-DATASERVICE-016-S03, AC-DATASERVICE-016-S04, AC-DATASERVICE-021-S01, AC-DATASERVICE-021-S03, AC-DATASERVICE-024-S02, AC-DATASERVICE-024-S03 |  |  |  |
| REQ-DATASERVICE-210 | intent-139b31d4198006177eec07195cfe0ec6b4dc37490eabbaedf545a6b6217ab3c1 | REQ-DATASERVICE-210 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-807e606cfb1e7fc1246d26aeda6368d55a4d228282d82cbce72e7839c48b195b | none | TASK-DATASERVICE-010, TASK-DATASERVICE-011 | AC-DATASERVICE-002-S01, AC-DATASERVICE-014-S01, AC-DATASERVICE-015-S01, AC-DATASERVICE-016-S01, AC-DATASERVICE-016-S02, AC-DATASERVICE-016-S03, AC-DATASERVICE-016-S04, AC-DATASERVICE-021-S01, AC-DATASERVICE-021-S03, AC-DATASERVICE-024-S02, AC-DATASERVICE-024-S03 |  |  |  |
| REQ-DATASERVICE-211 | intent-170971fdf54c224e6d017ee2e857b776785ac8ddffc08121619520c4291a1efb | REQ-DATASERVICE-211 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-8ab4bc792cf20aad887899815e9d2debb91866785154f48850975813fdfa646c | none | TASK-DATASERVICE-015 |  |  |  |  |
| REQ-DATASERVICE-212 | intent-23acf2a4de695fa2b546a32b4a37682c99be084bfbe7beebee855406b012044b | REQ-DATASERVICE-212 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-8107103b9fb271001c24803f9d1c0d02a08426035ba0e69ac29507ebce024c8f | none | TASK-DATASERVICE-015 |  |  |  |  |
| NEG-DATASERVICE-015 | intent-06888f202ada8f396b5b59dd3d9da6fcdd99d820c730b72a3146372290df014a | NEG-DATASERVICE-015 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-279603010fa6f4ab10fe7fc1ec6cd642cf6d21e5a4d1494ce0ace8fa4eed9137 | none | TASK-DATASERVICE-015 |  |  |  |  |
| REQ-DATASERVICE-213 | intent-b0fd6eceb4efbe4c766880c13fd377f711d915e756b39bcaf83d384a2b44097b | REQ-DATASERVICE-213 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-2686a0b4a3f8b692c3ec3ccdfcc7447b0ecd6dea1ed36b72a7d71d7648f2361a | none | TASK-DATASERVICE-015 |  |  |  |  |
| REQ-DATASERVICE-214 | intent-781faba1b1bc683b4d9e973318dcbe5416903575e7c83114b9aaf83e8dbc808d | REQ-DATASERVICE-214 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-6eeb0e22ed2ee592f675da2b00bc20ebdeccefae8facb3b8faf55060583586a0 | none | TASK-DATASERVICE-015 |  |  |  |  |
| REQ-DATASERVICE-215 | intent-5763f529a60347a5def77dcc6621eb4e38fa64db1fa42549bfcf47196bf48ae4 | REQ-DATASERVICE-215 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-896ee7b64ba8d1975641483d40959c4d5bd969473044d80c209d9070745d53b7 | none | TASK-DATASERVICE-015 |  |  |  |  |
| NEG-DATASERVICE-016 | intent-628fcd4363267d196959de72931b83e1be3cdbb06f8576c4404f5e4bb0bf60c3 | NEG-DATASERVICE-016 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-327339d4778a9ce74f3154745dc55771fc1c6fa42357ec37395245d691f866e9 | none | TASK-DATASERVICE-015 |  |  |  |  |
| REQ-DATASERVICE-216 | intent-0943571529125b3a18b837c9a4b0489a6c24df90d38164f192db1294184a580a | REQ-DATASERVICE-216 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-2fbadcb63ad6333925aa08ead29d62200bb741cdf962a404dd98fffdbb717559 | none | TASK-DATASERVICE-015 |  |  |  |  |
| REQ-DATASERVICE-217 | intent-4dfcf5dcf503d27ba379d0b88fd907f0bad0ebc12c65d53cdade1f9eeaa57ff7 | REQ-DATASERVICE-217 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-8f307f90be41d5985b5b61d69637c285239c177be356c5c34338b16e8ee4a28b | none | TASK-DATASERVICE-015 |  |  |  |  |
| REQ-DATASERVICE-218 | intent-4e60e70ca846646d4cfd02c3fee13ab88168c41c1d2e126bfe08d4ffd0fba2f9 | REQ-DATASERVICE-218 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-58a4021c188131981af263d48d8368168218f5d6345aa6a1ed4872b5c291c1ea | none | TASK-DATASERVICE-015 |  |  |  |  |
| REQ-DATASERVICE-219 | intent-760510110e31545f2f087b40055aae17b51e14492872fda15f9a4144fbe0ff23 | REQ-DATASERVICE-219 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-fbec631819a50072322577ac9e6af878d216dcd98c51cbfbaee7a6e0f7b619b5 | none | TASK-DATASERVICE-015 |  |  |  |  |
| REQ-DATASERVICE-220 | intent-c026e5cb991e4777d4a80d4d48293c4424a9e8bc39696447c6b40584e0aecd42 | REQ-DATASERVICE-220 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-ff9a0ba53718091fc3b711c6a36273e11646a9baabe557c20b1c9a34e70a9646 | none | TASK-DATASERVICE-015 |  |  |  |  |
| REQ-DATASERVICE-221 | intent-aed1301de2eeb19b2ee0d123585102be78e75221117516cf70c7bbb45c03845d | REQ-DATASERVICE-221 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-bbdd780f443ff41589567b0a10f5ba25b382cad42f7f155387057a5ecbdbd752 | none | TASK-DATASERVICE-015 |  |  |  |  |
| REQ-DATASERVICE-222 | intent-9f0f1a1ec134b94e4aebbd4c3d7da270db7affb5a0bfd139b5292ff0fd04fe5e | REQ-DATASERVICE-222 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-0f6745ed63d05f2ffe54ac8f0de0be5ad4e688edcedae1431ffb4b4958b4eff3 | none | TASK-DATASERVICE-015 |  |  |  |  |
| REQ-DATASERVICE-223 | intent-ea72df7ee834c84713509855a8d8a8eba018db2d36d2c1c244c478106391faad | REQ-DATASERVICE-223 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-55f46234bfd2710f5afe839e58d2f534935d6afb630892995d56331508be4899 | none | TASK-DATASERVICE-003, TASK-DATASERVICE-004, TASK-DATASERVICE-012, TASK-DATASERVICE-013 | AC-DATASERVICE-006-S01, AC-DATASERVICE-007-S01, AC-DATASERVICE-009-S01, AC-DATASERVICE-009-S02, AC-DATASERVICE-010-S01, AC-DATASERVICE-017-S01, AC-DATASERVICE-018-S01, AC-DATASERVICE-019-S01, AC-DATASERVICE-020-S01, AC-DATASERVICE-020-S02, AC-DATASERVICE-020-S03, AC-DATASERVICE-020-S04, AC-DATASERVICE-021-S01, AC-DATASERVICE-021-S02, AC-DATASERVICE-021-S03, AC-DATASERVICE-022-S01, AC-DATASERVICE-022-S02 |  |  |  |
| REQ-DATASERVICE-224 | intent-ec01352ba2ce39ba623ee238050b0dec94470a5a9916e06eaaa71e7c81f2fde5 | REQ-DATASERVICE-224 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-e446f63db386671cf65cc714cd1c6ea74ba6523f7ff88472fb0b897f71c8a17a | none | TASK-DATASERVICE-003, TASK-DATASERVICE-004, TASK-DATASERVICE-012, TASK-DATASERVICE-013 | AC-DATASERVICE-006-S01, AC-DATASERVICE-007-S01, AC-DATASERVICE-009-S01, AC-DATASERVICE-009-S02, AC-DATASERVICE-010-S01, AC-DATASERVICE-017-S01, AC-DATASERVICE-018-S01, AC-DATASERVICE-019-S01, AC-DATASERVICE-020-S01, AC-DATASERVICE-020-S02, AC-DATASERVICE-020-S03, AC-DATASERVICE-020-S04, AC-DATASERVICE-021-S01, AC-DATASERVICE-021-S02, AC-DATASERVICE-021-S03, AC-DATASERVICE-022-S01, AC-DATASERVICE-022-S02 |  |  |  |
| NEG-DATASERVICE-017 | intent-bdee699ef1646837daea4fa27e0f3179f3cc8484154903f84fda9ad82aa2f034 | NEG-DATASERVICE-017 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-aac7cb8dbc5487b549b64b000ff761a41affcd54011157364ceea964ecca04b2 | none | TASK-DATASERVICE-003, TASK-DATASERVICE-004, TASK-DATASERVICE-012, TASK-DATASERVICE-013 | AC-DATASERVICE-006-S01, AC-DATASERVICE-007-S01, AC-DATASERVICE-009-S01, AC-DATASERVICE-009-S02, AC-DATASERVICE-010-S01, AC-DATASERVICE-017-S01, AC-DATASERVICE-018-S01, AC-DATASERVICE-019-S01, AC-DATASERVICE-020-S01, AC-DATASERVICE-020-S02, AC-DATASERVICE-020-S03, AC-DATASERVICE-020-S04, AC-DATASERVICE-021-S01, AC-DATASERVICE-021-S02, AC-DATASERVICE-021-S03, AC-DATASERVICE-022-S01, AC-DATASERVICE-022-S02 |  |  |  |
| REQ-DATASERVICE-225 | intent-2bb1e2ba14ecc3ed49ed8df8b3661b692c0fad7b089e190ebf631bc85415e1a5 | REQ-DATASERVICE-225 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-8eae58d22c096e6a549b0b3383486ca6b9f096aa27241b04f84e6893b8f16b64 | none | TASK-DATASERVICE-003, TASK-DATASERVICE-004, TASK-DATASERVICE-012, TASK-DATASERVICE-013 | AC-DATASERVICE-006-S01, AC-DATASERVICE-007-S01, AC-DATASERVICE-009-S01, AC-DATASERVICE-009-S02, AC-DATASERVICE-010-S01, AC-DATASERVICE-017-S01, AC-DATASERVICE-018-S01, AC-DATASERVICE-019-S01, AC-DATASERVICE-020-S01, AC-DATASERVICE-020-S02, AC-DATASERVICE-020-S03, AC-DATASERVICE-020-S04, AC-DATASERVICE-021-S01, AC-DATASERVICE-021-S02, AC-DATASERVICE-021-S03, AC-DATASERVICE-022-S01, AC-DATASERVICE-022-S02 |  |  |  |
| REQ-DATASERVICE-226 | intent-6b429df30007d7b11fd47a75ce94409261784a99a52467a2d25d591008a84f3c | REQ-DATASERVICE-226 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-88bd266efb86497611dd5470dd74b38e99732ff7cece05598d9c676ee16ce97c | none | TASK-DATASERVICE-003, TASK-DATASERVICE-004, TASK-DATASERVICE-012, TASK-DATASERVICE-013 | AC-DATASERVICE-006-S01, AC-DATASERVICE-007-S01, AC-DATASERVICE-009-S01, AC-DATASERVICE-009-S02, AC-DATASERVICE-010-S01, AC-DATASERVICE-017-S01, AC-DATASERVICE-018-S01, AC-DATASERVICE-019-S01, AC-DATASERVICE-020-S01, AC-DATASERVICE-020-S02, AC-DATASERVICE-020-S03, AC-DATASERVICE-020-S04, AC-DATASERVICE-021-S01, AC-DATASERVICE-021-S02, AC-DATASERVICE-021-S03, AC-DATASERVICE-022-S01, AC-DATASERVICE-022-S02 |  |  |  |
| REQ-DATASERVICE-227 | intent-0d886351175a9eed26ad3b333723227b75beedde6cf496624cddba4bb969c156 | REQ-DATASERVICE-227 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-916c92394fb5a3ed110d50115c83b088ca2be7073113f0ab63fa33afae7a311c | none | TASK-DATASERVICE-003, TASK-DATASERVICE-004, TASK-DATASERVICE-012, TASK-DATASERVICE-013 | AC-DATASERVICE-006-S01, AC-DATASERVICE-007-S01, AC-DATASERVICE-009-S01, AC-DATASERVICE-009-S02, AC-DATASERVICE-010-S01, AC-DATASERVICE-017-S01, AC-DATASERVICE-018-S01, AC-DATASERVICE-019-S01, AC-DATASERVICE-020-S01, AC-DATASERVICE-020-S02, AC-DATASERVICE-020-S03, AC-DATASERVICE-020-S04, AC-DATASERVICE-021-S01, AC-DATASERVICE-021-S02, AC-DATASERVICE-021-S03, AC-DATASERVICE-022-S01, AC-DATASERVICE-022-S02 |  |  |  |
| REQ-DATASERVICE-228 | intent-46c1e8546e8456aa81b2ece33cc3c3656ca3aeafea6b59f0527a977c4e81ba09 | REQ-DATASERVICE-228 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-2f462a9e89615f8c503a6df68916705f5fe7862864d4707800f05aa0d24547eb | none | TASK-DATASERVICE-003, TASK-DATASERVICE-004, TASK-DATASERVICE-012, TASK-DATASERVICE-013 | AC-DATASERVICE-006-S01, AC-DATASERVICE-007-S01, AC-DATASERVICE-009-S01, AC-DATASERVICE-009-S02, AC-DATASERVICE-010-S01, AC-DATASERVICE-017-S01, AC-DATASERVICE-018-S01, AC-DATASERVICE-019-S01, AC-DATASERVICE-020-S01, AC-DATASERVICE-020-S02, AC-DATASERVICE-020-S03, AC-DATASERVICE-020-S04, AC-DATASERVICE-021-S01, AC-DATASERVICE-021-S02, AC-DATASERVICE-021-S03, AC-DATASERVICE-022-S01, AC-DATASERVICE-022-S02 |  |  |  |
| REQ-DATASERVICE-229 | intent-8e47082cf8bd65a3e8badef675820be5c6a124f5195c4e3362df206bc91f8914 | REQ-DATASERVICE-229 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-c5bb553ce0b79ffb99bb17d42b7b471bc39ff1495667b426c1657d0bfc6ac5fb | none | TASK-DATASERVICE-003, TASK-DATASERVICE-004, TASK-DATASERVICE-012, TASK-DATASERVICE-013 | AC-DATASERVICE-006-S01, AC-DATASERVICE-007-S01, AC-DATASERVICE-009-S01, AC-DATASERVICE-009-S02, AC-DATASERVICE-010-S01, AC-DATASERVICE-017-S01, AC-DATASERVICE-018-S01, AC-DATASERVICE-019-S01, AC-DATASERVICE-020-S01, AC-DATASERVICE-020-S02, AC-DATASERVICE-020-S03, AC-DATASERVICE-020-S04, AC-DATASERVICE-021-S01, AC-DATASERVICE-021-S02, AC-DATASERVICE-021-S03, AC-DATASERVICE-022-S01, AC-DATASERVICE-022-S02 |  |  |  |
| TASK-DATASERVICE-001 | intent-0ac6e23372214c7273b13bfb9edd7dfc9ab1c54fca49b600abceb2f71388d961 | TASK-DATASERVICE-001 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-c5f0d4417acce8098ce75dea9e2e4c74ba0aad8ef0221c0f763aa40056c0a8d6 | none | TASK-DATASERVICE-001 | AC-DATASERVICE-009-S01, AC-DATASERVICE-009-S02, AC-DATASERVICE-011-S01, AC-DATASERVICE-012-S01, AC-DATASERVICE-015-S01, AC-DATASERVICE-017-S01, AC-DATASERVICE-018-S01, AC-DATASERVICE-019-S01, AC-DATASERVICE-022-S01, AC-DATASERVICE-022-S02 | CMD-DATASERVICE-045, CMD-DATASERVICE-046, CMD-DATASERVICE-047 | EVD-DATASERVICE-001 |  |
| TASK-DATASERVICE-002 | intent-a003776cde857f44c63f5c1274ec4bcc2224fcde4577c409d8a5efdd2c50e01d | TASK-DATASERVICE-002 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-f846478695ff0748abf80acdf37f4ce9e2b0dfea11775075c34e7269b8db3696 | none | TASK-DATASERVICE-002 | AC-DATASERVICE-016-S01 | CMD-DATASERVICE-048, CMD-DATASERVICE-049, CMD-DATASERVICE-050 | EVD-DATASERVICE-002 |  |
| TASK-DATASERVICE-003 | intent-73d8e9123d324b9dfc48eb3f9ab201ac27cdd4e8cb97117ab45dea84e145c67f | TASK-DATASERVICE-003 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-c9278f6632e771049c864c997dad9b36eb3dcb14723029d34328683ac62356bf | none | TASK-DATASERVICE-003 | AC-DATASERVICE-009-S01, AC-DATASERVICE-009-S02, AC-DATASERVICE-019-S01, AC-DATASERVICE-020-S04, AC-DATASERVICE-021-S01, AC-DATASERVICE-021-S02, AC-DATASERVICE-021-S03, AC-DATASERVICE-022-S01, AC-DATASERVICE-022-S02 | CMD-DATASERVICE-051, CMD-DATASERVICE-052, CMD-DATASERVICE-053 | EVD-DATASERVICE-003 |  |
| TASK-DATASERVICE-004 | intent-82c4b03c85a0f5b4d1762664c27c611f7b14574873453931a42aa12b24954d22 | TASK-DATASERVICE-004 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-d3434695c7a1f6ad35a2ce0ab092836789d88e87b58bf3a0461a30dd8b04cd49 | none | TASK-DATASERVICE-004 | AC-DATASERVICE-006-S01, AC-DATASERVICE-007-S01, AC-DATASERVICE-009-S01, AC-DATASERVICE-009-S02, AC-DATASERVICE-010-S01, AC-DATASERVICE-022-S01, AC-DATASERVICE-022-S02 | CMD-DATASERVICE-054, CMD-DATASERVICE-055, CMD-DATASERVICE-056 | EVD-DATASERVICE-004 |  |
| TASK-DATASERVICE-005 | intent-6bd9970ed82818d7d57221164ad6fc67325d5147c5a51f180802a28dbcf4afb3 | TASK-DATASERVICE-005 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-08c1e9951829c47f5fb6ea800bd547bb7508b078c7cb76c685ede1f1281c35e1 | none | TASK-DATASERVICE-005 | AC-DATASERVICE-001-S01, AC-DATASERVICE-003-S01, AC-DATASERVICE-004-S01, AC-DATASERVICE-005-S01, AC-DATASERVICE-008-S01, AC-DATASERVICE-013-S02, AC-DATASERVICE-021-S01, AC-DATASERVICE-021-S02, AC-DATASERVICE-023-S01, AC-DATASERVICE-023-S02, AC-DATASERVICE-023-S03, AC-DATASERVICE-024-S02, AC-DATASERVICE-024-S03 | CMD-DATASERVICE-057, CMD-DATASERVICE-058, CMD-DATASERVICE-059 | EVD-DATASERVICE-005 |  |
| TASK-DATASERVICE-006 | intent-21b68c2e48bdac29868fb5dd5d5944c411b741d3982090e2055aee7b1c8a4597 | TASK-DATASERVICE-006 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-6a2fa3d07b246d05215bd0e0a036e26278a5902aa09676d278e335296ff5fee8 | none | TASK-DATASERVICE-006 | AC-DATASERVICE-002-S01, AC-DATASERVICE-003-S01, AC-DATASERVICE-015-S01, AC-DATASERVICE-016-S01, AC-DATASERVICE-016-S02, AC-DATASERVICE-016-S03, AC-DATASERVICE-016-S04 | CMD-DATASERVICE-060, CMD-DATASERVICE-061, CMD-DATASERVICE-062 | EVD-DATASERVICE-006 |  |
| TASK-DATASERVICE-007 | intent-552dff126b540a4b0a01ccd150d22aac200c8a6bbdc4af1b446e2020cfbb227a | TASK-DATASERVICE-007 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-a3f6c95466e8680fd43f0eecfebe183d24c4b8872133c84e3f77c23d8c51e55d | none | TASK-DATASERVICE-007 | AC-DATASERVICE-001-S01, AC-DATASERVICE-002-S01, AC-DATASERVICE-003-S01, AC-DATASERVICE-004-S01, AC-DATASERVICE-005-S01, AC-DATASERVICE-006-S01, AC-DATASERVICE-008-S01, AC-DATASERVICE-013-S02, AC-DATASERVICE-023-S01, AC-DATASERVICE-023-S02, AC-DATASERVICE-023-S03, AC-DATASERVICE-024-S01, AC-DATASERVICE-024-S02, AC-DATASERVICE-024-S03 | CMD-DATASERVICE-063, CMD-DATASERVICE-064, CMD-DATASERVICE-065 | EVD-DATASERVICE-007 |  |
| TASK-DATASERVICE-008 | intent-cebabcc2f8ab8e3b89c1fd9baa9a9e38653837a3d41ba8ab6c8ada76477178c1 | TASK-DATASERVICE-008 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-da14a0ca6add29c086c95cf2c77e6af8742ced1cd3566ecea9ddb10f03182407 | none | TASK-DATASERVICE-008 | AC-DATASERVICE-011-S01, AC-DATASERVICE-012-S01, AC-DATASERVICE-013-S01, AC-DATASERVICE-013-S02, AC-DATASERVICE-023-S01 | CMD-DATASERVICE-066, CMD-DATASERVICE-067, CMD-DATASERVICE-068 | EVD-DATASERVICE-008 |  |
| TASK-DATASERVICE-009 | intent-6d444e201782909920d6707e15bf5e4ea68fed9d93be26d2bcc68898d1fb53df | TASK-DATASERVICE-009 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-d136a9e4f8c39331c849fe51319ec2adc936dee2b8fb2dae2d559a415cc38443 | none | TASK-DATASERVICE-009 | AC-DATASERVICE-006-S01, AC-DATASERVICE-007-S01, AC-DATASERVICE-008-S01, AC-DATASERVICE-011-S01, AC-DATASERVICE-012-S01, AC-DATASERVICE-013-S01, AC-DATASERVICE-013-S02, AC-DATASERVICE-024-S01, AC-DATASERVICE-024-S02, AC-DATASERVICE-024-S03 | CMD-DATASERVICE-069, CMD-DATASERVICE-070, CMD-DATASERVICE-071 | EVD-DATASERVICE-009 |  |
| TASK-DATASERVICE-010 | intent-0de8d0430b9b3f512832f1f8e00b56633614bec593d68a4122b60bc1fa7637d6 | TASK-DATASERVICE-010 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-c5adca2df8e98e53ebe15d6fba0a6ae6e12514cd3897e31bb922b6ee9813f488 | none | TASK-DATASERVICE-010 | AC-DATASERVICE-014-S01, AC-DATASERVICE-015-S01, AC-DATASERVICE-016-S04 | CMD-DATASERVICE-072, CMD-DATASERVICE-073, CMD-DATASERVICE-074 | EVD-DATASERVICE-010 |  |
| TASK-DATASERVICE-011 | intent-55cc3721efb020fdc478e87f626a21e4ebec663a11eb19f326e202a2b5bde13c | TASK-DATASERVICE-011 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-7309e57447a2aab1dc6b8d3cde6d8488243968aeb83a7c27b0802df28d5fa27e | none | TASK-DATASERVICE-011 | AC-DATASERVICE-002-S01, AC-DATASERVICE-014-S01, AC-DATASERVICE-015-S01, AC-DATASERVICE-016-S01, AC-DATASERVICE-016-S02, AC-DATASERVICE-016-S03, AC-DATASERVICE-016-S04, AC-DATASERVICE-021-S01, AC-DATASERVICE-021-S03, AC-DATASERVICE-024-S02, AC-DATASERVICE-024-S03 | CMD-DATASERVICE-075, CMD-DATASERVICE-076, CMD-DATASERVICE-077 | EVD-DATASERVICE-011 |  |
| TASK-DATASERVICE-012 | intent-0de39a66cb3fd974dc03c6f2f1a12f5449316469c32390fc135400c662b9a755 | TASK-DATASERVICE-012 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-5fa2cb63bfd282fd8a4ef23c09ff920138d359d46b8f21b13b813c36dd00bd37 | none | TASK-DATASERVICE-012 | AC-DATASERVICE-009-S02, AC-DATASERVICE-010-S01, AC-DATASERVICE-017-S01, AC-DATASERVICE-018-S01, AC-DATASERVICE-019-S01, AC-DATASERVICE-020-S03, AC-DATASERVICE-020-S04, AC-DATASERVICE-022-S01 | CMD-DATASERVICE-078, CMD-DATASERVICE-079, CMD-DATASERVICE-080 | EVD-DATASERVICE-012 |  |
| TASK-DATASERVICE-013 | intent-23f976dd1609a61e87e1bc6843f945fab934725c80c38f79edc78c57df40a6d4 | TASK-DATASERVICE-013 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-6805eb2235c16f2a3ef53b2562313750a753d237747ccfa58c68726530842c7e | none | TASK-DATASERVICE-013 | AC-DATASERVICE-020-S01, AC-DATASERVICE-020-S02, AC-DATASERVICE-020-S03, AC-DATASERVICE-020-S04 | CMD-DATASERVICE-081, CMD-DATASERVICE-082, CMD-DATASERVICE-083 | EVD-DATASERVICE-013 |  |
| TASK-DATASERVICE-014 | intent-32e61cd9a9341624473be49ad5b280d1796f3f5ac1ba96b06d98159f1b7e188e | TASK-DATASERVICE-014 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-6d81650914b2f43258aa1a4eec5d955862c29141e06a1963fa4012478fca33a3 | none | TASK-DATASERVICE-014 | AC-DATASERVICE-021-S03, AC-DATASERVICE-023-S01, AC-DATASERVICE-023-S02, AC-DATASERVICE-023-S03, AC-DATASERVICE-024-S01, AC-DATASERVICE-024-S02, AC-DATASERVICE-024-S03 | CMD-DATASERVICE-084, CMD-DATASERVICE-085, CMD-DATASERVICE-086 | EVD-DATASERVICE-014 |  |
| TASK-DATASERVICE-015 | intent-a876682a02c85a14b5646261e40a3e538393d13d03231a794a32454fef10190b | TASK-DATASERVICE-015 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-ead5def3c4fd350be4931d8453e96657149ec29c2018ee084b5ad9aedb9a0e5c | none | TASK-DATASERVICE-015 | AC-DATASERVICE-001-S01, AC-DATASERVICE-002-S01, AC-DATASERVICE-003-S01, AC-DATASERVICE-004-S01, AC-DATASERVICE-005-S01, AC-DATASERVICE-006-S01, AC-DATASERVICE-007-S01, AC-DATASERVICE-008-S01, AC-DATASERVICE-009-S01, AC-DATASERVICE-009-S02, AC-DATASERVICE-010-S01, AC-DATASERVICE-011-S01, AC-DATASERVICE-012-S01, AC-DATASERVICE-013-S01, AC-DATASERVICE-013-S02, AC-DATASERVICE-014-S01, AC-DATASERVICE-015-S01, AC-DATASERVICE-016-S01, AC-DATASERVICE-016-S02, AC-DATASERVICE-016-S03, AC-DATASERVICE-016-S04, AC-DATASERVICE-017-S01, AC-DATASERVICE-018-S01, AC-DATASERVICE-019-S01, AC-DATASERVICE-020-S01, AC-DATASERVICE-020-S02, AC-DATASERVICE-020-S03, AC-DATASERVICE-020-S04, AC-DATASERVICE-021-S01, AC-DATASERVICE-021-S02, AC-DATASERVICE-021-S03, AC-DATASERVICE-022-S01, AC-DATASERVICE-022-S02, AC-DATASERVICE-023-S01, AC-DATASERVICE-023-S02, AC-DATASERVICE-023-S03, AC-DATASERVICE-024-S01, AC-DATASERVICE-024-S02, AC-DATASERVICE-024-S03 | CMD-DATASERVICE-003, CMD-DATASERVICE-004, CMD-DATASERVICE-005, CMD-DATASERVICE-006, CMD-DATASERVICE-007, CMD-DATASERVICE-008, CMD-DATASERVICE-009, CMD-DATASERVICE-010, CMD-DATASERVICE-011, CMD-DATASERVICE-012, CMD-DATASERVICE-013, CMD-DATASERVICE-014, CMD-DATASERVICE-015, CMD-DATASERVICE-016, CMD-DATASERVICE-017, CMD-DATASERVICE-018, CMD-DATASERVICE-019, CMD-DATASERVICE-020, CMD-DATASERVICE-021, CMD-DATASERVICE-022, CMD-DATASERVICE-023, CMD-DATASERVICE-024, CMD-DATASERVICE-025, CMD-DATASERVICE-026, CMD-DATASERVICE-027, CMD-DATASERVICE-028, CMD-DATASERVICE-029, CMD-DATASERVICE-030, CMD-DATASERVICE-031, CMD-DATASERVICE-032, CMD-DATASERVICE-033, CMD-DATASERVICE-034, CMD-DATASERVICE-035, CMD-DATASERVICE-036, CMD-DATASERVICE-037, CMD-DATASERVICE-038, CMD-DATASERVICE-039, CMD-DATASERVICE-040, CMD-DATASERVICE-041, CMD-DATASERVICE-042, CMD-DATASERVICE-087, CMD-DATASERVICE-090 | EVD-DATASERVICE-015 |  |
| TASK-DATASERVICE-016 | intent-ec1ad4b9d3ca4ffa91f473004ac84ef6962ca34a99bbb285f0b7369ba3cff9fe | TASK-DATASERVICE-016 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-73e05b5f73f7b765e8a2deb0e775383bd71b2dee443db14ee5219ea36588f360 | none | TASK-DATASERVICE-016 | AC-DATASERVICE-009-S01, AC-DATASERVICE-009-S02, AC-DATASERVICE-010-S01, AC-DATASERVICE-011-S01, AC-DATASERVICE-012-S01, AC-DATASERVICE-013-S01, AC-DATASERVICE-013-S02, AC-DATASERVICE-014-S01, AC-DATASERVICE-015-S01, AC-DATASERVICE-016-S01, AC-DATASERVICE-016-S02, AC-DATASERVICE-016-S03, AC-DATASERVICE-016-S04, AC-DATASERVICE-017-S01, AC-DATASERVICE-018-S01, AC-DATASERVICE-019-S01, AC-DATASERVICE-020-S01, AC-DATASERVICE-020-S02, AC-DATASERVICE-020-S03, AC-DATASERVICE-020-S04, AC-DATASERVICE-021-S01, AC-DATASERVICE-021-S02, AC-DATASERVICE-021-S03, AC-DATASERVICE-022-S01, AC-DATASERVICE-022-S02, AC-DATASERVICE-023-S01, AC-DATASERVICE-023-S02, AC-DATASERVICE-023-S03, AC-DATASERVICE-024-S01, AC-DATASERVICE-024-S02, AC-DATASERVICE-024-S03 | CMD-DATASERVICE-042, CMD-DATASERVICE-053, CMD-DATASERVICE-056, CMD-DATASERVICE-059, CMD-DATASERVICE-062, CMD-DATASERVICE-065, CMD-DATASERVICE-068, CMD-DATASERVICE-071, CMD-DATASERVICE-074, CMD-DATASERVICE-077, CMD-DATASERVICE-080, CMD-DATASERVICE-083, CMD-DATASERVICE-086, CMD-DATASERVICE-092 | EVD-DATASERVICE-016 |  |
| AC-DATASERVICE-001-S01 | intent-764b837d3e78f86ff5eeabbf59d444c2f309da9e61061c0ae7b45a382658bde1 | AC-DATASERVICE-001-S01 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-14c6f8b8f02ca92ded28a2b0ac7f3a4d18cea6ce20807031afe0cdec5897f243 | none | TASK-DATASERVICE-005, TASK-DATASERVICE-007 |  | CMD-DATASERVICE-003 | EVD-DATASERVICE-017 |  |
| AC-DATASERVICE-002-S01 | intent-8950d188bf14c352356dc41ee81a4757e4348988d5e1fd24944212b908dd64a9 | AC-DATASERVICE-002-S01 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-2435b969d8d1aa233f9df703b815443e442aa716d68dd9d7326765f62b070028 | none | TASK-DATASERVICE-006, TASK-DATASERVICE-007, TASK-DATASERVICE-011 |  | CMD-DATASERVICE-004 | EVD-DATASERVICE-018 |  |
| AC-DATASERVICE-003-S01 | intent-8dd5cf68012c7a92d1c0faa8835a60d933f0f88d137bff84b0c97cddaa7f77db | AC-DATASERVICE-003-S01 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-9df38a266efdedc4e0ea4fd49b0042f8d907769f36e62ee84e88370ded730fa4 | none | TASK-DATASERVICE-005, TASK-DATASERVICE-006, TASK-DATASERVICE-007 |  | CMD-DATASERVICE-005 | EVD-DATASERVICE-019 |  |
| AC-DATASERVICE-004-S01 | intent-efa85f1ccb36b93e21181d88edfb44382b2fd97bc61825efd7fb65f56b097ae1 | AC-DATASERVICE-004-S01 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-ab127e10903905641834c27e1aaa192f9476a4f93fd5f1ac266a44dde6d76e4d | none | TASK-DATASERVICE-005, TASK-DATASERVICE-007 |  | CMD-DATASERVICE-006 | EVD-DATASERVICE-020 |  |
| AC-DATASERVICE-005-S01 | intent-86213399b0eb0624bec1056463e9fcb6e84907ae9e88d8298ee3ddf9208a4e06 | AC-DATASERVICE-005-S01 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-fbf1e829d5423a5f1029193a8b437419c86ef41a74a7d812384c59c9214339e0 | none | TASK-DATASERVICE-005, TASK-DATASERVICE-007 |  | CMD-DATASERVICE-007 | EVD-DATASERVICE-021 |  |
| AC-DATASERVICE-006-S01 | intent-a0f7dd6fee4f69d7d5cfb3b8dae55036aef525a6289423a15f7c7500d186ce96 | AC-DATASERVICE-006-S01 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-a959cae581a63bcfdb578ddcf16c7755d60f49fd15507c4cc39dc4887dd7369a | none | TASK-DATASERVICE-004, TASK-DATASERVICE-007, TASK-DATASERVICE-009 |  | CMD-DATASERVICE-008 | EVD-DATASERVICE-022 |  |
| AC-DATASERVICE-007-S01 | intent-033852e9ae2d7a76ec4697362d700f03ca04c50940fd7d78152bc8125fdc1716 | AC-DATASERVICE-007-S01 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-6dc842c75a971f4fec43d23a87668b1903f91bf80a793f772c025da0e6581b6b | none | TASK-DATASERVICE-004, TASK-DATASERVICE-009 |  | CMD-DATASERVICE-009 | EVD-DATASERVICE-023 |  |
| AC-DATASERVICE-008-S01 | intent-b3a00d47d6842e1a5913bd152db353e926a7f16f701a06a453965a27b9f617ee | AC-DATASERVICE-008-S01 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-4a802dd7946e770df5d917278ba7fe76f3ca5306d2b27f1472f440ecc19d27a0 | none | TASK-DATASERVICE-005, TASK-DATASERVICE-007, TASK-DATASERVICE-009 |  | CMD-DATASERVICE-010 | EVD-DATASERVICE-024 |  |
| AC-DATASERVICE-009-S01 | intent-623a25f2ea22888427d474436ac43d58c29ebe1fa06971888beead7f00f4c952 | AC-DATASERVICE-009-S01 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-93f8217c8779bea82f79f26462043e2d0bf55788f2f5c1725da67b867f209479 | none | TASK-DATASERVICE-003, TASK-DATASERVICE-004 |  | CMD-DATASERVICE-011 | EVD-DATASERVICE-025 |  |
| AC-DATASERVICE-010-S01 | intent-ecb6e9520f2724cf6d7d298d2ec82a06b16778ae67249379502523fced7b9d63 | AC-DATASERVICE-010-S01 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-074ef540f84329f7c417ea3e3ded18dc0f28ba0402f96ea7d04d8f960ed0029f | none | TASK-DATASERVICE-004, TASK-DATASERVICE-012 |  | CMD-DATASERVICE-012 | EVD-DATASERVICE-026 |  |
| AC-DATASERVICE-011-S01 | intent-fbc7c67ff66be0df2a4a45266e90380953cf0bf614622bc271ec0d3fcaf81650 | AC-DATASERVICE-011-S01 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-4b9d4a1a6127a5c84ac101a27f902b902fcd5e4d65fcee68979609083757cc20 | none | TASK-DATASERVICE-008, TASK-DATASERVICE-009 |  | CMD-DATASERVICE-013 | EVD-DATASERVICE-027 |  |
| AC-DATASERVICE-012-S01 | intent-4b4321eff09e1f83338c8ddd4ea76ab41a83c222c696fc6e3e0c8204c7651d33 | AC-DATASERVICE-012-S01 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-2db794c9d4026d695abe36e1a866f8e7625ff5bc00a72dfe0add99b655598fd8 | none | TASK-DATASERVICE-008, TASK-DATASERVICE-009 |  | CMD-DATASERVICE-014 | EVD-DATASERVICE-028 |  |
| AC-DATASERVICE-013-S01 | intent-2e8eb6b039b019f9ddd1368f18c66c774635c7d5a0163d49b4223f3e99583b21 | AC-DATASERVICE-013-S01 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-39883c170fbd6110cc4dc0115a5200641c9598f02e5f69d3dab6e1e87e4ae1b9 | none | TASK-DATASERVICE-008, TASK-DATASERVICE-009 |  | CMD-DATASERVICE-015 | EVD-DATASERVICE-029 |  |
| AC-DATASERVICE-014-S01 | intent-38addcc87e866cdfe8953c82958d9cd43311a82ccb64d6c713d1f27bac143a8d | AC-DATASERVICE-014-S01 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-3f60fae1cb7d7644c7cf5fea9f263976139f089a2da5171dab62c807c47a9fb1 | none | TASK-DATASERVICE-010, TASK-DATASERVICE-011 |  | CMD-DATASERVICE-016 | EVD-DATASERVICE-030 |  |
| AC-DATASERVICE-015-S01 | intent-3dfa1b63195822233c2c57cd28dec6bcd622025d62ffb3326c8f30d60b70ca5a | AC-DATASERVICE-015-S01 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-64fd5fa6478c9f265756813ebe173dbed7b3ca32e99baed828cb5ba2fdd5310c | none | TASK-DATASERVICE-006, TASK-DATASERVICE-010, TASK-DATASERVICE-011 |  | CMD-DATASERVICE-017 | EVD-DATASERVICE-031 |  |
| AC-DATASERVICE-016-S01 | intent-ba500cfe2008e97b8bbf383df33b897f043ffbd288d015626f073b84cec2c511 | AC-DATASERVICE-016-S01 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-ff5f69156ed2d1f804f1dbbcf248272305f0388644c3f5eda98155a938acfe77 | none | TASK-DATASERVICE-006, TASK-DATASERVICE-011 |  | CMD-DATASERVICE-018 | EVD-DATASERVICE-032 |  |
| AC-DATASERVICE-017-S01 | intent-c0b16af815182b47c6fb8e203ee74380c3db98de58c98e8e8a97691b7821d7aa | AC-DATASERVICE-017-S01 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-cd1208f6d34e0a39ff3542c798ee337afe7deed147f9a1f47db9778830e867df | none | TASK-DATASERVICE-012 |  | CMD-DATASERVICE-019 | EVD-DATASERVICE-033 |  |
| AC-DATASERVICE-018-S01 | intent-5f5bf8a4c80f1364572cc028b6bec2d6b6537c69c14f24ffb98346429533d1ec | AC-DATASERVICE-018-S01 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-3d59df9df49f59c46bd9aaef59469ce7ff7858b84a302c020f884f6a1a42229e | none | TASK-DATASERVICE-012 |  | CMD-DATASERVICE-020 | EVD-DATASERVICE-034 |  |
| AC-DATASERVICE-019-S01 | intent-0b08687aa1548710642eaf0e26698e87ce4f4beca2398ecc0f8b4760daf3bea4 | AC-DATASERVICE-019-S01 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-0d98e1334b2a2c5cf780147902f10a519ea20661adc839b52d69e786639afa25 | none | TASK-DATASERVICE-003, TASK-DATASERVICE-012 |  | CMD-DATASERVICE-021 | EVD-DATASERVICE-035 |  |
| AC-DATASERVICE-020-S01 | intent-9dff1497ad249dc6cf07a2faa48e090cba7b6aeb60333c18db06aa82c2aa8d37 | AC-DATASERVICE-020-S01 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-1f92606287ccb178bc27d202ac53fe2a275bbbd1f12ae16a8247f856e608cd44 | none | TASK-DATASERVICE-013 |  | CMD-DATASERVICE-022 | EVD-DATASERVICE-036 |  |
| AC-DATASERVICE-021-S01 | intent-524bb935447a1b495a20279be07db9d7f698d648dc7bb0c482df0fea8bdd3953 | AC-DATASERVICE-021-S01 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-85c0f1b0e35721ff9af8790479d5c9737f4fc0f03d2eec638071f20709c972c1 | none | TASK-DATASERVICE-003, TASK-DATASERVICE-005, TASK-DATASERVICE-011 |  | CMD-DATASERVICE-023 | EVD-DATASERVICE-037 |  |
| AC-DATASERVICE-022-S01 | intent-13f691888ff188ba58570222cd556e51447662280ecf2c949d087cab6c9670d1 | AC-DATASERVICE-022-S01 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-009c65f48cc0548c4a3249d5f9fa0edf164dd922e44be4a301d004e684459b28 | none | TASK-DATASERVICE-003, TASK-DATASERVICE-004, TASK-DATASERVICE-012 |  | CMD-DATASERVICE-024 | EVD-DATASERVICE-038 |  |
| AC-DATASERVICE-023-S01 | intent-b1f28e7607b9d63db8ecee06c1d8b5fc43f40ad22aa60ddac36aa7255d07ef88 | AC-DATASERVICE-023-S01 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-3f07b2448039df294b237e7686c07801e1f56a585ac46a6bedb09015d8548d31 | none | TASK-DATASERVICE-005, TASK-DATASERVICE-007, TASK-DATASERVICE-008, TASK-DATASERVICE-014 |  | CMD-DATASERVICE-025 | EVD-DATASERVICE-039 |  |
| AC-DATASERVICE-024-S01 | intent-320d40b4c86cef08fdbabfb8890b45ee1f83e0decf0a3e62125106f187ed0d99 | AC-DATASERVICE-024-S01 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-d8e45fd7c55a2e9e0832baec70378c995390f449c050e0c218d68e97c6f01522 | none | TASK-DATASERVICE-007, TASK-DATASERVICE-009, TASK-DATASERVICE-014 |  | CMD-DATASERVICE-026 | EVD-DATASERVICE-040 |  |
| AC-DATASERVICE-009-S02 | intent-2d013b7a885fbb1ef58cd89529362e3f6609abb3384c45b5d43802e6e0078022 | AC-DATASERVICE-009-S02 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-f5b01e66e5d9aeb25a5eaa4e6d18fcd7f1e59e0b218435a80f19e8a2216a792a | none | TASK-DATASERVICE-004, TASK-DATASERVICE-012 |  | CMD-DATASERVICE-027 | EVD-DATASERVICE-041 |  |
| AC-DATASERVICE-013-S02 | intent-42b2180fc1cc75cdae27d99d5653f01786927788d6a89e38c4b6021c4dc99b1b | AC-DATASERVICE-013-S02 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-a421b87745a318f72ad2250677a2397fb408c7e88ea18b79aec3ba8d6e82a08b | none | TASK-DATASERVICE-005, TASK-DATASERVICE-007, TASK-DATASERVICE-008, TASK-DATASERVICE-009 |  | CMD-DATASERVICE-028 | EVD-DATASERVICE-042 |  |
| AC-DATASERVICE-016-S02 | intent-fa6b6ed7760646eecb12d9b2bee4255561ac838aa01fc8a2885640e456d671be | AC-DATASERVICE-016-S02 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-2133934516c22b11ad3141fab81135bbc81714cb92dab2dee0bb6ae96b2262cf | none | TASK-DATASERVICE-006, TASK-DATASERVICE-011 |  | CMD-DATASERVICE-029 | EVD-DATASERVICE-043 |  |
| AC-DATASERVICE-016-S03 | intent-98ecdcef63bd1b26bb0f78bb5d62a05be1bc9ed03e94c7defd609c407c1af99f | AC-DATASERVICE-016-S03 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-6d3666b122e3df2240546da1f056b8f4d03163174f02a0f2a19ed16ed33e8d5e | none | TASK-DATASERVICE-006, TASK-DATASERVICE-011 |  | CMD-DATASERVICE-030 | EVD-DATASERVICE-044 |  |
| AC-DATASERVICE-016-S04 | intent-71322a91a00a5d8f90dae145acffe844034d3b95699007819420d47aa070d81f | AC-DATASERVICE-016-S04 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-c08b11cb3063af5295baad7f9a59b2f48860efb55ca87ef3014fda1586134288 | none | TASK-DATASERVICE-010, TASK-DATASERVICE-011 |  | CMD-DATASERVICE-031 | EVD-DATASERVICE-045 |  |
| AC-DATASERVICE-020-S02 | intent-f16fd9d7e8684a3a954eb4c221fd4976e38957fbf36f1a2508e5f6c70acce315 | AC-DATASERVICE-020-S02 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-b7f9e277cc6854e98fae7817aef6daced2495aba6be0944d2784933be9ab22da | none | TASK-DATASERVICE-013 |  | CMD-DATASERVICE-032 | EVD-DATASERVICE-046 |  |
| AC-DATASERVICE-020-S03 | intent-d5fdd37e6f3955d411a4caf52315f9fb0217f659104a79934989da008fd41297 | AC-DATASERVICE-020-S03 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-29e2abd76754e6c4d7cffc0280c7ad202698aa1a68c9c51eb13e24a50ea1f219 | none | TASK-DATASERVICE-012, TASK-DATASERVICE-013 |  | CMD-DATASERVICE-033 | EVD-DATASERVICE-047 |  |
| AC-DATASERVICE-020-S04 | intent-48202b3f1a6b42cca76b2628eb933c79a5054d4857275d5ae7f6a9e82eea793c | AC-DATASERVICE-020-S04 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-b14474d378da1c3da9388301191ab439ec5a42318761ee52e8f181efe52dc675 | none | TASK-DATASERVICE-003, TASK-DATASERVICE-012, TASK-DATASERVICE-013 |  | CMD-DATASERVICE-034 | EVD-DATASERVICE-048 |  |
| AC-DATASERVICE-021-S02 | intent-71d1c83f3aee276539e0fe55de32c492342c02df8c48fdb53c53041df36540c9 | AC-DATASERVICE-021-S02 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-de49f7a5d3753a21f9532628b188a04bee1e15554353178e39e62a0f485d7fb4 | none | TASK-DATASERVICE-003, TASK-DATASERVICE-005 |  | CMD-DATASERVICE-035 | EVD-DATASERVICE-049 |  |
| AC-DATASERVICE-021-S03 | intent-c201c8b741c411d229766551d38017a209ca0a85f3da1e8c846f42134cae37c6 | AC-DATASERVICE-021-S03 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-42e9a2294babb6766e4cb95ebdf7353142d8daddbeb78f915152b5e8abd50c88 | none | TASK-DATASERVICE-003, TASK-DATASERVICE-011, TASK-DATASERVICE-014 |  | CMD-DATASERVICE-036 | EVD-DATASERVICE-050 |  |
| AC-DATASERVICE-022-S02 | intent-ea3d44d0333e25d62369a01b26e8987215f7ad3c2ef4b1d5c098b422e1811741 | AC-DATASERVICE-022-S02 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-8b4d76db048ef6b2e62427d8b7f24320d3d618440011fbb542d4d86ba7c4a0ae | none | TASK-DATASERVICE-003, TASK-DATASERVICE-004 |  | CMD-DATASERVICE-037 | EVD-DATASERVICE-051 |  |
| AC-DATASERVICE-023-S02 | intent-9f3ee10b9948a803d9fa238c3f2fca8a8abbf1f5409532d6c4825563cebc5c00 | AC-DATASERVICE-023-S02 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-7123b007549865a6cddcc16b69fd8fa3e66447ecb6a8f7ea61b8dd7cb4083ef3 | none | TASK-DATASERVICE-005, TASK-DATASERVICE-007, TASK-DATASERVICE-014 |  | CMD-DATASERVICE-038 | EVD-DATASERVICE-052 |  |
| AC-DATASERVICE-023-S03 | intent-d87aa2b542049672dfc86678e734034555c2873da8857ac12a5659a2d3f6fb62 | AC-DATASERVICE-023-S03 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-3b9f61120e2db7da62bc6eab303d8715ab836f563a480ca8d470acabda6950da | none | TASK-DATASERVICE-005, TASK-DATASERVICE-014 |  | CMD-DATASERVICE-039 | EVD-DATASERVICE-053 |  |
| AC-DATASERVICE-024-S02 | intent-6647d705e4ea835a33d971f70177078c2246b664a018241b02596b7858c547f5 | AC-DATASERVICE-024-S02 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-e7cbbac1a637f9dd612d9107cae32a12e59f5b1fd8b3b7ad23c745ca21f3ce8b | none | TASK-DATASERVICE-005, TASK-DATASERVICE-007, TASK-DATASERVICE-011, TASK-DATASERVICE-014 |  | CMD-DATASERVICE-040 | EVD-DATASERVICE-054 |  |
| AC-DATASERVICE-024-S03 | intent-5c86ff1d934abd7285afa6012686f1b6a28d12f0c5bae82955872cc70d02f391 | AC-DATASERVICE-024-S03 | standalone-source-d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a | STANDALONE_D0AA0BE0D8773E8029724C2DD4027578BFDF614870C93332CC082FB54890F74A | spec-span-92fdbfdf2c548e03acc47b7fdee2901cc5bd5dc4f172f3d042a51e93e64f7b93 | none | TASK-DATASERVICE-005, TASK-DATASERVICE-011 |  | CMD-DATASERVICE-041 | EVD-DATASERVICE-055 |  |
<!-- /goal-slot:sourceCoverageMatrix -->

## Required Test Commands

Run these commands after implementation. Add any newly created test command only through an explicit contract amendment.

<!-- goal-slot:requiredTestCommands required dynamic=requiredCommands -->
### COMMAND CMD-DATASERVICE-045

```
python -m pytest -q tests/characterization/test_legacy_indicator_chain_822c715e6.py tests/characterization/test_legacy_recorder_chain_822c715e6.py tests/characterization/test_legacy_callback_chain_822c715e6.py tests/characterization/test_legacy_main_contract_mapping_822c715e6.py
```

- Source: `CMD-DATASERVICE-045`; role: `binding`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:75d058f88cb995f64f37ed3e250c1eb27f868534076c3f458fd6afba18622d3d`.
- Provenance: `SPAN-40FE9628569B2CCA`; clauses: `B2098:C1, B2099:C1, B2100:C1, B2101:C1, B2102:C1, B2103:C1, B2103:C2, B2103:C3, B2104:C1, B2105:C1, B2106:C1, B2107:C1, B2108:C1, B2109:C1, B2109:C2, B2110:C1, B2110:C2, B2111:C1`.
- Command source: `TASK-DATASERVICE-001`.

### COMMAND CMD-DATASERVICE-046

```
python -m pytest -q tests/characterization/test_legacy_indicator_chain_822c715e6.py tests/characterization/test_legacy_recorder_chain_822c715e6.py tests/characterization/test_legacy_callback_chain_822c715e6.py tests/characterization/test_legacy_main_contract_mapping_822c715e6.py
```

- Source: `CMD-DATASERVICE-046`; role: `binding`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:75d058f88cb995f64f37ed3e250c1eb27f868534076c3f458fd6afba18622d3d`.
- Provenance: `SPAN-40FE9628569B2CCA`; clauses: `B2098:C1, B2099:C1, B2100:C1, B2101:C1, B2102:C1, B2103:C1, B2103:C2, B2103:C3, B2104:C1, B2105:C1, B2106:C1, B2107:C1, B2108:C1, B2109:C1, B2109:C2, B2110:C1, B2110:C2, B2111:C1`.
- Command source: `TASK-DATASERVICE-001`.

### COMMAND CMD-DATASERVICE-047

```
python -m pytest --collect-only -q tests/characterization
```

- Source: `CMD-DATASERVICE-047`; role: `binding`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:75d058f88cb995f64f37ed3e250c1eb27f868534076c3f458fd6afba18622d3d`.
- Provenance: `SPAN-40FE9628569B2CCA`; clauses: `B2098:C1, B2099:C1, B2100:C1, B2101:C1, B2102:C1, B2103:C1, B2103:C2, B2103:C3, B2104:C1, B2105:C1, B2106:C1, B2107:C1, B2108:C1, B2109:C1, B2109:C2, B2110:C1, B2110:C2, B2111:C1`.
- Command source: `TASK-DATASERVICE-001`.

### COMMAND CMD-DATASERVICE-048

```
python -m pytest -q tests/characterization/test_dataservice_fixture_manifest.py
```

- Source: `CMD-DATASERVICE-048`; role: `binding`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:bebca7e9429e145ce65ca542cbc5065b19e4d85a4c7af011eece7dacea541148`.
- Provenance: `SPAN-9F63E4B9B023DB73`; clauses: `B2115:C1, B2115:C2, B2116:C1, B2117:C1, B2118:C1, B2119:C1, B2120:C1, B2121:C1, B2121:C2, B2121:C3, B2122:C1, B2123:C1, B2124:C1, B2125:C1, B2126:C1, B2127:C1, B2127:C2, B2128:C1, B2128:C2, B2129:C1`.
- Command source: `TASK-DATASERVICE-002`.

### COMMAND CMD-DATASERVICE-049

```
python -m pytest -q tests/characterization/test_dataservice_fixture_manifest.py
```

- Source: `CMD-DATASERVICE-049`; role: `binding`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:bebca7e9429e145ce65ca542cbc5065b19e4d85a4c7af011eece7dacea541148`.
- Provenance: `SPAN-9F63E4B9B023DB73`; clauses: `B2115:C1, B2115:C2, B2116:C1, B2117:C1, B2118:C1, B2119:C1, B2120:C1, B2121:C1, B2121:C2, B2121:C3, B2122:C1, B2123:C1, B2124:C1, B2125:C1, B2126:C1, B2127:C1, B2127:C2, B2128:C1, B2128:C2, B2129:C1`.
- Command source: `TASK-DATASERVICE-002`.

### COMMAND CMD-DATASERVICE-050

```
python -m pytest --collect-only -q tests/integration tests/performance
```

- Source: `CMD-DATASERVICE-050`; role: `binding`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:bebca7e9429e145ce65ca542cbc5065b19e4d85a4c7af011eece7dacea541148`.
- Provenance: `SPAN-9F63E4B9B023DB73`; clauses: `B2115:C1, B2115:C2, B2116:C1, B2117:C1, B2118:C1, B2119:C1, B2120:C1, B2121:C1, B2121:C2, B2121:C3, B2122:C1, B2123:C1, B2124:C1, B2125:C1, B2126:C1, B2127:C1, B2127:C2, B2128:C1, B2128:C2, B2129:C1`.
- Command source: `TASK-DATASERVICE-002`.

### COMMAND CMD-DATASERVICE-051

```
python -m pytest -q tests/integration/test_dataservice_active_symbol_e2e.py tests/integration/test_dataservice_main_contract_mapping_e2e.py tests/integration/test_dataservice_quote_orderbook_ingress_e2e.py
```

- Source: `CMD-DATASERVICE-051`; role: `binding`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:da552a48eef98e559a94a97212e205fc1df7df94de150f99cec2cb87c43f1028`.
- Provenance: `SPAN-E94EC97492CFBCFC`; clauses: `B2133:C1, B2134:C1, B2135:C1, B2136:C1, B2137:C1, B2137:C2, B2137:C3, B2137:C4, B2138:C1, B2139:C1, B2140:C1, B2141:C1, B2142:C1, B2143:C1, B2143:C2, B2144:C1, B2144:C2, B2145:C1`.
- Command source: `TASK-DATASERVICE-003`.

### COMMAND CMD-DATASERVICE-052

```
python -m pytest -q tests/integration/test_dataservice_active_symbol_e2e.py tests/integration/test_dataservice_main_contract_mapping_e2e.py tests/integration/test_dataservice_quote_orderbook_ingress_e2e.py
```

- Source: `CMD-DATASERVICE-052`; role: `binding`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:da552a48eef98e559a94a97212e205fc1df7df94de150f99cec2cb87c43f1028`.
- Provenance: `SPAN-E94EC97492CFBCFC`; clauses: `B2133:C1, B2134:C1, B2135:C1, B2136:C1, B2137:C1, B2137:C2, B2137:C3, B2137:C4, B2138:C1, B2139:C1, B2140:C1, B2141:C1, B2142:C1, B2143:C1, B2143:C2, B2144:C1, B2144:C2, B2145:C1`.
- Command source: `TASK-DATASERVICE-003`.

### COMMAND CMD-DATASERVICE-053

```
python -m pytest -q tests/trader/test_futu_quote_owner_handoff.py tests/trader/test_root_runtime_process_ownership.py
```

- Source: `CMD-DATASERVICE-053`; role: `binding`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:da552a48eef98e559a94a97212e205fc1df7df94de150f99cec2cb87c43f1028`.
- Provenance: `SPAN-E94EC97492CFBCFC`; clauses: `B2133:C1, B2134:C1, B2135:C1, B2136:C1, B2137:C1, B2137:C2, B2137:C3, B2137:C4, B2138:C1, B2139:C1, B2140:C1, B2141:C1, B2142:C1, B2143:C1, B2143:C2, B2144:C1, B2144:C2, B2145:C1`.
- Command source: `TASK-DATASERVICE-003`.

### COMMAND CMD-DATASERVICE-054

```
python -m pytest -q tests/integration/test_dataservice_quote_orderbook_ingress_e2e.py tests/integration/test_dataservice_tick_continuity_e2e.py tests/integration/test_dataservice_period_open_e2e.py
```

- Source: `CMD-DATASERVICE-054`; role: `binding`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:fbd00e0ff89d9eb783b71776a55e866128882a2a3677a291a967012ca15cab4f`.
- Provenance: `SPAN-9B3F46E98428AFE4`; clauses: `B2149:C1, B2150:C1, B2151:C1, B2152:C1, B2153:C1, B2153:C2, B2153:C3, B2153:C4, B2153:C5, B2154:C1, B2155:C1, B2156:C1, B2157:C1, B2158:C1, B2159:C1, B2159:C2, B2160:C1, B2161:C1`.
- Command source: `TASK-DATASERVICE-004`.

### COMMAND CMD-DATASERVICE-055

```
python -m pytest -q tests/integration/test_dataservice_quote_orderbook_ingress_e2e.py tests/integration/test_dataservice_tick_continuity_e2e.py tests/integration/test_dataservice_period_open_e2e.py
```

- Source: `CMD-DATASERVICE-055`; role: `binding`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:fbd00e0ff89d9eb783b71776a55e866128882a2a3677a291a967012ca15cab4f`.
- Provenance: `SPAN-9B3F46E98428AFE4`; clauses: `B2149:C1, B2150:C1, B2151:C1, B2152:C1, B2153:C1, B2153:C2, B2153:C3, B2153:C4, B2153:C5, B2154:C1, B2155:C1, B2156:C1, B2157:C1, B2158:C1, B2159:C1, B2159:C2, B2160:C1, B2161:C1`.
- Command source: `TASK-DATASERVICE-004`.

### COMMAND CMD-DATASERVICE-056

```
python -m pytest -q tests/test_hkfe_period_performance.py tests/test_gap003_multiframe.py
```

- Source: `CMD-DATASERVICE-056`; role: `binding`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:fbd00e0ff89d9eb783b71776a55e866128882a2a3677a291a967012ca15cab4f`.
- Provenance: `SPAN-9B3F46E98428AFE4`; clauses: `B2149:C1, B2150:C1, B2151:C1, B2152:C1, B2153:C1, B2153:C2, B2153:C3, B2153:C4, B2153:C5, B2154:C1, B2155:C1, B2156:C1, B2157:C1, B2158:C1, B2159:C1, B2159:C2, B2160:C1, B2161:C1`.
- Command source: `TASK-DATASERVICE-004`.

### COMMAND CMD-DATASERVICE-057

```
python -m pytest -q tests/integration/test_dataservice_datamanager_repair_e2e.py tests/integration/test_dataservice_stable_gds_query_e2e.py::test_cancelled_late_response_releases_temporary_shm
```

- Source: `CMD-DATASERVICE-057`; role: `binding`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:14cce646b53d29913303571f2f6cbe8fad75dce9661e373f3acdf775581421f2`.
- Provenance: `SPAN-A95553D64306402D`; clauses: `B2165:C1, B2166:C1, B2167:C1, B2168:C1, B2169:C1, B2169:C2, B2169:C3, B2170:C1, B2171:C1, B2172:C1, B2173:C1, B2174:C1, B2175:C1, B2176:C1, B2177:C1`.
- Command source: `TASK-DATASERVICE-005`.

### COMMAND CMD-DATASERVICE-058

```
python -m pytest -q tests/integration/test_dataservice_datamanager_repair_e2e.py tests/integration/test_dataservice_stable_gds_query_e2e.py::test_cancelled_late_response_releases_temporary_shm
```

- Source: `CMD-DATASERVICE-058`; role: `binding`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:14cce646b53d29913303571f2f6cbe8fad75dce9661e373f3acdf775581421f2`.
- Provenance: `SPAN-A95553D64306402D`; clauses: `B2165:C1, B2166:C1, B2167:C1, B2168:C1, B2169:C1, B2169:C2, B2169:C3, B2170:C1, B2171:C1, B2172:C1, B2173:C1, B2174:C1, B2175:C1, B2176:C1, B2177:C1`.
- Command source: `TASK-DATASERVICE-005`.

### COMMAND CMD-DATASERVICE-059

```
python -m pytest -q tests/trader/test_dataservice_query_runtime.py tests/chart/test_chart_async_history_retry.py
```

- Source: `CMD-DATASERVICE-059`; role: `binding`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:14cce646b53d29913303571f2f6cbe8fad75dce9661e373f3acdf775581421f2`.
- Provenance: `SPAN-A95553D64306402D`; clauses: `B2165:C1, B2166:C1, B2167:C1, B2168:C1, B2169:C1, B2169:C2, B2169:C3, B2170:C1, B2171:C1, B2172:C1, B2173:C1, B2174:C1, B2175:C1, B2176:C1, B2177:C1`.
- Command source: `TASK-DATASERVICE-005`.

### COMMAND CMD-DATASERVICE-060

```
python -m pytest -q tests/integration/test_database_completed_idempotency.py
```

- Source: `CMD-DATASERVICE-060`; role: `binding`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:df2ecb8d786916b6f6501b4e91c29e5eb4e3f447087a0a69e72ac3d3ec6e3d3c`.
- Provenance: `SPAN-12D80B62643075BA`; clauses: `B2181:C1, B2182:C1, B2183:C1, B2184:C1, B2185:C1, B2185:C2, B2185:C3, B2186:C1, B2187:C1, B2188:C1, B2189:C1, B2190:C1, B2191:C1, B2192:C1, B2193:C1`.
- Command source: `TASK-DATASERVICE-006`.

### COMMAND CMD-DATASERVICE-061

```
python -m pytest -q tests/integration/test_database_completed_idempotency.py
```

- Source: `CMD-DATASERVICE-061`; role: `binding`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:df2ecb8d786916b6f6501b4e91c29e5eb4e3f447087a0a69e72ac3d3ec6e3d3c`.
- Provenance: `SPAN-12D80B62643075BA`; clauses: `B2181:C1, B2182:C1, B2183:C1, B2184:C1, B2185:C1, B2185:C2, B2185:C3, B2186:C1, B2187:C1, B2188:C1, B2189:C1, B2190:C1, B2191:C1, B2192:C1, B2193:C1`.
- Command source: `TASK-DATASERVICE-006`.

### COMMAND CMD-DATASERVICE-062

```
python -m pytest -q tests/integration/test_datarecorder_delivery_recovery_e2e.py::test_crash_after_commit_before_checkpoint_replays_identically
```

- Source: `CMD-DATASERVICE-062`; role: `binding`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:df2ecb8d786916b6f6501b4e91c29e5eb4e3f447087a0a69e72ac3d3ec6e3d3c`.
- Provenance: `SPAN-12D80B62643075BA`; clauses: `B2181:C1, B2182:C1, B2183:C1, B2184:C1, B2185:C1, B2185:C2, B2185:C3, B2186:C1, B2187:C1, B2188:C1, B2189:C1, B2190:C1, B2191:C1, B2192:C1, B2193:C1`.
- Command source: `TASK-DATASERVICE-006`.

### COMMAND CMD-DATASERVICE-063

```
python -m pytest -q tests/integration/test_dataservice_cold_hot_effective_series_e2e.py tests/integration/test_dataservice_datamanager_repair_e2e.py tests/integration/test_dataservice_stable_gds_query_e2e.py
```

- Source: `CMD-DATASERVICE-063`; role: `binding`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:56a53fa02d91a03c0b3c13efa0234292bdb635a19be60c1ef95074f63f417787`.
- Provenance: `SPAN-F39F2C35D45385E1`; clauses: `B2197:C1, B2198:C1, B2199:C1, B2200:C1, B2201:C1, B2201:C2, B2201:C3, B2202:C1, B2203:C1, B2204:C1, B2205:C1, B2206:C1, B2207:C1, B2208:C1, B2209:C1`.
- Command source: `TASK-DATASERVICE-007`.

### COMMAND CMD-DATASERVICE-064

```
python -m pytest -q tests/integration/test_dataservice_cold_hot_effective_series_e2e.py tests/integration/test_dataservice_datamanager_repair_e2e.py tests/integration/test_dataservice_stable_gds_query_e2e.py
```

- Source: `CMD-DATASERVICE-064`; role: `binding`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:56a53fa02d91a03c0b3c13efa0234292bdb635a19be60c1ef95074f63f417787`.
- Provenance: `SPAN-F39F2C35D45385E1`; clauses: `B2197:C1, B2198:C1, B2199:C1, B2200:C1, B2201:C1, B2201:C2, B2201:C3, B2202:C1, B2203:C1, B2204:C1, B2205:C1, B2206:C1, B2207:C1, B2208:C1, B2209:C1`.
- Command source: `TASK-DATASERVICE-007`.

### COMMAND CMD-DATASERVICE-065

```
python -m pytest -q tests/trader/test_dataservice_gds_range_snapshot.py tests/trader/test_dataservice_gds_rolling_window.py tests/chart/test_chart_dataservice_live_gds.py
```

- Source: `CMD-DATASERVICE-065`; role: `binding`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:56a53fa02d91a03c0b3c13efa0234292bdb635a19be60c1ef95074f63f417787`.
- Provenance: `SPAN-F39F2C35D45385E1`; clauses: `B2197:C1, B2198:C1, B2199:C1, B2200:C1, B2201:C1, B2201:C2, B2201:C3, B2202:C1, B2203:C1, B2204:C1, B2205:C1, B2206:C1, B2207:C1, B2208:C1, B2209:C1`.
- Command source: `TASK-DATASERVICE-007`.

### COMMAND CMD-DATASERVICE-066

```
$env:QT_QPA_PLATFORM='offscreen'; python -m pytest -q tests/integration/test_dataservice_indicator_lmdb_qt_e2e.py tests/integration/test_dataservice_all_indicators_e2e.py
```

- Source: `CMD-DATASERVICE-066`; role: `binding`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:b7ec151c688ad4bb4e8ce2712445a561760114fb65be5687637114ce43bb13bc`.
- Provenance: `SPAN-F09DD356A8366E16`; clauses: `B2213:C1, B2214:C1, B2215:C1, B2216:C1, B2217:C1, B2217:C2, B2217:C3, B2217:C4, B2218:C1, B2219:C1, B2220:C1, B2221:C1, B2222:C1, B2223:C1, B2224:C1, B2225:C1`.
- Command source: `TASK-DATASERVICE-008`.

### COMMAND CMD-DATASERVICE-067

```
$env:QT_QPA_PLATFORM='offscreen'; python -m pytest -q tests/integration/test_dataservice_indicator_lmdb_qt_e2e.py tests/integration/test_dataservice_all_indicators_e2e.py
```

- Source: `CMD-DATASERVICE-067`; role: `binding`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:b7ec151c688ad4bb4e8ce2712445a561760114fb65be5687637114ce43bb13bc`.
- Provenance: `SPAN-F09DD356A8366E16`; clauses: `B2213:C1, B2214:C1, B2215:C1, B2216:C1, B2217:C1, B2217:C2, B2217:C3, B2217:C4, B2218:C1, B2219:C1, B2220:C1, B2221:C1, B2222:C1, B2223:C1, B2224:C1, B2225:C1`.
- Command source: `TASK-DATASERVICE-008`.

### COMMAND CMD-DATASERVICE-068

```
python -m pytest -q tests/chart/test_indicator_drawing_manager_lmdb_mapping.py tests/datafeed/test_indicator_runtime_ownership.py tests/datafeed/test_indicator_no_data_bypass.py
```

- Source: `CMD-DATASERVICE-068`; role: `binding`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:b7ec151c688ad4bb4e8ce2712445a561760114fb65be5687637114ce43bb13bc`.
- Provenance: `SPAN-F09DD356A8366E16`; clauses: `B2213:C1, B2214:C1, B2215:C1, B2216:C1, B2217:C1, B2217:C2, B2217:C3, B2217:C4, B2218:C1, B2219:C1, B2220:C1, B2221:C1, B2222:C1, B2223:C1, B2224:C1, B2225:C1`.
- Command source: `TASK-DATASERVICE-008`.

### COMMAND CMD-DATASERVICE-069

```
$env:QT_QPA_PLATFORM='offscreen'; python -m pytest -q tests/integration/test_dataservice_period_open_e2e.py tests/integration/test_dataservice_indicator_lmdb_qt_e2e.py tests/integration/test_dataservice_resume_recovery_e2e.py::test_minimize_keeps_aggregation_and_resume_only_reattaches
```

- Source: `CMD-DATASERVICE-069`; role: `binding`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:0a3b6e2f1f37d68c10fd5001c9455318d86e37b9f72cc14d9fba5fb56205a98a`.
- Provenance: `SPAN-47415DB4F1CC813A`; clauses: `B2229:C1, B2230:C1, B2231:C1, B2232:C1, B2233:C1, B2233:C2, B2233:C3, B2234:C1, B2235:C1, B2236:C1, B2237:C1, B2238:C1, B2239:C1, B2239:C2, B2240:C1, B2241:C1`.
- Command source: `TASK-DATASERVICE-009`.

### COMMAND CMD-DATASERVICE-070

```
$env:QT_QPA_PLATFORM='offscreen'; python -m pytest -q tests/integration/test_dataservice_period_open_e2e.py tests/integration/test_dataservice_indicator_lmdb_qt_e2e.py tests/integration/test_dataservice_resume_recovery_e2e.py::test_minimize_keeps_aggregation_and_resume_only_reattaches
```

- Source: `CMD-DATASERVICE-070`; role: `binding`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:0a3b6e2f1f37d68c10fd5001c9455318d86e37b9f72cc14d9fba5fb56205a98a`.
- Provenance: `SPAN-47415DB4F1CC813A`; clauses: `B2229:C1, B2230:C1, B2231:C1, B2232:C1, B2233:C1, B2233:C2, B2233:C3, B2234:C1, B2235:C1, B2236:C1, B2237:C1, B2238:C1, B2239:C1, B2239:C2, B2240:C1, B2241:C1`.
- Command source: `TASK-DATASERVICE-009`.

### COMMAND CMD-DATASERVICE-071

```
$env:QT_QPA_PLATFORM='offscreen'; python -m pytest -q tests/chart/test_multi_timeframe_widget_p0_2.py tests/chart/test_multi_timeframe_daily_symbol_normalization.py tests/chart/test_productized_chart_gds_delta_render.py
```

- Source: `CMD-DATASERVICE-071`; role: `binding`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:0a3b6e2f1f37d68c10fd5001c9455318d86e37b9f72cc14d9fba5fb56205a98a`.
- Provenance: `SPAN-47415DB4F1CC813A`; clauses: `B2229:C1, B2230:C1, B2231:C1, B2232:C1, B2233:C1, B2233:C2, B2233:C3, B2234:C1, B2235:C1, B2236:C1, B2237:C1, B2238:C1, B2239:C1, B2239:C2, B2240:C1, B2241:C1`.
- Command source: `TASK-DATASERVICE-009`.

### COMMAND CMD-DATASERVICE-072

```
python -m pytest -q tests/integration/test_datarecorder_runtime_config_e2e.py tests/integration/test_datarecorder_persistence_cadence_e2e.py
```

- Source: `CMD-DATASERVICE-072`; role: `binding`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:e7bcf96f5207d2c2749a4491e748b0466c52bb1872f1953b7e8a230f74fc8a06`.
- Provenance: `SPAN-A3645BDB711B993D`; clauses: `B2245:C1, B2246:C1, B2247:C1, B2248:C1, B2249:C1, B2249:C2, B2249:C3, B2249:C4, B2250:C1, B2251:C1, B2252:C1, B2253:C1, B2254:C1, B2255:C1, B2255:C2, B2256:C1, B2257:C1`.
- Command source: `TASK-DATASERVICE-010`.

### COMMAND CMD-DATASERVICE-073

```
python -m pytest -q tests/integration/test_datarecorder_runtime_config_e2e.py tests/integration/test_datarecorder_persistence_cadence_e2e.py
```

- Source: `CMD-DATASERVICE-073`; role: `binding`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:e7bcf96f5207d2c2749a4491e748b0466c52bb1872f1953b7e8a230f74fc8a06`.
- Provenance: `SPAN-A3645BDB711B993D`; clauses: `B2245:C1, B2246:C1, B2247:C1, B2248:C1, B2249:C1, B2249:C2, B2249:C3, B2249:C4, B2250:C1, B2251:C1, B2252:C1, B2253:C1, B2254:C1, B2255:C1, B2255:C2, B2256:C1, B2257:C1`.
- Command source: `TASK-DATASERVICE-010`.

### COMMAND CMD-DATASERVICE-074

```
python -m pytest -q tests/datarecorder/test_recorder_no_local_aggregation.py
```

- Source: `CMD-DATASERVICE-074`; role: `binding`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:e7bcf96f5207d2c2749a4491e748b0466c52bb1872f1953b7e8a230f74fc8a06`.
- Provenance: `SPAN-A3645BDB711B993D`; clauses: `B2245:C1, B2246:C1, B2247:C1, B2248:C1, B2249:C1, B2249:C2, B2249:C3, B2249:C4, B2250:C1, B2251:C1, B2252:C1, B2253:C1, B2254:C1, B2255:C1, B2255:C2, B2256:C1, B2257:C1`.
- Command source: `TASK-DATASERVICE-010`.

### COMMAND CMD-DATASERVICE-075

```
python -m pytest -q tests/integration/test_datarecorder_persistence_cadence_e2e.py tests/integration/test_datarecorder_delivery_recovery_e2e.py tests/integration/test_dataservice_resume_recovery_e2e.py::test_completed_log_overrun_recovers_period_db_without_tick_reaggregation
```

- Source: `CMD-DATASERVICE-075`; role: `binding`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:91e953f1259ec37c0557f895b85de16bdb52f378e91e3452723aca513dfbdbc1`.
- Provenance: `SPAN-0DA35C6E5F562706`; clauses: `B2261:C1, B2262:C1, B2263:C1, B2264:C1, B2265:C1, B2265:C2, B2266:C1, B2267:C1, B2268:C1, B2269:C1, B2270:C1, B2271:C1, B2271:C2, B2272:C1, B2273:C1`.
- Command source: `TASK-DATASERVICE-011`.

### COMMAND CMD-DATASERVICE-076

```
python -m pytest -q tests/integration/test_datarecorder_persistence_cadence_e2e.py tests/integration/test_datarecorder_delivery_recovery_e2e.py tests/integration/test_dataservice_resume_recovery_e2e.py::test_completed_log_overrun_recovers_period_db_without_tick_reaggregation
```

- Source: `CMD-DATASERVICE-076`; role: `binding`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:91e953f1259ec37c0557f895b85de16bdb52f378e91e3452723aca513dfbdbc1`.
- Provenance: `SPAN-0DA35C6E5F562706`; clauses: `B2261:C1, B2262:C1, B2263:C1, B2264:C1, B2265:C1, B2265:C2, B2266:C1, B2267:C1, B2268:C1, B2269:C1, B2270:C1, B2271:C1, B2271:C2, B2272:C1, B2273:C1`.
- Command source: `TASK-DATASERVICE-011`.

### COMMAND CMD-DATASERVICE-077

```
python -m pytest -q tests/datarecorder/test_recorder_no_local_aggregation.py tests/trader/test_dataservice_gds_rolling_window.py
```

- Source: `CMD-DATASERVICE-077`; role: `binding`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:91e953f1259ec37c0557f895b85de16bdb52f378e91e3452723aca513dfbdbc1`.
- Provenance: `SPAN-0DA35C6E5F562706`; clauses: `B2261:C1, B2262:C1, B2263:C1, B2264:C1, B2265:C1, B2265:C2, B2266:C1, B2267:C1, B2268:C1, B2269:C1, B2270:C1, B2271:C1, B2271:C2, B2272:C1, B2273:C1`.
- Command source: `TASK-DATASERVICE-011`.

### COMMAND CMD-DATASERVICE-078

```
$env:QT_QPA_PLATFORM='offscreen'; python -m pytest -q tests/integration/test_dataservice_cta_callback_e2e.py tests/integration/test_dataservice_eventengine_compatibility_e2e.py tests/integration/test_futu_chase_execution_quote_e2e.py tests/integration/test_dataservice_quote_orderbook_ingress_e2e.py::test_startup_replay_publishes_tick_once
```

- Source: `CMD-DATASERVICE-078`; role: `binding`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:25b6c37e68893db734e570c88358a009719190b2a5c7f86360b3a8489a22dd5b`.
- Provenance: `SPAN-39593A6859452F40`; clauses: `B2277:C1, B2278:C1, B2279:C1, B2280:C1, B2281:C1, B2281:C2, B2281:C3, B2282:C1, B2283:C1, B2284:C1, B2285:C1, B2286:C1, B2287:C1, B2287:C2, B2288:C1, B2289:C1`.
- Command source: `TASK-DATASERVICE-012`.

### COMMAND CMD-DATASERVICE-079

```
$env:QT_QPA_PLATFORM='offscreen'; python -m pytest -q tests/integration/test_dataservice_cta_callback_e2e.py tests/integration/test_dataservice_eventengine_compatibility_e2e.py tests/integration/test_futu_chase_execution_quote_e2e.py tests/integration/test_dataservice_quote_orderbook_ingress_e2e.py::test_startup_replay_publishes_tick_once
```

- Source: `CMD-DATASERVICE-079`; role: `binding`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:25b6c37e68893db734e570c88358a009719190b2a5c7f86360b3a8489a22dd5b`.
- Provenance: `SPAN-39593A6859452F40`; clauses: `B2277:C1, B2278:C1, B2279:C1, B2280:C1, B2281:C1, B2281:C2, B2281:C3, B2282:C1, B2283:C1, B2284:C1, B2285:C1, B2286:C1, B2287:C1, B2287:C2, B2288:C1, B2289:C1`.
- Command source: `TASK-DATASERVICE-012`.

### COMMAND CMD-DATASERVICE-080

```
python -m pytest -q tests/trader/test_futu_quote_owner_handoff.py tests/ui/test_dataservice_market_ui.py tests/chart/test_widget_trigger.py
```

- Source: `CMD-DATASERVICE-080`; role: `binding`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:25b6c37e68893db734e570c88358a009719190b2a5c7f86360b3a8489a22dd5b`.
- Provenance: `SPAN-39593A6859452F40`; clauses: `B2277:C1, B2278:C1, B2279:C1, B2280:C1, B2281:C1, B2281:C2, B2281:C3, B2282:C1, B2283:C1, B2284:C1, B2285:C1, B2286:C1, B2287:C1, B2287:C2, B2288:C1, B2289:C1`.
- Command source: `TASK-DATASERVICE-012`.

### COMMAND CMD-DATASERVICE-081

```
python -m pytest -q tests/integration/test_trigger_candidate_execution_e2e.py
```

- Source: `CMD-DATASERVICE-081`; role: `binding`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:abc4256c5a1af06d48c86b37447be58b86ad813a49fa3b12464860c55b62afd7`.
- Provenance: `SPAN-609F55D9D3FBA959`; clauses: `B2293:C1, B2294:C1, B2295:C1, B2296:C1, B2297:C1, B2297:C2, B2297:C3, B2297:C4, B2297:C5, B2298:C1, B2299:C1, B2300:C1, B2301:C1, B2302:C1, B2303:C1, B2303:C2, B2304:C1, B2305:C1`.
- Command source: `TASK-DATASERVICE-013`.

### COMMAND CMD-DATASERVICE-082

```
python -m pytest -q tests/integration/test_trigger_candidate_execution_e2e.py
```

- Source: `CMD-DATASERVICE-082`; role: `binding`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:abc4256c5a1af06d48c86b37447be58b86ad813a49fa3b12464860c55b62afd7`.
- Provenance: `SPAN-609F55D9D3FBA959`; clauses: `B2293:C1, B2294:C1, B2295:C1, B2296:C1, B2297:C1, B2297:C2, B2297:C3, B2297:C4, B2297:C5, B2298:C1, B2299:C1, B2300:C1, B2301:C1, B2302:C1, B2303:C1, B2303:C2, B2304:C1, B2305:C1`.
- Command source: `TASK-DATASERVICE-013`.

### COMMAND CMD-DATASERVICE-083

```
python -m pytest -q tests/chart/test_widget_trigger.py tests/trader/test_root_runtime_process_ownership.py
```

- Source: `CMD-DATASERVICE-083`; role: `binding`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:abc4256c5a1af06d48c86b37447be58b86ad813a49fa3b12464860c55b62afd7`.
- Provenance: `SPAN-609F55D9D3FBA959`; clauses: `B2293:C1, B2294:C1, B2295:C1, B2296:C1, B2297:C1, B2297:C2, B2297:C3, B2297:C4, B2297:C5, B2298:C1, B2299:C1, B2300:C1, B2301:C1, B2302:C1, B2303:C1, B2303:C2, B2304:C1, B2305:C1`.
- Command source: `TASK-DATASERVICE-013`.

### COMMAND CMD-DATASERVICE-084

```
python -m pytest -q tests/integration/test_dataservice_stable_gds_query_e2e.py tests/integration/test_dataservice_resume_recovery_e2e.py
```

- Source: `CMD-DATASERVICE-084`; role: `binding`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:75c6d39169d568e104fc5f718519e773da05d0d777306de18caefe736ad28424`.
- Provenance: `SPAN-EF1BAE0004F2A7EE`; clauses: `B2309:C1, B2310:C1, B2311:C1, B2312:C1, B2313:C1, B2313:C2, B2313:C3, B2313:C4, B2313:C5, B2313:C6, B2314:C1, B2315:C1, B2316:C1, B2317:C1, B2318:C1, B2319:C1, B2319:C2, B2320:C1, B2321:C1`.
- Command source: `TASK-DATASERVICE-014`.

### COMMAND CMD-DATASERVICE-085

```
python -m pytest -q tests/integration/test_dataservice_stable_gds_query_e2e.py tests/integration/test_dataservice_resume_recovery_e2e.py
```

- Source: `CMD-DATASERVICE-085`; role: `binding`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:75c6d39169d568e104fc5f718519e773da05d0d777306de18caefe736ad28424`.
- Provenance: `SPAN-EF1BAE0004F2A7EE`; clauses: `B2309:C1, B2310:C1, B2311:C1, B2312:C1, B2313:C1, B2313:C2, B2313:C3, B2313:C4, B2313:C5, B2313:C6, B2314:C1, B2315:C1, B2316:C1, B2317:C1, B2318:C1, B2319:C1, B2319:C2, B2320:C1, B2321:C1`.
- Command source: `TASK-DATASERVICE-014`.

### COMMAND CMD-DATASERVICE-086

```
python -m pytest -q tests/chart/test_chart_async_history_retry.py tests/chart/test_chart_dataservice_session.py tests/trader/test_dataservice_query_runtime.py tests/trader/test_runtime_supervisor_lifecycle.py
```

- Source: `CMD-DATASERVICE-086`; role: `binding`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:75c6d39169d568e104fc5f718519e773da05d0d777306de18caefe736ad28424`.
- Provenance: `SPAN-EF1BAE0004F2A7EE`; clauses: `B2309:C1, B2310:C1, B2311:C1, B2312:C1, B2313:C1, B2313:C2, B2313:C3, B2313:C4, B2313:C5, B2313:C6, B2314:C1, B2315:C1, B2316:C1, B2317:C1, B2318:C1, B2319:C1, B2319:C2, B2320:C1, B2321:C1`.
- Command source: `TASK-DATASERVICE-014`.

### COMMAND CMD-DATASERVICE-003

```
python -m pytest -q tests/integration/test_dataservice_cold_hot_effective_series_e2e.py::test_cold_completed_and_current_last
```

- Source: `CMD-DATASERVICE-003`; role: `binding`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:2b27c5e9592d2fefc2fb192e7828ee7eb132f01a96b379fca1a93f1c298ba49d`.
- Provenance: `SPAN-5252D08D7475DBFF`; clauses: `B2325:C1, B2326:C1, B2327:C1, B2328:C1, B2329:C1, B2329:C2, B2329:C3, B2330:C1, B2331:C1, B2332:C1, B2333:C1, B2334:C1, B2335:C1, B2335:C2, B2335:C3, B2336:C1, B2337:C1`.
- Command source: `TASK-DATASERVICE-015`.

### COMMAND CMD-DATASERVICE-004

```
python -m pytest -q tests/integration/test_dataservice_cold_hot_effective_series_e2e.py::test_recorder_commit_does_not_change_effective_series
```

- Source: `CMD-DATASERVICE-004`; role: `binding`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:2b27c5e9592d2fefc2fb192e7828ee7eb132f01a96b379fca1a93f1c298ba49d`.
- Provenance: `SPAN-5252D08D7475DBFF`; clauses: `B2325:C1, B2326:C1, B2327:C1, B2328:C1, B2329:C1, B2329:C2, B2329:C3, B2330:C1, B2331:C1, B2332:C1, B2333:C1, B2334:C1, B2335:C1, B2335:C2, B2335:C3, B2336:C1, B2337:C1`.
- Command source: `TASK-DATASERVICE-015`.

### COMMAND CMD-DATASERVICE-005

```
python -m pytest -q tests/integration/test_dataservice_datamanager_repair_e2e.py::test_conflict_uses_db_then_rebuilds_from_repaired_1m
```

- Source: `CMD-DATASERVICE-005`; role: `binding`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:2b27c5e9592d2fefc2fb192e7828ee7eb132f01a96b379fca1a93f1c298ba49d`.
- Provenance: `SPAN-5252D08D7475DBFF`; clauses: `B2325:C1, B2326:C1, B2327:C1, B2328:C1, B2329:C1, B2329:C2, B2329:C3, B2330:C1, B2331:C1, B2332:C1, B2333:C1, B2334:C1, B2335:C1, B2335:C2, B2335:C3, B2336:C1, B2337:C1`.
- Command source: `TASK-DATASERVICE-015`.

### COMMAND CMD-DATASERVICE-006

```
python -m pytest -q tests/integration/test_dataservice_datamanager_repair_e2e.py::test_middle_four_hour_gap_is_filled_before_publish
```

- Source: `CMD-DATASERVICE-006`; role: `binding`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:2b27c5e9592d2fefc2fb192e7828ee7eb132f01a96b379fca1a93f1c298ba49d`.
- Provenance: `SPAN-5252D08D7475DBFF`; clauses: `B2325:C1, B2326:C1, B2327:C1, B2328:C1, B2329:C1, B2329:C2, B2329:C3, B2330:C1, B2331:C1, B2332:C1, B2333:C1, B2334:C1, B2335:C1, B2335:C2, B2335:C3, B2336:C1, B2337:C1`.
- Command source: `TASK-DATASERVICE-015`.

### COMMAND CMD-DATASERVICE-007

```
python -m pytest -q tests/integration/test_dataservice_datamanager_repair_e2e.py::test_failed_repair_keeps_unaffected_series_live
```

- Source: `CMD-DATASERVICE-007`; role: `binding`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:2b27c5e9592d2fefc2fb192e7828ee7eb132f01a96b379fca1a93f1c298ba49d`.
- Provenance: `SPAN-5252D08D7475DBFF`; clauses: `B2325:C1, B2326:C1, B2327:C1, B2328:C1, B2329:C1, B2329:C2, B2329:C3, B2330:C1, B2331:C1, B2332:C1, B2333:C1, B2334:C1, B2335:C1, B2335:C2, B2335:C3, B2336:C1, B2337:C1`.
- Command source: `TASK-DATASERVICE-015`.

### COMMAND CMD-DATASERVICE-008

```
python -m pytest -q tests/integration/test_dataservice_period_open_e2e.py::test_v2_mid_period_4h_open_comes_from_2100_minute
```

- Source: `CMD-DATASERVICE-008`; role: `binding`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:2b27c5e9592d2fefc2fb192e7828ee7eb132f01a96b379fca1a93f1c298ba49d`.
- Provenance: `SPAN-5252D08D7475DBFF`; clauses: `B2325:C1, B2326:C1, B2327:C1, B2328:C1, B2329:C1, B2329:C2, B2329:C3, B2330:C1, B2331:C1, B2332:C1, B2333:C1, B2334:C1, B2335:C1, B2335:C2, B2335:C3, B2336:C1, B2337:C1`.
- Command source: `TASK-DATASERVICE-015`.

### COMMAND CMD-DATASERVICE-009

```
python -m pytest -q tests/integration/test_dataservice_period_open_e2e.py::test_v1_v2_daily_and_4h_open_matrix
```

- Source: `CMD-DATASERVICE-009`; role: `binding`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:2b27c5e9592d2fefc2fb192e7828ee7eb132f01a96b379fca1a93f1c298ba49d`.
- Provenance: `SPAN-5252D08D7475DBFF`; clauses: `B2325:C1, B2326:C1, B2327:C1, B2328:C1, B2329:C1, B2329:C2, B2329:C3, B2330:C1, B2331:C1, B2332:C1, B2333:C1, B2334:C1, B2335:C1, B2335:C2, B2335:C3, B2336:C1, B2337:C1`.
- Command source: `TASK-DATASERVICE-015`.

### COMMAND CMD-DATASERVICE-010

```
python -m pytest -q tests/integration/test_dataservice_period_open_e2e.py::test_missing_period_start_is_repaired_without_later_minute_fallback
```

- Source: `CMD-DATASERVICE-010`; role: `binding`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:2b27c5e9592d2fefc2fb192e7828ee7eb132f01a96b379fca1a93f1c298ba49d`.
- Provenance: `SPAN-5252D08D7475DBFF`; clauses: `B2325:C1, B2326:C1, B2327:C1, B2328:C1, B2329:C1, B2329:C2, B2329:C3, B2330:C1, B2331:C1, B2332:C1, B2333:C1, B2334:C1, B2335:C1, B2335:C2, B2335:C3, B2336:C1, B2337:C1`.
- Command source: `TASK-DATASERVICE-015`.

### COMMAND CMD-DATASERVICE-011

```
python -m pytest -q tests/integration/test_dataservice_quote_orderbook_ingress_e2e.py::test_quote_orderbook_preserve_tick_and_volume_semantics
```

- Source: `CMD-DATASERVICE-011`; role: `binding`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:2b27c5e9592d2fefc2fb192e7828ee7eb132f01a96b379fca1a93f1c298ba49d`.
- Provenance: `SPAN-5252D08D7475DBFF`; clauses: `B2325:C1, B2326:C1, B2327:C1, B2328:C1, B2329:C1, B2329:C2, B2329:C3, B2330:C1, B2331:C1, B2332:C1, B2333:C1, B2334:C1, B2335:C1, B2335:C2, B2335:C3, B2336:C1, B2337:C1`.
- Command source: `TASK-DATASERVICE-015`.

### COMMAND CMD-DATASERVICE-012

```
python -m pytest -q tests/integration/test_dataservice_tick_continuity_e2e.py::test_throttle_late_tick_and_overrun_are_distinct
```

- Source: `CMD-DATASERVICE-012`; role: `binding`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:2b27c5e9592d2fefc2fb192e7828ee7eb132f01a96b379fca1a93f1c298ba49d`.
- Provenance: `SPAN-5252D08D7475DBFF`; clauses: `B2325:C1, B2326:C1, B2327:C1, B2328:C1, B2329:C1, B2329:C2, B2329:C3, B2330:C1, B2331:C1, B2332:C1, B2333:C1, B2334:C1, B2335:C1, B2335:C2, B2335:C3, B2336:C1, B2337:C1`.
- Command source: `TASK-DATASERVICE-015`.

### COMMAND CMD-DATASERVICE-013

```
$env:QT_QPA_PLATFORM='offscreen'; python -m pytest -q tests/integration/test_dataservice_indicator_lmdb_qt_e2e.py::test_5m_boll_current_rollover_and_plot
```

- Source: `CMD-DATASERVICE-013`; role: `binding`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:2b27c5e9592d2fefc2fb192e7828ee7eb132f01a96b379fca1a93f1c298ba49d`.
- Provenance: `SPAN-5252D08D7475DBFF`; clauses: `B2325:C1, B2326:C1, B2327:C1, B2328:C1, B2329:C1, B2329:C2, B2329:C3, B2330:C1, B2331:C1, B2332:C1, B2333:C1, B2334:C1, B2335:C1, B2335:C2, B2335:C3, B2336:C1, B2337:C1`.
- Command source: `TASK-DATASERVICE-015`.

### COMMAND CMD-DATASERVICE-014

```
$env:QT_QPA_PLATFORM='offscreen'; python -m pytest -q tests/integration/test_dataservice_all_indicators_e2e.py::test_all_registered_indicators_use_legacy_chain
```

- Source: `CMD-DATASERVICE-014`; role: `binding`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:2b27c5e9592d2fefc2fb192e7828ee7eb132f01a96b379fca1a93f1c298ba49d`.
- Provenance: `SPAN-5252D08D7475DBFF`; clauses: `B2325:C1, B2326:C1, B2327:C1, B2328:C1, B2329:C1, B2329:C2, B2329:C3, B2330:C1, B2331:C1, B2332:C1, B2333:C1, B2334:C1, B2335:C1, B2335:C2, B2335:C3, B2336:C1, B2337:C1`.
- Command source: `TASK-DATASERVICE-015`.

### COMMAND CMD-DATASERVICE-015

```
$env:QT_QPA_PLATFORM='offscreen'; python -m pytest -q tests/integration/test_dataservice_indicator_lmdb_qt_e2e.py::test_lmdb_u0_u1_mapping_reaches_real_plot_item
```

- Source: `CMD-DATASERVICE-015`; role: `binding`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:2b27c5e9592d2fefc2fb192e7828ee7eb132f01a96b379fca1a93f1c298ba49d`.
- Provenance: `SPAN-5252D08D7475DBFF`; clauses: `B2325:C1, B2326:C1, B2327:C1, B2328:C1, B2329:C1, B2329:C2, B2329:C3, B2330:C1, B2331:C1, B2332:C1, B2333:C1, B2334:C1, B2335:C1, B2335:C2, B2335:C3, B2336:C1, B2337:C1`.
- Command source: `TASK-DATASERVICE-015`.

### COMMAND CMD-DATASERVICE-016

```
python -m pytest -q tests/integration/test_datarecorder_runtime_config_e2e.py::test_add_pause_resume_delete_apply_at_consume_boundary
```

- Source: `CMD-DATASERVICE-016`; role: `binding`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:2b27c5e9592d2fefc2fb192e7828ee7eb132f01a96b379fca1a93f1c298ba49d`.
- Provenance: `SPAN-5252D08D7475DBFF`; clauses: `B2325:C1, B2326:C1, B2327:C1, B2328:C1, B2329:C1, B2329:C2, B2329:C3, B2330:C1, B2331:C1, B2332:C1, B2333:C1, B2334:C1, B2335:C1, B2335:C2, B2335:C3, B2336:C1, B2337:C1`.
- Command source: `TASK-DATASERVICE-015`.

### COMMAND CMD-DATASERVICE-017

```
python -m pytest -q tests/integration/test_datarecorder_persistence_cadence_e2e.py::test_rollover_batch_preserves_persistence_cadence
```

- Source: `CMD-DATASERVICE-017`; role: `binding`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:2b27c5e9592d2fefc2fb192e7828ee7eb132f01a96b379fca1a93f1c298ba49d`.
- Provenance: `SPAN-5252D08D7475DBFF`; clauses: `B2325:C1, B2326:C1, B2327:C1, B2328:C1, B2329:C1, B2329:C2, B2329:C3, B2330:C1, B2331:C1, B2332:C1, B2333:C1, B2334:C1, B2335:C1, B2335:C2, B2335:C3, B2336:C1, B2337:C1`.
- Command source: `TASK-DATASERVICE-015`.

### COMMAND CMD-DATASERVICE-018

```
python -m pytest -q tests/integration/test_datarecorder_delivery_recovery_e2e.py::test_crash_before_commit_replays_same_batch
```

- Source: `CMD-DATASERVICE-018`; role: `binding`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:2b27c5e9592d2fefc2fb192e7828ee7eb132f01a96b379fca1a93f1c298ba49d`.
- Provenance: `SPAN-5252D08D7475DBFF`; clauses: `B2325:C1, B2326:C1, B2327:C1, B2328:C1, B2329:C1, B2329:C2, B2329:C3, B2330:C1, B2331:C1, B2332:C1, B2333:C1, B2334:C1, B2335:C1, B2335:C2, B2335:C3, B2336:C1, B2337:C1`.
- Command source: `TASK-DATASERVICE-015`.

### COMMAND CMD-DATASERVICE-019

```
python -m pytest -q tests/integration/test_dataservice_cta_callback_e2e.py::test_cta_private_bar_generator_callbacks_match_baseline
```

- Source: `CMD-DATASERVICE-019`; role: `binding`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:2b27c5e9592d2fefc2fb192e7828ee7eb132f01a96b379fca1a93f1c298ba49d`.
- Provenance: `SPAN-5252D08D7475DBFF`; clauses: `B2325:C1, B2326:C1, B2327:C1, B2328:C1, B2329:C1, B2329:C2, B2329:C3, B2330:C1, B2331:C1, B2332:C1, B2333:C1, B2334:C1, B2335:C1, B2335:C2, B2335:C3, B2336:C1, B2337:C1`.
- Command source: `TASK-DATASERVICE-015`.

### COMMAND CMD-DATASERVICE-020

```
$env:QT_QPA_PLATFORM='offscreen'; python -m pytest -q tests/integration/test_dataservice_eventengine_compatibility_e2e.py::test_event_tick_updates_oms_and_manual_trading
```

- Source: `CMD-DATASERVICE-020`; role: `binding`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:2b27c5e9592d2fefc2fb192e7828ee7eb132f01a96b379fca1a93f1c298ba49d`.
- Provenance: `SPAN-5252D08D7475DBFF`; clauses: `B2325:C1, B2326:C1, B2327:C1, B2328:C1, B2329:C1, B2329:C2, B2329:C3, B2330:C1, B2331:C1, B2332:C1, B2333:C1, B2334:C1, B2335:C1, B2335:C2, B2335:C3, B2336:C1, B2337:C1`.
- Command source: `TASK-DATASERVICE-015`.

### COMMAND CMD-DATASERVICE-021

```
python -m pytest -q tests/integration/test_futu_chase_execution_quote_e2e.py::test_tick_wakes_replace_path_with_actual_symbol
```

- Source: `CMD-DATASERVICE-021`; role: `binding`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:2b27c5e9592d2fefc2fb192e7828ee7eb132f01a96b379fca1a93f1c298ba49d`.
- Provenance: `SPAN-5252D08D7475DBFF`; clauses: `B2325:C1, B2326:C1, B2327:C1, B2328:C1, B2329:C1, B2329:C2, B2329:C3, B2330:C1, B2331:C1, B2332:C1, B2333:C1, B2334:C1, B2335:C1, B2335:C2, B2335:C3, B2336:C1, B2337:C1`.
- Command source: `TASK-DATASERVICE-015`.

### COMMAND CMD-DATASERVICE-022

```
python -m pytest -q tests/integration/test_trigger_candidate_execution_e2e.py::test_trigger_tick_submits_one_stable_intent
```

- Source: `CMD-DATASERVICE-022`; role: `binding`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:2b27c5e9592d2fefc2fb192e7828ee7eb132f01a96b379fca1a93f1c298ba49d`.
- Provenance: `SPAN-5252D08D7475DBFF`; clauses: `B2325:C1, B2326:C1, B2327:C1, B2328:C1, B2329:C1, B2329:C2, B2329:C3, B2330:C1, B2331:C1, B2332:C1, B2333:C1, B2334:C1, B2335:C1, B2335:C2, B2335:C3, B2336:C1, B2337:C1`.
- Command source: `TASK-DATASERVICE-015`.

### COMMAND CMD-DATASERVICE-023

```
python -m pytest -q tests/integration/test_dataservice_active_symbol_e2e.py::test_logical_active_switch_seals_and_fences_old_stream
```

- Source: `CMD-DATASERVICE-023`; role: `binding`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:2b27c5e9592d2fefc2fb192e7828ee7eb132f01a96b379fca1a93f1c298ba49d`.
- Provenance: `SPAN-5252D08D7475DBFF`; clauses: `B2325:C1, B2326:C1, B2327:C1, B2328:C1, B2329:C1, B2329:C2, B2329:C3, B2330:C1, B2331:C1, B2332:C1, B2333:C1, B2334:C1, B2335:C1, B2335:C2, B2335:C3, B2336:C1, B2337:C1`.
- Command source: `TASK-DATASERVICE-015`.

### COMMAND CMD-DATASERVICE-024

```
python -m pytest -q tests/integration/test_dataservice_main_contract_mapping_e2e.py::test_actual_rollover_keeps_canonical_stream_identity
```

- Source: `CMD-DATASERVICE-024`; role: `binding`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:2b27c5e9592d2fefc2fb192e7828ee7eb132f01a96b379fca1a93f1c298ba49d`.
- Provenance: `SPAN-5252D08D7475DBFF`; clauses: `B2325:C1, B2326:C1, B2327:C1, B2328:C1, B2329:C1, B2329:C2, B2329:C3, B2330:C1, B2331:C1, B2332:C1, B2333:C1, B2334:C1, B2335:C1, B2335:C2, B2335:C3, B2336:C1, B2337:C1`.
- Command source: `TASK-DATASERVICE-015`.

### COMMAND CMD-DATASERVICE-025

```
python -m pytest -q tests/integration/test_dataservice_stable_gds_query_e2e.py::test_stable_gds_shared_descriptor_and_no_retry_storm
```

- Source: `CMD-DATASERVICE-025`; role: `binding`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:2b27c5e9592d2fefc2fb192e7828ee7eb132f01a96b379fca1a93f1c298ba49d`.
- Provenance: `SPAN-5252D08D7475DBFF`; clauses: `B2325:C1, B2326:C1, B2327:C1, B2328:C1, B2329:C1, B2329:C2, B2329:C3, B2330:C1, B2331:C1, B2332:C1, B2333:C1, B2334:C1, B2335:C1, B2335:C2, B2335:C3, B2336:C1, B2337:C1`.
- Command source: `TASK-DATASERVICE-015`.

### COMMAND CMD-DATASERVICE-026

```
$env:QT_QPA_PLATFORM='offscreen'; python -m pytest -q tests/integration/test_dataservice_resume_recovery_e2e.py::test_minimize_keeps_aggregation_and_resume_only_reattaches
```

- Source: `CMD-DATASERVICE-026`; role: `binding`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:2b27c5e9592d2fefc2fb192e7828ee7eb132f01a96b379fca1a93f1c298ba49d`.
- Provenance: `SPAN-5252D08D7475DBFF`; clauses: `B2325:C1, B2326:C1, B2327:C1, B2328:C1, B2329:C1, B2329:C2, B2329:C3, B2330:C1, B2331:C1, B2332:C1, B2333:C1, B2334:C1, B2335:C1, B2335:C2, B2335:C3, B2336:C1, B2337:C1`.
- Command source: `TASK-DATASERVICE-015`.

### COMMAND CMD-DATASERVICE-027

```
python -m pytest -q tests/integration/test_dataservice_quote_orderbook_ingress_e2e.py::test_startup_replay_publishes_tick_once
```

- Source: `CMD-DATASERVICE-027`; role: `binding`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:2b27c5e9592d2fefc2fb192e7828ee7eb132f01a96b379fca1a93f1c298ba49d`.
- Provenance: `SPAN-5252D08D7475DBFF`; clauses: `B2325:C1, B2326:C1, B2327:C1, B2328:C1, B2329:C1, B2329:C2, B2329:C3, B2330:C1, B2331:C1, B2332:C1, B2333:C1, B2334:C1, B2335:C1, B2335:C2, B2335:C3, B2336:C1, B2337:C1`.
- Command source: `TASK-DATASERVICE-015`.

### COMMAND CMD-DATASERVICE-028

```
$env:QT_QPA_PLATFORM='offscreen'; python -m pytest -q tests/integration/test_dataservice_indicator_lmdb_qt_e2e.py::test_coverage_segments_break_plot_without_fake_bars
```

- Source: `CMD-DATASERVICE-028`; role: `binding`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:2b27c5e9592d2fefc2fb192e7828ee7eb132f01a96b379fca1a93f1c298ba49d`.
- Provenance: `SPAN-5252D08D7475DBFF`; clauses: `B2325:C1, B2326:C1, B2327:C1, B2328:C1, B2329:C1, B2329:C2, B2329:C3, B2330:C1, B2331:C1, B2332:C1, B2333:C1, B2334:C1, B2335:C1, B2335:C2, B2335:C3, B2336:C1, B2337:C1`.
- Command source: `TASK-DATASERVICE-015`.

### COMMAND CMD-DATASERVICE-029

```
python -m pytest -q tests/integration/test_datarecorder_delivery_recovery_e2e.py::test_crash_after_commit_before_checkpoint_replays_identically
```

- Source: `CMD-DATASERVICE-029`; role: `binding`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:2b27c5e9592d2fefc2fb192e7828ee7eb132f01a96b379fca1a93f1c298ba49d`.
- Provenance: `SPAN-5252D08D7475DBFF`; clauses: `B2325:C1, B2326:C1, B2327:C1, B2328:C1, B2329:C1, B2329:C2, B2329:C3, B2330:C1, B2331:C1, B2332:C1, B2333:C1, B2334:C1, B2335:C1, B2335:C2, B2335:C3, B2336:C1, B2337:C1`.
- Command source: `TASK-DATASERVICE-015`.

### COMMAND CMD-DATASERVICE-030

```
python -m pytest -q tests/integration/test_datarecorder_delivery_recovery_e2e.py::test_crash_after_checkpoint_before_ack_resends_ack
```

- Source: `CMD-DATASERVICE-030`; role: `binding`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:2b27c5e9592d2fefc2fb192e7828ee7eb132f01a96b379fca1a93f1c298ba49d`.
- Provenance: `SPAN-5252D08D7475DBFF`; clauses: `B2325:C1, B2326:C1, B2327:C1, B2328:C1, B2329:C1, B2329:C2, B2329:C3, B2330:C1, B2331:C1, B2332:C1, B2333:C1, B2334:C1, B2335:C1, B2335:C2, B2335:C3, B2336:C1, B2337:C1`.
- Command source: `TASK-DATASERVICE-015`.

### COMMAND CMD-DATASERVICE-031

```
python -m pytest -q tests/integration/test_datarecorder_delivery_recovery_e2e.py::test_crash_replay_keeps_original_batch_selection
```

- Source: `CMD-DATASERVICE-031`; role: `binding`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:2b27c5e9592d2fefc2fb192e7828ee7eb132f01a96b379fca1a93f1c298ba49d`.
- Provenance: `SPAN-5252D08D7475DBFF`; clauses: `B2325:C1, B2326:C1, B2327:C1, B2328:C1, B2329:C1, B2329:C2, B2329:C3, B2330:C1, B2331:C1, B2332:C1, B2333:C1, B2334:C1, B2335:C1, B2335:C2, B2335:C3, B2336:C1, B2337:C1`.
- Command source: `TASK-DATASERVICE-015`.

### COMMAND CMD-DATASERVICE-032

```
python -m pytest -q tests/integration/test_trigger_candidate_execution_e2e.py::test_missing_ack_enters_delivery_degraded_and_recovers
```

- Source: `CMD-DATASERVICE-032`; role: `binding`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:2b27c5e9592d2fefc2fb192e7828ee7eb132f01a96b379fca1a93f1c298ba49d`.
- Provenance: `SPAN-5252D08D7475DBFF`; clauses: `B2325:C1, B2326:C1, B2327:C1, B2328:C1, B2329:C1, B2329:C2, B2329:C3, B2330:C1, B2331:C1, B2332:C1, B2333:C1, B2334:C1, B2335:C1, B2335:C2, B2335:C3, B2336:C1, B2337:C1`.
- Command source: `TASK-DATASERVICE-015`.

### COMMAND CMD-DATASERVICE-033

```
python -m pytest -q tests/integration/test_trigger_candidate_execution_e2e.py::test_ring_overrun_rechecks_latest_tick_and_recovers
```

- Source: `CMD-DATASERVICE-033`; role: `binding`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:2b27c5e9592d2fefc2fb192e7828ee7eb132f01a96b379fca1a93f1c298ba49d`.
- Provenance: `SPAN-5252D08D7475DBFF`; clauses: `B2325:C1, B2326:C1, B2327:C1, B2328:C1, B2329:C1, B2329:C2, B2329:C3, B2330:C1, B2331:C1, B2332:C1, B2333:C1, B2334:C1, B2335:C1, B2335:C2, B2335:C3, B2336:C1, B2337:C1`.
- Command source: `TASK-DATASERVICE-015`.

### COMMAND CMD-DATASERVICE-034

```
python -m pytest -q tests/integration/test_trigger_candidate_execution_e2e.py::test_pending_candidate_revalidated_across_actual_rollover
```

- Source: `CMD-DATASERVICE-034`; role: `binding`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:2b27c5e9592d2fefc2fb192e7828ee7eb132f01a96b379fca1a93f1c298ba49d`.
- Provenance: `SPAN-5252D08D7475DBFF`; clauses: `B2325:C1, B2326:C1, B2327:C1, B2328:C1, B2329:C1, B2329:C2, B2329:C3, B2330:C1, B2331:C1, B2332:C1, B2333:C1, B2334:C1, B2335:C1, B2335:C2, B2335:C3, B2336:C1, B2337:C1`.
- Command source: `TASK-DATASERVICE-015`.

### COMMAND CMD-DATASERVICE-035

```
python -m pytest -q tests/integration/test_dataservice_active_symbol_e2e.py::test_failed_target_coverage_keeps_old_active
```

- Source: `CMD-DATASERVICE-035`; role: `binding`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:2b27c5e9592d2fefc2fb192e7828ee7eb132f01a96b379fca1a93f1c298ba49d`.
- Provenance: `SPAN-5252D08D7475DBFF`; clauses: `B2325:C1, B2326:C1, B2327:C1, B2328:C1, B2329:C1, B2329:C2, B2329:C3, B2330:C1, B2331:C1, B2332:C1, B2333:C1, B2334:C1, B2335:C1, B2335:C2, B2335:C3, B2336:C1, B2337:C1`.
- Command source: `TASK-DATASERVICE-015`.

### COMMAND CMD-DATASERVICE-036

```
python -m pytest -q tests/integration/test_dataservice_active_symbol_e2e.py::test_switch_back_same_symbol_uses_new_active_generation
```

- Source: `CMD-DATASERVICE-036`; role: `binding`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:2b27c5e9592d2fefc2fb192e7828ee7eb132f01a96b379fca1a93f1c298ba49d`.
- Provenance: `SPAN-5252D08D7475DBFF`; clauses: `B2325:C1, B2326:C1, B2327:C1, B2328:C1, B2329:C1, B2329:C2, B2329:C3, B2330:C1, B2331:C1, B2332:C1, B2333:C1, B2334:C1, B2335:C1, B2335:C2, B2335:C3, B2336:C1, B2337:C1`.
- Command source: `TASK-DATASERVICE-015`.

### COMMAND CMD-DATASERVICE-037

```
python -m pytest -q tests/integration/test_dataservice_main_contract_mapping_e2e.py::test_actual_callbacks_are_fenced_by_dispatcher_switch_order
```

- Source: `CMD-DATASERVICE-037`; role: `binding`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:2b27c5e9592d2fefc2fb192e7828ee7eb132f01a96b379fca1a93f1c298ba49d`.
- Provenance: `SPAN-5252D08D7475DBFF`; clauses: `B2325:C1, B2326:C1, B2327:C1, B2328:C1, B2329:C1, B2329:C2, B2329:C3, B2330:C1, B2331:C1, B2332:C1, B2333:C1, B2334:C1, B2335:C1, B2335:C2, B2335:C3, B2336:C1, B2337:C1`.
- Command source: `TASK-DATASERVICE-015`.

### COMMAND CMD-DATASERVICE-038

```
python -m pytest -q tests/integration/test_dataservice_stable_gds_query_e2e.py::test_identical_requests_coalesce_but_overlap_uses_cache_difference
```

- Source: `CMD-DATASERVICE-038`; role: `binding`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:2b27c5e9592d2fefc2fb192e7828ee7eb132f01a96b379fca1a93f1c298ba49d`.
- Provenance: `SPAN-5252D08D7475DBFF`; clauses: `B2325:C1, B2326:C1, B2327:C1, B2328:C1, B2329:C1, B2329:C2, B2329:C3, B2330:C1, B2331:C1, B2332:C1, B2333:C1, B2334:C1, B2335:C1, B2335:C2, B2335:C3, B2336:C1, B2337:C1`.
- Command source: `TASK-DATASERVICE-015`.

### COMMAND CMD-DATASERVICE-039

```
python -m pytest -q tests/integration/test_dataservice_stable_gds_query_e2e.py::test_cancelled_late_response_releases_temporary_shm
```

- Source: `CMD-DATASERVICE-039`; role: `binding`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:2b27c5e9592d2fefc2fb192e7828ee7eb132f01a96b379fca1a93f1c298ba49d`.
- Provenance: `SPAN-5252D08D7475DBFF`; clauses: `B2325:C1, B2326:C1, B2327:C1, B2328:C1, B2329:C1, B2329:C2, B2329:C3, B2330:C1, B2331:C1, B2332:C1, B2333:C1, B2334:C1, B2335:C1, B2335:C2, B2335:C3, B2336:C1, B2337:C1`.
- Command source: `TASK-DATASERVICE-015`.

### COMMAND CMD-DATASERVICE-040

```
python -m pytest -q tests/integration/test_dataservice_resume_recovery_e2e.py::test_dataservice_crash_rebuilds_missing_configured_periods_from_db_1m
```

- Source: `CMD-DATASERVICE-040`; role: `binding`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:2b27c5e9592d2fefc2fb192e7828ee7eb132f01a96b379fca1a93f1c298ba49d`.
- Provenance: `SPAN-5252D08D7475DBFF`; clauses: `B2325:C1, B2326:C1, B2327:C1, B2328:C1, B2329:C1, B2329:C2, B2329:C3, B2330:C1, B2331:C1, B2332:C1, B2333:C1, B2334:C1, B2335:C1, B2335:C2, B2335:C3, B2336:C1, B2337:C1`.
- Command source: `TASK-DATASERVICE-015`.

### COMMAND CMD-DATASERVICE-041

```
python -m pytest -q tests/integration/test_dataservice_resume_recovery_e2e.py::test_completed_log_overrun_recovers_period_db_without_tick_reaggregation
```

- Source: `CMD-DATASERVICE-041`; role: `binding`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:2b27c5e9592d2fefc2fb192e7828ee7eb132f01a96b379fca1a93f1c298ba49d`.
- Provenance: `SPAN-5252D08D7475DBFF`; clauses: `B2325:C1, B2326:C1, B2327:C1, B2328:C1, B2329:C1, B2329:C2, B2329:C3, B2330:C1, B2331:C1, B2332:C1, B2333:C1, B2334:C1, B2335:C1, B2335:C2, B2335:C3, B2336:C1, B2337:C1`.
- Command source: `TASK-DATASERVICE-015`.

### COMMAND CMD-DATASERVICE-042

```
python -m pytest -q tests/performance/test_dataservice_legacy_chain_benchmark.py --benchmark-json=.artifacts/goal/dataservice-cold-hot-legacy-chain/performance/candidate.json
```

- Source: `CMD-DATASERVICE-042`; role: `binding`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:2b27c5e9592d2fefc2fb192e7828ee7eb132f01a96b379fca1a93f1c298ba49d`.
- Provenance: `SPAN-5252D08D7475DBFF`; clauses: `B2325:C1, B2326:C1, B2327:C1, B2328:C1, B2329:C1, B2329:C2, B2329:C3, B2330:C1, B2331:C1, B2332:C1, B2333:C1, B2334:C1, B2335:C1, B2335:C2, B2335:C3, B2336:C1, B2337:C1`.
- Command source: `TASK-DATASERVICE-015`.

### COMMAND CMD-DATASERVICE-087

```
python -m pytest -q tests/performance/test_dataservice_legacy_chain_benchmark.py --benchmark-json=.artifacts/goal/dataservice-cold-hot-legacy-chain/performance/pre-fix.json
```

- Source: `CMD-DATASERVICE-087`; role: `binding`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:2b27c5e9592d2fefc2fb192e7828ee7eb132f01a96b379fca1a93f1c298ba49d`.
- Provenance: `SPAN-5252D08D7475DBFF`; clauses: `B2325:C1, B2326:C1, B2327:C1, B2328:C1, B2329:C1, B2329:C2, B2329:C3, B2330:C1, B2331:C1, B2332:C1, B2333:C1, B2334:C1, B2335:C1, B2335:C2, B2335:C3, B2336:C1, B2337:C1`.
- Command source: `TASK-DATASERVICE-015`.

### COMMAND CMD-DATASERVICE-090

```
python -m pytest -q tests/integration/test_dataservice_*_e2e.py tests/integration/test_datarecorder_*_e2e.py tests/integration/test_trigger_candidate_execution_e2e.py
```

- Source: `CMD-DATASERVICE-090`; role: `binding`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:2b27c5e9592d2fefc2fb192e7828ee7eb132f01a96b379fca1a93f1c298ba49d`.
- Provenance: `SPAN-5252D08D7475DBFF`; clauses: `B2325:C1, B2326:C1, B2327:C1, B2328:C1, B2329:C1, B2329:C2, B2329:C3, B2330:C1, B2331:C1, B2332:C1, B2333:C1, B2334:C1, B2335:C1, B2335:C2, B2335:C3, B2336:C1, B2337:C1`.
- Command source: `TASK-DATASERVICE-015`.

### COMMAND CMD-DATASERVICE-092

```
$env:QT_QPA_PLATFORM='offscreen'; python -m pytest -q tests/integration/test_dataservice_*_e2e.py tests/integration/test_datarecorder_*_e2e.py tests/integration/test_trigger_candidate_execution_e2e.py
```

- Source: `CMD-DATASERVICE-092`; role: `binding`; strength: `must`; polarity: `required`.
- Source text hash: `sourceTextHash=sha256:12df07df2ead84fc9cabc84045e119b21530ccc2fcefaca3f17247de56228ee4`.
- Provenance: `SPAN-60717E2FFE188AD3`; clauses: `B2341:C1, B2342:C1, B2343:C1, B2344:C1, B2345:C1, B2345:C2, B2346:C1, B2346:C2, B2346:C3, B2346:C4, B2347:C1, B2347:C2, B2348:C1, B2349:C1, B2350:C1, B2351:C1, B2352:C1, B2352:C2, B2353:C1, B2353:C2, B2354:C1`.
- Command source: `TASK-DATASERVICE-016`.
<!-- /goal-slot:requiredTestCommands -->

## Manual Verification Scenarios

Produce explicit evidence for every scenario.

<!-- goal-slot:manualVerificationScenarios required dynamic=manualScenarios -->
- MV001: Inspect the coverage receipt and confirm `decision` is `pass` and `unmappedSourceObligations` is empty.
<!-- /goal-slot:manualVerificationScenarios -->

## Completion Evidence Packet

The final implementation response must include the rendered evidence packet fields.

<!-- goal-slot:completionEvidencePacket required dynamic=evidencePacket -->
- `sourcePlanPath`: `D:/Dev/BMAD-Speckit-SDD-Flow/packages/bmad-speckit/tests/fixtures/standalone-goal/canonical-source-plan-v1-full.md`.
- `sourcePlanHash`: `sha256:d0aa0be0d8773e8029724c2dd4027578bfdf614870c93332cc082fb54890f74a`.
- `sourceCompositionPolicyHash`: `sha256:58378ca820d8bfe58d3279b698a4375190fd5153ac62b6fef7bc1156e6bf616d`.
- `orderedSourceSnapshotSetHash`: `sha256:b052cf07d17708d0874b48811591884a4ab6f031a0816e17ca0e8971ecf7a0fa`.
- `sourceAuthorityBundleHash`: `sha256:bacd63f90db61e7ae2ccf46c281d07bcc724919da0d4907e46248f8b7fe9644e`.
- `canonicalIntentSemanticHash`: `sha256:137b4b4d2da050f74c7145cac81e46bb02ce8f8640051a64de7c2ff5cd2c9413`.
- `canonicalIntentBundleHash`: `sha256:6d126ba01029c3f1b1cb025a265dc1e0f01eb479fb9b106a1b5285acd1c9b65e`.
- `authorityAttestationHash`: `sha256:d657ba06c66d9c9de6f1d7171c689208fdf023b3ae4ec7437a3bcbbc167fbec9`.
- `goalContractSemanticHash`: `sha256:24dac2101c691769ea1fabfa8c3c239d581a40dea229bf159037edf576c09958`.
- `goalContractHash`: `sha256:db508d2e9a0d82c2a5ff1af69356a28d7459f07ebd96bfdba6271f02ecdde8c3`.
- `coverageReceiptPath`: `D:/Dev/BMAD-Speckit-SDD-Flow/packages/bmad-speckit/tests/fixtures/standalone-goal/.canonical-source-plan-v1-full-draft-goal-execution-plan.coverage.json`.
- `generationReceiptPath`: `D:/Dev/BMAD-Speckit-SDD-Flow/packages/bmad-speckit/tests/fixtures/standalone-goal/.canonical-source-plan-v1-full-draft-goal-execution-plan.generation.json`.
- `residualRisks`: `none` only when all required commands pass.
<!-- /goal-slot:completionEvidencePacket -->

## Expected Evidence Freeze

Expected EVD is design-time authority. Observed Evidence remains runtime closure and cannot be synthesized by this section.

<!-- goal-slot:expectedEvidenceFreeze optional dynamic=expectedEvidence -->

<!-- /goal-slot:expectedEvidenceFreeze -->

## Stop Conditions

<!-- goal-slot:stopConditions required dynamic=stopConditions -->
- STOP001: If source hash differs from the front matter source hash, stop with `contract_amendment_required:source_plan_hash_mismatch`.
- STOP002: If any source obligation is unmapped, stop with `source_coverage_unmapped`.
- STOP003: If coverage receipt is missing, stop with `coverage_receipt_missing`.
<!-- /goal-slot:stopConditions -->
