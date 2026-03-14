# Story E001-S003: 验证 Story 模式审计流程

## 概述
本 Story 专门用于验证 BMAD Story Assistant 在 **story 审计粒度模式** 下的完整工作流程，确认中间阶段（specify/plan/gaps/tasks/implement）使用基础验证而非完整审计。

## 目标
验证以下行为：
1. ✅ Story 创建阶段执行完整审计
2. ✅ Story 审计阶段执行完整审计
3. ✅ specify 阶段跳过审计，执行基础验证
4. ✅ plan 阶段跳过审计，执行基础验证
5. ✅ gaps 阶段跳过审计，执行基础验证
6. ✅ tasks 阶段跳过审计，执行基础验证
7. ✅ implement 阶段跳过审计，执行测试验证
8. ✅ post_audit 阶段执行完整审计

## 技术方案
- 使用配置系统 (`scripts/bmad-config.ts`) 读取审计粒度配置
- 验证 `shouldAudit()` 函数在 story 模式下正确返回 false 对于中间阶段
- 验证基础验证流程 (`docs/design/basic-validation-spec.md`)
- 验证测试验证流程 (`docs/design/test-only-validation-spec.md`)

## 范围
### 包含
- Story 创建与审计
- specify/plan/gaps/tasks 阶段基础验证
- implement 阶段测试验证
- 实施后审计

### 不包含
- 实际业务功能开发
- 生产级代码实现

## 依赖
- BMAD 配置系统 (`scripts/bmad-config.ts`)
- 审计粒度配置 (`config/bmad-story-config.yaml`)
- 基础验证规范 (`docs/design/basic-validation-spec.md`)
- 测试验证规范 (`docs/design/test-only-validation-spec.md`)

## 验收标准
1. [ ] Story 文档创建成功
2. [ ] Story 审计通过（完整审计）
3. [ ] specify 阶段生成文档并通过基础验证（跳过审计）
4. [ ] plan 阶段生成文档并通过基础验证（跳过审计）
5. [ ] gaps 阶段生成文档并通过基础验证（跳过审计）
6. [ ] tasks 阶段生成文档并通过基础验证（跳过审计）
7. [ ] implement 阶段通过测试验证（跳过审计）
8. [ ] 实施后审计通过（完整审计）

## 工作量估算
1 个故事点
