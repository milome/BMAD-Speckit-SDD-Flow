# Skill流程执行问题改进分析文档

**文档版本**: v1.0  
**生成日期**: 2026-03-03  
**议题**: Dev Story执行时跳过speckit完整流程问题  
**讨论方式**: Party Mode 100轮辩论（批判审计员主导，发言占比>60%）  
**收敛状态**: ✅ 最后3轮无新gap提出，达成全面共识

---

## 1. 问题定义

### 1.1 现象描述
在执行dev story过程中，只生成了spec文档就直接按照ralph method执行，**跳过了speckit-workflow的完整流程**：
- ❌ 未生成 plan.md
- ❌ 未生成 IMPLEMENTATION_GAPS.md
- ❌ 未生成 tasks.md
- ❌ 未执行各阶段的code-review审计

### 1.2 预期流程 vs 实际流程

```
【预期流程 - speckit-workflow完整流程】
constitution → specify → plan → GAPS → tasks → 执行(TDD)
                ↓         ↓      ↓       ↓
            code-review审计(每个阶段后必须执行)

【实际流程 - 被压缩的流程】
specify → ralph-method直接执行
   ↓
缺少plan/GAPS/tasks三个关键阶段和审计
```

### 1.3 违反的技能条款

根据 `bmad-story-assistant` SKILL.md §阶段三：Dev Story实施（增强版）：

> **必须嵌套执行 speckit-workflow 完整流程**，按以下顺序：
> 1. **specify** → 生成 spec-E{epic}-S{story}.md → code-review审计（迭代直至通过）
> 2. **plan** → 生成 plan-E{epic}-S{story}.md → code-review审计（迭代直至通过，必要时可进入party-mode 50轮）
> 3. **GAPS** → 生成 IMPLEMENTATION_GAPS-E{epic}-S{story}.md → code-review审计（迭代直至通过）
> 4. **tasks** → 生成 tasks-E{epic}-S{story}.md → code-review审计（迭代直至通过）
> 5. **执行** → TDD红绿灯模式（红灯→绿灯→重构）→ code-review审计（迭代直至通过）

---

## 2. 根因分析 (Party Mode 100轮辩论结论)

### 2.1 根本原因分类

| 类别 | 根因 | 严重度 |
|------|------|--------|
| **技能设计缺陷** | 虽然有"必须"字样，但缺乏强制阻断机制 | 🔴 High |
| **流程理解偏差** | ralph-method被误用为speckit的替代而非补充 | 🔴 High |
| **检查点缺失** | 阶段间没有自动化验证，依赖人工自检 | 🟡 Medium |
| **视觉强调不足** | 关键约束没有用足够醒目的方式呈现 | 🟡 Medium |
| **时间压力误导** | 完整流程看起来"慢"，诱发走捷径心理 | 🟢 Low |

### 2.2 详细根因说明

#### 🔴 RC-001: 缺乏强制阻断机制 (High)

**问题**: skill中虽然写了"必须嵌套执行"，但没有技术手段阻止非法流程跳跃。

**证据**:
- `speckit-workflow` SKILL.md §8 命令索引表格列出了各阶段命令，但没有说明"如果前置阶段未完成，命令应拒绝执行"
- 没有文件存在性检查脚本验证各阶段产出
- 没有状态机记录当前所处阶段

**影响**: 执行者可以"假装"没看到前置要求，直接启动后续阶段。

#### 🔴 RC-002: ralph-method定位误解 (High)

**问题**: ralph-method被错误地当作了从spec到代码的"快速通道"。

**澄清**:
- **ralph-method的正确角色**: 在tasks.md生成后，用于将任务分解为原子user stories
- **ralph-method的错误用法**: 替代plan/GAPS/tasks的生成

**对比**:

| 维度 | speckit tasks.md | ralph-method prd.json |
|------|------------------|----------------------|
| 关注焦点 | 如何实现需求 | 如何分解任务 |
| 包含内容 | 需求映射、架构约束、测试计划、验收标准 | 用户故事、验收条件、优先级 |
| 审计要求 | 必须通过code-review §4 | 无强制审计要求 |
| 与需求追溯 | 强关联（必须逐条映射） | 弱关联 |

#### 🟡 RC-003: 自检清单执行不力 (Medium)

**问题**: `bmad-story-assistant` §3.2 虽有主Agent自检清单，但缺乏监督机制。

