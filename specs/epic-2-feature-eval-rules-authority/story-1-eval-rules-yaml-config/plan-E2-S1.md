# plan-E2-S1：eval-rules-yaml-config 实现方案

**Epic**：E2 feature-eval-rules-authority  
**Story ID**：2.1  
**输入**：spec-E2-S1.md

---

## 1. 目标与约束

- 实现环节 2/3/4 的 YAML schema、gaps-scoring.yaml、iteration-tier.yaml，与 code-reviewer-config 通过 ref 衔接。
- 解析器读入 YAML 并产出结构化配置，供 Story 1.1 calculator、Story 3.x 解析器使用。
- 复用 config/code-reviewer-config.yaml；ref 指向的 item_id 不存在时，在 config 中补充或解析器给出明确错误。

---

## 2. YAML Schema 设计

### 2.1 环节 2/3/4 共用 Schema（TypeScript 类型 + 运行时校验）

```ts
interface PhaseScoringYaml {
  version: string;
  stage: string;
  link_stage: string[];
  link_环节: number;
  weights: { base: Record<string, number>; bonus?: Record<string, number> };
  items: Array<{ id: string; ref: string; deduct: number }>;
  veto_items?: Array<{ id: string; ref: string; consequence: string }>;
}
```

- ref 格式校验：`/^code-reviewer-config#[a-zA-Z0-9_]+$/`
- items 每项必含 id、ref、deduct
- veto_items 每项必含 id、ref、consequence

### 2.2 gaps-scoring.yaml Schema

```ts
interface GapsScoringYaml {
  version: string;
  stage: 'gaps';
  link_stage: string[];
  link_环节: number;  // 1（前置）或 [2,6]（后置子维度）
  weights: {
    base: { spec_coverage: number; gap_definition?: number; risk_anticipation?: number };
    post_implement?: Record<string, number>;
    post_post_impl?: Record<string, number>;
  };
  veto_items?: Array<{ id: string; ref?: string; consequence: string }>;
}
```

- 前置 40%：spec_coverage 或等价字段
- 后置 implement/post_impl 权重：按 Architecture §9、表 B gaps 双轨

### 2.3 iteration-tier.yaml Schema

```ts
interface IterationTierYaml {
  iteration_tier: Record<number, number>;  // 1: 1.0, 2: 0.8, 3: 0.5, 4: 0
  severity_override?: Record<string, number>;  // fatal: 3, serious: 2
}
```

---

## 3. 解析器设计

### 3.1 模块路径

- `scoring/parsers/rules.ts`（或 `scoring/rules/parser.ts`）— 主解析入口
- 解析器职责：加载 YAML、校验 schema、解析 ref 并关联 code-reviewer-config

### 3.2 核心 API

```ts
// 加载环节 2/3/4 的 YAML
export function loadPhaseScoringYaml(
  phase: 2 | 3 | 4,
  options?: { rulesDir?: string; configPath?: string }
): PhaseScoringConfig;

// 加载 gaps-scoring.yaml
export function loadGapsScoringYaml(options?: { rulesDir?: string }): GapsScoringConfig;

// 加载 iteration-tier.yaml
export function loadIterationTierYaml(options?: { rulesDir?: string }): IterationTierConfig;

// ref 解析：将 ref 指向的 item 从 code-reviewer-config 解析出来
export function resolveRef(ref: string, configPath?: string): ResolvedItem | never;
```

- `resolveRef` 若 item_id 在 config 中不存在，抛错 `RefResolutionError`（含 ref、item_id、configPath）
- 产出结构化配置：含解析后的 items（合并 code-reviewer-config 的检查项元数据）、veto_items、weights

### 3.3 code-reviewer-config 扩展

- 当前 config 仅有 modes（code、prd、arch、pr）的 dimensions、pass_criteria
- 需扩展：增加 `items` 或 `check_items` 节，每项含 `item_id`、`name`、`description` 等，供 ref 解析
- 增加 `veto_items` 节，每项含 `veto_*` 标识
- 若现有 config 无该结构，在 Story 2.1 中补充与 rules 中 ref 对应的 item_id

---

## 4. 目录与文件布局

| 路径 | 说明 |
|------|------|
| scoring/rules/default/implement-scoring.yaml | 环节 2 |
| scoring/rules/default/test-scoring.yaml | 环节 3 |
| scoring/rules/default/bugfix-scoring.yaml | 环节 4 |
| scoring/rules/gaps-scoring.yaml | 根目录 |
| scoring/rules/iteration-tier.yaml | 根目录 |
| scoring/parsers/rules.ts | 解析器（或 scoring/rules/parser.ts） |
| scoring/schema/phases-scoring-schema.json | 环节 2/3/4 JSON schema（可选，用于 ajv 校验） |
| config/code-reviewer-config.yaml | 扩展 item_id、veto_* |
| scoring/__tests__/rules/*.test.ts | 单元测试 |
| scripts/accept-e2-s1.ts | 验收脚本 AC-1～AC-7 |

---

## 5. 集成测试与端到端测试计划

| 测试类型 | 覆盖 | 验证方式 |
|----------|------|----------|
| 单元测试 | 解析合法 YAML 产出正确结构 | parsePhaseScoring(2)、parseGaps、parseIterationTier |
| 单元测试 | 非法 YAML（缺字段、ref 格式错误）解析报错 | 期望抛错或返回校验失败 |
| 集成测试 | ref 解析：ref 指向的 item_id 在 config 中存在 | resolveRef 返回 ResolvedItem |
| 集成测试 | ref 指向的 item_id 不存在时明确报错 | resolveRef 抛出 RefResolutionError |
| 端到端 | accept-e2-s1.ts 覆盖 AC-1～AC-7 | 运行脚本，全部 PASS |

---

## 6. 与 Story 1.1 的衔接

- 复用 scoring/rules/default/、scoring/data/、scoring/docs/ 目录结构
- 解析器产出的结构化配置可供 Story 1.1 的 calculator 或 Story 3.x 的解析层导入使用
- 不修改 scoring/core/calculator.ts 内部逻辑；本 Story 仅提供规则数据源

---

## 7. 需求映射清单（plan ↔ spec）

| spec § | 要点 | plan 对应 |
|--------|------|-----------|
| §2.1 目录结构 | default/、gaps、iteration-tier | §4 |
| §2.2 环节 2/3/4 schema | version、stage、weights、items、veto_items | §2.1 |
| §2.3 ref 解析 | code-reviewer-config#item_id、不存在报错 | §3.2、§3.3 |
| §2.4 gaps-scoring | 前置 40%、后置 implement/post_impl | §2.2 |
| §2.5 iteration-tier | 1→1.0、2→0.8、3→0.5、4→0、severity_override | §2.3 |
| §3 验收标准 AC-1～AC-7 | 全部 | §5、§4、accept-e2-s1 |

---

## 8. 禁止词表合规

本 plan 及后续 GAPS/tasks 禁止使用：可选、后续、待定、酌情、视情况、先实现、或后续扩展。上述用语未在本文中出现。
