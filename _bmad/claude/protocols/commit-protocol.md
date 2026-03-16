# Commit Protocol

提交请求与门控协议。

## Rules

1. **执行 Agent 禁止直接 `git commit`**
2. 只能发 `commit_request` 到 bmad-master
3. 只有 bmad-master 可根据 audit_status 放行提交

## Commit Request Format

```yaml
request_type: commit_request
stage: implement
audit_status: pending | pass | fail
artifact_paths:
  - src/...
  - tests/...
```

## Gate Logic

- `audit_status=fail` → **DENY**
- `audit_status=pass` + `bmad-master` 确认 → **ALLOW**
- 未经审计直接 commit → **BLOCKED**

## Only bmad-master can approve commit

bmad-master 根据以下状态决定：
- `.claude/state/bmad-progress.yaml` 中的 `audit_status`
- 最近一次审计报告的结论
- 当前 stage 是否允许提交
