# IMPLEMENTATION_GAPS E8-S1：题库目录结构与 manifest

**Epic**：8 eval-question-bank  
**Story**：8.1 question-bank-structure-manifest  
**对照基准**：spec-E8-S1.md、plan-E8-S1.md、8-1-question-bank-structure-manifest.md、MANIFEST_SCHEMA.md

---

## 1. Gaps 清单（按需求文档章节）

| 需求文档章节 | Gap ID | 需求要点 | 当前实现状态 | 缺失/偏差说明 |
|-------------|--------|----------|-------------|---------------|
| Story §3.1 目录结构 | GAP-8.1.1 | 建立 v2 目录及 manifest.yaml | 未实现 | v2 目录不存在；v1 已存在且含 manifest.yaml |
| Story §3.1 manifest schema | GAP-8.1.2 | TypeScript 类型 EvalQuestionEntry、EvalQuestionManifest | 未实现 | 无 manifest-loader.ts 或 types |
| Story §3.1 加载器 | GAP-8.1.3 | loadManifest(versionDir): EvalQuestionManifest | 未实现 | 无 manifest-loader.ts |
| Story §3.1 校验规则 | GAP-8.1.4 | id 版本内唯一、path 存在性 | 未实现 | 无加载器即无校验逻辑 |
| Story §3.1 MANIFEST_SCHEMA 同步 | GAP-8.1.5 | 文档与实现一致 | 待验证 | 实现完成后需比对并更新 |
| Story §3.1 版本隔离 | GAP-8.1.6 | v1/v2 独立 manifest | 部分 | v2 缺失；加载器未实现 |
| Story §5 T4、§6.3 | GAP-8.1.7 | 单元测试：loadManifest 解析、校验、版本隔离 | 未实现 | 无 manifest-loader.test.ts |
| plan §5.2 测试用例 | GAP-8.1.7a | 7 类用例：空 manifest、版本隔离、解析成功、格式错误、缺必填、id 重复、path 不存在 | 未实现 | 见 GAP-8.1.7 |
| plan §5.3 集成验证 | GAP-8.1.7b | 从生产模块 import、真实 v1/v2 或 fixtures；不修改 eval-question-flow.test.ts | 未实现 | 见 GAP-8.1.7 |
| plan §5.4 验收命令 | GAP-8.1.7c | npx vitest run scoring/eval-questions、npm test | 未执行 | 待测试就绪后执行 |
| plan §7.1 集成测试 | GAP-8.1.7d | manifest-loader 可被导入、真实路径调用 | 未实现 | 由 manifest-loader.test.ts 实现 |
| MANIFEST_SCHEMA §1～§5 | GAP-8.1.5 | §1 目录、§2 schema、§3 题目模板、§5 校验 | 待验证 | 见 GAP-8.1.5 |

---

## 2. 需求映射清单（Gaps ↔ 需求文档）

| 需求文档 | 章节 | 对应 Gap | 说明 |
|----------|------|----------|------|
| 8-1-question-bank-structure-manifest | §3.1 | GAP-8.1.1～8.1.6 | 目录、schema、加载器、校验、文档同步、版本隔离 |
| 8-1-question-bank-structure-manifest | §5 T4、§6.3 | GAP-8.1.7、8.1.7a～8.1.7d | 单元测试与验收 |
| spec-E8-S1 | §2～§7 | GAP-8.1.1～8.1.7 | 全覆盖 |
| plan-E8-S1 | Phase 1～4、§5、§7 | GAP-8.1.1～8.1.7d | 全覆盖 |
| MANIFEST_SCHEMA | §1～§5 | GAP-8.1.5 | 文档同步 |

---

## 3. 当前实现快照

| 组件 | 路径 | 状态 |
|------|------|------|
| v1 目录 | scoring/eval-questions/v1/ | 已存在 |
| v1 manifest | scoring/eval-questions/v1/manifest.yaml | 已存在，questions: [] |
| v2 目录 | scoring/eval-questions/v2/ | 不存在 |
| v2 manifest | scoring/eval-questions/v2/manifest.yaml | 不存在 |
| manifest-loader | scoring/eval-questions/manifest-loader.ts | 不存在 |
| MANIFEST_SCHEMA | scoring/eval-questions/MANIFEST_SCHEMA.md | 已存在 |
| 单元测试 | scoring/eval-questions/__tests__/manifest-loader.test.ts | 不存在 |

---

<!-- AUDIT: PASSED by code-reviewer -->