**自检清单内容**:
```markdown
**准备阶段检查**:
- [ ] 已读取相关skill文件获取最新内容
- [ ] 已确认当前处于正确的阶段（Layer 1/2/3/4/5）
- [ ] 已准备好所有必要的上下文信息
- [ ] 已确认前一阶段已完成并通过审计
```

**缺陷**: 勾选框可以被随意勾选，没有验证机制。

#### 🟡 RC-004: 视觉强调不足 (Medium)

**问题**: "必须"、"严禁"等关键词没有足够的视觉突出。

**现状**: 使用普通文本描述约束
**建议**: 使用警告框、emoji、加粗等多重视觉提示

#### 🟢 RC-005: 时间压力心理 (Low)

**问题**: 完整speckit流程需要多次文档生成+审计循环，看起来耗时较长。

**误区**: 认为"跳过前期规划可以更快交付"
**事实**: 缺少规划会导致返工，总体时间反而更长

---

## 3. 改进措施 (经Party Mode共识)

### 3.1 高优先级改进 (必须实施)

#### ✅ IMP-001: 增加强制阻断机制

**实施方案**:

1. **在STORY-A3-DEV模板中增加前置条件检查**

```yaml
# 添加到STORY-A3-DEV模板开头
tool: mcp_task
subagent_type: generalPurpose
description: "Dev Story {epic_num}-{story_num} implementation"
prompt: |
  【强制前置检查】执行以下验证，任一失败则拒绝执行并返回错误：
  
  1. 验证spec-E{epic}-S{story}.md存在且已通过审计
     - 检查路径: specs/epic-{epic}/story-{story}-*/spec-E{epic}-S{story}.md
     - 必须包含审计标记: <!-- AUDIT: PASSED -->
  
  2. 验证plan-E{epic}-S{story}.md存在且已通过审计
     - 检查路径: specs/epic-{epic}/story-{story}-*/plan-E{epic}-S{story}.md
     - 必须包含审计标记: <!-- AUDIT: PASSED -->
  
  3. 验证IMPLEMENTATION_GAPS-E{epic}-S{story}.md存在且已通过审计
     - 检查路径: specs/epic-{epic}/story-{story}-*/IMPLEMENTATION_GAPS-E{epic}-S{story}.md
     - 必须包含审计标记: <!-- AUDIT: PASSED -->
  
  4. 验证tasks-E{epic}-S{story}.md存在且已通过审计
     - 检查路径: specs/epic-{epic}/story-{story}-*/tasks-E{epic}-S{story}.md
     - 必须包含审计标记: <!-- AUDIT: PASSED -->
  
  如有任何一项不满足，立即返回错误：
  "前置检查失败: [具体原因]。请先完成speckit-workflow的完整流程。"
```

2. **增加.speckit-state.yaml状态机文件**

```yaml
# .speckit-state.yaml 示例
story_id: "4-1"
current_phase: "specify"  # constitution/specify/plan/gaps/tasks/implement
completed_phases:
  - constitution
  - specify
audit_status:
  constitution: "PASSED"
  specify: "PASSED"
  plan: "PENDING"
  gaps: "PENDING"
  tasks: "PENDING"
last_updated: "2026-03-03T10:00:00Z"
```

#### ✅ IMP-002: 明确ralph-method触发条件

**修改位置**: `ralph-method` SKILL.md 开头增加限制条款

```markdown
---
name: ralph-method
description: |
  ⚠️ **重要限制**: 本技能只能在tasks.md生成后使用！
  
  **禁止场景**:
  - ❌ 未生成plan.md直接使用本技能
  - ❌ 未生成IMPLEMENTATION_GAPS.md直接使用本技能
  - ❌ 未生成tasks.md直接使用本技能
  
  **正确流程**:
  1. 先执行speckit-workflow完整流程（specify→plan→GAPS→tasks）
  2. 获得tasks.md后，使用本技能细化任务分解
  3. 生成的prd.json必须与tasks.md保持一致
  
  **违规后果**: 如检测到前置文档缺失，本技能将拒绝执行。
---
```

#### ✅ IMP-003: 强化自检清单验证

**修改位置**: `bmad-story-assistant` SKILL.md §3.2

**原内容**:
```markdown
**自检确认**：
以上所有检查项完成后，在回复中明确声明：
"自检完成，所有检查项已通过，现在发起子任务。"
```

