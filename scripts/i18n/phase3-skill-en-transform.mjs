#!/usr/bin/env node
/**
 * Phase 3: translate prose outside ``` fences for SKILL.en.md (Han → English).
 * Preserves code fences verbatim. Idempotent-safe for repeated runs on mixed text.
 */
import fs from "node:fs";
import path from "node:path";

const HAN = /[\u4e00-\u9fff]/;

/** @type {Array<[RegExp, string]>} */
const RULES = [
  // Common tokens (order: longer phrases first where needed)
  [/全程使用中文/g, "Use Chinese for all deliverables"],
  [/主 Agent/g, "Main Agent"],
  [/子代理/g, "subagent"],
  [/子任务/g, "subtask"],
  [/审计子任务/g, "audit subtask"],
  [/辩论子任务/g, "debate subtask"],
  [/实施子任务/g, "implementation subtask"],
  [/审计报告/g, "audit report"],
  [/任务列表/g, "task list"],
  [/根因分析/g, "root-cause analysis"],
  [/根因共识/g, "root-cause consensus"],
  [/修复方案/g, "fix plan"],
  [/产出路径约定/g, "Output path conventions"],
  [/占位符/g, "placeholder"],
  [/整段复制/g, "copy the full template verbatim"],
  [/禁止省略/g, "do not omit"],
  [/禁止/g, "do not"],
  [/必须/g, "must"],
  [/优先/g, "prefer"],
  [/回退/g, "fallback to"],
  [/找不到/g, "if not found"],
  [/阶段一/g, "Phase 1"],
  [/阶段二/g, "Phase 2"],
  [/阶段三/g, "Phase 3"],
  [/阶段四/g, "Phase 4"],
  [/实施后审计/g, "post-implementation audit"],
  [/信息补充/g, "supplementary information"],
  [/展示名/g, "display name"],
  [/多角色辩论/g, "multi-role debate"],
  [/收敛条件/g, "convergence criteria"],
  [/用户/g, "user"],
  [/示例/g, "Example"],
  [/含义/g, "meaning"],
  [/未替换后果/g, "if not replaced"],
  [/一段话/g, "one paragraph"],
  [/同上/g, "same as above"],
  [/资源/g, "Resource"],
  [/路径\/说明/g, "path / notes"],
  [/说明/g, "notes"],
  [/以下/g, "the following"],
  [/表格/g, "table"],
  [/原则/g, "Principle"],
  [/必备字段/g, "Required fields"],
  [/可接受/g, "Acceptable"],
  [/不可接受/g, "Not acceptable"],
  [/最小示例/g, "Minimal example"],
  [/排除理由/g, "exclusion reason"],
  [/客观依据/g, "objective evidence"],
  [/触发时机/g, "When to run"],
  [/检查逻辑/g, "Check logic"],
  [/若无备份，不提示。本检查不阻塞后续阶段。/g, "If there is no backup, do not prompt. This check does not block later phases."],
  [/有 story 上下文的 BUGFIX/g, "BUGFIX with story context"],
  [/无 story 上下文的 BUGFIX/g, "BUGFIX without story context"],
  [/产出/g, "Artifact"],
  [/流程/g, "Flow"],
  [/推荐 BMAD Agent（展示名）/g, "Recommended BMAD Agents (display names)"],
  [/主导根因与方案/g, "lead root cause and solution"],
  [/现象与数据/g, "phenomena and data"],
  [/实现与代码路径/g, "implementation and code paths"],
  [/复现与验收/g, "reproduction and acceptance"],
  [/影响与优先级/g, "impact and priority"],
  [/架构师模式/g, "architect mode"],
  [/开发模式/g, "developer mode"],
  [/模板 ID/g, "Template ID"],
  [/模板边界/g, "Template boundary"],
  [/自代码块内/g, "from inside the code block"],
  [/起，至/g, "through"],
  [/止。/g, "end."],
  [/主 Agent 操作/g, "Main Agent action"],
  [/将下方/g, "copy the following"],
  [/仅将/g, "only replace"],
  [/替换为/g, "with"],
  [/不得删减/g, "do not delete"],
  [/发起前自检清单/g, "pre-launch self-check list"],
  [/简化路径/g, "Shortcut path"],
  [/若用户提供的补充信息已充分/g, "If the user supplement is already sufficient"],
  [/辩论可省略，审计不可省略。/g, "Debate may be skipped; audit cannot be skipped."],
  [/使用示例/g, "Usage examples"],
  [/以下示例中/g, "In the examples below"],
  [/执行阶段/g, "run Phase"],
  [/迭代至/g, "iterate until"],
  [/审计通过/g, "audit passes"],
  [/子任务返回后/g, "after the subtask returns"],
  [/兜底 cleanup/g, "fallback cleanup"],
  [/强制步骤/g, "mandatory step"],
  [/执行完成后删除/g, "after running, delete"],
  [/目标/g, "Goal"],
  [/项/g, "Item"],
  [/内容/g, "Content"],
  [/职责/g, "Responsibility"],
  [/未通过时必做/g, "When audit fails, you must"],
  [/评分写入/g, "score write"],
  [/项目根目录执行/g, "run at repo root"],
  [/路径约定/g, "Path rule"],
  [/累计失败轮数/g, "cumulative failed rounds"],
  [/一次通过/g, "passed on first try"],
  [/主 Agent 禁止事项/g, "Main Agent prohibitions"],
  [/若 subagent 返回不完整/g, "If the subagent returns incomplete output"],
  [/可发起带 `resume` 的二次子任务/g, "you may launch a second subtask with `resume`"],
  [/不得\*\*替代 subagent 直接改代码/g, "do not replace the subagent and edit code directly"],
];

function transformOutsideLine(line) {
  if (!HAN.test(line)) return line;
  let out = line;
  for (const [re, rep] of RULES) {
    out = out.replace(re, rep);
  }
  return out;
}

function transformAll(src) {
  const lines = src.split(/\r?\n/);
  let inCode = false;
  const out = [];
  for (const line of lines) {
    const t = line.trimStart();
    if (t.startsWith("```")) {
      inCode = !inCode;
      out.push(line);
      continue;
    }
    if (inCode) {
      out.push(line);
      continue;
    }
    out.push(transformOutsideLine(line));
  }
  return out.join("\n");
}

function main() {
  const root = process.argv[2];
  if (!root) {
    console.error("Usage: node phase3-skill-en-transform.mjs <file>");
    process.exit(1);
  }
  const abs = path.resolve(root);
  let s = fs.readFileSync(abs, "utf8");
  if (!s.startsWith("<!-- BLOCK_LABEL_POLICY=B -->")) {
    s = "<!-- BLOCK_LABEL_POLICY=B -->\n" + s;
  }
  s = transformAll(s);
  fs.writeFileSync(abs, s, "utf8");
}

main();
