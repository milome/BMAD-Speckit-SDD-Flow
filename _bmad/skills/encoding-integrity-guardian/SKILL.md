---
name: encoding-integrity-guardian
description: Guard UTF-8 and encoding integrity for bulk markdown/csv/skill edits, Codex/Cursor/Claude surface generation, npm pack/release, Windows PowerShell file operations, and any detection of mojibake marker patterns. Use before and after batch rewrites or generated-surface changes.
---

# Encoding Integrity Guardian

Use this skill whenever file content may cross a fragile encoding boundary.

## Mandatory Triggers

- Batch editing markdown, CSV, YAML, TOML, skill, command, or README files.
- Generating or regenerating Codex/Cursor/Claude surfaces.
- Running npm pack/release or prepublish validation.
- Using Windows PowerShell to read/write project text files.
- Seeing mojibake marker patterns, private-use glyphs, replacement characters, or corrupted UTF-8 text.

## Workflow

1. Check the worktree with `git status --short`; do not overwrite unrelated user changes.
2. Run the scan script in dry audit mode:
   ```powershell
   node _bmad/skills/encoding-integrity-guardian/scripts/check-encoding-integrity.js
   ```
3. Classify hits as `source`, `generated`, `docs`, `tests`, or `runtime`.
4. For generated surfaces, trace the generator and fix the source/generator before regenerating.
5. For source files, trace the first polluted commit with `git log --follow` and `git show`.
6. Choose one repair strategy:
   - `restore`: recover from a clean parent commit or upstream source.
   - `regenerate`: fix generator inputs and regenerate outputs.
   - `manual semantic rewrite`: rewrite damaged prose when no clean source exists.
7. After edits, rerun encoding scan, lint, and targeted tests.
8. Emit a manifest or RCA receipt listing checked paths, hit count, repair strategy, verification commands, and residual risks.

## Windows Rules

- Do not pipe file bodies through PowerShell for batch rewrites.
- Avoid `>`, `>>`, and `Out-File` for source/docs/skill content.
- Prefer Node `fs.readFileSync(path, 'utf8')` and `fs.writeFileSync(path, content, 'utf8')`.
- If PowerShell must write a small file, use PowerShell 7 and `Set-Content -Encoding utf8NoBOM`.
- Never claim mojibake is fixed by "converting encoding" after text is already corrupted; restore semantic content from a clean source.

## Required Evidence

- Encoding scan output or report path.
- `git diff --stat` after edits.
- Targeted validation command output.
- RCA receipt when pollution is found.
