---
name: auto-commit-utf8
description: Generate a Chinese git commit message from current code/doc changes and commit using a temporary UTF-8 txt file to avoid PowerShell encoding issues. Use when the user asks to summarize changes into a commit, requires Chinese commit messages, or needs automated garble-checking and correction via amend for the last commit.
---

# Auto Commit UTF-8

## Overview

Create a clean Chinese commit message based on current diffs, commit via a temp UTF-8 txt file, and verify the recorded commit message is not garbled.

## Workflow

### 1) Collect change context

- Run `git status -sb`, `git diff`, and `git log -5 --oneline`.
- Identify what should be included or excluded (skip secrets or user-irrelevant files).

### 2) Draft the Chinese commit message

- Use 1?2 sentence subject/body in Chinese, focusing on intent and impact.
- Avoid file lists in the message; keep it concise and meaningful.

### 3) Write temp UTF-8 file

- Write commit message to a **reserved** temporary file in the repo root: **`temp_commit_message.txt`** (use this exact name so it can be excluded from staging).
- Use the Write tool to ensure proper UTF-8 output.
- This file must **never** be staged or committed.

### 4) Stage and commit (do not stage the temp file)

- Stage changes with `git add -A` (or only relevant paths if needed).
- **Unstage the temp file** so it is never committed:
  ```bash
  git reset -- temp_commit_message.txt
  ```
- Verify with `git status` that `temp_commit_message.txt` is not in "Changes to be committed".
- Commit using: `git commit -F temp_commit_message.txt`.

### 5) Verify commit message is not garbled

- Run `git log -1 --pretty=%B` and compare with the temp file content.
- If the log output contains `?` or differs from the temp file, treat as garbled.

### 6) Fix garbled message (amend rules)

- Only amend if the user explicitly requested auto-fix and the commit was created in this session and not pushed.
- Amend with the same temp file after rewriting, then re-check `git log -1 --pretty=%B`.
- Repeat until clean or stop if amend is disallowed; report to the user.

### 7) Clean up

- Delete the temp txt file after successful commit or after any final failure.

## Safety Checks

- **Never stage or commit `temp_commit_message.txt`** ? always run `git reset -- temp_commit_message.txt` after `git add` and before `git commit`.
- Never commit secrets or files like `.env`, credentials, or private keys.
- Do not amend commits that were not created by you in this session or that are already pushed.
- If commit fails due to hooks or conflicts, fix and create a new commit instead of amending.

## Example Commit Message (Chinese)

```
fix: ???????????????

- ????????????????????????
```

