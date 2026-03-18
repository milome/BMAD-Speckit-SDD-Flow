# Pilot Story 001: Add test:bmad npm script

## Background

BMAD Claude Code CLI 适配已完成框架搭建（任务 1-13），包含：
- 状态管理 (.claude/state/)
- 协议定义 (.claude/protocols/)
- Master Agent 和 Auditor
- Layer 4 Agent (specify/plan/tasks)
- Hooks 和 Worker

## Objective

添加一个 npm script 方便运行所有 BMAD 验收测试。

## Requirements Mapping

| Requirement | Acceptance Criteria |
|-------------|---------------------|
| R1: 一键运行 | `npm run test:bmad` 可执行 |
| R2: 覆盖所有 | 运行 12 个 BMAD 测试文件 |
| R3: 清晰输出 | 显示测试汇总结果 |

## Scope

**In Scope:**
- 修改 package.json scripts 部分
- 添加 test:bmad 脚本

**Out of Scope:**
- 修改测试文件本身
- 添加新的测试逻辑

## Success Criteria

1. `npm run test:bmad` 成功执行
2. 所有 12 个 BMAD 测试通过
3. 显示清晰的测试摘要

## Risks

- Low: 仅添加 npm script，不影响现有功能
