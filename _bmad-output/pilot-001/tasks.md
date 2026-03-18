# Pilot 001 Tasks

## Task 1: Read package.json
**TDD**: N/A (读取操作)
- [ ] 读取 package.json
- [ ] 确认 scripts 部分存在

## Task 2: Add test:bmad script
**TDD**:
- [ ] RED: 运行 `npm run test:bmad` 应失败（脚本不存在）
- [ ] GREEN: 添加脚本后应成功
- [ ] REFACTOR: 优化脚本格式

操作：
- [ ] 在 scripts 中添加 `"test:bmad": "vitest run scripts/accept-*.test.ts"`

## Task 3: Verify JSON syntax
**TDD**: N/A
- [ ] 验证 package.json 格式正确
- [ ] 运行 `npm run test:bmad` 验证

## Task 4: Run full test
**TDD**: N/A
- [ ] 执行 `npm run test:bmad`
- [ ] 确认所有 12 个测试通过

## Task 5: Lint check
**TDD**: N/A
- [ ] 运行 `npm run lint`
- [ ] 确认无错误
