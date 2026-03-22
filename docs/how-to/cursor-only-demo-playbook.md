# Cursor-only 消费者演示剧本（同级目录）

在仓库**父级**创建演示目录并仅部署 Cursor 运行时，用于手动手眼验证 hooks、policy 阶段变化、`bmad-speckit check/score` 与最小 Story 代码闭环。

## 初始化（从本仓库根执行）

```powershell
node scripts/init-to-root.js ..\BMAD-Speckit-SDD-Flow-Demo --agent cursor
```

将路径换成你的同级目录名即可。**不要**在同一命令中加 `init:claude`，以免写入 `.claude/`。

## 参考实现

若本机已创建 `D:\Dev\BMAD-Speckit-SDD-Flow-Demo`，其中包含：

- 检查表：`BMAD-Speckit-SDD-Flow-Demo/docs/CURSOR_DEMO_WALKTHROUGH_CHECKLIST.md`（≤10 条预期现象）
- Story 99.1 + `specify→plan→GAPS→tasks→implement` 落盘文件与 `src/greet` 三用例

## 注意事项

- `emit-runtime-policy` 在无 `--cwd` 时受环境变量 `BMAD_RUNTIME_CWD` 影响；验证消费者目录时请显式 `--cwd` 或清除该变量。
- 消费者根 `package.json` **不建议**设置 `"type":"module"`，除非已将 `.cursor/hooks` 内脚本改为 ESM；否则 `require` 会失败。
