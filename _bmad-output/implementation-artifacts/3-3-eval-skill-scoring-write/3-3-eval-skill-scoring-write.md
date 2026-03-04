# Story 3.3：eval-skill-scoring-write

**Epic**：E3 feature-eval-lifecycle-skill  
**Story ID**：3.3  
**描述**：全链路 Skill 在 stage 审计通过后调用解析并写入 scoring 存储，与 speckit-workflow、bmad-story-assistant 协同，触发模式表实现

---

## 1. Scope（范围）

### 1.1 本 Story 包含

1. **从审计报告解析出评分记录并写入 scoring 存储**
   - 在 stage 审计通过后，调用 Story 3.2 的解析能力，将审计报告解析为符合 Story 1.1 schema 的评分记录
   - 调用 Story 1.2 的写入接口，将解析结果持久化到 scoring/data/（单文件或 scores.jsonl，按配置）
   - 保证解析→写入的数据流闭环：同一 stage 的审计报告经解析后写入一条或多条记录，run_id、scenario、stage、check_items 等与 schema 一致

2. **与 speckit 协同**
   - 与 speckit-workflow、bmad-story-assistant 的协同：在哪些步骤后触发「解析并写入」、入参（如 run_id、scenario、stage、报告路径）如何从工作流传入
   - 触发模式表实现：至少覆盖 real_dev 与 eval_question 场景下各 stage 的触发条件与写入模式（单文件/jsonl/双写）的配置或文档

3. **与全链路 Skill 的衔接**
   - 全链路 Skill（3.1 定义）在编排中调用本 Story 的「解析+写入」能力；本 Story 实现可被 Skill 调用的接口或脚本入口

### 1.2 本 Story 不包含

- 评分规则 YAML 的配置与解析（由 Story 2.1 实现）
- 全链路 Skill 的编排与触发定义（由 Story 3.1 实现）
- 审计报告解析逻辑的详细实现（由 Story 3.2 实现；本 Story 调用 3.2）
- 一票否决、多次迭代阶梯式扣分（由 Story 4.1 实现）
- AI 代码教练、场景与 BMAD 集成细节（由 Story 4.2、4.3 实现）

---

## 2. 验收标准

| AC | 验收标准 | 验证方式 |
|----|----------|----------|
| AC-1 | 给定某 stage 的审计报告路径与 run_id/scenario/stage，调用解析+写入流程后，scoring/data 下出现符合 1.1 schema 的记录（单文件或 scores.jsonl 中一行） | 集成测试或验收脚本：准备报告与参数，执行后校验文件内容与 schema |
| AC-2 | 与 speckit-workflow 或 bmad-story-assistant 的协同点文档化或实现为可调用入口；触发模式表明确各 stage 的触发条件与写入模式 | 文档或配置表；至少一个协同入口可被脚本或工作流调用并验证 |
| AC-3 | 解析使用 3.2 的解析器，写入使用 1.2 的写入接口；不重复实现解析与写入逻辑 | 代码或集成测试证明调用 3.2 与 1.2，无重复实现 |

---

## 3. PRD 追溯

| PRD 需求 ID | 本 Story 覆盖内容 |
|-------------|-------------------|
| REQ-1.2 | 各阶段审计通过且得分写入后视为该阶段迭代结束——本 Story 实现「审计通过后解析并写入」的闭环 |
| REQ-3.10 | 版本追溯与存储：run_id、stage、check_items 等经解析后写入 scoring 存储 |
| REQ-3.12~3.17 | 全链路 Skill 调用解析与写入、与 speckit-workflow/bmad-story-assistant 协同、触发模式 |

---

## 7. 依赖

- **前置 Story**：Story 3.1（eval-lifecycle-skill-def）、Story 3.2（eval-layer1-3-parser）、Story 1.2（eval-system-storage-writer）。依赖 3.1 的编排与 stage 约定、3.2 的解析输出、1.2 的写入接口。
- 依赖 Story 1.1 的存储 schema；依赖 Architecture 中数据流与 BMAD 集成点的描述。

---

*本 Story 实现从审计报告解析出评分记录并写入 scoring 存储、与 speckit 协同，完成全链路「审计→解析→写入」闭环。*
