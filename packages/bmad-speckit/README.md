# bmad-speckit

内部 workspace CLI：为根包 `bmad-speckit-sdd-flow` 提供 `bmad-speckit` / `bmad-speckit-init` 等命令实现。

> 该目录不再作为独立公开包发布。
> 对外发布、Release asset 与 npm 安装面以根包 `bmad-speckit-sdd-flow` 为准。

## 子命令一览

| 命令 | 用途 |
|------|------|
| `init [project-name]` | 初始化新 bmad-speckit 项目（骨架、_bmad、配置、脚本） |
| `check` | 校验项目配置（bmadPath、AI、Agent 工具等） |
| `version` | 显示 CLI 版本、模板版本、Node 版本 |
| `upgrade` | 升级项目内模板版本 |
| `config get/set/list` | 读写 bmad-speckit 配置 |
| `feedback` | 显示反馈入口与全流程兼容 AI 列表 |
| `uninstall` | 安全卸载当前项目中由安装器受管的 BMAD/Speckit 安装面 |

## 配置存储位置

- **项目级**：`_bmad-output/config/bmad-speckit.json`（项目根下）
- **全局**：`~/.bmad-speckit/config.json`

项目配置覆盖全局同名键。

## 卸载边界

```bash
npx bmad-speckit uninstall
```

可选参数：

```bash
npx bmad-speckit uninstall --agent cursor
npx bmad-speckit uninstall --remove-global-skills
npx bmad-speckit uninstall --dry-run
```

重要边界：

- 只删除安装器记录为受管的安装面
- 不直接整删 `.cursor`、`.claude`、全局 skills 根目录
- **禁止删除 `_bmad-output`**
- 对安装前已存在且被覆盖的条目，优先恢复快照；无法安全恢复时会 `skip + report`
- 卸载报告写入：`_bmad-output/config/bmad-speckit-uninstall-report.json`

## 与 bmad-method 关系

bmad-speckit 以 bmad-method 为模板来源；`init` 会拉取并展开模板到目标目录。可通过 `config set templateSource <repo>` 或环境变量 `SDD_TEMPLATE_REPO` 指定自定义模板源。

## 打包与发布语义

- `packages/bmad-speckit/_bmad/` 是发布镜像目录，不是手写源码目录。
- 它的内容来自仓库根目录的 [`_bmad`](D:/Dev/BMAD-Speckit-SDD-Flow/_bmad)，包含上游模板内容与本仓库定制。
- 当前目录保留 `prepack` / `prepublishOnly` 脚本，是为了支持根包打包前的内部同步与本地调试，不代表支持独立公开发布。
- 对外 tarball 与 npm 发布语义统一由根包 `bmad-speckit-sdd-flow` 承担；消费项目应安装或临时执行根包，再通过其暴露出的 `bmad-speckit` / `bmad-speckit-init` 命令工作。
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

### 独立运行（仅内部调试）

```bash
cd packages/bmad-speckit
npm link
# 仅用于仓库维护者本地调试，不是公开支持安装路径
bmad-speckit init .
```
