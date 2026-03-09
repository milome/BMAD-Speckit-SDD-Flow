# tasks-E11-S2 审计报告：离线与版本锁定

**被审文档**：tasks-E11-S2.md  
**原始需求**：Story 11-2 (11-2-offline-version-lock.md)  
**参考文档**：spec-E11-S2.md、plan-E11-S2.md、IMPLEMENTATION_GAPS-E11-S2.md  
**审计日期**：2026-03-09

---

## 模型选择信息

| 项目 | 值 |
|------|-----|
| 配置来源 | .claude/agents/code-reviewer.md |
| 指定模型 | inherit（来自 frontmatter，继承主 Agent 模型） |
| 选择依据 | 子代理 YAML 中 model: inherit；可改为 fast 以节省审计成本（若环境支持） |

---

## 1. 逐条覆盖验证

### 1.1 原始需求文档（Story 11-2）章节对照

| 需求章节 | 验证内容 | 验证方式 | 验证结果 |
|----------|----------|----------|----------|
| Story 陈述 | --offline 仅用 cache、templateVersion 写入、cache 缺失退出码 5 | 对照 tasks §1 任务追溯表、§3 Phase 1–3 | ✅ T001–T006 覆盖 |
| 本 Story 范围 | --offline 行为、templateVersion 写入、退出码 5 与报错 | 对照 T001–T003（offline）、T004（templateVersion）、T005–T006（测试） | ✅ 全覆盖 |
| 非本 Story 范围 | 11.1/13.2/13.4 边界 | tasks 未侵入他 Story 职责 | ✅ 无越界 |
| AC-1.1 离线且 cache 存在 | 不发起网络、从 cache 完成 init | 对照 T001 验收、T006 E2E | ✅ T001 验收 node -e 验证 cache 缺失时 throw；T006 验收 cache 存在时退出码 0 |
| AC-1.2 离线且 cache 缺失 | 退出码 5、报错含「离线」「cache 缺失」 | 对照 T003、T006 | ✅ T003 验收 mock 退出码 5、stderr 含「离线」「cache 缺失」；T006 同 |
| AC-1.3 未传 --offline | 行为与 11.1 一致 | 对照 T006 | ✅ T006 验收「init 未传 --offline 网络失败 → 退出码 3 非 5」 |
| AC-2.1 首次 init 成功 | templateVersion 写入、目录创建 | 对照 T004 | ✅ T004 验收 bmad-speckit.json 含 templateVersion |
| AC-2.2 已有配置合并 | 仅更新 templateVersion、不覆盖其他字段 | 对照 T004 | ✅ T004 验收「init 至已有项目（含 defaultAI 等）→ 检查仅 templateVersion 更新」 |
| AC-2.3 版本可识别 | tag 或 latest 写入 | 对照 T004 | ✅ T004 验收含 templateVersion 字段 |
| AC-3.1 退出码 5 仅用于离线 cache 缺失 | 场景与 exit(5) | 对照 T003、T006 | ✅ T003/T006 均验收退出码 5 场景；T006 验收非离线用 3 |
| AC-3.2 非离线不用 5 | 网络失败用 3 | 对照 T006 | ✅ T006 验收「init 未传 --offline 网络失败 → 退出码 3 非 5」 |
| Task 1 (1.1, 1.2) | --offline 解析与传递、cache 缺失 exit(5) | 对照 T001、T002、T003 | ✅ 全覆盖 |
| Task 2 (2.1, 2.2) | templateVersion 写入、合并更新 | 对照 T004 | ✅ T004 验收确认（GAP 已实现） |
| Task 3 (3.1, 3.2) | 退出码 5 仅用于离线 cache 缺失；单元/集成测试 | 对照 T005、T006 | ✅ 全覆盖 |

### 1.2 spec-E11-S2.md 章节对照

| spec 章节 | 验证内容 | 验证方式 | 验证结果 |
|-----------|----------|----------|----------|
| §User Scenarios 1–3 | --offline cache 存在/缺失、未传 offline | 对照 T001–T003、T006 | ✅ 覆盖 |
| §User Scenarios 4–6 | templateVersion 写入、已有合并、版本可识别 | 对照 T004 | ✅ 覆盖 |
| FR-001 | --offline 为真时仅 cache、不发起 HTTP(S) | 对照 T001、T005 | ✅ T001 禁止 offline 时调用 fetchJson/downloadAndExtract；T005 mock 网络验证 |
| FR-002 | offline 时检查 cache 存在性；不存在则 exit(5) | 对照 T001、T003 | ✅ 覆盖 |
| FR-003 | 退出码 5、报错含「离线」「cache 缺失」 | 对照 T003、T006 | ✅ 覆盖 |
| FR-004 | 未传 --offline 保持 11.1 行为 | 对照 T006 | ✅ T006 验收退出码 3 |
| FR-005–FR-007 | templateVersion 写入、合并、path/fs/os.homedir | 对照 T004 | ✅ T004 验收；实现由 init-skeleton 完成 |
| FR-008 | 单元/集成测试 | 对照 T005、T006 | ✅ 覆盖 |
| Key Entities TemplateFetcher | opts.offline 分支、cache 检查、throw OFFLINE_CACHE_MISSING | 对照 T001、T005 | ✅ 覆盖 |
| Key Entities init.js | 解析 --offline、传入 fetchTemplate、catch exit(5) | 对照 T002、T003 | ✅ 覆盖 |
| Success Criteria SC-001–SC-004 | 四条成功准则 | 对照 T001–T006 | ✅ 覆盖 |

