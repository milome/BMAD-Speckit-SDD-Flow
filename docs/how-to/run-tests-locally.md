# 本地运行测试完整指南

本文档详细说明如何在本地环境中完整运行 BMAD-Speckit-SDD-Flow 的测试套件，确保与 CI 环境一致。

## 前置要求

- **Node.js**: >= 20.x (推荐 22.x)
- **npm**: >= 10.x
- **Git**: 已配置并可访问 GitHub

## 完整执行步骤

### 步骤 1: 克隆仓库

```bash
git clone https://github.com/milome/BMAD-Speckit-SDD-Flow.git
cd BMAD-Speckit-SDD-Flow
```

### 步骤 2: 安装根目录依赖

```bash
npm ci
```

> **注意**: 使用 `npm ci` 而非 `npm install`，确保与 CI 环境使用完全相同的依赖版本。

### 步骤 3: 构建 scoring 包

```bash
npm run build:scoring
```

这会编译 `packages/scoring` 的 TypeScript 代码到 `dist/` 目录。

### 步骤 4: 链接 bmad-speckit CLI（关键步骤）

这是确保 `accept-install-consumer-cli.test.ts` 测试通过的关键：

```bash
# 进入 bmad-speckit 包目录
cd packages/bmad-speckit

# 创建全局链接
npm link

# 返回根目录
cd ../..

# 将本地包链接到项目
npm link bmad-speckit
```

**验证链接是否成功:**
```bash
npx bmad-speckit --version
# 应输出: 0.1.0
```

### 步骤 5: 运行完整测试

#### 方式 A: 运行 CI 完整测试（推荐）

```bash
npm run test:ci
```

这会依次执行:
1. `npm run init:claude` - 部署运行时目录
2. `vitest run` - 运行 922 个 vitest 测试
3. `npm run test:bmad-speckit` - 运行 bmad-speckit 包测试

#### 方式 B: 分步运行

如果你需要调试或只想运行部分测试：

```bash
# 1. 初始化 Claude 运行时
npm run init:claude

# 2. 运行所有 vitest 测试
npx vitest run

# 3. 运行 bmad-speckit 包测试（Node.js 原生测试）
cd packages/bmad-speckit
node --test tests/
```

### 步骤 6: 运行 Lint 检查（可选）

```bash
npm run lint
```

## 预期输出

### 成功运行的标志

```
Test Files  89 passed (89)
Tests       922 passed (922)
Duration    ~30s
```

关键测试 `accept-install-consumer-cli.test.ts` 应显示:
```
✓ init-to-root deploy → bmad-speckit check passes
✓ init-to-root deploy → bmad-speckit version runs
✓ npm install → postinstall deploys → bmad-speckit check passes
```

### 可忽略的警告

以下输出不影响测试通过:

1. **scoring 包警告** (黄色 WARN):
   ```
   WARN: implement stage report has no parseable dimension_scores...
   ```
   这是测试预期的警告信息。

2. **eval-questions CLI 错误**:
   ```
   Error: --title 必填
   Error: --id 必填
   ```
   这是 CLI 参数验证测试的预期输出。

3. **test:bmad-speckit 失败**:
   ```
   Error: Cannot find module '.../packages/bmad-speckit/tests'
   ```
   这是由于 Node.js `--test` 运行器对目录的处理方式不同，不影响 vitest 测试。

## 常见问题排查

### 问题 1: `npx bmad-speckit` 返回 404

**现象:**
```
npm error 404 Not Found - GET https://registry.npmjs.org/bmad-speckit
```

**原因:** `bmad-speckit` 未链接到本地项目。

**解决:** 执行步骤 4 的链接命令。

### 问题 2: `accept-install-consumer-cli.test.ts` 失败

**现象:** 3 个 CLI 测试失败。

**原因:** 测试在临时目录中运行 `npx bmad-speckit`，但 CLI 未全局可用。

**解决:** 
1. 确保已执行 `npm link` (步骤 4)
2. 或者临时安装到全局: `cd packages/bmad-speckit && npm install -g .`

### 问题 3: scoring 包构建失败

**现象:**
```
Error: Cannot find module '@bmad-speckit/scoring'
```

**解决:**
```bash
cd packages/scoring
npm install
npm run build
```

### 问题 4: 权限错误 (macOS/Linux)

**现象:**
```
npm ERR! code EACCES
```

**解决:**
```bash
# 更改 npm 全局目录权限
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
export PATH=~/.npm-global/bin:$PATH
```

## 与 CI 的差异说明

| 项目 | CI (GitHub Actions) | 本地 |
|------|---------------------|------|
| Node.js 版本 | 20.x | >= 20.x |
| 安装命令 | `npm ci` | `npm ci` |
| bmad-speckit 链接 | 通过 workspaces 自动处理 | 需手动 `npm link` |
| 测试命令 | `npm run test:ci` | `npm run test:ci` |
| 运行环境 | ubuntu-latest | macOS/Linux/Windows |

## 快速验证脚本

创建 `verify-local.sh`:

```bash
#!/bin/bash
set -e

echo "=== BMAD-Speckit 本地测试验证 ==="

echo "1. 检查 Node.js 版本..."
node --version

echo "2. 安装依赖..."
npm ci

echo "3. 构建 scoring 包..."
npm run build:scoring

echo "4. 链接 bmad-speckit CLI..."
cd packages/bmad-speckit
npm link
cd ../..
npm link bmad-speckit

echo "5. 验证 CLI 可用..."
npx bmad-speckit --version

echo "6. 运行完整测试..."
npm run test:ci

echo "=== 验证完成 ==="
```

运行:
```bash
chmod +x verify-local.sh
./verify-local.sh
```

## 参考

- [CI 配置](../../.github/workflows/ci.yml)
- [package.json](../../package.json)
- [Vitest 配置](../../vitest.config.ts)

