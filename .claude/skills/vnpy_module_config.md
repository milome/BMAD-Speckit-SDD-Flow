# vnpy Module Configuration - vnpy模块配置规范

## 概述

本技能定义了 vn.py 量化交易框架中各模块的目录结构和配置标准，确保所有模块配置一致。

## 快速检查

当需要检查或创建 vn.py 模块配置时，按以下步骤：

### 1. 检查目录结构

```
<module_name>/
├── pyproject.toml           # 必须存在
├── setup.cfg
├── setup.py
└── <module_name>/           # 子目录（与模块名同名）
    ├── __init__.py          # 必须包含固定版本号
    └── ...
```

### 2. 验证 pyproject.toml

```toml
[project]
name = "vnpy_futu"           # 包名
dynamic = ["version"]        # 动态版本

[tool.hatch.version]
path = "vnpy_futu/__init__.py"   # 版本读取路径
pattern = "__version__ = ['\"](?P<version>[^'\"]+)['\"]"

[tool.hatch.build.targets.wheel]
packages = ["vnpy_futu"]     # 打包路径（指向子目录）
```

**关键配置点**：
- `packages` = `["<module_name>"]` - 必须指向子目录
- `path` = `"<module_name>/__init__.py"` - 相对路径指向子目录

### 3. 验证子目录 __init__.py

```python
from .futu_gateway import FutuGateway
from .datafeed import Datafeed

__version__ = "6.3.2808.0"   # 固定版本号，不能是 "dev"
```

## 常见问题修复

### 问题1: 外层有 __init__.py 导致 namespace package 冲突

**现象**: `import vnpy_futu; print(vnpy_futu.__file__)` 返回 `None`

**检查**:
```bash
test -f "<module>/__init__.py" && echo "有外层 __init__.py"
```

**修复**: 删除外层 `__init__.py`

### 问题2: 版本解析失败

**现象**: 安装时提示 `"dev"` 是无效版本

**检查**:
```bash
grep "__version__" <module>/<module>/__init__.py
```

**修复**: 将版本号改为固定值，如 `"6.3.2808.0"`

### 问题3: packages 配置错误

**现象**: editable 安装成功但导入路径错误

**检查**:
```bash
python -c "import <module>; print(__module__.__file__)"
# 应该输出: .../<module>/<module>/__init__.py
```

**修复**: 确认 pyproject.toml 中 `packages = ["<module_name>"]`

## 开发模式安装

```bash
pip install -e <path_to_module> --no-deps --no-build-isolation
```

## 验证命令

```python
import vnpy_futu
print(f"__file__: {vnpy_futu.__file__}")
print(f"__version__: {vnpy_futu.__version__}")

# 预期输出:
# __file__: D:\Dev\...\vnpy_futu\vnpy_futu\__init__.py
# __version__: 6.3.2808.0
```

## 配置文件模板

### pyproject.toml

```toml
[project]
name = "vnpy_example"
dynamic = ["version"]
description = "Example gateway for vn.py quant trading framework."

[tool.hatch.version]
path = "vnpy_example/__init__.py"
pattern = "__version__ = ['\"](?P<version>[^'\"]+)['\"]"

[tool.hatch.build.targets.wheel]
packages = ["vnpy_example"]
include-package-data = true
```

### vnpy_example/vnpy_example/__init__.py

```python
from .example_gateway import ExampleGateway

__version__ = "1.0.0"
```

## 相关文档

- [docs/vnpy_module_config.md](../../docs/vnpy_module_config.md)