**改进后**:
```markdown
**自检确认（强制）**：
未完成以下步骤，禁止发起子任务：

1. **文档存在性扫描**: 
   ```bash
   # 自动执行检查脚本
   python _bmad/scripts/bmad-speckit/python/check_speckit_prerequisites.py --epic {epic} --story {story}
   ```

2. **审计状态验证**:
   - 读取各文档中的审计标记
   - 确认标记为 `<!-- AUDIT: PASSED by code-reviewer -->`

3. **输出自检报告**:
   ```
   【自检报告】
   - spec-E{epic}-S{story}.md: ✅ 存在 + 审计通过
   - plan-E{epic}-S{story}.md: ✅ 存在 + 审计通过
   - IMPLEMENTATION_GAPS-E{epic}-S{story}.md: ✅ 存在 + 审计通过
   - tasks-E{epic}-S{story}.md: ✅ 存在 + 审计通过
   - 自检结果: 全部通过，可以发起子任务
   ```

**注意**: 如自检发现任何问题，立即停止并返回上一阶段补全。
```

### 3.2 中优先级改进 (建议实施)

#### 📝 IMP-004: 视觉强调优化

**修改所有skill文件中的关键约束**:

使用统一的警告格式：
```markdown
> 🚨 **强制约束 - 不可跳过**
> 
> 必须按顺序执行：specify → plan → GAPS → tasks → 执行
> 
> 每个阶段必须通过code-review审计才能进入下一阶段。
> 严禁跳过任何阶段或审计！
```

#### 📝 IMP-005: 增加流程图

在 `bmad-story-assistant` SKILL.md 开头增加可视化流程图：

```
【Dev Story完整流程 - 不可跳过任何步骤】

Layer 3: Create Story
    ↓ (Story文档审计通过)
Layer 4: speckit-workflow
    ├─→ /speckit.constitution → constitution.md → [审计§0]
    ├─→ /speckit.specify → spec-E{epic}-S{story}.md → [审计§1]
    ├─→ /speckit.plan → plan-E{epic}-S{story}.md → [审计§2]
    ├─→ (自动生成) → IMPLEMENTATION_GAPS-E{epic}-S{story}.md → [审计§3]
    ├─→ /speckit.tasks → tasks-E{epic}-S{story}.md → [审计§4]
    └─→ /speckit.implement → 代码实现 → [审计§5]
    ↓ (所有审计通过)
Layer 5: 收尾与集成
```

### 3.3 低优先级改进 (可选实施)

#### 💡 IMP-006: 开发辅助工具脚本

创建 `_bmad/scripts/bmad-speckit/python/check_speckit_prerequisites.py`:

```python
#!/usr/bin/env python3
"""
Speckit流程前置检查脚本
验证所有必需文档是否存在且审计通过
"""

import os
import sys
import glob
from pathlib import Path

def check_document_exists(project_root, epic, story, doc_type):
    """检查特定类型的文档是否存在"""
    pattern = f"specs/epic-{epic}/story-{story}-*/{doc_type}-E{epic}-S{story}.md"
    matches = glob.glob(os.path.join(project_root, pattern))
    return len(matches) > 0, matches[0] if matches else None

def check_audit_passed(file_path):
    """检查文档是否包含审计通过标记"""
    if not file_path or not os.path.exists(file_path):
        return False
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
        return '<!-- AUDIT: PASSED' in content or '结论：完全覆盖、验证通过' in content

def main():
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument('--epic', required=True)
    parser.add_argument('--story', required=True)
    parser.add_argument('--project-root', default='.')
    args = parser.parse_args()
    
    checks = [
        ('spec', f'spec-E{args.epic}-S{args.story}.md'),
        ('plan', f'plan-E{args.epic}-S{args.story}.md'),
        ('gaps', f'IMPLEMENTATION_GAPS-E{args.epic}-S{args.story}.md'),
        ('tasks', f'tasks-E{args.epic}-S{args.story}.md'),
    ]
    
    all_passed = True
    print(f"\n🔍 检查 Story {args.epic}-{args.story} 的前置条件...\n")
    
    for doc_type, filename in checks:
        exists, path = check_document_exists(args.project_root, args.epic, args.story, doc_type)
        if not exists:
            print(f"❌ {filename}: 不存在")
            all_passed = False
            continue
            
        audited = check_audit_passed(path)
        status = "✅ 审计通过" if audited else "❌ 未通过审计"
        print(f"{'✅' if audited else '⚠️'} {filename}: 存在 + {status}")
        
        if not audited:
            all_passed = False
    
    print()
    if all_passed:
        print("✅ 所有前置条件满足，可以继续执行")
        sys.exit(0)
    else:
        print("❌ 前置条件不满足，请先完成speckit-workflow完整流程")
        sys.exit(1)

if __name__ == '__main__':
    main()
```

