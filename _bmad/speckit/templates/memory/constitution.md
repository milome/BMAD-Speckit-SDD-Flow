# Micang Trader 项目开发宪法

## Core Principles

### I. Test-First Development (NON-NEGOTIABLE)

所有新功能开发必须遵循测试驱动开发（TDD）流程：先编写测试用例 → 用户确认 → 测试失败 → 然后实现功能。严格遵循 Red-Green-Refactor 循环。所有图表交互功能、画线交易逻辑、多周期数据同步等核心功能必须包含单元测试和集成测试。测试覆盖率要求：核心业务逻辑 >= 90%，UI 交互逻辑 >= 80%。

### II. Code Quality Standards

代码必须符合 PEP8 标准，使用 ruff 进行代码风格检查，使用 mypy 进行静态类型检查。所有函数和类必须包含 docstring（三引号格式）。代码提交前必须通过 `ruff check .` 和 `mypy vnpy` 检查，不允许存在 error 或 warning。类型注解必须完整，禁止使用 `Any` 类型（除非有明确理由）。

**Import 语句规范（强制要求）**：
- 所有 `import` 语句必须放在文件头部，在模块文档字符串之后、其他代码之前
- 禁止在函数、类或方法内部使用 `import` 语句（除非有特殊需求，如动态导入）
- Import 顺序：标准库 → 第三方库 → 本地模块
- 每个 import 组之间用空行分隔

**异常处理规范（强制要求）**：
- 所有可能抛出异常的操作必须使用 `try/except` 捕获异常
- 包括但不限于：
  - 时间比较操作（可能因时区不一致导致 `TypeError: can't subtract offset-naive and offset-aware datetimes`）
  - 数据库查询操作（可能因连接失败、查询错误等导致异常）
  - 文件 I/O 操作（可能因文件不存在、权限不足等导致异常）
  - 网络请求操作（可能因网络错误、超时等导致异常）
  - 类型转换操作（可能因数据格式错误导致异常）
- 异常处理必须：
  - 捕获具体的异常类型，避免使用裸露的 `except:`
  - 记录详细的错误信息（使用 `logger.error()` 或 `print()`）
  - 提供合理的 fallback 逻辑或错误恢复机制
  - 必要时使用 `exc_info=True` 记录完整的堆栈跟踪

### III. Modular Architecture

图表功能采用 Mixin 模式组织代码，将不同功能模块分离到不同的 Mixin 类中（如 ChartWidgetPositionMixin、ChartWidgetOrderMixin 等）。每个模块必须独立可测试，职责单一。新功能必须作为独立模块添加，避免在现有类中直接扩展导致代码膨胀。

### IV. Real-Time Performance

多周期K线显示和画线交易功能必须保证实时性能：K线数据更新延迟 < 100ms，画线交互响应时间 < 50ms，价格突破触发延迟 < 200ms。使用事件驱动架构，避免阻塞主线程。关键路径必须进行性能测试和优化。

### V. Data Consistency & Persistence

画线交易数据（入场线、止损线、止盈线）必须持久化到数据库，支持跨会话恢复。多周期K线数据必须保持时间同步，避免数据不一致。使用事务确保数据操作的原子性。数据库操作必须包含错误处理和回滚机制。

### VI. Event-Driven Design

所有图表更新、订单状态变化、持仓变化必须通过事件系统（EventEngine）进行通信。禁止直接调用方法传递状态，必须通过事件订阅机制。事件处理必须幂等，支持去重机制避免重复处理。

### VII. Code File Size Limit (MANDATORY)

**所有新增的 Python 源代码文件必须小于 500 行代码（不包括空行和注释）**。当文件接近或超过此限制时，必须**自动进行代码重构**：将功能拆分为独立的模块、类或 Mixin。

**具体要求**：

1. **新增文件限制**：
   - 所有新增的 Python 文件（`.py`）必须 < 500 行
   - 如果预计会超过 500 行，必须在实现前进行拆分设计
   - 禁止创建超过 500 行的新文件

2. **自动重构机制**：
   - 当文件接近 500 行时（如达到 450 行），必须主动进行重构
   - 当文件超过 500 行时，必须立即进行代码分片重构
   - 重构方式：使用 Mixin 模式、组合模式或模块化设计来组织代码
   - 将大文件拆分为多个小文件，每个文件职责单一、独立可测试

3. **代码审查要求**：
   - 代码审查时必须检查文件行数
   - 超过 500 行的文件必须重构后才能合并
   - 使用工具自动检查文件行数（如 `wc -l` 或 `cloc`）

4. **现有文件处理**：
   - 现有超过 500 行的文件应在后续重构中逐步拆分
   - 修改现有大文件时，如果新增代码会导致文件超过 500 行，必须先进行重构

**重构示例**：
- 将单一类拆分为多个 Mixin 类
- 将大函数拆分为多个小函数，放到独立的工具模块
- 将相关功能提取到独立的模块文件

### VIII. GUI Testing Requirements (MANDATORY)

