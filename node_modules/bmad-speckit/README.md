# bmad-speckit

BMAD-Speckit CLI：init、check、version 等子命令。

## 运行方式

### 从项目根目录（推荐）

先确保已安装依赖：`npm install`（根目录会安装 `file:packages/bmad-speckit`）

```bash
# 方式 1：npx（推荐，参数传递最可靠）
npx bmad-speckit init .
npx bmad-speckit init --help

# 方式 2：npm run
npm run speckit -- init .
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
