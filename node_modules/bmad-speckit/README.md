# bmad-speckit

BMAD-Speckit CLI：init、check、version 等子命令。

## 子命令一览

| 命令 | 用途 |
|------|------|
| `init [project-name]` | 初始化新 bmad-speckit 项目（骨架、_bmad、配置、脚本） |
| `check` | 校验项目配置（bmadPath、AI、Agent 工具等） |
| `version` | 显示 CLI 版本、模板版本、Node 版本 |
| `upgrade` | 升级项目内模板版本 |
| `config get/set/list` | 读写 bmad-speckit 配置 |
| `feedback` | 显示反馈入口与全流程兼容 AI 列表 |

## 配置存储位置

- **项目级**：`_bmad-output/config/bmad-speckit.json`（项目根下）
- **全局**：`~/.bmad-speckit/config.json`

项目配置覆盖全局同名键。

## 与 bmad-method 关系

bmad-speckit 以 bmad-method 为模板来源；`init` 会拉取并展开模板到目标目录。可通过 `config set templateSource <repo>` 或环境变量 `SDD_TEMPLATE_REPO` 指定自定义模板源。

## 运行方式

### 从项目根目录（推荐）

先确保已安装依赖：`npm install`（根目录会安装 `file:packages/bmad-speckit`）

```bash
# 方式 1：npx（推荐，参数传递最可靠）
npx bmad-speckit init .
npx bmad-speckit init --help   # 查看 init 帮助与 banner

# 方式 2：npm run（内部调用 bmad-speckit）
npm run speckit -- init .
npm run speckit -- init --help # 等价于 bmad-speckit init --help
npm run speckit:init
```

### 从 packages/bmad-speckit 目录

```bash
cd packages/bmad-speckit
node bin/bmad-speckit.js init .
```

### 全局安装（可选）

```bash
cd packages/bmad-speckit
npm link
# 之后可在任意目录运行
bmad-speckit init .
```
