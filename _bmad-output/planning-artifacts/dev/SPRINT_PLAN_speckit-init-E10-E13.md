# Sprint Plan: speckit-init（E10–E13）

**角色**：Bob（Scrum Master）  
**日期**：2026-03-07  
**范围**：specify-cn 类初始化功能与多 AI Assistant 支持  
**前置**：Check Implementation Readiness 已完成，评估结论 READY

---

## 1. 实施顺序总览

```
Phase 1: 基座（必须先行）
├── E10.1 交互式 init          ← 核心入口，无依赖
├── E11.1 模板拉取             ← 可与 E10.1 并行启动（init 流程需模板）
└── E12.1 AI Registry          ← 可与 E10.1 并行（init 需 AI 列表）

Phase 2: 核心能力（依赖 Phase 1）
├── E10.2 非交互式 init        ← 依赖 E10.1
├── E10.3 跨平台脚本生成       ← 依赖 E10.1
├── E10.4 配置持久化           ← 依赖 E10.1
├── E10.5 --bmad-path          ← 依赖 E10.1
├── E11.2 离线与版本锁定       ← 依赖 E11.1
└── E12.2 引用完整性           ← 依赖 E10.1, E12.1

Phase 3: 扩展与诊断（依赖 Phase 2）
├── E12.3 Skill 发布           ← 依赖 E12.2, E10.1
├── E12.4 Post-init 引导       ← 依赖 E10.1
├── E13.1 check 与 version     ← 依赖 E10.1
├── E13.2 异常路径             ← 依赖 E11.1
├── E13.3 upgrade              ← 依赖 E11.1
├── E13.4 config               ← 依赖 E10.4
└── E13.5 feedback            ← 依赖 E10.1
```

---

## 2. 推荐 Sprint 排期

### Sprint 1：基座（约 4.5d）

| 顺序 | Story | 描述 | 预估 | 依赖 |
|------|-------|------|------|------|
| 1 | **10.1** | 交互式 init（Banner、19+ AI、路径、模板版本、--modules、--force、--no-git） | 3d | 无 |
| 2 | **11.1** | 模板拉取（GitHub Release、cache、--template、超时可配置） | 1.5d | 无 |
| 3 | **12.1** | AI Registry（19+ 内置、configTemplate 与 spec-kit 对齐、--ai generic） | 1.5d | 无 |

**说明**：10.1 为 init 主流程，11.1 与 12.1 可并行开发；建议 10.1 先完成基础框架，再与 11.1、12.1 集成。

### Sprint 2：核心能力（约 6d）

| 顺序 | Story | 描述 | 预估 | 依赖 |
|------|-------|------|------|------|
| 4 | **10.2** | 非交互式 init（--ai、--yes、TTY 检测、环境变量） | 1.5d | E10.1 |
| 5 | **10.3** | 跨平台脚本生成（--script sh/ps、路径/编码/换行符） | 1d | E10.1 |
| 6 | **10.4** | 配置持久化（~/.bmad-speckit/config.json、项目级覆盖） | 1d | E10.1 |
| 7 | **10.5** | --bmad-path worktree 共享 | 1.5d | E10.1 |
| 8 | **11.2** | 离线与版本锁定（--offline、templateVersion） | 0.5d | E11.1 |
| 9 | **12.2** | 引用完整性（按 configTemplate 同步、check 验证、--bmad-path） | 1.5d | E10.1, E12.1 |

**说明**：10.2–10.5 可部分并行；11.2、12.2 依赖各自 Epic 前一 Story。

### Sprint 3：扩展与诊断（约 5d）

| 顺序 | Story | 描述 | 预估 | 依赖 |
|------|-------|------|------|------|
| 10 | **12.3** | Skill 发布（_bmad/skills/ 同步、--ai-skills/--no-ai-skills） | 1.5d | E12.2, E10.1 |
| 11 | **12.4** | Post-init 引导（/bmad-help 提示、模板含 bmad-help） | 0.5d | E10.1 |
| 12 | **13.1** | check 与 version（诊断输出、--list-ai、--json、结构验证） | 1.5d | E10.1 |
| 13 | **13.2** | 异常路径（退出码 1–5、网络超时、cache 缺失） | 0.5d | E11.1 |
| 14 | **13.3** | upgrade（--dry-run、templateVersion 更新） | 1d | E11.1 |
| 15 | **13.4** | config（get/set/list、--global、--json） | 1d | E10.4 |
| 16 | **13.5** | feedback（stdout 提示、全流程兼容 AI 清单） | 0.5d | E10.1 |

---

## 3. 依赖图（E10–E13）

```
E10.1 (交互式 init) ──┬──→ E10.2 (非交互)
                      ├──→ E10.3 (脚本生成)
                      ├──→ E10.4 (配置持久化)
                      ├──→ E10.5 (--bmad-path)
                      ├──→ E12.2 (引用完整性)
                      ├──→ E12.3 → E12.4 (Skill + Post-init)
                      ├──→ E13.1 (check/version)
                      ├──→ E13.4 (config，经 E10.4)
                      └──→ E13.5 (feedback)

E11.1 (模板拉取) ────┬──→ E11.2 (离线)
                     ├──→ E13.2 (异常路径)
                     └──→ E13.3 (upgrade)

E12.1 (AI Registry) ──→ E12.2 (引用完整性)
```

---

## 4. 关键路径

1. **E10.1**：所有 init 相关 Story 的基座，必须最先完成。
2. **E11.1**：模板能力基座，E11.2、E13.2、E13.3 依赖。
3. **E12.1**：AI 扩展基座，E12.2 依赖。
4. **E10.4**：E13.4 config 子命令依赖。

**可并行窗口**：Sprint 1 中 10.1 / 11.1 / 12.1 可并行；Sprint 2 中 10.2–10.5、11.2、12.2 可部分并行。

---

## 5. 风险与注意事项

| 风险 | 缓解 |
|------|------|
| E10.1 与 11.1、12.1 集成点复杂 | 先定义 InitCommand 接口与 TemplateFetcher、AIRegistry 契约，再分头实现 |
| 跨平台脚本（E10.3）Windows 差异 | 尽早验证 PowerShell 路径、编码、换行符 |
| configTemplate 与 spec-kit 对齐（E12.1） | 参考 ARCH、PRD §5.3.1，逐 AI 核对 AGENTS.md |

---

## 6. 下一步

1. **Create Story**：对 **E10.1** 执行 Create Story 工作流，产出 Story 文档并通过审计。
2. **Dev Story**：E10.1 通过 Create Story 后，执行 Dev Story 与实施。
3. **Sprint Status**：`sprint-status.yaml` 已更新，E10–E13 已纳入 `development_status`，Agent 将按此跟踪进度。

---

*本计划由 Bob（Scrum Master）基于 epics.md v1.3、Implementation Readiness Report 2026-03-07 生成。*