---

## 4. 改进实施计划

### 4.1 任务分解

| 任务ID | 任务描述 | 负责人 | 优先级 | 预估工时 |
|--------|----------|--------|--------|----------|
| TASK-1 | 修改`bmad-story-assistant` SKILL.md，增加强制前置检查 | Amelia 开发 | P0 | 2h |
| TASK-2 | 修改`ralph-method` SKILL.md，增加使用限制条款 | Winston 架构师 | P0 | 1h |
| TASK-3 | 修改`speckit-workflow` SKILL.md，增加视觉强调 | Paige 技术写作 | P0 | 2h |
| TASK-4 | 开发`check_speckit_prerequisites.py`脚本 | Amelia 开发 | P1 | 3h |
| TASK-5 | 设计`.speckit-state.yaml`状态机格式 | Winston 架构师 | P1 | 2h |
| TASK-6 | 更新所有skill文件的审计标记格式 | Quinn 测试 | P1 | 2h |
| TASK-7 | 编写改进后的流程文档和示例 | Paige 技术写作 | P2 | 4h |
| TASK-8 | 对改进后的skill进行code-review审计 | 批判审计员 | P0 | 3h |

### 4.2 实施顺序

```
Week 1:
  Day 1-2: TASK-1, TASK-2, TASK-3 (并行)
  Day 3-4: TASK-4, TASK-5 (并行)
  Day 5:   TASK-8 (审计前三项)

Week 2:
  Day 1-2: TASK-6
  Day 3-4: TASK-7
  Day 5:   TASK-8 (最终审计)
```

---

## 5. 验证标准

### 5.1 改进验证清单

- [ ] 修改后的skill文件中，所有"必须"约束都有🚨警告框标识
- [ ] STORY-A3-DEV模板包含前置条件检查逻辑
- [ ] ralph-method SKILL.md明确说明只能在tasks.md后使用
- [ ] check_speckit_prerequisites.py脚本可以正确检测文档缺失
- [ ] 尝试跳过plan/GAPS/tasks阶段时，系统会明确拒绝并给出指引
- [ ] 所有改进经过code-review审计并标记"完全覆盖、验证通过"

### 5.2 回归测试

创建测试用例验证改进效果：

```python
def test_flow_enforcement():
    """测试流程强制执行"""
    # 场景1: 只有spec.md，尝试执行dev story → 应该被拒绝
    # 场景2: spec+plan，缺少GAPS → 应该被拒绝
    # 场景3: 所有文档齐全但未审计 → 应该被拒绝
    # 场景4: 所有文档齐全且审计通过 → 应该允许执行
    pass
```

---

## 6. Party Mode 讨论摘要

### 6.1 参与角色贡献

| 角色 | 发言轮次 | 主要贡献 |
|------|----------|----------|
| 🎭 **批判审计员** | 65轮 (65%) | 提出核心质疑、深挖根因、推动强制措施 |
| 🏗️ **Winston 架构师** | 15轮 (15%) | 技术可行性分析、架构方案设计 |
| 💻 **Amelia 开发** | 12轮 (12%) | 执行层面反馈、工具开发建议 |
| 🔍 **Quinn 测试** | 8轮 (8%) | 测试视角风险提醒、验收标准制定 |

### 6.2 关键共识点

1. **这不是"优化"而是"修复"**: 当前skill存在设计缺陷，需要强制性修复而非建议性改进
2. **技术手段优于人工自觉**: 不能依赖执行者"自觉遵守"，必须有技术阻断
3. **ralph-method定位清晰**: 它是task分解工具，不是plan/GAPS/tasks的替代品
4. **审计是质量守门员**: 每个阶段的code-review审计不可跳过

### 6.3 最后3轮确认（无新gap）

- **第98轮**: 批判审计员确认所有根因已识别
- **第99轮**: Winston架构师确认技术方案可行
- **第100轮**: 全体达成共识，同意实施计划

---

## 7. 附录

### 7.1 参考文档

- `bmad-story-assistant` SKILL.md §阶段三：Dev Story实施（增强版）
- `speckit-workflow` SKILL.md §7 流程小结
- `ralph-method` SKILL.md 执行规则
- `audit-prompts.md` §1-§5 审计提示词

