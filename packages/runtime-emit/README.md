# @bmad-speckit/runtime-emit

esbuild 单文件打包 `../../scripts/emit-runtime-policy.ts` → `dist/emit-runtime-policy.cjs`，供 `emit-runtime-policy-cli.js` 与消费者项目在无 `ts-node` 时执行。

## 与 `@bmad-speckit/scoring` 一致的模式

- 由 `bmad-speckit` 以 `file:../runtime-emit`（monorepo）或发布后的 semver 依赖安装；安装后出现在 `node_modules/@bmad-speckit/runtime-emit/`。
- `init-to-root.js` 通过 `require.resolve('@bmad-speckit/runtime-emit', { paths: [pkgRoot] })` 定位产物，并复制到目标项目的 `scripts/emit-runtime-policy.cjs`。

## 构建

```bash
npm run build -w @bmad-speckit/runtime-emit
# 或
cd packages/runtime-emit && npm run build
```

本地 `npm install` 于 monorepo 根目录时会运行 **prepare**（若 devDependencies 已安装）。发布到 npm 前 **prepublishOnly** 会写入 `dist/`， tarball 内含构建结果，消费者无需 esbuild。
