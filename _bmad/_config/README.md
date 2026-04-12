# config/

- **code-reviewer-config.yaml**：code-reviewer 多模式配置，支持 5 种模式（code / readiness / prd / arch / pr）。
  Cursor 通过读取此文件按 mode 切换审计提示词；prompt_template 路径优先相对于本 config 目录，否则从 `speckit-workflow/references/` 解析。

- **eval-lifecycle-report-paths**（若在 coach-trigger 或相关配置中）：评测生命周期中各阶段报告路径约定；与 scoring 的 eval_question scenario 对应。

- **coach-trigger.yaml**：Coach 诊断触发配置；`required_skill_path`、`auto_trigger_post_impl`、`run_mode`。  
   scoring/coach 读取此文件，见 `scoring/coach/README.md`。

- **audit-item-mapping.yaml**：审计项 item_id 映射；scoring/parsers 从报告问题描述解析时查找标准 item_id。  
   与 `scoring/parsers/audit-item-mapping.ts` 对应，见 `scoring/parsers/`。
