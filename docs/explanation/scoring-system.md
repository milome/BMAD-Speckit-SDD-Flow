# 评分系统

> 审计结果量化评分、AI Coach 诊断与 SFT 数据提取。

---

## 概述

BMAD-Speckit-SDD-Flow 内置评分系统，将各阶段审计报告自动解析为量化分数，用于：
- 追踪团队/模型在各阶段的表现趋势
- AI Coach 自动诊断短板并给出改进建议
- 从低分运行中提取 SFT（Supervised Fine-Tuning）训练数据

评分系统是可选扩展功能，核心工作流（specify→plan→tasks→implement）不依赖评分系统。

---

## 评分流程

```
审计报告 → parse-score.ts 解析 → write-score.ts 写入 → scores 存储
                                                           ↓
                                              coach.ts 诊断 → 改进建议
                                              sft-extract.ts → 训练数据
                                              dashboard.ts → 可视化
```

### 触发时机

每个 speckit 阶段审计通过后，主 Agent 调用 `parse-and-write-score.ts`：

```bash
npx ts-node scripts/parse-and-write-score.ts \
  --reportPath <审计报告路径> \
  --stage <spec|plan|tasks|implement> \
  --event stage_audit_complete \
  --epic {epic} --story {story} \
  --iteration-count {累计值}
```

### 评分维度

| 维度 | 权重 | 说明 |
|------|------|------|
| 完整性 | 30% | 是否覆盖所有需求点 |
| 正确性 | 30% | 技术方案是否正确 |
| 测试验证 | 25% | 集成测试覆盖、新增代码覆盖率≥85% |
| 质量 | 15% | 代码/文档质量 |

### 审计质量评级

| 评级 | 含义 | 处理方式 |
|------|------|----------|
| A 级 | 优秀 | 直接进入下一阶段 |
| B 级 | 良好，minor 问题 | 本阶段内完成修复后继续 |
| C 级 | 及格，需修改 | 必须修改后重新审计 |
| D 级 | 不及格 | 退回上一阶段重新设计 |

---

## AI Coach 诊断

Coach 系统分析历史评分数据，自动识别短板：

```bash
npx ts-node scripts/coach-diagnose.ts
```

Coach 会输出：
- 各阶段平均分与趋势
- 反复失败的阶段或维度
- 针对性改进建议

触发配置：`config/coach-trigger.yaml`

---

## SFT 数据提取

从低分审计运行中提取 instruction-response 对，用于模型微调：

```bash
npx ts-node scripts/sft-extract.ts
```

---

## 配置文件

| 文件 | 用途 |
|------|------|
| `config/scoring-trigger-modes.yaml` | 评分写入控制（enabled/disabled） |
| `config/coach-trigger.yaml` | Coach 诊断触发配置 |
| `config/stage-mapping.yaml` | 阶段名称映射 |
| `config/eval-lifecycle-report-paths.yaml` | 审计报告路径约定 |
| `config/audit-item-mapping.yaml` | 审计项映射 |

---

## 相关文档

- [架构概述](architecture.md) — 五层架构与审计闭环
- [配置参考](../reference/configuration.md) — 所有配置文件说明
- [入门教程](../tutorials/getting-started.md) — 安装与使用
