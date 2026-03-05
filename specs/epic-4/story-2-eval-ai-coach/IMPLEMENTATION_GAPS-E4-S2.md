<!-- AUDIT: PASSED by code-reviewer -->

# IMPLEMENTATION_GAPS-E4-S2：eval-ai-coach

**对照**：plan-E4-S2.md、spec-E4-S2.md、Story 4-2、当前实现  
**生成日期**：2026-03-04

---

## Gaps 清单（按需求文档章节）

| 需求文档章节 | Gap ID | 需求要点 | 当前实现状态 | 缺失/偏差说明 |
|-------------|--------|----------|-------------|---------------|
| Story §1 Scope 1.1(1) | GAP-1.1 | AI 代码教练定位与职责文档化 | 未实现 | scoring/coach 目录不存在；AI_COACH_DEFINITION.md 不存在 |
| Story §1 Scope 1.1(2) | GAP-1.2 | 人格定义（资深工程师视角、工业级标准） | 未实现 | 与 GAP-1.1 同属文档产出 |
| spec §2.2 / plan §7 | GAP-BMAD-1 | 人格定义须参照 BMAD agent 格式（role、identity、communication_style、principles） | 未实现 | 待产出的 AI_COACH_DEFINITION.md 的人格定义须与 adversarial-reviewer.md、architect.md 的 persona 结构一致 |
| AI_COACH_ROLE_ANALYSIS §4 Task 1 | GAP-MANIFEST-1 | AI Coach 入驻 manifest（module/capabilities/原则防御） | 未实现 | `_bmad/_config/agent-manifest.csv` 尚无 `ai-coach` 条目；缺少防滥用能力边界声明 |
| AI_COACH_ROLE_ANALYSIS §4 Task 2 | GAP-MANIFEST-2 | 创建 `_bmad/scoring/agents/ai-coach.md` Persona 文件 | 未实现 | `_bmad/scoring/agents/` 目录与 `ai-coach.md` 尚不存在；未与 AI_COACH_DEFINITION.md 建立映射 |
| AI_COACH_ROLE_ANALYSIS §4 Task 3 | GAP-MANIFEST-3 | `diagnose.ts` 从 manifest/agent 文件读取 Persona | 未实现 | 诊断流程未实现 persona 外部加载，仍缺少“可配置 persona 来源”机制 |
| AI_COACH_ROLE_ANALYSIS §4 Task 4 | GAP-MANIFEST-4 | 路由防御：scoring agent 不进入常规 `/bmad ask` | 未实现 | bmad-master/全局路由尚未加入 module 隔离策略，存在误调度风险 |
| Story §1 Scope 1.1(3) | GAP-1.3 | 技能配置、fallback 逻辑 | 未实现 | 无 coach 模块；fallback 路径未实现 |
| Story §1 Scope 1.1(4) | GAP-1.4 | coachDiagnose 入口、run_id 加载、输出 schema | 未实现 | scoring/coach 不存在；无 loadRunRecords、coachDiagnose |
| Story §1 Scope 1.1(5) | GAP-1.5 | 输出 JSON 与 Markdown | 未实现 | 无 formatToMarkdown |
| Story §1 Scope 1.1(6) | GAP-1.6 | iteration_passed 判定、一票否决权 | 未实现 | 无 coachDiagnose；veto 已实现可被调用 |
| Story §1 Scope 1.1(7) | GAP-1.7 | 禁止词校验 | 未实现 | 无 forbidden.ts、forbidden-words.yaml |
| Story §3 T1 | GAP-T1 | AI_COACH_DEFINITION.md | 未实现 | 文档缺失 |
| Story §3 T2 | GAP-T2 | 技能配置、fallback、单测 | 未实现 | 模块缺失 |
| Story §3 T3 | GAP-T3 | coachDiagnose、veto 调用、输出 schema | 未实现 | 模块缺失 |
| Story §3 T4 | GAP-T4 | iteration_passed 判定逻辑 | 未实现 | 与 GAP-T3 同属 diagnose |
| Story §3 T5 | GAP-T5 | 禁止词校验、验收脚本 | 未实现 | 无 forbidden 模块 |
| Story §3 T6 | GAP-T6 | CLI、触发文档 | 未实现 | 无 scripts/coach-diagnose.ts；无 coach:diagnose script |
| plan §2.1 | GAP-P1 | scoring/coach 目录结构 | 未实现 | index、diagnose、loader、forbidden、format、types 均不存在 |
| plan §3.2 | GAP-P2 | loadRunRecords | 未实现 | 无 loader.ts |
| plan §3.3 | GAP-P3 | validateForbiddenWords、loadForbiddenWords | 未实现 | 无 forbidden.ts |
| plan §4 | GAP-P4 | config/coach-trigger.yaml | 未实现 | 配置文件不存在 |
| plan §5 | GAP-P5 | scripts/coach-diagnose.ts、npm run coach:diagnose | 未实现 | CLI 不存在 |
| plan §6.3 | GAP-P6 | accept-e4-s2.ts 验收脚本 | 未实现 | 脚本不存在 |

---

## 四类汇总（D/S/I/M）

| 类别 | Gap ID | 本任务表行 | 对应任务 |
|------|--------|------------|----------|
| 数据/配置加载 D | GAP-P2、GAP-P3 load、GAP-P4、GAP-MANIFEST-1 | ✓ 有 | loader、forbidden、config、agent-manifest |
| 业务逻辑 S | GAP-1.4、GAP-1.6、GAP-T3、GAP-T4、GAP-P3 validate、GAP-MANIFEST-3 | ✓ 有 | diagnose、iteration_passed、forbidden、persona loader |
| 集成 I | GAP-1.5、GAP-T6、GAP-P5、GAP-P6、GAP-MANIFEST-4 | ✓ 有 | format、CLI、accept-e4-s2、routing guard |
| 文档 M | GAP-1.1、GAP-1.2、GAP-BMAD-1、GAP-T1、GAP-MANIFEST-2 | ✓ 有 | AI_COACH_DEFINITION.md + ai-coach.md |

---

## 当前实现可复用项

- **scoring/veto**：applyTierAndVeto、evaluateEpicVeto 已实现；coach 可直接导入调用
- **scoring/writer/types**：RunScoreRecord、CheckItem、IterationRecord
- **scoring/data**：单文件 {run_id}.json、scores.jsonl 存储格式；getScoringDataPath 等路径常量
- **scoring/constants/path**：getScoringDataPath 可复用
- **package.json**：可添加 coach:diagnose script