### 7.2 相关Issue

- 本次问题暴露于: Epic 015 Story 合约订阅支持开发过程
- 审计报告: `AUDIT_REPORT_REQ_合约查询窗口多合约订阅与去硬编码改造_V3.md`

### 7.3 术语表

| 术语 | 解释 |
|------|------|
| speckit-workflow | 技术实现层流程：specify→plan→GAPS→tasks→执行 |
| ralph-method | 任务分解方法：将复杂任务拆分为原子user stories |
| Party Mode | 多角色辩论模式，用于深度分析问题 |
| 批判审计员 | Party Mode角色，负责质疑和挑战假设 |
| code-review审计 | 使用audit-prompts.md进行的强制性质量检查 |

---

## 8. 实现状态检查（含全局 skills 核对）

**检查日期**: 2026-03-03  
**全局 skills 路径**: `C:\Users\<user>\.cursor\skills\`（bmad-story-assistant、ralph-method）

### 8.1 改进措施实现状态（含全局技能）

| 改进项 | 描述 | 状态 | 依据 |
|--------|------|------|------|
| **IMP-001** | STORY-A3-DEV 增加强制前置检查 | ✅ 已实现 | 全局 `bmad-story-assistant/SKILL.md` 第 476–496 行：STORY-A3-DEV 模板含【强制前置检查】四步（spec/plan/IMPLEMENTATION_GAPS/tasks 存在且含 `<!-- AUDIT: PASSED by code-reviewer -->`），不满足时返回「前置检查失败: [具体原因]。请先完成 speckit-workflow 的完整流程（specify→plan→GAPS→tasks）。」 |
| **IMP-001** | 增加 .speckit-state.yaml 状态机模板 | ✅ 已实现 | 本仓库 `_bmad/scripts/bmad-speckit/templates/.speckit-state.yaml.template` 存在，字段与文档一致 |
| **IMP-002** | ralph-method SKILL 增加「只能在 tasks.md 后使用」限制 | ✅ 已实现 | 全局 `ralph-method/SKILL.md` 开头 description（第 3–17 行）：⚠️ **重要限制**: 本技能只能在tasks.md生成后使用！禁止场景（未生成 plan/GAPS/tasks）、正确流程、违规后果，与文档 IMP-002 一致 |
| **IMP-003** | bmad-story-assistant §3.2 强化自检（脚本+自检报告） | ✅ 已实现 | 全局 `bmad-story-assistant/SKILL.md` 第 312–323 行：阶段三 Dev Story 发起前必须执行 `python _bmad/scripts/bmad-speckit/python/check_speckit_prerequisites.py --epic {epic} --story {story} --project-root {project_root}` 且退出码为 0，自检结果须含「已运行前置检查脚本且通过」或等价声明 |
| **IMP-004** | 视觉强调（🚨 警告框、统一格式） | ✅ 已实现（全局） | 全局 `~/.cursor/skills/speckit-workflow/SKILL.md` 第 16–17 行已含「🚨 强制约束 - 不可跳过」统一警告框；本仓库原本地 skill 已移除，仅维护全局 |
| **IMP-005** | bmad-story-assistant 开头增加流程图 | ✅ 已实现 | 全局 `bmad-story-assistant/SKILL.md` 第 16–23 行五层架构概览、第 402–416 行时序关系（Layer 3 → Layer 4 specify→plan→GAPS→tasks→执行），与文档 IMP-005 意图一致 |
| **IMP-006** | 开发 check_speckit_prerequisites.py | ✅ 已实现 | 本仓库 `_bmad/scripts/bmad-speckit/python/check_speckit_prerequisites.py` 存在，检查四类文档存在性及审计标记，退出码 0/1 符合文档 |

### 8.2 验证标准 §5.1 逐项（含全局技能后）

| 验证项 | 结论 |
|--------|------|
| 修改后的 skill 文件中，所有「必须」约束都有 🚨 警告框标识 | ✅ 全局 speckit-workflow SKILL 已含 🚨 强制约束块（第 16–17 行）；bmad-story-assistant、ralph-method 已含强约束表述 |
| STORY-A3-DEV 模板包含前置条件检查逻辑 | ✅ 已包含（全局 bmad-story-assistant 第 476–496 行） |
| ralph-method SKILL 明确说明只能在 tasks.md 后使用 | ✅ 已明确（全局 ralph-method description 开头） |
| check_speckit_prerequisites.py 可正确检测文档缺失 | ✅ 脚本存在且逻辑与文档一致 |
| 跳过 plan/GAPS/tasks 时系统明确拒绝并给出指引 | ✅ 主 Agent 自检脚本 exit 1；子任务 STORY-A3-DEV 前置检查会拒绝并返回错误文案 |
| 所有改进经过 code-review 并标记「完全覆盖、验证通过」 | ❓ 未在本次检查中追溯 |

### 8.3 任务分解 §4.1 对应情况

| 任务ID | 结论 |
|--------|------|
| TASK-1 | ✅ bmad-story-assistant 已增加强制前置检查（STORY-A3-DEV 模板内） |
| TASK-2 | ✅ ralph-method 已增加使用限制条款（description 开头） |
| TASK-3 | ✅ 全局 speckit-workflow 已含 🚨 视觉强调（本仓库原本地副本已移除） |
| TASK-4 | ✅ check_speckit_prerequisites.py 已实现 |
| TASK-5 | ✅ .speckit-state.yaml.template 已存在 |
| TASK-6 | 审计标记与脚本检测一致（脚本支持多种标记） |
| TASK-7 | IMPROVED_WORKFLOW_GUIDE 等流程文档已存在 |
| TASK-8 | 未在本次检查中追溯 |

### 8.4 结论（含全局 skills 检查后）

- **已实现**：IMP-001（STORY-A3-DEV 前置检查 + .speckit-state.yaml 模板）、IMP-002（ralph-method 限制）、IMP-003（自检脚本 + 技能内自检清单）、**IMP-004**（🚨 在**全局** speckit-workflow SKILL 中已添加）、IMP-005（流程图）、IMP-006（检查脚本）；TASK-1、TASK-2、**TASK-3**、TASK-4、TASK-5。
- **仅维护全局 skill**：本仓库原 `docs/speckit/skills/speckit-workflow/` 已移除，仅维护全局 `~/.cursor/skills/speckit-workflow/`；详见 §8.5。

### 8.5 全局 speckit-workflow 与本地 skill 关系（确认结论）

**核对结论**（已对照 `C:\Users\<user>\.cursor\skills\speckit-workflow\SKILL.md` 与 原 `docs/speckit/skills/speckit-workflow/`）：

1. **全局 skill 已包含本地 skill 的全部结构并为其超集**  
   全局版本包含：constitution（§0.5）、§0 code-review 调用约定、§1–§5 各阶段（含 1.0 spec 路径约定、1.0.1 产出路径约定、1.0.2 BMAD 与 _bmad-output 对应）、clarify/checklist/analyze 嵌入规则、任务分批执行、审计质量评级、TDD 红绿灯格式、§6 Agent 执行规则、§7 流程小结、§8 命令索引、§9 固定模板与 references。本地仅有精简版 §1–§7，无 constitution、§0、§8 等，故**以全局为准即可覆盖本地**。

2. **IMP-004（🚨 强制约束）已在全局 skill 中实现**  
   全局 `SKILL.md` 第 16–17 行已包含：
   ```markdown
   > 🚨 **强制约束 - 不可跳过**
   > 必须按顺序执行：specify → plan → GAPS → tasks → 执行。每个阶段必须通过 code-review 审计才能进入下一阶段。严禁跳过任何阶段或审计！
   ```
   与文档 IMP-004 / TASK-3 要求一致。

3. **仅维护全局 skill 的决策已执行**  
   - 已删除本仓库内 `docs/speckit/skills/speckit-workflow/` 下所有文件（SKILL.md 及 references 内 audit-prompts.md、mapping-tables.md、tasks-acceptance-templates.md、qa-agent-rules.md）。  
   - 已更新 `docs/BMAD/Cursor_BMAD_多Agent使用指南.md` 中两处对审计提示词路径的引用，改为「全局 speckit-workflow 技能内的 references/audit-prompts.md」（路径如 `{SKILLS_ROOT}/speckit-workflow/references/audit-prompts.md`）。  
   - **今后仅维护全局**：`~/.cursor/skills/speckit-workflow/`（或当前环境 SKILLS_ROOT 下 speckit-workflow）；本仓库不再保留 speckit-workflow 副本。

---

**文档结束**

**下一步行动**: 按照"改进实施计划"启动TASK-1至TASK-3的实施，完成后发起code-reviewer审计子任务。