所有图形界面（GUI）相关代码必须包含 QtTest 和 pytest-qt 测试代码。具体要求：

1. **测试框架要求**：
   - 必须使用 `pytest-qt` 进行 Qt 应用测试
   - 必须使用 `QtTest`（PySide6.QtTest 或 PyQt6.QtTest）进行真实事件模拟
   - 禁止仅使用 Mock 对象进行 UI 测试，必须使用真实 Qt 事件

2. **测试覆盖范围**：
   - **鼠标事件**：所有鼠标点击、移动、拖拽、滚轮操作必须使用 `qtbot.mouseClick()`, `qtbot.mousePress()`, `qtbot.mouseMove()`, `qtbot.mouseRelease()`, `qtbot.mouseWheel()` 进行测试
   - **键盘事件**：所有键盘输入、快捷键操作必须使用 `qtbot.keyClick()`, `qtbot.keyPress()` 进行测试
   - **拖拽操作**：所有拖拽功能必须测试完整的拖拽流程（press → move → release）
   - **UI 交互**：所有用户界面交互功能（画线、下单、平仓、菜单操作等）必须有对应的 QtTest 测试

3. **测试文件组织**：
   - QtTest 测试文件命名规范：`test_*_qt.py`（例如：`test_widget_mouse_qt.py`, `test_chart_interaction_qt.py`）
   - 单元测试（使用 Mock）和 QtTest 测试（使用真实事件）应该分别编写，两者互补
   - 参考实现：`tests/chart/test_widget_mouse_qt.py`

4. **测试要求**：
   - 所有新增的 GUI 功能必须在实现前编写 QtTest 测试用例
   - 测试必须验证真实的事件流和用户交互行为
   - 测试覆盖率要求：GUI 交互逻辑 >= 80%，且必须包含 QtTest 测试

### IX. Git 编码设置（强制要求）
**在使用 Git 进行任何提交操作之前，必须严格按照 `tools/Git中文乱码问题解决方案.md` 文档中的说明完成终端编码配置。**

**要求**：
- **优先使用 MCP 工具进行 Git 操作**：所有 Git 操作（提交、推送、分支管理等）应优先使用 MCP（Model Context Protocol）工具，以确保编码一致性和操作规范性
- 所有开发者在使用 Git 前必须配置终端编码为 UTF-8
- 必须配置 Git 全局编码设置（`i18n.commitencoding`、`i18n.logoutputencoding`）
- 推荐使用项目提供的自动化脚本（`fix_git_encoding.ps1`、`setup_powershell_profile.ps1`）进行配置
- 严格禁止提交包含乱码的 commit message
- 所有提交消息必须使用 UTF-8 编码

**验证**：在首次提交前，必须验证配置是否正确：
```powershell
git config --get i18n.commitencoding  # 应返回 utf-8
git config --get i18n.logoutputencoding  # 应返回 utf-8
chcp  # 应显示代码页 65001 (UTF-8)
```

**参考文档**：`tools/Git中文乱码问题解决方案.md`

### X. 问题分析与文档先行（强制要求）
**当用户提出问题或报告 Bug 时，严禁直接修改代码。必须遵循"分析 → 文档 → 确认 → 实施"的流程。**

**强制流程**：
1. **问题分析**：首先对问题进行深入分析，包括：
   - 问题现象和复现步骤
   - 根本原因分析
   - 影响范围评估
   - 可能的解决方案

2. **生成分析文档**：将分析结果生成文档，保存到 `bugfix/` 目录下
   - 文档命名规范：`BUGFIX_问题描述.md` 或 `BUGFIX_功能模块_问题描述.md`
   - 文档应包含：问题描述、原因分析、解决方案、实施计划、风险评估等

3. **用户 Review 确认**：将分析文档提交给用户进行 review
   - 等待用户确认分析结果和解决方案
   - 根据用户反馈调整分析文档
   - 必须获得用户明确确认后才能进入实施阶段

4. **代码实施**：只有在用户确认分析文档后，才能开始修改代码
   - 严格按照已确认的分析文档进行实施
   - 如有偏离，需重新生成文档并确认

**严禁行为**：
- ❌ 禁止在未生成分析文档的情况下直接修改代码
- ❌ 禁止在用户未确认的情况下开始实施
- ❌ 禁止跳过文档化步骤

**文档模板建议**：
```markdown
# BUGFIX: [问题标题]

## 问题描述
[详细描述问题现象]

## 复现步骤
1. [步骤1]
2. [步骤2]

## 根本原因分析
[深入分析问题的根本原因]

## 影响范围
[评估问题的影响范围]

## 解决方案
[提出解决方案]

## 实施计划
[详细的实施步骤]

## 风险评估
[可能的风险和应对措施]
```

## Development Constraints

### Technology Stack

