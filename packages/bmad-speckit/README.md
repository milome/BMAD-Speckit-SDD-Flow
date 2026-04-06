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

## 打包与发布语义

- `packages/bmad-speckit/_bmad/` 是发布镜像目录，不是手写源码目录。
- 它的内容来自仓库根目录的 [`_bmad`](D:/Dev/BMAD-Speckit-SDD-Flow/_bmad)，包含上游模板内容与本仓库定制。
- 发布前会通过 `prepack` / `prepublishOnly` 自动执行 `../../scripts/prepublish-check.js`，把根目录 `_bmad` 同步到当前包内镜像，并同步 bundled dependencies。
- `package.json` 的 `files` 显式包含 `_bmad/`，因此 tarball 会携带完整模板，消费项目不需要依赖本地存在 `BMAD-Speckit-SDD-Flow` 仓库。
- 不要手工删除 `packages/bmad-speckit/_bmad`，也不要把它改成仅本地开发可见的临时目录；如果需要更新其内容，应更新根目录 `_bmad`，然后重新执行打包前同步。

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
