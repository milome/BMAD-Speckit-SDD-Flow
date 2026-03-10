# plan-E7-S2：SFT 提取 Command 实现方案

**Epic**：E7 eval-ux-dashboard-and-sft  
**Story ID**：7.2  
**输入**：`spec-E7-S2.md`、Story 7.2、prd.eval-ux-last-mile.md §5.4、scoring/analytics/sft-extractor.ts

---

## 1. 需求映射清单（plan.md ↔ 需求文档 + spec.md）

| 需求文档章节 | spec.md 对应 | plan.md 对应 | 覆盖状态 |
|-------------|-------------|-------------|----------|
| REQ-UX-4.1 无参数运行 | spec §3.1 | Phase 1, §4 | ✅ |
| REQ-UX-4.2 阈值筛选 | spec §3.2, §3.3 | Phase 2, §4.2 | ✅ |
| REQ-UX-4.3 git diff fallback | spec §3.4 | Phase 2, §4.3 | ✅ |
| REQ-UX-4.4 输出摘要 | spec §3.6 | Phase 2, §4.5 | ✅ |
| REQ-UX-4.5 去重 | spec §3.5 | Phase 2, §4.4 | ✅ |
| REQ-UX-4.6 JSONL 格式 | spec §3.7 | Phase 2, §4.1 | ✅ |
| AC-1～AC-6 | spec §3.8 | Phase 3, §5 | ✅ |

---

## 2. 目标与约束

- 增强 `scoring/analytics/sft-extractor.ts`：has_code_pair、fallback、去重、摘要、阈值可配置。
- 新建 `scripts/sft-extract.ts`、`commands/bmad-sft-extract.md`。
- 复用 getScoringDataPath()；输出路径 `scoring/data/sft-dataset.jsonl` 或 `--output` 指定。
- 禁止伪实现、占位；TDD 红绿灯模式。

---

## 3. 实施分期

### Phase 1：Command 文档与脚本骨架

1. 新建 `commands/bmad-sft-extract.md`：定义 `/bmad-sft-extract` 触发；无参数运行；支持 `--output`、`--threshold`；验收命令。
2. 新建 `scripts/sft-extract.ts`：
   - 解析 `--output`、`--threshold`；env `SFT_THRESHOLD` 作为 fallback；
   - 调用 getScoringDataPath() 或等价；
   - 调用 extractSftDataset 增强版（传入 threshold、outputPath）。

### Phase 2：sft-extractor 增强

1. **SftEntry 扩展**：新增 `has_code_pair: boolean`。
2. **阈值可配置**：`extractSftDataset(dataPath?, outputPath?, options?: { threshold?: number })`；默认 threshold=60；筛选 `phase_score <= threshold`。
3. **git diff 失败 fallback**：在 try/catch 或 diff 为空时，不再 skip；输出 instruction-only entry，`has_code_pair: false`，`input`、`output` 为空。
4. **去重**：在写入前按 `source_run_id+base_commit_hash+source_path` 去重；保留首次出现。
5. **输出摘要**：计算 N（写入条数）、M（唯一 Story 数）、K（跳过条数）；stdout 输出「共提取 N 条，覆盖 M 个 Story；跳过 K 条（原因：…）」；skip 原因可汇总（如「无 source_path: 3」「base_commit_hash 不可验证: 2」）。
6. **JSONL 写入**：每行含 instruction、input、output、source_run_id、base_commit_hash、has_code_pair。

### Phase 3：验收与测试

1. 验收命令：`npx ts-node scripts/sft-extract.ts`。
2. 若存在 `.cursor/commands/`，同步 `bmad-sft-extract.md`。
3. 单元测试：fallback、去重、摘要、阈值、has_code_pair。
4. 集成：有数据/无数据/部分 git diff 失败时运行脚本，验证 JSONL 与摘要。

---

## 4. 模块与文件改动设计

### 4.1 新增文件