- **Language**: Python 3.10+ (推荐 3.13)
- **UI Framework**: PySide6 6.8.2.1, pyqtgraph >= 0.13.7
- **Testing**: pytest, pytest-qt (Qt 测试框架，GUI 测试必需), QtTest (PySide6.QtTest / PyQt6.QtTest)
- **Code Quality**: ruff (PEP8), mypy (类型检查)
- **Database**: SQLite (默认), 支持其他数据库后端

### Performance Requirements

- K线图表渲染：支持至少 1000 根K线流畅显示
- 多周期同步：支持至少 5 个不同周期同时显示
- 画线交易：支持至少 100 条价格线同时显示和管理
- 内存占用：单个图表窗口内存占用 < 200MB

### Compatibility Requirements

- 支持 Windows、Linux、macOS 平台
- 兼容 VeighNa 现有事件系统和数据接口
- 向后兼容现有 ChartWidget API，不破坏现有功能

## Development Workflow

### XI. 新功能开发 Worktree 设置（强制要求）

**在进行新功能开发时，建立 worktree 和 feature branch 后，必须在 `speckit.plan` 中包含一项任务来更新 `update_and_run_worktree.bat` 文件。**

**要求**：
1. **创建 worktree 和 feature branch 后**：必须在 `speckit.plan` 中添加一项任务，内容为更新 `update_and_run_worktree.bat`
2. **更新内容**：
   - 将 `update_and_run_worktree.bat` 中的分支名更新为新的 feature branch 名称
   - 确保 worktree 路径配置正确
3. **任务优先级**：此任务应作为新功能开发的首要任务之一，确保开发环境正确配置

**speckit.plan 任务示例**：
```markdown
- [ ] 更新 update_and_run_worktree.bat 配置
  - 将分支名更新为 [新功能分支名]
  - 验证 worktree 路径配置正确
```

**目的**：确保开发环境配置与当前功能分支保持同步，避免因配置不一致导致的问题。

### Code Review Process

所有 PR 必须通过以下检查：
1. 代码风格检查：`ruff check .` 无错误
2. 类型检查：`mypy vnpy` 无错误
3. 文件大小检查：所有新增 Python 文件必须 < 500 行，超过必须自动重构（使用工具检查，如 `wc -l`）
4. Import 语句检查：所有 `import` 语句必须在文件头部，禁止在函数/方法内部使用（除非有特殊需求）
5. 异常处理检查：所有可能抛出异常的操作必须使用 `try/except` 捕获，包括时间比较、数据库查询、文件 I/O 等
6. 测试覆盖：新增代码必须有对应测试，覆盖率达标
7. 功能测试：手动测试验证功能正常
8. Constitution 合规性检查：确保符合本 Constitution 的所有原则
9. Git 编码检查：确保提交消息使用 UTF-8 编码，无乱码

### Testing Requirements

- **单元测试**：所有业务逻辑函数必须有单元测试
- **集成测试**：图表与事件系统、数据库的集成必须有测试
- **GUI 测试（强制要求）**：
  - 所有图形界面代码必须使用 QtTest 和 pytest-qt 进行测试
  - 鼠标事件、键盘事件、拖拽操作必须使用真实 Qt 事件模拟（`qtbot.mouseClick()`, `qtbot.keyClick()` 等）
  - 禁止仅使用 Mock 对象进行 UI 测试
  - 测试文件命名：`test_*_qt.py`
  - 关键交互流程（画线、下单、平仓、菜单操作等）必须有对应的 QtTest 测试
- **性能测试**：关键路径必须有性能基准测试

### Documentation Requirements

- 所有公共 API 必须有完整的 docstring
- 复杂算法和业务逻辑必须有注释说明
- 新增功能必须更新相关文档（README、用户文档等）
- 重大变更必须记录在 CHANGELOG 中
- 问题分析和 Bug 修复必须生成文档（见 Principle X）

## Governance

本 Constitution 优先于所有其他开发实践和约定。任何违反 Constitution 原则的代码修改必须经过明确批准并记录理由。

### Amendment Process

- Constitution 的修改必须经过讨论和批准
- 版本号遵循语义化版本：MAJOR.MINOR.PATCH
  - MAJOR: 向后不兼容的原则变更或移除
  - MINOR: 新增原则或重大扩展
  - PATCH: 澄清、措辞修正、非语义性改进
- 修改后必须更新所有相关模板和文档

### Compliance Review

所有 PR 和代码审查必须验证是否符合 Constitution。复杂性必须被证明是必要的，否则必须简化。使用项目文档和设计文档作为运行时开发指导。

### Reference Documents

- **代码质量标准**：参考 `docs/speckit.constitution` 中的详细要求
- **Git 编码设置**：参考 `tools/Git中文乱码问题解决方案.md`
- **问题分析流程**：参考 Principle X 中的文档模板
- **Cursor AI 助手规范**：参考项目根目录或子目录下的 `.cursorrules` 文件，作为本 Constitution 的补充指南。`.cursorrules` 文件定义了针对特定目录的开发规范、技术栈要求和 AI 助手行为准则

**Version**: 1.2.1 | **Ratified**: 2025-01-XX | **Last Amended**: 2025-12-19