### 1.3 plan-E11-S2.md 章节对照

| plan 章节 | 验证内容 | 验证方式 | 验证结果 |
|-----------|----------|----------|----------|
| Phase 0 Technical Context | 现有实现、tech stack | 对照 tasks 作为前提 | ✅ 隐含 |
| Phase 1 §1.1 TemplateFetcher 扩展 | opts.offline、cache 检查、禁止网络 | 对照 T001 | ✅ T001 详述 offline 分支逻辑 |
| Phase 1 §1.2 init 与 --offline | bin --offline、传入 fetchTemplate、catch exit(5) | 对照 T002、T003 | ✅ 覆盖 |
| Phase 1 §1.3 getLocalTemplatePath 与 offline | local 优先、不进入 offline cache 检查 | tasks 未显式任务 | ⚠️ 见专项 2.4 |
| Phase 2 Data Flow | 1–7 步骤 | 对照 T001–T004 | ✅ 覆盖 |
| Phase 3 E2E-1 | init --offline cache 存在 → 不发起网络、init 成功、bmad-speckit.json | 对照 T004、T006 | ✅ T006 验收「init --offline 且 cache 存在 → 退出码 0、bmad-speckit.json 含 templateVersion」 |
| Phase 3 E2E-2 | init --offline cache 缺失 → 退出码 5、stderr | 对照 T006 | ✅ 覆盖 |
| Phase 3 E2E-3 | 未传 --offline、网络失败退出码 3 | 对照 T006 | ✅ 覆盖 |
| Phase 3 E2E-4 | 已有配置合并 | 对照 T004、T006 | ✅ T006 明确列「已有配置合并（E2E-4）」 |
| Phase 3 INT-1 | fetchTemplate offline 仅走 cache、不调用 fetchFromGitHub/fetchFromUrl | 对照 T005 | ✅ T005 验收「mock 网络层验证 offline 时无 HTTP 请求」 |
| Phase 3 INT-2 | catch OFFLINE_CACHE_MISSING process.exit(5) | 对照 T003、T006 | ✅ T003 验收 mock throw 退出码 5；T006 验收 init --offline cache 缺失退出码 5 |
| Phase 3 INT-3 | writeSelectedAI 被调用、bmad-speckit.json 含 templateVersion | 对照 T004、T006 | ✅ T004/T006 验收 bmad-speckit.json 含 templateVersion |
| Phase 3 INT-4 | bin init --offline 解析传入 initCommand | 对照 T002、T006 | ✅ T002 验收 init --help 显示 --offline、grep init.js；T006 E2E 执行 init --offline 即走 bin→init |
| Phase 3 UNIT-1 | TemplateFetcher opts.offline cache 存在/缺失 | 对照 T005 | ✅ T005 单元测试 |
| Phase 3 UNIT-2 | init 解析 --offline、catch exit(5) | 对照 T005、T006 | ✅ T005 含 init 相关；T006 集成验证 catch exit(5) |
| Phase 4 接口变更与测试策略 | 三模块变更、单元/集成/E2E | 对照 T001–T006 | ✅ 覆盖 |

### 1.4 IMPLEMENTATION_GAPS-E11-S2.md 逐条对照

| Gap ID | 需求要点 | 验证方式 | 验证结果 |
|--------|----------|----------|----------|
| GAP-1.1 | init 与 TemplateFetcher 解析 --offline；仅从 cache 解析 | tasks §2 Gaps→任务映射、T001、T002 | ✅ 对应 T001、T002 |
| GAP-1.2 | --offline 且 cache 缺失时 exit(5)、报错含「离线」「cache 缺失」 | T003 | ✅ 对应 T003 |
| GAP-2.1 | templateVersion 写入 bmad-speckit.json | T004 | ✅ 验收确认（已实现） |
| GAP-2.2 | 目录创建、已有则合并 | T004 | ✅ 验收含已有配置合并 |
| GAP-3.1 | 仅「--offline 且 cache 缺失」用退出码 5 | T003、T006 | ✅ T006 验收「网络失败退出码 3 非 5」 |
| GAP-3.2 | 单元/集成测试、E2E-4/AC-2.2 | T005、T006 | ✅ T005 单元、T006 集成/E2E 含 E2E-4 |