| 文件 | 责任 | 对应需求 |
|------|------|----------|
| `commands/bmad-sft-extract.md` | /bmad-sft-extract 触发、验收 | spec §3.1 |
| `scripts/sft-extract.ts` | CLI 入口、解析参数、调用 extractSftDataset | spec §3.1, §3.3 |

### 4.2 修改文件

| 文件 | 改动 | 对应需求 |
|------|------|----------|
| `scoring/analytics/sft-extractor.ts` | has_code_pair、fallback、去重、摘要、阈值参数 | spec §3.2～§3.7 |

### 4.3 依赖关系

| 依赖 | 路径 |
|------|------|
| 数据路径 | getScoringDataPath（scoring/constants/path） |
| 记录加载 | loadRecordsFromDataPath（sft-extractor 内）或 loadAndDedupeRecords（scoring/query） |
| Story 解析 | parseEpicStoryFromRecord（scoring/query）用于 M 计算 |

### 4.4 数据路径

- 输入：getScoringDataPath() 或 dataPath 参数；
- 输出：`scoring/data/sft-dataset.jsonl` 或 `--output` 指定；相对路径按 process.cwd() 解析。

---

## 5. 详细技术方案

### 5.1 阈值解析优先级

```ts
function getThreshold(): number {
  const cli = parseArgs().threshold;  // --threshold N
  if (cli != null) return Number(cli);
  const env = process.env.SFT_THRESHOLD;
  if (env != null) return Number(env);
  return 60;
}
```

### 5.2 git diff 失败 fallback

- 原逻辑：`gitDiffBetween` 抛错或 diff 空 → skip（continue）。
- 新逻辑：try/catch；失败时 push `{ instruction, input: '', output: '', has_code_pair: false }`，不 skip。
- 若 `parseDiffToInputOutput(diff)` 结果 input/output 均为空，可视作无效代码对，也可 fallback 为 has_code_pair: false。

### 5.3 去重实现

```ts
function dedupeByKey(entries: SftEntry[]): SftEntry[] {
  const seen = new Set<string>();
  return entries.filter((e) => {
    const key = `${e.source_run_id}|${e.base_commit_hash}|${sourcePathFromEntry(e)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
```

注意：SftEntry 当前无 source_path 字段，需在提取时保留或在去重时从 record 传入；或扩展 SftEntry 增加 source_path 用于去重与摘要。

### 5.4 摘要 M 计算

- entries 去重后，对每条 entry 的 source_run_id 或关联的 source_path 调用 parseEpicStoryFromRecord（需构造 RunScoreRecord 或从 run_id/source_path 解析）。
- 简化：若 SftEntry 保留 source_path，可用 parseEpicStoryFromSourcePath 或等价；否则用 run_id 解析。
- 唯一 Story 数：new Set(parsed.map(p => `${p.epicId}.${p.storyId}`)).size。

### 5.5 验收命令

| 场景 | 命令 | 预期 |
|------|------|------|
| 有数据 | `npx ts-node scripts/sft-extract.ts` | sft-dataset.jsonl 存在；摘要正确；has_code_pair 正确 |
| 阈值 | `--threshold 50` 或 SFT_THRESHOLD=50 | 仅 phase_score≤50 参与 |
| git diff 失败 | fixture 含无效 commit | has_code_pair: false 的 entry 写入；摘要 N 含该条 |
| 去重 | fixture 含重复 | JSONL 无重复 |
| 无数据 | 空目录 | 摘要「共提取 0 条...」；sft-dataset.jsonl 可为空或不存在 |

---

## 6. 执行准入标准

- 生成 tasks-E7-S2.md 后，所有任务须具备明确文件路径与验收命令。
- 单元测试通过：sft-extractor 增强逻辑。
- 集成验证：`npx ts-node scripts/sft-extract.ts` 可执行；输出 JSONL 与摘要符合 AC。
- TDD 红绿灯：每任务须记录 [TDD-RED]、[TDD-GREEN]、[TDD-REFACTOR]。
