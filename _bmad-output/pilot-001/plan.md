# Pilot 001 Plan

## Architecture

修改 `package.json` 的 `scripts` 部分，添加：
```json
"test:bmad": "vitest run scripts/accept-bmad-*.test.ts scripts/accept-layer4-*.test.ts scripts/accept-commit-gate.test.ts scripts/accept-runtime.test.ts scripts/accept-checklists.test.ts scripts/accept-extensions.test.ts"
```

## File Mapping

| File | Action | Purpose |
|------|--------|---------|
| package.json | Modify | Add test:bmad script |

## Test Strategy

- **单元测试**: 验证 npm script 可执行
- **集成测试**: 验证所有 BMAD 测试通过

## Execution Steps

1. 读取当前 package.json
2. 在 scripts 中添加 test:bmad
3. 运行 `npm run test:bmad` 验证
4. 确认所有测试通过

## Risk Mitigation

- 修改前备份 package.json
- 验证 JSON 语法正确