---

## 2. 专项审查结果

### 2.1 每个功能模块/Phase 是否包含集成测试与端到端功能测试（严禁仅有单元测试）

| Phase | 单元测试任务 | 集成/E2E 任务 | 验证结果 |
|-------|--------------|---------------|----------|
| Phase 1（TemplateFetcher offline 分支） | T005 单元测试 TemplateFetcher | T006 集成/E2E：init --offline 完整流程、cache 存在/缺失、退出码、bmad-speckit.json；T001 验收 node -e 直接调用 fetchTemplate | ✅ Phase 1 的 TemplateFetcher 由 T006 的 init E2E 覆盖（init 调用 fetchTemplate）；T001 验收为集成级调用 |
| Phase 2（templateVersion 验收确认） | — | T004 为验收确认任务，含 E2E：init --offline --ai cursor-agent --yes、init 至已有项目检查合并 | ✅ T004 本质为 E2E 验收 |
| Phase 3（测试与退出码验收） | T005 单元 | T006 集成/E2E 明确列出：init --offline cache 存在/缺失、未传 --offline 网络失败、已有配置合并 | ✅ 满足「严禁仅有单元测试」 |

**结论**：Phase 1 由 T006（及 T001 验收）覆盖集成/E2E；Phase 2 由 T004 E2E 覆盖；Phase 3 含 T005 单元与 T006 集成/E2E。每个 Phase 均有集成或 E2E 覆盖，满足要求。

### 2.2 每个模块的验收标准是否包含「该模块在生产代码关键路径中被导入、实例化并调用」的集成验证

| 模块/Phase | 验收中是否含生产路径验证 | 验证结果 |
|------------|--------------------------|----------|
| TemplateFetcher（Phase 1） | T001 验收：`node -e "const tf=require('./packages/bmad-speckit/src/services/template-fetcher'); ... await tf.fetchTemplate('latest',{offline:true,...})"` — 直接 require 并调用 fetchTemplate | ✅ 验收为生产代码路径调用 |
| init.js（Phase 1） | T002 验收：`grep 确认 init.js 将 offline 传入 fetchTemplate`；T003 验收：`mock TemplateFetcher throw OFFLINE_CACHE_MISSING，执行 init --offline --ai cursor-agent --yes` — 执行完整 init 子命令 | ✅ T002 grep 验证 init 传递；T003 执行 init 即验证 init 在生产路径中调用 TemplateFetcher |
| bin/bmad-speckit.js（Phase 1） | T002 验收：`node bin/bmad-speckit.js init --help` 显示 --offline；T006 E2E 执行 `init --offline` 即从 bin 入口 | ✅ 覆盖 |
| templateVersion / writeSelectedAI（Phase 2） | T004 验收：执行 init 成功后检查 bmad-speckit.json — init 成功路径即 writeSelectedAI 被调用 | ✅ 覆盖 |
| Phase 3 测试 | T006 验收执行 init --offline 完整流程，即生产路径 | ✅ 覆盖 |

**结论**：各模块验收均包含或通过执行完整 init 命令 / node -e 调用 fetchTemplate / grep 确认传递，验证「在生产代码关键路径中被导入、实例化并调用」。tasks §Agent 执行规则第 5 条已明确：「每个任务验收须包含：该模块在生产代码关键路径中被导入、实例化并调用」。T001–T006 验收命令均符合。

### 2.3 是否存在「孤岛模块」任务（仅单元测试通过、从未在生产关键路径中被使用）

| 检查项 | 验证方式 | 验证结果 |
|--------|----------|----------|
| TemplateFetcher opts.offline 分支 | T001 验收 node -e 直接 require template-fetcher 并调用 fetchTemplate；T006 执行 init --offline 即 init→fetchTemplate | ✅ 无孤岛；生产路径为 init→fetchTemplate |
| init offline 解析与 catch | T002 grep 确认 init 传 offline；T003、T006 执行 init --offline 验证 | ✅ 无孤岛 |
| 写入 templateVersion 的 writeSelectedAI | T004、T006 验收 init 成功后 bmad-speckit.json 含 templateVersion，即 writeSelectedAI 在生产路径被调用 | ✅ 无孤岛 |

**结论**：不存在孤岛模块任务。TemplateFetcher 由 init 调用，init 由 bin 触发，writeSelectedAI 由 init 在成功路径调用；全部在生产代码关键路径中。

### 2.4 plan §1.3 getLocalTemplatePath 与 offline 的显式任务

