# config/

- **code-reviewer-config.yaml**：code-reviewer 多模式配置，支持 4 种模式（code / prd / arch / pr）。  
  Cursor 通过读取此文件按 mode 切换审计提示词；prompt_template 路径优先相对于本 config 目录，否则从 `speckit-workflow/references/` 解析。  
  详见 `docs/BMAD/bmad-speckit-integration-FINAL-COMPLETE.md` 与 code-reviewer 技能说明。
