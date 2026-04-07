# @bmad-speckit/runtime-emit

为消费者项目提供 runtime governance 的可部署产物：

- `dist/emit-runtime-policy.cjs`
- `dist/resolve-for-session.cjs`
- `dist/render-audit-block.cjs`
- `write-runtime-context.cjs`

这些文件由 `bmad-speckit` 的安装/同步链复制到消费者项目的 `.cursor/hooks/` 与 `.claude/hooks/`，不再落到项目根 `scripts/`。

## runtime context 写入契约

`write-runtime-context.cjs` 的目标文件是显式传入的 context 文件路径，默认消费者链路会写到：

`_bmad-output/runtime/context/project.json`

CLI 形态：

```bash
node write-runtime-context.cjs <targetFile> [flow] [stage] [templateId?] [epicId] [storyId] [storySlug] [runId] [artifactRoot] [contextScope] [workflow] [step] [artifactPath]
```

## 构建

```bash
npm run build -w @bmad-speckit/runtime-emit
# 或
cd packages/runtime-emit && npm run build
```

monorepo 根目录本地 `npm install` 会运行 `prepare`。发布到 npm 前 `prepublishOnly` 会写入 `dist/`，因此 tarball 自带消费者所需运行时文件。