plan §1.3 规定：当 getLocalTemplatePath() 有值时直接返回，不进入 offline cache 检查。GAPS 说明「实施时保持该优先顺序即可，无需变更」。  
**验证**：tasks 未单独列「保持 getLocalTemplatePath 优先」任务。但 T001 描述为「跳过 getLocalTemplatePath 之后、先解析所需 cache 路径」，即隐含 getLocalTemplatePath 在前；若 getLocalTemplatePath 有值，根据现有 11.1 逻辑应直接返回，不进入后续 offline 分支。GAPS 明确「无需变更」，故不强制 tasks 单独任务。**接受**：通过 T001 描述与 GAPS 说明可推断已覆盖，无独立任务不判为 gap。

---

## 3. 结论

**完全覆盖、验证通过。**

- Story 11-2、spec-E11-S2.md、plan-E11-S2.md、IMPLEMENTATION_GAPS-E11-S2.md 所有章节均已映射到 tasks-E11-S2.md 的 T001–T006，且无遗漏。
- 专项审查：（1）每个 Phase 均含集成或 E2E 覆盖（T004、T006、T001 验收）；（2）各模块验收均包含生产代码关键路径验证（node -e 调用、init 执行、grep 确认）；（3）无孤岛模块任务。
- plan §1.3 getLocalTemplatePath 与 offline 由 GAPS「无需变更」与 T001 描述推断覆盖，不强制独立任务。

**报告保存路径**：`d:\Dev\BMAD-Speckit-SDD-Flow\specs\epic-11-speckit-template-offline\story-2-offline-version-lock\AUDIT_tasks-E11-S2.md`  
**iteration_count**：0（一次通过）

---

## 4. 批判审计员结论

**已检查维度**：遗漏需求点、边界未定义、验收不可执行、与前置文档矛盾、孤岛模块、伪实现/占位、TDD 未执行（tasks 文档阶段不强制）、行号/路径漂移、验收一致性、集成/E2E 覆盖、生产路径验收显式性。

**每维度结论**：

- **遗漏需求点**：已逐条对照 Story 11-2、spec-E11-S2.md、plan-E11-S2.md、IMPLEMENTATION_GAPS-E11-S2.md；本 Story 范围、AC-1～AC-3、Tasks 1～3、FR-001～FR-008、plan Phase 0～4、E2E-1～4/INT-1～4/UNIT-1～2、GAP-1.1～3.2 均已映射。无遗漏。
- **边界未定义**：--offline 与 cache 存在/缺失、退出码 5 与 3 的区分、templateVersion 合并更新、getLocalTemplatePath 优先（plan §1.3）均在 spec/plan/GAPS 或 tasks 中明确，无未定义边界。
- **验收不可执行**：T001–T006 验收命令均为可执行动作（node -e、init --help、grep、npm test、mock 后执行 init）；命令与预期明确，无模糊验收。
- **与前置文档矛盾**：tasks 与 spec、plan、GAPS 在 --offline、cache 缺失 exit(5)、templateVersion、退出码 3/5 区分上一致，无矛盾。
- **孤岛模块**：TemplateFetcher、init、writeSelectedAI 均在生产路径（init→fetchTemplate→generateSkeleton→writeSelectedAI）；T001 验收 node -e 直接调用 fetchTemplate，T002/T003/T006 执行 init 验证。无孤岛。
- **伪实现/占位**：tasks 为实施清单，未要求占位或伪实现；验收要求真实实现与测试通过。禁止事项明确禁止「预留」「占位」。
- **TDD 未执行**：本审计为 tasks 文档阶段，不要求 tasks 内写 [TDD-RED/GREEN/REFACTOR]；实施阶段审计再查。
- **行号/路径漂移**：引用的文件路径（template-fetcher.js、init.js、bin/bmad-speckit.js、bmad-speckit.json）与 plan/spec 一致，无漂移。
- **验收一致性**：§验收汇总与 §3 各任务验收、plan Phase 3 E2E/INT/UNIT 一致；T006 与 plan E2E-1～4、INT 场景一一对应。
- **集成/E2E 覆盖**：T004、T006 明确列出 E2E 用例；T005 单元 + T006 集成/E2E；Phase 1 由 T001 验收（集成级调用）与 T006 覆盖。满足「严禁仅有单元测试」。
- **生产路径验收显式性**：T001 验收 node -e require template-fetcher 并 fetchTemplate；T002 grep init.js；T003/T006 执行 init --offline。各任务均含显式生产路径验证或通过完整 init 执行覆盖。

**本轮 gap 结论**：本轮无新 gap。tasks-E11-S2.md 完全覆盖 spec、plan、GAPS 与 Story 11-2；集成/E2E 与生产路径验收明确，可判定为完全覆盖、验证通过。

---

## 5. 可解析评分块（供 parseAndWriteScore）

总体评级: A

维度评分:
- 需求完整性: 95/100
- 可测试性: 92/100
- 一致性: 93/100
- 可追溯性: 94/100
