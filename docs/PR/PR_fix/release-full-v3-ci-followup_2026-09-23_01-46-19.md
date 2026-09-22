# PR Template: Fix/Release Full V3 Ci Followup

## 📋 概述

本 PR 是 `fix/release-full-v3-ci-followup` 分支的功能开发总结，主要包含：
1. **Bug修复**（1项）: fix(ci):等

---

## 🐛 BUGFIX

### 1. fix(ci): 同步v3验收契约与安装资产

**问题描述**:
- 同步v3验收契约与安装资产

**修复方案**:
- 修正v3 JSON envelope、动态 selector、native goal TaskReport路径和 Judge dist fixture，移除已退休审计脚本断言。

**提交记录**:
- `b0274c43c` - fix(ci): 同步v3验收契约与安装资产

---

## 📊 提交历史

| # | 提交 | 描述 | 作者 | 日期 |
|---|------|------|------|------|
| 1 | `b0274c43c` | fix(ci): 同步v3验收契约与安装资产 | milome | 2026-09-23 |

---

## 📈 改动统计

| 指标 | 数值 |
|------|------|
| 待合并提交数 | 1 个 |
| 修改文件数 | 7 |
| 功能新增 | 0 项 |
| 功能改进 | 0 项 |
| Bug修复 | 1 项 |
| 文档更新 | 0 项 |

---

## 📝 修改文件清单

- `tests/acceptance/accept-pack-bmad-speckit.test.ts`
- `tests/acceptance/main-agent-run-loop-e2e.test.ts`
- `tests/acceptance/requirements-confirmation-ingest-scale.test.ts`
- `tests/acceptance/requirements-confirmation-ingest.test.ts`
- `tests/acceptance/requirements-contract-command-selector-preflight.test.ts`
- `tests/acceptance/requirements-contract-judge-prompt-loader.test.ts`
- `tests/acceptance/requirements-contract-runtime-action-survival.test.ts`

---

## 🔍 代码质量

### 开发方法

- ✅ 代码审查完成
- ✅ 测试用例覆盖
- ✅ 回归测试验证

### 代码规范

- ✅ 遵循现有代码风格
- ✅ 函数命名清晰
- ✅ 注释完整

---

## ✅ 验收标准

- [x] ingest/scale acceptance: 10/10 passed
- [x] Judge loader, retired action, and selector acceptance: 44/44 passed
- [x] main-agent run-loop failure cases: 2/2 passed
- [x] packed consumer acceptance: 1/1 passed
- [x] ESLint (7 changed files), `git diff --check`, and encoding gate passed
- [ ] release-full GitHub CI rerun passes on the follow-up commit

---

## 📌 备注

本 PR 包含 1 个提交，主要涵盖以下方面：

- **Bug修复**: 1 项

建议在合并前进行完整的代码审查和测试验证。
